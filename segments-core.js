// segments-core.js — 사업부문·지역·제품별 매출 이력 순수 계산. DOM·네트워크 없음.
// 화면: segments.js(종목 분석 › 재무 탭 #segmentsSection). 데이터: scripts/build_segments_us.py(SEC 10-K XBRL 차원).
// node 테스트: scripts/tests/test_segments_core.mjs
//
// 입력 파일 스키마는 build_segments_us.py docstring(schema 1). 공시 숫자를 옮긴 것이며 추정으로 채우지 않는다.
// 정의(화면 각주와 같은 문장 — 바꾸면 segments.js 도 같이)
//   비중 = 부문 매출 ÷ 부문 합(최신 회계연도). 부문 합이 총매출과 다를 수 있어(부문 간 거래 포함·일부만 공시)
//          총매출이 아니라 부문 합을 분모로 쓴다.
//   전년비 = 최신 연도 ÷ 직전 연도 − 1 (두 해 모두 양수이고 회계연도가 연속일 때만)
//   3년 연평균 = (최신 ÷ 3년 전)^(1/3) − 1 (두 해 모두 양수일 때만)
//   합계 대조: |부문 합 ÷ 총매출 − 1| ≤ 2% 면 일치. 아니면 차이를 %로 표시(빌더 check 와 같은 기준)
(function (root) {
  "use strict";

  const AXIS_ORDER = ["segment", "product", "geo"];
  const AXIS_LABEL = { segment: "사업부문", product: "제품·서비스", geo: "지역" };
  const SUM_TOL = 0.02;
  const MAX_MEMBERS = 7;           // 이보다 많으면 작은 멤버는 '기타(표시 외 n개)' 로 묶는다

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  function availableAxes(file) {
    const axes = (file && file.axes) || {};
    return AXIS_ORDER.filter((k) => axes[k] && Array.isArray(axes[k].years) && axes[k].years.length);
  }

  function growth(now, then, years) {
    const a = num(now), b = num(then);
    if (a === null || b === null || a <= 0 || b <= 0 || !(years > 0)) return null;
    return years === 1 ? a / b - 1 : Math.pow(a / b, 1 / years) - 1;
  }

  // 축 하나를 화면용으로 정리: 상위 멤버 + '기타' 묶음, 연도별 막대, 최신 비중, 성장률, 합계 대조.
  function axisView(file, axisKey, opts) {
    const o = opts || {};
    const maxMembers = o.maxMembers || MAX_MEMBERS;
    const axis = file && file.axes && file.axes[axisKey];
    if (!axis || !Array.isArray(axis.years) || !axis.years.length) return null;
    const years = axis.years.slice().sort((a, b) => a.fy - b.fy);
    const latest = years[years.length - 1];
    const labelOf = new Map((axis.members || []).map((m) => [m.id, m.label || m.id]));
    // 멤버 순서: 최신 연도 값 큰 순, 최신 연도에 없는 멤버는 뒤(파일의 members 순서를 따른다)
    const order = (axis.members || []).map((m) => m.id);
    years.forEach((y) => Object.keys(y.v || {}).forEach((id) => { if (!order.includes(id)) order.push(id); }));
    const inLatest = order.filter((id) => num((latest.v || {})[id]) !== null).sort((a, b) => latest.v[b] - latest.v[a]);
    const notLatest = order.filter((id) => !inLatest.includes(id));
    const ranked = inLatest.concat(notLatest);
    let shown = ranked;
    let hidden = [];
    if (ranked.length > maxMembers) {
      shown = inLatest.slice(0, maxMembers - 1);
      hidden = ranked.filter((id) => !shown.includes(id));
    }
    const OTHER = "__other__";
    const members = shown.map((id) => ({ id, label: labelOf.get(id) || id }));
    if (hidden.length) members.push({ id: OTHER, label: `기타(표시 외 ${hidden.length}개)`, other: true, ids: hidden });

    const bars = years.map((y) => {
      const v = {};
      shown.forEach((id) => { const x = num((y.v || {})[id]); if (x !== null) v[id] = x; });
      if (hidden.length) {
        let s = 0, any = false;
        hidden.forEach((id) => { const x = num((y.v || {})[id]); if (x !== null) { s += x; any = true; } });
        if (any) v[OTHER] = s;
      }
      const sum = num(y.sum) !== null ? y.sum : Object.values(y.v || {}).reduce((a, b) => a + (num(b) || 0), 0);
      const total = num(y.total);
      return { fy: y.fy, end: y.end || null, v, sum, total, gap: total ? sum / total - 1 : null };
    });

    const latestBar = bars[bars.length - 1];
    const byFy = new Map(bars.map((b) => [b.fy, b]));
    const prev = byFy.get(latest.fy - 1) || null;
    const back3 = byFy.get(latest.fy - 3) || null;
    const rows = members.map((m) => {
      const value = num(latestBar.v[m.id]);
      const share = value !== null && latestBar.sum > 0 ? value / latestBar.sum : null;
      // '기타' 묶음은 연도마다 구성이 달라 성장률을 내지 않는다
      const yoy = m.other || !prev ? null : growth(value, prev.v[m.id], 1);
      const cagr3 = m.other || !back3 ? null : growth(value, back3.v[m.id], 3);
      return { id: m.id, label: m.label, other: !!m.other, value, share, yoy, cagr3 };
    });
    const totalRow = {
      value: latestBar.sum,
      yoy: prev ? growth(latestBar.sum, prev.sum, 1) : null,
      cagr3: back3 ? growth(latestBar.sum, back3.sum, 3) : null,
    };
    // 판정은 최신 연도 기준(빌더 check 와 같은 규칙). 최신 연도에 총매출이 없으면 대조 불가.
    const gap = latestBar.gap;
    const check = gap === null ? "noTotal" : Math.abs(gap) <= SUM_TOL ? "ok" : "mismatch";
    return {
      axis: axisKey, label: AXIS_LABEL[axisKey] || axisKey, concept: axis.concept || "",
      members, bars, rows, totalRow, check, gap, latestFy: latest.fy, dropped: axis.dropped || [],
    };
  }

  // 합계 대조 문장(화면·툴팁 공용). null 이면 표시할 것 없음(일치).
  function checkNote(view) {
    if (!view) return null;
    if (view.check === "noTotal") return "같은 공시에 차원 없는 총매출 값이 없어 부문 합을 총매출과 대조하지 못했습니다.";
    if (view.check !== "mismatch" || view.gap === null) return null;
    const pct = (view.gap * 100).toFixed(1);
    return `최신 연도 ${view.label} 합이 총매출과 ${view.gap > 0 ? "+" : ""}${pct}% 다릅니다 — 부문 간 거래가 포함됐거나(합 > 총매출) 일부 ${view.label}만 공시한 경우(합 < 총매출)입니다. 비중은 ${view.label} 합 기준입니다.`;
  }

  const api = { AXIS_ORDER, AXIS_LABEL, SUM_TOL, MAX_MEMBERS, availableAxes, axisView, checkNote, growth };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MirSegmentsCore = api;
})(typeof window !== "undefined" ? window : globalThis);
