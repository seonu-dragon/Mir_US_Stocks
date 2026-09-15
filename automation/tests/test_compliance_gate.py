"""발행 직전 준법 게이트 (2026-09-15 감사).

예전 상태: 준법 검사기가 존재하지만 **발행 경로에서 한 번도 호출되지 않았고**,
호출돼도 Gemini 응답이 없으면 `pass=True` 로 통과시켰다(fail-open). 프롬프트는
면책 문구를 금지하고 있었다. 아래 테스트가 그 셋을 모두 고정한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

AUTOMATION_DIR = Path(__file__).resolve().parents[1]
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

from compliance_check import (  # noqa: E402
    assert_publishable,
    check_compliance,
    ensure_disclaimer,
    hard_rule_violations,
)

CLEAN = {
    "market": "KR", "ticker": "005930", "title": "요즘 반도체 어떻게들 보세요",
    "body": "최근 흐름 정리해봤습니다.\n\n투자 권유가 아닙니다.",
}


def test_clean_post_passes():
    assert hard_rule_violations(CLEAN) == []
    assert_publishable(CLEAN)


@pytest.mark.parametrize("body", [
    "지금 매수 추천합니다. 투자 권유가 아닙니다.",
    "목표가 12만원 봅니다. 투자 권유가 아닙니다.",
    "이건 수익 보장입니다. 투자 권유가 아닙니다.",
    "무조건 상승합니다. 투자 권유가 아닙니다.",
    "내부 정보로는 좋다네요. 투자 권유가 아닙니다.",
    "리딩방에서 들었습니다. 투자 권유가 아닙니다.",
])
def test_banned_claims_block_publishing(body):
    post = {**CLEAN, "body": body}
    assert hard_rule_violations(post)
    with pytest.raises(ValueError):
        assert_publishable(post)


def test_missing_disclaimer_is_a_violation():
    post = {**CLEAN, "body": "최근 흐름 정리해봤습니다."}
    issues = hard_rule_violations(post)
    assert any("면책" in i for i in issues)


def test_ensure_disclaimer_appends_one_line():
    post = {**CLEAN, "body": "최근 흐름 정리해봤습니다."}
    fixed = ensure_disclaimer(post)
    assert hard_rule_violations(fixed) == []
    assert post["body"] == "최근 흐름 정리해봤습니다."   # 원본은 안 건드린다
    # 이미 있으면 중복해서 붙이지 않는다.
    assert ensure_disclaimer(fixed) is fixed


def test_check_compliance_is_fail_closed_when_llm_unavailable(monkeypatch):
    """Gemini 가 죽어도 '통과' 로 넘어가면 안 된다."""
    class Boom:
        def generate_json(self, prompt):
            raise RuntimeError("no api key")

    result = check_compliance(CLEAN, client=Boom())
    assert result["pass"] is False
    assert any("준법 검사 실행 실패" in i for i in result["issues"])


def test_check_compliance_respects_hard_rules_over_llm_pass():
    class Yes:
        def generate_json(self, prompt):
            return {"pass": True, "risk_level": "low", "issues": []}

    bad = {**CLEAN, "body": "목표가 12만원. 투자 권유가 아닙니다."}
    result = check_compliance(bad, client=Yes())
    assert result["pass"] is False
    assert result["hard_rule_issues"]


def test_prompt_no_longer_forbids_disclaimers():
    text = (AUTOMATION_DIR.parent / "prompts" / "kiwoom_post_generation_prompt.md").read_text(
        encoding="utf-8"
    )
    forbidden = text.split("절대 넣지 말 것:")[1].split("넣어도 되는 것:")[0]
    assert "서포터즈" not in forbidden
    assert "면책" not in forbidden
    # 면책은 이제 '권장' 쪽에 있어야 한다.
    allowed = text.split("넣어도 되는 것:")[1].split("지킬 내용")[0]
    assert "면책" in allowed
