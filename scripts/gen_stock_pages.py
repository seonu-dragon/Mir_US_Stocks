#!/usr/bin/env python3
"""종목 정적 요약 페이지 — 배포 스테이징(_site/)에서만 만든다(레포에 커밋하지 않는다).

sitemap.xml(scripts/build_sitemap.py — 단일 원천)이 시장별 시가총액 상위 종목을 `stock/<시장>/<티커>.html`
로 올린다. 이 스크립트는 그 목록을 읽어 각 페이지를 서버 렌더 HTML 로 쓴다: 종가·등락·시가총액·밸류에이션·
수익률·52주 범위, 회사 정보, 같은 업종 종목 링크, JSON-LD(Corporation·WebPage·BreadcrumbList), 자기 canonical.
상호작용 화면(analysis.html?t=)으로 가는 링크를 단다. 분석 페이지는 JS 렌더라 검색엔진에는 이 페이지가 실체다.

실패해도 404 URL 을 sitemap 에 남기지 않는다: 먼저 _site/sitemap.xml 의 종목 URL 을 분석 딥링크로 바꿔 쓴 뒤
(이 상태로 죽으면 예전 sitemap 과 같다) 페이지를 만들고, 실제로 쓴 페이지만 정적 URL 로 되돌려 다시 쓴다.

사용: python3 scripts/gen_stock_pages.py --root _site
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

if sys.platform == "win32":
    # cp949 콘솔에서 한글·U+2014 출력이 UnicodeEncodeError 로 죽는다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from build_sitemap import BASE, HUB_REL, analysis_deeplink, stock_page_rel  # noqa: E402

SITE = {"us": "미르의 미국 주식", "kr": "미르의 한국 주식"}
MARKET_KO = {"us": "미국", "kr": "국내"}
STOCK_LOC_RE = re.compile(r"/stock/(us|kr)/([^/<]+)\.html")
URL_BLOCK_RE = re.compile(r"[ \t]*<url>\s*<loc>([^<]+)</loc>.*?</url>\n?", re.S)


def load_json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def esc(v) -> str:
    return html.escape(str(v), quote=True)


def num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and f not in (float("inf"), float("-inf")) else None


def fmt_price(v, market):
    v = num(v)
    if v is None:
        return "—"
    return f"{v:,.0f}원" if market == "kr" else f"${v:,.2f}"


def fmt_pct(v, digits=2):
    v = num(v)
    if v is None:
        return "—"
    return f"{'+' if v > 0 else ''}{v:.{digits}f}%"


def fmt_cap(v, market):
    v = num(v)
    if v is None or v <= 0:
        return "—"
    if market == "kr":   # marketCapB = 조원
        return f"{v:,.1f}조원" if v >= 1 else f"{v * 10000:,.0f}억원"
    return f"${v / 1000:,.2f}T" if v >= 1000 else f"${v:,.1f}B"


def tone(v, market):
    v = num(v)
    if not v:
        return ""
    return "pos" if v > 0 else "neg"


def sane_multiple(v, hi=1000):
    v = num(v)
    return v if v is not None and 0 < v < hi else None


def page_html(market: str, row: dict, fund: dict, prof: dict, peers: list, as_of: str) -> str:
    t = str(row["ticker"])
    name = str(row.get("company") or t)
    label = f"{name}({t})"
    site = SITE[market]
    url = f"{BASE}/{stock_page_rel(market, t)}"
    deeplink = f"../../{analysis_deeplink(market, t)}"
    dash = f"../../index.html?market={market}&tab=search&ticker={t}"
    price = fmt_price(row.get("price"), market)
    chg = num(row.get("changePct"))
    cap = fmt_cap(row.get("marketCapB"), market)
    pe = sane_multiple(fund.get("pe"))
    fpe = sane_multiple(fund.get("forwardPE"))
    pb = sane_multiple(fund.get("pb"), 200)
    dy = num(fund.get("divYield"))
    roe = num(fund.get("roe"))
    lo, hi = num(fund.get("low52")), num(fund.get("high52"))
    sector = " · ".join(str(x) for x in (row.get("sector"), row.get("industry")) if x)
    # 가격은 그 종목 마지막 종가일(priceDate) 기준 — 스냅샷 갱신일(as_of)과 다를 수 있다.
    px_date = str(row.get("priceDate") or "")[:10] or as_of

    desc_bits = [f"{px_date} 종가 {price}({fmt_pct(chg)})", f"시가총액 {cap}"]
    if pe:
        desc_bits.append(f"PER {pe:.1f}배")
    if dy and dy > 0:
        desc_bits.append(f"배당수익률 {dy:.2f}%")
    desc = f"{label} 주가·밸류에이션 요약 — " + ", ".join(desc_bits) + f". {site}에서 차트·패턴 분석을 볼 수 있습니다."
    title = f"{label} 주가·밸류에이션 요약 | {site}"

    stats = [
        ("시가총액", cap, ""),
        ("PER", f"{pe:.1f}배" if pe else "—", ""),
        ("선행 PER", f"{fpe:.1f}배" if fpe else "—", ""),
        ("PBR", f"{pb:.2f}배" if pb else "—", ""),
        ("배당수익률", f"{dy:.2f}%" if dy and dy > 0 else "—", ""),
        ("ROE", f"{roe:.1f}%" if roe is not None else "—", ""),
        ("1개월", fmt_pct(row.get("monthChangePct"), 1), tone(row.get("monthChangePct"), market)),
        ("3개월", fmt_pct(row.get("threeMonthChangePct"), 1), tone(row.get("threeMonthChangePct"), market)),
        ("연초 대비", fmt_pct(row.get("ytdChangePct"), 1), tone(row.get("ytdChangePct"), market)),
        ("52주 범위", f"{fmt_price(lo, market)} ~ {fmt_price(hi, market)}" if lo and hi else "—", ""),
    ]
    stat_html = "".join(f'<div><dt>{esc(k)}</dt><dd class="{c}">{esc(v)}</dd></div>' for k, v, c in stats)

    info = []
    if prof.get("addr"):
        info.append(("주소", prof["addr"]))
    if prof.get("est"):
        info.append(("설립", prof["est"]))
    if prof.get("emp"):
        info.append(("직원 수", f"{int(prof['emp']):,}명"))
    if prof.get("ceo"):
        info.append(("대표", prof["ceo"]))
    if prof.get("exch"):
        info.append(("거래소", ", ".join(prof["exch"])))
    if prof.get("sicDesc"):
        info.append(("업종(SIC)", prof["sicDesc"]))
    web = str(prof.get("web") or "").strip()
    info_html = "".join(f"<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in info)
    if web:
        href = web if web.startswith("http") else f"https://{web}"
        info_html += f'<div><dt>웹사이트</dt><dd><a href="{esc(href)}" rel="nofollow noopener">{esc(web)}</a></dd></div>'

    peer_html = "".join(
        f'<li><a href="{esc(p["ticker"])}.html">{esc(p["company"] or p["ticker"])} <span>{esc(p["ticker"])}</span></a></li>'
        for p in peers)

    org = {"@type": "Corporation", "name": name, "tickerSymbol": t}
    if prof.get("nameEn"):
        org["alternateName"] = prof["nameEn"]
    if prof.get("addr"):
        org["address"] = prof["addr"]
    if prof.get("est"):
        org["foundingDate"] = prof["est"]
    if prof.get("emp"):
        org["numberOfEmployees"] = {"@type": "QuantitativeValue", "value": int(prof["emp"])}
    if web:
        org["url"] = web if web.startswith("http") else f"https://{web}"
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": url, "url": url, "name": title, "description": desc, "inLanguage": "ko",
             "dateModified": as_of, "about": org,
             "isPartOf": {"@type": "WebSite", "name": site, "url": f"{BASE}/"}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": site, "item": f"{BASE}/"},
                {"@type": "ListItem", "position": 2, "name": f"{MARKET_KO[market]} 종목", "item": f"{BASE}/{HUB_REL[market]}"},
                {"@type": "ListItem", "position": 3, "name": label, "item": url},
            ]},
        ],
    }
    # <script> 안이라 '<'·'>'·'&' 를 JSON 유니코드 이스케이프로 — 회사명에 든 '</script' 등이 블록을 끊지 못하게(값은 같다).
    ld_json = json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return f"""<!doctype html>
<html lang="ko" data-market="{market}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(site)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{BASE}/og-cover.png?v=4">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../favicon.ico?v=5">
<script type="application/ld+json">{ld_json}</script>
<style>{PAGE_CSS}</style>
</head>
<body>
<header class="top"><a href="../../index.html?market={market}">{esc(site)}</a><nav><a href="index.html">{MARKET_KO[market]} 종목</a></nav></header>
<main>
<p class="crumb"><a href="../../index.html?market={market}">홈</a> › <a href="index.html">{MARKET_KO[market]} 종목</a> › {esc(t)}</p>
<h1>{esc(name)} <span class="tk">{esc(t)}</span></h1>
<p class="sub">{esc(sector)}{' · ' if sector else ''}{esc(px_date)} 종가 기준</p>
<p class="price">{esc(price)} <span class="{tone(chg, market)}">{esc(fmt_pct(chg))}</span></p>
<p class="cta"><a class="btn" href="{esc(deeplink)}">차트·패턴 분석 열기</a><a class="btn ghost" href="{esc(dash)}">대시보드에서 보기</a></p>
<h2>핵심 지표</h2>
<dl class="grid">{stat_html}</dl>
{f'<h2>회사 정보</h2><dl class="grid info">{info_html}</dl>' if info_html else ''}
{f'<h2>같은 업종</h2><ul class="peers">{peer_html}</ul>' if peer_html else ''}
</main>
<footer>투자 판단의 참고 자료이며 매수/매도 추천이 아닙니다.</footer>
</body>
</html>
"""


def hub_html(market: str, rows: list, as_of: str) -> str:
    site = SITE[market]
    url = f"{BASE}/{HUB_REL[market]}"
    title = f"{MARKET_KO[market]} 시가총액 상위 종목 요약 | {site}"
    desc = f"{site} — {MARKET_KO[market]} 시가총액 상위 {len(rows)}종목의 주가·밸류에이션 요약 페이지 목록({as_of} 기준)."
    items = "".join(
        f'<li><a href="{esc(r["ticker"])}.html">{esc(r.get("company") or r["ticker"])} <span>{esc(r["ticker"])}</span></a>'
        f'<em>{esc(fmt_cap(r.get("marketCapB"), market))}</em></li>' for r in rows)
    return f"""<!doctype html>
<html lang="ko" data-market="{market}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(url)}">
<link rel="icon" href="../../favicon.ico?v=5">
<style>{PAGE_CSS}</style>
</head>
<body>
<header class="top"><a href="../../index.html?market={market}">{esc(site)}</a></header>
<main>
<h1>{MARKET_KO[market]} 시가총액 상위 {len(rows)}종목</h1>
<p class="sub">{esc(as_of)} 기준 · 시가총액 순</p>
<ol class="hub">{items}</ol>
</main>
<footer>투자 판단의 참고 자료이며 매수/매도 추천이 아닙니다.</footer>
</body>
</html>
"""


PAGE_CSS = (
    ":root{--bg:#fff;--panel:#f7f8fa;--text:#111827;--muted:#6b7280;--line:#e5e7eb;--accent:#1d4ed8;--pos:#16a34a;--neg:#dc2626}"
    "html[data-market=kr]{--pos:#dc2626;--neg:#2563eb}"
    "@media (prefers-color-scheme:dark){:root{--bg:#0b0f17;--panel:#121826;--text:#e5e7eb;--muted:#9ca3af;--line:#1f2937;--accent:#60a5fa;--pos:#22c55e;--neg:#f87171}"
    "html[data-market=kr]{--pos:#f87171;--neg:#60a5fa}}"
    "*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 -apple-system,BlinkMacSystemFont,'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif}"
    "a{color:var(--accent)}.top{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}"
    ".top a{font-weight:700;text-decoration:none;color:var(--text)}.top nav a{font-weight:500;color:var(--muted)}"
    "main{max-width:880px;margin:0 auto;padding:16px}.crumb{font-size:13px;color:var(--muted);margin:0 0 8px}.crumb a{color:var(--muted)}"
    "h1{font-size:26px;margin:4px 0}.tk{font-size:16px;color:var(--muted);font-weight:600}.sub{color:var(--muted);margin:0 0 8px;font-size:14px}"
    ".price{font-size:28px;font-weight:800;margin:4px 0 12px;font-variant-numeric:tabular-nums}.price span{font-size:18px;margin-left:6px}"
    ".pos{color:var(--pos)}.neg{color:var(--neg)}.cta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}"
    ".btn{display:inline-block;padding:10px 16px;border-radius:10px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}"
    ".btn.ghost{background:transparent;color:var(--accent);border:1px solid var(--line)}"
    "h2{font-size:17px;margin:22px 0 10px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin:0}"
    ".grid div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:0}"
    ".grid dt{font-size:12px;color:var(--muted)}.grid dd{margin:2px 0 0;font-weight:700;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}"
    ".info dd{font-weight:500}.peers,.hub{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px}"
    ".peers a,.hub a{text-decoration:none}.peers span,.hub span{color:var(--muted);font-size:13px}.hub li{display:flex;justify-content:space-between;gap:8px;"
    "padding:8px 10px;border-bottom:1px solid var(--line)}.hub em{font-style:normal;color:var(--muted);font-size:13px;white-space:nowrap}"
    "footer{max-width:880px;margin:24px auto;padding:16px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}"
)


def profile_for(market: str, ticker: str) -> dict:
    """company_profile 샤드에서 레코드(없으면 빈 dict). 샤드 이름은 인덱스가 알려 준다."""
    base = ROOT / "data" / "company_profile"
    cache = profile_for.__dict__.setdefault("cache", {})
    if market not in cache:
        recs = {}
        for p in sorted(base.glob(f"{market}_*.json")):
            d = load_json(p) or {}
            recs.update(d.get("t") if isinstance(d.get("t"), dict) else d)
        cache[market] = recs
    rec = cache[market].get(ticker)
    return rec if isinstance(rec, dict) else {}


def rewrite_sitemap(xml: str, ok: set[tuple[str, str]], hubs_ok: set[str]) -> str:
    """정적 URL 중 실제로 쓴 페이지만 남기고, 나머지 종목은 분석 딥링크로, 못 쓴 허브는 뺀다."""
    def sub(m):
        block, loc = m.group(0), html.unescape(m.group(1))
        for mk, rel in HUB_REL.items():
            if loc == f"{BASE}/{rel}":
                return block if mk in hubs_ok else ""
        sm = STOCK_LOC_RE.search(loc)
        if sm and (sm.group(1), sm.group(2)) not in ok:
            deep = html.escape(f"{BASE}/{analysis_deeplink(sm.group(1), sm.group(2))}", quote=False)
            return block.replace(m.group(1), deep)
        return block
    return URL_BLOCK_RE.sub(sub, xml)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="배포 스테이징 폴더(_site)")
    a = ap.parse_args(argv)
    site = Path(a.root)
    sm_path = site / "sitemap.xml"
    xml = sm_path.read_text(encoding="utf-8")
    wanted = [(m.group(1), m.group(2)) for m in STOCK_LOC_RE.finditer(xml) if m.group(2) != "index"]
    # 1) 먼저 '아무 페이지도 없다'고 보고 sitemap 을 딥링크판으로 — 여기서 죽어도 404 URL 이 남지 않는다.
    sm_path.write_text(rewrite_sitemap(xml, set(), set()), encoding="utf-8")

    snaps = {"us": load_json(ROOT / "data" / "market_snapshot.json") or {},
             "kr": load_json(ROOT / "data" / "korea" / "market_snapshot.json") or {}}
    funds = {"us": load_json(ROOT / "data" / "map_fundamentals.json") or {},
             "kr": load_json(ROOT / "data" / "korea" / "map_fundamentals.json") or {}}
    rows = {m: {str(s.get("ticker")): s for s in (snaps[m].get("stocks") or []) if s.get("ticker")} for m in snaps}
    as_of = {m: str(snaps[m].get("updatedAtKst") or "")[:10] for m in snaps}
    by_market = {"us": [t for m, t in wanted if m == "us"], "kr": [t for m, t in wanted if m == "kr"]}

    ok: set[tuple[str, str]] = set()
    for market, tickers in by_market.items():
        listed = [rows[market][t] for t in tickers if t in rows[market]]
        for t in tickers:
            row = rows[market].get(t)
            if not row:
                continue
            try:
                ind = row.get("industry")
                peers = [r for r in listed if r is not row and ind and r.get("industry") == ind][:8]
                text = page_html(market, row, funds[market].get(t) or {}, profile_for(market, t), peers, as_of[market])
                out = site / stock_page_rel(market, t)
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(text, encoding="utf-8")
                ok.add((market, t))
            except Exception as exc:   # 한 종목 실패가 나머지를 막지 않게(그 종목은 딥링크로 남는다)
                print(f"[stock-pages] {market}/{t}: {exc}")
    hubs_ok = set()
    for market in ("us", "kr"):
        made = [rows[market][t] for t in by_market[market] if (market, t) in ok]
        if not made:
            continue
        (site / HUB_REL[market]).parent.mkdir(parents=True, exist_ok=True)
        (site / HUB_REL[market]).write_text(hub_html(market, made, as_of[market]), encoding="utf-8")
        hubs_ok.add(market)
    # 2) 실제로 쓴 페이지만 정적 URL 로.
    sm_path.write_text(rewrite_sitemap(xml, ok, hubs_ok), encoding="utf-8")
    print(f"[stock-pages] 요청 {len(wanted)} · 생성 {len(ok)} · 허브 {sorted(hubs_ok)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
