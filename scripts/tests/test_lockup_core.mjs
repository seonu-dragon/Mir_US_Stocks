// 보호예수 해제 순수 함수(lockup-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_lockup_core.mjs   (CI 의 "Lockup core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../lockup-core.js");

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

const PAYLOAD = {
  releases: [
    { code: "0035S0", company: "빅웨이브로보틱스", date: "2026-10-29", shares: 1194638, pct: 11.22, periods: ["1개월"],
      types: { "기타 주주": 194638, "벤처금융": 1000000 } },
    { code: "0035S0", company: "빅웨이브로보틱스", date: "2029-09-29", shares: 5282405, pct: 49.61, periods: ["3년"],
      types: { "최대주주 등": 5282405 } },
    { code: "0035S0", company: "빅웨이브로보틱스", date: "2026-09-20", shares: 100, pct: 0.01, periods: ["15일"], types: {} },
    { code: "417030", company: "니어스랩", date: "2026-10-05", shares: 569622, pct: 0.8, periods: ["3개월"], types: {} },
    { code: "999999", company: "큰해제", date: "2026-10-10", shares: 3000000, pct: 25.0, periods: ["6개월"], types: {} },
    { code: "888888", company: "먼해제", date: "2026-12-30", shares: 1, pct: 40.0, periods: ["1년"], types: {} },
  ],
  ipos: [
    { code: "0035S0", listingDate: "2026-09-29", offerPrice: 18000, instCompetition: 1109.37, commitPct: 18.14,
      subscriptionCompetition: 1375.34, verified: true, lockedPct: 69.93 },
    { code: "123456", listingDate: "2025-01-10", noTable: true, verified: false },
  ],
};

test("종목별: 다가오는 해제·지난 해제·IPO 요약", () => {
  const r = core.forTicker(PAYLOAD, "0035S0", "2026-09-27");
  assert.equal(r.upcoming.length, 2);
  assert.equal(r.next.date, "2026-10-29");
  assert.equal(r.recent.length, 1);
  assert.equal(r.ipo.offerPrice, 18000);
  assert.equal(core.forTicker(PAYLOAD, "000000", "2026-09-27"), null);
  const onlyIpo = core.forTicker(PAYLOAD, "123456", "2026-09-27");
  assert.equal(onlyIpo.upcoming.length, 0);
  assert.equal(onlyIpo.ipo.noTable, true);
});

test("N일 안 해제: 비율 큰 순, 최소 비율 거름", () => {
  const rows = core.upcomingWithin(PAYLOAD, "2026-09-27", 35, 1);
  assert.deepEqual(rows.map((r) => r.company), ["큰해제", "빅웨이브로보틱스"]);   // 0.8%·창 밖·지난 것 제외
});

test("표시 형식", () => {
  assert.equal(core.fmtShares(1194638), "119만 주");
  assert.equal(core.fmtShares(250000000), "2.5억 주");
  assert.equal(core.fmtShares(0), "");
  assert.equal(core.fmtWon(1194638 * 18000), "215억 원");
  assert.equal(core.typeLine({ "기타 주주": 194638, "벤처금융": 1000000 }), "벤처금융 100만 주 · 기타 주주 19만 주");
  assert.equal(core.relLabel("2026-09-27", "2026-09-27"), "오늘");
  assert.equal(core.relLabel("2026-09-27", "2026-10-01"), "D-4");
  assert.equal(core.relLabel("2026-09-27", "2026-09-20"), "7일 전");
  assert.equal(core.valueAtPrice(10, 0), null);
  assert.equal(core.isoAddDays("2026-12-30", 3), "2027-01-02");
});

test("IPO 수요예측·청약 결과 항목", () => {
  const s = core.ipoStats(PAYLOAD.ipos[0]);
  assert.deepEqual(s.map((x) => x.k), ["공모가", "기관 경쟁률", "의무보유 확약", "청약 경쟁률", "상장일 매각제한"]);
  assert.equal(s[1].v, "1,109:1");
  assert.equal(s[2].v, "18.1%");
  assert.deepEqual(core.ipoStats(null), []);
});

if (failures.length) {
  console.error(`실패 ${failures.length}건:\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`lockup-core: ${passed}개 통과`);
