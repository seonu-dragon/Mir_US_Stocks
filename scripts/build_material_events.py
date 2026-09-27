#!/usr/bin/env python3
"""미국 기업 주요 공시(SEC 8-K) 피드.

efts 전문검색으로 날짜별 8-K 를 받아 추적 universe 로 필터한다. 8-K 의 item 코드는
efts 히트의 _source.items 에 들어 있어 문서를 받지 않고도 이벤트를 분류할 수 있다.

3줄 요약(2026-09-28): 요약 대상 Item(eightk_summary.PRIORITY)이 있는 행은 8-K 본문을 한 번
받아 규칙 기반(템플릿+정규식, LLM 없음)으로 '무엇이 · 누가 · 얼마·언제' 를 뽑아 summary 필드에
붙인다. 실패해도 행은 그대로(화면은 Item 제목 + 원문 링크). 선택적으로 --llm-max 건만 시총 상위의
중요 Item 을 Gemini flash-lite 로 3줄 요약해 aiSummary 에 붙인다 — 숫자는 원문 대조를 통과한
줄만 남기고, 한 번 만든 결과는 행에 남아(30일 보관) 다시 부르지 않는다.
"""

from __future__ import annotations

import argparse
import html as html_mod
import re
import sys
import urllib.parse
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import eightk_summary  # noqa: E402
import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

OUT_JSON = ROOT / "data" / "material_events.json"
OUT_JS = ROOT / "data" / "material_events.js"

RETENTION_DAYS = 30
MAX_ROWS = 9000

# 8-K Item 코드 → (한글 라벨, 중요도 hot 여부)
ITEM_LABELS = {
    "1.01": ("중요계약 체결", True),
    "1.02": ("중요계약 종료", True),
    "1.03": ("파산/법정관리", True),
    "2.01": ("자산 인수·처분", True),
    "2.02": ("실적 발표", True),
    "2.03": ("채무·부외부채 발생", False),
    "2.04": ("채무 조기상환 사유", False),
    "2.05": ("구조조정 비용", False),
    "2.06": ("자산 손상차손", False),
    "3.01": ("상장폐지·규정 미준수", True),
    "3.02": ("주식 비등록 매각", False),
    "3.03": ("주주 권리 변경", False),
    "4.01": ("회계법인 변경", True),
    "4.02": ("과거 재무제표 신뢰불가", True),
    "5.01": ("지배권 변경", True),
    "5.02": ("임원·이사 변동", True),
    "5.03": ("정관 변경", False),
    "5.07": ("주총 투표결과", False),
    "7.01": ("Reg FD 공시", False),
    "8.01": ("기타 주요 이벤트", False),
    "9.01": ("재무제표·첨부", False),
}


# --- 자사주(buyback) 태깅 ---------------------------------------------------
# 8-K 행에는 제목/요약 텍스트가 없으므로(efts item 코드만 옴) efts 전문검색의
# 구문 질의로 repurchase|buyback 을 담은 8-K accession 집합을 만들어 행에
# 매칭한다. 금액은 매칭된 첨부문서(보도자료 등)에서 "$X billion/million" 이
# repurchase/buyback 키워드에 인접하고 단일 값으로 확정될 때만 채운다.
BUYBACK_QUERIES = ('"repurchase program"', '"share repurchase"', '"buyback"')
BUYBACK_WORD_RE = re.compile(r"repurchase|buyback", re.I)
BUYBACK_AMOUNT_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*(billion|million)\b", re.I)
BUYBACK_WINDOW = 300           # 키워드 앞뒤 몇 글자에서 금액을 찾을지
MAX_BUYBACK_DOC_FETCHES = 80   # 한 실행의 금액추출용 원문 요청 상한
_TAG_RE = re.compile(r"<[^>]+>")


def efts_query_hits(query, form, startdt, enddt, cap=10000):
    """sec.efts_hits 와 동일하되 q(전문검색 구문)를 지정한다.

    반환: ``(hits, partial)`` — sec.efts_hits 와 같은 계약이다.
    """
    hits = []
    frm = 0
    partial = False
    while frm < cap:
        q = urllib.parse.urlencode({
            "q": query, "forms": form, "startdt": startdt, "enddt": enddt, "from": frm,
        })
        try:
            data = sec.sec_get_json(f"{sec.EFTS_URL}?{q}")
        except Exception as exc:
            print(f"    [경고] efts q={query} {startdt}~{enddt} from={frm} 실패: {exc}")
            partial = True
            break
        page = data.get("hits", {}).get("hits", [])
        if not page:
            break
        hits.extend(page)
        total = data.get("hits", {}).get("total", {}).get("value", 0)
        frm += len(page)
        if frm >= total:
            break
    else:
        partial = True
    return hits, partial


def find_buyback_docs(start_iso, end_iso):
    """구간 내 repurchase/buyback 8-K → ({accession: 매칭 문서 파일명}, partial)."""
    docs = {}
    partial = False
    for query in BUYBACK_QUERIES:
        hits, q_partial = efts_query_hits(query, "8-K", start_iso, end_iso)
        partial = partial or q_partial
        for hit in hits:
            src = hit.get("_source", {})
            adsh = src.get("adsh") or hit["_id"].split(":")[0]
            docs.setdefault(adsh, hit["_id"].split(":")[1])
    return docs, partial


def extract_buyback_amount(text):
    """repurchase/buyback 키워드 주변의 달러 금액. 단일 값일 때만 반환."""
    values = set()
    for m in BUYBACK_WORD_RE.finditer(text):
        window = text[max(0, m.start() - BUYBACK_WINDOW): m.start() + BUYBACK_WINDOW]
        for am in BUYBACK_AMOUNT_RE.finditer(window):
            try:
                v = float(am.group(1).replace(",", ""))
            except ValueError:
                continue
            v *= 1e9 if am.group(2).lower() == "billion" else 1e6
            values.add(round(v, 2))
    return values.pop() if len(values) == 1 else None


def tag_buybacks(events):
    """보관 중인 모든 행을 대상으로 매 실행 태깅(순수 추가 — 기존 필드 불변).

    - kind="buyback" 은 efts 구문검색 매칭으로 세운다(해제하지 않음 — 일시적
      검색 실패로 태그가 사라지지 않게).
    - 금액 추출용 원문 요청은 행별 1회: buybackChecked 마커로 캐시.
    """
    if not events:
        return
    dates = [e.get("fileDate") for e in events if e.get("fileDate")]
    if not dates:
        return
    try:
        docs, _docs_partial = find_buyback_docs(min(dates), max(dates))
    except Exception as exc:
        print(f"  [경고] buyback 태깅 질의 실패 — 이번 실행은 건너뜀: {exc}")
        return
    tagged = fetched = amounts = demoted = 0
    for e in events:
        doc = docs.get(e.get("accession"))
        if not doc:
            continue
        # 2026-09-05: 구문검색 매칭만으로 kind="buyback" 을 세우면 실적 발표 8-K 처럼
        # 본문에 'share repurchase' 한 줄 있는 일반 공시가 190건 중 144건이나 자사주로
        # 분류됐다. 이제 '언급'(buybackMention)과 '발표'(kind=buyback, 금액 확정)를 나눈다.
        # 금액이 확정된 행만 자사주 발표로 분류하고, 원문까지 봤는데 금액이 없으면
        # 예전 태그를 내린다(화면은 언급 행을 '금액 미확인'으로 따로 보여 준다).
        e["buybackMention"] = True
        tagged += 1
        if e.get("amountUsd") is not None:
            e["kind"] = "buyback"
            continue
        if e.get("buybackChecked"):
            if e.get("kind") == "buyback":
                e.pop("kind", None)
                demoted += 1
            continue
        if fetched >= MAX_BUYBACK_DOC_FETCHES:
            continue
        url = e.get("link") or ""
        if not url:
            e["buybackChecked"] = True
            continue
        fetched += 1
        try:
            body = sec.sec_get(url.rsplit("/", 1)[0] + "/" + doc)
        except Exception as exc:
            if getattr(exc, "code", None) in (403, 404):
                e["buybackChecked"] = True
            continue
        text = re.sub(r"\s+", " ", html_mod.unescape(_TAG_RE.sub(" ", body.decode("utf-8", "replace"))))
        amount = extract_buyback_amount(text)
        if amount is not None:
            e["amountUsd"] = amount
            e["kind"] = "buyback"
            amounts += 1
        elif e.get("kind") == "buyback":
            e.pop("kind", None)
            demoted += 1
        e["buybackChecked"] = True
    print(f"  buyback 태깅: 언급 {tagged}건, 원문 {fetched}건 조회, 금액 확정 {amounts}건, 태그 내림 {demoted}건")


# --- 8-K 3줄 요약 -----------------------------------------------------------
MAX_SUMMARY_FETCHES = 300   # 한 실행의 본문 요청 상한(하루 신규 ~30건 + 첫 실행 백필 몫)
SUMMARY_CODES = frozenset(eightk_summary.PRIORITY)
# AI 요약 대상: 시장 반응이 큰 편인 Item 만(2.02 실적은 보도자료 요약이 따로 있다).
AI_CODES = ("4.02", "3.01", "1.03", "2.01", "1.01", "1.02", "4.01", "5.01", "2.05", "5.02")
AI_TOP = 150                # 시총 상위 몇 종목까지
AI_RECENT_DAYS = 4          # 며칠 안의 제출만(지난 공시를 뒤늦게 요약하느라 할당량을 쓰지 않게)
AI_SOURCE_CHARS = 12000


def event_codes(e):
    return [str((i or {}).get("code") or "") for i in e.get("items") or []]


def needs_rule_summary(e):
    return (not e.get("summaryChecked")) and any(c in SUMMARY_CODES for c in event_codes(e))


def fetch_8k_text(e):
    """8-K 주 문서(link) → 텍스트. link 는 efts 히트의 주 문서다(첨부가 아니다)."""
    from build_earnings_releases import html_to_text
    raw = sec.sec_get(e["link"]).decode("utf-8", "replace")
    return html_to_text(raw)


def summarize_events(events, max_fetch=MAX_SUMMARY_FETCHES, fetch=None):
    """요약 대상 Item 이 있는데 아직 안 본 행만 본문을 받아 규칙 요약을 붙인다(순수 추가).

    - summary = {item, what, who, amount, date, src:"rule"} — eightk_summary.summarize_8k 결과.
    - summaryChecked: 본문을 한 번 봤다는 표시(요약이 없어도). 403/404 도 확정 실패로 표시한다.
      일시 오류(429·5xx·타임아웃)는 표시하지 않아 다음 실행이 다시 시도한다.
    반환: {accession: 본문 텍스트} — 같은 실행의 AI 요약이 다시 받지 않게.
    """
    fetch = fetch or fetch_8k_text
    texts = {}
    todo = [e for e in events if needs_rule_summary(e) and e.get("link")]
    # 최신 공시부터(첫 실행 백필이 상한에 걸려도 오늘 것이 먼저 된다).
    todo.sort(key=lambda e: e.get("fileDate") or "", reverse=True)
    done = got = 0
    for e in todo[:max_fetch]:
        done += 1
        try:
            text = fetch(e)
        except Exception as exc:  # noqa: BLE001
            if getattr(exc, "code", None) in (403, 404):
                e["summaryChecked"] = True
            continue
        texts[e["accession"]] = text
        try:
            s = eightk_summary.summarize_8k(event_codes(e), text, e.get("company") or "")
        except Exception as exc:  # noqa: BLE001 — 한 건의 파싱 실패로 실행을 멈추지 않는다
            print(f"    [경고] {e.get('ticker')} {e.get('accession')} 요약 실패: {exc}")
            s = None
        if s:
            e["summary"] = {**s, "src": "rule"}
            got += 1
        e["summaryChecked"] = True
    left = max(0, len(todo) - max_fetch)
    print(f"  8-K 규칙 요약: 대상 {len(todo)}건 중 {done}건 조회, 요약 {got}건"
          f"{f' (남은 {left}건은 다음 실행)' if left else ''}")
    return texts


def ai_candidates(events, caps, today_iso, top=AI_TOP, days=AI_RECENT_DAYS):
    """AI 요약 후보: 시총 상위 top 종목 · 최근 days 일 · 중요 Item · 아직 AI 를 안 돌린 행. 시총 큰 순."""
    top_set = set(sorted(caps, key=caps.get, reverse=True)[:top]) if top else set(caps)
    since = (date.fromisoformat(today_iso) - timedelta(days=days)).isoformat()
    out = []
    for e in events:
        t = str(e.get("ticker") or "").upper()
        if t not in top_set or (e.get("fileDate") or "") < since:
            continue
        if e.get("aiSummary") or e.get("aiChecked"):
            continue
        codes = event_codes(e)
        if not any(c in codes for c in AI_CODES):
            continue
        out.append(e)
    out.sort(key=lambda e: caps.get(str(e.get("ticker") or "").upper(), 0), reverse=True)
    return out


def ai_source_text(e, text):
    """모델에 줄 원문: 요약 대상 Item 절들만 이어 붙인다(서명·첨부 목록 제외). 없으면 본문 앞부분."""
    items = eightk_summary.split_items(text)
    parts = [f"Item {c}. {items[c]}" for c in event_codes(e) if c in items and c in SUMMARY_CODES]
    src = "\n\n".join(parts) if parts else eightk_summary.normalize(text)
    return src[:AI_SOURCE_CHARS]


def build_ai_prompt(e, source):
    labels = ", ".join(f"Item {i.get('code')} {i.get('label')}" for i in e.get("items") or [] if i.get("code") != "9.01")
    return f"""너는 미국 공시(8-K)를 한국어로 정리하는 편집자다. 아래는 {e.get('company')}({e.get('ticker')})가
{e.get('fileDate')} 에 제출한 8-K 의 본문이다. 해당 Item: {labels}.

다음 JSON 하나만 출력해라(설명·마크다운 금지):
{{"lines": ["무엇이 일어났는지 한 문장", "누가(상대방·임원 이름과 직책·기관)", "얼마·언제(금액·수량·날짜)"]}}

규칙(엄수):
1. 각 줄은 한국어 한 문장, 60자 이내. 해당 정보가 원문에 없으면 그 줄은 빈 문자열.
2. 숫자·금액·날짜·이름은 원문에 적힌 그대로 옮겨라. 계산·단위 환산·반올림·원화 환산 금지. 원문에 없는 숫자를 만들지 마라.
3. 평가·전망·투자 판단 표현(호재, 악재, 긍정적, 매수, 급증 등)을 쓰지 마라. 사실만.

[원문]
{source}
"""


def sanitize_ai_lines(obj, source):
    """AI 3줄에서 원문에 없는 숫자·단위 환산·판단어가 든 줄을 버린다. (남은 줄, 버린 수)."""
    from build_earnings_releases import JUDGMENT_WORDS, number_set, unit_problems, unverified
    nums = number_set(source)
    lines = obj.get("lines") if isinstance(obj, dict) else None
    if not isinstance(lines, list):
        return [], 0
    out, dropped = [], 0
    for raw in lines[:3]:
        s = str(raw or "").strip()[:120]
        if not s:
            out.append("")
            continue
        # unit_problems 는 단위 없는 $1만 이상 금액을 '표 값(천 달러 단위 등)' 으로 의심한다. 8-K 본문은
        # "$500,000,000" 처럼 달러 전액을 문장에 쓰므로, 원문에 같은 '$숫자' 가 단위 없이 있으면 통과시킨다.
        probs = [p for p in unit_problems(s, source)
                 if not re.search(r"\$\s?" + re.escape(p) + r"(?![\d,]|\.\d)(?!\s*(?:million|billion|thousand|trillion))", source)]
        if unverified(s, nums) or probs or any(w in s for w in JUDGMENT_WORDS):
            dropped += 1
            out.append("")
            continue
        out.append(s)
    while len(out) < 3:
        out.append("")
    return out, dropped


def ai_summarize_events(events, texts, api_key, max_calls, caps, today_iso, fetch=None, call=None, sleep=None):
    """시총 상위의 중요 8-K 몇 건만 Gemini 로 3줄 요약(aiSummary). 결과는 행에 남아 캐시가 된다."""
    if not api_key or max_calls <= 0:
        return 0
    from build_earnings_releases import QuotaExhausted, call_gemini
    import time as _time
    fetch = fetch or fetch_8k_text
    call = call or call_gemini
    sleep = sleep or _time.sleep
    made = 0
    for e in ai_candidates(events, caps, today_iso)[:max_calls]:
        acc = e["accession"]
        try:
            text = texts.get(acc) or fetch(e)
        except Exception as exc:  # noqa: BLE001
            print(f"    [경고] {e.get('ticker')} {acc} 본문 조회 실패(AI): {exc}")
            continue
        source = ai_source_text(e, text)
        try:
            obj, model = call(build_ai_prompt(e, source), api_key)
        except QuotaExhausted:
            print("    [중단] Gemini 할당량 소진(429) — 남은 건은 다음 실행에서")
            break
        e["aiChecked"] = True   # 한 번 부른 행은(성공·실패 모두) 다시 부르지 않는다 — 무료 한도 보호
        if not obj:
            continue
        lines, dropped = sanitize_ai_lines(obj, source)
        if sum(1 for x in lines if x) < 2:
            print(f"    [경고] {e.get('ticker')} AI 요약: 검증 통과 줄이 부족(버림 {dropped}) — 규칙 요약만 표시")
            continue
        e["aiSummary"] = {"lines": lines, "model": model, "droppedLines": dropped, "src": "ai"}
        made += 1
        sleep(7)  # 무료 티어 분당 한도 여유(build_earnings_releases 와 같은 간격)
    print(f"  8-K AI 요약: {made}건")
    return made


def market_caps():
    import json
    try:
        snap = json.loads(sec.SNAPSHOT.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return {str(s.get("ticker") or "").upper(): float(s.get("marketCapB") or 0)
            for s in snap.get("stocks") or [] if s.get("ticker")}


def label_items(items):
    out = []
    hot = False
    for code in items or []:
        lbl, is_hot = ITEM_LABELS.get(code, (f"Item {code}", False))
        out.append({"code": code, "label": lbl})
        hot = hot or is_hot
    return out, hot


def load_existing():
    if not OUT_JSON.exists():
        return [], None
    try:
        import json
        p = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return p.get("events") or [], p.get("lastFileDate")
    except Exception:
        return [], None


def build(backfill_days, top, overlap_days=3, summary_max=MAX_SUMMARY_FETCHES, llm_max=0, api_key=""):
    today = sec.et_today()
    existing, last = load_existing()
    start = (date.fromisoformat(last) - timedelta(days=overlap_days)) if (existing and last) \
        else today - timedelta(days=backfill_days)
    print(f"  수집 구간: {start} ~ {today} (기존 {len(existing)}건)")

    cik_set, cik_to_ticker = sec.universe_cik_map(top=top)
    print(f"  universe CIK: {len(cik_set)}")

    merged = {e["accession"]: e for e in existing}
    new = 0
    partial = False
    day = start
    while day <= today:
        iso = day.isoformat()
        hits, day_partial = sec.efts_hits("8-K", iso, iso)
        partial = partial or day_partial
        kept = 0
        for hit in hits:
            src = hit.get("_source", {})
            hit_ciks = {int(c) for c in src.get("ciks", []) if str(c).isdigit()}
            matched = hit_ciks & cik_set
            if not matched:
                continue
            accession = src.get("adsh") or hit["_id"].split(":")[0]
            if accession in merged:
                continue
            cik = sorted(matched)[0]
            items, hot = label_items(src.get("items"))
            if not items:
                continue
            acc_nodash = accession.replace("-", "")
            doc = hit["_id"].split(":")[1]
            merged[accession] = {
                "ticker": cik_to_ticker.get(cik),
                "company": sec.clean_company_name((src.get("display_names") or [""])[0]),
                "items": items,
                "hot": hot,
                "fileDate": src.get("file_date"),
                "accession": accession,
                "link": f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_nodash}/{doc}",
            }
            new += 1
            kept += 1
        if hits:
            print(f"    {iso}: 8-K 전체 {len(hits)} / universe {kept}"
                  f"{' (일부 실패)' if day_partial else ''}")
        day += timedelta(days=1)

    cutoff = (today - timedelta(days=RETENTION_DAYS)).isoformat()
    events = [e for e in merged.values() if (e.get("fileDate") or "") >= cutoff]
    events.sort(key=lambda e: (e.get("fileDate") or "", e.get("accession") or ""), reverse=True)
    events = events[:MAX_ROWS]
    tag_buybacks(events)
    texts = summarize_events(events, max_fetch=summary_max)
    if llm_max > 0 and api_key:
        try:
            ai_summarize_events(events, texts, api_key, llm_max, market_caps(), today.isoformat())
        except Exception as exc:  # noqa: BLE001 — AI 요약은 선택 기능이다. 실패해도 피드는 발행한다
            print(f"  [경고] 8-K AI 요약 건너뜀: {type(exc).__name__}: {exc}")
    summarized = sum(1 for e in events if e.get("summary") or e.get("aiSummary"))
    fresh_last = max((e.get("fileDate") or "" for e in events), default=today.isoformat())
    if partial and last:
        # 하루치라도 잘렸으면 커서를 전진시키지 않는다 — 다음 실행이 재수집한다.
        print(f"  [경고] efts 일부 실패 — lastFileDate 를 {last} 로 고정(재수집 예약)")
        fresh_last = last
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "lastFileDate": fresh_last,
        "partialFetch": bool(partial),
        "count": len(events),
        "source": "SEC EDGAR 8-K",
        "note": "추적 종목 한정. item 코드 기반 이벤트 분류이며 상세는 원문 링크 참조. "
                "kind=buyback 은 전문검색 매칭 자사주 발표, amountUsd 는 원문에서 단일 값으로 확정된 경우만. "
                "summary 는 8-K 본문에서 규칙(템플릿+정규식)으로 뽑은 3줄 요약(숫자·이름은 원문 표기 그대로), "
                "aiSummary 는 시총 상위 일부만 Gemini 요약 후 원문에 없는 숫자가 든 줄을 버린 것.",
        "summaryCount": summarized,
        "events": events,
    }
    print(f"  완료: 신규 {new}건 → 총 {len(events)}건")
    return payload


def main():
    ap = argparse.ArgumentParser(description="SEC 8-K 주요 공시 수집")
    ap.add_argument("--backfill-days", type=int, default=14)
    ap.add_argument("--top", type=int, default=1500)
    ap.add_argument("--summary-max", type=int, default=MAX_SUMMARY_FETCHES,
                    help="한 실행에서 3줄 요약용으로 받을 8-K 본문 수 상한")
    ap.add_argument("--llm-max", type=int, default=0,
                    help="Gemini 3줄 요약 호출 상한(기본 0=끔, GEMINI_API_KEY 필요 — 무료 한도를 브리핑과 나눠 쓴다)")
    ap.add_argument("--push", action="store_true", default=False)
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== SEC 8-K 주요 공시 수집 시작 ===")
    import os
    payload = build(args.backfill_days, args.top, summary_max=args.summary_max, llm_max=args.llm_max,
                    api_key=os.getenv("GEMINI_API_KEY", "").strip())
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "MATERIAL_EVENTS", payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} events")
        if args.push and not args.no_push:
            if not sec.git_publish(["data/material_events.json", "data/material_events.js"],
                                   "material events"):
                raise SystemExit("[중단] 8-K 주요 공시 push 실패 — 발행되지 않았다")


if __name__ == "__main__":
    main()
