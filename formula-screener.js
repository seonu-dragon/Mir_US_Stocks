// formula-screener.js — 사용자 정의 수식 스크리너(종목 탭 › 찾기 › 수식)
// =====================================================================
// 파서·평가기는 formula-core.js(window.MirFormulaCore, node 테스트 있음). eval / new Function 없음.
// 여기는 필드 목록(시장별로 실제 값이 있는 것만)·입력 UI(자동완성·조건 블록)·사용자 정의 열·
// 저장(기존 저장형 스크리너 목록·편입/이탈 델타와 공유)·공유 URL 을 맡는다.
//
// 데이터: 부팅 때 받은 시장 스냅샷(data.stocks) + map_fundamentals(MAP_FUNDAMENTALS)
// + 재무 위험 점검 집계(RISK_CHECK, lazy — 이 화면을 열 때 받는다) + US 10-K 위험요인 변화 인덱스(US_RISK_FACTORS_INDEX, lazy).
// 집계 함수(sectorMedian 등)의 모집단은 이 시장 전체(ETF 제외)이고, 유니버스 선택은 결과만 거른다.
//
// 딥링크: ?tab=search&sub=formula&fx=<encodeState 토큰>

// 필드 카탈로그. get(item, f) — item = 스냅샷 행, f = map_fundamentals 행({}).
// 목록에 실제로 보이는 건 이 시장에서 FX_MIN_COVERAGE 종목 이상 값이 있는 필드뿐이다.
const FX_MIN_COVERAGE = 30;
const fxNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const FX_FIELDS = [
  // 가격·수급(시장 스냅샷)
  { key: "price", label: "현재가", group: "가격", src: "스냅샷", get: (it) => fxNum(it.price) },
  { key: "changePct", label: "당일 등락률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.changePct) },
  { key: "weekChangePct", label: "1주 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.weekChangePct) },
  { key: "monthChangePct", label: "1개월 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.monthChangePct) },
  { key: "threeMonthChangePct", label: "3개월 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.threeMonthChangePct) },
  { key: "ytdChangePct", label: "연초 대비 수익률(%)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.ytdChangePct) },
  { key: "marketCap", label: "시가총액(US $B · KR 조원)", group: "가격", src: "스냅샷", get: (it) => { const v = itemCapForValuation(it); return v > 0 ? v : null; } },
  { key: "volumeRatio", label: "거래량 배율(20일 평균 대비)", group: "가격", src: "스냅샷", get: (it) => fxNum(it.volumeRatio) },
  { key: "volume", label: "거래량(주)", group: "가격", src: "스냅샷", get: (it) => { const v = fxNum(it.volume); return v > 0 ? v : null; } },
  // KR 은 네이버 거래대금, US 는 종가 × 거래량 근사. 단위를 맞춰 수식에 쓰기 쉽게 KR 억원 · US 백만 달러.
  { key: "amount", label: "거래대금(US $M · KR 억원)", group: "가격", src: "스냅샷", get: (it) => { const v = fxNum(it.amount); return v > 0 ? v / (isKrMarket() ? 1e8 : 1e6) : null; } },
  { key: "rsi14", label: "RSI(14)", group: "기술", src: "스냅샷", get: (it) => rsiValue(it) },
  { key: "stochK", label: "스토캐스틱 %K", group: "기술", src: "스냅샷", get: (it) => fxNum(it.stochK) },
  { key: "newHighDistancePct", label: "52주 고점 대비 하락폭(%)", group: "기술", src: "스냅샷", get: (it) => fxNum(it.newHighDistancePct) },
  { key: "low52Dist", label: "52주 저가 대비 상승률(%)", group: "기술", src: "계산", get: (it) => { const v = low52DistPct(it); return Number.isFinite(v) ? v : null; } },
  { key: "rangePos5yPct", label: "5년 가격 범위 내 위치(%)", group: "기술", src: "스냅샷", get: (it) => fxNum(it.rangePos5yPct) },
  { key: "vol20", label: "20일 변동성(일간 %)", group: "기술", src: "계산", get: (it) => (typeof scanStdev20 === "function" ? scanStdev20(it.closeSeries) : null) },
  // 이익(스냅샷)
  // -999 는 나스닥 eps 표의 결측 표식이다(fundamentals_sanity.py SENTINELS). 다음 빌드부터 원천에서 빠진다.
  { key: "epsTtm", label: "EPS(TTM)", group: "이익", src: "스냅샷", get: (it) => { const v = epsTtmValue(it); return v === -999 ? null : v; } },
  { key: "epsNextY", label: "예상 EPS(다음 해, 추정치)", group: "이익", src: "스냅샷", get: (it) => fxNum(it.epsNextY) },
  { key: "epsGrowthEst", label: "예상 EPS 성장률(%, 추정치)", group: "이익", src: "계산", get: (it) => { const a = Number(it.epsTtm), b = Number(it.epsNextY); return a > 0 && Number.isFinite(b) ? (b / a - 1) * 100 : null; } },
  // 밸류·재무(map_fundamentals)
  { key: "pe", label: "PER", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.pe) },
  { key: "forwardPE", label: "선행 PER", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.forwardPE) },
  { key: "pb", label: "PBR", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.pb) },
  { key: "ps", label: "PSR", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.ps) },
  { key: "peg", label: "PEG", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.peg) },
  { key: "evEbitda", label: "EV/EBITDA", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.evEbitda) },
  { key: "evEbit", label: "EV/EBIT", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.evEbit) },
  { key: "pfcf", label: "P/FCF", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.pfcf) },
  { key: "valueScore", label: "저평가 종합 점수(멀티플 백분위)", group: "밸류", src: "map_fundamentals", get: (it, f) => fxNum(f.valueScore) },
  { key: "divYield", label: "배당수익률(%)", group: "배당", src: "map_fundamentals", get: (it, f) => fxNum(f.divYield) },
  { key: "payoutRatio", label: "배당성향(%)", group: "배당", src: "map_fundamentals", get: (it, f) => fxNum(f.payoutRatio) },
  { key: "roe", label: "ROE(%)", group: "수익성", src: "map_fundamentals", get: (it, f) => fxNum(f.roe) },
  { key: "roa", label: "ROA(%)", group: "수익성", src: "map_fundamentals", get: (it, f) => fxNum(f.roa) },
  { key: "netMargin", label: "순이익률(%)", group: "수익성", src: "map_fundamentals", get: (it, f) => fxNum(f.netMargin) },
  { key: "revenueGrowth", label: "매출 성장률(전년비 %)", group: "성장", src: "map_fundamentals", get: (it, f) => fxNum(f.revenueGrowth) },
  { key: "operatingGrowth", label: "영업이익 성장률(전년비 %)", group: "성장", src: "map_fundamentals", get: (it, f) => fxNum(f.operatingGrowth) },
  { key: "netGrowth", label: "순이익 성장률(전년비 %)", group: "성장", src: "map_fundamentals", get: (it, f) => fxNum(f.netGrowth) },
  { key: "debtRatio", label: "부채비율(%)", group: "건전성", src: "map_fundamentals", get: (it, f) => fxNum(f.debtRatio) },
  { key: "currentRatio", label: "유동비율(%)", group: "건전성", src: "map_fundamentals", get: (it, f) => fxNum(f.currentRatio) },
  { key: "foreignPct", label: "외국인 지분율(%)", group: "수급", src: "map_fundamentals", get: (it, f) => fxNum(f.foreignPct) },
  { key: "foreignExhaustion", label: "외국인 한도소진율(%)", group: "수급", src: "map_fundamentals", get: (it, f) => fxNum(f.foreignExhaustion) },
];
// 재무 위험 점검 집계 한 행(build_risk_check.mjs cols 순서). 없으면 null.
function fxRiskRow(it) {
  const rc = window.RISK_CHECK;
  if (!rc || !rc.tickers || !Array.isArray(rc.cols)) return null;
  const row = rc.tickers[normalizeTickerKey(it.ticker)] || rc.tickers[it.ticker];
  if (!row) return null;
  const out = {};
  rc.cols.forEach((k, i) => { out[k] = row[i]; });
  return out;
}
// fxNum(null) 은 0 이 되므로(Number(null)) 결측을 먼저 거른다 — 데이터 없음이 0점으로 둔갑하지 않게.
const fxRisk = (k) => (it) => { const r = fxRiskRow(it); return r && r[k] !== null && r[k] !== undefined ? fxNum(r[k]) : null; };
FX_FIELDS.push(
  // 재무 위험 점검(risk-check-core.js, 최근 연간 재무제표 기준 — 예측·매도 신호 아님). 데이터 없음 항목은 점수에서 빠진다.
  { key: "fScore", label: "Piotroski F-Score(판정 항목 중 통과 수)", group: "재무 위험", src: "재무 위험 점검", get: fxRisk("f") },
  { key: "riskWarnings", label: "재무 위험 경고 수(체크리스트)", group: "재무 위험", src: "재무 위험 점검", get: fxRisk("fail") },
  { key: "riskChecked", label: "재무 위험 판정 항목 수", group: "재무 위험", src: "재무 위험 점검", get: fxRisk("of") },
  { key: "altmanZ", label: "Altman Z", group: "재무 위험", src: "재무 위험 점검", get: fxRisk("z") },
  { key: "beneishM", label: "Beneish M", group: "재무 위험", src: "재무 위험 점검", get: fxRisk("m") },
);
// 주주환원 현금(US, 재무 위험 점검 집계의 bb·dv·sbc = SEC 현금흐름표 TTM 실제 지급액) ÷ 현재 시가총액(%).
// 배당 현금이 없으면 map_fundamentals 배당수익률이 정확히 0 인 종목만 배당 0 으로 본다(shareholder-core.js).
function fxCashYields(it, f) {
  const r = fxRiskRow(it);
  const core = window.MirShareholderCore;
  if (!r || !core || (r.bb == null && r.dv == null)) return null;
  const cap = itemCapForValuation(it);
  if (!(cap > 0) || isKrMarket()) return null;
  const n = (v) => (v === null || v === undefined ? null : fxNum(v));
  return core.cashReturnYields({ buyback: n(r.bb), div: n(r.dv), sbc: n(r.sbc) }, cap * 1e9, { divYieldPct: f && f.divYield != null ? fxNum(f.divYield) : null });
}
const fxCash = (k) => (it, f) => { const y = fxCashYields(it, f); return y && Number.isFinite(y[k]) ? y[k] : null; };
FX_FIELDS.push(
  { key: "shareholderYield", label: "주주수익률(%, 자사주+배당 TTM ÷ 시총)", group: "주주환원", src: "SEC 재무(TTM)", get: fxCash("total") },
  { key: "buybackYield", label: "자사주 매입 수익률(%, TTM ÷ 시총)", group: "주주환원", src: "SEC 재무(TTM)", get: fxCash("buyback") },
  { key: "netBuybackYield", label: "순매입 수익률(%, 자사주−SBC ÷ 시총)", group: "주주환원", src: "SEC 재무(TTM)", get: fxCash("net") },
);
// 10-K 위험요인 전년 대비 변화(US, build_risk_factor_changes.py 인덱스 — lazy). 변화 크기는 정보일 뿐 예측이 아니다.
function fxRiskFactorsRow(it) {
  const core = window.MirRiskFactorsCore;
  return core && window.US_RISK_FACTORS_INDEX ? core.indexRow(window.US_RISK_FACTORS_INDEX, normalizeTickerKey(it.ticker)) : null;
}
FX_FIELDS.push(
  { key: "riskTextSimilarity", label: "10-K 위험요인 전년 대비 유사도(%, 코사인)", group: "공시 텍스트", src: "10-K 위험요인 변화",
    get: (it) => { const r = fxRiskFactorsRow(it); return r && typeof r.cos === "number" ? r.cos * 100 : null; } },
  { key: "riskChangePct", label: "10-K 위험요인 변화 크기 백분위(0~100)", group: "공시 텍스트", src: "10-K 위험요인 변화",
    get: (it) => { const r = fxRiskFactorsRow(it); return r && typeof r.pct === "number" ? r.pct : null; } },
);
// ---------- 추정치·의견·배당 성장·옵션 필드(US, 2026-10-21 데이터 — 전부 lazy) ----------
// 찾기 표(find-table.js)·클래식 스크리너(app.js metricValue)·필터 목록도 같은 정의(XM_METRICS)를 쓴다.
// 데이터는 그 필드가 조건·열·정렬에 쓰일 때만 ensureFeatureData 로 받는다(xmEnsure). 해당 데이터가 꺼진
// 시장(국내 — usOnly, 또는 market_config features `=== false`)에서는 필드가 목록에 나오지 않는다(xmEnabled).
// VIX 기간구조는 시장 전체 한 값이라 종목 필드로 두지 않았고, 옵션 IV 는 options_stats 에 없는 값이라 두지 않았다.
let xmRatingMemo = { src: null, idx: null };
let xmRowMemo = { est: null, rat: null, rows: new Map() };
function xmRatingIdx() {
  const r = window.US_RATING_CHANGES;
  const core = window.MirAnalystRevCore;
  if (!r || !core) return null;
  if (xmRatingMemo.src !== r) xmRatingMemo = { src: r, idx: core.ratingIndex(r) };
  return xmRatingMemo.idx;
}
function xmTicker(it) {
  return typeof normalizeTickerKey === "function" ? normalizeTickerKey(it.ticker) : String(it.ticker || "").toUpperCase();
}
function xmRevRow(it) {
  const est = window.US_ESTIMATE_REVISIONS || null;
  const rat = window.US_RATING_CHANGES || null;
  const core = window.MirAnalystRevCore;
  if ((!est && !rat) || !core) return null;
  if (xmRowMemo.est !== est || xmRowMemo.rat !== rat) xmRowMemo = { est, rat, rows: new Map() };
  const t = xmTicker(it);
  if (!xmRowMemo.rows.has(t)) xmRowMemo.rows.set(t, core.screenMetrics(est, rat ? xmRatingIdx() : null, t));
  return xmRowMemo.rows.get(t);
}
function xmDivRec(it) {
  const p = window.DIVIDEND_GROWTH;
  const core = window.MirDivGrowthCore;
  return p && core ? core.record(p, xmTicker(it)) : null;
}
function xmOpt(it) {
  const st = window.OPTIONS_STATS && window.OPTIONS_STATS.stocks;
  return st ? (st[xmTicker(it)] || st[it.ticker] || null) : null;
}
const xmRev = (k) => (it) => { const r = xmRevRow(it); return r && r[k] != null ? fxNum(r[k]) : null; };
const XM_METRICS = [
  { key: "epsRev7", label: "EPS 추정치 7일 변화(%, 올해 회계연도)", short: "추정치 7일", data: ["usEstimateRevisions"], pct: true, get: xmRev("epsRev7") },
  { key: "epsRev30", label: "EPS 추정치 30일 변화(%, 올해 회계연도)", short: "추정치 30일", data: ["usEstimateRevisions"], pct: true, get: xmRev("epsRev30") },
  { key: "epsRev90", label: "EPS 추정치 90일 변화(%, 올해 회계연도)", short: "추정치 90일", data: ["usEstimateRevisions"], pct: true, get: xmRev("epsRev90") },
  { key: "epsUp30", label: "EPS 추정치 30일 상향 애널리스트 수", short: "추정 상향 수", data: ["usEstimateRevisions"], get: xmRev("epsUp30") },
  { key: "epsDown30", label: "EPS 추정치 30일 하향 애널리스트 수", short: "추정 하향 수", data: ["usEstimateRevisions"], get: xmRev("epsDown30") },
  { key: "ratingUp30", label: "30일 애널리스트 의견 상향 건수", short: "의견 상향", data: ["usRatingChanges", "usEstimateRevisions"], get: xmRev("ratingUp30") },
  { key: "ratingDown30", label: "30일 애널리스트 의견 하향 건수", short: "의견 하향", data: ["usRatingChanges", "usEstimateRevisions"], get: xmRev("ratingDown30") },
  { key: "targetChg30", label: "30일 목표가 변경 중앙값(%)", short: "목표가 변경", data: ["usRatingChanges"], pct: true, get: xmRev("targetChg30") },
  { key: "divGrowthYears", label: "배당 연속 증가 연수", short: "배당 연속 증가", data: ["dividendGrowth"], get: (it) => { const r = xmDivRec(it); return r && r.up != null ? fxNum(r.up) : null; } },
  { key: "divPaidYears", label: "배당 연속 지급 연수", short: "배당 연속 지급", data: ["dividendGrowth"], get: (it) => { const r = xmDivRec(it); return r && r.paid != null ? fxNum(r.paid) : null; } },
  { key: "divCagr5", label: "주당배당금 5년 연평균 증가율(%)", short: "배당 5년 연평균", data: ["dividendGrowth"], pct: true, get: (it) => { const r = xmDivRec(it); return r && r.cagr5 != null ? fxNum(r.cagr5) : null; } },
  { key: "optPcr", label: "옵션 풋/콜 미결제약정 비율(최근 만기)", short: "풋/콜", data: ["optionsStats"], get: (it) => { const o = xmOpt(it); return o && o.putCallOI != null ? fxNum(o.putCallOI) : null; } },
  { key: "optMove", label: "옵션 예상 변동폭(%, 최근 만기)", short: "예상 변동폭", data: ["optionsStats"], pct: true, get: (it) => { const o = xmOpt(it); return o && o.expectedMovePct != null ? fxNum(o.expectedMovePct) : null; } },
];
// ---------- 기술적 신호 필드(US·KR, data/tech_signals.js — lazy) ----------
// 스냅샷 필드는 '지금 값'뿐이라 '어제'·'N일 전'·교차 조건을 쓸 수 없었다. 빌더
// (build_market_breadth.py + scripts/tech_signals_core.py)가 종목 일봉으로 미리 계산해 둔 값을 읽어
// 전일값(close_1d·sma20_1d·rsi_1d)과 교차 파생(crossUpSma20Within5 등)을 필드로 낸다.
// 파서에 `rsi[1]` 같은 오프셋 문법을 넣지 않았다 — formula-core.js 의 토크나이저·타입 검사기는
// '필드 = 한 값'을 전제로 돌고, 스냅샷에는 과거 시점 값 자체가 없다. 시점이 있는 값만 빌더에서
// 이름 있는 필드로 내는 쪽이 파서를 건드리지 않고 '없는 값을 만들지 않는다'도 지킨다.
// 불리언 필드는 1 = 참 · 0 = 아님 숫자다(파서 필드 타입은 전부 숫자) → `crossUpSma20Within5 == 1`.
// 교차가 관측 창(10봉) 밖이면 `...Bars` 는 결측이고 `...Within5` 는 0(= 거짓)이다.
let tsRowMemo = { src: null, rows: new Map() };
function tsField(key) {
  return (it) => {
    const core = window.MirTechCore;
    const p = window.TECH_SIGNALS;
    if (!core || !p) return null;
    if (tsRowMemo.src !== p) tsRowMemo = { src: p, rows: new Map() };
    const t = xmTicker(it);
    if (!tsRowMemo.rows.has(t)) tsRowMemo.rows.set(t, core.rowFields(p, t));
    const row = tsRowMemo.rows.get(t);
    return row && row[key] != null ? fxNum(row[key]) : null;
  };
}
const TS_GROUP = "기술 신호(RS·전일·교차)";
const TS_METRICS = [
  { key: "rsRating", label: "RS 등급(1~99, 가중 12개월 성과의 시장 내 백분위)", short: "RS 등급" },
  { key: "rsNewHigh", label: "RS선 52주 신고가(1 = 예)", short: "RS선 신고가" },
  { key: "rsNewHighBeforePrice", label: "RS선만 신고가(주가는 아직, 1 = 예)", short: "RS선 선행" },
  { key: "close_1d", label: "전일 종가" },
  { key: "sma20", label: "20일 이동평균" },
  { key: "sma20_1d", label: "전일 20일 이동평균" },
  { key: "sma50", label: "50일 이동평균" },
  { key: "sma50_1d", label: "전일 50일 이동평균" },
  { key: "rsi_1d", label: "전일 RSI(14)" },
  { key: "rsiChg1d", label: "RSI(14) 전일 대비 변화" },
  { key: "crossUpSma20Bars", label: "20일선 상향 교차가 며칠 전(0 = 당일)" },
  { key: "crossDownSma20Bars", label: "20일선 하향 교차가 며칠 전(0 = 당일)" },
  { key: "crossUpSma50Bars", label: "50일선 상향 교차가 며칠 전(0 = 당일)" },
  { key: "crossDownSma50Bars", label: "50일선 하향 교차가 며칠 전(0 = 당일)" },
  { key: "newHigh20Bars", label: "20일 신고가가 며칠 전(0 = 당일)" },
  { key: "macdCrossUpBars", label: "MACD 상향 교차가 며칠 전(0 = 당일)" },
  { key: "macdCrossDownBars", label: "MACD 하향 교차가 며칠 전(0 = 당일)" },
  { key: "crossUpSma20Within5", label: "5일 안 20일선 상향 교차(1 = 예)" },
  { key: "crossDownSma20Within5", label: "5일 안 20일선 하향 교차(1 = 예)" },
  { key: "crossUpSma50Within5", label: "5일 안 50일선 상향 교차(1 = 예)" },
  { key: "crossDownSma50Within5", label: "5일 안 50일선 하향 교차(1 = 예)" },
  { key: "newHigh20Within5", label: "5일 안 20일 신고가(1 = 예)" },
  { key: "macdCrossUpWithin3", label: "3일 안 MACD 상향 교차(1 = 예)" },
  { key: "macdCrossDownWithin3", label: "3일 안 MACD 하향 교차(1 = 예)" },
];
TS_METRICS.forEach((m) => {
  XM_METRICS.push({ key: m.key, label: m.label, short: m.short || m.label, group: TS_GROUP, data: ["techSignals"], get: tsField(m.key) });
});
const XM_BY_KEY = Object.fromEntries(XM_METRICS.map((m) => [m.key, m]));
// 이 시장에서 그 데이터셋을 쓸 수 있는지. usOnly/krOnly 와 market_config features `=== false` 를 둘 다 본다
// (featureDataEnabled 는 usOnly 면 features 를 보지 않는다).
function xmDataEnabled(dataKey) {
  const meta = typeof FEATURE_DATA === "object" && FEATURE_DATA ? FEATURE_DATA[dataKey] : null;
  if (!meta) return false;
  const cfg = marketCfg();
  if (typeof featureDataEnabled === "function" && !featureDataEnabled(meta, cfg)) return false;
  return !(meta.feature && cfg.features && cfg.features[meta.feature] === false);
}
function xmEnabled(key) {
  const m = XM_BY_KEY[key];
  return Boolean(m) && xmDataEnabled(m.data[0]);
}
function xmLoaded(key) {
  const m = XM_BY_KEY[key];
  return Boolean(m) && m.data.every((d) => !xmDataEnabled(d) || Boolean(window[FEATURE_DATA[d].global]));
}
// keys(필드 이름 배열) 중 아직 안 받은 데이터만 받는다. 기다릴 것이 없으면 false, 있으면 전부 끝난 뒤 true.
// 다른 화면이 먼저 받기 시작한 데이터도 같은 약속을 기다린다(찾기 표·클래식 스크리너·수식이 같이 쓴다).
const xmWaits = new Map();
const xmSettled = new Set();
function xmEnsure(keys) {
  const need = new Set();
  (keys || []).forEach((k) => {
    const m = XM_BY_KEY[k];
    if (!m || !xmEnabled(k)) return;
    m.data.forEach((d) => { if (xmDataEnabled(d) && !window[FEATURE_DATA[d].global] && !xmSettled.has(d)) need.add(d); });
  });
  if (!need.size || typeof ensureFeatureData !== "function") return Promise.resolve(false);
  const waits = [...need].map((d) => {
    if (!xmWaits.has(d)) xmWaits.set(d, ensureFeatureData(d).then(() => { xmSettled.add(d); }));
    return xmWaits.get(d);
  });
  return Promise.all(waits).then(() => true);
}
// 아직 받는 중(또는 받기 전)인 데이터가 있는 필드. 받기를 마쳤는데 실패한 데이터는 기다리지 않는다(값은 결측).
function xmPending(key) {
  const m = XM_BY_KEY[key];
  if (!m || !xmEnabled(key)) return false;
  return m.data.some((d) => xmDataEnabled(d) && !window[FEATURE_DATA[d].global] && !xmSettled.has(d));
}
function extraMetricValue(item, key) {
  const m = XM_BY_KEY[key];
  if (!m || !item || !xmEnabled(key)) return null;
  return m.get(item);
}
function xmLoadState() {
  return ["US_ESTIMATE_REVISIONS", "US_RATING_CHANGES", "DIVIDEND_GROWTH", "OPTIONS_STATS"].map((g) => (window[g] ? 1 : 0)).join("");
}
// 클래식 스크리너(찾기 › 상위 종목 #topMetric · 고급 스크리너 #scrMetric) 정렬 지표로 내는 필드와 프리셋.
// 국내처럼 데이터가 꺼진 시장에서는 옵션 자체를 넣지 않는다(xmSyncSelectOptions — 시장을 바꿀 때마다 다시).
const XM_SORT_KEYS = ["epsRev7", "epsRev30", "epsRev90", "epsUp30", "ratingUp30", "ratingDown30", "targetChg30", "divGrowthYears", "divCagr5", "optPcr", "optMove", "rsRating"];
const XM_PRESETS = {
  estUpDiv10: { label: "추정치 상향 + 배당 성장 10년+", fields: ["epsRev30", "divGrowthYears"],
    test: (it) => { const a = extraMetricValue(it, "epsRev30"); const b = extraMetricValue(it, "divGrowthYears"); return a != null && a > 0 && b != null && b >= 10; } },
  ratingUpCluster: { label: "의견 상향 몰림", fields: ["ratingUp30"],
    test: (it) => { const v = extraMetricValue(it, "ratingUp30"); return v != null && v >= 2; } },
};
function xmPresetEnabled(key) {
  const p = XM_PRESETS[key];
  return Boolean(p) && p.fields.every((k) => xmEnabled(k));
}
// 셀렉트에 이 시장에서 쓸 수 있는 추가 옵션을 넣고 뺀다. 고른 값이 빠지면 첫 옵션으로 돌린다.
function xmSyncSelectOptions() {
  const sync = (id, entries) => {
    const sel = byId(id);
    if (!sel) return;
    const before = sel.value;
    sel.querySelectorAll("option[data-xm]").forEach((o) => o.remove());
    entries.forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      o.dataset.xm = "1";
      sel.appendChild(o);
    });
    if ([...sel.options].some((o) => o.value === before)) sel.value = before;
    else sel.selectedIndex = 0;
  };
  const metrics = XM_SORT_KEYS.filter((k) => xmEnabled(k)).map((k) => [k, XM_BY_KEY[k].short]);
  const presets = Object.keys(XM_PRESETS).filter((k) => xmPresetEnabled(k)).map((k) => [k, XM_PRESETS[k].label]);
  sync("topMetric", metrics);
  sync("scrMetric", metrics);
  sync("topPreset", presets);
  sync("scrPreset", presets);
}
// 클래식 스크리너가 지금 고른 지표·프리셋이 lazy 필드를 쓰면 받고, 다 오면 rerender 를 부른다.
function xmEnsureForScreen(metric, preset, rerender) {
  const keys = [];
  if (XM_BY_KEY[metric]) keys.push(metric);
  if (XM_PRESETS[preset]) keys.push(...XM_PRESETS[preset].fields);
  if (!keys.some((k) => xmPending(k))) return false;
  xmEnsure(keys).then((started) => { if (started && typeof rerender === "function") rerender(); });
  return true;
}
// 정렬 지표 표기(app.js formatMetricValue / metricClass 가 위임).
function xmFormatMetric(value, metric) {
  const m = XM_BY_KEY[metric];
  const v = Number(value);
  if (!m || !Number.isFinite(v)) return "—";
  if (m.pct) { const r = Number(v.toFixed(1)); return `${r > 0 ? "+" : ""}${(r === 0 ? 0 : r).toFixed(1)}%`; }
  if (metric === "divGrowthYears" || metric === "divPaidYears") return `${Math.round(v)}년`;
  if (metric === "optPcr") return v.toFixed(2);
  return String(Math.round(v));
}
function xmMetricClass(value, metric) {
  const m = XM_BY_KEY[metric];
  // 표기와 같은 자리(소수 1자리)로 반올림한 값으로 색을 정한다 — '0.0%' 가 초록·빨강으로 칠해지지 않게.
  const r = Number(Number(value).toFixed(1));
  return m && m.pct && metric !== "optMove" && typeof cls === "function" && r !== 0 ? cls(r) : "";
}
XM_METRICS.forEach((m) => FX_FIELDS.push({ key: m.key, label: m.label, group: m.group || "추정치·의견·배당·옵션", src: "lazy", lazy: true, get: m.get }));
const FX_FIELD_BY_KEY = Object.fromEntries(FX_FIELDS.map((f) => [f.key, f]));
const FX_ALIASES = {
  per: "pe", pbr: "pb", psr: "ps", rsi: "rsi14", eps: "epsTtm", cap: "marketCap", mktcap: "marketCap",
  marketcapb: "marketCap", div: "divYield", dividend: "divYield", vol: "volumeRatio", fpe: "forwardPE",
};
const FX_MAX_COLUMNS = 4;
const FX_MAX_ROWS = 200;

let fxState = { formula: "", columns: [], sort: "", dir: -1, bucket: "all", selectedId: "", market: "" };
let fxBlocks = [];
let fxFieldsMemo = null;
let fxPendingUrlToken = null;
let fxBound = false;
let fxLastRun = null;

// 이 시장에서 값이 있는 필드 목록(+ 없는 필드의 이유). 스냅샷·MAP_FUNDAMENTALS 가 바뀌면 다시 센다.
function fxAvailableFields() {
  const stocks = (data && Array.isArray(data.stocks)) ? data.stocks : [];
  const mfCount = Object.keys(window.MAP_FUNDAMENTALS || {}).length;
  const rcCount = window.RISK_CHECK ? Number(window.RISK_CHECK.count) || 0 : 0;
  const rfCount = window.US_RISK_FACTORS_INDEX ? Number(window.US_RISK_FACTORS_INDEX.count) || 0 : 0;
  const key = `${marketCfg().id}|${data && (data.updatedAtKst || data.updated_at_kst)}|${stocks.length}|${mfCount}|${rcCount}|${rfCount}|${xmLoadState()}`;
  if (fxFieldsMemo && fxFieldsMemo.key === key) return fxFieldsMemo;
  const universe = stocks.filter((s) => s && !isStockEtf(s));
  const counts = {};
  FX_FIELDS.forEach((fd) => { counts[fd.key] = 0; });
  universe.forEach((it) => {
    const f = mapFundamentalsFor(it.ticker) || {};
    FX_FIELDS.forEach((fd) => { if (fd.get(it, f) != null) counts[fd.key]++; });
  });
  // lazy 필드(XM_METRICS)는 데이터를 받기 전엔 셀 수 없다 — 이 시장에서 켜진 데이터면 목록에 두고, 조건에 쓰이면
  // 그때 받는다(fxRunNow). 받은 뒤에는 다른 필드와 같이 FX_MIN_COVERAGE 로 거른다.
  const shown = (fd) => (fd.lazy ? xmEnabled(fd.key) && (!xmLoaded(fd.key) || counts[fd.key] >= FX_MIN_COVERAGE) : counts[fd.key] >= FX_MIN_COVERAGE);
  const list = FX_FIELDS.filter(shown);
  const unavailable = {};
  FX_FIELDS.forEach((fd) => {
    if (!shown(fd)) unavailable[fd.key.toLowerCase()] = `이 시장(${isKrMarket() ? "국내" : "미국"}) 데이터에 없는 필드입니다(${fd.label}).`;
  });
  fxFieldsMemo = { key, list, keys: list.map((f) => f.key), unavailable, counts, universeSize: universe.length };
  return fxFieldsMemo;
}

function fxCompileOptions(expect) {
  const av = fxAvailableFields();
  return { fields: av.keys, aliases: FX_ALIASES, unavailable: av.unavailable, expect };
}

function fxExamples() {
  const base = [
    "roe > 15 and pe < sectorMedian(pe) and rsi14 < 40",
    "sectorPct(roe) >= 80 and sectorPct(pb) <= 30",
    "threeMonthChangePct > 20 and newHighDistancePct < 5",
    "rank(marketCap) <= 50 and divYield > 2",
    // 전일값·교차 필드(tech_signals) — '어제보다' · '5일 안에 교차' 조건
    "rsRating >= 90 and crossUpSma20Within5 == 1",
    "price > close_1d and sma20 > sma20_1d and rsi_1d < 50",
  ];
  if (isKrMarket()) base.push("debtRatio < 100 and revenueGrowth > 10 and pe > 0 and pe < 15");
  else base.push("epsGrowthEst > 20 and forwardPE < industryMedian(forwardPE)");
  const av = fxAvailableFields();
  const core = window.MirFormulaCore;
  return base.filter((src) => core && core.compile(src, fxCompileOptions("bool")).ok && av.keys.length);
}

// ---------- 평가 ----------
function fxRows() {
  const stocks = (data && Array.isArray(data.stocks)) ? data.stocks : [];
  return stocks.filter((s) => s && !isStockEtf(s)).map((item) => ({ item, f: mapFundamentalsFor(item.ticker) || {} }));
}
const fxCtx = {
  get: (row, name) => { const fd = FX_FIELD_BY_KEY[name]; return fd ? fd.get(row.item, row.f) : null; },
  group: (row, g) => row.item[g],
};

function fxRunNow({ trackSaved = false } = {}) {
  const core = window.MirFormulaCore;
  const errBox = byId("fxError");
  const meta = byId("fxMeta");
  if (!core || !data || !Array.isArray(data.stocks)) return;
  const input = byId("fxInput");
  fxState.formula = String(input?.value || "").trim();
  fxState.bucket = byId("fxBucket")?.value || "all";
  fxReadColumnInputs();
  const compiled = core.compile(fxState.formula, fxCompileOptions("bool"));
  if (errBox) {
    errBox.textContent = compiled.ok ? "" : compiled.error;
    errBox.hidden = compiled.ok;
  }
  const colCompiled = fxState.columns.map((c) => (c.e ? core.compile(c.e, fxCompileOptions("num")) : null));
  fxRenderColumnErrors(colCompiled);
  // 조건·열에 쓰인 lazy 필드(추정치·의견·배당 성장·옵션)는 그 데이터를 받은 뒤 다시 돈다.
  const usedLazy = [...(compiled.ok ? compiled.fields : []), ...colCompiled.flatMap((cc) => (cc && cc.ok ? cc.fields : []))]
    .filter((k) => xmPending(k));
  if (usedLazy.length) {
    const wait = xmEnsure(usedLazy);
    wait.then((started) => { if (started) fxRunNow({ trackSaved }); });
  }
  fxRenderBacktestSlot(compiled.ok ? compiled : null);
  if (!compiled.ok) {
    fxLastRun = null;
    if (meta) meta.textContent = "수식을 고치면 결과가 나옵니다.";
    fxRenderTable(null);
    return;
  }
  const rows = fxRows();
  const pass = core.filterIndices(compiled, rows, fxCtx);
  const cfg = marketCfg();
  const bucket = fxState.bucket;
  const inBucket = pass.filter((i) => bucket === "all" || bucketMatches(rows[i].item, rows[i].item.groups || [rows[i].item.bucket].filter(Boolean), bucket));
  const colVals = colCompiled.map((cc) => (cc && cc.ok ? core.evaluate(cc, rows, fxCtx) : null));
  const usedFields = compiled.fields.filter((k) => k !== "marketCap").slice(0, 4);
  fxLastRun = { compiled, rows, idx: inBucket, colVals, usedFields, total: pass.length };
  const tickers = inBucket.map((i) => rows[i].item.ticker);
  const record = fxSelectedRecord();
  // lazy 데이터가 오기 전 결과(빈 값)로 저장 스크리너의 편입/이탈을 기록하지 않는다 — 도착 후 다시 돈다.
  if (trackSaved && record && !usedLazy.length) compareSavedScreener(record, tickers.slice(0, 1000), fxRenderDelta);
  const bucketLabel = (cfg.buckets || []).find(([v]) => v === bucket)?.[1] || "전체";
  if (meta) {
    const when = data.updatedAtKst || data.updated_at_kst || "";
    meta.textContent = usedLazy.length
      ? "필드 데이터를 불러오는 중…"
      : `${inBucket.length.toLocaleString()}개 종목 일치 · ${bucketLabel} · 모집단 ${rows.length.toLocaleString()}종목(ETF 제외)${when ? ` · 기준 ${when}` : ""}`;
  }
  fxRenderTable(fxLastRun);
}

function fxSortValue(run, i, key) {
  const row = run.rows[i];
  if (key && key.startsWith("c")) {
    const ci = Number(key.slice(1));
    const vals = run.colVals[ci];
    return vals ? vals[i] : null;
  }
  const fd = FX_FIELD_BY_KEY[key || "marketCap"] || FX_FIELD_BY_KEY.marketCap;
  return fd.get(row.item, row.f);
}

function fxFmt(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  const a = Math.abs(n);
  if (a >= 1e6) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function fxRenderTable(run) {
  const head = byId("fxHead");
  const body = byId("fxBody");
  if (!head || !body) return;
  if (!run) { head.innerHTML = ""; body.innerHTML = ""; return; }
  const cols = [];
  run.usedFields.forEach((k) => cols.push({ key: k, label: k, title: FX_FIELD_BY_KEY[k]?.label || k }));
  fxState.columns.forEach((c, ci) => { if (run.colVals[ci]) cols.push({ key: `c${ci}`, label: c.n || `열 ${ci + 1}`, title: c.e, custom: true }); });
  cols.push({ key: "marketCap", label: "시총", title: FX_FIELD_BY_KEY.marketCap.label });
  let sortKey = fxState.sort;
  if (!sortKey || !cols.some((c) => c.key === sortKey)) sortKey = fxState.columns.findIndex((c, ci) => run.colVals[ci]) >= 0 ? `c${fxState.columns.findIndex((c, ci) => run.colVals[ci])}` : "marketCap";
  const dir = fxState.dir === 1 ? 1 : -1;
  const sanity = window.MirFundSanity;
  const fieldHasBounds = (k) => Boolean(sanity && FX_FIELD_BY_KEY[k] && sanity.bounds(k));
  const idx = run.idx.slice().sort((a, b) => {
    const av = fxSortValue(run, a, sortKey);
    const bv = fxSortValue(run, b, sortKey);
    // '이상치 가능' 값(ROE 3,948% 등)은 경계 안 값 뒤, 결측 앞으로(fundamentals-sanity-core.js).
    if (fieldHasBounds(sortKey)) return sanity.sortCompare(sortKey, av, bv, dir);
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // 결측은 항상 맨 뒤
    if (bv == null) return -1;
    return dir * (av - bv);
  });
  const arrow = (k) => (k === sortKey ? (dir === 1 ? " ▲" : " ▼") : "");
  head.innerHTML = `<tr><th></th><th data-kr-label="종목">${isKrMarket() ? "종목" : "티커"}</th><th class="col-sub">회사</th><th>섹터</th><th>당일</th>${cols.map((c) => `<th class="num"><button type="button" class="fx-sort${c.custom ? " is-custom" : ""}" data-fx-sort="${escapeHtml(c.key)}" title="${escapeHtml(c.title)}">${escapeHtml(c.label)}${arrow(c.key)}</button></th>`).join("")}</tr>`;
  if (!idx.length) {
    body.innerHTML = `<tr><td colspan="${5 + cols.length}" class="muted">조건에 맞는 종목이 없습니다. 결측값이 있는 종목은 조건을 충족하지 않은 것으로 봅니다.</td></tr>`;
    return;
  }
  const outlierCount = sanity ? idx.filter((i) => cols.some((c) => fieldHasBounds(c.key) && sanity.isOutlier(c.key, fxSortValue(run, i, c.key)))).length : 0;
  body.innerHTML = idx.slice(0, FX_MAX_ROWS).map((i) => {
    const { item } = run.rows[i];
    return `<tr>
      <td>${watchStarButton(item.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(stockLabel(item))}</button></td>
      <td class="col-sub">${escapeHtml(stockSubLabel(item))}</td>
      <td>${escapeHtml(sectorLabelKo(item.sector))}</td>
      <td class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</td>
      ${cols.map((c) => fxCellHtml(run, i, c)).join("")}
    </tr>`;
  }).join("") + (outlierCount ? `<tr><td colspan="${5 + cols.length}" class="muted">'이상치 가능' ${outlierCount.toLocaleString()}종목 — 값은 원자료 그대로지만 분모(자본·매출·이익)가 0 에 가깝거나 단위가 섞였을 가능성이 커 정렬에서 뒤로 보냈습니다. 조건 판정에는 그대로 씁니다.</td></tr>` : "") + (idx.length > FX_MAX_ROWS ? `<tr><td colspan="${5 + cols.length}" class="muted">상위 ${FX_MAX_ROWS}개만 표시(전체 ${idx.length.toLocaleString()}개) — 조건을 좁히거나 정렬을 바꾸세요.</td></tr>` : "");
  delegateTickerClicks(body, ".ticker-link");
}

// 결과 표 한 칸. 필드 열 값이 '이상치 가능' 경계 밖이면 표시를 붙인다(값은 그대로).
function fxCellHtml(run, i, c) {
  const item = run.rows[i].item;
  if (c.key === "marketCap") return `<td class="num">${fmtBillions(item.marketCapB)}</td>`;
  const v = fxSortValue(run, i, c.key);
  const sanity = window.MirFundSanity;
  const flag = !c.custom && sanity && sanity.isOutlier(c.key, v);
  if (!flag) return `<td class="num">${escapeHtml(fxFmt(v))}</td>`;
  return `<td class="num is-outlier" title="${escapeHtml(sanity.describe(c.key))}">${escapeHtml(fxFmt(v))}<span class="fx-outlier">이상치 가능</span></td>`;
}

// ---------- 3차 스크리너 백테스트 연결 지점 ----------
// window.MirFormulaBacktest = { render(slotEl, { compiled, source, market, columns }) } (screener-backtest.js)가
// 결과 옆 자리(#fxBacktestSlot)에 버튼·결과를 그린다. 백테스트는 사용자가 버튼을 눌러야 돈다 — 그 전까지
// 화면의 "과거 검증되지 않음" 문구가 사실 그대로다. 정의가 없거나 렌더가 실패하면 자리를 숨긴다.
function fxRenderBacktestSlot(compiled) {
  const slot = byId("fxBacktestSlot");
  if (!slot) return;
  const bt = window.MirFormulaBacktest;
  if (!compiled || !bt || typeof bt.render !== "function") { slot.hidden = true; slot.innerHTML = ""; return; }
  slot.hidden = false;
  try {
    bt.render(slot, { compiled, source: compiled.source, market: marketCfg().id, columns: fxState.columns.slice() });
  } catch (_) {
    slot.hidden = true;
    slot.innerHTML = "";
  }
}

// ---------- 사용자 정의 열 ----------
function fxReadColumnInputs() {
  const box = byId("fxColumns");
  if (!box) return;
  fxState.columns = [...box.querySelectorAll(".fx-col-row")].map((row) => ({
    n: String(row.querySelector(".fx-col-name")?.value || "").trim().slice(0, 20),
    e: String(row.querySelector(".fx-col-expr")?.value || "").trim(),
  })).filter((c) => c.e || c.n).slice(0, FX_MAX_COLUMNS);
}

function fxRenderColumns() {
  const box = byId("fxColumns");
  if (!box) return;
  const cols = fxState.columns.length ? fxState.columns : [];
  box.innerHTML = cols.map((c, i) => `<div class="fx-col-row" data-i="${i}">
      <input class="fx-col-name" type="text" maxlength="20" placeholder="열 이름" value="${escapeHtml(c.n || "")}" aria-label="열 이름">
      <div class="fx-input-wrap"><input class="fx-col-expr" type="text" spellcheck="false" autocomplete="off" placeholder="예: 100 / pe  또는  sectorPct(roe)" value="${escapeHtml(c.e || "")}" aria-label="열 수식"></div>
      <button type="button" class="ghost fx-col-del" aria-label="열 삭제">✕</button>
      <p class="fx-col-err" hidden></p>
    </div>`).join("");
  box.querySelectorAll(".fx-col-expr").forEach((el) => fxAttachAutocomplete(el));
  // 공유 링크·저장 수식으로 열이 들어오면 접힌 '사용자 정의 열' 을 펼쳐 보여 준다.
  if (cols.length) { const fold = box.closest("details"); if (fold) fold.open = true; }
  const add = byId("fxAddColumn");
  if (add) add.disabled = fxState.columns.length >= FX_MAX_COLUMNS;
}

function fxRenderColumnErrors(colCompiled) {
  const box = byId("fxColumns");
  if (!box) return;
  box.querySelectorAll(".fx-col-row").forEach((row, i) => {
    const err = row.querySelector(".fx-col-err");
    const cc = colCompiled[i];
    if (!err) return;
    err.textContent = cc && !cc.ok ? cc.error : "";
    err.hidden = !(cc && !cc.ok);
  });
}

// ---------- 조건 블록 ----------
const FX_BLOCK_OPS = [">", ">=", "<", "<="];
const FX_BLOCK_MODES = [
  { v: "num", label: "숫자" },
  { v: "sectorMedian", label: "섹터 중앙값" },
  { v: "industryMedian", label: "업종 중앙값" },
  { v: "sectorPct", label: "섹터 내 백분위(값)" },
];

function fxBlockText(b) {
  if (!b.field) return "";
  const val = String(b.value ?? "").trim();
  if (b.mode === "sectorMedian" || b.mode === "industryMedian") return `${b.field} ${b.op} ${b.mode}(${b.field})`;
  if (!val || !Number.isFinite(Number(val))) return "";
  if (b.mode === "sectorPct") return `sectorPct(${b.field}) ${b.op} ${Number(val)}`;
  return `${b.field} ${b.op} ${Number(val)}`;
}

function fxRenderBlocks() {
  const box = byId("fxBlocks");
  if (!box) return;
  const av = fxAvailableFields();
  if (!fxBlocks.length) fxBlocks.push({ field: av.keys.includes("roe") ? "roe" : av.keys[0], op: ">", mode: "num", value: "" });
  const fieldOpts = (sel) => av.list.map((fd) => `<option value="${escapeHtml(fd.key)}"${fd.key === sel ? " selected" : ""}>${escapeHtml(fd.label)} · ${escapeHtml(fd.key)}</option>`).join("");
  box.innerHTML = fxBlocks.map((b, i) => `<div class="fx-block" data-i="${i}">
      <select class="fx-b-field" aria-label="필드">${fieldOpts(b.field)}</select>
      <select class="fx-b-op" aria-label="비교">${FX_BLOCK_OPS.map((o) => `<option${o === b.op ? " selected" : ""}>${o}</option>`).join("")}</select>
      <select class="fx-b-mode" aria-label="비교 대상">${FX_BLOCK_MODES.map((m) => `<option value="${m.v}"${m.v === b.mode ? " selected" : ""}>${m.label}</option>`).join("")}</select>
      <input class="fx-b-value" type="number" step="any" placeholder="값" value="${escapeHtml(b.value ?? "")}" aria-label="값"${b.mode === "sectorMedian" || b.mode === "industryMedian" ? " hidden" : ""}>
      <button type="button" class="ghost fx-b-del" aria-label="조건 삭제">✕</button>
    </div>`).join("");
  const preview = byId("fxBlocksPreview");
  if (preview) {
    const join = byId("fxBlocksJoin")?.value === "or" ? " or " : " and ";
    const txt = fxBlocks.map(fxBlockText).filter(Boolean).join(join);
    preview.textContent = txt || "조건을 채우면 여기에 수식이 만들어집니다.";
  }
}

function fxReadBlocks() {
  const box = byId("fxBlocks");
  if (!box) return;
  fxBlocks = [...box.querySelectorAll(".fx-block")].map((row) => ({
    field: row.querySelector(".fx-b-field")?.value || "",
    op: row.querySelector(".fx-b-op")?.value || ">",
    mode: row.querySelector(".fx-b-mode")?.value || "num",
    value: row.querySelector(".fx-b-value")?.value || "",
  }));
}

// ---------- 자동완성 ----------
function fxSuggestions(prefix) {
  const p = String(prefix || "").toLowerCase();
  if (!p) return [];
  const av = fxAvailableFields();
  const out = [];
  av.list.forEach((fd) => { if (fd.key.toLowerCase().startsWith(p)) out.push({ name: fd.key, label: fd.label, fn: false }); });
  Object.entries(window.MirFormulaCore.FUNCTIONS).forEach(([name, spec]) => { if (name.toLowerCase().startsWith(p)) out.push({ name, label: spec.label, fn: true }); });
  if (out.length < 8) {
    av.list.forEach((fd) => {
      if (!fd.key.toLowerCase().startsWith(p) && fd.label.toLowerCase().includes(p) && !out.some((o) => o.name === fd.key)) out.push({ name: fd.key, label: fd.label, fn: false });
    });
  }
  return out.slice(0, 8);
}

function fxAttachAutocomplete(input) {
  if (!input || input.dataset.fxAc) return;
  input.dataset.fxAc = "1";
  const wrap = input.closest(".fx-input-wrap") || input.parentElement;
  let list = wrap.querySelector(".fx-suggest");
  if (!list) {
    list = document.createElement("ul");
    list.className = "fx-suggest";
    list.setAttribute("role", "listbox");
    list.hidden = true;
    wrap.appendChild(list);
  }
  let items = [];
  let active = 0;
  const close = () => { list.hidden = true; items = []; };
  const apply = (sug) => {
    const core = window.MirFormulaCore;
    const pos = input.selectionStart ?? input.value.length;
    const { start } = core.completionPrefix(input.value, pos);
    const insert = sug.fn ? `${sug.name}(` : sug.name;
    input.value = input.value.slice(0, start) + insert + input.value.slice(pos);
    const caret = start + insert.length;
    input.setSelectionRange(caret, caret);
    input.focus();
    close();
  };
  const paint = () => {
    list.innerHTML = items.map((s, i) => `<li role="option" data-i="${i}" class="${i === active ? "is-active" : ""}" aria-selected="${i === active}"><b>${escapeHtml(s.name)}${s.fn ? "()" : ""}</b><span>${escapeHtml(s.label)}</span></li>`).join("");
    list.hidden = !items.length;
  };
  input.addEventListener("input", () => {
    const pos = input.selectionStart ?? input.value.length;
    const { prefix } = window.MirFormulaCore.completionPrefix(input.value, pos);
    items = fxSuggestions(prefix);
    active = 0;
    paint();
  });
  input.addEventListener("keydown", (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Tab" || (e.key === "Enter" && !e.ctrlKey && !e.metaKey)) { e.preventDefault(); e.stopPropagation(); apply(items[active]); }
    else if (e.key === "Escape") { close(); }
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    e.preventDefault();
    apply(items[Number(li.dataset.i)]);
  });
}

function fxInsertAtCursor(text) {
  const input = byId("fxInput");
  if (!input) return;
  const s = input.selectionStart ?? input.value.length;
  const e = input.selectionEnd ?? s;
  const before = input.value.slice(0, s);
  const pad = before && !/\s$/.test(before) && !/[(]$/.test(before) ? " " : "";
  input.value = before + pad + text + input.value.slice(e);
  const caret = (before + pad + text).length;
  input.focus();
  input.setSelectionRange(caret, caret);
}

function fxRenderFieldHelp() {
  const box = byId("fxFieldList");
  if (!box) return;
  const av = fxAvailableFields();
  const groups = {};
  av.list.forEach((fd) => { (groups[fd.group] = groups[fd.group] || []).push(fd); });
  // 이 시장에서 꺼진 lazy 데이터의 필드(국내의 추정치·의견 등)는 '뺀 필드' 목록에도 적지 않는다.
  const missing = FX_FIELDS.filter((fd) => !av.keys.includes(fd.key) && !(fd.lazy && !xmEnabled(fd.key))).map((fd) => fd.key);
  const chipTitle = (fd) => (fd.lazy && !xmLoaded(fd.key) ? fd.label : `${fd.label} · 값 있는 종목 ${av.counts[fd.key].toLocaleString()}/${av.universeSize.toLocaleString()}`);
  box.innerHTML = Object.entries(groups).map(([g, list]) => `<div class="fx-field-group"><b>${escapeHtml(g)}</b>${list.map((fd) => `<button type="button" class="fx-field-chip" data-fx-insert="${escapeHtml(fd.key)}" title="${escapeHtml(chipTitle(fd))}">${escapeHtml(fd.key)}<span>${escapeHtml(fd.label)}</span></button>`).join("")}</div>`).join("")
    + (missing.length ? `<p class="muted fx-missing">이 시장에 값이 없어 뺀 필드: ${escapeHtml(missing.join(", "))}</p>` : "");
}

// ---------- 저장·델타(기존 저장형 스크리너 목록 공유) ----------
function fxFormulaRecords() {
  return (Array.isArray(savedScreeners) ? savedScreeners : []).filter((r) => r && r.kind === "formula");
}
function fxSelectedRecord() {
  return fxFormulaRecords().find((r) => r.id === fxState.selectedId) || null;
}

function fxRenderSavedPicker() {
  const sel = byId("fxSavedSelect");
  const del = byId("fxSavedDelete");
  if (!sel) return;
  const rows = fxFormulaRecords();
  sel.innerHTML = `<option value="">저장된 수식 선택</option>` + rows.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
  sel.value = rows.some((r) => r.id === fxState.selectedId) ? fxState.selectedId : "";
  if (del) del.disabled = !sel.value;
}

function fxRenderDelta(record) {
  const box = byId("fxDelta");
  if (!box) return;
  if (!record) {
    box.innerHTML = `<p class="muted">수식을 저장하면 다음 갱신부터 새로 들어오고 빠진 종목을 비교합니다(저장형 스크리너와 같은 목록).</p>`;
    return;
  }
  box.innerHTML = savedScreenerDeltaHtml(record);
  delegateTickerClicks(box, "[data-ticker]");
}

function fxSave() {
  const input = byId("fxSavedName");
  const name = String(input?.value || "").trim();
  if (!name) { showAppToast("저장할 이름을 입력하세요"); input?.focus(); return; }
  fxRunNow();
  if (!fxLastRun) { showAppToast("수식 오류를 먼저 고치세요"); return; }
  let record = fxSelectedRecord();
  if (!record) {
    record = { id: `scr_${Date.now().toString(36)}`, kind: "formula", name, config: {}, createdAt: formatKstDateTime() };
    savedScreeners.push(record);
  }
  record.name = name;
  record.config = { formula: fxState.formula, columns: fxState.columns.slice(), sort: fxState.sort, dir: fxState.dir, bucket: fxState.bucket };
  record.lastSnapshotKey = screenerSnapshotKey();
  record.lastTickers = fxLastRun.idx.map((i) => fxLastRun.rows[i].item.ticker).slice(0, 1000);
  record.lastDelta = { added: [], removed: [] };
  record.lastCheckedAt = formatKstDateTime();
  fxState.selectedId = record.id;
  persistSavedScreeners();
  fxRenderSavedPicker();
  fxRenderDelta(record);
  if (typeof renderSavedScreenerPicker === "function") renderSavedScreenerPicker();
  showAppToast(`'${name}' 수식을 저장했습니다`);
}

function fxDelete() {
  const record = fxSelectedRecord();
  if (!record) return;
  savedScreeners = savedScreeners.filter((r) => r.id !== record.id);
  fxState.selectedId = "";
  persistSavedScreeners();
  fxRenderSavedPicker();
  fxRenderDelta(null);
  if (typeof renderSavedScreenerPicker === "function") renderSavedScreenerPicker();
  const input = byId("fxSavedName");
  if (input) input.value = "";
  showAppToast("저장한 수식을 삭제했습니다");
}

function fxApplyConfig(cfgObj) {
  const c = cfgObj || {};
  fxState.formula = String(c.formula || c.f || "");
  fxState.columns = Array.isArray(c.columns) ? c.columns.slice(0, FX_MAX_COLUMNS) : (Array.isArray(c.c) ? c.c.slice(0, FX_MAX_COLUMNS) : []);
  fxState.sort = String(c.sort || c.s || "");
  fxState.dir = (c.dir ?? c.d) === 1 ? 1 : -1;
  if (c.bucket) fxState.bucket = c.bucket;
  const input = byId("fxInput");
  if (input) input.value = fxState.formula;
  const b = byId("fxBucket");
  if (b && c.bucket && [...b.options].some((o) => o.value === c.bucket)) b.value = c.bucket;
  fxRenderColumns();
}

// 저장형 스크리너 셀렉트(screener.js)에서 수식 항목을 고르면 여기로 넘어온다.
function openFormulaScreenerRecord(id) {
  fxState.selectedId = id;
  if (typeof activateSearchSub === "function") activateSearchSub("formula", { push: true });
  const record = fxSelectedRecord();
  if (record) {
    fxApplyConfig(record.config);
    const nameInput = byId("fxSavedName");
    if (nameInput) nameInput.value = record.name;
    fxRenderSavedPicker();
    fxRunNow({ trackSaved: true });
  }
}

// ---------- 공유 URL ----------
function fxShareUrl() {
  fxReadColumnInputs();
  fxState.formula = String(byId("fxInput")?.value || "").trim();
  const token = window.MirFormulaCore.encodeState({ f: fxState.formula, c: fxState.columns, s: fxState.sort, d: fxState.dir });
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("market", marketCfg().id);
  url.searchParams.set("tab", "search");
  url.searchParams.set("sub", "formula");
  url.searchParams.set("fx", token);
  return url.toString();
}

// boot 에서 ?fx= 를 받으면 첫 렌더 때 적용한다.
function formulaScreenerPreload(token) {
  fxPendingUrlToken = token || null;
}

// ---------- 렌더 진입점 ----------
function renderFormulaScreener() {
  const panel = byId("sub-formula");
  if (!panel || !window.MirFormulaCore || !data || !Array.isArray(data.stocks)) return;
  const marketId = marketCfg().id;
  if (fxState.market !== marketId) {
    // 시장이 바뀌면 저장 선택·블록을 비운다(저장 목록은 시장별로 따로다).
    fxState.market = marketId;
    fxState.selectedId = "";
    fxBlocks = [];
    const b = byId("fxBucket");
    if (b) {
      b.innerHTML = `<option value="all">전체(ETF 제외)</option>` + (marketCfg().buckets || [])
        .filter(([v]) => !["all", "all_with_etf", "all_misc"].includes(v))
        .map(([v, label]) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`).join("");
      b.value = "all";
    }
  }
  // 재무 위험 점검 필드(fScore 등)는 집계 파일이 도착하면 필드 목록에 나타난다(refreshFeatureViews 가 다시 그린다).
  if (!window.RISK_CHECK) ensureFeatureData("riskCheck").then((ok) => { if (ok) scheduleFeatureViewRefresh(); });
  // 10-K 위험요인 필드(riskTextSimilarity 등, US)도 같은 방식 — KR 에서는 usOnly 라 받지 않는다.
  if (!isKrMarket() && !window.US_RISK_FACTORS_INDEX) ensureFeatureData("riskFactorsIndex").then((ok) => { if (ok) scheduleFeatureViewRefresh(); });
  fxBind();
  fxRenderFieldHelp();
  const ex = byId("fxExamples");
  if (ex) ex.innerHTML = fxExamples().map((q) => `<button type="button" class="nl-example fx-example" data-fx-example="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("");
  fxRenderSavedPicker();
  fxRenderDelta(fxSelectedRecord());
  fxRenderBlocks();
  if (fxPendingUrlToken) {
    const st = window.MirFormulaCore.decodeState(fxPendingUrlToken);
    fxPendingUrlToken = null;
    if (st) fxApplyConfig({ formula: st.f, columns: st.c, sort: st.s, dir: st.d });
    else showAppToast("공유 링크의 수식을 읽지 못했습니다");
  }
  const input = byId("fxInput");
  if (input && input.value.trim()) fxRunNow();
  else {
    const meta = byId("fxMeta");
    if (meta) meta.textContent = "수식을 입력하고 검색을 누르세요. 필드 이름을 치면 자동완성이 뜹니다.";
    fxRenderTable(null);
  }
}

// ---------- 'AI로 변환'(워커 POST /formula) ----------
// 입력한 문장을 워커가 수식 한 줄로 바꿔 준다. 답은 믿지 않는다 — MirFormulaCore.acceptConverted(이 시장 필드 목록·파서)를
// 통과한 조건식만 보여 주고, 사용자가 '이 수식으로 검색'을 눌러야 입력란에 들어가 실행된다. 옛 워커(404 not_found)면
// worker-extras.js 와 같은 방식(wxMarkOff, 6시간 기억)으로 버튼을 숨긴다.
let fxAiBusy = false;
let fxAiPending = "";

function fxAiOn() {
  return typeof wxRouteOn === "function" && wxRouteOn("formula") && !!(window.MirFormulaCore && window.MirFormulaCore.acceptConverted);
}

function fxAiSyncButton() {
  const b = byId("fxAiConvert");
  if (!b) return;
  b.hidden = !fxAiOn();
  b.disabled = fxAiBusy;
}

function fxAiShow(html) {
  const box = byId("fxAiResult");
  if (!box) return;
  box.hidden = !html;
  box.innerHTML = html || "";
}

function fxAiConvert() {
  const input = byId("fxInput");
  const text = String(input?.value || "").trim();
  if (fxAiBusy || !fxAiOn()) return;
  if (!text) { fxAiShow(`<p class="muted">찾고 싶은 조건을 문장으로 적어 주세요. 예: ROE 15 이상이고 PER 업종 중앙값보다 낮은 종목</p>`); return; }
  if (text.length > 300) { fxAiShow(`<p class="fx-error">문장이 너무 깁니다(300자까지).</p>`); return; }
  const av = fxAvailableFields();
  fxAiBusy = true;
  fxAiSyncButton();
  fxAiShow(`<p class="muted">변환 중…</p>`);
  fetch(`${wxBase()}/formula`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, market: marketCfg().id === "kr" ? "kr" : "us", fields: av.list.map((f) => [f.key, f.label || f.key]) }),
  })
    .then(async (r) => {
      let body = null;
      try { body = await r.json(); } catch (_) { body = null; }
      if (window.MirWorkerExtras && window.MirWorkerExtras.isUnknownRoute(r.status, body)) {
        if (typeof wxMarkOff === "function") wxMarkOff("formula");
        fxAiShow("");
        return;
      }
      if (r.status === 429) { fxAiShow(`<p class="fx-error">요청이 잦습니다. 잠시 후 다시 시도해 주세요.</p>`); return; }
      const raw = body && typeof body.formula === "string" ? body.formula : "";
      if (!r.ok || !raw) { fxAiShow(`<p class="fx-error">이 문장은 수식으로 바꾸지 못했습니다. 필드 이름으로 직접 적어 주세요.</p>`); return; }
      const v = window.MirFormulaCore.acceptConverted(raw, fxCompileOptions("bool"));
      if (!v.ok) {
        fxAiShow(`<p class="fx-error">변환 결과가 수식 검사를 통과하지 못해 쓰지 않았습니다 — ${escapeHtml(v.error)}</p><p class="muted"><code>${escapeHtml(v.formula)}</code></p>`);
        return;
      }
      fxAiPending = v.formula;
      fxAiShow(`<p class="fx-ai-label">변환된 수식 — 확인 후 검색하세요</p><p><code>${escapeHtml(v.formula)}</code></p>
        <div class="fx-actions"><button type="button" class="primary" data-fx-ai="apply">이 수식으로 검색</button><button type="button" class="ghost" data-fx-ai="close">닫기</button></div>`);
    })
    .catch(() => fxAiShow(`<p class="fx-error">변환 요청에 실패했습니다.</p>`))
    .finally(() => { fxAiBusy = false; fxAiSyncButton(); });
}

function fxBind() {
  if (fxBound) return;
  fxBound = true;
  const input = byId("fxInput");
  fxAttachAutocomplete(input);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.defaultPrevented) { e.preventDefault(); fxRunNow({ trackSaved: true }); }
  });
  byId("fxRun")?.addEventListener("click", () => fxRunNow({ trackSaved: true }));
  fxAiSyncButton();
  byId("fxAiConvert")?.addEventListener("click", fxAiConvert);
  byId("fxAiResult")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fx-ai]");
    if (!b) return;
    if (b.dataset.fxAi === "apply" && fxAiPending && input) {
      input.value = fxAiPending;
      fxRunNow({ trackSaved: true });
    }
    fxAiPending = "";
    fxAiShow("");
  });
  byId("fxClear")?.addEventListener("click", () => {
    if (input) input.value = "";
    fxState.formula = "";
    const err = byId("fxError"); if (err) { err.textContent = ""; err.hidden = true; }
    fxRenderTable(null);
    fxRenderBacktestSlot(null);
    const meta = byId("fxMeta"); if (meta) meta.textContent = "수식을 입력하고 검색을 누르세요.";
  });
  byId("fxShare")?.addEventListener("click", () => {
    const url = fxShareUrl();
    navigator.clipboard?.writeText(url)
      .then(() => showAppToast("수식 링크를 복사했습니다."))
      .catch(() => showAppToast("복사에 실패했습니다."));
  });
  byId("fxBucket")?.addEventListener("change", () => fxRunNow());
  byId("fxExamples")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fx-example]");
    if (!b || !input) return;
    input.value = b.dataset.fxExample;
    fxRunNow();
  });
  byId("fxFieldList")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fx-insert]");
    if (b) fxInsertAtCursor(b.dataset.fxInsert);
  });
  // 결과 표 정렬
  byId("fxHead")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fx-sort]");
    if (!b || !fxLastRun) return;
    const key = b.dataset.fxSort;
    if (fxState.sort === key) fxState.dir = fxState.dir === 1 ? -1 : 1;
    else { fxState.sort = key; fxState.dir = -1; }
    fxRenderTable(fxLastRun);
  });
  // 사용자 정의 열
  byId("fxAddColumn")?.addEventListener("click", () => {
    fxReadColumnInputs();
    if (fxState.columns.length >= FX_MAX_COLUMNS) return;
    fxState.columns.push({ n: "", e: "" });
    fxRenderColumns();
    byId("fxColumns")?.querySelector(".fx-col-row:last-child .fx-col-expr")?.focus();
  });
  byId("fxColumns")?.addEventListener("click", (e) => {
    const del = e.target.closest(".fx-col-del");
    if (!del) return;
    const i = Number(del.closest(".fx-col-row")?.dataset.i);
    fxReadColumnInputs();
    // fxReadColumnInputs 는 빈 행을 빼므로 화면 행 번호 대신 다시 읽은 목록에서 지운다.
    const rows = [...byId("fxColumns").querySelectorAll(".fx-col-row")];
    const target = rows[i];
    fxState.columns = rows.filter((r) => r !== target).map((r) => ({
      n: String(r.querySelector(".fx-col-name")?.value || "").trim().slice(0, 20),
      e: String(r.querySelector(".fx-col-expr")?.value || "").trim(),
    }));
    if (fxState.sort && fxState.sort.startsWith("c")) fxState.sort = "";
    fxRenderColumns();
    fxRunNow();
  });
  byId("fxColumns")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.closest(".fx-col-expr") && !e.defaultPrevented) { e.preventDefault(); fxRunNow(); }
  });
  byId("fxColumnsApply")?.addEventListener("click", () => fxRunNow());
  // 조건 블록
  const blocks = byId("fxBlocks");
  blocks?.addEventListener("change", () => { fxReadBlocks(); fxRenderBlocks(); });
  blocks?.addEventListener("input", (e) => {
    if (!e.target.closest(".fx-b-value")) return;
    fxReadBlocks();
    const preview = byId("fxBlocksPreview");
    const join = byId("fxBlocksJoin")?.value === "or" ? " or " : " and ";
    if (preview) preview.textContent = fxBlocks.map(fxBlockText).filter(Boolean).join(join) || "조건을 채우면 여기에 수식이 만들어집니다.";
  });
  blocks?.addEventListener("click", (e) => {
    const del = e.target.closest(".fx-b-del");
    if (!del) return;
    fxReadBlocks();
    fxBlocks.splice(Number(del.closest(".fx-block")?.dataset.i), 1);
    fxRenderBlocks();
  });
  byId("fxBlocksJoin")?.addEventListener("change", () => { fxReadBlocks(); fxRenderBlocks(); });
  byId("fxAddBlock")?.addEventListener("click", () => {
    fxReadBlocks();
    const av = fxAvailableFields();
    fxBlocks.push({ field: av.keys.includes("pe") ? "pe" : av.keys[0], op: "<", mode: "sectorMedian", value: "" });
    fxRenderBlocks();
  });
  byId("fxBlocksApply")?.addEventListener("click", () => {
    fxReadBlocks();
    const join = byId("fxBlocksJoin")?.value === "or" ? " or " : " and ";
    const txt = fxBlocks.map(fxBlockText).filter(Boolean).join(join);
    if (!txt) { showAppToast("값을 채운 조건이 없습니다"); return; }
    if (input) input.value = txt;
    fxRunNow();
  });
  // 저장
  byId("fxSavedSelect")?.addEventListener("change", (e) => {
    fxState.selectedId = e.target.value;
    const record = fxSelectedRecord();
    const nameInput = byId("fxSavedName");
    if (nameInput) nameInput.value = record?.name || "";
    fxRenderSavedPicker();
    if (record) { fxApplyConfig(record.config); fxRunNow({ trackSaved: true }); }
    else fxRenderDelta(null);
  });
  byId("fxSavedSave")?.addEventListener("click", fxSave);
  byId("fxSavedDelete")?.addEventListener("click", fxDelete);
}
