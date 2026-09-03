/*
 * 차트 확률 분석 엔진 (analysis.js)
 * ----------------------------------
 * 종목 하나의 5년치 일봉(OHLCV)을 받아 두 가지 방식으로 상승/하락 확률을 추정한다.
 *
 *  ① 신호 합의(Signal Consensus): 추세·모멘텀·거래량·변동성·캔들 지표가 각각
 *     강세(+) / 약세(-)에 투표하고, 가중 평균을 확률로 변환한다.
 *  ② 과거 유사 상황 실측(Backtest Base-Rate): 지금과 비슷한 기술적 상태였던
 *     과거 날들을 모두 찾아, 그날들 중 H일 뒤 실제로 오른 비율을 센다.
 *
 * 두 값은 모두 "기술적 추정치"이며 미래를 보장하지 않는다. UI에 면책 문구를 둔다.
 * 외부 서버 없이 브라우저에서 data/details/{TICKER}.json 한 파일만 읽어 계산한다.
 *
 * 이 파일은 standalone 페이지(analysis.html)와 대시보드 종목 분석 페이지(index.html)
 * 양쪽에서 로드된다. 전역 충돌을 피하려고 전체를 IIFE로 감싸고, 엔진은 window.MirProb
 * 로만 노출한다. (analysis.html 의 UI 바인딩은 해당 DOM이 있을 때만 동작.)
 */

(function () {
function isKrAnalysisMode() {
  return typeof window !== "undefined" && window.MirMarket?.getMode?.() === "kr";
}

// 시장 모드에 맞는 가격 표기(US $ / KR 원). 이 결과 HTML은 KR 대시보드에서도
// 재사용되므로(app.js가 buildResultHTML을 호출) $ 를 하드코딩하면 안 된다.
// market_config.js 미로드 환경에선 기존과 동일한 $ 표기로 폴백한다.
function fmtPrice(value) {
  const cfg = typeof window !== "undefined" && window.MirMarket?.getConfig?.();
  if (cfg && typeof cfg.formatPrice === "function") return cfg.formatPrice(value);
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "-";
}

// ===== 지표 수학 =====
// 구현은 indicators.js(window.MirIndicators) 한 곳에만 있다. 아래는 호출부 이름을 그대로
// 두기 위한 얇은 위임 래퍼다. 예전엔 이 파일·chart-indicators.js·chart_capture.js 가 각자
// 사본을 갖고 있었고 이미 값이 어긋나 있었다(RSI 시드·Cutler/Wilder, OBV 시드, MFI 비교
// 기준, 슈퍼트렌드 초기 추세 시드, 합성봉 가드 유무).
//
// 로드 순서: indicators.js 는 이 파일보다 먼저 실행돼야 한다. analysis.html·
// chart_capture.html 에는 <script src="indicators.js"> 를 넣었다. index.html 에 아직 태그가
// 없는 과도기에는 아래 부트스트랩이 파서를 막고 동기 로드한다(문서 파싱 중에만 동작).
// 태그가 추가되면 window.MirIndicators 가 이미 있어 부트스트랩은 무동작이 된다.
if (typeof document !== "undefined" && typeof window !== "undefined"
    && !window.MirIndicators && document.readyState === "loading"
    && document.currentScript && !document.querySelector('script[src^="indicators.js"]')) {
  document.write('<scr' + 'ipt src="indicators.js"><\/scr' + 'ipt>');
}

// 지표 모듈은 **호출 시점에** 찾는다. 위 부트스트랩이 주입한 스크립트는 이 파일의 나머지가
// 다 실행된 뒤에 실행되므로, 로드 시점에 참조를 잡아두면 안 된다.
function MI() {
  const m = (typeof window !== "undefined" && window.MirIndicators)
    || (typeof globalThis !== "undefined" && globalThis.MirIndicators);
  if (!m) throw new Error("indicators.js 미로드 — <script src=\"indicators.js\"> 를 analysis.js 앞에 두세요.");
  return m;
}

function smaArray(values, period) { return MI().smaArray(values, period); }
function emaRaw(values, period) { return MI().emaRaw(values, period); }
function emaArray(values, period) { return MI().emaArray(values, period); }
function rsiSeries(values, period) { return MI().rsiSeries(values, period); }
function macdSeries(values) { return MI().macdSeries(values); }
function bollinger(values, period, mult) { return MI().bollinger(values, period, mult); }
function trueRangeArray(rows) { return MI().trueRangeArray(rows); }
function wilderArray(values, period) { return MI().wilderArray(values, period); }
function atrArray(rows, period) { return MI().atrArray(rows, period); }
function adxArrays(rows, period) { return MI().adxArrays(rows, period); }
function stochArrays(rows, kPeriod, dPeriod) { return MI().stochArrays(rows, kPeriod, dPeriod); }
function obvArray(rows) { return MI().obvArray(rows); }
function rocArray(values, period) { return MI().rocArray(values, period); }
function isSyntheticRows(rows) { return MI().isSyntheticRows(rows); }
function rollingVwap(rows, period) { return MI().rollingVwap(rows, period); }
function keltnerChannels(rows, period, mult) { return MI().keltnerChannels(rows, period, mult); }
function ichimokuArrays(rows) { return MI().ichimokuArrays(rows); }
function supertrendState(rows, period, mult) { return MI().supertrendState(rows, period, mult); }
function cmfArray(rows, period) { return MI().cmfArray(rows, period); }
function mfiArray(rows, period) { return MI().mfiArray(rows, period); }
function parabolicSarArray(rows, step, maxStep) { return MI().parabolicSarArray(rows, step, maxStep); }
function linearRegressionChannel(rows, period) { return MI().linearRegressionChannel(rows, period); }
function ttmSqueezeState(rows) { return MI().ttmSqueezeState(rows); }
function ttmSqueezeSeries(rows) { return MI().ttmSqueezeSeries(rows); }
function floorTraderPivots(rows) { return MI().floorTraderPivots(rows); }
function fibonacciLevels(rows, lookback) { return MI().fibonacciLevels(rows, lookback); }
function chandelierExitArray(rows, period, mult) { return MI().chandelierExitArray(rows, period, mult); }
function williamsArray(rows, period) { return MI().williamsArray(rows, period); }
function cciArray(rows, period) { return MI().cciArray(rows, period); }
function wilsonInterval(successes, n, z) { return MI().wilsonInterval(successes, n, z); }

// ISO-8601 주차 키(연도-주차). 예전의 floor((날짜-1/1)/7일) 방식은 연초 요일에 따라
// 거래주 하나가 두 키로 쪼개져 주봉이 임의 분할됐다. ISO 주(목요일 귀속)로 고정한다.
function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; // 일요일(0) → 7
  t.setUTCDate(t.getUTCDate() + 4 - day); // 그 주의 목요일로 이동
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

function aggregateWeekly(rows) {
  const weeks = [];
  let cur = null;
  for (const r of rows) {
    const d = r.d ? new Date(r.d) : null;
    const key = d ? isoWeekKey(d) : String(weeks.length);
    if (!cur || cur.key !== key) {
      cur = { key, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0, d: r.d };
      weeks.push(cur);
    } else {
      cur.h = Math.max(cur.h, r.h);
      cur.l = Math.min(cur.l, r.l);
      cur.c = r.c;
      cur.v += r.v || 0;
      cur.d = r.d;
    }
  }
  return weeks;
}

function aggregateMonthly(rows) {
  const months = [];
  let cur = null;
  for (const r of rows) {
    const key = r.d ? String(r.d).slice(0, 7) : String(months.length);
    if (!cur || cur.key !== key) {
      cur = { key, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0, d: r.d };
      months.push(cur);
    } else {
      cur.h = Math.max(cur.h, r.h);
      cur.l = Math.min(cur.l, r.l);
      cur.c = r.c;
      cur.v += r.v || 0;
      cur.d = r.d;
    }
  }
  return months;
}

// 이평 정배열/역배열 판정. 일·주봉은 20/60, 월봉은 6/12 — 5년 이력은 월봉이 60개뿐이라
// 60개월 SMA 를 요구하면 항상 "데이터 부족" 이 된다(월봉 12개 이상이면 판정 가능).
function tfTrendState(closes, fast = 20, slow = 60) {
  const sma20 = smaArray(closes, fast);
  const sma60 = smaArray(closes, slow);
  const n = closes.length - 1;
  const s20 = sma20[n];
  const s60 = sma60[n];
  const price = closes[n];
  if (s20 == null || s60 == null) return { bull: false, bear: false, label: "데이터 부족" };
  if (price > s20 && s20 > s60) return { bull: true, bear: false, label: "정배열" };
  if (price < s20 && s20 < s60) return { bull: false, bear: true, label: "역배열" };
  return { bull: false, bear: false, label: "혼조" };
}

function computeGapFillStats(rows, maxFillBars = 40, minPct = 0.003) {
  const samples = [];
  for (let i = 1; i < rows.length - 5; i += 1) {
    const prev = rows[i - 1];
    const cur = rows[i];
    let zone = null;
    if (cur.l > prev.h * (1 + minPct)) zone = { type: "up", lo: prev.h, hi: cur.l, idx: i };
    else if (cur.h < prev.l * (1 - minPct)) zone = { type: "down", lo: cur.h, hi: prev.l, idx: i };
    if (!zone) continue;
    let filled = false;
    let fillBars = null;
    // 갭 발생 봉(i) 자신은 존 경계(zone.hi = cur.l 등)에 항상 닿아 있어 j=i부터 돌면
    // 모든 갭이 fillBars=0으로 '메움' 처리된다. 다음 봉부터 검사한다(파이썬 포팅본과 동일).
    for (let j = i + 1; j < Math.min(rows.length, i + maxFillBars); j += 1) {
      if (rows[j].l <= zone.hi && rows[j].h >= zone.lo) { filled = true; fillBars = j - i; break; }
    }
    // 우측 절단(right-censoring): 관찰 창(maxFillBars)이 아직 다 지나지 않은 최근 갭은
    // '안 메워짐' 으로 확정할 수 없다. 비율 분모에서 빼고 목록에는 '관찰 중' 으로 남긴다.
    const censored = !filled && (i + maxFillBars > rows.length);
    samples.push({ ...zone, filled, fillBars, censored });
  }
  const resolved = samples.filter((s) => !s.censored);
  const n = resolved.length;
  const filledN = resolved.filter((s) => s.filled).length;
  const recent = samples.slice(-3).reverse();
  return {
    samples: n,
    pending: samples.length - n,
    fillRate: n ? (filledN / n) * 100 : null,
    avgFillBars: filledN ? resolved.filter((s) => s.filled && s.fillBars != null).reduce((a, s) => a + s.fillBars, 0) / filledN : null,
    recent,
  };
}

// 실측 옵션 지표(data/options_stats.js, window.OPTIONS_STATS — 야후 최근월물 OI 기준).
// 예전의 '맥스페인/콜월/풋월/감마 추정' 카드는 옵션 데이터 없이 행사가 그리드로 산수만
// 한 것이라 삭제했다. 빌더가 수집한 종목(약 76개)만 값이 있고, 없으면 카드를 내지 않는다.
function optionsStatsForTicker(ticker) {
  if (!ticker || typeof window === "undefined") return null;
  const os = window.OPTIONS_STATS;
  if (!os || !os.stocks) return null;
  const row = os.stocks[String(ticker).toUpperCase()];
  if (!row) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const out = {
    putCallOI: num(row.putCallOI),
    putCallVol: num(row.putCallVol),
    maxPain: num(row.maxPain),
    expectedMovePct: num(row.expectedMovePct),
    expiry: row.expiry || null,
    callOI: num(row.callOI),
    putOI: num(row.putOI),
    source: os.source || "options_stats",
    updatedAtKst: os.updatedAtKst || null,
  };
  if (out.putCallOI == null && out.maxPain == null) return null;
  return out;
}

function institutionalFlowForTicker(ticker) {
  if (!ticker || typeof window === "undefined") return null;
  const key = String(ticker).toUpperCase();
  const insts = (window.INSTITUTIONAL_13F || {}).institutions || [];
  let instCount = 0;
  let totalValueM = 0;
  let topInst = "";
  for (const inst of insts) {
    const holdings = (inst.quarters && inst.quarters.length ? inst.quarters[inst.quarters.length - 1].holdings : inst.holdings) || [];
    const h = holdings.find((x) => String(x.ticker).toUpperCase() === key);
    if (h) {
      instCount += 1;
      totalValueM += Number(h.valueM) || (Number(h.valueK) || 0) / 1000;
      if (!topInst) topInst = inst.name || inst.manager || "";
    }
  }
  const trades = ((window.INSIDER_TRADES || {}).trades || []).filter((t) => String(t.ticker).toUpperCase() === key);
  const buys = trades.filter((t) => t.kind === "buy").length;
  const sells = trades.filter((t) => t.kind === "sell").length;
  const recent = trades.slice(0, 4).map((t) => `${t.owner || "임원"} ${t.codeLabel || t.kind} ${t.shares ? Math.round(t.shares).toLocaleString() + "주" : ""}`.trim());
  return { instCount, totalValueM, topInst, insiderCount: trades.length, netBuyBias: buys - sells, recent };
}

function getShortInterest(ticker) {
  const data = typeof window !== "undefined" && window.SHORT_INTEREST;
  if (!data || !ticker || !data.rows) return null;
  const row = data.rows.find((r) => String(r.ticker).toUpperCase() === String(ticker).toUpperCase());
  return row || null;
}

function computeAtrLevels(rows, price, mult = 2) {
  const atr = atrArray(rows, 14);
  const last = atr[atr.length - 1];
  if (last == null) return null;
  return {
    atr: last,
    stop: price - mult * last,
    target: price + mult * last,
    target2: price + mult * 2 * last,
    riskPct: (mult * last / price) * 100,
  };
}

function computeTechnicalLevels(rows, price) {
  return {
    fib: fibonacciLevels(rows),
    pivots: floorTraderPivots(rows),
    atr: computeAtrLevels(rows, price),
    linreg: linearRegressionChannel(rows),
    psar: parabolicSarArray(rows),
  };
}

function buildMultiTimeframeContext(rows) {
  const daily = tfTrendState(rows.map((r) => r.c));
  const weekly = aggregateWeekly(rows);
  const monthly = aggregateMonthly(rows);
  if (weekly.length < 20) return { alignment: 0, bias: 0, label: "주봉 데이터 부족", daily, weekly: null, monthly: null };
  const wTrend = tfTrendState(weekly.map((r) => r.c));
  const mTrend = monthly.length >= 12 ? tfTrendState(monthly.map((r) => r.c), 6, 12) : { bull: false, bear: false, label: "월봉 부족" };
  let score = 0;
  if (daily.bull) score += 1; else if (daily.bear) score -= 1;
  if (wTrend.bull) score += 1.2; else if (wTrend.bear) score -= 1.2;
  if (mTrend.bull) score += 1.5; else if (mTrend.bear) score -= 1.5;
  const bias = Math.max(-1, Math.min(1, score / 3.7));
  let label = `일 ${daily.label} · 주 ${wTrend.label} · 월 ${mTrend.label}`;
  if (score >= 2.5) label = "일·주·월 상승 정렬";
  else if (score <= -2.5) label = "일·주·월 하락 정렬";
  const agree = [daily.bull === wTrend.bull && daily.bull, daily.bear === wTrend.bear && daily.bear,
    mTrend.bull && wTrend.bull, mTrend.bear && wTrend.bear].filter(Boolean).length;
  const alignment = agree >= 2 ? 0.9 : Math.abs(bias) > 0.45 ? 0.7 : Math.abs(bias) > 0.2 ? 0.5 : 0.25;
  return {
    alignment, bias, label, daily, weekly: wTrend, monthly: mTrend,
    weeklyBull: wTrend.bull, weeklyBear: wTrend.bear,
  };
}

// 선형회귀 기울기를 평균값 대비 % 로 환산 (추세 방향/강도 측정에 사용)
function slopePct(values, lookback) {
  const n = values.length;
  if (n < lookback) return 0;
  const seg = values.slice(n - lookback);
  const m = seg.reduce((a, b) => a + b, 0) / lookback;
  if (!m) return 0;
  let num = 0;
  let den = 0;
  const xm = (lookback - 1) / 2;
  for (let i = 0; i < lookback; i += 1) {
    num += (i - xm) * (seg[i] - m);
    den += (i - xm) * (i - xm);
  }
  const slope = den ? num / den : 0;
  return (slope / m) * 100; // 막대당 평균 대비 % 변화
}

// ===== 캔들 패턴 (최근 봉 기준) =====
function detectCandlePatterns(rows) {
  const n = rows.length;
  if (n < 3 || isSyntheticRows(rows)) return [];
  const a = rows[n - 3];
  const b = rows[n - 2];
  const c = rows[n - 1];
  const out = [];
  const body = (r) => Math.abs(r.c - r.o);
  const range = (r) => Math.max(1e-9, r.h - r.l);
  const upperWick = (r) => r.h - Math.max(r.c, r.o);
  const lowerWick = (r) => Math.min(r.c, r.o) - r.l;

  // 상승 장악형
  if (c.c > c.o && b.c < b.o && c.c >= b.o && c.o <= b.c && body(c) > body(b)) {
    out.push({ name: "상승 장악형", dir: 1, weight: 1.1 });
  }
  // 하락 장악형
  if (c.c < c.o && b.c > b.o && c.o >= b.c && c.c <= b.o && body(c) > body(b)) {
    out.push({ name: "하락 장악형", dir: -1, weight: 1.1 });
  }
  // 망치형 (하락 후 긴 아래꼬리)
  if (lowerWick(c) > body(c) * 2 && upperWick(c) < body(c) && c.c < a.c) {
    out.push({ name: "망치형(반등 신호)", dir: 1, weight: 0.8 });
  }
  // 유성형 (상승 후 긴 위꼬리)
  if (upperWick(c) > body(c) * 2 && lowerWick(c) < body(c) && c.c > a.c) {
    out.push({ name: "유성형(하락 신호)", dir: -1, weight: 0.8 });
  }
  // 도지 (방향성 약화)
  if (body(c) < range(c) * 0.1) {
    out.push({ name: "도지(관망)", dir: 0, weight: 0.4 });
  }
  return out;
}

// ===== 강도 점수 기반 지지/저항 (차트 오버레이 + 패널 공용 — 단일 소스) =====
// 근거: ① 스윙 고저점(터치) ② 닿은 뒤 반전 크기(ATR 대비) ③ 거래량 프로파일(매물대)
//       ④ 최신성 ⑤ 근접성. 클러스터 허용오차/존 두께는 ATR로 자동 조절.
function windowAtr(rows) {
  const n = rows.length;
  let sum = 0;
  let cnt = 0;
  for (let i = Math.max(1, n - 50); i < n; i += 1) {
    const tr = Math.max(
      rows[i].h - rows[i].l,
      Math.abs(rows[i].h - rows[i - 1].c),
      Math.abs(rows[i].l - rows[i - 1].c),
    );
    sum += tr; cnt += 1;
  }
  return cnt ? sum / cnt : (rows[n - 1].c * 0.02);
}

// 거래량 프로파일: 가격축 60구간에 봉별 거래량을 [저,고]로 분산 누적 →
// 국소 최대(고거래량 노드, HVN) = 실제 매물이 몰린 가격대.
function volumeProfileNodes(rows) {
  const n = rows.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) { if (r.l < lo) lo = r.l; if (r.h > hi) hi = r.h; }
  if (!(hi > lo)) return [];
  const BINS = 60;
  const binW = (hi - lo) / BINS;
  const vol = new Array(BINS).fill(0);
  const lastIdx = new Array(BINS).fill(0);
  for (let i = 0; i < n; i += 1) {
    const r = rows[i];
    const a = Math.min(BINS - 1, Math.max(0, Math.floor((r.l - lo) / binW)));
    const b = Math.min(BINS - 1, Math.max(a, Math.floor((r.h - lo) / binW)));
    const share = (r.v || 0) / (b - a + 1);
    for (let k = a; k <= b; k += 1) { vol[k] += share; lastIdx[k] = i; }
  }
  const nodes = [];
  for (let k = 1; k < BINS - 1; k += 1) {
    if (vol[k] > 0 && vol[k] >= vol[k - 1] && vol[k] >= vol[k + 1]) {
      nodes.push({ price: lo + (k + 0.5) * binW, vol: vol[k], idx: lastIdx[k] });
    }
  }
  return nodes;
}

function supportResistanceLevels(rows, maxPerSide = 3) {
  const n = rows.length;
  if (n < 12) return [];
  const price = rows[n - 1].c;
  const atr = windowAtr(rows);
  const atrPct = price ? atr / price : 0.02;
  const win = Math.max(3, Math.min(8, Math.floor(n / 25)));
  const fwd = Math.min(20, Math.floor(n / 4));

  const cands = [];
  for (let i = win; i < n - win; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - win; j <= i + win; j += 1) {
      if (j === i) continue;
      if (rows[j].h > rows[i].h) isHigh = false;
      if (rows[j].l < rows[i].l) isLow = false;
    }
    if (isHigh) {
      let drop = 0;
      for (let j = i + 1; j <= Math.min(n - 1, i + fwd); j += 1) drop = Math.max(drop, rows[i].h - rows[j].l);
      cands.push({ price: rows[i].h, touches: 1, reaction: atr ? drop / atr : 0, vol: 0, idx: i });
    }
    if (isLow) {
      let rise = 0;
      for (let j = i + 1; j <= Math.min(n - 1, i + fwd); j += 1) rise = Math.max(rise, rows[j].h - rows[i].l);
      cands.push({ price: rows[i].l, touches: 1, reaction: atr ? rise / atr : 0, vol: 0, idx: i });
    }
  }
  for (const node of volumeProfileNodes(rows)) {
    cands.push({ price: node.price, touches: 0, reaction: 0, vol: node.vol, idx: node.idx });
  }
  if (!cands.length) return [];

  cands.sort((a, b) => a.price - b.price);
  const tol = Math.max(0.6 * atrPct, 0.004);
  const clusters = [];
  for (const c of cands) {
    const last = clusters[clusters.length - 1];
    const mean = last ? last.sum / last.wsum : 0;
    if (last && mean && Math.abs(c.price - mean) / mean <= tol) {
      last.sum += c.price; last.wsum += 1;
      last.touches += c.touches; last.reaction += c.reaction; last.vol += c.vol;
      last.lo = Math.min(last.lo, c.price); last.hi = Math.max(last.hi, c.price);
      last.idx = Math.max(last.idx, c.idx);
    } else {
      clusters.push({ sum: c.price, wsum: 1, touches: c.touches, reaction: c.reaction, vol: c.vol, lo: c.price, hi: c.price, idx: c.idx });
    }
  }

  const maxT = Math.max(1, ...clusters.map((c) => c.touches));
  const maxR = Math.max(1e-9, ...clusters.map((c) => c.reaction));
  const maxV = Math.max(1e-9, ...clusters.map((c) => c.vol));
  const levels = clusters.map((c) => {
    const p = c.sum / c.wsum;
    const recency = n > 1 ? c.idx / (n - 1) : 0.5;
    const prox = 1 - Math.min(1, Math.abs(p - price) / (price * 0.25));
    const score = 0.30 * (c.vol / maxV) + 0.22 * (c.touches / maxT)
      + 0.18 * (c.reaction / maxR) + 0.12 * recency + 0.18 * prox;
    const half = Math.max(0.4 * atr, (c.hi - c.lo) / 2);
    return { price: p, lo: p - half, hi: p + half, touches: c.touches, vol: c.vol, score };
  });

  const sup = levels.filter((l) => l.price < price).sort((a, b) => b.score - a.score).slice(0, maxPerSide);
  const res = levels.filter((l) => l.price >= price).sort((a, b) => b.score - a.score).slice(0, maxPerSide);
  const maxScore = Math.max(1e-9, ...levels.map((l) => l.score));
  const out = [
    ...sup.map((l) => ({ ...l, type: "sup" })),
    ...res.map((l) => ({ ...l, type: "res" })),
  ];
  for (const l of out) l.tier = l.score >= 0.66 * maxScore ? 3 : (l.score >= 0.4 * maxScore ? 2 : 1);
  return out;
}

// 패널 표시용 요약: 현재가에서 가장 가까운 지지/저항(차트에 그려지는 선과 동일 소스).
function srSummary(rows) {
  if (!rows.length) return { support: null, resistance: null, price: null, levels: [] };
  const price = rows[rows.length - 1].c;
  const levels = supportResistanceLevels(rows);
  const sup = levels.filter((l) => l.type === "sup").sort((a, b) => b.price - a.price);
  const res = levels.filter((l) => l.type === "res").sort((a, b) => a.price - b.price);
  return {
    support: sup.length ? sup[0].price : null,
    resistance: res.length ? res[0].price : null,
    price,
    levels,
  };
}

// ===== 차트 패턴 감지 (scripts/pattern_lib.py 의 브라우저 포팅본) =====
// 아래 상수/알고리즘은 pattern_lib.py 와 1:1로 동일해야 한다.
//    (그래야 오프라인으로 만든 data/pattern_stats.json 의 과거 성공률 조회가 유효하다.)
const PAT = {
  PIVOT_WIN: 5,
  TOP_TOL: 0.04,
  TROUGH_MIN: 0.03,
  SHOULDER_TOL: 0.06,
  HEAD_MIN: 0.02,
  CONFIRM_MAX_BARS: 40,
  FLAT_SLOPE: 0.0006,
  TRI_LOOKBACK: 90,
  SR_LOOKBACK: 120,
  RECENT_WINDOW: 10,
};
const PATTERN_LABELS = {
  double_top: "쌍천장(이중 천장)",
  double_bottom: "쌍바닥(이중 바닥)",
  hns: "헤드앤숄더(천장)",
  inv_hns: "역헤드앤숄더(바닥)",
  ascending_triangle: "상승 삼각수렴",
  descending_triangle: "하락 삼각수렴",
  symmetrical_triangle: "대칭 삼각수렴",
  falling_wedge: "하락 쐐기형",
  rising_wedge: "상승 쐐기형",
  box_breakout: "박스권 상향 돌파",
  box_breakdown: "박스권 하향 이탈",
  bull_flag: "상승 깃발형",
  bear_flag: "하락 깃발형",
  bull_pennant: "상승 페넌트",
  bear_pennant: "하락 페넌트",
  triple_top: "삼중 천장형",
  triple_bottom: "삼중 바닥형",
  broadening_triangle: "확산형 삼각수렴",
  // 다이아몬드의 type 문자열은 돌파 방향 기준(diamond_top=상방 돌파 +1)으로 감지기가
  // 붙여 왔고 pattern_stats.json 키도 그 기준으로 쌓였다. 키를 바꾸면 과거 통계와
  // 조인이 끊기므로 type 은 유지하고, 표시 라벨만 방향과 일치하게 적는다
  // (예전 라벨 "천장형"은 상승 통계와 모순됐다).
  diamond_top: "다이아몬드 상방 돌파",
  diamond_bottom: "다이아몬드 하방 이탈",
  rounding_bottom: "라운딩 바닥형(U자형)",
  complex_hns: "복합 헤드앤숄더",
  cup_and_handle: "컵 앤 핸들",
  ascending_channel_breakout: "상승 채널 돌파",
  descending_channel_breakout: "하락 채널 이탈",
  reversal_123_up: "1-2-3 반전(상승)",
  reversal_123_down: "1-2-3 반전(하락)",
  two_b_bottom: "2B 바닥",
  two_b_top: "2B 천장",
  bull_trap: "불 트랩(가짜 돌파)",
  bear_trap: "베어 트랩(가짜 이탈)",
  breakaway_gap_up: "상승 갭(돌파형)",
  breakaway_gap_down: "하락 갭(돌파형)",
  exhaustion_gap_up: "상승 갭(소진형)",
  exhaustion_gap_down: "하락 갭(소진형)",
  island_reversal: "아일랜드 반전",
  gap_fill_setup: "갭 메우기 셋업",
  volume_climax_up: "거래량 클라이맥스(상승)",
  volume_climax_down: "거래량 클라이맥스(하락)",
  nr4_breakout_up: "NR4 상향 돌파",
  nr4_breakout_down: "NR4 하향 이탈",
  inside_bar_breakout_up: "인사이드바 상향 돌파",
  inside_bar_breakout_down: "인사이드바 하향 이탈",
  harmonic_abcd_bull: "하모닉 AB=CD(상승)",
  harmonic_abcd_bear: "하모닉 AB=CD(하락)",
  bullish_engulfing: "상승 장악형",
  bearish_engulfing: "하락 장악형",
  hammer: "망치형",
  shooting_star: "유성형",
  doji: "도지",
  morning_star: "샛별형(모닝스타)",
  evening_star: "석별형(이브닝스타)",
  three_white_soldiers: "적삼병",
  three_black_crows: "흑삼병",
  piercing_line: "관통형",
  dark_cloud_cover: "먹구름형",
  resistance_breakout: "저항선 돌파",
  support_breakdown: "지지선 이탈",
};

function findPivots(rows, win = PAT.PIVOT_WIN) {
  const n = rows.length;
  const pivots = [];
  for (let i = win; i < n - win; i += 1) {
    const hi = rows[i].h;
    const lo = rows[i].l;
    let isHigh = true;
    let isLow = true;
    for (let j = i - win; j <= i + win; j += 1) {
      if (j === i) continue;
      if (rows[j].h > hi) isHigh = false;
      if (rows[j].l < lo) isLow = false;
    }
    if (isHigh) pivots.push({ idx: i, price: hi, type: "H" });
    if (isLow) pivots.push({ idx: i, price: lo, type: "L" });
  }
  pivots.sort((a, b) => (a.idx - b.idx) || ((a.type === "H" ? 0 : 1) - (b.type === "H" ? 0 : 1)));
  return pivots;
}

function zigzagPivots(pivots) {
  const seq = [];
  for (const p of pivots) {
    if (!seq.length) { seq.push({ ...p }); continue; }
    const last = seq[seq.length - 1];
    if (p.type === last.type) {
      if (p.type === "H" && p.price >= last.price) seq[seq.length - 1] = { ...p };
      else if (p.type === "L" && p.price <= last.price) seq[seq.length - 1] = { ...p };
    } else {
      seq.push({ ...p });
    }
  }
  return seq;
}

// startIdx 다음 봉부터 종가가 level 을 direction 방향으로 돌파하는 첫 봉(확정 인덱스).
// lag: startIdx 가 프랙탈 피벗(좌우 PIVOT_WIN 봉 비교)이면 그 피벗은 PIVOT_WIN 봉 뒤에야
// 알 수 있다. 그 전에 돌파가 나면 실전에서는 알 수 없었던 시점이므로 확정 인덱스를
// startIdx+lag 이후로 민다(룩어헤드 방지 — 전방 수익률은 확정 인덱스부터 잰다).
// 피벗이 아니라 완성된 봉(NR4·인사이드바·라운딩 창 끝)에서 시작하는 감지기는 lag=0.
// scripts/pattern_lib.py _confirm_break 와 1:1 로 동일해야 한다.
function confirmBreak(rows, startIdx, level, direction, invalidateLevel, lag = PAT.PIVOT_WIN) {
  const n = rows.length;
  const end = Math.min(n, startIdx + 1 + PAT.CONFIRM_MAX_BARS);
  for (let k = startIdx + 1; k < end; k += 1) {
    const c = rows[k].c;
    let hit = false;
    if (direction < 0) {
      if (invalidateLevel != null && c > invalidateLevel) return null;
      if (c < level) hit = true;
    } else {
      if (invalidateLevel != null && c < invalidateLevel) return null;
      if (c > level) hit = true;
    }
    if (hit) {
      const ci = Math.max(k, startIdx + lag);
      return ci < n ? ci : null;
    }
  }
  return null;
}

function lineAt(x0, y0, x1, y1, x) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

function slopePctPts(points) {
  const n = points.length;
  if (n < 2) return 0;
  let mx = 0;
  let my = 0;
  for (const p of points) { mx += p[0]; my += p[1]; }
  mx /= n; my /= n;
  if (my === 0) return 0;
  let num = 0;
  let den = 0;
  for (const p of points) { num += (p[0] - mx) * (p[1] - my); den += (p[0] - mx) * (p[0] - mx); }
  const slope = den ? num / den : 0;
  return slope / my;
}

function detectDouble(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 2; i += 1) {
    const a = z[i];
    const b = z[i + 1];
    const c = z[i + 2];
    if (a.type === "H" && b.type === "L" && c.type === "H") {
      const top = (a.price + c.price) / 2;
      if (top > 0 && Math.abs(a.price - c.price) / top <= PAT.TOP_TOL
        && (top - b.price) / top >= PAT.TROUGH_MIN) {
        const neck = b.price;
        const ci = confirmBreak(rows, c.idx, neck, -1, Math.max(a.price, c.price));
        if (ci != null) out.push({ pattern: "double_top", dir: -1, confirm_idx: ci, neckline: neck,
          points: [{ idx: a.idx, price: a.price, label: "천장" }, { idx: b.idx, price: b.price, label: "" }, { idx: c.idx, price: c.price, label: "천장" }],
          necklinePts: [{ idx: a.idx, price: neck }, { idx: ci, price: neck }] });
      }
    }
    if (a.type === "L" && b.type === "H" && c.type === "L") {
      const bot = (a.price + c.price) / 2;
      if (bot > 0 && Math.abs(a.price - c.price) / bot <= PAT.TOP_TOL
        && (b.price - bot) / bot >= PAT.TROUGH_MIN) {
        const neck = b.price;
        const ci = confirmBreak(rows, c.idx, neck, +1, Math.min(a.price, c.price));
        if (ci != null) out.push({ pattern: "double_bottom", dir: +1, confirm_idx: ci, neckline: neck,
          points: [{ idx: a.idx, price: a.price, label: "바닥" }, { idx: b.idx, price: b.price, label: "" }, { idx: c.idx, price: c.price, label: "바닥" }],
          necklinePts: [{ idx: a.idx, price: neck }, { idx: ci, price: neck }] });
      }
    }
  }
  return out;
}

function detectHns(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 4; i += 1) {
    const p = z.slice(i, i + 5);
    const types = p.map((x) => x.type).join("");
    if (types === "HLHLH") {
      const [ls, t1, head, t2, rs] = p;
      if (head.price > ls.price && head.price > rs.price) {
        const sh = (ls.price + rs.price) / 2;
        if (sh > 0 && Math.abs(ls.price - rs.price) / sh <= PAT.SHOULDER_TOL
          && (head.price - sh) / sh >= PAT.HEAD_MIN) {
          const neck = lineAt(t1.idx, t1.price, t2.idx, t2.price, rs.idx);
          const ci = confirmBreak(rows, rs.idx, neck, -1, head.price);
          if (ci != null) out.push({ pattern: "hns", dir: -1, confirm_idx: ci, neckline: neck,
            points: [{ idx: ls.idx, price: ls.price, label: "좌어깨" }, { idx: t1.idx, price: t1.price, label: "" }, { idx: head.idx, price: head.price, label: "머리" }, { idx: t2.idx, price: t2.price, label: "" }, { idx: rs.idx, price: rs.price, label: "우어깨" }],
            necklinePts: [{ idx: t1.idx, price: t1.price }, { idx: ci, price: lineAt(t1.idx, t1.price, t2.idx, t2.price, ci) }] });
        }
      }
    } else if (types === "LHLHL") {
      const [ls, t1, head, t2, rs] = p;
      if (head.price < ls.price && head.price < rs.price) {
        const sh = (ls.price + rs.price) / 2;
        if (sh > 0 && Math.abs(ls.price - rs.price) / sh <= PAT.SHOULDER_TOL
          && (sh - head.price) / sh >= PAT.HEAD_MIN) {
          const neck = lineAt(t1.idx, t1.price, t2.idx, t2.price, rs.idx);
          const ci = confirmBreak(rows, rs.idx, neck, +1, head.price);
          if (ci != null) out.push({ pattern: "inv_hns", dir: +1, confirm_idx: ci, neckline: neck,
            points: [{ idx: ls.idx, price: ls.price, label: "좌어깨" }, { idx: t1.idx, price: t1.price, label: "" }, { idx: head.idx, price: head.price, label: "머리" }, { idx: t2.idx, price: t2.price, label: "" }, { idx: rs.idx, price: rs.price, label: "우어깨" }],
            necklinePts: [{ idx: t1.idx, price: t1.price }, { idx: ci, price: lineAt(t1.idx, t1.price, t2.idx, t2.price, ci) }] });
        }
      }
    }
  }
  return out;
}

function detectTriangle(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= PAT.TRI_LOOKBACK);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);
    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));
    const res = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const sup = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (res <= sup) continue;
    const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);
    // 수렴 추세선(저항=고점선, 지지=저점선) 좌표 — 차트 도형용
    const triLines = [
      { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
      { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] },
    ];
    const flatH = Math.abs(sh) < PAT.FLAT_SLOPE;
    const flatL = Math.abs(sl) < PAT.FLAT_SLOPE;
    let pat = null;
    let direction = null;
    let neck = null;
    if (flatH && sl > PAT.FLAT_SLOPE) { pat = "ascending_triangle"; direction = +1; neck = highs[highs.length - 1].price; }
    else if (flatL && sh < -PAT.FLAT_SLOPE) { pat = "descending_triangle"; direction = -1; neck = lows[lows.length - 1].price; }
    else if (sh < -PAT.FLAT_SLOPE && sl > PAT.FLAT_SLOPE) {
      const ciUp = confirmBreak(rows, lastIdx, highs[highs.length - 1].price, +1, null);
      const ciDn = confirmBreak(rows, lastIdx, lows[lows.length - 1].price, -1, null);
      if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
        out.push({ pattern: "symmetrical_triangle", dir: +1, confirm_idx: ciUp, neckline: highs[highs.length - 1].price,
          lines: triLines, points: [{ idx: ciUp, price: highs[highs.length - 1].price, label: "돌파" }] });
      } else if (ciDn != null) {
        out.push({ pattern: "symmetrical_triangle", dir: -1, confirm_idx: ciDn, neckline: lows[lows.length - 1].price,
          lines: triLines, points: [{ idx: ciDn, price: lows[lows.length - 1].price, label: "이탈" }] });
      }
      continue;
    }
    if (pat != null) {
      const ci = confirmBreak(rows, lastIdx, neck, direction, null);
      if (ci != null) out.push({ pattern: pat, dir: direction, confirm_idx: ci, neckline: neck,
        lines: triLines, points: [{ idx: ci, price: neck, label: direction > 0 ? "돌파" : "이탈" }] });
    }
  }
  return out;
}

function detectSrBreakout(rows, pivots) {
  const out = [];
  const n = rows.length;
  const highs = pivots.filter((p) => p.type === "H");
  const lows = pivots.filter((p) => p.type === "L");
  let lastResBreak = -1;
  let lastSupBreak = -1;
  const hiDq = []; // 단조 감소(최댓값)
  const loDq = []; // 단조 증가(최솟값)
  let hp = 0;
  let lp = 0;
  for (let k = PAT.SR_LOOKBACK; k < n; k += 1) {
    while (hp < highs.length && highs[hp].idx < k - PAT.PIVOT_WIN) {
      const pr = highs[hp].price;
      while (hiDq.length && hiDq[hiDq.length - 1][1] <= pr) hiDq.pop();
      hiDq.push([highs[hp].idx, pr]);
      hp += 1;
    }
    while (lp < lows.length && lows[lp].idx < k - PAT.PIVOT_WIN) {
      const pr = lows[lp].price;
      while (loDq.length && loDq[loDq.length - 1][1] >= pr) loDq.pop();
      loDq.push([lows[lp].idx, pr]);
      lp += 1;
    }
    const loBound = k - PAT.SR_LOOKBACK;
    while (hiDq.length && hiDq[0][0] < loBound) hiDq.shift();
    while (loDq.length && loDq[0][0] < loBound) loDq.shift();

    const price = rows[k].c;
    const prev = rows[k - 1].c;
    if (hiDq.length) {
      const r = hiDq[0][1];
      if (prev <= r && r < price && k - lastResBreak > PAT.PIVOT_WIN) {
        out.push({ pattern: "resistance_breakout", dir: +1, confirm_idx: k, neckline: r,
          lines: [{ pts: [{ idx: Math.max(0, k - 30), price: r }, { idx: k, price: r }] }],
          points: [{ idx: k, price: r, label: "돌파" }] });
        lastResBreak = k;
      }
    }
    if (loDq.length) {
      const s = loDq[0][1];
      if (prev >= s && s > price && k - lastSupBreak > PAT.PIVOT_WIN) {
        out.push({ pattern: "support_breakdown", dir: -1, confirm_idx: k, neckline: s,
          lines: [{ pts: [{ idx: Math.max(0, k - 30), price: s }, { idx: k, price: s }] }],
          points: [{ idx: k, price: s, label: "이탈" }] });
        lastSupBreak = k;
      }
    }
  }
  return out;
}

function detectWedge(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= PAT.TRI_LOOKBACK);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);
    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));
    const res = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const sup = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (res <= sup) continue;

    const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);
    
    let pat = null;
    let direction = null;
    let neck = null;
    
    const TOL = 0.001; // 0.1% 기울기
    if (sh < -TOL && sl < -TOL && sh < sl) {
      pat = "falling_wedge";
      direction = +1;
      neck = highs[highs.length - 1].price;
    } else if (sh > TOL && sl > TOL && sh < sl) {
      pat = "rising_wedge";
      direction = -1;
      neck = lows[lows.length - 1].price;
    }

    if (pat != null) {
      const ci = confirmBreak(rows, lastIdx, neck, direction, null);
      if (ci != null) {
        const wedgeLines = [
          { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
          { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] },
        ];
        out.push({
          pattern: pat,
          dir: direction,
          confirm_idx: ci,
          neckline: neck,
          lines: wedgeLines,
          points: [{ idx: ci, price: neck, label: direction > 0 ? "돌파" : "이탈" }]
        });
      }
    }
  }
  return out;
}

function detectBox(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= 50);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);

    const avgH = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const avgL = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (avgH <= avgL) continue;

    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));

    const FLAT_SLOPE = 0.003;
    if (Math.abs(sh) < FLAT_SLOPE && Math.abs(sl) < FLAT_SLOPE) {
      const hTol = highs.every((p) => Math.abs(p.price - avgH) / avgH < 0.02);
      const lTol = lows.every((p) => Math.abs(p.price - avgL) / avgL < 0.02);

      if (hTol && lTol) {
        const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);
        const ciUp = confirmBreak(rows, lastIdx, avgH, +1, null);
        const ciDn = confirmBreak(rows, lastIdx, avgL, -1, null);

        const boxLines = [
          { pts: [{ idx: highs[0].idx, price: avgH }, { idx: Math.max(ciUp || 0, ciDn || 0, lastIdx), price: avgH }] },
          { pts: [{ idx: lows[0].idx, price: avgL }, { idx: Math.max(ciUp || 0, ciDn || 0, lastIdx), price: avgL }] }
        ];

        if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
          out.push({
            pattern: "box_breakout",
            dir: +1,
            confirm_idx: ciUp,
            neckline: avgH,
            lines: boxLines,
            points: [{ idx: ciUp, price: avgH, label: "상향돌파" }]
          });
        } else if (ciDn != null) {
          out.push({
            pattern: "box_breakdown",
            dir: -1,
            confirm_idx: ciDn,
            neckline: avgL,
            lines: boxLines,
            points: [{ idx: ciDn, price: avgL, label: "하향이탈" }]
          });
        }
      }
    }
  }
  return out;
}

function detectFlag(rows, z) {
  const out = [];
  for (let end = 3; end < z.length; end += 1) {
    const a = z[end - 3];
    const b = z[end - 2];
    const c = z[end - 1];
    const d = z[end];
    if (!a || !b || !c || !d) continue;

    const flagpoleRise = (b.price - a.price) / a.price;
    if (a.type === "L" && b.type === "H" && flagpoleRise >= 0.10) {
      if (c.type === "L" && d.type === "H") {
        if (d.price < b.price && c.price < b.price) {
          const channelTop = b.price;
          const ci = confirmBreak(rows, d.idx, channelTop, +1, null);
          if (ci != null) {
            const flagLines = [
              { pts: [{ idx: a.idx, price: a.price }, { idx: b.idx, price: b.price }] },
              { pts: [{ idx: b.idx, price: b.price }, { idx: d.idx, price: d.price }] }
            ];
            out.push({
              pattern: "bull_flag",
              dir: +1,
              confirm_idx: ci,
              neckline: channelTop,
              lines: flagLines,
              points: [{ idx: ci, price: channelTop, label: "깃발돌파" }]
            });
          }
        }
      }
    }

    const flagpoleDrop = (a.price - b.price) / a.price;
    if (a.type === "H" && b.type === "L" && flagpoleDrop >= 0.10) {
      if (c.type === "H" && d.type === "L") {
        if (d.price > b.price && c.price > b.price) {
          const channelBottom = b.price;
          const ci = confirmBreak(rows, d.idx, channelBottom, -1, null);
          if (ci != null) {
            const flagLines = [
              { pts: [{ idx: a.idx, price: a.price }, { idx: b.idx, price: b.price }] },
              { pts: [{ idx: b.idx, price: b.price }, { idx: d.idx, price: d.price }] }
            ];
            out.push({
              pattern: "bear_flag",
              dir: -1,
              confirm_idx: ci,
              neckline: channelBottom,
              lines: flagLines,
              points: [{ idx: ci, price: channelBottom, label: "깃발이탈" }]
            });
          }
        }
      }
    }
  }
  return out;
}

function detectTriple(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 4; i += 1) {
    const p = z.slice(i, i + 5);
    const types = p.map((x) => x.type).join("");
    
    if (types === "HLHLH") {
      const [t1, b1, t2, b2, t3] = p;
      const top = (t1.price + t2.price + t3.price) / 3;
      const diff1 = Math.abs(t1.price - t2.price) / top;
      const diff2 = Math.abs(t2.price - t3.price) / top;
      const diff3 = Math.abs(t1.price - t3.price) / top;
      const trough1 = (top - b1.price) / top;
      const trough2 = (top - b2.price) / top;

      if (diff1 <= 0.02 && diff2 <= 0.02 && diff3 <= 0.02 && trough1 >= 0.03 && trough2 >= 0.03) {
        const neck = Math.min(b1.price, b2.price);
        const ci = confirmBreak(rows, t3.idx, neck, -1, Math.max(t1.price, t2.price, t3.price));
        if (ci != null) {
          out.push({
            pattern: "triple_top",
            dir: -1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: t1.idx, price: t1.price, label: "천장1" },
              { idx: t2.idx, price: t2.price, label: "천장2" },
              { idx: t3.idx, price: t3.price, label: "천장3" },
              { idx: b1.idx, price: b1.price, label: "" },
              { idx: b2.idx, price: b2.price, label: "" }
            ],
            necklinePts: [{ idx: t1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }
    
    if (types === "LHLHL") {
      const [b1, t1, b2, t2, b3] = p;
      const bot = (b1.price + b2.price + b3.price) / 3;
      const diff1 = Math.abs(b1.price - b2.price) / bot;
      const diff2 = Math.abs(b2.price - b3.price) / bot;
      const diff3 = Math.abs(b1.price - b3.price) / bot;
      const peak1 = (t1.price - bot) / bot;
      const peak2 = (t2.price - bot) / bot;

      if (diff1 <= 0.02 && diff2 <= 0.02 && diff3 <= 0.02 && peak1 >= 0.03 && peak2 >= 0.03) {
        const neck = Math.max(t1.price, t2.price);
        const ci = confirmBreak(rows, b3.idx, neck, +1, Math.min(b1.price, b2.price, b3.price));
        if (ci != null) {
          out.push({
            pattern: "triple_bottom",
            dir: +1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: b1.idx, price: b1.price, label: "바닥1" },
              { idx: b2.idx, price: b2.price, label: "바닥2" },
              { idx: b3.idx, price: b3.price, label: "바닥3" },
              { idx: t1.idx, price: t1.price, label: "" },
              { idx: t2.idx, price: t2.price, label: "" }
            ],
            necklinePts: [{ idx: b1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }
  }
  return out;
}

function detectBroadening(rows, z) {
  const out = [];
  for (let end = 4; end < z.length; end += 1) {
    const window = z.slice(0, end + 1).filter((p) => z[end].idx - p.idx <= PAT.TRI_LOOKBACK);
    let highs = window.filter((p) => p.type === "H");
    let lows = window.filter((p) => p.type === "L");
    if (highs.length < 2 || lows.length < 2) continue;
    highs = highs.slice(-3);
    lows = lows.slice(-3);

    const sh = slopePctPts(highs.map((p) => [p.idx, p.price]));
    const sl = slopePctPts(lows.map((p) => [p.idx, p.price]));
    const res = highs.reduce((a, p) => a + p.price, 0) / highs.length;
    const sup = lows.reduce((a, p) => a + p.price, 0) / lows.length;
    if (res <= sup) continue;

    const lastIdx = Math.max(highs[highs.length - 1].idx, lows[lows.length - 1].idx);

    const FLAT_SLOPE = 0.001;
    if (sh > FLAT_SLOPE && sl < -FLAT_SLOPE) {
      const ciUp = confirmBreak(rows, lastIdx, highs[highs.length - 1].price, +1, null);
      const ciDn = confirmBreak(rows, lastIdx, lows[lows.length - 1].price, -1, null);

      const broadeningLines = [
        { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[highs.length - 1].idx, price: highs[highs.length - 1].price }] },
        { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[lows.length - 1].idx, price: lows[lows.length - 1].price }] }
      ];

      if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
        out.push({
          pattern: "broadening_triangle",
          dir: +1,
          confirm_idx: ciUp,
          neckline: highs[highs.length - 1].price,
          lines: broadeningLines,
          points: [{ idx: ciUp, price: highs[highs.length - 1].price, label: "돌파" }]
        });
      } else if (ciDn != null) {
        out.push({
          pattern: "broadening_triangle",
          dir: -1,
          confirm_idx: ciDn,
          neckline: lows[lows.length - 1].price,
          lines: broadeningLines,
          points: [{ idx: ciDn, price: lows[lows.length - 1].price, label: "이탈" }]
        });
      }
    }
  }
  return out;
}

// 주의: diamond_top/diamond_bottom 의 type 문자열은 '돌파 방향' 기준이다
// (top=상방 돌파 +1, bottom=하방 이탈 -1). 교과서의 위치 기준(천장/바닥)과 다르지만
// pattern_stats.json 의 키가 이 기준으로 축적돼 있어 이름은 유지한다. 파이썬
// 포팅본(scripts/pattern_detectors_extended.py detect_diamond)과 동일해야 한다.
function detectDiamond(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 6; i += 1) {
    const p = z.slice(i, i + 7);
    const range1 = Math.abs(p[1].price - p[0].price);
    const range3 = Math.abs(p[3].price - p[2].price);
    const range4 = Math.abs(p[4].price - p[3].price);
    const range6 = Math.abs(p[6].price - p[5].price);

    if (range3 > range1 && range6 < range4) {
      const lastIdx = p[6].idx;
      const highs = p.filter((x) => x.type === "H");
      const lows = p.filter((x) => x.type === "L");
      if (highs.length < 3 || lows.length < 3) continue;

      const resPrice = highs[highs.length - 1].price;
      const supPrice = lows[lows.length - 1].price;

      const ciUp = confirmBreak(rows, lastIdx, resPrice, +1, null);
      const ciDn = confirmBreak(rows, lastIdx, supPrice, -1, null);

      const diamondLines = [
        { pts: [{ idx: highs[0].idx, price: highs[0].price }, { idx: highs[1].idx, price: highs[1].price }] },
        { pts: [{ idx: highs[1].idx, price: highs[1].price }, { idx: highs[highs.length-1].idx, price: highs[highs.length-1].price }] },
        { pts: [{ idx: lows[0].idx, price: lows[0].price }, { idx: lows[1].idx, price: lows[1].price }] },
        { pts: [{ idx: lows[1].idx, price: lows[1].price }, { idx: lows[lows.length-1].idx, price: lows[lows.length-1].price }] }
      ];

      if (ciUp != null && (ciDn == null || ciUp <= ciDn)) {
        out.push({
          pattern: "diamond_top",
          dir: +1,
          confirm_idx: ciUp,
          neckline: resPrice,
          lines: diamondLines,
          points: [{ idx: ciUp, price: resPrice, label: "다이아돌파" }]
        });
      } else if (ciDn != null) {
        out.push({
          pattern: "diamond_bottom",
          dir: -1,
          confirm_idx: ciDn,
          neckline: supPrice,
          lines: diamondLines,
          points: [{ idx: ciDn, price: supPrice, label: "다이아이탈" }]
        });
      }
    }
  }
  return out;
}

function detectRoundingBottom(rows) {
  const out = [];
  const n = rows.length;
  const WIN = 40;
  if (n < WIN + 10) return out;

  for (let k = WIN; k < n; k += 5) {
    const slice = rows.slice(k - WIN, k);
    const xs = Array.from({ length: WIN }, (_, i) => i);
    const ys = slice.map((r) => r.l);

    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;
    for (let i = 0; i < WIN; i += 1) {
      const x = xs[i];
      const y = ys[i];
      const x2 = x * x;
      sumX += x;
      sumX2 += x2;
      sumX3 += x2 * x;
      sumX4 += x2 * x2;
      sumY += y;
      sumXY += x * y;
      sumX2Y += x2 * y;
    }
    
    const S = WIN;
    const det = S*(sumX2*sumX4 - sumX3*sumX3) - sumX*(sumX*sumX4 - sumX2*sumX3) + sumX2*(sumX*sumX3 - sumX2*sumX2);
    if (Math.abs(det) < 1e-5) continue;

    // 2차 회귀 y = c0 + c1·x + c2·x² 의 크래머 공식. 예전 코드는 detA(1열 치환 = 절편
    // c0 ≈ 주가 수준)를 곡률로 착각해 'a > 0.005' 가 사실상 항상 참이었고, 축 위치
    // axis = -b/(2a) 도 절편으로 나눠 무의미했다. 곡률은 x² 계수(c2 = 3열 치환)다.
    const detB = S*(sumXY*sumX4 - sumX2Y*sumX3) - sumY*(sumX*sumX4 - sumX2*sumX3) + sumX2*(sumX*sumX2Y - sumXY*sumX2);
    const c1 = detB / det;
    const detC = S*(sumX2*sumX2Y - sumXY*sumX3) - sumX*(sumX*sumX2Y - sumXY*sumX2) + sumY*(sumX*sumX3 - sumX2*sumX2);
    const c2 = detC / det;
    if (!(c2 > 0)) continue; // 위로 볼록(천장)이나 직선이면 바닥형이 아니다
    const axis = -c1 / (2 * c2);

    // 곡률 c2 는 절대 가격 단위라 고정 임계값은 가격대에 따라 감도가 뒤틀린다.
    // 평균가로 정규화해 $50 종목 기준(0.005/50 = 1e-4)의 감도를 모든 가격대에
    // 동일하게 적용한다(파이썬 포팅본과 반드시 동일하게 유지).
    const meanPrice = sumY / S;
    if (meanPrice > 0 && c2 / meanPrice > 1e-4 && axis > WIN * 0.35 && axis < WIN * 0.65) {
      const startPrice = ys[0];
      const endPrice = ys[WIN - 1];
      const cupLip = Math.max(startPrice, endPrice);

      const ci = confirmBreak(rows, k - 1, cupLip, +1, null, 0); // 창 끝 봉은 완성된 봉 — 피벗 지연 없음
      if (ci != null && ci >= k) {
        const pts = [];
        for (let i = 0; i < WIN; i += 10) {
          const originalIdx = k - WIN + i;
          pts.push({ idx: originalIdx, price: ys[i] });
        }
        pts.push({ idx: k, price: ys[WIN - 1] });

        out.push({
          pattern: "rounding_bottom",
          dir: +1,
          confirm_idx: ci,
          neckline: cupLip,
          lines: [{ pts }],
          points: [{ idx: ci, price: cupLip, label: "라운딩돌파" }]
        });
      }
    }
  }
  return out;
}

function detectComplexHns(rows, z) {
  const out = [];
  for (let i = 0; i < z.length - 6; i += 1) {
    const p = z.slice(i, i + 7);
    const types = p.map((x) => x.type).join("");
    
    if (types === "HLHLHLH") {
      const [ls1, b1, head, b2, rs1, b3, rs2] = p;
      if (head.price > ls1.price && head.price > rs1.price && head.price > rs2.price) {
        const neck = Math.min(b1.price, b2.price, b3.price);
        const ci = confirmBreak(rows, rs2.idx, neck, -1, head.price);
        if (ci != null) {
          out.push({
            pattern: "complex_hns",
            dir: -1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: ls1.idx, price: ls1.price, label: "좌어깨" },
              { idx: head.idx, price: head.price, label: "머리" },
              { idx: rs1.idx, price: rs1.price, label: "우어깨1" },
              { idx: rs2.idx, price: rs2.price, label: "우어깨2" }
            ],
            necklinePts: [{ idx: b1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }

    if (types === "LHLHLHL") {
      const [ls1, t1, head, t2, rs1, t3, rs2] = p;
      if (head.price < ls1.price && head.price < rs1.price && head.price < rs2.price) {
        const neck = Math.max(t1.price, t2.price, t3.price);
        const ci = confirmBreak(rows, rs2.idx, neck, +1, head.price);
        if (ci != null) {
          out.push({
            pattern: "complex_hns",
            dir: +1,
            confirm_idx: ci,
            neckline: neck,
            points: [
              { idx: ls1.idx, price: ls1.price, label: "역좌어깨" },
              { idx: head.idx, price: head.price, label: "역머리" },
              { idx: rs1.idx, price: rs1.price, label: "역우어깨1" },
              { idx: rs2.idx, price: rs2.price, label: "역우어깨2" }
            ],
            necklinePts: [{ idx: t1.idx, price: neck }, { idx: ci, price: neck }]
          });
        }
      }
    }
  }
  return out;
}

// 전 이력 패턴 스캔은 비싸다. 한 번의 분석에서 같은 rows 배열로 여러 번 불리므로
// (현재 패턴 → 패턴 카드별 종목 실측 → 돌파 셋업), 배열 객체 기준으로 메모이즈한다.
// rows 는 analyzeRows 가 매 실행마다 새로 만드는 배열이라 오래된 캐시가 남지 않는다.
const _confirmationsCache = new WeakMap();

function detectConfirmations(rows) {
  if (rows.length < PAT.PIVOT_WIN * 2 + 5 || isSyntheticRows(rows)) return [];
  const cached = _confirmationsCache.get(rows);
  if (cached && cached.n === rows.length) return cached.events;
  const pivots = findPivots(rows);
  const z = zigzagPivots(pivots);
  let events = [];
  events = events.concat(
    detectDouble(rows, z),
    detectHns(rows, z),
    detectTriangle(rows, z),
    detectSrBreakout(rows, pivots),
    detectWedge(rows, z),
    detectBox(rows, z),
    detectFlag(rows, z),
    detectTriple(rows, z),
    detectBroadening(rows, z),
    detectDiamond(rows, z),
    detectRoundingBottom(rows),
    detectComplexHns(rows, z),
    ...(window.MirPatternExt ? window.MirPatternExt.detectAll(rows, z, pivots, { confirmBreak, slopePctPts, PAT }) : [])
  );
  const seen = new Set();
  const uniq = [];
  events.sort((a, b) => a.confirm_idx - b.confirm_idx);
  for (const e of events) {
    const key = `${e.pattern}@${e.confirm_idx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(e);
  }
  _confirmationsCache.set(rows, { n: rows.length, events: uniq });
  return uniq;
}

function detectCurrentPatterns(rows) {
  const n = rows.length;
  const evs = detectConfirmations(rows).filter((e) => n - 1 - e.confirm_idx < PAT.RECENT_WINDOW);
  evs.sort((a, b) => b.confirm_idx - a.confirm_idx);
  return evs;
}

// ===== 배당 포함 총수익 헬퍼 =====
// detail.dividends([["YYYY-MM-DD", amount], ...])가 있으면 실측 전방 수익률을
// (미래 종가 + 구간 배당합) / 현재 종가 - 1 로 계산한다(총수익 기준, 파이썬
// pattern_lib.total_fwd_return 과 동일). 차트 표시·패턴 감지는 원시 가격 그대로.
// 배당 데이터가 없는 종목은 기존과 완전히 동일하게 동작한다.
const _divCumCache = new WeakMap();

function buildDividendCum(rows, dividends) {
  if (!Array.isArray(dividends) || !dividends.length) return null;
  const divs = [];
  for (const entry of dividends) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const date = String(entry[0] || "");
    const amount = Number(entry[1]);
    if (date && Number.isFinite(amount) && amount > 0) divs.push([date, amount]);
  }
  if (!divs.length) return null;
  divs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const cum = new Array(rows.length);
  let total = 0;
  let di = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const d = rows[i].d;
    if (d) {
      while (di < divs.length && divs[di][0] <= d) {
        total += divs[di][1];
        di += 1;
      }
    }
    cum[i] = total;
  }
  return cum;
}

function fwdReturnTotal(rows, i, j) {
  const c0 = rows[i].c;
  if (!c0) return null;
  let cj = rows[j].c;
  const cum = _divCumCache.get(rows);
  if (cum) cj += cum[j] - cum[i];
  return (cj - c0) / c0;
}

function analyzeIndividualPatternPerformance(cleanRows, patternName, horizon) {
  const n = cleanRows.length;
  const allEvents = detectConfirmations(cleanRows);
  const matchedEvents = allEvents.filter((e) => e.pattern === patternName);

  let totalCount = 0;
  let upCount = 0;
  let returnsSum = 0;

  for (const ev of matchedEvents) {
    const idx = ev.confirm_idx;
    if (idx + horizon < n) {
      const ret = fwdReturnTotal(cleanRows, idx, idx + horizon);
      if (ret == null) continue;
      totalCount += 1;
      if (ret > 0) upCount += 1;
      returnsSum += ret;
    }
  }

  if (totalCount === 0) return null;
  return {
    n: totalCount,
    up_rate: (upCount / totalCount) * 100,
    avg_ret: (returnsSum / totalCount) * 100
  };
}

// 패턴 목표가(Measured Move) — 넥라인 ± 패턴 높이
function computeMeasuredMove(rows, ev) {
  if (!ev || ev.neckline == null) return null;
  const pts = ev.points || [];
  if (!pts.length) return { target: ev.neckline, note: "넥라인 기준" };
  const prices = pts.map((p) => p.price).filter((x) => Number.isFinite(x));
  if (!prices.length) return null;
  const extreme = ev.dir > 0 ? Math.min(...prices) : Math.max(...prices);
  const height = Math.abs(ev.neckline - extreme);
  const target = ev.dir > 0 ? ev.neckline + height : ev.neckline - height;
  return { target, height, extreme, note: "넥라인 ± 패턴 높이" };
}

// 확정 후 넥라인 재이탈 = 패턴 실패
function checkPatternFailure(rows, ev, win = 15) {
  if (!ev || ev.neckline == null) return false;
  const n = rows.length;
  const start = ev.confirm_idx + 1;
  const end = Math.min(n, start + win);
  for (let k = start; k < end; k += 1) {
    const c = rows[k].c;
    if (ev.dir > 0 && c < ev.neckline) return true;
    if (ev.dir < 0 && c > ev.neckline) return true;
  }
  return false;
}

// 동시에 감지된 패턴 방향 일치도
function computeConfluence(cards) {
  if (!cards || !cards.length) return { score: 0, bull: 0, bear: 0, label: "패턴 없음" };
  let bull = 0, bear = 0;
  for (const c of cards) {
    const w = c.stat && c.stat.n >= 100 ? 1.2 : 1;
    if (c.nominalDir > 0) bull += w;
    else if (c.nominalDir < 0) bear += w;
  }
  const total = bull + bear;
  const score = total ? Math.round((Math.max(bull, bear) / total) * 100) : 0;
  let label = "혼조";
  if (score >= 75 && bull > bear) label = "강한 상승 중첩";
  else if (score >= 75 && bear > bull) label = "강한 하락 중첩";
  else if (score >= 55) label = bull >= bear ? "약한 상승 중첩" : "약한 하락 중첩";
  return { score, bull, bear, label };
}

// 캔들 계열 패턴 — 신호 합의에서는 buildSignals 의 '캔들' family(detectCandlePatterns)가
// 이미 한 표를 던지므로 여기서는 카드로만 보여 주고 신호로는 넣지 않는다(이중 계상 방지).
const CANDLE_PATTERN_KEYS = new Set([
  "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "morning_star",
  "evening_star", "three_white_soldiers", "three_black_crows", "piercing_line", "dark_cloud_cover",
]);
// 패턴 신호 채택 기준: 표본이 얇거나(n<200) 기준선 대비 우위(edge)가 1%p 미만이면
// 노이즈라 신호를 내지 않는다. 방향 크기는 원시 상승률이 아니라 기준선 대비 edge 로.
const PATTERN_SIGNAL_MIN_N = 200;
const PATTERN_SIGNAL_MIN_EDGE = 1.0;

// 감지된 현재 패턴 + 과거 통계 → 신호 + 카드 정보
function patternSignals(rows, horizon, stats, opts) {
  opts = opts || {};
  const result = { signals: [], cards: [] };
  if (!stats || !stats.patterns) return result;
  const cur = detectCurrentPatterns(rows);
  const hKey = String(horizon);
  for (const ev of cur) {
    const pstat = stats.patterns[ev.pattern];
    if (!pstat || !pstat[hKey]) continue;
    const s = pstat[hKey];
    const barsAgo = rows.length - 1 - ev.confirm_idx;
    const edge = Number.isFinite(s.edge) ? s.edge : null;
    const eligible = !CANDLE_PATTERN_KEYS.has(ev.pattern)
      && edge != null && Math.abs(edge) >= PATTERN_SIGNAL_MIN_EDGE
      && (s.n || 0) >= PATTERN_SIGNAL_MIN_N;
    if (eligible) {
      const dir = Math.max(-1, Math.min(1, edge / 8));
      result.signals.push({
        label: `패턴: ${PATTERN_LABELS[ev.pattern] || ev.pattern}`,
        dir,
        weight: 1.0,
        detail: `과거 ${s.n.toLocaleString()}건 · 시장 대비 ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%p (${barsAgo === 0 ? "오늘" : barsAgo + "봉 전"} 확정)`,
      });
    }
    const indyStat = analyzeIndividualPatternPerformance(rows, ev.pattern, horizon);
    const useIndy = opts.statsMode === "individual" && indyStat;
    const displayStat = useIndy ? { ...indyStat, edge: s.edge, n: indyStat.n, _source: "individual" } : { ...s, _source: "population" };
    // 레짐 조건부 통계 — 빌더가 벤치마크(SPY/KODEX 200) 종가 vs 200일 SMA 로 이벤트를
    // 분류해 regimes.{above200|below200} 에 같은 스키마로 담고, 빌드 시점의
    // currentRegime 을 함께 준다. 표본이 얇으면(n<30) 노이즈라 숨긴다.
    const regimeBlock = stats.currentRegime && stats.regimes && stats.regimes[stats.currentRegime];
    const regimePat = regimeBlock && regimeBlock.patterns && regimeBlock.patterns[ev.pattern];
    const regimeRaw = regimePat && regimePat[hKey];
    const regimeStat = regimeRaw && regimeRaw.n >= 30 ? regimeRaw : null;
    result.cards.push({
      regimeStat,
      regimeKey: regimeStat ? stats.currentRegime : null,
      pattern: ev.pattern,
      label: PATTERN_LABELS[ev.pattern] || ev.pattern,
      nominalDir: ev.dir,
      barsAgo,
      stat: displayStat,
      popStat: s,
      indyStat,
      baseline: stats.baseline ? stats.baseline[hKey] : null,
      measuredMove: computeMeasuredMove(rows, ev),
      failed: checkPatternFailure(rows, ev),
      event: ev,
    });
  }
  result.confluence = computeConfluence(result.cards);
  return result;
}

// ===== 돌파 연속성 / 되돌림 셋업 (build_breakout_retest.py 로 검증한 엣지) =====
// 검증 결과: 상승 돌파는 약한 추세 지속 우위(+1~2%p), 하락 돌파는 오히려 반등 경향.
// 되돌림(retest)은 상승 돌파의 단기 진입 타이밍에 도움. → 표시용 카드(중복 신호 방지).
function detectBreakoutRetest(rows, horizon, stats) {
  if (!stats || !stats.directions) return null;
  const n = rows.length;
  const WIN = 20; // 최근 N봉 내 돌파만 '현재 셋업'으로 본다
  const evs = detectConfirmations(rows)
    .filter((e) => e.pattern === "resistance_breakout" || e.pattern === "support_breakdown")
    .filter((e) => n - 1 - e.confirm_idx <= WIN)
    .sort((a, b) => b.confirm_idx - a.confirm_idx);
  if (!evs.length) return null;
  const recent = evs[0];
  const price = rows[n - 1].c;
  const atr = windowAtr(rows);
  const barsSince = n - 1 - recent.confirm_idx;
  const isRetest = barsSince >= 1 && Math.abs(price - recent.neckline) <= atr; // 돌파선 재접촉
  const dirKey = recent.dir > 0 ? "up_break" : "down_break";
  const entry = isRetest ? "retest" : "breakout";
  const dd = stats.directions[dirKey];
  const s = dd && dd.entries && dd.entries[entry] && dd.entries[entry][String(horizon)];
  if (!s) return null;
  return { dir: recent.dir, isRetest, barsSince, neckline: recent.neckline, stat: s };
}

// ===== 신호 합의 (Signal Consensus) =====
// 각 신호: { label, dir(-1..+1), weight, detail }
function buildSignals(rows) {
  const n = rows.length;
  const closes = rows.map((r) => r.c);
  const price = closes[n - 1];
  const signals = [];

  const sma20 = smaArray(closes, 20);
  const sma60 = smaArray(closes, 60);
  const sma120 = smaArray(closes, 120);
  const last = (arr) => arr[arr.length - 1];

  // 1. 이평선 배열 (정배열/역배열)
  {
    let score = 0;
    let parts = 0;
    if (last(sma20) != null) { score += price > last(sma20) ? 1 : -1; parts += 1; }
    if (last(sma20) != null && last(sma60) != null) { score += last(sma20) > last(sma60) ? 1 : -1; parts += 1; }
    if (last(sma60) != null && last(sma120) != null) { score += last(sma60) > last(sma120) ? 1 : -1; parts += 1; }
    const dir = parts ? score / parts : 0;
    signals.push({
      label: "이동평균선 배열",
      dir,
      weight: 1.4,
      detail: dir > 0.5 ? "정배열(상승 추세)" : dir < -0.5 ? "역배열(하락 추세)" : "혼조",
    });
  }

  // 2. 20일선 기울기 (추세 방향)
  {
    const sp = slopePct(closes, 20);
    const dir = Math.max(-1, Math.min(1, sp / 0.5)); // 일 0.5%면 강한 추세로 본다
    signals.push({
      label: "단기 추세 기울기",
      dir,
      weight: 1.0,
      detail: `20일 기준 일평균 ${sp >= 0 ? "+" : ""}${sp.toFixed(2)}%`,
    });
  }

  // 3. MACD 히스토그램
  {
    const { hist } = macdSeries(closes);
    const h = last(hist);
    const hPrev = hist[hist.length - 2];
    let dir = 0;
    let detail = "중립";
    if (h != null) {
      dir = Math.max(-1, Math.min(1, h / (price * 0.01))); // 가격 1% 규모로 정규화
      if (h > 0 && hPrev != null && hPrev <= 0) detail = "골든크로스 직후(강세 전환)";
      else if (h < 0 && hPrev != null && hPrev >= 0) detail = "데드크로스 직후(약세 전환)";
      else detail = h > 0 ? "0선 위(강세)" : "0선 아래(약세)";
    }
    signals.push({ label: "MACD", dir, weight: 1.1, detail });
  }

  // 4. RSI(14)
  {
    const rsi = last(rsiSeries(closes, 14));
    let dir = 0;
    let detail = "중립";
    // state 는 브리핑 문구용 명시 상태. 예전엔 dir<-0.4 를 '과매수' 로 읽어 RSI 31~46
    // (하락 우위)에도 "과매수 구간 진입" 이 찍혔다.
    let state = "neutral";
    if (rsi != null) {
      if (rsi >= 70) { dir = -0.5; state = "overbought"; detail = `과매수 ${rsi.toFixed(0)} (단기 부담)`; }
      else if (rsi <= 30) { dir = 0.6; state = "oversold"; detail = `과매도 ${rsi.toFixed(0)} (반등 기대)`; }
      else if (rsi >= 55) { dir = 0.5; state = "bullish"; detail = `${rsi.toFixed(0)} (상승 우위)`; }
      else if (rsi <= 45) { dir = -0.5; state = "bearish"; detail = `${rsi.toFixed(0)} (하락 우위)`; }
      else { dir = (rsi - 50) / 10; detail = `${rsi.toFixed(0)} (중립권)`; }
    }
    signals.push({ label: "RSI(14)", dir, weight: 1.0, detail, state, value: rsi });
  }

  // 5. 스토캐스틱
  {
    const { k, d } = stochArrays(rows, 14, 3);
    const kv = last(k);
    const dv = last(d);
    let dir = 0;
    let detail = "중립";
    if (kv != null && dv != null) {
      if (kv < 20) { dir = 0.4; detail = `과매도권 (K ${kv.toFixed(0)})`; }
      else if (kv > 80) { dir = -0.4; detail = `과매수권 (K ${kv.toFixed(0)})`; }
      else { dir = kv > dv ? 0.3 : -0.3; detail = `K ${kv.toFixed(0)} ${kv > dv ? ">" : "<"} D ${dv.toFixed(0)}`; }
    }
    signals.push({ label: "스토캐스틱", dir, weight: 0.7, detail });
  }

  // 6. 거래량 (OBV 20일 변화를 평균 거래량으로 정규화)
  {
    const obv = obvArray(rows);
    const win = 20;
    const recentVol = rows.slice(-win).reduce((a, r) => a + (r.v || 0), 0) / win || 1;
    const change = obv[n - 1] - (obv[n - 1 - win] ?? obv[0]);
    // 20일간 순매집 거래량이 평균 일거래량의 몇 배인지 → 방향/강도
    const ratio = change / (recentVol * win);
    const dir = Math.max(-1, Math.min(1, ratio * 2));
    signals.push({
      label: "거래량 흐름(OBV)",
      dir,
      weight: 0.8,
      detail: ratio > 0.05 ? "매집 우위(자금 유입)" : ratio < -0.05 ? "분산 우위(자금 유출)" : "중립",
    });
  }

  // 7. 볼린저 %B (밴드 내 위치)
  {
    const bb = bollinger(closes, 20, 2);
    const pb = last(bb.pctB);
    let dir = 0;
    let detail = "중립";
    if (pb != null) {
      if (pb > 1) { dir = -0.3; detail = "상단 돌파(과열 가능)"; }
      else if (pb < 0) { dir = 0.4; detail = "하단 이탈(반등 가능)"; }
      else { dir = (pb - 0.5) * 1.0; detail = `밴드 내 ${(pb * 100).toFixed(0)}% 위치`; }
    }
    signals.push({ label: "볼린저 밴드", dir, weight: 0.6, detail });
  }

  // 8. 모멘텀 (20일 ROC)
  {
    const roc = last(rocArray(closes, 20));
    let dir = 0;
    if (roc != null) dir = Math.max(-1, Math.min(1, roc / 10));
    signals.push({
      label: "모멘텀(20일)",
      dir,
      weight: 0.9,
      detail: roc != null ? `20일 수익률 ${roc >= 0 ? "+" : ""}${roc.toFixed(1)}%` : "데이터 부족",
    });
  }

  // 9. 52주 고저 위치
  {
    const win = closes.slice(-252);
    const hi = Math.max(...win);
    const lo = Math.min(...win);
    const pos = hi === lo ? 0.5 : (price - lo) / (hi - lo);
    const distHigh = ((hi - price) / price) * 100;
    let dir;
    if (pos > 0.9) dir = 0.5; // 신고가 근처 = 강한 종목
    else if (pos < 0.1) dir = -0.3;
    else dir = (pos - 0.5) * 0.8;
    signals.push({
      label: "52주 위치",
      dir,
      weight: 0.7,
      detail: `고점 대비 -${distHigh.toFixed(1)}% · 1년 범위 ${(pos * 100).toFixed(0)}%`,
    });
  }

  // 10. 캔들 패턴
  {
    const pats = detectCandlePatterns(rows);
    if (pats.length) {
      for (const p of pats) {
        signals.push({ label: `캔들: ${p.name}`, dir: p.dir, weight: p.weight, detail: "최근 봉 패턴" });
      }
    }
  }

  // 11. VWAP (최근 20일 거래량가중평균 대비 위치 — 괴리율로 강도 조절)
  {
    const vwap = last(rollingVwap(rows, 20));
    if (vwap != null && vwap > 0) {
      const gap = (price - vwap) / vwap;
      const dir = Math.max(-1, Math.min(1, gap / 0.05)) * 0.9; // ±5% 괴리에서 포화
      signals.push({
        label: "VWAP",
        dir,
        weight: 0.85,
        detail: `20일 VWAP(${fmtPrice(vwap)}) 대비 ${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(1)}%`,
      });
    }
  }

  // 12. Supertrend
  {
    const st = supertrendState(rows);
    if (st.line != null) {
      signals.push({
        label: "Supertrend",
        dir: st.bullish ? 0.7 : -0.7,
        weight: 1.0,
        detail: st.bullish ? `강세 추세 (${fmtPrice(st.line)})` : `약세 추세 (${fmtPrice(st.line)})`,
      });
    }
  }

  // 13. Ichimoku
  {
    const ichi = ichimokuArrays(rows);
    const t = last(ichi.tenkan);
    const k = last(ichi.kijun);
    const sa = last(ichi.spanA);
    const sb = last(ichi.spanB);
    let dir = 0;
    let detail = "중립";
    if (t != null && k != null) {
      if (t > k && price > Math.max(sa || 0, sb || 0)) { dir = 0.65; detail = "전환>기준선 + 구름 위"; }
      else if (t < k && price < Math.min(sa || Infinity, sb || Infinity)) { dir = -0.65; detail = "전환<기준선 + 구름 아래"; }
      else if (t > k) { dir = 0.35; detail = "전환선 > 기준선"; }
      else if (t < k) { dir = -0.35; detail = "전환선 < 기준선"; }
    }
    signals.push({ label: "Ichimoku", dir, weight: 0.95, detail });
  }

  // 14. 골든/데드크로스 (SMA20 × SMA60)
  {
    const s20 = sma20[n - 1];
    const s60 = sma60[n - 1];
    const s20p = sma20[n - 2];
    const s60p = sma60[n - 2];
    if (s20 != null && s60 != null) {
      let dir = s20 > s60 ? 0.5 : -0.5;
      let detail = s20 > s60 ? "SMA20 > SMA60" : "SMA20 < SMA60";
      if (s20p != null && s60p != null) {
        if (s20p <= s60p && s20 > s60) { dir = 0.75; detail = "골든크로스 직후"; }
        if (s20p >= s60p && s20 < s60) { dir = -0.75; detail = "데드크로스 직후"; }
      }
      signals.push({ label: "골든/데드크로스", dir, weight: 1.15, detail });
    }
  }

  // 15. +DI / -DI
  {
    const { plusDi, minusDi } = adxArrays(rows, 14);
    const pdi = last(plusDi);
    const mdi = last(minusDi);
    if (pdi != null && mdi != null) {
      const dir = Math.max(-1, Math.min(1, (pdi - mdi) / 25));
      signals.push({
        label: "+DI/-DI",
        dir,
        weight: 0.75,
        detail: `+DI ${pdi.toFixed(0)} / -DI ${mdi.toFixed(0)}`,
      });
    }
  }

  // 16. Williams %R
  {
    const w = last(williamsArray(rows, 14));
    if (w != null) {
      let dir = 0;
      let detail = `${w.toFixed(0)}`;
      if (w > -20) { dir = -0.4; detail += " (과매수)"; }
      else if (w < -80) { dir = 0.45; detail += " (과매도)"; }
      else dir = (w + 50) / 50;
      signals.push({ label: "Williams %R", dir, weight: 0.55, detail });
    }
  }

  // 17. CCI
  {
    const cci = last(cciArray(rows, 20));
    if (cci != null) {
      let dir = Math.max(-1, Math.min(1, cci / 150));
      let detail = cci.toFixed(0);
      if (cci > 100) detail += " (강세)";
      else if (cci < -100) detail += " (약세)";
      signals.push({ label: "CCI", dir, weight: 0.55, detail });
    }
  }

  // 18. TTM Squeeze
  {
    const sq = ttmSqueezeState(rows);
    let dir = 0;
    // 기본(수축도 해제도 아님)은 '스퀴즈 없음'. 예전 기본값 "수축 해제" 는 브리핑이
    // '해제' 문자열로 판정해 스퀴즈가 없던 종목 전부에 "변동성 확대 국면" 을 붙였다.
    let detail = sq.squeezed ? "수축 중 (변동성 폭발 대기)" : "스퀴즈 없음";
    if (sq.fired) {
      const mom = last(rocArray(closes, 12));
      dir = mom != null && mom > 0 ? 0.55 : mom != null && mom < 0 ? -0.55 : 0;
      detail = "스퀴즈 해제 + 모멘텀 " + (mom >= 0 ? "상승" : "하락");
    } else if (sq.squeezed) dir = 0.1;
    signals.push({ label: "TTM Squeeze", dir, weight: sq.fired ? 1.0 : 0.5, detail, fired: !!sq.fired, squeezed: !!sq.squeezed });
  }

  // 19. CMF / MFI
  {
    const cmf = last(cmfArray(rows, 20));
    if (cmf != null) {
      const dir = Math.max(-1, Math.min(1, cmf * 5));
      signals.push({
        label: "CMF(수급)",
        dir,
        weight: 0.8,
        detail: cmf > 0.05 ? "자금 유입" : cmf < -0.05 ? "자금 유출" : `중립 (${cmf.toFixed(2)})`,
      });
    }
    const mfi = last(mfiArray(rows, 14));
    if (mfi != null) {
      let dir = 0;
      let detail = mfi.toFixed(0);
      if (mfi < 20) { dir = 0.4; detail += " (과매도)"; }
      else if (mfi > 80) { dir = -0.4; detail += " (과매수)"; }
      else dir = (mfi - 50) / 50;
      signals.push({ label: "MFI", dir, weight: 0.7, detail });
    }
  }

  // 20. Parabolic SAR
  {
    const ps = parabolicSarArray(rows);
    if (ps.values[n - 1] != null) {
      signals.push({
        label: "Parabolic SAR",
        dir: ps.bullish ? 0.5 : -0.5,
        weight: 0.65,
        detail: ps.bullish ? "SAR 아래 (상승 추세)" : "SAR 위 (하락 추세)",
      });
    }
  }

  // 21. 선형회귀 채널
  {
    const lr = linearRegressionChannel(rows);
    if (lr) {
      let dir = 0;
      let detail = "채널 중간";
      if (price > lr.upper) { dir = -0.35; detail = "상단 밴드 돌파(과열)"; }
      else if (price < lr.lower) { dir = 0.4; detail = "하단 밴드 이탈(반등 가능)"; }
      else dir = (price - lr.mid) / (lr.std || 1) * 0.3;
      signals.push({ label: "선형회귀 채널", dir, weight: 0.6, detail });
    }
  }

  // 22. 피벗 포인트
  {
    const pv = floorTraderPivots(rows);
    if (pv) {
      let dir = 0;
      let detail = `피벗 ${fmtPrice(pv.pivot)}`;
      if (price > pv.r1) { dir = 0.45; detail = `R1(${fmtPrice(pv.r1)}) 돌파`; }
      else if (price < pv.s1) { dir = -0.45; detail = `S1(${fmtPrice(pv.s1)}) 이탈`; }
      else if (price > pv.pivot) { dir = 0.2; detail += " 위"; }
      else { dir = -0.2; detail += " 아래"; }
      signals.push({ label: "피벗 포인트", dir, weight: 0.55, detail });
    }
  }

  // ADX는 방향이 아니라 "추세 강도" → 신뢰도 가중치로 별도 반환
  const { adx } = adxArrays(rows, 14);
  const adxVal = last(adx);

  return { signals, adxVal };
}

// 신호 → 상관 그룹(family). 같은 현상을 측정하는 신호들(추세 9종, 오실레이터 6종 등)을
// 독립 투표처럼 합산하면 다중공선성으로 특정 family가 과대 반영된다. 그래서 family별로
// 먼저 묶어 평균하고, family를 한 단위로만 종합한다.
const SIGNAL_GROUPS = {
  "이동평균선 배열": "trend", "단기 추세 기울기": "trend", "MACD": "trend",
  "Supertrend": "trend", "Ichimoku": "trend", "골든/데드크로스": "trend",
  "+DI/-DI": "trend", "Parabolic SAR": "trend", "VWAP": "trend",
  "모멘텀(20일)": "momentum", "52주 위치": "momentum",
  "RSI(14)": "oscillator", "스토캐스틱": "oscillator", "볼린저 밴드": "oscillator",
  "Williams %R": "oscillator", "CCI": "oscillator", "MFI": "oscillator",
  "거래량 흐름(OBV)": "volume", "CMF(수급)": "volume",
  "TTM Squeeze": "volatility", "선형회귀 채널": "level", "피벗 포인트": "level",
};
// family별 종합 가중치(한 family = 증거 한 덩어리). solo 그룹은 개별 신호 가중치를 그대로 쓴다.
const GROUP_WEIGHT = {
  trend: 2.0, momentum: 1.0, oscillator: 1.3, volume: 1.0, volatility: 0.7, level: 0.7,
  candle: 0.7, pattern: 1.4,
};
function signalGroup(s) {
  if (s.group) return s.group;
  if (SIGNAL_GROUPS[s.label]) return SIGNAL_GROUPS[s.label];
  if (typeof s.label === "string") {
    if (s.label.startsWith("캔들")) return "candle";
    if (s.label.startsWith("패턴")) return "pattern";
  }
  return "solo:" + (s.label || ""); // 그 외(다중 타임프레임·공매도 등)는 단독으로 1표
}

// family별로 dir을 평균한 뒤, family 단위로 가중 종합 → 상승 확률(%). ADX로 진폭 조절.
function consensusProbability(signals, adxVal) {
  const groups = new Map();
  for (const s of signals) {
    const g = signalGroup(s);
    if (!groups.has(g)) groups.set(g, { wsum: 0, wtot: 0 });
    const e = groups.get(g);
    e.wsum += s.dir * s.weight;
    e.wtot += s.weight;
  }
  let wsum = 0;
  let wtot = 0;
  for (const [g, e] of groups) {
    if (!e.wtot) continue;
    const dir = e.wsum / e.wtot;                      // family 내부 평균 방향
    const gw = g.startsWith("solo:") ? e.wtot : (GROUP_WEIGHT[g] || e.wtot);
    wsum += dir * gw;
    wtot += gw;
  }
  const net = wtot ? wsum / wtot : 0; // -1..+1
  // 추세가 강할수록(ADX 높음) 신호를 더 신뢰 → 진폭 확대 (0.6~1.0배)
  const conf = adxVal == null ? 0.75 : Math.max(0.6, Math.min(1.0, 0.6 + (adxVal - 15) / 100));
  const scaled = net * conf;
  // 선형 매핑, 12~88%로 클램프(과신 방지). family 종합으로 희석이 줄어 진폭을 약간 키움.
  let prob = 50 + scaled * 42;
  prob = Math.max(12, Math.min(88, prob));
  return { up: prob, net, conf };
}

// ===== 과거 유사 상황 실측 (Backtest Base-Rate) =====
// 각 과거 시점의 상태 벡터를 만들고, 현재와 가까운 날들의 H일 뒤 결과를 집계.
function backtestBaseRate(rows, horizon) {
  const n = rows.length;
  const closes = rows.map((r) => r.c);
  const rsi = rsiSeries(closes, 14);
  const sma20 = smaArray(closes, 20);
  const sma60 = smaArray(closes, 60);
  const bb = bollinger(closes, 20, 2);
  const roc = rocArray(closes, 20);

  // 상태 벡터: 모든 특징을 ~[-1,1]로 표준화(축별 스케일을 맞춰 거리 왜곡 방지).
  // [RSI, 가격-SMA20 괴리, SMA20-SMA60 괴리, %B, ROC]
  function stateAt(i) {
    if (rsi[i] == null || sma20[i] == null || sma60[i] == null || bb.pctB[i] == null || roc[i] == null) return null;
    return [
      (rsi[i] - 50) / 50,
      Math.max(-0.3, Math.min(0.3, (closes[i] - sma20[i]) / sma20[i])) / 0.3,
      Math.max(-0.3, Math.min(0.3, (sma20[i] - sma60[i]) / sma60[i])) / 0.3,
      Math.max(-1, Math.min(1, (bb.pctB[i] - 0.5) * 2)),
      Math.max(-1, Math.min(1, roc[i] / 20)),
    ];
  }

  const cur = stateAt(n - 1);
  if (!cur) return null;

  // 과거 후보: forward 결과를 알 수 있는 i (i + horizon < n)
  const cand = [];
  for (let i = 120; i < n - horizon - 1; i += 1) {
    const st = stateAt(i);
    if (!st) continue;
    let dist = 0;
    for (let k = 0; k < cur.length; k += 1) dist += (st[k] - cur[k]) * (st[k] - cur[k]);
    dist = Math.sqrt(dist);
    // 배당 데이터가 있으면 총수익 기준(없으면 기존 가격 수익률과 동일).
    const fwd = fwdReturnTotal(rows, i, i + horizon);
    if (fwd == null) continue;
    cand.push({ dist, fwd, idx: i });
  }
  if (cand.length < 30) return null;

  // 거리순 정렬 후, 서로 horizon 이상 떨어진 이웃만 채택(시간적 독립성 확보).
  // 연속된 날은 상태가 거의 같아 표본수를 부풀리므로, 겹치는 구간은 한 번만 센다.
  cand.sort((a, b) => a.dist - b.dist);
  const gap = Math.max(horizon, 5);
  const target = Math.min(60, Math.max(20, Math.round(cand.length * 0.06)));
  const top = [];
  for (const c of cand) {
    if (top.every((m) => Math.abs(m.idx - c.idx) >= gap)) {
      top.push(c);
      if (top.length >= target) break;
    }
  }
  if (top.length < 12) return null; // 독립 표본이 너무 적으면 신뢰 불가

  let upCount = 0;
  let sumFwd = 0;
  let sumDist = 0;
  let best = -Infinity;
  let worst = Infinity;
  for (const m of top) {
    if (m.fwd > 0) upCount += 1;
    sumFwd += m.fwd;
    sumDist += m.dist;
    best = Math.max(best, m.fwd);
    worst = Math.min(worst, m.fwd);
  }
  const nTop = top.length;
  const ci = wilsonInterval(upCount, nTop);
  // 상태 벡터 5축이 각각 [-1,1] 이므로 최대 거리 = sqrt(20). 평균 거리를 0~1 유사도로 환산.
  const avgDist = sumDist / nTop;
  const similarity = Math.max(0, Math.min(1, 1 - avgDist / Math.sqrt(20)));
  return {
    samples: nTop, // 시간적으로 독립인 유효 표본 수
    upProb: (upCount / nTop) * 100, // 내부 블렌딩용 원시 비율(가중 로직은 그대로)
    // 표시용 라플라스 평활 (wins+1)/(n+2): 표본 12건 12승 같은 극단이 100%로 보이는
    // 과신을 막는다. 화면에는 이 값을 표본 수와 함께 보여준다.
    upProbSmoothed: ((upCount + 1) / (nTop + 2)) * 100,
    ciLow: ci.low * 100,   // 윌슨 95% 신뢰구간(표본 수 기준) — 12건이면 ±25%p 가 넘는다
    ciHigh: ci.high * 100,
    avgDist,               // 이웃과의 평균 상태 거리(작을수록 비슷)
    similarity,            // 0~1
    avgReturn: (sumFwd / nTop) * 100,
    best: best * 100,
    worst: worst * 100,
  };
}

// ===== 종합 =====
// 코어: OHLCV 행 배열({o,h,l,c,v,d})을 받아 분석 결과를 만든다.
// app.js(대시보드 차트)는 이미 같은 형식의 행을 갖고 있으므로 이 함수를 직접 부른다.
function analyzeRows(rows, horizon, meta) {
  meta = meta || {};
  const clean = (rows || []).filter((r) => r && Number.isFinite(r.c) && r.c > 0);
  if (clean.length < 60) {
    return { error: "insufficient", bars: clean.length };
  }

  // 배당 이벤트(detail.dividends)가 있으면 실측 수익률(패턴 종목 실측·과거 유사
  // 실측)을 배당 포함 총수익 기준으로 계산한다. 없으면 기존과 동일.
  const divCum = buildDividendCum(clean, meta.dividends);
  if (divCum) _divCumCache.set(clean, divCum);

  const price = clean[clean.length - 1].c;
  const { signals, adxVal } = buildSignals(clean);
  const pat = patternSignals(clean, horizon, patternStats, meta);
  for (const s of pat.signals) signals.push(s);

  const mtf = buildMultiTimeframeContext(clean);
  if (mtf.bias !== 0) {
    signals.push({
      label: "다중 타임프레임",
      dir: mtf.bias,
      weight: 1.2 * mtf.alignment,
      detail: mtf.label,
    });
  }

  const shortData = (!isKrAnalysisMode() && meta.ticker) ? getShortInterest(meta.ticker) : null;
  let shortSqueeze = null;
  if (shortData && shortData.daysToCover != null) {
    const dtc = shortData.daysToCover;
    const bullPat = (pat.confluence && pat.confluence.bull > pat.confluence.bear) || false;
    if (dtc >= 5) {
      const dir = bullPat ? 0.55 : 0.15;
      signals.push({
        label: "공매도(숏)",
        dir,
        weight: Math.min(1.3, 0.5 + dtc / 10),
        detail: `커버 ${dtc.toFixed(1)}일${bullPat ? " + 강세 패턴 (스퀴즈 셋업)" : ""}`,
      });
      if (dtc >= 5 && bullPat) {
        shortSqueeze = { daysToCover: dtc, setup: true, changePct: shortData.changePct };
      }
    } else if (dtc <= 2) {
      signals.push({ label: "공매도(숏)", dir: -0.1, weight: 0.3, detail: `커버 ${dtc.toFixed(1)}일 (낮음)` });
    }
  }

  // 다중 타임프레임은 위에서 이미 가중 신호로 합의에 들어간다. 예전의 ±2.5%p 사후
  // 보정은 같은 정보를 두 번 반영(이중 계상)하는 것이라 제거했다.
  const consensus = consensusProbability(signals, adxVal);

  const base = clean.length >= 250 ? backtestBaseRate(clean, horizon) : null;
  const sr = srSummary(clean);
  const breakout = detectBreakoutRetest(clean, horizon, breakoutStats);
  const techLevels = computeTechnicalLevels(clean, price);
  const gapFill = computeGapFillStats(clean);
  const optionsStats = (!isKrAnalysisMode() && meta.ticker) ? optionsStatsForTicker(meta.ticker) : null;
  const institutionalFlow = (!isKrAnalysisMode() && meta.ticker) ? institutionalFlowForTicker(meta.ticker) : null;

  // 실측(과거 유사 상황) 가중치는 독립 표본 수에 비례 — 표본이 많을수록 신뢰.
  // 60개에서 최대 0.5 가중(과거에는 표본 수와 무관하게 항상 0.5였음).
  let headlineUp;
  if (base && base.samples >= 15) {
    const wBase = Math.max(0, Math.min(0.5, base.samples / 120));
    headlineUp = consensus.up * (1 - wBase) + base.upProb * wBase;
  } else {
    headlineUp = consensus.up;
  }
  headlineUp = Math.max(12, Math.min(88, headlineUp));

  return {
    ticker: meta.ticker,
    company: meta.company,
    bars: clean.length,
    lastDate: clean[clean.length - 1].d,
    price,
    horizon,
    consensus,
    signals,
    adxVal,
    base,
    sr,
    patterns: pat.cards,
    patternConfluence: pat.confluence,
    breakout,
    mtf,
    techLevels,
    shortSqueeze,
    shortData,
    gapFill,
    optionsStats,
    institutionalFlow,
    headlineUp,
    headlineDown: 100 - headlineUp,
  };
}

// detail json(chartSeries 배열) 진입점 — standalone 페이지용.
function analyzeTicker(detail, horizon) {
  const rows = (detail.chartSeries || [])
    .map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }));
  return analyzeRows(rows, horizon, {
    ticker: detail.ticker,
    company: detail.company,
    dividends: detail.dividends, // 있으면 실측 수익률을 배당 포함 총수익으로
  });
}

// ===== UI =====
const HORIZONS = [
  { key: 5, label: "1주 (5거래일)" },
  { key: 20, label: "1개월 (20거래일)" },
  { key: 60, label: "3개월 (60거래일)" },
];
let currentHorizon = 20;
let currentDetail = null;
let patternStats = null; // data/pattern_stats.json (오프라인 집계 결과)
let breakoutStats = null; // data/breakout_retest_stats.json (돌파 연속성/되돌림 통계)

function $(id) { return document.getElementById(id); }

let statsPromise = null;
let statsMarket = null;
function statsBasePath() {
  return (window.MirMarket && window.MirMarket.getMode() === "kr") ? "data/korea" : "data";
}
function resetStatsCacheIfMarketChanged() {
  const mode = (window.MirMarket && window.MirMarket.getMode()) || "us";
  if (statsMarket === mode) return;
  statsMarket = mode;
  statsPromise = null;
  patternStats = null;
  breakoutStats = null;
}

async function loadPatternStats() {
  try {
    const res = await fetch(`${statsBasePath()}/pattern_stats.json`, { cache: "no-cache" });
    if (res.ok) patternStats = await res.json();
  } catch (e) {
    patternStats = null; // 없으면 패턴 섹션만 생략, 나머지 분석은 정상 동작
  }
  return patternStats;
}

async function loadBreakoutStats() {
  // 돌파/되돌림 통계는 US 만 만들어 둔다(build_breakout_retest.py).
  // 없는 걸 알면서 요청하면 콘솔에 404 가 남는데, 그 노이즈가 진짜 404 를 가린다
  // — 실제로 KR 실적 캘린더가 존재하지 않는 파일을 계속 부르던 걸 한동안 놓쳤다.
  // fetch 는 실패해도 아래에서 조용히 넘어가므로 기능상 차이는 없다.
  if (!marketHasBreakoutStats()) { breakoutStats = null; return null; }
  try {
    const res = await fetch(`${statsBasePath()}/breakout_retest_stats.json`, { cache: "no-cache" });
    if (res.ok) breakoutStats = await res.json();
  } catch (e) {
    breakoutStats = null;
  }
  return breakoutStats;
}

function marketHasBreakoutStats() {
  const cfg = window.MirMarket && window.MirMarket.getConfig && window.MirMarket.getConfig();
  return !(cfg && cfg.features && cfg.features.breakoutStats === false);
}

// 통계는 한 번만 받아 캐시한다(대시보드/standalone 공용). 시장 전환 시 경로가 바뀌므로 캐시를 비운다.
function ensureStats() {
  resetStatsCacheIfMarketChanged();
  if (!statsPromise) statsPromise = Promise.all([loadPatternStats(), loadBreakoutStats()]);
  return statsPromise;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function analysisTickerKey(ticker) {
  if (window.MirMarket) return window.MirMarket.getConfig().formatTicker(ticker);
  return String(ticker).trim().toUpperCase();
}

// "엔비디아" → "NVDA". 이 페이지는 입력값을 그대로 대문자로 만들어 <입력>.json 을
// 찾았기 때문에, 한글명으로 검색하면 무조건 "데이터를 찾을 수 없습니다" 가 떴다.
// data/ticker_aliases_ko.js 는 한글명 → '미국' 티커 전용(6자리 KR 코드는 0개)이라
// US 모드에서만 적용한다. 해석 실패 시엔 입력값을 그대로 돌려줘 기존 동작을 유지한다.
function resolveKoAliasToTicker(raw) {
  const text = String(raw || "").trim();
  if (!text) return text;
  if (window.MirMarket && window.MirMarket.getMode() === "kr") return text;
  if (/^[A-Za-z0-9.\-]{1,12}$/.test(text)) return text; // 이미 티커꼴

  const aliases = window.TICKER_ALIASES_KO;
  if (!aliases) return text;
  const lower = text.toLowerCase();
  let best = null;
  for (const [ticker, names] of Object.entries(aliases)) {
    for (const alias of names) {
      const a = String(alias).toLowerCase();
      if (a.length < 2 || !lower.includes(a)) continue;
      if (!best || a.length > best.len) best = { ticker, len: a.length };
    }
  }
  return best ? best.ticker : text;
}

function analysisDetailPath(ticker) {
  const key = analysisTickerKey(ticker);
  if (window.MirMarket) return window.MirMarket.detailPath(key);
  return `data/details/${encodeURIComponent(key)}.json`;
}

async function loadDetail(ticker) {
  const key = analysisTickerKey(ticker);
  if (!key) return null;
  const res = await fetch(analysisDetailPath(key), { cache: "no-cache" });
  if (!res.ok) throw new Error("not_found");
  return res.json();
}

function gaugeColor(up) {
  if (up >= 60) return "var(--pos, #138a4d)";
  if (up <= 40) return "var(--neg, #c03535)";
  return "var(--amber, #b7791f)";
}

function verdictText(up) {
  if (up >= 65) return "상승 우위";
  if (up >= 55) return "약한 상승 우위";
  if (up > 45) return "중립 (방향성 불분명)";
  if (up > 35) return "약한 하락 우위";
  return "하락 우위";
}

function renderPatternCard(result) {
  const cards = result.patterns || [];
  if (!patternStats) return ""; // 통계 파일이 없으면 섹션 생략
  if (!cards.length) {
    return `<div class="card">
      <h3>③ 차트 패턴 <span class="muted">(최근 ${PAT.RECENT_WINDOW}봉)</span></h3>
      <p class="muted">최근 확정된 고전 차트 패턴(쌍바닥·헤드앤숄더·삼각수렴·돌파 등)이 없습니다.</p>
    </div>`;
  }
  const rows = cards.map((c) => {
    const up = c.stat.up_rate;
    const edge = c.stat.edge;
    const dirWord = c.nominalDir > 0 ? "상승형" : c.nominalDir < 0 ? "하락형" : "중립형";
    const edgeStr = edge == null ? "" :
      `<span class="pat-edge ${edge >= 0 ? "pos" : "neg"}">시장 대비 ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%p</span>`;
    const srcLabel = c.stat && c.stat._source === "individual" ? "종목 실측" : "전체 통계";
    const indyStr = c.indyStat && c.stat && c.stat._source === "population" ?
      `<span style="display:block; margin-top:4px; color:var(--muted); font-size:12px;">이 종목 과거 실측: <b>${c.indyStat.n}회</b> 발생 중 <b>${c.indyStat.up_rate.toFixed(0)}%</b> 상승 (평균 <b>${c.indyStat.avg_ret >= 0 ? "+" : ""}${c.indyStat.avg_ret.toFixed(1)}%</b>)</span>` : "";
    const failStr = c.failed ? `<span class="pat-tag" style="background:var(--tint-neg);color:var(--tint-neg-fg);border-color:var(--neg)">패턴 실패</span>` : "";
    const targetStr = c.measuredMove && Number.isFinite(c.measuredMove.target) ?
      `<span style="display:block; margin-top:4px; color:var(--muted); font-size:12px;">목표가 추정: <b>${fmtPrice(c.measuredMove.target)}</b> <span class="muted">(${c.measuredMove.note})</span></span>` : "";
    // 현재 레짐(벤치마크 200일선 상회/하회) 조건부 성공률 — n>=30 일 때만 한 줄.
    const regimeStr = c.regimeStat ?
      `<span style="display:block; margin-top:4px; color:var(--muted); font-size:12px;">현재 레짐(200일선 ${c.regimeKey === "above200" ? "상회" : "하회"}) 기준: 상승확률 <b style="color:${gaugeColor(c.regimeStat.up_rate)}">${c.regimeStat.up_rate.toFixed(0)}%</b> (n=${c.regimeStat.n.toLocaleString()})</span>` : "";
    return `<div class="pat-item">
      <div class="pat-head">
        <span class="pat-name">${escapeHtml(c.label)}</span>
        <span class="pat-tag">${dirWord}</span>
        <span class="pat-tag muted">${srcLabel}</span>
        ${failStr}
        <span class="pat-when muted">${c.barsAgo === 0 ? "오늘 확정" : c.barsAgo + "봉 전 확정"}</span>
      </div>
      <p class="pat-stat">과거 같은 패턴 <b>${c.stat.n.toLocaleString()}건</b> 중
        <b style="color:${gaugeColor(up)}">${up.toFixed(0)}%</b>가 ${result.horizon}거래일 뒤 상승
        · 평균 <b style="color:${c.stat.avg_ret >= 0 ? "var(--pos)" : "var(--neg)"}">${c.stat.avg_ret >= 0 ? "+" : ""}${c.stat.avg_ret.toFixed(1)}%</b>
        ${edgeStr}
        ${regimeStr}
        ${indyStr}
        ${targetStr}
      </p>
    </div>`;
  }).join("");
  return `<div class="card">
    <h3>③ 차트 패턴 <span class="muted">(최근 ${PAT.RECENT_WINDOW}봉 내 확정 · 전 종목 ${(patternStats.events_total || 0).toLocaleString()}건 풀링)</span></h3>
    ${rows}
    <p class="pat-note muted">※ 고전 패턴은 통계적으로 '약한 우위'에 그칩니다. 방향은 교과서 정의가 아니라 <b>과거 실측 상승률</b>로 표시했습니다.</p>
    <p class="pat-note muted">※ 패턴 통계는 현재 상장 중인 종목만으로 집계되어, 상장폐지된 종목이 빠진 생존 편향이 있습니다.</p>
    <p class="pat-note muted">※ 수익률 통계는 배당을 포함한 총수익 기준입니다(배당 데이터가 있는 종목).</p>
  </div>`;
}

// 기술 점수(신호 합의)와 과거 유사 실측의 방향 일치 여부. 둘 다 있고 같은 방향일 때만
// "일관되게" 라고 말할 수 있다. 0 = 중립대(45~55), null = 실측 표본 없음.
function directionBand(value) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 55) return 1;
  if (value <= 45) return -1;
  return 0;
}

function generateBriefing(result) {
  const up = result.headlineUp;
  const price = result.price;
  const signals = result.signals || [];

  const sigDir = directionBand(result.consensus ? result.consensus.up : null);
  const baseUp = result.base ? (result.base.upProbSmoothed != null ? result.base.upProbSmoothed : result.base.upProb) : null;
  const baseDir = directionBand(baseUp);
  const agree = sigDir != null && baseDir != null && sigDir !== 0 && sigDir === baseDir;
  let consistency = "";
  if (baseDir == null) consistency = "과거 유사 상황 표본이 부족해 기술 신호만으로 판단한 결과이며, 실측 검증은 빠져 있습니다.";
  else if (agree) consistency = "기술 신호(기술 점수)와 과거 유사 상황 실측이 일관되게 같은 방향을 가리키고 있습니다.";
  else consistency = `다만 기술 점수(${result.consensus.up.toFixed(0)})와 과거 유사 상황 실측(상승 ${baseUp.toFixed(0)}%)의 방향이 엇갈려, 확신도는 낮게 보아야 합니다.`;

  let opinion = "";
  if (up >= 65) opinion = `종합 분석 결과 <strong>상승 우위 국면</strong>입니다. ${consistency}`;
  else if (up >= 55) opinion = `종합 분석 결과 <strong>약한 상승 우위</strong> 상태입니다. 전반적인 추세는 우상향이나 단기 매물 소화 과정이 관찰됩니다. ${consistency}`;
  else if (up > 45) opinion = `종합 분석 결과 <strong>방향성이 불분명한 혼조 국면</strong>입니다. 주요 신호들이 서로 엇갈리고 있어 무리한 추격 매수보다는 관망이 유리할 수 있습니다.`;
  else if (up > 35) opinion = `종합 분석 결과 <strong>약한 하락 우위</strong> 상태입니다. 매수세가 점차 약해지고 있어 보수적인 리스크 관리가 필요합니다. ${consistency}`;
  else opinion = `종합 분석 결과 <strong>하락 우위 국면</strong>입니다. 추세 이탈 신호가 다수 감지되어 기술적 반등 시 비중을 조절하는 전략을 권장합니다. ${consistency}`;

  let supportReasons = [];
  let riskReasons = [];

  const maSig = signals.find(s => s.label === "이동평균선 배열");
  const rsiSig = signals.find(s => s.label.includes("RSI"));
  const macdSig = signals.find(s => s.label === "MACD");
  const volSig = signals.find(s => s.label.includes("OBV"));

  if (maSig) {
    if (maSig.dir > 0.5) supportReasons.push("이동평균선이 정배열되어 탄탄한 상승 추세를 지지하고 있습니다.");
    else if (maSig.dir < -0.5) riskReasons.push("이평선이 역배열 상태로 상단에 강한 저항 매물이 쌓여 있습니다.");
  }

  if (rsiSig) {
    // 명시 상태(state)로 판정 — dir 부호로 읽으면 '하락 우위(31~45)' 가 과매수로 오인된다.
    if (rsiSig.state === "overbought") riskReasons.push("RSI 지표가 과매수 구간에 진입하여 단기 조정 리스크가 존재합니다.");
    else if (rsiSig.state === "oversold") supportReasons.push("RSI 지표가 과매도(침체)권에 있어 기술적 반등 가능성이 높습니다.");
    else if (rsiSig.state === "bearish") riskReasons.push(`RSI ${Math.round(rsiSig.value)}로 하락 우위권에 머물러 매수 모멘텀이 약합니다.`);
  }

  if (macdSig) {
    if (macdSig.detail.includes("골든크로스")) supportReasons.push("MACD가 골든크로스를 기록하며 강세 전환 모멘텀이 포착되었습니다.");
    else if (macdSig.detail.includes("데드크로스")) riskReasons.push("MACD 데드크로스가 발생해 단기 하락 압력이 증가하고 있습니다.");
  }

  if (volSig) {
    if (volSig.dir > 0.1) supportReasons.push("OBV상 자금 유입(매집 우위) 흐름이 관찰되어 수급이 양호합니다.");
    else if (volSig.dir < -0.1) riskReasons.push("OBV상 매도 분산 흐름이 이어져 수급이 약화되고 있습니다.");
  }

  const pats = result.patterns || [];
  if (pats.length > 0) {
    const topPat = pats[0];
    const isBull = topPat.nominalDir > 0;
    if (isBull) {
      supportReasons.push(`최근 차트에서 <strong>${topPat.label}</strong> 패턴이 확정되어 추가 상승 에너지를 모으고 있습니다.`);
    } else {
      riskReasons.push(`최근 차트에서 <strong>${topPat.label}</strong> 패턴이 확정되어 기술적 하락 위험이 감지되었습니다.`);
    }
  }

  const vwapSig = signals.find((s) => s.label === "VWAP");
  if (vwapSig && vwapSig.dir > 0.3) supportReasons.push("VWAP 위에서 거래되어 기관·단기 매수세가 우위입니다.");
  const ichiSig = signals.find((s) => s.label === "Ichimoku");
  if (ichiSig && ichiSig.dir > 0.5) supportReasons.push("일목균형표상 구름 위 강세 구간입니다.");
  else if (ichiSig && ichiSig.dir < -0.5) riskReasons.push("일목균형표상 구름 아래 약세 구간입니다.");
  const sqSig = signals.find((s) => s.label === "TTM Squeeze");
  if (sqSig && sqSig.fired === true) supportReasons.push("볼린저·켈트너 수축 해제로 변동성 확대 국면에 진입했습니다.");
  if (result.mtf && result.mtf.bias > 0.5) supportReasons.push(`주봉 추세와 일봉이 일치합니다 (${result.mtf.label}).`);
  else if (result.mtf && result.mtf.bias < -0.5) riskReasons.push(`주봉·일봉 추세가 하락 방향으로 일치합니다.`);
  if (result.shortSqueeze) supportReasons.push(`공매도 커버 ${result.shortSqueeze.daysToCover.toFixed(1)}일 + 강세 패턴으로 숏 스퀴즈 셋업이 관찰됩니다.`);

  let coreBrief = "";
  if (supportReasons.length > 0) {
    coreBrief += `<li><strong>호재 요인:</strong> ${supportReasons.slice(0, 3).join(" ")}</li>`;
  }
  if (riskReasons.length > 0) {
    coreBrief += `<li><strong>리스크 요인:</strong> ${riskReasons.slice(0, 3).join(" ")}</li>`;
  }

  const sr = result.sr || {};
  let strategy = "";
  if (sr.support && sr.resistance) {
    const distSup = ((price - sr.support) / price) * 100;
    const distRes = ((sr.resistance - price) / price) * 100;
    if (distSup < 3) {
      strategy = `현재 주가가 지지선(${fmtPrice(sr.support)}) 부근에 밀착해 있어 반등 타점이나 지지선 이탈 시 손절 기준으로 활용하기 적합한 구간입니다.`;
    } else if (distRes < 3) {
      strategy = `저항선(${fmtPrice(sr.resistance)})에 도달하여 돌파 여부 확인이 중요합니다. 돌파 시 추가 급등, 저항 시 비중 축소 타이밍입니다.`;
    } else {
      strategy = `주가가 지지선(${fmtPrice(sr.support)})과 저항선(${fmtPrice(sr.resistance)})의 박스권 중간에 위치해 있어 돌파 또는 지지 확인 후 진입하는 것이 안전합니다.`;
    }
  } else {
    strategy = "지지선과 저항선 데이터가 부족해 돌파 여부 위주의 실시간 차트 확인이 필요합니다.";
  }
  if (result.techLevels && result.techLevels.atr) {
    const a = result.techLevels.atr;
    strategy += ` ATR 기준 손절 ${fmtPrice(a.stop)}, 1차 목표 ${fmtPrice(a.target)} (리스크 약 ${a.riskPct.toFixed(1)}%).`;
  }

  return `
    <div class="cprob-briefing">
      <p class="cprob-briefing-opinion">${opinion}</p>
      <ul class="cprob-briefing-reasons" style="margin: 8px 0 12px; padding-left: 20px; list-style-type: none;">
        ${coreBrief}
      </ul>
      <p class="cprob-briefing-strategy" style="margin: 10px 0 0; border-top: 1px dashed var(--line); padding-top: 10px; font-size: 13px;"><strong>대응 전략:</strong> ${strategy}</p>
    </div>
  `;
}

// 결과 → HTML 문자열(순수 함수). analysis.html 과 대시보드 패널이 동일 마크업을 공유한다.
function buildResultHTML(result) {
  if (result.error === "insufficient") {
    return `<div class="notice">이 종목은 차트 데이터가 부족합니다(${result.bars}봉). 대형주·주요 종목을 입력해 주세요.</div>`;
  }
  const up = result.headlineUp;
  const down = result.headlineDown;
  const color = gaugeColor(up);

  const bullSignals = result.signals.filter((s) => s.dir > 0.15).sort((a, b) => b.dir * b.weight - a.dir * a.weight);
  const bearSignals = result.signals.filter((s) => s.dir < -0.15).sort((a, b) => a.dir * a.weight - b.dir * b.weight);
  const neutralSignals = result.signals.filter((s) => Math.abs(s.dir) <= 0.15);

  const signalRow = (s) => {
    const pct = Math.round(Math.abs(s.dir) * 100);
    const cls = s.dir > 0.15 ? "is-bull" : s.dir < -0.15 ? "is-bear" : "is-neutral";
    const arrow = s.dir > 0.15 ? "▲" : s.dir < -0.15 ? "▼" : "■";
    return `<div class="sig-row ${cls}">
      <span class="sig-arrow">${arrow}</span>
      <span class="sig-label">${escapeHtml(s.label)}</span>
      <span class="sig-detail">${escapeHtml(s.detail)}</span>
      <span class="sig-strength">${pct}%</span>
    </div>`;
  };

  // 표시는 라플라스 평활값(작은 표본 과신 방지). 내부 블렌딩(headlineUp)은 원시 upProb 그대로.
  const baseUpDisplay = result.base
    ? (result.base.upProbSmoothed != null ? result.base.upProbSmoothed : result.base.upProb)
    : null;
  const ciStr = (result.base && result.base.ciLow != null)
    ? `95% 구간 ${result.base.ciLow.toFixed(0)}~${result.base.ciHigh.toFixed(0)}%` : "";
  const simStr = (result.base && result.base.similarity != null)
    ? `이웃 유사도 ${(result.base.similarity * 100).toFixed(0)}% (평균 거리 ${result.base.avgDist.toFixed(2)})` : "";
  const baseHtml = result.base ? `
    <div class="card">
      <h3>② 과거 유사 상황 실측 <span class="muted">(${result.horizon}거래일 뒤)</span></h3>
      <p class="base-line">지난 5년 중 <b>지금과 비슷한 기술적 상태</b>였던 <b>${result.base.samples}회</b> 가운데
        <b style="color:${gaugeColor(baseUpDisplay)}">${baseUpDisplay.toFixed(0)}%</b>가 ${result.horizon}거래일 뒤 상승했습니다
        <span class="muted">(표본 ${result.base.samples}건 · 평활 보정${ciStr ? " · " + ciStr : ""})</span></p>
      ${simStr ? `<p class="muted" style="margin:0 0 6px;font-size:12px;">${simStr} · 표본이 적을수록 구간이 넓습니다</p>` : ""}
      <div class="base-stats">
        <div><span class="muted">평균 수익률</span><b style="color:${result.base.avgReturn >= 0 ? "var(--pos)" : "var(--neg)"}">${result.base.avgReturn >= 0 ? "+" : ""}${result.base.avgReturn.toFixed(1)}%</b></div>
        <div><span class="muted">최고</span><b style="color:var(--pos)">+${result.base.best.toFixed(0)}%</b></div>
        <div><span class="muted">최저</span><b style="color:var(--neg)">${result.base.worst.toFixed(0)}%</b></div>
      </div>
    </div>` : `
    <div class="card">
      <h3>② 과거 유사 상황 실측</h3>
      <p class="muted">유사 표본이 부족해 실측 확률을 계산하지 못했습니다(데이터 길이 부족).</p>
    </div>`;

  const patternHtml = renderPatternCard(result);
  const breakoutHtml = renderBreakoutCard(result);
  const briefingHtml = generateBriefing(result);
  const confluence = result.patternConfluence;
  const confluenceHtml = confluence && confluence.score > 0 ? `
    <div class="card cprob-confluence-card">
      <h3>패턴 중첩 점수</h3>
      <p class="base-line"><b style="color:${gaugeColor(confluence.bull >= confluence.bear ? 55 + confluence.score * 0.1 : 45 - confluence.score * 0.1)}">${confluence.score}%</b> 일치 · <b>${escapeHtml(confluence.label)}</b></p>
      <p class="muted" style="margin:0;font-size:12px;">강세 패턴 ${confluence.bull.toFixed(1)} / 약세 패턴 ${confluence.bear.toFixed(1)} (표본 가중)</p>
    </div>` : "";

  const sr = result.sr;
  const srHtml = `<div class="sr-line">
      <span>지지선 <b>${sr.support ? fmtPrice(sr.support) : "—"}</b></span>
      <span class="sr-cur">현재가 <b>${fmtPrice(result.price)}</b></span>
      <span>저항선 <b>${sr.resistance ? fmtPrice(sr.resistance) : "—"}</b></span>
    </div>`;

  // 상세(접이식) 섹션: 기본 화면에는 브리핑·확률·지지/저항만 노출하고,
  // 나머지(신호 합의·과거유사·다중TF·갭·옵션·수급·패턴 중첩·숏스퀴즈·차트패턴·돌파)는
  // 네이티브 <details>로 접어 둔다. JS 없이 접힘/펼침이 동작하므로 app.js 대시보드
  // 뷰에서 재사용될 때도 별도 처리가 필요 없다.
  const moreInner = `
    <div class="grid2 cprob-top-grid">
      <div class="card">
        <h3>① 기술 점수 <b>${result.consensus.up.toFixed(0)}</b><span class="muted">/100 · 신호 합의 (추세 강도 ADX ${result.adxVal != null ? result.adxVal.toFixed(0) : "—"})</span></h3>
        <p class="muted" style="margin:0 0 8px;font-size:12px;">기술 점수는 지표 투표의 가중 합산을 0~100 으로 환산한 값이며 확률이 아닙니다. 실측 확률은 ② 를 보세요.</p>
        ${bullSignals.length ? `<div class="sig-group"><h4 class="bull">강세 신호</h4>${bullSignals.map(signalRow).join("")}</div>` : ""}
        ${bearSignals.length ? `<div class="sig-group"><h4 class="bear">약세 신호</h4>${bearSignals.map(signalRow).join("")}</div>` : ""}
        ${neutralSignals.length ? `<div class="sig-group"><h4 class="neu">중립</h4>${neutralSignals.map(signalRow).join("")}</div>` : ""}
      </div>
      <div class="cprob-rstack">
        ${baseHtml}
        ${renderMtfCard(result)}
        ${renderGapFillCard(result)}
        ${renderOptionsContextCard(result)}
        ${renderInstitutionalFlowCard(result)}
        ${renderTechnicalLevelsCard(result)}
      </div>
    </div>

    ${confluenceHtml}

    ${renderShortSqueezeCard(result)}

    ${patternHtml}

    ${breakoutHtml}`;

  // 접이식 안의 내용이 모두 비어 있으면(예외적 데이터 결손) 요약 행 자체를 숨긴다.
  const hasMore = moreInner.replace(/\s+/g, "").length > 0;
  const moreHtml = hasMore ? `
    <details class="cprob-more">
      <summary><span class="cprob-more-caret" aria-hidden="true"></span>상세 분석 더보기</summary>
      <div class="cprob-more-body">
        ${moreInner}
      </div>
    </details>` : "";

  return `
    <div class="head-card">
      <div class="head-meta">
        <h2>${escapeHtml(result.ticker)} <span class="muted">${escapeHtml(result.company || "")}</span></h2>
        <p class="muted">기준일 ${escapeHtml(result.lastDate)} · 종가 ${fmtPrice(result.price)} · 분석 봉 ${result.bars}개</p>
      </div>
      <div class="verdict" style="color:${color}">${verdictText(up)}</div>
    </div>

    <div class="card briefing-card" style="margin-bottom:14px; padding: 14px 16px;">
      <h3 style="margin: 0 0 10px; font-size: var(--fs-h3);">AI 기술적 요약 브리핑</h3>
      ${briefingHtml}
    </div>

    <div class="prob-wrap">
      <div class="prob-bar">
        <div class="prob-up" style="width:${up.toFixed(1)}%">상승 ${up.toFixed(0)}%</div>
        <div class="prob-down" style="width:${down.toFixed(1)}%">하락 ${down.toFixed(0)}%</div>
      </div>
      <p class="prob-caption">${result.horizon}거래일 기준 종합 추정 · 기술 점수 ${result.consensus.up.toFixed(0)}/100${result.base ? ` / 과거 실측 ${baseUpDisplay.toFixed(0)}% (표본 ${result.base.samples}건${result.base.ciLow != null ? `, 95% ${result.base.ciLow.toFixed(0)}~${result.base.ciHigh.toFixed(0)}%` : ""})` : " / 과거 실측 표본 부족"}</p>
    </div>

    <div class="card">
      <h3>지지 / 저항</h3>
      ${srHtml}
    </div>

    ${moreHtml}

    <div class="disclaimer">
      이 수치는 <b>과거 가격 패턴에 기반한 기술적 추정</b>일 뿐이며 미래 수익을 보장하지 않습니다.
      실적·금리·뉴스 등 펀더멘털 변수는 반영되지 않습니다. 투자 판단과 책임은 본인에게 있습니다.
    </div>
  `;
}

function renderTechnicalLevelsCard(result) {
  const tl = result.techLevels;
  if (!tl) return "";
  const parts = [];
  if (tl.atr) {
    parts.push(`<p class="pat-stat"><b>ATR 손절</b> (2ATR): <b style="color:var(--neg)">${fmtPrice(tl.atr.stop)}</b> ·
      <b>목표</b> (1R): <b style="color:var(--pos)">${fmtPrice(tl.atr.target)}</b> ·
      <b>목표</b> (2R): <b style="color:var(--pos)">${fmtPrice(tl.atr.target2)}</b>
      <span class="muted"> (리스크 ${tl.atr.riskPct.toFixed(1)}%)</span></p>`);
  }
  if (tl.pivots) {
    const p = tl.pivots;
    parts.push(`<p class="pat-stat"><b>피벗</b> P ${fmtPrice(p.pivot)} · R1 ${fmtPrice(p.r1)} · R2 ${fmtPrice(p.r2)} · S1 ${fmtPrice(p.s1)} · S2 ${fmtPrice(p.s2)}</p>`);
  }
  if (tl.fib && tl.fib.levels) {
    const f = Object.entries(tl.fib.levels).map(([k, v]) => `${k} ${fmtPrice(v)}`).join(" · ");
    parts.push(`<p class="pat-stat"><b>피보나치</b> (60봉) ${f}</p>`);
  }
  if (tl.linreg) {
    parts.push(`<p class="pat-stat"><b>선형회귀</b> 상단 ${fmtPrice(tl.linreg.upper)} · 중심 ${fmtPrice(tl.linreg.mid)} · 하단 ${fmtPrice(tl.linreg.lower)}</p>`);
  }
  if (tl.psar && tl.psar.values) {
    const ps = tl.psar.values[tl.psar.values.length - 1];
    if (ps != null) {
      parts.push(`<p class="pat-stat"><b>Parabolic SAR</b> ${fmtPrice(ps)} · ${tl.psar.bullish ? "상승 추세" : "하락 추세"}</p>`);
    }
  }
  if (!parts.length) return "";
  return `<div class="card tech-levels-card">
    <h3>기술적 레벨 · 리스크 프레임</h3>
    ${parts.join("")}
    <p class="pat-note muted">※ 피보나치·피벗·ATR 목표가는 참고용이며 투자 권유가 아닙니다.</p>
  </div>`;
}

function renderMtfCard(result) {
  const mtf = result.mtf;
  if (!mtf || mtf.alignment <= 0) return "";
  const color = mtf.bias > 0 ? "var(--pos)" : mtf.bias < 0 ? "var(--neg)" : "var(--muted)";
  const tfLine = (t, name) => t ? `<span>${name} <b>${escapeHtml(t.label)}</b></span>` : "";
  return `<div class="card mtf-card">
    <h3>다중 타임프레임 (일·주·월)</h3>
    <p class="base-line"><b style="color:${color}">${escapeHtml(mtf.label)}</b> · 일치도 <b>${(mtf.alignment * 100).toFixed(0)}%</b></p>
    <p class="muted mtf-tf-row" style="margin:6px 0 0;font-size:12px;display:flex;gap:12px;flex-wrap:wrap;">
      ${tfLine(mtf.daily, "일")}${tfLine(mtf.weekly, "주")}${tfLine(mtf.monthly, "월")}
    </p>
  </div>`;
}

function renderGapFillCard(result) {
  const g = result.gapFill;
  if (!g || !g.samples) return "";
  const rate = g.fillRate != null ? `${g.fillRate.toFixed(0)}%` : "—";
  const avg = g.avgFillBars != null ? `${g.avgFillBars.toFixed(0)}봉` : "—";
  const recent = (g.recent || []).map((z) => {
    const word = z.type === "up" ? "상승갭" : "하락갭";
    const st = z.filled ? `메움(${z.fillBars}봉)` : z.censored ? "관찰 중(40봉 미경과)" : "미체결";
    return `<li>${word} ${fmtPrice(z.lo)}~${fmtPrice(z.hi)} · ${st}</li>`;
  }).join("");
  const pending = g.pending ? ` <span class="muted">(관찰 중 ${g.pending}건 제외)</span>` : "";
  return `<div class="card gap-fill-card">
    <h3>갭 메우기 통계</h3>
    <p class="base-line">과거 <b>${g.samples}</b>건 중 <b style="color:var(--primary)">${rate}</b>가 40봉 내 메워짐 · 평균 <b>${avg}</b>${pending}</p>
    ${recent ? `<ul class="muted" style="margin:8px 0 0;padding-left:18px;font-size:12px;">${recent}</ul>` : ""}
  </div>`;
}

// 실측 옵션 카드 — data/options_stats.js 에 그 종목이 있을 때만(없으면 카드 없음).
function renderOptionsContextCard(result) {
  if (isKrAnalysisMode()) return "";
  const o = result.optionsStats;
  if (!o) return "";
  const parts = [];
  if (o.putCallOI != null) parts.push(`풋/콜 OI <b>${o.putCallOI.toFixed(2)}</b>`);
  if (o.putCallVol != null) parts.push(`풋/콜 거래량 <b>${o.putCallVol.toFixed(2)}</b>`);
  if (o.maxPain != null) parts.push(`맥스페인 <b>${fmtPrice(o.maxPain)}</b>`);
  if (o.expectedMovePct != null) parts.push(`예상 변동폭 <b>±${o.expectedMovePct.toFixed(1)}%</b>`);
  if (!parts.length) return "";
  const oi = (o.callOI != null && o.putOI != null)
    ? ` · 콜 OI ${Math.round(o.callOI).toLocaleString()} / 풋 OI ${Math.round(o.putOI).toLocaleString()}` : "";
  return `<div class="card options-card">
    <h3>옵션 포지셔닝 <span class="muted">(실측${o.expiry ? ` · 만기 ${escapeHtml(o.expiry)}` : ""})</span></h3>
    <p class="base-line">${parts.join(" · ")}</p>
    <p class="muted" style="margin:0;font-size:12px;">출처: ${escapeHtml(o.source)}${o.updatedAtKst ? ` · ${escapeHtml(o.updatedAtKst)}` : ""}${oi}</p>
  </div>`;
}

function renderInstitutionalFlowCard(result) {
  if (isKrAnalysisMode()) return "";
  const f = result.institutionalFlow;
  if (!f) return "";
  // 13F 보유액은 항상 달러(백만 단위) — US 전용 카드라 $ 하드코딩이 맞다.
  const inst = f.instCount ? `13F 보유 기관 <b>${f.instCount}</b>곳 · 합계 <b>$${f.totalValueM.toFixed(0)}M</b>${f.topInst ? ` (${escapeHtml(f.topInst)})` : ""}` : "13F 보유 기관 데이터 없음";
  const ins = f.insiderCount ? `내부자 거래 <b>${f.insiderCount}</b>건 · 순매수 편향 <b>${f.netBuyBias >= 0 ? "+" : ""}${f.netBuyBias}</b>` : "최근 내부자 거래 없음";
  const recent = (f.recent || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  return `<div class="card inst-flow-card">
    <h3>기관 · 내부자 수급</h3>
    <p class="pat-stat">${inst}</p>
    <p class="pat-stat">${ins}</p>
    ${recent ? `<ul class="muted" style="margin:6px 0 0;padding-left:18px;font-size:12px;">${recent}</ul>` : ""}
  </div>`;
}

function renderShortSqueezeCard(result) {
  if (isKrAnalysisMode() || !result.shortSqueeze) return "";
  const s = result.shortSqueeze;
  return `<div class="card squeeze-card">
    <h3>숏 스퀴즈 셋업</h3>
    <p class="base-line">공매도 커버 <b>${s.daysToCover.toFixed(1)}일</b> + <b>강세 패턴 중첩</b> → 기술적 스퀴즈 가능성</p>
    <p class="muted" style="margin:0;font-size:12px;">공매도 변화 ${s.changePct >= 0 ? "+" : ""}${(s.changePct || 0).toFixed(1)}% (최근 결산 기준)</p>
  </div>`;
}

function renderBreakoutCard(result) {
  if (!breakoutStats) return "";
  const b = result.breakout;
  if (!b) return "";
  const dirWord = b.dir > 0 ? "상승 돌파" : "하락 돌파";
  const phase = b.isRetest ? "되돌림(retest) 구간" : "돌파 직후";
  const cont = b.stat.cont_rate;
  const edge = b.stat.edge_vs_market;
  const contColor = edge != null && edge >= 0 ? "var(--pos)" : "var(--neg)";
  const edgeStr = edge == null ? "" :
    `<span class="pat-edge ${edge >= 0 ? "pos" : "neg"}">시장 대비 ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%p</span>`;
  return `<div class="card">
    <h3>④ 돌파 연속성 <span class="muted">(${b.barsSince}봉 전 ${dirWord} · ${phase})</span></h3>
    <p class="pat-stat">과거 같은 셋업 <b>${b.stat.n.toLocaleString()}건</b> 중
      <b style="color:${contColor}">${cont.toFixed(0)}%</b>가 ${result.horizon}거래일 뒤 ${b.dir > 0 ? "상승" : "하락"} 지속 ${edgeStr}</p>
    <p class="pat-note muted">※ 검증 결과: 상승 돌파는 약한 지속 우위, 하락 돌파는 오히려 반등 경향이 강합니다. 되돌림은 주로 단기 진입 타이밍에 도움.</p>
  </div>`;
}

function renderResult(result) {
  const el = $("result");
  if (!el) return;
  el.innerHTML = buildResultHTML(result);
}

// standalone 페이지 전용: 실측 옵션 지표(data/options_stats.json). 대시보드에서는 app.js 가
// FEATURE_DATA(optionsStats)로 window.OPTIONS_STATS 를 채우므로 여기서는 받지 않는다.
let standaloneDataPromise = null;
async function loadOptionsStatsStandalone() {
  if (typeof window === "undefined" || window.OPTIONS_STATS) return window.OPTIONS_STATS || null;
  if (isKrAnalysisMode()) return null; // US 전용 데이터 — KR 에서 없는 파일을 부르지 않는다
  try {
    const res = await fetch("data/options_stats.json", { cache: "no-cache" });
    if (res.ok) window.OPTIONS_STATS = await res.json();
  } catch (e) { /* 없으면 옵션 카드만 생략 */ }
  return window.OPTIONS_STATS || null;
}

// 요청 순서 보장: 빠르게 연달아 검색하면 먼저 보낸 요청의 응답이 나중에 도착해
// 마지막 검색 결과를 덮어쓸 수 있다. 요청마다 id 를 올리고, 응답 시점에 최신이 아니면 버린다.
let analysisRequestSeq = 0;

async function runAnalysis(ticker) {
  const el = $("result");
  const reqId = ++analysisRequestSeq;
  el.innerHTML = `<div class="notice">분석 중…</div>`;
  try {
    await ensureStats(); // 통계가 아직 안 왔으면 기다린다(첫 검색을 stats 로드보다 먼저 눌러도 안전)
    if (standaloneDataPromise) await standaloneDataPromise;
    const detail = await loadDetail(ticker);
    if (reqId !== analysisRequestSeq) return; // 더 새로운 요청이 있음 — 이 응답은 버린다
    currentDetail = detail;
    const result = analyzeTicker(detail, currentHorizon);
    renderResult(result);
    const url = new URL(window.location);
    url.searchParams.set("t", analysisTickerKey(ticker));
    window.history.replaceState({}, "", url);
    updateAnalysisMeta(ticker, detail && detail.company);
  } catch (e) {
    if (reqId !== analysisRequestSeq) return;
    const hint = (window.MirMarket && window.MirMarket.getMode() === "kr") ? "005930, 000660" : "NVDA, AAPL, TSLA";
    el.innerHTML = `<div class="notice err">"${escapeHtml(ticker)}" 종목 데이터를 찾을 수 없습니다. 티커를 정확히 입력했는지 확인해 주세요. (예: ${hint})</div>`;
  }
}

function rerenderHorizon() {
  if (!currentDetail) return;
  const result = analyzeTicker(currentDetail, currentHorizon);
  renderResult(result);
}

// ===== 종목별 메타태그 =====
// sitemap 에 analysis.html?t=NVDA 를 올려도, canonical 이 쿼리 없는 analysis.html 로
// 고정돼 있으면 검색엔진은 전부 같은 페이지의 중복으로 보고 색인하지 않는다.
// 종목이 지정된 동안에는 canonical·제목·설명·OG 를 그 종목 것으로 바꿔 준다.
const ANALYSIS_BASE_URL = "https://seonu-dragon.github.io/Mir_US_Stocks/analysis.html";

function setMetaContent(selector, value) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute("content", value);
}

function updateAnalysisMeta(ticker, company) {
  const key = ticker ? analysisTickerKey(ticker) : "";
  const link = document.head.querySelector('link[rel="canonical"]');
  if (!key) {
    // 검색 화면(종목 미지정)으로 돌아온 경우 원래 메타로 되돌린다.
    if (link) link.setAttribute("href", ANALYSIS_BASE_URL);
    setMetaContent('meta[property="og:url"]', ANALYSIS_BASE_URL);
    return;
  }
  const label = company ? `${company}(${key})` : key;
  const title = `${label} 상승/하락 확률 분석 | 미르의 미국 주식`;
  const desc = `${label} 의 차트 패턴·지지저항·과거 유사 구간을 기반으로 한 상승/하락 확률 추정.`;
  const url = `${ANALYSIS_BASE_URL}?t=${encodeURIComponent(key)}`;

  document.title = title;
  if (link) link.setAttribute("href", url);
  setMetaContent('meta[name="description"]', desc);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', desc);
  setMetaContent('meta[property="og:url"]', url);
}

async function init() {
  const form = $("searchForm");
  if (!form) return; // standalone 분석 페이지가 아니면(예: 대시보드) UI 바인딩 생략
  if (window.MirMarket) {
    const params = new URLSearchParams(window.location.search);
    const market = params.get("market");
    window.MirMarket.setMode(market === "kr" ? "kr" : window.MirMarket.getInitialMode());
    document.title = window.MirMarket.getConfig().pageTitle + " · 차트 확률 분석";
  }
  // submit 바인딩을 통계 로드보다 먼저 건다. 예전엔 await ensureStats() 뒤에 바인딩해,
  // 통계가 오기 전에 Enter 를 치면 preventDefault 가 없어 폼이 네이티브 GET 으로 페이지를
  // 다시 불러왔다. runAnalysis 가 스스로 ensureStats() 를 기다리므로 순서가 바뀌어도 안전.
  const input = $("tickerInput");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim()) runAnalysis(resolveKoAliasToTicker(input.value));
  });
  ensureStats();
  standaloneDataPromise = loadOptionsStatsStandalone();

  // 시장에 맞는 예시 티커/플레이스홀더 (KR이면 한국 종목으로 교체)
  const krMode = window.MirMarket && window.MirMarket.getMode() === "kr";
  if (input) input.placeholder = krMode ? "티커 입력 (예: 005930)" : "티커 입력 (예: NVDA)";
  const examplesBox = document.querySelector(".ca-examples");
  if (examplesBox) {
    const examples = krMode
      ? [["005930", "삼성전자"], ["000660", "SK하이닉스"], ["035420", "NAVER"], ["005380", "현대차"]]
      : [["NVDA"], ["AAPL"], ["TSLA"], ["MSFT"]];
    examplesBox.innerHTML = "예시: " + examples
      .map(([code, label]) => `<button type="button" data-example="${code}">${label || code}</button>`)
      .join(" ");
    examplesBox.querySelectorAll("button[data-example]").forEach((btn) => {
      btn.addEventListener("click", () => { input.value = btn.dataset.example; form.requestSubmit(); });
    });
  }

  document.querySelectorAll(".hz-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentHorizon = Number(btn.dataset.hz);
      document.querySelectorAll(".hz-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      rerenderHorizon();
    });
  });

  // URL ?t= 로 진입 시 자동 분석
  const params = new URLSearchParams(window.location.search);
  const t = params.get("t");
  if (t) {
    const resolved = resolveKoAliasToTicker(t);
    input.value = analysisTickerKey(resolved);
    runAnalysis(resolved);
  }
}

document.addEventListener("DOMContentLoaded", init);

// ===== 외부 노출 (대시보드 app.js 등에서 재사용) =====
window.MirProb = {
  analyzeRows,
  analyzeTicker,
  buildResultHTML,
  supportResistanceLevels,
  srSummary,
  detectCurrentPatterns,
  detectConfirmations,
  patternLabels: PATTERN_LABELS,
  computeMeasuredMove,
  checkPatternFailure,
  computeConfluence,
  computeTechnicalLevels,
  volumeProfileNodes,
  ttmSqueezeSeries,
  cmfArray,
  mfiArray,
  computeGapFillStats,
  optionsStatsForTicker,
  institutionalFlowForTicker,
  rsiSeries,        // Wilder RSI — chart_capture.js 가 대시보드와 같은 정의를 쓰도록 노출
  isSyntheticRows,
  chandelierExitArray,
  buildMultiTimeframeContext,
  ensureStats,
  gaugeColor,
  verdictText,
};
})();
