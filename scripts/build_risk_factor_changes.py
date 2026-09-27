#!/usr/bin/env python3
"""10-K 위험요인(Item 1A) 전년 대비 변화 — SEC EDGAR 원문, LLM 없음.

근거: Cohen·Malloy·Nguyen "Lazy Prices"(NBER w25084, 2018) — 연차보고서 문장이 전년 대비 많이
바뀐 회사가 이후 수익률이 낮았다(특히 위험요인 절). 이 빌더는 그 '변화 크기'를 사실로 보여 줄 뿐
예측·매매 신호로 쓰지 않는다(화면에도 그렇게 적는다).

처리
1. 시총 상위 N(기본 500, ETF 제외) 종목의 CIK 를 SEC company_tickers.json 으로 찾는다.
2. 증분: EDGAR 일별 색인(form.YYYYMMDD.idx)에서 지난 스캔 이후 10-K·20-F 를 낸 CIK 와,
   아직 결과가 없는 종목만 이번 대상으로 삼는다(없는 종목부터 — step_budget.missing_first 와 같은 원칙).
3. submissions JSON 에서 최근 두 개의 연차보고서(10-K/10-K405/10-KT, 없으면 20-F; /A 수정본 제외)의
   주 문서 HTML 을 받아 텍스트로 풀고, Item 1A Risk Factors 구간(20-F 는 Item 3.D)을 잘라낸다.
   목차·본문 교차참조에도 같은 제목이 나오므로 '시작 후보 × 다음 끝 표지(Item 1B/1C/2, 20-F 는 Item 4)'
   조합 중 검사(2,500자↑·문서의 60%↓·위험 표현이 든 문단 50%↑)를 통과한 가장 긴 구간을 고른다.
   Item 표지가 없는 통합 연차보고서(ASML·TSM 20-F, INTC 10-K)는 'Risk Factors' 단독 제목으로 찾되
   꼬리를 위험 표현 빈도로 자르고, 빈도가 묽은(목차부터 CEO 서한까지 삼킨) 후보는 버린다(extract_risk_section).
   은행처럼 recent 에 10-K 가 하나뿐이면 과거 submissions 파일 중 전년 제출일 부근 것만 더 본다(_older_files).
4. 문단 단위로 정규화(쪽 번호·반복 머리말 제거, 쪽 넘김으로 끊긴 문단 잇기)한 뒤
   - 전체 유사도: 단어 빈도 코사인·단어 집합 Jaccard(논문의 Sim_Cosine·Sim_Jaccard, 숫자는 빼고 비교)
   - 문단 대응: 정확히 같으면 그대로, 아니면 단어 집합 Jaccard 로 후보 3개를 고른 뒤 difflib 비율로
     그대로(≥0.9)·수정(0.5~0.9, 0.75 미만은 '크게 바뀐')·새 문단(<0.5)·삭제 문단을 가른다.
   - 분량: 단어 수 전년 대비.
5. 종목별 샤드 data/risk_factors/tk/<T>.json(새·삭제·크게 바뀐 문단 목록, 원문 영어 첫 문장) +
   인덱스 data/risk_factors/index.json/.js(window.US_RISK_FACTORS_INDEX — 종목별 유사도·개수·제출일·
   변화 크기 백분위(매 실행 전 종목으로 다시 계산), 구간 추출 실패 사유, 증분 상태)를 쓴다. 브라우저는 인덱스만 lazy 로 받고 샤드는 종목을 열 때 하나만 fetch.

실행: py scripts/build_risk_factor_changes.py [--top 500] [--only AAPL,MSFT] [--time-budget-min 60] [--push]
SEC 예의(User-Agent·초당 ~8회)는 sec_client.sec_get 을 그대로 쓴다.
"""
from __future__ import annotations

import argparse
import difflib
import json
import math
import re
import sys
import time
from collections import Counter
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sec_client as sec  # noqa: E402
from step_budget import StepBudget  # noqa: E402

DIR = ROOT / "data" / "risk_factors"
TK_DIR = DIR / "tk"
OUT_JSON = DIR / "index.json"
OUT_JS = DIR / "index.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{doc}"
SCHEMA = 1
SOURCE = "SEC EDGAR 10-K Item 1A · 20-F Item 3.D 원문"
METHOD = ("단어 빈도 코사인·단어 집합 Jaccard(숫자 제외) + 문단 대응(difflib): "
          "그대로 ≥0.9 · 수정 0.5~0.9(0.75 미만 '크게 바뀐') · 새 문단 <0.5")
PAPER_URL = "https://www.nber.org/papers/w25084"

ANNUAL_10K = {"10-K", "10-K405", "10-KT"}
ANNUAL_20F = {"20-F"}
INDEX_FORMS = ANNUAL_10K | ANNUAL_20F
MAX_SCAN_GAP_DAYS = 30        # 색인 스캔 공백이 이보다 길면 전 종목 submissions 재확인
RESCAN_OVERLAP_DAYS = 3
MIN_SECTION_CHARS = 2500      # 이보다 짧으면 '구간을 못 찾음'(목차·교차참조만 잡힌 경우)
MAX_SECTION_CHARS = 900_000   # 이보다 길면 끝 표지를 놓친 것으로 본다
MIN_PARA_WORDS = 8
SAME_RATIO = 0.90
CHANGED_RATIO = 0.50
BIG_CHANGE_RATIO = 0.75
LIST_CAP = {"added": 40, "removed": 40, "changed": 25}
FIRST_SENTENCE_CHARS = 260
INDEX_COLS = ["cos", "jac", "add", "rem", "chg", "big", "same", "w", "wPrev", "filed", "prevFiled", "form", "pct"]
# pct = 변화 크기 백분위(0~100): 인덱스의 다른 종목 가운데 코사인 유사도가 이 종목보다 높은(= 덜 바뀐) 비율.
# 90 이면 '비교 가능한 종목의 90%보다 많이 바뀌었다'. 매 실행 전 종목을 다시 센다.


# ────────────────────────────── HTML → 줄 ──────────────────────────────
BLOCK_TAGS = {
    "p", "div", "br", "tr", "li", "ul", "ol", "table", "section", "article", "blockquote", "center",
    "h1", "h2", "h3", "h4", "h5", "h6", "dt", "dd", "hr", "title", "pre", "page",
}
SKIP_TAGS = {"script", "style", "ix:header", "head", "noscript"}
CELL_TAGS = {"td", "th"}


class _TextExtractor(HTMLParser):
    """블록 태그마다 줄을 끊고 표 칸은 공백으로 잇는다. ix:header(XBRL 숨김 데이터)·script·style 은 버린다."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_tag = ""
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self.skip_depth:
            if tag == self.skip_tag:
                self.skip_depth += 1
            return
        style = ""
        for k, v in attrs:
            if k and k.lower() == "style" and v:
                style = v.replace(" ", "").lower()
        if tag in SKIP_TAGS or "display:none" in style:
            if tag not in ("br", "hr"):
                self.skip_tag, self.skip_depth = tag, 1
            return
        if tag in BLOCK_TAGS:
            self.parts.append("\n")
        elif tag in CELL_TAGS:
            self.parts.append(" ")

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if not self.skip_depth and tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.skip_depth:
            if tag == self.skip_tag:
                self.skip_depth -= 1
            return
        if tag in BLOCK_TAGS:
            self.parts.append("\n")
        elif tag in CELL_TAGS:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.skip_depth:
            self.parts.append(data)


_SPACE_CHARS = re.compile(r"[  -​  　\t\r\f\v]+")
_MULTI_SPACE = re.compile(r" {2,}")


def html_to_lines(html: str) -> list[str]:
    """HTML 원문 → 공백 정규화된 비어 있지 않은 줄 목록."""
    if "<" not in html[:2000] and "<" not in html:
        text = html
    else:
        p = _TextExtractor()
        try:
            p.feed(html)
            p.close()
        except Exception:
            pass
        text = "".join(p.parts)
    text = _SPACE_CHARS.sub(" ", text)
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    text = text.replace("–", "-").replace("—", "-").replace("‒", "-").replace("‑", "-")
    out = []
    for raw in text.split("\n"):
        line = _MULTI_SPACE.sub(" ", raw).strip()
        if line:
            out.append(line)
    return out


# ────────────────────────────── 구간 추출 ──────────────────────────────
def _key(line: str) -> str:
    """제목 비교용: 소문자, 앞뒤 기호 제거, 공백 하나로."""
    s = line.lower().strip()
    s = re.sub(r"^[\s\-•*·|]+", "", s)
    return re.sub(r"\s+", " ", s)


_ITEM_1A = re.compile(r"^item\s*1\s*a\b\s*[\.:\-]?\s*(?:\.\s*)?(risk\s*factors)?", re.I)
_ITEM_1A_ALONE = re.compile(r"^item\s*1\s*a\s*[\.:\-]?\s*$", re.I)
_RISK_FACTORS = re.compile(r"^risk\s*factors\b", re.I)
_END_10K = re.compile(
    r"^(item\s*1\s*b\b|item\s*1\s*c\b|item\s*2\s*[\.:\-]?\s*(properties|description of propert)|item\s*2\s*[\.:\-]?\s*$"
    r"|unresolved\s+(sec\s+)?staff\s+comments\b)", re.I)
_START_20F = re.compile(
    r"^(item\s*3\s*[\.:\-]?\s*(key\s+information\s*[\.:\-]?\s*)?)?(3\s*\.?\s*)?d\s*[\.:\)\-]?\s*risk\s*factors\b", re.I)
_END_20F = re.compile(r"^(item\s*4\b|item\s*4\s*[\.:\-]?\s*information\s+on\s+the\s+company|4\s*[\.:]?\s*information\s+on\s+the\s+company)", re.I)
# 제목 대체 경로의 끝 표지 — Item 표지에 더해 사이버보안(10-K Item 1C 에 해당하는 절이 통합 보고서에선 제목만 남는다).
_END_SECURITY = r"|cyber\s*security(\s+risk\s+management)?\.?$|information\s+security\.?$"
_END_HEADING_10K = re.compile(_END_10K.pattern[:-1] + _END_SECURITY + ")", re.I)
_END_HEADING_20F = re.compile(_END_20F.pattern[:-1] + _END_SECURITY + ")", re.I)
_PAGE_NO = re.compile(r"^(page\s*)?[\-\s]*[ivxlc\d]{1,6}[\-\s]*$", re.I)


def _start_candidates(lines: list[str], form: str) -> list[int]:
    out = []
    for i, line in enumerate(lines):
        if len(line) > 160:
            continue
        k = _key(line)
        if form == "20-F":
            if _START_20F.match(k):
                out.append(i)
            continue
        m = _ITEM_1A.match(k)
        if m and m.group(1):
            out.append(i)
        elif _ITEM_1A_ALONE.match(k) and i + 1 < len(lines) and _RISK_FACTORS.match(_key(lines[i + 1])):
            out.append(i + 1)
    return out


def _end_after(lines: list[str], start: int, end_re) -> int | None:
    for j in range(start + 1, len(lines)):
        line = lines[j]
        if len(line) > 200:
            continue
        if end_re.match(_key(line)):
            return j
    return None


# 위험요인 문단에 거의 반드시 나오는 조동사·표현. 통합 연차보고서(ASML 20-F 등)처럼 'Risk factors' 제목이
# 목차·상호참조표에만 있고 본문은 다른 절에 흩어진 문서에서, 제목부터 끝 표지까지 잘라 낸 엉뚱한 구간을 거른다.
_RISK_VOCAB = re.compile(r"\b(could|may|might|adverse(ly)?|risks?|uncertain(ty|ties)?|harm(ed)?|impair(ed)?|fail(ure)?|unable)\b", re.I)
MIN_RISK_DENSITY = 0.50     # 본문 길이(20단어↑) 문단 중 위 표현이 든 비율 하한 — 실제 10-K 표본은 0.7~1.0, 엉뚱한 구간은 0.2~0.35
MAX_SECTION_SHARE = 0.60    # 문서 전체 글자의 60%를 넘으면 끝 표지를 놓친 것


def risk_density(body: list[str]) -> float:
    """본문 길이 문단(줄) 가운데 위험 표현이 든 비율(20단어 이상이 5개 미만이면 1.0 — 판단 보류)."""
    long_lines = [x for x in body if len(x.split()) >= 20]
    if len(long_lines) < 5:
        return 1.0
    return sum(1 for x in long_lines if _RISK_VOCAB.search(x)) / len(long_lines)


def _span_verdict(lines: list[str], span: tuple[int, int], total: int) -> str:
    """'ok' 또는 실패 사유. 목차 항목(몇 줄)·끝 표지를 놓친 구간·위험요인이 아닌 구간을 거른다."""
    body = lines[span[0] + 1:span[1]]
    chars = sum(len(x) for x in body)
    if chars < MIN_SECTION_CHARS:
        return "too_short"
    if chars > MAX_SECTION_CHARS or chars > total * MAX_SECTION_SHARE:
        return "too_long"
    if risk_density(paragraphs(body)) < MIN_RISK_DENSITY:
        return "not_risk_text"
    return "ok"


# 실패 사유 우선순위 — 여러 후보가 모두 탈락하면 가장 '가까웠던' 사유를 남긴다.
_FAIL_RANK = {"not_risk_text": 3, "too_long": 2, "too_short": 1, "no_section": 0}


TRIM_WINDOW_WORDS = 500
TRIM_MIN_RATE = 1.5         # 위험 표현 / 100단어 — 실제 위험요인 창은 1.8~6, 지배구조·보수 절은 0~1.2


def trim_tail(lines: list[str], s: int, e: int) -> int:
    """제목으로 찾은 구간의 꼬리 자르기: 500단어 창마다 위험 표현 빈도를 재서, 마지막으로 기준을 넘은
    창의 끝 줄에서 끊는다. 통합 연차보고서는 끝 표지(Item 4)가 한참 뒤라 지배구조·보수 절까지 딸려 온다."""
    words: list[int] = []   # 단어마다 줄 번호
    for i in range(s + 1, e):
        words.extend([i] * len(lines[i].split()))
    last_end = None
    for k in range(0, len(words), TRIM_WINDOW_WORDS):
        chunk = words[k:k + TRIM_WINDOW_WORDS]
        first, last = chunk[0], chunk[-1]
        if risk_rate(" ".join(lines[first:last + 1])) >= TRIM_MIN_RATE:
            last_end = last + 1
    return min(e, last_end) if last_end else e


def risk_rate(text: str) -> float:
    """위험 표현 수 / 100단어."""
    n = len(text.split())
    return 100 * len(_RISK_VOCAB.findall(text)) / n if n else 0.0


RATE_KEEP = 0.85   # 제목 대체 경로: 최고 빈도의 85% 이상인 후보 중에서만 가장 긴 것


def _pick_span(lines: list[str], starts: list[int], end_re, total: int, trim: bool = False) -> tuple[tuple[int, int] | None, str]:
    """시작 후보마다 다음 끝 표지까지 자른 구간 중 검사를 통과한 가장 긴 것. (구간 | None, 사유).

    trim=True(제목 대체 경로)이면 꼬리를 자르고, 위험 표현 빈도가 최고 후보의 85% 이상인 후보 중에서만
    가장 긴 것을 고른다 — 통합 연차보고서는 목차의 같은 제목부터 자르면 CEO 서한·전략 장까지 삼켜
    길이만으로는 이기지만 빈도가 묽어진다. 쪽 머리말로 반복되는 제목(뒤쪽 부분 구간들)은 빈도가 비슷해
    가장 긴(= 진짜 시작) 쪽이 남는다.
    """
    passing, why = [], "no_section"
    for s in starts:
        e = _end_after(lines, s, end_re)
        if e is None:
            continue
        if trim:
            e = trim_tail(lines, s, e)
        verdict = _span_verdict(lines, (s, e), total)
        if verdict != "ok":
            if _FAIL_RANK.get(verdict, 0) > _FAIL_RANK.get(why, 0):
                why = verdict
            continue
        body = lines[s + 1:e]
        passing.append(((s, e), sum(len(x) for x in body), risk_rate(" ".join(body)) if trim else 0.0))
    if not passing:
        return None, why
    if trim:
        top = max(r for _, _, r in passing)
        passing = [x for x in passing if x[2] >= top * RATE_KEEP]
    return max(passing, key=lambda x: x[1])[0], "ok"


def extract_risk_section(lines: list[str], form: str) -> tuple[list[str] | None, str]:
    """(구간 줄 목록 | None, 방법 'item'·'heading' 또는 실패 사유). 제목 줄은 빼고 본문만.

    목차·본문 교차참조에도 같은 제목이 나오므로 '시작 후보 × 다음 끝 표지' 조합 가운데 검사를 통과한
    가장 긴 구간을 고른다(목차 항목은 몇 줄뿐이라 too_short 로 빠진다). Item 표지로 못 찾으면
    'Risk Factors' 단독 제목(연차보고서 본문을 10-K 에 합친 은행 등)으로 한 번 더 찾는다.
    """
    is20f = form in ANNUAL_20F
    end_re = _END_20F if is20f else _END_10K
    total = sum(len(x) for x in lines) or 1
    span, why = _pick_span(lines, _start_candidates(lines, "20-F" if is20f else "10-K"), end_re, total)
    how = "item"
    if span is None:
        alt = [i for i, line in enumerate(lines) if len(line) <= 40 and re.fullmatch(r"risk\s*factors\.?", _key(line))]
        span, why2 = _pick_span(lines, alt, _END_HEADING_20F if is20f else _END_HEADING_10K, total, trim=True)
        how = "heading"
        if span is None:
            why = why2 if _FAIL_RANK.get(why2, 0) > _FAIL_RANK.get(why, 0) else why
            return None, why
    return lines[span[0] + 1:span[1]], how


# ────────────────────────────── 문단 ──────────────────────────────
_TERMINAL = re.compile(r"[\.\?\!:;\"')\]]$")
_WORD = re.compile(r"[a-z][a-z'\-]*[a-z]|[a-z]")


def words_of(text: str) -> list[str]:
    """비교용 단어(소문자 영문만 — 숫자·연도는 빼서 '2024→2025' 같은 갱신을 변화로 세지 않는다)."""
    return _WORD.findall(text.lower())


def paragraphs(body: list[str]) -> list[str]:
    """구간 줄 → 문단. 쪽 번호·반복 머리말/꼬리말을 지우고, 쪽 넘김으로 끊긴 문단을 잇는다."""
    counts = Counter(body)
    kept = []
    for line in body:
        k = _key(line)
        if _PAGE_NO.match(k) or k in ("table of contents", "index", "back to contents"):
            continue
        if counts[line] >= 3 and len(line) < 150:
            continue   # 쪽마다 반복되는 머리말·꼬리말("Apple Inc. | 2025 Form 10-K | 12")
        kept.append(line)
    merged: list[str] = []
    for line in kept:
        # 앞 줄이 문장 부호로 끝나지 않았는데 다음 줄이 소문자로 시작하거나, 앞 줄이 본문 길이(120자↑)면
        # 쪽 넘김·줄 넘김으로 끊긴 한 문단이다. 짧은 무리 제목("Risks Relating to Our Business")은 잇지 않는다.
        if merged and not _TERMINAL.search(merged[-1]) and (line[:1].islower() or len(merged[-1]) >= 120):
            merged[-1] = f"{merged[-1]} {line}"
        else:
            merged.append(line)
    return merged


_ABBR_END = re.compile(r"(?:\b(?:U\.S|U\.K|Inc|Corp|Co|Ltd|No|Nos|e\.g|i\.e|vs|Mr|Ms|Dr|St|approx|et al|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)|\b[A-Z])\.$")


def first_sentence(text: str, cap: int = FIRST_SENTENCE_CHARS) -> str:
    """문단의 첫 문장(약어 뒤 마침표는 넘긴다). 길면 cap 에서 단어 경계로 자른다."""
    for m in re.finditer(r"[\.\?\!](?=\s+[\"'(]?[A-Z])", text):
        head = text[:m.end()]
        if _ABBR_END.search(head):
            continue
        text = head
        break
    if len(text) > cap:
        cut = text[:cap].rsplit(" ", 1)[0]
        text = cut.rstrip(",;:") + " …"
    return text


def looks_like_heading(text: str) -> bool:
    """위험요인 제목(대개 굵은 한 문장) 추정: 한 문장이고 70단어 이하."""
    n = len(text.split())
    if n > 70:
        return False
    return first_sentence(text, cap=10_000) == text.strip()


# ────────────────────────────── 비교 ──────────────────────────────
def cosine_sim(a: list[str], b: list[str]) -> float | None:
    if not a or not b:
        return None
    ca, cb = Counter(a), Counter(b)
    dot = sum(v * cb.get(k, 0) for k, v in ca.items())
    na = math.sqrt(sum(v * v for v in ca.values()))
    nb = math.sqrt(sum(v * v for v in cb.values()))
    return dot / (na * nb) if na and nb else None


def jaccard_sim(a, b) -> float | None:
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return None
    return len(sa & sb) / len(sa | sb)


_TOKEN = re.compile(r"\S+")


def _keyed_tokens(text: str) -> list[tuple[str, int, int]]:
    """원문 토큰(공백 단위)과 비교 키(영문 소문자만). 키가 빈 토큰(숫자·기호만)은 비교에서 빠지지만
    원문 구간을 자를 때는 사이에 그대로 남는다 — 새로 들어간 구절을 대소문자·숫자까지 원문대로 보여 준다."""
    out = []
    for m in _TOKEN.finditer(text):
        k = re.sub(r"[^a-z]", "", m.group(0).lower())
        if k:
            out.append((k, m.start(), m.end()))
    return out


def _inserted_phrases(old_text: str, new_text: str, limit: int = 2, min_words: int = 5, cap: int = 200) -> list[str]:
    """새 문단에 새로 들어간 구절(가장 긴 것부터, 원문 그대로). difflib opcodes 의 insert·replace 구간."""
    old = [k for k, _, _ in _keyed_tokens(old_text)]
    new_tok = _keyed_tokens(new_text)
    new = [k for k, _, _ in new_tok]
    sm = difflib.SequenceMatcher(None, old, new, autojunk=False)
    runs = []
    for op, _i1, _i2, j1, j2 in sm.get_opcodes():
        if op in ("insert", "replace") and j2 - j1 >= min_words:
            runs.append((j2 - j1, j1, j2))
    runs.sort(key=lambda r: (-r[0], r[1]))
    out = []
    for _n, j1, j2 in runs[:limit]:
        s = new_text[new_tok[j1][1]:new_tok[j2 - 1][2]].strip()
        if len(s) > cap:
            s = s[:cap].rsplit(" ", 1)[0].rstrip(",;:") + " …"
        out.append(s)
    return out


def _best_matches(src_sets, src_words, dst_sets, dst_words, dst_exact):
    """src 문단마다 (가장 닮은 dst 인덱스, difflib 비율). 정확히 같으면 1.0."""
    # 단어 → dst 문단 역색인(후보를 빨리 좁힌다)
    inv: dict[str, list[int]] = {}
    for j, s in enumerate(dst_sets):
        for w in s:
            inv.setdefault(w, []).append(j)
    out = []
    for i, s in enumerate(src_sets):
        key = " ".join(src_words[i])
        if key in dst_exact:
            out.append((dst_exact[key], 1.0))
            continue
        hits: Counter = Counter()
        for w in s:
            for j in inv.get(w, ()):
                hits[j] += 1
        cands = []
        for j, inter in hits.items():
            union = len(s) + len(dst_sets[j]) - inter
            cands.append((inter / union if union else 0.0, j))
        cands.sort(reverse=True)
        best_j, best_r = -1, 0.0
        for jac, j in cands[:3]:
            if jac < 0.15:
                break
            sm = difflib.SequenceMatcher(None, src_words[i], dst_words[j], autojunk=False)
            if sm.quick_ratio() <= best_r:
                continue
            r = sm.ratio()
            if r > best_r:
                best_j, best_r = j, r
        out.append((best_j, best_r))
    return out


def compare_sections(prev_paras: list[str], cur_paras: list[str]) -> dict:
    """두 해의 위험요인 문단 목록 비교. 순수 함수(테스트 대상)."""
    def usable(ps):
        rows = []
        for p in ps:
            w = words_of(p)
            if len(w) >= MIN_PARA_WORDS:
                rows.append((p, w))
        return rows

    prev = usable(prev_paras)
    cur = usable(cur_paras)
    all_prev = [w for _, ws in prev for w in ws]
    all_cur = [w for _, ws in cur for w in ws]
    prev_sets = [set(ws) for _, ws in prev]
    cur_sets = [set(ws) for _, ws in cur]
    prev_words = [ws for _, ws in prev]
    cur_words = [ws for _, ws in cur]
    prev_exact = {}
    for j, ws in enumerate(prev_words):
        prev_exact.setdefault(" ".join(ws), j)
    cur_exact = {}
    for j, ws in enumerate(cur_words):
        cur_exact.setdefault(" ".join(ws), j)

    fwd = _best_matches(cur_sets, cur_words, prev_sets, prev_words, prev_exact)
    back = _best_matches(prev_sets, prev_words, cur_sets, cur_words, cur_exact)

    added, changed = [], []
    same = changed_n = big_n = 0
    for i, (j, r) in enumerate(fwd):
        text = cur[i][0]
        if r >= SAME_RATIO:
            same += 1
        elif r >= CHANGED_RATIO:
            changed_n += 1
            if r < BIG_CHANGE_RATIO:
                big_n += 1
                changed.append({"t": first_sentence(text), "r": round(r, 3),
                                "ins": _inserted_phrases(prev[j][0], text), "i": i})
        else:
            added.append({"t": first_sentence(text), "h": 1 if looks_like_heading(text) else 0,
                          "w": len(cur_words[i]), "i": i})
    removed = []
    for j, (_i, r) in enumerate(back):
        if r < CHANGED_RATIO:
            text = prev[j][0]
            removed.append({"t": first_sentence(text), "h": 1 if looks_like_heading(text) else 0,
                            "w": len(prev_words[j]), "i": j})

    cos = cosine_sim(all_prev, all_cur)
    jac = jaccard_sim(all_prev, all_cur)
    changed.sort(key=lambda x: x["r"])
    return {
        "cos": round(cos, 4) if cos is not None else None,
        "jac": round(jac, 4) if jac is not None else None,
        "words": len(all_cur), "wordsPrev": len(all_prev),
        "paras": len(cur), "parasPrev": len(prev),
        "counts": {"added": len(added), "removed": len(removed), "changed": changed_n,
                   "big": big_n, "same": same},
        # 제목처럼 보이는 새 문단을 앞에, 같은 무리 안에서는 문서 순서
        "added": sorted(added, key=lambda x: (-x["h"], x["i"])),
        "removed": sorted(removed, key=lambda x: (-x["h"], x["i"])),
        "changed": changed,
    }


# ────────────────────────────── SEC ──────────────────────────────
def sec_symbol(ticker: str) -> str:
    """스냅샷 BRK.B → SEC BRK-B."""
    return str(ticker).upper().replace(".", "-")


def safe_file_name(ticker: str) -> str:
    from financials_common import safe_file_name as _safe
    return _safe(ticker)


def annual_filings(cik: int, need: int = 2) -> list[dict]:
    """최근 연차보고서(원본, 수정본 제외) 최대 need 개 — 최신 먼저. 10-K 가 있으면 10-K 계열을 우선."""
    base = sec.sec_get_json(SUBMISSIONS_URL.format(cik=cik))
    rows = _annual_rows(base.get("filings", {}).get("recent", {}), cik)
    if len(rows) < need:
        for name in _older_files(base.get("filings", {}).get("files") or [], rows):
            try:
                rows += _annual_rows(sec.sec_get_json(f"https://data.sec.gov/submissions/{name}"), cik)
            except Exception:
                break
            if len(rows) >= need:
                break
    rows.sort(key=lambda r: r["filed"], reverse=True)
    tenk = [r for r in rows if r["form"] in ANNUAL_10K]
    pick = tenk if tenk and tenk[0]["filed"] >= (rows[0]["filed"] if rows else "") else rows
    seen, out = set(), []
    for r in pick:
        if r["acc"] in seen:
            continue
        seen.add(r["acc"])
        out.append(r)
        if len(out) >= need:
            break
    return out


MAX_OLDER_FILES = 6


def _older_files(files: list[dict], rows: list[dict]) -> list[str]:
    """recent 에 연차보고서가 모자랄 때 더 볼 과거 submissions 파일 이름(최신 먼저, 최대 6개).

    증권(424B2) 발행이 잦은 은행은 recent(최근 1,000건)에 10-K 가 하나뿐이고 과거 파일 하나가 한 달치다
    (JPM 은 70개). 최신 연차보고서 제출일이 있으면 그 9~15개월 전을 덮는 파일만 고른다 — 전년 보고서는
    거기 있다. 연차보고서가 하나도 없으면 앞에서부터 본다.
    """
    named = [f for f in files if isinstance(f, dict) and f.get("name")]
    if rows:
        latest = max(r["filed"] for r in rows)
        try:
            d = date.fromisoformat(latest)
        except ValueError:
            return [f["name"] for f in named[:MAX_OLDER_FILES]]
        lo, hi = (d - timedelta(days=460)).isoformat(), (d - timedelta(days=270)).isoformat()
        named = [f for f in named if str(f.get("filingTo") or "9999") >= lo and str(f.get("filingFrom") or "") <= hi]
        named.sort(key=lambda f: str(f.get("filingTo") or ""), reverse=True)
    return [f["name"] for f in named[:MAX_OLDER_FILES]]


def _annual_rows(block: dict, cik: int) -> list[dict]:
    forms = block.get("form") or []
    n = len(forms)
    col = lambda k: block.get(k) or [""] * n  # noqa: E731
    fd, acc, doc, rd = col("filingDate"), col("accessionNumber"), col("primaryDocument"), col("reportDate")
    out = []
    for i, form in enumerate(forms):
        if form not in INDEX_FORMS or not doc[i]:
            continue
        if not str(doc[i]).lower().endswith((".htm", ".html", ".txt")):
            continue
        out.append({"form": form, "filed": fd[i], "acc": acc[i], "doc": doc[i], "period": rd[i] or "",
                    "url": ARCHIVE_URL.format(cik=cik, acc=str(acc[i]).replace("-", ""), doc=doc[i])})
    return out


def fetch_section(filing: dict) -> tuple[list[str] | None, str]:
    raw = sec.sec_get(filing["url"])
    html = raw.decode("utf-8", "replace")
    del raw
    lines = html_to_lines(html)
    del html
    body, how = extract_risk_section(lines, filing["form"])
    if body is None:
        return None, how
    return paragraphs(body), how


def filers_since(start: date, end: date) -> tuple[set[int], date | None]:
    """[start, end] 일별 색인에서 10-K/20-F 를 낸 CIK. (CIK 집합, 마지막으로 읽은 날짜)."""
    ciks: set[int] = set()
    last_ok = None
    d = start
    while d <= end:
        if d.weekday() < 5:
            try:
                for row in sec.daily_index_rows(d.isoformat(), ["10-K", "20-F"]):
                    if row["form"] in INDEX_FORMS:
                        ciks.add(int(row["cik"]))
            except Exception as exc:
                print(f"  [경고] 일별 색인 {d} 실패: {exc} — 여기서 멈추고 다음 실행에 이어 읽는다")
                break
        last_ok = d
        d += timedelta(days=1)
    return ciks, last_ok


def universe(top: int) -> list[dict]:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [s for s in (snap.get("stocks") or [])
              if s.get("ticker") and s.get("sector") not in ("EXCHANGE TRADED FUNDS", "MISC")]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    return stocks[:top] if top else stocks


# ────────────────────────────── 조립 ──────────────────────────────
FAIL_TEXT = {
    "no_prior": "비교할 이전 연차보고서가 없습니다(최근 상장 등)",
    "no_filing": "SEC 연차보고서(10-K·20-F)를 찾지 못했습니다(40-F 등 다른 서식·CIK 가 새로 바뀐 회사)",
    "no_section": "원문에서 위험요인 구간 제목을 찾지 못했습니다",
    "too_short": "위험요인 구간이 너무 짧게 잡혔습니다(다른 문서로 참조만 된 경우 등)",
    "too_long": "위험요인 구간의 끝을 찾지 못했습니다",
    "not_risk_text": "잡힌 구간이 위험요인 문단으로 보이지 않습니다(통합 연차보고서처럼 목차에만 제목이 있는 형식)",
}


def build_shard(ticker: str, name: str, cik: int, cur: dict, prev: dict, cmp: dict, how: tuple[str, str], stamp: str) -> dict:
    def meta(f, paras, words):
        return {"form": f["form"], "filed": f["filed"], "period": f["period"], "acc": f["acc"],
                "url": f["url"], "paras": paras, "words": words}
    return {
        "schema": SCHEMA, "ticker": ticker, "name": name, "cik": cik, "updatedAtKst": stamp,
        "cur": meta(cur, cmp["paras"], cmp["words"]),
        "prev": meta(prev, cmp["parasPrev"], cmp["wordsPrev"]),
        "cos": cmp["cos"], "jac": cmp["jac"], "counts": cmp["counts"],
        "extract": {"cur": how[0], "prev": how[1]},
        "added": [{k: v for k, v in x.items() if k != "i"} for x in cmp["added"][:LIST_CAP["added"]]],
        "removed": [{k: v for k, v in x.items() if k != "i"} for x in cmp["removed"][:LIST_CAP["removed"]]],
        "changed": [{k: v for k, v in x.items() if k != "i"} for x in cmp["changed"][:LIST_CAP["changed"]]],
    }


def index_row(shard: dict) -> list:
    c = shard["counts"]
    return [shard["cos"], shard["jac"], c["added"], c["removed"], c["changed"], c["big"], c["same"],
            shard["cur"]["words"], shard["prev"]["words"], shard["cur"]["filed"], shard["prev"]["filed"],
            shard["cur"]["form"]]


def with_percentiles(tickers: dict) -> dict:
    """인덱스 행 끝에 변화 크기 백분위(pct)를 다시 붙인다. 순수 함수(테스트 대상).

    동점은 절반으로 센다. 유사도가 없는 행·비교 대상이 자기뿐인 경우는 None.
    """
    base = len(INDEX_COLS) - 1
    rows = {t: list(v[:base]) for t, v in tickers.items()}
    vals = [r[0] for r in rows.values() if isinstance(r[0], (int, float))]
    n = len(vals)
    for r in rows.values():
        c = r[0]
        if not isinstance(c, (int, float)) or n < 2:
            r.append(None)
            continue
        higher = sum(1 for v in vals if v > c)
        ties = sum(1 for v in vals if v == c) - 1
        r.append(round(100 * (higher + 0.5 * ties) / (n - 1)))
    return rows


def process_ticker(ticker: str, name: str, cik: int) -> tuple[str, dict]:
    """('ok', shard) | ('fail', {reason, ...}) | ('error', {reason}) — error 는 일시 장애(다음 실행에 재시도)."""
    try:
        filings = annual_filings(cik)
    except Exception as exc:
        return "error", {"reason": f"submissions: {exc}"}
    if not filings:
        return "fail", {"reason": "no_filing"}
    if len(filings) < 2:
        f = filings[0]
        return "fail", {"reason": "no_prior", "acc": f["acc"], "filed": f["filed"], "form": f["form"], "url": f["url"]}
    cur, prev = filings[0], filings[1]
    base = {"acc": cur["acc"], "filed": cur["filed"], "form": cur["form"], "url": cur["url"]}
    try:
        cur_p, how_c = fetch_section(cur)
    except Exception as exc:
        return "error", {"reason": f"문서 {cur['acc']}: {exc}"}
    if cur_p is None:
        return "fail", {**base, "reason": how_c, "which": "cur"}
    try:
        prev_p, how_p = fetch_section(prev)
    except Exception as exc:
        return "error", {"reason": f"문서 {prev['acc']}: {exc}"}
    if prev_p is None:
        return "fail", {**base, "reason": how_p, "which": "prev", "prevUrl": prev["url"]}
    cmp = compare_sections(prev_p, cur_p)
    if not cmp["words"] or not cmp["wordsPrev"]:
        return "fail", {**base, "reason": "too_short"}
    return "ok", build_shard(ticker, name, cik, cur, prev, cmp, (how_c, how_p), sec.kst_now_str())


def load_index() -> dict:
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def run(args) -> int:
    today = sec.kst_today()
    prev_index = load_index()
    tickers: dict = dict(prev_index.get("tickers") or {})
    failed: dict = dict(prev_index.get("failed") or {})
    accs: dict = dict(prev_index.get("acc") or {})

    stocks = universe(args.top)
    if args.only:
        wanted = [t.strip().upper() for t in args.only.split(",") if t.strip()]
        by = {str(s["ticker"]).upper(): s for s in universe(0)}
        stocks = [by.get(t, {"ticker": t, "company": ""}) for t in wanted]
    print(f"[위험요인] 대상 유니버스 {len(stocks)}종목 · CIK 매핑 로드")
    _, t2c = sec.company_ticker_maps()

    scanned = None
    try:
        scanned = date.fromisoformat(str(prev_index.get("scannedThrough") or ""))
    except ValueError:
        pass
    full = args.full or scanned is None or (today - scanned).days > MAX_SCAN_GAP_DAYS
    changed: set[int] = set()
    scanned_through = scanned
    if not full and not args.only:
        start = scanned - timedelta(days=RESCAN_OVERLAP_DAYS)
        changed, last_ok = filers_since(start, today - timedelta(days=1))
        if last_ok:
            scanned_through = last_ok
        print(f"[위험요인] 일별 색인 {start}~{last_ok}: 10-K·20-F 제출 CIK {len(changed)}곳")
    elif full and not args.only:
        scanned_through = today - timedelta(days=1)
        print("[위험요인] 전체 확인(첫 실행·--full·색인 공백) — 결과가 있는 종목도 submissions 로 새 보고서 여부를 본다")

    missing, refresh = [], []
    for s in stocks:
        t = str(s["ticker"]).upper()
        cik = t2c.get(sec_symbol(t))
        if cik is None:
            continue
        have = t in tickers or t in failed
        if args.only or not have:
            missing.append((s, t, cik))
        elif full or cik in changed:
            refresh.append((s, t, cik))
    todo = missing + refresh
    print(f"[위험요인] 이번 대상 {len(todo)} (결과 없음 {len(missing)} · 새 보고서 확인 {len(refresh)})")

    budget = StepBudget(args.time_budget_min, max_consecutive_errors=15)
    stamp = sec.kst_now_str()
    TK_DIR.mkdir(parents=True, exist_ok=True)
    ok = fail = err = skipped = 0
    done = 0
    for s, t, cik in todo:
        if budget.over():
            print(f"[위험요인] {budget.reason} — {done}/{len(todo)} 에서 멈춘다(다음 실행에 이어서)")
            break
        done += 1
        # 이미 같은 보고서로 계산했으면 문서를 다시 받지 않는다(submissions 1회만).
        if t in accs and not args.force:
            try:
                latest = annual_filings(cik, need=1)
                budget.record(True)
            except Exception as exc:
                budget.record(False)
                err += 1
                print(f"  [경고] {t} submissions 실패: {exc}")
                continue
            if latest and latest[0]["acc"] == accs[t]:
                skipped += 1
                continue
        status, res = process_ticker(t, s.get("company") or "", cik)
        budget.record(status != "error")
        if status == "ok":
            atomic_write(TK_DIR / f"{safe_file_name(t)}.json", json.dumps(res, ensure_ascii=False, separators=(",", ":")) + "\n")
            tickers[t] = index_row(res)
            accs[t] = res["cur"]["acc"]
            failed.pop(t, None)
            ok += 1
            c = res["counts"]
            print(f"  {t}: cos {res['cos']} · 새 {c['added']} · 삭제 {c['removed']} · 크게 바뀜 {c['big']} "
                  f"· 단어 {res['prev']['words']}→{res['cur']['words']} ({res['extract']['cur']}/{res['extract']['prev']})")
        elif status == "fail":
            failed[t] = res
            if res.get("acc"):
                accs[t] = res["acc"]
            tickers.pop(t, None)
            fail += 1
            print(f"  {t}: 실패 {res['reason']} ({res.get('which', '')}) {res.get('url', '')}")
        else:
            err += 1
            print(f"  [경고] {t}: {res['reason']}")
    print(f"[위험요인] 계산 {ok} · 추출 실패 {fail} · 일시 오류 {err} · 같은 보고서라 건너뜀 {skipped}")

    # 인덱스는 디스크에 실제 샤드가 있는 종목만(404 방지)
    tickers = {t: v for t, v in tickers.items() if (TK_DIR / f"{safe_file_name(t)}.json").exists()}
    if not tickers:
        print("[위험요인] 결과 0종목 — 기존 파일 유지, 실패로 끝낸다")
        return 1
    tickers = with_percentiles(tickers)
    cos_vals = sorted(v[0] for v in tickers.values() if isinstance(v[0], (int, float)))
    payload = {
        "schema": SCHEMA, "updatedAtKst": stamp, "source": SOURCE, "method": METHOD, "paper": PAPER_URL,
        "count": len(tickers), "failedCount": len(failed),
        "failedByReason": dict(sorted(Counter(str(v.get("reason")) for v in failed.values()).items())),
        "medianCos": cos_vals[len(cos_vals) // 2] if cos_vals else None,
        "scannedThrough": (scanned_through or today).isoformat() if not args.only else prev_index.get("scannedThrough"),
        "cols": INDEX_COLS,
        "tickers": dict(sorted(tickers.items())),
        "failed": dict(sorted(failed.items())),
        "failText": FAIL_TEXT,
        "acc": dict(sorted(accs.items())),
    }
    from briefing_store import repository_publish_lock
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "US_RISK_FACTORS_INDEX", payload, indent=None, min_ratio=0.7)
        print(f"Wrote {OUT_JSON.relative_to(ROOT)} — {len(tickers)}종목 · 실패 {len(failed)}")
        if args.push:
            if not sec.git_publish(["data/risk_factors"], "10-K risk factor changes (SEC)"):
                print("[중단] push 실패 — 발행되지 않았다")
                return 1
    if todo and err > max(5, done * 0.3):
        print(f"[위험요인] 일시 오류 {err}/{done} — 실패로 끝낸다(저장분은 발행됨)")
        return 1
    return 0


def atomic_write(path: Path, text: str) -> None:
    from briefing_store import atomic_write_text
    atomic_write_text(path, text)


def main() -> int:
    ap = argparse.ArgumentParser(description="10-K 위험요인(Item 1A) 전년 대비 변화(SEC EDGAR)")
    ap.add_argument("--top", type=int, default=500, help="시총 상위 N 종목(ETF 제외)")
    ap.add_argument("--only", default="", help="쉼표로 구분한 티커만(로컬 확인용 — 색인 스캔 날짜는 안 바꾼다)")
    ap.add_argument("--full", action="store_true", help="결과가 있는 종목도 새 보고서 여부를 다시 확인")
    ap.add_argument("--force", action="store_true", help="같은 보고서여도 다시 계산")
    ap.add_argument("--time-budget-min", type=float, default=0, help="시간 예산(분, 0=무제한)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
