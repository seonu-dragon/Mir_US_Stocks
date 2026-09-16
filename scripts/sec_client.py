#!/usr/bin/env python3
"""공용 SEC EDGAR 접근 유틸 (내부자/13D·G/8-K/IPO 빌드 공유).

SEC 는 자동화 접근을 금지하지 않는다 — 대신 **연락처가 담긴 정직한
User-Agent** 와 초당 10건 이하를 요구한다(sec.gov/os/webmaster-faq#developers).
예전엔 여기에 Chrome 사칭 헤더(sec-ch-ua / Sec-Fetch-*)를 실어 보냈는데,
이는 SEC 의 접근 정책에 정면으로 어긋나고 차단 시 식별도 불가능하다.
2026-09-15 에 제거했다 — 지금은 UA + 연락처만 보낸다.
"""

from __future__ import annotations

import gzip
import json
import random
import re
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
ET_TZ = ZoneInfo("America/New_York")

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"

SEC_HEADERS = {
    # SEC 가 요구하는 것은 '누구인지 알 수 있는' UA 하나다. 브라우저 사칭 금지.
    "User-Agent": "Mir-US-Stocks/1.0 (contact@seonu-dragon.xyz)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}

COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
EFTS_URL = "https://efts.sec.gov/LATEST/search-index"
REQUEST_PAUSE = 0.13  # SEC 예의상 ~8 req/s


def backoff_sleep(attempt, *, base=1.5, cap=60.0, jitter=0.25):
    """지수 백오프 대기(공용). attempt 는 1부터.

    선형 `sleep(k * attempt)` 는 429 가 걸린 뒤에도 거의 같은 속도로 다시
    때려 상대 서버의 쿨다운을 넘기지 못한다. base * 2^(attempt-1) 로 늘리고
    동시 실행이 같은 박자로 재시도하지 않도록 지터를 섞는다.
    """
    delay = min(base * (2 ** max(0, attempt - 1)), cap)
    delay += delay * jitter * random.random()
    time.sleep(delay)
    return delay


def http_get_with_backoff(url, *, headers=None, timeout=30, retries=3, label=""):
    """무키 데이터 소스용 GET — 지수 백오프 재시도 + gzip 해제. bytes 반환.

    FRED·CFTC·FINRA·Treasury·Wikimedia·USASpending 등 8개 빌더가 재시도 없이
    한 번만 요청해, 상대가 한 번 삐끗하면 그 지표가 통째로 빠진 파일을 발행했다
    (2026-09-15 감사). 403/404 는 재시도해도 소용없으니 즉시 올린다.
    """
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                return data
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            if attempt < retries:
                if label:
                    print(f"    [재시도 {attempt}/{retries - 1}] {label}: {exc}")
                backoff_sleep(attempt, base=1.0, cap=30.0)
    raise last


def sec_get(url, retries=4):
    """원시 bytes 반환. 403/404 즉시 중단, 429/5xx 지수 백오프 재시도."""
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=SEC_HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                time.sleep(REQUEST_PAUSE)
                return data
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            if attempt < retries:
                backoff_sleep(attempt)
    raise last


def sec_get_json(url):
    return json.loads(sec_get(url))


def efts_hits(forms, startdt, enddt, cap=10000):
    """efts 전문검색 히트(페이지네이션). 8-K/S-1/424B4 등 indexed form 용.

    반환: ``(hits, partial)``. ``partial=True`` 는 페이지네이션 도중 요청이
    실패해 **그 창(window)의 결과가 잘렸다**는 뜻이다. 예전에는 중간 실패를
    조용히 ``break`` 해 잘린 목록을 완결본처럼 돌려줬고, 호출부는 그 상태로
    커서(lastFileDate)를 전진시켜 빠진 공시를 영구히 잃었다. 호출부는
    partial 이면 커서를 전진시키지 말고 이전 결과와 병합하거나 exit 1 할 것.
    """
    hits = []
    frm = 0
    partial = False
    while frm < cap:
        q = urllib.parse.urlencode({
            "q": "", "forms": forms, "startdt": startdt, "enddt": enddt, "from": frm,
        })
        try:
            data = sec_get_json(f"{EFTS_URL}?{q}")
        except Exception as exc:
            print(f"    [경고] efts {forms} {startdt}~{enddt} from={frm} 실패: {exc}")
            partial = True
            break
        page = data.get("hits", {}).get("hits", [])
        if not page:
            break
        hits.extend(page)
        total = data.get("hits", {}).get("total", {}).get("value", 0)
        frm += len(page)
        if frm >= total:
            break
    else:
        # cap 에 걸려 빠져나온 경우도 '전부 받지 못한' 상태다.
        partial = True
    return hits, partial


def load_universe_tickers(top=0):
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    stocks = snap.get("stocks") or []
    if top and top > 0:
        stocks = sorted(stocks, key=lambda s: float(s.get("marketCapB") or 0), reverse=True)[:top]
    return {str(s["ticker"]).upper() for s in stocks if s.get("ticker")}


def company_ticker_maps():
    """(cik_to_ticker_all, ticker_to_cik_all) — company_tickers.json 전체."""
    ct = sec_get_json(COMPANY_TICKERS_URL)
    cik_to_ticker, ticker_to_cik = {}, {}
    for row in ct.values():
        tkr = str(row.get("ticker") or "").upper()
        cik = int(row.get("cik_str") or 0)
        if tkr and cik:
            cik_to_ticker.setdefault(cik, tkr)
            ticker_to_cik.setdefault(tkr, cik)
    return cik_to_ticker, ticker_to_cik


def universe_cik_map(top=0):
    """추적 종목 ∩ company_tickers → (issuer CIK 집합, CIK→ticker)."""
    universe = load_universe_tickers(top=top)
    cik_to_ticker_all, _ = company_ticker_maps()
    cik_to_ticker = {cik: tkr for cik, tkr in cik_to_ticker_all.items() if tkr in universe}
    return set(cik_to_ticker.keys()), cik_to_ticker


def daily_index_rows(day_iso, form_prefixes):
    """일별 form.idx 에서 주어진 폼 접두사로 시작하는 행 파싱.

    반환: [{form, name, cik, date, path}] — efts 가 누락하는 SCHEDULE 13D/G 등에 사용.
    주말/휴일은 인덱스가 없어 빈 리스트.
    """
    dt = datetime.fromisoformat(day_iso)
    qtr = (dt.month - 1) // 3 + 1
    url = (f"https://www.sec.gov/Archives/edgar/daily-index/"
           f"{dt.year}/QTR{qtr}/form.{dt.strftime('%Y%m%d')}.idx")
    try:
        text = sec_get(url).decode("latin-1")
    except Exception:
        return []
    rows = []
    prefixes = tuple(form_prefixes)
    # 줄 끝 패턴: ... <CIK> <YYYYMMDD> edgar/<path>
    tail_re = re.compile(r"\s(\d{1,10})\s+(\d{8})\s+(edgar/\S+)\s*$")
    head_re = re.compile(r"^(\S+(?: \S+)*?)\s{2,}(.*)$")
    for line in text.splitlines():
        if not line.startswith(prefixes):
            continue
        m = tail_re.search(line)
        if not m:
            continue
        cik, d8, path = m.group(1), m.group(2), m.group(3)
        head = line[:m.start()].rstrip()
        hm = head_re.match(head)
        form = hm.group(1).strip() if hm else head.strip()
        name = hm.group(2).strip() if hm else ""
        rows.append({
            "form": form, "name": name, "cik": int(cik),
            "date": f"{d8[:4]}-{d8[4:6]}-{d8[6:8]}", "path": path,
        })
    return rows


def clean_company_name(name):
    """efts display_name 끝의 '(CIK 0001234567)' 꼬리표 제거."""
    return re.sub(r"\s*\(CIK\s*\d+\)\s*$", "", str(name or "")).strip()


def kst_now_str():
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def et_today():
    return datetime.now(ET_TZ).date()


US_CLOSE_GUARD_HOUR = 16
US_CLOSE_GUARD_MINUTE = 5


def require_us_market_closed(label, *, now=None, allow_weekend=False):
    """미국 정규장 마감 전이면 SystemExit(1). 마감 후 파이프라인의 진입 가드.

    크론은 UTC 고정이라 서머타임(EDT/EST)에 따라 ET 시각이 한 시간 밀린다.
    2026-09-15 감사 실측: 20:05/20:30/20:34 UTC 크론이 겨울(EST)에는 15:05 ET —
    **장 마감 55분 전**이었고, 지금까지 무사했던 건 GitHub 크론 지연(21:57~22:34
    실측) 덕분이었다. 크론을 21시대로 옮겼지만, 지연이 반대로 당겨지거나 누가
    다시 손대는 경우를 대비해 스크립트 진입부에서도 ET 로 직접 확인한다.

    주말(토·일)은 '마감 후'가 자명하므로 통과시킨다(allow_weekend 와 무관하게
    거래일이 아니면 시각 검사를 하지 않는다).
    """
    now = now or datetime.now(ET_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=ET_TZ)
    now = now.astimezone(ET_TZ)
    if now.weekday() >= 5:  # 토·일 — 직전 거래일 마감 데이터
        return now
    limit = now.replace(hour=US_CLOSE_GUARD_HOUR, minute=US_CLOSE_GUARD_MINUTE,
                        second=0, microsecond=0)
    if now < limit:
        raise SystemExit(
            f"[중단] {label}: 현재 뉴욕 시각 {now:%Y-%m-%d %H:%M %Z} — "
            f"정규장 마감(16:00 ET) 전이다. 장중 데이터로 '마감' 산출물을 "
            f"발행하지 않는다. 크론(UTC)이 서머타임과 어긋났는지 확인할 것."
        )
    return now


SKIP_ROW_KEYS = frozenset({
    "note", "source", "policy", "detailPolicy", "updatedAtKst", "generatedAtKst",
    "generated", "updatedAt", "asOf", "count",
})


def payload_row_count(payload):
    """페이로드가 담고 있는 '건수'. 셀 수 없으면 None.

    count 키가 있으면 그것을, 없으면 최상위 list/dict 값 중 가장 큰 길이를 쓴다.
    빌더마다 rows/ipos/events/stocks... 로 키 이름이 달라 이 방식이 가장 안전하다.
    """
    if not isinstance(payload, dict):
        return None
    count = payload.get("count")
    if isinstance(count, int) and not isinstance(count, bool):
        return count
    best = None
    for key, value in payload.items():
        if key in SKIP_ROW_KEYS or not isinstance(value, (list, dict)):
            continue
        best = len(value) if best is None else max(best, len(value))
    return best


def assert_not_emptying(out_json, payload):
    """수집 0건인 페이로드로 **내용이 있던** 파일을 덮으려 하면 비정상 종료한다.

    소스가 죽은 날 빈 파일을 발행하면 사이트에서 그 기능이 통째로 사라지고, 워크플로우는
    continue-on-error 라 초록으로 끝나 아무도 모른다. 기존 파일이 없거나 원래 0건이면
    (정상적으로 비어 있는 데이터셋) 막지 않는다 — 좋은 → 빈 회귀만 잡는다.
    """
    fresh = payload_row_count(payload)
    if fresh is None or fresh > 0:
        return
    path = Path(out_json)
    if not path.exists():
        return
    try:
        prev = payload_row_count(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return
    if prev and prev > 0:
        raise SystemExit(
            f"[중단] {path.name}: 이번 실행 0건인데 기존 파일은 {prev}건 — "
            "빈 파일로 덮지 않는다. 소스를 확인할 것"
            "(정상적으로 비는 데이터면 allow_empty=True 로 명시)."
        )


def assert_not_regressing(out_json, payload, *, floor_ratio=0.70, label=None):
    """직전 산출물의 `floor_ratio` 미만으로 줄어든 결과로 덮으려 하면 중단한다.

    `assert_not_emptying` 은 0건만 잡는다. 실제 사고는 그 앞단에서 난다 — DART 가
    status 020(한도 초과)을 주기 시작하면 2,600행이 400행으로 줄어든 채 '정상'
    발행되고, 워크플로우는 초록이며 신선도 게이트도 통과한다(타임스탬프는 새것,
    0건도 아님). 절반이 사라지는 날은 발행하지 않는다.

    호출부가 **정상적으로 줄어드는** 데이터셋(조회 창이 좁아진 날 등)이면 부르지 않거나
    floor_ratio 를 낮춘다.
    """
    fresh = payload_row_count(payload)
    if fresh is None:
        return
    path = Path(out_json)
    if not path.exists():
        return
    try:
        prev = payload_row_count(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return
    if not prev or prev <= 0:
        return
    if fresh >= prev * floor_ratio:
        return
    name = label or path.name
    raise SystemExit(
        f"[중단] {name}: 이번 실행 {fresh}건 < 직전 {prev}건의 {floor_ratio:.0%} "
        f"({int(prev * floor_ratio)}건) — 소스가 반쯤 죽은 것으로 보고 덮지 않는다. "
        "DART status 020(한도 초과)·로그인 만료를 먼저 확인할 것."
    )


def kst_today():
    """KST 기준 오늘 날짜. naive `date.today()` 는 Actions(UTC)에서 하루 어긋난다."""
    return datetime.now(KST).date()


def latest_fiscal_year(now=None) -> int:
    """DART 에서 **조회 가능한** 최신 사업연도.

    사업보고서는 보통 3월 말까지 제출되므로 1~3월에는 직전 연도 보고서가 아직
    없다(전 종목 status 013). 4월 이후에만 year-1, 그 전에는 year-2 를 쓴다.
    """
    now = now or datetime.now(KST)
    return now.year - 1 if now.month >= 4 else now.year - 2


# DART 계열 회귀 게이트의 기본 하한. 한도 초과(020)·로그인 만료로 절반이 사라지는 날을
# 잡는다. 이벤트성(대량보유·주요사항보고)처럼 건수가 원래 출렁이는 데이터셋에는 쓰지 않는다.
DART_REGRESSION_FLOOR = 0.70


def write_data(out_json, out_js, js_var, payload, *, indent=2, allow_empty=False, min_ratio=None):
    """.json(빌더 상태) + .js(브라우저 전역) 쌍을 원자적으로 쓴다.

    indent=None 이면 .json 도 compact 로 쓴다 — KR DART 계열처럼 수 MB 짜리는
    pretty 로 부풀리지 않는다. .js 는 항상 compact.

    allow_empty=False(기본)이면 0건 페이로드로 기존 비어 있지 않은 파일을 덮지 않는다.
    min_ratio 를 주면 직전 대비 그 비율 미만으로 줄어든 결과도 막는다
    (assert_not_regressing — 0건이 아니라 '반쪽' 회귀를 잡는 쪽).
    """
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    from briefing_store import atomic_write_text
    if not allow_empty:
        assert_not_emptying(out_json, payload)
    if min_ratio:
        assert_not_regressing(out_json, payload, floor_ratio=min_ratio)
    if indent is None:
        json_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    else:
        json_text = json.dumps(payload, ensure_ascii=False, indent=indent)
    atomic_write_text(out_json, json_text + "\n")
    atomic_write_text(
        out_js,
        f"window.{js_var} = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
    )


def git_publish(paths, label, *, cwd=None, attempts=5, sleep_s=10.0, backoff=2.0):
    """data 경로들을 커밋·푸시. paths: 레포 루트 기준 상대경로 리스트.

    모든 빌더가 공유하는 유일한 publish 경로다(2026-09-03 통일). 예전엔 13F·내부자·
    의회·실적이력 빌더가 각자 복사본을 들고 있었고, 그 복사본들은 실패한 rebase 를
    정리하지 않아(rebase --abort 없음) 재시도가 "unmerged files" 로 전부 죽었고,
    -X theirs 도 없어 스냅샷 충돌 시 세 번 다 실패했다.

    cwd: 레포 루트(기본 ROOT). 테스트가 임시 레포를 넘긴다.
    attempts/sleep_s/backoff: 재시도 횟수, 첫 간격, 간격 배수(테스트는 sleep_s=0).
      기본 5회·10→20→40→80초. 2026-09-15 Insider trades 가 GitHub 쪽 push 500
      (Internal Server Error)을 3회·23초 안에 연달아 맞고 그날 발행을 놓쳤다 —
      서버 쪽 일시 장애는 수십 초~몇 분이라 간격을 늘려야 넘긴다.
    """
    import subprocess
    repo = Path(cwd) if cwd else ROOT
    def run(args, **kw):
        return subprocess.run(["git", *args], cwd=repo, **kw)
    if not run(["remote"], capture_output=True, text=True, check=True).stdout.strip():
        print("  [Git] 원격 없음 — 푸시 생략")
        return True
    branch = run(["branch", "--show-current"], capture_output=True, text=True, check=True).stdout.strip()
    if not branch:
        raise RuntimeError("detached HEAD")
    run(["add", "--", *paths], check=True)
    status = run(["status", "--porcelain", "--", *paths], capture_output=True, text=True, check=True)
    if status.stdout.strip():
        stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
        run(["commit", "-m", f"Auto-update {label}: {stamp}", "--", *paths], check=True)
    for attempt in range(1, attempts + 1):
        try:
            run(["fetch", "origin", branch], check=True)
            # 이 헬퍼를 쓰는 빌더는 모두 매 실행마다 데이터 파일을 통째로
            # 재생성한다. 다른 워크플로우가 먼저 push 해 충돌하면 방금 만든
            # 우리 버전을 채택한다(-X theirs 는 rebase 에서 replay 중인 로컬
            # 커밋을 가리킨다). schedule_store 와 같은 전략.
            run(["pull", "--rebase", "-X", "theirs", "origin", branch], check=True)
            run(["push", "origin", branch], check=True)
            print(f"  [Git] origin/{branch} {label} 푸시 완료")
            return True
        except Exception as error:
            # 실패한 rebase 가 중간 상태로 남으면 다음 시도의 pull 이
            # "unmerged files" 로 죽어 재시도가 전부 무의미해진다. 정리 후 재시도.
            run(["rebase", "--abort"], capture_output=True, text=True, check=False)
            if attempt < attempts:
                print(f"  [Git] 푸시 시도 {attempt} 실패: {error}")
                if sleep_s:
                    time.sleep(sleep_s * (backoff ** (attempt - 1)))
    return False


CARRY_EXPIRY_DAYS = 14
CARRIED_SINCE_KEY = "carriedSince"


def _parse_iso_date(value):
    if not isinstance(value, str):
        return None
    m = re.search(r"\d{4}-\d{2}-\d{2}", value)
    if not m:
        return None
    try:
        return date.fromisoformat(m.group(0))
    except ValueError:
        return None


def merge_previous_stocks(payload, out_json, label, key="stocks",
                          expiry_days=CARRY_EXPIRY_DAYS, *, max_rows=0):
    """이번 실행에서 못 받은 종목은 직전 산출물 값을 **기한부로** 유지한다.

    build_us_finnhub_metrics 의 prev-merge 전략과 동일 — 429 로 몇 종목 놓친
    실행이 기존 결과를 통째로 날리면 실행마다 종목이 나타났다 사라진다.
    payload[key] 는 티커→레코드 dict 여야 한다.

    **만료가 있다**: 승계된 레코드에 `carriedSince`(처음 승계된 날, KST)를 찍고,
    expiry_days 를 넘기면 버린다. 만료가 없던 시절에는 상장폐지된 종목이 영원히
    부활했고(KR 컨센서스), 얼어붙은 목표주가가 현재가 대비 괴리율로 계산돼
    화면에 남았다. 옵션 통계에서는 top60 밖으로 밀려난 종목이 만기 지난
    maxPain 을 무기한 달고 남았다(2026-09-15 감사).

    expiry_days: 승계 유지 한도(옵션 7일, 컨센서스 45일, 기본 14일).
    max_rows: 병합 후 총 행 수 상한(0=무제한). 신선한 승계분부터 남긴다.
    """
    try:
        if not out_json.exists():
            return payload
        prev = json.loads(out_json.read_text(encoding="utf-8")).get(key) or {}
        cur = payload.get(key)
        if cur is None:
            return payload
        today = datetime.now(KST).date()
        today_iso = today.isoformat()
        expired = 0
        candidates = []
        for ticker, rec in prev.items():
            if ticker in cur or not isinstance(rec, dict):
                continue
            stamp = _parse_iso_date(rec.get(CARRIED_SINCE_KEY))
            if stamp is not None and (today - stamp).days >= expiry_days:
                expired += 1
                continue
            candidates.append((stamp or today, ticker, rec))
        # 신선한 승계분부터 남긴다(상한에 걸리면 오래된 쪽을 버린다).
        candidates.sort(key=lambda row: row[0], reverse=True)
        room = len(candidates)
        if max_rows and max_rows > 0:
            room = max(0, max_rows - len(cur))
        capped = max(0, len(candidates) - room)
        kept = 0
        for _stamp, ticker, rec in candidates[:room]:
            cur[ticker] = {**rec, CARRIED_SINCE_KEY: rec.get(CARRIED_SINCE_KEY) or today_iso}
            kept += 1
        if kept:
            print(f"[{label}] 이번에 못 받은 {kept}종목은 이전 값 유지(최대 {expiry_days}일)")
        if expired:
            print(f"[{label}] {expiry_days}일 넘게 못 받은 {expired}종목은 승계를 끊었다")
        if capped:
            print(f"[{label}] 상한 {max_rows}행 초과 — 오래된 승계분 {capped}종목 제외")
    except Exception as exc:
        print(f"[{label}] 이전 파일 병합 실패(무시): {exc}")
    return payload


def merge_previous_rows(payload, out_json, label, *, rows_key="rows",
                        key_fn=None, date_key="date", keep_days=180):
    """행 리스트형 산출물에 직전 파일의 행을 합친다(최근 keep_days 일만).

    공시 창이 7일뿐인 빌더는 매 실행 '지난 7일' 로 파일을 통째로 갈아엎어서,
    라이브 실적반응이 8행까지 줄어 있었다. 키(기본: link → ticker+date)로 중복을
    제거하고 keep_days 보다 오래된 행만 떨어뜨린다.
    """
    def _default_key(row):
        return row.get("link") or f"{row.get('ticker')}|{row.get(date_key)}|{row.get('title', '')}"

    key_of = key_fn or _default_key
    rows = list(payload.get(rows_key) or [])
    try:
        path = Path(out_json)
        prev_rows = []
        if path.exists():
            prev_rows = json.loads(path.read_text(encoding="utf-8")).get(rows_key) or []
        cutoff = (datetime.now(KST).date() - timedelta(days=keep_days)).isoformat()
        seen = {key_of(r) for r in rows}
        added = 0
        for row in prev_rows:
            if not isinstance(row, dict):
                continue
            k = key_of(row)
            if k in seen:
                continue
            stamp = str(row.get(date_key) or "")[:10]
            if stamp and stamp < cutoff:
                continue
            rows.append(row)
            seen.add(k)
            added += 1
        # 이번 실행 행도 창 밖이면 떨어뜨린다(파일이 무한히 자라지 않게).
        rows = [r for r in rows if not (str(r.get(date_key) or "")[:10] and str(r.get(date_key))[:10] < cutoff)]
        if added:
            print(f"[{label}] 직전 파일에서 {added}건 승계(최근 {keep_days}일 유지) — 총 {len(rows)}건")
    except Exception as exc:
        print(f"[{label}] 직전 행 병합 실패(무시): {exc}")
    payload[rows_key] = rows
    return payload


def merge_previous_keyed_rows(payload, out_json, label, key, id_field, *,
                              expiry_days=30):
    """**id 가 있는** 리스트형 산출물의 prev-merge — 못 받은 항목만 채운다.

    merge_previous_rows 와 달리 날짜 창이 아니라 항목 식별자(id_field)로 맞춘다.
    매크로 지표·COT 시장처럼 '항목 집합이 고정'인 산출물용이다. 부분 실패가
    파일을 통째로 줄여(지표 12개 → 7개) build_market_history 가 null 을 영구
    적립하던 문제를 막는다(2026-09-15 감사). 승계분에는 ``carriedSince`` 를
    찍고 expiry_days 가 지나면 버린다.
    """
    try:
        rows = payload.get(key)
        if not isinstance(rows, list) or not Path(out_json).exists():
            return payload
        prev_rows = json.loads(Path(out_json).read_text(encoding="utf-8")).get(key) or []
        have = {r.get(id_field) for r in rows if isinstance(r, dict)}
        today = datetime.now(KST).date()
        today_iso = today.isoformat()
        kept = expired = 0
        for rec in prev_rows:
            if not isinstance(rec, dict):
                continue
            rid = rec.get(id_field)
            if rid is None or rid in have:
                continue
            stamp = _parse_iso_date(rec.get(CARRIED_SINCE_KEY))
            if stamp is not None and (today - stamp).days >= expiry_days:
                expired += 1
                continue
            rec.setdefault(CARRIED_SINCE_KEY, today_iso)
            rows.append(rec)
            kept += 1
        if kept:
            print(f"[{label}] 이번에 못 받은 {kept}개 항목은 이전 값 유지(최대 {expiry_days}일)")
        if expired:
            print(f"[{label}] 승계 만료 {expired}개 제거(>= {expiry_days}일)")
    except Exception as exc:
        print(f"[{label}] 이전 파일 병합 실패(무시): {exc}")
    return payload


def _cli():
    """워크플로우에서 쓰는 얇은 CLI — 인라인 `git pull --rebase` 를 대체한다.

        python scripts/sec_client.py --publish data/a.json data/a.js --label "..."

    빌더가 파이썬이 아닌 경우(예: build_factor_validation.mjs)에도 같은
    fetch → rebase -X theirs → push 재시도 경로를 쓰게 하기 위한 것이다.
    변경이 없으면 커밋 없이 성공으로 끝난다.
    """
    import argparse
    ap = argparse.ArgumentParser(description="data 경로 커밋·푸시(공용 publish 경로)")
    ap.add_argument("--publish", nargs="+", required=True, metavar="PATH")
    ap.add_argument("--label", required=True)
    args = ap.parse_args()
    return 0 if git_publish(args.publish, args.label) else 1


if __name__ == "__main__":
    raise SystemExit(_cli())
