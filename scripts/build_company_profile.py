#!/usr/bin/env python3
"""기업개요 — KR DART 기업개황·직원현황 + US SEC submissions → 종목별 해시 샤드(지연 로드).

화면: company-info.js 의 "기업개요" 카드(종목 분석 뷰). 샤드 번호 계산은 company-info-core.js `shardOf`.

KR (DART_API_KEY 필요)
  - company.json      대표자·주소·전화·홈페이지·설립일·결산월·표준산업분류 코드·법인구분
  - empSttus.json     직원 수(최신 사업보고서, reprt_code 11011). '성별합계'·'합계' 행이 있으면 그 행만 더하고,
                      없으면 모든 행을 더한다(부문×성별 행을 이중으로 세지 않기 위해).
  - 상장일은 싣지 않는다(KIND 조회를 확인하지 못했다 — 추정으로 채우지 않는다).
  - DART 하루 호출 한도(2만)를 다른 KR 워크플로우와 나눠 쓰므로 실행당 --max-calls(기본 2,500) 안에서
    우선순위대로 받는다: ① 아직 없는 회사(시총 순) ② 대표이사·상호·본점 변경 공시가 난 회사(kr_disclosures)
    ③ 직원 수 연도가 최신 사업연도보다 오래된 회사 ④ 기업개황을 90일 넘게 안 받은 회사(오래된 순).
    다음 실행이 이어 받는다(증분). status 020(한도 초과)이면 그때까지 받은 것만 저장하고 멈춘다.
  - 우선주(005935 등)는 corpCode 에 없다 — 보통주 코드(앞 5자리+0)가 있으면 {"alias": 보통주} 로만 적는다.

US (키 불필요, User-Agent 필수·초당 10회 미만)
  - data.sec.gov/submissions/CIK##########.json: 사명·거래소·SIC 업종·결산일·본사 주소·전화·설립 주·
    이전 사명·홈페이지(대부분 비어 있음). 시총 상위 --top-us(기본 1,500) 종목을 매번 전부 다시 받는다(~3분).
  - 직원 수는 싣지 않는다: dei:EntityNumberOfEmployees 를 companyconcept 로 시총 상위 12곳에 조회했더니
    전부 404 였다(2026-09-26). 재무 확장 파일(data/financials)에도 없다.

산출물
  data/company_profile/index.json/.js   window.COMPANY_PROFILE_INDEX — 시장별 건수·출처·기준일·샤드 버전
  data/company_profile/us_NN.json       US 16 샤드 {"v":1,"t":{티커: 레코드}}
  data/company_profile/kr_NN.json       KR 32 샤드
  data/company_profile/state.json       빌더 증분 상태(브라우저는 안 읽는다)
  내용이 그대로인 샤드는 다시 쓰지 않는다(shard_store.write_shards).

실행: python scripts/build_company_profile.py [--market us|kr|all] [--top-us 1500] [--max-calls 2500]
                                             [--only 005930,AAPL] [--push]
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import DART_REGRESSION_FLOOR, latest_fiscal_year, write_data  # noqa: E402
from shard_store import load_shards, write_shards  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_DIR = ROOT / "data" / "company_profile"
OUT_JSON = OUT_DIR / "index.json"
OUT_JS = OUT_DIR / "index.js"
STATE_JSON = OUT_DIR / "state.json"
US_SNAPSHOT = ROOT / "data" / "market_snapshot.json"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
KR_DISCLOSURES = ROOT / "data" / "kr_disclosures.json"

SHARDS = {"us": 16, "kr": 32}
SOURCES = {
    "us": "SEC EDGAR submissions",
    "kr": "DART 기업개황·직원현황(사업보고서)",
}
SEC_UA = {"User-Agent": "Mir-US-Stocks/1.0 (contact@seonu-dragon.xyz)", "Accept-Encoding": "gzip, deflate"}
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
SEC_SLEEP = 0.13
KR_COMPANY_REFRESH_DAYS = 90
# 직원 수 파서 버전. 합계 행 판정을 고치면 올린다 — 상태의 "ev" 가 낮은 회사는 직원 수를 다시 받는다.
# 2: '성별 총계' 표기를 합계로 인식(1 에서는 부문 행과 합계 행을 이중으로 더했다, 삼성전기 24,346 → 12,173).
EMP_PARSER = 2
KR_CHANGE_TITLES = ("대표이사", "상호", "본점", "소재지")
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF", "etf"}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def today_str() -> str:
    return datetime.now(KST).date().isoformat()


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def clean(v) -> str:
    return " ".join(str(v or "").split())


def _int(v):
    s = re.sub(r"[^\d\-]", "", str(v or ""))
    if not s or s == "-":
        return None
    try:
        return int(s)
    except ValueError:
        return None


# ───────────────────────────────────────────────────────── KR 파싱(순수 함수, 테스트 대상)

def normalize_url(u: str) -> str:
    """DART hm_url 은 'www.samsung.com/sec' 처럼 스킴 없이 온다. 도메인 모양이 아니면 버린다."""
    u = clean(u)
    if not u or u in ("-", "없음"):
        return ""
    u = re.sub(r"^https?://", "", u, flags=re.I).strip("/")
    if not re.match(r"^[A-Za-z0-9가-힣][A-Za-z0-9가-힣.\-]*\.[A-Za-z가-힣]{2,}(/\S*)?$", u):
        return ""
    return u


def parse_est_date(s: str) -> str:
    s = re.sub(r"\D", "", str(s or ""))
    if len(s) != 8:
        return ""
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:])).isoformat()
    except ValueError:
        return ""


def parse_kr_company(data: dict) -> dict | None:
    """company.json 응답 → 레코드. status 000 이 아니면 None."""
    if str(data.get("status")) != "000":
        return None
    rec = {
        "name": clean(data.get("corp_name")),
        "nameEn": clean(data.get("corp_name_eng")),
        "ceo": clean(data.get("ceo_nm")),
        "addr": clean(data.get("adres")),
        "phone": clean(data.get("phn_no")),
        "web": normalize_url(data.get("hm_url")),
        "est": parse_est_date(data.get("est_dt")),
        "fye": clean(data.get("acc_mt")).zfill(2) if clean(data.get("acc_mt")).isdigit() else "",
        "ksic": clean(data.get("induty_code")),
        "cls": clean(data.get("corp_cls")),
    }
    return {k: v for k, v in rec.items() if v not in ("", None, "-")}


def _is_total(v: str) -> bool:
    v = clean(v).replace(" ", "")
    # '성별합계'(삼성전자) · '성별 총계'(삼성전기) · '합계' · '전체' — 회사마다 표기가 다르다.
    return v in ("합계", "전체", "계", "총계", "총합계") or v.endswith("합계") or v.endswith("총계")


def parse_kr_employees(rows: list[dict]) -> dict | None:
    """empSttus 행들 → {"emp": 인원, "empAsOf": 결산일}. 행 구조가 회사마다 달라 합계 행을 우선한다.

    - 사업부문(fo_bbm)과 성별(sexdstn) 둘 다 합계인 행이 있으면 그 행 하나.
    - 사업부문이 '합계'인 행들(성별로 나뉨) → 그 행들의 합.
    - 성별이 '합계'인 행들(부문별로 나뉨) → 그 행들의 합.
    - 합계 행이 없으면 모든 행의 합(부문×성별이 겹치지 않는 표).
    인원은 sm(합계), 없으면 정규직+계약직.
    """
    def heads(r):
        v = _int(r.get("sm"))
        if v is None:
            a, b = _int(r.get("rgllbr_co")), _int(r.get("cnttk_co"))
            if a is not None or b is not None:
                v = (a or 0) + (b or 0)
        return v

    rows = [r for r in rows or [] if isinstance(r, dict)]
    if not rows:
        return None
    both = [r for r in rows if _is_total(r.get("fo_bbm")) and _is_total(r.get("sexdstn"))]
    dept_total = [r for r in rows if _is_total(r.get("fo_bbm")) and not _is_total(r.get("sexdstn"))]
    sex_total = [r for r in rows if _is_total(r.get("sexdstn")) and not _is_total(r.get("fo_bbm"))]
    if both:
        pick = both[:1]
    elif dept_total:
        pick = dept_total
    elif sex_total:
        pick = sex_total
    else:
        pick = rows
    vals = [heads(r) for r in pick]
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    total = sum(vals)
    if total <= 0:
        return None
    out = {"emp": total}
    stl = clean(rows[0].get("stlm_dt"))
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", stl):
        out["empAsOf"] = stl
    return out


def preferred_base(code: str) -> str | None:
    """우선주 코드 → 보통주 코드(앞 5자리 + '0'). 이미 보통주 모양이면 None."""
    code = str(code)
    if len(code) != 6 or code.endswith("0"):
        return None
    return code[:5] + "0"


def kr_priority(tickers: list[str], records: dict, state: dict, target_year: int, changed: set[str],
                today: date) -> list[tuple[str, str]]:
    """(ticker, 작업) 목록 — 작업은 'full'(개황+직원), 'emp'(직원만), 'company'(개황만). 앞이 우선."""
    first, change, emp, stale = [], [], [], []
    for t in tickers:
        rec = records.get(t)
        st = state.get(t) or {}
        if not rec or "name" not in rec:
            if st.get("miss") == today.isoformat():
                continue
            first.append((t, "full"))
            continue
        if t in changed:
            change.append((t, "company"))
            continue
        tried = st.get("e")
        if (st.get("ev") or 1) < EMP_PARSER and st.get("e"):
            emp.append((t, "emp"))
            continue
        if (rec.get("empYear") or 0) < target_year and (tried or 0) < target_year:
            emp.append((t, "emp"))
            continue
        c = st.get("c")
        try:
            age = (today - date.fromisoformat(c)).days if c else 9999
        except ValueError:
            age = 9999
        if age >= KR_COMPANY_REFRESH_DAYS:
            stale.append((age, t))
    stale.sort(reverse=True)
    return first + change + emp + [(t, "company") for _, t in stale]


def kr_changed_since(state: dict) -> set[str]:
    """대표이사·상호·본점 변경 공시가 마지막 기업개황 수집일 이후에 난 종목."""
    disc = load_json(KR_DISCLOSURES, {}) or {}
    out = set()
    for d in disc.get("disclosures") or []:
        title = str(d.get("title") or "")
        if not any(k in title for k in KR_CHANGE_TITLES):
            continue
        t = str(d.get("ticker") or "")
        fd = str(d.get("fileDate") or "")
        c = (state.get(t) or {}).get("c") or ""
        if t and fd and fd >= c:
            out.add(t)
    return out


# ───────────────────────────────────────────────────────── US 파싱(순수 함수, 테스트 대상)

def sec_ticker_key(ticker: str) -> str:
    return str(ticker).upper().replace(".", "-")


def parse_us_submission(d: dict) -> dict | None:
    if not isinstance(d, dict) or not d.get("name"):
        return None
    rec: dict = {"name": clean(d.get("name"))}
    try:
        rec["cik"] = int(d.get("cik"))
    except (TypeError, ValueError):
        pass
    ex = list(dict.fromkeys(clean(x) for x in (d.get("exchanges") or []) if clean(x)))
    if ex:
        rec["exch"] = ex
    if clean(d.get("sic")):
        rec["sic"] = clean(d.get("sic"))
    if clean(d.get("sicDescription")):
        rec["sicDesc"] = clean(d.get("sicDescription"))
    fye = clean(d.get("fiscalYearEnd"))
    if re.fullmatch(r"\d{4}", fye) and 1 <= int(fye[:2]) <= 12:
        rec["fye"] = fye
    addr = ((d.get("addresses") or {}).get("business") or {})
    parts = [clean(addr.get("street1")), clean(addr.get("street2")), clean(addr.get("city"))]
    region = clean(addr.get("stateOrCountry")) if not addr.get("isForeignLocation") else ""
    tail = " ".join(x for x in (region, clean(addr.get("zipCode"))) if x)
    line = ", ".join(x for x in parts + [tail] if x)
    country = clean(addr.get("country")) or clean(addr.get("stateOrCountryDescription"))
    if addr.get("isForeignLocation") and country:
        line = f"{line}, {country}" if line else country
    if line:
        rec["addr"] = line
    if addr.get("isForeignLocation") and country:
        rec["country"] = country
    if clean(d.get("phone")):
        rec["phone"] = clean(d.get("phone"))
    inc = clean(d.get("stateOfIncorporationDescription")) or clean(d.get("stateOfIncorporation"))
    if inc:
        rec["inc"] = inc
    web = normalize_url(d.get("website"))
    if web:
        rec["web"] = web
    former = []
    for f in d.get("formerNames") or []:
        nm = clean(f.get("name"))
        if not nm or nm.upper() == rec["name"].upper():
            continue
        former.append([nm, str(f.get("from") or "")[:4], str(f.get("to") or "")[:4]])
    former.sort(key=lambda x: x[2], reverse=True)
    if former:
        rec["former"] = former[:3]
    if clean(d.get("category")):
        rec["cat"] = clean(d.get("category"))
    return rec


# ───────────────────────────────────────────────────────── 네트워크

def sec_get(url: str, retries: int = 3):
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=SEC_UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
            time.sleep(SEC_SLEEP)
            return json.loads(raw)
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) == 404:
                return None
            time.sleep(1.5 * attempt)
    raise last


def universe(path: Path, top: int | None) -> list[str]:
    snap = load_json(path, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in ETF_SECTORS]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    if top:
        stocks = stocks[:top]
    return [str(s["ticker"]) for s in stocks]


def run_us(records: dict, top: int, only: set[str]) -> tuple[int, int]:
    tickers = [t.upper() for t in universe(US_SNAPSHOT, top)]
    if only:
        tickers = [t for t in tickers if t in only] or sorted(only)
    try:
        cmap_raw = sec_get(SEC_TICKERS_URL) or {}
    except Exception as exc:
        print(f"[US] company_tickers.json 실패: {exc}")
        return 0, len(tickers)
    cmap = {str(v.get("ticker")).upper(): int(v.get("cik_str")) for v in cmap_raw.values() if v.get("ticker")}
    ok = fail = 0
    stamp = today_str()
    for i, t in enumerate(tickers, 1):
        cik = cmap.get(sec_ticker_key(t))
        if not cik:
            continue
        try:
            d = sec_get(SEC_SUBMISSIONS_URL.format(cik=cik))
        except Exception as exc:
            fail += 1
            if fail <= 5:
                print(f"  [US] {t} 실패: {exc}")
            continue
        rec = parse_us_submission(d) if d else None
        if not rec:
            continue
        old = records.get(t) or {}
        # 내용이 같으면 기준일(asOf)도 그대로 둬서 샤드가 바뀌지 않게 한다.
        rec["asOf"] = old.get("asOf") if {k: v for k, v in old.items() if k != "asOf"} == rec else stamp
        records[t] = rec
        ok += 1
        if i % 300 == 0:
            print(f"  [US] {i}/{len(tickers)} (성공 {ok})")
    print(f"[US] 대상 {len(tickers)} · 성공 {ok} · 실패 {fail}")
    return ok, fail


def run_kr(records: dict, state: dict, max_calls: int, only: set[str], api_key: str) -> tuple[int, int]:
    from build_kr_disclosures import dart_get, load_corp_map

    corp_map = load_corp_map(api_key)
    if not corp_map:
        print("[KR] corpCode.xml 실패 — 중단")
        return 0, 1
    tickers_all = universe(KR_SNAPSHOT, None)
    if only:
        tickers_all = [t for t in tickers_all if t in only] or sorted(only)
    commons, aliases = [], {}
    for t in tickers_all:
        if t in corp_map:
            commons.append(t)
        else:
            base = preferred_base(t)
            if base and base in corp_map:
                aliases[t] = base
    if not only:
        # 상장폐지·유니버스 이탈 종목은 뺀다(스냅샷 전체가 기준이라 시총 순위 변동과 무관).
        live = set(commons) | set(aliases)
        for t in [k for k in records if k not in live]:
            records.pop(t, None)
    for t, base in aliases.items():
        records[t] = {"alias": base}
    today = datetime.now(KST).date()
    target_year = latest_fiscal_year()
    changed = kr_changed_since(state)
    plan = kr_priority(commons, records, state, target_year, changed, today)
    print(f"[KR] 보통주 {len(commons)} · 우선주 별칭 {len(aliases)} · 작업 대기 {len(plan)} · "
          f"사업연도 {target_year} · 변경 공시 {len(changed)} · 호출 상한 {max_calls}")

    calls = ok = fail = 0
    stamp = today.isoformat()
    try:
        for t, job in plan:
            need = 2 if job == "full" else 1
            if calls + need > max_calls:
                break
            corp = corp_map[t]
            rec = dict(records.get(t) or {})
            st = dict(state.get(t) or {})
            try:
                if job in ("full", "company"):
                    calls += 1
                    base = parse_kr_company(dart_get("company.json", {"corp_code": corp}, api_key))
                    if base is None:
                        st["miss"] = stamp
                        state[t] = st
                        fail += 1
                        continue
                    keep = {k: rec[k] for k in ("emp", "empYear", "empAsOf") if k in rec}
                    new = {**base, **keep}
                    st["c"] = stamp
                    rec = new
                if job in ("full", "emp"):
                    got = None
                    reparse = (st.get("ev") or 1) < EMP_PARSER and bool(st.get("e"))
                    for yr in (target_year, target_year - 1):
                        if yr <= (rec.get("empYear") or 0) and not reparse:
                            break
                        if calls >= max_calls:
                            break
                        calls += 1
                        data = dart_get("empSttus.json", {"corp_code": corp, "bsns_year": str(yr),
                                                          "reprt_code": "11011"}, api_key)
                        if str(data.get("status")) == "000":
                            got = parse_kr_employees(data.get("list") or [])
                            if got:
                                got["empYear"] = yr
                                break
                        if job == "emp":
                            break          # 해마다 한 번 시도하면 충분 — 전년도는 이미 있거나 없다
                    st["e"] = target_year
                    st["ev"] = EMP_PARSER
                    if got:
                        rec.update(got)
                    elif reparse:
                        for k in ("emp", "empYear", "empAsOf"):
                            rec.pop(k, None)
            except SystemExit:
                raise
            except Exception as exc:
                fail += 1
                if fail <= 5:
                    print(f"  [KR] {t} 실패: {exc}")
                continue
            old = records.get(t) or {}
            rec.pop("asOf", None)
            rec["asOf"] = old.get("asOf") if {k: v for k, v in old.items() if k != "asOf"} == rec else stamp
            records[t] = rec
            state[t] = st
            ok += 1
            if ok % 300 == 0:
                print(f"  [KR] {ok}건 · 호출 {calls}")
    except SystemExit as exc:          # DART 020(한도 초과) — 받은 만큼만 저장
        print(f"[KR] {exc}")
    print(f"[KR] 갱신 {ok} · 실패 {fail} · 호출 {calls}")
    return ok, fail


def main() -> int:
    ap = argparse.ArgumentParser(description="기업개요(KR DART · US SEC) 수집")
    ap.add_argument("--market", choices=["us", "kr", "all"], default="all")
    ap.add_argument("--top-us", type=int, default=1500)
    ap.add_argument("--max-calls", type=int, default=int(os.environ.get("KR_MAX_CALLS") or 2500))
    ap.add_argument("--only", default="", help="쉼표로 구분한 티커(테스트용)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    only = {x.strip().upper() for x in args.only.split(",") if x.strip()}

    index = load_json(OUT_JSON, {}) or {}
    markets_meta = dict(index.get("markets") or {})
    state_all = load_json(STATE_JSON, {}) or {}
    written: list[Path] = []
    status = 0
    for m in (["us", "kr"] if args.market == "all" else [args.market]):
        prefix = f"{m}_"
        records = load_shards(OUT_DIR, prefix, SHARDS[m])
        before = len(records)
        if m == "us":
            ok, fail = run_us(records, args.top_us, only)
        else:
            api_key = os.environ.get("DART_API_KEY", "").strip()
            if not api_key:
                print("[KR] DART_API_KEY 없음 — 건너뜀")
                continue
            state = state_all.setdefault("kr", {})
            ok, fail = run_kr(records, state, args.max_calls, only, api_key)
        if ok == 0 and fail > 0:
            print(f"[{m.upper()}] 성공 0 · 실패 {fail} — 기존 샤드 유지, 실패 처리")
            status = 1
            continue
        if before and len(records) < before * DART_REGRESSION_FLOOR:
            print(f"[{m.upper()}] 레코드 {before} → {len(records)} 급감 — 쓰지 않는다")
            status = 1
            continue
        w, ver = write_shards(OUT_DIR, prefix, SHARDS[m], records)
        written += w
        dates = sorted(v.get("asOf") for v in records.values() if v.get("asOf"))
        full = sum(1 for v in records.values() if "alias" not in v)
        meta = {"count": full, "aliases": len(records) - full, "shards": SHARDS[m], "source": SOURCES[m],
                "updatedAtKst": now_kst(), "asOfMax": dates[-1] if dates else None, "ver": ver}
        if m == "kr":
            meta["withEmployees"] = sum(1 for v in records.values() if v.get("emp"))
        markets_meta[m] = meta
        print(f"[{m.upper()}] 레코드 {len(records)} · 바뀐 샤드 {len(w)}")

    if not markets_meta:
        print("쓸 내용 없음")
        return status or 1
    payload = {
        "schema": 1,
        "updatedAtKst": now_kst(),
        "count": sum(int(v.get("count") or 0) for v in markets_meta.values()),
        "markets": markets_meta,
    }
    write_data(OUT_JSON, OUT_JS, "COMPANY_PROFILE_INDEX", payload, indent=None, min_ratio=DART_REGRESSION_FLOOR)
    atomic_write_text(STATE_JSON, json.dumps(state_all, ensure_ascii=False, separators=(",", ":")) + "\n")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(["data/company_profile"], "company profile"):
                return 1
    return status


if __name__ == "__main__":
    raise SystemExit(main())
