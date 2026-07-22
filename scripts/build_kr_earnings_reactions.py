#!/usr/bin/env python3
"""국내 실적(잠정) 발표 + 주가반응 — 파싱 없이 공시일·시세로만.

DART 공시목록(kr_disclosures.json)의 '영업(잠정)실적(공정공시)' 이벤트를 모아, 각
발표의 **공시일 등락률**과 **익일 등락률**을 야후 일봉으로 계산한다. 잠정 매출·영업이익
'숫자'는 공시 본문에만 있어(구조화 API 없음) 여기선 다루지 않는다 — 발표가 언제 있었고
그 뒤 주가가 어떻게 움직였는지(사실)만 보여준다.

주의(정직성): 공시 유형별 과거 주가반응은 이미 검정됐고 잠정실적을 포함해 무작위를
이긴 유형은 없었다(build_kr_disclosure_stats.py, 41유형 중 0). 그래서 이건 '예측 신호'가
아니라 '무슨 일이 있었나'의 사실 피드다.

산출물: data/korea/earnings_reactions.{json,js}  (window.KR_EARNINGS_REACTIONS)
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
DISCLOSURES = ROOT / "data" / "kr_disclosures.json"
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "earnings_reactions.json"
OUT_JS = ROOT / "data" / "korea" / "earnings_reactions.js"

UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def yahoo_symbol_map() -> dict[str, str]:
    """ticker -> yahooSymbol(005930.KS 등). 스냅샷에 있으면 그걸 쓰고, 없으면 .KS 기본."""
    out = {}
    if SNAPSHOT.exists():
        try:
            for s in json.loads(SNAPSHOT.read_text(encoding="utf-8")).get("stocks", []):
                t = str(s.get("ticker") or "").zfill(6)
                if t:
                    out[t] = s.get("yahooSymbol") or f"{t}.KS"
        except Exception:
            pass
    return out


def yahoo_daily(ysym: str):
    """[(YYYY-MM-DD, close)] 최근 3개월. 실패 시 []"""
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           f"{urllib.parse.quote(ysym)}?range=3mo&interval=1d")
    try:
        req = urllib.request.Request(url, headers=UA)
        payload = json.loads(urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "replace"))
        res = payload["chart"]["result"][0]
        ts = res.get("timestamp", [])
        closes = res["indicators"]["quote"][0].get("close", [])
        out = []
        for t, c in zip(ts, closes):
            if c is not None:
                out.append((datetime.fromtimestamp(t, tz=ZoneInfo("UTC")).date().isoformat(), float(c)))
        return out
    except Exception:
        return []


def reactions(series, file_date: str):
    """공시일(file_date) 기준 공시일·익일 종가 등락률(%). 시세 부족 시 (None, None)."""
    if not series:
        return None, None
    dates = [d for d, _ in series]
    # 공시일 이하의 마지막 거래일 인덱스
    idx = None
    for i, d in enumerate(dates):
        if d <= file_date:
            idx = i
        else:
            break
    if idx is None:
        return None, None
    day = None
    if idx >= 1 and series[idx - 1][1]:
        day = round((series[idx][1] / series[idx - 1][1] - 1) * 100, 2)
    nxt = None
    if idx + 1 < len(series) and series[idx][1]:
        nxt = round((series[idx + 1][1] / series[idx][1] - 1) * 100, 2)
    return day, nxt


def build():
    if not DISCLOSURES.exists():
        raise SystemExit("[실적반응] kr_disclosures.json 없음 — 공시 빌더 먼저.")
    rows = json.loads(DISCLOSURES.read_text(encoding="utf-8")).get("disclosures") or []
    events = [r for r in rows if "(잠정)실적" in (r.get("title") or "")]
    print(f"[실적반응] 잠정실적 공시 {len(events)}건")
    ymap = yahoo_symbol_map()
    # 종목별 시세는 한 번만 받는다.
    cache: dict[str, list] = {}
    out = []
    for r in events:
        ticker = str(r.get("ticker") or "").zfill(6)
        ysym = ymap.get(ticker) or f"{ticker}.KS"
        if ticker not in cache:
            cache[ticker] = yahoo_daily(ysym)
        day, nxt = reactions(cache[ticker], r.get("fileDate") or "")
        out.append({
            "ticker": ticker,
            "company": r.get("company") or ticker,
            "date": r.get("fileDate") or "",
            "consolidated": "연결" in (r.get("title") or ""),
            "dayPct": day,
            "nextPct": nxt,
            "link": r.get("link") or "",
        })
    out.sort(key=lambda x: x["date"], reverse=True)
    covered = sum(1 for x in out if x["dayPct"] is not None)
    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART 공시(영업잠정실적) + Yahoo 일봉",
        "note": "잠정실적 '발표 사실'과 발표 전후 주가 등락률. 잠정 매출·영업이익 숫자는 "
                "공시 본문에만 있어 제외. 예측 신호가 아니다(공시유형 반응은 무작위와 무차별).",
        "count": len(out),
        "rows": out,
    }
    print(f"[실적반응] {len(out)}건 · 반응 계산 {covered}건")
    return payload


def main() -> int:
    ap = argparse.ArgumentParser(description="국내 잠정실적 발표 + 주가반응")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    payload = build()
    if not payload["rows"]:
        # 공시 창에 잠정실적이 없을 수도 있다(실적 시즌 밖). 빈 페이로드를 정상 발행한다
        # — 패널은 '최근 발표 없음'을 보여주면 된다.
        payload = {"updatedAtKst": now_kst(), "source": "DART 공시(영업잠정실적) + Yahoo 일봉",
                   "count": 0, "rows": []}
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with repository_publish_lock(ROOT):
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(OUT_JSON, text)
        atomic_write_text(OUT_JS, "window.KR_EARNINGS_REACTIONS = " + text + ";")
        print(f"Wrote {OUT_JSON} — {payload['count']} rows")
        if args.push:
            import sec_client as sec
            sec.git_publish(
                ["data/korea/earnings_reactions.json", "data/korea/earnings_reactions.js"],
                "KR earnings reactions",
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
