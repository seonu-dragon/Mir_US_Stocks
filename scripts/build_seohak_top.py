#!/usr/bin/env python3
"""서학개미 TOP — 국내 투자자의 미국 주식 보관·결제 상위 50종목(한국예탁결제원 SEIBro).

SEIBro '종목별내역(주식TOP50)' 화면(BIP_CNTS10013V)이 쓰는 websquare 엔드포인트를 그대로 부른다.
인증 없이 XML POST 한 번에 상위 50행이 온다(2026-10-02 실측, 1~2초).

  POST https://seibro.or.kr/websquare/engine/proworks/callServletService.jsp
  <reqParam action="getImptFrcurStkCusRemaList"   task="ksd.safe.bip.cnts.OvsSec.process.OvsSecIsinPTask">
            보관금액 — START_DT=END_DT=기준일, S_TYPE=1. 조회는 2영업일 전까지만 된다.
  <reqParam action="getImptFrcurStkSetlAmtList" ...>
            결제금액 — START_DT~END_DT, S_TYPE=2, D_TYPE 1=매수 2=매도 3=매수+매도 4=순매수.
  S_COUNTRY=US. 금액 단위는 USD. 데이터가 없는 날짜면 <vector result="0">.

목록: 보관금액 상위(기준일) · 기간(1주/1개월)별 순매수·매수·매도 결제 상위.
순위 변동은 1주 전(그 이전 가장 가까운 기록) 목록과 비교한다 — 기록은 seohak_top_state.json.
티커는 ISIN → CUSIP 캐시(ETF·13F 빌더의 OpenFIGI 캐시 + 이 빌더의 캐시) → OpenFIGI(ID_ISIN) 순.
액면분할·변경 뒤 SEIBro 가 옛 ISIN 에 새 ISIN 을 이름 뒤에 붙여 주면(… SPLR|CHAN <번호> US…) 새 ISIN 도 쓴다.

산출물: data/seohak_top.json + .js(window.SEOHAK_TOP), 상태 data/seohak_top_state.json.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
import sec_client as sec  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "seohak_top.json"
OUT_JS = ROOT / "data" / "seohak_top.js"
STATE = ROOT / "data" / "seohak_top_state.json"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
CUSIP_CACHES = (
    ROOT / "data" / "etf_holdings" / "cusip_map.json",
    ROOT / "data" / "institutional_holders" / "cusip_map.json",
)

URL = "https://seibro.or.kr/websquare/engine/proworks/callServletService.jsp"
REFERER = "https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/ovsSec/BIP_CNTS10013V.xml&menuNo=921"
TASK = "ksd.safe.bip.cnts.OvsSec.process.OvsSecIsinPTask"
FIGI_URL = "https://api.openfigi.com/v3/mapping"
KST = timezone(timedelta(hours=9))

PERIODS = {"1w": 7, "1m": 30}
SETTLE_KINDS = {"buy": "1", "sell": "2", "net": "4"}
HISTORY_KEEP = 60          # 목록별 기록 보관 개수(일 1회 실행 ≈ 2~3개월)
COMPARE_DAYS = 7           # 순위 변동 비교 기준: 1주 전
FIGI_BUDGET = 60           # 실행당 새 OpenFIGI 조회 ISIN 수
LOOKBACK_DAYS = 10         # 데이터 있는 최근 기준일을 찾을 때 거슬러 갈 최대 일수

_SPLIT_ISIN = re.compile(r"\b(US[0-9A-Z]{9}[0-9])\b")
# 권리처리 꼬리: '… SPLR 39326002188 US9229084135'(분할) · '… CHAN 39527405649 US38259P7069'(변경)
_SPLR_TAIL = re.compile(r"\s+[A-Z]{2,6}\s+\d{6,}(?:\s+[A-Z]{2}[0-9A-Z]{10})?\s*$")


def _post(xml_body: str) -> str:
    req = urllib.request.Request(URL, data=xml_body.encode("utf-8"), headers={
        "User-Agent": "Mozilla/5.0", "Content-Type": "application/xml; charset=UTF-8", "Referer": REFERER,
    })
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                return resp.read().decode("utf-8", "ignore")
        except Exception as exc:  # 일시 장애 — 짧게 물러섰다 재시도
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"SEIBro 요청 실패: {last}")


def _req(action: str, **params: str) -> str:
    body = "".join(f'<{k} value="{v}"/>' for k, v in params.items())
    return f'<reqParam action="{action}" task="{TASK}"><PG_START value="1"/><PG_END value="50"/>{body}</reqParam>'


def parse_rows(xml_text: str) -> list[dict]:
    """SEIBro vector 응답 → [{rank, isin, rawName, amount, buy, sell, net}] (없는 필드는 None)."""
    root = ET.fromstring(xml_text.strip())
    out = []
    for res in root.iter("result"):
        vals = {child.tag: child.get("value") for child in res}

        def num(key):
            v = vals.get(key)
            try:
                return float(v) if v not in (None, "") else None
            except ValueError:
                return None
        isin = (vals.get("ISIN") or "").strip()
        if not isin:
            continue
        out.append({
            "rank": int(num("RNUM") or len(out) + 1),
            "isin": isin,
            "rawName": (vals.get("KOR_SECN_NM") or "").strip(),
            "amount": num("SUM_FRSEC_AMT"),
            "buy": num("SUM_FRSEC_BUY_AMT"),
            "sell": num("SUM_FRSEC_SELL_AMT"),
            "net": num("SUM_FRSEC_NET_BUY_AMT"),
        })
    return out


def clean_name(raw: str) -> str:
    """'VANGUARD SP 500 ETF SPLR 39326002188 US9229084135' → 'VANGUARD SP 500 ETF'. 'CHAN …' 도 같다."""
    return _SPLR_TAIL.sub("", raw or "").strip() or (raw or "").strip()


def fetch_custody(day: date) -> list[dict]:
    d = day.strftime("%Y%m%d")
    return parse_rows(_post(_req("getImptFrcurStkCusRemaList", START_DT=d, END_DT=d, S_TYPE="1", S_COUNTRY="US")))


def fetch_settle(start: date, end: date, kind: str) -> list[dict]:
    return parse_rows(_post(_req("getImptFrcurStkSetlAmtList", START_DT=start.strftime("%Y%m%d"),
                                 END_DT=end.strftime("%Y%m%d"), S_TYPE="2", S_COUNTRY="US",
                                 D_TYPE=SETTLE_KINDS[kind])))


def latest_with_data(fetch, start_from: date) -> tuple[date | None, list[dict]]:
    """start_from 부터 하루씩 거슬러 가며 행이 있는 첫 날짜와 그 행."""
    day = start_from
    for _ in range(LOOKBACK_DAYS):
        if day.weekday() < 5:
            rows = fetch(day)
            if rows:
                return day, rows
        day -= timedelta(days=1)
    return None, []


# ---------------------------------------------------------------- 티커
def load_cusip_cache(state: dict) -> dict[str, str]:
    """CUSIP → 티커('' = 조회했지만 없음). 다른 빌더 캐시 위에 이 빌더 캐시를 덮는다."""
    out: dict[str, str] = {}
    for path in CUSIP_CACHES:
        try:
            for cus, rec in json.loads(path.read_text(encoding="utf-8")).items():
                t = rec.get("t") if isinstance(rec, dict) else rec
                if t:
                    out[cus] = str(t)
        except Exception:
            continue
    out.update({k: v for k, v in (state.get("isinTickers") or {}).items() if v})
    return out


def isin_candidates(row: dict) -> list[str]:
    """티커를 찾을 ISIN 후보 — 이름 꼬리의 새 ISIN(분할 후)을 먼저."""
    cands = _SPLIT_ISIN.findall(row.get("rawName") or "")
    return [c for c in cands if c != row["isin"]] + [row["isin"]]


def resolve_ticker(row: dict, cusip_map: dict[str, str], isin_map: dict[str, str]) -> str | None:
    for isin in isin_candidates(row):
        t = isin_map.get(isin) or (cusip_map.get(isin[2:11]) if isin.startswith("US") else None)
        if t:
            return t
    return None


def figi_isin_lookup(isins: list[str], post=None, sleep=time.sleep) -> dict[str, str]:
    """ISIN → 미국 티커('BRK/B' → 'BRK.B'). 없으면 ''. 실패한 배치는 빠진다(다음 실행 재시도)."""
    def _default(body):
        req = urllib.request.Request(FIGI_URL, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    post = post or _default
    out: dict[str, str] = {}
    for i in range(0, len(isins), 10):  # 무키: 요청당 10건, 25회/분
        chunk = isins[i:i + 10]
        body = [{"idType": "ID_ISIN", "idValue": c, "exchCode": "US"} for c in chunk]
        res = None
        for attempt in range(3):
            try:
                res = post(body)
                break
            except Exception as exc:
                sleep((20 if getattr(exc, "code", None) == 429 else 3) * (attempt + 1))
        if isinstance(res, list):
            for c, item in zip(chunk, res):
                data = (item or {}).get("data") or []
                eq = [d for d in data if d.get("ticker")]
                out[c] = str(eq[0]["ticker"]).replace("/", ".") if eq else ""
        sleep(2.6)
    return out


# ---------------------------------------------------------------- 순위 변동
def baseline(history: list[dict], current: str) -> dict | None:
    """current(YYYY-MM-DD)보다 COMPARE_DAYS 이상 앞선 기록 중 가장 최근. 없으면 None."""
    cut = (date.fromisoformat(current) - timedelta(days=COMPARE_DAYS)).isoformat()
    older = [h for h in history if h.get("date") and h["date"] <= cut]
    return max(older, key=lambda h: h["date"]) if older else None


def attach_changes(rows: list[dict], base: dict | None) -> None:
    """rows 에 prevRank(1주 전 순위, 밖이었으면 None) · isNew 를 붙인다. 기준이 없으면 둘 다 None."""
    prev = {isin: i + 1 for i, isin in enumerate(base["isins"])} if base else None
    for r in rows:
        r["prevRank"] = prev.get(r["isin"]) if prev is not None else None
        r["isNew"] = (r["isin"] not in prev) if prev is not None else None


def remember(history: list[dict], day: str, rows: list[dict]) -> list[dict]:
    kept = [h for h in history if h.get("date") != day]
    kept.append({"date": day, "isins": [r["isin"] for r in rows]})
    return sorted(kept, key=lambda h: h["date"])[-HISTORY_KEEP:]


# ---------------------------------------------------------------- 조립
def public_row(r: dict, ticker: str | None, universe: set[str]) -> dict:
    out = {"rank": r["rank"], "isin": r["isin"], "name": clean_name(r["rawName"]), "t": ticker or None,
           "inUniverse": bool(ticker and ticker in universe), "prevRank": r.get("prevRank"), "isNew": r.get("isNew")}
    for k in ("amount", "buy", "sell", "net"):
        if r.get(k) is not None:
            out[k] = round(r[k])
    return out


def load_universe() -> set[str]:
    try:
        snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        return {str(s.get("ticker")) for s in snap.get("stocks") or [] if s.get("ticker")}
    except Exception:
        return set()


def build(today: date | None = None, *, figi=figi_isin_lookup) -> tuple[dict, dict]:
    today = today or datetime.now(KST).date()
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        state = {}
    histories: dict = state.get("history") or {}

    raw: dict[str, tuple[str, list[dict], str | None]] = {}  # key → (기준일, 행, 시작일)
    c_day, c_rows = latest_with_data(fetch_custody, today - timedelta(days=2))
    if c_day:
        raw["custody"] = (c_day.isoformat(), c_rows, None)
    s_end, net_1w = latest_with_data(lambda d: fetch_settle(d - timedelta(days=PERIODS["1w"] - 1), d, "net"),
                                     today - timedelta(days=1))
    if s_end:
        for pk, days in PERIODS.items():
            start = s_end - timedelta(days=days - 1)
            for kind in SETTLE_KINDS:
                rows = net_1w if (kind, pk) == ("net", "1w") else fetch_settle(start, s_end, kind)
                if rows:
                    raw[f"{kind}_{pk}"] = (s_end.isoformat(), rows, start.isoformat())

    # 티커
    isin_map: dict[str, str] = dict(state.get("isinTickers") or {})
    cusip_map = load_cusip_cache(state)
    need = []
    for _, rows, _ in raw.values():
        for r in rows:
            if resolve_ticker(r, cusip_map, isin_map) is None:
                need += [c for c in isin_candidates(r) if c not in isin_map and c not in need]
    if need:
        print(f"  OpenFIGI 조회 {min(len(need), FIGI_BUDGET)}/{len(need)}건")
        isin_map.update(figi(need[:FIGI_BUDGET]))

    universe = load_universe()
    lists: dict[str, dict] = {}
    for key, (day, rows, start) in raw.items():
        hist = histories.get(key) or []
        base = baseline(hist, day)
        attach_changes(rows, base)
        histories[key] = remember(hist, day, rows)
        lists[key] = {
            "date": day, "start": start, "baseDate": base["date"] if base else None,
            "rows": [public_row(r, resolve_ticker(r, cusip_map, isin_map), universe) for r in rows],
        }
    count = sum(len(v["rows"]) for v in lists.values())
    payload = {"updatedAtKst": sec.kst_now_str(), "unit": "USD", "count": count, "lists": lists}
    new_state = {"history": histories, "isinTickers": dict(sorted(isin_map.items()))}
    return payload, new_state


def main():
    ap = argparse.ArgumentParser(description="서학개미 TOP(SEIBro 미국 주식 보관·결제 상위)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    print("=== 서학개미 TOP 수집 시작 ===")
    payload, state = build()
    lists = payload["lists"]
    print("  " + " · ".join(f"{k} {v['date']} {len(v['rows'])}행" for k, v in lists.items()))
    if "custody" not in lists or not any(k.startswith("net_") for k in lists):
        print("  [실패] 보관 또는 순매수 목록을 못 받았다 — 기존 파일 유지")
        raise SystemExit(1)
    mapped = sum(1 for v in lists.values() for r in v["rows"] if r["t"])
    print(f"  티커 연결 {mapped}/{payload['count']}행")
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "SEOHAK_TOP", payload, indent=None)
        atomic_write_text(STATE, json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n")
        if args.push and not sec.git_publish(
            ["data/seohak_top.json", "data/seohak_top.js", "data/seohak_top_state.json"], "Seohak TOP (SEIBro)"
        ):
            raise SystemExit(1)
    print(f"Wrote {OUT_JSON.name} — {payload['count']}행")


if __name__ == "__main__":
    main()
