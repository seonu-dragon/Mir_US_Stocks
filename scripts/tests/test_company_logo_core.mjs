// 회사 로고 순수 로직(company-logo-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_company_logo_core.mjs   (CI 의 "Company logo core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../company-logo-core.js");

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

const idx = { markets: { us: { tickers: "AAPL MSFT BRK-B" }, kr: { tickers: "005930 000660" } } };

test("시장 판정: 6자리 코드는 kr, 나머지는 us", () => {
  assert.equal(core.marketOf("005930"), "kr");
  assert.equal(core.marketOf("005930.KS"), "kr");
  assert.equal(core.marketOf("AAPL"), "us");
  assert.equal(core.marketOf("AAPL", "kr"), "kr");
});

test("로고 경로: 인덱스에 있으면 경로, 없으면 null", () => {
  assert.equal(core.logoPath(idx, "AAPL"), "data/logos/us/AAPL.webp");
  assert.equal(core.logoPath(idx, "aapl"), "data/logos/us/AAPL.webp");
  assert.equal(core.logoPath(idx, "BRK-B"), "data/logos/us/BRK-B.webp");
  assert.equal(core.logoPath(idx, "TSLA"), null);
  assert.equal(core.logoPath(idx, "000660.KS"), "data/logos/kr/000660.webp");
  assert.equal(core.logoPath(idx, "035720"), null);
});

test("국내 우선주는 보통주 로고로", () => {
  assert.equal(core.logoPath(idx, "005935"), "data/logos/kr/005930.webp");
  assert.equal(core.logoPath(idx, "000665"), "data/logos/kr/000660.webp");
  assert.equal(core.logoPath(idx, "035725"), null);
});

test("인덱스 없음·깨진 입력은 null(요청하지 않음)", () => {
  assert.equal(core.logoPath(null, "AAPL"), null);
  assert.equal(core.logoPath({}, "AAPL"), null);
  assert.equal(core.logoPath(idx, ""), null);
  assert.equal(core.logoPath(idx, "../x"), null);
  assert.equal(core.logoPath({ markets: { us: { tickers: "../x" } } }, "../x"), null);
});

test("배열 형식 인덱스도 받는다", () => {
  assert.equal(core.logoPath({ markets: { us: { tickers: ["NVDA"] } } }, "NVDA"), "data/logos/us/NVDA.webp");
});

test("모노그램 글자: 법인 표기 제거·영문 대문자·티커 폴백", () => {
  assert.equal(core.monogramChar("(주)카카오", "035720"), "카");
  assert.equal(core.monogramChar("㈜한화", "000880"), "한");
  assert.equal(core.monogramChar("주식회사 LG", "003550"), "L");
  assert.equal(core.monogramChar("apple inc.", "AAPL"), "A");
  assert.equal(core.monogramChar("", "nvda"), "N");
  assert.equal(core.monogramChar("", ""), "·");
  assert.equal(core.monogramChar("3M Co", "MMM"), "3");
});

test("팔레트 번호: 결정적이고 범위 안", () => {
  const a = core.monoIndex("삼성전자");
  assert.equal(a, core.monoIndex("삼성전자"));
  for (const k of ["A", "B", "Apple", "카카오", "", "zzzz"]) {
    const i = core.monoIndex(k);
    assert.ok(Number.isInteger(i) && i >= 0 && i < core.MONO_COLORS, `${k} → ${i}`);
  }
  const seen = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map(core.monoIndex));
  assert.ok(seen.size >= 3, "여러 이름이 한 색으로 몰리면 안 된다");
});

if (failures.length) {
  console.error(`Company logo core tests: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
console.log(`Company logo core tests: ${passed} passed`);
