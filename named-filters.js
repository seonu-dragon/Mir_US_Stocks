// named-filters.js — 종목 › 찾기 › 필터 목록(규칙 공개형 이름 붙은 필터)
// =====================================================================
// 클래식 스크립트(모듈 아님). 전역 이름은 nf 접두사. 정의·개수 계산·과거 결과 문장은 named-filters-core.js.
//
//   · 왼쪽 목록(PC) / 셀렉트(폰, ≤900px) — 필터 이름 + 지금 데이터로 센 통과 종목 수.
//   · 오른쪽: 규칙 설명, 수식(복사 · 수식 스크리너에서 열기), 과거 결과 한 줄(스크리너 백테스트 패널이
//     그 필드를 가진 필터만 — 없으면 '검증 데이터 없음'), 통과 종목 표.
//   · 평가는 formula-screener.js 와 같은 행·필드(fxRows · fxCtx · fxAvailableFields)로 한다 —
//     같은 수식을 수식 화면에서 열면 같은 개수가 나온다.
//   · 선택은 브라우저(mir.find.filter.<us|kr>)와 URL(?tab=find&filter=<id>)에 남는다.
//
// 데이터: 스냅샷 + MAP_FUNDAMENTALS(늦게 옴) + RISK_CHECK(lazy) + NAMED_FILTER_STATS(lazy,
// scripts/build_named_filter_stats.mjs — Screener backtest panel 워크플로우가 주 1회).

const NF_STORE_PREFIX = "mir.find.filter.";
const NF_MAX_ROWS = 200;
let nfState = { market: "", selected: "", sort: "", dir: -1 };
let nfPendingId = null;
let nfBound = false;
let nfCountMemo = null;
let nfStatsPending = false;

function nfStoreGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
function nfStoreSet(k, v) { try { window.localStorage.setItem(k, v); } catch (_) { /* 차단 환경 */ } }

// boot 에서 ?filter= 를 받으면 첫 렌더 때 고른다.
function namedFiltersPreload(id) {
  nfPendingId = id || null;
}

function nfWriteUrl(id) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "find");
    url.searchParams.delete("sub");
    url.searchParams.set("filter", id);
    history.replaceState(history.state, "", url.toString());
  } catch (_) { /* history 차단 환경 */ }
}

// 이 시장의 필터 목록(정의 전체) + 지금 값이 있는 필드로 컴파일한 결과.
function nfList() {
  const core = window.MirNamedFiltersCore;
  const fcore = window.MirFormulaCore;
  if (!core || !fcore) return [];
  const market = marketCfg().id;
  const defs = core.forMarket(market, core.definitionFields(), fcore);
  const av = fxAvailableFields();
  return defs.map((f) => {
    const live = fcore.compile(f.formula, { fields: av.keys, aliases: FX_ALIASES, unavailable: av.unavailable, expect: "bool" });
    return { ...f, live: live && live.ok ? live : null, liveError: live && !live.ok ? live.error : "" };
  });
}

// 통과 종목 인덱스(필터별). 스냅샷·MAP_FUNDAMENTALS·RISK_CHECK 가 바뀌면 다시 센다.
function nfEvaluate(list) {
  const av = fxAvailableFields();
  const key = `${av.key}|${list.map((f) => f.id).join(",")}`;
  if (nfCountMemo && nfCountMemo.key === key) return nfCountMemo;
  const rows = fxRows();
  const pass = {};
  list.forEach((f) => { pass[f.id] = f.live ? window.MirFormulaCore.filterIndices(f.live, rows, fxCtx) : null; });
  nfCountMemo = { key, rows, pass };
  return nfCountMemo;
}

function nfCountText(n) {
  return n == null ? "—" : n.toLocaleString();
}

function nfRenderNav(list, ev) {
  const nav = byId("nfNav");
  const sel = byId("nfSelect");
  const core = window.MirNamedFiltersCore;
  if (nav) {
    nav.innerHTML = core.grouped(list).map((g) => `<p class="nf-nav-group">${escapeHtml(g.label)}</p>${g.items.map((f) => {
      const n = ev.pass[f.id] ? ev.pass[f.id].length : null;
      const on = f.id === nfState.selected;
      return `<button type="button" class="toc-item nf-item${on ? " is-active" : ""}" data-nf="${escapeHtml(f.id)}" aria-current="${on ? "true" : "false"}" title="${escapeHtml(f.formula)}"><span class="nf-item-name">${escapeHtml(f.name)}</span><span class="nf-item-count">${escapeHtml(nfCountText(n))}</span></button>`;
    }).join("")}`).join("");
  }
  if (sel) {
    sel.innerHTML = core.grouped(list).map((g) => `<optgroup label="${escapeHtml(g.label)}">${g.items.map((f) => {
      const n = ev.pass[f.id] ? ev.pass[f.id].length : null;
      return `<option value="${escapeHtml(f.id)}"${f.id === nfState.selected ? " selected" : ""}>${escapeHtml(f.name)} (${escapeHtml(nfCountText(n))})</option>`;
    }).join("")}</optgroup>`).join("");
    sel.value = nfState.selected;
  }
}

function nfHistoryHtml(f) {
  const core = window.MirNamedFiltersCore;
  const stats = window.NAMED_FILTER_STATS;
  const statsForMarket = stats && stats.market === marketCfg().id ? stats : null;
  if (!statsForMarket && nfStatsPending) return `<div class="nf-history is-none"><span class="nf-label">과거 결과</span><p class="muted">불러오는 중…</p></div>`;
  const h = core.historyFor(statsForMarket, f);
  if (h.kind !== "ok") {
    return `<div class="nf-history is-none"><span class="nf-label">과거 결과</span><p class="muted">${escapeHtml(h.text)}</p></div>`;
  }
  const verdictTitle = window.MirOverfitCore && Array.isArray(window.MirOverfitCore.CRITERIA) ? window.MirOverfitCore.CRITERIA.join("\n") : "";
  const cls2 = h.verdictKey === "pass" ? "is-pass" : h.verdictKey === "overfit" ? "is-overfit" : "is-insufficient";
  const caveat = (statsForMarket && statsForMarket.caveat) || h.caveat;
  return `<div class="nf-history is-ok"><span class="nf-label">과거 결과</span>
    <p>${escapeHtml(h.text)}${h.verdict ? ` · 과적합 검사 <span class="nf-verdict ${cls2}" title="${escapeHtml(verdictTitle)}">${escapeHtml(h.verdict)}</span>` : ""}</p>
    <p class="nf-caveat">${escapeHtml(caveat)}</p></div>`;
}

function nfRenderDetail(f, ev) {
  const box = byId("nfDetail");
  if (!box) return;
  if (!f) { box.innerHTML = `<p class="muted">이 시장에 표시할 필터가 없습니다.</p>`; return; }
  const core = window.MirNamedFiltersCore;
  const groupLabel = (core.GROUPS.find((g) => g.id === f.group) || {}).label || "";
  box.innerHTML = `<div class="nf-head">
      <span class="nf-group">${escapeHtml(groupLabel)}</span>
      <h2 class="nf-title">${escapeHtml(f.name)}</h2>
      <p class="nf-rule">${escapeHtml(f.rule)}</p>
    </div>
    <div class="nf-formula">
      <span class="nf-label">수식</span>
      <code class="nf-code">${escapeHtml(f.formula)}</code>
      <div class="nf-formula-actions">
        <button type="button" class="ghost compact-btn" data-nf-act="copy">수식 복사</button>
        <button type="button" class="ghost compact-btn" data-nf-act="open">수식 스크리너에서 열기</button>
      </div>
    </div>
    ${nfHistoryHtml(f)}`;
}

// 표 머리글: 수식 필드 이름 대신 한국어 이름(괄호 단위·설명은 뺀다 — 전체 이름은 title).
function nfShortLabel(k) {
  const label = FX_FIELD_BY_KEY[k]?.label || k;
  return label.replace(/\s*\(.*\)\s*$/, "") || k;
}

function nfRenderTable(f, ev) {
  const head = byId("nfHead");
  const body = byId("nfBody");
  const meta = byId("nfMeta");
  if (!head || !body) return;
  const idx = f ? ev.pass[f.id] : null;
  if (!f || !idx) {
    head.innerHTML = "";
    body.innerHTML = "";
    if (meta) {
      meta.textContent = f && f.liveError
        ? "이 필터에 쓰는 데이터가 아직 도착하지 않았거나 이 시장에 값이 없습니다. 잠시 뒤 다시 계산합니다."
        : "";
    }
    return;
  }
  const run = { rows: ev.rows, colVals: [] };
  const cols = f.live.fields.filter((k) => k !== "marketCap").slice(0, 4)
    .map((k) => ({ key: k, label: nfShortLabel(k), title: `${FX_FIELD_BY_KEY[k]?.label || k} · ${k}` }));
  cols.push({ key: "marketCap", label: "시총", title: FX_FIELD_BY_KEY.marketCap.label });
  let sortKey = nfState.sort && cols.some((c) => c.key === nfState.sort) ? nfState.sort : "marketCap";
  const dir = nfState.dir === 1 ? 1 : -1;
  const sanity = window.MirFundSanity;
  const hasBounds = (k) => Boolean(sanity && FX_FIELD_BY_KEY[k] && sanity.bounds(k));
  const sorted = idx.slice().sort((a, b) => {
    const av = fxSortValue(run, a, sortKey);
    const bv = fxSortValue(run, b, sortKey);
    if (hasBounds(sortKey)) return sanity.sortCompare(sortKey, av, bv, dir);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return dir * (av - bv);
  });
  if (meta) {
    const when = data.updatedAtKst || data.updated_at_kst || "";
    meta.textContent = `${idx.length.toLocaleString()}개 종목 일치 · 모집단 ${ev.rows.length.toLocaleString()}종목(ETF 제외)${when ? ` · 기준 ${when}` : ""} · 값이 없는 종목은 조건 불충족으로 봅니다`;
  }
  const arrow = (k) => (k === sortKey ? (dir === 1 ? " ▲" : " ▼") : "");
  head.innerHTML = `<tr><th></th><th>${isKrMarket() ? "종목" : "티커"}</th><th class="col-sub">회사</th><th>섹터</th><th>당일</th>${cols.map((c) => `<th class="num"><button type="button" class="fx-sort" data-nf-sort="${escapeHtml(c.key)}" title="${escapeHtml(c.title)}">${escapeHtml(c.label)}${arrow(c.key)}</button></th>`).join("")}</tr>`;
  if (!sorted.length) {
    body.innerHTML = `<tr><td colspan="${5 + cols.length}" class="muted">지금 데이터로는 조건에 맞는 종목이 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = sorted.slice(0, NF_MAX_ROWS).map((i) => {
    const { item } = ev.rows[i];
    return `<tr>
      <td>${watchStarButton(item.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(stockLabel(item))}</button></td>
      <td class="col-sub">${escapeHtml(stockSubLabel(item))}</td>
      <td>${escapeHtml(sectorLabelKo(item.sector))}</td>
      <td class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</td>
      ${cols.map((c) => fxCellHtml(run, i, c)).join("")}
    </tr>`;
  }).join("") + (sorted.length > NF_MAX_ROWS ? `<tr><td colspan="${5 + cols.length}" class="muted">상위 ${NF_MAX_ROWS}개만 표시(전체 ${sorted.length.toLocaleString()}개) — 머리글을 눌러 정렬을 바꾸거나 수식 스크리너에서 조건을 좁히세요.</td></tr>` : "");
  delegateTickerClicks(body, ".ticker-link");
}

function nfSelect(id, { user = false } = {}) {
  const list = nfList();
  if (!list.some((f) => f.id === id)) return;
  if (nfState.selected !== id) { nfState.sort = ""; nfState.dir = -1; }
  nfState.selected = id;
  if (user) {
    nfStoreSet(NF_STORE_PREFIX + marketCfg().id, id);
    nfWriteUrl(id);
  }
  nfRenderAll(list);
  if (user) {
    const layout = byId("nfLayout");
    const top = layout ? layout.getBoundingClientRect().top : 0;
    if (top < 0) window.scrollTo({ top: window.pageYOffset + top - 72, behavior: "auto" });
  }
}

function nfRenderAll(list) {
  const ev = nfEvaluate(list);
  const f = list.find((x) => x.id === nfState.selected) || null;
  nfRenderNav(list, ev);
  nfRenderDetail(f, ev);
  nfRenderTable(f, ev);
}

function renderNamedFilters() {
  const panel = byId("sub-filters");
  if (!panel || !window.MirNamedFiltersCore || !window.MirFormulaCore || !data || !Array.isArray(data.stocks)) return;
  const core = window.MirNamedFiltersCore;
  const market = marketCfg().id;
  if (nfState.market !== market) {
    nfState = { market, selected: "", sort: "", dir: -1 };
    nfCountMemo = null;
  }
  // 시장 전환 직전에 출발한 이전 시장 파일이 전환 뒤에 도착하면 전역에 남는다(시장별 lazy 공통 경합).
  // 문서의 market 이 지금 시장과 다르면 버리고 이 시장 것을 다시 받는다.
  // 캐시된 로드 약속(_featureDataPromises)도 지워야 한다 — 남겨 두면 '이미 받음'으로 끝나 전역이 영영 비고
  // 이 화면이 '불러오는 중'에 머문다(2026-10-01 로컬 재현: KR 딥링크 첫 방문).
  [["RISK_CHECK", "riskCheck"], ["NAMED_FILTER_STATS", "namedFilterStats"]].forEach(([g, key]) => {
    const doc = window[g];
    if (doc && doc.market && doc.market !== market) {
      delete window[g];
      if (typeof _featureDataPromises === "object" && _featureDataPromises) delete _featureDataPromises[key];
    }
  });
  // Piotroski·위험 경고 필드는 집계 파일이 오면 계산된다(늦게 오면 refreshFeatureViews 가 다시 그린다).
  if (!window.RISK_CHECK) ensureFeatureData("riskCheck").then((ok) => { if (ok) scheduleFeatureViewRefresh(); });
  if (!window.NAMED_FILTER_STATS) {
    nfStatsPending = true;
    ensureFeatureData("namedFilterStats").then(() => { nfStatsPending = false; scheduleFeatureViewRefresh(); });
  }
  nfBind();
  const list = nfList();
  if (nfPendingId != null) {
    const want = core.sanitizeId(nfPendingId);
    nfPendingId = null;
    if (want && list.some((f) => f.id === want)) nfState.selected = want;
    else if (want) showAppToast("이 시장에는 없는 필터라 첫 필터를 엽니다");
  }
  if (!nfState.selected || !list.some((f) => f.id === nfState.selected)) {
    nfState.selected = core.resolveSelection(list, "", nfStoreGet(NF_STORE_PREFIX + market));
  }
  nfRenderAll(list);
}

function nfBind() {
  if (nfBound) return;
  nfBound = true;
  const nav = byId("nfNav");
  nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nf]");
    if (btn) nfSelect(btn.dataset.nf, { user: true });
  });
  nav?.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const btns = [...nav.querySelectorAll("[data-nf]")];
    const cur = btns.indexOf(document.activeElement);
    if (cur < 0) return;
    e.preventDefault();
    let next = cur;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = btns.length - 1;
    else next = (cur + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length;
    const id = btns[next].dataset.nf;
    nfSelect(id, { user: true });
    nav.querySelector(`[data-nf="${CSS.escape(id)}"]`)?.focus();
  });
  byId("nfSelect")?.addEventListener("change", (e) => nfSelect(e.target.value, { user: true }));
  byId("nfDetail")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nf-act]");
    if (!btn) return;
    const f = window.MirNamedFiltersCore.BY_ID[nfState.selected];
    if (!f) return;
    if (btn.dataset.nfAct === "copy") {
      const done = () => showAppToast("수식을 복사했습니다");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(f.formula).then(done).catch(() => showAppToast("복사에 실패했습니다"));
      else showAppToast("복사에 실패했습니다");
    } else if (btn.dataset.nfAct === "open") {
      if (typeof formulaScreenerPreload === "function") formulaScreenerPreload(window.MirFormulaCore.encodeState({ f: f.formula, c: [], s: "", d: -1 }));
      activateSearchSub("formula", { push: true });
      byId("sub-formula")?.scrollIntoView({ block: "start" });
    }
  });
  byId("nfHead")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nf-sort]");
    if (!b) return;
    const key = b.dataset.nfSort;
    if (nfState.sort === key || (!nfState.sort && key === "marketCap")) nfState.dir = nfState.dir === 1 ? -1 : 1;
    else { nfState.sort = key; nfState.dir = -1; }
    if (!nfState.sort) nfState.sort = key;
    nfRenderAll(nfList());
  });
}
