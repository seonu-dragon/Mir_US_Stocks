// 역DCF · 사용자 가정 DCF 순수 계산(dcf-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_dcf_core.mjs   (CI 의 "DCF core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../dcf-core.js");

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

// ── 알려진 DCF 값 ──
test("영구연금 항등식: g=0, tg=0, r=10% → FCF/r 와 같다", () => {
  const pv = core.pvGrowth(100, 0, 0.1, 0, 10);
  near(pv.total, 1000, 1e-9);
});

test("2단계 DCF 닫힌 식과 일치", () => {
  const f0 = 100, g = 0.05, r = 0.1, tg = 0.02;
  const q = (1 + g) / (1 + r);
  const explicit = f0 * q * (1 - Math.pow(q, 10)) / (1 - q);
  const terminal = f0 * Math.pow(1 + g, 10) * (1 + tg) / (r - tg) / Math.pow(1 + r, 10);
  const pv = core.pvGrowth(f0, g, r, tg, 10);
  near(pv.explicit, explicit, 1e-9);
  near(pv.terminal, terminal, 1e-9);
  near(pv.total, explicit + terminal, 1e-9);
  assert.ok(pv.terminalShare > 0.5 && pv.terminalShare < 1);
});

test("r ≤ tg 이면 null", () => {
  assert.equal(core.pvGrowth(100, 0.05, 0.02, 0.03, 10), null);
});

// ── 역산 수렴 ──
test("역산이 알려진 성장률을 되찾는다(여러 값)", () => {
  for (const g of [-0.1, 0, 0.037, 0.12, 0.3]) {
    const ev = core.pvGrowth(250, g, 0.092, 0.025, 10).total;
    const res = core.impliedGrowth({ ev, fcf0: 250, r: 0.092, tg: 0.025 });
    assert.ok(res.ok && res.bound === null, `g=${g}`);
    near(res.g, g, 1e-6, `g=${g}`);
    assert.ok(res.iterations > 10 && res.iterations < 200);
  }
});

test("범위 밖은 bound 로 알리고 값을 지어내지 않는다", () => {
  const hi = core.impliedGrowth({ ev: 1e12, fcf0: 1, r: 0.09, tg: 0.025 });
  assert.equal(hi.bound, "above");
  assert.equal(hi.g, 1.0);
  const lo = core.impliedGrowth({ ev: 1, fcf0: 1e6, r: 0.09, tg: 0.025 });
  assert.equal(lo.bound, "below");
});

test("음수 FCF·음수 EV·r≤tg 는 계산 거부", () => {
  assert.equal(core.impliedGrowth({ ev: 1000, fcf0: -5, r: 0.09, tg: 0.025 }).code, "negativeFcf");
  assert.equal(core.impliedGrowth({ ev: 1000, fcf0: 0, r: 0.09, tg: 0.025 }).code, "negativeFcf");
  assert.equal(core.impliedGrowth({ ev: -10, fcf0: 5, r: 0.09, tg: 0.025 }).code, "negativeEv");
  assert.equal(core.impliedGrowth({ ev: 1000, fcf0: 5, r: 0.02, tg: 0.025 }).code, "rate");
});

// ── 종목 파일 ──
function file(over = {}) {
  return {
    schema: 1, market: "us", ticker: "TEST", currency: "USD", industryType: "general", flags: [],
    annual: [
      { fy: 2022, end: "2022-12-31", rev: 800, op: 160, net: 120, fcf: 90, tax: 30, pretax: 150, sharesDilAvg: 100 },
      { fy: 2023, end: "2023-12-31", rev: 900, op: 180, net: 140, fcf: 110, tax: 35, pretax: 175, sharesDilAvg: 100 },
      { fy: 2024, end: "2024-12-31", rev: 1000, op: 200, net: 150, fcf: 130, tax: 40, pretax: 200, sharesDilAvg: 100, netDebt: 50 },
    ],
    quarterly: [{ fy: 2025, fq: 2, end: "2025-06-30", sharesDilAvg: 98 }],
    ttm: { basis: "4Q", fy: 2025, fq: 2, quarters: ["2024Q3", "2024Q4", "2025Q1", "2025Q2"], end: "2025-06-30",
      rev: 1100, op: 220, net: 160, fcf: 140, tax: 42, pretax: 210, netDebt: 40, sharesOut: 97 },
    ...over,
  };
}

test("기준 FCF: 보수적 = 작은 쪽(3년 평균 110 < TTM 140)", () => {
  const o = core.baseFcfOptions(file());
  assert.equal(o.ttm.value, 140);
  near(o.avg3.value, 110, 1e-9);
  assert.equal(o.conservative, "avg3");
});

test("희석 주식수: TTM 평균 없으면 최근 분기 희석 가중평균", () => {
  const s = core.dilutedShares(file());
  assert.equal(s.value, 98);
  assert.equal(s.basic, false);
});

test("reverseDcf: EV = 현재가×희석주식수 + 순차입금, 성장률 역산", () => {
  const f = file();
  const res = core.reverseDcf(f, { price: 30, r: 0.09, tg: 0.025 });
  assert.ok(res.ok, res.reason);
  assert.equal(res.basis, "avg3");
  near(res.marketCap, 30 * 98, 1e-9);
  near(res.ev, 30 * 98 + 40, 1e-9);
  near(core.pvGrowth(110, res.g, 0.09, 0.025, 10).total, res.ev, 1e-3);
  const t = core.reverseDcf(f, { price: 30, r: 0.09, tg: 0.025, basis: "ttm" });
  assert.equal(t.basis, "ttm");
  assert.ok(t.g < res.g, "기준 FCF 가 크면 필요한 성장률은 낮다");
});

test("음수 FCF(두 기준 모두) → 계산 안 함 + 이유", () => {
  const f = file();
  f.ttm.fcf = -10;
  f.annual.forEach((r) => { r.fcf = -5; });
  const el = core.eligibility(f, "us");
  assert.equal(el.ok, false);
  assert.equal(el.code, "negativeFcf");
  assert.ok(el.reason.length > 5);
});

test("보수적 기준만 음수면 다른 기준으로는 계산 가능(선택 시)", () => {
  const f = file();
  f.annual[0].fcf = -400;   // 3년 평균 음수, TTM 양수
  assert.equal(core.eligibility(f, "us").ok, true);
  const res = core.reverseDcf(f, { price: 30, r: 0.09, tg: 0.025 });
  assert.equal(res.code, "negativeFcf");   // 기본(보수적)은 평균 → 거부
  const t = core.reverseDcf(f, { price: 30, r: 0.09, tg: 0.025, basis: "ttm" });
  assert.ok(t.ok);
});

test("적자·금융업·통화 불일치·해외발행인 거부", () => {
  assert.equal(core.eligibility(file({ ttm: { ...file().ttm, net: -1 } }), "us").code, "loss");
  assert.equal(core.eligibility(file({ industryType: "bank", flags: ["financial"] }), "us").code, "financial");
  assert.equal(core.eligibility(file({ industryType: "insurance" }), "us").code, "financial");
  assert.equal(core.eligibility(file({ currency: "EUR" }), "us").code, "currency");
  assert.equal(core.eligibility(file({ flags: ["foreignFiler"] }), "us").code, "adr");
});

test("순차입금 결측: 현금만 있으면 −현금, 둘 다 없으면 0 + 표시", () => {
  const f = file();
  delete f.ttm.netDebt; delete f.annual[2].netDebt;
  f.ttm.cash = 70;
  const a = core.netDebtOf(f);
  assert.equal(a.value, -70);
  assert.ok(a.note);
  delete f.ttm.cash;
  const b = core.netDebtOf(f);
  assert.equal(b.value, 0);
  assert.ok(b.note);
});

test("할인율 기본값: rf + ERP, 없으면 고정 기본값", () => {
  const d = core.defaultDiscount("us", 4.5);
  near(d.r, 0.045 + core.ERP.us.value, 1e-12);
  assert.equal(d.fallback, false);
  const k = core.defaultDiscount("kr", 4.0);
  near(k.r, 0.04 + core.ERP.kr.value, 1e-12);
  assert.ok(core.ERP.kr.value > core.ERP.us.value);
  const n = core.defaultDiscount("us", null);
  assert.equal(n.r, core.FALLBACK_DISCOUNT);
  assert.equal(n.fallback, true);
  for (const m of ["us", "kr"]) assert.ok(core.ERP[m].source && core.ERP[m].asOf);
});

// ── 사용자 DCF ──
test("사용자 DCF: 성장 0·마진 고정이면 영구연금과 같다", () => {
  const s = { g1: 0, g2: 0, margin: 0.2, tax: 0.25, reinvest: 0 };
  const v = core.scenarioValue(s, { r: 0.1, tg: 0 }, { rev0: 1000, margin0: 0.2, netDebt: 100, shares: 10 });
  // FCF = 1000×0.2×0.75 = 150 영구 → EV 1500, 주당 (1500−100)/10 = 140
  near(v.ev, 1500, 1e-6);
  near(v.perShare, 140, 1e-6);
});

test("사용자 DCF: 마진은 5년에 걸쳐 목표로 수렴", () => {
  const s = { g1: 0, g2: 0, margin: 0.3, tax: 0, reinvest: 0 };
  const v = core.scenarioValue(s, { r: 0.1, tg: 0.02 }, { rev0: 100, margin0: 0.1, netDebt: 0, shares: 1 });
  near(v.rows[0].margin, 0.14, 1e-12);
  near(v.rows[4].margin, 0.3, 1e-12);
  near(v.rows[9].margin, 0.3, 1e-12);
});

test("시나리오 기본값: 약세 < 기본 < 강세 주당 가치", () => {
  const f = file();
  const d = core.defaultScenarios(f, "us");
  const base = { rev0: d.base.rev0, margin0: d.base.margin0, netDebt: 40, shares: 98 };
  const common = { r: 0.09, tg: 0.025 };
  const vals = ["bear", "base", "bull"].map((k) => core.scenarioValue(d.scenarios[k], common, base).perShare);
  assert.ok(vals[0] < vals[1] && vals[1] < vals[2], JSON.stringify(vals));
  near(d.scenarios.base.tax, 42 / 210, 1e-4);
});

// ── 민감도 격자 ──
test("민감도 격자: 5×5, 중앙 = 기본 계산, 할인율↑ → 가치↓, 영구성장↑ → 가치↑, r≤tg 는 null", () => {
  const s = { g1: 0.08, g2: 0.04, margin: 0.2, tax: 0.2, reinvest: 0.3 };
  const base = { rev0: 1000, margin0: 0.18, netDebt: 50, shares: 10 };
  const common = { r: 0.09, tg: 0.025 };
  const g = core.sensitivityGrid(s, common, base);
  assert.equal(g.rs.length, 5);
  assert.equal(g.tgs.length, 5);
  near(g.cells[2][2], core.scenarioValue(s, common, base).perShare, 1e-9);
  for (let i = 1; i < 5; i++) assert.ok(g.cells[i][2] < g.cells[i - 1][2]);
  for (let j = 1; j < 5; j++) assert.ok(g.cells[2][j] > g.cells[2][j - 1]);
  const tight = core.sensitivityGrid(s, { r: 0.03, tg: 0.03 }, base, { rStep: 0.005, tgStep: 0.005 });
  assert.equal(tight.cells[0][4], null);
});

// ── 기저율 ──
test("fractionAtLeast: 경계 포함", () => {
  const a = [-5, 0, 3, 3, 8, 12];
  assert.equal(core.fractionAtLeast(a, 3), 4 / 6);
  assert.equal(core.fractionAtLeast(a, 100), 0);
  assert.equal(core.fractionAtLeast(a, -100), 1);
  assert.equal(core.fractionAtLeast([], 1), null);
});

test("baseRate: 긴 기간 우선, 규모 구간 부족하면 전체 규모로", () => {
  const arr = (n, v) => Array.from({ length: n }, (_, i) => v + i * 0.1);
  const dist = { markets: { us: {
    buckets: [{ label: "소형", min: null, max: 1e9 }, { label: "대형", min: 1e9, max: null }],
    horizons: {
      "9": { period: "FY2015~2025", buckets: [{ fcf: arr(5, 1) }, { fcf: arr(30, 2), fcfExcluded: 4 }], all: { fcf: arr(35, 1) } },
      "5": { buckets: [{ fcf: arr(40, 0) }, { fcf: arr(40, 0) }], all: { fcf: arr(80, 0) } },
    },
  } } };
  const big = core.baseRate(dist, "us", 5e9, 0.02, "fcf");
  assert.equal(big.ok, true);
  assert.equal(big.horizon, 9);
  assert.equal(big.bucket, "대형");
  assert.equal(big.n, 30);
  assert.equal(big.excluded, 4);
  const small = core.baseRate(dist, "us", 1e8, 0.02, "fcf");
  assert.equal(small.bucket, "전체 규모");
  assert.equal(small.horizon, 9);
  const none = core.baseRate({ markets: {} }, "us", 1, 0.1, "fcf");
  assert.equal(none.ok, false);
});

// ── URL 인코딩 ──
test("상태 인코딩 왕복 + 잘못된 문자열 거부", () => {
  const state = { r: 0.0932, tg: 0.025, scenarios: {
    bear: { g1: 0.03, g2: 0.02, margin: 0.15, tax: 0.2, reinvest: 0.5 },
    base: { g1: 0.08, g2: 0.04, margin: 0.2, tax: 0.2, reinvest: 0.4 },
    bull: { g1: 0.13, g2: 0.06, margin: 0.25, tax: 0.2, reinvest: 0.3 },
  } };
  const s = core.encodeState(state);
  const back = core.decodeState(s);
  near(back.r, 0.0932, 1e-9);
  near(back.scenarios.bull.margin, 0.25, 1e-9);
  assert.equal(core.decodeState("garbage"), null);
  assert.equal(core.decodeState("2,9|1,1,1,1,1|1,1,1,1,1|1,1,1,1,1"), null, "r ≤ tg 거부");
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`dcf-core: ${passed} passed`);
