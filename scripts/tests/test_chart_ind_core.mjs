// 차트 지표 목록·검색·파라미터·멀티 차트 레이아웃 순수 계산(chart-ind-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_chart_ind_core.mjs   (CI 의 "Chart indicator core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const C = require("../../chart-ind-core.js");
const I = require("../../indicators.js");

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

// ---- 목록 ----
test("목록: 예전 체크박스 id 43개가 빠짐없이 한 번씩, 분류는 정해진 키만", () => {
  const legacy = [
    "showSma5", "showSma10", "showSma20", "showSma60", "showSma120",
    "showEma20", "showEma60", "showBoll", "showVwap", "showSupertrend", "showIchimoku", "showKeltner", "showDonchian", "showSupportResistance", "showTechLevels", "showPatterns",
    "showVolume", "showVolMa20", "showVolumeRatio", "showObv", "showAd",
    "showRsi", "showMacd", "showStoch", "showRoc", "showMomentum", "showWilliams", "showAtr", "showAdx", "showCci", "showCmf", "showMfi",
    "showVolumeProfile", "showTrendlines", "showGapZones", "showTtmSqueeze",
    "showMarketStructure", "showChandelier", "showAnchoredVwap",
    "showRsSpy", "showRsQqq", "showRsSector", "showMansfield",
  ];
  assert.equal(legacy.length, 43);
  assert.deepEqual([...C.ids()].sort(), [...legacy].sort());
  assert.equal(new Set(C.ids()).size, C.ids().length);
  const cats = new Set(C.CATEGORIES.map(([k]) => k));
  C.CATALOG.forEach((e) => assert.ok(cats.has(e.cat), `${e.id} 분류 ${e.cat}`));
});

// ---- 검색 ----
test("검색: 초성·한글·영문·약어가 모두 맞는다", () => {
  const top = (q) => C.filter(q, "all", [])[0];
  assert.equal(top("ㅂㄹㅈ"), "showBoll", "초성 ㅂㄹㅈ → 볼린저");
  assert.equal(top("볼린저"), "showBoll");
  assert.equal(top("볼ㄹ"), "showBoll", "완성형+초성 섞어 쓰기");
  assert.equal(top("bollinger"), "showBoll");
  assert.equal(top("BB"), "showBoll", "대소문자 무시");
  assert.equal(top("rsi"), "showRsi");
  assert.equal(top("ㅅㄷㄱㄷ"), "showRsi", "상대강도지수 초성");
  assert.equal(top("macd"), "showMacd");
  assert.equal(top("스토캐"), "showStoch");
  assert.equal(top("ㅇㅁ"), "showIchimoku", "일목 초성");
  assert.ok(C.filter("이평", "all", []).includes("showSma20"));
  assert.ok(C.filter("이평", "all", []).includes("showEma60"));
  assert.ok(C.filter("money flow", "all", []).includes("showMfi"), "공백 무시");
  assert.deepEqual(C.filter("없는지표xyz", "all", []), []);
});

test("검색: 접두 일치가 중간 일치보다 앞, 빈 질의는 목록 순서", () => {
  const r = C.filter("ma", "all", []);
  assert.ok(r.indexOf("showMacd") >= 0);
  assert.deepEqual(C.filter("", "all", []), C.ids());
  assert.equal(C.matchAt("볼린저밴드", "ㄹㅈ"), 1);
  assert.equal(C.matchAt("rsi", "x"), -1);
});

test("검색: 분류·즐겨찾기 필터", () => {
  const vol = C.filter("", "volume", []);
  assert.ok(vol.includes("showObv") && !vol.includes("showRsi"));
  assert.deepEqual(C.filter("", "fav", ["showRsi", "showBoll"]), ["showBoll", "showRsi"], "즐겨찾기는 목록 순서");
  assert.deepEqual(C.filter("rsi", "fav", ["showBoll"]), [], "즐겨찾기 안에서 검색");
  assert.deepEqual(C.toggleFav(["showRsi"], "showRsi"), []);
  assert.deepEqual(C.toggleFav([], "showRsi"), ["showRsi"]);
  assert.deepEqual(C.toggleFav([], "nope"), []);
  assert.deepEqual(C.sanitizeFavs(["showRsi", "showRsi", "x", 3]), ["showRsi"]);
});

// ---- 파라미터 ----
test("파라미터: 기본값·라벨 표기", () => {
  assert.equal(C.label({}, "showSma20"), "SMA(20)");
  assert.equal(C.label({}, "showMacd"), "MACD(12,26,9)");
  assert.equal(C.label({}, "showBoll"), "BB(20,2)");
  assert.equal(C.label({}, "showStoch"), "Stoch(14,3)");
  assert.equal(C.label({}, "showVwap"), "VWAP");
  assert.equal(C.label({}, "showRsSpy", { bench: ["SPY", "QQQ"] }), "RS/SPY");
  assert.equal(C.label({}, "showRsQqq", { bench: ["코스피200", "코스닥150"] }), "RS/코스닥150");
  assert.equal(C.label({ showSma20: { p: 50 } }, "showSma20"), "SMA(50)");
  assert.equal(C.label({ showBoll: { p: 30, m: 2.5 } }, "showBoll"), "BB(30,2.5)");
});

test("파라미터: 범위 자르기·정수 반올림·MACD 단기<장기", () => {
  assert.equal(C.get({ showRsi: { p: 1 } }, "showRsi").p, 2);
  assert.equal(C.get({ showRsi: { p: 999 } }, "showRsi").p, 100);
  assert.equal(C.get({ showSma20: { p: 49.6 } }, "showSma20").p, 50);
  assert.equal(C.get({ showSma20: { p: "abc" } }, "showSma20").p, 20, "숫자가 아니면 기본값");
  assert.equal(C.get({ showBoll: { m: 2.04 } }, "showBoll").m, 2);
  const m = C.get({ showMacd: { f: 30, s: 20 } }, "showMacd");
  assert.ok(m.f < m.s, "단기가 장기 이상이면 장기를 올린다");
  assert.deepEqual(C.get(undefined, "showMacd"), { f: 12, s: 26, g: 9 });
});

test("파라미터 직렬화: 기본값과 같은 키는 빼고, 모르는 id·값은 버린다(프리셋 하위호환)", () => {
  const raw = { showSma20: { p: 50 }, showSma60: { p: 60 }, showRsi: { p: 21, junk: 1 }, showVwap: { p: 3 }, nope: { p: 5 }, extra: [{ t: "sma", p: 200 }, { t: "ema", p: 50 }, { t: "sma", p: 200 }, { t: "wma", p: 9 }] };
  const n = C.normalize(raw);
  assert.deepEqual(n, { showSma20: { p: 50 }, showRsi: { p: 21 }, extra: [{ t: "sma", p: 200 }, { t: "ema", p: 50 }] });
  const round = C.deserialize(C.serialize(raw));
  assert.deepEqual(round, n, "직렬화 → 역직렬화 왕복");
  assert.deepEqual(C.deserialize("{깨진 json"), {});
  assert.deepEqual(C.normalize(null), {});
  assert.deepEqual(C.normalize({ showSma20: { p: 20 } }), {}, "기본값만 있으면 빈 객체");
});

test("파라미터 바꾸기·되돌리기", () => {
  let p = C.setParam({}, "showSma20", "p", 50);
  assert.deepEqual(p, { showSma20: { p: 50 } });
  p = C.setParam(p, "showBoll", "m", 3);
  assert.equal(C.label(p, "showBoll"), "BB(20,3)");
  p = C.resetParams(p, "showSma20");
  assert.deepEqual(p, { showBoll: { m: 3 } });
});

test("추가 이평: 중복 제거·최대 개수·범위", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ t: "sma", p: 10 + i }));
  assert.equal(C.sanitizeExtra(many).length, C.EXTRA_MAX);
  assert.deepEqual(C.sanitizeExtra([{ t: "ema", p: 999 }]), [{ t: "ema", p: 250 }]);
  assert.deepEqual(C.sanitizeExtra("x"), []);
  assert.equal(C.extraLabel({ t: "ema", p: 50 }), "EMA(50)");
});

test("MACD 파라미터: 기본(12,26,9)은 예전 값과 같고, 바꾸면 워밍업도 따라간다", () => {
  const closes = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 5) * 5 + i * 0.1);
  const a = I.macdSeries(closes);
  const b = I.macdSeries(closes, 12, 26, 9);
  assert.deepEqual(a, b);
  assert.equal(a.macd[32], null);
  assert.notEqual(a.macd[33], null);
  const c = I.macdSeries(closes, 5, 35, 5);
  assert.equal(c.macd[37], null);
  assert.notEqual(c.macd[38], null, "워밍업 = 장기 + 시그널 - 2");
});

// ---- 멀티 차트 ----
test("레이아웃: 칸 수·봉 종류 검증, 기본 칸", () => {
  assert.deepEqual(C.sanitizeLayout(null).n, 1);
  assert.equal(C.sanitizeLayout({ n: 3 }).n, 1, "1·2·4 외는 1");
  const L = C.sanitizeLayout({ n: 4, cells: [{ ticker: " AAPL ", tf: "W" }, { tf: "m5" }, { ticker: "MSFT", tf: "X" }] });
  assert.equal(L.n, 4);
  assert.deepEqual(L.cells[0], { ticker: "AAPL", tf: "W" });
  assert.deepEqual(L.cells[1], { ticker: "", tf: "m5" });
  assert.deepEqual(L.cells[2], { ticker: "MSFT", tf: "D" }, "모르는 봉은 기본값");
  assert.equal(L.cells.length, 3);
});

test("칸 클릭 = 메인과 맞바꾸기", () => {
  const L = { n: 4, cells: [{ ticker: "", tf: "W" }, { ticker: "MSFT", tf: "D" }, { ticker: "@bench", tf: "M" }] };
  const a = C.swapWithMain(L, 0, { ticker: "AAPL", tf: "D", bench: "SPY" });
  assert.deepEqual(a.main, { ticker: "AAPL", tf: "W" }, "같은 종목 칸은 봉만");
  assert.deepEqual(a.layout.cells[0], { ticker: "", tf: "D" });
  const b = C.swapWithMain(L, 1, { ticker: "AAPL", tf: "D", bench: "SPY" });
  assert.deepEqual(b.main, { ticker: "MSFT", tf: "D" });
  assert.deepEqual(b.layout.cells[1], { ticker: "AAPL", tf: "D" });
  const c = C.swapWithMain(L, 2, { ticker: "AAPL", tf: "D", bench: "SPY" });
  assert.deepEqual(c.main, { ticker: "SPY", tf: "M" });
  assert.deepEqual(c.layout.cells[2], { ticker: "AAPL", tf: "D" });
});

test("크로스헤어 시간 동기화: 같은 날짜 봉 찾기(일·주·월·분봉)", () => {
  const daily = ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19"];
  assert.equal(C.barIndexForDate(daily, "2026-10-15"), 2);
  assert.equal(C.barIndexForDate(daily, "2026-10-17"), 4, "휴장일은 다음 봉");
  assert.equal(C.barIndexForDate(daily, "2026-10-20"), -1, "범위 뒤");
  assert.equal(C.barIndexForDate(daily, "2026-01-02"), -1, "범위 앞");
  const weekly = ["2026-10-02", "2026-10-09", "2026-10-16"]; // 주 마지막 거래일
  assert.equal(C.barIndexForDate(weekly, "2026-10-14"), 2, "수요일 → 그 주 봉");
  assert.equal(C.barIndexForDate(weekly, "2026-09-30"), 0, "첫 주 안");
  const monthly = ["2026-08-31", "2026-09-30", "2026-10-21"];
  assert.equal(C.barIndexForDate(monthly, "2026-09-15"), 1);
  const intraday = ["2026-10-20 15:30", "2026-10-21 09:30", "2026-10-21 10:00", "2026-10-21 10:30"];
  assert.equal(C.barIndexForDate(intraday, "2026-10-21"), 1, "날짜만 오면 그날 첫 봉");
  assert.equal(C.barIndexForDate(intraday, "2026-10-21 10:10"), 3, "분봉끼리는 시각까지");
  assert.equal(C.barIndexForDate(daily, "2026-10-15 10:10"), 2, "분봉 시각 → 일봉 그날");
  assert.equal(C.barIndexForDate([], "2026-10-15"), -1);
});

test("패널 높이: 범위로 자르고 모르는 키는 버린다", () => {
  assert.deepEqual(C.sanitizePanelHeights({ rsi: 10, macd: 999, volume: 80.4, "bad key": 50, x: "a" }), { rsi: C.PANEL_H_MIN, macd: C.PANEL_H_MAX, volume: 80 });
  assert.deepEqual(C.sanitizePanelHeights(null), {});
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`OK chart-ind-core ${passed} tests`);
