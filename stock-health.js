// stock-health.js — 종목 체력(스노우플레이크) · 시장 백분위 · 유사종목 비교 · 위험/시즈널리티 카드.
// 본문 HTML 을 한 곳에서 만들고 두 화면이 같이 쓴다:
//   · 종목 상세(stock-view.js 6탭) — 밸류 탭 #stockSnowflake · #stockFactorPct · #stockPeers, 개요 탭 #stockRisk
//   · AI 모드 종목 대시보드(ai-mode.js aiSnowflakePanel·aiFactorPanel·aiPeerPanel·aiRiskPanel 이 aiModePanel 로 감싼다)
// 계산은 stock-health-core.js(window.MirStockHealthCore, node 테스트 있음). 시장 백분위는 portfolio.js 의
// portfolioFactorPercentiles(스냅샷 키로 메모)를 그대로 쓴다. 클래식 스크립트 전역 공유 — 이름은 sh 접두사.

function shCore() { return window.MirStockHealthCore || null; }

function shStocks() {
  return (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
}

function shAsOf() {
  return String((typeof data !== "undefined" && data && (data.updatedAtKst || data.updated_at_kst)) || "").slice(0, 16);
}

function shMapFund(ticker) {
  return (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(ticker) : null) || {};
}

// ── 스노우플레이크 ─────────────────────────────────────────────────────────
function shSnowflakeSvg(sum) {
  const axes = sum.axes;
  const cx = 96, cy = 100, R = 62, N = axes.length;
  const ang = (i) => (-Math.PI / 2) + i * (2 * Math.PI / N);
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const xy = (p) => p.map((v) => v.toFixed(1)).join(",");
  let grid = "";
  for (const g of [2, 4, 6]) grid += `<polygon points="${axes.map((_, i) => xy(pt(i, g / 6 * R))).join(" ")}" class="sh-sf-grid"/>`;
  let spokes = "", labels = "";
  axes.forEach((a, i) => {
    const [x, y] = pt(i, R);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="sh-sf-grid"/>`;
    const [lx, ly] = pt(i, R + 14);
    const anchor = Math.abs(lx - cx) < 6 ? "middle" : (lx > cx ? "start" : "end");
    labels += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="${anchor}" class="sh-sf-label">${escapeHtml(a.label)}</text>`;
  });
  const tone = sum.total >= 20 ? "is-good" : sum.total >= 12 ? "is-mid" : "is-low";
  const dp = axes.map((a, i) => xy(pt(i, (a.score ?? 0) / 6 * R))).join(" ");
  const dots = axes.map((a, i) => { const [x, y] = pt(i, (a.score ?? 0) / 6 * R); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4"/>`; }).join("");
  return `<svg class="sh-sf-svg ${tone}" viewBox="0 0 192 206" width="180" height="192" role="img" aria-label="종목 체력 레이더 ${sum.total}/${sum.max}">${grid}${spokes}<polygon points="${dp}" class="sh-sf-area"/><g class="sh-sf-dots">${dots}</g>${labels}</svg>`;
}

// 본문 HTML. 판단 가능한 축이 2개 미만이면 "".
function stockSnowflakeBodyHtml(item) {
  const core = shCore();
  if (!core || !item || !item.ticker) return "";
  const norm = (typeof normalizedFundamentalsForItem === "function" ? normalizedFundamentalsForItem(item) : null) || {};
  const sum = core.snowflakeSummary(core.computeSnowflake(core.mergeFundamentals(shMapFund(item.ticker), norm)));
  if (!sum) return "";
  const checks = sum.axes.map((a) => `<div class="sh-sf-check"><span>${escapeHtml(a.label)}</span><b>${a.ev > 0 ? `${a.pass}/${a.ev}` : "—"}</b></div>`).join("");
  const asOf = shAsOf();
  return `<div class="sh-sf">
    ${shSnowflakeSvg(sum)}
    <div class="sh-sf-side">
      <div class="sh-sf-total">종합 <b>${sum.total}/${sum.max}</b> · 통과한 재무 체크</div>
      <div class="sh-sf-checks">${checks}</div>
    </div>
  </div>
  <p class="sh-note"><b>절대 기준</b>이라 업종 차이(은행 PBR·성장주 PER 등)를 반영하지 않습니다. 같은 업종 안 위치는 '업종 상대 팩터 등급'을 보세요. 예측이 아니라 재무 상태 요약입니다.${asOf ? ` 기준 ${escapeHtml(asOf)}.` : ""}</p>
  <details class="sh-method"><summary>계산 방법</summary>
    <p>축마다 고정 기준 최대 6개 중 통과 개수입니다(값이 없는 기준은 분모에서 뺍니다).</p>
    <p>밸류: PER 15·25 미만, PBR 1.5·3 미만, PSR 2 미만, PEG 1.5 미만 · 성장: PEG 1·1.5 미만, 예상 PER &lt; PER, 매출성장 0·10% 초과, 이익성장 플러스</p>
    <p>건전성: 부채비율 0.5·1배 미만, 유동비율 1·1.5배 초과, 순이익률 0·5% 초과 · 과거성과: ROE 8·15% 초과, ROA 5% 초과, 순이익률 0·10% 초과, EPS 플러스 · 배당: 수익률 0·2·3.5% 초과(12% 미만), 배당성향 60·80% 미만</p>
  </details>`;
}

// ── 시장 전체 백분위(밸류·모멘텀·퀄리티·성장·규모) ──────────────────────────
function stockFactorPctBodyHtml(item) {
  if (!item || !item.ticker || typeof portfolioFactorPercentiles !== "function") return "";
  const f = portfolioFactorPercentiles(item.ticker);
  if (!f) return "";
  const axes = [["밸류", f.value], ["모멘텀", f.momentum], ["퀄리티", f.quality], ["성장", f.growth], ["규모", f.size]];
  if (axes.filter(([, v]) => v != null).length < 3) return "";
  const bars = axes.map(([name, v]) => {
    const tone = v == null ? "" : v >= 70 ? "is-good" : v >= 40 ? "is-mid" : "is-low";
    return `<div class="sh-fp-row"><span class="sh-fp-name">${escapeHtml(name)}</span>
      <div class="sh-fp-track"><div class="sh-fp-fill ${tone}" style="width:${v == null ? 0 : v}%"></div></div>
      <span class="sh-fp-val">${v == null ? "—" : v}</span></div>`;
  }).join("");
  return `${bars}<p class="sh-note">시장 전체 종목 중 백분위(0~100, 클수록 저평가·강세·우량·고성장·대형). 모멘텀=3개월 수익률, 퀄리티=ROE·순이익률·부채, 성장=매출성장(없으면 예상 EPS 성장). 예측이 아니라 현재 위치입니다.</p>`;
}

// ── 유사종목 비교 ─────────────────────────────────────────────────────────
function stockPeerBodyHtml(item) {
  const core = shCore();
  const stocks = shStocks();
  if (!core || stocks.length < 10 || !item || !item.ticker) return "";
  const sel = core.selectPeers(stocks, item, 6);
  if (!sel) return "";
  const num = (v, d = 1) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—");
  const rows = [item, ...sel.peers].map((s) => {
    const f = shMapFund(s.ticker);
    const self = s.ticker === item.ticker;
    const name = self
      ? `<strong>${escapeHtml(stockLabel(s))}</strong>`
      : `<strong class="ticker-link sh-peer-link" data-ticker="${escapeHtml(s.ticker)}" role="button" tabindex="0">${escapeHtml(stockLabel(s))}</strong>`;
    const chg = Number(s.threeMonthChangePct);
    const sub = s.company && s.company !== stockLabel(s) ? `<div class="sh-peer-sub">${escapeHtml(s.company)}</div>` : "";
    return `<tr${self ? ' class="is-self"' : ""}>
      <td class="sh-peer-name">${name}${sub}</td>
      <td class="num">${fmtBillions(s.marketCapB)}</td>
      <td class="num">${num(f.pe)}</td>
      <td class="num">${num(f.pb)}</td>
      <td class="num ${Number.isFinite(chg) ? cls(chg) : ""}">${Number.isFinite(chg) ? fmtPct(chg) : "—"}</td>
    </tr>`;
  }).join("");
  return `<div class="ai-mode-table-wrap sh-peer-wrap"><table class="ai-mode-table sh-peer-table">
      <colgroup><col class="c-name"><col class="c-cap"><col class="c-pe"><col class="c-pb"><col class="c-chg"></colgroup>
      <thead><tr><th>종목</th><th class="num">시총</th><th class="num">PER</th><th class="num">PBR</th><th class="num">3개월</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="sh-note">${escapeHtml(sel.basis)} 시총 상위 ${sel.peers.length}개(강조 행이 현재 종목). 종목명을 누르면 해당 종목으로 이동합니다.</p>`;
}

function stockPeerBasis(item) {
  const core = shCore();
  const sel = core && item ? core.selectPeers(shStocks(), item, 6) : null;
  return sel ? sel.basis : "";
}

// ── 위험 · 시즈널리티 ────────────────────────────────────────────────────
function shSeasonalitySvg(monthly) {
  const W = 250, H = 54, n = 12, bw = W / n;
  const vals = monthly.map((v) => (Number.isFinite(v) ? v : 0));
  const mx = Math.max(1, ...vals.map(Math.abs));
  const mid = H / 2;
  let bars = "", labels = "";
  for (let i = 0; i < n; i++) {
    const v = vals[i];
    const h = Math.abs(v) / mx * (H / 2 - 3);
    const y = v >= 0 ? mid - h : mid;
    bars += `<rect x="${(i * bw + 3).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="1.5" class="${v >= 0 ? "sh-bar-up" : "sh-bar-down"}"><title>${i + 1}월 ${v >= 0 ? "+" : ""}${v.toFixed(1)}%</title></rect>`;
    labels += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 9}" text-anchor="middle" class="sh-sf-label sh-season-label">${i + 1}</text>`;
  }
  return `<svg class="sh-season" viewBox="0 0 ${W} ${H + 12}" role="img" aria-label="월별 평균 수익률"><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" class="sh-sf-grid"/>${bars}${labels}</svg>`;
}

// 지표 격자는 AI 모드 aiMetricGrid 와 같은 마크업(.ai-mode-metric-grid)이라 두 화면에서 같게 보인다.
function stockRiskBodyHtml(item) {
  const core = shCore();
  if (!core || !item || typeof getChartRows !== "function") return "";
  const r = core.riskStats(getChartRows(item));
  if (!r) return "";
  const pct0 = (v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
  const metrics = [
    { label: "연율 변동성", value: `${r.volPct.toFixed(0)}%`, tone: r.volPct > 45 ? "warn" : "" },
    { label: "최대 낙폭", value: `${r.mddPct.toFixed(0)}%`, tone: "warn" },
    { label: "1년 수익률", value: r.oneYearPct != null ? pct0(r.oneYearPct) : "—", tone: cls(r.oneYearPct) },
    { label: "표본", value: `${r.n}일`, detail: r.from && r.to ? `${String(r.from).slice(0, 10)}~${String(r.to).slice(0, 10)}` : "" },
  ];
  const grid = `<div class="ai-mode-metric-grid">${metrics.map((m) => `<article><span>${escapeHtml(m.label)}</span><strong class="${m.tone || ""}">${escapeHtml(String(m.value))}</strong>${m.detail ? `<em>${escapeHtml(m.detail)}</em>` : ""}</article>`).join("")}</div>`;
  return `${grid}<div class="sh-sub-head">월별 시즈널리티 (평균 수익률, 21거래일 환산)</div>${shSeasonalitySvg(r.monthly)}
    <p class="sh-note">위 기간의 일봉 종가로 계산한 과거 통계입니다. 월별 표본은 연도 수만큼이라 적고, 앞으로의 수익을 뜻하지 않습니다.</p>`;
}

// ── 종목 상세 카드 ────────────────────────────────────────────────────────
function shFillCard(id, title, sub, body) {
  const host = byId(id);
  if (!host) return;
  if (!body) { host.hidden = true; host.innerHTML = ""; return; }
  const open = !!host.querySelector("details.sh-method[open]");
  host.hidden = false;
  host.innerHTML = `<div class="qi-head"><h3>${escapeHtml(title)}</h3>${sub ? `<span>${escapeHtml(sub)}</span>` : ""}</div>${body}`;
  if (open) host.querySelector("details.sh-method")?.setAttribute("open", "");
}

function renderStockHealth(item) {
  const ok = item && item.ticker && !item.__liveStub;
  shFillCard("stockSnowflake", "종목 체력", "스노우플레이크 · 절대 기준", ok ? stockSnowflakeBodyHtml(item) : "");
  shFillCard("stockFactorPct", "팩터 스코어", "시장 전체 백분위 · 예측 아님", ok ? stockFactorPctBodyHtml(item) : "");
  shFillCard("stockPeers", "유사종목 비교", ok ? `${stockPeerBasis(item)} · 시총순` : "", ok ? stockPeerBodyHtml(item) : "");
  shFillCard("stockRisk", "위험 · 시즈널리티", "가격 이력 기반 · 과거 통계", ok ? stockRiskBodyHtml(item) : "");
}

// 유사종목 표의 종목 클릭(위임, 문서에 한 번만). AI 모드 안에서는 같은 AI 분석으로, 밖(종목 상세)에서는 종목 분석으로.
function onStockPeerLinkActivate(e) {
  const link = e.target && e.target.closest ? e.target.closest(".sh-peer-link[data-ticker]") : null;
  if (!link) return;
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  const t = link.dataset.ticker;
  if (!t) return;
  e.preventDefault();
  if (window.MirAI?.isActive?.() && window.MirAI.queryStock) {
    const input = byId("aiChatInput");
    if (input) input.value = `${t} 분석해줘`;
    window.MirAI.queryStock(`${t} 분석해줘`);
    return;
  }
  selectTicker(t, { openSearch: true });
}
document.addEventListener("click", onStockPeerLinkActivate);
document.addEventListener("keydown", onStockPeerLinkActivate);
