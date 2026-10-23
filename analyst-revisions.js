// analyst-revisions.js — 미국 애널리스트 의견 변경 · EPS 추정치 변화 화면.
// =====================================================
// 1) 시장 › 시그널 '애널리스트 의견 변경 (미국)' 위젯(#ratingChanges) — window.US_RATING_CHANGES(최근 30일).
// 2) 시장 › 시그널 'EPS 추정치 변화 (미국)' 위젯(#estimateRevisions) — window.US_ESTIMATE_REVISIONS 30일 상향·하향 상위.
// 3) 종목 상세 재무 탭 '실적 추정치 변화' 카드(#estimateRevisionCard) — 서버 수집값(7·30·60·90일 전 컨센서스 +
//    상향·하향 애널리스트 수 + 매출 컨센서스(평균·최저·최고·전년 대비·추정 수) + 최근 의견 변경). 데이터에 없는 종목은 app.js 의 기존 브라우저 기록 카드로 돌아간다.
// 데이터는 둘 다 lazy(FEATURE_DATA usRatingChanges · usEstimateRevisions, US 전용). 계산은 analyst-revisions-core.js.
// 클래식 스크립트 — 최상위 이름은 ar 접두사.

let arFeedKind = "all";
let arFeedShown = 0;
const AR_FEED_LIMIT = 30;
const AR_FEED_STEP = 100;

function arEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s); }
function arIsUs() { return !(typeof isKrMarket === "function" && isKrMarket()); }
function arDisabled(key) {
  const cfg = typeof marketCfg === "function" ? marketCfg() : null;
  return !!(cfg && cfg.features && cfg.features[key] === false);
}

// lazy 데이터셋을 받아 두고, 도착하면 보이는 화면을 다시 그리게 한다(시그널 위젯 숨김 상태도 다시 맞춘다).
function arEnsure(key) {
  if (typeof ensureFeatureData !== "function") return;
  ensureFeatureData(key).then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
}

function arTone(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "";
  return n > 0 ? "ar-up" : "ar-down";
}

function arMoney(v) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "—";
  return `$${Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function arEps(v) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "—";
  return `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
}

function arTickerBtn(t) {
  return `<button type="button" class="ins-ticker" data-ticker="${arEsc(t)}">${arEsc(t)}</button>`;
}

function arBindTickers(host) {
  host.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.ticker && typeof selectTicker === "function") selectTicker(b.dataset.ticker, { openSearch: true });
  }));
}

// ----- 1) 의견 변경 피드 -----
function renderRatingChanges() {
  const host = typeof byId === "function" ? byId("ratingChanges") : null;
  if (!host) return;
  const core = window.MirAnalystRevCore;
  if (!core || !arIsUs() || arDisabled("analystRevisions")) { host.innerHTML = ""; return; }
  const src = window.US_RATING_CHANGES;
  if (!src) { host.innerHTML = ""; arEnsure("usRatingChanges"); return; }
  const rows = core.feedRows(src);
  if (!rows.length) { host.innerHTML = ""; return; }
  const counts = core.kindCounts(rows);
  if (!counts[arFeedKind]) arFeedKind = "all";
  const list = core.filterFeed(rows, arFeedKind);
  const shown = list.slice(0, Math.max(AR_FEED_LIMIT, arFeedShown));
  const chips = Object.keys(core.KIND_LABEL).map((k) => `<button type="button" class="ft-chip${arFeedKind === k ? " is-active" : ""}" data-ar-kind="${k}" aria-pressed="${arFeedKind === k}">${arEsc(core.KIND_LABEL[k])} ${counts[k].toLocaleString("en-US")}</button>`).join("");
  const body = shown.map((r) => {
    const pt = r.pt == null ? "—" : r.ptPrev == null ? arMoney(r.pt) : `${arMoney(r.ptPrev)} → ${arMoney(r.pt)}`;
    const actCls = r.act === "up" ? "ar-up" : r.act === "down" ? "ar-down" : "";
    return `<tr><td class="ins-date">${arEsc(r.d)}</td><td>${arTickerBtn(r.t)}</td><td>${arEsc(r.firm)}</td>
      <td class="${actCls}">${arEsc(core.actionLabel(r.act))}</td><td>${arEsc(core.gradeText(r))}</td>
      <td class="ins-num">${pt}</td><td class="ins-num ${arTone(r.ptChg)}">${core.fmtPct(r.ptChg)}</td></tr>`;
  }).join("");
  const more = list.length > shown.length
    ? `<button type="button" class="ia-link ar-more" data-ar-more="1">${Math.min(AR_FEED_STEP, list.length - shown.length).toLocaleString("en-US")}건 더 보기 (남은 ${(list.length - shown.length).toLocaleString("en-US")}건)</button>` : "";
  host.innerHTML = `
    <div class="section-title"><h2>애널리스트 의견 변경 (미국)</h2></div>
    <div class="ar-card">
      <div class="ft-chips ft-subchips ar-chips" role="group" aria-label="의견 변경 종류">${chips}</div>
      <div class="table-wrap ar-table-wrap"><table class="insider-table ar-table"><thead><tr><th>날짜</th><th>종목</th><th>증권사</th><th>행동</th><th>투자의견</th><th class="ins-num">목표가</th><th class="ins-num">목표가 변화</th></tr></thead><tbody>${body}</tbody></table></div>
      ${more}
      <p class="ar-foot">최근 ${arEsc(src.windowDays || 30)}일 · 시가총액 상위 ${arEsc(src.scanned || "")}종목 · 업데이트 ${arEsc(src.updatedAtKst || "")}</p>
    </div>`;
  host.querySelectorAll("[data-ar-kind]").forEach((b) => b.addEventListener("click", () => { arFeedKind = b.dataset.arKind; arFeedShown = 0; renderRatingChanges(); }));
  const mb = host.querySelector("[data-ar-more]");
  if (mb) mb.addEventListener("click", () => { arFeedShown = shown.length + AR_FEED_STEP; renderRatingChanges(); });
  arBindTickers(host);
}

// ----- 2) EPS 추정치 상향·하향 상위 -----
function arLeaderTable(rows, core) {
  if (!rows.length) return `<p class="muted ar-empty">해당 종목 없음</p>`;
  const body = rows.map((r) => `<tr><td>${arTickerBtn(r.ticker)}</td><td class="ins-num ${arTone(r.chg30)}"><strong>${core.fmtPct(r.chg30)}</strong></td>
    <td class="ins-num">${arEps(r.d30)} → ${arEps(r.cur)}</td><td class="ins-num"><span class="ar-up">${r.up30 == null ? "—" : r.up30}</span> / <span class="ar-down">${r.dn30 == null ? "—" : r.dn30}</span></td><td class="ins-num">${r.n}</td></tr>`).join("");
  return `<div class="table-wrap ar-table-wrap"><table class="insider-table ar-table"><thead><tr><th>종목</th><th class="ins-num">30일 변화</th><th class="ins-num">EPS 추정 (30일 전 → 현재)</th><th class="ins-num">상향 / 하향</th><th class="ins-num">추정 수</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderEstimateRevisions() {
  const host = typeof byId === "function" ? byId("estimateRevisions") : null;
  if (!host) return;
  const core = window.MirAnalystRevCore;
  if (!core || !arIsUs() || arDisabled("analystRevisions")) { host.innerHTML = ""; return; }
  const src = window.US_ESTIMATE_REVISIONS;
  if (!src) { host.innerHTML = ""; arEnsure("usEstimateRevisions"); return; }
  const lead = core.revisionLeaders(src, { period: "0y", minAnalysts: 5, limit: 10 });
  if (!lead.breadth.total) { host.innerHTML = ""; return; }
  const b = lead.breadth;
  host.innerHTML = `
    <div class="section-title"><h2>EPS 추정치 변화 (미국)</h2></div>
    <div class="ar-card">
      <div class="ar-breadth"><span>올해 회계연도 EPS · 30일 변화</span><span><b class="ar-up">상향 ${b.up.toLocaleString("en-US")}</b> · <b class="ar-down">하향 ${b.down.toLocaleString("en-US")}</b> · 보합 ${b.flat.toLocaleString("en-US")} / ${b.total.toLocaleString("en-US")}종목</span></div>
      <div class="ar-lead-grid">
        <section><h3>상향 상위</h3>${arLeaderTable(lead.up, core)}</section>
        <section><h3>하향 상위</h3>${arLeaderTable(lead.down, core)}</section>
      </div>
      <p class="ar-foot">추정 애널리스트 5명 이상 · 업데이트 ${arEsc(src.updatedAtKst || "")}</p>
    </div>`;
  arBindTickers(host);
}

// ----- 3) 종목 상세 '실적 추정치 변화' 카드 -----
// 그렸으면 true. 데이터에 없는 종목·국내·데이터 도착 전이면 false(app.js 의 기존 카드가 그린다).
function renderEstimateRevisionServer(item) {
  const box = typeof byId === "function" ? byId("estimateRevisionCard") : null;
  const core = window.MirAnalystRevCore;
  if (!box || !item || !core || !arIsUs() || arDisabled("analystRevisions")) return false;
  const src = window.US_ESTIMATE_REVISIONS;
  if (!src) { arEnsure("usEstimateRevisions"); return false; }
  const ticker = String(item.ticker || "").toUpperCase();
  const rows = core.estimateRows(src, ticker);
  const ratings = core.tickerRatings(src, ticker);
  const revRows = core.revenueRows ? core.revenueRows(src, ticker) : [];
  if (!rows.length && !ratings.length && !revRows.length) return false;
  const label = typeof stockLabel === "function" ? stockLabel(item) : ticker;
  const estTable = rows.length ? `<div class="table-wrap ar-table-wrap"><table class="insider-table ar-table ar-est-table"><thead><tr><th>기간</th><th class="ins-num">현재</th><th class="ins-num">7일 전</th><th class="ins-num">30일 전</th><th class="ins-num">90일 전</th><th class="ins-num">30일 변화</th><th class="ins-num">90일 변화</th><th class="ins-num">상향 / 하향 (30일)</th><th class="ins-num">추정 수</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><th scope="row">${arEsc(r.label)}${r.end ? `<small class="ar-end">${arEsc(String(r.end).slice(0, 7))}</small>` : ""}</th>
      <td class="ins-num"><strong>${arEps(r.cur)}</strong></td><td class="ins-num">${arEps(r.d7)}</td><td class="ins-num">${arEps(r.d30)}</td><td class="ins-num">${arEps(r.d90)}</td>
      <td class="ins-num ${arTone(r.chg30)}">${core.fmtPct(r.chg30)}</td><td class="ins-num ${arTone(r.chg90)}">${core.fmtPct(r.chg90)}</td>
      <td class="ins-num"><span class="ar-up">${r.up30 == null ? "—" : r.up30}</span> / <span class="ar-down">${r.dn30 == null ? "—" : r.dn30}</span></td><td class="ins-num">${r.n == null ? "—" : r.n}</td></tr>`).join("")}
    </tbody></table></div>` : "";
  const revMoney = (v, cur) => (v == null ? "—" : typeof mfMoney === "function" ? mfMoney(v, cur || "USD") : String(v));
  const revTable = revRows.length ? `<h4 class="ar-sub">매출 컨센서스${revRows[0].cur && revRows[0].cur !== "USD" ? ` <small class="ar-end">${arEsc(revRows[0].cur)}</small>` : ""}</h4><div class="table-wrap ar-table-wrap"><table class="insider-table ar-table ar-rev-table"><thead><tr><th>기간</th><th class="ins-num">평균</th><th class="ins-num">최저</th><th class="ins-num">최고</th><th class="ins-num">전년 대비</th><th class="ins-num">추정 수</th></tr></thead><tbody>
    ${revRows.map((r) => `<tr><th scope="row">${arEsc(r.label)}${r.end ? `<small class="ar-end">${arEsc(String(r.end).slice(0, 7))}</small>` : ""}</th>
      <td class="ins-num"><strong>${arEsc(revMoney(r.avg, r.cur))}</strong></td><td class="ins-num">${arEsc(revMoney(r.low, r.cur))}</td><td class="ins-num">${arEsc(revMoney(r.high, r.cur))}</td>
      <td class="ins-num ${arTone(r.yoy)}">${core.fmtPct(r.yoy)}</td><td class="ins-num">${r.n == null ? "—" : r.n}</td></tr>`).join("")}
    </tbody></table></div>` : "";
  const rateTable = ratings.length ? `<h4 class="ar-sub">최근 의견 변경</h4><div class="table-wrap ar-table-wrap"><table class="insider-table ar-table"><thead><tr><th>날짜</th><th>증권사</th><th>행동</th><th>투자의견</th><th class="ins-num">목표가</th></tr></thead><tbody>
    ${ratings.map((r) => {
      const actCls = r.act === "up" ? "ar-up" : r.act === "down" ? "ar-down" : "";
      const pt = r.pt == null ? "—" : r.ptPrev == null ? arMoney(r.pt) : `${arMoney(r.ptPrev)} → ${arMoney(r.pt)}`;
      return `<tr><td class="ins-date">${arEsc(r.d)}</td><td>${arEsc(r.firm)}</td><td class="${actCls}">${arEsc(core.actionLabel(r.act))}</td><td>${arEsc(core.gradeText(r))}</td><td class="ins-num">${pt}</td></tr>`;
    }).join("")}
    </tbody></table></div>` : "";
  box.hidden = false;
  box.innerHTML = `
    <div class="estimate-revision-head">
      <div><span>컨센서스 EPS</span><h3>실적 추정치 변화</h3></div>
      <strong>${arEsc(label)} · 업데이트 ${arEsc(src.updatedAtKst || "")}</strong>
    </div>
    ${estTable}${revTable}${rateTable}`;
  return true;
}
