// 종목 시세정보·투자정보 순수 계산(quote-info-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_quote_info_core.mjs   (CI 의 "Quote info core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
globalThis.MirFundSanity = require("../../fundamentals-sanity-core.js");
const core = require("../../quote-info-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

function bars(n, f) {
  const out = [];
  const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i < n; i++) {
    const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
    const c = f(i);
    out.push([c, c + 1, c - 1, c, 1000 + i, d]);
  }
  return out;
}

test("숫자 표기: 원화 큰 금액", () => {
  assert.equal(core.fmtKrwLarge(1674958800000000), "1,674조 9,588억");
  assert.equal(core.fmtKrwLarge(5504265000000), "5조 5,043억");
  assert.equal(core.fmtKrwLarge(2275377000000), "2조 2,754억");
  assert.equal(core.fmtKrwLarge(123456789), "1억");
  assert.equal(core.fmtKrwLarge(98765000), "9,877만");
  assert.equal(core.fmtKrwLarge(null), "—");
  // 9,999.6억 → 반올림 올림이 조 단위로 넘어간다
  assert.equal(core.fmtKrwLarge(1_999_996_000_000), "2조");
});

test("숫자 표기: 원화 병기", () => {
  assert.equal(core.fmtKrwApprox(306000), "≈ 30만 6,000원");
  assert.equal(core.fmtKrwApprox(300000), "≈ 30만원");
  assert.equal(core.fmtKrwApprox(9500), "≈ 9,500원");
  assert.equal(core.fmtKrwApprox(123456789012), "≈ 1,234억 5,679만원");
  assert.equal(core.fmtKrwApprox(6904123400000000), "≈ 6,904조 1,234억원");
  assert.equal(core.fmtKrwApprox(0), "");
});

test("숫자 표기: 달러·주·날짜", () => {
  assert.equal(core.fmtUsdLarge(4977637000000), "$4.98T");
  assert.equal(core.fmtUsdLarge(10232000000), "$10.23B");
  assert.equal(core.fmtUsdLarge(45600000), "$45.6M");
  assert.equal(core.fmtUsdLarge(12345), "$12,345");
  assert.equal(core.fmtShares(19385053), "19,385,053주");
  assert.equal(core.fmtDate("2026-09-23"), "2026.09.23");
  assert.equal(core.fmtDate(""), "");
});

test("52주: 최근 252봉만, 고가·저가 날짜", () => {
  // 앞 100봉은 고점 500(범위 밖), 뒤 252봉은 100~150.
  const s = bars(352, (i) => (i < 100 ? 500 : 100 + ((i * 7) % 51)));
  const r = core.week52Range(s, { price: 120 });
  assert.equal(r.bars, 252);
  assert.equal(r.high, 151);          // 150 + 1(고가)
  assert.equal(r.low, 99);            // 100 - 1(저가)
  assert.ok(r.highDate > s[99][5]);   // 범위 밖 날짜가 아니다
  assert.ok(Math.abs(r.pos - (120 - 99) / (151 - 99) * 100) < 1e-9);
});

test("52주: 현재가가 신고가면 기준일이 최고 날짜", () => {
  const s = bars(60, () => 100);
  const r = core.week52Range(s, { price: 130, priceDate: "2026-09-25" });
  assert.equal(r.high, 130);
  assert.equal(r.highDate, "2026-09-25");
  assert.equal(r.pos, 100);
});

test("52주: 종가 기준이면 고가·저가 대신 종가", () => {
  const s = bars(60, (i) => 100 + (i === 30 ? 20 : 0));
  const r = core.week52Range(s, { price: 100, basis: "close" });
  assert.equal(r.high, 120);
  assert.equal(r.low, 100);
  assert.equal(r.highDate, s[30][5]);
  assert.equal(r.basis, "close");
  assert.equal(core.week52Range(s, { price: 100 }).high, 121);
});

test("52주: 봉이 부족하면 null", () => {
  assert.equal(core.week52Range(bars(10, () => 1), { price: 1 }), null);
  assert.equal(core.week52Range(null, {}), null);
});

test("세션 봉: 기준일 봉이 있으면 시가·고가·저가·전일", () => {
  const s = bars(5, (i) => 100 + i);
  const b = core.sessionBar(s, s[4][5]);
  assert.equal(b.open, 104);
  assert.equal(b.high, 105);
  assert.equal(b.low, 103);
  assert.equal(b.prevClose, 103);
  assert.equal(b.barMissing, false);
});

test("세션 봉: 기준일 봉이 빠졌으면 전일 종가만", () => {
  const s = bars(5, (i) => 100 + i);
  const b = core.sessionBar(s, "2099-01-01");
  assert.equal(b.open, null);
  assert.equal(b.prevClose, 104);
  assert.equal(b.barMissing, true);
});

test("최근 1년 배당 합", () => {
  const d = [["2025-02-01", 0.24], ["2025-11-10", 0.26], ["2026-02-09", 0.26], ["2026-05-11", 0.26], ["2026-08-11", 0.26]];
  const r = core.trailingDividend(d, "2026-09-25");
  assert.equal(r.count, 4);
  assert.ok(Math.abs(r.amount - 1.04) < 1e-9);
  assert.equal(core.trailingDividend([], "2026-09-25"), null);
});

test("ETF 괴리율", () => {
  assert.ok(Math.abs(core.navPremiumPct(113145, 113214) - (-0.0609473)) < 1e-4);
  assert.equal(core.navPremiumPct(100, 0), null);
});

test("액면분할 목록: 최신순·분할/병합 구분", () => {
  const ev = core.splitEvents([["2021-07-20", 4, 1], ["2024-06-10", 10, 1], ["2023-01-05", 1, 10], ["bad", 2, 1]]);
  assert.deepEqual(ev.map((e) => `${e.date} ${e.ratio} ${e.kind}`), ["2024-06-10 10:1 분할", "2023-01-05 1:10 병합", "2021-07-20 4:1 분할"]);
});

const AAPL_LIKE = {
  currency: "USD", flags: [], industryType: "general",
  ttm: { basis: "4Q", fy: 2026, fq: 3, quarters: ["2025Q4", "2026Q1", "2026Q2", "2026Q3"], rev: 400, op: 120, net: 100, ocf: 110,
    equity: 50, assets: 300, liab: 250, sharesOut: 10 },
  annual: [],
};

test("TTM 비율: 기본 계산", () => {
  const r = core.ttmRatios(AAPL_LIKE, { marketCap: 4000, priceCurrency: "USD" });
  assert.equal(r.values.psr, 10);
  assert.equal(r.values.per, 40);
  assert.equal(r.values.pbr, 80);
  assert.ok(Math.abs(r.values.pcfr - 4000 / 110) < 1e-9);
  assert.equal(r.values.sps, 40);
  assert.equal(r.values.bps, 5);
  assert.equal(r.values.eps, 10);
  assert.equal(r.values.opMargin, 30);
  assert.equal(r.values.netMargin, 25);
  assert.equal(r.values.roe, 200);
  assert.ok(Math.abs(r.values.roa - 100 / 3) < 1e-9);
  assert.equal(r.values.debtRatio, 500);
  assert.match(r.label, /2026Q3/);
  assert.deepEqual(r.outliers, []);
});

test("TTM 비율: 적자면 PER·PCFR 결측, 자본잠식이면 ROE·부채비율 결측", () => {
  const f = { ...AAPL_LIKE, ttm: { ...AAPL_LIKE.ttm, net: -10, ocf: -5, equity: -20 } };
  const r = core.ttmRatios(f, { marketCap: 4000, priceCurrency: "USD" });
  assert.equal(r.values.per, undefined);
  assert.equal(r.values.pcfr, undefined);
  assert.equal(r.values.pbr, undefined);
  assert.equal(r.values.roe, undefined);
  assert.equal(r.values.debtRatio, undefined);
  assert.equal(r.values.netMargin, -2.5);
});

test("TTM 비율: 통화가 다르면 가격 배수 없음(마진은 남김)", () => {
  const f = { ...AAPL_LIKE, currency: "EUR" };
  const r = core.ttmRatios(f, { marketCap: 4000, priceCurrency: "USD" });
  assert.equal(r.priceMultiples, false);
  assert.equal(r.values.psr, undefined);
  assert.equal(r.values.bps, undefined);
  assert.equal(r.values.opMargin, 30);
  assert.equal(r.notes.length, 1);
});

test("TTM 비율: 금융업은 PCFR·영업이익률·부채비율 제외", () => {
  const f = { ...AAPL_LIKE, industryType: "bank", flags: ["financial"] };
  const r = core.ttmRatios(f, { marketCap: 4000, priceCurrency: "USD" });
  assert.equal(r.values.pcfr, undefined);
  assert.equal(r.values.opMargin, undefined);
  assert.equal(r.values.debtRatio, undefined);
  assert.equal(r.values.per, 40);
});

test("TTM 비율: 이상치 경계 밖은 값은 두고 표시", () => {
  const f = { ...AAPL_LIKE, ttm: { ...AAPL_LIKE.ttm, net: 1 } };
  const r = core.ttmRatios(f, { marketCap: 4000, priceCurrency: "USD" });
  assert.equal(r.values.per, 4000);
  assert.ok(r.outliers.includes("per"));
});

test("TTM 비율: ttm 없으면 null", () => {
  assert.equal(core.ttmRatios({ ttm: null }, {}), null);
});

test("동일업종 중앙값: 업종 표본 부족하면 섹터, PER 은 양수·이상치 제외", () => {
  const rows = [
    { ticker: "A", sector: "기술", industry: "반도체", changePct: 1, pe: 10 },
    { ticker: "B", sector: "기술", industry: "반도체", changePct: 3, pe: 20 },
    { ticker: "C", sector: "기술", industry: "소프트웨어", changePct: -1, pe: -5 },
    { ticker: "D", sector: "기술", industry: "소프트웨어", changePct: 2, pe: 30 },
    { ticker: "E", sector: "기술", industry: "하드웨어", changePct: 0, pe: 5000 },
    { ticker: "F", sector: "기술", industry: "하드웨어", changePct: 4, pe: 40 },
    { ticker: "G", sector: "기술", industry: "하드웨어", changePct: 5, pe: 50 },
    { ticker: "H", sector: "기술", industry: "하드웨어", changePct: 6, pe: 60 },
    { ticker: "Z", sector: "기술", industry: "하드웨어", changePct: 9, pe: 1, etf: true },
  ];
  const r = core.peerMedians(rows, { sector: "기술", industry: "반도체" });
  assert.equal(r.level, "sector");
  assert.equal(r.count, 8);
  assert.equal(r.peCount, 6);            // -5·5000 제외
  assert.equal(r.peMedian, 35);          // 10,20,30,40,50,60
  assert.equal(r.changeMedian, 2.5);     // -1,0,1,2,3,4,5,6
  const hw = core.peerMedians(rows, { sector: "기술", industry: "하드웨어" }, { minPeers: 4 });
  assert.equal(hw.level, "industry");
  assert.equal(hw.peMedian, null);       // 40,50,60 — 5000 제외 후 표본 3 < 4 라 PER 중앙값은 내지 않는다
  assert.equal(hw.changeMedian, 4.5);
});

test("동일업종 중앙값: PER 표본이 최소 미만이면 PER 은 null", () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ ticker: `T${i}`, sector: "S", industry: "I", changePct: i, pe: i < 2 ? 10 : null }));
  const r = core.peerMedians(rows, { sector: "S", industry: "I" });
  assert.equal(r.peMedian, null);
  assert.equal(r.changeMedian, 2.5);
  assert.equal(core.peerMedians(rows.slice(0, 3), { sector: "S", industry: "I" }), null);
});

if (failures.length) {
  console.error(`quote-info-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`quote-info-core: ${passed}개 통과`);
