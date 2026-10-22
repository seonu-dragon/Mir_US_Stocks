// 옵션 포지션(감마 노출·이상 거래) — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirOptionsFlowCore, node 테스트 scripts/tests/test_options_flow_core.mjs.
// 입력 window.OPTIONS_FLOW(scripts/build_options_flow.py, 미국 전용):
//   { uoaCols, uoa: [[ticker, expiry, C|P, strike, volume, oi, volOi, ivPct, premium], …],
//     tickers: {T: {spot, expiries, netGex, callWall, putWall, flip, strikes: [[행사가, 콜 GEX, 풋 GEX(음수)], …], uoa: [...]}} }
(function (root) {
  "use strict";

  function uoaRow(r) {
    if (!Array.isArray(r) || r.length < 9) return null;
    const [ticker, expiry, type, strike, volume, oi, volOi, ivPct, premium] = r;
    return { ticker, expiry, type, strike, volume, oi, volOi, ivPct, premium };
  }

  function marketUoa(payload, limit = 30) {
    return ((payload && payload.uoa) || []).map(uoaRow).filter(Boolean).slice(0, limit);
  }

  /** 종목 요약 — 없거나 행사가가 없으면 null. */
  function summarize(payload, ticker) {
    const t = payload && payload.tickers && payload.tickers[String(ticker || "").toUpperCase()];
    if (!t || !Array.isArray(t.strikes) || !t.strikes.length) return null;
    return {
      spot: t.spot, expiries: t.expiries, netGex: t.netGex, callWall: t.callWall, putWall: t.putWall, flip: t.flip,
      strikes: t.strikes.filter((s) => Array.isArray(s) && s.length >= 3),
      uoa: (t.uoa || []).map(uoaRow).filter(Boolean),
    };
  }

  /** 행사가 행을 n 칸 이하로 묶는다(같은 칸 GEX 는 더함). 칸 라벨은 칸 안 첫 행사가~끝 행사가. */
  function bucket(strikes, n = 24) {
    const rows = (strikes || []).slice().sort((a, b) => a[0] - b[0]);
    if (rows.length <= n) return rows.map(([k, c, p]) => ({ lo: k, hi: k, call: c, put: p }));
    const size = Math.ceil(rows.length / n);
    const out = [];
    for (let i = 0; i < rows.length; i += size) {
      const part = rows.slice(i, i + size);
      out.push({ lo: part[0][0], hi: part[part.length - 1][0],
        call: part.reduce((s, r) => s + r[1], 0), put: part.reduce((s, r) => s + r[2], 0) });
    }
    return out;
  }

  /** 막대 폭(0~1) — 칸들의 |콜|·|풋| 최댓값 기준. */
  function scale(buckets) {
    const m = Math.max(1, ...buckets.map((b) => Math.max(Math.abs(b.call), Math.abs(b.put))));
    return buckets.map((b) => ({ ...b, cw: Math.abs(b.call) / m, pw: Math.abs(b.put) / m }));
  }

  /** USD → '$12.3억' · '$1.25조' · '$8,500만'. 부호 유지(signed=true 면 + 표시). */
  function fmtUsd(v, signed = false) {
    if (!Number.isFinite(v)) return "—";
    const sign = v < 0 ? "-" : (signed && v > 0 ? "+" : "");
    const a = Math.abs(v);
    let body;
    if (a >= 1e12) body = `${(a / 1e12).toFixed(2)}조`;
    else if (a >= 1e8) body = `${(a / 1e8).toFixed(a >= 1e10 ? 0 : 1)}억`;
    else if (a >= 1e4) body = `${Math.round(a / 1e4).toLocaleString("ko-KR")}만`;
    else body = `${Math.round(a).toLocaleString("ko-KR")}`;
    return `${sign}$${body}`;
  }

  function fmtStrike(k) {
    if (!Number.isFinite(k)) return "—";
    return Number.isInteger(k) ? k.toLocaleString("en-US") : k.toFixed(k >= 100 ? 1 : 2);
  }

  /** 'YYYY-MM-DD' → 'M/D'. */
  function shortExpiry(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return m ? `${Number(m[2])}/${Number(m[3])}` : "";
  }

  /** 순GEX 부호로 본 체제 — 양수면 변동을 누르는 쪽, 음수면 키우는 쪽(딜러 헤지 가정). */
  function regime(netGex) {
    if (!Number.isFinite(netGex) || netGex === 0) return { key: "flat", text: "중립" };
    return netGex > 0 ? { key: "pos", text: "양(+) 감마 — 변동 완화 쪽" } : { key: "neg", text: "음(−) 감마 — 변동 확대 쪽" };
  }

  const api = { uoaRow, marketUoa, summarize, bucket, scale, fmtUsd, fmtStrike, shortExpiry, regime };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirOptionsFlowCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
