// ETF 룩스루(lookthrough-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_lookthrough_core.mjs   (CI 의 "Lookthrough / broker CSV tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../lookthrough-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const near = (a, b, eps = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} expected ${b}, got ${a}`);

const QQQ = { asOf: "2026-06-30", holdingsCount: 101,
  top: [{ t: "NVDA", n: "NVIDIA Corp.", w: 8 }, { t: "AAPL", n: "Apple Inc.", w: 7 }, { t: "MSFT", n: "Microsoft", w: 6 }],
  sectors: [["TECHNOLOGY", 60], ["CONSUMER CYCLICAL", 20]], sectorUnmapped: 5 };
const VOO = { asOf: "2026-05-31", holdingsCount: 503,
  top: [{ t: "NVDA", n: "NVIDIA Corporation", w: 7 }, { t: "AAPL", n: "Apple Inc", w: 6 }, { t: "JPM", n: "JPMorgan", w: 2 }] };

test("직접 + ETF 경유 합산", () => {
  const r = core.computeLookthrough({
    positions: [
      { ticker: "NVDA", name: "NVIDIA", value: 500, isEtf: false, sector: "TECHNOLOGY" },
      { ticker: "QQQ", name: "Invesco QQQ", value: 500, isEtf: true },
    ],
    etfs: { QQQ },
  });
  const nvda = r.exposures.find((e) => e.ticker === "NVDA");
  near(nvda.directPct, 50);
  near(nvda.viaPct, 4);          // 50% × 8%
  near(nvda.totalPct, 54);
  assert.equal(nvda.sources.length, 2);
  assert.equal(r.exposures[0].ticker, "NVDA");
  assert.equal(r.multiSourceCount, 1);
  near(r.coverage.directPct, 50);
  near(r.coverage.etfCoveredPct, 50 * 0.21);
  near(r.coverage.etfRestPct, 50 * 0.79);
});

test("ETF 간 가중 중복도 = Σ min(비중)", () => {
  const o = core.pairOverlap(QQQ, VOO);
  near(o.overlapPct, 7 + 6);     // NVDA min(8,7) + AAPL min(7,6)
  assert.equal(o.commonCount, 2);
  assert.equal(o.common[0].ticker, "NVDA");
  const r = core.computeLookthrough({
    positions: [{ ticker: "QQQ", value: 1, isEtf: true }, { ticker: "VOO", value: 3, isEtf: true }],
    etfs: { QQQ, VOO },
  });
  assert.equal(r.overlaps.length, 1);
  near(r.overlaps[0].overlapPct, 13);
  assert.equal(r.overlaps[0].asOfA, "2026-06-30");
});

test("티커 없는 구성 종목은 이름 정규화로 묶는다", () => {
  const A = { top: [{ n: "APPLE INC", w: 10 }, { n: "원화예금", w: 1, k: "cash" }] };
  const B = { top: [{ n: "Apple Inc", w: 5 }] };
  // "APPLE INC" vs "Apple Inc" → 같은 키
  near(core.pairOverlap(A, B).overlapPct, 5);
  const r = core.computeLookthrough({ positions: [{ ticker: "X", value: 1, isEtf: true }, { ticker: "Y", value: 1, isEtf: true }], etfs: { X: A, Y: B } });
  assert.equal(r.exposures.filter((e) => /apple/i.test(e.name)).length, 1);
  // 현금성은 종목 노출에서 뺀다
  assert.ok(!r.exposures.some((e) => e.name === "원화예금"));
});

test("구성 데이터 없는 ETF 는 따로 센다", () => {
  const r = core.computeLookthrough({
    positions: [{ ticker: "069500", name: "KODEX 200", value: 100, isEtf: true }, { ticker: "005930", value: 100, isEtf: false, sector: "기술" }],
    etfs: {}, missing: { "069500": "구성 데이터 없음" },
  });
  near(r.coverage.etfMissingPct, 50);
  assert.equal(r.etfRows[0].status, "missing");
  assert.ok(r.sectors.some((s) => s.sector === "__nodata" && Math.abs(s.pct - 50) < 1e-9));
  assert.equal(r.sectors[0].sector, "기술");   // 특수 버킷은 뒤로
});

test("섹터: ETF 섹터 분포 사용 + 비주식 나머지, 분포가 없으면 상위 종목으로 근사", () => {
  const r = core.computeLookthrough({ positions: [{ ticker: "QQQ", value: 100, isEtf: true }], etfs: { QQQ } });
  const s = Object.fromEntries(r.sectors.map((x) => [x.sector, x.pct]));
  near(s.TECHNOLOGY, 60); near(s.__unmapped, 5); near(s.__nonequity, 15);
  const r2 = core.computeLookthrough({ positions: [{ ticker: "VOO", value: 100, isEtf: true }], etfs: { VOO },
    sectorOf: (t) => ({ NVDA: "TECHNOLOGY", AAPL: "TECHNOLOGY", JPM: "FINANCIAL" }[t]) });
  const s2 = Object.fromEntries(r2.sectors.map((x) => [x.sector, x.pct]));
  near(s2.TECHNOLOGY, 13); near(s2.FINANCIAL, 2); near(s2.__rest, 85);
});

test("비중 합 = 100 (종목 노출 + 공개 상위 밖 + 데이터 없음 + 현금)", () => {
  const r = core.computeLookthrough({
    positions: [{ ticker: "AAPL", value: 30, isEtf: false }, { ticker: "QQQ", value: 50, isEtf: true }, { ticker: "Z", value: 20, isEtf: true }],
    etfs: { QQQ },
  });
  const c = r.coverage;
  near(c.directPct + c.etfCoveredPct + c.etfRestPct + c.etfMissingPct, 100, 1e-9);
});

test("topN 제한과 빈 입력", () => {
  const r = core.computeLookthrough({ positions: [{ ticker: "QQQ", value: 1, isEtf: true }], etfs: { QQQ }, topN: 2 });
  assert.equal(r.exposures.length, 2);
  assert.equal(r.exposureCount, 3);
  const e = core.computeLookthrough({ positions: [] });
  assert.equal(e.hasEtf, false);
  assert.equal(e.exposures.length, 0);
});

if (failures.length) {
  console.error(`lookthrough-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log(`lookthrough-core: ${passed}개 통과`);
