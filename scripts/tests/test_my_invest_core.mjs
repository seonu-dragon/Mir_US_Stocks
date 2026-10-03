// 내 투자 순수 계산(my-invest-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_my_invest_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../my-invest-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const A = { "2026-09-28": 10, "2026-09-29": 11, "2026-09-30": 12, "2026-10-01": 12 };
const B = new Map([["2026-09-28", 100], ["2026-09-30", 90], ["2026-10-01", 110]]);   // 09-29 빈 날
const LATE = { "2026-09-30": 5, "2026-10-01": 6 };                                     // 구간 중간에 시작

test("holdingsTrend: 현재 수량 × 과거 종가, 빈 날은 직전 종가", () => {
  const r = core.holdingsTrend([{ t: "A", qty: 10 }, { t: "B", qty: 1 }], { A, B }, null, 4);
  assert.deepEqual(r.dates, ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
  assert.deepEqual(r.values, [200, 210, 210, 230]);
  assert.equal(r.change, 30);
  assert.ok(Math.abs(r.changePct - 15) < 1e-9);
  assert.deepEqual(r.used, ["A", "B"]);
});

test("holdingsTrend: 구간 시작일에 가격 없는 종목은 빼고 excluded", () => {
  const r = core.holdingsTrend([{ t: "A", qty: 1 }, { t: "L", qty: 100 }], { A, L: LATE }, null, 4);
  assert.deepEqual(r.excluded, ["L"]);
  assert.deepEqual(r.values, [10, 11, 12, 12]);
  // 구간을 줄여 시작일이 LATE 상장 뒤면 포함된다
  const r2 = core.holdingsTrend([{ t: "A", qty: 1 }, { t: "L", qty: 100 }], { A, L: LATE }, null, 2);
  assert.deepEqual(r2.excluded, []);
  assert.deepEqual(r2.values, [512, 612]);
});

test("holdingsTrend: 벤치마크 0% 기준 · 빈 입력", () => {
  const bench = { "2026-09-27": 50, "2026-09-29": 55, "2026-10-01": 60 };
  const r = core.holdingsTrend([{ t: "A", qty: 1 }], { A }, bench, 4);
  assert.deepEqual(r.benchPct.map((v) => Math.round(v)), [0, 10, 10, 20]);
  assert.equal(core.holdingsTrend([], { A }, null, 4), null);
  assert.equal(core.holdingsTrend([{ t: "Z", qty: 1 }], {}, null, 4), null);
});

test("allocation: 합산·정렬·집중 판정", () => {
  const a = core.allocation([{ key: "정보기술", value: 60 }, { key: "ETF", value: 10 }, { key: "정보기술", value: 20 }, { key: "x", value: -5 }]);
  assert.equal(a.total, 90);
  assert.equal(a.top.key, "정보기술");
  assert.ok(Math.abs(a.top.pct - 88.888) < 0.01);
  assert.equal(a.concentrated, true);
  assert.equal(core.allocation([]).total, 0);
});

if (failures.length) {
  console.error(`my-invest-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error("  ✕ " + f));
  process.exit(1);
}
console.log(`my-invest-core: ${passed}개 테스트 통과`);
