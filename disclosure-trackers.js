// 이 파일은 app.js 에서 기계적으로 분리된 코드다 (refactor/appjs-split-stage2).
// 공시·수급 트래커 클러스터: 내부자(Form 4)/액티비스트 13D·G/주요공시 8-K/IPO/밸류에이션 랭킹/공매도/자사주/실적발표 반응/배당/공급계약/증자·희석/KR 하이라이트 (원본 app.js 2662-3954).
// index.html 에서 app.js 보다 먼저 로드되는 classic script. 최상위 function/let/const 는
// 전역 렉시컬 환경을 공유하므로 app.js 와 양방향 참조가 호출 시점에 해결된다.

// ===== 종목 버튼 이벤트 위임 =====
// 표·칩 컨테이너 하나에 click 리스너 하나만 단다. 예전엔 렌더마다 행(300~500개)마다
// addEventListener 를 걸어 재렌더 때마다 클로저·리스너가 수백 개씩 새로 생겼다.
// 컨테이너(innerHTML 만 갈리는 고정 요소)당 셀렉터별로 한 번만 바인딩한다(data-ticker-delegate).
// disclosure-trackers.js·kr-panels.js·screener.js·watchlist.js 가 공용으로 쓴다(호출 시점 전역 해석).
function delegateTickerClicks(container, selector = ".ins-ticker") {
  if (!container) return;
  const bound = container.dataset.tickerDelegate ? container.dataset.tickerDelegate.split("|") : [];
  if (bound.includes(selector)) return;
  bound.push(selector);
  container.dataset.tickerDelegate = bound.join("|");
  container.addEventListener("click", (event) => {
    const btn = event.target.closest(selector);
    if (!btn || !container.contains(btn)) return;
    const ticker = btn.dataset.ticker;
    if (!ticker) return;
    selectTicker(ticker, { openSearch: true });
  });
}


// ==================== 내부자 거래 (SEC Form 4) ====================
let insiderKind = "all";
let insiderQuery = "";

function insiderFmtShares(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}
function insiderFmtUsd(n) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function insiderKindClass(kind) {
  if (kind === "buy") return "ins-buy";
  if (kind === "sell") return "ins-sell";
  return "ins-neutral";
}

function setupInsiderControls() {
  const filter = byId("insiderKindFilter");
  if (filter && !filter.dataset.bound) {
    filter.dataset.bound = "1";
    filter.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        insiderKind = btn.dataset.kind || "all";
        filter.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === btn));
        renderInsiderTrades();
      });
    });
  }
  const search = byId("insiderSearch");
  if (search && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", debounce(() => { insiderQuery = search.value; renderInsiderTrades(); }, 300));
  }
}

function renderInsiderTrades() {
  setupInsiderControls();
  renderInsiderCluster();
  const wrap = byId("insiderTable");
  const meta = byId("insiderMeta");
  if (!wrap) return;
  const payload = window.INSIDER_TRADES;
  if (!payload || !Array.isArray(payload.trades) || !payload.trades.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 내부자 거래 데이터가 없습니다. 데이터 수집(GitHub Actions) 후 표시됩니다.</p>`;
    return;
  }
  if (meta) {
    meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC Form 4")}`;
  }
  const q = insiderQuery.trim().toLowerCase();
  let rows = payload.trades;
  if (insiderKind !== "all") rows = rows.filter((r) => r.kind === insiderKind);
  if (q) {
    rows = rows.filter((r) =>
      (r.ticker || "").toLowerCase().includes(q) ||
      (r.issuer || "").toLowerCase().includes(q) ||
      (r.owner || "").toLowerCase().includes(q));
  }
  const shown = rows.slice(0, 300);
  if (!shown.length) {
    wrap.innerHTML = `<p class="muted">조건에 맞는 거래가 없습니다.</p>`;
    return;
  }
  const body = shown.map((r) => {
    const kc = insiderKindClass(r.kind);
    const price = Number.isFinite(r.price) && r.price > 0 ? `$${Number(r.price).toFixed(2)}` : "—";
    return `
      <tr>
        <td class="ins-date">${escapeHtml(r.txDate || r.fileDate || "")}</td>
        <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker || "")}">${escapeHtml(r.ticker || "")}</button></td>
        <td class="ins-owner"><span>${escapeHtml(r.owner || "")}</span><em>${escapeHtml(r.relation || "")}</em></td>
        <td><span class="ins-code ${kc}">${escapeHtml(r.codeLabel || r.code || "")}</span></td>
        <td class="ins-num">${insiderFmtShares(r.shares)}</td>
        <td class="ins-num">${price}</td>
        <td class="ins-num ins-value ${kc}">${insiderFmtUsd(r.value)}</td>
      </tr>`;
  }).join("");
  wrap.innerHTML = `
    <div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건 표시${rows.length > 300 ? " (검색으로 좁혀보세요)" : ""}</div>
    <table class="insider-table table-wide">
      <thead><tr>
        <th>거래일</th><th>종목</th><th>보고자 / 직책</th><th>유형</th>
        <th class="ins-num">수량</th><th class="ins-num">단가</th><th class="ins-num">금액</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== #1 내부자 클러스터 매수 시그널 =====
function renderInsiderCluster() {
  const el = byId("insiderCluster");
  if (!el) return;
  const payload = window.INSIDER_TRADES;
  if (!payload || !Array.isArray(payload.trades)) { el.innerHTML = ""; return; }
  const byTicker = {};
  for (const r of payload.trades) {
    if (r.kind !== "buy" || !r.ticker) continue;
    const g = byTicker[r.ticker] || (byTicker[r.ticker] = { ticker: r.ticker, owners: new Set(), value: 0, count: 0 });
    g.owners.add(r.owner || "?");
    g.value += Number(r.value) || 0;
    g.count += 1;
  }
  const clusters = Object.values(byTicker)
    .filter((g) => g.owners.size >= 2)
    .sort((a, b) => b.owners.size - a.owners.size || b.value - a.value)
    .slice(0, 12);
  if (!clusters.length) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="cluster-head">클러스터 매수 <span>보관 기간 내 2인 이상 임원이 공개시장 매수(P)한 종목 — 강한 내부자 신뢰 신호</span></div>
    <div class="cluster-grid">
      ${clusters.map((g) => `
        <button type="button" class="cluster-card" data-ticker="${escapeHtml(g.ticker)}" title="${g.owners.size}명 매수 · ${g.count}건">
          <strong>${escapeHtml(stockLabel(g.ticker))}</strong>
          <span>${g.owners.size}명 · ${g.count}건</span>
          <em>${insiderFmtUsd(g.value)}</em>
        </button>`).join("")}
    </div>`;
  delegateTickerClicks(el, ".cluster-card");
}

// ===== #5 액티비스트 13D/G =====
let activistKind = "all";
let activistQuery = "";
function setupActivistControls() {
  const f = byId("activistKindFilter");
  if (f && !f.dataset.bound) {
    f.dataset.bound = "1";
    f.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      activistKind = b.dataset.kind || "all";
      f.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderActivistStakes();
    }));
  }
  const s = byId("activistSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", debounce(() => { activistQuery = s.value; renderActivistStakes(); }, 300)); }
}
function renderActivistStakes() {
  setupActivistControls();
  const wrap = byId("activistTable");
  const meta = byId("activistMeta");
  if (!wrap) return;
  const payload = window.ACTIVIST_STAKES;
  if (!payload || !Array.isArray(payload.filings) || !payload.filings.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 13D/G 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC 13D/G")}`;
  const q = activistQuery.trim().toLowerCase();
  let rows = payload.filings;
  if (activistKind !== "all") rows = rows.filter((r) => r.kind === activistKind);
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q) || (r.filer || "").toLowerCase().includes(q));
  const shown = rows.slice(0, 300);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 공시가 없습니다.</p>`; return; }
  const body = shown.map((r) => {
    const kc = r.kind === "activist" ? "ins-buy" : "ins-neutral";
    return `<tr>
      <td class="ins-date">${escapeHtml(r.fileDate || "")}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker || "")}">${escapeHtml(r.ticker || "")}</button><div class="ins-sub">${escapeHtml(r.company || "")}</div></td>
      <td><span class="ins-code ${kc}">${escapeHtml(r.form || "")}</span><div class="ins-sub">${escapeHtml(r.kindLabel || "")}</div></td>
      <td>${escapeHtml(r.filer || "")}</td>
      <td class="ins-num"><a href="${escapeHtml(r.link || "#")}" target="_blank" rel="noopener">원문</a></td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건</div>
    <table class="insider-table table-wide"><thead><tr><th>공시일</th><th>종목</th><th>유형</th><th>신고자</th><th class="ins-num">링크</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== #6 주요 공시 8-K =====
let eventsHot = "all";
let eventsQuery = "";
function setupEventsControls() {
  const f = byId("eventsHotFilter");
  if (f && !f.dataset.bound) {
    f.dataset.bound = "1";
    f.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      eventsHot = b.dataset.hot || "all";
      f.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderMaterialEvents();
    }));
  }
  const s = byId("eventsSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", debounce(() => { eventsQuery = s.value; renderMaterialEvents(); }, 300)); }
}
function renderMaterialEvents() {
  setupEventsControls();
  const wrap = byId("eventsTable");
  const meta = byId("eventsMeta");
  if (!wrap) return;
  const payload = window.MATERIAL_EVENTS;
  if (!payload || !Array.isArray(payload.events) || !payload.events.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 8-K 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC 8-K")}`;
  const q = eventsQuery.trim().toLowerCase();
  let rows = payload.events;
  if (eventsHot === "hot") rows = rows.filter((r) => r.hot);
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q) || (r.items || []).some((i) => (i.label || "").toLowerCase().includes(q)));
  const shown = rows.slice(0, 300);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 공시가 없습니다.</p>`; return; }
  const body = shown.map((r) => {
    const items = (r.items || []).map((i) => `<span class="ev-item${r.hot ? " ev-hot" : ""}">${escapeHtml(i.label)}</span>`).join(" ");
    return `<tr>
      <td class="ins-date">${escapeHtml(r.fileDate || "")}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker || "")}">${escapeHtml(r.ticker || "")}</button><div class="ins-sub">${escapeHtml(r.company || "")}</div></td>
      <td>${items}</td>
      <td class="ins-num"><a href="${escapeHtml(r.link || "#")}" target="_blank" rel="noopener">원문</a></td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건</div>
    <table class="insider-table table-wide"><thead><tr><th>공시일</th><th>종목</th><th>이벤트</th><th class="ins-num">링크</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== #7 IPO 캘린더 =====
let ipoStage = "all";
let ipoQuery = "";
let ipoView = "list"; // list=전체 일정 · perf=공모가 성과(offerPrice 있는 종목만)
function setupIpoControls() {
  const f = byId("ipoStageFilter");
  if (f && !f.dataset.bound) {
    f.dataset.bound = "1";
    f.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      ipoStage = b.dataset.stage || "all";
      f.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderIpoCalendar();
    }));
  }
  const vt = byId("ipoViewToggle");
  if (vt && !vt.dataset.bound) {
    vt.dataset.bound = "1";
    vt.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      ipoView = b.dataset.view || "list";
      vt.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderIpoCalendar();
    }));
  }
  const s = byId("ipoSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { ipoQuery = s.value; renderIpoCalendar(); }); }
}

// KR 소스는 날짜를 "2026.08.14" 로 준다. 비교·D+N 계산용 ISO 로 정규화.
function ipoNormDate(s) {
  return String(s || "").trim().replace(/\./g, "-").replace(/-+$/, "");
}

// 공모가 없음(리세일·직상장·채권 등) 사유 라벨. 원문 코드 → 한국어.
function ipoNoneReasonLabel(reason) {
  const map = {
    resale: "리세일",
    "direct-listing": "직상장",
    direct: "직상장",
    debt: "채권",
    atm: "ATM",
    shelf: "일괄등록",
    supplement: "보충서",
  };
  const key = String(reason || "").toLowerCase();
  return map[key] || (reason ? String(reason) : "");
}

// 일정(list) 보기에서 각 행의 공모가 상태를 한 줄로 요약한다.
//  · offerPriceNone   → "공모가 없음 (사유)"  (성과 산정 불가)
//  · offerPricePending→ "희망 공모가 X~Y원"   (수요예측 전, 확정가 아님)
//  · offerPriceKind=unit → "공모가 $10/unit · 유닛 IPO"
//  · 그 외 확정 offerPrice → "공모가 X"
function ipoOfferNote(r, cfg) {
  if (r.offerPriceNone) {
    const reason = ipoNoneReasonLabel(r.offerPriceNoneReason);
    return `<div class="ins-sub">공모가 없음${reason ? ` · ${escapeHtml(reason)}` : ""}</div>`;
  }
  if (r.offerPricePending && Array.isArray(r.offerPriceBand) && r.offerPriceBand.length === 2) {
    const lo = Number(r.offerPriceBand[0]);
    const hi = Number(r.offerPriceBand[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && hi > 0) {
      return lo === hi
        ? `<div class="ins-sub">희망 공모가 ${cfg.formatMoney(lo)} <span class="muted">(수요예측 전)</span></div>`
        : `<div class="ins-sub">희망 공모가 ${cfg.formatMoney(lo)}~${cfg.formatMoney(hi)} <span class="muted">(수요예측 전)</span></div>`;
    }
  }
  const offer = Number(r.offerPrice);
  if (Number.isFinite(offer) && offer > 0) {
    const isUnit = r.offerPriceKind === "unit";
    return `<div class="ins-sub">공모가 ${cfg.formatMoney(offer)}${isUnit ? "/unit · 유닛 IPO" : ""}</div>`;
  }
  return "";
}

// 공모가 성과 행: offerPrice 가 있고 스냅샷에서 현재가가 잡히는 종목만.
// 같은 티커의 정정 제출이 여러 건이라 최신 제출 1건으로 dedupe 한다.
//
// 유닛 IPO(offerPriceKind="unit", SPAC 등)는 수익률 순위에서 뺀다 — 공모가 $10 은
// 유닛(주식+워런트)당 가격이고 상장 후 둘로 분리되므로, 현재 '주가' 하나와 $10 을
// 직접 비교하면 손익이 왜곡된다. 순위 대신 raw 비교만 별도 섹션에 참고로 보여준다.
// offerPriceNone(공모가 자체가 없는 공시)·offerPricePending(수요예측 전)은
// 확정 공모가가 없어 성과 산정에서 완전히 제외한다(일정 보기에만 남는다).
function ipoPerfRows(payload) {
  const ranked = [];
  const units = [];
  const seen = new Set();
  const rows = (payload.ipos || []).slice()
    .sort((a, b) => ipoNormDate(b.fileDate).localeCompare(ipoNormDate(a.fileDate)));
  for (const r of rows) {
    if (r.offerPriceNone || r.offerPricePending) continue;
    const offer = Number(r.offerPrice);
    if (!Number.isFinite(offer) || offer <= 0 || !r.ticker) continue;
    if (seen.has(r.ticker)) continue;
    const item = stockByTicker(r.ticker);
    const price = Number(item && item.price);
    if (!item || !Number.isFinite(price) || price <= 0) continue;
    seen.add(r.ticker);
    const base = {
      ticker: r.ticker,
      company: r.company || item.company || "",
      listDate: ipoNormDate(r.fileDate),
      offer,
      price,
    };
    if (r.offerPriceKind === "unit") {
      units.push(base);
    } else {
      base.retPct = (price / offer - 1) * 100;
      ranked.push(base);
    }
  }
  ranked.sort((a, b) => b.retPct - a.retPct); // 공모가 대비 수익률이 기본 정렬
  units.sort((a, b) => ipoNormDate(b.listDate).localeCompare(ipoNormDate(a.listDate)));
  return { ranked, units };
}

function renderIpoPerformance(perf, wrap, meta, payload) {
  const cfg = marketCfg();
  const q = ipoQuery.trim().toLowerCase();
  const match = (r) => !q || (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q);
  const list = perf.ranked.filter(match);
  const unitList = perf.units.filter(match);
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 공모가 확인 ${perf.ranked.length}종목 · 공모가 대비 수익률순`;
  if (!list.length && !unitList.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 종목이 없습니다.</p>`; return; }
  const todayMs = Date.parse(formatKstDateTime().slice(0, 10));
  const dPlus = (listDate) => {
    const listMs = Date.parse(listDate);
    return (Number.isFinite(listMs) && Number.isFinite(todayMs) && todayMs >= listMs)
      ? Math.round((todayMs - listMs) / 86400000) : null;
  };
  const nameCell = (r) => {
    const main = isKrMarket() ? (r.company || r.ticker) : r.ticker;
    const sub = isKrMarket() ? r.ticker : (r.company || "");
    return `<td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(main)}</button><div class="ins-sub">${escapeHtml(sub)}</div></td>`;
  };
  const body = list.slice(0, 200).map((r) => {
    const days = dPlus(r.listDate);
    const cls = r.retPct > 0 ? "ins-buy" : r.retPct < 0 ? "ins-sell" : "";
    return `<tr>
      ${nameCell(r)}
      <td class="ins-date">${escapeHtml(r.listDate)}${days != null ? ` <span class="ins-sub">D+${days}</span>` : ""}</td>
      <td class="ins-num">${cfg.formatMoney(r.offer)}</td>
      <td class="ins-num">${cfg.formatMoney(r.price)}</td>
      <td class="ins-num"><strong class="${cls}">${r.retPct > 0 ? "+" : ""}${r.retPct.toFixed(1)}%</strong></td>
    </tr>`;
  }).join("");
  let html = "";
  if (list.length) {
    html += `<div class="insider-count">${perf.ranked.length.toLocaleString()}종목 중 ${Math.min(list.length, 200).toLocaleString()}종목</div>
      <table class="insider-table table-wide"><thead><tr><th>종목</th><th>상장일</th><th class="ins-num">공모가</th><th class="ins-num">현재가</th><th class="ins-num">공모가 대비</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  // 유닛 IPO: 수익률 순위 제외. raw 공모가↔현재가만 참고로, '공모가 대비' 칸은 —.
  if (unitList.length) {
    const ubody = unitList.slice(0, 100).map((r) => {
      const days = dPlus(r.listDate);
      return `<tr>
        ${nameCell(r)}
        <td class="ins-date">${escapeHtml(r.listDate)}${days != null ? ` <span class="ins-sub">D+${days}</span>` : ""}</td>
        <td class="ins-num">${cfg.formatMoney(r.offer)}<span class="ins-sub">/unit</span></td>
        <td class="ins-num">${cfg.formatMoney(r.price)}</td>
        <td class="ins-num muted">—</td>
      </tr>`;
    }).join("");
    html += `<p class="krflow-note" style="margin-top:14px">유닛 IPO ${unitList.length.toLocaleString()}종목 — 공모가는 유닛(주식+워런트)당 가격이라 상장 후 분리되면 현재 주가와 직접 비교할 수 없습니다. 수익률 순위에서 제외했습니다.</p>
      <table class="insider-table table-wide"><thead><tr><th>종목(유닛 IPO)</th><th>상장일</th><th class="ins-num">공모가</th><th class="ins-num">현재가</th><th class="ins-num">공모가 대비</th></tr></thead><tbody>${ubody}</tbody></table>`;
  }
  wrap.innerHTML = html;
  delegateTickerClicks(wrap, ".ins-ticker");
}

function renderIpoCalendar() {
  setupIpoControls();
  const wrap = byId("ipoTable");
  const meta = byId("ipoMeta");
  if (!wrap) return;
  const payload = window.IPO_CALENDAR;
  if (!payload || !Array.isArray(payload.ipos) || !payload.ipos.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 IPO 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  // 성과 보기: 공모가(offerPrice)가 붙은 데이터가 하나라도 있어야 토글이 나타난다.
  // 아직 파이프라인이 offerPrice 를 안 실어 주면 토글 없이 종전 일정 보기만 남는다.
  const perf = ipoPerfRows(payload);
  const vt = byId("ipoViewToggle");
  if (vt) {
    // 순위 낼 확정 공모가가 하나라도 있어야 '성과' 토글이 뜬다(유닛 IPO만으론 순위 불가).
    const show = perf.ranked.length > 0;
    vt.hidden = !show;
    vt.style.display = show ? "" : "none";
    if (!show && ipoView !== "list") {
      ipoView = "list";
      vt.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x.dataset.view === "list"));
    }
  }
  const stageFilter = byId("ipoStageFilter");
  const perfActive = ipoView === "perf" && perf.ranked.length > 0;
  if (stageFilter) stageFilter.style.display = perfActive ? "none" : "";
  if (perfActive) { renderIpoPerformance(perf, wrap, meta, payload); return; }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · 총 ${Number(payload.count || 0).toLocaleString()}건 · 출처 ${escapeHtml(payload.source || "SEC S-1/424B4")}`;
  const q = ipoQuery.trim().toLowerCase();
  let rows = payload.ipos;
  if (ipoStage !== "all") rows = rows.filter((r) => r.stage === ipoStage);
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  const shown = rows.slice(0, 300);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 IPO가 없습니다.</p>`; return; }
  const cfg = marketCfg();
  const body = shown.map((r) => {
    const sc = r.stage === "priced" ? "ins-buy" : "ins-neutral";
    return `<tr>
      <td class="ins-date">${escapeHtml(r.fileDate || "")}</td>
      <td><span class="ins-code ${sc}">${escapeHtml(r.stageLabel || "")}</span></td>
      <td>${escapeHtml(r.ticker || "—")}</td>
      <td>${escapeHtml(r.company || "")}${ipoOfferNote(r, cfg)}</td>
      <td class="ins-num"><a href="${escapeHtml(r.link || "#")}" target="_blank" rel="noopener">원문</a></td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<div class="insider-count">${rows.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건</div>
    <table class="insider-table table-wide"><thead><tr><th>제출일</th><th>단계</th><th>티커</th><th>회사</th><th class="ins-num">링크</th></tr></thead><tbody>${body}</tbody></table>`;
}

// ===== #3 밸류에이션 랭킹 =====
let valOrder = "asc";
let valQuery = "";
function setupValuationControls() {
  const sectorSel = byId("valSector");
  if (sectorSel && !sectorSel.dataset.filled) {
    sectorSel.dataset.filled = "1";
    const sectors = [...new Set(data.stocks.filter((s) => !isStockEtf(s)).map((s) => s.sector))].sort();
    sectorSel.innerHTML = `<option value="All">전체 섹터</option>` + sectors.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  }
  const capSel = byId("valCap");
  const capKey = isKrMarket() ? "kr" : "us";
  if (capSel && capSel.dataset.marketCapKey !== capKey) {
    capSel.dataset.marketCapKey = capKey;
    const prev = capSel.value;
    const buckets = VAL_CAP_BUCKETS[capKey] || VAL_CAP_BUCKETS.us;
    capSel.innerHTML = buckets.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join("");
    capSel.value = buckets.some(([v]) => v === prev) ? prev : "all";
  }
  ["valMetric", "valSector", "valCap"].forEach((id) => {
    const el = byId(id);
    if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("change", renderValuation); }
  });
  const order = byId("valOrder");
  if (order && !order.dataset.bound) {
    order.dataset.bound = "1";
    order.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      valOrder = b.dataset.order; order.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderValuation();
    }));
  }
  const s = byId("valSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { valQuery = s.value; renderValuation(); }); }
}
function renderValuation() {
  setupValuationControls();
  const wrap = byId("valuationTable");
  const meta = byId("valMeta");
  if (!wrap) return;
  const metric = byId("valMetric")?.value || "pe";
  const sector = byId("valSector")?.value || "All";
  const cap = byId("valCap")?.value || "all";
  const q = valQuery.trim().toLowerCase();
  const cfg = mapMetricConfig(metric) || {};
  const mf = window.MAP_FUNDAMENTALS || {};
  let rows = data.stocks.filter((s) => !isStockEtf(s))
    .filter((s) => sector === "All" || s.sector === sector)
    .filter((s) => bucketMatches(s, s.groups || [s.bucket].filter(Boolean), cap))
    .map((s) => ({ item: s, value: Number((mapFundamentalsFor(s.ticker) || {})[metric]) }))
    .filter((r) => Number.isFinite(r.value) && (metric === "divYield" ? r.value >= 0 : r.value > 0));
  if (q) rows = rows.filter((r) => r.item.ticker.toLowerCase().includes(q) || (r.item.company || "").toLowerCase().includes(q));
  rows.sort((a, b) => (valOrder === "asc" ? a.value - b.value : b.value - a.value));
  const shown = rows.slice(0, 200);
  const krNote = isKrMarket() ? " · 당일 등락은 상하한가 ±30% 기준 표시" : "";
  if (meta) meta.innerHTML = `${rows.length.toLocaleString()}개 종목 · ${cfg.label || metric}${krNote}`;
  if (!shown.length) { wrap.innerHTML = `<p class="muted">펀더멘털 데이터가 있는 종목이 없습니다.</p>`; return; }
  const fmtv = (v) => {
    if (cfg.fmt === "pct") return `${v.toFixed(1)}%`;
    if (cfg.fmt === "usd") return isKrMarket() ? marketCfg().formatMoney(v) : `$${v.toFixed(2)}`;
    return v.toFixed(2);
  };
  const body = shown.map((r, i) => `<tr>
    <td class="ins-date">${i + 1}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.item.ticker)}">${escapeHtml(isKrMarket() ? (r.item.company || r.item.ticker) : r.item.ticker)}</button><div class="ins-sub">${escapeHtml(isKrMarket() ? r.item.ticker : (r.item.company || ""))}</div></td>
    <td class="ins-sub">${escapeHtml(r.item.sector)}</td>
    <td class="ins-num"><strong>${fmtv(r.value)}</strong></td>
    <td class="ins-num">${fmtBillions(itemCapForValuation(r.item))}</td>
    <td class="ins-num ${cls(krDisplayChangePct(r.item.changePct))}">${fmtDailyPct(r.item.changePct)}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>#</th><th>종목</th><th>섹터</th><th class="ins-num">${escapeHtml(cfg.label || metric)}</th><th class="ins-num">${isKrMarket() ? "시총(조)" : "시총"}</th><th class="ins-num">당일</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== #7 공매도 잔고 =====
let shortSort = "dtc";
let shortQuery = "";
let shortMetricView = "balance"; // balance=잔고(T+2) · volume=일일 거래비중(KR_SHORT_VOLUME)
let _krShortVolTried = false;
let _ftdTried = false;

// US 공매도 보기 하단에 붙는 SEC 결제 불이행(FTD) 섹션. 데이터가 없으면 "" —
// 없는 데이터는 화면을 만들지 않는다(정직성).
function ftdSectionHtml() {
  const ftd = window.SEC_FTD;
  if (isKrMarket() || !ftd || !Array.isArray(ftd.top) || !ftd.top.length) return "";
  const rows = ftd.top.slice(0, 15).map((r, i) => {
    const prev = Number(r.prevMaxFails);
    let trend = `<span style="color:var(--muted)">신규</span>`;
    if (Number.isFinite(prev) && prev > 0) {
      const d = (r.maxFails - prev) / prev * 100;
      const col = d > 0 ? "var(--red)" : "var(--green)"; // FTD 증가 = 결제 압박 심화
      trend = `<span style="color:${col}">${d > 0 ? "+" : ""}${d.toFixed(0)}%</span>`;
    }
    return `<tr>
      <td class="ins-date">${i + 1}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.t)}">${escapeHtml(r.company || r.t)}</button><div class="ins-sub">${escapeHtml(r.t)}</div></td>
      <td class="ins-num"><strong>${Number.isFinite(r.pctShares) ? `${r.pctShares.toFixed(2)}%` : "—"}</strong></td>
      <td class="ins-num">${Number(r.maxFails).toLocaleString()}주</td>
      <td class="ins-num">${Number.isFinite(r.valueM) ? `$${r.valueM.toLocaleString()}M` : "—"}</td>
      <td class="ins-num">${trend}</td>
    </tr>`;
  }).join("");
  const period = ftd.period ? `${ftd.period.from} ~ ${ftd.period.to}` : "";
  return `<div style="margin-top:22px">
    <h3 style="font-size:14px;margin:0 0 4px">결제 불이행(FTD) 상위 <span style="font-weight:400;font-size:11.5px;color:var(--muted)">SEC CNS · ${escapeHtml(period)} · 약 2주 지연</span></h3>
    <p style="font-size:var(--fs-cap);color:var(--muted);margin:0 0 8px;line-height:1.65">결제가 실제로 밀린 물량입니다. 급증은 대차 물량 고갈(스퀴즈 압력) 논의에 등장하지만 지연 발행이라 사후 컨텍스트로만 보세요. 발행주식수 대비 %는 시총÷주가 근사값입니다.</p>
    <div style="overflow-x:auto"><table class="insider-table" style="min-width:0"><thead><tr><th>#</th><th>종목</th><th class="ins-num">발행주식 대비</th><th class="ins-num">최대 FTD</th><th class="ins-num">금액</th><th class="ins-num">직전 반월 대비</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}
function setupShortControls() {
  const sort = byId("shortSort");
  if (sort && !sort.dataset.bound) {
    sort.dataset.bound = "1";
    sort.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      shortSort = b.dataset.sort; sort.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderShortInterest();
    }));
  }
  const mtg = byId("shortMetricToggle");
  if (mtg && !mtg.dataset.bound) {
    mtg.dataset.bound = "1";
    mtg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      shortMetricView = b.dataset.metric || "balance";
      mtg.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
      renderShortInterest();
    }));
  }
  const s = byId("shortSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { shortQuery = s.value; renderShortInterest(); }); }
}
// KR(KRX)은 'Days to Cover'가 없다. 잔고비중(공매도잔고÷상장주식수)을 1차 지표로
// 쓰며, 빌더가 payload.metric="balance" 로 표시한다. US 는 종전대로 잔고일수.
function shortIsBalance() { return ((window.SHORT_INTEREST || {}).metric) === "balance"; }

// 정적 HTML(설명·정렬버튼·지연안내)은 US 문구라, KR 잔고비중 모드일 때 갈아끼운다.
function applyShortLabels(isBal) {
  const panel = byId("sub-short");
  if (!panel) return;
  const p = panel.querySelector(".section-title p");
  if (p) p.innerHTML = isBal
    ? `KRX 공매도 종합포털 기반. <b>잔고비중</b>(미상환 공매도 잔고 ÷ 상장주식수)이 높을수록 공매도 압력이 큽니다. <b>T+2 공시</b>라 기준일은 이틀 전입니다.`
    : `FINRA 격주 공시(Nasdaq) 기반. <b>잔고일수(Days to Cover)</b>가 높을수록 숏 커버에 오래 걸려 스퀴즈 가능성이 큽니다. <b>Nasdaq 상장 종목 한정</b>.`;
  const disc = panel.querySelector(".data-disclaimer span");
  if (disc) disc.textContent = isBal
    ? "공매도 잔고는 매 거래일 T+2 로 공시되며 실시간이 아닙니다. 투자 권유가 아닙니다."
    : "공매도 잔고는 한 달에 두 번(격주) 공시되며 실시간이 아닙니다. 투자 권유가 아닙니다.";
  const dtcBtn = panel.querySelector('#shortSort button[data-sort="dtc"]');
  if (dtcBtn) dtcBtn.textContent = isBal ? "잔고비중 높은순" : "잔고일수 높은순";
  // 거래비중 정렬은 KR(잔고 모드)에만 있는 지표라 US 에선 숨긴다.
  const tradeBtn = panel.querySelector('#shortSort button[data-sort="trade"]');
  if (tradeBtn) { tradeBtn.hidden = !isBal; tradeBtn.style.display = isBal ? "" : "none"; }
}

// KR 상위 종목의 공매도 잔고비중 시계열(빌더가 history 로 부착). 잔고 증가=공매도 압력↑
// 이라 상승 추세를 빨강으로 그린다. 없으면 빈 문자열.
function shortSparkline(hist) {
  if (!Array.isArray(hist) || hist.length < 3) return "";
  const vals = hist.map((p) => Number(p.r)).filter(Number.isFinite);
  if (vals.length < 3) return "";
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const W = 62, H = 18, n = vals.length;
  const pts = vals.map((v, i) => `${(i / (n - 1) * W).toFixed(1)},${(H - (v - min) / range * H).toFixed(1)}`).join(" ");
  const col = vals[vals.length - 1] >= vals[0] ? "#e5484d" : "#30a46c";
  return `<svg class="short-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
    + `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

// KR 일일 공매도 거래비중 보기(KR_SHORT_VOLUME). 잔고(T+2)와 별개의 일일 지표라
// 토글로 나눈다. 과열종목(거래소 지정)은 배지로 표시.
function renderKrShortVolume(payload, wrap, meta) {
  const panel = byId("sub-short");
  const p = panel?.querySelector(".section-title p");
  if (p) p.innerHTML = `KRX 일일 공매도 통계 기반. <b>거래비중</b>(당일 공매도 거래대금 ÷ 전체 거래대금)이 높을수록 그날 매도 물량에서 공매도가 차지한 몫이 큽니다. 과열종목은 거래소 지정 기준입니다.`;
  const disc = panel?.querySelector(".data-disclaimer span");
  if (disc) disc.textContent = "일일 공매도 거래비중은 지연 공표되며 실시간이 아닙니다. 투자 권유가 아닙니다.";
  const overheated = new Set(Array.isArray(payload.overheated) ? payload.overheated : []);
  const q = shortQuery.trim().toLowerCase();
  let rows = payload.rows.map((r) => {
    const item = stockByTicker(r.ticker);
    return { ...r, company: (item && item.company) || r.company || r.ticker };
  });
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  rows.sort((a, b) => (Number(b.ratioPct) || 0) - (Number(a.ratioPct) || 0));
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}종목 · 거래일 ${escapeHtml(payload.date || "")}${overheated.size ? ` · 과열 ${overheated.size}종목` : ""}`;
  if (!rows.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 종목이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r, i) => `<tr>
    <td class="ins-date">${i + 1}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)}</div></td>
    <td class="ins-num"><strong>${Number.isFinite(Number(r.ratioPct)) ? `${Number(r.ratioPct).toFixed(2)}%` : "—"}</strong></td>
    <td class="ins-num">${krMoneyEok(r.shortValue)}</td>
    <td>${overheated.has(r.ticker) ? `<span class="ins-code ins-sell">과열</span>` : ""}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>#</th><th>종목</th><th class="ins-num">거래비중</th><th class="ins-num">공매도 거래대금</th><th>과열</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

function renderShortInterest() {
  setupShortControls();
  const wrap = byId("shortTable");
  const meta = byId("shortMeta");
  if (!wrap) return;
  const payload = window.SHORT_INTEREST;
  const isBal = shortIsBalance();
  applyShortLabels(isBal);
  // 일일 거래비중 데이터는 KR 전용·lazy — 탭을 처음 열 때 한 번만 시도한다.
  // 파일이 아직 없으면 조용히 실패하고 토글이 숨은 채 잔고 보기만 남는다.
  if (isKrMarket() && !window.KR_SHORT_VOLUME && !_krShortVolTried) {
    _krShortVolTried = true;
    ensureFeatureData("krShortVolume").then((ok) => { if (ok && searchSubTab === "short") renderShortInterest(); });
  }
  // US 결제 불이행(FTD)도 lazy — 파일이 아직 없으면 조용히 실패하고 섹션이 안 뜬다.
  if (!isKrMarket() && !window.SEC_FTD && !_ftdTried) {
    _ftdTried = true;
    ensureFeatureData("secFtd").then((ok) => { if (ok && searchSubTab === "short") renderShortInterest(); });
  }
  const volPayload = window.KR_SHORT_VOLUME;
  const hasVol = isKrMarket() && isBal && !!(volPayload && Array.isArray(volPayload.rows) && volPayload.rows.length);
  const mtg = byId("shortMetricToggle");
  if (mtg) {
    mtg.hidden = !hasVol;
    mtg.style.display = hasVol ? "" : "none";
    if (!hasVol && shortMetricView !== "balance") {
      shortMetricView = "balance";
      mtg.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x.dataset.metric === "balance"));
    }
  }
  const volActive = hasVol && shortMetricView === "volume";
  const sortGroup = byId("shortSort");
  if (sortGroup) sortGroup.style.display = volActive ? "none" : ""; // 거래비중 보기는 고정 정렬(비중순)
  if (volActive) { renderKrShortVolume(volPayload, wrap, meta); return; }
  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">아직 공매도 데이터가 없습니다. 데이터 수집 후 표시됩니다.</p>`;
    return;
  }
  let invStr = "";
  const inv = payload.investorShort;
  if (isBal && inv && typeof inv === "object") {
    const total = Object.values(inv).reduce((a, b) => a + (Number(b) || 0), 0);
    const parts = ["외국인", "기관", "개인"].filter((k) => inv[k]).map((k) => `${k} ${Math.round(inv[k] / total * 100)}%`);
    if (total > 0 && parts.length) invStr = ` · 시장 공매도 주체(거래대금) ${parts.join(" · ")}`;
  }
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${Number(payload.count || 0).toLocaleString()}종목 · 기준일 ${escapeHtml(payload.settlementDate || "")}${isBal && payload.tradingDate ? ` · 거래일 ${escapeHtml(payload.tradingDate)}` : ""}${invStr}`;
  const q = shortQuery.trim().toLowerCase();
  let rows = payload.rows.slice();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  const primaryKey = isBal ? "balanceRatio" : "daysToCover";
  rows.sort((a, b) => {
    if (shortSort === "change") return (b.changePct ?? -999) - (a.changePct ?? -999);
    if (shortSort === "trade") return (b.tradingRatio ?? -1) - (a.tradingRatio ?? -1);
    return (b[primaryKey] || 0) - (a[primaryKey] || 0);
  });
  const shown = rows.slice(0, 200);
  if (!shown.length) { wrap.innerHTML = `<p class="muted">조건에 맞는 종목이 없습니다.</p>`; return; }
  const body = shown.map((r, i) => {
    const chg = Number.isFinite(r.changePct) ? `${r.changePct > 0 ? "+" : ""}${r.changePct.toFixed(1)}%` : "—";
    const chgCls = r.changePct > 0 ? "ins-sell" : r.changePct < 0 ? "ins-buy" : "";
    const primary = isBal ? `${Number(r.balanceRatio || 0).toFixed(2)}%` : Number(r.daysToCover || 0).toFixed(2);
    const mainLabel = isBal ? (r.company || r.ticker) : r.ticker;
    const subLabel = isBal ? r.ticker : (r.company || "");
    const extra = isBal
      ? `<td class="ins-num short-spark-cell">${shortSparkline(r.history)}</td>`
        + `<td class="ins-num">${Number.isFinite(r.tradingRatio) ? `${r.tradingRatio.toFixed(2)}%` : "—"}</td>`
      : "";
    return `<tr>
      <td class="ins-date">${i + 1}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(mainLabel)}</button><div class="ins-sub">${escapeHtml(subLabel)}</div></td>
      <td class="ins-num"><strong>${primary}</strong></td>
      ${extra}
      <td class="ins-num">${insiderFmtShares(r.shortShares)}</td>
      <td class="ins-num ${chgCls}">${chg}</td>
    </tr>`;
  }).join("");
  const primaryHdr = isBal ? "잔고비중" : "잔고일수";
  const sharesHdr = isBal ? "공매도 잔고" : "공매도 주식수";
  const extraHdr = isBal ? `<th class="ins-num">잔고추이(6주)</th><th class="ins-num">거래비중</th>` : "";
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>#</th><th>종목</th><th class="ins-num">${primaryHdr}</th>${extraHdr}<th class="ins-num">${sharesHdr}</th><th class="ins-num">전기대비</th></tr></thead><tbody>${body}</tbody></table>${ftdSectionHtml()}`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== 자사주 매입·소각 트래커 (KR 전용) =====
// 새 DART 호출 없이 KR_DISCLOSURES(공시 이벤트) + KR_EVENT_DETAILS(취득/처분 주요정보
// 숫자) + 시장 스냅샷(시총)을 조합한다. '결정' 은 규모 숫자가 있고(event_details 가
// tsstkAqDecsn 등을 붙인다), 신탁해지·결과보고는 숫자 없이 사실만 표시한다.
let buybackSort = "size", buybackType = "all", buybackQuery = "", _buybackTried = false;

// 정직성 검증: build_kr_disclosure_stats.py 가 5년치로 공시유형별 '발표 후 초과수익 vs
// 무작위'를 검정해뒀다(41유형 중 무작위 이긴 것 0). 각 트래커 메타에 해당 유형 결과를
// 붙여, '예측 아님'을 문구가 아니라 데이터로 뒷받침한다. 데이터 없으면 빈 문자열.
function krDiscStatNote(type) {
  const st = ((window.KR_DISCLOSURE_STATS || {}).stats || {})[type];
  if (!st || !st.d1 || !Number.isFinite(st.d1.mean)) return "";
  const ev = st.d1.mean;
  const rnd = st.d1.random && Number.isFinite(st.d1.random.mean) ? st.d1.random.mean : null;
  const n = st.sample || st.d1.n || 0;
  return ` · <span class="muted">5년 ${Number(n).toLocaleString()}건 백테스트: 발표 후 D+1 초과수익 ${ev > 0 ? "+" : ""}${ev.toFixed(2)}%${rnd != null ? ` vs 무작위 ${rnd > 0 ? "+" : ""}${rnd.toFixed(2)}%` : ""} — 유의미한 우위 없음</span>`;
}

function buybackCategory(title) {
  const t = title || "";
  if (!t.includes("자기주식")) return null;
  if (t.includes("소각")) return { key: "buy", label: "소각", cls: "ins-buy" };
  if (t.includes("취득신탁계약해지")) return { key: "sell", label: "신탁해지", cls: "ins-sell" };
  if (t.includes("취득신탁계약체결")) return { key: "buy", label: "신탁취득", cls: "ins-buy" };
  if (t.includes("자기주식취득")) return { key: "buy", label: "취득", cls: "ins-buy" };
  if (t.includes("자기주식처분")) return { key: "sell", label: "처분", cls: "ins-sell" };
  return null;
}

function setupBuybackControls() {
  const bind = (id, apply) => {
    const el = byId(id);
    if (el && !el.dataset.bound) {
      el.dataset.bound = "1";
      el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        apply(b); el.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderBuyback();
      }));
    }
  };
  bind("buybackSort", (b) => { buybackSort = b.dataset.sort; });
  bind("buybackType", (b) => { buybackType = b.dataset.type; });
  const s = byId("buybackSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { buybackQuery = s.value; renderBuyback(); }); }
}

// 정적 HTML(sub-buyback)은 KR·DART 문구라, US 모드에선 갈아끼운다(applyDividendPanelLabels 패턴).
function applyBuybackPanelLabels(isUs) {
  const panel = byId("sub-buyback");
  if (!panel) return;
  const p = panel.querySelector(".section-title p");
  if (p) p.innerHTML = isUs
    ? `SEC 8-K 기반. 회사가 <b>자사주 매입(buyback)을 발표</b>한 공시입니다. 규모는 <b>시가총액 대비</b>로 비교합니다. 발표가 매입 완료를 뜻하지 않으며, 예측 신호가 아닙니다.`
    : `DART 주요사항보고 기반. 회사가 <b>자기주식을 취득</b>(주주환원·주가부양)하거나 처분·소각한 <b>공시 사실</b>입니다. 규모는 <b>시가총액 대비</b>로 비교합니다. 예측 신호가 아닙니다.`;
  const disc = panel.querySelector(".data-disclaimer span");
  if (disc) disc.textContent = isUs
    ? "최근 8-K 공시분만 표시하며 실시간이 아닙니다. 발표된 한도는 기간에 걸쳐 집행되며 전액 집행된다는 보장이 없습니다. 투자 권유가 아닙니다."
    : "최근 공시분만 표시하며 실시간이 아닙니다. 취득 '결정'이 매입 완료를 뜻하지 않습니다(신탁·장내 취득은 기간에 걸쳐 집행). 투자 권유가 아닙니다.";
  // 취득/처분 유형 필터는 KR(DART) 전용 분류라 US 에선 숨긴다.
  const typeGroup = byId("buybackType");
  if (typeGroup) typeGroup.style.display = isUs ? "none" : "";
  // US 는 발표 피드 성격이라 최신순이 기본. 시장 첫 진입 때 한 번만 맞춘다.
  if (isUs && panel.dataset.usSortDefaulted !== "1") {
    panel.dataset.usSortDefaulted = "1";
    buybackSort = "date";
    panel.querySelectorAll("#buybackSort button").forEach((b) => b.classList.toggle("is-active", b.dataset.sort === "date"));
  }
}

// ===== US 자사주 발표 트래커 =====
// material_events(8-K) 중 kind==="buyback" 행 + 스냅샷 시총으로 시총대비 %를 계산한다.
// 데이터가 아직 없으면 서브탭 자체가 숨겨져(searchSubTabHidden) 여기까지 오지 않는다.
function renderUsBuybacks() {
  applyBuybackPanelLabels(true);
  const wrap = byId("buybackTable");
  const meta = byId("buybackMeta");
  if (!wrap) return;
  const events = usBuybackRows();
  if (!events.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">최근 8-K 공시분에서 자사주 매입 발표를 찾지 못했습니다.</p>`;
    return;
  }
  let rows = events.map((e) => {
    const item = stockByTicker(e.ticker);
    const amount = Number(e.amountUsd);
    const capB = Number(item?.marketCapB);
    const hasAmt = Number.isFinite(amount) && amount > 0;
    return {
      ticker: e.ticker,
      company: item?.company || e.company || "",
      date: e.fileDate || "",
      amount: hasAmt ? amount : null,
      capPct: (hasAmt && Number.isFinite(capB) && capB > 0) ? amount / (capB * 1e9) * 100 : null,
      title: (e.items || []).map((i) => i && i.label).filter(Boolean).join(", ") || "8-K 원문",
      link: e.link || "#",
    };
  });
  const q = buybackQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (buybackSort === "size") rows.sort((a, b) => (b.capPct ?? -1) - (a.capPct ?? -1));
  else rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  // 2026-09-04 실측: 190건 중 144건이 금액을 못 뽑은 8-K(제목도 '실적 발표…' 같은
  // 일반 항목)라 표가 '—' 로 가득했다. 금액이 확인된 발표만 기본으로 보이고,
  // 미확인분은 건수를 밝힌 뒤 원하면 펼친다. 한 번에 50행, 나머지는 '더 보기'.
  const withAmt = rows.filter((r) => r.amount != null);
  const noAmt = rows.length - withAmt.length;
  const shownRows = buybackShowAll ? rows : withAmt;
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml((window.MATERIAL_EVENTS || {}).updatedAtKst || "")} · 금액 확인 ${withAmt.length}건`
    + (noAmt ? ` · 금액 미확인 ${noAmt}건 <button type="button" class="link-btn" id="buybackToggleAll">${buybackShowAll ? "숨기기" : "포함해 보기"}</button>` : "")
    + ` · 출처 SEC 8-K`;
  byId("buybackToggleAll")?.addEventListener("click", () => { buybackShowAll = !buybackShowAll; buybackLimit = 50; renderUsBuybacks(); });
  if (!shownRows.length) { wrap.innerHTML = `<p class="muted">${withAmt.length ? "조건에 맞는 발표가 없습니다." : "금액이 확인된 자사주 발표가 없습니다. 위에서 미확인분을 펼쳐 볼 수 있습니다."}</p>`; return; }
  const body = shownRows.slice(0, buybackLimit).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.ticker)}</button><div class="ins-sub">${escapeHtml(r.company)}</div></td>
    <td class="ins-num"><strong>${r.capPct != null ? `${r.capPct.toFixed(2)}%` : "—"}</strong></td>
    <td class="ins-num">${r.amount != null ? insiderFmtUsd(r.amount) : "—"}</td>
    <td><a href="${escapeHtml(r.link)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a></td>
  </tr>`).join("");
  const remain = shownRows.length - buybackLimit;
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>발표일</th><th>종목</th><th class="ins-num">시총대비</th><th class="ins-num">금액</th><th>공시</th></tr></thead><tbody>${body}</tbody></table>`
    + (remain > 0 ? `<button type="button" class="ghost compact-btn list-more-btn" id="buybackMore">더 보기 (남은 ${remain}건)</button>` : "");
  delegateTickerClicks(wrap, ".ins-ticker");
  byId("buybackMore")?.addEventListener("click", () => { buybackLimit += 100; renderUsBuybacks(); });
}

let buybackShowAll = false;
let buybackLimit = 50;

function renderBuyback() {
  setupBuybackControls();
  if (!isKrMarket()) { renderUsBuybacks(); return; }
  applyBuybackPanelLabels(false);
  const wrap = byId("buybackTable");
  const meta = byId("buybackMeta");
  if (!wrap) return;
  if (!window.KR_DISCLOSURES && !_buybackTried) {
    _buybackTried = true;
    wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krDart"), ensureFeatureData("krEventDetails"), ensureFeatureData("krDiscStats")]).then(renderBuyback);
    return;
  }
  const disc = ((window.KR_DISCLOSURES || {}).disclosures) || [];
  const details = (window.KR_EVENT_DETAILS || {}).details || {};
  const capByTicker = {};
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  stocks.forEach((s) => { if (s.ticker) capByTicker[s.ticker] = Number(s.marketCapT ?? s.marketCapB ?? 0); });
  const rcpt = (link) => { const m = /rcpNo=(\d+)/.exec(link || ""); return m ? m[1] : ""; };

  let rows = [];
  for (const d of disc) {
    const cat = buybackCategory(d.title);
    if (!cat) continue;
    const det = details[rcpt(d.link)] || {};
    const amount = Number(det.amount) || null;          // 원
    const capT = capByTicker[d.ticker] || null;         // 조원
    rows.push({
      ticker: d.ticker, company: d.company || d.ticker, date: d.fileDate || "",
      type: cat.label, typeKey: cat.key, cls: cat.cls,
      shares: Number(det.shares) || null, amount,
      capPct: (amount && capT) ? (amount / (capT * 1e12) * 100) : null,
      purpose: det.purpose || "",
    });
  }
  if (buybackType !== "all") rows = rows.filter((r) => r.typeKey === buybackType);
  const q = buybackQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (buybackSort === "date") rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else rows.sort((a, b) => (b.capPct ?? -1) - (a.capPct ?? -1));

  const buyN = rows.filter((r) => r.typeKey === "buy").length;
  const sellN = rows.length - buyN;
  if (meta) meta.innerHTML = rows.length
    ? `업데이트 ${escapeHtml((window.KR_DISCLOSURES || {}).updatedAtKst || "")} · 매입/소각 ${buyN}건 · 처분/해지 ${sellN}건${krDiscStatNote("자기주식")}`
    : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 자사주 취득·처분 공시가 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)}${r.purpose ? ` · ${escapeHtml(r.purpose)}` : ""}</div></td>
    <td class="ins-sub ${r.cls}">${escapeHtml(r.type)}</td>
    <td class="ins-num"><strong>${r.capPct != null ? `${r.capPct.toFixed(2)}%` : "—"}</strong></td>
    <td class="ins-num">${r.amount != null ? `${(r.amount / 1e8).toLocaleString(undefined, { maximumFractionDigits: 0 })}억` : "—"}</td>
    <td class="ins-num">${r.shares != null ? insiderFmtShares(r.shares) : "—"}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>공시일</th><th>종목</th><th>유형</th><th class="ins-num">시총대비</th><th class="ins-num">금액</th><th class="ins-num">주식수</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== 실적 발표(잠정) · 주가반응 (KR 전용) =====
// build_kr_earnings_reactions.py 가 만든 KR_EARNINGS_REACTIONS(잠정실적 공시 + 발표일·
// 익일 등락률)를 그대로 표로 보여준다. 예측 신호가 아니라 사실 피드다.
let earnReactSort = "date", earnReactQuery = "", _earnReactTried = false;

function setupEarnReactControls() {
  const sort = byId("earnReactSort");
  if (sort && !sort.dataset.bound) {
    sort.dataset.bound = "1";
    sort.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      earnReactSort = b.dataset.sort; sort.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); renderEarningsReactions();
    }));
  }
  const s = byId("earnReactSearch");
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { earnReactQuery = s.value; renderEarningsReactions(); }); }
}

// 정적 HTML(sub-earnreact)은 KR·DART 문구라, US 모드에선 갈아끼운다.
function applyEarnReactPanelLabels(isUs) {
  const panel = byId("sub-earnreact");
  if (!panel) return;
  const h2 = panel.querySelector(".section-title h2");
  if (h2) h2.textContent = isUs ? "실적 발표 · 주가반응" : "실적 발표(잠정) · 주가반응";
  const p = panel.querySelector(".section-title p");
  if (p) p.innerHTML = isUs
    ? `Yahoo 실적 이력 기반. 시총 상위 종목의 <b>EPS 서프라이즈</b>와 <b>발표일(D0)·익일(D+1) 종가 등락률</b>입니다. 장 마감 후 발표는 반응이 주로 익일에 나타납니다. 예측 신호가 아닙니다.`
    : `DART '영업(잠정)실적' 공시 기반. 회사가 <b>실적을 발표한 사실</b>과 <b>발표일·익일 등락률</b>입니다. 잠정 숫자는 공시 본문에만 있어 제외. 예측 신호가 아닙니다.`;
  const disc = panel.querySelector(".data-disclaimer span");
  if (disc) disc.textContent = isUs
    ? "발표일·등락률은 저장된 일봉 종가 기준이며 실시간이 아닙니다. 과거 반응이 반복된다는 보장은 없습니다. 투자 권유가 아닙니다."
    : "공시 유형별 과거 반응은 무작위와 구분되지 않습니다(잠정실적 포함). 발표 후 주가 움직임을 보여줄 뿐 투자 권유가 아닙니다.";
}

// ===== US 실적발표 반응 트래커 =====
// ANALYST_CONSENSUS 로 '최근에 실적을 낸 시총 상위 종목' 50개를 고르고, 각 종목의
// 상세파일(earningsHistory=실제 발표일 + chartSeries=일봉)에서 발표일(D0)·익일(D+1)
// 종가 등락률을 계산한다. 컨센서스의 period 는 분기말이라 발표일이 아니다 —
// 실제 발표일은 상세파일 earningsHistory.date 를 쓴다. 동시요청 6개 제한, 메모리 캐시.
// 스냅샷 날짜로 키를 잡는다 — 페이지를 안 닫고 다음날 스냅샷이 갱신되면(장기 세션·PWA)
// 어제 결과가 그대로 남던 것을 막는다.
let _usEarnReactCache = null; // { key: 스냅샷 날짜, rows }
let _usEarnReactLoading = false;
function usEarnReactCacheKey() {
  return `us:${String((data && (data.updatedAtKst || data.updated_at_kst)) || "")}`;
}

async function buildUsEarnReactRows() {
  await ensureFeatureData("analystConsensus");
  const stocks = (window.ANALYST_CONSENSUS || {}).stocks || {};
  const capOf = (t) => Number(stockByTicker(t)?.marketCapB) || 0;
  const cands = Object.keys(stocks)
    .map((t) => { const e = (stocks[t].earnings || [])[0]; return e && e.period ? { t, period: e.period } : null; })
    .filter(Boolean)
    .sort((a, b) => b.period.localeCompare(a.period) || capOf(b.t) - capOf(a.t))
    .slice(0, 50);
  const today = formatKstDateTime().slice(0, 10);
  const cutoff = new Date(new Date(`${today}T00:00:00`).getTime() - 210 * 86400000).toISOString().slice(0, 10);
  const rows = [];
  let idx = 0;
  const worker = async () => {
    while (idx < cands.length) {
      const { t } = cands[idx++];
      let det = null;
      try { det = await loadStockDetail(t); } catch (_) { det = null; }
      const hist = det && det.earningsHistory;
      const series = det && det.chartSeries;
      if (!Array.isArray(hist) || !Array.isArray(series) || series.length < 3) continue;
      hist.slice(-2).forEach((e) => {
        if (!e.date || e.date > today || e.date < cutoff) return;
        // 발표일 이후 첫 거래일(D0) 종가 대 전일 종가, 그다음 거래일(D+1) — 종가 대 종가
        const i0 = series.findIndex((r) => (r[5] || "") >= e.date);
        if (i0 <= 0) return;
        const close = (k) => Number(series[k] && series[k][3]);
        const d0 = Number.isFinite(close(i0)) && close(i0 - 1) ? (close(i0) / close(i0 - 1) - 1) * 100 : null;
        const d1 = Number.isFinite(close(i0 + 1)) && close(i0) ? (close(i0 + 1) / close(i0) - 1) * 100 : null;
        rows.push({
          ticker: t,
          company: det.company || stockByTicker(t)?.company || "",
          date: e.date,
          surprise: Number.isFinite(Number(e.surprisePct)) ? Number(e.surprisePct) : null,
          d0, d1,
        });
      });
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

function renderUsEarningsReactions() {
  const wrap = byId("earnReactTable");
  const meta = byId("earnReactMeta");
  if (!wrap) return;
  applyEarnReactPanelLabels(true);
  const cacheKey = usEarnReactCacheKey();
  if (!_usEarnReactCache || _usEarnReactCache.key !== cacheKey) {
    if (!_usEarnReactLoading) {
      _usEarnReactLoading = true;
      if (meta) meta.innerHTML = "";
      wrap.innerHTML = '<p class="muted">최근 실적을 발표한 시총 상위 종목의 주가 데이터를 불러오는 중… (최대 50종목)</p>';
      buildUsEarnReactRows().then((rows) => {
        _usEarnReactCache = { key: cacheKey, rows };
        _usEarnReactLoading = false;
        if (!isKrMarket() && searchSubTab === "earnreact") renderUsEarningsReactions();
      }).catch(() => { _usEarnReactLoading = false; });
    }
    return;
  }
  let rows = _usEarnReactCache.rows.slice();
  const q = earnReactQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.ticker.toLowerCase().includes(q) || r.company.toLowerCase().includes(q));
  if (earnReactSort === "react") rows.sort((a, b) => Math.max(Math.abs(b.d0 ?? 0), Math.abs(b.d1 ?? 0)) - Math.max(Math.abs(a.d0 ?? 0), Math.abs(a.d1 ?? 0)));
  else rows.sort((a, b) => b.date.localeCompare(a.date));
  if (meta) meta.innerHTML = rows.length
    ? `업데이트 ${escapeHtml((window.ANALYST_CONSENSUS || {}).updatedAtKst || "")} · 최근 발표 ${rows.length}건 · 시총 상위 50종목 · 종가 기준`
    : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 실적 발표 데이터가 없습니다.</p>`; return; }
  const pctCell = (v) => Number.isFinite(v) ? `<span class="${v > 0 ? "ins-buy" : v < 0 ? "ins-sell" : ""}">${v > 0 ? "+" : ""}${v.toFixed(1)}%</span>` : "—";
  const body = rows.slice(0, 100).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.ticker)}</button><div class="ins-sub">${escapeHtml(r.company)}</div></td>
    <td class="ins-num">${r.surprise != null ? `<strong class="${r.surprise > 0 ? "ins-buy" : r.surprise < 0 ? "ins-sell" : ""}">${r.surprise > 0 ? "+" : ""}${r.surprise.toFixed(1)}%</strong>` : "—"}</td>
    <td class="ins-num">${pctCell(r.d0)}</td>
    <td class="ins-num">${pctCell(r.d1)}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>발표일</th><th>종목</th><th class="ins-num">EPS 서프라이즈</th><th class="ins-num">발표일 등락</th><th class="ins-num">익일 등락</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

function renderEarningsReactions() {
  setupEarnReactControls();
  if (!isKrMarket()) { renderUsEarningsReactions(); return; }
  applyEarnReactPanelLabels(false);
  const wrap = byId("earnReactTable");
  const meta = byId("earnReactMeta");
  if (!wrap) return;
  if (!window.KR_EARNINGS_REACTIONS && !_earnReactTried) {
    _earnReactTried = true;
    wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krEarningsReact"), ensureFeatureData("krDiscStats")]).then(renderEarningsReactions);
    return;
  }
  const payload = window.KR_EARNINGS_REACTIONS || {};
  let rows = (payload.rows || []).slice();
  const q = earnReactQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (earnReactSort === "react") rows.sort((a, b) => Math.abs(b.dayPct ?? 0) - Math.abs(a.dayPct ?? 0));
  else rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}건 발표${krDiscStatNote("잠정실적")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 잠정실적 발표가 없습니다.</p>`; return; }
  // 주가 상승=초록(ins-buy)·하락=빨강(ins-sell). 공매도 패널과 방향이 반대인 데 주의.
  const pct = (v) => Number.isFinite(v) ? `<span class="${v > 0 ? "ins-buy" : v < 0 ? "ins-sell" : ""}">${v > 0 ? "+" : ""}${v.toFixed(1)}%</span>` : "—";
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)} · ${r.consolidated ? "연결" : "별도"}</div></td>
    <td class="ins-num">${pct(r.dayPct)}</td>
    <td class="ins-num">${pct(r.nextPct)}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>공시일</th><th>종목</th><th class="ins-num">공시일 등락</th><th class="ins-num">익일 등락</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== 배당 캘린더 (KR 전용) =====
// build_kr_corp_disclosures.py 가 배당결정 공시 원문에서 파싱한 KR_DIVIDENDS
// (1주당 배당금·시가배당률·배당기준일·지급예정일)를 그대로 표로 보여준다.
let dividendSort = "record", dividendQuery = "", _dividendTried = false;
function bindListControls(sortId, searchId, setSort, setQuery, rerender) {
  const sort = byId(sortId);
  if (sort && !sort.dataset.bound) {
    sort.dataset.bound = "1";
    sort.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      setSort(b.dataset.sort); sort.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b)); rerender();
    }));
  }
  const s = byId(searchId);
  if (s && !s.dataset.bound) { s.dataset.bound = "1"; s.addEventListener("input", () => { setQuery(s.value); rerender(); }); }
}
function krMoneyEok(won) {
  const n = Number(won);
  if (!Number.isFinite(n) || n === 0) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}조`;
  return `${Math.round(n / 1e8).toLocaleString()}억`;
}
// 정적 HTML(sub-dividend)은 KR·DART 문구라, US 모드에선 갈아끼운다(applyShortLabels 패턴).
function applyDividendPanelLabels(isUs) {
  const panel = byId("sub-dividend");
  if (!panel) return;
  const p = panel.querySelector(".section-title p");
  if (p) p.innerHTML = isUs
    ? `Yahoo 배당 캘린더 기반. <b>배당수익률·연간 배당금</b>과 <b>배당락일(Ex-Date)</b>·배당성향입니다. 배당락일 전일까지 매수해야 해당 배당을 받습니다. 공시된 사실이며 투자 권유가 아닙니다.`
    : `DART '현금·현물배당결정' 공시 원문에서 파싱. <b>시가배당률·주당배당금</b>과 <b>배당기준일(배당락 근거)·지급예정일</b>입니다. 공시된 사실이며 투자 권유가 아닙니다.`;
  const disc = panel.querySelector(".data-disclaimer span");
  if (disc) disc.textContent = isUs
    ? "시가총액 상위 종목만 수집합니다. 배당락일·다음 실적일은 예정일이며 변경될 수 있습니다. 투자 권유가 아닙니다."
    : "최근 공시분만 표시합니다. 배당기준일 전전영업일이 배당락일입니다. 공시 원문 파싱이라 일부 값이 비어 있을 수 있습니다.";
  const recordBtn = panel.querySelector('#dividendSort button[data-sort="record"]');
  if (recordBtn) recordBtn.textContent = isUs ? "배당락일 임박순" : "배당기준일 임박순";
  const yieldBtn = panel.querySelector('#dividendSort button[data-sort="yield"]');
  if (yieldBtn) yieldBtn.textContent = isUs ? "배당수익률 높은순" : "시가배당률 높은순";
}

// ===== US 배당 캘린더 =====
// us_calendar.js(US_STOCK_CALENDAR)의 배당수익률·연간배당금·배당락일·배당성향을
// D-day 순으로 나열한다. KR 배당(DART) 탭과 같은 자리·같은 컨트롤을 공유한다.
let _usDividendTried = false;
function renderUsDividends() {
  const wrap = byId("dividendTable"); const meta = byId("dividendMeta");
  if (!wrap) return;
  applyDividendPanelLabels(true);
  if (!window.US_STOCK_CALENDAR && !_usDividendTried) {
    _usDividendTried = true; wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    ensureFeatureData("usCalendar").then(renderUsDividends); return;
  }
  const payload = window.US_STOCK_CALENDAR || {};
  const stocks = payload.stocks || {};
  const today = formatKstDateTime().slice(0, 10);
  let rows = Object.entries(stocks)
    .filter(([, c]) => Number.isFinite(Number(c.divYield)) || c.exDate)
    .map(([t, c]) => {
      const item = stockByTicker(t);
      const future = c.exDate && c.exDate >= today;
      return {
        ticker: t, company: item?.company || "",
        divYield: Number(c.divYield), divRate: Number(c.divRate), payout: Number(c.payout),
        exDate: c.exDate || "", future,
        dd: future ? myEventDday(c.exDate, today) : null,
        nextEarnings: c.nextEarnings || "",
      };
    });
  const q = dividendQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.ticker.toLowerCase().includes(q) || r.company.toLowerCase().includes(q));
  if (dividendSort === "yield") rows.sort((a, b) => (Number.isFinite(b.divYield) ? b.divYield : -1) - (Number.isFinite(a.divYield) ? a.divYield : -1));
  else rows.sort((a, b) => {
    // 다가오는 배당락 D-day 임박순 → 그다음 지난 배당락 최신순 → 배당락 없는 종목
    if (a.future !== b.future) return a.future ? -1 : 1;
    if (a.future) return a.exDate.localeCompare(b.exDate);
    if (!!a.exDate !== !!b.exDate) return a.exDate ? -1 : 1;
    return b.exDate.localeCompare(a.exDate);
  });
  const upcoming = rows.filter((r) => r.future).length;
  if (meta) meta.innerHTML = rows.length
    ? `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}종목 · 다가오는 배당락 ${upcoming}건`
    : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">배당 데이터가 있는 종목이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => {
    const ex = r.exDate
      ? (r.future
        ? `${escapeHtml(r.exDate)} <span class="ins-code ins-buy">${escapeHtml(myEventBadge(r.dd))}</span>`
        : `${escapeHtml(r.exDate)} <span class="ins-sub">지남</span>`)
      : "—";
    return `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.ticker)}</button><div class="ins-sub">${escapeHtml(r.company)}</div></td>
    <td class="ins-num"><strong>${Number.isFinite(r.divYield) ? `${r.divYield.toFixed(2)}%` : "—"}</strong></td>
    <td class="ins-num">${Number.isFinite(r.divRate) ? `$${r.divRate.toFixed(2)}` : "—"}</td>
    <td class="ins-date">${ex}</td>
    <td class="ins-num">${Number.isFinite(r.payout) ? `${r.payout.toFixed(1)}%` : "—"}</td>
    <td class="ins-date">${escapeHtml(r.nextEarnings || "—")}</td>
  </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>종목</th><th class="ins-num">배당수익률</th><th class="ins-num">연간 배당금</th><th>배당락일</th><th class="ins-num">배당성향</th><th>다음 실적</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

function renderDividends() {
  bindListControls("dividendSort", "dividendSearch", (v) => dividendSort = v, (v) => dividendQuery = v, renderDividends);
  if (!isKrMarket()) { renderUsDividends(); return; }
  applyDividendPanelLabels(false);
  const wrap = byId("dividendTable"); const meta = byId("dividendMeta");
  if (!wrap) return;
  if (!window.KR_DIVIDENDS && !_dividendTried) {
    _dividendTried = true; wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krDividends"), ensureFeatureData("krDiscStats")]).then(renderDividends); return;
  }
  const payload = window.KR_DIVIDENDS || {};
  let rows = (payload.rows || []).slice();
  const q = dividendQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (dividendSort === "yield") rows.sort((a, b) => (b.yieldPct ?? -1) - (a.yieldPct ?? -1));
  else rows.sort((a, b) => (a.recordDate || "9999").localeCompare(b.recordDate || "9999")); // 배당락 임박순
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}건${krDiscStatNote("배당")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 배당 결정이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)} · ${escapeHtml(r.divKind || "배당")}</div></td>
    <td class="ins-num"><strong>${Number.isFinite(r.yieldPct) ? `${r.yieldPct.toFixed(2)}%` : "—"}</strong></td>
    <td class="ins-num">${Number.isFinite(r.dps) ? `₩${Number(r.dps).toLocaleString()}` : "—"}</td>
    <td class="ins-date">${escapeHtml(r.recordDate || "—")}</td>
    <td class="ins-date">${escapeHtml(r.payDate || "—")}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>종목</th><th class="ins-num">시가배당률</th><th class="ins-num">주당배당금</th><th>배당기준일</th><th>지급예정일</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== 공급계약(수주) 트래커 (KR 전용) =====
let contractSort = "ratio", contractQuery = "", _contractTried = false;
function renderContracts() {
  bindListControls("contractSort", "contractSearch", (v) => contractSort = v, (v) => contractQuery = v, renderContracts);
  const wrap = byId("contractTable"); const meta = byId("contractMeta");
  if (!wrap) return;
  if (!window.KR_CONTRACTS && !_contractTried) {
    _contractTried = true; wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krContracts"), ensureFeatureData("krDiscStats")]).then(renderContracts); return;
  }
  // 나라장터 정부수주(별도 파일)도 lazy — 없으면 섹션이 안 뜬다.
  if (!window.KR_GOV_CONTRACTS && !_govContractsTried) {
    _govContractsTried = true;
    ensureFeatureData("krGovContracts").then((ok) => { if (ok && searchSubTab === "contract") renderContracts(); });
  }
  const payload = window.KR_CONTRACTS || {};
  let rows = (payload.rows || []).slice();
  const q = contractQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (contractSort === "date") rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else rows.sort((a, b) => (b.salesRatio ?? -1) - (a.salesRatio ?? -1));
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}건${krDiscStatNote("공급계약")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 공급계약이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => {
    const period = (r.startDate || r.endDate) ? `${escapeHtml(r.startDate || "")}~${escapeHtml(r.endDate || "")}` : "";
    return `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)}${r.counterparty ? ` · ${escapeHtml(r.counterparty)}` : ""}</div></td>
    <td class="ins-num"><strong>${Number.isFinite(r.salesRatio) ? `${r.salesRatio.toFixed(1)}%` : "—"}</strong></td>
    <td class="ins-num">${krMoneyEok(r.amount)}</td>
    <td class="ins-date">${escapeHtml(r.date || "")}<div class="ins-sub">${period}</div></td>
  </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>종목 · 계약상대</th><th class="ins-num">매출대비</th><th class="ins-num">계약금액</th><th>공시일 · 기간</th></tr></thead><tbody>${body}</tbody></table>${govContractsSectionHtml()}`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

let _govContractsTried = false;

// 수주 탭 하단에 붙는 나라장터 정부조달 낙찰 섹션. DART 공급계약 공시(의무공시 대형
// 계약)와 달리 공시 문턱 아래의 정부 계약까지 잡힌다. 상장사 상호 정확 일치분만
// 발행(빌더에서 필터) — 데이터 없으면 "".
function govContractsSectionHtml() {
  const gov = window.KR_GOV_CONTRACTS;
  if (!gov || !Array.isArray(gov.byTicker) || !gov.byTicker.length) return "";
  const topRows = gov.byTicker.slice(0, 12).map((r, i) => `<tr>
    <td class="ins-date">${i + 1}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company || r.ticker)}</button><div class="ins-sub">${escapeHtml(r.ticker)}</div></td>
    <td class="ins-num"><strong>${Number(r.totalB).toLocaleString()}억</strong></td>
    <td class="ins-num">${Number(r.count).toLocaleString()}건</td>
    <td class="ins-date">${escapeHtml(r.lastDate || "")}</td>
  </tr>`).join("");
  const recent = (gov.awards || []).slice(0, 10).map((a) => `<tr>
    <td class="ins-date">${escapeHtml(a.date || "")}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(a.ticker)}">${escapeHtml(a.company || a.ticker)}</button><div class="ins-sub">${escapeHtml(a.agency || "")}</div></td>
    <td>${escapeHtml((a.title || "").slice(0, 46))}${(a.title || "").length > 46 ? "…" : ""}</td>
    <td class="ins-num">${Number.isFinite(a.amountB) ? `${Number(a.amountB).toLocaleString()}억` : "—"}</td>
  </tr>`).join("");
  return `<div style="margin-top:22px">
    <h3 style="font-size:14px;margin:0 0 4px">정부조달 낙찰 (나라장터) <span style="font-weight:400;font-size:11.5px;color:var(--muted)">최근 90일 · 상장사 매칭분 · ${escapeHtml(gov.updatedAtKst || "")}</span></h3>
    <p style="font-size:var(--fs-cap);color:var(--muted);margin:0 0 8px;line-height:1.65">공시 의무 문턱 아래의 정부 계약까지 잡힙니다. 상호가 정확히 일치하는 상장사만 실으므로 영문·한글 표기가 다른 일부 대기업 건은 빠질 수 있습니다.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
      <div style="overflow-x:auto"><div style="font-size:var(--fs-cap);color:var(--muted);margin-bottom:4px">누적 수주 상위</div><table class="insider-table" style="min-width:0"><thead><tr><th>#</th><th>종목</th><th class="ins-num">누적 낙찰액</th><th class="ins-num">건수</th><th>최근</th></tr></thead><tbody>${topRows}</tbody></table></div>
      <div style="overflow-x:auto"><div style="font-size:var(--fs-cap);color:var(--muted);margin-bottom:4px">최근 낙찰</div><table class="insider-table" style="min-width:0"><thead><tr><th>낙찰일</th><th>종목 · 발주기관</th><th>사업명</th><th class="ins-num">금액</th></tr></thead><tbody>${recent}</tbody></table></div>
    </div>
  </div>`;
}

// ===== 증자·CB 희석(오버행) 트래커 (KR 전용) =====
// 자사주(매입=환원)의 정반대 리스크. KR_DISCLOSURES(유상증자·CB·BW·EB 발행결정) +
// KR_EVENT_DETAILS(희석률·전환가·발행금액, build_kr_event_details.py 가 이미 파싱) +
// 시총을 프론트에서 조합한다. 새 백엔드 0.
let dilutionSort = "dilution", dilutionQuery = "", _dilutionTried = false;
function dilutionCategory(title) {
  const t = title || "";
  if (t.includes("유상증자결정")) return { key: "증자", label: "유상증자" };
  if (t.includes("전환사채권발행")) return { key: "CB", label: "전환사채(CB)" };
  if (t.includes("신주인수권부사채권발행")) return { key: "BW", label: "신주인수권부사채(BW)" };
  if (t.includes("교환사채권발행")) return { key: "EB", label: "교환사채(EB)" };
  return null;
}
// 정적 HTML(sub-dilution)은 KR·DART 문구라, US 모드에선 갈아끼운다.
function applyDilutionPanelLabels(isUs) {
  const panel = byId("sub-dilution");
  if (!panel) return;
  const p = panel.querySelector(".section-title p");
  if (p) p.innerHTML = isUs
    ? `SEC 등록서류 기반. <b>S-3(일괄등록)</b>·<b>S-3ASR(자동일괄등록)</b>·<b>424B5(발행 확정)</b> 등 신주 발행으로 <b>기존 주주가 희석</b>될 수 있는 공시입니다. 424B5는 실제 발행에 가장 가깝습니다. 예측 신호가 아닙니다.`
    : `DART 주요사항보고 기반. 유상증자·전환사채(CB)·신주인수권부사채(BW)·교환사채(EB) 발행으로 <b>주식수가 늘어 기존 주주가 희석</b>되는 공시입니다. <b>희석률</b>이 클수록 영향이 큽니다. 자사주 매입의 반대편 리스크이며, 예측 신호가 아닙니다.`;
  const disc = panel.querySelector(".data-disclaimer span");
  if (disc) disc.textContent = isUs
    ? "등록·발행 서류의 제출 사실이며, 실제 발행 규모·시점은 다를 수 있습니다(S-3 일괄등록은 즉시 발행이 아닙니다). 투자 권유가 아닙니다."
    : "최근 공시분만 표시합니다. 전환·행사가는 CB/BW의 잠재 희석 기준입니다. 발행 '결정'이며 최종 발행·전환 규모는 달라질 수 있습니다. 투자 권유가 아닙니다.";
  // 희석률 정렬은 KR(DART 상세 숫자) 전용이라 US 에선 숨긴다.
  const dilBtn = panel.querySelector('#dilutionSort button[data-sort="dilution"]');
  if (dilBtn) { dilBtn.hidden = isUs; dilBtn.style.display = isUs ? "none" : ""; }
  // US 는 제출 피드 성격이라 최신순이 기본. 시장 첫 진입 때 한 번만 맞춘다.
  if (isUs && panel.dataset.usSortDefaulted !== "1") {
    panel.dataset.usSortDefaulted = "1";
    if (dilutionSort === "dilution") dilutionSort = "date";
    panel.querySelectorAll("#dilutionSort button").forEach((b) => b.classList.toggle("is-active", b.dataset.sort === dilutionSort));
  }
}

// ===== US 증자·희석(오버행) 트래커 =====
// build 파이프라인의 us_dilution.js(US_DILUTION: S-3/S-3ASR/424B5 제출)를 그대로 표로.
// 데이터가 아직 없으면 서브탭 자체가 숨겨져(searchSubTabHidden) 여기까지 오지 않는다.
function renderUsDilution() {
  applyDilutionPanelLabels(true);
  const wrap = byId("dilutionTable"); const meta = byId("dilutionMeta");
  if (!wrap) return;
  const payload = window.US_DILUTION || {};
  let rows = (Array.isArray(payload.rows) ? payload.rows : []).map((r) => {
    const item = stockByTicker(r.ticker);
    const amount = Number(r.amountUsd);
    return {
      ticker: r.ticker,
      company: item?.company || r.company || "",
      formType: r.formType || "",
      date: r.fileDate || "",
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      title: r.title || "원문",
      url: r.url || "#",
    };
  });
  if (!rows.length) {
    if (meta) meta.innerHTML = "";
    wrap.innerHTML = `<p class="muted">최근 등록·발행 공시가 없습니다.</p>`;
    return;
  }
  const q = dilutionQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q));
  if (dilutionSort === "amount") rows.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1));
  else rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (meta) meta.innerHTML = `업데이트 ${escapeHtml(payload.updatedAtKst || "")} · ${rows.length}건 · 출처 ${escapeHtml(payload.source || "SEC EDGAR")}`;
  const formCls = (f) => (/424B5/i.test(f) ? "ins-sell" : "ins-neutral");
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.ticker)}</button><div class="ins-sub">${escapeHtml(r.company)}</div></td>
    <td><span class="ins-code ${formCls(r.formType)}">${escapeHtml(r.formType || "—")}</span></td>
    <td class="ins-num">${r.amount != null ? insiderFmtUsd(r.amount) : "—"}</td>
    <td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a></td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>제출일</th><th>종목</th><th>서류</th><th class="ins-num">금액</th><th>공시</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

function renderDilution() {
  bindListControls("dilutionSort", "dilutionSearch", (v) => dilutionSort = v, (v) => dilutionQuery = v, renderDilution);
  if (!isKrMarket()) { renderUsDilution(); return; }
  applyDilutionPanelLabels(false);
  const wrap = byId("dilutionTable"); const meta = byId("dilutionMeta");
  if (!wrap) return;
  if ((!window.KR_DISCLOSURES || !window.KR_EVENT_DETAILS) && !_dilutionTried) {
    _dilutionTried = true; wrap.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    Promise.all([ensureFeatureData("krDart"), ensureFeatureData("krEventDetails"), ensureFeatureData("krDiscStats")]).then(renderDilution); return;
  }
  const disc = ((window.KR_DISCLOSURES || {}).disclosures) || [];
  const details = (window.KR_EVENT_DETAILS || {}).details || {};
  const capByTicker = {};
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  stocks.forEach((s) => { if (s.ticker) capByTicker[s.ticker] = Number(s.marketCapT ?? s.marketCapB ?? 0); });
  const rcpt = (link) => { const m = /rcpNo=(\d+)/.exec(link || ""); return m ? m[1] : ""; };

  let rows = [];
  for (const d of disc) {
    const cat = dilutionCategory(d.title);
    if (!cat) continue;
    const det = details[rcpt(d.link)] || {};
    if (det.dilutionPct == null && det.amount == null) continue; // 숫자 없으면 제외
    rows.push({
      ticker: d.ticker, company: d.company || d.ticker, date: d.fileDate || "",
      type: cat.label, typeKey: cat.key,
      dilutionPct: Number(det.dilutionPct) || null,
      amount: Number(det.amount) || null,
      convPrice: Number(det.convPrice) || null,
      method: det.method || "",
    });
  }
  const q = dilutionQuery.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.ticker || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q));
  if (dilutionSort === "date") rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else if (dilutionSort === "amount") rows.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1));
  else rows.sort((a, b) => (b.dilutionPct ?? -1) - (a.dilutionPct ?? -1));
  if (meta) meta.innerHTML = rows.length ? `업데이트 ${escapeHtml((window.KR_DISCLOSURES || {}).updatedAtKst || "")} · ${rows.length}건${krDiscStatNote("증자·사채")}` : "";
  if (!rows.length) { wrap.innerHTML = `<p class="muted">최근 공시분에 증자·사채 발행이 없습니다.</p>`; return; }
  const body = rows.slice(0, 200).map((r) => `<tr>
    <td class="ins-date">${escapeHtml(r.date)}</td>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.company)}</button><div class="ins-sub">${escapeHtml(r.ticker)}${r.method ? ` · ${escapeHtml(r.method)}` : ""}</div></td>
    <td class="ins-sub ins-sell">${escapeHtml(r.type)}</td>
    <td class="ins-num"><strong>${r.dilutionPct != null ? `${r.dilutionPct.toFixed(1)}%` : "—"}</strong></td>
    <td class="ins-num">${krMoneyEok(r.amount)}</td>
    <td class="ins-num">${r.convPrice != null ? `₩${Number(r.convPrice).toLocaleString()}` : "—"}</td>
  </tr>`).join("");
  wrap.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>공시일</th><th>종목</th><th>유형</th><th class="ins-num">희석률</th><th class="ins-num">발행금액</th><th class="ins-num">전환·행사가</th></tr></thead><tbody>${body}</tbody></table>`;
  delegateTickerClicks(wrap, ".ins-ticker");
}

// ===== 홈: 오늘의 KR 공시 하이라이트 (KR 전용) =====
// 13개 서브탭에 흩어진 이벤트를 홈에서 한눈에. 탭은 그대로 두고 발견성만 더한다.
// 각 유형의 대표 1건씩(공매도 최고·자사주 최대·희석 최고·수주 최대·배당 임박·실적 반응).
function renderKrHighlights() {
  const el = byId("krHighlights");
  if (!el) return;
  const isKr = (typeof isKrMarket === "function") ? isKrMarket() : (marketCfg().id === "kr");
  if (!isKr) { el.hidden = true; el.innerHTML = ""; return; }
  const items = [];
  const add = (label, r, extra, tone) => { if (r && r.ticker) items.push({ label, ticker: r.ticker, company: r.company || r.ticker, extra, tone }); };

  const si = ((window.SHORT_INTEREST || {}).rows || []).filter((r) => Number.isFinite(r.balanceRatio))
    .sort((a, b) => b.balanceRatio - a.balanceRatio)[0];
  if (si) add("공매도 최고", si, `잔고 ${si.balanceRatio.toFixed(1)}%`, "warn");

  // 자사주 최대 취득 · 최고 희석 증자 — 공시+상세 조합.
  const disc = (window.KR_DISCLOSURES || {}).disclosures || [];
  const det = (window.KR_EVENT_DETAILS || {}).details || {};
  const rcpt = (l) => { const m = /rcpNo=(\d+)/.exec(l || ""); return m ? m[1] : ""; };
  let topBuy = null, topDil = null;
  for (const d of disc) {
    const dt = det[rcpt(d.link)] || {};
    if ((d.title || "").includes("자기주식취득") && dt.amount && (!topBuy || dt.amount > topBuy.amt)) topBuy = { ticker: d.ticker, company: d.company, amt: dt.amount };
    const cat = dilutionCategory(d.title);
    if (cat && dt.dilutionPct != null && (!topDil || dt.dilutionPct > topDil.dil)) topDil = { ticker: d.ticker, company: d.company, dil: dt.dilutionPct, label: cat.label };
  }
  if (topBuy) add("자사주 매입", topBuy, `${Math.round(topBuy.amt / 1e8).toLocaleString()}억`, "good");
  if (topDil) add(`${topDil.label} 희석`, topDil, `희석 ${topDil.dil.toFixed(1)}%`, "warn");

  const ct = ((window.KR_CONTRACTS || {}).rows || []).filter((r) => Number.isFinite(r.salesRatio))
    .sort((a, b) => b.salesRatio - a.salesRatio)[0];
  if (ct) add("대형 수주", ct, `매출대비 ${ct.salesRatio.toFixed(0)}%`, "good");

  const dv = ((window.KR_DIVIDENDS || {}).rows || []).filter((r) => r.recordDate)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate))[0];
  if (dv) add("배당 임박", dv, `${dv.recordDate}${Number.isFinite(dv.yieldPct) ? ` · ${dv.yieldPct.toFixed(1)}%` : ""}`, "");

  const er = ((window.KR_EARNINGS_REACTIONS || {}).rows || []).filter((r) => Number.isFinite(r.dayPct))
    .sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct))[0];
  if (er) add("실적 반응", er, `공시일 ${er.dayPct > 0 ? "+" : ""}${er.dayPct.toFixed(1)}%`, er.dayPct >= 0 ? "good" : "warn");

  // 중대 리스크 공시 종목이 있으면 맨 앞에 경고로(상장폐지·불성실·중대 거래정지·횡령).
  for (const d of ((window.KR_DISCLOSURES || {}).disclosures || [])) {
    const tt = d.title || "";
    let lbl = null;
    if (tt.includes("상장폐지")) lbl = "상장폐지 사유";
    else if (tt.includes("불성실공시")) lbl = "불성실공시";
    else if (tt.includes("횡령") || tt.includes("배임")) lbl = "횡령·배임";
    else if (tt.includes("거래정지") && /상장폐지|불성실|감사의견|횡령/.test(tt)) lbl = "거래정지(중대)";
    if (lbl && d.ticker) { items.unshift({ label: "리스크", ticker: d.ticker, company: d.company || d.ticker, extra: lbl, tone: "warn" }); break; }
  }

  if (!items.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const chip = (it) => {
    const c = it.tone === "good" ? "#30a46c" : it.tone === "warn" ? "#e5484d" : "var(--accent,#5b8def)";
    return `<button type="button" class="kr-hl-chip" data-ticker="${escapeHtml(it.ticker)}" style="display:inline-flex;align-items:baseline;flex-wrap:wrap;gap:3px 7px;padding:7px 12px;border-left:3px solid ${c};border-radius:8px;background:var(--panel-soft);color:var(--text);cursor:pointer;text-align:left;line-height:1.4;height:auto;min-height:0">
      <span style="font-size:14px;font-weight:600;color:var(--text)">${escapeHtml(it.company)}</span>
      <span style="font-size:var(--fs-cap);color:var(--muted)">${escapeHtml(it.label)}</span>
      <span style="font-size:12px;color:${c};font-weight:600">${escapeHtml(it.extra || "")}</span>
    </button>`;
  };
  el.innerHTML = `<div class="section-title" style="margin-bottom:8px"><h2>오늘의 KR 공시 하이라이트</h2><p>흩어진 공시·수급을 종목별 서브탭에서 한눈에</p></div>
    <div class="kr-hl-chips" style="display:flex;flex-wrap:wrap;gap:8px">${items.map(chip).join("")}</div>`;
  delegateTickerClicks(el, ".kr-hl-chip");
}

// ===== 시장 전환 시 lazy 로드 플래그 초기화 =====
// 위의 _*Tried 플래그는 "이 탭에서 한 번 시도했다"를 기억해 같은 파일을 반복 요청하지
// 않게 하는데, 시장별 데이터라 한 번 true 가 되면 반대 시장으로 바꿔도 영원히 재시도하지
// 않는다(KR→US→KR 이면 배당·공급계약·희석이 빈 화면). app.js 의 resetMarketCaches() 가
// 피처 전역을 지울 때 이것도 함께 불러야 한다.
window.resetDisclosureTrackerCaches = function resetDisclosureTrackerCaches() {
  _krShortVolTried = false;
  _ftdTried = false;
  _buybackTried = false;
  _earnReactTried = false;
  _dividendTried = false;
  _usDividendTried = false;
  _contractTried = false;
  _govContractsTried = false;
  _dilutionTried = false;
  _usEarnReactCache = null;
  _usEarnReactLoading = false;
};
