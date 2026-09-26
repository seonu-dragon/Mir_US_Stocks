// PER 기준 판정(per-basis-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_per_basis_core.mjs   (CI 의 "PER basis core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../per-basis-core.js");

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
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

// 삼성전자 2026-09-26: 현재가 286,500 · 네이버 최근 4분기 EPS 22,292(12.85배) · 2025 연간 EPS 6,564.
test("국내 TTM 기준 — 네이버 최근 4분기 EPS 로 PER", () => {
  const r = core.perBasis({ peBasis: "ttm", epsTtm: 22292, eps: 22292, epsTtmAsOf: "2026.06", epsAnnual: 6564, epsAnnualYear: 2025, pe: 12.85 }, { kr: true, price: 286500 });
  assert.equal(r.basis, "ttm");
  assert.equal(r.eps, 22292);
  near(r.pe, 12.85, 0.01);
  assert.equal(r.label, "PER(최근 4분기)");
  assert.match(r.note, /2026\.06/);
});

test("예전 국내 자료(기준 표식 없음) — epsTtm 에 든 값은 연간으로 본다", () => {
  const r = core.perBasis({ pe: 18.27, eps: 6564, epsTtm: 6564 }, { kr: true, price: 286500 });
  assert.equal(r.basis, "annual");
  near(r.pe, 43.65, 0.01);
  assert.equal(r.label, "PER(연간)");
});

test("국내 연간 기준 — 연도 라벨", () => {
  const r = core.perBasis({ peBasis: "annual", eps: 6564, epsAnnual: 6564, epsAnnualYear: 2025 }, { kr: true, price: 286500 });
  assert.equal(r.label, "PER(2025 연간)");
  assert.equal(r.epsLabel, "EPS(2025 연간)");
});

test("KRX 공식 보강값 — 사업연도 기준 라벨, 원본 PER 유지", () => {
  const r = core.perBasis({ peBasis: "annual-krx", pe: 43.22 }, { kr: true, price: 286500 });
  assert.equal(r.basis, "annual-krx");
  assert.equal(r.pe, 43.22);
  assert.equal(r.label, "PER(사업연도 기준)");
});

test("최근 4분기 적자 — PER 없음", () => {
  const r = core.perBasis({ peBasis: "ttm", epsTtm: -1200, eps: -1200, epsAnnual: 800 }, { kr: true, price: 10000 });
  assert.equal(r.pe, null);
  assert.equal(r.basis, "ttm");
});

test("미국 — epsTtm 은 TTM 으로 현재가 기준 재계산", () => {
  const r = core.perBasis({ epsTtm: 6.5, pe: 30 }, { kr: false, price: 195 });
  assert.equal(r.basis, "ttm");
  near(r.pe, 30, 1e-9);
  assert.equal(r.label, "PER(최근 4분기)");
});

test("EPS 없음 — 순이익÷주식수 폴백(국내는 연간)", () => {
  const r = core.perBasis({}, { kr: true, price: 5000, fallbackEps: 500 });
  assert.equal(r.basis, "annual");
  near(r.pe, 10, 1e-9);
});

test("가격 없음 — 원본 PER 사용", () => {
  const r = core.perBasis({ peBasis: "ttm", epsTtm: 1000, pe: 12.3 }, { kr: true, price: null });
  assert.equal(r.pe, 12.3);
});

test("asOfText 형식", () => {
  assert.equal(core.asOfText("2026.06."), "2026.06");
  assert.equal(core.asOfText("202603"), "2026.03");
  assert.equal(core.asOfText(""), "");
});

if (failures.length) {
  console.error(`per-basis-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`per-basis-core: ${passed}개 통과`);
