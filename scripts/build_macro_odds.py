#!/usr/bin/env python3
"""예측시장 확률(Kalshi · Polymarket) + 침체 신호 모음 — 매크로 컨텍스트.

두 가지를 한 파일로 낸다(시장 탭 › 시그널의 '예측시장 · 침체 신호' 위젯이 읽는다).

1) 예측시장 확률 — 투자자에게 의미 있는 매크로 시장만 큐레이션한다.
   - 주제: 다음 FOMC 금리 결정 · 미국 경기침체(올해) · 미국 CPI(다음 발표) · 한국은행 금리 결정.
   - 시장 ID 를 하드코딩하지 않는다. Kalshi 는 Economics 시리즈 목록을 제목으로 검색해
     시리즈를 찾고, 그 시리즈의 열린 시장 중 가장 가까운 이벤트를 고른다. Polymarket 은
     gamma-api public-search 로 찾은 이벤트를 슬러그 패턴으로 거른다.
   - 찾은 시장의 제목·마감일·거래량·유동성(Kalshi 는 미결제약정)·판정 기준 원문을 같이
     저장하고, 유동성이 기준 미만인 이벤트는 표시하지 않는다(제외 사유를 excluded 에 남김).
   - 최근 30일 일별 가격 추이(Kalshi candlesticks · Polymarket CLOB prices-history).
   - 값은 참여자 베팅으로 형성된 가격이다. 예측의 정답이 아니며 매매 신호도 아니다.

   API(키 없음, 2026-09-25 실제 호출로 형식 확인):
     Kalshi   https://api.elections.kalshi.com/trade-api/v2/series?category=Economics
              .../markets?series_ticker=<S>&status=open&limit=200
              .../series/<S>/markets/<T>/candlesticks?start_ts&end_ts&period_interval=1440
              (liquidity_dollars 는 0 으로만 와서 미결제약정 open_interest_fp 로 유동성을 본다 —
               계약 1개 = $1 명목)
     Polymarket https://gamma-api.polymarket.com/public-search?q=...&events_status=active
              https://clob.polymarket.com/prices-history?market=<yes토큰>&interval=1m&fidelity=1440
              (한국 IP 는 HTTP 451 로 막힌다 — Actions(미국 러너)에서는 열린다. 실패하면
               Polymarket 만 빠지고 Kalshi 로 발행한다.)

2) 침체 신호 모음 — 새 수집 없이 data/industry_indicators.json(산업 지표 빌더)의 값을
   재사용한다. 각 지표의 현재값·공식(또는 발표 기관·원 논문이 쓰는) 임계값·초과 여부·기준
   시각만 나란히 둔다. **합성 점수는 만들지 않는다** — "N개 중 M개 임계 초과" 만 센다.
   임계가 공인되지 않은 지표(GZ 침체확률 등)는 값만 보여 주고 개수에서 뺀다.

산출물: data/macro_odds.json + data/macro_odds.js(window.MACRO_ODDS).
두 예측시장이 모두 실패하면 기존 파일을 유지하고 exit 1.

사용: py scripts/build_macro_odds.py [--push]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from briefing_store import repository_publish_lock  # noqa: E402
import sec_client as sec  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "macro_odds.json"
OUT_JS = ROOT / "data" / "macro_odds.js"
INDUSTRY_JSON = ROOT / "data" / "industry_indicators.json"

KST = timezone(timedelta(hours=9))
UA = {"User-Agent": "Mozilla/5.0 (Mir US Stocks research; dydtjsdn@gmail.com)", "Accept": "application/json"}
KALSHI = "https://api.elections.kalshi.com/trade-api/v2"
GAMMA = "https://gamma-api.polymarket.com"
CLOB = "https://clob.polymarket.com"
HISTORY_DAYS = 30

# 유동성 하한. 이 아래 이벤트는 가격이 몇 건의 소액 주문으로 움직여 '시장 확률' 로 부를 수 없다.
#  - Kalshi: 이벤트 전체 미결제약정(계약, ≈$ 명목)과 누적 거래량(계약).
#  - Polymarket: 이벤트 호가 유동성($)과 누적 거래량($).
KALSHI_MIN_EVENT_OI = 5000
KALSHI_MIN_EVENT_VOLUME = 10000
POLY_MIN_EVENT_LIQUIDITY = 10000
POLY_MIN_EVENT_VOLUME = 25000
# CPI 처럼 행사가 사다리인 시장은 행사가별로도 거른다(OI 가 몇 계약뿐인 끝자락 제외).
KALSHI_MIN_STRIKE_OI = 200
POLY_MIN_STRIKE_LIQUIDITY = 500
# 사다리에서 사실상 결판난 행사가(3% 미만·97% 초과)는 뺀다 — 정보가 없고 줄만 늘린다.
LADDER_MIN, LADDER_MAX = 0.03, 0.97

TOPICS = {
    "fomc": {"title": "다음 FOMC 금리 결정", "region": "us"},
    "recession": {"title": "미국 경기침체", "region": "us"},
    "cpi": {"title": "미국 CPI 상승률 (다음 발표)", "region": "us"},
    "bok": {"title": "한국은행 기준금리 결정", "region": "kr"},
}


def kst_now() -> datetime:
    return datetime.now(KST)


def get_json(url: str, label: str):
    raw = sec.http_get_with_backoff(url, headers=UA, timeout=30, retries=3, label=label)
    return json.loads(raw.decode("utf-8", "replace"))


def fnum(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None  # NaN 제외


def parse_iso(s):
    if not isinstance(s, str) or not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def short_rule(text, limit=420):
    """판정 기준 원문(영문) — 앞 문단부터 이어 붙여 limit 자까지. 'either of the following:'
    처럼 첫 줄만으로는 뜻이 안 서는 문구가 있어(Polymarket 침체) 줄 단위로 채운다."""
    if not isinstance(text, str):
        return ""
    out = ""
    for line in (x.strip() for x in text.strip().splitlines()):
        if not line:
            continue
        nxt = (out + " " + line).strip()
        if len(nxt) > limit:
            if not out:
                out = line[: limit - 1].rstrip() + "…"
            else:
                out += " …"
            break
        out = nxt
    return out


# ---------------------------------------------------------------------------
# 결과 라벨 정규화 — 두 거래소의 표기를 같은 코드로 묶는다(화면은 한국어 라벨).
RATE_LABELS = {
    "cut_big": "0.5%p 이상 인하", "cut": "0.25%p 인하", "hold": "동결",
    "hike": "0.25%p 인상", "hike_big": "0.5%p 이상 인상",
}
RATE_ORDER = ["cut_big", "cut", "hold", "hike", "hike_big"]


def rate_outcome_code(label: str):
    """'Fed maintains rate'·'No change'·'Cut 25bps'·'50+ bps decrease'·'Hike more than 25bps' → 코드."""
    s = (label or "").lower()
    if any(k in s for k in ("maintain", "no change", "unchanged", "hold")):
        return "hold"
    big = bool(re.search(r">\s*25|50\s*\+|more than 25|(^|\D)(50|75|100)(\D|$)", s))
    if any(k in s for k in ("cut", "decrease", "lower")):
        return "cut_big" if big else "cut"
    if any(k in s for k in ("hike", "increase", "raise")):
        return "hike_big" if big else "hike"
    return None


def cpi_strike(label: str):
    """'Above 3.7%' / '3.7%' / '≥3.7%' → (3.7, 'above'|'below'|'exact')."""
    s = (label or "").replace(",", ".")
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*%", s)
    if not m:
        return None, None
    v = float(m.group(1))
    low = s.lower()
    if re.search(r"above|more than|over|higher|≥|>=|>|or more|\+", low):
        return v, "above"
    if re.search(r"below|less than|under|lower|≤|<=|<|or less", low):
        return v, "below"
    return v, "exact"


def cpi_label(v, kind):
    if v is None:
        return None
    if kind == "above":
        return f"{v:.1f}% 초과"
    if kind == "below":
        return f"{v:.1f}% 미만"
    return f"정확히 {v:.1f}%"


# ---------------------------------------------------------------------------
# Kalshi
def kalshi_series_index():
    d = get_json(f"{KALSHI}/series?category=Economics", "kalshi series")
    return d.get("series") or []


# 시리즈 검색 규칙: 제목 정규식 + (있으면) 태그. 같은 제목의 옛 시리즈(KX 접두 없음)가 함께
# 나오므로 열린 시장이 있는 쪽을 쓴다.
KALSHI_SERIES_QUERY = {
    "fomc": (r"^fed meeting$", "fed"),
    "recession": (r"^recession$", None),
    "cpi": (r"^inflation$", None),
    "bok": (r"bank of korea.*(rate|decision)", None),
}


def kalshi_open_markets(series_ticker):
    out, cursor = [], ""
    for _ in range(5):
        q = {"series_ticker": series_ticker, "status": "open", "limit": 200}
        if cursor:
            q["cursor"] = cursor
        d = get_json(f"{KALSHI}/markets?{urllib.parse.urlencode(q)}", f"kalshi {series_ticker}")
        out.extend(d.get("markets") or [])
        cursor = d.get("cursor") or ""
        if not cursor:
            break
    return out


MID_MAX_SPREAD = 0.05


def pick_price(bid, ask, last):
    """확률 표시값: 호가 스프레드가 5%p 이하면 중간값, 아니면 최근 체결가.

    최근 체결가만 쓰면 거래가 뜸한 행사가가 몇 주 전 값에 멈춰 사다리가 뒤집힌다
    (2026-09-25 실측: CPI 3.3% 초과 0.88 < 3.4% 초과 0.96)."""
    if bid is not None and ask is not None and 0 < ask and ask - bid <= MID_MAX_SPREAD and bid > 0:
        return round((bid + ask) / 2, 4)
    return last


def kalshi_history(series_ticker, ticker):
    now = int(time.time())
    q = urllib.parse.urlencode({"start_ts": now - (HISTORY_DAYS + 1) * 86400, "end_ts": now, "period_interval": 1440})
    try:
        d = get_json(f"{KALSHI}/series/{series_ticker}/markets/{ticker}/candlesticks?{q}", f"kalshi hist {ticker}")
    except Exception as exc:  # noqa: BLE001 — 추이는 부가 정보, 실패해도 본값은 낸다
        print(f"  [kalshi] 추이 실패 {ticker}: {type(exc).__name__}")
        return []
    hist = []
    for c in d.get("candlesticks") or []:
        ts = c.get("end_period_ts")
        price = c.get("price") or {}
        last = fnum(price.get("close_dollars"))
        if last is None:
            last = fnum(price.get("previous_dollars"))
        p = pick_price(fnum((c.get("yes_bid") or {}).get("close_dollars")),
                       fnum((c.get("yes_ask") or {}).get("close_dollars")), last)
        if ts and p is not None:
            hist.append({"d": datetime.fromtimestamp(int(ts), KST).strftime("%Y-%m-%d"), "p": round(p, 4)})
    return hist[-HISTORY_DAYS:]


def kalshi_pick_event(topic, markets, now):
    events = {}
    for m in markets:
        events.setdefault(m.get("event_ticker"), []).append(m)
    cands = []
    for et, ms in events.items():
        close = min((parse_iso(m.get("close_time")) for m in ms if parse_iso(m.get("close_time"))), default=None)
        if not close or close <= now:
            continue
        cands.append((close, et, ms))
    if not cands:
        return None
    if topic == "recession":
        # '올해' 우선 — 이벤트 티커 끝 두 자리가 연도(KXRECSSNBER-26).
        yy = now.strftime("%y")
        same = [c for c in cands if str(c[1]).endswith("-" + yy)]
        if same:
            return same[0]
    cands.sort(key=lambda c: c[0])
    return cands[0]


def kalshi_topic(topic, series_list, now, excluded):
    pattern, tag = KALSHI_SERIES_QUERY[topic]
    matches = [s for s in series_list if re.search(pattern, (s.get("title") or "").strip(), re.I)]
    if tag:
        tagged = [s for s in matches if any(tag in (t or "").lower() for t in (s.get("tags") or []))]
        matches = tagged or matches
    matches.sort(key=lambda s: 0 if str(s.get("ticker", "")).startswith("KX") else 1)
    for s in matches:
        st = s.get("ticker")
        markets = kalshi_open_markets(st)
        if not markets:
            continue
        picked = kalshi_pick_event(topic, markets, now)
        if not picked:
            continue
        close, et, ms = picked
        oi = sum(fnum(m.get("open_interest_fp")) or 0 for m in ms)
        vol = sum(fnum(m.get("volume_fp")) or 0 for m in ms)
        if oi < KALSHI_MIN_EVENT_OI or vol < KALSHI_MIN_EVENT_VOLUME:
            excluded.append({"venue": "Kalshi", "topic": topic, "event": et, "title": ms[0].get("title"),
                             "reason": f"유동성 부족(미결제약정 {oi:,.0f} · 거래량 {vol:,.0f} 계약)"})
            return None
        return kalshi_group(topic, st, et, ms, close, oi, vol)
    return None


def kalshi_group(topic, series_ticker, event_ticker, ms, close, oi, vol):
    outcomes = []
    for m in ms:
        last = fnum(m.get("last_price_dollars"))
        bid, ask = fnum(m.get("yes_bid_dollars")), fnum(m.get("yes_ask_dollars"))
        moi = fnum(m.get("open_interest_fp")) or 0
        mvol = fnum(m.get("volume_fp")) or 0
        sub = m.get("yes_sub_title") or m.get("subtitle") or ""
        prob = pick_price(bid, ask, last)
        o = {"ticker": m.get("ticker"), "raw": sub, "prob": prob, "bid": bid, "ask": ask,
             "volume": round(mvol), "openInterest": round(moi)}
        if topic in ("fomc", "bok"):
            code = rate_outcome_code(sub) or rate_outcome_code(m.get("title") or "")
            if not code:
                continue
            o["code"], o["label"] = code, RATE_LABELS[code]
        elif topic == "cpi":
            v, kind = cpi_strike(sub)
            if v is None or moi < KALSHI_MIN_STRIKE_OI or prob is None or not (LADDER_MIN <= prob <= LADDER_MAX):
                continue
            o["strike"], o["kind"], o["label"] = v, kind, cpi_label(v, kind)
        else:  # recession — 단일 Yes/No
            o["label"] = "예(Yes)"
        outcomes.append(o)
    if not outcomes:
        return None
    if topic in ("fomc", "bok"):
        outcomes.sort(key=lambda o: RATE_ORDER.index(o["code"]))
    elif topic == "cpi":
        outcomes.sort(key=lambda o: o["strike"])
    for o in outcomes:
        o["history"] = kalshi_history(series_ticker, o["ticker"])
    first = ms[0]
    try:
        ev = get_json(f"{KALSHI}/events/{event_ticker}", f"kalshi event {event_ticker}").get("event") or {}
    except Exception:  # noqa: BLE001 — 제목은 부가 정보
        ev = {}
    settle = ", ".join(s.get("name", "") for s in (ev.get("settlement_sources") or []) if s.get("name"))
    # 개별 시장의 규칙 문구는 그 결과(예: '0.5%p 이상 인상') 전용이라, 하나의 결과로 판정되는
    # 침체 시장만 원문을 싣는다.
    rules = short_rule(first.get("rules_primary")) if topic == "recession" else ""
    return {
        "topic": topic, "venue": "Kalshi", "eventId": event_ticker,
        "eventTitle": " · ".join(x for x in (ev.get("title"), ev.get("sub_title")) if x) or event_ticker,
        "eventDate": (ev.get("strike_date") or "")[:10] or None,
        "settlement": settle,
        "closeTime": close.isoformat().replace("+00:00", "Z"),
        "volume": round(vol), "liquidity": round(oi), "liquidityKind": "openInterest",
        "url": f"https://kalshi.com/markets/{series_ticker.lower()}",
        "rules": rules, "priceBasis": "호가 중간값(스프레드 5%p 이하) · 그 외 최근 체결가", "outcomes": outcomes,
    }


def build_kalshi(now, excluded):
    series_list = kalshi_series_index()
    groups = []
    for topic in TOPICS:
        try:
            g = kalshi_topic(topic, series_list, now, excluded)
        except Exception as exc:  # noqa: BLE001
            print(f"  [kalshi] {topic} 실패: {type(exc).__name__}: {exc}")
            g = None
        if g:
            groups.append(g)
            print(f"  [kalshi] {topic}: {g['eventId']} 결과 {len(g['outcomes'])}개")
    return groups


# ---------------------------------------------------------------------------
# Polymarket
POLY_QUERY = {
    # (검색어, 이벤트 슬러그 정규식)
    "fomc": ("fed decision", r"^fed-decision-in-[a-z]+"),
    "recession": ("US recession", r"^us-recession-(by-end-of|in)-\d{4}"),
    "cpi": ("inflation US annual", r"^[a-z]+-inflation-us-annual"),
    "bok": ("Bank of Korea decision", r"^bank-of-korea-decision-in-[a-z]+"),
}


def poly_json_list(v):
    if isinstance(v, list):
        return v
    try:
        x = json.loads(v or "[]")
        return x if isinstance(x, list) else []
    except (TypeError, ValueError):
        return []


def poly_history(token):
    q = urllib.parse.urlencode({"market": token, "interval": "1m", "fidelity": 1440})
    try:
        d = get_json(f"{CLOB}/prices-history?{q}", "poly hist")
    except Exception as exc:  # noqa: BLE001
        print(f"  [poly] 추이 실패: {type(exc).__name__}")
        return []
    hist, seen = [], set()
    for h in d.get("history") or []:
        t, p = h.get("t"), fnum(h.get("p"))
        if t is None or p is None:
            continue
        day = datetime.fromtimestamp(int(t), KST).strftime("%Y-%m-%d")
        if day in seen:
            hist[-1] = {"d": day, "p": round(p, 4)}
            continue
        seen.add(day)
        hist.append({"d": day, "p": round(p, 4)})
    return hist[-HISTORY_DAYS:]


def poly_topic(topic, now, excluded):
    query, slug_re = POLY_QUERY[topic]
    d = get_json(f"{GAMMA}/public-search?" + urllib.parse.urlencode(
        {"q": query, "limit_per_type": 20, "events_status": "active"}), f"poly search {topic}")
    cands = []
    yr = str(now.year)
    for e in d.get("events") or []:
        slug = e.get("slug") or ""
        if e.get("closed") or not re.search(slug_re, slug):
            continue
        end = parse_iso(e.get("endDate"))
        if not end or end <= now:
            continue
        if topic == "recession" and yr not in slug:
            continue
        cands.append((end, e))
    if not cands:
        return None
    cands.sort(key=lambda c: c[0])
    end, e = cands[0]
    liq, vol = fnum(e.get("liquidity")) or 0, fnum(e.get("volume")) or 0
    if liq < POLY_MIN_EVENT_LIQUIDITY or vol < POLY_MIN_EVENT_VOLUME:
        excluded.append({"venue": "Polymarket", "topic": topic, "event": e.get("slug"), "title": e.get("title"),
                         "reason": f"유동성 부족(호가 유동성 ${liq:,.0f} · 거래량 ${vol:,.0f})"})
        return None
    outcomes = []
    for m in e.get("markets") or []:
        if m.get("closed") or m.get("active") is False:
            continue
        prices = poly_json_list(m.get("outcomePrices"))
        names = poly_json_list(m.get("outcomes"))
        tokens = poly_json_list(m.get("clobTokenIds"))
        if not prices:
            continue
        yes_i = 0
        for i, n in enumerate(names):
            if str(n).strip().lower() == "yes":
                yes_i = i
        p = fnum(prices[yes_i]) if yes_i < len(prices) else None
        if p is None:
            continue
        raw = m.get("groupItemTitle") or m.get("question") or ""
        mliq = fnum(m.get("liquidityNum") if m.get("liquidityNum") is not None else m.get("liquidity")) or 0
        o = {"ticker": m.get("slug") or m.get("id"), "raw": raw, "prob": p,
             "bid": fnum(m.get("bestBid")), "ask": fnum(m.get("bestAsk")),
             "volume": round(fnum(m.get("volumeNum")) or 0), "liquidity": round(mliq),
             "_token": tokens[yes_i] if yes_i < len(tokens) else None}
        if topic in ("fomc", "bok"):
            code = rate_outcome_code(raw)
            if not code:
                continue
            o["code"], o["label"] = code, RATE_LABELS[code]
        elif topic == "cpi":
            v, kind = cpi_strike(raw)
            if v is None or mliq < POLY_MIN_STRIKE_LIQUIDITY or not (LADDER_MIN <= p <= LADDER_MAX):
                continue
            o["strike"], o["kind"], o["label"] = v, kind, cpi_label(v, kind)
        else:
            o["label"] = "예(Yes)"
        outcomes.append(o)
    if topic == "recession":
        outcomes = outcomes[:1]
    if not outcomes:
        return None
    if topic in ("fomc", "bok"):
        outcomes.sort(key=lambda o: RATE_ORDER.index(o["code"]))
    elif topic == "cpi":
        outcomes.sort(key=lambda o: o["strike"])
    for o in outcomes:
        tok = o.pop("_token", None)
        o["history"] = poly_history(tok) if tok else []
    return {
        "topic": topic, "venue": "Polymarket", "eventId": e.get("slug"),
        "eventTitle": e.get("title") or e.get("slug"),
        "closeTime": end.isoformat().replace("+00:00", "Z"),
        "volume": round(vol), "liquidity": round(liq), "liquidityKind": "orderbook",
        "url": f"https://polymarket.com/event/{e.get('slug')}",
        "eventDate": None, "settlement": "",
        "rules": short_rule(e.get("description")) if topic == "recession" else "",
        "priceBasis": "Polymarket 표시가(호가 중간값)", "outcomes": outcomes,
    }


def build_polymarket(now, excluded):
    groups = []
    for topic in TOPICS:
        try:
            g = poly_topic(topic, now, excluded)
        except Exception as exc:  # noqa: BLE001
            code = getattr(exc, "code", None)
            print(f"  [poly] {topic} 실패: {type(exc).__name__} {code or ''} {exc}")
            if code == 451:  # 지역 차단 — 다른 주제도 전부 같은 결과
                raise
            g = None
        if g:
            groups.append(g)
            print(f"  [poly] {topic}: {g['eventId']} 결과 {len(g['outcomes'])}개")
    return groups


# ---------------------------------------------------------------------------
# 침체 신호 모음 — industry_indicators.json 재사용(새 수집 없음)
# (지표 ID, 표시 이름, 비교, 임계값, 임계 설명, 근거)
#   compare: "ge" = 값 ≥ 임계면 초과, "lt" = 값 < 임계면 초과, None = 공인 임계 없음(개수 제외)
RECESSION_SIGNALS = [
    ("sahm_rule", "삼 법칙 (실시간)", "ge", 0.50, "0.50%p 이상",
     "Sahm(2019) — 실업률 3개월 평균이 직전 12개월 최저 대비 0.5%p 이상 오르면 침체 초기로 본다"),
    ("recession_prob_smoothed", "Chauvet-Piger 침체확률", "ge", 80.0, "80% 이상",
     "Chauvet & Piger — 확률이 80%를 넘으면(3개월 연속 시 침체 선언) 침체 국면으로 판정"),
    ("t10y3m", "장단기 금리차 10년−3개월", "lt", 0.0, "0 미만(역전)",
     "Estrella & Mishkin · 뉴욕연은 침체확률 모형이 쓰는 스프레드. 역전은 과거 침체를 앞서 나타났지만 시차가 크다"),
    ("t10y2y", "장단기 금리차 10년−2년", "lt", 0.0, "0 미만(역전)",
     "시장에서 가장 흔히 인용되는 역전 기준"),
    ("cfnai_ma3", "CFNAI 3개월 평균", "lt", -0.70, "−0.70 미만",
     "시카고연준 — 확장기 뒤 CFNAI-MA3 가 −0.70 아래로 내려가면 침체 시작 가능성이 커진 것으로 해석"),
    ("gz_recession_prob", "GZ 모형 침체확률 (12개월)", None, None, "공인 기준 없음",
     "연준 이사회 FEDS Notes(Favara 외) — 확률 자체를 보는 지표라 임계 판정에서 뺀다"),
]


def _series_tail(ind, n=24):
    s = ind.get("series") or []
    out = []
    for p in s[-n:]:
        v = fnum(p.get("val"))
        if v is not None:
            out.append({"d": p.get("date"), "v": v})
    return out


def build_recession_signals():
    if not INDUSTRY_JSON.exists():
        return None
    try:
        d = json.loads(INDUSTRY_JSON.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"  [recession] industry_indicators.json 읽기 실패: {exc}")
        return None
    inds = d.get("indicators") or {}
    by_id = inds if isinstance(inds, dict) else {i.get("id"): i for i in inds}
    rows = []
    for sid, name, cmp, thr, thr_text, basis in RECESSION_SIGNALS:
        src_id = "cfnai" if sid == "cfnai_ma3" else sid
        ind = by_id.get(src_id)
        if not ind:
            continue
        unit = ind.get("unit") or ""
        tail = _series_tail(ind, 24)
        value, date = fnum(ind.get("latest_value")), ind.get("latest_date")
        scale = 1.0
        if sid == "cfnai_ma3":
            last3 = [p["v"] for p in tail[-3:]]
            if len(last3) < 3:
                continue
            value = round(sum(last3) / 3, 2)
            date = tail[-1]["d"]
            # 추이도 3개월 평균으로 맞춘다(원 지표 계산 규칙 그대로).
            vals = [p["v"] for p in tail]
            tail = [{"d": tail[i]["d"], "v": round(sum(vals[i - 2:i + 1]) / 3, 2)} for i in range(2, len(tail))]
            unit = "지수 (0=추세)"
        if sid == "gz_recession_prob" and value is not None and value <= 1:
            # 원 단위 0~1 → % 로 보여 준다(값 변환일 뿐 새 수치가 아니다).
            scale = 100.0
            value = round(value * 100, 1)
            tail = [{"d": p["d"], "v": round(p["v"] * 100, 1)} for p in tail]
            unit = "%"
        if value is None:
            continue
        breached = None
        if cmp == "ge":
            breached = value >= thr
        elif cmp == "lt":
            breached = value < thr
        rows.append({
            "id": sid, "name": name, "value": value, "unit": unit, "date": date,
            "threshold": thr, "compare": cmp, "thresholdText": thr_text, "breached": breached,
            "basis": basis, "source": ind.get("source") or "", "sourceUrl": ind.get("source_url") or "",
            "frequency": ind.get("frequency"), "carriedSince": ind.get("carriedSince"),
            "history": tail, "scale": scale,
        })
    if not rows:
        return None
    evaluated = [r for r in rows if r["breached"] is not None]
    return {
        "industryUpdatedAtKst": d.get("updatedAtKst"),
        "evaluated": len(evaluated),
        "breached": sum(1 for r in evaluated if r["breached"]),
        "indicators": rows,
    }


# ---------------------------------------------------------------------------
def build(now=None):
    now = now or datetime.now(timezone.utc)
    excluded, sources = [], {}
    groups = []
    for venue, fn in (("kalshi", build_kalshi), ("polymarket", build_polymarket)):
        try:
            gs = fn(now, excluded)
            sources[venue] = {"ok": True, "groups": len(gs)}
            groups.extend(gs)
        except Exception as exc:  # noqa: BLE001
            code = getattr(exc, "code", None)
            msg = f"HTTP {code}" if code else type(exc).__name__
            print(f"[odds] {venue} 수집 실패: {msg} {exc}")
            sources[venue] = {"ok": False, "error": msg}
    recession = build_recession_signals()
    return {
        "updatedAtKst": kst_now().strftime("%Y-%m-%d %H:%M KST"),
        "source": "Kalshi · Polymarket 공개 시장 데이터 / FRED · 연준(산업 지표 재사용)",
        "disclaimer": "예측시장 가격은 참여자들의 베팅으로 형성된 값이며 예측의 정답이 아닙니다. 매매 신호가 아닌 참고 정보입니다.",
        "thresholds": {
            "kalshiMinEventOpenInterest": KALSHI_MIN_EVENT_OI, "kalshiMinEventVolume": KALSHI_MIN_EVENT_VOLUME,
            "polyMinEventLiquidity": POLY_MIN_EVENT_LIQUIDITY, "polyMinEventVolume": POLY_MIN_EVENT_VOLUME,
        },
        "sources": sources,
        "count": len(groups),
        "groups": groups,
        "excluded": excluded,
        "recession": recession,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    print("=== 예측시장 확률 + 침체 신호 (Kalshi · Polymarket · industry 재사용) ===")
    payload = build()
    if not payload["groups"]:
        print("[odds] 표시할 예측시장 없음(두 거래소 모두 실패 또는 전부 유동성 미달) — 기존 파일 유지")
        return 1
    sec.write_data(OUT_JSON, OUT_JS, "MACRO_ODDS", payload, indent=None)
    rec = payload.get("recession") or {}
    print(f"시장 {payload['count']}묶음 · 제외 {len(payload['excluded'])} · 침체 신호 "
          f"{rec.get('breached', 0)}/{rec.get('evaluated', 0)} 임계 초과 → {OUT_JSON.name}")
    if args.push:
        paths = [str(p.relative_to(ROOT)).replace("\\", "/") for p in (OUT_JSON, OUT_JS)]
        with repository_publish_lock(ROOT):
            if not sec.git_publish(paths, "macro odds"):
                print("[odds] git push 실패")
                return 1
    # Polymarket 이 막혔어도 Kalshi 로 발행은 한다. 다만 둘 중 하나라도 실패면 알림용으로 표시만.
    failed = [k for k, v in payload["sources"].items() if not v.get("ok")]
    if failed:
        print(f"[odds] 경고: {', '.join(failed)} 수집 실패 — 나머지로 발행")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
