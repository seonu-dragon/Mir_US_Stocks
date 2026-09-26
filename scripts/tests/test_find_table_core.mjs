// 찾기 표 열 설정 순수 로직(find-table-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_find_table_core.mjs   (CI 의 "Find table core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../find-table-core.js");

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

test("시장별 열: 거래량·거래대금·외국인 비율은 국내 전용", () => {
  const us = core.availableColumns("us").map((c) => c.key);
  const kr = core.availableColumns("kr").map((c) => c.key);
  for (const k of ["volume", "amount", "foreignPct"]) {
    assert.ok(!us.includes(k), `US 에 ${k} 가 있으면 안 됨`);
    assert.ok(kr.includes(k), `KR 에 ${k} 가 있어야 함`);
  }
  assert.ok(us.includes("pe") && us.includes("roe") && us.includes("divYield"));
});

test("기본 열은 그 시장에서 쓸 수 있는 열만", () => {
  for (const m of ["us", "kr"]) {
    const ok = new Set(core.availableColumns(m).map((c) => c.key));
    core.defaultColumns(m).forEach((k) => assert.ok(ok.has(k), `${m}:${k}`));
  }
});

test("저장값 정리: 모르는 키·다른 시장 전용 키·중복 제거, 순서 유지", () => {
  assert.deepEqual(core.sanitizeColumns(["pe", "zzz", "volume", "pe", "price"], "us"), ["pe", "price"]);
  assert.deepEqual(core.sanitizeColumns(["foreignPct", "price"], "kr"), ["foreignPct", "price"]);
});

test("저장값이 없거나 전부 무효면 기본값", () => {
  assert.deepEqual(core.sanitizeColumns(null, "us"), core.defaultColumns("us"));
  assert.deepEqual(core.sanitizeColumns(["volume"], "us"), core.defaultColumns("us"));
  assert.deepEqual(core.sanitizeColumns("price", "kr"), core.defaultColumns("kr"));
});

test("parseSaved: 깨진 JSON·배열 아님 → null", () => {
  assert.equal(core.parseSaved("{bad"), null);
  assert.equal(core.parseSaved('{"a":1}'), null);
  assert.equal(core.parseSaved(""), null);
  assert.deepEqual(core.parseSaved('["pe"]'), ["pe"]);
});

test("toggle: 켜면 끝에, 끄면 빠짐, 마지막 한 열은 유지, 없는 열은 무시", () => {
  assert.deepEqual(core.toggleColumn(["price"], "roe", true, "us"), ["price", "roe"]);
  assert.deepEqual(core.toggleColumn(["price", "roe"], "price", false, "us"), ["roe"]);
  assert.deepEqual(core.toggleColumn(["roe"], "roe", false, "us"), ["roe"]);
  assert.deepEqual(core.toggleColumn(["price"], "amount", true, "us"), ["price"]);
  assert.deepEqual(core.toggleColumn(["price", "roe"], "roe", true, "us"), ["price", "roe"]);
});

test("move: 앞뒤로 한 칸, 범위 밖은 그대로", () => {
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(core.moveColumn(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.deepEqual(core.moveColumn(["a"], "x", 1), ["a"]);
});

test("정렬 가능한 열의 metric 은 #topMetric 옵션 값", () => {
  const options = ["changePct", "weekChangePct", "monthChangePct", "threeMonthChangePct", "ytdChangePct", "rsi14", "epsTtm", "stochK",
    "volumeRatio", "volume", "amount", "marketCapB", "pe", "forwardPE", "ps", "pb", "newHighDistancePct", "low52Dist"];
  core.COLUMNS.filter((c) => c.metric).forEach((c) => assert.ok(options.includes(c.metric), `${c.key}→${c.metric}`));
});

// ===== 목록: 배당 랭킹 · 신규상장 · 관리/경보 =====
const sanity = require("../../fundamentals-sanity-core.js");

test("배당 정보: 적자면 배당성향 제외, 0 이하 수익률은 배당 없음", () => {
  const a = core.dividendInfo({ epsTtm: -1 }, { divYield: 3.2, payoutRatio: 80, dps: 500 });
  assert.equal(a.divYield, 3.2);
  assert.equal(a.payoutRatio, null);
  assert.equal(a.deficit, true);
  assert.equal(a.dps, 500);
  const b = core.dividendInfo({}, { divYield: 0 });
  assert.equal(b.divYield, null);
  // 미국 보조 소스(US_STOCK_CALENDAR): fund 에 없으면 cal 의 divRate·payout 을 쓴다.
  // 현재가가 있으면 주당배당금 ÷ 현재가가 fund.divYield(Finnhub 등)보다 먼저 — 같은 줄 두 값이 맞게.
  const m = core.dividendInfo({ epsTtm: 5.55, price: 68.82 }, { divYield: 9.45 }, { divYield: 6.4, divRate: 4.44, payout: 89.3 });
  assert.equal(m.divYield, 6.45);
  const m2 = core.dividendInfo({ price: 25 }, { divYield: 6.85 }, { divYield: 4.36 });
  assert.equal(m2.divYield, 4.36);
  const c = core.dividendInfo({ epsTtm: 8.6 }, { divYield: 0.32 }, { divRate: 1.08, payout: 12 });
  assert.deepEqual([c.divYield, c.dps, c.payoutRatio, c.deficit], [0.32, 1.08, 12, false]);
  // 빌더가 기준(divSrc)을 붙인 값은 그대로 쓴다 — 히트맵·수식 스크리너와 같은 숫자(T: 1.112/25.38).
  const t = core.dividendInfo({ price: 25.5 }, { divYield: 4.38, dps: 1.112, divSrc: "ttm" }, { divYield: 4.36, divRate: 1.11 });
  assert.deepEqual([t.divYield, t.dps, t.divSrc], [4.38, 1.112, "ttm"]);
  assert.equal(m.divSrc, null);
});

test("배당 랭킹: 수익률 내림차순, 이상치(30% 초과)는 뒤로, ETF·무배당 제외", () => {
  const items = [
    { ticker: "A", sector: "기술", marketCapB: 10 },
    { ticker: "B", sector: "금융", marketCapB: 5 },
    { ticker: "C", sector: "ETF", marketCapB: 50 },
    { ticker: "D", sector: "소재", marketCapB: 1 },
    { ticker: "E", sector: "소재", marketCapB: 1 },
  ];
  const fund = { A: { divYield: 2 }, B: { divYield: 6 }, C: { divYield: 9 }, D: { divYield: 45 }, E: {} };
  const rows = core.dividendRanking(items, { fundFor: (i) => fund[i.ticker], sanity });
  assert.deepEqual(rows.map((r) => r.item.ticker), ["B", "A", "D"]);
  assert.equal(rows[2].outlier, true);
  assert.equal(rows[0].outlier, false);
  // sanity 없이도 같은 순서
  assert.deepEqual(core.dividendRanking(items, { fundFor: (i) => fund[i.ticker] }).map((r) => r.item.ticker), ["B", "A", "D"]);
  assert.equal(core.dividendRanking(items, { fundFor: (i) => fund[i.ticker], limit: 1 }).length, 1);
});

test("날짜 정리·일수", () => {
  assert.equal(core.isoDate("2026.09.23"), "2026-09-23");
  assert.equal(core.isoDate("2026-9-3"), "2026-09-03");
  assert.equal(core.isoDate(""), null);
  assert.equal(core.daysBetween("2026-09-20", "2026-09-26"), 6);
});

test("신규상장(국내): 회사명으로 스냅샷과 맞추고 공모가 대비 계산", () => {
  const ipo = { ipos: [
    { company: "스카이랩스", ticker: null, stage: "priced", fileDate: "2026.09.04", offerPrice: 10000, form: "한국투자증권" },
    { company: "(주)새회사", ticker: null, stage: "priced", fileDate: "2026.09.20", offerPrice: 5000 },
    { company: "청약예정", ticker: null, stage: "filed", fileDate: "2026.10.10" },
    { company: "오래전", ticker: null, stage: "priced", fileDate: "2026.01.10", offerPrice: 1000 },
  ] };
  const stocks = [{ ticker: "386380", company: "스카이랩스", price: 23050 }];
  const rows = core.recentListings("kr", ipo, stocks, "2026-09-26", { days: 90 });
  assert.deepEqual(rows.map((r) => r.company), ["(주)새회사", "스카이랩스"]);
  assert.equal(rows[1].ticker, "386380");
  assert.equal(Math.round(rows[1].retPct * 10) / 10, 130.5);
  assert.equal(rows[1].broker, "한국투자증권");
  assert.equal(rows[0].item, null);
  assert.equal(rows[0].retPct, null);
});

test("신규상장(미국): 424B4 중 S-1/F-1 등록 기록이 있는 것만, 유닛가·10배 차이는 비교 안 함", () => {
  const L = (cik) => `https://www.sec.gov/Archives/edgar/data/${cik}/x.htm`;
  const ipo = { ipos: [
    { company: "Real IPO", ticker: "RIPO", stage: "priced", form: "424B4", fileDate: "2026-09-18", offerPrice: 15, link: L(1) },
    { company: "Real IPO", ticker: "RIPO", stage: "amended", form: "S-1/A", fileDate: "2026-09-14", link: L(1) },
    { company: "Follow On", ticker: "FOLO", stage: "priced", form: "424B4", fileDate: "2026-09-20", offerPrice: 5, link: L(2) },
    { company: "Spac", ticker: "SPAC", stage: "priced", form: "424B4", fileDate: "2026-09-19", offerPrice: 10, offerPriceKind: "unit", link: L(3) },
    { company: "Spac", ticker: "SPAC", stage: "filed", form: "S-1", fileDate: "2026-09-01", link: L(3) },
    { company: "Split", ticker: "SPLT", stage: "priced", form: "424B4", fileDate: "2026-09-03", offerPrice: 428.4, link: L(4) },
    { company: "Split", ticker: "SPLT", stage: "filed", form: "S-1", fileDate: "2026-08-21", link: L(4) },
  ] };
  const stocks = [{ ticker: "RIPO", price: 12 }, { ticker: "FOLO", price: 6 }, { ticker: "SPAC", price: 9.9 }, { ticker: "SPLT", price: 1.89 }];
  const rows = core.recentListings("us", ipo, stocks, "2026-09-26");
  assert.deepEqual(rows.map((r) => r.ticker), ["SPAC", "RIPO", "SPLT"]);
  const by = Object.fromEntries(rows.map((r) => [r.ticker, r]));
  assert.equal(Math.round(by.RIPO.retPct), -20);
  assert.equal(by.SPAC.retPct, null);
  assert.equal(by.SPAC.offerUnit, true);
  assert.equal(by.SPLT.retPct, null);
  assert.equal(by.SPLT.retSuspect, true);
});

test("관리·경보: 구분 필터·개수·스냅샷 연결", () => {
  const al = { sections: {
    admin: { asOf: "2026-09-26", rows: [{ ticker: "000001", company: "가", reason: "감사의견 거절", designatedDate: "2026-09-23" }] },
    halt: { asOf: "2026-09-26", rows: [{ ticker: "000002", company: "나", reason: "투자유의" }] },
    warning: { asOf: "2026-09-23", rows: [{ ticker: "000003", company: "다", noticeDate: "2026-09-23", designatedDate: "2026-09-28" }] },
    risk: { rows: [] },
    caution: { rows: [{ ticker: "000004", company: "라", type: "투자경고 지정예고", noticeDate: "2026-09-23" }] },
    limitUp: { rows: [{ ticker: "999999" }] },
  } };
  const stocks = [{ ticker: "000001", price: 100 }];
  assert.deepEqual(core.alertCounts(al), { all: 4, admin: 1, halt: 1, warn: 1, caution: 1 });
  const all = core.alertRows(al, stocks, "all");
  assert.equal(all.length, 4);
  assert.equal(all[0].item.price, 100);
  assert.equal(all[0].date, "2026-09-23");
  assert.equal(all[2].date, "2026-09-28");
  assert.equal(all[3].detail, "투자경고 지정예고");
  assert.deepEqual(core.alertRows(al, stocks, "warn").map((r) => r.kind), ["warning"]);
});

test("배당 열(주당배당금·배당성향)은 두 시장 모두", () => {
  for (const m of ["us", "kr"]) {
    const keys = core.availableColumns(m).map((c) => c.key);
    assert.ok(keys.includes("dps") && keys.includes("payoutRatio"), m);
  }
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`find-table-core: ${passed} passed`);
