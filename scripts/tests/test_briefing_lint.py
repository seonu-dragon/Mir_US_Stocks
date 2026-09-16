"""국내 AI 브리핑 발행 전 관문(briefing_lint) — 2026-09-16 재감사 반영분.

숫자는 맞게 들어가는데 본문이 데이터에 없는 원인을 사실처럼 단정하고('차익 실현과
보수적인 시각이 복합적으로 작용'), 업종 데이터 없이 테마를 지어내고('성장성 있는
중소형주를 중심으로 유입'), 말더듬 오타('영향을 미 미쳤습니다')까지 그대로 발행됐다.

여기서 검증하는 것:
1. 말더듬·중복 토큰 자동 교정 — 정상 문장('이 이익', '사람이 이 종목')은 건드리지 않는다.
2. 재감사에 나온 실제 문장이 위반으로 잡힌다.
3. 헤지·헤드라인 근거·수치 인용이 있는 **정상 브리핑은 통과**한다(매일 막히면 안 된다).
4. 관문 흐름: 재생성 1회 → 문장 제거 → 제거로도 안 되면 발행 중단.
5. 국내 브리핑 두 곳이 관문을 부르고, API 키를 URL 이 아니라 헤더로 보낸다.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

COMMON = Path(__file__).resolve().parents[1] / "briefings" / "common"
if str(COMMON) not in sys.path:
    sys.path.insert(0, str(COMMON))

import briefing_lint as bl  # noqa: E402

HEADLINES = [
    "코스피, 외국인 매도에 0.8% 하락…2,600선 후퇴",
    "금감원, 코스닥 불공정거래 집중 점검 착수",
    "삼성전자 HBM 공급 확대 기대감에 반도체주 강세",
    "원·달러 환율 1,346원 마감",
]

# 재감사 기준선: 이 정도로 쓰인 브리핑은 손대지 않고 통과해야 한다.
GOOD_BRIEFING = """📈 <b>오늘의 코스피 & 코스닥 시황 요약</b>
├─ <b>코스피:</b> 코스피는 2,601.35로 전일 대비 20.97포인트(-0.80%) 하락 마감했습니다. 외국인이 3,120억원을 순매도하며 지수 하락을 주도했습니다.
└─ <b>코스닥:</b> 코스닥은 752.10(+0.35%)으로 코스피와 달리 소폭 상승했습니다. 두 시장의 방향이 엇갈렸습니다.

👥 <b>투자 주체별 수급 동향 해설</b>
├─ <b>수급 상황:</b> 코스피에서는 개인이 2,850억원을 순매수했지만 외국인(-3,120억원)과 기관(-410억원)이 동반 순매도했습니다.
└─ <b>매매 특징:</b> 코스닥에서는 외국인이 520억원 순매수로 돌아서 지수 상승에 힘을 보탰을 가능성이 있습니다. 업종별 수급 데이터는 제공되지 않아 업종 분석은 생략합니다.

📰 <b>오늘의 핵심 뉴스 점검</b>
├─ <b>주요 이슈:</b> 금융감독원이 코스닥 불공정거래 집중 점검에 착수했다는 보도가 나왔습니다. 삼성전자의 HBM 공급 확대 기대감에 반도체주가 강세를 보였다는 헤드라인도 있습니다.
└─ <b>시장 연관성:</b> 불공정거래 점검 소식은 코스닥 개별 종목 변동성을 키울 수 있습니다. HBM 공급 확대 기대가 반도체주 강세를 견인했다는 보도가 있으나 지수 전체로 확산되지는 않았습니다.

🎯 <b>내일의 증시 전략 및 대응 가이드</b>
├─ <b>전략 포인트:</b> 외국인 순매도가 이어지는지 확인하며 분할 매수로 대응하는 전략을 고려할 만합니다. 단기 급등 종목은 차익 실현을 고려하는 것도 방법입니다.
└─ <b>유의 사항:</b> 원/달러 환율이 1,346.4원으로 높은 수준이라 외국인 수급 변화에 유의해야 합니다. 환율 흐름에 따라 외국인 매매 방향이 달라질 수 있습니다."""

# 재감사에 실제로 발행된 유형의 문장.
BAD_BRIEFING = """📈 <b>오늘의 코스피 & 코스닥 시황 요약</b>
├─ <b>코스피:</b> 코스피는 2,601.35(-0.80%)로 하락 마감했습니다. 차익 실현과 보수적인 시각이 복합적으로 작용했습니다.
└─ <b>코스닥:</b> 코스닥은 752.10(+0.35%)으로 상승했습니다. 성장성 있는 중소형주를 중심으로 매수세가 유입되었습니다.

📰 <b>오늘의 핵심 뉴스 점검</b>
├─ <b>주요 이슈:</b> 금융감독원이 코스닥 불공정거래 집중 점검에 착수했다는 보도가 나왔습니다. 불공정 거래 이슈가 투자 심리에 부정적 영향을 미 미쳤습니다.
└─ <b>시장 연관성:</b> 불공정거래 점검 소식은 개별 종목 변동성을 키울 수 있습니다.

🎯 <b>내일의 증시 전략 및 대응 가이드</b>
├─ <b>전략 포인트:</b> 외국인 순매도가 이어지는지 확인하며 대응하는 전략을 고려할 만합니다.
└─ <b>유의 사항:</b> 원/달러 환율이 1,346.4원으로 높은 수준이라 외국인 수급 변화에 유의해야 합니다."""


def _kinds(report):
    return [v.kind for v in report.violations]


# --------------------------------------------------------------------------
# 1. 자동 교정
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "src, expected",
    [
        ("투자 심리에 부정적 영향을 미 미쳤습니다.", "투자 심리에 부정적 영향을 미쳤습니다."),
        ("시장의 의 흐름이 바뀌었습니다.", "시장의 흐름이 바뀌었습니다."),
        ("외국인 의 의 매도", "외국인 의 매도"),
        ("the the market", "the market"),
        ("The the market", "The market"),
        ("상승 상승 마감했습니다.", "상승 마감했습니다."),
    ],
)
def test_autofix_stutters(src, expected):
    fixed, fixes = bl.autofix_stutters(src)
    assert fixed == expected
    assert fixes


@pytest.mark.parametrize(
    "src",
    [
        "이 이익은 일회성입니다.",
        "그 그룹의 실적이 개선됐습니다.",
        "각 각국 중앙은행이 금리를 동결했습니다.",
        "약 약세로 마감했습니다.",
        "외국인이 이 종목을 샀습니다.",
        "코스피는 2,601.35로 마감했습니다.",
        "10 10 거래일 연속",
        "은행은 은행대로 움직였습니다.",
        "반도체 등 등락률 상위 업종",
        "장 중 중국 지표가 나왔습니다.",
        "순매도할 수 수출주에 대해",
        "매수 후 후퇴했습니다.",
    ],
)
def test_autofix_leaves_normal_sentences(src):
    fixed, fixes = bl.autofix_stutters(src)
    assert fixed == src
    assert fixes == []


# --------------------------------------------------------------------------
# 2. 재감사 문장이 잡힌다
# --------------------------------------------------------------------------

def test_audit_example_complex_cause_is_banned():
    r = bl.lint_briefing("├─ <b>코스피:</b> 차익 실현과 보수적인 시각이 복합적으로 작용했습니다.", HEADLINES)
    assert _kinds(r) == ["banned"]


def test_banned_even_when_hedged():
    r = bl.lint_briefing("여러 요인이 복합적으로 작용했을 가능성이 있습니다.", HEADLINES)
    assert _kinds(r) == ["banned"]


def test_audit_example_small_cap_inflow_is_flagged():
    r = bl.lint_briefing("코스닥은 성장성 있는 중소형주를 중심으로 유입되며 상승했습니다.", HEADLINES)
    assert _kinds(r) == ["unhedged_cliche"]


def test_audit_example_sentiment_with_typo_is_fixed_and_flagged():
    r = bl.lint_briefing("불공정 거래 이슈가 투자 심리에 부정적 영향을 미 미쳤습니다.", HEADLINES)
    assert "미 미쳤" not in r.text and "미쳤습니다" in r.text
    # 헤드라인에 '불공정거래' 가 있어도 '투자 심리에 영향' 은 헤드라인에 없는 단정이다.
    assert _kinds(r) == ["unhedged_cliche"]


def test_profit_taking_asserted_is_flagged_but_hedged_passes():
    assert _kinds(bl.lint_briefing("외국인의 차익 실현 매물이 쏟아졌습니다.", HEADLINES)) == ["unhedged_cliche"]
    assert bl.lint_briefing("외국인의 차익 실현 매물이 나왔을 가능성이 있습니다.", HEADLINES).ok
    assert bl.lint_briefing("단기 급등주는 차익 실현을 고려할 만합니다.", HEADLINES).ok


def test_cliche_backed_by_same_headline_phrase_passes():
    heads = HEADLINES + ["차익실현 매물에 코스닥 1%대 하락"]
    assert bl.lint_briefing("차익 실현 매물이 나오며 코스닥이 하락했습니다.", heads).ok


def test_unsupported_causal_sentence_is_flagged():
    r = bl.lint_briefing("2차전지 업황 회복 기대 때문에 대형주가 올랐습니다.", HEADLINES)
    assert _kinds(r) == ["unsupported_causal"]


def test_causal_sentence_backed_by_headline_keyword_passes():
    assert bl.lint_briefing("HBM 공급 확대 기대가 반도체주 강세를 견인했습니다.", HEADLINES).ok


def test_causal_sentence_backed_by_quoted_flow_number_passes():
    assert bl.lint_briefing("외국인이 3,120억원 순매도하며 하락을 주도했습니다.", HEADLINES).ok
    # 수치 없이 '매도세' 만 대면 근거가 아니다.
    r = bl.lint_briefing("글로벌 긴축 우려로 인해 매도세가 나타났습니다.", HEADLINES)
    assert _kinds(r) == ["unsupported_causal"]


def test_generic_headline_words_are_not_evidence():
    # '코스피'·'하락'·'외국인' 은 모든 헤드라인에 있는 범용어라 근거가 되지 않는다.
    r = bl.lint_briefing("코스피는 미중 갈등 영향으로 하락했습니다.", HEADLINES)
    assert _kinds(r) == ["unsupported_causal"]


def test_past_tense_advice_word_does_not_hedge():
    r = bl.lint_briefing("외국인의 차익 실현이 하락을 주도해 주의가 필요했습니다.", HEADLINES)
    assert _kinds(r) == ["unhedged_cliche"]


def test_headings_are_not_sentences():
    r = bl.lint_briefing("📰 <b>오늘의 핵심 뉴스 & 주도 테마 분석</b>", HEADLINES)
    assert r.ok and r.sentence_count == 0


# --------------------------------------------------------------------------
# 3. 정상 브리핑은 통과
# --------------------------------------------------------------------------

def test_good_briefing_passes_untouched():
    r = bl.lint_briefing(GOOD_BRIEFING, HEADLINES)
    assert r.ok, [v.describe() for v in r.violations]
    assert r.fixes == []
    assert r.text == GOOD_BRIEFING
    assert bl.gate_briefing(GOOD_BRIEFING, HEADLINES, regenerate=_no_regen) == GOOD_BRIEFING


def test_good_briefing_without_headlines_flags_only_headline_backed_cause():
    # 뉴스 수집이 실패한 날도 수치 인용·헤지 문장만으로 통과해야 한다
    # ('HBM ... 견인' 문장만 헤드라인 근거가 사라져 잡힌다).
    r = bl.lint_briefing(GOOD_BRIEFING, [])
    assert [v.detail for v in r.violations] == ["인과 표지 '견인'"]


def test_bad_briefing_violations():
    r = bl.lint_briefing(BAD_BRIEFING, HEADLINES)
    assert _kinds(r) == ["banned", "unhedged_cliche", "unhedged_cliche"]
    assert "미 미쳤" not in r.text


# --------------------------------------------------------------------------
# 4. 관문 흐름
# --------------------------------------------------------------------------

def _no_regen(_feedback):  # pragma: no cover - 호출되면 실패
    raise AssertionError("위반이 없는데 재생성을 불렀다")


def test_gate_regenerates_once_with_feedback_and_accepts_clean_retry():
    calls = []

    def regen(feedback):
        calls.append(feedback)
        return GOOD_BRIEFING

    out = bl.gate_briefing(BAD_BRIEFING, HEADLINES, regenerate=regen, label="t")
    assert out == GOOD_BRIEFING
    assert len(calls) == 1
    assert "복합적으로 작용" in calls[0] and "가능성" in calls[0]


def test_gate_strips_offending_sentences_when_retry_still_bad():
    calls = []

    def regen(feedback):
        calls.append(feedback)
        return BAD_BRIEFING

    out = bl.gate_briefing(BAD_BRIEFING, HEADLINES, regenerate=regen, label="t")
    assert len(calls) == 1
    assert "복합적으로" not in out
    assert "중소형주" not in out
    assert "투자 심리" not in out
    assert "미 미쳤" not in out
    # 사실 문장·구조는 남는다.
    assert "코스피는 2,601.35(-0.80%)로 하락 마감했습니다." in out
    assert "📰 <b>오늘의 핵심 뉴스 점검</b>" in out
    assert "├─ <b>코스피:</b>" in out and "└─ <b>코스닥:</b>" in out
    assert bl.lint_briefing(out, HEADLINES).ok


def test_gate_uses_placeholder_when_label_line_empties():
    text = "├─ <b>매매 특징:</b> 성장성 있는 중소형주를 중심으로 유입되었습니다.\n" + "\n".join(
        f"└─ <b>수급{i}:</b> 외국인이 {i},000억원 순매수했습니다." for i in range(1, 5)
    )
    out = bl.gate_briefing(text, HEADLINES, regenerate=lambda fb: "", label="t")
    assert out.splitlines()[0] == "├─ <b>매매 특징:</b> " + bl.PLACEHOLDER


def test_gate_regeneration_error_falls_back_to_strip():
    def boom(_fb):
        raise RuntimeError("gemini down")

    out = bl.gate_briefing(BAD_BRIEFING, HEADLINES, regenerate=boom, label="t")
    assert bl.lint_briefing(out, HEADLINES).ok


def test_gate_fails_closed_when_too_much_would_be_stripped():
    wall = "\n".join(
        [
            "├─ <b>코스피:</b> 차익 실현과 보수적인 시각이 복합적으로 작용했습니다.",
            "└─ <b>코스닥:</b> 성장성 있는 중소형주를 중심으로 유입되었습니다.",
            "├─ <b>주요 이슈:</b> 불공정 거래 이슈가 투자 심리에 부정적 영향을 미쳤습니다.",
            "└─ <b>주도 테마:</b> 2차전지 업황 회복 기대 때문에 대형주가 올랐습니다.",
            "└─ <b>유의 사항:</b> 원/달러 환율 1,346.4원에 유의해야 합니다.",
        ]
    )
    with pytest.raises(bl.BriefingLintError):
        bl.gate_briefing(wall, HEADLINES, regenerate=lambda fb: wall, label="t")


def test_gate_fails_closed_when_strip_breaks_html_tags():
    text = "\n".join(
        [
            "├─ <b>코스피:</b> <b>차익 실현이 쏟아졌습니다.</b> 코스피는 0.8% 하락했습니다.",
            "├─ <b>수급1:</b> 외국인이 1,000억원 순매수했습니다.",
            "├─ <b>수급2:</b> 기관이 2,000억원 순매수했습니다.",
            "├─ <b>수급3:</b> 개인이 3,000억원 순매도했습니다.",
        ]
    )
    # '<b>차익 실현이' 와 '쏟아졌습니다.</b>' 는 한 문장이라 통째로 빠져 균형은 유지된다 —
    # 문장 경계가 태그 안쪽에서 갈리는 경우를 만든다.
    text = text.replace("<b>차익 실현이 쏟아졌습니다.</b> 코스피는", "<b>차익 실현이 쏟아졌습니다. 코스피는</b>")
    with pytest.raises(bl.BriefingLintError):
        bl.gate_briefing(text, HEADLINES, regenerate=lambda fb: text, label="t")


# --------------------------------------------------------------------------
# 5. 배선 — 국내 브리핑 두 곳
# --------------------------------------------------------------------------

BRIEFINGS = Path(__file__).resolve().parents[1] / "briefings"


@pytest.mark.parametrize("pkg", ["korea_close", "korea_premarket"])
def test_korea_briefings_wire_gate_and_header_key(pkg):
    src = (BRIEFINGS / pkg / "main.py").read_text(encoding="utf-8")
    assert "gate_briefing(" in src
    assert "CAUSAL_CLAIM_RULE" in src
    assert "?key=" not in src
    assert '"x-goog-api-key": GEMINI_API_KEY' in src
    # 데이터 없이 테마·지식을 요구하던 절이 사라졌다.
    assert "주도 테마" not in src
    assert "주도 업종:" not in src
    assert "너의 지식" not in src
    assert "추정되는 업종/테마" not in src


PREMARKET_HEADLINES = ["뉴욕증시, 엔비디아 호실적에 나스닥 1% 상승", "한은 기준금리 동결…연내 인하 신중", "코스피, 외국인 매도에 0.8% 하락"]

GOOD_PREMARKET = """🌙 <b>간밤 글로벌 시장 & 매크로 점검</b>
├─ <b>미국 증시:</b> 간밤 나스닥 100 (QQQ ETF)는 +0.96%, S&P 500 (SPY ETF)는 +0.42% 상승했습니다. 엔비디아 호실적 보도가 나스닥 상승을 견인한 것으로 보이며, 국내 반도체주에 우호적으로 작용할 수 있습니다.
└─ <b>환율·금리:</b> 원/달러 환율은 1,346.4원, 국고채 3년물은 2.85%입니다. 한국은행이 기준금리를 2.50%로 동결하면서 금리 부담은 크지 않은 상황입니다.

📊 <b>전 거래일 국내 증시 복기</b>
├─ <b>지수·수급:</b> 전일 코스피는 -0.80% 하락했고 외국인이 3,120억원을 순매도했습니다. 기관도 410억원 순매도해 수급 부담이 이어졌습니다.
└─ <b>뉴스 점검:</b> 한은의 기준금리 동결 소식이 나왔습니다. 연내 인하에 신중하다는 입장은 성장주 투자 심리에 부담이 될 가능성이 있습니다.

🎯 <b>오늘의 개장 전 전략 가이드</b>
├─ <b>예상 시나리오:</b> 간밤 나스닥 상승(+0.96%)을 감안하면 반도체 중심으로 반등을 시도할 수 있습니다. 다만 외국인 순매도가 이어지면 상승 폭은 제한될 수 있습니다.
└─ <b>관심 포인트:</b> 개장 초 외국인 수급 방향과 환율 움직임을 확인할 필요가 있습니다.

⚠️ <b>오늘 장중 유의 사항</b>
└─ <b>리스크 점검:</b> 환율이 1,350원에 근접하면 외국인 매도 압력이 커질 수 있습니다. 관련 실측 데이터가 없어 경제지표 일정 언급은 생략합니다."""


def test_good_premarket_briefing_passes():
    r = bl.lint_briefing(GOOD_PREMARKET, PREMARKET_HEADLINES)
    assert r.ok, [v.describe() for v in r.violations]
    assert r.text == GOOD_PREMARKET
