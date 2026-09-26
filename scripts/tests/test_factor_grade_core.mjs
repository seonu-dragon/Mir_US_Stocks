// 업종 상대 팩터 등급(factor-grade-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_factor_grade_core.mjs   (CI 의 "Factor grade tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../factor-grade-core.js");

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
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

function mk(n, industry, sector, fn) {
  return Array.from({ length: n }, (_, i) => ({ ticker: `${industry}${i}`, industry, sector, ...fn(i) }));
}
const byKey = (res, key) => res.factors.find((f) => f.key === key);

test("opts.clip: 백분위는 윈저라이즈 값으로, 화면 value 는 원자료", () => {
  // 20종목 ROE 1~19 + 3948(자본 극소). clip 으로 300 에 눌러도 순위는 그대로(맨 위 동점 없음) — 값은 원자료로 보인다.
  const stocks = [...mk(19, "X", "S", (i) => ({ roe: i + 1 })), { ticker: "CL", industry: "X", sector: "S", roe: 3948.15 }];
  const idx = core.createGradeIndex(stocks, { clip: (k, v) => (k === "roe" ? Math.min(v, 300) : v) });
  const cl = byKey(idx.gradesFor("CL"), "profit");
  const m = cl.metrics.find((x) => x.key === "roe");
  assert.equal(m.value, 3948.15);
  assert.equal(m.clipped, true);
  assert.equal(cl.grade, "A");
  const other = byKey(idx.gradesFor("X18"), "profit").metrics.find((x) => x.key === "roe");
  assert.equal(other.clipped, false);
});

test("gradeLetter 경계", () => {
  assert.equal(core.gradeLetter(100), "A");
  assert.equal(core.gradeLetter(80), "A");
  assert.equal(core.gradeLetter(79.9), "B");
  assert.equal(core.gradeLetter(60), "B");
  assert.equal(core.gradeLetter(40), "C");
  assert.equal(core.gradeLetter(20), "D");
  assert.equal(core.gradeLetter(19.99), "F");
  assert.equal(core.gradeLetter(0), "F");
  assert.equal(core.gradeLetter(null), null);
});

test("percentileOf: 동점 가운데 · 표본 부족 null", () => {
  assert.equal(core.percentileOf([1, 2, 3], 1), 0);
  assert.equal(core.percentileOf([1, 2, 3], 3), 100);
  assert.equal(core.percentileOf([1, 2, 2, 3], 2), 50);
  assert.equal(core.percentileOf([5], 5), null);
});

test("같은 업종 안에서만 비교: ROE 높은 종목이 수익성 A, 낮은 종목이 F", () => {
  // 업종 X 는 ROE 1~20, 업종 Y 는 ROE 100~119 — 섞이면 X 는 전부 F 가 된다.
  const stocks = [
    ...mk(20, "X", "S", (i) => ({ roe: i + 1 })),
    ...mk(20, "Y", "S", (i) => ({ roe: 100 + i })),
  ];
  const idx = core.createGradeIndex(stocks);
  const top = byKey(idx.gradesFor("X19"), "profit");
  assert.equal(top.status, "ok");
  assert.equal(top.grade, "A");
  assert.equal(top.level, "industry");
  assert.equal(top.group, "X");
  assert.equal(top.n, 20);
  assert.equal(top.rank, 1);
  assert.equal(byKey(idx.gradesFor("X0"), "profit").grade, "F");
  assert.equal(byKey(idx.gradesFor("Y0"), "profit").grade, "F"); // Y 안에선 꼴찌
});

test("작을수록 좋은 지표(PER): 낮은 PER 이 밸류 상위, 0 이하 PER 은 결측", () => {
  const stocks = mk(12, "X", "S", (i) => ({ pe: i === 11 ? -5 : 5 + i }));
  const idx = core.createGradeIndex(stocks);
  const cheap = byKey(idx.gradesFor("X0"), "value");
  assert.equal(cheap.grade, "A");
  assert.equal(cheap.n, 11); // 적자 PER 종목은 빠진다
  const loss = byKey(idx.gradesFor("X11"), "value");
  assert.equal(loss.status, "nodata");
});

test("업종 표본 < 10 이면 섹터로 올린다(escalatedFrom 기록)", () => {
  const stocks = [
    ...mk(4, "Small", "S", (i) => ({ roe: 50 + i })),
    ...mk(20, "Big", "S", (i) => ({ roe: i })),
  ];
  const g = byKey(core.createGradeIndex(stocks).gradesFor("Small3"), "profit");
  assert.equal(g.status, "ok");
  assert.equal(g.level, "sector");
  assert.equal(g.group, "S");
  assert.equal(g.n, 24);
  assert.deepEqual(g.escalatedFrom, { level: "industry", key: "Small", n: 0, eligible: 4 }); // 값 4개 < 지표 최소 5 → 합성 0개
  assert.equal(g.grade, "A");
});

test("섹터도 < 10 이면 등급 보류(held) + 이유", () => {
  const stocks = mk(6, "Tiny", "T", (i) => ({ roe: i }));
  const g = byKey(core.createGradeIndex(stocks).gradesFor("Tiny0"), "profit");
  assert.equal(g.status, "held");
  assert.match(g.reason, /표본이 부족/);
  assert.match(g.reason, /최소 10개/);
});

test("구성 지표 값이 하나도 없으면 nodata(0 으로 채우지 않는다)", () => {
  const stocks = mk(15, "X", "S", (i) => (i === 3 ? {} : { roe: i }));
  const g = byKey(core.createGradeIndex(stocks).gradesFor("X3"), "profit");
  assert.equal(g.status, "nodata");
});

test("합성 = 구성 지표 백분위 평균을 다시 집단 안 백분위로", () => {
  // roe 와 netMargin 이 반대 방향이면 합성이 모두 같아진다 → 전원 동점 = 50.
  const stocks = mk(11, "X", "S", (i) => ({ roe: i, netMargin: 10 - i }));
  const g = byKey(core.createGradeIndex(stocks).gradesFor("X0"), "profit");
  near(g.composite, 50);
  near(g.pct, 50);
  assert.equal(g.grade, "C");
  assert.equal(g.rank, 1); // 동점은 같은 순위
  const roeMetric = g.metrics.find((m) => m.key === "roe");
  assert.equal(roeMetric.pct, 0);
  assert.equal(roeMetric.n, 11);
});

test("집단 안 표본 < 5 인 구성 지표는 합성에서 뺀다(usable=false)", () => {
  const stocks = mk(12, "X", "S", (i) => ({ roe: i, ...(i < 3 ? { roa: 100 - i } : {}) }));
  const g = byKey(core.createGradeIndex(stocks).gradesFor("X0"), "profit");
  const roa = g.metrics.find((m) => m.key === "roa");
  assert.equal(roa.usable, false);
  assert.equal(roa.pct, null);
  assert.equal(g.grade, "F"); // roe 꼴찌만 반영
});

test("exclude 로 ETF 제외 · 제외 종목 조회는 excluded", () => {
  const stocks = [...mk(12, "X", "S", (i) => ({ roe: i })), { ticker: "ETF1", industry: "X", sector: "S", roe: 999, etf: true }];
  const idx = core.createGradeIndex(stocks, { exclude: (s) => s.etf });
  assert.equal(byKey(idx.gradesFor("X11"), "profit").n, 12);
  assert.equal(idx.gradesFor({ ticker: "ETF1" }).excluded, true);
});

test("metricAvailable 로 시장에 없는 지표를 뺀다 · 지표가 없으면 nodata", () => {
  const stocks = mk(12, "X", "S", (i) => ({ debtRatio: i, currentRatio: i }));
  const idx = core.createGradeIndex(stocks, { metricAvailable: (k) => k !== "debtRatio" });
  const h = byKey(idx.gradesFor("X11"), "health");
  assert.deepEqual(h.metrics.map((m) => m.key), ["currentRatio"]);
  assert.equal(h.grade, "A");
  const idx2 = core.createGradeIndex(stocks, { metricAvailable: () => false });
  assert.equal(byKey(idx2.gradesFor("X1"), "health").status, "nodata");
});

test("get 콜백: Infinity · 문자열 결측 처리", () => {
  const stocks = mk(12, "X", "S", (i) => ({ raw: i === 0 ? Infinity : i }));
  const idx = core.createGradeIndex(stocks, { get: (s, k) => (k === "roe" ? s.raw : null) });
  assert.equal(byKey(idx.gradesFor("X0"), "profit").status, "nodata");
  assert.equal(byKey(idx.gradesFor("X1"), "profit").n, 11);
});

// ---------- 검증 요약 ----------
const FV = {
  factors: { mom_3m: { label: "3개월 모멘텀" }, high52_prox: { label: "52주 신고가 근접" } },
  markets: {
    us: {
      sample: { tickers: 400, firstEvalDate: "2022-09-29", lastEvalDate: "2026-09-11" },
      horizons: {
        5: { factors: { mom_3m: { validated: false }, high52_prox: { validated: true } } },
        20: { factors: { mom_3m: { validated: false }, high52_prox: { validated: false } } },
        60: { factors: { mom_3m: { validated: false }, high52_prox: { validated: false } } },
      },
    },
    kr: {
      sample: { tickers: 400, firstEvalDate: "2022-10-11", lastEvalDate: "2026-09-07" },
      horizons: {
        5: { factors: { mom_3m: { validated: false }, high52_prox: { validated: false } } },
        20: { factors: { mom_3m: { validated: false }, high52_prox: { validated: false } } },
      },
    },
  },
};

test("validationSummary: 부분 통과 · 전부 미통과 · 검증 대상 아님 · 파일 없음", () => {
  const us = core.validationSummary(FV, "us", ["mom_3m", "high52_prox"]);
  assert.equal(us.tested, true);
  assert.equal(us.validatedAny, true);
  assert.match(us.text, /3개월 모멘텀 1주·1개월·3개월 모두 미통과/);
  assert.match(us.text, /52주 신고가 근접 1주만 통과/);
  assert.match(us.text, /US 400종목, 2022-09~2026-09/);
  assert.match(us.text, /업종 상대 등급 자체는 검증하지 않았습니다/);
  const kr = core.validationSummary(FV, "kr", ["mom_3m"]);
  assert.equal(kr.validatedAny, false);
  assert.match(kr.text, /예측력이 확인되지 않았습니다/);
  const none = core.validationSummary(FV, "us", []);
  assert.equal(none.tested, false);
  assert.match(none.text, /검증 대상이 아닌/);
  assert.match(core.validationSummary(null, "us", ["mom_3m"]).text, /불러오지 못했습니다/);
});

test("모멘텀만 검증 키를 가진다(나머지는 검증 대상 아님으로 표시)", () => {
  const keys = Object.fromEntries(core.FACTORS.map((f) => [f.key, f.validation]));
  assert.deepEqual(keys.momentum, ["mom_3m", "high52_prox"]);
  ["value", "growth", "profit", "health"].forEach((k) => assert.deepEqual(keys[k], []));
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`factor-grade-core: ${passed} passed`);
