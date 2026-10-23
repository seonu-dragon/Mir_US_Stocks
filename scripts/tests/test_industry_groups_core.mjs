// 업종 순위표 순수 함수(industry-groups-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_industry_groups_core.mjs   (CI 의 "Industry groups core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../industry-groups-core.js");

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
  market: "us",
  groups: [
    { name: "A", sector: "TECH", n: 10, above50: 60, above200: 70, r: { "1w": [5, 1] }, p: { "1w": [1, 1] },
      top: { "1w": [["AAA", "Aaa", 9], ["AAB", "Aab", -2]] } },
    { name: "B", sector: "TECH", n: 8, r: { "1w": [2, 3] }, p: { "1w": [4, 0] } },
    { name: "C", sector: "ENERGY", n: 6, r: { "1w": [-1, 4] }, p: { "1w": [3, 2] } },
    { name: "D", sector: "ENERGY", n: 5, r: { "1d": [1, 1] }, p: {} },  // 1주 값 없음 → 맨 뒤
  ],
};

test("ranks: 큰 값이 1위, 같은 값은 같은 순위, null 은 제외", () => {
  const r = core.ranks([3, null, 5, 3]);
  assert.equal(r.get(2), 1);
  assert.equal(r.get(0), 2);
  assert.equal(r.get(3), 2);
  assert.equal(r.has(1), false);
});

test("rankGroups: 시총 가중 1주 순위와 5거래일 전 대비 변화", () => {
  const rows = core.rankGroups(P, "1w", "cap");
  assert.deepEqual(rows.map((r) => r.name), ["A", "B", "C", "D"]);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].prevRank, 3);   // 이전 값 1 → B(4)·C(3) 다음
  assert.equal(rows[0].delta, 2);
  assert.equal(rows[1].delta, -1);     // B 이전 1위 → 지금 2위
  assert.equal(rows[3].rank, null);
  assert.equal(rows[3].delta, null);
  assert.deepEqual(rows[0].best, { ticker: "AAA", name: "Aaa", ret: 9 });
  assert.equal(rows[0].above50, 60);
});

test("rankGroups: 동일 가중·섹터 필터", () => {
  const eq = core.rankGroups(P, "1w", "eq");
  assert.deepEqual(eq.slice(0, 3).map((r) => r.name), ["C", "B", "A"]);
  const energy = core.rankGroups(P, "1w", "cap", "ENERGY");
  assert.deepEqual(energy.map((r) => [r.name, r.rank]), [["C", 1], ["D", null]]);
  assert.deepEqual(core.rankGroups(null), []);
});

test("sectorsOf 는 업종 수 많은 순", () => {
  assert.deepEqual(core.sectorsOf(P), ["ENERGY", "TECH"]);
});

test("표기", () => {
  assert.equal(core.fmtPct(1.234), "+1.2%");
  assert.equal(core.fmtPct(-0.05), "-0.1%");
  assert.equal(core.fmtPct(156.86), "+157%");
  assert.equal(core.fmtPct(null), "–");
  assert.equal(core.fmtDelta(3), "▲3");
  assert.equal(core.fmtDelta(-2), "▼2");
  assert.equal(core.fmtDelta(0), "–");
  assert.equal(core.fmtDelta(null), "");
});

if (failures.length) {
  console.error(`industry-groups-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`industry-groups-core: ${passed}개 통과`);
