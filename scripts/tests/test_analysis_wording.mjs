// 차트 분석(analysis.js) 문구 정직성 단위 테스트. 네트워크 없음 — 브라우저 전역은 최소 shim.
// 실행: node scripts/tests/test_analysis_wording.mjs   (CI 의 "Analysis wording tests" 스텝)
// - 머리글 판정은 기술 점수 그대로('상승/하락 우위' 방향 판정 없음)
// - 브리핑 캘리브레이션 문장은 보정표 숫자만 쓰고, 유의하지 않으면 '유의한 차이 없음'
// - 패턴 카드에 '패턴 높이만큼 이동 시' 목표가 줄이 없다
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

global.window = globalThis;
const noopEl = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
  setAttribute() {}, appendChild() {}, addEventListener() {},
  querySelectorAll: () => [], querySelector: () => null,
});
global.document = {
  addEventListener() {}, removeEventListener() {},
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: noopEl, body: noopEl(), documentElement: noopEl(),
};
try { global.location = { search: "", href: "", pathname: "/" }; } catch (e) { /* 읽기전용 */ }
// ensureCalibration 이 네트워크로 가지 않게 — 테스트는 window.PROB_CALIBRATION 을 직접 넣는다.
global.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) });

for (const rel of ["indicators.js", "pattern_detectors_extended.js", "analysis.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, rel), "utf-8"), { filename: rel });
}
const P = globalThis.MirProb;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

test("verdictText: 점수만, 방향 판정 없음", () => {
  assert.equal(P.verdictText(67.4), "기술 점수 67");
  assert.equal(P.verdictText(20), "기술 점수 20");
  assert.equal(P.verdictText(NaN), "기술 점수 —");
  for (const s of [10, 40, 50, 60, 90]) assert.ok(!/우위/.test(P.verdictText(s)), `${s} 에 우위 문구`);
});

const block = { baseRate: 51.32, baseN: 44958 };
test("calibrationNoteText: 유의하지 않으면 '유의한 차이가 없었습니다'", () => {
  const t = P.calibrationNoteText({ row: { lo: 60, hi: 70, upRate: 51.02, n: 7523, differsFromBase: false }, block }, 20);
  assert.equal(t, "이 점수대(60~70)의 과거 20거래일 뒤 상승 비율은 51.0%로 시장 평균 51.3%와 유의한 차이가 없었습니다(표본 7,523건).");
});
test("calibrationNoteText: 유의하면 차이를 %p 로", () => {
  const t = P.calibrationNoteText({ row: { lo: 60, hi: 70, upRate: 52.99, n: 3752, differsFromBase: true }, block: { baseRate: 45.97 } }, 60);
  assert.equal(t, "이 점수대(60~70)의 과거 60거래일 뒤 상승 비율은 53.0%로 시장 평균 46.0%와 +7.0%p 달랐습니다(표본 3,752건).");
  const neg = P.calibrationNoteText({ row: { lo: 45, hi: 50, upRate: 43.88, n: 5891, differsFromBase: true }, block: { baseRate: 46.68 } }, 20);
  assert.ok(neg.includes("-2.8%p 달랐습니다"), neg);
});
test("calibrationNoteText: 자료가 없으면 빈 문자열(지어내지 않는다)", () => {
  assert.equal(P.calibrationNoteText(null, 20), "");
  assert.equal(P.calibrationNoteText({ row: { lo: 60, hi: 70 }, block }, 20), "");
});

// 합성 일봉으로 실제 결과 HTML 을 만들어 문구를 본다(패턴 통계 없음 → 패턴 카드 생략은 정상).
function synthRows(n) {
  const rows = [];
  let c = 100;
  const start = Date.UTC(2021, 0, 4);
  for (let i = 0; i < n; i++) {
    c *= 1 + Math.sin(i / 9) * 0.012 + 0.0007;
    const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
    rows.push({ o: c * 0.995, h: c * 1.01, l: c * 0.99, c, v: 1e6 + (i % 7) * 1e5, d });
  }
  return rows;
}
test("buildResultHTML: '우위 국면'·목표가 줄 없음, 보정표가 있으면 캘리브레이션 문장", () => {
  globalThis.PROB_CALIBRATION = {
    markets: { us: { 20: { baseRate: 51.32, baseN: 44958, significantBuckets: 0, buckets: [
      { lo: 0, hi: 50, upRate: 50.0, n: 100, nEff: 50, ciLow: 40, ciHigh: 60, avgReturn: 0.1, differsFromBase: false },
      { lo: 50, hi: 101, upRate: 51.0, n: 200, nEff: 90, ciLow: 45, ciHigh: 57, avgReturn: 0.2, differsFromBase: false },
    ] } } },
  };
  const res = P.analyzeRows(synthRows(400), 20, { ticker: "TEST", company: "Test" });
  assert.ok(res && res.consensus, "분석 결과 없음");
  const html = P.buildResultHTML(res);
  assert.ok(!/우위 국면|약한 상승 우위|약한 하락 우위/.test(html), "방향 판정 문구가 남아 있음");
  assert.ok(!html.includes("패턴 높이만큼"), "목표가 줄이 남아 있음");
  assert.ok(html.includes(`종합 기술 점수 <strong>${Math.round(res.consensus.up)}</strong>/100`), "점수 문장 없음");
  assert.ok(html.includes("유의한 차이가 없었습니다(표본"), "캘리브레이션 문장 없음");
  assert.ok(html.includes(`<div class="verdict">기술 점수 ${Math.round(res.consensus.up)}</div>`), "머리글 점수 없음");
  delete globalThis.PROB_CALIBRATION;
  const bare = P.buildResultHTML(res);
  assert.ok(!bare.includes("이 점수대("), "보정표가 없는데 캘리브레이션 문장을 씀");
});

if (failures.length) {
  console.error(`analysis wording: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`analysis wording: ${passed}개 통과`);
