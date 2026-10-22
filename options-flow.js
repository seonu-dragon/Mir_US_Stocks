// options-flow.js — 옵션 포지션(미국 전용)
// =====================================================
// 데이터: data/options_flow.js(window.OPTIONS_FLOW, lazy — scripts/build_options_flow.py, 야후 옵션 체인 45일 안 만기).
// 계산은 options-flow-core.js(MirOptionsFlowCore). 두 곳에 그린다:
//   - 종목 분석 › 수급·보유 탭 '옵션 포지션' 카드(renderOptionsFlowCard) — 행사가별 감마 노출(추정)·이 종목 이상 거래
//   - 시장 › 시그널 '이상 옵션 거래' 위젯(renderUoaWidget) — 시장 전체 거래대금 상위
// 콜·풋은 오르내림이 아니라 종류라 등락색을 쓰지 않는다.

function ofFlowTabOpen() {
  return typeof sdActiveView !== "function" || sdActiveView() === "flow";
}

function renderOptionsFlowCard(item) {
  const host = byId("optionsFlowCard");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const core = window.MirOptionsFlowCore;
  const ticker = item && item.ticker;
  if (!ticker || !core || isKrMarket() || featureOff("optionsFlow")) return hide();
  if (!ofFlowTabOpen()) return;
  const p = window.OPTIONS_FLOW;
  if (!p) {
    ensureFeatureData("optionsFlow").then((ok) => {
      if (selectedTicker !== ticker) return;
      if (ok) renderOptionsFlowCard(item);
      else { host.hidden = false; host.innerHTML = optionsFlowPendingHtml(); }   // 파일 없음·실패 — 조용히 사라지지 않는다
    });
    return;
  }
  const s = core.summarize(p, ticker);
  if (!s) return hide();
  host.hidden = false;
  host.innerHTML = optionsFlowCardHtml(s, core);
}

const OF_PENDING_TEXT = "옵션 포지션 데이터 준비 중";

function optionsFlowPendingHtml() {
  return `<div class="fundamental-head"><h3>옵션 포지션</h3></div><p class="muted of-meta of-pending">${OF_PENDING_TEXT}</p>`;
}

function optionsFlowCardHtml(s, core) {
  const rows = core.scale(core.bucket(s.strikes, 24)).reverse();   // 높은 행사가가 위
  const spotIn = (b) => s.spot >= b.lo && s.spot <= b.hi;
  const tag = (b) => [
    s.callWall >= b.lo && s.callWall <= b.hi ? "콜 월" : "",
    s.putWall >= b.lo && s.putWall <= b.hi ? "풋 월" : "",
    s.flip != null && s.flip >= b.lo && s.flip <= b.hi ? "전환" : "",
  ].filter(Boolean).join(" · ");
  const bars = rows.map((b) => {
    const label = b.lo === b.hi ? core.fmtStrike(b.lo) : `${core.fmtStrike(b.lo)}–${core.fmtStrike(b.hi)}`;
    const t = tag(b);
    return `<div class="of-row${spotIn(b) ? " is-spot" : ""}" title="${escapeHtml(`${label} · 콜 ${core.fmtUsd(b.call)} · 풋 ${core.fmtUsd(b.put)}`)}">
      <span class="of-k">${escapeHtml(label)}</span>
      <span class="of-put"><i style="width:${(b.pw * 100).toFixed(1)}%"></i></span>
      <span class="of-call"><i style="width:${(b.cw * 100).toFixed(1)}%"></i></span>
      <span class="of-tag">${escapeHtml(spotIn(b) ? (t ? `현재가 · ${t}` : "현재가") : t)}</span>
    </div>`;
  }).join("");
  const reg = core.regime(s.netGex);
  const uoa = s.uoa.length
    ? `<div class="table-wrap of-uoa-wrap"><table class="insider-table of-uoa"><thead><tr><th>만기</th><th>종류</th><th class="ins-num">행사가</th><th class="ins-num">거래량</th><th class="ins-num">미결제</th><th class="ins-num">배수</th><th class="ins-num">거래대금</th></tr></thead><tbody>${s.uoa.map((r) => `<tr><td>${escapeHtml(core.shortExpiry(r.expiry))}</td><td>${r.type === "C" ? "콜" : "풋"}</td><td class="ins-num">${escapeHtml(core.fmtStrike(r.strike))}</td><td class="ins-num">${Number(r.volume).toLocaleString("ko-KR")}</td><td class="ins-num">${Number(r.oi).toLocaleString("ko-KR")}</td><td class="ins-num">${escapeHtml(String(r.volOi))}배</td><td class="ins-num">${escapeHtml(core.fmtUsd(r.premium))}</td></tr>`).join("")}</tbody></table></div>`
    : "";
  return `<div class="fundamental-head"><h3>옵션 포지션 <span class="synth-badge" title="딜러가 콜은 사고 풋은 판 것으로 가정한 블랙-숄즈 추정치">추정</span></h3><span>${escapeHtml(String(s.expiries))}개 만기 합산</span></div>
    <div class="ih-stats of-stats">
      ${ihStatSafe("순감마 노출(1% 기준)", core.fmtUsd(s.netGex, true), reg.text)}
      ${ihStatSafe("콜 월", core.fmtStrike(s.callWall), "콜 감마가 가장 큰 행사가")}
      ${ihStatSafe("풋 월", core.fmtStrike(s.putWall), "풋 감마가 가장 큰 행사가")}
      ${ihStatSafe("감마 전환점", s.flip != null ? core.fmtStrike(s.flip) : "—", `현재가 ${core.fmtStrike(s.spot)}`)}
      ${s.maxPain != null ? ihStatSafe("맥스페인", core.fmtStrike(s.maxPain), s.maxPainExpiry ? `${core.shortExpiry(s.maxPainExpiry)} 만기` : "") : ""}
    </div>
    <div class="of-chart" role="img" aria-label="행사가별 감마 노출 — 왼쪽 풋, 오른쪽 콜">
      <div class="of-row of-head"><span class="of-k">행사가</span><span class="of-put">풋</span><span class="of-call">콜</span><span class="of-tag"></span></div>
      ${bars}
    </div>
    ${uoa ? `<h4 class="of-sub">이 종목 이상 거래</h4>${uoa}` : ""}`;
}

function renderUoaWidget() {
  const host = typeof byId === "function" ? byId("optionsUoa") : null;
  if (!host) return;
  const core = window.MirOptionsFlowCore;
  if (!core || isKrMarket() || featureOff("optionsFlow")) { host.innerHTML = ""; return; }
  const p = window.OPTIONS_FLOW;
  if (!p) {
    host.innerHTML = "";
    ensureFeatureData("optionsFlow").then((ok) => {
      if (ok) { if (typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); }
      else if (!window.OPTIONS_FLOW) host.innerHTML = `<p class="muted of-meta of-pending">${OF_PENDING_TEXT}</p>`;
    });
    return;
  }
  const rows = core.marketUoa(p, 20);
  if (!rows.length) { host.innerHTML = ""; return; }
  host.innerHTML = `<p class="muted of-meta">${escapeHtml(String(p.updatedAtKst || ""))} 기준</p>
    <div class="table-wrap of-uoa-wrap"><table class="insider-table of-uoa"><thead><tr><th>종목</th><th>만기</th><th>종류</th><th class="ins-num">행사가</th><th class="ins-num">거래량</th><th class="ins-num">배수</th><th class="ins-num">거래대금</th></tr></thead><tbody>${rows.map((r) => `<tr><td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(r.ticker)}</button></td><td>${escapeHtml(core.shortExpiry(r.expiry))}</td><td>${r.type === "C" ? "콜" : "풋"}</td><td class="ins-num">${escapeHtml(core.fmtStrike(r.strike))}</td><td class="ins-num">${Number(r.volume).toLocaleString("ko-KR")}</td><td class="ins-num">${escapeHtml(String(r.volOi))}배</td><td class="ins-num">${escapeHtml(core.fmtUsd(r.premium))}</td></tr>`).join("")}</tbody></table></div>`;
  host.querySelectorAll(".ins-ticker[data-ticker]").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}
