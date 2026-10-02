#!/usr/bin/env python3
"""국내 증권사 목표주가 상향·하향 — 같은 증권사의 직전 리포트 대비.

소스: 네이버 증권 리포트(인증 없음, build_kr_consensus.py 와 같은 호스트)
  m.stock.naver.com/api/research/company?page=N&pageSize=100   전 종목 종목분석 리포트 목록(최신순, 2021년까지)
  m.stock.naver.com/api/research/company/{researchId}          리포트 원문의 goalPrice · opinion

리포트 원문의 prevGoalPrice 는 '직전 목표가'가 아니라 작성일 종가다(build_kr_consensus.py 주석).
그래서 직전 목표가는 우리가 쌓은 리포트 이력에서 찾는다: 같은 종목·같은 증권사의 바로 앞 리포트(WINDOW_DAYS
안). 목표가가 없는 리포트(Not Rated 등)는 비교에서 빠진다. 직전 대비 3배 넘게 달라지면 액면분할·병합일
가능성이 커서 변경으로 세지 않는다(이력에는 남긴다).

상태: data/korea/target_reports_state.json (배포 제외) {"v":1,"complete":bool,"reports":{id:[code,name,broker,date,target|null,opinion]}}
  - 처음엔 WINDOW_DAYS 를 거슬러 받는다(원문 요청은 실행당 MAX_DETAIL 건까지).
  - 다 채운 뒤(complete)엔 가장 최근 리포트일 − RESCAN_DAYS 까지만 목록을 본다.
산출물
  data/korea/target_changes.{json,js}   window.KR_TARGET_CHANGES — 최근 CHANGE_DAYS 일 상향·하향 + 샤드 버전
  data/korea/target_history/NN.json     16 샤드 {"v":1,"t":{종목코드: [[날짜, 증권사, 목표가, 직전 목표가|null], ...]}}

실행: python scripts/build_kr_target_changes.py [--max-detail 12000] [--push]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from shard_store import write_shards  # noqa: E402

LIST_URL = "https://m.stock.naver.com/api/research/company?page={page}&pageSize=100"
DETAIL_URL = "https://m.stock.naver.com/api/research/company/{rid}"
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/", "Accept": "application/json"}

OUT_JSON = ROOT / "data" / "korea" / "target_changes.json"
OUT_JS = ROOT / "data" / "korea" / "target_changes.js"
STATE = ROOT / "data" / "korea" / "target_reports_state.json"
SHARD_DIR = ROOT / "data" / "korea" / "target_history"
SHARD_N = 16
WINDOW_DAYS = 365
CHANGE_DAYS = 30
RESCAN_DAYS = 14
MAX_DETAIL = 12000  # 1년치 약 9,800건을 원문 6동시로 약 3분(2026-10-02 실측)
MAX_PAGES = 200
SPLIT_RATIO = 3.0
WORKERS = 6


def get_json(url: str, retries: int = 3):
    last = None
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as exc:  # 429/5xx/네트워크
            last = exc
            time.sleep(1.0 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


def _num(v) -> float | None:
    try:
        f = float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return f if f > 0 else None


def scan_list(stop_before: str) -> list[dict]:
    """최신순 목록을 stop_before(YYYY-MM-DD) 보다 오래된 리포트가 나올 때까지 받는다."""
    out = []
    for page in range(1, MAX_PAGES + 1):
        rows = get_json(LIST_URL.format(page=page))
        if not rows:
            break
        for r in rows:
            d = str(r.get("writeDate") or "")[:10]
            if d and d >= stop_before and r.get("researchId") and r.get("itemCode"):
                out.append({"id": str(r["researchId"]), "code": str(r["itemCode"]), "name": str(r.get("itemName") or ""),
                            "broker": str(r.get("brokerName") or "").strip(), "date": d})
        last = str(rows[-1].get("writeDate") or "")[:10]
        if last and last < stop_before:
            break
    return out


def fetch_detail(entry: dict) -> tuple[str, list] | None:
    try:
        data = get_json(DETAIL_URL.format(rid=entry["id"]))
    except Exception:
        return None
    c = (data or {}).get("researchContent") or {}
    target = _num(c.get("goalPrice"))
    opinion = str(c.get("opinion") or "").strip()
    if opinion in ("없음", "N/A", "-"):
        opinion = ""
    return entry["id"], [entry["code"], entry["name"], entry["broker"], entry["date"], round(target) if target else None, opinion]


def derive(reports: dict, today: date) -> tuple[list[dict], dict]:
    """리포트 이력 → (최근 CHANGE_DAYS 일 상향·하향 목록, 종목별 이력)."""
    start = (today - timedelta(days=WINDOW_DAYS)).isoformat()
    since = (today - timedelta(days=CHANGE_DAYS)).isoformat()
    rows = sorted((v for v in reports.values() if v[4] and v[3] >= start), key=lambda v: (v[0], v[3]))
    last_by: dict[tuple, list] = {}
    history: dict[str, list] = {}
    changes = []
    for code, name, broker, d, target, opinion in rows:
        prev = last_by.get((code, broker))
        prev_t = prev[4] if prev else None
        history.setdefault(code, []).append([d, broker, target, prev_t])
        if prev_t and d >= since and target != prev_t:
            ratio = target / prev_t
            if 1 / SPLIT_RATIO < ratio < SPLIT_RATIO:
                changes.append({"date": d, "code": code, "name": name, "broker": broker, "prev": prev_t,
                                "target": target, "pct": round((ratio - 1) * 100, 1), "prevDate": prev[3],
                                **({"opinion": opinion} if opinion else {})})
        last_by[(code, broker)] = [code, name, broker, d, target, opinion]
    for code in history:
        history[code].sort(key=lambda r: r[0], reverse=True)
    changes.sort(key=lambda r: (r["date"], abs(r["pct"])), reverse=True)
    return changes, history


def load_state() -> dict:
    try:
        st = json.loads(STATE.read_text(encoding="utf-8"))
        if isinstance(st.get("reports"), dict):
            return st
    except Exception:
        pass
    return {"v": 1, "complete": False, "reports": {}}


def main():
    ap = argparse.ArgumentParser(description="국내 증권사 목표주가 상향·하향")
    ap.add_argument("--max-detail", type=int, default=MAX_DETAIL)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    today = sec.kst_today()
    state = load_state()
    reports = state["reports"]
    start = (today - timedelta(days=WINDOW_DAYS)).isoformat()
    if state.get("complete") and reports:
        newest = max(v[3] for v in reports.values())
        stop = max(start, (date.fromisoformat(newest) - timedelta(days=RESCAN_DAYS)).isoformat())
    else:
        stop = start
    listed = scan_list(stop)
    todo = [e for e in listed if e["id"] not in reports]
    capped = todo[: max(0, args.max_detail)]
    print(f"[목표가] 목록 {len(listed)}건(~{stop}) · 새 리포트 {len(todo)}건 중 {len(capped)}건 원문 요청")
    got = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for res in ex.map(fetch_detail, capped):
            if res:
                reports[res[0]] = res[1]
                got += 1
    if capped and got < len(capped) * 0.5:
        raise SystemExit(f"[중단] 원문 {got}/{len(capped)}건만 받음 — 소스 이상으로 보고 아무것도 쓰지 않는다")
    state["complete"] = len(todo) <= len(capped) and got == len(capped)
    state["reports"] = {k: v for k, v in reports.items() if v[3] >= start}
    changes, history = derive(state["reports"], today)
    with repository_publish_lock(ROOT):
        STATE.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(STATE, json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n")
        _, versions = write_shards(SHARD_DIR, "", SHARD_N, history)
        payload = {
            "updatedAtKst": sec.kst_now_str(),
            "asOf": max((v[3] for v in state["reports"].values()), default=None),
            "windowDays": CHANGE_DAYS,
            "historyDays": WINDOW_DAYS,
            "complete": state["complete"],
            "shards": SHARD_N,
            "ver": versions,
            "changes": changes,
        }
        sec.write_data(OUT_JSON, OUT_JS, "KR_TARGET_CHANGES", payload, indent=None)
        up = sum(1 for c in changes if c["pct"] > 0)
        print(f"[목표가] 리포트 {len(state['reports'])}건 · 종목 {len(history)} · 최근 {CHANGE_DAYS}일 상향 {up} · 하향 {len(changes) - up}"
              f"{'' if state['complete'] else ' · 이력 채우는 중'}")
        if args.push and not sec.git_publish(
            ["data/korea/target_changes.json", "data/korea/target_changes.js",
             "data/korea/target_reports_state.json", "data/korea/target_history"],
            "KR target price changes",
        ):
            raise SystemExit("[실패] git 게시 실패")


if __name__ == "__main__":
    main()
