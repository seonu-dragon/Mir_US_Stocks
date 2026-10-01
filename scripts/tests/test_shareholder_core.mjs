// 주주환원(배당·자사주) 순수 계산(shareholder-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_shareholder_core.mjs   (CI 의 "Market-cap overlay / shareholder core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const sh = require("../../shareholder-core.js");
const mc = require("../../mcap-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const near = (a, b, eps, msg) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);
const day = sh.dayNum;

// KO 배당 기록(분기, 2021-11 ~ 2026-09) — data/details/KO.json 에서 옮김.
const KO_DIVS = [
  ["2021-11-30", 0.42], ["2022-03-14", 0.44], ["2022-06-14", 0.44], ["2022-09-14", 0.44], ["2022-11-30", 0.44],
  ["2023-03-14", 0.46], ["2023-06-14", 0.46], ["2023-09-14", 0.46], ["2023-11-30", 0.46],
  ["2024-03-14", 0.485], ["2024-06-14", 0.485], ["2024-09-13", 0.485], ["2024-11-29", 0.485],
  ["2025-03-14", 0.51], ["2025-06-13", 0.51], ["2025-09-15", 0.51], ["2025-12-01", 0.51],
  ["2026-03-13", 0.53], ["2026-06-15", 0.53], ["2026-09-15", 0.53],
];

test("배당 주기: 간격 중앙값으로 월·분기·반기·연·비정기", () => {
  const t = day("2026-09-30");
  assert.equal(sh.frequency(sh.cleanDividends(KO_DIVS), t).label, "분기배당");
  const monthly = Array.from({ length: 24 }, (_, i) => [new Date(Date.UTC(2024, 9 + i, 15)).toISOString().slice(0, 10), 0.25]);
  assert.equal(sh.frequency(sh.cleanDividends(monthly), t).key, "monthly");
  assert.equal(sh.frequency(sh.cleanDividends([["2025-04-10", 100], ["2026-04-10", 120]]), t).key, "annual");
  assert.equal(sh.frequency(sh.cleanDividends([["2023-04-10", 100]]), t).key, "none");
});

test("최근 1년 합: 오늘 − 365일 초과 ~ 오늘", () => {
  const tr = sh.trailingSum(sh.cleanDividends(KO_DIVS), day("2026-09-30"));
  assert.equal(tr.count, 4);
  near(tr.sum, 0.51 + 0.53 * 3, 1e-9);
});

test("달력 연도: 기록 시작 해(9월 시작)는 빼고, 올해는 partial, 배당 없는 해는 count 0", () => {
  const ys = sh.calendarYears(sh.cleanDividends([["2021-12-29", 361], ["2022-03-30", 361], ["2024-03-28", 361]]), day("2021-09-13"), day("2026-09-30"));
  assert.deepEqual(ys.map((y) => y.label), ["2022", "2023", "2024", "2025", "2026"]);
  assert.equal(ys[0].dps, 361);
  assert.equal(ys[1].count, 0);
  assert.equal(ys[4].partial, true);
  // 1월 초 시작이면 그 해부터
  assert.equal(sh.calendarYears([], day("2022-01-03"), day("2023-06-01"))[0].label, "2022");
});

test("회계연도 창(미국): (직전 결산일, 결산일] 합, 창 시작이 기록 전이면 제외, 결산 뒤는 진행 중 막대", () => {
  const divs = sh.cleanDividends([["2021-12-01", 0.004], ["2022-03-02", 0.004], ["2022-06-08", 0.004], ["2022-09-07", 0.004], ["2022-11-30", 0.004],
    ["2023-03-07", 0.004], ["2026-03-11", 0.01], ["2026-06-04", 0.25]]);
  const rows = [{ fy: 2022, end: "2022-01-30" }, { fy: 2023, end: "2023-01-29" }, { fy: 2024, end: "2024-01-28" }];
  const ys = sh.fiscalYears(divs, rows, day("2021-09-22"), day("2026-09-30"));
  assert.deepEqual(ys.map((y) => y.label), ["FY2023", "FY2024", "FY2025"]);
  near(ys[0].dps, 0.016, 1e-9);      // 2022-01-31 ~ 2023-01-29: 4회
  assert.equal(ys[0].count, 4);
  assert.equal(ys[2].partial, true);  // 2024-01-28 이후 ~ 오늘
});

test("EPS 환산·배당성향: 순이익 ÷ 분할 환산 희석 주식수, 적자면 '적자'", () => {
  const norm = [{ day: day("2025-12-31"), kind: "dil", n: 4.313e9 }, { day: day("2025-12-31"), kind: "out", n: 4.30e9 }];
  const e = sh.epsAdjusted({ net: 13.1e9, end: "2025-12-31" }, norm);
  assert.equal(e.basis, "dil");
  near(e.eps, 13.1e9 / 4.313e9, 1e-9);
  const p = sh.payout(2.04, e.eps);
  near(p.ratio, 2.04 / e.eps, 1e-9);
  assert.deepEqual(sh.payout(1, -0.5), { ratio: null, deficit: true });
  assert.deepEqual(sh.payout(1, 0), { ratio: null, deficit: true });
  assert.equal(sh.payout(1, null), null);
  assert.equal(sh.epsAdjusted({ net: 1, end: "2025-12-31" }, []), null);
});

test("주식수 변화: 같은 종류(희석 평균 우선)로 1년·3년", () => {
  const ends = ["2022-12-31", "2023-12-31", "2024-12-31", "2025-12-31"];
  const norm = ends.map((e, i) => ({ day: day(e), kind: "dil", n: 100 - i * 2 }));
  const c = sh.shareChange(norm, ends);
  assert.equal(c.basis, "dil");
  near(c.y1Pct, 94 / 96 - 1, 1e-9);
  near(c.y3Pct, 94 / 100 - 1, 1e-9);
  assert.equal(c.lastEnd, "2025-12-31");
  assert.equal(sh.shareChange([{ day: day("2025-12-31"), kind: "out", n: 5 }], ends), null);
});

test("국내 자기주식 공시: 분류·금액(KR_EVENT_DETAILS 접수번호)·합계", () => {
  const disc = [
    { ticker: "005930", title: "주요사항보고서(자기주식취득결정)", fileDate: "2026-09-29", link: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260929000001" },
    { ticker: "005930", title: "주요사항보고서(자기주식소각결정)", fileDate: "2026-09-30", link: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260930000002" },
    { ticker: "005930", title: "기업설명회(IR)개최", fileDate: "2026-09-30", link: "" },
    { ticker: "000660", title: "주요사항보고서(자기주식취득결정)", fileDate: "2026-09-30", link: "" },
  ];
  const det = { "20260929000001": { amount: 3e12, shares: 1e7 } };
  const r = sh.krRecentBuybacks("005930", disc, det);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].label, "소각");          // 최신순
  assert.equal(r.totals.acquire.amount, 3e12);
  assert.equal(r.totals.cancel.amountKnown, 0);
  assert.equal(sh.krBuybackCategory("자기주식취득신탁계약해지결정").key, "trustEnd");
  assert.equal(sh.krBuybackCategory("현금배당결정"), null);
});

test("이벤트 기록(종목 샤드) → 자사주 공시 연도별 건수, 배당 결정은 제외", () => {
  const base = day("2000-01-01");
  const d0 = (iso) => day(iso) - base;
  const rows = [["kr_buyback", d0("2024-03-10"), 1], ["kr_cancel", d0("2024-05-01"), 2], ["kr_buyback", d0("2025-02-01"), 3], ["kr_dividend", d0("2025-02-01"), 4]];
  const h = sh.buybackHistory(rows, "2000-01-01");
  assert.equal(h.total, 3);
  assert.deepEqual(h.years.map((y) => y.year), ["2024", "2025"]);
  assert.equal(h.years[0].counts.kr_cancel, 1);
  assert.equal(h.first, "2024-03-10");
  assert.equal(sh.buybackHistory([["kr_dividend", 9000]], "2000-01-01"), null);
});

test("배당 기록이 없는 해 중 DART 배당 결정 공시가 있는 해(누락 가능 각주)", () => {
  const base = day("2000-01-01");
  const rows = [["kr_dividend", day("2024-02-20") - base], ["kr_dividend", day("2025-02-20") - base]];
  const years = [{ label: "2024", year: 2024, count: 0 }, { label: "2025", year: 2025, count: 1 }, { label: "2026", year: 2026, count: 0, partial: true }];
  assert.deepEqual(sh.missingDividendYears(years, rows, "2000-01-01"), ["2024"]);
});

test("미국 8-K 자사주: 그 종목만, 금액 확정(kind buyback)과 언급만 구분", () => {
  const ev = [
    { ticker: "AAPL", kind: "buyback", amountUsd: 1e11, fileDate: "2026-05-01", link: "x" },
    { ticker: "AAPL", buybackMention: true, fileDate: "2026-08-01" },
    { ticker: "MSFT", kind: "buyback", amountUsd: 6e10, fileDate: "2026-09-01" },
  ];
  const r = sh.usBuybackAnnouncements("aapl", ev);
  assert.equal(r.length, 2);
  assert.equal(r[0].date, "2026-08-01");
  assert.equal(r[0].confirmed, false);
  assert.equal(r[1].amount, 1e11);
});

test("summarize(US): 소스 배당수익률 우선, 회계연도 배당성향, TTM 배당성향", () => {
  const annualRows = [
    { fy: 2023, end: "2023-12-31", net: 10.7e9 }, { fy: 2024, end: "2024-12-31", net: 10.6e9 }, { fy: 2025, end: "2025-12-31", net: 13.1e9 },
  ];
  const norm = annualRows.map((r) => ({ day: day(r.end), kind: "dil", n: 4.3e9 }));
  const s = sh.summarize({
    market: "us", dividends: KO_DIVS, chartStart: "2021-09-27", today: "2026-09-30",
    annualRows, ttm: { basis: "4Q", net: 13.9e9 }, norm, price: 86.08, mapFund: { divYield: 2.44, divSrc: "ttm" },
  });
  assert.equal(s.fiscal, true);
  assert.equal(s.yieldPct, 2.44);
  assert.match(s.yieldSrc, /최근 1년/);
  assert.deepEqual(s.years.map((y) => y.label), ["FY2023", "FY2024", "FY2025", "FY2026"]);
  near(s.years[2].dps, 2.04, 1e-9);
  near(s.years[2].payout, 2.04 / (13.1e9 / 4.3e9), 1e-9);
  assert.equal(s.years[3].partial, true);
  assert.equal(s.ttmPayout.basis, "ttm");
  near(s.ttmPayout.ratio, 2.1 / (13.9e9 / 4.3e9), 1e-9);
  assert.equal(s.hasDividends, true);
});

test("summarize(KR): 달력 연도, 배당성향은 소스(%) — EPS 적자면 '적자', 소스 수익률 없으면 계산", () => {
  const s = sh.summarize({
    market: "kr", dividends: [["2025-12-29", 566], ["2026-03-30", 372]], chartStart: "2021-09-13", today: "2026-09-30",
    price: 269500, mapFund: { payoutRatio: 21.891, eps: 22292 },
  });
  assert.equal(s.fiscal, false);
  near(s.ttmPayout.ratio, 0.21891, 1e-9);
  near(s.yieldPct, (566 + 372) / 269500 * 100, 1e-9);
  assert.equal(s.yieldSrc, "최근 1년 배당 ÷ 현재가");
  const loss = sh.summarize({ market: "kr", dividends: [], today: "2026-09-30", mapFund: { payoutRatio: 0, eps: -100 } });
  assert.equal(loss.ttmPayout.deficit, true);
  // 배당을 했는데 소스 배당성향이 0 이면 결측으로(000500: 주당 100원 배당, 네이버 payoutRatio 0)
  const zero = sh.summarize({ market: "kr", dividends: [["2026-02-26", 55.6]], today: "2026-09-30", mapFund: { payoutRatio: 0, dps: 100, eps: 2159 } });
  assert.equal(zero.ttmPayout, null);
  assert.equal(loss.hasDividends, false);
});

test("mcap-core 와 이어서: NVDA 분할 전 행의 EPS 가 현재 기준으로 맞는다", () => {
  const file = { annual: [
    { fy: 2023, end: "2023-01-29", sharesOut: 2466000000, sharesDilAvg: 25070000000, net: 4368000000 },
    { fy: 2024, end: "2024-01-28", sharesOut: 24643000000, sharesDilAvg: 24940000000, net: 29760000000 },
  ] };
  const ns = mc.normalizedFor({ file, chartSeries: [[1, 1, 1, 20, 1, "2022-06-01"]], anchor: 24.1e9 });
  const e = sh.epsAdjusted(file.annual[0], ns.norm);
  near(e.eps, 4368000000 / 25070000000, 1e-9);   // ≈ $0.174 (분할 후 기준)
});

if (failures.length) {
  console.error(`shareholder-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`shareholder-core: ${passed}개 통과`);
