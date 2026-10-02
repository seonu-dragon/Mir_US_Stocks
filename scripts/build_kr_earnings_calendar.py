#!/usr/bin/env python3
"""국내 실적 발표 예정일(추정) — 작년 같은 분기의 실제 발표일로 이번 분기 날짜를 추정한다.

국내에는 '실적 발표 예정일'을 주는 공개 소스가 없다(야후는 KR 티커에 빈 배열, IR 공시는 실적 전에
IR 을 여는 대형주 일부뿐 — market_config.js 주석). 그래서 DART 에 남은 **실제 발표 이력**을 쓴다:

  잠정실적  '영업(잠정)실적(공정공시)' 접수일 — 분기 끝난 뒤 첫 공개 시점. 접수 월로 분기를 정한다
            (1~3월→전년 4분기, 4~6월→1분기, 7~9월→2분기, 10~12월→3분기). 한 분기 창에 두 달 이상
            잠정 공시를 낸 종목은 월별 매출 공시(카지노·조선 등)라 잠정 날짜를 쓰지 않는다.
  정기보고서 분기·반기·사업보고서 접수일 — 제목의 '(2025.09)' 로 분기를 정한다. 잠정실적을 안 내는
            회사는 이게 첫 공개다.

이번 분기 예정일 = 작년 같은 분기 날짜 + 364일(같은 요일). 잠정 기준이 이미 지났는데 아직 안 냈으면
정기보고서 기준으로, 그것도 지났으면 법정 제출기한(분기·반기 45일, 사업보고서 90일)으로 둔다.
이미 이번 분기 실적을 낸 종목은 목록에서 빠진다. 모든 날짜는 **추정**이고 행마다 근거(basis)를 싣는다.

소스: 매일은 kr_disclosures.json(최근 7일). 처음 한 번 `--backfill-days 420` 으로 DART 공시검색
(I002 공정공시, A001~A003 정기보고서)을 스캔해 작년 이력을 채운다(목록 요청 ~150회).

산출물: data/korea/earnings_calendar.{json,js} (window.KOREA_EARNINGS_CALENDAR, 미국과 같은 earnings[] 모양)
상태:   data/korea/earnings_dates_state.json — 종목별 분기 발표일 이력(최근 2년). 배포 제외.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ROOT / ".env")
except Exception:
    pass

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import write_data  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
DISCLOSURES = ROOT / "data" / "kr_disclosures.json"
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "earnings_calendar.json"
OUT_JS = ROOT / "data" / "korea" / "earnings_calendar.js"
STATE = ROOT / "data" / "korea" / "earnings_dates_state.json"
HISTORY_DAYS = 760
# 이번 분기를 '진행 중'으로 보는 기간: 분기 끝 + 사업보고서 기한(90일) + 여유.
ACTIVE_DAYS = 100
# 이 파일은 국내 화면을 열 때마다 받는다(app.js loadEarningsCalendarSnapshot) — 시총 상위만 싣는다.
# 화면의 종목 풀은 관심종목 + 시총 상위 80 이라 1,000 이면 충분하다.
PUBLISH_TOP = 1000


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def quarter_of_prelim(file_date: str) -> str | None:
    """잠정실적 접수일 → 대상 분기('2025.09'). 1~3월 접수는 전년 4분기."""
    try:
        d = date.fromisoformat(file_date)
    except ValueError:
        return None
    if d.month <= 3:
        return f"{d.year - 1}.12"
    return f"{d.year}.{((d.month - 1) // 3) * 3:02d}"


REPORT_RE = re.compile(r"^(분기보고서|반기보고서|사업보고서)\s*\((\d{4})\.(\d{2})\)")


def classify(title: str, file_date: str) -> tuple[str, str] | None:
    """제목 → ('prelim'|'report', 분기). '[기재정정]' 은 나중 접수라 뺀다. '[첨부추가]'·'[첨부정정]' 은
    DART 목록이 원 공시 제목에 붙여 보여 주는 표시라(LG전자 2025-10-13 잠정실적) 원 공시로 받는다."""
    t = " ".join((title or "").split())
    t = re.sub(r"^\[첨부(추가|정정)\]\s*", "", t)
    if not t or t.startswith("["):
        return None
    if "(잠정)실적" in t.replace(" ", "") and "공정공시" in t and "자회사" not in t:
        # 연결/별도 제목을 따로 센다 — 현대차는 월별 판매(별도 '영업(잠정)실적')와 분기 실적
        # ('연결재무제표기준영업(잠정)실적')을 같은 이름으로 내서, 섞으면 분기 실적까지 월별로 묶인다.
        q = quarter_of_prelim(file_date)
        return ("prelim_c" if "연결재무제표" in t else "prelim_s", q) if q else None
    m = REPORT_RE.match(t)
    if m and m.group(3) in ("03", "06", "09", "12"):
        return "report", f"{m.group(2)}.{m.group(3)}"
    return None


def quarter_end(q: str) -> date:
    y, m = int(q[:4]), int(q[5:7])
    nxt = date(y + (m == 12), 1 if m == 12 else m + 1, 1)
    return nxt - timedelta(days=1)


def prev_year(q: str) -> str:
    return f"{int(q[:4]) - 1}{q[4:]}"


def deadline(q: str) -> date:
    return quarter_end(q) + timedelta(days=90 if q.endswith(".12") else 45)


def ingest(history: dict, rows: list[dict]) -> int:
    """공시 행 → history[ticker][분기] = {prelim_c|prelim_s|report: 최초 접수일, months_c|months_s: [접수 월]}."""
    added = 0
    for r in rows:
        ticker = str(r.get("ticker") or "").zfill(6)
        fdate = r.get("fileDate") or ""
        cls = classify(r.get("title"), fdate)
        if not cls or not fdate or len(ticker) != 6:
            continue
        kind, q = cls
        slot = history.setdefault(ticker, {}).setdefault(q, {})
        if kind.startswith("prelim"):
            mk = "months_" + kind[-1]
            slot[mk] = sorted(set(slot.get(mk) or []) | {fdate[:7]})
        if not slot.get(kind) or fdate < slot[kind]:
            slot[kind] = fdate
            added += 1
    return added


def monthly_variants(slots: dict) -> set[str]:
    """한 분기에 두 달 이상 잠정 공시를 낸 제목 변형(c=연결, s=별도) — 월별 매출 공시라 실적일로 안 쓴다."""
    return {v for v in ("c", "s") if any(len(sl.get("months_" + v) or []) >= 2 for sl in slots.values())}


def quarterly_prelim(slot: dict, monthly: set[str]) -> str | None:
    dates = [slot["prelim_" + v] for v in ("c", "s") if v not in monthly and slot.get("prelim_" + v)]
    return min(dates) if dates else None


def first_disclosure(slot: dict, monthly: set[str] = frozenset()) -> tuple[str | None, str]:
    """분기 슬롯의 '첫 공개일'과 근거. 월별 잠정 공시(변형)는 잠정 날짜로 쓰지 않는다."""
    pre = quarterly_prelim(slot, monthly)
    if pre:
        return pre, "prelim"
    if slot.get("report"):
        return slot["report"], "report"
    return None, ""


def active_quarters(today: date) -> list[str]:
    out = []
    for back in range(0, 2):
        y, m = today.year, ((today.month - 1) // 3) * 3  # 지난 분기 끝 월(0 이면 전년 12월)
        m -= back * 3
        while m <= 0:
            m += 12
            y -= 1
        q = f"{y}.{m:02d}"
        if quarter_end(q) < today and (today - quarter_end(q)).days <= ACTIVE_DAYS:
            out.append(q)
    return out


def estimate(history: dict, today: date) -> list[dict]:
    rows = []
    for q in active_quarters(today):
        ly = prev_year(q)
        for ticker, slots in history.items():
            # 이번 분기 첫 월별 공시(10-01 현대차 9월 판매)를 '실적 발표'로 보면 안 된다.
            monthly = monthly_variants(slots)
            cur = slots.get(q) or {}
            if cur.get("report") or quarterly_prelim(cur, monthly):
                continue  # 이번 분기 실적을 이미 냈다
            last = slots.get(ly) or {}
            ref, basis = first_disclosure(last, monthly)
            if not ref:
                continue
            est = date.fromisoformat(ref) + timedelta(days=364)
            if est < today and basis == "prelim" and last.get("report"):
                ref, basis = last["report"], "report"
                est = date.fromisoformat(ref) + timedelta(days=364)
            if est < today:
                est, basis, ref = deadline(q), "deadline", ""
                if est < today:
                    continue
            row = {"ticker": ticker, "nextDate": est.isoformat(), "quarter": q, "basis": basis, "estimated": True}
            if ref:
                row["lastYearDate"] = ref
            rows.append(row)
    # 한 종목이 두 분기에 걸리면(연말 직후) 가까운 날짜만.
    best: dict[str, dict] = {}
    for r in sorted(rows, key=lambda x: x["nextDate"]):
        best.setdefault(r["ticker"], r)
    return sorted(best.values(), key=lambda x: (x["nextDate"], x["ticker"]))


def prune(history: dict, today: date) -> dict:
    cutoff = (today - timedelta(days=HISTORY_DAYS)).isoformat()[:7].replace("-", ".")
    return {t: {q: s for q, s in qs.items() if q >= cutoff} for t, qs in history.items()}


def _load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def top_by_cap(rows: list[dict], limit: int) -> list[dict]:
    snap = _load(SNAPSHOT, {})
    caps = {s["ticker"]: float(s.get("marketCapT") or s.get("marketCapB") or 0)
            for s in snap.get("stocks") or [] if s.get("market") in ("kospi", "kosdaq")}
    if not caps:
        return rows
    keep = set(sorted(caps, key=caps.get, reverse=True)[:limit])
    return [r for r in rows if r["ticker"] in keep]


def kospi200_coverage(rows: list[dict], horizon_days: int, today: date) -> tuple[int, int]:
    snap = _load(SNAPSHOT, {})
    k200 = {s["ticker"] for s in snap.get("stocks") or [] if "idx_kospi200" in (s.get("groups") or [])}
    end = (today + timedelta(days=horizon_days)).isoformat()
    covered = {r["ticker"] for r in rows if r["nextDate"] <= end} & k200
    return len(covered), len(k200)


def main() -> int:
    ap = argparse.ArgumentParser(description="국내 실적 발표 예정일(작년 발표일 기준 추정)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--backfill-days", type=int, default=0,
                    help="DART 공시검색으로 최근 N일(잠정실적·정기보고서)을 스캔해 작년 이력을 채운다")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    import sec_client as sec

    today = datetime.now(KST).date()
    state = _load(STATE, {})
    history = state.get("history") or {}
    source = list((_load(DISCLOSURES, {}).get("disclosures")) or [])
    if args.backfill_days:
        api_key = os.environ.get("DART_API_KEY", "").strip()
        if not api_key:
            print("[실적일정] 백필에는 DART_API_KEY 가 필요하다.")
            return 1
        from kr_dart_scan import scan
        bgn = today - timedelta(days=args.backfill_days)
        scanned = scan(api_key, bgn, today, ("I002", "A001", "A002", "A003"),
                       keep=lambda t: classify(t, "2000-01-01") is not None)
        print(f"[실적일정] 백필 스캔 {bgn}~{today}: {len(scanned)}건")
        source = scanned + source
        if not state.get("coverageStart") or state["coverageStart"] > bgn.isoformat():
            state["coverageStart"] = bgn.isoformat()
    added = ingest(history, source)
    history = prune(history, today)
    rows = estimate(history, today)
    covered, k200 = kospi200_coverage(rows, 75, today)
    all_count = len(rows)
    rows = top_by_cap(rows, PUBLISH_TOP)
    by_basis: dict[str, int] = {}
    for r in rows:
        by_basis[r["basis"]] = by_basis.get(r["basis"], 0) + 1
    print(f"[실적일정] 이력 갱신 {added}건 · 예정 {len(rows)}종목 {by_basis} · "
          f"코스피200 커버 {covered}/{k200} (75일 안) · 발행 {len(rows)}/{all_count}(시총 상위 {PUBLISH_TOP})")
    payload = {
        "market": "kr",
        "updatedAtKst": now_kst(),
        "count": len(rows),
        "basisCounts": by_basis,
        "kospi200Coverage": {"covered": covered, "total": k200},
        "coverageStart": state.get("coverageStart") or "",
        "source": "DART 실제 발표 이력(잠정실적·정기보고서) 기반 추정",
        "earnings": rows,
    }
    new_state = {"updatedAtKst": now_kst(), "coverageStart": state.get("coverageStart") or "", "history": history}
    with repository_publish_lock(ROOT):
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        # 실적 시즌 직후(모두 발표)에는 예정이 0건일 수 있다.
        write_data(OUT_JSON, OUT_JS, "KOREA_EARNINGS_CALENDAR", payload, indent=None, allow_empty=True)
        atomic_write_text(STATE, json.dumps(new_state, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"Wrote {OUT_JSON} — {len(rows)} rows")
        if args.push and not sec.git_publish(
            ["data/korea/earnings_calendar.json", "data/korea/earnings_calendar.js",
             "data/korea/earnings_dates_state.json"],
            "KR earnings calendar (estimated)",
        ):
            print("[실적일정] git 게시 실패 — 발행되지 않았다")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
