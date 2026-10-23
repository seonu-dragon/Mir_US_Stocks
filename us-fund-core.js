// 미국 펀더멘털 카드 3종 — 순수 계산 모듈(DOM 없음). 입력은 scripts/financials_common.py 스키마 1 의 US 종목 파일
// (build_financials_us.py 가 붙이는 debtMaturity · payVsPerf 포함) + 상세 일봉(chartSeries).
// 브라우저에서는 window.MirUsFundCore, node 테스트(scripts/tests/test_us_fund_core.mjs)에서는 module.exports.
// IIFE 라 최상위 이름을 전역에 흘리지 않는다. 화면은 us-fund.js.
//
// 1) 부채 만기 사다리 — 10-K 장기차입금 원금 상환 예정표(LongTermDebtMaturitiesRepaymentsOfPrincipal…) 그대로.
//    1년 이내 비중 = 1년 이내 ÷ 공시된 버킷 합. 현금 대비 = 같은 기말 현금 ÷ 1년 이내 상환액.
// 2) Pay vs Performance — DEF 14A ecd 공시값 그대로(대표이사 보수총액·실지급보상·회사/동종 TSR). 계산하지 않는다.
// 3) ROIC − WACC (모두 최근 회계연도 연간 행 기준. 구성요소가 하나라도 없으면 WACC·스프레드는 null)
//    - ROIC  = NOPAT ÷ 투하자본. NOPAT = 영업이익 × (1 − 실효세율), 실효세율 = 법인세 ÷ 세전이익(0~50% 일 때만),
//              투하자본 = 총차입금 + 자본총계 − 현금(기초·기말 평균). financials-core.js roic 와 같은 함수.
//    - 자기자본비용 Ke = 무위험금리(미 국채 10년) + 베타 × 주식위험프리미엄(ERP, 화면에서 바꿀 수 있다)
//    - 베타  = 최근 104주 주간 수익률(주의 마지막 거래일 종가, 배당 제외)로 종목 대 SPY 회귀 기울기. 78주 미만이면 null.
//    - 세전 타인자본비용 Kd = 이자비용 ÷ 총차입금(기초·기말 평균). 0 초과 25% 이하만 — 밖이면 태그 차이로 보고 null.
//    - 가중치 = 시가총액 E, 총차입금 D(장부가). WACC = E/(D+E)·Ke + D/(D+E)·Kd·(1 − 실효세율).
//      총차입금이 0 이면 WACC = Ke(Kd·세율 불필요).
//    - 스프레드 = ROIC − WACC. 어느 쪽이 무엇을 뜻하는지 판정하지 않는다(수치만).
(function (root) {
  "use strict";

  const fin = (root && root.MirFinCore) || (typeof require === "function" ? require("./financials-core.js") : null);

  const DEFAULT_ERP = 0.05;          // ERP 상수를 못 받았을 때만(화면에 값 표시 · 사용자가 바꿀 수 있다)
  const BETA_WEEKS = 104;
  const BETA_MIN_WEEKS = 78;
  const KD_MAX = 0.25;
  const LADDER = [
    ["y1", "1년 이내"], ["y2", "2년차"], ["y3", "3년차"], ["y4", "4년차"], ["y5", "5년차"], ["after", "5년 이후"],
  ];

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  // ── 1) 부채 만기 사다리 ──
  function debtLadder(file) {
    const dm = file && file.market === "us" ? file.debtMaturity : null;
    if (!dm || typeof dm !== "object") return null;
    const buckets = LADDER.filter(([k]) => num(dm[k]) !== null).map(([k, label]) => ({ key: k, label, value: Math.max(0, dm[k]) }));
    if (buckets.length < 2) return null;
    const total = buckets.reduce((s, b) => s + b.value, 0);
    if (!(total > 0)) return null;
    const y1 = num(dm.y1);
    const row = (file.annual || []).find((r) => r.end === dm.end) || null;
    const cash = row ? num(row.cash) : null;
    return {
      end: dm.end, fy: dm.fy, filed: dm.filed || null,
      buckets: buckets.map((b) => ({ ...b, share: b.value / total })),
      total,
      missing: LADDER.filter(([k]) => num(dm[k]) === null).map(([, label]) => label),
      y1, y1Share: y1 !== null ? y1 / total : null,
      cash, cashToY1: cash !== null && y1 !== null && y1 > 0 ? cash / y1 : null,
      // 금융업은 현금·차입금이 영업 자산·부채라 '현금 대비' 비교를 화면에서 뺀다(표는 그대로).
      financial: (file.flags || []).includes("financial"),
    };
  }

  // ── 2) Pay vs Performance ──
  const PVP_KEYS = ["peoTotal", "peoCap", "neoTotal", "neoCap", "tsr", "peerTsr"];
  function payVsPerf(file) {
    const rows = file && file.market === "us" && Array.isArray(file.payVsPerf) ? file.payVsPerf : [];
    const out = rows
      .filter((r) => r && r.end && ["peoTotal", "peoCap", "neoTotal", "neoCap"].some((k) => num(r[k]) !== null))
      .map((r) => {
        const o = { end: r.end, year: String(r.end).slice(0, 4), filed: r.filed || null, accn: r.accn || null };
        PVP_KEYS.forEach((k) => { o[k] = num(r[k]); });
        return o;
      })
      .sort((a, b) => (a.end < b.end ? -1 : 1))
      .slice(-5);
    if (!out.length) return null;
    const hasPeo = out.some((r) => r.peoTotal !== null || r.peoCap !== null);
    const hasPeer = out.some((r) => r.peerTsr !== null);
    const last = out[out.length - 1];
    const maxComp = Math.max(...out.flatMap((r) => [r.peoTotal, r.peoCap, r.neoTotal, r.neoCap].filter((v) => v !== null).map(Math.abs)));
    return { rows: out, hasPeo, hasPeer, filed: last.filed, accn: last.accn, maxComp: maxComp > 0 ? maxComp : null };
  }

  // ── 3) 베타 ──
  function barClose(b) {
    if (Array.isArray(b)) return { c: num(Number(b[3])), d: String(b[5] || "") };
    if (b && typeof b === "object") return { c: num(Number(b.c !== undefined ? b.c : b.close)), d: String(b.date || b.d || b.t || "") };
    return { c: null, d: "" };
  }
  // 주(월요일 날짜 UTC) → 그 주 마지막 거래일 종가.
  function weeklyCloses(bars) {
    const out = new Map();
    for (const b of bars || []) {
      const { c, d } = barClose(b);
      if (c === null || c <= 0 || !/^\d{4}-\d{2}-\d{2}/.test(d)) continue;
      const t = Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
      if (!Number.isFinite(t)) continue;
      const dow = (new Date(t).getUTCDay() + 6) % 7;      // 월=0
      const wk = new Date(t - dow * 86400000).toISOString().slice(0, 10);
      const prev = out.get(wk);
      if (!prev || prev.d <= d) out.set(wk, { d, c });
    }
    return out;
  }
  function weeklyBeta(stockBars, benchBars, opts) {
    const o = opts || {};
    const weeks = o.weeks || BETA_WEEKS;
    const minWeeks = o.minWeeks || BETA_MIN_WEEKS;
    const s = weeklyCloses(stockBars), m = weeklyCloses(benchBars);
    const keys = [...s.keys()].filter((k) => m.has(k)).sort();
    const xs = [], ys = [];
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i];
      // 이웃한 공통 주만(한쪽에 빈 주가 있으면 그 구간 수익률은 만들지 않는다)
      if ((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000 !== 7) continue;
      xs.push(m.get(b).c / m.get(a).c - 1);
      ys.push(s.get(b).c / s.get(a).c - 1);
    }
    const x = xs.slice(-weeks), y = ys.slice(-weeks);
    const n = x.length;
    if (n < minWeeks) return null;
    const mx = x.reduce((p, v) => p + v, 0) / n, my = y.reduce((p, v) => p + v, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
      syy += (y[i] - my) ** 2;
    }
    if (!(sxx > 0)) return null;
    const usedKeys = keys.slice(-(n + 1));
    return { beta: sxy / sxx, n, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 0, from: usedKeys[0], to: s.get(usedKeys[usedKeys.length - 1]).d };
  }

  // ── 3) ROIC − WACC ──
  function costOfDebt(row, prev) {
    const i = num(row && row.interest), d = num(row && row.debt);
    if (i === null || d === null || d <= 0) return null;
    const dp = prev ? num(prev.debt) : null;
    const avg = dp !== null && dp > 0 ? (d + dp) / 2 : d;
    const kd = Math.abs(i) / avg;
    return kd > 0 && kd <= KD_MAX ? kd : null;
  }

  // input: { file, marketCap(USD), beta, rfPct(10년 국채 %), erp(소수) }
  function roicWacc(input) {
    const o = input || {};
    const file = o.file;
    if (!file || file.market !== "us" || file.currency !== "USD") return null;
    if ((file.flags || []).includes("financial") || (file.industryType && file.industryType !== "general")) return null;
    const annual = file.annual || [];
    const row = annual[annual.length - 1];
    if (!row) return null;
    const prev = annual.length > 1 ? annual[annual.length - 2] : null;
    const roic = fin ? fin.roic(row, prev) : null;
    const tax = fin ? fin.effectiveTaxRate(row) : null;
    const rf = num(o.rfPct) !== null ? o.rfPct / 100 : null;
    const erp = num(o.erp) !== null ? o.erp : DEFAULT_ERP;
    // 자기자본비용엔 블룸버그식 조정 베타(0.67 × 원시 + 0.33)를 쓴다 — 원시 2년 주간 베타는 표본 기간의 우연에
    // 크게 흔들린다(2026-10 실측 KO 0.09·XOM −0.04·T 0.03 → 자기자본비용이 무위험 금리와 거의 같아진다).
    // 원시 값(rawBeta)도 함께 돌려 화면에 둘 다 보인다.
    const rawBeta = num(o.beta);
    const beta = rawBeta !== null ? 0.67 * rawBeta + 0.33 : null;
    const E = num(o.marketCap) !== null && o.marketCap > 0 ? o.marketCap : null;
    const D = num(row.debt) !== null && row.debt >= 0 ? row.debt : null;
    const noDebt = D === 0;
    const kd = noDebt ? null : costOfDebt(row, prev);
    const ke = rf !== null && beta !== null ? rf + beta * erp : null;
    let wE = null, wD = null, wacc = null;
    if (E !== null && D !== null) {
      wE = E / (E + D);
      wD = D / (E + D);
      if (ke !== null) {
        if (noDebt) wacc = ke;
        else if (kd !== null && tax !== null) wacc = wE * ke + wD * kd * (1 - tax);
      }
    }
    const spread = roic !== null && wacc !== null ? roic - wacc : null;
    return {
      fy: row.fy, end: row.end || null,
      roic, tax, rf, erp, beta, rawBeta, ke, kd, kdAfterTax: kd !== null && tax !== null ? kd * (1 - tax) : null,
      E, D, wE, wD, noDebt, wacc, spread,
      op: num(row.op), interest: num(row.interest),
    };
  }

  const api = { DEFAULT_ERP, BETA_WEEKS, BETA_MIN_WEEKS, KD_MAX, LADDER, debtLadder, payVsPerf, weeklyCloses, weeklyBeta, costOfDebt, roicWacc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirUsFundCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
