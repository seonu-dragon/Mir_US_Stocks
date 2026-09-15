"""국내 브리핑용 매크로 컨텍스트 — 미 증시 지수와 환율·금리를 raw_data 에 넣는다.

2026-09-15 감사: 국내 개장 전/마감 프롬프트는 '간밤 미국 증시', '환율·금리' 절을
요구하는데 raw_data 에는 그 숫자가 하나도 없었다. 모델은 빈칸을 자기 사전지식으로
메웠고(나스닥 '약보합' — 실제 +0.96%, 환율 '1350원대' — 실제 1,346.4) 그 창작이
그대로 사이트에 발행됐다. 같은 파이프라인이 이미 만들어 두는 두 파일에서 실측을
읽어 프롬프트에 넣는다:

  data/market_snapshot.json   → S&P500/나스닥100/다우 대리 ETF 의 당일 등락률
  data/korea/ecos_macro.json  → 원/달러, 국고채 3·10년, 기준금리, CPI

없는 값은 지어내지 않고 그 줄을 빼거나 '데이터 없음' 으로 적는다.
"""

from __future__ import annotations

import json
from pathlib import Path

from repo import repo_root

# (스냅샷 티커, 사람이 읽는 이름). 지수 자체가 아니라 **대리 ETF** 라는 걸 프롬프트에
# 명시한다 — 모델이 "S&P500 지수 764.29pt" 같은 문장을 쓰지 않게.
US_INDEX_PROXIES = (
    ("SPY", "S&P 500 (SPY ETF)"),
    ("QQQ", "나스닥 100 (QQQ ETF)"),
    ("DIA", "다우 산업 (DIA ETF)"),
)

ECOS_KEYS = ("usdKrw", "baseRate", "ktb3", "ktb10", "cpiYoY")


def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  [경고] {path.name} 읽기 실패: {exc}")
        return None


def us_index_lines() -> list[str]:
    """미 증시 당일 등락률 줄. 스냅샷이 없거나 값이 없으면 빈 리스트."""
    snap = _load_json(repo_root() / "data" / "market_snapshot.json")
    if not snap:
        return []
    lines = []
    # 일부 빌드는 최상위 indices 를 낸다 — 있으면 그쪽을 먼저 쓴다.
    for row in snap.get("indices") or []:
        name = row.get("name") or row.get("symbol")
        pct = row.get("changePct")
        if name and isinstance(pct, (int, float)):
            lines.append(f"{name}: {pct:+.2f}%")
    if not lines:
        by_ticker = {}
        for stock in snap.get("stocks") or []:
            ticker = str(stock.get("ticker") or "").upper()
            if ticker:
                by_ticker[ticker] = stock
        for ticker, label in US_INDEX_PROXIES:
            row = by_ticker.get(ticker)
            pct = (row or {}).get("changePct")
            if isinstance(pct, (int, float)):
                lines.append(f"{label}: {pct:+.2f}%")
    if lines and snap.get("updatedAtKst"):
        lines.append(f"(스냅샷 기준 {snap['updatedAtKst']})")
    return lines


def macro_lines() -> list[str]:
    """ECOS 환율·금리 줄. 파일이 없거나 지표가 비면 빈 리스트."""
    macro = _load_json(repo_root() / "data" / "korea" / "ecos_macro.json")
    if not macro:
        return []
    by_key = {i.get("key"): i for i in macro.get("indicators") or []}
    lines = []
    for key in ECOS_KEYS:
        item = by_key.get(key)
        if not item:
            continue
        value = item.get("value")
        if not isinstance(value, (int, float)):
            continue
        unit = item.get("unit") or ""
        label = item.get("label") or key
        change = item.get("change")
        tail = ""
        if isinstance(change, (int, float)) and change:
            tail = f" ({item.get('changeLabel') or '직전 대비'} {change:+g})"
        lines.append(f"{label}: {value:,g}{unit}{tail} [기준 {item.get('asOf') or '?'}]")
    return lines


def macro_context_text() -> str:
    """raw_data_text 에 붙일 '간밤 미국 증시 + 환율·금리' 블록."""
    blocks = []
    us = us_index_lines()
    blocks.append("\n=== 간밤 미국 증시 (실측, 대리 ETF 당일 등락률) ===")
    blocks.extend(us or ["데이터 없음 — 미국 증시 수치를 쓰지 말 것"])
    macro = macro_lines()
    blocks.append("\n=== 환율·금리 (한국은행 ECOS 실측) ===")
    blocks.extend(macro or ["데이터 없음 — 환율·금리 수치를 쓰지 말 것"])
    return "\n".join(blocks)


# 프롬프트에 그대로 붙이는 창작 금지 규칙. 두 브리핑이 같은 문구를 쓴다.
NO_FABRICATION_RULE = """
[수치 사용 규칙 (위반 시 브리핑 폐기)]
- 위 [원천 데이터] 에 **적혀 있는 숫자만** 쓴다. 지수·등락률·환율·금리·수급 금액을
  기억이나 추정으로 쓰지 마라. 데이터에 없는 종목명·테마의 등락률도 쓰지 마라.
- 어떤 절의 데이터가 '데이터 없음' 이면 그 절에는 "관련 실측 데이터가 없어 언급을
  생략합니다" 라고 한 줄로 적어라. 대략적인 표현('약보합', '1350원대', '3조 순매도')
  으로 메우는 것도 금지다.
- 데이터에 있는 숫자는 반올림하지 말고 적힌 그대로 인용해라.
"""
