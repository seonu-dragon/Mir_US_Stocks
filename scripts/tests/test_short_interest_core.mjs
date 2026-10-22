// 공매도 잔고 보드 순수 함수(short-interest-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_short_interest_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const S = require("../../short-interest-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const PGAC = { ticker: "PGAC", shortShares: 44372, daysToCover: 986.04, avgVolume: 45 };
const KMB = { ticker: "KMB", shortShares: 53177521, daysToCover: 14.23, avgVolume: 3737851 };
const XEL = { ticker: "XEL", shortShares: 49237277, daysToCover: 8.04, avgVolume: 6126840 };
const WENN = { ticker: "WENN", shortShares: 445, daysToCover: 1.0, avgVolume: 52244 };
const NONE = { ticker: "NONE", shortShares: 100, daysToCover: null, avgVolume: 900000 };

test("유동성 기준", () => {
  assert.equal(S.isIlliquid(PGAC), true);
  assert.equal(S.isIlliquid(KMB), false);
  assert.equal(S.isIlliquid({ avgVolume: null }), true);
  assert.equal(S.isIlliquid({ avgVolume: 60000 }, 5), true);      // $30만/일
  assert.equal(S.isIlliquid({ avgVolume: 60000 }, 50), false);    // $300만/일
  assert.equal(S.isIlliquid({ avgVolume: 60000 }, null), false);  // 가격 모르면 주식수만
});

test("DTC 1.0 바닥과 결측", () => {
  assert.deepEqual(S.dtc(KMB), { value: 14.23, floored: false });
  assert.equal(S.dtc(WENN).floored, true);
  assert.equal(S.fmtDtc(WENN), "<1");
  assert.equal(S.fmtDtc(KMB), "14.23");
  assert.equal(S.fmtDtc(KMB, 1), "14.2");
  assert.equal(S.dtc(NONE), null);
  assert.equal(S.fmtDtc(NONE), "—");
  assert.equal(S.fmtDtc({ daysToCover: 1.0, shortShares: 900, avgVolume: 500 }), "1.00"); // 실제 1.8 인데 1.0 → 바닥 아님
});

test("정렬: 유동 종목 먼저, 결측 맨 뒤", () => {
  const out = S.sortByDtc([NONE, WENN, PGAC, XEL, KMB]).map((r) => r.ticker);
  assert.deepEqual(out, ["KMB", "XEL", "WENN", "PGAC", "NONE"]);
  const px = { XEL: 0.1 };                                        // 가격 기준 거래대금 미달 → 뒤로
  assert.deepEqual(S.sortByDtc([XEL, KMB], (t) => px[t] ?? null).map((r) => r.ticker), ["KMB", "XEL"]);
});

test("결제일 ISO 변환", () => {
  assert.equal(S.isoDate("09/30/2026"), "2026-09-30");
  assert.equal(S.isoDate("1/5/2026"), "2026-01-05");
  assert.equal(S.isoDate("2026-09-30"), "2026-09-30");
  assert.equal(S.isoDate(""), null);
  assert.equal(S.isoDate(null), null);
});

test("종목 요약: 있는 종목·없는 종목·결측", () => {
  const payload = { settlementDate: "09/30/2026", rows: [
    { ...KMB, changePct: 1.3, settlementDate: "09/30/2026" },
    { ...WENN, changePct: -2.5 },
    { ticker: "NODATA", shortShares: null, daysToCover: null, avgVolume: null, changePct: null },
  ] };
  const k = S.tickerSummary(payload, "kmb");
  assert.deepEqual(k, { ticker: "KMB", settlementDate: "2026-09-30", shortShares: 53177521, dtcText: "14.23", changePct: 1.3 });
  const w = S.tickerSummary(payload, "WENN");
  assert.equal(w.dtcText, "<1");                                  // Nasdaq 1.0 바닥 → <1
  assert.equal(w.settlementDate, "2026-09-30");                   // 행에 없으면 파일 기준일
  const n = S.tickerSummary(payload, "NODATA");
  assert.equal(n.shortShares, null);                              // 0 이 아니라 null
  assert.equal(n.dtcText, "—");
  assert.equal(n.changePct, null);
  assert.equal(S.tickerSummary(payload, "AAPL"), null);           // 파일 밖 → null(카드 숨김)
  assert.equal(S.tickerSummary(null, "KMB"), null);
  assert.equal(S.tickerSummary(payload, ""), null);
});

if (failures.length) {
  console.error(`short-interest-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`short-interest-core: ${passed}개 통과`);
