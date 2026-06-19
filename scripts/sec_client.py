#!/usr/bin/env python3
"""공용 SEC EDGAR 접근 유틸 (내부자/13D·G/8-K/IPO 빌드 공유).

SEC Archives 는 Akamai 봇 매니저가 Sec-Fetch-*/sec-ch-ua 브라우저 헤더를
요구하므로 SEC_HEADERS 로 항상 그 헤더를 보낸다. data.sec.gov / efts /
www.sec.gov/Archives 모두 이 헤더로 접근 가능(검증 완료).
"""

from __future__ import annotations

import gzip
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
ET_TZ = ZoneInfo("America/New_York")

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "market_snapshot.json"

SEC_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
EFTS_URL = "https://efts.sec.gov/LATEST/search-index"
REQUEST_PAUSE = 0.13  # SEC 예의상 ~8 req/s


def sec_get(url, retries=4):
    """원시 bytes 반환. 403/404 즉시 중단, 429/5xx 백오프 재시도."""
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=SEC_HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                time.sleep(REQUEST_PAUSE)
                return data
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            time.sleep(1.5 * (attempt + 1))
    raise last


def sec_get_json(url):
    return json.loads(sec_get(url))


def efts_hits(forms, startdt, enddt, cap=10000):
    """efts 전문검색 히트(페이지네이션). 8-K/S-1/424B4 등 indexed form 용."""
    hits = []
    frm = 0
    while frm < cap:
        q = urllib.parse.urlencode({
            "q": "", "forms": forms, "startdt": startdt, "enddt": enddt, "from": frm,
        })
        try:
            data = sec_get_json(f"{EFTS_URL}?{q}")
        except Exception as exc:
            print(f"    [경고] efts {forms} {startdt}~{enddt} from={frm} 실패: {exc}")
            break
        page = data.get("hits", {}).get("hits", [])
        if not page:
            break
        hits.extend(page)
        total = data.get("hits", {}).get("total", {}).get("value", 0)
        frm += len(page)
        if frm >= total:
            break
    return hits


def load_universe_tickers(top=0):
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    stocks = snap.get("stocks") or []
    if top and top > 0:
        stocks = sorted(stocks, key=lambda s: float(s.get("marketCapB") or 0), reverse=True)[:top]
    return {str(s["ticker"]).upper() for s in stocks if s.get("ticker")}


def company_ticker_maps():
    """(cik_to_ticker_all, ticker_to_cik_all) — company_tickers.json 전체."""
    ct = sec_get_json(COMPANY_TICKERS_URL)
    cik_to_ticker, ticker_to_cik = {}, {}
    for row in ct.values():
        tkr = str(row.get("ticker") or "").upper()
        cik = int(row.get("cik_str") or 0)
        if tkr and cik:
            cik_to_ticker.setdefault(cik, tkr)
            ticker_to_cik.setdefault(tkr, cik)
    return cik_to_ticker, ticker_to_cik


def universe_cik_map(top=0):
    """추적 종목 ∩ company_tickers → (issuer CIK 집합, CIK→ticker)."""
    universe = load_universe_tickers(top=top)
    cik_to_ticker_all, _ = company_ticker_maps()
    cik_to_ticker = {cik: tkr for cik, tkr in cik_to_ticker_all.items() if tkr in universe}
    return set(cik_to_ticker.keys()), cik_to_ticker


def daily_index_rows(day_iso, form_prefixes):
    """일별 form.idx 에서 주어진 폼 접두사로 시작하는 행 파싱.

    반환: [{form, name, cik, date, path}] — efts 가 누락하는 SCHEDULE 13D/G 등에 사용.
    주말/휴일은 인덱스가 없어 빈 리스트.
    """
    dt = datetime.fromisoformat(day_iso)
    qtr = (dt.month - 1) // 3 + 1
    url = (f"https://www.sec.gov/Archives/edgar/daily-index/"
           f"{dt.year}/QTR{qtr}/form.{dt.strftime('%Y%m%d')}.idx")
    try:
        text = sec_get(url).decode("latin-1")
    except Exception:
        return []
    rows = []
    prefixes = tuple(form_prefixes)
    # 줄 끝 패턴: ... <CIK> <YYYYMMDD> edgar/<path>
    tail_re = re.compile(r"\s(\d{1,10})\s+(\d{8})\s+(edgar/\S+)\s*$")
    head_re = re.compile(r"^(\S+(?: \S+)*?)\s{2,}(.*)$")
    for line in text.splitlines():
        if not line.startswith(prefixes):
            continue
        m = tail_re.search(line)
        if not m:
            continue
        cik, d8, path = m.group(1), m.group(2), m.group(3)
        head = line[:m.start()].rstrip()
        hm = head_re.match(head)
        form = hm.group(1).strip() if hm else head.strip()
        name = hm.group(2).strip() if hm else ""
        rows.append({
            "form": form, "name": name, "cik": int(cik),
            "date": f"{d8[:4]}-{d8[4:6]}-{d8[6:8]}", "path": path,
        })
    return rows


def clean_company_name(name):
    """efts display_name 끝의 '(CIK 0001234567)' 꼬리표 제거."""
    return re.sub(r"\s*\(CIK\s*\d+\)\s*$", "", str(name or "")).strip()


def kst_now_str():
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def et_today():
    return datetime.now(ET_TZ).date()


def write_data(out_json, out_js, js_var, payload):
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    from briefing_store import atomic_write_text
    atomic_write_text(out_json, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    atomic_write_text(
        out_js,
        f"window.{js_var} = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
    )


def git_publish(paths, label):
    """data 경로들을 커밋·푸시. paths: 레포 루트 기준 상대경로 리스트."""
    import subprocess
    def run(args, **kw):
        return subprocess.run(["git", *args], cwd=ROOT, **kw)
    if not run(["remote"], capture_output=True, text=True, check=True).stdout.strip():
        print("  [Git] 원격 없음 — 푸시 생략")
        return True
    branch = run(["branch", "--show-current"], capture_output=True, text=True, check=True).stdout.strip()
    if not branch:
        raise RuntimeError("detached HEAD")
    run(["add", "--", *paths], check=True)
    status = run(["status", "--porcelain", "--", *paths], capture_output=True, text=True, check=True)
    if status.stdout.strip():
        stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
        run(["commit", "-m", f"Auto-update {label}: {stamp} [skip ci]", "--", *paths], check=True)
    for attempt in range(1, 4):
        try:
            run(["fetch", "origin", branch], check=True)
            run(["pull", "--rebase", "origin", branch], check=True)
            run(["push", "origin", branch], check=True)
            print(f"  [Git] origin/{branch} {label} 푸시 완료")
            return True
        except Exception as error:
            if attempt < 3:
                print(f"  [Git] 푸시 시도 {attempt} 실패: {error}")
                time.sleep(10)
    return False
