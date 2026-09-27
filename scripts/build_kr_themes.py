#!/usr/bin/env python3
"""국내 테마 분류 — DART 사업보고서 'II. 사업의 내용' 원문에 근거 문장이 있을 때만 편입.

화면: kr-themes.js — 시장 탭 '테마'(테마별 오늘/1주/1개월 등락·급상승 순위·편입 종목과 근거 문장),
      종목 분석 좌측 '이 종목의 테마' 칩(근거 툴팁). 등락 계산은 kr-themes-core.js(스냅샷 종가 기반).

왜 근거 문장인가
  국내 테마 서비스는 '누가 왜 이 종목을 넣었는지' 가 안 보인다(인포스탁 ThemeDB 의 임의 편입 논란).
  여기서는 회사가 스스로 공시한 사업보고서 문장 하나를 근거로 붙이고, 그 문장이 원문에 **실제로
  있는지(공백 정규화 후 부분 문자열)** 확인한 뒤에만 저장한다. 출처는 보고서명·접수번호(DART 링크).

흐름(실행 한 번)
  1. 사업보고서 목록: DART list.json(pblntf_detail_ty=A001, last_reprt_at=Y) 최근 15개월을 3개월 창으로
     훑어 종목별 최신 보고서 접수번호를 얻는다(corp_code 없이 부르면 창이 3개월로 제한된다, 40~60콜).
  2. 처리 대상: 시가총액 순으로, 접수번호가 바뀌었거나 규칙 버전(RULES_VERSION)이 바뀐 종목만.
     실행당 --max-docs(기본 600) 안에서 증분 — 처음 전체 태깅은 몇 주에 걸쳐 채워진다.
  3. document.xml(ZIP) 원문에서 'II. 사업의 내용' ~ 'III.' 구간만 떼어 문장/표 행으로 나누고
     scripts/kr_theme_rules.py 의 키워드·동의어 규칙으로 후보를 고른다(LLM 없음).
       high = 테마 키워드 + 사업 활동어 + 자기 지칭(당사·회사·연결실체 …)  → 규칙으로 편입
       amb  = 키워드는 있는데 남의 이야기(시장 현황·고객 산업)일 수 있는 문장 → 보류
  4. (선택) GEMINI_API_KEY 가 있으면 보류 후보만 flash-lite 로 판정한다 — 실행당 --llm-max(기본 40)건,
     한 번에 20건씩(= 최대 2콜). 판정 결과는 상태 파일에 캐시해 같은 문장을 다시 묻지 않는다.
     키가 없거나 한도면 보류는 그대로 보류(편입 안 함). 근거 문장은 LLM 이 쓰지 않는다 — 원문 문장 그대로다.
  5. 저PBR 금융은 금융업 근거 문장 + KRX 공식 PBR(data/korea/map_fundamentals.json, 빌드일) < 1.

산출물
  data/korea/themes.json/.js   window.KR_THEMES — 테마 사전·편입 종목(키워드·판정 방식)·보고서 출처·커버리지(lazy)
  data/korea/themes/<id>.json  테마별 근거 문장 {id, ev: {티커: [문장, 잘림표시]}} — 테마를 펼치거나 칩을 누를 때만 fetch
  data/korea/themes_state.json 증분 상태(종목별 처리한 접수번호·규칙 버전·보류 후보·LLM 판정 캐시). 브라우저는 안 읽는다.

실행: python scripts/build_kr_themes.py [--max-docs 600] [--llm-max 40] [--no-llm] [--only 005930,000660] [--push]
      오프라인 재현: --doc-dir DIR(<접수번호>.xml 원문) --listing-file FILE({티커: {rc, nm, dt}})
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import kr_theme_rules as R  # noqa: E402
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import DART_REGRESSION_FLOOR, write_data  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "themes.json"
OUT_JS = ROOT / "data" / "korea" / "themes.js"
STATE_JSON = ROOT / "data" / "korea" / "themes_state.json"
EV_DIR = ROOT / "data" / "korea" / "themes"     # 테마별 근거 문장 파일(<테마id>.json) — 테마를 열 때만 받는다
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
MAP_FUND = ROOT / "data" / "korea" / "map_fundamentals.json"
DOC_URL = "https://opendart.fss.or.kr/api/document.xml"
SOURCE = "DART 사업보고서 'II. 사업의 내용' 원문"
LIST_MONTHS = 15
EV_MAX = 200            # 근거 문장 최대 길이(넘으면 키워드 주변만 잘라 둔다 — 잘라도 원문의 부분 문자열)
AMB_TOP = 600           # 보류 후보(LLM 판정 대기)는 시총 상위 이 순위 안 종목만 상태에 남긴다 — 실행당 판정 40건이라
AMB_PER_TICKER = 5      # 그 밖은 몇 년이 걸려도 차례가 오지 않는다. 상태 파일 크기(커밋마다 통째로 바뀜)도 묶는다.
SECTION_MAX = 800_000   # 사업의 내용 구간 상한(문자). 보험·지주사 보고서는 수십 MB 라 구간만 본다.
LLM_MODEL = "gemini-2.5-flash-lite"
# 판정 프롬프트 버전. 프롬프트를 고치면 올린다 — 캐시 키(evidence_key)에 규칙 버전과 함께 들어가서
# 버전이 바뀐 옛 판정은 쓰이지 않고 다시 묻는다(2026-09-27 프롬프트를 조였는데 옛 '통과' 판정이 남았었다).
LLM_PROMPT_VERSION = 2
LLM_BATCH = 20
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF", "etf"}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def load_env() -> None:
    """로컬 실행용 .env (Actions 는 secrets 환경변수). 기존 값은 덮지 않는다."""
    path = ROOT / ".env"
    if not path.exists():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    except Exception:
        pass


# ───────────────────────────────────────────────────────── 규칙 컴파일

def _ascii_bounds(pat: str) -> str:
    r"""\b 를 ASCII 경계로 바꾼다. 파이썬 \b 는 한글도 단어 문자로 봐서 'NPU를' 의 NPU 를 못 찾는다.
    앞 경계에는 '.' 도 넣는다 — '8.6G IT OLED' 의 6G 가 통신 테마에 걸렸었다."""
    pat = re.sub(r"\\b(?=[A-Za-z0-9])", "(?<![A-Za-z0-9.])", pat)
    return pat.replace("\\b", "(?![A-Za-z0-9])")


def _compile(pats) -> list[re.Pattern]:
    return [re.compile(_ascii_bounds(p), re.I) for p in pats or []]


ACTIVITY_RE = re.compile(R.ACTIVITY)
SELF_RE = re.compile(R.SELF_REF)
GLOBAL_NEG_RE = re.compile(R.GLOBAL_NEG)
DOWNSTREAM_RE = re.compile(R.DOWNSTREAM_AFTER)
SUB_RE = re.compile(R.SUBSIDIARY)
PARENT_WITH_SUB_RE = re.compile(R.PARENT_WITH_SUB)
NAMED_START_RE = re.compile(R.NAMED_COMPANY_START)
MINOR_RE = re.compile(R.MINOR)
CORE_SELF_RE = re.compile(r"당사|회사는|연결실체|연결회사")
HEADING_RE = re.compile(R.HEADING_MARK)
INDUSTRY_HEAD_RE = re.compile(R.INDUSTRY_HEAD)
COMPANY_HEAD_RE = re.compile(R.COMPANY_HEAD)


def compiled_themes() -> list[dict]:
    out = []
    for t in R.THEMES:
        out.append({**t, "_strong": _compile(t.get("strong")), "_weak": _compile(t.get("weak")),
                    "_ctx": _compile(t.get("ctx")), "_neg": _compile(t.get("neg"))})
    return out


THEMES_C = compiled_themes()


# ───────────────────────────────────────────────────────── 원문 파싱(순수 함수, 테스트 대상)

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_START_RE = re.compile(r"<TITLE[^>]*>\s*(?:II|Ⅱ)\s*\.\s*사업의\s*내용\s*</TITLE>", re.I)
_END_RE = re.compile(r"<TITLE[^>]*>\s*(?:III|Ⅲ)\s*\.", re.I)
_TR_RE = re.compile(r"(<TR\b[^>]*>.*?</TR>)", re.I | re.S)
_BLOCK_RE = re.compile(r"</P>|<P\b[^>]*>|<BR\s*/?>|</TITLE>|<TITLE\b[^>]*>|</?TABLE\b[^>]*>|</?SECTION[^>]*>|</TD>|</TH>|</SPAN>", re.I)
_SENT_RE = re.compile(r"(?<=다\.)\s*|(?<=[.!?])\s+(?=[-•①-⑳□■○◦※가-힣A-Z(\[])")


def canon(fragment: str) -> str:
    """태그 → 공백, 엔티티 해제, 공백 정규화. 근거 문장 검증의 기준 텍스트도 같은 함수로 만든다."""
    return _WS_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", fragment))).strip()


def extract_business_section(doc: str) -> str | None:
    """사업보고서 원문(XML)에서 'II. 사업의 내용' TITLE 부터 다음 'III.' TITLE 전까지."""
    m = _START_RE.search(doc or "")
    if not m:
        return None
    e = _END_RE.search(doc, m.end())
    end = e.start() if e else len(doc)
    return doc[m.start(): min(end, m.start() + SECTION_MAX)]


def section_chunks(section: str) -> list[tuple[str, bool]]:
    """(텍스트, 표 행 여부) 목록. 표는 행(TR) 하나를 한 덩어리로, 나머지는 문단 경계로 자른다."""
    out: list[tuple[str, bool]] = []
    for i, part in enumerate(_TR_RE.split(section)):
        if not part:
            continue
        if i % 2 == 1:
            txt = canon(part)
            if txt:
                out.append((txt, True))
            continue
        for frag in _BLOCK_RE.split(part):
            txt = canon(frag)
            if txt:
                out.append((txt, False))
    return out


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_RE.split(text) if s and s.strip()]


def heading_mode(chunk: str) -> str | None:
    """소제목이면 'industry'(산업 일반 절) / 'company'(회사 현황 절), 아니면 None."""
    if not HEADING_RE.search(chunk):
        return None
    head = chunk[:40]
    if INDUSTRY_HEAD_RE.search(head):
        return "industry"
    if COMPANY_HEAD_RE.search(head):
        return "company"
    return None


def trim_evidence(sent: str, start: int, end: int, limit: int = EV_MAX) -> tuple[str, int]:
    """(근거, 잘림 표시). 잘림 표시 비트 1=앞이 잘림, 2=뒤가 잘림. 결과는 항상 sent 의 부분 문자열."""
    if len(sent) <= limit:
        return sent, 0
    room = max(0, limit - (end - start))
    left = max(0, start - min(90, room // 2))     # 키워드 앞은 최대 90자, 창 안에 키워드가 반드시 들어오게
    right = min(len(sent), left + limit)
    left = max(0, right - limit) if right == len(sent) else left
    if left > 0:
        sp = sent.find(" ", left, start)
        if sp != -1:
            left = sp + 1
    if right < len(sent):
        sp = sent.rfind(" ", end, right)
        if sp != -1:
            right = sp
    cut = (1 if left > 0 else 0) | (2 if right < len(sent) else 0)
    return sent[left:right].strip(), cut


def self_patterns(names) -> re.Pattern | None:
    """회사 이름(스냅샷 종목명·DART 법인명)을 자기 지칭으로 쓴다 — '두산에너빌리티는 …'."""
    alts = []
    for n in names or []:
        n = re.sub(r"\s+", "", str(n or "")).replace("(주)", "").replace("㈜", "")
        if len(n) >= 2:
            alts.append(re.escape(n))
    return re.compile("|".join(sorted(set(alts), key=len, reverse=True))) if alts else None


def classify_hit(sent: str, is_row: bool, theme: dict, *, industry: bool = False, self_extra=None) -> dict | None:
    """문장 하나 × 테마 하나 → None 또는 {lvl: 'high'|'amb', kw, start, end, rank}.

    strong 키워드가 여러 번 나오면 '편입' 조건을 만족하는 첫 위치를 쓴다(LG전자 문장 앞머리의 'OLED TV 는
    … 고객' 은 전방 이야기지만 뒤의 '당사는 OLED TV 를 …' 은 자기 사업이다).
    """
    if len(sent) < 8 or GLOBAL_NEG_RE.search(sent):
        return None
    if any(p.search(sent) for p in theme["_neg"]):
        return None
    self_ok = bool(SELF_RE.search(sent) or (self_extra is not None and self_extra.search(sent)))
    # 표의 한 행은 제품표인지 연구개발 과제표·투자계획표인지 행만 보고는 못 가린다(두산에너빌리티
    # '항공/방산 AM 제작공정 기술개발' 행이 방산으로 들어갔었다) — 표 행은 늘 '애매'.
    base_ok = (not is_row) and (not industry) and self_ok and bool(ACTIVITY_RE.search(sent)) and not MINOR_RE.search(sent)
    sub = is_subsidiary_sentence(sent, self_extra)
    first = None
    for rank, p in enumerate(theme["_strong"]):
        for m in p.finditer(sent):
            # 키워드가 고객·응용 산업으로 나열된 자리('조선업 등 기초산업의 소재로', '데이터센터용')는 후보도 아니다 —
            # 보류로 두면 LLM 이 통과시키는 일이 있었다(LS ELECTRIC 금속사업 → 조선·석유화학).
            if DOWNSTREAM_RE.search(sent[m.end():]):
                continue
            lvl = "high" if base_ok else "amb"
            hit = {"lvl": lvl, "kw": m.group(0), "start": m.start(), "end": m.end(), "rank": rank, "sub": sub}
            if lvl == "high":
                return hit
            if first is None:
                first = hit
    if first:
        return first
    for p in theme["_weak"]:
        w = p.search(sent)
        if w and any(c.search(sent) for c in theme["_ctx"]):
            return {"lvl": "amb", "kw": w.group(0), "start": w.start(), "end": w.end(), "rank": 99, "sub": sub}
    return None


def is_subsidiary_sentence(sent: str, self_extra=None) -> bool:
    """자회사·종속회사·계열회사 사업을 설명하는 문장인가('당사 및 종속회사는' 처럼 모회사가 함께 주어면 아니다).
    다른 회사 이름(㈜ 표기)으로 시작하는 문장도 자회사 문장으로 본다 — 자기 회사 이름이면 아니다."""
    if PARENT_WITH_SUB_RE.search(sent):
        return False
    if SUB_RE.search(sent):
        return True
    m = NAMED_START_RE.search(sent[:40])
    return bool(m) and not (self_extra is not None and self_extra.search(m.group(1)))


def _hit_score(h: dict) -> float:
    s = 10.0 if h["lvl"] == "high" else 0.0
    s += 2.0 if not h["row"] else 0.0
    s -= min(h.get("rank", 0), 10) * 0.25     # 규칙의 앞쪽 키워드(대표 표현)를 우선
    s += 1.0 if CORE_SELF_RE.search(h["ev"]) else 0.0   # '당사는 …' 으로 시작하는 자기 소개 문장을 우선
    s -= 1.5 if h.get("sub") else 0.0                   # 같은 테마면 모회사 자신의 문장을 자회사 문장보다 우선
    s -= abs(len(h["ev"]) - 120) / 200.0              # 너무 짧은 주석성 문장(※ …)도, 긴 나열도 덜 선호
    s -= h["pos"] / 5000.0
    return s


def scan_section(section: str, themes=None, names=None) -> dict:
    """사업의 내용 구간 → {테마id: {lvl, ev, kw, c, n}}. 테마마다 가장 좋은 근거 하나 + 걸린 문장 수 n.

    근거 문장은 canon(section) 의 부분 문자열인지 확인하고, 아니면 버린다(파싱 사고 방어).
    """
    themes = themes or THEMES_C
    self_extra = self_patterns(names)
    full = canon(section)
    best: dict[str, dict] = {}
    counts: dict[str, int] = {}
    pos = 0
    mode = None
    for chunk, is_row in section_chunks(section):
        if not is_row:
            mode = heading_mode(chunk) or mode
        sents = [chunk] if is_row else split_sentences(chunk)
        for sent in sents:
            pos += 1
            for th in themes:
                hit = classify_hit(sent, is_row, th, industry=(mode == "industry"), self_extra=self_extra)
                if not hit:
                    continue
                ev, cut = trim_evidence(sent, hit["start"], hit["end"])
                if not ev or ev not in full:
                    continue
                counts[th["id"]] = counts.get(th["id"], 0) + 1
                cand = {"lvl": hit["lvl"], "ev": ev, "kw": hit["kw"], "c": cut, "row": is_row, "pos": pos, "rank": hit["rank"],
                        "sub": hit.get("sub", False)}
                cur = best.get(th["id"])
                if cur is None or _hit_score(cand) > _hit_score(cur):
                    best[th["id"]] = cand
    out = {}
    for tid, h in best.items():
        out[tid] = {"lvl": h["lvl"], "ev": h["ev"], "kw": h["kw"], "c": h["c"], "n": counts.get(tid, 1)}
        if h.get("sub"):
            out[tid]["sub"] = 1
    return out


def evidence_key(ticker: str, theme_id: str, ev: str, *, prompt_version: int | None = None,
                 rules_version: int | None = None) -> str:
    """LLM 판정 캐시 키. 프롬프트·규칙 버전이 들어가 버전이 바뀌면 같은 문장도 다시 판정한다."""
    pv = LLM_PROMPT_VERSION if prompt_version is None else prompt_version
    rv = R.RULES_VERSION if rules_version is None else rules_version
    return hashlib.sha1(f"p{pv}|r{rv}|{ticker}|{theme_id}|{ev}".encode("utf-8")).hexdigest()[:16]


def is_excluded(ticker: str, theme_id: str) -> bool:
    return (ticker, theme_id) in R.EXCLUDE


def prune_llm_cache(llm_cache: dict, tstate: dict) -> dict:
    """지금 보류 후보에 대응하는 판정만 남긴다(버전이 바뀐 옛 키·사라진 후보·제외 목록은 버린다)."""
    live = {evidence_key(t, tid, h["ev"]) for t, st in tstate.items()
            for tid, h in (st.get("amb") or {}).items() if not is_excluded(t, tid)}
    return {k: v for k, v in llm_cache.items() if k in live}


def report_period(nm: str) -> str:
    m = re.search(r"\((\d{4}\.\d{2})\)", nm or "")
    return m.group(1) if m else ""


# ───────────────────────────────────────────────────────── 계획·조립(순수 함수, 테스트 대상)

def plan_tickers(universe: list[str], listing: dict, tstate: dict, rules_version: int) -> list[str]:
    """시총 순 유니버스 중 처리할 종목 — 새 접수번호이거나 규칙 버전이 바뀐 종목."""
    out = []
    for t in universe:
        rep = listing.get(t)
        if not rep or not rep.get("rc"):
            continue
        st = tstate.get(t) or {}
        if st.get("rc") == rep["rc"] and int(st.get("rv") or 0) >= rules_version:
            continue
        out.append(t)
    return out


def split_evidence(payload: dict) -> tuple[dict, dict[str, dict]]:
    """전체 payload(멤버에 ev 포함) → (인덱스 payload, {테마id: 근거 파일 내용}).

    인덱스(KR_THEMES)는 테마 등락·칩에 필요한 것만 담아 가볍게 두고, 문장은 테마별 파일로 뺀다
    (전 종목이 채워지면 문장만 수 MB 라 종목 화면마다 받게 할 수 없다). 인덱스의 테마 'v' 는
    근거 파일 내용 해시 — 브라우저가 ?v= 로 붙여 바뀐 파일만 새로 받는다.
    """
    index = {k: v for k, v in payload.items() if k != "themes"}
    themes, files = [], {}
    for th in payload.get("themes") or []:
        ev = {}
        members = []
        for m in th.get("members") or []:
            ev[m["t"]] = [m["ev"], m.get("c", 0)]
            members.append({k: v for k, v in m.items() if k not in ("ev", "c")})
        body = {"id": th["id"], "ev": dict(sorted(ev.items()))}
        ver = hashlib.md5(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:10]
        files[th["id"]] = body
        themes.append({**{k: v for k, v in th.items() if k != "members"}, "v": ver, "members": members})
    index["themes"] = themes
    return index, files


def merge_evidence(index: dict, ev_dir: Path) -> dict:
    """인덱스 + 테마별 근거 파일 → 멤버에 ev·c 가 붙은 전체 payload(다음 실행의 '직전 결과')."""
    out = {**index, "themes": []}
    for th in index.get("themes") or []:
        body = load_json(ev_dir / f"{th.get('id')}.json", {}) or {}
        ev = body.get("ev") or {}
        members = []
        for m in th.get("members") or []:
            pair = ev.get(m.get("t"))
            if not pair:
                continue          # 근거 없는 편입은 되살리지 않는다
            members.append({**m, "ev": pair[0], "c": pair[1] if len(pair) > 1 else 0})
        out["themes"].append({**th, "members": members})
    return out


def write_evidence_files(files: dict[str, dict], ev_dir: Path) -> list[Path]:
    """바뀐 테마 근거 파일만 쓰고, 사전에서 빠진 테마 파일은 지운다."""
    ev_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for tid, body in files.items():
        path = ev_dir / f"{tid}.json"
        text = json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n"
        try:
            if path.read_text(encoding="utf-8") == text:
                continue
        except FileNotFoundError:
            pass
        atomic_write_text(path, text)
        written.append(path)
    for path in ev_dir.glob("*.json"):
        if path.stem not in files:
            path.unlink()
    return written


def assemble(prev_payload: dict, results: dict, tstate: dict, llm_cache: dict, listing: dict,
             names: dict, fundamentals: dict, universe: set[str] | None, today: str) -> dict:
    """테마별 편입 목록을 만든다.

    - 이번에 처리한 종목(results)은 새 규칙 결과로 교체, 나머지는 직전 payload 의 규칙 편입을 유지.
    - LLM 판정(llm_cache)으로 통과한 보류 후보는 상태의 amb 에서 매번 다시 붙인다(by='llm').
    - universe 가 주어지면 그 밖(상장폐지·스팩 해산 등) 종목은 뺀다.
    """
    by_theme: dict[str, dict[str, dict]] = {t["id"]: {} for t in R.THEMES}
    for th in (prev_payload or {}).get("themes") or []:
        tid = th.get("id")
        if tid not in by_theme:
            continue
        for m in th.get("members") or []:
            t = m.get("t")
            if not t or t in results or m.get("by") != "rule":
                continue
            if (universe is not None and t not in universe) or is_excluded(t, tid):
                continue
            by_theme[tid][t] = {k: m[k] for k in ("t", "ev", "kw", "c", "n", "by", "sub") if k in m}
    for t, hits in results.items():
        for tid, h in hits.items():
            if h["lvl"] != "high" or tid not in by_theme or is_excluded(t, tid):
                continue
            by_theme[tid][t] = {"t": t, "ev": h["ev"], "kw": h["kw"], "c": h["c"], "n": h["n"], "by": "rule"}
            if h.get("sub"):
                by_theme[tid][t]["sub"] = 1
    for t, st in tstate.items():
        if universe is not None and t not in universe:
            continue
        for tid, h in (st.get("amb") or {}).items():
            if tid not in by_theme or t in by_theme[tid] or is_excluded(t, tid):
                continue
            if llm_cache.get(evidence_key(t, tid, h["ev"])) is True:
                by_theme[tid][t] = {"t": t, "ev": h["ev"], "kw": h["kw"], "c": h.get("c", 0), "n": h.get("n", 1), "by": "llm"}
                if h.get("sub"):
                    by_theme[tid][t]["sub"] = 1

    themes_out = []
    used: set[str] = set()
    for th in R.THEMES:
        members = list(by_theme[th["id"]].values())
        if th.get("filter", {}).get("pbMax") is not None:
            for m in members:
                pb = (fundamentals.get(m["t"]) or {}).get("pb")
                if isinstance(pb, (int, float)) and pb > 0:
                    m["pb"] = round(float(pb), 2)
        for m in members:
            if not m.get("c"):
                m.pop("c", None)
        members.sort(key=lambda m: m["t"])
        used.update(m["t"] for m in members)
        entry = {"id": th["id"], "name": th["name"], "group": th["group"], "desc": th["desc"], "members": members}
        if th.get("filter"):
            entry["filter"] = th["filter"]
        themes_out.append(entry)

    reports = {}
    for t in sorted(used):
        rep = listing.get(t) or {}
        st = tstate.get(t) or {}
        rc = st.get("rc") or rep.get("rc")
        if not rc:
            continue
        nm = rep.get("nm") if rep.get("rc") == rc else st.get("nm")
        dt = rep.get("dt") if rep.get("rc") == rc else st.get("dt")
        reports[t] = [rc, nm or "사업보고서", dt or "", names.get(t) or rep.get("corp") or ""]
    count = sum(len(t["members"]) for t in themes_out)
    return {"themes": themes_out, "reports": reports, "count": count}


# ───────────────────────────────────────────────────────── 네트워크

def list_reports_bulk(api_key: str, today: date) -> dict:
    """최근 LIST_MONTHS 개월 사업보고서(최종본) → {티커: {rc, nm, dt, corp}}. 종목당 최신 접수번호."""
    from build_kr_disclosures import dart_get

    out: dict[str, dict] = {}
    end = today
    start_limit = today - timedelta(days=LIST_MONTHS * 31)
    calls = 0
    while end > start_limit:
        bgn = max(start_limit, end - timedelta(days=89))
        for cls in ("Y", "K"):
            page = 1
            while True:
                data = dart_get("list.json", {"bgn_de": bgn.strftime("%Y%m%d"), "end_de": end.strftime("%Y%m%d"),
                                              "corp_cls": cls, "pblntf_detail_ty": "A001", "last_reprt_at": "Y",
                                              "page_no": page, "page_count": 100}, api_key)
                calls += 1
                if str(data.get("status")) != "000":
                    break
                for row in data.get("list") or []:
                    _take_listing_row(out, row)
                total_page = int(data.get("total_page") or 1)
                if page >= total_page:
                    break
                page += 1
        end = bgn - timedelta(days=1)
    print(f"[목록] 사업보고서 {len(out)}종목 · list.json {calls}콜")
    return out


def list_reports_one(api_key: str, corp: str, today: date) -> dict | None:
    from build_kr_disclosures import dart_get

    bgn = today - timedelta(days=LIST_MONTHS * 31)
    data = dart_get("list.json", {"corp_code": corp, "bgn_de": bgn.strftime("%Y%m%d"), "end_de": today.strftime("%Y%m%d"),
                                  "pblntf_detail_ty": "A001", "last_reprt_at": "Y", "page_count": 20}, api_key)
    if str(data.get("status")) != "000":
        return None
    tmp: dict[str, dict] = {}
    for row in data.get("list") or []:
        _take_listing_row(tmp, row)
    return next(iter(tmp.values()), None)


def _take_listing_row(out: dict, row: dict) -> None:
    t = str(row.get("stock_code") or "").strip()
    rc = str(row.get("rcept_no") or "").strip()
    nm = " ".join(str(row.get("report_nm") or "").split())
    if not t or not rc or "사업보고서" not in nm:
        return
    dt = str(row.get("rcept_dt") or "")
    dt = f"{dt[:4]}-{dt[4:6]}-{dt[6:8]}" if len(dt) == 8 else dt
    cur = out.get(t)
    if cur is None or rc > cur["rc"]:
        out[t] = {"rc": rc, "nm": nm, "dt": dt, "corp": " ".join(str(row.get("corp_name") or "").split())}


def _decode(data: bytes) -> str:
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", "replace")


def fetch_report_section(rc: str, api_key: str, doc_dir: Path | None = None) -> tuple[str | None, str]:
    """(사업의 내용 구간, 상태). 상태: ok | nosection | fail. 원문 전체는 들고 있지 않는다."""
    if doc_dir is not None:
        p = Path(doc_dir) / f"{rc}.xml"
        if not p.exists():
            return None, "fail"
        sec = extract_business_section(_decode(p.read_bytes()))
        return (sec, "ok") if sec else (None, "nosection")
    from build_kr_disclosures import dart_abort_if_rate_limited, dart_pace

    url = f"{DOC_URL}?crtfc_key={api_key}&rcept_no={rc}"
    raw = None
    for attempt in range(3):
        try:
            dart_pace()
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mir-US-Stocks/1.0"}), timeout=90) as r:
                raw = r.read()
            break
        except Exception as exc:  # noqa: BLE001
            if attempt == 2:
                print(f"  [원문] {rc} 받기 실패: {exc}")
                return None, "fail"
            time.sleep(2 * (attempt + 1))
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        m = re.search(rb"<status>(\d+)</status>", raw or b"")
        if m:
            dart_abort_if_rate_limited(m.group(1).decode(), "document.xml")
        return None, "fail"
    names = sorted(zf.namelist(), key=lambda n: (0 if n.startswith(rc) and "_" not in n else 1, n))
    for name in names:
        sec = extract_business_section(_decode(zf.read(name)))
        if sec:
            return sec, "ok"
    return None, "nosection"


def llm_judge(cands: list[dict], api_key: str) -> dict[str, bool]:
    """보류 후보 → {key: bool}. 실패하면 빈 dict(그 후보는 다음 실행에 다시 묻는다)."""
    if not cands:
        return {}
    items = [{"id": i, "company": c["name"], "theme": c["theme"], "themeDesc": c["desc"], "sentence": c["ev"]}
             for i, c in enumerate(cands)]
    prompt = (
        "아래는 한국 상장사 사업보고서 '사업의 내용' 에서 뽑은 문장이다. 각 항목에 대해, 이 문장이 "
        "**그 회사(또는 연결 자회사) 자신이 테마에 해당하는 제품·서비스 자체를** 생산·개발·판매·운영한다는 근거인지 엄격히 판정하라.\n"
        "true 예: '당사는 HBM 을 개발·공급', '연결회사는 원전 주기기를 제작', '차세대 전지 개발 - 전고체전지'(배터리 회사의 연구 과제).\n"
        "false 예(하나라도 해당하면 false):\n"
        "- 테마가 그 회사 제품의 **고객·응용처·전방 산업**일 뿐인 경우(예: 'AI 가속기 등 신규 응용처 발굴', '완성차 업체에 MLCC 공급', '자율주행 확대로 기판 수요 증가', 'ADAS향 제품').\n"
        "- 사내 조직·팀·업무 효율화 도구(예: 'AI솔루션팀 편제', '정보보안팀'), 온실가스·ESG·구매 이야기.\n"
        "- 시장·산업 전반 설명, 전망, 계획·검토만 있는 경우, 설비를 사서 쓰는 경우.\n"
        "- '기타 부문'·부가서비스처럼 곁가지로 곁들인 상품(예: 카드사의 여행알선 부가서비스).\n"
        "문장만 보고 판단하고 외부 지식으로 보태지 마라. 애매하면 false.\n"
        '출력: JSON 배열 [{"id": 0, "ok": false}, ...] 만.\n\n'
        + json.dumps(items, ensure_ascii=False)
    )
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0, "maxOutputTokens": 2048,
                                 "thinkingConfig": {"thinkingBudget": 0}}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{LLM_MODEL}:generateContent"
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json", "x-goog-api-key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except urllib.error.HTTPError as exc:
        print(f"  [LLM] HTTP {exc.code} — 이번 실행은 보류 유지")
        return {}
    except Exception as exc:  # noqa: BLE001
        print(f"  [LLM] 실패 {type(exc).__name__} — 이번 실행은 보류 유지")
        return {}
    return parse_llm_verdicts(text, cands)


def parse_llm_verdicts(text: str, cands: list[dict]) -> dict[str, bool]:
    """모델 응답 → {key: bool}. 목록에 없는 id·bool 이 아닌 값은 버린다."""
    try:
        arr = json.loads(text)
    except Exception:
        m = re.search(r"\[.*\]", text or "", re.S)
        try:
            arr = json.loads(m.group(0)) if m else []
        except Exception:
            arr = []
    out = {}
    for row in arr if isinstance(arr, list) else []:
        if not isinstance(row, dict):
            continue
        i = row.get("id")
        ok = row.get("ok")
        if isinstance(i, int) and 0 <= i < len(cands) and isinstance(ok, bool):
            out[cands[i]["key"]] = ok
    return out


# ───────────────────────────────────────────────────────── 실행

def load_universe() -> tuple[list[str], dict]:
    snap = load_json(KR_SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in ETF_SECTORS]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    return [str(s["ticker"]) for s in stocks], {str(s["ticker"]): s.get("company") or "" for s in stocks}


def main() -> int:
    ap = argparse.ArgumentParser(description="국내 테마 분류(DART 사업보고서 근거 문장)")
    ap.add_argument("--max-docs", type=int, default=int(os.environ.get("KR_THEME_MAX_DOCS") or 600))
    ap.add_argument("--llm-max", type=int, default=40)
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--only", default="", help="쉼표로 구분한 티커(테스트용)")
    ap.add_argument("--doc-dir", default="", help="오프라인: <접수번호>.xml 원문 폴더")
    ap.add_argument("--listing-file", default="", help="오프라인: {티커: {rc, nm, dt}} JSON")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    load_env()
    only = [x.strip() for x in args.only.split(",") if x.strip()]
    doc_dir = Path(args.doc_dir) if args.doc_dir else None
    today = datetime.now(KST).date()
    stamp = today.isoformat()

    universe, names = load_universe()
    if len(universe) < 1000 and not only:
        print(f"[중단] 국내 스냅샷 종목 {len(universe)}개 — 유니버스가 무너진 날에는 돌리지 않는다")
        return 1
    state = load_json(STATE_JSON, {}) or {}
    tstate: dict = state.setdefault("t", {})
    llm_cache: dict = state.setdefault("llm", {})
    listing: dict = dict((state.get("listing") or {}).get("reports") or {})
    prev_payload = merge_evidence(load_json(OUT_JSON, {}) or {}, EV_DIR)

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if args.listing_file:
        listing.update(load_json(Path(args.listing_file), {}) or {})
    elif not api_key:
        print("[중단] DART_API_KEY 없음")
        return 1
    elif only:
        from build_kr_disclosures import load_corp_map
        corp_map = load_corp_map(api_key)
        for t in only:
            if t in corp_map:
                rep = list_reports_one(api_key, corp_map[t], today)
                if rep:
                    listing[t] = rep
    else:
        try:
            listing.update(list_reports_bulk(api_key, today))
        except SystemExit as exc:
            print(f"[목록] {exc}")
            return 1
    state["listing"] = {"asOf": stamp, "reports": listing}

    order = [t for t in universe if t in set(only)] if only else universe
    if only:
        order += [t for t in only if t not in order]
    plan = plan_tickers(order, listing, tstate, R.RULES_VERSION)
    print(f"[계획] 유니버스 {len(universe)} · 보고서 확인 {sum(1 for t in universe if t in listing)} · "
          f"처리 대기 {len(plan)} · 이번 실행 상한 {args.max_docs} · 규칙 v{R.RULES_VERSION}")

    results: dict[str, dict] = {}
    rank = {t: i for i, t in enumerate(universe)}
    ok = fail = nosec = 0
    try:
        for t in plan[: max(0, args.max_docs)]:
            rep = listing[t]
            sec, status = fetch_report_section(rep["rc"], api_key, doc_dir)
            if status == "fail":
                fail += 1
                continue
            hits = scan_section(sec, names=[names.get(t), rep.get("corp")]) if sec else {}
            if status == "nosection":
                nosec += 1
            results[t] = hits
            amb = {}
            if rank.get(t, 10**6) < AMB_TOP:
                ambs = sorted(((tid, h) for tid, h in hits.items() if h["lvl"] == "amb"), key=lambda x: -x[1]["n"])
                amb = {tid: {k: h[k] for k in ("ev", "kw", "c", "n", "sub") if k in h}
                       for tid, h in ambs if not is_excluded(t, tid)}
                amb = dict(list(amb.items())[:AMB_PER_TICKER])
            tstate[t] = {"rc": rep["rc"], "nm": rep.get("nm"), "dt": rep.get("dt"), "rv": R.RULES_VERSION, "at": stamp,
                         "high": sorted(tid for tid, h in hits.items() if h["lvl"] == "high")}
            if amb:
                tstate[t]["amb"] = amb
            if status == "nosection":
                tstate[t]["nosec"] = 1
            ok += 1
            if ok % 50 == 0:
                print(f"  {ok}건 처리 · 실패 {fail}")
    except SystemExit as exc:          # DART 020(한도 초과) — 받은 만큼만 저장
        print(f"[원문] {exc}")
    print(f"[원문] 처리 {ok} · 사업의 내용 없음 {nosec} · 실패 {fail}")
    if plan and ok == 0 and fail > 0:
        print("[중단] 원문을 하나도 못 받았다 — 기존 파일 유지")
        return 1

    uni_set = None if only else set(universe)
    if uni_set is not None:
        for t in [k for k in tstate if k not in uni_set]:
            tstate.pop(t, None)

    llm_cache = prune_llm_cache(llm_cache, tstate)
    state["llm"] = llm_cache
    # 보류 후보 LLM 판정(선택). 시총 순으로, 아직 안 물어본 것만, 실행당 상한.
    gem = os.environ.get("GEMINI_API_KEY", "").strip()
    judged = accepted = 0
    if gem and not args.no_llm and args.llm_max > 0:
        theme_meta = {t["id"]: t for t in R.THEMES}
        pending = []
        for t in sorted(tstate, key=lambda x: rank.get(x, 10**6)):
            for tid, h in (tstate[t].get("amb") or {}).items():
                key = evidence_key(t, tid, h["ev"])
                if key in llm_cache or tid not in theme_meta or is_excluded(t, tid):
                    continue
                pending.append({"key": key, "name": names.get(t) or t, "theme": theme_meta[tid]["name"],
                                "desc": theme_meta[tid]["desc"], "ev": h["ev"]})
        pending = pending[: args.llm_max]
        for i in range(0, len(pending), LLM_BATCH):
            got = llm_judge(pending[i: i + LLM_BATCH], gem)
            if not got:
                break
            llm_cache.update(got)
            judged += len(got)
            accepted += sum(1 for v in got.values() if v)
        print(f"[LLM] 보류 후보 판정 {judged} · 편입 {accepted} (모델 {LLM_MODEL})")
    else:
        print("[LLM] 건너뜀 — 보류 후보는 편입하지 않는다")

    fundamentals = load_json(MAP_FUND, {}) or {}
    body = assemble(prev_payload, results, tstate, llm_cache, listing, names, fundamentals, uni_set, stamp)
    amb_pending = sum(1 for t, st in tstate.items() for tid, h in (st.get("amb") or {}).items()
                      if evidence_key(t, tid, h["ev"]) not in llm_cache and not is_excluded(t, tid))
    with_themes = len({m["t"] for th in body["themes"] for m in th["members"]})
    payload = {
        "schema": 1,
        "updatedAtKst": now_kst(),
        "source": SOURCE,
        "rulesVersion": R.RULES_VERSION,
        "llmPromptVersion": LLM_PROMPT_VERSION,
        "excluded": len(R.EXCLUDE),
        "count": body["count"],
        "themeCount": len(body["themes"]),
        "coverage": {
            "universe": len(universe),
            "withReport": sum(1 for t in universe if t in listing),
            "processed": sum(1 for t in universe if (tstate.get(t) or {}).get("rc")),
            "withThemes": with_themes,
            "ambPending": amb_pending,
            "llmJudged": sum(1 for v in llm_cache.values() if isinstance(v, bool)),
            "llmAccepted": sum(1 for v in llm_cache.values() if v is True),
            "thisRun": {"docs": ok, "fail": fail, "noSection": nosec, "llmJudged": judged},
        },
        # 원문을 읽은 종목(편입이 0개여도) — 종목 화면이 '근거 없음' 과 '아직 안 읽음' 을 가르는 데 쓴다.
        "done": sorted(t for t, st in tstate.items() if st.get("rc") and (uni_set is None or t in uni_set)),
        "reports": body["reports"],
        "themes": body["themes"],
    }
    index, ev_files = split_evidence(payload)
    write_data(OUT_JSON, OUT_JS, "KR_THEMES", index, indent=None, min_ratio=DART_REGRESSION_FLOOR)
    changed = write_evidence_files(ev_files, EV_DIR)
    atomic_write_text(STATE_JSON, json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"[완료] 테마 {len(body['themes'])} · 편입 {body['count']} · 테마 있는 종목 {with_themes} · 보류 {amb_pending} · "
          f"근거 파일 갱신 {len(changed)}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(["data/korea/themes.json", "data/korea/themes.js", "data/korea/themes_state.json",
                                    "data/korea/themes"], "KR themes"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
