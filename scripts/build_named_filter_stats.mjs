#!/usr/bin/env node
// build_named_filter_stats.mjs — 찾기 › 필터 목록(named-filters-core.js)의 '과거 결과' 한 줄을 미리 계산한다.
// ==========================================================================
// 입력(읽기만, 네트워크 없음)
//   data/screener_backtest_meta.json · data/korea/screener_backtest_meta.json + 필드 샤드
//   (scripts/build_screener_backtest_panel.mjs 산출물 — 같은 워크플로우에서 바로 앞 단계가 만든다)
// 계산
//   화면의 수식 백테스트와 같은 코드(screener-backtest-core.js run · overfit-core.js verdict),
//   같은 기본값(거래비용 편도 0.1%, 최소 5종목). 판정의 시도 횟수 = 그 시장에서 계산한 필터 수
//   (여러 필터를 동시에 보여 주므로 그만큼 기준선을 올린다).
//   패널에 없는 필드(fScore·divYield·forwardPE 등)를 쓰는 필터는 missing 으로 남기고 화면은 '검증 데이터 없음'.
// 출력
//   data/named_filter_stats.json + .js        (US, window.NAMED_FILTER_STATS)
//   data/korea/named_filter_stats.json + .js  (KR, 같은 전역 — FEATURE_DATA namedFilterStats marketSpecific)
//
// 실행: node scripts/build_named_filter_stats.mjs [--market us|kr] [--dry-run]
// 패널이 없거나 깨졌으면 그 시장 파일을 그대로 두고 exit 1.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const formulaCore = require(path.join(ROOT, "formula-core.js"));
const btCore = require(path.join(ROOT, "screener-backtest-core.js"));
const overfit = require(path.join(ROOT, "overfit-core.js"));
const nf = require(path.join(ROOT, "named-filters-core.js"));

const args = process.argv.slice(2);
const argVal = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt; };
const ONLY = argVal("--market", "");
const DRY = args.includes("--dry-run");

const MARKETS = {
  us: { id: "us", meta: "data/screener_backtest_meta.json", outJson: "data/named_filter_stats.json", outJs: "data/named_filter_stats.js" },
  kr: { id: "kr", meta: "data/korea/screener_backtest_meta.json", outJson: "data/korea/named_filter_stats.json", outJs: "data/korea/named_filter_stats.js" },
};

function kstStamp(d = new Date()) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())} KST`;
}
function writeAtomic(rel, text) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
}
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const round = (x, d = 5) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(d)));

function buildMarket(m, stamp) {
  const meta = readJson(m.meta);
  if (!meta || !Array.isArray(meta.tickers) || !Array.isArray(meta.dates) || !meta.files) throw new Error("패널 메타 형식이 올바르지 않습니다.");
  const K = meta.dates.length;
  const nT = meta.tickers.length;
  const shardCache = new Map();
  const shard = (field) => {
    if (!shardCache.has(field)) {
      const file = meta.files[field];
      if (!file) throw new Error(`패널에 ${field} 샤드가 없습니다.`);
      const doc = readJson(file.path);
      if (doc.version !== meta.version) throw new Error(`${field} 샤드 버전(${doc.version})이 메타(${meta.version})와 다릅니다.`);
      shardCache.set(field, btCore.decodeShard(doc, nT, K));
    }
    return shardCache.get(field);
  };
  const fwd = shard("fwd");
  // 정의에 쓰인 필드 전부로 컴파일한다(시장에 값이 없는 필드는 화면이 거른다). 패널에 없는 필드는 missing.
  const allFields = nf.definitionFields();
  const list = nf.forMarket(m.id, allFields, formulaCore);
  const results = {};
  const runs = [];
  for (const f of list) {
    const missing = btCore.missingFields(f.compiled, meta);
    if (missing.length) { results[f.id] = { formula: f.formula, missing }; continue; }
    try {
      const columns = {};
      f.compiled.fields.forEach((k) => { columns[k] = shard(k); });
      const res = btCore.run({ meta, columns, fwd, compiled: f.compiled, formulaCore });
      if (!res.months) { results[f.id] = { formula: f.formula, error: "과거 값이 있는 기간이 없습니다." }; continue; }
      runs.push({ id: f.id, res });
    } catch (err) {
      results[f.id] = { formula: f.formula, error: String(err && err.message || err).slice(0, 200) };
    }
  }
  const trialSharpes = runs.map((r) => overfit.sharpe(r.res.excess)).filter((x) => Number.isFinite(x));
  for (const { id, res } of runs) {
    const s = res.metrics.strategy, e = res.metrics.ew, b = res.metrics.bench;
    const v = overfit.verdict(res.excess, { trials: Math.max(1, runs.length), trialSharpes, avgHoldings: s.avgHoldings, periodsPerYear: meta.periodsPerYear || 12 });
    results[id] = {
      formula: nf.BY_ID[id].formula,
      startDate: res.startDate, endDate: res.endDate, months: res.months,
      costRate: res.costRate, minStocks: res.minStocks,
      cagr: round(s.cagr), ewCagr: round(e.cagr), benchCagr: round(b.cagr),
      mdd: round(s.mdd), avgHoldings: round(s.avgHoldings, 1), cashMonths: s.cashMonths,
      verdict: v.key, verdictLabel: v.label, dsr: round(v.dsr && v.dsr.dsr, 3),
    };
  }
  return {
    schema: 1,
    market: m.id,
    updatedAtKst: stamp,
    panelVersion: meta.version,
    panelUpdatedAtKst: meta.updatedAtKst || null,
    benchmark: meta.benchmark || null,
    count: runs.length,
    trials: runs.length,
    method: "스크리너 백테스트와 같은 계산: 매월 마지막 거래일 조건 판정 → 다음 거래일 종가 체결, 통과 종목 동일가중, 거래비용 편도 0.1%, 통과 5종목 미만인 달은 현금. 비교 기준 = 같은 시점 수식 필드 값이 있는 종목 전체 동일가중. 판정 시도 횟수 = 이 시장에서 계산한 필터 수.",
    caveat: `${nf.CAVEAT} 현재 상장 종목만 들어 있어(상장폐지 제외) 실제보다 좋게 나옵니다. 배당은 빠져 있습니다.`,
    filters: results,
  };
}

function main() {
  const stamp = kstStamp();
  const ids = ONLY ? [ONLY] : ["us", "kr"];
  let failed = 0;
  for (const id of ids) {
    const m = MARKETS[id];
    if (!m) { console.error(`unknown market ${id}`); process.exit(2); }
    try {
      const t0 = Date.now();
      const doc = buildMarket(m, stamp);
      const json = JSON.stringify(doc);
      if (!DRY) {
        writeAtomic(m.outJson, json + "\n");
        writeAtomic(m.outJs, `window.NAMED_FILTER_STATS = ${json};\n`);
      }
      const lines = Object.entries(doc.filters).map(([k, r]) => (r.missing ? `  ${k}: 검증 데이터 없음(${r.missing.join(",")})`
        : r.error ? `  ${k}: 오류 ${r.error}` : `  ${k}: ${r.startDate}~${r.endDate} ${r.months}개월 CAGR ${(r.cagr * 100).toFixed(1)}% vs EW ${(r.ewCagr * 100).toFixed(1)}% · ${r.verdictLabel} · 평균 ${r.avgHoldings}종목`));
      console.log(`[${id}] ${doc.count}개 계산 (${((Date.now() - t0) / 1000).toFixed(1)}s)${DRY ? " — dry-run" : ""}\n${lines.join("\n")}`);
      if (!doc.count) { failed++; console.error(`[${id}] 계산된 필터가 0개 — 실패로 본다`); }
    } catch (err) {
      failed++;
      console.error(`[${id}] 실패: ${err && err.stack || err}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
