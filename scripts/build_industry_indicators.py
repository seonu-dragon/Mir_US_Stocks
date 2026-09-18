#!/usr/bin/env python3
"""산업·매크로 선행지표 터미널 — 수집·분석 빌더 (P0-a, 새 키 0개).

기획서: mir_design/INDUSTRY_INDICATORS_DESIGN.md (1장 P0 표·3장 스키마·8장 정직성 규약).
원천 4곳만 쓴다 — 전부 키가 없거나 이미 Actions secret 에 있는 것이다.

  FRED   fredgraph.csv (키 없음, 식별 UA 필수 — 브라우저 UA 는 연결이 끊긴다)
  TWSE   openapi.twse.com.tw/v1/opendata/t187ap05_L   상장사 최신월 매출 (키 없음)
  TPEx   www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O 장외 최신월 매출 (키 없음, 필드 동일)
  ECOS   한국은행 (ECOS_API_KEY — 기존 secret)
  OECD   sdmx.oecd.org 경기선행지수 CSV (키 없음)

TWSE·TPEx 는 **최신월만** 주므로 data/industry_archive/tw_<코드>.json 에 월별로 적립한다
(같은 달은 덮어쓰지 않고 skip). 같은 행에 실린 '상월 매출'·'요년동월 매출'도 공식 숫자라
아직 없는 달이면 seeded 표식을 붙여 함께 적립한다 — 첫 실행부터 YoY 가 나온다.

분석 값(YoY·MoM·기간 등락·5년 통계·동월 비교·신호등·다음 발표일·역인덱스)은 **전부 여기서
계산**해 JSON 에 싣는다. 브라우저(industry.js)는 그리기만 한다.

빌드 게이트(하나라도 걸리면 exit 1, 기존 파일 유지):
  - 지표 ID 중복·카테고리/related_indicators 의 미정의 ID 참조
  - related_tickers·sector_etfs 가 data/details/<T>.json · data/korea/details/<코드>.json 에 없음
    (큐레이션 표는 사람이 쓰는 정적 데이터라 조용한 누락이 곧 방치다 — 매 빌드에 돈다)
  - 수집된 지표가 MIN_INDICATORS 미만
시리즈별 stale 게이트(최신 관측일이 기대 주기 × 2 를 넘음)는 그 지표만 실패 처리하고
직전 산출물의 값을 carriedSince 와 함께 승계한다(최대 CARRY_DAYS).

산출물(전부 .json + .js 쌍):
  data/industry_indicators.json  window.INDUSTRY_INDICATORS  카테고리·지표·시계열·분석값
  data/industry_by_ticker.json   window.INDUSTRY_BY_TICKER   {티커/코드: [지표 ID…]} 역인덱스
  data/industry_signal.json      window.INDUSTRY_SIGNAL      카테고리별 개선/악화/보합 개수
  data/industry_calendar.json    window.INDUSTRY_CALENDAR    향후 30일 발표 일정

사용: py scripts/build_industry_indicators.py [--push] [--only fred,twse,ecos,oecd]
"""

from __future__ import annotations

import argparse
import bisect
import csv
import io
import json
import math
import os
import ssl
import statistics
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: F401 (계약: 원자 쓰기)
import sec_client as sec

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT_JSON = DATA / "industry_indicators.json"
OUT_JS = DATA / "industry_indicators.js"
BY_TICKER_JSON = DATA / "industry_by_ticker.json"
BY_TICKER_JS = DATA / "industry_by_ticker.js"
SIGNAL_JSON = DATA / "industry_signal.json"
SIGNAL_JS = DATA / "industry_signal.js"
CALENDAR_JSON = DATA / "industry_calendar.json"
CALENDAR_JS = DATA / "industry_calendar.js"
ARCHIVE_DIR = DATA / "industry_archive"
DETAILS_US = DATA / "details"
DETAILS_KR = DATA / "korea" / "details"
MACRO_JSON = DATA / "macro_indicators.json"

KST = timezone(timedelta(hours=9))
UA_IDENT = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
UA_BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              "Accept": "application/json,text/csv,*/*"}

MIN_INDICATORS = 10
CARRY_DAYS = 30
HISTORY_YEARS = 10
SERIES_CAP = {"D": 750, "W": 520, "M": 120, "Q": 60}
# 최신 관측일이 이보다 오래되면 stale — 기대 주기 × 2 에 발표 지연(월간 통계는 익월 중순,
# IMF 원자재는 한 달)을 더한 값. 지표 정의의 stale_days 로 덮어쓸 수 있다.
STALE_DAYS = {"D": 21, "W": 35, "M": 100, "Q": 220}
PERF_HORIZONS = [("1D", 1), ("1W", 7), ("1M", 30), ("3M", 91), ("6M", 182), ("YTD", None), ("1Y", 365), ("3Y", 1095)]
PERF_ALLOWED = {"D": {"1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y"},
                "W": {"1W", "1M", "3M", "6M", "YTD", "1Y", "3Y"},
                "M": {"1M", "3M", "6M", "YTD", "1Y", "3Y"},
                "Q": {"3M", "6M", "YTD", "1Y", "3Y"}}
TW_ARCHIVE_KEEP = 240
# 기간 등락의 기준점이 목표일보다 이만큼 넘게 앞서면 그 칸은 None(주기 × 1.5 안팎).
PERF_TOLERANCE_DAYS = {"D": 7, "W": 12, "M": 47, "Q": 140}

PUBLIC = {"redistribution": "public", "note": "미국 연방 정부 저작물", "commercial_ok": True}
FRED_ATTR = {"redistribution": "attribution", "note": "Source: FRED, Federal Reserve Bank of St. Louis", "commercial_ok": True}
THIRD_PARTY = {"redistribution": "restricted", "note": "FRED 경유 제3자 시리즈 — 원 저작권자 표기, CSV 내보내기 없음", "commercial_ok": False}
TW_OGDL = {"redistribution": "attribution", "note": "TWSE/TPEx OpenAPI — 대만 정부자료 개방 라이선스", "commercial_ok": True}
ECOS_ATTR = {"redistribution": "attribution", "note": "한국은행 ECOS — 출처 표기, 가공 시 가공 사실 표기", "commercial_ok": True}
OECD_ATTR = {"redistribution": "attribution", "note": "OECD — 출처 표기 시 자유 재이용", "commercial_ok": True}
CC_BY = {"redistribution": "attribution", "note": "Indeed Hiring Lab (CC BY 4.0) — FRED 경유", "commercial_ok": True}


# ---------------------------------------------------------------------------
# 카테고리 · 지표 정의 (ID 는 이 파일에서 한 번만 정의한다 — 4장 내비 순서)
# ---------------------------------------------------------------------------
CATEGORIES = [
    {"id": "tech_semi", "name": "반도체·AI 테크", "sector_etfs": ["XLK", "SOXX"],
     "chain": [("장비", ["AMAT", "ENTG"]), ("파운드리", ["TSM"]), ("메모리", ["MU", "000660", "005930"]), ("고객", ["NVDA", "AAPL"])]},
    {"id": "ai_datacenter", "name": "AI 데이터센터·전력", "sector_etfs": ["XLK", "XLU"],
     "chain": [("서버 ODM", ["SMCI", "DELL"]), ("네트워크·전력", ["ANET", "VRT", "ETN"]), ("전력 공급", ["VST", "CEG", "NRG"])]},
    {"id": "auto_ev", "name": "자동차·EV·배터리", "sector_etfs": ["XLY"],
     "chain": [("광물", ["ALB", "SQM"]), ("양극재·셀", ["247540", "373220"]), ("완성차", ["TSLA", "GM", "F", "005380"])]},
    {"id": "energy", "name": "에너지·정유·가스", "sector_etfs": ["XLE"],
     "chain": [("업스트림", ["XOM", "CVX", "EOG"]), ("가스·LNG", ["EQT", "LNG"]), ("정유", ["VLO", "MPC", "PSX"])]},
    {"id": "shipping_logistics", "name": "해운·물류·항공", "sector_etfs": ["IYT", "XLI"],
     "chain": [("컨테이너", ["ZIM", "MATX", "011200"]), ("철도·트럭", ["UNP", "CSX", "ODFL"]), ("소포", ["FDX", "UPS"])]},
    {"id": "housing", "name": "주택·건설", "sector_etfs": ["ITB", "XLB"],
     "chain": [("모기지", ["RKT", "UWMC"]), ("빌더", ["DHI", "LEN", "PHM"]), ("건자재·유통", ["HD", "LOW"])]},
    {"id": "commodities_metals", "name": "원자재·금속", "sector_etfs": ["XLB"],
     "chain": [("광산", ["FCX", "BHP", "RIO", "VALE"]), ("철강", ["NUE", "CLF"])]},
    {"id": "consumer_labor", "name": "소비·노동", "sector_etfs": ["XLY", "XLP"],
     "chain": [("소매", ["WMT", "COST", "AMZN"]), ("인력", ["RHI", "MAN"])]},
    {"id": "macro_activity", "name": "실물 경기·나우캐스트", "sector_etfs": ["XLI", "SPY"],
     "chain": [("산업재", ["CAT", "HON", "GE"]), ("시장", ["SPY", "QQQ"])]},
    {"id": "liquidity_credit", "name": "유동성·신용", "sector_etfs": ["XLF", "HYG"],
     "chain": [("은행·카드", ["JPM", "COF", "AXP"]), ("크레딧", ["HYG", "LQD"])]},
    {"id": "rates_fx_vol", "name": "금리·환율·변동성", "sector_etfs": ["TLT"],
     "chain": [("장기채", ["TLT"]), ("지수", ["SPY", "QQQ"])]},
    {"id": "kr_industry", "name": "한국 산업·수급", "sector_etfs": ["EWY"],
     "chain": [("메모리", ["005930", "000660"]), ("배터리", ["373220", "247540"]), ("전력기기", ["267260", "298040"])]},
]

# 통합 정의 헬퍼 — related 는 "F GM 005930" 처럼 공백 구분(6자리 숫자 = KR 코드).
def _rel(tickers: str, roles: dict | None = None) -> list[dict]:
    out = []
    for t in tickers.split():
        kr = t.isdigit() and len(t) == 6
        row = {"code" if kr else "ticker": t, "market": "kr" if kr else "us"}
        if roles and t in roles:
            row["role"] = roles[t]
        out.append(row)
    return out


def _fred(id_, fid, name_kr, name_en, cats, unit, freq, related, *, tone=1, basis="yoy", scale=1.0,
          digits=2, release=None, license=FRED_ATTR, grade="A", provider="FRED (Federal Reserve Bank of St. Louis)",
          related_ind=(), stale_days=None, note=""):
    return {"id": id_, "name_kr": name_kr, "name_en": name_en, "categories": cats, "unit": unit,
            "frequency": freq, "src": ("fred", fid), "source": provider,
            "source_url": f"https://fred.stlouisfed.org/series/{fid}", "source_series_id": fid,
            "proxy": False, "grade": grade, "tone": tone, "regime_basis": basis, "scale": scale,
            "digits": digits, "release": release or {"kind": "none"}, "license": license,
            "related_tickers": _rel(related), "related_indicators": list(related_ind),
            "stale_days": stale_days, "note": note}


def _tw(id_, codes, name_kr, name_en, cats, related, *, tpex_codes=(), release=None, related_ind=(), note=""):
    return {"id": id_, "name_kr": name_kr, "name_en": name_en, "categories": cats, "unit": "십억 TWD",
            "frequency": "M", "src": ("tw", tuple(codes), tuple(tpex_codes)),
            "source": "TWSE·TPEx OpenAPI (월매출 공시)", "source_url": "https://openapi.twse.com.tw/v1/opendata/t187ap05_L",
            "source_series_id": ",".join(list(codes) + list(tpex_codes)), "proxy": False, "grade": "A", "tone": 1,
            "regime_basis": "yoy", "scale": 1e-6, "digits": 2,
            "release": release or {"kind": "monthly", "day": 10, "time_kst": "18:00", "note": "대만 상장사 월매출 공시 마감(매월 10일)"},
            "license": TW_OGDL, "related_tickers": _rel(related), "related_indicators": list(related_ind),
            "stale_days": 75, "note": note}


def _ecos(id_, stat, cycle, items, name_kr, name_en, cats, unit, related, *, tone=1, basis="yoy", scale=1.0, digits=2,
          release=None, related_ind=(), kind="level", note="", stale_days=None):
    freq = {"D": "D", "M": "M", "Q": "Q"}[cycle]
    return {"id": id_, "name_kr": name_kr, "name_en": name_en, "categories": cats, "unit": unit,
            "frequency": freq, "src": ("ecos", stat, cycle, tuple(items)), "source": "한국은행 ECOS",
            "source_url": f"https://ecos.bok.or.kr/#/SearchStat?statCode={stat}", "source_series_id": f"{stat}/{'/'.join(items)}",
            "proxy": False, "grade": "A", "tone": tone, "regime_basis": basis, "scale": scale, "digits": digits,
            "release": release or {"kind": "none"}, "license": ECOS_ATTR, "related_tickers": _rel(related),
            "related_indicators": list(related_ind), "kind": kind, "stale_days": stale_days, "note": note}


def _oecd(id_, area, name_kr, name_en, related):
    return {"id": id_, "name_kr": name_kr, "name_en": name_en, "categories": ["macro_activity"] + (["kr_industry"] if area == "KOR" else []),
            "unit": "지수 (100 = 장기 추세)", "frequency": "M", "src": ("oecd", area), "source": "OECD 경기선행지수 (진폭조정, SDMX)",
            "source_url": "https://www.oecd.org/en/data/indicators/composite-leading-indicator-cli.html", "source_series_id": f"DF_CLI/{area}",
            "proxy": False, "grade": "A", "tone": 1, "regime_basis": "level", "scale": 1.0, "digits": 2,
            "release": {"kind": "monthly", "day": 12, "time_kst": "20:00", "note": "OECD CLI 월간 발표(둘째 주)"},
            "license": OECD_ATTR, "related_tickers": _rel(related), "related_indicators": [], "stale_days": 100, "note": ""}


REL_MONTHLY_3 = {"kind": "monthly", "day": 3, "time_kst": "23:30", "note": "BEA 자동차 판매 (익월 초)"}
REL_HOUSING = {"kind": "monthly", "day": 18, "time_kst": "21:30", "note": "Census 주택 착공·허가 (익월 중순)"}
REL_WEEKLY_THU = {"kind": "weekly", "weekday": 3, "time_kst": "21:30", "note": "매주 목요일"}
REL_WEEKLY_WED = {"kind": "weekly", "weekday": 2, "time_kst": "05:30", "note": "매주 수요일 (연준 H.4.1 목요일 발표, KST 금요일 새벽)"}

INDICATORS: list[dict] = [
    # ---- 반도체·AI 테크 -------------------------------------------------------
    _tw("tsmc_monthly_rev", ["2330"], "TSMC 월별 매출액", "TSMC Monthly Revenue", ["tech_semi", "ai_datacenter"],
        "TSM NVDA AAPL AMD QCOM AVGO 000660", related_ind=["kr_xpi_dram", "semi_ip_us", "tw_ai_server_odm_rev"],
        note="NVDA·AAPL 칩 위탁생산이 분기 실적보다 먼저 드러나는 공개 숫자"),
    _tw("tw_ai_server_odm_rev", ["2382", "3231", "6669", "2356", "2376"], "대만 AI 서버 ODM 5사 월매출 합산",
        "Taiwan AI Server ODM Revenue (Quanta·Wistron·Wiwynn·Inventec·Gigabyte)", ["ai_datacenter", "tech_semi"],
        "NVDA AMD AVGO SMCI DELL HPE VRT 000660 005930", related_ind=["tsmc_monthly_rev", "tw_dc_network_power_rev", "tw_aspeed_bmc_rev"],
        note="엔비디아 랙 출하의 가장 빠른 공식 실측. 廣達 2382·緯創 3231·緯穎 6669·英業達 2356·技嘉 2376"),
    _tw("tw_dc_network_power_rev", ["2345", "2308", "3017"], "대만 데이터센터 네트워크·전력·냉각 월매출 합산",
        "Taiwan DC Network/Power/Cooling Revenue (Accton·Delta·AVC)", ["ai_datacenter"],
        "ANET AVGO MRVL CRDO VRT ETN 010120 267260", related_ind=["tw_ai_server_odm_rev"],
        note="智邦 2345 스위치·台達電 2308 전원·奇鋐 3017 냉각"),
    _tw("tw_osat_substrate_ccl_rev", ["3711", "3037", "2383", "3661", "3443"], "대만 후공정·기판·CCL·ASIC 월매출 합산",
        "Taiwan OSAT/Substrate/CCL/ASIC Revenue (ASE·Unimicron·EMC·Alchip·GUC)", ["tech_semi"],
        "ASX AMKR AVGO MRVL 007660 009150 353200 195870", related_ind=["tsmc_monthly_rev"],
        note="日月光 3711·欣興 3037·台光電 2383·世芯 3661·創意 3443"),
    _tw("tw_memory_rev", ["2408", "2344"], "대만 메모리 4사 월매출 합산", "Taiwan Memory Makers Revenue (Nanya·Winbond·Phison·ADATA)",
        ["tech_semi", "kr_industry"], "MU SNDK WDC STX 005930 000660", tpex_codes=["8299", "3260"],
        related_ind=["kr_xpi_dram", "kr_xpi_flash"], note="가격×물량의 공식 월간 프록시 — DRAM 현물가를 대신한다. 南亞科·華邦電(TWSE) + 群聯·威剛(TPEx)"),
    _tw("tw_handset_optics_rev", ["3008", "4938"], "대만 스마트폰 광학·조립 월매출 합산", "Taiwan Handset Optics/Assembly Revenue (Largan·Pegatron)",
        ["tech_semi"], "AAPL QCOM SWKS QRVO 011070", note="아이폰 빌드 사이클. 大立光 3008·和碩 4938"),
    _tw("tw_container_liner_rev", ["2603", "2609", "2615"], "대만 컨테이너 3사 월매출 합산", "Taiwan Container Liners Revenue (Evergreen·Yang Ming·Wan Hai)",
        ["shipping_logistics"], "ZIM MATX DAC GSL CMRE 011200", note="운임×물동량의 실제 매출 — SCFI 헤드라인의 재배포 가능한 대체. 長榮 2603·陽明 2609·萬海 2615"),
    _tw("tw_aspeed_bmc_rev", [], "Aspeed(BMC) 월매출", "Aspeed Technology Monthly Revenue (TPEx 5274)", ["ai_datacenter", "tech_semi"],
        "NVDA SMCI DELL HPE AMD", tpex_codes=["5274"], related_ind=["tw_ai_server_odm_rev"],
        note="서버 보드 1장당 BMC 1개 — 서버 출하의 선행 후보. TPEx 에만 있다"),
    _tw("tw_globalwafers_rev", [], "GlobalWafers 월매출", "GlobalWafers Monthly Revenue (TPEx 6488)", ["tech_semi"],
        "AMAT ENTG INTC", tpex_codes=["6488"], note="실리콘 웨이퍼 사이클. TPEx 에만 있다"),
    _fred("semi_ip_us", "IPG3344S", "미국 반도체·전자부품 산업생산", "U.S. Industrial Production: Semiconductors & Electronic Components (NAICS 3344)", ["tech_semi"],
          "지수 (2017=100)", "M", "INTC MU TXN ADI", release={"kind": "monthly", "day": 16, "time_kst": "23:15", "note": "연준 G.17 (익월 중순)"},
          related_ind=["tsmc_monthly_rev", "kr_xpi_dram"]),
    # ---- 자동차·EV·배터리 -----------------------------------------------------
    _fred("us_auto_sales_saar", "TOTALSA", "미국 자동차 판매 연율 (SAAR)", "U.S. Total Vehicle Sales (SAAR)", ["auto_ev"],
          "백만 대 (연율)", "M", "F GM TSLA RIVN STLA", release=REL_MONTHLY_3, related_ind=["us_light_vehicle_sales", "kr_mpi_lithium"]),
    _fred("us_light_vehicle_sales", "ALTSALES", "미국 경량차 판매 연율", "U.S. Light Weight Vehicle Sales (SAAR)", ["auto_ev"],
          "백만 대 (연율)", "M", "F GM TSLA", release=REL_MONTHLY_3, related_ind=["us_auto_sales_saar"]),
    _fred("nickel_price_monthly", "PNICKUSDM", "니켈 가격 (IMF 월간)", "Global Nickel Price (IMF)", ["auto_ev", "commodities_metals"],
          "USD/톤", "M", "VALE BHP TSLA GM", tone=0, stale_days=120, note="IMF 원자재 가격 월평균. LME 일별의 무료 대체"),
    # ---- 에너지 -----------------------------------------------------------------
    _fred("wti_crude_oil", "DCOILWTICO", "WTI 원유 (현물)", "Crude Oil: WTI Spot", ["energy"], "USD/배럴", "D",
          "XOM CVX OXY COP EOG VLO", tone=0, related_ind=["brent_crude", "henry_hub_natgas"], note="매크로 패널의 WTI 와 같은 FRED 시리즈"),
    _fred("brent_crude", "DCOILBRENTEU", "브렌트 원유 (현물)", "Crude Oil: Brent Spot", ["energy"], "USD/배럴", "D",
          "XOM BP SHEL", tone=0, related_ind=["wti_crude_oil"]),
    _fred("henry_hub_natgas", "DHHNGSP", "헨리허브 천연가스 (현물)", "Henry Hub Natural Gas Spot", ["energy"], "USD/MMBtu", "D",
          "EQT EXE AR LNG KMI CEG", tone=0),
    _fred("gasoline_retail_weekly", "GASREGW", "미국 휘발유 소매가 (주간)", "U.S. Regular Gasoline Retail Price", ["energy", "consumer_labor"],
          "USD/갤런", "W", "VLO MPC PSX WMT COST", tone=-1, provider="EIA (FRED 경유)", license=PUBLIC),
    # ---- 해운·물류 -------------------------------------------------------------
    _fred("bts_tsi_freight", "TSIFRGHT", "교통서비스지수 (화물)", "Transportation Services Index: Freight", ["shipping_logistics"],
          "지수 (2000=100)", "M", "FDX UPS UNP CSX JBHT", provider="BTS (FRED 경유)", license=PUBLIC, stale_days=130,
          related_ind=["cass_freight_index", "ata_truck_tonnage"]),
    _fred("cass_freight_index", "FRGSHPUSM649NCIS", "Cass 화물 출하지수", "Cass Freight Index: Shipments", ["shipping_logistics"],
          "지수 (1990=1)", "M", "FDX UPS ODFL KNX", provider="Cass Information Systems (FRED 경유, 제3자)", license=THIRD_PARTY,
          related_ind=["bts_tsi_freight"]),
    _fred("ata_truck_tonnage", "TRUCKD11", "ATA 트럭 톤수 지수", "ATA Truck Tonnage Index", ["shipping_logistics"],
          "지수 (2015=100)", "M", "KNX WERN SNDR ODFL", provider="American Trucking Associations (FRED 경유, 제3자)", license=THIRD_PARTY, stale_days=130),
    # ---- 주택·건설 -------------------------------------------------------------
    _fred("us_housing_starts", "HOUST", "미국 주택 착공", "U.S. Housing Starts", ["housing"], "천 건 (연율)", "M",
          "DHI LEN PHM HD LOW", release=REL_HOUSING, provider="Census (FRED 경유)", license=PUBLIC, related_ind=["us_building_permits", "us_mortgage_rate_30y"]),
    _fred("us_building_permits", "PERMIT", "미국 건축허가", "U.S. Building Permits", ["housing"], "천 건 (연율)", "M",
          "DHI LEN PHM", release=REL_HOUSING, provider="Census (FRED 경유)", license=PUBLIC, related_ind=["us_housing_starts"]),
    _fred("us_new_home_sales", "HSN1F", "미국 신규주택 판매", "U.S. New One Family Houses Sold", ["housing"], "천 건 (연율)", "M",
          "DHI LEN PHM TOL", release={"kind": "monthly", "day": 25, "time_kst": "23:00", "note": "Census 신규주택 판매 (익월 하순)"},
          provider="Census (FRED 경유)", license=PUBLIC),
    _fred("us_mortgage_rate_30y", "MORTGAGE30US", "미국 30년 모기지 금리", "30-Year Fixed Rate Mortgage Average", ["housing", "rates_fx_vol"],
          "%", "W", "DHI LEN RKT UWMC", tone=-1, basis="level", release=REL_WEEKLY_THU, provider="Freddie Mac (FRED 경유, 제3자)", license=THIRD_PARTY),
    _fred("realtor_active_listings", "ACTLISCOUUS", "미국 활성 매물 수 (Realtor.com)", "Housing Inventory: Active Listing Count", ["housing"],
          "건", "M", "Z RKT DHI", tone=-1, provider="Realtor.com (FRED 경유, 제3자)", license=THIRD_PARTY, digits=0),
    # ---- 원자재·금속 -----------------------------------------------------------
    _fred("copper_price_monthly", "PCOPPUSDM", "구리 가격 (IMF 월간)", "Global Copper Price (IMF)", ["commodities_metals", "ai_datacenter"],
          "USD/톤", "M", "FCX SCCO BHP RIO", tone=0, stale_days=120, note="'닥터 코퍼'. IMF 월평균 — LME 현금가의 무료 대체"),
    _fred("iron_ore_62pct", "PIORECRUSDM", "철광석 62% 가격 (IMF 월간)", "Global Iron Ore Price (IMF)", ["commodities_metals"],
          "USD/톤", "M", "VALE RIO BHP CLF NUE", tone=0, stale_days=120),
    # ---- 소비·노동 -------------------------------------------------------------
    _fred("retail_sales", "RSAFS", "미국 소매판매", "Advance Retail Sales: Retail Trade and Food Services", ["consumer_labor"],
          "십억 USD", "M", "WMT AMZN HD COST", scale=1e-3, release={"kind": "monthly", "day": 15, "time_kst": "21:30", "note": "Census 소매판매 (익월 중순)"},
          provider="Census (FRED 경유)", license=PUBLIC),
    _fred("umcsent", "UMCSENT", "미시간대 소비자심리", "University of Michigan: Consumer Sentiment", ["consumer_labor"],
          "지수 (1966=100)", "M", "WMT F GM", basis="level", provider="University of Michigan (FRED 경유, 제3자)", license=THIRD_PARTY),
    _fred("initial_claims", "ICSA", "신규 실업수당 청구", "Initial Claims", ["consumer_labor", "macro_activity"], "천 건", "W",
          "SPY HD LOW", tone=-1, scale=1e-3, digits=0, release=REL_WEEKLY_THU, provider="DOL (FRED 경유)", license=PUBLIC),
    _fred("indeed_job_postings", "IHLIDXUS", "Indeed 구인공고 지수", "Indeed Job Postings Index: United States", ["consumer_labor"],
          "지수 (2020-02-01=100)", "D", "RHI MAN KFY", provider="Indeed Hiring Lab (FRED 경유, CC BY 4.0)", license=CC_BY),
    _fred("cc_delinquency", "DRCCLACBS", "신용카드 연체율 (상업은행)", "Delinquency Rate on Credit Card Loans", ["consumer_labor", "liquidity_credit"],
          "%", "Q", "COF SYF AXP JPM", tone=-1, basis="level", stale_days=220),
    # ---- 실물 경기·나우캐스트 --------------------------------------------------
    _fred("indpro", "INDPRO", "미국 산업생산", "Industrial Production: Total Index", ["macro_activity"], "지수 (2017=100)", "M",
          "CAT HON GE XLI", release={"kind": "monthly", "day": 16, "time_kst": "23:15", "note": "연준 G.17"}),
    _fred("capacity_utilization", "TCU", "설비가동률", "Capacity Utilization: Total Index", ["macro_activity"], "%", "M",
          "CAT HON EMR", basis="level"),
    _fred("durable_goods_orders", "DGORDER", "내구재 신규주문", "Manufacturers' New Orders: Durable Goods", ["macro_activity"], "십억 USD", "M",
          "CAT DE GE HON", scale=1e-3, provider="Census (FRED 경유)", license=PUBLIC),
    _fred("mfg_weekly_hours", "AWHMAN", "제조업 주간 근로시간", "Average Weekly Hours of Production Employees: Manufacturing", ["macro_activity"],
          "시간", "M", "XLI CAT", basis="level", provider="BLS (FRED 경유)", license=PUBLIC, note="컨퍼런스보드 LEI 구성 요소 — 고용의 선행"),
    _fred("gdpnow", "GDPNOW", "애틀랜타연준 GDPNow", "GDPNow Real GDP Nowcast", ["macro_activity"], "% (연율)", "Q",
          "SPY QQQ", basis="level", stale_days=120, note="FRED 는 분기별 최신 나우캐스트 1점만 제공(발표마다 그 자리에서 갱신)", provider="Federal Reserve Bank of Atlanta (FRED 경유)", license=PUBLIC),
    _fred("wei", "WEI", "뉴욕연준 주간경제지수 (WEI)", "Weekly Economic Index (Lewis-Mertens-Stock)", ["macro_activity"], "% (GDP 환산)", "W",
          "SPY", basis="level", provider="Federal Reserve Bank of New York (FRED 경유)", license=PUBLIC),
    _fred("cfnai", "CFNAI", "시카고연준 국가활동지수 (CFNAI)", "Chicago Fed National Activity Index", ["macro_activity"], "지수 (0=추세)", "M",
          "SPY XLI", basis="level", provider="Federal Reserve Bank of Chicago (FRED 경유)", license=PUBLIC),
    _fred("sahm_rule", "SAHMREALTIME", "삼 법칙 침체 지표 (실시간)", "Real-time Sahm Rule Recession Indicator", ["macro_activity"], "%p", "M",
          "SPY TLT", tone=-1, basis="level", note="0.5 이상이면 역사적으로 침체 초기"),
    _fred("recession_prob_smoothed", "RECPROUSM156N", "미국 침체 확률 (Chauvet-Piger)", "Smoothed U.S. Recession Probabilities", ["macro_activity"], "%", "M",
          "SPY TLT", tone=-1, basis="level", stale_days=130, provider="Chauvet & Piger (FRED 경유)", license=FRED_ATTR),
    _oecd("oecd_cli_us", "USA", "OECD 경기선행지수 (미국)", "OECD Composite Leading Indicator: United States", "SPY QQQ XLI"),
    _oecd("oecd_cli_kr", "KOR", "OECD 경기선행지수 (한국)", "OECD Composite Leading Indicator: Korea", "005930 000660 005380 EWY"),
    # ---- 유동성·신용 -----------------------------------------------------------
    _fred("fed_total_assets", "WALCL", "연준 총자산", "Fed Total Assets (H.4.1)", ["liquidity_credit"], "조 USD", "W",
          "QQQ SPY TLT", scale=1e-6, release=REL_WEEKLY_WED, related_ind=["fed_net_liquidity", "us_m2_money_supply"]),
    {"id": "fed_net_liquidity", "name_kr": "연준 순유동성 (총자산 − TGA − 역레포)", "name_en": "Fed Net Liquidity (WALCL − TGA − RRP)",
     "categories": ["liquidity_credit"], "unit": "조 USD", "frequency": "W", "src": ("net_liq",),
     "source": "FRED WALCL·WTREGEN·RRPONTSYD 로 자체 계산", "source_url": "https://fred.stlouisfed.org/series/WALCL",
     "source_series_id": "WALCL-WTREGEN-RRPONTSYD", "proxy": False, "grade": "A", "tone": 1, "regime_basis": "yoy", "scale": 1.0,
     "digits": 3, "release": REL_WEEKLY_WED, "license": FRED_ATTR, "related_tickers": _rel("QQQ SPY GLD"),
     "related_indicators": ["fed_total_assets"], "stale_days": None, "note": "공식 3시리즈로 계산한 값 — 주간(수요일 기준)"},
    _fred("us_m2_money_supply", "M2SL", "미국 M2 통화량", "M2 Money Stock", ["liquidity_credit"], "조 USD", "M", "SPY GLD",
          scale=1e-3, digits=3),
    _fred("us_high_yield_spread", "BAMLH0A0HYM2", "하이일드 신용스프레드 (OAS)", "ICE BofA US High Yield OAS", ["liquidity_credit"], "%p", "D",
          "HYG JNK SPY QQQ", tone=-1, basis="level", provider="ICE BofA (FRED 경유, 제3자)", license=THIRD_PARTY,
          related_ind=["us_ig_spread", "nfci"], note="매크로 패널의 하이일드 스프레드와 같은 시리즈"),
    _fred("us_ig_spread", "BAMLC0A0CM", "투자등급 신용스프레드 (OAS)", "ICE BofA US Corporate OAS", ["liquidity_credit"], "%p", "D",
          "LQD JPM", tone=-1, basis="level", provider="ICE BofA (FRED 경유, 제3자)", license=THIRD_PARTY),
    _fred("nfci", "NFCI", "시카고연준 금융여건지수 (NFCI)", "Chicago Fed National Financial Conditions Index", ["liquidity_credit"], "지수 (0=평균)", "W",
          "SPY XLF", tone=-1, basis="level", release=REL_WEEKLY_WED, provider="Federal Reserve Bank of Chicago (FRED 경유)", license=PUBLIC),
    _fred("stlfsi", "STLFSI4", "세인트루이스연준 금융스트레스지수", "St. Louis Fed Financial Stress Index", ["liquidity_credit", "rates_fx_vol"], "지수 (0=평균)", "W",
          "SPY XLF HYG", tone=-1, basis="level", provider="Federal Reserve Bank of St. Louis", license=FRED_ATTR),
    # ---- 금리·환율·변동성 ------------------------------------------------------
    _fred("t10y2y", "T10Y2Y", "미국 10년−2년 금리차", "10-Year Minus 2-Year Treasury Spread", ["rates_fx_vol"], "%p", "D",
          "SPY TLT XLF", basis="level", note="수익률 곡선 패널과 같은 시리즈. 역전 = 침체 선행의 고전"),
    _fred("t10y3m", "T10Y3M", "미국 10년−3개월 금리차", "10-Year Minus 3-Month Treasury Spread", ["rates_fx_vol"], "%p", "D",
          "SPY TLT", basis="level"),
    _fred("breakeven_10y", "T10YIE", "10년 기대인플레이션 (BEI)", "10-Year Breakeven Inflation Rate", ["rates_fx_vol"], "%", "D",
          "TLT GLD", tone=0, basis="level"),
    _fred("real_yield_10y", "DFII10", "10년 실질금리 (TIPS)", "10-Year TIPS Constant Maturity", ["rates_fx_vol"], "%", "D",
          "GLD QQQ TLT", tone=-1, basis="level"),
    _fred("term_premium_10y", "THREEFYTP10", "10년 기간프리미엄 (ACM)", "ACM 10-Year Term Premium", ["rates_fx_vol"], "%", "D",
          "TLT", tone=0, basis="level", provider="Federal Reserve Bank of New York (FRED 경유)", license=PUBLIC, stale_days=30),
    _fred("dollar_index_dxy", "DTWEXBGS", "달러지수 (광의, 연준)", "Nominal Broad U.S. Dollar Index", ["rates_fx_vol"], "지수 (2006=100)", "D",
          "SPY GLD EWY", tone=0, note="ICE DXY(DX-Y.NYB) 와 바스켓이 다르다 — 연준 광의 지수"),
    _fred("vix", "VIXCLS", "VIX 변동성지수", "CBOE Volatility Index: VIX", ["rates_fx_vol"], "지수", "D", "SPY QQQ",
          tone=-1, basis="level", provider="Cboe (FRED 경유, 제3자)", license=THIRD_PARTY),
    _fred("epu_daily", "USEPUINDXD", "경제정책 불확실성 지수 (일별)", "Economic Policy Uncertainty Index for United States (Daily)", ["rates_fx_vol", "macro_activity"],
          "지수", "D", "SPY GLD", tone=-1, basis="level", provider="Baker, Bloom & Davis (FRED 경유)", license=FRED_ATTR),
    # ---- 한국 산업·수급 (ECOS — 키는 Actions 에만 있다) --------------------------
    _ecos("kr_xpi_dram", "402Y016", "M", ["30911201AA", "D"], "DRAM 수출물가지수 (한국은행, 달러)", "Korea Export Price Index: DRAM (USD)",
          ["tech_semi", "kr_industry"], "지수 (2020=100)", "005930 000660 042700 MU", related_ind=["kr_xpi_flash", "tw_memory_rev", "tsmc_monthly_rev"],
          note="DRAM 현물가가 아니라 한국은행 공식 수출물가지수 — 메모리 사이클의 무료 공식 지표"),
    _ecos("kr_xpi_flash", "402Y016", "M", ["30911202AA", "D"], "플래시메모리 수출물가지수 (한국은행, 달러)", "Korea Export Price Index: Flash Memory (USD)",
          ["tech_semi", "kr_industry"], "지수 (2020=100)", "005930 000660 MU WDC SNDK", related_ind=["kr_xpi_dram"]),
    _ecos("kr_xpi_transformer", "402Y016", "M", ["31012101AA", "D"], "송배전 변압기 수출물가지수 (달러)", "Korea Export Price Index: Transformers (USD)",
          ["ai_datacenter", "kr_industry"], "지수 (2020=100)", "267260 298040 010120 ETN GEV", note="AI 데이터센터 전력기기 판가"),
    _ecos("kr_mpi_lithium", "401Y017", "M", ["30512205AA", "D"], "탄산리튬 수입물가지수 (달러)", "Korea Import Price Index: Lithium Carbonate (USD)",
          ["auto_ev", "kr_industry"], "지수 (2022.12=100)", "247540 066970 003670 051910 ALB SQM", tone=0,
          related_ind=["kr_mpi_lithium_hydroxide", "nickel_price_monthly"], note="리튬 가격의 무료 공식 프록시. 양극재 판가·재고평가손 선행"),
    _ecos("kr_mpi_lithium_hydroxide", "401Y017", "M", ["30512204AA", "D"], "수산화리튬 수입물가지수 (달러)", "Korea Import Price Index: Lithium Hydroxide (USD)",
          ["auto_ev", "kr_industry"], "지수 (2022.12=100)", "247540 066970 003670 373220 ALB", tone=0, related_ind=["kr_mpi_lithium"]),
    _ecos("kr_mfg_inventory_ratio", "901Y026", "M", ["I33A"], "제조업 재고율 (재고/출하)", "Korea Manufacturing Inventory-to-Shipment Ratio",
          ["kr_industry", "macro_activity"], "지수 (2020=100)", "005930 000660 005380", tone=-1, basis="level", note="재고 사이클의 고전 선행지표(원자료 통계청)"),
    _ecos("kr_csi", "511Y002", "M", ["FME", "99988"], "소비자심리지수 (CCSI)", "Korea Composite Consumer Sentiment Index",
          ["kr_industry", "consumer_labor"], "지수 (100=중립)", "008770 004170 039130 139480", basis="level"),
    _ecos("kr_foreign_net_daily", "802Y001", "D", ["0030000"], "외국인 순매수 (코스피, 20일 누적)", "Korea Foreign Net Buying: KOSPI (20-day cumulative)",
          ["kr_industry"], "조원", "005930 000660 005380 EWY", tone=1, basis="level", scale=1e-4, digits=2, kind="flow20",
          note="한국은행 일별 외국인 순매수(억원)를 20거래일 누적한 값. 일별 원값은 부호가 잦게 바뀌어 추세를 보기 어렵다"),
]


# ---------------------------------------------------------------------------
# 유틸
# ---------------------------------------------------------------------------
def kst_now() -> datetime:
    return datetime.now(KST)


def kst_now_str() -> str:
    return kst_now().strftime("%Y-%m-%d %H:%M KST")


def _fnum(v) -> float | None:
    try:
        n = float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def _date_of(key: str) -> date:
    """'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY-Qn' → date (월·분기는 그 기간의 첫날)."""
    if len(key) == 10:
        return date.fromisoformat(key)
    if len(key) == 7 and key[4] == "-" and key[5] != "Q":
        return date(int(key[:4]), int(key[5:]), 1)
    if "Q" in key:
        y, q = key.split("-Q")
        return date(int(y), (int(q) - 1) * 3 + 1, 1)
    return date.fromisoformat(key[:10])


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _shift_month(key: str, n: int) -> str:
    y, m = int(key[:4]), int(key[5:7])
    m += n
    while m <= 0:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return f"{y:04d}-{m:02d}"


def _round(v: float | None, digits: int) -> float | None:
    if v is None or not math.isfinite(v):
        return None
    return round(v, digits)


# ---------------------------------------------------------------------------
# 수집기
# ---------------------------------------------------------------------------
def fetch_fred(fid: str, start: str) -> list[tuple[str, float]]:
    """fredgraph.csv — 첫 줄이 'observation_date,' 가 아니면(없는 ID 는 HTML) 실패."""
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fid}&cosd={start}"
    text = sec.http_get_with_backoff(url, headers=UA_IDENT, timeout=30, label=f"FRED {fid}").decode("utf-8", "replace")
    lines = text.splitlines()
    if not lines or not lines[0].lower().startswith(("observation_date", "date")):
        raise RuntimeError(f"FRED {fid}: CSV 헤더가 아님 ({lines[0][:40] if lines else '빈 응답'})")
    out = []
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) < 2:
            continue
        v = _fnum(parts[1])
        if v is None:
            continue
        out.append((parts[0].strip(), v))
    return out


def fetch_ecos(key: str, stat: str, cycle: str, items: tuple[str, ...], start: str, end: str) -> list[tuple[str, float]]:
    item_path = "/".join(items)
    url = f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/1000/{stat}/{cycle}/{start}/{end}/{item_path}"
    raw = sec.http_get_with_backoff(url, headers=UA_IDENT, timeout=30, label=f"ECOS {stat}")
    d = json.loads(raw.decode("utf-8"))
    if "RESULT" in d:  # {"RESULT":{"CODE":"INFO-200","MESSAGE":"해당하는 데이터가 없습니다."}}
        raise RuntimeError(f"ECOS {stat}/{item_path}: {d['RESULT'].get('CODE')} {d['RESULT'].get('MESSAGE')}")
    rows = d.get("StatisticSearch", {}).get("row", [])
    out = []
    for row in rows:
        v = _fnum(row.get("DATA_VALUE"))
        t = str(row.get("TIME") or "")
        if v is None or not t:
            continue
        if cycle == "M" and len(t) == 6:
            t = f"{t[:4]}-{t[4:]}"
        elif cycle == "D" and len(t) == 8:
            t = f"{t[:4]}-{t[4:6]}-{t[6:]}"
        elif cycle == "Q" and len(t) == 6:
            t = f"{t[:4]}-Q{t[5]}"
        out.append((t, v))
    out.sort(key=lambda x: x[0])
    return out


def fetch_oecd_cli(area: str, start: str) -> list[tuple[str, float]]:
    url = ("https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,/"
           f"{area}.M.LI...AA...H?startPeriod={start}&format=csvfilewithlabels")
    raw = sec.http_get_with_backoff(url, headers=UA_IDENT, timeout=45, label=f"OECD CLI {area}")
    return parse_oecd_csv(raw.decode("utf-8-sig", "replace"), area)


def parse_oecd_csv(text: str, area: str) -> list[tuple[str, float]]:
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        if row.get("REF_AREA") != area:
            continue
        v = _fnum(row.get("OBS_VALUE"))
        t = (row.get("TIME_PERIOD") or "").strip()
        if v is None or len(t) != 7:
            continue
        out.append((t, v))
    out.sort(key=lambda x: x[0])
    return out


_TW_CACHE: dict[str, dict[str, dict]] = {}


def _get_lenient(url: str, headers: dict, timeout: int) -> bytes:
    """TWSE·TPEx 인증서는 중간 CA 에 SKID 확장이 없어 Python 3.13 의 기본
    VERIFY_X509_STRICT 에 걸린다(로컬 실측). 체인·호스트명 검증은 그대로 두고 strict 만 끈다."""
    ctx = ssl.create_default_context()
    ctx.verify_flags &= ~getattr(ssl, "VERIFY_X509_STRICT", 0)
    last = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                return r.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt < 3:
                time.sleep(2 * attempt)
    raise last  # type: ignore[misc]


def parse_tw_rows(rows: list[dict]) -> dict[str, dict]:
    """TWSE/TPEx 월매출 행 → {코드: {date, val, prev, yago, name}} (금액 천 TWD, 민국연 → 서기)."""
    out: dict[str, dict] = {}
    for r in rows:
        code = str(r.get("公司代號") or "").strip()
        ym = str(r.get("資料年月") or "").strip()
        if not code or len(ym) < 5 or not ym.isdigit():
            continue
        year = int(ym[:-2]) + 1911
        month = int(ym[-2:])
        if not 1 <= month <= 12:
            continue
        val = _fnum(r.get("營業收入-當月營收"))
        if val is None:
            continue
        out[code] = {
            "date": f"{year:04d}-{month:02d}", "val": val,
            "prev": _fnum(r.get("營業收入-上月營收")), "yago": _fnum(r.get("營業收入-去年當月營收")),
            "name": str(r.get("公司名稱") or "").strip(),
        }
    return out


def fetch_tw(exchange: str) -> dict[str, dict]:
    if exchange in _TW_CACHE:
        return _TW_CACHE[exchange]
    url = ("https://openapi.twse.com.tw/v1/opendata/t187ap05_L" if exchange == "twse"
           else "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O")
    raw = _get_lenient(url, UA_BROWSER, 45)
    rows = json.loads(raw.decode("utf-8-sig"))
    if not isinstance(rows, list) or len(rows) < 100:
        raise RuntimeError(f"{exchange}: 행 {len(rows) if isinstance(rows, list) else '?'}개 — 응답 이상")
    _TW_CACHE[exchange] = parse_tw_rows(rows)
    return _TW_CACHE[exchange]


def load_archive(path: Path) -> dict:
    if path.exists():
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(d, dict) and isinstance(d.get("records"), list):
                return d
        except Exception:
            pass
    return {"keep": TW_ARCHIVE_KEEP, "records": []}


def update_tw_archive(archive: dict, latest: dict) -> tuple[dict, bool]:
    """최신 행을 적립한다. 같은 달은 skip. 상월·요년동월 값은 아직 없는 달일 때만 seeded 로 추가.
    반환 (archive, changed)."""
    recs = {r["date"]: r for r in archive.get("records", []) if isinstance(r, dict) and r.get("date")}
    changed = False
    d = latest["date"]
    if d not in recs or recs[d].get("seeded"):
        recs[d] = {"date": d, "val": latest["val"]}
        if latest.get("yago") is not None:
            recs[d]["yago"] = latest["yago"]
        changed = True
    for months_back, field in ((1, "prev"), (12, "yago")):
        v = latest.get(field)
        if v is None:
            continue
        k = _shift_month(d, -months_back)
        if k not in recs:
            recs[k] = {"date": k, "val": v, "seeded": True}
            changed = True
    ordered = [recs[k] for k in sorted(recs)][-int(archive.get("keep") or TW_ARCHIVE_KEEP):]
    archive = {"keep": int(archive.get("keep") or TW_ARCHIVE_KEEP), "records": ordered, "name": latest.get("name") or archive.get("name")}
    return archive, changed


def tw_series(codes: tuple[str, ...], tpex_codes: tuple[str, ...], *, write: bool = True) -> list[tuple[str, float]]:
    """코드 묶음의 월매출 합산 시계열(천 TWD). 어느 한 코드라도 그 달 값이 없으면 그 달은 뺀다."""
    per_code: list[dict[str, float]] = []
    for exchange, group in (("twse", codes), ("tpex", tpex_codes)):
        if not group:
            continue
        rows = fetch_tw(exchange)
        for code in group:
            latest = rows.get(code)
            path = ARCHIVE_DIR / f"tw_{code}.json"
            archive = load_archive(path)
            if latest:
                archive, changed = update_tw_archive(archive, latest)
                if changed and write:
                    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
                    atomic_write_text(path, json.dumps(archive, ensure_ascii=False, separators=(",", ":")) + "\n")
            else:
                print(f"    [tw] {exchange} 피드에 {code} 없음 — 아카이브만 사용")
            per_code.append({r["date"]: float(r["val"]) for r in archive["records"]})
    if not per_code:
        return []
    common = set(per_code[0])
    for m in per_code[1:]:
        common &= set(m)
    return [(k, sum(m[k] for m in per_code)) for k in sorted(common)]


def net_liquidity(walcl, tga, rrp) -> list[tuple[str, float]]:
    """WALCL(백만$) − WTREGEN(백만$) − RRPONTSYD(십억$) → 조$. WALCL 날짜마다 그 이전 최신 TGA·RRP 를 맞춘다."""
    def lookup(series):
        keys = [k for k, _ in series]
        vals = [v for _, v in series]
        def at(day):
            i = bisect.bisect_right(keys, day) - 1
            return vals[i] if i >= 0 else None
        return at
    tga_at, rrp_at = lookup(tga), lookup(rrp)
    out = []
    for d, w in walcl:
        t, r = tga_at(d), rrp_at(d)
        if t is None or r is None:
            continue
        out.append((d, w / 1e6 - t / 1e6 - r / 1e3))
    return out


# ---------------------------------------------------------------------------
# 분석 (순수 함수 — 테스트 대상)
# ---------------------------------------------------------------------------
def normalize_keys(series: list[tuple[str, float]], freq: str) -> list[tuple[str, float]]:
    """FRED 는 월간·분기도 'YYYY-MM-01' 로 준다 → 월간은 'YYYY-MM', 분기는 'YYYY-Qn' 으로 통일."""
    if freq == "M":
        return [(k[:7] if len(k) == 10 else k, v) for k, v in series]
    if freq == "Q":
        out = []
        for k, v in series:
            if len(k) == 10:
                d = _date_of(k)
                out.append((f"{d.year}-Q{(d.month - 1) // 3 + 1}", v))
            else:
                out.append((k, v))
        return out
    return list(series)


def to_monthly(series: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """일·주간 → 월별 마지막 값. 월간·분기는 그대로."""
    if not series:
        return []
    if len(series[0][0]) == 7:
        return list(series)
    out: dict[str, float] = {}
    for k, v in series:
        out[_month_key(_date_of(k))] = v
    return sorted(out.items())


def value_at_or_before(series: list[tuple[str, float]], target: date) -> float | None:
    keys = [_date_of(k) for k, _ in series]
    i = bisect.bisect_right(keys, target) - 1
    return series[i][1] if i >= 0 else None


def yoy_series(series: list[tuple[str, float]], freq: str) -> list[float | None]:
    """각 점의 전년 대비 %. 월·분기는 키 매칭, 일·주간은 364일 전 이하 최신값."""
    if freq in ("M", "Q"):
        idx = {k: v for k, v in series}
        out = []
        for k, v in series:
            if freq == "M":
                base = idx.get(_shift_month(k, -12))
            else:
                y, q = k.split("-Q")
                base = idx.get(f"{int(y) - 1}-Q{q}")
            out.append(_pct(v, base))
        return out
    out = []
    for k, v in series:
        base = value_at_or_before(series, _date_of(k) - timedelta(days=364))
        out.append(_pct(v, base))
    return out


def _pct(v: float | None, base: float | None) -> float | None:
    if v is None or base is None or base == 0 or (v < 0) != (base < 0):
        return None
    return (v / base - 1) * 100


def performance(series: list[tuple[str, float]], freq: str, mode: str) -> dict[str, float | None]:
    """기간별 등락. mode='pct' 는 %, 'diff' 는 단위 차(스프레드·지수 레벨). 주기보다 짧은 칸은 None(가짜 보간 금지)."""
    out: dict[str, float | None] = {}
    if not series:
        return {h: None for h, _ in PERF_HORIZONS}
    last_key, last = series[-1]
    last_d = _date_of(last_key)
    allowed = PERF_ALLOWED.get(freq, set())
    for label, days in PERF_HORIZONS:
        if label not in allowed:
            out[label] = None
            continue
        target = date(last_d.year - 1, 12, 31) if days is None else last_d - timedelta(days=days)
        base = value_at_or_before(series, target)
        base_key = _key_at_or_before(series, target)
        # 기준점이 목표일보다 한 주기 반 넘게 앞이면(아카이브가 성긴 TWSE 초기처럼) 그 칸은 비운다 —
        # 3개월 등락 칸에 1년 전 값을 넣으면 가짜 숫자다.
        if base is None or base_key is None or (target - _date_of(base_key)).days > PERF_TOLERANCE_DAYS[freq]:
            out[label] = None
            continue
        out[label] = (last - base) if mode == "diff" else _pct(last, base)
    return out


def _key_at_or_before(series: list[tuple[str, float]], target: date) -> str | None:
    keys = [_date_of(k) for k, _ in series]
    i = bisect.bisect_right(keys, target) - 1
    return series[i][0] if i >= 0 else None


def window_stats(series: list[tuple[str, float]], years: int = 5) -> dict | None:
    if len(series) < 8:
        return None
    cutoff = _date_of(series[-1][0]) - timedelta(days=365 * years)
    win = [(k, v) for k, v in series if _date_of(k) >= cutoff]
    if len(win) < 8:
        return None
    vals = [v for _, v in win]
    mean = statistics.fmean(vals)
    sd = statistics.pstdev(vals)
    last = vals[-1]
    rank = sum(1 for v in vals if v <= last) / len(vals)
    mn = min(win, key=lambda x: x[1])
    mx = max(win, key=lambda x: x[1])
    return {"window_years": years, "n": len(win), "mean": mean, "sd": sd,
            "zscore": (last - mean) / sd if sd > 0 else None, "percentile": rank,
            "min": {"date": mn[0], "val": mn[1]}, "max": {"date": mx[0], "val": mx[1]}}


def seasonal(monthly: list[tuple[str, float]], yoy: list[float | None], years: int = 5) -> dict | None:
    """같은 달 YoY 의 과거 5년 평균 vs 올해."""
    if not monthly or yoy[-1] is None:
        return None
    last_key = monthly[-1][0]
    month = last_key[5:7]
    prior = [y for (k, _), y in zip(monthly[:-1], yoy[:-1]) if k[5:7] == month and y is not None][-years:]
    if len(prior) < 3:
        return None
    avg = statistics.fmean(prior)
    return {"month": int(month), "same_month_yoy_avg": avg, "years": len(prior), "this_year_yoy": yoy[-1],
            "verdict": "above" if yoy[-1] > avg else "below"}


def _ma(vals: list[float | None], n: int) -> list[float | None]:
    out: list[float | None] = []
    for i in range(len(vals)):
        win = vals[max(0, i - n + 1): i + 1]
        if len(win) < n or any(v is None for v in win):
            out.append(None)
        else:
            out.append(statistics.fmean(win))  # type: ignore[arg-type]
    return out


def regime(series: list[tuple[str, float]], freq: str, basis: str, tone: int) -> dict:
    """8.3 — direction 은 YoY 3MMA(또는 레벨 3MMA)의 3개월 전 대비 변화 Δ, 임계 = 5년 Δ 표준편차 × 0.25.
    level 은 YoY 3MMA 의 부호. tone=-1 이면 direction 의 좋고 나쁨을 뒤집는다(direction_raw 는 데이터 방향)."""
    unknown = {"direction": "unknown", "direction_raw": "unknown", "level": None, "streak_months": 0, "tone": tone,
               "rule": None, "delta": None, "threshold": None}
    if not series:
        return unknown
    if freq == "Q":
        base_vals = yoy_series(series, "Q") if basis == "yoy" else [v for _, v in series]
        ma = base_vals
        step = 1
        rule = "직전 분기 대비 YoY 변화" if basis == "yoy" else "직전 분기 대비 레벨 변화"
    else:
        monthly = to_monthly(series)
        base_vals = yoy_series(monthly, "M") if basis == "yoy" else [v for _, v in monthly]
        ma = _ma(base_vals, 3)
        step = 3
        rule = ("YoY 3MMA 의 3개월 전 대비 변화(방향) + YoY 부호(수준)" if basis == "yoy"
                else "레벨 3MMA 의 3개월 전 대비 변화(방향)")
    deltas: list[float | None] = [None] * len(ma)
    for i in range(step, len(ma)):
        if ma[i] is not None and ma[i - step] is not None:
            deltas[i] = ma[i] - ma[i - step]  # type: ignore[operator]
    if deltas[-1] is None:
        return unknown
    hist = [d for d in deltas[-60:] if d is not None]
    if len(hist) < 6:
        return unknown
    thr = statistics.pstdev(hist) * 0.25
    def classify(d):
        if d is None:
            return None
        if d > thr:
            return "improving"
        if d < -thr:
            return "deteriorating"
        return "flat"
    raw = classify(deltas[-1])
    streak = 0
    for d in reversed(deltas):
        if classify(d) == raw and d is not None:
            streak += 1
        else:
            break
    if tone < 0 and raw in ("improving", "deteriorating"):
        direction = "deteriorating" if raw == "improving" else "improving"
    else:
        direction = raw
    level = None
    if basis == "yoy" and ma[-1] is not None:
        level = "expanding" if ma[-1] >= 0 else "contracting"
    return {"direction": direction, "direction_raw": raw, "level": level,
            "streak_months": streak * (1 if freq != "Q" else 3), "tone": tone, "rule": rule,
            "delta": deltas[-1], "threshold": thr}


def next_release(rule: dict | None, today: date) -> dict | None:
    if not rule or rule.get("kind") in (None, "none"):
        return None
    kind = rule["kind"]
    if kind == "monthly":
        day = int(rule.get("day", 1))
        y, m = today.year, today.month
        for _ in range(3):
            try:
                cand = date(y, m, day)
            except ValueError:
                cand = date(y, m, 28)
            if cand > today:
                break
            m += 1
            if m > 12:
                m, y = 1, y + 1
        else:
            return None
    elif kind == "weekly":
        wd = int(rule.get("weekday", 3))
        delta = (wd - today.weekday()) % 7 or 7
        cand = today + timedelta(days=delta)
    else:
        return None
    return {"date": cand.isoformat(), "time_kst": rule.get("time_kst"), "note": rule.get("note"),
            "days_ahead": (cand - today).days, "consensus": None, "market_implied": None}


def stale(series: list[tuple[str, float]], freq: str, today: date, override: int | None = None) -> bool:
    if not series:
        return True
    limit = override or STALE_DAYS[freq]
    return (today - _date_of(series[-1][0])).days > limit


# ---------------------------------------------------------------------------
# 게이트
# ---------------------------------------------------------------------------
def validate_definitions(indicators: list[dict], categories: list[dict], details_us: Path, details_kr: Path) -> list[str]:
    """ID 중복·미정의 참조·티커 실재. 문제 목록을 돌려준다(비어 있으면 통과)."""
    problems: list[str] = []
    ids = [i["id"] for i in indicators]
    seen = set()
    for i in ids:
        if i in seen:
            problems.append(f"지표 ID 중복: {i}")
        seen.add(i)
    cat_ids = {c["id"] for c in categories}
    tickers: set[tuple[str, str]] = set()
    for ind in indicators:
        for c in ind["categories"]:
            if c not in cat_ids:
                problems.append(f"{ind['id']}: 미정의 카테고리 {c}")
        for rid in ind.get("related_indicators", []):
            if rid not in seen:
                problems.append(f"{ind['id']}: related_indicators 에 미정의 ID {rid}")
        for r in ind.get("related_tickers", []):
            tickers.add((r["market"], r.get("ticker") or r.get("code")))
    for c in categories:
        for etf in c.get("sector_etfs", []):
            tickers.add(("us", etf))
        for _stage, members in c.get("chain", []):
            for t in members:
                tickers.add(("kr" if t.isdigit() else "us", t))
    for market, t in sorted(tickers):
        path = (details_kr if market == "kr" else details_us) / f"{t}.json"
        if not path.exists():
            try:
                shown = path.relative_to(ROOT)
            except ValueError:
                shown = path
            problems.append(f"관련 종목 {market}:{t} 이 {shown} 에 없다(상폐·티커 변경?)")
    return problems


# ---------------------------------------------------------------------------
# 빌드
# ---------------------------------------------------------------------------
def load_previous() -> dict:
    if OUT_JSON.exists():
        try:
            return json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def fetch_raw(ind: dict, keys: dict, start_iso: str, only: set[str]) -> list[tuple[str, float]]:
    src = ind["src"]
    kind = src[0]
    if only and kind not in only and not (kind == "net_liq" and "fred" in only):
        raise RuntimeError("skipped by --only")
    if kind == "fred":
        return fetch_fred(src[1], start_iso)
    if kind == "net_liq":
        walcl = fetch_fred("WALCL", start_iso)
        tga = fetch_fred("WTREGEN", start_iso)
        rrp = fetch_fred("RRPONTSYD", start_iso)
        return net_liquidity(walcl, tga, rrp)
    if kind == "tw":
        return tw_series(src[1], src[2])
    if kind == "ecos":
        key = keys.get("ecos")
        if not key:
            raise RuntimeError("ECOS_API_KEY 없음")
        _, stat, cycle, items = src
        now = kst_now()
        if cycle == "D":
            s, e = (now - timedelta(days=365 * 3)).strftime("%Y%m%d"), now.strftime("%Y%m%d")
        elif cycle == "Q":
            s, e = f"{now.year - HISTORY_YEARS}Q1", f"{now.year}Q4"
        else:
            s, e = (now - timedelta(days=365 * HISTORY_YEARS + 400)).strftime("%Y%m"), now.strftime("%Y%m")
        return fetch_ecos(key, stat, cycle, items, s, e)
    if kind == "oecd":
        return fetch_oecd_cli(src[1], start_iso[:7])
    raise RuntimeError(f"알 수 없는 소스 {kind}")


def flow20(series: list[tuple[str, float]]) -> list[tuple[str, float]]:
    out = []
    window: list[float] = []
    for k, v in series:
        window.append(v)
        if len(window) > 20:
            window.pop(0)
        if len(window) == 20:
            out.append((k, sum(window)))
    return out


def analyze(ind: dict, raw: list[tuple[str, float]], today: date) -> dict:
    freq = ind["frequency"]
    scale = ind.get("scale", 1.0)
    digits = ind.get("digits", 2)
    series = normalize_keys([(k, v * scale) for k, v in raw], freq)
    if ind.get("kind") == "flow20":
        series = flow20(series)
    basis = ind.get("regime_basis", "yoy")
    perf_mode = "diff" if basis == "level" else "pct"
    yoy = yoy_series(series, freq) if basis == "yoy" else [None] * len(series)
    cap = SERIES_CAP[freq]
    tail = series[-cap:]
    tail_yoy = yoy[-cap:]
    mom: list[float | None] = [None]
    for i in range(1, len(tail)):
        mom.append((tail[i][1] - tail[i - 1][1]) if perf_mode == "diff" else _pct(tail[i][1], tail[i - 1][1]))
    monthly = to_monthly(series)
    monthly_yoy = yoy_series(monthly, "M") if basis == "yoy" and freq != "Q" else []
    reg = regime(series, freq, basis, ind.get("tone", 1))
    st = window_stats(series)
    out = {
        "id": ind["id"], "name_kr": ind["name_kr"], "name_en": ind["name_en"], "categories": ind["categories"],
        "unit": ind["unit"], "frequency": freq, "source": ind["source"], "source_url": ind["source_url"],
        "source_series_id": ind["source_series_id"], "proxy": ind.get("proxy", False), "grade": ind.get("grade", "A"),
        "tone": ind.get("tone", 1), "regime_basis": basis, "perf_mode": perf_mode, "license": ind["license"],
        "note": ind.get("note") or None,
        "latest_value": _round(tail[-1][1], digits), "latest_date": tail[-1][0],
        "prev_value": _round(tail[-2][1], digits) if len(tail) > 1 else None,
        "latest_yoy": _round(tail_yoy[-1], 2) if tail_yoy and tail_yoy[-1] is not None else None,
        "latest_mom": _round(mom[-1], 2) if mom and mom[-1] is not None else None,
        "performance": {k: _round(v, 2) for k, v in performance(series, freq, perf_mode).items()},
        "stats": None if not st else {**st, "mean": _round(st["mean"], digits), "sd": _round(st["sd"], digits),
                                     "zscore": _round(st["zscore"], 2), "percentile": _round(st["percentile"], 3),
                                     "min": {"date": st["min"]["date"], "val": _round(st["min"]["val"], digits)},
                                     "max": {"date": st["max"]["date"], "val": _round(st["max"]["val"], digits)}},
        "seasonal": (lambda s: None if not s else {**s, "same_month_yoy_avg": _round(s["same_month_yoy_avg"], 2), "this_year_yoy": _round(s["this_year_yoy"], 2)})(
            seasonal(monthly, monthly_yoy) if monthly_yoy and freq == "M" else None),
        "regime": {**reg, "delta": _round(reg.get("delta"), 3), "threshold": _round(reg.get("threshold"), 3)},
        "next_release": next_release(ind.get("release"), today),
        "transforms_available": ["level", "yoy", "mom", "rebase100", "drawdown", "zscore"] if basis == "yoy" else ["level", "mom", "zscore"],
        "related_tickers": ind["related_tickers"], "related_indicators": ind.get("related_indicators", []),
        "sensitivity_validated": None,
        "series": [{"date": k, "val": _round(v, digits), **({"yoy": _round(y, 2)} if y is not None else {})}
                   for (k, v), y in zip(tail, tail_yoy)],
        "points": len(series),
    }
    return out


def build(keys: dict, only: set[str] = frozenset(), *, today: date | None = None) -> tuple[dict, list[str]]:
    today = today or kst_now().date()
    problems = validate_definitions(INDICATORS, CATEGORIES, DETAILS_US, DETAILS_KR)
    if problems:
        return {}, problems
    prev = load_previous()
    prev_ind = prev.get("indicators") if isinstance(prev.get("indicators"), dict) else {}
    start_iso = (today - timedelta(days=365 * HISTORY_YEARS + 400)).isoformat()
    built: dict[str, dict] = {}
    failures: list[str] = []
    carried = 0
    for ind in INDICATORS:
        iid = ind["id"]
        try:
            raw = fetch_raw(ind, keys, start_iso, only)
            if len(raw) < 3:
                raise RuntimeError(f"관측 {len(raw)}개 — 너무 적다")
            if stale(raw, ind["frequency"], today, ind.get("stale_days")):
                raise RuntimeError(f"stale — 최신 관측 {raw[-1][0]} (한도 {ind.get('stale_days') or STALE_DAYS[ind['frequency']]}일)")
            built[iid] = analyze(ind, raw, today)
            print(f"  [ok] {iid}: {built[iid]['latest_date']} {built[iid]['latest_value']} {ind['unit']}"
                  f" · YoY {built[iid]['latest_yoy']} · {built[iid]['regime']['direction']}")
        except Exception as exc:  # noqa: BLE001
            msg = f"{iid}: {type(exc).__name__}: {exc}"
            old = prev_ind.get(iid)
            if isinstance(old, dict) and old.get("latest_date"):
                since = old.get("carriedSince") or today.isoformat()
                if (today - date.fromisoformat(since)).days <= CARRY_DAYS:
                    old = dict(old)
                    old["carriedSince"] = since
                    old["next_release"] = next_release(ind.get("release"), today)
                    built[iid] = old
                    carried += 1
                    print(f"  [carry] {msg} — 직전 값 승계({since})")
                    continue
            failures.append(msg)
            print(f"  [fail] {msg}")
        if ind["src"][0] in ("fred", "net_liq"):
            time.sleep(0.25)
    if len(built) < MIN_INDICATORS:
        return {}, [f"수집된 지표 {len(built)}개 < {MIN_INDICATORS} — 기존 파일 유지"] + failures
    # 카테고리 정의 + 지표 목록(정의 순서)
    categories = []
    for c in CATEGORIES:
        ids = [i["id"] for i in INDICATORS if c["id"] in i["categories"] and i["id"] in built]
        categories.append({"id": c["id"], "name": c["name"], "sector_etfs": c["sector_etfs"],
                           "chain": [{"stage": s, "members": m} for s, m in c["chain"]], "indicators": ids})
    payload = {
        "updatedAtKst": kst_now_str(), "as_of_date": today.isoformat(),
        "policy": "빌드 시 계산한 서술 통계. 신호등·YoY 는 주가 방향을 뜻하지 않는다(8장). 검증되지 않은 '선행 N개월'은 싣지 않는다.",
        "count": len(built), "failed": failures, "carried": carried,
        "categories": categories, "indicators": built,
    }
    return payload, []


def build_by_ticker(payload: dict) -> dict:
    order = [i["id"] for i in INDICATORS]
    index: dict[str, list[str]] = {}
    for iid in order:
        ind = payload["indicators"].get(iid)
        if not ind:
            continue
        for r in ind["related_tickers"]:
            key = r.get("ticker") or r.get("code")
            index.setdefault(key, [])
            if iid not in index[key]:
                index[key].append(iid)
    return {"updatedAtKst": payload["updatedAtKst"], "count": len(index), "byTicker": index}


def build_signal(payload: dict) -> dict:
    cats = []
    for c in payload["categories"]:
        counts = {"improving": 0, "deteriorating": 0, "flat": 0, "unknown": 0}
        for iid in c["indicators"]:
            d = payload["indicators"][iid]["regime"]["direction"]
            counts[d if d in counts else "unknown"] += 1
        # 대표 지표 3개: 최근 발표된 순
        top = sorted(c["indicators"], key=lambda i: payload["indicators"][i]["latest_date"], reverse=True)[:3]
        cats.append({"id": c["id"], "name": c["name"], **counts, "top": top})
    return {"updatedAtKst": payload["updatedAtKst"], "count": len(cats), "categories": cats,
            "note": "개선/악화는 증가율의 방향(YoY 3MMA 의 3개월 변화)이며 주가 방향이 아니다"}


def build_calendar(payload: dict, today: date, days: int = 30) -> dict:
    rows = []
    for iid, ind in payload["indicators"].items():
        nr = ind.get("next_release")
        if not nr:
            continue
        if 0 <= nr["days_ahead"] <= days:
            rows.append({"id": iid, "name_kr": ind["name_kr"], "date": nr["date"], "time_kst": nr.get("time_kst"),
                         "note": nr.get("note"), "days_ahead": nr["days_ahead"], "consensus": None, "market_implied": None})
    rows.sort(key=lambda r: (r["date"], r["name_kr"]))
    return {"updatedAtKst": payload["updatedAtKst"], "count": len(rows), "from": today.isoformat(), "days": days, "events": rows}


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--only", default="", help="쉼표 구분: fred,tw,ecos,oecd (테스트용)")
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    keys = {"ecos": os.environ.get("ECOS_API_KEY", "").strip().strip('"')}
    print("=== 산업 선행지표 수집 (FRED · TWSE/TPEx · ECOS · OECD) ===")
    today = kst_now().date()
    payload, problems = build(keys, only, today=today)
    if problems:
        for p in problems:
            print(f"[industry] {p}")
        print("[industry] 게이트 실패 — 기존 파일 유지")
        return 1
    by_ticker = build_by_ticker(payload)
    signal = build_signal(payload)
    calendar = build_calendar(payload, today)
    sec.write_data(OUT_JSON, OUT_JS, "INDUSTRY_INDICATORS", payload, indent=None)
    sec.write_data(BY_TICKER_JSON, BY_TICKER_JS, "INDUSTRY_BY_TICKER", by_ticker, indent=None)
    sec.write_data(SIGNAL_JSON, SIGNAL_JS, "INDUSTRY_SIGNAL", signal, indent=None)
    sec.write_data(CALENDAR_JSON, CALENDAR_JS, "INDUSTRY_CALENDAR", calendar, indent=None, allow_empty=True)
    print(f"지표 {payload['count']}개(승계 {payload['carried']}, 실패 {len(payload['failed'])}) · 역인덱스 {by_ticker['count']}종목 · "
          f"발표 일정 {calendar['count']}건 → {OUT_JSON.name}")
    if args.push:
        paths = [str(p.relative_to(ROOT)).replace("\\", "/") for p in
                 (OUT_JSON, OUT_JS, BY_TICKER_JSON, BY_TICKER_JS, SIGNAL_JSON, SIGNAL_JS, CALENDAR_JSON, CALENDAR_JS)]
        paths.append("data/industry_archive")
        with repository_publish_lock(ROOT):
            if not sec.git_publish(paths, "industry indicators"):
                print("[industry] git push 실패")
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
