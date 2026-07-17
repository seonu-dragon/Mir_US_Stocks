#!/usr/bin/env python3
"""수급·컨센서스가 다음날 수익률을 예측하는가 — 횡단면 검정.

공시 통계(build_kr_disclosure_stats.py)에서 쓴 '무작위 날짜 대조군' 을 여기 그대로
쓸 수 없다. 네이버가 주는 수급이 60거래일뿐이라 서로 다른 날짜가 60개밖에 없고,
날짜로 묶고 나면 표본이 60이라 통계력이 안 나온다.

그래서 횡단면으로 잰다:
  1. 매일, 그날 수급 신호로 종목을 줄 세운다(거래량 대비 순매수 비율).
  2. 상위 10%(롱) 와 하위 10%(숏) 의 '다음날' 수익률 평균 차이를 낸다.
  3. 그 일별 스프레드 60개로 t 검정을 한다.

이 설계의 장점:
  - 같은 날 안에서 비교하므로 시장 전체 움직임이 자동으로 상쇄된다(공시 때처럼
    지수 프록시로 초과수익을 따로 계산할 필요가 없다).
  - 날짜 뭉침 문제가 원천적으로 없다 — 관측 하나가 곧 하루다.

정규화가 중요하다. 순매수는 '수량' 이라 삼성전자 100만주와 소형주 100만주는 전혀
다른 의미다. 거래량으로 나눠 비율로 만든다.

룩어헤드 없음: D일 수급으로 D+1 수익률을 예측한다. D일 종가는 이미 알려진 값이다.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOW_DIR = ROOT / "data" / "korea" / "_archive" / "flow"
DECILE = 0.1
MIN_PER_SIDE = 20        # 그날 한쪽이 이보다 적으면 그 날짜는 버린다


def welch_one_sample(vals):
    """평균이 0 과 다른가. 일별 스프레드의 t = mean / (sd/sqrt(n))."""
    if len(vals) < 10:
        return None, None
    m = statistics.fmean(vals)
    sd = statistics.stdev(vals)
    if sd == 0:
        return m, None
    return m, m / (sd / len(vals) ** 0.5)


def load():
    """{date: [(signalKey→value..., ticker, close)]} 형태로 재구성."""
    days = {}          # date -> list of dict(ticker, frn, org, vol, close)
    consensus = {}     # ticker -> (targetPrice, recommMean, lastClose)
    files = list(FLOW_DIR.glob("*.json"))
    for f in files:
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        rows = d.get("flow") or []
        for r in rows:
            if not r.get("d") or r.get("close") is None:
                continue
            days.setdefault(r["d"], []).append({
                "t": d["ticker"], "frn": r.get("frn"), "org": r.get("org"),
                "vol": r.get("vol"), "close": r["close"],
            })
        if d.get("targetPrice") and rows:
            last = rows[0]
            if last.get("close"):
                consensus[d["ticker"]] = (d["targetPrice"], d.get("recommMean"), last["close"])
    return days, consensus, len(files)


def next_close_map(days):
    """티커별 날짜순 종가 → D+1 수익률 계산용."""
    series = {}
    for date, rows in days.items():
        for r in rows:
            series.setdefault(r["t"], {})[date] = r["close"]
    ret = {}
    for t, m in series.items():
        ds = sorted(m)
        for i in range(len(ds) - 1):
            a, b = m[ds[i]], m[ds[i + 1]]
            if a:
                ret.setdefault(ds[i], {})[t] = (b - a) / a * 100
    return ret


def test_signal(days, ret, key, label):
    """key 가 큰 상위 10% vs 하위 10% 의 다음날 수익률 차이(일별)."""
    spreads = []
    for date in sorted(days):
        rows = []
        for r in days[date]:
            v, vol = r.get(key), r.get("vol")
            if v is None or not vol:
                continue
            nxt = ret.get(date, {}).get(r["t"])
            if nxt is None:
                continue
            rows.append((v / vol, nxt))       # 거래량 대비 순매수 비율로 정규화
        n = int(len(rows) * DECILE)
        if n < MIN_PER_SIDE:
            continue
        rows.sort(key=lambda x: x[0])
        low = statistics.fmean([r[1] for r in rows[:n]])
        high = statistics.fmean([r[1] for r in rows[-n:]])
        spreads.append(high - low)
    m, t = welch_one_sample(spreads)
    if m is None:
        print(f"  {label:22s} 표본 부족({len(spreads)}일)")
        return
    verdict = "우위 있음" if (t is not None and abs(t) >= 3) else "무작위와 구분 안 됨"
    print(f"  {label:22s} {len(spreads):2d}일 · 일평균 스프레드 {m:+.3f}%p · "
          f"t={t:+.2f}  → {verdict}")


def test_consensus(consensus, days, ret):
    """목표주가 괴리율이 큰 상위 10% vs 하위 10% 의 다음날 수익률 차이.

    주의 — 여기엔 약한 룩어헤드가 있다. 네이버는 목표주가의 '현재값' 만 주고 과거
    시계열을 안 준다. 그래서 60일 전 날짜에도 오늘자 목표주가를 쓴다. 그날 실제로
    알 수 있던 값이 아니다.

    목표주가는 분기에 몇 번 바뀌는 정도라 영향이 크진 않지만, 결과를 부풀리는
    방향으로 작용한다(애널리스트가 주가를 보고 목표가를 고친 뒤라면, 괴리율이
    이미 그 주가 흐름을 알고 있는 셈이다). 그래서 이 검정이 '우위 있음' 으로
    나오더라도 그대로 믿으면 안 된다 — 반대로 '우위 없음' 이면 그건 신뢰할 수 있다.
    """
    spreads = []
    for date in sorted(days):
        rows = []
        for r in days[date]:
            c = consensus.get(r["t"])
            nxt = ret.get(date, {}).get(r["t"])
            if not c or nxt is None or not r["close"]:
                continue
            gap = (c[0] - r["close"]) / r["close"] * 100   # 목표가까지 남은 %
            rows.append((gap, nxt))
        n = int(len(rows) * DECILE)
        if n < MIN_PER_SIDE:
            continue
        rows.sort(key=lambda x: x[0])
        low = statistics.fmean([r[1] for r in rows[:n]])
        high = statistics.fmean([r[1] for r in rows[-n:]])
        spreads.append(high - low)
    m, t = welch_one_sample(spreads)
    if m is None:
        print(f"  {'목표주가 괴리율':22s} 표본 부족({len(spreads)}일)")
        return
    verdict = "우위 있음" if (t is not None and abs(t) >= 3) else "무작위와 구분 안 됨"
    print(f"  {'목표주가 괴리율':22s} {len(spreads):2d}일 · 일평균 스프레드 {m:+.3f}%p · "
          f"t={t:+.2f}  → {verdict}")


def test_reversal(consensus, days, ret, only_consensus: bool):
    """대조군: '최근 5일 하락률' 만으로 같은 검정을 한다.

    괴리율이 큰 종목 = 목표가보다 많이 떨어진 종목 = 최근 급락주다. 그래서 괴리율의
    우위가 사실은 단기 반등(평균회귀)일 수 있다 — 목표주가는 아무 기여도 안 하고
    '많이 떨어졌다' 는 사실만 대신 말해주는 대리변수일 뿐일 가능성.

    이 대조군이 괴리율과 비슷한 t 를 내면, 괴리율은 정보가 없는 것이다.
    """
    closes = {}
    for date, rows in days.items():
        for r in rows:
            closes.setdefault(r["t"], {})[date] = r["close"]
    spreads = []
    for date in sorted(days):
        rows = []
        for r in days[date]:
            if only_consensus and r["t"] not in consensus:
                continue
            nxt = ret.get(date, {}).get(r["t"])
            if nxt is None:
                continue
            m = closes.get(r["t"]) or {}
            ds = sorted(d for d in m if d <= date)
            if len(ds) < 6 or not m[ds[-6]]:
                continue
            drop = (m[date] - m[ds[-6]]) / m[ds[-6]] * 100
            rows.append((-drop, nxt))          # 많이 떨어질수록 큰 값(괴리율과 방향 일치)
        n = int(len(rows) * DECILE)
        if n < MIN_PER_SIDE:
            continue
        rows.sort(key=lambda x: x[0])
        low = statistics.fmean([r[1] for r in rows[:n]])
        high = statistics.fmean([r[1] for r in rows[-n:]])
        spreads.append(high - low)
    m, t = welch_one_sample(spreads)
    label = "[대조] 5일 하락률" + ("(컨센서스 종목만)" if only_consensus else "(전체)")
    if m is None:
        print(f"  {label:22s} 표본 부족({len(spreads)}일)")
        return
    print(f"  {label:22s} {len(spreads):2d}일 · 일평균 스프레드 {m:+.3f}%p · t={t:+.2f}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.parse_args()
    days, consensus, nfiles = load()
    if not days:
        raise SystemExit("[검증] 수급 아카이브가 없다 — collect_kr_flow.py 를 먼저 돌려야 한다.")
    ret = next_close_map(days)
    print(f"[검증] 종목 {nfiles} · 날짜 {len(days)}개 "
          f"({min(days)}~{max(days)}) · 컨센서스 있는 종목 {len(consensus)}")
    print(f"[검증] 상위/하위 {int(DECILE*100)}% 의 다음날 수익률 차이를 일별로 낸 뒤 t 검정")
    test_signal(days, ret, "frn", "외국인 순매수")
    test_signal(days, ret, "org", "기관 순매수")
    test_consensus(consensus, days, ret)
    test_reversal(consensus, days, ret, only_consensus=True)
    test_reversal(consensus, days, ret, only_consensus=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
