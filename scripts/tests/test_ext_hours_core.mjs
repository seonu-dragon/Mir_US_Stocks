// 프리·애프터 급등락 보드(ext-hours-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_ext_hours_core.mjs   (CI 의 "Ext hours core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../ext-hours-core.js");

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

// ET 벽시계 → UTC ms (2026-10 은 서머타임 EDT = UTC-4, 2026-12 는 EST = UTC-5)
const edt = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h + 4, mi);
const est = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h + 5, mi);

test("세션 판정: 프리·정규·애프터·장외(EDT)", () => {
  // 2026-10-21 수요일
  assert.equal(core.sessionAt(edt(2026, 10, 21, 3, 59), []).session, "closed");
  const pre = core.sessionAt(edt(2026, 10, 21, 4, 0), []);
  assert.equal(pre.session, "pre");
  assert.equal(pre.sinceSec, edt(2026, 10, 21, 4, 0) / 1000);
  assert.equal(pre.polling, true);
  assert.equal(core.sessionAt(edt(2026, 10, 21, 9, 29), []).session, "pre");
  const reg = core.sessionAt(edt(2026, 10, 21, 9, 30), []);
  assert.equal(reg.session, "regular");
  assert.equal(reg.sinceSec, edt(2026, 10, 21, 9, 30) / 1000);
  const post = core.sessionAt(edt(2026, 10, 21, 16, 0), []);
  assert.equal(post.session, "post");
  assert.equal(post.sinceSec, edt(2026, 10, 21, 16, 0) / 1000);
  assert.equal(core.sessionAt(edt(2026, 10, 21, 19, 59), []).session, "post");
  const after = core.sessionAt(edt(2026, 10, 21, 20, 0), []);
  assert.equal(after.session, "closed");
  assert.equal(after.polling, false);
  assert.equal(after.sinceSec, null);
});

test("세션 판정: EST(겨울) 오프셋", () => {
  const pre = core.sessionAt(est(2026, 12, 15, 4, 30), []);
  assert.equal(pre.session, "pre");
  assert.equal(pre.sinceSec, est(2026, 12, 15, 4, 0) / 1000);
});

test("세션 판정: 주말·휴장·단축 거래", () => {
  const sat = core.sessionAt(edt(2026, 10, 24, 10, 0), []);
  assert.equal(sat.session, "closed");
  assert.equal(sat.reason, "weekend");
  const events = [
    { market: "us", date: "2026-11-26", kind: "holiday", name: "Thanksgiving" },
    { market: "us", date: "2026-11-27", kind: "early_close", detail: "13:00 ET 폐장" },
    { market: "kr", date: "2026-11-25", kind: "holiday", name: "KR only" },
  ];
  const hol = core.sessionAt(est(2026, 11, 26, 10, 0), events);
  assert.equal(hol.session, "closed");
  assert.equal(hol.reason, "holiday");
  assert.equal(hol.holidayName, "Thanksgiving");
  // 다른 시장 휴장은 무시
  assert.equal(core.sessionAt(est(2026, 11, 25, 10, 0), events).session, "regular");
  // 단축: 13:00 마감 → 애프터 13:00~17:00
  assert.equal(core.sessionAt(est(2026, 11, 27, 12, 59), events).session, "regular");
  const ePost = core.sessionAt(est(2026, 11, 27, 13, 0), events);
  assert.equal(ePost.session, "post");
  assert.equal(ePost.sinceSec, est(2026, 11, 27, 13, 0) / 1000);
  assert.equal(core.sessionAt(est(2026, 11, 27, 17, 0), events).session, "closed");
});

test("요청 바디: 세션별 열·정렬·필터", () => {
  const pre = core.buildScanBody("pre", "up", { sinceSec: 1792483200 });
  assert.deepEqual(pre.sort, { sortBy: "premarket_change", sortOrder: "desc" });
  assert.deepEqual(pre.range, [0, core.LIMIT]);
  assert.ok(pre.filter.some((f) => f.left === "premarket_time" && f.operation === "egreater" && f.right === 1792483200));
  assert.ok(pre.filter.some((f) => f.left === "premarket_change" && f.operation === "greater" && f.right === 0));
  assert.ok(pre.filter.some((f) => f.left === "premarket_volume" && f.right === core.MIN_VOL.pre));
  assert.ok(pre.filter.some((f) => f.left === "exchange" && f.right.includes("NASDAQ")));
  assert.ok(pre.columns.includes("premarket_change") && pre.columns.includes("update_mode"));

  const down = core.buildScanBody("post", "down", {});
  assert.deepEqual(down.sort, { sortBy: "postmarket_change", sortOrder: "asc" });
  assert.ok(down.filter.some((f) => f.left === "postmarket_change" && f.operation === "less"));
  assert.ok(!down.filter.some((f) => f.left === "postmarket_time"), "sinceSec 없으면 시각 필터 없음");

  const reg = core.buildScanBody("regular", "surge", { sinceSec: 1 });
  assert.deepEqual(reg.sort, { sortBy: "relative_volume_10d_calc", sortOrder: "desc" });
  assert.ok(reg.filter.some((f) => f.left === "time" && f.right === 1));
  assert.ok(!reg.filter.some((f) => f.left === "change"), "급증 탭은 방향 필터 없음");

  const exSurge = core.buildScanBody("pre", "surge", {});
  assert.deepEqual(exSurge.sort, { sortBy: "premarket_volume", sortOrder: "desc" });
  assert.deepEqual(exSurge.range, [0, core.SURGE_POOL]);

  // closed 는 애프터 열
  assert.equal(core.buildScanBody("closed", "up", {}).sort.sortBy, "postmarket_change");
  // 알 수 없는 세션 → closed
  assert.equal(core.buildScanBody("??", "up", {}).sort.sortBy, "postmarket_change");
  // JSON 직렬화 가능(text/plain 본문)
  assert.equal(typeof JSON.stringify(pre), "string");
});

function rowOf(values) {
  return core.COLUMNS.map((c) => (c in values ? values[c] : null));
}

test("응답 파싱: 열 순서·지연·세션 시각·숫자 없는 행 제외", () => {
  const json = {
    totalCount: 3,
    data: [
      { s: "NASDAQ:BRZE", d: rowOf({ name: "BRZE", description: "Braze, Inc.", premarket_change: 51.56, premarket_close: 45.53, premarket_volume: 4255674, average_volume_10d_calc: 8_400_000, premarket_time: 1792483200, change: 51.7, update_mode: "delayed_streaming_900" }) },
      { s: "NYSE:GM", d: rowOf({ name: "GM", description: "General Motors", premarket_change: -6.5, premarket_close: 60, premarket_volume: 1_200_000, average_volume_10d_calc: 0, premarket_time: 1792483200, update_mode: "delayed_streaming_900" }) },
      { s: "NYSE:BAD", d: rowOf({ name: "BAD", premarket_change: null, premarket_close: 10 }) },
    ],
  };
  const p = core.parseScanResponse(json, "pre", "up", {});
  assert.equal(p.total, 3);
  assert.equal(p.rows.length, 2);
  assert.equal(p.delayMin, 15);
  assert.equal(p.sessionTime, 1792483200);
  const b = p.rows[0];
  assert.equal(b.ticker, "BRZE");
  assert.equal(b.exchange, "NASDAQ");
  assert.equal(b.name, "Braze, Inc.");
  assert.equal(b.chg, 51.56);
  assert.equal(b.price, 45.53);
  assert.equal(b.relKind, "ofAvg");
  assert.ok(Math.abs(b.rel - 4255674 / 8_400_000) < 1e-9);
  assert.equal(b.regularChg, 51.7);
  // 평균 거래량 0 → 비율 없음(지어내지 않음)
  assert.equal(p.rows[1].rel, null);
});

test("응답 파싱: 정규장 상대거래량·급증 재정렬·지난 세션 행 제외", () => {
  const reg = core.parseScanResponse({ totalCount: 1, data: [
    { s: "NASDAQ:X", d: rowOf({ name: "X", change: 3, close: 10, volume: 1e6, relative_volume_10d_calc: 4.2, time: 100 }) },
  ] }, "regular", "surge", {});
  assert.equal(reg.rows[0].relKind, "rvol");
  assert.equal(reg.rows[0].rel, 4.2);
  assert.equal(reg.rows[0].regularChg, null);

  const surge = core.parseScanResponse({ totalCount: 3, data: [
    { s: "NYSE:A", d: rowOf({ name: "A", postmarket_change: 1, postmarket_close: 5, postmarket_volume: 1e6, average_volume_10d_calc: 1e7, postmarket_time: 200 }) },
    { s: "NYSE:B", d: rowOf({ name: "B", postmarket_change: -2, postmarket_close: 5, postmarket_volume: 5e5, average_volume_10d_calc: 1e6, postmarket_time: 200 }) },
    // 거래정지 등으로 지난 세션 값을 든 종목 — 장외 보기에서 빠져야 한다
    { s: "NYSE:OLD", d: rowOf({ name: "OLD", postmarket_change: 9, postmarket_close: 5, postmarket_volume: 9e6, average_volume_10d_calc: 1e6, postmarket_time: 100 }) },
  ] }, "closed", "surge", { limit: 5 });
  assert.deepEqual(surge.rows.map((r) => r.ticker), ["B", "A"]);
  assert.equal(surge.sessionTime, 200);
});

test("응답 파싱: 잘못된 응답", () => {
  assert.equal(core.parseScanResponse(null, "pre", "up"), null);
  assert.equal(core.parseScanResponse({ error: "x" }, "pre", "up"), null);
  const empty = core.parseScanResponse({ totalCount: 0, data: [] }, "pre", "up");
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.sessionTime, null);
});

test("표기: 거래량·상대거래량·세션 라벨·KST 시각·지연", () => {
  assert.equal(core.fmtVol(4255674), "4.3M");
  assert.equal(core.fmtVol(228000), "228K");
  assert.equal(core.fmtVol(12_345), "12.3K");
  assert.equal(core.fmtVol(null), "—");
  assert.equal(core.fmtRel({ rel: 33.2, relKind: "rvol" }), "상대거래량 33배");
  assert.equal(core.fmtRel({ rel: 1.83, relKind: "rvol" }), "상대거래량 1.8배");
  assert.equal(core.fmtRel({ rel: 0.51, relKind: "ofAvg" }), "하루 평균의 51%");
  assert.equal(core.fmtRel({ rel: 0.016, relKind: "ofAvg" }), "하루 평균의 1.6%");
  assert.equal(core.fmtRel({ rel: null }), "");
  assert.equal(core.sessionLabel({ session: "pre" }), "프리마켓");
  assert.equal(core.sessionLabel({ session: "regular" }), "정규장");
  assert.equal(core.sessionLabel({ session: "closed" }, 1792526400), "10/20 애프터마켓 마감");
  assert.equal(core.sessionLabel({ session: "closed" }, null), "애프터마켓 마감");
  assert.equal(core.kstClock(Date.UTC(2026, 9, 21, 12, 41)), "21:41");
  assert.equal(core.delayMinOf("delayed_streaming_900"), 15);
  assert.equal(core.delayMinOf("streaming"), 0);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`ext-hours-core: ${passed} passed`);
