#!/usr/bin/env python3
"""시장 폭 추이 — 종목별 일봉(data/details·data/korea/details 의 chartSeries)만으로 매일의 시장 내부를 센다.

외부 원천 없이 이미 발행된 실측 일봉을 다시 읽는다(키·차단 위험 0). 시장 탭 '시장 폭' 카드는 그날 하루의
상승 비율만 보여 줬다 — 여기서 최근 1년 추이를 만든다.

  above50 / above200 : 그날 종가가 50일·200일 이동평균 위인 종목 비율(%) — 이평 계산에 봉이 모자란 종목은 분모에서 뺀다
  adv / dec          : 전일 종가 대비 오른·내린 종목 수
  adLine             : 누적 (adv − dec) — 창 첫날 0
  mcclellan          : 맥클렐런 오실레이터 = EMA19(RANA) − EMA39(RANA), RANA = (adv − dec) / (adv + dec) × 1000
  nh / nl            : 종가 기준 52주(252봉) 신고가·신저가 종목 수
  n                  : 그날 봉이 있는 종목 수
  bpi / bpiIdx       : 강세 비율 지수(Bullish Percent Index) — 포인트앤피겨(P&F) 최근 신호가 매수인 종목 비율(%).
                       bpi 는 보통주 전체, bpiIdx 는 지수 구성(미국 S&P 500 · 국내 코스피 200, 스냅샷 groups 기준)

같은 1회 순회에서 **종목별** 기술적 파생값도 함께 내 별 파일로 쓴다(data/tech_signals.json/.js,
window.TECH_SIGNALS): RS 등급(1~99)·RS선 52주 신고가·전일 종가/SMA/RSI·이동평균·MACD 교차가 며칠
전이었나. 계산 규칙과 가중치는 scripts/tech_signals_core.py 한 곳에 있다(pytest 있음).

추가 블록(같은 파일, 같은 1회 순회):
  sectors : 섹터별 50·200일선 위 비율 추이(rows 날짜와 같은 길이) + 최신 BPI
  groups  : 업종(industry)별 종목 수, 시총 가중·동일 가중 1일·1주·1개월·3개월 수익률(종가 기준), 1주(5거래일) 전
            같은 값(순위 변화용), 50·200일선 위 비율, 기간별 상승·하락 1위 종목. 종목 GROUP_MIN 개 미만 업종은 뺀다

대상: 보통주만(미국 스냅샷 bucket 'all_misc'·국내 market 'etf' 제외), 실측 이력(historySource yahoo·yahoo-cache)만.
마지막 봉이 최신일보다 7일 넘게 묵은 종목은 뺀다. 그날 봉이 있는 종목이 최근 최대치의 60% 미만인 날(휴장·부분 발행)은 버린다.

산출물: data/market_breadth.json/.js (US), data/korea/market_breadth.json/.js (KR) — window.MARKET_BREADTH.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402
import tech_signals_core as ts  # noqa: E402

KST = timezone(timedelta(hours=9))
WINDOW = 252          # 내보내는 거래일 수(약 1년)
WARMUP = 252 + 40     # 52주 고저·200일선·EMA39 가 서려면 앞에 더 필요한 봉
MIN_COVERAGE = 0.6
STALE_DAYS = 7
REAL_SOURCES = {"yahoo", "yahoo-cache"}
MARKETS = {
    "us": {"snapshot": ROOT / "data" / "market_snapshot.json", "details": ROOT / "data" / "details",
           "out": (ROOT / "data" / "market_breadth.json", ROOT / "data" / "market_breadth.js"),
           "tech": (ROOT / "data" / "tech_signals.json", ROOT / "data" / "tech_signals.js")},
    "kr": {"snapshot": ROOT / "data" / "korea" / "market_snapshot.json", "details": ROOT / "data" / "korea" / "details",
           "out": (ROOT / "data" / "korea" / "market_breadth.json", ROOT / "data" / "korea" / "market_breadth.js"),
           "tech": (ROOT / "data" / "korea" / "tech_signals.json", ROOT / "data" / "korea" / "tech_signals.js")},
}
# RS선(종가 ÷ 벤치마크) 의 벤치마크. 신호 성적표(build_signal_ledger.mjs BENCH)와 같은 종목을 쓴다.
RS_BENCH = {
    "us": {"ticker": "SPY", "label": "S&P 500 ETF (SPY)"},
    "kr": {"ticker": "069500", "label": "KODEX 200"},
}


GROUP_MIN = 5          # 업종 순위표에 넣는 최소 종목 수(작은 업종은 한두 종목이 수익률을 좌우한다)
SECTOR_MIN = 20        # 섹터 시장 폭 표의 최소 종목 수
PERIODS = (("1d", 1), ("1w", 5), ("1m", 21), ("3m", 63))  # 거래일 수
PREV_LAG = 5           # '1주 전 순위' = 5거래일 전 시점의 같은 기간 수익률로 매긴 순위
SKIP_GROUPS = {"", "Other", "기타", "MISC", "Misc"}
INDEX_GROUP = {"us": ("idx_sp500", "S&P 500"), "kr": ("idx_kospi200", "코스피 200")}

# ── 포인트앤피겨(P&F) 박스 크기 규칙 ─────────────────────────────────────────────────────────
# 3박스 반전(3-box reversal), 일봉 종가 기준(고저 방식이 아니라 종가 방식).
# 미국: 전통 스케일(StockCharts 'Traditional' 표) — 가격대별 고정 박스.
#   0~0.25$ 0.0625 · 0.25~1$ 0.125 · 1~5$ 0.25 · 5~20$ 0.5 · 20~100$ 1 · 100~200$ 2 · 200~500$ 4 ·
#   500~1,000$ 5 · 1,000~25,000$ 50 · 25,000$~ 500. 구간 경계가 박스 경계와 맞도록(각 구간 박스 수가 정수) 표를 그대로 쓴다.
# 국내: 원화 가격엔 전통 표가 없으므로 비율 박스 2%(로그 눈금, 박스 = 직전 박스 × 1.02)를 쓴다.
# 신호: X 열이 직전 X 열 꼭대기를 넘으면 매수(더블 톱 돌파), O 열이 직전 O 열 바닥을 깨면 매도(더블 바텀 붕괴).
#   최근 신호가 매수인 종목 / 신호가 하나라도 난 종목 = BPI. 아직 신호가 없는 종목은 분모에서 뺀다.
# 박스 채움: 오를 때는 내림(floor) — 박스 값에 닿아야 X 한 칸, 내릴 때는 올림(ceil) — 박스 값까지 내려야 O 한 칸.
PNF_REVERSAL = 3
PNF_US_SCALE = ((0.0, 0.25, 0.0625), (0.25, 1.0, 0.125), (1.0, 5.0, 0.25), (5.0, 20.0, 0.5), (20.0, 100.0, 1.0),
                (100.0, 200.0, 2.0), (200.0, 500.0, 4.0), (500.0, 1000.0, 5.0), (1000.0, 25000.0, 50.0),
                (25000.0, math.inf, 500.0))
PNF_KR_PCT = 0.02
_EPS = 1e-9


def pnf_position(price: float, market: str) -> float:
    """가격 → 연속 박스 좌표(정수 = 박스 경계). 미국은 전통 표 누적, 국내는 log(price)/log(1.02)."""
    if price <= 0:
        return float("-inf")
    if market == "kr":
        return math.log(price) / math.log1p(PNF_KR_PCT)
    pos = 0.0
    for lo, hi, box in PNF_US_SCALE:
        if price >= hi:
            pos += (hi - lo) / box
        else:
            return pos + (price - lo) / box
    return pos


def pnf_signals(closes: list[tuple[str, float]], market: str) -> dict[str, int | None]:
    """날짜 → 그날까지의 최근 P&F 신호(1 매수 · -1 매도 · None 아직 없음). 3박스 반전, 종가 기준."""
    out: dict[str, int | None] = {}
    col = 0            # 0 시작 전 · 1 X 열 · -1 O 열
    level = top = bot = 0
    prev_top = prev_bot = None
    sig = None
    for i, (d, c) in enumerate(closes):
        x = pnf_position(c, market)
        up, dn = math.floor(x + _EPS), math.ceil(x - _EPS)
        if i == 0:
            level = math.floor(x + _EPS)
        elif col == 0:
            if up >= level + 1:
                col, top = 1, up
            elif dn <= level - 1:
                col, bot = -1, dn
        elif col == 1:
            if up > top:
                top = up
                if prev_top is not None and top > prev_top:
                    sig = 1
            elif dn <= top - PNF_REVERSAL:
                prev_top, col, bot = top, -1, dn
                if prev_bot is not None and bot < prev_bot:
                    sig = -1
        else:
            if dn < bot:
                bot = dn
                if prev_bot is not None and bot < prev_bot:
                    sig = -1
            elif up >= bot + PNF_REVERSAL:
                prev_bot, col, top = bot, 1, up
                if prev_top is not None and top > prev_top:
                    sig = 1
        out[d] = sig
    return out


def is_common_stock(market: str, row: dict) -> bool:
    if market == "us":
        return row.get("bucket") != "all_misc"
    return row.get("market") != "etf"


def closes_of(detail: dict) -> list[tuple[str, float]]:
    """chartSeries [시, 고, 저, 종, 량, 날짜] → [(날짜, 종가)] 오름차순, 0·결측 제외."""
    out = []
    for e in detail.get("chartSeries") or []:
        if isinstance(e, list) and len(e) >= 6 and e[5] and isinstance(e[3], (int, float)) and e[3] > 0:
            out.append((str(e[5]), float(e[3])))
    out.sort()
    return out


def stock_flags(closes: list[tuple[str, float]]) -> dict[str, tuple]:
    """날짜 → (above50|None, above200|None, change_sign|None, new_high, new_low). 이평·고저는 그 종목 자신의 봉 기준."""
    flags: dict[str, tuple] = {}
    vals = [c for _, c in closes]
    s50 = s200 = 0.0
    for i, (d, c) in enumerate(closes):
        s50 += c
        s200 += c
        if i >= 50:
            s50 -= vals[i - 50]
        if i >= 200:
            s200 -= vals[i - 200]
        a50 = (c > s50 / 50) if i >= 49 else None
        a200 = (c > s200 / 200) if i >= 199 else None
        sign = None if i == 0 else (1 if c > vals[i - 1] else -1 if c < vals[i - 1] else 0)
        nh = nl = False
        if i >= WINDOW:
            prior = vals[i - WINDOW:i]
            nh, nl = c > max(prior), c < min(prior)
        flags[d] = (a50, a200, sign, nh, nl)
    return flags


def ema(values: list[float], span: int) -> list[float]:
    k = 2 / (span + 1)
    out, cur = [], None
    for v in values:
        cur = v if cur is None else cur + k * (v - cur)
        out.append(cur)
    return out


def aggregate(all_flags: list[dict[str, tuple]]) -> list[dict]:
    """종목별 플래그 → 날짜별 집계. 커버리지가 낮은 날은 버리고, 최근 WINDOW 일만."""
    days: dict[str, list] = {}
    for flags in all_flags:
        for d, (a50, a200, sign, nh, nl) in flags.items():
            r = days.setdefault(d, [0, 0, 0, 0, 0, 0, 0, 0, 0])  # n, a50n, a50y, a200n, a200y, adv, dec, nh, nl
            r[0] += 1
            if a50 is not None:
                r[1] += 1
                r[2] += a50
            if a200 is not None:
                r[3] += 1
                r[4] += a200
            r[5] += sign == 1
            r[6] += sign == -1
            r[7] += nh
            r[8] += nl
    dates = sorted(days)
    if not dates:
        return []
    peak = max(days[d][0] for d in dates[-WINDOW:])
    dates = [d for d in dates if days[d][0] >= peak * MIN_COVERAGE]
    rana = []
    for d in dates:
        n, _, _, _, _, adv, dec, _, _ = days[d]
        rana.append((adv - dec) / (adv + dec) * 1000 if adv + dec else 0.0)
    osc = [a - b for a, b in zip(ema(rana, 19), ema(rana, 39))]
    rows, ad = [], 0
    start = max(0, len(dates) - WINDOW)
    for i, d in enumerate(dates):
        if i < start:
            continue
        n, a50n, a50y, a200n, a200y, adv, dec, nh, nl = days[d]
        ad += adv - dec
        rows.append({
            "d": d, "n": n,
            "above50": round(a50y / a50n * 100, 1) if a50n else None,
            "above200": round(a200y / a200n * 100, 1) if a200n else None,
            "adv": adv, "dec": dec, "adLine": ad,
            "mcclellan": round(osc[i], 1) if i >= 39 else None,
            "nh": nh, "nl": nl,
        })
    return rows


def _pct(y: int, n: int):
    return round(y / n * 100, 1) if n else None


def add_bpi(rows: list[dict], signals: list[dict], in_index: list[bool]) -> None:
    """rows 각 날짜에 bpi(전체)·bpiIdx(지수 구성) 를 붙인다. 그날 신호가 있는 종목만 분모."""
    for r in rows:
        d = r["d"]
        n = y = ni = yi = 0
        for sg, idx in zip(signals, in_index):
            v = sg.get(d)
            if v is None:
                continue
            n += 1
            y += v == 1
            if idx:
                ni += 1
                yi += v == 1
        r["bpi"] = _pct(y, n)
        r["bpiIdx"] = _pct(yi, ni)


def _ma_counts(flag_list, d: str) -> list[int]:
    c = [0, 0, 0, 0]
    for flags in flag_list:
        f = flags.get(d)
        if not f:
            continue
        if f[0] is not None:
            c[0] += 1
            c[1] += f[0]
        if f[1] is not None:
            c[2] += 1
            c[3] += f[1]
    return c


def sector_breadth(dates: list[str], members: list[tuple[str, dict, dict]], min_n: int = SECTOR_MIN) -> list[dict]:
    """members = [(섹터, stock_flags, pnf_signals)] → 섹터별 50·200일선 위 비율 추이(dates 길이)와 최신 BPI."""
    by: dict[str, list] = {}
    for sector, flags, sg in members:
        if not sector or sector in SKIP_GROUPS:
            continue
        by.setdefault(sector, []).append((flags, sg))
    out = []
    last = dates[-1] if dates else None
    for sector, items in by.items():
        if len(items) < min_n:
            continue
        a50, a200 = [], []
        fl = [f for f, _ in items]
        for d in dates:
            c = _ma_counts(fl, d)
            a50.append(_pct(c[1], c[0]))
            a200.append(_pct(c[3], c[2]))
        sigs = [sg.get(last) for _, sg in items if sg.get(last) is not None]
        out.append({"name": sector, "n": len(items), "above50": a50, "above200": a200,
                    "bpi": _pct(sum(v == 1 for v in sigs), len(sigs))})
    out.sort(key=lambda x: -x["n"])
    return out


def _period_return(px: dict[str, float], dates: list[str], i: int, k: int):
    """dates[i] 종가 / dates[i-k] 종가 − 1 (%) — 두 날 모두 그 종목 봉이 있을 때만."""
    if i - k < 0:
        return None
    a, b = px.get(dates[i]), px.get(dates[i - k])
    if not a or not b:
        return None
    return (a / b - 1) * 100


def _group_period(members: list[dict], dates: list[str], i: int, k: int, now_i: int):
    """한 업종·한 시점(i)·한 기간(k) → (시총 가중, 동일 가중, [(ticker, ret)]). 유효 종목 GROUP_MIN 미만이면 None."""
    rets = []
    wsum = wret = 0.0
    for m in members:
        r = _period_return(m["px"], dates, i, k)
        if r is None:
            continue
        rets.append((m["ticker"], r))
        cap = m.get("cap") or 0
        now_px, then_px = m["px"].get(dates[now_i]), m["px"].get(dates[i])
        if cap > 0 and now_px and then_px:
            w = cap * then_px / now_px      # 그 시점 시총 ≈ 현재 시총 × (그때 종가 / 현재 종가)
            wsum += w
            wret += w * r
    if len(rets) < GROUP_MIN:
        return None
    cw = round(wret / wsum, 2) if wsum > 0 else None
    ew = round(sum(r for _, r in rets) / len(rets), 2)
    return cw, ew, rets


def _mode(values: list[str]) -> str:
    counts: dict[str, int] = {}
    for v in values:
        counts[v] = counts.get(v, 0) + 1
    return max(counts, key=counts.get) if counts else ""


def industry_groups(dates: list[str], members: list[dict], min_n: int = GROUP_MIN) -> list[dict]:
    """members = [{ticker, name, sector, industry, cap, px{date: close}, flags}] → 업종별 수익률·순위 재료.

    r[기간] = [시총 가중, 동일 가중] (마지막 날 기준), p[기간] = 같은 값의 PREV_LAG 거래일 전 시점(순위 변화용).
    top[기간] = [[상승 1위 ticker, 이름, 수익률], [하락 1위 …]]. 순위 자체는 화면이 고른 기간·가중으로 매긴다.
    """
    if not dates:
        return []
    by: dict[str, list] = {}
    for m in members:
        ind = (m.get("industry") or "").strip()
        if ind in SKIP_GROUPS:
            continue
        by.setdefault(ind, []).append(m)
    now_i = len(dates) - 1
    prev_i = now_i - PREV_LAG
    out = []
    for ind, ms in by.items():
        if len(ms) < min_n:
            continue
        names = {m["ticker"]: (m.get("name") or m["ticker"])[:40] for m in ms}
        rec = {"name": ind, "sector": _mode([m.get("sector") or "" for m in ms]), "n": len(ms),
               "cap": round(sum(m.get("cap") or 0 for m in ms), 1), "r": {}, "p": {}, "top": {}}
        for key, k in PERIODS:
            cur = _group_period(ms, dates, now_i, k, now_i)
            if cur:
                rec["r"][key] = [cur[0], cur[1]]
                best = max(cur[2], key=lambda x: x[1])
                worst = min(cur[2], key=lambda x: x[1])
                rec["top"][key] = [[t, names[t], round(v, 2)] for t, v in (best, worst)]
            prev = _group_period(ms, dates, prev_i, k, now_i) if prev_i >= 0 else None
            if prev:
                rec["p"][key] = [prev[0], prev[1]]
        if not rec["r"]:
            continue
        c = _ma_counts([m["flags"] for m in ms], dates[now_i])
        rec["above50"], rec["above200"] = _pct(c[1], c[0]), _pct(c[3], c[2])
        out.append(rec)
    out.sort(key=lambda x: -x["cap"])
    return out


def load_bench_closes(market: str) -> dict[str, float]:
    """RS선 벤치마크(SPY · KODEX 200)의 날짜 → 종가. 상세 파일이 없으면 빈 사전(RS선 판정은 생략된다)."""
    path = MARKETS[market]["details"] / f"{RS_BENCH[market]['ticker']}.json"
    if not path.exists():
        return {}
    try:
        detail = json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}
    return dict(closes_of(detail)[-(WINDOW + WARMUP):])


def tech_payload(market: str, series: list, infos: list[dict], base_date: str | None) -> dict:
    """종목별 기술적 파생값 묶음. 값이 하나도 없는 종목은 넣지 않는다(결측을 0 으로 채우지 않는다)."""
    bench = load_bench_closes(market)
    rows, scores, tickers = [], [], []
    for closes, info in zip(series, infos):
        d = ts.derived_row(closes, bench)
        rows.append(d["row"])
        scores.append(d["score"])
        tickers.append(info["ticker"])
    packed = ts.pack(rows, scores)
    out = {}
    for ticker, arr in zip(tickers, packed):
        if any(v is not None for v in arr):
            out[ticker] = arr
    rs_n = sum(1 for a in out.values() if a[0] is not None)
    nh_n = sum(1 for a in out.values() if a[1] == 1)
    return {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "market": market, "baseDate": base_date, "cols": list(ts.COLS),
        "count": len(out), "rsCount": rs_n, "rsNewHighCount": nh_n,
        "benchmark": {**RS_BENCH[market], "bars": len(bench)},
        "tickers": out,
        "method": "RS 등급 = 가중 12개월 성과(최근 3개월 40% + 직전 세 분기 각 20%)의 시장 내 백분위 1~99 · "
                  "RS선 = 종가 ÷ 벤치마크 종가, 직전 252봉 최고를 넘으면 신고가 · "
                  "교차·신고가는 '며칠 전'(0 = 당일, 10봉 안에 없으면 없음)",
    }


def build_market(market: str, limit: int | None = None) -> tuple[dict, dict]:
    cfg = MARKETS[market]
    snap = json.loads(cfg["snapshot"].read_text(encoding="utf-8"))
    idx_group, idx_label = INDEX_GROUP[market]
    meta = [r for r in snap.get("stocks") or [] if r.get("ticker") and is_common_stock(market, r)]
    del snap
    if limit:
        meta = sorted(meta, key=lambda r: -(r.get("marketCapB") or 0))[:limit]
    series, infos = [], []
    for r in meta:
        path = cfg["details"] / f"{r['ticker']}.json"
        if not path.exists():
            continue
        try:
            detail = json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if detail.get("historySource") not in REAL_SOURCES:
            continue
        closes = closes_of(detail)[-(WINDOW + WARMUP):]
        del detail
        if len(closes) >= 60:
            series.append(closes)
            infos.append({"ticker": r["ticker"], "name": r.get("company") or r["ticker"], "sector": r.get("sector") or "",
                          "industry": r.get("industry") or "", "cap": float(r.get("marketCapB") or 0),
                          "idx": idx_group in (r.get("groups") or [])})
    # 마지막 봉이 최신일에서 STALE_DAYS 넘게 묵은 종목(갱신이 멈춘 캐시)은 통째로 뺀다 — 넣으면 최근 날짜만
    # 분모가 줄어 비율이 튀고(국내 2026-10: 3,800개 중 약 1,400개가 묵은 캐시), 커버리지 기준에 최근 날이 잘린다.
    newest = max((c[-1][0] for c in series), default="")
    cutoff = (datetime.fromisoformat(newest) - timedelta(days=STALE_DAYS)).date().isoformat() if newest else ""
    keep = [i for i, c in enumerate(series) if c[-1][0] >= cutoff]
    series = [series[i] for i in keep]
    infos = [infos[i] for i in keep]
    flags = [stock_flags(c) for c in series]
    signals = [pnf_signals(c, market) for c in series]
    rows = aggregate(flags)
    add_bpi(rows, signals, [x["idx"] for x in infos])
    dates = [r["d"] for r in rows]
    sectors = sector_breadth(dates, [(x["sector"], f, sg) for x, f, sg in zip(infos, flags, signals)])
    # 업종 수익률은 최근 63+5 거래일만 보면 된다 — 종가 사전은 끝 90봉만 둬 메모리를 아낀다.
    members = [{**x, "px": dict(c[-90:]), "flags": f} for x, c, f in zip(infos, series, flags)]
    groups = industry_groups(dates, members)
    del members
    tech = tech_payload(market, series, infos, dates[-1] if dates else None)
    return {
        "updatedAtKst": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "market": market, "universe": len(series), "count": len(rows), "rows": rows,
        "indexLabel": idx_label, "indexUniverse": sum(1 for x in infos if x["idx"]),
        "sectors": sectors,
        "groups": groups, "groupsAsOf": dates[-1] if dates else None,
        "groupsPrevAsOf": dates[-1 - PREV_LAG] if len(dates) > PREV_LAG else None,
        "method": "종목별 실측 일봉 종가 기준 · 보통주만 · 이평·52주는 각 종목 자신의 봉 · "
                  "BPI 는 3박스 반전 P&F(미국 전통 박스표, 국내 2% 박스) 최근 신호",
    }, tech


def main() -> int:
    ap = argparse.ArgumentParser(description="시장 폭 추이(종목 일봉 집계)")
    ap.add_argument("--market", choices=["us", "kr", "all"], default="all")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--limit", type=int, default=None, help="로컬 확인용: 시총 상위 N 종목만 집계하고 파일은 쓰지 않는다")
    args = ap.parse_args()
    markets = ["us", "kr"] if args.market == "all" else [args.market]
    written = []
    for m in markets:
        payload, tech = build_market(m, args.limit)
        if payload["count"] < 60:
            print(f"[breadth] {m}: 날짜 {payload['count']}개 — 너무 적어 기존 파일 유지")
            return 1
        last = payload["rows"][-1]
        print(f"[breadth] {m}: 종목 {payload['universe']} · {payload['count']}일 · {last['d']} "
              f"50일선 위 {last['above50']}% · 200일선 위 {last['above200']}% · 맥클렐런 {last['mcclellan']} · 신고 {last['nh']}/신저 {last['nl']}"
              f" · BPI {last.get('bpi')}% · {payload['indexLabel']} BPI {last.get('bpiIdx')}% ({payload['indexUniverse']}종목)"
              f" · 섹터 {len(payload['sectors'])} · 업종 {len(payload['groups'])}")
        print(f"[tech] {m}: 종목 {tech['count']} · RS 등급 {tech['rsCount']} · RS선 신고가 {tech['rsNewHighCount']} "
              f"· 벤치마크 {tech['benchmark']['ticker']} {tech['benchmark']['bars']}봉 · 기준 {tech['baseDate']}")
        if args.limit:
            continue
        out_json, out_js = MARKETS[m]["out"]
        sec.write_data(out_json, out_js, "MARKET_BREADTH", payload, indent=None, min_ratio=0.5)
        written += [str(out_json.relative_to(ROOT)), str(out_js.relative_to(ROOT))]
        tech_json, tech_js = MARKETS[m]["tech"]
        sec.write_data(tech_json, tech_js, "TECH_SIGNALS", tech, indent=None, min_ratio=0.5)
        written += [str(tech_json.relative_to(ROOT)), str(tech_js.relative_to(ROOT))]
    if args.push and not sec.git_publish(written, f"Auto-update market breadth ({args.market})"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
