// 종목 분석 '현재' 시세 — 순수 계산(DOM 없음). 브라우저 window.MirLiveQuote, node 테스트
// (scripts/tests/test_live_quote_core.mjs)는 module.exports 로 같은 코드를 쓴다.
//
// 왼쪽 요약의 가격·등락률은 장 마감 스냅샷(전 거래일 종가 기준)이다. 종목 분석을 열 때만 워커 분봉
// 경로(?intraday=1&interval=1m, 엣지 캐시 60초)의 마지막 1분봉으로 '현재' 가격과 전일 종가 대비 등락을
// 한 줄 더 보여 준다(2026-10-02). 응답에 quote(워커가 주는 실시간 시세 — 국내 네이버·미국 야후 정규장)가
// 있으면 그것을 쓰고, 없으면(예전 워커) 분봉으로 계산한다.
//
// computeLiveQuote({ bars, quote, snapPrice, snapDate, nowLocal, market })
//   bars     [[o,h,l,c,v,"YYYY-MM-DDTHH:MM"(거래소 현지)], …] 오름차순
//   quote    { price, prevClose, time(ISO), localTime("YYYY-MM-DD…" 거래소 현지), marketState, source } | null
//   snapPrice/snapDate  스냅샷 가격·그 가격의 거래일(item.price · item.priceDate)
//   nowLocal "YYYY-MM-DDTHH:MM" 거래소 현지 지금(브라우저가 Intl 로 만든다)
// → { state, price, prevClose, change, changePct, time, delayed, source }
//   state: live(장중) | closed(오늘 장 끝남, 스냅샷 반영 전) | nosession(스냅샷 뒤 새 거래 없음) | none(계산 불가)
(function (root) {
  "use strict";

  const LIVE_GAP_MIN = 30;     // 마지막 봉이 지금보다 이 이상 오래면 장중이 아니라 본다(지연 20분 + 여유)
  const YAHOO_KR_DELAY_MIN = 20; // 야후 국내 분봉은 약 20분 늦다(2026-10-02 실측: 10:53 에 10:33 봉)

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function day(t) { return String(t || "").slice(0, 10); }
  function minutesBetween(a, b) {
    // 같은 형식("YYYY-MM-DDTHH:MM")의 현지 시각 차이(분). 시간대 정보 없이 UTC 로 읽어 빼면 된다.
    const pa = Date.parse(`${String(a).slice(0, 16)}:00Z`);
    const pb = Date.parse(`${String(b).slice(0, 16)}:00Z`);
    return Number.isFinite(pa) && Number.isFinite(pb) ? (pb - pa) / 60000 : null;
  }
  function pct(price, prev) {
    return price != null && prev ? (price / prev - 1) * 100 : null;
  }

  // 워커 quote(국내: 네이버 시세 — KRX 현재가와 '전일 대비'로 푼 KRX 전일 종가). 등락은 증권사 앱처럼 KRX
  // 정규장 전일 종가 대비. 스냅샷·상세 일봉은 네이버 일봉 API 를 쓰는데, 그 API 가 2026-09-14 부터 장 마감 뒤
  // NXT 거래까지 합친 통합 종가를 줘서 KRX 종가와 다를 수 있다(삼성전자 10/01: KRX 276,000 · 네이버 일봉 274,500
  // · 스냅샷 273,000). 그래서 quote 의 전일 종가를 먼저 쓰고, 없을 때만 스냅샷 종가.
  function fromQuote(q, snapPrice, snapDate) {
    const price = num(q.price);
    if (price == null) return null;
    const qDay = day(q.localTime || q.time);
    if (snapDate && qDay && qDay <= day(snapDate) && String(q.marketState || "").toUpperCase() !== "OPEN") {
      return { state: "nosession", price, time: q.time || "", delayed: 0, source: q.source || "quote" };
    }
    let prev = num(q.prevClose);
    if (prev == null) prev = num(snapPrice);
    const st = String(q.marketState || "").toUpperCase();
    return {
      state: st === "OPEN" || st === "REGULAR" ? "live" : "closed",
      price, prevClose: prev, change: prev != null ? price - prev : null, changePct: pct(price, prev),
      time: q.time || "", delayed: 0, source: q.source || "quote",
    };
  }

  function computeLiveQuote(input) {
    const o = input || {};
    if (o.quote && typeof o.quote === "object") {
      const r = fromQuote(o.quote, o.snapPrice, o.snapDate);
      if (r) return r;
    }
    const bars = Array.isArray(o.bars) ? o.bars.filter((b) => Array.isArray(b) && num(b[3]) != null && b[5]) : [];
    if (!bars.length) return { state: "none" };
    const last = bars[bars.length - 1];
    const lastT = String(last[5]);
    const lastDay = day(lastT);
    const snapDate = day(o.snapDate);
    const delayed = o.market === "kr" ? YAHOO_KR_DELAY_MIN : 0;
    // 스냅샷 기준일 뒤로 새 거래가 없다(정규장 전·휴장) — 위 종가가 최신이다.
    if (snapDate && lastDay <= snapDate) {
      return { state: "nosession", price: num(last[3]), time: lastT, delayed, source: "bars" };
    }
    // 전일 종가: 스냅샷이 바로 앞 거래일이면 그 종가, 아니면 분봉에서 앞 거래일 마지막 봉.
    let prevBarClose = null;
    let prevDay = "";
    for (let i = bars.length - 1; i >= 0; i -= 1) {
      if (day(bars[i][5]) < lastDay) { prevBarClose = num(bars[i][3]); prevDay = day(bars[i][5]); break; }
    }
    const snapPrice = num(o.snapPrice);
    const prevClose = snapPrice != null && snapDate && (!prevDay || snapDate === prevDay) ? snapPrice : prevBarClose;
    const price = num(last[3]);
    const gap = o.nowLocal ? minutesBetween(lastT, o.nowLocal) : null;
    const live = day(o.nowLocal) === lastDay && gap != null && gap <= LIVE_GAP_MIN + delayed;
    return {
      state: live ? "live" : "closed",
      price, prevClose,
      change: prevClose != null && price != null ? price - prevClose : null,
      changePct: pct(price, prevClose),
      time: lastT, delayed, source: "bars",
    };
  }

  const api = { computeLiveQuote, LIVE_GAP_MIN, YAHOO_KR_DELAY_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirLiveQuote = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
