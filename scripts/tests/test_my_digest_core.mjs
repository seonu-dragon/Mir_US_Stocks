// "오늘 내 주식은" 순수 함수(my-digest-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_my_digest_core.mjs   (CI 의 "My digest core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../my-digest-core.js");

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

const series = (n, v = 100) => Array.from({ length: n }, () => v);
// 섹터 비교는 5종목 이상일 때만 — 같은 섹터 종목 5개를 채운다.
function universe() {
  const tech = ["AAA", "BBB", "CCC", "DDD", "EEE"].map((t, i) => ({
    ticker: t, company: `${t} Inc`, sector: "TECHNOLOGY", industry: "Semis", price: 100, changePct: 1 + i * 0.5,
    weekChangePct: 2, marketCapB: 10, closeSeries: series(40), priceDate: "2026-09-25",
  }));
  return [
    ...tech,
    { ticker: "NVDA", company: "NVIDIA", sector: "TECHNOLOGY", industry: "Semis", price: 200, changePct: 5.2, weekChangePct: 8, marketCapB: 100, closeSeries: series(40), priceDate: "2026-09-25" },
    { ticker: "KO", company: "Coca-Cola", sector: "CONSUMER", industry: "Bev", price: 50, changePct: -0.4, weekChangePct: -3, marketCapB: 50, closeSeries: series(40), priceDate: "2026-09-25" },
    { ticker: "XOM", company: "Exxon", sector: "ENERGY", industry: "Oil", price: 100, changePct: -2.0, weekChangePct: -1, marketCapB: 50, closeSeries: series(40), priceDate: "2026-09-25" },
    { ticker: "SPY", company: "SPDR S&P 500", sector: "EXCHANGE TRADED FUNDS", industry: "ETF", price: 500, changePct: 0.5, weekChangePct: 1.1, marketCapB: 500, closeSeries: series(40), priceDate: "2026-09-25" },
    // 가격 이력 없는 행: 빌더가 weekChangePct 를 당일 등락으로 채운다 → 5거래일 수익률로 쓰면 안 된다.
    { ticker: "NEW", company: "Newco", sector: "TECHNOLOGY", industry: "Semis", price: 10, changePct: 3, weekChangePct: 3, marketCapB: 1, priceDate: "2026-09-25" },
  ];
}

test("날짜 보조", () => {
  assert.equal(core.normIso("20260925"), "2026-09-25");
  assert.equal(core.normIso("2026.09.25"), "2026-09-25");
  assert.equal(core.normIso("2026-13-01"), null);
  assert.equal(core.prevWeekday("2026-09-28"), "2026-09-25"); // 월 → 금
  assert.equal(core.prevWeekday("2026-09-25"), "2026-09-24");
  assert.equal(core.addDays("2026-09-25", -6), "2026-09-19");
  assert.equal(core.fmtPct(1.234), "+1.2%");
  assert.equal(core.fmtPct(-0.04), "0.0%");
  assert.equal(core.fmtPp(0.456), "+0.46%p");
});

test("5거래일 수익률은 가격 이력이 있을 때만", () => {
  const u = universe();
  assert.equal(core.weekReturnOf(u.find((r) => r.ticker === "NVDA")), 8);
  assert.equal(core.weekReturnOf(u.find((r) => r.ticker === "NEW")), null);
});

test("업종 평균: 시총가중·ETF 제외·5종목 미만이면 섹터로", () => {
  const avg = core.groupAverages(universe(), "changePct");
  assert.ok(!avg.bySector["EXCHANGE TRADED FUNDS"]);
  // TECHNOLOGY: 5×10 cap(1,1.5,2,2.5,3) + NVDA 100cap 5.2 + NEW 1cap 3
  const exp = (10 * (1 + 1.5 + 2 + 2.5 + 3) + 100 * 5.2 + 1 * 3) / 151;
  assert.ok(Math.abs(avg.bySector.TECHNOLOGY.avg - exp) < 1e-9);
  const g = core.groupFor({ sector: "ENERGY", industry: "Oil" }, avg);
  assert.equal(g, null); // 1종목뿐이라 비교하지 않는다
  const g2 = core.groupFor({ sector: "TECHNOLOGY", industry: "Semis" }, avg, (n) => (n === "Semis" ? "반도체" : n));
  assert.equal(g2.name, "반도체");
  assert.equal(g2.level, "industry");
  assert.equal(core.relativeText(1.2, { name: "기술", avg: 1, level: "sector" }, null), "섹터(기술) 평균 +1.0%와 비슷");
  assert.equal(core.relativeText(-2, { name: "철강", avg: 1, level: "industry" }, { name: "코스피", changePct: 0.9 }), "업종(철강) 평균 +1.0%보다 3.0%p 낮음 · 코스피 +0.9%");
});

test("기여도 = 수익률 × 현재 비중(portfolio.js 벤치마크 기여도와 같은 식)", () => {
  const rows = core.contributionRows([
    { ticker: "A", value: 300, returnPct: 10 },
    { ticker: "B", value: 100, returnPct: -4 },
    { ticker: "C", value: 100, returnPct: null }, // 이력 없음 → 빠지고 비중 재배분
  ], 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].weightPct, 75);
  assert.equal(rows[0].contribution, 7.5);
  assert.equal(rows[1].contribution, -1);
  assert.equal(rows[0].alphaContribution, 6);
});

test("사건 조회: 미국 8-K·실적 보도자료 정규화, 중복 2.02 제거, 기간·종목 필터", () => {
  const sources = {
    materialEvents: { events: [
      { ticker: "NVDA", fileDate: "2026-09-25", hot: true, link: "l1", items: [{ code: "2.02", label: "실적 발표" }, { code: "9.01", label: "재무제표·첨부" }] },
      { ticker: "NVDA", fileDate: "2026-09-24", items: [{ code: "5.02", label: "임원 변경" }] },
      { ticker: "KO", fileDate: "2026-09-10", items: [{ code: "8.01", label: "기타" }] },
      { ticker: "ZZZ", fileDate: "2026-09-25", items: [{ code: "8.01", label: "기타" }] },
    ] },
    earningsReleases: { releases: [{ ticker: "NVDA", fileDate: "2026-09-25", oneLine: "매출이 늘었다.", exhibitUrl: "ex" }] },
  };
  const ev = core.pastEvents(sources, new Set(["NVDA", "KO"]), "2026-09-24", "2026-09-25");
  assert.equal(ev.length, 2); // 2.02 8-K 는 보도자료와 중복이라 빠지고, KO 는 기간 밖, ZZZ 는 대상 아님
  assert.equal(ev[0].kind, "earnings");
  assert.match(ev[0].label, /실적 발표 — 매출이 늘었다/);
  assert.equal(ev[1].label, "8-K 임원 변경");
});

test("사건 조회: 국내 공시 우선순위와 중복 제거", () => {
  const ev = core.pastEvents({ krDisclosures: { disclosures: [
    { ticker: "005930", fileDate: "2026-09-23", typeLabel: "분기보고서", title: "분기보고서 (2026.07)", link: "a" },
    { ticker: "005930", fileDate: "2026-09-23", typeLabel: "연결재무제표기준영업(잠정)실적(공정공시)", title: "x", link: "b" },
    { ticker: "005930", fileDate: "2026-09-23", typeLabel: "분기보고서", title: "분기보고서 (2026.07)", link: "a" },
  ] } }, new Set(["005930"]), "2026-09-22", "2026-09-23");
  assert.equal(ev.length, 2);
  assert.equal(ev[0].kind, "earnings");
  assert.equal(ev[0].link, "b");
});

test("다가오는 일정: 14일 안·과거 제외·국내 배당 정정 중복 제거", () => {
  const up = core.upcomingEvents({
    usCalendar: { stocks: { NVDA: { nextEarnings: "2026-10-01", exDate: "2026-09-10", divRate: 0.04 }, KO: { nextEarnings: "2026-12-01", exDate: "2026-09-29", divRate: 2.04 } } },
    krIrSchedule: { rows: [{ code: "005930", date: "2026-10-08", earnings: true }, { code: "005930", date: "2026-10-02", earnings: false }] },
    krDividends: { rows: [
      { ticker: "005930", divKind: "분기배당", recordDate: "2026-09-30", payDate: "2026-11-20", dps: 361, date: "2026-09-01" },
      { ticker: "005930", divKind: "분기배당", recordDate: "2026-09-30", payDate: "2026-11-20", dps: 361, date: "2026-09-02" },
    ] },
  }, null, "2026-09-27", 14);
  const labels = up.map((u) => `${u.ticker}|${u.label}|${u.dday}`);
  assert.deepEqual(labels, [
    "KO|배당락(연 $2.04)|2",
    "005930|배당기준일 주당 361원|3",
    "NVDA|실적 발표 예정|4",
    "005930|실적 발표(IR)|11",
  ]);
});

function dailyInput(extra) {
  return {
    market: "us", today: "2026-09-27", basisDate: "2026-09-25",
    holdings: [{ ticker: "NVDA", qty: 3 }, { ticker: "KO", qty: 4 }],
    watchlist: ["nvda", "XOM", "GONE"],
    universe: universe(),
    names: { NVDA: "NVDA", KO: "KO", XOM: "XOM" },
    bench: { name: "S&P 500(SPY)", changePct: 0.5, weekChangePct: 1.1 },
    labelOf: (n) => ({ TECHNOLOGY: "기술", CONSUMER: "필수소비재", ENERGY: "에너지" }[n] || n),
    preferSector: true,
    ...extra,
  };
}

test("일간: 보유 먼저·중복 제거·없는 종목은 missing·포트 기여", () => {
  const d = core.buildDailyDigest(dailyInput({}));
  assert.deepEqual(d.items.map((i) => `${i.ticker}:${i.role}`), ["NVDA:보유", "KO:보유", "XOM:관심"]);
  assert.deepEqual(d.missing, ["GONE"]);
  // 평가액 600 / 200 → 비중 75% / 25%, 기여 5.2×0.75 = 3.9, −0.4×0.25 = −0.1
  assert.ok(Math.abs(d.portfolio.dayReturnPct - 3.8) < 1e-9);
  assert.equal(d.portfolio.topTicker, "NVDA");
  assert.match(d.headline, /보유 2종목 오늘 \+3\.80%/);
  assert.equal(d.items[0].lines[0], "NVDA +5.2% · 비중 75% · 포트 기여 +3.90%p");
  assert.deepEqual(d.eventWindow, { from: "2026-09-24", to: "2026-09-25" });
});

test("일간 이유: 특징주 사유 → 사건 → 업종·지수 대비(사실)", () => {
  const movers = { tradeDate: "2026-09-25", up: [{ ticker: "NVDA", reason: "신제품 발표 보도", reasonStatus: "ok", sectorNote: "", evidence: [{ link: "n1" }] }], down: [] };
  const past = [{ ticker: "KO", date: "2026-09-25", kind: "disclosure", label: "8-K 임원 변경", link: "k1", priority: 60 },
    { ticker: "KO", date: "2026-09-20", kind: "disclosure", label: "8-K 오래됨", link: "", priority: 99 }];
  const d = core.buildDailyDigest(dailyInput({ movers, past }));
  const by = Object.fromEntries(d.items.map((i) => [i.ticker, i.reason]));
  assert.equal(by.NVDA.type, "movers");
  assert.equal(by.NVDA.text, "신제품 발표 보도");
  assert.equal(by.KO.type, "event");
  assert.equal(by.KO.text, "9/25 8-K 임원 변경"); // 기간(직전 평일~기준일) 밖 사건은 안 붙는다
  assert.equal(by.XOM.type, "relative");
  // 에너지는 1종목뿐이라 업종 비교 없이 지수만
  assert.equal(by.XOM.text, "특별한 공시·특징주 사유 없음 — S&P 500(SPY) +0.5%");
});

test("일간 이유: 다른 거래일의 특징주 사유는 붙이지 않는다 · 업종 비교 문구", () => {
  const movers = { tradeDate: "2026-09-24", up: [{ ticker: "NVDA", reason: "어제 사유", reasonStatus: "ok" }], down: [] };
  const d = core.buildDailyDigest(dailyInput({ movers, holdings: [], watchlist: ["NVDA", "AAA"] }));
  const nv = d.items.find((i) => i.ticker === "NVDA");
  assert.equal(nv.reason.type, "relative");
  assert.match(nv.reason.text, /^특별한 공시·특징주 사유 없음 — 섹터\(기술\) 평균 \+\d\.\d%보다 \d\.\d%p 높음 · S&P 500\(SPY\) \+0\.5%$/);
  // 'reasonStatus: none'(뚜렷한 재료 확인 안 됨)도 사건·대비로 넘어간다
  const d2 = core.buildDailyDigest(dailyInput({ movers: { tradeDate: "2026-09-25", up: [{ ticker: "NVDA", reasonStatus: "none", reason: "뚜렷한 재료 확인 안 됨" }], down: [] } }));
  assert.equal(d2.items[0].reason.type, "relative");
  assert.equal(d.headline, "관심 2종목 중 상승 2 · 하락 0");
});

test("일간: 다가오는 일정 줄(최대 2개)", () => {
  const upcoming = [
    { ticker: "NVDA", date: "2026-09-27", dday: 0, kind: "earnings", label: "실적 발표 예정" },
    { ticker: "NVDA", date: "2026-09-29", dday: 2, kind: "dividend", label: "배당락" },
    { ticker: "NVDA", date: "2026-10-01", dday: 4, kind: "dividend", label: "배당 지급일" },
  ];
  const d = core.buildDailyDigest(dailyInput({ upcoming }));
  const nv = d.items[0];
  assert.equal(nv.upcoming.length, 2);
  assert.equal(nv.lines[2], "다가오는 일정: 실적 발표 예정 D-DAY(9/27) · 배당락 D-2(9/29)");
  assert.ok(nv.lines.length <= 3);
});

test("주간: 보유 기여 상·하위와 이유, 이력 없는 종목 표시", () => {
  const past = [{ ticker: "KO", date: "2026-09-22", kind: "disclosure", label: "8-K 기타", link: "", priority: 60 }];
  const w = core.buildWeeklyDigest(dailyInput({ past, holdings: [{ ticker: "NVDA", qty: 3 }, { ticker: "KO", qty: 4 }, { ticker: "NEW", qty: 10 }] }));
  assert.equal(w.mode, "contribution");
  assert.deepEqual(w.window, { from: "2026-09-19", to: "2026-09-25" });
  assert.deepEqual(w.noHistory, ["NEW"]);
  assert.equal(w.top.length, 1);
  assert.equal(w.top[0].ticker, "NVDA");
  assert.equal(w.bottom[0].ticker, "KO");
  assert.equal(w.bottom[0].reason.type, "event");
  // 비중 75/25 → 8×0.75 − 3×0.25 = 5.25
  assert.ok(Math.abs(w.portfolioReturnPct - 5.25) < 1e-9);
  assert.match(w.top[0].lines[0], /^NVDA 기여 \+6\.00%p\(5거래일 \+8\.0% · 비중 75%\)$/);
  assert.match(w.headline, /S&P 500\(SPY\) \+1\.1%/);
});

test("주간: 보유가 없으면 관심종목 5거래일 등락 상·하위", () => {
  const w = core.buildWeeklyDigest(dailyInput({ holdings: [], watchlist: ["NVDA", "KO", "XOM", "SPY"] }));
  assert.equal(w.mode, "return");
  assert.deepEqual(w.top.map((i) => i.ticker), ["NVDA", "SPY"]);
  assert.deepEqual(w.bottom.map((i) => i.ticker), ["KO", "XOM"]);
  assert.equal(w.bottom[0].reason.text.startsWith("기간 중 확인된 공시 없음"), true);
});

test("문구에 추천·전망 표현이 없다", () => {
  const d = core.buildDailyDigest(dailyInput({}));
  const w = core.buildWeeklyDigest(dailyInput({}));
  const text = core.digestToText(d) + core.digestToText(w);
  assert.ok(text.includes("오늘 내 주식은"));
  assert.ok(text.includes("이번 주 내 주식은"));
  assert.doesNotMatch(text, /매수|매도|추천|전망|기대|목표|유망|반등할|오를|내릴/);
});

test("빈 입력도 깨지지 않는다", () => {
  const d = core.buildDailyDigest({});
  assert.equal(d.items.length, 0);
  assert.equal(d.portfolio, null);
  const w = core.buildWeeklyDigest({});
  assert.equal(w.top.length, 0);
  assert.equal(core.digestToText(d).startsWith("오늘 내 주식은"), true);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`OK ${passed} tests (my-digest-core)`);
