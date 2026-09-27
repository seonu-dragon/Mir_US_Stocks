// 종목별 기관 보유 변화(inst-holders-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_inst_holders_core.mjs   (CI 의 "Institutional holders core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../inst-holders-core.js");

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

// 빌더 test_record_changes_only_among_institutions_filing_both_quarters 와 같은 모양의 레코드.
const REC = {
  h: 5, s: 270, v: 2700, ph: 6, ps: 295, pv: 2650, p: 27.0, so: 1000,
  c: [1, 1, 1, 1, 1, 5],
  o: [1, 5, 1, 7],
  top: [[1, 100, 100, 1000], [3, 70, 60, 700], [2, 50, 80, 500], [7, 40, null, 400], [5, 10, 0, 100]],
  tr: [null, [6, 295, 2650], [5, 270, 2700]],
};

test("shardKey", () => {
  assert.equal(core.shardKey("aapl"), "A");
  assert.equal(core.shardKey("BRK.B"), "B");
  assert.equal(core.shardKey("1ABC"), "_");
  assert.equal(core.shardKey(""), "_");
});

test("quarterLabel", () => {
  assert.equal(core.quarterLabel("2026-06-30"), "2026년 2분기");
  assert.equal(core.quarterLabel("2025-12-31", true), "25.4Q");
  assert.equal(core.quarterLabel("bad"), "");
});

test("summarize: 기관 수·주식 수 변화·발행주식 대비·옵션", () => {
  const s = core.summarize(REC);
  assert.equal(s.holders, 5);
  assert.equal(s.holdersDelta, -1);
  assert.equal(Math.round(s.sharesDeltaPct * 100) / 100, -8.47);
  assert.equal(s.pctOut, 27);
  assert.deepEqual(s.changes, { newPos: 1, closed: 1, inc: 1, dec: 1, same: 1, comparable: 5 });
  assert.deepEqual(s.options, { callHolders: 1, callShares: 5, putHolders: 1, putShares: 7 });
  assert.equal(s.split, null);
});

test("summarize: 분할 추정이면 직전 주식 수를 맞춘 뒤 변화율", () => {
  const s = core.summarize({ h: 3, s: 600, ph: 3, ps: 300, split: 2, c: [0, 0, 0, 0, 3, 3] });
  assert.equal(s.sharesDeltaPct, 0);
  assert.equal(s.split, 2);
  assert.equal(s.options, null);
});

test("summarize: 비어 있으면 null", () => {
  assert.equal(core.summarize(null), null);
  assert.equal(core.summarize({ h: 0 }), null);
});

test("changeBars: 가장 큰 칸이 100", () => {
  const bars = core.changeBars({ newPos: 10, inc: 40, dec: 20, closed: 0 });
  assert.deepEqual(bars.map((b) => [b.key, b.width, b.dir]), [
    ["newPos", 25, "pos"], ["inc", 100, "pos"], ["dec", 50, "neg"], ["closed", 0, "neg"],
  ]);
  assert.ok(core.changeBars({ newPos: 0, inc: 0, dec: 0, closed: 0 }).every((b) => b.width === 0));
});

test("cleanFilerName: 주 표기 꼬리 제거", () => {
  assert.equal(core.cleanFilerName("BANK OF AMERICA CORP /DE/"), "BANK OF AMERICA CORP");
  assert.equal(core.cleanFilerName("Arbor Wealth Management LLC\\AZ"), "Arbor Wealth Management LLC");
  assert.equal(core.cleanFilerName("  Vanguard   Group Inc "), "Vanguard Group Inc");
});

test("topRows: 상태·변화·비중·링크", () => {
  const rows = core.topRows(REC, { 1: "Berkshire Hathaway Inc", 3: "X /DE/" }, { 1: { id: "berkshire", name: "버크셔 해서웨이" } });
  assert.deepEqual(rows.map((r) => r.status), ["same", "inc", "dec", "na", "new"]);
  assert.equal(rows[0].link.id, "berkshire");
  assert.equal(rows[1].name, "X");
  assert.equal(rows[2].name, "CIK 2");
  assert.equal(rows[1].delta, 10);
  assert.equal(Math.round(rows[1].deltaPct * 10) / 10, 16.7);
  assert.equal(rows[3].delta, null);
  assert.equal(rows[4].delta, 10);
  assert.equal(Math.round(rows[0].weightPct * 10) / 10, 37);
  assert.equal(core.statusLabel("na"), "비교 불가");
});

test("trendSeries: 분기 목록과 맞춤, 빠진 분기는 null", () => {
  const t = core.trendSeries(REC, ["2025-12-31", "2026-03-31", "2026-06-30"]);
  assert.equal(t.length, 3);
  assert.equal(t[0].holders, null);
  assert.deepEqual(t[2], { period: "2026-06-30", holders: 5, shares: 270, value: 2700 });
  assert.equal(core.trendSeries({}, ["2026-06-30"])[0].shares, null);
});

test("sparkline: null 에서 선을 끊고 범위를 맞춘다", () => {
  const sp = core.sparkline([1, null, 3, 2], 100, 20, 0);
  assert.equal(sp.path, "M0,20M66.7,0L100,10");
  assert.equal(sp.min, 1);
  assert.equal(sp.max, 3);
  assert.equal(core.sparkline([5], 100, 20), null);
  const flat = core.sparkline([2, 2], 10, 10, 0);
  assert.equal(flat.points[0].y, 5);
});

test("표시 형식", () => {
  assert.equal(core.fmtShares(1213405848), "1.21B주");
  assert.equal(core.fmtShares(12345678), "12.3M주");
  assert.equal(core.fmtShares(950), "950주");
  assert.equal(core.fmtUsd(65950296923), "$66.0B");
  assert.equal(core.fmtUsd(null), "—");
  assert.equal(core.fmtSignedPct(3.456), "+3.5%");
  assert.equal(core.fmtSignedPct(-2), "-2.0%");
  assert.equal(core.fmtSignedInt(12), "+12");
  assert.equal(core.fmtSignedInt(-1234), "-1,234");
});

if (failures.length) {
  console.error(`FAIL ${failures.length}건`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`inst-holders-core: ${passed}개 통과`);
