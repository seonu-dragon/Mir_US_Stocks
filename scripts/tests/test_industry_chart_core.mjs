// 산업 지표 차트 순수 계산(industry-chart-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_industry_chart_core.mjs   (CI 의 "Industry chart tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const C = require("../../industry-chart-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

test("keyTime: 월·분기·일 키, 틀린 형식은 NaN", () => {
  assert.equal(C.keyTime("2025-08"), Date.UTC(2025, 7, 1));
  assert.equal(C.keyTime("2025-Q3"), Date.UTC(2025, 6, 1));
  assert.equal(C.keyTime("2025-08-15"), Date.UTC(2025, 7, 15));
  for (const bad of ["2025-13", "2025-02-30", "115/08", "2025/08", "", null]) assert.ok(Number.isNaN(C.keyTime(bad)), String(bad));
});

test("seriesIssues: 형식·역순·중복·미래·값", () => {
  const s = [{ date: "2025-08", val: 1 }, { date: "2026-07", val: 2 }, { date: "2026-07", val: 2 }, { date: "2026-06", val: 3 },
    { date: "2026-10", val: 4 }, { date: "2026-8", val: 5 }, { date: "2026-11", val: null }];
  const kinds = C.seriesIssues(s, "M", "2026-09-27").map((p) => `${p.kind}:${p.date}`);
  assert.deepEqual(kinds, ["duplicate:2026-07", "order:2026-06", "future:2026-10", "format:2026-8", "future:2026-11", "value:2026-11"]);
  assert.deepEqual(C.seriesIssues([{ date: "2026-08-01", val: 1 }], "M", "2026-09-27").map((p) => p.kind), ["format"]);
});

test("niceTicks: 1·2·5 눈금이 값을 감싼다", () => {
  const t = C.niceTicks(81.7, 134.75, 5);
  assert.ok(t.min <= 81.7 && t.max >= 134.75);
  assert.equal(t.step, 20);
  assert.deepEqual(t.ticks, [80, 100, 120, 140]);
  const z = C.niceTicks(-0.3, 0.8, 4);
  assert.ok(z.ticks.includes(0));
});

test("yDomain: 양수 레벨 막대는 0 에서 시작하고 0 아래 여백이 없다", () => {
  const d = C.yDomain([81.7, 122.45, 134.75], { zeroFloor: true, target: 5 });
  assert.equal(d.min, 0);
  const neg = C.yDomain([-5, -2, -1], { zeroFloor: true });
  assert.ok(neg.max >= -1 && neg.min <= -5);
});

test("xLayout: 적립 중인 월간(2025-08 · 2026-07 · 2026-08) — 날짜 비례, 막대가 축 안", () => {
  const times = ["2025-08", "2026-07", "2026-08"].map(C.keyTime);
  const L = 50, W = 780;
  const lay = C.xLayout(times, { freq: "M", barMode: true, left: L, width: W });
  // 11개월 공백이 1개월 간격보다 훨씬 넓게
  assert.ok((lay.xs[1] - lay.xs[0]) > 8 * (lay.xs[2] - lay.xs[1]));
  lay.xs.forEach((x) => { assert.ok(x - lay.barWidth / 2 >= L - 1e-6, `left ${x}`); assert.ok(x + lay.barWidth / 2 <= L + W + 1e-6, `right ${x}`); });
  // 이웃 막대가 겹치지 않는다
  assert.ok(lay.xs[2] - lay.xs[1] > lay.barWidth);
});

test("xLayout: 선 모드는 첫·끝 점이 플롯 양끝", () => {
  const times = ["2024-01-02", "2024-06-03", "2025-01-02"].map(C.keyTime);
  const lay = C.xLayout(times, { freq: "D", barMode: false, left: 10, width: 100 });
  assert.equal(lay.xs[0], 10);
  assert.equal(lay.xs[2], 110);
});

test("timeTicks: 범위 안, 개수 상한, 라벨 형식", () => {
  const d0 = C.keyTime("2025-07-16"), d1 = C.keyTime("2026-08-16");
  const t = C.timeTicks(d0, d1, 6);
  assert.ok(t.length >= 2 && t.length <= 6, String(t.length));
  t.forEach((k) => { assert.ok(k.t >= d0 && k.t <= d1); assert.match(k.label, /^\d{4}-\d{2}$/); });
  const long = C.timeTicks(C.keyTime("1990-01-01"), C.keyTime("2026-08-01"), 8);
  assert.ok(long.length <= 8);
  long.forEach((k) => assert.match(k.label, /^\d{4}$/));
});

test("auditSvg: 축 밖 막대·잘린 라벨·겹친 라벨을 잡는다(검사기가 헛돌지 않는지)", () => {
  const box = { W: 400, H: 200, padL: 40, padR: 20, padT: 10, padB: 30 };
  const ok = '<svg><rect x="50" y="20" width="10" height="100"/><text x="34" y="50" text-anchor="end">100</text></svg>';
  assert.deepEqual(C.auditSvg(ok, box), []);
  assert.ok(C.auditSvg('<svg><rect x="10" y="20" width="60" height="100"/></svg>', box).length);
  assert.ok(C.auditSvg('<svg><rect x="50" y="2" width="10" height="100"/></svg>', box).length);
  assert.ok(C.auditSvg('<svg><path d="M50,20L420,40"/></svg>', box).length);
  assert.ok(C.auditSvg('<svg><text x="2" y="50" text-anchor="end">1,234,567</text></svg>', box).length);
  assert.ok(C.auditSvg('<svg><text x="100" y="190">2025-08</text><text x="110" y="190">2025-09</text></svg>', box).length);
});

console.log(`industry-chart-core: ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
