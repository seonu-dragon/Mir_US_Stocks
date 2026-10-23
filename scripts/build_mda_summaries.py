#!/usr/bin/env python3
"""10-Q·10-K MD&A 한국어 요약 + 직전 보고서 대비 달라진 점 (SEC EDGAR → Gemini, 숫자 원문 검증).

- 대상: 미국 스냅샷 시가총액 상위 --top(기본 40, ETF 제외) 중 10-Q/10-K 를 내는 회사. 20-F·40-F 외국 발행사는 없다.
- 증분: 회사마다 submissions JSON 에서 가장 최근 정기보고서(10-Q·10-K, /A 수정본 제외)와 그 직전 정기보고서를 찾는다.
  이미 요약한 접수번호(accession)·추출 실패로 건너뛴 접수번호는 다시 보지 않는다. 최근 --days(기본 120)일 안에
  낸 보고서만. 새 보고서 먼저(제출일 최신순), 같은 날이면 시총 큰 순.
- 원문: 주 문서 HTML 에서 MD&A 구간만 자른다 — 10-Q Item 2, 10-K Item 7(끝 = 10-Q Item 3·4 / 10-K Item 7A·8).
  Item 표지가 없는 통합 보고서는 'Management's Discussion and Analysis' 단독 제목으로 찾는다. 목차·교차참조에도
  같은 제목이 있어 검사(MIN_SECTION_CHARS 이상·문서의 70% 이하)를 통과한 가장 긴 구간을 고른다.
- 요약: Gemini(build_earnings_releases.call_gemini — 같은 엔드포인트·헤더 키·429 처리). 무료 티어 하루 20건을
  브리핑·보도자료 요약과 나눠 쓰므로 **실행당 최대 --max(기본 3)건**, 기본 flash-lite 만.
- 숫자 가드(build_earnings_releases 재사용): 요약 문장의 숫자는 이번 보고서 MD&A 원문에, '달라진 점' 문장의 숫자는
  이번·직전 MD&A 원문 어딘가에 그대로 있어야 한다. 아니면 그 문장을 버린다(단위 환산·한글 큰 단위도 버림).
  평가·매매 판단 표현(JUDGMENT_WORDS)이 든 문장도 버린다. 남은 요약 문장이 없으면 그 보고서는 실패.

산출물: data/mda_summaries.json + .js(window.MDA_SUMMARIES)
  items: {TICKER: {ticker, company, form, filed, period, accession, url, indexUrl,
                   prev: {form, filed, period, accession, url}, summary[], changes[], dropped, model}}
  skipped: {accession: {ticker, filed, reason}} — MD&A 구간을 못 찾은 보고서(다시 시도하지 않음)
실행: py scripts/build_mda_summaries.py [--top 40] [--max 3] [--only AAPL] [--dry-run] [--push]
SEC 예의(User-Agent·초당 ~8회)는 sec_client.sec_get 을 그대로 쓴다.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import timedelta
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402
import build_earnings_releases as ER  # noqa: E402
from build_risk_factor_changes import _key, html_to_lines, sec_symbol  # noqa: E402

OUT_JSON = ROOT / "data" / "mda_summaries.json"
OUT_JS = ROOT / "data" / "mda_summaries.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{doc}"
INDEX_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{accd}-index.htm"
PERIODIC = {"10-Q", "10-K", "10-KT"}
MIN_SECTION_CHARS = 3000
MAX_SECTION_SHARE = 0.70
CUR_CHARS = 60000      # 모델에 주는 이번 보고서 MD&A 상한(앞에서부터)
PREV_CHARS = 30000     # 직전 보고서 MD&A 상한
SKIP_KEEP_DAYS = 400

_MDA = r"management'?s?\s+discussion\s+and\s+analysis"
_START_ITEM = {
    "10-Q": re.compile(r"^item\s*2\s*[\.:\-]?\s*(\.\s*)?" + _MDA, re.I),
    "10-K": re.compile(r"^item\s*7\s*[\.:\-]?\s*(\.\s*)?" + _MDA, re.I),
}
_ITEM_ALONE = {"10-Q": re.compile(r"^item\s*2\s*[\.:\-]?$", re.I), "10-K": re.compile(r"^item\s*7\s*[\.:\-]?$", re.I)}
_START_HEADING = re.compile(r"^" + _MDA + r"\b", re.I)
_END = {
    "10-Q": re.compile(r"^(item\s*3\b|item\s*4\b|quantitative\s+and\s+qualitative\s+disclosures?\s+about\s+market\s+risk"
                       r"|controls\s+and\s+procedures\.?$|part\s+ii\b)", re.I),
    "10-K": re.compile(r"^(item\s*7\s*a\b|item\s*8\b|quantitative\s+and\s+qualitative\s+disclosures?\s+about\s+market\s+risk"
                       r"|financial\s+statements\s+and\s+supplementary\s+data)", re.I),
}


# ---------------------------------------------------------------------------
# 순수 함수(테스트 대상)
# ---------------------------------------------------------------------------

def base_form(form: str) -> str:
    return "10-K" if str(form).startswith("10-K") else "10-Q"


def _starts(lines: list[str], form: str) -> tuple[list[int], list[int]]:
    item, heading = [], []
    f = base_form(form)
    for i, line in enumerate(lines):
        if len(line) > 200:
            continue
        k = _key(line)
        if _START_ITEM[f].match(k):
            item.append(i)
        elif _ITEM_ALONE[f].match(k) and i + 1 < len(lines) and _START_HEADING.match(_key(lines[i + 1])):
            item.append(i + 1)
        elif _START_HEADING.match(k) and len(line) <= 120:
            heading.append(i)
    return item, heading


def _end_after(lines: list[str], start: int, end_re) -> int:
    for j in range(start + 1, len(lines)):
        if len(lines[j]) <= 200 and end_re.match(_key(lines[j])):
            return j
    return len(lines)


def extract_mda(lines: list[str], form: str) -> tuple[list[str] | None, str]:
    """(MD&A 본문 줄 | None, 'item'·'heading' 또는 실패 사유). 시작 후보마다 다음 끝 표지까지 잘라 검사를
    통과한 가장 긴 구간(목차 항목은 몇 줄이라 짧아서 빠진다)."""
    total = sum(len(x) for x in lines) or 1
    end_re = _END[base_form(form)]
    item, heading = _starts(lines, form)
    why = "no_section"
    for how, starts in (("item", item), ("heading", heading)):
        best = None
        for s in starts:
            e = _end_after(lines, s, end_re)
            size = sum(len(x) for x in lines[s + 1:e])
            if size < MIN_SECTION_CHARS:
                why = "too_short" if why == "no_section" else why
                continue
            if size > total * MAX_SECTION_SHARE:
                why = "too_long"
                continue
            if best is None or size > best[2]:
                best = (s, e, size)
        if best:
            return lines[best[0] + 1:best[1]], how
    return None, why


def periodic_filings(block: dict, cik: int) -> list[dict]:
    """submissions recent 블록 → 정기보고서(원본) 최신순."""
    forms = block.get("form") or []
    n = len(forms)
    col = lambda k: block.get(k) or [""] * n  # noqa: E731
    fd, acc, doc, rd = col("filingDate"), col("accessionNumber"), col("primaryDocument"), col("reportDate")
    out = []
    for i, form in enumerate(forms):
        if form not in PERIODIC or not doc[i] or not str(doc[i]).lower().endswith((".htm", ".html")):
            continue
        a = str(acc[i])
        out.append({"form": form, "filed": fd[i], "acc": a, "period": rd[i] or "",
                    "url": ARCHIVE_URL.format(cik=cik, acc=a.replace("-", ""), doc=doc[i]),
                    "indexUrl": INDEX_URL.format(cik=cik, acc=a.replace("-", ""), accd=a)})
    out.sort(key=lambda r: r["filed"], reverse=True)
    return out


def _clean_list(items, nums: set[str], source_text: str, cap: int, limit: int) -> tuple[list[str], int]:
    out, dropped = [], 0
    for s in (items or [])[: limit + 3]:
        s = re.sub(r"\s+", " ", str(s or "")).strip().lstrip("-•· ").strip()
        if not s:
            continue
        if ER.unverified(s, nums) or ER.unit_problems(s, source_text) or any(w in s for w in ER.JUDGMENT_WORDS):
            dropped += 1
            continue
        out.append(s[:cap])
        if len(out) >= limit:
            break
    return out, dropped


def sanitize(obj: dict, cur_text: str, prev_text: str) -> tuple[dict, int]:
    """요약 숫자는 이번 MD&A 에, 달라진 점 숫자는 이번·직전 MD&A 에 있어야 한다. (정리본, 버린 문장 수)."""
    cur_nums = ER.number_set(cur_text)
    both = cur_text + "\n" + prev_text
    summary, d1 = _clean_list(obj.get("summary"), cur_nums, cur_text, 220, 5)
    changes, d2 = _clean_list(obj.get("changes"), cur_nums | ER.number_set(prev_text), both, 220, 3)
    return {"summary": summary, "changes": changes}, d1 + d2


def build_prompt(company: str, ticker: str, cur: dict, prev: dict, cur_text: str, prev_text: str) -> str:
    return f"""너는 미국 기업 SEC 정기보고서를 한국어로 정리하는 편집자다. 아래는 {company}({ticker})의
[이번 보고서] {cur['form']}(기간 {cur['period']}, 제출 {cur['filed']}) MD&A(경영진의 재무상태·경영성과 논의) 원문과
[직전 보고서] {prev['form']}(기간 {prev['period']}, 제출 {prev['filed']}) MD&A 원문이다.

다음 JSON 하나만 출력해라(설명·마크다운 금지):
{{
  "summary": ["이번 보고서 MD&A 핵심 3~5개. 각 항목은 한국어 한 문장(100자 이내)"],
  "changes": ["직전 보고서 대비 달라진 점 2~3개. 각 항목은 한국어 한 문장(100자 이내). 없으면 빈 배열"]
}}

규칙(엄수):
1. 숫자는 원문에 적힌 표기 그대로 옮겨라(예: $94.9 billion, 12%). 계산·단위 환산·반올림·원화 환산 금지. 원문에 없는 숫자를 만들지 마라.
   단위가 표 머리에만 있는 표 숫자는 쓰지 마라.
2. summary 는 이번 보고서 원문에 있는 사실만: 매출·이익의 증감과 회사가 든 원인, 부문별 흐름, 유동성·자본 배분(자사주·배당·부채), 회사가 밝힌 전망·위험.
3. changes 는 두 원문을 비교해 드러나는 차이만: 새로 언급된 사업·위험·요인, 사라진 언급, 증감 방향이 바뀐 항목, 회사가 표현을 바꾼 전망.
   두 보고서의 기간이 다르면(분기 vs 연간) 그 차이 자체를 변화로 쓰지 마라. 확인할 수 없으면 빈 배열.
4. 평가·전망·투자 판단 표현(호실적, 서프라이즈, 쇼크, 기대 이상, 매수, 긍정적, 부정적, 강세, 약세 등)을 쓰지 마라. 사실만.
5. 회사명·제품명·부문명은 영어 원문 그대로 둔다.

[이번 보고서 MD&A]
{cur_text}

[직전 보고서 MD&A]
{prev_text}
"""


# ---------------------------------------------------------------------------
# 네트워크·조립
# ---------------------------------------------------------------------------

def universe(top: int) -> list[dict]:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [{"ticker": str(s["ticker"]).upper(), "company": s.get("company") or "", "cap": float(s.get("marketCapB") or 0)}
              for s in (snap.get("stocks") or [])
              if s.get("ticker") and s.get("sector") not in ("EXCHANGE TRADED FUNDS", "ETF", "MISC")]
    del snap
    stocks.sort(key=lambda s: s["cap"], reverse=True)
    return stocks[:top] if top else stocks


def fetch_mda(filing: dict) -> tuple[str | None, str]:
    raw = sec.sec_get(filing["url"])
    html = raw.decode("utf-8", "replace")
    del raw
    lines = html_to_lines(html)
    del html
    body, how = extract_mda(lines, filing["form"])
    if body is None:
        return None, how
    return "\n".join(body), how


def load_existing() -> dict:
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def build(top: int, max_calls: int, days: int, api_key: str, models, only=None, dry_run=False):
    existing = load_existing()
    items: dict = dict(existing.get("items") or {})
    skipped: dict = dict(existing.get("skipped") or {})
    stocks = universe(0 if only else top)
    if only:
        want = {t.strip().upper() for t in only.split(",") if t.strip()}
        stocks = [s for s in stocks if s["ticker"] in want]
    _, t2c = sec.company_ticker_maps()
    since = (sec.et_today() - timedelta(days=days)).isoformat()
    cands = []
    for s in stocks:
        cik = t2c.get(sec_symbol(s["ticker"]))
        if not cik:
            continue
        try:
            sub = sec.sec_get_json(SUBMISSIONS_URL.format(cik=cik))
        except Exception as exc:  # noqa: BLE001
            print(f"    [경고] {s['ticker']} submissions 실패: {exc}")
            continue
        filings = periodic_filings((sub.get("filings") or {}).get("recent") or {}, cik)
        del sub
        if len(filings) < 2 or filings[0]["filed"] < since:
            continue
        cur, prev = filings[0], filings[1]
        have = items.get(s["ticker"]) or {}
        if have.get("accession") == cur["acc"] or cur["acc"] in skipped:
            continue
        cands.append((s, cik, cur, prev))
    cands.sort(key=lambda c: (c[2]["filed"], c[0]["cap"]), reverse=True)
    print(f"  새 정기보고서 {len(cands)}건 (시총 상위 {top} · 최근 {days}일 · 요약 보유 {len(items)}건) — 이번 실행 최대 {max_calls}건")

    calls = failed = 0
    for s, cik, cur, prev in cands:
        if calls >= max_calls:
            break
        t = s["ticker"]
        try:
            cur_text, how = fetch_mda(cur)
            prev_text, how_p = fetch_mda(prev) if cur_text else (None, "")
        except Exception as exc:  # noqa: BLE001
            print(f"    [경고] {t} 원문 조회 실패: {exc}")
            continue          # 일시 장애 — 다음 실행에 다시
        if not cur_text or not prev_text:
            reason = f"{'이번' if not cur_text else '직전'} 보고서 MD&A 구간 없음({how if not cur_text else how_p})"
            skipped[cur["acc"]] = {"ticker": t, "filed": cur["filed"], "reason": reason}
            print(f"    {t} {cur['form']} {cur['filed']}: {reason} — 건너뜀")
            continue
        cur_text, prev_text = cur_text[:CUR_CHARS], prev_text[:PREV_CHARS]
        print(f"    {t} {cur['form']} {cur['filed']} MD&A {len(cur_text):,}자 · 직전 {prev['form']} {prev['filed']} {len(prev_text):,}자 ({how})")
        if dry_run:
            calls += 1
            continue
        calls += 1
        try:
            obj, model = ER.call_gemini(build_prompt(ER.clean_company(s["company"]) or t, t, cur, prev, cur_text, prev_text),
                                        api_key, models)
        except ER.QuotaExhausted:
            failed += 1
            print("    [중단] Gemini 할당량 소진(429) — 남은 건은 다음 실행에서")
            break
        time.sleep(7)
        if not obj:
            failed += 1
            continue
        clean, dropped = sanitize(obj, cur_text, prev_text)
        if not clean["summary"]:
            failed += 1
            print(f"    [경고] {t}: 검증을 통과한 요약이 없음(버림 {dropped})")
            continue
        items[t] = {
            "ticker": t, "company": ER.clean_company(s["company"]) or t,
            "form": cur["form"], "filed": cur["filed"], "period": cur["period"], "accession": cur["acc"],
            "url": cur["url"], "indexUrl": cur["indexUrl"],
            "prev": {"form": prev["form"], "filed": prev["filed"], "period": prev["period"], "accession": prev["acc"], "url": prev["url"]},
            **clean, "dropped": dropped, "model": model,
        }
        print(f"    → 요약 {len(clean['summary'])} · 달라진 점 {len(clean['changes'])} · 버림 {dropped}")

    cutoff = (sec.et_today() - timedelta(days=SKIP_KEEP_DAYS)).isoformat()
    skipped = {k: v for k, v in skipped.items() if (v.get("filed") or "") >= cutoff}
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "source": "SEC EDGAR 10-Q Item 2 · 10-K Item 7 MD&A 원문 · Gemini 요약",
        "note": "원문 MD&A 를 LLM 으로 한국어 요약. 숫자는 원문에 있는지 검증해 없으면 그 문장을 버렸다. 투자 판단 아님.",
        "count": len(items),
        "items": dict(sorted(items.items())),
        "skipped": skipped,
    }
    return payload, calls, failed


def main() -> int:
    ap = argparse.ArgumentParser(description="10-Q·10-K MD&A 한국어 요약 + 직전 대비 변화")
    ap.add_argument("--top", type=int, default=40)
    ap.add_argument("--max", type=int, default=3, help="한 실행의 LLM 호출 상한(무료 티어 한도 공유)")
    ap.add_argument("--days", type=int, default=120, help="최근 며칠 안에 낸 보고서만")
    ap.add_argument("--only", default="", help="쉼표 구분 티커만(로컬 확인용)")
    ap.add_argument("--models", default=",".join(ER.DEFAULT_MODELS))
    ap.add_argument("--dry-run", action="store_true", help="LLM 을 부르지 않고 대상·구간 길이만 출력")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    print("=== 10-Q·10-K MD&A 한국어 요약 ===")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key and not args.dry_run:
        print("[중단] GEMINI_API_KEY 없음 — 기존 파일 유지")
        return 1
    models = tuple(m.strip() for m in args.models.split(",") if m.strip()) or ER.DEFAULT_MODELS
    try:
        payload, calls, failed = build(args.top, args.max, args.days, api_key, models, args.only or None, args.dry_run)
    except Exception as exc:  # noqa: BLE001
        print(f"[중단] 수집 실패({type(exc).__name__}: {exc}) — 기존 파일 유지")
        return 1
    if args.dry_run:
        print(f"[dry-run] 대상 {calls}건 — 쓰지 않음")
        return 0
    if calls and failed == calls:
        print(f"[중단] 요약 {calls}건 전부 실패 — 기존 파일 유지")
        return 1
    from briefing_store import repository_publish_lock
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "MDA_SUMMARIES", payload, indent=None, allow_empty=True)
        print(f"Wrote {OUT_JSON.name} — {payload['count']}종목 (이번 호출 {calls} · 실패 {failed})")
        if args.push and not sec.git_publish(["data/mda_summaries.json", "data/mda_summaries.js"], "MD&A summaries"):
            print("[중단] push 실패 — 발행되지 않았다")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
