"""데이터 건강 감시 실행기 (data_health_watch.py)
================================================

라이브 사이트에서 실제로 서빙되는 데이터셋 전부를 하루 한 번 훑고, 문제가 있으면
텔레그램 한 메시지로 요약한다(같은 문제는 KST 하루 1회). 결과는 매번
`data/health_report.json/.js`(window.MIR_DATA_HEALTH)로 발행해 데이터 신뢰도 센터의
'데이터 건강' 섹션이 읽는다. 판정 로직은 전부 `data_health_core.py`(순수 함수)에 있다.

대상은 하드코딩하지 않는다:
  - feature-data.js 의 FEATURE_DATA(시장별 features·usOnly/krOnly/marketSpecific 반영)
  - market_config.js 의 snapshotPath(US·KR 스냅샷)
  - index.html·analysis.html 의 `<script src="data/...">` 태그
  - 기대 주기: app.js 신뢰도 센터 source() 의 maxHours → 없으면 check_data_freshness.CHECKS

사용:
  py scripts/data_health_watch.py --dry-run          # 텔레그램 대신 메시지 출력, 알림 상태 안 바꿈
  py scripts/data_health_watch.py --push             # Actions: 보고서·상태 커밋·푸시 + 텔레그램
  옵션: --skip-details(상세 일봉 전수 생략) --skip-workflows(GitHub API 생략) --days N(워크플로우 기간)

종료 코드: 문제를 '찾은 것' 은 정상 종료(0)다. 감시 자체가 실패하면 1 —
  라이브 요청 다수가 네트워크 오류, GitHub API 실패, 텔레그램 전송 실패, git push 실패.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import data_health_core as core  # noqa: E402

KST = core.KST
LIVE_BASE = "https://seonu-dragon.github.io/Mir_US_Stocks/"
REPO = os.environ.get("GITHUB_REPOSITORY") or "seonu-dragon/Mir_US_Stocks"
OUT_JSON = ROOT / "data" / "health_report.json"
OUT_JS = ROOT / "data" / "health_report.js"
STATE_PATH = ROOT / "data" / "health_alert_state.json"   # 배포 제외(deploy-pages.yml)
JS_GLOBAL = "MIR_DATA_HEALTH"
NET_ERROR_MAX_RATIO = 0.3
UA = "Mir-data-health-watch/1.0 (+https://github.com/seonu-dragon/Mir_US_Stocks)"


class WatchFailure(RuntimeError):
    """감시 자체의 실패 — exit 1."""


# ── 대상 수집 ─────────────────────────────────────────────────────────

def html_data_paths() -> list[str]:
    paths: set[str] = set()
    for page in ("index.html", "analysis.html"):
        f = ROOT / page
        if f.exists():
            for m in re.finditer(r"<script[^>]+src=\"(data/[^\"?]+)", f.read_text(encoding="utf-8")):
                paths.add(m.group(1))
    return sorted(paths)


def load_targets() -> list[dict]:
    from check_data_freshness import CHECKS
    feature_data = core.parse_feature_data((ROOT / "feature-data.js").read_text(encoding="utf-8"))
    market_cfg = core.parse_market_config((ROOT / "market_config.js").read_text(encoding="utf-8"))
    profiles = core.parse_trust_profiles((ROOT / "app.js").read_text(encoding="utf-8"))
    if not feature_data or not market_cfg or not profiles:
        raise WatchFailure(f"대상 수집 실패: FEATURE_DATA {len(feature_data)} · 시장 {len(market_cfg)} · 프로필 {len(profiles)}")
    targets = core.resolve_datasets(feature_data, market_cfg, profiles, CHECKS, html_data_paths())
    # 자기 산출물은 빼고 본다 — 이번 실행이 곧 다시 쓰는 파일이고, 감시가 멈춘 것은 신뢰도 센터의
    # '점검 지연' 표시와 cron-watchdog(놓친 예약 재실행·알림)가 잡는다.
    own = str(OUT_JS.relative_to(ROOT)).replace("\\", "/")
    return [t for t in targets if t["path"] != own]


# ── 거래일 달력 ───────────────────────────────────────────────────────

def trading_calendar(today: date):
    """(market, day) → True/False/None. exchange_calendars(XNYS·XKRX)가 있으면 그것, 없으면
    US 는 us_market_calendar(NYSE 휴장 하드코딩), KR 은 주말 + market_calendar.json 휴장."""
    sessions: dict[str, set[str]] = {}
    try:
        import exchange_calendars as xcals
        for mid, code in (("us", "XNYS"), ("kr", "XKRX")):
            cal = xcals.get_calendar(code)
            start = max(cal.first_session.date(), today - timedelta(days=60))
            end = min(cal.last_session.date(), today + timedelta(days=7))
            sessions[mid] = {d.date().isoformat() for d in cal.sessions_in_range(start.isoformat(), end.isoformat())}
    except Exception as exc:   # 의존성 없는 로컬 — 폴백 달력
        print(f"[달력] exchange_calendars 사용 불가({type(exc).__name__}) — 폴백 달력")
    kr_holidays: set[str] = set()
    try:
        cal_json = json.loads((ROOT / "data" / "market_calendar.json").read_text(encoding="utf-8"))
        kr_holidays = {e["date"] for e in cal_json.get("events", []) if e.get("market") == "kr" and e.get("kind") == "holiday"}
    except Exception:
        pass
    import us_market_calendar as usc

    def is_trading(market: str, day: date):
        known = sessions.get(market)
        if known is not None:
            return day.isoformat() in known
        if market == "us":
            return usc.is_trading_day(day)
        if day.weekday() >= 5:
            return False
        return day.isoformat() not in kr_holidays
    return is_trading


# ── HTTP ─────────────────────────────────────────────────────────────

def http_get(url: str, headers: dict | None = None, timeout: int = 60, retries: int = 2) -> tuple[int, bytes]:
    last: Exception | None = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (404, 410):
                return exc.code, b""
            last = exc
        except Exception as exc:  # 네트워크 오류
            last = exc
        time.sleep(2 * (attempt + 1))
    raise ConnectionError(f"{url}: {last}")


def fetch_live(path: str, base: str, bust: str) -> dict:
    try:
        status, body = http_get(f"{base}{path}?hc={bust}", headers={"Cache-Control": "no-cache"})
    except ConnectionError as exc:
        return {"status": None, "netError": str(exc)[:200]}
    if status != 200:
        return {"status": status}
    return parse_body(path, body, status)


def parse_body(path: str, body: bytes, status=200) -> dict:
    try:
        payload, nan = core.parse_payload(body.decode("utf-8"), path.endswith(".js"))
    except (ValueError, UnicodeDecodeError) as exc:
        return {"status": status, "error": str(exc)}
    return {"status": status, "payload": payload, "nan": nan}


def read_repo(path: str) -> dict | None:
    f = ROOT / path
    if not f.exists():
        return None
    return parse_body(path, f.read_bytes())


# ── GitHub Actions ────────────────────────────────────────────────────

def gh_token() -> str:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token
    try:
        out = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, timeout=20)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:
        pass
    raise WatchFailure("GitHub 토큰 없음(GITHUB_TOKEN/GH_TOKEN/gh auth) — 워크플로우 점검 불가")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # 로그 다운로드 URL 로 인증 헤더를 넘기지 않는다
        return None


def gh_api(path: str, token: str, raw: bool = False):
    url = f"https://api.github.com/{path.lstrip('/')}"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"})
    opener = urllib.request.build_opener(_NoRedirect) if raw else urllib.request.build_opener()
    for attempt in range(3):
        try:
            with opener.open(req, timeout=60) as resp:
                body = resp.read()
                return body if raw else json.loads(body)
        except urllib.error.HTTPError as exc:
            if raw and exc.code in (301, 302, 303, 307, 308):
                status, body = http_get(exc.headers["Location"], timeout=60)
                return body
            if exc.code in (403, 429, 500, 502, 503) and attempt < 2:
                time.sleep(5 * (attempt + 1))
                continue
            raise WatchFailure(f"GitHub API {path}: HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            if attempt < 2:
                time.sleep(5)
                continue
            raise WatchFailure(f"GitHub API {path}: {exc}") from exc
    raise WatchFailure(f"GitHub API {path}: 재시도 소진")


def collect_workflows(days: int) -> tuple[dict, list[dict]]:
    token = gh_token()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    runs: list[dict] = []
    for page in range(1, 11):
        data = gh_api(f"repos/{REPO}/actions/runs?branch=main&per_page=100&page={page}&created=%3E%3D{since}", token)
        batch = data.get("workflow_runs") or []
        runs.extend(batch)
        if len(batch) < 100:
            break
    latest = core.latest_runs(runs)
    # 최신 run 만 jobs·주석을 받는다(판정이 최신 run 기준). 기간 내 나쁜 run '횟수' 는 실패·취소 run 의
    # jobs 를 추가로 받아 센다(성공 run 의 가려진 실패 횟수는 최신 run 만 본다 — API 호출을 아끼려고).
    want = {r["id"] for r in latest.values()}
    want |= {r["id"] for r in runs if r.get("conclusion") == "cancelled" and r.get("name") not in core.CANCEL_OK_WORKFLOWS
             and r.get("name") not in core.IGNORED_WORKFLOWS}
    jobs_by_run: dict = {}
    hidden_by_run: dict = {}
    for rid in sorted(want):
        jobs = gh_api(f"repos/{REPO}/actions/runs/{rid}/jobs?per_page=100", token).get("jobs") or []
        jobs_by_run[rid] = jobs
        if rid not in {r["id"] for r in latest.values()}:
            continue
        for job in jobs:
            if job.get("conclusion") != "success":
                continue
            notes = gh_api(f"repos/{REPO}/check-runs/{job['id']}/annotations?per_page=100", token)
            failures = [a for a in notes if a.get("annotation_level") == "failure"]
            if not failures:
                continue
            steps: list[str] = []
            try:
                log = gh_api(f"repos/{REPO}/actions/jobs/{job['id']}/logs", token, raw=True)
                steps = core.failed_step_from_log(log.decode("utf-8", "replace"))
            except Exception as exc:  # 로그 만료 등 — 주석 개수만으로도 문제는 성립한다
                print(f"[워크플로우] job {job['id']} 로그 읽기 실패: {exc}")
            for i, _note in enumerate(failures):
                hidden_by_run.setdefault(rid, []).append(
                    {"job": job.get("name"), "step": steps[i] if i < len(steps) else (steps[-1] if steps else job.get("name"))})
    summary, problems = core.classify_workflows(runs, jobs_by_run, hidden_by_run)
    summary["days"] = days
    return summary, problems


# ── 상세 일봉 전수 ────────────────────────────────────────────────────

def sweep_details(market: str, price_date: str | None) -> tuple[dict, list[dict]]:
    folder = ROOT / ("data/details" if market == "us" else "data/korea/details")
    sweep = core.DetailSweep(market, price_date)
    for f in sorted(folder.glob("*.json")):
        try:
            payload = json.loads(f.read_bytes())
        except Exception:
            sweep.unreadable_add()
            continue
        sweep.add(f.stem, payload)
    metrics, problems = sweep.result()
    metrics["source"] = "repo"
    return metrics, problems


# ── 알림 ─────────────────────────────────────────────────────────────

def send_telegram(text: str) -> None:
    sys.path.insert(0, str(ROOT / "scripts" / "briefings" / "common"))
    from telegram_bot import send_telegram_message  # 기존 헬퍼(HTML·토큰 가림·재시도)
    if not (os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID")):
        print("[알림] TELEGRAM_BOT_TOKEN/CHAT_ID 없음 — 전송 생략")
        return
    if not send_telegram_message(text):
        raise WatchFailure("텔레그램 전송 실패")


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


# ── 메인 ─────────────────────────────────────────────────────────────

def run(args) -> int:
    now = datetime.now(KST)
    today = now.date()
    targets = load_targets()
    print(f"[대상] {len(targets)}개 데이터셋 (주기 등록 {sum(1 for t in targets if t['maxHours'])}개)")
    prev = load_json(OUT_JSON)
    prev_rows = {d["path"]: d for d in (prev.get("datasets") or []) if isinstance(d, dict) and d.get("path")}
    is_trading = trading_calendar(today)

    bust = str(int(time.time()))
    with ThreadPoolExecutor(max_workers=8) as pool:
        lives = dict(zip([t["path"] for t in targets], pool.map(lambda t: fetch_live(t["path"], args.base, bust), targets)))
    net_errors = [p for p, r in lives.items() if r.get("netError")]
    if len(net_errors) > len(targets) * NET_ERROR_MAX_RATIO:
        raise WatchFailure(f"라이브 요청 {len(net_errors)}/{len(targets)}개 네트워크 오류 — 예: {lives[net_errors[0]]['netError']}")

    problems: list[dict] = []
    rows: list[dict] = []
    checks = 0
    for t in targets:
        live = lives[t["path"]]
        if live.get("netError"):
            problems.append(core.problem("deploy", f"net:{t['path']}", f"{t['path']} 라이브 요청 실패", live["netError"][:100], "warn"))
            continue
        row, found = core.check_dataset(t, live, read_repo(t["path"]), prev_rows.get(t["path"]), now, is_trading)
        rows.append(row)
        problems.extend(found)
        checks += 4

    snapshots: dict = {}
    details: dict = {}
    for t in targets:
        if t["kind"] != "snapshot":
            continue
        payload = lives[t["path"]].get("payload")
        if not isinstance(payload, dict):
            continue
        market = t["market"]
        metrics, found = core.check_snapshot_values(market, payload, (prev.get("snapshots") or {}).get(market))
        snapshots[market] = metrics
        problems.extend(found)
        checks += 4
        if not args.skip_details:
            started = time.time()
            d_metrics, d_found = sweep_details(market, payload.get("priceDate"))
            print(f"[상세] {market} {d_metrics['files']:,}개 {time.time() - started:.0f}초 · 고·저 밖 마지막 봉 "
                  f"{d_metrics['lastBarOutsideRange']:,} · 멈춘 차트 {d_metrics['staleBars']:,}")
            details[market] = d_metrics
            problems.extend(d_found)
            checks += 3

    workflows: dict = {}
    if not args.skip_workflows:
        workflows, found = collect_workflows(args.days)
        problems.extend(found)
        checks += workflows.get("workflows", 0)

    report = core.build_report(now, problems, rows, snapshots, details, workflows, checks)
    state = load_json(STATE_PATH)
    fresh, new_state = core.select_alerts(problems, state, today.isoformat())
    run_url = ""
    if os.environ.get("GITHUB_RUN_ID"):
        run_url = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{REPO}/actions/runs/{os.environ['GITHUB_RUN_ID']}"

    print(f"\n[결과] 문제 {len(problems)}건 · " + " · ".join(
        f"{core.CATEGORY_LABELS[c]} {report['counts'][c]}" for c in core.CATEGORIES))
    for p in report["problems"]:
        print(f"  - [{core.CATEGORY_LABELS[p['category']]}/{p['severity']}] {p['label']} — {p['value']}")

    if not args.no_write:
        sys.path.insert(0, str(ROOT / "scripts"))
        import sec_client as sec
        sec.write_data(OUT_JSON, OUT_JS, JS_GLOBAL, report, indent=1, allow_empty=True)
        print(f"[발행] {OUT_JSON.relative_to(ROOT)} · {OUT_JS.relative_to(ROOT)}")

    if fresh:
        message = core.format_message(fresh, problems, run_url)
        if args.dry_run:
            print("\n[텔레그램 드라이런] 보낼 메시지:\n" + message)
        else:
            send_telegram(message)
            print(f"[알림] 텔레그램 전송 — 신규 {len(fresh)}건")
    else:
        print("[알림] 보낼 신규 문제 없음" + (" (오늘 이미 알림)" if problems else ""))

    if not args.dry_run:
        STATE_PATH.write_text(json.dumps(new_state, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    if args.push:
        from briefing_store import repository_publish_lock
        import sec_client as sec
        paths = ["data/health_report.json", "data/health_report.js", "data/health_alert_state.json"]
        with repository_publish_lock(ROOT):
            if not sec.git_publish(paths, "data health report"):
                raise WatchFailure("git push 실패")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="데이터 건강 감시")
    ap.add_argument("--dry-run", action="store_true", help="텔레그램 대신 메시지 출력, 알림 상태 파일 안 바꿈")
    ap.add_argument("--push", action="store_true", help="보고서·상태 커밋·푸시")
    ap.add_argument("--no-write", action="store_true", help="보고서 파일을 쓰지 않음")
    ap.add_argument("--skip-details", action="store_true", help="상세 일봉 전수 생략")
    ap.add_argument("--skip-workflows", action="store_true", help="GitHub Actions 점검 생략")
    ap.add_argument("--days", type=int, default=3, help="워크플로우 점검 기간(일)")
    ap.add_argument("--base", default=LIVE_BASE, help="라이브 사이트 주소")
    args = ap.parse_args()
    if not args.base.endswith("/"):
        args.base += "/"
    try:
        return run(args)
    except WatchFailure as exc:
        print(f"\n[감시 실패] {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
