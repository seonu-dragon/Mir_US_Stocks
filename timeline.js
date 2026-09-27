// timeline.js — 종목 통합 타임라인(종목 › 분석 › 이벤트·공시 탭 #stockTimeline) + 가격 차트 '키 모먼트'의 자료 공급.
//
// 계산(모으기·큰 등락 판정·사유 붙이기)은 timeline-core.js(window.MirTimeline). 여기는 전역 모으기·캐시·그리기.
// 자료는 전부 이미 레포에 커밋돼 브라우저가 받는 전역이다 — 상세 파일(earningsHistory·dividends·splits·일봉),
// US MATERIAL_EVENTS·US_DILUTION·INSIDER_TRADES·ACTIVIST_STAKES·EARNINGS_RELEASES·EARNINGS_MOVE_COMPARE,
// KR KR_DISCLOSURES·KR_EVENT_DETAILS·KR_DIVIDENDS·KR_CONTRACTS·KR_OWNERSHIP·KR_EARNINGS_REACTIONS·KR_CONSENSUS,
// 특징주 MOVERS_REASONS, 이벤트 스터디 종목 샤드(data/event_study/tk, 약 5년 과거 이벤트). 새 외부 호출·LLM 없음.
// 대부분 지연 로드라 늦게 도착한다 — refreshFeatureViews 가 renderStockTimeline 과 refreshChartEventsIfStale 을
// 다시 부르고, 여기 캐시는 원자료 참조가 바뀌었을 때만 다시 모은다(차트 팬·줌 프레임마다 다시 모으지 않게).
// 전역 이름은 tl 접두사(classic script 전역 공유).

const TL_PAGE = 15;
const TL_GOTO_LABEL = { fin: "실적 카드", flow: "수급·보유 탭" };
const tlState = { key: "", cat: "all", shown: TL_PAGE };
let _tlCache = { refs: null, data: null };
let _tlVersion = 0;
const _tlHistory = {}; // "<시장>|<코드>" → rows 배열(없으면 []) — 이벤트 스터디 종목 샤드에서 꺼낸 것

function tlCore() { return window.MirTimeline || null; }
function tlIsKr() { return typeof isKrMarket === "function" && isKrMarket(); }
function tlCode(ticker) { return tlIsKr() ? String(ticker || "") : String(ticker || "").toUpperCase(); }

// 과거 이벤트 기록(이벤트 스터디 종목 샤드). 인덱스·샤드가 오면 피처 뷰 새로고침으로 다시 그린다.
function tlHistoryFor(ticker) {
  const m = tlIsKr() ? "kr" : "us";
  const code = tlCode(ticker);
  const key = `${m}|${code}`;
  if (_tlHistory[key]) return _tlHistory[key];
  const cfg = typeof marketCfg === "function" ? marketCfg() : null;
  if (cfg && cfg.features && cfg.features.eventStudy === false) return null;
  const ix = window.EVENT_STUDY_INDEX;
  if (!ix) {
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("eventStudy").then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
    }
    return null;
  }
  if (typeof esFetchJson !== "function" || !window.MirEventStudyCore) return null;
  const shard = window.MirEventStudyCore.shardOf(code, ix.tkShards || 16);
  const url = `data/event_study/tk/${m}_${String(shard).padStart(2, "0")}.json?v=${encodeURIComponent(ix.updatedAtKst || "")}`;
  // event-study.js 와 같은 캐시(_esTkCache)를 써서 '과거 이벤트 반응' 카드와 요청을 나눠 쓴다.
  esFetchJson(_esTkCache, url).then((pl) => {
    if (_tlHistory[key]) return;
    const rows = pl && pl.t && Array.isArray(pl.t[code]) ? pl.t[code] : [];
    const labels = {};
    (ix.types || []).forEach((t) => { labels[t.k] = t.label; });
    _tlHistory[key] = { rows, labels, scale: ix.scale || 1000 };
    if (typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh();
  });
  return null;
}

function tlArr(obj, key) {
  return obj && Array.isArray(obj[key]) ? obj[key] : null;
}

// 지금 시장·종목에 맞는 원자료 묶음. 다른 시장의 전역이 남아 있어도 쓰지 않는다.
function tlSources(item) {
  const kr = tlIsKr();
  const w = window;
  const code = tlCode(item.ticker);
  const mv = w.MOVERS_REASONS && w.MOVERS_REASONS.market === (kr ? "kr" : "us") ? w.MOVERS_REASONS : null;
  return {
    kr,
    ticker: item.ticker,
    earnings: item.earningsHistory,
    dividends: item.dividends,
    splits: item.splits,
    earnReactions: kr ? tlArr(w.KR_EARNINGS_REACTIONS, "rows") : null,
    earnReleases: kr ? null : tlArr(w.EARNINGS_RELEASES, "releases"),
    earnMoves: !kr && w.EARNINGS_MOVE_COMPARE && w.EARNINGS_MOVE_COMPARE.stocks ? w.EARNINGS_MOVE_COMPARE.stocks[code] || null : null,
    usFilings: kr ? null : tlArr(w.MATERIAL_EVENTS, "events"),
    usDilution: kr ? null : tlArr(w.US_DILUTION, "rows"),
    insiders: kr ? null : tlArr(w.INSIDER_TRADES, "trades"),
    activist: kr ? null : tlArr(w.ACTIVIST_STAKES, "filings"),
    krFilings: kr ? tlArr(w.KR_DISCLOSURES, "disclosures") : null,
    krEventDetails: kr && w.KR_EVENT_DETAILS ? w.KR_EVENT_DETAILS.details : null,
    krDividends: kr ? tlArr(w.KR_DIVIDENDS, "rows") : null,
    krContracts: kr ? tlArr(w.KR_CONTRACTS, "rows") : null,
    krMajor: kr ? tlArr(w.KR_OWNERSHIP, "majorHolders") : null,
    krInsiders: kr ? tlArr(w.KR_OWNERSHIP, "insiders") : null,
    movers: mv,
    krReports: kr && w.KR_CONSENSUS && w.KR_CONSENSUS.stocks && w.KR_CONSENSUS.stocks[code] ? w.KR_CONSENSUS.stocks[code].reports : null,
    history: tlHistoryFor(item.ticker),
  };
}

// 종목의 타임라인 항목 + 키 모먼트(사유 후보 포함). 원자료 참조가 그대로면 캐시.
// 반환 { items, moments, version } — moments 는 전체 일봉 기준 idx 와 reasons 를 가진다.
function tlDataFor(item) {
  const core = tlCore();
  if (!core || !item || !item.ticker) return { items: [], moments: [], version: _tlVersion };
  const s = tlSources(item);
  const refs = [tlIsKr(), item.ticker, item.chartSeries, (item.chartSeries || []).length, ...Object.keys(s).filter((k) => k !== "kr" && k !== "ticker").map((k) => s[k])];
  const c = _tlCache;
  if (c.refs && c.data && c.refs.length === refs.length && c.refs.every((v, i) => v === refs[i])) return c.data;
  const rows = typeof getChartRows === "function" ? getChartRows(item).filter((r) => r && r.d) : [];
  const moments = core.keyMoments(rows);
  const items = core.collectTimeline({ ...s, rows, moments });
  const withReasons = core.attachReasons(moments, items, rows.map((r) => r.d), 1);
  _tlVersion += 1;
  const data = { items, moments: withReasons, version: _tlVersion };
  _tlCache = { refs, data };
  return data;
}

// 차트(chart.js)가 부른다: 키 모먼트 목록과 캐시 세대. 세대가 바뀌면 차트가 마커를 다시 그린다.
window.MirTimelineView = {
  momentsFor(item) { return tlDataFor(item).moments; },
  versionFor(item) { return tlDataFor(item).version; },
};

function tlDate(d) { return String(d || "").replace(/-/g, "."); }

function tlGotoHtml(it, code) {
  const g = it.goto;
  if (!g) return "";
  if (g.chart) return `<button type="button" class="tl-act" data-tl-chart="${escapeHtml(g.chart)}">차트에서 보기</button>`;
  if (g.study) return `<button type="button" class="tl-act" data-tl-study="${escapeHtml(g.study)}" data-tl-code="${escapeHtml(code)}">이벤트 스터디</button>`;
  if (g.view) {
    const label = TL_GOTO_LABEL[g.view] || "관련 패널";
    return `<button type="button" class="tl-act" data-tl-view="${escapeHtml(g.view)}" data-tl-card="${escapeHtml(g.card || "")}">${escapeHtml(label)}</button>`;
  }
  return "";
}

function tlItemHtml(it, momentByDate, code) {
  const core = tlCore();
  let detail = it.detail || "";
  if (it.src === "moment") {
    const m = momentByDate.get(it.date);
    const reasons = m && m.reasons ? m.reasons : [];
    detail += reasons.length
      ? ` · 같은 시기(±1거래일) 기록: ${reasons.slice(0, 3).map((r) => r.title).join(", ")}${reasons.length > 3 ? ` 외 ${reasons.length - 3}건` : ""}`
      : " · 사유 데이터 없음(이 날짜 ±1거래일에 수집된 공시·실적·배당·특징주 기록이 없습니다)";
  }
  const tone = it.cat === "move" && Number.isFinite(it.pct) ? ` ${cls(it.pct)}` : "";
  const link = /^https?:\/\//i.test(it.link || "") ? `<a class="tl-act" href="${escapeHtml(it.link)}" target="_blank" rel="noopener noreferrer">원문</a>` : "";
  const acts = `${link}${tlGotoHtml(it, code)}`;
  const hist = it.src === "history" ? '<span class="tl-hist">과거 기록</span>' : "";
  return `<li class="tl-item tl-cat-${escapeHtml(it.cat)}">
    <time datetime="${escapeHtml(it.date)}">${escapeHtml(tlDate(it.date))}</time>
    <span class="tl-badge">${escapeHtml(core.CAT_LABEL[it.cat] || it.cat)}</span>
    <div class="tl-body"><b class="tl-title${tone}">${escapeHtml(it.title)}</b>${hist}${detail ? `<p>${escapeHtml(detail)}</p>` : ""}${acts ? `<div class="tl-acts">${acts}</div>` : ""}</div>
  </li>`;
}

// 수집 범위 안내 — 공시 데이터셋은 최근 창만 있어서 '없음'이 '사건 없음'이 아닐 수 있다.
function tlCoverageHtml(kr) {
  const core = tlCore();
  const w = window;
  const win = (list, key) => {
    const x = core.dateWindow(list, key);
    return x ? `${x.from.slice(5).replace("-", "/")}~${x.to.slice(5).replace("-", "/")}` : "";
  };
  const li = [];
  const r = core.MOMENT_DEFAULTS;
  li.push(`<li><b>큰 등락</b> 그날 종가 등락률이 직전 ${r.lookback}거래일 하루 등락률 표준편차의 ${r.k}배 이상이고 ${r.minAbsPct}% 이상인 날. 같은 날 ±1거래일의 기록을 '같은 시기 기록'으로 붙일 뿐 원인으로 확인된 것은 아닙니다.</li>`);
  li.push("<li><b>실적·배당·분할</b> 종목 상세 파일 전체 기간. 실적 반응은 발표 시각을 아는 종목은 첫 정규장, 나머지는 발표일 종가 기준입니다.</li>");
  if (kr) {
    const d = w.KR_DISCLOSURES;
    if (d) li.push(`<li><b>DART 공시</b> ${escapeHtml(win(d.disclosures, "fileDate"))} 수집분(최근 ${Number(d.windowDays) || 7}일). 투자설명서·발행실적 같은 부속 서류는 뺐습니다.</li>`);
    if (w.KR_OWNERSHIP) li.push(`<li><b>5%룰·임원 소유</b> 최근 ${Number(w.KR_OWNERSHIP.windowDays) || 7}일 지분공시.</li>`);
    li.push("<li><b>배당·수주·잠정실적 반응</b> DART 원문 파싱본(최근 약 180일). <b>목표가</b> 컨센서스에 실린 최근 증권사 리포트만.</li>");
  } else {
    if (w.MATERIAL_EVENTS) li.push(`<li><b>8-K</b> ${escapeHtml(win(w.MATERIAL_EVENTS.events, "fileDate"))} 수집분(첨부 서류만 있는 건은 뺐습니다).</li>`);
    if (w.ACTIVIST_STAKES) li.push(`<li><b>13D/G</b> ${escapeHtml(win(w.ACTIVIST_STAKES.filings, "fileDate"))}.</li>`);
    if (w.US_DILUTION) li.push(`<li><b>증자 서류(S-3·424B5)</b> ${escapeHtml(win(w.US_DILUTION.rows, "fileDate"))}.</li>`);
    li.push(w.INSIDER_TRADES
      ? `<li><b>Form 4 내부자</b> ${escapeHtml(win(w.INSIDER_TRADES.trades, "fileDate"))} 매수·매도만(옵션 행사·증여 제외).</li>`
      : '<li><b>Form 4 내부자</b> 아직 받지 않았습니다(약 4MB). <button type="button" class="tl-act" data-tl-load="insider">내부자 거래도 불러오기</button></li>');
    li.push("<li><b>목표가</b> 미국은 날짜가 붙은 목표가 변화 기록이 없어 넣지 않았습니다(목표주가 범위는 좌측 패널).</li>");
  }
  const mv = w.MOVERS_REASONS;
  if (mv && mv.tradeDate) li.push(`<li><b>특징주 사유</b> ${escapeHtml(mv.tradeDate)} 하루치 자동 요약(틀릴 수 있음).</li>`);
  li.push(window.EVENT_STUDY_INDEX
    ? "<li><b>과거 기록</b> 이벤트 스터디가 모은 약 5년치 주요 공시 유형(반응일 기준)만. 지금 창의 공시와 겹치면 뺐습니다.</li>"
    : "<li><b>과거 기록</b> 이벤트 스터디 인덱스를 받는 중이거나 이 시장에서 꺼져 있습니다.</li>");
  return `<details class="about-data tl-about"><summary>수집 범위 · 한계</summary><ul>${li.join("")}</ul></details>`;
}

function renderStockTimeline(item) {
  const host = byId("stockTimeline");
  if (!host) return;
  const core = tlCore();
  if (!core || !item || !item.ticker || item.__liveStub) { host.hidden = true; host.innerHTML = ""; return; }
  tlBindOnce(host);
  const kr = tlIsKr();
  const key = `${kr ? "kr" : "us"}|${item.ticker}`;
  if (tlState.key !== key) { tlState.key = key; tlState.cat = "all"; tlState.shown = TL_PAGE; }
  // 이 카드만 쓰는 가벼운 지연 데이터(US 증자 서류 ~180KB). 도착하면 refreshFeatureViews 가 다시 그린다.
  if (!kr && !window.US_DILUTION && typeof ensureFeatureData === "function") {
    ensureFeatureData("usDilution").then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
  }
  const data = tlDataFor(item);
  const counts = core.countByCat(data.items);
  if (tlState.cat !== "all" && !counts[tlState.cat]) tlState.cat = "all";
  const list = core.filterItems(data.items, tlState.cat);
  const shown = list.slice(0, tlState.shown);
  const momentByDate = new Map(data.moments.map((m) => [m.date, m]));
  const code = tlCode(item.ticker);
  const chip = (c, label) => {
    const on = tlState.cat === c;
    return `<button type="button" class="tl-chip${on ? " is-active" : ""}" data-tl-cat="${c}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(label)} <b>${counts[c]}</b></button>`;
  };
  const chips = [chip("all", "전체"), ...core.CATS.filter((c) => counts[c]).map((c) => chip(c, core.CAT_LABEL[c]))].join("");
  const rest = list.length - shown.length;
  const body = list.length
    ? `<ol class="tl-list">${shown.map((it) => tlItemHtml(it, momentByDate, code)).join("")}</ol>
       ${rest > 0 ? `<button type="button" class="tl-more" data-tl-more="1">더 보기 (남은 ${rest}건)</button>` : ""}`
    : '<p class="muted tl-empty">수집된 기간 안에 이 종목의 공시·실적·배당·지분 기록이 없습니다. 아래 수집 범위를 참고하세요.</p>';
  host.hidden = false;
  host.innerHTML = `<div class="tl-head"><h3>통합 타임라인</h3><span class="muted">공시·실적·배당·지분·특징주·큰 등락을 시간순으로 · 사실 나열이며 매매 추천이 아닙니다</span></div>
    <div class="tl-chips" role="group" aria-label="타임라인 유형 필터">${chips}</div>
    ${body}
    ${tlCoverageHtml(kr)}`;
}

function tlScrollTo(el) {
  if (!el) return;
  const main = byId("stockDetail");
  const stickyTop = main ? parseFloat(getComputedStyle(main).getPropertyValue("--sd-sticky-top")) || 0 : 0;
  const nav = byId("stockViewTabs");
  const navH = nav && getComputedStyle(nav).position === "sticky" ? nav.offsetHeight : 0;
  const top = el.getBoundingClientRect().top + window.pageYOffset - stickyTop - navH - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}

function tlBindOnce(host) {
  if (host.dataset.bound) return;
  host.dataset.bound = "1";
  host.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !host.contains(t)) return;
    if (t.dataset.tlCat) {
      tlState.cat = t.dataset.tlCat;
      tlState.shown = TL_PAGE;
    } else if (t.dataset.tlMore) {
      tlState.shown += TL_PAGE * 2;
    } else if (t.dataset.tlLoad) {
      t.disabled = true;
      t.textContent = "불러오는 중…";
      if (typeof ensureFeatureData === "function") {
        ensureFeatureData(t.dataset.tlLoad).then(() => { if (typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
      }
      return;
    } else if (t.dataset.tlStudy) {
      if (typeof openEventStudy === "function") openEventStudy(t.dataset.tlStudy, { ticker: t.dataset.tlCode || "" });
      return;
    } else if (t.dataset.tlChart) {
      if (typeof activateStockView === "function") activateStockView("overview", { push: true });
      setTimeout(() => tlScrollTo(byId("priceChart")), 30);
      return;
    } else if (t.dataset.tlView) {
      const card = t.dataset.tlCard ? byId(t.dataset.tlCard) : null;
      if (typeof activateStockView === "function") activateStockView(t.dataset.tlView, { push: true, scroll: !card || card.hidden });
      if (card && !card.hidden) setTimeout(() => tlScrollTo(card), 30);
      return;
    } else {
      return;
    }
    const item = typeof selectedBaseRow === "function" && selectedBaseRow() ? applyLive(withDetail(selectedBaseRow())) : null;
    if (item) renderStockTimeline(item);
  });
}
