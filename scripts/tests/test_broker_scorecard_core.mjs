// 증권사 사후 성적표 표 행 계산(broker-scorecard-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_broker_scorecard_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const S = require("../../broker-scorecard-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const P = {
  kinds: ["up", "down", "ptUp", "ptDown", "weird"],
  firms: [
    { f: "Alpha", k: { up: [30, [28, 1.2, 0.5, 55.0], [25, -2.1, -1.0, 44.0]], ptUp: [5, [5], [3]] } },
    { f: "Beta", k: { up: [12, [12], [10]] } },
    { f: "Gamma", k: { up: [40, [40, 3.5, 2.0, 60.0], [19]], down: [0, [0], [0]] } },
  ],
};

test("kinds: 알려진 종류만", () => {
  assert.deepEqual(S.kinds(P), ["up", "down", "ptUp", "ptDown"]);
});

test("rows: 그 종류 이벤트가 있는 증권사만, n<20 은 ok=false", () => {
  const r = S.rows(P, "up");
  assert.deepEqual(r.map((x) => x.firm), ["Alpha", "Beta", "Gamma"]);
  assert.equal(r[0].h[0].ok, true);
  assert.equal(r[0].h[0].avg, 1.2);
  assert.equal(r[1].h[0].ok, false);
  assert.equal(r[1].h[0].n, 12);
  assert.equal(r[2].h[1].ok, false);
  assert.deepEqual(S.rows(P, "down"), [], "건수 0 은 행 없음");
});

test("counts", () => {
  assert.deepEqual(S.counts(P), { up: 3, down: 0, ptUp: 1, ptDown: 0 });
});

test("sortRows: 표본 부족은 방향과 무관하게 맨 뒤", () => {
  const r = S.rows(P, "up");
  assert.deepEqual(S.sortRows(r, "avg0", -1).map((x) => x.firm), ["Gamma", "Alpha", "Beta"]);
  assert.deepEqual(S.sortRows(r, "avg0", 1).map((x) => x.firm), ["Alpha", "Gamma", "Beta"]);
  assert.deepEqual(S.sortRows(r, "avg1", -1).map((x) => x.firm), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(S.sortRows(r, "n", -1).map((x) => x.firm), ["Gamma", "Alpha", "Beta"]);
  assert.deepEqual(S.sortRows(r, "firm", 1).map((x) => x.firm), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(S.sortRows(r, "bogus", -1).map((x) => x.firm), ["Gamma", "Alpha", "Beta"], "모르는 키는 건수순");
});

test("fmtSigned · shortText", () => {
  assert.equal(S.fmtSigned(1.234), "+1.2%p");
  assert.equal(S.fmtSigned(-0.06), "−0.1%p");
  assert.equal(S.fmtSigned(null), "—");
  assert.equal(S.shortText({ n: 7 }), "표본 부족 (7)");
});

test("빈 입력", () => {
  assert.deepEqual(S.rows(null, "up"), []);
  assert.deepEqual(S.kinds({}), []);
});

console.log(`${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(f));
  process.exit(1);
}
