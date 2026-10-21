// 수식 스크리너·찾기 표·클래식 스크리너의 추정치·의견·배당 성장·옵션 필드(formula-screener.js XM_METRICS) 테스트.
// formula-screener.js 를 node:vm 에 올리고 브라우저 전역(FEATURE_DATA·marketCfg 등)만 최소로 흉내 낸다. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_screen_extra_fields.mjs   (CI 의 "Screener extra fields tests" 스텝)
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

function makeCtx(market = "us", features = {}) {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  run("analyst-revisions-core.js");
  run("dividend-growth-core.js");
  run("formula-core.js");
  run("named-filters-core.js");
  // feature-data.js 의 실제 정의에서 쓰는 4개만(경로·플래그는 원본과 같아야 한다 — 아래 테스트가 대조).
  vm.runInContext(`
    const FEATURE_DATA = {
      usEstimateRevisions: { global: "US_ESTIMATE_REVISIONS", feature: "analystRevisions", usOnly: true },
      usRatingChanges: { global: "US_RATING_CHANGES", feature: "analystRevisions", usOnly: true },
      dividendGrowth: { global: "DIVIDEND_GROWTH", feature: "dividendGrowth", marketSpecific: true },
      optionsStats: { global: "OPTIONS_STATS", usOnly: true },
    };
    function featureDataEnabled(meta, cfg) {
      if (meta.usOnly) return cfg.id === "us";
      if (meta.krOnly) return cfg.id === "kr";
      if (meta.feature) return !(cfg.features && cfg.features[meta.feature] === false);
      return true;
    }
    let __cfg = ${JSON.stringify({ id: market, features })};
    function marketCfg() { return __cfg; }
    function isKrMarket() { return __cfg.id === "kr"; }
    function normalizeTickerKey(t) { return String(t || "").toUpperCase(); }
    function isStockEtf(s) { return s.sector === "ETF"; }
    function mapFundamentalsFor() { return {}; }
    function itemCapForValuation(it) { return it.marketCapB; }
    function rsiValue() { return null; }
    function low52DistPct() { return NaN; }
    function epsTtmValue() { return null; }
    const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "muted");
    let __ensured = [];
    function ensureFeatureData(k) { __ensured.push(k); return Promise.resolve(false); }
    let data = { updatedAtKst: "t", stocks: [] };
  `, ctx);
  run("formula-screener.js");
  return ctx;
}
const ev = (ctx, src) => vm.runInContext(src, ctx);

const EST = {
  cols: ["period", "end", "cur", "d7", "d30", "d60", "d90", "up7", "up30", "dn7", "dn30", "n"],
  tickers: { AAA: { p: [["0y", "2026-12-31", 5.5, 5.4, 5.0, 4.9, 4.4, 1, 4, 0, 0, 20]] } },
};
const RAT = { asOf: "2026-10-21", windowDays: 30, cols: ["t", "d", "firm", "act", "from", "to", "pt", "ptPrev", "ptAct"],
  rows: [["AAA", "2026-10-20", "F1", "up", "Hold", "Buy", 120, 100, "Raises"], ["AAA", "2026-10-11", "F2", "up", "Sell", "Hold", null, null, ""]] };
const DG = { lastYear: 2025, cols: ["up", "paid", "cagr5", "cagr10", "last", "since", "capped", "paidCapped", "lastCut", "specials"],
  tickers: { AAA: [12, 14, 6.6, 9.1, 0.99, 2012, true, true, null, 1] } };
const OPT = { stocks: { AAA: { putCallOI: 0.82, expectedMovePct: 1.8 } } };

test("feature-data.js 의 실제 정의와 테스트 흉내가 같다(전역 이름·usOnly/marketSpecific·feature)", () => {
  const src = fs.readFileSync(path.join(ROOT, "feature-data.js"), "utf8");
  // 배당 성장은 2026-10-22 부터 시장별 파일(국내 DART, build_kr_dividend_growth.py)이다.
  for (const [key, global, feature, scope] of [["usEstimateRevisions", "US_ESTIMATE_REVISIONS", "analystRevisions", "usOnly: true"], ["usRatingChanges", "US_RATING_CHANGES", "analystRevisions", "usOnly: true"], ["dividendGrowth", "DIVIDEND_GROWTH", "dividendGrowth", "marketSpecific: true"], ["optionsStats", "OPTIONS_STATS", null, "usOnly: true"]]) {
    const line = src.split("\n").find((l) => l.trim().startsWith(`${key}:`));
    assert.ok(line, key);
    assert.ok(line.includes(`global: "${global}"`) && line.includes(scope), line);
    if (feature) assert.ok(line.includes(`feature: "${feature}"`), line);
  }
});

test("US: 데이터가 오기 전에도 필드 목록에 있고, 국내에서는 미국 전용만 숨긴다", () => {
  const us = makeCtx("us");
  ev(us, `data.stocks = [{ ticker: "AAA", marketCapB: 10 }]`);
  const keys = ev(us, "fxAvailableFields().keys");
  ["epsRev30", "epsUp30", "ratingUp30", "targetChg30", "divGrowthYears", "optPcr", "optMove"].forEach((k) => assert.ok(keys.includes(k), k));
  assert.ok(!keys.includes("optIv"), "options_stats 에 IV 값이 없어 필드를 만들지 않는다");
  const kr = makeCtx("kr");
  ev(kr, `data.stocks = [{ ticker: "005930", marketCapB: 10 }]`);
  const kk = ev(kr, "fxAvailableFields().keys");
  ["epsRev30", "ratingUp30", "optPcr"].forEach((k) => assert.ok(!kk.includes(k), `국내 ${k}`));
  ["divGrowthYears", "divPaidYears", "divCagr5"].forEach((k) => assert.ok(kk.includes(k), `국내 배당 성장 ${k}(DART)`));
  const c = ev(kr, `MirFormulaCore.compile("epsRev30 > 0", fxCompileOptions("bool"))`);
  assert.equal(c.ok, false, "국내에서 쓰면 컴파일 오류");
});

test("market_config features === false 면 US 에서도 숨긴다(usOnly 와 따로 본다)", () => {
  const ctx = makeCtx("us", { analystRevisions: false });
  ev(ctx, `data.stocks = [{ ticker: "AAA", marketCapB: 10 }]`);
  const keys = ev(ctx, "fxAvailableFields().keys");
  assert.ok(!keys.includes("epsRev30") && !keys.includes("ratingUp30"));
  assert.ok(keys.includes("divGrowthYears"), "다른 데이터는 그대로");
  assert.equal(ev(ctx, "xmPresetEnabled('ratingUpCluster')"), false);
  assert.equal(ev(ctx, "xmPresetEnabled('estUpDiv10')"), false);
});

test("값: 데이터가 오면 계산, 없으면 null(0 아님) · 프리셋 판정", () => {
  const ctx = makeCtx("us");
  const it = { ticker: "AAA" };
  assert.equal(ev(ctx, `extraMetricValue(${JSON.stringify(it)}, "epsRev30")`), null);
  ctx.US_ESTIMATE_REVISIONS = EST;
  ctx.US_RATING_CHANGES = RAT;
  ctx.DIVIDEND_GROWTH = DG;
  ctx.OPTIONS_STATS = OPT;
  const get = (k, t = "AAA") => ev(ctx, `extraMetricValue({ ticker: "${t}" }, "${k}")`);
  assert.equal(Math.round(get("epsRev30") * 100) / 100, 10);
  assert.equal(get("epsUp30"), 4);
  assert.equal(get("epsDown30"), 0);
  assert.equal(get("ratingUp30"), 2);
  assert.equal(get("targetChg30"), 20);
  assert.equal(get("divGrowthYears"), 12);
  assert.equal(get("optPcr"), 0.82);
  assert.equal(get("optMove"), 1.8);
  assert.equal(get("epsRev30", "ZZZ"), null);
  assert.equal(get("divGrowthYears", "ZZZ"), null);
  assert.equal(ev(ctx, `XM_PRESETS.estUpDiv10.test({ ticker: "AAA" })`), true);
  assert.equal(ev(ctx, `XM_PRESETS.ratingUpCluster.test({ ticker: "AAA" })`), true);
  assert.equal(ev(ctx, `XM_PRESETS.ratingUpCluster.test({ ticker: "ZZZ" })`), false);
  assert.equal(ev(ctx, `xmFormatMetric(10, "epsRev30")`), "+10.0%");
  assert.equal(ev(ctx, `xmFormatMetric(12, "divGrowthYears")`), "12년");
  assert.equal(ev(ctx, `xmMetricClass(-3, "targetChg30")`), "neg");
  assert.equal(ev(ctx, `xmMetricClass(3, "ratingUp30")`), "");
  assert.equal(ev(ctx, `xmFormatMetric(-0.02, "epsRev30")`), "0.0%", "반올림해 0 이면 부호 없음");
  assert.equal(ev(ctx, `xmMetricClass(-0.02, "epsRev30")`), "", "0.0% 는 색 없음");
});

test("수식: 새 필드로 조건 실행(필터 목록 정의 포함)", () => {
  const ctx = makeCtx("us");
  // 받은 뒤에는 다른 필드처럼 30종목 이상 값이 있어야 목록에 남는다 — 같은 값의 종목 35개를 더 둔다.
  const many = (o) => { const out = { ...o }; for (let i = 0; i < 35; i += 1) out[`F${i}`] = o.AAA; return out; };
  ctx.US_ESTIMATE_REVISIONS = { ...EST, tickers: many(EST.tickers) };
  ctx.US_RATING_CHANGES = RAT;
  ctx.DIVIDEND_GROWTH = { ...DG, tickers: many(DG.tickers) };
  ctx.OPTIONS_STATS = OPT;
  ev(ctx, `data.stocks = [{ ticker: "AAA", marketCapB: 10 }, { ticker: "BBB", marketCapB: 5 }, ...Array.from({ length: 35 }, (_, i) => ({ ticker: "F" + i, marketCapB: 1 }))]`);
  const idx = ev(ctx, `(() => { const c = MirFormulaCore.compile("epsRev30 > 0 and divGrowthYears >= 10 and ratingUp30 >= 2", fxCompileOptions("bool")); if (!c.ok) throw new Error(c.error); return MirFormulaCore.filterIndices(c, fxRows(), fxCtx); })()`);
  assert.deepEqual([...idx], [0]);
  const nf = ev(ctx, `MirNamedFiltersCore.FILTERS.filter((f) => f.group === "est").map((f) => [f.id, MirFormulaCore.compile(f.formula, fxCompileOptions("bool")).ok])`);
  assert.ok(nf.length >= 2);
  nf.forEach(([id, ok]) => assert.ok(ok, id));
});

test("lazy 받기: 조건에 쓰인 필드의 데이터만, 꺼진 시장은 받지 않는다", async () => {
  const ctx = makeCtx("us");
  ev(ctx, `xmEnsure(["epsRev30", "price"])`);
  assert.deepEqual([...ev(ctx, "__ensured")], ["usEstimateRevisions"]);
  ev(ctx, `xmEnsure(["ratingUp30", "epsRev30"])`);
  assert.deepEqual([...ev(ctx, "__ensured")], ["usEstimateRevisions", "usRatingChanges"], "이미 받는 중인 것은 다시 부르지 않는다");
  const kr = makeCtx("kr");
  ev(kr, `xmEnsure(["epsRev30", "divGrowthYears", "optPcr"])`);
  assert.deepEqual([...ev(kr, "__ensured")], ["dividendGrowth"], "국내는 배당 성장(DART)만 받는다");
});

await new Promise((r) => setTimeout(r, 0));
if (failures.length) {
  console.error(`screen-extra-fields: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
console.log(`screen-extra-fields: ${passed} passed`);
