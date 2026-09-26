// 오늘 탭 지수 하루 차트 시간축(home-chart-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_home_chart_core.mjs   (CI 의 "Home chart core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../home-chart-core.js");

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

// KST 벽시계 → UTC ms
const kst = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 9, mi);

test("심볼 → 시장", () => {
  assert.equal(core.symbolMarket("^KS11"), "kr");
  assert.equal(core.symbolMarket("^GSPC"), "us");
  assert.equal(core.symbolMarket("BTC-USD"), "crypto");
  assert.equal(core.symbolMarket("KRW=X"), null);
});

test("zoneParts: 서머타임 ET 오프셋", () => {
  const z = core.zoneParts(Date.UTC(2026, 8, 25, 14, 0), "America/New_York");
  assert.equal(z.date, "2026-09-25");
  assert.equal(z.min, 10 * 60);
  assert.equal(z.offsetMin, -240);
  const w = core.zoneParts(Date.UTC(2026, 11, 1, 15, 0), "America/New_York");
  assert.equal(w.offsetMin, -300);
});

test("국내 장중·장 전·장 마감·주말", () => {
  assert.equal(core.sessionState("kr", kst(2026, 9, 22, 10, 7), []).state, "open");
  assert.equal(core.sessionState("kr", kst(2026, 9, 22, 8, 50), []).state, "pre");
  assert.equal(core.sessionState("kr", kst(2026, 9, 22, 15, 30), []).state, "post");
  assert.equal(core.sessionState("kr", kst(2026, 9, 26, 11, 0), []).state, "weekend");
});

test("달력 휴장·단축 거래", () => {
  const ev = [
    { date: "2026-10-05", market: "kr", kind: "holiday", name: "대체공휴일" },
    { date: "2026-11-27", market: "us", kind: "early_close", detail: "13:00 ET 폐장" },
  ];
  const h = core.sessionState("kr", kst(2026, 10, 5, 11, 0), ev);
  assert.equal(h.state, "holiday");
  assert.equal(h.holidayName, "대체공휴일");
  // 11-27 14:00 ET = 19:00 UTC(표준시)
  const e = core.sessionState("us", Date.UTC(2026, 10, 27, 19, 0), ev);
  assert.equal(e.close, 13 * 60);
  assert.equal(e.state, "post");
});

test("장중 시리즈는 개장 + 5분 간격", () => {
  const s = core.sessionState("kr", kst(2026, 9, 22, 9, 12), []);
  const r = core.placeSeries([1, 2, 3], s);
  assert.equal(r.kind, "live");
  assert.deepEqual(r.points.map((p) => p.t), [540, 545, 550]);
});

test("장중인데 봉이 너무 많으면 직전 거래일", () => {
  const s = core.sessionState("us", Date.UTC(2026, 8, 25, 13, 40), []); // 09:40 ET
  const vals = Array.from({ length: 79 }, (_, i) => 100 + i);
  const r = core.placeSeries(vals, s);
  assert.equal(r.kind, "prev");
  assert.equal(r.points[r.points.length - 1].t, 16 * 60);
});

test("끝난 국내 세션: 14:55 봉 뒤 15:30 종가를 점선으로 잇는다", () => {
  const s = core.sessionState("kr", kst(2026, 9, 23, 16, 0), []);
  const vals = Array.from({ length: 73 }, (_, i) => 7000 + i);
  const r = core.placeSeries(vals, s);
  assert.equal(r.kind, "post");
  const pts = r.points;
  assert.equal(pts[71].t, 14 * 60 + 55);
  assert.equal(pts[72].t, 15 * 60 + 30);
  assert.equal(pts[72].bridged, true);
  assert.equal(pts[71].bridged, false);
});

test("끝난 미국 세션: 15:55 봉 뒤 16:00 종가는 이어진 선", () => {
  const s = core.sessionState("us", Date.UTC(2026, 8, 26, 15, 0), []); // 토요일
  const r = core.placeSeries(Array.from({ length: 79 }, () => 1), s);
  assert.equal(r.kind, "weekend");
  assert.equal(r.points[78].t, 960);
  assert.equal(r.points[78].bridged, false);
});

test("코인은 24시간", () => {
  const s = core.sessionState("crypto", Date.UTC(2026, 8, 26, 15, 0), []);
  assert.equal(s.state, "open");
  const r = core.placeSeries([1, 2, 3, 4], s);
  assert.equal(r.kind, "live");
  assert.equal(r.points[3].t, 15);
});

test("눈금", () => {
  assert.deepEqual(core.timeTicks(570, 960, 60), [600, 660, 720, 780, 840, 900, 960]);
  assert.equal(core.fmtMin(570), "09:30");
  assert.equal(core.fmtMin(1440 + 60), "01:00");
  const { ticks, step } = core.valueTicks(7003, 7178, 4);
  assert.equal(step, 50);
  assert.deepEqual(ticks, [7050, 7100, 7150]);
});

if (failures.length) {
  console.error(`Home chart core tests: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
console.log(`Home chart core tests: ${passed} passed`);
