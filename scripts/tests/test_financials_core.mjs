// 재무 확장 순수 계산(financials-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_financials_core.mjs   (CI 의 "Financials core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../financials-core.js");

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
const near = (a, b, eps, msg) => assert.ok(a !== null && Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

const q = (fy, fq, end, extra) => Object.assign({ fy, fq, end }, extra);

test("연속 분기 판정: 날짜 간격 75~105일, 없으면 fy·fq 순번", () => {
  assert.equal(core.quartersConsecutive(q(2025, 1, "2025-03-31"), q(2025, 2, "2025-06-30")), true);
  assert.equal(core.quartersConsecutive(q(2025, 1, "2025-03-31"), q(2025, 3, "2025-09-30")), false);
  assert.equal(core.quartersConsecutive({ fy: 2025, fq: 4 }, { fy: 2026, fq: 1 }), true);
  assert.equal(core.quartersConsecutive({ fy: 2025, fq: 2 }, { fy: 2025, fq: 4 }), false);
});

test("TTM 시계열: 연속 4분기 합, 결측·비연속 점은 건너뜀, derived 표시", () => {
  const rows = [
    q(2024, 1, "2024-03-31", { epsDil: 1 }),
    q(2024, 2, "2024-06-30", { epsDil: 1.1 }),
    q(2024, 3, "2024-09-30", { epsDil: 1.2 }),
    q(2024, 4, "2024-12-31", { epsDil: 1.3, d: ["epsDil"] }),
    q(2025, 1, "2025-03-31", { epsDil: 1.4 }),
    q(2025, 2, "2025-06-30", {}),                    // 결측
    q(2025, 3, "2025-09-30", { epsDil: 1.6 }),
  ];
  const s = core.ttmSeries(rows, "epsDil");
  assert.equal(s.length, 2);
  near(s[0].value, 4.6, 1e-9, "첫 TTM");
  assert.equal(s[0].derived, true);
  near(s[1].value, 5.0, 1e-9, "둘째 TTM");
  assert.equal(s[1].end, "2025-03-31");
});

test("TTM 시계열: 끊긴 분기(간격 6개월)는 만들지 않는다", () => {
  const rows = [
    q(2024, 1, "2024-03-31", { rev: 1 }), q(2024, 2, "2024-06-30", { rev: 1 }),
    q(2024, 4, "2024-12-31", { rev: 1 }), q(2025, 1, "2025-03-31", { rev: 1 }),
  ];
  assert.equal(core.ttmSeries(rows, "rev").length, 0);
});

test("실효세율: 세전 ≤ 0 이거나 0~50% 밖이면 null", () => {
  near(core.effectiveTaxRate({ pretax: 100, tax: 21 }), 0.21, 1e-12);
  assert.equal(core.effectiveTaxRate({ pretax: -5, tax: 1 }), null);
  assert.equal(core.effectiveTaxRate({ pretax: 100, tax: 80 }), null);
  assert.equal(core.effectiveTaxRate({ pretax: 100 }), null);
});

test("ROIC: NOPAT ÷ 평균 투하자본(자본+차입금−현금)", () => {
  const prev = { equity: 800, debt: 300, cash: 100 };          // IC 1000
  const row = { op: 250, pretax: 200, tax: 40, equity: 1000, debt: 300, cash: 100 }; // IC 1200, 세율 20%
  near(core.roic(row, prev), 250 * 0.8 / 1100, 1e-12);
  near(core.roic(row, null), 250 * 0.8 / 1200, 1e-12, "기초 없으면 기말");
  assert.equal(core.roic({ ...row, debt: undefined }, prev), null, "차입금 결측 → null");
  assert.equal(core.roic({ op: 10, pretax: 10, tax: 2, equity: 10, debt: 0, cash: 50 }, null), null, "투하자본 ≤ 0");
});

test("순차입금/EBITDA: D&A 결측이면 null, EBITDA ≤ 0 이면 null", () => {
  near(core.netDebtToEbitda({ debt: 500, cash: 100, op: 150, da: 50 }), 2, 1e-12);
  assert.equal(core.netDebtToEbitda({ debt: 500, cash: 100, op: 150 }), null);
  assert.equal(core.netDebtToEbitda({ debt: 500, cash: 100, op: -80, da: 50 }), null);
  near(core.netDebtToEbitda({ netDebt: -300, op: 100, da: 50 }), -2, 1e-12, "파일의 netDebt 우선");
});

test("주식수 증감: 희석 가중평균 우선, 없으면 기말(basic)", () => {
  const a = core.shareChange({ sharesDilAvg: 97 }, { sharesDilAvg: 100 });
  near(a.value, -0.03, 1e-12);
  assert.equal(a.basis, "diluted");
  const b = core.shareChange({ sharesOut: 110 }, { sharesOut: 100 });
  near(b.value, 0.1, 1e-12);
  assert.equal(b.basis, "basic");
  assert.equal(core.shareChange({ sharesOut: 1 }, null).value, null);
});

test("이익의 질: 순이익 ≤ 0 이면 null, FCF 는 ocf−capex 로도", () => {
  near(core.earningsQuality({ ocf: 120, capex: 20, net: 80 }), 1.25, 1e-12);
  assert.equal(core.earningsQuality({ ocf: 120, capex: 20, net: -5 }), null);
  assert.equal(core.fcfOf({ ocf: 10 }), null, "capex 결측이면 FCF 도 결측");
});

test("derivedMetrics: 최근 연간 n개 + 4Q TTM, 전년 행이 연속일 때만 비교", () => {
  const file = {
    flags: [],
    annual: [
      { fy: 2022, rev: 100, op: 10, sharesDilAvg: 100 },
      { fy: 2024, rev: 120, op: 12, sharesDilAvg: 95, sbc: 6 },   // 2023 없음 → 주식수 비교 안 함
      { fy: 2025, rev: 150, op: 30, sharesDilAvg: 90, ocf: 40, capex: 10, net: 20 },
    ],
    quarterly: [
      q(2025, 1, "2025-03-31", { sharesDilAvg: 92 }), q(2025, 2, "2025-06-30", { sharesDilAvg: 91 }),
      q(2025, 3, "2025-09-30", { sharesDilAvg: 90 }), q(2025, 4, "2025-12-31", { sharesOut: 88 }),
      q(2026, 1, "2026-03-31", { sharesDilAvg: 87 }),
    ],
    ttm: { basis: "4Q", fy: 2026, fq: 1, rev: 160, op: 32, ocf: 44, capex: 12, net: 25 },
  };
  const { cols, suppressed } = core.derivedMetrics(file, 5);
  assert.equal(cols.length, 4);
  assert.equal(cols[1].metrics.shareChange, null, "비연속 연도");
  near(cols[2].metrics.shareChange, 90 / 95 - 1, 1e-12);
  near(cols[2].metrics.fcfMargin, 30 / 150, 1e-12);
  near(cols[1].metrics.sbcToRevenue, 0.05, 1e-12);
  assert.equal(cols[3].key, "TTM");
  near(cols[3].metrics.fcf, 32, 1e-12);
  near(cols[3].metrics.shareChange, 87 / 92 - 1, 1e-12, "최근 분기 vs 1년 전 같은 분기");
  assert.equal(suppressed.size, 0);
});

test("금융업은 FCF·ROIC·순차입금 계열을 표시에서 뺀다", () => {
  const s = core.suppressedMetrics({ flags: ["financial"] });
  assert.ok(s.has("fcf") && s.has("roic") && s.has("netDebtToEbitda"));
  assert.ok(!s.has("shareChange"));
});

test("TTM 이 FY 기준이면(분기 없음) 표에 TTM 열을 만들지 않는다", () => {
  const { cols } = core.derivedMetrics({ annual: [{ fy: 2024, rev: 1 }], quarterly: [], ttm: { basis: "FY", fy: 2024 } }, 5);
  assert.equal(cols.length, 1);
});

test("series: 비율 계열 계산·결측 null 유지", () => {
  const s = core.series({ annual: [{ fy: 2025, rev: 200, op: 50 }, { fy: 2026, op: 10 }] }, "annual", ["rev", "opMargin"]);
  near(s[0].opMargin, 0.25, 1e-12);
  assert.equal(s[1].rev, null);
  assert.equal(s[1].opMargin, null);
  assert.equal(s[0].label, "FY2025");
});

if (failures.length) {
  console.error(`financials-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error("  ✕ " + f));
  process.exit(1);
}
console.log(`financials-core: ${passed}개 통과`);
