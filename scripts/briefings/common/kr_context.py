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


# 원인·테마 단정 금지 규칙(2026-09-16 재감사). 숫자는 맞는데 본문이 '차익 실현과 보수적인
# 시각이 복합적으로 작용', '성장성 있는 중소형주를 중심으로 유입' 처럼 데이터에 없는 원인을
# 사실로 적었다. 업종·테마 데이터는 공급하지 않으므로 주도 테마 분석도 요구하지 않는다.
# 발행 전 briefing_lint.gate_briefing 이 같은 기준으로 다시 검사한다.
CAUSAL_CLAIM_RULE = """
[원인·테마 서술 규칙 (위반 문장은 발행 전 자동 삭제되거나 브리핑이 폐기된다)]
- 상승·하락·수급의 **원인**은 두 경우에만 단정해라:
  (1) 위 뉴스 헤드라인에 그 원인이 적혀 있을 때 — 문장에 그 헤드라인의 핵심 단어를 그대로 넣어라
      (예: "'삼성전자 HBM 공급 확대' 보도가 나온 가운데 반도체주가 강세를 보였다는 헤드라인이 있습니다").
  (2) 위 수급·환율·금리 수치로 설명될 때 — 그 숫자를 문장에 인용해라
      (예: "외국인이 3,120억원 순매도하며 지수 하락을 주도했습니다").
- 둘 다 아니면 "~했을 가능성이 있습니다", "~로 보입니다" 처럼 추정임을 밝히거나 그 문장을 빼라.
- 업종·섹터·테마별 등락률과 거래량 데이터는 제공되지 않는다. '주도 테마', '중소형 성장주로
  자금 유입', '순환매' 같은 업종·테마 흐름을 지어내지 마라.
- 다음 상투구는 근거 없이 쓰지 마라: '복합적으로 작용', '차익 실현 매물', '투자 심리에 부정적
  영향', '투자 심리 위축', '경계 심리', '관망 심리', '저가 매수세 유입'.
- 같은 음절·단어를 연달아 두 번 쓰지 마라(예: '미 미쳤습니다', '의 의'). 출력 전에 다시 읽어라.
"""
