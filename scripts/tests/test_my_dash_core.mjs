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

test("upcomingEarnings: 30일 안·날짜순, 지난 날짜·깨진 값 제외", () => {
  const rows = [
    { ticker: "B", nextDate: "2026-11-05" }, { ticker: "A", nextDate: "2026-10-22" },
    { ticker: "C", nextDate: "2026-10-01" }, { ticker: "D", nextDate: "2027-01-30" }, { ticker: "E", nextDate: "" },
  ];
  const out = core.upcomingEarnings(rows, "2026-10-22", 30);
  assert.deepEqual(out.map((r) => [r.ticker, r.daysAhead]), [["A", 0], ["B", 14]]);
  assert.deepEqual(core.upcomingEarnings(rows, "bad"), []);
});

test("relatedIndicators: 내 종목 여럿이 따르는 지표가 위, 중복 종목 한 번", () => {
  const by = { AAPL: ["sc_mobile_ios", "nyfed_gscpi"], "005930": ["sc_vendor_samsung", "sc_mobile_ios"], X: ["fao_food_price"] };
  const out = core.relatedIndicators(by, ["AAPL", "005930", "AAPL", "NONE"], 2);
  assert.deepEqual(out, [{ id: "sc_mobile_ios", tickers: ["AAPL", "005930"] }, { id: "nyfed_gscpi", tickers: ["AAPL"] }]);
  assert.deepEqual(core.relatedIndicators(null, ["AAPL"]), []);
});

if (failures.length) { console.error(`my-dash-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`); process.exit(1); }
console.log(`my-dash-core: ${passed}개 통과`);
