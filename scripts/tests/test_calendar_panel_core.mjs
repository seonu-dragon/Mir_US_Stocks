// 통합 캘린더 순수 함수(calendar-panel-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_calendar_panel_core.mjs   (CI 의 "Calendar panel core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../calendar-panel-core.js");

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

test("날짜 정규화·계산", () => {
  assert.equal(core.normIso("2026.11.10"), "2026-11-10");
  assert.equal(core.normIso("2026/09/24 21:30:00"), "2026-09-24");
  assert.equal(core.normIso("20260924"), "2026-09-24");
  assert.equal(core.normIso("2026-13-01"), null);
  assert.equal(core.addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(core.addMonths("2026-12-15", 1), "2027-01-01");
  assert.equal(core.weekday("2026-09-27"), 0); // 일요일
  assert.equal(core.dayLabel("2026-10-09"), "10월 9일 (금)");
});

test("한국 시간 오늘", () => {
  // UTC 2026-09-26 16:00 = KST 09-27 01:00
  assert.equal(core.kstToday(new Date(Date.UTC(2026, 8, 26, 16, 0))), "2026-09-27");
  assert.equal(core.kstToday(new Date(Date.UTC(2026, 8, 26, 14, 59))), "2026-09-26");
});

test("주·월 범위와 격자(일요일 시작)", () => {
  assert.deepEqual(core.weekRange("2026-10-01"), { start: "2026-09-27", end: "2026-10-03" });
  assert.deepEqual(core.rangeFor("month", "2026-10-15"), { start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(core.rangeFor("week", "2026-09-26"), { start: "2026-09-26", end: "2026-10-02" }); // 기준일부터 7일
  const g = core.monthGrid("2026-10-15");
  assert.equal(g[0][0].iso, "2026-09-27");
  assert.equal(g[0][0].inMonth, false);
  assert.equal(g[0][4].iso, "2026-10-01");
  assert.equal(g[g.length - 1][6].iso, "2026-10-31"); // 10-31 이 토요일
  assert.ok(g.every((w) => w.length === 7));
});

test("MARKET_CALENDAR 정규화", () => {
  const ev = core.fromMarketCalendar({ events: [
    { date: "2026-10-09", market: "kr", kind: "holiday", title: "한국 휴장", name: "한글날" },
    { date: "2026-11-27", market: "us", kind: "early_close", name: "추수감사절 다음 날", detail: "13:00 ET 마감" },
    { date: "2026-12-10", market: "kr", kind: "expiry", title: "한국 선물·옵션 동시 만기", quarterly: true },
    { date: "2026-10-29", time: "03:00", market: "us", kind: "fomc", title: "FOMC 기준금리 결정" },
  ] });
  assert.deepEqual(ev.map((e) => e.kind), ["holiday", "holiday", "expiry", "econ"]);
  assert.equal(ev[1].title, "미국 단축 거래");
  assert.equal(ev[3].time, "03:00");
});

test("국내 IR: 실적 IR 만", () => {
  const ev = core.fromKrIr({ rows: [
    { code: "005380", company: "현대자동차", date: "2026-10-23", time: "14:10", earnings: true, purpose: "3분기 경영실적 발표", rcept: "1" },
    { code: "322180", company: "LS티라유텍", date: "2026-09-30", earnings: false, rcept: "2" },
  ] });
  assert.equal(ev.length, 1);
  assert.equal(ev[0].ticker, "005380");
  assert.equal(ev[0].kind, "earnings");
});

test("미국 실적(두 소스 중 이른 날)·배당락", () => {
  const ev = core.fromUsCalendar(
    { stocks: { AAPL: { nextEarnings: "2026-10-29", exDate: "2026-11-09", divRate: 1.08 }, NVDA: { nextEarnings: "2026-11-17" } } },
    { earnings: [{ ticker: "AAPL", nextDate: "2026-10-30" }, { ticker: "UL", nextDate: "2026-07-28" }] },
    { AAPL: "Apple Inc." },
    "2026-09-19",
  );
  const earn = ev.filter((e) => e.kind === "earnings");
  assert.deepEqual(earn.map((e) => [e.ticker, e.date]).sort(), [["AAPL", "2026-10-29"], ["NVDA", "2026-11-17"]]);
  const div = ev.find((e) => e.kind === "dividend");
  assert.equal(div.info, "연간 주당 배당금 $1.08");
  assert.equal(div.name, "Apple Inc.");
});

test("국내 배당: 정정 공시는 최신만, 기준일·지급일 둘", () => {
  const ev = core.fromKrDividends({ rows: [
    { ticker: "008370", company: "원풍", divKind: "분기배당", recordDate: "2026-09-30", payDate: "2026-10-13", dps: 300, yieldPct: 6, date: "2026-09-10", link: "a" },
    { ticker: "008370", company: "원풍", divKind: "분기배당", recordDate: "2026-09-30", payDate: "2026-10-20", dps: 300, yieldPct: 6, date: "2026-09-15", link: "b" },
  ] });
  assert.equal(ev.length, 2);
  assert.deepEqual(ev.map((e) => e.date).sort(), ["2026-09-30", "2026-10-20"]);
  assert.equal(ev[0].info, "주당 배당금 300원 · 시가배당률 6%");
});

test("공모주: 미국은 가격 확정만, 국내는 청약·상장", () => {
  const us = core.fromIpo({ ipos: [
    { company: "A", stage: "priced", fileDate: "2026-09-24", offerPrice: 12, accession: "x" },
    { company: "B", stage: "filed", fileDate: "2026-09-24", accession: "y" },
  ] }, "us");
  assert.equal(us.length, 1);
  assert.equal(us[0].info, "공모가 $12.00");
  const kr = core.fromIpo({ ipos: [
    { company: "바로팜", stage: "filed", fileDate: "2026.11.02", accession: "kr-ipo-bidding-바로팜", form: "미래에셋증권", offerPriceBand: [16400, 20200] },
  ] }, "kr");
  assert.equal(kr[0].title, "공모 청약 시작");
  assert.equal(kr[0].info, "희망공모가 16,400~20,200원 · 주관 미래에셋증권");
});

test("경제지표: 중요도 2 이상, 한국·미국, 미국 금리 결정 제외", () => {
  const ev = core.fromEcon([
    { datetime: "2026/10/02 21:30:00", time: "21:30", country: "미국", importance: 3, event: "비농업 고용", forecast: "120K", previous: "142K" },
    { datetime: "2026/10/02 08:00:00", time: "08:00", country: "한국", importance: 1, event: "무역수지" },
    { datetime: "2026/10/29 03:00:00", time: "03:00", country: "미국", importance: 3, event: "연준 금리 결정" },
    { datetime: "2026/10/02 10:00:00", time: "10:00", country: "일본", importance: 3, event: "X" },
  ]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].info, "예상 120K · 이전 142K");
  assert.equal(ev[0].important, true);
});

test("필터: 칩·기간·관심종목(시장 일정은 유지)", () => {
  const events = [
    { id: "1", date: "2026-10-01", kind: "earnings", ticker: "AAPL" },
    { id: "2", date: "2026-10-01", kind: "earnings", ticker: "MSFT" },
    { id: "3", date: "2026-10-09", kind: "holiday" },
    { id: "4", date: "2026-11-01", kind: "dividend", ticker: "AAPL" },
  ];
  const watch = new Set(["AAPL"]);
  assert.deepEqual(core.filterEvents(events, { start: "2026-10-01", end: "2026-10-31" }).map((e) => e.id), ["1", "2", "3"]);
  assert.deepEqual(core.filterEvents(events, { kind: "earnings" }).map((e) => e.id), ["1", "2"]);
  assert.deepEqual(core.filterEvents(events, { watchOnly: true, watchSet: watch }).map((e) => e.id), ["1", "3", "4"]);
  const c = core.countByKind(events);
  assert.equal(c.all, 4);
  assert.equal(c.earnings, 2);
  assert.equal(c.ipo, 0);
});

test("날짜별 묶음·정렬(휴장→만기→경제→실적)", () => {
  const g = core.groupByDate([
    { id: "a", date: "2026-10-02", kind: "earnings", name: "B" },
    { id: "b", date: "2026-10-01", kind: "econ", time: "21:30", title: "고용" },
    { id: "c", date: "2026-10-01", kind: "holiday", title: "휴장" },
    { id: "d", date: "2026-10-01", kind: "econ", time: "08:00", title: "무역" },
  ]);
  assert.deepEqual(g.map((x) => x.date), ["2026-10-01", "2026-10-02"]);
  assert.deepEqual(g[0].rows.map((e) => e.id), ["c", "d", "b"]);
  const k = core.kindsByDate([{ date: "2026-10-01", kind: "econ" }, { date: "2026-10-01", kind: "holiday" }]);
  assert.deepEqual([...k["2026-10-01"]].sort(), ["econ", "holiday"]);
  assert.equal(core.dedupe([{ id: "x" }, { id: "x" }, { id: "y" }]).length, 2);
});

if (failures.length) {
  console.error(`실패 ${failures.length}건:\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`calendar-panel-core: ${passed}개 통과`);
