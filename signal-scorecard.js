// signal-scorecard.js — 신호 라이브 성적표(시장 탭 › 시그널 하단) + 신호 카드의 '이 신호의 과거 성적' 한 줄
// =====================================================
// 데이터: window.SIGNAL_SCORECARD (scripts/build_signal_ledger.mjs → data/signal_scorecard.js)
//   Mir 가 화면에 띄운 신호를 발행 시점에 동결해 적립한 원장(data/signal_ledger/<시장>/*.jsonl)을
//   발행 뒤 5·20·60 거래일 실제 수익률·벤치마크 대비 초과수익으로 집계한 것. 결과가 나빠도 그대로 보여 준다.
// 클래식 스크립트(전역 공유). 선언만 있고 로드 시점 실행문이 없다. 최상위 이름은 sigScore* 접두 +
// signalScoreLine / renderSignalScorecard / openSignalScorecard 만 밖에서 부른다.

let sigScoreHorizon = 20;

const SIG_SCORE_HORIZON_LABEL = { 5: "5거래일", 20: "20거래일", 60: "60거래일" };
const SIG_SCORE_VERDICT_CLASS = { positive: "pos", negative: "neg", unclear: "flat", hold: "hold" };

function sigScorePayload() {
  const p = window.SIGNAL_SCORECARD;
  return p && Array.isArray(p.kinds) ? p : null;
}

function sigScoreMarket() {
  return typeof marketCfg === "function" ? marketCfg().id : "us";
}

function sigScoreKind(kind, market) {
  const p = sigScorePayload();
  if (!p || !kind) return null;
  const m = market || sigScoreMarket();
  return p.kinds.find((x) => x.m === m && x.k === kind) || null;
}

function sigScorePct(v, digits = 1) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}%`;
}

function sigScoreRate(v) {
  const n = Number(v);
  return v == null || !Number.isFinite(n) ? "—" : `${Math.round(n * 100)}%`;
}

function sigScoreVerdictLabel(v) {
  const labels = (window.MirSignalCore && window.MirSignalCore.VERDICT_LABEL) || { hold: "판단 보류", positive: "벤치마크 상회", negative: "벤치마크 하회", unclear: "차이 불분명" };
  return labels[v] || labels.hold;
}

// 신호 카드 아래 한 줄 링크. 성적표 데이터가 없거나 이 시장에 없는 신호면 빈 문자열.
function signalScoreLine(kind, opts = {}) {
  const k = sigScoreKind(kind, opts.market);
  if (!k) return "";
  const h = k.h && k.h["20"];
  let text;
  if (!k.total) text = "아직 기록 없음 — 오늘부터 적립";
  else if (!h || !h.nExcess) text = `기록 ${k.total.toLocaleString()}건 · 20거래일 결과는 아직 없음`;
  else text = `20거래일 벤치마크 대비 평균 ${sigScorePct(h.meanExcess)} · 표본 ${h.nExcess.toLocaleString()} · ${sigScoreVerdictLabel(h.verdict)}`;
  return `<button type="button" class="sig-score-link${opts.inline ? " is-inline" : ""}" data-sc-kind="${escapeHtml(kind)}" title="신호 성적표에서 이 신호가 발행 뒤 실제로 어떻게 됐는지 보기">이 신호의 과거 성적 · ${escapeHtml(text)} →</button>`;
}

// 문서 전체에 한 번만 거는 위임 클릭(카드가 다시 그려져도 유지).
function sigScoreBindOnce() {
  if (document.body.dataset.sigScoreBound) return;
  document.body.dataset.sigScoreBound = "1";
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".sig-score-link[data-sc-kind]");
    if (link) { e.preventDefault(); openSignalScorecard(link.dataset.scKind); return; }
    const hz = e.target.closest("[data-sc-horizon]");
    if (hz) { sigScoreHorizon = Number(hz.dataset.scHorizon) || 20; renderSignalScorecard(); return; }
    const tk = e.target.closest(".sig-score-card .ins-ticker[data-ticker]");
    if (tk && typeof selectTicker === "function") selectTicker(tk.dataset.ticker, { openSearch: true });
  });
}

// 시그널 탭으로 가서 성적표를 펼치고 해당 신호 카드로 스크롤.
function openSignalScorecard(kind, { push = true } = {}) {
  sigScoreBindOnce();
  if (typeof activateTab === "function" && typeof currentTab !== "undefined" && currentTab !== "signals") activateTab("signals", { push });
  const fold = byId("fold-signalScorecard");
  if (fold) fold.open = true;
  const go = () => {
    renderSignalScorecard();
    const target = (kind && document.querySelector(`.sig-score-card[data-sc-kind="${CSS.escape(kind)}"]`)) || fold;
    if (!target) return;
    // 탭 전환 직후 다른 표면(시그널 그리드·피처 데이터 재렌더)이 스크롤을 되돌릴 수 있어 한 박자 늦게 한 번 더.
    const scroll = () => target.scrollIntoView({ behavior: "auto", block: "start" });
    scroll();
    setTimeout(scroll, 450);
    if (kind && target.classList.contains("sig-score-card")) {
      target.classList.add("is-flash");
      setTimeout(() => target.classList.remove("is-flash"), 2200);
    }
  };
  if (sigScorePayload()) go();
  else if (typeof ensureFeatureData === "function") ensureFeatureData("signalScorecard").then(go);
}

function sigScoreRecentTable(k) {
  if (!Array.isArray(k.recent) || !k.recent.length) return "";
  const cell = (row, h) => {
    if (row[`r${h}`] != null) {
      const x = row[`x${h}`];
      return `<td class="num"><span class="${cls(Number(row[`r${h}`]))}">${sigScorePct(row[`r${h}`])}</span>${x != null ? `<small class="muted"> (초과 ${sigScorePct(x)})</small>` : ""}</td>`;
    }
    const s = row[`s${h}`];
    return `<td class="num muted">${s === "noprice" ? "가격 없음" : s === "stale" ? "끊김" : "대기"}</td>`;
  };
  const body = k.recent.map((row) => `<tr>
      <td>${escapeHtml(row.d.slice(5))}${row.src === "backfill" ? '<small class="muted"> 소급</small>' : ""}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(row.t)}">${escapeHtml(typeof stockLabel === "function" ? stockLabel(row.t) : row.t)}</button></td>
      ${cell(row, 5)}${cell(row, 20)}
    </tr>`).join("");
  return `<details class="sig-score-recent"><summary>최근 표본 ${k.recent.length}건</summary>
    <div class="sig-score-table-wrap"><table class="sig-score-table">
      <thead><tr><th>기록일</th><th>종목</th><th class="num">5거래일</th><th class="num">20거래일</th></tr></thead>
      <tbody>${body}</tbody></table></div></details>`;
}

function sigScoreValidationText(val) {
  if (!val) return "";
  const lab = { 5: "1주", 20: "1개월", 60: "3개월" };
  const parts = Object.keys(lab).map((h) => `${lab[h]} ${val[h] ? "통과" : "미통과"}`);
  return `가장 최근 기록 당시 과거 5년 검증: ${parts.join(" · ")}`;
}

function sigScoreCard(k, h) {
  const s = (k.h && k.h[String(h)]) || {};
  const verdict = s.verdict || "hold";
  const liveS = k.hLive && k.hLive["20"];
  const counts = [
    `기간 미충족 ${Number(s.pending || 0).toLocaleString()}`,
    s.noprice ? `가격 이력 없음 ${s.noprice.toLocaleString()}` : "",
    s.stale ? `가격 끊김 ${s.stale.toLocaleString()}` : "",
    `소급 복원 ${Number(k.backfill || 0).toLocaleString()} · 실시간 ${Number(k.live || 0).toLocaleString()}`,
    s.dates ? `발행일 ${s.dates}일` : "",
  ].filter(Boolean).join(" · ");
  const excessCls = s.meanExcess == null ? "" : cls(Number(s.meanExcess));
  const body = k.total
    ? `<dl class="sig-score-stats">
        <div><dt>벤치마크 대비 평균</dt><dd class="${excessCls}">${sigScorePct(s.meanExcess)}</dd></div>
        <div><dt>95% 구간</dt><dd>${s.ciLo == null ? "—" : `${sigScorePct(s.ciLo)} ~ ${sigScorePct(s.ciHi)}`}</dd></div>
        <div><dt>초과 중앙값</dt><dd>${sigScorePct(s.medianExcess)}</dd></div>
        <div><dt>벤치마크를 이긴 비율</dt><dd>${sigScoreRate(s.winRate)}</dd></div>
        <div><dt>평균 수익률</dt><dd>${sigScorePct(s.meanRet)}</dd></div>
        <div><dt>표본(결과 확정)</dt><dd>${Number(s.nExcess || 0).toLocaleString()}</dd></div>
      </dl>
      <p class="sig-score-counts">${escapeHtml(counts)}</p>
      ${k.live ? `<p class="sig-score-counts">실시간 적립분만: 20거래일 표본 ${Number((liveS && liveS.nExcess) || 0).toLocaleString()}${liveS && liveS.nExcess ? ` · 평균 초과 ${sigScorePct(liveS.meanExcess)}` : ""}</p>` : ""}
      ${k.validation ? `<p class="sig-score-counts">${escapeHtml(sigScoreValidationText(k.validation))}</p>` : ""}
      ${sigScoreRecentTable(k)}`
    : `<p class="sig-score-counts">아직 기록이 없습니다. 이 신호가 화면에 뜨는 날부터 적립합니다.</p>`;
  return `<article class="sig-score-card${k.control ? " is-control" : ""}" data-sc-kind="${escapeHtml(k.k)}">
    <header class="sig-score-card-head">
      <h4>${escapeHtml(k.label)}${k.control ? ' <span class="sig-score-tag">대조군 · 검증 실패 점수</span>' : ""}</h4>
      <span class="sig-score-verdict v-${SIG_SCORE_VERDICT_CLASS[verdict] || "hold"}">${escapeHtml(sigScoreVerdictLabel(verdict))}</span>
    </header>
    <p class="sig-score-desc">${escapeHtml(k.desc || "")}</p>
    ${body}
  </article>`;
}

function renderSignalScorecard() {
  const host = byId("signalScorecard");
  if (!host) return;
  sigScoreBindOnce();
  const p = sigScorePayload();
  if (!p) {
    host.innerHTML = '<p class="muted">신호 성적표를 불러오는 중…</p>';
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("signalScorecard").then((ok) => {
        if (ok) renderSignalScorecard();
        else host.innerHTML = '<p class="muted">신호 성적표 파일을 불러오지 못했습니다.</p>';
      });
    }
    return;
  }
  const m = sigScoreMarket();
  const h = [5, 20, 60].includes(sigScoreHorizon) ? sigScoreHorizon : 20;
  const kinds = p.kinds.filter((k) => k.m === m);
  const L = (p.ledger && p.ledger[m]) || {};
  const bench = (p.benchmarks && p.benchmarks[m]) || {};
  const method = p.method || {};
  const integrity = L.integrity === "ok"
    ? `기록 해시 체인 일치 · SHA-256 head <code>${escapeHtml(String(L.head || "").slice(0, 16))}</code>`
    : `<b class="neg">기록 해시 불일치 — 원장이 manifest 와 다릅니다</b>`;
  const files = (L.files || []).map((f) => `<a href="${escapeHtml(f)}" target="_blank" rel="noopener">${escapeHtml(f.split("/").pop())}</a>`).join(" · ");
  const hzBtns = [5, 20, 60].map((x) => `<button type="button" class="sig-score-hz${x === h ? " is-active" : ""}" data-sc-horizon="${x}" aria-pressed="${x === h}">${SIG_SCORE_HORIZON_LABEL[x]}</button>`).join("");
  host.innerHTML = `
    <div class="section-title sig-score-head">
      <p>Mir 가 화면에 띄운 신호를 <b>발행 시점에 동결</b>해 매일 적립하고, 발행 뒤 실제 수익률을 ${escapeHtml(bench.label || "벤치마크")} 와 비교합니다.
        표본이 ${Number(p.minSample || 30)}개 미만이면 '판단 보류'입니다. 결과가 나빠도 그대로 보여 줍니다 — 매매 신호가 아닌 정보입니다.</p>
      <div class="sig-score-hzs" role="group" aria-label="보유 기간">${hzBtns}</div>
    </div>
    <div class="sig-score-grid">${kinds.map((k) => sigScoreCard(k, h)).join("")}</div>
    <div class="sig-score-foot">
      <p><b>한계</b> ${escapeHtml(method.limits || "")}</p>
      <details class="sig-score-method"><summary>계산 방법</summary>
      <p><b>계산</b> ${escapeHtml(method.entry || "")} ${escapeHtml(method.excess || "")} ${escapeHtml(method.ci || "")}</p>
      <p><b>중복 처리</b> ${escapeHtml(method.dedupe || "")}</p>
      <p><b>소급 복원</b> ${escapeHtml(method.backfill || "")}</p>
      <p><b>원장</b> ${Number(L.rows || 0).toLocaleString()}줄(소급 ${Number(L.backfill || 0).toLocaleString()} · 실시간 ${Number(L.live || 0).toLocaleString()}) · ${escapeHtml(L.firstDate || "—")} ~ ${escapeHtml(L.lastDate || "—")} · ${integrity}${files ? `<br>월별 파일: ${files} · <a href="data/signal_ledger/${escapeHtml(m)}/manifest.json" target="_blank" rel="noopener">해시 목록</a>` : ""}</p>
      </details>
      <p class="muted">가격 기준: ${escapeHtml(bench.label || "")} 마지막 일봉 ${escapeHtml(bench.lastDate || "—")} · 집계 ${escapeHtml(p.updatedAtKst || "")} · 출처 ${escapeHtml(p.source || "")}
        <button type="button" class="ia-link" data-open="trust">데이터 신뢰도 센터 열기</button></p>
    </div>`;
}
