// 재무 확장 — 순수 계산 모듈(DOM 없음). 입력은 scripts/financials_common.py 스키마 1 의 종목 파일.
// 브라우저에서는 window.MirFinCore, node 테스트(scripts/tests/test_financials_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 파생 지표 정의(화면 각주와 같은 문장 — 바꾸면 financials.js FIN_DEFS 도 같이)
// - FCF          = 영업활동현금흐름(ocf) − 설비투자(capex, 유출 크기)
// - FCF 마진     = FCF ÷ 매출
// - ROIC         = NOPAT ÷ 투하자본. NOPAT = 영업이익 × (1 − 실효세율), 실효세율 = 법인세 ÷ 세전이익
//                  (세전이익 > 0 이고 0~50% 안일 때만 — 밖이면 결측). 투하자본 = 자본총계 + 총차입금 − 현금,
//                  기초·기말 평균(기초가 없으면 기말). 분모 ≤ 0 이면 결측.
// - 순차입금/EBITDA = (총차입금 − 현금) ÷ (영업이익 + 감가상각비). EBITDA ≤ 0 이면 결측.
// - 주식수 증감률 = 가중평균 희석 주식수의 전년 대비 변화(연간: 전년 행, TTM: 4분기 전 분기 대비).
//                  희석 주식수가 없으면 기말 발행주식수로 계산하고 basis 를 "basic" 으로 표시.
// - SBC/매출     = 주식보상비용 ÷ 매출
// - 이익의 질    = FCF ÷ 순이익 (순이익 > 0 일 때만)
// 결측 원천이 하나라도 있으면 결과도 null 이다(추정해서 채우지 않는다).
(function (root) {
  "use strict";

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  function div(a, b) {
    const x = num(a), y = num(b);
    if (x === null || y === null || y === 0) return null;
    return x / y;
  }

  function daysBetween(a, b) {
    const ta = Date.parse(`${a}T00:00:00Z`), tb = Date.parse(`${b}T00:00:00Z`);
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
    return Math.round((tb - ta) / 86400000);
  }

  // financials_common.quarters_consecutive 와 같은 규칙.
  function quartersConsecutive(prev, next) {
    if (!prev || !next) return false;
    if (prev.end && next.end) {
      const d = daysBetween(prev.end, next.end);
      return d !== null && d >= 75 && d <= 105;
    }
    const a = Number(prev.fy) * 4 + Number(prev.fq);
    const b = Number(next.fy) * 4 + Number(next.fq);
    return Number.isFinite(a) && Number.isFinite(b) && b - a === 1;
  }

  function periodLabel(row, kind) {
    if (!row) return "";
    if (kind === "ttm") return row.basis === "4Q" ? `TTM ${row.fy} ${row.fq}Q` : `FY${row.fy}`;
    if (row.fq) return `${String(row.fy).slice(-2)}.${row.fq}Q`;
    return `FY${row.fy}`;
  }

  // 분기별 TTM 시계열: 각 점 = 그 분기 포함 최근 4개 연속 분기 합(흐름 값). 결측·비연속이면 그 점은 건너뛴다.
  // US PER 밴드용: ttmSeries(file.quarterly, "epsDil").
  function ttmSeries(quarterly, key) {
    const q = Array.isArray(quarterly) ? quarterly : [];
    const out = [];
    for (let i = 3; i < q.length; i++) {
      const win = q.slice(i - 3, i + 1);
      let ok = true;
      for (let j = 0; j < 3; j++) if (!quartersConsecutive(win[j], win[j + 1])) ok = false;
      if (!ok) continue;
      const vals = win.map((r) => num(r[key]));
      if (vals.some((v) => v === null)) continue;
      let value = vals.reduce((s, v) => s + v, 0);
      if (key === "sharesDilAvg") value /= 4;
      if (key === "epsDil") value = Math.round(value * 10000) / 10000;
      out.push({
        fy: win[3].fy, fq: win[3].fq, end: win[3].end || null, value,
        derived: win.some((r) => Array.isArray(r.d) && r.d.includes(key)),
      });
    }
    return out;
  }

  function effectiveTaxRate(row) {
    const pre = num(row && row.pretax), tax = num(row && row.tax);
    if (pre === null || tax === null || pre <= 0) return null;
    const r = tax / pre;
    return r >= 0 && r <= 0.5 ? r : null;
  }

  function investedCapital(row) {
    const e = num(row && row.equity), d = num(row && row.debt), c = num(row && row.cash);
    if (e === null || d === null || c === null) return null;
    return e + d - c;
  }

  function roic(row, prevRow) {
    const op = num(row && row.op);
    const t = effectiveTaxRate(row);
    const icEnd = investedCapital(row);
    if (op === null || t === null || icEnd === null) return null;
    const icBeg = prevRow ? investedCapital(prevRow) : null;
    const ic = icBeg !== null ? (icBeg + icEnd) / 2 : icEnd;
    if (ic <= 0) return null;
    return (op * (1 - t)) / ic;
  }

  function fcfOf(row) {
    if (!row) return null;
    if (num(row.fcf) !== null) return row.fcf;
    const o = num(row.ocf), c = num(row.capex);
    return o !== null && c !== null ? o - c : null;
  }

  function netDebtOf(row) {
    if (!row) return null;
    if (num(row.netDebt) !== null) return row.netDebt;
    const d = num(row.debt), c = num(row.cash);
    return d !== null && c !== null ? d - c : null;
  }

  function netDebtToEbitda(row) {
    const nd = netDebtOf(row);
    const op = num(row && row.op), da = num(row && row.da);
    if (nd === null || op === null || da === null) return null;
    const ebitda = op + da;
    return ebitda > 0 ? nd / ebitda : null;
  }

  function shareChange(row, prevRow) {
    if (!row || !prevRow) return { value: null, basis: null };
    const dil = div(num(row.sharesDilAvg), num(prevRow.sharesDilAvg));
    if (dil !== null) return { value: dil - 1, basis: "diluted" };
    const basic = div(num(row.sharesOut), num(prevRow.sharesOut));
    if (basic !== null) return { value: basic - 1, basis: "basic" };
    return { value: null, basis: null };
  }

  function earningsQuality(row) {
    const n = num(row && row.net), f = fcfOf(row);
    if (n === null || f === null || n <= 0) return null;
    return f / n;
  }

  // 한 기간의 파생 지표. prevRow = 전년(연간) 행 / TTM 이면 4분기 전 분기 행(주식수 비교용)과 전년 말 행.
  function metricsFor(row, prevRow, opts) {
    const o = opts || {};
    const fcf = fcfOf(row);
    const sc = shareChange(row, o.sharesPrev !== undefined ? o.sharesPrev : prevRow);
    return {
      fcf,
      fcfMargin: div(fcf, num(row && row.rev)),
      opMargin: div(num(row && row.op), num(row && row.rev)),
      netMargin: div(num(row && row.net), num(row && row.rev)),
      roic: roic(row, o.balancePrev === undefined ? prevRow : o.balancePrev),
      netDebt: netDebtOf(row),
      netDebtToEbitda: netDebtToEbitda(row),
      shareChange: sc.value,
      shareChangeBasis: sc.basis,
      sbcToRevenue: div(num(row && row.sbc), num(row && row.rev)),
      earningsQuality: earningsQuality(row),
      currentRatio: div(num(row && row.curAssets), num(row && row.curLiab)),
    };
  }

  // 금융업·해외발행인은 FCF·순차입금·ROIC 가 뜻이 달라 표시에서 뺀다(값은 파일에 그대로 있다).
  function suppressedMetrics(file) {
    const flags = (file && file.flags) || [];
    const out = new Set();
    if (flags.includes("financial")) {
      ["fcf", "fcfMargin", "roic", "netDebt", "netDebtToEbitda", "earningsQuality", "currentRatio"].forEach((k) => out.add(k));
    }
    return out;
  }

  // 화면 표: 최근 연간 n개 + TTM(분기 4개가 연속일 때만 — basis FY 면 연간과 중복이라 뺀다).
  function derivedMetrics(file, n) {
    const annual = (file && Array.isArray(file.annual)) ? file.annual : [];
    const quarterly = (file && Array.isArray(file.quarterly)) ? file.quarterly : [];
    const count = n || 5;
    const cols = [];
    const start = Math.max(0, annual.length - count);
    for (let i = start; i < annual.length; i++) {
      const row = annual[i];
      const prev = i > 0 && Number(annual[i - 1].fy) === Number(row.fy) - 1 ? annual[i - 1] : null;
      cols.push({ key: `A${row.fy}`, kind: "annual", label: periodLabel(row, "annual"), row, metrics: metricsFor(row, prev) });
    }
    const ttm = file && file.ttm;
    if (ttm && ttm.basis === "4Q") {
      const lastQ = quarterly[quarterly.length - 1];
      const yearAgo = quarterly.length >= 5 ? quarterly[quarterly.length - 5] : null;
      const sharesPrev = yearAgo && lastQ && Number(yearAgo.fq) === Number(lastQ.fq) ? yearAgo : null;
      // ROIC 기초 투하자본: 1년 전 분기말 잔액
      const m = metricsFor(ttm, null, { sharesPrev: null, balancePrev: sharesPrev || null });
      // 주식수는 '최근 분기 vs 1년 전 같은 분기'(TTM 평균끼리가 아니라 같은 길이 기간끼리 비교)
      const sc = shareChange(lastQ, sharesPrev);
      m.shareChange = sc.value;
      m.shareChangeBasis = sc.basis;
      cols.push({ key: "TTM", kind: "ttm", label: periodLabel(ttm, "ttm"), row: ttm, metrics: m });
    }
    return { cols, suppressed: suppressedMetrics(file) };
  }

  // 차트 시리즈: kind "annual" | "quarterly", keys = 필드 이름 목록. 결측은 null 그대로.
  function series(file, kind, keys) {
    const rows = (file && Array.isArray(file[kind])) ? file[kind] : [];
    return rows.map((r) => {
      const d = Array.isArray(r.d) ? r.d.slice() : [];
      // 원천이 산출값이면 그로부터 계산한 값도 산출로 표시한다.
      if (d.includes("ocf") || d.includes("capex")) d.push("fcf", "fcfMargin");
      if (d.includes("op") || d.includes("rev")) d.push("opMargin");
      if (d.includes("rev")) d.push("fcfMargin");
      const point = { label: periodLabel(r, kind), fy: r.fy, fq: r.fq || null, end: r.end || null, derived: d };
      keys.forEach((k) => {
        if (k === "opMargin") point[k] = div(num(r.op), num(r.rev));
        else if (k === "fcfMargin") point[k] = div(fcfOf(r), num(r.rev));
        else if (k === "fcf") point[k] = fcfOf(r);
        else if (k === "netDebt") point[k] = netDebtOf(r);
        else point[k] = num(r[k]);
      });
      return point;
    });
  }

  function isDerived(row, key) {
    return !!(row && Array.isArray(row.d) && row.d.includes(key));
  }

  const api = {
    num,
    daysBetween,
    quartersConsecutive,
    periodLabel,
    ttmSeries,
    effectiveTaxRate,
    investedCapital,
    roic,
    fcfOf,
    netDebtOf,
    netDebtToEbitda,
    shareChange,
    earningsQuality,
    metricsFor,
    suppressedMetrics,
    derivedMetrics,
    series,
    isDerived,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirFinCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
