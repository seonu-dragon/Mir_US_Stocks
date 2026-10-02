// 월별 시즈널리티 순수 계산(seasonality-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_seasonality_core.mjs   (CI 의 "Seasonality core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const S = require("../../seasonality-core.js");

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

// 월말 종가만 의미가 있다 — 달마다 두 행(중간·월말)을 넣어 '마지막 행이 이긴다' 를 함께 본다.
function monthlyRows(startYm, closes) {
  const rows = [];
  let [y, m] = startYm.split("-").map(Number);
  for (const c of closes) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    rows.push({ c: c * 0.5, d: `${ym}-10` });
    rows.push({ c, d: `${ym}-25` });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return rows;
}

test("월말 종가: 같은 달은 마지막 행, 날짜 없는·합성 행은 버린다", () => {
  const ends = S.monthEndCloses([
    { c: 10, d: "2024-01-05" }, { c: 11, d: "2024-01-31" }, { c: 12, d: null },
    { c: 13, d: "2024-02-29", synthetic: true }, { c: 14, d: "2024-02-28" },
  ]);
  assert.deepEqual(ends.map((e) => [e.ym, e.c]), [["2024-01", 11], ["2024-02", 14]]);
});

test("월 수익률 = 월말 ÷ 전월말 − 1, 첫 달은 버린다", () => {
  // 2023-12 = 100 → 2024-01 = 110 (+10%) → 2024-02 = 99 (−10%)
  const r = S.compute(monthlyRows("2023-12", [100, 110, 99]), { asOf: "2024-03-15" });
  assert.equal(r.years.length, 1);
  const y = r.years[0];
  assert.equal(y.year, 2024);
  near(y.months[0].pct, 10, 1e-9, "1월");
  near(y.months[1].pct, -10, 1e-9, "2월");
  assert.equal(y.months[2], null);
  near(y.total, (1.1 * 0.9 - 1) * 100, 1e-9, "연 누적");
  assert.equal(r.firstMonth, "2024-01");
});

test("asOf 달은 진행 중 — 표에는 있지만 평균·상승 확률에서 빠진다", () => {
  // 2022-12..2024-03: 1월은 2023·2024 두 번, 3월은 2023(완료)·2024(진행 중)
  const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 90];
  const r = S.compute(monthlyRows("2022-12", closes), { asOf: "2024-03-20" });
  const y2024 = r.years.find((y) => y.year === 2024);
  assert.equal(y2024.months[2].partial, true);
  const mar = r.summary[2];
  assert.equal(mar.n, 1, "진행 중인 2024-03 은 표본이 아니다");
  assert.equal(mar.avg, null, "표본 1개는 minYears(2) 미만 → 요약 없음");
  const jan = r.summary[0];
  assert.equal(jan.n, 2);
  near(jan.winRate, 100, 1e-9);
  near(jan.avg, ((101 / 100 - 1) + (113 / 112 - 1)) / 2 * 100, 1e-9);
});

test("상승 확률·중앙값", () => {
  // 1월 수익률: +10, −5, +20 (3년)
  const rows = [
    { c: 100, d: "2020-12-31" }, { c: 110, d: "2021-01-29" },
    { c: 100, d: "2021-12-31" }, { c: 95, d: "2022-01-31" },
    { c: 100, d: "2022-12-30" }, { c: 120, d: "2023-01-31" },
  ];
  const r = S.compute(rows, { asOf: "2023-06-01" });
  const jan = r.summary[0];
  assert.equal(jan.n, 3);
  near(jan.winRate, 200 / 3, 1e-9);
  near(jan.median, 10, 1e-9);
  // 2021-12 → 2022-01 처럼 이어진 달만 센다. 2021-01 → 2021-12 는 11개월 공백이라 12월 수익률이 아니다.
  assert.equal(r.summary[11].n, 0);
});

test("달이 비면(거래정지) 그 구간은 버린다", () => {
  const r = S.compute([
    { c: 100, d: "2024-01-31" }, { c: 110, d: "2024-02-29" }, { c: 50, d: "2024-05-31" }, { c: 55, d: "2024-06-28" },
  ], { asOf: "2024-12-01" });
  const y = r.years[0];
  near(y.months[1].pct, 10, 1e-9);
  assert.equal(y.months[4], null, "2→5월 공백 구간은 5월 수익률이 아니다");
  near(y.months[5].pct, 10, 1e-9);
});

test("데이터가 부족하면 null", () => {
  assert.equal(S.compute([]), null);
  assert.equal(S.compute([{ c: 1, d: "2024-01-31" }, { c: 2, d: "2024-02-29" }]), null);
  assert.equal(S.compute(null), null);
});

test("표기·색 세기", () => {
  assert.equal(S.fmtPct(1.234), "+1.2");
  assert.equal(S.fmtPct(-0.04), "0.0");
  assert.equal(S.fmtPct(-3.25, 2), "-3.25");
  assert.equal(S.fmtPct(null), "—");
  assert.equal(S.heat(5, 10), 0.5);
  assert.equal(S.heat(-30, 10), 1);
  assert.equal(S.heat(null), 0);
});

if (failures.length) {
  console.error(`seasonality-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`seasonality-core: ${passed} 통과`);
