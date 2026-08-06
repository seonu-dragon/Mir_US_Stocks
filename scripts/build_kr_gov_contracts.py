#!/usr/bin/env python3
"""KR 정부수주 — 나라장터 낙찰정보서비스(조달청, 공공데이터포털 OpenAPI).

DART 공급계약 공시가 '기업이 알린' 수주라면, 나라장터 낙찰은 '정부가 집행한' 수주다.
공시 의무(자기자본 대비 일정 비율)에 못 미치는 공공 수주까지 잡히므로 정부 매출
의존 종목의 수주 흐름을 공시보다 촘촘하게 볼 수 있다.

  http://apis.data.go.kr/1230000/as/ScsbidInfoService
  - 2024~2025 조달청 API 개편으로 구 경로(/1230000/ScsbidInfoService{,05,06})는
    전부 폐기됐다(NO_OPENAPI_SERVICE_ERROR). 현재 살아있는 경로는 /as/ 다.
  - 업무별 오퍼레이션: getScsbidListSttusThng(물품)·Servc(용역)·Cnstwk(공사).
  - 조회기간(inqryDiv=1, 등록일시 기준)은 1개월 제한 — 90일을 30일 단위로 쪼갠다.
  - 에러는 {"nkoneps.com.response.ResponseError": ...} 별도 봉투로 온다.
  - 인증키는 환경변수 DATA_GO_KR_KEY(디코딩형) — 파일에 넣지 않는다.

낙찰업체명을 KR 스냅샷 상장사명과 매칭한다. 정규화((주)·주식회사·㈜·공백·괄호 제거)
후 **완전 일치만** 인정 — 부분 일치로 엉뚱한 종목에 붙이지 않는다(데이터 정직성).
미매칭 낙찰(대부분 비상장 중소기업)은 버린다.

산출물: data/korea/gov_contracts.json + .js(window.KR_GOV_CONTRACTS). 매칭이
5건 미만이면 기존 파일 유지(정직성: 부실 데이터를 발행하지 않는다).
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "gov_contracts.json"
OUT_JS = ROOT / "data" / "korea" / "gov_contracts.js"

BASE = "http://apis.data.go.kr/1230000/as/ScsbidInfoService"
OPS = [  # (오퍼레이션, 업무 구분)
    ("getScsbidListSttusThng", "물품"),
    ("getScsbidListSttusServc", "용역"),
    ("getScsbidListSttusCnstwk", "공사"),
]
LOOKBACK_DAYS = 90
CHUNK_DAYS = 30  # API 조회기간 제한(1개월) 준수
PAGE_SIZE = 999
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}

_PAREN = re.compile(r"\([^)]*\)|（[^）]*）")


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def norm_name(s: str) -> str:
    """업체명 정규화: 괄호내용·(주)·주식회사·㈜·공백 제거 후 대문자."""
    s = _PAREN.sub("", s or "")
    for token in ("주식회사", "㈜", "(주)"):
        s = s.replace(token, "")
    return re.sub(r"\s+", "", s).upper()


def fnum(v) -> float | None:
    if v in (None, "", "null"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fetch_page(op: str, key: str, bgn: str, end: str, page: int) -> tuple[list[dict], int]:
    params = {
        "serviceKey": key,
        "pageNo": str(page),
        "numOfRows": str(PAGE_SIZE),
        "inqryDiv": "1",
        "inqryBgnDt": bgn,
        "inqryEndDt": end,
        "type": "json",
    }
    url = f"{BASE}/{op}?" + urllib.parse.urlencode(params)
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                payload = json.loads(r.read().decode("utf-8"))
            if "response" not in payload:  # 에러 봉투(ResponseError / cmmMsgHeader)
                raise RuntimeError(json.dumps(payload, ensure_ascii=False)[:300])
            body = payload["response"]["body"]
            items = body.get("items") or []
            return items, int(body.get("totalCount") or 0)
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{op} p{page} 실패: {last_err}")


def fetch_awards(key: str) -> list[dict]:
    """최근 LOOKBACK_DAYS 의 낙찰 목록(물품+용역+공사)을 전부 수집한다."""
    today = datetime.now(timezone(timedelta(hours=9))).date()
    chunks = []
    start = today - timedelta(days=LOOKBACK_DAYS)
    while start <= today:
        end = min(start + timedelta(days=CHUNK_DAYS - 1), today)
        chunks.append((start.strftime("%Y%m%d") + "0000", end.strftime("%Y%m%d") + "2359"))
        start = end + timedelta(days=1)

    rows: list[dict] = []
    seen: set[tuple] = set()
    for op, cat in OPS:
        got = 0
        for bgn, end in chunks:
            page = 1
            while True:
                items, total = fetch_page(op, key, bgn, end, page)
                for it in items:
                    dedup = (it.get("bidNtceNo"), it.get("bidNtceOrd"),
                             it.get("bidClsfcNo"), it.get("rbidNo"))
                    if dedup in seen:
                        continue
                    seen.add(dedup)
                    it["_cat"] = cat
                    rows.append(it)
                got += len(items)
                if not items or page * PAGE_SIZE >= total:
                    break
                page += 1
                time.sleep(0.1)
            time.sleep(0.1)
        print(f"  {cat}: 누적 {got}건 수집")
    return rows


def load_listed() -> dict[str, tuple[str, str]]:
    """정규화된 상장사명 → (ticker, company). 동명이 겹치면 매칭 제외(모호성 배제)."""
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    by_norm: dict[str, tuple[str, str]] = {}
    ambiguous: set[str] = set()
    for s in snap.get("stocks", []):
        name, ticker = s.get("company"), s.get("ticker")
        if not name or not ticker:
            continue
        key = norm_name(name)
        if not key:
            continue
        if key in by_norm and by_norm[key][0] != ticker:
            ambiguous.add(key)
            continue
        by_norm[key] = (ticker, name)
    for key in ambiguous:
        by_norm.pop(key, None)
    return by_norm


def build(key: str) -> dict | None:
    listed = load_listed()
    print(f"상장사 매칭 테이블 {len(listed)}개")
    rows = fetch_awards(key)
    if not rows:
        return None

    awards = []
    for r in rows:
        raw_winner = (r.get("bidwinnrNm") or "").strip()
        if not raw_winner:
            continue
        # 컨소시엄 등 복수 표기는 구분자로 쪼개 첫 매칭 업체를 대표로 삼는다.
        hit = None
        for part in re.split(r"[,/]", raw_winner):
            hit = listed.get(norm_name(part))
            if hit:
                break
        if not hit:
            continue
        date = (r.get("fnlSucsfDate") or (r.get("rlOpengDt") or "")[:10]).strip()
        if not date:
            continue
        amt = fnum(r.get("sucsfbidAmt"))
        awards.append({
            "date": date,
            "agency": (r.get("dminsttNm") or "").strip(),
            "title": (r.get("bidNtceNm") or "").strip(),
            "amountB": round(amt / 1e8, 1) if amt else None,  # 억원
            "company": hit[1],
            "ticker": hit[0],
        })

    matched = len(awards)
    print(f"낙찰 {len(rows)}건 중 상장사 매칭 {matched}건 "
          f"({matched / len(rows) * 100:.1f}%) — 미매칭은 대부분 비상장")
    if matched < 5:
        return None

    awards.sort(key=lambda a: a["date"], reverse=True)

    agg: dict[str, dict] = {}
    for a in awards:
        t = agg.setdefault(a["ticker"], {
            "ticker": a["ticker"], "company": a["company"],
            "count": 0, "totalB": 0.0, "lastDate": a["date"],
        })
        t["count"] += 1
        t["totalB"] += a["amountB"] or 0.0
        t["lastDate"] = max(t["lastDate"], a["date"])
    by_ticker = sorted(agg.values(), key=lambda t: t["totalB"], reverse=True)
    for t in by_ticker:
        t["totalB"] = round(t["totalB"], 1)

    return {
        "updatedAtKst": kst_now_str(),
        "asOf": awards[0]["date"],
        "source": "조달청 나라장터 낙찰정보서비스(공공데이터포털) · 최근 90일 물품/용역/공사",
        "awards": awards[:300],
        "byTicker": by_ticker,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== KR 정부수주 수집 (나라장터 낙찰정보) ===")
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if not key:
        print("[gov] DATA_GO_KR_KEY 미설정 — 기존 파일 유지")
        return 1
    try:
        payload = build(key)
    except Exception as e:  # noqa: BLE001
        print(f"[gov] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[gov] 매칭 낙찰 5건 미만 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_GOV_CONTRACTS = {compact};\n")
    print(f"낙찰 {len(payload['awards'])}건, 종목 {len(payload['byTicker'])}개 → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
