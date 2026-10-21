// 가격 차트 도구 순수 계산(chart-tools-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_chart_tools_core.mjs   (CI 의 "Chart tools core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const T = require("../../chart-tools-core.js");

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

// ---- 기하 ----
test("distToSegment: 선분 안·밖·끝점", () => {
  near(T.distToSegment(5, 3, 0, 0, 10, 0, false), 3, 1e-9);
  near(T.distToSegment(15, 0, 0, 0, 10, 0, false), 5, 1e-9, "선분 끝 너머는 끝점까지");
  near(T.distToSegment(15, 0, 0, 0, 10, 0, true), 0, 1e-9, "반직선은 끝 너머도 선 위");
  near(T.distToSegment(-5, 0, 0, 0, 10, 0, true), 5, 1e-9, "반직선 시작점 뒤쪽은 시작점까지");
  near(T.distToSegment(3, 4, 0, 0, 0, 0, false), 5, 1e-9, "길이 0 선분 = 점");
});

test("rayEnd: 오른쪽 위로 가는 반직선은 먼저 닿는 가장자리에서 멈춘다", () => {
  const box = { left: 0, right: 100, top: 0, bottom: 100 };
  const e = T.rayEnd(10, 90, 20, 80, box); // 기울기 -1 → x=100 에선 y=0, 동시에 닿음
  near(e.x, 100, 1e-9);
  near(e.y, 0, 1e-9);
  const f = T.rayEnd(10, 50, 20, 50, box); // 수평
  near(f.x, 100, 1e-9);
  near(f.y, 50, 1e-9);
  const g = T.rayEnd(50, 50, 40, 50, box); // 왼쪽으로
  near(g.x, 0, 1e-9);
  const h = T.rayEnd(5, 5, 5, 5, box);
  assert.deepEqual(h, { x: 5, y: 5 }, "방향 없음");
  const k = T.rayEnd(10, 50, 200, 50, box); // p2 가 이미 상자 밖 → 줄이지 않는다
  near(k.x, 200, 1e-9);
});

test("hitTest: 가장 가까운 도형·허용 거리·겹치면 나중 것", () => {
  const shapes = [
    { type: "trend", x1: 0, y1: 0, x2: 100, y2: 0 },
    { type: "hline", x1: 0, y1: 50, x2: 0, y2: 50, left: 0, right: 200 },
    { type: "rect", x1: 120, y1: 10, x2: 160, y2: 40 },
  ];
  assert.equal(T.hitTest(shapes, 50, 3, 6), 0);
  assert.equal(T.hitTest(shapes, 150, 52, 6), 1, "수평선은 x 무관(플롯 안)");
  assert.equal(T.hitTest(shapes, 250, 50, 6), -1, "플롯 밖 수평선은 안 맞음");
  assert.equal(T.hitTest(shapes, 140, 25, 6), 2, "사각형 안쪽 클릭");
  assert.equal(T.hitTest(shapes, 140, 45, 6), 2, "사각형 가장자리 근처");
  assert.equal(T.hitTest(shapes, 50, 20, 6), -1, "허용 거리 밖");
  const dup = [{ type: "trend", x1: 0, y1: 0, x2: 10, y2: 0 }, { type: "trend", x1: 0, y1: 0, x2: 10, y2: 0 }];
  assert.equal(T.hitTest(dup, 5, 0, 6), 1, "같으면 위에 그려진(나중) 것");
});

test("hitTest: 피보는 레벨 선, 레이는 연장 구간까지", () => {
  const fib = { type: "fib", x1: 0, y1: 0, x2: 100, y2: 100, levels: [0, 38.2, 50, 61.8, 100] };
  assert.equal(T.hitTest([fib], 50, 49, 4), 0);
  assert.equal(T.hitTest([fib], 50, 25, 4), -1);
  const ray = { type: "ray", x1: 0, y1: 0, x2: 10, y2: 10 };
  assert.equal(T.hitTest([ray], 80, 80, 3), 0);
  assert.equal(T.hitTest([{ ...ray, type: "trend" }], 80, 80, 3), -1);
  assert.equal(T.shapeDistance({ type: "unknown" }, 0, 0), Infinity);
});

// ---- 자석 ----
test("snapToOhlc: 가까운 봉의 고가에 붙고, 멀면 그대로", () => {
  const bars = [{ o: 10, h: 12, l: 9, c: 11 }, { o: 11, h: 15, l: 10, c: 14 }, { o: 14, h: 16, l: 13, c: 13.5 }];
  const yOf = (p) => 200 - p * 10; // 가격 15 → y 50
  const s = T.snapToOhlc({ xn: 0.48, price: 14.8, y: 52 }, bars, yOf, 8);
  assert.equal(s.snapped, true);
  assert.equal(s.price, 15);
  near(s.xn, 0.5, 1e-9, "봉 가운데로 x 도 맞춘다");
  const far = { xn: 0.5, price: 20, y: 0 };
  assert.equal(T.snapToOhlc(far, bars, yOf, 8), far);
  assert.deepEqual(T.snapToOhlc({ xn: 0.5, price: 1, y: 1 }, [], yOf, 8), { xn: 0.5, price: 1, y: 1 });
  const custom = T.snapToOhlc({ xn: 1, price: 13.4, y: yOf(13.4) }, bars, yOf, 8, (i) => i / 4);
  near(custom.xn, 0.5, 1e-9, "오른쪽 여백이 있으면 chart.js 가 준 변환을 쓴다");
});

// ---- 실행취소 ----
test("pushUndo: 최근 20단계만", () => {
  let st = [];
  for (let i = 0; i < 25; i += 1) st = T.pushUndo(st, i);
  assert.equal(st.length, 20);
  assert.equal(st[0], 5);
  assert.equal(st[19], 24);
  assert.deepEqual(T.pushUndo([1, 2, 3], 4, 3), [2, 3, 4]);
});

test("validDrawing: 예전 저장분(trend/fib)과 새 종류, 깨진 항목 거름", () => {
  assert.ok(T.validDrawing({ type: "trend", t1: 1, p1: 2, t2: 3, p2: 4 }));
  assert.ok(T.validDrawing({ type: "fib", t1: 1, p1: 2, t2: 3, p2: 4 }));
  assert.ok(T.validDrawing({ type: "hline", t1: 1, p1: 2, t2: 1, p2: 2 }));
  assert.ok(T.validDrawing({ type: "ray", t1: 1, p1: 2, t2: 3, p2: 4 }));
  assert.ok(T.validDrawing({ type: "rect", t1: 1, p1: 2, t2: 3, p2: 4 }));
  assert.ok(!T.validDrawing({ type: "circle", t1: 1, p1: 2, t2: 3, p2: 4 }));
  assert.ok(!T.validDrawing({ type: "trend", t1: 1, p1: null, t2: 3, p2: 4 }));
  assert.ok(!T.validDrawing({ type: "trend", x1: 0.1, p1: 2, x2: 0.3, p2: 4 }), "화면비율 미리보기는 저장 안 함");
  assert.ok(!T.validDrawing(null));
});

// ---- 비교 겹쳐 보기 ----
test("compareOverlay: 첫 공통 봉 기준 수익률 → 메인 가격 공간", () => {
  const base = [{ c: 100 }, { c: 110 }, { c: 120 }, { c: 90 }];
  const cmp = [null, { c: 50 }, { c: 55 }, { c: 60 }];
  const r = T.compareOverlay(base, cmp);
  assert.deepEqual(r.pct.map((v) => (v == null ? null : Number(v.toFixed(6)))), [null, 0, 10, 20]);
  // 기준은 둘 다 값이 있는 첫 봉(인덱스 1) — 메인 110
  assert.deepEqual(r.prices.map((v) => (v == null ? null : Number(v.toFixed(6)))), [null, 110, 121, 132]);
  near(r.lastPct, 20, 1e-9);
  assert.equal(r.lastIdx, 3);
});

test("compareOverlay: 끝이 비면 마지막 유효값, 길이 다르면 빈 결과", () => {
  const r = T.compareOverlay([{ c: 10 }, { c: 11 }, { c: 12 }], [{ c: 5 }, { c: 4 }, null]);
  near(r.lastPct, -20, 1e-9);
  assert.equal(r.lastIdx, 1);
  const e = T.compareOverlay([{ c: 10 }], []);
  assert.equal(e.lastPct, null);
  assert.equal(e.lastIdx, -1);
  const z = T.compareOverlay([{ c: 10 }, { c: 0 }], [{ c: 0 }, { c: 3 }]);
  assert.equal(z.lastIdx, -1, "0 가격으론 기준을 잡지 않는다");
});

test("spreadLabels: 순서 유지·최소 간격·범위 안", () => {
  const ys = T.spreadLabels([100, 102, 50, 104], 16, 0, 200);
  assert.equal(ys[2], 50);
  assert.ok(ys[1] - ys[0] >= 16 - 1e-9 && ys[3] - ys[1] >= 16 - 1e-9, JSON.stringify(ys));
  const low = T.spreadLabels([195, 198, 199], 16, 0, 200);
  assert.equal(low[2], 200);
  assert.ok(low[0] <= 200 - 32 + 1e-9, JSON.stringify(low));
  const withNull = T.spreadLabels([null, 10], 16, 0, 100);
  assert.equal(withNull[0], null);
  assert.equal(withNull[1], 10);
});

test("spreadLabelsPinned: 현재가 태그는 그대로, 나머지만 비켜 놓는다", () => {
  const ys = T.spreadLabelsPinned([100, 104, 96, 150], 0, 16, 0, 200);
  assert.equal(ys[0], 100, "고정 라벨 불변");
  assert.ok(Math.abs(ys[1] - 100) >= 16 - 1e-9 && Math.abs(ys[2] - 100) >= 16 - 1e-9, JSON.stringify(ys));
  assert.ok(ys[2] < 100 && ys[1] > 100, "원래 위·아래 쪽 유지");
  assert.equal(ys[3], 150);
  // 현재가가 바닥 근처: 아래 자리가 없으면 위로 넘긴다
  const low = T.spreadLabelsPinned([195, 198, 199], 0, 16, 0, 200);
  assert.equal(low[0], 195);
  assert.ok(low.slice(1).every((y) => Math.abs(y - 195) >= 16 - 1e-9 && y >= 0 && y <= 200), JSON.stringify(low));
  // 고정 라벨이 없으면(null) 그냥 spreadLabels
  assert.deepEqual(T.spreadLabelsPinned([null, 10], 0, 16, 0, 100), [null, 10]);
});

test("editGrabAt: 손잡이 우선, 그다음 몸통, 멀면 null", () => {
  const tr = { type: "trend", x1: 0, y1: 0, x2: 100, y2: 0 };
  assert.deepEqual(T.editGrabAt(tr, 2, 1, 6), { kind: "handle", xs: "x1", ys: "y1" });
  assert.deepEqual(T.editGrabAt(tr, 99, 0, 6), { kind: "handle", xs: "x2", ys: "y2" });
  assert.deepEqual(T.editGrabAt(tr, 50, 3, 6), { kind: "body" });
  assert.equal(T.editGrabAt(tr, 50, 30, 6), null);
  const rc = { type: "rect", x1: 0, y1: 0, x2: 100, y2: 50 };
  assert.deepEqual(T.editGrabAt(rc, 1, 49, 6), { kind: "handle", xs: "x1", ys: "y2" });
  assert.deepEqual(T.editGrabAt(rc, 50, 25, 6), { kind: "body" }, "사각형 안쪽은 몸통");
  const hl = { type: "hline", x1: 10, y1: 40, x2: 10, y2: 40, left: 0, right: 200 };
  assert.deepEqual(T.editGrabAt(hl, 10, 41, 6), { kind: "body" }, "수평선은 손잡이 없이 몸통");
});

test("applyEditDrag: 몸통 평행 이동·손잡이 한 점·수평선 세로만", () => {
  const tr = { type: "trend", x1: 0, y1: 0, x2: 100, y2: 10 };
  const b = T.applyEditDrag(tr, { kind: "body" }, 5, -3);
  assert.deepEqual([b.x1, b.y1, b.x2, b.y2], [5, -3, 105, 7]);
  assert.deepEqual(b.changed, ["x1", "x2", "y1", "y2"]);
  const h = T.applyEditDrag(tr, { kind: "handle", xs: "x2", ys: "y2" }, 5, -3);
  assert.deepEqual([h.x1, h.y1, h.x2, h.y2], [0, 0, 105, 7]);
  assert.deepEqual(h.changed, ["x2", "y2"]);
  const hl = T.applyEditDrag({ type: "hline", x1: 10, y1: 40, x2: 10, y2: 40 }, { kind: "body" }, 50, 6);
  assert.deepEqual([hl.x1, hl.y1, hl.x2, hl.y2], [10, 46, 10, 46]);
  assert.deepEqual(hl.changed, ["y1", "y2"]);
  assert.deepEqual(T.applyEditDrag(tr, null, 1, 1).changed, []);
});

test("edgeOf: 범위 밖 방향", () => {
  assert.equal(T.edgeOf(120, 50, 100), "up");
  assert.equal(T.edgeOf(40, 50, 100), "down");
  assert.equal(T.edgeOf(70, 50, 100), "");
  assert.equal(T.edgeOf(null, 50, 100), "");
});

test("rightPadBars: 최소 2봉, 봉 수의 약 4%", () => {
  assert.equal(T.rightPadBars(1), 0);
  assert.equal(T.rightPadBars(22), 2);
  assert.equal(T.rightPadBars(252), 11);
});

test("shouldRefreshIntraday: 분봉 + 정규장 + 탭 보임일 때만", () => {
  const open = { state: "open" };
  assert.equal(T.shouldRefreshIntraday({ intraday: true, visible: true, session: open }), true);
  assert.equal(T.shouldRefreshIntraday({ intraday: false, visible: true, session: open }), false, "일봉");
  assert.equal(T.shouldRefreshIntraday({ intraday: true, visible: false, session: open }), false, "숨은 탭");
  assert.equal(T.shouldRefreshIntraday({ intraday: true, visible: true, session: { state: "post" } }), false, "장 마감");
  assert.equal(T.shouldRefreshIntraday({ intraday: true, visible: true, session: null }), false, "판정 불가");
});

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`chart-tools-core: ${failures.length} 실패 / ${passed} 통과`);
  process.exit(1);
}
console.log(`chart-tools-core: ${passed} 통과`);
