#!/usr/bin/env node
// build_signal_ledger.mjs — 신호 라이브 성적표: 발행 시점 동결 원장(append-only) + 사후 성적 집계
// ==========================================================================================
// 원장:   data/signal_ledger/<us|kr>/<YYYY-MM>.jsonl   한 줄 = 그날 화면에 뜬 신호 하나
//         {d 기록일(KST), m 시장, k 신호 종류, t 종목, p 발행 시점 가격, bd 가격 기준 거래일,
//          ea 진입 기준일(이 날짜 뒤 첫 거래일 시가에 진입), at 기록 시각, src live|backfill, key?, x?}
//         data/signal_ledger/<us|kr>/manifest.json    파일별 SHA-256 + 추가 묶음(batch)별 해시 체인
// 성적표: data/signal_scorecard.json + data/signal_scorecard.js (window.SIGNAL_SCORECARD)
//
// 원칙
//  - 소급 수정·삭제 금지. 기존 줄은 다시 쓰지 않고 끝에 붙이기만 한다. 실행마다 manifest 의
//    해시(파일 전체 + 묶음별 바이트 구간 + 체인)를 먼저 대조하고, 어긋나면 아무것도 붙이지 않고
//    exit 1 — 성적표에는 '기록 해시 불일치'로 그대로 표시한다.
//  - 신호 정의가 바뀌거나 화면에서 사라져도 이미 적힌 줄은 계속 집계한다(성적표는 원장만 읽는다).
//  - 신호 추출 규칙은 signal-scorecard-core.js(화면 규칙 복제) 한 곳에 있다.
//
// 실행
//   node scripts/build_signal_ledger.mjs --record us     # 오늘 US 신호 기록 + 성적표 재계산
//   node scripts/build_signal_ledger.mjs --record kr
//   node scripts/build_signal_ledger.mjs                 # 성적표만 재계산
//   node scripts/build_signal_ledger.mjs --verify        # 해시만 확인(쓰기 없음)
//   node scripts/build_signal_ledger.mjs --backfill us --git "<repo>::<ref>" [--git ...] --from 2026-07-23 --to 2026-09-25
//       git 이력의 커밋 시점 파일로 과거 신호를 복원(src=backfill). 기록 시각은 US 는 그날 12:00 KST
//       (미국 장 마감·스냅샷 뒤, 다음 장 개장 전), KR 은 20:00 KST 로 두고 그 시각 이전 커밋만 본다.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = require(path.join(ROOT, "signal-scorecard-core.js"));

const LEDGER_DIR = path.join(ROOT, "data", "signal_ledger");
const OUT_JSON = path.join(ROOT, "data", "signal_scorecard.json");
const OUT_JS = path.join(ROOT, "data", "signal_scorecard.js");
const MARKETS = ["us", "kr"];
const BENCH = {
  us: { ticker: "SPY", label: "S&P 500 ETF (SPY)", file: "data/details/SPY.json" },
  kr: { ticker: "069500", label: "KODEX 200", file: "data/korea/details/069500.json" },
};
const REAL_SOURCES = new Set(["yahoo", "yahoo-cache"]);
const RECENT_PER_KIND = 8;

// ------------------------------------------------------------------ 인자
const argv = process.argv.slice(2);
const argVal = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const argAll = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
const has = (name) => argv.includes(name);

// ------------------------------------------------------------------ 유틸
function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
function readJson(rel) {
  const p = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return null; }
}
function kstIso(ms) {
  const d = new Date(ms + 9 * 3600000);
  return `${d.toISOString().slice(0, 19)}+09:00`;
}
function kstStamp(ms) {
  const d = new Date(ms + 9 * 3600000);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} KST`;
}
function detailSafeName(ticker) {
  let safe = String(ticker).toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
  const reserved = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
  if (reserved.has(safe.split(".")[0])) safe = `_${safe}`;
  return safe;
}

// ------------------------------------------------------------------ 원장 입출력 · 해시
function marketDir(m) { return path.join(LEDGER_DIR, m); }
function manifestPath(m) { return path.join(marketDir(m), "manifest.json"); }
function emptyManifest(m) {
  return {
    market: m, version: 1,
    note: "append-only 신호 원장. files 는 파일 전체 SHA-256, batches 는 추가 묶음마다 [offset, offset+bytes) 구간의 SHA-256 과 체인(head = sha256(이전 head + 묶음 해시)).",
    files: {}, batches: [], head: "", rows: 0,
  };
}
function loadManifest(m) {
  const p = manifestPath(m);
  if (!fs.existsSync(p)) return emptyManifest(m);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// 원장·manifest 대조. { ok, problems[], rows[] }.
function verifyMarket(m) {
  const dir = marketDir(m);
  const man = loadManifest(m);
  const problems = [];
  const rows = [];
  const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort() : [];
  for (const f of onDisk) if (!man.files[f]) problems.push(`${m}/${f}: manifest 에 없는 원장 파일`);
  const buffers = {};
  for (const [f, meta] of Object.entries(man.files)) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) { problems.push(`${m}/${f}: 파일 없음`); continue; }
    const buf = fs.readFileSync(p);
    buffers[f] = buf;
    if (sha256(buf) !== meta.sha256) problems.push(`${m}/${f}: 파일 해시 불일치`);
    if (buf.length !== meta.bytes) problems.push(`${m}/${f}: 크기 불일치 (${buf.length} ≠ ${meta.bytes})`);
  }
  let head = "";
  for (const b of man.batches || []) {
    const buf = buffers[b.file];
    if (buf) {
      const seg = buf.subarray(b.offset, b.offset + b.bytes);
      if (seg.length !== b.bytes || sha256(seg) !== b.sha256) problems.push(`${m}/${b.file}: ${b.at} 묶음 해시 불일치`);
    }
    head = sha256(head + b.sha256);
    if (b.head !== head) problems.push(`${m}: ${b.at} 체인 불일치`);
  }
  if ((man.head || "") !== head) problems.push(`${m}: 체인 head 불일치`);
  for (const f of Object.keys(buffers).sort()) {
    const text = buffers[f].toString("utf8");
    text.split("\n").forEach((line, i) => {
      if (!line) return;
      try { rows.push(JSON.parse(line)); } catch (_) { problems.push(`${m}/${f}:${i + 1}: JSON 파싱 실패`); }
    });
  }
  if (rows.length !== (man.rows || 0)) problems.push(`${m}: 행 수 불일치 (${rows.length} ≠ ${man.rows || 0})`);
  return { ok: problems.length === 0, problems, rows, manifest: man };
}

// 새 줄을 파일 끝에 붙이고 manifest 를 갱신한다. rows 는 d 의 월별 파일로 나뉜다.
function appendRows(m, newRows, atIso) {
  if (!newRows.length) return 0;
  const dir = marketDir(m);
  fs.mkdirSync(dir, { recursive: true });
  const man = loadManifest(m);
  const byFile = new Map();
  for (const r of newRows) {
    const f = `${r.d.slice(0, 7)}.jsonl`;
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f).push(r);
  }
  for (const [f, rows] of [...byFile.entries()].sort()) {
    const p = path.join(dir, f);
    const prev = fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);
    const add = Buffer.from(rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
    const next = Buffer.concat([prev, add]);
    const batchSha = sha256(add);
    const head = sha256((man.head || "") + batchSha);
    man.batches.push({ at: atIso, file: f, offset: prev.length, bytes: add.length, added: rows.length, src: rows[0].src, sha256: batchSha, head });
    man.head = head;
    man.files[f] = { sha256: sha256(next), bytes: next.length, lines: ((man.files[f] && man.files[f].lines) || 0) + rows.length };
    man.rows = (man.rows || 0) + rows.length;
    writeAtomic(p, next);
  }
  writeAtomic(manifestPath(m), JSON.stringify(man, null, 1) + "\n");
  return newRows.length;
}

// ------------------------------------------------------------------ 입력(현재 파일)
function currentInputs(m) {
  if (m === "us") {
    return {
      snapshot: readJson("data/market_snapshot.json"),
      insider: readJson("data/insider_trades.json"),
      events: readJson("data/material_events.json"),
      activist: readJson("data/activist_stakes.json"),
      movers: readJson("data/movers_reasons.json"),
      factorValidation: readJson("data/factor_validation.json"),
    };
  }
  const inp = {
    snapshot: readJson("data/korea/market_snapshot.json"),
    movers: readJson("data/korea/movers_reasons.json"),
    factorValidation: readJson("data/factor_validation.json"),
    krAlerts: readJson("data/korea/market_alerts.json"),
    krDisclosures: readJson("data/kr_disclosures.json"),
    krContracts: readJson("data/korea/contracts.json"),
  };
  // KR 스냅샷에는 가격 기준일 필드가 없다 — KODEX 200 일봉의 마지막 날짜를 기준 거래일로 쓴다.
  const bench = readJson(BENCH.kr.file);
  const s = bench && core.seriesFromChart(bench.chartSeries);
  if (s) inp.baseDate = s.dates[s.dates.length - 1];
  return inp;
}

function recordMarket(m, nowMs, existingRows) {
  const inputs = currentInputs(m);
  if (!inputs.snapshot || !Array.isArray(inputs.snapshot.stocks) || !inputs.snapshot.stocks.length) {
    throw new Error(`${m}: 스냅샷을 읽지 못함 — 기록하지 않는다`);
  }
  const d = core.kstDate(nowMs);
  const cands = core.extractSignals(m, { ...inputs, recordDate: d });
  const ctx = { market: m, d, at: kstIso(nowMs), ea: core.entryAfterFor(m, nowMs), src: "live" };
  const { rows, skipped } = core.selectNewRows(cands, existingRows, ctx);
  console.log(`[ledger] ${m} ${d}: 후보 ${cands.length} → 새 줄 ${rows.length} (이미 기록 ${skipped.seen} · 쿨다운 ${skipped.cooldown} · 오래된 사건 ${skipped.old})`);
  return rows;
}

// ------------------------------------------------------------------ 소급 복원(git 이력)
function gitSources() {
  return argAll("--git").map((spec) => {
    const [dir, ref] = spec.split("::");
    return { dir: path.resolve(dir), ref: ref || "HEAD" };
  });
}
const _commitCache = new Map();
function commitsFor(src, relPath) {
  const k = `${src.dir}|${src.ref}|${relPath}`;
  if (_commitCache.has(k)) return _commitCache.get(k);
  let out = "";
  try {
    out = execFileSync("git", ["-C", src.dir, "log", "--format=%H %ct", src.ref, "--", relPath], { encoding: "utf8", maxBuffer: 64 << 20 });
  } catch (_) { out = ""; }
  const list = out.trim().split("\n").filter(Boolean).map((l) => { const [sha, ct] = l.split(" "); return { sha, ct: Number(ct) * 1000 }; })
    .sort((a, b) => a.ct - b.ct);
  _commitCache.set(k, list);
  return list;
}
const _blobCache = new Map();  // relPath → { id, data }
function fileAt(sources, relPath, cutMs) {
  let best = null;
  for (const src of sources) {
    const list = commitsFor(src, relPath);
    let pick = null;
    for (const c of list) { if (c.ct <= cutMs) pick = c; else break; }
    if (pick && (!best || pick.ct > best.c.ct)) best = { src, c: pick };
  }
  if (!best) return null;
  const id = `${best.src.dir}|${best.c.sha}`;
  const cached = _blobCache.get(relPath);
  if (cached && cached.id === id) return cached.data;
  let data = null;
  try {
    const text = execFileSync("git", ["-C", best.src.dir, "show", `${best.c.sha}:${relPath}`], { encoding: "utf8", maxBuffer: 256 << 20 });
    data = JSON.parse(text);
  } catch (_) { data = null; }
  _blobCache.set(relPath, { id, data });
  return data;
}
function backfill(m, fromIso, toIso, existingRows) {
  const sources = gitSources();
  if (!sources.length) throw new Error("--git <repo>::<ref> 가 필요하다");
  const liveInRange = existingRows.filter((r) => r.src === "live" && r.d <= toIso);
  if (liveInRange.length) throw new Error(`${m}: ${toIso} 이전 실시간 줄이 이미 있다 — 소급 복원은 실시간 기록 전에만`);
  const paths = m === "us"
    ? { snapshot: "data/market_snapshot.json", insider: "data/insider_trades.json", events: "data/material_events.json",
      activist: "data/activist_stakes.json", movers: "data/movers_reasons.json", factorValidation: "data/factor_validation.json" }
    : { snapshot: "data/korea/market_snapshot.json", movers: "data/korea/movers_reasons.json", factorValidation: "data/factor_validation.json",
      krAlerts: "data/korea/market_alerts.json", krDisclosures: "data/kr_disclosures.json", krContracts: "data/korea/contracts.json" };
  const all = existingRows.slice();
  const added = [];
  for (let d = fromIso; d <= toIso; d = core.addDays(d, 1)) {
    const cutMs = Date.parse(`${d}T${m === "us" ? "12:00" : "20:00"}:00+09:00`);
    const inputs = {};
    for (const [key, rel] of Object.entries(paths)) inputs[key] = fileAt(sources, rel, cutMs);
    if (!inputs.snapshot || !Array.isArray(inputs.snapshot.stocks)) { console.log(`[backfill] ${m} ${d}: 스냅샷 없음 — 건너뜀`); continue; }
    if (m === "kr" && inputs.krAlerts && inputs.krAlerts.baseDate) inputs.baseDate = inputs.krAlerts.baseDate;
    const cands = core.extractSignals(m, { ...inputs, recordDate: d });
    const ctx = { market: m, d, at: kstIso(cutMs), ea: core.entryAfterFor(m, cutMs), src: "backfill" };
    const { rows } = core.selectNewRows(cands, all, ctx);
    rows.forEach((r) => { all.push(r); added.push(r); });
    console.log(`[backfill] ${m} ${d}: 후보 ${cands.length} → 새 줄 ${rows.length}`);
  }
  return added;
}

// ------------------------------------------------------------------ 성적표
function loadSeries(m, ticker, cache) {
  const k = `${m}|${ticker}`;
  if (cache.has(k)) return cache.get(k);
  const dir = m === "us" ? "data/details" : "data/korea/details";
  const names = m === "us" ? [detailSafeName(ticker), detailSafeName(String(ticker).replace(/-/g, "."))] : [String(ticker)];
  let s = null;
  for (const n of [...new Set(names)]) {
    const d = readJson(`${dir}/${n}.json`);
    if (!d) continue;
    if (!REAL_SOURCES.has(d.historySource)) break;
    s = core.seriesFromChart(d.chartSeries);
    break;
  }
  cache.set(k, s);
  return s;
}

const pct1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 10);

function buildScorecard(ledgers, nowMs) {
  const today = core.kstDate(nowMs);
  const cache = new Map();
  const bench = {};
  for (const m of MARKETS) {
    const b = readJson(BENCH[m].file);
    bench[m] = b ? core.seriesFromChart(b.chartSeries) : null;
  }
  const kinds = [];
  for (const meta of core.KINDS) {
    const L = ledgers[meta.m];
    const rows = (L && L.rows ? L.rows : []).filter((r) => r.k === meta.k);
    const entries = rows.map((r) => ({ r, d: r.d, out: core.outcomeFor(r, loadSeries(meta.m, r.t, cache), bench[meta.m], today) }));
    const live = entries.filter((e) => e.r.src === "live");
    const recent = entries.slice().sort((a, b) => (b.d.localeCompare(a.d)) || a.r.t.localeCompare(b.r.t)).slice(0, RECENT_PER_KIND).map((e) => {
      const o = { d: e.d, t: e.r.t, src: e.r.src, p: e.r.p };
      for (const h of core.HORIZONS) {
        const x = e.out[h];
        if (x.status === "done") { o[`r${h}`] = pct1(x.ret); o[`x${h}`] = pct1(x.excess); } else o[`s${h}`] = x.status;
      }
      return o;
    });
    const lastVal = rows.slice().reverse().find((r) => r.x && r.x.val);
    kinds.push({
      m: meta.m, k: meta.k, label: meta.label, group: meta.group, desc: meta.desc, control: !!meta.control,
      total: rows.length, live: live.length, backfill: rows.length - live.length,
      firstDate: rows.length ? rows.reduce((a, r) => (r.d < a ? r.d : a), rows[0].d) : null,
      lastDate: rows.length ? rows.reduce((a, r) => (r.d > a ? r.d : a), rows[0].d) : null,
      validation: lastVal ? lastVal.x.val : null,
      h: core.summarize(entries),
      hLive: core.summarize(live, [20]),
      recent,
    });
  }
  const ledgerInfo = {};
  for (const m of MARKETS) {
    const L = ledgers[m];
    const rows = L.rows || [];
    ledgerInfo[m] = {
      rows: rows.length,
      live: rows.filter((r) => r.src === "live").length,
      backfill: rows.filter((r) => r.src === "backfill").length,
      firstDate: rows.length ? rows.reduce((a, r) => (r.d < a ? r.d : a), rows[0].d) : null,
      lastDate: rows.length ? rows.reduce((a, r) => (r.d > a ? r.d : a), rows[0].d) : null,
      head: L.manifest ? L.manifest.head || "" : "",
      files: L.manifest ? Object.keys(L.manifest.files).sort().map((f) => `data/signal_ledger/${m}/${f}`) : [],
      integrity: L.ok ? "ok" : "mismatch",
      problems: (L.problems || []).slice(0, 5),
    };
  }
  return {
    updatedAtKst: kstStamp(nowMs),
    today,
    source: "Mir 신호 원장(발행 시점 동결) · 가격: 종목 상세 일봉(Yahoo)",
    horizons: core.HORIZONS,
    minSample: core.MIN_SAMPLE,
    method: {
      entry: "발행(기록) 시각 이후 첫 거래일 시가에 진입, N번째 거래일 종가에 청산한다고 가정. 발행 시점 가격은 기록·대조용.",
      excess: "같은 진입일·청산일의 벤치마크 수익률을 뺀 값(US SPY · KR KODEX 200).",
      ci: "발행일 단위 묶음 부트스트랩(2,000회) 평균 초과수익 95% 구간.",
      dedupe: `같은 공시·지정·거래일은 한 번만, 계속 떠 있는 상태 신호(신고가·팩터 순위 등)는 쿨다운 기간 안의 재등장을 새 표본으로 세지 않음. 사건일이 기록일보다 ${core.EVENT_MAX_AGE_DAYS}일 넘게 앞선 공시는 제외.`,
      backfill: "소급 복원: 레포 git 이력의 커밋 시점 파일로 과거 화면을 재구성(US 12:00 KST, KR 20:00 KST 기준, 그 시각 이전 커밋만). 모멘텀 점수는 현재 공식으로 재계산해 당시 화면과 다를 수 있다.",
      limits: "수수료·세금·슬리피지 미반영. 가격 이력이 없는 종목·이력이 끊긴 종목(상장폐지·거래정지 가능)은 결과에서 빠져 생존편향이 있다. 과거 성적은 미래를 보장하지 않으며 매매 신호가 아니다.",
    },
    benchmarks: Object.fromEntries(MARKETS.map((m) => [m, { ticker: BENCH[m].ticker, label: BENCH[m].label, lastDate: bench[m] ? bench[m].dates[bench[m].dates.length - 1] : null }])),
    ledger: ledgerInfo,
    kinds,
  };
}

// ------------------------------------------------------------------ main
function main() {
  if (process.stdout.setDefaultEncoding) process.stdout.setDefaultEncoding("utf8");
  const nowArg = argVal("--now");
  const nowMs = nowArg ? Date.parse(nowArg) : Date.now();
  const recordM = argVal("--record");
  const backfillM = argVal("--backfill");
  let exitCode = 0;

  const ledgers = {};
  for (const m of MARKETS) {
    ledgers[m] = verifyMarket(m);
    if (!ledgers[m].ok) {
      console.error(`[ledger] ${m} 무결성 확인 실패:\n  - ${ledgers[m].problems.join("\n  - ")}`);
      exitCode = 1;
    }
  }
  if (has("--verify")) {
    MARKETS.forEach((m) => console.log(`[verify] ${m}: ${ledgers[m].ok ? "ok" : "불일치"} · ${ledgers[m].rows.length}줄 · head ${ledgers[m].manifest.head.slice(0, 12)}`));
    process.exit(exitCode);
  }

  for (const [m, mode] of [[recordM, "record"], [backfillM, "backfill"]]) {
    if (!m) continue;
    if (!MARKETS.includes(m)) { console.error(`알 수 없는 시장: ${m}`); process.exit(2); }
    if (!ledgers[m].ok) { console.error(`[ledger] ${m}: 무결성 불일치라 기록하지 않는다`); continue; }
    try {
      const rows = mode === "record"
        ? recordMarket(m, nowMs, ledgers[m].rows)
        : backfill(m, argVal("--from"), argVal("--to"), ledgers[m].rows);
      if (!has("--dry-run")) {
        const n = appendRows(m, rows, kstIso(nowMs));
        console.log(`[ledger] ${m}: ${n}줄 추가`);
      }
      ledgers[m] = verifyMarket(m);
      if (!ledgers[m].ok) { console.error(`[ledger] ${m}: 추가 뒤 무결성 확인 실패`); exitCode = 1; }
    } catch (e) {
      console.error(`[ledger] ${m} ${mode} 실패: ${e.message}`);
      exitCode = 1;
    }
  }

  if (has("--dry-run")) process.exit(exitCode);
  const card = buildScorecard(ledgers, nowMs);
  const json = JSON.stringify(card);
  writeAtomic(OUT_JSON, json + "\n");
  writeAtomic(OUT_JS, `window.SIGNAL_SCORECARD = ${json};\n`);
  const us = card.ledger.us, kr = card.ledger.kr;
  console.log(`[scorecard] US ${us.rows}줄(${us.integrity}) · KR ${kr.rows}줄(${kr.integrity}) → ${path.relative(ROOT, OUT_JSON)}`);
  process.exit(exitCode);
}

main();
