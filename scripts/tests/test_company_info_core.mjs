// 기업개요·목표주가 범위 순수 계산(company-info-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_company_info_core.mjs   (CI 의 "Company info core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const core = require("../../company-info-core.js");

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

test("shardOf 는 파이썬 zlib.crc32 % n 과 같다", () => {
  const crc = typeof zlib.crc32 === "function" ? (s) => zlib.crc32(Buffer.from(s, "utf8")) : null;
  // 빌더(scripts/shard_store.py)로 계산해 둔 값 — python -c "import zlib;print(zlib.crc32(b'AAPL')%16)"
  const known = { AAPL: 12, NVDA: 7, "005930": 24, "BRK.B": 12 };
  const got = { AAPL: core.shardOf("AAPL", 16), NVDA: core.shardOf("NVDA", 16), "005930": core.shardOf("005930", 32), "BRK.B": core.shardOf("BRK.B", 16) };
  assert.deepEqual(got, known);
  if (crc) for (const t of ["MSFT", "000660", "한글"]) assert.equal(core.shardOf(t, 16), crc(t) % 16, t);
});

test("결산월 라벨", () => {
  assert.equal(core.fiscalMonthLabel("12"), "12월");
  assert.equal(core.fiscalMonthLabel("0926"), "9월");
  assert.equal(core.fiscalMonthLabel("0131"), "1월");
  assert.equal(core.fiscalMonthLabel("1399"), "");
  assert.equal(core.fiscalMonthLabel(""), "");
});

test("홈페이지 링크는 도메인 모양만", () => {
  assert.equal(core.webHref("www.samsung.com/sec"), "http://www.samsung.com/sec");
  assert.equal(core.webHref("https://investor.apple.com"), "http://investor.apple.com");
  assert.equal(core.webHref("javascript:alert(1)"), "");
  assert.equal(core.webHref("-"), "");
});

test("이전 사명 라벨", () => {
  assert.deepEqual(core.formerNamesLabel([["APPLE COMPUTER INC", "1994", "2007"], ["X", "1997", "1997"]]),
    ["APPLE COMPUTER INC (1994–2007)", "X (1997)"]);
  assert.deepEqual(core.formerNamesLabel(null), []);
});

test("목표주가 범위 위치 — 현재가가 범위 안", () => {
  const g = core.rangeGeometry({ lo: 245, avg: 334.9, hi: 400 }, 341.07);
  assert.equal(g.priceSide, "inside");
  assert.ok(g.lo > 0 && g.lo < g.avg && g.avg < g.price && g.price < g.hi && g.hi < 100, JSON.stringify(g));
});

test("목표주가 범위 위치 — 현재가가 범위 밖이면 축을 넓힌다", () => {
  const g = core.rangeGeometry({ lo: 275, avg: 324.32, hi: 465 }, 225.07);
  assert.equal(g.priceSide, "below");
  assert.ok(g.price >= 0 && g.price < g.lo, JSON.stringify(g));
  assert.ok(g.hi <= 100);
});

test("목표주가 범위 — 잘못된 값이면 그리지 않는다", () => {
  assert.equal(core.rangeGeometry({ lo: 300, avg: 200, hi: 400 }, 250), null);
  assert.equal(core.rangeGeometry({ lo: 0, avg: 200, hi: 400 }, 250), null);
  assert.equal(core.rangeGeometry({ avg: 200 }, 250), null);
  const g = core.rangeGeometry({ lo: 100, avg: 100, hi: 100 }, null);
  assert.equal(g.price, null);
  assert.ok(Number.isFinite(g.lo));
});

test("평균 목표가 서술 — 권유 없이 차이만", () => {
  assert.equal(core.gapSentence(334.9, 341.07), "평균 목표가는 현재가보다 1.8% 낮습니다.");
  assert.equal(core.gapSentence(324.32, 225.07), "평균 목표가는 현재가보다 44.1% 높습니다.");
  assert.equal(core.gapSentence(100.2, 100), "평균 목표가는 현재가와 거의 같습니다.");
  assert.equal(core.gapSentence(100, 0), "");
  assert.ok(!/매수|추천|상승 여력/.test(core.gapSentence(200, 100)));
});

test("의견 분포 비율 합 100", () => {
  const s = core.opinionShares({ buy: 15, hold: 9, sell: 4 });
  assert.equal(s.n, 28);
  assert.equal(Math.round((s.buy + s.hold + s.sell) * 10) / 10, 100);
  assert.deepEqual(core.opinionShares({ buy: 1, hold: 1, sell: 1 }).n, 3);
  assert.equal(core.opinionShares({ buy: 0, hold: 0, sell: 0 }), null);
  assert.equal(core.opinionShares({ buy: 3 }), null);
});

test("인원 표기", () => {
  assert.equal(core.fmtCount(128881), "128,881");
  assert.equal(core.fmtCount(null), "");
});

console.log(`company-info-core: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error("  FAIL " + f);
  process.exit(1);
}
