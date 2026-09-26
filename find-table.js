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
//   · '목록' 칩(#findChipsPreset): 배당 랭킹 · 신규상장 · 관리·경보(국내). 켜면 같은 표 자리에 그 목록을
//     그린다(계산은 find-table-core.js). 정렬 지표 칩을 누르거나 같은 칩을 다시 누르면 일반 표로 돌아온다.

const FT_VIEW_KEY = "mir.find.view";
const FT_METRIC_CHIPS = ["changePct", "monthChangePct", "volumeRatio", "amount", "marketCapB", "pe", "rsi14"];
const FT_DIV_LIMIT = 300;
let ftLast = { rows: [], metric: "changePct" };
let ftList = null; // null | "dividend" | "ipo" | "alerts"
let ftAlertFilter = "all";

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

// 미국 배당 보조 소스(US_STOCK_CALENDAR, 시총 상위 ~200종목). 국내는 없다.
function ftCal(item) {
  if (ftMarket() !== "us") return null;
  const st = (window.US_STOCK_CALENDAR || {}).stocks;
  return (st && item && st[item.ticker]) || null;
}

function ftDivInfo(item) {
  const core = ftCore();
  return core ? core.dividendInfo(item, ftFund(item), ftCal(item)) : { divYield: null, dps: null, payoutRatio: null, deficit: false };
}

function ftFmtDps(v) {
  if (v == null) return "—";
  return ftMarket() === "kr" ? `${Math.round(v).toLocaleString("ko-KR")}원` : `$${v.toFixed(2)}`;
}

function ftPayoutCell(info) {
  if (info.deficit) return [`<span class="muted" title="최근 이익이 0 이하라 배당성향을 계산하지 않습니다">적자</span>`, ""];
  return info.payoutRatio == null ? ["—", ""] : [`${info.payoutRatio.toFixed(1)}%`, ""];
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
    case "divYield": { const v = ftDivInfo(item).divYield; return v == null ? ["—", ""] : [`${v.toFixed(2)}%`, ""]; }
    case "dps": return [ftFmtDps(ftDivInfo(item).dps), ""];
    case "payoutRatio": return ftPayoutCell(ftDivInfo(item));
    case "foreignPct": { const v = n(f.foreignPct); return v == null ? ["—", ""] : [`${v.toFixed(1)}%`, ""]; }
    case "rsi14": { const v = typeof rsiValue === "function" ? rsiValue(item) : n(item.rsi14); return v == null ? ["—", ""] : [String(Math.round(v)), ""]; }
    case "epsTtm": { const v = n(item.epsTtm); return v == null ? ["—", ""] : [ftDash(fmtEpsValue(v)), ""]; }
    case "newHigh": { const v = n(item.newHighDistancePct); return v == null ? ["—", ""] : [v <= 0.2 ? "신고가" : `−${v.toFixed(1)}%`, ""]; }
    case "sector": return [escapeHtml([item.sector, item.industry].filter(Boolean).join(" · ") || "—"), "ft-text"];
    default: return ["—", ""];
  }
}

function ftApplyView() {
  // 목록 모드는 표 전용 — 카드 토글·열 설정을 숨긴다.
  const view = ftList ? "table" : ftView();
  const table = byId("topStocksTableWrap");
  const cards = byId("topStocks");
  if (table) table.hidden = view !== "table";
  if (cards) cards.hidden = view !== "card";
  const seg = byId("findViewSeg");
  if (seg) seg.hidden = Boolean(ftList);
  const bucketChips = byId("findChipsBucket");
  if (bucketChips) bucketChips.hidden = ftList === "ipo" || ftList === "alerts";
  byId("findViewSeg")?.querySelectorAll("[data-fview]").forEach((b) => {
    const on = b.dataset.fview === view;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const colsBtn = byId("findColsBtn");
  if (colsBtn) colsBtn.hidden = view !== "table" || Boolean(ftList);
  if (view !== "table" || ftList) ftClosePanel();
}

function renderFindTable(rows, metric) {
  ftLast = { rows: rows || [], metric: metric || "changePct" };
  if (ftList === "alerts" && ftMarket() !== "kr") ftList = null;
  ftSyncChips();
  ftApplyView();
  const wrap = byId("topStocksTableWrap");
  const core = ftCore();
  if (!wrap || !core) return;
  if (ftList) { ftRenderList(wrap, core); return; }
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

// ----- 목록(배당 랭킹 · 신규상장 · 관리·경보) -----
function ftFmtDate(iso) { return iso ? iso.replace(/-/g, ".") : "—"; }

function ftNameCell(rank, item, fallbackName, sub) {
  const name = item ? stockLabel(item) : fallbackName;
  const small = sub != null ? sub : (item && typeof stockSubLabel === "function" ? stockSubLabel(item) : "");
  return `<td class="ft-name">${rank != null ? `<span class="ft-rank">${rank}</span>` : ""}<span class="ft-name-text"><strong>${escapeHtml(name || "—")}</strong>${small ? `<small>${escapeHtml(small)}</small>` : ""}</span></td>`;
}

function ftTableHtml(head, body, cls) {
  return `<table class="compact-table table-wide ft-table ${cls || ""}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function ftSetMeta(text) {
  const meta = byId("topStocksMeta");
  if (meta) meta.textContent = text;
}

function ftPriceText(item) {
  if (!item) return "—";
  return ftDash(priceOrDash(item.price));
}

function ftRenderDividend(wrap, core) {
  const bucket = byId("topBucket")?.value;
  const base = (typeof data === "object" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  const scoped = bucket && typeof bucketMatches === "function"
    ? base.filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    : base;
  const all = core.dividendRanking(scoped, { fundFor: ftFund, calFor: ftCal, sanity: window.MirFundSanity || null });
  const rows = all.slice(0, FT_DIV_LIMIT);
  const us = ftMarket() === "us";
  const bucketLabel = typeof labelForSelect === "function" ? labelForSelect("topBucket") : "";
  ftSetMeta(`배당 랭킹 · ${bucketLabel ? `${bucketLabel} · ` : ""}배당수익률 순 · ${all.length.toLocaleString("ko-KR")}개${all.length > rows.length ? ` 중 상위 ${rows.length}개` : ""}`);
  if (!window.MAP_FUNDAMENTALS) {
    wrap.innerHTML = `<p class="ft-empty muted">배당 데이터를 불러오는 중입니다.</p>`;
    return;
  }
  if (!rows.length) {
    wrap.innerHTML = `<p class="ft-empty muted">이 그룹에는 배당수익률이 있는 종목이 없습니다.</p>`;
    return;
  }
  const outlierTip = window.MirFundSanity ? window.MirFundSanity.describe("divYield") : "";
  const head = `<th scope="col" class="ft-name">종목</th><th scope="col" class="num">현재가</th><th scope="col" class="num is-sorted" aria-sort="descending">배당수익률 ▼</th><th scope="col" class="num">주당배당금</th><th scope="col" class="num">배당성향</th><th scope="col" class="num">PER</th><th scope="col" class="num">시가총액</th><th scope="col">섹터</th>`;
  const body = rows.map((r, i) => {
    const item = r.item;
    const pe = Number(metricValue(item, "pe"));
    const [payHtml] = ftPayoutCell(r);
    const flag = r.outlier ? ` <span class="ft-flag" title="${escapeHtml(outlierTip)}">이상치 가능</span>` : "";
    return `<tr data-ticker="${escapeHtml(item.ticker)}" tabindex="0">
      ${ftNameCell(i + 1, item)}
      <td class="num">${ftPriceText(item)}</td>
      <td class="num">${r.divYield.toFixed(2)}%${flag}</td>
      <td class="num">${ftFmtDps(r.dps)}</td>
      <td class="num">${payHtml}</td>
      <td class="num">${Number.isFinite(pe) && pe > 0 ? pe.toFixed(1) : "—"}</td>
      <td class="num">${ftDash(fmtBillions(item.marketCapB))}</td>
      <td class="ft-text">${escapeHtml([item.sector, item.industry].filter(Boolean).join(" · ") || "—")}</td>
    </tr>`;
  }).join("");
  const asOf = (typeof data === "object" && data && data.updatedAtKst) || "";
  const calAt = us ? ((window.US_STOCK_CALENDAR || {}).updatedAtKst || "") : "";
  const note = us
    ? `배당수익률은 야후·나스닥의 최근 12개월 배당 ÷ 현재가(추정치)입니다. 주당배당금·배당성향은 시가총액 상위 약 200종목만 있습니다${calAt ? `(${escapeHtml(calAt)})` : ""}. 상위권에는 폐쇄형 펀드·신탁이 섞일 수 있고, 분배금에 원금 반환이 포함될 수 있습니다.`
    : `배당수익률·주당배당금은 네이버·KRX 공식 값, 배당성향은 DART 재무지표입니다(직전 사업연도 기준).`;
  wrap.innerHTML = ftTableHtml(head, body, "ft-list-table")
    + `<p class="ft-list-note">${note} 적자 기업은 배당성향을 계산하지 않습니다. ETF 제외. 과거 배당이 앞으로의 배당을 보장하지 않으며 투자 권유가 아닙니다.${asOf ? ` 가격 기준 ${escapeHtml(asOf)}.` : ""}</p>`;
}

function ftRenderIpo(wrap, core) {
  const kr = ftMarket() === "kr";
  const ipo = window.IPO_CALENDAR;
  const stocks = (typeof data === "object" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // KST 날짜
  if (!ipo || !Array.isArray(ipo.ipos)) {
    ftSetMeta("신규상장");
    wrap.innerHTML = `<p class="ft-empty muted">공모주 일정 데이터를 불러오는 중이거나 아직 없습니다.</p>`;
    return;
  }
  const rows = core.recentListings(kr ? "kr" : "us", ipo, stocks, today, { days: 90 });
  ftSetMeta(`신규상장 · 최근 90일 · ${rows.length}건`);
  if (!rows.length) {
    wrap.innerHTML = `<p class="ft-empty muted">최근 90일 안에 확인된 신규상장이 없습니다.</p>`;
    return;
  }
  const head = `<th scope="col" class="ft-name">종목</th><th scope="col" class="num">${kr ? "상장일" : "가격확정일"}</th><th scope="col" class="num">공모가</th><th scope="col" class="num">현재가</th><th scope="col" class="num">공모가 대비</th>${kr ? '<th scope="col">주관사</th>' : '<th scope="col">원문</th>'}`;
  const fmtOffer = (r) => {
    if (r.offerPrice == null) return "—";
    const v = kr ? `${Math.round(r.offerPrice).toLocaleString("ko-KR")}원` : `$${r.offerPrice.toFixed(2)}`;
    return r.offerUnit ? `${v} <span class="muted" title="SPAC 유닛당 가격이라 주가와 비교하지 않습니다">유닛</span>` : v;
  };
  const body = rows.map((r) => {
    const item = r.item;
    const ret = r.retPct != null
      ? `<span class="${cls(r.retPct)}">${fmtPct(r.retPct)}</span>`
      : (r.retSuspect ? `<span class="muted" title="현재가가 공모가와 10배 이상 차이 나 액면 변경·기존 상장사 공모일 가능성이 있어 계산하지 않습니다">비교 불가</span>` : "—");
    const sub = item ? null : "시세 미수집";
    const last = kr
      ? `<td class="ft-text">${escapeHtml(r.broker || "—")}</td>`
      : `<td class="ft-text">${r.link ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener" data-ft-ext>424B4</a>` : "—"}</td>`;
    return `<tr${item ? ` data-ticker="${escapeHtml(item.ticker)}" tabindex="0"` : ' class="is-static"'}>
      ${ftNameCell(null, item, kr ? r.company : `${r.ticker ? `${r.ticker} · ` : ""}${r.company}`, sub)}
      <td class="num">${ftFmtDate(r.date)}</td>
      <td class="num">${fmtOffer(r)}</td>
      <td class="num">${ftPriceText(item)}</td>
      <td class="num">${ret}</td>
      ${last}
    </tr>`;
  }).join("");
  const note = kr
    ? `38커뮤니케이션 신규상장 목록 기준. 공모가는 확정 공모가, 현재가는 스냅샷 종가라 상장 첫날 등락과 다릅니다.`
    : `SEC 424B4(공모가 확정) 공시 중 같은 회사의 S-1/F-1 등록 신청이 수집 기간에 있는 건만 보여 줍니다. 제출일은 실제 상장일과 하루 이틀 다를 수 있고, 기존 상장사의 공모가 섞일 수 있습니다.`;
  wrap.innerHTML = ftTableHtml(head, body, "ft-list-table")
    + `<p class="ft-list-note">${note} 정보 제공용이며 투자 권유가 아닙니다. 업데이트 ${escapeHtml(ipo.updatedAtKst || "")}.</p>`;
}

function ftRenderAlerts(wrap, core) {
  const al = window.KR_MARKET_ALERTS;
  if (!al || !al.sections) {
    ftSetMeta("관리·경보");
    wrap.innerHTML = `<p class="ft-empty muted">시장경보 데이터를 불러오는 중이거나 아직 없습니다.</p>`;
    return;
  }
  const stocks = (typeof data === "object" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  const counts = core.alertCounts(al);
  const rows = core.alertRows(al, stocks, ftAlertFilter);
  ftSetMeta(`관리종목·거래정지·시장경보 · ${rows.length}건`);
  const filters = [["all", "전체"], ["admin", "관리종목"], ["halt", "거래정지"], ["warn", "경고·위험"], ["caution", "주의"]];
  const chips = `<div class="ft-chips ft-subchips" role="group" aria-label="구분">${filters.map(([k, label]) => `<button type="button" class="ft-chip${ftAlertFilter === k ? " is-active" : ""}" data-ft-alert="${k}" aria-pressed="${ftAlertFilter === k ? "true" : "false"}">${label} ${counts[k] || 0}</button>`).join("")}</div>`;
  if (!rows.length) {
    wrap.innerHTML = chips + `<p class="ft-empty muted">해당 구분의 종목이 없습니다.</p>`;
    return;
  }
  const head = `<th scope="col" class="ft-name">종목</th><th scope="col">구분</th><th scope="col">사유·유형</th><th scope="col" class="num">지정일</th><th scope="col" class="num">현재가</th><th scope="col" class="num">등락률</th>`;
  const body = rows.map((r) => {
    const item = r.item;
    const chg = item && Number.isFinite(Number(item.changePct)) ? `<span class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</span>` : "—";
    return `<tr${item ? ` data-ticker="${escapeHtml(item.ticker)}" tabindex="0"` : ' class="is-static"'}>
      ${ftNameCell(null, item, r.company, item ? null : "시세 미수집")}
      <td><span class="ft-kind ft-kind-${r.group}">${escapeHtml(r.kindLabel)}</span></td>
      <td class="ft-text" title="${escapeHtml(r.detail)}">${escapeHtml(r.detail || "—")}</td>
      <td class="num">${ftFmtDate(r.date)}</td>
      <td class="num">${ftPriceText(item)}</td>
      <td class="num">${chg}</td>
    </tr>`;
  }).join("");
  const asOf = [...new Set(core.ALERT_KINDS.map((k) => (al.sections[k.key] || {}).asOf).filter(Boolean))].sort().pop() || al.baseDate || "";
  wrap.innerHTML = chips + ftTableHtml(head, body, "ft-list-table")
    + `<p class="ft-list-note">KRX KIND 지정 현황 · 기준일 ${escapeHtml(asOf)}. 매매 신호가 아니라 정보입니다.</p>`;
}

function ftRenderList(wrap, core) {
  if (ftList === "dividend") ftRenderDividend(wrap, core);
  else if (ftList === "ipo") ftRenderIpo(wrap, core);
  else if (ftList === "alerts") ftRenderAlerts(wrap, core);
}

function ftSetList(next) {
  ftList = next && next !== ftList ? next : null;
  if (!ftList) {
    // 일반 표로 돌아갈 땐 메타 글도 renderTopStocks 가 다시 쓰게 한다.
    if (typeof renderTopStocks === "function") { renderTopStocks(); return; }
  }
  ftRerender();
}

function ftSyncPresetChips() {
  const host = byId("findChipsPreset");
  if (!host) return;
  const presets = [["dividend", "배당 랭킹"], ["ipo", "신규상장"]];
  if (ftMarket() === "kr" && window.KR_MARKET_ALERTS) presets.push(["alerts", "관리·경보"]);
  const sig = presets.map((p) => p[0]).join("|") + `#${ftList || ""}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = presets.map(([k, label]) => `<button type="button" class="ft-chip ft-chip-list${ftList === k ? " is-active" : ""}" data-ft-list="${k}" aria-pressed="${ftList === k ? "true" : "false"}">${label}</button>`).join("");
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
  // 목록 모드에서는 정렬 지표 칩이 켜져 보이지 않게(목록은 자기 정렬을 쓴다).
  byId("findChipsMetric")?.querySelectorAll(".ft-chip").forEach((b) => {
    const on = !ftList && b.dataset.value === byId("topMetric")?.value;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  ftSyncPresetChips();
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
    const listChip = e.target.closest("[data-ft-list]");
    if (listChip) { ftSetList(listChip.dataset.ftList); return; }
    const chip = e.target.closest(".ft-chip");
    if (chip) {
      // 정렬 지표 칩은 목록 모드를 끈다. 지수/그룹 칩은 배당 랭킹 범위로도 쓰므로 목록을 유지한다.
      const leaving = ftList && chip.dataset.select === "topMetric";
      if (leaving) ftList = null;
      const sel = byId(chip.dataset.select);
      if (sel && sel.value === chip.dataset.value) { if (leaving && typeof renderTopStocks === "function") renderTopStocks(); return; }
      ftSetSelect(chip.dataset.select, chip.dataset.value);
      return;
    }
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
      if (e.target.closest("[data-ft-ext]")) return; // 원문 링크는 새 탭으로만
      const af = e.target.closest("[data-ft-alert]");
      if (af) { ftAlertFilter = af.dataset.ftAlert; ftRerender(); return; }
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
