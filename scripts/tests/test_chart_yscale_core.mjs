// 가격 축 세로 스케일 순수 계산(chart-yscale-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_chart_yscale_core.mjs   (CI 의 "Chart price-axis scale tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const Y = require("../../chart-yscale-core.js");

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
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

// ---- 변환 ----
test("toT/fromT 선형·로그 왕복", () => {
  assert.equal(Y.toT(123, false), 123);
  near(Y.toT(1000, true), 3, 1e-12);
  near(Y.fromT(2, true), 100, 1e-9);
  assert.ok(Number.isNaN(Y.toT(0, true)), "로그에서 0 은 NaN");
  assert.ok(Number.isNaN(Y.toT(-5, true)), "로그에서 음수는 NaN");
});

test("createScale 선형: 위=max, 아래=min, 역변환", () => {
  const s = Y.createScale({ min: 100, max: 200, log: false, top: 28, height: 300 });
  near(s.y(200), 28, 1e-9);
  near(s.y(100), 328, 1e-9);
  near(s.y(150), 178, 1e-9);
  near(s.value(178), 150, 1e-9);
  assert.ok(s.inRange(150) && !s.inRange(99) && !s.inRange(201));
});

test("createScale 로그: 같은 비율 = 같은 픽셀 간격", () => {
  const s = Y.createScale({ min: 10, max: 1000, log: true, top: 0, height: 200 });
  near(s.y(1000), 0, 1e-9);
  near(s.y(100), 100, 1e-9, "10→1000 의 기하 중앙 100 이 가운데");
  near(s.y(10), 200, 1e-9);
  near(s.y(20) - s.y(40), s.y(200) - s.y(400), 1e-9, "2배 간격 동일");
  near(s.value(100), 100, 1e-9);
  assert.ok(Number.isNaN(s.y(0)), "0 은 좌표 없음");
});

test("createScale 잘못된 범위는 자동 보정(min==max)", () => {
  const s = Y.createScale({ min: 50, max: 50, log: false, top: 0, height: 100 });
  assert.ok(s.max > s.min);
  near(s.y(50), 50, 1e-9, "단일 값은 가운데");
});

// ---- 자동 맞춤 ----
test("autoRange 여백 없음 = 저가·고가 그대로", () => {
  assert.deepEqual(Y.autoRange(90, 110, 0, false), { min: 90, max: 110 });
});

test("autoRange 선형 여백 5%", () => {
  const r = Y.autoRange(100, 200, 0.05, false);
  near(r.min, 95, 1e-9);
  near(r.max, 205, 1e-9);
});

test("autoRange 로그 여백은 비율 공간(기하)에서", () => {
  const r = Y.autoRange(10, 1000, 0.1, true);
  near(Math.log10(r.min), 1 - 0.2, 1e-9);
  near(Math.log10(r.max), 3 + 0.2, 1e-9);
});

test("autoRange 로그에서 0 이하 저가는 양수로 올림", () => {
  const r = Y.autoRange(0, 50, 0, true);
  assert.ok(r.min > 0 && r.max === 50);
});

// ---- 줌 ----
test("zoomRange 가운데 기준 2배 확대", () => {
  const r = Y.zoomRange({ min: 100, max: 200 }, 0.5, 150, false);
  near(r.min, 125, 1e-9);
  near(r.max, 175, 1e-9);
});

test("zoomRange 앵커 가격은 화면 위치가 유지된다", () => {
  const before = { min: 100, max: 200 };
  const anchor = 180;
  const s0 = Y.createScale({ ...before, top: 0, height: 300 });
  const after = Y.zoomRange(before, 0.6, anchor, false);
  const s1 = Y.createScale({ ...after, top: 0, height: 300 });
  near(s1.y(anchor), s0.y(anchor), 1e-9);
});

test("zoomRange 로그: 앵커 고정 + 비율 공간 확대", () => {
  const before = { min: 10, max: 1000 };
  const after = Y.zoomRange(before, 0.5, 100, true);
  near(after.min, Math.pow(10, 1.5), 1e-9);
  near(after.max, Math.pow(10, 2.5), 1e-9);
  const s0 = Y.createScale({ ...before, log: true, top: 0, height: 100 });
  const s1 = Y.createScale({ ...after, log: true, top: 0, height: 100 });
  near(s1.y(100), s0.y(100), 1e-9);
});

test("zoomRange 는 기준 범위 대비 과도한 확대·축소를 막는다", () => {
  const ref = { min: 100, max: 200 };
  let r = { ...ref };
  for (let i = 0; i < 200; i += 1) r = Y.zoomRange(r, 0.5, 150, false, ref);
  near(r.max - r.min, 100 * Y.MIN_SPAN_RATIO, 1e-9, "최소 폭");
  near((r.max + r.min) / 2, 150, 1e-9, "가운데 유지");
  r = { ...ref };
  for (let i = 0; i < 200; i += 1) r = Y.zoomRange(r, 2, 150, false, ref);
  near(r.max - r.min, 100 * Y.MAX_SPAN_RATIO, 1e-6, "최대 폭");
});

test("zoomRange 로그 축소는 0 아래로 내려가지 않는다", () => {
  let r = { min: 50, max: 60 };
  for (let i = 0; i < 30; i += 1) r = Y.zoomRange(r, 1.5, 55, true, { min: 50, max: 60 });
  assert.ok(r.min > 0, `min=${r.min}`);
});

test("dragZoomFactor: 아래로 끌면 >1(압축), 위로 끌면 <1(늘림), 0 이면 1", () => {
  assert.ok(Y.dragZoomFactor(50, 300) > 1);
  assert.ok(Y.dragZoomFactor(-50, 300) < 1);
  assert.equal(Y.dragZoomFactor(0, 300), 1);
  near(Y.dragZoomFactor(30, 300) * Y.dragZoomFactor(-30, 300), 1, 1e-12, "왕복 대칭");
});

test("wheelZoomFactor / pinchZoomFactor", () => {
  assert.ok(Y.wheelZoomFactor(100) > 1);
  assert.ok(Y.wheelZoomFactor(-100) < 1);
  assert.equal(Y.wheelZoomFactor(0), 1);
  assert.equal(Y.pinchZoomFactor(100, 200), 0.5, "벌리면 확대");
  assert.equal(Y.pinchZoomFactor(0, 200), 1);
});

// ---- 팬 ----
test("panRange 선형: 아래로 끌면 범위가 위로(내용이 아래로)", () => {
  const r = Y.panRange({ min: 100, max: 200 }, 30, 300, false);
  near(r.min, 110, 1e-9);
  near(r.max, 210, 1e-9);
  // 끌기 전 y 에 있던 가격이 30px 아래로 내려갔는지
  const s0 = Y.createScale({ min: 100, max: 200, top: 0, height: 300 });
  const s1 = Y.createScale({ ...r, top: 0, height: 300 });
  near(s1.y(150) - s0.y(150), 30, 1e-9);
});

test("panRange 로그: 비율 공간 이동, 폭(배수) 유지", () => {
  const r = Y.panRange({ min: 10, max: 1000 }, -50, 100, true);
  near(r.max / r.min, 100, 1e-9);
  near(r.min, Math.pow(10, 0), 1e-9);
});

// ---- 눈금 ----
test("niceStep 은 1·2·2.5·5 × 10^k", () => {
  assert.equal(Y.niceStep(0.9), 1);
  assert.equal(Y.niceStep(1.3), 2);
  assert.equal(Y.niceStep(2.2), 2.5);
  assert.equal(Y.niceStep(3), 5);
  assert.equal(Y.niceStep(7), 10);
  assert.equal(Y.niceStep(180), 200);
  near(Y.niceStep(0.023), 0.025, 1e-12);
  assert.equal(Y.niceStep(4200), 5000);
});

test("linearTicks: 범위 안 · 등간격 · 보기 좋은 값", () => {
  const { step, ticks } = Y.linearTicks(123.4, 187.9, 5);
  assert.equal(step, 10);
  assert.deepEqual(ticks, [130, 140, 150, 160, 170, 180]);
});

test("linearTicks 원화 큰 값", () => {
  const { step, ticks } = Y.linearTicks(52300, 61800, 5);
  assert.equal(step, 2000);
  assert.deepEqual(ticks, [54000, 56000, 58000, 60000]);
});

test("linearTicks 소수(부동소수 잡음 없음)", () => {
  const { step, ticks } = Y.linearTicks(0.31, 0.47, 6);
  near(step, 0.025, 1e-12);
  assert.deepEqual(ticks, [0.325, 0.35, 0.375, 0.4, 0.425, 0.45]);
  assert.equal(Y.stepDecimals(step), 3);
});

test("stepDecimals", () => {
  assert.equal(Y.stepDecimals(10), 0);
  assert.equal(Y.stepDecimals(2.5), 1);
  assert.equal(Y.stepDecimals(0.5), 1);
  assert.equal(Y.stepDecimals(0.25), 3 - 1);
  assert.equal(Y.stepDecimals(0.01), 2);
  assert.equal(Y.stepDecimals(25), 0, "25 는 정수");
  assert.equal(Y.stepDecimals(25000), 0, "원화 25,000 간격은 소수 없음");
});

test("logTicks: 좁은 범위(<3배)는 선형 눈금", () => {
  const a = Y.logTicks(100, 180, 5);
  const b = Y.linearTicks(100, 180, 5);
  assert.deepEqual(a, b);
});

test("logTicks: 넓은 범위는 10^k × 가수, 오름차순·범위 안", () => {
  const { ticks } = Y.logTicks(3, 900, 6);
  assert.ok(ticks.length >= 4 && ticks.length <= 10, `개수 ${ticks.length}`);
  for (let i = 0; i < ticks.length; i += 1) {
    assert.ok(ticks[i] >= 3 && ticks[i] <= 900);
    if (i) assert.ok(ticks[i] > ticks[i - 1]);
    const m = ticks[i] / Math.pow(10, Math.floor(Math.log10(ticks[i]) + 1e-12));
    assert.ok([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9].some((x) => Math.abs(x - m) < 1e-9), `가수 ${m}`);
  }
  assert.ok(ticks.includes(10) && ticks.includes(100), "10의 거듭제곱 포함");
});

test("ticks 디스패치", () => {
  assert.deepEqual(Y.ticks(10, 20, false, 5), Y.linearTicks(10, 20, 5));
  assert.deepEqual(Y.ticks(1, 1000, true, 5), Y.logTicks(1, 1000, 5));
  assert.deepEqual(Y.linearTicks(5, 5, 5).ticks, []);
});

// ---- 상태(자동 맞춤 해제/복귀) ----
test("resolveRange: 기본은 자동 맞춤", () => {
  const st = Y.createState();
  const r = Y.resolveRange(st, 90, 110, 0);
  assert.equal(r.auto, true);
  assert.equal(r.min, 90);
  assert.equal(r.max, 110);
});

test("수동 범위 → 자동 복귀", () => {
  let st = Y.createState();
  st = Y.withManual(st, { min: 50, max: 70 });
  let r = Y.resolveRange(st, 90, 110, 0);
  assert.equal(r.auto, false);
  assert.deepEqual([r.min, r.max], [50, 70], "수동이면 보이는 봉과 무관");
  st = Y.withAuto(st);
  r = Y.resolveRange(st, 90, 110, 0);
  assert.equal(r.auto, true);
  assert.deepEqual([r.min, r.max], [90, 110]);
});

test("수동 범위가 로그에서 못 쓰는 값이면 로그 전환 시 자동 복귀", () => {
  let st = Y.withManual(Y.createState(), { min: -10, max: 50 });
  st = Y.withLog(st, true);
  assert.equal(st.auto, true);
  assert.equal(st.log, true);
  const ok = Y.withLog(Y.withManual(Y.createState(), { min: 10, max: 50 }), true);
  assert.equal(ok.auto, false, "양수 범위는 유지");
});

test("resolveRange: 수동 범위가 깨졌으면(최대<=최소) 자동으로", () => {
  const st = { auto: false, log: false, min: 5, max: 5 };
  assert.equal(Y.resolveRange(st, 1, 2, 0).auto, true);
});

test("hitPriceAxis", () => {
  const g = { plotRight: 800, axisEnd: 860, top: 28, height: 300 };
  assert.equal(Y.hitPriceAxis(820, 100, g), true);
  assert.equal(Y.hitPriceAxis(790, 100, g), false, "플롯 본문");
  assert.equal(Y.hitPriceAxis(820, 400, g), false, "보조 패널 높이");
  assert.equal(Y.hitPriceAxis(870, 100, g), false, "SVG 밖");
});

// ---- 시나리오: 드래그 확대 → 팬 → 더블클릭 복귀 ----
test("시나리오: 축 드래그 확대 후 팬, 자동 복귀 시 원래 범위", () => {
  let st = Y.createState();
  const auto = Y.resolveRange(st, 100, 200, 0);
  const start = { min: auto.min, max: auto.max };
  const zoomed = Y.zoomRange(start, Y.dragZoomFactor(-150, 300), (start.min + start.max) / 2, false, start);
  assert.ok(zoomed.max - zoomed.min < 100, "위로 끌면 확대");
  st = Y.withManual(st, zoomed);
  const panned = Y.panRange(zoomed, 40, 300, false);
  st = Y.withManual(st, panned);
  const shown = Y.resolveRange(st, 100, 200, 0);
  assert.equal(shown.auto, false);
  near(shown.max - shown.min, zoomed.max - zoomed.min, 1e-9, "팬은 폭 유지");
  st = Y.withAuto(st);
  const back = Y.resolveRange(st, 100, 200, 0);
  assert.deepEqual([back.min, back.max, back.auto], [100, 200, true]);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log(`OK chart-yscale-core: ${passed} tests`);
