// 시장 폭 추이 — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirBreadthHistoryCore, node 테스트 scripts/tests/test_breadth_history_core.mjs.
// 입력 window.MARKET_BREADTH(scripts/build_market_breadth.py, 시장별 파일):
//   { updatedAtKst, market, universe, count, indexLabel, rows: [{d, n, above50, above200, adv, dec, adLine, mcclellan, nh, nl, bpi, bpiIdx}, …],
//     sectors: [{name, n, above50: [rows 길이], above200: [...], bpi}] }
(function (root) {
  "use strict";

  // 패널 정의 — pct 는 0~100 고정 축(가운데 50 기준선), 나머지는 0 기준 대칭 축.
  const PANELS = [
    { key: "above50", label: "50일선 위 종목 비율", unit: "%", axis: "pct" },
    { key: "above200", label: "200일선 위 종목 비율", unit: "%", axis: "pct" },
    { key: "mcclellan", label: "맥클렐런 오실레이터", unit: "", axis: "zero" },
    { key: "nhnl", label: "52주 신고가 − 신저가", unit: "개", axis: "zero" },
    // 강세 비율 지수 — 3박스 반전 P&F 최근 신호가 매수인 종목 비율. bpiIdx 의 이름은 payload.indexLabel(S&P 500 · 코스피 200).
    { key: "bpiIdx", label: "BPI", unit: "%", axis: "pct", indexLabel: true },
    { key: "bpi", label: "BPI · 전체", unit: "%", axis: "pct" },
  ];

  /** 패널 이름 — 지수 BPI 는 'BPI · S&P 500' 처럼 payload 의 지수 이름을 붙인다. */
  function panelLabel(def, payload) {
    if (def.indexLabel && payload && payload.indexLabel) return `${def.label} · ${payload.indexLabel}`;
    return def.label;
  }

  /** 섹터 표 행 — 최신 50·200일선 위 비율, lookback(기본 21거래일) 전 대비 변화, BPI. 50일선 위 비율 높은 순. */
  function sectorRows(payload, lookback = 21) {
    const list = (payload && Array.isArray(payload.sectors)) ? payload.sectors : [];
    const lastOf = (arr) => {
      if (!Array.isArray(arr)) return { v: null, chg: null };
      let i = arr.length - 1;
      while (i >= 0 && !Number.isFinite(arr[i])) i -= 1;
      if (i < 0) return { v: null, chg: null };
      const j = i - lookback;
      const base = j >= 0 && Number.isFinite(arr[j]) ? arr[j] : null;
      return { v: arr[i], chg: base === null ? null : Math.round((arr[i] - base) * 10) / 10 };
    };
    return list.filter((s) => s && s.name).map((s) => {
      const a = lastOf(s.above50);
      const b = lastOf(s.above200);
      return { name: s.name, n: s.n, above50: a.v, chg50: a.chg, above200: b.v, chg200: b.chg,
        bpi: Number.isFinite(s.bpi) ? s.bpi : null };
    }).sort((x, y) => (Number.isFinite(y.above50) ? y.above50 : -1) - (Number.isFinite(x.above50) ? x.above50 : -1));
  }

  /** rows → 패널 값 [{d, v}] (null 제외). nhnl 은 nh − nl. */
  function series(payload, key) {
    const rows = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
    const out = [];
    for (const r of rows) {
      if (!r || !r.d) continue;
      const v = key === "nhnl"
        ? (Number.isFinite(r.nh) && Number.isFinite(r.nl) ? r.nh - r.nl : null)
        : (Number.isFinite(r[key]) ? r[key] : null);
      if (v !== null) out.push({ d: r.d, v });
    }
    return out;
  }

  /** 최신값과 lookback(기본 21거래일 ≈ 1개월) 전 대비 변화. 점이 없으면 null. */
  function summary(points, lookback = 21) {
    if (!points || !points.length) return null;
    const last = points[points.length - 1];
    const base = points.length > lookback ? points[points.length - 1 - lookback] : points[0];
    return { d: last.d, v: last.v, baseD: base.d, change: Math.round((last.v - base.v) * 10) / 10 };
  }

  /** y 축 범위 — pct 는 0~100, zero 는 ±최대 절댓값(0 이면 ±1). */
  function domain(points, axis) {
    if (axis === "pct") return [0, 100];
    const m = Math.max(1, ...points.map((p) => Math.abs(p.v)));
    return [-m, m];
  }

  /** 점 → SVG path(d). x 는 0~w 등간격, y 는 위가 큰 값. */
  function linePath(points, w, h, dom) {
    if (!points || points.length < 2) return "";
    const [lo, hi] = dom;
    const span = hi - lo || 1;
    const step = w / (points.length - 1);
    return points.map((p, i) => {
      const y = h - ((p.v - lo) / span) * h;
      return `${i ? "L" : "M"}${(i * step).toFixed(2)} ${Math.min(h, Math.max(0, y)).toFixed(2)}`;
    }).join(" ");
  }

  /** 기준선(pct 는 50, zero 는 0)의 y. */
  function baselineY(axis, h, dom) {
    const ref = axis === "pct" ? 50 : 0;
    const [lo, hi] = dom;
    return h - ((ref - lo) / ((hi - lo) || 1)) * h;
  }

  function fmtValue(v, unit) {
    if (!Number.isFinite(v)) return "";
    if (unit === "%") return `${v.toFixed(1)}%`;
    if (unit === "개") return `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("ko-KR")}개`;
    return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
  }

  function fmtChange(c, unit) {
    if (!Number.isFinite(c)) return "";
    const s = c > 0 ? "+" : "";
    if (unit === "%") return `${s}${c.toFixed(1)}%p`;
    if (unit === "개") return `${s}${Math.round(c).toLocaleString("ko-KR")}개`;
    return `${s}${c.toFixed(1)}`;
  }

  /** '2026-10-21' → '10/21', 해가 다르면 '25/10/21'. */
  function shortDate(iso, refIso) {
    const [y, m, d] = String(iso || "").split("-");
    if (!d) return "";
    const ry = String(refIso || "").slice(0, 4);
    return `${ry && ry !== y ? `${y.slice(2)}/` : ""}${Number(m)}/${Number(d)}`;
  }

  const api = { PANELS, panelLabel, sectorRows, series, summary, domain, linePath, baselineY, fmtValue, fmtChange, shortDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirBreadthHistoryCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
