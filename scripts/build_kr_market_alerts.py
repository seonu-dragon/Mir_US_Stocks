#!/usr/bin/env python3
"""국내 시장경보·이상 종목 보드 (KR 전용).

두 갈래로 모은다.

1) **KRX 공식 지정 현황 — KIND(kind.krx.co.kr)**
   KIND 의 공개 조회 화면이 쓰는 '엑셀 다운로드' 경로(POST, EUC-KR HTML 표)를 그대로
   부른다. 조회 화면과 같은 요청이고 종목코드 열이 들어 있어 이름 매칭이 필요 없다.
   하루 5회 요청(주의·경고·위험·거래정지·관리종목)뿐이다.
     - 투자주의 / 투자경고 / 투자위험  : /investwarn/investattentwarnrisky.do
       (기간 조회 = "그 기간 중 지정 중인 종목". 기준일 ~ +10일로 조회해 이미 공시된
        다음 거래일 지정분도 지정일과 함께 싣는다. 해제일이 기준일 이하인 행은 뺀다.)
     - 매매거래정지 종목(현재)         : /investwarn/tradinghaltissue.do
     - 관리종목(현재)                  : /investwarn/adminissue.do
   단기과열종목·VI(변동성완화장치) 발동 내역은 무료 EOD 소스를 찾지 못해 싣지 않는다
   (KIND 메뉴에 없고, KRX 정보데이터시스템은 로그인·세션 의존). 지어내지 않는다.

2) **발행된 KR 스냅샷에서 계산** — 새 외부 호출 없음(상·하한가만 네이버 목록 1~4회)
     - 상한가 / 하한가 : 네이버 m.stock 등락률 목록의 compareToPreviousPrice.code
       (1=상한, 4=하한). 스냅샷 수집과 같은 소스. 등락률 반올림으로 추정하지 않는다.
     - 52주 신고가 / 신저가 : data/korea/details/<T>.json 실측 일봉(yahoo/yahoo-cache)의
       당일 장중 고가(저가)가 직전 251거래일 고가 최대(저가 최소)를 넘은 종목.
       합성 이력 종목·이력 200봉 미만(신규 상장 등)은 제외.
     - 거래대금 급증 : 당일 (종가×거래량) ÷ 직전 20거래일 평균(종가×거래량).
       배수 3배 이상 · 당일 30억원 이상. 종가×거래량 근사치이고 매매 신호가 아니다.

산출물:
  - data/korea/market_alerts.json
  - data/korea/market_alerts.js   (window.KR_MARKET_ALERTS — 브라우저가 읽는 쪽)

스키마(프론트 계약):
  {updatedAtKst, baseDate, count, sources, sections: {
     caution|warning|risk: {asOf, status, rows:[{ticker, company, market, type?,
                            noticeDate, designatedDate, releaseDate?}]},
     halt:  {asOf, status, rows:[{ticker, company, market, reason}]},
     admin: {asOf, status, rows:[{ticker, company, market, designatedDate, reason}]},
     limitUp|limitDown: {asOf, status, rows:[{ticker, company, market, price, changePct}]},
     newHigh|newLow:    {asOf, status, rows:[{ticker, company, market, price, changePct, level}]},
     valueSurge:        {asOf, status, rows:[{ticker, company, market, price, changePct,
                          valueEok, avgValueEok, ratio}]}}}
  status: "ok"(이번 실행에서 수집) · "carried"(이번엔 실패 → 직전 발행분 유지, asOf 는 옛 값).

한 섹션이 실패해도 나머지는 발행한다. 전 섹션이 실패하면 기존 파일을 유지하고 exit 1.
update_korea_data.py 가 스냅샷을 쓴 뒤 서브빌더로 부르고, data/korea/ 커밋에 함께 실린다.
"""

from __future__ import annotations

import argparse
import datetime
import html as htmllib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "korea" / "market_alerts.json"
OUT_JS = ROOT / "data" / "korea" / "market_alerts.js"
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
DETAILS_DIR = ROOT / "data" / "korea" / "details"

KIND = "https://kind.krx.co.kr"
UA = "Mozilla/5.0 (compatible; MirDashboard/1.0; +https://seonu-dragon.github.io/Mir_US_Stocks/)"
MSTOCK = "https://m.stock.naver.com/api"

SURGE_MIN_RATIO = 3.0
SURGE_MIN_VALUE_EOK = 30.0  # 억원
SURGE_TOP = 40
HIGH_LOW_TOP = 150
HIST_MIN_BARS = 200
REAL_HISTORY = {"yahoo", "yahoo-cache"}

SECTION_KEYS = ("caution", "warning", "risk", "halt", "admin",
                "limitUp", "limitDown", "newHigh", "newLow", "valueSurge")


# ---------------------------------------------------------------------------
# 공통
# ---------------------------------------------------------------------------

def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None


def load_snapshot_universe() -> dict[str, dict]:
    """{티커: {company, market, price, changePct, marketCapT, historySource}}."""
    try:
        snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  [경고] KR 스냅샷을 못 읽음: {exc}")
        return {}
    out = {}
    for s in snap.get("stocks") or []:
        t = str(s.get("ticker") or "")
        if not t:
            continue
        out[t] = {
            "company": s.get("company") or t,
            "market": s.get("market") or "",
            "price": _num(s.get("price")),
            "changePct": _num(s.get("changePct")),
            "marketCapT": _num(s.get("marketCapT")) or 0.0,
            "historySource": s.get("historySource") or "",
        }
    return out


def _row_base(ticker: str, company: str, universe: dict) -> dict:
    meta = universe.get(ticker) or {}
    return {
        "ticker": ticker,
        "company": meta.get("company") or company or ticker,
        "market": meta.get("market") or "",
    }


# ---------------------------------------------------------------------------
# KIND
# ---------------------------------------------------------------------------

def _kind_table(path: str, data: dict) -> list[list[str]]:
    """KIND 엑셀 다운로드(EUC-KR HTML 표) → 행 리스트(첫 행 = 헤더)."""
    import requests
    resp = requests.post(
        f"{KIND}{path}", data=data, timeout=40,
        headers={"User-Agent": UA, "Referer": f"{KIND}{path}"},
    )
    resp.raise_for_status()
    text = resp.content.decode("euc-kr", "replace")
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.S | re.I):
        cells = [htmllib.unescape(re.sub(r"<[^>]+>", "", c)).strip()
                 for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S | re.I)]
        if cells:
            rows.append(cells)
    if not rows:
        raise RuntimeError(f"KIND {path}: 표를 찾지 못함 (응답 {len(text)}자)")
    return rows


def _as_dicts(rows: list[list[str]], required: tuple[str, ...]) -> list[dict]:
    header = rows[0]
    missing = [c for c in required if c not in header]
    if missing:
        raise RuntimeError(f"KIND 표 헤더가 바뀜: {header} (없는 열 {missing})")
    out = []
    for r in rows[1:]:
        if len(r) != len(header):
            continue
        out.append(dict(zip(header, r)))
    return out


def _code(v: str) -> str:
    v = re.sub(r"\s+", "", v or "")
    return v.zfill(6) if v.isdigit() else v


def fetch_market_warnings(base: datetime.date, universe: dict) -> dict[str, list[dict]]:
    """투자주의·경고·위험. 기준일 ~ +10일(이미 공시된 다음 거래일 지정분 포함)."""
    d0 = base.isoformat()
    d1 = (base + datetime.timedelta(days=10)).isoformat()
    specs = {
        "caution": ("1", "invstcautnisu_down", "4"),
        "warning": ("2", "invstwarnisu_down", "3"),
        "risk": ("3", "invstriskisu_down", "3"),
    }
    out = {}
    for key, (menu, forward, order) in specs.items():
        rows = _kind_table("/investwarn/investattentwarnrisky.do", {
            "method": "investattentwarnriskySub", "currentPageSize": "3000", "pageIndex": "1",
            "orderMode": order, "orderStat": "D", "menuIndex": menu, "forward": forward,
            "marketType": "", "startDate": d0, "endDate": d1,
            "searchCorpName": "", "repIsuSrtCd": "", "searchCodeType": "",
        })
        # 결과가 0건이면 표에 '조회된 결과값이 없습니다' 한 칸 행만 있다 — 헤더만 확인.
        need = ("종목명", "종목코드", "공시일", "지정일") + (("유형",) if key == "caution" else ("해제일",))
        items = []
        seen = set()
        for r in _as_dicts(rows, need):
            ticker = _code(r["종목코드"])
            if not ticker:
                continue
            release = r.get("해제일", "").strip()
            if release and release != "-" and release <= d0:
                continue  # 기준일에 이미 해제됨
            item = _row_base(ticker, r["종목명"], universe)
            if key == "caution":
                item["type"] = r["유형"]
            item["noticeDate"] = r["공시일"]
            item["designatedDate"] = r["지정일"]
            if key != "caution":
                item["releaseDate"] = "" if release in ("", "-") else release
            sig = (ticker, item.get("type"), item["designatedDate"])
            if sig in seen:
                continue
            seen.add(sig)
            items.append(item)
        items.sort(key=lambda x: (x["designatedDate"], x["ticker"]), reverse=True)
        out[key] = items
        print(f"  KIND {key}: {len(items)}건")
    return out


def fetch_halts(universe: dict) -> list[dict]:
    rows = _kind_table("/investwarn/tradinghaltissue.do", {
        "method": "searchTradingHaltIssueSub", "forward": "tradinghaltissue_down",
        "currentPageSize": "3000", "pageIndex": "1", "marketType": "0",
        "searchMode": "", "searchCodeType": "", "searchCorpName": "",
    })
    items = []
    for r in _as_dicts(rows, ("종목명", "종목코드", "사유")):
        ticker = _code(r["종목코드"])
        if not ticker:
            continue
        item = _row_base(ticker, r["종목명"], universe)
        item["reason"] = r["사유"]
        items.append(item)
    print(f"  KIND 거래정지: {len(items)}건")
    return items


def fetch_admin(universe: dict) -> list[dict]:
    rows = _kind_table("/investwarn/adminissue.do", {
        "method": "searchAdminIssueSub", "forward": "adminissue_down",
        "currentPageSize": "3000", "pageIndex": "1", "marketType": "",
        "searchMode": "", "searchCodeType": "", "searchCorpName": "",
        "orderMode": "", "orderStat": "",
    })
    items = []
    for r in _as_dicts(rows, ("종목명", "종목코드", "지정일", "지정사유")):
        ticker = _code(r["종목코드"])
        if not ticker:
            continue
        item = _row_base(ticker, r["종목명"], universe)
        item["designatedDate"] = r["지정일"]
        item["reason"] = r["지정사유"]
        items.append(item)
    items.sort(key=lambda x: x["designatedDate"], reverse=True)
    print(f"  KIND 관리종목: {len(items)}건")
    return items


# ---------------------------------------------------------------------------
# 상·하한가 (네이버 m.stock 등락률 목록)
# ---------------------------------------------------------------------------

def fetch_price_limits(universe: dict) -> tuple[str, list[dict], list[dict]]:
    """(거래일, 상한가 목록, 하한가 목록). 등락률 순 목록을 ±29% 밖까지만 넘긴다."""
    import requests
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json",
               "Referer": "https://m.stock.naver.com/"}
    ups, downs, dates = [], [], Counter()
    for kind, flag, target in (("up", "1", ups), ("down", "4", downs)):
        for mk in ("KOSPI", "KOSDAQ"):
            for page in range(1, 6):
                resp = requests.get(f"{MSTOCK}/stocks/{kind}/{mk}?page={page}&pageSize=100",
                                    headers=headers, timeout=20)
                resp.raise_for_status()
                stocks = (resp.json() or {}).get("stocks") or []
                if not stocks:
                    break
                keep_going = False
                for s in stocks:
                    ratio = _num(str(s.get("fluctuationsRatio") or "").replace(",", ""))
                    if ratio is not None and abs(ratio) >= 29.0:
                        keep_going = True
                    if (s.get("compareToPreviousPrice") or {}).get("code") != flag:
                        continue
                    if str(s.get("stockEndType") or "").lower() in {"etf", "etn"}:
                        continue
                    code = str(s.get("itemCode") or "")
                    traded = str(s.get("localTradedAt") or "")[:10]
                    if traded:
                        dates[traded] += 1
                    item = _row_base(code, s.get("stockName") or code, universe)
                    item["price"] = _num(s.get("closePriceRaw"))
                    item["changePct"] = ratio
                    target.append(item)
                if not keep_going:
                    break
    trade_date = dates.most_common(1)[0][0] if dates else ""
    for lst in (ups, downs):
        lst.sort(key=lambda x: (universe.get(x["ticker"], {}).get("marketCapT") or 0), reverse=True)
    print(f"  상한가 {len(ups)} · 하한가 {len(downs)} (거래일 {trade_date or '?'})")
    return trade_date, ups, downs


# ---------------------------------------------------------------------------
# 스냅샷 일봉에서 계산 (52주 신고·신저가, 거래대금 급증)
# ---------------------------------------------------------------------------

def scan_details(universe: dict) -> tuple[str, int, list[dict], list[dict], list[dict]]:
    """(기준일, 기준일 봉이 있는 종목 수, 신고가, 신저가, 거래대금 급증).

    기준일 = 실측 일봉 마지막 날짜의 최빈값. yahoo-cache 로 이월된 종목은 마지막 봉이
    며칠 전일 수 있어 기준일 봉이 없으면 당일 판정에서 빠진다 — 그 규모를 covered 로
    같이 내보내 화면에 '몇 종목 기준' 인지 적는다.
    """
    bars_by_ticker: dict[str, list] = {}
    last_dates = Counter()
    for ticker, meta in universe.items():
        if meta.get("market") not in {"kospi", "kosdaq"}:
            continue  # ETF·기타 제외
        if meta.get("historySource") not in REAL_HISTORY:
            continue  # 합성 이력에서 만든 52주·거래대금은 정직하지 않다
        path = DETAILS_DIR / f"{ticker}.json"
        if not path.exists():
            continue
        try:
            series = json.loads(path.read_text(encoding="utf-8")).get("chartSeries") or []
        except Exception:
            continue
        # [open, high, low, close, volume, date]
        series = [b for b in series if isinstance(b, list) and len(b) >= 6 and b[5]]
        if len(series) < 21:
            continue
        bars_by_ticker[ticker] = series[-253:]
        last_dates[str(series[-1][5])] += 1
    if not last_dates:
        return "", 0, [], [], []
    base = last_dates.most_common(1)[0][0]

    highs, lows, surges = [], [], []
    covered = 0
    for ticker, bars in bars_by_ticker.items():
        last = bars[-1]
        if str(last[5]) != base:
            continue  # 기준일 봉이 없는 종목(거래정지·이력 이월 등)은 당일 판정을 하지 않는다
        meta = universe[ticker]
        o, h, l, c, v = (_num(x) for x in last[:5])
        if not c or c <= 0 or not v or v <= 0:
            # 거래량 0 = 정지 중. 야후는 정지 종목의 종가를 수정주가(2203.04 → 2205)로 흔들어
            # '신고가' 로 오판하게 만든다(씨씨에스·셀레스트라·메디콕스 09-23).
            continue
        covered += 1
        # 야후 일봉은 고가가 종가보다 낮게 오는 날이 있다(씨싸이트 09-23: 고가 11,390 < 종가 11,400).
        h = max(h or 0, c)
        l = min(l, c) if l and l > 0 else c
        price = meta.get("price") or c
        chg = meta.get("changePct")
        prior = bars[:-1]
        if len(bars) >= HIST_MIN_BARS:
            window = prior[-251:]
            p_high = max((_num(b[1]) or 0) for b in window)
            p_low = min((_num(b[2]) or float("inf")) for b in window if (_num(b[2]) or 0) > 0)
            if h and p_high and h > p_high:
                item = _row_base(ticker, "", universe)
                item.update({"price": price, "changePct": chg, "level": round(h, 2)})
                highs.append(item)
            if l and p_low != float("inf") and 0 < l < p_low:
                item = _row_base(ticker, "", universe)
                item.update({"price": price, "changePct": chg, "level": round(l, 2)})
                lows.append(item)
        # 거래대금 급증: 종가×거래량 근사
        prev20 = prior[-20:]
        vals = [(_num(b[3]) or 0) * (_num(b[4]) or 0) for b in prev20]
        vals = [x for x in vals if x > 0]
        today_val = c * (v or 0)
        if len(vals) >= 15 and today_val > 0:
            avg = sum(vals) / len(vals)
            ratio = today_val / avg if avg > 0 else 0
            if ratio >= SURGE_MIN_RATIO and today_val / 1e8 >= SURGE_MIN_VALUE_EOK:
                item = _row_base(ticker, "", universe)
                item.update({
                    "price": price, "changePct": chg,
                    "valueEok": round(today_val / 1e8, 1),
                    "avgValueEok": round(avg / 1e8, 1),
                    "ratio": round(ratio, 1),
                })
                surges.append(item)
    cap = lambda x: universe.get(x["ticker"], {}).get("marketCapT") or 0  # noqa: E731
    highs.sort(key=cap, reverse=True)
    lows.sort(key=cap, reverse=True)
    surges.sort(key=lambda x: x["ratio"], reverse=True)
    print(f"  일봉 스캔: {len(bars_by_ticker)}종목 중 기준일({base}) 봉 {covered}종목 · 신고가 {len(highs)} · "
          f"신저가 {len(lows)} · 거래대금 급증 {len(surges)}")
    return base, covered, highs[:HIGH_LOW_TOP], lows[:HIGH_LOW_TOP], surges[:SURGE_TOP]


# ---------------------------------------------------------------------------
# 조립
# ---------------------------------------------------------------------------

def load_previous() -> dict:
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def build():
    universe = load_snapshot_universe()
    if not universe:
        return None
    prev_sections = (load_previous().get("sections") or {})
    sections: dict[str, dict] = {}
    today = sec.kst_today().isoformat()

    def put(key, rows, as_of, **extra):
        sections[key] = {"asOf": as_of, "status": "ok", **extra, "rows": rows}

    def carry(key, exc):
        print(f"  [경고] {key} 수집 실패: {type(exc).__name__}: {str(exc)[:120]}")
        old = prev_sections.get(key)
        if isinstance(old, dict) and isinstance(old.get("rows"), list):
            sections[key] = {**old, "status": "carried"}

    # 일봉 스캔이 기준 거래일을 정한다(스냅샷과 같은 날).
    base = ""
    try:
        base, covered, highs, lows, surges = scan_details(universe)
        if base:
            put("newHigh", highs, base, covered=covered)
            put("newLow", lows, base, covered=covered)
            put("valueSurge", surges, base, covered=covered)
        else:
            raise RuntimeError("실측 일봉이 있는 종목이 없다")
    except Exception as exc:
        for k in ("newHigh", "newLow", "valueSurge"):
            carry(k, exc)

    try:
        limit_date, ups, downs = fetch_price_limits(universe)
        put("limitUp", ups, limit_date or base or today)
        put("limitDown", downs, limit_date or base or today)
    except Exception as exc:
        for k in ("limitUp", "limitDown"):
            carry(k, exc)

    base_date = base or sections.get("limitUp", {}).get("asOf") or today
    try:
        warns = fetch_market_warnings(datetime.date.fromisoformat(base_date), universe)
        for k, rows in warns.items():
            put(k, rows, base_date)
    except Exception as exc:
        for k in ("caution", "warning", "risk"):
            carry(k, exc)

    try:
        put("halt", fetch_halts(universe), today)
    except Exception as exc:
        carry("halt", exc)
    try:
        put("admin", fetch_admin(universe), today)
    except Exception as exc:
        carry("admin", exc)

    fresh = [k for k, s in sections.items() if s.get("status") == "ok"]
    if not fresh:
        print("  [실패] 이번 실행에서 수집된 섹션이 없다")
        return None

    ordered = {k: sections[k] for k in SECTION_KEYS if k in sections}
    count = sum(len(s["rows"]) for s in ordered.values())
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "baseDate": base_date,
        "count": count,
        "sources": {
            "kind": "KRX KIND 시장경보·투자유의 (kind.krx.co.kr)",
            "limits": "네이버 금융 m.stock 등락률 목록 (상한·하한 표시)",
            "history": "Mir KR 스냅샷 실측 일봉 (Yahoo)",
        },
        "note": "시장경보·거래정지·관리종목은 KRX 공식 지정 현황. 52주 신고·신저가는 장중 고가·저가가 "
                "직전 251거래일 범위를 넘은 종목, 거래대금 급증은 종가×거래량 근사치의 20일 평균 대비 "
                f"{SURGE_MIN_RATIO:g}배 이상(당일 {SURGE_MIN_VALUE_EOK:g}억원 이상). 매매 신호가 아니라 정보. "
                "단기과열·VI 발동은 무료 EOD 소스가 없어 싣지 않는다.",
        "sections": ordered,
    }
    print(f"  완료: 섹션 {len(ordered)}개(이번 수집 {len(fresh)}) · 총 {count}행 · 기준일 {base_date}")
    return payload


def main():
    ap = argparse.ArgumentParser(description="국내 시장경보·이상 종목 보드 수집")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== 국내 시장경보·이상 종목 보드 수집 시작 ===")
    payload = build()
    if not payload:
        print("  [경고] 수집 실패 — 기존 파일 유지(덮어쓰지 않음)")
        raise SystemExit(1)
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "KR_MARKET_ALERTS", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} rows")
        if args.push and not sec.git_publish(
            ["data/korea/market_alerts.json", "data/korea/market_alerts.js"],
            "KR market alerts (KIND)",
        ):
            print("  [실패] git 게시 실패 — 발행되지 않았다")
            raise SystemExit(1)


if __name__ == "__main__":
    main()
