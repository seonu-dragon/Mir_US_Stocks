// risk-factors.js — 종목 분석 › 이벤트·공시 탭 '연차보고서 위험요인 변화' 카드(#riskFactorsSection). US 전용.
// =====================================================
// 데이터: scripts/build_risk_factor_changes.py(SEC EDGAR 최근 두 10-K 의 Item 1A · 20-F Item 3.D 원문 비교, LLM 없음)
//   인덱스 window.US_RISK_FACTORS_INDEX(FEATURE_DATA 키 riskFactorsIndex, US 전용·lazy) — 종목별 유사도·개수·제출일·백분위
//   종목 파일 data/risk_factors/tk/<TICKER>.json — 새·삭제·크게 바뀐 문단(영어 원문 첫 문장)
// 계산·문장은 risk-factors-core.js(window.MirRiskFactorsCore). 변화의 크기는 정보일 뿐 예측·매매 신호가 아니다.
// 인덱스에 없는 종목·ETF·KR 모드는 카드를 숨긴다(없는 파일을 요청하지 않는다). 추출에 실패한 종목은
// 사유 한 줄 + 원문 링크만 보여 준다(비교 대상이 아예 없는 no_filing 은 숨김).
// 클래식 스크립트(전역 공유) — 이름은 rf* / *RiskFactors* 로 충돌을 피한다.

const RF_CACHE = new Map();      // ticker → 파일 | null
const RF_PROMISES = new Map();
const RF_LIST_LIMIT = 8;         // 목록마다 처음 보이는 개수(나머지는 '더 보기')
let rfCurrent = null;            // { key, file }

function rfIsUs() {
  return !(typeof isKrMarket === "function" && isKrMarket());
}

function rfKey(ticker) {
  return String(ticker || "").toUpperCase();
}

function loadRiskFactors(ticker) {
  const key = rfKey(ticker);
  if (!key || !rfIsUs()) return Promise.resolve(null);
  if (RF_CACHE.has(key)) return Promise.resolve(RF_CACHE.get(key));
  if (RF_PROMISES.has(key)) return RF_PROMISES.get(key);
  const core = window.MirRiskFactorsCore;
  const p = ensureFeatureData("riskFactorsIndex").then((ok) => {
    if (!ok || !core || !core.indexRow(window.US_RISK_FACTORS_INDEX, key)) return null;
    const safe = typeof safeTicker === "function" ? safeTicker(key) : key;
    return fetch(`data/risk_factors/tk/${encodeURIComponent(safe)}.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => (doc && doc.schema === 1 && doc.cur && doc.prev ? doc : null))
      .catch(() => null);
  }).then((doc) => {
    RF_CACHE.set(key, doc || null);
    RF_PROMISES.delete(key);
    return doc || null;
  });
  RF_PROMISES.set(key, p);
  return p;
}

function rfNum(v) {
  return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "—";
}

function rfDocLink(meta, label) {
  if (!meta || !meta.url) return "";
  return `<a href="${escapeHtml(meta.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function rfListItem(x, kind) {
  const head = x.h ? " is-heading" : "";
  const ins = kind === "changed" && Array.isArray(x.ins) && x.ins.length
    ? `<div class="rf-ins"><span class="rf-ins-label">새로 들어간 구절</span>${x.ins.map((s) => `<q lang="en">${escapeHtml(s)}</q>`).join("")}</div>`
    : "";
  const meta = kind === "changed" && typeof x.r === "number"
    ? `<span class="rf-ratio" title="전년 문단과의 일치 비율(difflib)">${Math.round(x.r * 100)}% 일치</span>` : "";
  return `<li class="rf-item${head}"><p lang="en">${escapeHtml(x.t)}</p>${meta}${ins}</li>`;
}

function rfList(title, items, total, kind, hint) {
  const core = window.MirRiskFactorsCore;
  const v = core.listView(items, RF_LIST_LIMIT);
  if (!v.total) return "";
  const capped = total > v.total ? ` <span class="rf-count-note">(전체 ${Number(total).toLocaleString()}개 중 ${v.total}개 표시)</span>` : "";
  const more = v.rest.length
    ? `<details class="rf-more"><summary>${v.rest.length}개 더 보기</summary><ul class="rf-list">${v.rest.map((x) => rfListItem(x, kind)).join("")}</ul></details>` : "";
  return `<section class="rf-group rf-${kind}">
    <h4>${escapeHtml(title)} <span class="rf-count">${Number(total).toLocaleString()}</span>${capped}</h4>
    ${hint ? `<p class="rf-hint">${escapeHtml(hint)}</p>` : ""}
    <ul class="rf-list">${v.shown.map((x) => rfListItem(x, kind)).join("")}</ul>${more}
  </section>`;
}

function rfSectionHtml(file, row, index) {
  const core = window.MirRiskFactorsCore;
  const c = file.counts || {};
  const form = file.cur.form || "10-K";
  const item = form === "20-F" ? "Item 3.D" : "Item 1A";
  const band = core.changeBand(row && row.pct);
  const wc = core.wordsChange(file.cur.words, file.prev.words);
  const n = index && index.count;
  const meta = [
    `출처 SEC ${escapeHtml(form)} ${item} Risk Factors 원문`,
    `올해 제출 ${escapeHtml(file.cur.filed || "—")} · 전년 ${escapeHtml(file.prev.filed || "—")}`,
  ];
  if (file.updatedAtKst) meta.push(`갱신 ${escapeHtml(String(file.updatedAtKst).slice(0, 10))}`);
  const tiles = `
    <div class="rf-tiles">
      <div class="rf-tile" title="두 해 위험요인 구간의 단어 빈도 코사인 유사도(숫자·연도 제외). 100%면 단어 구성이 같다.">
        <span class="rf-tile-label">전년 대비 유사도</span><strong>${escapeHtml(core.simText(file.cos))}</strong>
        <span class="rf-tile-sub">단어 집합 ${escapeHtml(core.simText(file.jac))}</span>
      </div>
      <div class="rf-tile" title="인덱스의 다른 종목 가운데 유사도가 이 종목보다 높은(= 덜 바뀐) 비율. 매주 전 종목으로 다시 센다.">
        <span class="rf-tile-label">변화 크기 백분위</span><strong>${escapeHtml(core.pctText(row && row.pct))}</strong>
        <span class="rf-tile-sub">${n ? `${Number(n).toLocaleString()}종목 기준` : ""}</span>
      </div>
      <div class="rf-tile">
        <span class="rf-tile-label">문단</span><strong>+${rfNum(c.added)} / −${rfNum(c.removed)}</strong>
        <span class="rf-tile-sub">크게 바뀜 ${rfNum(c.big)} · 그대로 ${rfNum(c.same)}</span>
      </div>
      <div class="rf-tile" title="비교에 쓴 단어 수(8단어 미만 문단 제외).">
        <span class="rf-tile-label">분량(단어)</span><strong>${wc === null ? "—" : `${wc > 0 ? "+" : ""}${(wc * 100).toFixed(1)}%`}</strong>
        <span class="rf-tile-sub">${rfNum(file.prev.words)} → ${rfNum(file.cur.words)}</span>
      </div>
    </div>`;
  const note = core.extractNote(file.extract);
  return `
    <div class="mf-head">
      <div>
        <h3>연차보고서 위험요인 변화</h3>
        <p class="mf-meta">${meta.join(" · ")}</p>
      </div>
      <div class="mf-badges">${band ? `<span class="mf-badge rf-band is-${band.key}" title="${escapeHtml(core.pctSentence(row && row.pct, n))}">${escapeHtml(band.label)}</span>` : ""}</div>
    </div>
    <p class="rf-headline">${escapeHtml(core.headline(file))}</p>
    ${tiles}
    <p class="mf-note">${escapeHtml(core.pctSentence(row && row.pct, n))}</p>
    ${rfList("새로 생긴 위험 문단", file.added, c.added, "added", "전년 보고서에 닮은 문단이 없는 올해 문단의 첫 문장(영어 원문). 제목으로 보이는 문단을 앞에 둡니다.")}
    ${rfList("빠진 문단", file.removed, c.removed, "removed", "올해 보고서에 닮은 문단이 없는 전년 문단의 첫 문장.")}
    ${rfList("크게 바뀐 문단", file.changed, c.big, "changed", "전년 문단과 50~75%만 일치하는 문단 — 덜 일치하는 순.")}
    <p class="rf-links">원문: ${rfDocLink(file.cur, `올해 ${form} (${file.cur.filed || ""})`)} · ${rfDocLink(file.prev, `전년 ${form} (${file.prev.filed || ""})`)}</p>
    ${note ? `<p class="mf-note">${escapeHtml(note)}</p>` : ""}
    <p class="mf-foot">변화 크기는 정보일 뿐 예측이 아닙니다(매수·매도 추천 아님). <a href="${core.PAPER_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(core.PAPER_LABEL)}</a>는 연차보고서 문장을 전년보다 많이 바꾼 회사의 이후 수익률이 낮았다고 보고했지만, 이 사이트가 그 결과를 검증한 것은 아닙니다. 숫자·연도만 바뀐 문장은 같은 문장으로 봅니다. 문단 대응은 단어 순서 일치 비율(≥90% 그대로 · 50~90% 수정 · 50% 미만 새 문단)로 기계적으로 판정합니다.</p>`;
}

function rfFailureHtml(fail) {
  const link = fail.url ? ` · <a href="${escapeHtml(fail.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(fail.form || "10-K")} 원문 (${escapeHtml(fail.filed || "")})</a>` : "";
  return `
    <div class="mf-head"><div><h3>연차보고서 위험요인 변화</h3>
    <p class="mf-meta">출처 SEC EDGAR 연차보고서 원문</p></div></div>
    <p class="mf-note">전년 대비 비교를 하지 못했습니다 — ${escapeHtml(fail.text)}${link}</p>`;
}

function rfHide(host) {
  host.hidden = true;
  host.innerHTML = "";
  rfCurrent = null;
}

// 종목 분석 뷰(#riskFactorsSection). US 모드·인덱스(또는 실패 기록)에 있는 종목만.
function renderRiskFactors(item) {
  const host = byId("riskFactorsSection");
  if (!host) return;
  const core = window.MirRiskFactorsCore;
  if (!item || !item.ticker || item.__liveStub || !rfIsUs() || !core
      || (typeof isStockEtf === "function" && isStockEtf(item))) {
    rfHide(host);
    return;
  }
  const key = rfKey(item.ticker);
  const index = window.US_RISK_FACTORS_INDEX;
  if (!index) {
    ensureFeatureData("riskFactorsIndex").then((ok) => {
      if (!ok || !window.US_RISK_FACTORS_INDEX) { rfHide(host); return; }
      if (typeof selectedTicker !== "undefined" && rfKey(selectedTicker) !== key) return;
      renderRiskFactors(item);
    });
    return;
  }
  const row = core.indexRow(index, key);
  if (!row) {
    const fail = core.failureOf(index, key);
    if (!fail || fail.reason === "no_filing") { rfHide(host); return; }
    if (rfCurrent && rfCurrent.key === key && rfCurrent.file === fail && !host.hidden) return;
    rfCurrent = { key, file: fail };
    host.hidden = false;
    host.innerHTML = rfFailureHtml(fail);
    return;
  }
  const file = RF_CACHE.get(key);
  if (file === null) { rfHide(host); return; }
  if (file === undefined) {
    loadRiskFactors(key).then((f) => {
      if (typeof selectedTicker !== "undefined" && rfKey(selectedTicker) !== key) return;
      if (!f) { rfHide(host); return; }
      renderRiskFactors(item);
    });
    return;
  }
  // 같은 종목이 이미 그려져 있으면 다시 그리지 않는다(refreshFeatureViews 가 부팅 중 여러 번 부른다 — 펼친 '더 보기' 유지)
  if (rfCurrent && rfCurrent.key === key && rfCurrent.file === file && !host.hidden && host.firstElementChild) return;
  rfCurrent = { key, file };
  host.hidden = false;
  host.innerHTML = rfSectionHtml(file, row, index);
}
