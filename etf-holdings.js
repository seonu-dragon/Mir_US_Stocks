// etf-holdings.js — 종목 분석의 '구성 종목(SEC 공시)' / '이 종목을 담은 ETF' 카드 (미국 전용)
// =====================================================
// 데이터: data/etf_holdings/index.js(window.US_ETF_HOLDINGS_INDEX, lazy) + 종목을 열 때 샤드 하나만 fetch
//   - ETF: data/etf_holdings/etf/<T>.json (보유 상위 25·섹터·국가·자산 구성)
//   - 일반 종목: data/etf_holdings/rev/<첫 글자>.json (그 종목 비중이 큰 ETF 10개)
// 출처는 SEC Form N-PORT-P(분기말 보유 내역, 분기말 후 최대 60일 뒤 공개) — 기준일을 항상 적는다.
// selectTicker(renderSearch) 가 부르고, 인덱스가 늦게 도착하면 refreshFeatureViews 가 다시 부른다.

const _etfhShardCache = {};  // url → Promise<json|null>
const _etfhExpanded = {};    // ticker → true (25개 모두 보기)

function etfhFetch(path, meta) {
  const url = `${path}?v=${encodeURIComponent((meta && meta.updatedAtKst) || "")}`;
  if (!_etfhShardCache[url]) {
    _etfhShardCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => { if (!j) delete _etfhShardCache[url]; return j; });
  }
  return _etfhShardCache[url];
}

function etfhPct(w, digits = 2) {
  const n = Number(w);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : "—";
}

function etfhSectorLabel(s) {
  return (typeof SECTOR_KO !== "undefined" && SECTOR_KO[s]) || s;
}

function etfhBar(w, max) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (Number(w) || 0) / max * 100)) : 0;
  return `<span class="etfh-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

function etfhStockCell(t, name) {
  const row = t && typeof stockByTicker === "function" ? stockByTicker(t) : null;
  const main = escapeHtml(t || "—");
  const sub = escapeHtml(name || "");
  if (row) return `<button type="button" class="etfh-link" data-etfh-ticker="${escapeHtml(row.ticker)}"><strong>${main}</strong></button><span class="etfh-sub">${sub}</span>`;
  return `<strong class="${t ? "" : "muted"}">${main}</strong><span class="etfh-sub">${sub}</span>`;
}

function etfhBind(host) {
  if (host.dataset.etfhBound) return;
  host.dataset.etfhBound = "1";
  host.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-etfh-ticker], [data-etfh-more]");
    if (!b || !host.contains(b)) return;
    if (b.dataset.etfhTicker) { selectTicker(b.dataset.etfhTicker, { openSearch: true }); return; }
    const t = b.dataset.etfhMore;
    _etfhExpanded[t] = !_etfhExpanded[t];
    const item = typeof selectedBaseRow === "function" ? selectedBaseRow() : null;
    if (item) renderEtfHoldings(item);
  });
}

function renderEtfHoldings(item) {
  const host = byId("etfHoldingsCard");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const ticker = item && item.ticker;
  if (!ticker || isKrMarket() || featureOff("etfHoldings")) return hide();
  const meta = window.US_ETF_HOLDINGS_INDEX;
  if (!meta) {
    hide();
    ensureFeatureData("usEtfHoldings").then((ok) => { if (ok && selectedTicker === ticker) renderEtfHoldings(item); });
    return;
  }
  etfhBind(host);
  if (isStockEtf(item)) {
    if (meta.etfs && meta.etfs[ticker]) {
      etfhFetch(`data/etf_holdings/etf/${encodeURIComponent(ticker)}.json`, meta).then((sh) => {
        if (selectedTicker !== ticker) return;
        if (!sh) return hide();
        host.hidden = false;
        host.innerHTML = etfhCompositionHtml(sh);
      });
      return;
    }
    const why = meta.excluded && meta.excluded[ticker];
    if (why && why !== "outside") {
      const text = (meta.excludedText && meta.excludedText[why]) || "구성 자료가 없습니다";
      host.hidden = false;
      host.innerHTML = `<div class="fundamental-head"><h3>구성 종목 (SEC 공시)</h3></div><p class="muted etfh-note">${escapeHtml(text)}. 그래서 구성 종목 비중을 보여 드리지 않습니다.</p>`;
      return;
    }
    return hide();
  }
  const key = /^[A-Z]/.test(ticker[0]) ? ticker[0] : "_";
  if (!(meta.revShards || []).includes(key)) return hide();
  etfhFetch(`data/etf_holdings/rev/${key}.json`, meta).then((sh) => {
    if (selectedTicker !== ticker) return;
    const rec = sh && sh[ticker];
    if (!rec || !rec.top || !rec.top.length) return hide();
    host.hidden = false;
    host.innerHTML = etfhOwnersHtml(ticker, rec, meta);
  });
}

function etfhCompositionHtml(sh) {
  const expanded = !!_etfhExpanded[sh.ticker];
  const rows = (sh.top || []).slice(0, expanded ? 25 : 10);
  const max = Math.max(...(sh.top || []).map((h) => Number(h.w) || 0), 0);
  const aum = Number(sh.netAssetsB);
  const headSub = [`기준일 ${sh.asOf || "—"}`, `보유 ${Number(sh.holdingsCount || 0).toLocaleString("en-US")}개`,
    Number.isFinite(aum) && aum > 0 ? `순자산 $${aum.toLocaleString("en-US", { maximumFractionDigits: 1 })}B` : ""].filter(Boolean).join(" · ");
  const table = `<div class="table-wrap"><table class="etfh-table">
    <thead><tr><th class="etfh-rank">#</th><th>종목</th><th class="num">비중</th></tr></thead>
    <tbody>${rows.map((h, i) => `<tr>
      <td class="etfh-rank">${i + 1}</td>
      <td class="etfh-name">${h.t ? etfhStockCell(h.t, h.n) : `<span class="etfh-plain">${escapeHtml(h.n || "—")}</span>`}</td>
      <td class="num"><span class="etfh-w">${etfhPct(h.w)}</span>${etfhBar(h.w, max)}</td>
    </tr>`).join("")}</tbody></table></div>
    ${(sh.top || []).length > 10 ? `<button type="button" class="ghost compact-btn etfh-more" data-etfh-more="${escapeHtml(sh.ticker)}">${expanded ? "10개만 보기" : `상위 ${Math.min(25, sh.top.length)}개 모두 보기`}</button>` : ""}`;

  const sectors = (sh.sectors || []).slice(0, 11);
  const unm = Number(sh.sectorUnmapped) || 0;
  const smax = Math.max(...sectors.map((s) => Number(s[1]) || 0), unm, 0);
  const sectorHtml = sectors.length ? `<div class="etfh-block"><h4>섹터 노출</h4><ul class="etfh-bars">
    ${sectors.map(([s, w]) => `<li><span class="etfh-bl">${escapeHtml(etfhSectorLabel(s))}</span>${etfhBar(w, smax)}<span class="etfh-bv">${etfhPct(w, 1)}</span></li>`).join("")}
    ${unm >= 0.5 ? `<li class="is-muted"><span class="etfh-bl">미분류</span>${etfhBar(unm, smax)}<span class="etfh-bv">${etfhPct(unm, 1)}</span></li>` : ""}
  </ul></div>` : "";
  const mix = sh.assetMix || {};
  const mixParts = [["equity", "주식"], ["debt", "채권"], ["cash", "현금성"], ["other", "기타·파생"]]
    .filter(([k]) => Math.abs(Number(mix[k]) || 0) >= 0.5).map(([k, lab]) => `${lab} ${etfhPct(mix[k], 1)}`);
  const ctry = (sh.countries || []).slice(0, 6);
  const ctryHtml = ctry.length ? `<div class="etfh-block"><h4>국가 노출</h4><p class="etfh-chips">${ctry.map(([c, w]) => `<span>${escapeHtml(c)} ${etfhPct(w, 1)}</span>`).join("")}${Number(sh.countriesOther) >= 0.5 ? `<span>기타 ${etfhPct(sh.countriesOther, 1)}</span>` : ""}</p>
    ${mixParts.length ? `<h4>자산 구성</h4><p class="etfh-chips">${mixParts.map((p) => `<span>${escapeHtml(p)}</span>`).join("")}</p>` : ""}</div>` : "";

  return `<div class="fundamental-head"><h3>구성 종목 (SEC 공시)</h3><span>${escapeHtml(headSub)}</span></div>
    <div class="etfh-grid"><div class="etfh-main">${table}</div><div class="etfh-side">${sectorHtml}${ctryHtml}</div></div>
    <p class="etfh-foot">출처 SEC Form N-PORT(분기말 보유 내역, 약 60일 뒤 공개) · 제출일 ${escapeHtml(sh.filed || "—")}${sh.url ? ` · <a href="${escapeHtml(sh.url)}" target="_blank" rel="noopener">원문</a>` : ""} · 현재 구성과 다를 수 있음 · 섹터는 이 사이트 분류로 이은 주식만</p>`;
}

function etfhOwnersHtml(ticker, rec, meta) {
  const etfs = meta.etfs || {};
  const max = Math.max(...rec.top.map((r) => Number(r[1]) || 0), 0);
  const range = meta.asOfRange && meta.asOfRange.length === 2
    ? (meta.asOfRange[0] === meta.asOfRange[1] ? meta.asOfRange[0] : `${meta.asOfRange[0]}~${meta.asOfRange[1]}`) : "—";
  return `<div class="fundamental-head"><h3>이 종목을 담은 ETF</h3><span>비중 상위 ${rec.top.length}개 · 순자산 상위 ${Number(meta.count || 0)}개 ETF 중 ${Number(rec.n || 0)}개가 보유</span></div>
    <div class="table-wrap"><table class="etfh-table">
      <thead><tr><th>ETF</th><th class="num">이 종목 비중</th><th class="num etfh-col-date">기준일</th></tr></thead>
      <tbody>${rec.top.map(([e, w]) => `<tr>
        <td class="etfh-name">${etfhStockCell(e, (etfs[e] && etfs[e].name) || "")}</td>
        <td class="num"><span class="etfh-w">${etfhPct(w)}</span>${etfhBar(w, max)}</td>
        <td class="num etfh-col-date">${escapeHtml((etfs[e] && etfs[e].asOf) || "—")}</td>
      </tr>`).join("")}</tbody></table></div>
    <p class="etfh-foot">출처 SEC Form N-PORT(분기말 보유 내역, 기준일 ${escapeHtml(range)}) · SPY·DIA 는 단위투자신탁이라 보고서가 없어 빠짐 · 현재 비중과 다를 수 있음</p>`;
}
