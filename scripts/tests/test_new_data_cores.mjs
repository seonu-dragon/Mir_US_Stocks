// VIX 기간구조(vix-term-core.js) · 애널리스트 의견/추정치(analyst-revisions-core.js) · 배당 성장(dividend-growth-core.js)
// 순수 함수 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_new_data_cores.mjs   (CI 의 "VIX term · analyst revisions · dividend growth core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const vix = require("../../vix-term-core.js");
const ar = require("../../analyst-revisions-core.js");
const dg = require("../../dividend-growth-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

// ----- VIX -----
const hist = [];
for (let i = 0; i < 40; i += 1) {
  const r = i < 30 ? 0.9 : 1.1;          // 마지막 10일 백워데이션
  hist.push([`2026-09-${String(i + 1).padStart(2, "0")}`, 20 * r, 20, 19 + i * 0.01, 19.5 + i * 0.01]);
}
const VIX = {
  asOf: "2026-10-19",
  spot: [{ id: "VIX3M", days: 93, v: 20, prev: 20.5 }, { id: "VIX", days: 30, v: 22, prev: 19.99 }, { id: "VIX9D", days: 9, v: 24 }],
  futures: [{ exp: "2026-10-21", label: "2026-10", days: 2, settle: 21 }, { exp: "2026-11-18", label: "2026-11", days: 30, settle: 20 }],
  week: { date: "2026-10-12", futures: [{ exp: "2026-11-18", label: "2026-11", days: 37, settle: 18 }] },
  history: hist,
};

test("VIX 요약: 비율·상태·연속 일수·백분위", () => {
  const s = vix.summary(VIX);
  assert.equal(Math.round(s.ratio * 100) / 100, 1.1);
  assert.equal(s.state, "back");
  assert.equal(s.stateDays, 10);
  assert.equal(s.backDays, 10);
  assert.equal(s.histDays, 40);
  assert.equal(s.ratioPct, 100);
  assert.equal(Math.round(s.spread * 10000) / 10000, Math.round((20 / 21 - 1) * 10000) / 10000);
  assert.equal(s.front.label, "2026-10");
  assert.equal(vix.summary(null), null);
});

test("VIX 곡선 점은 만기순, 없는 곡선은 빈 배열", () => {
  assert.deepEqual(vix.curvePoints(VIX, "spot").map((p) => p.label), ["VIX9D", "VIX", "VIX3M"]);
  assert.equal(vix.curvePoints(VIX, "week").length, 1);
  assert.deepEqual(vix.curvePoints(VIX, "month"), []);
});

test("VIX 눈금·범위·가로축", () => {
  assert.deepEqual(vix.niceTicks(17.3, 24.6, 4), [18, 20, 22, 24]);
  const d = vix.yDomain([vix.curvePoints(VIX, "spot"), vix.curvePoints(VIX, "futures")]);
  assert.ok(d.min < 20 && d.max > 24);
  assert.equal(vix.xScale(365, 365, 600), 600);
  assert.equal(Math.round(vix.xScale(91.25, 365, 600)), 300);   // 제곱근 눈금
  assert.equal(vix.tenorLabel(9), "9일");
  assert.equal(vix.tenorLabel(93), "3개월");
  assert.equal(vix.tenorLabel(365), "1년");
  assert.equal(vix.percentile([1, 2], 1), null);                  // 표본 20개 미만
  assert.equal(vix.fmtSignedPct(-0.0476), "-4.8%");
});

// ----- 애널리스트 -----
const EST = {
  cols: ["period", "end", "cur", "d7", "d30", "d60", "d90", "up7", "up30", "dn7", "dn30", "n"],
  ratingCols: ["d", "firm", "act", "from", "to", "pt", "ptPrev"],
  tickers: {
    AAA: { p: [["0y", "2026-12-31", 2.2, 2.1, 2.0, 1.9, 1.8, 1, 6, 0, 1, 20]], r: [["2026-10-20", "Loop Capital", "down", "Buy", "Hold", 330, 370]] },
    BBB: { p: [["0y", "2026-12-31", 0.9, 1.0, 1.0, 1.0, 1.0, 0, 0, 1, 4, 8]], r: [] },
    CCC: { p: [["0y", "2026-12-31", 3.0, 3.0, 2.0, 2.0, 2.0, 0, 3, 0, 0, 3]], r: [] },     // 추정 3명 → 제외
    DDD: { p: [["0y", "2026-12-31", 0.5, 0.5, 0.01, 0.0, 0.0, 0, 0, 0, 0, 12]], r: [] },   // 기준 0.01 → 비율 없음
    EEE: { p: [["0y", "2026-12-31", -0.5, -0.8, -1.0, -1.0, -1.0, 2, 4, 0, 0, 10]], r: [] }, // 적자 축소 = +50%
  },
};

test("추정치 변화율: 음수 기준·작은 기준", () => {
  assert.equal(ar.changePct(2.2, 2.0).toFixed(4), "10.0000");
  assert.equal(ar.changePct(-0.5, -1.0), 50);
  assert.equal(ar.changePct(-2, -1), -100);
  assert.equal(ar.changePct(0.5, 0.01), null);
  assert.equal(ar.changePct(null, 1), null);
});

test("종목 추정치 행·의견 이력", () => {
  const rows = ar.estimateRows(EST, "AAA");
  assert.equal(rows[0].label, "올해 회계연도");
  assert.equal(Math.round(rows[0].chg30), 10);
  assert.equal(Math.round(rows[0].chg90 * 10) / 10, 22.2);
  assert.deepEqual(ar.estimateRows(EST, "ZZZ"), []);
  const r = ar.tickerRatings(EST, "AAA")[0];
  assert.equal(r.firm, "Loop Capital");
  assert.equal(ar.gradeText(r), "Buy → Hold");
  assert.equal(ar.actionLabel(r.act), "하향");
});

test("상향·하향 상위와 시장 폭", () => {
  const lead = ar.revisionLeaders(EST, { minAnalysts: 5, limit: 5 });
  assert.deepEqual(lead.up.map((x) => x.ticker), ["EEE", "AAA"]);
  assert.deepEqual(lead.down.map((x) => x.ticker), ["BBB"]);
  assert.deepEqual(lead.breadth, { up: 2, down: 1, flat: 0, total: 3 });
});

test("의견 변경 피드 분류·개수", () => {
  const feed = ar.feedRows({ cols: ["t", "d", "firm", "act", "from", "to", "pt", "ptPrev", "ptAct"], rows: [
    ["AAA", "2026-10-20", "Loop", "down", "Buy", "Hold", 330, 370, "Lowers"],
    ["BBB", "2026-10-19", "JPM", "main", "OW", "OW", 360, 340, "Raises"],
    ["CCC", "2026-10-18", "Piper", "init", "", "Overweight", 300, null, "Announces"],
    ["DDD", "2026-10-18", "MS", "up", "EW", "OW", null, null, ""],
  ] });
  const c = ar.kindCounts(feed);
  assert.deepEqual(c, { all: 4, up: 1, down: 1, init: 1, ptUp: 1, ptDown: 1 });
  assert.deepEqual(ar.filterFeed(feed, "ptUp").map((r) => r.t), ["BBB"]);
  assert.deepEqual(ar.filterFeed(feed, "all", new Set(["CCC"])).map((r) => r.t), ["CCC"]);
  assert.equal(ar.gradeText(feed[2]), "Overweight");
  assert.equal(ar.gradeText(feed[1]), "OW");
  assert.equal(ar.fmtPct(feed[0].ptChg), "-10.8%");
});

// ----- 배당 성장 -----
const DG = { lastYear: 2025, cols: dg.COLS, tickers: {
  KO: [39, 41, 4.46, 4.45, 2.04, 1985, true, true, null, 0],
  MMM: [0, 41, -9.9, -1.59, 2.92, 1985, false, true, 2025, 1],
  AAPL: [13, 14, 4.99, 7.33, 1.03, 2012, false, false, null, 0],
} };

test("배당 성장 기록·표기", () => {
  const ko = dg.record(DG, "KO");
  assert.equal(dg.streakText(ko), "39년+");
  assert.equal(dg.paidText(ko), "41년+");
  assert.equal(dg.subText(ko), "2025년까지 · 5년 연평균 +4.5% · 기록 시작 1985");
  const mmm = dg.record(DG, "MMM");
  assert.equal(dg.streakText(mmm), "0년");
  assert.equal(dg.cagrText(mmm.cagr5), "-9.9%");
  assert.ok(dg.subText(mmm).endsWith("최근 감액 2025"));
  assert.equal(dg.streakText(dg.record(DG, "AAPL")), "13년");
  assert.equal(dg.record(DG, "NONE"), null);
  assert.equal(dg.sortValue(null), -1);
  assert.equal(dg.sortValue(ko), 39);
});

// ----- 스크리너 필드(ratingIndex · screenMetrics) -----
test("스크리너 필드: 30일 창·상향/하향 수·목표가 중앙값·결측은 null", () => {
  const EST = {
    cols: ["period", "end", "cur", "d7", "d30", "d60", "d90", "up7", "up30", "dn7", "dn30", "n"],
    tickers: {
      AAA: { p: [["0q", "2026-12-31", 1, 1, 1, 1, 1, 0, 0, 0, 0, 9], ["0y", "2026-12-31", 5.5, 5.4, 5.0, 4.9, 4.4, 1, 4, 0, 1, 20]] },
      BBB: { p: [["0y", "2026-12-31", 0.5, 0.5, 0.02, 0.02, 0.02, 0, 0, 0, 0, 3]] },
    },
  };
  const RAT = {
    asOf: "2026-10-21", windowDays: 30,
    cols: ["t", "d", "firm", "act", "from", "to", "pt", "ptPrev", "ptAct"],
    rows: [
      ["AAA", "2026-10-20", "F1", "up", "Hold", "Buy", 120, 100, "Raises"],
      ["AAA", "2026-10-10", "F2", "up", "Sell", "Hold", 90, 100, "Lowers"],
      ["AAA", "2026-10-01", "F3", "main", "Buy", "Buy", 130, 100, "Raises"],
      ["AAA", "2026-09-01", "F4", "up", "Hold", "Buy", 200, 100, "Raises"],   // 30일 창 밖
      ["CCC", "2026-10-15", "F5", "down", "Buy", "Hold", null, null, ""],
    ],
  };
  const idx = ar.ratingIndex(RAT);
  const a = ar.screenMetrics(EST, idx, "AAA");
  assert.equal(Math.round(a.epsRev30 * 100) / 100, 10);           // 5.5 / 5.0 − 1
  assert.equal(Math.round(a.epsRev90 * 100) / 100, 25);
  assert.equal(a.epsUp30, 4);
  assert.equal(a.epsDown30, 1);
  assert.equal(a.ratingUp30, 2);                                    // 창 밖 1건 제외
  assert.equal(a.ratingDown30, 0);
  assert.equal(a.targetChg30, 20);                                  // [+20, −10, +30] 중앙값
  const b = ar.screenMetrics(EST, idx, "BBB");
  assert.equal(b.epsRev30, null, "기준 |0.05| 미만은 비율 없음");
  assert.equal(b.ratingUp30, 0, "수집 대상인데 의견 변경이 없으면 0");
  assert.equal(b.targetChg30, null);
  const c = ar.screenMetrics(EST, idx, "CCC");
  assert.equal(c.epsRev30, null);
  assert.equal(c.ratingDown30, 1);
  assert.equal(c.targetChg30, null, "목표가 없는 행은 중앙값에서 뺀다");
  const z = ar.screenMetrics(EST, idx, "ZZZ");
  Object.values(z).forEach((v) => assert.equal(v, null, "수집 밖 종목은 전부 null(0 아님)"));
  const noRat = ar.screenMetrics(EST, null, "AAA");
  assert.equal(noRat.ratingUp30, null, "의견 파일이 없으면 0 이 아니라 null");
});

test("국내 우선주 배당 기록은 보통주 티커로", () => {
  const P = { lastYear: 2025, cols: ["up", "paid", "cagr5", "cagr10", "last", "since", "capped", "paidCapped", "lastCut", "specials"],
    tickers: {}, pref: { "005930": { t: "005935", name: "삼성전자우", v: [2, 12, -11.04, 14.77, 1669, 2014, false, true, 2021, 0] } } };
  const r = dg.prefRecord(P, "005930");
  assert.equal(r.ticker, "005935");
  assert.equal(r.name, "삼성전자우");
  assert.equal(r.last, 1669);
  assert.equal(r.lastYear, 2025);
  assert.equal(dg.paidText(r), "12년+");
  assert.equal(dg.prefRecord(P, "000660"), null);
  assert.equal(dg.prefRecord({ tickers: {} }, "005930"), null);
});

if (failures.length) {
  console.error(`new-data-cores: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
console.log(`new-data-cores: ${passed} passed`);
