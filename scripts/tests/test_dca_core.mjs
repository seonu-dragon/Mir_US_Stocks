// 적립식 시뮬레이터 순수 계산(dca-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_dca_core.mjs   (CI 의 "DCA simulator tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../dca-core.js");

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

// 월~금 거래일 달력(주말 제외). holidays 는 추가로 뺄 날.
function weekdays(start, end, holidays = []) {
  const out = [];
  const skip = new Set(holidays);
  for (let d = start; d <= end; d = core.addDays(d, 1)) {
    const wd = core.weekdayOf(d);
    if (wd !== 0 && wd !== 6 && !skip.has(d)) out.push(d);
  }
  return out;
}

// ----- XIRR -----
test("xirr: Excel 문서 예제 = 0.373362535", () => {
  const r = core.xirr([
    { date: "2008-01-01", amount: -10000 },
    { date: "2008-03-01", amount: 2750 },
    { date: "2008-10-30", amount: 4250 },
    { date: "2009-02-15", amount: 3250 },
    { date: "2009-04-01", amount: 2750 },
  ]);
  near(r, 0.373362535, 1e-6, "xirr");
});

test("xirr: 1년 10% (365일) = 0.10", () => {
  near(core.xirr([{ date: "2021-01-01", amount: -1000 }, { date: "2022-01-01", amount: 1100 }]), 0.1, 1e-9);
});

test("xirr: 윤년 366일은 365일 기준으로 환산", () => {
  const r = core.xirr([{ date: "2020-01-01", amount: -1000 }, { date: "2021-01-01", amount: 1100 }]);
  near(r, Math.pow(1.1, 365 / 366) - 1, 1e-9);
});

test("xirr: 손실(-50%)도 푼다", () => {
  near(core.xirr([{ date: "2021-01-01", amount: -1000 }, { date: "2022-01-01", amount: 500 }]), -0.5, 1e-7);
});

test("xirr: 부호가 한쪽뿐이면 null", () => {
  assert.equal(core.xirr([{ date: "2021-01-01", amount: -1 }, { date: "2022-01-01", amount: -1 }]), null);
});

test("xirr ≠ 단순 총수익률 연환산(CAGR) — 적립식에서 둘이 다르다", () => {
  // 매월 100씩 12번, 마지막에 1300. 총수익률 8.3% 인데 돈이 평균 반년만 묶여 XIRR 은 훨씬 크다.
  const flows = [];
  for (let m = 1; m <= 12; m += 1) flows.push({ date: `2021-${String(m).padStart(2, "0")}-01`, amount: -100 });
  flows.push({ date: "2021-12-31", amount: 1300 });
  const r = core.xirr(flows);
  const naive = core.cagr(1200, 1300, "2021-01-01", "2021-12-31");
  assert.ok(r > naive * 1.5, `xirr ${r} should exceed naive CAGR ${naive}`);
});

// ----- 일정·휴장일 -----
test("매월 15일: 휴장이면 다음 거래일", () => {
  const dates = weekdays("2024-01-01", "2024-06-30", ["2024-01-15"]); // 1/15 휴장(MLK)
  const s = core.buildSchedule(dates, { freq: "monthly", monthDay: 15, start: "2024-01-01", end: "2024-06-30" });
  assert.equal(s.length, 6);
  assert.equal(s[0].date, "2024-01-16");
  assert.equal(s[0].shifted, true);
  // 2024-06-15 는 토요일 → 06-17(월)
  assert.equal(s[5].scheduled, "2024-06-15");
  assert.equal(s[5].date, "2024-06-17");
});

test("매월 말일: 그 달 마지막 거래일, 다음 달로 넘기지 않는다", () => {
  const dates = weekdays("2024-03-01", "2024-04-30", ["2024-03-29"]); // 3/29 휴장(성금요일)
  const s = core.buildSchedule(dates, { freq: "monthly", monthDay: "last", start: "2024-03-01", end: "2024-04-30" });
  assert.deepEqual(s.map((x) => x.date), ["2024-03-28", "2024-04-30"]);
  assert.ok(s.every((x) => !x.shifted), "마지막 거래일은 휴장 이월로 세지 않는다");
});

test("매월 31일 지정은 28일로 제한(짧은 달 대비)", () => {
  const dates = weekdays("2023-01-01", "2023-03-31");
  const s = core.buildSchedule(dates, { freq: "monthly", monthDay: 31, start: "2023-01-01", end: "2023-03-31" });
  assert.deepEqual(s.map((x) => x.scheduled), ["2023-01-28", "2023-02-28", "2023-03-28"]);
  assert.equal(s[0].date, "2023-01-30"); // 1/28 토 → 1/30 월
});

test("매주 월요일: 월요일 휴장이면 화요일", () => {
  const dates = weekdays("2024-05-20", "2024-06-07", ["2024-05-27"]);
  const s = core.buildSchedule(dates, { freq: "weekly", weekday: 1, start: "2024-05-20", end: "2024-06-07" });
  assert.deepEqual(s.map((x) => x.date), ["2024-05-20", "2024-05-28", "2024-06-03"]);
});

test("매일: 거래일마다 한 번", () => {
  const dates = weekdays("2024-01-01", "2024-01-14");
  const s = core.buildSchedule(dates, { freq: "daily", start: "2024-01-03", end: "2024-01-10" });
  assert.deepEqual(s.map((x) => x.date), ["2024-01-03", "2024-01-04", "2024-01-05", "2024-01-08", "2024-01-09", "2024-01-10"]);
});

test("긴 휴장으로 두 예정일이 한 거래일에 모이면 두 회분을 한 번에", () => {
  const dates = ["2024-01-02", "2024-01-20"]; // 사이가 비어 있는 달력
  const s = core.buildSchedule(dates, { freq: "weekly", weekday: 3, start: "2024-01-02", end: "2024-01-20" });
  assert.equal(s.length, 1);
  assert.equal(s[0].date, "2024-01-20");
  assert.equal(s[0].count, 3); // 1/3·1/10·1/17 세 회분이 모두 1/20 에 모인다
});

test("종료일 뒤로 밀리는 회차는 버린다", () => {
  const dates = weekdays("2024-06-01", "2024-06-30");
  const s = core.buildSchedule(dates, { freq: "monthly", monthDay: 15, start: "2024-06-01", end: "2024-06-14" });
  assert.equal(s.length, 0);
});

// ----- 시뮬레이션 -----
const flat = (n, p) => Array.from({ length: n }, () => p);

test("정수 매수 + 남는 돈 이월", () => {
  const dates = ["2024-01-02", "2024-02-01", "2024-03-01"];
  const schedule = dates.map((d) => ({ date: d, scheduled: d, shifted: false, count: 1 }));
  const r = core.simulateDca({
    dates, schedule, amount: 100, fractional: false, dividendMode: "none",
    assets: [{ key: "X", prices: flat(3, 30), dividends: null, weight: 1 }],
  });
  // 1회: 100 → 3주(90), 이월 10 / 2회: 110 → 3주, 이월 20 / 3회: 120 → 4주, 이월 0
  assert.equal(r.assets[0].shares, 10);
  near(r.leftoverCash, 0, 1e-9);
  near(r.assets[0].avgCost, 30, 1e-9);
  assert.equal(r.invested, 300);
  near(r.finalValue, 300, 1e-9);
});

test("이월금은 평가액에 현금으로 포함", () => {
  const dates = ["2024-01-02", "2024-02-01"];
  const schedule = [{ date: "2024-01-02", count: 1 }];
  const r = core.simulateDca({
    dates, schedule, amount: 100, fractional: false, dividendMode: "none",
    assets: [{ key: "X", prices: [30, 60], dividends: null, weight: 1 }],
  });
  assert.equal(r.assets[0].shares, 3);
  near(r.leftoverCash, 10, 1e-9);
  near(r.finalValue, 3 * 60 + 10, 1e-9);
});

test("소수점 매수는 남는 돈이 없다 + 평균단가 = 조화평균", () => {
  const dates = ["2024-01-02", "2024-02-01"];
  const schedule = dates.map((d) => ({ date: d, count: 1 }));
  const r = core.simulateDca({
    dates, schedule, amount: 100, fractional: true, dividendMode: "none",
    assets: [{ key: "X", prices: [10, 40], dividends: null, weight: 1 }],
  });
  near(r.assets[0].shares, 12.5, 1e-9);
  near(r.leftoverCash, 0, 1e-9);
  near(r.assets[0].avgCost, 200 / 12.5, 1e-9); // 16 = 2/(1/10+1/40)
  near(r.finalValue, 500, 1e-9);
  near(r.totalReturnPct, 150, 1e-9);
});

test("배당 재투자: 배당락일 종가로 재매수, 받기 전 보유 주식 기준", () => {
  const dates = ["2024-01-02", "2024-01-03", "2024-01-04"];
  const schedule = [{ date: "2024-01-02", count: 1 }];
  const common = {
    dates, schedule, amount: 1000, fractional: true,
    assets: [{ key: "X", prices: [100, 100, 100], dividends: [["2024-01-03", 5]], weight: 1 }],
  };
  const re = core.simulateDca({ ...common, dividendMode: "reinvest" });
  near(re.assets[0].shares, 10.5, 1e-9); // 10주 × 5 = 50 → 0.5주
  near(re.finalValue, 1050, 1e-9);
  const cash = core.simulateDca({ ...common, dividendMode: "cash" });
  near(cash.assets[0].shares, 10, 1e-9);
  near(cash.finalValue, 1050, 1e-9);
  near(cash.dividendCash, 50, 1e-9);
  const none = core.simulateDca({ ...common, dividendMode: "none" });
  near(none.finalValue, 1000, 1e-9);
});

test("배당락일이 휴장이면 다음 거래일에 반영, 기간 밖 배당은 무시", () => {
  const dates = ["2024-01-02", "2024-01-05"];
  const idx = core.dividendsByIndex(dates, [["2024-01-03", 1], ["2023-12-01", 9], ["2024-02-01", 9]]);
  assert.equal(idx.get(1), 1);
  assert.equal(idx.size, 1);
});

test("비중 60/40 분할 + 거치식 비교", () => {
  const dates = ["2024-01-02", "2024-07-01", "2025-01-02"];
  const schedule = [{ date: "2024-01-02", count: 1 }, { date: "2024-07-01", count: 1 }];
  const input = {
    dates, schedule, amount: 1000, fractional: true, dividendMode: "none",
    assets: [
      { key: "A", prices: [10, 20, 20], dividends: null, weight: 60 },
      { key: "B", prices: [10, 10, 10], dividends: null, weight: 40 },
    ],
  };
  const r = core.simulateDca(input);
  near(r.assets[0].contributed, 1200, 1e-9);
  near(r.assets[0].shares, 60 + 30, 1e-9);
  near(r.finalValue, 90 * 20 + 80 * 10, 1e-9);
  const lump = core.simulateLumpSum(input, r.invested, "2024-01-02");
  near(lump.finalValue, 120 * 20 + 80 * 10, 1e-9);
  // 거치식 CAGR = XIRR(단일 유입)
  near(lump.cagrPct, lump.xirrPct, 1e-4);
});

test("최대 낙폭은 적립금 유입을 뺀 시간가중 기준", () => {
  const dates = ["2024-01-02", "2024-02-01", "2024-03-01"];
  const schedule = dates.map((d) => ({ date: d, count: 1 }));
  const r = core.simulateDca({
    dates, schedule, amount: 100, fractional: true, dividendMode: "none",
    assets: [{ key: "X", prices: [100, 50, 100], dividends: null, weight: 1 }],
  });
  near(r.mddPct, -50, 1e-9); // 평가액은 100→150 으로 늘었지만 가격은 반토막
  near(r.minReturnPct, -25, 1e-9); // 2회차: 투자 200, 평가 150
});

test("commonDates·alignCloses", () => {
  assert.deepEqual(core.commonDates([["2024-01-02", "2024-01-03"], ["2024-01-03", "2024-01-04"]]), ["2024-01-03"]);
  const a = core.alignCloses(new Map([["2024-01-02", 5], ["2024-01-04", 7]]), ["2024-01-02", "2024-01-03", "2024-01-04"]);
  assert.deepEqual([...a], [5, 5, 7]);
  assert.equal(a.filledCount, 1);
});

test("addYears: 2/29 → 평년 2/28", () => {
  assert.equal(core.addYears("2024-02-29", -1), "2023-02-28");
});

if (failures.length) {
  console.error(`DCA core tests: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
console.log(`DCA core tests: ${passed} passed`);
