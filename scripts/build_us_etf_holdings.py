#!/usr/bin/env python3
"""미국 ETF 구성 종목 + '이 종목을 담은 ETF' 역조회 — SEC N-PORT.

1940년 투자회사법 펀드(대부분의 미국 ETF)는 분기말 보유 내역을 Form N-PORT-P 로 SEC 에
공개한다(분기말 후 최대 60일 뒤 공개 — 화면에 기준일을 반드시 적는다). 이 빌더는

1. 미국 스냅샷의 ETF 중 SEC `company_tickers_mf.json` 에 시리즈가 있는 것 전부의 최신 NPORT-P 를
   찾고, 문서 머리의 순자산(netAssets)만 읽어 순위를 매긴다(스냅샷의 ETF 시총 값은 대부분 비어 있다).
2. 순자산 상위 N(기본 300)개의 primary_doc.xml 을 스트리밍 파싱해
   - 보유 상위 25 (이름·티커·비중·자산 종류·국가)
   - 섹터 노출(티커가 스냅샷과 이어진 주식만, 나머지는 '미분류')·국가 노출·자산 구성
   을 ETF 별 샤드 `data/etf_holdings/etf/<T>.json` 으로,
3. 전 보유 종목을 뒤집어 종목별 '비중 상위 10개 ETF' 를 첫 글자 샤드
   `data/etf_holdings/rev/<A>.json` 으로,
4. 목록·기준일·제외 사유를 `data/etf_holdings/index.json/.js`(window.US_ETF_HOLDINGS_INDEX) 로 쓴다.

샤드는 **내용이 바뀐 파일만** 다시 쓴다(레포 증가 최소화 — 월 1회 실행에 분기 자료라 대부분 그대로).
`state.json` 은 시리즈별 최신 보고서·순자산 캐시, `cusip_map.json` 은 CUSIP → 티커 캐시(브라우저는 안 읽음).

제외: SPY·DIA·MDY 는 단위투자신탁(UIT)이라 N-PORT 가 없다(QQQ 는 2025 년 개방형 전환으로 N-PORT 가 있다).
GLD·IBIT 같은 원자재·가상자산 신탁(1933년법)도 없다. 운용사 웹사이트 보유 파일은 '서면 동의 없는
복제 금지' 문구가 있어 쓰지 않는다.

티커 연결: N-PORT 에는 티커가 거의 없고 CUSIP·ISIN·이름만 있다. 미국 CUSIP 은 OpenFIGI(무키 25회/분,
요청당 10건)로 티커를 한 번 찾아 캐시하고, 그 밖(해외 상장 등)은 스냅샷 회사명 정규화 일치(유일할 때만,
종류주 글자가 다르면 거부)로 잇는다. 못 이은 보유 종목은 이름만 보이고 링크·섹터가 없다.

실행: py scripts/build_us_etf_holdings.py [--top 300] [--only QQQ,XLK] [--push]
환경변수(선택): OPENFIGI_API_KEY — 있으면 요청당 100건·빠른 속도.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
DIR = ROOT / "data" / "etf_holdings"
OUT_JSON = DIR / "index.json"
OUT_JS = DIR / "index.js"
CUSIP_MAP = DIR / "cusip_map.json"
STATE_JSON = DIR / "state.json"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
KST = timezone(timedelta(hours=9))
MF_TICKERS_URL = "https://www.sec.gov/files/company_tickers_mf.json"
ATOM_URL = ("https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={sid}&type=NPORT-P"
            "&dateb=&owner=include&count=10&output=atom")
FIGI_URL = "https://api.openfigi.com/v3/mapping"
NS = "{http://www.sec.gov/edgar/nport}"
TOP_N = 25
REV_TOP = 10
FIGI_RECHECK_DAYS = 120

KNOWN_UIT = {"SPY", "DIA", "MDY"}
EXCLUDE_TEXT = {
    "uit": "단위투자신탁(UIT)이라 N-PORT 보고서를 내지 않습니다",
    "trust": "1940년법 펀드가 아니라(원자재·가상자산 신탁 등) N-PORT 보고서를 내지 않습니다",
    "nofiling": "아직 공개된 N-PORT 보고서가 없습니다(신규 상장 등)",
    "outside": "순자산 상위 300개 밖이라 구성 자료를 만들지 않았습니다",
    "error": "N-PORT 보고서를 읽지 못했습니다",
}
ASSET_KIND = {"EC": "equity", "EP": "equity", "DBT": "debt", "LON": "debt", "STIV": "cash"}


def asset_kind(cat: str) -> str:
    """N-PORT assetCat → equity/debt/cash/other. ABS-MBS 등 자산유동화증권은 채권으로 본다."""
    cat = cat or ""
    if cat.startswith("ABS"):
        return "debt"
    return ASSET_KIND.get(cat, "other")

_SUFFIX = re.compile(
    r"\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|nv|n v|sa|s a|ag|se|spa|"
    r"the|class [a-z]|cl [a-z]|series [a-z]|ordinary shares|common stock|adr|ads|sponsored|reit)\b"
)


def now_kst() -> datetime:
    return datetime.now(KST)


def norm_name(name: str) -> str:
    s = (name or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = _SUFFIX.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def class_letter(text: str) -> str | None:
    m = re.search(r"\b(?:class|cl)\.?\s+([a-z])\b", (text or "").lower())
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# 입력: 스냅샷·SEC 시리즈 표
# ---------------------------------------------------------------------------

def load_snapshot(path: Path = SNAPSHOT) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def snapshot_etfs(snapshot: dict) -> list[dict]:
    return [s for s in snapshot.get("stocks") or []
            if isinstance(s, dict) and s.get("sector") == "EXCHANGE TRADED FUNDS" and s.get("ticker")]


def stock_universe(snapshot: dict) -> tuple[dict[str, dict], dict[str, list[str]]]:
    """(티커 → 행, 정규화 회사명 → [티커]) — ETF 제외."""
    by_ticker: dict[str, dict] = {}
    by_name: dict[str, list[str]] = {}
    for s in snapshot.get("stocks") or []:
        if not isinstance(s, dict) or not s.get("ticker") or s.get("sector") == "EXCHANGE TRADED FUNDS":
            continue
        t = str(s["ticker"])
        by_ticker[t] = s
        key = norm_name(s.get("company") or "")
        if key:
            by_name.setdefault(key, []).append(t)
    return by_ticker, by_name


def series_map(mf_payload: dict) -> dict[str, tuple[int, str]]:
    fields = mf_payload.get("fields") or []
    ix = {f: i for i, f in enumerate(fields)}
    out = {}
    for row in mf_payload.get("data") or []:
        try:
            out[str(row[ix["symbol"]]).upper()] = (int(row[ix["cik"]]), str(row[ix["seriesId"]]))
        except Exception:
            continue
    return out


def rank_by_net_assets(cands: list[tuple[str, float | None]], top: int) -> tuple[list[str], list[str]]:
    """(티커, 순자산) → (상위 top, 나머지). 순자산을 모르는 것은 뒤로."""
    order = sorted(cands, key=lambda kv: (-(kv[1] if kv[1] is not None else -1), kv[0]))
    return [t for t, _ in order[:top]], [t for t, _ in order[top:]]


# ---------------------------------------------------------------------------
# SEC 접근·파싱
# ---------------------------------------------------------------------------

def sec_bytes(url: str) -> bytes:
    from sec_client import sec_get
    return sec_get(url)


def parse_atom(raw: str) -> dict | None:
    """browse-edgar atom → 최신 NPORT-P(정정본 NPORT-P/A 제외) {accession, filed, url, index}."""
    for entry in re.findall(r"<entry>(.*?)</entry>", raw, re.S):
        ftype = re.search(r"<filing-type>([^<]+)</filing-type>", entry)
        if not ftype or ftype.group(1).strip() != "NPORT-P":
            continue
        acc = re.search(r"<accession-number>([^<]+)</accession-number>", entry)
        filed = re.search(r"<filing-date>([^<]+)</filing-date>", entry)
        href = re.search(r"<filing-href>([^<]+)</filing-href>", entry)
        if not (acc and href):
            continue
        base = href.group(1).strip().rsplit("/", 1)[0]
        return {"accession": acc.group(1).strip(), "filed": (filed.group(1).strip() if filed else ""),
                "url": base + "/primary_doc.xml", "index": href.group(1).strip()}
    return None


def latest_nport(series_id: str, fetch=sec_bytes) -> dict | None:
    return parse_atom(fetch(ATOM_URL.format(sid=series_id)).decode("utf-8", "replace"))


def open_stream(url: str):
    from sec_client import SEC_HEADERS, REQUEST_PAUSE
    req = urllib.request.Request(url, headers=SEC_HEADERS)
    last = None
    for attempt in range(3):
        try:
            resp = urllib.request.urlopen(req, timeout=120)
            break
        except Exception as exc:
            last = exc
            if getattr(exc, "code", None) in (403, 404):
                raise
            time.sleep(2 * (attempt + 1))
    else:
        raise last
    time.sleep(REQUEST_PAUSE)
    if resp.headers.get("Content-Encoding") == "gzip":
        return gzip.GzipFile(fileobj=resp)
    return resp


def _text(el, name: str) -> str:
    x = el.find(NS + name)
    return (x.text or "").strip() if x is not None and x.text else ""


def peek_nport(stream) -> dict:
    """문서 앞부분만 읽어 {asOf, seriesName, netAssets} — 순위용(보유 목록 전에 멈추고 연결을 닫는다)."""
    out = {"asOf": None, "seriesName": "", "netAssets": None}
    try:
        for _event, el in ET.iterparse(stream, events=("end",)):
            tag = el.tag.replace(NS, "")
            if tag == "repPdDate":
                out["asOf"] = (el.text or "").strip()
            elif tag == "seriesName":
                out["seriesName"] = (el.text or "").strip()
            elif tag == "netAssets":
                try:
                    out["netAssets"] = float(el.text)
                except (TypeError, ValueError):
                    pass
                break
            elif tag == "invstOrSec":
                break
    finally:
        try:
            stream.close()
        except Exception:
            pass
    return out


def parse_nport(stream) -> dict:
    """primary_doc.xml 스트림 → {asOf, seriesName, netAssets, holdings:[...]}. iterparse + clear 로 메모리 절약."""
    out = {"asOf": None, "seriesName": "", "netAssets": None, "holdings": []}
    try:
        for _event, el in ET.iterparse(stream, events=("end",)):
            tag = el.tag.replace(NS, "")
            if tag == "repPdDate":
                out["asOf"] = (el.text or "").strip()
            elif tag == "seriesName":
                out["seriesName"] = (el.text or "").strip()
            elif tag == "netAssets":
                try:
                    out["netAssets"] = float(el.text)
                except (TypeError, ValueError):
                    pass
            elif tag == "invstOrSec":
                isin = ticker = ""
                idents = el.find(NS + "identifiers")
                if idents is not None:
                    x = idents.find(NS + "isin")
                    if x is not None:
                        isin = x.get("value", "")
                    x = idents.find(NS + "ticker")
                    if x is not None:
                        ticker = x.get("value", "")
                try:
                    pct = float(_text(el, "pctVal") or 0)
                except ValueError:
                    pct = 0.0
                debt = el.find(NS + "debtSec")
                debt_txt = ""
                if debt is not None:
                    mat = _text(debt, "maturityDt")[:7]
                    try:
                        rate = float(_text(debt, "annualizedRt"))
                        debt_txt = f"{rate:.2f}% {mat}".strip()
                    except ValueError:
                        debt_txt = mat
                out["holdings"].append({
                    "debt": debt_txt,
                    "name": _text(el, "name"), "title": _text(el, "title"), "cusip": _text(el, "cusip"),
                    "isin": isin, "ticker": ticker, "pct": pct, "cat": _text(el, "assetCat"),
                    "country": _text(el, "invCountry"),
                })
                el.clear()
    finally:
        try:
            stream.close()
        except Exception:
            pass
    return out


def valid_cusip(c: str) -> bool:
    return bool(re.fullmatch(r"[0-9A-Z]{9}", c or "")) and c != "000000000"


def aggregate(holdings: list[dict]) -> list[dict]:
    """같은 증권(CUSIP → ISIN → 이름)이 여러 줄이면 비중을 합친다(롯트·통화별 분할)."""
    agg: dict[str, dict] = {}
    for h in holdings:
        cus = h.get("cusip") or ""
        key = cus if valid_cusip(cus) else (h.get("isin") or h.get("name") or "")
        if key in agg:
            agg[key]["pct"] += h["pct"]
        else:
            agg[key] = dict(h)
    return sorted(agg.values(), key=lambda h: -h["pct"])


# ---------------------------------------------------------------------------
# 티커 연결
# ---------------------------------------------------------------------------

def figi_candidate(h: dict) -> str | None:
    """OpenFIGI 로 물어볼 CUSIP — 미국 ISIN 이거나 ISIN 없이 숫자로 시작하는 주식 CUSIP 만.
    해외 상장 주식(VEA 등 수천 개)은 미국 티커가 없어 묻지 않는다(요청 한도 절약)."""
    if asset_kind(h.get("cat")) != "equity":
        return None
    cus = h.get("cusip") or ""
    if not valid_cusip(cus):
        return None
    isin = h.get("isin") or ""
    if isin.startswith("US") or (not isin and cus[0].isdigit()):
        return cus
    return None


def figi_lookup(cusips: list[str], api_key: str = "", post=None, sleep=time.sleep) -> dict[str, str]:
    """CUSIP → 미국 티커('BRK/B' → 'BRK.B'). 없으면 ''. 실패한 배치는 결과에서 빠진다(다음 실행에 재시도)."""
    size = 100 if api_key else 10
    pause = 0.3 if api_key else 2.6
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-OPENFIGI-APIKEY"] = api_key

    def _post(body):
        req = urllib.request.Request(FIGI_URL, data=json.dumps(body).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))

    post = post or _post
    out: dict[str, str] = {}
    for i in range(0, len(cusips), size):
        chunk = cusips[i:i + size]
        body = [{"idType": "ID_CUSIP", "idValue": c, "exchCode": "US"} for c in chunk]
        res = None
        for attempt in range(4):
            try:
                res = post(body)
                break
            except Exception as exc:
                sleep((20 if getattr(exc, "code", None) == 429 else 3) * (attempt + 1))
        if isinstance(res, list):
            for c, item in zip(chunk, res):
                data = (item or {}).get("data") or []
                eq = [d for d in data if d.get("marketSector") == "Equity" and d.get("ticker")]
                out[c] = str(eq[0]["ticker"]).replace("/", ".") if eq else ""
        sleep(pause)
    return out


def resolve_ticker(h: dict, cmap: dict, by_ticker: dict, by_name: dict) -> str | None:
    """보유 종목 → 티커. 파일의 ticker → OpenFIGI(스냅샷 밖 티커도 표시용으로 인정) →
    스냅샷 회사명 일치(유일할 때만, 종류주 글자가 다르면 거부)."""
    t = (h.get("ticker") or "").upper().replace("/", ".")
    if t and t in by_ticker:
        return t
    ent = cmap.get(h.get("cusip") or "")
    if isinstance(ent, dict) and ent.get("t"):
        return ent["t"]
    if asset_kind(h.get("cat")) != "equity":
        return None
    cands = by_name.get(norm_name(h.get("name") or ""), [])
    cl = class_letter(h.get("title") or "") or class_letter(h.get("name") or "")
    if cl:
        exact = [c for c in cands if class_letter(by_ticker[c].get("company") or "") == cl]
        if len(exact) == 1:
            return exact[0]
        # Class C 인데 스냅샷에는 Class A 만 있으면 잇지 않는다(다른 증권이다).
        cands = [c for c in cands if class_letter(by_ticker[c].get("company") or "") is None]
    return cands[0] if len(cands) == 1 else None


# ---------------------------------------------------------------------------
# 샤드 계산
# ---------------------------------------------------------------------------

def r3(x: float) -> float:
    return round(float(x), 3)


def sector_for(h: dict, t: str | None, by_ticker: dict, by_name: dict | None) -> str | None:
    """섹터: 스냅샷 티커 → 같은 회사명(종류주 무관)의 스냅샷 종목이 한 섹터면 그 섹터(GOOG → GOOGL 의 섹터)."""
    if t and t in by_ticker:
        return by_ticker[t].get("sector")
    if by_name:
        secs = {by_ticker[c].get("sector") for c in by_name.get(norm_name(h.get("name") or ""), [])}
        secs.discard(None)
        if len(secs) == 1:
            return secs.pop()
    return None


def holding_label(h: dict) -> str:
    name = h.get("title") or h.get("name") or ""
    if h.get("debt"):
        name = f"{name} {h['debt']}"
    return name[:80]


def etf_shard(etf: dict, filing: dict, parsed: dict, holdings: list[dict], tickers: list[str | None],
              by_ticker: dict, by_name: dict | None = None) -> dict:
    sectors: dict[str, float] = {}
    countries: dict[str, float] = {}
    mix = {"equity": 0.0, "debt": 0.0, "cash": 0.0, "other": 0.0}
    for h, t in zip(holdings, tickers):
        w = h["pct"]
        kind = asset_kind(h.get("cat"))
        mix[kind] += w
        if kind == "equity":
            sec = sector_for(h, t, by_ticker, by_name)
            sectors[sec or "_unmapped"] = sectors.get(sec or "_unmapped", 0.0) + w
        c = h.get("country") or ""
        if c and c not in ("N/A", "XX"):
            countries[c] = countries.get(c, 0.0) + w
    sec_list = sorted(((k, v) for k, v in sectors.items() if k != "_unmapped"), key=lambda kv: -kv[1])
    ctry = sorted(countries.items(), key=lambda kv: -kv[1])[:8]
    top = [{"n": holding_label(h), "t": t, "w": r3(h["pct"]),
            "k": asset_kind(h.get("cat")), "c": h.get("country") or ""}
           for h, t in list(zip(holdings, tickers))[:TOP_N]]
    return {
        "ticker": etf["ticker"],
        "name": parsed.get("seriesName") or etf.get("company") or "",
        "asOf": parsed.get("asOf"),
        "filed": filing.get("filed"),
        "accession": filing.get("accession"),
        "url": filing.get("index"),
        "netAssetsB": round(parsed["netAssets"] / 1e9, 2) if parsed.get("netAssets") else None,
        "holdingsCount": len(holdings),
        "top": top,
        "sectors": [[k, r3(v)] for k, v in sec_list],
        "sectorUnmapped": r3(sectors.get("_unmapped", 0.0)),
        "countries": [[k, r3(v)] for k, v in ctry],
        "countriesOther": r3(max(0.0, sum(countries.values()) - sum(v for _k, v in ctry))),
        "assetMix": {k: r3(v) for k, v in mix.items()},
    }


def shard_key(ticker: str) -> str:
    c = (ticker or "_")[0].upper()
    return c if "A" <= c <= "Z" else "_"


def build_reverse(contrib: dict[str, list[tuple[str, float]]]) -> dict[str, dict]:
    shards: dict[str, dict] = {}
    for t, rows in contrib.items():
        rows = sorted(rows, key=lambda r: (-r[1], r[0]))
        shards.setdefault(shard_key(t), {})[t] = {"n": len(rows), "top": [[e, r3(w)] for e, w in rows[:REV_TOP]]}
    return shards


def write_if_changed(path: Path, obj) -> bool:
    from briefing_store import atomic_write_text
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    try:
        if path.read_text(encoding="utf-8") == text:
            return False
    except FileNotFoundError:
        pass
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(path, text)
    return True


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=300)
    ap.add_argument("--only", default="", help="쉼표 구분 ETF 티커만(로컬 확인용 — 순위·역조회는 새로 만들지 않는다)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    snap = load_snapshot()
    by_ticker, by_name = stock_universe(snap)
    all_etfs = {e["ticker"]: e for e in snapshot_etfs(snap)}
    only = {t.strip().upper() for t in args.only.split(",") if t.strip()}
    try:
        smap = series_map(json.loads(sec_bytes(MF_TICKERS_URL)))
    except Exception as exc:
        print(f"[error] SEC 시리즈 표 실패 — 기존 파일 유지: {exc}", file=sys.stderr)
        return 1

    prev_index = load_json(OUT_JSON, {})
    state: dict = load_json(STATE_JSON, {})
    cmap: dict = load_json(CUSIP_MAP, {})
    today = now_kst().date().isoformat()
    recheck_floor = (now_kst().date() - timedelta(days=FIGI_RECHECK_DAYS)).isoformat()
    figi_key = os.environ.get("OPENFIGI_API_KEY", "").strip()
    excluded: dict[str, str] = {}
    errors: list[str] = []

    # 1단계: N-PORT 가 있는 ETF 전부의 최신 보고서와 순자산(문서 머리만) — 운용자산 순위용.
    pool = sorted(only) if only else sorted(all_etfs)
    filings: dict[str, dict] = {}
    cands: list[tuple[str, float | None]] = []
    for i, t in enumerate(pool, 1):
        if t in KNOWN_UIT:
            excluded[t] = "uit"
            continue
        ser = smap.get(t)
        if not ser:
            excluded[t] = "trust"
            continue
        try:
            filing = latest_nport(ser[1])
        except Exception as exc:
            errors.append(f"{t}: 목록 {exc}")
            excluded[t] = "error"
            continue
        if not filing:
            excluded[t] = "nofiling"
            continue
        filings[t] = filing
        st = state.get(ser[1]) or {}
        if st.get("acc") == filing["accession"] and st.get("na") is not None:
            na = st["na"]
        else:
            try:
                head = peek_nport(open_stream(filing["url"]))
            except Exception as exc:
                errors.append(f"{t}: 머리 {exc}")
                head = {}
            na = head.get("netAssets")
            state[ser[1]] = {"t": t, "acc": filing["accession"], "na": na, "asOf": head.get("asOf")}
        cands.append((t, na))
        if i % 100 == 0:
            print(f"  … 목록 {i}/{len(pool)}")
    chosen, outside = rank_by_net_assets(cands, len(cands) if only else args.top)
    for t in outside:
        excluded[t] = "outside"
    print(f"N-PORT 있는 ETF {len(cands)}개 중 순자산 상위 {len(chosen)}개 · 제외 {len(excluded)}개")
    if not chosen:
        print("[error] 대상 ETF 가 0개 — 기존 파일 유지", file=sys.stderr)
        return 1

    # 2단계: 보유 내역 — ETF 하나씩 읽고 바로 샤드·역조회 기여분으로 줄인다(메모리 절약).
    contrib: dict[str, list[tuple[str, float]]] = {}
    index_etfs: dict[str, dict] = {}
    shards: list[dict] = []
    mapped_w = total_w = 0.0
    figi_asked = figi_found = 0
    for i, t in enumerate(chosen, 1):
        etf, filing = all_etfs[t], filings[t]
        try:
            parsed = parse_nport(open_stream(filing["url"]))
        except Exception as exc:
            excluded[t] = "error"
            errors.append(f"{t}: 본문 {exc}")
            continue
        holdings = aggregate(parsed.pop("holdings"))
        need = set()
        for h in holdings:
            c = figi_candidate(h)
            ent = cmap.get(c) if c else None
            if c and (not isinstance(ent, dict) or (not ent.get("t") and ent.get("d", "") < recheck_floor)):
                need.add(c)
        if need:
            found = figi_lookup(sorted(need), figi_key)
            figi_asked += len(need)
            figi_found += sum(1 for v in found.values() if v)
            for c, tk in found.items():
                cmap[c] = {"t": tk, "d": today}
        tickers = [resolve_ticker(h, cmap, by_ticker, by_name) for h in holdings]
        for h, tk in zip(holdings, tickers):
            if asset_kind(h.get("cat")) == "equity":
                total_w += h["pct"]
                if tk:
                    mapped_w += h["pct"]
            if tk and tk in by_ticker and h["pct"] > 0:
                contrib.setdefault(tk, []).append((t, h["pct"]))
        shard = etf_shard(etf, filing, parsed, holdings, tickers, by_ticker, by_name)
        shards.append(shard)
        index_etfs[t] = {"name": shard["name"], "asOf": shard["asOf"], "filed": shard["filed"],
                         "n": shard["holdingsCount"], "aumB": shard["netAssetsB"]}
        if i % 25 == 0:
            print(f"  … 보유 내역 {i}/{len(chosen)}")
    print(f"보유 내역 {len(index_etfs)}개 · OpenFIGI 조회 {figi_asked}건(티커 {figi_found})")
    if not index_etfs:
        print("[error] 보유 내역을 읽은 ETF 가 0개 — 기존 파일 유지", file=sys.stderr)
        return 1

    rev = build_reverse(contrib) if not only else {}
    if only:
        # 부분 실행은 순위·역조회를 새로 만들지 않는다(전체가 모여야 의미가 있다). 이전 값 유지.
        rev_keys = list(prev_index.get("revShards") or [])
        index_etfs = {**(prev_index.get("etfs") or {}), **index_etfs}
        excluded = {**(prev_index.get("excluded") or {}), **{k: v for k, v in excluded.items() if v != "outside"}}
        for t in index_etfs:
            excluded.pop(t, None)
    else:
        rev_keys = sorted(rev)
        # 절반 넘게 사라진 실행(SEC 장애 등)은 샤드를 건드리기 전에 멈춘다.
        from sec_client import assert_not_regressing
        assert_not_regressing(OUT_JSON, {"count": len(index_etfs)}, floor_ratio=0.7)

    written = sum(1 for sh in shards if write_if_changed(DIR / "etf" / f"{sh['ticker']}.json", sh))
    rev_written = sum(1 for k, obj in sorted(rev.items()) if write_if_changed(DIR / "rev" / f"{k}.json", obj))

    as_ofs = sorted({v["asOf"] for v in index_etfs.values() if v.get("asOf")})
    payload = {
        "updatedAtKst": now_kst().strftime("%Y-%m-%d %H:%M KST"),
        "source": "SEC Form N-PORT-P (분기말 보유 내역)",
        "count": len(index_etfs),
        "asOfRange": [as_ofs[0], as_ofs[-1]] if as_ofs else None,
        "tickerCoverage": round(mapped_w / total_w * 100, 1) if total_w else prev_index.get("tickerCoverage"),
        "etfs": dict(sorted(index_etfs.items())),
        "excluded": dict(sorted(excluded.items())),
        "excludedText": EXCLUDE_TEXT,
        "revShards": rev_keys,
        "errors": errors[:30],
    }
    from sec_client import write_data
    from briefing_store import atomic_write_text
    write_data(OUT_JSON, OUT_JS, "US_ETF_HOLDINGS_INDEX", payload, indent=None)
    atomic_write_text(CUSIP_MAP, json.dumps(dict(sorted(cmap.items())), ensure_ascii=False, separators=(",", ":")) + "\n")
    atomic_write_text(STATE_JSON, json.dumps(dict(sorted(state.items())), ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"ETF 샤드 {len(shards)}개(바뀜 {written}) · 역조회 샤드 {len(rev_keys)}개(바뀜 {rev_written}) · "
          f"주식 비중 중 티커 연결 {payload['tickerCoverage']}%")
    if args.push:
        from sec_client import git_publish
        if not git_publish(["data/etf_holdings"], "US ETF holdings (N-PORT)"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
