// 펀더멘털 이상치 규칙(fundamentals-sanity-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_fundamentals_sanity_core.mjs   (CI 의 "Fundamentals sanity tests" 스텝)
// 사례 파일은 파이썬 쪽(test_fundamentals_sanity.py)과 공유한다 — 두 구현이 같은 답을 내야 한다.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../fundamentals-sanity-core.js");
const cases = JSON.parse(readFileSync(new URL("./fixtures/fundamentals_sanity_cases.json", import.meta.url), "utf8"));

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

for (const c of cases.sanitize) {
  test(`sanitize: ${c.name}`, () => {
    const row = { ...c.row };
    const dropped = core.sanitizeRow(row, c.ctx);
    assert.deepEqual(row, c.want);
    assert.deepEqual([...dropped].sort(), [...c.dropped].sort());
  });
}
for (const c of cases.outlier) {
  test(`outlier: ${c.key}=${c.v}`, () => {
    assert.equal(core.isOutlier(c.key, c.v), c.want);
    assert.equal(core.winsor(c.key, c.v), c.winsor);
  });
}

test("무한대·NaN 은 어떤 키든 결측(야후 trailingPE Infinity)", () => {
  const row = { pe: Infinity, eps: NaN, roe: 5 };
  assert.deepEqual(core.sanitizeRow(row).sort(), ["eps", "pe"]);
  assert.deepEqual(row, { roe: 5 });
});

test("sanitizeTable: 개수 집계 + 두 번 적용해도 같다", () => {
  const t = { A: { pe: -3, roe: 10 }, B: { pb: -1, roe: 50 }, C: { pe: 12 } };
  const r1 = core.sanitizeTable(t);
  assert.equal(r1.rows, 3);
  assert.deepEqual(r1.dropped, { pe: 1, pb: 1, roe: 1 });
  const snap = JSON.stringify(t);
  const r2 = core.sanitizeTable(t);
  assert.deepEqual(r2.dropped, {});
  assert.equal(JSON.stringify(t), snap);
});

test("sortCompare 내림차순: 경계 안 값 → 이상치 → 결측", () => {
  const vals = [3948.15, 25, null, 151.9, -99985, 8];
  const sorted = vals.slice().sort((a, b) => core.sortCompare("roe", a, b, -1));
  assert.deepEqual(sorted.slice(0, 3), [151.9, 25, 8]);
  assert.deepEqual(sorted.slice(3, 5).sort((a, b) => a - b), [-99985, 3948.15]);
  assert.equal(sorted[5], null);
});

test("sortCompare 오름차순: 음수 PER 같은 결측은 맨 뒤, 이상치는 그 앞", () => {
  const sorted = [6421, null, 9.6, 4.2].sort((a, b) => core.sortCompare("pe", a, b, 1));
  assert.deepEqual(sorted, [4.2, 9.6, 6421, null]);
});

test("경계 없는 키는 평소 정렬(결측만 맨 뒤)", () => {
  const sorted = [5, null, 1e9, 2].sort((a, b) => core.sortCompare("eps", a, b, -1));
  assert.deepEqual(sorted, [1e9, 5, 2, null]);
});

test("describe: 경계 설명 문구", () => {
  assert.match(core.describe("roe"), /-300 미만 또는 300 초과/);
  assert.equal(core.describe("eps"), "");
});

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`fundamentals-sanity-core: ${passed} passed`);
