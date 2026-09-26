// 스크리너 백테스트(screener-backtest-core.js) + 과적합 검사(overfit-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_screener_backtest_core.mjs   (CI 의 "Screener backtest tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const bt = require("../../screener-backtest-core.js");
const of = require("../../overfit-core.js");
const fx = require("../../formula-core.js");

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

// ---------- 합성 패널 ----------
// n 종목 × K 기간. fwdFn(t,k) → 기간 수익률, fieldFns: { name: (t,k) → 값 }
function makePanel(n, K, fwdFn, fieldFns) {
  const meta = {
    dates: Array.from({ length: K }, (_, k) => `2020-${String((k % 12) + 1).padStart(2, "0")}-28`),
    execDates: Array.from({ length: K }, (_, k) => `x${k}`),
    periodEnd: "end",
    tickers: Array.from({ length: n }, (_, t) => `T${t}`),
    sectors: Array.from({ length: n }, (_, t) => (t % 2 ? "A" : "B")),
    industries: Array.from({ length: n }, () => "I"),
    benchmarkFwd: Array.from({ length: K }, () => 0.01),
    periodsPerYear: 12,
    fields: {},
  };
  const fwd = new Float64Array(n * K);
  for (let t = 0; t < n; t++) for (let k = 0; k < K; k++) fwd[t * K + k] = fwdFn(t, k);
  const columns = {};
  for (const [name, fn] of Object.entries(fieldFns)) {
    const col = new Float64Array(n * K);
    const cov = new Array(K).fill(0);
    for (let t = 0; t < n; t++) for (let k = 0; k < K; k++) { const v = fn(t, k); col[t * K + k] = v == null ? NaN : v; if (v != null) cov[k]++; }
    columns[name] = col;
    meta.fields[name] = { coverage: cov, maxCoverage: Math.max(...cov), scale: 1 };
  }
  return { meta, fwd, columns };
}
const compile = (src, meta) => fx.compile(src, { fields: Object.keys(meta.fields), expect: "bool" });

// ---------- DSR 알려진 값 ----------
test("DSR: Bailey & López de Prado (2014) 예제 ≈ 0.9004", () => {
  // SR 연 2.5, 일간 T=1250, 시도 N=100, 시도 간 연 Sharpe 분산 0.5, 왜도 −3, 첨도 10.
  const sr0Ann = of.expectedMaxSharpe(100, 0.5);
  near(sr0Ann, 1.7899, 0.002, "SR0 연환산");
  const sr = 2.5 / Math.sqrt(250);
  const sr0 = sr0Ann / Math.sqrt(250);
  near(sr0, 0.1132, 0.0002, "SR0 일간");
  const dsr = of.probabilisticSharpe(sr, sr0, 1250, -3, 10);
  near(dsr, 0.9004, 0.001, "DSR");
});
test("PSR: 기준 = 표본 Sharpe 이면 0.5", () => {
  near(of.probabilisticSharpe(0.2, 0.2, 60, 0, 3), 0.5, 1e-6);
});
test("expectedMaxSharpe: 시도 1회 = 0, 시도 늘면 증가", () => {
  assert.equal(of.expectedMaxSharpe(1, 0.1), 0);
  assert.ok(of.expectedMaxSharpe(10, 0.1) < of.expectedMaxSharpe(100, 0.1));
});
test("normInv ↔ normCdf 왕복", () => {
  for (const p of [0.001, 0.025, 0.3, 0.5, 0.9, 0.99, 0.9995]) near(of.normCdf(of.normInv(p)), p, 1e-7, `p=${p}`);
  near(of.normInv(0.975), 1.959964, 1e-5);
});
test("deflatedSharpe: 시도가 늘면 DSR 은 줄어든다(같은 수익열)", () => {
  const rnd = of.mulberry32(7);
  const r = Array.from({ length: 60 }, () => 0.01 + (rnd() - 0.5) * 0.04);
  const one = of.deflatedSharpe(r, { trials: 1 });
  const many = of.deflatedSharpe(r, { trials: 50, trialSharpes: [0.1, -0.1, 0.3, 0.05] });
  assert.ok(one.dsr > many.dsr, `${one.dsr} > ${many.dsr}`);
  near(one.dsr, one.psr, 1e-12, "시도 1회면 DSR = PSR(0)");
});

// ---------- 부트스트랩 ----------
test("blockBootstrap: 시드 고정 재현 · 구간이 평균을 감싼다", () => {
  const rnd = of.mulberry32(3);
  const r = Array.from({ length: 48 }, () => 0.005 + (rnd() - 0.5) * 0.06);
  const a = of.blockBootstrap(r, { seed: 11 });
  const b = of.blockBootstrap(r, { seed: 11 });
  assert.equal(a.lo, b.lo);
  assert.ok(a.lo < a.point && a.point < a.hi);
  assert.equal(a.blockLen, Math.max(3, Math.round(Math.cbrt(48))));
});

// ---------- 룩어헤드 ----------
test("룩어헤드 없음: k 시점 필드(= 지난 기간 수익)로 고르면 fwd_k 를 미리 보지 못한다", () => {
  // fwd(t,k) = +10% (t+k 짝수) / −10% (홀수). x(t,k) = fwd(t,k−1) 은 k 시점에 이미 알려진 과거 값이고,
  // 부호가 fwd(t,k) 와 늘 반대다. 'x > 0' 은 매달 −10% 종목만 고른다. 만약 코어가 k+1 시점 필드
  // (= fwd(t,k))를 썼다면 +10% 종목만 골랐을 것이다.
  const n = 20, K = 12;
  const f = (t, k) => ((t + k) % 2 === 0 ? 0.1 : -0.1);
  const { meta, fwd, columns } = makePanel(n, K, f, { x: (t, k) => (k === 0 ? null : f(t, k - 1)) });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0, minStocks: 1, start: 1 });
  assert.equal(res.months, K - 1);
  res.periods.forEach((p) => { near(p.gross, -0.1, 1e-12, `k=${p.k}`); assert.equal(p.held, n / 2); });
  // 동일가중은 +10%/−10% 절반씩이라 0.
  res.periods.forEach((p) => near(p.ewNet, 0, 1e-12));
});
test("룩어헤드 없음: 필드를 한 칸 미래로 옮기면(치팅) 결과가 달라진다 — 검사 자체가 유효", () => {
  const n = 20, K = 12;
  const f = (t, k) => ((t + k) % 2 === 0 ? 0.1 : -0.1);
  const { meta, fwd, columns } = makePanel(n, K, f, { x: (t, k) => f(t, k) });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0, minStocks: 1, start: 0 });
  res.periods.forEach((p) => near(p.gross, 0.1, 1e-12));
});

// ---------- 거래비용·회전율 ----------
test("거래비용·회전율: 매달 전 종목 교체 → 매매 비중 2(매도 1 + 매수 1), 비용 = 2 × 편도", () => {
  // 짝수 달엔 짝수 종목, 홀수 달엔 홀수 종목만 조건 통과. 수익 0 이라 드리프트 없음.
  const n = 10, K = 6;
  const { meta, fwd, columns } = makePanel(n, K, () => 0, { x: (t, k) => ((t + k) % 2 === 0 ? 1 : 0) });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0.001, minStocks: 1, start: 0 });
  near(res.periods[0].trade, 1, 1e-12, "첫 달: 현금 → 매수 1");
  near(res.periods[0].net, -0.001, 1e-12, "첫 달 비용");
  for (let i = 1; i < res.periods.length; i++) {
    near(res.periods[i].trade, 2, 1e-12, `k=${i} 매매 비중`);
    near(res.periods[i].turnover, 1, 1e-12);
    near(res.periods[i].net, -0.002, 1e-12, `k=${i} 비용`);
  }
  near(res.metrics.strategy.turnoverMonthly, (0.5 + 5) / 6, 1e-12);
});
test("거래비용: 같은 종목 유지 + 수익 0 이면 매매·비용 0", () => {
  const { meta, fwd, columns } = makePanel(8, 5, () => 0, { x: (t) => (t < 4 ? 1 : 0) });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0.01, minStocks: 1, start: 0 });
  for (let i = 1; i < res.periods.length; i++) { near(res.periods[i].trade, 0, 1e-12); near(res.periods[i].net, 0, 1e-12); }
});
test("드리프트 반영: 오른 종목 비중이 커진 뒤 동일가중으로 되돌리는 매매", () => {
  // 종목 0 은 +100%, 종목 1 은 0%. 첫 달 뒤 비중 2/3 : 1/3 → 1/2 : 1/2 로 되돌리려면 매매 비중 1/3.
  const { meta, fwd, columns } = makePanel(2, 3, (t) => (t === 0 ? 1 : 0), { x: () => 1 });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0, minStocks: 1, start: 0 });
  near(res.periods[0].gross, 0.5, 1e-12);
  near(res.periods[1].trade, 1 / 3, 1e-12);
});

// ---------- 현금 처리 ----------
test("현금: 통과 종목 < 최소 종목 수면 그 달은 현금(수익 0), 이전 보유는 매도 비용", () => {
  // k=0: 6종목 통과, k=1: 2종목만 통과(min 5 → 현금), k=2: 6종목.
  const pass = (t, k) => (k === 1 ? t < 2 : t < 6);
  const { meta, fwd, columns } = makePanel(10, 3, () => 0.05, { x: (t, k) => (pass(t, k) ? 1 : 0) });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0.001, minStocks: 5, start: 0 });
  assert.equal(res.periods[1].cash, true);
  assert.equal(res.periods[1].held, 0);
  near(res.periods[1].gross, 0, 1e-12, "현금 수익 0");
  near(res.periods[1].trade, 1, 1e-12, "전량 매도");
  near(res.periods[1].net, -0.001, 1e-12);
  near(res.periods[2].trade, 1, 1e-12, "다시 전량 매수");
  assert.equal(res.metrics.strategy.cashMonths, 1);
  near(res.metrics.strategy.avgHoldings, 6, 1e-12);
});
test("결측 필드 종목은 조건 불충족(0 으로 채우지 않음)", () => {
  const { meta, fwd, columns } = makePanel(6, 2, () => 0, { x: (t) => (t < 3 ? null : -1) });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x < 1", meta), formulaCore: fx, costRate: 0, minStocks: 1, start: 0 });
  assert.equal(res.periods[0].passed, 3);
});
test("살 수 없는 종목(fwd 결측)은 유니버스·집계 모집단에서 빠진다", () => {
  const { meta, fwd, columns } = makePanel(6, 2, (t) => (t === 0 ? NaN : 0.01), { x: () => 1 });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0, minStocks: 1, start: 0 });
  assert.equal(res.periods[0].universe, 5);
  assert.equal(res.periods[0].held, 5);
});

test("비교 기준 동일가중은 수식 필드 값이 있는 종목만(커버리지 편향 제거)", () => {
  // 종목 0~2 는 필드 없음 + 수익 +50%, 3~5 는 필드 있음 + 수익 0. 전 종목과 비교하면 필터가 불리해 보인다.
  const { meta, fwd, columns } = makePanel(6, 2, (t) => (t < 3 ? 0.5 : 0), { x: (t) => (t < 3 ? null : 1) });
  const res = bt.run({ meta, fwd, columns, compiled: compile("x > 0", meta), formulaCore: fx, costRate: 0, minStocks: 1, start: 0 });
  assert.equal(res.periods[0].eligible, 3);
  near(res.periods[0].ewNet, 0, 1e-12);
  near(res.excess[0], 0, 1e-12);
});

// ---------- 기타 ----------
test("startIndex: 커버리지가 평소(중앙값)의 60% 에 닿는 첫 시점 · 편입 가능 종목 비율 기준", () => {
  const meta = { dates: [1, 2, 3, 4, 5], fields: { a: { coverage: [0, 10, 70, 90, 100], maxCoverage: 100 }, b: { coverage: [100, 100, 100, 100, 100], maxCoverage: 100 } } };
  assert.equal(bt.startIndex(meta, ["a"]), 2); // 중앙값 80 × 0.6 = 48
  assert.equal(bt.startIndex(meta, ["b"]), 0);
  assert.equal(bt.startIndex(meta, ["a", "b"]), 2);
  // 유니버스가 커져도 비율이 같으면 처음부터. 편입 가능 종목이 최대치 절반 미만인 첫 달은 뺀다.
  const m2 = { dates: [1, 2, 3, 4], tradeable: [10, 100, 200, 200], fields: { a: { coverage: [4, 40, 80, 80], maxCoverage: 80 } } };
  assert.equal(bt.startIndex(m2, ["a"]), 1);
});
test("missingFields: 패널에 없는 필드는 백테스트 불가로 표시", () => {
  const meta = { fields: { roe: {} } };
  const c = fx.compile("roe > 10 and epsTtm > 1", { fields: ["roe", "epsTtm"], expect: "bool" });
  assert.deepEqual(bt.missingFields(c, meta), ["epsTtm"]);
});
test("decodeShard: 정수 ÷ scale, null 행·값은 NaN, 길이 검증", () => {
  const out = bt.decodeShard({ scale: 10, rows: [[10, null], null] }, 2, 2);
  assert.equal(out[0], 1);
  assert.ok(Number.isNaN(out[1]) && Number.isNaN(out[2]) && Number.isNaN(out[3]));
  assert.throws(() => bt.decodeShard({ scale: 1, rows: [[1]] }, 2, 1));
});
test("summarize: MDD·CAGR", () => {
  const s = bt.summarize([0.1, -0.5, 0.2], 12);
  near(s.total, 1.1 * 0.5 * 1.2 - 1, 1e-12);
  near(s.mdd, -0.5, 1e-12);
});

// ---------- 배지 ----------
test("verdict: 기간이 짧으면 불충분", () => {
  const v = of.verdict(Array.from({ length: 20 }, () => 0.01), { trials: 1, avgHoldings: 20 });
  assert.equal(v.key, "insufficient");
});
test("verdict: 앞 70% 플러스 / 뒤 30% 마이너스 → 과적합 의심", () => {
  const x = [...Array.from({ length: 35 }, (_, i) => 0.02 + (i % 3) * 0.001), ...Array.from({ length: 15 }, (_, i) => -0.01 - (i % 2) * 0.001)];
  const v = of.verdict(x, { trials: 1, avgHoldings: 20 });
  assert.equal(v.key, "overfit");
});
test("verdict: 꾸준한 초과수익 + 시도 1회 → 통과, 같은 수익열이라도 시도 수백 회 + 큰 분산이면 통과 못 함", () => {
  const rnd = of.mulberry32(5);
  const x = Array.from({ length: 60 }, () => 0.01 + (rnd() - 0.5) * 0.02);
  assert.equal(of.verdict(x, { trials: 1, avgHoldings: 20 }).key, "pass");
  const many = of.verdict(x, { trials: 500, trialSharpes: [2, -2, 1.5, -1.5, 0.5], avgHoldings: 20 });
  assert.notEqual(many.key, "pass");
});
test("CRITERIA 는 판정 상수와 같은 숫자를 쓴다", () => {
  const text = of.CRITERIA.join(" ");
  assert.ok(text.includes(String(of.THRESHOLDS.dsrPass)));
  assert.ok(text.includes(`${of.THRESHOLDS.minMonths}개월`));
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`screener backtest + overfit core: ${passed} passed`);
