// 시장지표 표기 순수 함수(market-indicators-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_market_indicators_core.mjs   (CI 의 "Market indicators core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../market-indicators-core.js");

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

test("쉼표·자릿수", () => {
  assert.equal(core.fmtNum(4321.2, 2), "4,321.20");
  assert.equal(core.fmtNum(1354.4, 2), "1,354.40");
  assert.equal(core.fmtNum(null, 2), "—");
  assert.equal(core.fmtNum("abc", 2), "—");
});

test("종류별 소수 자릿수", () => {
  assert.equal(core.decimalsFor({ kind: "future", value: 3.225 }), 3);
  assert.equal(core.decimalsFor({ kind: "future", value: 92.41 }), 2);
  assert.equal(core.decimalsFor({ kind: "bond", value: 4.39 }), 3);
  assert.equal(core.decimalsFor({ kind: "fx", value: 859.7 }), 2);
});

test("기준금리는 최소 2자리, 필요하면 3자리", () => {
  assert.equal(core.fmtRate(3), "3.00");
  assert.equal(core.fmtRate(3.875), "3.875");
  assert.equal(core.fmtRate(2.5), "2.50");
  assert.equal(core.fmtRate(null), "—");
});

test("등락 표기: 화살표 + 절대값, %만 부호", () => {
  assert.equal(core.fmtChange(1.23, 0.45, 2), "▲1.23(+0.45%)");
  assert.equal(core.fmtChange(-2.2, -2.325, 2), "▼2.20(-2.33%)");
  assert.equal(core.fmtChange(0, 0, 2), "0.00(0.00%)");
  assert.equal(core.fmtChange(0.07, null, 3), "▲0.070");
  assert.equal(core.fmtChange(null, 1, 2), "—");
  assert.equal(core.fmtChangeAbs(-12.96, 2), "▼12.96");
  assert.equal(core.fmtChangeAbs(1234.5, 2), "▲1,234.50");
});

test("등락률 반올림과 -0 처리", () => {
  assert.equal(core.fmtPct(-0.001), "0.00%");
  assert.equal(core.fmtPct(12.345), "+12.35%");
  assert.equal(core.fmtPct(undefined), "—");
});

test("방향", () => {
  assert.equal(core.direction(1), "up");
  assert.equal(core.direction(-1), "down");
  assert.equal(core.direction(0), "flat");
  assert.equal(core.direction(null), "flat");
});

test("만기월·날짜", () => {
  assert.equal(core.fmtContract("2026-11"), "2026.11");
  assert.equal(core.fmtContract(null), "—");
  assert.equal(core.fmtDate("2026-09-25"), "09.25");
  assert.equal(core.fmtDate("2026-09-25", true), "2026. 09. 25.");
  assert.equal(core.fmtDate(null), "—");
});

test("스파크라인 경로", () => {
  assert.equal(core.sparkPath([[null, 1]], 100, 30), "");
  const d = core.sparkPath([["2026-09-01", 1], ["2026-09-02", 3], [null, 2]], 102, 34, 2);
  assert.equal(d, "M2.0,32.0 L51.0,2.0 L100.0,17.0");
  // 평평한 시리즈도 NaN 없이 그린다
  assert.ok(!core.sparkPath([1, 1, 1], 50, 20).includes("NaN"));
});

test("그룹 묶기(순서 유지)", () => {
  const g = core.groupBy([{ id: "a", group: "x" }, { id: "b", group: "y" }, { id: "c", group: "x" }, null]);
  assert.deepEqual(g.x.map((i) => i.id), ["a", "c"]);
  assert.deepEqual(Object.keys(g), ["x", "y"]);
});

test("오래된 기준일", () => {
  assert.equal(core.isOld("2026-09-01", "2026-09-26", 7), true);
  assert.equal(core.isOld("2026-09-23", "2026-09-26", 7), false);
  assert.equal(core.isOld("", "2026-09-26", 7), false);
});

test("환율 계산기: 1단위당 원화(엔은 100엔 → 1엔)·크로스 계산", () => {
  const items = [
    { id: "USDKRW", group: "fx", value: 1354.4, asOf: "2026-09-26" },
    { id: "EURKRW", group: "fx", value: 1543.2, asOf: "2026-09-25" },
    { id: "JPYKRW", group: "fx", value: 859.7, per: 100, asOf: "2026-09-25" },
    { id: "CNYKRW", group: "fx", value: null },
    { id: "WTI", group: "energy", value: 70 },
  ];
  const r = core.fxRates(items);
  assert.deepEqual(Object.keys(r).sort(), ["EUR", "JPY", "KRW", "USD"]);
  assert.ok(Math.abs(r.JPY.rate - 8.597) < 1e-9);
  assert.equal(r.USD.asOf, "2026-09-26");
  assert.ok(Math.abs(core.fxConvert(1354.4, "KRW", "USD", r) - 1) < 1e-12);
  assert.equal(Math.round(core.fxConvert(100, "USD", "KRW", r)), 135440);
  // 달러 → 유로는 원화를 거친 크로스
  assert.equal(core.fxConvert(1543.2, "USD", "EUR", r).toFixed(4), "1354.4000");
  assert.equal(core.fxConvert(100, "KRW", "CNY", r), null);
  assert.equal(core.fxConvert(null, "KRW", "USD", r), null);
});

test("환율 계산기: 금액 입력 정리·자릿수", () => {
  assert.equal(core.parseAmount("1,000,000"), 1000000);
  assert.equal(core.parseAmount(" 12.5 "), 12.5);
  assert.equal(core.parseAmount(".5"), 0.5);
  assert.equal(core.parseAmount("-3"), null);
  assert.equal(core.parseAmount("abc"), null);
  assert.equal(core.parseAmount(""), null);
  assert.equal(core.fxDecimals("KRW"), 0);
  assert.equal(core.fxDecimals("JPY"), 0);
  assert.equal(core.fxDecimals("USD"), 2);
});

if (failures.length) {
  console.error(`market-indicators-core: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
console.log(`market-indicators-core: ${passed} passed`);
