// 찾기 표 열 설정 순수 로직(find-table-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_find_table_core.mjs   (CI 의 "Find table core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../find-table-core.js");

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

test("시장별 열: 거래량·거래대금·외국인 비율은 국내 전용", () => {
  const us = core.availableColumns("us").map((c) => c.key);
  const kr = core.availableColumns("kr").map((c) => c.key);
  for (const k of ["volume", "amount", "foreignPct"]) {
    assert.ok(!us.includes(k), `US 에 ${k} 가 있으면 안 됨`);
    assert.ok(kr.includes(k), `KR 에 ${k} 가 있어야 함`);
  }
  assert.ok(us.includes("pe") && us.includes("roe") && us.includes("divYield"));
});

test("기본 열은 그 시장에서 쓸 수 있는 열만", () => {
  for (const m of ["us", "kr"]) {
    const ok = new Set(core.availableColumns(m).map((c) => c.key));
    core.defaultColumns(m).forEach((k) => assert.ok(ok.has(k), `${m}:${k}`));
  }
});

test("저장값 정리: 모르는 키·다른 시장 전용 키·중복 제거, 순서 유지", () => {
  assert.deepEqual(core.sanitizeColumns(["pe", "zzz", "volume", "pe", "price"], "us"), ["pe", "price"]);
  assert.deepEqual(core.sanitizeColumns(["foreignPct", "price"], "kr"), ["foreignPct", "price"]);
});

test("저장값이 없거나 전부 무효면 기본값", () => {
  assert.deepEqual(core.sanitizeColumns(null, "us"), core.defaultColumns("us"));
  assert.deepEqual(core.sanitizeColumns(["volume"], "us"), core.defaultColumns("us"));
  assert.deepEqual(core.sanitizeColumns("price", "kr"), core.defaultColumns("kr"));
});

test("parseSaved: 깨진 JSON·배열 아님 → null", () => {
  assert.equal(core.parseSaved("{bad"), null);
  assert.equal(core.parseSaved('{"a":1}'), null);
  assert.equal(core.parseSaved(""), null);
  assert.deepEqual(core.parseSaved('["pe"]'), ["pe"]);
});

test("toggle: 켜면 끝에, 끄면 빠짐, 마지막 한 열은 유지, 없는 열은 무시", () => {
  assert.deepEqual(core.toggleColumn(["price"], "roe", true, "us"), ["price", "roe"]);
  assert.deepEqual(core.toggleColumn(["price", "roe"], "price", false, "us"), ["roe"]);
  assert.deepEqual(core.toggleColumn(["roe"], "roe", false, "us"), ["roe"]);
  assert.deepEqual(core.toggleColumn(["price"], "amount", true, "us"), ["price"]);
  assert.deepEqual(core.toggleColumn(["price", "roe"], "roe", true, "us"), ["price", "roe"]);
});

test("move: 앞뒤로 한 칸, 범위 밖은 그대로", () => {
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.deepEqual(core.moveColumn(["a"], "x", 1), ["a"]);
});

test("정렬 가능한 열의 metric 은 #topMetric 옵션 값", () => {
  const options = ["changePct", "weekChangePct", "monthChangePct", "threeMonthChangePct", "ytdChangePct", "rsi14", "epsTtm", "stochK",
    "volumeRatio", "volume", "amount", "marketCapB", "pe", "forwardPE", "ps", "pb", "newHighDistancePct", "low52Dist"];
  core.COLUMNS.filter((c) => c.metric).forEach((c) => assert.ok(options.includes(c.metric), `${c.key}→${c.metric}`));
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`find-table-core: ${passed} passed`);
