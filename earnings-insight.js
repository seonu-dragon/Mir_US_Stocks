// earnings-insight.js — 미국 실적 인사이트 두 가지(US 전용)
// =====================================================
// 1) 실적 전 비교: 과거 실적 발표 뒤 첫 거래일 평균 절대 등락률 vs 옵션 체인 예상변동폭
//    (window.EARNINGS_MOVE_COMPARE ← scripts/build_earnings_move_compare.py)
// 2) 실적 보도자료 한국어 요약: SEC 8-K Item 2.02 첨부 EX-99.1 → Gemini
//    (window.EARNINGS_RELEASES ← scripts/build_earnings_releases.py)
// 둘 다 '정보' 다 — 비싸다/싸다·좋다/나쁘다 같은 판단 문구를 쓰지 않는다. 숫자만 나란히.
// 클래식 스크립트(전역 공유). 이름은 eiXxx / earnings*Insight* 로 충돌을 피한다.

const EI_SESSION_KO = { bmo: "장전", amc: "장후", intraday: "장중", unknown: "시점 미확인" };
const EI_SESSION_SRC_KO = { yahoo: "야후 일정", history: "과거 8-K 시각 기준 추정" };
const EI_GUIDANCE_KO = {
  raised: "가이던스 상향",
  lowered: "가이던스 하향",
  maintained: "가이던스 유지",
  issued: "가이던스 제시(직전 비교 불가)",
  none: "가이던스 언급 없음",
};

function eiMoveCompareFor(ticker) {
  const t = String(ticker || "").toUpperCase();
  return ((window.EARNINGS_MOVE_COMPARE || {}).stocks || {})[t] || null;
}

function eiReleasesFor(ticker) {
  const t = String(ticker || "").toUpperCase();
  return ((window.EARNINGS_RELEASES || {}).releases || [])
    .filter((r) => r.ticker === t)
    .sort((a, b) => String(b.fileDate || "").localeCompare(String(a.fileDate || "")));
}

function eiPct(v, signed = false) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${signed && n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function eiMd(iso) {
  const s = String(iso || "");
  return s.length >= 10 ? `${s.slice(5, 7)}/${s.slice(8, 10)}` : s;
}

// 데이터가 아직 없으면 한 번 받아 오고, 도착하면 떠 있는 화면을 다시 그린다.
function eiEnsure(key) {
  if (typeof isKrMarket === "function" && isKrMarket()) return;
  const meta = FEATURE_DATA[key];
  if (!meta || window[meta.global]) return;
  ensureFeatureData(key).then((ok) => { if (ok) scheduleFeatureViewRefresh(); });
}

function eiOptionsText(o) {
  if (!o) return { main: "—", sub: "" };
  const bits = [`만기 ${eiMd(o.expiry)}`];
  if (o.firstExpiryAfterReaction === null) bits.push("실적 뒤 첫 만기인지 확인 불가");
  if (Number(o.extraWeekdays) > 0) bits.push(`반응일 뒤 ${o.extraWeekdays}거래일 더 포함`);
  return { main: `±${Number(o.expectedMovePct).toFixed(1)}%`, sub: bits.join(" · ") };
}

function eiSessionText(row) {
  const s = EI_SESSION_KO[row.session] || EI_SESSION_KO.unknown;
  const src = EI_SESSION_SRC_KO[row.sessionSource] || "";
  return src ? `${s}(${src})` : s;
}

function eiCompareHtml(row) {
  const past = row.past;
  const o = eiOptionsText(row.options);
  const payload = window.EARNINGS_MOVE_COMPARE || {};
  const pastSub = past
    ? `최근 ${past.n}회 · 중앙값 ${eiPct(past.medianAbsPct)} · 최대 ${eiPct(past.maxAbsPct)}${past.inferred ? ` · ${past.inferred}회는 시점 추정` : ""}`
    : "8-K 실적 발표 이력 없음(해외 상장사 등)";
  const events = (past && past.events) || [];
  return `
    <div class="ei-block">
      <div class="ei-head">
        <strong>실적 전 비교 · 과거 반응 vs 옵션 예상변동폭</strong>
        <span>다음 발표 ${escapeHtml(row.nextDate)} · ${escapeHtml(eiSessionText(row))} · 반응일 ${escapeHtml(eiMd(row.reactionDate))}</span>
      </div>
      <div class="ei-compare">
        <article>
          <span>과거 발표 다음 거래일 평균 절대 등락</span>
          <strong>${past ? eiPct(past.avgAbsPct) : "—"}</strong>
          <em>${escapeHtml(pastSub)}</em>
        </article>
        <article>
          <span>옵션 체인 예상변동폭</span>
          <strong>${escapeHtml(o.main)}</strong>
          <em>${escapeHtml(o.sub || row.optionsNote || "옵션 데이터 없음")}</em>
        </article>
      </div>
      ${events.length ? `
        <details class="ei-events">
          <summary>과거 반응 내역 <span>${events.length}회</span></summary>
          <div class="table-wrap compact-table-wrap">
            <table class="compact-table ei-events-table">
              <thead><tr><th>8-K 제출(ET)</th><th>시점</th><th>반응일</th><th>등락</th></tr></thead>
              <tbody>${events.map((e) => `<tr>
                <td>${escapeHtml(e.filedEt)}</td>
                <td>${escapeHtml(EI_SESSION_KO[e.session] || "")}${e.inferred ? " (추정)" : ""}</td>
                <td>${escapeHtml(e.reactionDate)}</td>
                <td class="${cls(e.movePct)}">${eiPct(e.movePct, true)}</td>
              </tr>`).join("")}</tbody>
            </table>
          </div>
        </details>` : ""}
      <p class="ei-note">숫자를 나란히 놓은 정보이며 매매 판단이 아닙니다. 과거 반응은 SEC 8-K Item 2.02 제출 시각으로 장전·장후를 갈라 발표 뒤 첫 정규장 종가 등락을 쓰고,
        예상변동폭은 반응일 이후 첫 만기의 등가격 스트래들 ÷ 현재가입니다(만기까지 전체 기간 기준). 기준 ${escapeHtml(payload.updatedAtKst || "")}</p>
    </div>`;
}

function eiReleaseCardHtml(rel, { compact = false } = {}) {
  const payload = window.EARNINGS_RELEASES || {};
  const metrics = (rel.metrics || []).map((m) => `
    <div><dt>${escapeHtml(m.label)}</dt><dd>${escapeHtml(m.value)}${m.change ? ` <em>${escapeHtml(m.change)}</em>` : ""}</dd></div>`).join("");
  const guid = EI_GUIDANCE_KO[rel.guidance] || EI_GUIDANCE_KO.none;
  return `
    <article class="ei-release${compact ? " is-compact" : ""}" id="ei-rel-${escapeHtml(String(rel.accession || "").replace(/[^0-9A-Za-z-]/g, ""))}">
      <div class="ei-release-head">
        <strong>${compact ? `<button type="button" class="ins-ticker" data-ticker="${escapeHtml(rel.ticker)}">${escapeHtml(rel.ticker)}</button> ` : ""}${escapeHtml(rel.period || "실적 보도자료")}</strong>
        <span>제출 ${escapeHtml(rel.fileDate || "")}</span>
        <span class="ei-guid">${escapeHtml(guid)}</span>
      </div>
      ${rel.oneLine ? `<p class="ei-oneline">${escapeHtml(rel.oneLine)}</p>` : ""}
      ${metrics ? `<dl class="ei-metrics">${metrics}</dl>` : ""}
      ${rel.guidanceNote ? `<p class="ei-guid-note">${escapeHtml(rel.guidanceNote)}</p>` : ""}
      <p class="ei-src">원문 <a href="${escapeHtml(rel.exhibitUrl || rel.filingUrl || "")}" target="_blank" rel="noopener">EX-99.1 보도자료</a> ·
        <a href="${escapeHtml(rel.filingUrl || "")}" target="_blank" rel="noopener">8-K 제출</a> ·
        Gemini 한국어 요약, 원문에 없는 숫자가 든 항목은 제거${rel.droppedItems ? `(${rel.droppedItems}개)` : ""} · 기준 ${escapeHtml(payload.updatedAtKst || "")}</p>
    </article>`;
}

// 종목 분석 뷰 › 종목 이벤트 › 실적 카드 안(#earningsInsight).
function renderEarningsInsight(item) {
  const box = byId("earningsInsight");
  if (!box) return;
  if (!item || (typeof isKrMarket === "function" && isKrMarket()) || (typeof isStockEtf === "function" && isStockEtf(item))) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  eiEnsure("earningsMoveCompare");
  eiEnsure("earningsReleases");
  const cmp = eiMoveCompareFor(item.ticker);
  const rels = eiReleasesFor(item.ticker);
  if (!cmp && !rels.length) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const relHtml = rels.length ? `
    <div class="ei-block">
      <div class="ei-head"><strong>최근 실적 보도자료 한국어 요약</strong><span>SEC 8-K Item 2.02</span></div>
      ${eiReleaseCardHtml(rels[0])}
      ${rels.length > 1 ? `<details class="ei-events"><summary>이전 보도자료 <span>${rels.length - 1}건</span></summary>${rels.slice(1).map((r) => eiReleaseCardHtml(r)).join("")}</details>` : ""}
    </div>` : "";
  box.innerHTML = (cmp ? eiCompareHtml(cmp) : "") + relHtml;
}

// 오늘 › 캘린더 › 실적 일정 — 표시 기간 안의 종목 중 비교 데이터가 있는 것만 표로.
function earningsMoveCompareSectionHtml(items) {
  if (typeof isKrMarket === "function" && isKrMarket()) return "";
  if (!window.EARNINGS_MOVE_COMPARE) { eiEnsure("earningsMoveCompare"); return ""; }
  const rows = (items || [])
    .map((it) => ({ it, row: eiMoveCompareFor(it.ticker) }))
    .filter(({ it, row }) => row && row.nextDate === it.date && (row.past || row.options))
    .sort((a, b) => String(a.row.nextDate).localeCompare(String(b.row.nextDate)) || (b.it.marketCapB || 0) - (a.it.marketCapB || 0));
  if (!rows.length) return "";
  const payload = window.EARNINGS_MOVE_COMPARE;
  const body = rows.map(({ it, row }) => {
    const o = eiOptionsText(row.options);
    return `<tr>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(it.ticker)}">${escapeHtml(stockLabel(it))}</button></td>
      <td class="ins-date">${escapeHtml(eiMd(row.nextDate))} ${escapeHtml(EI_SESSION_KO[row.session] || "")}</td>
      <td class="ins-num">${row.past ? `${eiPct(row.past.avgAbsPct)} <small>(${row.past.n}회)</small>` : "—"}</td>
      <td class="ins-num">${escapeHtml(o.main)}</td>
      <td class="ei-cal-sub">${escapeHtml(o.sub || row.optionsNote || "")}</td>
    </tr>`;
  }).join("");
  return `
    <details class="ei-cal" open>
      <summary>실적 전 비교 · 과거 반응 vs 옵션 예상변동폭 <span>${rows.length}종목</span></summary>
      <div class="table-wrap">
        <table class="insider-table ei-cal-table">
          <thead><tr><th>종목</th><th>발표</th><th class="ins-num">과거 평균 절대 등락</th><th class="ins-num">옵션 예상폭</th><th>만기</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="ei-note">과거: 최근 최대 8회 실적 발표 뒤 첫 거래일 종가 등락의 절댓값 평균(괄호는 표본 수). 옵션: 실적 반응일 이후 첫 만기의 등가격 스트래들 ÷ 현재가.
        매매 판단이 아닌 숫자 비교입니다. 출처 SEC EDGAR · Yahoo 옵션 · 기준 ${escapeHtml(payload.updatedAtKst || "")}</p>
    </details>`;
}

// 종목 › 공시 › 실적발표(US) — 표 위에 최근 보도자료 요약 카드.
function earningsReleasesSectionHtml(query) {
  if (!window.EARNINGS_RELEASES) { eiEnsure("earningsReleases"); return ""; }
  const q = String(query || "").trim().toLowerCase();
  let rels = (window.EARNINGS_RELEASES.releases || []).slice();
  if (q) rels = rels.filter((r) => r.ticker.toLowerCase().includes(q) || String(r.company || "").toLowerCase().includes(q));
  if (!rels.length) return "";
  const shown = rels.slice(0, 8);
  return `
    <details class="ei-rel-section" open>
      <summary>최근 실적 보도자료 한국어 요약 <span>${rels.length}건 중 ${shown.length}건</span></summary>
      <div class="ei-rel-grid">${shown.map((r) => eiReleaseCardHtml(r, { compact: true })).join("")}</div>
    </details>`;
}

// 실적반응 표의 한 행(티커·발표일)에 붙일 보도자료(제출일이 발표일 ±3일).
function eiReleaseForReaction(ticker, isoDate) {
  const d = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(d)) return null;
  return eiReleasesFor(ticker).find((r) => Math.abs(Date.parse(`${r.fileDate}T00:00:00Z`) - d) <= 3 * 86400000) || null;
}

function eiReleaseButtonHtml(ticker, isoDate) {
  const rel = eiReleaseForReaction(ticker, isoDate);
  if (!rel) return "—";
  return `<button type="button" class="ghost compact-btn ei-rel-open" data-ei-rel="${escapeHtml(String(rel.accession || "").replace(/[^0-9A-Za-z-]/g, ""))}">요약</button>`;
}

// 표의 '요약' 버튼 → 위 카드 섹션에 없으면(8건 밖) 표 아래 임시 카드로 펼친다.
function bindEarningsReleaseButtons(container) {
  if (!container || container.dataset.eiBound) return;
  container.dataset.eiBound = "1";
  container.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-ei-rel]");
    if (!btn) return;
    const id = btn.dataset.eiRel;
    let card = byId(`ei-rel-${id}`);
    if (!card) {
      const rel = ((window.EARNINGS_RELEASES || {}).releases || []).find((r) => String(r.accession || "").replace(/[^0-9A-Za-z-]/g, "") === id);
      if (!rel) return;
      let host = byId("eiRelPopHost");
      if (!host) {
        host = document.createElement("div");
        host.id = "eiRelPopHost";
        host.className = "ei-rel-pop";
        container.prepend(host);
      }
      host.innerHTML = eiReleaseCardHtml(rel, { compact: true });
      card = host.firstElementChild;
    }
    const det = card.closest("details");
    if (det) det.open = true;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("is-flash");
    setTimeout(() => card.classList.remove("is-flash"), 1600);
  });
}
