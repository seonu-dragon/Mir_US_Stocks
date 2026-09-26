// 역DCF · 사용자 가정 DCF — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirDcfCore, node 테스트(scripts/tests/test_dcf_core.mjs)에서는 module.exports.
// IIFE 라 최상위 이름을 전역에 흘리지 않는다. 입력 종목 파일 스키마는 scripts/financials_common.py.
//
// 정의(화면 각주와 같은 문장 — 바꾸면 dcf.js 각주도 같이)
// - 기업가치(EV)      = 시가총액 + 순차입금. 시가총액 = 현재가 × 희석 주식수(주당 가치와 같은 주식수를 써서
//                      '역DCF 성장률 = 현재가를 정당화하는 성장률' 이 되게 한다).
// - 역DCF             = 향후 10년 FCF 가 매년 g 로 자라고 이후 영구성장률로 자란다고 할 때, 할인한 현재가치가
//                      EV 와 같아지는 g 를 이분법으로 찾는다. 할인가치는 g 에 대해 단조 증가라 해가 하나다.
// - 기준 FCF          = TTM(최근 4분기) 또는 최근 3개 회계연도 평균. 기본은 둘 중 작은 값(보수적).
// - 할인율 기본값     = 무위험금리(10년 국채) + 주식위험프리미엄(ERP, 아래 상수). 베타 1(시장 평균 위험) 가정.
// - 사용자 DCF        = 매출 × 영업이익률 × (1 − 세율) × (1 − 재투자율) = FCF. 영업이익률은 현재 값에서 목표까지
//                      1~5년에 걸쳐 직선으로 옮겨 가고 6~10년은 목표 유지. 10년차 뒤는 영구성장.
// - 주당 가치         = (EV − 순차입금) ÷ 희석 주식수.
// 모두 추정치이며 가정에 극도로 민감하다. 예측·투자 권유가 아니다.
(function (root) {
  "use strict";

  // 주식위험프리미엄 — 값·출처·기준일을 코드에 박아 둔다(화면에 그대로 표시). 바꿀 때는 세 칸을 함께.
  const ERP = {
    us: {
      value: 0.0414,
      asOf: "2026-09-01",
      source: "Damodaran 내재 ERP(S&P 500, 최근 12개월·조정 배당)",
      url: "https://pages.stern.nyu.edu/~adamodar/",
    },
    kr: {
      // 미국 내재 ERP + 한국 국가위험 프리미엄(Damodaran ctryprem, Moody's Aa2, 2026-01-05 갱신).
      value: 0.0414 + 0.0064,
      crp: 0.0064,
      asOf: "2026-09-01",
      source: "Damodaran 미국 내재 ERP 4.14% + 한국 국가위험 프리미엄 0.64%(Aa2, 2026-01-05 갱신)",
      url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html",
    },
  };
  const FALLBACK_DISCOUNT = 0.09;     // 금리 데이터를 못 받았을 때만(화면에 '고정 기본값' 으로 표시)
  const DEFAULT_TERMINAL = 0.025;
  const YEARS = 10;
  const DEFAULT_TAX = { us: 0.21, kr: 0.24 };   // 실효세율을 못 구할 때의 가정(화면에 '가정' 표시)
  const MARKET_CURRENCY = { us: "USD", kr: "KRW" };

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function round(v, d) {
    const p = Math.pow(10, d);
    return Math.round(v * p) / p;
  }

  // ── 할인 ──
  // f0 에서 시작해 1~years 년 동안 매년 g 로 자라는 FCF + years 년차 뒤 영구성장 tg 의 현재가치.
  function pvGrowth(f0, g, r, tg, years) {
    const n = years || YEARS;
    if (!(r > tg)) return null;
    let pv = 0, f = f0;
    for (let t = 1; t <= n; t++) {
      f *= 1 + g;
      pv += f / Math.pow(1 + r, t);
    }
    const tv = (f * (1 + tg)) / (r - tg);
    const pvTerminal = tv / Math.pow(1 + r, n);
    return { explicit: pv, terminal: pvTerminal, total: pv + pvTerminal, terminalShare: pvTerminal / (pv + pvTerminal) };
  }

  // 역DCF: pvGrowth(fcf0, g) = ev 인 g. 범위 밖이면 bound 로 알린다(값을 지어내지 않음).
  function impliedGrowth(opts) {
    const o = opts || {};
    const ev = num(o.ev), f0 = num(o.fcf0), r = num(o.r), tg = num(o.tg);
    const years = o.years || YEARS;
    const lo0 = o.lo ?? -0.5, hi0 = o.hi ?? 1.0;
    if (f0 === null || ev === null || r === null || tg === null) return { ok: false, code: "input", reason: "입력값 결측" };
    if (!(r > tg)) return { ok: false, code: "rate", reason: "할인율이 영구성장률보다 커야 합니다" };
    if (!(f0 > 0)) return { ok: false, code: "negativeFcf", reason: "기준 FCF 가 0 이하라 성장률을 역산할 수 없습니다" };
    if (!(ev > 0)) return { ok: false, code: "negativeEv", reason: "순현금이 시가총액보다 커서 기업가치(EV)가 0 이하입니다" };
    const f = (g) => pvGrowth(f0, g, r, tg, years).total - ev;
    const flo = f(lo0), fhi = f(hi0);
    if (flo > 0) return { ok: true, g: lo0, bound: "below", iterations: 0 };
    if (fhi < 0) return { ok: true, g: hi0, bound: "above", iterations: 0 };
    let lo = lo0, hi = hi0, it = 0;
    const tol = o.tol || 1e-7;
    while (hi - lo > tol && it < 200) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid; else lo = mid;
      it++;
    }
    const g = (lo + hi) / 2;
    return { ok: true, g, bound: null, iterations: it, pv: pvGrowth(f0, g, r, tg, years) };
  }

  // ── 종목 파일에서 입력 뽑기 ──
  function lastAnnual(file) {
    const a = (file && file.annual) || [];
    return a.length ? a[a.length - 1] : null;
  }

  function baseFcfOptions(file) {
    const ttm = (file && file.ttm) || null;
    const annual = ((file && file.annual) || []).filter((r) => num(r.fcf) !== null);
    const out = { ttm: null, avg3: null, conservative: null };
    if (ttm && num(ttm.fcf) !== null) {
      out.ttm = { value: ttm.fcf, label: ttm.basis === "4Q" ? `TTM(${(ttm.quarters || []).slice(-1)[0] || `${ttm.fy} ${ttm.fq}Q`})` : `FY${ttm.fy}` };
    } else if (annual.length) {
      const la = annual[annual.length - 1];
      out.ttm = { value: la.fcf, label: `FY${la.fy}(TTM 없음)` };
    }
    const last3 = annual.slice(-3);
    if (last3.length === 3) {
      out.avg3 = { value: (last3[0].fcf + last3[1].fcf + last3[2].fcf) / 3, label: `FY${last3[0].fy}~${last3[2].fy} 평균`, years: 3 };
    }
    if (out.ttm && out.avg3) out.conservative = out.avg3.value < out.ttm.value ? "avg3" : "ttm";
    else if (out.ttm) out.conservative = "ttm";
    else if (out.avg3) out.conservative = "avg3";
    return out;
  }

  // 희석 주식수: TTM 평균(4분기 모두 있을 때) → 최근 분기 희석 가중평균 → 최근 연간 → 기말 발행주식수(기본).
  function dilutedShares(file) {
    const ttm = (file && file.ttm) || {};
    if (num(ttm.sharesDilAvg) > 0) return { value: ttm.sharesDilAvg, label: "희석 가중평균(TTM)", basic: false };
    const q = ((file && file.quarterly) || []).slice().reverse().find((r) => num(r.sharesDilAvg) > 0);
    const a = ((file && file.annual) || []).slice().reverse().find((r) => num(r.sharesDilAvg) > 0);
    if (q && (!a || !a.end || !q.end || q.end >= a.end)) return { value: q.sharesDilAvg, label: `희석 가중평균(${q.fy} ${q.fq}Q)`, basic: false };
    if (a) return { value: a.sharesDilAvg, label: `희석 가중평균(FY${a.fy})`, basic: false };
    if (num(ttm.sharesOut) > 0) return { value: ttm.sharesOut, label: "기말 발행주식수(희석 미공시)", basic: true };
    const b = ((file && file.annual) || []).slice().reverse().find((r) => num(r.sharesOut) > 0);
    if (b) return { value: b.sharesOut, label: `기말 발행주식수(FY${b.fy}, 희석 미공시)`, basic: true };
    return null;
  }

  // 순차입금: 최근 분기말(TTM 행) → 최근 연간. 차입금 태그가 없으면 0 으로 보고 표시한다(결측을 숨기지 않음).
  function netDebtOf(file) {
    const rows = [(file && file.ttm) || null, lastAnnual(file)].filter(Boolean);
    for (const r of rows) {
      if (num(r.netDebt) !== null) return { value: r.netDebt, note: "" };
    }
    for (const r of rows) {
      if (num(r.cash) !== null) return { value: -r.cash, note: "총차입금 미공시 — 차입금 0 으로 계산" };
    }
    return { value: 0, note: "현금·차입금 미공시 — 순차입금 0 으로 계산" };
  }

  // 계산 가능 여부. code: financial · currency · adr · noFcf · negativeFcf · loss · noShares
  function eligibility(file, market) {
    if (!file) return { ok: false, code: "noData", reason: "재무 파일이 없습니다" };
    const flags = file.flags || [];
    if ((file.industryType && file.industryType !== "general") || flags.includes("financial")) {
      return { ok: false, code: "financial", reason: "금융업(은행·보험 등)은 예금·보험부채가 영업 자금이라 FCF·순차입금 개념이 맞지 않아 계산하지 않습니다" };
    }
    const cur = MARKET_CURRENCY[market || file.market];
    if (cur && file.currency && file.currency !== cur) {
      return { ok: false, code: "currency", reason: `재무제표 통화(${file.currency})가 주가 통화(${cur})와 달라 계산하지 않습니다` };
    }
    if (flags.includes("adrShareBasis") || flags.includes("foreignFiler")) {
      return { ok: false, code: "adr", reason: "해외발행인(20-F/40-F)은 주식수가 ADR 1주와 달라 주당 가치를 맞출 수 없어 계산하지 않습니다" };
    }
    const ttm = file.ttm || {};
    const la = lastAnnual(file) || {};
    const net = num(ttm.net) !== null ? ttm.net : num(la.net);
    if (net !== null && net < 0) return { ok: false, code: "loss", reason: "최근 순이익이 적자라 계산하지 않습니다(성장률 역산이 의미를 잃습니다)" };
    const opts = baseFcfOptions(file);
    if (!opts.ttm && !opts.avg3) return { ok: false, code: "noFcf", reason: "FCF(영업현금흐름·설비투자) 공시가 없어 계산하지 않습니다" };
    const cons = opts[opts.conservative];
    if (!(cons && cons.value > 0)) {
      const other = opts.conservative === "ttm" ? opts.avg3 : opts.ttm;
      if (!(other && other.value > 0)) return { ok: false, code: "negativeFcf", reason: "FCF 가 0 이하라 계산하지 않습니다" };
    }
    if (!dilutedShares(file)) return { ok: false, code: "noShares", reason: "주식수 공시가 없어 계산하지 않습니다" };
    return { ok: true };
  }

  // 할인율 기본값. rfPct = 10년 국채 % (예: 4.39). 없으면 고정 기본값.
  function defaultDiscount(market, rfPct) {
    const erp = ERP[market] || ERP.us;
    const rf = num(rfPct);
    if (rf === null) return { r: FALLBACK_DISCOUNT, rf: null, erp: erp.value, fallback: true };
    return { r: rf / 100 + erp.value, rf: rf / 100, erp: erp.value, fallback: false };
  }

  // 한 번에: 역DCF 입력 + 결과. basis: "ttm" | "avg3" | undefined(보수적)
  function reverseDcf(file, opts) {
    const o = opts || {};
    const market = o.market || (file && file.market) || "us";
    const el = eligibility(file, market);
    if (!el.ok) return el;
    const price = num(o.price);
    if (!(price > 0)) return { ok: false, code: "noPrice", reason: "현재가가 없습니다" };
    const fcfOpts = baseFcfOptions(file);
    const basis = o.basis && fcfOpts[o.basis] ? o.basis : fcfOpts.conservative;
    const base = fcfOpts[basis];
    const shares = dilutedShares(file);
    const nd = netDebtOf(file);
    const marketCap = price * shares.value;
    const ev = marketCap + nd.value;
    const r = num(o.r), tg = num(o.tg) ?? DEFAULT_TERMINAL;
    const res = impliedGrowth({ ev, fcf0: base.value, r, tg, years: YEARS });
    return Object.assign({}, res, {
      basis, basisLabel: base.label, conservative: fcfOpts.conservative, fcfOptions: fcfOpts,
      fcf0: base.value, shares, netDebt: nd, marketCap, ev, r, tg, price,
    });
  }

  // ── 사용자 가정 DCF ──
  // s: { g1, g2, margin, tax, reinvest } (소수), common: { r, tg }, base: { rev0, margin0, netDebt, shares }
  function scenarioValue(s, common, base) {
    const r = num(common && common.r), tg = num(common && common.tg);
    const rev0 = num(base && base.rev0), m0 = num(base && base.margin0);
    const shares = num(base && base.shares), nd = num(base && base.netDebt) ?? 0;
    if (r === null || tg === null || rev0 === null || !(rev0 > 0) || !(shares > 0)) return { ok: false, reason: "입력값 결측" };
    if (!(r > tg)) return { ok: false, reason: "할인율이 영구성장률보다 커야 합니다" };
    const mStart = m0 === null ? s.margin : m0;
    let rev = rev0, pv = 0, fcf = 0;
    const rows = [];
    for (let t = 1; t <= YEARS; t++) {
      rev *= 1 + (t <= 5 ? s.g1 : s.g2);
      const m = t <= 5 ? mStart + (s.margin - mStart) * (t / 5) : s.margin;
      const nopat = rev * m * (1 - s.tax);
      fcf = nopat * (1 - s.reinvest);
      const disc = fcf / Math.pow(1 + r, t);
      pv += disc;
      rows.push({ t, rev, margin: m, fcf, pv: disc });
    }
    const tv = (fcf * (1 + tg)) / (r - tg);
    const pvTerminal = tv / Math.pow(1 + r, YEARS);
    const ev = pv + pvTerminal;
    const equity = ev - nd;
    return { ok: true, ev, equity, perShare: equity / shares, pvExplicit: pv, pvTerminal, terminalShare: pvTerminal / ev, rows };
  }

  function steps(center, step, count) {
    const half = Math.floor(count / 2);
    const out = [];
    for (let i = -half; i <= half; i++) out.push(round(center + i * step, 6));
    return out;
  }

  // 할인율 × 영구성장 민감도 격자. 셀 = 주당 가치(r ≤ tg 이면 null).
  function sensitivityGrid(s, common, base, opt) {
    const o = opt || {};
    const rs = o.rs || steps(common.r, o.rStep || 0.01, o.count || 5);
    const tgs = o.tgs || steps(common.tg, o.tgStep || 0.005, o.count || 5);
    const cells = rs.map((r) => tgs.map((tg) => {
      if (!(r > tg)) return null;
      const v = scenarioValue(s, { r, tg }, base);
      return v.ok ? v.perShare : null;
    }));
    return { rs, tgs, cells };
  }

  function cagr(a, b, years) {
    if (!(a > 0) || !(b > 0) || !(years > 0)) return null;
    return Math.pow(b / a, 1 / years) - 1;
  }

  // 종목 파일에서 3개 시나리오 기본값. 데이터로 못 구하는 값은 가정값을 쓰고 assumed 에 적는다.
  function defaultScenarios(file, market) {
    const mk = market || (file && file.market) || "us";
    const ttm = (file && file.ttm) || {};
    const annual = ((file && file.annual) || []).filter((r) => num(r.rev) > 0);
    const assumed = [];
    const rev0 = num(ttm.rev) > 0 ? ttm.rev : (annual.length ? annual[annual.length - 1].rev : null);
    let hist = null, histYears = 0;
    if (annual.length >= 2) {
      const end = annual[annual.length - 1];
      const start = annual[Math.max(0, annual.length - 4)];
      histYears = Number(end.fy) - Number(start.fy);
      hist = cagr(start.rev, end.rev, histYears);
    }
    let g1 = hist;
    if (g1 === null) { g1 = 0.05; assumed.push("매출 성장률(과거 자료 부족 — 5% 가정)"); }
    g1 = clamp(g1, -0.05, 0.25);
    const margin0 = num(ttm.op) !== null && rev0 ? ttm.op / rev0 : null;
    let m = margin0;
    if (m === null) { m = 0.1; assumed.push("영업이익률(자료 부족 — 10% 가정)"); }
    m = clamp(m, -0.2, 0.6);
    let tax = null;
    const tsrc = [ttm, ...(file && file.annual ? file.annual.slice().reverse() : [])].find((r) => num(r.tax) !== null && num(r.pretax) > 0);
    if (tsrc) {
      const et = tsrc.tax / tsrc.pretax;
      if (et >= 0 && et <= 0.5) tax = et;
    }
    if (tax === null) { tax = DEFAULT_TAX[mk] || 0.21; assumed.push(`세율(실효세율 산출 불가 — ${Math.round(tax * 100)}% 가정)`); }
    let reinvest = null;
    if (num(ttm.fcf) !== null && num(ttm.op) > 0) {
      const nopat = ttm.op * (1 - tax);
      reinvest = 1 - ttm.fcf / nopat;
    }
    if (reinvest === null || !Number.isFinite(reinvest)) { reinvest = 0.4; assumed.push("재투자율(자료 부족 — 40% 가정)"); }
    reinvest = clamp(reinvest, 0, 0.9);
    const g2 = Math.max(DEFAULT_TERMINAL, g1 / 2);
    const mkS = (dg1, dg2, dm, dre) => ({
      g1: round(clamp(g1 + dg1, -0.2, 0.5), 4),
      g2: round(clamp(g2 + dg2, -0.1, 0.3), 4),
      margin: round(clamp(m + dm, -0.2, 0.7), 4),
      tax: round(tax, 4),
      reinvest: round(clamp(reinvest + dre, 0, 0.95), 4),
    });
    return {
      base: { rev0, margin0, histGrowth: hist, histYears },
      scenarios: { bear: mkS(-0.05, -0.02, -0.03, 0.1), base: mkS(0, 0, 0, 0), bull: mkS(0.05, 0.02, 0.03, -0.1) },
      assumed,
    };
  }

  // ── 기저율 ──
  // sorted: 오름차순 CAGR(% 단위). x: % 단위. x 이상 비율.
  function fractionAtLeast(sorted, x) {
    const a = sorted || [];
    if (!a.length) return null;
    let lo = 0, hi = a.length;
    while (lo < hi) {           // 첫 번째 a[i] >= x
      const mid = (lo + hi) >> 1;
      if (a[mid] < x) lo = mid + 1; else hi = mid;
    }
    return (a.length - lo) / a.length;
  }

  // dist = window.DCF_BASE_RATES. metric: "fcf" | "rev". revenueNow: 현재 매출(시장 통화). gDec: 소수.
  // 가장 긴 기간부터, 그 규모 구간 표본이 minN 이상이면 그 구간, 아니면 전체 규모, 그래도 부족하면 insufficient.
  function baseRate(dist, market, revenueNow, gDec, metric, minN) {
    const m = dist && dist.markets && dist.markets[market];
    const need = minN || 20;
    const key = metric || "fcf";
    if (!m || !m.horizons) return { ok: false, reason: "기저율 분포가 없습니다" };
    const hs = Object.keys(m.horizons).map(Number).sort((a, b) => b - a);
    const buckets = m.buckets || [];
    const bi = buckets.findIndex((b) => (b.min == null || revenueNow >= b.min) && (b.max == null || revenueNow < b.max));
    for (const h of hs) {
      const H = m.horizons[String(h)];
      if (!H) continue;
      const cand = [];
      if (bi >= 0 && H.buckets && H.buckets[bi]) cand.push({ arr: H.buckets[bi][key], label: buckets[bi].label, sized: true });
      cand.push({ arr: H.all && H.all[key], label: "전체 규모", sized: false });
      for (const c of cand) {
        if (Array.isArray(c.arr) && c.arr.length >= need) {
          return {
            ok: true, horizon: h, n: c.arr.length, bucket: c.label, sized: c.sized, metric: key,
            fraction: fractionAtLeast(c.arr, gDec * 100),
            median: c.arr[Math.floor((c.arr.length - 1) / 2)],
            period: H.period || null,
            excluded: (c.sized ? H.buckets[bi] : H.all)[`${key}Excluded`] || 0,
          };
        }
      }
    }
    return { ok: false, reason: `표본이 ${need}개 미만이라 기저율을 내지 않습니다` };
  }

  // ── URL/저장 인코딩 ── "r,tg|g1,g2,m,t,re|...|..." (% 단위, 소수 1~2자리)
  const ORDER = ["bear", "base", "bull"];
  const FIELDS = ["g1", "g2", "margin", "tax", "reinvest"];
  function pct(v) { return String(round(v * 100, 2)); }
  function encodeState(state) {
    if (!state || !state.scenarios) return "";
    const head = [pct(state.r), pct(state.tg)].join(",");
    const body = ORDER.map((k) => FIELDS.map((f) => pct(state.scenarios[k][f])).join(","));
    return [head, ...body].join("|");
  }
  function decodeState(str) {
    if (typeof str !== "string" || !str) return null;
    const parts = str.split("|");
    if (parts.length !== 4) return null;
    const nums = (p, n) => {
      const v = p.split(",").map(Number);
      return v.length === n && v.every(Number.isFinite) ? v.map((x) => x / 100) : null;
    };
    const head = nums(parts[0], 2);
    if (!head) return null;
    const scenarios = {};
    for (let i = 0; i < 3; i++) {
      const v = nums(parts[i + 1], 5);
      if (!v) return null;
      const s = {};
      FIELDS.forEach((f, j) => { s[f] = v[j]; });
      if (!(s.tax >= 0 && s.tax < 1 && s.reinvest >= 0 && s.reinvest < 1.5 && s.g1 > -1 && s.g2 > -1)) return null;
      scenarios[ORDER[i]] = s;
    }
    if (!(head[0] > head[1]) || head[0] > 0.5) return null;
    return { r: head[0], tg: head[1], scenarios };
  }

  const api = {
    ERP, FALLBACK_DISCOUNT, DEFAULT_TERMINAL, YEARS, DEFAULT_TAX,
    pvGrowth, impliedGrowth, baseFcfOptions, dilutedShares, netDebtOf, eligibility, defaultDiscount,
    reverseDcf, scenarioValue, sensitivityGrid, defaultScenarios, cagr, fractionAtLeast, baseRate,
    encodeState, decodeState,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MirDcfCore = api;
})(typeof window !== "undefined" ? window : globalThis);
