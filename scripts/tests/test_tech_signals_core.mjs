// 종목별 기술적 신호 파생(tech-signals-core.js) 단위 테스트. 네트워크·DOM·파일 없음.
// 실행: node scripts/tests/test_tech_signals_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../tech-signals-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

// scripts/tech_signals_core.py COLS 와 같은 순서.
const COLS = ["rs", "rsnh", "rsnhb", "c1", "s20", "s20p", "s50", "s50p",
  "r14", "r14p", "xu20", "xd20", "xu50", "xd50", "nh20", "mxu", "mxd"];
const payload = (tickers) => ({ cols: COLS, baseDate: "2026-10-22", benchmark: { ticker: "SPY", label: "S&P 500 ETF (SPY)" }, tickers });
const rowOf = (over) => COLS.map((c) => (Object.prototype.hasOwnProperty.call(over, c) ? over[c] : null));

test("decode: cols 순서대로 이름을 붙이고 없는 종목은 null", () => {
  const p = payload({ AAA: rowOf({ rs: 87, c1: 10.5 }) });
  const row = core.decode(p, "AAA");
  assert.equal(row.rs, 87);
  assert.equal(row.c1, 10.5);
  assert.equal(row.s20, null);
  assert.equal(core.decode(p, "ZZZ"), null);
  assert.equal(core.decode(null, "AAA"), null);
});

test("decode: 소문자 티커도 대문자 키로 찾는다", () => {
  const p = payload({ AAA: rowOf({ rs: 50 }) });
  assert.equal(core.decode(p, "aaa").rs, 50);
});

test("within: 창 안이면 1, 밖이면 0, 사건이 없으면 0(결측이 아니다)", () => {
  assert.equal(core.within(0, 5), 1);
  assert.equal(core.within(5, 5), 1);
  assert.equal(core.within(6, 5), 0);
  assert.equal(core.within(null, 5), 0);
  assert.equal(core.within(undefined, 3), 0);
});

test("fields: 전일값·교차 파생이 이름 있는 필드로 나온다", () => {
  const p = payload({ AAA: rowOf({ rs: 92, rsnh: 1, rsnhb: 0, c1: 100, s20: 102, s20p: 101, s50: 98, s50p: 97.5,
    r14: 61.5, r14p: 55.25, xu20: 2, xd50: 9, nh20: 0, mxu: 1 }) });
  const f = core.rowFields(p, "AAA");
  assert.equal(f.rsRating, 92);
  assert.equal(f.rsNewHigh, 1);
  assert.equal(f.rsNewHighBeforePrice, 0);
  assert.equal(f.close_1d, 100);
  assert.equal(f.sma20_1d, 101);
  assert.equal(f.sma50_1d, 97.5);
  assert.equal(f.rsi_1d, 55.25);
  assert.equal(f.rsiChg1d, 6.25);
  assert.equal(f.crossUpSma20Bars, 2);
  assert.equal(f.crossUpSma20Within5, 1);
  assert.equal(f.crossDownSma50Bars, 9);
  assert.equal(f.crossDownSma50Within5, 0);     // 9봉 전 = 5일 창 밖
  assert.equal(f.newHigh20Within5, 1);
  assert.equal(f.macdCrossUpWithin3, 1);
  assert.equal(f.macdCrossDownWithin3, 0);      // 사건 없음 → 거짓
});

test("fields: 없는 값은 0 이 아니라 결측(null)로 남는다", () => {
  const p = payload({ AAA: rowOf({}) });
  const f = core.rowFields(p, "AAA");
  assert.equal(f.rsRating, null);
  assert.equal(f.rsNewHigh, null);
  assert.equal(f.close_1d, null);
  assert.equal(f.rsi_1d, null);
  assert.equal(f.rsiChg1d, null);
  assert.equal(f.crossUpSma20Bars, null);
  assert.equal(f.crossUpSma20Within5, 0);       // 불리언은 '관측 창에 사건 없음' = 거짓
});

test("fields: 종목이 없으면 null", () => {
  assert.equal(core.rowFields(payload({}), "AAA"), null);
});

test("rsBand: 등급 구간 문구", () => {
  assert.equal(core.rsBand(95), "상위 10%");
  assert.equal(core.rsBand(70), "상위 30%");
  assert.equal(core.rsBand(55), "중상위");
  assert.equal(core.rsBand(31), "중하위");
  assert.equal(core.rsBand(5), "하위 30%");
  assert.equal(core.rsBand(null), "");
});

if (failures.length) {
  console.error(`tech signals core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`tech signals core: ${passed}개 통과`);
