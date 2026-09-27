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

  const PERIOD_KEYS = { d: "changePct", w: "weekChangePct", m: "monthChangePct" };

  function finite(v) { return typeof v === "number" && Number.isFinite(v); }

  // 테마의 수치 조건(저PBR 금융의 pbMax)을 통과한 편입 종목. PBR 을 모르면 뺀다(조건을 확인 못 함).
  function activeMembers(theme) {
    const members = Array.isArray(theme && theme.members) ? theme.members : [];
    const pbMax = theme && theme.filter && finite(theme.filter.pbMax) ? theme.filter.pbMax : null;
    if (pbMax == null) return members.slice();
    return members.filter((m) => finite(m.pb) && m.pb < pbMax);
  }

  // 편입 종목의 기간 등락 — 동일가중 평균(eq)·시총가중 평균(cap)·상승/하락 수.
  // stockMap: 티커 → 스냅샷 행. 등락이 없는 종목은 계산에서 빠지고 covered 에 안 센다.
  function perf(members, stockMap, period) {
    const key = PERIOD_KEYS[period] || PERIOD_KEYS.d;
    let sum = 0, n = 0, wsum = 0, wret = 0, up = 0, down = 0;
    for (const m of members || []) {
      const s = stockMap && stockMap[m.t];
      const raw = s ? s[key] : null;
      const r = raw == null || raw === "" ? NaN : Number(raw);   // Number(null) 은 0 이라 결측을 보합으로 셀 뻔했다
      if (!finite(r)) continue;
      n += 1;
      sum += r;
      if (r > 0) up += 1;
      else if (r < 0) down += 1;
      const w = Number(s.marketCapB);
      if (finite(w) && w > 0) { wsum += w; wret += w * r; }
    }
    return {
      eq: n ? sum / n : null,
      cap: wsum > 0 ? wret / wsum : null,
      covered: n,
      up, down,
    };
  }

  function themeStats(themes, stockMap) {
    return (themes || []).map((th) => {
      const members = activeMembers(th);
      return {
        id: th.id, name: th.name, group: th.group, desc: th.desc,
        n: members.length,
        llm: members.filter((m) => m.by === "llm").length,
        d: perf(members, stockMap, "d"),
        w: perf(members, stockMap, "w"),
        m: perf(members, stockMap, "m"),
      };
    });
  }

  // 기간·가중 방식으로 정렬(내림차순). 편입 minN 종목 미만 테마는 순위에서 뺀다 — 한두 종목이면
  // '테마' 가 아니라 개별 종목 등락이다. 값이 없는 테마는 맨 뒤.
  function rankThemes(stats, period, weight, minN) {
    const p = PERIOD_KEYS[period] ? period : "d";
    const wk = weight === "cap" ? "cap" : "eq";
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
    const v = cell ? cell[weight === "cap" ? "cap" : "eq"] : null;
    return finite(v) ? v : null;
  }

  // 종목 → 그 종목이 든 테마 [{ id, name, group, kw, by, pb? }]. 수치 조건 밖(PBR 1배 이상)은 뺀다.
  function themesForTicker(themes, ticker) {
    const out = [];
    for (const th of themes || []) {
      const m = activeMembers(th).find((x) => x.t === ticker);
      if (m) out.push({ id: th.id, name: th.name, group: th.group, kw: m.kw, by: m.by, pb: m.pb, n: m.n });
    }
    return out;
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

  const api = { PERIOD_KEYS, activeMembers, perf, themeStats, rankThemes, statValue, themesForTicker, dartUrl, evidenceParts, fmtPct, tone, groups };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirKrThemesCore = api;
})(typeof window !== "undefined" ? window : null);
