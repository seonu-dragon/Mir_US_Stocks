#!/usr/bin/env python3
"""KR 종목별 수급 — 서술적 표시용.

무엇을 만드나:
  data/korea/investor_flow.{json,js}   종목별 외국인·기관·개인 순매수 + 외국인 보유율

## 신호가 아니다

validate_kr_flow.py 로 재봤다. 매일 종목을 수급으로 줄 세워 상위 10% 와 하위 10% 의
다음날 수익률 차이를 낸 뒤, 그 일별 스프레드 59개로 t 검정했다(같은 날 안에서
비교하므로 시장 전체 움직임은 자동 상쇄된다):

    외국인 순매수   일평균 +0.170%p   t=+1.39   무작위와 구분 안 됨
    기관 순매수     일평균 -0.099%p   t=-0.99   무작위와 구분 안 됨

한국 투자자가 가장 많이 보는 지표지만 다음날 수익률과는 무관하다. 그래서 '무슨 일이
있었나'(사실)로만 표시하고 '무슨 일이 일어날까'(예측)로 팔지 않는다.

## 컨센서스 목표주가는 뺐다

한때 같이 실으려 했는데, 네이버가 주는 목표가가 네이버 자신의 현재가와 맞지 않았다:

    삼성전자      현재가   255,000  목표가   513,958   (2.0배)
    콘텐트리중앙   현재가     1,493  목표가    11,875   (8.0배)

배율이 종목마다 달라 단위 착오도 아니다. 550종목 중 목표가가 현재가보다 낮은 건 1%
뿐이고 괴리율 중앙값이 +71.7% 였다(실제 국내 시장은 +20~30%대). 설명도 보정도 못 하는
수치를 '상승여력' 으로 내보내면 지어낸 것과 다르지 않다. 그래서 싣지 않는다.

같은 이유로 목표주가 이력도 쌓지 않는다 — 지금 모순된 값은 나중에도 검정에 못 쓴다.

## 데이터

  /trend?pageSize=20   외국인·기관·개인 순매수(수량) + 외국인 보유율 + 거래량

수급은 최대 60거래일까지 되지만(70+ 는 400, page 파라미터는 무시됨) 화면엔 5일·20일
합계면 충분하다. 60일을 다 실으면 2,601종목에 1MB 가 넘어 부팅 프리로드에 못 얹는다.

순매수는 '수량' 이라 종목 간 비교가 안 된다(삼성전자 100만주 ≠ 소형주 100만주).
거래량 대비 비율(frnPct)을 함께 낸다.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "investor_flow.json"
OUT_JS = ROOT / "data" / "korea" / "investor_flow.js"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://m.stock.naver.com/",
}
FLOW_DAYS = 20
MIN_INTERVAL = 0.12          # 실측 20/초도 통과하지만 남의 서버다 — 8/초로 낮춘다
_last = [0.0]


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def throttle():
    gap = MIN_INTERVAL - (time.monotonic() - _last[0])
    if gap > 0:
        time.sleep(gap)
    _last[0] = time.monotonic()


def fetch(url: str, tries: int = 3):
    for attempt in range(tries):
        throttle()
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None              # 상장폐지·펀드 — 재시도 의미 없다
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
        except Exception:
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
    return None


def qnum(v):
    """'-826,076' / '+5,211,886' / '46.59%' → float."""
    if v is None:
        return None
    s = str(v).replace(",", "").replace("%", "").replace("+", "").strip()
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def summarize(rows: list[dict]) -> dict:
    """최근 5일·20일 순매수 합계와 거래량 대비 비율."""
    def total(key, n):
        vals = [r[key] for r in rows[:n] if r.get(key) is not None]
        return sum(vals) if vals else None

    out = {}
    for key, short in (("frn", "f"), ("org", "o"), ("ind", "i")):
        v5, v20 = total(key, 5), total(key, 20)
        if v5 is not None:
            out[f"{short}5"] = round(v5)
        if v20 is not None:
            out[f"{short}20"] = round(v20)
    vol20 = sum(r["vol"] for r in rows[:20] if r.get("vol"))
    # 수량은 종목 간 비교가 안 된다 — 거래량 대비 비율을 함께 낸다.
    if vol20 and out.get("f20") is not None:
        out["fPct"] = round(out["f20"] / vol20 * 100, 2)
    if vol20 and out.get("o20") is not None:
        out["oPct"] = round(out["o20"] / vol20 * 100, 2)
    for r in rows:
        if r.get("frnHold") is not None:
            out["hold"] = r["frnHold"]
            break
    if rows and rows[0].get("d"):
        out["asOf"] = rows[0]["d"]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 수급")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [s for s in snap.get("stocks") or [] if s.get("sector") != "ETF"]
    stocks.sort(key=lambda s: s.get("marketCapB") or 0, reverse=True)
    if args.limit:
        stocks = stocks[: args.limit]

    print(f"[수급] {len(stocks)}종목 · 초당 {1/MIN_INTERVAL:.0f}회 → "
          f"약 {len(stocks)*MIN_INTERVAL/60:.0f}분")

    out: dict[str, dict] = {}
    t0 = time.time()
    for i, s in enumerate(stocks, 1):
        t = str(s["ticker"]).zfill(6)
        if i % 500 == 0:
            print(f"  {i}/{len(stocks)} … ({(time.time()-t0)/60:.0f}분)")
        # 수급 이력은 /trend 에만 있다. /integration 의 dealTrendInfos 는 5일치뿐이다.
        trend = fetch(f"https://m.stock.naver.com/api/stock/{t}/trend?pageSize={FLOW_DAYS}&page=1")
        rows = []
        for r in trend or []:
            rows.append({
                "d": r.get("bizdate"),
                "frn": qnum(r.get("foreignerPureBuyQuant")),
                "org": qnum(r.get("organPureBuyQuant")),
                "ind": qnum(r.get("individualPureBuyQuant")),
                "frnHold": qnum(r.get("foreignerHoldRatio")),
                "vol": qnum(r.get("accumulatedTradingVolume")),
            })
        rec = summarize(rows) if rows else {}

        if rec:
            out[t] = rec

    if not out:
        print("[수급] 수집 0건 — 기존 파일을 덮어쓰지 않는다.")
        return 1

    payload = {
        "updatedAtKst": now_kst(),
        "source": "네이버 금융 (수급 20거래일)",
        "note": "수급은 다음날 수익률과 무관하다(외국인 t=+1.39 · 기관 t=-0.99). "
                "사실 표시용이지 신호가 아니다.",
        "count": len(out),
        "stocks": out,
    }
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    atomic_write_text(OUT_JS, "window.KR_INVESTOR_FLOW = " + text + ";")
    print(f"[수급] {len(out)}종목 · {(time.time()-t0)/60:.1f}분 · {len(text)/1024:.0f}KB")

    if args.push:
        import sec_client as sec
        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/investor_flow.json", "data/korea/investor_flow.js"],
                "KR investor flow",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
