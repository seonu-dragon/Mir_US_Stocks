// 종목 › 비교 피어 산점도 순수 함수(peer-scatter-core.js). 네트워크·DOM 없음.
// 실행: node scripts/tests/test_peer_scatter_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const c = require("../../peer-scatter-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const stocks = [
  { ticker: "A", industry: "Semis", sector: "TECH", marketCapB: 100 },
  { ticker: "B", industry: "Semis", sector: "TECH", marketCapB: 50 },
  { ticker: "C", industry: "Semis", sector: "TECH", marketCapB: 30 },
  { ticker: "D", industry: "Semis", sector: "TECH", marketCapB: 10 },
  { ticker: "E", industry: "Software", sector: "TECH", marketCapB: 5 },
  { ticker: "F", industry: "Banks", sector: "FIN", marketCapB: 5 },
];
const fund = { A: { pe: 30, roe: 20 }, B: { pe: 20, roe: 10 }, C: { pe: 10 }, D: { pe: 900, roe: 15 }, E: { pe: 5, roe: 5 } };

test("median — 홀수·짝수·결측 제외", () => {
  assert.equal(c.median([3, 1, 2]), 2);
  assert.equal(c.median([4, 1, 2, 3]), 2.5);
  assert.equal(c.median([null, "", "x", 5]), 5);
  assert.equal(c.median([]), null);
});

test("availableMetrics — 값이 minCount 개 이상인 지표만", () => {
  const t = { a: { pe: 1, roe: 2 }, b: { pe: 3 }, c: { pe: 4, divYield: 0 } };
  assert.deepEqual(c.availableMetrics(t, 2).map((m) => m.key), ["pe"]);
  assert.deepEqual(c.availableMetrics(t, 1).map((m) => m.key), ["pe", "roe", "divYield"]);
});

test("peerPool — 같은 산업군 3개 이상이면 산업군, 아니면 섹터", () => {
  assert.equal(c.peerPool(stocks, stocks[0]).basis, "industry");
  assert.equal(c.peerPool(stocks, stocks[0]).stocks.length, 4);
  const e = c.peerPool(stocks, stocks[4]);
  assert.equal(e.basis, "sector");
  assert.equal(e.stocks.length, 5);
  assert.equal(c.peerPool(stocks, stocks[5]), null); // 혼자
});

test("buildScatter — 결측 제외 'N개 중 M개', 업종 중앙값, 기준 종목 표시·맨 위", () => {
  const r = c.buildScatter({ stocks, anchor: stocks[1], fundFor: (t) => fund[t], xKey: "pe", yKey: "roe" });
  assert.equal(r.total, 4);
  assert.equal(r.shown, 3); // C 는 roe 없음
  assert.equal(r.medX, 25); // 10,20,30,900 → (20+30)/2
  assert.equal(r.medY, 15); // 10,15,20
  assert.equal(r.anchorShown, true);
  assert.equal(r.points.at(-1).ticker, "B");
  assert.equal(r.points.at(-1).self, true);
});

test("buildScatter — 극단값은 축 범위 밖(가장자리)으로, 값은 그대로", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ticker: `T${i}`, industry: "X", sector: "S", marketCapB: 1 }));
  const f = Object.fromEntries(many.map((s, i) => [s.ticker, { pe: 10 + i, roe: 5 + i }]));
  f.T11.pe = 5000;
  const r = c.buildScatter({ stocks: many, anchor: many[0], fundFor: (t) => f[t], xKey: "pe", yKey: "roe" });
  const out = r.points.find((p) => p.ticker === "T11");
  assert.equal(out.outX, 1);
  assert.equal(out.x, 5000);
  assert.equal(out.px, r.domainX[1]);
  assert.ok(r.domainX[1] < 100);
  assert.equal(r.points.filter((p) => p.outX || p.outY).length, 1);
});

test("buildScatter — 입력이 모자라면 null", () => {
  assert.equal(c.buildScatter({ stocks, anchor: null, fundFor: () => null, xKey: "pe", yKey: "roe" }), null);
  assert.equal(c.buildScatter({ stocks, anchor: stocks[0], fundFor: null, xKey: "pe", yKey: "roe" }), null);
});

console.log(`${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach((f) => console.error(f)); process.exit(1); }
