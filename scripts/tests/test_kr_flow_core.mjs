// 국내 증시자금·투자자 동향 순수 계산(kr-flow-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_kr_flow_core.mjs   (CI 의 "KR flow core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../kr-flow-core.js");

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

test("shardOf: 파이썬 shard_of 와 같은 값", () => {
  // scripts/tests/test_kr_market_funds.py::test_flow_shard_of_matches_js_vectors 와 같은 벡터.
  assert.equal(core.shardOf("005930", 32), 29);
  assert.equal(core.shardOf("000660", 32), 28);
  for (const c of ["0001A0", "373220", "900140"]) {
    const s = core.shardOf(c, 32);
    assert.ok(s >= 0 && s < 32);
  }
});

test("fmtSigned: 부호·쉼표·0·결측", () => {
  assert.equal(core.fmtSigned(3189), "+3,189");
  assert.equal(core.fmtSigned(-14649), "-14,649");
  assert.equal(core.fmtSigned(0.4), "0");
  assert.equal(core.fmtSigned(1009825.55), "+1,009,826");
  assert.equal(core.fmtSigned(null), "—");
  assert.equal(core.fmtSigned(NaN), "—");
});

test("fmtPlain: 큰 값은 정수, 작은 소수는 자릿수 유지", () => {
  assert.equal(core.fmtPlain(1009825.55), "1,009,826");
  assert.equal(core.fmtPlain(36.35), "36.4");
  assert.equal(core.fmtPlain(8.5), "8.50");
  assert.equal(core.fmtPlain(8537), "8,537");
  assert.equal(core.fmtPlain(undefined), "—");
});

test("tone", () => {
  assert.equal(core.tone(1), "pos");
  assert.equal(core.tone(-1), "neg");
  assert.equal(core.tone(0), "");
  assert.equal(core.tone(null), "");
});

test("lastN·cumulative·sumKey", () => {
  const rows = [{ d: "a", frn: 1 }, { d: "b", frn: -3 }, { d: "c", frn: 5 }, { d: "d" }];
  assert.deepEqual(core.lastN(rows, 2).map((r) => r.d), ["c", "d"]);
  assert.equal(core.lastN(rows, 0).length, 4);
  assert.deepEqual(core.cumulative([1, -3, 5, null]), [1, -2, 3, 3]);
  assert.equal(core.sumKey(rows, "frn"), 3);
  assert.equal(core.sumKey([{ d: "x" }], "frn"), null);
});

test("delta: 결측 행은 건너뛰고 직전 유효 값과 비교", () => {
  const rows = [{ d: "2026-09-18", dep: 10 }, { d: "2026-09-21", dep: 12 }, { d: "2026-09-22" }];
  const r = core.delta(rows, "dep");
  assert.equal(r.last, 12);
  assert.equal(r.prev, 10);
  assert.equal(r.diff, 2);
  assert.equal(r.date, "2026-09-21");
  assert.equal(core.delta([], "dep"), null);
  assert.equal(core.delta([{ d: "x", dep: 1 }], "dep").diff, null);
});

test("barGeometry: 0 선 기준 위/아래 막대", () => {
  const g = core.barGeometry([10, -10, null], 300, 100, 0);
  assert.equal(g.zeroY, 50);
  assert.equal(g.bars.length, 3);
  assert.equal(g.bars[0].y, 0);
  assert.equal(g.bars[0].h, 50);
  assert.equal(g.bars[1].y, 50);
  assert.equal(g.bars[1].h, 50);
  assert.equal(g.bars[2].h, 0);
  // 전부 양수면 0 선은 바닥
  assert.equal(core.barGeometry([1, 2], 10, 100, 0).zeroY, 100);
});

test("linePath: 점 개수·결측 건너뜀", () => {
  const d = core.linePath([1, 2, null, 4], 400, 100, 0);
  assert.equal((d.match(/[ML]/g) || []).length, 3);
  assert.ok(d.startsWith("M50.0,100.0"));
  assert.equal(core.linePath([], 10, 10), "");
});

test("dailyRows: 샤드 행 → 객체, 등락률 계산", () => {
  const shard = { daily: { "005930": [["20260923", 286500, 10000, -7630126, 4513767, 1346883, 46.63]] } };
  const [r] = core.dailyRows(shard, "005930");
  assert.equal(r.d, "2026-09-23");
  assert.equal(r.close, 286500);
  assert.ok(Math.abs(r.pct - (10000 / 276500) * 100) < 1e-9);
  assert.equal(r.frn, 4513767);
  assert.equal(r.hold, 46.63);
  assert.deepEqual(core.dailyRows(shard, "000000"), []);
  assert.deepEqual(core.dailyRows(null, "005930"), []);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`kr-flow-core: ${passed} passed`);
