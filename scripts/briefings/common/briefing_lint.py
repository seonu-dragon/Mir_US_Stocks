"""국내 AI 브리핑 발행 전 관문 — 근거 없는 인과 서술과 말더듬 오타를 잡는다.

2026-09-16 재감사: 숫자는 맞게 들어가게 됐지만(kr_context.NO_FABRICATION_RULE)
본문이 여전히 공급 데이터로 뒷받침되지 않는 **원인**을 사실처럼 단정했다.

  "차익 실현과 보수적인 시각이 복합적으로 작용"      ← 데이터에 없는 원인
  "성장성 있는 중소형주를 중심으로 유입"            ← 업종·테마 데이터는 공급하지 않는다
  "불공정 거래 이슈가 투자 심리에 부정적 영향을 미 미쳤습니다"  ← 단정 + 말더듬 오타

이 모듈은 Gemini 가 쓴 본문(Part 2)만 검사한다. 판단은 세 갈래다.

1. **자동 교정(결정적)** — 인접 동일 토큰('의 의', 'the the')과 한 음절 말더듬
   ('미 미쳤' → '미쳤'). 의미가 바뀌지 않으므로 경고만 찍고 고친다.
2. **근거 없는 인과 위반** — (a) 늘 금지인 공허한 상투구, (b) 헤지·헤드라인 근거
   없이 단정된 심리·수급 상투구, (c) 인과 표지('때문', '영향으로', '주도', '견인' …)
   가 있는데 헤지도 없고 헤드라인 핵심어·실측 수급 수치도 공유하지 않는 문장.
3. **처리 순서(gate_briefing)** — 위반이 있으면 위반 목록을 되먹여 **한 번** 재생성.
   그래도 남으면 위반 문장만 결정적으로 지운다. 지울 문장이 너무 많거나(본문이
   무너짐) 지운 뒤에도 위반·태그 불균형이 남으면 BriefingLintError 로 **발행을
   막는다**(워크플로가 텔레그램으로 실패를 알린다).

너무 빡빡하면 매일 막힌다. 헤지('가능성', '~로 보입니다', '~할 수 있습니다')나
조언·조건문('고려', '유의', '경우'), 공급된 헤드라인과 겹치는 핵심어, 수치가 붙은
수급·환율·금리 서술은 통과시킨다 — 테스트의 '정상 브리핑' 샘플이 기준선이다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Iterable

# ---------------------------------------------------------------------------
# 사전
# ---------------------------------------------------------------------------

# (a) 헤지를 붙여도 정보가 없는 공허한 상투구 — 늘 위반.
ALWAYS_BANNED = (
    (r"복합적으로\s*작용", "복합적으로 작용"),
    (r"복합적인?\s*요인", "복합적인 요인"),
    (r"여러\s*요인이?\s*복합", "여러 요인이 복합"),
)

# (b) 단정하면 위반, 헤지·조언이거나 같은 표현이 헤드라인에 있으면 통과.
UNHEDGED_CLICHES = (
    (r"차익\s*실현", "차익 실현"),
    (r"투자\s*심리에\s*(?:부정적|긍정적)?\s*(?:인\s*)?영향", "투자 심리에 영향"),
    (r"투자\s*심리가?\s*(?:위축|개선|악화|회복|냉각|훼손)", "투자 심리 위축/개선"),
    (r"(?:경계|관망|위험\s*회피)\s*심리", "경계·관망 심리"),
    (r"성장성\s*(?:있는|높은)", "성장성 있는"),
    (r"중소형주를?\s*중심으로", "중소형주를 중심으로"),
    (r"(?:저가\s*)?매수세가?\s*유입", "매수세 유입"),
    (r"자금이?\s*(?:대거\s*)?유입", "자금 유입"),
    (r"순환매", "순환매"),
    (r"보수적인?\s*시각이?\s*(?:작용|확산|우세)", "보수적 시각 작용"),
)

# (c) 인과 표지.
CAUSAL_MARKERS = re.compile(
    r"때문|영향으로|영향을\s*받아|여파로|여파에|에\s*힘입어|(?:으)?로\s*인해|덕분|탓에|탓으로"
    r"|에\s*따라|작용(?:하|했|해)|주도(?:하|했|해|로|의|한)|견인"
)

# 불확실성 표지 — 있으면 사실 단정이 아니다.
HEDGE_MARKERS = re.compile(
    r"가능성|추정|보인다|보입니다|보여|것으로\s*보|\s수\s*있|듯|짐작|여지|전망|예상|관측|경우|만약|여부"
)

# 조언·권고 표지 — 과거형 사실 서술이 아닐 때만 헤지로 인정한다
# ("차익 실현을 고려할 만합니다" 는 통과, "차익 실현이 하락을 주도해 유의가 필요했습니다" 는 아님).
ADVICE_MARKERS = re.compile(r"고려|바람직|권장|필요|유효|유의|주의|점검|확인|대응|살펴")
PAST_TENSE = re.compile(r"(?:했|였|었|았|됐|되었)(?:습니다|다|으며|고|는데)")

# 실측으로 공급되는 수급·매크로 용어. 문장에 **숫자와 함께** 있으면 그 수치를 근거로 본다.
DATA_TERMS = re.compile(
    r"순매수|순매도|매수\s*우위|매도\s*우위|매수세|매도세|매수|매도|환율|원/달러|원·달러|금리|국고채|기준금리"
    r"|나스닥|S&P|다우|SPY|QQQ|DIA|미국\s*증시|뉴욕\s*증시|물가|CPI"
)
HAS_NUMBER = re.compile(r"\d")

# 헤드라인 핵심어에서 뺄 범용어 — 이게 겹친다고 근거가 되진 않는다.
GENERIC_NOUNS = frozenset(
    """
    코스피 코스닥 증시 국내 시장 지수 주가 주식 투자 투자자 상승 하락 급등 급락 강세 약세 보합
    마감 장중 개장 오늘 금일 내일 어제 전일 이번 올해 내년 최대 최고 최저 사상 역대 영향 우려 기대
    외국인 기관 개인 종목 거래 증권 금융 경제 한국 한경 매경 뉴스 속보 단독 종합 포토 영상 사진
    시황 브리핑 전망 분석 가능성 이슈 관련 대비 이후 이상 이하 까지 만에 기업 업계 정부 당국
    매수 매도 순매수 순매도 매수세 매도세 매물 수급 환율 금리 마감세 반등 후퇴 돌파 회복
    """.split()
)
_PARTICLE_TAIL = re.compile(r"(?:에서|으로|에게|까지|부터|은|는|이|가|을|를|의|에|로|와|과|도|만)$")

PLACEHOLDER = "제공된 데이터로 원인을 확인할 수 없어 서술을 생략합니다."

# ---------------------------------------------------------------------------
# 자동 교정
# ---------------------------------------------------------------------------

# 뒤 단어의 첫 음절과 같은 한 음절이 단독으로 앞에 붙은 말더듬('미 미쳤').
# 관형사·부사 한 음절('이 이익', '그 그룹', '각 각국', '약 약세', '전 전일')은 정상 문장이라 뺀다.
# 의존명사·단위('코스피 등 등락률', '장 중 중국', '할 수 수출', '매수 후 후퇴')도 정상 문장에 흔하다.
_STUTTER_EXEMPT = frozenset("이그저각한두세네새첫온전총약더또잘못안꼭곧늘좀참막큰본현구신동타매"
                            "등중수때후간내외차번시대초말제및상하데뿐것곳분")
_STUTTER = re.compile(r"(?<![\w])([가-힣])[ \t]+(\1[가-힣]+)")
# 앞 단어 끝 조사가 단독으로 한 번 더 붙은 것('시장의 의 흐름'). 관형사로도 쓰이는
# '이'·'그' 등은 '사람이 이 종목' 같은 정상 문장이 있어 뺀다.
_PARTICLE_ECHO = re.compile(r"(?<![\w])([가-힣]+(의|을|를|은|는|에|로|와|과))[ \t]+\2(?![\w])")
# 인접 동일 토큰('의 의', 'the the', '상승 상승'). 글자가 하나 이상 있는 토큰만.
_DUP_TOKEN = re.compile(r"(?<![\w])(\w*[A-Za-z가-힣]\w*)((?:[ \t]+\1)+)(?![\w])", re.IGNORECASE)


def autofix_stutters(text: str) -> tuple[str, list[str]]:
    """말더듬·중복 토큰을 결정적으로 고친다. (고친 본문, 고친 내역)."""
    fixes: list[str] = []

    def _dup(m: re.Match) -> str:
        fixes.append(f"중복 토큰 '{m.group(0)}' → '{m.group(1)}'")
        return m.group(1)

    text = _DUP_TOKEN.sub(_dup, text)

    def _echo(m: re.Match) -> str:
        fixes.append(f"조사 반복 '{m.group(0)}' → '{m.group(1)}'")
        return m.group(1)

    text = _PARTICLE_ECHO.sub(_echo, text)

    def _stutter(m: re.Match) -> str:
        if m.group(1) in _STUTTER_EXEMPT:
            return m.group(0)
        fixes.append(f"말더듬 '{m.group(0)}' → '{m.group(2)}'")
        return m.group(2)

    text = _STUTTER.sub(_stutter, text)
    return text, fixes


# ---------------------------------------------------------------------------
# 문장 분해
# ---------------------------------------------------------------------------

_TAG = re.compile(r"<[^>]+>")
# 줄 머리: 트리 기호 + 선택적 굵은 라벨('<b>코스피:</b>').
_LINE_PREFIX = re.compile(r"^(\s*[^\w\s<]*\s*(?:<b>[^<]{1,30}</b>\s*)?)")
_HEADING_BODY = re.compile(r"^\s*\S{0,3}\s*<b>[^<]*</b>\s*$")
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _plain(s: str) -> str:
    return re.sub(r"\s+", " ", _TAG.sub("", s)).strip()


def _split_line(line: str) -> tuple[str, list[str]]:
    """(줄 머리, 본문 문장들). 제목 줄·빈 줄은 문장이 없다."""
    if not line.strip() or _HEADING_BODY.match(line):
        return line, []
    prefix = _LINE_PREFIX.match(line).group(1)
    body = line[len(prefix):].strip()
    if not body:
        return line, []
    return prefix, [s for s in _SENT_SPLIT.split(body) if s.strip()]


def iter_sentences(text: str) -> Iterable[str]:
    for line in text.splitlines():
        _, sentences = _split_line(line)
        for s in sentences:
            yield s


# ---------------------------------------------------------------------------
# 근거 판정
# ---------------------------------------------------------------------------

def _compact(s: str) -> str:
    return re.sub(r"\s+", "", s)


def headline_keywords(headlines: Iterable[str]) -> set[str]:
    """헤드라인의 핵심어(2글자 이상, 조사 떼고, 범용어 제외)."""
    words: set[str] = set()
    for title in headlines or []:
        for tok in re.split(r"[^0-9A-Za-z가-힣]+", str(title)):
            if len(tok) > 2:
                tok = _PARTICLE_TAIL.sub("", tok)
            if len(tok) < 2 or tok.isdigit() or tok in GENERIC_NOUNS:
                continue
            words.add(tok)
    return words


def _is_hedged(plain: str) -> bool:
    if HEDGE_MARKERS.search(plain):
        return True
    return bool(ADVICE_MARKERS.search(plain) and not PAST_TENSE.search(plain))


def _headline_supports(plain: str, keywords: set[str]) -> bool:
    compact = _compact(plain)
    return any(k in compact for k in keywords)


def _data_supports(plain: str) -> bool:
    return bool(DATA_TERMS.search(plain) and HAS_NUMBER.search(plain))


@dataclass
class Violation:
    kind: str       # banned | unhedged_cliche | unsupported_causal
    sentence: str   # 원문(태그 포함) 문장
    detail: str

    def describe(self) -> str:
        label = {
            "banned": "공허한 인과 상투구",
            "unhedged_cliche": "근거 없이 단정한 심리·수급 상투구",
            "unsupported_causal": "헤드라인·실측 근거 없는 인과 단정",
        }[self.kind]
        return f"[{label}: {self.detail}] {_plain(self.sentence)}"


@dataclass
class LintReport:
    text: str
    fixes: list[str] = field(default_factory=list)
    violations: list[Violation] = field(default_factory=list)
    sentence_count: int = 0

    @property
    def ok(self) -> bool:
        return not self.violations


def check_sentence(sentence: str, keywords: set[str], compact_headlines: list[str]) -> Violation | None:
    plain = _plain(sentence)
    if not plain:
        return None
    for pattern, name in ALWAYS_BANNED:
        if re.search(pattern, plain):
            return Violation("banned", sentence, name)
    hedged = _is_hedged(plain)
    for pattern, name in UNHEDGED_CLICHES:
        if re.search(pattern, plain) and not hedged:
            # 같은 표현이 헤드라인에 그대로 있으면 헤드라인이 근거다.
            if not any(re.search(pattern, h) for h in compact_headlines):
                return Violation("unhedged_cliche", sentence, name)
    marker = CAUSAL_MARKERS.search(plain)
    if marker and not hedged:
        if not (_headline_supports(plain, keywords) or _data_supports(plain)):
            return Violation("unsupported_causal", sentence, f"인과 표지 '{marker.group(0)}'")
    return None


def lint_briefing(text: str, headlines: Iterable[str]) -> LintReport:
    """자동 교정 후 위반을 모은다. 반환 text 는 교정본."""
    headlines = [str(h) for h in (headlines or [])]
    fixed, fixes = autofix_stutters(text or "")
    keywords = headline_keywords(headlines)
    compact_headlines = [_compact(h) for h in headlines]
    report = LintReport(text=fixed, fixes=fixes)
    for sentence in iter_sentences(fixed):
        report.sentence_count += 1
        v = check_sentence(sentence, keywords, compact_headlines)
        if v:
            report.violations.append(v)
    return report


# ---------------------------------------------------------------------------
# 결정적 제거·되먹임·관문
# ---------------------------------------------------------------------------

class BriefingLintError(RuntimeError):
    """고칠 수 없는 위반 — 발행하지 않는다."""


_BALANCED_TAGS = ("b", "i", "code", "pre", "blockquote", "a")


def _tags_balanced(text: str) -> bool:
    for tag in _BALANCED_TAGS:
        opens = len(re.findall(rf"<{tag}(?:\s[^>]*)?>", text))
        closes = len(re.findall(rf"</{tag}>", text))
        if opens != closes:
            return False
    return True


def strip_violations(text: str, violations: Iterable[Violation]) -> tuple[str, int]:
    """위반 문장을 지운다. 라벨만 남는 줄엔 PLACEHOLDER. (본문, 지운 문장 수)."""
    targets = {v.sentence for v in violations}
    out: list[str] = []
    removed = 0
    for line in text.splitlines():
        prefix, sentences = _split_line(line)
        if not sentences:
            out.append(line)
            continue
        kept = [s for s in sentences if s not in targets]
        dropped = len(sentences) - len(kept)
        if not dropped:
            out.append(line)
            continue
        removed += dropped
        if kept:
            out.append(prefix + " ".join(kept))
        elif prefix.strip():
            out.append(prefix + PLACEHOLDER)
        # 라벨 없는 줄이 통째로 비면 줄을 뺀다.
    return "\n".join(out), removed


def format_feedback(violations: Iterable[Violation]) -> str:
    lines = [
        "[직전 초안 반려 사유 — 아래 문장을 그대로 다시 쓰지 마라]",
        "다음 문장은 제공된 헤드라인·수치로 뒷받침되지 않는 원인을 사실처럼 단정했다.",
        "원인을 쓰려면 근거 헤드라인의 핵심 단어를 문장에 넣거나 수급·환율·금리 수치를 인용하고,",
        "근거가 없으면 '~했을 가능성이 있습니다' 처럼 헤지하거나 그 문장을 빼라.",
        "'복합적으로 작용' 같은 공허한 표현은 쓰지 마라. 같은 음절·단어를 두 번 연달아 쓰지 마라.",
    ]
    for v in violations:
        lines.append(f"- {v.describe()}")
    return "\n".join(lines)


def gate_briefing(
    text: str,
    headlines: Iterable[str],
    regenerate: Callable[[str], str] | None = None,
    *,
    label: str = "briefing",
    max_strip_ratio: float = 0.34,
    max_strip_count: int = 6,
) -> str:
    """발행 전 관문. 통과본을 돌려주거나 BriefingLintError 를 던진다.

    1) 교정 후 위반 없음 → 그대로.
    2) 위반 → regenerate(되먹임) 한 번. 재생성 실패(예외·빈 본문)면 첫 초안으로 진행.
    3) 여전히 위반 → 위반이 적은 초안에서 위반 문장만 제거.
       제거 비율/개수 초과, 제거 후 재검사 위반, 태그 불균형이면 발행 중단.
    """
    headlines = list(headlines or [])
    first = lint_briefing(text, headlines)
    for fix in first.fixes:
        print(f"  [lint:{label}] 자동 교정: {fix}")
    if first.ok:
        return first.text

    print(f"  [lint:{label}] 근거 없는 인과 서술 {len(first.violations)}건 — 재생성 1회 시도")
    for v in first.violations:
        print(f"    - {v.describe()}")

    best = first
    if regenerate is not None:
        try:
            retry_text = regenerate(format_feedback(first.violations))
        except Exception as exc:  # 재생성 실패는 첫 초안 제거 경로로 넘긴다
            print(f"  [lint:{label}] 재생성 실패: {exc}")
            retry_text = ""
        if retry_text and retry_text.strip():
            second = lint_briefing(retry_text, headlines)
            for fix in second.fixes:
                print(f"  [lint:{label}] 자동 교정(재생성본): {fix}")
            if second.ok:
                print(f"  [lint:{label}] 재생성본 통과")
                return second.text
            print(f"  [lint:{label}] 재생성본도 위반 {len(second.violations)}건")
            if len(second.violations) <= len(first.violations):
                best = second

    total = max(best.sentence_count, 1)
    n = len(best.violations)
    if n > max_strip_count or n / total > max_strip_ratio:
        raise BriefingLintError(
            f"[{label}] 근거 없는 인과 문장 {n}/{total}개 — 지우면 본문이 무너져 발행하지 않는다:\n"
            + "\n".join(v.describe() for v in best.violations)
        )

    stripped, removed = strip_violations(best.text, best.violations)
    recheck = lint_briefing(stripped, headlines)
    if not recheck.ok or not _tags_balanced(stripped) or recheck.sentence_count == 0:
        raise BriefingLintError(
            f"[{label}] 위반 문장 제거 후에도 통과하지 못했다(잔여 {len(recheck.violations)}건, "
            f"태그 균형 {_tags_balanced(stripped)}) — 발행하지 않는다"
        )
    print(f"  [lint:{label}] 위반 문장 {removed}개 제거 후 통과")
    return recheck.text


__all__ = [
    "BriefingLintError",
    "LintReport",
    "PLACEHOLDER",
    "Violation",
    "autofix_stutters",
    "format_feedback",
    "gate_briefing",
    "headline_keywords",
    "lint_briefing",
    "strip_violations",
]
