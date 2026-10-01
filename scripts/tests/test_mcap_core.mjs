// 재무 차트 시가총액 겹쳐 보기 순수 계산(mcap-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_mcap_core.mjs   (CI 의 "Market-cap overlay / shareholder core tests" 스텝)
// 픽스처 수치는 실제 파일(2026-10-01 data/financials/NVDA.json · data/korea/financials/000500.json 등)에서 옮긴 것.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const mc = require("../../mcap-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const near = (a, b, rel, msg) => assert.ok(a !== null && Math.abs(a / b - 1) <= rel, `${msg || ""} expected ≈${b}, got ${a}`);

// 일봉: [o,h,l,c,v,date] — 날짜별 종가 목록에서 만든다.
const bars = (pairs) => pairs.map(([d, c]) => [c, c, c, c, 1, d]);

test("표준 분할 비율 맞추기: 12% 안, 1.8 은 2 로(표준 아님), 1.3 은 없음", () => {
  assert.equal(mc.nearestSplitRatio(9.98), 10);
  assert.equal(mc.nearestSplitRatio(0.101), 0.1);
  assert.equal(mc.nearestSplitRatio(4.1), 4);
  assert.equal(mc.nearestSplitRatio(1.8), 2);
  assert.equal(mc.nearestSplitRatio(1.3), null);
});

test("기말 날짜: US 는 end, KR(end 없음)은 12월 결산 가정 — 분기는 3·6·9·12월 말", () => {
  assert.equal(mc.periodEnd({ fy: 2025, end: "2025-01-26" }, "annual"), "2025-01-26");
  assert.equal(mc.periodEnd({ fy: 2025 }, "annual"), "2025-12-31");
  assert.equal(mc.periodEnd({ fy: 2025, fq: 2 }, "quarterly"), "2025-06-30");
  assert.equal(mc.periodEnd({ fy: 2025, fq: 3 }, "quarterly"), "2025-09-30");
  assert.equal(mc.periodEnd({ fy: 2025, fq: 1 }, "quarterly"), "2025-03-31");
});

// NVDA: 10:1 분할(2024-06) — FY2023 기말 발행 2.466B 는 분할 전, 희석 평균 25.07B 는 재표시.
const NVDA = {
  market: "us", currency: "USD",
  annual: [
    { fy: 2022, end: "2022-01-30", sharesOut: 2506000000, sharesDilAvg: 2535000000, equity: 26612000000 },
    { fy: 2023, end: "2023-01-29", sharesOut: 2466000000, sharesDilAvg: 25070000000, equity: 22101000000 },
    { fy: 2024, end: "2024-01-28", sharesOut: 24643000000, sharesDilAvg: 24940000000, equity: 42978000000 },
    { fy: 2025, end: "2025-01-26", sharesOut: 24477000000, sharesDilAvg: 24804000000, equity: 79327000000 },
  ],
  quarterly: [],
};
// 일봉은 듬성하게 옮기되 이웃 봉 비율이 2.5배를 넘지 않게(넘으면 분할 미조정 의심으로 막힌다) 중간값을 둔다.
const NVDA_BARS = bars([["2021-09-22", 21.94], ["2022-01-28", 22.84], ["2023-01-27", 20.36], ["2023-07-03", 42.4], ["2024-01-26", 61.03],
  ["2024-07-01", 124.3], ["2025-01-24", 142.62], ["2026-09-30", 228.38]]);

test("NVDA 10:1 — 분할 전 주식수를 현재 기준으로 환산해 당시 실제 시총과 같다", () => {
  const r = mc.overlaySeries({ file: NVDA, kind: "annual", chartSeries: NVDA_BARS, anchor: 24.10e9 });
  assert.equal(r.mode, "mcap");
  // 2023-01-27 실제: $203.65(분할 전) × 2.466B ≈ $502B
  near(r.byKey["2023|"].mcap, 502.1e9, 0.01, "FY2023");
  near(r.byKey["2022|"].mcap, 572.4e9, 0.01, "FY2022");
  near(r.byKey["2024|"].mcap, 1504.0e9, 0.01, "FY2024");
  assert.equal(r.byKey["2023|"].closeDate, "2023-01-27");   // 기말(일요일) → 직전 거래일
  assert.equal(r.byKey["2023|"].sharesKind, "out");
});

test("마지막 공시 뒤 분할은 anchor(지금 주식수)로 잡는다 — 분할 목록을 모를 때 표준 비율", () => {
  const file = { annual: [{ fy: 2024, end: "2024-12-31", sharesOut: 1e8 }, { fy: 2025, end: "2025-12-31", sharesOut: 1e8 }] };
  const cs = bars([["2024-12-31", 50], ["2025-12-31", 60]]);
  const r = mc.overlaySeries({ file, kind: "annual", chartSeries: cs, anchor: 4e8 });
  assert.equal(r.mode, "mcap");
  near(r.byKey["2025|"].shares, 4e8, 1e-9);
  near(r.byKey["2025|"].mcap, 60 * 4e8, 1e-9);
});

// 000500: 2026-06-30 무상증자 1.8배(야후 splits), 2025 년은 실제 유상증자(+68%) — 표준 비율 추측이면 1.5·2 로 오판.
const K500 = {
  market: "kr", currency: "KRW",
  annual: [
    { fy: 2023, sharesOut: 7128648, equity: 331e9 },
    { fy: 2024, sharesOut: 9858379, equity: 453.7e9 },
    { fy: 2025, sharesOut: 16543115, equity: 483.8e9 },
  ],
  quarterly: [{ fy: 2025, fq: 4, sharesOut: 16543115 }],
};
const K500_BARS = bars([["2021-09-23", 12679.94], ["2023-12-28", 11777.78], ["2024-03-29", 16083.33], ["2024-06-28", 29555.55], ["2024-12-30", 30111.11], ["2025-12-30", 45777.78],
  ["2026-03-31", 54166.67], ["2026-05-08", 110000], ["2026-06-30", 233500], ["2026-09-29", 316000]]);

test("000500 — 알려진 분할 목록(1.8배)만으로 환산, 실제 유상증자는 그대로 둔다", () => {
  const r = mc.overlaySeries({ file: K500, kind: "annual", chartSeries: K500_BARS, anchor: 29777607, splits: [["2026-06-30", 1.8, 1.0]] });
  assert.equal(r.mode, "mcap");
  // 2025-12-30 실제: 82,400원(무상증자 전) × 16,543,115주 ≈ 1.363조
  near(r.byKey["2025|"].mcap, 1.363e12, 0.005, "FY2025");
  // 2024-12-30 실제: 54,200원 × 9,858,379주 ≈ 0.534조
  near(r.byKey["2024|"].mcap, 0.5343e12, 0.005, "FY2024");
  near(r.byKey["2024|"].shares, 9858379 * 1.8, 1e-9, "2024 주식수는 1.8 배만");
});

test("같은 000500 을 분할 목록 없이 돌리면 표준 비율 추측 경로(목록이 있을 때와 다를 수 있음을 기록)", () => {
  const r = mc.overlaySeries({ file: K500, kind: "annual", chartSeries: K500_BARS, anchor: 29777607 });
  assert.equal(r.splitsKnown, false);
  assert.ok(r.mode === "mcap" || r.mode === "price");
});

test("알려진 분할: 재표시 여부를 관측치마다 고른다(희석 평균은 재표시, 기말 발행은 분할 전)", () => {
  const known = mc.knownSplits([["2024-06-10", 10, 1]]);
  assert.deepEqual(mc.suffixFactors(known, mc.dayNum("2023-01-29")), [1, 10]);
  assert.deepEqual(mc.suffixFactors(known, mc.dayNum("2025-01-26")), [1]);
  const obs = mc.shareObservations(NVDA);
  const ns = mc.normalizeShares(obs, [], 24.1e9, known);
  assert.equal(ns.fail, null);
  const at = (end, kind) => ns.norm.find((o) => o.end === end && o.kind === kind).n;
  near(at("2023-01-29", "out"), 24.66e9, 1e-9);
  near(at("2023-01-29", "dil"), 25.07e9, 1e-9);
});

test("anchor 와 최근 공시가 분할로도 안 맞으면(복수 종류주 등) 수정주가만", () => {
  const file = { annual: [{ fy: 2025, end: "2025-12-31", sharesOut: 1e8 }] };
  const r = mc.overlaySeries({ file, kind: "annual", chartSeries: bars([["2025-12-31", 10]]), anchor: 1.75e8 });
  assert.equal(r.mode, "price");
  assert.equal(r.reason, "anchor");
  assert.equal(r.byKey["2025|"].close, 10);
  assert.equal(r.byKey["2025|"].mcap, null);
});

test("ADR·해외발행인(noShares)은 수정주가, 통화 불일치는 아무것도 안 그림", () => {
  const file = { annual: [{ fy: 2025, end: "2025-12-31", sharesOut: 1e8 }] };
  const cs = bars([["2025-12-31", 10]]);
  assert.equal(mc.overlaySeries({ file, kind: "annual", chartSeries: cs, noShares: true }).mode, "price");
  const r = mc.overlaySeries({ file, kind: "annual", chartSeries: cs, currencyMismatch: true });
  assert.equal(r.mode, null);
  assert.equal(r.reason, "currency");
});

test("종가 이력에 하루 2.5배 넘는 급변(분할 미조정 의심)이면 그리지 않는다", () => {
  const file = { annual: [{ fy: 2025, end: "2025-12-31", sharesOut: 1e8 }] };
  const r = mc.overlaySeries({ file, kind: "annual", chartSeries: bars([["2025-06-02", 100], ["2025-06-03", 25], ["2025-12-31", 26]]), anchor: 1e8 });
  assert.equal(r.mode, null);
  assert.equal(r.reason, "priceJump");
});

test("종가 이력 밖 기간·7일 넘게 빈 기간은 건너뛴다(추정 없음)", () => {
  const file = { annual: [
    { fy: 2019, end: "2019-12-31", sharesOut: 1e8 },
    { fy: 2024, end: "2024-12-31", sharesOut: 1e8 },
    { fy: 2025, end: "2025-12-31", sharesOut: 1e8 },
  ] };
  const r = mc.overlaySeries({ file, kind: "annual", chartSeries: bars([["2021-09-20", 5], ["2024-12-10", 9], ["2025-12-30", 10]]), anchor: 1e8 });
  assert.equal(r.byKey["2019|"], undefined, "이력 시작 전");
  assert.equal(r.byKey["2024|"], undefined, "21일 전 종가는 쓰지 않음");
  assert.equal(r.byKey["2025|"].closeDate, "2025-12-30");
});

test("국내 분기: 주식수가 연말만 있어 절반 넘게 비면 수정주가로", () => {
  const file = { annual: [{ fy: 2025, sharesOut: 1e7 }], quarterly: [1, 2, 3, 4].map((q) => Object.assign({ fy: 2025, fq: q }, q === 4 ? { sharesOut: 1e7 } : {})) };
  const cs = bars([["2025-03-31", 10], ["2025-06-30", 11], ["2025-09-30", 12], ["2025-12-30", 13]]);
  const r = mc.overlaySeries({ file, kind: "quarterly", chartSeries: cs, anchor: 1e7, splits: [] });
  assert.equal(r.mode, "price");
  assert.equal(r.reason, "sparseShares");
  assert.equal(r.byKey["2025|2"].close, 11);
  assert.ok(mc.REASON_TEXT.sparseShares);
});

test("anchorShares: US 시총(10억)÷현재가, KR 상장주식수 우선", () => {
  near(mc.anchorShares({ price: 228.38, marketCapB: 5503.958 }, "us"), 24.1e9, 0.001);
  assert.equal(mc.anchorShares({ price: 316000, listedShares: 29777607, marketCapB: 9.41 }, "kr"), 29777607);
  near(mc.anchorShares({ price: 100, marketCapT: 1 }, "kr"), 1e10, 1e-9);
  assert.equal(mc.anchorShares(null, "us"), null);
});

test("normalizedFor 는 overlaySeries 와 같은 관측치 범위·규칙", () => {
  const ns = mc.normalizedFor({ file: K500, chartSeries: K500_BARS, anchor: 29777607, splits: [["2026-06-30", 1.8, 1.0]] });
  assert.equal(ns.fail, null);
  near(ns.norm.find((o) => o.end === "2025-12-31").n, 16543115 * 1.8, 1e-9);
});

if (failures.length) {
  console.error(`mcap-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`mcap-core: ${passed}개 통과`);
