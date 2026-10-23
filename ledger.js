// ledger.js — 내 투자 › 보유 › 거래 기록(거래 원장: 매수·매도·분할·배당 입력, 실현손익, 기간 수익률, 상세 이벤트 제안)
// ====================================================================================
// 클래식 스크립트(전역 공유). 계산은 ledger-core.js(window.MirLedgerCore). 설계: mir_design/2026-10-23_거래원장_설계.md
// - 저장: 시장별 키 mir_ledger_v1:us / :kr — 이 브라우저에만 저장한다(클라우드 동기화 대상 아님, 1단계).
// - 원장에 거래가 있는 종목은 보유 수량·평단을 원장으로 계산해 `portfolio` 에 써 넣는다(portfolio.js
//   loadPortfolio/savePortfolio 가 MirLedger.reconcile 을 부른다). 원장이 없는 종목은 예전 그대로다.
// - 처음 거래를 넣는 종목에 이미 보유가 있으면 그 수량·평단을 '시작 잔고'(날짜 모름)로 먼저 옮긴다.
// - 2단계: 원장 종목만 상세 파일(일봉·배당·분할)을 지연 로드해 TWR·XIRR(ledger-perf-core.js)을 내고,
//   상세 배당·분할 이벤트로 '받았을 배당(추정)'·분할 기록을 제안한다 — 사용자가 확인(폼에서 기록)해야만 원장에 들어간다.
// 이름은 ledger* 로 전역 충돌을 피한다.

const LEDGER_KEY_PREFIX = "mir_ledger_v1";
let ledgerEditId = "";       // 폼에서 고치는 중인 거래 id
let ledgerFormOpen = false;
let ledgerShowAll = false;
let ledgerPrefill = null;    // 제안에서 연 폼의 초기값 { type, ticker, date, price, ratio, exDate, from }
let ledgerSuggShowAll = false;
const LEDGER_LIST_LIMIT = 30;
const LEDGER_SUGG_LIMIT = 5;
const LEDGER_DISMISS_PREFIX = "mir_ledger_dismiss_v1";
// 상세 파일에서 뽑은 것만 둔다(전체 상세는 app.js detailCache). key = 시장|티커
const ledgerDetails = new Map();
let ledgerDetailTimer = 0;

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
  if (type === "dividend") {
    const exDate = ledgerPrefill && ledgerPrefill.type === "dividend" && ledgerPrefill.ticker === ticker ? ledgerPrefill.exDate : undefined;
    return { ...base, qty: 0, price: v("[data-lg-price]"), tax: v("[data-lg-tax]"), fee: 0, exDate };
  }
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
  const tx = core.normalizeTx({ ...raw, exDate: raw.exDate || prev?.exDate, id: prev ? prev.id : undefined, createdAt: prev?.createdAt || Date.now(), note: prev?.note || "" }, market);
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
  // 저장하면 폼을 닫는다 — ledgerCommit 안에서 보유 화면이 다시 그려지므로 그 전에 상태를 바꾼다(실패하면 되돌림).
  const keep = { editId: ledgerEditId, open: ledgerFormOpen, prefill: ledgerPrefill };
  ledgerEditId = "";
  ledgerFormOpen = false;
  ledgerPrefill = null;
  if (!ledgerCommit(res.txs)) { ledgerEditId = keep.editId; ledgerFormOpen = keep.open; ledgerPrefill = keep.prefill; return; }
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
  if (ledgerEditId === id) { ledgerEditId = ""; ledgerFormOpen = false; }
  ledgerCommit(res.txs, { dropTicker: !left && tx.type !== "open" ? tx.ticker : "" });
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
  const pre = !tx && ledgerPrefill ? ledgerPrefill : null;
  const t = tx || (pre ? { qty: "", fee: "", tax: "", ...pre } : { type: "buy", ticker: "", date: ledgerTodayIso(), qty: "", price: "", fee: "" });
  const isOpen = t.type === "open";
  const isSplit = t.type === "split";
  const isDiv = t.type === "dividend";
  const opt = (v, label) => `<option value="${v}"${t.type === v ? " selected" : ""}>${label}</option>`;
  const preNote = pre ? `<p class="lg-pre-note">${pre.type === "dividend"
    ? `받았을 배당(추정) — 배당락 ${escapeHtml(pre.exDate || "")} · ${ledgerFmtQty(pre.qty)}주 기준. 실제 입금일·금액·원천징수로 고친 뒤 기록하세요.`
    : "상세 데이터의 분할 — 날짜·비율을 확인한 뒤 기록하세요."}</p>` : "";
  const holdOpts = portfolio.map((p) => `<option value="${escapeHtml(p.ticker)}">${escapeHtml(stockLabel(p.ticker))}</option>`).join("");
  const val = (x) => (x === 0 && !tx) || x === "" || x === undefined || x === null ? "" : escapeHtml(String(x));
  return `<div class="lg-form" data-lg-form>
    ${preNote}
    <label>구분<select data-lg-type${isOpen ? " disabled" : ""}>${isOpen ? opt("open", "시작 잔고") : `${opt("buy", "매수")}${opt("sell", "매도")}${opt("split", "분할")}${opt("dividend", "배당")}`}</select></label>
    <label>종목<input data-lg-ticker list="ledgerTickerList" value="${val(t.ticker)}" placeholder="티커·종목명" autocomplete="off"${tx || pre ? " readonly" : ""}></label>
    <datalist id="ledgerTickerList">${holdOpts}</datalist>
    <label>${isDiv ? "입금일" : "날짜"}<input data-lg-date type="date" value="${val(t.date)}"${isOpen ? ' placeholder="모름"' : ""}></label>
    <label data-lg-qty-label${isDiv ? " hidden" : ""}>${isSplit ? "비율(1주→)" : "수량"}<input data-lg-qty type="number" min="0" step="any" value="${val(isSplit ? t.ratio : t.qty)}"></label>
    <label data-lg-price-wrap${isSplit ? " hidden" : ""}><span data-lg-price-label>${isDiv ? "금액(세전)" : "가격"}</span><input data-lg-price type="number" min="0" step="any" value="${val(isDiv && pre ? Math.round(Number(t.price) * 100) / 100 : t.price)}"></label>
    <label data-lg-fee-wrap${isSplit || isDiv ? " hidden" : ""}>수수료·세금<input data-lg-fee type="number" min="0" step="any" value="${val((Number(t.fee) || 0) + (Number(t.tax) || 0) || "")}"></label>
    <label data-lg-tax-wrap${isDiv ? "" : " hidden"}>원천징수<input data-lg-tax type="number" min="0" step="any" value="${val(isDiv ? (Number(t.tax) || 0) + (Number(t.fee) || 0) || "" : "")}"></label>
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
  const perfCore = window.MirLedgerPerfCore;
  const divYear = perfCore ? perfCore.dividendTotals(txs, year) : null;
  const divAll = perfCore ? perfCore.dividendTotals(txs, "") : null;
  const divStat = divAll && divAll.count
    ? `<div class="pf-stat"><span>${year}년 받은 배당</span><strong class="${cls(divYear.net)}">${divYear.net ? ledgerFmtDelta(divYear.net) : ledgerFmtMoney(0)}</strong><small class="muted">${[`세전 ${ledgerFmtMoney(divYear.gross)}`, divYear.tax ? `원천징수 ${ledgerFmtMoney(divYear.tax)}` : "", `${divYear.count}건 · 누적 ${ledgerFmtMoney(divAll.net)}`].filter(Boolean).join(" · ")}</small></div>`
    : "";
  const summary = res.sales.length || res.fees.length || divStat
    ? `<div class="pf-summary lg-summary">${res.sales.length || res.fees.length ? `${stat(`${year}년 실현손익`, sum.thisYear[cur] || 0, [`매도 ${sum.saleCountYear}건`, market === "us" ? krw(sum.krwYear) : ""].filter(Boolean).join(" · "))}${stat("누적 실현손익", sum.allTime[cur] || 0, [`매도 ${sum.saleCount}건`, market === "us" ? krw(sum.krwAll) : ""].filter(Boolean).join(" · "))}` : ""}${divStat}</div>`
    : "";
  const perf = ledgerPerfHtml(txs, res, market);
  const sugg = ledgerSuggestHtml(txs, market);

  const sorted = core.sortTxs(txs).slice().reverse();
  const shown = ledgerShowAll ? sorted : sorted.slice(0, LEDGER_LIST_LIMIT);
  const rows = shown.map((t) => {
    const s = saleById.get(t.id);
    const typeLabel = core.TYPE_LABEL[t.type] || t.type;
    const isDiv = t.type === "dividend";
    const qtyCell = t.type === "split" ? `×${ledgerFmtQty(t.ratio)}` : isDiv ? (t.qty > 0 ? ledgerFmtQty(t.qty) : "") : ledgerFmtQty(t.qty);
    const priceCell = t.type === "split" ? "" : isDiv ? ledgerFmtMoney(t.qty > 0 ? t.qty * t.price : t.price) : marketCfg().formatPrice(t.price);
    const feeAmt = (Number(t.fee) || 0) + (Number(t.tax) || 0);
    const divNet = isDiv ? (t.qty > 0 ? t.qty * t.price : t.price) - feeAmt : 0;
    return `<tr class="${errIds.has(t.id) ? "lg-err" : ""}${ledgerEditId === t.id ? " is-editing" : ""}">
      <td class="lg-date">${t.date ? escapeHtml(t.date) : '<span class="muted">이전</span>'}</td>
      <th scope="row"><button type="button" class="pf-name ins-ticker" data-ticker="${escapeHtml(t.ticker)}"><b>${escapeHtml(stockLabel(t.ticker))}</b></button></th>
      <td><span class="lg-type lg-type-${escapeHtml(String(t.type))}">${escapeHtml(typeLabel)}</span></td>
      <td class="ins-num">${qtyCell}</td>
      <td class="ins-num">${priceCell}</td>
      <td class="ins-num lg-col-fee">${feeAmt ? ledgerFmtMoney(feeAmt) : ""}</td>
      <td class="ins-num">${isDiv && !errIds.has(t.id) ? `<small class="${cls(divNet)}">배당 ${ledgerFmtDelta(divNet)}</small>` : s ? `<b class="${cls(s.pnl)}">${ledgerFmtDelta(s.pnl)}</b>${s.pnlPct !== null ? `<small class="${cls(s.pnl)}">${fmtPct(s.pnlPct)}</small>` : ""}` : (errIds.has(t.id) ? '<small class="neg">적용 안 됨</small>' : "")}</td>
      <td class="ins-num lg-acts"><button type="button" class="ghost compact-btn" data-lg-edit="${escapeHtml(t.id)}">편집</button><button type="button" class="ghost compact-btn lg-del" data-lg-del="${escapeHtml(t.id)}" aria-label="삭제" title="삭제">✕</button></td>
    </tr>`;
  }).join("");
  const editing = ledgerEditId ? txs.find((t) => t.id === ledgerEditId) : null;
  const list = txs.length
    ? `<div class="lg-table-wrap"><table class="insider-table pf-table lg-table"><thead><tr><th>날짜</th><th>종목</th><th>구분</th><th class="ins-num">수량</th><th class="ins-num">가격</th><th class="ins-num lg-col-fee">수수료</th><th class="ins-num">실현손익</th><th><span class="sr-only">편집</span></th></tr></thead><tbody>${rows}</tbody></table></div>
       ${sorted.length > LEDGER_LIST_LIMIT ? `<button type="button" class="ghost compact-btn" data-lg-more>${ledgerShowAll ? "최근 것만" : `전체 ${sorted.length}건 보기`}</button>` : ""}
       ${res.errors.length ? `<p class="neg font-small">적용하지 못한 거래 ${res.errors.length}건 — ${escapeHtml(ledgerErrText(res.errors))}</p>` : ""}`
    : `<p class="muted font-small">매수·매도를 기록하면 실현손익·기간 수익률이 계산됩니다. 기록한 종목의 보유 수량·평단은 거래 기록으로 계산됩니다.</p>`;

  // 보유 화면은 데이터가 도착할 때마다 다시 그려진다 — 입력 중인 폼 값을 잃지 않게 옮겨 담는다.
  const FIELDS = ["type", "ticker", "date", "qty", "price", "fee", "tax", "fx"];
  const oldForm = host.querySelector("[data-lg-form]");
  const formKey = ledgerEditId || (ledgerPrefill ? `pre:${ledgerPrefill.key || ""}` : "");
  const draft = oldForm && oldForm.dataset.editId === formKey
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
    ${perf}
    ${sugg}
    ${list}`;
  const form = host.querySelector("[data-lg-form]");
  if (form) {
    form.dataset.editId = formKey;
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
    ledgerPrefill = null;
    renderLedger();
    host.querySelector("[data-lg-ticker]")?.focus();
  });
  host.querySelector("[data-lg-cancel]")?.addEventListener("click", () => { ledgerFormOpen = false; ledgerEditId = ""; ledgerPrefill = null; renderLedger(); });
  host.querySelector("[data-lg-save]")?.addEventListener("click", () => ledgerSubmit(host));
  host.querySelectorAll("[data-lg-form] input").forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") ledgerSubmit(host); }));
  host.querySelector("[data-lg-type]")?.addEventListener("change", (e) => {
    const split = e.target.value === "split";
    const div = e.target.value === "dividend";
    const lab = host.querySelector("[data-lg-qty-label]");
    if (lab && lab.firstChild) lab.firstChild.nodeValue = split ? "비율(1주→)" : "수량";
    if (lab) lab.hidden = div;
    const pl = host.querySelector("[data-lg-price-label]");
    if (pl) pl.textContent = div ? "금액(세전)" : "가격";
    ["[data-lg-price-wrap]", "[data-lg-fx-wrap]"].forEach((s) => { const el = host.querySelector(s); if (el) el.hidden = split; });
    const fee = host.querySelector("[data-lg-fee-wrap]"); if (fee) fee.hidden = split || div;
    const tax = host.querySelector("[data-lg-tax-wrap]"); if (tax) tax.hidden = !div;
  });
  host.querySelectorAll("[data-lg-sugg]").forEach((b) => b.addEventListener("click", () => {
    const item = ledgerSuggestions(ledgerLoad(), ledgerMarket()).find((x) => x.key === b.dataset.lgSugg);
    if (!item) { renderLedger(); return; }
    ledgerEditId = "";
    ledgerFormOpen = true;
    ledgerPrefill = item.kind === "dividend"
      ? { key: item.key, type: "dividend", ticker: item.ticker, date: item.exDate, price: item.amount, exDate: item.exDate, qty: item.qty }
      : { key: item.key, type: "split", ticker: item.ticker, date: item.date, ratio: Math.round(item.ratio * 1e6) / 1e6 };
    renderLedger();
    host.querySelector(item.kind === "dividend" ? "[data-lg-price]" : "[data-lg-qty]")?.focus();
  }));
  host.querySelectorAll("[data-lg-dismiss]").forEach((b) => b.addEventListener("click", () => {
    ledgerDismiss(b.dataset.lgDismiss);
    renderLedger();
  }));
  host.querySelector("[data-lg-sugg-more]")?.addEventListener("click", () => { ledgerSuggShowAll = !ledgerSuggShowAll; renderLedger(); });
  host.querySelectorAll("[data-lg-edit]").forEach((b) => b.addEventListener("click", () => {
    ledgerEditId = ledgerEditId === b.dataset.lgEdit ? "" : b.dataset.lgEdit;
    ledgerPrefill = null;
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

// ---------------------------------------------------------------- 2단계: 상세(일봉·배당·분할) 지연 로드
function ledgerDetailKey(market, ticker) { return `${market}|${ticker}`; }

// 원장 종목의 상세 파일만 받는다(보유 화면을 열었을 때, 거래가 있을 때만). 도착하면 카드를 다시 그린다.
function ledgerEnsureDetails(tickers, market) {
  if (typeof loadStockDetail !== "function") return;
  const perfCore = window.MirLedgerPerfCore;
  if (!perfCore) return;
  tickers.forEach((ticker) => {
    const key = ledgerDetailKey(market, ticker);
    if (ledgerDetails.has(key)) return;
    ledgerDetails.set(key, { status: "loading" });
    Promise.resolve(loadStockDetail(ticker)).then((d) => {
      if (ledgerMarket() !== market) { ledgerDetails.delete(key); return; } // 시장이 바뀌는 사이 받은 다른 시장 파일
      const bars = d ? perfCore.normBars(d.chartSeries) : [];
      // 워커 실시간 대체 상세(__liveGenerated)엔 배당·분할 이벤트가 없다 → 제안·분할 검사 없이 일봉만.
      ledgerDetails.set(key, bars.length
        ? { status: "ok", bars, splits: d.__liveGenerated ? null : (d.splits || []), dividends: d.__liveGenerated ? null : (d.dividends || []) }
        : { status: "fail" });
    }).catch(() => ledgerDetails.set(key, { status: "fail" })).then(() => {
      clearTimeout(ledgerDetailTimer);
      ledgerDetailTimer = setTimeout(() => { try { renderLedger(); } catch (_) { /* 패널 실패가 다른 화면을 막지 않게 */ } }, 60);
    });
  });
}

function ledgerDismissed(market) {
  try {
    const raw = window.safeStorage.getJSON(`${LEDGER_DISMISS_PREFIX}:${market}`, null);
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : []);
  } catch (_) { return new Set(); }
}
function ledgerDismiss(key) {
  const market = ledgerMarket();
  const set = ledgerDismissed(market);
  set.add(key);
  try { window.safeStorage.setJSON(`${LEDGER_DISMISS_PREFIX}:${market}`, [...set].slice(-500)); } catch (_) { /* 저장 차단 — 이번 화면에서만 */ }
}

// 상세 배당·분할 이벤트로 만든 제안(원장 종목, 상세 도착분만). 날짜 최신순.
function ledgerSuggestions(txs, market) {
  const perfCore = window.MirLedgerPerfCore;
  if (!perfCore || !txs.length) return [];
  const today = ledgerTodayIso();
  const dismissed = ledgerDismissed(market);
  const out = [];
  [...new Set(txs.map((t) => t.ticker))].forEach((ticker) => {
    const det = ledgerDetails.get(ledgerDetailKey(market, ticker));
    if (!det || det.status !== "ok") return;
    if (det.splits) out.push(...perfCore.splitSuggestions({ ticker, txs, splits: det.splits, today, dismissed }));
    if (det.dividends) out.push(...perfCore.dividendSuggestions({ ticker, txs, dividends: det.dividends, splits: det.splits || [], today, dismissed }));
  });
  // 분할 먼저(기록 전엔 수익률·배당 제안이 막힌다), 그다음 배당락 최신순.
  return out.sort((a, b) => (a.kind !== b.kind ? (a.kind === "split" ? -1 : 1) : ((b.exDate || b.date) > (a.exDate || a.date) ? 1 : -1)));
}

function ledgerSuggestHtml(txs, market) {
  const items = ledgerSuggestions(txs, market);
  if (!items.length) return "";
  const shown = ledgerSuggShowAll ? items : items.slice(0, LEDGER_SUGG_LIMIT);
  const ratioText = (r) => (r >= 1 ? `1주→${ledgerFmtQty(r)}주` : `${ledgerFmtQty(Math.round((1 / r) * 1e4) / 1e4)}주→1주`);
  const rows = shown.map((x) => {
    const what = x.kind === "dividend"
      ? `배당락 ${escapeHtml(x.exDate)} · 받았을 배당 <b>${ledgerFmtMoney(x.amount)}</b> <span class="lg-est">추정</span> <small class="muted">${ledgerFmtQty(x.qty)}주 × ${marketCfg().formatPrice(x.dps)}</small>`
      : `분할 ${escapeHtml(x.date)} · <b>${ratioText(x.ratio)}</b>`;
    return `<li><span class="lg-sugg-what"><b>${escapeHtml(stockLabel(x.ticker))}</b> ${what}</span>
      <span class="lg-sugg-acts"><button type="button" class="ghost compact-btn" data-lg-sugg="${escapeHtml(x.key)}">확인·기록</button><button type="button" class="ghost compact-btn" data-lg-dismiss="${escapeHtml(x.key)}" title="이 제안 숨기기">무시</button></span></li>`;
  }).join("");
  return `<div class="lg-sugg"><p class="lg-sugg-head">기록 제안 <small class="muted">종목 상세의 배당·분할 · 확인해야 기록됩니다</small></p>
    <ul>${rows}</ul>
    ${items.length > LEDGER_SUGG_LIMIT ? `<button type="button" class="ghost compact-btn" data-lg-sugg-more>${ledgerSuggShowAll ? "접기" : `전체 ${items.length}건`}</button>` : ""}</div>`;
}

// 기간 수익률 표: 포트폴리오(원장 종목 2개 이상일 때) + 종목별. TWR(누적) 1M·3M·YTD·1Y·전체, XIRR(연환산, 전체).
function ledgerPerfHtml(txs, res, market) {
  const perfCore = window.MirLedgerPerfCore;
  if (!perfCore || !txs.length) return "";
  const errIds = new Set((res.errors || []).map((e) => e.id));
  const valid = txs.filter((t) => !errIds.has(t.id));
  const tickers = [...new Set(valid.filter((t) => t.type !== "dividend" && t.type !== "fee").map((t) => t.ticker))];
  if (!tickers.length) return "";
  ledgerEnsureDetails(tickers, market);
  const dets = tickers.map((t) => ({ ticker: t, det: ledgerDetails.get(ledgerDetailKey(market, t)) }));
  if (dets.some((x) => !x.det || x.det.status === "loading")) {
    return `<div class="lg-perf"><p class="muted font-small">기간 수익률 — 일봉 불러오는 중…</p></div>`;
  }
  const today = ledgerTodayIso();
  const inputs = dets.map(({ ticker, det }) => {
    const ttx = valid.filter((t) => t.ticker === ticker);
    if (det.status !== "ok") return { ticker, txs: ttx, bars: [], why: "" }; // 일봉 없음 — 보유 구간이 걸린 기간만 "—"
    const pendingSplit = det.splits && perfCore.splitSuggestions({ ticker, txs: ttx, splits: det.splits, today, dismissed: new Set() }).length > 0;
    const bars = perfCore.rawCloses(det.bars, perfCore.effectiveSplits(det.splits || [], ttx));
    return { ticker, txs: ttx, bars, why: pendingSplit ? "split" : "" };
  });
  const rowOf = (label, list, endDate) => {
    const blocked = list.find((x) => x.why);
    const r = blocked ? null : perfCore.performance(list, { endDate });
    return { label, r, blocked: blocked ? blocked.why : "" };
  };
  const rows = [];
  if (inputs.length > 1) {
    const held = inputs.filter((x) => (res.positions[x.ticker] || {}).qty > 0 && x.bars.length);
    const pool = held.length ? held : inputs.filter((x) => x.bars.length);
    const end = pool.length ? pool.map((x) => x.bars[x.bars.length - 1].date).sort()[held.length ? 0 : pool.length - 1] : "";
    rows.push(rowOf("포트폴리오", inputs, end));
  }
  inputs.forEach((x) => rows.push(rowOf(stockLabel(x.ticker), [x], "")));
  const WHY = { nodata: "일봉이 기간을 덮지 않음", short: "보유 기간이 짧음", undated: "날짜 모르는 시작 잔고", none: "기간 중 보유 없음", split: "분할 미기록 — 아래 제안 확인" };
  const cell = (v, why) => (v === null || v === undefined
    ? `<td class="ins-num muted" title="${escapeHtml(WHY[why] || "")}">—</td>`
    : `<td class="ins-num ${cls(v)}">${fmtSignedPct(v, 1)}</td>`);
  const body = rows.map(({ label, r, blocked }) => {
    const cells = perfCore.PERIODS.map((p) => cell(r ? r.twr[p] : null, blocked || (r ? r.why[p] : "nodata"))).join("");
    return `<tr><th scope="row">${escapeHtml(label)}${blocked === "split" ? ' <small class="neg">분할 미기록</small>' : ""}</th>${cells}${cell(r ? r.xirr : null, blocked || (r ? r.xirrWhy : "nodata"))}</tr>`;
  }).join("");
  const ends = rows.map((x) => x.r && x.r.endDate).filter(Boolean).sort();
  const asOf = ends.length ? ends[0] === ends[ends.length - 1] ? `${ends[0].slice(5).replace("-", "/")} 종가 기준` : `${ends[0].slice(5).replace("-", "/")}~${ends[ends.length - 1].slice(5).replace("-", "/")} 종가 기준` : "";
  return `<div class="lg-perf">
    <p class="lg-perf-head">기간 수익률 <small class="muted">TWR(누적) · XIRR(연환산)${asOf ? ` · ${asOf}` : ""}</small></p>
    <div class="lg-table-wrap lg-perf-wrap"><table class="insider-table lg-table lg-perf-table"><thead><tr><th>구분</th>${perfCore.PERIODS.map((p) => `<th class="ins-num">${perfCore.PERIOD_LABEL[p]}</th>`).join("")}<th class="ins-num">XIRR</th></tr></thead><tbody>${body}</tbody></table></div>
  </div>`;
}

// 금융소득 계기판용 — 그 시장 원장의 배당 기록(연도). 기록이 없으면 count 0.
function ledgerDividendRecords(market, year) {
  const perfCore = window.MirLedgerPerfCore;
  if (!perfCore) return { gross: 0, tax: 0, net: 0, count: 0, byTicker: {} };
  return perfCore.dividendTotals(ledgerLoad(market), String(year));
}

window.MirLedger = {
  reconcile: ledgerReconcile,
  dividendRecords: ledgerDividendRecords,
  tickers: ledgerTickers,
  removeTicker: ledgerRemoveTicker,
  clearMarket: ledgerClearMarket,
  render: renderLedger,
};
