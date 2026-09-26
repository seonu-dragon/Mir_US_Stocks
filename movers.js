// movers.js — 오늘의 특징주(장 마감 기준 크게 움직인 종목 + 한 줄 사유)
// =====================================================
// 데이터: data/movers_reasons.js (US) · data/korea/movers_reasons.js (KR)
//   = window.MOVERS_REASONS, scripts/build_movers_reasons.py 가 장 마감 후 하루 1회 만든다.
//   FEATURE_DATA.movers(marketSpecific) 로 시장별 파일을 받고, 시장 전환 시 전역이 지워진다.
// 화면: 오늘 탭 › 요약의 "오늘의 특징주" 카드(상승/하락 탭), 종목 분석의 "왜 상승했나?"
//   상자 맨 위 한 줄. 사유는 공시·뉴스 헤드라인·업종 평균만 근거로 한 자동 요약이다 —
//   근거가 없으면 "뚜렷한 재료 확인 안 됨", 검증을 통과 못 하면 "요약 실패" 로 보여 준다.
// 클래식 스크립트(전역 공유). 최상위 이름은 movers 접두로 충돌을 피한다.

let moversSide = "up";

const MOVERS_STATUS_TEXT = {
  none: "뚜렷한 재료 확인 안 됨",
  failed: "요약 실패",
};

function moversPayload() {
  const p = window.MOVERS_REASONS;
  if (!p || !Array.isArray(p.up) || !Array.isArray(p.down)) return null;
  // 파일은 시장별이지만, 혹시 남은 반대 시장 전역을 그리지 않도록 한 번 더 확인한다.
  const market = (typeof marketCfg === "function" ? marketCfg().id : "us");
  if (p.market && p.market !== market) return null;
  return p;
}

function moversEntryFor(ticker) {
  const p = moversPayload();
  if (!p || !ticker) return null;
  const t = String(ticker).toUpperCase();
  return [...p.up, ...p.down].find((row) => String(row.ticker).toUpperCase() === t) || null;
}

function moversTagChips(row) {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  return tags.map((tag) => `<span class="movers-tag movers-tag-${tag === "섹터동조" ? "sector" : tag === "공시" ? "disc" : tag === "뉴스" ? "news" : "none"}">${escapeHtml(tag)}</span>`).join("");
}

function moversReasonText(row, quietFailed) {
  const status = row.reasonStatus || "failed";
  if (status === "failed") {
    // 목록 전체가 실패면 위에 한 번만 안내하고 줄마다 '요약 실패'를 반복하지 않는다.
    if (quietFailed) return row.sectorNote ? `<span class="movers-sector-note">${escapeHtml(row.sectorNote)}</span>` : "";
    // 요약이 실패해도 업종 동조는 스냅샷 수치로 코드가 쓴 사실이라 그대로 보여 준다.
    const note = row.sectorNote ? `<span class="movers-sector-note">${escapeHtml(row.sectorNote)}</span><span class="movers-sep" aria-hidden="true"> · </span>` : "";
    return `${note}<span class="movers-reason movers-reason-failed">${MOVERS_STATUS_TEXT.failed}</span>`;
  }
  if (status === "none") return `<span class="movers-reason movers-reason-none">${MOVERS_STATUS_TEXT.none}</span>`;
  // sector 상태면 reason == sectorNote 라 한 번만 쓴다.
  const parts = [];
  if (row.sectorNote && status !== "sector") parts.push(`<span class="movers-sector-note">${escapeHtml(row.sectorNote)}</span>`);
  parts.push(`<span class="movers-reason">${escapeHtml(row.reason || "")}</span>`);
  return parts.join('<span class="movers-sep" aria-hidden="true"> · </span>');
}

function moversEvidenceLinks(row) {
  const ev = Array.isArray(row.evidence) ? row.evidence.slice(0, 3) : [];
  if (!ev.length) return "";
  // 같은 종류가 여러 개면 "기사 원문 기사 원문"처럼 똑같은 링크가 반복돼 보여 번호를 붙인다(기사 1 · 기사 2).
  const labelOf = (e) => (e.type === "disclosure" ? "공시" : "기사");
  const totals = {};
  ev.forEach((e) => { totals[labelOf(e)] = (totals[labelOf(e)] || 0) + 1; });
  const seen = {};
  return `<span class="movers-links">${ev.map((e) => {
    const label = labelOf(e);
    seen[label] = (seen[label] || 0) + 1;
    const text = totals[label] > 1 ? `${label} ${seen[label]}` : `${label} 원문`;
    const title = [e.source, e.date, e.title].filter(Boolean).join(" · ");
    return `<a href="${escapeHtml(safeHttpHref(e.link))}" target="_blank" rel="noopener" title="${escapeHtml(title)}">${text}</a>`;
  }).join("")}</span>`;
}

function renderMoversBoard() {
  const el = byId("moversBoard");
  if (!el) return;
  const cfg = marketCfg();
  if (cfg.features && cfg.features.moversBoard === false) { el.hidden = true; el.innerHTML = ""; return; }
  const p = moversPayload();
  if (!p) {
    el.hidden = true;
    el.innerHTML = "";
    ensureFeatureData("movers").then((ok) => { if (ok && moversPayload()) renderMoversBoard(); });
    return;
  }
  const rows = moversSide === "down" ? p.down : p.up;
  el.hidden = false;
  const tab = (side, label, n) => `<button type="button" class="movers-tab${moversSide === side ? " is-active" : ""}" data-movers-side="${side}" aria-pressed="${moversSide === side}">${label} <span class="muted">${n}</span></button>`;
  const allFailed = rows.length > 0 && rows.every((row) => (row.reasonStatus || "failed") === "failed");
  const statusBanner = allFailed
    ? `<p class="movers-banner">이번 목록은 사유 요약을 만들지 못했습니다. 등락률과 업종 동조만 표시합니다.</p>`
    : (p.status === "llm_failed" ? `<p class="movers-banner">일부 종목은 사유 요약을 만들지 못해 '요약 실패'로 표시됩니다.</p>` : "");
  const body = rows.length
    ? `<ol class="movers-list">${rows.map((row) => `
        <li class="movers-row">
          <button type="button" class="movers-go" data-ticker="${escapeHtml(row.ticker)}" title="종목 분석 열기">
            <span class="movers-name">${escapeHtml(stockLabel(row.ticker, row))}${stockSubLabel(row.ticker, row) ? `<small>${escapeHtml(stockSubLabel(row.ticker, row))}</small>` : ""}</span>
            <strong class="movers-chg ${cls(Number(row.changePct))}">${fmtDailyPct(row.changePct)}</strong>
          </button>
          <div class="movers-why">${moversTagChips(row)}${moversReasonText(row, allFailed)}${moversEvidenceLinks(row)}</div>
        </li>`).join("")}</ol>`
    : `<p class="muted">기준(${escapeHtml(p.criteria || "")})을 넘은 ${moversSide === "down" ? "하락" : "상승"} 종목이 없습니다.</p>`;
  const idx = (p.indexMoves || []).map((i) => `${escapeHtml(i.name)} <b class="${cls(Number(i.changePct))}">${fmtSignedPct(Number(i.changePct))}</b>`).join(" · ");
  el.innerHTML = `
    <div class="section-title movers-head">
      <div>
        <h2>오늘의 특징주</h2>
        <p>${escapeHtml(p.tradeDate || "")} 장 마감 기준 · 자동 요약이라 틀릴 수 있음</p>
      </div>
      <div class="movers-tabs" role="group" aria-label="상승·하락 전환">${tab("up", "상승", p.up.length)}${tab("down", "하락", p.down.length)}</div>
    </div>
    ${statusBanner}
    ${body}
    ${typeof signalScoreLine === "function" ? signalScoreLine(moversSide === "down" ? "movers_down" : "movers_up") : ""}
    <p class="movers-foot muted">${idx ? `지수 ${idx} · ` : ""}${escapeHtml(p.criteria || "")}<br>근거: ${escapeHtml(p.source || "")} · 생성 ${escapeHtml(p.updatedAtKst || "")} · 공시·헤드라인만 본 요약이며 매매 신호가 아닌 정보입니다.</p>`;
  el.querySelectorAll("[data-movers-side]").forEach((btn) => {
    btn.addEventListener("click", () => { moversSide = btn.dataset.moversSide === "down" ? "down" : "up"; renderMoversBoard(); });
  });
  delegateTickerClicks(el, ".movers-go");
}

// 종목 분석 "왜 상승했나?" 상자 맨 위 — 그 종목이 오늘 특징주일 때만.
function moversAnalysisNote(item) {
  const row = item ? moversEntryFor(item.ticker) : null;
  if (!row) return "";
  const p = moversPayload();
  return `<div class="movers-analysis-note">
      <span class="movers-analysis-label">오늘의 특징주 · ${escapeHtml(p.tradeDate || "")} ${fmtDailyPct(row.changePct)}</span>
      <div class="movers-why">${moversTagChips(row)}${moversReasonText(row)}${moversEvidenceLinks(row)}</div>
      <small class="muted">공시·뉴스 헤드라인 기반 자동 요약이라 틀릴 수 있습니다.</small>
    </div>`;
}
