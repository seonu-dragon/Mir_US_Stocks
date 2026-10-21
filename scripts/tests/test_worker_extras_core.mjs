// 워커 데이터 라우트 응답 검증(worker-extras-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_worker_extras_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const W = require("../../worker-extras-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

test("옛 워커 감지: 404 + not_found 만", () => {
  assert.equal(W.isUnknownRoute(404, { error: "not_found", message: "unknown route" }), true);
  assert.equal(W.isUnknownRoute(404, { error: "no_options" }), false, "옵션 없는 종목 404 는 라우트가 있는 것");
  assert.equal(W.isUnknownRoute(502, { error: "upstream" }), false);
  assert.equal(W.isUnknownRoute(404, null), false);
});

test("symsearch: 현재 시장만, 로컬에 있는 티커 제외, 열 수 없는 모양 제외", () => {
  const body = { results: [
    { ticker: "PLTR", market: "US", name: "Palantir", exchange: "NASDAQ", type: "stock" },
    { ticker: "PLTR.TO", market: "OTHER", name: "Palantir CDR", exchange: "Toronto", type: "etf" },
    { ticker: "NVDA", market: "US", name: "NVIDIA", exchange: "NASDAQ", type: "stock" },
    { ticker: "247540", market: "KR", name: "EcoPro BM", exchange: "KOSDAQ", type: "stock" },
    { ticker: "BRK.B", market: "US", name: "Berkshire", exchange: "NYSE", type: "stock" },
    { ticker: "<x>", market: "US", name: "bad" },
  ] };
  assert.deepEqual(W.parseSymSearch(body, "us", new Set(["NVDA"])).map((h) => h.ticker), ["PLTR", "BRK.B"]);
  const kr = W.parseSymSearch(body, "kr", new Set());
  assert.deepEqual(kr.map((h) => [h.ticker, h.kosdaq]), [["247540", true]]);
  assert.equal(W.parseSymSearch({ error: "x" }, "us"), null, "모양 다름 → null");
  assert.equal(W.parseSymSearch(body, "us", null, 1).length, 1, "limit");
});

test("insights: 비슷한 종목은 현재 시장·자기 제외, 지지/저항은 양수만", () => {
  const body = { similar: [
    { ticker: "AMD", market: "US" }, { ticker: "NVDA", market: "US" }, { ticker: "000660", market: "KR" }, { ticker: "SMSN.IL", market: "OTHER" }, { ticker: "AMD", market: "US" },
  ], levels: { support: 182.7, resistance: 224.48 }, updatedAt: "2026-10-21T05:00:00Z" };
  const us = W.parseInsights(body, "us", "nvda");
  assert.deepEqual(us.similar, ["AMD"]);
  assert.equal(us.support, 182.7);
  assert.equal(us.resistance, 224.48);
  const kr = W.parseInsights({ similar: [{ ticker: "000660", market: "KR" }], levels: null }, "kr", "005930");
  assert.deepEqual(kr.similar, ["000660"]);
  assert.equal(kr.support, null, "국내 지지선 없음");
  assert.equal(W.parseInsights({ similar: [], levels: { support: -1, resistance: "x" } }, "us", "X").support, null);
  assert.equal(W.parseInsights({ ticker: "NVDA", news: [] }, "us", "NVDA"), null, "?ticker= 모양(옛 워커 오인) → null");
});

test("options: 값 없는 만기는 버리고, 하나도 없으면 null", () => {
  const body = { price: 101, updatedAt: "2026-10-21T05:00:00Z", expiries: [
    { expiry: "2026-10-21", daysToExpiry: 0, putCallVolume: 0.66, putCallOI: null, maxPain: null, atmIV: null, expectedMovePct: 1.8, straddle: 3.95, topOI: [] },
    { expiry: "2026-10-23", daysToExpiry: 2, putCallVolume: null, putCallOI: null, maxPain: null, atmIV: null, expectedMovePct: null, topOI: [] },
    { expiry: "bad", putCallVolume: 1 },
  ] };
  const o = W.parseOptions(body);
  assert.equal(o.expiries.length, 1);
  assert.equal(o.expiries[0].expectedMovePct, 1.8);
  assert.equal(o.source, "live");
  assert.equal(W.parseOptions({ expiries: [{ expiry: "2026-10-23", topOI: [] }] }), null, "전부 null → 카드 없음");
  assert.equal(W.parseOptions({ error: "no_session" }), null);
  const withOi = W.parseOptions({ expiries: [{ expiry: "2026-10-23", maxPain: 220, topOI: [{ strike: 220, callOI: 10, putOI: 5 }, { strike: "x" }] }] });
  assert.deepEqual(withOi.expiries[0].topOI, [{ strike: 220, callOI: 10, putOI: 5 }]);
});

test("options 스냅샷 행 → 같은 모양(가장 가까운 만기 하나)", () => {
  const o = W.optionsFromSnapshot({ putCallOI: 0.82, putCallVol: 0.66, maxPain: 220, expectedMovePct: 1.8, price: 216.47, expiry: "2026-10-21", callOI: 97252, putOI: 80159 }, "2026-10-21 06:25 KST");
  assert.equal(o.source, "snapshot");
  assert.equal(o.updatedAtKst, "2026-10-21 06:25 KST");
  assert.equal(o.expiries[0].putCallVolume, 0.66);
  assert.equal(o.expiries[0].maxPain, 220);
  assert.equal(o.expiries[0].atmIV, null, "스냅샷엔 IV 가 없다 — 만들지 않는다");
  assert.equal(W.optionsFromSnapshot({ expiry: "2026-10-21" }, ""), null);
});

console.log(`${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
