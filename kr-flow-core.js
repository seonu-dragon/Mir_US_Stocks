// 국내 증시자금·투자자 동향 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirKrFlowCore, node 테스트(scripts/tests/test_kr_flow_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 입력 형식(data/korea/market_funds.js · data/korea/investor_flow_daily/sNN.json):
//   funds.rows      [{ d:"YYYY-MM-DD", dep, credit, unpaid, forced, forcedPct }] 오름차순, 억 원(비중 %)
//   investors.KOSPI [{ d:"YYYY-MM-DD", ind, frn, org }] 오름차순, 억 원
//   종목 일별 샤드  { dates:[YYYYMMDD 최신순], t:{ code:[n, 기준전일종가, 종가 차분×n, 개인×n, 외국인×n, 기관×n,
//                   보유율×100 차분×n, 전일대비 보정×n] }, own:{ code:[자기 날짜] } } — 수량(주). build_kr_investor_flow.py encode_stock 과 짝.
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

  // 첫 값 + 차분 → 원값. 결측(null)은 건너뛰고 다음 값은 직전 유효 값에 더한다(파이썬 deltas 의 역).
  function undelta(vals) {
    let prev = null;
    return vals.map((v) => {
      if (!finite(v)) return null;
      prev = prev == null ? v : prev + v;
      return prev;
    });
  }

  // 평평한 배열 하나 → 일별 행 객체(최신순). 등락률은 다음(더 오래된) 행 종가, 마지막 행은 기준전일종가로.
  function decodeStock(arr, dates) {
    if (!Array.isArray(arr) || !finite(arr[0]) || arr[0] <= 0) return [];
    const n = arr[0];
    const col = (k) => arr.slice(2 + n * k, 2 + n * (k + 1));
    if (arr.length < 2 + n * 5) return [];
    const adj = arr.length >= 2 + n * 6 ? col(5) : [];
    const p0 = finite(arr[1]) ? arr[1] : null;
    const close = undelta(col(0));
    const ind = col(1);
    const frn = col(2);
    const org = col(3);
    const hold = undelta(col(4));
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = close[i];
      const base = i + 1 < n ? close[i + 1] : p0;
      // 공식 전일대비 = (종가 − 더 오래된 행 종가) + 보정. 등락률 분모는 공식 기준가(종가 − 전일대비).
      const chg = c != null && base != null ? c - base + (finite(adj[i]) ? adj[i] : 0) : null;
      const ref = c != null && chg != null ? c - chg : null;
      out.push({
        d: isoDate(dates && dates[i]),
        close: c,
        chg,
        pct: chg != null && ref > 0 ? (chg / ref) * 100 : null,
        ind: finite(ind[i]) ? ind[i] : null,
        frn: finite(frn[i]) ? frn[i] : null,
        org: finite(org[i]) ? org[i] : null,
        hold: hold[i] != null ? hold[i] / 100 : null,
      });
    }
    return out;
  }

  // 샤드에서 한 종목의 일별 행(최신순). 없으면 [].
  function dailyRows(shard, code) {
    if (!shard || !shard.t || !shard.t[code]) return [];
    const dates = (shard.own && shard.own[code]) || shard.dates || [];
    return decodeStock(shard.t[code], dates);
  }

  const api = { shardOf, fmtSigned, fmtPlain, tone, lastN, cumulative, sumKey, delta, barGeometry, linePath, isoDate, undelta, decodeStock, dailyRows };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirKrFlowCore = api;
})(typeof window !== "undefined" ? window : null);
