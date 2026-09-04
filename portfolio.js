// 이 파일은 app.js 에서 기계적으로 분리된 코드다 (refactor/appjs-split-stage2).
// 포트폴리오 클러스터: 가상 포트폴리오·배당 플래너·리밸런싱·스트레스 테스트·포지션 사이징·원화 환산·벤치마크 기여도·투자 일지 + 포트폴리오 시뮬레이터(백테스트) (원본 app.js 9831-10704, 13954-14666).
// index.html 에서 app.js 보다 먼저 로드되는 classic script. 최상위 function/let/const 는
// 전역 렉시컬 환경을 공유하므로 app.js 와 양방향 참조가 호출 시점에 해결된다.

// 이 파일의 모든 저장소 접근은 window.safeStorage(storage.js — index.html 첫 스크립트) 를 거친다.

// ===== 가상 포트폴리오 시뮬레이터 (#24) =====
// 포지션은 시장별 키(mir_portfolio_v1:us / :kr)에 나눠 저장한다. 한 키에 섞어 두면
// 반대 시장 티커가 스냅샷에 없어 $0·-100% 행이 생기고 KRW 원가가 USD 합계에 더해졌다.
const PORTFOLIO_KEY_LEGACY = "mir_portfolio_v1";
const DIVIDEND_PLAN_KEY = "mir_dividend_plan_v1";
const INVESTMENT_JOURNAL_KEY = "mir_investment_journal_v1";
const REBALANCE_TARGET_KEY = "mir_rebalance_targets_v1";
const REBALANCE_TOTAL_EPS = 0.01;
const PORTFOLIO_DONUT_MODE_KEY = "mir_portfolio_donut_mode_v1";
const STRESS_TEST_KEY = "mir_stress_test_v1";
const PORTFOLIO_FX_KEY = "mir_portfolio_entry_fx_v1";
let portfolio = [];
let dividendPlan = {};
let investmentJournal = [];
let rebalanceTargets = {};
let portfolioDonutMode = "sector";
let stressTestState = { scenario: "market", overrides: {} };
let portfolioEntryFx = {};
let benchmarkAttributionRequest = 0;
const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b", "#14b8a6", "#eab308"];

function portfolioStorageKey(marketId) {
  const id = marketId || (isKrMarket() ? "kr" : "us");
  return `${PORTFOLIO_KEY_LEGACY}:${id === "kr" ? "kr" : "us"}`;
}

function portfolioMarketOf(ticker) {
  return /^\d{6}$/.test(String(ticker || "").replace(/\.(KS|KQ)$/i, "")) ? "kr" : "us";
}

function storedPortfolio(marketId) {
  const list = window.safeStorage.getJSON(portfolioStorageKey(marketId), []);
  return Array.isArray(list) ? list.filter((p) => p && p.ticker) : [];
}

// 옛 단일 키(mir_portfolio_v1)에 US·KR 포지션이 섞여 있던 것을 시장별 키로 한 번만 나눈다.
// 6자리 숫자 티커는 KR, 나머지는 US. 새 키가 이미 있으면 덮지 않는다.
function migrateLegacyPortfolio() {
  const legacy = window.safeStorage.getJSON(PORTFOLIO_KEY_LEGACY, null);
  if (!Array.isArray(legacy)) return;
  const split = { us: [], kr: [] };
  legacy.filter((p) => p && p.ticker).forEach((p) => split[portfolioMarketOf(p.ticker)].push(p));
  ["us", "kr"].forEach((id) => {
    if (Array.isArray(window.safeStorage.getJSON(portfolioStorageKey(id), null))) return;
    window.safeStorage.setJSON(portfolioStorageKey(id), split[id]);
  });
  window.safeStorage.remove(PORTFOLIO_KEY_LEGACY);
}

function loadPortfolio() {
  migrateLegacyPortfolio();
  portfolio = storedPortfolio();
}

function savePortfolio() {
  const cur = isKrMarket() ? "kr" : "us";
  const other = cur === "kr" ? "us" : "kr";
  // 클라우드 pull(app.js pullCloudSync)이 두 시장이 섞인 목록을 `portfolio` 에 통째로 넣을 수
  // 있다. 반대 시장 포지션은 그쪽 키에 병합(티커 기준 upsert)하고 현재 목록에서는 뺀다.
  const list = Array.isArray(portfolio) ? portfolio.filter((p) => p && p.ticker) : [];
  const mine = list.filter((p) => portfolioMarketOf(p.ticker) === cur);
  const foreign = list.filter((p) => portfolioMarketOf(p.ticker) !== cur);
  if (foreign.length) {
    const merged = storedPortfolio(other);
    foreign.forEach((p) => {
      const i = merged.findIndex((x) => x.ticker === p.ticker);
      if (i >= 0) merged[i] = p; else merged.push(p);
    });
    window.safeStorage.setJSON(portfolioStorageKey(other), merged);
  }
  // 반대 시장 포지션만 들어온 경우(구형 클라이언트가 그쪽 시장에서 push 한 payload)엔
  // 현재 시장 목록을 비우지 않는다. 사용자가 비운 경우(둘 다 0건)는 그대로 반영.
  if (mine.length || !foreign.length) {
    portfolio = mine;
    window.safeStorage.setJSON(portfolioStorageKey(cur), mine);
  } else {
    portfolio = storedPortfolio(cur);
  }
  scheduleCloudSyncPush();
}

// 클라우드 동기화 payload — 두 시장을 합친 평면 목록(기존 `portfolio` 와 같은 shape).
// app.js cloudSyncPayload() 가 `portfolio` 대신 이것을 실어야 KR 에서 push 해도 US 목록이
// 서버에서 지워지지 않는다.
function portfolioCloudPayload() {
  return [...storedPortfolio("us"), ...storedPortfolio("kr")].slice(0, 120);
}

// 클라우드에서 받은 평면 목록을 두 시장 키에 나눠 넣고 현재 시장 목록을 다시 읽는다.
// app.js pullCloudSync() 의 `portfolio = prefs.portfolio...; savePortfolio()` 를 이걸로 바꾼다.
function applyCloudPortfolio(list) {
  if (!Array.isArray(list) || !list.length) return;
  const split = { us: [], kr: [] };
  list.filter((p) => p && p.ticker).slice(0, 120).forEach((p) => split[portfolioMarketOf(p.ticker)].push(p));
  ["us", "kr"].forEach((id) => window.safeStorage.setJSON(portfolioStorageKey(id), split[id]));
  portfolio = storedPortfolio();
}

function loadPortfolioExtensions() {
  const obj = (key) => { const v = window.safeStorage.getJSON(key, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
  dividendPlan = obj(DIVIDEND_PLAN_KEY);
  const rows = window.safeStorage.getJSON(INVESTMENT_JOURNAL_KEY, []);
  investmentJournal = Array.isArray(rows) ? rows : [];
  rebalanceTargets = obj(REBALANCE_TARGET_KEY);
  portfolioDonutMode = window.safeStorage.get(PORTFOLIO_DONUT_MODE_KEY) === "stock" ? "stock" : "sector";
  const stress = obj(STRESS_TEST_KEY);
  stressTestState = { scenario: stress.scenario || "market", overrides: stress.overrides || {} };
  portfolioEntryFx = obj(PORTFOLIO_FX_KEY);
}

function savePortfolioExtension(key, value) {
  window.safeStorage.setJSON(key, value);
}

function portfolioDetailRows() {
  return portfolio.map((position) => {
    const stock = stockByTicker(position.ticker);
    const price = Number(stock?.price) || 0;
    return { ...position, stock, price, value: Number(position.qty || 0) * price };
  }).filter((row) => row.stock);
}

function numericDividend(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const DIVIDEND_PAYMENT_LAG_MONTHS = 1;

function parseIsoDateParts(dateStr) {
  const m = String(dateStr || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month, day };
}

function fmtPortfolioMoney(value) {
  return marketCfg().formatMoney(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function fmtPortfolioMoneyDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${fmtPortfolioMoney(Math.abs(n))}`;
}

function rebalanceTargetTotalOk(total) {
  return Math.abs(Number(total) - 100) < REBALANCE_TOTAL_EPS;
}

function rebalanceNormalizeTargetList(targets) {
  const total = targets.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return targets;
  return targets.map((value) => (value / total) * 100);
}

function rebalanceShareLabel(shares) {
  if (isKrMarket()) {
    const whole = Math.floor(shares);
    if (whole <= 0) return "1주 미만";
    return `${whole.toLocaleString()}주`;
  }
  return `${shares.toFixed(2)}주`;
}

function dividendDefaults(row) {
  const f = row.stock?.fundamentals || (window.MAP_FUNDAMENTALS || {})[row.ticker] || {};
  const direct = numericDividend(f.dividendRate || row.stock?.dividendRate);
  const rawYield = numericDividend(f.dividendYield || row.stock?.dividendYield);
  const yieldRatio = rawYield > 1 ? rawYield / 100 : rawYield;
  return {
    annualDps: direct || (yieldRatio > 0 ? row.price * yieldRatio : 0),
    frequency: 4,
    exDate: f.dividendExDate || row.stock?.dividendExDate || "",
  };
}

function dividendSetting(row) {
  return { ...dividendDefaults(row), ...(dividendPlan[row.ticker] || {}) };
}

function dividendMonthBuckets(rows) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: `${date.getMonth() + 1}월`, value: 0 };
  });
  rows.forEach((row) => {
    const setting = dividendSetting(row);
    const annualCash = numericDividend(setting.annualDps) * Number(row.qty || 0);
    const frequency = [1, 2, 4, 12].includes(Number(setting.frequency)) ? Number(setting.frequency) : 4;
    if (!(annualCash > 0) || !setting.exDate) return;
    const exParts = parseIsoDateParts(setting.exDate);
    if (!exParts) return;
    const exMonthIdx = exParts.month - 1;
    const step = 12 / frequency;
    const perPayment = annualCash / frequency;
    months.forEach((month, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      if (((date.getMonth() - exMonthIdx) + 12) % step !== 0) return;
      const payOffset = offset + DIVIDEND_PAYMENT_LAG_MONTHS;
      if (payOffset < months.length) months[payOffset].value += perPayment;
    });
  });
  return months;
}

function renderDividendPlanner() {
  const table = byId("dividendPlannerTable");
  const summary = byId("dividendPlannerSummary");
  const monthsBox = byId("dividendMonthGrid");
  if (!table || !summary || !monthsBox) return;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    byId("dividendPlannerTotal").textContent = `연 ${marketCfg().formatMoney(0)}`;
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">가상 포트폴리오에 종목을 추가하면 배당 계획을 만들 수 있습니다.</p>`;
    monthsBox.innerHTML = "";
    return;
  }
  const detailed = rows.map((row) => {
    const setting = dividendSetting(row);
    const annualCash = numericDividend(setting.annualDps) * Number(row.qty || 0);
    return { ...row, setting, annualCash };
  });
  const annual = detailed.reduce((sum, row) => sum + row.annualCash, 0);
  const portfolioValue = detailed.reduce((sum, row) => sum + row.value, 0);
  byId("dividendPlannerTotal").textContent = `연 ${marketCfg().formatMoney(annual)}`;
  summary.innerHTML = `
    <div><span>연간 예상</span><strong>${marketCfg().formatMoney(annual)}</strong></div>
    <div><span>월평균</span><strong>${marketCfg().formatMoney(annual / 12)}</strong></div>
    <div><span>평가액 대비</span><strong>${portfolioValue > 0 ? (annual / portfolioValue * 100).toFixed(2) : "0.00"}%</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>연 DPS</th><th>주기</th><th>기준일</th><th>연 예상</th></tr></thead><tbody>${detailed.map((row) => `
    <tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${Number(row.qty).toLocaleString()}주</small></td>
      <td><input type="number" min="0" step="0.01" value="${numericDividend(row.setting.annualDps) || ""}" data-dividend-ticker="${escapeHtml(row.ticker)}" data-dividend-field="annualDps" aria-label="${escapeHtml(row.ticker)} 연간 주당배당금"></td>
      <td><select data-dividend-ticker="${escapeHtml(row.ticker)}" data-dividend-field="frequency" aria-label="${escapeHtml(row.ticker)} 배당 주기">${[[12,"월"],[4,"분기"],[2,"반기"],[1,"연"]].map(([value, label]) => `<option value="${value}"${Number(row.setting.frequency) === value ? " selected" : ""}>${label}</option>`).join("")}</select></td>
      <td><input type="date" value="${escapeHtml(row.setting.exDate || "")}" data-dividend-ticker="${escapeHtml(row.ticker)}" data-dividend-field="exDate" aria-label="${escapeHtml(row.ticker)} 배당 기준일"></td>
      <td><strong>${marketCfg().formatMoney(row.annualCash)}</strong></td></tr>`).join("")}</tbody></table>`;
  table.querySelectorAll("[data-dividend-ticker]").forEach((control) => control.addEventListener("change", () => {
    const ticker = control.dataset.dividendTicker;
    const current = dividendSetting(rows.find((row) => row.ticker === ticker));
    current[control.dataset.dividendField] = control.dataset.dividendField === "exDate" ? control.value : Number(control.value || 0);
    dividendPlan[ticker] = current;
    savePortfolioExtension(DIVIDEND_PLAN_KEY, dividendPlan);
    renderDividendPlanner();
  }));
  const months = dividendMonthBuckets(rows);
  monthsBox.innerHTML = `${months.map((month) => `<div class="dividend-month"><span>${month.label}</span><strong>${fmtPortfolioMoney(month.value)}</strong></div>`).join("")}
    <p class="muted dividend-month-note">배당락일 기준 +${DIVIDEND_PAYMENT_LAG_MONTHS}개월 지급 가정(현금 유입 월)</p>`;
}

function renderRebalanceCalculator() {
  const table = byId("rebalanceTable");
  const summary = byId("rebalanceSummary");
  if (!table || !summary) return;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 목표 비중을 계산할 수 있습니다.</p>`;
    return;
  }
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const equal = 100 / rows.length;
  const rawTargets = rows.map((row) => Number.isFinite(Number(rebalanceTargets[row.ticker])) ? Number(rebalanceTargets[row.ticker]) : equal);
  const targetTotal = rawTargets.reduce((sum, value) => sum + value, 0);
  const targets = rebalanceTargetTotalOk(targetTotal) ? rebalanceNormalizeTargetList(rawTargets) : rawTargets;
  const displayTotal = rebalanceTargetTotalOk(targetTotal) ? 100 : targetTotal;
  summary.innerHTML = `
    <div><span>평가금액</span><strong>${fmtPortfolioMoney(totalValue)}</strong></div>
    <div><span>목표 합계</span><strong class="${rebalanceTargetTotalOk(targetTotal) ? "pos" : "neg"}">${displayTotal.toFixed(1)}%</strong></div>
    <div><span>계산 기준</span><strong>현재 총액 유지</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>현재</th><th>목표</th><th>차이</th><th>주문 수량</th></tr></thead><tbody>${rows.map((row, index) => {
    const currentPct = totalValue > 0 ? row.value / totalValue * 100 : 0;
    const targetPct = targets[index];
    const difference = totalValue * (targetPct - currentPct) / 100;
    const shares = row.price > 0 ? Math.abs(difference) / row.price : 0;
    const action = Math.abs(difference) < Math.max(1, totalValue * 0.001)
      ? "유지"
      : difference > 0
        ? `매수 ${rebalanceShareLabel(shares)}`
        : `매도 ${rebalanceShareLabel(shares)}`;
    return `<tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${priceOrDash(row.price)}</small></td><td>${currentPct.toFixed(1)}%</td><td><input type="number" min="0" max="100" step="0.1" value="${targetPct.toFixed(1)}" data-rebalance-ticker="${escapeHtml(row.ticker)}" aria-label="${escapeHtml(row.ticker)} 목표 비중">%</td><td class="${cls(difference)}">${fmtPortfolioMoneyDelta(difference)}</td><td><strong class="${difference > 0 ? "pos" : difference < 0 ? "neg" : "muted"}">${action}</strong></td></tr>`;
  }).join("")}</tbody></table>`;
  table.querySelectorAll("[data-rebalance-ticker]").forEach((input) => input.addEventListener("change", () => {
    rebalanceTargets[input.dataset.rebalanceTicker] = Math.max(0, Number(input.value) || 0);
    savePortfolioExtension(REBALANCE_TARGET_KEY, rebalanceTargets);
    renderRebalanceCalculator();
  }));
}

function setEqualRebalanceTargets() {
  const rows = portfolioDetailRows();
  if (!rows.length) return;
  const value = 100 / rows.length;
  rows.forEach((row) => { rebalanceTargets[row.ticker] = value; });
  normalizeRebalanceTargets();
}

function normalizeRebalanceTargets() {
  const rows = portfolioDetailRows();
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(rebalanceTargets[row.ticker]) || 0), 0);
  if (!(total > 0)) return setEqualRebalanceTargets();
  rows.forEach((row) => { rebalanceTargets[row.ticker] = (Math.max(0, Number(rebalanceTargets[row.ticker]) || 0) / total) * 100; });
  savePortfolioExtension(REBALANCE_TARGET_KEY, rebalanceTargets);
  renderRebalanceCalculator();
}

function stressSectorKind(sector) {
  const s = String(sector || "");
  const u = s.toUpperCase();
  if (u === "TECHNOLOGY" || /기술|반도체|정보|IT|소프트웨어/.test(s)) return "technology";
  if (u === "COMMUNICATION SERVICES" || /커뮤니케이션|통신|미디어/.test(s)) return "communication";
  if (u === "FINANCIAL" || /금융|은행|보험|증권/.test(s)) return "financial";
  if (u === "CONSUMER CYCLICAL" || /경기소비|자동차|호텔|레저/.test(s)) return "consumer_cyclical";
  if (u === "CONSUMER DEFENSIVE" || /필수소비/.test(s)) return "consumer_defensive";
  if (u === "HEALTHCARE" || /헬스|의료|바이오|제약/.test(s)) return "healthcare";
  if (u === "UTILITIES" || /유틸/.test(s)) return "utilities";
  if (u === "INDUSTRIALS" || /산업|기계|조선|항공/.test(s)) return "industrials";
  if (u === "ENERGY" || /에너지|석유|가스/.test(s)) return "energy";
  if (u === "REAL ESTATE" || /부동산|리츠|REIT/.test(s)) return "real_estate";
  if (u === "BASIC MATERIALS" || /소재|화학|철강/.test(s)) return "materials";
  return "other";
}

function presetStressShock(row, scenario) {
  const kind = stressSectorKind(row.stock?.sector);
  if (scenario === "market") return -10;
  if (scenario === "tech") {
    if (kind === "technology") return -15;
    if (kind === "communication") return -10;
    return -6;
  }
  if (scenario === "recession") {
    if (["consumer_cyclical", "financial", "industrials", "energy", "materials"].includes(kind)) return -15;
    if (["consumer_defensive", "healthcare", "utilities"].includes(kind)) return -5;
    return -10;
  }
  if (scenario === "rates") {
    if (kind === "financial") return 3;
    if (kind === "real_estate" || kind === "technology") return -12;
    if (kind === "utilities") return -8;
    return -5;
  }
  return -10;
}

function fmtStressMoney(value) {
  if (!Number.isFinite(Number(value))) return "-";
  if (isKrMarket()) return fmtKrw(value);
  return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtStressDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n >= 0 ? "+" : "-";
  if (isKrMarket()) return `${sign}${fmtKrw(Math.abs(n))}`;
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function stressShockFor(row) {
  const override = stressTestState.overrides?.[row.ticker];
  return Number.isFinite(Number(override)) ? Number(override) : presetStressShock(row, stressTestState.scenario);
}

function saveStressTestState() {
  savePortfolioExtension(STRESS_TEST_KEY, stressTestState);
}

function renderStressTest() {
  const table = byId("stressTable");
  const summary = byId("stressSummary");
  const scenario = byId("stressScenario");
  if (!table || !summary || !scenario) return;
  scenario.value = stressTestState.scenario;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 시나리오별 예상 손실을 계산할 수 있습니다.</p>`;
    return;
  }
  const original = rows.reduce((sum, row) => sum + row.value, 0);
  const detailed = rows.map((row) => {
    const shock = stressShockFor(row);
    const stressedValue = Math.max(0, row.value * (1 + shock / 100));
    return { ...row, shock, stressedValue, impact: stressedValue - row.value };
  });
  const stressed = detailed.reduce((sum, row) => sum + row.stressedValue, 0);
  const impact = stressed - original;
  summary.innerHTML = `
    <div><span>현재 평가액</span><strong>${fmtStressMoney(original)}</strong></div>
    <div><span>스트레스 후</span><strong>${fmtStressMoney(stressed)}</strong></div>
    <div><span>예상 변화</span><strong class="${cls(impact)}">${fmtStressDelta(impact)} (${original > 0 ? (impact / original * 100).toFixed(1) : "0.0"}%)</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>현재 평가액</th><th>충격률</th><th>예상 영향</th><th>스트레스 후 비중</th></tr></thead><tbody>${detailed.map((row) => `
    <tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${escapeHtml(row.stock?.sector || "기타")}</small></td>
      <td>${fmtStressMoney(row.value)}</td>
      <td><input type="number" min="-100" max="100" step="1" value="${row.shock.toFixed(1)}" data-stress-ticker="${escapeHtml(row.ticker)}" aria-label="${escapeHtml(row.ticker)} 충격률">%</td>
      <td class="${cls(row.impact)}">${fmtStressDelta(row.impact)}</td>
      <td>${stressed > 0 ? (row.stressedValue / stressed * 100).toFixed(1) : "0.0"}%</td></tr>`).join("")}</tbody></table>`;
  table.querySelectorAll("[data-stress-ticker]").forEach((input) => input.addEventListener("change", () => {
    if (stressTestState.scenario !== "custom") {
      stressTestState.overrides = Object.fromEntries(detailed.map((row) => [row.ticker, row.shock]));
    }
    stressTestState.scenario = "custom";
    stressTestState.overrides[input.dataset.stressTicker] = Math.max(-100, Math.min(100, Number(input.value) || 0));
    saveStressTestState();
    renderStressTest();
  }));
}

function renderPositionSizeCalculator(showErrors = false) {
  const box = byId("positionSizeResult");
  if (!box) return;
  const capital = Number(byId("positionCapital")?.value);
  const entry = Number(byId("positionEntry")?.value);
  const stop = Number(byId("positionStop")?.value);
  const riskPct = Number(byId("positionRiskPct")?.value);
  const maxPct = Number(byId("positionMaxPct")?.value);
  if (!(capital > 0) || !(entry > 0) || !(stop > 0) || !(stop < entry) || !(riskPct > 0) || !(maxPct > 0)) {
    box.innerHTML = `<p class="${showErrors ? "neg" : "muted"}">${showErrors ? "투자금·진입가·손절가를 확인하세요. 롱 포지션은 손절가가 진입가보다 낮아야 합니다." : "값을 입력하면 허용 손실 기준 적정 매수 수량을 계산합니다."}</p>`;
    return;
  }
  const riskBudget = capital * riskPct / 100;
  const riskPerShare = entry - stop;
  const riskShares = Math.floor(riskBudget / riskPerShare);
  const allocationShares = Math.floor((capital * Math.min(100, maxPct) / 100) / entry);
  const shares = Math.max(0, Math.min(riskShares, allocationShares));
  const positionValue = shares * entry;
  const plannedLoss = shares * riskPerShare;
  const binding = riskShares <= allocationShares ? "허용 손실" : "최대 비중";
  const fmtPosMoney = (v) => marketCfg().formatMoney(v);
  box.innerHTML = `
    <div><span>적정 수량</span><strong>${shares.toLocaleString()}주</strong></div>
    <div><span>예상 투자금</span><strong>${fmtPosMoney(positionValue)}</strong></div>
    <div><span>손절 시 손실</span><strong class="neg">-${fmtPosMoney(plannedLoss)}</strong></div>
    <div><span>적용 제한</span><strong>${binding}</strong></div>`;
}

function syncPositionTickerPrice() {
  const raw = byId("positionTicker")?.value || "";
  const ticker = resolveCommunityTickerInput(raw) || String(raw).trim().toUpperCase();
  const stock = stockByTicker(ticker);
  if (!stock) return;
  byId("positionTicker").value = ticker;
  byId("positionEntry").value = marketCfg().priceInputValue(stock.price); // KRW 는 정수, USD 는 센트
  renderPositionSizeCalculator(false);
}

function currentUsdKrw() {
  const row = (marketHeader.fx || []).find((item) => item.symbol === "KRW=X");
  const rate = Number(row?.price);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function fmtKrw(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(Number(value));
}

function isKrwQuotedTicker(ticker) {
  const key = String(ticker || "").replace(/\.(KS|KQ)$/i, "");
  if (isKrMarket()) return true;
  return /^\d{6}$/.test(key);
}

function renderKrwPortfolio() {
  const summary = byId("krwPortfolioSummary");
  const table = byId("krwPortfolioTable");
  const rateLabel = byId("krwCurrentRate");
  if (!summary || !table || !rateLabel) return;
  const rows = portfolioDetailRows();
  if (!rows.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 원화 평가손익을 계산할 수 있습니다.</p>`;
    rateLabel.textContent = "USD/KRW —";
    return;
  }
  const needsFx = rows.some((row) => !isKrwQuotedTicker(row.ticker));
  const currentFx = currentUsdKrw();
  if (needsFx) {
    rateLabel.textContent = currentFx ? `USD/KRW ${currentFx.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "USD/KRW 로딩 중";
  } else {
    rateLabel.textContent = "원화 종목 — 환율 미적용";
  }
  if (needsFx && !currentFx) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">실시간 USD/KRW 환율을 불러오는 중입니다.</p>`;
    return;
  }
  const detailed = rows.map((row) => {
    if (isKrwQuotedTicker(row.ticker)) {
      const krwCost = Number(row.qty || 0) * Number(row.avgCost || 0);
      const krwValue = row.value;
      const priceEffect = krwValue - krwCost;
      return {
        ...row,
        krwNative: true,
        entryFx: 1,
        hasSavedFx: false,
        usdCost: 0,
        usdValue: 0,
        krwCost,
        krwValue,
        priceEffect,
        fxEffect: 0,
        totalEffect: priceEffect,
      };
    }
    const savedEntryFx = Number(portfolioEntryFx[row.ticker]);
    const entryFx = Number.isFinite(savedEntryFx) && savedEntryFx > 0 ? savedEntryFx : currentFx;
    const usdCost = Number(row.qty || 0) * Number(row.avgCost || 0);
    const usdValue = row.value;
    const krwCost = usdCost * entryFx;
    const krwValue = usdValue * currentFx;
    const priceEffect = (usdValue - usdCost) * entryFx;
    const fxEffect = usdValue * (currentFx - entryFx);
    return { ...row, krwNative: false, entryFx, hasSavedFx: savedEntryFx > 0, usdCost, usdValue, krwCost, krwValue, priceEffect, fxEffect, totalEffect: krwValue - krwCost };
  });
  const totals = detailed.reduce((acc, row) => {
    ["krwCost", "krwValue", "priceEffect", "fxEffect", "totalEffect"].forEach((key) => { acc[key] += row[key]; });
    return acc;
  }, { krwCost: 0, krwValue: 0, priceEffect: 0, fxEffect: 0, totalEffect: 0 });
  summary.innerHTML = `
    <div><span>원화 평가액</span><strong>${fmtKrw(totals.krwValue)}</strong></div>
    <div><span>총 원화 손익</span><strong class="${cls(totals.totalEffect)}">${fmtKrw(totals.totalEffect)}</strong></div>
    <div><span>주가 효과</span><strong class="${cls(totals.priceEffect)}">${fmtKrw(totals.priceEffect)}</strong></div>
    <div><span>환율 효과</span><strong class="${cls(totals.fxEffect)}">${fmtKrw(totals.fxEffect)}</strong></div>`;
  table.innerHTML = `<table><thead><tr><th>종목</th><th>매입 환율</th><th>원화 원금</th><th>원화 평가액</th><th>주가 효과</th><th>환율 효과</th><th>총 손익</th></tr></thead><tbody>${detailed.map((row) => `
    <tr><td><strong>${escapeHtml(row.ticker)}</strong><small>${Number(row.qty).toLocaleString()}주</small></td>
      <td>${row.krwNative ? `<span class="muted">—</span>` : `<input type="number" min="1" step="0.1" value="${row.entryFx.toFixed(1)}" data-entry-fx-ticker="${escapeHtml(row.ticker)}" aria-label="${escapeHtml(row.ticker)} 매입 환율"><small>${row.hasSavedFx ? "저장됨" : "현재 환율 임시 적용"}</small>`}</td>
      <td>${fmtKrw(row.krwCost)}</td><td>${fmtKrw(row.krwValue)}</td>
      <td class="${cls(row.priceEffect)}">${fmtKrw(row.priceEffect)}</td><td class="${cls(row.fxEffect)}">${fmtKrw(row.fxEffect)}</td><td class="${cls(row.totalEffect)}"><strong>${fmtKrw(row.totalEffect)}</strong></td></tr>`).join("")}</tbody></table>`;
  table.querySelectorAll("[data-entry-fx-ticker]").forEach((input) => input.addEventListener("change", () => {
    const value = Number(input.value);
    if (!(value > 0)) return;
    portfolioEntryFx[input.dataset.entryFxTicker] = value;
    savePortfolioExtension(PORTFOLIO_FX_KEY, portfolioEntryFx);
    renderKrwPortfolio();
  }));
}

// 벤치마크 셀렉트(#portfolioBenchmark)는 정적 HTML 이 SPY/QQQ/DIA/IWM 고정이라 KR 에서
// normalizeTickerKey("SPY")→"000SPY" 로 korea/details/000SPY.json 404 를 냈다. 시장별
// 옵션(market_config backtestBenchmarks)으로 채우고, 스냅샷에 없는 값이면 기본 ETF 로.
function populatePortfolioBenchmarks() {
  const sel = byId("portfolioBenchmark");
  if (!sel) return;
  const cfg = marketCfg();
  if (sel.dataset.market === cfg.id) return;
  const options = (cfg.backtestBenchmarks || []).filter(([t]) => stockByTicker(t));
  if (!options.length) return; // 스냅샷 준비 전엔 손대지 않는다
  const prev = sel.value;
  sel.innerHTML = options.map(([t, label]) => `<option value="${escapeHtml(t)}">${escapeHtml(t)} · ${escapeHtml(label)}</option>`).join("");
  sel.value = options.some(([t]) => t === prev) ? prev : options[0][0];
  sel.dataset.market = cfg.id;
}

function portfolioBenchmarkTicker() {
  populatePortfolioBenchmarks();
  const cfg = marketCfg();
  const raw = String(byId("portfolioBenchmark")?.value || "");
  const t = raw ? normalizeTickerKey(raw) : "";
  if (t && stockByTicker(t)) return t;
  return (cfg.etfBenchmarks || []).find((x) => stockByTicker(x)) || (cfg.etfBenchmarks || [])[0] || "SPY";
}

// renderPortfolio() 가 부를 때마다 보유종목 전부의 상세 파일을 다시 받았다(도넛 모드
// 토글·환율 갱신에도). 250ms 디바운스 + (보유목록, 기간, 벤치마크, 스냅샷) 키 캐시.
let benchmarkAttributionTimer = 0;
const benchmarkAttributionCache = new Map(); // key → { summary, table, status }
const BENCHMARK_ATTRIBUTION_CACHE_MAX = 8;

function renderBenchmarkAttribution() {
  clearTimeout(benchmarkAttributionTimer);
  benchmarkAttributionTimer = setTimeout(() => { renderBenchmarkAttributionNow(); }, 250);
}

function paintBenchmarkAttribution(summary, table, status, result) {
  summary.innerHTML = result.summary;
  table.innerHTML = result.table;
  status.textContent = result.status;
  table.querySelectorAll("[data-benchmark-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.benchmarkTicker, { openSearch: true })));
}

async function renderBenchmarkAttributionNow() {
  const summary = byId("benchmarkAttributionSummary");
  const table = byId("benchmarkAttributionTable");
  const status = byId("benchmarkAttributionStatus");
  if (!summary || !table || !status) return;
  const positions = portfolioDetailRows();
  const benchmarkTicker = portfolioBenchmarkTicker();
  const periodBars = Number(byId("portfolioBenchmarkPeriod")?.value || 63);
  const requestId = ++benchmarkAttributionRequest;
  if (!positions.length) {
    summary.innerHTML = "";
    table.innerHTML = `<p class="muted">보유 종목을 추가하면 벤치마크 대비 성과를 계산할 수 있습니다.</p>`;
    status.textContent = "";
    return;
  }
  const cacheKey = JSON.stringify({
    m: marketCfg().id,
    snap: String((data && (data.updatedAtKst || data.updated_at_kst)) || ""),
    b: benchmarkTicker,
    p: periodBars,
    h: positions.map((p) => [p.ticker, Number(p.qty) || 0]),
  });
  const cached = benchmarkAttributionCache.get(cacheKey);
  if (cached) {
    paintBenchmarkAttribution(summary, table, status, cached);
    return;
  }
  status.textContent = "가격 이력을 불러오는 중입니다.";
  summary.innerHTML = "";
  table.innerHTML = "";
  try {
    const loaded = await Promise.all([...positions.map(async (position) => {
      const detail = await loadStockDetail(position.ticker);
      const merged = detail ? { ...position.stock, ...detail } : position.stock;
      const chartRows = getChartRows(merged);
      return { ...position, rows: chartRows, dateMap: closeSeriesToDateMap(chartRows), synthetic: isSyntheticChart(merged) };
    }), (async () => {
      const stock = stockByTicker(benchmarkTicker);
      const detail = await loadStockDetail(benchmarkTicker);
      const merged = detail ? { ...stock, ...detail } : stock;
      const chartRows = getChartRows(merged);
      return { ticker: benchmarkTicker, stock, rows: chartRows, dateMap: closeSeriesToDateMap(chartRows), synthetic: isSyntheticChart(merged), benchmark: true };
    })()]);
    if (requestId !== benchmarkAttributionRequest) return;
    const benchmark = loaded.find((row) => row.benchmark);
    const valid = loaded.filter((row) => !row.benchmark && !row.synthetic && row.dateMap.size >= 22);
    if (!benchmark || benchmark.synthetic || benchmark.dateMap.size < 22 || !valid.length) {
      status.textContent = "실제 가격 이력이 있는 보유종목과 벤치마크가 필요합니다.";
      return;
    }
    let dateResult = backtestResolveDates([...valid, benchmark], periodBars, null, null);
    if (!dateResult.dates.length) {
      const fallback = Math.min(periodBars, ...valid.map((row) => row.dateMap.size), benchmark.dateMap.size);
      dateResult = backtestResolveDates([...valid, benchmark], fallback, null, null);
    }
    if (!dateResult.dates.length) {
      status.textContent = dateResult.error || "공통 거래일을 계산하지 못했습니다.";
      return;
    }
    const startDate = dateResult.dates[0];
    const endDate = dateResult.dates[dateResult.dates.length - 1];
    const benchmarkReturn = (benchmark.dateMap.get(endDate) / benchmark.dateMap.get(startDate) - 1) * 100;
    const validValue = valid.reduce((sum, row) => sum + row.value, 0);
    const rows = valid.map((row) => {
      const weightPct = validValue > 0 ? row.value / validValue * 100 : 100 / valid.length;
      const returnPct = (row.dateMap.get(endDate) / row.dateMap.get(startDate) - 1) * 100;
      const contribution = returnPct * weightPct / 100;
      const alphaContribution = (returnPct - benchmarkReturn) * weightPct / 100;
      return { ...row, weightPct, returnPct, contribution, alphaContribution };
    });
    const portfolioReturn = rows.reduce((sum, row) => sum + row.contribution, 0);
    const alpha = portfolioReturn - benchmarkReturn;
    const excluded = positions.length - valid.length;
    const result = {
      summary: `
      <div><span>포트폴리오</span><strong class="${cls(portfolioReturn)}">${fmtPct(portfolioReturn)}</strong></div>
      <div><span>${escapeHtml(benchmarkTicker)}</span><strong class="${cls(benchmarkReturn)}">${fmtPct(benchmarkReturn)}</strong></div>
      <div><span>초과수익</span><strong class="${cls(alpha)}">${fmtPct(alpha)}</strong></div>
      <div><span>비교 기간</span><strong>${escapeHtml(startDate)} ~ ${escapeHtml(endDate)}</strong></div>`,
      table: `<table><thead><tr><th>종목</th><th>현재 비중</th><th>기간 수익률</th><th>수익 기여도</th><th>${escapeHtml(benchmarkTicker)} 대비 기여도</th></tr></thead><tbody>${rows.sort((a, b) => b.alphaContribution - a.alphaContribution).map((row) => `
      <tr><td><button type="button" class="benchmark-ticker" data-benchmark-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td><td>${row.weightPct.toFixed(1)}%</td><td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td><td class="${cls(row.contribution)}">${row.contribution >= 0 ? "+" : ""}${row.contribution.toFixed(2)}%p</td><td class="${cls(row.alphaContribution)}"><strong>${row.alphaContribution >= 0 ? "+" : ""}${row.alphaContribution.toFixed(2)}%p</strong></td></tr>`).join("")}</tbody></table>`,
      status: excluded ? `가격 이력이 부족한 ${excluded}개 종목은 제외했습니다. 현재 비중을 유효 종목에 다시 배분한 근사치입니다.` : "현재 비중을 기간 시작점에 적용한 근사 기여도입니다.",
    };
    benchmarkAttributionCache.set(cacheKey, result);
    if (benchmarkAttributionCache.size > BENCHMARK_ATTRIBUTION_CACHE_MAX) {
      benchmarkAttributionCache.delete(benchmarkAttributionCache.keys().next().value);
    }
    paintBenchmarkAttribution(summary, table, status, result);
  } catch (_) {
    if (requestId === benchmarkAttributionRequest) status.textContent = "벤치마크 분석 데이터를 불러오지 못했습니다.";
  }
}

function setupPortfolioExtensions() {
  const equal = byId("rebalanceEqual");
  if (equal && !equal.dataset.bound) {
    equal.dataset.bound = "1";
    equal.addEventListener("click", setEqualRebalanceTargets);
    byId("rebalanceNormalize")?.addEventListener("click", normalizeRebalanceTargets);
  }
  const scenario = byId("stressScenario");
  if (scenario && !scenario.dataset.bound) {
    scenario.dataset.bound = "1";
    scenario.addEventListener("change", () => {
      stressTestState = { scenario: scenario.value, overrides: {} };
      saveStressTestState();
      renderStressTest();
    });
  }
  const positionButton = byId("positionCalculate");
  if (positionButton && !positionButton.dataset.bound) {
    positionButton.dataset.bound = "1";
    positionButton.addEventListener("click", () => renderPositionSizeCalculator(true));
    byId("positionTicker")?.addEventListener("change", syncPositionTickerPrice);
    ["positionCapital", "positionEntry", "positionStop", "positionRiskPct", "positionMaxPct"].forEach((id) => byId(id)?.addEventListener("change", () => renderPositionSizeCalculator(false)));
  }
  const benchmark = byId("portfolioBenchmark");
  if (benchmark && !benchmark.dataset.bound) {
    benchmark.dataset.bound = "1";
    benchmark.addEventListener("change", renderBenchmarkAttribution);
    byId("portfolioBenchmarkPeriod")?.addEventListener("change", renderBenchmarkAttribution);
  }
  const save = byId("journalSave");
  if (save && !save.dataset.bound) {
    save.dataset.bound = "1";
    const date = byId("journalDate");
    if (date && !date.value) date.value = formatKstDateTime().slice(0, 10);
    save.addEventListener("click", () => {
      const rawTicker = byId("journalTicker")?.value || "";
      const ticker = resolveCommunityTickerInput(rawTicker) || String(rawTicker).trim().toUpperCase();
      const thesis = String(byId("journalThesis")?.value || "").trim();
      if (!ticker || !stockByTicker(ticker) || !thesis) {
        showAppToast("유효한 티커와 투자 근거를 입력하세요");
        return;
      }
      investmentJournal.unshift({
        id: `${Date.now()}-${ticker}`,
        ticker,
        status: byId("journalStatus")?.value || "idea",
        date: byId("journalDate")?.value || formatKstDateTime().slice(0, 10),
        entry: Number(byId("journalEntry")?.value) || null,
        target: Number(byId("journalTarget")?.value) || null,
        stop: Number(byId("journalStop")?.value) || null,
        thesis,
      });
      investmentJournal = investmentJournal.slice(0, 100);
      savePortfolioExtension(INVESTMENT_JOURNAL_KEY, investmentJournal);
      ["journalTicker", "journalEntry", "journalTarget", "journalStop", "journalThesis"].forEach((id) => { const el = byId(id); if (el) el.value = ""; });
      renderInvestmentJournal();
    });
  }
}

function renderInvestmentJournal() {
  const list = byId("journalList");
  if (!list) return;
  setupPortfolioExtensions();
  byId("journalCount").textContent = `${investmentJournal.length}건`;
  if (!investmentJournal.length) {
    list.innerHTML = `<p class="muted">투자 근거를 기록하면 목표가·손절가와 함께 추적할 수 있습니다.</p>`;
    return;
  }
  const labels = { idea: "검토", open: "보유", closed: "종료" };
  list.innerHTML = investmentJournal.map((row) => `
    <article class="journal-entry">
      <button type="button" class="journal-ticker" data-journal-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button>
      <div><strong>${escapeHtml(row.thesis)}</strong><small>${escapeHtml(row.date || "")} · 진입 ${row.entry ? marketCfg().formatPrice(row.entry) : "-"} · 목표 ${row.target ? marketCfg().formatPrice(row.target) : "-"} · 손절 ${row.stop ? marketCfg().formatPrice(row.stop) : "-"}</small></div>
      <select data-journal-status="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.ticker)} 기록 상태">${Object.entries(labels).map(([value, label]) => `<option value="${value}"${row.status === value ? " selected" : ""}>${label}</option>`).join("")}</select>
      <button type="button" class="journal-delete" data-journal-delete="${escapeHtml(row.id)}" aria-label="기록 삭제">삭제</button>
    </article>`).join("");
  list.querySelectorAll("[data-journal-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.journalTicker, { openSearch: true })));
  list.querySelectorAll("[data-journal-status]").forEach((select) => select.addEventListener("change", () => {
    const row = investmentJournal.find((item) => item.id === select.dataset.journalStatus);
    if (row) row.status = select.value;
    savePortfolioExtension(INVESTMENT_JOURNAL_KEY, investmentJournal);
    renderInvestmentJournal();
  }));
  list.querySelectorAll("[data-journal-delete]").forEach((button) => button.addEventListener("click", () => {
    investmentJournal = investmentJournal.filter((item) => item.id !== button.dataset.journalDelete);
    savePortfolioExtension(INVESTMENT_JOURNAL_KEY, investmentJournal);
    renderInvestmentJournal();
  }));
}

function setupPortfolio() {
  const add = byId("pfAdd");
  if (add && !add.dataset.bound) {
    add.dataset.bound = "1";
    const doAdd = () => {
      const t = resolveCommunityTickerInput(byId("pfTicker").value) || String(byId("pfTicker").value || "").trim().toUpperCase();
      const qty = Number(byId("pfQty").value);
      const cost = Number(byId("pfCost").value);
      if (!t) { showAppToast("종목 코드를 입력해 주세요."); return; }
      if (!stockByTicker(t)) { showAppToast(`'${t}' 종목을 찾지 못했습니다. 티커·종목명을 확인해 주세요.`); return; }
      if (!(qty > 0)) { showAppToast("수량은 0보다 커야 합니다."); return; }
      if (!(cost > 0)) { showAppToast("평단가는 0보다 커야 합니다."); return; }
      const existing = portfolio.find((p) => p.ticker === t);
      if (existing) { existing.qty = qty; existing.avgCost = cost; }
      else portfolio.push({ ticker: t, qty, avgCost: cost });
      savePortfolio();
      byId("pfTicker").value = ""; byId("pfQty").value = ""; byId("pfCost").value = "";
      renderPortfolio();
    };
    add.addEventListener("click", doAdd);
    byId("pfClear")?.addEventListener("click", () => { portfolio = []; savePortfolio(); renderPortfolio(); });
    ["pfTicker", "pfQty", "pfCost"].forEach((id) => byId(id)?.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); }));
  }
}

function donutSvg(slices) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52, cx = 60, cy = 60, sw = 22;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = slices.map((s, i) => {
    const frac = s.value / total;
    const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
    const off = (-acc * C).toFixed(2);
    acc += frac;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PIE_COLORS[i % PIE_COLORS.length]}" stroke-width="${sw}" stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
  }).join("");
  return `<svg viewBox="0 0 120 120" class="pf-donut">${segs}</svg>`;
}

function renderPortfolio() {
  setupPortfolio();
  setupPortfolioExtensions();
  const summaryEl = byId("pfSummary");
  const tableEl = byId("pfTable");
  const pieEl = byId("pfPie");
  if (!tableEl) return;
  if (!portfolio.length) {
    if (summaryEl) summaryEl.innerHTML = "";
    tableEl.innerHTML = `<p class="muted">보유 종목을 추가하면 손익과 섹터 분산이 표시됩니다.</p>`;
    if (pieEl) pieEl.innerHTML = "";
    renderDividendPlanner();
    renderRebalanceCalculator();
    renderStressTest();
    renderPositionSizeCalculator(false);
    renderKrwPortfolio();
    renderBenchmarkAttribution();
    renderInvestmentJournal();
    renderPortfolioXray();
    return;
  }
  // 현재 스냅샷에 없는 티커(상장폐지·시장 불일치)는 합계에서 뺀다 — 넣으면 $0 행과
  // -100% 손익이 생기고, 예전엔 KRW 원가가 USD 합계에 더해졌다(portfolioDetailRows 와 동일 규칙).
  const rows = portfolio.map((p) => {
    const stock = stockByTicker(p.ticker);
    const price = stock ? Number(stock.price) : 0;
    const value = p.qty * price;
    const cost = p.qty * p.avgCost;
    const pl = value - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    return { ...p, stock, price, value, cost, pl, plPct, sector: stock?.sector || "기타", changePct: Number(stock?.changePct) || 0 };
  }).filter((r) => r.stock);
  const missing = portfolio.length - rows.length;
  if (!rows.length) {
    if (summaryEl) summaryEl.innerHTML = "";
    tableEl.innerHTML = `<p class="muted">저장된 ${portfolio.length}개 종목이 현재 시장 스냅샷에 없습니다. 티커를 확인하거나 시장을 전환해 보세요.</p>`;
    if (pieEl) pieEl.innerHTML = "";
    renderDividendPlanner();
    renderRebalanceCalculator();
    renderStressTest();
    renderPositionSizeCalculator(false);
    renderKrwPortfolio();
    renderBenchmarkAttribution();
    renderInvestmentJournal();
    renderPortfolioXray();
    return;
  }
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  // 일간 기여도 = Σ(비중 × 종목 당일등락률)
  const dayContribution = rows.reduce((s, r) => s + (totalValue > 0 ? (r.value / totalValue) * r.changePct : 0), 0);

  const fmtPfMoney = (v) => marketCfg().formatMoney(v);
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="pf-stat"><span>평가금액</span><strong>${fmtPfMoney(totalValue)}</strong></div>
      <div class="pf-stat"><span>투자원금</span><strong>${fmtPfMoney(totalCost)}</strong></div>
      <div class="pf-stat"><span>평가손익</span><strong class="${cls(totalPL)}">${totalPL >= 0 ? "+" : ""}${fmtPfMoney(Math.abs(totalPL))} (${fmtPct(totalPLPct)})</strong></div>
      <div class="pf-stat"><span>오늘 기여도</span><strong class="${cls(dayContribution)}">${fmtPct(dayContribution)}</strong></div>`;
  }

  rows.sort((a, b) => b.value - a.value);
  const body = rows.map((r) => `<tr>
    <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.ticker)}">${escapeHtml(isKrMarket() ? (r.stock?.company || r.ticker) : r.ticker)}</button></td>
    <td class="ins-num">${r.qty.toLocaleString()}</td>
    <td class="ins-num">${fmtPfMoney(r.avgCost)}</td>
    <td class="ins-num">${fmtPfMoney(r.price)}</td>
    <td class="ins-num">${fmtPfMoney(r.value)}</td>
    <td class="ins-num">${totalValue > 0 ? (r.value / totalValue * 100).toFixed(1) : "0"}%</td>
    <td class="ins-num ${cls(r.pl)}">${fmtPct(r.plPct)}</td>
    <td class="ins-num"><button type="button" class="pf-del" data-ticker="${escapeHtml(r.ticker)}" title="삭제">✕</button></td>
  </tr>`).join("");
  tableEl.innerHTML = `<table class="insider-table table-wide"><thead><tr><th>종목</th><th class="ins-num">수량</th><th class="ins-num">평단</th><th class="ins-num">현재가</th><th class="ins-num">평가액</th><th class="ins-num">비중</th><th class="ins-num">손익</th><th></th></tr></thead><tbody>${body}</tbody></table>${missing ? `<p class="muted font-small">현재 스냅샷에 없는 ${missing}개 종목은 합계에서 제외했습니다.</p>` : ""}`;
  tableEl.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
  tableEl.querySelectorAll(".pf-del").forEach((b) => b.addEventListener("click", () => {
    portfolio = portfolio.filter((p) => p.ticker !== b.dataset.ticker); savePortfolio(); renderPortfolio();
  }));

  // 섹터/종목 비중 도넛
  if (pieEl) {
    let slices;
    if (portfolioDonutMode === "stock") {
      slices = rows.map((row) => ({ label: row.ticker, ticker: row.ticker, value: row.value })).sort((a, b) => b.value - a.value);
    } else {
      const bySector = {};
      rows.forEach((row) => { bySector[row.sector] = (bySector[row.sector] || 0) + row.value; });
      slices = Object.entries(bySector).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    }
    const legend = slices.map((slice, index) => {
      const content = `<i style="background:${PIE_COLORS[index % PIE_COLORS.length]}"></i><span>${escapeHtml(slice.label)}</span><b>${totalValue > 0 ? (slice.value / totalValue * 100).toFixed(0) : "0"}%</b>`;
      return slice.ticker ? `<button type="button" class="pf-leg pf-leg-button" data-pie-ticker="${escapeHtml(slice.ticker)}">${content}</button>` : `<div class="pf-leg">${content}</div>`;
    }).join("");
    pieEl.innerHTML = `
      <div class="pf-pie-head">
        <div class="pf-pie-title">${portfolioDonutMode === "stock" ? "종목 비중" : "섹터 분산"}</div>
        <div class="pf-pie-switch" role="group" aria-label="포트폴리오 비중 표시 기준">
          <button type="button" data-pie-mode="sector" class="${portfolioDonutMode === "sector" ? "is-active" : ""}">섹터</button>
          <button type="button" data-pie-mode="stock" class="${portfolioDonutMode === "stock" ? "is-active" : ""}">종목</button>
        </div>
      </div>
      ${donutSvg(slices)}<div class="pf-legend">${legend}</div>`;
    pieEl.querySelectorAll("[data-pie-mode]").forEach((button) => button.addEventListener("click", () => {
      portfolioDonutMode = button.dataset.pieMode === "stock" ? "stock" : "sector";
      window.safeStorage.set(PORTFOLIO_DONUT_MODE_KEY, portfolioDonutMode);
      renderPortfolio();
    }));
    pieEl.querySelectorAll("[data-pie-ticker]").forEach((button) => button.addEventListener("click", () => selectTicker(button.dataset.pieTicker, { openSearch: true })));
  }
  renderDividendPlanner();
  renderRebalanceCalculator();
  renderStressTest();
  renderPositionSizeCalculator(false);
  renderKrwPortfolio();
  renderBenchmarkAttribution();
  renderInvestmentJournal();
  renderPortfolioXray();
}

// 포트폴리오 X-ray — 보유 비중 가중 팩터 노출(밸류·모멘텀·퀄리티·성장·규모 시장 백분위)
// + 집중도(HHI·상위3비중·유효종목수). 섹터 분산은 도넛, 배당 인컴은 배당 캘린더가 커버.
function renderPortfolioXray() {
  const host = byId("pfXrayBody");
  const card = byId("pfXrayCard");
  if (!host) return;
  const rows = portfolioDetailRows().filter((r) => r.value > 0);
  if (rows.length < 2) {
    if (card) card.style.display = "none";
    host.innerHTML = "";
    return;
  }
  if (card) card.style.display = "";
  const total = rows.reduce((s, r) => s + r.value, 0);
  // 가중 팩터 노출: Σ(비중 × 종목 팩터 백분위) / Σ비중(백분위 있는 것만)
  const axes = [["밸류", "value"], ["모멘텀", "momentum"], ["퀄리티", "quality"], ["성장", "growth"], ["규모", "size"]];
  const acc = {}; const wsum = {};
  for (const [, k] of axes) { acc[k] = 0; wsum[k] = 0; }
  for (const r of rows) {
    const f = (typeof factorPercentiles === "function") ? factorPercentiles({ ticker: r.ticker }) : null;
    if (!f) continue;
    for (const [, k] of axes) {
      if (Number.isFinite(f[k])) { acc[k] += r.value * f[k]; wsum[k] += r.value; }
    }
  }
  const bar = (name, v) => {
    const col = v == null ? "var(--muted)" : v >= 70 ? "#30a46c" : v >= 40 ? "#5b8def" : "#d98a2b";
    return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:44px;font-size:12px;color:var(--muted)">${name}</span>
      <div style="flex:1;height:7px;border-radius:4px;background:var(--panel-soft);overflow:hidden"><div style="width:${v == null ? 0 : v}%;height:100%;background:${col}"></div></div>
      <span style="width:34px;text-align:right;font-size:12px;font-weight:600">${v == null ? "—" : v}</span>
    </div>`;
  };
  const factorBars = axes.map(([label, k]) => bar(label, wsum[k] > 0 ? Math.round(acc[k] / wsum[k]) : null)).join("");
  // 집중도: HHI(비중 제곱합), 상위3 비중, 유효 종목수(1/HHI)
  const weights = rows.map((r) => r.value / total).sort((a, b) => b - a);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const top3 = weights.slice(0, 3).reduce((s, w) => s + w, 0) * 100;
  const effN = hhi > 0 ? 1 / hhi : 0;
  const concGrid = aiMetricGrid([
    { label: "HHI 집중도", value: hhi.toFixed(3), tone: hhi > 0.25 ? "warn" : "", detail: hhi > 0.25 ? "높음" : hhi > 0.15 ? "보통" : "분산" },
    { label: "상위 3종목 비중", value: `${top3.toFixed(0)}%`, tone: top3 > 60 ? "warn" : "" },
    { label: "유효 종목수", value: effN.toFixed(1), detail: `보유 ${rows.length}종목` },
  ]);
  host.innerHTML = `<div style="font-size:12px;color:var(--muted);margin:2px 0 4px">팩터 노출 (비중 가중 백분위)</div>${factorBars}
    <div style="font-size:12px;color:var(--muted);margin:14px 0 6px">집중도</div>${concGrid}`;
}

function renderBulk() {
  renderPortfolio();
  renderCorrelationMatrix();
  const minRs = Number(byId("bulkRs").value || 0);
  const input = byId("bulkInput");
  if (input && !input.value.trim()) input.value = watchlist.join(", ");
  const tickers = resolveTickerListInput(input.value);
  const rows = tickers
    .map((ticker) => stockByTicker(ticker))
    .filter(Boolean)
    // RSI 필터: 값이 없는(합성 이력) 종목은 임계 0 일 때만 통과.
    .filter((item) => { const r = rsiValue(item); return r == null ? minRs <= 0 : r >= minRs; });
  renderWatchlistStats(rows);
  byId("bulkTable").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${watchStarButton(item.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(item.ticker)}</button></td>
      <td>${escapeHtml(item.company)}</td>
      <td>${escapeHtml(item.sector)}</td>
      <td class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</td>
      <td>${fmtRsi(item)}</td>
      <td>${fmtEps(item)}</td>
      <td>${Number(item.volumeRatio || 0).toFixed(1)}x</td>
      <td>${signalFor(item)}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="muted">관심종목을 추가하거나 티커를 입력하세요.</td></tr>`;
  byId("bulkTable").querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function signalFor(item) {
  // 점수 대신 실측 신호(3개월·1개월 모멘텀 + RSI)로 판정. RSI 없는(합성) 종목은
  // 모멘텀만 본다.
  const rsi = rsiValue(item);
  const m3 = Number(item.threeMonthChangePct);
  const m1 = Number(item.monthChangePct);
  const day = Number(item.changePct);
  if (m3 > 15 && m1 > 0 && day > 0 && (rsi == null || rsi <= 80)) return "강한 상승 후보";
  if (m1 > 0 && day > 0) return "상승 추세";
  if (rsi != null && rsi <= 30) return "과매도 관찰";
  return "중립";
}

// ----- 원본 app.js 13954-14666 -----

// ===== 포트폴리오 시뮬레이터 (buy-and-hold) =====
const BACKTEST_MAX_TICKERS = 10;
let backtestTickers = [];
// 벤치마크 옵션은 시장별(market_config backtestBenchmarks). KR 에서 SPY 를 기본으로 두면
// korea/details/SPY.json 404 였다.
function backtestBenchmarkOptions() {
  return marketCfg().backtestBenchmarks || [];
}
let backtestRunning = false;
let backtestDatesProgrammatic = false;

function backtestTickersFromInput() {
  return backtestTickers.slice(0, BACKTEST_MAX_TICKERS);
}

function renderBacktestTickerChips() {
  const box = byId("backtestTickerList");
  if (!box) return;
  box.innerHTML = backtestTickers.length
    ? backtestTickers.map((ticker) => {
      const stock = stockByTicker(ticker);
      const label = stock?.company ? `${ticker} · ${stock.company}` : ticker;
      return `<button type="button" class="compare-chip" data-ticker="${escapeHtml(ticker)}" title="${escapeHtml(label)}">${escapeHtml(ticker)} <span>x</span></button>`;
    }).join("")
    : `<span class="muted">종목을 하나씩 추가하세요. (최대 ${BACKTEST_MAX_TICKERS}개)</span>`;
  box.querySelectorAll(".compare-chip").forEach((chip) => {
    chip.addEventListener("click", () => removeBacktestTicker(chip.dataset.ticker));
  });
  const weightsInput = byId("backtestWeights");
  if (weightsInput && byId("backtestWeightMode")?.value === "custom" && backtestTickers.length) {
    const each = Math.round(100 / backtestTickers.length);
    const parts = backtestTickers.map((_, i) => (i === backtestTickers.length - 1
      ? 100 - each * (backtestTickers.length - 1)
      : each));
    weightsInput.placeholder = parts.join(",");
  }
}

function addBacktestTicker(raw) {
  const resolved = resolveTickerListInput(String(raw || "").trim());
  const ticker = resolved[0];
  if (!ticker) {
    setBacktestStatus("유효한 티커를 입력하세요.");
    return false;
  }
  if (backtestTickers.includes(ticker)) {
    setBacktestStatus(`${ticker}는 이미 추가되어 있습니다.`);
    return false;
  }
  if (backtestTickers.length >= BACKTEST_MAX_TICKERS) {
    setBacktestStatus(`최대 ${BACKTEST_MAX_TICKERS}개까지 추가할 수 있습니다.`);
    return false;
  }
  backtestTickers.push(ticker);
  renderBacktestTickerChips();
  setBacktestStatus("");
  return true;
}

function removeBacktestTicker(ticker) {
  backtestTickers = backtestTickers.filter((item) => item !== ticker);
  renderBacktestTickerChips();
}

function setBacktestTickers(list) {
  backtestTickers = [...new Set((list || []).map((t) => String(t).toUpperCase()).filter((t) => stockByTicker(t)))].slice(0, BACKTEST_MAX_TICKERS);
  renderBacktestTickerChips();
}

function setBacktestStatus(text) {
  const el = byId("backtestStatus");
  if (el) el.textContent = text || "";
}

function closeSeriesToDateMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.d && Number.isFinite(row.c)) map.set(row.d, row.c);
  });
  return map;
}

function backtestSnapshotIsoDate() {
  const raw = (data && (data.updatedAtKst || data.updated_at_kst)) || "";
  const match = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function backtestPeriodMode() {
  const value = byId("backtestPeriod")?.value || "756";
  return value === "custom" ? "custom" : "preset";
}

function backtestPeriodBars() {
  const value = byId("backtestPeriod")?.value || "756";
  if (value === "custom") return null;
  return Number(value) || 756;
}

function backtestCustomStartDate() {
  if (backtestPeriodMode() !== "custom") return null;
  const raw = byId("backtestStartDate")?.value || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function backtestCustomEndDate() {
  if (backtestPeriodMode() !== "custom") return null;
  const raw = byId("backtestEndDate")?.value || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function backtestInvestmentAmount() {
  const value = Number(byId("backtestInvestment")?.value);
  return Number.isFinite(value) && value > 0 ? value : (marketCfg().backtestDefaultInvestment || 10000);
}

function backtestDefaultBenchmark() {
  const cfg = marketCfg();
  const cands = [...backtestBenchmarkOptions().map(([t]) => t), ...(cfg.etfBenchmarks || [])];
  return cands.find((t) => stockByTicker(t)) || cands[0] || "SPY";
}

function backtestBenchmarkTicker() {
  const sel = byId("backtestBenchmark");
  const value = String(sel?.value || "").toUpperCase();
  return value && stockByTicker(value) ? value : backtestDefaultBenchmark();
}

function backtestBenchmarkLabel(ticker) {
  const found = backtestBenchmarkOptions().find(([t]) => t === ticker);
  if (found) return found[1];
  const stock = stockByTicker(ticker);
  return stock?.company ? `${ticker} · ${stock.company}` : ticker;
}

// 백테스트 금액은 시장 통화로(정수). 예전엔 KR 에서도 USD 로 찍혔다.
function fmtBacktestMoney(value) {
  if (!Number.isFinite(value)) return "—";
  return marketCfg().formatMoneyWhole(value);
}

function backtestWeightsForTickers(tickers) {
  const mode = byId("backtestWeightMode")?.value || "equal";
  if (mode !== "custom") {
    const each = 100 / tickers.length;
    return { weights: tickers.map(() => each) };
  }
  const raw = byId("backtestWeights")?.value || "";
  const parts = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length !== tickers.length) return { error: `비중은 티커 ${tickers.length}개와 같은 개수로 입력하세요.` };
  const sum = parts.reduce((acc, n) => acc + n, 0);
  if (sum <= 0) return { error: "비중 합계가 0보다 커야 합니다." };
  return { weights: parts.map((n) => (n / sum) * 100) };
}

function backtestCommonDateList(seriesList) {
  if (!seriesList.length) return [];
  const dated = seriesList.filter((s) => s.rows.some((r) => r.d));
  if (!dated.length) return [];
  const ref = dated.reduce((a, b) => (a.rows.length <= b.rows.length ? a : b));
  const refDates = ref.rows.map((r) => r.d).filter(Boolean);
  return refDates.filter((d) => dated.every((s) => s.dateMap.has(d)));
}

function backtestResolveDates(seriesList, periodBars, customStart, customEnd) {
  const allDates = backtestCommonDateList(seriesList);
  if (!allDates.length) return { dates: [], error: "공통 거래일을 찾지 못했습니다." };
  const latest = allDates[allDates.length - 1];
  let endDate = latest;
  if (customEnd) {
    const capped = allDates.filter((d) => d <= customEnd);
    if (!capped.length) {
      return { dates: [], error: `종료일(${customEnd})이 모든 종목 데이터보다 이릅니다.` };
    }
    endDate = capped[capped.length - 1];
  }
  let dates;
  if (customStart) {
    const first = allDates.find((d) => d >= customStart);
    if (!first) {
      return { dates: [], error: `시작일(${customStart})이 모든 종목 데이터보다 늦습니다. 더 이른 날짜를 선택하세요.` };
    }
    if (first > endDate) {
      return { dates: [], error: "시작일이 종료일보다 늦습니다." };
    }
    dates = allDates.filter((d) => d >= first && d <= endDate);
  } else {
    const endIdx = allDates.indexOf(endDate);
    const startIdx = Math.max(0, endIdx - periodBars + 1);
    dates = allDates.slice(startIdx, endIdx + 1);
  }
  if (dates.length < 22) {
    return { dates: [], error: `공통 거래일이 부족합니다 (${dates.length}일). 기간을 줄이거나 종목을 바꿔 보세요.` };
  }
  return { dates, startDate: dates[0], endDate: dates[dates.length - 1] };
}

// 유효(양수·유한) 종가인지. 0·null·NaN 은 결측으로 본다.
function backtestValidPrice(p) {
  return Number.isFinite(p) && p > 0;
}

// dates 순서대로 종가를 뽑되 결측일은 직전 유효 종가로 채운다(forward-fill).
// 첫 유효가가 나오기 전까지는 null — 시작일에 가격이 없는 종목은 호출부가 제외한다.
// 예전엔 dateMap.get(d) 가 undefined 인 날 하나만 있어도 NaN 이 전체 누적값을 오염시켜
// 차트가 백지가 되고 수익률이 NaN% 로 찍혔다(한·미 휴장일 불일치, 거래정지, 신규상장).
function backtestFilledPrices(series, dates) {
  let last = null;
  let filled = 0;
  const prices = dates.map((d) => {
    const p = series.dateMap.get(d);
    if (backtestValidPrice(p)) last = p;
    else if (last != null) filled += 1;
    return last;
  });
  prices.filledCount = filled;
  return prices;
}

function backtestPortfolioSeries(seriesList, dates, weights) {
  const filled = seriesList.map((s) => backtestFilledPrices(s, dates));
  // 시작일에 유효가가 없는 종목은 units=0 (기여 없음). 호출부가 미리 걸러 알린다.
  const units = filled.map((prices, i) => {
    const p0 = prices[0];
    return backtestValidPrice(p0) ? (weights[i] / 100) / p0 : 0;
  });
  return dates.map((d, k) => {
    let value = 0;
    filled.forEach((prices, i) => {
      if (!units[i]) return;
      const p = prices[k];
      if (backtestValidPrice(p)) value += units[i] * p;
    });
    return { d, v: value };
  });
}

function backtestIndexedSeries(dateMap, dates) {
  const filled = backtestFilledPrices({ dateMap }, dates);
  const start = filled[0];
  if (!backtestValidPrice(start)) return [];
  return dates.map((d, k) => ({ d, v: (filled[k] / start) * 100 }));
}

function backtestAnnualizedPct(startVal, endVal, tradingDays) {
  if (!Number.isFinite(startVal) || !Number.isFinite(endVal) || startVal <= 0 || tradingDays < 2) return null;
  const years = tradingDays / 252;
  if (years <= 0) return null;
  return (Math.pow(endVal / startVal, 1 / years) - 1) * 100;
}

function drawBacktestChart(portfolioSeries, benchmarkSeries, startDate, endDate, benchmarkTicker) {
  const svg = byId("backtestChart");
  if (!svg || !portfolioSeries.length) return;
  const width = 800;
  const height = 260;
  const padL = 52;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const allVals = portfolioSeries.map((p) => p.v);
  if (benchmarkSeries.length) benchmarkSeries.forEach((p) => allVals.push(p.v));
  const minV = Math.min(...allVals) * 0.98;
  const maxV = Math.max(...allVals) * 1.02;
  const span = maxV - minV || 1;
  const xFor = (i) => padL + (i / Math.max(1, portfolioSeries.length - 1)) * plotW;
  const yFor = (v) => padT + plotH - ((v - minV) / span) * plotH;
  const baseY = yFor(100);
  const portPath = pathFromSeries(portfolioSeries.map((p) => p.v), xFor, yFor, "#2563eb", 2.2, "");
  const benchPath = benchmarkSeries.length
    ? pathFromSeries(benchmarkSeries.map((p) => p.v), xFor, yFor, "#94a3b8", 1.8, "6 4")
    : "";
  const y100 = yFor(100);
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => minV + (span * i) / tickCount);
  const xLabels = [
    { i: 0, label: startDate },
    { i: portfolioSeries.length - 1, label: endDate },
  ];
  if (portfolioSeries.length > 2) {
    const mid = Math.floor((portfolioSeries.length - 1) / 2);
    xLabels.splice(1, 0, { i: mid, label: portfolioSeries[mid].d });
  }
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
    ${yTicks.map((v) => `<line x1="${padL}" y1="${yFor(v).toFixed(1)}" x2="${width - padR}" y2="${yFor(v).toFixed(1)}" class="chart-grid"></line>`).join("")}
    <line x1="${padL}" y1="${y100.toFixed(1)}" x2="${width - padR}" y2="${y100.toFixed(1)}" class="rsi-guide"></line>
    ${portPath}
    ${benchPath}
    ${yTicks.map((v) => `<text x="${padL - 6}" y="${yFor(v) + 4}" text-anchor="end" class="chart-axis">${Math.round(v)}</text>`).join("")}
    ${xLabels.map(({ i, label }) => `<text x="${xFor(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis">${escapeHtml(String(label || "").slice(2))}</text>`).join("")}
    <text x="${padL + 4}" y="${padT + 12}" class="chart-axis">포트폴리오</text>
    <text x="${padL + 84}" y="${padT + 12}" class="chart-axis" fill="#94a3b8">${escapeHtml(benchmarkTicker)}</text>
    <text x="${padL - 6}" y="${baseY + 4}" text-anchor="end" class="chart-axis">100</text>
  `;
}

function renderBacktestResults(payload) {
  const box = byId("backtestResults");
  const summary = byId("backtestSummary");
  const table = byId("backtestTable");
  if (!box || !summary || !table) return;
  const {
    tickers,
    startDate,
    endDate,
    tradingDays,
    totalReturn,
    annReturn,
    benchmarkReturn,
    alpha,
    stockReturns,
    warnings,
    portfolioSeries,
    benchmarkSeries,
    investment,
    finalValue,
    profit,
    benchmarkTicker,
    benchmarkLabel,
    periodLabel,
    weightLabel,
  } = payload;
  summary.innerHTML = `
    <article class="backtest-metric"><span>포트폴리오 수익률</span><strong class="${cls(totalReturn)}">${fmtPct(totalReturn)}</strong></article>
    <article class="backtest-metric"><span>연환산</span><strong class="${cls(annReturn)}">${annReturn == null ? "—" : fmtPct(annReturn)}</strong></article>
    <article class="backtest-metric"><span>투자금</span><strong class="is-money">${fmtBacktestMoney(investment)}</strong></article>
    <article class="backtest-metric"><span>최종 평가액</span><strong class="is-money ${cls(totalReturn)}">${fmtBacktestMoney(finalValue)}</strong></article>
    <article class="backtest-metric"><span>${escapeHtml(benchmarkTicker)} (${escapeHtml(benchmarkLabel)})</span><strong class="${cls(benchmarkReturn)}">${benchmarkReturn == null ? "—" : fmtPct(benchmarkReturn)}</strong></article>
    <article class="backtest-metric"><span>초과 수익 (α)</span><strong class="${cls(alpha)}">${alpha == null ? "—" : fmtPct(alpha)}</strong></article>
    <article class="backtest-metric"><span>수익금</span><strong class="is-money ${cls(profit)}">${profit >= 0 ? "+" : ""}${fmtBacktestMoney(profit)}</strong></article>
  `;
  const warnHtml = warnings.length
    ? `<p class="backtest-warn">${warnings.map((w) => escapeHtml(w)).join(" ")}</p>`
    : "";
  const disclaimerHtml = `<p class="backtest-disclaimer muted"><strong>면책:</strong> 본 백테스트는 현재 스냅샷에 포함된 종목만 사용합니다. 기간 중 상장폐지·합병된 종목은 제외되어 <strong>생존 편향(survivorship bias)</strong>으로 실제 수익률보다 높게 나올 수 있습니다. 거래비용·세금·슬리피지는 반영되지 않은 총수익(buy-and-hold) 기준입니다.</p>`;
  renderPortfolioRiskPanel({
    stockReturns,
    portfolioSeries,
    benchmarkSeries,
    benchmarkTicker,
    weights: stockReturns.map((row) => row.weightPct / 100)
  });
  table.innerHTML = `
    <caption class="backtest-meta">${escapeHtml(tickers.join(", "))} · ${escapeHtml(periodLabel)} · ${escapeHtml(startDate)} → ${escapeHtml(endDate)} (${tradingDays}거래일) · ${escapeHtml(weightLabel)} · buy-and-hold</caption>
    ${warnHtml}
    ${disclaimerHtml}
    <thead><tr><th>티커</th><th>회사</th><th>시작가</th><th>종가</th><th>수익률</th><th>비중</th><th>투자액</th><th>평가액</th></tr></thead>
    <tbody>
      ${stockReturns.map((row) => `
        <tr>
          <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
          <td>${escapeHtml(row.company)}</td>
          <td>${priceOrDash(row.startPrice)}</td>
          <td>${priceOrDash(row.endPrice)}</td>
          <td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td>
          <td>${row.weightPct.toFixed(1)}%</td>
          <td>${fmtBacktestMoney(row.invested)}</td>
          <td class="${cls(row.returnPct)}">${fmtBacktestMoney(row.finalValue)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  table.querySelectorAll(".ticker-link").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
  drawBacktestChart(portfolioSeries, benchmarkSeries, startDate, endDate, benchmarkTicker);
  lastBacktestExportPayload = payload;
  box.hidden = false;
  setBacktestStatus("");
}

function percentReturnSeries(series) {
  if (!Array.isArray(series) || series.length < 2) return [];
  const out = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = Number(series[i - 1]?.v);
    const now = Number(series[i]?.v);
    if (Number.isFinite(prev) && Number.isFinite(now) && prev) out.push((now / prev) - 1);
  }
  return out;
}

function annualizedVolPct(series) {
  const returns = percentReturnSeries(series);
  if (returns.length < 3) return null;
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function maxDrawdownPct(series) {
  if (!Array.isArray(series) || !series.length) return null;
  let peak = Number(series[0].v);
  let maxDd = 0;
  series.forEach((point) => {
    const value = Number(point.v);
    if (!Number.isFinite(value)) return;
    peak = Math.max(peak, value);
    if (peak) maxDd = Math.min(maxDd, (value / peak - 1) * 100);
  });
  return maxDd;
}

function betaAndCorrelation(portfolioSeries, benchmarkSeries) {
  const p = percentReturnSeries(portfolioSeries);
  const b = percentReturnSeries(benchmarkSeries);
  const n = Math.min(p.length, b.length);
  if (n < 5) return { beta: null, corr: null };
  const pr = p.slice(-n);
  const br = b.slice(-n);
  const avgP = pr.reduce((s, v) => s + v, 0) / n;
  const avgB = br.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varB = 0;
  let varP = 0;
  for (let i = 0; i < n; i += 1) {
    const dp = pr[i] - avgP;
    const db = br[i] - avgB;
    cov += dp * db;
    varB += db * db;
    varP += dp * dp;
  }
  const beta = varB ? cov / varB : null;
  const corr = varB && varP ? cov / Math.sqrt(varB * varP) : null;
  return { beta, corr };
}

function sectorConcentration(stockReturns) {
  const sectors = {};
  stockReturns.forEach((row) => {
    const sector = stockByTicker(row.ticker)?.sector || "Unknown";
    sectors[sector] = (sectors[sector] || 0) + Number(row.weightPct || 0);
  });
  return Object.entries(sectors).sort((a, b) => b[1] - a[1]);
}

function renderPortfolioRiskPanel(payload) {
  const box = byId("portfolioRiskPanel");
  if (!box) return;
  const { stockReturns, portfolioSeries, benchmarkSeries, benchmarkTicker } = payload;
  const maxDd = maxDrawdownPct(portfolioSeries);
  const vol = annualizedVolPct(portfolioSeries);
  const bench = betaAndCorrelation(portfolioSeries, benchmarkSeries);
  const sectors = sectorConcentration(stockReturns);
  const topSector = sectors[0];
  const topPosition = stockReturns.slice().sort((a, b) => b.weightPct - a.weightPct)[0];
  const warnings = [];
  if (topSector && topSector[1] >= 50) warnings.push(`섹터 쏠림: ${topSector[0]} 비중 ${topSector[1].toFixed(0)}% (점검 기준 50% 이상).`);
  if (topPosition && topPosition.weightPct >= 35) warnings.push(`단일 종목 쏠림: ${topPosition.ticker} 비중 ${topPosition.weightPct.toFixed(0)}% (점검 기준 35% 이상).`);
  if (maxDd != null && maxDd <= -30) warnings.push(`하락 위험: 과거 구간 최대낙폭 ${fmtPct(maxDd)} (점검 기준 -30% 이하).`);
  box.innerHTML = `
    <div class="risk-head">
      <div>
        <h3>포트폴리오 위험 분석</h3>
        <p class="muted">수익률뿐 아니라 하락폭, 변동성, 섹터 쏠림을 같이 봅니다.</p>
      </div>
      <span class="quality-badge ${warnings.length ? "quality-warn" : "quality-good"}">${warnings.length ? "점검 필요" : "균형 양호"}</span>
    </div>
    <div class="risk-grid">
      <article><span>최대 낙폭</span><strong class="${cls(maxDd)}">${maxDd == null ? "-" : fmtPct(maxDd)}</strong></article>
      <article><span>연환산 변동성</span><strong>${vol == null ? "-" : fmtPct(vol)}</strong></article>
      <article><span>${escapeHtml(benchmarkTicker)} 베타</span><strong>${bench.beta == null ? "-" : bench.beta.toFixed(2)}</strong></article>
      <article><span>상관계수</span><strong>${bench.corr == null ? "-" : bench.corr.toFixed(2)}</strong></article>
      <article><span>최대 섹터</span><strong>${topSector ? escapeHtml(topSector[0]) : "-"}</strong><em>${topSector ? `${topSector[1].toFixed(1)}%` : ""}</em></article>
      <article><span>최대 종목</span><strong>${topPosition ? escapeHtml(topPosition.ticker) : "-"}</strong><em>${topPosition ? `${topPosition.weightPct.toFixed(1)}%` : ""}</em></article>
    </div>
    ${warnings.length ? `<p class="risk-warn">${warnings.map((w) => escapeHtml(w)).join(" ")}</p>` : `<p class="risk-note">점검 기준: 섹터 50% 이상, 단일 종목 35% 이상, 최대낙폭 -30% 이하. 리밸런싱, 배당, 세금, 거래비용은 반영하지 않습니다.</p>`}
  `;
}

async function runPortfolioBacktest() {
  if (backtestRunning) return;
  const tickers = backtestTickersFromInput();
  const periodMode = backtestPeriodMode();
  const periodBars = backtestPeriodBars();
  const customStart = backtestCustomStartDate();
  const customEnd = backtestCustomEndDate();
  if (tickers.length < 2) {
    setBacktestStatus("2개 이상의 종목을 추가하세요.");
    byId("backtestResults").hidden = true;
    return;
  }
  if (periodMode === "custom") {
    if (!customStart || !customEnd) {
      setBacktestStatus("시작일과 종료일을 모두 선택하세요.");
      byId("backtestResults").hidden = true;
      return;
    }
    if (customStart > customEnd) {
      setBacktestStatus("시작일이 종료일보다 늦을 수 없습니다.");
      byId("backtestResults").hidden = true;
      return;
    }
  }
  const weightResult = backtestWeightsForTickers(tickers);
  if (weightResult.error) {
    setBacktestStatus(weightResult.error);
    byId("backtestResults").hidden = true;
    return;
  }
  const weights = weightResult.weights;
  const investment = backtestInvestmentAmount();
  const benchmarkTicker = backtestBenchmarkTicker();
  const benchmarkLabel = backtestBenchmarkLabel(benchmarkTicker);
  backtestRunning = true;
  setBacktestStatus("가격 이력을 불러오는 중…");
  byId("backtestResults").hidden = true;
  try {
    const loaded = await Promise.all(tickers.map(async (ticker) => {
      const stock = stockByTicker(ticker);
      const detail = await loadStockDetail(ticker);
      const merged = detail ? { ...stock, ...detail } : stock;
      const rows = getChartRows(merged);
      return {
        ticker,
        company: stock?.company || ticker,
        rows,
        dateMap: closeSeriesToDateMap(rows),
        synthetic: isSyntheticChart(merged),
      };
    }));
    const warnings = [];
    const invalid = loaded.filter((s) => s.synthetic || s.dateMap.size < 30);
    invalid.forEach((s) => {
      warnings.push(`${s.ticker}: 실제 일봉 이력 없음 — 제외됨.`);
    });
    let valid = loaded.filter((s) => !s.synthetic && s.dateMap.size >= 30);
    if (valid.length < 2) {
      setBacktestStatus("실제 가격 이력이 있는 종목이 2개 이상 필요합니다. (상위 ~1,400종목 지원)");
      return;
    }
    const weightByTicker = new Map(tickers.map((ticker, index) => [ticker, weights[index]]));
    // 유효 종목 집합이 바뀔 때마다(이력 없음 → 시작일 결측) 비중을 다시 정규화한다.
    const normalizeActiveWeights = () => {
      const raw = valid.map((s) => weightByTicker.get(s.ticker) || 0);
      const sum = raw.reduce((acc, w) => acc + w, 0);
      return sum > 0 ? raw.map((w) => (w / sum) * 100) : null;
    };
    let activeWeights = normalizeActiveWeights();
    if (!activeWeights) {
      setBacktestStatus("유효 종목에 적용할 비중이 없습니다.");
      return;
    }
    let dateResult = backtestResolveDates(valid, periodBars, customStart, customEnd);
    if (!dateResult.dates.length && periodMode === "preset" && periodBars) {
      dateResult = backtestResolveDates(
        valid,
        Math.min(periodBars, valid.reduce((m, s) => Math.min(m, s.dateMap.size), Infinity)),
        null,
        null,
      );
    }
    if (!dateResult.dates.length) {
      setBacktestStatus(dateResult.error || "시뮬레이션 기간을 계산하지 못했습니다.");
      return;
    }
    const { dates, startDate, endDate } = dateResult;
    if (periodMode === "preset" && periodBars && dates.length < periodBars * 0.6) {
      warnings.push(`선택 종목 중 가격 이력이 짧은 종목이 있어 공통으로 겹치는 ${dates.length}거래일만 시뮬레이션했습니다.`);
    }
    // 시작일에 유효 종가가 없는 종목(거래정지·상장 전·0원)은 단위수를 못 구하므로 제외하고 알린다.
    // 중간 결측일은 직전 종가로 채운다(backtestFilledPrices) — NaN 을 만들지 않는다.
    const noStart = valid.filter((s) => !backtestValidPrice(s.dateMap.get(startDate)));
    if (noStart.length) {
      noStart.forEach((s) => warnings.push(`${s.ticker}: 시작일(${startDate})에 유효한 종가가 없어 제외됨.`));
      valid = valid.filter((s) => !noStart.includes(s));
      activeWeights = valid.length ? normalizeActiveWeights() : null;
      if (valid.length < 1 || !activeWeights) {
        setBacktestStatus(`시작일(${startDate})에 가격이 있는 종목이 없습니다. 시작일을 바꿔 보세요.`);
        return;
      }
    }
    valid.forEach((s) => {
      const filledCount = backtestFilledPrices(s, dates).filledCount;
      if (filledCount > 0) warnings.push(`${s.ticker}: 결측 ${filledCount}거래일은 직전 종가로 보간했습니다.`);
    });
    const portfolioRaw = backtestPortfolioSeries(valid, dates, activeWeights);
    if (!backtestValidPrice(portfolioRaw[0]?.v)) {
      setBacktestStatus("시작일 포트폴리오 가치를 계산하지 못했습니다. 종목·기간을 바꿔 보세요.");
      return;
    }
    const portfolioSeries = portfolioRaw.map((p) => ({ d: p.d, v: (p.v / portfolioRaw[0].v) * 100 }));
    const benchStock = stockByTicker(benchmarkTicker);
    const benchDetail = await loadStockDetail(benchmarkTicker);
    const benchMerged = benchDetail ? { ...benchStock, ...benchDetail } : benchStock;
    const benchRows = getChartRows(benchMerged);
    const benchMap = closeSeriesToDateMap(benchRows);
    const benchmarkSeries = benchMap.has(startDate) ? backtestIndexedSeries(benchMap, dates) : [];
    if (!benchmarkSeries.length) warnings.push(`${benchmarkTicker} 벤치마크 데이터가 시작일에 없어 비교를 생략했습니다.`);
    const portStart = portfolioSeries[0].v;
    const portEnd = portfolioSeries[portfolioSeries.length - 1].v;
    const totalReturn = (portEnd / portStart - 1) * 100;
    const annReturn = backtestAnnualizedPct(portStart, portEnd, dates.length);
    const finalValue = investment * (portEnd / portStart);
    const profit = finalValue - investment;
    let benchmarkReturn = null;
    let alpha = null;
    if (benchmarkSeries.length) {
      benchmarkReturn = benchmarkSeries[benchmarkSeries.length - 1].v - 100;
      alpha = totalReturn - benchmarkReturn;
    }
    const stockReturns = valid.map((s, i) => {
      const filledPrices = backtestFilledPrices(s, dates);
      const startPrice = filledPrices[0];
      const endPrice = filledPrices[filledPrices.length - 1];
      const returnPct = (endPrice / startPrice - 1) * 100;
      const weightPct = activeWeights[i];
      const invested = investment * (weightPct / 100);
      const finalStockValue = invested * (endPrice / startPrice);
      return { ticker: s.ticker, company: s.company, startPrice, endPrice, returnPct, weightPct, invested, finalValue: finalStockValue };
    }).sort((a, b) => b.returnPct - a.returnPct);
    const periodLabel = periodMode === "custom"
      ? `${startDate} → ${endDate}`
      : (byId("backtestPeriod")?.selectedOptions?.[0]?.textContent || "");
    const weightLabel = byId("backtestWeightMode")?.value === "custom" ? "직접 비중" : "동일 비중";
    renderBacktestResults({
      tickers: valid.map((s) => s.ticker),
      startDate,
      endDate,
      tradingDays: dates.length,
      totalReturn,
      annReturn,
      benchmarkReturn,
      alpha,
      stockReturns,
      warnings,
      portfolioSeries,
      benchmarkSeries,
      investment,
      finalValue,
      profit,
      benchmarkTicker,
      benchmarkLabel,
      periodLabel,
      weightLabel,
    });
  } catch (err) {
    console.warn("backtest failed", err);
    setBacktestStatus("시뮬레이션 중 오류가 발생했습니다.");
  } finally {
    backtestRunning = false;
  }
}

function populateBacktestBenchmarks() {
  const sel = byId("backtestBenchmark");
  if (!sel) return;
  const cfg = marketCfg();
  const fromHealth = data.health?.etfRelative?.benchmarks || [];
  const merged = [...new Set([...backtestBenchmarkOptions().map(([t]) => t), ...fromHealth])]
    .filter((t) => stockByTicker(t));
  sel.innerHTML = merged.map((ticker) => {
    const label = backtestBenchmarkLabel(ticker);
    return `<option value="${escapeHtml(ticker)}">${escapeHtml(ticker)} · ${escapeHtml(label)}</option>`;
  }).join("");
  if (!sel.value) sel.value = backtestDefaultBenchmark();
  // 투자금 입력(정적 HTML 기본 10000)은 시장 전환 시 통화 기본값으로 바꾼다 — 사용자가
  // 직접 넣은 값(다른 시장 기본값과 다름)은 건드리지 않는다.
  const inv = byId("backtestInvestment");
  if (inv && inv.dataset.market !== cfg.id) {
    const otherDefault = (cfg.id === "kr" ? window.MirMarket?.US : window.MirMarket?.KR)?.backtestDefaultInvestment;
    if (!inv.value || Number(inv.value) === Number(otherDefault) || Number(inv.value) === 10000) inv.value = String(cfg.backtestDefaultInvestment || 10000);
    inv.dataset.market = cfg.id;
  }
  // 벤치마크 기여도 셀렉트도 같은 시점에 시장별로 다시 채운다.
  populatePortfolioBenchmarks();
}

function backtestSnapshotEndDate() {
  return backtestSnapshotIsoDate() || new Date().toISOString().slice(0, 10);
}

function shiftIsoDateByYears(iso, years) {
  const d = new Date(`${iso}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function backtestPresetYears(periodValue) {
  if (periodValue === "252") return 1;
  if (periodValue === "1260") return 5;
  if (periodValue === "756") return 3;
  return null;
}

function applyBacktestPresetDates() {
  const period = byId("backtestPeriod")?.value || "756";
  const years = backtestPresetYears(period);
  if (!years) return;
  const startInput = byId("backtestStartDate");
  const endInput = byId("backtestEndDate");
  if (!startInput || !endInput) return;
  const end = backtestSnapshotEndDate();
  // 상세 JSON 의 가격 이력은 스냅샷 기준 약 5년 롤링 윈도우다. 하한을 고정 날짜로
  // 박아두면 시간이 갈수록 실제 데이터 시작일과 어긋난다 — 스냅샷 날짜에서 유도.
  const min = shiftIsoDateByYears(end, -5);
  startInput.min = min;
  endInput.min = min;
  startInput.max = end;
  endInput.max = end;
  backtestDatesProgrammatic = true;
  endInput.value = end;
  startInput.value = shiftIsoDateByYears(end, -years);
  backtestDatesProgrammatic = false;
}

function initBacktestDateRange() {
  applyBacktestPresetDates();
}

function syncBacktestCustomUi() {
  const period = byId("backtestPeriod")?.value;
  if (period !== "custom") applyBacktestPresetDates();
  const weightMode = byId("backtestWeightMode")?.value;
  const weightsWrap = byId("backtestWeightsWrap");
  if (weightsWrap) weightsWrap.hidden = weightMode !== "custom";
}

function setBacktestPeriodToCustom() {
  if (backtestDatesProgrammatic) return;
  const sel = byId("backtestPeriod");
  if (sel && sel.value !== "custom") sel.value = "custom";
}

function submitBacktestTickerAdd() {
  const input = byId("backtestTickerInput");
  if (!input) return;
  if (addBacktestTicker(input.value)) input.value = "";
}

function setupBacktestEvents() {
  populateBacktestBenchmarks();
  initBacktestDateRange();
  syncBacktestCustomUi();
  if (!backtestTickers.length) setBacktestTickers(watchlist.slice(0, 5));
  else renderBacktestTickerChips();
  const run = () => runPortfolioBacktest();
  byId("backtestRun")?.addEventListener("click", run);
  byId("backtestTickerAdd")?.addEventListener("click", submitBacktestTickerAdd);
  byId("backtestTickerInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitBacktestTickerAdd();
    }
  });
  byId("backtestFromWatchlist")?.addEventListener("click", () => {
    setBacktestTickers(watchlist.slice(0, BACKTEST_MAX_TICKERS));
    run();
  });
  byId("backtestPeriod")?.addEventListener("change", () => {
    syncBacktestCustomUi();
    if (byId("backtestResults")?.hidden) setBacktestStatus("");
    if (!byId("backtestResults")?.hidden) run();
  });
  byId("backtestWeightMode")?.addEventListener("change", () => {
    syncBacktestCustomUi();
    renderBacktestTickerChips();
  });
  ["backtestBenchmark", "backtestInvestment", "backtestWeights"].forEach((id) => {
    byId(id)?.addEventListener("change", () => {
      if (!byId("backtestResults")?.hidden) run();
    });
  });
  ["backtestStartDate", "backtestEndDate"].forEach((id) => {
    byId(id)?.addEventListener("change", () => {
      setBacktestPeriodToCustom();
      const start = byId("backtestStartDate")?.value;
      const end = byId("backtestEndDate")?.value;
      if (start && end && start > end) setBacktestStatus("시작일이 종료일보다 늦습니다.");
      else if (byId("backtestResults")?.hidden) setBacktestStatus("");
      if (!byId("backtestResults")?.hidden) run();
    });
  });
}
