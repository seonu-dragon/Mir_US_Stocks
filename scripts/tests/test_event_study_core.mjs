// 이벤트 스터디 순수 집계(event-study-core.js) 단위 테스트. 네트워크·DOM·파일 없음.
// 실행: node scripts/tests/test_event_study_core.mjs   (CI 의 "Event study tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../event-study-core.js");
const sig = require("../../signal-scorecard-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

const POINTS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 5, 10, 20, 30, 40, 60];
const F = core.FIELD;
// 행 생성: 0일에 jump(0.1%p 정수)만큼 뛰고 그 뒤 평평한 경로. ctrlJump 는 대조 경로의 0일 점프.
function row({ t = "AAA", d0 = "2024-01-02", jump = 50, pre = 0, cap = 5, sector = 0, size = null, mm = true, ctrl = 0, cd0 = "2023-06-01", tail = true } = {}) {
  const path = POINTS.map((p) => (p < 0 ? pre : pre + jump));
  if (!tail) for (let i = POINTS.indexOf(20); i < POINTS.length; i++) path[i] = null;
  const cpath = ctrl == null ? null : POINTS.map((p) => (p < 0 ? 0 : ctrl));
  const mmd = mm ? path.map((v) => (v == null ? null : 0)) : null;
  return [t, core.dayNum(d0), "a", cap, sector, size, path, mmd, ctrl == null ? null : core.dayNum(cd0), cpath, 0];
}

// ---------------------------------------------------------------- 구간
test("capBucket US/KR 경계", () => {
  assert.equal(core.capBucket("us", 1.9), 0);
  assert.equal(core.capBucket("us", 2), 1);
  assert.equal(core.capBucket("us", 250), 3);
  assert.equal(core.capBucket("kr", 0.29), 0);
  assert.equal(core.capBucket("kr", 12), 3);
  assert.equal(core.capBucket("us", null), -1);
});
test("sizeBucket 과 라벨", () => {
  assert.equal(core.sizeBucket(-12, [-10, 0, 5, 15]), 0);
  assert.equal(core.sizeBucket(3, [-10, 0, 5, 15]), 2);
  assert.equal(core.sizeBucket(99, [-10, 0, 5, 15]), 4);
  assert.equal(core.sizeBucket(null, [1]), -1);
  assert.deepEqual(core.sizeBucketLabels([10, 30], "%"), ["10% 미만", "10%~30%", "30% 이상"]);
  assert.deepEqual(core.sizeBucketLabels([1e6], "$"), ["$1M 미만", "$1M 이상"]);
});

// ---------------------------------------------------------------- 필터
test("filterRows: 기간·시총·섹터·크기·종목", () => {
  const rows = [
    row({ t: "A", d0: "2023-01-03", cap: 1, sector: 0, size: 3 }),
    row({ t: "B", d0: "2024-05-01", cap: 50, sector: 1, size: 20 }),
    row({ t: "C", d0: "2025-02-03", cap: 500, sector: 1, size: null }),
  ];
  assert.equal(core.filterRows(rows, { market: "us", from: "2024-01-01" }).length, 2);
  assert.deepEqual(core.filterRows(rows, { market: "us", caps: [2] }).map((r) => r[0]), ["B"]);
  assert.deepEqual(core.filterRows(rows, { market: "us", sectors: [1] }).map((r) => r[0]), ["B", "C"]);
  assert.deepEqual(core.filterRows(rows, { market: "us", sizeBuckets: [1], sizeBins: [10, 30] }).map((r) => r[0]), ["B"]);
  assert.deepEqual(core.filterRows(rows, { market: "us", requireSize: true }).map((r) => r[0]), ["A", "B"]);
  assert.deepEqual(core.filterRows(rows, { market: "us", ticker: "C" }).map((r) => r[0]), ["C"]);
});

// ---------------------------------------------------------------- 기준점 다시 맞추기
test("anchorPath: pre/d0/d1", () => {
  const p = [1, 2, 3, 4, 10, 30, 35, 35, 35, 35, 35, 40, 40, 40, 50];
  const pre = core.anchorPath(p, POINTS, "pre", 1000);
  near(pre[0], 0.001, 1e-12);
  const d0 = core.anchorPath(p, POINTS, "d0", 1000);
  near(d0[POINTS.indexOf(-1)], 0, 1e-12);
  near(d0[POINTS.indexOf(0)], 0.02, 1e-12, "0일 = C(0)-C(-1)");
  near(d0[POINTS.indexOf(60)], 0.04, 1e-12);
  const d1 = core.anchorPath(p, POINTS, "d1", 1000);
  near(d1[POINTS.indexOf(1)], 0.005, 1e-12, "+1일 = C(1)-C(0)");
  const withNull = p.slice(); withNull[POINTS.indexOf(-1)] = null;
  assert.equal(core.anchorPath(withNull, POINTS, "d0"), null);
});

// ---------------------------------------------------------------- 부트스트랩
test("단일 지점·이벤트 가중이면 신호 성적표 clusterBootstrapMean 과 같은 구간", () => {
  const items = [];
  for (let i = 0; i < 40; i++) {
    const d = `2024-0${1 + (i % 9)}-1${i % 10}`;
    const v = ((i * 37) % 23 - 11) / 100;
    items.push({ c: d, v: [v] });
  }
  const mine = core.clusterBootstrapMulti(items, 1, { B: 500, seed: 7 })[0];
  const theirs = sig.clusterBootstrapMean(items.map((x) => ({ d: x.c, v: x.v[0] })), { B: 500, seed: 7 });
  near(mine.lo, theirs.lo, 1e-12, "lo");
  near(mine.hi, theirs.hi, 1e-12, "hi");
});
test("clusterBootstrapMulti: 평균·중앙값·양 비율·날짜 수", () => {
  const items = [
    { c: "d1", v: [0.01, 0.02] }, { c: "d1", v: [0.03, null] },
    { c: "d2", v: [-0.01, 0.02] }, { c: "d3", v: [0.05, 0.04] },
  ];
  const [a, b] = core.clusterBootstrapMulti(items, 2, { B: 300 });
  assert.equal(a.n, 4); assert.equal(a.days, 3);
  near(a.mean, 0.02, 1e-12);
  near(a.median, 0.02, 1e-12);
  near(a.posRate, 0.75, 1e-12);
  assert.equal(b.n, 3); assert.equal(b.days, 3);
  assert.ok(a.lo <= a.mean && a.mean <= a.hi);
});
test("날짜 동일 가중: 하루에 몰린 이벤트가 평균을 끌지 못한다", () => {
  const items = [];
  for (let i = 0; i < 20; i++) items.push({ c: "2024-06-30", v: [0.10] });   // 한 날 20건 +10%
  for (let i = 0; i < 5; i++) items.push({ c: `2024-0${i + 1}-02`, v: [0] }); // 다른 날 5건 0%
  const ev = core.clusterBootstrapMulti(items, 1, { B: 200, weighting: "event" })[0];
  const day = core.clusterBootstrapMulti(items, 1, { B: 200, weighting: "day" })[0];
  near(ev.mean, 0.08, 1e-12);
  near(day.mean, 0.10 / 6, 1e-12);
});
test("부트스트랩 p: 뚜렷한 양의 효과는 작고, 0 근처는 크다", () => {
  const strong = [], none = [];
  for (let i = 0; i < 60; i++) {
    strong.push({ c: `d${i}`, v: [0.02 + ((i % 7) - 3) / 1000] });
    none.push({ c: `d${i}`, v: [((i % 7) - 3) / 1000] });
  }
  assert.ok(core.clusterBootstrapMulti(strong, 1, { B: 500 })[0].p < 0.01);
  assert.ok(core.clusterBootstrapMulti(none, 1, { B: 500 })[0].p > 0.2);
});

// ---------------------------------------------------------------- 집계
test("aggregate: 이벤트·대조·짝 차이, 시장모형 선택", () => {
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push(row({ t: `T${i}`, d0: `2024-${String(1 + (i % 12)).padStart(2, "0")}-0${1 + (i % 9)}`, jump: 30, ctrl: 5, mm: i % 2 === 0 }));
  const res = core.aggregate(rows, { points: POINTS, scale: 1000, method: "ma", anchor: "d0", B: 300 });
  const at = (arr, p) => arr[POINTS.indexOf(p)];
  near(at(res.event, 5).mean, 0.03, 1e-12);
  near(at(res.control, 5).mean, 0.005, 1e-12);
  near(at(res.diff, 5).mean, 0.025, 1e-12);
  assert.equal(res.nControl, 40);
  const mm = core.aggregate(rows.filter((r) => r[F.mmd]), { points: POINTS, method: "mm", anchor: "d0", B: 100 });
  assert.equal(mm.n, 20, "시장모형은 경로가 있는 행만");
});
test("aggregate: 데이터가 끝난 지점은 표본에서 빠진다", () => {
  const rows = [row({ t: "A", tail: false }), row({ t: "B", d0: "2024-02-01" })];
  const res = core.aggregate(rows, { points: POINTS, anchor: "d0", B: 50 });
  assert.equal(res.event[POINTS.indexOf(10)].n, 2);
  assert.equal(res.event[POINTS.indexOf(60)].n, 1);
});

// ---------------------------------------------------------------- 군집·다중비교·판정
test("clusteringInfo: 하루 쏠림 경고", () => {
  const dates = Array(30).fill("2024-06-30").concat(Array.from({ length: 70 }, (_, i) => `d${i}`));
  const c = core.clusteringInfo(dates);
  assert.equal(c.topDay, "2024-06-30");
  near(c.topShare, 0.3, 1e-12);
  assert.equal(c.warn, true);
  assert.equal(core.clusteringInfo(Array.from({ length: 50 }, (_, i) => `d${i}`)).warn, false);
});
test("bhAdjust: 알려진 값", () => {
  const q = core.bhAdjust([0.01, 0.04, 0.03, 0.2]);
  near(q[0], 0.04, 1e-12);
  near(q[1], 0.0533333333, 1e-9);
  near(q[2], 0.0533333333, 1e-9);
  near(q[3], 0.2, 1e-12);
  assert.deepEqual(core.bhAdjust([null, 0.5]), [null, 0.5]);
});
test("verdict: 표본 부족·양·음·불분명", () => {
  assert.equal(core.verdict({ n: 10, lo: 0.1, hi: 0.2 }), "hold");
  assert.equal(core.verdict({ n: 50, lo: 0.001, hi: 0.02 }), "pos");
  assert.equal(core.verdict({ n: 50, lo: -0.02, hi: -0.001 }), "neg");
  assert.equal(core.verdict({ n: 50, lo: -0.01, hi: 0.02 }), "unclear");
});

// ---------------------------------------------------------------- 종목 요약 · 샤드
test("dayNum/dayIso 왕복 · mmPath", () => {
  assert.equal(core.dayNum("2000-01-01"), 0);
  assert.equal(core.dayIso(core.dayNum("2024-02-29")), "2024-02-29");
  assert.equal(core.dayNum(8800), 8800);
  const r = row({ jump: 30 });
  r[F.mmd] = r[F.ma].map(() => 5);
  assert.equal(core.mmPath(r)[POINTS.indexOf(0)], 35);
});
test("tickerSummary: 유형별 평균·최근", () => {
  const D = core.dayNum;
  const rows = [["us_earn", D("2024-01-31"), 20, 30, null, null], ["us_earn", D("2024-05-01"), -10, 10, 40, 50], ["us_8k_502", D("2023-03-01"), 5, 5, 5, 5]];
  const s = core.tickerSummary(rows, 1000);
  assert.equal(s[0].k, "us_earn");
  assert.equal(s[0].n, 2);
  near(s[0].mean1, 0.005, 1e-12);
  near(s[0].mean20, 0.04, 1e-12);
  assert.equal(s[0].n20, 1);
  assert.equal(s[0].last, "2024-05-01");
});
test("shardOf 가 파이썬 zlib.crc32 % 16 과 같다", () => {
  // crc32("123456789") = 0xCBF43926 (표준 검사값). 아래 셋은 파이썬 zlib.crc32(x) % 16 실측값.
  assert.equal(core.shardOf("123456789", 0x100000000), 0xCBF43926);
  assert.equal(core.shardOf("005930", 16), 8);
  assert.equal(core.shardOf("AAPL", 16), 12);
  assert.equal(core.shardOf("BRK-B", 16), 15);
});

if (failures.length) {
  console.error(`event-study-core: ${passed} 통과, ${failures.length} 실패`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`event-study-core: ${passed} 테스트 통과`);
