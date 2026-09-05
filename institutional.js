// institutional.js — 13F · 의회 거래(수급 주체) 뷰
// ==============================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없다.
// 담는 것: 발행사명 → 티커 인덱스(ISSUER_TICKER_HINTS·issuerTickerIndex·
// resolveIssuerTicker), 13F 데이터 접근·분기 비교·렌더, 의회 거래 렌더와
// 종목별 의회 거래 패널.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

const ISSUER_TICKER_HINTS = {
  "APPLE INC": "AAPL",
  "AMAZON COM INC": "AMZN",
  "ALPHABET INC": "GOOGL",
  "MICROSOFT CORP": "MSFT",
  "META PLATFORMS INC": "META",
  "NVIDIA CORP": "NVDA",
  "TESLA INC": "TSLA",
  "BERKSHIRE HATHAWAY INC": "BRK.B",
  "JPMORGAN CHASE & CO": "JPM",
  "BANK AMERICA CORP": "BAC",
  "CHEVRON CORP NEW": "CVX",
  "CHEVRON CORPORATION": "CVX",
  "COCA COLA CO": "KO",
  "AMERICAN EXPRESS CO": "AXP",
  "WELLS FARGO & CO NEW": "WFC",
  "CITIGROUP INC": "C",
  "GOLDMAN SACHS GROUP INC": "GS",
  "MORGAN STANLEY": "MS",
  "VISA INC": "V",
  "MASTERCARD INC": "MA",
  "UNITEDHEALTH GROUP INC": "UNH",
  "JOHNSON & JOHNSON": "JNJ",
  "ELI LILLY & CO": "LLY",
  "PROCTER & GAMBLE CO": "PG",
  "COSTCO WHSL CORP NEW": "COST",
  "HOME DEPOT INC": "HD",
  "NETFLIX INC": "NFLX",
  "PALANTIR TECHNOLOGIES INC": "PLTR",
  "ADVANCED MICRO DEVICES INC": "AMD",
  "BROADCOM INC": "AVGO",
};

function normalizeIssuerName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+(INC|CORP|CO|LTD|PLC|NEW|HLDGS|HOLDINGS|GROUP)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 스냅샷당 한 번만 회사명을 정규화해 둔다(13F 행 × 종목 × 키 입력마다 정규화하던 것).
let _issuerTickerIndex = null;
const _issuerResolveCache = new Map();
function issuerTickerIndex() {
  if (_issuerTickerIndex) return _issuerTickerIndex;
  const byNorm = new Map();
  const byFirst = new Map();
  const entries = [];
  (data.stocks || []).forEach((stock) => {
    const norm = normalizeIssuerName(stock.company);
    if (!norm) return;
    if (!byNorm.has(norm)) byNorm.set(norm, stock.ticker);
    const first = norm.split(" ")[0];
    if (first && !byFirst.has(first)) byFirst.set(first, stock.ticker);
    entries.push([norm, stock.ticker]);
  });
  _issuerTickerIndex = { byNorm, byFirst, entries };
  return _issuerTickerIndex;
}
function resolveIssuerTicker(issuer) {
  const upper = String(issuer || "").toUpperCase().trim();
  if (ISSUER_TICKER_HINTS[upper]) return ISSUER_TICKER_HINTS[upper];
  if (_issuerResolveCache.has(upper)) return _issuerResolveCache.get(upper);
  const idx = issuerTickerIndex();
  const norm = normalizeIssuerName(issuer);
  let out = idx.byNorm.get(norm) || null;
  if (!out) {
    const first = norm.split(" ")[0];
    if (first && first.length >= 3) {
      out = idx.byFirst.get(first) || null;
      if (!out) {
        const hit = idx.entries.find(([n]) => n.startsWith(first));
        out = hit ? hit[1] : null;
      }
    }
  }
  _issuerResolveCache.set(upper, out);
  return out;
}

function institutional13fData() {
  return window.INSTITUTIONAL_13F || { institutions: [] };
}

function institutionQuarterRows(inst) {
  if (Array.isArray(inst.quarters) && inst.quarters.length) return inst.quarters;
  if ((inst.holdings || []).length) {
    return [{
      reportDate: inst.reportDate,
      reportLabel: inst.reportDate,
      filedDate: inst.filedDate,
      accession: inst.accession,
      holdings: inst.holdings,
    }];
  }
  return [];
}

function holdingKey(row) {
  return `${row.issuer || ""}|${row.titleOfClass || ""}|${row.putCall || ""}`;
}

function holdingPositionMeta(row) {
  const pc = String(row?.putCall || "").toLowerCase();
  if (pc === "put") {
    return { badge: "PUT", label: "풋 옵션", cls: "is-put", hint: "하락 베팅 (주식 숏 아님)" };
  }
  if (pc === "call") {
    return { badge: "CALL", label: "콜 옵션", cls: "is-call", hint: "콜 옵션 보유" };
  }
  return { badge: "", label: "주식", cls: "is-stock", hint: "" };
}

function formatHoldingShares(row) {
  const shares = Number(row?.shares || 0);
  const pc = String(row?.putCall || "").toLowerCase();
  if (pc === "put" || pc === "call") {
    const contracts = Math.round(shares / 100);
    return `${contracts.toLocaleString()}계약 <span class="muted">(명목 ${shares.toLocaleString()}주)</span>`;
  }
  return shares.toLocaleString();
}

function resolveHoldingTicker(row) {
  const fromRow = String(row?.ticker || "").toUpperCase().trim();
  if (fromRow && stockByTicker(fromRow)) return fromRow;
  return resolveIssuerTicker(row?.issuer);
}

function holdingQuarterDelta(current, prior, row) {
  const key = holdingKey(row);
  const prev = (prior?.holdings || []).find((h) => holdingKey(h) === key);
  if (!prev) return { text: "신규", cls: "is-new" };
  const delta = Number(row.shares || 0) - Number(prev.shares || 0);
  if (!delta) return { text: "유지", cls: "is-flat" };
  const pct = prev.shares ? ((delta / prev.shares) * 100) : null;
  const sign = delta > 0 ? "+" : "";
  const pctText = pct != null ? ` (${sign}${pct.toFixed(1)}%)` : "";
  return {
    text: `${sign}${delta.toLocaleString()}${pctText}`,
    cls: delta > 0 ? "is-up" : "is-down",
  };
}

function setupInstitutionalUi() {
  if (institutionalUiReady) return;
  const search = byId("institutionalSearch");
  const select = byId("institutionalSelect");
  if (search) {
    search.addEventListener("input", () => {
      institutionalSearchQuery = search.value.trim().toLowerCase();
      renderInstitutional13f();
    });
  }
  if (select) {
    select.addEventListener("change", () => {
      selectedInstitutionId = select.value;
      selectedInstitutionQuarterIdx = 0;
      renderInstitutional13f();
    });
  }
  institutionalUiReady = true;
}

function renderInstitutional13f() {
  setupInstitutionalUi();
  render13fHighlights();
  const payload = institutional13fData();
  const institutions = (payload.institutions || []).filter((inst) => {
    if (inst.status !== "ok") return false;
    return institutionQuarterRows(inst).length > 0;
  });
  const meta = byId("institutionalMeta");
  const select = byId("institutionalSelect");
  const detail = byId("institutionalDetail");
  if (!meta || !detail) return;

  const schedule = payload.updateSchedule === "quarterly"
    ? "분기별 갱신 (13F 공시 주기)"
    : "스냅샷 갱신";
  meta.innerHTML = `
    <div class="institutional-meta-grid">
      <article><span>데이터 출처</span><strong>${escapeHtml(payload.source || "SEC EDGAR 13F-HR")}</strong></article>
      <article><span>갱신 주기</span><strong>${escapeHtml(schedule)}</strong></article>
      <article><span>마지막 빌드</span><strong>${escapeHtml(payload.updatedAtKst || "-")}</strong></article>
    </div>
    <p>${escapeHtml(payload.note || "")}</p>
  `;

  if (!institutions.length) {
    if (select) select.innerHTML = "";
    detail.innerHTML = `<p class="muted">13F 데이터를 불러오지 못했습니다. <code>python scripts/build_13f_snapshot.py</code> 실행 후 다시 시도하세요.</p>`;
    return;
  }

  const filtered = institutions.filter((inst) => {
    if (!institutionalSearchQuery) return true;
    const hay = `${inst.name} ${inst.manager || ""} ${inst.id}`.toLowerCase();
    return hay.includes(institutionalSearchQuery);
  });
  const list = filtered.length ? filtered : institutions;

  if (!list.some((inst) => inst.id === selectedInstitutionId)) {
    selectedInstitutionId = list[0].id;
    selectedInstitutionQuarterIdx = 0;
  }

  if (select) {
    const prev = select.value;
    select.innerHTML = list.map((inst) => {
      const q = institutionQuarterRows(inst)[0];
      const label = inst.manager
        ? `${inst.name} · ${inst.manager}`
        : inst.name;
      const suffix = q?.reportLabel || q?.reportDate || "";
      return `<option value="${escapeHtml(inst.id)}">${escapeHtml(label)}${suffix ? ` (${escapeHtml(suffix)})` : ""}</option>`;
    }).join("");
    select.value = list.some((inst) => inst.id === selectedInstitutionId) ? selectedInstitutionId : list[0].id;
    if (prev !== select.value) selectedInstitutionQuarterIdx = 0;
    selectedInstitutionId = select.value;
  }

  const active = list.find((inst) => inst.id === selectedInstitutionId) || list[0];
  const quarters = institutionQuarterRows(active);
  if (selectedInstitutionQuarterIdx >= quarters.length) selectedInstitutionQuarterIdx = 0;
  const current = quarters[selectedInstitutionQuarterIdx] || quarters[0];
  const prior = quarters[selectedInstitutionQuarterIdx + 1] || null;
  const rows = (current?.holdings || []).slice(0, 25);

  const quarterTabs = quarters.length > 1
    ? `<div class="inst-quarter-tabs" role="tablist" aria-label="분기 선택">
        ${quarters.map((q, idx) => `
          <button type="button" class="inst-quarter-btn ${idx === selectedInstitutionQuarterIdx ? "is-active" : ""}" data-qidx="${idx}">
            ${escapeHtml(q.reportLabel || q.reportDate || `분기 ${idx + 1}`)}
          </button>
        `).join("")}
      </div>`
    : "";

  detail.innerHTML = `
    <div class="inst-detail-head">
      <div>
        <h3>${escapeHtml(active.name)}</h3>
        <p>${escapeHtml(active.manager || "")} · ${escapeHtml(current?.reportLabel || current?.reportDate || "-")} · 제출 ${escapeHtml(current?.filedDate || "-")}</p>
      </div>
      <p>상위 ${rows.length}개 · 전분기 대비 수량 변화 · <span class="muted">풋/콜 옵션은 13F에 기초자산명으로 표기됩니다</span></p>
    </div>
    ${quarterTabs}
    <div class="table-wrap">
      <table class="inst-holdings-table table-wide">
        <thead>
          <tr>
            <th>#</th>
            <th>종목</th>
            <th>티커</th>
            <th>보유가치</th>
            <th>비중</th>
            <th>수량</th>
            <th>전분기</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => {
            const pos = holdingPositionMeta(row);
            const ticker = resolveHoldingTicker(row);
            const tickerCell = ticker && stockByTicker(ticker)
              ? `<button type="button" class="ticker-link" data-ticker="${escapeHtml(ticker)}">${escapeHtml(ticker)}</button>`
              : `<span class="muted">-</span>`;
            const delta = holdingQuarterDelta(current, prior, row);
            const posBadge = pos.badge
              ? `<span class="inst-pos-badge ${pos.cls}" title="${escapeHtml(pos.hint)}">${escapeHtml(pos.badge)}</span>`
              : "";
            const posLabel = pos.badge
              ? `<span class="inst-pos-label ${pos.cls}">${escapeHtml(pos.label)}</span>`
              : (row.titleOfClass ? `<span class="muted">(${escapeHtml(row.titleOfClass)})</span>` : "");
            return `
              <tr data-ticker="${escapeHtml(ticker || "")}" class="${pos.cls}">
                <td>${idx + 1}</td>
                <td>${posBadge}${escapeHtml(row.issuer || "")} ${posLabel}</td>
                <td>${tickerCell}</td>
                <td>$${Number(row.valueM || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}M</td>
                <td>${Number(row.weightPct || 0).toFixed(2)}%</td>
                <td>${formatHoldingShares(row)}</td>
                <td><span class="inst-delta ${delta.cls}">${escapeHtml(delta.text)}</span></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  detail.querySelectorAll(".inst-quarter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedInstitutionQuarterIdx = Number(btn.dataset.qidx || 0);
      renderInstitutional13f();
    });
  });
  detail.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectTicker(btn.dataset.ticker, { openSearch: true });
    });
  });
  detail.querySelectorAll("tbody tr[data-ticker]").forEach((row) => {
    if (!row.dataset.ticker) return;
    row.addEventListener("click", () => selectTicker(row.dataset.ticker, { openSearch: true }));
  });
}

function congressTradesData() {
  return window.CONGRESS_TRADES || {};
}

function congressSideBadge(side) {
  if (side === "buy") return `<span class="congress-side buy">매수</span>`;
  if (side === "sell") return `<span class="congress-side sell">매도</span>`;
  return `<span class="congress-side other">${escapeHtml(side || "기타")}</span>`;
}

function setupCongressUi() {
  if (congressUiReady) return;
  const search = byId("congressSearch");
  const select = byId("congressSelect");
  if (search) {
    search.addEventListener("input", () => {
      congressSearchQuery = search.value.trim().toLowerCase();
      renderCongressTrades();
    });
  }
  if (select) {
    select.addEventListener("change", () => {
      selectedPoliticianId = select.value;
      renderCongressTrades();
    });
  }
  congressUiReady = true;
}

function scrollToCongressDetail() {
  const target = byId("congressDetail");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function congressMatrixHelpHtml() {
  return `
    <div class="congress-help-popover" role="dialog" aria-label="상임위원회 크로스 분석 설명">
      <strong>이 기능은 무엇을 보여주나요?</strong>
      <p>미국 의원이 <b>어느 상임위원회에 속해 있는지</b>와, 그 의원들이 <b>실제로 어떤 종목을 매수했는지</b>를 묶어서 보여줍니다.</p>
      <p>카드 상단 업종(Financials · Technology 등)은 위원회가 <b>통상 다루는 정책·산업 분야</b>를 참고용으로 표시한 것입니다.</p>
      <p>아래 티커 칩은 <b>업종과 무관하게</b>, 해당 위원회 소속으로 등록된 의원들의 <b>매수 횟수 상위 종목</b>입니다. 그래서 금융위원회 카드에 MSFT·TSLA 같은 기술주가 나올 수 있습니다.</p>
      <p>매수·매도 숫자는 그 위원회 소속 의원 전체의 누적 거래 건수이며, 데이터에 위원회가 등록된 의원만 집계됩니다.</p>
    </div>
  `;
}

function renderCongressTrades() {
  setupCongressUi();
  const payload = congressTradesData();
  const politicians = Array.isArray(payload.politicians) ? payload.politicians : [];
  const meta = byId("congressMeta");
  const rankings = byId("congressRankings");
  const matrix = byId("congressMatrix");
  const select = byId("congressSelect");
  const detail = byId("congressDetail");
  if (!meta || !detail) return;

  meta.innerHTML = `
    <div class="institutional-meta-grid">
      <article><span>데이터 출처</span><strong>${escapeHtml(payload.source || "Congress PTR")}</strong></article>
      <article><span>갱신 주기</span><strong>매일 06:00 KST (미국 장마감 브리핑)</strong></article>
      <article><span>마지막 빌드</span><strong>${escapeHtml(payload.updatedAtKst || "-")}</strong></article>
    </div>
    <p>${escapeHtml(payload.note || "")}</p>
  `;

  if (!politicians.length) {
    if (rankings) rankings.innerHTML = `<p class="muted">의회 매매 데이터가 없습니다. <code>python scripts/build_congress_trades.py</code> 실행 후 다시 시도하세요.</p>`;
    if (matrix) matrix.innerHTML = "";
    if (select) select.innerHTML = "";
    detail.innerHTML = `<p class="muted">데이터를 불러오지 못했습니다.</p>`;
    return;
  }

  const rankingRows = Array.isArray(payload.rankings) ? payload.rankings : [];
  const rankTotal = rankingRows.length;
  const rankPageCount = Math.max(1, Math.ceil(rankTotal / CONGRESS_RANK_PAGE_SIZE));
  if (congressRankPage >= rankPageCount) congressRankPage = 0;
  const rankStart = congressRankPage * CONGRESS_RANK_PAGE_SIZE;
  const rankPageRows = rankingRows.slice(rankStart, rankStart + CONGRESS_RANK_PAGE_SIZE);
  if (rankings) {
    rankings.innerHTML = `
      <div class="congress-section-head">
        <h3>의원별 추정 수익률 랭킹</h3>
        <p class="congress-section-note">최근 18개월 매수 거래 기준 추정 수익률 · 정당: <b>R</b>=공화당 · <b>D</b>=민주당 · <b>I</b>=무소속</p>
      </div>
      <div class="table-wrap">
        <table class="congress-rank-table table-wide">
          <thead>
            <tr><th>#</th><th>의원</th><th>의회</th><th>정당</th><th>추정 수익률</th><th>매수</th><th>매도</th></tr>
          </thead>
          <tbody>
            ${rankPageRows.length ? rankPageRows.map((row) => `
              <tr data-pol-id="${escapeHtml(row.id || "")}">
                <td>${row.rank}</td>
                <td><button type="button" class="congress-pol-link" data-pol-id="${escapeHtml(row.id || "")}">${escapeHtml(row.name || "")}</button></td>
                <td>${escapeHtml(row.chamber || "")}</td>
                <td>${escapeHtml(row.party || "-")}</td>
                <td class="${cls(row.estReturnPct || 0)}">${row.estReturnPct != null ? fmtPct(row.estReturnPct) : "—"}</td>
                <td>${row.buyCount || 0}</td>
                <td>${row.sellCount || 0}</td>
              </tr>
            `).join("") : `<tr><td colspan="7" class="muted">랭킹 데이터가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${rankTotal > CONGRESS_RANK_PAGE_SIZE ? `
        <nav class="congress-rank-pagination" aria-label="랭킹 페이지">
          <button type="button" class="congress-page-btn" data-rank-page="prev" ${congressRankPage <= 0 ? "disabled" : ""}>이전</button>
          <span class="congress-page-label">${congressRankPage + 1} / ${rankPageCount} · ${rankStart + 1}–${Math.min(rankStart + CONGRESS_RANK_PAGE_SIZE, rankTotal)}위</span>
          <button type="button" class="congress-page-btn" data-rank-page="next" ${congressRankPage >= rankPageCount - 1 ? "disabled" : ""}>다음</button>
        </nav>
      ` : ""}
    `;
    rankings.querySelectorAll(".congress-pol-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPoliticianId = btn.dataset.polId || "";
        if (select) select.value = selectedPoliticianId;
        renderCongressTrades();
        scrollToCongressDetail();
      });
    });
    rankings.querySelectorAll(".congress-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        if (btn.dataset.rankPage === "prev") congressRankPage = Math.max(0, congressRankPage - 1);
        if (btn.dataset.rankPage === "next") congressRankPage = Math.min(rankPageCount - 1, congressRankPage + 1);
        renderCongressTrades();
      });
    });
  }

  const matrixRows = Array.isArray(payload.committeeSectorMatrix) ? payload.committeeSectorMatrix : [];
  if (matrix) {
    matrix.innerHTML = matrixRows.length ? `
      <div class="congress-section-head congress-section-head--help${congressMatrixHelpOpen ? " is-open" : ""}">
        <h3 class="congress-title-row">
          <span>상임위원회 × 업종 크로스 분석</span>
          <button type="button" class="congress-help-button" data-congress-matrix-help aria-expanded="${congressMatrixHelpOpen}" title="기능 설명">!</button>
        </h3>
        ${congressMatrixHelpOpen ? congressMatrixHelpHtml() : ""}
        <p class="congress-section-note">위원회 소속 의원 매수·매도 패턴 요약 (등록된 의원 기준)</p>
      </div>
      <div class="congress-matrix-grid">
        ${matrixRows.slice(0, 12).map((row) => `
          <article class="congress-matrix-card">
            <h4>${escapeHtml(row.committee || "")}</h4>
            <p class="muted">${(row.sectors || []).map((s) => escapeHtml(s)).join(" · ") || "섹터 미지정"}</p>
            <div class="congress-matrix-stats">
              <span>매수 <b>${row.buyCount || 0}</b></span>
              <span>매도 <b>${row.sellCount || 0}</b></span>
            </div>
            <p class="congress-matrix-tickers">${(row.topTickers || []).slice(0, 5).map((t) => `<button type="button" class="congress-ticker-chip" data-ticker="${escapeHtml(t.ticker)}">${escapeHtml(t.ticker)} <span class="muted">×${t.count || 0}</span></button>`).join(" ") || "—"}</p>
            ${(row.topPoliticians || []).length ? `<p class="congress-matrix-pols muted">${(row.topPoliticians || []).slice(0, 3).map((p) => escapeHtml(p.name)).join(" · ")}</p>` : ""}
          </article>
        `).join("")}
      </div>
    ` : `<p class="muted">위원회 매칭 데이터가 아직 없습니다.</p>`;
    matrix.querySelectorAll(".congress-ticker-chip").forEach((btn) => {
      btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
    });
    const helpBtn = matrix.querySelector("[data-congress-matrix-help]");
    if (helpBtn) {
      helpBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        congressMatrixHelpOpen = !congressMatrixHelpOpen;
        renderCongressTrades();
      });
    }
  }

  const filtered = politicians.filter((pol) => {
    if (!congressSearchQuery) return true;
    const hay = `${pol.name} ${pol.chamber} ${pol.party} ${(pol.committees || []).join(" ")}`.toLowerCase();
    return hay.includes(congressSearchQuery);
  });
  const list = filtered.length ? filtered : politicians;
  if (!list.some((pol) => pol.id === selectedPoliticianId)) {
    selectedPoliticianId = list[0].id;
  }
  if (select) {
    select.innerHTML = list.map((pol) => {
      const ret = pol.estReturnPct != null ? ` · ${fmtPct(pol.estReturnPct)}` : "";
      return `<option value="${escapeHtml(pol.id)}">${escapeHtml(pol.name)} (${escapeHtml(pol.chamber)})${ret}</option>`;
    }).join("");
    select.value = selectedPoliticianId;
  }

  const active = list.find((pol) => pol.id === selectedPoliticianId) || list[0];
  const trades = Array.isArray(active.recentTrades) ? active.recentTrades : [];
  detail.innerHTML = `
    <div class="inst-detail-head">
      <div>
        <h3>${escapeHtml(active.name)}</h3>
        <p>${escapeHtml(active.chamber || "")} · ${escapeHtml(active.party || "-")} · ${escapeHtml((active.committees || []).join(", ") || "위원회 정보 없음")}</p>
      </div>
      <p>최근 매매 ${active.tradeCount || 0}건 · 매수 ${active.buyCount || 0} · 매도 ${active.sellCount || 0} · 추정 수익률 ${active.estReturnPct != null ? fmtPct(active.estReturnPct) : "—"}</p>
    </div>
    <div class="table-wrap">
      <table class="congress-trades-table">
        <thead>
          <tr><th>일자</th><th>구분</th><th>티커</th><th>종목</th><th>금액</th><th>소유</th></tr>
        </thead>
        <tbody>
          ${trades.length ? trades.map((t) => `
            <tr>
              <td>${escapeHtml(t.transactionDate || "")}</td>
              <td>${congressSideBadge(t.side)}</td>
              <td>${t.ticker ? `<button type="button" class="ticker-link" data-ticker="${escapeHtml(t.ticker)}">${escapeHtml(t.ticker)}</button>` : "—"}</td>
              <td>${escapeHtml(t.asset || "")}</td>
              <td>${escapeHtml(t.amount || "")}</td>
              <td>${escapeHtml(t.owner || "")}</td>
            </tr>
          `).join("") : `<tr><td colspan="6" class="muted">최근 매매 기록이 없습니다.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  detail.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectTicker(btn.dataset.ticker, { openSearch: true });
    });
  });
}

function renderCongressTradesForTicker(item) {
  const box = byId("stockCongress");
  if (!box) return;
  // 미 의회 거래는 미국 전용 데이터 → KR/ETF에선 숨김.
  if (isKrMarket() || !item || isStockEtf(item)) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  const payload = congressTradesData();
  const cell = (payload.byTicker || {})[item.ticker];
  if (!cell || !(cell.trades || []).length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  const trades = cell.trades.slice(0, 12);
  box.innerHTML = `
    <div class="event-head">
      <div>
        <h3>정치인 매수·매도 현황</h3>
        <p class="muted">미국 의회 PTR 공시 기준 · 매수 ${cell.netBuys || 0} · 매도 ${cell.netSells || 0} · 의원 ${cell.politicianCount || 0}명</p>
      </div>
      <span class="event-badge">${escapeHtml(stockLabel(item))}</span>
    </div>
    <div class="table-wrap compact-table-wrap">
      <table class="compact-table congress-trades-table">
        <thead>
          <tr><th>일자</th><th>의원</th><th>구분</th><th>금액</th></tr>
        </thead>
        <tbody>
          ${trades.map((t) => `
            <tr>
              <td>${escapeHtml(t.transactionDate || "")}</td>
              <td>${escapeHtml(t.politician || "")}</td>
              <td>${congressSideBadge(t.side)}</td>
              <td>${escapeHtml(t.amount || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <p class="muted congress-stock-note">공시 지연으로 실제 거래 시점과 차이가 있을 수 있습니다.</p>
  `;
}
