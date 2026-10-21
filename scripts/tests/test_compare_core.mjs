// 종목 › 비교 순수 함수(compare-core.js). 네트워크·DOM 없음.
// 실행: node scripts/tests/test_compare_core.mjs   (CI 의 "Compare core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../compare-core.js");

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
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const bar = (d, c) => [c, c, c, c, 1000, d];

// ---------- toBars ----------
test("toBars: 배열·객체 형식, 정렬, 결측·0 이하 제거, 같은 날은 뒤 값", () => {
  const out = core.toBars([bar("2026-01-03", 11), { date: "2026-01-02", close: 10 }, bar("2026-01-04", null), bar("2026-01-05", 0), bar("2026-01-03", 12), ["x"]]);
  assert.deepEqual(out, [{ d: "2026-01-02", c: 10 }, { d: "2026-01-03", c: 12 }]);
});

// ---------- 날짜 ----------
test("addMonths: 말일 클램프·연도 넘김", () => {
  assert.equal(core.addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(core.addMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(core.addMonths("2026-01-15", -3), "2025-10-15");
  assert.equal(core.addMonths("2026-10-21", -60), "2021-10-21");
});
test("periodStartDate: YTD = 전년 12-31, 모르는 기간 null", () => {
  assert.equal(core.periodStartDate("2026-10-21", "YTD"), "2025-12-31");
  assert.equal(core.periodStartDate("2026-10-21", "1Y"), "2025-10-21");
  assert.equal(core.periodStartDate("2026-10-21", "2W"), null);
});

// ---------- rebase / alignReturns ----------
const A = [bar("2025-12-30", 100), bar("2025-12-31", 100), bar("2026-01-02", 110), bar("2026-01-05", 121)];
const B = [bar("2025-12-31", 50), bar("2026-01-02", 45), bar("2026-01-06", 60)];
test("rebase: 시작일 이전 마지막 봉 = 0%", () => {
  const r = core.rebase(core.toBars(A), "2026-01-01");
  assert.equal(r.baseDate, "2025-12-31");
  assert.equal(r.lateStart, false);
  assert.equal(r.points[0].pct, 0);
  assert.ok(close(r.points[2].pct, 21));
});
test("rebase: 시작일보다 앞선 봉이 없으면 첫 봉 + lateStart", () => {
  const r = core.rebase(core.toBars(B), "2025-06-01");
  assert.equal(r.baseDate, "2025-12-31");
  assert.equal(r.lateStart, true);
});
test("alignReturns: 기준일 = 가장 늦은 마지막 봉, 날짜 합집합, 범위 밖 null·안은 직전 값", () => {
  const out = core.alignReturns([{ key: "A", series: A }, { key: "B", series: B }], "YTD");
  assert.equal(out.ref, "2026-01-06");
  assert.equal(out.start, "2025-12-31");
  assert.deepEqual(out.dates, ["2025-12-31", "2026-01-02", "2026-01-05", "2026-01-06"]);
  const a = out.series[0];
  const b = out.series[1];
  assert.deepEqual(a.values.map((v) => (v === null ? null : Math.round(v))), [0, 10, 21, null]); // A 의 마지막 봉 이후는 만들지 않는다
  assert.deepEqual(b.values.map((v) => (v === null ? null : Math.round(v))), [0, -10, -10, 20]); // 01-05 는 직전 값
  assert.ok(close(b.last, 20));
  assert.equal(a.lastDate, "2026-01-05");
});
test("alignReturns: 봉이 없는 종목은 empty, 전부 없으면 빈 축", () => {
  const out = core.alignReturns([{ key: "A", series: A }, { key: "X", series: [] }], "1M");
  assert.equal(out.series[1].empty, true);
  assert.equal(out.series[1].values.every((v) => v === null), true);
  const none = core.alignReturns([{ key: "X", series: null }], "1M");
  assert.equal(none.ref, null);
  assert.deepEqual(none.dates, []);
});

// ---------- trailingReturn ----------
test("trailingReturn: 자신의 마지막 봉 기준, 기간을 못 채우면 null", () => {
  assert.ok(close(core.trailingReturn(A, "YTD"), 21));
  assert.equal(core.trailingReturn(A, "1Y"), null);
  assert.equal(core.trailingReturn([bar("2026-01-02", 1)], "1M"), null);
});

// ---------- extremes / sortOrder ----------
test("extremes: 최고·최저, 결측 무시, 2개 미만·전부 같으면 없음", () => {
  assert.deepEqual(core.extremes([3, null, 9, -2]), { hi: 2, lo: 3, hiAll: [2], loAll: [3] });
  assert.equal(core.extremes([3, null]).hi, -1);
  assert.deepEqual(core.extremes([5, 5, 5]).hiAll, []);
  const pos = core.extremes([-4, 12, 30], { positiveOnly: true });
  assert.equal(pos.hi, 2);
  assert.equal(pos.lo, 1);
});
test("extremes: 동률은 전부 표시, minCount 미달이면 없음", () => {
  const t = core.extremes([-1, -0.3, -0.3]);
  assert.deepEqual(t.hiAll, [1, 2]);
  assert.deepEqual(t.loAll, [0]);
  assert.equal(core.extremes([1, 2], { minCount: 3 }).hi, -1);
  assert.equal(core.extremes([1, 2, 3], { minCount: 3 }).hi, 2);
});
test("sortOrder: 내림·오름, 결측은 뒤, 동률은 원래 순서", () => {
  assert.deepEqual(core.sortOrder([2, null, 5, 2], "desc"), [2, 0, 3, 1]);
  assert.deepEqual(core.sortOrder([2, null, 5, 2], "asc"), [0, 3, 2, 1]);
});

// ---------- parseTickerParam ----------
test("parseTickerParam: 대문자·중복 제거·허용 글자만·최대 8", () => {
  assert.deepEqual(core.parseTickerParam(" aapl,MSFT,,aapl,<x>,005930"), ["AAPL", "MSFT", "X", "005930"]);
  assert.equal(core.parseTickerParam("A,B,C,D,E,F,G,H,I,J").length, core.MAX_TICKERS);
  assert.equal(core.MAX_TICKERS, 8);
});

// ---------- niceTicks ----------
test("niceTicks: 1·2·5 간격이고 범위를 덮는다", () => {
  const t = core.niceTicks(-12.3, 47.9, 5);
  assert.ok(t.lo <= -12.3 && t.hi >= 47.9);
  assert.equal(t.step, 10);
  assert.ok(t.ticks.includes(0));
  const same = core.niceTicks(5, 5, 4);
  assert.ok(same.lo < 5 && same.hi > 5);
});

// ---------- 재무 ----------
const FILE_US = {
  currency: "USD",
  flags: [],
  annual: [
    { fy: 2023, rev: 100, op: 20, net: 10, epsDil: 1, ocf: 30, capex: 5, equity: 50 },
    { fy: 2024, rev: 200, op: 50, net: 30, epsDil: 2, fcf: 40, equity: 70 },
    { fy: 2026, rev: 0, op: 5, net: 1, equity: -3 },
  ],
  quarterly: [
    { fy: 2026, fq: 3, end: "2026-06-27", rev: 80, op: 8, net: 4, epsDil: 0.5 },
    { fy: 2026, fq: 4, end: "2026-10-03", rev: 90, op: 9, net: 5, epsDil: 0.6 },
  ],
};
const FILE_KR = {
  currency: "KRW",
  flags: ["financial"],
  annual: [{ fy: 2024, rev: 1000, op: 100, net: 80, ocf: 300, capex: 50, equity: 800 }],
  quarterly: [{ fy: 2026, fq: 2, rev: 300, op: 30, net: 20 }],
};
test("finValue: 이익률·FCF(직접/ocf−capex)·ROE 기초기말 평균·매출 0 이하 결측", () => {
  const [r23, r24, r26] = FILE_US.annual;
  assert.ok(close(core.finValue(r23, "opMargin"), 20));
  assert.ok(close(core.finValue(r24, "netMargin"), 15));
  assert.equal(core.finValue(r23, "fcf"), 25);
  assert.equal(core.finValue(r24, "fcf"), 40);
  assert.ok(close(core.finValue(r24, "roe", r23), 50)); // 30 / ((70+50)/2)
  assert.ok(close(core.finValue(r23, "roe", null), 20)); // 기초 없음 → 기말
  assert.equal(core.finValue(r26, "opMargin"), null);
  assert.equal(core.finValue(r26, "roe", null), null); // 자본 ≤ 0
  assert.equal(core.finValue({ fy: 1 }, "fcf"), null);
  assert.equal(core.finValue(r23, "fcf", null, { financial: true }), null);
});
test("calendarQuarter: 결산 종료일 → 달력 분기, 월초 10일 이내는 전달, end 없으면 fy·fq", () => {
  assert.deepEqual(core.calendarQuarter({ end: "2026-06-27" }), { y: 2026, q: 2 });
  assert.deepEqual(core.calendarQuarter({ end: "2026-10-03" }), { y: 2026, q: 3 });
  assert.deepEqual(core.calendarQuarter({ end: "2026-01-02" }), { y: 2025, q: 4 });
  assert.deepEqual(core.calendarQuarter({ fy: 2026, fq: 2 }), { y: 2026, q: 2 });
  assert.equal(core.calendarQuarter({ fy: 2026 }), null);
});
test("finMatrix 연간: 회계연도 합집합 축, 값 없는 해는 null, 통화·회계 라벨 유지", () => {
  const m = core.finMatrix([{ key: "AAA", file: FILE_US }, { key: "BBB", file: FILE_KR }, { key: "CCC", file: null }], "annual", "rev");
  assert.deepEqual(m.periods.map((p) => p.label), ["FY2023", "FY2024", "FY2026"]);
  assert.deepEqual(m.series[0].values, [100, 200, 0]);
  assert.deepEqual(m.series[1].values, [null, 1000, null]);
  assert.equal(m.series[1].currency, "KRW");
  assert.equal(m.series[2].values.every((v) => v === null), true);
  assert.equal(m.any, true);
});
test("finMatrix: 금융업 FCF 숨김, ROE 는 분기에서 없음, limit", () => {
  const fcf = core.finMatrix([{ key: "BBB", file: FILE_KR }], "annual", "fcf");
  assert.equal(fcf.any, false);
  const roeQ = core.finMatrix([{ key: "AAA", file: FILE_US }], "quarterly", "roe");
  assert.equal(roeQ.any, false);
  assert.equal(roeQ.periods.length, 0);
  const lim = core.finMatrix([{ key: "AAA", file: FILE_US }], "annual", "rev", 2);
  assert.deepEqual(lim.periods.map((p) => p.label), ["FY2024", "FY2026"]);
});
test("finMatrix 분기: 달력 분기로 맞추고 회계 라벨은 meta 로", () => {
  const m = core.finMatrix([{ key: "AAA", file: FILE_US }, { key: "BBB", file: FILE_KR }], "quarterly", "epsDil");
  assert.deepEqual(m.periods.map((p) => p.label), ["2026 Q2", "2026 Q3"]);
  assert.deepEqual(m.series[0].values, [0.5, 0.6]);
  assert.deepEqual(m.series[0].meta, ["FY26 3Q", "FY26 4Q"]);
  assert.deepEqual(m.series[1].values, [null, null]); // KR 분기에 EPS 없음
  const rev = core.finMatrix([{ key: "AAA", file: FILE_US }, { key: "BBB", file: FILE_KR }], "quarterly", "rev");
  assert.deepEqual(rev.series[1].values, [300, null]);
});

// ---------- csvRows ----------
test("csvRows: 머리 행 + null 은 빈칸", () => {
  assert.deepEqual(core.csvRows(["지표", "A"], [["PER", null], ["시총", 3]]), [["지표", "A"], ["PER", ""], ["시총", "3"]]);
});

if (failures.length) {
  console.error(`compare-core: ${failures.length} FAILED, ${passed} passed`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`compare-core: ${passed} passed`);
