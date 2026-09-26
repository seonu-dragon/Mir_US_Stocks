// 업종 상대 팩터 등급(A~F) — 순수 계산 모듈(DOM·네트워크 없음, 시장 무관).
// 브라우저에서는 window.MirFactorGradeCore, node 테스트(scripts/tests/test_factor_grade_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 정의
// - 각 팩터(밸류·성장·수익성·모멘텀·재무 건전성)는 구성 지표 몇 개로 이뤄진다.
// - 비교 집단 = 같은 업종(industry). 그 업종에서 팩터 값이 있는 종목이 minSample(기본 10) 개
//   미만이면 상위 분류(sector)로 올리고, 거기서도 모자라면 등급을 보류한다.
// - 구성 지표마다 집단 안 백분위(0~100, 좋은 쪽이 100)를 구하고, 그 평균(합성 점수)을
//   다시 집단 안에서 백분위로 바꿔 등급을 매긴다: A ≥ 80 · B ≥ 60 · C ≥ 40 · D ≥ 20 · F < 20.
// - 구성 지표는 집단 안 표본이 minMetricSample(기본 5) 미만이면 그 집단에선 쓰지 않는다.
// - 배수(PER·PBR 등)는 0 이하(적자·자본잠식)를 결측으로 본다 — '싸다' 로 읽히면 안 된다.
// - 이 등급은 '같은 업종 안의 현재 위치' 서술이다. 예측 점수가 아니다(검증 결과를 함께 표시).
(function (root) {
  "use strict";

  const DEFAULT_MIN_SAMPLE = 10;
  const DEFAULT_MIN_METRIC_SAMPLE = 5;
  const LEVELS = ["industry", "sector"];
  const LEVEL_LABEL = { industry: "업종", sector: "섹터" };

  // dir: 1 = 클수록 좋음, -1 = 작을수록 좋음. positive: 0 이하 값은 결측.
  // validation: factor_validation.json 의 팩터 키(과거 검증이 있는 것만).
  const FACTORS = [
    {
      key: "value", label: "밸류", desc: "배수가 낮을수록 상위",
      metrics: [
        { key: "pe", label: "PER", dir: -1, positive: true },
        { key: "pb", label: "PBR", dir: -1, positive: true },
        { key: "ps", label: "PSR", dir: -1, positive: true },
        { key: "evEbitda", label: "EV/EBITDA", dir: -1, positive: true },
        { key: "evEbit", label: "EV/EBIT", dir: -1, positive: true },
        { key: "pfcf", label: "P/FCF", dir: -1, positive: true },
      ],
      validation: [],
    },
    {
      key: "growth", label: "성장", desc: "성장률이 높을수록 상위",
      metrics: [
        { key: "revenueGrowth", label: "매출 성장률(전년비)", dir: 1, unit: "%" },
        { key: "operatingGrowth", label: "영업이익 성장률(전년비)", dir: 1, unit: "%" },
        { key: "epsGrowthEst", label: "예상 EPS 성장률(추정치)", dir: 1, unit: "%" },
      ],
      validation: [],
    },
    {
      key: "profit", label: "수익성", desc: "이익률·자본수익률이 높을수록 상위",
      metrics: [
        { key: "roe", label: "ROE", dir: 1, unit: "%" },
        { key: "roa", label: "ROA", dir: 1, unit: "%" },
        { key: "netMargin", label: "순이익률", dir: 1, unit: "%" },
      ],
      validation: [],
    },
    {
      key: "momentum", label: "모멘텀", desc: "최근 상대 강세일수록 상위",
      metrics: [
        { key: "threeMonthChangePct", label: "3개월 수익률", dir: 1, unit: "%" },
        { key: "newHighDistancePct", label: "52주 고점 대비 하락폭", dir: -1, unit: "%" },
      ],
      validation: ["mom_3m", "high52_prox"],
    },
    {
      key: "health", label: "재무 건전성", desc: "부채가 적고 유동성이 높을수록 상위",
      metrics: [
        { key: "debtRatio", label: "부채비율", dir: -1, unit: "%" },
        { key: "currentRatio", label: "유동비율", dir: 1, unit: "%" },
      ],
      validation: [],
    },
  ];

  function finite(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function lowerBound(sorted, v) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function upperBound(sorted, v) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
    return lo;
  }
  // 백분위(0~100, 클수록 큰 값). 동점은 가운데 순위. 표본 2개 미만이면 null.
  function percentileOf(sorted, v) {
    const n = sorted.length;
    if (n < 2 || v == null) return null;
    const less = lowerBound(sorted, v);
    const equal = upperBound(sorted, v) - less;
    if (!equal) return null;
    return ((less + (equal - 1) / 2) / (n - 1)) * 100;
  }

  function gradeLetter(pct) {
    if (!Number.isFinite(pct)) return null;
    if (pct >= 80) return "A";
    if (pct >= 60) return "B";
    if (pct >= 40) return "C";
    if (pct >= 20) return "D";
    return "F";
  }

  // stocks: [{ ticker, industry, sector, ... }]
  // opts.get(stock, metricKey) → 값(없으면 null)
  // opts.exclude(stock) → true 면 비교 집단에서 뺀다(ETF 등)
  // opts.factors: 기본 FACTORS. opts.metricAvailable(metricKey) → false 면 그 시장에서 안 씀.
  function createGradeIndex(stocks, opts = {}) {
    const get = typeof opts.get === "function" ? opts.get : (s, k) => (s ? s[k] : null);
    const exclude = typeof opts.exclude === "function" ? opts.exclude : () => false;
    const minSample = Number.isFinite(opts.minSample) ? opts.minSample : DEFAULT_MIN_SAMPLE;
    const minMetricSample = Number.isFinite(opts.minMetricSample) ? opts.minMetricSample : DEFAULT_MIN_METRIC_SAMPLE;
    const factors = (opts.factors || FACTORS).map((f) => ({
      ...f,
      metrics: f.metrics.filter((m) => (typeof opts.metricAvailable === "function" ? opts.metricAvailable(m.key) !== false : true)),
    }));
    const universe = (Array.isArray(stocks) ? stocks : []).filter((s) => s && s.ticker && !exclude(s));
    const byTicker = new Map(universe.map((s) => [s.ticker, s]));
    const valueCache = new Map();
    const poolCache = new Map();

    function metricValue(stock, m) {
      const ck = `${stock.ticker}\u0000${m.key}`;
      if (valueCache.has(ck)) return valueCache.get(ck);
      let v = finite(get(stock, m.key));
      if (v != null && m.positive && v <= 0) v = null;
      valueCache.set(ck, v);
      return v;
    }

    function groupKey(stock, level) {
      const g = stock ? stock[level] : null;
      return g == null || String(g).trim() === "" ? null : String(g);
    }

    // 한 집단(level, key)에서 한 팩터의 합성 점수·순위를 모두 계산한다(집단 단위 캐시).
    function poolStats(factor, level, key) {
      const ck = `${factor.key}\u0000${level}\u0000${key}`;
      if (poolCache.has(ck)) return poolCache.get(ck);
      const members = universe.filter((s) => groupKey(s, level) === key);
      const metricInfo = factor.metrics.map((m) => {
        const vals = [];
        members.forEach((s) => { const v = metricValue(s, m); if (v != null) vals.push(v * m.dir); });
        vals.sort((a, b) => a - b);
        return { m, sorted: vals, usable: vals.length >= minMetricSample };
      });
      const composites = new Map();
      const metricPcts = new Map();
      let eligible = 0;
      members.forEach((s) => {
        const pcts = [];
        const detail = {};
        metricInfo.forEach((mi) => {
          const raw = metricValue(s, mi.m);
          const pct = mi.usable && raw != null ? percentileOf(mi.sorted, raw * mi.m.dir) : null;
          detail[mi.m.key] = pct;
          if (pct != null) pcts.push(pct);
        });
        metricPcts.set(s.ticker, detail);
        if (factor.metrics.some((m) => metricValue(s, m) != null)) eligible++;
        if (pcts.length) composites.set(s.ticker, pcts.reduce((a, b) => a + b, 0) / pcts.length);
      });
      const sortedComposite = [...composites.values()].sort((a, b) => a - b);
      const stats = { level, key, members: members.length, eligible, metricInfo, composites, metricPcts, sortedComposite };
      poolCache.set(ck, stats);
      return stats;
    }

    function gradeFactor(stock, factor) {
      const base = { key: factor.key, label: factor.label, desc: factor.desc, validation: factor.validation || [] };
      if (!factor.metrics.length) return { ...base, status: "nodata", reason: "이 시장 데이터에 구성 지표가 없습니다." };
      const ownVals = factor.metrics.map((m) => metricValue(stock, m));
      if (ownVals.every((v) => v == null)) return { ...base, status: "nodata", reason: "이 종목의 구성 지표 값이 없습니다." };
      const tried = [];
      for (const level of LEVELS) {
        const key = groupKey(stock, level);
        if (!key) continue;
        const st = poolStats(factor, level, key);
        const n = st.sortedComposite.length;
        tried.push({ level, key, n, eligible: st.eligible });
        if (n < minSample) continue;
        const mine = st.composites.get(stock.ticker);
        if (mine == null) {
          return { ...base, status: "nodata", reason: "이 종목의 구성 지표가 집단 비교에 쓸 만큼 모이지 않았습니다.", tried };
        }
        const pct = percentileOf(st.sortedComposite, mine);
        const rank = n - upperBound(st.sortedComposite, mine) + 1;
        const detail = st.metricPcts.get(stock.ticker) || {};
        const metrics = st.metricInfo.map((mi) => ({
          key: mi.m.key,
          label: mi.m.label,
          unit: mi.m.unit || "",
          dir: mi.m.dir,
          value: metricValue(stock, mi.m),
          pct: detail[mi.m.key],
          n: mi.sorted.length,
          usable: mi.usable,
        }));
        return {
          ...base,
          status: "ok",
          grade: gradeLetter(pct),
          pct,
          rank,
          n,
          composite: mine,
          level,
          levelLabel: LEVEL_LABEL[level],
          group: key,
          escalatedFrom: tried.length > 1 ? tried[0] : null,
          metrics,
          tried,
        };
      }
      return {
        ...base,
        status: "held",
        reason: tried.length
          ? `비교 표본이 부족합니다(${tried.map((t) => `${LEVEL_LABEL[t.level]} ${t.key} ${t.eligible}개`).join(" · ")} — 최소 ${minSample}개).`
          : "업종·섹터 분류가 없습니다.",
        tried,
      };
    }

    function gradesFor(tickerOrStock) {
      const stock = typeof tickerOrStock === "string" ? byTicker.get(tickerOrStock) : (tickerOrStock && byTicker.get(tickerOrStock.ticker)) || tickerOrStock;
      if (!stock || !stock.ticker) return null;
      if (!byTicker.has(stock.ticker)) return { ticker: stock.ticker, excluded: true, factors: [] };
      return { ticker: stock.ticker, excluded: false, factors: factors.map((f) => gradeFactor(stock, f)) };
    }

    return { gradesFor, universeSize: universe.length, minSample, minMetricSample, factors };
  }

  // factor_validation.json 요약 한 줄. 반환 { text, validatedAny, tested }
  // marketKey: "us" | "kr". keys: 검증 팩터 키 배열(비어 있으면 '검증 대상 아님').
  const HORIZON_LABEL = { 5: "1주", 20: "1개월", 60: "3개월" };
  function validationSummary(fv, marketKey, keys) {
    const list = Array.isArray(keys) ? keys : [];
    if (!list.length) return { tested: false, validatedAny: false, text: "과거 검증 대상이 아닌 서술 지표입니다 — 이 등급이 이후 수익률을 예측한다는 근거는 없습니다." };
    const market = fv && fv.markets && fv.markets[marketKey];
    if (!market || !market.horizons) return { tested: false, validatedAny: false, text: "과거 검증 결과를 불러오지 못했습니다 — 예측 점수로 읽지 마세요." };
    const horizons = Object.keys(market.horizons).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    let validatedAny = false;
    const parts = list.map((key) => {
      const label = (fv.factors && fv.factors[key] && fv.factors[key].label) || key;
      const passed = horizons.filter((h) => {
        const f = market.horizons[String(h)] && market.horizons[String(h)].factors && market.horizons[String(h)].factors[key];
        return f && f.validated === true;
      });
      if (passed.length) validatedAny = true;
      const all = horizons.map((h) => HORIZON_LABEL[h] || `${h}일`).join("·");
      if (!passed.length) return `${label} ${all} 모두 미통과`;
      if (passed.length === horizons.length) return `${label} ${all} 통과`;
      return `${label} ${passed.map((h) => HORIZON_LABEL[h] || `${h}일`).join("·")}만 통과`;
    });
    const s = market.sample || {};
    const span = s.firstEvalDate && s.lastEvalDate ? `${String(s.firstEvalDate).slice(0, 7)}~${String(s.lastEvalDate).slice(0, 7)}` : "과거 5년";
    const who = marketKey === "kr" ? "KR" : "US";
    const text = `구성 지표의 과거 검증(${who} ${s.tickers || "—"}종목, ${span}, 시장 전체 순위 기준): ${parts.join(" · ")}.`
      + (validatedAny ? " 업종 상대 등급 자체는 검증하지 않았습니다." : " 예측력이 확인되지 않았습니다.");
    return { tested: true, validatedAny, text };
  }

  const api = { FACTORS, LEVELS, LEVEL_LABEL, DEFAULT_MIN_SAMPLE, DEFAULT_MIN_METRIC_SAMPLE, percentileOf, gradeLetter, createGradeIndex, validationSummary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirFactorGradeCore = api;
})(typeof window !== "undefined" ? window : null);
