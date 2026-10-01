// 찾기 › 필터 목록 순수 로직(named-filters-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_named_filters_core.mjs   (CI 의 "Named filters core tests" 스텝)
//
// 보는 것: 정의 형식(id·시장·이름에 평가어 없음·수식 컴파일), 시장별 목록·필드 거르기, 선택 우선순위,
// 개수 계산(formula-core 와 같은 결과), 과거 결과 문장(정의가 바뀌면 숨김·검증 데이터 없음·주의 문구),
// 그리고 커밋된 data/(korea/)named_filter_stats.json 이 지금 정의와 맞는지.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const core = require(path.join(ROOT, "named-filters-core.js"));
const fcore = require(path.join(ROOT, "formula-core.js"));

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

// formula-screener.js FX_FIELDS 의 키(정의가 쓰는 필드는 전부 여기에 있어야 한다).
const fxSrc = readFileSync(path.join(ROOT, "formula-screener.js"), "utf8");
const FX_KEYS = [...fxSrc.matchAll(/\{ key: "([A-Za-z0-9_]+)"/g)].map((m) => m[1]);

test("정의 형식: id 고유·형식, 시장, 그룹, 이름·설명", () => {
  const ids = new Set();
  const groups = new Set(core.GROUPS.map((g) => g.id));
  for (const f of core.FILTERS) {
    assert.ok(/^[a-z0-9][a-z0-9-]{0,40}$/.test(f.id), `id 형식: ${f.id}`);
    assert.ok(!ids.has(f.id), `id 중복: ${f.id}`);
    ids.add(f.id);
    assert.ok(Array.isArray(f.markets) && f.markets.length && f.markets.every((m) => m === "us" || m === "kr"), `markets: ${f.id}`);
    assert.ok(groups.has(f.group), `group: ${f.id}`);
    assert.ok(f.name && f.name.length <= 40, `이름 길이: ${f.id}`);
    assert.ok(f.rule && f.rule.length >= 20, `설명: ${f.id}`);
  }
});

test("이름·설명에 평가어가 없다", () => {
  for (const f of core.FILTERS) {
    assert.deepEqual(core.evaluativeWordsIn(f.name), [], `${f.id} 이름: ${f.name}`);
    assert.deepEqual(core.evaluativeWordsIn(f.rule), [], `${f.id} 설명`);
  }
  assert.deepEqual(core.evaluativeWordsIn("저평가 우량주"), ["우량", "저평가"]);
});

test("시장마다 10~14개, 모든 수식이 수식 스크리너 필드로 컴파일된다", () => {
  for (const m of ["us", "kr"]) {
    const list = core.forMarket(m, FX_KEYS, fcore);
    const all = core.FILTERS.filter((f) => f.markets.includes(m));
    assert.equal(list.length, all.length, `${m}: 컴파일 실패한 정의가 있다 (${all.filter((f) => !list.some((x) => x.id === f.id)).map((f) => f.id)})`);
    assert.ok(list.length >= 10 && list.length <= 14, `${m}: ${list.length}개`);
    list.forEach((f) => assert.ok(f.compiled && f.compiled.ok && f.compiled.type === "bool", f.id));
  }
  // 정의 필드는 전부 수식 스크리너 필드다.
  core.definitionFields().forEach((k) => assert.ok(FX_KEYS.includes(k), `알 수 없는 필드 ${k}`));
});

test("시장별 필드: 국내 전용 재무 필드는 미국 목록에 없다", () => {
  const us = core.forMarket("us", FX_KEYS, fcore);
  const usFields = new Set(us.flatMap((f) => f.compiled.fields));
  ["debtRatio", "operatingGrowth", "revenueGrowth", "payoutRatio", "foreignPct"].forEach((k) => assert.ok(!usFields.has(k), `US 에 ${k}`));
  const kr = core.forMarket("kr", FX_KEYS, fcore);
  const krFields = new Set(kr.flatMap((f) => f.compiled.fields));
  ["forwardPE", "epsGrowthEst", "currentRatio"].forEach((k) => assert.ok(!krFields.has(k), `KR 에 ${k}`));
});

test("값 있는 필드만 주면 그 필드를 쓰는 필터는 빠진다", () => {
  const keys = FX_KEYS.filter((k) => k !== "fScore");
  const list = core.forMarket("us", keys, fcore);
  assert.ok(!list.some((f) => f.id === "fscore8"));
  assert.ok(list.some((f) => f.id === "near-52w-high"));
  // 그룹 순서: 가격 → 재무 → 배당 → 위험
  const order = core.GROUPS.map((g) => g.id);
  const seen = list.map((f) => order.indexOf(f.group));
  assert.deepEqual(seen, seen.slice().sort((a, b) => a - b));
});

test("선택 우선순위: URL > 저장 > 첫 항목, 이상한 id 무시", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(core.resolveSelection(list, "b", "c"), "b");
  assert.equal(core.resolveSelection(list, "zz", "c"), "c");
  assert.equal(core.resolveSelection(list, "", "nope"), "a");
  assert.equal(core.resolveSelection(list, "<script>", null), "a");
  assert.equal(core.resolveSelection([], "a", "b"), "");
  assert.equal(core.sanitizeId(" Near-52W-High "), "near-52w-high");
  assert.equal(core.sanitizeId("a b"), "");
});

test("개수 = formula-core filterIndices 결과(결측은 불충족)", () => {
  const rows = [
    { newHighDistancePct: 0, rsi14: 25, volumeRatio: 3.2 },
    { newHighDistancePct: 4.9, rsi14: 31, volumeRatio: 1 },
    { newHighDistancePct: 5, rsi14: null, volumeRatio: 2.99 },
    { newHighDistancePct: 5.1, rsi14: 30, volumeRatio: null },
    { newHighDistancePct: null },
  ];
  const ctx = { get: (r, k) => (r[k] == null ? null : r[k]), group: () => null };
  const list = core.forMarket("us", ["newHighDistancePct", "rsi14", "volumeRatio"], fcore);
  const counts = core.countAll(list, rows, ctx, fcore);
  assert.equal(counts["near-52w-high"], 3);
  assert.equal(counts["rsi-under-30"], 2);
  assert.equal(counts["volume-3x"], 1);
  assert.equal(core.countMatches(null, rows, ctx, fcore), null);
});

test("ROE + 섹터 중앙값 PER: 그룹 집계와 적자 제외", () => {
  const rows = [];
  for (let i = 0; i < 6; i++) rows.push({ sector: "T", pe: 10 + i * 2, roe: 20 }); // pe 10..20, 중앙 15
  rows.push({ sector: "T", pe: -5, roe: 30 });
  const ctx = { get: (r, k) => r[k] ?? null, group: (r, g) => r[g] };
  const f = core.forMarket("us", FX_KEYS, fcore).find((x) => x.id === "roe15-per-sector");
  // 섹터 중앙값은 pe 값 7개(−5 포함) 기준 = 14. 통과 = pe>0 이고 14 미만 → 10, 12
  assert.equal(core.countMatches(f.compiled, rows, ctx, fcore), 2);
});

test("과거 결과 문장", () => {
  const f = core.BY_ID["near-52w-high"];
  const stats = { market: "us", filters: { "near-52w-high": {
    formula: f.formula, startDate: "2022-10-03", endDate: "2026-09-01", months: 47, costRate: 0.001,
    cagr: 0.087, ewCagr: 0.14, avgHoldings: 430.4, cashMonths: 0, verdict: "insufficient", verdictLabel: "불충분" } } };
  const h = core.historyFor(stats, f);
  assert.equal(h.kind, "ok");
  assert.ok(h.text.includes("2022.10~2026.09 47개월"), h.text);
  assert.ok(h.text.includes("연환산 +8.7%"), h.text);
  assert.ok(h.text.includes("동일가중 +14.0%"), h.text);
  assert.ok(h.text.includes("거래비용 편도 0.1%"), h.text);
  assert.equal(h.caveat, "과거 결과이며 미래 수익을 뜻하지 않습니다.");
  assert.equal(h.verdict, "불충분");
  // 정의가 바뀌면 옛 결과를 보이지 않는다
  const stale = { filters: { "near-52w-high": { ...stats.filters["near-52w-high"], formula: "newHighDistancePct <= 3" } } };
  assert.equal(core.historyFor(stale, f).kind, "none");
  // 패널에 없는 필드
  const miss = { filters: { fscore8: { formula: core.BY_ID.fscore8.formula, missing: ["fScore"] } } };
  const hm = core.historyFor(miss, core.BY_ID.fscore8);
  assert.equal(hm.kind, "none");
  assert.ok(hm.text.startsWith("검증 데이터 없음"), hm.text);
  assert.ok(hm.text.includes("fScore"));
  // 파일 없음
  assert.equal(core.historyFor(null, f).text, "검증 데이터 없음");
  // 음수 표기
  assert.equal(core.pctText(-0.155), "−15.5%");
  assert.equal(core.pctText(null), "—");
});

test("커밋된 과거 결과 파일이 지금 정의와 맞고 .js 와 같다", () => {
  for (const [m, rel] of [["us", "data/named_filter_stats"], ["kr", "data/korea/named_filter_stats"]]) {
    const jsonPath = path.join(ROOT, `${rel}.json`);
    if (!existsSync(jsonPath)) continue; // 첫 빌드 전
    const doc = JSON.parse(readFileSync(jsonPath, "utf8"));
    const js = readFileSync(path.join(ROOT, `${rel}.js`), "utf8");
    const m2 = /^window\.NAMED_FILTER_STATS = (.*);\s*$/s.exec(js);
    assert.ok(m2, `${rel}.js 형식`);
    assert.deepEqual(JSON.parse(m2[1]), doc, `${rel}.js ≠ .json`);
    assert.equal(doc.market, m);
    const defs = core.FILTERS.filter((f) => f.markets.includes(m));
    for (const f of defs) {
      const row = doc.filters[f.id];
      assert.ok(row, `${m} ${f.id} 결과 없음 — node scripts/build_named_filter_stats.mjs`);
      assert.equal(row.formula, f.formula, `${m} ${f.id} 수식이 정의와 다름 — 다시 빌드`);
      if (!row.missing && !row.error) {
        assert.ok(row.months > 0 && Number.isFinite(row.cagr) && Number.isFinite(row.ewCagr), `${m} ${f.id} 수치`);
        assert.ok(["pass", "insufficient", "overfit"].includes(row.verdict), `${m} ${f.id} 판정`);
      }
    }
    assert.equal(doc.count, Object.values(doc.filters).filter((r) => !r.missing && !r.error).length);
  }
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`named-filters-core: ${passed} passed`);
