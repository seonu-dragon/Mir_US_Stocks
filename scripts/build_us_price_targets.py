#!/usr/bin/env python3
"""US 애널리스트 목표주가 범위 — Nasdaq analyst/targetprice → 종목별 해시 샤드(지연 로드).

소스: https://api.nasdaq.com/api/analyst/{TICKER}/targetprice (Mir 가 스냅샷·공매도에서 이미 쓰는 Nasdaq API)
  data.consensusOverview   lowPriceTarget · priceTarget(평균) · highPriceTarget · buy · hold · sell
  data.historicalConsensus 월별 [{z:{buy,hold,sell,date:"MM/DD/YYYY"}, x, y}] 약 13개월 — 의견 분포 이력만 싣는다.
    y 는 목표주가가 아니라 **그달 주가**다(NVDA 2025-09 y=174.18 = 당시 주가, 마지막 점만 평균 목표가로 이어 그린
    차트용 값). 목표주가 월별 이력은 이 API 에 없다. z.latest(high/avg/low)도 주가 쪽이라 싣지 않는다.
  커버리지가 없으면 data=null · status.rCode=400("Symbol not exists") 또는 rCode 200 + "No record found".

1건 약 3초(응답 지연)라 시총 상위 --top(기본 1,000) 종목만, 순차 호출 + 짧은 대기로 받는다(주 2회, ~55분).
네트워크 실패 종목은 직전 레코드를 그대로 두고(기준일 asOf 가 오래된 채), 커버리지 없음(rCode 400)은 뺀다.
성공이 대상의 절반 미만이면 소스 이상으로 보고 아무것도 쓰지 않고 exit 1.

레코드 {"lo","avg","hi": 달러, "buy","hold","sell","n": 의견 수(n = 셋의 합), "hist": [["YYYY-MM", buy, hold, sell], ...],
        "asOf": 수집일}. 범위 값이 lo ≤ avg ≤ hi 를 어기거나 0 이하면 범위 키를 뺀다(의견 분포만 남김).

산출물
  data/us_price_targets/index.json/.js   window.US_PRICE_TARGETS_INDEX — 건수·출처·기준 시각·샤드 버전
  data/us_price_targets/NN.json          16 샤드 {"v":1,"t":{티커: 레코드}} — 바뀐 샤드만 다시 쓴다

점 티커(주식 클래스: BRK.B · BF.B · HEI.A · LEN.B …, 2026-09-26 실측)
  Nasdaq 은 'BRK.B' 를 심볼로 알아보지만(내부 표기 BRK/B) targetprice 는 전부 "No record found" 다.
  BRK-B · BRK/B · BRK^B · BRKB 는 400/404. 즉 심볼 변환으로는 안 나온다 → 점 티커만 Yahoo quoteSummary
  (financialData 목표가 저·평균·고 + recommendationTrend 이번 달 의견, 심볼은 BRK-B 형식)로 보충한다.
  레코드에 "src":"yahoo" 를 달아 화면이 출처를 Yahoo 로 표기하고, 저장 키는 원래 티커(BRK.B)다.
  다른 클래스의 목표가를 옮겨 쓰지 않는다(HEI.A 는 HEI 보다 싸게 거래되고 BRK.A 는 BRK.B 의 1,500배).
  점 티커는 시총 상위 밖이어도 대상에 넣는다(스냅샷 전체 약 23개 — 추가 호출이 적다).

실행: python scripts/build_us_price_targets.py [--top 1000] [--only AAPL,NVDA] [--push]
"""

from __future__ import annotations

import argparse
import gzip
import json
import random
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import repository_publish_lock  # noqa: E402
from sec_client import write_data  # noqa: E402
from shard_store import load_shards, write_shards  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_DIR = ROOT / "data" / "us_price_targets"
OUT_JSON = OUT_DIR / "index.json"
OUT_JS = OUT_DIR / "index.js"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
SHARDS = 16
SOURCE = "Nasdaq · 애널리스트 목표주가·투자의견"
URL = "https://api.nasdaq.com/api/analyst/{t}/targetprice"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Origin": "https://www.nasdaq.com",
    "Referer": "https://www.nasdaq.com/",
}
PAUSE = 0.35
MIN_SUCCESS_RATIO = 0.5
ETF_SECTORS = {"EXCHANGE TRADED FUNDS", "ETF"}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def _num(v):
    try:
        n = float(str(v).replace(",", "").replace("$", "").strip())
    except (TypeError, ValueError):
        return None
    return n if n == n and n not in (float("inf"), float("-inf")) else None


def _cnt(v):
    n = _num(v)
    return int(n) if n is not None and n >= 0 else None


def _month(s: str) -> str | None:
    """'09/01/2026' → '2026-09'."""
    parts = str(s or "").split("/")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        return None
    mm, _, yyyy = parts
    if not (1 <= int(mm) <= 12) or len(yyyy) != 4:
        return None
    return f"{yyyy}-{int(mm):02d}"


def parse_targetprice(payload) -> tuple[str, dict | None]:
    """응답 → ('ok', 레코드) | ('none', None)=커버리지 없음 | ('bad', None)=형식 이상."""
    if not isinstance(payload, dict):
        return "bad", None
    data = payload.get("data")
    status = payload.get("status") or {}
    if data is None:
        # 'Symbol not exists'(rCode 400) · 'No record found'(rCode 200 + bCodeMessage) = 커버리지 없음
        return ("none", None) if status.get("rCode") in (400, 404) or status.get("bCodeMessage") else ("bad", None)
    ov = data.get("consensusOverview") or {}
    rec: dict = {}
    lo, avg, hi = _num(ov.get("lowPriceTarget")), _num(ov.get("priceTarget")), _num(ov.get("highPriceTarget"))
    if lo is not None and avg is not None and hi is not None and 0 < lo <= avg <= hi:
        rec.update({"lo": round(lo, 2), "avg": round(avg, 2), "hi": round(hi, 2)})
    b, h, s = _cnt(ov.get("buy")), _cnt(ov.get("hold")), _cnt(ov.get("sell"))
    if None not in (b, h, s) and (b + h + s) > 0:
        rec.update({"buy": b, "hold": h, "sell": s, "n": b + h + s})
    hist = []
    for row in data.get("historicalConsensus") or []:
        z = row.get("z") or {}
        m = _month(z.get("date"))
        hb, hh, hs = _cnt(z.get("buy")), _cnt(z.get("hold")), _cnt(z.get("sell"))
        if not m or None in (hb, hh, hs):
            continue
        hist.append([m, hb, hh, hs])
    hist.sort(key=lambda r: r[0])
    if hist:
        rec["hist"] = hist[-13:]
    if not rec.get("n") and "avg" not in rec:
        return "none", None
    return "ok", rec


def yahoo_symbol(ticker: str) -> str:
    """BRK.B → BRK-B (Yahoo 표기). 저장 키는 원래 티커를 그대로 쓴다."""
    return str(ticker).upper().replace(".", "-").replace("/", "-")


def is_share_class(ticker: str) -> bool:
    return "." in str(ticker)


def _raw(node, key):
    v = (node or {}).get(key) if isinstance(node, dict) else None
    return v.get("raw") if isinstance(v, dict) else v


def parse_yahoo_summary(result) -> tuple[str, dict | None]:
    """quoteSummary result(financialData, recommendationTrend) → ('ok', 레코드) | ('none', None).

    Nasdaq 레코드와 같은 키(lo/avg/hi, buy/hold/sell/n). 의견은 이번 달(period 0m) 분포 —
    strongBuy+buy → buy, strongSell+sell → sell. 월별 이력(hist)은 싣지 않는다.
    """
    if not isinstance(result, dict):
        return "none", None
    fd = result.get("financialData") or {}
    cur = str(_raw(fd, "financialCurrency") or "USD").upper()
    rec: dict = {}
    lo, avg, hi = _num(_raw(fd, "targetLowPrice")), _num(_raw(fd, "targetMeanPrice")), _num(_raw(fd, "targetHighPrice"))
    if cur == "USD" and lo is not None and avg is not None and hi is not None and 0 < lo <= avg <= hi:
        rec.update({"lo": round(lo, 2), "avg": round(avg, 2), "hi": round(hi, 2)})
    trend = ((result.get("recommendationTrend") or {}).get("trend")) or []
    now = next((r for r in trend if isinstance(r, dict) and r.get("period") == "0m"), None)
    if now:
        vals = [_cnt(now.get(k)) for k in ("strongBuy", "buy", "hold", "sell", "strongSell")]
        if None not in vals and sum(vals) > 0:
            sb, b, h, s, ss = vals
            rec.update({"buy": sb + b, "hold": h, "sell": s + ss, "n": sum(vals)})
    if not rec.get("n") and "avg" not in rec:
        return "none", None
    rec["src"] = "yahoo"
    return "ok", rec


class YahooTargets:
    """점 티커 보충용 Yahoo quoteSummary 세션(쿠키+크럼, build_us_dividends_calendar.Yahoo 재사용). 첫 사용 때 인증."""

    MODULES = "financialData,recommendationTrend"

    def __init__(self):
        self._y = None
        self._ok = None

    def lookup(self, ticker: str):
        """('ok', rec) | ('none', None) | ('fail', None)=인증·네트워크 실패(직전 레코드 유지)."""
        if self._ok is None:
            from build_us_dividends_calendar import Yahoo
            self._y = Yahoo()
            self._ok = self._y.auth()
            if not self._ok:
                print("  [Yahoo] 크럼 인증 실패 — 점 티커 보충 생략")
        if not self._ok:
            return "fail", None
        url = (f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{urllib.parse.quote(yahoo_symbol(ticker))}"
               f"?modules={self.MODULES}&crumb={urllib.parse.quote(self._y.crumb)}")
        try:
            d = json.loads(self._y._get(url))
        except Exception as exc:
            if "404" in str(exc):
                return "none", None
            return "fail", None
        res = ((d.get("quoteSummary") or {}).get("result")) or []
        return parse_yahoo_summary(res[0] if res else None)


def fetch(ticker: str, retries: int = 3):
    url = URL.format(t=urllib.parse.quote(ticker))
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
            return json.loads(raw)
        except Exception as exc:
            last = exc
            if attempt < retries:
                time.sleep(min(2.0 * 2 ** (attempt - 1), 20) * (1 + 0.25 * random.random()))
    raise last


def universe(top: int) -> list[str]:
    snap = load_json(SNAPSHOT, {"stocks": []}) or {"stocks": []}
    stocks = [s for s in snap.get("stocks") or [] if s.get("ticker") and s.get("sector") not in ETF_SECTORS]
    stocks.sort(key=lambda s: float(s.get("marketCapB") or 0), reverse=True)
    out = [str(s["ticker"]).upper() for s in stocks[:top]]
    seen = set(out)
    # 점 티커(주식 클래스)는 시총 상위 밖이어도 넣는다 — Nasdaq 이 비워 두는 종목이라 Yahoo 로 따로 받는다.
    out += [t for t in (str(s["ticker"]).upper() for s in stocks[top:]) if is_share_class(t) and t not in seen]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="US 목표주가 범위(Nasdaq)")
    ap.add_argument("--top", type=int, default=1000)
    ap.add_argument("--only", default="")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    only = [x.strip().upper() for x in args.only.split(",") if x.strip()]
    tickers = only or universe(args.top)
    records = load_shards(OUT_DIR, "", SHARDS)
    before = len(records)
    stamp = datetime.now(KST).date().isoformat()
    ok = none = fail = 0
    yahoo_ok = 0
    yahoo = YahooTargets()
    t0 = time.time()
    for i, t in enumerate(tickers, 1):
        try:
            payload = fetch(t)
        except Exception as exc:
            fail += 1
            if fail <= 5:
                print(f"  {t} 실패: {exc}")
            continue
        finally:
            time.sleep(PAUSE)
        kind, rec = parse_targetprice(payload)
        if kind == "none" and is_share_class(t):
            kind, rec = yahoo.lookup(t)
            if kind == "ok":
                yahoo_ok += 1
            elif kind == "fail":
                # 인증·네트워크 실패: 직전 레코드를 그대로 두고 실패로 세지는 않는다(Nasdaq 응답은 받았다)
                none += 1
                continue
        if kind == "ok":
            old = records.get(t) or {}
            rec["asOf"] = old.get("asOf") if {k: v for k, v in old.items() if k != "asOf"} == rec else stamp
            records[t] = rec
            ok += 1
        elif kind == "none":
            records.pop(t, None)
            none += 1
        else:
            fail += 1
        if i % 100 == 0:
            print(f"  {i}/{len(tickers)} · 성공 {ok} · 없음 {none} · 실패 {fail} · {(time.time() - t0) / 60:.0f}분")
    print(f"[목표주가] 대상 {len(tickers)} · 성공 {ok}(점 티커 Yahoo 보충 {yahoo_ok}) · 커버리지 없음 {none} · 실패 {fail}")

    if (ok + none) < len(tickers) * MIN_SUCCESS_RATIO:
        print("[목표주가] 응답 성공이 대상의 절반 미만 — 소스 이상으로 보고 기존 파일 유지")
        return 1
    if not only:
        # 시총 상위에서 빠진 종목은 정리한다(오래된 목표가를 남겨 두지 않는다).
        keep = set(tickers)
        for t in [k for k in records if k not in keep]:
            records.pop(t, None)
    if before and len(records) < before * 0.7:
        print(f"[목표주가] 레코드 {before} → {len(records)} 급감 — 쓰지 않는다")
        return 1

    written, ver = write_shards(OUT_DIR, "", SHARDS, records)
    payload = {
        "schema": 1,
        "updatedAtKst": now_kst(),
        "source": SOURCE,
        "count": len(records),
        "universe": len(tickers),
        "failed": fail,
        "yahooShareClass": yahoo_ok,
        "shards": SHARDS,
        "ver": ver,
    }
    write_data(OUT_JSON, OUT_JS, "US_PRICE_TARGETS_INDEX", payload, indent=None, min_ratio=0.7)
    print(f"[목표주가] 레코드 {len(records)} · 바뀐 샤드 {len(written)}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(["data/us_price_targets"], "US price targets"):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
