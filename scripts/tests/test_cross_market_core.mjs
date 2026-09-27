// 국내↔미국 연관 종목 순수 계산(cross-market-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_cross_market_core.mjs   (CI 의 "Cross-market links core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../cross-market-core.js");

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

function link(kr, us, extra = {}) {
  return {
    kr, us, type: "peer", why: "테스트", source: "curated", n: 238,
    lagCorr: 0.3, lagCorrEx: 0.2, sameCorr: 0.1, sameCorrEx: 0.05, strength: "moderate", sameStrength: "weak",
    ...extra,
  };
}

const P = {
  usAsOf: "2026-09-25",
  krAsOf: "2026-09-23",
  typeLabels: { customer: "고객사", competitor: "경쟁사", peer: "같은 업종" },
  tickers: {
    us: { NVDA: { name: "NVIDIA", chg: 4.2, date: "2026-09-25" }, MU: { name: "Micron", chg: -2.5 }, SOXX: { name: "iShares Semi", chg: 1.0, etf: true }, AMAT: { name: "Applied", chg: 3.1 } },
    kr: { "000660": { name: "SK하이닉스", chg: 3.6 }, "005930": { name: "삼성전자", chg: -0.4 }, "240810": { name: "원익IPS", chg: 0.2 } },
  },
  links: [
    link("000660", "NVDA", { type: "customer", strength: "weak", lagCorrEx: 0.02 }),
    link("000660", "MU", { type: "competitor", strength: "strong", lagCorrEx: 0.35, sameStrength: "strong", sameCorrEx: 0.3 }),
    link("000660", "SOXX", { strength: "strong", lagCorrEx: 0.29 }),
    link("005930", "NVDA", { type: "customer", strength: "insufficient", lagCorrEx: null }),
    link("005930", "MU", { strength: "moderate", lagCorrEx: 0.2 }),
    link("240810", "AMAT", { source: "auto", type: "auto", strength: "strong", lagCorrEx: 0.4 }),
    link("000660", "AMAT", { source: "auto", type: "auto", strength: "moderate", lagCorrEx: 0.14 }),
  ],
};

test("종목 상세: 사람이 정한 관계 먼저, 강도·편상관 순", () => {
  const r = core.linksFor(P, "kr", "000660");
  assert.deepEqual(r.curated.map((x) => x.ticker), ["MU", "SOXX", "NVDA"]);
  assert.equal(r.curated[0].market, "us");
  assert.equal(r.curated[0].typeLabel, "경쟁사");
  assert.equal(r.curated[0].name, "Micron");
  assert.equal(r.curated[1].etf, true);
  assert.deepEqual(r.auto.map((x) => x.ticker), ["AMAT"]);
  assert.equal(r.auto[0].typeLabel, "데이터 후보");
});

test("종목 상세: 미국 쪽에서 보면 국내 종목이 나오고 대소문자 무관", () => {
  const r = core.linksFor(P, "us", "nvda");
  assert.deepEqual(r.curated.map((x) => x.ticker), ["000660", "005930"]);
  assert.equal(r.curated[0].market, "kr");
  assert.equal(r.curated[0].name, "SK하이닉스");
  assert.equal(r.curated[1].strength, "insufficient"); // 표본 부족도 상세에는 그대로 보여 준다(라벨로)
});

test("종목 상세: 표본 부족 자동 후보는 빼고, 없는 종목·깨진 데이터는 빈 결과", () => {
  const p2 = { ...P, links: [...P.links, link("005930", "AMAT", { source: "auto", strength: "insufficient" })] };
  assert.deepEqual(core.linksFor(p2, "kr", "005930").auto, []);
  assert.deepEqual(core.linksFor(P, "kr", "999999"), { curated: [], auto: [] });
  assert.deepEqual(core.linksFor(null, "kr", "000660"), { curated: [], auto: [] });
  assert.deepEqual(core.linksFor({ links: [] }, "kr", "000660"), { curated: [], auto: [] });
});

test("간밤 미국 보드: 문턱 이상 움직인 미국 종목만, 큰 순서, 연결 국내 종목(lag 기준)", () => {
  const b = core.moveBoard(P, "us", { minAbs: 2 });
  assert.equal(b.asOf, "2026-09-25");
  assert.deepEqual(b.rows.map((r) => r.ticker), ["NVDA", "AMAT", "MU"]); // SOXX(1.0%)는 문턱 미만
  const nvda = b.rows[0];
  // 005930-NVDA 는 표본 부족이라 빠진다
  assert.deepEqual(nvda.links.map((l) => l.ticker), ["000660"]);
  assert.equal(nvda.links[0].strengthNow, "weak");
  // 자동 후보는 '뚜렷'만: 240810-AMAT(strong) 포함, 000660-AMAT(moderate) 제외
  assert.deepEqual(b.rows[1].links.map((l) => l.ticker), ["240810"]);
  const mu = b.rows[2];
  assert.deepEqual(mu.links.map((l) => l.ticker), ["000660", "005930"]);
  assert.equal(mu.links[0].corrEx, 0.35);
});

test("국내 장 보드(US 모드): same 방향 강도·상관을 쓴다", () => {
  const b = core.moveBoard(P, "kr", { minAbs: 3 });
  assert.equal(b.asOf, "2026-09-23");
  assert.deepEqual(b.rows.map((r) => r.ticker), ["000660"]);
  const links = b.rows[0].links;
  assert.equal(links[0].ticker, "MU"); // sameStrength strong
  assert.equal(links[0].corrEx, 0.3);
  assert.equal(links[0].strengthNow, "strong");
});

test("보드: perTicker 로 자르고 나머지 수를 알려 준다, limit 적용", () => {
  const b = core.moveBoard(P, "kr", { minAbs: 0, perTicker: 1, limit: 1 });
  assert.equal(b.rows.length, 1);
  assert.equal(b.total, 2); // 240810 은 자동 후보(same 방향 '약함')뿐이라 빠진다
  assert.equal(b.rows[0].links.length, 1);
  assert.ok(b.rows[0].more >= 1);
});

test("보드: 등락 없는 종목·깨진 데이터", () => {
  const p2 = { ...P, tickers: { ...P.tickers, us: { ...P.tickers.us, NVDA: { name: "NVIDIA", chg: null } } } };
  assert.ok(!core.moveBoard(p2, "us", { minAbs: 0 }).rows.some((r) => r.ticker === "NVDA"));
  assert.deepEqual(core.moveBoard(null, "us").rows, []);
});

test("표기: 상관·강도·날짜", () => {
  assert.equal(core.corrText(0.3456), "0.35");
  assert.equal(core.corrText(-0.05), "−0.05");
  assert.equal(core.corrText(null), "—");
  assert.equal(core.strengthLabel("weak"), "관계 약함");
  assert.equal(core.strengthLabel("strong"), "관계 뚜렷");
  assert.equal(core.strengthLabel("???"), "표본 부족");
  assert.equal(core.shortDate("2026-09-25"), "9/25(금)");
  assert.equal(core.shortDate(""), "");
  assert.equal(core.typeLabel(P, "theme"), "연관 산업");
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`cross-market-core: ${passed} passed`);
