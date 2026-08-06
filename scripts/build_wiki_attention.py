#!/usr/bin/env python3
"""위키피디아 문서 조회수 = 리테일 관심도 프록시 — Wikimedia 공식 API, 키 불필요.

검색량·멘션과 달리 조회수는 '실제로 그 회사를 찾아본 사람 수'다. 최근 7일 평균이
직전 30일 평균 대비 몇 배인지(ratio)로 관심 급증을 잡는다. 미국은 영어 위키,
국내는 한국어 위키로 같은 방법을 쓴다.

  매핑: MediaWiki 검색 API 로 회사명 → 문서 제목. 검증(회사명 토큰이 제목에
  포함)을 통과한 종목만 싣는다 — 애매한 매핑으로 엉뚱한 문서를 세지 않는다(정직성).
  매핑은 산출물 JSON 의 map 에 캐시되어 재실행 시 신규 종목만 검색한다.

  조회수: wikimedia.org/api/rest_v1/metrics/pageviews/per-article (user 트래픽만
  — 봇 제외). 최근 45일 일별.

산출물: data/wiki_attention.json + .js(window.WIKI_ATTENTION). 값 없으면 기존
파일 유지.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "wiki_attention.json"
OUT_JS = ROOT / "data" / "wiki_attention.js"
US_SNAP = ROOT / "data" / "market_snapshot.json"
KR_SNAP = ROOT / "data" / "korea" / "market_snapshot.json"

UA = {"User-Agent": "MirUSStocks/1.0 (dydtjsdn@gmail.com) research"}
US_TOP, KR_TOP, KEEP = 120, 80, 40
# 사명 정규화에서 버리는 법인 접미사(영/한)
STRIP = {"inc", "inc.", "corp", "corp.", "corporation", "co", "co.", "ltd", "ltd.",
         "plc", "sa", "nv", "the", "company", "holdings", "holding", "group",
         "incorporated", "limited", "&", "n.v.", "s.a."}


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def get_json(url: str) -> dict | list | None:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def norm_tokens(name: str) -> list[str]:
    toks = [t.strip(",.()").lower() for t in (name or "").split()]
    return [t for t in toks if t and t not in STRIP]


def search_title(lang: str, company: str) -> str | None:
    """회사명 검색 → 상위 문서. 회사명 첫 토큰이 제목에 없으면 버린다."""
    q = urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": company,
        "srlimit": 1, "format": "json",
    })
    d = get_json(f"https://{lang}.wikipedia.org/w/api.php?{q}")
    hits = (d or {}).get("query", {}).get("search", [])
    if not hits:
        return None
    title = hits[0].get("title") or ""
    toks = norm_tokens(company)
    tl = title.lower()
    if not toks or toks[0] not in tl:
        return None
    return title


def fetch_views(lang: str, title: str) -> list[tuple[str, int]] | None:
    end = datetime.now(timezone.utc).date() - timedelta(days=1)
    start = end - timedelta(days=44)
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = (f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
           f"{lang}.wikipedia/all-access/user/{t}/daily/"
           f"{start.strftime('%Y%m%d')}00/{end.strftime('%Y%m%d')}00")
    d = get_json(url)
    items = (d or {}).get("items")
    if not items:
        return None
    return [(it["timestamp"][:8], int(it.get("views") or 0)) for it in items]


def load_top(path: Path, n: int) -> list[dict]:
    snap = json.loads(path.read_text(encoding="utf-8"))
    rows = [s for s in snap.get("stocks", []) if s.get("ticker") and s.get("company")]
    rows.sort(key=lambda s: s.get("marketCapB") or 0, reverse=True)
    return rows[:n]


def build_market(rows: list[dict], lang: str, cache: dict) -> list[dict]:
    out = []
    for s in rows:
        t, company = s["ticker"], s["company"]
        entry = cache.get(t)
        if entry is None:  # 신규 종목만 검색(캐시 미스). 실패는 False 로 기억.
            title = search_title(lang, company)
            cache[t] = title if title else False
            time.sleep(0.1)
        title = cache.get(t)
        if not title:
            continue
        views = fetch_views(lang, title)
        time.sleep(0.05)
        if not views or len(views) < 20:
            continue
        vals = [v for _, v in views]
        last7, prior = vals[-7:], vals[:-7][-30:]
        if not prior:
            continue
        avg7 = sum(last7) / len(last7)
        avg30 = sum(prior) / len(prior)
        if avg30 < 30:  # 조회수가 원래 미미한 문서는 비율이 요동쳐 신호가 안 된다
            continue
        out.append({
            "t": t,
            "company": company,
            "title": title,
            "avg7": round(avg7),
            "avg30": round(avg30),
            "ratio": round(avg7 / avg30, 2),
            "series": vals[-30:],
        })
    out.sort(key=lambda r: r["ratio"], reverse=True)
    return out[:KEEP]


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 위키 조회수 리테일 관심도 수집 ===")
    cache = {"us": {}, "kr": {}}
    if OUT_JSON.exists():
        try:
            cache = json.loads(OUT_JSON.read_text(encoding="utf-8")).get("map", cache)
            cache.setdefault("us", {})
            cache.setdefault("kr", {})
        except Exception:
            pass
    try:
        us = build_market(load_top(US_SNAP, US_TOP), "en", cache["us"])
        kr = build_market(load_top(KR_SNAP, KR_TOP), "ko", cache["kr"]) if KR_SNAP.exists() else []
    except Exception as e:  # noqa: BLE001
        print(f"[wiki] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if len(us) < 10:
        print(f"[wiki] US 유효 {len(us)}종목(<10) — 기존 파일 유지")
        return 1
    payload = {
        "updatedAtKst": kst_now_str(),
        "source": "Wikimedia Pageviews API (user 트래픽, 봇 제외)",
        "us": us,
        "kr": kr,
        "map": cache,
    }
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.WIKI_ATTENTION = {compact};\n")
    print(f"US {len(us)}종목 · KR {len(kr)}종목 → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
