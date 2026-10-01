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

// ── 기준일 맞추기(2026-10-01 005930 실측 재현) ─────────────────────────────
// KST 시각 → epoch ms
const kst = (iso) => Date.parse(`${iso}+09:00`);
const ser = [
  [284500, 285500, 268500, 270000, 21346064, "2026-09-28"],
  [266000, 276000, 266000, 272500, 15963864, "2026-09-29"],
  [274500, 276000, 267500, 268500, 16477580, "2026-09-30"],   // 야후 09-30(네이버 269,500)
  [271500, 271500, 264500, 268750, 5000000, "2026-10-01"],    // 10-01 장중 봉
];
const snap = { date: "2026-09-30", close: 269500, volume: 15700594 };

test("기준일 봉을 날짜로 찾아 스냅샷 종가·거래량으로(뒤에 장중 봉이 있어도)", () => {
  const out = D.alignSessionBar(ser, snap, kst("2026-10-01T10:25:00"));
  assert.notEqual(out, ser);
  assert.deepEqual(out[2], [274500, 276000, 267500, 269500, 15700594, "2026-09-30"]);
  assert.deepEqual(out[3], ser[3]);              // 장중 봉은 그대로
  assert.deepEqual(ser[2][3], 268500);           // 원본은 건드리지 않는다
});

test("고가·저가는 스냅샷 종가를 포함하도록 넓힌다", () => {
  const s2 = [[100, 101, 99, 100, 10, "2026-09-29"], [100, 101, 99, 100, 10, "2026-09-30"]];
  const out = D.alignSessionBar(s2, { date: "2026-09-30", close: 103 }, kst("2026-09-30T16:00:00"));
  assert.deepEqual(out[1], [100, 103, 99, 103, 10, "2026-09-30"]);
});

test("기준일 장중(15:40 전)이거나 그 날짜 봉이 없으면 그대로", () => {
  const intraday = { date: "2026-10-01", close: 267500, volume: 4619566 };
  assert.equal(D.alignSessionBar(ser, intraday, kst("2026-10-01T10:48:00")), ser);
  assert.equal(D.alignSessionBar(ser, { date: "2026-09-26", close: 1 }, kst("2026-10-01T10:00:00")), ser);
  assert.equal(D.alignSessionBar(ser.slice(0, 2), snap, kst("2026-10-01T10:00:00")).length, 2);
});

test("이미 같으면 같은 배열(메모·표 키 안정)", () => {
  const once = D.alignSessionBar(ser, snap, kst("2026-10-01T10:25:00"));
  assert.equal(D.alignSessionBar(once, snap, kst("2026-10-01T10:25:00")), once);
});

test("객체 행({o,h,l,c,v,d})도 맞춘다", () => {
  const objs = ser.map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4], d: r[5] }));
  const out = D.alignSessionBar(objs, snap, kst("2026-10-01T10:25:00"));
  assert.equal(out[2].c, 269500);
  assert.equal(out[2].v, 15700594);
});

test("확정 전 표식: 장중 / 잠정 / 확정", () => {
  const o = { market: "kr", priceDate: "2026-09-30" };
  assert.equal(D.provisionalLabel("2026-10-01", { ...o, nowMs: kst("2026-10-01T10:25:00") }), "장중");
  assert.equal(D.provisionalLabel("2026-10-01", { ...o, nowMs: kst("2026-10-01T15:35:00") }), "잠정");
  assert.equal(D.provisionalLabel("2026-10-01", { ...o, nowMs: kst("2026-10-01T22:00:00") }), "잠정");
  assert.equal(D.provisionalLabel("2026-09-30", { ...o, nowMs: kst("2026-10-01T10:25:00") }), "");
  // 스냅샷이 장중에 찍혀 기준일 = 오늘이어도, 장중이면 표식
  assert.equal(D.provisionalLabel("2026-10-01", { market: "kr", priceDate: "2026-10-01", nowMs: kst("2026-10-01T11:00:00") }), "장중");
  assert.equal(D.provisionalLabel("2026-10-01", { market: "kr", priceDate: "2026-10-01", nowMs: kst("2026-10-01T16:00:00") }), "");
});

test("확정 전 표식: 미국은 뉴욕 시각(서머타임)", () => {
  // 2026-10-01 10:00 EDT = 14:00 UTC
  const now = Date.parse("2026-10-01T14:00:00Z");
  assert.equal(D.provisionalLabel("2026-10-01", { market: "us", priceDate: "2026-09-30", nowMs: now }), "장중");
  assert.equal(D.provisionalLabel("2026-09-30", { market: "us", priceDate: "2026-09-30", nowMs: now }), "");
  // 장 마감 뒤(17:00 EDT) 스냅샷이 아직 전날이면 잠정
  assert.equal(D.provisionalLabel("2026-10-01", { market: "us", priceDate: "2026-09-30", nowMs: Date.parse("2026-10-01T21:00:00Z") }), "잠정");
  assert.equal(D.marketClock("us", Date.parse("2026-01-15T14:30:00Z")).minutes, 9 * 60 + 30); // EST
});

test("기준일 행 전일대비는 머리글과 같은 기준, 장중 행은 맞춘 종가 대비", () => {
  const aligned = D.alignSessionBar(ser, snap, kst("2026-10-01T10:25:00"));
  const rowsObj = aligned.map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4], d: r[5] }));
  const prevClose = D.snapshotPrevClose(269500, -1.1, 272500, { kr: true });
  assert.equal(prevClose, 272500);
  const out = D.buildDailyRows(rowsObj, 3, {
    priceDate: "2026-09-30",
    prevClose,
    provisional: (d) => D.provisionalLabel(d, { market: "kr", priceDate: "2026-09-30", nowMs: kst("2026-10-01T10:25:00") }),
  });
  assert.equal(out[0].d, "2026-10-01");
  assert.equal(out[0].provisional, "장중");
  assert.equal(out[0].change, 268750 - 269500);           // 야후 268,500 이 아니라 맞춘 종가 대비
  assert.equal(out[1].d, "2026-09-30");
  assert.equal(out[1].official, true);
  assert.equal(out[1].provisional, "");
  assert.equal(out[1].c, 269500);
  assert.equal(out[1].change, -3000);
  assert.equal(D.fmtChange(out[1].change, out[1].pct, true).text, "▼3,000(−1.10%)");
  assert.equal(out[1].v, 15700594);
  assert.equal(out[2].official, false);
});

test("기준일 전일 종가: 앞 봉과 안 맞으면 등락률에서 풀고 호가 단위로", () => {
  // 앞 봉(야후) 275,000 이면 −2.0% 로 −1.1% 와 안 맞는다 → 269,500 / 0.989 = 272,497 → 500원 단위 272,500
  assert.equal(D.snapshotPrevClose(269500, -1.1, 275000, { kr: true }), 272500);
  assert.equal(D.snapshotPrevClose(269500, null, 275000, { kr: true }), null);
  near(D.snapshotPrevClose(110, 10, 50, { kr: false }), 100, 1e-9);
  assert.equal(D.krTick(272497, false), 500);
  assert.equal(D.krTick(3000, true), 5);
});

test("옵션 없이 부르면 예전과 같다", () => {
  const out = D.buildDailyRows(rows, 2);
  assert.equal(out[0].official, false);
  assert.equal(out[0].provisional, "");
});

if (failures.length) {
  console.error(`daily-table-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`daily-table-core: ${passed} 통과`);
