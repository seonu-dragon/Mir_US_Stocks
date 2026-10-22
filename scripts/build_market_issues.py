#!/usr/bin/env python3
"""오늘의 이슈 — 그날 특징주(build_movers_reasons.py 보드)를 같은 이슈끼리 묶어 '무슨 일로 어떤 종목들이 움직였나'를 보여 준다.

입력은 이미 검증된 특징주 보드(data/movers_reasons.json · data/korea/movers_reasons.json)의 '전체 시장' 보드다 — 종목마다
등락률·사유 한 줄(근거 인용 검증을 통과한 것만)·근거 기사 제목. 여기서 새로 수집하지 않는다.
LLM(Gemini, 특징주와 같은 키·모델 폴백)은 시장당 하루 1회만 부른다 — 같은 거래일 결과가 있으면 부르지 않는다.

검증(지어내지 않기):
  - 이슈의 종목은 입력 종목이어야 하고(아니면 뺀다) 2종목 이상이어야 한다.
  - 제목·요약의 숫자는 입력(사유·근거 제목·등락률)에 있는 숫자여야 한다 — 아니면 그 이슈를 버린다.
  - 근거 기사 링크는 LLM 이 아니라 입력 보드의 근거에서 붙인다(이슈 종목들의 근거 중 앞에서부터 최대 3건).
  - 한 종목은 한 이슈에만(먼저 나온 이슈).

산출물: data/market_issues.json/.js (US) · data/korea/market_issues.json/.js (KR) — window.MARKET_ISSUES(시장별·lazy 아님 — 오늘 탭).
실행: py scripts/build_market_issues.py --market us|kr [--push] [--force]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402

KST = timezone(timedelta(hours=9))
MARKETS = {
    "us": {"label": "미국", "board": ROOT / "data" / "movers_reasons.json",
           "out": (ROOT / "data" / "market_issues.json", ROOT / "data" / "market_issues.js")},
    "kr": {"label": "국내", "board": ROOT / "data" / "korea" / "movers_reasons.json",
           "out": (ROOT / "data" / "korea" / "market_issues.json", ROOT / "data" / "korea" / "market_issues.js")},
}
MODELS = ("gemini-2.5-flash", "gemini-2.5-flash-lite")
MAX_ISSUES = 6
MIN_TICKERS = 2
MAX_TITLE = 30
MAX_SUMMARY = 120
EVIDENCE_PER_ISSUE = 3


def stocks_of(board: dict) -> list[dict]:
    """대형주·전체 시장 두 보드(없으면 최상위 up/down)에서 사유가 있는 종목 — 근거 인용이 검증된 사유(ok)와
    업종 동반 움직임(sector, 사유 = 업종 메모). 같은 종목은 한 번만."""
    boards = board.get("boards") or {}
    sources = [boards[k] for k in ("large", "all") if isinstance(boards.get(k), dict)] or [board]
    out, seen = [], set()
    for src in sources:
        for side in ("up", "down"):
            for s in src.get(side) or []:
                t = s.get("ticker")
                status = s.get("reasonStatus")
                reason = s.get("reason") if status == "ok" else (s.get("sectorNote") if status == "sector" else None)
                if not t or t in seen or not reason:
                    continue
                seen.add(t)
                out.append({**s, "reason": reason})
    return out


def build_prompt(stocks: list[dict], market: str, trade_date: str) -> str:
    lines = []
    for s in stocks:
        heads = " / ".join(e.get("title", "") for e in (s.get("evidence") or [])[:2] if e.get("title"))
        lines.append(f"- {s['ticker']} ({s.get('company', '')}, {s.get('industry') or s.get('sector') or ''}) "
                     f"{s.get('changePct'):+.1f}% · 사유: {s['reason']}" + (f" · 기사: {heads}" if heads else ""))
    return f"""너는 {MARKETS[market]['label']} 주식시장 편집자다. 아래는 {trade_date} 거래일에 크게 움직인 종목과 검증된 사유다.
같은 원인(정책·업황·실적 시즌·원자재·특정 기업 이벤트의 파급 등)으로 함께 움직인 종목들을 이슈로 묶어라.

규칙:
- 이슈는 최대 {MAX_ISSUES}개, 각 이슈는 서로 다른 회사 {MIN_TICKERS}종목 이상. 혼자 움직인 종목은 넣지 마라.
- 같은 업종이라는 이유만으로 묶지 마라. 사유에 같은 원인(하나의 사건·정책·지표·업황 뉴스)이 보여야 한다. 그런 묶음이 없으면 빈 배열 [] 을 내라.
- summary 는 그 공통 원인을 말하고, 종목별 사정을 나열하지 마라.
- 아래 목록에 없는 사실·숫자를 만들지 마라. 숫자는 목록에 나온 것만.
- title: 한국어 {MAX_TITLE}자 이내 명사형. summary: 한국어 1~2문장, {MAX_SUMMARY}자 이내.
- 한 종목은 한 이슈에만.
- 출력은 JSON 배열만: [{{"title": "...", "summary": "...", "tickers": ["...", "..."]}}]

종목:
{chr(10).join(lines)}
"""


def _nums(text: str) -> set[str]:
    return {n.replace(",", "").rstrip("0").rstrip(".") if "." in n else n.replace(",", "")
            for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text or "")}


def _named(text: str, stock: dict) -> bool:
    """요약이 그 회사를 이름(첫 낱말)이나 티커로 부르는가."""
    name = re.split(r"[\s,(]", str(stock.get("company") or ""), maxsplit=1)[0]
    keys = [k for k in (name, stock.get("ticker")) if k and len(k) >= 2]
    return any(k in text for k in keys)


def validate(raw: list, stocks: list[dict], rejects: dict | None = None) -> list[dict]:
    by = {s["ticker"]: s for s in stocks}
    corpus = " ".join(f"{s['reason']} {s.get('changePct')} " + " ".join(e.get("title", "") for e in s.get("evidence") or [])
                      for s in stocks)
    allowed = _nums(corpus) | _nums(" ".join(f"{abs(float(s.get('changePct') or 0)):.1f}" for s in stocks))
    used, out = set(), []
    rejects = rejects if rejects is not None else {}

    def drop(why):
        rejects[why] = rejects.get(why, 0) + 1
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        title = re.sub(r"\s+", " ", str(item.get("title") or "")).strip()
        summary = re.sub(r"\s+", " ", str(item.get("summary") or "")).strip()
        tickers = [t for t in dict.fromkeys(str(x).strip().upper() for x in item.get("tickers") or []) if t in by and t not in used]
        if not title or len(title) > MAX_TITLE or len(summary) > MAX_SUMMARY:
            drop("길이")
            continue
        if len(tickers) < MIN_TICKERS:
            drop("종목 부족")
            continue
        if not _nums(title + " " + summary) <= allowed:
            drop("입력에 없는 숫자")
            continue                       # 지어낸 수치일 수 있어 이슈째 버린다
        if sum(1 for t in tickers if _named(summary, by[t])) >= 2:
            drop("회사별 나열")
            continue                       # 공통 원인으로 묶인 이슈가 아니다(2026-10-22 실측)
        evidence, links = [], set()
        for t in tickers:
            for e in by[t].get("evidence") or []:
                if e.get("link") and e.get("title") and e["link"] not in links and len(evidence) < EVIDENCE_PER_ISSUE:
                    links.add(e["link"])
                    evidence.append({"title": e["title"], "link": e["link"], "source": e.get("source") or ""})
        used.update(tickers)
        out.append({"title": title, "summary": summary,
                    "tickers": [{"t": t, "name": by[t].get("company") or t, "chg": by[t].get("changePct")} for t in tickers],
                    "evidence": evidence})
        if len(out) >= MAX_ISSUES:
            break
    return out


def parse_json_array(text: str):
    try:
        v = json.loads(text)
    except Exception:  # noqa: BLE001
        m = re.search(r"\[.*\]", text or "", re.S)
        if not m:
            return None
        try:
            v = json.loads(m.group(0))
        except Exception:  # noqa: BLE001
            return None
    if isinstance(v, dict):
        v = v.get("issues")
    return v if isinstance(v, list) else None


def main() -> int:
    ap = argparse.ArgumentParser(description="오늘의 이슈(특징주 이슈 묶음)")
    ap.add_argument("--market", choices=sorted(MARKETS), required=True)
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    from build_movers_reasons import call_gemini, load_env
    load_env()
    cfg = MARKETS[args.market]
    try:
        board = json.loads(cfg["board"].read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"[issues] {args.market}: 특징주 보드 없음({exc}) — 건너뜀")
        return 1
    trade_date = board.get("tradeDate")
    out_json, out_js = cfg["out"]
    try:
        prev = json.loads(out_json.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        prev = {}
    if prev.get("tradeDate") == trade_date and prev.get("issues") and not args.force:
        print(f"[issues] {args.market}: {trade_date} 이슈가 이미 있다 — LLM 을 부르지 않는다")
        return 0
    stocks = stocks_of(board)
    if len(stocks) < 4:
        print(f"[issues] {args.market}: 사유가 검증된 종목 {len(stocks)}개 — 묶을 게 없다(기존 파일 유지)")
        return 0
    # 묶기는 종목 요약보다 어렵다 — flash 먼저(시장당 하루 1회라 한도 여유), 안 되면 flash-lite
    text, model, err = call_gemini(build_prompt(stocks, args.market, trade_date), models=MODELS)
    if not text:
        print(f"[issues] {args.market}: LLM 실패({err}) — 기존 파일 유지")
        return 1
    raw = parse_json_array(text)
    rejects: dict = {}
    issues = validate(raw or [], stocks, rejects)
    print(f"[issues] {args.market} {trade_date}: 입력 {len(stocks)}종목 · LLM {len(raw or [])}개 → 검증 통과 {len(issues)}개 ({model})"
          + (f" · 버림 {rejects}" if rejects else ""))
    payload = {"market": args.market, "tradeDate": trade_date, "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
               "count": len(issues), "model": model, "issues": issues}
    sec.write_data(out_json, out_js, "MARKET_ISSUES", payload, indent=None, allow_empty=True)
    if args.push and not sec.git_publish([str(out_json.relative_to(ROOT)), str(out_js.relative_to(ROOT))], f"market issues ({args.market})"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
