"""국내 법인·보고자 이름 정규화(순수 함수) — 대량보유 보고자 역검색·타법인 출자 피출자사 매칭이 같이 쓴다.

DART 의 이름은 제출인이 손으로 적는다. 같은 회사가 보고서마다 이렇게 흔들린다(2026-10-23 표본 30사 majorstock·
otrCprInvstmntSttus 실측):

    'SK이노베이션㈜ '  'SK스퀘어'  '엘지전자(주)'  '(주)우리금융지주'  '현대자동차'(상장명은 '현대차')
    'TheCapitalGroupCompanies,Inc.'  '티로우프라이스어소시에이트,인크.'(= T. Rowe Price Associates, Inc.)

그래서 **정확 일치만** 쓴다(유사도·부분 일치 없음 — 동명이 다른 회사를 같은 회사로 만들지 않는다). 대신 비교 키를
넉넉히 만든다:
  1) norm_name: NFKC → 법인격 표기((주)·㈜·주식회사·유한회사·Inc.·LLC·Ltd. …)와 공백·문장부호 제거 → 영문 소문자.
  2) 상장사 쪽은 앞머리 영문 약칭을 한글 자모 읽기로 바꾼 키도 만든다('LG전자' → '엘지전자', 'KT&G' → '케이티앤지').
     제출인 쪽을 바꾸지 않는 이유: '이마트'의 '이'를 E 로 읽는 식의 오변환이 생긴다. 영문 → 한글 방향은 결정적이다.
  3) 작은 수작업 별칭표(ALIASES): 영문·한글 표기가 둘 다 쓰이는 기관(국민연금·캐피탈그룹·블랙록 …)과 상장명이 줄임말인
     회사(현대자동차 ↔ 현대차). 서로 다른 법인을 '그룹'으로 묶지 않는다 — 블랙록 펀드 어드바이저스와 블랙록 인크는 별개다.

개인(2~4자 한글 이름)은 is_person_like 로 가려 역검색 목록에 넣지 않는다(기관·법인 보유만 모은다).
"""

from __future__ import annotations

import re
import unicodedata

# 법인격·형식 표기. 정규화 전에 지운다(대소문자 무시, 공백은 이미 지운 뒤라 붙여 쓴 형태로 적는다).
_KO_FORMS = (
    "(주)", "㈜", "(株)", "주식회사", "(유)", "유한회사", "유한책임회사", "(유한)", "(합)", "합자회사", "합명회사",
    "(재)", "재단법인", "(사)", "사단법인", "(학)",
)
# 영문 법인격(끝에 붙는 것만). 순서대로 반복해서 벗긴다('...company,inc.' → '...').
_EN_SUFFIX = (
    "incorporated", "inc", "llc", "llp", "lp", "ltd", "limited", "plc", "corporation", "corp", "company", "co",
    "bv", "nv", "ag", "sa", "gmbh", "ptyltd", "pteltd", "pte", "privatelimited",
)
# 한글로 적은 영문 법인격(끝에 붙는 것만).
_KO_EN_SUFFIX = ("인코포레이티드", "인크", "엘엘씨", "엘엘피", "엘피", "리미티드", "피엘씨", "코포레이션", "컴퍼니")
# 출자현황 표의 각주·주식 종류 표기('코오롱인더스트리 보통주 (주1)', 'LS일렉트릭(*1)', '세아베스틸지주(상장)').
_NOTES = re.compile(r"(\((?:주|注|\*|※)\s*[\d,\s]*\)|\(\*[^)]*\)|\((?:비?상장|상장사|보통주)\)|\s보통주(?=\s|$)|^보통주\s)")
_PUNCT = re.compile(r"[\s\.,·ㆍ\-_'\"‘’“”`()\[\]{}/\\:;]+")
_ET_AL = re.compile(r"외\d+(인|명|개사|사)$")

# 영문 약칭 → 한글 읽기(상장명 쪽 키를 만들 때만 쓴다).
_LETTER_KO = {
    "A": "에이", "B": "비", "C": "씨", "D": "디", "E": "이", "F": "에프", "G": "지", "H": "에이치", "I": "아이",
    "J": "제이", "K": "케이", "L": "엘", "M": "엠", "N": "엔", "O": "오", "P": "피", "Q": "큐", "R": "알", "S": "에스",
    "T": "티", "U": "유", "V": "브이", "W": "더블유", "X": "엑스", "Y": "와이", "Z": "제트", "&": "앤",
}
_LEAD_LATIN = re.compile(r"^([A-Z&]{1,6})(?=[가-힣])")

# 같은 기관의 표기 변형 → 표시 이름. 키는 norm_name 결과(정규화 뒤 비교).
# 표본에서 실제로 본 표기 + 영문·한글이 섞여 쓰이는 주요 기관만 둔다(늘릴 때도 '같은 법인'만).
_ALIAS_SOURCE = {
    "국민연금공단": ("국민연금공단", "국민연금", "국민연금기금", "국민연금공단기금", "NationalPensionService", "NPS"),
    "The Capital Group Companies": ("TheCapitalGroupCompanies,Inc.", "CapitalGroupCompanies", "더캐피탈그룹컴퍼니스인크",
                                    "캐피탈그룹컴퍼니스"),
    "Capital Research and Management": ("CapitalResearchandManagementCompany", "CapitalResearchAndManagement",
                                        "캐피탈리서치앤드매니지먼트컴퍼니", "캐피탈리서치앤매니지먼트"),
    "BlackRock Fund Advisors": ("BlackRockFundAdvisors", "블랙록펀드어드바이저스", "블랙록펀드어드바이저"),
    "BlackRock": ("BlackRock,Inc.", "BlackRockInc", "블랙록인크", "블랙록"),
    "T. Rowe Price Associates": ("T.RowePriceAssociates,Inc.", "TRowePriceAssociates", "티로우프라이스어소시에이트,인크.",
                                 "티로우프라이스어소시에이츠"),
    "Wellington Management": ("WellingtonManagementCompanyLLP", "웰링턴매니지먼트컴퍼니엘엘피", "웰링턴매니지먼트"),
    "GIC": ("GICPrivateLimited", "GIC", "지아이씨프라이빗리미티드"),
    "Norges Bank": ("NorgesBank", "노르웨이중앙은행", "노르게스뱅크"),
    "Schroder Investment Management": ("SchroderInvestmentManagementLimited", "SchroderInvestmentManagement",
                                       "슈로더인베스트먼트매니지먼트", "슈로더인베스트먼트매니지먼트리미티드"),
    "Invesco Asset Management": ("InvescoAssetManagementLimited", "인베스코에셋매니지먼트리미티드", "인베스코에셋매니지먼트"),
    "Silchester International Investors": ("SilchesterInternationalInvestorsLLP", "실체스터인터내셔널인베스터스"),
    "Pzena Investment Management": ("PzenaInvestmentManagement,LLC", "피제나인베스트먼트매니지먼트"),
    "City of London Investment Management": ("CityofLondonInvestmentManagementCompanyLimited",
                                             "시티오브런던인베스트먼트매니지먼트", "시티오브런던인베스트먼트매니지먼트컴퍼니리미티드"),
    "KCGI": ("KCGI", "케이씨지아이", "주식회사케이씨지아이"),
    "얼라인파트너스자산운용": ("얼라인파트너스자산운용", "AlignPartnersCapitalManagement", "얼라인파트너스"),
    "트러스톤자산운용": ("트러스톤자산운용", "TrusstonAssetManagement"),
    "플래쉬라이트캐피탈파트너스": ("플래쉬라이트캐피탈파트너스", "FlashlightCapitalPartners", "플래시라이트캐피탈파트너스"),
    "브이아이피자산운용": ("브이아이피자산운용", "VIP자산운용"),
    # 상장명이 줄임말인 회사 — 제출인은 정식 이름을 쓴다.
    "현대차": ("현대자동차", "현대차"),
    "기아": ("기아자동차", "기아"),
    "POSCO홀딩스": ("포스코홀딩스", "POSCO홀딩스"),
    "KT&G": ("케이티앤지", "KT&G", "한국담배인삼공사"),
    "코오롱인더": ("코오롱인더스트리", "코오롱인더"),
    "LS ELECTRIC": ("LS일렉트릭", "엘에스일렉트릭", "LSELECTRIC", "LS산전", "엘에스산전"),
    "한화생명": ("한화생명보험", "한화생명"),
    "삼성생명": ("삼성생명보험", "삼성생명"),
    "삼성화재": ("삼성화재해상보험", "삼성화재"),
    "현대해상": ("현대해상화재보험", "현대해상"),
    "미래에셋생명": ("미래에셋생명보험", "미래에셋생명"),
    "한국전력": ("한국전력공사", "한국전력"),
    "한국항공우주": ("한국항공우주산업", "한국항공우주"),
}
# 역검색 목록에 개수와 무관하게 넣는 기관(표시 이름). 연기금·주요 운용사·행동주의.
CURATED_HOLDERS = frozenset({
    "국민연금공단", "The Capital Group Companies", "Capital Research and Management", "BlackRock Fund Advisors",
    "BlackRock", "T. Rowe Price Associates", "Wellington Management", "GIC", "Norges Bank", "KCGI",
    "얼라인파트너스자산운용", "트러스톤자산운용", "플래쉬라이트캐피탈파트너스", "City of London Investment Management",
    "브이아이피자산운용",
})

_CORP_HINT = re.compile(
    r"(공단|공사|기금|연금|은행|증권|보험|생명|화재|캐피탈|운용|투자|자산|펀드|파트너스|홀딩스|지주|그룹|조합|재단|학원|"
    r"학교|협회|중앙회|법인|산업|전자|화학|건설|물산|제약|바이오|에너지|금융|컴퍼니|매니지먼트|인베스트|글로벌|"
    r"코리아|코퍼레이션|인터내셔널|사모|신탁|벤처|테크|시스템|엔터|미디어|리츠|모터스|중공업|철강|통신|"
    r"[A-Za-z0-9&])"
)


def _strip_forms(text: str) -> str:
    low = _NOTES.sub(" ", text)
    low = _NOTES.sub(" ", low)
    for form in _KO_FORMS:
        low = low.replace(form, "")
    return low


def norm_name(raw) -> str:
    """비교 키. 빈 문자열이면 비교 불가."""
    text = unicodedata.normalize("NFKC", str(raw or "")).strip()
    if not text:
        return ""
    text = _strip_forms(text)
    text = _PUNCT.sub("", text)
    text = _ET_AL.sub("", text)
    text = _strip_forms(text)
    low = text.lower()
    # 영문 법인격은 영문으로 끝날 때만 벗긴다(한글 이름 끝의 'co' 같은 건 없다).
    changed = True
    while changed and low and re.search(r"[a-z]$", low):
        changed = False
        for suf in _EN_SUFFIX:
            if low.endswith(suf) and len(low) > len(suf) + 2:
                low = low[: -len(suf)]
                changed = True
                break
    changed = True
    while changed and low:
        changed = False
        for suf in _KO_EN_SUFFIX:
            if low.endswith(suf) and len(low) > len(suf) + 2:
                low = low[: -len(suf)]
                changed = True
                break
    return low


def hangulize_lead(name: str) -> str | None:
    """'LG전자' → '엘지전자', 'KT&G' → '케이티앤지', 'HD현대' → '에이치디현대'. 앞머리 영문 약칭이 없으면 None."""
    text = unicodedata.normalize("NFKC", str(name or "")).strip()
    text = _PUNCT.sub("", _strip_forms(text))
    up = text.upper() if re.fullmatch(r"[A-Za-z&]{1,6}", text) else text
    if re.fullmatch(r"[A-Z&]{1,6}", up):                  # 전부 영문 약칭('LG', 'SK', 'KT&G')
        return "".join(_LETTER_KO[c] for c in up)
    m = _LEAD_LATIN.match(text)
    if not m:
        return None
    return "".join(_LETTER_KO[c] for c in m.group(1)) + text[m.end():]


ALIASES: dict[str, str] = {}
for _display, _variants in _ALIAS_SOURCE.items():
    for _v in (_display, *_variants):
        _k = norm_name(_v)
        if _k:
            ALIASES[_k] = _display


def canonical(raw) -> tuple[str, str]:
    """(그룹 키, 표시 이름). 별칭표에 있으면 표시 이름이 키도 된다(정규화 값으로)."""
    key = norm_name(raw)
    if not key:
        return "", ""
    display = ALIASES.get(key)
    if display:
        return norm_name(display), display
    return key, display_name(raw)


def display_name(raw) -> str:
    """화면용 — 법인격 표기만 떼고 공백을 하나로('SK이노베이션㈜ ' → 'SK이노베이션')."""
    text = _strip_forms(unicodedata.normalize("NFKC", str(raw or "")))
    return " ".join(text.split()).strip(" ,.")


def is_person_like(raw) -> bool:
    """2~4자 한글만이고 법인 단서가 없으면 개인 이름으로 본다('이재용', '최태원'). '외 3인'은 떼고 본다."""
    text = _PUNCT.sub("", unicodedata.normalize("NFKC", str(raw or "")))
    text = _ET_AL.sub("", text)
    if not text:
        return False
    if _CORP_HINT.search(text):
        return False
    return bool(re.fullmatch(r"[가-힣]{2,4}", text))


def is_preferred_name(raw) -> bool:
    """피출자 이름이 우선주를 가리키면 True('삼성전자(우)', '○○ 우선주') — 보통주 시총과 섞지 않는다."""
    text = unicodedata.normalize("NFKC", str(raw or ""))
    return bool(re.search(r"(\(우\)|우선주|\b우B?$|\d우$|\(1우\)|\(2우B?\))", text.replace(" ", "")))


def listed_keys(company: str) -> set[str]:
    """상장사 이름 하나 → 비교 키 묶음(정규화 · 앞머리 영문 한글 읽기 · 별칭)."""
    keys = set()
    base = norm_name(company)
    if base:
        keys.add(base)
    hang = hangulize_lead(company)
    if hang:
        k = norm_name(hang)
        if k:
            keys.add(k)
    display = ALIASES.get(base)
    if display:
        for alias_key, alias_display in ALIASES.items():
            if alias_display == display:
                keys.add(alias_key)
    return keys


def build_listed_index(stocks) -> dict[str, str]:
    """[(ticker, company)] → {비교 키: ticker}. 두 종목이 같은 키를 가지면 그 키는 버린다(모호)."""
    index: dict[str, str] = {}
    ambiguous: set[str] = set()
    for ticker, company in stocks:
        for k in listed_keys(company):
            if k in ambiguous:
                continue
            if k in index and index[k] != ticker:
                ambiguous.add(k)
                index.pop(k, None)
                continue
            index[k] = ticker
    return index


def match_listed(raw, index: dict[str, str]) -> str | None:
    """제출인·피출자 이름 → 상장 종목코드(정확 일치만). 우선주 표기는 None."""
    if is_preferred_name(raw):
        return None
    key = norm_name(raw)
    if not key:
        return None
    hit = index.get(key)
    if hit:
        return hit
    display = ALIASES.get(key)
    if display:
        return index.get(norm_name(display))
    return None
