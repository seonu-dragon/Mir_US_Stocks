// kr-consensus-moves.js — 시장 › 시그널 '컨센서스 상향·하향 (국내)' 위젯(#krConsensusMoves).
// =====================================================
// 데이터: window.KR_CONSENSUS(부팅 뒤 받는 경량 데이터셋)의 stocks[*].chg — build_kr_consensus.py 가 매일 받은
// FnGuide 컨센서스를 쌓아 1주·1개월 전 관측과 비교한 값(scripts/kr_consensus_history.py). 계산은 kr-consensus-moves-core.js.
// '변경일'은 증권사 발표일이 아니라 이 사이트가 다른 값을 처음 본 날(감지일)이다. 국내 전용, 클래식 스크립트 — kcm 접두사.

let kcmField = "tp";
let kcmPeriod = "1w";

function kcmRows(rows, field) {
  if (!rows.length) return `<p class="muted ar-empty">해당 종목 없음</p>`;
  const core = window.MirKrConsMovesCore;
  const body = rows.map((r) => {
    const s = typeof stockByTicker === "function" ? stockByTicker(r.ticker) : null;
    const label = s && typeof stockLabel === "function" ? stockLabel(s) : r.ticker;
    const now = field === "tp"
      ? (Number.isFinite(r.target) ? `${Math.round(r.target).toLocaleString("ko-KR")}원` : "—")
      : (Number.isFinite(r.op) ? `${Math.round(r.op).toLocaleString("ko-KR")}억원` : "—");
    return `<tr><td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(label)}</button></td>
      <td class="ins-num"><strong class="${cls(r.chg)}">${core.arrow(r.chg)}</strong></td>
      <td class="ins-num">${now}</td><td class="ins-num">${r.count == null ? "—" : r.count}</td></tr>`;
  }).join("");
  return `<div class="table-wrap ar-table-wrap"><table class="insider-table ar-table"><thead><tr><th>종목</th><th class="ins-num">변화</th><th class="ins-num">${field === "tp" ? "현재 목표가" : "현재 추정"}</th><th class="ins-num">기관 수</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderKrConsensusMoves() {
  const host = typeof byId === "function" ? byId("krConsensusMoves") : null;
  if (!host) return;
  const core = window.MirKrConsMovesCore;
  const src = window.KR_CONSENSUS;
  if (!core || !(typeof isKrMarket === "function" && isKrMarket()) || !src) { host.innerHTML = ""; return; }
  if (kcmField === "op" && kcmPeriod === "1w") kcmPeriod = "1m";       // 추정치 변화는 1개월부터
  const res = core.moves(src, { field: kcmField, period: kcmPeriod, minCount: 3, limit: 10 });
  if (!res.breadth.total) { host.innerHTML = ""; return; }
  const b = res.breadth;
  const chip = (attr, k, label, on) => `<button type="button" class="ft-chip${on ? " is-active" : ""}" data-kcm-${attr}="${k}" aria-pressed="${on}">${label}</button>`;
  const fields = [["tp", "목표주가"], ["op", "영업이익 추정"]].map(([k, l]) => chip("field", k, l, kcmField === k)).join("");
  const periods = (kcmField === "tp" ? [["1w", "1주"], ["1m", "1개월"]] : [["1m", "1개월"], ["3m", "3개월"]])
    .map(([k, l]) => chip("period", k, l, kcmPeriod === k)).join("");
  const fyNote = kcmField === "op" ? " · 같은 회계연도 추정끼리 비교" : "";
  host.innerHTML = `
    <div class="section-title"><h2>컨센서스 상향·하향 (국내)</h2></div>
    <div class="ar-card">
      <div class="ft-chips ft-subchips ar-chips" role="group" aria-label="항목">${fields}</div>
      <div class="ft-chips ft-subchips ar-chips" role="group" aria-label="기간">${periods}</div>
      <div class="ar-breadth"><span>${kcmField === "tp" ? "평균 목표주가" : "FY1 영업이익 추정"} · ${res.base ? `${escapeHtml(res.base)} 대비` : ""}</span><span><b class="pos">상향 ${b.up}</b> · <b class="neg">하향 ${b.down}</b> · 보합 ${b.flat} / ${b.total}종목</span></div>
      <div class="ar-lead-grid">
        <section><h3>상향 상위</h3>${kcmRows(res.up, kcmField)}</section>
        <section><h3>하향 상위</h3>${kcmRows(res.down, kcmField)}</section>
      </div>
      <p class="ar-foot">FnGuide 컨센서스 · 추정 기관 3곳 이상 · 날짜는 감지일 기준${fyNote} · 업데이트 ${escapeHtml(src.updatedAtKst || "")}</p>
    </div>`;
  host.querySelectorAll("[data-kcm-field]").forEach((btn) => btn.addEventListener("click", () => {
    kcmField = btn.dataset.kcmField === "op" ? "op" : "tp";
    kcmPeriod = kcmField === "op" ? "1m" : "1w";
    renderKrConsensusMoves();
  }));
  host.querySelectorAll("[data-kcm-period]").forEach((btn) => btn.addEventListener("click", () => {
    kcmPeriod = btn.dataset.kcmPeriod;
    renderKrConsensusMoves();
  }));
  host.querySelectorAll(".ins-ticker").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.ticker && typeof selectTicker === "function") selectTicker(btn.dataset.ticker, { openSearch: true });
  }));
  if (typeof syncSignalFolds === "function") syncSignalFolds();
}
