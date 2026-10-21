// 다크풀(ATS) 주간 비중 순수 함수(ats-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_ats_core.mjs   (CI 의 "ATS core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../ats-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failures.push(`${name}: ${err && err.message}`);
  }
}

const P = {
  weeks: { T1: ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"], T2: ["2026-08-24", "2026-08-31"] },
  tickers: {
    NVDA: ["T1", 18146959, [30.0, null, 34.0, 38.0]],
    LAST_MISSING: ["T1", 500, [40.0, 42.0, null, null]],
    SMALL: ["T2", 1200, [12.5, 13.5]],
    EMPTY: ["T1", 0, [null, null, null, null]],
    BAD: ["T1", 1],
  },
};

test("요약: 최근 주·평균·평균 대비, 빈 주는 평균에서 뺀다", () => {
  const s = core.summarize(P, "NVDA");
  assert.equal(s.tier, "T1");
  assert.equal(s.lastWeek, "2026-09-28");
  assert.equal(s.lastPct, 38);
  assert.equal(s.avgPct, 34);
  assert.equal(s.diffPct, 4);
  assert.equal(s.weeksWithData, 3);
  assert.deepEqual(s.series.map((p) => p.week), P.weeks.T1);
});

test("요약: 최근 주가 비면 값이 있는 마지막 주, 티어별 주 목록", () => {
  const s = core.summarize(P, "LAST_MISSING");
  assert.equal(s.lastWeek, "2026-09-14");
  assert.equal(s.lastPct, 42);
  assert.equal(core.summarize(P, "SMALL").lastWeek, "2026-08-31");
});

test("요약: 값이 없거나 깨진 레코드는 null", () => {
  assert.equal(core.summarize(P, "EMPTY"), null);
  assert.equal(core.summarize(P, "BAD"), null);
  assert.equal(core.summarize(P, "NONE"), null);
  assert.equal(core.summarize(null, "NVDA"), null);
});

test("막대 높이: 최대값 기준, null 유지, 최소 1", () => {
  assert.deepEqual(core.bars([{ pct: 10 }, { pct: null }, { pct: 40 }, { pct: 0.1 }], 40), [10, null, 40, 1]);
  assert.deepEqual(core.bars([{ pct: null }], 40), [null]);
});

test("표기: 주 범위·주식 수", () => {
  assert.equal(core.weekLabel("2026-09-28"), "9/28~10/2");
  assert.equal(core.weekLabel(""), "");
  assert.equal(core.fmtShares(18146959), "1,815만 주");
  assert.equal(core.fmtShares(250000000), "2.5억 주");
  assert.equal(core.fmtShares(8500), "8,500주");
  assert.equal(core.fmtShares(null), "");
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`ats core: ${passed} passed`);
