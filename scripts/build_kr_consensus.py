#!/usr/bin/env python3
"""국내 애널리스트 컨센서스 — FnGuide 컨센서스(네이버 금융 경유) + 증권사 리포트 원문.

무엇을 만드나:
  data/korea/consensus.{json,js}   종목별 목표주가·투자의견·추정기관수·추정 실적 + 최근 리포트

## 소스

두 경로 모두 FnGuide 가 집계한 같은 컨센서스이고, 인증 없이 공개된다.

  1. m.stock.naver.com/api/stock/{code}/integration   (JSON, 종목당 ~10KB)
     consensusInfo = {recommMean, priceTargetMean, createDate} + totalInfos 의 cnsEps/cnsPer.
     researches = 네이버가 노출하는 최근 리포트 목록(최대 5건, 증권사·작성일·리포트 id).
  2. navercomp.wisereport.co.kr/v2/company/c1010001.aspx   (HTML, 종목당 ~83KB)
     '투자의견 컨센서스' 표(cTB15)에만 있는 **추정기관수**를 여기서 가져온다.
     목표주가는 1번과 같은 값이라 교차검증용으로만 쓴다(1% 넘게 어긋나면 추정기관수를
     버린다). EPS 는 화면 값이 12개월 forward 인지 회계연도 추정인지 표기가 없어(종근당
     2026-07-23: 화면 4,864 vs finance/annual 2026.12 추정 4,564) 쓰지 않는다 —
     epsEstimate 는 회계연도가 명시되는 3번 경로만 쓰고 estimateFy 를 같이 싣는다.
  3. m.stock.naver.com/api/research/company/{id}       (JSON)
     리포트 원문의 opinion / goalPrice / priceAtWriteDate. 컨센서스 평균이 실제
     증권사 목표가와 맞는지 사람이 눈으로 확인할 수 있는 1차 자료다.

거른 소스:
  - 한경컨센서스(consensus.hankyung.com): 리포트 목록·PDF 배포용이라 종목별 집계값이
    없다. 목표가를 얻으려면 PDF 를 파싱해야 하고 종목 커버리지도 리포트가 나온 종목뿐.
  - comp.fnguide.com: navercomp.wisereport 와 같은 FnGuide 화면인데 네이버 경유본이
    이미 이 레포에서 쓰는 호스트라 굳이 추가하지 않는다.
  - Finnhub 무료 티어: 한국 종목 미지원(US 전용).

## prevGoalPrice 는 '직전 목표가'가 아니다

리포트 원문 API 의 prevGoalPrice 는 검사한 모든 표본에서 priceAtWriteDate 와 값이
같았다(삼성전자 하나증권 296000/296000, 고려아연 신한 1701000/1701000 …). 이름과 달리
직전 목표주가가 아니라 작성일 종가로 보인다. 뜻이 모호한 필드는 싣지 않는다.

## 목표주가를 싣는 근거 (build_kr_investor_flow.py 의 판단을 뒤집는다)

투자수급 빌더는 "네이버 목표가가 현재가와 안 맞는다"며 목표주가를 뺐다. 다시 재보니
숫자 자체는 틀린 게 아니라 **국내 셀사이드 목표가가 원래 그렇게 높다**. 1차 자료로
확인한다(2026-07-23 기준 컨센서스 vs 개별 리포트 원문):

    삼성전자   컨센 513,958 / 24곳   ← 하나 480,000 · 대신 560,000 · 유진 560,000
                                        · iM 480,000 · IBK 460,000 (평균 508,000)
    알테오젠   컨센 537,500 /  4곳   ← 하나 580,000 · 대신 500,000 · 신한 620,000
    고려아연   컨센 1,689,500 / 4곳  ← 신한 1,600,000 · iM 1,950,000

개별 리포트 평균과 컨센서스가 일치한다. 괴리가 커 보이는 건 집계 오류가 아니라
(가) 국내 목표주가가 구조적으로 낙관적이고 (나) 주가가 급락한 종목의 컨센서스는
과거 리포트 기준이라 낡아서다. 콘텐트리중앙(컨센 11,875 vs 주가 1,657)은 마지막
리포트가 2026-05-11 이고 그때 종가가 5,750 이었다.

그래서 지어내지 않고 **판단 재료를 같이 싣는다**: estimateCount(추정기관수 1곳이면
사실상 개별 의견), lastReportDate(컨센서스가 언제 것인지), reports(증권사별 목표가와
작성일 종가). 이 셋 없이 upsidePct 만 보여주는 건 하지 말 것.

## 산출물 규약

  updatedAtKst  실행 시각, "%Y-%m-%d %H:%M KST"
  asOf          FnGuide 컨센서스 기준일(종목별로도 stocks[*].asOf 로 들어간다)
  priceAsOf     price·upsidePct·perEstimate 계산에 쓴 커밋된 KR 스냅샷의 updatedAtKst
                (실시간 조회는 하지 않는다 — 브라우저는 커밋된 스냅샷만 읽는 레포다)
  units         금액 단위(목표가·EPS 는 원, 매출·영업이익 추정치는 억원)

값이 하나도 안 모이면 기존 파일을 덮지 않고 exit 1. 이번 실행에서 못 받은 종목은
sec_client.merge_previous_stocks 로 직전 값을 유지하고, 종목은 받았는데 보조 단계만
실패한 경우는 carry_stage_fields 가 reports·estimateCount 를 이어붙인다(부분 실패에
종목도 필드도 깜빡이지 않게).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = timezone(timedelta(hours=9))
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "consensus.json"
OUT_JS = ROOT / "data" / "korea" / "consensus.js"

NAVER_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://m.stock.naver.com/",
}
FNG_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "text/html",
    "Referer": "https://finance.naver.com/",
}

# update_korea_data._naver_throttle 과 같은 정책 — 스레드 수와 무관하게 총 요청률을
# 묶는다. 동시성이 높으면 네이버가 한동안 IP 를 막고 응답이 통째로 비어 온다.
_MIN_INTERVAL = 0.10          # ~10 req/s (모든 스레드·모든 호스트 합산)
_throttle_lock = threading.Lock()
_next_at = [0.0]

REPORT_WINDOW_DAYS = 180      # 이보다 오래된 리포트는 원문을 굳이 안 받는다
MAX_REPORTS = 3               # 종목당 저장할 리포트 수

# 리포트 원문 opinion 문자열 → 5점 척도(FnGuide 투자의견 컨센서스와 같은 방향).
OPINION_CODES = {
    "strongbuy": 5, "적극매수": 5, "강력매수": 5, "strong buy": 5,
    "buy": 4, "매수": 4, "outperform": 4, "overweight": 4, "비중확대": 4,
    "hold": 3, "중립": 3, "보유": 3, "neutral": 3, "marketperform": 3, "market perform": 3,
    "underweight": 2, "비중축소": 2, "underperform": 2,
    "sell": 1, "매도": 1, "reduce": 1,
}
_unmapped_opinions: set[str] = set()


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def throttle() -> None:
    with _throttle_lock:
        now = time.monotonic()
        wait = _next_at[0] - now
        if wait > 0:
            time.sleep(wait)
            now = time.monotonic()
        _next_at[0] = now + _MIN_INTERVAL


def _open(url: str, headers: dict, tries: int = 3) -> bytes | None:
    for attempt in range(tries):
        throttle()
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (404, 400):
                return None       # 상장폐지·비대상 — 재시도 의미 없다
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
        except Exception:
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
    return None


def get_json(url: str):
    raw = _open(url, NAVER_HEADERS)
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except ValueError:
        return None


def num(value):
    """'513,958' / '46,664원' / '5.34배' / 'N/A' / '-' → float | None."""
    if value is None:
        return None
    text = str(value).strip()
    text = text.replace(",", "").replace("원", "").replace("배", "").replace("%", "").replace("+", "")
    if not text or text in ("-", "N/A", "NA", "nan"):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def ymd(value) -> str | None:
    """'20260708' → '2026-07-08'."""
    text = str(value or "").strip()
    if len(text) == 8 and text.isdigit():
        return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
    return None


def days_since(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=KST)
    except ValueError:
        return None
    return (datetime.now(KST) - d).days


# ---------------------------------------------------------------- 1) 컨센서스 본체

def fetch_consensus(code: str) -> dict | None:
    """네이버 모바일 integration → 컨센서스 + 최근 리포트 목록."""
    data = get_json(f"https://m.stock.naver.com/api/stock/{code}/integration")
    if not isinstance(data, dict):
        return None
    info = data.get("consensusInfo") or {}
    target = num(info.get("priceTargetMean"))
    opinion = num(info.get("recommMean"))
    totals = {}
    for item in data.get("totalInfos") or []:
        if isinstance(item, dict) and item.get("code"):
            totals[item["code"]] = item.get("value")

    rec: dict = {}
    if target and target > 0:
        rec["targetPrice"] = round(target)
    if opinion:
        rec["opinionScore"] = round(opinion, 2)
    as_of = str(info.get("createDate") or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", as_of):
        rec["asOf"] = as_of
    eps = num(totals.get("cnsEps"))
    if eps is not None:
        rec["epsEstimate"] = round(eps)
    # cnsPer 는 네이버가 '조회 시점 실시간 주가'로 나눈 값이라 커밋된 스냅샷과 어긋난다.
    # 그대로 싣지 않고 아래에서 스냅샷 주가로 다시 계산한다.

    pending = []
    for item in data.get("researches") or []:
        date = ymd(item.get("wdt"))
        if not date or not item.get("id"):
            continue
        pending.append({"id": item["id"], "date": date, "broker": str(item.get("bnm") or "").strip()})
    pending.sort(key=lambda r: r["date"], reverse=True)
    if pending:
        rec["lastReportDate"] = pending[0]["date"]
    return {"rec": rec, "pending": pending} if (rec or pending) else None


# ------------------------------------------------------- 2) 추정기관수(FnGuide 표)

_CTB15 = re.compile(r'id="cTB15".*?</table>', re.S)
_TD = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
_TAG = re.compile(r"<[^>]+>")


def fetch_estimate_count(code: str) -> dict | None:
    """navercomp.wisereport '투자의견 컨센서스' 표 → 추정기관수(+교차검증용 목표가).

    표 셀 순서: [게이지값, 투자의견, 목표주가, EPS, PER, 추정기관수].
    """
    raw = _open(f"https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd={code}", FNG_HEADERS)
    if not raw:
        return None
    html = raw.decode("utf-8", "replace")
    block = _CTB15.search(html)
    if not block:
        return None
    cells = []
    for cell in _TD.findall(block.group(0)):
        text = re.sub(r"\s+", "", _TAG.sub("", cell)).replace("&nbsp;", "")
        if text:
            cells.append(text)
    if len(cells) < 5:
        return None
    opinion, target, eps, _per, count = cells[-5:]
    n = num(count)
    if n is None or n <= 0:
        return None
    return {
        "estimateCount": int(n),
        "_target": num(target),
        "_opinion": num(opinion),
        "_eps": num(eps),
    }


# ------------------------------------------------- 3) 추정 매출액·영업이익(컨센서스 연도)

def fetch_forward_financials(code: str) -> dict | None:
    """네이버 finance/annual 의 isConsensus=Y 컬럼 → 추정 매출액·영업이익·EPS."""
    data = get_json(f"https://m.stock.naver.com/api/stock/{code}/finance/annual")
    info = (data or {}).get("financeInfo") or {}
    titles = info.get("trTitleList") or []
    rows = info.get("rowList") or []
    forward = [t for t in titles if t.get("isConsensus") == "Y" and t.get("key")]
    if not forward or not rows:
        return None
    col = forward[-1]

    def value(title):
        for row in rows:
            if row.get("title") == title:
                return num(((row.get("columns") or {}).get(col["key"]) or {}).get("value"))
        return None

    out: dict = {}
    revenue = value("매출액")
    operating = value("영업이익")
    eps = value("EPS")
    if revenue is not None:
        out["revenueEstimate"] = round(revenue)          # 억원
    if operating is not None:
        out["operatingEstimate"] = round(operating)      # 억원
    if eps is not None:
        out["epsEstimate"] = round(eps)                  # 원
    if not out:
        return None
    out["estimateFy"] = str(col.get("title") or col.get("key")).rstrip(".")
    return out


# ------------------------------------------------------------- 4) 증권사 리포트 원문

def fetch_report(entry: dict) -> dict | None:
    data = get_json(f"https://m.stock.naver.com/api/research/company/{entry['id']}")
    content = (data or {}).get("researchContent") or {}
    goal = num(content.get("goalPrice"))
    raw_opinion = str(content.get("opinion") or "").strip()
    if goal is None and not raw_opinion:
        return None
    out = {"date": entry["date"], "broker": entry["broker"] or str(content.get("brokerName") or "")}
    if goal and goal > 0:
        out["target"] = round(goal)
    # prevGoalPrice 는 작성일 종가와 값이 같다(모호) — priceAtWriteDate 만 싣는다.
    at_write = num(content.get("priceAtWriteDate"))
    if at_write and at_write > 0:
        out["priceAtWrite"] = round(at_write)
    if raw_opinion and raw_opinion not in ("없음", "N/A", "-"):
        out["opinion"] = raw_opinion
        code = OPINION_CODES.get(raw_opinion.lower())
        if code:
            out["opinionCode"] = code
        else:
            _unmapped_opinions.add(raw_opinion)
    return out if len(out) > 2 else None


# ------------------------------------------------------------------------- 빌드

def load_universe(top: int) -> tuple[list[dict], str]:
    snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [s for s in (snap.get("stocks") or [])
              if s.get("ticker") and s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0,
                reverse=True)
    return stocks[:top], str(snap.get("updatedAtKst") or "")


def run_pool(func, items, workers: int):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(func, items))


def build(top: int, reports_top: int, workers: int, with_counts: bool, with_reports: bool) -> dict | None:
    universe, price_as_of = load_universe(top)
    if not universe:
        print("[컨센서스] KR 스냅샷 종목이 비어 있다 — 중단")
        return None
    prices = {str(s["ticker"]).zfill(6): s.get("price") for s in universe}
    codes = [str(s["ticker"]).zfill(6) for s in universe]
    print(f"[컨센서스] 대상 {len(codes)}종목 · 총 {1 / _MIN_INTERVAL:.0f} req/s 상한")

    t0 = time.time()
    stage1 = run_pool(fetch_consensus, codes, workers)
    stocks: dict[str, dict] = {}
    pending: dict[str, list] = {}
    for code, result in zip(codes, stage1):
        if not result:
            continue
        rec = result["rec"]
        if rec.get("targetPrice") or rec.get("opinionScore"):
            stocks[code] = rec
        if result["pending"]:
            pending[code] = result["pending"]
    print(f"  1/4 컨센서스 {len(stocks)}/{len(codes)}종목 ({time.time() - t0:.0f}초)")
    if not stocks:
        return None

    have = [c for c in codes if c in stocks]

    if with_counts:
        counts = run_pool(fetch_estimate_count, have, workers)
        ok = mismatch = 0
        for code, result in zip(have, counts):
            if not result:
                continue
            target = stocks[code].get("targetPrice")
            fng = result.get("_target")
            # 같은 FnGuide 집계라 값이 같아야 한다. 어긋나면 추정기관수를 버린다.
            if target and fng and abs(fng - target) > max(1.0, target * 0.01):
                mismatch += 1
                continue
            stocks[code]["estimateCount"] = result["estimateCount"]
            ok += 1
        print(f"  2/4 추정기관수 {ok}/{len(have)}종목 (교차검증 불일치 {mismatch}건, {time.time() - t0:.0f}초)")

    fwd = run_pool(fetch_forward_financials, have, workers)
    got = 0
    for code, result in zip(have, fwd):
        if not result:
            continue
        stocks[code].update(result)
        got += 1
    print(f"  3/4 추정 실적 {got}/{len(have)}종목 ({time.time() - t0:.0f}초)")

    if with_reports:
        targets = []
        for code in have[:reports_top]:
            fresh = [e for e in pending.get(code, [])
                     if (days_since(e["date"]) or 9999) <= REPORT_WINDOW_DAYS][:MAX_REPORTS]
            for entry in fresh:
                targets.append((code, entry))
        results = run_pool(lambda pair: fetch_report(pair[1]), targets, workers)
        by_code: dict[str, list] = {}
        for (code, _entry), result in zip(targets, results):
            if result:
                by_code.setdefault(code, []).append(result)
        for code, reports in by_code.items():
            stocks[code]["reports"] = sorted(reports, key=lambda r: r["date"], reverse=True)
        print(f"  4/4 리포트 원문 {len(targets)}건 요청 → {sum(len(v) for v in by_code.values())}건 "
              f"({len(by_code)}종목, {time.time() - t0:.0f}초)")

    # 현재가·상승여력은 **커밋된 스냅샷**에서만 계산한다(실시간 조회 금지).
    upsides = []
    for code, rec in stocks.items():
        price = prices.get(code)
        if not isinstance(price, (int, float)) or price <= 0:
            continue
        rec["price"] = round(price)
        target = rec.get("targetPrice")
        if target:
            rec["upsidePct"] = round((target / price - 1) * 100, 1)
            upsides.append(rec["upsidePct"])
        eps = rec.get("epsEstimate")
        if isinstance(eps, (int, float)) and eps > 0:
            rec["perEstimate"] = round(price / eps, 2)

    as_of_counts: dict[str, int] = {}
    for rec in stocks.values():
        if rec.get("asOf"):
            as_of_counts[rec["asOf"]] = as_of_counts.get(rec["asOf"], 0) + 1
    as_of = max(as_of_counts, key=as_of_counts.get) if as_of_counts else None

    payload = {
        "updatedAtKst": now_kst(),
        "source": "FnGuide 컨센서스(네이버 금융 m.stock / navercomp.wisereport) + 네이버 증권사 리포트",
        "count": len(stocks),
        "universe": len(codes),
    }
    if as_of:
        payload["asOf"] = as_of
    if price_as_of:
        payload["priceAsOf"] = price_as_of
    payload["units"] = {
        "targetPrice": "원", "price": "원", "epsEstimate": "원",
        "revenueEstimate": "억원", "operatingEstimate": "억원",
    }
    payload["opinionScale"] = "1=매도 · 2=비중축소 · 3=중립 · 4=매수 · 5=적극매수"
    if upsides:
        payload["medianUpsidePct"] = round(sorted(upsides)[len(upsides) // 2], 1)
    payload["note"] = (
        "국내 셀사이드 목표주가는 구조적으로 현재가보다 높다(이번 실행 중앙값 "
        f"{payload.get('medianUpsidePct', '-')}%). upsidePct 만 단독으로 쓰지 말 것 — "
        "estimateCount(추정기관수)가 1~2곳이면 사실상 개별 의견이고, lastReportDate 가 "
        "오래된 종목은 컨센서스가 그때 주가 기준이라 낡았다. reports 의 priceAtWrite 로 "
        "작성 당시 주가와 비교할 수 있다."
    )
    payload["stocks"] = stocks
    return payload


def carry_stage_fields(payload: dict) -> None:
    """종목은 받았는데 보조 단계(2·4)만 실패했을 때 이전 값을 채운다.

    merge_previous_stocks 는 '이번에 못 받은 종목' 만 살린다. 1단계는 됐는데
    wisereport 가 죽어 추정기관수가 통째로 빠지면, 종목은 남는데 필드만 사라져
    화면에서 신뢰도 표시가 조용히 없어진다. 되살려도 거짓이 아닌 것만 채운다:

      reports        리포트는 작성일이 박힌 사실이라 언제 담아도 그 날짜 것이다.
      estimateCount  컨센서스 기준일(asOf)이 이전 실행과 같을 때만 — 기준일이 바뀌면
                     추정기관수도 바뀔 수 있으니 넘기지 않는다.
    """
    try:
        if not OUT_JSON.exists():
            return
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8")).get("stocks") or {}
    except Exception as exc:  # noqa: BLE001
        print(f"[컨센서스] 이전 필드 승계 생략: {exc}")
        return
    filled = 0
    for code, rec in (payload.get("stocks") or {}).items():
        old = prev.get(code)
        if not isinstance(old, dict):
            continue
        if "reports" not in rec and old.get("reports"):
            rec["reports"] = old["reports"]
            filled += 1
        if ("estimateCount" not in rec and old.get("estimateCount")
                and old.get("asOf") and old.get("asOf") == rec.get("asOf")):
            rec["estimateCount"] = old["estimateCount"]
            filled += 1
    if filled:
        print(f"[컨센서스] 보조 단계 결측 {filled}개 필드는 이전 값 승계")


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="KR 애널리스트 컨센서스(FnGuide/네이버)")
    ap.add_argument("--top", type=int, default=800, help="시총 상위 N 종목")
    ap.add_argument("--limit", type=int, default=None, help="--top 을 더 줄인다(테스트용)")
    ap.add_argument("--reports-top", type=int, default=300, help="리포트 원문을 받을 상위 N 종목")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--no-estimate-count", action="store_true", help="추정기관수 수집 생략")
    ap.add_argument("--no-reports", action="store_true", help="리포트 원문 수집 생략")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    if not KR_SNAPSHOT.exists():
        print(f"[컨센서스] KR 스냅샷 없음({KR_SNAPSHOT}) — 기존 파일 유지")
        return 1
    top = min(args.top, args.limit) if args.limit else args.top

    t0 = time.time()
    try:
        payload = build(top, args.reports_top, args.workers,
                        not args.no_estimate_count, not args.no_reports)
    except Exception as exc:  # noqa: BLE001
        print(f"[컨센서스] 수집 실패({type(exc).__name__}: {exc}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[컨센서스] 유효 데이터 0건 — 기존 파일을 덮지 않는다")
        return 1
    if _unmapped_opinions:
        print(f"[컨센서스] 매핑 안 된 투자의견 문자열: {sorted(_unmapped_opinions)}")

    from sec_client import merge_previous_stocks
    payload = merge_previous_stocks(payload, OUT_JSON, "컨센서스")
    carry_stage_fields(payload)
    payload["count"] = len(payload["stocks"])
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    atomic_write_text(OUT_JS, "window.KR_CONSENSUS = " + text + ";\n")
    print(f"[컨센서스] {payload['count']}종목 · {len(text) / 1024:.0f}KB · {(time.time() - t0) / 60:.1f}분")
    print(f"Wrote {OUT_JSON.name}, {OUT_JS.name}")

    if args.push:
        import sec_client as sec
        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/consensus.json", "data/korea/consensus.js"],
                "KR analyst consensus",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
