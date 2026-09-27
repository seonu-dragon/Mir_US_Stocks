#!/usr/bin/env python3
"""8-K 본문 → 규칙 기반 한국어 3줄 요약(무엇 · 누가 · 얼마·언제). 네트워크·LLM 없음.

build_material_events.py 가 8-K 본문(주 문서 HTML → 텍스트)을 받아 이 모듈에 넘긴다.
Item 코드별 템플릿에 본문에서 정규식으로 뽑은 날짜·금액·상대방·임원 이름/직책을 채운다.

원칙
- 숫자·이름은 **원문에 적힌 그대로** 옮긴다(금액 "$2.5 billion" 을 환산하지 않는다).
  날짜만 "September 24, 2026" → "2026-09-24" 로 바꾼다(기계적 변환).
- 뽑지 못한 칸은 비운다. 세 칸이 다 비면 None — 화면은 Item 제목 + 원문 링크만 보여 준다.
- 평가·전망 문구를 만들지 않는다. 템플릿은 사건의 종류만 말한다.
- 요약 대상은 Item 하나(우선순위가 가장 높은 것). 다른 Item 은 화면의 칩이 이미 보여 준다.

반환 형태: {"item": "1.01", "what": str, "who": str, "amount": str, "date": "YYYY-MM-DD"}
"""

from __future__ import annotations

import re

# 요약할 Item 과 우선순위(앞일수록 먼저). 2.02(실적)는 보도자료 AI 요약(build_earnings_releases)이
# 따로 있어 여기서 다루지 않는다. 9.01(첨부)은 사건이 아니다.
PRIORITY = ("4.02", "3.01", "1.03", "2.01", "1.01", "1.02", "4.01", "5.01", "2.05", "2.06",
            "5.02", "2.03", "3.02", "5.07", "5.03", "8.01", "7.01")

MONTHS = {m: i for i, m in enumerate(
    ("january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"), start=1)}
_DATE_RE = re.compile(
    r"\b(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2}),\s*(\d{4})\b")
# 금액: $1.2 billion · C$750 million · £772.3 million · $500,000,000 · $0.06 per share
_MONEY_RE = re.compile(
    r"(?:(?:US|C|A|NZ|HK|S)?\$|£|€)\s?\d[\d,]*(?:\.\d+)?"
    r"(?:\s(?:million|billion|thousand|trillion)\b)?(?:\sper\s(?:share|unit)\b)?")
_MONEY_RANGE_RE = re.compile(
    r"((?:US|C)?\$\s?\d[\d,]*(?:\.\d+)?(?:\s(?:million|billion))?)\s(?:to|and|-|–)\s"
    r"((?:US|C)?\$\s?\d[\d,]*(?:\.\d+)?\s(?:million|billion))")
_ITEM_HEAD_RE = re.compile(r"(?im)^[ \t|]*item[ \t]*(\d\.\d{2})\b")
_STOP_RE = re.compile(r"(?im)^[ \t|]*(signatures?|s i g n a t u r e s?)\b")

# 사람 이름·직책 --------------------------------------------------------------------------
TITLE_MAP = (
    ("executive vice president", "EVP"),
    ("senior vice president", "SVP"),
    ("vice president", "부사장"),
    ("chief executive officer", "CEO"),
    ("chief financial officer", "CFO"),
    ("chief operating officer", "COO"),
    ("chief accounting officer", "CAO"),
    ("chief technology officer", "CTO"),
    ("chief legal officer", "최고법무책임자"),
    ("chief commercial officer", "CCO"),
    ("chief information officer", "CIO"),
    ("chief medical officer", "CMO"),
    ("chief scientific officer", "CSO"),
    ("chief people officer", "최고인사책임자"),
    ("chief human resources officer", "최고인사책임자"),
    ("chief investment officer", "최고투자책임자"),
    ("chief risk officer", "CRO"),
    ("principal financial officer", "재무책임자"),
    ("principal accounting officer", "회계책임자"),
    ("general counsel", "법무총괄"),
    ("chairman of the board", "이사회 의장"),
    ("chair of the board", "이사회 의장"),
    ("chairman", "의장"),
    ("chairperson", "의장"),
    ("lead independent director", "선임 사외이사"),
    ("president", "사장"),
    ("treasurer", "재무담당"),
    ("controller", "회계담당"),
    ("director", "이사"),
)
_NAME_STOP = {
    "the", "board", "company", "directors", "director", "chief", "officer", "executive", "financial",
    "president", "vice", "senior", "committee", "audit", "inc", "llc", "corporation", "agreement",
    "section", "item", "form", "report", "current", "annual", "meeting", "exhibit", "press", "release",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
    "november", "december", "on", "effective", "as", "in", "of", "and", "for", "to", "with", "securities",
    "exchange", "commission", "stock", "common", "plan", "general", "counsel", "chairman", "compensation",
    "employment", "separation", "offer", "letter", "operating", "accounting", "principal", "group",
    "holdings", "north", "america", "united", "states", "new", "york", "delaware", "his", "her", "mr",
    "ms", "mrs", "dr", "following", "upon", "pursuant", "under", "each", "such", "nasdaq", "nyse",
}
# 이름 후보: 대문자로 시작하는 2~4 단어(가운데 이니셜 허용). "P. Sean Neville", "Da-Wai Hu".
_NAME_RE = re.compile(
    r"\b((?:[A-Z]\.\s)?[A-Z][a-z][A-Za-z'\-]+(?:\s(?:[A-Z]\.|[A-Z][a-z][A-Za-z'\-]+)){1,3})\b")
_DEPART_RE = re.compile(r"\b(resign\w*|retire\w*|step(?:ping|ped)?\s+down|depart\w*|terminat\w*|"
                        r"will\s+not\s+stand\s+for\s+re-?election|transition\w*\s+(?:out|from))\b", re.I)
_APPOINT_RE = re.compile(r"\b(appoint\w*|elect(?:ed|ion)?|named|promot\w*|hir(?:e|ed|ing)|join\w*|nominat\w*)\b", re.I)
_COMP_RE = re.compile(r"\b(employment agreement|amendment|compensat\w*|base salary|bonus|equity award|"
                      r"severance|retention|offer letter)\b", re.I)

# 회사·기관 이름 -----------------------------------------------------------------------------
_ORG_SUFFIX = (r"(?:Inc\.?|Incorporated|N\.A\.|National Association|LLC|L\.L\.C\.|L\.P\.|LP|LLP|Ltd\.?|Limited|"
               r"Corporation|Corp\.?|Company|Co\.|plc|PLC|AG|S\.A\.|SE|N\.V\.|B\.V\.|GmbH|Bank|Trust|Partners|"
               r"Holdings|Group|P\.C\.|P\.A\.)")
_WITH_ORG_RE = re.compile(
    r"\bwith\s+((?:[A-Z][\w&.'\-]*|of|and|&)(?:[\s,]+(?:[A-Z][\w&.'\-]*|of|and|&|de|du)){0,8}?,?\s" + _ORG_SUFFIX + r")")
_AUDITOR_RE = re.compile(
    r"((?:[A-Z][\w&'\-]*\.?[\s,]+){1,5}?(?:LLP|P\.C\.|P\.A\.|LLC|PLLC|Ltd\.?))")

_AGREEMENT_TAIL = r"(?:Agreement|Indenture|Amendment|Facility|Contract|Plan|Letter|Arrangement|Notes|Program)"
_AGREEMENT_RE = re.compile(
    r"\bentered\s+into\s+(?:an?\s+|the\s+|a\s+new\s+)?"
    r"((?:[A-Z0-9][\w.'&\-]*\s(?:No\.\s\d+\s)?(?:(?:and|to|of|for|on|the)\s)*){0,8}?" + _AGREEMENT_TAIL + r")\b")
_DEFINED_RE = re.compile(r"\(\s*(?:the|each,?\s+an?|collectively,?\s+the|an?)?\s*[“\"]\s*([^”\"]{3,70}?)\s*[”\"]")
_NOTES_RE = re.compile(r"(\d{1,2}\.\d{1,3}%\s(?:Senior\s|Subordinated\s|Convertible\s|Exchangeable\s|Secured\s|Unsecured\s)*"
                       r"(?:Senior\s)?Notes\s+due\s+\d{4})")

_JUDGE_EXCLUDE = re.compile(r"\bprevious(?:ly)?\b", re.I)


# ---------------------------------------------------------------------------------------
# 공용 도우미
# ---------------------------------------------------------------------------------------

def normalize(text: str) -> str:
    """따옴표 안 공백(“ NMP ”)·줄바꿈·표 구분자를 정리한 한 덩어리 텍스트."""
    s = str(text or "").replace("​", " ").replace("\xa0", " ")
    s = re.sub(r"“\s+", "“", s)
    s = re.sub(r"\s+”", "”", s)
    s = re.sub(r"\s*\|\s*", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def iso_date(m) -> str:
    try:
        mon = MONTHS[m.group(1).lower()]
        d = int(m.group(2))
        y = int(m.group(3))
    except (KeyError, ValueError):
        return ""
    if not (1 <= d <= 31 and 1990 <= y <= 2100):
        return ""
    return f"{y:04d}-{mon:02d}-{d:02d}"


def first_date(text: str) -> str:
    """'On September 24, 2026' 처럼 문장 앞 'On' 날짜를 먼저, 없으면 첫 날짜."""
    m = re.search(r"\bOn\s+" + _DATE_RE.pattern, text or "")
    if m:
        return iso_date(re.match(_DATE_RE, m.group(0)[3:].strip()))
    m = _DATE_RE.search(text or "")
    return iso_date(m) if m else ""


def sentences(text: str) -> list[str]:
    # 약어(Inc. · N.A. · Mr. · No. 1)에서 끊지 않도록 '마침표 + 공백 + 대문자' 중 약어가 아닌 곳만.
    parts = re.split(r"(?<!\bInc)(?<!\bCorp)(?<!\bCo)(?<!\bLtd)(?<!\bMr)(?<!\bMs)(?<!\bMrs)(?<!\bDr)(?<!\bNo)"
                     r"(?<!\bN\.A)(?<!\bL\.P)(?<!\bS\.A)(?<!\bP\.C)(?<![A-Z])\.\s+(?=[A-Z(“\"])", text or "")
    return [p.strip() for p in parts if p and p.strip()]


# Item 머리 제목(영문). 절 본문 맨 앞에 붙어 오는 이 제목은 판정·추출에서 뺀다.
ITEM_TITLES_EN = {
    "1.01": "Entry into a Material Definitive Agreement",
    "1.02": "Termination of a Material Definitive Agreement",
    "1.03": "Bankruptcy or Receivership",
    "2.01": "Completion of Acquisition or Disposition of Assets",
    "2.02": "Results of Operations and Financial Condition",
    "2.03": "Creation of a Direct Financial Obligation or an Obligation under an Off-Balance Sheet "
            "Arrangement of a Registrant",
    "2.05": "Costs Associated with Exit or Disposal Activities",
    "2.06": "Material Impairments",
    "3.01": "Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard; "
            "Transfer of Listing",
    "3.02": "Unregistered Sales of Equity Securities",
    "4.01": "Changes in Registrant's Certifying Accountant",
    "4.02": "Non-Reliance on Previously Issued Financial Statements or a Related Audit Report or "
            "Completed Interim Review",
    "5.01": "Changes in Control of Registrant",
    "5.02": "Departure of Directors or Certain Officers; Election of Directors; Appointment of "
            "Certain Officers; Compensatory Arrangements of Certain Officers",
    "5.03": "Amendments to Articles of Incorporation or Bylaws; Change in Fiscal Year",
    "5.07": "Submission of Matters to a Vote of Security Holders",
    "7.01": "Regulation FD Disclosure",
    "8.01": "Other Events",
    "9.01": "Financial Statements and Exhibits",
}


def strip_title(code: str, body: str) -> str:
    """절 맨 앞의 Item 제목을 뗀다. 제출사마다 표기가 조금씩 달라(’/'·대소문자·끝 마침표)
    단어 단위로 느슨하게 맞추고, 못 맞추면 본문을 그대로 돌려준다."""
    title = ITEM_TITLES_EN.get(code)
    if not title:
        return body
    words = re.findall(r"[A-Za-z]+", title)
    pat = r"^\W*" + r"\W+".join(re.escape(w) for w in words) + r"\W*"
    m = re.match(pat, body, re.I)
    if m:
        return body[m.end():].lstrip()
    # 긴 제목은 앞 네 단어만 맞아도 문장 끝(마침표)까지를 제목으로 본다.
    head = r"^\W*" + r"\W+".join(re.escape(w) for w in words[:4])
    m = re.match(head + r"[^.]{0,200}?\.\s*", body, re.I)
    return body[m.end():].lstrip() if m else body


def split_items(text: str) -> dict[str, str]:
    """본문을 Item 절로 나눈다. {"1.01": "절 본문(정리됨)"}. 같은 Item 이 두 번 나오면 앞의 것."""
    # 얇은 공백(U+2009)·nbsp 등 유니코드 공백을 보통 공백으로(WMG 는 Item 과 번호 사이에 U+2009 를 쓴다).
    raw = re.sub(r"[^\S\n]", " ", str(text or ""))
    stop = _STOP_RE.search(raw)
    heads = [m for m in _ITEM_HEAD_RE.finditer(raw) if not stop or m.start() < stop.start()]
    out: dict[str, str] = {}
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else (stop.start() if stop else len(raw))
        code = m.group(1)
        if code in out:
            continue
        body = normalize(raw[m.end():end])
        # 머리의 Item 제목("Entry into a Material Definitive Agreement.")은 본문 판정에서 뺀다.
        body = re.sub(r"^[.\-–—:\s]*", "", body)
        out[code] = strip_title(code, body)
    return out


def clip(s: str, n: int = 90) -> str:
    s = re.sub(r"\s+", " ", str(s or "")).strip(" ,;:")
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def money_near(text: str, keywords: tuple[str, ...], window: int = 220) -> str:
    """키워드 뒤 window 글자 안의 첫 금액(원문 표기). 없으면 본문 첫 금액이 아닌 빈 문자열."""
    low = (text or "").lower()
    best = None
    for kw in keywords:
        for km in re.finditer(re.escape(kw), low):
            seg = text[km.end(): km.end() + window]
            mm = None
            for cand in _MONEY_RE.finditer(seg):
                # 액면가('par value $0.01 per share')는 금액이 아니다 — 다음 후보로.
                if "par value" in seg[max(0, cand.start() - 30):cand.start()].lower():
                    continue
                mm = cand
                break
            # 키워드와 금액 사이에 문장 끝이나 'shares' 가 끼면 다른 이야기다
            # ('up to 387,051 shares … exercise price of $2,226.60' 의 행사가를 잡지 않게).
            gap = seg[:mm.start()] if mm else ""
            if mm and (re.search(r"\bshares?\b|\.\s+[A-Z]", gap)):
                mm = None
            if mm and clean_money(mm.group(0)) and not re.match(r"\s*\d", seg[mm.end():mm.end() + 2]):
                pos = km.end() + mm.start()
                if best is None or pos < best[0]:
                    best = (pos, mm.group(0))
    return clean_money(best[1]) if best else ""


def clean_money(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    # "$0.0001 per share" 같은 액면가는 금액이 아니다.
    if re.search(r"0\.000\d", s):
        return ""
    return s


def is_par_value(text: str, m) -> bool:
    return "par value" in text[max(0, m.start() - 20): m.start()].lower()


def first_money(text: str) -> str:
    for m in _MONEY_RE.finditer(text or ""):
        if is_par_value(text, m):
            continue
        v = clean_money(m.group(0))
        if v:
            return v
    return ""


_PARTY_WORD = r"[A-Z][\w.&'\-]*"
# "(the “Company”) and Anthropic, PBC (“Anthropic”) entered into" — 회사와 나란히 적힌 상대방.
_AND_PARTY_RE = re.compile(r"[“\"]Company[”\"]\)\s+and\s+(" + _PARTY_WORD + r"(?:,?\s(?:" + _PARTY_WORD + r"|of|&)){0,6}?)"
                           r"\s*\(\s*(?:the\s+)?[“\"]")
# "entered into an employment agreement … with Valentin Blavatnik, a member of …" — 사람·약칭 상대방.
_WITH_NAME_RE = re.compile(r"\bwith\s+(" + _PARTY_WORD + r"(?:\s(?:" + _PARTY_WORD + r"|of|&)){0,5})")


def party_in_sentence(sentence: str) -> str:
    """법인 접미어가 없는 상대방(사람 이름·'Anthropic, PBC' 류). org_after_with 가 못 잡을 때만."""
    m = _AND_PARTY_RE.search(sentence or "")
    if m:
        return clip(m.group(1), 70)
    m = _WITH_NAME_RE.search(sentence or "")
    if m:
        name = m.group(1).strip()
        toks = [t.strip(".,").lower() for t in name.split()]
        if toks and toks[0] not in _NAME_STOP and toks[0] not in ("respect", "certain", "its", "effect"):
            return clip(name, 70)
    return ""


def org_after_with(sentence: str, company: str = "") -> str:
    for m in _WITH_ORG_RE.finditer(sentence or ""):
        name = clip(m.group(1), 70)
        if company and name.lower().startswith(company.lower()[:12]):
            continue
        if re.match(r"(?i)the\s+(company|registrant)", name):
            continue
        return name
    return ""


def agreement_name(section: str) -> str:
    """'entered into a Credit Agreement' → 'Credit Agreement'. '이전에 공시한' 문장은 뒤로 미룬다."""
    cands = []
    for sent in sentences(section):
        for m in _AGREEMENT_RE.finditer(sent):
            name = clip(m.group(1), 70)
            if len(name) < 5:
                continue
            cands.append((1 if _JUDGE_EXCLUDE.search(sent) else 0, name, sent))
    if cands:
        cands.sort(key=lambda c: c[0])
        return cands[0][1]
    for m in _DEFINED_RE.finditer(section):
        name = m.group(1).strip()
        if re.search(_AGREEMENT_TAIL + r"$", name):
            return clip(name, 70)
    return ""


def agreement_sentence(section: str) -> str:
    sents = sentences(section)
    for sent in sents:
        if re.search(r"\bentered\s+into\b", sent) and not _JUDGE_EXCLUDE.search(sent):
            return sent
    for sent in sents:
        if re.search(r"\bentered\s+into\b", sent):
            return sent
    return sents[0] if sents else ""


def incorporates(section: str) -> str:
    """'The information ... Item 1.01 ... is incorporated by reference' → '1.01'."""
    m = re.search(r"Item\s+(\d\.\d{2})[^.]{0,120}incorporated\s+(?:herein\s+)?by\s+reference", section or "", re.I)
    if m:
        return m.group(1)
    m = re.search(r"incorporated\s+(?:herein\s+)?by\s+reference[^.]{0,80}Item\s+(\d\.\d{2})", section or "", re.I)
    return m.group(1) if m else ""


def korean_title(raw: str) -> str:
    """영문 직책 문구 → 한국어 약칭(글에 나온 순서, 최대 2개). 긴 문구를 먼저 지워 겹침을 막는다
    ('Executive Vice President' 안의 'President' 가 '사장' 으로 잡히지 않게)."""
    low = " " + str(raw or "").lower() + " "
    found = []
    for en, ko in TITLE_MAP:
        for m in re.finditer(r"\b" + re.escape(en) + r"\b", low):
            found.append((m.start(), ko))
        low = re.sub(r"\b" + re.escape(en) + r"\b", lambda m: "#" * len(m.group(0)), low)
    out = []
    for _, ko in sorted(found):
        if ko not in out:
            out.append(ko)
    # 'director' 는 다른 직책과 함께면(예: 'CEO and director') 앞 직책만.
    if len(out) > 1 and "이사" in out:
        out.remove("이사")
    return "·".join(out[:2])


# ---------------------------------------------------------------------------------------
# Item 별 추출기 — 각자 {"what","who","amount","date"} 부분 dict 를 돌려준다(없으면 빈 값).
# ---------------------------------------------------------------------------------------

def x_101(sec: str, company: str) -> dict:
    name = agreement_name(sec)
    sent = agreement_sentence(sec)
    who = org_after_with(sent, company) or org_after_with(sec[:1500], company) or party_in_sentence(sent)
    amount = money_near(sec, ("aggregate principal amount", "aggregate amount of up to", "up to",
                              "not to exceed", "purchase price", "consideration of", "total of", "for $",
                              "valued at", "committed to pay", "annual base salary of")) or first_money(sec[:1500])
    return {"what": f"중요 계약 체결{' — ' + name if name else ''}", "who": f"상대방 {who}" if who else "",
            "amount": amount, "date": first_date(sec)}


def x_102(sec: str, company: str) -> dict:
    name = ""
    m = re.search(r"terminat\w*[^.]{0,120}?(?:the\s+|its\s+|their\s+existing\s+)((?:[A-Z][\w.'&\-]*\s(?:(?:and|to|of|for)\s)*){0,8}?"
                  + _AGREEMENT_TAIL + r")", sec)
    if m:
        name = clip(m.group(1), 70)
    if not name:
        name = agreement_name(sec)
    who = org_after_with(sec[:2000], company)
    if not who:
        m = re.search(r"\b(?:and|between)\s+the\s+Company[^.]{0,40}?\band\s+((?:[A-Z][\w&.'\-]*[\s,]+){1,6}?" + _ORG_SUFFIX + r")", sec)
        who = clip(m.group(1), 70) if m else ""
    amount = money_near(sec, ("payment of", "fee of", "termination fee", "principal amount", "up to"))
    return {"what": f"중요 계약 종료{' — ' + name if name else ''}", "who": f"상대방 {who}" if who else "",
            "amount": amount, "date": first_date(sec)}


def x_103(sec: str, company: str) -> dict:
    ch = re.search(r"\bChapter\s+(7|11|15)\b", sec)
    court = re.search(r"United States Bankruptcy Court for the\s+((?:[A-Z][a-z]+\s){0,3}District of\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)", sec)
    what = "파산·회생 절차 신청" + (f" — Chapter {ch.group(1)}" if ch else "")
    return {"what": what, "who": f"법원 {clip(court.group(1), 60)}" if court else "", "amount": "",
            "date": first_date(sec)}


def x_201(sec: str, company: str) -> dict:
    low = sec[:1500].lower()
    sale = re.search(r"\b(sale|sold|dispos\w+|divest\w*)\b", low)
    buy = re.search(r"\b(acqui\w+|merger|purchase of)\b", low)
    kind = "매각" if sale and (not buy or sale.start() < buy.start()) else "인수" if buy else "자산 인수·처분"
    who = ""
    m = re.search(r"((?:[A-Z][\w&.'\-]*[\s,]+){1,6}?" + _ORG_SUFFIX + r")\s*\(\s*(?:the\s+)?[“\"](?:Buyer|Purchaser|Seller|Target|Acquiror)[”\"]", sec)
    if m:
        who = clip(m.group(1), 70)
    if not who:
        m = re.search(r"\bto\s+(?:an\s+affiliate\s+of\s+)?((?:[A-Z][\w&.'\-]*\s){1,5}(?:[A-Z][\w&.'\-]*))\s*\(\s*(?:the\s+)?[“\"](?:Buyer|Purchaser)", sec)
        who = clip(m.group(1), 70) if m else ""
    amount = money_near(sec, ("cash consideration of", "purchase price for", "purchase price of", "aggregate purchase price",
                              "consideration of", "purchase price", "for approximately", "for a total"))
    label = {"매각": "상대방(매수자)", "인수": "상대방(매도자)"}.get(kind, "상대방")
    return {"what": f"{kind} 완료" if kind != "자산 인수·처분" else "자산 인수·처분 완료",
            "who": f"{label} {who}" if who else "", "amount": amount, "date": first_date(sec)}


def x_203(sec: str, company: str, items: dict | None = None) -> dict:
    ref = incorporates(sec)
    base = sec
    if ref and items and ref in items and len(sec) < 600:
        base = items[ref]
    notes = _NOTES_RE.findall(base)
    inst = ""
    if notes:
        inst = notes[0] + (f" 외 {len(set(notes)) - 1}종" if len(set(notes)) > 1 else "")
    elif re.search(r"commercial paper", base, re.I):
        inst = "기업어음(CP) 프로그램"
    elif re.search(r"term loan", base, re.I):
        inst = "Term Loan"
    elif re.search(r"revolving credit", base, re.I):
        inst = "Revolving Credit Facility"
    else:
        inst = agreement_name(base)
    who = org_after_with(agreement_sentence(base), company)
    amount = money_near(base, ("aggregate principal amount outstanding at any one time not to exceed", "not to exceed",
                               "aggregate amount of up to", "aggregate principal amount of", "up to", "borrowed")) \
        or first_money(base[:1500])
    return {"what": f"채무 발생{' — ' + clip(inst, 60) if inst else ''}", "who": f"상대방 {who}" if who else "",
            "amount": amount, "date": first_date(base)}


def x_205(sec: str, company: str) -> dict:
    amount = ""
    m = _MONEY_RANGE_RE.search(sec)
    if m and re.search(r"charge|cost|expens", sec[max(0, m.start() - 200): m.end() + 120], re.I):
        amount = f"{m.group(1)} ~ {m.group(2)}"
    if not amount:
        amount = money_near(sec, ("charges of", "approximately", "costs of", "total of"))
    extra = []
    m = re.search(r"approximately\s+(\d[\d,.]*%)\s+of\s+(?:its|the Company’s|the Company's)?\s*(?:global\s+)?(?:workforce|employees)", sec)
    if m:
        extra.append(f"인력 약 {m.group(1)} 감축")
    else:
        m = re.search(r"(?:reduc\w+|eliminat\w+)[^.]{0,60}?(?:approximately\s+)?(\d[\d,]{1,6})\s+(?:positions|employees|roles|jobs)", sec)
        if m:
            extra.append(f"약 {m.group(1)}개 일자리 감축")
    if re.search(r"\bclos(?:e|ure|ing)\b[^.]{0,80}(?:stores|facilit|coffeehouses|locations|sites|plants?)", sec, re.I):
        extra.append("시설·점포 정리")
    what = "구조조정(사업 철수·정리) 비용"
    if extra:
        what += " — " + " · ".join(extra)
    return {"what": what, "who": "", "amount": amount, "date": first_date(sec)}


def x_206(sec: str, company: str) -> dict:
    amount = money_near(sec, ("impairment charge of", "charge of", "approximately"))
    return {"what": "자산 손상차손 인식", "who": "", "amount": amount, "date": first_date(sec)}


def x_301(sec: str, company: str) -> dict:
    low = sec.lower()
    exch = ""
    for pat, name in (("nyse american", "NYSE American"), ("new york stock exchange", "NYSE"), ("nyse", "NYSE"),
                      ("nasdaq", "Nasdaq")):
        if pat in low:
            exch = name
            break
    reason = ""
    if re.search(r"voluntar\w+\s+(?:withdraw|delist)|intention to (?:voluntarily )?(?:withdraw|delist)", low):
        reason = "자진 상장폐지(또는 이전) 결정"
    elif re.search(r"transfer (?:the |its )?(?:listing|common stock)|transfer of listing", low):
        reason = "상장 거래소 이전"
    elif "minimum bid price" in low or "closing bid price" in low:
        reason = "최저 주가 요건 미달 통지"
    elif "stockholders’ equity" in low or "stockholders' equity" in low or "shareholders’ equity" in low:
        reason = "자기자본 요건 미달 통지"
    elif re.search(r"form 10-[kq]|periodic (?:report|filing)|timely file", low):
        reason = "정기보고서 지연 제출 통지"
    elif "market value of" in low or "market capitalization" in low:
        reason = "시가총액 요건 미달 통지"
    elif "delist" in low:
        reason = "상장폐지 절차 통지"
    else:
        reason = "상장 유지 요건 관련 통지"
    deadline = ""
    m = re.search(r"\b(?:until|by|through)\s+" + _DATE_RE.pattern + r"[^.]{0,80}?(?:regain|compliance|cure)", sec)
    if not m:
        m = re.search(r"(?:regain|compliance)[^.]{0,120}?\b(?:until|by)\s+" + _DATE_RE.pattern, sec)
    if m:
        dm = _DATE_RE.search(m.group(0))
        deadline = iso_date(dm) if dm else ""
    return {"what": f"상장 관련 — {reason}", "who": f"거래소 {exch}" if exch else "",
            "amount": f"요건 회복 기한 {deadline}" if deadline else "", "date": first_date(sec)}


def x_401(sec: str, company: str) -> dict:
    old = new = ""
    m = re.search(r"\bdismiss\w*\s+(?:its\s+independent[^,]{0,60},\s+)?((?:[A-Z][\w&'\-]*\.?[\s,]+){1,5}?(?:LLP|P\.C\.|P\.A\.|LLC|PLLC))", sec)
    if m:
        old = clip(m.group(1), 50)
    if not old:
        m = re.search(r"((?:[A-Z][\w&'\-]*\.?[\s,]+){1,5}?(?:LLP|P\.C\.|P\.A\.|LLC|PLLC))[^.]{0,80}?\b(?:resign\w*|declin\w+ to stand)", sec)
        old = clip(m.group(1), 50) if m else ""
    m = re.search(r"\b(?:engag\w+|appoint\w+|approv\w+ the (?:engagement|appointment) of)\s+((?:[A-Z][\w&'\-]*\.?[\s,]+){1,5}?(?:LLP|P\.C\.|P\.A\.|LLC|PLLC))", sec)
    if m:
        new = clip(m.group(1), 50)
    who = f"{old or '기존 감사인'} → {new or '후임 미정·미기재'}" if (old or new) else ""
    no_dis = bool(re.search(r"\bno\s+[“\"]?disagreements", sec, re.I))
    what = "감사인(회계법인) 교체" + (" — 회사·감사인 간 이견 없음 명시" if no_dis else "")
    return {"what": what, "who": who, "amount": "", "date": first_date(sec)}


def x_402(sec: str, company: str) -> dict:
    periods = []
    for m in re.finditer(r"(?:quarter(?:ly period)?s?|fiscal years?|years?|periods?|six months|nine months|three months)"
                         r"\s+ended\s+" + _DATE_RE.pattern, sec):
        d = iso_date(_DATE_RE.search(m.group(0)))
        if d and d not in periods:
            periods.append(d)
    if not periods:
        for m in re.finditer(r"balance sheet as of\s+" + _DATE_RE.pattern, sec):
            d = iso_date(_DATE_RE.search(m.group(0)))
            if d and d not in periods:
                periods.append(d)
    who = "감사위원회 결정" if re.search(r"audit committee", sec, re.I) else ""
    what = "과거 재무제표 신뢰 불가(재작성 예정)"
    amount = ("대상 기간 " + ", ".join(periods[:3]) + (f" 외 {len(periods) - 3}건" if len(periods) > 3 else "")) if periods else ""
    return {"what": what, "who": who, "amount": amount, "date": first_date(sec)}


def x_501(sec: str, company: str) -> dict:
    return {"what": "지배권 변경", "who": "", "amount": money_near(sec, ("consideration of", "per share", "aggregate")),
            "date": first_date(sec)}


def _people(sec: str) -> list[dict]:
    """5.02: 사람 이름 + 직책 + 사임/선임. 이름은 본문에 'Mr./Ms./Dr. 성' 으로 다시 나오는 것만(오탐 억제)."""
    honorific_last = {m.group(1) for m in re.finditer(r"\b(?:Mr|Ms|Mrs|Dr)\.?\s+([A-Z][A-Za-z'\-]+)", sec)}
    people: dict[str, dict] = {}
    for sent in sentences(sec):
        dep = _DEPART_RE.search(sent)
        app = _APPOINT_RE.search(sent)
        comp = _COMP_RE.search(sent)
        if not (dep or app or comp):
            continue
        for m in _NAME_RE.finditer(sent):
            name = m.group(1).strip()
            toks = [t.strip(".").lower() for t in name.split()]
            if any(t in _NAME_STOP for t in toks):
                continue
            last = name.split()[-1]
            if last not in honorific_last:
                continue
            key = last
            p = people.setdefault(key, {"name": name, "title": "", "action": ""})
            if len(name) > len(p["name"]):
                p["name"] = name
            # 직책: 이름 바로 뒤 ', <직책>' 또는 'as <직책>' / 'as the Company’s <직책>'.
            tail = sent[m.end(): m.end() + 160]
            tm = re.match(r",\s*(?:the\s+Company[’']s\s+)?([^,.;]{3,90})", tail)
            head = sent[max(0, m.start() - 20): m.start()]
            title_src = ""
            am = re.search(r"\bas\s+(?:the\s+)?(?:Company[’']s\s+|its\s+)?((?:[A-Z][\w\-]*\s?(?:of\s(?:the\s)?|and\s)?){1,7})", sent[m.end():])
            if tm and korean_title(tm.group(1)):
                title_src = tm.group(1)
            elif am and korean_title(am.group(1)):
                title_src = am.group(1)
            elif re.search(r"(?i)(?:a|as)\s+director\b|to\s+the\s+board|a\s+member\s+of\s+the\s+board|board\s+of\s+directors", sent):
                title_src = "director"
            t = korean_title(title_src) if title_src else ""
            if t and not p["title"]:
                p["title"] = t
            if head and not p["title"] and korean_title(head):
                p["title"] = korean_title(head)
            # 행동: 이름과 같은 문장의 동사. 사임이 먼저 나오면 사임.
            if not p["action"]:
                if dep and app:
                    p["action"] = "사임" if dep.start() < app.start() else "선임"
                elif dep:
                    p["action"] = "사임" if not re.search(r"retire", dep.group(0), re.I) else "퇴임"
                elif app:
                    p["action"] = "선임"
                elif comp:
                    p["action"] = "보수·계약 변경"
    return list(people.values())


def x_502(sec: str, company: str) -> dict:
    people = _people(sec)
    if not people:
        kind = "보수·계약 변경" if _COMP_RE.search(sec) and not (_DEPART_RE.search(sec) or _APPOINT_RE.search(sec)) else ""
        return {"what": "임원·이사 변동" + (f" — {kind}" if kind else ""), "who": "", "amount": "", "date": first_date(sec)}
    counts = {}
    for p in people:
        counts[p["action"] or "변동"] = counts.get(p["action"] or "변동", 0) + 1
    order = ("사임", "퇴임", "선임", "보수·계약 변경", "변동")
    what = "임원·이사 변동 — " + " · ".join(f"{k} {counts[k]}명" for k in order if k in counts)
    who = ", ".join(f"{p['name']}({p['title']}) {p['action']}".replace("() ", " ").strip() for p in people[:3])
    if len(people) > 3:
        who += f" 외 {len(people) - 3}명"
    amount = ""
    m = re.search(r"base salary[^.]{0,40}?(\$\s?\d[\d,]*(?:\.\d+)?)", sec, re.I)
    if m:
        amount = f"기본급 {m.group(1)}"
    return {"what": what, "who": who, "amount": amount, "date": first_date(sec)}


def x_203_wrap(items):
    return lambda sec, company: x_203(sec, company, items)


def x_302(sec: str, company: str) -> dict:
    shares = ""
    m = re.search(r"(\d{1,3}(?:,\d{3})+)\s+shares", sec)
    if m:
        shares = f"{m.group(1)}주"
    amount = money_near(sec, ("aggregate purchase price of", "gross proceeds of", "purchase price of", "for aggregate"))
    return {"what": "미등록 증권 발행(사모)" + (f" — {shares}" if shares else ""), "who": "", "amount": amount,
            "date": first_date(sec)}


def x_507(sec: str, company: str) -> dict:
    kind = "연례 주주총회" if re.search(r"annual\s+meeting", sec, re.I) else "임시 주주총회" if re.search(r"special\s+meeting", sec, re.I) else "주주총회"
    meet = ""
    m = re.search(r"(?:meeting[^.]{0,200}?\bheld\b[^.]{0,120}?\bon\s+|On\s+)" + _DATE_RE.pattern, sec)
    if m:
        dm = _DATE_RE.search(m.group(0))
        meet = iso_date(dm) if dm else ""
    props = {int(x) for x in re.findall(r"\bProposal\s+(?:No\.\s*)?(\d{1,2})\b", sec)}
    words = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    n = max(props) if props else 0
    m2 = re.search(r"\b(two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(?:proposals|matters)\b", sec, re.I)
    if m2:
        v = m2.group(1).lower()
        n = max(n, int(v) if v.isdigit() else words.get(v, 0))
    # "(i) Elected … (ii) Approved …" 처럼 로마 숫자 목록으로 안건을 적는 제출사도 많다.
    romans = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10}
    listed = {romans[x.lower()] for x in re.findall(r"\((i{1,3}|iv|vi{0,3}|ix|x)\)\s+[A-Z]", sec, re.I) if x.lower() in romans}
    if listed and max(listed) == len(listed):
        n = max(n, len(listed))
    words.update({"eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15})
    directors = 0
    m3 = re.search(r"\belect\w*\s+(?:the\s+following\s+|each\s+of\s+the\s+)?(\d{1,2}|" + "|".join(words) + r")\s+"
                   r"(?:directors?|nominees?|individuals?)\b", sec, re.I)
    if m3:
        v = m3.group(1).lower()
        directors = int(v) if v.isdigit() else words.get(v, 0)
    rejected = len(re.findall(r"\b(?:did\s+not\s+approve|(?:was|were)\s+not\s+(?:approved|ratified|adopted)|"
                              r"failed\s+to\s+(?:receive|pass|obtain))\b", sec, re.I))
    parts = [f"안건 {n}건" if n else "", f"이사 {directors}명 선임" if directors else "",
             f"부결 {rejected}건" if rejected else ""]
    amount = " · ".join(x for x in parts if x)
    if amount:
        amount += " (안건별 표 수는 원문)"
    return {"what": f"{kind} 투표 결과", "who": "", "amount": amount, "date": meet or first_date(sec)}


def x_503(sec: str, company: str) -> dict:
    what = "정관·내규 변경"
    if re.search(r"reverse\s+(?:stock\s+)?split", sec, re.I):
        m = re.search(r"(1-for-\d+|one-for-[a-z\-]+)", sec, re.I)
        what = "주식병합(역분할)" + (f" {m.group(1)}" if m else "")
    elif re.search(r"fiscal\s+year", sec, re.I) and re.search(r"change", sec, re.I):
        what = "회계연도 변경"
    elif re.search(r"by-?laws", sec, re.I):
        what = "내규(Bylaws) 개정"
    return {"what": what, "who": "", "amount": "", "date": first_date(sec)}


def x_801(sec: str, company: str) -> dict:
    low = sec.lower()
    if "dividend" in low and re.search(r"declar", low):
        amt = money_near(sec, ("dividend of", "dividend in the amount of", "dividend of approximately"))
        pay = ""
        m = re.search(r"payable\s+(?:on\s+)?" + _DATE_RE.pattern, sec) or re.search(r"paid\s+on\s+" + _DATE_RE.pattern, sec)
        if m:
            pay = iso_date(_DATE_RE.search(m.group(0)))
        rec = ""
        m = re.search(r"of\s+record\s+(?:as\s+of\s+|at\s+the\s+close\s+of\s+business\s+on\s+|on\s+)" + _DATE_RE.pattern, sec)
        if m:
            rec = iso_date(_DATE_RE.search(m.group(0)))
        extra = " · ".join(x for x in (f"기준일 {rec}" if rec else "", f"지급일 {pay}" if pay else "") if x)
        return {"what": "배당 결의" + (f" — 주당 {re.sub(r' per (?:share|unit)$', '', amt)}" if amt else ""), "who": "", "amount": extra, "date": first_date(sec)}
    if re.search(r"repurchase|buyback", low) and re.search(r"authori[sz]", low):
        amt = money_near(sec, ("up to", "repurchase of up to", "additional", "authorized"))
        return {"what": "자사주 매입 프로그램", "who": "", "amount": amt, "date": first_date(sec)}
    if re.search(r"\bpric(?:ed|ing)\b[^.]{0,80}\boffering\b", low):
        amt = money_near(sec, ("aggregate principal amount of", "gross proceeds of", "offering of", "aggregate"))
        notes = _NOTES_RE.findall(sec)
        return {"what": "증권 공모 가격 결정" + (f" — {notes[0]}" if notes else ""), "who": "", "amount": amt,
                "date": first_date(sec)}
    if re.search(r"\bsettle(?:ment|d)\b", low) and re.search(r"litigation|lawsuit|complaint|court", low):
        amt = money_near(sec, ("settlement of", "pay", "amount of"))
        return {"what": "소송 합의", "who": "", "amount": amt, "date": first_date(sec)}
    return {}


def x_701(sec: str, company: str) -> dict:
    low = sec.lower()
    if "investor presentation" in low or "presentation" in low and "investor" in low:
        return {"what": "투자자 프레젠테이션 자료 공개(Reg FD)", "who": "", "amount": "", "date": first_date(sec)}
    if "press release" in low:
        return {"what": "보도자료 제출(Reg FD)", "who": "", "amount": "", "date": first_date(sec)}
    return {}


def summarize_8k(codes, text: str, company: str = "") -> dict | None:
    """codes: 이 8-K 의 Item 코드 목록. text: 주 문서 텍스트(html_to_text 결과)."""
    items = split_items(text)
    wanted = [c for c in PRIORITY if c in set(codes or [])]
    extractors = {
        "1.01": x_101, "1.02": x_102, "1.03": x_103, "2.01": x_201, "2.03": x_203_wrap(items), "2.05": x_205, "2.06": x_206,
        "3.01": x_301, "3.02": x_302, "4.01": x_401, "4.02": x_402, "5.01": x_501, "5.02": x_502,
        "5.03": x_503, "5.07": x_507, "7.01": x_701, "8.01": x_801,
    }
    for code in wanted:
        sec = items.get(code)
        if not sec or len(sec) < 40:
            continue
        # 다른 Item 을 참조만 하는 절(“Item 1.01 의 내용을 여기 포함한다”)은 그 Item 본문을 쓴다.
        ref = incorporates(sec)
        if ref and ref in items and len(sec) < 400 and code not in ("2.03",):
            sec = items[ref] + " " + sec
        try:
            got = extractors[code](sec, company) or {}
        except Exception:  # noqa: BLE001 — 한 절의 파싱 실패로 전체를 버리지 않는다
            got = {}
        if not got:
            continue
        out = {"item": code,
               "what": clip(got.get("what", ""), 110),
               "who": clip(got.get("who", ""), 150),
               "amount": clip(got.get("amount", ""), 90),
               "date": got.get("date", "") or ""}
        # 템플릿 제목만 있고 아무것도 못 뽑았으면 요약으로 치지 않는다(제목은 칩이 이미 보여 준다).
        base_only = not out["who"] and not out["amount"] and " — " not in out["what"]
        if base_only and code in ("1.01", "1.02", "2.03", "5.02", "2.06", "5.01", "5.03"):
            continue
        return out
    return None
