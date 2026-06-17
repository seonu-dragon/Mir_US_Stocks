#!/usr/bin/env python3
"""Generate data/leveraged_etf_catalog.js from curated ETF rows."""
from __future__ import annotations

import json
from pathlib import Path

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
]

FIELDS = ("ticker", "name", "type", "leverage", "direction", "underlying", "underlyingLabel", "scope", "group", "issuer")

def main() -> None:
    items = []
    seen = set()
    for row in ROWS:
        item = dict(zip(FIELDS, row))
        key = item["ticker"]
        if key in seen:
            continue
        seen.add(key)
        items.append(item)

    out = Path(__file__).resolve().parents[1] / "data" / "leveraged_etf_catalog.js"
    payload = {
        "updated": "2026-06-18",
        "note": "레버리지·인버스·커버드콜·변동성 등 옵션형 ETF 카탈로그. 스냅샷에 없는 티커는 메타데이터만 표시됩니다.",
        "items": items,
    }
    body = "window.LEVERAGED_ETF_CATALOG = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    out.write_text(body, encoding="utf-8")
    print(f"Wrote {len(items)} items to {out}")

if __name__ == "__main__":
    main()