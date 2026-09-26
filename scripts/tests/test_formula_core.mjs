// 수식 스크리너 순수 계산(formula-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_formula_core.mjs   (CI 의 "Formula screener tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const core = require("../../formula-core.js");

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

const FIELDS = ["roe", "pe", "pb", "rsi14", "marketCap", "sector_x", "netMargin", "forwardPE"];
const opts = (extra = {}) => ({ fields: FIELDS, aliases: { per: "pe", pbr: "pb" }, ...extra });

function run(src, rows, extra = {}) {
  const c = core.compile(src, opts(extra));
  assert.ok(c.ok, `compile failed: ${c.error}`);
  return core.evaluate(c, rows, { group: (r, g) => r[g], ...extra.ctx });
}
const one = (src, row = {}) => run(src, [row])[0];

// ---------- 연산자 우선순위 ----------
test("곱셈이 덧셈보다 먼저", () => {
  assert.equal(one("1 + 2 * 3"), 7);
  assert.equal(one("(1 + 2) * 3"), 9);
  assert.equal(one("10 - 4 - 3"), 3); // 왼쪽 결합
  assert.equal(one("24 / 4 / 2"), 3);
  assert.equal(one("-2 * 3"), -6);
  assert.equal(one("- -2"), 2);
  assert.equal(one("2 * -3 + 1"), -5);
});

test("and 가 or 보다 먼저, not 은 비교 전체에 걸린다", () => {
  // true or (false and false) = true
  assert.equal(one("1 < 2 or 1 > 2 and 1 > 3"), true);
  // (true or false) and false = false
  assert.equal(one("(1 < 2 or 1 > 2) and 1 > 3"), false);
  assert.equal(one("not 1 > 2"), true);
  assert.equal(one("not 1 < 2 and 1 < 2"), false); // (not true) and true
  assert.equal(one("! (1 < 2)"), false);
  assert.equal(one("1 < 2 && 2 < 3 || 1 > 5"), true);
});

test("비교 연산자 전부", () => {
  const row = { roe: 15 };
  assert.equal(one("roe > 15", row), false);
  assert.equal(one("roe >= 15", row), true);
  assert.equal(one("roe < 15", row), false);
  assert.equal(one("roe <= 15", row), true);
  assert.equal(one("roe == 15", row), true);
  assert.equal(one("roe = 15", row), true);
  assert.equal(one("roe != 15", row), false);
  assert.equal(one("roe <> 16", row), true);
  assert.equal(one("roe ≥ 15 and roe ≤ 15", row), true);
});

test("괄호 중첩 · 소수 · 지수 표기", () => {
  assert.equal(one("((((1))))"), 1);
  assert.equal(one(".5 + 0.25"), 0.75);
  assert.equal(one("1e3 / 10"), 100);
});

test("대소문자 무시 · 별칭", () => {
  assert.equal(one("ROE > 10 AND Per < 20", { roe: 12, pe: 10 }), true);
  assert.equal(one("pbr", { pb: 1.2 }), 1.2);
  assert.equal(one("SECTORMEDIAN(pe)", { pe: 5, sector: "A" }), null); // 표본 1개 < 5
});

// ---------- 결측값 ----------
test("결측 필드는 조건 불충족(3값 논리)", () => {
  const rows = [{ roe: 20, pe: 10 }, { roe: 20 }, { pe: 10 }, {}];
  const c = core.compile("roe > 15 and pe < 20", opts());
  assert.deepEqual(core.evaluate(c, rows), [true, null, null, null]);
  assert.deepEqual(core.filterIndices(c, rows), [0]);
});

test("not(결측) 도 결측 — 결측 종목이 not 으로 통과하지 않는다", () => {
  const c = core.compile("not (pe < 10)", opts());
  assert.deepEqual(core.filterIndices(c, [{ pe: 5 }, { pe: 20 }, {}]), [1]);
});

test("or 는 한쪽이 참이면 참(다른 쪽 결측이어도)", () => {
  const c = core.compile("roe > 15 or pe < 10", opts());
  assert.deepEqual(core.evaluate(c, [{ roe: 20 }, { pe: 5 }, { roe: 1 }, { roe: 1, pe: 50 }]), [true, true, null, false]);
});

test("and 는 한쪽이 거짓이면 거짓(다른 쪽 결측이어도)", () => {
  const c = core.compile("roe > 15 and pe < 10", opts());
  assert.deepEqual(core.evaluate(c, [{ roe: 1 }]), [false]);
});

test("Infinity · NaN · 문자열 · 불리언 필드는 결측", () => {
  const c = core.compile("pe", opts());
  assert.deepEqual(core.evaluate(c, [{ pe: Infinity }, { pe: NaN }, { pe: "abc" }, { pe: "12.5" }, { pe: null }, { pe: true }]), [null, null, null, 12.5, null, null]);
});

test("산술에 결측이 섞이면 결측", () => {
  assert.equal(one("roe + 1", {}), null);
  assert.equal(one("abs(roe)", {}), null);
  assert.equal(one("min(roe, 5)", {}), null);
  assert.equal(one("-roe", {}), null);
});

// ---------- 0 나누기 ----------
test("0 으로 나누면 결측(Infinity 아님), 비교는 불충족", () => {
  assert.equal(one("roe / pe", { roe: 10, pe: 0 }), null);
  assert.equal(one("1 / 0"), null);
  assert.equal(one("roe / pe > 1", { roe: 10, pe: 0 }), null);
  assert.equal(one("roe / pe", { roe: 10, pe: 4 }), 2.5);
  assert.equal(one("0 / 5"), 0);
});

// ---------- 함수 ----------
test("abs · min · max · avg", () => {
  assert.equal(one("abs(-3)"), 3);
  assert.equal(one("min(3, 1, 2)"), 1);
  assert.equal(one("max(3, 1, 2)"), 3);
  assert.equal(one("avg(1, 2, 3)"), 2);
});

const SECTOR_ROWS = [
  { pe: 10, sector: "A", industry: "a1" },
  { pe: 20, sector: "A", industry: "a1" },
  { pe: 30, sector: "A", industry: "a1" },
  { pe: 40, sector: "A", industry: "a2" },
  { pe: 50, sector: "A", industry: "a2" },
  { pe: 5, sector: "B", industry: "b1" },
  { pe: null, sector: "A", industry: "a1" },
];

test("sectorMedian: 같은 섹터의 값 있는 종목만으로 중앙값", () => {
  const vals = run("sectorMedian(pe)", SECTOR_ROWS);
  assert.deepEqual(vals.slice(0, 5), [30, 30, 30, 30, 30]);
  assert.equal(vals[5], null); // B 섹터는 표본 1 < minGroup 5
  assert.equal(vals[6], 30); // 자기 값은 없어도 섹터 중앙값은 있다
});

test("pe < sectorMedian(pe): 결측 종목은 불충족", () => {
  const c = core.compile("pe < sectorMedian(pe)", opts());
  assert.deepEqual(core.filterIndices(c, SECTOR_ROWS, { group: (r, g) => r[g] }), [0, 1]);
});

test("sectorPct: 섹터 내 백분위 0~100, 동점은 가운데", () => {
  const vals = run("sectorPct(pe)", SECTOR_ROWS);
  assert.deepEqual(vals.slice(0, 5), [0, 25, 50, 75, 100]);
  assert.equal(vals[6], null); // 자기 값 결측
  const tie = run("sectorPct(pe)", [1, 2, 2, 2, 3].map((pe) => ({ pe, sector: "S" })));
  assert.deepEqual(tie, [0, 50, 50, 50, 100]);
});

test("minGroup 조정 · industryMedian", () => {
  const vals = run("industryMedian(pe)", SECTOR_ROWS, { ctx: { minGroup: 2 } });
  assert.equal(vals[0], 20); // a1: 10,20,30
  assert.equal(vals[3], 45); // a2: 40,50
  assert.equal(vals[5], null); // b1: 1개 < 2
});

test("그룹 이름이 없으면 그룹 집계는 결측", () => {
  const rows = [1, 2, 3, 4, 5, 6].map((pe) => ({ pe, sector: pe === 6 ? "" : "S" }));
  const vals = run("sectorMedian(pe)", rows);
  assert.equal(vals[0], 3);
  assert.equal(vals[5], null);
});

test("rank: 1 = 가장 큼, 동점 같은 순위 · pct · median(전체)", () => {
  const rows = [10, 30, 30, 20, null].map((roe) => ({ roe }));
  assert.deepEqual(run("rank(roe)", rows), [4, 1, 1, 3, null]);
  assert.deepEqual(run("pct(roe)", rows), [0, 83.33333333333334, 83.33333333333334, 33.33333333333333, null]);
  assert.deepEqual(run("median(roe)", rows), [25, 25, 25, 25, 25]);
  const c = core.compile("rank(roe) <= 2", opts());
  assert.deepEqual(core.filterIndices(c, rows), [1, 2]);
});

test("집계 안의 수식 · 중첩 집계", () => {
  const rows = [1, 2, 3, 4, 5].map((pe) => ({ pe, roe: pe * 2, sector: "S" }));
  assert.deepEqual(run("sectorMedian(roe / pe)", rows), [2, 2, 2, 2, 2]);
  assert.deepEqual(run("rank(sectorPct(pe))", rows), [5, 4, 3, 2, 1]);
});

test("사용자 예시: roe > 15 and pe < sectorMedian(pe) and rsi14 < 40", () => {
  const rows = [
    { roe: 20, pe: 8, rsi14: 35, sector: "T" },
    { roe: 20, pe: 8, rsi14: 45, sector: "T" },
    { roe: 10, pe: 8, rsi14: 35, sector: "T" },
    { roe: 20, pe: 30, rsi14: 35, sector: "T" },
    { roe: 20, pe: 12, sector: "T" },
    { roe: 20, pe: 25, rsi14: 20, sector: "T" },
  ];
  const c = core.compile("roe > 15 and pe < sectorMedian(pe) and rsi14 < 40", opts({ expect: "bool" }));
  assert.ok(c.ok, c.error);
  assert.deepEqual(c.fields.sort(), ["pe", "roe", "rsi14"]);
  assert.deepEqual(c.functions, ["sectorMedian"]);
  // 섹터 중앙값 = median(8,8,8,30,12,25) = 10
  assert.deepEqual(core.filterIndices(c, rows, { group: (r, g) => r[g] }), [0]);
});

// ---------- 오류 메시지 ----------
function err(src, extra = {}) {
  const c = core.compile(src, opts(extra));
  assert.equal(c.ok, false, `expected error for ${src}`);
  return c;
}

test("잘못된 필드명: 비슷한 필드 제안 + 위치", () => {
  const c = err("roee > 15");
  assert.match(c.error, /알 수 없는 필드 'roee'/);
  assert.match(c.error, /roe/);
  assert.equal(c.errorPos, 0);
  const c2 = err("roe > 1 and xyzzy < 3");
  assert.match(c2.error, /xyzzy/);
  assert.equal(c2.errorPos, 12);
  assert.match(c2.error, /13번째 글자/);
});

test("이 시장에 없는 필드는 이유를 말한다", () => {
  const c = err("debtRatio < 100", { unavailable: { debtratio: "이 시장 데이터에 없는 필드입니다(부채비율은 국내만)." } });
  assert.match(c.error, /국내만/);
});

test("알 수 없는 함수 · 함수 괄호 누락 · 인수 개수", () => {
  assert.match(err("sectormedain(pe) > 1").error, /알 수 없는 함수.*sectorMedian/);
  assert.match(err("rank > 3").error, /함수입니다/);
  assert.match(err("abs(1, 2) > 0").error, /인수가 1개/);
  assert.match(err("min(1) > 0").error, /2~8개/);
});

test("구문 오류: 괄호 · 연속 비교 · 빈 수식 · 끝이 잘림 · 이어 붙임", () => {
  assert.match(err("(roe > 1").error, /닫는 괄호/);
  assert.match(err("1 < roe < 5").error, /한 번에 하나/);
  assert.match(err("").error, /입력하세요/);
  assert.match(err("roe >").error, /값이 더 필요/);
  assert.match(err("roe > 15 pe < 3").error, /and \/ or/);
  assert.match(err("roe > 15%").error, /'%'/);
  assert.match(err("per이 > 3").error, /숫자|한글|글자/);
  assert.match(err("roe $ 3").error, /알 수 없는 문자/);
});

test("타입 오류: 조건과 숫자를 섞으면 막는다", () => {
  assert.match(err("roe > 15 + (pe < 3)").error, /숫자 값이어야/);
  assert.match(err("roe and pe").error, /조건/);
  assert.match(err("roe", { expect: "bool" }).error, /필터 수식은 조건/);
  assert.match(err("roe > 1", { expect: "num" }).error, /열 수식은 숫자/);
  const ok = core.compile("roe / pe", opts({ expect: "num" }));
  assert.ok(ok.ok);
});

test("너무 긴 수식 · 너무 깊은 중첩은 거부(스택 보호)", () => {
  assert.match(err("roe > 1 and ".repeat(80) + "roe > 1").error, /너무/);
  assert.match(err("(".repeat(60) + "1" + ")".repeat(60)).error, /너무/);
  assert.match(err("-".repeat(60) + "1").error, /너무/);
});

test("eval / new Function 을 쓰지 않는다(소스 검사)", () => {
  const src = readFileSync(new URL("../../formula-core.js", import.meta.url), "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/\beval\s*\(/.test(src), "eval( 사용");
  assert.ok(!/new\s+Function/.test(src), "new Function 사용");
});

// ---------- 공유 URL 인코딩 ----------
test("encodeState/decodeState 왕복(한글 열 이름 포함)", () => {
  const st = { f: "roe > 15 and pe < sectorMedian(pe)", c: [{ n: "이익 수익률", e: "100 / pe" }], s: "c0", d: 1 };
  const tok = core.encodeState(st);
  assert.match(tok, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(core.decodeState(tok), st);
  assert.equal(core.decodeState("%%%"), null);
  assert.equal(core.decodeState(""), null);
});

test("completionPrefix: 커서 앞 단어", () => {
  assert.deepEqual(core.completionPrefix("roe > 15 and se", 15), { prefix: "se", start: 13 });
  assert.deepEqual(core.completionPrefix("roe > ", 6), { prefix: "", start: 6 });
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`formula-core: ${passed} passed`);
