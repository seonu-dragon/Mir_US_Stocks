#!/usr/bin/env python3
"""KR 증시자금 · 시장 투자자별 매매 · 외국인/기관 순매수 상위 — 사실 표시용.

무엇을 만드나:
  data/korea/market_funds.{json,js}   window.KR_MARKET_FUNDS

1) 증시자금(일별) — 금융투자협회 종합통계(freesis) 공개 통계
     STATSCU0100000060BO  투자자예탁금 · 위탁매매 미수금 · 반대매매 금액 · 미수금 대비 반대매매 비중
     STATSCU0100000070BO  신용공여 잔고(신용거래융자 전체·유가증권·코스닥)
   `meta/getMetaDataList.do` 에 기간을 주면 그 기간 전체가 한 번에 온다 — 실행당 2콜.
   첫 실행은 1년, 이후는 마지막 날짜 10일 전부터 다시 받아 겹치는 날은 덮는다(수정 반영).
   원자료 단위는 백만 원이고 여기서 억 원으로 바꾼다. 영업일 1~2일 늦게 올라온다.
   이용 조건: 사이트 하단 고지는 '참고용·손익 무책임' 뿐이고 자동 수집 금지 조항은 없다
   (금투협 본 사이트의 '이메일 무단수집 거부' 는 이메일 주소 수집 얘기다, 2026-09-26 확인).
   출처는 화면에 적는다.

2) 시장 투자자별 순매수(일별, 억 원) — 네이버 m.stock `index/{KOSPI|KOSDAQ}/trend?bizdate=`
   최신 하루만 주지만 bizdate 로 과거 날짜를 물을 수 있다. 휴장일은 세 값이 모두 0 으로 온다
   (건너뛴다). 첫 실행은 약 3개월(기간 칩 1주/1개월/3개월)을 채우고, 이후엔 마지막 저장일
   (장 마감 뒤 값 확정 반영) + 그 뒤 평일만 묻는다 — 평상시 2~4콜.

3) 외국인·기관 순매수 상위 10 — 새 호출 없음.
   build_kr_investor_flow.py 가 전 종목 20거래일 일별 행의 '순매수 수량 × 그날 종가' 로 계산해
   investor_flow.json 의 top 에 실은 것을 옮겨 싣는다. 체결가 가중이 아니라 추정치다(화면에 적는다).

교차 검증: freesis 월말 값을 한국은행 ECOS 901Y056(월말, 원자료 금투협)과 대조한다 —
산업 지표 빌더가 이미 받아 둔 data/industry_indicators.json 을 읽는다(ECOS 추가 호출 없음).

신호가 아니다. 예탁금·신용잔고·수급은 '무슨 일이 있었나' 이고, 여기서 매매 판단을 만들지 않는다.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "market_funds.json"
OUT_JS = ROOT / "data" / "korea" / "market_funds.js"
FLOW_JSON = ROOT / "data" / "korea" / "investor_flow.json"
INDUSTRY = ROOT / "data" / "industry_indicators.json"

FREESIS_URL = "https://freesis.kofia.or.kr/meta/getMetaDataList.do"
FREESIS_FUNDS = "STATSCU0100000060BO"
FREESIS_CREDIT = "STATSCU0100000070BO"
NAVER_INDEX_TREND = "https://m.stock.naver.com/api/index/{market}/trend?bizdate={d}"
MARKETS = ("KOSPI", "KOSDAQ")

FUNDS_BACKFILL_DAYS = 370      # 첫 실행 1년
FUNDS_OVERLAP_DAYS = 10        # 증분 때 겹쳐 받아 수정분을 덮는다
FUNDS_KEEP = 800               # 약 3년치까지 보관
INVESTOR_BACKFILL_DAYS = 95    # 첫 실행 약 3개월(63거래일+)
INVESTOR_KEEP = 260            # 약 1년치
MIN_INTERVAL = 0.35            # 네이버 지수 추이 호출 간격(초)
MARKET_CLOSE_HHMM = "15:40"    # 이 시각 전에는 오늘 수급을 확정값으로 보지 않는다

UA = "Mozilla/5.0 (Mir KR market funds; daily)"
_last = [0.0]


# ---------------------------------------------------------------- 공용
def now_kst() -> datetime:
    return datetime.now(KST)


def stamp_kst(dt: datetime | None = None) -> str:
    return (dt or now_kst()).strftime("%Y-%m-%d %H:%M KST")


def iso(yyyymmdd: str) -> str:
    s = str(yyyymmdd or "").replace("-", "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 and s.isdigit() else ""


def num(v):
    """'-14,649' / '+3,189' / 3687 / '0.4' → float. 빈 값·'-' 는 None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", "").replace("%", "").replace("+", "").strip()
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def eok(million):
    """백만 원 → 억 원(소수 둘째 자리)."""
    v = num(million)
    return None if v is None else round(v / 100.0, 2)


def throttle():
    gap = MIN_INTERVAL - (time.monotonic() - _last[0])
    if gap > 0:
        time.sleep(gap)
    _last[0] = time.monotonic()


def http_json(url: str, *, body: dict | None = None, headers: dict | None = None, tries: int = 3, timeout: int = 30):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    hdrs = {"User-Agent": UA, "Accept": "application/json"}
    if body is not None:
        hdrs["Content-Type"] = "application/json; charset=UTF-8"
    hdrs.update(headers or {})
    last_err = None
    for attempt in range(tries):
        throttle()
        try:
            req = urllib.request.Request(url, data=data, headers=hdrs, method="POST" if data else "GET")
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            last_err = e
            time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(f"{url}: {last_err}")


# ---------------------------------------------------------------- 1) 증시자금
def parse_funds(ds060: list, ds070: list) -> dict[str, dict]:
    """freesis 두 표 → {YYYY-MM-DD: row}. 단위 억 원(비중은 %).

    060: TMPV1 일자, TMPV2 투자자예탁금(장내파생 예수금 제외), TMPV5 위탁매매 미수금,
         TMPV6 미수금 대비 실제 반대매매 금액, TMPV7 미수금 대비 반대매매 비중(%)
    070: TMPV2 신용거래융자 전체, TMPV3 유가증권, TMPV4 코스닥
    (TMPV3/4 of 060 = 장내파생 거래예수금·RP 매도잔고 는 화면에 안 써서 버린다.)
    """
    rows: dict[str, dict] = {}
    for r in ds060 or []:
        d = iso(r.get("TMPV1"))
        if not d:
            continue
        rows.setdefault(d, {"d": d}).update({
            "dep": eok(r.get("TMPV2")),
            "unpaid": eok(r.get("TMPV5")),
            "forced": eok(r.get("TMPV6")),
            "forcedPct": num(r.get("TMPV7")),
        })
    for r in ds070 or []:
        d = iso(r.get("TMPV1"))
        if not d:
            continue
        rows.setdefault(d, {"d": d}).update({
            "credit": eok(r.get("TMPV2")),
            "creditKospi": eok(r.get("TMPV3")),
            "creditKosdaq": eok(r.get("TMPV4")),
        })
    return rows


def merge_by_date(prev: list[dict], fresh: dict[str, dict], keep: int) -> list[dict]:
    """날짜 키로 합친다 — 새 값이 이긴다(필드 단위). 오름차순, 최근 keep 개."""
    book = {r["d"]: dict(r) for r in prev or [] if r.get("d")}
    for d, r in fresh.items():
        book.setdefault(d, {"d": d}).update({k: v for k, v in r.items() if v is not None})
    out = [book[d] for d in sorted(book)]
    return out[-keep:]


def fetch_freesis(obj: str, start: date, end: date) -> list:
    body = {"dmSearch": {
        "tmpV40": "1000000", "tmpV41": "1", "tmpV1": "D",
        "tmpV45": start.strftime("%Y%m%d"), "tmpV46": end.strftime("%Y%m%d"),
        "OBJ_NM": obj,
    }}
    j = http_json(FREESIS_URL, body=body, headers={"Referer": "https://freesis.kofia.or.kr/stat/FreeSIS.do"})
    ds = j.get("ds1") if isinstance(j, dict) else None
    if not isinstance(ds, list):
        raise RuntimeError(f"freesis {obj}: 응답 형식이 다르다 ({str(j)[:120]})")
    return ds


def funds_window(prev_rows: list[dict], today: date) -> tuple[date, date]:
    if prev_rows:
        last = datetime.strptime(prev_rows[-1]["d"], "%Y-%m-%d").date()
        return last - timedelta(days=FUNDS_OVERLAP_DAYS), today
    return today - timedelta(days=FUNDS_BACKFILL_DAYS), today


# ---------------------------------------------------------------- 2) 시장 투자자별
def parse_index_trend(j) -> dict | None:
    """{'bizdate','personalValue','foreignValue','institutionalValue'} → 행. 휴장(전부 0)이면 None."""
    if not isinstance(j, dict):
        return None
    d = iso(j.get("bizdate"))
    ind, frn, org = num(j.get("personalValue")), num(j.get("foreignValue")), num(j.get("institutionalValue"))
    if not d or ind is None or frn is None or org is None:
        return None
    if ind == 0 and frn == 0 and org == 0:
        return None
    return {"d": d, "ind": ind, "frn": frn, "org": org}


def investor_dates(prev_rows: list[dict], now: datetime) -> list[date]:
    """물어볼 날짜: 마지막 저장일(값 확정 반영) + 그 뒤 평일. 첫 실행이면 최근 약 3개월 평일.

    장 마감(15:40) 전이면 오늘은 뺀다 — 장중 값이 확정치처럼 저장되지 않게.
    """
    today = now.date()
    include_today = now.strftime("%H:%M") >= MARKET_CLOSE_HHMM
    if prev_rows:
        start = datetime.strptime(prev_rows[-1]["d"], "%Y-%m-%d").date()
    else:
        start = today - timedelta(days=INVESTOR_BACKFILL_DAYS)
    out = []
    d = start
    while d <= today:
        if d.weekday() < 5 and (d < today or include_today):
            out.append(d)
        d += timedelta(days=1)
    return out


def fetch_investors(prev: dict, now: datetime) -> tuple[dict, list[str]]:
    out, errors = {}, []
    for m in MARKETS:
        prev_rows = list((prev or {}).get(m) or [])
        fresh: dict[str, dict] = {}
        for d in investor_dates(prev_rows, now):
            try:
                row = parse_index_trend(http_json(
                    NAVER_INDEX_TREND.format(market=m, d=d.strftime("%Y%m%d")),
                    headers={"Referer": "https://m.stock.naver.com/"}, timeout=15))
            except RuntimeError as e:
                errors.append(f"{m} {d}: {e}")
                continue
            if row:
                fresh[row["d"]] = row
        out[m] = merge_by_date(prev_rows, fresh, INVESTOR_KEEP)
    return out, errors


# ---------------------------------------------------------------- 3) 순매수 상위
def load_top(path: Path | None = None) -> dict | None:
    try:
        return json.loads((path or FLOW_JSON).read_text(encoding="utf-8")).get("top")
    except (OSError, json.JSONDecodeError, AttributeError):
        return None


# ---------------------------------------------------------------- 교차 검증
def ecos_check(funds_rows: list[dict], industry: dict | None) -> dict | None:
    """freesis 월말 값 vs ECOS 901Y056 월말(조 원). 두 쪽 다 있는 가장 최근 달 하나."""
    ind = (industry or {}).get("indicators") or {}
    dep = {p["date"]: p["val"] for p in (ind.get("kr_investor_deposits") or {}).get("series") or [] if p.get("val") is not None}
    cred = {p["date"]: p["val"] for p in (ind.get("kr_margin_loans") or {}).get("series") or [] if p.get("val") is not None}
    month_end: dict[str, dict] = {}
    for r in funds_rows:
        month_end[r["d"][:7]] = r            # 오름차순이라 마지막 값이 월말
    last_month = max(month_end) if month_end else None
    for m in sorted(set(month_end) & set(dep), reverse=True):
        if m == last_month and m >= now_kst().strftime("%Y-%m"):
            continue                          # 진행 중인 달은 월말이 아니다
        r = month_end[m]
        if r.get("dep") is None:
            continue
        f_dep = round(r["dep"] / 10000, 2)   # 억 → 조
        out = {"month": m, "freesisDate": r["d"], "depFreesis": f_dep, "depEcos": dep[m],
               "depDiffPct": round((f_dep - dep[m]) / dep[m] * 100, 2) if dep[m] else None}
        if m in cred and r.get("credit") is not None:
            f_cr = round(r["credit"] / 10000, 2)
            out.update({"creditFreesis": f_cr, "creditEcos": cred[m],
                        "creditDiffPct": round((f_cr - cred[m]) / cred[m] * 100, 2) if cred[m] else None})
        diffs = [abs(v) for v in (out.get("depDiffPct"), out.get("creditDiffPct")) if v is not None]
        out["ok"] = bool(diffs) and max(diffs) <= 1.0
        return out
    return None


# ---------------------------------------------------------------- main
def load_prev() -> dict:
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 증시자금·시장 수급")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--skip-funds", action="store_true", help="freesis 호출 생략(시험용)")
    ap.add_argument("--skip-investors", action="store_true", help="네이버 지수 추이 호출 생략(시험용)")
    args = ap.parse_args()

    prev = load_prev()
    now = now_kst()
    errors: list[str] = []

    # 1) 증시자금
    prev_funds = list(((prev.get("funds") or {}).get("rows")) or [])
    funds_rows, funds_ok = prev_funds, False
    if not args.skip_funds:
        start, end = funds_window(prev_funds, now.date())
        try:
            ds060 = fetch_freesis(FREESIS_FUNDS, start, end)
            ds070 = fetch_freesis(FREESIS_CREDIT, start, end)
            fresh = parse_funds(ds060, ds070)
            funds_rows = merge_by_date(prev_funds, fresh, FUNDS_KEEP)
            funds_ok = bool(fresh)
            print(f"[증시자금] {start}~{end} {len(fresh)}일 받음 → 보관 {len(funds_rows)}일")
        except RuntimeError as e:
            errors.append(f"freesis: {e}")
            print(f"[증시자금] 실패 — 기존 {len(prev_funds)}일 유지: {e}")

    # 2) 시장 투자자별
    prev_inv = prev.get("investors") or {}
    investors = {m: list(prev_inv.get(m) or []) for m in MARKETS}
    inv_ok = False
    if not args.skip_investors:
        investors, inv_err = fetch_investors(prev_inv, now)
        errors.extend(inv_err)
        inv_ok = all(investors.get(m) for m in MARKETS) and len(inv_err) < 3
        print(f"[투자자별] " + " · ".join(f"{m} {len(investors[m])}일" for m in MARKETS)
              + (f" · 오류 {len(inv_err)}건" if inv_err else ""))

    # 3) 순매수 상위(파일만 읽음)
    top = load_top() or prev.get("top")

    if not funds_rows and not any(investors.get(m) for m in MARKETS):
        print("[중단] 증시자금·투자자별 모두 0건 — 파일을 쓰지 않는다.")
        return 1
    if not funds_ok and not inv_ok and not args.skip_funds and not args.skip_investors:
        print("[중단] 이번 실행에서 새로 받은 것이 없다 — 기존 파일 유지.")
        return 1

    try:
        industry = json.loads(INDUSTRY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        industry = None

    payload = {
        "updatedAtKst": stamp_kst(now),
        "count": len(funds_rows),
        "unit": "억 원",
        "source": {
            "funds": "금융투자협회 종합통계(freesis)",
            "investors": "네이버 금융 (코스피·코스닥 투자자별 순매수)",
            "top": "네이버 금융 종목별 순매수 수량 × 종가(추정)",
        },
        "funds": {"asOf": funds_rows[-1]["d"] if funds_rows else None, "rows": funds_rows},
        "investors": {"asOf": max((investors[m][-1]["d"] for m in MARKETS if investors.get(m)), default=None),
                      **{m: investors.get(m) or [] for m in MARKETS}},
        "top": top,
        "check": ecos_check(funds_rows, industry),
        "errors": errors[:10],
    }
    import sec_client as sec
    sec.write_data(OUT_JSON, OUT_JS, "KR_MARKET_FUNDS", payload, indent=None)
    print(f"[완료] 증시자금 {len(funds_rows)}일 · 코스피 {len(payload['investors']['KOSPI'])}일 · "
          f"상위표 {'있음' if top else '없음'} · 교차검증 {payload['check']}")

    if args.push:
        from briefing_store import repository_publish_lock
        with repository_publish_lock(ROOT):
            if not sec.git_publish(["data/korea/market_funds.json", "data/korea/market_funds.js"], "KR market funds"):
                return 1
    # 부분 실패(한쪽 소스만 성공)는 파일은 쓰되 빨간 표시로 알린다(continue-on-error 스텝).
    if (not args.skip_funds and not funds_ok) or (not args.skip_investors and not inv_ok):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
