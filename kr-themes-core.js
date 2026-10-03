// 국내 테마 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirKrThemesCore, node 테스트(scripts/tests/test_kr_themes_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 입력(data/korea/themes.js · build_kr_themes.py):
//   KR_THEMES.themes  [{ id, name, group, desc, v, filter?:{pbMax}, members:[{ t, kw, n, by:"rule"|"llm", pb? }] }]
//   KR_THEMES.reports { 티커: [접수번호, 보고서명, 접수일, 회사명] }
//   근거 파일(data/korea/themes/<id>.json) { id, ev: { 티커: [문장, 잘림표시(1=앞, 2=뒤)] } }
// 등락은 시장 스냅샷 종목 행(changePct·weekChangePct·monthChangePct·marketCapB)으로 계산한다 —
// 스냅샷 종가 기준이라 장중 실시간이 아니다.
(function (root) {
  "use strict";

  const PERIOD_KEYS = { d: "changePct", w: "weekChangePct", m: "monthChangePct", q: "threeMonthChangePct" };
  // 기간별로 closeSeries 끝에서 몇 개의 일간 변화를 보는지(1주 5거래일·1개월 21·3개월은 시계열 전체).
  const PERIOD_BARS = { d: 1, w: 5, m: 21, q: Infinity };
  // 국내 가격제한폭 ±30%. 이보다 큰 하루 변동은 실제 거래가 아니라 액면병합·감자·거래재개 등
  // 수정되지 않은 가격이거나 스냅샷 필드 오류다(2026-10-02: 씨아이테크 +751%, 중앙첨단소재 changePct
  // +895% 인데 종가 시계열은 -0.5%). 이런 종목 하나가 테마 평균을 +51% 로 끌어올렸다.
  const LIMIT_PCT = 30.5;
  // 종가 시계열의 하루 변화는 제한폭으로 재면 안 된다 — yahoo-cache 종목은 빠진 날이 있어 이틀 상한가가
  // 한 칸에 +69% 로 붙는다(2026-10-02 티엠씨 +29.95% 상한가가 시계열로는 +35.9%). 그래서 시계열은
  // 빠진 날로는 설명 안 되는 급변(2배 초과·0.4배 미만 — 액면병합·감자·병합 수준)만 가격 이상으로 본다.
  const STEP_UP = 2.0, STEP_DOWN = 0.4;
  function badStep(a, b) {
    if (!(a > 0) || !(b > 0)) return false;
    const r = b / a;
    return r > STEP_UP || r < STEP_DOWN;
  }

  function finite(v) { return typeof v === "number" && Number.isFinite(v); }

  function num(raw) {
    const r = raw == null || raw === "" ? NaN : Number(raw);   // Number(null) 은 0 이라 결측을 보합으로 셀 뻔했다
    return finite(r) ? r : null;
  }

  // 이 종목의 이 기간 등락을 믿을 수 없나 — 일간 등락이 제한폭 밖이거나, 기간 안에 제한폭 밖 하루 점프가 있다.
  // limit 이 null 이면(가격제한폭 없는 시장) 검사하지 않는다.
  function suspect(s, period, limit) {
    const lim = limit === undefined ? LIMIT_PCT : limit;
    if (!s || lim == null) return false;
    const d = num(s.changePct);
    if (d != null && Math.abs(d) > lim) return true;
    const cs = Array.isArray(s.closeSeries) ? s.closeSeries : [];
    const bars = PERIOD_BARS[period] || 1;
    const start = Math.max(1, bars === Infinity ? 1 : cs.length - bars);
    for (let i = start; i < cs.length; i += 1) if (badStep(Number(cs[i - 1]), Number(cs[i]))) return true;
    return false;
  }

  function median(xs) {
    if (!xs.length) return null;
    const v = xs.slice().sort((a, b) => a - b);
    const h = Math.floor(v.length / 2);
    return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
  }

  // 테마의 수치 조건(저PBR 금융의 pbMax)을 통과한 편입 종목. PBR 을 모르면 뺀다(조건을 확인 못 함).
  function activeMembers(theme) {
    const members = Array.isArray(theme && theme.members) ? theme.members : [];
    const pbMax = theme && theme.filter && finite(theme.filter.pbMax) ? theme.filter.pbMax : null;
    if (pbMax == null) return members.slice();
    return members.filter((m) => finite(m.pb) && m.pb < pbMax);
  }

  // 편입 종목의 기간 등락 — 중앙값(med)·동일가중 평균(eq)·시총가중 평균(cap)·상승/하락 수.
  // stockMap: 티커 → 스냅샷 행. 등락이 없는 종목은 계산에서 빠지고 covered 에 안 센다.
  // 가격 이상(suspect) 종목은 모든 집계에서 빼고 excluded 에 티커를 남긴다 — 화면이 '몇 종목 제외'를 밝힌다.
  function perf(members, stockMap, period, opts) {
    const key = PERIOD_KEYS[period] || PERIOD_KEYS.d;
    const limit = opts && "limit" in opts ? opts.limit : LIMIT_PCT;
    let sum = 0, n = 0, wsum = 0, wret = 0, up = 0, down = 0;
    const vals = [], excluded = [];
    for (const m of members || []) {
      const s = stockMap && stockMap[m.t];
      const r = s ? num(s[key]) : null;
      if (r == null) continue;
      if (suspect(s, period, limit)) { excluded.push(m.t); continue; }
      n += 1;
      vals.push(r);
      sum += r;
      if (r > 0) up += 1;
      else if (r < 0) down += 1;
      const w = Number(s.marketCapB);
      if (finite(w) && w > 0) { wsum += w; wret += w * r; }
    }
    return {
      med: median(vals),
      eq: n ? sum / n : null,
      cap: wsum > 0 ? wret / wsum : null,
      covered: n,
      up, down, excluded,
    };
  }

  function weightKey(weight) { return weight === "cap" ? "cap" : weight === "eq" ? "eq" : "med"; }

  function themeStats(themes, stockMap, opts) {
    return (themes || []).map((th) => {
      const members = activeMembers(th);
      return {
        id: th.id, name: th.name, group: th.group, desc: th.desc,
        n: members.length,
        llm: members.filter((m) => m.by === "llm").length,
        d: perf(members, stockMap, "d", opts),
        w: perf(members, stockMap, "w", opts),
        m: perf(members, stockMap, "m", opts),
        q: perf(members, stockMap, "q", opts),
      };
    });
  }

  // 기간·가중 방식으로 정렬(내림차순). 편입 minN 종목 미만 테마는 순위에서 뺀다 — 한두 종목이면
  // '테마' 가 아니라 개별 종목 등락이다. 값이 없는 테마는 맨 뒤.
  function rankThemes(stats, period, weight, minN) {
    const p = PERIOD_KEYS[period] ? period : "d";
    const wk = weightKey(weight);
    const floor = finite(minN) ? minN : 0;
    const val = (s) => (s[p] && finite(s[p][wk]) ? s[p][wk] : null);
    return (stats || [])
      .filter((s) => s.n >= floor)
      .slice()
      .sort((a, b) => {
        const va = val(a), vb = val(b);
        if (va == null && vb == null) return b.n - a.n;
        if (va == null) return 1;
        if (vb == null) return -1;
        return vb - va;
      });
  }

  function statValue(stat, period, weight) {
    const cell = stat && stat[PERIOD_KEYS[period] ? period : "d"];
    const v = cell ? cell[weightKey(weight)] : null;
    return finite(v) ? v : null;
  }

  // 종목 → 그 종목이 든 테마 [{ id, name, group, kw, by, pb? }]. 수치 조건 밖(PBR 1배 이상)은 뺀다.
  function themesForTicker(themes, ticker) {
    const out = [];
    for (const th of themes || []) {
      const m = activeMembers(th).find((x) => x.t === ticker);
      if (m) out.push({ id: th.id, name: th.name, group: th.group, kw: m.kw, by: m.by, pb: m.pb, n: m.n, sub: !!m.sub });
    }
    return out;
  }

  // 테마 지수 — 편입 종목 종가(closeSeries) 끝 bars 개를 각자 첫 값=0% 로 맞춘 뒤 날마다 동일가중 평균.
  // 그 구간에 가격 이상(제한폭 밖 하루 점프)이 있거나 시계열이 짧은 종목은 뺀다. { series:[%...], n }
  function themeIndex(members, stockMap, bars, opts) {
    const limit = opts && "limit" in opts ? opts.limit : LIMIT_PCT;
    const len = Math.max(2, bars || 21);
    const rows = [];
    for (const m of members || []) {
      const s = stockMap && stockMap[m.t];
      const cs = s && Array.isArray(s.closeSeries) ? s.closeSeries.slice(-len).map(Number) : [];
      if (cs.length < len || !cs.every((v) => finite(v) && v > 0)) continue;
      let bad = false;
      if (limit != null) {
        for (let i = 1; i < cs.length; i += 1) if (badStep(cs[i - 1], cs[i])) { bad = true; break; }
        if (Math.abs(num(s.changePct) || 0) > limit) bad = true;
      }
      if (bad) continue;
      rows.push(cs.map((v) => (v / cs[0] - 1) * 100));
    }
    if (!rows.length) return { series: [], n: 0 };
    const series = [];
    for (let i = 0; i < len; i += 1) series.push(rows.reduce((a, r) => a + r[i], 0) / rows.length);
    return { series, n: rows.length };
  }

  // 한 종목 시계열을 0% 기준으로(벤치마크 선 — 코스피 200·S&P 500 ETF).
  function normSeries(s, bars) {
    const len = Math.max(2, bars || 21);
    const cs = s && Array.isArray(s.closeSeries) ? s.closeSeries.slice(-len).map(Number) : [];
    if (cs.length < 2 || !(cs[0] > 0) || !cs.every(finite)) return [];
    return cs.map((v) => (v / cs[0] - 1) * 100);
  }

  // 기간 등락 상위 k 종목(주도주). 가격 이상 종목은 뺀다. [{ t, r }]
  function leaders(members, stockMap, period, k, opts) {
    const key = PERIOD_KEYS[period] || PERIOD_KEYS.d;
    const limit = opts && "limit" in opts ? opts.limit : LIMIT_PCT;
    return (members || [])
      .map((m) => ({ t: m.t, s: stockMap && stockMap[m.t] }))
      .filter((x) => x.s && num(x.s[key]) != null && !suspect(x.s, period, limit))
      .map((x) => ({ t: x.t, r: num(x.s[key]) }))
      .sort((a, b) => b.r - a.r)
      .slice(0, k || 2);
  }

  // 시총가중 테마 등락에 대한 종목별 기여(%p) — w·r/Σw. 합하면 시총가중 등락이 된다. { 티커: {r, w, c} }
  function contributions(members, stockMap, period, opts) {
    const key = PERIOD_KEYS[period] || PERIOD_KEYS.d;
    const limit = opts && "limit" in opts ? opts.limit : LIMIT_PCT;
    const rows = [];
    let W = 0;
    for (const m of members || []) {
      const s = stockMap && stockMap[m.t];
      const r = s ? num(s[key]) : null;
      const w = s ? Number(s.marketCapB) : NaN;
      if (r == null || !finite(w) || w <= 0 || suspect(s, period, limit)) continue;
      rows.push({ t: m.t, r, w });
      W += w;
    }
    const out = {};
    for (const x of rows) out[x.t] = { r: x.r, w: W ? x.w / W : 0, c: W ? (x.w * x.r) / W : 0 };
    return out;
  }

  // 전 거래일 테마 값(순위 변동용) — 시계열 끝에서 두 번째 하루 변화. { id: 값 }
  function prevDayValues(themes, stockMap, weight, opts) {
    const limit = opts && "limit" in opts ? opts.limit : LIMIT_PCT;
    const wk = weightKey(weight);
    const out = {};
    for (const th of themes || []) {
      const vals = [];
      let sum = 0, W = 0, wr = 0;
      for (const m of activeMembers(th)) {
        const s = stockMap && stockMap[m.t];
        const cs = s && Array.isArray(s.closeSeries) ? s.closeSeries : [];
        if (cs.length < 3) continue;
        const a = Number(cs[cs.length - 3]), b = Number(cs[cs.length - 2]);
        if (!(a > 0) || !(b > 0)) continue;
        if (limit != null && badStep(a, b)) continue;
        const r = (b / a - 1) * 100;
        vals.push(r);
        sum += r;
        const w = Number(s.marketCapB);
        if (finite(w) && w > 0) { W += w; wr += w * r; }
      }
      if (!vals.length) continue;
      out[th.id] = wk === "med" ? median(vals) : wk === "cap" ? (W ? wr / W : null) : sum / vals.length;
    }
    return out;
  }

  // 값 맵 → 순위(1부터, 내림차순). ids 로 순위 낼 대상을 제한한다.
  function ranksOf(values, ids) {
    const list = (ids || Object.keys(values || {})).filter((id) => finite(values[id]));
    list.sort((a, b) => values[b] - values[a]);
    const out = {};
    list.forEach((id, i) => { out[id] = i + 1; });
    return out;
  }

  // 연관 테마 — 편입 종목 겹침(자카드). 공통 2종목 이상만. [{ id, name, common, j }]
  function related(themes, id, k) {
    const all = themes || [];
    const base = all.find((t) => t.id === id);
    if (!base) return [];
    const A = new Set(activeMembers(base).map((m) => m.t));
    if (!A.size) return [];
    const out = [];
    for (const th of all) {
      if (th.id === id) continue;
      const B = new Set(activeMembers(th).map((m) => m.t));
      let common = 0;
      B.forEach((t) => { if (A.has(t)) common += 1; });
      if (common < 2) continue;
      out.push({ id: th.id, name: th.name, common, j: common / (A.size + B.size - common) });
    }
    return out.sort((a, b) => b.j - a.j || b.common - a.common).slice(0, k || 5);
  }

  // 로테이션 사분면 — x: 1개월 등락, y: 1주 등락(둘 다 시장 기준선 대비 %p).
  function quadrant(x, y) {
    if (!finite(x) || !finite(y)) return "";
    if (x >= 0 && y >= 0) return "lead";       // 주도
    if (x >= 0) return "fade";                 // 약화
    if (y >= 0) return "rise";                 // 개선
    return "lag";                              // 소외
  }

  function dartUrl(rcept) {
    return /^\d{14}$/.test(String(rcept || "")) ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcept}` : "";
  }

  // 근거 문장을 [앞 조각, 키워드, 뒤 조각] 으로 — UI 가 각각 escape 해서 키워드만 강조한다.
  // 잘린 문장(c 비트)은 앞뒤에 '…' 를 붙인다. 키워드가 없으면 [전체, "", ""].
  function evidenceParts(ev, kw, cut) {
    const text = String(ev || "");
    const c = Number(cut) || 0;
    const pre = c & 1 ? "…" : "";
    const post = c & 2 ? "…" : "";
    const k = String(kw || "");
    const i = k ? text.indexOf(k) : -1;
    if (i < 0) return [pre + text + post, "", ""];
    return [pre + text.slice(0, i), k, text.slice(i + k.length) + post];
  }

  function fmtPct(v, digits) {
    if (!finite(v)) return "—";
    const d = finite(digits) ? digits : 1;
    const r = Number(v.toFixed(d));
    return `${r > 0 ? "+" : ""}${r.toFixed(d)}%`;
  }

  function tone(v) {
    return finite(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : "";
  }

  // 그룹 목록(사전 순서 유지).
  function groups(themes) {
    const seen = [];
    for (const th of themes || []) if (th.group && !seen.includes(th.group)) seen.push(th.group);
    return seen;
  }

  const api = { PERIOD_KEYS, LIMIT_PCT, suspect, median, weightKey, themeIndex, normSeries, leaders, contributions, prevDayValues, ranksOf, related, quadrant, activeMembers, perf, themeStats, rankThemes, statValue, themesForTicker, dartUrl, evidenceParts, fmtPct, tone, groups };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirKrThemesCore = api;
})(typeof window !== "undefined" ? window : null);
