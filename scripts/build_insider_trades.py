#!/usr/bin/env python3
"""US insider trades (SEC Form 4) — finviz.com/insidertrading 스타일 피드.

수집 방식 (검증 완료):
  1) EDGAR 전문검색(efts.sec.gov)으로 날짜별 시장 전체 Form 4 목록을 받고
  2) 추적 중인 universe(시총 스냅샷 종목)의 issuer CIK 집합으로 필터한 뒤
  3) 매칭분의 Form 4 XML(www.sec.gov/Archives)을 받아 거래 내역을 파싱한다.

SEC Archives 는 Akamai 봇 매니저가 Sec-Fetch-*/sec-ch-ua 브라우저 헤더를
요구하므로 SEC_HEADERS 로 항상 그 헤더를 보낸다.

증분: 기존 data/insider_trades.json 의 마지막 file_date 이후(겹침 며칠 포함)만
새로 수집해 accession+거래index 키로 dedup 머지한다. 보관 기간/행수 상한 적용.
"""

from __future__ import annotations

import argparse
import gzip
import json
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, date
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
ET_TZ = ZoneInfo("America/New_York")

OUT_JSON = ROOT / "data" / "insider_trades.json"
OUT_JS = ROOT / "data" / "insider_trades.js"
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

# Form 4 거래 코드 → (한글 라벨, 분류). 분류: buy/sell/grant/dispose/other
TX_CODES = {
    "P": ("매수", "buy"),
    "S": ("매도", "sell"),
    "A": ("취득(부여)", "grant"),
    "M": ("옵션행사", "grant"),
    "C": ("전환", "grant"),
    "G": ("증여", "dispose"),
    "F": ("세금정산", "dispose"),
    "D": ("처분", "dispose"),
    "X": ("옵션행사", "grant"),
    "W": ("상속/취득", "other"),
}

RETENTION_DAYS = 120   # 보관 기간(파일 날짜 기준)
MAX_ROWS = 6000        # 행수 상한
REQUEST_PAUSE = 0.13   # SEC 예의상 ~8 req/s


def sec_get(url, retries=4):
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
            code = getattr(exc, "code", None)
            # 429/500/503 일시 오류는 백오프 후 재시도, 403/404 는 즉시 중단
            if code in (403, 404):
                raise
            time.sleep(1.5 * (attempt + 1))
    raise last


def sec_get_json(url):
    return json.loads(sec_get(url))


def load_universe_ciks(top=0):
    """스냅샷 종목 → issuer CIK 집합과 CIK→ticker 매핑(추적 종목만)."""
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    stocks = snap.get("stocks") or []
    if top and top > 0:
        stocks = sorted(stocks, key=lambda s: float(s.get("marketCapB") or 0), reverse=True)[:top]
    universe = {str(s["ticker"]).upper() for s in stocks if s.get("ticker")}

    ct = sec_get_json(COMPANY_TICKERS_URL)
    cik_to_ticker = {}
    for row in ct.values():
        tkr = str(row.get("ticker") or "").upper()
        cik = int(row.get("cik_str") or 0)
        if tkr and cik and tkr in universe:
            cik_to_ticker[cik] = tkr
    cik_set = set(cik_to_ticker.keys())
    print(f"  universe: {len(universe)} tickers → {len(cik_set)} issuer CIKs matched")
    return cik_set, cik_to_ticker


def efts_form4_hits(day_iso):
    """특정 file_date 의 모든 Form 4 검색 히트(페이지네이션)."""
    hits = []
    frm = 0
    while frm < 10000:
        q = urllib.parse.urlencode({
            "q": "", "forms": "4",
            "startdt": day_iso, "enddt": day_iso, "from": frm,
        })
        try:
            data = sec_get_json(f"{EFTS_URL}?{q}")
        except Exception as exc:
            print(f"    [경고] efts {day_iso} from={frm} 실패: {exc}")
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


def _txt(node, path):
    if node is None:
        return None
    el = node.find(path)
    return el.text.strip() if el is not None and el.text else None


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fetch_and_parse_form4(hit, issuer_cik, ticker):
    """Form 4 XML 을 받아 nonDerivative 거래들을 레코드로 변환."""
    accession, doc = hit["_id"].split(":")
    acc_nodash = accession.replace("-", "")
    ciks = hit.get("_source", {}).get("ciks", [])
    # 문서 폴더는 보통 보고자(소유자) CIK 아래에 있다. 가능한 CIK 를 순서대로 시도.
    candidates = list(dict.fromkeys([*ciks, str(issuer_cik)]))
    body = None
    for cik in candidates:
        url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{doc}"
        try:
            body = sec_get(url)
            break
        except Exception:
            continue
    if body is None:
        return []

    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return []

    issuer = root.find("issuer")
    symbol = _txt(issuer, "issuerTradingSymbol") or ticker
    issuer_name = _txt(issuer, "issuerName")

    owner = root.find("reportingOwner")
    owner_name = _txt(owner, "reportingOwnerId/rptOwnerName")
    rel = owner.find("reportingOwnerRelationship") if owner is not None else None
    is_dir = _txt(rel, "isDirector") in ("1", "true")
    is_off = _txt(rel, "isOfficer") in ("1", "true")
    is_ten = _txt(rel, "isTenPercentOwner") in ("1", "true")
    title = _txt(rel, "officerTitle")
    roles = []
    if is_dir:
        roles.append("이사")
    if is_off:
        roles.append(title or "임원")
    if is_ten:
        roles.append("10%+주주")
    relation = ", ".join(roles) or "기타"

    file_date = hit.get("_source", {}).get("file_date")
    records = []
    ndt = root.find("nonDerivativeTable")
    if ndt is None:
        return []
    for i, tx in enumerate(ndt.findall("nonDerivativeTransaction")):
        code = _txt(tx, "transactionCoding/transactionCode")
        if not code:
            continue
        shares = _num(_txt(tx, "transactionAmounts/transactionShares/value"))
        price = _num(_txt(tx, "transactionAmounts/transactionPricePerShare/value"))
        ad = _txt(tx, "transactionAmounts/transactionAcquiredDisposedCode/value")
        tdate = _txt(tx, "transactionDate/value")
        owned_after = _num(_txt(tx, "postTransactionAmounts/sharesOwnedFollowingTransaction/value"))
        label, kind = TX_CODES.get(code, (code, "other"))
        value = round(shares * price, 2) if (shares and price) else 0
        records.append({
            "ticker": symbol,
            "issuer": issuer_name,
            "owner": owner_name,
            "relation": relation,
            "code": code,
            "codeLabel": label,
            "kind": kind,
            "ad": ad,                       # A(취득)/D(처분)
            "shares": shares,
            "price": price,
            "value": value,
            "ownedAfter": owned_after,
            "txDate": tdate,
            "fileDate": file_date,
            "accession": accession,
            "txIndex": i,
            "link": f"https://www.sec.gov/Archives/edgar/data/{int(candidates[0])}/{acc_nodash}/{doc}",
        })
    return records


def trade_key(rec):
    return f"{rec['accession']}#{rec['txIndex']}"


def load_existing():
    if not OUT_JSON.exists():
        return [], None
    try:
        payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        trades = payload.get("trades") or []
        last = payload.get("lastFileDate")
        return trades, last
    except Exception:
        return [], None


def build(backfill_days, top, overlap_days=5):
    today_et = datetime.now(ET_TZ).date()
    existing, last_file_date = load_existing()

    if existing and last_file_date:
        start = date.fromisoformat(last_file_date) - timedelta(days=overlap_days)
    else:
        start = today_et - timedelta(days=backfill_days)
    end = today_et
    print(f"  수집 구간: {start} ~ {end} (기존 {len(existing)}건)")

    cik_set, cik_to_ticker = load_universe_ciks(top=top)

    merged = {trade_key(r): r for r in existing}
    new_records = 0
    scanned_filings = 0

    day = start
    while day <= end:
        iso = day.isoformat()
        # 주말은 접수가 거의 없으나 일부 정정 공시가 있을 수 있어 그대로 조회
        hits = efts_form4_hits(iso)
        day_universe = 0
        for hit in hits:
            scanned_filings += 1
            src = hit.get("_source", {})
            hit_ciks = {int(c) for c in src.get("ciks", []) if str(c).isdigit()}
            matched = hit_ciks & cik_set
            if not matched:
                continue
            issuer_cik = sorted(matched)[0]
            ticker = cik_to_ticker.get(issuer_cik)
            accession = src.get("adsh") or hit["_id"].split(":")[0]
            # 이미 가진 accession 이면 스킵(파일 단위 dedup — 문서 재파싱 회피)
            if any(k.startswith(accession + "#") for k in merged):
                continue
            try:
                recs = fetch_and_parse_form4(hit, issuer_cik, ticker)
            except Exception as exc:
                print(f"    [경고] {accession} 파싱 실패: {exc}")
                continue
            for r in recs:
                merged[trade_key(r)] = r
                new_records += 1
            day_universe += 1
        print(f"    {iso}: 전체 {len(hits)}건 / universe {day_universe}건")
        day += timedelta(days=1)

    # 보관 기간/행수 상한 적용 + 정렬(파일일·거래일 최신순)
    cutoff = (today_et - timedelta(days=RETENTION_DAYS)).isoformat()
    trades = [r for r in merged.values() if (r.get("fileDate") or "") >= cutoff]
    trades.sort(key=lambda r: (r.get("fileDate") or "", r.get("txDate") or "", r.get("accession") or ""), reverse=True)
    if len(trades) > MAX_ROWS:
        trades = trades[:MAX_ROWS]

    last_seen = max((r.get("fileDate") or "" for r in trades), default=end.isoformat())
    payload = {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "lastFileDate": last_seen,
        "count": len(trades),
        "newCount": new_records,
        "source": "SEC EDGAR Form 4",
        "note": "비파생(직접 보유) 거래만 집계. P=매수, S=매도. 추적 universe 종목 한정.",
        "trades": trades,
    }
    print(f"  완료: 신규 {new_records}건, 스캔 {scanned_filings}건 → 총 {len(trades)}건")
    return payload


def write_files(payload):
    atomic_write_text(OUT_JSON, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    atomic_write_text(
        OUT_JS,
        "window.INSIDER_TRADES = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
    )


def _run_git(args, **kw):
    return subprocess.run(["git", *args], cwd=ROOT, **kw)


def publish():
    paths = ["data/insider_trades.json", "data/insider_trades.js"]
    remotes = _run_git(["remote"], capture_output=True, text=True, check=True)
    if not remotes.stdout.strip():
        print("  [Git] 원격 없음 — 푸시 생략")
        return True
    branch = _run_git(["branch", "--show-current"], capture_output=True, text=True, check=True).stdout.strip()
    if not branch:
        raise RuntimeError("detached HEAD")
    _run_git(["add", "--", *paths], check=True)
    status = _run_git(["status", "--porcelain", "--", *paths], capture_output=True, text=True, check=True)
    if status.stdout.strip():
        stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
        msg = f"Auto-update insider trades: {stamp} [skip ci]"
        _run_git(["commit", "-m", msg, "--", *paths], check=True)
    for attempt in range(1, 4):
        try:
            _run_git(["fetch", "origin", branch], check=True)
            _run_git(["pull", "--rebase", "origin", branch], check=True)
            _run_git(["push", "origin", branch], check=True)
            print(f"  [Git] origin/{branch} insider trades 푸시 완료")
            return True
        except Exception as error:
            if attempt < 3:
                print(f"  [Git] 푸시 시도 {attempt} 실패: {error}")
                time.sleep(10)
    return False


def main():
    parser = argparse.ArgumentParser(description="SEC Form 4 내부자 거래 수집")
    parser.add_argument("--backfill-days", type=int, default=30, help="최초 수집 시 거슬러 올라갈 일수")
    parser.add_argument("--top", type=int, default=0, help="시총 상위 N 종목으로 universe 제한(0=전체)")
    parser.add_argument("--no-push", action="store_true")
    args = parser.parse_args()

    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    print("=== SEC Form 4 내부자 거래 수집 시작 ===")
    payload = build(backfill_days=args.backfill_days, top=args.top)

    with repository_publish_lock(ROOT):
        write_files(payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} trades")
        if not args.no_push:
            publish()


if __name__ == "__main__":
    main()
