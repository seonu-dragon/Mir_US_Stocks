#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GitHub Pages 배포 사후 검증 — 좀비 큐 정리 → 배포 완료 대기 → 라이브 확인.

배경(2026-09-02): 08-08 에 `queued` 로 굳은 Deploy Pages run 하나가 concurrency
group=pages 를 594시간 점유해, 그 뒤 25일간 모든 배포가 job 도 못 받고 pending →
cancelled 됐다. 데이터 워크플로우는 정상 커밋되므로 레포만 보면 멀쩡해 보였고,
라이브(today_content.json date=07-30)를 따로 봐야만 드러났다. 발행 스크립트 끝에서
이 세 가지를 자동으로 확인해 같은 장애를 몇 분 안에 잡는다.

사용:
  python scripts/verify_pages_deploy.py                 # KST 오늘 기준
  python scripts/verify_pages_deploy.py --date 2026-09-02 --wait-minutes 8
  python scripts/verify_pages_deploy.py --no-wait       # 좀비 정리 + 라이브 확인만
종료 코드: 0 = 라이브가 기대 날짜, 2 = 경고(불일치·대기 초과·gh 없음). 발행 자체는 이미
끝난 뒤라 호출자는 실패로 취급하지 말고 메시지를 보이면 된다.
"""
import argparse
import json
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # pragma: no cover
    pass

REPO = "seonu-dragon/Mir_US_Stocks"
WORKFLOW = "deploy-pages.yml"
LIVE_MANIFEST = "https://seonu-dragon.github.io/Mir_US_Stocks/data/today_content.json"
# queued 상태로 이보다 오래 머문 run 은 job 을 영원히 못 받는 좀비로 본다.
# 정상 큐 대기는 길어야 몇 분이다(러너 부족 시에도 1시간을 넘기지 않았다).
ZOMBIE_MINUTES = 60
KST = timezone(timedelta(hours=9))


def gh(*args):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return r.stdout


def gh_json(path):
    return json.loads(gh("api", path) or "null")


def parse_ts(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def sweep_zombies():
    """queued 로 ZOMBIE_MINUTES 넘게 굳은 Deploy Pages run 을 취소한다. 취소 건수를 돌려준다."""
    runs = gh_json(f"repos/{REPO}/actions/workflows/{WORKFLOW}/runs?status=queued&per_page=50")
    now = datetime.now(timezone.utc)
    cancelled = 0
    for run in (runs or {}).get("workflow_runs", []):
        age = now - parse_ts(run["created_at"])
        if age < timedelta(minutes=ZOMBIE_MINUTES):
            continue
        jobs = gh_json(f"repos/{REPO}/actions/runs/{run['id']}/jobs").get("jobs", [])
        if jobs:
            continue  # job 이 잡힌 run 은 timeout-minutes 가 알아서 끝낸다
        hours = age.total_seconds() / 3600
        print(f"  [좀비] run {run['id']} 이(가) {hours:.1f}시간째 queued(job 0개) — 취소합니다.")
        try:
            gh("api", "-X", "POST", f"repos/{REPO}/actions/runs/{run['id']}/cancel")
        except RuntimeError:
            gh("api", "-X", "POST", f"repos/{REPO}/actions/runs/{run['id']}/force-cancel")
        cancelled += 1
    return cancelled


def latest_run():
    data = gh_json(f"repos/{REPO}/actions/workflows/{WORKFLOW}/runs?per_page=1")
    runs = (data or {}).get("workflow_runs", [])
    return runs[0] if runs else None


def wait_for_deploy(minutes):
    deadline = time.monotonic() + minutes * 60
    last = None
    while True:
        run = latest_run()
        if run is None:
            print("  [배포] Deploy Pages 실행 기록이 없습니다.")
            return None
        state = f"{run['status']}/{run.get('conclusion')}"
        if state != last:
            print(f"  [배포] run {run['id']} {state}")
            last = state
        if run["status"] == "completed":
            return run
        if time.monotonic() > deadline:
            print(f"  [배포] {minutes}분 안에 끝나지 않았습니다. 좀비 큐 재확인 후 다시 실행하세요.")
            return run
        time.sleep(15)


def live_date():
    url = f"{LIVE_MANIFEST}?v={int(time.time())}"
    with urllib.request.urlopen(url, timeout=20) as resp:
        payload = json.load(resp)
        modified = resp.headers.get("Last-Modified", "")
    return payload.get("date"), modified


def main():
    ap = argparse.ArgumentParser(description="Pages 배포 사후 검증")
    ap.add_argument("--date", default=datetime.now(KST).strftime("%Y-%m-%d"), help="기대하는 today_content date (기본: KST 오늘)")
    ap.add_argument("--wait-minutes", type=float, default=8)
    ap.add_argument("--no-wait", action="store_true")
    args = ap.parse_args()

    warn = False
    try:
        gh("--version")
    except (RuntimeError, FileNotFoundError):
        print("[verify] gh CLI 가 없어 Actions 상태를 볼 수 없습니다. 라이브만 확인합니다.")
        warn = True
    else:
        try:
            n = sweep_zombies()
            print(f"[verify] 좀비 큐 정리: {n}건")
            if not args.no_wait:
                run = wait_for_deploy(args.wait_minutes)
                if run is None or run["status"] != "completed" or run.get("conclusion") != "success":
                    warn = True
        except RuntimeError as exc:
            print(f"[verify] Actions 조회 실패: {exc}")
            warn = True

    try:
        date, modified = live_date()
    except Exception as exc:  # 네트워크·CDN 문제
        print(f"[verify] 라이브 조회 실패: {exc}")
        return 2
    ok = date == args.date
    mark = "OK" if ok else "불일치"
    print(f"[verify] 라이브 today_content date={date} (기대 {args.date}) → {mark}; Last-Modified {modified}")
    if not ok:
        print("         CDN 캐시(max-age 600)면 10분 뒤 재확인, 계속 불일치면 `gh run list --status queued` 로 좀비를 찾으세요.")
    return 0 if ok and not warn else 2


if __name__ == "__main__":
    sys.exit(main())
