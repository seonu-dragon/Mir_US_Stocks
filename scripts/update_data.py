import argparse
import hashlib
import html
import importlib.util
import json
import os
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "market_snapshot.json"
OUT_JS = ROOT / "data" / "market_snapshot.js"
DETAILS_DIR = ROOT / "data" / "details"
TODAY_CONTENT_FILE = ROOT / "data" / "today_content.json"
MAX_REAL_HISTORY = 1400
MAX_FUNDAMENTALS = 3500
ACTIVE_SMALL_CAP_MIN_CAP_B = 0.3
ACTIVE_SMALL_CAP_MIN_VOLUME = 1_000_000
# Any reasonably liquid name gets real Yahoo history regardless of market cap, so
# beaten-down small caps (e.g. FLNT, STTK) show their real chart instead of a synthetic one.
ACTIVE_LIQUID_MIN_VOLUME = 1_500_000
ACTIVE_MOVER_MIN_CHANGE_PCT = 20
ACTIVE_MOVER_MIN_VOLUME = 500_000

THEMATIC_REAL_SYMBOLS = {
    "RGTI", "IONQ", "QBTS", "QUBT", "ARQQ", "LAES", "RKLB", "ASTS", "SOUN", "BBAI",
    "PLTR", "APP", "HOOD", "IREN", "CORZ", "CLSK", "RIOT", "MARA",
}

HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/plain, */*",
}

NASDAQ_HEADERS = {
    **HTTP_HEADERS,
    "Origin": "https://www.nasdaq.com",
    "Referer": "https://www.nasdaq.com/market-activity/stocks/screener",
}

SEC_HEADERS = {
    **HTTP_HEADERS,
    "User-Agent": "Mir US Stocks mir-us-stocks@users.noreply.github.com",
}

_TICKER_CIK_CACHE = None

ETFS = {
    "SPY": ("SPDR S&P 500 ETF", "EXCHANGE TRADED FUNDS", "Broad Market ETF", "all_misc", 650),
    "QQQ": ("Invesco QQQ Trust", "EXCHANGE TRADED FUNDS", "Technology ETF", "all_misc", 380),
    "IWM": ("iShares Russell 2000 ETF", "EXCHANGE TRADED FUNDS", "Small Cap ETF", "all_misc", 70),
    "IBIT": ("iShares Bitcoin Trust ETF", "EXCHANGE TRADED FUNDS", "Crypto ETF", "all_misc", 90),
    "GLD": ("SPDR Gold Shares", "EXCHANGE TRADED FUNDS", "Commodity ETF", "all_misc", 110),
    "VIXY": ("ProShares VIX Short-Term Futures ETF", "EXCHANGE TRADED FUNDS", "Volatility ETF", "all_misc", 1),
    "SOXX": ("iShares Semiconductor ETF", "EXCHANGE TRADED FUNDS", "Semiconductor ETF", "all_misc", 20),
    "XLK": ("Technology Select Sector SPDR", "EXCHANGE TRADED FUNDS", "Sector ETF", "all_misc", 85),
    "XLE": ("Energy Select Sector SPDR", "EXCHANGE TRADED FUNDS", "Sector ETF", "all_misc", 35),
    "XLF": ("Financial Select Sector SPDR", "EXCHANGE TRADED FUNDS", "Sector ETF", "all_misc", 45),
    "XLV": ("Health Care Select Sector SPDR", "EXCHANGE TRADED FUNDS", "Sector ETF", "all_misc", 40),
    "XLU": ("Utilities Select Sector SPDR", "EXCHANGE TRADED FUNDS", "Sector ETF", "all_misc", 20),
}

ETF_RS_BENCHMARKS = ["SPY", "QQQ", "TQQQ", "DIA", "IWM"]

ETF_THEME_DEFS = [
    {
        "group": "Major Indexes",
        "category": "US Large Cap",
        "representative": "SPY",
        "peers": ["SPY", "VOO", "IVV", "VTI", "DIA", "RSP"],
        "keywords": ["s&p 500", "large cap", "total stock market", "dow jones", "equal weight"],
    },
    {
        "group": "Major Indexes",
        "category": "Nasdaq / Growth",
        "representative": "QQQ",
        "peers": ["QQQ", "QQQM", "ONEQ", "VUG", "SCHG", "IWF"],
        "keywords": ["nasdaq", "growth", "large-cap growth"],
    },
    {
        "group": "Major Indexes",
        "category": "Small Cap",
        "representative": "IWM",
        "peers": ["IWM", "IJR", "VB", "SCHA", "IWO", "IWN"],
        "keywords": ["russell 2000", "small cap", "small-cap"],
    },
    {
        "group": "Technology",
        "category": "Technology Broad",
        "representative": "XLK",
        "peers": ["XLK", "VGT", "IYW", "FTEC", "IXN"],
        "keywords": ["technology", "information technology"],
    },
    {
        "group": "Technology",
        "category": "Semiconductors",
        "representative": "SOXX",
        "peers": ["SOXX", "SMH", "XSD", "PSI", "SOXQ", "FTXL"],
        "keywords": ["semiconductor", "semiconductors", "chip"],
    },
    {
        "group": "Technology",
        "category": "Software / Cloud",
        "representative": "IGV",
        "peers": ["IGV", "SKYY", "CLOU", "WCLD"],
        "keywords": ["software", "cloud computing", "cloud"],
    },
    {
        "group": "Technology",
        "category": "Cybersecurity",
        "representative": "CIBR",
        "peers": ["CIBR", "HACK", "BUG", "IHAK"],
        "keywords": ["cybersecurity", "cyber security", "cyber"],
    },
    {
        "group": "Technology",
        "category": "AI / Robotics",
        "representative": "BOTZ",
        "peers": ["BOTZ", "ROBO", "IRBO", "AIQ", "THNQ"],
        "keywords": ["artificial intelligence", "robotics", "automation"],
    },
    {
        "group": "Communication",
        "category": "Communication Services",
        "representative": "XLC",
        "peers": ["XLC", "VOX", "IYZ", "FCOM"],
        "keywords": ["communication services", "telecommunication"],
    },
    {
        "group": "Communication",
        "category": "Internet",
        "representative": "FDN",
        "peers": ["FDN", "PNQI", "XWEB"],
        "keywords": ["internet", "web"],
    },
    {
        "group": "Consumer",
        "category": "Consumer Discretionary",
        "representative": "XLY",
        "peers": ["XLY", "VCR", "IYC", "FDIS"],
        "keywords": ["consumer discretionary", "consumer cyclical"],
    },
    {
        "group": "Consumer",
        "category": "Retail / Ecommerce",
        "representative": "XRT",
        "peers": ["XRT", "IBUY", "ONLN", "RTH"],
        "keywords": ["retail", "online retail", "e-commerce", "ecommerce"],
    },
    {
        "group": "Consumer",
        "category": "Consumer Staples",
        "representative": "XLP",
        "peers": ["XLP", "VDC", "IYK", "FSTA"],
        "keywords": ["consumer staples", "consumer defensive"],
    },
    {
        "group": "Financial",
        "category": "Financials Broad",
        "representative": "XLF",
        "peers": ["XLF", "VFH", "IYF", "FNCL"],
        "keywords": ["financial", "financials"],
        "exclude_keywords": ["bitcoin", "blockchain", "crypto", "miner"],
    },
    {
        "group": "Financial",
        "category": "Banks",
        "representative": "KBE",
        "peers": ["KBE", "KRE", "IAT", "KBWB"],
        "keywords": ["bank", "banks", "regional banking"],
    },
    {
        "group": "Crypto",
        "category": "Bitcoin Spot ETF",
        "representative": "IBIT",
        "peers": ["IBIT", "FBTC", "GBTC", "ARKB", "BITB", "HODL", "BTCW", "EZBC"],
        "keywords": ["bitcoin trust", "spot bitcoin", "bitcoin etf", "bitcoin fund"],
        "exclude_keywords": ["miner", "mining", "blockchain", "strategy"],
    },
    {
        "group": "Crypto",
        "category": "Bitcoin Miners / Blockchain Equity",
        "representative": "WGMI",
        "peers": ["WGMI", "BKCH", "BLOK", "DAPP", "BITQ", "RIGZ"],
        "keywords": ["bitcoin miners", "bitcoin mining", "blockchain", "digital transformation", "crypto industry"],
        "exclude_keywords": ["spot bitcoin"],
    },
    {
        "group": "Healthcare",
        "category": "Healthcare Broad",
        "representative": "XLV",
        "peers": ["XLV", "VHT", "IYH", "FHLC"],
        "keywords": ["health care", "healthcare"],
    },
    {
        "group": "Healthcare",
        "category": "Biotech",
        "representative": "XBI",
        "peers": ["XBI", "IBB", "ARKG", "FBT"],
        "keywords": ["biotech", "biotechnology", "genomic"],
    },
    {
        "group": "Healthcare",
        "category": "Medical Devices",
        "representative": "IHI",
        "peers": ["IHI", "XHE", "IHF"],
        "keywords": ["medical devices", "medical equipment", "healthcare providers"],
    },
    {
        "group": "Industrials",
        "category": "Industrials Broad",
        "representative": "XLI",
        "peers": ["XLI", "VIS", "IYJ", "FIDU"],
        "keywords": ["industrial", "industrials"],
    },
    {
        "group": "Industrials",
        "category": "Aerospace / Defense",
        "representative": "ITA",
        "peers": ["ITA", "XAR", "PPA", "DFEN"],
        "keywords": ["aerospace", "defense"],
        "exclude_keywords": ["bull", "leveraged"],
    },
    {
        "group": "Industrials",
        "category": "Transportation",
        "representative": "IYT",
        "peers": ["IYT", "XTN", "JETS"],
        "keywords": ["transportation", "airline", "airlines"],
    },
    {
        "group": "Industrials",
        "category": "Infrastructure",
        "representative": "PAVE",
        "peers": ["PAVE", "IFRA", "GRID"],
        "keywords": ["infrastructure", "smart grid"],
    },
    {
        "group": "Energy",
        "category": "Energy Broad",
        "representative": "XLE",
        "peers": ["XLE", "VDE", "IYE", "FENY"],
        "keywords": ["energy", "oil gas"],
    },
    {
        "group": "Energy",
        "category": "Oil & Gas Exploration",
        "representative": "XOP",
        "peers": ["XOP", "IEO", "PXE"],
        "keywords": ["exploration", "production", "oil & gas"],
    },
    {
        "group": "Energy",
        "category": "Clean Energy / Solar",
        "representative": "TAN",
        "peers": ["TAN", "ICLN", "QCLN", "PBW", "FAN"],
        "keywords": ["solar", "clean energy", "renewable", "wind energy"],
    },
    {
        "group": "Materials",
        "category": "Materials Broad",
        "representative": "XLB",
        "peers": ["XLB", "VAW", "IYM", "FMAT"],
        "keywords": ["materials", "basic materials"],
    },
    {
        "group": "Materials",
        "category": "Gold / Metals Miners",
        "representative": "GDX",
        "peers": ["GDX", "GDXJ", "SIL", "COPX", "PICK"],
        "keywords": ["gold miners", "silver miners", "copper miners", "metals miners"],
    },
    {
        "group": "Real Estate",
        "category": "Real Estate / REITs",
        "representative": "XLRE",
        "peers": ["XLRE", "VNQ", "IYR", "SCHH"],
        "keywords": ["real estate", "reit"],
    },
    {
        "group": "Real Estate",
        "category": "Homebuilders",
        "representative": "XHB",
        "peers": ["XHB", "ITB", "NAIL"],
        "keywords": ["homebuilder", "homebuilders", "home construction"],
        "exclude_keywords": ["bull"],
    },
    {
        "group": "Defensive",
        "category": "Utilities",
        "representative": "XLU",
        "peers": ["XLU", "VPU", "IDU", "FUTY"],
        "keywords": ["utilities"],
    },
    {
        "group": "Defensive",
        "category": "Gold / Treasury",
        "representative": "GLD",
        "peers": ["GLD", "IAU", "TLT", "IEF", "SHY"],
        "keywords": ["gold", "treasury bond", "treasury"],
    },
    {
        "group": "Volatility",
        "category": "Volatility",
        "representative": "VIXY",
        "peers": ["VIXY", "VXX", "UVXY"],
        "keywords": ["vix", "volatility"],
        "exclude_keywords": ["inverse"],
    },
]

ETF_THEME_DEFS.extend([
    {
        "group": "Technology",
        "category": "Cloud Infrastructure",
        "representative": "SKYY",
        "peers": ["SKYY", "CLOU", "WCLD"],
        "keywords": ["cloud infrastructure", "cloud computing"],
    },
    {
        "group": "Technology",
        "category": "Fintech",
        "representative": "FINX",
        "peers": ["FINX", "ARKF", "IPAY"],
        "keywords": ["fintech", "financial technology", "mobile payments", "digital payments"],
        "exclude_keywords": ["blockchain", "bitcoin"],
    },
    {
        "group": "Technology",
        "category": "Payments",
        "representative": "IPAY",
        "peers": ["IPAY", "TPAY"],
        "keywords": ["payments", "mobile payments"],
        "exclude_keywords": ["blockchain", "bitcoin"],
    },
    {
        "group": "Technology",
        "category": "Data Centers",
        "representative": "SRVR",
        "peers": ["SRVR", "VPN"],
        "keywords": ["data center", "data centers", "digital infrastructure"],
    },
    {
        "group": "Technology",
        "category": "Quantum Computing",
        "representative": "QTUM",
        "peers": ["QTUM", "QTUM"],
        "keywords": ["quantum"],
    },
    {
        "group": "Technology",
        "category": "Space Economy",
        "representative": "ARKX",
        "peers": ["ARKX", "UFO", "ROKT"],
        "keywords": ["space", "aerospace technology"],
    },
    {
        "group": "Communication",
        "category": "Media / Entertainment",
        "representative": "PBS",
        "peers": ["PBS", "IEME"],
        "keywords": ["media", "entertainment"],
    },
    {
        "group": "Communication",
        "category": "Video Games / Esports",
        "representative": "HERO",
        "peers": ["HERO", "ESPO", "NERD"],
        "keywords": ["video game", "gaming", "esports", "e-sports"],
    },
    {
        "group": "Communication",
        "category": "Social Media",
        "representative": "SOCL",
        "peers": ["SOCL"],
        "keywords": ["social media"],
    },
    {
        "group": "Consumer",
        "category": "Restaurants",
        "representative": "EATZ",
        "peers": ["EATZ", "BITE"],
        "keywords": ["restaurant", "restaurants", "food service"],
    },
    {
        "group": "Consumer",
        "category": "Travel / Leisure",
        "representative": "PEJ",
        "peers": ["PEJ", "AWAY", "CRUZ"],
        "keywords": ["leisure", "travel", "hotel", "cruise"],
    },
    {
        "group": "Consumer",
        "category": "Airlines",
        "representative": "JETS",
        "peers": ["JETS"],
        "keywords": ["airline", "airlines"],
    },
    {
        "group": "Consumer",
        "category": "Luxury / Apparel",
        "representative": "LUXE",
        "peers": ["LUXE", "IBUY"],
        "keywords": ["luxury", "apparel", "fashion"],
    },
    {
        "group": "Consumer",
        "category": "Autos / EV",
        "representative": "DRIV",
        "peers": ["DRIV", "IDRV", "CARZ", "KARS"],
        "keywords": ["electric vehicle", "autonomous", "automobile", "future mobility"],
    },
    {
        "group": "Consumer",
        "category": "Cannabis",
        "representative": "MSOS",
        "peers": ["MSOS", "MJ", "YOLO", "CNBS"],
        "keywords": ["cannabis", "marijuana"],
    },
    {
        "group": "Financial",
        "category": "Regional Banks",
        "representative": "KRE",
        "peers": ["KRE", "IAT", "DPST"],
        "keywords": ["regional bank", "regional banking"],
        "exclude_keywords": ["bull", "leveraged"],
    },
    {
        "group": "Financial",
        "category": "Broker Dealers / Capital Markets",
        "representative": "IAI",
        "peers": ["IAI", "KCE"],
        "keywords": ["broker-dealers", "capital markets", "investment services"],
    },
    {
        "group": "Financial",
        "category": "Insurance",
        "representative": "KIE",
        "peers": ["KIE", "IAK", "KBWP"],
        "keywords": ["insurance"],
    },
    {
        "group": "Financial",
        "category": "Mortgage / Housing Finance",
        "representative": "REM",
        "peers": ["REM", "MORT"],
        "keywords": ["mortgage", "mortgage reit"],
    },
    {
        "group": "Crypto",
        "category": "Ethereum Spot ETF",
        "representative": "ETHA",
        "peers": ["ETHA", "FETH", "ETHE", "ETHW", "CETH", "ETHV"],
        "keywords": ["ethereum trust", "spot ethereum", "ethereum etf", "ether etf"],
        "exclude_keywords": ["strategy", "yield"],
    },
    {
        "group": "Crypto",
        "category": "Digital Assets Multi-Coin",
        "representative": "BITW",
        "peers": ["BITW", "GDLC"],
        "keywords": ["crypto index", "digital asset", "crypto 10", "large cap crypto"],
        "exclude_keywords": ["miner", "mining"],
    },
    {
        "group": "Healthcare",
        "category": "Pharmaceuticals",
        "representative": "IHE",
        "peers": ["IHE", "PPH", "XPH"],
        "keywords": ["pharmaceutical", "pharmaceuticals", "pharma"],
    },
    {
        "group": "Healthcare",
        "category": "Healthcare Providers",
        "representative": "IHF",
        "peers": ["IHF", "XHS"],
        "keywords": ["healthcare providers", "health care providers"],
    },
    {
        "group": "Healthcare",
        "category": "Healthcare Services",
        "representative": "XHS",
        "peers": ["XHS", "IHF"],
        "keywords": ["healthcare services", "health care services"],
    },
    {
        "group": "Healthcare",
        "category": "Genomics",
        "representative": "ARKG",
        "peers": ["ARKG", "GNOM", "IDNA"],
        "keywords": ["genomics", "genomic", "dna"],
    },
    {
        "group": "Healthcare",
        "category": "Medical Equipment",
        "representative": "XHE",
        "peers": ["XHE", "IHI"],
        "keywords": ["medical equipment", "medical devices"],
    },
    {
        "group": "Industrials",
        "category": "Construction / Engineering",
        "representative": "PKB",
        "peers": ["PKB", "PAVE", "IFRA"],
        "keywords": ["building construction", "construction", "engineering"],
    },
    {
        "group": "Industrials",
        "category": "Machinery",
        "representative": "XLI",
        "peers": ["AIRR", "XLI"],
        "keywords": ["machinery", "industrial machinery"],
    },
    {
        "group": "Industrials",
        "category": "Metals & Mining",
        "representative": "XME",
        "peers": ["XME", "PICK"],
        "keywords": ["metals and mining", "metals & mining"],
    },
    {
        "group": "Industrials",
        "category": "Railroads",
        "representative": "IYT",
        "peers": ["IYT", "XTN"],
        "keywords": ["railroad", "railroads"],
    },
    {
        "group": "Energy",
        "category": "Oil Services",
        "representative": "OIH",
        "peers": ["OIH", "IEZ", "XES"],
        "keywords": ["oil services", "oil equipment", "oilfield", "energy services"],
    },
    {
        "group": "Energy",
        "category": "MLPs / Pipelines",
        "representative": "AMLP",
        "peers": ["AMLP", "MLPA", "ENFR"],
        "keywords": ["mlp", "pipeline", "midstream"],
    },
    {
        "group": "Energy",
        "category": "Uranium / Nuclear",
        "representative": "URA",
        "peers": ["URA", "URNM", "NLR", "NUKZ"],
        "keywords": ["uranium", "nuclear"],
    },
    {
        "group": "Energy",
        "category": "Natural Gas",
        "representative": "FCG",
        "peers": ["FCG", "UNG"],
        "keywords": ["natural gas"],
    },
    {
        "group": "Energy",
        "category": "Wind Energy",
        "representative": "FAN",
        "peers": ["FAN", "ICLN"],
        "keywords": ["wind energy", "wind power"],
    },
    {
        "group": "Energy",
        "category": "Battery / Lithium",
        "representative": "LIT",
        "peers": ["LIT", "BATT", "DRIV"],
        "keywords": ["lithium", "battery", "batteries"],
    },
    {
        "group": "Materials",
        "category": "Copper Miners",
        "representative": "COPX",
        "peers": ["COPX", "CPER"],
        "keywords": ["copper"],
    },
    {
        "group": "Materials",
        "category": "Steel",
        "representative": "SLX",
        "peers": ["SLX"],
        "keywords": ["steel"],
    },
    {
        "group": "Materials",
        "category": "Rare Earth / Strategic Metals",
        "representative": "REMX",
        "peers": ["REMX", "CRIT"],
        "keywords": ["rare earth", "strategic metals", "critical materials"],
    },
    {
        "group": "Materials",
        "category": "Agriculture / Agribusiness",
        "representative": "MOO",
        "peers": ["MOO", "VEGI", "DBA"],
        "keywords": ["agribusiness", "agriculture", "farm"],
    },
    {
        "group": "Materials",
        "category": "Timber / Forestry",
        "representative": "WOOD",
        "peers": ["WOOD", "CUT"],
        "keywords": ["timber", "forestry", "wood"],
    },
    {
        "group": "Real Estate",
        "category": "Residential REITs",
        "representative": "REZ",
        "peers": ["REZ", "HOMZ"],
        "keywords": ["residential real estate", "residential reit"],
    },
    {
        "group": "Real Estate",
        "category": "Mortgage REITs",
        "representative": "REM",
        "peers": ["REM", "MORT"],
        "keywords": ["mortgage reit"],
    },
    {
        "group": "Real Estate",
        "category": "Office / Commercial Real Estate",
        "representative": "IYR",
        "peers": ["IYR", "VNQ"],
        "keywords": ["office real estate", "commercial real estate"],
    },
    {
        "group": "Defensive",
        "category": "Water",
        "representative": "PHO",
        "peers": ["PHO", "FIW", "CGW"],
        "keywords": ["water"],
    },
    {
        "group": "Defensive",
        "category": "Aerospace Utilities / Infrastructure",
        "representative": "GRID",
        "peers": ["GRID", "PAVE"],
        "keywords": ["grid", "electric infrastructure"],
    },
    {
        "group": "Commodities",
        "category": "Gold",
        "representative": "GLD",
        "peers": ["GLD", "IAU", "SGOL"],
        "keywords": ["gold shares", "physical gold"],
    },
    {
        "group": "Commodities",
        "category": "Silver",
        "representative": "SLV",
        "peers": ["SLV", "SIVR"],
        "keywords": ["silver"],
    },
    {
        "group": "Commodities",
        "category": "Oil Commodity",
        "representative": "USO",
        "peers": ["USO", "BNO", "DBO"],
        "keywords": ["crude oil", "oil fund"],
    },
    {
        "group": "Commodities",
        "category": "Natural Gas Commodity",
        "representative": "UNG",
        "peers": ["UNG", "BOIL"],
        "keywords": ["natural gas fund", "natural gas"],
        "exclude_keywords": ["bull", "leveraged"],
    },
    {
        "group": "Commodities",
        "category": "Broad Commodities",
        "representative": "DBC",
        "peers": ["DBC", "PDBC", "GSG"],
        "keywords": ["commodity", "commodities"],
    },
    {
        "group": "Bonds",
        "category": "Short-Term Treasury",
        "representative": "SHY",
        "peers": ["SHY", "VGSH", "SCHO", "BIL"],
        "keywords": ["short treasury", "1-3 year treasury", "treasury bill"],
    },
    {
        "group": "Bonds",
        "category": "Intermediate Treasury",
        "representative": "IEF",
        "peers": ["IEF", "VGIT", "SCHR"],
        "keywords": ["7-10 year treasury", "intermediate treasury"],
    },
    {
        "group": "Bonds",
        "category": "Long-Term Treasury",
        "representative": "TLT",
        "peers": ["TLT", "VGLT", "SPTL"],
        "keywords": ["20+ year treasury", "long-term treasury", "long treasury"],
    },
    {
        "group": "Bonds",
        "category": "Investment Grade Bonds",
        "representative": "LQD",
        "peers": ["LQD", "VCIT", "IGIB"],
        "keywords": ["investment grade", "corporate bond"],
    },
    {
        "group": "Bonds",
        "category": "High Yield Bonds",
        "representative": "HYG",
        "peers": ["HYG", "JNK", "USHY"],
        "keywords": ["high yield", "junk bond"],
    },
    {
        "group": "Bonds",
        "category": "Municipal Bonds",
        "representative": "MUB",
        "peers": ["MUB", "VTEB", "TFI"],
        "keywords": ["municipal bond", "muni"],
    },
    {
        "group": "International",
        "category": "Developed Markets",
        "representative": "EFA",
        "peers": ["EFA", "VEA", "IEFA"],
        "keywords": ["developed markets", "msci eafe"],
    },
    {
        "group": "International",
        "category": "Emerging Markets",
        "representative": "EEM",
        "peers": ["EEM", "VWO", "IEMG"],
        "keywords": ["emerging markets"],
    },
    {
        "group": "International",
        "category": "China",
        "representative": "FXI",
        "peers": ["FXI", "MCHI", "KWEB", "ASHR"],
        "keywords": ["china", "chinese"],
    },
    {
        "group": "International",
        "category": "Japan",
        "representative": "EWJ",
        "peers": ["EWJ", "DXJ", "FLJP"],
        "keywords": ["japan"],
    },
    {
        "group": "International",
        "category": "Europe",
        "representative": "VGK",
        "peers": ["VGK", "EZU", "FEZ"],
        "keywords": ["europe"],
    },
    {
        "group": "International",
        "category": "India",
        "representative": "INDA",
        "peers": ["INDA", "EPI", "FLIN"],
        "keywords": ["india"],
    },
    {
        "group": "International",
        "category": "Latin America",
        "representative": "ILF",
        "peers": ["ILF", "EWZ", "FLBR"],
        "keywords": ["latin america", "brazil"],
    },
    {
        "group": "Factors",
        "category": "Dividend / Quality Income",
        "representative": "SCHD",
        "peers": ["SCHD", "VIG", "DGRO", "NOBL"],
        "keywords": ["dividend", "quality income"],
    },
    {
        "group": "Factors",
        "category": "Quality Factor",
        "representative": "QUAL",
        "peers": ["QUAL", "SPHQ", "DGRW"],
        "keywords": ["quality factor", "quality"],
    },
    {
        "group": "Factors",
        "category": "Value Factor",
        "representative": "VLUE",
        "peers": ["VLUE", "VTV", "IWD"],
        "keywords": ["value factor", "value"],
    },
    {
        "group": "Factors",
        "category": "Momentum Factor",
        "representative": "MTUM",
        "peers": ["MTUM", "PDP", "SPMO"],
        "keywords": ["momentum"],
    },
    {
        "group": "Factors",
        "category": "Low Volatility Factor",
        "representative": "USMV",
        "peers": ["USMV", "SPLV", "XMLV"],
        "keywords": ["low volatility", "minimum volatility"],
    },
])

# Single-country and aggregate-bond ETFs for the 마켓 데이터 tab.
ETF_THEME_DEFS.extend([
    {"group": "International", "category": "Korea", "representative": "EWY", "peers": ["EWY"], "keywords": ["korea"]},
    {"group": "International", "category": "Taiwan", "representative": "EWT", "peers": ["EWT"], "keywords": ["taiwan"]},
    {"group": "International", "category": "Germany", "representative": "EWG", "peers": ["EWG"], "keywords": ["germany"]},
    {"group": "International", "category": "United Kingdom", "representative": "EWU", "peers": ["EWU"], "keywords": ["united kingdom"]},
    {"group": "International", "category": "Canada", "representative": "EWC", "peers": ["EWC"], "keywords": ["canada"]},
    {"group": "International", "category": "Australia", "representative": "EWA", "peers": ["EWA"], "keywords": ["australia"]},
    {"group": "Bonds", "category": "Aggregate Bonds", "representative": "AGG", "peers": ["AGG", "BND"], "keywords": ["aggregate bond", "total bond market"]},
    {"group": "Bonds", "category": "TIPS / Inflation", "representative": "TIP", "peers": ["TIP", "SCHP", "VTIP"], "keywords": ["inflation protected", "tips"]},
])

ETF_EXCLUDE_KEYWORDS = [
    "2x", "3x", "ultra", "bear", "inverse", "short", "daily target", "daily bull",
    "daily bear", "buffer", "defined outcome", "covered call", "buywrite",
    "option income", "single stock",
]

ETF_CAP_HINTS = {
    "SPY": 650, "VOO": 590, "IVV": 580, "VTI": 450, "QQQ": 380, "QQQM": 45,
    "DIA": 35, "IWM": 70, "TQQQ": 25, "SQQQ": 8, "SOXL": 12, "SOXS": 4, "NVDL": 6,
    "TSLL": 5, "UVXY": 2, "BITX": 3, "JEPI": 45, "QYLD": 8, "RSP": 60, "VUG": 150, "SCHG": 40, "IWF": 110,
    "XLK": 85, "VGT": 95, "IYW": 20, "FTEC": 15, "SOXX": 20, "SMH": 30,
    "XSD": 2, "PSI": 1.5, "SOXQ": 1.2, "IGV": 8, "SKYY": 3, "CLOU": 0.5,
    "CIBR": 7, "HACK": 1.6, "BOTZ": 3, "ROBO": 1.2, "XLC": 20, "FDN": 5,
    "XLY": 25, "XRT": 0.6, "XLP": 18, "XLF": 45, "KBE": 1.8, "KRE": 3,
    "IBIT": 90, "FBTC": 25, "GBTC": 18, "ARKB": 5, "BITB": 4, "HODL": 1,
    "WGMI": 0.3, "BKCH": 0.2, "BLOK": 0.8, "DAPP": 0.1, "BITQ": 0.1,
    "XLV": 40, "XBI": 6, "IBB": 6, "IHI": 5, "XLI": 20, "ITA": 6, "PAVE": 8,
    "XLE": 35, "XOP": 3, "TAN": 1.5, "XLB": 6, "GDX": 12, "XLRE": 8,
    "XHB": 2, "XLU": 20, "GLD": 110, "TLT": 60, "VIXY": 1,
}

EXTRA_GROWTH = {
    "PLTR": ("Palantir", "TECHNOLOGY", "Software - Infrastructure", "gte10b", 300),
    "APP": ("AppLovin", "TECHNOLOGY", "Software - Application", "gte10b", 160),
    "HOOD": ("Robinhood", "FINANCIAL", "Capital Markets", "gte10b", 80),
    "RKLB": ("Rocket Lab", "INDUSTRIALS", "Aerospace & Defense", "1to10b", 50),
    "IONQ": ("IonQ", "TECHNOLOGY", "Computer Hardware", "1to10b", 15),
}

MARKET_CAP_B = {
    "AAPL": 4300, "MSFT": 2900, "NVDA": 5000, "GOOGL": 2200,
    "AMZN": 2500, "META": 1400, "AVGO": 1800, "TSLA": 1300, "LLY": 1050,
    "WMT": 830, "JPM": 850, "V": 700, "ORCL": 700, "MA": 520, "NFLX": 500,
    "XOM": 470, "COST": 450, "JNJ": 430, "HD": 390, "ABBV": 390, "BAC": 370,
    "PG": 370, "AMD": 350, "GE": 330, "KO": 300, "PLTR": 300, "UNH": 300,
    "CVX": 280, "GS": 260, "CAT": 260, "CSCO": 250, "CRM": 250, "MRK": 230,
    "LIN": 220, "MCD": 220, "PEP": 210, "RTX": 200, "DIS": 200, "QCOM": 190,
    "T": 180, "VZ": 180, "NEE": 160, "MU": 160, "APP": 160, "ADBE": 150,
    "BA": 140, "INTC": 110, "COP": 110, "LMT": 110, "PLD": 110, "NKE": 100,
    "DUK": 100, "SHW": 90, "AMT": 90, "HOOD": 80, "RKLB": 50, "IONQ": 15,
}

SECTOR_MAP = {
    "Basic Materials": "BASIC MATERIALS",
    "Communication Services": "COMMUNICATION SERVICES",
    "Consumer Cyclical": "CONSUMER CYCLICAL",
    "Consumer Defensive": "CONSUMER DEFENSIVE",
    "Consumer Discretionary": "CONSUMER CYCLICAL",
    "Consumer Staples": "CONSUMER DEFENSIVE",
    "Energy": "ENERGY",
    "Finance": "FINANCIAL",
    "Financial Services": "FINANCIAL",
    "Financials": "FINANCIAL",
    "Health Care": "HEALTHCARE",
    "Healthcare": "HEALTHCARE",
    "Industrials": "INDUSTRIALS",
    "Information Technology": "TECHNOLOGY",
    "Miscellaneous": "MISC",
    "Real Estate": "REAL ESTATE",
    "Technology": "TECHNOLOGY",
    "Telecommunications": "COMMUNICATION SERVICES",
    "Utilities": "UTILITIES",
}

NASDAQ_100_FALLBACK = {
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "AVGO", "GOOGL", "TSLA", "COST",
    "NFLX", "AMD", "PEP", "CSCO", "LIN", "ADBE", "QCOM", "TXN", "AMGN", "INTU",
    "AMAT", "ISRG", "BKNG", "HON", "CMCSA", "PDD", "VRTX", "SBUX", "PANW", "ADP",
}

DUPLICATE_SHARE_CLASSES = {
    "GOOG": "GOOGL",
}


def pct(now, then):
    if not then:
        return 0.0
    return round(((now / then) - 1) * 100, 1)


def clamp(value, low=0, high=100):
    return max(low, min(high, int(round(value))))


def stable_unit(text):
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def request_text(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or HTTP_HEADERS)
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", errors="replace")


def request_json(url, headers=None, timeout=30):
    return json.loads(request_text(url, headers=headers, timeout=timeout))


def yahoo_symbol(symbol):
    return symbol.replace(".", "-")


def strip_tags(value):
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value).strip()


def clean_symbol(symbol):
    return str(symbol or "").strip().upper().replace("/", ".")


def parse_money(value):
    text = str(value or "").replace("$", "").replace(",", "").strip()
    if text in {"", "N/A", "NA"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_pct(value):
    text = str(value or "").replace("%", "").replace(",", "").strip()
    if text in {"", "N/A", "NA"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_number(value):
    text = str(value or "").replace(",", "").strip()
    if text in {"", "N/A", "NA"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_nasdaq_financial(value):
    text = str(value or "").replace("$", "").replace(",", "").replace("%", "").strip()
    if text in {"", "N/A", "NA", "--"}:
        return None
    sign = -1 if text.startswith("-") else 1
    text = text.lstrip("-")
    try:
        return sign * float(text)
    except ValueError:
        return None


def parse_percent_value(value):
    parsed = parse_nasdaq_financial(value)
    return round(parsed, 2) if parsed is not None else None


def table_value(table, name):
    for row in table.get("rows", []):
        if row.get("value1") == name:
            return row.get("value2")
    return None


def financial_to_b(value):
    parsed = parse_nasdaq_financial(value)
    if parsed is None:
        return None
    # Nasdaq annual financial statements are displayed in thousands.
    return round(parsed / 1_000_000, 3)


def split_52w(value):
    nums = re.findall(r"\$?([0-9]+(?:\.[0-9]+)?)", str(value or ""))
    if len(nums) >= 2:
        return float(nums[0]), float(nums[1])
    return None, None


def map_sector(sector):
    return SECTOR_MAP.get(str(sector or "").strip(), "MISC")


def fallback_sp500_constituents():
    return [
        ("AAPL", "Apple", "Information Technology", "Technology Hardware"),
        ("MSFT", "Microsoft", "Information Technology", "Systems Software"),
        ("NVDA", "Nvidia", "Information Technology", "Semiconductors"),
        ("AMZN", "Amazon", "Consumer Discretionary", "Broadline Retail"),
        ("GOOGL", "Alphabet", "Communication Services", "Interactive Media"),
        ("META", "Meta Platforms", "Communication Services", "Interactive Media"),
        ("AVGO", "Broadcom", "Information Technology", "Semiconductors"),
        ("TSLA", "Tesla", "Consumer Discretionary", "Automobile Manufacturers"),
        ("JPM", "JPMorgan Chase", "Financials", "Diversified Banks"),
        ("LLY", "Eli Lilly", "Health Care", "Pharmaceuticals"),
    ]


def fetch_sp500_constituents():
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    try:
        text = request_text(url, timeout=30)
    except Exception:
        return fallback_sp500_constituents()

    table_match = re.search(r'<table[^>]+id="constituents"[^>]*>(.*?)</table>', text, re.S | re.I)
    if not table_match:
        return fallback_sp500_constituents()

    rows = []
    for row_html in re.findall(r"<tr[^>]*>(.*?)</tr>", table_match.group(1), re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html, re.S | re.I)
        if len(cells) < 4:
            continue
        values = [strip_tags(cell) for cell in cells]
        if values[0] == "Symbol":
            continue
        rows.append((clean_symbol(values[0]), values[1], values[2], values[3]))

    return rows or fallback_sp500_constituents()


def fetch_nasdaq100_symbols():
    url = "https://en.wikipedia.org/wiki/Nasdaq-100"
    try:
        text = request_text(url, timeout=30)
    except Exception:
        return set(NASDAQ_100_FALLBACK)

    symbols = set()
    for table_html in re.findall(r"<table[^>]*>(.*?)</table>", text, re.S | re.I):
        table_plain = " ".join(strip_tags(table_html).split())
        if not ("Ticker" in table_plain and "Company" in table_plain and "ICB" in table_plain):
            continue
        for row_html in re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, re.S | re.I):
            cells = [strip_tags(cell) for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html, re.S | re.I)]
            if not cells or cells[0] in {"Company", "Ticker", "Symbol"}:
                continue
            if re.fullmatch(r"[A-Z.]{1,6}", cells[0]):
                symbols.add(clean_symbol(cells[0]))

    return symbols or set(NASDAQ_100_FALLBACK)


EXCHANGE_MAP = {"N": "idx_nyse", "A": "idx_amex", "P": "idx_nysearca", "Z": "idx_bats"}


def iter_exchange_listed_rows():
    """Yield common stocks/ADRs from official Nasdaq Trader symbol directories."""
    specs = [
        ("idx_nasdaq", "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"),
        ("other", "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"),
    ]
    for kind, url in specs:
        try:
            text = request_text(url, timeout=30)
        except Exception:
            continue
        lines = [line for line in text.splitlines() if "|" in line and not line.startswith("File Creation")]
        if not lines:
            continue
        headers = lines[0].split("|")
        for line in lines[1:]:
            values = dict(zip(headers, line.split("|")))
            symbol = clean_symbol(values.get("Symbol") or values.get("ACT Symbol"))
            if not symbol or values.get("Test Issue") == "Y" or values.get("ETF") == "Y":
                continue
            company = str(values.get("Security Name") or symbol).strip()
            groups = {"idx_nasdaq"} if kind == "idx_nasdaq" else {EXCHANGE_MAP.get(values.get("Exchange", ""), "idx_other")}
            yield {
                "symbol": symbol,
                "company": company.replace(" Common Stock", "").strip(),
                "groups": groups,
            }


def fetch_exchange_groups():
    groups = {}
    for row in iter_exchange_listed_rows():
        groups.setdefault(row["symbol"], set()).update(row["groups"])
    return groups


def is_common_equity(symbol, name):
    symbol = clean_symbol(symbol)
    if not symbol:
        return False
    if "$" in symbol or "+" in symbol:
        return False
    if symbol.endswith((".W", ".R", ".U", ".WS", ".RT", ".UN")):
        return False

    text = f"{symbol} {name}".lower()
    if "american depositary" in text or re.search(r"\badrs?\b", text):
        return "preferred" not in text and "preference" not in text

    blocked = [
        " warrant", " warrants", " unit", " units", " right", " rights",
        " preferred", " preference", " depositary shares", " notes due",
        " senior note", " subordinated", " debenture", " bond", " etn",
        " closed end fund", " closed-end fund", " trust preferred",
    ]
    if any(term in text for term in blocked):
        return False
    if symbol.endswith("W") and len(symbol) >= 5 and "warrant" in text:
        return False
    return True


def fetch_nasdaq_screener():
    url = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25&download=true"
    try:
        payload = request_json(url, headers=NASDAQ_HEADERS, timeout=45)
    except Exception:
        return []

    rows = []
    for item in payload.get("data", {}).get("rows", []):
        symbol = clean_symbol(item.get("symbol"))
        if symbol in DUPLICATE_SHARE_CLASSES:
            continue
        company = str(item.get("name") or symbol).strip()
        price = parse_money(item.get("lastsale"))
        change = parse_pct(item.get("pctchange"))
        volume = parse_number(item.get("volume"))
        market_cap = parse_number(item.get("marketCap"))
        if not symbol or not price or price <= 0 or not market_cap or market_cap <= 0:
            continue
        if not is_common_equity(symbol, company):
            continue
        sector = map_sector(item.get("sector"))
        industry = str(item.get("industry") or "Other").strip() or "Other"
        rows.append({
            "symbol": symbol,
            "company": company.replace(" Common Stock", "").strip(),
            "sector": sector,
            "industry": industry,
            "marketCapB": round(market_cap / 1_000_000_000, 3),
            "quotePrice": price,
            "quoteChangePct": change,
            "quoteVolume": volume or 0,
            "groups": {"all_us"},
        })
    return rows


def fetch_nasdaq_etf_screener():
    url = "https://api.nasdaq.com/api/screener/etf?tableonly=true&limit=25&download=true"
    headers = {
        **HTTP_HEADERS,
        "Origin": "https://www.nasdaq.com",
        "Referer": "https://www.nasdaq.com/market-activity/etf/screener",
    }
    try:
        payload = request_json(url, headers=headers, timeout=45)
    except Exception:
        return []

    rows = []
    data = payload.get("data", {})
    for item in data.get("rows", []) or data.get("data", {}).get("rows", []):
        symbol = clean_symbol(item.get("symbol"))
        name = str(item.get("companyName") or item.get("name") or symbol).strip()
        price = parse_money(item.get("lastSalePrice") or item.get("lastsale"))
        change = parse_pct(item.get("percentageChange") or item.get("pctchange"))
        one_year = parse_pct(item.get("oneYearPercentage") or item.get("oneyearpercentage"))
        if not symbol or not name or not price or price <= 0:
            continue
        rows.append({
            "symbol": symbol,
            "company": name,
            "quotePrice": price,
            "quoteChangePct": change,
            "oneYearPct": one_year,
        })
    return rows


def etf_text(symbol, name):
    return f"{symbol} {name}".lower()


def clean_etf_name(name):
    return re.sub(r"\s+", " ", str(name or "").replace("ETF", "ETF")).strip()


def excluded_etf(symbol, name, theme=None):
    text = etf_text(symbol, name)
    excludes = list(ETF_EXCLUDE_KEYWORDS)
    if theme:
        excludes.extend(theme.get("exclude_keywords", []))
    return any(keyword in text for keyword in excludes)


def matches_etf_theme(row, theme):
    symbol = row["symbol"]
    name = row["company"]
    if symbol in theme.get("peers", []):
        return True
    if excluded_etf(symbol, name, theme):
        return False
    text = etf_text(symbol, name)
    return any(keyword in text for keyword in theme.get("keywords", []))


def fallback_etf_rows():
    rows = {}
    for symbol, (company, sector, industry, bucket, cap) in ETFS.items():
        rows[symbol] = {"symbol": symbol, "company": company, "quotePrice": None, "quoteChangePct": None, "oneYearPct": None}
    for symbol in ETF_RS_BENCHMARKS:
        rows.setdefault(symbol, {"symbol": symbol, "company": symbol, "quotePrice": None, "quoteChangePct": None, "oneYearPct": None})
    for theme in ETF_THEME_DEFS:
        for symbol in [theme["representative"], *theme.get("peers", [])]:
            rows.setdefault(symbol, {
                "symbol": symbol,
                "company": symbol,
                "quotePrice": None,
                "quoteChangePct": None,
                "oneYearPct": None,
            })
    return list(rows.values())


def build_etf_catalog():
    screener_rows = fetch_nasdaq_etf_screener()
    if not screener_rows:
        screener_rows = fallback_etf_rows()
    row_by_symbol = {row["symbol"]: row for row in screener_rows}
    selected = {}
    category_map = []

    for symbol in ETF_RS_BENCHMARKS:
        row = row_by_symbol.get(symbol) or {
            "symbol": symbol,
            "company": symbol,
            "quotePrice": None,
            "quoteChangePct": None,
            "oneYearPct": None,
        }
        selected[symbol] = row

    for theme in ETF_THEME_DEFS:
        peers = []
        for symbol in [theme["representative"], *theme.get("peers", [])]:
            row = row_by_symbol.get(symbol) or {
                "symbol": symbol,
                "company": symbol,
                "quotePrice": None,
                "quoteChangePct": None,
                "oneYearPct": None,
            }
            if not excluded_etf(row["symbol"], row["company"], theme):
                peers.append(row["symbol"])
                selected[row["symbol"]] = row

        discovered = [
            row for row in screener_rows
            if row["symbol"] not in peers and matches_etf_theme(row, theme)
        ]
        discovered.sort(key=lambda row: (
            row.get("oneYearPct") is not None,
            row.get("oneYearPct") or -999,
            ETF_CAP_HINTS.get(row["symbol"], 0),
        ), reverse=True)
        for row in discovered[:4]:
            peers.append(row["symbol"])
            selected[row["symbol"]] = row

        category_map.append({
            "group": theme["group"],
            "category": theme["category"],
            "representative": theme["representative"],
            "peers": list(dict.fromkeys(peers))[:12],
        })

    metas = {}
    symbol_to_category = {}
    for theme in category_map:
        for symbol in theme["peers"]:
            symbol_to_category.setdefault(symbol, theme["category"])

    for symbol, row in selected.items():
        category = symbol_to_category.get(symbol, "ETF")
        metas[symbol] = {
            "symbol": symbol,
            "company": clean_etf_name(row.get("company") or symbol),
            "sector": "EXCHANGE TRADED FUNDS",
            "industry": category,
            "marketCapB": ETF_CAP_HINTS.get(symbol, 0.2),
            "quotePrice": row.get("quotePrice"),
            "quoteChangePct": row.get("quoteChangePct"),
            "quoteVolume": 0,
            "groups": {"all_misc", "all_with_etf"},
            "etfCategory": category,
            "preferHistory": True,
        }
    return metas, category_map, len(screener_rows)


def fetch_yahoo_history(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(yahoo_symbol(symbol))}?range=5y&interval=1d"
    payload = request_json(url, timeout=12)
    result = payload["chart"]["result"][0]
    quote = result["indicators"]["quote"][0]
    opens = quote.get("open", [])
    highs = quote.get("high", [])
    lows = quote.get("low", [])
    closes = quote["close"]
    volumes = quote["volume"]
    timestamps = result.get("timestamp", [])
    rows = []
    for timestamp, open_value, high, low, close, volume in zip(timestamps, opens, highs, lows, closes, volumes):
        if close is not None:
            close = float(close)
            rows.append({
                "date": datetime.fromtimestamp(timestamp, tz=ZoneInfo("UTC")).date().isoformat(),
                "open": float(open_value if open_value is not None else close),
                "high": float(high if high is not None else close),
                "low": float(low if low is not None else close),
                "close": close,
                "volume": float(volume or 0),
            })
    if len(rows) < 30:
        raise RuntimeError(f"Not enough rows for {symbol}")
    return rows[-1260:]


def synthetic_history(symbol, price_hint=None, change_hint=None, volume_hint=None):
    seed = stable_unit(symbol)
    target = price_hint or (20 + seed * 480)
    rows = []
    price = target * (0.65 + stable_unit(symbol + "start") * 0.55)
    start_date = datetime.now(ZoneInfo("Asia/Seoul")).date() - timedelta(days=380)
    for i in range(260):
        previous = price
        drift = (stable_unit(symbol + str(i)) - 0.48) * 0.035
        price = max(0.25, price * (1 + drift))
        volume = volume_hint or 1_000_000 * (0.5 + stable_unit(symbol + "v" + str(i)) * 2.5)
        high = max(previous, price) * (1 + stable_unit(symbol + "h" + str(i)) * 0.014)
        low = min(previous, price) * (1 - stable_unit(symbol + "l" + str(i)) * 0.014)
        rows.append({
            "date": (start_date + timedelta(days=i)).isoformat(),
            "open": previous,
            "high": high,
            "low": low,
            "close": price,
            "volume": volume,
        })

    scale = target / rows[-1]["close"]
    rows = [
        {
            "open": row["open"] * scale,
            "high": row["high"] * scale,
            "low": row["low"] * scale,
            "close": row["close"] * scale,
            "volume": row["volume"],
            "date": row.get("date"),
        }
        for row in rows
    ]
    if change_hint is not None:
        previous = target / (1 + change_hint / 100) if change_hint > -99 else target
        rows[-2]["close"] = previous
        rows[-1]["open"] = previous
    rows[-1]["close"] = target
    rows[-1]["high"] = max(rows[-1]["high"], target)
    rows[-1]["low"] = min(rows[-1]["low"], target)
    rows[-1]["volume"] = volume_hint or rows[-1]["volume"]
    return rows


def fetch_news(symbol, limit=8):
    """Fetch recent headlines for a ticker from Yahoo Finance search.

    Returns a list of {title, publisher, link, publishedAt}. Network/parse
    failures yield an empty list so the build never breaks on news.
    """
    url = (
        "https://query1.finance.yahoo.com/v1/finance/search?"
        f"q={urllib.parse.quote(symbol)}&newsCount={limit}&quotesCount=0&enableFuzzyQuery=false"
    )
    try:
        payload = request_json(url, timeout=10)
    except Exception:
        return []
    items = []
    for entry in (payload.get("news") or [])[:limit]:
        title = str(entry.get("title") or "").strip()
        link = str(entry.get("link") or "").strip()
        if not title or not link:
            continue
        published_at = ""
        published = entry.get("providerPublishTime")
        if published:
            try:
                published_at = datetime.fromtimestamp(
                    int(published), tz=ZoneInfo("Asia/Seoul")
                ).strftime("%Y-%m-%d")
            except Exception:
                published_at = ""
        items.append({
            "title": title,
            "publisher": str(entry.get("publisher") or "").strip(),
            "link": link,
            "publishedAt": published_at,
        })
    return items


def fetch_nasdaq_fundamentals(symbol, price_hint=None, market_cap_b=None):
    referer = f"https://www.nasdaq.com/market-activity/stocks/{symbol.lower()}"
    headers = {**NASDAQ_HEADERS, "Referer": referer}
    out = {}

    try:
        summary = request_json(
            f"https://api.nasdaq.com/api/quote/{urllib.parse.quote(symbol)}/summary?assetclass=stocks",
            headers=headers,
            timeout=12,
        ).get("data", {}).get("summaryData", {})
        market_cap = parse_number(summary.get("MarketCap", {}).get("value"))
        if market_cap:
            out["marketCapB"] = round(market_cap / 1_000_000_000, 3)
        out["targetPrice"] = parse_money(summary.get("OneYrTarget", {}).get("value"))
        out["avgVolume"] = parse_number(summary.get("AverageVolume", {}).get("value"))
        out["volume"] = parse_number(summary.get("ShareVolume", {}).get("value"))
        out["prevClose"] = parse_money(summary.get("PreviousClose", {}).get("value"))
        high_52, low_52 = split_52w(summary.get("FiftTwoWeekHighLow", {}).get("value"))
        out["week52High"] = high_52
        out["week52Low"] = low_52
        out["exchange"] = summary.get("Exchange", {}).get("value")
    except Exception:
        pass

    try:
        financials = request_json(
            f"https://api.nasdaq.com/api/company/{urllib.parse.quote(symbol)}/financials?frequency=1",
            headers=headers,
            timeout=16,
        ).get("data", {})
        income = financials.get("incomeStatementTable", {})
        balance = financials.get("balanceSheetTable", {})
        ratios = financials.get("financialRatiosTable", {})
        out["salesB"] = financial_to_b(table_value(income, "Total Revenue"))
        out["grossProfitB"] = financial_to_b(table_value(income, "Gross Profit"))
        out["operIncomeB"] = financial_to_b(table_value(income, "Operating Income"))
        out["incomeB"] = financial_to_b(table_value(income, "Net Income"))
        out["cashB"] = financial_to_b(table_value(balance, "Cash and Cash Equivalents"))
        out["assetsB"] = financial_to_b(table_value(balance, "Total Assets"))
        out["liabilitiesB"] = financial_to_b(table_value(balance, "Total Liabilities"))
        out["equityB"] = financial_to_b(table_value(balance, "Total Equity"))
        short_debt = financial_to_b(table_value(balance, "Short-Term Debt / Current Portion of Long-Term Debt")) or 0
        long_debt = financial_to_b(table_value(balance, "Long-Term Debt")) or 0
        out["debtB"] = round(short_debt + long_debt, 3)
        out["currentRatio"] = parse_percent_value(table_value(ratios, "Current Ratio"))
        out["quickRatio"] = parse_percent_value(table_value(ratios, "Quick Ratio"))
        out["grossMargin"] = parse_percent_value(table_value(ratios, "Gross Margin"))
        out["operMargin"] = parse_percent_value(table_value(ratios, "Operating Margin"))
        out["profitMargin"] = parse_percent_value(table_value(ratios, "Profit Margin"))
        out["roe"] = parse_percent_value(table_value(ratios, "After Tax ROE"))
    except Exception:
        pass

    try:
        eps_data = request_json(
            f"https://api.nasdaq.com/api/quote/{urllib.parse.quote(symbol)}/eps?assetclass=stocks",
            headers=headers,
            timeout=12,
        ).get("data", {}).get("earningsPerShare", [])
        previous = [row for row in eps_data if row.get("type") == "PreviousQuarter" and row.get("earnings")]
        upcoming = [row for row in eps_data if row.get("type") == "UpcomingQuarter" and row.get("consensus")]
        if previous:
            out["epsTtm"] = round(sum(float(row.get("earnings") or 0) for row in previous[-4:]), 2)
        if upcoming:
            out["epsNextY"] = round(sum(float(row.get("consensus") or 0) for row in upcoming[:4]), 2)
            out["epsNextQ"] = float(upcoming[0].get("consensus") or 0)
    except Exception:
        pass

    price = price_hint or out.get("prevClose")
    market_cap = out.get("marketCapB") or market_cap_b
    if price and market_cap:
        out["sharesB"] = round(market_cap / price, 3)
    if price and out.get("epsTtm") and out["epsTtm"] > 0:
        out["pe"] = round(price / out["epsTtm"], 2) if out["epsTtm"] else None
    elif market_cap and out.get("incomeB") and out["incomeB"] > 0:
        out["pe"] = round(market_cap / out["incomeB"], 2)
    if price and out.get("epsNextY") and out["epsNextY"] > 0:
        out["forwardPE"] = round(price / out["epsNextY"], 2) if out["epsNextY"] else None
    if market_cap and out.get("salesB") and out["salesB"] > 0:
        out["ps"] = round(market_cap / out["salesB"], 2)
    if market_cap and out.get("equityB") and out["equityB"] > 0:
        out["pb"] = round(market_cap / out["equityB"], 2)
    if out.get("debtB") is not None and out.get("equityB"):
        out["debtEq"] = round(out["debtB"] / out["equityB"], 2) if out["equityB"] else None
    if out:
        out["source"] = "nasdaq"

    return {key: value for key, value in out.items() if value not in (None, "")}


def load_ticker_cik_map():
    global _TICKER_CIK_CACHE
    if _TICKER_CIK_CACHE is not None:
        return _TICKER_CIK_CACHE
    try:
        payload = request_json(
            "https://www.sec.gov/files/company_tickers.json",
            headers=SEC_HEADERS,
            timeout=20,
        )
    except Exception:
        _TICKER_CIK_CACHE = {}
        return _TICKER_CIK_CACHE
    _TICKER_CIK_CACHE = {
        str(item.get("ticker") or "").upper(): str(item.get("cik_str") or "").zfill(10)
        for item in payload.values()
        if item.get("ticker")
    }
    return _TICKER_CIK_CACHE


def latest_sec_gaap_value(usgaap, tags):
    for tag in tags:
        block = usgaap.get(tag)
        if not block:
            continue
        for unit_key in ("USD", "shares", "pure"):
            rows = (block.get("units") or {}).get(unit_key) or []
            if not rows:
                continue
            annual = [row for row in rows if row.get("form") == "10-K"]
            pool = annual or rows
            pool.sort(key=lambda row: row.get("end", ""), reverse=True)
            if pool and pool[0].get("val") is not None:
                return float(pool[0]["val"])
    return None


def fetch_sec_fundamentals(symbol, price_hint=None, market_cap_b=None):
    cik = load_ticker_cik_map().get(str(symbol or "").upper())
    if not cik:
        return {}
    try:
        payload = request_json(
            f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
            headers=SEC_HEADERS,
            timeout=24,
        )
    except Exception:
        return {}
    usgaap = payload.get("facts", {}).get("us-gaap", {})
    revenue = latest_sec_gaap_value(
        usgaap,
        [
            "Revenues",
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "InterestIncomeExpenseNet",
            "TotalRevenuesAndOtherIncome",
        ],
    )
    net_income = latest_sec_gaap_value(usgaap, ["NetIncomeLoss", "ProfitLoss"])
    equity = latest_sec_gaap_value(usgaap, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"])
    assets = latest_sec_gaap_value(usgaap, ["Assets"])
    cash = latest_sec_gaap_value(usgaap, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsAndShortTermInvestments"])
    debt = latest_sec_gaap_value(usgaap, ["LongTermDebt", "LongTermDebtNoncurrent"])
    eps = latest_sec_gaap_value(usgaap, ["EarningsPerShareBasic", "EarningsPerShareDiluted"])

    out = {}
    if revenue:
        out["salesB"] = round(revenue / 1_000_000_000, 3)
    if net_income:
        out["incomeB"] = round(net_income / 1_000_000_000, 3)
    if cash:
        out["cashB"] = round(cash / 1_000_000_000, 3)
    if assets:
        out["assetsB"] = round(assets / 1_000_000_000, 3)
    if equity:
        out["equityB"] = round(equity / 1_000_000_000, 3)
    if debt and equity:
        out["debtB"] = round(debt / 1_000_000_000, 3)
        out["debtEq"] = round((debt / 1_000_000_000) / max(out["equityB"], 0.001), 2)
    if net_income and revenue:
        out["profitMargin"] = round((net_income / revenue) * 100, 2)
    if net_income and equity:
        out["roe"] = round((net_income / equity) * 100, 2)

    price = price_hint
    market_cap = market_cap_b
    if eps and price:
        out["epsTtm"] = round(eps, 2)
        if eps > 0:
            out["pe"] = round(price / eps, 2)
    if market_cap and out.get("incomeB") and out["incomeB"] > 0:
        out["pe"] = out.get("pe") or round(market_cap / out["incomeB"], 2)
    if market_cap and out.get("salesB") and out["salesB"] > 0:
        out["ps"] = round(market_cap / out["salesB"], 2)
    if market_cap and out.get("equityB") and out["equityB"] > 0:
        out["pb"] = round(market_cap / out["equityB"], 2)
    if price and market_cap:
        out["sharesB"] = round(market_cap / price, 3)
    out["source"] = "sec"
    return {key: value for key, value in out.items() if value not in (None, "")}


def fetch_yahoo_fundamentals(symbol, price_hint=None, market_cap_b=None):
    try:
        import yfinance as yf
    except ImportError:
        return {}
    try:
        info = yf.Ticker(yahoo_symbol(symbol)).info or {}
    except Exception:
        return {}
    if not info:
        return {}

    def pct_val(raw):
        if raw is None:
            return None
        val = float(raw)
        if abs(val) <= 1.5:
            return round(val * 100, 2)
        return round(val, 2)

    out = {}
    mcap = info.get("marketCap")
    if mcap:
        out["marketCapB"] = round(float(mcap) / 1_000_000_000, 3)
    for src, dst in (
        ("targetMeanPrice", "targetPrice"),
        ("averageVolume", "avgVolume"),
        ("volume", "volume"),
        ("previousClose", "prevClose"),
        ("fiftyTwoWeekHigh", "week52High"),
        ("fiftyTwoWeekLow", "week52Low"),
        ("exchange", "exchange"),
        ("trailingEps", "epsTtm"),
        ("forwardEps", "epsNextY"),
    ):
        val = info.get(src)
        if val not in (None, ""):
            out[dst] = round(float(val), 4) if isinstance(val, (int, float)) else val
    for src, dst in (
        ("totalRevenue", "salesB"),
        ("grossProfits", "grossProfitB"),
        ("operatingIncome", "operIncomeB"),
        ("netIncomeToCommon", "incomeB"),
        ("totalCash", "cashB"),
        ("totalAssets", "assetsB"),
        ("totalDebt", "debtB"),
        ("totalStockholderEquity", "equityB"),
    ):
        val = info.get(src)
        if val:
            out[dst] = round(float(val) / 1_000_000_000, 3)
    for src, dst in (
        ("profitMargins", "profitMargin"),
        ("grossMargins", "grossMargin"),
        ("operatingMargins", "operMargin"),
        ("returnOnEquity", "roe"),
    ):
        val = pct_val(info.get(src))
        if val is not None:
            out[dst] = val
    cr = info.get("currentRatio")
    qr = info.get("quickRatio")
    if cr is not None:
        out["currentRatio"] = round(float(cr), 2)
    if qr is not None:
        out["quickRatio"] = round(float(qr), 2)

    price = price_hint or out.get("prevClose") or info.get("regularMarketPrice")
    market_cap = out.get("marketCapB") or market_cap_b
    pe = info.get("trailingPE")
    fpe = info.get("forwardPE")
    if pe:
        out["pe"] = round(float(pe), 2)
    if fpe:
        out["forwardPE"] = round(float(fpe), 2)
    if price and market_cap:
        out["sharesB"] = round(float(market_cap) / float(price), 3)
    if market_cap and out.get("salesB"):
        out["ps"] = round(float(market_cap) / float(out["salesB"]), 2)
    if market_cap and out.get("equityB"):
        out["pb"] = round(float(market_cap) / float(out["equityB"]), 2)
    if out.get("debtB") and out.get("equityB"):
        out["debtEq"] = round(float(out["debtB"]) / max(float(out["equityB"]), 0.001), 2)
    out["source"] = "yahoo"
    return {key: value for key, value in out.items() if value not in (None, "")}


def merge_fundamentals(primary, secondary):
    merged = dict(secondary or {})
    merged.update(primary or {})
    if primary and secondary:
        merged["source"] = "nasdaq+sec"
    elif primary:
        merged["source"] = (primary or {}).get("source") or "nasdaq"
    elif secondary:
        merged["source"] = (secondary or {}).get("source") or "sec"
    return {key: value for key, value in merged.items() if value not in (None, "")}


def fetch_all_fundamentals(symbol, price_hint=None, market_cap_b=None, min_fields_for_yahoo=10):
    nasdaq = fetch_nasdaq_fundamentals(symbol, price_hint=price_hint, market_cap_b=market_cap_b)
    sec = fetch_sec_fundamentals(symbol, price_hint=price_hint, market_cap_b=market_cap_b)
    merged = merge_fundamentals(nasdaq, sec)
    yahoo = {}
    if len(merged) < min_fields_for_yahoo:
        yahoo = fetch_yahoo_fundamentals(symbol, price_hint=price_hint, market_cap_b=market_cap_b)
        merged = merge_fundamentals(merged, yahoo)
    sources = []
    for part in (nasdaq, sec, yahoo):
        src = (part or {}).get("source")
        if src and src not in sources:
            sources.append(src)
    if sources:
        merged["source"] = "+".join(sources)
    return merged


def fetch_fundamentals_backfill(symbol, price_hint=None, market_cap_b=None, min_fields=10):
    """백필용: Yahoo 우선(Nasdaq/SEC 403 회피), 부족 시 API 병합."""
    yahoo = fetch_yahoo_fundamentals(symbol, price_hint=price_hint, market_cap_b=market_cap_b)
    if len(yahoo) >= min_fields:
        return yahoo
    nasdaq = fetch_nasdaq_fundamentals(symbol, price_hint=price_hint, market_cap_b=market_cap_b)
    sec = fetch_sec_fundamentals(symbol, price_hint=price_hint, market_cap_b=market_cap_b)
    merged = merge_fundamentals(yahoo, merge_fundamentals(nasdaq, sec))
    sources = []
    for part in (yahoo, nasdaq, sec):
        src = (part or {}).get("source")
        if src and src not in sources:
            sources.append(src)
    if sources:
        merged["source"] = "+".join(sources)
    return merged


def make_stock(meta, rows):
    closes = [row["close"] for row in rows]
    volumes = [row["volume"] for row in rows]
    price = float(meta.get("quotePrice") or closes[-1])
    prev = closes[-2]
    change_pct = meta.get("quoteChangePct")
    if change_pct is None:
        change_pct = pct(price, prev)
    volume_avg = sum(volumes[-21:-1]) / max(1, len(volumes[-21:-1]))
    high_52w = max(max(closes), price)
    low_52w = min(min(closes), price)
    rs_score = calc_rs_score(price, closes)
    fundamentals = meta.get("fundamentals") or {}
    eps_score = calc_eps_score(price, closes, fundamentals)
    stoch = clamp((price - low_52w) / max(0.01, high_52w - low_52w) * 100)
    market_cap_b = fundamentals.get("marketCapB") or meta.get("marketCapB") or synthetic_cap(meta["symbol"], meta["sector"])
    quote_volume = meta.get("quoteVolume")
    volume_ratio = (quote_volume / volume_avg) if quote_volume and volume_avg else (volumes[-1] / volume_avg if volume_avg else 1.0)
    ytd_base = ytd_base_close(rows, closes)

    stock = {
        "ticker": meta["symbol"],
        "company": meta["company"],
        "industry": meta["industry"],
        "sector": meta["sector"],
        "bucket": cap_bucket(market_cap_b, meta.get("groups", set())),
        "groups": sorted(meta.get("groups", set())),
        "price": round(price, 2),
        "changePct": round(change_pct, 1),
        "weekChangePct": pct(price, lookback(closes, 6)),
        "monthChangePct": pct(price, lookback(closes, 22)),
        "threeMonthChangePct": pct(price, lookback(closes, 64)),
        "ytdChangePct": pct(price, ytd_base),
        "marketCapB": round(market_cap_b, 3),
        "volumeRatio": round(max(0.1, volume_ratio), 1),
        "rsScore": rs_score,
        "epsRevScore": eps_score,
        "rsi14": clamp(50 + pct(price, lookback(closes, 15)) * 3),
        "stochK": stoch,
        "newHighDistancePct": round((1 - price / high_52w) * 100, 1),
        "newHighRecency4w": 1 if price >= high_52w * 0.99 else (2 if price >= high_52w * 0.96 else "None"),
        "closeSeries": [round(value, 2) for value in closes[-40:-1]] + [round(price, 2)],
        "historySource": meta.get("historySource", "synthetic"),
    }
    if meta.get("etfCategory"):
        stock["etfCategory"] = meta["etfCategory"]
    if meta.get("preferHistory"):
        history_rows = rows[-1260:]
        stock["chartSeries"] = [
            [
                round(row["open"], 2),
                round(row["high"], 2),
                round(row["low"], 2),
                round(price if index == len(history_rows) - 1 else row["close"], 2),
                int(row["volume"]),
                row.get("date"),  # YYYY-MM-DD for the chart x-axis (None if unavailable)
            ]
            for index, row in enumerate(history_rows)
        ]
    if fundamentals:
        stock["fundamentals"] = fundamentals
    if meta.get("news"):
        stock["news"] = meta["news"]
    return stock


def calc_rs_score(price, closes):
    # Relative strength proxy: weighted medium/long-term price momentum.
    return clamp(
        50
        + pct(price, lookback(closes, 63)) * 0.9
        + pct(price, lookback(closes, 126)) * 0.6
        + pct(price, lookback(closes, 252)) * 0.35
    )


def calc_eps_score(price, closes, fundamentals):
    eps_ttm = fundamentals.get("epsTtm")
    eps_next = fundamentals.get("epsNextY")
    if eps_ttm and eps_ttm > 0 and eps_next:
        growth = ((eps_next / eps_ttm) - 1) * 100
        forward_pe = fundamentals.get("forwardPE") or 0
        valuation_penalty = max(0, min(30, (forward_pe - 35) * 0.4)) if forward_pe else 0
        return clamp(50 + growth * 0.8 - valuation_penalty)
    return clamp(50 + pct(price, lookback(closes, 42)) * 0.9)


def lookback(values, periods):
    if not values:
        return 0
    if len(values) > periods:
        return values[-periods]
    return values[0]


def ytd_base_close(rows, closes):
    current_year = str(datetime.now(ZoneInfo("Asia/Seoul")).year)
    for row in rows:
        if str(row.get("date", "")).startswith(current_year):
            return row["close"]
    return lookback(closes, 252)


def cap_bucket(market_cap_b, groups):
    if "all_misc" in groups:
        return "all_misc"
    if market_cap_b >= 10:
        return "gte10b"
    if market_cap_b >= 1:
        return "1to10b"
    return "lt1b"


def synthetic_cap(symbol, sector):
    sector_base = {
        "TECHNOLOGY": 95, "COMMUNICATION SERVICES": 80, "FINANCIAL": 55,
        "HEALTHCARE": 70, "ENERGY": 50, "CONSUMER CYCLICAL": 45,
        "CONSUMER DEFENSIVE": 45, "UTILITIES": 30, "REAL ESTATE": 25,
        "INDUSTRIALS": 45, "BASIC MATERIALS": 35,
    }.get(sector, 20)
    return max(0.1, sector_base * (0.05 + stable_unit(symbol + "cap") * 2.8))


def load_leveraged_etf_catalog_items():
    script = ROOT / "scripts" / "build_leveraged_etf_catalog.py"
    if not script.exists():
        return []
    spec = importlib.util.spec_from_file_location("build_leveraged_etf_catalog", script)
    if spec is None or spec.loader is None:
        return []
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.catalog_items()


def build_leveraged_etf_metas():
    """Include curated leveraged/inverse/option ETFs in the daily snapshot universe."""
    metas = {}
    for item in load_leveraged_etf_catalog_items():
        symbol = item["ticker"]
        group = item.get("group") or "레버리지·옵션 ETF"
        metas[symbol] = {
            "symbol": symbol,
            "company": item.get("name") or symbol,
            "sector": "EXCHANGE TRADED FUNDS",
            "industry": f"Leveraged/Option ETF — {group}",
            "marketCapB": ETF_CAP_HINTS.get(symbol, 0.15),
            "groups": {"all_misc", "all_with_etf", "lev_etf"},
            "etfCategory": group,
            "levEtfType": item.get("type", "leveraged"),
            "preferHistory": True,
        }
    return metas


def merge_meta(existing, incoming):
    if not existing:
        return incoming
    existing["groups"].update(incoming.get("groups", set()))
    for key in ["company", "sector", "industry", "quotePrice", "quoteChangePct", "quoteVolume", "marketCapB", "etfCategory"]:
        value = incoming.get(key)
        if value not in (None, "", "Other") and (not existing.get(key) or key in {"quotePrice", "quoteChangePct", "quoteVolume"}):
            existing[key] = value
    if incoming.get("marketCapB") and incoming["marketCapB"] > existing.get("marketCapB", 0):
        existing["marketCapB"] = incoming["marketCapB"]
    return existing


def build_universe():
    universe = {}
    exchange_groups = fetch_exchange_groups()
    etf_metas, etf_category_map, etf_universe_count = build_etf_catalog()

    for meta in fetch_nasdaq_screener():
        meta["groups"].update(exchange_groups.get(meta["symbol"], set()))
        universe[meta["symbol"]] = merge_meta(universe.get(meta["symbol"]), meta)

    for symbol, company, gics_sector, sub_industry in fetch_sp500_constituents():
        if symbol in DUPLICATE_SHARE_CLASSES:
            continue
        meta = {
            "symbol": symbol,
            "company": company,
            "sector": map_sector(gics_sector),
            "industry": sub_industry or "Other",
            "marketCapB": MARKET_CAP_B.get(symbol),
            "groups": {"all_us", "idx_sp500", *exchange_groups.get(symbol, set())},
        }
        universe[symbol] = merge_meta(universe.get(symbol), meta)

    for symbol in fetch_nasdaq100_symbols():
        if symbol in DUPLICATE_SHARE_CLASSES:
            continue
        meta = {
            "symbol": symbol,
            "company": symbol,
            "sector": "MISC",
            "industry": "Other",
            "marketCapB": MARKET_CAP_B.get(symbol),
            "groups": {"all_us", "idx_ndx100", *exchange_groups.get(symbol, set())},
        }
        universe[symbol] = merge_meta(universe.get(symbol), meta)

    for symbol, (company, sector, industry, bucket, cap) in EXTRA_GROWTH.items():
        meta = {
            "symbol": symbol,
            "company": company,
            "sector": sector,
            "industry": industry,
            "marketCapB": cap,
            "groups": {"all_us", bucket, *exchange_groups.get(symbol, set())},
        }
        universe[symbol] = merge_meta(universe.get(symbol), meta)

    for symbol, meta in etf_metas.items():
        universe[symbol] = merge_meta(universe.get(symbol), meta)

    lev_etf_count = 0
    for symbol, meta in build_leveraged_etf_metas().items():
        universe[symbol] = merge_meta(universe.get(symbol), meta)
        lev_etf_count += 1

    exchange_backfill_count = 0
    for row in iter_exchange_listed_rows():
        symbol = row["symbol"]
        if symbol in DUPLICATE_SHARE_CLASSES or not is_common_equity(symbol, row["company"]):
            continue
        if symbol in universe:
            universe[symbol]["groups"].update(row["groups"])
            continue
        listed_groups = set(row["groups"])
        universe[symbol] = merge_meta(universe.get(symbol), {
            "symbol": symbol,
            "company": row["company"],
            "sector": "MISC",
            "industry": "Other",
            "marketCapB": MARKET_CAP_B.get(symbol),
            "groups": {"all_us", *listed_groups},
            "preferHistory": bool(listed_groups & {"idx_nyse", "idx_nasdaq", "idx_amex"}),
        })
        exchange_backfill_count += 1

    metas = list(universe.values())
    metas.sort(key=lambda item: history_priority(item), reverse=True)
    real_symbols = {meta["symbol"] for meta in metas[:MAX_REAL_HISTORY]}
    for meta in metas:
        if meta["symbol"] in real_symbols or "all_misc" in meta["groups"] or is_active_small_cap(meta):
            meta["preferHistory"] = True
        else:
            meta["preferHistory"] = False
    fundamental_symbols = {meta["symbol"] for meta in metas[:MAX_FUNDAMENTALS]}
    for meta in metas:
        groups = set(meta.get("groups") or [])
        meta["preferFundamentals"] = (
            "all_misc" not in groups
            and meta.get("sector") != "EXCHANGE TRADED FUNDS"
            and (
                "idx_sp500" in groups
                or "idx_ndx100" in groups
                or "idx_nyse" in groups
                or "idx_nasdaq" in groups
                or meta["symbol"] in fundamental_symbols
                or is_active_small_cap(meta)
                or float(meta.get("marketCapB") or 0) >= 0.05
            )
        )
    return metas, etf_category_map, etf_universe_count, lev_etf_count, exchange_backfill_count


def history_priority(meta):
    groups = meta.get("groups", set())
    score = meta.get("marketCapB") or 0
    if "idx_sp500" in groups:
        score += 10_000
    if "idx_ndx100" in groups:
        score += 8_000
    if "all_misc" in groups:
        score += 6_000
    return score


def is_active_small_cap(meta):
    symbol = meta.get("symbol")
    if symbol in THEMATIC_REAL_SYMBOLS:
        return True
    cap = meta.get("marketCapB") or 0
    volume = meta.get("quoteVolume") or 0
    change = abs(meta.get("quoteChangePct") or 0)
    if volume >= ACTIVE_LIQUID_MIN_VOLUME:
        return True
    if change >= ACTIVE_MOVER_MIN_CHANGE_PCT and volume >= ACTIVE_MOVER_MIN_VOLUME:
        return True
    return cap >= ACTIVE_SMALL_CAP_MIN_CAP_B and volume >= ACTIVE_SMALL_CAP_MIN_VOLUME


def build_summary(stocks):
    stock_rows = [item for item in stocks if item["sector"] != "EXCHANGE TRADED FUNDS"]
    sector_scores = {}
    for item in stock_rows:
        sector_scores.setdefault(item["sector"], []).append(item["changePct"])
    ranked = sorted(
        ((sector, sum(values) / len(values)) for sector, values in sector_scores.items()),
        key=lambda item: item[1],
        reverse=True,
    )
    ai_names = {"NVDA", "PLTR", "APP", "HOOD", "RKLB", "IONQ"}
    ai_up = sum(1 for item in stocks if item["ticker"] in ai_names and item["monthChangePct"] > 0)
    return {
        "marketTone": "기술주 우세" if ranked and ranked[0][0] in {"TECHNOLOGY", "COMMUNICATION SERVICES"} else "혼조",
        "strongSector": ranked[0][0] if ranked else "N/A",
        "weakSector": ranked[-1][0] if ranked else "N/A",
        "aiBreadth": f"AI 성장주 {len(ai_names)}개 중 {ai_up}개 단기 상승",
    }


def build_one(meta):
    symbol = meta["symbol"]
    try:
        if meta.get("preferHistory"):
            rows = fetch_yahoo_history(symbol)
            meta["historySource"] = "yahoo"
        else:
            rows = synthetic_history(symbol, meta.get("quotePrice"), meta.get("quoteChangePct"), meta.get("quoteVolume"))
            meta["historySource"] = "snapshot"
        error = None
    except Exception as exc:
        rows = synthetic_history(symbol, meta.get("quotePrice"), meta.get("quoteChangePct"), meta.get("quoteVolume"))
        meta["historySource"] = "snapshot"
        error = f"{symbol}: {exc}"
    if meta.get("preferFundamentals"):
        try:
            price_hint = meta.get("quotePrice") or (rows[-1]["close"] if rows else None)
            cap_hint = meta.get("marketCapB")
            meta["fundamentals"] = fetch_all_fundamentals(symbol, price_hint=price_hint, market_cap_b=cap_hint)
        except Exception as exc:
            meta["fundamentals"] = {}
            error = f"{error}; fundamentals {symbol}: {exc}" if error else f"fundamentals {symbol}: {exc}"
    # News is attached to every ticker that gets a detail file (real history or fundamentals),
    # so the stock-analysis page can show headlines when it lazily loads that detail file.
    if meta.get("preferHistory") or meta.get("preferFundamentals"):
        news = fetch_news(symbol)
        if news:
            meta["news"] = news
    return make_stock(meta, rows), error


def health(ticker, name, change, note):
    return {"ticker": ticker, "name": name, "changePct": change, "note": note}


def stock_text(item):
    return f"{item.get('ticker', '')} {item.get('company', '')} {item.get('sector', '')} {item.get('industry', '')}".lower()


def has_any(text, terms):
    return any(term in text for term in terms)


def stock_matches_etf_category(item, category, group):
    if item.get("sector") == "EXCHANGE TRADED FUNDS":
        return False
    text = stock_text(item)
    sector = item.get("sector")
    groups = set(item.get("groups", []))
    ticker = item.get("ticker")

    ticker_rules = {
        "Semiconductors": {"NVDA", "AVGO", "AMD", "QCOM", "MU", "INTC", "TXN", "ADI", "MRVL", "ARM", "ASML", "TSM", "ON", "MPWR", "LSCC", "MCHP", "AMAT", "LRCX", "KLAC"},
        "Cybersecurity": {"PANW", "CRWD", "FTNT", "ZS", "OKTA", "NET", "S", "CYBR", "TENB", "CHKP"},
        "AI / Robotics": {"NVDA", "PLTR", "APP", "PATH", "TER", "ROK", "ISRG", "ROBO", "SYM", "SOUN", "BBAI"},
        "Bitcoin Miners / Blockchain Equity": {"MARA", "RIOT", "CLSK", "IREN", "CORZ", "WULF", "CIFR", "HUT", "BITF", "BTDR", "HOOD", "COIN", "MSTR"},
        "Fintech": {"HOOD", "COIN", "SOFI", "PYPL", "SQ", "AFRM", "UPST", "NU", "TOST"},
        "Payments": {"V", "MA", "PYPL", "SQ", "FIS", "FI", "GPN", "ADYEY"},
        "Video Games / Esports": {"TTWO", "EA", "RBLX", "U", "NTES"},
        "Autos / EV": {"TSLA", "RIVN", "LCID", "NIO", "XPEV", "LI", "GM", "F", "ALB"},
        "Cannabis": {"TLRY", "CGC", "ACB", "CRON"},
        "Regional Banks": {"KRE", "FITB", "HBAN", "RF", "CFG", "KEY", "TFC", "ZION", "CMA", "WAL"},
        "Banks": {"JPM", "BAC", "WFC", "C", "GS", "MS", "PNC", "USB", "TFC", "SCHW"},
        "Insurance": {"BRK.B", "PGR", "CB", "TRV", "AIG", "MET", "PRU", "ALL", "AFL"},
        "Pharmaceuticals": {"LLY", "JNJ", "MRK", "PFE", "ABBV", "BMY", "AMGN", "GILD", "VRTX", "REGN"},
        "Biotech": {"AMGN", "GILD", "VRTX", "REGN", "BIIB", "MRNA", "ILMN", "ALNY", "TECH"},
        "Genomics": {"ILMN", "TXG", "CRSP", "EDIT", "NTLA", "BEAM", "DNA"},
        "Medical Devices": {"ISRG", "SYK", "BSX", "MDT", "ABT", "DXCM", "EW", "ZBH"},
        "Aerospace / Defense": {"RTX", "LMT", "NOC", "GD", "BA", "TDG", "LHX", "HWM", "RKLB", "ASTS"},
        "Airlines": {"DAL", "UAL", "AAL", "LUV", "ALK", "JBLU"},
        "Homebuilders": {"DHI", "LEN", "PHM", "NVR", "TOL", "KBH", "MTH"},
        "Oil Services": {"SLB", "HAL", "BKR", "NOV", "OII", "FTI"},
        "Uranium / Nuclear": {"CCJ", "CEG", "UEC", "SMR", "LEU", "BWXT", "NXE"},
        "Battery / Lithium": {"ALB", "LAC", "PLL", "QS", "ENVX", "FREY"},
        "Copper Miners": {"FCX", "SCCO", "TECK", "HBM"},
        "Steel": {"NUE", "STLD", "X", "CLF", "RS", "CMC"},
        "Water": {"AWK", "WTRG", "XYL", "AWR", "PNR"},
        "Restaurants": {"MCD", "SBUX", "CMG", "YUM", "DRI", "DPZ", "CAVA", "WING"},
        "Travel / Leisure": {"BKNG", "ABNB", "MAR", "HLT", "CCL", "RCL", "NCLH", "EXPE"},
    }
    if ticker in ticker_rules.get(category, set()):
        return True

    text_rules = {
        "Semiconductors": ["semiconductor", "semiconductors", "chip equipment"],
        "Technology Broad": ["software", "semiconductor", "computer", "technology", "electronic"],
        "Software / Cloud": ["software", "cloud", "application", "infrastructure"],
        "Cloud Infrastructure": ["cloud", "data center", "infrastructure"],
        "Data Centers": ["data center", "reit", "digital infrastructure"],
        "Quantum Computing": ["quantum"],
        "Space Economy": ["space", "aerospace", "satellite"],
        "Communication Services": ["communication", "telecom", "media", "internet"],
        "Internet": ["internet", "interactive media", "online"],
        "Media / Entertainment": ["media", "entertainment", "streaming"],
        "Social Media": ["social", "interactive media"],
        "Consumer Discretionary": ["retail", "auto", "restaurant", "hotel", "leisure", "apparel"],
        "Retail / Ecommerce": ["retail", "e-commerce", "internet retail", "specialty retail"],
        "Consumer Staples": ["staples", "food", "beverage", "household", "grocery"],
        "Financials Broad": ["bank", "insurance", "capital markets", "financial", "brokerage"],
        "Broker Dealers / Capital Markets": ["capital markets", "broker", "asset management", "exchange"],
        "Healthcare Broad": ["health", "pharma", "biotech", "medical"],
        "Healthcare Providers": ["healthcare provider", "managed care", "hospital"],
        "Healthcare Services": ["healthcare services", "diagnostics", "laboratory"],
        "Medical Equipment": ["medical equipment", "medical devices"],
        "Industrials Broad": ["industrial", "machinery", "aerospace", "transportation", "construction"],
        "Construction / Engineering": ["construction", "engineering", "building"],
        "Machinery": ["machinery", "equipment"],
        "Transportation": ["transportation", "trucking", "rail", "airline", "logistics"],
        "Railroads": ["rail"],
        "Infrastructure": ["infrastructure", "construction", "engineering"],
        "Energy Broad": ["oil", "gas", "energy", "exploration", "production"],
        "Oil & Gas Exploration": ["exploration", "production", "oil", "gas"],
        "MLPs / Pipelines": ["pipeline", "midstream"],
        "Natural Gas": ["natural gas", "gas utilities"],
        "Clean Energy / Solar": ["solar", "renewable", "clean energy"],
        "Wind Energy": ["wind", "renewable"],
        "Materials Broad": ["materials", "chemical", "mining", "metals", "steel", "paper"],
        "Metals & Mining": ["mining", "metals"],
        "Gold / Metals Miners": ["gold", "silver", "mining", "miner"],
        "Rare Earth / Strategic Metals": ["rare earth", "critical", "lithium", "materials"],
        "Agriculture / Agribusiness": ["agriculture", "farm", "fertilizer", "food"],
        "Timber / Forestry": ["timber", "paper", "forest", "wood"],
        "Real Estate / REITs": ["reit", "real estate"],
        "Residential REITs": ["residential", "reit"],
        "Office / Commercial Real Estate": ["office", "commercial", "reit", "real estate"],
        "Utilities": ["utilities", "utility", "electric", "water"],
    }
    if has_any(text, text_rules.get(category, [])):
        return True
    if category in ticker_rules or category in text_rules:
        return False

    sector_rules = {
        "Technology": "TECHNOLOGY",
        "Communication": "COMMUNICATION SERVICES",
        "Consumer": "CONSUMER CYCLICAL",
        "Financial": "FINANCIAL",
        "Healthcare": "HEALTHCARE",
        "Industrials": "INDUSTRIALS",
        "Energy": "ENERGY",
        "Materials": "BASIC MATERIALS",
        "Real Estate": "REAL ESTATE",
        "Defensive": "UTILITIES",
    }
    if group == "Consumer" and sector in {"CONSUMER CYCLICAL", "CONSUMER DEFENSIVE"}:
        return True
    if group == "Defensive" and sector in {"UTILITIES", "CONSUMER DEFENSIVE"}:
        return True
    if category == "US Large Cap":
        return "idx_sp500" in groups
    if category == "Nasdaq / Growth":
        return "idx_ndx100" in groups
    if category == "Small Cap":
        return item.get("bucket") in {"1to10b", "lt1b"}
    return sector == sector_rules.get(group)


def build_category_stock_leaders(stocks, rep, category, group):
    period_keys = ["monthChangePct", "threeMonthChangePct", "ytdChangePct", "changePct"]
    rows = []
    for item in stocks:
        if not stock_matches_etf_category(item, category, group):
            continue
        relative = {key: round(item.get(key, 0) - rep.get(key, 0), 1) for key in period_keys}
        if not any(value > 0 for value in relative.values()):
            continue
        rows.append({
            "ticker": item["ticker"],
            "name": item["company"],
            "sector": item["sector"],
            "industry": item["industry"],
            "price": item.get("price", 0),
            "rsScore": item.get("rsScore", 0),
            "epsRevScore": item.get("epsRevScore", 0),
            "volumeRatio": item.get("volumeRatio", 0),
            "changePct": item.get("changePct", 0),
            "monthChangePct": item.get("monthChangePct", 0),
            "threeMonthChangePct": item.get("threeMonthChangePct", 0),
            "ytdChangePct": item.get("ytdChangePct", 0),
            "relativeToEtf": relative,
        })
    rows.sort(key=lambda item: (
        item["relativeToEtf"]["monthChangePct"],
        item["rsScore"],
        item["monthChangePct"],
    ), reverse=True)
    return rows[:30]


def build_etf_relative_strength(stocks, lookup, etf_category_map, etf_universe_count):
    period_keys = ["monthChangePct", "threeMonthChangePct", "ytdChangePct", "changePct"]
    benchmarks = {ticker: lookup.get(ticker, {}) for ticker in ETF_RS_BENCHMARKS if ticker in lookup}
    rows = []
    for category in etf_category_map:
        rep = lookup.get(category["representative"])
        if not rep:
            continue
        peers = []
        for ticker in category["peers"]:
            item = lookup.get(ticker)
            if not item:
                continue
            peers.append({
                "ticker": ticker,
                "name": item["company"],
                "monthChangePct": item.get("monthChangePct", 0),
                "threeMonthChangePct": item.get("threeMonthChangePct", 0),
                "ytdChangePct": item.get("ytdChangePct", 0),
                "changePct": item.get("changePct", 0),
            })
        if not peers:
            continue
        relative = {}
        for benchmark, benchmark_item in benchmarks.items():
            relative[benchmark] = {
                key: round(rep.get(key, 0) - benchmark_item.get(key, 0), 1)
                for key in period_keys
            }
        rs_score = clamp(
            50
            + relative.get("SPY", {}).get("monthChangePct", 0) * 2.2
            + relative.get("SPY", {}).get("threeMonthChangePct", 0) * 1.1
            + relative.get("QQQ", {}).get("monthChangePct", 0) * 1.4
        )
        rows.append({
            "group": category["group"],
            "category": category["category"],
            "representative": rep["ticker"],
            "name": rep["company"],
            "price": rep.get("price", 0),
            "changePct": rep.get("changePct", 0),
            "monthChangePct": rep.get("monthChangePct", 0),
            "threeMonthChangePct": rep.get("threeMonthChangePct", 0),
            "ytdChangePct": rep.get("ytdChangePct", 0),
            "rsScore": rs_score,
            "relative": relative,
            "peers": sorted(peers, key=lambda item: item.get("monthChangePct", 0), reverse=True)[:10],
            "stockLeaders": build_category_stock_leaders(stocks, rep, category["category"], category["group"]),
        })
    rows.sort(key=lambda item: item["relative"].get("SPY", {}).get("monthChangePct", 0), reverse=True)
    return {
        "rows": rows,
        "universeCount": etf_universe_count,
        "benchmarks": list(benchmarks.keys()),
        "method": "Nasdaq ETF screener rows are grouped by representative sector/theme exposure. ETF relative strength is representative ETF return minus the selected benchmark return. Clicking a group shows related US stocks whose return is stronger than the representative ETF for at least one period. Leveraged, inverse, covered-call and single-stock products are excluded from representative groups; TQQQ is included only as a benchmark.",
    }


def build_snapshot():
    universe, etf_category_map, etf_universe_count, lev_etf_count, exchange_backfill_count = build_universe()
    stocks = []
    errors = []
    with ThreadPoolExecutor(max_workers=32) as executor:
        futures = [executor.submit(build_one, meta) for meta in universe]
        for future in as_completed(futures):
            stock, error = future.result()
            stocks.append(stock)
            if error:
                errors.append(error)

    stocks.sort(key=lambda item: item["marketCapB"], reverse=True)
    lookup = {item["ticker"]: item for item in stocks}

    def change(ticker, key="monthChangePct"):
        return lookup.get(ticker, {}).get(key, 0)

    group_counts = {}
    for item in stocks:
        for group in item.get("groups", []):
            group_counts[group] = group_counts.get(group, 0) + 1

    return {
        "updatedAtKst": datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST"),
        "policy": "Daily snapshot. Update once at 06:00 KST.",
        "summary": build_summary(stocks),
        "stocks": stocks,
        "health": {
            "major": [
                health("SPY", "S&P 500", change("SPY"), "시장 대표 지수"),
                health("QQQ", "Nasdaq 100", change("QQQ"), "기술주 흐름"),
                health("IWM", "Russell 2000", change("IWM"), "소형주 흐름"),
                health("IBIT", "Bitcoin ETF", change("IBIT"), "위험자산 선호"),
                health("GLD", "Gold", change("GLD"), "방어자산"),
                health("VIXY", "Volatility", change("VIXY"), "변동성"),
            ],
            "etf": [
                health("XLK", "Technology", change("XLK"), "Microsoft / Apple"),
                health("SOXX", "Semiconductors", change("SOXX"), "Nvidia / Broadcom"),
                health("XLE", "Energy", change("XLE"), "Exxon Mobil"),
                health("XLF", "Financials", change("XLF"), "JPMorgan"),
                health("XLV", "Health Care", change("XLV"), "Eli Lilly"),
                health("XLU", "Utilities", change("XLU"), "Defensive"),
            ],
            "ai": [
                health(ticker, lookup[ticker]["company"], lookup[ticker]["monthChangePct"], "AI / Growth")
                for ticker in ["NVDA", "PLTR", "APP", "HOOD", "RKLB", "IONQ"]
                if ticker in lookup
            ],
            "etfRelative": build_etf_relative_strength(stocks, lookup, etf_category_map, etf_universe_count),
        },
        "errors": errors[:80],
        "universeCount": len(universe),
        "leveragedEtfCount": lev_etf_count,
        "exchangeBackfillCount": exchange_backfill_count,
        "groupCounts": group_counts,
        "historyPolicy": {
            "realHistoryMax": MAX_REAL_HISTORY,
            "note": "Core symbols use Yahoo 5Y daily OHLCV history; the rest use Nasdaq snapshot quote with generated mini-chart.",
        },
        "scorePolicy": {
            "rsScore": "Weighted price momentum proxy using roughly 3M, 6M, and 1Y returns.",
            "epsRevScore": "Uses EPS Next Y vs EPS TTM and Forward P/E when fundamentals are available; otherwise falls back to recent price momentum.",
        },
    }


def write_json(payload):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="market_snapshot_", suffix=".json", dir=str(OUT.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        os.replace(temp_name, OUT)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def write_js(payload):
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="market_snapshot_", suffix=".js", dir=str(OUT_JS.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("window.MARKET_SNAPSHOT = ")
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write(";\n")
        os.replace(temp_name, OUT_JS)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def split_snapshot_details(payload):
    details = {}
    light_stocks = []
    for stock in payload.get("stocks", []):
        detail = {}
        for key in ["chartSeries", "fundamentals", "news"]:
            if key in stock:
                detail[key] = stock[key]
        if detail:
            detail.update({
                "ticker": stock["ticker"],
                "company": stock["company"],
                "historySource": stock.get("historySource"),
            })
            details[stock["ticker"]] = detail
        light_stocks.append({
            key: value
            for key, value in stock.items()
            if key not in {"chartSeries", "fundamentals", "news"}
        })
    light_payload = dict(payload)
    light_payload["stocks"] = light_stocks
    light_payload["detailPolicy"] = {
        "mode": "split",
        "directory": "data/details",
        "count": len(details),
        "note": "The main snapshot excludes 5Y OHLCV chartSeries and fundamentals. The browser loads data/details/{TICKER}.json or .js when a ticker detail view is opened.",
    }
    return light_payload, details


def write_details(details):
    DETAILS_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in DETAILS_DIR.glob("*"):
        if old_file.is_file() and old_file.suffix.lower() in {".json", ".js"}:
            old_file.unlink()
    for ticker, detail in details.items():
        safe = re.sub(r"[^A-Z0-9._-]", "_", ticker.upper())
        if safe.split(".")[0] in {"CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"}:
            safe = f"_{safe}"
        json_path = DETAILS_DIR / f"{safe}.json"
        js_path = DETAILS_DIR / f"{safe}.js"
        fd, temp_name = tempfile.mkstemp(prefix=f"{safe}_", suffix=".json", dir=str(DETAILS_DIR))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(detail, handle, ensure_ascii=False, separators=(",", ":"))
            os.replace(temp_name, json_path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
        fd, temp_name = tempfile.mkstemp(prefix=f"{safe}_", suffix=".js", dir=str(DETAILS_DIR))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write("window.STOCK_DETAILS = window.STOCK_DETAILS || {};")
                handle.write(f"window.STOCK_DETAILS[{json.dumps(ticker)}] = ")
                json.dump(detail, handle, ensure_ascii=False, separators=(",", ":"))
                handle.write(";\n")
            os.replace(temp_name, js_path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)


def load_existing_snapshot():
    try:
        with open(OUT, encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


def load_today_content():
    """Read data/today_content.json (written by scripts/build_today_content.py) and
    return today's card-news versions as {"us": {...}, "kr": {...}} (each optional).
    A stale date (not today KST) is ignored so yesterday's deck never lingers."""
    try:
        with open(TODAY_CONTENT_FILE, encoding="utf-8") as handle:
            raw = json.load(handle)
    except FileNotFoundError:
        return None
    except Exception as exc:
        print(f"[content] Failed to read {TODAY_CONTENT_FILE.name}: {exc}")
        return None

    if not isinstance(raw, dict):
        return None
    date = str(raw.get("date") or "").strip()
    if date:
        today = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")
        if date != today:
            print(f"[content] today_content.json date {date} != today {today}; skipping.")
            return None
    card_news = {}
    for variant in ("us", "kr"):
        deck = raw.get(variant)
        if isinstance(deck, dict) and isinstance(deck.get("images"), list) and deck["images"]:
            card_news[variant] = {"title": deck.get("title") or "", "images": deck["images"]}
    return card_news or None


def git_push_updates(updated_at_kst):
    """Commit and push snapshot + detail files so GitHub Pages reflects the new data."""
    git_dir = ROOT / ".git"
    if not git_dir.exists():
        print("[Git] .git not found; skipping push.")
        return

    try:
        remote = subprocess.run(
            ["git", "remote"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        if not remote.stdout.strip():
            print("[Git] No remote configured; skipping push.")
            return

        print("[Git] Staging data/ for commit...")
        subprocess.run(["git", "add", "data/"], cwd=ROOT, check=True)

        status = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        if not status.stdout.strip():
            print("[Git] No changes to commit.")
            return

        commit_msg = f"Auto-update market snapshot: {updated_at_kst} [skip ci]"
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT, check=True)
        subprocess.run(["git", "push"], cwd=ROOT, check=True)
        print("[Git] Pushed market data to remote.")
    except subprocess.CalledProcessError as exc:
        print(f"[Git] Push failed: {exc}")


# Sections produced by a separate generator (not by this script). Carry them over from
# the previous snapshot so running this script does not blank out those parts of the site.
PRESERVED_KEYS = ("sector_charts", "ai_briefing", "social_sentiment")


def main():
    parser = argparse.ArgumentParser(description="Build Mir_US_Stocks market snapshot data.")
    parser.add_argument(
        "--push",
        action="store_true",
        default=False,
        help="Commit and push data/ to the git remote after updating.",
    )
    parser.add_argument(
        "--no-push",
        action="store_true",
        help="Skip git push even when --push is set (for wrapper scripts).",
    )
    args = parser.parse_args()

    snapshot = build_snapshot()
    light_snapshot, details = split_snapshot_details(snapshot)
    existing = load_existing_snapshot()
    preserved = []
    for key in PRESERVED_KEYS:
        if key not in light_snapshot and key in existing:
            light_snapshot[key] = existing[key]
            preserved.append(key)

    # Homepage "오늘의 카드뉴스" gallery: inject today's manifest if present, otherwise
    # carry over the previous snapshot's value so a market rebuild never blanks it.
    card_news = load_today_content()
    if card_news is not None:
        light_snapshot["cardNews"] = card_news
        print(f"[content] Injected cardNews versions: {', '.join(card_news.keys())}")
    elif "cardNews" in existing:
        light_snapshot["cardNews"] = existing["cardNews"]

    write_details(details)
    write_json(light_snapshot)
    write_js(light_snapshot)
    if preserved:
        print(f"Preserved external sections from previous snapshot: {', '.join(preserved)}")
    groups = snapshot.get("groupCounts", {})
    updated_at = light_snapshot.get("updatedAtKst", "")
    print(f"Updated {OUT} with {len(snapshot['stocks'])} symbols")
    print(f"Updated {OUT_JS}")
    print(f"Updated {DETAILS_DIR} with {len(details)} detail files")
    print(f"S&P 500: {groups.get('idx_sp500', 0)} / Nasdaq 100: {groups.get('idx_ndx100', 0)} / Nasdaq listed: {groups.get('idx_nasdaq', 0)}")
    if snapshot.get("leveragedEtfCount"):
        print(f"Leveraged/option ETF catalog: {snapshot['leveragedEtfCount']} symbols in universe")
    if snapshot.get("exchangeBackfillCount"):
        print(f"Exchange directory backfill: {snapshot['exchangeBackfillCount']} additional symbols")

    if args.push and not args.no_push:
        git_push_updates(updated_at)


if __name__ == "__main__":
    main()
