#!/usr/bin/env node
// build_risk_check.mjs — 재무 위험 점검 집계(수식 스크리너 필드용)
// ==========================================================================
// 입력(레포에 커밋된 파일만, 네트워크 없음):
//   재무 확장 인덱스 + 종목 파일   data/financials_index.json · data/financials/<T>.json
//                                  data/korea/financials_index.json · data/korea/financials/<코드>.json
//   스냅샷(업종·시가총액)          data/market_snapshot.json · data/korea/market_snapshot.json
//   국내 감사의견                   data/korea/audit_opinion.json
// 계산: risk-check-core.js(종목 화면 카드와 같은 코드 — 두 곳의 판정이 갈라지지 않게).
// 출력: data/risk_check.json/.js · data/korea/risk_check.json/.js (window.RISK_CHECK, 시장별)
//   { schema, market, updatedAtKst, source, count, cols, tickers: { <티커>: [fy, f, fOf, pass, fail, of, z, m] } }
//   f = Piotroski 통과 수(판정 항목 7개 미만이면 null), z·m = Altman Z·Beneish M(계산 불가면 null).
//
// 빌더 규약: 원자적 쓰기, 직전 대비 종목 수가 절반 미만으로 줄면 쓰지 않고 exit 1, 입력이 없으면 exit 1.
// 실행: node scripts/build_risk_check.mjs [--market us|kr]   (weekly-earnings-history.yml financials 잡, DCF 기저율 다음)

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const core = require(path.join(ROOT, "risk-check-core.js"));

const args = process.argv.slice(2);
const only = args.includes("--market") ? args[args.indexOf("--market") + 1] : null;
const COLS = ["fy", "f", "fOf", "pass", "fail", "of", "z", "m"];

const MARKETS = [
  { id: "us", index: "data/financials_index.json", dir: "data/financials", snapshot: "data/market_snapshot.json",
    out: "data/risk_check", source: "SEC EDGAR XBRL(재무 확장) · risk-check-core.js" },
  { id: "kr", index: "data/korea/financials_index.json", dir: "data/korea/financials", snapshot: "data/korea/market_snapshot.json",
    out: "data/korea/risk_check", source: "DART 전체재무제표(재무 확장) · 감사의견 · risk-check-core.js" },
];

const RESERVED = new Set(["CON", "PRN", "AUX", "NUL", ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)]);
// financials_common.safe_file_name 과 같은 규칙.
function safeFileName(ticker) {
  let s = String(ticker).toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
  if (RESERVED.has(s.split(".")[0])) s = `_${s}`;
  return s;
}

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (_) { return fallback; }
}
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

function marketValue(m, row, file) {
  if (!row) return null;
  if (m.id === "kr") {
    const t = Number(row.marketCapT);
    return file.currency === "KRW" && Number.isFinite(t) && t > 0 ? t * 1e12 : null;
  }
  const b = Number(row.marketCapB);
  return file.currency === "USD" && Number.isFinite(b) && b > 0 ? b * 1e9 : null;
}

function buildMarket(m) {
  const index = readJson(m.index, null);
  if (!index || !index.tickers || !Object.keys(index.tickers).length) {
    console.error(`[위험점검 ${m.id}] 재무 확장 인덱스가 없거나 비었습니다: ${m.index}`);
    return false;
  }
  const snap = readJson(m.snapshot, { stocks: [] });
  const byTicker = new Map((snap.stocks || []).map((s) => [String(s.ticker).toUpperCase(), s]));
  const audit = m.id === "kr" ? (readJson("data/korea/audit_opinion.json", {}).opinions || {}) : {};
  const out = {};
  let read = 0, skipped = 0;
  for (const ticker of Object.keys(index.tickers)) {
    const rel = path.join(m.dir, `${m.id === "kr" ? ticker : safeFileName(ticker)}.json`);
    const file = readJson(rel, null);
    if (!file || file.schema !== 1) { skipped++; continue; }
    read++;
    const row = byTicker.get(String(ticker).toUpperCase());
    const res = core.evaluate(file, {
      market: m.id,
      marketValue: marketValue(m, row, file),
      sector: row && row.sector,
      industry: row && row.industry,
      audit: m.id === "kr" ? audit[ticker] || null : null,
    });
    const c = core.compactRow(res);
    if (!c || !c.of) continue;
    out[ticker] = COLS.map((k) => (c[k] === undefined ? null : c[k]));
  }
  const count = Object.keys(out).length;
  const prev = readJson(`${m.out}.json`, null);
  const prevCount = prev && Number(prev.count);
  if (!count) {
    console.error(`[위험점검 ${m.id}] 계산된 종목 0 — 쓰지 않음`);
    return false;
  }
  if (prevCount && count < prevCount * 0.5) {
    console.error(`[위험점검 ${m.id}] 종목 수 급감 ${prevCount} → ${count} — 쓰지 않음`);
    return false;
  }
  const doc = {
    schema: 1,
    market: m.id,
    updatedAtKst: kstStamp(),
    source: m.source,
    note: "과거 재무제표로 계산한 점검 — 매도 신호·예측 아님. f=Piotroski 통과 수(판정 항목 fOf개 중, 7개 미만이면 null), pass/fail/of=체크리스트 통과·경고·판정 수(데이터 없음·해당 없음 제외), z=Altman, m=Beneish(계산 불가면 null).",
    financialsUpdatedAtKst: index.updatedAtKst || null,
    count,
    cols: COLS,
    tickers: out,
  };
  const json = JSON.stringify(doc);
  writeAtomic(`${m.out}.json`, `${json}\n`);
  writeAtomic(`${m.out}.js`, `window.RISK_CHECK = ${json};\n`);
  console.log(`[위험점검 ${m.id}] ${count}종목 (파일 ${read} · 없음 ${skipped}) → ${m.out}.json/.js`);
  return true;
}

let ok = true;
for (const m of MARKETS) {
  if (only && only !== m.id) continue;
  try {
    if (!buildMarket(m)) ok = false;
  } catch (err) {
    console.error(`[위험점검 ${m.id}] 실패:`, err);
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
