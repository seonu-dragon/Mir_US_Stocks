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
행이 MIN_ROWS 미만이거나 수집 오류가 과하면 기존 파일 유지 + exit 1.
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
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

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


def build(key: str, limit: int) -> dict:
    universe, by_name = load_universe(limit)
    print(f"유니버스 {len(universe)}종목(시총 상위) / 이름매핑 {len(by_name)}개")

    prev_map: dict[str, str] = {}
    if OUT_JSON.exists():
        try:
            prev_map = {k: str(v) for k, v in
                        (json.loads(OUT_JSON.read_text(encoding="utf-8"))
                         .get("custnoMap") or {}).items()}
        except Exception:  # noqa: BLE001
            prev_map = {}

    cutoff = (kst_now() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y%m%d")
    custno_map: dict[str, str] = {}
    dividends: list[dict] = []
    issues: list[dict] = []
    seen_div: set[tuple] = set()
    errors = 0
    consec_429 = 0
    calls = 0

    for i, s in enumerate(universe, 1):
        ticker, company = s["ticker"], s.get("company") or ""
        try:
            custno = prev_map.get(ticker)
            if not custno:
                found = call("getIssucoCustnoByShortIsin", key, shortIsin=ticker)
                calls += 1
                time.sleep(SLEEP)
                if not found:
                    continue  # KSD 미등록(신규상장 직후 등) — 다음 실행에 재시도
                custno = found[0].get("issucoCustno") or ""
                if not custno:
                    continue
            custno_map[ticker] = custno

            sched = call("getIssucoRgtSchedule", key, issucoCustno=custno)
            calls += 1
            time.sleep(SLEEP)
            div_dates: list[str] = []
            for ev in sched:
                std = ev.get("rgtStdDt") or ""
                kind = ev.get("rgtRacdNm") or ""
                if len(std) != 8 or std < cutoff:
                    continue
                if DIV_RE.search(kind):
                    div_dates.append(std)
                elif ISSUE_RE.search(kind):
                    issues.append({
                        "ticker": ticker, "company": company, "kind": kind,
                        "stage": "record", "date": iso(std), "recordDate": iso(std),
                    })

            for std in sorted(set(div_dates), reverse=True):
                div_items = call("getDivInfo", key, issucoCustno=custno, rgtStdDt=std)
                calls += 1
                for item in div_items:
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
                    dividends.append({
                        "ticker": t,
                        "company": company if t == ticker else (item.get("korSecnNm") or company),
                        "secKind": item.get("secnKacdNm") or None,
                        "isin": item.get("isin") or None,
                        "recordDate": iso(std),
                        # 0원은 '미확정'(기준일만 예고) — 확정액과 구분해 null 로 둔다.
                        "cashAmt": amt if amt > 0 else None,
                        "payDate": iso(item.get("th1PayTermBeginDt")),
                    })
                time.sleep(SLEEP)

            chg_items = call("getIssucoStkQtyChgList", key, issucoCustno=custno)
            calls += 1
            for chg in chg_items:
                d = chg.get("issuDt") or ""
                if len(d) != 8 or d < cutoff:
                    continue
                qty = chg.get("issuQty")
                issues.append({
                    "ticker": ticker, "company": company,
                    "kind": chg.get("secnIssuRacdNm") or "발행",
                    "stage": "issued", "date": iso(d), "issueDate": iso(d),
                    "listDate": iso(chg.get("listDt")),
                    "qty": int(float(qty)) if qty else None,
                })
            time.sleep(SLEEP)
        except ApiError as e:
            errors += 1
            print(f"  [{ticker}] {e}")
            consec_429 = consec_429 + 1 if "429" in str(e) else 0
            if consec_429 >= MAX_CONSEC_429:
                raise ApiError(f"연속 429 {consec_429}종목 — 일일 쿼터 소진으로 중단") from e
            if errors > MAX_TICKER_ERRORS:
                raise ApiError(f"종목 단위 실패 {errors}건 초과 — 중단") from e
        else:
            consec_429 = 0
        if i % 100 == 0:
            print(f"  {i}/{len(universe)} … 배당 {len(dividends)} / 증자·감자 {len(issues)}"
                  f" (호출 {calls}, 오류 {errors})")

    dividends.sort(key=lambda r: (r["recordDate"] or "", r["ticker"]), reverse=True)
    issues.sort(key=lambda r: (r["date"] or "", r["ticker"]), reverse=True)
    print(f"수집 완료: 배당 {len(dividends)}행 / 증자·감자·소각 {len(issues)}행 "
          f"(호출 {calls}, 오류 {errors})")

    return {
        "updatedAtKst": kst_now().strftime("%Y-%m-%d %H:%M KST"),
        "asOf": kst_now().strftime("%Y-%m-%d"),
        "source": "한국예탁결제원 기업정보서비스(공공데이터포털 OpenAPI) · "
                  f"시총 상위 {len(universe)}종목 · 최근 {LOOKBACK_DAYS}일 "
                  "권리일정·배당내역·주식수변동",
        "dividends": dividends,
        "issues": issues,
        "custnoMap": custno_map,
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

    rows = len(payload["dividends"]) + len(payload["issues"])
    if rows < MIN_ROWS:
        print(f"[ksd] 행 {rows}건 < {MIN_ROWS} — 기존 파일 유지")
        return 1

    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_KSD_ACTIONS = {compact};\n")
    print(f"배당 {len(payload['dividends'])}행 + 증자·감자 {len(payload['issues'])}행 "
          f"→ {OUT_JSON.name}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/ksd_actions.json", "data/korea/ksd_actions.js"],
                "KR KSD corp actions",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
