// risk-check.js — 종목 분석 › 재무 탭 '재무 위험 점검' 카드(#riskCheckSection)
// =====================================================
// 계산은 risk-check-core.js(window.MirRiskCheckCore). 입력은 재무 확장 종목 파일(financials.js loadFinancials)
// + 스냅샷 시가총액(Altman 제조업 모형의 X4) + 국내 감사의견(KR_AUDIT_OPINION). 새 데이터 수집 없음.
// 과거 재무제표로 계산한 점검이며 매도 신호·예측이 아니다. 데이터 없음·해당 없음은 점수에 넣지 않는다.
// 클래식 스크립트(전역 공유) — 이름은 rc* / *RiskCheck* 로 충돌을 피한다.

let rcCurrent = null;   // { key, file, sig }

const RC_STATUS = {
  pass: { mark: "✓", text: "통과" },
  fail: { mark: "!", text: "경고" },
  missing: { mark: "–", text: "데이터 없음" },
  na: { mark: "–", text: "해당 없음" },
};

function rcFmt(v, unit, currency) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  if (unit === "pct") return `${(n * 100).toFixed(1)}%`;
  if (unit === "spct") return `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
  if (unit === "pp") return `${n > 0 ? "+" : ""}${(n * 100).toFixed(0)}%p`;
  if (unit === "x") return `${n.toFixed(2)}배`;
  if (unit === "money") return typeof mfMoney === "function" ? mfMoney(n, currency) : n.toLocaleString();
  return n.toFixed(2);
}

function rcEvidenceText(list, currency) {
  return (list || []).filter((e) => e.value !== null).map((e) => `${e.label} ${rcFmt(e.value, e.unit, currency)}`).join(" · ");
}

// 체크 한 줄의 근거 문장(숫자). 데이터 없음이면 이유.
function rcCheckDetail(c, res, currency) {
  if (c.status === "missing" || c.status === "na") {
    // Beneish 는 데이터가 모자라도 계산된 변수는 참고로 보여 준다.
    return escapeHtml(c.reason || "");
  }
  switch (c.key) {
    case "fscore": return `F-Score <b>${c.pass}/${c.of}</b>${c.of < 9 ? ` <span class="muted">(판정 불가 ${9 - c.of}개 제외)</span>` : ""}`;
    case "altman": {
      const zone = { safe: "안전 구간", grey: "회색 구간", distress: "부실 구간" }[c.zone] || "";
      return `Z <b>${rcFmt(c.z, "num")}</b> · ${zone}`;
    }
    case "beneish": return `M <b>${rcFmt(c.m, "num")}</b> (기준 ${MirRiskCheckCore.THRESHOLDS.M_THRESHOLD})`;
    case "dilution": return `1년 <b>${rcFmt(c.g1, "spct")}</b> · 3년 <b>${rcFmt(c.g3, "spct")}</b>${c.basis === "basic" ? ' <span class="muted">기말 발행주식수</span>' : ""}`;
    case "coverage": return c.note === "무차입" ? "총차입금 0 (무차입)" : `<b>${rcFmt(c.value, "x")}</b> · ${escapeHtml(rcEvidenceText(c.evidence.slice(1), currency))}`;
    case "audit": return `${escapeHtml(c.opinion)}${c.auditor ? ` · ${escapeHtml(c.auditor)}` : ""}${c.period ? ` <span class="muted">${escapeHtml(c.period)}</span>` : ""}`;
    case "leverage": if (c.note === "자본잠식") return `자본총계 <b>${escapeHtml(rcFmt(c.evidence[0].value, "money", currency))}</b> (자본잠식)`;
    // fallthrough
    default: return escapeHtml(rcEvidenceText(c.evidence, currency));
  }
}

function rcRowHtml(label, status, rule, detail) {
  const st = RC_STATUS[status] || RC_STATUS.missing;
  return `<li class="rc-item is-${status}">
      <span class="rc-mark" aria-hidden="true">${st.mark}</span>
      <div class="rc-body">
        <div class="rc-line"><span class="rc-label" title="${escapeHtml(rule || "")}" tabindex="0">${escapeHtml(label)}</span><span class="rc-status">${st.text}</span></div>
        ${detail ? `<div class="rc-detail">${detail}</div>` : ""}
      </div>
    </li>`;
}

function rcPiotroskiHtml(f, currency) {
  const rows = f.items.map((it) => rcRowHtml(it.label, it.status, it.rule,
    it.status === "missing" || it.status === "na" ? escapeHtml(it.reason) : escapeHtml(rcEvidenceText(it.evidence, currency)))).join("");
  return `<details class="rc-more"><summary>Piotroski F-Score 9항목 (FY${escapeHtml(String(f.fy))} 대 전년)</summary><ul class="rc-list rc-sub">${rows}</ul></details>`;
}

function rcBeneishHtml(c) {
  const defs = MirRiskCheckCore.M_DEFS;
  const vars = c.vars || {};
  if (c.status === "na" || !Object.values(vars).some((v) => v !== null)) return "";
  const rows = Object.keys(defs).map((k) => {
    const v = vars[k];
    return `<tr><th scope="row" title="${escapeHtml(defs[k][1])}">${k} <span class="muted">${escapeHtml(defs[k][0])}</span></th><td class="ins-num">${v === null || v === undefined ? '<span class="muted">데이터 없음</span>' : escapeHtml(rcFmt(v, "num"))}</td></tr>`;
  }).join("");
  return `<details class="rc-more"><summary>Beneish 8변수 ${c.status === "missing" ? "(계산된 것만 참고)" : ""}</summary>
    <div class="table-wrap"><table class="insider-table rc-table"><tbody>${rows}</tbody></table></div>
    ${c.status === "missing" ? '<p class="mf-note">8개가 모두 있어야 M 을 냅니다. 일부 변수만으로는 판정하지 않습니다.</p>' : ""}</details>`;
}

function rcSectionHtml(res, file, item) {
  const cur = file.currency;
  const basis = file.market === "kr" ? ` · ${file.basis === "OFS" ? "별도" : "연결"}` : "";
  const checks = res.checks.map((c) => rcRowHtml(c.label, c.status, c.rule, rcCheckDetail(c, res, cur))).join("");
  const fscore = res.checks.find((c) => c.key === "fscore");
  const beneish = res.checks.find((c) => c.key === "beneish");
  const altman = res.checks.find((c) => c.key === "altman");
  const modelNote = altman && altman.status !== "na"
    ? `Altman 모형: ${res.model.model === "manufacturing" ? "제조업 원형 Z" : "비제조업 Z''"}${res.model.basis ? `(업종 '${escapeHtml(res.model.basis)}' 기준)` : ""}.`
    : "";
  const tone = res.fail ? "is-warn" : "";
  return `
    <div class="mf-head">
      <div>
        <h3>재무 위험 점검</h3>
        <p class="mf-meta">FY${escapeHtml(String(res.fy))}${res.prevFy ? ` 대 FY${escapeHtml(String(res.prevFy))}` : ""} 연간${basis}</p>
      </div>
      <div class="rc-score ${tone}" aria-label="통과 ${res.pass} / ${res.of}">
        <strong>통과 ${res.pass}/${res.of}</strong>
        <span>경고 ${res.fail}${res.missing ? ` · 데이터 없음 ${res.missing}` : ""}${res.na ? ` · 해당 없음 ${res.na}` : ""}</span>
      </div>
    </div>
    <ul class="rc-list">${checks}</ul>
    ${fscore && res.piotroski.items.length ? rcPiotroskiHtml(res.piotroski, cur) : ""}
    ${beneish ? rcBeneishHtml(beneish) : ""}
    <details class="rc-more"><summary>산식·판정 기준</summary><dl class="rc-rules">${res.checks.map((c) => `<dt>${escapeHtml(c.label)}</dt><dd>${escapeHtml(c.rule)}</dd>`).join("")}</dl></details>
    <p class="mf-foot">'데이터 없음'·'해당 없음'은 통과 수와 분모에서 모두 뺐고, 없는 계정을 추정으로 채우지 않았습니다. ${modelNote}${res.financial ? " 금융업은 Altman·Beneish·이자보상배율 등 제조업용 지표가 해당 없음입니다." : ""}</p>`;
}

function rcMarketValue(item, file) {
  if (!item) return null;
  const kr = file.market === "kr";
  if (kr && file.currency === "KRW") {
    const t = Number(item.marketCapT);
    return Number.isFinite(t) && t > 0 ? t * 1e12 : null;
  }
  if (!kr && file.currency === "USD") {
    const b = Number(item.marketCapB);
    return Number.isFinite(b) && b > 0 ? b * 1e9 : null;
  }
  return null;   // 20-F 등 보고통화 ≠ 주가 통화 — 시가총액을 섞지 않는다
}

function rcAudit(key) {
  const a = window.KR_AUDIT_OPINION;
  return a && a.opinions ? a.opinions[key] || null : null;
}

function riskCheckEvaluate(file, item) {
  const core = window.MirRiskCheckCore;
  if (!core || !file) return null;
  const key = typeof mfTickerKey === "function" ? mfTickerKey(item.ticker) : item.ticker;
  return core.evaluate(file, {
    market: file.market === "kr" ? "kr" : "us",
    marketValue: rcMarketValue(item, file),
    sector: item.sector,
    industry: item.industry,
    audit: file.market === "kr" ? rcAudit(key) : null,
  });
}

function rcHide(host) {
  host.hidden = true;
  host.innerHTML = "";
  rcCurrent = null;
}

// 종목 분석 뷰(#riskCheckSection). 재무 파일이 없는 종목·ETF 는 숨긴다.
function renderRiskCheck(item) {
  const host = byId("riskCheckSection");
  if (!host) return;
  if (!item || !item.ticker || item.__liveStub || !window.MirRiskCheckCore || typeof loadFinancials !== "function"
      || (typeof isStockEtf === "function" && isStockEtf(item))) {
    rcHide(host);
    return;
  }
  const ticker = item.ticker;
  const file = financialsCached(ticker);
  if (file === null) { rcHide(host); return; }
  if (file === undefined) {
    loadFinancials(ticker).then((f) => {
      if (typeof selectedTicker !== "undefined" && mfTickerKey(selectedTicker) !== mfTickerKey(ticker)) return;
      if (!f) { rcHide(host); return; }
      renderRiskCheck(item);
    });
    return;
  }
  const key = mfTickerKey(ticker);
  // 같은 종목·같은 입력이면 다시 그리지 않는다(refreshFeatureViews 가 부팅 중 여러 번 부른다 — 펼친 상세 보존).
  const sig = `${key}|${rcMarketValue(item, file) || ""}|${file.market === "kr" && window.KR_AUDIT_OPINION ? 1 : 0}`;
  if (rcCurrent && rcCurrent.file === file && rcCurrent.sig === sig && !host.hidden && host.firstElementChild) return;
  const res = riskCheckEvaluate(file, item);
  if (!res) { rcHide(host); return; }
  // 같은 종목을 다시 그릴 때만 펼쳐 둔 상세를 유지한다.
  const open = rcCurrent && rcCurrent.key === key ? [...host.querySelectorAll("details.rc-more")].map((d) => d.open) : [];
  rcCurrent = { key, file, sig };
  host.hidden = false;
  host.innerHTML = rcSectionHtml(res, file, item);
  if (open.length) host.querySelectorAll("details.rc-more").forEach((d, i) => { if (open[i]) d.open = true; });
}
