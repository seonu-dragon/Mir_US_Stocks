#!/usr/bin/env python3
"""국내 실적 발표 예정일 — DART '기업설명회(IR)개최' 공시 본문 파싱.

국내에는 실적 발표 예정일을 모아 주는 공개 소스가 없다. 대신 상장사가 실적 설명회(IR)를
열기 전에 내는 '기업설명회(IR)개최(안내공시)' 공시에 일시가 적혀 있다. 이 빌더는
DART `list.json`(pblntf_ty=I 거래소공시) 최근 30일에서 IR 개최 공시를 찾고, 원문
`document.xml` 의 '1. 일시' 칸에서 날짜·시각을, '개최목적'·'주요 설명회내용' 에서
실적 발표 여부를 읽는다.

한계(화면에도 한 줄로 적는다): **실적 전에 IR 을 여는 회사만 잡힌다.** 잠정실적
공시만 내는 회사(대부분의 중소형주)는 예정일을 알 수 없다. 해외 NDR·증권사 콘퍼런스
같은 비실적 IR 은 `earnings=false` 로 남기고 캘린더 '실적' 칩에는 넣지 않는다.

정정 공시([기재정정])는 같은 회사의 앞선 공시 중 목적이나 일시가 같은 것을 대체한다.
원문 파싱 결과는 접수번호별로 산출물에 남겨 다음 실행에서 다시 받지 않는다(DART 한도 절약).

실행: py scripts/build_kr_ir_schedule.py [--days 30] [--push]   (DART_API_KEY 필요)
출력: data/korea/ir_schedule.json + .js (window.KR_IR_SCHEDULE)
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
OUT_JSON = ROOT / "data" / "korea" / "ir_schedule.json"
OUT_JS = ROOT / "data" / "korea" / "ir_schedule.js"
KST = timezone(timedelta(hours=9))
LIST_URL = "https://opendart.fss.or.kr/api/list.json"
DOC_URL = "https://opendart.fss.or.kr/api/document.xml"
VIEW_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo={}"
KEEP_PAST_DAYS = 7          # 지난 IR 도 일주일은 남긴다(캘린더 이번 주 보기)
LIMIT_NOTE = "실적 전에 기업설명회(IR)를 여는 회사만 잡힙니다. 잠정실적 공시만 내는 회사는 예정일을 알 수 없습니다."

_DATE = r"(20\d{2})[-.년/]\s*(\d{1,2})[-.월/]\s*(\d{1,2})"
_TIME = r"(\d{1,2}):(\d{2})"
EARN_RE = re.compile(
    r"실적\s*(발표|설명|공개|공시)"
    r"|(\d\s*분기|[1-4]\s*Q|반기|상반기|하반기|결산|잠정|연간|FY\s*\d{2,4})[^,.;]{0,14}(실적|성과)"
    r"|earnings",
    re.I,
)


def now_kst() -> datetime:
    return datetime.now(KST)


def is_ir_notice(report_nm: str) -> bool:
    nm = re.sub(r"\s+", "", report_nm or "")
    return "기업설명회(IR)개최" in nm and "결과" not in nm


def is_correction(report_nm: str) -> bool:
    return "정정" in (report_nm or "")


def clean_text(doc: str) -> str:
    doc = re.sub(r"(?is)<style.*?</style>", " ", doc)
    txt = re.sub(r"<[^>]+>", " ", doc)
    txt = txt.replace("&amp;", "&").replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", txt).strip()


def _section(txt: str, start_pat: str, end_pat: str, limit: int = 160) -> str:
    """'3. 개최목적 … 4.' 처럼 번호 항목 사이 글자를 꺼낸다."""
    m = re.search(start_pat + r"\s*(.*?)\s*(?=" + end_pat + r")", txt)
    if not m:
        return ""
    out = m.group(1).strip(" :-")
    return out[:limit]


def parse_ir(txt: str) -> dict:
    """원문 텍스트 → {date, time, endDate, purpose, content, method}. 일시를 못 찾으면 date=None.

    유가증권(안내공시) 양식: '1. 일시 및 장소 일시 2026-09-30 13:30 장소 …'
    코스닥 양식: '1. 일시 행사일 시간(현지시간) 시작일 종료일 시작시간 종료시간 2026-09-30 2026-09-30 15:00 18:00'
    시각 미정은 '--:--' 로 온다.
    """
    out = {"date": None, "time": None, "endDate": None, "purpose": "", "content": "", "method": ""}
    m = re.search(r"1\.\s*일시(.{0,160}?)(?:2\.\s)", txt)
    block = m.group(1) if m else txt[:400]
    dates = [date(int(y), int(mo), int(d)).isoformat() for y, mo, d in re.findall(_DATE, block)
             if 1 <= int(mo) <= 12 and 1 <= int(d) <= 31]
    if dates:
        out["date"] = dates[0]
        if len(dates) > 1 and dates[1] != dates[0]:
            out["endDate"] = dates[1]
    t = re.search(_TIME, block)
    if t and 0 <= int(t.group(1)) <= 23:
        out["time"] = f"{int(t.group(1)):02d}:{t.group(2)}"
    out["purpose"] = (_section(txt, r"\d\.\s*(?:개최목적|실시목적)", r"\d{1,2}\.\s")
                      or _section(txt, r"목적", r"\d{1,2}\.\s"))
    out["content"] = _section(txt, r"\d\.\s*주요\s*(?:설명회)?\s*내용(?:\(요약\))?", r"\d{1,2}\.\s")
    out["method"] = _section(txt, r"\d\.\s*(?:개최방법|실시방법)", r"\d{1,2}\.\s", 60)
    return out


# 실적 발표 뒤에 도는 NDR·증권사 콘퍼런스는 내용에 '2분기 경영실적 설명' 이 들어 있어도 실적 발표가 아니다.
NON_RELEASE_RE = re.compile(r"Non[- ]?Deal|NDR|로드쇼|road\s*show|컨퍼런스(?!\s*콜)|콘퍼런스(?!\s*콜)|conference(?!\s*call)|Corporate\s*Day|Forum|포럼|탐방|참석|참가|간담회|이해\s*증진|이해도\s*증진|이해\s*제고", re.I)


def is_earnings_ir(parsed: dict) -> bool:
    purpose = parsed.get("purpose", "") or ""
    if EARN_RE.search(purpose):
        return True
    if NON_RELEASE_RE.search(purpose):
        return False
    return bool(EARN_RE.search(parsed.get("content", "") or ""))


def http_json(url: str, timeout: int = 30) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mir-US-Stocks/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_list(api_key: str, bgn: date, end: date) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        url = (f"{LIST_URL}?crtfc_key={api_key}&bgn_de={bgn:%Y%m%d}&end_de={end:%Y%m%d}"
               f"&pblntf_ty=I&page_count=100&page_no={page}")
        last = None
        for attempt in range(3):
            try:
                d = http_json(url)
                break
            except Exception as exc:  # 일시 장애는 재시도
                last = exc
                time.sleep(1.5 * (attempt + 1))
        else:
            raise RuntimeError(f"list.json 실패(page {page}): {last}")
        status = d.get("status")
        if status == "013":  # 조회된 데이터 없음
            return rows
        if status != "000":
            raise RuntimeError(f"list.json status {status}: {d.get('message')}")
        rows.extend(d.get("list") or [])
        if page >= int(d.get("total_page") or 1):
            return rows
        page += 1
        time.sleep(0.15)


def fetch_doc(api_key: str, rcept: str) -> str | None:
    url = f"{DOC_URL}?crtfc_key={api_key}&rcept_no={rcept}"
    for attempt in range(3):
        try:
            raw = urllib.request.urlopen(url, timeout=25).read()
            z = zipfile.ZipFile(io.BytesIO(raw))
            data = z.read(z.namelist()[0])
            for enc in ("utf-8", "euc-kr", "cp949"):
                try:
                    return data.decode(enc)
                except UnicodeDecodeError:
                    continue
            return data.decode("utf-8", "replace")
        except zipfile.BadZipFile:
            return None
        except Exception:
            time.sleep(0.8 * (attempt + 1))
    return None


def supersede(rows: list[dict]) -> list[dict]:
    """[기재정정] 공시가 같은 회사의 앞선 공시(목적 또는 일시가 같은 것)를 대체한다."""
    rows = sorted(rows, key=lambda r: r["rcept"])
    dropped = set()
    for i, r in enumerate(rows):
        if not r.get("correction"):
            continue
        for prev in rows[:i]:
            if prev["code"] != r["code"] or prev["rcept"] in dropped:
                continue
            if (prev.get("purpose") and prev.get("purpose") == r.get("purpose")) or prev.get("date") == r.get("date"):
                dropped.add(prev["rcept"])
    return [r for r in rows if r["rcept"] not in dropped]


def build(list_rows: list[dict], prev_rows: dict[str, dict], get_doc, today: date,
          prev_skip: set[str] | None = None) -> tuple[list[dict], dict, list[str]]:
    """→ (일정 행, 통계, skip). skip = 원문을 이미 읽었지만 일정이 없거나 지난 접수번호(다음 실행에서 다시 안 받음)."""
    stats = {"notices": 0, "fetched": 0, "cached": 0, "noDate": 0}
    rows: list[dict] = []
    skip: list[str] = []
    prev_skip = prev_skip or set()
    for r in list_rows:
        nm = r.get("report_nm") or ""
        code = (r.get("stock_code") or "").strip()
        if not code or not is_ir_notice(nm):
            continue
        stats["notices"] += 1
        rcept = r.get("rcept_no")
        if rcept in prev_skip:
            stats["cached"] += 1
            skip.append(rcept)
            continue
        cached = prev_rows.get(rcept)
        if cached is not None:
            stats["cached"] += 1
            row = dict(cached)
            row["earnings"] = is_earnings_ir(row)  # 분류 규칙이 바뀌면 캐시 행에도 바로 반영
        else:
            doc = get_doc(rcept)
            if doc is None:
                continue
            stats["fetched"] += 1
            parsed = parse_ir(clean_text(doc))
            row = {
                "code": code,
                "company": (r.get("corp_name") or "").strip(),
                "market": r.get("corp_cls") or "",
                "date": parsed["date"],
                "time": parsed["time"],
                "endDate": parsed["endDate"],
                "purpose": parsed["purpose"],
                "content": parsed["content"],
                "method": parsed["method"],
                "earnings": is_earnings_ir(parsed),
                "rcept": rcept,
                "filed": f"{rcept[:4]}-{rcept[4:6]}-{rcept[6:8]}",
                "correction": is_correction(nm),
                "link": VIEW_URL.format(rcept),
            }
        if not row.get("date"):
            stats["noDate"] += 1
            skip.append(rcept)
            continue
        rows.append(row)
    before = {r["rcept"] for r in rows}
    rows = supersede(rows)
    skip.extend(before - {r["rcept"] for r in rows})  # 정정 공시로 대체된 원 공시
    floor = (today - timedelta(days=KEEP_PAST_DAYS)).isoformat()
    skip.extend(r["rcept"] for r in rows if (r.get("endDate") or r["date"]) < floor)
    rows = [r for r in rows if (r.get("endDate") or r["date"]) >= floor]
    rows.sort(key=lambda r: (r["date"], r.get("time") or "99:99", r["code"]))
    return rows, stats, sorted(set(skip))


def load_prev() -> dict:
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30, help="공시 조회 기간(일)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        print("[error] DART_API_KEY 미설정 — 기존 파일 유지", file=sys.stderr)
        return 1
    today = now_kst().date()
    try:
        listing = fetch_list(api_key, today - timedelta(days=args.days), today)
    except Exception as exc:
        print(f"[error] DART 목록 조회 실패 — 기존 파일 유지: {exc}", file=sys.stderr)
        return 1
    prev = load_prev()
    prev_rows = {r["rcept"]: r for r in (prev.get("rows") or []) if isinstance(r, dict) and r.get("rcept")}

    def get_doc(rcept):
        time.sleep(0.15)
        return fetch_doc(api_key, rcept)

    rows, stats, skip = build(listing, prev_rows, get_doc, today, set(prev.get("skip") or []))
    upcoming = [r for r in rows if r["date"] >= today.isoformat()]
    payload = {
        "updatedAtKst": now_kst().strftime("%Y-%m-%d %H:%M KST"),
        "source": "DART 기업설명회(IR)개최 공시 원문",
        "note": LIMIT_NOTE,
        "window": {"from": (today - timedelta(days=args.days)).isoformat(), "to": today.isoformat()},
        "count": len(rows),
        "upcoming": len(upcoming),
        "upcomingEarnings": sum(1 for r in upcoming if r.get("earnings")),
        "stats": stats,
        "rows": rows,
        "skip": skip,
    }
    print(f"IR 공시 {stats['notices']}건(원문 {stats['fetched']} · 캐시 {stats['cached']} · 일시 없음 {stats['noDate']}) "
          f"→ 일정 {len(rows)}건, 다가오는 {len(upcoming)}건 중 실적 {payload['upcomingEarnings']}건")
    from sec_client import write_data
    # IR 공시가 없는 기간(연휴 직후 등)은 0건이 정상일 수 있다 — 목록 조회 자체가 성공했으면 쓴다.
    write_data(OUT_JSON, OUT_JS, "KR_IR_SCHEDULE", payload, indent=None, allow_empty=stats["notices"] == 0)
    print(f"→ {OUT_JSON.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)}")
    if args.push:
        from sec_client import git_publish
        rel = [str(p.relative_to(ROOT)).replace("\\", "/") for p in (OUT_JSON, OUT_JS)]
        if not git_publish(rel, "KR IR schedule"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
