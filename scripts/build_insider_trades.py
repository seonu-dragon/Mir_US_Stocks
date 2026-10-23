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

Rule 10b5-1 계획 매매(2026-10-23):
  2023-04-01 부터 Form 4 에 '10b5-1(c) 계획에 따른 거래' 체크박스가 생겼다. XML 원소는 문서 루트의
  ``<aff10b5One>``(값 1/0 또는 true/false — 실측 schemaVersion X0609, 예: CRWD 0001778564-26-000189 =1,
  0001519341-26-000004 =0). 체크박스는 **공시 단위**라 행(거래)마다 가르는 근거는 각주다:
    - 체크박스 원소가 없으면(옛 스키마) plan10b51 = null.
    - 0/false 면 그 공시의 모든 행 false.
    - 1/true 면: '10b5-1' 을 말하는 각주를 단 행 → true. 그런 각주를 단 행이 공시 안에 하나라도 있으면
      나머지 행은 false(각주로 명시 구분됨). 하나도 없으면 공개시장 매수·매도(P/S) 행만 true,
      그 밖의 코드(M·F·A …)는 판단 근거가 없어 null.
  planAdoptedDate 는 그 각주가 '…adopted … on <날짜>' 로 채택일을 **명시**할 때만 붙인다(추정 금지).
  이 키가 아예 없는 행은 기능 도입 전에 수집된 행이다 — 실행마다 --plan-refresh 개 공시까지 원문을
  다시 받아 채운다(보관 45일이라 몇 번 돌면 전부 채워진다).
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
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

import sec_client  # noqa: E402
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import backoff_sleep, git_publish  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
ET_TZ = ZoneInfo("America/New_York")

OUT_JSON = ROOT / "data" / "insider_trades.json"
OUT_JS = ROOT / "data" / "insider_trades.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"

# SEC 는 브라우저 사칭이 아니라 연락처가 담긴 정직한 UA 를 요구한다.
# (sec_client.SEC_HEADERS 와 같은 정책 — 2026-09-15 에 Chrome 사칭 헤더 제거)
SEC_HEADERS = dict(sec_client.SEC_HEADERS)

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

RETENTION_DAYS = 45    # 보관 기간(파일 날짜 기준)
PLAN_REFRESH = 400     # 실행당 10b5-1 표시를 다시 읽을 옛 공시(accession) 수
MAX_ROWS = 20000       # 행수 상한
REQUEST_PAUSE = 0.13   # SEC 예의상 ~8 req/s


def sec_get(url, retries=4):
    last = None
    for attempt in range(1, retries + 1):
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
            # 429/500/503 일시 오류는 지수 백오프 후 재시도, 403/404 는 즉시 중단
            if code in (403, 404):
                raise
            if attempt < retries:
                backoff_sleep(attempt)
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
    """특정 file_date 의 모든 Form 4 검색 히트(페이지네이션).

    반환: ``(hits, partial)`` — partial 이면 그 날짜를 다 못 받았다는 뜻이라
    호출부는 lastFileDate 를 전진시키면 안 된다(sec_client.efts_hits 와 동일).
    """
    hits = []
    frm = 0
    partial = False
    while frm < 10000:
        q = urllib.parse.urlencode({
            "q": "", "forms": "4",
            "startdt": day_iso, "enddt": day_iso, "from": frm,
        })
        try:
            data = sec_get_json(f"{EFTS_URL}?{q}")
        except Exception as exc:
            print(f"    [경고] efts {day_iso} from={frm} 실패: {exc}")
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


# ---- Rule 10b5-1 계획 매매 (docstring 참고) ----
_PLAN_RE = re.compile(r"10b5\s*-\s*1", re.I)
_PLAN_NEG_RE = re.compile(r"\bnot\b[^.;]{0,40}?10b5\s*-\s*1", re.I)
_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_MON = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_DATE = (rf"(?:{_MON}\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}"
         rf"|\d{{1,2}}(?:st|nd|rd|th)?\s+{_MON},?\s+\d{{4}}"
         r"|\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2})")
_ADOPTED_RE = re.compile(rf"\badopted\b(?:[^.;]{{0,120}}?\bon\s+|\s+)({_DATE})", re.I)


def parse_footnote_date(text):
    """'January 16, 2026' · '15 June 2026' · '5/18/2026' · '2026-05-18' → ISO. 못 읽으면 None."""
    t = " ".join((text or "").strip().lower().replace(",", " ").replace(".", " ").split())
    t = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", t)
    parts = t.split()
    try:
        m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", t)
        if m:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        elif re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", t):
            mo, d, y = (int(x) for x in t.split("/"))
        elif len(parts) == 3 and parts[0][:3] in _MONTHS:
            mo, d, y = _MONTHS[parts[0][:3]], int(parts[1]), int(parts[2])
        elif len(parts) == 3 and parts[1][:3] in _MONTHS:
            d, mo, y = int(parts[0]), _MONTHS[parts[1][:3]], int(parts[2])
        else:
            return None
        return date(y, mo, d).isoformat()
    except (ValueError, KeyError):
        return None


def plan_footnote_info(text):
    """각주 하나 → (10b5-1 계획을 말하나, 명시된 채택일 ISO | None)."""
    t = " ".join((text or "").split())
    if not _PLAN_RE.search(t) or _PLAN_NEG_RE.search(t):
        return False, None
    m = _ADOPTED_RE.search(t)
    return True, (parse_footnote_date(m.group(1)) if m else None)


def plan_checkbox(root):
    """문서 루트 <aff10b5One>: True/False, 원소가 없으면(2023-04 이전 스키마) None."""
    el = root.find("aff10b5One")
    if el is None or el.text is None or not el.text.strip():
        return None
    v = el.text.strip().lower()
    if v in ("1", "true"):
        return True
    if v in ("0", "false"):
        return False
    return None


def plan_flags(root, file_date=None):
    """비파생 거래 txIndex → {"plan10b51": bool|None, ["planAdoptedDate": ISO]}."""
    ndt = root.find("nonDerivativeTable")
    txs = ndt.findall("nonDerivativeTransaction") if ndt is not None else []
    checked = plan_checkbox(root)
    if checked is None or checked is False:
        return {i: {"plan10b51": checked} for i in range(len(txs))}
    notes = {}
    fns = root.find("footnotes")
    for fn in (fns.findall("footnote") if fns is not None else []):
        is_plan, adopted = plan_footnote_info("".join(fn.itertext()))
        if is_plan:
            if adopted and file_date and adopted > file_date:
                adopted = None   # 공시일보다 늦은 '채택일'은 잘못 읽은 것 — 버린다
            notes[fn.get("id")] = adopted
    refs = [{f.get("id") for f in tx.iter("footnoteId")} & notes.keys() for tx in txs]
    explicit = any(refs)
    filing_dates = {d for d in notes.values() if d}
    out = {}
    for i, tx in enumerate(txs):
        code = _txt(tx, "transactionCoding/transactionCode")
        if refs[i]:
            flag = True
            dates = {notes[k] for k in refs[i] if notes[k]}
        elif explicit:
            flag, dates = False, set()
        elif code in ("P", "S"):
            flag, dates = True, filing_dates
        else:
            flag, dates = None, set()
        rec = {"plan10b51": flag}
        if flag and len(dates) == 1:
            rec["planAdoptedDate"] = next(iter(dates))
        out[i] = rec
    return out


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
    plans = plan_flags(root, file_date)
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
        rec = {
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
        }
        rec.update(plans.get(i) or {"plan10b51": None})
        records.append(rec)
    return records


def refresh_plan_flags(merged, budget, fetch=None):
    """plan10b51 키가 없는(기능 도입 전) 행의 공시를 최신순으로 budget 개까지 다시 받아 채운다.
    원문을 못 받으면 그 행은 그대로 둔다(다음 실행이 다시 시도). 반환: 채운 공시 수."""
    if budget <= 0:
        return 0
    fetch = fetch or sec_get
    by_acc = {}
    for r in merged.values():
        if "plan10b51" not in r and r.get("link") and r.get("accession"):
            by_acc.setdefault(r["accession"], []).append(r)
    order = sorted(by_acc, key=lambda a: max(x.get("fileDate") or "" for x in by_acc[a]), reverse=True)
    done = 0
    for acc in order[:budget]:
        rows = by_acc[acc]
        try:
            root = ET.fromstring(fetch(rows[0]["link"]))
        except Exception as exc:
            print(f"    [경고] 10b5-1 재확인 {acc} 실패: {exc}")
            continue
        plans = plan_flags(root, rows[0].get("fileDate"))
        for r in rows:
            r.update(plans.get(r.get("txIndex")) or {"plan10b51": None})
        done += 1
    if by_acc:
        print(f"  10b5-1 재확인: 공시 {done}건 채움 · 남은 {len(order) - done}건")
    return done


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


def build(backfill_days, top, overlap_days=5, plan_refresh=PLAN_REFRESH):
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
    partial = False

    day = start
    while day <= end:
        iso = day.isoformat()
        # 주말은 접수가 거의 없으나 일부 정정 공시가 있을 수 있어 그대로 조회
        hits, day_partial = efts_form4_hits(iso)
        partial = partial or day_partial
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
        print(f"    {iso}: 전체 {len(hits)}건 / universe {day_universe}건"
              f"{' (일부 실패)' if day_partial else ''}")
        day += timedelta(days=1)

    # 보관 기간/행수 상한 적용 + 정렬(파일일·거래일 최신순)
    cutoff = (today_et - timedelta(days=RETENTION_DAYS)).isoformat()
    # 곧 버릴 행은 다시 받지 않는다 — 보관 기간 안의 행만 10b5-1 재확인
    refresh_plan_flags({k: r for k, r in merged.items() if (r.get("fileDate") or "") >= cutoff}, plan_refresh)
    trades = [r for r in merged.values() if (r.get("fileDate") or "") >= cutoff]
    trades.sort(key=lambda r: (r.get("fileDate") or "", r.get("txDate") or "", r.get("accession") or ""), reverse=True)
    if len(trades) > MAX_ROWS:
        trades = trades[:MAX_ROWS]

    last_seen = max((r.get("fileDate") or "" for r in trades), default=end.isoformat())
    if partial and last_file_date:
        # 하루치라도 잘렸으면 커서를 전진시키지 않는다 — 다음 실행이 재수집한다.
        print(f"  [경고] efts 일부 실패 — lastFileDate 를 {last_file_date} 로 고정(재수집 예약)")
        last_seen = last_file_date
    payload = {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "lastFileDate": last_seen,
        "partialFetch": bool(partial),
        "count": len(trades),
        "newCount": new_records,
        "source": "SEC EDGAR Form 4",
        "note": "비파생(직접 보유) 거래만 집계. P=매수, S=매도. 추적 universe 종목 한정.",
        "planFlagged": sum(1 for r in trades if "plan10b51" in r),
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


def publish():
    return git_publish(["data/insider_trades.json", "data/insider_trades.js"], "insider trades")


def main():
    parser = argparse.ArgumentParser(description="SEC Form 4 내부자 거래 수집")
    parser.add_argument("--backfill-days", type=int, default=30, help="최초 수집 시 거슬러 올라갈 일수")
    parser.add_argument("--top", type=int, default=0, help="시총 상위 N 종목으로 universe 제한(0=전체)")
    parser.add_argument("--plan-refresh", type=int, default=PLAN_REFRESH,
                        help="10b5-1 표시가 없는 옛 공시를 이번 실행에 다시 읽을 개수(0=안 함)")
    parser.add_argument("--push", action="store_true", default=False)
    parser.add_argument("--no-push", action="store_true")
    args = parser.parse_args()

    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    print("=== SEC Form 4 내부자 거래 수집 시작 ===")
    payload = build(backfill_days=args.backfill_days, top=args.top, plan_refresh=args.plan_refresh)

    with repository_publish_lock(ROOT):
        write_files(payload)
        print(f"Wrote {OUT_JSON} — {payload['count']} trades")
        if args.push and not args.no_push:
            if not publish():
                raise SystemExit("[중단] 내부자 거래 push 실패 — 발행되지 않았다")


if __name__ == "__main__":
    main()
