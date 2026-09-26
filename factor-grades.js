// factor-grades.js — 업종 상대 팩터 등급(A~F) 화면
// =====================================================
// 계산은 factor-grade-core.js(window.MirFactorGradeCore, node 테스트 있음). 여기는 입력 조립과 렌더만.
// 입력: 이미 부팅 때 받은 시장 스냅샷(data.stocks) + map_fundamentals(MAP_FUNDAMENTALS).
// 새 데이터 파일이 없다 — 전 종목 백분위는 브라우저에서 종목을 열 때 그 종목의 업종·섹터
// 집단만 계산한다(집단당 수 ms, 부팅 비용 0). 사전 계산 JSON 을 만들면 ~1MB 가 부팅에 더해진다.
//
// 표시 위치: 종목 탭 › 분석(#factorGrades) + AI 모드 종목 대시보드(aiFactorGradePanel).
// 정직성: 등급은 '같은 업종 안 현재 위치' 서술이고 예측이 아니다. factor_validation.json 의
// 검증 결과(대부분 엣지 없음)를 팩터마다 한 줄로 붙인다.

let _factorGradeMemo = null;

// 등급 구성 지표 값. 비교 집단 전체에 같은 소스로 있어야 공정하므로 스냅샷·map_fundamentals 만 쓴다
// (종목 상세 JSON 의 값은 그 종목에만 있어 섞지 않는다).
function factorGradeMetricValue(stock, key) {
  if (!stock) return null;
  if (key === "threeMonthChangePct" || key === "newHighDistancePct") {
    const v = Number(stock[key]);
    return Number.isFinite(v) ? v : null;
  }
  if (key === "epsGrowthEst") {
    // 애널리스트 추정 EPS(다음 해) ÷ 실적 EPS(TTM) − 1. 기준 EPS 가 0 이하이면 성장률이 의미 없어 결측.
    const now = Number(stock.epsTtm);
    const nxt = Number(stock.epsNextY);
    return now > 0 && Number.isFinite(nxt) ? (nxt / now - 1) * 100 : null;
  }
  const f = (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(stock.ticker) : null) || {};
  const v = Number(f[key]);
  return Number.isFinite(v) ? v : null;
}

function factorGradeIndex() {
  const core = window.MirFactorGradeCore;
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  if (!core || stocks.length < 30) return null;
  const mfCount = Object.keys(window.MAP_FUNDAMENTALS || {}).length;
  const key = `${marketCfg().id}|${data.updatedAtKst || data.updated_at_kst || ""}|${stocks.length}|${mfCount}`;
  if (_factorGradeMemo && _factorGradeMemo.key === key) return _factorGradeMemo.index;
  const universe = stocks.filter((s) => s && !isStockEtf(s));
  // 이 시장에서 30종목 이상 값이 있는 지표만 쓴다(KR 에만 있는 부채비율, US 에 없는 성장률 등).
  const coverage = {};
  core.FACTORS.forEach((f) => f.metrics.forEach((m) => {
    let n = 0;
    for (const s of universe) { if (factorGradeMetricValue(s, m.key) != null) { n++; if (n >= 30) break; } }
    coverage[m.key] = n >= 30;
  }));
  const index = core.createGradeIndex(stocks, {
    get: factorGradeMetricValue,
    exclude: (s) => isStockEtf(s),
    metricAvailable: (k) => coverage[k] === true,
  });
  _factorGradeMemo = { key, index };
  return index;
}

function factorGradeFmtValue(m) {
  if (m.value == null) return "—";
  const v = Number(m.value);
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  if (m.unit === "%") return `${v > 0 && m.key.includes("Growth") ? "+" : ""}${v.toFixed(digits)}%`;
  return `${v.toFixed(digits)}배`;
}

function factorGradeValidationLine(factor) {
  const core = window.MirFactorGradeCore;
  if (!core) return "";
  if (factor.validation && factor.validation.length && !window.FACTOR_VALIDATION) return "과거 검증 결과를 불러오는 중…";
  return core.validationSummary(window.FACTOR_VALIDATION, isKrMarket() ? "kr" : "us", factor.validation).text;
}

function factorGradeRowHtml(f) {
  const badge = f.status === "ok"
    ? `<span class="fgrade-badge fgrade-${f.grade}" aria-label="등급 ${f.grade}">${f.grade}</span>`
    : `<span class="fgrade-badge fgrade-na">${f.status === "held" ? "보류" : "—"}</span>`;
  let summary;
  if (f.status === "ok") {
    const esc = f.escalatedFrom
      ? ` <span class="fgrade-esc">업종 표본 ${f.escalatedFrom.eligible}개라 섹터 기준</span>`
      : "";
    summary = `${escapeHtml(f.levelLabel)} ${escapeHtml(f.group)} ${f.n}개 중 ${f.rank}위 · 백분위 ${Math.round(f.pct)}${esc}`;
  } else {
    summary = escapeHtml(f.reason || "데이터 없음");
  }
  const vline = `<p class="fgrade-valid">${escapeHtml(factorGradeValidationLine(f))}</p>`;
  let detail = "";
  if (f.status === "ok") {
    const rows = f.metrics.map((m) => `<tr${m.usable ? "" : ' class="fgrade-unused"'}>
        <td>${escapeHtml(m.label)}${m.dir < 0 ? ' <span class="fgrade-dir">낮을수록 상위</span>' : ""}</td>
        <td class="num">${escapeHtml(factorGradeFmtValue(m))}</td>
        <td class="num">${m.pct != null ? Math.round(m.pct) : (m.usable ? "—" : "표본 부족")}</td>
        <td class="num">${m.n}</td>
      </tr>`).join("");
    detail = `<div class="fgrade-table-wrap"><table class="fgrade-table">
        <thead><tr><th>구성 지표</th><th class="num">이 종목</th><th class="num">${escapeHtml(f.levelLabel)} 내 백분위</th><th class="num">표본</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="fgrade-note">${escapeHtml(f.desc)}. 백분위는 좋은 쪽이 100. 구성 지표 백분위의 평균을 ${escapeHtml(f.levelLabel)} 안에서 다시 백분위로 바꿔 등급을 매깁니다.</p>`;
  } else if (f.status === "held" && f.tried && f.tried.length) {
    detail = `<p class="fgrade-note">업종·섹터 모두 비교 표본이 ${window.MirFactorGradeCore.DEFAULT_MIN_SAMPLE}개 미만이라 등급을 매기지 않았습니다.</p>`;
  }
  return `<details class="fgrade-row">
      <summary>${badge}<span class="fgrade-name">${escapeHtml(f.label)}</span><span class="fgrade-sum">${summary}</span></summary>
      <div class="fgrade-body">${detail}${vline}</div>
    </details>`;
}

// 등급 본문 HTML. 계산할 수 없으면 "".
function factorGradeBodyHtml(item) {
  const idx = factorGradeIndex();
  if (!idx || !item || !item.ticker) return "";
  const res = idx.gradesFor(item.ticker);
  if (!res || res.excluded) return "";
  if (!res.factors.some((f) => f.status === "ok")) return "";
  if (!window.FACTOR_VALIDATION && typeof ensureFactorValidation === "function") {
    ensureFactorValidation().then((ok) => { if (ok) refreshFactorGradeViews(); });
  }
  const when = (data && (data.updatedAtKst || data.updated_at_kst)) || "";
  return `<div class="fgrade-list">${res.factors.map(factorGradeRowHtml).join("")}</div>
    <p class="fgrade-foot">A 백분위 80 이상 · B 60~80 · C 40~60 · D 20~40 · F 20 미만. 비교 집단은 같은 업종(표본 ${idx.minSample}개 미만이면 섹터), 적자·음수 배수는 밸류 비교에서 뺍니다. 예상 EPS 성장률은 애널리스트 추정치입니다. 매매 신호가 아니라 현재 위치를 요약한 정보입니다.${when ? ` 기준 ${escapeHtml(when)}.` : ""}</p>`;
}

function renderFactorGrades(item) {
  const box = byId("factorGrades");
  if (!box) return;
  const body = factorGradeBodyHtml(item);
  if (!body) { box.hidden = true; box.innerHTML = ""; return; }
  // 펼쳐 둔 팩터는 다시 그려도 펼친 채로 둔다(데이터 늦게 도착 → 재렌더).
  const open = new Set([...box.querySelectorAll("details.fgrade-row[open] .fgrade-name")].map((el) => el.textContent));
  box.hidden = false;
  box.innerHTML = `<div class="fgrade-head"><h3>업종 상대 팩터 등급</h3><span class="muted fgrade-sub">같은 업종 안 백분위 · 예측 아님</span></div>${body}`;
  if (open.size) box.querySelectorAll("details.fgrade-row").forEach((d) => { if (open.has(d.querySelector(".fgrade-name")?.textContent)) d.open = true; });
}

// AI 모드 종목 대시보드용 패널(ai-mode.js renderAiModeDataBoard 가 부른다).
function aiFactorGradePanel(item) {
  if (typeof aiModePanel !== "function") return "";
  const body = factorGradeBodyHtml(item);
  if (!body) return "";
  return aiModePanel("업종 상대 팩터 등급", "같은 업종 안 백분위 · 예측 아님", `<div class="fgrade-card-inner" data-fgrade-ticker="${escapeHtml(item.ticker)}">${body}</div>`);
}

// 검증 파일·MAP_FUNDAMENTALS 가 늦게 도착하면 보이는 곳만 다시 그린다.
function refreshFactorGradeViews() {
  try {
    document.querySelectorAll(".fgrade-card-inner[data-fgrade-ticker]").forEach((el) => {
      const t = el.getAttribute("data-fgrade-ticker");
      const row = typeof stockByTicker === "function" ? stockByTicker(t) : null;
      const body = row ? factorGradeBodyHtml(row) : "";
      if (body) el.innerHTML = body;
    });
    if (typeof selectedBaseRow !== "function" || !byId("factorGrades")) return;
    const base = selectedBaseRow();
    if (base && currentTab === "search" && searchSubTab === "analysis") renderFactorGrades(base);
  } catch (_) { /* 렌더 실패는 다른 패널에 영향 주지 않는다 */ }
}
