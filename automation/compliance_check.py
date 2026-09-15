"""키움 커뮤니티 글의 준법 검사.

두 층이다:

1. `hard_rule_violations` — LLM 없이 도는 **정규식 하드룰**. 발행 직전(publish_to_notion,
   main.py) 게이트가 이걸 쓴다. 네트워크·키가 없어도 돌고, 실패하면 발행을 막는다.
2. `check_compliance` — Gemini 에게 추가로 물어보는 보조 검사. 2026-09-15 이전에는
   이것만 있었고 그나마 **어디서도 호출되지 않았다**(추적되지 않는 scratch 스크립트만
   import). 게다가 호출이 실패하면 `pass=True` 기본값으로 통과시켰다(fail-open).
   지금은 fail-closed 다 — 판정을 못 받으면 통과가 아니다.

하드룰은 금융투자업 광고 규제의 최소선이다: 매수·매도 권유, 목표가 제시, 수익 보장
표현을 금지하고, 글 어딘가에 면책 한 줄을 강제한다. 프롬프트(생성 단계)에서 면책을
금지하던 과거 규칙은 없앴다 — 면책은 '들어가도 되는' 게 아니라 '있어야 하는' 것이다.
"""

from __future__ import annotations

import json
import re

# (정규식, 사람이 읽는 사유). 본문·제목 전체에 적용한다.
HARD_RULES: tuple[tuple[str, str], ...] = (
    (r"매수\s*추천|매도\s*추천|추천\s*종목|강력\s*추천", "매수·매도 추천 표현"),
    (r"매수\s*하세요|매도\s*하세요|사세요|파세요|담으세요|들어가세요", "직접적인 매매 권유"),
    (r"목표\s*가|목표\s*주가|적정\s*주가|TP\s*\d", "목표가 제시"),
    (r"확정\s*수익|수익\s*보장|원금\s*보장|무조건\s*상승|반드시\s*오른|손실\s*없", "수익·원금 보장 표현"),
    (r"급등\s*확정|상한가\s*확정|대박\s*확정|따상", "확정적 시세 단정"),
    (r"내부\s*정보|미공개\s*정보|지라시|카더라\s*정보", "미공개 정보·루머"),
    (r"리딩\s*방|단톡방\s*가입|종목\s*상담\s*문의|수익\s*인증", "유사투자자문 유인"),
)

# 면책 한 줄로 인정하는 표현(하나만 있으면 된다).
DISCLAIMER_PATTERNS: tuple[str, ...] = (
    r"투자\s*권유(가)?\s*아닙?니다",
    r"투자\s*판단(은|의)?\s*본인",
    r"참고용",
    r"추천\s*이?\s*아닙?니다",
    r"책임은\s*투자자",
)

DEFAULT_DISCLAIMER = "개인 기록이고 투자 권유가 아닙니다. 투자 판단과 책임은 본인에게 있습니다."


def _text_of(post: dict) -> str:
    return "\n".join(str(post.get(k) or "") for k in ("title", "body"))


def hard_rule_violations(post: dict) -> list[str]:
    """위반 사유 목록. 비어 있으면 통과."""
    text = _text_of(post)
    issues = [reason for pattern, reason in HARD_RULES if re.search(pattern, text)]
    if not has_disclaimer(post):
        issues.append("면책 문구 없음 (투자 권유가 아님을 한 줄로 밝혀야 한다)")
    return issues


def has_disclaimer(post: dict) -> bool:
    text = _text_of(post)
    return any(re.search(p, text) for p in DISCLAIMER_PATTERNS)


def ensure_disclaimer(post: dict, disclaimer: str = DEFAULT_DISCLAIMER) -> dict:
    """면책이 없으면 본문 끝에 한 줄 붙인 **새 dict** 를 돌려준다."""
    if has_disclaimer(post):
        return post
    body = str(post.get("body") or "").rstrip()
    return {**post, "body": f"{body}\n\n{disclaimer}" if body else disclaimer}


def assert_publishable(post: dict) -> None:
    """발행 직전 게이트. 위반이 하나라도 있으면 예외로 막는다(fail-closed)."""
    issues = hard_rule_violations(post)
    if issues:
        where = f"{post.get('market', '')}/{post.get('ticker', '')}"
        raise ValueError(
            f"[준법] {where} 발행 차단 — " + " · ".join(issues)
        )


def check_compliance(post: dict, client=None) -> dict:
    """Gemini 보조 검사. 판정을 못 받으면 **불통과**로 본다(fail-closed).

    하드룰 결과를 항상 합쳐서 돌려주므로, 이 함수만 봐도 발행 가능 여부를 알 수 있다.
    """
    from gemini_client import GeminiClient
    from utils import paths

    hard_issues = hard_rule_violations(post)
    result: dict = {}
    try:
        template = (paths()["prompts"] / "compliance_check_prompt.md").read_text(encoding="utf-8")
        prompt = template.replace("{POST_JSON}", json.dumps(post, ensure_ascii=False, indent=2))
        gemini = client or GeminiClient()
        raw = gemini.generate_json(prompt)
        if isinstance(raw, dict):
            result = raw
        else:
            hard_issues = hard_issues + ["준법 검사 응답 형식 오류"]
    except Exception as exc:  # 키 없음·쿼터·네트워크 — 통과로 처리하지 않는다
        hard_issues = hard_issues + [f"준법 검사 실행 실패: {type(exc).__name__}"]

    issues = list(result.get("issues") or []) + hard_issues
    llm_pass = result.get("pass")
    passed = bool(llm_pass) and not hard_issues
    return {
        "pass": passed,
        "risk_level": result.get("risk_level") or ("high" if hard_issues else "unknown"),
        "issues": issues,
        "hard_rule_issues": hard_issues,
        "fix_suggestions": result.get("fix_suggestions") or [],
        "safe_version": result.get("safe_version") or post.get("body", ""),
    }
