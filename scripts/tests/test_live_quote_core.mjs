// 종목 분석 '현재' 시세 계산(live-quote-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_live_quote_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const L = require("../../live-quote-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const bar = (t, c) => [c, c, c, c, 100, t];

test("장중: 스냅샷(전 거래일 종가) 대비 등락", () => {
  const r = L.computeLiveQuote({
    bars: [bar("2026-10-01T15:59", 229), bar("2026-10-01T16:00", 230), bar("2026-10-02T10:30", 234.6)],
    snapPrice: 230, snapDate: "2026-10-01", nowLocal: "2026-10-02T10:31", market: "us",
  });
  assert.equal(r.state, "live");
  assert.equal(r.price, 234.6);
  assert.equal(r.prevClose, 230);
  assert.ok(Math.abs(r.changePct - 2) < 1e-9);
  assert.ok(Math.abs(r.change - 4.6) < 1e-9);
});

test("정규장 전: 스냅샷 뒤 새 거래가 없으면 nosession", () => {
  const r = L.computeLiveQuote({
    bars: [bar("2026-10-01T16:00", 230)], snapPrice: 230, snapDate: "2026-10-01", nowLocal: "2026-10-02T08:00", market: "us",
  });
  assert.equal(r.state, "nosession");
});

test("국내 야후 분봉 20분 지연은 장중으로 본다, 장 끝난 뒤는 closed", () => {
  const bars = [bar("2026-10-01T15:30", 273000), bar("2026-10-02T10:33", 274250)];
  const live = L.computeLiveQuote({ bars, snapPrice: 273000, snapDate: "2026-10-01", nowLocal: "2026-10-02T10:53", market: "kr" });
  assert.equal(live.state, "live");
  assert.equal(live.delayed, 20);
  const closed = L.computeLiveQuote({ bars, snapPrice: 273000, snapDate: "2026-10-01", nowLocal: "2026-10-02T17:00", market: "kr" });
  assert.equal(closed.state, "closed");
});

test("스냅샷이 이틀 전이면 분봉의 앞 거래일 마지막 봉을 전일 종가로", () => {
  const r = L.computeLiveQuote({
    bars: [bar("2026-09-30T16:00", 220), bar("2026-10-01T16:00", 225), bar("2026-10-02T11:00", 229.5)],
    snapPrice: 220, snapDate: "2026-09-30", nowLocal: "2026-10-02T11:01", market: "us",
  });
  assert.equal(r.prevClose, 225);
  assert.ok(Math.abs(r.changePct - 2) < 1e-9);
});

test("워커 quote(네이버): 현재가·정규장 전일 종가는 quote 값(스냅샷 종가와 달라도)", () => {
  const r = L.computeLiveQuote({
    bars: [bar("2026-10-02T10:33", 274250)],
    quote: { price: 276000, prevClose: 274500, marketState: "OPEN", time: "2026-10-02T01:57:00Z", localTime: "2026-10-02T10:57:00+09:00", source: "naver" },
    snapPrice: 273000, snapDate: "2026-10-01", market: "kr",
  });
  assert.equal(r.state, "live");
  assert.equal(r.price, 276000);
  assert.equal(r.prevClose, 274500);
  assert.equal(r.source, "naver");
  assert.ok(Math.abs(r.changePct - (276000 / 274500 - 1) * 100) < 1e-9);
});

test("워커 quote 날짜가 스냅샷 기준일과 같으면 새 거래 없음", () => {
  const r = L.computeLiveQuote({
    quote: { price: 273000, prevClose: 270000, marketState: "CLOSE", localTime: "2026-10-01T15:30:00+09:00", source: "naver" },
    snapPrice: 273000, snapDate: "2026-10-01", market: "kr",
  });
  assert.equal(r.state, "nosession");
});

test("워커 quote 에 전일 종가가 없으면 스냅샷 종가", () => {
  const r = L.computeLiveQuote({ quote: { price: 110, marketState: "OPEN", localTime: "2026-10-02T10:00", source: "naver" }, snapPrice: 100, snapDate: "2026-10-01" });
  assert.ok(Math.abs(r.changePct - 10) < 1e-9);
});

test("데이터 없음", () => {
  assert.equal(L.computeLiveQuote({ bars: [] }).state, "none");
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log(`live quote core: ${passed} passed`);
