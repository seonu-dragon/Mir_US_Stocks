// 미상환 CB·BW 오버행 순수 함수(cb-overhang-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_cb_overhang_core.mjs   (CI 의 "CB overhang core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../cb-overhang-core.js");

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

// 2026-10-23 실측(DART 반기보고서 2026.06) 행을 그대로 옮긴 픽스처.
const PAYLOAD = {
  companies: {
    "383930": {
      company: "디티앤씨알오", report: "반기보고서 (2026.06)", link: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814003017",
      baseDate: "2026-06-30", totalShares: 12784128, convShares: 8087342, pct: 63.26,
      rows: [
        { kind: "BW", seq: "3회차", issueDate: "2026-02-20", maturity: "2031-02-20", price: 2473, remaining: 6000000000, shares: 2426202 },
        { kind: "CB", seq: "2회차", issueDate: "2026-02-20", maturity: "2031-02-20", price: 2473, remaining: 14000000000, shares: 5661140 },
      ],
    },
    "000001": { company: "작은물량", baseDate: "2026-06-30", totalShares: 100000000, rows: [{ kind: "CB", maturity: "2028-01-01", shares: 3000000 }] },
    "000002": { company: "총수모름", baseDate: "2026-06-30", rows: [{ kind: "CB", maturity: "2028-01-01", shares: 3000000 }] },
    "000003": { company: "합계불일치", baseDate: "2026-06-30", totalShares: 1000000, verified: false, rows: [{ kind: "CB", maturity: "2028-01-01", shares: 500000 }] },
    "000004": { company: "만기지남", baseDate: "2026-06-30", totalShares: 1000000,
      rows: [{ kind: "CB", maturity: "2026-09-30", shares: 500000 }, { kind: "BW", maturity: "2027-03-01", shares: 50000, remaining: 1e9 }] },
    "000005": { company: "전부만기", baseDate: "2026-06-30", totalShares: 1000000, rows: [{ kind: "CB", maturity: "2026-07-01", shares: 500000 }] },
  },
};
const TODAY = "2026-10-23";

test("10% 이상이면 배지, 큰 물량 순으로 정렬", () => {
  const info = core.forTicker(PAYLOAD, "383930", TODAY);
  assert.equal(info.shares, 8087342);
  assert.equal(info.pct, 63.26);
  assert.equal(info.warn, true);
  assert.equal(info.rows[0].kind, "CB");
  assert.equal(info.remaining, 20000000000);
  assert.equal(core.badgeText(info), "오버행 주의: 미상환 사채 63%");
});

test("10% 미만이면 배지 없음(비율은 있다)", () => {
  const info = core.forTicker(PAYLOAD, "000001", TODAY);
  assert.equal(info.pct, 3);
  assert.equal(info.warn, false);
  assert.equal(core.badgeText(info), "");
});

test("발행주식총수를 모르면 비율을 만들지 않는다", () => {
  const info = core.forTicker(PAYLOAD, "000002", TODAY);
  assert.equal(info.pct, null);
  assert.equal(info.warn, false);
});

test("표 합계 불일치(verified=false)는 배지를 달지 않는다", () => {
  const info = core.forTicker(PAYLOAD, "000003", TODAY);
  assert.equal(info.pct, 50);
  assert.equal(info.verified, false);
  assert.equal(info.warn, false);
});

test("화면 시점에 만기가 지난 행은 빼고 다시 계산", () => {
  const info = core.forTicker(PAYLOAD, "000004", TODAY);
  assert.equal(info.rows.length, 1);
  assert.equal(info.pct, 5);
  assert.equal(info.warn, false);
  assert.equal(core.forTicker(PAYLOAD, "000005", TODAY), null);
});

test("기록 없는 종목·빈 페이로드는 null", () => {
  assert.equal(core.forTicker(PAYLOAD, "999999", TODAY), null);
  assert.equal(core.forTicker(null, "383930", TODAY), null);
  assert.equal(core.forTicker({}, "383930", TODAY), null);
});

test("표기", () => {
  assert.equal(core.fmtShares(5661140), "566만 주");
  assert.equal(core.fmtWon(14000000000), "140억 원");
  assert.equal(core.fmtWon(1.5e12), "1.5조 원");
  assert.equal(core.fmtPct(9.84), "9.8%");
  assert.equal(core.fmtPct(26.87), "27%");
  assert.equal(core.fmtWon(null), "");
});

if (failures.length) {
  console.error(`FAIL ${failures.length}/${passed + failures.length}`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`cb-overhang-core: ${passed} passed`);
