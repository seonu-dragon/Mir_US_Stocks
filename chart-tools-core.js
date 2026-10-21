// 가격 차트 도구(비교 겹쳐 보기·드로잉 선택/삭제/실행취소·자석·오른쪽 여백·분봉 자동 갱신 판정)
// — 순수 계산 모듈(DOM 없음). 브라우저에서는 window.MirChartTools, node 테스트
// (scripts/tests/test_chart_tools_core.mjs)에서는 module.exports 로 같은 코드를 쓴다.
// IIFE 라 최상위 이름을 전역에 흘리지 않는다. 상태·그리기·이벤트는 chart.js 가 갖는다.
//
// 좌표는 전부 SVG viewBox 단위(화면 픽셀이 아님)다. chart.js 가 저장 모델({type,t1,p1,t2,p2},
// 날짜·가격 앵커)을 현재 화면 좌표로 바꿔 넘기고, 여기는 기하만 본다.
(function (root) {
  "use strict";

  const DRAW_TYPES = ["trend", "ray", "hline", "rect", "fib"];
  const UNDO_MAX = 20;

  function finite(v) { return typeof v === "number" && Number.isFinite(v); }

  // 점 (px,py) 에서 선분(또는 p1→p2 방향 반직선) 까지 거리.
  function distToSegment(px, py, x1, y1, x2, y2, ray) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (!(len2 > 0)) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    if (t < 0) t = 0;
    else if (t > 1 && !ray) t = 1;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // 반직선 끝점: p1→p2 방향으로 상자(box = {left,right,top,bottom}) 가장자리까지 늘린다.
  // 방향이 없으면(두 점이 같으면) p2 그대로.
  function rayEnd(x1, y1, x2, y2, box) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (!dx && !dy) return { x: x2, y: y2 };
    const ks = [];
    if (dx > 0) ks.push((box.right - x1) / dx);
    else if (dx < 0) ks.push((box.left - x1) / dx);
    if (dy > 0) ks.push((box.bottom - y1) / dy);
    else if (dy < 0) ks.push((box.top - y1) / dy);
    const pos = ks.filter((k) => k > 0);
    const k = Math.max(1, pos.length ? Math.min(...pos) : 1);
    return { x: x1 + dx * k, y: y1 + dy * k };
  }

  // 화면 좌표로 바꾼 도형 하나와 점의 거리. 맞을 수 없으면 Infinity.
  // shape: { type, x1, y1, x2, y2, left, right, levels? }  (levels = 피보 수평선들의 y)
  function shapeDistance(shape, px, py) {
    if (!shape) return Infinity;
    const { type, x1, y1, x2, y2 } = shape;
    if (type === "hline") {
      if (finite(shape.left) && finite(shape.right) && (px < shape.left || px > shape.right)) return Infinity;
      return Math.abs(py - y1);
    }
    if (type === "trend") return distToSegment(px, py, x1, y1, x2, y2, false);
    if (type === "ray") return distToSegment(px, py, x1, y1, x2, y2, true);
    if (type === "rect") {
      const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
      // 안쪽 클릭도 선택(TradingView 와 같다). 거리 0 이면 가장자리보다 뒤로 밀리지 않게 약간 더한다.
      if (px >= l && px <= r && py >= t && py <= b) {
        const edge = Math.min(px - l, r - px, py - t, b - py);
        return Math.min(edge, 3);
      }
      const cx = Math.max(l, Math.min(r, px));
      const cy = Math.max(t, Math.min(b, py));
      return Math.hypot(px - cx, py - cy);
    }
    if (type === "fib") {
      const l = Math.min(x1, x2), r = Math.max(x1, x2);
      const levels = Array.isArray(shape.levels) && shape.levels.length ? shape.levels : [y1, y2];
      let best = Infinity;
      for (const y of levels) {
        if (!finite(y)) continue;
        const cx = Math.max(l, Math.min(r, px));
        best = Math.min(best, Math.hypot(px - cx, py - y));
      }
      return best;
    }
    return Infinity;
  }

  // 가장 가까운 도형의 인덱스(허용 거리 tol 안). 같으면 나중에 그린 것(위에 있는 것)을 고른다.
  function hitTest(shapes, px, py, tol) {
    let best = -1;
    let bestD = Infinity;
    (shapes || []).forEach((s, i) => {
      const d = shapeDistance(s, px, py);
      if (d <= tol && d <= bestD) { best = i; bestD = d; }
    });
    return best;
  }

  // 자석: 커서 x 에서 가장 가까운 봉의 시·고·저·종 중 커서 y 와 가장 가까운 값에 붙인다.
  // pt = { xn, price, y }, bars = [{o,h,l,c}], yOf(price) → viewBox y, xnOf(idx) → 비율.
  // tol 안에 없으면 그대로 돌려준다.
  function snapToOhlc(pt, bars, yOf, tol, xnOf) {
    const n = bars ? bars.length : 0;
    if (!n || !pt || !finite(pt.xn) || !finite(pt.y)) return pt;
    const toXn = xnOf || ((i) => (n > 1 ? i / (n - 1) : 0));
    const idx = Math.max(0, Math.min(n - 1, Math.round(pt.xn * (n > 1 ? n - 1 : 0))));
    const bar = bars[idx];
    if (!bar) return pt;
    let best = null;
    let bestD = Infinity;
    for (const k of ["o", "h", "l", "c"]) {
      const p = Number(bar[k]);
      if (!finite(p)) continue;
      const y = yOf(p);
      if (!finite(y)) continue;
      const d = Math.abs(y - pt.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best == null || bestD > tol) return pt;
    return { xn: toXn(idx), price: best, y: yOf(best), snapped: true };
  }

  // 실행취소 스택: 변경 직전 상태를 넣는다. 최근 max 단계만 남긴다(오래된 것부터 버림).
  function pushUndo(stack, entry, max) {
    const out = (stack || []).concat([entry]);
    const cap = max || UNDO_MAX;
    return out.length > cap ? out.slice(out.length - cap) : out;
  }

  // 저장 항목 정리: 알려진 종류 + 날짜·가격 앵커가 유한한 것만. 예전 저장분(trend/fib)도 그대로 통과.
  function validDrawing(d) {
    return Boolean(d && DRAW_TYPES.includes(d.type)
      && finite(d.t1) && finite(d.t2) && finite(d.p1) && finite(d.p2));
  }

  // 비교 겹쳐 보기: 보이는 구간 첫 유효 봉 기준 수익률. base = 메인 종목 rows, aligned = 같은 길이
  // (날짜 맞춤, 빈 날은 null). 같은 첫 봉 인덱스에서 둘 다 값이 있어야 시작한다.
  // 돌려주는 prices 는 메인 종목 첫 종가 × (1 + 수익률) — 가격 축에 그대로 그릴 수 있다.
  function compareOverlay(baseRows, alignedRows) {
    const n = baseRows ? baseRows.length : 0;
    const empty = { pct: Array(n).fill(null), prices: Array(n).fill(null), lastPct: null, lastIdx: -1 };
    if (!n || !alignedRows || alignedRows.length !== n) return empty;
    let start = -1;
    for (let i = 0; i < n; i += 1) {
      const b = baseRows[i];
      const a = alignedRows[i];
      if (b && finite(Number(b.c)) && Number(b.c) > 0 && a && finite(Number(a.c)) && Number(a.c) > 0) { start = i; break; }
    }
    if (start < 0) return empty;
    const base0 = Number(baseRows[start].c);
    const cmp0 = Number(alignedRows[start].c);
    const pct = alignedRows.map((a, i) => {
      if (i < start || !a || !finite(Number(a.c)) || !(Number(a.c) > 0)) return null;
      return (Number(a.c) / cmp0 - 1) * 100;
    });
    const prices = pct.map((p) => (p == null ? null : base0 * (1 + p / 100)));
    let lastIdx = -1;
    for (let i = n - 1; i >= 0; i -= 1) { if (pct[i] != null) { lastIdx = i; break; } }
    return { pct, prices, lastPct: lastIdx >= 0 ? pct[lastIdx] : null, lastIdx };
  }

  // 축 라벨 겹침 풀기: ys(원하는 중심 y) 순서를 유지하며 최소 간격 gap 을 두고 [top,bottom] 안에 둔다.
  function spreadLabels(ys, gap, top, bottom) {
    const idx = ys.map((y, i) => ({ y, i })).filter((o) => finite(o.y)).sort((a, b) => a.y - b.y);
    const out = ys.slice();
    if (!idx.length) return out;
    const pos = idx.map((o) => Math.max(top, Math.min(bottom, o.y)));
    for (let k = 1; k < pos.length; k += 1) if (pos[k] < pos[k - 1] + gap) pos[k] = pos[k - 1] + gap;
    if (pos[pos.length - 1] > bottom) {
      pos[pos.length - 1] = bottom;
      for (let k = pos.length - 2; k >= 0; k -= 1) if (pos[k] > pos[k + 1] - gap) pos[k] = pos[k + 1] - gap;
    }
    idx.forEach((o, k) => { out[o.i] = pos[k]; });
    return out;
  }

  // 오른쪽 여백(미래 봉 자리) 봉 수: 마지막 봉이 가격 축에 붙지 않게. 봉이 적으면 최소 2봉.
  function rightPadBars(n) {
    if (!(n > 1)) return 0;
    return Math.max(2, Math.ceil(n * 0.04));
  }

  // 분봉 자동 갱신 여부: 분봉 보기 + 정규장(open) + 탭이 보임.
  function shouldRefreshIntraday(opts) {
    const o = opts || {};
    return Boolean(o.intraday && o.visible && o.session && o.session.state === "open");
  }

  const api = {
    DRAW_TYPES,
    UNDO_MAX,
    distToSegment,
    rayEnd,
    shapeDistance,
    hitTest,
    snapToOhlc,
    pushUndo,
    validDrawing,
    compareOverlay,
    spreadLabels,
    rightPadBars,
    shouldRefreshIntraday,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirChartTools = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
