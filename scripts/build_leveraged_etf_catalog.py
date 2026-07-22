#!/usr/bin/env python3
"""Generate data/leveraged_etf_catalog.js from curated rows + Nasdaq auto-discovery."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# type: leveraged | inverse | covered-call | buffer | defined-outcome | volatility
# scope: index | sector | single-stock | commodity | international | thematic
ROWS = [
    # --- 지수 레버리지·인버스 ---
    ("TQQQ", "ProShares UltraPro QQQ", "leveraged", "3x", "long", "QQQ", "Nasdaq 100", "index", "나스닥 100", "ProShares"),
    ("SQQQ", "ProShares UltraPro Short QQQ", "inverse", "3x", "short", "QQQ", "Nasdaq 100", "index", "나스닥 100", "ProShares"),
    ("QLD", "ProShares Ultra QQQ", "leveraged", "2x", "long", "QQQ", "Nasdaq 100", "index", "나스닥 100", "ProShares"),
    ("QID", "ProShares UltraShort QQQ", "inverse", "2x", "short", "QQQ", "Nasdaq 100", "index", "나스닥 100", "ProShares"),
    ("UPRO", "ProShares UltraPro S&P500", "leveraged", "3x", "long", "SPY", "S&P 500", "index", "S&P 500", "ProShares"),
    ("SPXU", "ProShares UltraPro Short S&P500", "inverse", "3x", "short", "SPY", "S&P 500", "index", "S&P 500", "ProShares"),
    ("SPXL", "Direxion Daily S&P 500 Bull 3X", "leveraged", "3x", "long", "SPY", "S&P 500", "index", "S&P 500", "Direxion"),
    ("SPXS", "Direxion Daily S&P 500 Bear 3X", "inverse", "3x", "short", "SPY", "S&P 500", "index", "S&P 500", "Direxion"),
    ("SSO", "ProShares Ultra S&P500", "leveraged", "2x", "long", "SPY", "S&P 500", "index", "S&P 500", "ProShares"),
    ("SDS", "ProShares UltraShort S&P500", "inverse", "2x", "short", "SPY", "S&P 500", "index", "S&P 500", "ProShares"),
    ("SH", "ProShares Short S&P500", "inverse", "1x", "short", "SPY", "S&P 500", "index", "S&P 500", "ProShares"),
    ("SPYU", "Bank of Montreal MAX S&P 500 4X", "leveraged", "4x", "long", "SPY", "S&P 500", "index", "S&P 500", "MicroSectors"),
    ("TNA", "Direxion Daily Small Cap Bull 3X", "leveraged", "3x", "long", "IWM", "Russell 2000", "index", "러셀 2000", "Direxion"),
    ("TZA", "Direxion Daily Small Cap Bear 3X", "inverse", "3x", "short", "IWM", "Russell 2000", "index", "러셀 2000", "Direxion"),
    ("URTY", "ProShares UltraPro Russell2000", "leveraged", "3x", "long", "IWM", "Russell 2000", "index", "러셀 2000", "ProShares"),
    ("SRTY", "ProShares UltraPro Short Russell2000", "inverse", "3x", "short", "IWM", "Russell 2000", "index", "러셀 2000", "ProShares"),
    ("UDOW", "ProShares UltraPro Dow30", "leveraged", "3x", "long", "DIA", "Dow Jones", "index", "다우존스", "ProShares"),
    ("SDOW", "ProShares UltraPro Short Dow30", "inverse", "3x", "short", "DIA", "Dow Jones", "index", "다우존스", "ProShares"),
    ("FNGU", "MicroSectors FANG+ 3X Leveraged", "leveraged", "3x", "long", "FNGS", "FANG+", "index", "FANG+", "MicroSectors"),
    ("FNGD", "MicroSectors FANG+ -3X Inverse", "inverse", "3x", "short", "FNGS", "FANG+", "index", "FANG+", "MicroSectors"),
    # --- 섹터 ---
    ("SOXL", "Direxion Daily Semiconductor Bull 3X", "leveraged", "3x", "long", "SOXX", "반도체", "sector", "반도체", "Direxion"),
    ("SOXS", "Direxion Daily Semiconductor Bear 3X", "inverse", "3x", "short", "SOXX", "반도체", "sector", "반도체", "Direxion"),
    ("TECL", "Direxion Daily Technology Bull 3X", "leveraged", "3x", "long", "XLK", "정보기술", "sector", "정보기술", "Direxion"),
    ("TECS", "Direxion Daily Technology Bear 3X", "inverse", "3x", "short", "XLK", "정보기술", "sector", "정보기술", "Direxion"),
    ("FAS", "Direxion Daily Financial Bull 3X", "leveraged", "3x", "long", "XLF", "금융", "sector", "금융", "Direxion"),
    ("FAZ", "Direxion Daily Financial Bear 3X", "inverse", "3x", "short", "XLF", "금융", "sector", "금융", "Direxion"),
    ("ERX", "Direxion Daily Energy Bull 2X", "leveraged", "2x", "long", "XLE", "에너지", "sector", "에너지", "Direxion"),
    ("ERY", "Direxion Daily Energy Bear 2X", "inverse", "2x", "short", "XLE", "에너지", "sector", "에너지", "Direxion"),
    ("LABU", "Direxion Daily Biotech Bull 3X", "leveraged", "3x", "long", "XBI", "바이오", "sector", "바이오테크", "Direxion"),
    ("LABD", "Direxion Daily Biotech Bear 3X", "inverse", "3x", "short", "XBI", "바이오", "sector", "바이오테크", "Direxion"),
    ("CURE", "Direxion Daily Healthcare Bull 3X", "leveraged", "3x", "long", "XLV", "헬스케어", "sector", "헬스케어", "Direxion"),
    ("DPST", "Direxion Daily Regional Banks Bull 3X", "leveraged", "3x", "long", "KRE", "지역은행", "sector", "지역은행", "Direxion"),
    ("NAIL", "Direxion Daily Homebuilders Bull 3X", "leveraged", "3x", "long", "XHB", "주택건설", "sector", "주택·건설", "Direxion"),
    ("DFEN", "Direxion Daily Aerospace & Defense Bull 3X", "leveraged", "3x", "long", "ITA", "항공우주·방산", "sector", "항공우주·방산", "Direxion"),
    ("WEBL", "Direxion Daily Dow Jones Internet Bull 3X", "leveraged", "3x", "long", "FDN", "인터넷", "sector", "인터넷", "Direxion"),
    ("WEBS", "Direxion Daily Dow Jones Internet Bear 3X", "inverse", "3x", "short", "FDN", "인터넷", "sector", "인터넷", "Direxion"),
    ("HIBL", "Direxion Daily S&P 500 High Beta Bull 3X", "leveraged", "3x", "long", "SPHB", "고베타", "sector", "고베타", "Direxion"),
    ("HIBS", "Direxion Daily S&P 500 High Beta Bear 3X", "inverse", "3x", "short", "SPHB", "고베타", "sector", "고베타", "Direxion"),
    ("RETL", "Direxion Daily Retail Bull 3X", "leveraged", "3x", "long", "XRT", "소매", "sector", "소매", "Direxion"),
    ("WANT", "Direxion Daily Consumer Discretionary Bull 3X", "leveraged", "3x", "long", "XLY", "임의소비재", "sector", "임의소비재", "Direxion"),
    # --- 개별종목 레버리지·인버스 ---
    ("NVDL", "GraniteShares 2x Long NVDA", "leveraged", "2x", "long", "NVDA", "엔비디아", "single-stock", "NVDA", "GraniteShares"),
    ("NVDX", "T-Rex 2X Long NVIDIA", "leveraged", "2x", "long", "NVDA", "엔비디아", "single-stock", "NVDA", "T-Rex"),
    ("NVDU", "Direxion Daily NVDA Bull 2X", "leveraged", "2x", "long", "NVDA", "엔비디아", "single-stock", "NVDA", "Direxion"),
    ("NVD", "GraniteShares 1x Short NVDA", "inverse", "1x", "short", "NVDA", "엔비디아", "single-stock", "NVDA", "GraniteShares"),
    ("NVDD", "Direxion Daily NVDA Bear 1X", "inverse", "1x", "short", "NVDA", "엔비디아", "single-stock", "NVDA", "Direxion"),
    ("NVDQ", "T-Rex 2X Inverse NVIDIA", "inverse", "2x", "short", "NVDA", "엔비디아", "single-stock", "NVDA", "T-Rex"),
    ("TSLL", "Direxion Daily TSLA Bull 2X", "leveraged", "2x", "long", "TSLA", "테슬라", "single-stock", "TSLA", "Direxion"),
    ("TSLQ", "Tradr 2X Short TSLA", "inverse", "2x", "short", "TSLA", "테슬라", "single-stock", "TSLA", "Tradr"),
    ("TSLT", "T-Rex 2X Long Tesla", "leveraged", "2x", "long", "TSLA", "테슬라", "single-stock", "TSLA", "T-Rex"),
    ("TSLZ", "T-Rex 2X Inverse Tesla", "inverse", "2x", "short", "TSLA", "테슬라", "single-stock", "TSLA", "T-Rex"),
    ("MSTU", "T-Rex 2X Long MSTR", "leveraged", "2x", "long", "MSTR", "마이크로스트래티지", "single-stock", "MSTR", "T-Rex"),
    ("MSTX", "Defiance 2X Long MSTR", "leveraged", "2x", "long", "MSTR", "마이크로스트래티지", "single-stock", "MSTR", "Defiance"),
    ("MSTZ", "T-Rex 2X Inverse MSTR", "inverse", "2x", "short", "MSTR", "마이크로스트래티지", "single-stock", "MSTR", "T-Rex"),
    ("AMDL", "GraniteShares 2x Long AMD", "leveraged", "2x", "long", "AMD", "AMD", "single-stock", "AMD", "GraniteShares"),
    ("AMDS", "GraniteShares 1x Short AMD", "inverse", "1x", "short", "AMD", "AMD", "single-stock", "AMD", "GraniteShares"),
    ("AMZU", "Direxion Daily AMZN Bull 2X", "leveraged", "2x", "long", "AMZN", "아마존", "single-stock", "AMZN", "Direxion"),
    ("AMZD", "Direxion Daily AMZN Bear 1X", "inverse", "1x", "short", "AMZN", "아마존", "single-stock", "AMZN", "Direxion"),
    ("AAPU", "Direxion Daily AAPL Bull 2X", "leveraged", "2x", "long", "AAPL", "애플", "single-stock", "AAPL", "Direxion"),
    ("AAPD", "Direxion Daily AAPL Bear 1X", "inverse", "1x", "short", "AAPL", "애플", "single-stock", "AAPL", "Direxion"),
    ("MSFU", "Direxion Daily MSFT Bull 2X", "leveraged", "2x", "long", "MSFT", "마이크로소프트", "single-stock", "MSFT", "Direxion"),
    ("MSFD", "Direxion Daily MSFT Bear 1X", "inverse", "1x", "short", "MSFT", "마이크로소프트", "single-stock", "MSFT", "Direxion"),
    ("GOGL", "Direxion Daily GOOGL Bull 2X", "leveraged", "2x", "long", "GOOGL", "알파벳", "single-stock", "GOOGL", "Direxion"),
    ("GGLL", "Direxion Daily GOOGL Bull 2X", "leveraged", "2x", "long", "GOOGL", "알파벳", "single-stock", "GOOGL", "Direxion"),
    ("METU", "Direxion Daily META Bull 2X", "leveraged", "2x", "long", "META", "메타", "single-stock", "META", "Direxion"),
    ("METD", "Direxion Daily META Bear 1X", "inverse", "1x", "short", "META", "메타", "single-stock", "META", "Direxion"),
    ("CONL", "GraniteShares 2x Long COIN", "leveraged", "2x", "long", "COIN", "코인베이스", "single-stock", "COIN", "GraniteShares"),
    ("CONI", "GraniteShares 1x Short COIN", "inverse", "1x", "short", "COIN", "코인베이스", "single-stock", "COIN", "GraniteShares"),
    ("PTIR", "GraniteShares 2x Long PLTR", "leveraged", "2x", "long", "PLTR", "팔란티어", "single-stock", "PLTR", "GraniteShares"),
    ("PLTU", "Direxion Daily PLTR Bull 2X", "leveraged", "2x", "long", "PLTR", "팔란티어", "single-stock", "PLTR", "Direxion"),
    ("NFXL", "Direxion Daily NFLX Bull 2X", "leveraged", "2x", "long", "NFLX", "넷플릭스", "single-stock", "NFLX", "Direxion"),
    ("INTW", "GraniteShares 2x Long INTC", "leveraged", "2x", "long", "INTC", "인텔", "single-stock", "INTC", "GraniteShares"),
    ("SMCX", "Defiance 2X Long SMCI", "leveraged", "2x", "long", "SMCI", "슈퍼마이크로", "single-stock", "SMCI", "Defiance"),
    ("SMCZ", "Defiance 2X Short SMCI", "inverse", "2x", "short", "SMCI", "슈퍼마이크로", "single-stock", "SMCI", "Defiance"),
    ("IONX", "Defiance 2X Long IONQ", "leveraged", "2x", "long", "IONQ", "아이온큐", "single-stock", "IONQ", "Defiance"),
    ("BABX", "GraniteShares 2x Long BABA", "leveraged", "2x", "long", "BABA", "알리바바", "single-stock", "BABA", "GraniteShares"),
    ("BRKU", "Direxion Daily BRK.B Bull 2X", "leveraged", "2x", "long", "BRK.B", "버크셔", "single-stock", "BRK.B", "Direxion"),
    ("DISO", "YieldMax DIS Short Option Income", "covered-call", "옵션", "neutral", "DIS", "디즈니", "single-stock", "DIS", "YieldMax"),
    ("GMEU", "T-Rex 2X Long GME", "leveraged", "2x", "long", "GME", "게임스톱", "single-stock", "GME", "T-Rex"),
    # --- 커버드콜·옵션인컴 ---
    ("QYLD", "Global X Nasdaq 100 Covered Call", "covered-call", "옵션", "neutral", "QQQ", "Nasdaq 100", "index", "나스닥 커버드콜", "Global X"),
    ("XYLD", "Global X S&P 500 Covered Call", "covered-call", "옵션", "neutral", "SPY", "S&P 500", "index", "S&P 커버드콜", "Global X"),
    ("RYLD", "Global X Russell 2000 Covered Call", "covered-call", "옵션", "neutral", "IWM", "Russell 2000", "index", "러셀 커버드콜", "Global X"),
    ("JEPI", "JPMorgan Equity Premium Income", "covered-call", "옵션", "neutral", "SPY", "S&P 500", "index", "주식 프리미엄", "JPMorgan"),
    ("JEPQ", "JPMorgan Nasdaq Equity Premium Income", "covered-call", "옵션", "neutral", "QQQ", "Nasdaq 100", "index", "나스닥 프리미엄", "JPMorgan"),
    ("NVDY", "YieldMax NVDA Option Income", "covered-call", "옵션", "neutral", "NVDA", "엔비디아", "single-stock", "NVDA 옵션인컴", "YieldMax"),
    ("CONY", "YieldMax COIN Option Income", "covered-call", "옵션", "neutral", "COIN", "코인베이스", "single-stock", "COIN 옵션인컴", "YieldMax"),
    ("TSLY", "YieldMax TSLA Option Income", "covered-call", "옵션", "neutral", "TSLA", "테슬라", "single-stock", "TSLA 옵션인컴", "YieldMax"),
    ("AMDY", "YieldMax AMD Option Income", "covered-call", "옵션", "neutral", "AMD", "AMD", "single-stock", "AMD 옵션인컴", "YieldMax"),
    ("APLY", "YieldMax AAPL Option Income", "covered-call", "옵션", "neutral", "AAPL", "애플", "single-stock", "AAPL 옵션인컴", "YieldMax"),
    ("FBY", "YieldMax META Option Income", "covered-call", "옵션", "neutral", "META", "메타", "single-stock", "META 옵션인컴", "YieldMax"),
    ("GDXY", "YieldMax Gold Miners Option Income", "covered-call", "옵션", "neutral", "GDX", "금광", "sector", "금광 옵션인컴", "YieldMax"),
    ("JPMO", "YieldMax JPM Option Income", "covered-call", "옵션", "neutral", "JPM", "JP모건", "single-stock", "JPM 옵션인컴", "YieldMax"),
    ("MRNY", "YieldMax MRNA Option Income", "covered-call", "옵션", "neutral", "MRNA", "모더나", "single-stock", "MRNA 옵션인컴", "YieldMax"),
    ("MSFO", "YieldMax MSFT Option Income", "covered-call", "옵션", "neutral", "MSFT", "마이크로소프트", "single-stock", "MSFT 옵션인컴", "YieldMax"),
    ("PYPY", "YieldMax PYPL Option Income", "covered-call", "옵션", "neutral", "PYPL", "페이팔", "single-stock", "PYPL 옵션인컴", "YieldMax"),
    ("XOMO", "YieldMax XOM Option Income", "covered-call", "옵션", "neutral", "XOM", "엑슨모빌", "single-stock", "XOM 옵션인컴", "YieldMax"),
    ("YMAX", "YieldMax Universe Fund of Option Income", "covered-call", "옵션", "neutral", "—", "멀티", "thematic", "멀티 옵션인컴", "YieldMax"),
    ("YMAG", "YieldMax Magnificent 7 Option Income", "covered-call", "옵션", "neutral", "MAG7", "빅테크 7", "thematic", "매그7 옵션인컴", "YieldMax"),
    ("ULTY", "YieldMax Ultra Option Income", "covered-call", "옵션", "neutral", "—", "멀티", "thematic", "울트라 옵션인컴", "YieldMax"),
    ("QQQY", "Defiance Nasdaq 100 Enhanced Options", "covered-call", "옵션", "neutral", "QQQ", "Nasdaq 100", "index", "나스닥 옵션인컴", "Defiance"),
    ("IWMY", "Defiance Russell 2000 Enhanced Options", "covered-call", "옵션", "neutral", "IWM", "Russell 2000", "index", "러셀 옵션인컴", "Defiance"),
    ("SPYI", "NEOS S&P 500 High Income", "covered-call", "옵션", "neutral", "SPY", "S&P 500", "index", "S&P 옵션인컴", "NEOS"),
    ("SVOL", "Simplify Volatility Premium", "covered-call", "옵션", "neutral", "VIX", "변동성", "volatility", "VIX 프리미엄", "Simplify"),
    ("COIW", "Roundhill COIN Covered Call", "covered-call", "옵션", "neutral", "COIN", "코인베이스", "single-stock", "COIN 커버드콜", "Roundhill"),
    # --- 변동성 ---
    ("UVXY", "ProShares Ultra VIX Short-Term Futures", "volatility", "1.5x", "long", "VIX", "VIX", "volatility", "VIX 롱", "ProShares"),
    ("SVXY", "ProShares Short VIX Short-Term Futures", "volatility", "0.5x", "short", "VIX", "VIX", "volatility", "VIX 숏", "ProShares"),
    ("VIXY", "ProShares VIX Short-Term Futures", "volatility", "1x", "long", "VIX", "VIX", "volatility", "VIX", "ProShares"),
    ("UVIX", "2x Long VIX Futures", "volatility", "2x", "long", "VIX", "VIX", "volatility", "VIX 2x", "Volatility Shares"),
    ("SVIX", "-1x Short VIX Futures", "volatility", "1x", "short", "VIX", "VIX", "volatility", "VIX 인버스", "Volatility Shares"),
    # --- 원자재 ---
    ("NUGT", "Direxion Daily Gold Miners Bull 2X", "leveraged", "2x", "long", "GDX", "금광", "commodity", "금광", "Direxion"),
    ("DUST", "Direxion Daily Gold Miners Bear 2X", "inverse", "2x", "short", "GDX", "금광", "commodity", "금광", "Direxion"),
    ("JNUG", "Direxion Daily Junior Gold Bull 2X", "leveraged", "2x", "long", "GDXJ", "주니어금광", "commodity", "금광", "Direxion"),
    ("JDST", "Direxion Daily Junior Gold Bear 2X", "inverse", "2x", "short", "GDXJ", "주니어금광", "commodity", "금광", "Direxion"),
    ("UGL", "ProShares Ultra Gold", "leveraged", "2x", "long", "GLD", "금", "commodity", "금", "ProShares"),
    ("GLL", "ProShares UltraShort Gold", "inverse", "2x", "short", "GLD", "금", "commodity", "금", "ProShares"),
    ("BOIL", "ProShares Ultra Bloomberg Natural Gas", "leveraged", "2x", "long", "UNG", "천연가스", "commodity", "천연가스", "ProShares"),
    ("KOLD", "ProShares UltraShort Bloomberg Natural Gas", "inverse", "2x", "short", "UNG", "천연가스", "commodity", "천연가스", "ProShares"),
    ("UCO", "ProShares Ultra Bloomberg Crude Oil", "leveraged", "2x", "long", "USO", "원유", "commodity", "원유", "ProShares"),
    ("SCO", "ProShares UltraShort Bloomberg Crude Oil", "inverse", "2x", "short", "USO", "원유", "commodity", "원유", "ProShares"),
    # --- 국제·테마 ---
    ("YINN", "Direxion Daily FTSE China Bull 3X", "leveraged", "3x", "long", "FXI", "중국", "international", "중국", "Direxion"),
    ("YANG", "Direxion Daily FTSE China Bear 3X", "inverse", "3x", "short", "FXI", "중국", "international", "중국", "Direxion"),
    ("CHAU", "Direxion Daily CSI 300 China A Share Bull 2X", "leveraged", "2x", "long", "ASHR", "중국 A주", "international", "중국", "Direxion"),
    ("CWEB", "Direxion Daily CSI China Internet Bull 2X", "leveraged", "2x", "long", "KWEB", "중국 인터넷", "international", "중국 테크", "Direxion"),
    ("KORU", "Direxion Daily South Korea Bull 3X", "leveraged", "3x", "long", "EWY", "한국", "international", "한국", "Direxion"),
    ("EDC", "Direxion Daily MSCI Emerging Markets Bull 3X", "leveraged", "3x", "long", "EEM", "신흥국", "international", "신흥국", "Direxion"),
    ("EDZ", "Direxion Daily MSCI Emerging Markets Bear 3X", "inverse", "3x", "short", "EEM", "신흥국", "international", "신흥국", "Direxion"),
    ("BRZU", "Direxion Daily MSCI Brazil Bull 2X", "leveraged", "2x", "long", "EWZ", "브라질", "international", "브라질", "Direxion"),
    ("EZJ", "Direxion Daily MSCI Japan Bull 3X", "leveraged", "3x", "long", "EWJ", "일본", "international", "일본", "Direxion"),
    ("EURL", "Direxion Daily FTSE Europe Bull 3X", "leveraged", "3x", "long", "FEZ", "유럽", "international", "유럽", "Direxion"),
    ("TMF", "Direxion Daily 20+ Year Treasury Bull 3X", "leveraged", "3x", "long", "TLT", "장기국채", "thematic", "국채", "Direxion"),
    ("TMV", "Direxion Daily 20+ Year Treasury Bear 3X", "inverse", "3x", "short", "TLT", "장기국채", "thematic", "국채", "Direxion"),
    ("TBT", "ProShares UltraShort 20+ Year Treasury", "inverse", "2x", "short", "TLT", "장기국채", "thematic", "국채", "ProShares"),
    ("TYD", "Direxion Daily 7-10 Year Treasury Bull 3X", "leveraged", "3x", "long", "IEF", "중기국채", "thematic", "국채", "Direxion"),
    ("TYO", "Direxion Daily 7-10 Year Treasury Bear 3X", "inverse", "3x", "short", "IEF", "중기국채", "thematic", "국채", "Direxion"),
    # --- 추가 섹터 레버리지·인버스 ---
    ("DRN", "Direxion Daily Real Estate Bull 3X", "leveraged", "3x", "long", "XLRE", "리츠", "sector", "리츠", "Direxion"),
    ("DRE", "Direxion Daily Real Estate Bear 3X", "inverse", "3x", "short", "XLRE", "리츠", "sector", "리츠", "Direxion"),
    ("UTSL", "Direxion Daily Utilities Bull 3X", "leveraged", "3x", "long", "XLU", "유틸리티", "sector", "유틸리티", "Direxion"),
    ("UXI", "ProShares Ultra Industrials", "leveraged", "2x", "long", "XLI", "산업재", "sector", "산업재", "ProShares"),
    ("SIJ", "ProShares UltraShort Industrials", "inverse", "2x", "short", "XLI", "산업재", "sector", "산업재", "ProShares"),
    ("MIDU", "Direxion Daily Mid Cap Bull 3X", "leveraged", "3x", "long", "MDY", "중형주", "index", "중형주", "Direxion"),
    ("MIDZ", "Direxion Daily Mid Cap Bear 3X", "inverse", "3x", "short", "MDY", "중형주", "index", "중형주", "Direxion"),
    ("UYG", "ProShares Ultra Financials", "leveraged", "2x", "long", "XLF", "금융", "sector", "금융", "ProShares"),
    ("SKF", "ProShares UltraShort Financials", "inverse", "2x", "short", "XLF", "금융", "sector", "금융", "ProShares"),
    ("RXL", "ProShares Ultra Health Care", "leveraged", "2x", "long", "XLV", "헬스케어", "sector", "헬스케어", "ProShares"),
    ("RXD", "ProShares UltraShort Health Care", "inverse", "2x", "short", "XLV", "헬스케어", "sector", "헬스케어", "ProShares"),
    ("GUSH", "Direxion Daily S&P Oil & Gas Exp Bull 2X", "leveraged", "2x", "long", "XOP", "석유가스", "sector", "석유·가스", "Direxion"),
    ("DRIP", "Direxion Daily S&P Oil & Gas Exp Bear 2X", "inverse", "2x", "short", "XOP", "석유가스", "sector", "석유·가스", "Direxion"),
    ("SCC", "ProShares UltraShort Consumer Services", "inverse", "2x", "short", "XLY", "임의소비재", "sector", "임의소비재", "ProShares"),
    # --- 크립토 레버리지·인버스 ---
    ("BITX", "2x Bitcoin Strategy ETF", "leveraged", "2x", "long", "BTC", "비트코인", "thematic", "비트코인", "Volatility Shares"),
    ("BITU", "ProShares Ultra Bitcoin ETF", "leveraged", "2x", "long", "BTC", "비트코인", "thematic", "비트코인", "ProShares"),
    ("SBIT", "ProShares Short Bitcoin ETF", "inverse", "1x", "short", "BTC", "비트코인", "thematic", "비트코인", "ProShares"),
    ("BITI", "ProShares Short Bitcoin Strategy ETF", "inverse", "1x", "short", "BTC", "비트코인", "thematic", "비트코인", "ProShares"),
    ("ETHU", "2x Ether ETF", "leveraged", "2x", "long", "ETH", "이더리움", "thematic", "이더리움", "Volatility Shares"),
    ("ETHD", "ProShares UltraShort Ether ETF", "inverse", "2x", "short", "ETH", "이더리움", "thematic", "이더리움", "ProShares"),
    ("TARK", "Tradr 2X Long Innovation ETF", "leveraged", "2x", "long", "ARKK", "혁신성장", "thematic", "ARK 혁신", "Tradr"),
    # --- 추가 개별종목 레버리지·인버스 ---
    ("AVGX", "GraniteShares 2x Long AVGO Daily", "leveraged", "2x", "long", "AVGO", "브로드컴", "single-stock", "AVGO", "GraniteShares"),
    ("TSLR", "GraniteShares 2x Long TSLA Daily", "leveraged", "2x", "long", "TSLA", "테슬라", "single-stock", "TSLA", "GraniteShares"),
    ("TSDD", "GraniteShares 2x Short TSLA Daily", "inverse", "2x", "short", "TSLA", "테슬라", "single-stock", "TSLA", "GraniteShares"),
    ("HOOX", "Defiance 2X Long HOOD Daily", "leveraged", "2x", "long", "HOOD", "로빈후드", "single-stock", "HOOD", "Defiance"),
    ("RKLX", "Defiance 2X Long RKLB Daily", "leveraged", "2x", "long", "RKLB", "로켓랩", "single-stock", "RKLB", "Defiance"),
    ("CRWL", "GraniteShares 2x Long CRWD Daily", "leveraged", "2x", "long", "CRWD", "크라우드스트라이크", "single-stock", "CRWD", "GraniteShares"),
    ("AMZZ", "GraniteShares 2x Long AMZN Daily", "leveraged", "2x", "long", "AMZN", "아마존", "single-stock", "AMZN", "GraniteShares"),
    ("MSFX", "T-Rex 2X Long Microsoft Daily", "leveraged", "2x", "long", "MSFT", "마이크로소프트", "single-stock", "MSFT", "T-Rex"),
    ("MULL", "GraniteShares 2x Long MU Daily", "leveraged", "2x", "long", "MU", "마이크론", "single-stock", "MU", "GraniteShares"),
    ("AMUU", "Direxion Daily AMD Bull 2X Shares", "leveraged", "2x", "long", "AMD", "AMD", "single-stock", "AMD", "Direxion"),
    ("AMDD", "Tradr 2X Short AMD Daily", "inverse", "2x", "short", "AMD", "AMD", "single-stock", "AMD", "Tradr"),
    ("NFLU", "T-Rex 2X Long NFLX Daily", "leveraged", "2x", "long", "NFLX", "넷플릭스", "single-stock", "NFLX", "T-Rex"),
    ("BABO", "YieldMax BABA Option Income Strategy", "covered-call", "옵션", "neutral", "BABA", "알리바바", "single-stock", "BABA 옵션인컴", "YieldMax"),
    ("GOOY", "YieldMax GOOGL Option Income Strategy", "covered-call", "옵션", "neutral", "GOOGL", "알파벳", "single-stock", "GOOGL 옵션인컴", "YieldMax"),
    ("AMZY", "YieldMax AMZN Option Income Strategy", "covered-call", "옵션", "neutral", "AMZN", "아마존", "single-stock", "AMZN 옵션인컴", "YieldMax"),
    ("NFLY", "YieldMax NFLX Option Income Strategy", "covered-call", "옵션", "neutral", "NFLX", "넷플릭스", "single-stock", "NFLX 옵션인컴", "YieldMax"),
    ("PLTY", "YieldMax PLTR Option Income Strategy", "covered-call", "옵션", "neutral", "PLTR", "팔란티어", "single-stock", "PLTR 옵션인컴", "YieldMax"),
    ("MARO", "YieldMax MARA Option Income Strategy", "covered-call", "옵션", "neutral", "MARA", "마라톤", "single-stock", "MARA 옵션인컴", "YieldMax"),
    ("OARK", "YieldMax Innovation Option Income Strategy", "covered-call", "옵션", "neutral", "ARKK", "ARK 혁신", "thematic", "ARK 옵션인컴", "YieldMax"),
    ("SNOY", "YieldMax SNOW Option Income Strategy", "covered-call", "옵션", "neutral", "SNOW", "스노우플레이크", "single-stock", "SNOW 옵션인컴", "YieldMax"),
    ("TSMY", "YieldMax TSM Option Income Strategy", "covered-call", "옵션", "neutral", "TSM", "TSMC", "single-stock", "TSM 옵션인컴", "YieldMax"),
    ("MSTY", "YieldMax MSTR Option Income Strategy", "covered-call", "옵션", "neutral", "MSTR", "마이크로스트래티지", "single-stock", "MSTR 옵션인컴", "YieldMax"),
    ("HOOW", "YieldMax HOOD Option Income Strategy", "covered-call", "옵션", "neutral", "HOOD", "로빈후드", "single-stock", "HOOD 옵션인컴", "YieldMax"),
    ("RBLY", "YieldMax RBLX Option Income Strategy", "covered-call", "옵션", "neutral", "RBLX", "로블록스", "single-stock", "RBLX 옵션인컴", "YieldMax"),
    ("YBIT", "YieldMax Bitcoin Option Income Strategy", "covered-call", "옵션", "neutral", "BTC", "비트코인", "thematic", "BTC 옵션인컴", "YieldMax"),
    ("CVNY", "YieldMax CVNA Option Income Strategy", "covered-call", "옵션", "neutral", "CVNA", "카바나", "single-stock", "CVNA 옵션인컴", "YieldMax"),
    ("LLYX", "YieldMax LLY Option Income Strategy", "covered-call", "옵션", "neutral", "LLY", "일라이릴리", "single-stock", "LLY 옵션인컴", "YieldMax"),
    # --- 추가 커버드콜·0DTE ---
    ("NVDW", "Roundhill NVDA WeeklyPay Covered Call", "covered-call", "옵션", "neutral", "NVDA", "엔비디아", "single-stock", "NVDA 커버드콜", "Roundhill"),
    ("TSLW", "Roundhill TSLA WeeklyPay Covered Call", "covered-call", "옵션", "neutral", "TSLA", "테슬라", "single-stock", "TSLA 커버드콜", "Roundhill"),
    ("PLTW", "Roundhill PLTR WeeklyPay Covered Call", "covered-call", "옵션", "neutral", "PLTR", "팔란티어", "single-stock", "PLTR 커버드콜", "Roundhill"),
    ("XDTE", "Roundhill S&P 500 0DTE Covered Call", "covered-call", "옵션", "neutral", "SPY", "S&P 500", "index", "S&P 0DTE", "Roundhill"),
    ("QDTE", "Roundhill Nasdaq 100 0DTE Covered Call", "covered-call", "옵션", "neutral", "QQQ", "Nasdaq 100", "index", "나스닥 0DTE", "Roundhill"),
    ("RDTE", "Roundhill Russell 2000 0DTE Covered Call", "covered-call", "옵션", "neutral", "IWM", "Russell 2000", "index", "러셀 0DTE", "Roundhill"),
    ("QQQI", "NEOS Nasdaq 100 High Income ETF", "covered-call", "옵션", "neutral", "QQQ", "Nasdaq 100", "index", "나스닥 옵션인컴", "NEOS"),
    ("IWMI", "NEOS Russell 2000 High Income ETF", "covered-call", "옵션", "neutral", "IWM", "Russell 2000", "index", "러셀 옵션인컴", "NEOS"),
    ("DIVO", "Amplify CWP Enhanced Dividend Income", "covered-call", "옵션", "neutral", "SPY", "S&P 500", "index", "배당+콜", "Amplify"),
    ("BALI", "iShares Large Cap 10% Buffer Mar ETF", "buffer", "버퍼", "neutral", "SPY", "S&P 500", "index", "버퍼 ETF", "iShares"),
    # --- 추가 원자재 ---
    ("AGQ", "ProShares Ultra Silver", "leveraged", "2x", "long", "SLV", "은", "commodity", "은", "ProShares"),
    ("ZSL", "ProShares UltraShort Silver", "inverse", "2x", "short", "SLV", "은", "commodity", "은", "ProShares"),
    ("SLVO", "Credit Suisse Silver Shares Covered Call", "covered-call", "옵션", "neutral", "SLV", "은", "commodity", "은 커버드콜", "Credit Suisse"),
    ("WTIU", "MicroSectors Energy 3X Leveraged", "leveraged", "3x", "long", "XLE", "에너지", "commodity", "에너지", "MicroSectors"),
    ("WTID", "MicroSectors Energy -3X Inverse", "inverse", "3x", "short", "XLE", "에너지", "commodity", "에너지", "MicroSectors"),
    # --- 추가 국제 ---
    ("INDL", "Direxion Daily MSCI India Bull 2X", "leveraged", "2x", "long", "INDA", "인도", "international", "인도", "Direxion"),
    ("INDZ", "Direxion Daily MSCI India Bear 2X", "inverse", "2x", "short", "INDA", "인도", "international", "인도", "Direxion"),
    ("MEXX", "Direxion Daily MSCI Mexico Bull 3X", "leveraged", "3x", "long", "EWW", "멕시코", "international", "멕시코", "Direxion"),
    ("TUR", "Direxion Daily MSCI Turkey Bull 2X", "leveraged", "2x", "long", "TUR", "터키", "international", "터키", "Direxion"),
    ("YXI", "ProShares Short FTSE China 50", "inverse", "1x", "short", "FXI", "중국", "international", "중국", "ProShares"),
]

FIELDS = ("ticker", "name", "type", "leverage", "direction", "underlying", "underlyingLabel", "scope", "group", "issuer")

LEV_ETF_EXCLUDE_RE = re.compile(
    r"ultra[- ]short|ultrashort|short[- ]duration|short[- ]maturity|"
    r"enhanced short maturity|ultra[- ]short[- ]municipal|ultra[- ]short[- ]income",
    re.I,
)

LEV_ETF_INCLUDE_RES = [
    re.compile(p, re.I)
    for p in (
        r"direxion\s+daily",
        r"proshares\s+ultra(?!pro)",
        r"proshares\s+short\b",
        r"graniteshares\s+\d",
        r"yieldmax\b",
        r"\btradr\s+\d",
        r"defiance\s+\d",
        r"t[- ]?rex\s+\d",
        r"leverage\s+shares\s+\d",
        r"kraneshares\s+\d",
        r"microsectors\b",
        r"roundhill\b.*(covered|weekly|0dte|option)",
        r"neos\b.*(income|0dte|covered)",
        r"volatility\s+shares",
        r"\b\d+x\s+(long|short|leveraged|inverse)",
        r"\b-?\d+x\b",
        r"\bultrapro\b",
        r"\bdaily\s+(bull|bear)\b",
        r"\binverse\s+leverag",
        r"\bleverag(ed)?\s+etn",
        r"\bcovered\s+call\b",
        r"\bbuywrite\b",
        r"\boption\s+income\b",
        r"\bweeklypay\b",
        r"\b0dte\b",
        r"\bvix\b.*\bfutures\b",
        r"\bultra\s+vix\b",
        r"\bshort\s+vix\b",
    )
]

ISSUER_HINTS = (
    ("Direxion", "Direxion"),
    ("ProShares", "ProShares"),
    ("GraniteShares", "GraniteShares"),
    ("YieldMax", "YieldMax"),
    ("T-Rex", "T-Rex"),
    ("Tradr", "Tradr"),
    ("Defiance", "Defiance"),
    ("Leverage Shares", "Leverage Shares"),
    ("KraneShares", "KraneShares"),
    ("MicroSectors", "MicroSectors"),
    ("Roundhill", "Roundhill"),
    ("NEOS", "NEOS"),
    ("Volatility Shares", "Volatility Shares"),
    ("Global X", "Global X"),
    ("Amplify", "Amplify"),
    ("Simplify", "Simplify"),
    ("ETRACS", "ETRACS"),
)


def is_leveraged_option_etf(name: str) -> bool:
    text = str(name or "").strip()
    if not text or LEV_ETF_EXCLUDE_RE.search(text):
        return False
    return any(rx.search(text) for rx in LEV_ETF_INCLUDE_RES)


def infer_leveraged_etf_meta(symbol: str, name: str) -> dict:
    text = str(name or symbol)
    lower = text.lower()
    etf_type = "leveraged"
    if re.search(r"inverse|short|bear", lower) and not re.search(r"covered call|option income|buywrite", lower):
        etf_type = "inverse"
    elif re.search(r"covered call|buywrite|option income|weeklypay|0dte|premium income", lower):
        etf_type = "covered-call"
    elif re.search(r"\bvix\b|volatility", lower):
        etf_type = "volatility"
    elif re.search(r"buffer|defined outcome", lower):
        etf_type = "buffer"

    leverage = "—"
    lev_match = re.search(r"(\d+(?:\.\d+)?)\s*x", text, re.I)
    if lev_match:
        leverage = f"{lev_match.group(1)}x"
    elif re.search(r"ultrapro", lower):
        leverage = "3x"
    elif re.search(r"\bultra\b", lower):
        leverage = "2x"

    issuer = "—"
    for needle, label in ISSUER_HINTS:
        if needle.lower() in lower:
            issuer = label
            break

    scope = "thematic"
    if re.search(r"s&p|nasdaq|russell|dow|msci|ftse|index|100|500|2000", lower):
        scope = "index"
    elif re.search(r"semiconductor|technology|financial|energy|biotech|health|real estate|sector|gold|oil|silver|gas", lower):
        scope = "commodity" if re.search(r"gold|oil|silver|gas|crude|commodity", lower) else "sector"
    elif re.search(r"china|korea|japan|europe|emerging|brazil|india|mexico|international|msci", lower):
        scope = "international"
    elif re.search(r"\b(nvda|tsla|aapl|amzn|msft|meta|coin|pltr|amd|nflx|mstr|bitcoin|ether|btc|eth)\b", lower):
        scope = "single-stock"

    direction = "short" if etf_type == "inverse" else ("neutral" if etf_type in {"covered-call", "buffer", "volatility"} else "long")
    return {
        "ticker": symbol,
        "name": text,
        "type": etf_type,
        "leverage": leverage,
        "direction": direction,
        "underlying": "—",
        "underlyingLabel": "자동 분류",
        "scope": scope,
        "group": "Nasdaq 자동 탐지",
        "issuer": issuer,
        "discovered": True,
    }


def discover_from_screener(screener_rows: list[dict] | None) -> list[dict]:
    if not screener_rows:
        return []
    items = []
    seen = set()
    for row in screener_rows:
        symbol = str(row.get("symbol") or "").strip().upper()
        name = str(row.get("company") or row.get("name") or symbol).strip()
        if not symbol or symbol in seen or not is_leveraged_option_etf(name):
            continue
        seen.add(symbol)
        items.append(infer_leveraged_etf_meta(symbol, name))
    return items


def catalog_items(screener_rows: list[dict] | None = None) -> list[dict]:
    by_ticker: dict[str, dict] = {}
    for row in discover_from_screener(screener_rows):
        by_ticker[row["ticker"]] = row
    for row in ROWS:
        item = dict(zip(FIELDS, row))
        item.pop("discovered", None)
        by_ticker[item["ticker"]] = item
    return sorted(by_ticker.values(), key=lambda item: (item.get("group") or "", item["ticker"]))


def main() -> None:
    screener_rows = None
    try:
        import sys
        scripts_dir = Path(__file__).resolve().parent
        sys.path.insert(0, str(scripts_dir))
        import update_data as ud
        screener_rows = ud.fetch_nasdaq_etf_screener()
    except Exception as exc:
        print(f"[warn] Nasdaq ETF screener unavailable for discovery: {exc}")

    items = catalog_items(screener_rows)
    curated = sum(1 for item in items if not item.get("discovered"))
    discovered = len(items) - curated

    out = Path(__file__).resolve().parents[1] / "data" / "leveraged_etf_catalog.js"
    payload = {
        "updated": datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d"),
        "note": "레버리지·인버스·커버드콜·변동성 등 옵션형 ETF 카탈로그. 수동 큐레이션 + Nasdaq 스크리너 자동 탐지.",
        "curatedCount": curated,
        "discoveredCount": discovered,
        "items": items,
    }
    body = "window.LEVERAGED_ETF_CATALOG = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    out.write_text(body, encoding="utf-8")
    print(f"Wrote {len(items)} items ({curated} curated + {discovered} discovered) to {out}")

if __name__ == "__main__":
    main()