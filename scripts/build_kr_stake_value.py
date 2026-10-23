#!/usr/bin/env python3
"""지주사·그룹사 상장 지분 시가 — 정기보고서 '타법인 출자현황'의 상장 피출자사 지분 × 지금 주가.

화면: 종목 분석 › 수급·보유 '상장 지분 시가' 카드(kr-panels.js krStakeValueCard). 사실 계산만 싣는다:
"상장 지분 시가 합 X조 · 모회사 시총 Y조 · 비율 Z%". 적정가·'저평가'·'할인' 같은 해석 문구는 쓰지 않는다.

## 원천(2026-10-23 확인)

OpenDART 정기보고서 주요정보(DS002) `otrCprInvstmntSttus.json` — corp_code · bsns_year · reprt_code(11011 사업 ·
11012 반기 · 11013 1분기 · 11014 3분기). SK(034730) 2025 사업보고서 108행 · LG(003550) 37행. 행 필드:
  inv_prm 피출자법인명(제출인이 적은 이름 — 'SK이노베이션㈜ ', '엘지전자(주)') · invstmnt_purps 출자목적 ·
  trmend_blce_qy 기말 주식 수 · trmend_blce_qota_rt 기말 지분율(%) · trmend_blce_acntbk_amount 기말 장부가액(원) ·
  stlm_dt 결산기준일 · rcept_no.
'합계' 행은 inv_prm 이 '합계'라 뺀다. 기말 지분율이 0 이거나 주식 수가 없으면(처분 완료) 뺀다.

## 상장 피출자사 매칭 · 시가

이름 → 종목코드는 kr_holder_names.match_listed(정확 일치만, 영문 약칭 한글 읽기·작은 별칭표). 우선주 표기는 매칭하지
않는다. 시가 = 기말 주식 수 × 커밋된 KR 스냅샷 종가(실시간 조회 없음). 자기검증: 주식 수 ÷ 스냅샷 상장주식수로 낸
지분율이 보고서 지분율의 0.5~2배 안에 들어야 싣는다 — 벗어나면 동명이 다른 회사이거나 단위가 다른 행으로 보고
뺀다(unverified 로 센다). 범위를 넓게 둔 건 기준일 뒤 증자·감자로 분모가 바뀐 정상 행(한화 → 한화솔루션: 보고 36.15% ·
지금 상장주식수 기준 28.0%)을 버리지 않기 위해서다 — 잘못 맞힌 회사는 보통 몇 배~수십 배 어긋난다. 보고서 기준일 이후의 지분 변동은 반영되지 않으므로 화면은 기준일과 원문 링크를 같이 보인다.
비상장 피출자사는 장부가라 시가와 섞지 않고 '비상장 장부가 합'으로 따로 둔다.

모회사 시총 = 보통주 시총 + 스냅샷에 있는 같은 회사 우선주 시총(있으면 prefIncluded=true).

## 대상 · 호출 예산(DART 하루 2만 회를 다른 빌더와 나눠 쓴다)

  - 상장 피출자사가 있을 만한 회사만: (가) 대량보유 상태(build_kr_major_holders.py)에서 보고자 이름이 상장사이고
    다른 상장사를 5%+ 보유한 회사, (나) 이름에 '홀딩스'·'지주'·'Holdings' 가 들어간 회사, (다) 시총 상위 --top(기본 200).
  - 회사마다 최신 정기보고서(제출 기한이 지난 가장 최근 분기)를 한 번만 받는다 — state 의 rp 가 같으면 건너뛴다.
    최신 후보가 013 이면 다음 후보로(최대 3회). 첫 채움 ≈ 대상 × 1~3회, 이후 분기마다 ≈ 대상 × 1회. 실행당 --max-calls.
  - 상장 피출자사가 하나도 안 맞는 회사는 산출물에 싣지 않는다(상태에는 남겨 다음 분기까지 다시 안 부른다).

산출물
  data/korea/stake_value.{json,js}     window.KR_STAKE_VALUE — 금액은 억원
  data/korea/stake_value_state.json    빌더 전용 상태. 배포에서 뺀다(deploy-pages.yml).

실행: python scripts/build_kr_stake_value.py [--top 200] [--max-calls 600] [--tickers 034730,003550] [--push]
      --tickers 는 검증용 — 파일을 쓰지 않고 결과만 출력한다. Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글·U+2014 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import write_data  # noqa: E402
from step_budget import StepBudget  # noqa: E402
import kr_holder_names as N  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "stake_value.json"
OUT_JS = ROOT / "data" / "korea" / "stake_value.js"
STATE_JSON = ROOT / "data" / "korea" / "stake_value_state.json"
MAJOR_STATE = ROOT / "data" / "korea" / "major_holders_state.json"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF", "etf"}
API_PATH = "otrCprInvstmntSttus.json"

PARSER_VERSION = 1
CHECK_RANGE = (0.5, 2.0)
HOLDCO_HINT = re.compile(r"(홀딩스|지주|holdings)", re.I)
TOTAL_NAMES = {"합계", "계", "총계", "소계", "total"}
MAX_TEXT = 40


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def to_num(value):
    s = str(value or "").strip().replace(",", "")
    if not s or s in ("-", "－"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


# ---------------------------------------------------------------------------- 순수 함수

def parse_rows(rows: list[dict]) -> dict:
    """otrCprInvstmntSttus 행 → {"asOf", "rc", "rows": [[이름, 목적, 주식수, 지분율, 장부가(원)]]}. 합계·처분 행 제외."""
    out = []
    as_of = rc = ""
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        name = N.display_name(r.get("inv_prm"))
        if not name or name.replace(" ", "").lower() in TOTAL_NAMES:
            continue
        as_of = as_of or str(r.get("stlm_dt") or "").strip()
        rc = rc or str(r.get("rcept_no") or "").strip()
        shares = to_num(r.get("trmend_blce_qy"))
        pct = to_num(r.get("trmend_blce_qota_rt"))
        book = to_num(r.get("trmend_blce_acntbk_amount"))
        if not pct or pct <= 0:
            continue
        purpose = " ".join(str(r.get("invstmnt_purps") or "").split())[:MAX_TEXT]
        out.append([name[:MAX_TEXT * 2], purpose, shares, pct, book])
    return {"asOf": as_of, "rc": rc, "rows": out}


def summarize(parent: str, parsed: dict, prices: dict[str, dict], listed_index: dict[str, str],
              parent_cap_eok: float | None, pref_included: bool) -> dict | None:
    """상장 피출자사 매칭 + 시가 합. 맞는 상장사가 없으면 None. 금액은 억원."""
    listed = []
    unlisted_book = 0.0
    unlisted_n = 0
    unverified = 0
    seen: set[str] = set()
    for name, purpose, shares, pct, book in parsed.get("rows") or []:
        hit = N.match_listed(name, listed_index)
        if hit and hit != parent and hit not in seen:
            px = prices.get(hit) or {}
            price = px.get("price")
            listed_sh = px.get("listedShares")
            if not shares or not price or price <= 0:
                unverified += 1
                continue
            if listed_sh and listed_sh > 0:
                implied = shares / listed_sh * 100
                ratio = implied / pct if pct else 0
                if not (CHECK_RANGE[0] <= ratio <= CHECK_RANGE[1]):
                    unverified += 1
                    continue
            else:
                unverified += 1
                continue
            seen.add(hit)
            value = shares * price / 1e8
            listed.append({"t": hit, "n": name, "pct": round(pct, 2), "sh": int(shares), "val": round(value),
                           **({"p": purpose} if purpose else {})})
        elif not hit and not N.is_preferred_name(name):
            if isinstance(book, (int, float)) and book > 0:
                unlisted_book += book / 1e8
                unlisted_n += 1
    if not listed:
        return None
    listed.sort(key=lambda x: -x["val"])
    total = sum(x["val"] for x in listed)
    rec = {"asOf": parsed.get("asOf") or "", "listed": listed, "sum": round(total)}
    if parent_cap_eok and parent_cap_eok > 0:
        rec["cap"] = round(parent_cap_eok)
        rec["ratio"] = round(total / parent_cap_eok * 100, 1)
        if pref_included:
            rec["prefIncluded"] = True
    if unlisted_n:
        rec["unlistedN"] = unlisted_n
        rec["unlistedBook"] = round(unlisted_book)
    if unverified:
        rec["unverified"] = unverified
    if parsed.get("rc"):
        rec["link"] = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={parsed['rc']}"
    return rec


def preferred_base(code: str) -> str | None:
    code = str(code)
    if len(code) != 6 or code.endswith("0"):
        return None
    return code[:5] + "0"


def parent_caps(stocks: list[dict]) -> dict[str, tuple[float, bool]]:
    """{보통주 ticker: (시총 억원, 우선주 포함 여부)}. marketCapB 는 KR 스냅샷에서 조원 단위다."""
    caps: dict[str, list] = {}
    for s in stocks:
        t = str(s.get("ticker") or "").zfill(6)
        cap = s.get("marketCapB")
        if not isinstance(cap, (int, float)) or cap <= 0:
            continue
        base = preferred_base(t)
        if base:
            caps.setdefault(base, [0.0, False])
            caps[base][0] += cap * 1e4
            caps[base][1] = True
        else:
            caps.setdefault(t, [0.0, False])
            caps[t][0] += cap * 1e4
    return {t: (v[0], v[1]) for t, v in caps.items()}


def candidates(stocks: list[dict], major_state: dict, listed_index: dict[str, str], top: int) -> list[str]:
    """상장 피출자사가 있을 만한 보통주 — (가) 상장사 보고자 5%+ (나) 지주·홀딩스 이름 (다) 시총 상위 top."""
    commons = [s for s in stocks if not preferred_base(str(s.get("ticker") or "").zfill(6))]
    out: list[str] = []
    for ticker, st in ((major_state or {}).get("companies") or {}).items():
        for _rc, _dt, who, ratio, *_ in st.get("r") or []:
            if ratio is None or ratio < 5:
                continue
            hit = N.match_listed(who, listed_index)
            if hit and hit != ticker:
                out.append(hit)
    for s in commons:
        if HOLDCO_HINT.search(str(s.get("company") or "")):
            out.append(str(s["ticker"]).zfill(6))
    for s in commons[:top]:
        out.append(str(s["ticker"]).zfill(6))
    seen: set[str] = set()
    uniq = []
    for t in out:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    return uniq


# ---------------------------------------------------------------------------- 실행

def load_stocks() -> list[dict]:
    snap = load_json(KR_SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in ETF_SECTORS]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    return stocks


def build(api_key: str, state: dict, top: int, max_calls: int, budget: StepBudget, only: set[str] | None = None):
    from build_kr_disclosures import dart_get, load_corp_map
    from build_kr_fin_safety import report_candidates, rp_key, rp_label

    today = datetime.now(KST).date()
    cands = report_candidates(today)
    latest = rp_key(cands[0])
    stocks = load_stocks()
    names = [(str(s["ticker"]).zfill(6), s.get("company") or "") for s in stocks if not preferred_base(str(s["ticker"]).zfill(6))]
    listed_index = N.build_listed_index(names)
    prices = {str(s["ticker"]).zfill(6): {"price": s.get("price"), "listedShares": s.get("listedShares")} for s in stocks}
    caps = parent_caps(stocks)
    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise RuntimeError("corpCode.xml 실패")
    targets = [t for t in (sorted(only) if only else candidates(stocks, load_json(MAJOR_STATE, {}), listed_index, top))
               if t in corp_map]
    comp = state.setdefault("companies", {})
    jobs = []
    for t in targets:
        st = comp.get(t) or {}
        if st.get("pv") == PARSER_VERSION and (st.get("rp") == latest or st.get("tried") == today.isoformat()):
            continue
        jobs.append((t, "rp" not in st))
    jobs.sort(key=lambda j: not j[1])                     # 한 번도 못 받은 회사 먼저
    print(f"[지분시가] 대상 {len(targets)}사 · 작업 {len(jobs)} · 최신 보고서 {rp_label(cands[0])} · 호출 상한 {max_calls}",
          flush=True)
    calls = done = fail = 0
    stopped = ""
    try:
        for t, _new in jobs:
            if calls + 1 > max_calls:
                stopped = f"호출 상한 {max_calls}"
                break
            if budget.over():
                stopped = budget.reason
                break
            st = dict(comp.get(t) or {})
            ok = True
            try:
                found = False
                tried_all = True
                for rp in cands:
                    if calls + 1 > max_calls:
                        tried_all = False
                        break
                    calls += 1
                    data = dart_get(API_PATH, {"corp_code": corp_map[t], "bsns_year": str(rp[0]), "reprt_code": rp[1]},
                                    api_key)
                    code = str(data.get("status") or "")
                    if code == "013":
                        continue
                    if code != "000":
                        raise RuntimeError(f"{API_PATH} status={code} {data.get('message') or ''}")
                    parsed = parse_rows(data.get("list") or [])
                    st.update({"rp": rp_key(rp), "p": rp_label(rp), **parsed})
                    found = True
                    break
                if not found and tried_all:
                    # 후보 보고서가 전부 013(결산월이 다르거나 정기보고서 미제출) — 다음 분기까지 다시 부르지 않는다.
                    st.update({"rp": latest, "rows": []})
                st["tried"] = today.isoformat()
                st["pv"] = PARSER_VERSION
                done += 1
            except SystemExit:
                raise
            except Exception as exc:  # noqa: BLE001
                ok = False
                fail += 1
                if fail <= 5:
                    print(f"  [지분시가] {t} 실패: {type(exc).__name__}: {exc}", flush=True)
            budget.record(ok)
            comp[t] = st
    except SystemExit as exc:            # DART 020(한도 초과) — 받은 만큼만 저장
        stopped = str(exc)
    if stopped:
        print(f"[지분시가] 멈춤: {stopped}", flush=True)
    if not only:
        live = set(targets)
        for k in [k for k in comp if k not in live]:
            comp.pop(k, None)
    companies: dict[str, dict] = {}
    unverified = 0
    for t in targets:
        st = comp.get(t) or {}
        if not st.get("rows"):
            continue
        cap, pref = caps.get(t, (None, False))
        rec = summarize(t, st, prices, listed_index, cap, pref)
        if rec:
            if st.get("p"):
                rec["report"] = st["p"]
            companies[t] = rec
            unverified += rec.get("unverified", 0)
    stats = {"targets": len(targets), "jobs": len(jobs), "done": done, "failed": fail, "calls": calls,
             "stopped": stopped, "unverifiedRows": unverified}
    return companies, stats


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 상장 지분 시가(DART 타법인 출자현황 × 스냅샷 주가)")
    ap.add_argument("--top", type=int, default=200)
    ap.add_argument("--max-calls", type=int, default=int(os.environ.get("KR_STAKE_VALUE_MAX_CALLS") or 600))
    ap.add_argument("--time-budget-min", type=float, default=0)
    ap.add_argument("--tickers", default="", help="쉼표 구분 종목만(검증용 — 파일을 쓰지 않는다)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        from build_kr_disclosures import dart_key_missing

        return dart_key_missing("지분시가")

    only = {t.strip().zfill(6) for t in args.tickers.split(",") if t.strip()} or None
    state = {} if only else (load_json(STATE_JSON, {}) or {})
    budget = StepBudget(args.time_budget_min)
    companies, stats = build(api_key, state, args.top, args.max_calls, budget, only)

    if only:
        for t in sorted(only):
            rec = companies.get(t)
            print(t, json.dumps({k: v for k, v in (rec or {}).items() if k != "listed"}, ensure_ascii=False),
                  json.dumps((rec or {}).get("listed", [])[:6], ensure_ascii=False))
        print(f"[지분시가] 검증 모드 — 파일을 쓰지 않는다 {stats}")
        return 0

    atomic_write_text(STATE_JSON, json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n")
    if not companies and stats["failed"]:
        print("[지분시가] 0건 + 오류 — 기존 파일을 덮지 않는다.")
        return 1
    snap = load_json(KR_SNAPSHOT, {}) or {}
    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART 정기보고서 · 타법인 출자현황(otrCprInvstmntSttus) × KR 스냅샷 종가",
        "priceAsOf": str(snap.get("updatedAtKst") or ""),
        "unit": "억원",
        "count": len(companies),
        "note": "상장 피출자사 지분 = 보고서 기준일 기말 주식 수 × 스냅샷 종가. 기준일 이후 지분 변동은 반영되지 않는다. "
                "비상장 피출자사는 장부가라 시가 합에 넣지 않았다.",
        "companies": companies,
    }
    write_data(OUT_JSON, OUT_JS, "KR_STAKE_VALUE", payload, indent=None)
    print(f"[지분시가] {len(companies)}사 기록 · {stats}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/stake_value.json", "data/korea/stake_value.js", "data/korea/stake_value_state.json"],
                "KR listed stake value (DART)",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
