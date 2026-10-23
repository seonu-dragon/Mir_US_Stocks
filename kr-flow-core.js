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

  // 폰 일별 표용 짧은 부호 수량: 1만 이상은 '만' 단위(10만 미만은 소수 한 자리) — +232만 / -1.2만 / +3,189.
  function fmtSignedMan(v) {
    if (!finite(v)) return "—";
    const a = Math.abs(v);
    if (a < 1e4) return fmtSigned(v);
    const sign = v > 0 ? "+" : "-";
    const m = a / 1e4;
    return m >= 9.95 ? `${sign}${commas(m)}만` : `${sign}${m.toFixed(1)}만`;
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

  // 연속 순매수·순매도 목록(build_kr_investor_flow.py compute_streaks) → 시장 필터 + 최소 연속일 + 앞 limit 개.
  // market: "all" | "kospi" | "kosdaq". 항목 {t, n, m, d(연속일), a(억), r(연속 기간 등락률), x(창을 다 채움)}.
  function streakRows(list, market, minDays, limit) {
    const src = Array.isArray(list) ? list : [];
    const m = String(market || "all").toLowerCase();
    const min = finite(minDays) ? minDays : 2;
    const out = src.filter((x) => x && finite(x.d) && x.d >= min && (m === "all" || String(x.m || "").toLowerCase() === m));
    return finite(limit) && limit > 0 ? out.slice(0, limit) : out;
  }

  // 테마·업종별 순매수 합(build_kr_investor_flow.py compute_group_flow) → 창(w: 0=1일·1=5일·2=20일)·투자자(key: f|o|i)
  // 기준 순매수(side "Buy", 큰 순) 또는 순매도("Sell", 작은 순) 앞 limit 개. 행 {id, n, c(종목 수), f/o/i: [1일, 5일, 20일](억)}.
  function groupRows(list, w, key, side, limit) {
    const src = Array.isArray(list) ? list : [];
    const val = (x) => (x && Array.isArray(x[key]) ? x[key][w] : null);
    const sell = side === "Sell";
    const out = src.filter((x) => finite(val(x)) && (sell ? val(x) < 0 : val(x) > 0))
      .sort((a, b) => (sell ? val(a) - val(b) : val(b) - val(a)));
    return finite(limit) && limit > 0 ? out.slice(0, limit) : out;
  }

  // 연속일 표기: 수집 창을 다 채운 종목은 그보다 길 수 있어 '20일+'.
  function streakLabel(x, windowDays) {
    if (!x || !finite(x.d)) return "—";
    return x.x ? `${finite(windowDays) ? windowDays : x.d}일+` : `${x.d}일`;
  }

  // 외국인 보유율 추이 — detail.foreignRetention(숫자 배열, chartSeries 마지막 len 개 봉과 같은 순서·null=모름,
  // update_korea_data.py foreign_retention_series 와 짝) → 날짜가 붙은 점. 점이 minPoints 개 미만이면 null(패널 숨김).
  function foreignRetention(series, chartSeries, minPoints) {
    const need = finite(minPoints) ? minPoints : 5;
    if (!Array.isArray(series) || !series.length || !Array.isArray(chartSeries) || chartSeries.length < series.length) return null;
    const tail = chartSeries.slice(chartSeries.length - series.length);
    const vals = [];
    const pts = [];
    series.forEach((v, i) => {
      const bar = tail[i];
      const d = Array.isArray(bar) ? String(bar[5] || "") : "";
      const ok = finite(v) && v >= 0 && v <= 100 && d;
      vals.push(ok ? v : null);
      if (ok) pts.push({ d, v });
    });
    if (pts.length < need) return null;
    const nums = pts.map((p) => p.v);
    const first = pts[0];
    const last = pts[pts.length - 1];
    return {
      vals, pts, first, last,
      min: Math.min(...nums), max: Math.max(...nums),
      change: Math.round((last.v - first.v) * 100) / 100,
    };
  }

  // 국내 ETF 구성(KR_ETF_HOLDINGS.etfs: { etf: { name, top:[{t, n, w, m?}] } }) 안에서 이 종목을 담은 ETF 를
  // 비중 내림차순으로. 해외 종목(m="us")·비중 없는 행은 제외. 각 ETF 의 상위 25 안에 든 경우만 잡힌다.
  function etfOwners(etfs, ticker, n) {
    const t = String(ticker || "");
    if (!etfs || !t) return [];
    const out = [];
    Object.keys(etfs).forEach((etf) => {
      if (etf === t) return;
      const rec = etfs[etf];
      const top = rec && Array.isArray(rec.top) ? rec.top : [];
      const h = top.find((x) => x && x.t === t && x.m !== "us" && finite(x.w) && x.w > 0);
      if (h) out.push({ etf, name: (rec && rec.name) || etf, w: h.w });
    });
    out.sort((a, b) => b.w - a.w || (a.etf < b.etf ? -1 : 1));
    return finite(n) && n > 0 ? out.slice(0, n) : out;
  }

  // 지분 공시(KR_OWNERSHIP: majorHolders = 5% 대량보유, insiders = 임원·주요주주) 중 이 종목 행을 최신순으로 합친다.
  // 각 행에 kind("major"|"insider")를 붙인다. 같은 날짜면 원래 순서를 유지.
  function ownershipRows(payload, ticker, n) {
    const t = String(ticker || "");
    if (!payload || !t) return [];
    const pick = (list, kind) => (Array.isArray(list) ? list : [])
      .map((r, i) => ({ r, i, kind }))
      .filter((x) => x.r && String(x.r.ticker) === t);
    const rows = pick(payload.majorHolders, "major").concat(pick(payload.insiders, "insider"));
    rows.sort((a, b) => {
      const da = String(a.r.fileDate || "");
      const db = String(b.r.fileDate || "");
      if (da !== db) return da < db ? 1 : -1;
      if (a.kind !== b.kind) return a.kind === "major" ? -1 : 1;
      return a.i - b.i;
    });
    const out = rows.map((x) => Object.assign({ kind: x.kind }, x.r));
    return finite(n) && n > 0 ? out.slice(0, n) : out;
  }

  const api = { shardOf, fmtSigned, fmtSignedMan, fmtPlain, tone, lastN, cumulative, sumKey, delta, barGeometry, linePath, isoDate, undelta, decodeStock, dailyRows, streakRows, groupRows, streakLabel, foreignRetention, etfOwners, ownershipRows };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirKrFlowCore = api;
})(typeof window !== "undefined" ? window : null);
