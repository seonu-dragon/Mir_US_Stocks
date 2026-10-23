#!/usr/bin/env python3
"""실적 시즌 스코어보드 — S&P 500 구성 종목의 이번 시즌 EPS·매출 실제 vs 추정(Finnhub 무료).

시즌 = 가장 최근에 끝난 **달력 분기**의 실적 발표 기간. 분기 끝 다음 날부터 오늘까지 발표한 회사를 센다
(예: 2026-10-23 → 3분기, 10-01 이후 발표분). 회계연도가 다른 회사는 Finnhub 의 회계 분기 표기 그대로 두고
발표일로만 시즌에 넣는다. 그래서 8월 말 분기를 9월에 발표한 회사(오라클·나이키 등)는 빠진다.

  GET https://finnhub.io/api/v1/calendar/earnings?from=..&to=..   (epsActual·epsEstimate·revenueActual·revenueEstimate)

- 추정치는 Finnhub 컨센서스다. FactSet·LSEG 수치와 다를 수 있다(상회 비율이 다르게 나온다).
- 상회/하회 = 실제와 추정을 센트(EPS)·원 단위 반올림으로 비교. 같으면 '부합'.
- 서프라이즈% = (실제 − 추정) / |추정| × 100. |추정| < 0.01 이면 계산하지 않는다(0 근처 분모).
- 블렌디드 성장률(발표분 실제 + 미발표분 추정 합산)은 **하지 않는다** — 추정치 품질 문제로 정직성 위험이 크다.
- 커버리지는 'n / 구성 종목 수'로 함께 낸다(스냅샷 idx_sp500 기준).

산출물: data/earnings_scoreboard.json + .js(window.EARNINGS_SCOREBOARD).
"""
from __future__ import annotations

import json
import os
import statistics
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402

SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "earnings_scoreboard.json"
OUT_JS = ROOT / "data" / "earnings_scoreboard.js"
BASE = "https://finnhub.io/api/v1/calendar/earnings"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
CHUNK_DAYS = 7  # 한 번에 받는 기간 — 응답 상한에 걸리지 않게 주 단위로 나눈다


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def load_key() -> str:
    key = os.environ.get("FINNHUB_API_KEY", "").strip()
    if key:
        return key
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("FINNHUB_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def season_window(today: date) -> tuple[str, date, date]:
    """(라벨, 시작, 끝) — 가장 최근에 끝난 달력 분기의 다음 날 ~ today."""
    q_now = (today.month - 1) // 3  # 0..3 (현재 분기)
    if q_now == 0:
        y, q = today.year - 1, 4
    else:
        y, q = today.year, q_now
    start = date(y + (1 if q == 4 else 0), 1 if q == 4 else q * 3 + 1, 1)
    return f"{y}년 {q}분기", start, today


def _num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def classify(actual, estimate, digits: int = 2):
    """'beat' | 'miss' | 'inline' | None(둘 중 하나라도 없음)."""
    a, e = _num(actual), _num(estimate)
    if a is None or e is None:
        return None
    ra, re_ = round(a, digits), round(e, digits)
    return "beat" if ra > re_ else "miss" if ra < re_ else "inline"


def surprise_pct(actual, estimate):
    a, e = _num(actual), _num(estimate)
    if a is None or e is None or abs(e) < 0.01:
        return None
    return round((a - e) / abs(e) * 100, 2)


def summarize(rows: list[dict]) -> dict:
    """행 묶음 → {n, beat, miss, inline, beatPct, missPct, medianSurprisePct, revN, revBeatPct}."""
    eps = [r for r in rows if r.get("eps") in ("beat", "miss", "inline")]
    n = len(eps)
    cnt = {k: sum(1 for r in eps if r["eps"] == k) for k in ("beat", "miss", "inline")}
    sur = [r["surprisePct"] for r in eps if isinstance(r.get("surprisePct"), (int, float))]
    rev = [r for r in rows if r.get("rev") in ("beat", "miss", "inline")]
    pct = lambda k, base: round(k / base * 100, 1) if base else None  # noqa: E731
    return {
        "n": n, **cnt,
        "beatPct": pct(cnt["beat"], n), "missPct": pct(cnt["miss"], n),
        "medianSurprisePct": round(statistics.median(sur), 2) if sur else None,
        "revN": len(rev), "revBeatPct": pct(sum(1 for r in rev if r["rev"] == "beat"), len(rev)),
    }


def build_rows(calendar: list[dict], members: dict[str, dict], start: str, end: str) -> list[dict]:
    """Finnhub 캘린더 행 → S&P 500 구성 종목의 시즌 내 발표 행(종목당 최신 1건, 실제 EPS 있는 것만)."""
    best: dict[str, dict] = {}
    for r in calendar or []:
        sym = str(r.get("symbol") or "").upper().replace("/", ".")
        d = str(r.get("date") or "")
        if sym not in members or not (start <= d <= end) or _num(r.get("epsActual")) is None:
            continue
        if sym in best and best[sym]["date"] >= d:
            continue
        best[sym] = {
            "ticker": sym, "date": d, "sector": members[sym].get("sector") or "",
            "fq": f"{r.get('year')}Q{r.get('quarter')}" if r.get("year") and r.get("quarter") else None,
            "epsA": _num(r.get("epsActual")), "epsE": _num(r.get("epsEstimate")),
            "revA": _num(r.get("revenueActual")), "revE": _num(r.get("revenueEstimate")),
        }
    out = []
    for row in best.values():
        row["eps"] = classify(row["epsA"], row["epsE"])
        row["surprisePct"] = surprise_pct(row["epsA"], row["epsE"])
        row["rev"] = classify(row["revA"], row["revE"], digits=-5)  # 10만 달러 단위 반올림
        out.append(row)
    out.sort(key=lambda r: (r["date"], r["ticker"]), reverse=True)
    return out


def scoreboard(rows: list[dict], total: int, label: str, start: str, end: str) -> dict:
    sectors = {}
    for r in rows:
        sectors.setdefault(r["sector"] or "기타", []).append(r)
    by_sector = [{"sector": k, **summarize(v)} for k, v in sectors.items()]
    by_sector = [s for s in by_sector if s["n"]]
    by_sector.sort(key=lambda s: (-s["n"], s["sector"]))
    return {
        "updatedAtKst": kst_now_str(), "season": label, "from": start, "to": end,
        "universe": "S&P 500", "total": total,
        "source": "Finnhub 실적 캘린더(실제·컨센서스 추정) · 구성 종목은 스냅샷 기준",
        "note": "FactSet 집계가 아니다. 추정치 출처가 달라 상회 비율이 다를 수 있다. 블렌디드 성장률은 계산하지 않는다.",
        "overall": summarize(rows), "sectors": by_sector, "count": len(rows), "rows": rows,
    }


def fetch_calendar(key: str, start: date, end: date) -> list[dict]:
    out = []
    cur = start
    while cur <= end:
        stop = min(end, cur + timedelta(days=CHUNK_DAYS - 1))
        url = f"{BASE}?from={cur.isoformat()}&to={stop.isoformat()}&token={key}"
        data = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                    data = json.loads(r.read())
                break
            except Exception as e:  # noqa: BLE001
                if getattr(e, "code", None) in (401, 403):
                    raise RuntimeError(f"finnhub 인증 실패({e.code})") from None
                time.sleep(2 * (attempt + 1))
        if data is None:
            raise RuntimeError(f"finnhub 캘린더 {cur}~{stop} 실패")
        out.extend(data.get("earningsCalendar") or [])
        cur = stop + timedelta(days=1)
        time.sleep(1.1)
    return out


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 실적 시즌 스코어보드 (Finnhub) ===")
    key = load_key()
    if not key:
        print("[scoreboard] FINNHUB_API_KEY 없음 — 기존 파일 유지")
        return 1
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else {"stocks": []}
    members = {str(s.get("ticker")).upper(): s for s in snap.get("stocks") or []
               if s.get("ticker") and "idx_sp500" in (s.get("groups") or [])}
    if len(members) < 400:
        print(f"[scoreboard] S&P 500 구성 종목 {len(members)}개 — 스냅샷 이상, 기존 파일 유지")
        return 1
    today = datetime.now(timezone(timedelta(hours=-5))).date()  # 미 동부(대략) 기준 오늘
    label, start, end = season_window(today)
    try:
        cal = fetch_calendar(key, start, end)
    except Exception as e:  # noqa: BLE001
        print(f"[scoreboard] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    rows = build_rows(cal, members, start.isoformat(), end.isoformat())
    payload = scoreboard(rows, len(members), label, start.isoformat(), end.isoformat())
    # 시즌 첫날엔 0건이 정상이다(allow_empty) — 시즌이 바뀌면 이전 시즌 파일을 0건으로 덮는 게 맞다.
    sec.write_data(OUT_JSON, OUT_JS, "EARNINGS_SCOREBOARD", payload, indent=None, allow_empty=True)
    o = payload["overall"]
    print(f"{label} {start}~{end} · 발표 {o['n']}/{len(members)} · 상회 {o['beatPct']}% · 하회 {o['missPct']}% "
          f"· 중앙 서프라이즈 {o['medianSurprisePct']}% · 매출 상회 {o['revBeatPct']}%")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
