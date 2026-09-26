// 산업 지표 차트 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirIndustryChartCore, node 테스트(scripts/tests/test_industry_chart_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 왜 따로 두나: x 축을 '점 순번'으로 그리면 적립 중인 월간 시리즈(대만 월매출: 2025-08 · 2026-07 · 2026-08)
// 가 11개월 공백을 1칸으로 보이고, 막대 폭이 (폭 / 점 수) 라 첫·끝 막대가 축 밖으로 삐져나갔다.
// 여기서는 x 를 날짜 비례로, 막대 폭을 '주기 1칸'으로, 도메인을 반 칸씩 넓혀 막대가 축 안에 머물게 한다.
(function (root) {
  "use strict";

  const DAY_MS = 86400000;
  const PERIOD_DAYS = { D: 1, W: 7, M: 30.44, Q: 91.31, A: 365.25 };
  const KEY_RE = { D: /^\d{4}-\d{2}-\d{2}$/, W: /^\d{4}-\d{2}-\d{2}$/, M: /^\d{4}-(0[1-9]|1[0-2])$/, Q: /^\d{4}-Q[1-4]$/, A: /^\d{4}$/ };

  // 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY-Qn' | 'YYYY' → UTC ms(기간의 첫날). 형식이 틀리면 NaN.
  function keyTime(key) {
    if (typeof key !== "string") return NaN;
    let m = /^(\d{4})-Q([1-4])$/.exec(key);
    if (m) return Date.UTC(Number(m[1]), (Number(m[2]) - 1) * 3, 1);
    m = /^(\d{4})-(\d{2})$/.exec(key);
    if (m) { const mo = Number(m[2]); return mo >= 1 && mo <= 12 ? Date.UTC(Number(m[1]), mo - 1, 1) : NaN; }
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (m) {
      const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const d = new Date(t);
      return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? t : NaN;
    }
    if (/^\d{4}$/.test(key)) return Date.UTC(Number(key), 0, 1);
    return NaN;
  }

  // 시리즈 무결성 — 빌더 게이트(build_industry_indicators.sanitize_series)와 같은 규칙을 화면 쪽 테스트에서 재확인한다.
  // 반환: [{ kind: "format"|"order"|"duplicate"|"future"|"value", date }]
  function seriesIssues(series, freq, asOfDate) {
    const out = [];
    const re = KEY_RE[freq] || null;
    const limit = asOfDate ? keyTime(String(asOfDate).slice(0, 10)) : NaN;
    let prev = -Infinity;
    const seen = new Set();
    (Array.isArray(series) ? series : []).forEach((p) => {
      const key = p && p.date;
      const t = keyTime(key);
      if (!Number.isFinite(t) || (re && !re.test(key))) { out.push({ kind: "format", date: key }); return; }
      if (seen.has(key)) out.push({ kind: "duplicate", date: key });
      else if (t <= prev) out.push({ kind: "order", date: key });
      seen.add(key);
      prev = Math.max(prev, t);
      if (Number.isFinite(limit) && t > limit) out.push({ kind: "future", date: key });
      const v = p.val;
      if (v == null || !Number.isFinite(Number(v))) out.push({ kind: "value", date: key });
    });
    return out;
  }

  // 1·2·5×10^k 눈금. 도메인은 눈금 끝까지 넓힌다(라벨이 67.38·-8.08 같은 값이 되지 않게).
  function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }
  function niceTicks(mn, mx, target) {
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) return { min: 0, max: 1, ticks: [0, 1], step: 1 };
    if (mn === mx) { const d = Math.abs(mn) * 0.05 || 1; mn -= d; mx += d; }
    const step = niceStep(mx - mn, target || 4);
    const lo = Math.floor(mn / step + 1e-9) * step;
    const hi = Math.ceil(mx / step - 1e-9) * step;
    const ticks = [];
    for (let v = lo, i = 0; v <= hi + step * 1e-6 && i < 50; v = lo + step * (++i)) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { min: lo, max: hi, ticks, step };
  }

  // y 도메인. zeroFloor: 레벨 막대(양수)는 0 에서 시작 — 0 아래로 여백을 두지 않는다.
  function yDomain(nums, { zeroFloor = false, band = null, target = 4 } = {}) {
    const ok = nums.filter((v) => v != null && Number.isFinite(v));
    if (!ok.length) return null;
    let mn = Math.min(...ok), mx = Math.max(...ok);
    if (band && band.sd > 0) { mn = Math.min(mn, band.mean - 2 * band.sd); mx = Math.max(mx, band.mean + 2 * band.sd); }
    if (zeroFloor && mn > 0) mn = 0;
    return niceTicks(mn, mx, target);
  }

  function median(arr) {
    if (!arr.length) return NaN;
    const s = arr.slice().sort((a, b) => a - b);
    const h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  // x 배치. times: 오름차순 ms. barMode 면 도메인을 반 칸씩 넓혀 첫·끝 막대가 축 안에 들어오게 한다.
  function xLayout(times, { freq = "M", barMode = false, left = 0, width = 100 } = {}) {
    const n = times.length;
    const diffs = [];
    for (let i = 1; i < n; i += 1) if (times[i] > times[i - 1]) diffs.push(times[i] - times[i - 1]);
    const period = (PERIOD_DAYS[freq] || 30.44) * DAY_MS;
    const slot = Math.min(period, diffs.length ? median(diffs) : period);
    let d0 = n ? times[0] : 0, d1 = n ? times[n - 1] : 1;
    if (barMode) { d0 -= slot / 2; d1 += slot / 2; }
    if (!(d1 > d0)) { d0 -= period / 2; d1 += period / 2; }
    const x = (t) => left + width * (t - d0) / (d1 - d0);
    // 막대 폭: 한 칸의 62%, 그리고 가장 가까운 이웃 간격의 80% 를 넘지 않게(겹침 방지).
    let barWidth = 0;
    if (barMode) {
      const minGap = diffs.length ? Math.min(...diffs) : slot;
      barWidth = Math.max(1, Math.min(width * slot / (d1 - d0) * 0.62, width * minGap / (d1 - d0) * 0.8, 48));
    }
    return { d0, d1, slot, x, xs: times.map(x), barWidth };
  }

  const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 36, 60, 120, 240];
  // 달 경계에 찍는 날짜 눈금. maxTicks 는 폭에서 정한다(라벨 폭 + 여백).
  function timeTicks(d0, d1, maxTicks) {
    const a = new Date(d0), b = new Date(d1);
    const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    const cap = Math.max(2, maxTicks || 6);
    const step = MONTH_STEPS.find((s) => Math.floor(months / s) + 1 <= cap) || MONTH_STEPS[MONTH_STEPS.length - 1];
    const yearly = step >= 12;
    let y = a.getUTCFullYear(), m = a.getUTCMonth();
    // 첫 눈금: d0 이후 첫 경계(연 단위면 1월, 그 외 step 배수 달)
    if (yearly) { if (Date.UTC(y, 0, 1) < d0) y += 1; m = 0; while (y % (step / 12)) y += 1; }
    else { if (Date.UTC(y, m, 1) < d0) m += 1; while (m % step) m += 1; }
    const out = [];
    for (let i = 0; i < 400; i += 1) {
      const t = Date.UTC(y, m, 1);
      if (t > d1) break;
      const d = new Date(t);
      const label = yearly ? String(d.getUTCFullYear()) : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      out.push({ t, label });
      m += step;
      while (m >= 12) { m -= 12; y += 1; }
    }
    return out;
  }

  // SVG 텍스트 폭 어림(11px 숫자·라틴 기준). 축 여백·겹침 판정에 쓴다.
  function textWidth(text, fontPx) {
    const s = String(text == null ? "" : text);
    let w = 0;
    for (const ch of s) w += /[ㄱ-힣一-鿿]/.test(ch) ? 1.0 : /[.,:\s]/.test(ch) ? 0.32 : 0.6;
    return w * (fontPx || 11);
  }

  // 렌더된 SVG 문자열 감사(테스트·진단용). 플롯 영역 밖 도형, 축 라벨 잘림·겹침을 찾는다.
  // box: { W, H, padL, padR, padT, padB }. 반환: 문제 문자열 배열.
  function auditSvg(svg, box, { fontPx = 11, eps = 0.6 } = {}) {
    const problems = [];
    const L = box.padL, R = box.W - box.padR, T = box.padT, B = box.H - box.padB;
    const num = (s) => Number(s);
    const inX = (v) => v >= L - eps && v <= R + eps;
    const inY = (v) => v >= T - eps && v <= B + eps;
    const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? m[1] : null; };
    (svg.match(/<rect\b[^>]*>/g) || []).forEach((tag) => {
      const x = num(attr(tag, "x")), y = num(attr(tag, "y")), w = num(attr(tag, "width")), h = num(attr(tag, "height"));
      if (![x, y, w, h].every(Number.isFinite)) { problems.push(`rect NaN: ${tag.slice(0, 60)}`); return; }
      if (!inX(x) || !inX(x + w)) problems.push(`rect x ${x.toFixed(1)}..${(x + w).toFixed(1)} 가 플롯(${L}..${R}) 밖`);
      if (!inY(y) || !inY(y + h)) problems.push(`rect y ${y.toFixed(1)}..${(y + h).toFixed(1)} 가 플롯(${T}..${B}) 밖`);
    });
    (svg.match(/<path\b[^>]*>/g) || []).forEach((tag) => {
      const d = attr(tag, "d") || "";
      if (/NaN|Infinity/.test(d)) { problems.push("path 좌표 NaN"); return; }
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        if (!inX(nums[i])) { problems.push(`path x ${nums[i]} 가 플롯(${L}..${R}) 밖`); break; }
        if (!inY(nums[i + 1])) { problems.push(`path y ${nums[i + 1]} 가 플롯(${T}..${B}) 밖`); break; }
      }
    });
    (svg.match(/<line\b[^>]*>/g) || []).forEach((tag) => {
      const ys = [num(attr(tag, "y1")), num(attr(tag, "y2"))], xs = [num(attr(tag, "x1")), num(attr(tag, "x2"))];
      if (![...xs, ...ys].every(Number.isFinite)) { problems.push("line NaN"); return; }
      if (!xs.every(inX) || !ys.every(inY)) problems.push(`line (${xs.join(",")} / ${ys.map((v) => v.toFixed(1)).join(",")}) 가 플롯 밖`);
    });
    // 축 라벨: 뷰박스 안에 들어오는지 + 같은 줄(y) 라벨끼리 겹치지 않는지
    const texts = [];
    (svg.match(/<text\b[^>]*>[^<]*<\/text>/g) || []).forEach((tag) => {
      const x = num(attr(tag, "x")), y = num(attr(tag, "y"));
      const anchor = attr(tag, "text-anchor") || "start";
      const label = tag.replace(/<[^>]*>/g, "");
      const w = textWidth(label, fontPx);
      const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
      if (![x, y].every(Number.isFinite)) { problems.push(`text NaN: ${label}`); return; }
      if (x0 < -eps || x0 + w > box.W + eps) problems.push(`라벨 '${label}' 가 가로로 잘림(${x0.toFixed(0)}..${(x0 + w).toFixed(0)} / ${box.W})`);
      if (y - fontPx < -eps || y > box.H + eps) problems.push(`라벨 '${label}' 가 세로로 잘림`);
      texts.push({ x0, x1: x0 + w, y, label });
    });
    for (let i = 0; i < texts.length; i += 1) {
      for (let j = i + 1; j < texts.length; j += 1) {
        const a = texts[i], b = texts[j];
        if (Math.abs(a.y - b.y) < fontPx && a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1) problems.push(`라벨 겹침 '${a.label}' · '${b.label}'`);
      }
    }
    return problems;
  }

  const api = { DAY_MS, PERIOD_DAYS, keyTime, seriesIssues, niceTicks, yDomain, xLayout, timeTicks, textWidth, auditSvg };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirIndustryChartCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
