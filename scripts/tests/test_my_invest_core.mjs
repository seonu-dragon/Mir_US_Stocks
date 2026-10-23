// 내 투자 순수 계산(my-invest-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_my_invest_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../my-invest-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const A = { "2026-09-28": 10, "2026-09-29": 11, "2026-09-30": 12, "2026-10-01": 12 };
const B = new Map([["2026-09-28", 100], ["2026-09-30", 90], ["2026-10-01", 110]]);   // 09-29 빈 날
const LATE = { "2026-09-30": 5, "2026-10-01": 6 };                                     // 구간 중간에 시작

test("holdingsTrend: 현재 수량 × 과거 종가, 빈 날은 직전 종가", () => {
  const r = core.holdingsTrend([{ t: "A", qty: 10 }, { t: "B", qty: 1 }], { A, B }, null, 4);
  assert.deepEqual(r.dates, ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
  assert.deepEqual(r.values, [200, 210, 210, 230]);
  assert.equal(r.change, 30);
  assert.ok(Math.abs(r.changePct - 15) < 1e-9);
  assert.deepEqual(r.used, ["A", "B"]);
});

test("holdingsTrend: 구간 시작일에 가격 없는 종목은 빼고 excluded", () => {
  const r = core.holdingsTrend([{ t: "A", qty: 1 }, { t: "L", qty: 100 }], { A, L: LATE }, null, 4);
  assert.deepEqual(r.excluded, ["L"]);
  assert.deepEqual(r.values, [10, 11, 12, 12]);
  // 구간을 줄여 시작일이 LATE 상장 뒤면 포함된다
  const r2 = core.holdingsTrend([{ t: "A", qty: 1 }, { t: "L", qty: 100 }], { A, L: LATE }, null, 2);
  assert.deepEqual(r2.excluded, []);
  assert.deepEqual(r2.values, [512, 612]);
});

test("holdingsTrend: 벤치마크 0% 기준 · 빈 입력", () => {
  const bench = { "2026-09-27": 50, "2026-09-29": 55, "2026-10-01": 60 };
  const r = core.holdingsTrend([{ t: "A", qty: 1 }], { A }, bench, 4);
  assert.deepEqual(r.benchPct.map((v) => Math.round(v)), [0, 10, 10, 20]);
  assert.equal(core.holdingsTrend([], { A }, null, 4), null);
  assert.equal(core.holdingsTrend([{ t: "Z", qty: 1 }], {}, null, 4), null);
});

test("allocation: 합산·정렬·집중 판정", () => {
  const a = core.allocation([{ key: "정보기술", value: 60 }, { key: "ETF", value: 10 }, { key: "정보기술", value: 20 }, { key: "x", value: -5 }]);
  assert.equal(a.total, 90);
  assert.equal(a.top.key, "정보기술");
  assert.ok(Math.abs(a.top.pct - 88.888) < 0.01);
  assert.equal(a.concentrated, true);
  assert.equal(core.allocation([]).total, 0);
});

// ---------------------------------------------------------------- 세후 배당 · 금융소득(#10)
test("taxSettings: 기본 15.4/15·세전, 범위 밖 값은 기본", () => {
  assert.deepEqual(core.taxSettings(null), { mode: "gross", kr: 15.4, us: 15 });
  assert.deepEqual(core.taxSettings({ mode: "net", kr: "22", us: -1 }), { mode: "net", kr: 22, us: 15 });
  assert.equal(core.taxSettings({ us: 0 }).us, 0);
});

test("afterTax: 세율만 곱하고 비과세는 그대로", () => {
  assert.ok(Math.abs(core.afterTax(100, 15.4) - 84.6) < 1e-9);
  assert.equal(core.afterTax(100, 15, true), 100);
  assert.equal(core.afterTax(NaN, 15), 0);
});

test("dividendYear: 배당락 달 +1개월 지급, 오늘 달 앞=지급·이후=예정, 비과세 따로", () => {
  // 분기(2·5·8·11월 배당락 → 3·6·9·12월 지급) 연 400, 연 1회(12월 배당락 → 1월 지급) 120, 비과세 분기 40
  const r = core.dividendYear([
    { annualCash: 400, frequency: 4, exDate: "2025-11-07" },
    { annualCash: 120, frequency: 1, exDate: "2025-12-30" },
    { annualCash: 40, frequency: 4, exDate: "2026-02-10", taxFree: true },
  ], 2026, "2026-06-15", 1);
  assert.deepEqual(r.months.map((v) => Math.round(v)), [120, 0, 100, 0, 0, 100, 0, 0, 100, 0, 0, 100]);
  assert.equal(r.paid, 220);        // 1월 120 + 3월 100
  assert.equal(r.upcoming, 300);    // 6·9·12월
  assert.equal(r.total, 520);
  assert.equal(r.taxFreeTotal, 40);
  assert.equal(core.dividendYear([{ annualCash: 10, frequency: 4, exDate: "" }], 2026, "2026-01-01").total, 0);
});

test("finIncomeGauge: 2천만 원 기준", () => {
  const g = core.finIncomeGauge(5000000);
  assert.equal(g.threshold, 20000000);
  assert.equal(g.pct, 25);
  assert.equal(g.over, false);
  assert.equal(g.remaining, 15000000);
  assert.equal(core.finIncomeGauge(25000000).over, true);
  assert.equal(core.finIncomeGauge(-3).total, 0);
});

// ---------------------------------------------------------------- 평가액·원금 기록(#11)
test("upsertSnapshot: 하루 한 점(같은 날 교체)·날짜순·상한·깨진 값 무시", () => {
  let l = core.upsertSnapshot([], { date: "2026-10-02", value: 100, principal: 90, currency: "USD" });
  l = core.upsertSnapshot(l, { date: "2026-10-01", value: 95, principal: 90, currency: "USD" });
  l = core.upsertSnapshot(l, { date: "2026-10-02", value: 101, principal: 90, currency: "USD" });
  assert.deepEqual(l.map((x) => [x.date, x.value]), [["2026-10-01", 95], ["2026-10-02", 101]]);
  assert.equal(core.upsertSnapshot(l, { date: "bad", value: 1, principal: 1 }).length, 2);
  assert.equal(core.upsertSnapshot(l, { date: "2026-10-03", value: 0, principal: 1 }).length, 2);
  assert.equal(core.upsertSnapshot(l, { date: "2026-10-03", value: 5, principal: 1 }, 2)[0].date, "2026-10-02");
});

test("snapshotSeries: 기간 자르기, 빈 날에서 선을 끊고 보간하지 않음", () => {
  const list = [
    { date: "2026-06-01", value: 50, principal: 50 },
    { date: "2026-10-01", value: 100, principal: 90 },
    { date: "2026-10-02", value: 102, principal: 90 },
    { date: "2026-10-05", value: 99, principal: 95 },
  ];
  const s = core.snapshotSeries(list, "1M", "2026-10-06");
  assert.equal(s.start, "2026-09-06");
  assert.equal(s.end, "2026-10-06");
  assert.equal(s.span, 30);
  assert.equal(s.points.length, 3);
  assert.deepEqual(s.segments.map((g) => g.map((p) => p.date)), [["2026-10-01", "2026-10-02"], ["2026-10-05"]]);
  assert.equal(s.byDate.has("2026-10-03"), false);
  assert.equal(core.seriesDate(s, 27), "2026-10-03");
  const all = core.snapshotSeries(list, "ALL", "2026-10-06");
  assert.equal(all.start, "2026-06-01");
  assert.equal(all.points.length, 4);
  assert.equal(core.snapshotSeries([], "1M", "2026-10-06"), null);
  assert.equal(core.snapshotSeries(list.slice(0, 1), "1M", "2026-10-06"), null);
});

// ---------------------------------------------------------------- 집중 한도(#12)
test("limitSettings: 기본 10/30/없음, 빈 값·0 은 한도 없음", () => {
  assert.deepEqual(core.limitSettings(null), { stock: 10, sector: 30, currency: null });
  assert.deepEqual(core.limitSettings({ stock: "", sector: 25, currency: 70 }), { stock: null, sector: 25, currency: 70 });
  assert.equal(core.limitSettings({ stock: 0 }).stock, null);
});

test("concentrationChecks: 한도 초과만 큰 순, 한도 없는 항목은 빠짐", () => {
  const r = core.concentrationChecks({
    stock: [{ label: "AAPL", pct: 8 }, { label: "NVDA", pct: 23 }, { label: "MSFT", pct: 12 }],
    sector: [{ label: "기술", pct: 30 }, { label: "금융", pct: 5 }],
    currency: [{ label: "USD", pct: 100 }],
  }, { stock: 10, sector: 30 });
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].over.map((x) => x.label), ["NVDA", "MSFT"]);
  assert.equal(r[0].ok, false);
  assert.equal(r[1].ok, true);       // 30% 는 30% 한도 안
  assert.equal(r[1].max.label, "기술");
  assert.equal(core.concentrationChecks({}, { stock: 10, sector: 30, currency: 60 })[2].count, 0);
});

if (failures.length) {
  console.error(`my-invest-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error("  ✕ " + f));
  process.exit(1);
}
console.log(`my-invest-core: ${passed}개 테스트 통과`);
