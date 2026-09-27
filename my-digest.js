// my-digest.js — "오늘 내 주식은" 보유·관심 종목 요약 카드(일간 / 주간)
// =====================================================
// 화면: 오늘 › 요약의 '내 종목 이벤트' 위(#myDigestToday), 내 투자 › 보유·관심 맨 위(#myDigestBulk).
// 계산·문장은 전부 my-digest-core.js(window.MirDigestCore)가 한다 — 이 파일은 브라우저 전역을 모아
// 입력 객체를 만들고 결과 객체를 그리기만 한다. 나중에 Web Push 로 보낼 때도 같은 코어를 쓴다.
// LLM 을 부르지 않는다. 이유 줄은 ① 오늘의 특징주 사유(movers, 이미 검증된 자동 요약) ② 같은 기간
// 공시·실적 ③ 업종·지수 대비 수치 순서로 붙이는 '사실'이고, 추천·전망 문구는 넣지 않는다.
// 새 데이터셋 없음: 스냅샷 + MOVERS_REASONS · MATERIAL_EVENTS · EARNINGS_RELEASES · US_STOCK_CALENDAR
//   (US) / KR_DISCLOSURES · KR_DIVIDENDS · KR_IR_SCHEDULE (KR).
// 클래식 스크립트(전역 공유). 최상위 이름은 myDigest 접두로 충돌을 피한다.

const MY_DIGEST_MODE_KEY = "mir.myDigest.mode";
const MY_DIGEST_TODAY_LIMIT = 5;
let myDigestMode = "daily";
let myDigestExpanded = false;
let myDigestTimer = 0;
const myDigestRequested = new Set();
const myDigestAvgMemo = new WeakMap(); // universe 배열 → { day, week, rows }

try {
  const saved = window.safeStorage && window.safeStorage.get(MY_DIGEST_MODE_KEY);
  if (saved === "weekly" || saved === "daily") myDigestMode = saved;
} catch (_) { /* 저장소 없음 */ }

// 이 카드가 읽는 피처 데이터셋. 없으면 한 번만 요청하고, 도착하면 다시 그린다.
// (movers·events·krDart 등은 preloadFeatureData 가 이미 받는다. krIrSchedule 은 lazy 라 여기서 당긴다.)
function myDigestFeatureKeys() {
  return isKrMarket() ? ["movers", "krDart", "krDividends", "krIrSchedule"] : ["movers", "events", "earningsReleases", "usCalendar"];
}

function myDigestEnsureData() {
  if (typeof ensureFeatureData !== "function") return;
  myDigestFeatureKeys().forEach((key) => {
    const meta = typeof FEATURE_DATA !== "undefined" ? FEATURE_DATA[key] : null;
    const reqKey = `${marketCfg().id}:${key}`;
    if (!meta || window[meta.global] || myDigestRequested.has(reqKey)) return;
    myDigestRequested.add(reqKey);
    ensureFeatureData(key).then((ok) => { if (ok) renderMyDigest(); });
  });
}

function myDigestTargets() {
  const holdings = (Array.isArray(portfolio) ? portfolio : []).filter((p) => p && p.ticker && Number(p.qty) > 0);
  const seed = typeof watchlistIsSeed === "function" ? watchlistIsSeed() : false;
  // 손대지 않은 기본 관심 목록은 '내 종목' 이 아니다(내 투자 탭 빈 상태와 같은 규칙).
  const watch = seed ? [] : (Array.isArray(watchlist) ? watchlist : []);
  return { holdings: holdings.map((p) => ({ ticker: normalizeTickerKey(p.ticker), qty: Number(p.qty) })), watch: watch.map((t) => normalizeTickerKey(t)) };
}

function myDigestAverages(universe) {
  const core = window.MirDigestCore;
  let memo = myDigestAvgMemo.get(universe);
  if (!memo) {
    memo = { day: core.groupAverages(universe, "changePct"), week: core.groupAverages(universe, "week"), rows: null };
    myDigestAvgMemo.set(universe, memo);
  }
  return memo;
}

// 비교 지수: 일간은 특징주 보드의 지수 등락(같은 거래일일 때 — 국내는 코스피 실지수), 아니면 시장 대표 ETF.
// 주간은 대표 ETF 의 5거래일 등락(스냅샷 weekChangePct).
function myDigestBench(basisDate) {
  const cfg = marketCfg();
  const etf = (cfg.etfBenchmarks || []).map((t) => stockByTicker(t)).find(Boolean);
  const etfName = etf ? (isKrMarket() ? stockLabel(etf) : `S&P 500(${etf.ticker})`) : "";
  const core = window.MirDigestCore;
  const day = etf ? { name: etfName, changePct: Number(etf.changePct) } : null;
  const mv = window.MOVERS_REASONS;
  const idx = mv && (!mv.market || mv.market === cfg.id) && Array.isArray(mv.indexMoves) ? mv.indexMoves[0] : null;
  const daily = idx && core.normIso(mv.tradeDate) === basisDate && Number.isFinite(Number(idx.changePct))
    ? { name: idx.name, changePct: Number(idx.changePct) } : day;
  const weekly = etf && core.weekReturnOf(etf) != null ? { name: etfName, weekChangePct: core.weekReturnOf(etf) } : null;
  return { daily, weekly };
}

/** 브라우저 전역 → 코어 입력. Web Push 쪽은 이 모양만 맞춰 buildDailyDigest 를 부르면 된다. */
function myDigestInput(mode) {
  const core = window.MirDigestCore;
  const universe = (data && Array.isArray(data.stocks)) ? data.stocks : [];
  const { holdings, watch } = myDigestTargets();
  const tickers = [...new Set([...holdings.map((h) => h.ticker), ...watch])];
  const tickerSet = new Set(tickers.map((t) => String(t).toUpperCase()));
  const today = formatKstDateTime().slice(0, 10);
  const basisDate = core.normIso(data && data.priceDate) ||
    universe.reduce((m, r) => { const d = core.normIso(r && r.priceDate); return d && d > m ? d : m; }, "") || today;
  const kr = isKrMarket();
  const sources = kr
    ? { krDisclosures: window.KR_DISCLOSURES, krDividends: window.KR_DIVIDENDS, krIrSchedule: window.KR_IR_SCHEDULE }
    : { materialEvents: window.MATERIAL_EVENTS, earningsReleases: window.EARNINGS_RELEASES, usCalendar: window.US_STOCK_CALENDAR };
  const past = core.pastEvents(sources, tickerSet, core.addDays(basisDate, -6), basisDate);
  const upcoming = core.upcomingEvents(sources, tickerSet, today, 14);
  const names = {};
  tickers.forEach((t) => { names[String(t).toUpperCase()] = stockLabel(t); });
  const avg = myDigestAverages(universe);
  const bench = myDigestBench(basisDate);
  const mv = window.MOVERS_REASONS;
  return {
    market: marketCfg().id, today, basisDate, holdings, watchlist: watch, universe,
    movers: mv && (!mv.market || mv.market === marketCfg().id) ? mv : null,
    past, upcoming, names,
    bench: mode === "weekly" ? bench.weekly : bench.daily,
    averages: avg.day, weekAverages: avg.week,
    // 미국 업종명은 영어라 섹터(한글)로 비교하고, 국내는 업종(한글)부터.
    preferSector: !kr,
    labelOf: (name, field) => (field === "sector" && typeof sectorLabelKo === "function" ? sectorLabelKo(name) : name),
  };
}

function renderMyDigest() {
  clearTimeout(myDigestTimer);
  myDigestTimer = setTimeout(renderMyDigestNow, 120);
}

function myDigestTag(reason) {
  if (!reason || !reason.tag) return "";
  const kind = reason.type === "movers" ? "news" : reason.type === "event" ? "disc" : "sector";
  return `<span class="movers-tag movers-tag-${kind}">${escapeHtml(reason.tag)}</span>`;
}

function myDigestReasonHtml(reason) {
  if (!reason) return "";
  const link = reason.link ? ` <a class="md-link" href="${escapeHtml(safeHttpHref(reason.link))}" target="_blank" rel="noopener">원문</a>` : "";
  const muted = reason.type === "relative" || reason.type === "none";
  return `<div class="md-why">${myDigestTag(reason)}<span class="${muted ? "md-why-muted" : ""}">${escapeHtml(reason.text)}</span>${link}</div>`;
}

function myDigestLogo(ticker, name) {
  return typeof companyLogoHtml === "function" ? companyLogoHtml(ticker, null, name, 20) : "";
}

function myDigestDailyHtml(d, compact) {
  if (!d.items.length) {
    return `<p class="muted">보유·관심 종목이 현재 ${escapeHtml(marketCfg().id === "kr" ? "국내" : "미국")} 시장 스냅샷에 없습니다.</p>`;
  }
  const limit = compact && !myDigestExpanded ? MY_DIGEST_TODAY_LIMIT : d.items.length;
  const rows = d.items.slice(0, limit).map((it) => {
    const contrib = it.contributionPct != null
      ? `<small class="md-contrib">비중 ${it.weightPct.toFixed(0)}% · 기여 <b class="${cls(it.contributionPct)}">${escapeHtml(window.MirDigestCore.fmtPp(it.contributionPct))}</b></small>` : "";
    const next = it.upcoming.length
      ? `<div class="md-next"><span class="md-next-label">다가오는 일정</span>${it.upcoming.map((u) =>
        `<span class="md-next-item"><b class="${u.dday <= 1 ? "md-soon" : ""}">${u.dday === 0 ? "D-DAY" : `D-${u.dday}`}</b> ${escapeHtml(u.label)} <small class="muted">${escapeHtml(window.MirDigestCore.md(u.date))}</small></span>`).join("")}</div>` : "";
    return `<li class="md-row">
        <button type="button" class="md-go" data-ticker="${escapeHtml(it.ticker)}" title="종목 분석 열기">
          <span class="md-name">${myDigestLogo(it.ticker, it.name)}${escapeHtml(it.name)}<span class="md-role md-role-${it.role === "보유" ? "hold" : "watch"}">${it.role}</span></span>
          <strong class="md-chg ${cls(it.changePct)}">${it.changePct == null ? "—" : fmtDailyPct(it.changePct)}</strong>
        </button>
        ${contrib}
        ${myDigestReasonHtml(it.reason)}
        ${next}
      </li>`;
  }).join("");
  const more = compact && d.items.length > MY_DIGEST_TODAY_LIMIT
    ? `<button type="button" class="ghost compact-btn md-more" data-md-more="1">${myDigestExpanded ? "접기" : `${d.items.length - MY_DIGEST_TODAY_LIMIT}개 더 보기`}</button>` : "";
  return `<ol class="md-list">${rows}</ol>${more}`;
}

function myDigestWeeklyHtml(w) {
  const core = window.MirDigestCore;
  const contribution = w.mode === "contribution";
  const col = (title, list, emptyText) => `
    <div class="md-col">
      <h3>${title}</h3>
      ${list.length ? `<ol class="md-list">${list.map((it) => `
        <li class="md-row">
          <button type="button" class="md-go" data-ticker="${escapeHtml(it.ticker)}" title="종목 분석 열기">
            <span class="md-name">${myDigestLogo(it.ticker, it.name)}${escapeHtml(it.name)}</span>
            <strong class="md-chg ${cls(contribution ? it.contributionPct : it.returnPct)}">${escapeHtml(contribution ? core.fmtPp(it.contributionPct) : core.fmtPct(it.returnPct))}</strong>
          </button>
          ${contribution ? `<small class="md-contrib">5거래일 <b class="${cls(it.returnPct)}">${escapeHtml(core.fmtPct(it.returnPct))}</b> · 비중 ${it.weightPct.toFixed(0)}%</small>` : ""}
          ${myDigestReasonHtml(it.reason)}
        </li>`).join("")}</ol>` : `<p class="muted">${emptyText}</p>`}
    </div>`;
  const body = `<div class="md-cols">
      ${col(contribution ? "기여 상위" : "5거래일 상승 상위", w.top, contribution ? "플러스 기여 종목이 없습니다." : "상승한 종목이 없습니다.")}
      ${col(contribution ? "기여 하위" : "5거래일 하락 상위", w.bottom, contribution ? "마이너스 기여 종목이 없습니다." : "하락한 종목이 없습니다.")}
    </div>`;
  const noHist = w.noHistory.length
    ? `<p class="muted md-note">가격 이력이 없어 5거래일 수익률을 낼 수 없는 종목 ${w.noHistory.length}개는 제외했습니다(${escapeHtml(w.noHistory.map((t) => stockLabel(t)).join(", "))}).</p>` : "";
  return body + noHist;
}

function myDigestHeadlineHtml(d, w) {
  const core = window.MirDigestCore;
  if (w) {
    if (w.mode === "contribution" && w.portfolioReturnPct != null) {
      return `<p class="md-headline">지난 5거래일 보유 종목 <b class="${cls(w.portfolioReturnPct)}">${escapeHtml(core.fmtPct(w.portfolioReturnPct, 2))}</b> <small class="muted">(현재 비중 기준 근사)</small>${w.bench ? ` · ${escapeHtml(w.bench.name)} <b class="${cls(w.bench.changePct)}">${escapeHtml(core.fmtPct(w.bench.changePct))}</b>` : ""}</p>`;
    }
    return w.headline ? `<p class="md-headline">${escapeHtml(w.headline)}</p>` : "";
  }
  if (d.portfolio) {
    const p = d.portfolio;
    return `<p class="md-headline">보유 ${p.count}종목 오늘 <b class="${cls(p.dayReturnPct)}">${escapeHtml(core.fmtPct(p.dayReturnPct, 2))}</b> <small class="muted">(평가액 가중)</small> · 가장 큰 기여 ${escapeHtml(stockLabel(p.topTicker))} <b class="${cls(p.topContribution)}">${escapeHtml(core.fmtPp(p.topContribution))}</b>${d.bench ? ` · ${escapeHtml(d.bench.name)} <b class="${cls(d.bench.changePct)}">${escapeHtml(core.fmtPct(d.bench.changePct))}</b>` : ""}</p>`;
  }
  return d.headline ? `<p class="md-headline">${escapeHtml(d.headline)}${d.bench ? ` · ${escapeHtml(d.bench.name)} <b class="${cls(d.bench.changePct)}">${escapeHtml(core.fmtPct(d.bench.changePct))}</b>` : ""}</p>` : "";
}

function myDigestEmptyHtml() {
  return `
    <div class="md-head"><div><h2>오늘 내 주식은</h2><p>보유·관심 종목의 오늘 등락과 이유, 다가오는 일정을 한 번에</p></div></div>
    <div class="md-empty">
      <p>관심종목이나 보유 종목을 추가하면 종목마다 오늘 등락 · 공시나 특징주 사유 · 실적·배당 일정을 세 줄로 요약해 보여 드립니다. 주간 보기에서는 지난 5거래일 기여 상·하위 종목을 봅니다.</p>
      <button type="button" class="primary compact-btn" data-md-add="1">관심종목 추가하기</button>
    </div>`;
}

function renderMyDigestNow() {
  setupMyDigest();
  const hosts = [["myDigestToday", true], ["myDigestBulk", false]].map(([id, compact]) => [byId(id), compact]).filter(([el]) => el);
  if (!hosts.length) return;
  const core = window.MirDigestCore;
  if (!core || !data || !Array.isArray(data.stocks)) { hosts.forEach(([el]) => { el.hidden = true; }); return; }
  const { holdings, watch } = myDigestTargets();
  const empty = !holdings.length && !watch.length;
  let d = null;
  let w = null;
  if (!empty) {
    myDigestEnsureData();
    const input = myDigestInput(myDigestMode);
    if (myDigestMode === "weekly") w = core.buildWeeklyDigest(input);
    else d = core.buildDailyDigest(input);
    // 디버그·Web Push 준비용: 마지막으로 그린 요약 객체(DOM 없는 순수 구조).
    window.MirMyDigestLast = d || w;
  }
  hosts.forEach(([el, compact]) => {
    // 내 투자 탭은 자체 빈 상태(#myInvestEmpty)가 있어 안내를 겹쳐 그리지 않는다.
    if (empty) {
      el.hidden = !compact;
      el.innerHTML = compact ? myDigestEmptyHtml() : "";
      return;
    }
    el.hidden = false;
    const basis = (d || w).basisDate || "";
    const sub = myDigestMode === "weekly"
      ? `${w.window ? `${escapeHtml(core.md(w.window.from))}~${escapeHtml(core.md(w.window.to))}` : ""} 5거래일 · 보유 ${holdings.length} · 관심 ${watch.length}`
      : `${escapeHtml(basis)} 장 마감 기준 · 보유 ${d.counts.holdings} · 관심 ${d.counts.watch}`;
    const tab = (mode, label) => `<button type="button" class="movers-tab${myDigestMode === mode ? " is-active" : ""}" data-md-mode="${mode}" aria-pressed="${myDigestMode === mode}">${label}</button>`;
    const missing = d && d.missing.length ? `<p class="muted md-note">스냅샷에 없는 종목 ${d.missing.length}개는 뺐습니다.</p>` : "";
    const foot = myDigestMode === "weekly"
      ? (w.mode === "contribution"
        ? "기여 = 5거래일 수익률 × 현재 평가액 비중(보유 › 벤치마크 기여도와 같은 근사). 이유는 기간 중 공시·실적 → 업종·지수 대비 순서의 사실이며 원인을 단정하지 않습니다."
        : "보유 종목이 없어 관심종목의 5거래일 등락으로 보여 줍니다. 이유는 기간 중 공시·실적 → 업종·지수 대비 순서의 사실입니다.")
      : "이유는 ① 오늘의 특징주 자동 요약 ② 직전 거래일~기준일 공시·실적 ③ 업종·지수 대비 순서로 붙인 사실이며 원인을 단정하지 않습니다.";
    el.innerHTML = `
      <div class="md-head">
        <div><h2>${myDigestMode === "weekly" ? "이번 주 내 주식은" : "오늘 내 주식은"}</h2><p>${sub}</p></div>
        <div class="movers-tabs" role="group" aria-label="일간·주간 전환">${tab("daily", "일간")}${tab("weekly", "주간")}</div>
      </div>
      ${myDigestHeadlineHtml(d, w)}
      ${myDigestMode === "weekly" ? myDigestWeeklyHtml(w) : myDigestDailyHtml(d, compact)}
      ${missing}
      <p class="md-foot muted">${foot} 매매 추천이 아닌 정보입니다.</p>`;
  });
}

// 이벤트 위임은 호스트마다 한 번만 건다(다시 그려도 유지).
function setupMyDigest() {
  ["myDigestToday", "myDigestBulk"].forEach((id) => {
    const el = byId(id);
    if (!el || el.dataset.mdBound) return;
    el.dataset.mdBound = "1";
    el.addEventListener("click", (event) => {
      const modeBtn = event.target.closest("[data-md-mode]");
      if (modeBtn) {
        myDigestMode = modeBtn.dataset.mdMode === "weekly" ? "weekly" : "daily";
        try { window.safeStorage && window.safeStorage.set(MY_DIGEST_MODE_KEY, myDigestMode); } catch (_) { /* 저장 실패 무시 */ }
        renderMyDigestNow();
        return;
      }
      if (event.target.closest("[data-md-more]")) {
        myDigestExpanded = !myDigestExpanded;
        renderMyDigestNow();
        return;
      }
      if (event.target.closest("[data-md-add]")) {
        activateTab("bulk", { sub: "holdings" });
      }
    });
    if (typeof delegateTickerClicks === "function") delegateTickerClicks(el, ".md-go");
  });
}
