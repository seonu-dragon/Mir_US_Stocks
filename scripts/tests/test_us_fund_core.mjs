// 미국 펀더멘털 카드(us-fund-core.js) 단위 테스트 — 부채 만기 사다리·Pay vs Performance·주간 베타·ROIC − WACC.
// 네트워크·DOM 없음. 실행: node scripts/tests/test_us_fund_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const uf = require("../../us-fund-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const near = (a, b, eps, msg) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

// AAPL FY2025 10-K 만기표(2026-10-23 companyfacts 실값)
const AAPL = {
  market: "us", currency: "USD", flags: [], industryType: "general",
  annual: [
    { fy: 2024, end: "2024-09-28", op: 123216e6, pretax: 123485e6, tax: 29749e6, equity: 56950e6, debt: 106629e6, cash: 29943e6, interest: null },
    { fy: 2025, end: "2025-09-27", op: 133050e6, pretax: 132729e6, tax: 20719e6, equity: 73733e6, debt: 98679e6, cash: 35934e6, interest: 3000e6 },
  ],
  debtMaturity: { end: "2025-09-27", fy: 2025, filed: "2025-10-31", y1: 12393e6, y2: 10078e6, y3: 9300e6, y4: 5235e6, y5: 4972e6, after: 49303e6 },
};

test("만기 사다리: 버킷·합계·1년 이내 비중·현금 대비", () => {
  const lad = uf.debtLadder(AAPL);
  assert.equal(lad.buckets.length, 6);
  near(lad.total, 91281e6, 1, "합계");
  near(lad.y1Share, 12393 / 91281, 1e-9);
  near(lad.cashToY1, 35934 / 12393, 1e-9);
  assert.deepEqual(lad.missing, []);
});

test("만기 사다리: 5년 이후 미공시는 missing, 버킷 1개·KR·없음은 null", () => {
  const ko = { ...AAPL, debtMaturity: { end: "2025-09-27", fy: 2025, y1: 1822, y2: 4817, y3: 2923, y4: 2955, y5: 3411 } };
  assert.deepEqual(uf.debtLadder(ko).missing, ["5년 이후"]);
  assert.equal(uf.debtLadder({ ...AAPL, debtMaturity: { end: "x", y1: 5 } }), null);
  assert.equal(uf.debtLadder({ ...AAPL, market: "kr" }), null);
  assert.equal(uf.debtLadder({ ...AAPL, debtMaturity: undefined }), null);
});

test("만기 사다리: 1년 이내 0(META) → 비중 0, 현금 대비 null", () => {
  const meta = { ...AAPL, debtMaturity: { end: "2025-09-27", y1: 0, y2: 2750, after: 48750 } };
  const lad = uf.debtLadder(meta);
  assert.equal(lad.y1Share, 0);
  assert.equal(lad.cashToY1, null);
});

test("Pay vs Performance: 최근 5년 오름차순, 음수 실지급 보존, 보수 없는 해 제외", () => {
  const rows = [2020, 2021, 2022, 2023, 2024, 2025].map((y, i) => ({ end: `${y}-12-31`, peoTotal: 10e6 + i, peoCap: i === 2 ? -4e6 : 20e6, tsr: 100 + i, filed: "2026-04-01", accn: "0000000000-26-000001" }));
  rows.push({ end: "2026-12-31", tsr: 130 });                      // 보수 없음 → 빠짐
  const p = uf.payVsPerf({ market: "us", payVsPerf: rows });
  assert.equal(p.rows.length, 5);
  assert.equal(p.rows[0].year, "2021");
  assert.equal(p.rows[1].peoCap, -4e6);
  assert.equal(p.hasPeo, true);
  assert.equal(p.hasPeer, false);
  assert.equal(p.maxComp, 20e6);
  assert.equal(uf.payVsPerf({ market: "us", payVsPerf: [{ end: "2025-12-31", tsr: 140 }] }), null);
  assert.equal(uf.payVsPerf({ market: "us" }), null);
});

test("Pay vs Performance: CEO 값이 없는 회사(AMZN)는 hasPeo=false", () => {
  const p = uf.payVsPerf({ market: "us", payVsPerf: [{ end: "2025-12-31", neoTotal: 2e7, neoCap: -1e6, tsr: 142 }] });
  assert.equal(p.hasPeo, false);
  assert.equal(p.rows[0].peoTotal, null);
});

// 합성 일봉: 시장 주간 수익률 m, 종목 = 1.5 × m (+ 상수) → 베타 1.5
function synth(weeks, k, alpha) {
  const mk = [], st = [];
  let pm = 100, ps = 50;
  const t0 = Date.UTC(2024, 0, 1);                                   // 월요일
  for (let w = 0; w < weeks; w++) {
    const r = Math.sin(w * 1.7) * 0.02 + (w % 3 === 0 ? 0.01 : -0.004);
    pm *= 1 + r;
    ps *= 1 + k * r + alpha;
    for (let d = 0; d < 5; d++) {
      const date = new Date(t0 + (w * 7 + d) * 86400000).toISOString().slice(0, 10);
      // 주 중간 값은 금요일 종가와 달라도 된다(주 마지막 거래일만 쓴다)
      const fm = d === 4 ? pm : pm * 0.97, fs = d === 4 ? ps : ps * 1.03;
      mk.push([fm, fm, fm, fm, 1, date]);
      st.push([fs, fs, fs, fs, 1, date]);
    }
  }
  return { mk, st };
}

test("주간 베타: 합성 1.5배 → 1.5, 104주 창, R² 1", () => {
  const { mk, st } = synth(130, 1.5, 0);
  const b = uf.weeklyBeta(st, mk);
  near(b.beta, 1.5, 1e-9);
  assert.equal(b.n, 104);
  near(b.r2, 1, 1e-9);
});

test("주간 베타: 78주 미만이면 null, 빈 주는 건너뛴다", () => {
  const { mk, st } = synth(60, 1.2, 0);
  assert.equal(uf.weeklyBeta(st, mk), null);
  const big = synth(120, 0.8, 0.001);
  // 시장 쪽 한 주(10번째 주) 통째로 빠짐 → 그 주를 끼는 두 수익률이 빠진다
  const holes = big.mk.filter((_, i) => Math.floor(i / 5) !== 10);
  const b = uf.weeklyBeta(big.st, holes);
  near(b.beta, 0.8, 1e-9);
  assert.equal(b.n, 104);
});

test("ROIC − WACC: 구성요소·가중치·스프레드", () => {
  const w = uf.roicWacc({ file: AAPL, marketCap: 4000e9, beta: 1.2, rfPct: 4.0, erp: 0.05 });
  const t = 20719 / 132729;
  near(w.tax, t, 1e-12);
  const ic = ((56950 + 106629 - 29943) + (73733 + 98679 - 35934)) / 2 * 1e6;
  near(w.roic, (133050e6 * (1 - t)) / ic, 1e-12, "ROIC");
  near(w.ke, 0.04 + 1.2 * 0.05, 1e-12, "Ke");
  near(w.kd, 3000 / ((98679 + 106629) / 2), 1e-12, "Kd");
  const E = 4000e9, D = 98679e6;
  near(w.wacc, (E / (E + D)) * w.ke + (D / (E + D)) * w.kd * (1 - t), 1e-12, "WACC");
  near(w.spread, w.roic - w.wacc, 1e-15);
});

test("ROIC − WACC: 구성요소가 없으면 WACC·스프레드 null(값을 지어내지 않는다)", () => {
  assert.equal(uf.roicWacc({ file: AAPL, marketCap: 4000e9, beta: null, rfPct: 4 }).wacc, null);
  assert.equal(uf.roicWacc({ file: AAPL, marketCap: 4000e9, beta: 1, rfPct: null }).spread, null);
  const noInt = { ...AAPL, annual: [AAPL.annual[0], { ...AAPL.annual[1], interest: undefined }] };
  const w = uf.roicWacc({ file: noInt, marketCap: 4000e9, beta: 1, rfPct: 4 });
  assert.equal(w.kd, null);
  assert.equal(w.wacc, null);
  assert.ok(w.roic !== null);
  // Kd 25% 초과(태그 차이) → null
  const hi = { ...AAPL, annual: [AAPL.annual[0], { ...AAPL.annual[1], interest: 40e9 }] };
  assert.equal(uf.roicWacc({ file: hi, marketCap: 4000e9, beta: 1, rfPct: 4 }).kd, null);
});

test("ROIC − WACC: 무차입이면 WACC = Ke, 금융업·비USD는 null, ERP 기본값", () => {
  const nd = { ...AAPL, annual: [AAPL.annual[0], { ...AAPL.annual[1], debt: 0, interest: 0 }] };
  const w = uf.roicWacc({ file: nd, marketCap: 1e12, beta: 1, rfPct: 4, erp: 0.04 });
  assert.equal(w.noDebt, true);
  near(w.wacc, 0.08, 1e-12);
  assert.equal(uf.roicWacc({ file: { ...AAPL, flags: ["financial"] }, marketCap: 1e12, beta: 1, rfPct: 4 }), null);
  assert.equal(uf.roicWacc({ file: { ...AAPL, currency: "EUR" }, marketCap: 1e12, beta: 1, rfPct: 4 }), null);
  assert.equal(uf.roicWacc({ file: AAPL, marketCap: 1e12, beta: 1, rfPct: 4 }).erp, uf.DEFAULT_ERP);
});

if (failures.length) {
  console.error(`us-fund-core: ${failures.length} failed, ${passed} passed`);
  failures.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log(`us-fund-core: ${passed} passed`);
