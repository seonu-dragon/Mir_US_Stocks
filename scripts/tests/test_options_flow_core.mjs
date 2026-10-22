// 옵션 포지션 순수 함수(options-flow-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_options_flow_core.mjs   (CI 의 "Options flow core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../options-flow-core.js");

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

const P = {
  uoa: [["NVDA", "2026-10-30", "C", 230, 50000, 9000, 5.6, 48.2, 12500000], ["bad"]],
  tickers: {
    NVDA: { spot: 221.97, expiries: 6, netGex: 1.25e9, callWall: 230, putWall: 200, flip: 210, maxPain: 215, maxPainExpiry: "2026-10-24",
      strikes: [[200, 1e8, -9e8], [210, 3e8, -2e8], [230, 1.5e9, -1e7]], uoa: [["NVDA", "2026-10-30", "C", 230, 50000, 9000, 5.6, 48.2, 12500000]] },
    EMPTY: { spot: 10, strikes: [] },
    NOMP: { spot: 10, strikes: [[10, 1, -1]], maxPainExpiry: "2026-10-24" },
  },
};

test("summarize·marketUoa", () => {
  const s = core.summarize(P, "nvda");
  assert.equal(s.callWall, 230);
  assert.equal(s.uoa[0].type, "C");
  assert.equal(s.maxPain, 215);
  assert.equal(s.maxPainExpiry, "2026-10-24");
  const n = core.summarize(P, "NOMP");                  // 맥스페인 없는 종목은 숫자를 채우지 않는다
  assert.equal(n.maxPain, null);
  assert.equal(n.maxPainExpiry, "");
  assert.equal(core.summarize(P, "EMPTY"), null);
  assert.equal(core.summarize(null, "NVDA"), null);
  assert.equal(core.marketUoa(P).length, 1);
});

test("bucket 은 n 칸 이하로 묶고 합한다", () => {
  const strikes = Array.from({ length: 50 }, (_, i) => [100 + i, 10, -5]);
  const b = core.bucket(strikes, 24);
  assert.ok(b.length <= 24);
  assert.equal(b[0].lo, 100);
  assert.equal(b.reduce((s, x) => s + x.call, 0), 500);
  assert.deepEqual(core.bucket([[1, 2, -3]], 24), [{ lo: 1, hi: 1, call: 2, put: -3 }]);
});

test("scale 은 최댓값 기준 0~1", () => {
  const s = core.scale([{ call: 10, put: -40 }, { call: 20, put: 0 }]);
  assert.equal(s[0].pw, 1);
  assert.equal(s[1].cw, 0.5);
});

test("표기", () => {
  assert.equal(core.fmtUsd(1.25e9, true), "+$12.5억");
  assert.equal(core.fmtUsd(3.2e10), "$320억");
  assert.equal(core.fmtUsd(-3.4e8), "-$3.4억");
  assert.equal(core.fmtUsd(2.1e12), "$2.10조");
  assert.equal(core.fmtUsd(12500000), "$1,250만");
  assert.equal(core.fmtUsd(null), "—");
  assert.equal(core.fmtStrike(230), "230");
  assert.equal(core.fmtStrike(222.5), "222.5");
  assert.equal(core.shortExpiry("2026-10-30"), "10/30");
  assert.equal(core.regime(-5).key, "neg");
  assert.equal(core.regime(0).key, "flat");
});

if (failures.length) {
  console.error(`options-flow-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`options-flow-core: ${passed}개 통과`);
