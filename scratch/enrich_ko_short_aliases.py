#!/usr/bin/env python3
"""상위 인기 종목/ETF 한국어 통용 별칭(짧은 이름) 보강."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES_PATH = ROOT / "data" / "ticker_aliases_ko.js"

SHORT_ALIASES = {
    "AAPL": ["애플", "에플"],
    "MSFT": ["마소", "마이크로소프트"],
    "GOOGL": ["구글", "알파벳"],
    "GOOG": ["구글C"],
    "AMZN": ["아마존"],
    "META": ["메타", "페이스북", "페북"],
    "TSLA": ["테슬라"],
    "NVDA": ["엔비디아", "엔비"],
    "AMD": ["에이엠디", "AMD"],
    "MU": ["마이크론"],
    "AVGO": ["브로드컴"],
    "QCOM": ["퀄컴"],
    "INTC": ["인텔"],
    "JPM": ["제이피모간", "JP모건"],
    "BAC": ["뱅크오브아메리카", "BOA"],
    "WMT": ["월마트"],
    "COST": ["코스트코"],
    "DIS": ["디즈니"],
    "NFLX": ["넷플릭스"],
    "KO": ["코카콜라", "코크"],
    "PEP": ["펩시"],
    "MCD": ["맥도날드"],
    "SBUX": ["스타벅스"],
    "NKE": ["나이키"],
    "BA": ["보잉"],
    "XOM": ["엑슨모빌", "엑슨"],
    "CVX": ["셰브론"],
    "LLY": ["일라이릴리", "릴리"],
    "UNH": ["유나이티드헬스"],
    "JNJ": ["존슨앤드존슨", "J&J"],
    "PG": ["P&G", "프록터앤갬블"],
    "HD": ["홈디포"],
    "LOW": ["로우스"],
    "GS": ["골드만삭스", "골드만"],
    "MS": ["모건스탠리"],
    "V": ["비자"],
    "MA": ["마스터카드"],
    "PYPL": ["페이팔"],
    "CRM": ["세일즈포스"],
    "ORCL": ["오라클"],
    "ADBE": ["어도비"],
    "PLTR": ["팔란티어"],
    "IONQ": ["아이온큐", "아이온"],
    "SMCI": ["슈퍼마이크로"],
    "ARM": ["암홀딩스"],
    "TSM": ["대만반도체", "TSMC"],
    "ASML": ["에이에스엠엘", "ASML"],
    "BRK.B": ["버크셔", "버크셔해서웨이", "버핏"],
    "SPY": ["에스피와이", "S&P500ETF"],
    "QQQ": ["큐큐큐", "나스닥ETF"],
    "VOO": ["브우", "VOO"],
    "IVV": ["아이브이브이"],
    "SOXX": ["반도체ETF", "소xx"],
    "SMH": ["반도체ETF"],
    "XLK": ["기술ETF"],
    "XLF": ["금융ETF"],
    "XLE": ["에너지ETF"],
    "GLD": ["금ETF"],
    "IBIT": ["비트코인ETF"],
    "ARKK": ["아크ETF", "캐시우드ETF"],
    "HOOD": ["로빈후드"],
    "COIN": ["코인베이스"],
    "MELI": ["메르카도리브레", "멜리"],
    "SHOP": ["쇼피파이"],
    "UBER": ["우버"],
    "ABNB": ["에어비앤비"],
    "SPOT": ["스포티파이"],
}


def js_key(ticker: str) -> str:
    return f'"{ticker}"' if "." in ticker else ticker


def parse_entries(text: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for m in re.finditer(r'^\s*"?([A-Z][A-Z0-9.]*)?"?\s*:\s*\[(.*?)\]\s*,?\s*$', text, re.M):
        ticker = m.group(1)
        inner = m.group(2)
        aliases = [a.strip().strip('"').strip("'") for a in inner.split(",") if a.strip()]
        out[ticker] = aliases
    return out


def main() -> None:
    text = ALIASES_PATH.read_text(encoding="utf-8")
    entries = parse_entries(text)
    changed = 0
    for ticker, additions in SHORT_ALIASES.items():
        have = {a.casefold() for a in entries.get(ticker, [])}
        to_add = [a for a in additions if a.casefold() not in have]
        if not to_add:
            continue
        if ticker in entries:
            merged = entries[ticker] + to_add
            key = js_key(ticker)
            pattern = rf'(^\s*{re.escape(key)}\s*:\s*)\[.*?\](\s*,?\s*$)'
            repl = r"\1[" + ", ".join(f'"{a}"' for a in merged) + r"]\2"
            text, n = re.subn(pattern, repl, text, count=1, flags=re.M)
            if n != 1:
                raise SystemExit(f"failed update {ticker}")
        else:
            key = js_key(ticker)
            block = f"  {key}: [{', '.join(repr(a) for a in to_add)}],"
            insert_at = text.rfind("};")
            text = text[:insert_at] + "\n" + block + "\n" + text[insert_at:]
        changed += 1
    ALIASES_PATH.write_text(text, encoding="utf-8")
    print(f"updated {changed} tickers")


if __name__ == "__main__":
    main()