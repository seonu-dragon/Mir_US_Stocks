// 포트폴리오 위험 분석 순수 계산(portfolio-risk-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_portfolio_risk_core.mjs   (CI 의 "Portfolio risk tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../portfolio-risk-core.js");

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

// 결정적 의사난수(LCG) + 박스-뮬러 — 테스트 재현성.
function rng(seed) {
  let s = seed >>> 0;
  const u = () => { s = (1664525 * s + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}

// ---------------------------------------------------------------- Ledoit-Wolf
// 기대값: scikit-learn 1.8.0 sklearn.covariance.LedoitWolf().fit(X) (assume_centered=False).
const X = [
  [0.01, -0.02, 0.005], [0.003, 0.01, -0.004], [-0.012, 0.004, 0.002], [0.007, -0.001, 0.011],
  [0.0, 0.015, -0.009], [-0.005, -0.008, 0.006], [0.009, 0.002, -0.001], [-0.002, 0.006, 0.004],
];
const SK_SHRINK = 0.6973106641133349;
const SK_COV = [
  [5.907517516098515e-05, -7.151035560322463e-06, 1.0026584251245782e-06],
  [-7.151035560322463e-06, 7.566633438427299e-05, -1.2031901101494939e-05],
  [1.0026584251245782e-06, -1.2031901101494939e-05, 5.438349045474184e-05],
];

test("ledoitWolf matches scikit-learn shrinkage", () => {
  const lw = core.ledoitWolf(X);
  near(lw.shrinkage, SK_SHRINK, 1e-12, "shrinkage");
});

test("ledoitWolf matches scikit-learn covariance", () => {
  const lw = core.ledoitWolf(X);
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) near(lw.cov[i][j], SK_COV[i][j], 1e-17, `cov[${i}][${j}]`);
});

test("ledoitWolf shrinkage within [0,1] and symmetric PD on large sample", () => {
  const g = rng(7);
  const R = Array.from({ length: 500 }, () => { const m = g() * 0.01; return [m + g() * 0.01, m + g() * 0.02, g() * 0.015, 0.5 * m + g() * 0.01]; });
  const lw = core.ledoitWolf(R);
  assert.ok(lw.shrinkage >= 0 && lw.shrinkage <= 1, `shrinkage ${lw.shrinkage}`);
  // 표본이 크면 축소 강도가 작아진다.
  assert.ok(lw.shrinkage < 0.2, `large-sample shrinkage ${lw.shrinkage}`);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) near(lw.cov[i][j], lw.cov[j][i], 1e-18);
});

// ---------------------------------------------------------------- 위험 기여도 · 리스크 패리티
const cov2 = (s1, s2, rho) => [[s1 * s1, rho * s1 * s2], [rho * s1 * s2, s2 * s2]];

test("riskContributions sum to volatility", () => {
  const S = [[0.04, 0.01, 0.0], [0.01, 0.09, 0.02], [0.0, 0.02, 0.0625]];
  const w = [0.5, 0.3, 0.2];
  const rc = core.riskContributions(w, S);
  near(rc.rc.reduce((a, v) => a + v, 0), rc.vol, 1e-14);
  near(rc.pct.reduce((a, v) => a + v, 0), 1, 1e-14);
  near(rc.vol, Math.sqrt(0.5 * 0.5 * 0.04 + 0.3 * 0.3 * 0.09 + 0.2 * 0.2 * 0.0625 + 2 * 0.5 * 0.3 * 0.01 + 2 * 0.3 * 0.2 * 0.02), 1e-14);
});

test("riskParity two assets = inverse volatility for any correlation", () => {
  [-0.3, 0, 0.5, 0.9].forEach((rho) => {
    const rp = core.riskParity(cov2(0.1, 0.2, rho));
    assert.ok(rp.converged, `rho ${rho} not converged`);
    near(rp.weights[0], 2 / 3, 1e-9, `rho ${rho}`);
    near(rp.weights[1], 1 / 3, 1e-9, `rho ${rho}`);
  });
});

test("riskParity converges to equal risk contributions (6 assets)", () => {
  const g = rng(11);
  const R = Array.from({ length: 400 }, () => { const m = g() * 0.01; return Array.from({ length: 6 }, (_, k) => m * (0.4 + k * 0.2) + g() * 0.01 * (1 + k * 0.3)); });
  const S = core.annualize(core.ledoitWolf(R).cov);
  const rp = core.riskParity(S);
  assert.ok(rp.converged);
  near(rp.weights.reduce((a, v) => a + v, 0), 1, 1e-12);
  const pct = core.riskContributions(rp.weights, S).pct;
  pct.forEach((p, i) => near(p, 1 / 6, 1e-8, `asset ${i}`));
});

// ---------------------------------------------------------------- 최소분산
test("minVariance two uncorrelated assets = inverse variance", () => {
  const mv = core.minVariance(cov2(0.1, 0.2, 0));
  near(mv.weights[0], 0.8, 1e-8);
  near(mv.weights[1], 0.2, 1e-8);
});

test("minVariance respects cap", () => {
  const mv = core.minVariance(cov2(0.1, 0.2, 0), { cap: 0.6 });
  near(mv.weights[0], 0.6, 1e-8);
  near(mv.weights[1], 0.4, 1e-8);
  near(mv.effectiveCap, 0.6, 0);
});

test("minVariance cap below 1/n is raised to 1/n (equal weights)", () => {
  const S = [[0.04, 0.01, 0.0], [0.01, 0.09, 0.02], [0.0, 0.02, 0.0625]];
  const mv = core.minVariance(S, { cap: 0.2 });
  near(mv.effectiveCap, 1 / 3, 1e-15);
  mv.weights.forEach((w) => near(w, 1 / 3, 1e-9));
});

test("minVariance long-only beats brute-force grid", () => {
  const S = [[0.04, 0.018, 0.012], [0.018, 0.09, 0.035], [0.012, 0.035, 0.0625]];
  const mv = core.minVariance(S);
  const v = core.portfolioVol(mv.weights, S);
  let best = Infinity;
  for (let a = 0; a <= 1000; a += 2) for (let b = 0; a + b <= 1000; b += 2) {
    best = Math.min(best, core.portfolioVol([a / 1000, b / 1000, 1 - (a + b) / 1000], S));
  }
  assert.ok(v <= best + 1e-9, `mv ${v} grid ${best}`);
  mv.weights.forEach((w) => assert.ok(w >= -1e-12));
  near(mv.weights.reduce((a, x) => a + x, 0), 1, 1e-12);
});

test("minVariance with negative correlation hedge (long-only, one weight at 0 bound)", () => {
  // 세 번째 자산은 변동성이 매우 크고 상관도 높아 비중 0 이 최적.
  const S = [[0.04, 0.0, 0.06], [0.0, 0.04, 0.06], [0.06, 0.06, 0.25]];
  const mv = core.minVariance(S);
  near(mv.weights[2], 0, 1e-9);
  near(mv.weights[0], 0.5, 1e-8);
});

test("projectCappedSimplex sums to 1 and respects bounds", () => {
  const p = core.projectCappedSimplex([0.9, 0.5, -0.2, 0.1], 0.4);
  near(p.reduce((a, v) => a + v, 0), 1, 1e-12);
  p.forEach((v) => assert.ok(v >= -1e-15 && v <= 0.4 + 1e-12));
});

// ---------------------------------------------------------------- 표본 외 · 통합
function syntheticMaps(nAssets, days, seed) {
  const g = rng(seed);
  const maps = Array.from({ length: nAssets }, () => new Map());
  const px = new Array(nAssets).fill(100);
  let d = Date.UTC(2021, 0, 4);
  for (let t = 0; t < days; t += 1) {
    const iso = new Date(d).toISOString().slice(0, 10);
    const m = g() * 0.01;
    for (let k = 0; k < nAssets; k += 1) {
      px[k] *= 1 + m * (0.5 + 0.3 * k) + g() * 0.008 * (1 + k);
      maps[k].set(iso, px[k]);
    }
    d += 86400000 * (new Date(d).getUTCDay() === 5 ? 3 : 1);
  }
  return maps;
}

test("analyzeAllocation returns all schemes and out-of-sample rows", () => {
  const maps = syntheticMaps(4, 500, 3);
  const res = core.analyzeAllocation(maps, [40, 30, 20, 10], { cap: 0.5, lookback: 400 });
  assert.equal(res.days, 400);
  near(res.current.weights[0], 0.4, 1e-15);
  assert.ok(res.minVariance.weights.every((w) => w <= 0.5 + 1e-9));
  assert.ok(res.minVariance.vol <= res.current.vol + 1e-12, "minVar vol <= current vol (in-sample)");
  assert.ok(res.minVariance.vol <= res.riskParity.vol + 1e-12, "minVar vol <= RP vol (in-sample)");
  assert.ok(res.oos && res.oos.rows.length === 4);
  assert.equal(res.oos.inSample.days + res.oos.outSample.days, 400);
  res.oos.rows.forEach((r) => { assert.ok(Number.isFinite(r.vol) && r.vol > 0); assert.ok(r.mdd <= 0); });
});

test("analyzeAllocation too short → error", () => {
  const res = core.analyzeAllocation(syntheticMaps(2, 40, 1), [50, 50]);
  assert.equal(res.error, "short");
});

test("alignCommon keeps only dates present in all maps", () => {
  const a = new Map([["2024-01-02", 1], ["2024-01-03", 2], ["2024-01-04", 3]]);
  const b = new Map([["2024-01-03", 5], ["2024-01-04", 6], ["2024-01-05", 7]]);
  const r = core.alignCommon([a, b]);
  assert.deepEqual(r.dates, ["2024-01-03", "2024-01-04"]);
  assert.deepEqual(r.closes, [[2, 3], [5, 6]]);
});

// ---------------------------------------------------------------- 티어시트
const S1 = (pairs) => pairs.map(([d, v]) => ({ d, v }));

test("drawdownPeriods finds peak/valley/recovery and ranks by depth", () => {
  const vals = [100, 110, 99, 88, 95, 110, 120, 108, 114, 121, 115];
  const series = vals.map((v, i) => ({ d: `2024-01-${String(i + 1).padStart(2, "0")}`, v }));
  const dd = core.drawdownPeriods(series, 5);
  assert.equal(dd.length, 3);
  assert.equal(dd[0].peak, "2024-01-02");
  assert.equal(dd[0].valley, "2024-01-04");
  assert.equal(dd[0].recovery, "2024-01-06");
  near(dd[0].depth, -0.2, 1e-12);
  assert.equal(dd[0].days, 4);
  assert.equal(dd[1].peak, "2024-01-07");
  near(dd[1].depth, 108 / 120 - 1, 1e-12);
  assert.equal(dd[1].recovery, "2024-01-10");
  assert.equal(dd[2].recovered, false);
  assert.equal(dd[2].recovery, null);
  assert.equal(dd[2].days, 1);
});

test("drawdownPeriods top-N limit", () => {
  const vals = [];
  for (let k = 0; k < 8; k += 1) vals.push(100 + k, 100 + k - (k + 1));
  vals.push(200);
  const series = vals.map((v, i) => ({ d: `2024-02-${String(i + 1).padStart(2, "0")}`, v }));
  assert.equal(core.drawdownPeriods(series, 5).length, 5);
});

test("monthlyReturns uses month-end to month-end and flags edge months", () => {
  const series = S1([["2024-01-30", 100], ["2024-01-31", 110], ["2024-02-01", 99], ["2024-02-29", 121], ["2024-03-01", 121]]);
  const m = core.monthlyReturns(series);
  assert.equal(m.length, 3);
  assert.deepEqual([m[0].year, m[0].month], [2024, 1]);
  near(m[0].ret, 0.1, 1e-12);
  near(m[1].ret, 0.1, 1e-12);
  near(m[2].ret, 0, 1e-12);
  assert.equal(m[0].partial, true);
  assert.equal(m[1].partial, false);
  assert.equal(m[2].partial, true);
});

test("yearlyReturns chains across years", () => {
  const series = S1([["2023-12-28", 100], ["2023-12-29", 120], ["2024-06-03", 90], ["2024-12-31", 132], ["2025-01-02", 145.2]]);
  const y = core.yearlyReturns(series);
  assert.deepEqual(y.map((r) => r.year), [2023, 2024, 2025]);
  near(y[0].ret, 0.2, 1e-12);
  near(y[1].ret, 0.1, 1e-12);
  near(y[2].ret, 0.1, 1e-12);
});

test("annualReturn: 252 days compounding to +10% = 10%", () => {
  const r = new Array(252).fill(Math.pow(1.1, 1 / 252) - 1);
  near(core.annualReturn(r), 0.1, 1e-12);
});

test("sortino / downside risk (empyrical formula) hand values", () => {
  const r = [0.01, -0.02, 0.03, -0.01];
  near(core.downsideRisk(r), Math.sqrt((0.0004 + 0.0001) / 4) * Math.sqrt(252), 1e-15);
  near(core.sortino(r), (0.0025 * 252) / (Math.sqrt(0.000125) * Math.sqrt(252)), 1e-12);
});

test("sharpe = mean/std(ddof=1)·√252", () => {
  const r = [0.01, -0.02, 0.03, -0.01];
  const m = 0.0025;
  const sd = Math.sqrt(((0.0075 ** 2) + (0.0225 ** 2) + (0.0275 ** 2) + (0.0125 ** 2)) / 3);
  near(core.sharpe(r), (m / sd) * Math.sqrt(252), 1e-12);
});

test("calmar = annual return / |MDD|", () => {
  const r = [0.1, -0.2, 0.05, 0.1];
  const ann = Math.pow(1.1 * 0.8 * 1.05 * 1.1, 252 / 4) - 1;
  near(core.calmar(r), ann / 0.2, 1e-9 * ann);
});

test("captureRatios: identical returns → 1/1; doubled → >1 up and >1 down", () => {
  const g = rng(5);
  const b = Array.from({ length: 300 }, () => g() * 0.01);
  const same = core.captureRatios(b, b);
  near(same.up, 1, 1e-12);
  near(same.down, 1, 1e-12);
  const dbl = core.captureRatios(b.map((x) => 2 * x), b);
  assert.ok(dbl.up > 1 && dbl.down > 1, `${dbl.up} ${dbl.down}`);
  const half = core.captureRatios(b.map((x) => 0.5 * x), b);
  assert.ok(half.up < 1 && half.down < 1);
});

test("tearsheet assembles metrics with benchmark and rolling window", () => {
  const maps = syntheticMaps(2, 400, 9);
  const dates = [...maps[0].keys()];
  const p = dates.map((d) => ({ d, v: maps[0].get(d) }));
  const b = dates.map((d) => ({ d, v: maps[1].get(d) }));
  const ts = core.tearsheet(p, b);
  assert.ok(ts && ts.benchmark);
  assert.equal(ts.days, 399);
  assert.ok(ts.rolling.length > 20);
  assert.equal(ts.rolling[ts.rolling.length - 1].d, dates[dates.length - 1]);
  assert.ok(Number.isFinite(ts.rolling[0].beta));
  assert.ok(ts.drawdowns.length >= 1 && ts.drawdowns.length <= 5);
  near(ts.benchmark.excessAnnual, ts.annualReturn - ts.benchmark.annualReturn, 1e-15);
  const totalFromMonths = ts.monthly.reduce((acc, m) => acc * (1 + m.ret), 1) - 1;
  near(totalFromMonths, p[p.length - 1].v / p[0].v - 1, 1e-10);
});

// ---------------------------------------------------------------- 과거 위기 재생
test("pathFromMap normalizes, forward-fills and uses lead base", () => {
  const map = new Map([["2020-02-18", 50], ["2020-02-20", 55], ["2020-02-24", 45], ["2020-02-25", 40]]);
  const cal = ["2020-02-19", "2020-02-20", "2020-02-21", "2020-02-24", "2020-02-25"];
  const p = core.pathFromMap(map, cal);
  assert.deepEqual(p.map((v) => Math.round(v)), [1000, 1100, 1100, 900, 800]);
});

test("pathFromMap returns null when not listed at window start", () => {
  const map = new Map([["2020-03-10", 50], ["2020-03-11", 55]]);
  assert.equal(core.pathFromMap(map, ["2020-02-19", "2020-02-20", "2020-03-10", "2020-03-11"]), null);
});

test("olsBeta recovers slope", () => {
  const g = rng(13);
  const x = Array.from({ length: 200 }, () => g() * 0.01);
  const y = x.map((v) => 0.0002 + 1.5 * v);
  const r = core.olsBeta(y, x);
  near(r.beta, 1.5, 1e-12);
  near(r.r2, 1, 1e-12);
});

test("proxyPath β=1 equals index path; β=2 compounds doubled daily returns", () => {
  const idx = [1000, 900, 990];
  assert.deepEqual(core.proxyPath(idx, 1).map((v) => Math.round(v * 1e6) / 1e6), [1000, 900, 990]);
  const p2 = core.proxyPath(idx, 2);
  near(p2[1], 800, 1e-9);
  near(p2[2], 800 * 1.2, 1e-9);
});

test("combinePaths + pathStats", () => {
  const a = [1000, 800, 900];
  const b = [1000, 1000, 1100];
  const port = core.combinePaths([a, b], [75, 25]);
  near(port[1], 850, 1e-9);
  near(port[2], 950, 1e-9);
  const st = core.pathStats(port, ["d0", "d1", "d2"]);
  near(st.ret, -0.05, 1e-12);
  near(st.mdd, -0.15, 1e-12);
  assert.equal(st.troughDate, "d1");
});

test("betaFromMaps aligns on common dates", () => {
  const g = rng(17);
  const s = new Map();
  const p = new Map();
  let ps = 100; let pp = 100;
  for (let k = 0; k < 120; k += 1) {
    const d = new Date(Date.UTC(2023, 0, 2 + k)).toISOString().slice(0, 10);
    const r = g() * 0.01;
    pp *= 1 + r;
    ps *= 1 + 0.8 * r;
    p.set(d, pp);
    if (k % 7 !== 3) s.set(d, ps); // 종목 결측일 — 공통일만 쓰면 결측 사이 수익률이 합쳐져도 β 0.8 근처
  }
  const r = core.betaFromMaps(s, p);
  assert.ok(r && Math.abs(r.beta - 0.8) < 0.02, `beta ${r && r.beta}`);
});

console.log(`portfolio-risk-core: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
