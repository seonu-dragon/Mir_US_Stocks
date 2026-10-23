// 시장 폭 추이 순수 함수(breadth-history-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_breadth_history_core.mjs   (CI 의 "Breadth history core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../breadth-history-core.js");

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

const rows = [];
for (let i = 0; i < 30; i += 1) {
  const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
  rows.push({ d, above50: 40 + i, above200: i < 5 ? null : 30, mcclellan: i - 15, nh: 10 + i, nl: 20 });
}
const P = { market: "us", universe: 2800, rows };

test("series 는 null 을 빼고 nhnl 은 nh − nl", () => {
  assert.equal(core.series(P, "above200").length, 25);
  assert.deepEqual(core.series(P, "nhnl")[0], { d: "2026-09-01", v: -10 });
  assert.deepEqual(core.series(null, "above50"), []);
  assert.deepEqual(core.series({ rows: [{ d: "2026-09-01", nh: 3 }] }, "nhnl"), []);
});

test("summary 는 21거래일 전 대비, 점이 적으면 첫 점 대비", () => {
  const s = core.summary(core.series(P, "above50"));
  assert.equal(s.v, 69);
  assert.equal(s.baseD, "2026-09-09");
  assert.equal(s.change, 21);
  assert.equal(core.summary(core.series(P, "above50").slice(0, 3)).change, 2);
  assert.equal(core.summary([]), null);
});

test("domain: pct 는 0~100, zero 는 ±최대 절댓값", () => {
  assert.deepEqual(core.domain([{ v: 30 }], "pct"), [0, 100]);
  assert.deepEqual(core.domain([{ v: -15 }, { v: 9 }], "zero"), [-15, 15]);
  assert.deepEqual(core.domain([{ v: 0 }], "zero"), [-1, 1]);
});

test("linePath 는 등간격·위가 큰 값·범위 밖은 잘림", () => {
  const pts = [{ v: 0 }, { v: 50 }, { v: 100 }, { v: 150 }];
  assert.equal(core.linePath(pts, 30, 10, [0, 100]), "M0.00 10.00 L10.00 5.00 L20.00 0.00 L30.00 0.00");
  assert.equal(core.linePath([{ v: 1 }], 30, 10, [0, 100]), "");
  assert.equal(core.baselineY("pct", 40, [0, 100]), 20);
  assert.equal(core.baselineY("zero", 40, [-10, 10]), 20);
});

test("표기", () => {
  assert.equal(core.fmtValue(36.24, "%"), "36.2%");
  assert.equal(core.fmtValue(-35, "개"), "-35개");
  assert.equal(core.fmtValue(1200, "개"), "+1,200개");
  assert.equal(core.fmtValue(25, ""), "+25.0");
  assert.equal(core.fmtChange(-3.25, "%"), "-3.3%p");
  assert.equal(core.fmtChange(0, ""), "0.0");
  assert.equal(core.shortDate("2026-10-21", "2026-10-21"), "10/21");
  assert.equal(core.shortDate("2025-10-21", "2026-10-21"), "25/10/21");
});

test("BPI 패널 이름은 지수 이름을 붙인다", () => {
  const def = core.PANELS.find((x) => x.key === "bpiIdx");
  assert.equal(core.panelLabel(def, { indexLabel: "S&P 500" }), "BPI · S&P 500");
  assert.equal(core.panelLabel(def, {}), "BPI");
  assert.equal(core.series({ rows: [{ d: "2026-10-01", bpiIdx: 48.7 }, { d: "2026-10-02" }] }, "bpiIdx").length, 1);
});

test("sectorRows: 최신값·1개월 변화·BPI, 50일선 위 높은 순", () => {
  const a50 = Array.from({ length: 30 }, (_, i) => 20 + i);
  const rows = core.sectorRows({ sectors: [
    { name: "ENERGY", n: 40, above50: a50, above200: [null, 50], bpi: 61.5 },
    { name: "TECH", n: 90, above50: [...a50.slice(0, 29), null].map((v) => (v === null ? null : v + 30)), above200: [], bpi: null },
  ] });
  assert.equal(rows[0].name, "TECH");
  assert.equal(rows[0].above50, 78);           // 끝의 null 은 건너뛰고 그 앞 값
  assert.equal(rows[0].chg50, 21);
  assert.equal(rows[1].above50, 49);
  assert.equal(rows[1].chg50, 21);
  assert.equal(rows[1].above200, 50);
  assert.equal(rows[1].chg200, null);          // 21거래일 전 값 없음
  assert.equal(rows[1].bpi, 61.5);
  assert.deepEqual(core.sectorRows(null), []);
});

if (failures.length) {
  console.error(`breadth-history-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`breadth-history-core: ${passed}개 통과`);
