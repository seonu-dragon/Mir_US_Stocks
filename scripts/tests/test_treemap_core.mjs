// 시장지도 극소 타일 묶기(treemap-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_treemap_core.mjs   (CI 의 "Treemap core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../treemap-core.js");

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

test("면적 기준으로 나누고, 작은 것이 2개 이상일 때만 묶는다", () => {
  const items = [{ a: 5000 }, { a: 300 }, { a: 200 }, { a: 900 }];
  const r = core.partitionTiny(items, (x) => x.a, 700);
  assert.deepEqual(r.keep.map((x) => x.a), [5000, 900]);
  assert.deepEqual(r.tiny.map((x) => x.a), [300, 200]);
  const one = core.partitionTiny([{ a: 5000 }, { a: 10 }], (x) => x.a, 700);
  assert.equal(one.tiny.length, 0);
  assert.equal(one.keep.length, 2);
});

test("전부 작으면 가장 큰 1개는 남기고 나머지를 묶는다", () => {
  const r = core.partitionTiny([{ a: 1 }, { a: 3 }, { a: 2 }], (x) => x.a, 700);
  assert.deepEqual(r.keep.map((x) => x.a), [3]);
  assert.deepEqual(r.tiny.map((x) => x.a), [1, 2]);
  // 2개뿐이면 남은 1개를 묶을 이유가 없다
  const two = core.partitionTiny([{ a: 1 }, { a: 3 }], (x) => x.a, 700);
  assert.equal(two.tiny.length, 0);
  assert.equal(two.keep.length, 2);
});

test("면적이 Infinity(고정)이면 묶이지 않는다", () => {
  const r = core.partitionTiny([{ a: 5000 }, { a: Infinity }, { a: 1 }, { a: 2 }], (x) => x.a, 700);
  assert.equal(r.keep.length, 2);
  assert.equal(r.tiny.length, 2);
});

test("시가총액 가중 평균: 결측 제외, 가중치 없으면 단순 평균, 윈저라이즈", () => {
  const items = [{ v: 2, w: 3 }, { v: -1, w: 1 }, { v: null, w: 100 }];
  assert.equal(core.weightedAverage(items, (x) => x.v, (x) => x.w), (2 * 3 - 1) / 4);
  assert.equal(core.weightedAverage([{ v: 1 }, { v: 3 }], (x) => x.v, () => 0), 2);
  assert.equal(core.weightedAverage([{ v: null }], (x) => x.v, () => 1), null);
  assert.equal(core.weightedAverage([{ v: 5000, w: 1 }], (x) => x.v, (x) => x.w, (v) => Math.min(v, 300)), 300);
});

test("상위 구성 종목은 가중치 큰 순", () => {
  const top = core.topMembers([{ t: "a", w: 1 }, { t: "b", w: 9 }, { t: "c", w: 5 }], (x) => x.w, 2);
  assert.deepEqual(top.map((x) => x.t), ["b", "c"]);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`treemap-core: ${passed} passed`);
