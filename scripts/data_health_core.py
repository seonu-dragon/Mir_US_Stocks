"""데이터 건강 감시 — 순수 점검 함수 (data_health_core.py)
=========================================================

`scripts/data_health_watch.py`(네트워크·파일·GitHub API 담당)가 모은 재료를 받아
판정만 한다. 여기에는 I/O 가 없다 — 테스트(scripts/tests/test_data_health_core.py)가
픽스처로 이상 유형을 하나씩 재현한다.

왜 따로 있나: Actions 가 전부 초록인데 데이터가 조용히 멈추거나 오염된 사례가 반복됐다
(continue-on-error 스텝의 커밋 실패로 KR DART 5개 파일 17일 미발행, 타임아웃 cancelled
라 신선도 관문을 건너뛴 큰 등락일 뉴스 19일 정지, 종가가 봉 고·저 밖인 종목 수백 개,
분할 미반영 +4,875% 등락). 기존 신선도 관문은 '그 워크플로우가 끝까지 돌았을 때' 만
울리고, 신뢰도 센터는 사람이 열어 봐야 보인다. 이 감시는 라이브 사이트를 매일 한 번
처음부터 끝까지 훑는다.

점검 범주(problem.category):
  freshness — 데이터셋별 기대 주기 대비 갱신 지연(주말·휴장일 차감)
  structure — 파싱 실패·빈 데이터·기준 시각 키 누락·행 수 급감·NaN 토큰
  values    — 종가가 봉 고·저 밖, 비정상 등락률, null 비율 급증, 지수 vs 구성 종목 괴리
  workflow  — 실패·중도 취소(타임아웃)·continue-on-error 로 가려진 스텝 실패
  deploy    — 레포 최신 데이터와 라이브 파일 불일치(배포 정지), 라이브 404
"""
from __future__ import annotations

import json
import math
import re
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Iterable

KST = timezone(timedelta(hours=9))

CATEGORIES = ("freshness", "structure", "values", "workflow", "deploy")
CATEGORY_LABELS = {
    "freshness": "신선도",
    "structure": "구조",
    "values": "값 이상",
    "workflow": "워크플로우",
    "deploy": "배포",
}

# check_data_freshness.TIMESTAMP_KEYS + 신뢰도 센터(source())가 읽는 키.
TIMESTAMP_KEYS = ("updatedAtKst", "updated_at_kst", "generatedAtKst", "generated", "updatedAt", "updated", "asOf")
COUNT_KEYS = ("count", "institutionCount", "tradeCount", "eventCount", "rowCount")

# ── 임계(근거는 각 주석) ─────────────────────────────────────────────
# 행 수 급감: 직전 실행 대비 절반 이하. 표본이 작은 피드(이벤트 몇 건)는 들쭉날쭉해 20행 미만은 보지 않는다.
ROW_DROP_RATIO = 0.5
ROW_DROP_MIN_PREV = 20
# null 비율: 직전 대비 10%p 이상 늘었고 지금 10% 이상일 때. 직전 값이 없으면 핵심 필드 50% 이상만.
NULL_JUMP = 0.10
NULL_FLOOR = 0.10
NULL_ABSOLUTE = 0.50
NULL_FIELDS = ("price", "changePct", "marketCapB", "volume", "rsi14", "closeSeries")
# |등락률|: US 는 update_data.flag_implausible_change 와 같은 300%(그 위인데 changePctSuspect 가 없으면 이상).
# KR 은 가격제한폭 ±30%(신규 상장 첫날만 예외라 건수로만 본다).
CHANGE_MAX = {"us": 300.0, "kr": 30.5}
CHANGE_ALERT_MIN = {"us": 1, "kr": 4}
# 지수 등락률 vs 구성 종목. 판정은 시총가중 평균으로 한다 — 중앙값은 삼성전자·SK하이닉스가 끈 날
# (2026-10-21 KOSPI +3.29%, 구성 종목 중앙값 −0.2%) 처럼 정상인데도 크게 벌어진다. 중앙값은 숫자로만 남긴다.
INDEX_GAP_MAX = 1.5
INDEX_MAP = {
    "us": (("SPY", "idx_sp500", "S&P 500"), ("QQQ", "idx_ndx100", "Nasdaq 100")),
    "kr": (("^KS11", "idx_kospi", "코스피"), ("^KQ11", "idx_kosdaq", "코스닥")),
}
INDEX_MIN_MEMBERS = 30
# 상세 일봉: 종가가 고·저 밖이면 오염(UD.drop_corrupted_last_bar 와 같은 기준, 반올림 여유 0.1%).
BAR_TOLERANCE = 0.001
BAR_RECENT = 20
BAR_BAD_RATIO = 0.005
BAR_BAD_MIN = 10
# 마지막 봉이 스냅샷 기준일보다 7일 넘게 뒤처진 상세(이월 캐시로 굳은 차트).
STALE_BAR_DAYS = 7
STALE_BAR_RATIO = 0.05
# 라이브가 레포보다 이만큼 넘게 늙었으면 배포 정지로 본다(정상 배포는 커밋 뒤 10~20분).
DEPLOY_GRACE_HOURS = 3.0
# 주말·휴장 차감은 일 단위 주기 데이터에만(주·월 주기 피드는 원래 여유가 크다).
EXCUSE_MAX_HOURS = 24 * 7


def problem(category: str, pid: str, label: str, value: str, severity: str = "error") -> dict:
    assert category in CATEGORIES, category
    return {"id": f"{category}:{pid}", "category": category, "label": label, "value": value, "severity": severity}


# ════════════════════════════════════════════════════════════════════
# 1. 대상 자동 수집 — FEATURE_DATA · market_config.js · 신뢰도 센터 프로필
# ════════════════════════════════════════════════════════════════════

def _block_after(text: str, marker: str) -> str:
    """marker 다음의 첫 `{` 부터 짝이 맞는 `}` 까지(문자열·주석 안 괄호는 무시)."""
    start = text.find(marker)
    if start < 0:
        return ""
    i = text.find("{", start)
    if i < 0:
        return ""
    depth = 0
    j = i
    quote = None
    while j < len(text):
        ch = text[j]
        if quote:
            if ch == "\\":
                j += 2
                continue
            if ch == quote:
                quote = None
        elif ch in "\"'`":
            quote = ch
        elif ch == "/" and text.startswith("//", j):
            nl = text.find("\n", j)
            j = len(text) if nl < 0 else nl
            continue
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[i + 1 : j]
        j += 1
    return ""


def parse_feature_data(js_text: str) -> dict[str, dict]:
    """feature-data.js 의 `const FEATURE_DATA = { key: { global, path, ... }, ... }`."""
    body = _block_after(js_text, "const FEATURE_DATA")
    out: dict[str, dict] = {}
    for m in re.finditer(r"^\s*([A-Za-z0-9_]+)\s*:\s*\{([^{}]*)\}", body, re.M):
        key, inner = m.group(1), m.group(2)
        meta: dict = {}
        for km in re.finditer(r"([A-Za-z0-9_]+)\s*:\s*(\"[^\"]*\"|true|false)", inner):
            k, v = km.group(1), km.group(2)
            meta[k] = v.strip('"') if v.startswith('"') else (v == "true")
        if meta.get("global") and meta.get("path"):
            out[key] = meta
    return out


def parse_market_config(js_text: str) -> dict[str, dict]:
    """market_config.js 의 시장별 id·snapshotPath·features."""
    out: dict[str, dict] = {}
    for const, mid in (("const US = {", "us"), ("const KR = {", "kr")):
        start = js_text.find(const)
        if start < 0:
            continue
        body = _block_after(js_text[start:], const[:-2])
        snap = re.search(r"snapshotPath:\s*\"([^\"]+)\"", body)
        feats_body = _block_after(body, "features:")
        feats = {k: v == "true" for k, v in re.findall(r"([A-Za-z0-9_]+)\s*:\s*(true|false)", feats_body)}
        out[mid] = {"snapshotPath": snap.group(1) if snap else None, "features": feats}
    return out


def feature_enabled(meta: dict, market: str, features: dict) -> bool:
    """feature-data.js featureDataEnabled 와 같은 판정."""
    if meta.get("usOnly"):
        return market == "us"
    if meta.get("krOnly"):
        return market == "kr"
    if meta.get("feature"):
        return features.get(meta["feature"]) is not False
    return True


def split_args(text: str) -> list[str]:
    """JS 호출 인자 문자열을 최상위 쉼표로 자른다(문자열·괄호 안 쉼표 무시)."""
    args, depth, cur, quote, i = [], 0, [], None, 0
    while i < len(text):
        ch = text[i]
        if quote:
            cur.append(ch)
            if ch == "\\" and i + 1 < len(text):
                cur.append(text[i + 1])
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in "\"'`":
            quote = ch
            cur.append(ch)
        elif ch in "([{":
            depth += 1
            cur.append(ch)
        elif ch in ")]}":
            if depth == 0:
                break
            depth -= 1
            cur.append(ch)
        elif ch == "," and depth == 0:
            args.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
        i += 1
    tail = "".join(cur).strip()
    if tail:
        args.append(tail)
    return args


def eval_hours(expr: str) -> dict[str, float] | None:
    """신뢰도 센터 maxHours 식: `72`, `24 * 40`, `cfg.id === "kr" ? 120 : 1080`."""
    expr = expr.strip()
    tern = re.fullmatch(r"cfg\.id\s*===\s*\"(us|kr)\"\s*\?\s*(.+?)\s*:\s*(.+)", expr)
    if tern:
        a, b = eval_hours(tern.group(2)), eval_hours(tern.group(3))
        if not a or not b:
            return None
        hit, other = tern.group(1), ("kr" if tern.group(1) == "us" else "us")
        return {hit: a["*"], other: b["*"]}
    if re.fullmatch(r"\d+(\.\d+)?(\s*\*\s*\d+(\.\d+)?)*", expr):
        value = 1.0
        for part in expr.split("*"):
            value *= float(part)
        return {"*": value}
    return None


def parse_trust_profiles(app_text: str) -> list[dict]:
    """app.js dataTrustSources() 의 source(name, provider, payload, keys, maxHours, cadence, featureKey, fallback, allowEmpty) 호출."""
    start = app_text.find("function dataTrustSources")
    body = app_text[start:] if start >= 0 else app_text
    end = body.find("\nfunction ", 10)
    body = body[: end if end > 0 else len(body)]
    out = []
    for m in re.finditer(r"\bsource\(", body):
        args = split_args(body[m.end():])
        if len(args) < 6:
            continue
        name = args[0].strip().strip('"')
        hours = eval_hours(args[4])
        if not hours:
            continue
        gm = re.fullmatch(r"window\.([A-Z0-9_]+)", args[2].strip())
        feature_key = args[6].strip().strip('"') if len(args) > 6 else ""
        keys = re.findall(r"\"([^\"]+)\"", args[3])
        out.append({
            "name": name,
            "global": gm.group(1) if gm else None,
            "featureKey": feature_key,
            "keys": keys,
            "maxHours": hours,
            "allowEmpty": len(args) > 8 and args[8].strip() == "true",
        })
    return out


def freshness_max_hours(checks: dict, rel_json: str) -> float | None:
    """check_data_freshness.CHECKS 에서 같은 파일의 허용 나이(가장 엄한 값)를 시간으로."""
    days = [age for group in checks.values() for (path, age, _rows) in group if path == rel_json]
    return min(days) * 24.0 if days else None


def freshness_requires_rows(checks: dict, rel_json: str) -> bool | None:
    """CHECKS 의 '0건이면 실패' 플래그. 파일이 목록에 없으면 None."""
    flags = [rows for group in checks.values() for (path, _age, rows) in group if path == rel_json]
    return any(flags) if flags else None


def resolve_datasets(
    feature_data: dict[str, dict],
    market_config: dict[str, dict],
    trust_profiles: list[dict],
    freshness_checks: dict,
    extra_paths: Iterable[str] = (),
) -> list[dict]:
    """라이브에서 서빙되는 데이터셋 목록 + 기대 주기를 만든다(하드코딩 최소화).

    주기 우선순위: 신뢰도 센터 maxHours(화면이 '갱신 지연' 을 띄우는 기준) → check_data_freshness 허용 나이.
    둘 다 없으면 maxHours=None(구조·배포 점검만 한다).
    """
    by_feature = {p["featureKey"]: p for p in trust_profiles if p["featureKey"]}
    by_global = {p["global"]: p for p in trust_profiles if p["global"]}
    snapshot_profile = next((p for p in trust_profiles if p["name"] == "시장 스냅샷"), None)
    datasets: dict[str, dict] = {}

    def add(path: str, market: str | None, key: str, global_name: str | None, profile: dict | None, kind: str):
        if path in datasets:
            return
        rel_json = re.sub(r"\.js$", ".json", path)
        hours = None
        if profile:
            hours = profile["maxHours"].get(market or "us") or profile["maxHours"].get("*")
        if hours is None:
            hours = freshness_max_hours(freshness_checks, rel_json)
        datasets[path] = {
            "path": path,
            "market": market,
            "key": key,
            "global": global_name,
            "kind": kind,
            "maxHours": hours,
            # 0행 판정: 신뢰도 센터 프로필이 있으면 그 allowEmpty, 없으면 신선도 관문의 '0건이면 실패' 플래그.
            # 둘 다 없으면 0행 자체는 문제로 보지 않고 직전 대비 급감만 본다(비수기 0건이 정상인 피드가 있다).
            "allowEmpty": (bool(profile.get("allowEmpty")) if profile
                           else not freshness_requires_rows(freshness_checks, rel_json)),
            "countKeys": list(profile["keys"]) if profile else [],
            "name": profile["name"] if profile else key,
        }

    for mid, cfg in market_config.items():
        if cfg.get("snapshotPath"):
            # 스냅샷 카드는 source() 가 아니라 리터럴 행이라 프로필이 없다 → 주기는 신선도 관문(2일).
            prof = dict(snapshot_profile, keys=["stocks"]) if snapshot_profile else None
            add(cfg["snapshotPath"], mid, f"snapshot_{mid}", None, prof, "snapshot")
            datasets[cfg["snapshotPath"]].update(allowEmpty=False, countKeys=["stocks"], name=f"{mid.upper()} 시장 스냅샷")

    for key, meta in feature_data.items():
        profile = by_feature.get(key) or by_global.get(meta["global"])
        enabled = [mid for mid, cfg in market_config.items() if feature_enabled(meta, mid, cfg.get("features") or {})]
        for mid in enabled:
            path = meta["path"]
            if meta.get("marketSpecific") and mid == "kr":
                path = "data/korea/" + path.split("/")[-1]
            # 한 시장에서만 쓰는 파일이면 그 시장 달력으로 휴장일을 뺀다(insider 는 US features 에서만 켜짐).
            market = mid if (len(enabled) == 1 or meta.get("marketSpecific")) else None
            if market is None and path.startswith("data/korea/"):
                market = "kr"
            add(path, market, key, meta["global"], profile, "feature")

    for path in extra_paths:
        add(path, "kr" if path.startswith("data/korea/") else None, path.split("/")[-1], None, None, "html")
    return sorted(datasets.values(), key=lambda d: d["path"])


# ════════════════════════════════════════════════════════════════════
# 2. 파싱·타임스탬프·행 수
# ════════════════════════════════════════════════════════════════════

class NanCounter:
    def __init__(self) -> None:
        self.count = 0

    def __call__(self, token: str) -> float:
        self.count += 1
        return float("nan")


def parse_payload(text: str, is_js: bool) -> tuple[object, int]:
    """`window.X = {...};` 또는 순수 JSON. (payload, NaN/Infinity 토큰 수). 실패하면 ValueError."""
    body = text.strip()
    if body.startswith(chr(0xFEFF)):
        body = body[1:]
    if is_js:
        while body.startswith("//") or body.startswith("/*"):   # 파일 머리 주석
            end = body.find("\n") if body.startswith("//") else body.find("*/") + 1
            body = body[end + 1:].lstrip() if end > 0 else ""
        m = re.match(r"^\s*(?:window\.[A-Za-z0-9_$]+|var\s+[A-Za-z0-9_$]+|const\s+[A-Za-z0-9_$]+)\s*=\s*", body)
        if not m:
            raise ValueError("window.<GLOBAL> = ... 형태가 아님")
        body = body[m.end():].rstrip()
        if body.endswith(";"):
            body = body[:-1]
    counter = NanCounter()
    try:
        payload = json.loads(body, parse_constant=counter)
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON 파싱 실패: {exc.msg} (line {exc.lineno})") from exc
    return payload, counter.count


def parse_stamp(value) -> datetime | None:
    """'2026-10-21 07:01 KST' · ISO(+오프셋/Z) · '2026-10-21' → KST aware datetime."""
    if not isinstance(value, str):
        return None
    s = value.strip()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2}|KST|UTC)?", s)
    if not m:
        return None
    y, mo, d, hh, mm, ss, tz = m.groups()
    try:
        dt = datetime(int(y), int(mo), int(d), int(hh or 0), int(mm or 0), int(ss or 0))
    except ValueError:
        return None
    if tz in ("Z", "UTC"):
        return dt.replace(tzinfo=timezone.utc).astimezone(KST)
    if tz and tz not in ("KST",):
        sign = 1 if tz[0] == "+" else -1
        digits = tz[1:].replace(":", "")
        offset = timedelta(hours=int(digits[:2]), minutes=int(digits[2:4] or 0)) * sign
        return dt.replace(tzinfo=timezone(offset)).astimezone(KST)
    return dt.replace(tzinfo=KST)


def payload_stamp(payload) -> tuple[str | None, datetime | None]:
    if not isinstance(payload, dict):
        return None, None
    for key in TIMESTAMP_KEYS:
        value = payload.get(key)
        parsed = parse_stamp(value)
        if parsed:
            return value, parsed
    return None, None


def row_count(payload, keys: Iterable[str] = ()) -> int | None:
    """신뢰도 센터 trustPayloadCount 와 같은 규칙: count → 지정 키 → (없으면) 최상위 컬렉션 중 가장 큰 것."""
    if isinstance(payload, list):
        return len(payload)
    if not isinstance(payload, dict):
        return None
    for key in COUNT_KEYS:
        value = payload.get(key)
        if isinstance(value, int) and not isinstance(value, bool):
            return value
    for key in keys:
        value = payload.get(key)
        if isinstance(value, (list, dict)):
            return len(value)
    sizes = [len(v) for v in payload.values() if isinstance(v, (list, dict))]
    return max(sizes) if sizes else None


# ════════════════════════════════════════════════════════════════════
# 3. 신선도 (주말·휴장 차감)
# ════════════════════════════════════════════════════════════════════

def publish_day(market: str | None, day: date, is_trading: Callable[[str, date], bool | None]) -> bool:
    """KST 날짜 day 에 새 데이터가 나와야 하는가.

    US 는 KST 아침에 전날(뉴욕) 세션을 싣는다 → day-1 이 NYSE 거래일이면 발행일.
    KR 은 그날 장 → day 가 KRX 거래일이면 발행일. 시장 무관 데이터는 매일.
    달력이 그 해를 모르면(None) 주말만 뺀다.
    """
    if market == "us":
        prev = day - timedelta(days=1)
        t = is_trading("us", prev)
        return prev.weekday() < 5 if t is None else t
    if market == "kr":
        t = is_trading("kr", day)
        return day.weekday() < 5 if t is None else t
    return True


def freshness_eval(stamp: datetime, now: datetime, max_hours: float, market: str | None,
                   is_trading: Callable[[str, date], bool | None]) -> dict:
    age = max(0.0, (now - stamp).total_seconds() / 3600.0)
    excused = 0.0
    if max_hours <= EXCUSE_MAX_HOURS and market in ("us", "kr"):
        d = stamp.astimezone(KST).date() + timedelta(days=1)
        end = now.astimezone(KST).date()
        while d <= end:
            if not publish_day(market, d, is_trading):
                excused += 24.0
            d += timedelta(days=1)
    effective = max(0.0, age - excused)
    return {"ageHours": round(age, 1), "excusedHours": excused, "effectiveHours": round(effective, 1),
            "stale": effective > max_hours}


# ════════════════════════════════════════════════════════════════════
# 4. 데이터셋 단위 점검 (신선도·구조·배포)
# ════════════════════════════════════════════════════════════════════

def check_dataset(ds: dict, live: dict, repo: dict | None, prev: dict | None, now: datetime,
                  is_trading: Callable[[str, date], bool | None]) -> tuple[dict, list[dict]]:
    """live/repo = {"status": http|None, "payload", "nan", "error"}. prev = 직전 보고서의 같은 경로 항목."""
    path = ds["path"]
    problems: list[dict] = []
    row = {"path": path, "name": ds["name"], "market": ds["market"], "maxHours": ds["maxHours"],
           "status": "ok", "stamp": None, "repoStamp": None, "rows": None}

    if live.get("status") == 404:
        repo_has = repo is not None and repo.get("payload") is not None
        problems.append(problem("deploy", f"missing:{path}", f"{path} 라이브 없음",
                                "HTTP 404" + (" · 레포에는 있음" if repo_has else "")))
        row["status"] = "missing"
        return row, problems
    if live.get("error") and path.endswith(".js") and not ds.get("maxHours") and ds.get("kind") == "html":
        # 손으로 관리하는 정적 JS(예: ticker_aliases_ko.js — JSON 이 아닌 객체 리터럴). 생성 데이터가 아니라 점검 대상 밖.
        row["status"] = "static"
        return row, problems
    if live.get("error"):
        problems.append(problem("structure", f"parse:{path}", f"{path} 읽기 실패", live["error"][:120]))
        row["status"] = "error"
        return row, problems

    payload = live.get("payload")
    raw_stamp, stamp = payload_stamp(payload)
    row["stamp"] = raw_stamp
    rows = row_count(payload, ds.get("countKeys") or [])
    row["rows"] = rows

    if live.get("nan"):
        sev = "error" if path.endswith(".json") else "warn"   # .json 은 브라우저 JSON.parse 가 통째로 실패한다
        problems.append(problem("structure", f"nan:{path}", f"{path} NaN 토큰", f"{live['nan']}개", sev))

    if stamp is None:
        problems.append(problem("structure", f"nostamp:{path}", f"{path} 기준 시각 키 없음",
                                "/".join(TIMESTAMP_KEYS[:3]), "warn"))
    elif ds.get("maxHours"):
        fe = freshness_eval(stamp, now, ds["maxHours"], ds["market"], is_trading)
        row.update(fe)
        if fe["stale"]:
            problems.append(problem("freshness", path, f"{ds['name']} ({path})",
                                    f"{fe['effectiveHours']:.0f}h / 허용 {ds['maxHours']:.0f}h"))

    prev_rows = (prev or {}).get("rows")
    dropped_to_zero = isinstance(prev_rows, int) and prev_rows >= ROW_DROP_MIN_PREV
    if rows == 0 and (not ds.get("allowEmpty") or dropped_to_zero):
        problems.append(problem("structure", f"empty:{path}", f"{path} 빈 데이터",
                                f"{prev_rows:,} → 0행" if dropped_to_zero else "0행"))
    if isinstance(prev_rows, int) and isinstance(rows, int) and prev_rows >= ROW_DROP_MIN_PREV and rows > 0:
        if rows <= prev_rows * ROW_DROP_RATIO:
            problems.append(problem("structure", f"drop:{path}", f"{path} 행 수 급감",
                                    f"{prev_rows:,} → {rows:,} ({(rows / prev_rows - 1) * 100:.0f}%)"))

    if repo is not None and repo.get("payload") is not None and stamp is not None:
        repo_raw, repo_stamp = payload_stamp(repo["payload"])
        row["repoStamp"] = repo_raw
        if repo_stamp and (repo_stamp - stamp).total_seconds() / 3600.0 > DEPLOY_GRACE_HOURS:
            lag = (repo_stamp - stamp).total_seconds() / 3600.0
            problems.append(problem("deploy", f"lag:{path}", f"{path} 라이브가 레포보다 늦음",
                                    f"라이브 {stamp:%m-%d %H:%M} · 레포 {repo_stamp:%m-%d %H:%M} ({lag:.0f}h)"))

    if problems:
        row["status"] = "problem"
    return row, problems


# ════════════════════════════════════════════════════════════════════
# 5. 스냅샷 값 점검
# ════════════════════════════════════════════════════════════════════

def _num(v) -> float | None:
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and (math.isnan(v) or math.isinf(v))) else float(v)
    return None


def null_ratios(stocks: list[dict]) -> dict[str, float]:
    n = len(stocks)
    if not n:
        return {}
    out = {}
    for field in NULL_FIELDS:
        missing = 0
        for s in stocks:
            v = s.get(field)
            if field == "closeSeries":
                missing += 0 if (isinstance(v, list) and v) else 1
            else:
                missing += 0 if _num(v) is not None else 1
        out[field] = round(missing / n, 4)
    return out


def index_divergence(market: str, snapshot: dict) -> list[dict]:
    stocks = snapshot.get("stocks") or []
    rows = []
    for symbol, group, label in INDEX_MAP.get(market, ()):
        if market == "us":
            hit = next((s for s in stocks if s.get("ticker") == symbol), None)
            idx = _num(hit.get("changePct")) if hit else None
        else:
            hit = next((i for i in (snapshot.get("indices") or []) if i.get("symbol") == symbol), None)
            idx = _num(hit.get("changePct")) if hit else None
        members = [s for s in stocks if group in (s.get("groups") or []) and not s.get("changePctSuspect")
                   and _num(s.get("changePct")) is not None]
        entry = {"symbol": symbol, "label": label, "group": group, "index": idx, "members": len(members),
                 "median": None, "capWeighted": None, "gap": None}
        if members:
            ch = [_num(s["changePct"]) for s in members]
            entry["median"] = round(statistics.median(ch), 2)
            weights = [_num(s.get("marketCapB")) or 0.0 for s in members]
            if sum(weights) > 0:
                entry["capWeighted"] = round(sum(c * w for c, w in zip(ch, weights)) / sum(weights), 2)
        if idx is not None and entry["capWeighted"] is not None:
            entry["gap"] = round(idx - entry["capWeighted"], 2)
        rows.append(entry)
    return rows


def check_snapshot_values(market: str, snapshot: dict, prev_metrics: dict | None) -> tuple[dict, list[dict]]:
    stocks = [s for s in (snapshot.get("stocks") or []) if isinstance(s, dict)]
    problems: list[dict] = []
    name = "US" if market == "us" else "KR"
    metrics: dict = {"stocks": len(stocks), "priceDate": snapshot.get("priceDate")}

    required = ["updatedAtKst", "stocks"] + (["priceDate"] if market == "us" else ["indices"])
    missing = [k for k in required if k not in snapshot]
    if missing:
        problems.append(problem("structure", f"keys:snapshot_{market}", f"{name} 스냅샷 필수 키 누락", ", ".join(missing)))
    no_ticker = sum(1 for s in stocks if not s.get("ticker"))
    if no_ticker:
        problems.append(problem("structure", f"ticker:snapshot_{market}", f"{name} 스냅샷 ticker 없는 행", f"{no_ticker}개"))

    limit = CHANGE_MAX[market]
    wild = sorted(
        (s for s in stocks if (_num(s.get("changePct")) is not None and abs(_num(s["changePct"])) > limit
                               and not s.get("changePctSuspect"))),
        key=lambda s: -abs(_num(s["changePct"])),
    )
    metrics["changeOutliers"] = len(wild)
    metrics["changeOutlierTop"] = [{"ticker": s.get("ticker"), "changePct": s.get("changePct")} for s in wild[:8]]
    metrics["changePctSuspect"] = sum(1 for s in stocks if s.get("changePctSuspect"))
    if len(wild) >= CHANGE_ALERT_MIN[market]:
        top = ", ".join(f"{s.get('ticker')} {_num(s['changePct']):+,.0f}%" for s in wild[:4])
        problems.append(problem("values", f"change:{market}", f"{name} |등락률|>{limit:g}% (의심 표시 없음)",
                                f"{len(wild)}개 · {top}"))

    ratios = null_ratios(stocks)
    metrics["nullRatios"] = ratios
    prev_ratios = (prev_metrics or {}).get("nullRatios") or {}
    for field, ratio in ratios.items():
        prev_ratio = prev_ratios.get(field)
        jumped = prev_ratio is not None and ratio - prev_ratio >= NULL_JUMP and ratio >= NULL_FLOOR
        absurd = prev_ratio is None and field in ("price", "changePct") and ratio >= NULL_ABSOLUTE
        if jumped or absurd:
            before = f"{prev_ratio:.0%} → " if prev_ratio is not None else ""
            problems.append(problem("values", f"null:{market}:{field}", f"{name} {field} 결측 비율", f"{before}{ratio:.0%}"))

    idx_rows = index_divergence(market, snapshot)
    metrics["indexCheck"] = idx_rows
    for r in idx_rows:
        if r["gap"] is not None and r["members"] >= INDEX_MIN_MEMBERS and abs(r["gap"]) > INDEX_GAP_MAX:
            problems.append(problem("values", f"index:{market}:{r['symbol']}", f"{r['label']} 등락률 vs 구성 종목",
                                    f"지수 {r['index']:+.2f}% · 시총가중 {r['capWeighted']:+.2f}% · 중앙값 {r['median']:+.2f}%"))
    return metrics, problems


# ════════════════════════════════════════════════════════════════════
# 6. 상세 일봉 점검 (종가가 고·저 밖 · 굳은 차트)
# ════════════════════════════════════════════════════════════════════

def bar_is_corrupt(bar) -> bool | None:
    """[open, high, low, close, volume, date] — 종가가 고·저 밖이면 True. 판정 불가면 None."""
    if not isinstance(bar, (list, tuple)) or len(bar) < 4:
        return None
    high, low, close = _num(bar[1]), _num(bar[2]), _num(bar[3])
    if high is None or low is None or close is None or high <= 0 or low <= 0 or close <= 0:
        return None
    return close > high * (1 + BAR_TOLERANCE) or close < low * (1 - BAR_TOLERANCE)


class DetailSweep:
    """종목 상세 파일을 하나씩 넣으면(add) 집계한다 — 메모리에 전부 올리지 않는다."""

    def __init__(self, market: str, price_date: str | None) -> None:
        self.market = market
        self.price_date = price_date
        self.files = self.with_bars = self.no_bars = self.unreadable = 0
        self.last_bad = self.recent_bad = self.stale = 0
        self.last_bad_examples: list[str] = []
        self.stale_examples: list[str] = []

    def add(self, ticker: str, payload) -> None:
        self.files += 1
        if not isinstance(payload, dict):
            self.unreadable += 1
            return
        bars = payload.get("chartSeries")
        if not isinstance(bars, list) or not bars:
            self.no_bars += 1
            return
        self.with_bars += 1
        if bar_is_corrupt(bars[-1]):
            self.last_bad += 1
            if len(self.last_bad_examples) < 8:
                self.last_bad_examples.append(ticker)
        if any(bar_is_corrupt(b) for b in bars[-BAR_RECENT:]):
            self.recent_bad += 1
        last = bars[-1]
        last_date = last[5] if isinstance(last, (list, tuple)) and len(last) > 5 and isinstance(last[5], str) else None
        if self.price_date and last_date:
            try:
                lag = (date.fromisoformat(self.price_date[:10]) - date.fromisoformat(last_date[:10])).days
            except ValueError:
                lag = 0
            if lag > STALE_BAR_DAYS:
                self.stale += 1
                if len(self.stale_examples) < 8:
                    self.stale_examples.append(ticker)

    def unreadable_add(self) -> None:
        self.files += 1
        self.unreadable += 1

    def result(self) -> tuple[dict, list[dict]]:
        name = "US" if self.market == "us" else "KR"
        metrics = {
            "files": self.files, "withBars": self.with_bars, "noBars": self.no_bars, "unreadable": self.unreadable,
            "lastBarOutsideRange": self.last_bad, "recentBarOutsideRange": self.recent_bad,
            "staleBars": self.stale, "lastBarExamples": self.last_bad_examples, "staleExamples": self.stale_examples,
        }
        problems = []
        base = max(1, self.with_bars)
        if self.last_bad >= BAR_BAD_MIN and self.last_bad / base >= BAR_BAD_RATIO:
            problems.append(problem("values", f"bars:{self.market}", f"{name} 상세 마지막 봉 종가가 고·저 밖",
                                    f"{self.last_bad:,} / {self.with_bars:,}종목 ({self.last_bad / base:.1%})"))
        if self.with_bars and self.stale / base >= STALE_BAR_RATIO:
            problems.append(problem("values", f"stalebars:{self.market}", f"{name} 상세 일봉이 {STALE_BAR_DAYS}일 넘게 멈춤",
                                    f"{self.stale:,} / {self.with_bars:,}종목 ({self.stale / base:.1%})", "warn"))
        if self.unreadable:
            problems.append(problem("structure", f"details:{self.market}", f"{name} 상세 파일 파싱 실패", f"{self.unreadable}개"))
        return metrics, problems


# ════════════════════════════════════════════════════════════════════
# 7. 워크플로우 점검
# ════════════════════════════════════════════════════════════════════

IGNORED_WORKFLOWS = {"CI"}
# 배포는 concurrency=pages 로 대기 run 이 교체되며 cancelled 가 정상이다.
CANCEL_OK_WORKFLOWS = {"Deploy Pages"}
BAD_CONCLUSIONS = {"failure", "timed_out", "startup_failure"}


def latest_runs(runs: list[dict]) -> dict[str, dict]:
    """완료된 run 중 워크플로우별 최신 하나."""
    out: dict[str, dict] = {}
    for run in sorted(runs, key=lambda r: r.get("created_at") or ""):
        if run.get("status") != "completed" or run.get("name") in IGNORED_WORKFLOWS:
            continue
        out[run["name"]] = run
    return out


def cancelled_mid_run(jobs: list[dict]) -> bool:
    """대기 중 교체(시작 전 취소)가 아니라 스텝이 돌다 끊긴 취소인가(타임아웃 포함)."""
    for job in jobs:
        if job.get("conclusion") != "cancelled":
            continue
        for step in job.get("steps") or []:
            if step.get("conclusion") == "cancelled" and step.get("started_at"):
                return True
    return False


def classify_workflows(runs: list[dict], jobs_by_run: dict, hidden_by_run: dict) -> tuple[dict, list[dict]]:
    """runs: 기간 내 run 목록. jobs_by_run[run_id] = jobs API. hidden_by_run[run_id] = [{"job", "step"}]
    (성공으로 끝난 job 안에서 실패 주석이 붙은 스텝 = continue-on-error 로 가려진 실패).

    판정은 워크플로우별 **최신 완료 run** 으로 한다 — 그 뒤 run 이 정상이면 이미 회복된 것이다.
    기간 내 같은 워크플로우의 나쁜 run 횟수는 숫자로 붙인다.
    """
    problems: list[dict] = []
    latest = latest_runs(runs)
    bad_counts: dict[str, int] = {}
    for run in runs:
        name = run.get("name")
        if run.get("status") != "completed" or name in IGNORED_WORKFLOWS:
            continue
        rid = run.get("id")
        if (run.get("conclusion") in BAD_CONCLUSIONS
                or (run.get("conclusion") == "cancelled" and name not in CANCEL_OK_WORKFLOWS
                    and cancelled_mid_run(jobs_by_run.get(rid) or []))
                or hidden_by_run.get(rid)):
            bad_counts[name] = bad_counts.get(name, 0) + 1

    summary = {"workflows": len(latest), "runs": sum(1 for r in runs if r.get("name") not in IGNORED_WORKFLOWS),
               "badRuns": sum(bad_counts.values())}
    for name, run in sorted(latest.items()):
        rid = run.get("id")
        when = (run.get("created_at") or "")[:16].replace("T", " ")
        n_bad = bad_counts.get(name, 0)
        times = f" · 기간 내 {n_bad}회" if n_bad > 1 else ""
        concl = run.get("conclusion")
        if concl in BAD_CONCLUSIONS:
            failed_jobs = [j.get("name") for j in (jobs_by_run.get(rid) or []) if j.get("conclusion") in BAD_CONCLUSIONS]
            steps = [s.get("name") for j in (jobs_by_run.get(rid) or []) for s in (j.get("steps") or [])
                     if s.get("conclusion") == "failure"]
            what = (steps or failed_jobs or [concl])[0]
            problems.append(problem("workflow", f"failed:{name}", f"{name} 실패", f"{what} · {when} UTC{times}"))
        elif concl == "cancelled" and name not in CANCEL_OK_WORKFLOWS and cancelled_mid_run(jobs_by_run.get(rid) or []):
            step = next((s.get("name") for j in (jobs_by_run.get(rid) or []) for s in (j.get("steps") or [])
                         if s.get("conclusion") == "cancelled" and s.get("started_at")), "")
            problems.append(problem("workflow", f"cancelled:{name}", f"{name} 중도 취소(타임아웃 등)",
                                    f"{step} · {when} UTC{times}"))
        hidden = hidden_by_run.get(rid) or []
        if hidden:
            steps = sorted({h.get("step") or h.get("job") or "?" for h in hidden})
            problems.append(problem("workflow", f"hidden:{name}", f"{name} 가려진 스텝 실패(continue-on-error)",
                                    f"{len(hidden)}건 · {steps[0][:80]}{' 외' if len(steps) > 1 else ''} · {when} UTC{times}"))
    return summary, problems


def failed_step_from_log(log_text: str) -> list[str]:
    """job 로그에서 `##[error]Process completed with exit code` 직전 `##[group]Run <명령>` 들."""
    out, current = [], None
    for line in log_text.splitlines():
        body = re.sub(r"^\S+Z\s", "", line)
        if body.startswith("##[group]Run "):
            current = body[len("##[group]Run "):].strip()
        elif body.startswith("##[error]Process completed with exit code") and current:
            out.append(current)
    return out


# ════════════════════════════════════════════════════════════════════
# 8. 알림 중복 억제 · 메시지 · 보고서
# ════════════════════════════════════════════════════════════════════

def select_alerts(problems: list[dict], state: dict, today: str) -> tuple[list[dict], dict]:
    """같은 문제(id)는 KST 하루 1회만. 해소된 문제는 상태에서 지운다(다시 생기면 바로 알린다)."""
    sent = dict((state or {}).get("sent") or {})
    current = {p["id"] for p in problems}
    fresh = [p for p in problems if sent.get(p["id"]) != today]
    new_sent = {pid: day for pid, day in sent.items() if pid in current}
    for p in fresh:
        new_sent[p["id"]] = today
    return fresh, {"sent": new_sent}


def _html(text: str) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def format_message(fresh: list[dict], all_problems: list[dict], run_url: str = "", limit: int = 25) -> str:
    """텔레그램 한 메시지(HTML parse_mode). 신규 문제만 나열하고 지속 중인 건 숫자로."""
    lines = [f"<b>[Mir 데이터 건강]</b> 문제 {len(all_problems)}건 · 오늘 처음 {len(fresh)}건"]
    order = {c: i for i, c in enumerate(CATEGORIES)}
    for p in sorted(fresh, key=lambda p: (order[p["category"]], p["severity"] != "error", p["label"]))[:limit]:
        lines.append(f"• [{CATEGORY_LABELS[p['category']]}] {_html(p['label'])} — {_html(p['value'])}")
    if len(fresh) > limit:
        lines.append(f"… 외 {len(fresh) - limit}건")
    ongoing = len(all_problems) - len(fresh)
    if ongoing:
        lines.append(f"(오늘 이미 알린 문제 {ongoing}건 지속)")
    if run_url:
        lines.append(_html(run_url))
    return "\n".join(lines)


def build_report(now: datetime, problems: list[dict], datasets: list[dict], snapshots: dict, details: dict,
                 workflows: dict, checks: int) -> dict:
    counts = {c: sum(1 for p in problems if p["category"] == c) for c in CATEGORIES}
    order = {c: i for i, c in enumerate(CATEGORIES)}
    return {
        "updatedAtKst": now.astimezone(KST).strftime("%Y-%m-%d %H:%M KST"),
        "status": "problem" if problems else "ok",
        "count": len(problems),
        "checks": checks,
        "counts": counts,
        "problems": sorted(problems, key=lambda p: (order[p["category"]], p["severity"] != "error", p["label"])),
        "datasets": datasets,
        "snapshots": snapshots,
        "details": details,
        "workflows": workflows,
    }
