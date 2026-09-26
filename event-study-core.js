// 이벤트 스터디 워크벤치 — 순수 집계 모듈(DOM·파일·네트워크 없음).
// 브라우저에서는 window.MirEventStudyCore, node(테스트 scripts/tests/test_event_study_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 데이터: scripts/build_event_study.py 가 만든 유형별 행(크기를 줄인 배열)
//   [t 종목, d0 0일(2000-01-01 부터 일수), tm 세션(a 장후·b 장전·m 장중·u 미상), capAt 이벤트 시점 시총 근사,
//    sector 인덱스, size 크기, ma 시장조정 CAR 경로, mmd 시장모형 − 시장조정 차이|null, cd0 대조 0일|null,
//    cma 대조 시장조정 경로|null, dd 이벤트일 − 0일(일)]
//   경로는 index.points 지점(−5 ~ +60)에서 −5일부터 누적한 CAR(0.1%p 정수, 데이터가 끝난 뒤는 null).
//
// 신호 성적표(signal-scorecard-core.js)와 같은 부트스트랩(날짜 묶음·mulberry32·2,000회)을 쓴다 —
// 난수기는 MirSignalCore.mulberry32 를 빌려 쓰고, 한 지점만 볼 때 결과가 clusterBootstrapMean 과
// 같다(테스트가 확인). 여러 지점을 한 번의 재표집으로 같이 계산해 표본 수만 개에서도 빠르다.
(function (root) {
  "use strict";

  const FIELD = { t: 0, d0: 1, tm: 2, capAt: 3, sector: 4, size: 5, ma: 6, mmd: 7, cd0: 8, cma: 9, dd: 10 };
  const DAY_MS = 86400000;
  const DAY_BASE_MS = Date.UTC(2000, 0, 1);
  function dayNum(iso) {
    if (typeof iso === "number") return iso;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - DAY_BASE_MS) / DAY_MS) : null;
  }
  function dayIso(n) {
    if (n == null || !Number.isFinite(Number(n))) return "";
    return new Date(DAY_BASE_MS + Number(n) * DAY_MS).toISOString().slice(0, 10);
  }
  // 시장모형 경로 = 시장조정 경로 + 차이(mmd). 없으면 null.
  function mmPath(row) {
    const ma = row[FIELD.ma], d = row[FIELD.mmd];
    if (!Array.isArray(ma) || !Array.isArray(d)) return null;
    return ma.map((v, i) => (v == null || d[i] == null ? null : v + d[i]));
  }
  const MIN_SAMPLE = 30;
  // 시총 구간 상한(빌더 US_CAP_BUCKETS / KR_CAP_BUCKETS 와 같아야 한다). US $B, KR 조원.
  const CAP_BOUNDS = { us: [2, 10, 200], kr: [0.3, 1, 10] };
  const ANCHOR_OFFSET = { pre: null, d0: -1, d1: 0 };   // 이 지점 값을 빼 다시 맞춘다(pre = −5일부터 그대로)

  function signalCore() {
    if (root && root.MirSignalCore) return root.MirSignalCore;
    if (typeof require === "function") {
      try { return require("./signal-scorecard-core.js"); } catch (_) { /* 폴백 */ }
    }
    return null;
  }
  // signal-scorecard-core.js 가 없을 때만 쓰는 같은 난수기(테스트·순서 방어).
  function mulberry32Local(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rng(seed) {
    const sc = signalCore();
    return sc && sc.mulberry32 ? sc.mulberry32(seed) : mulberry32Local(seed);
  }

  function round(v, d) { const f = Math.pow(10, d); return Math.round(v * f) / f; }
  function median(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // ------------------------------------------------------------ 구간·필터
  function capBucket(market, capAt) {
    const b = CAP_BOUNDS[market];
    if (!b || capAt == null || !Number.isFinite(Number(capAt))) return -1;
    const v = Number(capAt);
    for (let i = 0; i < b.length; i++) if (v < b[i]) return i;
    return b.length;
  }
  // 크기 구간: bins [a,b,c] → 0: <a, 1: a~b, 2: b~c, 3: ≥c. 값이 없으면 -1.
  function sizeBucket(value, bins) {
    if (value == null || !Number.isFinite(Number(value)) || !Array.isArray(bins)) return -1;
    const v = Number(value);
    for (let i = 0; i < bins.length; i++) if (v < bins[i]) return i;
    return bins.length;
  }
  function sizeBucketLabels(bins, unit) {
    if (!Array.isArray(bins) || !bins.length) return [];
    const f = (x) => (unit === "$" ? fmtUsd(x) : `${x}${unit || ""}`);
    const out = [`${f(bins[0])} 미만`];
    for (let i = 1; i < bins.length; i++) out.push(`${f(bins[i - 1])}~${f(bins[i])}`);
    out.push(`${f(bins[bins.length - 1])} 이상`);
    return out;
  }
  function fmtUsd(x) {
    if (x >= 1e9) return `$${round(x / 1e9, 1)}B`;
    if (x >= 1e6) return `$${round(x / 1e6, 1)}M`;
    if (x >= 1e3) return `$${round(x / 1e3, 0)}K`;
    return `$${x}`;
  }

  // filters: { market, from, to (0일 날짜, 포함), caps:number[]|null, sectors:number[]|null,
  //            sizeBuckets:number[]|null, sizeBins, requireSize, ticker, requireMM }
  function filterRows(rows, filters) {
    const f = filters || {};
    const caps = f.caps && f.caps.length ? new Set(f.caps) : null;
    const secs = f.sectors && f.sectors.length ? new Set(f.sectors) : null;
    const sizes = f.sizeBuckets && f.sizeBuckets.length ? new Set(f.sizeBuckets) : null;
    const from = f.from ? dayNum(f.from) : null;
    const to = f.to ? dayNum(f.to) : null;
    const out = [];
    for (const r of rows || []) {
      const d0 = r[FIELD.d0];
      if (from != null && d0 < from) continue;
      if (to != null && d0 > to) continue;
      if (f.ticker && r[FIELD.t] !== f.ticker) continue;
      if (caps && !caps.has(capBucket(f.market, r[FIELD.capAt]))) continue;
      if (secs && !secs.has(r[FIELD.sector])) continue;
      if (sizes) {
        if (!sizes.has(sizeBucket(r[FIELD.size], f.sizeBins))) continue;
      } else if (f.requireSize && r[FIELD.size] == null) continue;
      if (f.requireMM && !r[FIELD.mmd]) continue;
      out.push(r);
    }
    return out;
  }

  // ------------------------------------------------------------ 경로 다시 맞추기
  // path: −5일부터 누적한 CAR(정수), points: 지점 목록. anchor: pre | d0 | d1.
  // d0 = 0일부터(−1일 값을 뺌), d1 = +1일부터(0일 값을 뺌). 결과는 소수(0.01 = 1%).
  function anchorPath(path, points, anchor, scale) {
    if (!Array.isArray(path)) return null;
    const sc = scale || 1000;
    const off = ANCHOR_OFFSET[anchor || "d0"];
    let base = 0;
    if (off != null) {
      const bi = points.indexOf(off);
      if (bi < 0 || path[bi] == null) return null;
      base = path[bi];
    }
    return path.map((v) => (v == null ? null : (v - base) / sc));
  }

  // ------------------------------------------------------------ 날짜 묶음 부트스트랩(여러 지점 동시)
  // items: [{ c: 묶음 키(0일 날짜), v: number[] (지점별 값, null 허용) }]
  // weighting: "event"(이벤트 동일 가중: 표집한 묶음들의 합/개수) | "day"(날짜 동일 가중: 묶음 평균의 평균)
  // 반환: 지점별 { n, days, mean, median, lo, hi, posRate, p }  (p: 0 을 기준으로 한 양측 부트스트랩 p)
  function clusterBootstrapMulti(items, nPoints, opts) {
    const o = opts || {};
    const B = o.B || 2000;
    const seed = o.seed || 20260926;
    const weighting = o.weighting === "day" ? "day" : "event";
    const byC = new Map();
    for (const it of items) {
      if (!byC.has(it.c)) byC.set(it.c, []);
      byC.get(it.c).push(it.v);
    }
    const keys = [...byC.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const C = keys.length;
    // 묶음·지점별 합과 개수
    const sum = new Float64Array(C * nPoints);
    const cnt = new Int32Array(C * nPoints);
    const perPointVals = Array.from({ length: nPoints }, () => []);
    const perPointDays = new Int32Array(nPoints);
    keys.forEach((k, ci) => {
      for (const v of byC.get(k)) {
        for (let p = 0; p < nPoints; p++) {
          const x = v[p];
          if (x == null || !Number.isFinite(x)) continue;
          sum[ci * nPoints + p] += x;
          cnt[ci * nPoints + p] += 1;
          perPointVals[p].push(x);
        }
      }
      for (let p = 0; p < nPoints; p++) if (cnt[ci * nPoints + p]) perPointDays[p] += 1;
    });
    const out = [];
    const means = Array.from({ length: nPoints }, () => []);
    if (C >= 2) {
      const r = rng(seed);
      const accS = new Float64Array(nPoints);
      const accN = new Float64Array(nPoints);
      for (let b = 0; b < B; b++) {
        accS.fill(0); accN.fill(0);
        for (let i = 0; i < C; i++) {
          const ci = Math.floor(r() * C);
          const base = ci * nPoints;
          for (let p = 0; p < nPoints; p++) {
            const n = cnt[base + p];
            if (!n) continue;
            if (weighting === "day") { accS[p] += sum[base + p] / n; accN[p] += 1; } else { accS[p] += sum[base + p]; accN[p] += n; }
          }
        }
        for (let p = 0; p < nPoints; p++) if (accN[p]) means[p].push(accS[p] / accN[p]);
      }
    }
    for (let p = 0; p < nPoints; p++) {
      const vals = perPointVals[p];
      const n = vals.length;
      if (!n) { out.push({ n: 0, days: 0, mean: null, median: null, lo: null, hi: null, posRate: null, p: null }); continue; }
      let mean;
      if (weighting === "day") {
        let s = 0, k = 0;
        for (let ci = 0; ci < C; ci++) { const c = cnt[ci * nPoints + p]; if (c) { s += sum[ci * nPoints + p] / c; k++; } }
        mean = s / k;
      } else {
        mean = vals.reduce((a, b) => a + b, 0) / n;
      }
      const m = means[p].sort((a, b) => a - b);
      let pv = null;
      if (m.length) {
        const le = m.filter((x) => x <= 0).length / m.length;
        const ge = m.filter((x) => x >= 0).length / m.length;
        pv = Math.max(1 / m.length, Math.min(1, 2 * Math.min(le, ge)));
      }
      out.push({
        n, days: perPointDays[p], mean, median: median(vals),
        lo: m.length ? quantile(m, 0.025) : null, hi: m.length ? quantile(m, 0.975) : null,
        posRate: vals.filter((x) => x > 0).length / n, p: pv,
      });
    }
    return out;
  }

  // ------------------------------------------------------------ 집계
  // opts: { points, scale, method: "ma"|"mm", anchor: "pre"|"d0"|"d1", weighting, B, seed }
  // 반환: { n, event: [...지점별], control: [...지점별]|null, diff: [...지점별]|null, clustering }
  function aggregate(rows, opts) {
    const o = opts || {};
    const points = o.points;
    const scale = o.scale || 1000;
    const useMM = o.method === "mm";
    const ev = [], ctrl = [], diff = [];
    for (const r of rows) {
      const a = anchorPath(useMM ? mmPath(r) : r[FIELD.ma], points, o.anchor, scale);
      if (!a) continue;
      ev.push({ c: r[FIELD.d0], v: a });
      const cp = r[FIELD.cma] ? anchorPath(r[FIELD.cma], points, o.anchor, scale) : null;
      if (cp) {
        ctrl.push({ c: r[FIELD.cd0], v: cp });
        // 짝 차이(이벤트 − 같은 종목 무작위 날짜): 묶음은 이벤트 0일 기준
        diff.push({ c: r[FIELD.d0], v: a.map((x, i) => (x == null || cp[i] == null ? null : x - cp[i])) });
      }
    }
    const bo = { B: o.B, seed: o.seed, weighting: o.weighting };
    return {
      n: ev.length,
      event: clusterBootstrapMulti(ev, points.length, bo),
      control: ctrl.length ? clusterBootstrapMulti(ctrl, points.length, bo) : null,
      diff: diff.length ? clusterBootstrapMulti(diff, points.length, bo) : null,
      nControl: ctrl.length,
      clustering: clusteringInfo(ev.map((x) => x.c)),
    };
  }

  // 같은 날 군집 진단: 가장 많이 몰린 0일의 비중, 날짜 수, 날짜당 평균 이벤트 수.
  function clusteringInfo(dates) {
    const byD = new Map();
    for (const d of dates) byD.set(d, (byD.get(d) || 0) + 1);
    let topDay = null, top = 0;
    for (const [d, c] of byD) if (c > top) { top = c; topDay = d; }
    const n = dates.length;
    const days = byD.size;
    const topShare = n ? top / n : 0;
    const perDay = days ? n / days : 0;
    // 경고: 하루에 5% 넘게 몰리거나 날짜당 평균 3건 이상이면 이벤트를 독립 표본으로 볼 수 없다.
    return { n, days, topDay, top, topShare, perDay, warn: n >= 10 && (topShare > 0.05 || perDay >= 3) };
  }

  // Benjamini–Hochberg q 값(입력 순서 유지).
  function bhAdjust(pvals) {
    const idx = pvals.map((p, i) => [p, i]).filter((x) => x[0] != null && Number.isFinite(x[0]));
    const m = idx.length;
    const q = pvals.map(() => null);
    idx.sort((a, b) => a[0] - b[0]);
    let prev = 1;
    for (let k = m - 1; k >= 0; k--) {
      const val = Math.min(prev, (idx[k][0] * m) / (k + 1));
      prev = val;
      q[idx[k][1]] = Math.min(1, val);
    }
    return q;
  }

  // 판정 문구 키: 표본 부족 → hold, 구간이 0 위/아래 → pos/neg, 걸치면 unclear.
  function verdict(stat, minSample) {
    if (!stat || stat.n < (minSample || MIN_SAMPLE)) return "hold";
    if (stat.lo == null || stat.hi == null) return "unclear";
    if (stat.lo > 0) return "pos";
    if (stat.hi < 0) return "neg";
    return "unclear";
  }

  // ------------------------------------------------------------ 종목별 요약(종목 분석 카드)
  // rows: [k, d0(일수), car1, car5, car20, car60] (0일부터, 0.1%p 정수) → 유형별 { k, n, mean1, mean5, mean20, last }
  function tickerSummary(rows, scale) {
    const sc = scale || 1000;
    const by = new Map();
    for (const r of rows || []) {
      if (!by.has(r[0])) by.set(r[0], []);
      by.get(r[0]).push(r);
    }
    const mean = (arr, i) => {
      const v = arr.map((r) => r[i]).filter((x) => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length / sc : null;
    };
    const out = [];
    for (const [k, arr] of by) {
      const sorted = arr.slice().sort((a, b) => b[1] - a[1]);
      out.push({ k, n: arr.length, n20: arr.filter((r) => r[4] != null).length, mean1: mean(arr, 2), mean5: mean(arr, 3), mean20: mean(arr, 4), last: dayIso(sorted[0][1]), recent: sorted.slice(0, 5) });
    }
    return out.sort((a, b) => b.n - a.n || (b.last > a.last ? 1 : -1));
  }

  function shardOf(ticker, shards) {
    // 빌더의 zlib.crc32(ticker) % shards 와 같은 값.
    let c = ~0 >>> 0;
    const s = unescape(encodeURIComponent(String(ticker)));
    for (let i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i);
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return ((c ^ ~0) >>> 0) % (shards || 16);
  }

  const api = {
    FIELD, MIN_SAMPLE, CAP_BOUNDS,
    dayNum, dayIso, mmPath, capBucket, sizeBucket, sizeBucketLabels, filterRows, anchorPath,
    clusterBootstrapMulti, aggregate, clusteringInfo, bhAdjust, verdict,
    tickerSummary, shardOf, median,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirEventStudyCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
