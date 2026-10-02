// 종목 상세 '월별 시즈널리티' — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirSeasonality, node 테스트(scripts/tests/test_seasonality_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
// 입력은 차트와 같은 일봉 행 [{c, d}] (오름차순, d = YYYY-MM-DD). 월 수익률 = 그 달 마지막 종가 ÷
// 직전 달 마지막 종가 − 1. 첫 달은 직전 달 종가가 없어 버리고(부분 월), 마지막 달은 asOf 가 그 달
// 안이면 '진행 중' 으로 표시만 하고 평균·상승 확률에서 뺀다.
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // 월말 종가 목록 [{ym:"YYYY-MM", c}] (오름차순). 같은 달은 마지막 행이 이긴다.
  function monthEndCloses(rows) {
    const out = [];
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r || r.synthetic) continue;
      const d = String(r.d || "").slice(0, 10);
      const c = num(r.c);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || c === null || c <= 0) continue;
      const ym = d.slice(0, 7);
      if (out.length && out[out.length - 1].ym === ym) out[out.length - 1] = { ym, c, d };
      else if (!out.length || out[out.length - 1].ym < ym) out.push({ ym, c, d });
    }
    return out;
  }

  function median(xs) {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // opts.asOf: "YYYY-MM-DD" — 이 날짜가 속한 달은 아직 끝나지 않은 달(진행 중). 없으면 마지막 행 날짜의 달.
  // opts.minYears: 요약을 낼 최소 표본 수(달별). 기본 2.
  // 반환: { years:[{year, months:[{pct, partial}|null ×12], total}], summary:[{month, avg, median, winRate, n}×12],
  //        firstMonth, lastMonth, yearsCount } — 데이터가 부족하면 null.
  function compute(rows, opts) {
    const o = opts || {};
    const ends = monthEndCloses(rows);
    if (ends.length < 3) return null;
    const lastD = ends[ends.length - 1].d;
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(o.asOf || "")) ? String(o.asOf) : lastD;
    const openYm = asOf.slice(0, 7);
    // 마지막 달이 월말까지 거래됐는지는 알 수 없으므로, asOf 의 달과 같으면 진행 중으로 본다.
    const byYear = new Map();
    for (let i = 1; i < ends.length; i += 1) {
      const prev = ends[i - 1];
      const cur = ends[i];
      // 달이 비면(거래정지 등) 그 구간은 여러 달 수익률이라 버린다.
      const [py, pm] = prev.ym.split("-").map(Number);
      const [cy, cm] = cur.ym.split("-").map(Number);
      if ((cy - py) * 12 + (cm - pm) !== 1) continue;
      const pct = (cur.c / prev.c - 1) * 100;
      if (!byYear.has(cy)) byYear.set(cy, new Array(12).fill(null));
      byYear.get(cy)[cm - 1] = { pct, partial: cur.ym === openYm };
    }
    if (!byYear.size) return null;
    const years = [...byYear.keys()].sort((a, b) => b - a).map((year) => {
      const months = byYear.get(year);
      let acc = 1;
      let any = false;
      for (const m of months) {
        if (m) { acc *= 1 + m.pct / 100; any = true; }
      }
      return { year, months, total: any ? (acc - 1) * 100 : null };
    });
    const minN = Number.isFinite(o.minYears) ? o.minYears : 2;
    const summary = [];
    for (let k = 0; k < 12; k += 1) {
      const xs = [];
      for (const y of years) {
        const m = y.months[k];
        if (m && !m.partial) xs.push(m.pct);
      }
      const n = xs.length;
      summary.push({
        month: k + 1,
        n,
        avg: n >= minN ? xs.reduce((a, b) => a + b, 0) / n : null,
        median: n >= minN ? median(xs) : null,
        winRate: n >= minN ? (xs.filter((x) => x > 0).length / n) * 100 : null,
      });
    }
    return {
      years,
      summary,
      firstMonth: ends[1].ym,
      lastMonth: ends[ends.length - 1].ym,
      yearsCount: years.length,
    };
  }

  // 셀 배경 세기(0~1). 월 수익률 ±cap% 에서 포화.
  function heat(pct, cap) {
    const p = num(pct);
    if (p === null) return 0;
    const c = num(cap) || 10;
    return Math.min(1, Math.abs(p) / c);
  }

  function fmtPct(p, digits) {
    const v = num(p);
    if (v === null) return "—";
    const d = Number.isFinite(digits) ? digits : 1;
    const s = v.toFixed(d);
    if (Number(s) === 0) return (0).toFixed(d); // −0.04 → "-0.0" 대신 "0.0"
    return v > 0 ? `+${s}` : s;
  }

  const api = { compute, monthEndCloses, heat, fmtPct, median };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirSeasonality = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
