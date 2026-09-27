// 사업부문·지역별 매출 순수 계산(segments-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_segments_core.mjs   (CI 의 "Segments core tests" 스텝)
// 입력은 build_segments_us.py 스키마 1 모양의 손으로 만든 최소 파일(숫자는 계산 검증용).
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../segments-core.js");

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
const near = (a, b, eps, msg) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

function file(years, extra) {
  return {
    schema: 1, ticker: "TST", currency: "USD",
    axes: {
      segment: Object.assign({
        concept: "Revenues",
        members: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
        years, check: "ok", dropped: [],
      }, extra || {}),
    },
  };
}

const Y = [
  { fy: 2021, sum: 100, total: 100, v: { a: 50, b: 30, c: 20 } },
  { fy: 2022, sum: 110, total: 110, v: { a: 55, b: 35, c: 20 } },
  { fy: 2023, sum: 120, total: 120, v: { a: 60, b: 40, c: 20 } },
  { fy: 2024, sum: 150, total: 150, v: { a: 80, b: 50, c: 20 } },
];

test("비중·전년비·3년 연평균", () => {
  const v = core.axisView(file(Y), "segment");
  assert.equal(v.latestFy, 2024);
  const a = v.rows.find((r) => r.id === "a");
  near(a.share, 80 / 150, 1e-9, "비중");
  near(a.yoy, 80 / 60 - 1, 1e-9, "전년비");
  near(a.cagr3, Math.pow(80 / 50, 1 / 3) - 1, 1e-9, "3년 연평균");
  near(v.totalRow.yoy, 150 / 120 - 1, 1e-9, "합계 전년비");
  assert.equal(v.check, "ok");
  assert.equal(core.checkNote(v), null);
});

test("연도 건너뜀이면 전년비 없음", () => {
  const v = core.axisView(file([Y[0], Y[3]]), "segment");
  const a = v.rows.find((r) => r.id === "a");
  assert.equal(a.yoy, null);
  near(a.cagr3, Math.pow(80 / 50, 1 / 3) - 1, 1e-9);
});

test("음수·결측은 성장률 없음", () => {
  const ys = [{ fy: 2023, sum: 100, v: { a: -5, b: 105 } }, { fy: 2024, sum: 100, v: { a: 10, b: 90 } }];
  const v = core.axisView(file(ys, { members: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }), "segment");
  assert.equal(v.rows.find((r) => r.id === "a").yoy, null);
  assert.equal(v.check, "noTotal");
  assert.ok(core.checkNote(v).includes("대조하지 못했"));
});

test("멤버가 많으면 상위 + 기타 묶음(성장률 없음)", () => {
  const ids = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"];
  const mk = (base) => Object.fromEntries(ids.map((id, i) => [id, base * (10 - i)]));
  const tot = (b) => b * 54;   // 10+9+…+2
  const ys = [{ fy: 2023, sum: tot(10), total: tot(10), v: mk(10) }, { fy: 2024, sum: tot(12), total: tot(12), v: mk(12) }];
  const v = core.axisView(file(ys, { members: ids.map((id) => ({ id, label: id.toUpperCase() })) }), "segment", { maxMembers: 5 });
  assert.equal(v.members.length, 5);
  const other = v.members[4];
  assert.ok(other.other && other.ids.length === 5 && other.label.includes("5개"));
  const last = v.bars[v.bars.length - 1];
  assert.equal(last.v.__other__, 12 * (6 + 5 + 4 + 3 + 2));
  assert.equal(v.rows[4].yoy, null);
  near(v.rows.reduce((s, r) => s + r.share, 0), 1, 1e-9, "비중 합 100%");
});

test("합계 불일치 문장(합 > 총매출)", () => {
  const ys = [{ fy: 2024, sum: 130, total: 100, v: { a: 80, b: 50 } }];
  const v = core.axisView(file(ys, { check: "mismatch", members: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }), "segment");
  assert.equal(v.check, "mismatch");
  near(v.gap, 0.3, 1e-9);
  const note = core.checkNote(v);
  assert.ok(note.includes("+30.0%") && note.includes("사업부문"), note);
});

test("축 순서·없는 축", () => {
  const f = file(Y);
  f.axes.geo = { members: [{ id: "us", label: "미국" }], years: [{ fy: 2024, sum: 1, v: { us: 1 } }] };
  f.axes.product = { members: [], years: [] };
  assert.deepEqual(core.availableAxes(f), ["segment", "geo"]);
  assert.equal(core.axisView(f, "product"), null);
  assert.deepEqual(core.availableAxes(null), []);
});

if (failures.length) {
  console.error(`segments-core: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error("  ✕ " + f));
  process.exit(1);
}
console.log(`segments-core: ${passed} passed`);
