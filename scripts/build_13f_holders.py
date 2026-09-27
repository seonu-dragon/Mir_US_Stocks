#!/usr/bin/env python3
"""종목별 기관 보유 변화(US) — SEC Form 13F 데이터셋(종목 → 기관 방향).

기존 `build_13f_snapshot.py` 는 '유명 기관 100곳 → 그 기관의 보유 종목'이다. 이 빌더는 반대로
**종목 하나에 13F 를 낸 기관 전부**를 모은다: 보고 기관 수, 합계 보유 주식·가치·발행주식 대비,
직전 분기 대비 신규 편입·전량 청산·증가·감소 기관 수, 상위 보유 기관 10곳, 최근 8분기 추이.

데이터: SEC Form 13F Data Sets(https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets).
2024 년부터 '제출일 기준 3개월 창'(예: 01jun2026-31aug2026) zip 으로 나온다. 분기말 후 45일 안에
제출하므로 창 하나 ≈ 보고 분기 하나(6~8월 창 = 6월말 분기)다. 창이 끝나고 2주쯤 뒤 공개된다.
zip(약 100MB, INFOTABLE.tsv 풀면 약 400MB)은 임시 폴더에 받아 **스트리밍**으로 필요한 열만 읽는다.

집계 규칙(테스트: scripts/tests/test_13f_holders.py)
- 보고서 고르기: (제출 기관 CIK, 보고 분기) 마다 원본 13F-HR 과 RESTATEMENT 정정본 중 **가장 늦게 낸 것 하나**
  (같은 날이면 접수번호가 큰 것)를 쓴다. 'NEW HOLDINGS' 정정본은 그 보고서 **이후에 낸 것만 더한다**(추가분).
  정정 종류가 빈 정정본은 전체 교체(RESTATEMENT)로 본다. 13F-NT(보유 없음 통지)는 뺀다.
- 한 보고서 안에서 같은 CUSIP 줄이 여러 개면(투자재량·공동 매니저별로 쪼개 적음) 주식 수·가치를 더한다.
  13F 규정상 다른 제출인이 대신 보고한 몫은 그 기관 보고서에 없으므로(13F NOTICE/COMBINATION) 기관끼리는 겹치지 않는다.
- 주식(SSHPRNAMTTYPE=SH, PUTCALL 빈칸)만 보유로 센다. 풋·콜(PUTCALL 있음)은 **기초자산 주식 수로 따로** 센다.
  채권 원금(PRN)은 뺀다.
- 분기 비교(신규·청산·증감)는 **두 분기 모두 13F 를 낸 기관끼리만** 한다. 아직 안 낸 기관을 '전량 청산'으로
  세지 않기 위해서다. 분기 중 액면분할이 있으면(계속 보유 기관의 주식 수 비율 중앙값이 2·3·1/2 같은 값) 직전
  분기 수량을 그 비율로 맞춘 뒤 증감을 판정한다.
- 늦게 낸 보고서: 분기 p 는 그 분기 창과 **다음 창**에 들어온 보고서를 합친다. 최신 분기는 다음 창이 아직
  없어 잠정(늦게 낸 소수 기관 빠짐)이고, 다음 분기 실행 때 다시 계산한다.

CUSIP → 티커(무료·합법)
1. OpenFIGI 캐시(이 빌더의 cusip_map.json + ETF 구성 빌더의 data/etf_holdings/cusip_map.json)
2. 13f.info 가 준 (CUSIP, 티커) 쌍(data/institutional_13f.json — 기존 13F 기능이 이미 쓰는 소스)
3. OpenFIGI 새 조회(무키 25회/분·요청당 10건 — 보유 가치가 큰 CUSIP 부터 실행당 --figi-budget 개)
4. 나머지는 SEC 공식 13(f) 증권 목록의 발행사명(없으면 INFOTABLE 발행사명)을 스냅샷 회사명과 정규화 일치
   (유일할 때만, 종류주 글자가 다르면 거부, 우선주·채권·워런트·권리·유닛 종류는 거부)
여러 CUSIP 이 같은 티커로 이어지면(CUSIP 변경 등) 기관별로 더한다.

산출물(data/institutional_holders/)
- `<A>.json` … 티커 첫 글자 샤드 {"n": {cik: 기관명}, "t": {티커: 레코드}} — 종목을 열 때 하나만 받는다
- `index.json/.js` … window.US_INST_HOLDERS_INDEX(분기 목록·샤드 버전·규칙·커버리지)
- `state.json` … 분기별 CUSIP 합계(추이용, 브라우저는 안 읽음) · `cusip_map.json` … OpenFIGI 캐시
증분: 이미 처리한 최신 데이터셋이면 아무것도 안 하고 끝난다(--force 로 다시). 새 창이 나오면 그 창과
직전 창 두 개만 받는다. 처음(state 없음)에는 추이용으로 --quarters+1 개 창을 차례로 받는다.

실행: py scripts/build_13f_holders.py [--quarters 8] [--figi-budget 3000] [--force] [--push]
      py scripts/build_13f_holders.py --zip-dir <폴더>   # 미리 받아 둔 zip 으로(로컬 확인용)
환경변수(선택): OPENFIGI_API_KEY — 있으면 요청당 100건·빠른 속도.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.request
import zipfile
import zlib
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from statistics import median

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
DIR = ROOT / "data" / "institutional_holders"
OUT_JSON = DIR / "index.json"
OUT_JS = DIR / "index.js"
STATE_JSON = DIR / "state.json"
CUSIP_MAP = DIR / "cusip_map.json"
ETF_CUSIP_MAP = ROOT / "data" / "etf_holdings" / "cusip_map.json"
INST_13F = ROOT / "data" / "institutional_13f.json"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
DETAILS = ROOT / "data" / "details"
KST = timezone(timedelta(hours=9))

DATASETS_PAGE = "https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets"
LIST_PAGE = "https://www.sec.gov/rules-regulations/staff-guidance/official-list-section-13f-securities"
SEC_BASE = "https://www.sec.gov"

TOP_HOLDERS = 10
DEFAULT_QUARTERS = 8
FIGI_RECHECK_DAYS = 120
FIGI_MIN_VALUE = 10_000_000       # 새 OpenFIGI 조회는 13F 합계 보유 가치 $10M 이상 CUSIP 만
STATE_MIN_VALUE = 5_000_000       # 티커를 못 이은 CUSIP 은 합계 $5M 이상만 추이 상태에 남긴다
SAME_TOL = 0.001                  # 수량 변화 0.1% 미만은 '유지'
SPLIT_MIN_N = 12                  # 분할 추정에 필요한 계속 보유 기관 수

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_DS_RE = re.compile(r'href="([^"]*?/(\d{2})([a-z]{3})(\d{4})-(\d{2})([a-z]{3})(\d{4})_form13f\.zip)"', re.I)
_LIST_RE = re.compile(r'href="([^"]*13flist(\d{4})q(\d)[^"]*\.txt)"', re.I)
# 이름 일치로 잇지 않는 증권 종류(보통주가 아닌 것 — 같은 회사명이라도 다른 증권이다).
_NOT_COMMON = re.compile(
    r"(?:^|[\s/])(?:PFD|PREF|PREFERRED|PRF|NOTE|NOTES|NT|BOND|BD|DEB|DEBT|DEBENTURE|DBCV|SDCV|CONV|SUB|SR|"
    r"WT|WTS|WARRANT|WARRANTS|\*W|W EXP|RIGHT|RIGHTS|RT|RTS|UNIT|UNITS|PUT|CALL)(?=$|[\s/.,])", re.I)


# ---------------------------------------------------------------------------
# 작은 도우미
# ---------------------------------------------------------------------------

def now_kst() -> datetime:
    return datetime.now(KST)


def parse_sec_date(text: str) -> str:
    """'31-JUL-2026' → '2026-07-31'. 못 읽으면 ''."""
    s = (text or "").strip()
    m = re.fullmatch(r"(\d{1,2})-([A-Za-z]{3})-(\d{4})", s)
    if not m:
        return ""
    mon = MONTHS.get(m.group(2).lower())
    if not mon:
        return ""
    return f"{int(m.group(3)):04d}-{mon:02d}-{int(m.group(1)):02d}"


def quarter_end_on_or_before(d: date) -> date:
    for y in (d.year, d.year - 1):
        for mm, dd in ((12, 31), (9, 30), (6, 30), (3, 31)):
            qe = date(y, mm, dd)
            if qe <= d:
                return qe
    raise ValueError(d)


def norm_cusip(c: str) -> str:
    c = (c or "").strip().upper()
    return c if re.fullmatch(r"[0-9A-Z]{9}", c) and c != "000000000" else ""


def to_int(x) -> int:
    try:
        return int(float(str(x).strip() or 0))
    except ValueError:
        return 0


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


# ---------------------------------------------------------------------------
# 데이터셋 목록 · 13(f) 증권 목록
# ---------------------------------------------------------------------------

def parse_dataset_links(html: str) -> list[dict]:
    """데이터셋 페이지 → [{name, url, start, end, period}] (창 끝 날짜 오름차순).

    period = 창에 주로 들어 있는 보고 분기말 = '창 끝 − 45일' 이전의 마지막 분기말
    (6/1~8/31 → 6/30, 12/1~2/28 → 12/31). 옛 'YYYYqN' 파일명(달력 분기 창)은 쓰지 않는다.
    """
    out: dict[str, dict] = {}
    for m in _DS_RE.finditer(html or ""):
        href = m.group(1)
        try:
            start = date(int(m.group(4)), MONTHS[m.group(3).lower()], int(m.group(2)))
            end = date(int(m.group(7)), MONTHS[m.group(6).lower()], int(m.group(5)))
        except (KeyError, ValueError):
            continue
        name = href.rsplit("/", 1)[-1].replace("_form13f.zip", "")
        url = href if href.startswith("http") else SEC_BASE + href
        period = quarter_end_on_or_before(end - timedelta(days=45)).isoformat()
        out[name] = {"name": name, "url": url, "start": start.isoformat(), "end": end.isoformat(), "period": period}
    return sorted(out.values(), key=lambda d: d["end"])


def parse_list_links(html: str) -> list[str]:
    """13(f) 증권 목록 페이지 → 텍스트판 URL(최신 분기 먼저)."""
    found = {}
    for m in _LIST_RE.finditer(html or ""):
        href = m.group(1)
        found[(int(m.group(2)), int(m.group(3)))] = href if href.startswith("http") else SEC_BASE + href
    return [found[k] for k in sorted(found, reverse=True)]


def parse_13f_list(text: str) -> dict[str, dict]:
    """SEC 공식 13(f) 증권 목록(80자 고정폭) → {CUSIP: {name, cls, opt, status}}.

    열: CUSIP[0:9] · '*'=상장 옵션 있음[9] · 발행사[10:40] · 종류[40:67] · 상태[67:70]('*A*' 추가, '*D*' 삭제).
    풋·콜 줄(종류 CALL/PUT)은 옵션용 별도 CUSIP 이라 뺀다.
    """
    out: dict[str, dict] = {}
    for line in (text or "").splitlines():
        if len(line) < 45:
            continue
        cus = norm_cusip(line[0:9])
        if not cus:
            continue
        cls = line[40:67].strip()
        if cls in ("CALL", "PUT"):
            continue
        out[cus] = {"name": line[10:40].strip(), "cls": cls, "opt": line[9:10] == "*",
                    "status": line[67:70].strip()}
    return out


# ---------------------------------------------------------------------------
# 보고서 고르기 (정정본 중복 제거)
# ---------------------------------------------------------------------------

def filing_meta(submission_rows, coverpage_rows, periods: set[str]) -> list[dict]:
    """SUBMISSION·COVERPAGE 행 → 보유 보고서 메타 [{acc, cik, period, filed, amend, name}].

    13F-HR / 13F-HR/A 만, 보고 분기가 periods 안인 것만. REPORTTYPE 이 NOTICE 면 뺀다.
    amend: '' (원본) | 'RESTATEMENT' | 'NEW HOLDINGS'. 정정인데 종류가 비면 RESTATEMENT 로 본다.
    """
    cover = {}
    for r in coverpage_rows:
        cover[(r.get("ACCESSION_NUMBER") or "").strip()] = r
    out = []
    for r in submission_rows:
        stype = (r.get("SUBMISSIONTYPE") or "").strip().upper()
        if stype not in ("13F-HR", "13F-HR/A"):
            continue
        acc = (r.get("ACCESSION_NUMBER") or "").strip()
        period = parse_sec_date(r.get("PERIODOFREPORT") or "")
        if not acc or period not in periods:
            continue
        cp = cover.get(acc) or {}
        if "NOTICE" in (cp.get("REPORTTYPE") or "").upper():
            continue
        is_amend = stype.endswith("/A") or (cp.get("ISAMENDMENT") or "").strip().upper() == "Y"
        amend = ""
        if is_amend:
            amend = (cp.get("AMENDMENTTYPE") or "").strip().upper() or "RESTATEMENT"
            if amend not in ("RESTATEMENT", "NEW HOLDINGS"):
                amend = "RESTATEMENT"
        out.append({
            "acc": acc, "cik": to_int(r.get("CIK")), "period": period,
            "filed": parse_sec_date(r.get("FILING_DATE") or ""), "amend": amend,
            "name": (cp.get("FILINGMANAGER_NAME") or "").strip(),
        })
    return out


def choose_filings(metas: list[dict]) -> dict[str, dict]:
    """(CIK, 분기)마다 쓸 보고서 → {접수번호: 메타}. 규칙은 모듈 docstring."""
    groups: dict[tuple, list[dict]] = {}
    for m in metas:
        if m["cik"]:
            groups.setdefault((m["cik"], m["period"]), []).append(m)
    chosen: dict[str, dict] = {}
    for rows in groups.values():
        base_cands = [m for m in rows if m["amend"] in ("", "RESTATEMENT")]
        if not base_cands:
            continue  # NEW HOLDINGS 만 있고 원본이 창 밖이면 반쪽이라 쓰지 않는다
        base = max(base_cands, key=lambda m: (m["filed"], m["acc"]))
        chosen[base["acc"]] = base
        for m in rows:
            if m["amend"] == "NEW HOLDINGS" and (m["filed"], m["acc"]) > (base["filed"], base["acc"]):
                chosen[m["acc"]] = m
    return chosen


# ---------------------------------------------------------------------------
# INFOTABLE 집계
# ---------------------------------------------------------------------------

class PeriodAgg:
    """한 보고 분기의 CUSIP × 기관 집계. pos[cusip][cik] = [주식 수, 가치$]; opt 는 풋·콜."""

    __slots__ = ("period", "pos", "opt", "names", "titles", "filers")

    def __init__(self, period: str):
        self.period = period
        self.pos: dict[str, dict[int, list[int]]] = {}
        self.opt: dict[str, dict[str, dict[int, int]]] = {}
        self.names: dict[str, str] = {}
        self.titles: dict[str, str] = {}
        self.filers: set[int] = set()

    def add_row(self, cik: int, row: dict) -> None:
        cus = norm_cusip(row.get("CUSIP") or "")
        if not cus:
            return
        if (row.get("SSHPRNAMTTYPE") or "").strip().upper() != "SH":
            return  # 채권 원금(PRN)
        shares = to_int(row.get("SSHPRNAMT"))
        value = to_int(row.get("VALUE"))
        pc = (row.get("PUTCALL") or "").strip().lower()
        if pc in ("put", "call"):
            d = self.opt.setdefault(cus, {}).setdefault(pc, {})
            d[cik] = d.get(cik, 0) + shares
            return
        if pc:
            return
        slot = self.pos.setdefault(cus, {})
        cur = slot.get(cik)
        if cur is None:
            slot[cik] = [shares, value]
        else:
            cur[0] += shares
            cur[1] += value
        if cus not in self.names:
            self.names[cus] = (row.get("NAMEOFISSUER") or "").strip()
            self.titles[cus] = (row.get("TITLEOFCLASS") or "").strip()

    def totals(self) -> dict[str, list[int]]:
        """CUSIP → [보유 기관 수, 주식 수 합, 가치 합]."""
        out = {}
        for cus, slot in self.pos.items():
            sh = sum(v[0] for v in slot.values())
            val = sum(v[1] for v in slot.values())
            if sh > 0:
                out[cus] = [sum(1 for v in slot.values() if v[0] > 0), sh, val]
        return out


def aggregate_infotable(rows, chosen: dict[str, dict], aggs: dict[str, PeriodAgg]) -> int:
    """INFOTABLE 행 스트림 → 고른 보고서의 행만 분기별 집계에 더한다. 더한 행 수를 돌려준다."""
    n = 0
    for row in rows:
        meta = chosen.get(row.get("ACCESSION_NUMBER") or "")
        if not meta:
            continue
        agg = aggs.get(meta["period"])
        if agg is None:
            continue
        agg.add_row(meta["cik"], row)
        n += 1
    return n


# ---------------------------------------------------------------------------
# CUSIP → 티커
# ---------------------------------------------------------------------------

def pairs_from_13finfo(payload: dict, universe: set[str]) -> dict[str, str]:
    """기존 13F 스냅샷(13f.info)의 (CUSIP, 티커) 쌍 — 풋·콜 줄은 빼고, 스냅샷에 있는 티커만."""
    out: dict[str, str] = {}
    for inst in (payload or {}).get("institutions") or []:
        for q in inst.get("quarters") or [{"holdings": inst.get("holdings") or []}]:
            for h in q.get("holdings") or []:
                cus = norm_cusip(h.get("cusip") or "")
                t = str(h.get("ticker") or "").upper().replace("/", ".")
                if cus and t in universe and not h.get("putCall"):
                    out.setdefault(cus, t)
    return out


def name_match(name: str, cls: str, by_ticker: dict, by_name: dict) -> str | None:
    """발행사명·종류 → 스냅샷 티커(유일 일치만). 보통주가 아닌 종류는 거부."""
    from build_us_etf_holdings import class_letter, norm_name
    if not name or _NOT_COMMON.search(cls or ""):
        return None
    cands = by_name.get(norm_name(name), [])
    cl = class_letter(cls or "")
    if cl:
        exact = [c for c in cands if class_letter(by_ticker[c].get("company") or "") == cl]
        if len(exact) == 1:
            return exact[0]
        cands = [c for c in cands if class_letter(by_ticker[c].get("company") or "") is None]
    return cands[0] if len(cands) == 1 else None


def resolve_cusips(cusips, *, figi: dict, info_pairs: dict, list_rows: dict, infotable_names: dict,
                   by_ticker: dict, by_name: dict) -> tuple[dict[str, str], dict[str, str]]:
    """CUSIP → 티커(스냅샷에 있는 것만), CUSIP → 출처('figi'|'13finfo'|'name')."""
    out: dict[str, str] = {}
    src: dict[str, str] = {}
    for cus in cusips:
        ent = figi.get(cus)
        t = ent.get("t") if isinstance(ent, dict) else None
        if t and t in by_ticker:
            out[cus], src[cus] = t, "figi"
            continue
        if isinstance(ent, dict) and ent.get("t"):
            continue  # FIGI 가 스냅샷 밖 티커(우선주 등)라고 확인한 CUSIP 은 이름으로 잇지 않는다
        t = info_pairs.get(cus)
        if t:
            out[cus], src[cus] = t, "13finfo"
            continue
        lr = list_rows.get(cus) or {}
        name = lr.get("name") or (infotable_names.get(cus) or ("", ""))[0]
        cls = lr.get("cls") or (infotable_names.get(cus) or ("", ""))[1]
        t = name_match(name, cls, by_ticker, by_name)
        if t:
            out[cus], src[cus] = t, "name"
    return out, src


# ---------------------------------------------------------------------------
# 종목 레코드
# ---------------------------------------------------------------------------

_NICE_RATIOS = (2, 3, 4, 5, 8, 10, 20, 1.5, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 8, 1 / 10, 1 / 20, 2 / 3)


def split_ratio(cur: dict[int, list[int]], prev: dict[int, list[int]]) -> float | None:
    """계속 보유 기관의 (이번/직전) 주식 수 비율 중앙값이 분할 비율(2·3·1/2 …)에 3% 안으로 붙으면 그 비율."""
    ratios = [cur[c][0] / prev[c][0] for c in cur.keys() & prev.keys() if cur[c][0] > 0 and prev[c][0] > 0]
    if len(ratios) < SPLIT_MIN_N:
        return None
    r = median(ratios)
    for nice in _NICE_RATIOS:
        if abs(r / nice - 1) <= 0.03:
            return nice
    return None


def merge_by_ticker(pos: dict[str, dict[int, list[int]]], cmap: dict[str, str]) -> dict[str, dict[int, list[int]]]:
    """CUSIP 단위 기관 보유 → 티커 단위(같은 티커로 이어진 CUSIP 은 기관별로 더한다)."""
    out: dict[str, dict[int, list[int]]] = {}
    for cus, slot in pos.items():
        t = cmap.get(cus)
        if not t:
            continue
        dst = out.setdefault(t, {})
        for cik, (sh, val) in slot.items():
            cur = dst.get(cik)
            if cur is None:
                dst[cik] = [sh, val]
            else:
                cur[0] += sh
                cur[1] += val
    return out


def merge_opts_by_ticker(opt: dict, cmap: dict[str, str]) -> dict[str, dict[str, dict[int, int]]]:
    out: dict[str, dict[str, dict[int, int]]] = {}
    for cus, kinds in opt.items():
        t = cmap.get(cus)
        if not t:
            continue
        for kind, per in kinds.items():
            dst = out.setdefault(t, {}).setdefault(kind, {})
            for cik, sh in per.items():
                dst[cik] = dst.get(cik, 0) + sh
    return out


def ticker_record(cur: dict[int, list[int]], prev: dict[int, list[int]] | None,
                  cur_filers: set[int], prev_filers: set[int], *, opts: dict | None = None,
                  shares_out: float | None = None, trend: list | None = None) -> dict:
    """한 종목의 최신 분기 레코드. cur/prev = {CIK: [주식 수, 가치]}.

    c = [신규, 청산, 증가, 감소, 유지, 비교 가능 기관 수] — 두 분기 모두 제출한 기관끼리만.
    top = [[CIK, 주식 수, 직전 주식 수(분할 조정·비교 불가면 None), 가치], …] 주식 수 상위 10.
    """
    prev = prev or {}
    held = {c: v for c, v in cur.items() if v[0] > 0}
    prev_held = {c: v for c, v in prev.items() if v[0] > 0}
    ratio = split_ratio(held, prev_held) if prev_held else None
    adj = ratio or 1.0
    both = cur_filers & prev_filers
    new = closed = inc = dec = same = 0
    for c in both:
        a = held.get(c)
        b = prev_held.get(c)
        if a and not b:
            new += 1
        elif b and not a:
            closed += 1
        elif a and b:
            pb = b[0] * adj
            d = (a[0] - pb) / pb if pb else 0
            if abs(d) < SAME_TOL:
                same += 1
            elif d > 0:
                inc += 1
            else:
                dec += 1
    comparable = sum(1 for c in both if c in held or c in prev_held)
    shares = sum(v[0] for v in held.values())
    value = sum(v[1] for v in held.values())
    top = sorted(held.items(), key=lambda kv: (-kv[1][0], kv[0]))[:TOP_HOLDERS]
    top_rows = []
    for cik, (sh, val) in top:
        if cik in prev_filers:
            p = prev_held.get(cik)
            prev_sh = round(p[0] * adj) if p else 0
        else:
            prev_sh = None  # 직전 분기 13F 가 없는 기관 — 비교 불가
        top_rows.append([cik, sh, prev_sh, val])
    rec = {
        "h": len(held), "s": shares, "v": value,
        "ph": len(prev_held), "ps": sum(v[0] for v in prev_held.values()),
        "pv": sum(v[1] for v in prev_held.values()),
        "c": [new, closed, inc, dec, same, comparable],
        "top": top_rows,
    }
    if ratio:
        rec["split"] = round(ratio, 4)
    if shares_out and shares_out > 0:
        rec["so"] = shares_out
        rec["p"] = round(shares / shares_out * 100, 2)
    if opts:
        call = opts.get("call") or {}
        put = opts.get("put") or {}
        rec["o"] = [sum(1 for v in call.values() if v > 0), sum(call.values()),
                    sum(1 for v in put.values() if v > 0), sum(put.values())]
    if trend is not None:
        rec["tr"] = trend
    return rec


def ticker_totals(state_periods: dict, period: str, cmap: dict[str, str]) -> dict[str, list[int]]:
    """상태 파일의 분기 CUSIP 합계 → 티커 합계 [기관 수, 주식 수, 가치].
    한 티커에 CUSIP 이 둘이면 기관 수는 더한 값(두 CUSIP 을 모두 가진 기관은 두 번 셈 — 드묾)."""
    out: dict[str, list[int]] = {}
    for cus, (h, s, v) in ((state_periods.get(period) or {}).get("totals") or {}).items():
        t = cmap.get(cus)
        if not t:
            continue
        cur = out.setdefault(t, [0, 0, 0])
        cur[0] += h
        cur[1] += s
        cur[2] += v
    return out


def shard_key(ticker: str) -> str:
    c = (ticker or "_")[0].upper()
    return c if "A" <= c <= "Z" else "_"


def shares_outstanding(ticker: str) -> float | None:
    """발행주식 수(주) — 종목 상세 파일 fundamentals.sharesB(십억 주). 없으면 None."""
    d = load_json(DETAILS / f"{ticker}.json", None)
    try:
        v = float(((d or {}).get("fundamentals") or {}).get("sharesB"))
    except (TypeError, ValueError):
        return None
    return v * 1e9 if v > 0 else None


# ---------------------------------------------------------------------------
# 입출력
# ---------------------------------------------------------------------------

def sec_bytes(url: str) -> bytes:
    from sec_client import sec_get
    return sec_get(url)


def download(url: str, dest: Path) -> Path:
    """zip 을 임시 파일로 스트리밍 저장(메모리에 통째로 올리지 않는다)."""
    from sec_client import SEC_HEADERS
    headers = {k: v for k, v in SEC_HEADERS.items() if k != "Accept-Encoding"}
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300) as r, \
                    open(dest, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            return dest
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            time.sleep(10 * (attempt + 1))
    raise last


def tsv_rows(zf: zipfile.ZipFile, member: str, fields: tuple[str, ...] | None = None):
    """zip 안 TSV 를 한 줄씩 dict 로(필요한 열만). 따옴표를 쓰지 않는 파일이라 QUOTE_NONE."""
    name = next((n for n in zf.namelist() if n.upper().endswith(member.upper())), None)
    if not name:
        raise RuntimeError(f"{member} 없음")
    with zf.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline="")
        reader = csv.reader(text, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(reader)
        idx = {h.strip().upper(): i for i, h in enumerate(header)}
        keep = [(f, idx[f]) for f in (fields or tuple(idx)) if f in idx]
        for row in reader:
            yield {f: (row[i] if i < len(row) else "") for f, i in keep}


INFO_FIELDS = ("ACCESSION_NUMBER", "NAMEOFISSUER", "TITLEOFCLASS", "CUSIP", "VALUE",
               "SSHPRNAMT", "SSHPRNAMTTYPE", "PUTCALL")


def write_if_changed(path: Path, obj) -> bool:
    from briefing_store import atomic_write_text
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    try:
        if path.read_text(encoding="utf-8") == text:
            return False
    except FileNotFoundError:
        pass
    atomic_write_text(path, text)
    return True


def stock_universe_all(snapshot: dict) -> tuple[dict[str, dict], dict[str, list[str]]]:
    """(티커 → 행, 정규화 회사명 → [티커]) — ETF 포함(13F 는 ETF 보유도 보고한다)."""
    from build_us_etf_holdings import norm_name
    by_ticker: dict[str, dict] = {}
    by_name: dict[str, list[str]] = {}
    for s in snapshot.get("stocks") or []:
        if not isinstance(s, dict) or not s.get("ticker"):
            continue
        t = str(s["ticker"])
        by_ticker[t] = s
        key = norm_name(s.get("company") or "")
        if key:
            by_name.setdefault(key, []).append(t)
    return by_ticker, by_name


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def plan_datasets(datasets: list[dict], state: dict, quarters: int, force: bool) -> tuple[list[dict], list[str]]:
    """받을 데이터셋 창과 다시 계산할 분기. 새 창이 없으면 ([], [])."""
    if not datasets:
        return [], []
    window = datasets[-(quarters + 1):]  # 추이 q 분기 + 최신 분기의 '다음 창'은 아직 없으므로 q+1 이면 넉넉
    latest = window[-1]
    done = state.get("latestDataset")
    have = set((state.get("periods") or {}).keys())
    if done == latest["name"] and not force:
        return [], []
    wanted_periods = [d["period"] for d in window[-quarters:]]
    need = {window[-1]["period"], window[-2]["period"]} if len(window) >= 2 else {window[-1]["period"]}
    # 상태에 없는 분기(처음 실행 등)와 아직 잠정인 분기는 다시 계산한다.
    for p in wanted_periods:
        st = (state.get("periods") or {}).get(p)
        if force or p not in have or not (st or {}).get("final"):
            need.add(p)
    names = set()
    by_period = {d["period"]: i for i, d in enumerate(datasets)}
    for p in need:
        i = by_period.get(p)
        if i is None:
            continue
        names.add(datasets[i]["name"])
        if i + 1 < len(datasets):
            names.add(datasets[i + 1]["name"])  # 늦게 낸 보고서·정정본
    chosen = [d for d in datasets if d["name"] in names]
    return chosen, sorted(need)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quarters", type=int, default=DEFAULT_QUARTERS)
    ap.add_argument("--figi-budget", type=int, default=3000, help="이번 실행에서 새로 물어볼 CUSIP 수(0=조회 안 함)")
    ap.add_argument("--force", action="store_true", help="이미 처리한 최신 데이터셋이어도 다시 계산")
    ap.add_argument("--zip-dir", default="", help="미리 받아 둔 <창이름>_form13f.zip 폴더(로컬 확인용)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    state = load_json(STATE_JSON, {})
    prev_index = load_json(OUT_JSON, {})
    try:
        datasets = parse_dataset_links(sec_bytes(DATASETS_PAGE).decode("utf-8", "replace"))
    except Exception as exc:
        print(f"[error] 13F 데이터셋 목록 실패 — 기존 파일 유지: {exc}", file=sys.stderr)
        return 1
    if len(datasets) < 2:
        print("[error] 13F 데이터셋 창이 2개 미만 — 페이지 형식이 바뀌었는지 확인", file=sys.stderr)
        return 1
    todo, need_periods = plan_datasets(datasets, state, args.quarters, args.force)
    if not todo:
        print(f"새 13F 데이터셋 없음(최신 {datasets[-1]['name']} 처리 완료) — 그대로 둔다")
        return 0
    latest_p = datasets[-1]["period"]
    prev_p = datasets[-2]["period"]
    print(f"데이터셋 {len(todo)}개 처리: {', '.join(d['name'] for d in todo)} · 다시 계산할 분기 {need_periods}")

    snap = load_json(SNAPSHOT, {})
    by_ticker, by_name = stock_universe_all(snap)
    if not by_ticker:
        print("[error] 스냅샷을 읽지 못함 — 기존 파일 유지", file=sys.stderr)
        return 1

    tmp = Path(tempfile.mkdtemp(prefix="mir13f_"))
    errors: list[str] = []
    try:
        # 1단계: 각 창의 SUBMISSION·COVERPAGE → 보고서 고르기(창을 가로질러 정정본 중복 제거).
        zips: dict[str, Path] = {}
        metas: list[dict] = []
        need_set = set(need_periods)
        for d in todo:
            local = Path(args.zip_dir) / f"{d['name']}_form13f.zip" if args.zip_dir else None
            if local and local.exists():
                path = local
            else:
                path = tmp / f"{d['name']}.zip"
                print(f"  받는 중 {d['url']}")
                download(d["url"], path)
            zips[d["name"]] = path
            with zipfile.ZipFile(path) as zf:
                sub = list(tsv_rows(zf, "SUBMISSION.tsv"))
                cov = list(tsv_rows(zf, "COVERPAGE.tsv", ("ACCESSION_NUMBER", "ISAMENDMENT", "AMENDMENTTYPE",
                                                          "FILINGMANAGER_NAME", "REPORTTYPE")))
            got = filing_meta(sub, cov, need_set)
            metas.extend(got)
            print(f"  {d['name']}: 보유 보고서 {len(got)}건(대상 분기)")
        chosen = choose_filings(metas)
        filers: dict[str, set[int]] = {}
        names: dict[int, tuple[str, str]] = {}
        for m in chosen.values():
            filers.setdefault(m["period"], set()).add(m["cik"])
            if m["name"] and (m["cik"] not in names or m["filed"] >= names[m["cik"]][1]):
                names[m["cik"]] = (m["name"], m["filed"])
        # 2단계: INFOTABLE 스트리밍 — 분기가 끝나면(그 분기 보고서가 든 마지막 창을 지나면) 합계로 줄인다.
        keep_full = {latest_p, prev_p}
        aggs: dict[str, PeriodAgg] = {p: PeriodAgg(p) for p in need_periods}
        totals: dict[str, dict] = {}
        infotable_names: dict[str, tuple[str, str]] = {}
        for i, d in enumerate(todo):
            with zipfile.ZipFile(zips[d["name"]]) as zf:
                n = aggregate_infotable(tsv_rows(zf, "INFOTABLE.tsv", INFO_FIELDS), chosen, aggs)
            print(f"  {d['name']}: INFOTABLE 행 {n:,}개 반영")
            if not args.zip_dir:
                try:
                    zips[d["name"]].unlink()
                except OSError:
                    pass
            # 분기 p 의 보고서는 그 분기 창과 다음 창에만 있다. 남은 창에 둘 다 없으면 합계로 줄여 메모리를 비운다.
            for p in list(aggs):
                if p in keep_full:
                    continue
                pi = period_index(datasets, p)
                if not any(datasets_index(datasets, x) in (pi, pi + 1) for x in todo[i + 1:]):
                    totals[p] = aggs[p].totals()
                    for cus, nm in aggs[p].names.items():
                        infotable_names.setdefault(cus, (nm, aggs[p].titles.get(cus, "")))
                    del aggs[p]
        for p, agg in aggs.items():
            totals[p] = agg.totals()
            for cus, nm in agg.names.items():
                infotable_names[cus] = (nm, agg.titles.get(cus, ""))
        cur_agg = aggs.get(latest_p)
        prev_agg = aggs.get(prev_p)
        if not cur_agg or not cur_agg.pos:
            print("[error] 최신 분기 보유 행이 0건 — 기존 파일 유지", file=sys.stderr)
            return 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # 3단계: CUSIP → 티커.
    today = now_kst().date().isoformat()
    figi: dict = {**load_json(ETF_CUSIP_MAP, {}), **load_json(CUSIP_MAP, {})}
    own_figi: dict = load_json(CUSIP_MAP, {})
    info_pairs = pairs_from_13finfo(load_json(INST_13F, {}), set(by_ticker))
    list_rows: dict = {}
    try:
        links = parse_list_links(sec_bytes(LIST_PAGE).decode("utf-8", "replace"))
        if links:
            list_rows = parse_13f_list(sec_bytes(links[0]).decode("latin-1"))
            print(f"13(f) 증권 목록 {links[0].rsplit('/', 1)[-1]}: {len(list_rows):,}개")
    except Exception as exc:
        errors.append(f"13(f) 목록: {exc}")
        print(f"[warn] 13(f) 증권 목록 실패(INFOTABLE 발행사명으로 대신): {exc}")
    cur_totals = totals.get(latest_p) or {}
    cmap, csrc = resolve_cusips(cur_totals.keys() | set().union(*[set(t) for t in totals.values()]),
                                figi=figi, info_pairs=info_pairs, list_rows=list_rows,
                                infotable_names=infotable_names, by_ticker=by_ticker, by_name=by_name)
    if args.figi_budget > 0:
        from build_us_etf_holdings import figi_lookup
        floor = (now_kst().date() - timedelta(days=FIGI_RECHECK_DAYS)).isoformat()
        cands = []
        for cus, (_h, _s, val) in cur_totals.items():
            if cus in cmap or val < FIGI_MIN_VALUE:
                continue
            ent = figi.get(cus)
            if isinstance(ent, dict) and (ent.get("t") or ent.get("d", "") >= floor):
                continue
            nm, cls = infotable_names.get(cus, ("", ""))
            if _NOT_COMMON.search((list_rows.get(cus) or {}).get("cls") or cls or ""):
                continue
            cands.append((val, cus))
        ask = [c for _v, c in sorted(cands, reverse=True)[:args.figi_budget]]
        if ask:
            print(f"OpenFIGI 조회 {len(ask)}건(합계 가치 큰 순)…")
            found = figi_lookup(ask, os.environ.get("OPENFIGI_API_KEY", "").strip())
            for cus, tk in found.items():
                own_figi[cus] = {"t": tk, "d": today}
                figi[cus] = own_figi[cus]
            cmap, csrc = resolve_cusips(cur_totals.keys() | set().union(*[set(t) for t in totals.values()]),
                                        figi=figi, info_pairs=info_pairs, list_rows=list_rows,
                                        infotable_names=infotable_names, by_ticker=by_ticker, by_name=by_name)
    total_val = sum(v[2] for v in cur_totals.values()) or 1
    mapped_val = sum(v[2] for c, v in cur_totals.items() if c in cmap)
    src_count = {k: sum(1 for c in cur_totals if csrc.get(c) == k) for k in ("figi", "13finfo", "name")}

    # 4단계: 상태(분기별 CUSIP 합계) 갱신 — 티커를 못 이은 작은 CUSIP 은 버린다.
    periods_state = dict(state.get("periods") or {})
    for p, tot in totals.items():
        kept = {c: v for c, v in tot.items() if c in cmap or v[2] >= STATE_MIN_VALUE}
        final = p != latest_p  # 최신 분기만 다음 창(늦게 낸 보고서)이 아직 없다
        periods_state[p] = {"final": final, "filers": len(filers.get(p, ())), "totals": kept}
    all_periods = [d["period"] for d in datasets[-args.quarters:]]
    periods_state = {p: v for p, v in periods_state.items() if p in all_periods}

    # 5단계: 종목 레코드 · 샤드.
    cur_t = merge_by_ticker(cur_agg.pos, cmap)
    prev_t = merge_by_ticker(prev_agg.pos, cmap) if prev_agg else {}
    opt_t = merge_opts_by_ticker(cur_agg.opt, cmap)
    trend_tot = {p: ticker_totals(periods_state, p, cmap) for p in all_periods}
    shards: dict[str, dict] = {}
    cur_filers = filers.get(latest_p, set())
    prev_filers = filers.get(prev_p, set())
    for t, cur in cur_t.items():
        trend = [trend_tot[p].get(t) for p in all_periods]
        rec = ticker_record(cur, prev_t.get(t), cur_filers, prev_filers, opts=opt_t.get(t),
                            shares_out=shares_outstanding(t), trend=trend)
        if rec["h"] <= 0:
            continue
        sh = shards.setdefault(shard_key(t), {"n": {}, "t": {}})
        sh["t"][t] = rec
        for row in rec["top"]:
            nm = (names.get(row[0]) or ("",))[0]
            if nm:
                sh["n"][str(row[0])] = nm
    count = sum(len(s["t"]) for s in shards.values())
    print(f"종목 {count:,}개 · 최신 {latest_p} 보고 기관 {len(cur_filers):,}곳 · "
          f"가치 기준 티커 연결 {mapped_val / total_val * 100:.1f}% · 출처 {src_count}")
    if count == 0:
        print("[error] 티커로 이은 종목이 0개 — 기존 파일 유지", file=sys.stderr)
        return 1
    from sec_client import assert_not_regressing, write_data
    from briefing_store import atomic_write_text
    assert_not_regressing(OUT_JSON, {"count": count}, floor_ratio=0.7)

    shard_ver: dict[str, str] = {}
    written = 0
    for k, obj in sorted(shards.items()):
        if write_if_changed(DIR / f"{k}.json", obj):
            written += 1
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        shard_ver[k] = format(zlib.crc32(text.encode("utf-8")), "08x")
    for stale in DIR.glob("*.json"):
        if len(stale.stem) == 1 and stale.stem not in shards:
            stale.unlink()

    ds_by_period = {d["period"]: d for d in datasets}
    payload = {
        "updatedAtKst": now_kst().strftime("%Y-%m-%d %H:%M KST"),
        "source": "SEC Form 13F Data Sets (13F-HR 보유 내역)",
        "note": "분기말 기준 보고서입니다. 분기말 후 45일 안에 제출되고 데이터셋은 그 뒤 2주쯤 지나 공개됩니다.",
        "count": count,
        "quarters": all_periods,
        "latest": latest_p,
        "prev": prev_p,
        "latestPreliminary": True,
        "filers": {p: (periods_state.get(p) or {}).get("filers") for p in all_periods},
        "datasets": [{"name": ds_by_period[p]["name"], "period": p, "url": ds_by_period[p]["url"]}
                     for p in all_periods if p in ds_by_period],
        "shards": sorted(shards),
        "shardVer": shard_ver,
        "coverage": {"mappedValuePct": round(mapped_val / total_val * 100, 1),
                     "mappedCusips": len([c for c in cur_totals if c in cmap]),
                     "cusips": len(cur_totals), "bySource": src_count},
        "errors": errors[:20],
    }
    write_data(OUT_JSON, OUT_JS, "US_INST_HOLDERS_INDEX", payload, indent=None)
    state_out = {"latestDataset": datasets[-1]["name"], "updatedAtKst": payload["updatedAtKst"],
                 "periods": dict(sorted(periods_state.items()))}
    atomic_write_text(STATE_JSON, json.dumps(state_out, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")
    atomic_write_text(CUSIP_MAP, json.dumps(dict(sorted(own_figi.items())), ensure_ascii=False,
                                            separators=(",", ":")) + "\n")
    print(f"샤드 {len(shards)}개(바뀜 {written}) · 인덱스 {OUT_JSON.relative_to(ROOT)}")
    if args.push:
        from sec_client import git_publish
        if not git_publish(["data/institutional_holders"], "institutional holders (13F data sets)"):
            return 1
    return 0


def datasets_index(datasets: list[dict], d: dict) -> int:
    return next((i for i, x in enumerate(datasets) if x["name"] == d["name"]), -1)


def period_index(datasets: list[dict], period: str) -> int:
    return next((i for i, x in enumerate(datasets) if x["period"] == period), -1)


if __name__ == "__main__":
    raise SystemExit(main())
