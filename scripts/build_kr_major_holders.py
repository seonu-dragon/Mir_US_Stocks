#!/usr/bin/env python3
"""국내 대량보유자 역검색(국내판 Superstar) — '이 보고자가 5% 이상 가진 상장사'.

화면: 종목 › 공시 › 지분 변동 › **보고자별 보유**(kr-panels.js renderKrHolderIndex). 보고자 하나를 고르면 그 보고자의
최신 보고 기준 보유 비율·직전 대비 증감·보고일(DART 원문 링크)을 회사별로 보여 준다. 점수·순위 해석 없이 보고 내용만.

## 원천

OpenDART 지분공시 종합정보 `majorstock.json`(DS004 대량보유 상황보고). corp_code 가 필수라 회사 단위로 부르고,
**날짜 파라미터가 없어 전체 이력**을 준다(삼성전자 43건, 2026-10-23 실측). build_kr_ownership.py 는 같은 응답을 최근
7일로 잘라 쓰고, 여기서는 이력 전체에서 (회사, 보고자)마다 **가장 최근 보고**만 남긴다 — 그게 지금 공시된 보유 상태다.
보유가 5% 밑으로 내려가면 그 사실도 보고되므로(마지막 보고 비율 < 5) 그런 행은 '5% 미만 보고'로 따로 표시하고
보유 종목 수에서는 뺀다(최근 EXIT_DAYS 일 것만 싣는다).

필드: repror(대표 보고자) · stkrt(보유 비율 %) · stkrt_irds(직전 보고 대비 %p) · stkqy(주식 수) · rcept_dt(접수일,
**YYYY-MM-DD**) · rcept_no · report_tp(일반/약식).

## 이름 정규화(kr_holder_names.py)

보고자 이름은 제출인이 적는다. 법인격·공백·문장부호를 떼고, 영문·한글 표기가 섞여 쓰이는 주요 기관은 작은 수작업
별칭표로 묶는다(서로 다른 법인을 그룹으로 묶지는 않는다). 개인(2~4자 한글 이름)은 목록에 넣지 않는다.
보고자 이름이 상장사와 정확히 같으면 그 종목코드(t)를 붙인다 — 지주사·그룹사 보유가 여기서 보인다.

## 호출 예산(DART 하루 2만 회를 다른 빌더와 나눠 쓴다)

  - 처음엔 전 종목(보통주 ≈ 2,500사)을 실행당 --max-calls(기본 1,500)씩 나눠 채운다(못 받은 회사 먼저).
  - 그 뒤엔 data/kr_ownership.json(같은 워크플로우 앞 스텝, 최근 7일 대량보유 공시)에 새 보고가 있는 회사만 다시
    부르고, 받은 지 ROTATE_DAYS 일 넘은 회사를 실행당 ROTATE_PER_RUN 사씩 돌려 다시 본다(놓친 보고 보정).
  - 첫 채움 ≈ 2,500회, 이후 평일 하루 ≈ 100~200회.

산출물
  data/korea/major_holders.{json,js}    window.KR_MAJOR_HOLDERS — 보고자별 보유 목록 + 수집 범위
  data/korea/major_holders_state.json   빌더 전용 상태(회사별 최신 보고자 행). 배포에서 뺀다(deploy-pages.yml).

실행: python scripts/build_kr_major_holders.py [--max-calls 1500] [--tickers 005930,000660] [--push]
      --tickers 는 검증용 — 파일을 쓰지 않고 결과만 출력한다. Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta
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
OUT_JSON = ROOT / "data" / "korea" / "major_holders.json"
OUT_JS = ROOT / "data" / "korea" / "major_holders.js"
STATE_JSON = ROOT / "data" / "korea" / "major_holders_state.json"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
KR_OWNERSHIP = ROOT / "data" / "kr_ownership.json"
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF", "etf"}

STATE_VERSION = 1
THRESHOLD = 5.0          # 5% 이상 = 보고 기준 보유
EXIT_DAYS = 365          # '5% 미만 보고' 행은 최근 1년 것만 싣는다
ROTATE_DAYS = 120
ROTATE_PER_RUN = 25
MIN_HOLDINGS = 3         # 일반 기관: 5%+ 보유 3사 이상
MIN_HOLDINGS_LISTED = 2  # 보고자가 상장사(지주·그룹사)면 2사 이상
MAX_AKA = 3


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
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def dart_link(rcept_no) -> str:
    r = str(rcept_no or "").strip()
    return f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={r}" if r else ""


# ---------------------------------------------------------------------------- 순수 함수

def latest_by_reporter(rows: list[dict]) -> list[list]:
    """majorstock 이력 → 보고자(원문 이름)마다 가장 최근 보고 한 행.

    행: [rcept_no, rcept_dt, repror, stkrt, stkrt_irds, stkqy, report_tp]. 같은 날 여러 건이면 접수번호가 큰 쪽.
    """
    best: dict[str, list] = {}
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        who = " ".join(str(r.get("repror") or "").split())
        rc = str(r.get("rcept_no") or "").strip()
        dt = str(r.get("rcept_dt") or "").strip()
        if len(dt) == 8 and dt.isdigit():
            dt = f"{dt[:4]}-{dt[4:6]}-{dt[6:]}"
        if not who or not rc or len(dt) != 10:
            continue
        row = [rc, dt, who, to_num(r.get("stkrt")), to_num(r.get("stkrt_irds")), to_num(r.get("stkqy")),
               str(r.get("report_tp") or "").strip()]
        cur = best.get(who)
        if cur is None or (row[1], row[0]) > (cur[1], cur[0]):
            best[who] = row
    return sorted(best.values(), key=lambda x: (x[1], x[0]), reverse=True)


def aggregate_holders(companies: dict[str, dict], names: dict[str, str], listed_index: dict[str, str],
                      today: date) -> list[dict]:
    """회사별 최신 보고자 행 → 보고자별 보유 목록(선정 규칙 적용, 보유 종목 수 내림차순)."""
    exit_cut = (today - timedelta(days=EXIT_DAYS)).isoformat()
    groups: dict[str, dict] = {}
    for ticker, st in companies.items():
        if ticker not in names:
            continue                      # 지금 상장 목록에 없는 회사(상장폐지·합병)는 싣지 않는다
        for rc, dt, who, ratio, chg, shares, tp in st.get("r") or []:
            if ratio is None or N.is_person_like(who):
                continue
            key, display = N.canonical(who)
            if not key:
                continue
            is_exit = ratio < THRESHOLD
            if is_exit and dt < exit_cut:
                continue
            g = groups.setdefault(key, {"names": {}, "rows": [], "t": None})
            g["names"][display] = max(g["names"].get(display, ""), dt)
            hit = N.match_listed(who, listed_index)
            if hit and hit != ticker:
                g["t"] = g["t"] or hit
            out = [ticker, names[ticker], round(ratio, 2), None if chg is None else round(chg, 2), dt, rc, tp]
            if is_exit:
                out.append(1)
            g["rows"].append(out)
    holders = []
    for key, g in groups.items():
        # 한 보고자가 같은 회사에 두 표기로 보고했으면(별칭으로 묶임) 최근 보고만 남긴다.
        per_co: dict[str, list] = {}
        for row in g["rows"]:
            cur = per_co.get(row[0])
            if cur is None or (row[4], row[5]) > (cur[4], cur[5]):
                per_co[row[0]] = row
        rows = sorted(per_co.values(), key=lambda x: (x[4], x[5]), reverse=True)
        n = sum(1 for r in rows if len(r) < 8)
        display = N.ALIASES.get(key) or max(g["names"].items(), key=lambda kv: kv[1])[0]
        curated = display in N.CURATED_HOLDERS
        need = 1 if curated else (MIN_HOLDINGS_LISTED if g["t"] else MIN_HOLDINGS)
        if n < need:
            continue
        rec = {"id": key, "name": display, "n": n, "rows": rows}
        if g["t"]:
            rec["t"] = g["t"]
        aka = [nm for nm, _ in sorted(g["names"].items(), key=lambda kv: kv[1], reverse=True) if nm != display]
        if aka:
            rec["aka"] = aka[:MAX_AKA]
        holders.append(rec)
    holders.sort(key=lambda h: (-h["n"], h["name"]))
    return holders


def plan_jobs(universe: list[str], companies: dict[str, dict], recent: dict[str, str], today: date) -> list[str]:
    """[ticker] — 한 번도 안 받은 회사(시총 순) → 최근 7일 새 보고가 받은 날 이후인 회사 → 오래 묵은 회사 일부."""
    missing = [t for t in universe if t not in companies]
    fresh = [t for t in universe if t in companies and recent.get(t, "") >= (companies[t].get("f") or "")
             and recent.get(t)]
    rot_cut = (today - timedelta(days=ROTATE_DAYS)).isoformat()
    stale = sorted((t for t in universe if t in companies and t not in fresh and (companies[t].get("f") or "") < rot_cut),
                   key=lambda t: companies[t].get("f") or "")[:ROTATE_PER_RUN]
    seen: set[str] = set()
    out = []
    for t in missing + fresh + stale:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def recent_filers(payload: dict) -> dict[str, str]:
    """kr_ownership.json → {ticker: 가장 최근 대량보유 공시일}."""
    out: dict[str, str] = {}
    for row in (payload or {}).get("majorHolders") or []:
        t = str(row.get("ticker") or "").zfill(6)
        d = str(row.get("fileDate") or "")
        if t and len(d) == 10 and d > out.get(t, ""):
            out[t] = d
    return out


# ---------------------------------------------------------------------------- 실행

def universe() -> tuple[list[str], dict[str, str]]:
    snap = load_json(KR_SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in ETF_SECTORS]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    names = {str(s["ticker"]).zfill(6): N.display_name(s.get("company") or s.get("name") or "") for s in stocks}
    return [str(s["ticker"]).zfill(6) for s in stocks], names


def fetch_company(corp: str, api_key: str, dart_get) -> list[list] | None:
    """status 000 → 최신 보고자 행, 013(보고 없음) → [], 그 밖 → None."""
    data = dart_get("majorstock.json", {"corp_code": corp}, api_key)
    st = str(data.get("status") or "")
    if st == "013":
        return []
    if st != "000":
        raise RuntimeError(f"majorstock status={st} {data.get('message') or ''}")
    return latest_by_reporter(data.get("list") or [])


def build(api_key: str, state: dict, max_calls: int, budget: StepBudget, only: set[str] | None = None):
    from build_kr_disclosures import dart_get, load_corp_map

    today = datetime.now(KST).date()
    tickers, names = universe()
    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise RuntimeError("corpCode.xml 실패")
    commons = [t for t in (sorted(only) if only else tickers) if t in corp_map]
    comp = state.setdefault("companies", {})
    recent = recent_filers(load_json(KR_OWNERSHIP, {}))
    jobs = commons if only else plan_jobs(commons, comp, recent, today)
    print(f"[대량보유자] 대상 {len(commons)}사 · 받은 회사 {sum(1 for t in commons if t in comp)} · 작업 {len(jobs)} "
          f"· 호출 상한 {max_calls}", flush=True)
    calls = fail = done = 0
    stopped = ""
    try:
        for t in jobs:
            if calls >= max_calls:
                stopped = f"호출 상한 {max_calls}"
                break
            if budget.over():
                stopped = budget.reason
                break
            calls += 1
            ok = True
            try:
                got = fetch_company(corp_map[t], api_key, dart_get)
                comp[t] = {"f": today.isoformat(), "r": got}
                done += 1
            except SystemExit:
                raise
            except Exception as exc:  # noqa: BLE001
                ok = False
                fail += 1
                if fail <= 5:
                    print(f"  [대량보유자] {t} 실패: {type(exc).__name__}: {exc}", flush=True)
            budget.record(ok)
            if done and done % 200 == 0:
                print(f"  {done}사 · 호출 {calls}", flush=True)
    except SystemExit as exc:            # DART 020(한도 초과) — 받은 만큼만 저장
        stopped = str(exc)
    if stopped:
        print(f"[대량보유자] 멈춤: {stopped}", flush=True)
    if not only:
        live = set(commons)
        for k in [k for k in comp if k not in live]:
            comp.pop(k, None)
    listed_index = N.build_listed_index(names.items())
    scope = {t: comp[t] for t in commons if t in comp}
    holders = aggregate_holders(scope, names, listed_index, today)
    stats = {"jobs": len(jobs), "done": done, "failed": fail, "calls": calls, "stopped": stopped,
             "fetched": len(scope), "universe": len(commons)}
    return holders, stats


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 대량보유자 역검색(DART majorstock 전체 이력)")
    ap.add_argument("--max-calls", type=int, default=int(os.environ.get("KR_MAJOR_HOLDERS_MAX_CALLS") or 1500))
    ap.add_argument("--time-budget-min", type=float, default=0)
    ap.add_argument("--tickers", default="", help="쉼표 구분 종목만(검증용 — 파일을 쓰지 않는다)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        from build_kr_disclosures import dart_key_missing

        return dart_key_missing("대량보유자")

    only = {t.strip().zfill(6) for t in args.tickers.split(",") if t.strip()} or None
    state = {"v": STATE_VERSION} if only else (load_json(STATE_JSON, {}) or {})
    if state.get("v") != STATE_VERSION:
        state = {"v": STATE_VERSION}
    budget = StepBudget(args.time_budget_min)
    holders, stats = build(api_key, state, args.max_calls, budget, only)

    if only:
        for h in holders[:40]:
            print(json.dumps({k: v for k, v in h.items() if k != "rows"}, ensure_ascii=False),
                  json.dumps(h["rows"][:3], ensure_ascii=False))
        print(f"[대량보유자] 검증 모드 — 파일을 쓰지 않는다 {stats}")
        return 0

    atomic_write_text(STATE_JSON, json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n")
    if not holders and stats["failed"]:
        print("[대량보유자] 0건 + 오류 — 기존 파일을 덮지 않는다.")
        return 1
    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART 지분공시 · 대량보유 상황보고(majorstock)",
        "threshold": THRESHOLD,
        "exitDays": EXIT_DAYS,
        "coverage": {"fetched": stats["fetched"], "universe": stats["universe"]},
        "count": len(holders),
        "cols": ["ticker", "company", "ratio", "ratioChange", "fileDate", "rceptNo", "reportType", "exit"],
        "note": "회사·보고자마다 가장 최근 대량보유 보고 기준. 5% 미만 보고(exit=1)는 보유 종목 수에서 뺐다.",
        "holders": holders,
    }
    write_data(OUT_JSON, OUT_JS, "KR_MAJOR_HOLDERS", payload, indent=None)
    print(f"[대량보유자] 보고자 {len(holders)}곳 기록 · {stats}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/major_holders.json", "data/korea/major_holders.js", "data/korea/major_holders_state.json"],
                "KR major holders reverse lookup (DART)",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
