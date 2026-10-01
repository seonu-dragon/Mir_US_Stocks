// 종목 › 찾기 › 필터 목록 — 이름 붙은 필터(규칙 공개) 순수 로직(DOM·네트워크 없음).
// 브라우저에서는 window.MirNamedFiltersCore, node 테스트(scripts/tests/test_named_filters_core.mjs)와
// 과거 결과 빌더(scripts/build_named_filter_stats.mjs)에서는 module.exports 로 같은 코드를 쓴다.
//
// 원칙
//   · 필터는 전부 수식 스크리너(formula-core.js) 수식이다. 이름은 규칙을 그대로 말한다 —
//     '유망'·'우량'·'기대주' 같은 평가어를 쓰지 않는다(EVALUATIVE_WORDS, 테스트가 막는다).
//   · 시장마다 실제로 값이 있는 필드만 쓴다. 정의에 markets 를 적고, 화면은 그 시장의 '값 있는 필드'
//     목록(formula-screener.js fxAvailableFields)으로 한 번 더 컴파일해 통과한 것만 보여 준다.
//   · 과거 결과는 스크리너 백테스트 패널(build_screener_backtest_panel.mjs)이 그 필드를 갖고 있을 때만
//     빌더가 미리 계산해 둔다(data/named_filter_stats.js · data/korea/named_filter_stats.js). 정의 수식이
//     바뀌었는데 결과 파일이 옛 수식이면 보여 주지 않는다(formula 문자열 비교).
(function (root) {
  "use strict";

  const CAVEAT = "과거 결과이며 미래 수익을 뜻하지 않습니다.";
  // 이름·설명에 넣지 않는 평가어(규칙이 아니라 판단을 말하는 말).
  const EVALUATIVE_WORDS = ["유망", "우량", "기대주", "기대", "저평가", "고평가", "추천", "매수", "매도", "대박", "급등 예상", "최고의", "숨은", "알짜", "챔피언", "강력"];

  const GROUPS = [
    { id: "price", label: "가격·추세" },
    { id: "fin", label: "재무·밸류" },
    { id: "div", label: "배당·지분" },
    { id: "risk", label: "재무 위험 점검" },
  ];

  // markets: 이 정의를 쓰는 시장. 같은 id 를 두 시장이 쓰면 딥링크가 시장을 바꿔도 이어진다.
  // rule: 규칙을 풀어 쓴 한두 문장(기준·단위·데이터 출처). 평가 없이 사실만.
  const FILTERS = [
    // ---- 가격·추세 ----
    { id: "near-52w-high", group: "price", markets: ["us", "kr"], name: "52주 고점 5% 이내",
      formula: "newHighDistancePct <= 5",
      rule: "현재가가 최근 52주 최고가보다 5% 이내로 낮은 종목입니다. 52주 신고가 종목(0%)도 포함합니다." },
    { id: "ret3m-near-high", group: "price", markets: ["us", "kr"], name: "3개월 20% 이상 상승 + 52주 고점 10% 이내",
      formula: "threeMonthChangePct >= 20 and newHighDistancePct <= 10",
      rule: "최근 3개월 수익률이 20% 이상이면서 52주 최고가와의 차이가 10% 이내인 종목입니다." },
    { id: "near-52w-low", group: "price", markets: ["us", "kr"], name: "52주 저가 대비 10% 이내",
      formula: "low52Dist <= 10",
      rule: "현재가가 52주 최저가보다 10% 이하로만 높은 종목입니다(저가 근처). 52주 저가는 재무 데이터 파일 기준입니다." },
    { id: "rsi-under-30", group: "price", markets: ["us", "kr"], name: "RSI(14) 30 이하",
      formula: "rsi14 <= 30",
      rule: "14일 RSI 가 30 이하인 종목입니다. RSI 는 최근 14거래일 상승폭과 하락폭의 비율로 계산합니다." },
    { id: "volume-3x", group: "price", markets: ["us", "kr"], name: "거래량 20일 평균의 3배 이상",
      formula: "volumeRatio >= 3",
      rule: "최근 거래일 거래량이 최근 20거래일 평균의 3배 이상인 종목입니다." },
    { id: "low-vol-20", group: "price", markets: ["us", "kr"], name: "20일 변동성 하위 20%",
      formula: "pct(vol20) <= 20",
      rule: "최근 20거래일 일간 수익률의 표준편차가 시장 전체(ETF 제외)에서 낮은 쪽 20% 안에 드는 종목입니다." },
    // ---- 재무·밸류 ----
    { id: "op-growth-2x", group: "fin", markets: ["kr"], name: "영업이익 전년 대비 2배 이상",
      formula: "operatingGrowth >= 100",
      rule: "최근 사업연도 영업이익이 전년보다 100% 이상 늘어난 종목입니다(DART 연간 재무 기준). 전년 이익이 아주 작으면 증가율이 크게 나옵니다." },
    { id: "debt100-roe15", group: "fin", markets: ["kr"], name: "부채비율 100% 미만 + ROE 15% 이상",
      formula: "debtRatio < 100 and roe >= 15",
      rule: "부채총계 ÷ 자본총계가 100% 미만이고 자기자본이익률(ROE)이 15% 이상인 종목입니다." },
    { id: "rev20-per15", group: "fin", markets: ["kr"], name: "매출 20% 이상 증가 + PER 15배 이하",
      formula: "revenueGrowth >= 20 and pe > 0 and pe <= 15",
      rule: "최근 사업연도 매출이 전년보다 20% 이상 늘었고 PER 이 0 초과 15배 이하인 종목입니다(적자 기업 제외)." },
    { id: "roe15-per-sector", group: "fin", markets: ["us"], name: "ROE 15% 이상 + PER 섹터 중앙값 미만",
      formula: "roe >= 15 and pe > 0 and pe < sectorMedian(pe)",
      rule: "ROE 가 15% 이상이고 PER 이 같은 섹터 종목들의 중앙값보다 낮은 종목입니다(적자 기업 제외, 섹터 표본 5개 미만이면 제외)." },
    { id: "pbr1-roe8", group: "fin", markets: ["us", "kr"], name: "PBR 1배 미만 + ROE 8% 이상",
      formula: "pb > 0 and pb < 1 and roe >= 8",
      rule: "주가가 주당순자산보다 낮고(PBR 1 미만) ROE 가 8% 이상인 종목입니다." },
    { id: "eps-est-growth20", group: "fin", markets: ["us"], name: "예상 EPS 20% 이상 증가 + 선행 PER 업종 중앙값 미만",
      formula: "epsGrowthEst >= 20 and forwardPE > 0 and forwardPE < industryMedian(forwardPE)",
      rule: "애널리스트 다음 해 EPS 추정치가 최근 4분기 EPS 보다 20% 이상 크고, 선행 PER 이 같은 업종 중앙값보다 낮은 종목입니다. 추정치는 바뀔 수 있습니다." },
    { id: "current200-margin15", group: "fin", markets: ["us"], name: "유동비율 200% 이상 + 순이익률 15% 이상",
      formula: "currentRatio >= 200 and netMargin >= 15",
      rule: "유동자산이 유동부채의 2배 이상이고 매출 대비 순이익이 15% 이상인 종목입니다." },
    // ---- 배당·지분 ----
    { id: "div4", group: "div", markets: ["us"], name: "배당수익률 4% 이상",
      formula: "divYield >= 4",
      rule: "최근 1년 실제 지급 배당 합 ÷ 현재가가 4% 이상인 종목입니다(없으면 야후·Finnhub 수익률). 특별배당이 포함될 수 있습니다." },
    { id: "div4-payout70", group: "div", markets: ["kr"], name: "배당수익률 4% 이상 + 배당성향 70% 이하",
      formula: "divYield >= 4 and payoutRatio > 0 and payoutRatio <= 70",
      rule: "주당배당금 ÷ 현재가가 4% 이상이고, 순이익 중 배당으로 나간 비율(배당성향)이 0 초과 70% 이하인 종목입니다." },
    { id: "foreign30", group: "div", markets: ["kr"], name: "외국인 지분율 30% 이상",
      formula: "foreignPct >= 30",
      rule: "KRX 기준 외국인 보유 지분율이 30% 이상인 종목입니다." },
    // ---- 재무 위험 점검 ----
    { id: "fscore8", group: "risk", markets: ["us", "kr"], name: "Piotroski F-Score 8점 이상",
      formula: "fScore >= 8",
      rule: "최근 연간 재무제표로 계산한 Piotroski F-Score(수익성·재무 구조·효율 9항목 중 통과 수)가 8 이상인 종목입니다. 데이터 없는 항목은 점수에서 빠집니다." },
    { id: "risk-warn0", group: "risk", markets: ["us", "kr"], name: "재무 위험 경고 0개(6항목 이상 판정)",
      formula: "riskWarnings == 0 and riskChecked >= 6",
      rule: "재무 위험 점검(F-Score·Altman Z·희석·이자보상·이익의 질·부채 급증 등)에서 판정 가능한 항목이 6개 이상이고 경고가 하나도 없는 종목입니다." },
  ];
  const BY_ID = Object.fromEntries(FILTERS.map((f) => [f.id, f]));
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

  function sanitizeId(s) {
    const v = String(s == null ? "" : s).trim().toLowerCase();
    return ID_RE.test(v) ? v : "";
  }

  // 이 시장의 필터(정의 순서, 그룹 순서로 정렬). availableKeys 를 주면 그 필드로 컴파일이 되는 것만 남긴다.
  // 반환 항목 = 정의 + { compiled }.
  function forMarket(market, availableKeys, formulaCore, extra = {}) {
    const m = market === "kr" ? "kr" : "us";
    const order = GROUPS.map((g) => g.id);
    const defs = FILTERS.filter((f) => f.markets.includes(m))
      .map((f, i) => ({ f, i }))
      .sort((a, b) => (order.indexOf(a.f.group) - order.indexOf(b.f.group)) || a.i - b.i)
      .map((x) => x.f);
    if (!formulaCore || !Array.isArray(availableKeys)) return defs.map((f) => ({ ...f, compiled: null }));
    const out = [];
    defs.forEach((f) => {
      const compiled = formulaCore.compile(f.formula, { fields: availableKeys, aliases: extra.aliases || {}, expect: "bool" });
      if (compiled && compiled.ok) out.push({ ...f, compiled });
    });
    return out;
  }

  // 고를 필터: URL(wanted) > 브라우저 기억(stored) > 첫 항목. 목록에 없는 id 는 건너뛴다.
  function resolveSelection(list, wanted, stored) {
    const ids = (list || []).map((f) => f.id);
    const w = sanitizeId(wanted);
    if (w && ids.includes(w)) return w;
    const s = sanitizeId(stored);
    if (s && ids.includes(s)) return s;
    return ids[0] || "";
  }

  // 통과 종목 수. rows·ctx 는 formula-core.evaluate 와 같은 형식.
  function countMatches(compiled, rows, ctx, formulaCore) {
    if (!compiled || !compiled.ok || !formulaCore) return null;
    return formulaCore.filterIndices(compiled, rows, ctx).length;
  }
  function countAll(list, rows, ctx, formulaCore) {
    const out = {};
    (list || []).forEach((f) => { out[f.id] = countMatches(f.compiled, rows, ctx, formulaCore); });
    return out;
  }

  // 그룹별 묶음 [{ group, label, items }]. 빈 그룹은 뺀다.
  function grouped(list) {
    return GROUPS.map((g) => ({ group: g.id, label: g.label, items: (list || []).filter((f) => f.group === g.id) }))
      .filter((g) => g.items.length);
  }

  // ---------- 과거 결과 한 줄 ----------
  const pctText = (x, digits = 1) => {
    if (x == null || !Number.isFinite(Number(x))) return "—";
    const v = Number(x) * 100;
    return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
  };
  const monthText = (d) => (typeof d === "string" && /^\d{4}-\d{2}/.test(d) ? `${d.slice(0, 4)}.${d.slice(5, 7)}` : "");

  // stats: NAMED_FILTER_STATS 문서({ filters: { id: 결과 } }). 반환
  //   { kind: "ok", text, verdict, caveat } | { kind: "none", text }
  function historyFor(stats, filter) {
    const none = (why) => ({ kind: "none", text: why ? `검증 데이터 없음 — ${why}` : "검증 데이터 없음" });
    if (!filter) return none("");
    const row = stats && stats.filters ? stats.filters[filter.id] : null;
    if (!row) return none(stats ? "과거 결과를 계산하지 않은 필터입니다." : "");
    if (row.formula !== filter.formula) return none("필터 정의가 바뀌어 다음 주간 계산을 기다리는 중입니다.");
    if (Array.isArray(row.missing) && row.missing.length) return none(`과거 값이 없는 필드(${row.missing.join(", ")})를 씁니다.`);
    if (row.error || !Number.isFinite(row.months) || row.months <= 0) return none(row.error || "과거 결과를 계산하지 못했습니다.");
    const period = `${monthText(row.startDate)}~${monthText(row.endDate)} ${row.months}개월`;
    const hold = Number.isFinite(row.avgHoldings) ? ` · 평균 ${row.avgHoldings.toFixed(0)}종목` : "";
    const cash = row.cashMonths ? ` · 현금 ${row.cashMonths}개월` : "";
    const text = `${period}, 월말 리밸런싱·거래비용 편도 ${((row.costRate ?? 0.001) * 100).toFixed(1)}%: 연환산 ${pctText(row.cagr)}`
      + ` (같은 유니버스 동일가중 ${pctText(row.ewCagr)})${hold}${cash}`;
    return { kind: "ok", text, verdict: row.verdictLabel || "", verdictKey: row.verdict || "", caveat: CAVEAT };
  }

  // 이름·설명에 평가어가 들어 있으면 그 단어 목록(테스트용).
  function evaluativeWordsIn(text) {
    const s = String(text || "");
    return EVALUATIVE_WORDS.filter((w) => s.includes(w));
  }

  // 정의에 쓰인 필드 이름(빌더가 패널 필드와 비교할 때 컴파일 목록으로 쓴다).
  function definitionFields() {
    const set = new Set();
    FILTERS.forEach((f) => {
      (String(f.formula).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).forEach((w) => set.add(w));
    });
    ["and", "or", "not", "sectorMedian", "sectorPct", "industryMedian", "industryPct", "median", "pct", "rank", "abs", "min", "max", "avg"].forEach((w) => set.delete(w));
    return [...set];
  }

  const api = {
    CAVEAT, EVALUATIVE_WORDS, GROUPS, FILTERS, BY_ID,
    sanitizeId, forMarket, resolveSelection, countMatches, countAll, grouped, historyFor, evaluativeWordsIn, definitionFields, pctText,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirNamedFiltersCore = api;
})(typeof window !== "undefined" ? window : null);
