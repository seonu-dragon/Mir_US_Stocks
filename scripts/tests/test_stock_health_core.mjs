// 종목 체력·유사종목·위험 순수 계산(stock-health-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_stock_health_core.mjs   (CI 의 "Stock health core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../stock-health-core.js");

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

test("상세 값이 지도 펀더멘털을 덮고, null 은 덮지 않는다", () => {
  const f = core.mergeFundamentals({ pe: 30, pb: 5, roe: 10 }, { pe: 12, pb: null });
  assert.deepEqual(f, { pe: 12, pb: 5, roe: 10 });
  assert.deepEqual(core.mergeFundamentals(null, undefined), {});
});

test("스노우플레이크: 통과 개수와 분모(판단 가능한 체크 수)", () => {
  const sf = core.computeSnowflake({ pe: 12, pb: 1.2, ps: 1.5, peg: 1.2 });
  // PER 15·25 미만 통과, PBR 1.5·3 미만 통과, PSR 2 미만 통과, PEG 1.5 미만 통과
  assert.deepEqual(sf.value, { pass: 6, ev: 6, score: 6 });
  // 성장: PEG<1 실패, PEG<1.5 통과, 예상 PER 없음·매출/이익 성장 없음 → 분모 2
  assert.deepEqual(sf.growth, { pass: 1, ev: 2, score: 1 });
  // 배당 값 없음 → 분모 0, 점수 null
  assert.deepEqual(sf.dividend, { pass: 0, ev: 0, score: null });
});

test("스노우플레이크: 적자(PER 음수)는 밸류 체크에서 빠진다", () => {
  const sf = core.computeSnowflake({ pe: -5, pb: 2 });
  assert.equal(sf.value.ev, 2);
  assert.equal(sf.value.pass, 1); // PBR 3 미만만 통과
});

test("부채비율·유동비율은 %로 와도 배수로 본다", () => {
  const a = core.computeSnowflake({ debtEq: 40, currentRatio: 180 });
  const b = core.computeSnowflake({ debtEq: 0.4, currentRatio: 1.8 });
  assert.deepEqual(a.health, b.health);
  assert.equal(a.health.pass, 4);
});

test("요약: 판단 가능한 축이 2개 미만이면 null, 합계는 30점 만점", () => {
  assert.equal(core.snowflakeSummary(core.computeSnowflake({ pe: 10 })), null);
  const s = core.snowflakeSummary(core.computeSnowflake({ pe: 10, roe: 20, roa: 6, netMargin: 12, eps: 3 }));
  assert.equal(s.max, 30);
  assert.equal(s.axes.length, 5);
  assert.deepEqual(s.axes.map((a) => a.label), ["밸류", "성장", "건전성", "과거성과", "배당"]);
  assert.equal(s.total, s.axes.reduce((t, a) => t + (a.score ?? 0), 0));
});

test("유사종목: 같은 산업군 3개 이상이면 산업군, 아니면 섹터 · 시총순 · 자기 제외", () => {
  const stocks = [
    { ticker: "A", industry: "칩", sector: "IT", marketCapB: 100 },
    { ticker: "B", industry: "칩", sector: "IT", marketCapB: 300 },
    { ticker: "C", industry: "칩", sector: "IT", marketCapB: 200 },
    { ticker: "D", industry: "칩", sector: "IT", marketCapB: 50 },
    { ticker: "E", industry: "SW", sector: "IT", marketCapB: 900 },
  ];
  const r = core.selectPeers(stocks, stocks[0], 6);
  assert.equal(r.basis, "같은 산업군");
  assert.deepEqual(r.peers.map((s) => s.ticker), ["B", "C", "D"]);
  const r2 = core.selectPeers(stocks, stocks[4], 2);
  assert.equal(r2.basis, "같은 섹터");
  assert.deepEqual(r2.peers.map((s) => s.ticker), ["B", "C"]);
  assert.equal(core.selectPeers(stocks, { ticker: "Z" }), null);
});

test("위험 통계: 60일 미만이면 null, 낙폭·월별 평균", () => {
  assert.equal(core.riskStats([{ c: 1 }]), null);
  const rows = [];
  // 1월 100 → 110 → 2월 55(반토막) … 상수 구간
  for (let i = 0; i < 30; i++) rows.push({ d: `2025-01-${String(i + 1).padStart(2, "0")}`, c: 100 + i * (10 / 29) });
  for (let i = 0; i < 40; i++) rows.push({ d: `2025-02-${String((i % 28) + 1).padStart(2, "0")}`, c: i === 0 ? 55 : 55 });
  const r = core.riskStats(rows);
  assert.equal(r.n, 70);
  assert.ok(Math.abs(r.mddPct - -50) < 1e-9, `mdd ${r.mddPct}`);
  assert.equal(r.oneYearPct, null);
  assert.equal(r.monthly.length, 12);
  assert.equal(r.monthly[2], null); // 3월 표본 없음
  assert.ok(r.monthly[0] > 0 && r.monthly[1] < 0);
  assert.equal(r.from, "2025-01-01");
});

test("위험 통계: 종가 0·결측 행은 건너뛰고 날짜 정렬이 어긋나지 않는다", () => {
  const rows = [];
  for (let i = 0; i < 70; i++) rows.push({ d: `2025-03-${String((i % 28) + 1).padStart(2, "0")}`, c: 100 });
  rows.splice(10, 0, { d: "2025-04-01", c: 0 }, { d: "2025-04-02", c: null });
  const r = core.riskStats(rows);
  assert.equal(r.n, 70);
  assert.equal(r.volPct, 0);
  assert.equal(r.monthly[3], null); // 무효 행의 4월은 들어가지 않는다
});

console.log(`stock-health-core: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error("  FAIL " + f);
  process.exit(1);
}
