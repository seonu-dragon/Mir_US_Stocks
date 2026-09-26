// 국내 증시자금·투자자 동향 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirKrFlowCore, node 테스트(scripts/tests/test_kr_flow_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 입력 형식(data/korea/market_funds.js · data/korea/investor_flow_daily/sNN.json):
//   funds.rows      [{ d:"YYYY-MM-DD", dep, credit, unpaid, forced, forcedPct }] 오름차순, 억 원(비중 %)
//   investors.KOSPI [{ d:"YYYY-MM-DD", ind, frn, org }] 오름차순, 억 원
//   종목 일별 샤드  daily[code] = [[YYYYMMDD, 종가, 전일대비, 개인, 외국인, 기관, 외국인 보유율]] 최신순, 수량(주)
(function (root) {
  "use strict";

  // 티커 → 샤드 번호. scripts/build_kr_investor_flow.py 의 shard_of 와 1:1 같아야 한다.
  function shardOf(code, n) {
    let h = 0;
    const s = String(code);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h % n;
  }

  function finite(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function commas(n) {
    const s = String(Math.abs(Math.round(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // 부호 붙인 정수(천 단위 쉼표): +3,189 / -14,649 / 0. 값이 없으면 "—".
  function fmtSigned(v) {
    if (!finite(v)) return "—";
    const r = Math.round(v);
    if (r === 0) return "0";
    return `${r > 0 ? "+" : "-"}${commas(r)}`;
  }

  // 부호 없는 정수(쉼표). 1 미만 소수는 소수 둘째 자리까지(반대매매 36.35억 같은 작은 값).
  function fmtPlain(v) {
    if (!finite(v)) return "—";
    if (Math.abs(v) < 100 && Math.round(v) !== v) return v.toFixed(Math.abs(v) < 10 ? 2 : 1);
    return `${v < 0 ? "-" : ""}${commas(v)}`;
  }

  function tone(v) {
    return finite(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : "";
  }

  // 최근 n 행(오름차순 유지).
  function lastN(rows, n) {
    const arr = Array.isArray(rows) ? rows : [];
    return n > 0 ? arr.slice(-n) : arr.slice();
  }

  function cumulative(vals) {
    let acc = 0;
    return vals.map((v) => (acc += finite(v) ? v : 0));
  }

  function sumKey(rows, key) {
    let s = 0;
    let hit = false;
    for (const r of rows || []) {
      if (finite(r && r[key])) { s += r[key]; hit = true; }
    }
    return hit ? s : null;
  }

  // 마지막 값과 직전 값의 차이. { last, prev, diff, date, prevDate }
  function delta(rows, key) {
    const vals = (rows || []).filter((r) => r && finite(r[key]));
    if (!vals.length) return null;
    const last = vals[vals.length - 1];
    const prev = vals.length > 1 ? vals[vals.length - 2] : null;
    return {
      last: last[key],
      prev: prev ? prev[key] : null,
      diff: prev ? last[key] - prev[key] : null,
      date: last.d,
      prevDate: prev ? prev.d : null,
    };
  }

  // 막대 기하: 값 배열 → 0 기준 막대 [{x, y, w, h, v}] (viewBox 좌표). 0 선의 y 도 준다.
  function barGeometry(vals, w, h, pad = 2) {
    const n = vals.length;
    if (!n) return { bars: [], zeroY: h / 2 };
    const finiteVals = vals.filter(finite);
    const max = Math.max(0, ...finiteVals);
    const min = Math.min(0, ...finiteVals);
    const span = max - min || 1;
    const inner = h - pad * 2;
    const y = (v) => pad + ((max - v) / span) * inner;
    const zeroY = y(0);
    const slot = w / n;
    const bw = Math.max(1, slot * 0.7);
    const bars = vals.map((v, i) => {
      const x = i * slot + (slot - bw) / 2;
      if (!finite(v)) return { x, y: zeroY, w: bw, h: 0, v: null };
      const top = Math.min(y(v), zeroY);
      return { x, y: top, w: bw, h: Math.max(0.5, Math.abs(y(v) - zeroY)), v };
    });
    return { bars, zeroY, min, max };
  }

  // 선 경로(각 점을 슬롯 가운데에). 값 범위는 자체 min/max.
  function linePath(vals, w, h, pad = 2) {
    const n = vals.length;
    const f = vals.filter(finite);
    if (!n || !f.length) return "";
    const max = Math.max(...f);
    const min = Math.min(...f);
    const span = max - min || 1;
    const inner = h - pad * 2;
    const slot = w / n;
    let d = "";
    vals.forEach((v, i) => {
      if (!finite(v)) return;
      const x = i * slot + slot / 2;
      const y = pad + ((max - v) / span) * inner;
      d += `${d ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return d;
  }

  function isoDate(yyyymmdd) {
    const s = String(yyyymmdd || "");
    return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
  }

  // 샤드에서 한 종목의 일별 행을 객체로(최신순). 등락률은 전일대비 ÷ (종가 − 전일대비).
  function dailyRows(shard, code) {
    const rows = shard && shard.daily && shard.daily[code];
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => {
      const close = finite(r[1]) ? r[1] : null;
      const chg = finite(r[2]) ? r[2] : null;
      const base = close != null && chg != null ? close - chg : null;
      return {
        d: isoDate(r[0]),
        close,
        chg,
        pct: base && base > 0 ? (chg / base) * 100 : null,
        ind: finite(r[3]) ? r[3] : null,
        frn: finite(r[4]) ? r[4] : null,
        org: finite(r[5]) ? r[5] : null,
        hold: finite(r[6]) ? r[6] : null,
      };
    });
  }

  const api = { shardOf, fmtSigned, fmtPlain, tone, lastN, cumulative, sumKey, delta, barGeometry, linePath, isoDate, dailyRows };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirKrFlowCore = api;
})(typeof window !== "undefined" ? window : null);
