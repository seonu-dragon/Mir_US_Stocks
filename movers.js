// movers.js — 오늘의 특징주(장 마감 기준 크게 움직인 종목 + 한 줄 사유)
// =====================================================
// 데이터: data/movers_reasons.js (US) · data/korea/movers_reasons.js (KR)
//   = window.MOVERS_REASONS, scripts/build_movers_reasons.py 가 장 마감 후 하루 1회 만든다.
//   FEATURE_DATA.movers(marketSpecific) 로 시장별 파일을 받고, 시장 전환 시 전역이 지워진다.
// 화면: 오늘 탭 › 요약의 "오늘의 특징주" 카드(상승/하락 탭), 종목 분석의 "왜 상승했나?"
//   상자 맨 위 한 줄. 사유는 공시·뉴스 헤드라인·업종 평균만 근거로 한 자동 요약이다 —
//   근거가 없으면 "뚜렷한 재료 확인 안 됨", 요약이 검증을 통과 못 하면 "뚜렷한 사유 확인 안 됨"(흐린 글씨)으로
//   보여 준다 — 예전 "요약 실패"는 종목에 문제가 있는 것처럼 읽혀 중립 문구로 바꿨다(2026-10-01).
// 범위·개수(2026-10-01): 빌더가 boards.large(대형주) · boards.all(전체 시장, ETF·스팩만 제외)을 방향별
//   20종목까지 만들어 두고, 카드에서 범위와 표시 개수(10·15·20, 기본 대형주 10)를 고른다. 선택은
//   브라우저(safeStorage)에 기억한다. boards 가 없는 옛 파일이면 최상위 up/down(대형주 10)만 보인다.
// 클래식 스크립트(전역 공유). 최상위 이름은 movers 접두로 충돌을 피한다.

let moversSide = "up";
const MOVERS_UNIVERSES = { large: "대형주", all: "전체 시장" };
const MOVERS_COUNTS = [10, 15, 20];
const MOVERS_PREF_KEY = "mir_movers_prefs";

function moversPrefs() {
  const raw = (window.safeStorage && window.safeStorage.getJSON(MOVERS_PREF_KEY, null)) || {};
  return {
    universe: MOVERS_UNIVERSES[raw.universe] ? raw.universe : "large",
    count: MOVERS_COUNTS.includes(Number(raw.count)) ? Number(raw.count) : MOVERS_COUNTS[0],
  };
}

function moversSavePrefs(patch) {
  if (window.safeStorage) window.safeStorage.setJSON(MOVERS_PREF_KEY, { ...moversPrefs(), ...patch });
}

// 고른 범위의 보드 { criteria, up, down } — boards 가 없으면(옛 파일) 최상위 = 대형주.
function moversBoardOf(p, universe) {
  const b = p.boards && p.boards[universe];
  if (b && Array.isArray(b.up) && Array.isArray(b.down)) return b;
  return universe === "large" ? { criteria: p.criteria, up: p.up, down: p.down } : null;
}

const MOVERS_STATUS_TEXT = {
  none: "뚜렷한 재료 확인 안 됨",
  failed: "뚜렷한 사유 확인 안 됨",
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
  const pools = [p.up, p.down];
  Object.keys(MOVERS_UNIVERSES).forEach((u) => { const b = moversBoardOf(p, u); if (b) pools.push(b.up, b.down); });
  for (const rows of pools) {
    const hit = rows.find((row) => String(row.ticker).toUpperCase() === t);
    if (hit) return hit;
  }
  return null;
}

function moversTagChips(row) {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  return tags.map((tag) => `<span class="movers-tag movers-tag-${tag === "섹터동조" ? "sector" : tag === "공시" ? "disc" : tag === "뉴스" ? "news" : "none"}">${escapeHtml(tag)}</span>`).join("");
}

function moversReasonText(row, quietFailed) {
  const status = row.reasonStatus || "failed";
  if (status === "failed") {
    // 목록 전체가 실패면 위에 한 번만 안내하고 줄마다 같은 문구를 반복하지 않는다.
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
  const prefs = moversPrefs();
  const hasAll = !!moversBoardOf(p, "all");
  const universe = hasAll ? prefs.universe : "large";
  const board = moversBoardOf(p, universe);
  const sliceN = (list) => list.slice(0, prefs.count);
  const rows = sliceN(moversSide === "down" ? board.down : board.up);
  el.hidden = false;
  // 신호 성적표는 최상위 up/down(대형주 10)만 기록한다 — 전체 시장 보드 밑엔 붙이지 않는다.
  const uniBtn = (u) => `<button type="button" class="movers-tab${universe === u ? " is-active" : ""}" data-movers-universe="${u}" aria-pressed="${universe === u}">${MOVERS_UNIVERSES[u]}</button>`;
  const controls = `${hasAll ? `<div class="movers-tabs" role="group" aria-label="대상 범위">${Object.keys(MOVERS_UNIVERSES).map(uniBtn).join("")}</div>` : ""}
      <label class="movers-count">표시 <select data-movers-count aria-label="표시 개수">${MOVERS_COUNTS.map((n) => `<option value="${n}"${n === prefs.count ? " selected" : ""}>${n}개</option>`).join("")}</select></label>`;
  const tab = (side, label, n) => `<button type="button" class="movers-tab${moversSide === side ? " is-active" : ""}" data-movers-side="${side}" aria-pressed="${moversSide === side}">${label} <span class="muted">${n}</span></button>`;
  const allFailed = rows.length > 0 && rows.every((row) => (row.reasonStatus || "failed") === "failed");
  const statusBanner = allFailed
    ? `<p class="movers-banner">이번 목록은 사유 요약 없이 등락률과 업종 동조만 표시합니다.</p>`
    : ""; // 일부만 실패한 날은 해당 줄의 흐린 문구로 충분하다(경고 배너를 띄우지 않는다).
  const body = rows.length
    ? `<ol class="movers-list">${rows.map((row) => `
        <li class="movers-row">
          <button type="button" class="movers-go" data-ticker="${escapeHtml(row.ticker)}" title="종목 분석 열기">
            <span class="movers-name">${(typeof companyLogoHtml === "function" ? companyLogoHtml(row.ticker, null, row.name, 22) : "")}${escapeHtml(stockLabel(row.ticker, row))}${stockSubLabel(row.ticker, row) ? `<small>${escapeHtml(stockSubLabel(row.ticker, row))}</small>` : ""}</span>
            <strong class="movers-chg ${cls(Number(row.changePct))}">${fmtDailyPct(row.changePct)}</strong>
          </button>
          <div class="movers-why">${moversTagChips(row)}${moversReasonText(row, allFailed)}${moversEvidenceLinks(row)}</div>
        </li>`).join("")}</ol>`
    : `<p class="muted">기준(${escapeHtml(board.criteria || "")})을 넘은 ${moversSide === "down" ? "하락" : "상승"} 종목이 없습니다.</p>`;
  const idx = (p.indexMoves || []).map((i) => `${escapeHtml(i.name)} <b class="${cls(Number(i.changePct))}">${fmtSignedPct(Number(i.changePct))}</b>`).join(" · ");
  el.innerHTML = `
    <div class="section-title movers-head">
      <div>
        <h2>오늘의 특징주</h2>
        <p>${escapeHtml(p.tradeDate || "")} 장 마감 기준 · 자동 요약이라 틀릴 수 있음</p>
      </div>
      <div class="movers-tabs" role="group" aria-label="상승·하락 전환">${tab("up", "상승", sliceN(board.up).length)}${tab("down", "하락", sliceN(board.down).length)}</div>
    </div>
    <div class="movers-controls">${controls}</div>
    ${statusBanner}
    ${body}
    ${universe === "large" && typeof signalScoreLine === "function" ? signalScoreLine(moversSide === "down" ? "movers_down" : "movers_up") : ""}
    <p class="movers-foot muted">${idx ? `지수 ${idx} · ` : ""}${escapeHtml(board.criteria || "")}<br>근거: ${escapeHtml(p.source || "")} · 생성 ${escapeHtml(p.updatedAtKst || "")} · 공시·헤드라인만 본 요약이며 매매 신호가 아닌 정보입니다.</p>`;
  el.querySelectorAll("[data-movers-side]").forEach((btn) => {
    btn.addEventListener("click", () => { moversSide = btn.dataset.moversSide === "down" ? "down" : "up"; renderMoversBoard(); });
  });
  el.querySelectorAll("[data-movers-universe]").forEach((btn) => {
    btn.addEventListener("click", () => { moversSavePrefs({ universe: btn.dataset.moversUniverse }); renderMoversBoard(); });
  });
  const countSel = el.querySelector("[data-movers-count]");
  if (countSel) countSel.addEventListener("change", () => { moversSavePrefs({ count: Number(countSel.value) }); renderMoversBoard(); });
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
