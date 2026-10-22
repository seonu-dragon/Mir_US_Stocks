// cb-overhang.js — 국내 미상환 CB·BW 오버행 표시(국내 모드 전용)
// =====================================================
// 데이터 KR_CB_OVERHANG(scripts/build_kr_cb_overhang.py, feature-data 'krCbOverhang' lazy), 계산은 cb-overhang-core.js.
// 두 군데에 붙는다.
//  1) 종목 헤더 경고(cbOverhangNotice) — 잠재 희석률 10% 이상일 때만
//  2) 종목 상세 › 이벤트 탭의 작은 카드(#krCbOverhangCard) — 회차별 전환·행사가액·만기·잔액·주식수

function cbOverhangPayload() { return window.KR_CB_OVERHANG || null; }

function cbOverhangToday() {
  return window.MirCalendarCore ? window.MirCalendarCore.kstToday() : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

function cbOverhangInfo(item) {
  const ticker = item && item.ticker;
  if (!ticker || !isKrMarket() || !window.MirCbOverhangCore || !cbOverhangPayload()) return null;
  return window.MirCbOverhangCore.forTicker(cbOverhangPayload(), ticker, cbOverhangToday());
}

// 1) 헤더 경고. 데이터가 아직 없으면 ""(renderSearch 가 받은 뒤 헤더를 다시 그린다).
function cbOverhangNotice(item) {
  const info = cbOverhangInfo(item);
  const text = window.MirCbOverhangCore ? window.MirCbOverhangCore.badgeText(info) : "";
  if (!text) return "";
  return `
      <p class="audit-notice audit-emphasis cbo-notice">
        <b>${escapeHtml(text)}</b>
        <span>${escapeHtml(info.baseDate)} 기준 · 전환·행사 가능 ${escapeHtml(window.MirCbOverhangCore.fmtShares(info.shares))}</span>
      </p>`;
}

// 2) 이벤트 탭 카드. 미상환 물량이 남은 종목만.
function renderCbOverhangCard(item) {
  const host = byId("krCbOverhangCard");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const ticker = item && item.ticker;
  if (!ticker || !isKrMarket() || !window.MirCbOverhangCore) return hide();
  if (!cbOverhangPayload()) {
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("krCbOverhang").then((ok) => { if (ok && selectedTicker === ticker) renderCbOverhangCard(item); });
    }
    return hide();
  }
  const core = window.MirCbOverhangCore;
  const info = cbOverhangInfo(item);
  if (!info) return hide();
  const rows = info.rows.map((r) => `<tr>
      <td>${escapeHtml(core.kindLabel(r.kind))}${r.seq ? ` <span class="ins-sub">${escapeHtml(r.seq)}</span>` : ""}</td>
      <td class="num">${r.price ? `${escapeHtml(Number(r.price).toLocaleString("en-US"))}원` : "—"}</td>
      <td class="ins-date">${escapeHtml(r.maturity || "—")}</td>
      <td class="num">${escapeHtml(core.fmtWon(r.remaining) || "—")}</td>
      <td class="num">${escapeHtml(core.fmtShares(r.shares) || "—")}</td>
    </tr>`).join("");
  const badge = core.badgeText(info);
  const head = badge
    ? `<span class="cbo-badge">${escapeHtml(badge)}</span>`
    : (info.pct != null ? `<span class="muted">잠재 희석 ${escapeHtml(core.fmtPct(info.pct))}</span>` : "");
  host.hidden = false;
  host.innerHTML = `<div class="es-card-head"><h3>미상환 CB·BW</h3>${head}</div>
    <div class="lk-table-wrap"><table class="insider-table lk-table cbo-table"><thead><tr><th>종류</th><th class="num">전환·행사가</th><th>만기</th><th class="num">미상환 잔액</th><th class="num">주식수</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted lk-note">${escapeHtml(info.baseDate)} 기준${info.link ? ` · <a href="${escapeHtml(krPanelHref(info.link))}" target="_blank" rel="noopener">${escapeHtml(info.report || "DART 원문")}</a>` : ""}</p>`;
}
