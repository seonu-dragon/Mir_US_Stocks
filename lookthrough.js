// lookthrough.js — 내 투자 › 보유: 'ETF 룩스루' 카드 + 증권사 CSV 가져오기 미리보기
// =====================================================
// ETF 룩스루(Magnifi 'Hidden Overlap' 류): 보유 ETF 를 구성 종목으로 펼쳐 실제 종목 노출·ETF 간 중복·
// 섹터 노출을 보여 준다. 계산은 lookthrough-core.js(window.MirLookthroughCore).
//   - US: SEC N-PORT(etf-holdings.js 와 같은 데이터 — index + ETF 샤드 data/etf_holdings/etf/<T>.json)
//   - KR: KRX ETF PDF(data/korea/etf_holdings.js, build_kr_etf_holdings.py)
//   구성 기준일을 항상 적고, 자료가 없는 ETF 는 '구성 데이터 없음' 으로 따로 센다.
// CSV 가져오기: 'CSV가져오기' 파일을 바이트로 읽어 broker-csv-core.js(window.MirBrokerCsvCore)로
// 인코딩(UTF-8/CP949)·형식(키움·일반·Mir)·종목 매칭을 한 뒤 미리보기 → 확인 후 반영.
// portfolio.js renderPortfolioRiskViews → MirLookthrough.onPortfolioRender 로 보유 변경 때마다 다시 그린다.

(function () {
  "use strict";

  const TOP_N = 15;
  let renderSeq = 0;
  let importState = null;   // { preview, fileName, replace }

  const SPECIAL_SECTOR = {
    MISC: "기타",
    __unmapped: "미분류 주식",
    __nonequity: "채권·현금·기타",
    __rest: "공개 상위 밖",
    __nodata: "구성 데이터 없음",
  };

  const pct = (v, d = 1) => (Number.isFinite(v) ? `${v.toFixed(d)}%` : "—");

  function sectorLabel(s) {
    if (SPECIAL_SECTOR[s]) return SPECIAL_SECTOR[s];
    return (typeof SECTOR_KO !== "undefined" && SECTOR_KO[s]) || s;
  }

  function bar(w, max) {
    const p = max > 0 ? Math.max(0, Math.min(100, (Number(w) || 0) / max * 100)) : 0;
    return `<span class="etfh-bar" aria-hidden="true"><i style="width:${p.toFixed(1)}%"></i></span>`;
  }

  // ---------------------------------------------------------------- 데이터
  function heldPositions() {
    if (typeof portfolio === "undefined" || !Array.isArray(portfolio)) return [];
    return portfolio.map((p) => {
      const stock = stockByTicker(p.ticker);
      if (!stock) return null;
      const value = Number(p.qty || 0) * (Number(stock.price) || 0);
      return { ticker: stock.ticker, name: stock.company || "", value, isEtf: isStockEtf(stock), sector: stock.sector || "" };
    }).filter((p) => p && p.value > 0);
  }

  // 보유 ETF 들의 구성 → { etfs, missing, source, sourceNote }. 비동기(US 는 ETF 샤드 fetch).
  function loadEtfData(etfTickers) {
    const kr = isKrMarket();
    const key = kr ? "krEtfHoldings" : "usEtfHoldings";
    return ensureFeatureData(key).then(() => {
      const etfs = {};
      const missing = {};
      if (kr) {
        const db = window.KR_ETF_HOLDINGS;
        etfTickers.forEach((t) => {
          const rec = db && db.etfs && db.etfs[t];
          if (rec) { etfs[t] = rec; return; }
          const why = db && db.excluded && db.excluded[t];
          missing[t] = why ? `구성 데이터 없음 — ${(db.excludedText && db.excludedText[why]) || why}`
            : db ? "구성 데이터 없음 — 시가총액 상위 대상 밖" : "구성 데이터 없음 — 국내 ETF 구성 자료 준비 중";
        });
        return { etfs, missing, source: "KRX ETF PDF", updatedAtKst: db && db.updatedAtKst, topKeep: (db && db.topKeep) || 25 };
      }
      const meta = window.US_ETF_HOLDINGS_INDEX;
      if (!meta) {
        etfTickers.forEach((t) => { missing[t] = "구성 데이터 없음 — ETF 구성 자료를 불러오지 못함"; });
        return { etfs, missing, source: "SEC Form N-PORT", topKeep: 25 };
      }
      const jobs = etfTickers.map((t) => {
        if (!(meta.etfs && meta.etfs[t])) {
          const why = meta.excluded && meta.excluded[t];
          missing[t] = why && why !== "outside"
            ? `구성 데이터 없음 — ${(meta.excludedText && meta.excludedText[why]) || why}`
            : `구성 데이터 없음 — 순자산 상위 ${Number(meta.count || 0)}개 ETF 밖`;
          return Promise.resolve();
        }
        return etfhFetch(`data/etf_holdings/etf/${encodeURIComponent(t)}.json`, meta).then((sh) => {
          if (sh && Array.isArray(sh.top) && sh.top.length) etfs[t] = sh;
          else missing[t] = "구성 데이터 없음 — 파일을 불러오지 못함";
        });
      });
      return Promise.all(jobs).then(() => ({ etfs, missing, source: "SEC Form N-PORT", updatedAtKst: meta.updatedAtKst, topKeep: 25 }));
    });
  }

  // ---------------------------------------------------------------- 룩스루 카드
  function render() {
    const host = byId("lookthroughCard");
    if (!host) return;
    const core = window.MirLookthroughCore;
    const positions = heldPositions();
    const etfTickers = positions.filter((p) => p.isEtf).map((p) => p.ticker);
    const seq = ++renderSeq;
    // 시장을 바꾸면 열려 있던 가져오기 미리보기(다른 시장 종목 매칭)는 닫는다.
    if (importState && importState.market !== (isKrMarket() ? "kr" : "us")) closeImport();
    if (!core || !etfTickers.length) { host.hidden = true; host.innerHTML = ""; return; }
    host.hidden = false;
    if (!host.innerHTML) host.innerHTML = `<div class="fundamental-head"><h3>ETF 룩스루 — 실제 종목 노출</h3></div><p class="muted">ETF 구성 자료를 불러오는 중…</p>`;
    bind(host);
    loadEtfData(etfTickers).then((d) => {
      if (seq !== renderSeq) return;
      const sectorOf = (t) => { const s = stockByTicker(t); return s && !isStockEtf(s) ? s.sector : null; };
      const r = core.computeLookthrough({ positions, etfs: d.etfs, missing: d.missing, sectorOf, topN: TOP_N });
      host.innerHTML = cardHtml(r, d);
    }).catch(() => {
      if (seq !== renderSeq) return;
      host.innerHTML = `<div class="fundamental-head"><h3>ETF 룩스루 — 실제 종목 노출</h3></div><p class="muted">ETF 구성 자료를 불러오지 못했습니다.</p>`;
    });
  }

  function bind(host) {
    if (host.dataset.ltBound) return;
    host.dataset.ltBound = "1";
    host.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-lt-ticker]");
      if (b && host.contains(b)) selectTicker(b.dataset.ltTicker, { openSearch: true });
    });
  }

  function stockCell(e) {
    const row = e.ticker ? stockByTicker(e.ticker) : null;
    const label = row ? stockLabel(row.ticker, row) : (e.ticker || e.name || "—");
    const sub = row ? (isKrMarket() ? "" : (row.company || "")) : (e.ticker ? e.name : "");
    const main = row
      ? `<button type="button" class="etfh-link" data-lt-ticker="${escapeHtml(row.ticker)}"><strong>${escapeHtml(label)}</strong></button>`
      : `<strong>${escapeHtml(label)}</strong>`;
    return `${main}${sub ? `<span class="etfh-sub">${escapeHtml(sub)}</span>` : ""}`;
  }

  function sourceChips(e) {
    return e.sources.slice(0, 4).map((s) => {
      const lab = s.direct ? "직접" : (isKrMarket() ? ((stockByTicker(s.etf) || {}).company || s.etf) : s.etf);
      return `<span class="${s.direct ? "is-direct" : ""}">${escapeHtml(lab)} ${pct(s.pct, 2)}</span>`;
    }).join("") + (e.sources.length > 4 ? `<span>외 ${e.sources.length - 4}</span>` : "");
  }

  function cardHtml(r, d) {
    const c = r.coverage;
    const seg = (cls, v, lab) => (v >= 0.05 ? `<i class="lt-seg ${cls}" style="width:${v.toFixed(2)}%" title="${escapeHtml(lab)} ${pct(v)}"></i>` : "");
    const coverage = `<div class="lt-coverage">
      <div class="lt-stack" role="img" aria-label="보유 비중 구성: 직접 보유 ${pct(c.directPct)}, ETF 구성 공개분 ${pct(c.etfCoveredPct)}, ETF 공개 상위 밖 ${pct(c.etfRestPct)}, 구성 데이터 없음 ${pct(c.etfMissingPct)}">
        ${seg("is-direct", c.directPct, "직접 보유")}${seg("is-covered", c.etfCoveredPct, "ETF 구성 공개분")}${seg("is-rest", c.etfRestPct, "ETF 공개 상위 밖")}${seg("is-missing", c.etfMissingPct, "구성 데이터 없음")}
      </div>
      <p class="lt-legend">
        <span><i class="is-direct"></i>직접 보유 ${pct(c.directPct)}</span>
        <span><i class="is-covered"></i>ETF 구성 공개분 ${pct(c.etfCoveredPct)}</span>
        <span><i class="is-rest"></i>ETF 공개 상위 밖 ${pct(c.etfRestPct)}</span>
        ${c.etfMissingPct >= 0.05 ? `<span><i class="is-missing"></i>구성 데이터 없음 ${pct(c.etfMissingPct)}</span>` : ""}
      </p></div>`;

    const max = Math.max(...r.exposures.map((e) => e.totalPct), 0);
    const expo = r.exposures.length ? `<div class="table-wrap"><table class="etfh-table lt-table">
      <thead><tr><th class="etfh-rank">#</th><th>종목</th><th class="num">합계</th><th class="num lt-col-split">직접</th><th class="num lt-col-split">ETF 경유</th><th class="lt-col-src">경로</th></tr></thead>
      <tbody>${r.exposures.map((e, i) => `<tr>
        <td class="etfh-rank">${i + 1}</td>
        <td class="etfh-name">${stockCell(e)}<p class="etfh-chips lt-src lt-src-inline">${sourceChips(e)}</p></td>
        <td class="num"><span class="etfh-w">${pct(e.totalPct, 2)}</span>${bar(e.totalPct, max)}</td>
        <td class="num lt-col-split">${e.directPct > 0 ? pct(e.directPct, 2) : "—"}</td>
        <td class="num lt-col-split">${e.viaPct > 0 ? pct(e.viaPct, 2) : "—"}</td>
        <td class="lt-col-src"><p class="etfh-chips lt-src">${sourceChips(e)}</p></td>
      </tr>`).join("")}</tbody></table></div>` : `<p class="muted">펼칠 수 있는 구성 종목이 없습니다.</p>`;

    const smax = Math.max(...r.sectors.map((s) => s.pct), 0);
    const sectors = r.sectors.length ? `<div class="etfh-block"><h4>섹터 노출</h4><ul class="etfh-bars">
      ${r.sectors.slice(0, 14).map((s) => `<li class="${s.sector.startsWith("__") ? "is-muted" : ""}"><span class="etfh-bl">${escapeHtml(sectorLabel(s.sector))}</span>${bar(s.pct, smax)}<span class="etfh-bv">${pct(s.pct)}</span></li>`).join("")}
    </ul></div>` : "";

    const etfName = (t, n) => (isKrMarket() ? (n || t) : t);
    const overlaps = r.overlaps.length ? `<div class="etfh-block"><h4>ETF 간 중복 <span class="lt-h4-sub">겹치는 비중(두 ETF 공통 종목의 작은 쪽 비중 합)</span></h4>
      <ul class="lt-overlaps">${r.overlaps.slice(0, 8).map((o) => `<li>
        <div class="lt-ov-head"><strong>${escapeHtml(etfName(o.a, o.aName))} ↔ ${escapeHtml(etfName(o.b, o.bName))}</strong><span class="etfh-bv">${pct(o.overlapPct)}</span></div>
        ${bar(o.overlapPct, 100)}
        <p class="lt-ov-sub">${o.commonCount ? `공통 ${o.commonCount}종목 · ${o.common.map((x) => escapeHtml(x.ticker && !isKrMarket() ? x.ticker : x.name)).join(", ")}` : "공개 상위 종목 중 겹치는 종목 없음"}</p>
      </li>`).join("")}</ul></div>` : (r.etfRows.filter((e) => e.status === "ok").length < 2
        ? `<div class="etfh-block"><h4>ETF 간 중복</h4><p class="muted lt-small">구성 자료가 있는 ETF 가 2개 이상일 때 계산합니다.</p></div>` : "");

    const etfTable = `<div class="etfh-block lt-etfs"><h4>보유 ETF · 구성 기준일</h4><div class="table-wrap"><table class="etfh-table">
      <thead><tr><th>ETF</th><th class="num">포트 비중</th><th class="num lt-col-date">기준일</th><th class="num lt-col-split">공개 상위 합</th></tr></thead>
      <tbody>${r.etfRows.map((e) => `<tr>
        <td class="etfh-name">${stockCell({ ticker: e.ticker, name: e.name })}${e.asOf ? `<span class="etfh-sub lt-asof-inline">기준일 ${escapeHtml(e.asOf)}</span>` : ""}${e.basis === "shares_x_close" ? `<span class="etfh-sub lt-missing">비중 = 계약수 × 미국 종가(KRX PDF 에 비중 없음)</span>` : ""}${e.status === "missing" ? `<span class="etfh-sub lt-missing">${escapeHtml(e.reason)}</span>` : ""}</td>
        <td class="num">${pct(e.weightPct)}</td>
        <td class="num lt-col-date">${escapeHtml(e.asOf || "—")}</td>
        <td class="num lt-col-split">${e.status === "ok" ? `${pct(e.coveredPct)} <span class="muted">(${e.shownCount}/${Number(e.holdingsCount || 0).toLocaleString("en-US")})</span>` : "—"}</td>
      </tr>`).join("")}</tbody></table></div></div>`;

    const multi = r.multiSourceCount ? ` · 두 경로 이상으로 겹쳐 든 종목 ${r.multiSourceCount}개` : "";
    const srcText = isKrMarket()
      ? "출처 KRX 정보데이터시스템 ETF PDF(설정 단위 구성, 기준일은 ETF별 표기)"
      : "출처 SEC Form N-PORT(분기말 보유 내역, 약 60일 뒤 공개 — 기준일은 ETF별 표기)";
    return `<div class="fundamental-head"><h3>ETF 룩스루 — 실제 종목 노출</h3><span>평가액 기준 · 종목 ${r.exposureCount}개로 펼침${escapeHtml(multi)}</span></div>
      ${coverage}
      <div class="etfh-grid"><div class="etfh-main"><h4 class="lt-h4">실제 종목 노출 상위 ${Math.min(TOP_N, r.exposures.length)}</h4>${expo}</div>
      <div class="etfh-side">${overlaps}${sectors}</div></div>
      ${etfTable}
      <p class="etfh-foot">${srcText} · ETF 마다 공개 상위 ${Number(d.topKeep || 25)}개 구성만 펼치므로 종목 노출·중복도는 하한이고 나머지는 '공개 상위 밖'으로 따로 셉니다 · 현재 구성과 다를 수 있음 · 사실 표시일 뿐 매수·매도 추천이 아닙니다</p>`;
  }

  // ---------------------------------------------------------------- CSV 가져오기 미리보기
  function openImport(bytes, fileName) {
    const core = window.MirBrokerCsvCore;
    const host = byId("pfImportPreview");
    if (!core || !host) return false;
    const universe = ((typeof data !== "undefined" && data && data.stocks) || []).map((s) => ({ ticker: s.ticker, company: s.company }));
    const preview = core.buildImportPreview(bytes, universe, isKrMarket() ? "kr" : "us");
    importState = { preview, fileName: fileName || "", replace: false, market: isKrMarket() ? "kr" : "us" };
    host.hidden = false;
    renderImport();
    host.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return true;
  }

  function closeImport() {
    importState = null;
    const host = byId("pfImportPreview");
    if (host) { host.hidden = true; host.innerHTML = ""; }
  }

  function candLabel(c) {
    return isKrMarket() ? `${c.company} (${c.ticker})` : `${c.ticker} · ${c.company}`;
  }

  function renderImport() {
    const host = byId("pfImportPreview");
    if (!host || !importState) return;
    bindImport(host);
    const { preview: p, fileName } = importState;
    const cfg = marketCfg();
    const meta = [p.format ? `형식 ${escapeHtml(p.format.label)}` : "", `인코딩 ${escapeHtml(p.encoding || "—")}`,
      p.headerLine > 0 ? `머리글 ${p.headerLine}행` : ""].filter(Boolean).join(" · ");
    const head = `<div class="pf-imp-head"><h4>가져오기 미리보기${fileName ? ` — ${escapeHtml(fileName)}` : ""}</h4><span class="muted">${meta}</span></div>`;
    if (!p.rows.length) {
      host.innerHTML = `${head}<p class="pf-imp-error">${escapeHtml(p.error || "가져올 행이 없습니다.")}</p>
        <p class="muted pf-imp-note">열 이름에 종목명(또는 종목코드)·수량·평균단가(또는 매입금액)가 있어야 합니다. 예: <code>종목명,보유수량,매입가</code></p>
        <div class="pf-imp-actions"><button type="button" class="ghost" data-imp-cancel>닫기</button></div>`;
      return;
    }
    const existing = new Set((portfolio || []).map((x) => x.ticker));
    const rows = p.rows.map((r, i) => {
      const raw = [r.rawName, r.rawCode && r.rawCode !== r.rawName ? r.rawCode : ""].filter(Boolean).map(escapeHtml).join(" · ");
      let match;
      if (r.skip) match = `<span class="pf-imp-skip">${escapeHtml(r.skip)}</span>`;
      else if (r.match.status === "exact") {
        const s = stockByTicker(r.match.ticker);
        match = `<span class="pf-imp-ok">✓ ${escapeHtml(s ? candLabel({ ticker: s.ticker, company: s.company }) : r.match.ticker)}</span>`;
      } else {
        match = `<select data-imp-pick="${i}" aria-label="${escapeHtml(r.rawName || r.rawCode)} 종목 고르기">
          <option value="">후보에서 고르기…</option>
          ${r.match.candidates.map((c) => `<option value="${escapeHtml(c.ticker)}"${r.selected === c.ticker ? " selected" : ""}>${escapeHtml(candLabel(c))}</option>`).join("")}
        </select>`;
      }
      const on = !!r.selected && !r.skip;
      const status = r.skip ? "제외" : !r.selected ? "선택 필요" : existing.has(r.selected) && !importState.replace ? "갱신" : "추가";
      return `<tr class="${r.skip ? "is-skip" : ""}">
        <td class="pf-imp-chk"><input type="checkbox" data-imp-on="${i}" ${on ? "checked" : ""} ${r.skip || !r.selected ? "disabled" : ""} aria-label="반영"></td>
        <td class="pf-imp-raw">${raw}</td>
        <td class="pf-imp-match">${match}</td>
        <td class="ins-num">${Number.isFinite(r.qty) ? r.qty.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}</td>
        <td class="ins-num">${Number.isFinite(r.avg) ? escapeHtml(cfg.formatPrice(r.avg)) : "—"}</td>
        <td class="pf-imp-status">${status}</td>
      </tr>`;
    }).join("");
    const nOn = p.rows.filter((r) => r.selected && !r.skip).length;
    const nPick = p.rows.filter((r) => !r.skip && r.match.status === "ambiguous" && !r.selected).length;
    const nSkip = p.rows.filter((r) => r.skip).length;
    host.innerHTML = `${head}
      <p class="muted pf-imp-note">반영할 ${nOn}종목${nPick ? ` · 후보에서 골라야 할 ${nPick}행` : ""}${nSkip ? ` · 제외 ${nSkip}행` : ""}. 같은 종목이 여러 줄이면 수량을 더하고 평단은 가중평균합니다. 이 브라우저에만 저장됩니다.</p>
      <div class="table-wrap pf-imp-wrap"><table class="insider-table pf-imp-table" style="min-width:0">
        <thead><tr><th></th><th>파일의 종목</th><th>매칭</th><th class="ins-num">수량</th><th class="ins-num">평단</th><th class="pf-imp-status">반영</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <label class="pf-imp-replace"><input type="checkbox" data-imp-replace ${importState.replace ? "checked" : ""}> 기존 보유 종목을 지우고 이 파일로 바꾸기</label>
      <div class="pf-imp-actions">
        <button type="button" class="primary" data-imp-apply ${nOn ? "" : "disabled"}>반영 (${nOn}종목)</button>
        <button type="button" class="ghost" data-imp-cancel>취소</button>
      </div>`;
  }

  function bindImport(host) {
    if (host.dataset.impBound) return;
    host.dataset.impBound = "1";
    host.addEventListener("change", (ev) => {
      if (!importState) return;
      const rows = importState.preview.rows;
      const pick = ev.target.closest("[data-imp-pick]");
      if (pick) { rows[Number(pick.dataset.impPick)].selected = pick.value; renderImport(); return; }
      const on = ev.target.closest("[data-imp-on]");
      if (on) {
        const r = rows[Number(on.dataset.impOn)];
        if (!on.checked) { r._prev = r.selected; r.selected = ""; r._off = true; }
        else if (r._off) { r.selected = r._prev || r.match.ticker || ""; r._off = false; }
        renderImport();
        return;
      }
      if (ev.target.closest("[data-imp-replace]")) { importState.replace = ev.target.checked; renderImport(); }
    });
    host.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-imp-cancel]")) { closeImport(); return; }
      if (ev.target.closest("[data-imp-apply]")) applyImport();
    });
  }

  function applyImport() {
    if (!importState) return;
    const core = window.MirBrokerCsvCore;
    const res = core.applyImport(portfolio, importState.preview.rows, { replace: importState.replace, limit: 60 });
    if (!res.added && !res.updated) { showAppToast("반영할 종목이 없습니다."); return; }
    portfolio = res.next;
    savePortfolio();
    closeImport();
    renderPortfolio();
    if (typeof renderMyInvestSummary === "function") renderMyInvestSummary();
    showAppToast(`가져오기 완료 — 추가 ${res.added} · 갱신 ${res.updated}${res.skipped ? ` · 한도 초과 ${res.skipped}` : ""}`);
  }

  window.MirLookthrough = {
    onPortfolioRender: render,
    openImport,
    closeImport,
  };
})();
