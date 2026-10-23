// 내 투자 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirMyInvestCore, node 테스트(scripts/tests/test_my_invest_core.mjs)에서는 module.exports.
//
// holdingsTrend: 지금 보유 수량을 과거 종가에 곱한 '현재 구성 기준' 평가액 추이.
//   미르는 매매 이력 없이 수량·평단만 저장하므로 실제 계좌 추이가 아니다 — 화면이 반드시 그렇게 밝힌다.
// 입력: holdings [{ t, qty }], maps { 티커: { 'YYYY-MM-DD': 종가 } | Map }, bench(같은 모양, 선택), bars(구간 거래일 수)
// 출력: { dates, values, pct, benchPct, used:[티커], excluded:[티커], start, end, change, changePct } | null
(function (root) {
  "use strict";

  function finite(v) { return typeof v === "number" && Number.isFinite(v); }
  function get(map, d) {
    if (!map) return undefined;
    const v = typeof map.get === "function" ? map.get(d) : map[d];
    return v == null ? undefined : Number(v);
  }
  function keys(map) {
    if (!map) return [];
    return typeof map.keys === "function" && typeof map.get === "function" ? [...map.keys()] : Object.keys(map);
  }

  // 구간 시작일에 가격이 없는(그 뒤 상장·이력 없음) 종목은 빼고 excluded 로 돌려준다 — 넣으면
  // 중간에 평가액이 계단처럼 뛰어 '수익'처럼 보인다. 구간 안 빈 날은 직전 종가로 채운다.
  function holdingsTrend(holdings, maps, bench, bars) {
    const list = (holdings || []).filter((h) => h && h.t && finite(Number(h.qty)) && Number(h.qty) > 0);
    if (!list.length) return null;
    const dateSet = new Set();
    list.forEach((h) => keys(maps && maps[h.t]).forEach((d) => dateSet.add(d)));
    const all = [...dateSet].filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort();
    if (all.length < 2) return null;
    const n = Math.max(2, Math.min(all.length, bars || 21));
    const dates = all.slice(-n);
    const start = dates[0];
    const used = [], excluded = [];
    const lastClose = {};
    list.forEach((h) => {
      const m = maps && maps[h.t];
      // 시작일 이전(포함) 마지막 종가 — 없으면 이 구간을 온전히 덮지 못한다.
      let prior;
      keys(m).forEach((d) => { if (d <= start) { const v = get(m, d); if (finite(v) && v > 0 && (!prior || d > prior.d)) prior = { d, v }; } });
      if (!prior) { excluded.push(h.t); return; }
      used.push(h.t);
      lastClose[h.t] = prior.v;
    });
    if (!used.length) return null;
    const qty = {};
    list.forEach((h) => { qty[h.t] = Number(h.qty); });
    const values = dates.map((d) => {
      let total = 0;
      used.forEach((t) => {
        const v = get(maps[t], d);
        if (finite(v) && v > 0) lastClose[t] = v;
        total += qty[t] * lastClose[t];
      });
      return total;
    });
    const base = values[0];
    const pct = values.map((v) => (base > 0 ? (v / base - 1) * 100 : 0));
    let benchPct = null;
    if (bench) {
      let last;
      keys(bench).forEach((d) => { if (d <= start) { const v = get(bench, d); if (finite(v) && v > 0 && (!last || d > last.d)) last = { d, v }; } });
      if (last) {
        const b0 = last.v;
        let cur = b0;
        benchPct = dates.map((d) => { const v = get(bench, d); if (finite(v) && v > 0) cur = v; return (cur / b0 - 1) * 100; });
      }
    }
    const end = values[values.length - 1];
    return { dates, values, pct, benchPct, used, excluded, start: base, end, change: end - base, changePct: pct[pct.length - 1] };
  }

  // 배분 요약 — 비중 상위 그룹과 한 줄 결론(한 그룹 50%↑ 이면 '집중'). rows [{ key, value }]
  function allocation(rows) {
    const total = (rows || []).reduce((s, r) => s + (finite(r.value) && r.value > 0 ? r.value : 0), 0);
    if (!(total > 0)) return { total: 0, parts: [], top: null, concentrated: false };
    const agg = {};
    rows.forEach((r) => { if (finite(r.value) && r.value > 0) agg[r.key] = (agg[r.key] || 0) + r.value; });
    const parts = Object.entries(agg).map(([key, value]) => ({ key, value, pct: (value / total) * 100 })).sort((a, b) => b.value - a.value);
    return { total, parts, top: parts[0] || null, concentrated: !!(parts[0] && parts[0].pct >= 50) };
  }

  // ------------------------------------------------------------------ 세후 배당 · 금융소득 계기판(#10)
  // 세율은 사용자가 정한 % 하나를 곱할 뿐이다(세액 추정 없음). 비과세 계좌 표시 종목은 0%.
  const TAX_DEFAULTS = { kr: 15.4, us: 15 };
  const FIN_INCOME_THRESHOLD_KRW = 20000000;

  /** 저장값 → { mode:"gross"|"net", kr, us } (숫자 0~100 아니면 기본값). */
  function taxSettings(raw) {
    const o = raw && typeof raw === "object" ? raw : {};
    const rate = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 100 ? n : d; };
    return { mode: o.mode === "net" ? "net" : "gross", kr: rate(o.kr, TAX_DEFAULTS.kr), us: rate(o.us, TAX_DEFAULTS.us) };
  }

  function afterTax(amount, ratePct, taxFree) {
    const a = Number(amount);
    if (!finite(a)) return 0;
    if (taxFree) return a;
    const r = Math.min(100, Math.max(0, Number(ratePct) || 0));
    return a * (1 - r / 100);
  }

  /** 달력 연도(year)의 배당 현금 유입 — 배당락 달 + lag 개월에 지급(portfolio.js dividendMonthBuckets 와 같은 규칙).
   *  items [{ annualCash, frequency, exDate, taxFree }], todayIso 'YYYY-MM-DD'.
   *  지급 달이 오늘이 속한 달보다 앞이면 '지급(추정)', 그 외는 '예정'. 비과세 종목은 따로 센다(계기판 제외).
   *  → { months:[12], paid, upcoming, total, taxFreeTotal } */
  function dividendYear(items, year, todayIso, lag = 1) {
    const months = Array(12).fill(0);
    let taxFreeTotal = 0;
    const m = /^(\d{4})-(\d{2})/.exec(String(todayIso || ""));
    const curIdx = m ? (Number(m[1]) - year) * 12 + Number(m[2]) - 1 : 12;
    (items || []).forEach((it) => {
      const cash = Number(it && it.annualCash);
      const ex = /^(\d{4})-(\d{2})/.exec(String((it && it.exDate) || ""));
      if (!(cash > 0) || !ex) return;
      const freq = [1, 2, 4, 12].includes(Number(it.frequency)) ? Number(it.frequency) : 4;
      const step = 12 / freq;
      const per = cash / freq;
      const exMonth = Number(ex[2]) - 1;
      for (let mi = 0; mi < 12; mi += 1) {
        // 이 해 mi 월에 지급 = (mi - lag) 월이 배당락 달 주기에 맞는다.
        if ((((mi - lag - exMonth) % step) + step) % step !== 0) continue;
        if (it.taxFree) taxFreeTotal += per; else months[mi] += per;
      }
    });
    let paid = 0, upcoming = 0;
    months.forEach((v, i) => { if (i < curIdx) paid += v; else upcoming += v; });
    return { months, paid, upcoming, total: paid + upcoming, taxFreeTotal };
  }

  /** 금융소득 기준선 대비 → { total, threshold, pct(0~), over, remaining } */
  function finIncomeGauge(totalKrw, threshold = FIN_INCOME_THRESHOLD_KRW) {
    const t = finite(Number(totalKrw)) && Number(totalKrw) > 0 ? Number(totalKrw) : 0;
    return { total: t, threshold, pct: threshold > 0 ? (t / threshold) * 100 : 0, over: t > threshold, remaining: Math.max(0, threshold - t) };
  }

  // ------------------------------------------------------------------ 평가액·원금 기록(#11)
  // 방문한 날 하루 한 점({date, value, principal, currency}). 같은 날 다시 오면 그 점을 새 값으로 바꾼다.
  /** list + snap → 새 배열(날짜순, 같은 date 는 교체, 최대 max 개). snap 이 깨졌으면 list 그대로. */
  function upsertSnapshot(list, snap, max = 1500) {
    const arr = Array.isArray(list) ? list.filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && finite(Number(x.value))) : [];
    if (!snap || !/^\d{4}-\d{2}-\d{2}$/.test(String(snap.date)) || !(Number(snap.value) > 0) || !finite(Number(snap.principal))) return arr;
    const row = { date: snap.date, value: Number(snap.value), principal: Number(snap.principal), currency: String(snap.currency || "") };
    const out = arr.filter((x) => x.date !== row.date);
    out.push(row);
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out.slice(-max);
  }

  function dayNum(iso) { const t = Date.parse(`${iso}T00:00:00Z`); return finite(t) ? Math.round(t / 86400000) : NaN; }
  function isoOf(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }

  /** 기간 칩(1M·3M·1Y) → 시작일(오늘 − 30·91·365일). ALL·모르는 값은 null(첫 기록부터). */
  function periodStart(period, todayIso) {
    const t = dayNum(todayIso);
    const days = { "1M": 30, "3M": 91, "1Y": 365 }[period];
    return days && finite(t) ? isoOf(t - days) : null;
  }

  /** 기록 → 차트용: 기간 안 점, 날짜 축(시작~오늘, 하루 단위 인덱스), 하루라도 비면 선을 끊은 구간들.
   *  보간하지 않는다 — 빈 날은 구간 사이 틈으로만 보인다.
   *  → { start, end, span(일수), points:[{date, i, value, principal}], segments:[[point…]], byDate:Map } | null */
  function snapshotSeries(list, period, todayIso) {
    const all = (Array.isArray(list) ? list : []).filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && Number(x.value) > 0);
    if (!all.length) return null;
    const end = todayIso && todayIso > all[all.length - 1].date ? todayIso : all[all.length - 1].date;
    const from = periodStart(period, end);
    const pts = all.filter((x) => (!from || x.date >= from) && x.date <= end);
    if (!pts.length) return null;
    const start = from || pts[0].date;
    const s0 = dayNum(start);
    const span = Math.max(1, dayNum(end) - s0);
    const points = pts.map((x) => ({ date: x.date, i: dayNum(x.date) - s0, value: Number(x.value), principal: Number(x.principal) }));
    const segments = [];
    let cur = [];
    points.forEach((p, k) => {
      if (k && p.i - points[k - 1].i > 1) { segments.push(cur); cur = []; }
      cur.push(p);
    });
    if (cur.length) segments.push(cur);
    const byDate = new Map(points.map((p) => [p.date, p]));
    return { start, end, span, points, segments, byDate };
  }

  /** 차트 인덱스(0..span) → 날짜 문자열. */
  function seriesDate(series, i) { return series ? isoOf(dayNum(series.start) + Math.round(i)) : ""; }

  // ------------------------------------------------------------------ 집중 한도 점검(#12)
  const LIMIT_DEFAULTS = { stock: 10, sector: 30, currency: null };
  /** 저장값 → { stock, sector, currency } — 비었거나 0 이하·100 초과면 '한도 없음'(null). 키가 없으면 기본값. */
  function limitSettings(raw) {
    const o = raw && typeof raw === "object" ? raw : {};
    const one = (k) => {
      if (!(k in o)) return LIMIT_DEFAULTS[k];
      const n = Number(o[k]);
      return o[k] !== null && o[k] !== "" && finite(n) && n > 0 && n <= 100 ? n : null;
    };
    return { stock: one("stock"), sector: one("sector"), currency: one("currency") };
  }

  /** groups { stock:[{label, pct}], sector:[…], currency:[…] } + limits → 한도가 있는 항목마다
   *  { kind, limit, over:[{label, pct}](큰 순), max:{label, pct}|null, ok } */
  function concentrationChecks(groups, limits) {
    const lim = limitSettings(limits);
    return ["stock", "sector", "currency"].filter((k) => lim[k] != null).map((kind) => {
      const rows = ((groups && groups[kind]) || []).filter((r) => r && finite(Number(r.pct)))
        .map((r) => ({ label: String(r.label), pct: Number(r.pct) })).sort((a, b) => b.pct - a.pct);
      const over = rows.filter((r) => r.pct > lim[kind] + 1e-9);
      return { kind, limit: lim[kind], over, max: rows[0] || null, ok: over.length === 0, count: rows.length };
    });
  }

  const api = {
    holdingsTrend, allocation,
    TAX_DEFAULTS, FIN_INCOME_THRESHOLD_KRW, taxSettings, afterTax, dividendYear, finIncomeGauge,
    upsertSnapshot, periodStart, snapshotSeries, seriesDate,
    LIMIT_DEFAULTS, limitSettings, concentrationChecks,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirMyInvestCore = api;
})(typeof window !== "undefined" ? window : null);
