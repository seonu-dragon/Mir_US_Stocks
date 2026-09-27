// 10-K 위험요인 변화 카드 순수 계산(risk-factors-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_risk_factors_core.mjs   (CI 의 "Risk factors core tests" 스텝)
// 입력은 build_risk_factor_changes.py schema 1 모양의 손으로 만든 최소 인덱스·종목 파일.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../risk-factors-core.js");

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

const COLS = ["cos", "jac", "add", "rem", "chg", "big", "same", "w", "wPrev", "filed", "prevFiled", "form", "pct"];
const INDEX = {
  schema: 1, count: 3, cols: COLS,
  tickers: {
    AAA: [0.9967, 0.8584, 9, 18, 31, 11, 61, 9691, 9819, "2025-10-31", "2024-11-01", "10-K", 50],
    "BRK.B": [0.999, 0.9, 2, 1, 4, 1, 33, 3111, 3024, "2026-03-02", "2025-02-24", "10-K", 0],
    ZZZ: [0.99, 0.75, 122, 136, 140, 75, 87, 14968, 18477, "2026-02-13", "2025-02-14", "10-K", 100],
  },
  failed: {
    JPMX: { reason: "no_prior", url: "https://www.sec.gov/x.htm", filed: "2026-02-13", form: "10-K" },
    ODD: { reason: "mystery" },
  },
  failText: { no_prior: "비교할 이전 연차보고서가 없습니다(최근 상장 등)" },
};

test("indexRow: cols 순서대로 이름 붙이기, 대소문자 무시, 없는 종목 null", () => {
  const r = core.indexRow(INDEX, "aaa");
  assert.equal(r.cos, 0.9967);
  assert.equal(r.add, 9);
  assert.equal(r.rem, 18);
  assert.equal(r.filed, "2025-10-31");
  assert.equal(r.pct, 50);
  assert.equal(core.indexRow(INDEX, "BRK.B").pct, 0);
  assert.equal(core.indexRow(INDEX, "NONE"), null);
  assert.equal(core.indexRow(null, "AAA"), null);
  assert.equal(core.indexRow({ tickers: { A: [1] } }, "A"), null, "cols 없으면 null");
});

test("indexRow: 옛 인덱스(pct 열 없음)는 pct=null", () => {
  const old = { cols: COLS.slice(0, -1), tickers: { A: INDEX.tickers.AAA.slice(0, -1) } };
  assert.ok(core.indexRow(old, "A").pct == null);
  assert.equal(core.pctText(core.indexRow(old, "A").pct), "—");
});

test("failureOf: 사유 문장 매핑 + 모르는 사유는 기본 문장", () => {
  const f = core.failureOf(INDEX, "jpmx");
  assert.equal(f.reason, "no_prior");
  assert.match(f.text, /이전 연차보고서/);
  assert.equal(f.url, "https://www.sec.gov/x.htm");
  assert.match(core.failureOf(INDEX, "ODD").text, /비교하지 못했습니다/);
  assert.equal(core.failureOf(INDEX, "AAA"), null);
});

test("wordsChange: 전년 대비 비율, 0·결측이면 null", () => {
  assert.ok(Math.abs(core.wordsChange(14968, 18477) - (14968 / 18477 - 1)) < 1e-12);
  assert.equal(core.wordsChange(100, 0), null);
  assert.equal(core.wordsChange(null, 10), null);
});

test("simText·pctText: 표시 형식", () => {
  assert.equal(core.simText(0.9967), "99.67%");
  assert.equal(core.simText(null), "—");
  assert.equal(core.pctText(49.6), "50");
  assert.equal(core.pctText(undefined), "—");
});

test("pctSentence: 종목 수·백분위 문장, 비교 대상 부족", () => {
  assert.match(core.pctSentence(80, 500), /500종목 중 80%보다 많이 바뀌었습니다/);
  assert.match(core.pctSentence(80, 1), /부족/);
  assert.match(core.pctSentence(null, 500), /부족/);
});

test("changeBand: 백분위 80↑ 큰 편, 20↓ 적은 편", () => {
  assert.equal(core.changeBand(80).key, "high");
  assert.equal(core.changeBand(50).key, "mid");
  assert.equal(core.changeBand(20).key, "low");
  assert.equal(core.changeBand(null), null);
});

test("headline: 개수·분량 문장, 0개는 '없음'", () => {
  const h = core.headline({ counts: { added: 3, removed: 0, big: 2 }, cur: { form: "10-K", words: 110 }, prev: { words: 100 } });
  assert.equal(h, "전년 10-K 대비 새 문단 3개 · 삭제 없음 · 크게 바뀐 문단 2개 · 분량 +10.0%");
  const h2 = core.headline({ counts: { added: 0, removed: 1, big: 0 }, cur: { form: "20-F", words: 90 }, prev: { words: 100 } });
  assert.equal(h2, "전년 20-F 대비 새 문단 없음 · 삭제 1개 · 분량 -10.0%");
  assert.equal(core.headline(null), "");
});

test("extractNote: 제목 대체 경로일 때만 경계 안내", () => {
  assert.equal(core.extractNote({ cur: "item", prev: "item" }), "");
  assert.match(core.extractNote({ cur: "heading", prev: "item" }), /Risk Factors/);
  assert.equal(core.extractNote(null), "");
});

test("listView: 처음 n개 + 나머지, 빈 문장 제외", () => {
  const items = [{ t: "a" }, { t: "" }, { t: "b" }, { t: "c" }, null];
  const v = core.listView(items, 2);
  assert.deepEqual(v.shown.map((x) => x.t), ["a", "b"]);
  assert.deepEqual(v.rest.map((x) => x.t), ["c"]);
  assert.equal(v.total, 3);
  assert.equal(core.listView(undefined, 2).total, 0);
});

test("논문 링크 상수", () => {
  assert.equal(core.PAPER_URL, "https://www.nber.org/papers/w25084");
  assert.match(core.PAPER_LABEL, /Lazy Prices/);
});

if (failures.length) {
  console.error(`FAIL ${failures.length}/${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`risk-factors-core: ${passed} passed`);
