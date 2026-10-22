// 은행 건전성 순수 함수(fdic-banks-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_fdic_banks_core.mjs   (CI 의 "FDIC banks core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../fdic-banks-core.js");

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

const cols = ["quarter", "nim", "npl", "nco", "roa", "roe", "cet1", "assets", "deposits", "loans"];
const P = {
  latestQuarter: "2026-Q2", columns: cols,
  banks: {
    JPM: { cert: 628, q: [
      ["2025-Q2", 2.7, 0.9, 0.6, 1.3, 16, 15.2, 3.9e9, 2.5e9, 1.4e9],
      ["2025-Q3", 2.8, 0.85, 0.62, 1.4, 16.5, 15.1, 4.0e9, 2.6e9, 1.45e9],
      ["2026-Q1", 2.92, 0.85, 0.62, 1.44, 16.64, 15.08, 4.0e9, 2.78e9, 1.49e9],
      ["2026-Q2", 2.88, 0.78, 0.61, 1.59, 18.55, 15.03, 4.09e9, 2.82e9, 1.54e9]] },
    OLD: { cert: 1, q: [["2026-Q1", 3, null, null, null, null, null, 1, 1, 1]] },
    EMPTY: { cert: 2, q: [["2026-Q2", null, null, null, null, null, null, null, null, null]] },
  },
};

test("은행 판정은 파일 없이 목록으로", () => {
  assert.equal(core.isBank("jpm"), true);
  assert.equal(core.isBank("AAPL"), false);
  assert.equal(core.isBank(""), false);
});

test("summarize: 최신 분기·전년 같은 분기 대비 %p·예금 전년비", () => {
  const s = core.summarize(P, "JPM");
  assert.equal(s.quarter, "2026-Q2");
  assert.equal(s.stale, false);
  const nim = s.metrics.find((m) => m.key === "nim");
  assert.equal(nim.value, 2.88);
  assert.equal(nim.yoy, 0.18);
  assert.equal(s.depositsYoy, 12.8);
  assert.equal(s.table.length, 4);
});

test("전년 분기가 없으면 yoy 는 null, 최신 분기가 아니면 stale", () => {
  const s = core.summarize(P, "OLD");
  assert.equal(s.stale, true);
  assert.equal(s.metrics.length, 1);
  assert.equal(s.metrics[0].yoy, null);
  assert.equal(s.depositsYoy, null);
});

test("값이 하나도 없거나 없는 종목은 null", () => {
  assert.equal(core.summarize(P, "EMPTY"), null);
  assert.equal(core.summarize(P, "NONE"), null);
  assert.equal(core.summarize(null, "JPM"), null);
});

test("표기", () => {
  assert.equal(core.yearAgo("2026-Q2"), "2025-Q2");
  assert.equal(core.quarterLabel("2026-Q2"), "26년 2분기");
  assert.equal(core.fmtUsdThousands(2.82e9), "$2.82조");
  assert.equal(core.fmtUsdThousands(25.1e6), "$251억");
  assert.equal(core.fmtUsdThousands(null), "");
  assert.equal(core.fmtPct(0.78), "0.78%");
  assert.equal(core.fmtPct(null), "–");
  assert.equal(core.fmtPp(-0.071), "-0.07%p");
});

if (failures.length) {
  console.error(`fdic-banks-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`fdic-banks-core: ${passed}개 통과`);
