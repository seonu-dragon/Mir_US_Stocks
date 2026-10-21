// 워커 데이터 라우트(?symsearch= · ?insights= · ?options=) 응답 검증·정리 — 순수 계산(DOM 없음).
// 브라우저 window.MirWorkerExtras, node 테스트(scripts/tests/test_worker_extras_core.mjs)는 module.exports.
//
// 워커는 머지해도 배포되지 않는다(대시보드 수동 배포). 그래서 화면은 '옛 워커'를 먼저 가정한다:
// 모르는 경로 → 404 {error:"not_found"}, 그 밖의 모양이 다른 응답 → 이 파서들이 null 을 돌려주고
// 화면(worker-extras.js)은 해당 기능을 조용히 숨긴다. 여기서 값을 지어내지 않는다 — 없는 칸은 null.
(function (root) {
  "use strict";

  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function str(v, max = 120) {
    return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
  }

  // 옛 워커(라우트 없음)의 응답인가 — 404 + not_found. 이걸 보면 이번 방문 동안 그 라우트를 다시 부르지 않는다.
  function isUnknownRoute(status, body) {
    return status === 404 && !!body && body.error === "not_found";
  }

  // market: "us" | "kr". 사이트가 열 수 있는 티커 모양만(createLiveSearchStub 과 같은 규칙).
  function tickerFitsMarket(ticker, market) {
    const t = String(ticker || "");
    return market === "kr" ? /^\d{6}$/.test(t) : /^[A-Z][A-Z0-9._-]{0,11}$/.test(t);
  }

  // ?symsearch= → 현재 시장 종목만 [{ ticker, name, exchange, type, kosdaq }]. 모양이 다르면 null.
  // exclude: 이미 로컬 결과에 있는 티커(Set). 다른 시장·해외 상장은 열 수 없어 보이지 않는다.
  function parseSymSearch(body, market, exclude, limit = 5) {
    if (!body || !Array.isArray(body.results)) return null;
    const want = market === "kr" ? "KR" : "US";
    const out = [];
    const seen = new Set();
    for (const r of body.results) {
      if (!r || r.market !== want) continue;
      const ticker = str(r.ticker, 16).toUpperCase();
      if (!tickerFitsMarket(ticker, market) || seen.has(ticker)) continue;
      if (exclude && exclude.has(ticker)) continue;
      seen.add(ticker);
      const exchange = str(r.exchange, 24);
      out.push({ ticker, name: str(r.name) || ticker, exchange, type: r.type === "etf" ? "etf" : "stock", kosdaq: exchange === "KOSDAQ" });
      if (out.length >= limit) break;
    }
    return out;
  }

  // ?insights= → { similar: [ticker…](현재 시장만, 자기 자신 제외), support, resistance }. 모양이 다르면 null.
  function parseInsights(body, market, selfTicker) {
    if (!body || typeof body !== "object" || !Array.isArray(body.similar)) return null;
    const want = market === "kr" ? "KR" : "US";
    const self = String(selfTicker || "").toUpperCase();
    const similar = [];
    for (const s of body.similar) {
      if (!s || s.market !== want) continue;
      const t = str(s.ticker, 16).toUpperCase();
      if (!t || t === self || !tickerFitsMarket(t, market) || similar.includes(t)) continue;
      similar.push(t);
      if (similar.length >= 6) break;
    }
    const lv = body.levels && typeof body.levels === "object" ? body.levels : null;
    const support = lv ? num(lv.support) : null;
    const resistance = lv ? num(lv.resistance) : null;
    return {
      similar,
      support: support != null && support > 0 ? support : null,
      resistance: resistance != null && resistance > 0 ? resistance : null,
      updatedAt: str(body.updatedAt, 40) || null,
    };
  }

  function expiryRow(e) {
    if (!e || typeof e !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.expiry || ""))) return null;
    const topOI = Array.isArray(e.topOI) ? e.topOI.map((r) => ({ strike: num(r && r.strike), callOI: num(r && r.callOI), putOI: num(r && r.putOI) }))
      .filter((r) => r.strike != null && r.callOI != null && r.putOI != null).slice(0, 5) : [];
    return {
      expiry: e.expiry,
      daysToExpiry: num(e.daysToExpiry),
      putCallVolume: num(e.putCallVolume),
      putCallOI: num(e.putCallOI),
      callOI: num(e.callOI),
      putOI: num(e.putOI),
      maxPain: num(e.maxPain),
      atmIV: num(e.atmIV),
      expectedMovePct: num(e.expectedMovePct),
      straddle: num(e.straddle),
      topOI,
    };
  }

  function hasAnyValue(r) {
    return ["putCallVolume", "putCallOI", "maxPain", "atmIV", "expectedMovePct"].some((k) => r[k] != null) || r.topOI.length > 0;
  }

  // ?options= → { price, expiries:[…], updatedAt, source:"live" }. 모양이 다르거나 값이 하나도 없으면 null.
  function parseOptions(body) {
    if (!body || typeof body !== "object" || !Array.isArray(body.expiries)) return null;
    const expiries = body.expiries.map(expiryRow).filter((r) => r && hasAnyValue(r)).slice(0, 2);
    if (!expiries.length) return null;
    return { price: num(body.price), expiries, updatedAt: str(body.updatedAt, 40) || null, source: "live" };
  }

  // 발행 스냅샷(data/options_stats.js 의 한 종목) → 같은 모양. 스냅샷은 가장 가까운 만기 하나뿐이다.
  function optionsFromSnapshot(row, updatedAtKst) {
    if (!row || typeof row !== "object") return null;
    const r = expiryRow({ ...row, expiry: row.expiry, putCallVolume: row.putCallVol, topOI: [] });
    if (!r || !hasAnyValue(r)) return null;
    return { price: num(row.price), expiries: [r], updatedAt: null, updatedAtKst: str(updatedAtKst, 40) || null, source: "snapshot" };
  }

  const api = { isUnknownRoute, tickerFitsMarket, parseSymSearch, parseInsights, parseOptions, optionsFromSnapshot };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MirWorkerExtras = api;
})(typeof window !== "undefined" ? window : globalThis);
