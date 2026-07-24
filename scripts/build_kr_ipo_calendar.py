#!/usr/bin/env python3
"""한국 신규 상장 / IPO 캘린더 데이터 수집 스크립트.
38커뮤니케이션(38.co.kr)에서 공모 청약 일정 및 신규 상장 일정을 파싱하여 통합 캘린더를 생성한다.
"""

from __future__ import annotations

import argparse
import json
import re
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


def parse_offer_price(text: str) -> int | None:
    """공모가 셀 → 원 단위 정수. '21,500' 처럼 명확한 단일 숫자일 때만 값을 준다.

    '-'(미확정), 빈칸, '16,500~19,500'(희망밴드) 같은 범위는 추측하지 않고 None —
    frontend 계약 필드명은 offerPrice, 값이 확실할 때만 싣는다.
    """
    t = str(text or "").replace(",", "").strip()
    if not re.fullmatch(r"\d+", t):
        return None
    value = int(t)
    return value if value > 0 else None


def parse_price_band(text: str) -> tuple[int, int] | None:
    """희망공모가 셀 '16,500~19,500' → (16500, 19500). 밴드가 아니면 None.

    확정공모가가 아직 '-' 인 행은 공모가를 모르는 게 아니라 **아직 정해지지
    않은** 것이다(수요예측 전). 중간값을 지어내지 않고 밴드 자체를 싣는다 —
    화면에서 '미확정'과 '수집 실패'를 구분할 수 있어야 한다.
    """
    t = str(text or "").replace(",", "").strip()
    m = re.fullmatch(r"(\d+)\s*~\s*(\d+)", t)
    if not m:
        return None
    low, high = int(m.group(1)), int(m.group(2))
    if low <= 0 or high < low:
        return None
    return low, high


def attach_offer_price(row: dict, fixed_cell: str, band_cell: str) -> None:
    """확정공모가 / 희망공모가 셀을 행에 정직하게 반영한다."""
    offer = parse_offer_price(fixed_cell)
    if offer is not None:
        row["offerPrice"] = offer
        return
    band = parse_price_band(band_cell)
    row["offerPricePending"] = True  # 공모가 미확정(수요예측 전)
    if band:
        row["offerPriceBand"] = [band[0], band[1]]


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
                row = {
                    "company": name,
                    "ticker": ticker,
                    "stage": "filed",
                    "stageLabel": "공모 청약 예정",
                    "form": cols[5],  # 주관사
                    "fileDate": start_date,
                    "accession": f"kr-ipo-bidding-{name}",
                    "link": URL_BIDDING
                }
                # cols[2] = 확정공모가('-' 이면 수요예측 전), cols[3] = 희망공모가 밴드
                attach_offer_price(row, cols[2] if len(cols) > 2 else "",
                                   cols[3] if len(cols) > 3 else "")
                ipos.append(row)
            break
    return ipos


def parse_listing_table(soup, comp_map: dict[str, str], underwriters=None) -> list[dict]:
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
                # cols[8] = 첫날종가. 아직 상장 전이면 '예정' 이 들어 있다 —
                # 이 표는 상장 완료분과 예정분을 함께 싣는다.
                listed = (cols[8] if len(cols) > 8 else "") != "예정"
                row = {
                    "company": name,
                    "ticker": ticker,
                    "stage": "priced" if listed else "filed",
                    "stageLabel": "신규 상장 완료" if listed else "신규 상장 예정",
                    # 이 표에는 주관사 열이 없다. 청약 표에서 같은 기업을 찾아 채운다
                    # (예전엔 cols[8](첫날종가)을 주관사 자리에 넣어 '예정'·'22,000'
                    #  같은 값이 주관사로 나갔다).
                    "form": (underwriters or {}).get(clean_company_name(name), ""),
                    "fileDate": clean_date,
                    "accession": f"kr-ipo-listed-{name}",
                    "link": URL_LISTING
                }
                # cols[4] = 공모가(원). 상장 예정 행은 '-'(미확정) 이 정상이다.
                attach_offer_price(row, cols[4] if len(cols) > 4 else "", "")
                ipos.append(row)
            break
    return ipos


def build() -> dict | None:
    """수집 결과 payload. 소스 조회에 실패하면 None(기존 파일 유지 신호)."""
    comp_map = load_company_ticker_map()
    all_ipos = []

    print("  청약일정 파싱 중...")
    soup_b = fetch_soup(URL_BIDDING)
    if not soup_b:
        return None
    b_ipos = parse_bidding_table(soup_b, comp_map)
    all_ipos.extend(b_ipos)
    print(f"    수집: {len(b_ipos)}건")

    # 신규상장 표에는 주관사·희망공모가 열이 없다. 같은 기업의 청약 행에서 가져온다.
    bidding_info = {
        clean_company_name(r["company"]): (r.get("form") or "", r.get("offerPriceBand"))
        for r in b_ipos
    }

    print("  신규상장 파싱 중...")
    soup_l = fetch_soup(URL_LISTING)
    if not soup_l:
        return None
    l_ipos = parse_listing_table(
        soup_l, comp_map, {k: v[0] for k, v in bidding_info.items()})
    for row in l_ipos:
        if row.get("offerPricePending") and not row.get("offerPriceBand"):
            band = bidding_info.get(clean_company_name(row["company"]), ("", None))[1]
            if band:
                row["offerPriceBand"] = band
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

    priced = sum(1 for r in unique_ipos if r.get("offerPrice") is not None)
    pending = sum(1 for r in unique_ipos if r.get("offerPricePending"))
    print(f"  공모가 확정 {priced}건 / 미확정(밴드만) {pending}건")

    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": unique_ipos[0]["fileDate"] if unique_ipos else "",
        "count": len(unique_ipos),
        "source": "38 Communication (38.co.kr)",
        "note": "국내 신규 IPO 일정 정보. 청약 예정 및 최근 신규 상장 완료 리스트. "
                "offerPrice(원)는 확정공모가만 싣는다. offerPricePending=true는 수요예측 전이라 "
                "공모가가 아직 없는 행이고, 있으면 offerPriceBand=[하단,상단]이 희망공모가 밴드다 "
                "(중간값을 공모가로 추정하지 않는다).",
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
    if not payload or not payload["ipos"]:
        # 소스가 죽었을 때 반쪽짜리/빈 캘린더로 덮어쓰지 않는다. 실패는 실패로
        # 알린다(상위 update_korea_data 는 check=False 라 파이프라인은 계속된다).
        print("  [경고] 소스 조회 실패 또는 수집 0건 — 기존 파일 유지(덮어쓰지 않음)")
        sys.exit(1)

    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "IPO_CALENDAR", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} IPOs")
        if args.push:
            sec.git_publish(["data/korea/ipo_calendar.json", "data/korea/ipo_calendar.js"], "korea ipo calendar")


if __name__ == "__main__":
    main()
