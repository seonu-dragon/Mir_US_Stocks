// 종목 › 비교 — 순수 계산 모듈(DOM 없음). 화면은 compare-board.js.
// 브라우저에서는 window.MirCompareCore, node 테스트(scripts/tests/test_compare_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 정의
// - 기간 수익률(겹쳐 보기): 기준일 = 비교 종목들 중 가장 늦은 마지막 봉 날짜. 시작일 = 기준일에서
//   기간만큼 뺀 날(YTD 는 전년 12-31). 종목마다 '시작일 당일 또는 그 이전 마지막 봉' 종가를 0% 로 둔다.
//   그 날보다 앞선 봉이 없으면(상장이 늦음) 첫 봉을 0% 로 두고 lateStart=true 로 표시한다.
// - 표의 6개월·1년·YTD: 같은 규칙을 종목 자신의 마지막 봉 기준으로. lateStart 면 null(기간을 다 못 채움).
// - 재무: 매출 · 영업이익률(영업이익÷매출) · 순이익률(순이익÷매출) · 희석 EPS · FCF(영업CF−설비투자) ·
//   ROE(순이익÷자본총계, 직전 연도가 있으면 기초·기말 평균 — 연간만). 원천이 하나라도 없으면 null.
(function (root) {
  "use strict";

  const PERIODS = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "YTD"];
  const PERIOD_MONTHS = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };
  const MAX_TICKERS = 8;

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function isIso(d) {
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  }

  // 일봉 → [{d, c}] 날짜 오름차순. 상세 파일 chartSeries([o,h,l,c,v,date]) 와 {date|d, close|c} 둘 다 받는다.
  function toBars(series) {
    const out = [];
    (Array.isArray(series) ? series : []).forEach((row) => {
      let d = null;
      let c = null;
      if (Array.isArray(row)) {
        d = row[5];
        c = num(row[3]);
      } else if (row && typeof row === "object") {
        d = row.date || row.d || row.time;
        c = num(row.close !== undefined ? row.close : row.c);
      }
      d = typeof d === "string" ? d.slice(0, 10) : null;
      if (isIso(d) && c !== null && c > 0) out.push({ d, c });
    });
    out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    // 같은 날짜가 둘이면 뒤의 값(더 최근 수집분)을 쓴다.
    const dedup = [];
    out.forEach((b) => {
      if (dedup.length && dedup[dedup.length - 1].d === b.d) dedup[dedup.length - 1] = b;
      else dedup.push(b);
    });
    return dedup;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // 달 단위로 뺀다(일은 그 달 말일로 클램프): 2026-03-31 − 1M = 2026-02-28.
  function addMonths(iso, months) {
    if (!isIso(iso)) return null;
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7)) - 1;
    const day = Number(iso.slice(8, 10));
    const total = y * 12 + m + months;
    const ny = Math.floor(total / 12);
    const nm = total - ny * 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return `${ny}-${pad2(nm + 1)}-${pad2(Math.min(day, last))}`;
  }

  function periodStartDate(refIso, period) {
    if (!isIso(refIso)) return null;
    if (period === "YTD") return `${Number(refIso.slice(0, 4)) - 1}-12-31`;
    const months = PERIOD_MONTHS[period];
    return months ? addMonths(refIso, -months) : null;
  }

  // startIso 당일 또는 그 이전의 마지막 봉 인덱스. 없으면 -1.
  function baseIndex(bars, startIso) {
    let lo = 0;
    let hi = bars.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (bars[mid].d <= startIso) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  // 시작일 기준으로 0% 재기준화. bars 는 toBars 결과.
  function rebase(bars, startIso) {
    if (!bars.length || !isIso(startIso)) return null;
    let i = baseIndex(bars, startIso);
    let lateStart = false;
    if (i < 0) { i = 0; lateStart = true; }
    const base = bars[i];
    const points = [];
    for (let k = i; k < bars.length; k++) points.push({ d: bars[k].d, pct: (bars[k].c / base.c - 1) * 100 });
    return { baseDate: base.d, lateStart, points };
  }

  // list: [{ key, series }] → 같은 날짜 축에 놓인 재기준 수익률.
  // dates = 모든 종목 날짜의 합집합. 값은 그 종목 자신의 첫 날~마지막 날 사이에서만 직전 값으로 이어 간다
  // (상장 전·마지막 봉 이후는 null — 없는 값을 만들지 않는다).
  function alignReturns(list, period, refOverride) {
    const prepared = (Array.isArray(list) ? list : []).map((x) => ({ key: x && x.key, bars: toBars(x && x.series) }));
    const lasts = prepared.filter((p) => p.bars.length).map((p) => p.bars[p.bars.length - 1].d);
    if (!lasts.length) return { ref: null, start: null, dates: [], series: prepared.map((p) => ({ key: p.key, values: [], empty: true })) };
    const ref = isIso(refOverride) ? refOverride : lasts.sort().slice(-1)[0];
    const start = periodStartDate(ref, period);
    const rebased = prepared.map((p) => {
      const bars = p.bars.filter((b) => b.d <= ref);
      return { key: p.key, rb: rebase(bars, start) };
    });
    const dateSet = new Set();
    rebased.forEach((r) => { if (r.rb) r.rb.points.forEach((pt) => dateSet.add(pt.d)); });
    const dates = [...dateSet].sort();
    const series = rebased.map((r) => {
      if (!r.rb || !r.rb.points.length) return { key: r.key, values: dates.map(() => null), empty: true };
      const m = new Map(r.rb.points.map((pt) => [pt.d, pt.pct]));
      const first = r.rb.points[0].d;
      const lastD = r.rb.points[r.rb.points.length - 1].d;
      let carry = null;
      const values = dates.map((d) => {
        if (d < first || d > lastD) return null;
        if (m.has(d)) carry = m.get(d);
        return carry;
      });
      const lastPt = r.rb.points[r.rb.points.length - 1];
      return { key: r.key, values, empty: false, baseDate: r.rb.baseDate, lateStart: r.rb.lateStart, lastDate: lastD, last: lastPt.pct };
    });
    return { ref, start, dates, series };
  }

  // 종목 자신의 마지막 봉 기준 기간 수익률(%). 기간을 다 못 채우면 null.
  function trailingReturn(series, period) {
    const bars = toBars(series);
    if (bars.length < 2) return null;
    const last = bars[bars.length - 1];
    const start = periodStartDate(last.d, period);
    const i = baseIndex(bars, start);
    if (i < 0 || i === bars.length - 1) return null;
    return (last.c / bars[i].c - 1) * 100;
  }

  // 값 목록에서 최고·최저 인덱스(동률이면 앞의 것) + 같은 값을 가진 인덱스 전부(hiAll·loAll).
  // 유한값이 opts.minCount(기본 2)개 미만이거나 전부 같으면 -1·빈 배열.
  // opts.positiveOnly: 0 이하 값은 후보에서 뺀다(음수 PER 같은 뜻 없는 배수).
  function extremes(values, opts) {
    const o = opts || {};
    let hi = -1;
    let lo = -1;
    let count = 0;
    (values || []).forEach((v, i) => {
      const n = num(v);
      if (n === null) return;
      if (o.positiveOnly && n <= 0) return;
      count += 1;
      if (hi < 0 || n > num(values[hi])) hi = i;
      if (lo < 0 || n < num(values[lo])) lo = i;
    });
    if (count < Math.max(2, o.minCount || 2) || num(values[hi]) === num(values[lo])) return { hi: -1, lo: -1, hiAll: [], loAll: [] };
    const hv = num(values[hi]);
    const lv = num(values[lo]);
    const hiAll = [];
    const loAll = [];
    (values || []).forEach((v, i) => {
      const n = num(v);
      if (n === null || (o.positiveOnly && n <= 0)) return;
      if (n === hv) hiAll.push(i);
      if (n === lv) loAll.push(i);
    });
    return { hi, lo, hiAll, loAll };
  }

  // 정렬 순서(인덱스 배열). dir "desc"|"asc", 결측은 항상 뒤, 같은 값은 원래 순서.
  function sortOrder(values, dir) {
    const idx = (values || []).map((v, i) => i);
    const sign = dir === "asc" ? 1 : -1;
    return idx.sort((a, b) => {
      const va = num(values[a]);
      const vb = num(values[b]);
      if (va === null && vb === null) return a - b;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (va === vb) return a - b;
      return (va - vb) * sign;
    });
  }

  // ?cmp= 값 → 토큰 목록(중복 제거, 최대 max). 티커에 쓰이는 글자만 남긴다.
  function parseTickerParam(raw, max) {
    const limit = max || MAX_TICKERS;
    const seen = new Set();
    const out = [];
    String(raw || "").split(",").forEach((tok) => {
      const t = tok.trim().replace(/[^0-9A-Za-z.^_-]/g, "").toUpperCase();
      if (!t || seen.has(t) || out.length >= limit) return;
      seen.add(t);
      out.push(t);
    });
    return out;
  }

  // 축 눈금: 1·2·5 × 10^k 간격.
  function niceTicks(min, max, count) {
    let a = num(min);
    let b = num(max);
    if (a === null || b === null) return { lo: 0, hi: 1, ticks: [0, 1] };
    if (a > b) { const t = a; a = b; b = t; }
    if (a === b) { const pad = Math.abs(a) * 0.05 || 1; a -= pad; b += pad; }
    const n = Math.max(2, count || 5);
    const raw = (b - a) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(a / step) * step;
    const hi = Math.ceil(b / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : Number(v.toPrecision(12)));
    return { lo, hi, ticks, step };
  }

  // ===== 재무 시계열 =====
  const FIN_METRICS = [
    { key: "rev", label: "매출", type: "money" },
    { key: "opMargin", label: "영업이익률", type: "pct" },
    { key: "netMargin", label: "순이익률", type: "pct" },
    { key: "epsDil", label: "EPS(희석)", type: "eps" },
    { key: "fcf", label: "FCF", type: "money" },
    { key: "roe", label: "ROE", type: "pct", annualOnly: true },
  ];

  function fcfOf(row) {
    const direct = num(row && row.fcf);
    if (direct !== null) return direct;
    const ocf = num(row && row.ocf);
    const capex = num(row && row.capex);
    return ocf !== null && capex !== null ? ocf - Math.abs(capex) : null;
  }

  function ratioPct(a, b) {
    const x = num(a);
    const y = num(b);
    if (x === null || y === null || y === 0) return null;
    return (x / y) * 100;
  }

  function finValue(row, metric, prevRow, opts) {
    const o = opts || {};
    if (!row) return null;
    switch (metric) {
      case "rev": return num(row.rev);
      case "opMargin": return num(row.rev) !== null && num(row.rev) > 0 ? ratioPct(row.op, row.rev) : null;
      case "netMargin": return num(row.rev) !== null && num(row.rev) > 0 ? ratioPct(row.net, row.rev) : null;
      case "epsDil": return num(row.epsDil);
      case "fcf": return o.financial ? null : fcfOf(row);
      case "roe": {
        const eq = num(row.equity);
        const prevEq = num(prevRow && prevRow.equity);
        const denom = eq !== null && prevEq !== null ? (eq + prevEq) / 2 : eq;
        if (denom === null || denom <= 0) return null;
        return ratioPct(row.net, denom);
      }
      default: return null;
    }
  }

  // 분기 행 → 달력 분기(결산이 9월인 회사도 같은 축에 놓으려고). end 가 없으면(국내 DART) fy·fq 그대로.
  // 52/53주 결산이 다음 달 초(1~10일)로 넘어간 경우는 전달로 본다.
  function calendarQuarter(row) {
    if (row && isIso(row.end)) {
      let y = Number(row.end.slice(0, 4));
      let m = Number(row.end.slice(5, 7));
      const d = Number(row.end.slice(8, 10));
      if (d <= 10) { m -= 1; if (m === 0) { m = 12; y -= 1; } }
      return { y, q: Math.ceil(m / 3) };
    }
    const y = Number(row && row.fy);
    const q = Number(row && row.fq);
    return Number.isFinite(y) && q >= 1 && q <= 4 ? { y, q } : null;
  }

  function fiscalLabel(row, kind) {
    if (!row) return "";
    if (kind === "quarterly") return `FY${String(row.fy).slice(-2)} ${row.fq}Q`;
    return `FY${row.fy}`;
  }

  // files: [{ key, file }] (file = financials_common 스키마 1, 없으면 null)
  // → { periods: [{ id, label }], series: [{ key, values, meta, currency }], any }
  // 연간 축 = 회계연도(fy), 분기 축 = 달력 분기. limit = 최근 몇 개 기간.
  function finMatrix(files, kind, metric, limit) {
    const k = kind === "quarterly" ? "quarterly" : "annual";
    const def = FIN_METRICS.find((m) => m.key === metric);
    const rowsByTicker = (files || []).map((f) => {
      const file = f && f.file;
      const rows = file && Array.isArray(file[k]) ? file[k] : [];
      const financial = !!(file && Array.isArray(file.flags) && file.flags.includes("financial"));
      const byId = new Map();
      if (!(def && def.annualOnly && k === "quarterly")) {
        rows.forEach((row, i) => {
          let id = null;
          let label = "";
          if (k === "annual") {
            const fy = Number(row.fy);
            if (!Number.isFinite(fy)) return;
            id = fy;
            label = `FY${fy}`;
          } else {
            const cq = calendarQuarter(row);
            if (!cq) return;
            id = cq.y * 4 + (cq.q - 1);
            label = `${cq.y} Q${cq.q}`;
          }
          const prev = k === "annual" && i > 0 && Number(rows[i - 1].fy) === Number(row.fy) - 1 ? rows[i - 1] : null;
          const v = finValue(row, metric, prev, { financial });
          if (v === null) return;
          byId.set(id, { v, label, fiscal: fiscalLabel(row, k) });
        });
      }
      return { key: f && f.key, currency: (file && file.currency) || null, byId };
    });
    const ids = new Set();
    rowsByTicker.forEach((r) => r.byId.forEach((_, id) => ids.add(id)));
    const sorted = [...ids].sort((a, b) => a - b).slice(-(limit || (k === "annual" ? 8 : 12)));
    const labelOf = (id) => {
      for (const r of rowsByTicker) if (r.byId.has(id)) return r.byId.get(id).label;
      return String(id);
    };
    const periods = sorted.map((id) => ({ id, label: labelOf(id) }));
    const series = rowsByTicker.map((r) => ({
      key: r.key,
      currency: r.currency,
      values: sorted.map((id) => (r.byId.has(id) ? r.byId.get(id).v : null)),
      meta: sorted.map((id) => (r.byId.has(id) ? r.byId.get(id).fiscal : null)),
    }));
    const any = series.some((s) => s.values.some((v) => v !== null));
    return { periods, series, any };
  }

  // 표 → CSV 행. cells 는 이미 글자로 만든 값. 앞에 머리 행.
  function csvRows(header, rows) {
    return [header.slice(), ...rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))))];
  }

  const api = {
    PERIODS,
    MAX_TICKERS,
    FIN_METRICS,
    num,
    toBars,
    addMonths,
    periodStartDate,
    baseIndex,
    rebase,
    alignReturns,
    trailingReturn,
    extremes,
    sortOrder,
    parseTickerParam,
    niceTicks,
    fcfOf,
    finValue,
    calendarQuarter,
    finMatrix,
    csvRows,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirCompareCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
