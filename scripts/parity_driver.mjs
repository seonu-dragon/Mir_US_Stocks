// JS 패턴 감지 패리티 드라이버 (parity_driver.mjs)
// ==================================================
// check_pattern_parity.py 가 만든 합성 OHLCV 픽스처(JSON)를 읽어, 브라우저용
// analysis.js + pattern_detectors_extended.js 의 detectConfirmations 를 node 에서
// 실행하고 이벤트 목록(pattern, dir, confirm_idx)을 JSON 으로 쓴다.
//
// analysis.js 는 브라우저 전역(window/document) 스타일이라 최소 shim 을 깔고
// vm.runInThisContext 로 전역 스코프에 로드한다. init() 은 DOMContentLoaded 에만
// 걸려 있어 실제로는 실행되지 않는다 — 순수 계산 함수만 쓴다.
//
// 사용:  node scripts/parity_driver.mjs <fixtures.json> <out.json>

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const [fixturesPath, outPath] = process.argv.slice(2);
if (!fixturesPath || !outPath) {
  console.error("usage: node parity_driver.mjs <fixtures.json> <out.json>");
  process.exit(2);
}

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ----- 브라우저 전역 shim (analysis.js 로드용 최소한) -----
global.window = globalThis; // window.MirProb / window.MirPatternExt 가 전역에 붙도록
const noopEl = () => ({
  style: {},
  dataset: {},
  classList: { add() {}, remove() {}, toggle() {} },
  setAttribute() {},
  appendChild() {},
  addEventListener() {},
  querySelectorAll: () => [],
  querySelector: () => null,
});
global.document = {
  addEventListener() {}, // DOMContentLoaded 를 버린다 → init() 미실행
  removeEventListener() {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: noopEl,
  body: noopEl(),
  documentElement: noopEl(),
};
try {
  global.location = { search: "", href: "", pathname: "/" };
} catch (e) { /* node 버전에 따라 읽기전용일 수 있다 */ }
try {
  if (typeof global.navigator === "undefined") global.navigator = { userAgent: "node-parity" };
} catch (e) { /* 무시 */ }

// ----- 감지기 로드 (확장 감지기 → 본체 순서: analysis.html 의 로드 순서와 동일) -----
function loadScript(rel) {
  const p = path.join(ROOT, rel);
  const code = fs.readFileSync(p, "utf-8");
  vm.runInThisContext(code, { filename: rel });
}
loadScript("pattern_detectors_extended.js");
loadScript("analysis.js");

if (!globalThis.MirProb || typeof globalThis.MirProb.detectConfirmations !== "function") {
  console.error("analysis.js 로드 실패: window.MirProb.detectConfirmations 없음");
  process.exit(2);
}
if (!globalThis.MirPatternExt) {
  console.error("pattern_detectors_extended.js 로드 실패: window.MirPatternExt 없음");
  process.exit(2);
}

// ----- 픽스처 → rows (파이썬 pattern_lib.rows_from_chart_series 와 동일 규칙) -----
function rowsFromChartSeries(series) {
  const rows = [];
  for (const r of series) {
    if (!r || r.length < 4) continue;
    const c = r[3];
    if (c == null || !(c > 0)) continue;
    rows.push({
      o: r[0], h: r[1], l: r[2], c,
      v: (r.length > 4 && r[4]) ? r[4] : 0,
      d: r.length > 5 ? r[5] : null,
    });
  }
  return rows;
}

const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));
const result = {};
for (const [name, series] of Object.entries(fixtures)) {
  const rows = rowsFromChartSeries(series);
  const events = globalThis.MirProb.detectConfirmations(rows).map((e) => ({
    pattern: e.pattern,
    dir: e.dir,
    confirm_idx: e.confirm_idx,
  }));
  result[name] = events;
}

fs.writeFileSync(outPath, JSON.stringify(result), "utf-8");
console.log(`parity_driver: ${Object.keys(result).length}개 픽스처 처리 완료`);
