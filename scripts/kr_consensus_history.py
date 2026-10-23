#!/usr/bin/env python3
"""국내 컨센서스 변화 감지 — 매일 받은 FnGuide 컨센서스를 쌓아 1주·1개월·3개월 전과 비교한다(순수 함수 + 백필 CLI).

build_kr_consensus.py 가 매 실행 끝에 부른다. 화면은 KR 컨센서스 카드의 '1개월·3개월 변화' 줄과 시장 › 시그널
'컨센서스 상향·하향(국내)' 위젯(kr-consensus-moves.js), 내 대시보드 '내 종목 목표가·의견 변경' 위젯.

## 이력(data/korea/consensus_history.json, 빌더 전용 — 배포에서 뺀다)

    {"v":1, "cols":[...], "s": {종목코드: [[처음 본 날, 마지막 본 날, 목표가, 의견점수, FY1, 매출1, 영업이익1, FY2, 매출2, 영업이익2], ...]}}

같은 값이 이어지는 동안은 한 행의 '마지막 본 날'만 늘린다(변경점 기록). 값이 바뀌거나, 관측 사이가 GAP_DAYS 일보다
벌어지면 새 행을 연다 — 못 본 날을 이어 붙여 '그동안도 같은 값이었다'고 지어내지 않는다. 종목당 MAX_ROWS 행,
RETAIN_DAYS 일보다 오래된 행은 버린다. **관측 = 이번 실행에서 실제로 받은 종목만**이다 — 직전 값 승계분(carriedSince)은
쌓지 않는다.

## 변화(consensus.json stocks[*].chg)

기준일 d(오늘 − 7/30/91일)의 값 = d 를 덮는 행의 값. 덮는 행이 없으면 d 이전 마지막 행이 d 로부터 GAP_DAYS 일
안에 끝났을 때만 그 값(주말·연휴로 관측이 빈 경우). 그보다 멀면 없음 — 그 기간 변화는 싣지 않는다.
추정 매출·영업이익은 **같은 회계연도끼리만** 비교한다(한 달 전 FY2 였던 2027 추정이 지금 FY1 이면 그 둘을 비교).

  tp1w·tp1m·tp3m  목표주가 변화율(%)           op1m·op3m  투자의견 점수 차(1~5 척도, 점)
  r1m·r3m·o1m·o3m FY1 매출·영업이익 변화율(%)   r2m·o2m    FY2 매출·영업이익 1개월 변화율(%)
  base           {"1w"|"1m"|"3m": 비교한 관측일}   fy·fy2     비교한 회계연도 라벨

변화가 0 이면 0 을 싣는다(보합). 기준값이 0 이하인 영업이익은 비율 대신 싣지 않는다(적자 → 흑자 비율은 뜻이 없다).
'변경일'은 증권사 발표일이 아니라 **감지일**(이 빌더가 처음 다른 값을 본 날)이다.

백필: `python scripts/kr_consensus_history.py --backfill-github` — GitHub 에 커밋된 consensus.json 의 과거 판(2026-09-04
이력 재작성 이후, 하루 1판)을 그 판의 updatedAtKst 날짜로 관측해 이력을 채운다. 실제로 발행됐던 값만 쓴다.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HISTORY_JSON = ROOT / "data" / "korea" / "consensus_history.json"
COLS = ["first", "last", "targetPrice", "opinionScore", "fy1", "revenue1", "operating1", "fy2", "revenue2", "operating2"]
GAP_DAYS = 6
MAX_ROWS = 60
RETAIN_DAYS = 200
PERIODS = (("1w", 7), ("1m", 30), ("3m", 91))
REPO = "seonu-dragon/Mir_US_Stocks"


def fy_label(value) -> str | None:
    """'2026.12' · '2026/12' · '2026.12(E)' → '2026.12'."""
    s = str(value or "").replace("/", ".").replace("(E)", "").strip().rstrip(".")
    return s if len(s) >= 4 and s[:4].isdigit() else None


def observe(rec: dict) -> list | None:
    """consensus.json 종목 레코드 → 관측 값 [목표가, 의견, FY1, 매출1, 영업1, FY2, 매출2, 영업2]. 승계분·빈 값은 None."""
    if not isinstance(rec, dict) or rec.get("carriedSince"):
        return None
    vals = [rec.get("targetPrice"), rec.get("opinionScore"),
            fy_label(rec.get("estimateFy")), rec.get("revenueEstimate"), rec.get("operatingEstimate"),
            fy_label(rec.get("estimateFy2")), rec.get("revenueEstimate2"), rec.get("operatingEstimate2")]
    if vals[2] is None:
        vals[3] = vals[4] = None
    if vals[5] is None:
        vals[6] = vals[7] = None
    if all(v is None for v in (vals[0], vals[1], vals[3], vals[4], vals[6], vals[7])):
        return None
    return vals


def _days(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def merge_observation(rows: list[list], day: str, vals: list) -> list[list]:
    """종목 하나의 변경점 행에 관측 하나를 더한다(날짜순 입력을 가정, 같은 날 재관측은 마지막 값이 이긴다)."""
    rows = [list(r) for r in rows or []]
    if rows:
        last = rows[-1]
        if day < last[1]:
            return rows                      # 과거 관측은 백필이 순서대로 넣는다 — 뒤섞인 입력은 버린다
        if last[2:] == vals and _days(last[1], day) <= GAP_DAYS:
            last[1] = day
            return rows
        if last[0] == day:                   # 같은 날 값이 바뀌었다 — 그날의 마지막 관측으로 바꾼다
            last[2:] = vals
            if len(rows) >= 2 and rows[-2][2:] == vals and _days(rows[-2][1], day) <= GAP_DAYS:
                rows[-2][1] = day
                rows.pop()
            return rows
    rows.append([day, day, *vals])
    return rows


def prune(rows: list[list], today: str) -> list[list]:
    cut = (date.fromisoformat(today) - timedelta(days=RETAIN_DAYS)).isoformat()
    kept = [r for r in rows if r[1] >= cut]
    return kept[-MAX_ROWS:]


def value_at(rows: list[list], day: str) -> list | None:
    """기준일 day 의 행(덮는 행 → 없으면 GAP_DAYS 안에 끝난 직전 행). 없으면 None. 같은 날 겹치면 뒤 행."""
    for r in reversed(rows):
        if r[0] <= day <= r[1]:
            return r
    prev = None
    for r in rows:
        if r[1] < day:
            prev = r
    if prev is not None and _days(prev[1], day) <= GAP_DAYS:
        return prev
    return None


def _pct(now, then) -> float | None:
    if not isinstance(now, (int, float)) or not isinstance(then, (int, float)) or then <= 0:
        return None
    return round((now / then - 1) * 100, 1)


def _est(row: list, fy: str | None, which: str):
    """행에서 회계연도 fy 의 추정치(which = 'r' 매출, 'o' 영업이익)."""
    if not fy:
        return None
    i = 0 if which == "r" else 1
    if row[4] == fy:
        return row[5 + i]
    if row[7] == fy:
        return row[8 + i]
    return None


def changes(rows: list[list], today: str) -> dict | None:
    """최신 관측(오늘 행) 대비 1주·1개월·3개월 변화. 오늘 관측이 없으면 None."""
    if not rows or rows[-1][1] != today:
        return None
    cur = rows[-1]
    out: dict = {}
    base: dict = {}
    for key, days in PERIODS:
        d = (date.fromisoformat(today) - timedelta(days=days)).isoformat()
        then = value_at(rows, d)
        if then is None:
            continue
        base[key] = min(then[1], d) if then[0] <= d <= then[1] else then[1]
        tp = _pct(cur[2], then[2])
        if tp is not None:
            out[f"tp{key}"] = tp
        if key == "1w":
            continue
        if isinstance(cur[3], (int, float)) and isinstance(then[3], (int, float)):
            out[f"op{key}"] = round(cur[3] - then[3], 2)
        fy1 = cur[4]
        r = _pct(cur[5], _est(then, fy1, "r"))
        o = _pct(cur[6], _est(then, fy1, "o"))
        if r is not None:
            out[f"r{key}"] = r
        if o is not None:
            out[f"o{key}"] = o
        if key == "1m" and cur[7]:
            r2 = _pct(cur[8], _est(then, cur[7], "r"))
            o2 = _pct(cur[9], _est(then, cur[7], "o"))
            if r2 is not None:
                out["r2m"] = r2
            if o2 is not None:
                out["o2m"] = o2
    if not out:
        return None
    if cur[4]:
        out["fy"] = cur[4]
    if cur[7] and ("r2m" in out or "o2m" in out):
        out["fy2"] = cur[7]
    out["base"] = base
    return out


def load_history(path: Path = HISTORY_JSON) -> dict:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if data.get("v") == 1 and isinstance(data.get("s"), dict):
            return data
    except Exception:
        pass
    return {"v": 1, "cols": COLS, "s": {}}


def add_snapshot(hist: dict, stocks: dict, day: str) -> int:
    """consensus.json stocks 한 판을 day 로 관측. 반환: 관측한 종목 수."""
    series = hist.setdefault("s", {})
    n = 0
    for code, rec in (stocks or {}).items():
        vals = observe(rec)
        if vals is None:
            continue
        series[code] = merge_observation(series.get(code) or [], day, vals)
        n += 1
    return n


def finalize(hist: dict, today: str, live_codes=None) -> None:
    """오래된 행·상한 정리. live_codes 를 주면 그 밖 종목(커버 이탈 RETAIN_DAYS 경과)은 행이 다 빠지면 지운다."""
    series = hist.get("s") or {}
    for code in list(series):
        rows = prune(series[code], today)
        if rows:
            series[code] = rows
        else:
            series.pop(code, None)
    hist["cols"] = COLS
    hist["through"] = today


def save_history(hist: dict, path: Path = HISTORY_JSON) -> None:
    sys.path.insert(0, str(ROOT / "scripts"))
    from briefing_store import atomic_write_text

    atomic_write_text(Path(path), json.dumps(hist, ensure_ascii=False, separators=(",", ":")) + "\n")


# ---------------------------------------------------------------------------- 백필

def _gh_json(args: list[str]):
    out = subprocess.run(["gh", "api", *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout
    return json.loads(out)


def backfill_github(path: Path = HISTORY_JSON) -> int:
    commits = []
    page = 1
    while True:
        got = _gh_json([f"repos/{REPO}/commits?path=data/korea/consensus.json&per_page=100&page={page}"])
        if not got:
            break
        commits.extend(got)
        if len(got) < 100:
            break
        page += 1
    commits.sort(key=lambda c: c["commit"]["committer"]["date"])
    print(f"[컨센서스 이력] 과거 판 {len(commits)}개")
    hist = {"v": 1, "cols": COLS, "s": {}}
    by_day: dict[str, str] = {}
    for c in commits:
        sha = c["sha"]
        url = f"https://raw.githubusercontent.com/{REPO}/{sha}/data/korea/consensus.json"
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=60) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 2:
                    print(f"  {sha[:8]} 받기 실패: {exc}")
                    payload = None
                time.sleep(2)
        if not payload:
            continue
        day = str(payload.get("updatedAtKst") or "")[:10]
        if len(day) != 10:
            continue
        n = add_snapshot(hist, payload.get("stocks") or {}, day)
        by_day[day] = sha[:8]
        print(f"  {day} {sha[:8]} 관측 {n}종목")
        del payload
    if by_day:
        finalize(hist, max(by_day))
    save_history(hist, path)
    print(f"[컨센서스 이력] {len(hist['s'])}종목 · {sum(len(v) for v in hist['s'].values())}행 · "
          f"{path.stat().st_size / 1024:.0f}KB")
    return 0


def main() -> int:
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="KR 컨센서스 이력 도구")
    ap.add_argument("--backfill-github", action="store_true", help="GitHub 에 커밋된 과거 판으로 이력을 새로 만든다")
    args = ap.parse_args()
    if args.backfill_github:
        return backfill_github()
    ap.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
