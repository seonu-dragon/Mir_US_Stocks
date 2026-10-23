// mini-chart-core.js — 찾기 결과 미니 차트 갤러리의 순수 계산(DOM 없음).
// 브라우저 window.MirMiniChartCore, node 테스트 scripts/tests/test_mini_chart_core.mjs.
// 입력은 상세 파일의 chartSeries 그대로 — 배열 [o,h,l,c,v,date] 또는 객체 {d,o,h,l,c,v}.
// 기간: 3M = 최근 63봉(캔들), 1Y = 최근 252봉(종가 선). 값이 없는 봉은 버린다(메우지 않는다).
(function (root) {
  "use strict";

  const PERIOD_BARS = { "3M": 63, "1Y": 252 };

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normBar(r) {
    if (Array.isArray(r)) return { o: num(r[0]), h: num(r[1]), l: num(r[2]), c: num(r[3]), d: r[5] == null ? "" : String(r[5]) };
    if (r && typeof r === "object") return { o: num(r.o), h: num(r.h), l: num(r.l), c: num(r.c), d: r.d == null ? "" : String(r.d) };
    return null;
  }

  // 기간에 맞는 최근 봉. 종가가 없거나 0 이하인 봉은 뺀다. 시·고·저가 없으면 종가로 메우지 않고 c 만 쓴다(선용).
  function sliceBars(series, period) {
    const n = PERIOD_BARS[period] || PERIOD_BARS["3M"];
    const bars = (Array.isArray(series) ? series : []).map(normBar).filter((b) => b && b.c !== null && b.c > 0);
    return bars.slice(-n);
  }

  function changePct(bars) {
    if (!Array.isArray(bars) || bars.length < 2) return null;
    const a = bars[0].c, b = bars[bars.length - 1].c;
    return a > 0 ? (b / a - 1) * 100 : null;
  }

  function hasOhlc(b) {
    return b.o !== null && b.h !== null && b.l !== null && b.h >= b.l && b.o > 0 && b.l > 0;
  }

  // SVG 본문(문자열). kind: "candle"(3M) | "line"(1Y). 색은 클래스로(시장별 --pos/--neg 를 CSS 가 칠한다).
  function svg(bars, { kind = "candle", w = 160, h = 56, pad = 2 } = {}) {
    if (!Array.isArray(bars) || bars.length < 2) return "";
    const useCandle = kind === "candle" && bars.every(hasOhlc);
    let lo = Infinity, hi = -Infinity;
    bars.forEach((b) => {
      const l = useCandle ? b.l : b.c, u = useCandle ? b.h : b.c;
      if (l < lo) lo = l;
      if (u > hi) hi = u;
    });
    const rng = hi - lo || hi * 0.01 || 1;
    const y = (v) => (pad + (hi - v) / rng * (h - pad * 2)).toFixed(1);
    const up = changePct(bars) >= 0;
    if (!useCandle) {
      const step = (w - pad * 2) / (bars.length - 1);
      const pts = bars.map((b, i) => `${(pad + i * step).toFixed(1)},${y(b.c)}`).join(" ");
      return `<polyline class="mc-line ${up ? "is-up" : "is-down"}" points="${pts}" fill="none" stroke-width="1.4" />`;
    }
    const slot = (w - pad * 2) / bars.length;
    const bw = Math.max(1, slot * 0.6);
    return bars.map((b, i) => {
      const cx = pad + slot * i + slot / 2;
      const rise = b.c >= b.o;
      const top = Math.max(b.o, b.c), bot = Math.min(b.o, b.c);
      const yt = Number(y(top)), yb = Number(y(bot));
      const cls = rise ? "mc-up" : "mc-down";
      return `<g class="${cls}"><line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${y(b.h)}" y2="${y(b.l)}" stroke-width="0.8" />`
        + `<rect x="${(cx - bw / 2).toFixed(1)}" y="${yt.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.8, yb - yt).toFixed(1)}" /></g>`;
    }).join("");
  }

  // 동시 실행 상한이 있는 작업 큐. run(key, fn) — 같은 키는 한 번만. fn 은 Promise 를 돌려준다.
  function createQueue(limit = 6) {
    const max = Math.max(1, Math.floor(limit));
    const waiting = [];
    const seen = new Map();
    let active = 0;
    const pump = () => {
      while (active < max && waiting.length) {
        const job = waiting.shift();
        active += 1;
        Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => { active -= 1; pump(); });
      }
    };
    return {
      run(key, fn) {
        if (seen.has(key)) return seen.get(key);
        const p = new Promise((resolve, reject) => { waiting.push({ key, fn, resolve, reject }); });
        seen.set(key, p);
        pump();
        return p;
      },
      // 아직 시작 안 한 작업을 버린다(그 키는 다시 run 할 수 있다). 버린 Promise 는 cleared 로 reject.
      clear() {
        waiting.splice(0).forEach((job) => { seen.delete(job.key); job.reject(new Error("cleared")); });
      },
      get active() { return active; },
      get pending() { return waiting.length; },
    };
  }

  const api = { PERIOD_BARS, sliceBars, changePct, svg, createQueue, normBar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirMiniChartCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
