// kr-alerts.js — 국내 시장경보·이상 종목 보드 (KR 전용)
// =====================================================
// 클래식 스크립트(모듈 아님). index.html 이 app.js 보다 먼저 싣고 같은 전역 스코프를
// 공유한다. 선언만 있고 로드 시점 실행문이 없다. 이름은 전부 krAlert* 접두로 둔다
// (scripts/check_global_name_collisions.py 가 감시).
//
// 데이터: window.KR_MARKET_ALERTS (scripts/build_kr_market_alerts.py)
//  - 투자주의·경고·위험 / 매매거래정지 / 관리종목: KRX KIND 공식 지정 현황
//  - 상·하한가: 네이버 m.stock 등락률 목록의 상한·하한 표시
//  - 52주 신고·신저가, 거래대금 급증: 스냅샷 실측 일봉에서 계산(당일 봉이 갱신된 종목만)
// 매매 신호가 아니라 '지금 어떤 종목이 어떤 상태인가' 에 대한 정보다.

function krAlertsEnabled() {
  return isKrMarket() && marketCfg().features?.krMarketAlerts === true;
}

function krAlertsPayload() {
  const p = window.KR_MARKET_ALERTS;
  return p && p.sections && typeof p.sections === "object" ? p : null;
}

// 시장경보 등급(심각도 순). 종목 헤더 배지와 보드 요약이 같이 쓴다.
const KR_ALERT_LEVELS = [
  { key: "risk", label: "투자위험", tone: "adverse" },
  { key: "halt", label: "매매거래정지", tone: "adverse" },
  { key: "warning", label: "투자경고", tone: "adverse" },
  { key: "admin", label: "관리종목", tone: "adverse" },
  { key: "caution", label: "투자주의", tone: "emphasis" },
];

// 종목 하나의 KRX 지정 상태 목록 — [{key,label,tone,detail}]. 지정 예정(지정일 > 기준일)도
// '예정' 으로 표기해 포함한다.
function krAlertStatusFor(ticker) {
  const p = krAlertsPayload();
  if (!p || !ticker) return [];
  const base = p.baseDate || "";
  const out = [];
  KR_ALERT_LEVELS.forEach((lv) => {
    const sec = p.sections[lv.key];
    const rows = (sec && Array.isArray(sec.rows) ? sec.rows : []).filter((r) => r.ticker === ticker);
    if (!rows.length) return;
    const r = rows[0];
    let detail = "";
    if (lv.key === "halt") detail = r.reason ? `사유: ${r.reason}` : "";
    else if (lv.key === "admin") detail = [r.reason ? `사유: ${r.reason}` : "", r.designatedDate ? `지정일 ${r.designatedDate}` : ""].filter(Boolean).join(" · ");
    else {
      const types = lv.key === "caution" ? [...new Set(rows.map((x) => x.type).filter(Boolean))].join(", ") : "";
      const planned = r.designatedDate && base && r.designatedDate > base;
      detail = [types, r.designatedDate ? `${planned ? "지정 예정일" : "지정일"} ${r.designatedDate}` : ""].filter(Boolean).join(" · ");
    }
    out.push({ ...lv, detail, asOf: sec.asOf || "" });
  });
  return out;
}

// 종목 요약(stockFacts) 헤더 아래 경고. 감사의견 경고와 같은 모양을 쓴다.
function krMarketAlertNotice(item) {
  if (!krAlertsEnabled() || !item || !item.ticker) return "";
  const list = krAlertStatusFor(item.ticker);
  if (!list.length) return "";
  return list.map((a) => `
      <p class="audit-notice audit-${a.tone} kr-alert-notice">
        <b>${escapeHtml(a.label)}${a.key === "halt" || a.key === "admin" ? "" : " 종목"}</b>
        <span>${escapeHtml(a.detail)}${a.detail ? " · " : ""}KRX KIND 기준 ${escapeHtml(a.asOf)}</span>
      </p>`).join("");
}

function krAlertTickerCell(row) {
  const known = typeof stockByTicker === "function" && stockByTicker(row.ticker);
  const name = row.company || row.ticker;
  return known
    ? `<button type="button" class="ins-ticker" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(name)}</button>`
    : `<b class="kr-alert-name" title="${escapeHtml(row.ticker)} · 이 사이트 스냅샷에 없는 종목">${escapeHtml(name)}</b>`;
}

const KR_ALERT_PREVIEW = 8;

function krAlertCard(title, note, rows, noteFn, sec) {
  const li = (r) => `<li>${krAlertTickerCell(r)}<span>${escapeHtml(noteFn(r) || "")}</span></li>`;
  const head = rows.slice(0, KR_ALERT_PREVIEW).map(li).join("");
  const rest = rows.slice(KR_ALERT_PREVIEW);
  const more = rest.length
    ? `<details class="kr-alert-more"><summary>나머지 ${rest.length}개 더 보기</summary><ul>${rest.map(li).join("")}</ul></details>`
    : "";
  const carried = sec && sec.status === "carried"
    ? `<p class="sig-note kr-alert-stale">이번 수집 실패 — ${escapeHtml(sec.asOf || "")} 자료 유지</p>` : "";
  return `<div class="signal-card kr-alert-card">
    <h3>${escapeHtml(title)} <span class="kr-alert-count">${rows.length.toLocaleString()}</span></h3>
    ${note ? `<p class="sig-note">${escapeHtml(note)}</p>` : ""}${carried}
    <ul>${head || '<li class="muted">해당 종목 없음</li>'}</ul>${more}
  </div>`;
}

function krAlertPct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? fmtDailyPct(n) : "";
}

function renderKrMarketAlerts() {
  const host = byId("krMarketAlerts");
  const fold = byId("fold-krMarketAlerts");
  if (!host) return;
  const p = krAlertsEnabled() ? krAlertsPayload() : null;
  if (!p) {
    host.innerHTML = "";
    if (fold) fold.hidden = true;
    return;
  }
  if (fold) fold.hidden = false;
  const S = p.sections;
  const base = p.baseDate || "";
  const rowsOf = (k) => (S[k] && Array.isArray(S[k].rows) ? S[k].rows : []);

  // 투자주의는 한 종목이 유형별로 여러 행이다 — 종목 단위로 묶는다.
  const cautionByT = new Map();
  rowsOf("caution").forEach((r) => {
    const g = cautionByT.get(r.ticker) || { ...r, types: new Set() };
    if (r.type) g.types.add(r.type);
    if ((r.designatedDate || "") > (g.designatedDate || "")) g.designatedDate = r.designatedDate;
    cautionByT.set(r.ticker, g);
  });
  const caution = [...cautionByT.values()];
  const when = (r) => (r.designatedDate ? `${base && r.designatedDate > base ? "예정 " : ""}${r.designatedDate.slice(5)}` : "");

  const cards = [];
  const sections = [
    ["risk", "투자위험", "시장경보 최고 단계", rowsOf("risk"), (r) => `지정 ${when(r)}`],
    ["warning", "투자경고", "지정 예정 포함", rowsOf("warning"), (r) => `지정 ${when(r)}`],
    ["caution", "투자주의", "1일 지정 · 예정 포함", caution, (r) => `${[...r.types].join(", ")} · ${when(r)}`],
    ["halt", "매매거래정지", "현재 정지 중", rowsOf("halt"), (r) => r.reason || ""],
    ["admin", "관리종목", "현재 지정 중", rowsOf("admin"), (r) => [r.reason, r.designatedDate].filter(Boolean).join(" · ")],
    ["limitUp", "상한가", "", rowsOf("limitUp"), (r) => `${priceOrDash(r.price)} · ${krAlertPct(r.changePct)}`],
    ["limitDown", "하한가", "", rowsOf("limitDown"), (r) => `${priceOrDash(r.price)} · ${krAlertPct(r.changePct)}`],
    ["newHigh", "52주 신고가", "장중 고가 기준", rowsOf("newHigh"), (r) => `${priceOrDash(r.price)} · ${krAlertPct(r.changePct)}`],
    ["newLow", "52주 신저가", "장중 저가 기준", rowsOf("newLow"), (r) => `${priceOrDash(r.price)} · ${krAlertPct(r.changePct)}`],
    ["valueSurge", "거래대금 급증", "20일 평균 대비 배수", rowsOf("valueSurge"), (r) => `${Number(r.ratio).toFixed(1)}배 · ${Number(r.valueEok).toLocaleString()}억 · ${krAlertPct(r.changePct)}`],
  ];
  sections.forEach(([key, title, note, rows, fn]) => {
    if (!S[key]) return; // 수집해 본 적 없는 항목은 카드 자체를 뺀다
    cards.push(krAlertCard(title, note, rows, fn, S[key]));
  });

  const chips = sections.filter(([key]) => S[key]).map(([key, title, , rows]) =>
    `<span class="kr-alert-chip${rows.length ? "" : " is-zero"}" data-kind="${key}">${escapeHtml(title)} <b>${rows.length.toLocaleString()}</b></span>`).join("");
  const covered = S.newHigh?.covered || S.valueSurge?.covered;
  host.innerHTML = `
    <div class="section-title"><p>KRX 가 지정한 시장경보·거래정지·관리종목과, 기준 거래일의 상·하한가·52주 신고/신저가·거래대금 급증 종목입니다. 매매 신호가 아니라 현재 상태에 대한 정보입니다.</p></div>
    <div class="kr-alert-chips">${chips}</div>
    <div class="signals-grid kr-alert-grid">${cards.join("")}</div>
    <p class="kr-alert-foot">기준 거래일 ${escapeHtml(base)} · 수집 ${escapeHtml(p.updatedAtKst || "")}.
      시장경보·거래정지·관리종목: KRX KIND(거래정지·관리종목은 수집 시점 현황). 상·하한가: 네이버 금융 등락률 목록.
      52주 신고/신저가·거래대금 급증: 이 사이트 스냅샷의 실측 일봉${covered ? `(기준일 봉이 갱신된 ${Number(covered).toLocaleString()}종목, 주로 시가총액 상위)` : ""}에서 계산 — 거래대금은 종가×거래량 근사치.
      단기과열종목·VI 발동은 무료 장마감 소스가 없어 싣지 않습니다.</p>`;
  host.querySelectorAll(".ins-ticker[data-ticker]").forEach((b) => b.addEventListener("click", () => {
    selectTicker(b.dataset.ticker, { openSearch: true });
  }));
}
