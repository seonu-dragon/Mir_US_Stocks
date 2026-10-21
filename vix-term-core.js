// VIX 기간구조 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirVixTermCore, node 테스트(scripts/tests/test_vix_term_core.mjs)에서는 module.exports.
// 입력은 window.VIX_TERM_STRUCTURE(scripts/build_vix_term_structure.py).
//
// 정의(화면 라벨과 같은 뜻으로만 쓴다)
// - VIX/VIX3M 비율: 30일 내재변동성 ÷ 3개월 내재변동성. 1 초과 = 단기 쪽이 더 높다(백워데이션).
// - 1·2개월물 차: (VX 2번째 월물 ÷ 1번째 월물 − 1). 양수 = 콘탱고, 음수 = 백워데이션.
// - 백분위: 최근 이력(빌더가 준 약 1년)에서 오늘 값 이하인 날의 비율.
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function ratio(a, b) {
    const x = num(a), y = num(b);
    return x != null && y != null && y > 0 ? x / y : null;
  }

  // 0~100 백분위(오늘 값 이하인 비율). 표본 20개 미만이면 null.
  function percentile(values, v) {
    const xs = (values || []).map(num).filter((x) => x != null);
    const x = num(v);
    if (x == null || xs.length < 20) return null;
    const le = xs.filter((y) => y <= x).length;
    return Math.round((le / xs.length) * 100);
  }

  function spotValue(payload, id) {
    const row = ((payload && payload.spot) || []).find((s) => s && s.id === id);
    return row ? num(row.v) : null;
  }

  // 이력 [[date, vix, vix3m, vx1, vx2]] → 날짜별 비율 열.
  function historySeries(payload) {
    return ((payload && payload.history) || []).map((r) => ({
      date: r[0],
      ratio: ratio(r[1], r[2]),
      spread: (() => { const q = ratio(r[4], r[3]); return q == null ? null : q - 1; })(),
    }));
  }

  // 위젯 머리 요약. 값이 없으면 각 칸 null — 화면은 '—'.
  function summary(payload) {
    if (!payload) return null;
    const fut = (payload.futures || []).filter((f) => num(f.settle) != null);
    const vix = spotValue(payload, "VIX");
    const vix3m = spotValue(payload, "VIX3M");
    const r = ratio(vix, vix3m);
    const f1 = fut[0] ? num(fut[0].settle) : null;
    const f2 = fut[1] ? num(fut[1].settle) : null;
    const sp = ratio(f2, f1);
    const spread = sp == null ? null : sp - 1;
    const hist = historySeries(payload);
    const ratios = hist.map((h) => h.ratio).filter((x) => x != null);
    const backDays = ratios.filter((x) => x > 1).length;
    let streak = 0;
    for (let i = hist.length - 1; i >= 0; i -= 1) {
      const x = hist[i].ratio;
      if (x == null) break;
      if ((r != null && r > 1) !== (x > 1)) break;
      streak += 1;
    }
    return {
      asOf: payload.asOf || null,
      vix,
      vix3m,
      ratio: r,
      ratioPct: percentile(ratios, r),
      state: r == null ? null : r > 1 ? "back" : "contango",
      stateDays: r == null ? 0 : streak,
      spread,
      spreadPct: percentile(hist.map((h) => h.spread), spread),
      front: fut[0] || null,
      second: fut[1] || null,
      backDays,
      histDays: ratios.length,
    };
  }

  // 곡선 점 [{x: 만기 일수, y: 값, label}] — 현물·선물을 같은 가로축(만기까지 일수)에 놓는다.
  function curvePoints(payload, which) {
    if (!payload) return [];
    if (which === "spot") {
      return (payload.spot || []).filter((s) => num(s.v) != null && num(s.days) != null)
        .map((s) => ({ x: num(s.days), y: num(s.v), label: s.id, prev: num(s.prev) }))
        .sort((a, b) => a.x - b.x);
    }
    const src = which === "week" ? payload.week && payload.week.futures
      : which === "month" ? payload.month && payload.month.futures
        : payload.futures;
    return (src || []).filter((f) => num(f.settle) != null && num(f.days) != null)
      .map((f) => ({ x: num(f.days), y: num(f.settle), label: f.label || f.exp, exp: f.exp, prev: num(f.prev) }))
      .sort((a, b) => a.x - b.x);
  }

  // 1·2·2.5·5 × 10^k 눈금.
  function niceTicks(min, max, count) {
    const lo = num(min), hi = num(max);
    if (lo == null || hi == null) return [];
    if (hi <= lo) return [lo];
    const raw = (hi - lo) / Math.max(1, count || 4);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }

  // 곡선 SVG 의 y 범위: 모든 곡선 점을 덮고 위아래 8% 여유, 눈금에 맞춰 넓힌다.
  function yDomain(series) {
    const ys = [];
    (series || []).forEach((s) => (s || []).forEach((p) => { if (num(p.y) != null) ys.push(p.y); }));
    if (!ys.length) return null;
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = Math.max((hi - lo) * 0.08, 0.5);
    lo -= pad; hi += pad;
    const ticks = niceTicks(lo, hi, 4);
    if (ticks.length) { lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]); }
    return { min: lo, max: hi, ticks: niceTicks(lo, hi, 4) };
  }

  // 만기 일수 가로축은 제곱근 눈금 — 1일·9일·30일이 1년 옆에서 한 점으로 뭉치지 않게.
  function xScale(days, maxDays, width) {
    const d = Math.max(0, num(days) || 0);
    const m = Math.max(1, num(maxDays) || 1);
    return (Math.sqrt(d) / Math.sqrt(m)) * width;
  }

  function fmtNum(v, digits) {
    const n = num(v);
    return n == null ? "—" : n.toFixed(digits == null ? 2 : digits);
  }

  function fmtSignedPct(v, digits) {
    const n = num(v);
    if (n == null) return "—";
    const p = n * 100;
    return `${p > 0 ? "+" : ""}${p.toFixed(digits == null ? 1 : digits)}%`;
  }

  function tenorLabel(days) {
    const d = num(days);
    if (d == null) return "—";
    if (d < 60) return `${d}일`;
    if (d < 330) return `${Math.round(d / 30.4)}개월`;
    return `${Math.round(d / 365)}년`;
  }

  const api = { num, ratio, percentile, spotValue, historySeries, summary, curvePoints, niceTicks, yDomain, xScale, fmtNum, fmtSignedPct, tenorLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirVixTermCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
