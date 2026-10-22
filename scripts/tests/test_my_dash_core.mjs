// 내 대시보드 레이아웃(my-dash-core.js) 단위 테스트. 네트워크·DOM 없음.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../my-dash-core.js");
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); } }

test("sanitize: 깨진 값은 기본, 모르는·다른 시장 전용·중복은 뺀다", () => {
  assert.deepEqual(core.sanitize(null, "us"), core.DEFAULT);
  assert.deepEqual(core.sanitize("x", "kr"), core.DEFAULT);
  assert.deepEqual(core.sanitize(["uoa", "watch", "watch", "nope"], "kr"), ["watch"]);
  assert.deepEqual(core.sanitize(["uoa", "watch"], "us"), ["uoa", "watch"]);
  assert.deepEqual(core.sanitize([], "us"), []);
});

test("add·remove·move·addable", () => {
  let l = ["watch", "issues"];
  l = core.add(l, "breadth", "us");
  assert.deepEqual(l, ["watch", "issues", "breadth"]);
  assert.deepEqual(core.add(l, "watch", "us"), l);
  assert.deepEqual(core.add(l, "uoa", "kr"), l);
  assert.deepEqual(core.move(l, "breadth", -1), ["watch", "breadth", "issues"]);
  assert.deepEqual(core.move(l, "watch", -1), l);
  assert.deepEqual(core.remove(l, "issues"), ["watch", "breadth"]);
  assert.ok(!core.addable(l, "kr").some((w) => w.id === "uoa"));
  assert.ok(core.addable(l, "us").some((w) => w.id === "uoa"));
});

test("upcomingEarnings: 30일 안·날짜순, 지난 날짜·깨진 값 제외", () => {
  const rows = [
    { ticker: "B", nextDate: "2026-11-05" }, { ticker: "A", nextDate: "2026-10-22" },
    { ticker: "C", nextDate: "2026-10-01" }, { ticker: "D", nextDate: "2027-01-30" }, { ticker: "E", nextDate: "" },
  ];
  const out = core.upcomingEarnings(rows, "2026-10-22", 30);
  assert.deepEqual(out.map((r) => [r.ticker, r.daysAhead]), [["A", 0], ["B", 14]]);
  assert.deepEqual(core.upcomingEarnings(rows, "bad"), []);
});

test("relatedIndicators: 내 종목 여럿이 따르는 지표가 위, 중복 종목 한 번", () => {
  const by = { AAPL: ["sc_mobile_ios", "nyfed_gscpi"], "005930": ["sc_vendor_samsung", "sc_mobile_ios"], X: ["fao_food_price"] };
  const out = core.relatedIndicators(by, ["AAPL", "005930", "AAPL", "NONE"], 2);
  assert.deepEqual(out, [{ id: "sc_mobile_ios", tickers: ["AAPL", "005930"] }, { id: "nyfed_gscpi", tickers: ["AAPL"] }]);
  assert.deepEqual(core.relatedIndicators(null, ["AAPL"]), []);
});

test("recentMine·openMarketTrades: 내 종목·기간·최신순, 장내 매수·매도만", () => {
  const rows = [
    { ticker: "AAPL", fileDate: "2026-10-21", code: "S" }, { ticker: "AAPL", fileDate: "2026-09-01", code: "P" },
    { ticker: "MSFT", fileDate: "2026-10-22", code: "P" }, { ticker: "NVDA", fileDate: "2026-10-20", code: "A" },
    { ticker: "AAPL", fileDate: "2026-10-23", code: "P" },
  ];
  assert.deepEqual(core.recentMine(rows, ["AAPL", "NVDA"], "2026-10-22", 14).map((r) => r.fileDate), ["2026-10-21", "2026-10-20"]);
  assert.deepEqual(core.openMarketTrades(rows).map((r) => r.code), ["S", "P", "P", "P"]);
  assert.deepEqual(core.recentMine(rows, [], "2026-10-22"), []);
});

test("targetChanges: 미국 표·국내 목록을 같은 모양으로", () => {
  const us = { cols: ["t", "d", "firm", "act", "from", "to", "pt", "ptPrev", "ptAct"], rows: [
    ["ACN", "2026-10-21", "Baird", "down", "Outperform", "Neutral", 252, 245, "Raises"],
    ["ABBV", "2026-10-21", "Barclays", "main", "Overweight", "Overweight", 300, 325, "Lowers"]] };
  const u = core.targetChanges(us, "us");
  assert.deepEqual(u.map((r) => [r.ticker, r.dir, r.note]), [["ACN", -1, "Outperform → Neutral"], ["ABBV", -1, "Overweight"]]);
  const kr = { changes: [{ date: "2026-10-22", code: "293490", broker: "미래에셋증권", prev: 9000, target: 15000, opinion: "매수" }] };
  assert.deepEqual(core.targetChanges(kr, "kr")[0], { ticker: "293490", fileDate: "2026-10-22", firm: "미래에셋증권", pt: 15000, ptPrev: 9000, dir: 1, note: "매수" });
  assert.deepEqual(core.targetChanges(null, "us"), []);
});

test("upcomingSchedule: 지금 시장 일정 + FOMC + 지표 발표, 2주 안·날짜순", () => {
  const mc = { events: [
    { date: "2026-10-29", time: "03:00", market: "us", kind: "fomc", title: "FOMC 기준금리 결정" },
    { date: "2026-11-12", market: "kr", kind: "expiry", title: "코스피200 옵션 월물 만기" },
    { date: "2026-11-20", market: "us", kind: "expiry", title: "미국 월간 옵션 만기" },
    { date: "2026-10-30", market: "us", kind: "holiday", title: "미국 휴장" }] };
  const ic = { events: [{ name_kr: "미국 신규주택 판매", date: "2026-10-25", time_kst: "23:00" }, { name_kr: "먼 지표", date: "2026-12-30" }] };
  const kr = core.upcomingSchedule(mc, ic, "kr", "2026-10-22", 21).map((r) => r.title);
  assert.deepEqual(kr, ["미국 신규주택 판매", "FOMC 기준금리 결정", "코스피200 옵션 월물 만기"]);
  const us = core.upcomingSchedule(mc, ic, "us", "2026-10-22", 14).map((r) => [r.title, r.daysAhead]);
  assert.deepEqual(us, [["미국 신규주택 판매", 3], ["FOMC 기준금리 결정", 7], ["미국 휴장", 8]]);
  assert.deepEqual(core.upcomingSchedule(null, null, "us", "2026-10-22"), []);
});

test("groupTrades: 같은 사람·날짜·매수/매도는 한 줄로 합친다", () => {
  const g = core.groupTrades([
    { ticker: "NVDA", owner: "A", fileDate: "2026-09-23", code: "S", value: 2.8e6, shares: 10 },
    { ticker: "NVDA", owner: "A", fileDate: "2026-09-23", code: "S", value: 3.0e6, shares: 12 },
    { ticker: "NVDA", owner: "B", fileDate: "2026-09-23", code: "S", value: 1e6, shares: 4 }]);
  assert.deepEqual(g.map((r) => [r.owner, r.value, r.shares, r.n]), [["A", 5.8e6, 22, 2], ["B", 1e6, 4, 1]]);
});

if (failures.length) { console.error(`my-dash-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`); process.exit(1); }
console.log(`my-dash-core: ${passed}개 통과`);
