"""sitemap.xml 생성 — 홈/분석 페이지 + 종목별 딥링크.

왜 종목 딥링크를 넣나:
  종목 상세 데이터가 US 7,098 · KR 3,796 개 있는데 sitemap 에는 URL 이 2개뿐이라,
  검색엔진 입장에서 이 사이트는 사실상 2페이지였다.

왜 전부 넣지 않나:
  1만 개가 넘는 클라이언트 렌더 페이지를 한꺼번에 올리면 thin content 로 취급되기
  쉽다. 시가총액 상위로 제한해, 실제로 검색 수요가 있고 데이터도 두꺼운 종목만
  올린다(--limit 로 조절).

전제:
  analysis.js 의 updateAnalysisMeta 가 ?t= 진입 시 canonical·제목·설명·OG 를 그
  종목 것으로 바꿔 준다. 그게 없으면 canonical 이 전부 analysis.html 을 가리켜서
  여기 올린 URL 들은 중복으로 무시된다 — 이 스크립트만 돌려서는 효과가 없다.

사용법:
  py scripts/build_sitemap.py                 # 시장별 상위 300종목
  py scripts/build_sitemap.py --limit 500
  py scripts/build_sitemap.py --check         # 갱신 필요하면 exit 1 (CI 용)
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 U+2014 출력이 UnicodeEncodeError 로 죽는다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://seonu-dragon.github.io/Mir_US_Stocks"
OUT = ROOT / "sitemap.xml"
KST = ZoneInfo("Asia/Seoul")

MARKETS = {
    "us": {"snapshot": ROOT / "data" / "market_snapshot.json",
           "details": ROOT / "data" / "details"},
    "kr": {"snapshot": ROOT / "data" / "korea" / "market_snapshot.json",
           "details": ROOT / "data" / "korea" / "details"},
}


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def snapshot_date(payload) -> str:
    """스냅샷 기준 시각을 lastmod(YYYY-MM-DD)로."""
    raw = (payload or {}).get("updatedAtKst") or ""
    try:
        return datetime.strptime(raw.split()[0], "%Y-%m-%d").strftime("%Y-%m-%d")
    except (ValueError, IndexError):
        return datetime.now(KST).strftime("%Y-%m-%d")


def pick_tickers(market: str, limit: int) -> tuple[list[str], str]:
    cfg = MARKETS[market]
    snap = load_json(cfg["snapshot"])
    if not snap:
        print(f"  [{market}] 스냅샷을 읽지 못했다: {cfg['snapshot']}", file=sys.stderr)
        return [], datetime.now(KST).strftime("%Y-%m-%d")

    stocks = snap.get("stocks") or []
    # 상세 JSON 이 실제로 있는 종목만. 없으면 분석 페이지가 "데이터를 찾을 수 없습니다"
    # 를 띄우는데, 그런 URL 을 검색엔진에 제출하면 안 된다.
    have_detail = {p.stem.upper() for p in cfg["details"].glob("*.json")}

    ranked = []
    for s in stocks:
        ticker = str(s.get("ticker") or "").strip()
        if not ticker or ticker.upper() not in have_detail:
            continue
        cap = s.get("marketCapB")
        try:
            cap = float(cap)
        except (TypeError, ValueError):
            cap = 0.0
        ranked.append((cap, ticker))

    ranked.sort(key=lambda x: (-x[0], x[1]))
    picked = [t for _, t in ranked[:limit]]
    print(f"  [{market}] 종목 {len(stocks):,} · 상세 보유 {len(have_detail):,} "
          f"→ 수록 {len(picked):,}")
    return picked, snapshot_date(snap)


def build_xml(limit: int) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!--",
        "  scripts/build_sitemap.py 가 생성한다. 직접 고치지 말 것.",
        "  홈·분석 페이지 + 시가총액 상위 종목의 분석 딥링크(?t=).",
        "  sector-detail.html 은 리다이렉트, chart_capture.html 은 내부 도구라 제외.",
        "-->",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    def url(loc: str, lastmod: str, changefreq: str, priority: str) -> None:
        lines.extend([
            "  <url>",
            f"    <loc>{escape(loc)}</loc>",
            f"    <lastmod>{lastmod}</lastmod>",
            f"    <changefreq>{changefreq}</changefreq>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ])

    us_tickers, us_date = pick_tickers("us", limit)
    kr_tickers, kr_date = pick_tickers("kr", limit)
    newest = max(us_date, kr_date)

    url(f"{BASE}/", newest, "daily", "1.0")
    url(f"{BASE}/analysis.html", newest, "daily", "0.8")

    for market, tickers, date in (("us", us_tickers, us_date), ("kr", kr_tickers, kr_date)):
        for ticker in tickers:
            # KR 은 ?market=kr 이 있어야 분석 페이지가 국내 모드로 뜬다.
            # 여기서는 날 것의 & 를 쓴다 — XML 이스케이프는 url() 의 escape() 가
            # 한 번만 해야 한다. 미리 &amp; 로 써 두면 &amp;amp; 가 된다.
            suffix = "&market=kr" if market == "kr" else ""
            url(f"{BASE}/analysis.html?t={ticker}{suffix}", date, "weekly", "0.5")

    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=300, help="시장별 최대 종목 수")
    ap.add_argument("--check", action="store_true",
                    help="파일을 쓰지 않고, 현재 sitemap.xml 과 다르면 exit 1")
    args = ap.parse_args()

    xml = build_xml(args.limit)
    count = xml.count("<url>")

    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != xml:
            print(f"sitemap.xml 이 최신이 아니다 (예상 {count} URL). "
                  f"py scripts/build_sitemap.py 를 실행할 것.", file=sys.stderr)
            return 1
        print(f"OK — sitemap.xml 최신 ({count} URL)")
        return 0

    OUT.write_text(xml, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} — {count} URL")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
