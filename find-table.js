// find-table.js — 종목 › 찾기 › 상위 종목의 표 보기 · 열 설정 · 칩 필터 줄.
// ====================================================================================
// 클래식 스크립트(모듈 아님). 전역 이름은 ft 접두사. 열 목록·설정 로직은 find-table-core.js.
// 필터·정렬·개수 계산은 그대로 app.js renderTopStocks 가 하고, 끝에서 renderFindTable(rows, metric) 을
// 부른다. 여기서는 같은 결과를 표로 그리고, 카드(기존 #topStocks)와 표 중 무엇을 보일지만 정한다.
//   · 기본 보기 = 표. [표|카드] 토글은 브라우저에 기억(mir.find.view).
//   · 열 설정: 보이는 열 켜기/끄기·순서(시장별로 mir.find.cols.<us|kr>). 값이 없는 칸은 "—".
//   · 칩 줄: #topBucket(지수/그룹)·#topMetric(정렬 지표) 셀렉트를 칩으로 비춘다 — 칩을 누르면 셀렉트 값을
//     바꾸고 change 이벤트를 보내 기존 핸들러가 다시 그린다(셀렉트는 고급 필터 안에 그대로 있다).
//   · 긴 표는 LIST_LIMITS(topStocksTableWrap, 50행 + 더 보기)가 자른다.

const FT_VIEW_KEY = "mir.find.view";
const FT_METRIC_CHIPS = ["changePct", "monthChangePct", "volumeRatio", "amount", "marketCapB", "pe", "rsi14"];
let ftLast = { rows: [], metric: "changePct" };

function ftCore() { return window.MirFindTableCore; }
function ftMarket() { return typeof isKrMarket === "function" && isKrMarket() ? "kr" : "us"; }
function ftGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
function ftSet(k, v) { try { window.localStorage.setItem(k, v); } catch (_) { /* 차단 환경 */ } }

function ftView() { return ftGet(FT_VIEW_KEY) === "card" ? "card" : "table"; }

function ftColumns() {
  const core = ftCore();
  if (!core) return [];
  return core.sanitizeColumns(core.parseSaved(ftGet(`mir.find.cols.${ftMarket()}`)), ftMarket());
}

function ftSaveColumns(list) { ftSet(`mir.find.cols.${ftMarket()}`, JSON.stringify(list)); }

function ftDash(s) { return s == null || s === "" || s === "-" ? "—" : s; }

function ftFund(item) {
  return item.fundamentals || (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(item.ticker) : null) || {};
}

// 한 칸: [표시 HTML, 색 클래스]
function ftCell(item, key) {
  const n = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const f = ftFund(item);
  switch (key) {
    case "price": return [ftDash(priceOrDash(item.price)), ""];
    case "changePct": { const v = n(item.changePct); return v == null ? ["—", ""] : [fmtDailyPct(v), cls(v)]; }
    case "weekChangePct":
    case "monthChangePct":
    case "ytdChangePct": { const v = n(item[key]); return v == null ? ["—", ""] : [fmtPct(v), cls(v)]; }
    case "volume": { const v = n(item.volume); return v == null ? ["—", ""] : [Math.round(v).toLocaleString("ko-KR"), ""]; }
    case "amount": { const v = n(item.amount); return v == null ? ["—", ""] : [formatMetricValue(v, "amount"), ""]; }
    case "volumeRatio": { const v = n(item.volumeRatio); return v == null ? ["—", ""] : [`${v.toFixed(1)}x`, ""]; }
    case "marketCap": return [ftDash(fmtBillions(item.marketCapB)), ""];
    case "pe": case "pb": { const v = n(metricValue(item, key)); return v == null || v <= 0 ? ["—", ""] : [v.toFixed(1), ""]; }
    case "roe": { const v = n(f.roe); return v == null ? ["—", ""] : [`${v.toFixed(1)}%`, ""]; }
    case "divYield": { const v = n(f.divYield); return v == null ? ["—", ""] : [`${v.toFixed(2)}%`, ""]; }
    case "foreignPct": { const v = n(f.foreignPct); return v == null ? ["—", ""] : [`${v.toFixed(1)}%`, ""]; }
    case "rsi14": { const v = typeof rsiValue === "function" ? rsiValue(item) : n(item.rsi14); return v == null ? ["—", ""] : [String(Math.round(v)), ""]; }
    case "epsTtm": { const v = n(item.epsTtm); return v == null ? ["—", ""] : [ftDash(fmtEpsValue(v)), ""]; }
    case "newHigh": { const v = n(item.newHighDistancePct); return v == null ? ["—", ""] : [v <= 0.2 ? "신고가" : `−${v.toFixed(1)}%`, ""]; }
    case "sector": return [escapeHtml([item.sector, item.industry].filter(Boolean).join(" · ") || "—"), "ft-text"];
    default: return ["—", ""];
  }
}

function ftApplyView() {
  const view = ftView();
  const table = byId("topStocksTableWrap");
  const cards = byId("topStocks");
  if (table) table.hidden = view !== "table";
  if (cards) cards.hidden = view !== "card";
  byId("findViewSeg")?.querySelectorAll("[data-fview]").forEach((b) => {
    const on = b.dataset.fview === view;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const colsBtn = byId("findColsBtn");
  if (colsBtn) colsBtn.hidden = view !== "table";
  if (view !== "table") ftClosePanel();
}

function renderFindTable(rows, metric) {
  ftLast = { rows: rows || [], metric: metric || "changePct" };
  ftSyncChips();
  ftApplyView();
  const wrap = byId("topStocksTableWrap");
  const core = ftCore();
  if (!wrap || !core) return;
  const cols = ftColumns().map((k) => core.columnByKey(k)).filter(Boolean);
  if (!ftLast.rows.length) {
    wrap.innerHTML = `<p class="ft-empty muted">조건에 맞는 종목이 없습니다. 고급 필터를 완화해 보세요.</p>`;
    return;
  }
  const dir = typeof metricSortDirection === "function" ? metricSortDirection(ftLast.metric) : 1;
  const head = cols.map((c) => {
    const sorted = c.metric && c.metric === ftLast.metric;
    const arrow = sorted ? (dir < 0 ? " ▲" : " ▼") : "";
    const cl = `${c.num ? "num" : ""}${sorted ? " is-sorted" : ""}`;
    return c.metric
      ? `<th class="${cl}" scope="col" aria-sort="${sorted ? (dir < 0 ? "ascending" : "descending") : "none"}"><button type="button" class="ft-sort" data-metric="${c.metric}" title="${escapeHtml(c.label)} 기준으로 정렬">${escapeHtml(c.label)}${arrow}</button></th>`
      : `<th class="${cl}" scope="col">${escapeHtml(c.label)}</th>`;
  }).join("");
  const body = ftLast.rows.map(({ item }, i) => {
    const cells = cols.map((c) => {
      const [html, cl] = ftCell(item, c.key);
      return `<td class="${c.num ? "num" : ""}${cl ? ` ${cl}` : ""}">${html}</td>`;
    }).join("");
    const sub = typeof stockSubLabel === "function" ? stockSubLabel(item) : "";
    return `<tr data-ticker="${escapeHtml(item.ticker)}" tabindex="0">
      <td class="ft-name"><span class="ft-rank">${i + 1}</span><span class="ft-name-text"><strong>${escapeHtml(stockLabel(item))}</strong>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span></td>
      ${cells}
    </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="compact-table table-wide ft-table">
      <thead><tr><th scope="col" class="ft-name">종목</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

// ----- 칩 줄 -----
function ftChipRow(host, selectId, values, labelFor) {
  const sel = byId(selectId);
  if (!host || !sel) return;
  const opts = [...sel.options].filter((o) => !values || values.includes(o.value));
  const sig = opts.map((o) => `${o.value}:${o.text}`).join("|") + `#${sel.value}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = opts.map((o) => `<button type="button" class="ft-chip${o.value === sel.value ? " is-active" : ""}" data-select="${selectId}" data-value="${escapeHtml(o.value)}" aria-pressed="${o.value === sel.value ? "true" : "false"}">${escapeHtml(labelFor ? labelFor(o) : o.text)}</button>`).join("");
}

const FT_METRIC_SHORT = { changePct: "등락률", monthChangePct: "1개월", volumeRatio: "거래량 배율", amount: "거래대금", marketCapB: "시가총액", pe: "PER", rsi14: "RSI" };

function ftSyncChips() {
  ftChipRow(byId("findChipsBucket"), "topBucket", null, null);
  // 거래대금은 국내 스냅샷에만 있다 — 미국에서 고르면 표가 비므로 칩을 내지 않는다.
  const metrics = FT_METRIC_CHIPS.filter((m) => m !== "amount" || ftMarket() === "kr");
  ftChipRow(byId("findChipsMetric"), "topMetric", metrics, (o) => FT_METRIC_SHORT[o.value] || o.text);
}

function ftSetSelect(selectId, value) {
  const sel = byId(selectId);
  if (!sel || sel.value === value) return;
  if (![...sel.options].some((o) => o.value === value)) return;
  sel.value = value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

// ----- 열 설정 패널 -----
function ftClosePanel() {
  const panel = byId("findColsPanel");
  const btn = byId("findColsBtn");
  if (panel) panel.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function ftRenderPanel() {
  const panel = byId("findColsPanel");
  const core = ftCore();
  if (!panel || !core) return;
  const cur = ftColumns();
  const avail = core.availableColumns(ftMarket());
  const ordered = cur.map((k) => core.columnByKey(k)).concat(avail.filter((c) => !cur.includes(c.key)));
  panel.innerHTML = `
    <div class="ft-cols-head"><strong>표에 보일 열</strong><button type="button" class="ia-link" data-ft-reset>기본값</button></div>
    <ul class="ft-cols-list">
      ${ordered.map((c) => {
        const on = cur.includes(c.key);
        const idx = cur.indexOf(c.key);
        return `<li class="${on ? "is-on" : ""}">
          <label><input type="checkbox" data-ft-col="${c.key}" ${on ? "checked" : ""}> ${escapeHtml(c.label)}</label>
          <span class="ft-cols-move">
            <button type="button" data-ft-move="${c.key}" data-d="-1" aria-label="${escapeHtml(c.label)} 앞으로" ${!on || idx === 0 ? "disabled" : ""}>▲</button>
            <button type="button" data-ft-move="${c.key}" data-d="1" aria-label="${escapeHtml(c.label)} 뒤로" ${!on || idx === cur.length - 1 ? "disabled" : ""}>▼</button>
          </span>
        </li>`;
      }).join("")}
    </ul>
    <p class="ft-cols-note">이 브라우저에 시장별로 저장됩니다. 값이 없는 종목은 "—" 로 표시합니다.</p>`;
}

function ftRerender() { renderFindTable(ftLast.rows, ftLast.metric); }

function setupFindTable() {
  const bar = byId("findTableBar");
  if (!bar || bar.dataset.ftBound) return;
  bar.dataset.ftBound = "1";
  bar.addEventListener("click", (e) => {
    const chip = e.target.closest(".ft-chip");
    if (chip) { ftSetSelect(chip.dataset.select, chip.dataset.value); return; }
    const v = e.target.closest("[data-fview]");
    if (v) { ftSet(FT_VIEW_KEY, v.dataset.fview); ftApplyView(); return; }
    if (e.target.closest("#findColsBtn")) {
      const panel = byId("findColsPanel");
      if (!panel) return;
      const open = panel.hidden;
      if (open) ftRenderPanel();
      panel.hidden = !open;
      e.target.closest("#findColsBtn").setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (e.target.closest("[data-ft-reset]")) {
      ftSaveColumns(ftCore().defaultColumns(ftMarket()));
      ftRenderPanel(); ftRerender();
      return;
    }
    const mv = e.target.closest("[data-ft-move]");
    if (mv) {
      ftSaveColumns(ftCore().moveColumn(ftColumns(), mv.dataset.ftMove, Number(mv.dataset.d)));
      ftRenderPanel(); ftRerender();
      byId("findColsPanel")?.querySelector(`[data-ft-move="${mv.dataset.ftMove}"][data-d="${mv.dataset.d}"]:not([disabled])`)?.focus();
    }
  });
  bar.addEventListener("change", (e) => {
    const box = e.target.closest("[data-ft-col]");
    if (!box) return;
    ftSaveColumns(ftCore().toggleColumn(ftColumns(), box.dataset.ftCol, box.checked, ftMarket()));
    ftRenderPanel(); ftRerender();
    byId("findColsPanel")?.querySelector(`[data-ft-col="${box.dataset.ftCol}"]`)?.focus();
  });
  document.addEventListener("click", (e) => {
    const panel = byId("findColsPanel");
    if (panel && !panel.hidden && !e.target.closest("#findColsPanel, #findColsBtn")) ftClosePanel();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") ftClosePanel(); });

  const wrap = byId("topStocksTableWrap");
  if (wrap) {
    wrap.addEventListener("click", (e) => {
      const sort = e.target.closest(".ft-sort");
      if (sort) { ftSetSelect("topMetric", sort.dataset.metric); return; }
      const tr = e.target.closest("tr[data-ticker]");
      if (tr) selectTicker(tr.dataset.ticker, { openSearch: true });
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const tr = e.target.closest("tr[data-ticker]");
      if (tr) selectTicker(tr.dataset.ticker, { openSearch: true });
    });
  }
  ftApplyView();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupFindTable);
else setupFindTable();
