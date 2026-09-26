#!/usr/bin/env python3
"""회사 로고(작은 원형 아이콘) — 회사 공식 홈페이지의 파비콘을 받아 64px WebP 로 레포에 저장.

화면: company-logo.js 의 companyLogoHtml(종목 상세 헤더·찾기 표·오늘의 특징주·오른쪽 레일·캘린더).
로고가 없는 종목은 화면이 이름 첫 글자 모노그램을 그린다.

왜 이렇게 하나 (2026-09-27 조사, PR 본문에 표)
  - 브라우저가 외부 로고 CDN 을 직접 부르면(핫링크) 방문자 IP 가 제3자에 노출되고 그 CDN 이 죽으면 화면이 깨진다.
    그래서 Actions 가 미리 받아 작게 줄여 레포에 둔다(파일당 1~3KB).
  - 티커 로고 서비스는 재배포(자체 호스팅) 조건이 맞지 않아 쓰지 않는다:
      Parqet/Elbstream  무료는 핫링크 + 출처 링크 조건, 자체 호스팅·캐시는 엔터프라이즈 전용
      FMP image-stock   데이터 표시·재배포는 별도 라이선스 계약 필요
      logo.dev          키 필요, 자체 호스팅 캐시는 유료 플랜
    네이버(ssl.pstatic.net) 로고 자산도 쓰지 않는다.
  - 대신 회사가 자기 홈페이지에 공개한 파비콘(apple-touch-icon · <link rel=icon> · /favicon.ico)을 쓴다 —
    회사를 식별하는 용도로만 작게 표시한다. 홈페이지가 봇을 막으면 Google 파비콘 서비스(s2/favicons)로
    같은 사이트의 파비콘을 받는다(빌드 때만, 종목당 1회).

도메인
  KR  data/company_profile/kr_NN.json 의 web(DART 기업개황 홈페이지)
  US  SEC submissions 의 website 는 거의 비어 있어서 Wikidata(CC0) 공식 웹사이트(P856)를 쓴다.
      SEC CIK(P5531) 로 먼저 맞추고, 없으면 NYSE·Nasdaq 티커(P249)로 맞춘다(다른 CIK 가 달린 항목은 제외).
      WDQS 가 실패하면 state 에 저장해 둔 지난 도메인을 그대로 쓴다.

품질 기준
  - 후보 중 가장 큰 것(apple-touch-icon 180px 등). SK하이닉스·AMD·LG화학처럼 16px 파비콘만 두는 대형사가 많아
    16px 도 받는다(화면 최대 32px 이라 2배 확대 — 알아볼 수는 있다). 16px 미만은 버린다.
  - 거의 투명하거나 한 가지 색뿐인 이미지, 흰 글자만 있는 투명 아이콘(흰 원판에서 안 보임)은 버린다.
  - 같은 이미지가 서로 다른 도메인 4곳 이상에서 나오면 호스팅 업체 기본 아이콘으로 보고 버린다.

증분
  - 성공한 종목은 28일, 실패한 종목은 14일 뒤에 다시 확인한다. 새로 상위 N 에 든 종목이 먼저다.
  - 이미지가 바이트 단위로 같으면 파일을 다시 쓰지 않는다(Pillow WebP 인코딩은 결정적).
  - 상위 N 에서 빠진 종목의 파일도 지우지 않는다(다시 들어올 때 churn 방지 — 연간 교체분만큼만 는다).

산출물
  data/logos/us/<TICKER>.webp · data/logos/kr/<코드>.webp   64×64 WebP
  data/logos/index.json/.js   window.COMPANY_LOGOS — 시장별 로고 보유 티커(공백 구분 문자열)·출처·기준 시각
  data/logos/state.json       빌더 증분 상태(브라우저는 안 읽는다)

실행: python scripts/build_company_logos.py [--market us|kr|all] [--top 1000] [--max 2500]
                                           [--only AAPL,005930] [--out DIR] [--push]
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import time
import urllib.parse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
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

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_DIR = ROOT / "data" / "logos"
US_SNAPSHOT = ROOT / "data" / "market_snapshot.json"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
PROFILE_DIR = ROOT / "data" / "company_profile"

SIZE = 64            # 저장 크기(px). 화면은 20~32px 원형 — 레티나 2배까지.
MIN_NATIVE = 16      # 원본 한 변 최소 px(16px 파비콘만 있는 대형사가 많다 — 더 큰 게 있으면 그걸 쓴다)
OK_REFRESH_DAYS = 28
FAIL_RETRY_DAYS = 14
GENERIC_DOMAINS = 4  # 같은 이미지가 이만큼의 서로 다른 도메인에서 나오면 기본 아이콘으로 본다
WORKERS = 8
TIMEOUT = 12
UA = {"User-Agent": "Mozilla/5.0 (compatible; MirLogoBot/1.0; +https://seonu-dragon.github.io/Mir_US_Stocks/)"}
WDQS = "https://query.wikidata.org/sparql"
WD_UA = {"User-Agent": "Mir-US-Stocks/1.0 (https://github.com/seonu-dragon/Mir_US_Stocks) company-logo-builder",
         "Accept": "application/sparql-results+json"}
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF", "etf"}
SOURCE = "각 회사 공식 홈페이지 파비콘(도메인: KR DART 기업개황 · US Wikidata 공식 웹사이트)"
SAFE_TICKER = re.compile(r"^[A-Za-z0-9.\-]{1,15}$")


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def today() -> date:
    return datetime.now(KST).date()


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


# ───────────────────────────────────────────────────────── 대상·도메인

def universe(path: Path, top: int) -> list[str]:
    snap = load_json(path, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in snap.get("stocks") or []
              if s.get("ticker") and s.get("sector") not in ETF_SECTORS and "ETF" not in str(s.get("sector") or "")]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    out = []
    for s in stocks[:top]:
        t = str(s["ticker"]).strip()
        if SAFE_TICKER.match(t):
            out.append(t)
    return out


def load_profiles(prefix: str) -> dict:
    out: dict = {}
    for p in sorted(PROFILE_DIR.glob(f"{prefix}_*.json")):
        payload = load_json(p, {}) or {}
        out.update(payload.get("t") or {})
    return out


def host_of(url: str) -> str | None:
    u = str(url or "").strip()
    if not u:
        return None
    if "//" not in u:
        u = "http://" + u
    try:
        h = (urllib.parse.urlparse(u).hostname or "").lower().strip(".")
    except ValueError:
        return None
    if not h or "." not in h or " " in h:
        return None
    return h


def pick_domain(urls) -> str | None:
    """여러 공식 사이트 URL(국가별 경로 등) 중 가장 많이 나온 호스트, 같으면 짧은 것."""
    hosts = [h for h in (host_of(u) for u in urls or []) if h]
    if not hosts:
        return None
    c = Counter(hosts)
    return sorted(c, key=lambda h: (-c[h], len(h), h))[0]


def wikidata_sites() -> dict | None:
    """{'cik': {cik: [site..]}, 'ticker': {TICKER: [(ciks, sites)..]}} — 실패하면 None."""
    import requests

    q = """SELECT ?item ?cik ?ticker ?site WHERE {
  ?item wdt:P856 ?site .
  { ?item wdt:P5531 ?cik . }
  UNION
  { VALUES ?exch { wd:Q13677 wd:Q82059 }
    ?item p:P414 ?st . ?st ps:P414 ?exch ; pq:P249 ?ticker .
    OPTIONAL { ?item wdt:P5531 ?cik . } }
}"""
    for attempt in range(1, 4):
        try:
            r = requests.get(WDQS, params={"query": q, "format": "json"}, headers=WD_UA, timeout=180)
            if r.status_code == 429:
                wait = min(90, int(r.headers.get("Retry-After") or 65))
                print(f"  [Wikidata] 429 — {wait}s 뒤 재시도({attempt}/3)")
                time.sleep(wait)
                continue
            r.raise_for_status()
            rows = r.json()["results"]["bindings"]
            break
        except Exception as e:  # noqa: BLE001
            print(f"  [Wikidata] 실패: {e}")
            time.sleep(10 * attempt)
    else:
        return None
    items: dict = {}
    for b in rows:
        it = items.setdefault(b["item"]["value"], {"cik": set(), "ticker": set(), "site": set()})
        if "cik" in b:
            try:
                it["cik"].add(int(b["cik"]["value"]))
            except ValueError:
                pass
        if "ticker" in b:
            it["ticker"].add(b["ticker"]["value"].strip().upper().replace(".", "-"))
        it["site"].add(b["site"]["value"])
    by_cik: dict = {}
    by_ticker: dict = {}
    for it in items.values():
        for c in it["cik"]:
            by_cik.setdefault(c, set()).update(it["site"])
        for t in it["ticker"]:
            by_ticker.setdefault(t, []).append((it["cik"], it["site"]))
    print(f"  [Wikidata] 항목 {len(items)} · CIK {len(by_cik)} · 티커 {len(by_ticker)}")
    return {"cik": by_cik, "ticker": by_ticker}


def us_domain(ticker: str, cik, wd: dict | None) -> str | None:
    if not wd:
        return None
    if cik and int(cik) in wd["cik"]:
        return pick_domain(wd["cik"][int(cik)])
    for ciks, sites in wd["ticker"].get(ticker.upper(), []):
        if ciks and cik and int(cik) not in ciks:
            continue  # 같은 티커를 쓰던 다른 회사
        return pick_domain(sites)
    return None


# ───────────────────────────────────────────────────────── 이미지

def decode(data: bytes):
    """(RGBA Image, 원본 한 변 px) 또는 None."""
    from PIL import Image

    if not data or len(data) < 80 or data.lstrip()[:1] == b"<":
        return None
    try:
        im = Image.open(io.BytesIO(data))
        if im.format == "ICO":
            sizes = sorted(im.ico.sizes(), key=lambda s: s[0] * s[1])
            if sizes:
                im.size = sizes[-1]  # 가장 큰 프레임
        im.load()
        native = min(im.size)
        return im.convert("RGBA"), native
    except Exception:
        return None


def quality_ok(im) -> bool:
    """투명·단색·흰 글자만 있는 아이콘은 버린다."""
    alpha = im.getchannel("A")
    if alpha.getextrema()[1] < 16:
        return False
    pixels = im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata()
    opaque = [px for px in pixels if px[3] >= 128]
    if len(opaque) < im.width * im.height * 0.04:
        return False
    lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b, _ in opaque]
    if max(lum) - min(lum) < 12:
        # 불투명한 단색 사각형(내용 없음)은 버린다. 투명 배경 위 한 가지 색 글리프는 괜찮다 —
        # 단, 흰색 글리프는 흰 원판에서 안 보이므로 버린다.
        full = len(opaque) >= im.width * im.height * 0.98
        if full or min(lum) > 235:
            return False
    near_white = sum(1 for v in lum if v > 235)
    transparent_bg = len(opaque) < im.width * im.height * 0.9
    if transparent_bg and near_white > len(opaque) * 0.9:
        return False
    return True


def border_color(im):
    """테두리 한 줄이 거의 한 색이면 그 색(RGB), 아니면 None."""
    w, h = im.size
    px = im.load()
    edge = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)]
    edge += [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    avg = tuple(sum(c[i] for c in edge) // len(edge) for i in range(3))
    far = sum(1 for c in edge if max(abs(c[i] - avg[i]) for i in range(3)) > 24)
    return avg if far <= len(edge) * 0.03 else None


def to_webp(im) -> bytes:
    """64px 불투명 정사각형 WebP. 같은 입력이면 같은 바이트.

    - 투명 배경 아이콘: 여백을 잘라 흰 판 가운데 72%(원에 내접하는 정사각형 ≈ 70.7%)에 둔다.
    - 불투명 아이콘(자체 배경이 있는 앱 아이콘형): 그대로 꽉 채운다 — 화면이 원형으로 자른다.
    화면은 늘 흰 원판 위에 그리므로 다크 모드에서도 검은 글리프가 묻히지 않는다.
    """
    from PIL import Image

    alpha = im.getchannel("A")
    hist = alpha.histogram()
    see_through = sum(hist[:250]) / max(1, im.width * im.height)
    if see_through > 0.02:
        box = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
        if box:
            im = im.crop(box)
        inner = round(SIZE * 0.72)
        scale = inner / max(im.size)
        w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
        glyph = im.resize((w, h), Image.LANCZOS)
        small = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
        small.alpha_composite(glyph, ((SIZE - w) // 2, (SIZE - h) // 2))
    else:
        side = min(im.size)
        left, top = (im.width - side) // 2, (im.height - side) // 2
        sq = im.crop((left, top, left + side, top + side)).convert("RGB")
        bg = border_color(sq)
        if bg is not None:
            # 단색 배경 위 로고(흰 바탕 워드마크 등): 원으로 자를 때 글자가 잘리지 않게 배경색으로 둘러 76% 로 줄인다.
            inner = round(SIZE * 0.76)
            small = Image.new("RGB", (SIZE, SIZE), bg)
            small.paste(sq.resize((inner, inner), Image.LANCZOS), ((SIZE - inner) // 2, (SIZE - inner) // 2))
        else:
            small = sq.resize((SIZE, SIZE), Image.LANCZOS)
    small = small.convert("RGB")
    best = None
    for kw in ({"lossless": True, "method": 6}, {"quality": 82, "method": 6}):
        buf = io.BytesIO()
        small.save(buf, "WEBP", **kw)
        b = buf.getvalue()
        if best is None or len(b) < len(best):
            best = b
    return best


# ───────────────────────────────────────────────────────── 네트워크

LINK_RE = re.compile(r"<link\b[^>]*>", re.I)
ATTR_RE = {k: re.compile(rf"\b{k}\s*=\s*[\"']?([^\"'>]+)", re.I) for k in ("rel", "href", "sizes")}


def http_get(session, url: str):
    try:
        r = session.get(url, headers=UA, timeout=TIMEOUT, allow_redirects=True)
        return r
    except Exception:
        return None


def icon_candidates(session, domain: str) -> list[str]:
    page = None
    for scheme in ("https", "http"):
        r = http_get(session, f"{scheme}://{domain}/")
        if r is not None and r.status_code < 400 and r.text:
            page = r
            break
    cands = []
    base = page.url if page is not None else f"https://{domain}/"
    if page is not None and "html" in (page.headers.get("content-type") or "html"):
        for tag in LINK_RE.findall(page.text[:400_000]):
            rel = ATTR_RE["rel"].search(tag)
            href = ATTR_RE["href"].search(tag)
            if not rel or not href or "icon" not in rel.group(1).lower():
                continue
            h = href.group(1).strip()
            if h.startswith("data:") or h.lower().split("?")[0].endswith(".svg"):
                continue
            sz = ATTR_RE["sizes"].search(tag)
            size = int(re.match(r"\d+", sz.group(1)).group()) if sz and re.match(r"\d+", sz.group(1)) else 0
            pri = 2 if "apple-touch" in rel.group(1).lower() else 1
            cands.append(((pri, size), urllib.parse.urljoin(base, h)))
    cands.sort(key=lambda x: x[0], reverse=True)
    root = f"{urllib.parse.urlparse(base).scheme or 'https'}://{urllib.parse.urlparse(base).hostname or domain}"
    urls = [u for _, u in cands] + [f"{root}/apple-touch-icon.png", f"{root}/favicon.ico"]
    return list(dict.fromkeys(urls))[:5]


GOOGLE_S2 = "https://www.google.com/s2/favicons?domain={domain}&sz={size}"
# 파비콘을 못 찾은 도메인에 Google 이 200 으로 돌려주는 기본 지구본 아이콘(원본 sha1). 실행 시작 때
# 존재하지 않는 도메인으로 한 번 받아 채운다(learn_google_default).
GOOGLE_DEFAULT: set[str] = set()


def learn_google_default() -> None:
    import requests

    r = http_get(requests, GOOGLE_S2.format(domain="mir-logo-probe-nonexistent.invalid", size=SIZE))
    if r is not None and r.content:
        GOOGLE_DEFAULT.add(hashlib.sha1(r.content).hexdigest())


def fetch_logo(domain: str):
    """(webp bytes, via, 원본 px, webp sha) 또는 None. 후보 중 원본이 가장 큰 것을 쓴다."""
    import requests

    best = None  # (native, im, via)
    with requests.Session() as s:
        for url in icon_candidates(s, domain):
            r = http_get(s, url)
            if r is None or r.status_code != 200:
                continue
            got = decode(r.content)
            if not got or got[1] < MIN_NATIVE or not quality_ok(got[0]):
                continue
            if best is None or got[1] > best[0]:
                best = (got[1], got[0], "site")
            if best[0] >= SIZE:
                break
        if best is None or best[0] < SIZE:
            r = http_get(s, GOOGLE_S2.format(domain=urllib.parse.quote(domain), size=SIZE))
            if r is not None and r.status_code == 200 and hashlib.sha1(r.content).hexdigest() not in GOOGLE_DEFAULT:
                got = decode(r.content)
                if got and got[1] >= MIN_NATIVE and quality_ok(got[0]) and (best is None or got[1] > best[0]):
                    best = (got[1], got[0], "google-s2")
    if best is None:
        return None
    data = to_webp(best[1])
    return data, best[2], best[0], hashlib.sha1(data).hexdigest()[:16]


# ───────────────────────────────────────────────────────── 실행

def due(rec: dict | None, domain: str | None, t0: date) -> bool:
    if not rec:
        return True
    if domain and rec.get("dom") != domain:
        return True
    try:
        at = date.fromisoformat(rec.get("at") or "")
    except ValueError:
        return True
    days = OK_REFRESH_DAYS if rec.get("ok") else FAIL_RETRY_DAYS
    return (t0 - at) >= timedelta(days=days)


def run_market(market: str, top: int, budget: int, only: set[str], state: dict, out_dir: Path) -> dict:
    snap = US_SNAPSHOT if market == "us" else KR_SNAPSHOT
    tickers = universe(snap, top)
    if only:
        tickers = [t for t in tickers if t.upper() in only] or [t for t in only if SAFE_TICKER.match(t)]
    profiles = load_profiles(market)
    st = state.setdefault(market, {})
    wd = wikidata_sites() if market == "us" else None
    if not GOOGLE_DEFAULT:
        learn_google_default()
    domains: dict = {}
    for t in tickers:
        dom = None
        prof = profiles.get(t) or {}
        if prof.get("alias"):
            prof = profiles.get(prof["alias"]) or {}
        if prof.get("web"):
            dom = host_of(prof["web"])
        if not dom and market == "us":
            dom = us_domain(t, prof.get("cik"), wd)
        if not dom:
            dom = (st.get(t) or {}).get("dom")  # 이번에 못 찾으면 지난번 도메인
        domains[t] = dom
    t0 = today()
    todo = [t for t in tickers if domains.get(t) and (only or due(st.get(t), domains[t], t0))]
    # 새 종목(상태 없음) → 오래 확인 안 한 순
    todo.sort(key=lambda t: (t in st, (st.get(t) or {}).get("at") or ""))
    todo = todo[:budget]
    print(f"[{market.upper()}] 대상 {len(tickers)} · 도메인 {sum(1 for t in tickers if domains.get(t))} · 이번 확인 {len(todo)}")

    by_domain = {}
    for t in todo:
        by_domain.setdefault(domains[t], []).append(t)
    started = time.time()
    with ThreadPoolExecutor(WORKERS) as ex:
        results = dict(zip(by_domain, ex.map(fetch_logo, list(by_domain))))
    print(f"  수집 {len(by_domain)}개 도메인 · {time.time() - started:.0f}s")

    # 기본 아이콘 판정: 이번 결과 + 지난 상태의 원본 해시를 도메인 단위로 센다.
    sha_domains: dict = {}
    for dom, res in results.items():
        if res:
            sha_domains.setdefault(res[3], set()).add(dom)
    for rec in st.values():
        if rec.get("ok") and rec.get("sha") and rec.get("dom"):
            sha_domains.setdefault(rec["sha"], set()).add(rec["dom"])
    generic = {sha for sha, ds in sha_domains.items() if len(ds) >= GENERIC_DOMAINS}

    ok = fail = written = 0
    for t in todo:
        dom = domains[t]
        res = results.get(dom)
        path = out_dir / market / f"{t}.webp"
        if res and res[3] not in generic:
            data, via, native, sha = res
            if not path.exists() or path.read_bytes() != data:
                atomic_write_bytes(path, data)
                written += 1
            st[t] = {"dom": dom, "ok": 1, "via": via, "px": native, "sha": sha, "at": t0.isoformat()}
            ok += 1
        else:
            prev_ok = (st.get(t) or {}).get("ok") and path.exists()
            if res and res[3] in generic and path.exists():
                path.unlink()
                prev_ok = False
            if prev_ok:
                # 이번엔 못 받았지만(일시 장애) 예전 파일은 유지하고 곧 다시 본다.
                st[t] = {**st[t], "at": (t0 - timedelta(days=OK_REFRESH_DAYS - FAIL_RETRY_DAYS)).isoformat()}
            else:
                st[t] = {"dom": dom, "ok": 0, "at": t0.isoformat()}
            fail += 1
    # 기본 아이콘으로 판정된 해시를 가진 예전 파일도 정리한다.
    for t, rec in st.items():
        if rec.get("ok") and rec.get("sha") in generic:
            p = out_dir / market / f"{t}.webp"
            if p.exists():
                p.unlink()
            st[t] = {"dom": rec.get("dom"), "ok": 0, "at": rec.get("at")}
    have = sorted(p.stem for p in (out_dir / market).glob("*.webp")) if (out_dir / market).exists() else []
    in_top = sum(1 for t in tickers if (out_dir / market / f"{t}.webp").exists())
    print(f"  성공 {ok} · 실패 {fail} · 새로 쓴 파일 {written} · 보유 {len(have)} · 상위 {len(tickers)} 중 {in_top}")
    return {"ok": ok, "fail": fail, "tried": len(todo), "have": have, "universe": len(tickers), "inTop": in_top}


def main() -> int:
    ap = argparse.ArgumentParser(description="회사 로고(공식 홈페이지 파비콘) 수집")
    ap.add_argument("--market", choices=["us", "kr", "all"], default="all")
    ap.add_argument("--top", type=int, default=1000, help="시장별 시가총액 상위 N")
    ap.add_argument("--max", type=int, default=2500, help="시장별 이번 실행 확인 상한")
    ap.add_argument("--only", default="", help="쉼표로 구분한 티커(테스트용)")
    ap.add_argument("--out", default="", help="출력 폴더(기본 data/logos)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    only = {x.strip().upper() for x in args.only.split(",") if x.strip()}
    out_dir = Path(args.out) if args.out else OUT_DIR
    index_json = out_dir / "index.json"
    state_json = out_dir / "state.json"

    index = load_json(index_json, {}) or {}
    markets_meta = dict(index.get("markets") or {})
    state = load_json(state_json, {}) or {}
    status = 0
    for m in (["us", "kr"] if args.market == "all" else [args.market]):
        r = run_market(m, args.top, args.max, only, state, out_dir)
        if r["tried"] and r["ok"] == 0:
            print(f"[{m.upper()}] 성공 0 · 실패 {r['fail']} — 소스 장애로 보고 실패 처리(기존 파일 유지)")
            status = 1
        prev = markets_meta.get(m) or {}
        if prev.get("count") and len(r["have"]) < int(prev["count"]) * 0.8:
            print(f"[{m.upper()}] 로고 {prev['count']} → {len(r['have'])} 급감 — 인덱스를 쓰지 않는다")
            status = 1
            continue
        markets_meta[m] = {
            "count": len(r["have"]),
            "universe": r["universe"],
            "inTop": r["inTop"],
            "updatedAtKst": now_kst() if r["tried"] else prev.get("updatedAtKst", now_kst()),
            "tickers": " ".join(r["have"]),
        }
    payload = {
        "schema": 1,
        "updatedAtKst": now_kst(),
        "source": SOURCE,
        "size": SIZE,
        "count": sum(int(v.get("count") or 0) for v in markets_meta.values()),
        "markets": markets_meta,
    }
    import sec_client as sec

    # 급감 방어는 위의 시장별 80% 검사가 먼저 하고, write_data 가 0건 덮어쓰기를 한 번 더 막는다.
    sec.write_data(index_json, out_dir / "index.js", "COMPANY_LOGOS", payload, indent=None)
    atomic_write_text(state_json, json.dumps(state, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")

    if args.push:
        with repository_publish_lock(ROOT):
            if not sec.git_publish(["data/logos"], "company logos"):
                return 1
    return status


if __name__ == "__main__":
    raise SystemExit(main())
