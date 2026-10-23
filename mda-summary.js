// mda-summary.js — 종목 분석 › 이벤트·공시 탭 '분기·연차보고서 MD&A 요약' 카드(#mdaSummarySection). US 전용.
// =====================================================
// 데이터: window.MDA_SUMMARIES(scripts/build_mda_summaries.py — SEC 10-Q Item 2 · 10-K Item 7 원문 → Gemini 요약,
//   숫자는 원문 MD&A 에 있는지 검증한 문장만). FEATURE_DATA 키 mdaSummaries(US 전용·lazy). 요약이 없는 종목은 카드를 숨긴다.
// 클래식 스크립트(전역 공유) — 이름은 mda* / *MdaSummary 로 충돌을 피한다.

let mdaCurrent = null;

function mdaHide(host) {
  host.hidden = true;
  host.innerHTML = "";
  mdaCurrent = null;
}

function mdaFormLabel(form) {
  return String(form || "").startsWith("10-K") ? "연차보고서" : "분기보고서";
}

function mdaSafeUrl(u) {
  const s = String(u || "");
  return /^https:\/\/www\.sec\.gov\//.test(s) ? s : "";
}

function mdaSectionHtml(rec, payload) {
  const list = (arr) => (Array.isArray(arr) && arr.length ? `<ul class="mda-list">${arr.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : "");
  const prev = rec.prev || {};
  const url = mdaSafeUrl(rec.url);
  const prevUrl = mdaSafeUrl(prev.url);
  const changes = list(rec.changes);
  return `
    <div class="mf-head"><div><h3>${escapeHtml(mdaFormLabel(rec.form))} MD&amp;A 요약</h3></div></div>
    <p class="mda-meta">${escapeHtml(rec.form || "")} · 기간 ${escapeHtml(rec.period || "—")} · 제출 ${escapeHtml(rec.filed || "")}${url ? ` · <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">EDGAR 원문</a>` : ""}</p>
    ${list(rec.summary)}
    <h4 class="mda-sub">직전 보고서 대비 달라진 점 <span class="muted">${escapeHtml(prev.form || "")} ${escapeHtml(prev.filed || "")}${prevUrl ? ` · <a href="${escapeHtml(prevUrl)}" target="_blank" rel="noopener noreferrer">원문</a>` : ""}</span></h4>
    ${changes || `<p class="muted">확인된 변화 없음</p>`}
    <p class="mf-note">AI 요약 · 숫자는 원문 대조 통과분만 · 기준 ${escapeHtml((payload && payload.updatedAtKst) || "")}</p>`;
}

function renderMdaSummary(item) {
  const host = typeof byId === "function" ? byId("mdaSummarySection") : null;
  if (!host) return;
  if (!item || !item.ticker || item.__liveStub || (typeof isKrMarket === "function" && isKrMarket())
      || (typeof isStockEtf === "function" && isStockEtf(item))) {
    mdaHide(host);
    return;
  }
  const key = String(item.ticker).toUpperCase();
  const payload = window.MDA_SUMMARIES;
  if (!payload) {
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("mdaSummaries").then((ok) => {
        if (!ok || !window.MDA_SUMMARIES) { mdaHide(host); return; }
        if (typeof selectedTicker !== "undefined" && String(selectedTicker).toUpperCase() !== key) return;
        renderMdaSummary(item);
      });
    }
    return;
  }
  const rec = (payload.items || {})[key];
  if (!rec || !Array.isArray(rec.summary) || !rec.summary.length) { mdaHide(host); return; }
  if (mdaCurrent === rec && !host.hidden && host.firstElementChild) return;
  mdaCurrent = rec;
  host.hidden = false;
  host.innerHTML = mdaSectionHtml(rec, payload);
}
