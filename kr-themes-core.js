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
    for (let i = start; i < cs.length; i += 1) {
      const a = Number(cs[i - 1]), b = Number(cs[i]);
      if (finite(a) && finite(b) && a > 0 && b > 0 && Math.abs((b / a - 1) * 100) > lim) return true;
    }
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

  const api = { PERIOD_KEYS, LIMIT_PCT, suspect, median, weightKey, activeMembers, perf, themeStats, rankThemes, statValue, themesForTicker, dartUrl, evidenceParts, fmtPct, tone, groups };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirKrThemesCore = api;
})(typeof window !== "undefined" ? window : null);
