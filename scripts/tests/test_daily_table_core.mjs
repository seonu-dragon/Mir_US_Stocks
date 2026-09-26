// 일별 시세 표 순수 계산(daily-table-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_daily_table_core.mjs   (CI 의 "Daily price table tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const D = require("../../daily-table-core.js");

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

const rows = [
  { o: 27000, h: 27800, l: 26900, c: 27600, v: 1000, d: "2026-09-22" },
  { o: 27600, h: 28700, l: 27500, c: 28600, v: 2000, d: "2026-09-23" },
  { o: 28600, h: 28600, l: 27900, c: 28000, v: 0, d: "2026-09-24" },
  { o: 28000, h: 28100, l: 27900, c: 28000, v: 1500, d: "2026-09-25" },
];

test("최근일부터, 전일대비는 바로 앞 봉 종가 기준", () => {
  const out = D.buildDailyRows(rows, 20);
  assert.deepEqual(out.map((r) => r.d), ["2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22"]);
  assert.equal(out[2].change, 1000);
  near(out[2].pct, 3.6232, 1e-3);
  assert.equal(out[1].change, -600);
  assert.equal(out[0].change, 0);
  assert.equal(out[3].change, null, "가장 오래된 행은 앞 봉이 없다");
  assert.equal(out[1].v, null, "거래량 0 은 없음으로");
});

test("limit 개만, 잘려도 맨 끝 행의 전일대비는 계산된다", () => {
  const out = D.buildDailyRows(rows, 2);
  assert.equal(out.length, 2);
  assert.equal(out[1].d, "2026-09-24");
  assert.equal(out[1].change, -600);
});

test("종가 없는 행은 건너뛴다(앞 봉 = 유효한 직전 봉)", () => {
  const out = D.buildDailyRows([rows[0], { c: null, d: "x" }, rows[1]], 5);
  assert.equal(out.length, 2);
  assert.equal(out[0].change, 1000);
});

test("fmtChange: 네이버식 ▲1,000(+3.62%) · ▼ · 보합 · 없음", () => {
  assert.deepEqual(D.fmtChange(1000, 3.6232, true), { text: "▲1,000(+3.62%)", dir: "up" });
  assert.deepEqual(D.fmtChange(-600, -2.0979, true), { text: "▼600(−2.10%)", dir: "down" });
  assert.deepEqual(D.fmtChange(0, 0, true), { text: "0(0.00%)", dir: "flat" });
  assert.deepEqual(D.fmtChange(null, null, true), { text: "—", dir: "" });
  assert.deepEqual(D.fmtChange(1.234, 0.8511, false), { text: "▲1.23(+0.85%)", dir: "up" });
  assert.deepEqual(D.fmtChange(0.49, 0.22, false), { text: "▲0.49(+0.22%)", dir: "up" });
  assert.deepEqual(D.fmtChange(-0.0042, -1.5, false), { text: "▼0.0042(−1.50%)", dir: "down" });
});

test("fmtPrice·fmtVolume·fmtDate", () => {
  assert.equal(D.fmtPrice(27600, true), "27,600");
  assert.equal(D.fmtPrice(1234.5, false), "$1,234.50");
  assert.equal(D.fmtPrice(0.5123, false), "$0.5123");
  assert.equal(D.fmtPrice(null, true), "—");
  assert.equal(D.fmtVolume(11397775), "11,397,775");
  assert.equal(D.fmtVolume(0), "—");
  assert.equal(D.fmtDate("2026-09-25"), "2026.09.25");
  assert.equal(D.fmtDateShort("2026-09-25"), "26.09.25");
  assert.equal(D.fmtDate(""), "—");
});

if (failures.length) {
  console.error(`daily-table-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`daily-table-core: ${passed} 통과`);
