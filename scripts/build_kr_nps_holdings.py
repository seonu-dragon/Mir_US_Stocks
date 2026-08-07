#!/usr/bin/env python3
"""KR 국민연금 보유 — 국민연금공단 국내주식 종목별 투자정보(공공데이터포털 파일데이터).

국민연금은 국내주식 최대 큰손(운용액 150조+)이다. 연기금이 지분 몇 %를 들고 있는지는
'장기 자금이 실제로 앉아 있는 종목'의 직접 증거라, 수급(외국인·기관 일별 순매수)과
달리 스톡(잔고) 관점의 앵커가 된다.

  https://www.data.go.kr/data/3070507/fileData.do
  - 파일데이터(CSV, 로그인·인증키 불필요). 인코딩은 EUC-KR(cp949).
  - 컬럼: 번호, 종목명, 평가액(억 원), 자산군 내 비중(%), 지분율(%).
  - **연 1회 갱신**(연말 기준, 이듬해 하반기 공개 — 현재분 기준일 2024-12-31,
    다음 갱신 예정 2026-09-30). asOf 로 기준일을 명시하고, 값이 1년 내내 같은 게
    정상이므로 check_data_freshness.py 의 나이 기반 감시에는 넣지 않는다.
  - 다운로드 식별자(atchFileId)는 연차 갱신 때 바뀌므로 매 실행 시 데이터셋
    페이지에서 다시 긁는다. 실행이 저비용이라 주간 워크플로우에 실어도 무해하다.

종목명을 KR 스냅샷 상장사명과 매칭한다. 정규화((주)·주식회사·㈜·공백·괄호 제거) 후
**완전 일치만** 인정 — 부분 일치로 엉뚱한 종목에 붙이지 않는다(데이터 정직성).
국민연금 파일은 정식 종목명이라 매칭률이 높아야 정상이다(80% 미만이면 정규화 재점검).
미매칭은 대부분 이후 상장폐지·합병 종목이다.

산출물: data/korea/nps_holdings.json + .js(window.KR_NPS_HOLDINGS). 매칭이
100건 미만이면 기존 파일 유지(정직성: 부실 데이터를 발행하지 않는다).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from briefing_store import atomic_write_text, repository_publish_lock  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "nps_holdings.json"
OUT_JS = ROOT / "data" / "korea" / "nps_holdings.js"

PAGE_URL = "https://www.data.go.kr/data/3070507/fileData.do"
DOWNLOAD_URL = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId={atch}&fileDetailSn={sn}"
UA = {"User-Agent": "Mozilla/5.0 (Mir US Stocks research; dydtjsdn@gmail.com)"}
MIN_MATCHED = 100   # 국민연금은 국내 1,000+ 종목 보유 — 이 밑이면 소스/매칭 이상

_PAREN = re.compile(r"\([^)]*\)|（[^）]*）")


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def norm_name(s: str) -> str:
    """종목명 정규화: 괄호내용·(주)·주식회사·㈜·공백 제거 후 대문자."""
    s = _PAREN.sub("", s or "")
    for token in ("주식회사", "㈜", "(주)"):
        s = s.replace(token, "")
    return re.sub(r"\s+", "", s).upper()


def fnum(v) -> float | None:
    if v in (None, "", "null"):
        return None
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def http_get(url: str, referer: str | None = None) -> bytes:
    headers = dict(UA)
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def discover_file(page_html: str) -> tuple[str, str, str | None]:
    """데이터셋 페이지에서 (atchFileId, fileDetailSn, 기준일 YYYY-MM-DD)를 찾는다."""
    m = re.search(r"atchFileId=(FILE_\d+)", page_html)
    if not m:
        raise RuntimeError("데이터셋 페이지에서 atchFileId 를 찾지 못함 — 페이지 구조 변경?")
    atch = m.group(1)
    sn_m = re.search(r"fileDetailSn=(\d+)", page_html)
    sn = sn_m.group(1) if sn_m else "1"
    # 제목 "국민연금공단_국내주식 투자정보_20241231" 에서 기준일 추출
    as_of = None
    d_m = re.search(r"국내주식[^<\"]*?_(\d{8})", page_html)
    if d_m:
        raw = d_m.group(1)
        as_of = f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return atch, sn, as_of


def decode_csv(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise RuntimeError("CSV 디코딩 실패 (utf-8/cp949 모두 아님)")


def parse_rows(text: str) -> list[dict]:
    """CSV → [{name, valueB, weightPct, stakePct}] (헤더 검증 포함)."""
    import csv
    import io

    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header or "종목명" not in "".join(header):
        raise RuntimeError(f"예상 밖 CSV 헤더: {header!r}")
    idx = {re.sub(r"[\s()]", "", h): i for i, h in enumerate(header)}

    def col(row, *keys):
        for k in keys:
            for hk, i in idx.items():
                if k in hk and i < len(row):
                    return row[i]
        return None

    rows = []
    for row in reader:
        if not row or len(row) < 2:
            continue
        name = (col(row, "종목명") or "").strip()
        if not name:
            continue
        rows.append({
            "name": name,
            "valueB": fnum(col(row, "평가액")),
            "weightPct": fnum(col(row, "비중")),
            "stakePct": fnum(col(row, "지분율")),
        })
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


def build() -> dict | None:
    page_html = http_get(PAGE_URL).decode("utf-8", errors="replace")
    atch, sn, as_of = discover_file(page_html)
    print(f"파일 식별자 {atch}/{sn}, 기준일 {as_of or '?'}")

    raw = http_get(DOWNLOAD_URL.format(atch=atch, sn=sn), referer=PAGE_URL)
    rows = parse_rows(decode_csv(raw))
    if not rows:
        return None
    print(f"CSV {len(rows)}종목 파싱")

    listed = load_listed()
    print(f"상장사 매칭 테이블 {len(listed)}개")

    holdings, unmatched = [], []
    for r in rows:
        hit = listed.get(norm_name(r["name"]))
        if not hit:
            unmatched.append(r["name"])
            continue
        holdings.append({
            "ticker": hit[0],
            "company": hit[1],
            "stakePct": r["stakePct"],
            "valueB": r["valueB"],       # 억원
            "weightPct": r["weightPct"],  # 국내주식 포트폴리오 내 비중
        })

    rate = len(holdings) / len(rows) * 100
    print(f"매칭 {len(holdings)}/{len(rows)}종목 ({rate:.1f}%) — 미매칭은 대부분 상폐·합병")
    if unmatched:
        print(f"미매칭 예시: {unmatched[:10]}")
    if len(holdings) < MIN_MATCHED:
        return None
    if rate < 80:
        print(f"[경고] 매칭률 {rate:.1f}% < 80% — 정규화 재점검 필요")

    holdings.sort(key=lambda h: h["stakePct"] or 0.0, reverse=True)

    return {
        "updatedAtKst": kst_now_str(),
        "asOf": as_of,  # 데이터 기준일(연말) — 연 1회 갱신 데이터
        "source": "국민연금공단 국내주식 투자정보(공공데이터포털, 연 1회 연말 기준)",
        "count": len(holdings),
        "holdings": holdings,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="KR 국민연금 종목별 보유내역 수집")
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    print("=== KR 국민연금 보유내역 수집 (공공데이터포털) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[nps] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print(f"[nps] 매칭 {MIN_MATCHED}건 미만 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_NPS_HOLDINGS = {compact};\n")
    print(f"보유 {payload['count']}종목 (기준일 {payload['asOf']}) → {OUT_JSON.name}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/nps_holdings.json", "data/korea/nps_holdings.js"],
                "KR NPS holdings",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
