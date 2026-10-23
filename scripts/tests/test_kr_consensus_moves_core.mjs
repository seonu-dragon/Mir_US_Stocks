// 국내 컨센서스 변화 순수 함수(kr-consensus-moves-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_kr_consensus_moves_core.mjs   (CI 의 "KR consensus moves core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../kr-consensus-moves-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const payload = {
  stocks: {
    "000001": { estimateCount: 10, targetPrice: 1000, chg: { tp1w: 5, tp1m: 10, o1m: 3, base: { "1w": "2026-10-16", "1m": "2026-09-23" } } },
    "000002": { estimateCount: 5, targetPrice: 2000, chg: { tp1w: -2.5, tp1m: 0, o1m: -8 } },
    "000003": { estimateCount: 2, targetPrice: 3000, chg: { tp1w: 30 } },                         // 기관 2곳 — 뺀다
    "000004": { estimateCount: 9, targetPrice: 4000, carriedSince: "2026-10-20", chg: { tp1w: 40 } }, // 승계 — 뺀다
    "000005": { estimateCount: 7, targetPrice: 5000, chg: { tp1w: 0 } },
    "000006": { estimateCount: 7, targetPrice: 6000 },
  },
};

test("moves 1w target: filters, breadth, order", () => {
  const r = core.moves(payload, { field: "tp", period: "1w" });
  assert.deepEqual(r.up.map((x) => x.ticker), ["000001"]);
  assert.deepEqual(r.down.map((x) => x.ticker), ["000002"]);
  assert.deepEqual(r.breadth, { up: 1, down: 1, flat: 1, total: 3 });
  assert.equal(r.base, "2026-10-16");
});

test("moves 1m operating estimate", () => {
  const r = core.moves(payload, { field: "op", period: "1m" });
  assert.equal(r.key, "o1m");
  assert.deepEqual(r.down.map((x) => x.ticker), ["000002"]);
});

test("unknown period returns empty", () => {
  const r = core.moves(payload, { field: "op", period: "1w" });
  assert.equal(r.breadth.total, 0);
});

test("mine skips zero and carried", () => {
  const r = core.mine(payload, ["000001", "000002", "000004", "000005", "999999"]);
  assert.deepEqual(r.map((x) => x.ticker), ["000001", "000002"]);
});

test("cardRows labels with fiscal year", () => {
  const rows = core.cardRows({ tp1m: 1, tp3m: -2, o1m: 3, fy: "2026.12", op1m: 0.1, r2m: 4, fy2: "2027.12" });
  assert.deepEqual(rows.map((r) => r.label), ["목표주가", "추정 영업이익 (2026.12)", "추정 매출 (2027.12)", "투자의견 점수"]);
  assert.equal(rows[0].m3, -2);
});

test("arrow formatting", () => {
  assert.equal(core.arrow(3.25), "▲3.3%");
  assert.equal(core.arrow(-1), "▼1.0%");
  assert.equal(core.arrow(0), "0.0%");
  assert.equal(core.arrow(null), "—");
  assert.equal(core.arrow(0.2, "점"), "▲0.20점");
});

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`kr-consensus-moves-core: ${passed} passed`);
