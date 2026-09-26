// 투자 가설 추적 — 순수 계산 모듈(DOM·네트워크 없음).
// 브라우저에서는 window.MirThesisCore, node 테스트(scripts/tests/test_thesis_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 용어
// - 가설(thesis): 종목 + 매수 근거 텍스트 + 측정 가능한 조건(conditions) + 목표가·손절가.
// - 진입 스냅샷(entry): 등록 순간의 지표를 동결한 값. 이후 "무엇이 변했나" 비교와 벤치마크
//   대비 성과의 기준점이다. 수정해도 바뀌지 않는다.
// - 이력(history): 수정 직전 버전을 차례로 쌓는다. history[0] 이 원래 가설이다(사후 합리화 방지).
// - 지표 묶음(metrics): 앱이 스냅샷·map_fundamentals·상세 JSON·피처 데이터에서 모아 넘기는
//   { values: {key: number|null}, events: {key: {value: bool|null, text, date}} }.
//   여기서는 값의 출처를 모른다 — 값이 없으면 '확인 불가'로 둘 뿐 지어내지 않는다.
(function (root) {
  "use strict";

  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;
  const DAY_MS = 86400000;

  // 조건 빌더가 고를 수 있는 필드. markets 는 그 시장 데이터에 실제로 있는 값만.
  // source 는 화면에 출처로 표시한다. near* 는 '근접' 판정 폭(nearAbs 우선, 없으면 |기준값|×nearRel).
  const METRICS = {
    price:           { label: "현재가", unit: "price", kind: "number", markets: ["us", "kr"], nearRel: 0.03, source: "시장 스냅샷 종가" },
    pe:              { label: "PER", unit: "x", kind: "number", markets: ["us", "kr"], nearRel: 0.1, source: "시장 스냅샷" },
    forwardPE:       { label: "선행 PER", unit: "x", kind: "number", markets: ["us", "kr"], nearRel: 0.1, source: "시장 스냅샷" },
    pb:              { label: "PBR", unit: "x", kind: "number", markets: ["us", "kr"], nearRel: 0.1, source: "시장 스냅샷" },
    ps:              { label: "PSR", unit: "x", kind: "number", markets: ["us", "kr"], nearRel: 0.1, source: "시장 스냅샷" },
    operMargin:      { label: "영업이익률", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 2, source: "연간 재무" },
    netMargin:       { label: "순이익률", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 2, source: "시장 스냅샷" },
    roe:             { label: "ROE", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 2, source: "시장 스냅샷" },
    revenueGrowth:   { label: "매출 성장률(YoY)", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 2, source: "연간 재무(최근 2개년)" },
    operatingGrowth: { label: "영업이익 성장률(YoY)", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 5, source: "연간 재무(최근 2개년)" },
    debtRatio:       { label: "부채비율", unit: "pct", kind: "number", markets: ["kr"], nearAbs: 10, source: "시장 스냅샷" },
    divYield:        { label: "배당수익률", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 0.3, source: "시장 스냅샷" },
    rsi14:           { label: "RSI(14)", unit: "num", kind: "number", markets: ["us", "kr"], nearAbs: 5, source: "시장 스냅샷" },
    high52Gap:       { label: "52주 고점 대비 하락폭", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 3, source: "시장 스냅샷(52주 고점)" },
    sma200Gap:       { label: "200일선 대비 괴리율", unit: "pct", kind: "number", markets: ["us", "kr"], nearAbs: 2, source: "최근 200거래일 종가 평균" },
    guidanceLowered: { label: "가이던스 하향", kind: "event", markets: ["us"], source: "실적 보도자료의 가이던스 문구" },
    krMarketAlert:   { label: "시장경보 지정", kind: "event", markets: ["kr"], source: "KRX KIND 투자주의·경고·위험·거래정지·관리종목" },
    insiderSellCluster: { label: "내부자 매도 클러스터", kind: "event", markets: ["us"], param: { key: "minOwners", label: "최소 인원", def: 3, min: 2, max: 10 }, source: "SEC Form 4 매도(코드 S), 최근 30일" },
    earningsWithin:  { label: "실적 발표 임박", kind: "event", markets: ["us"], param: { key: "days", label: "D-일", def: 7, min: 0, max: 30 }, near: true, source: "실적 캘린더의 다음 발표 예정일" },
  };

  // 등록 시점에 동결하는 지표(비교표 행 순서).
  const SNAPSHOT_KEYS = ["price", "pe", "forwardPE", "pb", "ps", "operMargin", "netMargin", "roe", "revenueGrowth", "operatingGrowth", "debtRatio", "divYield", "rsi14", "high52Gap", "sma200Gap"];

  const OPS = { lt: "<", gt: ">" };
  const STATE_RANK = { breach: 3, near: 2, ok: 1, unknown: 0 };
  const STATE_LABEL = { breach: "위반", near: "근접", ok: "정상", unknown: "확인 불가" };
  const CLOSE_REASONS = { target: "목표 도달", broken: "가설 훼손", changed: "생각이 바뀜", other: "기타" };

  const TEXT_MAX = 2000;
  const MAX_CONDITIONS = 8;

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function isoDate(v) {
    const m = ISO_RE.exec(String(v || ""));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }

  function isoToMs(iso) {
    const m = ISO_RE.exec(String(iso || ""));
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  }

  function daysBetween(a, b) {
    const d = (isoToMs(b) - isoToMs(a)) / DAY_MS;
    return Number.isFinite(d) ? Math.round(d) : null;
  }

  function addDays(iso, days) {
    const ms = isoToMs(iso);
    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms + days * DAY_MS);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function latestIso(dates) {
    let best = null;
    (dates || []).forEach((d) => {
      const iso = isoDate(d);
      if (iso && (!best || iso > best)) best = iso;
    });
    return best;
  }

  function metricsForMarket(market) {
    const id = market === "kr" ? "kr" : "us";
    return Object.keys(METRICS).filter((k) => METRICS[k].markets.includes(id)).map((k) => ({ key: k, ...METRICS[k] }));
  }

  // ----- 데이터 가공(앱이 원시 데이터에서 지표를 뽑을 때 쓰는 순수 함수) -----

  function sma(values, n) {
    const xs = (values || []).map(num).filter((v) => v !== null);
    if (xs.length < n || n <= 0) return null;
    let s = 0;
    for (let i = xs.length - n; i < xs.length; i += 1) s += xs[i];
    return s / n;
  }

  // 마지막 종가의 200일 단순이동평균 대비 괴리율(%). 종가 200개 미만이면 null.
  function sma200Gap(closes) {
    const xs = (closes || []).map(num).filter((v) => v !== null && v > 0);
    const avg = sma(xs, 200);
    if (avg === null || !(avg > 0)) return null;
    return (xs[xs.length - 1] / avg - 1) * 100;
  }

  // 연간 재무 이력([{y, rev, op, ...}])의 최근 2개년 증감률(%). field = "rev" | "op".
  // 직전 해 값이 0 이하이면(적자→흑자 등) 증감률이 의미가 없어 null.
  function yoyFromHistory(history, field) {
    const rows = (history || []).filter((r) => r && Number.isFinite(Number(r.y)) && num(r[field]) !== null)
      .sort((a, b) => Number(a.y) - Number(b.y));
    if (rows.length < 2) return null;
    const cur = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (Number(cur.y) - Number(prev.y) !== 1) return null;
    const p = num(prev[field]);
    const c = num(cur[field]);
    if (!(p > 0)) return null;
    return (c / p - 1) * 100;
  }

  // Form 4 매도(code S) 중 asOf 기준 최근 days 일, 서로 다른 내부자 수.
  function insiderSellCluster(trades, ticker, asOfIso, days = 30, minOwners = 3) {
    const t = String(ticker || "").toUpperCase();
    const since = addDays(asOfIso, -days);
    const owners = new Set();
    let count = 0;
    let value = 0;
    (trades || []).forEach((r) => {
      if (!r || String(r.ticker || "").toUpperCase() !== t) return;
      if (r.kind !== "sell" || (r.code && r.code !== "S")) return;
      const d = isoDate(r.fileDate || r.txDate);
      if (!d || (since && d < since) || d > asOfIso) return;
      count += 1;
      value += num(r.value) || 0;
      owners.add(String(r.owner || r.accession || count));
    });
    return { owners: owners.size, count, value, hit: owners.size >= minOwners };
  }

  // ----- 조건 평가 -----

  function nearBand(meta, threshold) {
    if (meta.nearAbs !== undefined) return meta.nearAbs;
    return Math.abs(threshold) * (meta.nearRel || 0.05);
  }

  function fmtValue(meta, v) {
    if (v === null || v === undefined) return "—";
    if (meta.unit === "pct") return `${v.toFixed(1)}%`;
    if (meta.unit === "x") return `${v.toFixed(1)}배`;
    if (meta.unit === "price") return v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2);
    return v.toFixed(1);
  }

  function describeCondition(cond) {
    const meta = METRICS[cond && cond.metric];
    if (!meta) return "알 수 없는 조건";
    if (meta.kind === "event") {
      if (meta.param) return `${meta.label} (${meta.param.label} ${num(cond.value) ?? meta.param.def})`;
      return meta.label;
    }
    return `${meta.label} ${OPS[cond.op] || "?"} ${fmtValue(meta, num(cond.value))}`;
  }

  // 한 조건을 평가한다. sticky = 예전에 이벤트가 관측된 기록({at, text}) — 이벤트 데이터는
  // 최근 창만 들고 있어 며칠 뒤 사라지므로, 한 번 관측한 위반은 기록으로 남겨 계속 보인다.
  function evaluateCondition(cond, metrics, sticky) {
    const meta = METRICS[cond && cond.metric];
    const base = { id: cond && cond.id, metric: cond && cond.metric, label: describeCondition(cond || {}) };
    if (!meta) return { ...base, state: "unknown", current: null, text: "지원하지 않는 필드" };
    if (meta.kind === "event") {
      const ev = ((metrics && metrics.events) || {})[cond.metric];
      const value = ev ? ev.value : null;
      if (value === true) {
        return { ...base, state: meta.near ? "near" : "breach", current: true, text: ev.text || "발생", date: ev.date || null, observed: !meta.near };
      }
      if (sticky && !meta.near) {
        return { ...base, state: "breach", current: true, text: `${sticky.text || "발생"} (기록 ${String(sticky.at || "").slice(0, 10)})`, date: sticky.date || null };
      }
      if (value === false) return { ...base, state: "ok", current: false, text: ev.text || "해당 없음" };
      return { ...base, state: "unknown", current: null, text: (ev && ev.text) || "데이터 없음" };
    }
    const cur = num(((metrics && metrics.values) || {})[cond.metric]);
    const thr = num(cond.value);
    if (thr === null || !OPS[cond.op]) return { ...base, state: "unknown", current: cur, text: "기준값 없음" };
    if (cur === null) return { ...base, state: "unknown", current: null, text: "현재 값 없음" };
    const band = nearBand(meta, thr);
    let state = "ok";
    if (cond.op === "lt") state = cur < thr ? "breach" : (cur < thr + band ? "near" : "ok");
    else state = cur > thr ? "breach" : (cur > thr - band ? "near" : "ok");
    return { ...base, state, current: cur, text: `현재 ${fmtValue(meta, cur)}` };
  }

  // 목표가·손절가. 손절가 이하 = 위반, 3% 이내 = 근접. 목표가 도달은 '근접'(재점검 필요)으로 둔다 —
  // 목표 달성은 나쁜 일이 아니지만 가설을 다시 볼 시점이라는 뜻.
  function evaluatePriceLevels(thesis, price) {
    const out = [];
    const p = num(price);
    const stop = num(thesis && thesis.stop);
    const target = num(thesis && thesis.target);
    if (stop !== null && stop > 0) {
      let state = "unknown";
      if (p !== null) state = p <= stop ? "breach" : (p <= stop * 1.03 ? "near" : "ok");
      out.push({ id: "__stop", metric: "stop", label: `손절가 ${fmtValue(METRICS.price, stop)}`, state, current: p, text: p === null ? "현재가 없음" : `현재 ${fmtValue(METRICS.price, p)}` });
    }
    if (target !== null && target > 0) {
      let state = "unknown";
      if (p !== null) state = p >= target ? "near" : "ok";
      out.push({ id: "__target", metric: "target", label: `목표가 ${fmtValue(METRICS.price, target)}`, state, current: p, text: p === null ? "현재가 없음" : (p >= target ? "목표가 도달 — 가설 재점검" : `목표까지 ${((target / p - 1) * 100).toFixed(1)}%`) });
    }
    return out;
  }

  function worstState(results) {
    let best = "unknown";
    let known = false;
    (results || []).forEach((r) => {
      if (r.state !== "unknown") known = true;
      if (STATE_RANK[r.state] > STATE_RANK[best]) best = r.state;
    });
    return known ? best : "unknown";
  }

  function evaluateThesis(thesis, metrics) {
    const triggered = (thesis && thesis.triggered) || {};
    const conds = ((thesis && thesis.conditions) || []).map((c) => evaluateCondition(c, metrics, triggered[c.id]));
    const levels = evaluatePriceLevels(thesis, ((metrics && metrics.values) || {}).price);
    const results = [...conds, ...levels];
    const counts = { breach: 0, near: 0, ok: 0, unknown: 0 };
    results.forEach((r) => { counts[r.state] += 1; });
    // 새로 관측된 이벤트 위반 — 앱이 thesis.triggered 에 기록해 둔다.
    const newlyTriggered = conds.filter((r) => r.observed && !triggered[r.id]).map((r) => ({ id: r.id, text: r.text, date: r.date || null }));
    return { state: worstState(results), results, counts, newlyTriggered };
  }

  // 실적 발표 뒤 첫 방문이면 재점검 안내. 기준 = 마지막 재점검 시각(없으면 등록 시각).
  function needsEarningsRecheck(thesis, latestEarningsIso) {
    const e = isoDate(latestEarningsIso);
    if (!e || !thesis || thesis.status === "closed") return false;
    const reviewed = isoDate(thesis.reviewedAt) || isoDate(thesis.createdAt);
    if (!reviewed) return false;
    return e > reviewed;
  }

  // ----- 성과(벤치마크 대비로만) -----

  function pctReturn(from, to) {
    const a = num(from);
    const b = num(to);
    if (!(a > 0) || b === null) return null;
    return (b / a - 1) * 100;
  }

  // 진입 스냅샷의 가격·벤치마크 가격(같은 시각)에서 종료(또는 현재)까지.
  // 사용자가 적은 진입가가 아니라 스냅샷 가격을 쓴다 — 벤치마크와 같은 시점이어야 비교가 공정하다.
  function relativePerformance(thesis, current) {
    const entry = (thesis && thesis.entry) || {};
    const end = thesis && thesis.status === "closed" && thesis.exit ? thesis.exit : (current || {});
    const stockRet = pctReturn(entry.price, end.price);
    const benchRet = entry.benchTicker && end.benchTicker && entry.benchTicker !== end.benchTicker ? null : pctReturn(entry.benchPrice, end.benchPrice);
    const excess = stockRet !== null && benchRet !== null ? stockRet - benchRet : null;
    const days = daysBetween(entry.asOf || thesis.createdAt, end.asOf || end.at);
    return { stockRet, benchRet, excess, days, benchTicker: entry.benchTicker || null };
  }

  function median(xs) {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // 종료한 가설만. 적중 = 같은 기간 벤치마크보다 수익률이 높았음(초과수익 > 0).
  // 절대 수익률 기준 적중률은 내지 않는다 — 시장 전체가 오른 덕을 실력으로 착각하게 만든다.
  function scoreboard(theses) {
    const rows = (theses || []).filter((t) => t && t.status === "closed").map((t) => ({ t, perf: relativePerformance(t) }));
    const scored = rows.filter((r) => r.perf.excess !== null);
    const hits = scored.filter((r) => r.perf.excess > 0).length;
    const ex = scored.map((r) => r.perf.excess);
    return {
      closed: rows.length,
      scored: scored.length,
      unscored: rows.length - scored.length,
      hits,
      hitRate: scored.length ? (hits / scored.length) * 100 : null,
      avgExcess: ex.length ? ex.reduce((s, v) => s + v, 0) / ex.length : null,
      medianExcess: median(ex),
      rows,
    };
  }

  // ----- 생성·수정·종료 -----

  function cleanText(s, max = TEXT_MAX) {
    return String(s || "").replace(/\r\n/g, "\n").trim().slice(0, max);
  }

  function normalizeCondition(c, market, idx) {
    if (!c || typeof c !== "object") return null;
    const meta = METRICS[c.metric];
    if (!meta) return null;
    if (market && !meta.markets.includes(market)) return null;
    const id = String(c.id || `c${idx + 1}`).slice(0, 24);
    if (meta.kind === "event") {
      const out = { id, metric: c.metric };
      if (meta.param) {
        const v = num(c.value);
        out.value = v === null ? meta.param.def : Math.min(meta.param.max, Math.max(meta.param.min, Math.round(v)));
      }
      return out;
    }
    const value = num(c.value);
    if (value === null || !OPS[c.op]) return null;
    return { id, metric: c.metric, op: c.op, value };
  }

  function normalizeConditions(list, market) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((c, i) => {
      const n = normalizeCondition(c, market, i);
      if (!n) return;
      let id = n.id;
      while (seen.has(id)) id = `${n.id}_${seen.size}`;
      seen.add(id);
      out.push({ ...n, id });
    });
    return out.slice(0, MAX_CONDITIONS);
  }

  function positiveOrNull(v) {
    const n = num(v);
    return n !== null && n > 0 ? n : null;
  }

  // input: {ticker, market, text, conditions, target, stop, entryPrice}
  // snapshot: {asOf, values:{...}, benchTicker, benchPrice}
  function createThesis(input, snapshot, nowIso, id) {
    const market = input.market === "kr" ? "kr" : "us";
    const values = {};
    SNAPSHOT_KEYS.forEach((k) => {
      const v = num(snapshot && snapshot.values && snapshot.values[k]);
      if (v !== null) values[k] = v;
    });
    return {
      id: id || `th-${Date.parse(nowIso) || 0}-${String(input.ticker || "").toUpperCase()}`,
      v: 1,
      ticker: String(input.ticker || "").toUpperCase(),
      market,
      status: "open",
      text: cleanText(input.text),
      conditions: normalizeConditions(input.conditions, market),
      target: positiveOrNull(input.target),
      stop: positiveOrNull(input.stop),
      entryPrice: positiveOrNull(input.entryPrice),
      createdAt: nowIso,
      updatedAt: nowIso,
      reviewedAt: nowIso,
      entry: {
        asOf: (snapshot && snapshot.asOf) || isoDate(nowIso),
        price: values.price ?? null,
        values,
        benchTicker: (snapshot && snapshot.benchTicker) || null,
        benchPrice: num(snapshot && snapshot.benchPrice),
      },
      history: [],
      triggered: {},
    };
  }

  function versionOf(t) {
    return { at: t.updatedAt || t.createdAt, text: t.text, conditions: t.conditions, target: t.target, stop: t.stop, entryPrice: t.entryPrice, note: t.revisionNote || "" };
  }

  function sameVersion(a, b) {
    return a.text === b.text && JSON.stringify(a.conditions) === JSON.stringify(b.conditions)
      && a.target === b.target && a.stop === b.stop && a.entryPrice === b.entryPrice;
  }

  // 수정: 직전 버전을 history 에 쌓고 새 값으로 바꾼다. 진입 스냅샷·등록 시각은 그대로.
  // 바뀐 게 없으면 원본을 그대로 돌려준다(빈 이력 방지).
  function reviseThesis(thesis, patch, nowIso) {
    const next = {
      ...thesis,
      text: patch.text !== undefined ? cleanText(patch.text) : thesis.text,
      conditions: patch.conditions !== undefined ? normalizeConditions(patch.conditions, thesis.market) : thesis.conditions,
      target: patch.target !== undefined ? positiveOrNull(patch.target) : thesis.target,
      stop: patch.stop !== undefined ? positiveOrNull(patch.stop) : thesis.stop,
      entryPrice: patch.entryPrice !== undefined ? positiveOrNull(patch.entryPrice) : thesis.entryPrice,
    };
    if (sameVersion(versionOf(thesis), versionOf(next))) return thesis;
    const history = [...(thesis.history || []), versionOf(thesis)];
    // 지운 조건의 이벤트 기록은 남겨 둘 이유가 없다(이력에는 남는다).
    const ids = new Set(next.conditions.map((c) => c.id));
    const triggered = {};
    Object.entries(thesis.triggered || {}).forEach(([k, v]) => { if (ids.has(k)) triggered[k] = v; });
    return { ...next, history, triggered, updatedAt: nowIso, revisionNote: cleanText(patch.note || "", 300) };
  }

  function closeThesis(thesis, exit, reason, nowIso) {
    return {
      ...thesis,
      status: "closed",
      closedAt: nowIso,
      closeReason: CLOSE_REASONS[reason] ? reason : "other",
      exit: { at: nowIso, asOf: (exit && exit.asOf) || isoDate(nowIso), price: num(exit && exit.price), benchTicker: (exit && exit.benchTicker) || null, benchPrice: num(exit && exit.benchPrice) },
      updatedAt: nowIso,
    };
  }

  function recordTriggered(thesis, newly, nowIso) {
    if (!newly || !newly.length) return thesis;
    const triggered = { ...(thesis.triggered || {}) };
    newly.forEach((n) => { if (!triggered[n.id]) triggered[n.id] = { at: nowIso, text: n.text, date: n.date || null }; });
    return { ...thesis, triggered };
  }

  // ----- 저장·동기화·내보내기 -----

  // 가져오기·클라우드에서 들어온 목록을 검증한다. 형식이 틀린 항목은 버린다.
  function normalizeThesis(t) {
    if (!t || typeof t !== "object") return null;
    const ticker = String(t.ticker || "").trim().toUpperCase();
    if (!ticker || !/^[A-Z0-9.\-^]{1,15}$/.test(ticker)) return null;
    const market = t.market === "kr" ? "kr" : (t.market === "us" ? "us" : (/^\d{6}$/.test(ticker) ? "kr" : "us"));
    const createdAt = String(t.createdAt || "");
    if (!isoDate(createdAt)) return null;
    const entry = t.entry && typeof t.entry === "object" ? t.entry : {};
    const values = {};
    Object.entries(entry.values || {}).forEach(([k, v]) => { if (SNAPSHOT_KEYS.includes(k) && num(v) !== null) values[k] = num(v); });
    const history = (Array.isArray(t.history) ? t.history : []).filter((h) => h && typeof h === "object").slice(-50).map((h) => ({
      at: String(h.at || ""), text: cleanText(h.text), conditions: normalizeConditions(h.conditions, market),
      target: positiveOrNull(h.target), stop: positiveOrNull(h.stop), entryPrice: positiveOrNull(h.entryPrice), note: cleanText(h.note || "", 300),
    }));
    const out = {
      id: String(t.id || `th-${createdAt}-${ticker}`).slice(0, 64),
      v: 1,
      ticker,
      market,
      status: t.status === "closed" ? "closed" : "open",
      text: cleanText(t.text),
      conditions: normalizeConditions(t.conditions, market),
      target: positiveOrNull(t.target),
      stop: positiveOrNull(t.stop),
      entryPrice: positiveOrNull(t.entryPrice),
      createdAt,
      updatedAt: String(t.updatedAt || createdAt),
      reviewedAt: String(t.reviewedAt || createdAt),
      entry: { asOf: isoDate(entry.asOf) || isoDate(createdAt), price: num(entry.price), values, benchTicker: entry.benchTicker ? String(entry.benchTicker).slice(0, 15) : null, benchPrice: num(entry.benchPrice) },
      history,
      triggered: t.triggered && typeof t.triggered === "object" && !Array.isArray(t.triggered) ? t.triggered : {},
    };
    if (t.revisionNote) out.revisionNote = cleanText(t.revisionNote, 300);
    if (out.status === "closed") {
      const ex = t.exit && typeof t.exit === "object" ? t.exit : {};
      out.closedAt = String(t.closedAt || ex.at || out.updatedAt);
      out.closeReason = CLOSE_REASONS[t.closeReason] ? t.closeReason : "other";
      out.exit = { at: String(ex.at || out.closedAt), asOf: isoDate(ex.asOf) || isoDate(out.closedAt), price: num(ex.price), benchTicker: ex.benchTicker ? String(ex.benchTicker).slice(0, 15) : null, benchPrice: num(ex.benchPrice) };
    }
    return out;
  }

  function normalizeStore(raw) {
    const src = Array.isArray(raw) ? { items: raw } : (raw && typeof raw === "object" ? raw : {});
    const items = (Array.isArray(src.items) ? src.items : []).map(normalizeThesis).filter(Boolean);
    const deleted = (Array.isArray(src.deleted) ? src.deleted : []).map((x) => String(x)).filter(Boolean).slice(-300);
    const del = new Set(deleted);
    const seen = new Set();
    return { items: items.filter((t) => !del.has(t.id) && !seen.has(t.id) && seen.add(t.id)), deleted };
  }

  // 두 저장본 병합(로컬 + 클라우드, 또는 로컬 + 가져온 파일). 같은 id 는 updatedAt 이 늦은 쪽.
  // 삭제 표식(deleted)은 합집합 — 한 기기에서 지운 가설이 다른 기기에서 되살아나지 않게.
  function mergeStores(a, b) {
    const A = normalizeStore(a);
    const B = normalizeStore(b);
    const deleted = [...new Set([...A.deleted, ...B.deleted])].slice(-300);
    const del = new Set(deleted);
    const map = new Map();
    [...A.items, ...B.items].forEach((t) => {
      if (del.has(t.id)) return;
      const prev = map.get(t.id);
      if (!prev || String(t.updatedAt) > String(prev.updatedAt)) map.set(t.id, t);
    });
    const items = [...map.values()].sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    return { items, deleted };
  }

  function byteLength(s) {
    let n = 0;
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      n += c < 0x80 ? 1 : (c < 0x800 ? 2 : (c >= 0xd800 && c <= 0xdbff ? (i += 1, 4) : 3));
    }
    return n;
  }

  // 클라우드 동기화 상한(워커 /sync/prefs 바디 32KB 를 워치리스트·포트폴리오와 나눠 쓴다) 안으로 줄인다.
  // 줄이는 순서: 이력은 원본(history[0])과 최근 2개만 → 본문 600자 → 오래된 종료 가설부터 제외.
  // 로컬 저장본은 줄이지 않는다 — 클라우드 사본만 가볍게.
  function compactForCloud(store, maxBytes = 16000) {
    const S = normalizeStore(store);
    const slim = (t, textMax) => ({
      ...t,
      text: t.text.slice(0, textMax),
      history: t.history.length > 3 ? [t.history[0], ...t.history.slice(-2)].map((h) => ({ ...h, text: h.text.slice(0, textMax) })) : t.history.map((h) => ({ ...h, text: h.text.slice(0, textMax) })),
    });
    let items = S.items.map((t) => slim(t, 600));
    let deleted = S.deleted.slice(-100);
    const size = () => byteLength(JSON.stringify({ items, deleted }));
    while (size() > maxBytes && items.length) {
      // 오래된 종료 가설부터, 없으면 가장 오래된 진행 가설부터 뺀다.
      let idx = -1;
      for (let i = items.length - 1; i >= 0; i -= 1) if (items[i].status === "closed") { idx = i; break; }
      if (idx < 0) idx = items.length - 1;
      items = items.filter((_, i) => i !== idx);
    }
    if (size() > maxBytes) deleted = [];
    return { items, deleted, truncated: items.length < S.items.length };
  }

  function csvCell(v) {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCsv(theses) {
    const head = ["id", "시장", "종목", "상태", "등록시각", "수정횟수", "종료시각", "종료사유", "매수근거", "조건", "목표가", "손절가", "사용자진입가", "스냅샷가격", "벤치마크", "벤치마크_진입", "종료가격", "벤치마크_종료", "종목수익률%", "벤치마크수익률%", "초과수익%p"];
    const lines = [head.join(",")];
    (theses || []).forEach((t) => {
      const p = relativePerformance(t);
      const f = (v) => (v === null || v === undefined ? "" : Number(v).toFixed(2));
      lines.push([
        t.id, t.market, t.ticker, t.status === "closed" ? "종료" : "진행", t.createdAt, (t.history || []).length, t.closedAt || "",
        t.closeReason ? CLOSE_REASONS[t.closeReason] : "", t.text, (t.conditions || []).map(describeCondition).join(" / "),
        t.target ?? "", t.stop ?? "", t.entryPrice ?? "", t.entry?.price ?? "", t.entry?.benchTicker ?? "", t.entry?.benchPrice ?? "",
        t.exit?.price ?? "", t.exit?.benchPrice ?? "", t.status === "closed" ? f(p.stockRet) : "", t.status === "closed" ? f(p.benchRet) : "", t.status === "closed" ? f(p.excess) : "",
      ].map(csvCell).join(","));
    });
    return lines.join("\r\n");
  }

  const api = {
    METRICS,
    SNAPSHOT_KEYS,
    OPS,
    STATE_LABEL,
    STATE_RANK,
    CLOSE_REASONS,
    MAX_CONDITIONS,
    num,
    isoDate,
    daysBetween,
    addDays,
    latestIso,
    metricsForMarket,
    sma,
    sma200Gap,
    yoyFromHistory,
    insiderSellCluster,
    fmtValue,
    describeCondition,
    evaluateCondition,
    evaluatePriceLevels,
    evaluateThesis,
    worstState,
    needsEarningsRecheck,
    pctReturn,
    relativePerformance,
    scoreboard,
    normalizeConditions,
    createThesis,
    reviseThesis,
    closeThesis,
    recordTriggered,
    normalizeThesis,
    normalizeStore,
    mergeStores,
    byteLength,
    compactForCloud,
    toCsv,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirThesisCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
