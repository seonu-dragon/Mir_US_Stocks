#!/usr/bin/env python3
"""미국 실적 보도자료 한국어 요약 (SEC 8-K Item 2.02 → EX-99.1 → Gemini).

- 대상: data/material_events.json(build_material_events.py 산출물) 중 Item 2.02(실적
  발표) 8-K. 새로 목록을 긁지 않고 그 피드를 재사용한다. 시총 상위(--top) 종목만,
  한 실행에 최대 --max 건(기본 10)만 요약한다.
- 원문: 8-K 제출 색인(-index.htm)에서 EX-99.1(없으면 EX-99.x)을 찾아 본문 텍스트만 쓴다.
  어닝콜 녹취는 쓰지 않는다.
- 요약: Gemini(브리핑 코드와 같은 방식 — v1beta generateContent, 키는 x-goog-api-key 헤더).
  무료 티어 한도(모델별 하루 20건)를 브리핑과 나눠 쓰므로 기본 flash-lite 만, 실행당 10건. 출력은 JSON(한 줄 요약·핵심 수치·가이던스 방향).
- 숫자 가드: LLM 출력 문자열에 들어 있는 숫자가 모델에 준 원문 텍스트에 실제로 없으면
  그 항목을 버린다(수치 항목은 통째로, 문장은 문장째). 버린 개수는 droppedNumbers 로 남긴다.
- 평가·투자 판단 문구를 쓰지 않도록 지시하고, 한 줄 요약에 금지어가 있으면 버린다.

산출물: data/earnings_releases.json + .js(window.EARNINGS_RELEASES).
"""

from __future__ import annotations

import argparse
import html as html_mod
import json
import os
import re
import sys
import time
import urllib.request
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

OUT_JSON = ROOT / "data" / "earnings_releases.json"
OUT_JS = ROOT / "data" / "earnings_releases.js"
EVENTS = ROOT / "data" / "material_events.json"

RETENTION_DAYS = 120
MAX_ROWS = 600
MAX_SOURCE_CHARS = 60000
GUIDANCE_VALUES = ("raised", "lowered", "maintained", "issued", "none")
# GEMINI_API_KEY 는 브리핑 4종·국내 뉴스와 같은 키다. 무료 티어는 모델별 하루 20건
# (2026-09-25 실측: 429 "generate_content_free_tier_requests, limit: 20")이라, 브리핑이
# 먼저 쓰는 flash 를 건드리지 않도록 기본은 flash-lite 만 쓰고(--models 로 바꿀 수 있다)
# 한 실행 호출 수도 작게(--max 10) 잡는다. 할당량 429 를 받으면 그 실행은 거기서 멈춘다.
DEFAULT_MODELS = ("gemini-2.5-flash-lite",)
GEMINI_VERSION = "v1beta"
# 한 줄 요약에 들어가면 안 되는 평가·매매 판단 표현.
JUDGMENT_WORDS = ("호실적", "어닝 서프라이즈", "어닝 쇼크", "서프라이즈", "쇼크", "매수", "매도",
                  "추천", "저평가", "고평가", "긍정적", "부정적", "호재", "악재", "기대 이상",
                  "기대 이하", "예상 상회", "예상 하회", "강세", "약세", "크게", "대폭", "급증", "급감",
                  "호조", "부진", "견조", "놀라운", "인상적")

_TAG_RE = re.compile(r"<[^>]+>")
_NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")


# ---------------------------------------------------------------------------
# 순수 함수(테스트 대상)
# ---------------------------------------------------------------------------

def html_to_text(raw: str) -> str:
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    s = re.sub(r"(?i)</(td|th)>", " | ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d)>", "\n", s)
    s = html_mod.unescape(_TAG_RE.sub(" ", s)).replace("\xa0", " ")
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"(\s*\|\s*)+\n", "\n", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def find_exhibit(index_html: str) -> str | None:
    """제출 색인 표에서 EX-99.1(없으면 첫 EX-99.x) 문서의 href."""
    best = None
    for row in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", index_html):
        cells = re.findall(r"(?is)<td[^>]*>(.*?)</td>", row)
        if len(cells) < 4:
            continue
        typ = _TAG_RE.sub("", cells[3]).strip().upper()
        href = re.search(r'(?i)href="([^"]+)"', cells[2])
        if not href or not typ.startswith("EX-99"):
            continue
        link = href.group(1)
        if link.lower().endswith((".jpg", ".png", ".gif", ".pdf")):
            continue
        if typ in ("EX-99.1", "EX-99.01", "EX-99"):
            return link
        best = best or link
    return best


def _num_value(tok: str) -> str | None:
    try:
        v = float(tok.replace(",", ""))
    except ValueError:
        return None
    return f"{v:.6f}"


def number_set(text: str) -> set[str]:
    return {v for v in (_num_value(t) for t in _NUM_RE.findall(text or "")) if v}


_SCALE_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\)?\s*(billion|million|thousand|trillion)\b", re.I)
_KO_SCALE_RE = re.compile(r"\d[\d,.]*\s*(조|억|천만|백만|만)")


def unit_problems(text: str, source_text: str) -> list[str]:
    """숫자+단위가 원문과 다르게 붙은 경우(표의 '(in thousands)' 값을 million 으로 옮기거나
    원화·한글 단위로 환산한 경우). 숫자만 대조하는 가드로는 못 잡는다(2026-09-25 실측:
    SNOW 순손실 '(191,720)' 천 달러를 '$ (191,720) million' 으로 옮김).
    - 한글 큰 단위(억·만 등)가 숫자에 붙으면 환산이므로 문제.
    - billion/million 등이 붙은 숫자는 원문에도 그 숫자 바로 뒤에 같은 단위가 있어야 한다.
    - 단위 없이 10,000 이상인 금액은 단위를 알 수 없어 문제(표 값)."""
    probs = [m.group(0) for m in _KO_SCALE_RE.finditer(text or "")]
    src_scaled = {(_num_value(n), w.lower()) for n, w in _SCALE_RE.findall(source_text or "")}
    for m in _SCALE_RE.finditer(text or ""):
        if (_num_value(m.group(1)), m.group(2).lower()) not in src_scaled:
            probs.append(m.group(0))
    scaled_spans = [m.span(1) for m in _SCALE_RE.finditer(text or "")]
    for m in _NUM_RE.finditer(text or ""):
        if any(a <= m.start() < b for a, b in scaled_spans):
            continue
        v = _num_value(m.group(0))
        tail = (text or "")[m.end():m.end() + 2]
        if v and float(v) >= 10000 and "%" not in tail and "$" in (text or "")[max(0, m.start() - 3):m.start()]:
            probs.append(m.group(0))
    return probs


def unverified(text: str, source_nums: set[str]) -> list[str]:
    """text 의 숫자 중 원문에 없는 것."""
    out = []
    for tok in _NUM_RE.findall(text or ""):
        v = _num_value(tok)
        if v and v not in source_nums:
            out.append(tok)
    return out


def sanitize(summary: dict, source_text: str) -> tuple[dict, int]:
    """LLM 요약에서 원문에 없는 숫자를 담은 항목을 버린다. (정리본, 버린 항목 수)."""
    nums = number_set(source_text)
    dropped = 0

    def clean_sentence(s):
        nonlocal dropped
        s = str(s or "").strip()
        if not s:
            return ""
        if unverified(s, nums) or unit_problems(s, source_text):
            dropped += 1
            return ""
        return s

    metrics = []
    for m in (summary.get("metrics") or [])[:8]:
        if not isinstance(m, dict):
            continue
        label = str(m.get("label") or "").strip()[:30]
        value = str(m.get("value") or "").strip()[:60]
        change = str(m.get("change") or "").strip()[:60]
        if not label or not value or not _NUM_RE.search(value):
            continue
        if unverified(value, nums) or unverified(label, nums) or unit_problems(value, source_text):
            dropped += 1
            continue
        if change and (unverified(change, nums) or unit_problems(change, source_text)):
            dropped += 1
            change = ""
        metrics.append({"label": label, "value": value, "change": change})

    one_line = clean_sentence(summary.get("oneLine"))[:160]
    if one_line and any(w in one_line for w in JUDGMENT_WORDS):
        dropped += 1
        one_line = ""
    guidance = str(summary.get("guidance") or "").strip().lower()
    if guidance not in GUIDANCE_VALUES:
        guidance = "none"
    note = clean_sentence(summary.get("guidanceNote"))[:200]
    if note and any(w in note for w in JUDGMENT_WORDS):
        dropped += 1
        note = ""
    period = clean_sentence(summary.get("period"))[:60]
    return {
        "period": period,
        "oneLine": one_line,
        "metrics": metrics[:6],
        "guidance": guidance,
        "guidanceNote": note,
    }, dropped


def clean_company(name) -> str:
    """'COSTCO WHOLESALE CORP /NEW  (COST)' → 'COSTCO WHOLESALE CORP /NEW'."""
    s = re.sub(r"\s*\([A-Z0-9.,\- ]+\)\s*$", "", str(name or ""))
    return re.sub(r"\s{2,}", " ", s).strip()


def build_prompt(company: str, ticker: str, text: str) -> str:
    return f"""너는 미국 기업 실적 보도자료를 한국어로 정리하는 편집자다. 아래는 {company}({ticker})가
SEC 8-K Item 2.02 로 제출한 실적 보도자료(EX-99.1) 원문이다.

다음 JSON 하나만 출력해라(설명·마크다운 금지):
{{
  "period": "보고 기간. 원문 표기 그대로(예: fiscal 2026 third quarter)",
  "oneLine": "한국어 한 문장 요약(80자 이내). 숫자 없이, 이번 발표의 주된 내용(무엇이 늘거나 줄었는지·무엇을 발표했는지)만 사실대로",
  "metrics": [
    {{"label": "한국어 지표명(매출, 순이익, 희석 EPS, 조정 EPS, 영업이익, 영업현금흐름, 부문 매출 등)",
      "value": "원문 숫자 표기 그대로, 단위 포함(예: $94.9 billion, $1.57). 본문 문장에 나온 수치를 우선하고, 단위가 표 머리에만 있는 표 숫자는 쓰지 마라",
      "change": "전년 동기 대비 변화가 원문에 있으면 원문 표기 그대로(예: up 6%), 없으면 빈 문자열"}}
  ],
  "guidance": "raised | lowered | maintained | issued | none 중 하나",
  "guidanceNote": "가이던스 관련 한국어 한 문장(원문 숫자만). 가이던스 언급이 없으면 빈 문자열"
}}

규칙(엄수):
1. 숫자는 metrics·guidanceNote·period 에만 쓰고 oneLine 에는 쓰지 마라. 모든 숫자는 원문에 적힌 그대로 옮겨라. 계산·단위 환산·반올림·원화 환산 금지. 원문에 없는 숫자를 만들지 마라.
2. metrics 는 원문에 명시된 핵심 수치만 최대 6개. 매출과 EPS 가 원문에 있으면 반드시 포함.
3. guidance: 회사가 향후 실적 전망을 직전 전망보다 올렸다고 밝혔으면 raised, 내렸으면 lowered,
   그대로 재확인했으면 maintained, 새로 제시했지만 직전과 비교할 수 없으면 issued, 원문에 전망이 없으면 none.
   원문이 명시하지 않은 방향을 추측하지 마라.
4. 평가·전망·투자 판단 표현(호실적, 서프라이즈, 쇼크, 기대 이상, 매수, 긍정적 등)을 쓰지 마라. 사실만.

[원문]
{text}
"""


def parse_llm_json(text: str) -> dict | None:
    s = (text or "").strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s)
    m = re.search(r"\{.*\}", s, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


# ---------------------------------------------------------------------------
# 네트워크
# ---------------------------------------------------------------------------

class QuotaExhausted(Exception):
    """모든 모델이 할당량 429 — 이 실행에서 더 부르지 않는다."""


def call_gemini(prompt: str, api_key: str, models=DEFAULT_MODELS) -> tuple[dict | None, str]:
    """(파싱된 JSON, 모델명). 브리핑 코드와 같은 엔드포인트(v1beta generateContent)·헤더 키·
    모델 폴백 방식. 모든 모델이 429 면 QuotaExhausted."""
    quota_hits = 0
    for model in models:
        version = GEMINI_VERSION
        url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent"
        body = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
        }).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={
            "Content-Type": "application/json", "x-goog-api-key": api_key,
        })
        for attempt in range(1, 3):
            try:
                with urllib.request.urlopen(req, timeout=90) as r:
                    payload = json.loads(r.read())
                text = payload["candidates"][0]["content"]["parts"][0]["text"]
                parsed = parse_llm_json(text)
                if parsed:
                    return parsed, model
                print(f"    [경고] {model} JSON 파싱 실패")
                break
            except Exception as exc:  # noqa: BLE001
                code = getattr(exc, "code", None)
                print(f"    [경고] {model} 호출 실패({code or type(exc).__name__})")
                if code == 429 and attempt == 1:
                    time.sleep(20)
                    continue
                if code == 429:
                    quota_hits += 1
                break
        time.sleep(2)
    if quota_hits and quota_hits == len(models):
        raise QuotaExhausted()
    return None, ""


def fetch_release_text(event: dict) -> tuple[str, str, str]:
    """(본문 텍스트, 제출 색인 URL, 첨부 URL). 첨부가 없으면 텍스트가 빈 문자열."""
    link = event.get("link") or ""
    accession = event.get("accession") or ""
    base = link.rsplit("/", 1)[0]
    index_url = f"{base}/{accession}-index.htm"
    idx = sec.sec_get(index_url).decode("utf-8", "replace")
    href = find_exhibit(idx)
    if not href:
        return "", index_url, ""
    ex_url = href if href.startswith("http") else f"https://www.sec.gov{href}" if href.startswith("/") else f"{base}/{href}"
    raw = sec.sec_get(ex_url).decode("utf-8", "replace")
    return html_to_text(raw), index_url, ex_url


def load_existing() -> dict:
    if not OUT_JSON.exists():
        return {}
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def market_caps() -> dict:
    try:
        snap = json.loads(sec.SNAPSHOT.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return {str(s.get("ticker") or "").upper(): float(s.get("marketCapB") or 0)
            for s in snap.get("stocks") or [] if s.get("ticker")}


def build(days: int, top: int, max_calls: int, api_key: str, force: bool = False,
          models=DEFAULT_MODELS) -> tuple[dict | None, int, int]:
    """(payload, 시도 건수, 실패 건수)."""
    if not EVENTS.exists():
        print("  [중단] material_events.json 없음")
        return None, 0, 0
    events = json.loads(EVENTS.read_text(encoding="utf-8")).get("events") or []
    existing = load_existing()
    rows = {r["accession"]: r for r in existing.get("releases") or [] if r.get("accession")}
    skipped = dict(existing.get("skipped") or {})
    caps = market_caps()
    top_set = set(sorted(caps, key=caps.get, reverse=True)[:top]) if top else set(caps)
    since = (sec.et_today() - timedelta(days=days)).isoformat()
    cands = [e for e in events
             if any((i or {}).get("code") == "2.02" for i in e.get("items") or [])
             and (e.get("fileDate") or "") >= since
             and str(e.get("ticker") or "").upper() in top_set
             and (force or (e.get("accession") not in rows and e.get("accession") not in skipped))]
    cands.sort(key=lambda e: (e.get("fileDate") or "", caps.get(str(e.get("ticker")).upper(), 0)), reverse=True)
    cands = cands[:max_calls]
    print(f"  요약 대상 {len(cands)}건 (최근 {days}일 · 시총 상위 {top} · 기존 {len(rows)}건)")

    attempted = failed = 0
    for e in cands:
        t = str(e.get("ticker")).upper()
        acc = e["accession"]
        try:
            text, index_url, ex_url = fetch_release_text(e)
        except Exception as exc:  # noqa: BLE001
            print(f"    [경고] {t} {acc} 원문 조회 실패: {exc}")
            continue  # 다음 실행에 재시도
        if len(text) < 400:
            skipped[acc] = {"fileDate": e.get("fileDate"), "reason": "EX-99 보도자료 없음"}
            print(f"    {t} {acc}: EX-99 보도자료 없음 — 건너뜀")
            continue
        text = text[:MAX_SOURCE_CHARS]
        attempted += 1
        try:
            summary, model = call_gemini(build_prompt(clean_company(e.get("company")) or t, t, text), api_key, models)
        except QuotaExhausted:
            failed += 1
            print("    [중단] Gemini 할당량 소진(429) — 남은 건은 다음 실행에서")
            break
        time.sleep(7)  # 무료 티어 분당 한도 여유(4초 간격이면 14건째부터 flash 가 429)
        if not summary:
            failed += 1
            continue
        clean, dropped = sanitize(summary, text)
        if not clean["metrics"] and not clean["oneLine"]:
            failed += 1
            print(f"    [경고] {t}: 검증을 통과한 내용이 없음(버림 {dropped})")
            continue
        rows[acc] = {
            "ticker": t,
            "company": clean_company(e.get("company")) or t,
            "fileDate": e.get("fileDate"),
            "accession": acc,
            "filingUrl": index_url,
            "exhibitUrl": ex_url,
            **clean,
            "droppedItems": dropped,
            "model": model,
        }
        print(f"    {t} {e.get('fileDate')}: 수치 {len(clean['metrics'])}개 · 가이던스 {clean['guidance']}"
              f" · 버림 {dropped}")

    cutoff = (sec.et_today() - timedelta(days=RETENTION_DAYS)).isoformat()
    releases = sorted((r for r in rows.values() if (r.get("fileDate") or "") >= cutoff),
                      key=lambda r: (r.get("fileDate") or "", r.get("ticker") or ""), reverse=True)[:MAX_ROWS]
    skipped = {k: v for k, v in skipped.items() if (v.get("fileDate") or "") >= cutoff}
    payload = {
        "updatedAtKst": sec.kst_now_str(),
        "source": "SEC EDGAR 8-K Item 2.02 첨부 EX-99.1 보도자료 · Gemini 요약",
        "note": "원문 보도자료를 LLM 으로 한국어 요약. 요약의 숫자는 원문 텍스트에 있는지 검증해 없으면 버렸다. "
                "어닝콜 녹취는 쓰지 않는다. 투자 판단 아님.",
        "count": len(releases),
        "releases": releases,
        "skipped": skipped,
    }
    return payload, attempted, failed


def main() -> int:
    ap = argparse.ArgumentParser(description="미국 실적 보도자료 한국어 요약")
    ap.add_argument("--days", type=int, default=10, help="최근 며칠 안의 2.02 제출")
    ap.add_argument("--top", type=int, default=300, help="시총 상위 몇 종목까지")
    ap.add_argument("--max", type=int, default=10, help="한 실행의 요약(LLM 호출) 상한 — 키 공유·무료 티어 한도")
    ap.add_argument("--models", default=",".join(DEFAULT_MODELS),
                    help="쉼표 구분 Gemini 모델 순서(기본 flash-lite 만 — 브리핑의 flash 할당량 보호)")
    ap.add_argument("--force", action="store_true", help="이미 요약한 제출도 다시")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    print("=== 미국 실적 보도자료 한국어 요약 ===")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("[중단] GEMINI_API_KEY 없음 — 기존 파일 유지")
        return 1
    try:
        models = tuple(m.strip() for m in args.models.split(",") if m.strip()) or DEFAULT_MODELS
        payload, attempted, failed = build(args.days, args.top, args.max, api_key, args.force, models)
    except Exception as exc:  # noqa: BLE001
        print(f"[중단] 수집 실패({type(exc).__name__}: {exc}) — 기존 파일 유지")
        return 1
    if payload is None:
        return 1
    if attempted and failed == attempted:
        print(f"[중단] 요약 {attempted}건 전부 실패 — 기존 파일 유지")
        return 1
    from briefing_store import repository_publish_lock
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "EARNINGS_RELEASES", payload, indent=None)
        print(f"Wrote {OUT_JSON.name} — {payload['count']}건 (이번 시도 {attempted} · 실패 {failed})")
        if args.push and not sec.git_publish(
                ["data/earnings_releases.json", "data/earnings_releases.js"], "earnings releases"):
            print("[중단] push 실패 — 발행되지 않았다")
            return 1
    if attempted and failed > attempted * 0.5:
        print(f"[경고] 요약 실패 {failed}/{attempted} — 절반 넘게 실패")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
