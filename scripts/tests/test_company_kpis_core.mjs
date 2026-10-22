// 회사 KPI 표(company-kpis-core.js) 단위 테스트. 네트워크·DOM 없음.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../company-kpis-core.js");
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); } }

const P = { tickers: { TSLA: [
  { period: "Q3 2026", fileDate: "2026-10-21", exhibitUrl: "https://sec.gov/x", kpis: [{ label: "차량 인도량", value: "486,532 vehicles", change: "-2%" }, { label: "슈퍼차저 수", value: "84,465", change: "" }] },
  { period: "Q2 2026", fileDate: "2026-07-22", exhibitUrl: "javascript:x", kpis: [{ label: "차량 인도량", value: "443,956 vehicles", change: "" }, { label: "에너지 저장 배치", value: "9.6 GWh", change: "" }] },
  { period: "Q1 2026", fileDate: "2026-04-22", kpis: [] },
] } };

test("열은 오래된→최신, 행은 최신 라벨 먼저, 없는 칸은 null", () => {
  const t = core.table(P, "tsla");
  assert.deepEqual(t.columns.map((c) => c.period), ["Q2 2026", "Q3 2026"]);
  assert.deepEqual(t.rows.map((r) => r.label), ["차량 인도량", "슈퍼차저 수", "에너지 저장 배치"]);
  assert.equal(t.rows[1].cells[0], null);
  assert.equal(t.rows[0].cells[1].change, "-2%");
  assert.equal(t.columns[0].url, "");
  assert.equal(core.table(P, "AAPL"), null);
  assert.equal(core.table({ tickers: { X: [{ kpis: [] }] } }, "X"), null);
});

test("열 머리", () => {
  assert.equal(core.columnLabel({ period: "Q3 2026" }), "Q3 2026");
  assert.equal(core.columnLabel({ period: "fiscal 2026 third quarter results", fileDate: "2026-10-21" }), "26.10 발표");
});

if (failures.length) { console.error(`company-kpis-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`); process.exit(1); }
console.log(`company-kpis-core: ${passed}개 통과`);
