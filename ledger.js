// ledger.js — 내 투자 › 보유 › 거래 기록(거래 원장 1단계: 매수·매도·분할 입력, 실현손익)
// ====================================================================================
// 클래식 스크립트(전역 공유). 계산은 ledger-core.js(window.MirLedgerCore). 설계: mir_design/2026-10-23_거래원장_설계.md
// - 저장: 시장별 키 mir_ledger_v1:us / :kr — 이 브라우저에만 저장한다(클라우드 동기화 대상 아님, 1단계).
// - 원장에 거래가 있는 종목은 보유 수량·평단을 원장으로 계산해 `portfolio` 에 써 넣는다(portfolio.js
//   loadPortfolio/savePortfolio 가 MirLedger.reconcile 을 부른다). 원장이 없는 종목은 예전 그대로다.
// - 처음 거래를 넣는 종목에 이미 보유가 있으면 그 수량·평단을 '시작 잔고'(날짜 모름)로 먼저 옮긴다.
// 이름은 ledger* 로 전역 충돌을 피한다.

const LEDGER_KEY_PREFIX = "mir_ledger_v1";
let ledgerEditId = "";       // 폼에서 고치는 중인 거래 id
let ledgerFormOpen = false;
let ledgerShowAll = false;
const LEDGER_LIST_LIMIT = 30;

function ledgerMarket() { return isKrMarket() ? "kr" : "us"; }
function ledgerKey(market) { return `${LEDGER_KEY_PREFIX}:${market || ledgerMarket()}`; }

function ledgerLoad(market) {
  try {
    const raw = window.safeStorage.getJSON(ledgerKey(market), null);
    const rows = raw && Array.isArray(raw.txs) ? raw.txs : (Array.isArray(raw) ? raw : []);
    const core = window.MirLedgerCore;
    return core ? rows.map((r) => core.normalizeTx(r, market || ledgerMarket())) : [];
  } catch (_) { return []; }
}

function ledgerSave(txs, market) {
  try {
    const list = Array.isArray(txs) ? txs : [];
    if (!list.length) { window.safeStorage.remove(ledgerKey(market)); return true; }
    return window.safeStorage.setJSON(ledgerKey(market), { v: 1, txs: list });
  } catch (_) { return false; }
}

function ledgerResult(txs) {
  const core = window.MirLedgerCore;
  return core ? core.applyLedger(txs || ledgerLoad()) : { positions: {}, sales: [], errors: [], byYear: {}, fees: [], dividends: [] };
}

function ledgerTickers(market) {
  return new Set(ledgerLoad(market).map((t) => t.ticker));
}

// 보유 목록(현재 시장)을 원장 결과로 맞춘다. 원장이 비어 있으면 그대로 돌려준다.
function ledgerReconcile(list, market) {
  const core = window.MirLedgerCore;
  const txs = ledgerLoad(market);
  if (!core || !txs.length) return { next: list, changed: false };
  return core.reconcileHoldings(list, core.applyLedger(txs));
}

// 원장을 바꾼 뒤 보유를 다시 계산·저장하고 화면을 다시 그린다.
function ledgerCommit(txs, opts = {}) {
  if (!ledgerSave(txs)) { showAppToast("저장하지 못했습니다(브라우저 저장소 차단)."); return false; }
  if (opts.dropTicker) portfolio = portfolio.filter((p) => p.ticker !== opts.dropTicker);
  savePortfolio();          // 안에서 ledgerReconcile 이 원장 종목을 덮는다
  renderPortfolio();
  return true;
}

function ledgerTodayIso() {
  return typeof kstDaysAgo === "function" ? kstDaysAgo(0) : new Date().toISOString().slice(0, 10);
}

function ledgerFmtMoney(v) { return marketCfg().formatMoney(v); }
function ledgerFmtDelta(v) { return `${v >= 0 ? "+" : "-"}${ledgerFmtMoney(Math.abs(v))}`; }
function ledgerFmtQty(v) { return Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 }); }

function ledgerErrText(errors) {
  const e = errors && errors[0];
  if (!e) return "저장하지 못했습니다.";
  const who = e.ticker ? `${stockLabel(e.ticker)} ` : "";
  return `${who}${e.date ? `${e.date} ` : ""}${e.message}`;
}

function ledgerReadForm(host) {
  const v = (sel) => host.querySelector(sel)?.value ?? "";
  const type = v("[data-lg-type]") || "buy";
  const rawTicker = String(v("[data-lg-ticker]")).trim();
  const ticker = (typeof resolveCommunityTickerInput === "function" && resolveCommunityTickerInput(rawTicker)) || rawTicker.toUpperCase();
  const base = { type, ticker, date: v("[data-lg-date]"), fee: v("[data-lg-fee]"), fx: v("[data-lg-fx]") };
  if (type === "split") return { ...base, ratio: v("[data-lg-qty]"), qty: 0, price: 0, fee: 0 };
  return { ...base, qty: v("[data-lg-qty]"), price: v("[data-lg-price]") };
}

function ledgerSubmit(host) {
  const core = window.MirLedgerCore;
  if (!core) return;
  const market = ledgerMarket();
  const raw = ledgerReadForm(host);
  if (!raw.ticker) { showAppToast("종목을 입력해 주세요."); return; }
  if (!stockByTicker(raw.ticker)) { showAppToast(`'${raw.ticker}' 종목을 찾지 못했습니다.`); return; }
  let txs = ledgerLoad(market);
  const prev = ledgerEditId ? txs.find((t) => t.id === ledgerEditId) : null;
  const tx = core.normalizeTx({ ...raw, id: prev ? prev.id : undefined, createdAt: prev?.createdAt || Date.now(), note: prev?.note || "" }, market);
  if (prev && prev.type === "open") { tx.type = "open"; tx.note = prev.note; }
  const ownErr = core.validateTx(tx);
  if (ownErr.length) { showAppToast(ownErr[0]); return; }
  // 기존 보유 이전: 이 종목의 첫 거래이고 보유가 있으면 그 수량·평단을 시작 잔고로 먼저 넣는다.
  let opened = null;
  if (!prev && !txs.some((t) => t.ticker === tx.ticker)) {
    const holding = portfolio.find((p) => p.ticker === tx.ticker);
    opened = holding ? core.openingFromHolding(holding, market) : null;
    if (opened) txs = [opened, ...txs];
  }
  const res = core.tryChange(txs, { upsert: tx });
  if (!res.ok) { showAppToast(ledgerErrText(res.errors), 3200); return; }
  if (!ledgerCommit(res.txs)) return;
  ledgerEditId = "";
  ledgerFormOpen = false;
  const label = core.TYPE_LABEL[tx.type] || tx.type;
  showAppToast(opened
    ? `기존 보유 ${ledgerFmtQty(opened.qty)}주(평단 ${marketCfg().formatPrice(opened.price)})를 시작 잔고로 옮기고 ${label}를 기록했습니다.`
    : `${stockLabel(tx.ticker)} ${label} ${prev ? "수정" : "기록"}했습니다.`, 3200);
}

function ledgerDelete(id) {
  const core = window.MirLedgerCore;
  const txs = ledgerLoad();
  const tx = txs.find((t) => t.id === id);
  if (!core || !tx) return;
  const res = core.tryChange(txs, { remove: id });
  if (!res.ok) { showAppToast(`지우면 뒤 거래가 맞지 않습니다 — ${ledgerErrText(res.errors)}`, 3600); return; }
  // 이 종목의 마지막 거래를 지우면: 시작 잔고였으면 보유는 그 값으로 남고, 아니면 원장으로 생긴 보유를 뺀다.
  const left = res.txs.some((t) => t.ticker === tx.ticker);
  ledgerCommit(res.txs, { dropTicker: !left && tx.type !== "open" ? tx.ticker : "" });
  if (ledgerEditId === id) { ledgerEditId = ""; ledgerFormOpen = false; }
  showAppToast("거래를 삭제했습니다.");
}

// 보유 행 '이 종목 삭제'·전체 삭제가 부른다 — 그 종목(또는 시장 전체)의 거래도 함께 지운다.
function ledgerRemoveTicker(ticker) {
  const txs = ledgerLoad();
  const next = txs.filter((t) => t.ticker !== ticker);
  if (next.length !== txs.length) ledgerSave(next);
  return txs.length - next.length;
}
function ledgerClearMarket() {
  const n = ledgerLoad().length;
  if (n) ledgerSave([]);
  return n;
}

function ledgerExport() {
  const core = window.MirLedgerCore;
  const txs = ledgerLoad();
  if (!core || !txs.length) { showAppToast("내보낼 거래가 없습니다."); return; }
  const blob = new Blob([core.exportJson(txs, ledgerMarket(), ledgerTodayIso())], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mir-ledger-${ledgerMarket()}-${ledgerTodayIso()}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function ledgerImportText(text) {
  const core = window.MirLedgerCore;
  if (!core) return;
  const parsed = core.parseImport(text, ledgerMarket());
  if (!parsed.ok) { showAppToast(parsed.error, 3200); return; }
  if (!parsed.txs.length) { showAppToast("가져올 거래가 없습니다."); return; }
  const merged = core.mergeImport(ledgerLoad(), parsed.txs);
  if (!merged.ok) { showAppToast(`가져오지 않았습니다 — ${ledgerErrText(merged.errors)}`, 3600); return; }
  if (!ledgerCommit(merged.txs)) return;
  showAppToast(`거래 가져오기 — 추가 ${merged.added} · 교체 ${merged.replaced}${parsed.skipped ? ` · 건너뜀 ${parsed.skipped}` : ""}`, 3200);
}

function ledgerFormHtml(tx) {
  const isUs = ledgerMarket() === "us";
  const t = tx || { type: "buy", ticker: "", date: ledgerTodayIso(), qty: "", price: "", fee: "" };
  const isOpen = t.type === "open";
  const isSplit = t.type === "split";
  const opt = (v, label) => `<option value="${v}"${t.type === v ? " selected" : ""}>${label}</option>`;
  const holdOpts = portfolio.map((p) => `<option value="${escapeHtml(p.ticker)}">${escapeHtml(stockLabel(p.ticker))}</option>`).join("");
  const val = (x) => (x === 0 && !tx) || x === "" || x === undefined || x === null ? "" : escapeHtml(String(x));
  return `<div class="lg-form" data-lg-form>
    <label>구분<select data-lg-type${isOpen ? " disabled" : ""}>${isOpen ? opt("open", "시작 잔고") : `${opt("buy", "매수")}${opt("sell", "매도")}${opt("split", "분할")}`}</select></label>
    <label>종목<input data-lg-ticker list="ledgerTickerList" value="${val(t.ticker)}" placeholder="티커·종목명" autocomplete="off"${tx ? " readonly" : ""}></label>
    <datalist id="ledgerTickerList">${holdOpts}</datalist>
    <label>날짜<input data-lg-date type="date" value="${val(t.date)}"${isOpen ? ' placeholder="모름"' : ""}></label>
    <label data-lg-qty-label>${isSplit ? "비율(1주→)" : "수량"}<input data-lg-qty type="number" min="0" step="any" value="${val(isSplit ? t.ratio : t.qty)}"></label>
    <label data-lg-price-wrap${isSplit ? " hidden" : ""}>가격<input data-lg-price type="number" min="0" step="any" value="${val(t.price)}"></label>
    <label data-lg-fee-wrap${isSplit ? " hidden" : ""}>수수료·세금<input data-lg-fee type="number" min="0" step="any" value="${val((Number(t.fee) || 0) + (Number(t.tax) || 0) || "")}"></label>
    ${isUs ? `<label data-lg-fx-wrap${isSplit ? " hidden" : ""}>환율(선택)<input data-lg-fx type="number" min="0" step="any" value="${val(t.fx)}" placeholder="원/달러"></label>` : ""}
    <button type="button" class="primary compact-btn" data-lg-save>${tx ? "수정" : "기록"}</button>
    <button type="button" class="ghost compact-btn" data-lg-cancel>닫기</button>
  </div>`;
}

function renderLedger() {
  const host = byId("ledgerCard");
  const core = window.MirLedgerCore;
  if (!host || !core) return;
  const market = ledgerMarket();
  const txs = ledgerLoad(market);
  const res = core.applyLedger(txs);
  const year = ledgerTodayIso().slice(0, 4);
  const sum = core.realizedSummary(res, year);
  const cur = core.currencyOf(market);
  const saleById = new Map(res.sales.map((s) => [s.id, s]));
  const errIds = new Set(res.errors.map((e) => e.id));

  const stat = (label, v, sub) => `<div class="pf-stat"><span>${label}</span><strong class="${cls(v)}">${ledgerFmtDelta(v)}</strong>${sub ? `<small class="muted">${sub}</small>` : ""}</div>`;
  const krw = (v) => (v === null || v === undefined || typeof fmtKrw !== "function") ? "" : `원화 ${v >= 0 ? "+" : "-"}${fmtKrw(Math.abs(v))}`;
  const summary = res.sales.length || res.fees.length
    ? `<div class="pf-summary lg-summary">${stat(`${year}년 실현손익`, sum.thisYear[cur] || 0, [`매도 ${sum.saleCountYear}건`, market === "us" ? krw(sum.krwYear) : ""].filter(Boolean).join(" · "))}${stat("누적 실현손익", sum.allTime[cur] || 0, [`매도 ${sum.saleCount}건`, market === "us" ? krw(sum.krwAll) : ""].filter(Boolean).join(" · "))}</div>`
    : "";

  const sorted = core.sortTxs(txs).slice().reverse();
  const shown = ledgerShowAll ? sorted : sorted.slice(0, LEDGER_LIST_LIMIT);
  const rows = shown.map((t) => {
    const s = saleById.get(t.id);
    const typeLabel = core.TYPE_LABEL[t.type] || t.type;
    const qtyCell = t.type === "split" ? `×${ledgerFmtQty(t.ratio)}` : ledgerFmtQty(t.qty);
    const priceCell = t.type === "split" ? "" : marketCfg().formatPrice(t.price);
    const feeAmt = (Number(t.fee) || 0) + (Number(t.tax) || 0);
    return `<tr class="${errIds.has(t.id) ? "lg-err" : ""}${ledgerEditId === t.id ? " is-editing" : ""}">
      <td class="lg-date">${t.date ? escapeHtml(t.date) : '<span class="muted">이전</span>'}</td>
      <th scope="row"><button type="button" class="pf-name ins-ticker" data-ticker="${escapeHtml(t.ticker)}"><b>${escapeHtml(stockLabel(t.ticker))}</b></button></th>
      <td><span class="lg-type lg-type-${escapeHtml(String(t.type))}">${escapeHtml(typeLabel)}</span></td>
      <td class="ins-num">${qtyCell}</td>
      <td class="ins-num">${priceCell}</td>
      <td class="ins-num lg-col-fee">${feeAmt ? ledgerFmtMoney(feeAmt) : ""}</td>
      <td class="ins-num">${s ? `<b class="${cls(s.pnl)}">${ledgerFmtDelta(s.pnl)}</b>${s.pnlPct !== null ? `<small class="${cls(s.pnl)}">${fmtPct(s.pnlPct)}</small>` : ""}` : (errIds.has(t.id) ? '<small class="neg">적용 안 됨</small>' : "")}</td>
      <td class="ins-num lg-acts"><button type="button" class="ghost compact-btn" data-lg-edit="${escapeHtml(t.id)}">편집</button><button type="button" class="ghost compact-btn lg-del" data-lg-del="${escapeHtml(t.id)}" aria-label="삭제" title="삭제">✕</button></td>
    </tr>`;
  }).join("");
  const editing = ledgerEditId ? txs.find((t) => t.id === ledgerEditId) : null;
  const list = txs.length
    ? `<div class="lg-table-wrap"><table class="insider-table pf-table lg-table"><thead><tr><th>날짜</th><th>종목</th><th>구분</th><th class="ins-num">수량</th><th class="ins-num">가격</th><th class="ins-num lg-col-fee">수수료</th><th class="ins-num">실현손익</th><th><span class="sr-only">편집</span></th></tr></thead><tbody>${rows}</tbody></table></div>
       ${sorted.length > LEDGER_LIST_LIMIT ? `<button type="button" class="ghost compact-btn" data-lg-more>${ledgerShowAll ? "최근 것만" : `전체 ${sorted.length}건 보기`}</button>` : ""}
       ${res.errors.length ? `<p class="neg font-small">적용하지 못한 거래 ${res.errors.length}건 — ${escapeHtml(ledgerErrText(res.errors))}</p>` : ""}`
    : `<p class="muted font-small">매수·매도를 기록하면 실현손익이 계산됩니다. 기록한 종목의 보유 수량·평단은 거래 기록으로 계산됩니다.</p>`;

  // 보유 화면은 데이터가 도착할 때마다 다시 그려진다 — 입력 중인 폼 값을 잃지 않게 옮겨 담는다.
  const FIELDS = ["type", "ticker", "date", "qty", "price", "fee", "fx"];
  const oldForm = host.querySelector("[data-lg-form]");
  const draft = oldForm && oldForm.dataset.editId === (ledgerEditId || "")
    ? Object.fromEntries(FIELDS.map((k) => [k, oldForm.querySelector(`[data-lg-${k}]`)?.value]))
    : null;
  const focusKey = oldForm && document.activeElement && oldForm.contains(document.activeElement)
    ? FIELDS.find((k) => document.activeElement.hasAttribute(`data-lg-${k}`)) : "";
  host.hidden = false;
  host.innerHTML = `<div class="pf-head">
      <h3>거래 기록</h3>
      <div class="pf-actions">
        <button type="button" class="primary compact-btn" data-lg-add aria-expanded="${ledgerFormOpen}">${ledgerFormOpen && !editing ? "입력 닫기" : "+ 거래 추가"}</button>
        <details class="pf-more lg-more">
          <summary class="ghost compact-btn" aria-label="거래 기록 더보기 메뉴" title="더보기">⋯</summary>
          <div class="pf-more-menu" role="menu">
            <button type="button" role="menuitem" data-lg-export>백업 내보내기(JSON)</button>
            <button type="button" role="menuitem" data-lg-import>백업 가져오기</button>
          </div>
        </details>
        <input type="file" data-lg-file accept=".json,application/json" hidden>
      </div>
    </div>
    ${ledgerFormOpen ? ledgerFormHtml(editing) : ""}
    ${summary}
    ${list}`;
  const form = host.querySelector("[data-lg-form]");
  if (form) {
    form.dataset.editId = ledgerEditId || "";
    if (draft) {
      FIELDS.forEach((k) => { const el = form.querySelector(`[data-lg-${k}]`); if (el && draft[k] !== undefined && !el.disabled) el.value = draft[k]; });
      if (focusKey) form.querySelector(`[data-lg-${focusKey}]`)?.focus();
    }
  }
  ledgerBind(host);
  if (form && draft) form.querySelector("[data-lg-type]")?.dispatchEvent(new Event("change"));
}

function ledgerBind(host) {
  host.querySelector("[data-lg-add]")?.addEventListener("click", () => {
    if (ledgerFormOpen && !ledgerEditId) ledgerFormOpen = false;
    else { ledgerFormOpen = true; ledgerEditId = ""; }
    renderLedger();
    host.querySelector("[data-lg-ticker]")?.focus();
  });
  host.querySelector("[data-lg-cancel]")?.addEventListener("click", () => { ledgerFormOpen = false; ledgerEditId = ""; renderLedger(); });
  host.querySelector("[data-lg-save]")?.addEventListener("click", () => ledgerSubmit(host));
  host.querySelectorAll("[data-lg-form] input").forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") ledgerSubmit(host); }));
  host.querySelector("[data-lg-type]")?.addEventListener("change", (e) => {
    const split = e.target.value === "split";
    const lab = host.querySelector("[data-lg-qty-label]");
    if (lab && lab.firstChild) lab.firstChild.nodeValue = split ? "비율(1주→)" : "수량";
    ["[data-lg-price-wrap]", "[data-lg-fee-wrap]", "[data-lg-fx-wrap]"].forEach((s) => { const el = host.querySelector(s); if (el) el.hidden = split; });
  });
  host.querySelectorAll("[data-lg-edit]").forEach((b) => b.addEventListener("click", () => {
    ledgerEditId = ledgerEditId === b.dataset.lgEdit ? "" : b.dataset.lgEdit;
    ledgerFormOpen = !!ledgerEditId;
    renderLedger();
    host.querySelector("[data-lg-qty]")?.focus();
  }));
  host.querySelectorAll("[data-lg-del]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1"; b.textContent = "삭제?"; b.classList.add("is-armed");
      setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "✕"; b.classList.remove("is-armed"); } }, 3000);
      return;
    }
    ledgerDelete(b.dataset.lgDel);
  }));
  host.querySelector("[data-lg-more]")?.addEventListener("click", () => { ledgerShowAll = !ledgerShowAll; renderLedger(); });
  host.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
  const more = host.querySelector(".lg-more");
  host.querySelector("[data-lg-export]")?.addEventListener("click", () => { if (more) more.open = false; ledgerExport(); });
  const file = host.querySelector("[data-lg-file]");
  host.querySelector("[data-lg-import]")?.addEventListener("click", () => { if (more) more.open = false; file?.click(); });
  file?.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { showAppToast("파일이 너무 큽니다(2MB 이하)."); return; }
    f.text().then(ledgerImportText).catch(() => showAppToast("파일을 읽지 못했습니다."));
  });
}

window.MirLedger = {
  reconcile: ledgerReconcile,
  tickers: ledgerTickers,
  removeTicker: ledgerRemoveTicker,
  clearMarket: ledgerClearMarket,
  render: renderLedger,
};
