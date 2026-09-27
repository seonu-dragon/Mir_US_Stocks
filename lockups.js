// lockups.js — 국내 의무보유(보호예수) 해제 표시(국내 모드 전용)
// =====================================================
// 데이터 KR_LOCKUPS(scripts/build_kr_lockups.py, feature-data 'krLockups' lazy), 계산은 lockup-core.js.
// 세 군데에 붙는다.
//  1) 종목 상세 › 이벤트 탭의 작은 카드(#krLockupCard) — 다가오는 해제 일정 + 공모 수요예측·청약 결과
//  2) 종목 › 공시 › 증자·CB(희석·오버행) 표 위 한 줄 목록(#dilutionLockups) — 30일 안 해제 물량
//  3) 통합 캘린더의 '보호예수 해제' 칩(calendar-panel.js · calendar-panel-core.js fromKrLockups)
// 해제일은 상장일 + 매각제한 기간으로 계산한 추정일이고, '매도 가능해지는 날' 이지 매도 예정이 아니다.

const LOCKUP_DISCLAIMER = "해제일은 상장일 + 매각제한 기간으로 계산한 추정일입니다(휴일이면 다음 영업일, 우리사주는 예탁일 기준). "
  + "매도가 가능해지는 날일 뿐 매도 예정이 아니며, 기관 수요예측 확약 배정 물량은 포함되지 않습니다. 투자 권유가 아닙니다.";

function lockupPayload() { return window.KR_LOCKUPS || null; }

function lockupToday() {
  return window.MirCalendarCore ? window.MirCalendarCore.kstToday() : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

function lockupEnsure(then) {
  if (lockupPayload()) return true;
  if (typeof ensureFeatureData === "function") ensureFeatureData("krLockups").then((ok) => { if (ok) then(); });
  return false;
}

// 통합 캘린더를 '보호예수 해제' 칩으로 연다(calendar-panel.js 가 첫 렌더 때 읽고 지운다).
function openLockupCalendar() {
  window._calPanelPendingKind = "lockup";
  if (typeof activateTab === "function") activateTab("calendar", { sub: "all" });
}

// ---------------------------------------------------------------- 1) 종목 상세 카드
function renderLockupCard(item) {
  const host = byId("krLockupCard");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const ticker = item && item.ticker;
  if (!ticker || !isKrMarket() || !window.MirLockupCore) return hide();
  if (!lockupEnsure(() => { if (selectedTicker === ticker) renderLockupCard(item); })) return hide();
  const core = window.MirLockupCore;
  const today = lockupToday();
  const info = core.forTicker(lockupPayload(), ticker, today);
  // 최근 해제가 지난 지 오래고 남은 일정도 없으면(상장 오래된 종목) 카드를 띄우지 않는다.
  if (!info || (!info.upcoming.length && !info.recent.length && !(info.ipo && info.ipo.listingDate >= core.isoAddDays(today, -400)))) return hide();
  const price = Number(item.price);
  const rows = info.upcoming.slice(0, 6).map((r) => {
    const val = core.valueAtPrice(r.shares, price);
    return `<tr>
      <td class="ins-date">${escapeHtml(r.date)} <span class="ins-sub">${escapeHtml(core.relLabel(today, r.date))}</span></td>
      <td>${escapeHtml((r.periods || []).join("·"))}</td>
      <td class="num">${escapeHtml(core.fmtShares(r.shares))}${val ? `<div class="ins-sub">현재가 환산 ${escapeHtml(core.fmtWon(val))}</div>` : ""}</td>
      <td class="num"><strong>${r.pct != null ? `${Number(r.pct).toFixed(1)}%` : "—"}</strong></td>
      <td class="lk-types">${escapeHtml(core.typeLine(r.types))}</td>
    </tr>`;
  }).join("");
  const ipo = info.ipo;
  const stats = core.ipoStats(ipo);
  const statHtml = stats.length ? `<dl class="lk-stats">${stats.map((s) => `<div><dt>${escapeHtml(s.k)}</dt><dd>${escapeHtml(s.v)}${s.note ? `<small class="muted"> ${escapeHtml(s.note)}</small>` : ""}</dd></div>`).join("")}</dl>` : "";
  let body;
  if (rows) {
    body = `<div class="lk-table-wrap"><table class="insider-table lk-table"><thead><tr><th>해제일(추정)</th><th>상장 후</th><th class="num">주식수</th><th class="num">상장일 주식수 대비</th><th>구성</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else if (ipo && ipo.noTable) {
    body = `<p class="muted">이 종목은 공모주 상세에 보호예수 표가 없어(2025년 이전 상장 양식) 해제 일정을 싣지 못했습니다.</p>`;
  } else if (ipo && ipo.verified === false) {
    body = `<p class="muted">보호예수 표를 자동으로 읽은 합계가 표의 합계와 맞지 않아 해제 일정을 싣지 않았습니다. 원문을 확인하세요.</p>`;
  } else {
    const last = info.recent[info.recent.length - 1];
    body = `<p class="muted">다가오는 보호예수 해제가 없습니다.${last ? ` 마지막 해제 ${escapeHtml(last.date)}(${escapeHtml((last.periods || []).join("·"))}).` : ""}</p>`;
  }
  const src = (info.next && info.next.link) || (ipo && ipo.no ? `https://www.38.co.kr/html/fund/?o=v&no=${encodeURIComponent(ipo.no)}` : "");
  host.hidden = false;
  host.innerHTML = `<div class="es-card-head"><h3>보호예수 해제</h3><span class="muted">신규 상장주 의무보유 물량${ipo && ipo.listingDate ? ` · 상장 ${escapeHtml(ipo.listingDate)}` : ""}</span></div>
    ${body}
    ${statHtml}
    <p class="muted lk-note">${escapeHtml(LOCKUP_DISCLAIMER)}
      ${src ? `<a href="${escapeHtml(src)}" target="_blank" rel="noopener">원문(38커뮤니케이션)</a> · ` : ""}<button type="button" class="es-link is-inline" data-lk-calendar>캘린더에서 보기</button></p>`;
  if (!host.dataset.lkBound) {
    host.dataset.lkBound = "1";
    host.addEventListener("click", (ev) => { if (ev.target.closest("[data-lk-calendar]")) openLockupCalendar(); });
  }
}

// ---------------------------------------------------------------- 2) 증자·CB(오버행) 트래커 위 목록
function renderLockupOverhang() {
  const host = byId("dilutionLockups");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  if (!isKrMarket() || !window.MirLockupCore) return hide();
  if (!lockupEnsure(renderLockupOverhang)) return hide();
  const core = window.MirLockupCore;
  const today = lockupToday();
  const rows = core.upcomingWithin(lockupPayload(), today, 30, 1).slice(0, 8);
  if (!rows.length) return hide();
  const items = rows.map((r) => {
    const row = typeof stockByTicker === "function" ? stockByTicker(r.code) : null;
    const name = escapeHtml(r.company || r.code);
    const who = row ? `<button type="button" class="ins-ticker" data-ticker="${escapeHtml(row.ticker)}">${name}</button>` : `<span>${name}</span>`;
    return `<li>${who}
      <span class="lk-ov-date">${escapeHtml(r.date.slice(5).replace("-", "/"))} ${escapeHtml(core.relLabel(today, r.date))}</span>
      <strong class="lk-ov-pct">${Number(r.pct).toFixed(1)}%</strong>
      <span class="muted">${escapeHtml((r.periods || []).join("·"))} · ${escapeHtml(core.fmtShares(r.shares))}</span></li>`;
  }).join("");
  host.hidden = false;
  host.innerHTML = `<div class="lk-ov-head"><strong>다가오는 보호예수 해제</strong><span class="muted">30일 안 · 상장일 주식수 대비 1% 이상 · 추정일</span>
      <button type="button" class="es-link is-inline" data-lk-calendar>캘린더에서 전체 보기</button></div>
    <ul class="lk-ov-list">${items}</ul>`;
  if (!host.dataset.lkBound) {
    host.dataset.lkBound = "1";
    host.addEventListener("click", (ev) => { if (ev.target.closest("[data-lk-calendar]")) openLockupCalendar(); });
    if (typeof delegateTickerClicks === "function") delegateTickerClicks(host, ".ins-ticker");
  }
}
