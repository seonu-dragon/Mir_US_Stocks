// cross-market.js — 국내↔미국 연관 종목(종목 상세 카드 + 오늘 탭 요약 카드)
// =====================================================
// 데이터: data/cross_market_links.js = window.CROSS_MARKET_LINKS (FEATURE_DATA.crossMarket, 두 시장 한 파일)
//   scripts/build_cross_market_links.py 가 US 마감 스냅샷·KR 마감 브리핑 뒤에 하루 두 번 만든다.
//   관계(고객사·경쟁사 등)는 사람이 정한 것, 상관은 최근 1년 일간 수익률로 빌더가 계산한 과거 통계다.
// 화면:
//   (1) 종목 › 분석 › 개요 '해외/국내 연관 종목' 카드(#crossMarketCard) — 누르면 시장을 바꿔 그 종목을 연다.
//   (2) 오늘 탭 › 요약 '간밤 미국 연관주'(KR) / '국내 장 연관주'(US) 카드(#crossMarketHome).
// 순수 계산은 cross-market-core.js(MirCrossMarketCore). 예측 문구를 쓰지 않는다 — 등락·관계·과거 상관만.
// 클래식 스크립트(전역 공유). 최상위 이름은 crossMarket/xm 접두로 충돌을 피한다.

const XM_HOME_MIN_ABS = { kr: 2, us: 3 }; // 보는 시장 기준: KR 모드는 간밤 미국 ±2%, US 모드는 국내 ±3%

function crossMarketPayload() {
  const p = window.CROSS_MARKET_LINKS;
  return p && Array.isArray(p.links) ? p : null;
}

function xmCore() {
  return window.MirCrossMarketCore || null;
}

function xmPctHtml(chg) {
  if (chg == null || !Number.isFinite(Number(chg))) return '<span class="muted">—</span>';
  // 상대 시장 등락이라 KR 상하한 클램프(fmtDailyPct)를 거치지 않는다.
  return `<span class="${cls(Number(chg))}">${fmtPct(Number(chg))}</span>`;
}

function xmNameHtml(row, size = 20) {
  const logo = typeof companyLogoHtml === "function" ? companyLogoHtml(row.ticker, row.market, row.name, size) : "";
  // 국내 종목은 회사명만(코드 표기 안 함), 미국은 티커 + 작은 회사명.
  if (row.market === "kr") return `${logo}<span class="xm-nm">${escapeHtml(row.name || row.ticker)}</span>`;
  const sub = row.name && row.name !== row.ticker ? `<small>${escapeHtml(row.name)}</small>` : "";
  return `${logo}<span class="xm-nm">${escapeHtml(row.ticker)}${row.etf ? '<span class="xm-etf">ETF</span>' : ""}${sub}</span>`;
}

function xmStrengthHtml(strength) {
  const C = xmCore();
  const key = ["strong", "moderate", "weak"].includes(strength) ? strength : "none";
  return `<span class="xm-str xm-str-${key}">${escapeHtml(C ? C.strengthLabel(strength) : strength)}</span>`;
}

// 시장을 바꿔 그 종목을 연다(industry.js industryGoToStock 과 같은 경로). 같은 시장이면 바로 연다.
async function crossMarketGo(ticker, market) {
  if (!ticker) return;
  const cur = typeof marketCfg === "function" ? marketCfg().id : "us";
  try {
    const switched = market && market !== cur && typeof switchMarketMode === "function";
    if (switched) await switchMarketMode(market);
    selectTicker(ticker, { openSearch: true });
    // 시장 전환은 주소창 종목을 새 시장 기본 종목으로 바꿔 둔다(rewriteUrlForMarketSwitch) — 연 종목으로 맞춘다.
    // 이미 종목 화면이면 selectTicker 가 URL 을 건드리지 않아 새로고침 시 기본 종목이 열렸다.
    if (switched) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("ticker") && selectedTicker) {
          url.searchParams.set("ticker", selectedTicker);
          history.replaceState(history.state, "", url.toString());
        }
      } catch (_) { /* history 차단 환경 */ }
    }
  } catch (err) {
    console.warn("crossMarketGo", err);
  }
}

function xmBindGo(host) {
  if (!host || host.dataset.xmBound) return;
  host.dataset.xmBound = "1";
  host.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-xm-ticker]");
    if (!btn || !host.contains(btn)) return;
    crossMarketGo(btn.dataset.xmTicker, btn.dataset.xmMarket);
  });
}

function xmDetailRow(row) {
  const C = xmCore();
  const dateNote = row.date ? `<small class="muted">${escapeHtml(C.shortDate(row.date))}</small>` : "";
  const goLabel = row.market === "us" ? "미국 모드로 바꿔 이 종목 열기" : "국내 모드로 바꿔 이 종목 열기";
  return `<button type="button" class="xm-row" data-xm-ticker="${escapeHtml(row.ticker)}" data-xm-market="${escapeHtml(row.market)}" title="${goLabel}">
      <span class="xm-name">${xmNameHtml(row)}</span>
      <span class="xm-rel"><span class="xm-type xm-type-${escapeHtml(row.type)}">${escapeHtml(row.typeLabel)}</span><span class="xm-why">${escapeHtml(row.why)}</span></span>
      <span class="xm-chg">${xmPctHtml(row.chg)}${dateNote}</span>
      <span class="xm-corr" title="미국 D일 → 국내 다음 거래일 일간 수익률 상관(미국 시장 통제), 표본 ${row.n}일"><b>${C.corrText(row.lagCorrEx)}</b>${xmStrengthHtml(row.strength)}</span>
    </button>`;
}

// (1) 종목 상세 카드
function renderCrossMarketCard(item) {
  const host = byId("crossMarketCard");
  if (!host) return;
  const ticker = item && item.ticker;
  const C = xmCore();
  if (!ticker || !C) { host.hidden = true; host.innerHTML = ""; return; }
  const p = crossMarketPayload();
  if (!p) {
    host.hidden = true;
    host.innerHTML = "";
    ensureFeatureData("crossMarket").then((ok) => {
      if (ok && crossMarketPayload() && selectedTicker === ticker) renderCrossMarketCard(item);
    });
    return;
  }
  const view = marketCfg().id === "kr" ? "kr" : "us";
  const { curated, auto } = C.linksFor(p, view, ticker);
  if (!curated.length && !auto.length) { host.hidden = true; host.innerHTML = ""; return; }
  const title = view === "kr" ? "해외 연관 종목" : "국내 연관 종목";
  const head = `<div class="xm-colhead" aria-hidden="true"><span>종목</span><span>관계</span><span>최근 등락</span><span>상관</span></div>`;
  host.hidden = false;
  host.innerHTML = `<h3>${title}</h3>
    ${curated.length ? `${head}<div class="xm-list">${curated.map(xmDetailRow).join("")}</div>` : ""}
    ${auto.length ? `<p class="xm-auto-head">데이터로 찾은 후보 <span class="muted">· 상관만 높은 쌍, 사람이 확인한 관계 아님</span></p><div class="xm-list">${auto.map(xmDetailRow).join("")}</div>` : ""}`;
  xmBindGo(host);
}

// (2) 오늘 탭 요약 카드
function renderCrossMarketHome() {
  const host = byId("crossMarketHome");
  if (!host) return;
  const C = xmCore();
  const p = crossMarketPayload();
  if (!C || !p) {
    host.hidden = true;
    host.innerHTML = "";
    if (C) ensureFeatureData("crossMarket").then((ok) => { if (ok && crossMarketPayload()) renderCrossMarketHome(); });
    return;
  }
  const view = marketCfg().id === "kr" ? "kr" : "us";
  const from = view === "kr" ? "us" : "kr";
  const minAbs = XM_HOME_MIN_ABS[view];
  const board = C.moveBoard(p, from, { minAbs, limit: 6, perTicker: 4 });
  // US 모드는 보조 표시라 크게 움직인 국내 종목이 없으면 카드를 숨긴다.
  if (view === "us" && !board.rows.length) { host.hidden = true; host.innerHTML = ""; return; }
  const asOf = board.asOf ? C.shortDate(board.asOf) : "";
  const title = view === "kr" ? "간밤 미국 연관주" : "국내 장 연관주";
  const sub = view === "kr"
    ? `미국 ${escapeHtml(asOf)} 장 마감 기준 · ±${minAbs}% 이상 움직인 미국 종목과 연결된 국내 종목`
    : `한국 ${escapeHtml(asOf)} 장 마감 기준 · ±${minAbs}% 이상 움직인 국내 종목과 연결된 미국 종목`;
  const corrWord = view === "kr" ? "간밤→다음날 상관" : "같은 날 상관";
  const body = board.rows.length
    ? `<ol class="xm-board">${board.rows.map((m) => `
        <li class="xm-board-row">
          <button type="button" class="xm-mover" data-xm-ticker="${escapeHtml(m.ticker)}" data-xm-market="${escapeHtml(m.market)}">
            <span class="xm-name">${xmNameHtml(m, 22)}</span>
            <strong class="xm-mover-chg">${xmPctHtml(m.chg)}</strong>
          </button>
          <div class="xm-chips">${m.links.map((r) => `
            <button type="button" class="xm-chip${r.source === "auto" ? " xm-chip-auto" : ""}" data-xm-ticker="${escapeHtml(r.ticker)}" data-xm-market="${escapeHtml(r.market)}" title="${escapeHtml(r.why)}${r.source === "auto" ? " · 데이터로 찾은 후보(사람이 확인한 관계 아님)" : ""}">
              <span class="xm-chip-name">${escapeHtml(r.market === "kr" ? r.name : r.ticker)}</span>
              <small>${escapeHtml(r.typeLabel)} · ${corrWord} ${C.corrText(r.corrEx)}</small>${xmStrengthHtml(r.strengthNow)}
            </button>`).join("")}${m.more ? `<span class="muted xm-more">외 ${m.more}</span>` : ""}</div>
        </li>`).join("")}</ol>`
    : `<p class="muted">간밤 ±${minAbs}% 넘게 움직인 연관 미국 종목이 없습니다.</p>`;
  host.hidden = false;
  host.innerHTML = `
    <div class="section-title xm-home-head">
      <div>
        <h2>${title}</h2>
        <p>${sub}</p>
      </div>
    </div>
    ${body}`;
  xmBindGo(host);
}
