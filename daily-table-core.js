// 종목 상세 '일별 시세' 표 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirDailyTable, node 테스트(scripts/tests/test_daily_table_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
// 입력은 차트와 같은 일봉 행 [{o,h,l,c,v,d}] (오름차순). 전일대비는 바로 앞 봉 종가 기준.
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // 최근 거래일부터 limit 개. change/pct 는 앞 봉이 없으면(가장 오래된 행) null.
  function buildDailyRows(rows, limit) {
    const src = (Array.isArray(rows) ? rows : []).filter((r) => r && num(r.c) !== null && num(r.c) > 0);
    const n = src.length;
    const want = Math.max(0, Math.min(n, Number.isFinite(limit) ? Math.floor(limit) : n));
    const out = [];
    for (let i = n - 1; i >= n - want; i -= 1) {
      const r = src[i];
      const c = num(r.c);
      const prev = i > 0 ? num(src[i - 1].c) : null;
      const change = prev !== null && prev > 0 ? c - prev : null;
      const pct = change !== null ? (change / prev) * 100 : null;
      const v = num(r.v);
      out.push({
        d: r.d ? String(r.d).slice(0, 10) : "",
        c,
        o: num(r.o),
        h: num(r.h),
        l: num(r.l),
        v: v !== null && v > 0 ? v : null,
        change,
        pct,
      });
    }
    return out;
  }

  // 가격 표기. KR = 원 단위 정수(콤마), US = $ 소수 2자리($1 미만은 4자리).
  function fmtPrice(v, kr) {
    const n = num(v);
    if (n === null) return "—";
    if (kr) return Math.round(n).toLocaleString("ko-KR");
    const a = Math.abs(n);
    const dec = a > 0 && a < 1 ? 4 : 2;
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }

  // 전일대비 → { text: "▲1,000(+3.62%)", dir: "up"|"down"|"flat"|"" }.
  // 부호는 화살표로만 표시하고 금액에는 붙이지 않는다(네이버 일별 시세 표기와 같다).
  function fmtChange(change, pct, kr) {
    const c = num(change);
    const p = num(pct);
    if (c === null || p === null) return { text: "—", dir: "" };
    const eps = kr ? 0.5 : 0.00005;
    if (Math.abs(c) < eps) return { text: `0(0.00%)`, dir: "flat" };
    const up = c > 0;
    const a = Math.abs(c);
    const amt = kr
      ? Math.round(a).toLocaleString("ko-KR")
      : a.toLocaleString("en-US", { minimumFractionDigits: a < 0.01 ? 4 : 2, maximumFractionDigits: a < 0.01 ? 4 : 2 });
    return { text: `${up ? "▲" : "▼"}${amt}(${up ? "+" : "−"}${Math.abs(p).toFixed(2)}%)`, dir: up ? "up" : "down" };
  }

  function fmtVolume(v) {
    const n = num(v);
    if (n === null || n <= 0) return "—";
    return Math.round(n).toLocaleString("ko-KR");
  }

  // "2026-09-25" → "2026.09.25"
  function fmtDate(d) {
    const s = String(d || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replace(/-/g, ".") : (s || "—");
  }

  // 좁은 화면용 "26.09.25"
  function fmtDateShort(d) {
    const s = String(d || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(2).replace(/-/g, ".") : (s || "—");
  }

  const api = { buildDailyRows, fmtPrice, fmtChange, fmtVolume, fmtDate, fmtDateShort };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirDailyTable = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
