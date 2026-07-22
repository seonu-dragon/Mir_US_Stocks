#!/usr/bin/env python3
"""한국 신규 상장 / IPO 캘린더 데이터 수집 스크립트.
38커뮤니케이션(38.co.kr)에서 공모 청약 일정 및 신규 상장 일정을 파싱하여 통합 캘린더를 생성한다.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec
from briefing_store import repository_publish_lock

OUT_JSON = ROOT / "data" / "korea" / "ipo_calendar.json"
OUT_JS = ROOT / "data" / "korea" / "ipo_calendar.js"
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

URL_BIDDING = "http://www.38.co.kr/html/fund/index.htm?o=k"
URL_LISTING = "http://www.38.co.kr/html/fund/index.htm?o=nw"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}


def load_company_ticker_map() -> dict[str, str]:
    """market_snapshot.json을 읽어 회사명 -> 티커 매핑 테이블을 구축한다."""
    comp_map = {}
    try:
        snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        for s in snap.get("stocks") or []:
            name = s.get("company") or ""
            ticker = s.get("ticker") or ""
            if name and ticker:
                # 공백 및 특수문자 제거하여 비교 편의성 증대
                clean_name = name.replace("(주)", "").replace("주식회사", "").strip()
                comp_map[clean_name] = ticker
    except Exception as e:
        print(f"  [warn] Failed to load snapshot mapping: {e}")
    return comp_map


def clean_company_name(name: str) -> str:
    return name.replace("(주)", "").replace("주식회사", "").replace("(공모)", "").strip()


def find_ticker(name: str, comp_map: dict[str, str]) -> str | None:
    cleaned = clean_company_name(name)
    if cleaned in comp_map:
        return comp_map[cleaned]
    # 부분 매칭 시도
    for k, v in comp_map.items():
        if k in cleaned or cleaned in k:
            return v
    return None


def fetch_soup(url: str):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
            try:
                html = raw.decode("utf-8")
            except UnicodeDecodeError:
                html = raw.decode("cp949", errors="ignore")
            from bs4 import BeautifulSoup
            return BeautifulSoup(html, "html.parser")
    except Exception as e:
        print(f"  [error] Failed to fetch {url}: {e}")
        return None


def parse_bidding_table(soup, comp_map: dict[str, str]) -> list[dict]:
    ipos = []
    # o=k 페이지의 청약일정 테이블을 찾는다.
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) <= 5:
            continue
        first_row_cols = [td.text.strip().replace("\n", "").replace("\t", "") for td in rows[0].find_all(["th", "td"])]
        # 7개 컬럼이며 종목명과 공모일정이 헤더에 매칭되는지 검사
        if len(first_row_cols) == 7 and first_row_cols[0] == "종목명" and "공모" in first_row_cols[1]:
            # 이 테이블이 청약 일정 테이블이다.
            # Row 1부터 데이터 로우
            for r in rows[1:]:
                cols = [td.text.strip().replace("\n", "").replace("\t", "") for td in r.find_all("td")]
                if len(cols) < 6:
                    continue
                name = cols[0]
                if not name or name == "종목명" or "등록된" in name:
                    continue
                
                date_str = cols[1]  # 예: "2026.08.11~08.12"
                # 날짜가 비어있는 경우 스킵
                if not date_str or date_str == "-":
                    continue
                
                # 시작 날짜만 추출
                start_date = date_str.split("~")[0].strip()
                
                ticker = find_ticker(name, comp_map)
                ipos.append({
                    "company": name,
                    "ticker": ticker,
                    "stage": "filed",
                    "stageLabel": "공모 청약 예정",
                    "form": cols[5],  # 주관사
                    "fileDate": start_date,
                    "accession": f"kr-ipo-bidding-{name}",
                    "link": URL_BIDDING
                })
            break
    return ipos


def parse_listing_table(soup, comp_map: dict[str, str]) -> list[dict]:
    ipos = []
    # o=nw 페이지의 신규상장일정 테이블을 찾는다.
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) <= 5:
            continue
        first_row_cols = [td.text.strip().replace("\n", "").replace("\t", "") for td in rows[0].find_all(["th", "td"])]
        # 10개 컬럼이며 기업명과 신규상장 문자열이 헤더에 매칭되는지 검사
        if len(first_row_cols) == 10 and first_row_cols[0] == "기업명" and "상장" in first_row_cols[1]:
            # 이 테이블이 신규상장 완료 테이블이다.
            for r in rows[1:]:
                cols = [td.text.strip().replace("\n", "").replace("\t", "") for td in r.find_all("td")]
                if len(cols) < 9:
                    continue
                name = cols[0]
                if not name or name == "기업명" or "등록된" in name:
                    continue
                
                date_str = cols[1]  # 예: "2026/07/24"
                if not date_str or date_str == "-":
                    continue
                
                # 포맷 통일 (yyyy.mm.dd로 변환)
                clean_date = date_str.replace("/", ".").strip()
                
                ticker = find_ticker(name, comp_map)
                ipos.append({
                    "company": name,
                    "ticker": ticker,
                    "stage": "priced",
                    "stageLabel": "신규 상장 완료",
                    "form": cols[8],  # 주관사
                    "fileDate": clean_date,
                    "accession": f"kr-ipo-listed-{name}",
                    "link": URL_LISTING
                })
            break
    return ipos


def build() -> dict:
    comp_map = load_company_ticker_map()
    all_ipos = []
    
    print("  청약일정 파싱 중...")
    soup_b = fetch_soup(URL_BIDDING)
    if soup_b:
        b_ipos = parse_bidding_table(soup_b, comp_map)
        all_ipos.extend(b_ipos)
        print(f"    수집: {len(b_ipos)}건")
        
    print("  신규상장 파싱 중...")
    soup_l = fetch_soup(URL_LISTING)
    if soup_l:
        l_ipos = parse_listing_table(soup_l, comp_map)
        all_ipos.extend(l_ipos)
        print(f"    수집: {len(l_ipos)}건")
        
    # 날짜 기준 내림차순 정렬
    all_ipos.sort(key=lambda x: x["fileDate"], reverse=True)
    
    # 중복 제거 (기업명이 같은 경우 최신 항목만 남김)
    seen = set()
    unique_ipos = []
    for ipo in all_ipos:
        if ipo["company"] not in seen:
            seen.add(ipo["company"])
            unique_ipos.append(ipo)
            
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": unique_ipos[0]["fileDate"] if unique_ipos else "",
        "count": len(unique_ipos),
        "source": "38 Communication (38.co.kr)",
        "note": "국내 신규 IPO 일정 정보. 청약 예정 및 최근 신규 상장 완료 리스트.",
        "ipos": unique_ipos
    }
    return payload


def main():
    ap = argparse.ArgumentParser(description="한국 IPO 일정 수집")
    ap.add_argument("--push", action="store_true", default=False)
    args = ap.parse_args()
    
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
        
    print("=== 한국 IPO 일정 수집 시작 ===")
    payload = build()
    if not payload["ipos"]:
        print("  [경고] 수집 0건 — 기존 파일 유지(덮어쓰지 않음)")
        return
        
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "IPO_CALENDAR", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} IPOs")
        if args.push:
            sec.git_publish(["data/korea/ipo_calendar.json", "data/korea/ipo_calendar.js"], "korea ipo calendar")


if __name__ == "__main__":
    main()
