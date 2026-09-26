// PER·PBR 밴드 순수 계산(valuation-band-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_valuation_band_core.mjs   (CI 의 "Valuation band tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../valuation-band-core.js");

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

// 파이썬 shard_of 와 같은 값(scripts/tests/test_kr_valuation_band.py 의 SHARD_VECTORS 와 동일).
const SHARD_VECTORS = { "005930": null, "000660": null, "0001A0": null, "373220": null };
test("shardOf: 파이썬 해시와 같은 규칙(수작업 계산)", () => {
  const manual = (s, n) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return h % n; };
  for (const code of Object.keys(SHARD_VECTORS)) assert.equal(core.shardOf(code, 32), manual(code, 32));
  assert.equal(core.shardOf("005930", 32), 29);
  assert.equal(core.shardOf("000660", 32), 28);
});

test("monthSeq: 연도 넘김", () => {
  assert.deepEqual(core.monthSeq("2025-11", 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("quantileSorted: 선형 보간(numpy 기본)", () => {
  const s = [1, 2, 3, 4, 5];
  assert.equal(core.quantileSorted(s, 0.5), 3);
  assert.equal(core.quantileSorted(s, 0.25), 2);
  near(core.quantileSorted([10, 20], 0.1), 11, 1e-9);
});

test("percentileOf: 동점은 절반", () => {
  assert.equal(core.percentileOf([1, 2, 3, 4], 2.5), 50);
  assert.equal(core.percentileOf([1, 2, 2, 3], 2), 50);
  assert.equal(core.percentileOf([1, 2, 3], 0), 0);
});

// 30개월, EPS 는 1000 고정, PER 이 10→19.67 로 오르는 합성 시리즈.
function synth(n = 30, loss = []) {
  const dates = core.monthSeq("2020-01", n);
  const mult = [];
  const close = [];
  for (let i = 0; i < n; i++) {
    const per = 10 + i / 3;
    close.push(per * 1000);
    mult.push(loss.includes(i) ? -1 : per);
  }
  return { dates, close, mult };
}

test("computeBands: 밴드 = 주당 값 × 분위 배수, 분할과 무관", () => {
  const s = synth();
  const r = core.computeBands(s, { currentPrice: 20000 });
  assert.ok(r.ok);
  assert.equal(r.validCount, 30);
  // 중앙값 밴드는 EPS(1000) × 중앙값 PER
  near(r.bands[2][5], 1000 * r.levels[2], 1e-6);
  near(r.levels[2], 10 + 14.5 / 3, 1e-9);
  // 현재 배수 = 20000 / 1000 = 20 → 과거 전부보다 높음 = 100%
  near(r.current.mult, 20, 1e-9);
  assert.equal(r.current.pct, 100);
  // 가격을 절반으로 나눠도(분할) 배수·분위는 같다.
  const split = { ...s, close: s.close.map((c) => c / 2) };
  const r2 = core.computeBands(split, { currentPrice: 10000 });
  near(r2.current.mult, 20, 1e-9);
  near(r2.levels[0], r.levels[0], 1e-9);
});

test("computeBands: 적자 달은 밴드가 끊기고 개수를 센다", () => {
  const s = synth(30, [10, 11, 12]);
  const r = core.computeBands(s);
  assert.ok(r.ok);
  assert.equal(r.lossMonths, 3);
  assert.equal(r.bands[0][11], null);
  assert.deepEqual(core.lossRanges(s.mult), [[10, 12]]);
  assert.ok(!core.linePath(r.bands[2], (i) => i, (v) => v).includes("NaN"));
  // 끊긴 구간은 M 으로 다시 시작
  assert.equal((core.linePath(r.bands[2], (i) => i, (v) => v).match(/M/g) || []).length, 2);
});

test("computeBands: 최근 달이 적자면 현재 배수를 계산하지 않고 PBR 을 기본으로", () => {
  const s = synth(30, [29]);
  const per = core.computeBands(s, { currentPrice: 20000 });
  assert.ok(per.ok && per.lastLoss && per.current === null);
  const pbr = core.computeBands(synth(30), { currentPrice: 20000 });
  assert.equal(core.defaultMetric(per, pbr), "pbr");
  assert.equal(core.defaultMetric(pbr, pbr), "per");
});

test("computeBands: 24개월 미만이면 그리지 않는다", () => {
  const r = core.computeBands(synth(20));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "few");
});

test("areaPath: null 에서 끊긴 두 다각형", () => {
  const lower = [1, 1, null, 1, 1];
  const upper = [2, 2, 2, 2, 2];
  const d = core.areaPath(lower, upper, (i) => i, (v) => v);
  assert.equal((d.match(/Z/g) || []).length, 2);
});

test("seriesFromShard: 샤드 모양 파싱", () => {
  const shard = { m0: "2024-11", n: 3, t: { "005930": { c: [1, 2, 3], p: [10, -1, null], b: [1, 1.1, 1.2] } } };
  const s = core.seriesFromShard(shard, "005930");
  assert.deepEqual(s.dates, ["2024-11", "2024-12", "2025-01"]);
  assert.deepEqual(s.per, [10, -1, null]);
  assert.equal(core.seriesFromShard(shard, "000000"), null);
});

test("seriesFromShard: US 샤드의 PSR(s) 배열, 없으면 null", () => {
  const shard = { m0: "2025-11", n: 2, t: { AAPL: { c: [270, 280], p: [36, 37], b: [50, 52], s: [9.4, null] }, KO: { c: [70, 71], p: [25, 26], b: [10, 11] } } };
  assert.deepEqual(core.seriesFromShard(shard, "AAPL").psr, [9.4, null]);
  assert.equal(core.seriesFromShard(shard, "KO").psr, null);
  // shardOf 는 영문 티커에도 같은 해시(파이썬 build_us_valuation_band.shard_of 와 동일 값)
  assert.equal(core.shardOf("AAPL", 32), 22);
  assert.equal(core.shardOf("BRK.B", 32), 18);
});

if (failures.length) {
  console.error(`valuation band core: ${failures.length} failed, ${passed} passed`);
  failures.forEach((f) => console.error("  ✕ " + f));
  process.exit(1);
}
console.log(`valuation band core: ${passed} passed`);
