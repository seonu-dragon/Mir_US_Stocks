#!/usr/bin/env python3
"""한국 매크로 대시보드 — 한국은행 ECOS Open API (무료, ECOS_API_KEY 필요).

미국의 FRED 매크로 패널(build_macro_indicators.py)의 한국판. 기준금리·국고채
커브·신용스프레드·환율·물가·뉴스심리를 한 줄로 요약한다. 예측이 아니라
현재값과 최근 변화의 상태 요약이다.

  https://ecos.bok.or.kr/api/StatisticSearch/{KEY}/json/kr/1/{n}/{stat}/{cycle}/{from}/{to}/{item}
  시리즈 코드는 2026-08-06 실쿼리로 확인:
    722Y001/D/0101000  한국은행 기준금리(연%)
    817Y002/D/010190000·010200000·010210000  국고채 1·3·10년(일별)
    817Y002/D/010300000  회사채 3년 AA-(일별) → 신용스프레드 = AA- − 국고채3년
    731Y001/D/0000001  원/달러 매매기준율
    901Y009/M/0        소비자물가지수(2020=100) → YoY 계산
    521Y001/D/A001     뉴스심리지수(실험적, 100=중립)
    901Y067/M/I16D·I16E  동행·선행지수 순환변동치(2020=100, 통계청 작성) — 2026-10-23
                       StatisticItemList 로 확인(I16A 선행·I16B 동행·I16C 후행 종합지수, I16D 동행
                       순환변동치, I16E 선행 순환변동치). 경기순환시계(businessCycle)에 쓴다.

경기순환시계: x = 순환변동치 − 100(추세 위·아래), y = 전월 대비 변화. 사분면은 통계청 경기순환시계와
같은 이름 — 상승(추세 위·오름) · 둔화(추세 위·내림) · 하강(추세 아래·내림) · 회복(추세 아래·오름).
통계청 시계의 10개 구성지표 순환변동치는 KOSIS 키가 있어야 해 넣지 않았다(동행·선행 2개만).

산출물: data/korea/ecos_macro.json + .js(window.KR_ECOS_MACRO). 값 없으면 기존
파일 유지(정직성: 지어내지 않는다).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from briefing_store import atomic_write_text  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "korea" / "ecos_macro.json"
OUT_JS = ROOT / "data" / "korea" / "ecos_macro.js"

BASE = "https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/{n}/{stat}/{cycle}/{start}/{end}/{item}"
UA = {"User-Agent": "Mir US Stocks research (dydtjsdn@gmail.com)"}
KST = timezone(timedelta(hours=9))


def kst_now_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def fetch_series(key: str, stat: str, cycle: str, item: str, days: int = 400, n: int = 500) -> list[tuple[str, float]]:
    now = datetime.now(KST)
    if cycle == "D":
        start = (now - timedelta(days=days)).strftime("%Y%m%d")
        end = now.strftime("%Y%m%d")
    else:  # M
        start = (now - timedelta(days=days)).strftime("%Y%m")
        end = now.strftime("%Y%m")
    url = BASE.format(key=key, n=n, stat=stat, cycle=cycle, start=start, end=end, item=item)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode("utf-8"))
    rows = d.get("StatisticSearch", {}).get("row", [])
    out = []
    for row in rows:
        try:
            out.append((row["TIME"], float(row["DATA_VALUE"])))
        except (KeyError, TypeError, ValueError):
            continue
    out.sort(key=lambda x: x[0])
    return out


CYCLE_STAT = "901Y067"
CYCLE_ITEMS = (("coincident", "I16D", "동행지수 순환변동치"), ("leading", "I16E", "선행지수 순환변동치"))
CYCLE_MONTHS = 24


def fetch_rows_paged(key: str, stat: str, cycle: str, start: str, end: str, item: str,
                     page: int = 1000) -> list[tuple[str, float]]:
    """StatisticSearch 를 page 행씩 끝까지 받는다(샘플 키는 한 번에 10행까지라 로컬 확인용)."""
    out, lo, total = [], 1, None
    while total is None or lo <= total:
        url = (f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/{lo}/{lo + page - 1}"
               f"/{stat}/{cycle}/{start}/{end}/{item}")
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode("utf-8"))
        body = d.get("StatisticSearch") or {}
        rows = body.get("row") or []
        if not rows:
            break
        total = int(body.get("list_total_count") or len(rows))
        for row in rows:
            try:
                out.append((str(row["TIME"]), float(row["DATA_VALUE"])))
            except (KeyError, TypeError, ValueError):
                continue
        lo += page
        if lo > 2000:   # 안전 상한(월간 24~30행이면 한 번에 끝난다)
            break
    return sorted(set(out))


def classify_phase(level: float, change: float, prev_dir: int | None = None) -> tuple[str | None, int | None]:
    """순환변동치 수준(100 기준)과 전월 대비 변화로 사분면을 정한다.

    변화 0 이면 직전 방향을 잇는다(없으면 판정 없음). 수준 100 은 추세 위로 본다.
    반환: (국면 이름 | None, 이번 방향 +1/−1 | None)
    """
    d = 1 if change > 0 else -1 if change < 0 else prev_dir
    if d is None:
        return None, None
    above = level >= 100
    if above:
        return ("상승" if d > 0 else "둔화"), d
    return ("회복" if d > 0 else "하강"), d


def cycle_points(series: list[tuple[str, float]], months: int = CYCLE_MONTHS) -> list[dict]:
    """[(YYYYMM, 값)] → 마지막 months 개월의 {t, v, chg, phase}. 첫 달은 변화가 없어 버린다."""
    pts, prev_v, prev_dir = [], None, None
    for t, v in series:
        if prev_v is not None:
            chg = round(v - prev_v, 2)
            phase, prev_dir = classify_phase(v, chg, prev_dir)
            pts.append({"t": f"{t[:4]}-{t[4:6]}", "v": round(v, 2), "chg": chg, "phase": phase})
        prev_v = v
    return pts[-months:]


def build_business_cycle(key: str, page: int = 1000) -> dict | None:
    now = datetime.now(KST)
    start = f"{now.year - 3}{now.month:02d}"   # 24개월 + 변화 계산용 여유
    end = now.strftime("%Y%m")
    out = {}
    for name, item, label in CYCLE_ITEMS:
        rows = fetch_rows_paged(key, CYCLE_STAT, "M", start, end, item, page=page)
        pts = cycle_points(rows)
        if len(pts) >= 6:
            out[name] = {"label": label, "item": item, "points": pts}
    if "coincident" not in out:
        return None
    return {
        "asOf": max(s["points"][-1]["t"] for s in out.values()),
        "source": "한국은행 ECOS (통계청 경기종합지수)",
        "stat": CYCLE_STAT,
        "series": out,
    }


def tile(key: str, label: str, unit: str, series: list[tuple[str, float]],
         tone: str = "neutral", digits: int = 2, change_gap: int = 1,
         change_label: str = "전영업일 대비") -> dict | None:
    if len(series) < change_gap + 1:
        return None
    cur_t, cur_v = series[-1]
    prev_v = series[-1 - change_gap][1]
    return {
        "key": key,
        "label": label,
        "unit": unit,
        "value": round(cur_v, digits),
        "change": round(cur_v - prev_v, digits),
        "changeLabel": change_label,
        "tone": tone,
        "asOf": cur_t,
        "series": [round(v, digits) for _, v in series[-30:]],
    }


def build(key: str) -> dict | None:
    base_rate = fetch_series(key, "722Y001", "D", "0101000")
    ktb1 = fetch_series(key, "817Y002", "D", "010190000", days=120)
    ktb3 = fetch_series(key, "817Y002", "D", "010200000", days=120)
    ktb10 = fetch_series(key, "817Y002", "D", "010210000", days=120)
    corp_aa = fetch_series(key, "817Y002", "D", "010300000", days=120)
    fx = fetch_series(key, "731Y001", "D", "0000001", days=120)
    cpi = fetch_series(key, "901Y009", "M", "0", days=900)
    nsi = fetch_series(key, "521Y001", "D", "A001", days=120)

    tiles = []
    t = tile("baseRate", "한국은행 기준금리", "%", base_rate, digits=2, change_label="직전 대비")
    if t:
        tiles.append(t)
    if ktb3:
        tiles.append(tile("ktb3", "국고채 3년", "%", ktb3))
    if ktb10:
        tiles.append(tile("ktb10", "국고채 10년", "%", ktb10))
    # 장단기 스프레드(10년-1년): 날짜 교집합으로 계산
    if ktb10 and ktb1:
        m1 = dict(ktb1)
        sp = [(d0, v10 - m1[d0]) for d0, v10 in ktb10 if d0 in m1]
        t = tile("ktbSpread", "장단기 스프레드 (10년−1년)", "%p", sp)
        if t:
            tiles.append(t)
    # 신용스프레드(회사채 AA- 3년 − 국고채 3년): 오르면 신용경계 심화(red)
    if corp_aa and ktb3:
        m3 = dict(ktb3)
        sp = [(d0, va - m3[d0]) for d0, va in corp_aa if d0 in m3]
        t = tile("creditSpread", "신용스프레드 (회사채AA− − 국고3년)", "%p", sp, tone="up")
        if t:
            tiles.append(t)
    if fx:
        tiles.append(tile("usdKrw", "원/달러 환율", "원", fx, tone="up", digits=1))
    # CPI YoY: 지수를 12개월 전과 비교
    if len(cpi) >= 13:
        yoy = []
        idx = {d0: v for d0, v in cpi}
        for d0, v in cpi:
            y, m = int(d0[:4]), int(d0[4:6])
            prev_key = f"{y-1}{m:02d}"
            if prev_key in idx and idx[prev_key]:
                yoy.append((d0, (v / idx[prev_key] - 1) * 100))
        t = tile("cpiYoY", "소비자물가 (YoY)", "%", yoy, tone="up", digits=1,
                 change_gap=1, change_label="전월 대비")
        if t:
            tiles.append(t)
    if nsi:
        t = tile("newsSentiment", "뉴스심리지수 (100=중립)", "", nsi, tone="down", digits=1)
        if t:
            tiles.append(t)

    tiles = [x for x in tiles if x]
    if len(tiles) < 5:
        return None
    try:
        cycle = build_business_cycle(key)
    except Exception as e:  # noqa: BLE001 — 부가 블록, 실패하면 숨긴다(지어내지 않음)
        print(f"[ecos] 경기순환시계 실패({type(e).__name__}: {e}) — 블록 생략")
        cycle = None
    payload = {
        "updatedAtKst": kst_now_str(),
        "asOf": max(x["asOf"] for x in tiles),
        "source": "한국은행 ECOS Open API",
        "indicators": tiles,
    }
    if cycle:
        payload["businessCycle"] = cycle
    return payload


def main_cycle_only(key: str) -> int:
    """기존 파일의 businessCycle 블록만 갈아 끼운다(다른 지표 유지). 샘플 키(10행 제한)로도 돈다."""
    try:
        payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"[ecos] 기존 파일 읽기 실패: {e}")
        return 1
    try:
        cycle = build_business_cycle(key, page=10 if key == "sample" else 1000)
    except Exception as e:  # noqa: BLE001
        print(f"[ecos] 경기순환시계 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not cycle:
        print("[ecos] 경기순환시계 값 부족 — 기존 파일 유지")
        return 1
    payload["businessCycle"] = cycle
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_ECOS_MACRO = {compact};\n")
    for s in cycle["series"].values():
        last = s["points"][-1]
        print(f"[ecos] {s['label']}: {last['t']} {last['v']} ({last['chg']:+g}) {last['phase']}")
    return 0


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=== 한국 매크로 수집 (ECOS) ===")
    key = os.environ.get("ECOS_API_KEY", "").strip()
    if not key:
        print("[ecos] ECOS_API_KEY 없음 — 기존 파일 유지")
        return 1
    if "--cycle-only" in sys.argv[1:]:
        return main_cycle_only(key)
    try:
        payload = build(key)
    except Exception as e:  # noqa: BLE001
        print(f"[ecos] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[ecos] 유효 지표 부족 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_ECOS_MACRO = {compact};\n")
    for x in payload["indicators"]:
        print(f"[ecos] {x['label']}: {x['value']}{x['unit']} ({x['change']:+g})")
    cyc = payload.get("businessCycle")
    if cyc:
        for s in cyc["series"].values():
            last = s["points"][-1]
            print(f"[ecos] {s['label']}: {last['t']} {last['v']} ({last['chg']:+g}) {last['phase']}")
    print(f"{len(payload['indicators'])}개 지표 → {OUT_JSON.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
