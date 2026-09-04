// feature-data.js — 피처 데이터셋 레지스트리 & 지연 로더
// =====================================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없어서,
// 여기서 참조하는 app.js 쪽 렌더 함수(renderSignals 등)는 호출 시점에 이미 존재한다.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

function featureDataSrc(path) {
  const v = window.MIR_BUILD_ID || "dev";
  return `${path}?v=${v}`;
}

// Feature datasets that used to be eager <script> tags in index.html. They are
// multi-MB and many are US-only, so we load them on demand after boot, gated by
// the active market's feature flags. `feature` maps to cfg.features; `usOnly`
// loads only in US mode; datasets without either load in both markets.
const FEATURE_DATA = {
  inst13f:    { global: "INSTITUTIONAL_13F",     path: "data/institutional_13f.js",     feature: "sec13f",   heavy: true },
  congress:   { global: "CONGRESS_TRADES",       path: "data/congress_trades.js",       feature: "congress", heavy: true },
  insider:    { global: "INSIDER_TRADES",        path: "data/insider_trades.js",        feature: "insider",  heavy: true },
  activist:   { global: "ACTIVIST_STAKES",       path: "data/activist_stakes.js",       feature: "activist" },
  events:     { global: "MATERIAL_EVENTS",       path: "data/material_events.js",       feature: "materialEvents" },
  ipo:        { global: "IPO_CALENDAR",          path: "data/ipo_calendar.js",          feature: "ipo",          marketSpecific: true },
  short:      { global: "SHORT_INTEREST",        path: "data/short_interest.js",        feature: "shortInterest", marketSpecific: true },
  whitehouse: { global: "WHITE_HOUSE_SCHEDULE",  path: "data/white_house_schedule.js",  feature: "whiteHouse" },
  leveraged:  { global: "LEVERAGED_ETF_CATALOG", path: "data/leveraged_etf_catalog.js", usOnly: true },
  krDart:     { global: "KR_DISCLOSURES",        path: "data/kr_disclosures.js",        feature: "krDart", krOnly: true },
  krOwnership:{ global: "KR_OWNERSHIP",          path: "data/kr_ownership.js",          feature: "krOwnership", krOnly: true },
  // 지분 '상태'(유통물량·자사주·최대주주 지분율). 위 krOwnership 은 최근 지분공시
  // '이벤트' 라 성격이 다르지만 같은 패널에서 종류 탭으로 나눠 보여준다.
  krOwnProfile:{ global: "KR_OWNERSHIP_PROFILE",  path: "data/korea/ownership_profile.js", feature: "krOwnership", krOnly: true },
  // 공시 제목에 붙일 숫자(증자 희석률·CB 전환가·자사주 금액). rcept_no 로 조인한다.
  krEventDetails:{ global: "KR_EVENT_DETAILS",    path: "data/kr_event_details.js",      feature: "krDart", krOnly: true },
  // 감사의견. 비적정(의견거절·한정)은 상장폐지 사유라 종목 헤더에 경고로 띄운다.
  krAudit:    { global: "KR_AUDIT_OPINION",       path: "data/korea/audit_opinion.js",  feature: "krDart", krOnly: true },
  // 공시 유형별 과거 주가 반응(5년·55만건). 신호가 아니라 '신호가 아니다' 를 보여주는
  // 데이터다 — 41개 유형 중 무작위를 이긴 건 0개다(build_kr_disclosure_stats.py).
  krDiscStats:{ global: "KR_DISCLOSURE_STATS",    path: "data/korea/disclosure_stats.js", feature: "krDart", krOnly: true },
  // 수급(외국인·기관·개인 순매수, 외국인 보유율) + 컨센서스 목표주가. 484KB 라
  // heavy(3~5MB) 는 아니지만 KR 전용이라 미국에선 안 받는다.
  krFlow:     { global: "KR_INVESTOR_FLOW",       path: "data/korea/investor_flow.js", krOnly: true },
  // 애널리스트 컨센서스(FnGuide·네이버 리포트) — 종목별 목표주가·투자의견·추정 실적.
  // 국내 셀사이드 목표가는 구조적 낙관 편향(중앙값 +67.6%)이라 '상승여력' 을 매매
  // 신호로 쓰지 않고 참고용으로만, estimateCount·lastReportDate 를 함께 강조해 보여준다.
  // krFlow 처럼 KR 전용 경량 프리로드(207KB)라 미국 모드에선 받지 않는다.
  krConsensus:{ global: "KR_CONSENSUS",           path: "data/korea/consensus.js",     krOnly: true },
  // 잠정실적 발표 + 발표일·익일 주가반응(build_kr_earnings_reactions.py). KR 전용.
  krEarningsReact:{ global: "KR_EARNINGS_REACTIONS", path: "data/korea/earnings_reactions.js", feature: "krDart", krOnly: true },
  // 배당·공급계약 공시 원문 파싱(build_kr_corp_disclosures.py). KR 전용.
  krDividends:{ global: "KR_DIVIDENDS", path: "data/korea/dividends.js", feature: "krDart", krOnly: true },
  krContracts:{ global: "KR_CONTRACTS", path: "data/korea/contracts.js", feature: "krDart", krOnly: true },
  // 미국 국채 수익률 곡선(FRED). 매크로 컨텍스트라 두 시장 모두에서 로드(미국 금리는
  // 글로벌 위험자산에 공통 영향). 시그널 탭 상단에 곡선·장단기 스프레드로 표시.
  yieldCurve: { global: "YIELD_CURVE", path: "data/yield_curve.js" },
  // FRED 매크로 지표(인플레·고용·금리·신용스프레드·소비심리). 두 시장 모두 로드.
  macro: { global: "MACRO_INDICATORS", path: "data/macro_indicators.js" },
  // CFTC COT 투기 포지셔닝(주간, 무키 공식 API). 미국 선물이지만 지수·금리·환율·
  // 원자재 쏠림은 글로벌 위험자산 공통 컨텍스트라 두 시장 모두 로드.
  cotPositioning: { global: "COT_POSITIONING", path: "data/cot_positioning.js" },
  // 미 국채 경매 수요(bid-to-cover, FiscalData). 금리곡선 패널과 짝 — 두 시장 모두.
  treasuryAuctions: { global: "TREASURY_AUCTIONS", path: "data/treasury_auctions.js" },
  // SEC 결제 불이행(FTD, 반월 파일). 공매도 서브탭에서만 쓰는 US 전용 lazy.
  secFtd: { global: "SEC_FTD", path: "data/sec_ftd.js", usOnly: true, lazy: true },
  // 위키 조회수 리테일 관심도(영어/한국어 위키). 시장별 목록이 한 파일에 있어 둘 다 로드.
  wikiAttention: { global: "WIKI_ATTENTION", path: "data/wiki_attention.js" },
  // 외부 공포탐욕 게이지(크립토 공식 + CNN 비공식). 심리지수 비교용 — 둘 다 로드.
  sentimentGauges: { global: "SENTIMENT_GAUGES", path: "data/sentiment_gauges.js" },
  // WSB 댓글 감성(Tradestie). AI 브리핑 탭 소셜 표 전용 — US 전용 lazy.
  wsbSentiment: { global: "WSB_SENTIMENT", path: "data/wsb_sentiment.js", usOnly: true, lazy: true },
  // 한국은행 ECOS 매크로(기준금리·국고채·신용스프레드·환율·CPI·뉴스심리). KR 전용.
  ecosMacro: { global: "KR_ECOS_MACRO", path: "data/korea/ecos_macro.js", krOnly: true },
  // 관세청 품목별 수출 모멘텀(반도체·자동차·배터리 등 월간 수출액·YoY). KR 전용.
  // lazy: 관세청 서비스 활성화 전엔 파일이 없다 — 시그널 탭에서만 시도해 404 소음 최소화.
  tradeExports: { global: "KR_TRADE_EXPORTS", path: "data/korea/trade_exports.js", krOnly: true, lazy: true },
  // 나라장터 낙찰(정부수주, 상장사 매칭분). 수주 서브탭에서만 쓰는 KR 전용 lazy.
  krGovContracts: { global: "KR_GOV_CONTRACTS", path: "data/korea/gov_contracts.js", krOnly: true, lazy: true },
  // 국민연금 종목별 보유내역(연 1회 공시). 종목 카드 지분율 표시용 — KR 전용.
  krNps: { global: "KR_NPS_HOLDINGS", path: "data/korea/nps_holdings.js", krOnly: true },
  // 공정위 대기업집단 소속 상장사 매핑(연 1회 지정). 종목 카드 그룹사 카드용 — KR 전용.
  krCorpGroups: { global: "KR_CORP_GROUPS", path: "data/korea/corp_groups.js", krOnly: true },
  // 옵션 심리(풋콜비율·맥스페인, Yahoo). 미국 대형주만 옵션이 있어 US 전용.
  optionsStats: { global: "OPTIONS_STATS", path: "data/options_stats.js", usOnly: true },
  // 연방 계약(USASpending). 정부 매출이 큰 방산·IT·헬스 종목만 있어 US 전용 alt-data.
  federalContracts: { global: "FEDERAL_CONTRACTS", path: "data/federal_contracts.js", usOnly: true },
  // 애널리스트 컨센서스(Finnhub 추천·실적 서프라이즈). 무료 티어가 미국만이라 US 전용.
  analystConsensus: { global: "ANALYST_CONSENSUS", path: "data/analyst_consensus.js", usOnly: true },
  // FINRA 일일 공매도 거래량(통합). 미국만 공개라 US 전용.
  finraShort: { global: "FINRA_SHORT_VOLUME", path: "data/finra_short_volume.js", usOnly: true },
  // 배당 + 다음 실적 예정일(Yahoo). US 전용(KR 은 별도 배당 트래커가 있음).
  usCalendar: { global: "US_STOCK_CALENDAR", path: "data/us_calendar.js", usOnly: true },
  // US 증자·희석(S-3/S-3ASR/424B5 등 SEC 등록서류). 종목검색 탭 첫 진입 때만 시도
  // (lazy, activateTab 참고). 파이프라인이 파일을 배포하기 전에는 로드가 실패하고,
  // 그때는 서브탭 자체가 숨는다(applySearchSubVisibility).
  usDilution: { global: "US_DILUTION", path: "data/us_dilution.js", usOnly: true, lazy: true },
  // KR 일일 공매도 거래비중(KRX). 잔고(short_interest)와 별개 파일 — 공매도 탭을
  // 열 때만 시도(lazy)하고, 없으면 잔고/거래비중 토글이 숨는다.
  krShortVolume: { global: "KR_SHORT_VOLUME", path: "data/korea/short_volume.js", feature: "shortInterest", krOnly: true, lazy: true },
  // 공포탐욕·환율·매크로 일일 히스토리(1일 1레코드 적립) — 시그널 탭 스파크라인.
  marketHistory: { global: "MARKET_HISTORY", path: "data/history/market_history.js" },
};
const _featureDataPromises = {};
// 실패한 로드는 세션 안에서 다시 시도하지 않는다(키 → 실패 시각). 예전엔 부르는 곳마다
// 같은 404 를 반복 요청했다. 시장 전환(resetMarketCaches)이나 수동 재확인 때만 비운다.
const _featureDataFailed = {};
function clearFeatureDataFailures() {
  Object.keys(_featureDataFailed).forEach((k) => delete _featureDataFailed[k]);
}

function featureDataEnabled(meta, cfg) {
  if (meta.usOnly) return cfg.id === "us";
  if (meta.krOnly) return cfg.id === "kr";
  if (meta.feature) return !(cfg.features && cfg.features[meta.feature] === false);
  return true;
}

// Inject a feature dataset's <script> once. Resolves true when its window global
// is available, false if disabled for this market or the load failed. The result
// for a disabled feature is not cached, so a later market switch can still load it.
function ensureFeatureData(key) {
  const meta = FEATURE_DATA[key];
  if (!meta) return Promise.resolve(false);
  if (window[meta.global]) return Promise.resolve(true);
  if (!featureDataEnabled(meta, marketCfg())) return Promise.resolve(false);
  if (_featureDataFailed[key]) return Promise.resolve(false);
  if (_featureDataPromises[key]) return _featureDataPromises[key];

  let path = meta.path;
  if (meta.marketSpecific && marketCfg().id === "kr") {
    path = `data/korea/${path.split("/").pop()}`;
  }
  const src = featureDataSrc(path);

  _featureDataPromises[key] = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.featureData = key;
    script.addEventListener("load", () => resolve(!!window[meta.global]), { once: true });
    script.addEventListener("error", () => {
      delete _featureDataPromises[key];
      _featureDataFailed[key] = { failedAt: Date.now() };
      resolve(false);
    }, { once: true });
    document.head.appendChild(script);
  });
  return _featureDataPromises[key];
}

// After boot, stream in the *light* feature datasets — but only once the browser is
// idle, so the prefetch never competes with first paint or the market snapshot.
// Heavy datasets (13F / congress / insider, ~11MB combined) are excluded here and
// load lazily when their tab is first opened (see renderWithFeature / activateTab),
// so a visitor who never opens those tabs never downloads them.
function preloadFeatureData() {
  const run = () => Object.keys(FEATURE_DATA).forEach((key) => {
    if (FEATURE_DATA[key].heavy || FEATURE_DATA[key].lazy) return;
    ensureFeatureData(key).then((ok) => { if (ok) scheduleFeatureViewRefresh(); });
  });
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}

// Render a feature surface, lazy-loading its dataset on first use. While the dataset
// streams in, a loading notice is shown in `loadingTargetId` (if given); the surface
// re-renders once the data lands. Datasets already loaded render synchronously.
// `shouldLoad` gates the network fetch: pass false when rendering a hidden/pre-rendered
// surface (e.g. the boot pre-render) so heavy datasets only download once the surface
// is actually viewed.
function renderWithFeature(key, renderFn, loadingTargetId, shouldLoad = true) {
  const meta = FEATURE_DATA[key];
  if (shouldLoad && meta && featureDataEnabled(meta, marketCfg()) && !window[meta.global]) {
    const target = loadingTargetId ? byId(loadingTargetId) : null;
    if (target) target.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    ensureFeatureData(key).then(() => renderFn());
    return;
  }
  renderFn();
}

let _featureRefreshTimer = null;
function scheduleFeatureViewRefresh() {
  clearTimeout(_featureRefreshTimer);
  _featureRefreshTimer = setTimeout(refreshFeatureViews, 250);
}

// Re-render only the on-screen surfaces that read feature globals (no network).
function refreshFeatureViews() {
  // applySearchSubVisibility: US 자사주·증자희석 탭은 데이터(8-K kind / US_DILUTION)가
  // 늦게 도착하면 그때 나타나야 한다 — 부팅 시점엔 전역이 없어 숨겨져 있다.
  const calls = [renderSignalsIfVisible, renderActionBoard, renderKrHighlights, () => applySearchSubVisibility(), renderTodayRegime];
  if (currentTab === "search" && INST_SUBS.includes(searchSubTab)) {
    calls.push(() => activateInstitutionalSub(institutionalSubTab, { push: false }));
  } else if (currentTab === "search") {
    if (searchSubTab === "short") {
      calls.push(renderShortInterest);
    } else if (searchSubTab === "buyback") {
      calls.push(renderBuyback);
    } else if (searchSubTab === "dilution") {
      calls.push(renderDilution);
    } else if (selectedTicker && data && Array.isArray(data.stocks)) {
      const base = selectedBaseRow();
      if (base) {
        const item = applyLive(withDetail(base));
        calls.push(
          () => renderCongressTradesForTicker(item),
          () => renderSmartMoney(item),
          () => renderMoveExplanation(item),
          () => renderEstimateRevision(item),
          () => renderStockEvents(item),
        );
      }
    }
  }
  // 종목 요약 패널은 렌더 시점에 피처 전역이 없으면 카드(수급·감사의견)를 "" 로 빼고
  // 끝이라, 데이터가 늦게 도착하면 그 카드가 영영 안 나온다. 라이브에서 krFlow(484KB)가
  // 패널 렌더보다 늦게 도착해 수급 카드가 간헐적으로 통째로 빠졌다 — 로컬에선 데이터가
  // 빨라 거의 안 보이던 경합이다. 패널이 떠 있으면 다시 그린다.
  if (selectedTicker && data && Array.isArray(data.stocks)) {
    const base = selectedBaseRow();
    if (base) {
      const item = applyLive(withDetail(base));
      if (byId("selectedStock")) calls.push(() => renderSelected(item));
      const facts = byId("searchFacts");
      if (facts) calls.push(() => { facts.innerHTML = stockFacts(item, "선택 종목"); });
    }
  }
  if (byId("sub-etf-lev")?.classList.contains("is-active")) {
    calls.push(() => ensureFeatureData("leveraged").then(() => renderLeveragedEtfPage()));
  }
  calls.forEach((fn) => { try { fn(); } catch (e) { console.warn("refreshFeatureViews", e); } });
}

// The MirProb analysis engine (analysis.js) reads 13F / insider / short-interest
// globals as scoring inputs. Await them before a deep run so lazy loading never
// silently drops those signals. In KR mode these are disabled → resolves instantly.
function ensureAnalysisFeatureData() {
  return Promise.all([
    ensureFeatureData("inst13f"),
    ensureFeatureData("insider"),
    ensureFeatureData("short"),
    ensureFeatureData("optionsStats"),
    ensureFeatureData("federalContracts"),
    ensureFeatureData("analystConsensus"),
    ensureFeatureData("finraShort"),
    ensureFeatureData("usCalendar"),
  ]);
}
