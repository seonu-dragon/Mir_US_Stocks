#!/usr/bin/env node
// build_screener_backtest_panel.mjs — 수식 스크리너 과거 백테스트용 월말 팩터 패널
// ==========================================================================
// 입력(읽기만, 네트워크 없음)
//   data/details/*.json · data/korea/details/*.json 의 chartSeries [o,h,l,c,v,date]
//     — 실측 이력(historySource yahoo/yahoo-cache)만. 약 5년.
//   data/market_snapshot.json · data/korea/market_snapshot.json — 유니버스(ETF 제외)·섹터·업종·현재 시총/가격
//   data/financials/<T>.json (US, SEC 10-K 연간 행 + filed 제출일)
//   data/korea/financials_history.json (KR, DART 연간 주요계정 — 제출일이 없어 법정 기한 규칙을 쓴다)
// 출력
//   data/screener_backtest_meta.json + .js            (US, window.SCREENER_BACKTEST_META)
//   data/korea/screener_backtest_meta.json + .js      (KR, 같은 전역 — FEATURE_DATA marketSpecific)
//   data/screener_backtest/<us|kr>/<field>.json       (필드별 샤드, 브라우저가 수식에 쓰인 필드만 fetch)
//
// 시점 규칙(룩어헤드 방지) — 화면(screener-backtest.js)과 신뢰도 센터에 같은 문장으로 공개한다.
//   - 신호일 d_k = 벤치마크(SPY / KODEX 200) 달력의 매월 마지막 거래일. 필드 값은 d_k 종가까지의 봉만으로 계산.
//   - 재무 필드는 공시 제출일(filed) 다음 날 이후(filed < d_k)의 연간 보고서만 쓴다(US).
//     KR 은 제출일이 없어 사업보고서 법정 제출기한(결산 후 90일 = 3월 31일)의 다음 날(4월 1일) 이후에만 쓴다.
//   - 체결일 e_k = d_k 다음 거래일 종가. 기간 수익률 fwd_k = 종가(e_{k+1}) / 종가(e_k) − 1.
//     fwd 는 손익 계산에만 쓰고 신호에는 절대 쓰지 않는다(screener-backtest-core.js 가 k 시점 필드와 fwd_k 만 짝짓는다).
//   - 아직 끝나지 않은 달(e_{k+1} 이 미래)은 넣지 않는다.
//   - 가격은 분할 조정·배당 미포함 종가(야후 chartSeries close). 과거 시총 = 과거 종가 × 현재 주식 수(추정).
//
// 한계(화면에 그대로 적는다): 현재 상장 종목만 있다(상장폐지 종목 없음 → 생존편향, 성과 과대).
//
// 실행: node scripts/build_screener_backtest_panel.mjs [--market us|kr] [--dry-run]
// 실패 시 기존 파일을 유지하고 exit 1(빈 파일로 덮어쓰지 않는다).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt;
};
const ONLY = argVal("--market", "");
const DRY = args.includes("--dry-run");

const REAL_SOURCES = new Set(["yahoo", "yahoo-cache"]);
const MIN_BARS = 60;
const MIN_TICKERS = 200;       // 시장 유니버스가 이보다 작으면 뭔가 깨진 것 — 쓰지 않는다
const MIN_DATES = 24;          // 월말 신호일이 2년 미만이면 쓰지 않는다
const WEEKS_52_BARS = 252;
const STALE_BARS = 5;
const CAP_TO_TRADING_VALUE_MAX = 1e5; // 추정 시총 ÷ 20일 평균 거래대금 상한(일 회전율 0.001% 미만이면 추정 불가로 본다)          // 기간 끝 종가가 없을 때 앞으로 최대 5거래일까지 마지막 종가를 쓴다

const MARKETS = {
  us: {
    id: "us", label: "미국", details: "data/details", snapshot: "data/market_snapshot.json",
    benchmark: { ticker: "SPY", label: "SPY(S&P 500 ETF)" },
    capUnitLabel: "$B", capScaleToUnit: 1e9,
    breakBand: [0.1, 5],
    minTradingValue: 1e6, minTradingValueLabel: "20거래일 평균 거래대금 100만 달러 이상",
    metaJson: "data/screener_backtest_meta.json", metaJs: "data/screener_backtest_meta.js",
    shardDir: "data/screener_backtest/us",
  },
  kr: {
    id: "kr", label: "국내", details: "data/korea/details", snapshot: "data/korea/market_snapshot.json",
    benchmark: { ticker: "069500", label: "KODEX 200(069500)" },
    capUnitLabel: "조원", capScaleToUnit: 1e12,
    breakBand: [1 / 1.35, 1.35],
    minTradingValue: 3e8, minTradingValueLabel: "20거래일 평균 거래대금 3억 원 이상",
    metaJson: "data/korea/screener_backtest_meta.json", metaJs: "data/korea/screener_backtest_meta.js",
    shardDir: "data/screener_backtest/kr",
  },
};

// 패널 필드 — 키는 수식 스크리너(formula-screener.js FX_FIELDS)의 키와 같아야 수식이 그대로 돈다.
// scale: 저장 정수 = round(값 × scale). def: 화면에 보이는 과거 값 정의(현재 스냅샷 정의와 다른 점 포함).
const FIELDS = {
  changePct:           { scale: 10,  kind: "price", def: "월말 당일 등락률(%) — 종가 기준" },
  weekChangePct:       { scale: 10,  kind: "price", def: "5거래일 수익률(%)" },
  monthChangePct:      { scale: 10,  kind: "price", def: "21거래일 수익률(%)" },
  threeMonthChangePct: { scale: 10,  kind: "price", def: "63거래일 수익률(%)" },
  ytdChangePct:        { scale: 10,  kind: "price", def: "직전 해 마지막 종가 대비 수익률(%)" },
  marketCap:           { scale: 1000, kind: "price", def: "과거 시총 추정 = 과거 종가 × 현재 주식 수(증자·소각 미반영)" },
  volumeRatio:         { scale: 10,  kind: "price", def: "월말 거래량 / 직전 20거래일 평균" },
  rsi14:               { scale: 10,  kind: "price", def: "Wilder RSI(14), 종가 기준(60봉 이상일 때)" },
  stochK:              { scale: 10,  kind: "price", def: "52주(252봉) 범위 내 위치(%) — 252봉 이상일 때만" },
  newHighDistancePct:  { scale: 10,  kind: "price", def: "252봉 최고 종가 대비 하락폭(%) — 252봉 이상일 때만" },
  low52Dist:           { scale: 10,  kind: "price", def: "252봉 최저 종가 대비 상승률(%) — 종가 기준(현재 화면은 장중 저가 기준)" },
  vol20:               { scale: 100, kind: "price", def: "최근 20거래일 일간수익률 표준편차(%)" },
  pe:                  { scale: 10,  kind: "fin", def: "과거 시총 추정 ÷ 직전 연간 순이익" },
  pb:                  { scale: 100, kind: "fin", def: "과거 시총 추정 ÷ 직전 연간 기말 자본" },
  ps:                  { scale: 100, kind: "fin", def: "과거 시총 추정 ÷ 직전 연간 매출" },
  roe:                 { scale: 10,  kind: "fin", def: "연간 순이익 ÷ 기말 자본(%)" },
  roa:                 { scale: 10,  kind: "fin", def: "연간 순이익 ÷ 기말 자산(%)" },
  netMargin:           { scale: 10,  kind: "fin", def: "연간 순이익 ÷ 매출(%)" },
  revenueGrowth:       { scale: 10,  kind: "fin", def: "연간 매출 전년 대비(%)" },
  operatingGrowth:     { scale: 10,  kind: "fin", def: "연간 영업이익 전년 대비(%) — 전년이 흑자일 때만" },
  netGrowth:           { scale: 10,  kind: "fin", def: "연간 순이익 전년 대비(%) — 전년이 흑자일 때만" },
  debtRatio:           { scale: 10,  kind: "fin", def: "부채 ÷ 자본(%)" },
  currentRatio:        { scale: 10,  kind: "fin", def: "유동자산 ÷ 유동부채(%)", usOnly: true },
};
// 수식 스크리너에는 있지만 과거 값을 만들 수 없는 필드와 이유(화면에 그대로 뜬다).
const NO_HISTORY = {
  price: "분할 조정 가격이라 과거 실제 호가와 달라 과거 값을 쓰지 않습니다",
  rangePos5yPct: "5년 범위 위치는 과거 시점엔 5년 이력이 없어 정의가 달라집니다",
  epsTtm: "과거 시점의 TTM EPS 이력이 없습니다",
  epsNextY: "과거 시점의 추정치(컨센서스) 이력이 없습니다",
  epsGrowthEst: "과거 시점의 추정치(컨센서스) 이력이 없습니다",
  forwardPE: "과거 시점의 추정치(컨센서스) 이력이 없습니다",
  peg: "과거 시점의 추정 성장률 이력이 없습니다",
  evEbitda: "과거 시점 EV(순부채 포함) 이력을 만들지 않았습니다",
  evEbit: "과거 시점 EV(순부채 포함) 이력을 만들지 않았습니다",
  pfcf: "과거 현금흐름 이력이 일부 종목에만 있어 만들지 않았습니다",
  valueScore: "현재 멀티플 백분위로만 계산되는 점수입니다",
  divYield: "과거 배당 이력으로 만든 시점 값이 없습니다",
  payoutRatio: "과거 배당 이력으로 만든 시점 값이 없습니다",
  foreignPct: "외국인 지분율 과거 이력이 없습니다",
  foreignExhaustion: "외국인 한도소진율 과거 이력이 없습니다",
  stochKNote: null,
};
delete NO_HISTORY.stochKNote;

// ---------------------------------------------------------------- 유틸
const round = (v, d) => { const m = 10 ** d; return Math.round(v * m) / m; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const finiteOrNull = (v) => (Number.isFinite(v) ? v : null);

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
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

function isKrEtfLike(item) {
  const text = `${item?.company || ""} ${item?.industry || ""} ${item?.sector || ""}`.toUpperCase();
  return item?.market === "etf" || item?.sector === "ETF" || text.includes(" ETF") || text.includes(" ETN")
    || /^(KODEX|TIGER|ACE|RISE|KBSTAR|SOL|ARIRANG|HANARO)\b/.test(text);
}
function isEtf(marketId, item) {
  if (marketId === "kr") return isKrEtfLike(item);
  return item.sector === "EXCHANGE TRADED FUNDS" || item.sector === "ETF";
}

function detailFile(dir, ticker) {
  for (const name of [`${ticker}.json`, `_${ticker}.json`]) {
    const p = path.join(ROOT, dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadBars(file, breakBand) {
  let d;
  try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return null; }
  if (!REAL_SOURCES.has(d.historySource)) return { skip: "source" };
  const rows = Array.isArray(d.chartSeries) ? d.chartSeries : [];
  const c = [], v = [], dates = [];
  for (const r of rows) {
    const close = Number(r[3]);
    const dt = String(r[5] || "");
    if (!Number.isFinite(close) || close <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue;
    if (dates.length && dt <= dates[dates.length - 1]) continue; // 중복·역순 봉 제거
    c.push(close); v.push(Math.max(0, Number(r[4]) || 0)); dates.push(dt);
  }
  if (c.length < MIN_BARS) return { skip: "short" };
  const breaks = repairBreaks(c, v, breakBand);
  return { c, v, dates, breaks };
}

// 미조정 병합·감자·분할 복구. 야후 일봉에 가끔 액면 병합이 반영되지 않은 채 하루 사이 가격이 수십 배로 뛴다
// (예: KR 016670 2024-04-18 217 → 6,660원, 거래량 1/20). 국내는 가격제한폭 ±30% 라 하루 ±35% 를 넘는 봉은
// 실제 거래로 생길 수 없다. 그런 날은 '그날 수익 0' 으로 보고 이전 가격·거래량을 그 배율로 되맞춘다.
// 미국은 가격제한이 없어 5배 이상 급등(미조정 병합 추정)·90% 이상 급락(미조정 분할 추정)만 같은 방식으로 본다.
// band = [하한 배율, 상한 배율]. 반환 = 보정 건수.
function repairBreaks(c, v, band) {
  let n = 0;
  for (let i = c.length - 1; i >= 1; i--) {
    const r = c[i] / c[i - 1];
    if (r > band[1] || r < band[0]) {
      for (let j = 0; j < i; j++) { c[j] *= r; v[j] /= r; }
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- 가격 필드(시점 i 까지의 봉만)
// update_data.py make_stock 과 같은 정의(pct 는 lookback(closes, n) = closes[-n]).
function wilderRsiSeries(c, period = 14) {
  const out = new Array(c.length).fill(null);
  if (c.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = c[i] - c[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let ag = gain / period, al = loss / period;
  const val = () => (!al ? (ag ? 100 : 50) : 100 - 100 / (1 + ag / al));
  out[period] = val();
  for (let i = period + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = val();
  }
  return out;
}

function priceFieldsAt(bars, i, rsi, shares) {
  const { c, v, dates } = bars;
  const price = c[i];
  const back = (n) => (i - (n - 1) >= 0 ? c[i - (n - 1)] : null); // closes[-n] (n 번째 뒤 = 자신 포함 n개)
  const pct = (then) => (then ? (price / then - 1) * 100 : null);
  const out = {};
  out.changePct = i >= 1 ? pct(c[i - 1]) : null;
  out.weekChangePct = i >= 5 ? pct(back(6)) : null;
  out.monthChangePct = i >= 21 ? pct(back(22)) : null;
  out.threeMonthChangePct = i >= 63 ? pct(back(64)) : null;
  // YTD: 직전 해 마지막 종가. 그 해 이전 봉이 없으면 결측.
  const year = dates[i].slice(0, 4);
  let j = i;
  while (j >= 0 && dates[j].slice(0, 4) === year) j--;
  out.ytdChangePct = j >= 0 ? pct(c[j]) : null;
  out.marketCap = shares ? price * shares : null;
  if (i >= 20) {
    const w = v.slice(i - 20, i);
    const avg = mean(w);
    out.volumeRatio = avg > 0 ? Math.max(0.1, v[i] / avg) : null;
  } else out.volumeRatio = null;
  out.rsi14 = i >= 59 ? rsi[i] : null;
  if (i >= WEEKS_52_BARS - 1) {
    let hi = -Infinity, lo = Infinity;
    for (let k = i - (WEEKS_52_BARS - 1); k <= i; k++) { if (c[k] > hi) hi = c[k]; if (c[k] < lo) lo = c[k]; }
    out.stochK = Math.min(100, Math.max(0, ((price - lo) / Math.max(0.01, hi - lo)) * 100));
    out.newHighDistancePct = (1 - price / hi) * 100;
    out.low52Dist = lo > 0 ? (price / lo - 1) * 100 : null;
  } else {
    out.stochK = null; out.newHighDistancePct = null; out.low52Dist = null;
  }
  if (i >= 20) {
    const rets = [];
    for (let k = i - 19; k <= i; k++) if (c[k - 1]) rets.push(c[k] / c[k - 1] - 1);
    const m = mean(rets);
    out.vol20 = Math.sqrt(mean(rets.map((r) => (r - m) ** 2))) * 100;
  } else out.vol20 = null;
  return out;
}

// ---------------------------------------------------------------- 재무(시점 기준)
// 행: { availableFrom: "YYYY-MM-DD"(이 날짜 '이후' 신호일부터 사용 — 엄격히 큼), fy, rev, op, net, assets, equity, liab, curAssets, curLiab }
function usFinancialRows(ticker) {
  const file = path.join(ROOT, "data/financials", `${ticker}.json`);
  const alt = path.join(ROOT, "data/financials", `_${ticker}.json`);
  const p = fs.existsSync(file) ? file : fs.existsSync(alt) ? alt : null;
  if (!p) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return null; }
  // 보고 통화가 달러가 아니면(20-F 등) 달러 시총과 나눌 수 없다 — 쓰지 않는다.
  if (d.currency && d.currency !== "USD") return null;
  const rows = [];
  for (const a of d.annual || []) {
    if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(String(a.filed || ""))) continue;
    rows.push({ availableFrom: a.filed, fy: Number(a.fy), rev: a.rev, op: a.op, net: a.net, assets: a.assets, equity: a.equity, liab: a.liab, curAssets: a.curAssets, curLiab: a.curLiab });
  }
  rows.sort((x, y) => (x.fy - y.fy) || x.availableFrom.localeCompare(y.availableFrom));
  return rows.length ? rows : null;
}

let KR_FIN_HISTORY = null;
function krFinancialRows(ticker) {
  if (!KR_FIN_HISTORY) {
    try { KR_FIN_HISTORY = readJson("data/korea/financials_history.json").financials || {}; } catch (_) { KR_FIN_HISTORY = {}; }
  }
  const list = KR_FIN_HISTORY[ticker];
  if (!Array.isArray(list) || !list.length) return null;
  const rows = list
    .filter((r) => r && Number.isFinite(Number(r.y)))
    // 사업보고서 법정 제출기한 = 결산 후 90일(12월 결산 → 3월 31일). 제출일이 없으니 기한 당일까지는 안 쓴다.
    .map((r) => ({ availableFrom: `${Number(r.y) + 1}-03-31`, fy: Number(r.y), rev: r.rev, op: r.op, net: r.net, assets: r.assets, equity: r.equity, liab: r.debt }))
    .sort((a, b) => a.fy - b.fy);
  return rows.length ? rows : null;
}

const pos = (x) => Number.isFinite(x) && x > 0;
function finFieldsAt(rows, date, cap, marketId) {
  const out = {};
  if (!rows) return out;
  // filed + 1일 ≤ 신호일  ⇔  filed < 신호일. 그중 가장 최근 회계연도(같은 연도가 둘이면 나중 제출분).
  const avail = rows.filter((r) => r.availableFrom < date);
  if (!avail.length) return out;
  let a = avail[0];
  for (const r of avail) if (r.fy > a.fy || (r.fy === a.fy && r.availableFrom >= a.availableFrom)) a = r;
  let prev = null;
  for (const r of avail) if (r.fy === a.fy - 1 && (!prev || r.availableFrom >= prev.availableFrom)) prev = r;
  const net = Number(a.net), eq = Number(a.equity), rev = Number(a.rev), op = Number(a.op), assets = Number(a.assets), liab = Number(a.liab);
  if (Number.isFinite(cap) && cap > 0) {
    if (Number.isFinite(net) && net !== 0) {
      // US 현재 화면(map_fundamentals)은 적자 PER 을 비워 두고, KR 은 음수 PER 을 그대로 둔다 — 같은 규칙.
      if (net > 0 || marketId === "kr") out.pe = cap / net;
    }
    if (pos(eq)) out.pb = cap / eq;
    if (pos(rev)) out.ps = cap / rev;
  }
  if (pos(eq) && Number.isFinite(net)) out.roe = (net / eq) * 100;
  if (pos(assets) && Number.isFinite(net)) out.roa = (net / assets) * 100;
  if (pos(rev) && Number.isFinite(net)) out.netMargin = (net / rev) * 100;
  if (pos(eq) && Number.isFinite(liab)) out.debtRatio = (liab / eq) * 100;
  if (marketId === "us" && pos(Number(a.curLiab)) && Number.isFinite(Number(a.curAssets))) out.currentRatio = (Number(a.curAssets) / Number(a.curLiab)) * 100;
  if (prev) {
    if (pos(Number(prev.rev)) && Number.isFinite(rev)) out.revenueGrowth = (rev / Number(prev.rev) - 1) * 100;
    if (pos(Number(prev.op)) && Number.isFinite(op)) out.operatingGrowth = (op / Number(prev.op) - 1) * 100;
    if (pos(Number(prev.net)) && Number.isFinite(net)) out.netGrowth = (net / Number(prev.net) - 1) * 100;
  }
  return out;
}

// ---------------------------------------------------------------- 달력
// 벤치마크 봉 날짜로 월말 신호일 d_k 와 다음 거래일 e_k 를 만든다. e_{k+1} 이 있는 k 만 남긴다.
function buildCalendar(benchDates) {
  const monthEnds = [];
  for (let i = 0; i < benchDates.length; i++) {
    const cur = benchDates[i].slice(0, 7);
    const nxt = i + 1 < benchDates.length ? benchDates[i + 1].slice(0, 7) : null;
    if (nxt && nxt !== cur) monthEnds.push({ d: benchDates[i], e: benchDates[i + 1] });
  }
  // 각 월말의 체결일 e_k 와 다음 월말의 체결일 e_{k+1} 이 모두 있어야 기간이 끝난 것.
  const out = [];
  for (let k = 0; k + 1 < monthEnds.length; k++) out.push({ d: monthEnds[k].d, e: monthEnds[k].e, eNext: monthEnds[k + 1].e });
  return out;
}

// 날짜 → 그 날짜 이하 마지막 봉 인덱스(최대 maxBack 봉 전까지). 봉이 그 날짜에 정확히 있어야 하는 경우 exact.
function idxOnOrBefore(bars, date, { exact = false, maxBackDays = 10 } = {}) {
  const ds = bars.dates;
  let lo = 0, hi = ds.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (ds[mid] <= date) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  if (ans < 0) return -1;
  if (exact) return ds[ans] === date ? ans : -1;
  const gapDays = (Date.parse(date) - Date.parse(ds[ans])) / 86400000;
  return gapDays <= maxBackDays ? ans : -1;
}

// ---------------------------------------------------------------- 시장 하나
function buildMarket(m) {
  const t0 = Date.now();
  const snap = readJson(m.snapshot);
  const stocks = (snap.stocks || []).filter((s) => s && s.ticker && !isEtf(m.id, s));
  const benchFile = detailFile(m.details, m.benchmark.ticker);
  if (!benchFile) throw new Error(`${m.id}: 벤치마크 ${m.benchmark.ticker} detail 없음`);
  const bench = loadBars(benchFile, m.breakBand);
  if (!bench || bench.skip) throw new Error(`${m.id}: 벤치마크 ${m.benchmark.ticker} 실측 이력 없음`);
  const cal = buildCalendar(bench.dates);
  if (cal.length < MIN_DATES) throw new Error(`${m.id}: 월말 신호일 ${cal.length}개(< ${MIN_DATES})`);
  const K = cal.length;
  const benchFwd = cal.map(({ e, eNext }) => {
    const a = idxOnOrBefore(bench, e, { exact: true });
    const b = idxOnOrBefore(bench, eNext, { exact: true });
    return a >= 0 && b >= 0 ? round(bench.c[b] / bench.c[a] - 1, 6) : null;
  });

  const fieldKeys = Object.keys(FIELDS).filter((k) => !(FIELDS[k].usOnly && m.id !== "us"));
  const tickers = [], sectors = [], industries = [];
  const cols = Object.fromEntries(fieldKeys.map((k) => [k, []]));
  const fwd = [];
  const skipped = { noDetail: 0, source: 0, short: 0, noOverlap: 0, illiquidPeriods: 0, repairedBreaks: 0, repairedTickers: 0, capImplausible: 0 };
  let finCovered = 0;
  const capKey = m.id === "kr" ? "marketCapT" : "marketCapB";

  for (const s of stocks) {
    const file = detailFile(m.details, s.ticker);
    if (!file) { skipped.noDetail++; continue; }
    const bars = loadBars(file, m.breakBand);
    if (bars && bars.breaks) { skipped.repairedBreaks += bars.breaks; skipped.repairedTickers++; }
    if (!bars) { skipped.noDetail++; continue; }
    if (bars.skip) { skipped[bars.skip]++; continue; }
    const capNow = Number(s[capKey]);
    const priceNow = Number(s.price);
    // 현재 주식 수 추정(시총 단위 기준): 과거 시총 = 과거 종가 × 이 값. 분할 조정 종가와 짝이 맞는다.
    const sharesUnit = capNow > 0 && priceNow > 0 ? capNow / priceNow : null;
    const sharesAbs = sharesUnit ? sharesUnit * m.capScaleToUnit : null;
    const finRows = m.id === "us" ? usFinancialRows(s.ticker) : krFinancialRows(s.ticker);
    if (finRows) finCovered++;
    const rsi = wilderRsiSeries(bars.c);
    const tFwd = new Array(K).fill(null);
    const tCols = Object.fromEntries(fieldKeys.map((k) => [k, new Array(K).fill(null)]));
    let any = false;
    for (let k = 0; k < K; k++) {
      const { d, e, eNext } = cal[k];
      // 신호일 d_k 봉이 정확히 있어야 한다(그날 거래가 없으면 조건을 판정할 값이 없다).
      const id = idxOnOrBefore(bars, d, { exact: true });
      if (id < 0) continue;
      // 편입 가능 조건(모두 d_k 까지의 정보): 20거래일 평균 거래대금 ≥ 시장별 하한.
      // 거래대금 = 분할 조정 종가 × 분할 조정 거래량 = 실제 거래대금(조정이 상쇄된다). 거래가 거의 없는
      // 초소형주는 표시 가격으로 실제 체결이 어렵고, 연쇄 증자·병합 종목의 과거 가격 왜곡도 대부분 여기서 걸러진다.
      if (id < 19) continue;
      let dv = 0;
      for (let j = id - 19; j <= id; j++) dv += bars.c[j] * bars.v[j];
      dv /= 20;
      if (!(dv >= m.minTradingValue)) { skipped.illiquidPeriods++; continue; }
      // 체결: 체결일 e_k 에 봉이 정확히 있어야 한다(거래정지면 편입 불가 — 그 시점에 알 수 있는 사실).
      const ie = idxOnOrBefore(bars, e, { exact: true });
      if (ie < 0) continue;
      const iNext = idxOnOrBefore(bars, eNext, { maxBackDays: STALE_BARS + 4 });
      if (iNext < 0 || iNext < ie) continue;
      tFwd[k] = bars.c[iNext] / bars.c[ie] - 1;
      any = true;
      const pf = priceFieldsAt(bars, id, rsi, sharesUnit);
      // 과거 시총 추정(과거 종가 × 현재 주식 수)이 그 시점 하루 거래대금의 10만 배를 넘으면 버린다 —
      // 연쇄 증자로 주식 수가 폭증한 종목은 과거 시총이 수천 배로 부풀어 순위·PER 을 망친다(실측: 추정 2,000조 달러).
      let capAbs = sharesAbs ? bars.c[id] * sharesAbs : null;
      if (capAbs && capAbs > CAP_TO_TRADING_VALUE_MAX * dv) { capAbs = null; pf.marketCap = null; skipped.capImplausible++; }
      const ff = finFieldsAt(finRows, d, capAbs, m.id);
      for (const key of fieldKeys) {
        const val = FIELDS[key].kind === "fin" ? ff[key] : pf[key];
        if (Number.isFinite(val)) tCols[key][k] = val;
      }
    }
    if (!any) { skipped.noOverlap++; continue; }
    tickers.push(s.ticker);
    sectors.push(s.sector || null);
    industries.push(s.industry || null);
    fwd.push(tFwd);
    for (const key of fieldKeys) cols[key].push(tCols[key]);
  }
  if (tickers.length < MIN_TICKERS) throw new Error(`${m.id}: 유니버스 ${tickers.length}종목(< ${MIN_TICKERS}) — 쓰지 않는다`);

  // 양자화 + 커버리지
  // 시총은 유효숫자 3자리로 자른다 — 주식 수 추정이 매주 미세하게 흔들려 샤드 전체가 바뀌는 것을 막는다.
  const sig3 = (x) => {
    if (!Number.isFinite(x) || x === 0) return x;
    const p = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2);
    return Math.round(x / p) * p;
  };
  const quant = (val, scale, key) => {
    if (!Number.isFinite(val)) return null;
    const q = Math.round((key === "marketCap" ? sig3(val * scale) : val * scale));
    const LIM = 2e9;
    return Math.max(-LIM, Math.min(LIM, q));
  };
  const coverage = {};
  const shards = {};
  for (const key of fieldKeys) {
    const sc = FIELDS[key].scale;
    const rows = cols[key].map((arr) => arr.map((x) => quant(x, sc, key)));
    const perDate = new Array(K).fill(0);
    rows.forEach((arr) => arr.forEach((x, k) => { if (x != null) perDate[k]++; }));
    coverage[key] = perDate;
    shards[key] = { scale: sc, rows };
  }
  const fwdRows = fwd.map((arr) => arr.map((x) => quant(x, 10000)));
  shards.fwd = { scale: 10000, rows: fwdRows };
  const tradeable = new Array(K).fill(0);
  fwdRows.forEach((arr) => arr.forEach((x, k) => { if (x != null) tradeable[k]++; }));

  return {
    m, K, cal, tickers, sectors, industries, shards, coverage, tradeable, benchFwd,
    stats: { snapshotStocks: stocks.length, universe: tickers.length, finCovered, skipped, elapsedMs: Date.now() - t0 },
  };
}

// 샤드: 종목 한 줄씩(주간 재생성 시 git 델타가 작게 남도록 순서·배치를 고정).
function shardText(marketId, field, version, shard) {
  // 값이 하나도 없는 종목(재무 파일 없는 종목 등)은 행 전체를 null 로 — 재무 샤드가 1/3 크기가 된다.
  const lines = shard.rows.map((r) => (r.every((x) => x == null) ? "null" : JSON.stringify(r)));
  return `{"market":"${marketId}","field":"${field}","version":"${version}","scale":${shard.scale},"rows":[\n${lines.join(",\n")}\n]}\n`;
}

function writeMarket(res, stamp) {
  const { m, K, cal, tickers, sectors, industries, shards, coverage, tradeable, benchFwd, stats } = res;
  // version = 달력·종목 목록의 해시. 샤드와 메타가 서로 다른 배포에서 섞였는지 화면이 확인한다.
  const version = crypto.createHash("md5").update(JSON.stringify([cal, tickers])).digest("hex").slice(0, 10);
  const files = {};
  let bytes = 0;
  for (const [field, shard] of Object.entries(shards)) {
    const text = shardText(m.id, field, version, shard);
    const hash = crypto.createHash("md5").update(text).digest("hex").slice(0, 10);
    files[field] = { path: `${m.shardDir}/${field}.json`, hash, bytes: Buffer.byteLength(text) };
    bytes += Buffer.byteLength(text);
    if (!DRY) writeAtomic(`${m.shardDir}/${field}.json`, text);
  }
  const fieldMeta = {};
  for (const key of Object.keys(coverage)) {
    fieldMeta[key] = { def: FIELDS[key].def, kind: FIELDS[key].kind, scale: FIELDS[key].scale, coverage: coverage[key], maxCoverage: Math.max(...coverage[key]) };
  }
  const meta = {
    schema: 1,
    market: m.id,
    updatedAtKst: stamp,
    generatedAt: new Date().toISOString(),
    version,
    source: m.id === "us"
      ? "Yahoo 일봉(data/details) · SEC 10-K 연간(data/financials, 제출일 기준)"
      : "Yahoo 일봉(data/korea/details) · DART 연간 주요계정(financials_history, 3월 31일 기한 규칙)",
    benchmark: m.benchmark,
    capUnit: m.capUnitLabel,
    minTradingValue: m.minTradingValue,
    minTradingValueLabel: m.minTradingValueLabel,
    frequency: "monthly",
    periodsPerYear: 12,
    months: K,
    dates: cal.map((x) => x.d),
    execDates: cal.map((x) => x.e),
    periodEnd: cal[K - 1].eNext,
    tickers,
    sectors,
    industries,
    tradeable,
    benchmarkFwd: benchFwd,
    fields: fieldMeta,
    noHistory: NO_HISTORY,
    files,
    shardBytes: bytes,
    stats: { ...stats, finRule: m.id === "us" ? "SEC 10-K 연간 행, 제출일(filed) 다음 날부터" : "DART 연간, 사업연도 다음 해 4월 1일부터(법정 제출기한 다음 날)" },
    rules: [
      "신호일 = 매월 마지막 거래일. 조건은 그날 종가까지의 값으로 판정",
      "체결 = 신호일 다음 거래일 종가, 다음 달 체결일 종가까지 보유(월 리밸런싱)",
      `편입 가능 종목 = 신호일 기준 ${m.minTradingValueLabel}(그 시점까지의 거래로 판정) — 백테스트 유니버스와 순위·백분위 함수의 모집단도 이 종목들`,
      m.id === "us"
        ? "재무 필드 = 공시 제출일(filed) 다음 날 이후의 최근 연간 보고서(10-K)"
        : "재무 필드 = 사업보고서 법정 제출기한(3월 31일) 다음 날 이후의 최근 연간 값(제출일 자료 없음)",
      "가격 = 분할 조정·배당 미포함 종가 → 배당 수익은 빠져 있음(전략·벤치마크 동일)",
      "과거 시총 = 과거 종가 × 현재 주식 수 추정(증자·자사주 소각 미반영). 추정치가 그 시점 하루 거래대금의 10만 배를 넘으면(연쇄 증자 종목) 비움",
      m.id === "kr"
        ? "미조정 병합·감자 추정 봉(하루 ±35% 초과 — 가격제한폭 밖)은 그날 수익 0 으로 보고 이전 가격을 보정"
        : "미조정 병합·분할 추정 봉(하루 5배 이상 급등·90% 이상 급락)은 그날 수익 0 으로 보고 이전 가격을 보정",
      "현재 상장 종목만 포함 — 상장폐지 종목이 빠져 성과가 실제보다 좋게 나오는 생존편향",
    ],
  };
  const json = JSON.stringify(meta);
  if (!DRY) {
    writeAtomic(m.metaJson, json + "\n");
    writeAtomic(m.metaJs, `window.SCREENER_BACKTEST_META = ${json};\n`);
  }
  return { meta, bytes, metaBytes: json.length };
}

function main() {
  if (process.stdout.setEncoding) process.stdout.setEncoding("utf8");
  const t0 = Date.now();
  const stamp = kstStamp();
  const ids = ONLY ? [ONLY] : ["us", "kr"];
  let failed = 0;
  for (const id of ids) {
    const m = MARKETS[id];
    if (!m) { console.error(`unknown market ${id}`); process.exit(2); }
    try {
      console.log(`[${id}] building…`);
      const res = buildMarket(m);
      const out = writeMarket(res, stamp);
      const st = res.stats;
      console.log(`[${id}] ${st.universe}/${st.snapshotStocks}종목 · 재무 ${st.finCovered} · ${res.K}개월 ${res.cal[0].d}~${res.cal[res.K - 1].d} · 샤드 ${(out.bytes / 1048576).toFixed(1)}MB · 메타 ${(out.metaBytes / 1024).toFixed(0)}KB · ${(st.elapsedMs / 1000).toFixed(1)}s · skip ${JSON.stringify(st.skipped)}${DRY ? " (dry-run, 안 씀)" : ""}`);
    } catch (e) {
      failed++;
      console.error(`[${id}] 실패 — 기존 파일 유지: ${e && e.stack || e}`);
    }
  }
  console.log(`총 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (failed) process.exit(1);
}

main();
