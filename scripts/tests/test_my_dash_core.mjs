// 내 대시보드 레이아웃(my-dash-core.js) 단위 테스트. 네트워크·DOM 없음.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../my-dash-core.js");
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); } }

test("sanitize: 깨진 값은 기본, 모르는·다른 시장 전용·중복은 뺀다", () => {
  assert.deepEqual(core.sanitize(null, "us"), core.DEFAULT);
  assert.deepEqual(core.sanitize("x", "kr"), core.DEFAULT);
  assert.deepEqual(core.sanitize(["uoa", "watch", "watch", "nope"], "kr"), ["watch"]);
  assert.deepEqual(core.sanitize(["uoa", "watch"], "us"), ["uoa", "watch"]);
  assert.deepEqual(core.sanitize([], "us"), []);
});

test("add·remove·move·addable", () => {
  let l = ["watch", "issues"];
  l = core.add(l, "breadth", "us");
  assert.deepEqual(l, ["watch", "issues", "breadth"]);
  assert.deepEqual(core.add(l, "watch", "us"), l);
  assert.deepEqual(core.add(l, "uoa", "kr"), l);
  assert.deepEqual(core.move(l, "breadth", -1), ["watch", "breadth", "issues"]);
  assert.deepEqual(core.move(l, "watch", -1), l);
  assert.deepEqual(core.remove(l, "issues"), ["watch", "breadth"]);
  assert.ok(!core.addable(l, "kr").some((w) => w.id === "uoa"));
  assert.ok(core.addable(l, "us").some((w) => w.id === "uoa"));
});

if (failures.length) { console.error(`my-dash-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`); process.exit(1); }
console.log(`my-dash-core: ${passed}개 통과`);
