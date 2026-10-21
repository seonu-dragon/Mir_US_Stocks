#!/usr/bin/env python3
"""KR 배당·증자 정식 소스 — 한국예탁결제원 기업정보서비스_GW(공공데이터포털 OpenAPI).

DART 공시 원문(document.xml) 앵커링 파싱(build_kr_disclosures 배당 / kr_event_details
증자·CB)은 서식이 바뀌면 조용히 깨진다. 예탁결제원(KSD)은 같은 사실을 **구조화 필드**로
준다 — 이 빌더가 그 정식 소스다.

  https://apis.data.go.kr/B552481/CorpSvc   (기업정보서비스_GW, data.go.kr 활용신청 승인분)
  - getIssucoCustnoByShortIsin : 단축코드(6자리) → 발행회사번호(issucoCustno)
  - getIssucoRgtSchedule       : 권리일정(기준일 + 유형: 배당/분배·유상증자·감자·소각 등)
  - getDivInfo                 : 배당 상세(ISIN·주당 현금배당금·지급개시일, 기준일별)
  - getIssucoStkQtyChgList     : 주식수 변동(유상증자·CB행사·합병 등 실제 발행 내역)
  - 세이브로 직결 경로(api.seibro.or.kr)와 StockSvc_GW 는 이 키로 미승인
    (SERVICE_KEY_IS_NOT_REGISTERED) — 반드시 B552481/CorpSvc 만 쓴다.
  - 위 오퍼레이션들은 페이징이 없고 **최근 5건 고정**이다(numOfRows 를 주면
    INVALID_REQUEST_PARAMETER_ERROR). 분기배당 4건+소각 1건이 상한이라 6개월
    창은 안전하지만, 창을 1년 이상으로 늘리면 잘린다 — 늘리지 말 것.
  - 인증키는 환경변수 DATA_GO_KR_KEY(URL 디코딩형) — 파일에 넣지 않는다.

전 오퍼레이션이 회사 단위(issucoCustno)라 전 상장사 순회는 호출이 과하다.
유니버스는 KR 스냅샷 시가총액 상위 UNIVERSE 종목으로 한정하고, 티커→issucoCustno
매핑은 산출물 JSON 의 custnoMap 에 캐시해 다음 실행이 재사용한다(.json 이 증분 상태).

티커 부착(데이터 정직성 — 정확 일치만):
  - 보통주: ISIN 4~9자리(단축코드)가 유니버스 티커와 일치할 때만.
  - 우선주: 단축코드가 ISIN 에서 파생되지 않으므로(삼성전자우 005935 ↔ KR7005931001)
    종목명 정규화 정확 일치만 허용. KSD 표기 "삼성전자1우" 는 상장명 "삼성전자우"와
    달라 '1우'→'우' 변형 1가지만 추가로 시도하고, 그래도 없으면 버린다.

산출물: data/korea/ksd_actions.json + .js(window.KR_KSD_ACTIONS).
하루 쿼터에 걸리면 받은 데까지 발행하고(custnoMap·refreshedAt 저장, 못 받은 종목은 직전 행 이월 —
build() 주석), 다음 실행이 안 받은 종목부터 이어 간다. 이번에 새로 받은 종목이 0 이거나 행이 MIN_ROWS
미만이면 기존 파일 유지 + exit 1.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from briefing_store import repository_publish_lock  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "ksd_actions.json"
OUT_JS = ROOT / "data" / "korea" / "ksd_actions.js"

BASE = "https://apis.data.go.kr/B552481/CorpSvc"
UNIVERSE = 300          # 시가총액 상위 N 종목만 순회(호출량 통제)
LOOKBACK_DAYS = 183     # 최근 6개월
MIN_ROWS = 20           # 미만이면 기존 파일 유지 + 실패
MAX_TICKER_ERRORS = 30  # 종목 단위 실패가 이보다 많으면 전체 실패 처리
# 이 서비스의 일일 트래픽은 ~1,000콜로 실측됐다(2026-08-06~08 실런들이 누적
# ~1,000콜 부근에서 HTTP 429 LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR).
# 쿼터 리셋은 자정 KST 가 아니라 00:00 UTC(=09:00 KST)로 관측됐다 — 01:55 KST 에도
# 차단이 유지됐고, 09:00 KST 이후 실런은 통과했다. 종목당 호출은 일정 3~4콜
# (신규 티커는 +1 custno 조회)이라, custnoMap 캐시가 채워진 정상 상태의 300종목
# 실행은 ~840콜로 쿼터 안이다. 유니버스를 늘리려면 활용신청 트래픽 증량 먼저.
SLEEP = 0.2
BACKOFF_429 = (10, 30, 60)
MAX_CONSEC_429 = 5  # 백오프를 다 쓰고도 429 인 종목이 연속 N 개면 쿼터 소진 — 즉시 중단
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}

# 권리일정 유형 분류(rgtRacdNm 원문 기준) — 배당은 상세조회, 증자·감자·소각은 issues 로.
DIV_RE = re.compile(r"배당|분배")
ISSUE_RE = re.compile(r"증자|감자|소각")


def kst_now():
    return datetime.now(timezone(timedelta(hours=9)))


def iso(yyyymmdd: str | None) -> str | None:
    s = (yyyymmdd or "").strip()
    if not re.fullmatch(r"\d{8}", s):
        return None
    return f"{s[:4]}-{s[4:6]}-{s[6:]}"


def norm_name(s: str) -> str:
    return re.sub(r"\s+", "", s or "").upper()


class ApiError(RuntimeError):
    pass


def call(op: str, key: str, **params) -> list[dict]:
    """CorpSvc 오퍼레이션 호출 → item dict 목록. NODATA 는 빈 목록."""
    qs = urllib.parse.urlencode({"serviceKey": key, **params})
    url = f"{BASE}/{op}?{qs}"
    last: Exception | None = None
    for attempt in range(1 + len(BACKOFF_429)):
        try:
            req = urllib.request.Request(url, headers=UA)
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    raw = r.read().decode("utf-8")
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < len(BACKOFF_429):
                    time.sleep(BACKOFF_429[attempt])
                    last = e
                    continue
                raise
            root = ET.fromstring(raw)
            code = (root.findtext("./header/resultCode") or "").strip()
            if code in ("3", "03"):  # NODATA_ERROR
                return []
            if code != "00":
                msg = (root.findtext("./header/resultMsg") or "").strip()
                # data.go.kr 게이트웨이 에러 봉투(cmmMsgHeader)는 resultCode 자체가 없다.
                if not code:
                    msg = raw[:200]
                raise ApiError(f"{op} resultCode={code!r} {msg}")
            items = []
            for it in root.findall("./body/items/item"):
                items.append({c.tag: (c.text or "").strip() for c in it})
            one = root.find("./body/item")  # 단건 응답형(getIssucoBasicInfo 등)
            if one is not None:
                items.append({c.tag: (c.text or "").strip() for c in one})
            return items
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.0 * (attempt + 1))
    raise ApiError(f"{op} 3회 실패: {last}")


def load_universe(limit: int) -> tuple[list[dict], dict[str, str]]:
    """시총 상위 종목 목록과, 정규화 종목명→티커(모호명 제외) 매핑."""
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [s for s in snap.get("stocks", [])
              if re.fullmatch(r"\d{6}", str(s.get("ticker") or ""))]
    by_name: dict[str, str] = {}
    ambiguous: set[str] = set()
    for s in stocks:
        k = norm_name(s.get("company") or "")
        if not k:
            continue
        if k in by_name and by_name[k] != s["ticker"]:
            ambiguous.add(k)
            continue
        by_name[k] = s["ticker"]
    for k in ambiguous:
        by_name.pop(k, None)

    def cap(s):
        v = s.get("marketCapT")
        return float(v) if isinstance(v, (int, float)) else 0.0

    stocks.sort(key=cap, reverse=True)
    return stocks[:limit], by_name


def resolve_div_ticker(item: dict, ticker: str, by_name: dict[str, str]) -> str | None:
    """배당 상세 행에 붙일 티커. 보통주는 ISIN 파생 단축코드, 우선주는 이름 정확일치만."""
    isin = item.get("isin") or ""
    if len(isin) == 12 and isin[3:9] == ticker:
        return ticker
    name = norm_name(item.get("korSecnNm") or "")
    if name in by_name:
        return by_name[name]
    variant = re.sub(r"1우(B?)$", r"우\1", name)  # KSD '삼성전자1우' ↔ 상장명 '삼성전자우'
    if variant != name and variant in by_name:
        return by_name[variant]
    return None


def _load_prev() -> dict:
    if not OUT_JSON.exists():
        return {}
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8")) or {}
    except Exception:  # noqa: BLE001
        return {}


def refresh_order(universe: list[dict], refreshed_at: dict[str, str]) -> list[dict]:
    """이번 실행에서 볼 순서 — 한 번도 안 받은 종목, 그다음 오래전에 받은 종목부터(같으면 시총 순 유지).

    쿼터가 실행 도중 끝나도 다음 실행이 이어서 받아, 몇 번이면 유니버스 전체가 돈다."""
    return sorted(universe, key=lambda s: refreshed_at.get(s["ticker"], ""))


def carry_rows(rows, refreshed: set, keep: set, cutoff_iso: str, date_key: str) -> list[dict]:
    """이번에 다시 받지 못한 종목(src)의 직전 행을 그대로 이월한다(창 밖 날짜·유니버스 밖 종목은 버린다)."""
    out = []
    for row in rows or []:
        src = row.get("src") or row.get("ticker")
        if src in refreshed or src not in keep:
            continue
        if (row.get(date_key) or "") < cutoff_iso:
            continue
        out.append(row)
    return out


def build(key: str, limit: int, *, call_fn=None, prev: dict | None = None, sleep=time.sleep) -> dict:
    """유니버스를 '오래 안 받은 순'으로 돌며 KSD 를 조회한다.

    2026-10-14~21 매 실행 실패(continue-on-error 라 초록): custnoMap 캐시가 담긴 산출물이 **한 번도** 써지지
    않아(첫 성공 전) 매일 300종목 전부 getIssucoCustnoByShortIsin 부터 불렀고, 그 조회가 하루 약 100회째에서
    429(LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR)로 막혀 "연속 429 5종목" 으로 전체를 버렸다 —
    캐시가 계속 비어 있으니 다음 날도 같은 자리에서 또 죽었다(10-16·19·20·21 로그 모두 100번째 종목 부근). 이제
      - 발행회사번호 조회가 쿼터에 걸리면 조회만 멈추고, 이미 아는 종목은 계속 받는다.
      - 어느 오퍼레이션이든 쿼터가 끝나면 그 자리에서 멈추고 받은 데까지 발행한다(custnoMap 포함 — 다음 실행이 이어 감).
      - 다시 받지 못한 종목의 직전 행은 refreshedAt(종목별 마지막 수집일)과 함께 이월한다. 지어낸 행은 없다.
    """
    call_fn = call_fn or call
    prev = _load_prev() if prev is None else prev
    universe, by_name = load_universe(limit)
    print(f"유니버스 {len(universe)}종목(시총 상위) / 이름매핑 {len(by_name)}개")

    custno_map = {k: str(v) for k, v in (prev.get("custnoMap") or {}).items()}
    refreshed_at = {k: str(v) for k, v in (prev.get("refreshedAt") or {}).items()}
    today = kst_now().strftime("%Y-%m-%d")
    cutoff = (kst_now() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y%m%d")
    dividends: list[dict] = []
    issues: list[dict] = []
    seen_div: set[tuple] = set()
    refreshed: set[str] = set()
    errors = 0
    consec_429 = 0
    calls = 0
    lookup_blocked = False
    stopped = None

    def api(op: str, **params):
        nonlocal calls
        calls += 1
        try:
            return call_fn(op, key, **params)
        finally:
            sleep(SLEEP)

    for i, s in enumerate(refresh_order(universe, refreshed_at), 1):
        ticker, company = s["ticker"], s.get("company") or ""
        custno = custno_map.get(ticker)
        if not custno and lookup_blocked:
            continue  # 발행회사번호 조회 쿼터 소진 — 다음 실행에서 받는다
        t_div: list[dict] = []
        t_iss: list[dict] = []
        try:
            if not custno:
                try:
                    found = api("getIssucoCustnoByShortIsin", shortIsin=ticker)
                except ApiError as e:
                    if "429" not in str(e):
                        raise
                    lookup_blocked = True
                    print(f"  [{ticker}] 발행회사번호 조회 쿼터 소진(429) — 이번 실행은 이미 아는 종목만 받는다")
                    continue
                custno = (found[0].get("issucoCustno") or "") if found else ""
                if not custno:
                    refreshed.add(ticker)  # KSD 미등록(신규상장 직후 등) — 오늘 확인했다
                    refreshed_at[ticker] = today
                    continue
                custno_map[ticker] = custno

            sched = api("getIssucoRgtSchedule", issucoCustno=custno)
            div_dates: list[str] = []
            for ev in sched:
                std = ev.get("rgtStdDt") or ""
                kind = ev.get("rgtRacdNm") or ""
                if len(std) != 8 or std < cutoff:
                    continue
                if DIV_RE.search(kind):
                    div_dates.append(std)
                elif ISSUE_RE.search(kind):
                    t_iss.append({
                        "ticker": ticker, "company": company, "kind": kind,
                        "stage": "record", "date": iso(std), "recordDate": iso(std), "src": ticker,
                    })

            for std in sorted(set(div_dates), reverse=True):
                for item in api("getDivInfo", issucoCustno=custno, rgtStdDt=std):
                    t = resolve_div_ticker(item, ticker, by_name)
                    if not t:
                        continue  # 정확 일치 실패(구형 우선주 등) — 버린다
                    dk = (item.get("isin"), std)
                    if dk in seen_div:
                        continue
                    seen_div.add(dk)
                    try:
                        amt = float(item.get("cashAlocAmt") or 0)
                    except ValueError:
                        amt = 0.0
                    t_div.append({
                        "ticker": t,
                        "company": company if t == ticker else (item.get("korSecnNm") or company),
                        "secKind": item.get("secnKacdNm") or None,
                        "isin": item.get("isin") or None,
                        "recordDate": iso(std),
                        # 0원은 '미확정'(기준일만 예고) — 확정액과 구분해 null 로 둔다.
                        "cashAmt": amt if amt > 0 else None,
                        "payDate": iso(item.get("th1PayTermBeginDt")),
                        "src": ticker,
                    })

            for chg in api("getIssucoStkQtyChgList", issucoCustno=custno):
                d = chg.get("issuDt") or ""
                if len(d) != 8 or d < cutoff:
                    continue
                qty = chg.get("issuQty")
                t_iss.append({
                    "ticker": ticker, "company": company,
                    "kind": chg.get("secnIssuRacdNm") or "발행",
                    "stage": "issued", "date": iso(d), "issueDate": iso(d),
                    "listDate": iso(chg.get("listDt")),
                    "qty": int(float(qty)) if qty else None,
                    "src": ticker,
                })
        except ApiError as e:
            errors += 1
            print(f"  [{ticker}] {e}")
            consec_429 = consec_429 + 1 if "429" in str(e) else 0
            if consec_429 >= MAX_CONSEC_429:
                stopped = f"연속 429 {consec_429}종목 — 일일 쿼터 소진, 받은 데까지 발행"
                print(f"  {stopped}")
                break
            if errors > MAX_TICKER_ERRORS:
                stopped = f"종목 단위 실패 {errors}건 초과 — 중단, 받은 데까지 발행"
                print(f"  {stopped}")
                break
            continue
        consec_429 = 0
        # 한 종목의 조회가 전부 성공했을 때만 그 종목 행을 바꾼다(반쪽 행 금지 — 실패면 직전 행 이월).
        dividends.extend(t_div)
        issues.extend(t_iss)
        refreshed.add(ticker)
        refreshed_at[ticker] = today
        if i % 100 == 0:
            print(f"  {i}/{len(universe)} … 배당 {len(dividends)} / 증자·감자 {len(issues)}"
                  f" (호출 {calls}, 오류 {errors})")

    keep = {s["ticker"] for s in universe}
    cutoff_iso = iso(cutoff) or ""
    carried_div = carry_rows(prev.get("dividends"), refreshed, keep, cutoff_iso, "recordDate")
    carried_iss = carry_rows(prev.get("issues"), refreshed, keep, cutoff_iso, "date")
    dividends += carried_div
    issues += carried_iss
    dividends.sort(key=lambda r: (r["recordDate"] or "", r["ticker"]), reverse=True)
    issues.sort(key=lambda r: (r["date"] or "", r["ticker"]), reverse=True)
    covered = sum(1 for s in universe if s["ticker"] in refreshed_at)
    blocked_note = " · 발행회사번호 조회 쿼터 소진" if lookup_blocked else ""
    print(f"수집 완료: 이번에 받은 종목 {len(refreshed)}/{len(universe)} (누적 {covered}) · 이월 행 배당 {len(carried_div)}"
          f" / 증자 {len(carried_iss)} · 배당 {len(dividends)}행 / 증자·감자·소각 {len(issues)}행"
          f" (호출 {calls}, 오류 {errors}){blocked_note}")

    return {
        "updatedAtKst": kst_now().strftime("%Y-%m-%d %H:%M KST"),
        "asOf": kst_now().strftime("%Y-%m-%d"),
        "source": "한국예탁결제원 기업정보서비스(공공데이터포털 OpenAPI) · "
                  f"시총 상위 {len(universe)}종목 · 최근 {LOOKBACK_DAYS}일 "
                  "권리일정·배당내역·주식수변동",
        # 하루 쿼터 때문에 한 실행이 유니버스를 다 못 돌 수 있다 — 종목별 마지막 수집일(refreshedAt)과 함께 밝힌다.
        "coverage": {"universe": len(universe), "covered": covered, "refreshedThisRun": len(refreshed),
                     "lookupBlocked": lookup_blocked, "stopped": stopped},
        "dividends": dividends,
        "issues": issues,
        "custnoMap": custno_map,
        "refreshedAt": {t: d for t, d in refreshed_at.items() if t in keep},
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass
    parser = argparse.ArgumentParser(description="KR 배당·증자 (한국예탁결제원 기업정보서비스)")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--limit", type=int, default=UNIVERSE, help="유니버스 크기(테스트용)")
    args = parser.parse_args()

    print("=== KR KSD 배당·증자 수집 (기업정보서비스_GW) ===")
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if not key:
        print("[ksd] DATA_GO_KR_KEY 미설정 — 기존 파일 유지")
        return 1
    try:
        payload = build(key, args.limit)
    except Exception as e:  # noqa: BLE001
        print(f"[ksd] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1

    if not payload["coverage"]["refreshedThisRun"]:
        print(f"[ksd] 이번 실행에서 새로 받은 종목 0 ({payload['coverage']['stopped'] or '쿼터 소진'}) — 기존 파일 유지")
        return 1
    rows = len(payload["dividends"]) + len(payload["issues"])
    if rows < MIN_ROWS:
        print(f"[ksd] 행 {rows}건 < {MIN_ROWS} — 기존 파일 유지")
        return 1

    import sec_client as sec

    # 0건·반쪽 회귀 방어는 write_data 가 중앙에서 맡는다(빌더 계약).
    sec.write_data(OUT_JSON, OUT_JS, "KR_KSD_ACTIONS", payload, indent=None)
    print(f"배당 {len(payload['dividends'])}행 + 증자·감자 {len(payload['issues'])}행 "
          f"→ {OUT_JSON.name}")

    if args.push:
        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/ksd_actions.json", "data/korea/ksd_actions.js"],
                "KR KSD corp actions",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
