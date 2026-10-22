#!/usr/bin/env python3
"""국내 CB·BW 오버행 — 미상환 전환사채·신주인수권부사채의 잠재 희석률.

원천은 정기보고서(사업·반기·분기) 원문 표 두 개다. DART 정기보고서 주요정보 API(DS002)에는
이 표가 없어(회사채·CP·신종자본증권 미상환 잔액만 있다) 원문(document.xml)을 읽는다.
원문 표는 dart4 양식의 고정 코드가 붙어 있어 라벨 추측 없이 칸을 집을 수 있다:

  TABLE-GROUP ACLASS="CB"  미상환 전환사채 발행현황
      CB_SEQ 회차 · CB_DT 발행일 · CB_FDT 만기일 · CB_PE 전환청구가능기간 · CB_PR 전환가액
      CB_AMN 미상환 권면총액 · CB_CN 전환가능주식수 · (합계 행은 *_T 코드)
  TABLE-GROUP ACLASS="BW"  미상환 신주인수권부사채 등 발행현황
      BW_* 같은 구성 — BW_PR 행사가액 · BW_AMN 미상환 권면총액 · BW_CN 행사가능주식수
  TABLE-GROUP ACLASS="TOT_STK"  주식의 총수 — SUM_ISU_STK3 발행주식의 총수(합계)
  금액 단위는 표머리 AUNIT="WONSTOCK"(원·천원·백만원 등)에 따라 다르다.

잠재 희석률 = (전환·행사 가능 주식수 합) ÷ 같은 보고서의 발행주식총수 × 100.
분자·분모가 같은 기준일이라 서로 어긋나지 않는다. 기준일 이후 전환·상환·리픽싱은 반영되지 않으므로
화면은 기준일을 함께 보여 준다. 만기일이나 전환(행사)기간 끝이 지난 행은 이미 사라진 물량이라 뺀다.

호출 예산(DART 일일 2만 회):
  1) 대상 추리기 — list.json 벌크(주요사항보고서 B001)에서 최근 5년 '전환사채권발행결정'·
     '신주인수권부사채권발행결정' 을 낸 상장사만. 첫 실행 ≈ 400회, 이후 하루치 몇 회.
  2) 최신 정기보고서 — list.json 벌크(A001~A003)로 회사별 최신 접수번호. 이후 하루치 몇 회.
  3) 원문 — 접수번호가 바뀐 회사만 받는다(state 에 파싱 결과 캐시). 실행당 --max-docs 상한.

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import html
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글·U+2014 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import DART_REGRESSION_FLOOR, write_data  # noqa: E402
from step_budget import StepBudget  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "cb_overhang.json"
OUT_JS = ROOT / "data" / "korea" / "cb_overhang.js"
# 빌더 전용 상태(대상 회사·최신 정기보고서·파싱 캐시). 배포에서 뺀다(deploy-pages.yml).
STATE_JSON = ROOT / "data" / "korea" / "cb_overhang_state.json"
DOC_URL = "https://opendart.fss.or.kr/api/document.xml"

PARSER_VERSION = 1
# CB 행 자기검증: 주식수 × 전환가액 ≈ 미상환 권면총액 × 전환비율. 실측 456행 중 19행이 단위·자릿수 오기재로
# 수십~백만 배 어긋났다(잔액 '3,000' 원 · 주식수 천 주 단위 · 전환가액 '3' 등). 이 범위를 벗어나면 그 회사를 싣지 않는다.
# BW 는 신주인수권이 사채와 따로 남을 수 있어(분리형·사채 일부 상환) 같은 식이 성립하지 않으므로 검사하지 않는다.
CB_RATIO_TOLERANCE = (0.8, 1.25)
DECISION_KEYS = ("전환사채권발행결정", "신주인수권부사채권발행결정")
UNIVERSE_YEARS = 5           # CB·BW 만기는 대개 3~5년
REPORT_LOOKBACK_DAYS = 460   # 최신 정기보고서 첫 탐색(사업보고서 3월 말 + 여유)
RESCAN_OVERLAP_DAYS = 7      # 증분 스캔을 며칠 겹쳐 지연 등록분을 놓치지 않는다
KINDS = ("CB", "BW")

# 표머리 금액 단위. 한글 표기가 우선, 없으면 ENG 속성.
_UNIT_KO = (("억원", 100_000_000), ("백만원", 1_000_000), ("천원", 1_000), ("원", 1))
_UNIT_EN = (("krw 100 million", 100_000_000), ("krw million", 1_000_000), ("krw thousand", 1_000), ("krw", 1))


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def today_kst() -> date:
    return datetime.now(KST).date()


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


# ---------------------------------------------------------------------------- 원문 파싱(순수 함수)

def clean_text(raw: str) -> str:
    s = re.sub(r"<[^>]+>", " ", raw or "")
    return " ".join(html.unescape(s).split())


def to_int(text) -> int | None:
    """'1,158,480' / '1,158,480주' → 1158480. '-'·빈칸·숫자 아닌 글은 None(추측하지 않는다)."""
    s = clean_text(str(text or "")).replace(",", "").replace(" ", "")
    s = re.sub(r"(원|주)$", "", s)
    if not s or s in ("-", "－"):
        return None
    if not re.fullmatch(r"\d+(\.\d+)?", s):
        return None
    v = float(s)
    return int(round(v))


def to_float(text) -> float | None:
    s = clean_text(str(text or "")).replace(",", "").replace("%", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def row_consistent(price, remaining, shares, ratio_pct=None) -> bool:
    """CB 한 행의 주식수·전환가액·잔액이 서로 맞는가. 셋 중 하나라도 없으면 판단하지 않는다(True)."""
    if not (price and remaining and shares):
        return True
    expected = (ratio_pct or 100.0) / 100.0
    got = shares * price / remaining
    lo, hi = CB_RATIO_TOLERANCE
    return lo * expected <= got <= hi * expected


def to_iso(unit_value: str | None, text: str | None) -> str | None:
    v = str(unit_value or "").strip()
    if re.fullmatch(r"\d{8}", v):
        return f"{v[:4]}-{v[4:6]}-{v[6:]}"
    m = re.search(r"(\d{4})\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})", clean_text(text or ""))
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


def period_end(text: str | None) -> str | None:
    """'2026.03.11 ~ 2030.02.11' → '2030-02-11'(마지막 날짜). 못 읽으면 None."""
    found = re.findall(r"(\d{4})\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})", clean_text(text or ""))
    if not found:
        return None
    y, m, d = found[-1]
    return f"{y}-{int(m):02d}-{int(d):02d}"


def unit_multiplier(group_xml: str) -> int | None:
    """표머리 WONSTOCK 칸의 금액 단위. 모르면 None(금액을 싣지 않는다)."""
    m = re.search(r'<TU\b[^>]*AUNIT="WONSTOCK"[^>]*>(.*?)</TU>', group_xml, re.S)
    if not m:
        return None
    tag = m.group(0)
    ko = clean_text(m.group(1))
    for key, mult in _UNIT_KO:
        if key in ko:
            return mult
    eng = re.search(r'ENG="([^"]*)"', tag)
    if eng:
        low = eng.group(1).lower()
        for key, mult in _UNIT_EN:
            if key in low:
                return mult
    return None


def table_groups(xml: str, aclass: str) -> list[str]:
    out = []
    for m in re.finditer(rf'<TABLE-GROUP\b[^>]*ACLASS="{aclass}"[^>]*>', xml):
        end = xml.find("</TABLE-GROUP>", m.end())
        out.append(xml[m.start(): end if end > 0 else len(xml)])
    return out


def row_cells(tr_xml: str) -> dict[str, dict]:
    """한 행의 코드 붙은 칸 {code: {text, value}}. TE 는 ACODE, TU 는 AUNIT(+AUNITVALUE)."""
    cells: dict[str, dict] = {}
    for m in re.finditer(r"<(TE|TU)\b([^>]*)>(.*?)</\1>", tr_xml, re.S):
        attrs = m.group(2)
        code = re.search(r'A(?:CODE|UNIT)="([^"]+)"', attrs)
        if not code:
            continue
        val = re.search(r'AUNITVALUE="([^"]*)"', attrs)
        cells.setdefault(code.group(1), {"text": clean_text(m.group(3)), "value": val.group(1) if val else None})
    return cells


def base_date(group_xml: str) -> str | None:
    m = re.search(r'AUNIT="BASE_DT"[^>]*AUNITVALUE="(\d{8})"', group_xml) or \
        re.search(r'AUNITVALUE="(\d{8})"[^>]*AUNIT="BASE_DT"', group_xml)
    return to_iso(m.group(1), None) if m else None


def parse_bond_group(group_xml: str, kind: str) -> dict:
    """미상환 CB/BW 표 하나 → {baseDate, rows, total}. rows 는 숫자가 하나라도 있는 행만."""
    mult = unit_multiplier(group_xml)
    rows, total = [], None
    for tr in re.findall(r"<TR\b.*?</TR>", group_xml, re.S):
        c = row_cells(tr)
        if f"{kind}_CNT" in c:
            total = to_int(c[f"{kind}_CNT"]["text"])
            continue
        if f"{kind}_CN" not in c:
            continue
        shares = to_int(c[f"{kind}_CN"]["text"])
        amount = to_int(c.get(f"{kind}_AMN", {}).get("text"))
        if not shares and not amount:
            continue                          # '-' 만 있는 빈 양식 행
        g = lambda k: c.get(f"{kind}_{k}", {})  # noqa: E731
        price = to_int(g("PR").get("text"))
        remaining = amount * mult if (amount is not None and mult) else None
        rows.append({
            "kind": kind,
            "seq": g("SEQ").get("text") or None,
            "issueDate": to_iso(g("DT").get("value"), g("DT").get("text")),
            "maturity": to_iso(g("FDT").get("value"), g("FDT").get("text")),
            "periodEnd": period_end(g("PE").get("text")),
            "price": price,
            "remaining": remaining,
            "shares": shares,
        })
        ratio = to_float(g("RAT").get("text"))
        if ratio and ratio != 100:
            rows[-1]["ratio"] = ratio
    return {"baseDate": base_date(group_xml), "rows": rows, "total": total}


def parse_total_shares(xml: str) -> tuple[int | None, str | None]:
    """주식의 총수 표의 '발행주식의 총수' 합계(보통주+우선주). 없으면 보통주 칸."""
    for g in table_groups(xml, "TOT_STK"):
        m = re.search(r'<TE\b[^>]*ACODE="SUM_ISU_STK3"[^>]*>(.*?)</TE>', g, re.S)
        v = to_int(m.group(1)) if m else None
        if not v:
            m = re.search(r'<TE\b[^>]*ACODE="ISU_STK3"[^>]*>(.*?)</TE>', g, re.S)
            v = to_int(m.group(1)) if m else None
        if v:
            return v, base_date(g)
    return None, None


def parse_document(xml: str) -> dict:
    """정기보고서 원문 → {hasTables, baseDate, totalShares, rows, verified}.

    verified=False: 표 합계 행의 주식수와 행 합이 어긋남(자동 판독을 믿을 수 없음 — 화면이 배지를 달지 않는다).
    """
    rows, verified, base, has = [], True, None, False
    for kind in KINDS:
        for g in table_groups(xml, kind):
            has = True
            p = parse_bond_group(g, kind)
            base = base or p["baseDate"]
            rows.extend(p["rows"])
            row_sum = sum(r["shares"] or 0 for r in p["rows"])
            if p["total"] is not None and p["rows"] and p["total"] != row_sum:
                verified = False
    total_shares, stk_base = parse_total_shares(xml)
    return {"hasTables": has, "baseDate": base or stk_base, "totalShares": total_shares,
            "rows": rows, "verified": verified}


def live_rows(rows: list[dict], today: str) -> list[dict]:
    """만기일 또는 전환(행사)기간 끝이 오늘 이전인 행은 뺀다 — 이미 상환·전환됐거나 더는 주식이 안 된다."""
    out = []
    for r in rows:
        if r.get("maturity") and r["maturity"] < today:
            continue
        if r.get("periodEnd") and r["periodEnd"] < today:
            continue
        out.append(r)
    return out


def summarize(parsed: dict, today: str) -> dict | None:
    """회사 하나의 발행 레코드. 살아 있는 행이 없으면 None."""
    rows = live_rows(parsed.get("rows") or [], today)
    if not rows:
        return None
    consistent = all(row_consistent(r.get("price"), r.get("remaining"), r.get("shares"), r.get("ratio"))
                     for r in rows if r.get("kind") == "CB")
    shares = sum(r["shares"] or 0 for r in rows)
    total = parsed.get("totalShares")
    pct = round(shares / total * 100, 2) if (shares and total) else None
    rec = {
        "baseDate": parsed.get("baseDate"),
        "totalShares": total,
        "convShares": shares or None,
        "pct": pct,
        "rows": [{k: v for k, v in r.items() if k not in ("periodEnd", "ratio") and v is not None} for r in rows],
    }
    if parsed.get("verified") is False or not consistent:
        rec["verified"] = False
    return rec


def report_period(title: str) -> str:
    """'반기보고서 (2026.06)' → '2026.06'. 못 읽으면 ''."""
    m = re.search(r"\((\d{4})\.(\d{2})\)", title or "")
    return f"{m.group(1)}.{m.group(2)}" if m else ""


def pick_latest_reports(rows: list[dict], prev: dict | None = None) -> dict[str, dict]:
    """회사별 최신 정기보고서. 기간(YYYY.MM)이 먼저, 같은 기간이면 늦은 접수(정정본)가 이긴다.

    늦게 낸 '[기재정정]사업보고서 (2025.12)' 가 '반기보고서 (2026.06)' 를 밀어내지 않게 접수번호만으로 고르지 않는다.
    """
    best: dict[str, dict] = {k: dict(v) for k, v in (prev or {}).items()}
    for r in rows:
        title = r.get("title") or ""
        rno = r.get("rceptNo") or ""
        period = report_period(title)
        if not period or not rno:
            continue
        cur = best.get(r["ticker"])
        key = (period, rno)
        if cur is None or key > (cur.get("period") or "", cur.get("rceptNo") or ""):
            best[r["ticker"]] = {"rceptNo": rno, "title": title, "period": period,
                                 "company": r.get("company") or (cur or {}).get("company") or ""}
    return best


def is_decision(title: str) -> bool:
    t = (title or "").replace(" ", "")
    return any(k in t for k in DECISION_KEYS)


# ---------------------------------------------------------------------------- DART 호출

def _rcept_from_link(link: str) -> str:
    m = re.search(r"rcpNo=(\d+)", link or "")
    return m.group(1) if m else ""


def scan_list(api_key: str, bgn: date, end: date, detail_types: tuple[str, ...], keep=None):
    """kr_dart_scan.scan + 실패 개수. 실패한 창이 있으면 다음 실행에서 그 구간부터 다시 본다."""
    from kr_dart_scan import scan

    errors = []

    def log(msg: str):
        print(msg, flush=True)
        if "실패" in msg or "status=" in msg:
            errors.append(msg)

    rows = scan(api_key, bgn, end, detail_types, keep=keep, log=log)
    for r in rows:
        r["rceptNo"] = _rcept_from_link(r.get("link"))
    return rows, len(errors)


def _decode(raw: bytes) -> str:
    for enc in ("utf-8", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def fetch_document(api_key: str, rcept_no: str) -> str | None:
    """정기보고서 본문 XML. 실패면 None(다음 실행에 다시)."""
    from build_kr_disclosures import dart_abort_if_rate_limited, dart_pace

    url = f"{DOC_URL}?crtfc_key={api_key}&rcept_no={rcept_no}"
    raw = None
    for attempt in range(3):
        try:
            dart_pace()
            req = urllib.request.Request(url, headers={"User-Agent": "Mir-US-Stocks/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                raw = r.read()
            break
        except Exception as exc:  # noqa: BLE001
            if attempt == 2:
                print(f"  [원문] {rcept_no} 받기 실패: {type(exc).__name__}")
                return None
            time.sleep(3 * (attempt + 1))
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        m = re.search(rb"<status>(\d+)</status>", raw or b"")
        if m:
            dart_abort_if_rate_limited(m.group(1).decode(), "document.xml")
        return None
    names = zf.namelist()
    main = f"{rcept_no}.xml"
    name = main if main in names else (sorted(names, key=lambda n: zf.getinfo(n).file_size)[-1] if names else None)
    return _decode(zf.read(name)) if name else None


# ---------------------------------------------------------------------------- 실행

def _ymd(s: str | None) -> date | None:
    try:
        return datetime.strptime(str(s), "%Y-%m-%d").date()
    except Exception:
        return None


def update_universe(api_key: str, state: dict, today: date) -> int:
    """발행결정을 낸 상장사 {ticker: 마지막 결정일}. 실패한 창이 있으면 scannedThrough 를 올리지 않는다."""
    uni = state.setdefault("universe", {})
    last = _ymd(state.get("decisionsThrough"))
    floor = today - timedelta(days=365 * UNIVERSE_YEARS)
    bgn = max(floor, last - timedelta(days=RESCAN_OVERLAP_DAYS)) if last else floor
    rows, errs = scan_list(api_key, bgn, today, ("B001",), keep=is_decision)
    for r in rows:
        if r.get("fileDate") and r["fileDate"] > uni.get(r["ticker"], ""):
            uni[r["ticker"]] = r["fileDate"]
    # 5년 넘게 새 결정이 없는 회사는 뺀다(남은 물량이 있으면 아래 build 가 다시 붙잡는다).
    for t in [t for t, d in uni.items() if d < floor.isoformat()]:
        uni.pop(t, None)
    if not errs:
        state["decisionsThrough"] = today.isoformat()
    print(f"[CB오버행] 발행결정 {len(rows)}건 · 대상 {len(uni)}사 (스캔 {bgn}~{today}, 실패 {errs})", flush=True)
    return errs


def update_reports(api_key: str, state: dict, today: date) -> int:
    last = _ymd(state.get("reportsThrough"))
    bgn = (last - timedelta(days=RESCAN_OVERLAP_DAYS)) if last else today - timedelta(days=REPORT_LOOKBACK_DAYS)
    rows, errs = scan_list(api_key, bgn, today, ("A001", "A002", "A003"))
    state["reports"] = pick_latest_reports(rows, state.get("reports"))
    if not errs:
        state["reportsThrough"] = today.isoformat()
    print(f"[CB오버행] 정기보고서 {len(rows)}건 · 회사별 최신 {len(state['reports'])}사 (실패 {errs})", flush=True)
    return errs


def build(api_key: str, state: dict, prev_companies: dict, max_docs: int, budget: StepBudget,
          only: set[str] | None = None) -> tuple[dict, dict]:
    today = today_kst()
    scan_errs = 0
    if not only:
        scan_errs += update_universe(api_key, state, today)
    scan_errs += update_reports(api_key, state, today)
    reports = state.get("reports") or {}
    cache = state.setdefault("parsed", {})

    # 대상: 최근 발행결정 회사 + 직전 결과에 물량이 남아 있던 회사(오래된 CB 도 놓치지 않게).
    targets = set(only) if only else (set(state.get("universe") or {}) | set(prev_companies))
    todo = []
    for t in sorted(targets):
        rep = reports.get(t)
        if not rep:
            continue
        c = cache.get(t)
        if c and c.get("rceptNo") == rep["rceptNo"] and c.get("parser") == PARSER_VERSION:
            continue
        todo.append(t)
    todo.sort(key=lambda t: (t in cache, t))       # 한 번도 못 읽은 회사부터
    print(f"[CB오버행] 대상 {len(targets)}사 · 원문 새로 받을 {len(todo)}사(상한 {max_docs})", flush=True)

    fetched = failed = 0
    for t in todo:
        if fetched >= max_docs:
            print(f"[CB오버행] 원문 상한 {max_docs}건 — 나머지 {len(todo) - fetched - failed}사는 다음 실행", flush=True)
            break
        if budget.over():
            print(f"[CB오버행] {budget.reason} — 멈춘다", flush=True)
            break
        rep = reports[t]
        xml = fetch_document(api_key, rep["rceptNo"])
        budget.record(xml is not None)
        if xml is None:
            failed += 1
            continue
        fetched += 1
        parsed = parse_document(xml)
        cache[t] = {"rceptNo": rep["rceptNo"], "title": rep.get("title"), "parser": PARSER_VERSION, **parsed}
        if fetched % 50 == 0:
            print(f"  원문 {fetched}건 …", flush=True)

    today_s = today.isoformat()
    companies: dict[str, dict] = {}
    unverified = []
    for t in sorted(targets):
        c = cache.get(t)
        if not c:
            continue
        rec = summarize(c, today_s)
        if not rec:
            continue
        if rec.get("verified") is False:
            # 표 합계·행 자기검증이 안 맞는 회사는 싣지 않는다(오기재 숫자로 배지를 달지 않는다).
            unverified.append(t)
            continue
        rep = reports.get(t) or {}
        rec.update({"company": rep.get("company") or "", "report": c.get("title") or "",
                    "link": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={c['rceptNo']}"})
        companies[t] = rec
    if unverified:
        print(f"[CB오버행] 표 검증 불일치로 제외 {len(unverified)}사: {', '.join(unverified[:20])}", flush=True)
    stats = {"targets": len(targets), "fetched": fetched, "failed": failed, "unverified": len(unverified),
             "pendingDocs": max(0, len(todo) - fetched), "scanErrors": scan_errs}
    return companies, stats


def write_state(state: dict) -> None:
    atomic_write_text(STATE_JSON, json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 미상환 CB·BW 오버행(잠재 희석률) 수집")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--max-docs", type=int, default=400, help="실행당 원문(document.xml) 상한")
    ap.add_argument("--time-budget-min", type=float, default=0, help="이 분이 지나면 멈추고 저장(0=무제한)")
    ap.add_argument("--tickers", default="", help="쉼표 구분 종목만(검증용 — 대상 스캔 생략, 발행하지 않음)")
    args = ap.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        write_data(OUT_JSON, OUT_JS, "KR_CB_OVERHANG",
                   {"updatedAtKst": now_kst(), "source": "DART 정기보고서 원문",
                    "note": "DART_API_KEY 미설정", "count": 0, "companies": {}})
        print("DART_API_KEY missing; wrote empty kr cb overhang payload.")
        return 0

    only = {t.strip().zfill(6) for t in args.tickers.split(",") if t.strip()} or None
    state = load_json(STATE_JSON, {}) or {}
    prev_payload = load_json(OUT_JSON, {}) or {}
    prev_companies = prev_payload.get("companies") or {}
    budget = StepBudget(args.time_budget_min)
    companies, stats = build(api_key, state, prev_companies, args.max_docs, budget, only)

    if only:
        for t in sorted(only):
            print(t, json.dumps(companies.get(t), ensure_ascii=False))
        print(f"[CB오버행] 검증 모드 — 파일을 쓰지 않는다 {stats}")
        return 0

    write_state(state)
    if not companies and (stats["failed"] or stats["scanErrors"]):
        print("[CB오버행] 0건 + 오류 — 기존 파일을 덮지 않는다.")
        return 1
    over10 = sum(1 for v in companies.values() if (v.get("pct") or 0) >= 10 and v.get("verified") is not False)
    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART 정기보고서 · 미상환 전환사채/신주인수권부사채 발행현황",
        "count": len(companies),
        "over10Count": over10,
        "pendingDocs": stats["pendingDocs"],
        "unverifiedCount": stats["unverified"],
        "companies": companies,
    }
    write_data(OUT_JSON, OUT_JS, "KR_CB_OVERHANG", payload, indent=None, min_ratio=DART_REGRESSION_FLOOR)
    print(f"[CB오버행] {len(companies)}사 기록 · 10% 이상 {over10}사 · {stats}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/cb_overhang.json", "data/korea/cb_overhang.js", "data/korea/cb_overhang_state.json"],
                "KR CB/BW overhang",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
