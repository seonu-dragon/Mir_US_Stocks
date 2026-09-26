// 포트폴리오 위험 분석 — 화면(내 투자 › 도구).
//   1) 위험 기여도 · 리스크 패리티 · 최소분산 카드(#pfRiskCard) + 표본 외 비교 + 리밸런싱/시뮬레이터로 보내기
//   2) 포트폴리오 시뮬레이터 결과 아래 성과 지표(티어시트, #backtestTearsheet)
//   3) 스트레스 테스트의 '과거 위기 재생' 모드(#stressCrisisPane) — 기존 가정형 시나리오와 토글로 병렬
// 계산은 portfolio-risk-core.js(window.MirPortfolioRiskCore, node 테스트 대상)가 하고, 이 파일은 가격 이력
// 로드·렌더만 맡는다. 가격 이력은 포트폴리오 시뮬레이터와 같은 경로(loadStockDetail → 상세 JSON chartSeries,
// 없으면 워커 차트 프록시)를 쓴다. 계산량이 작아(종목 ≤ 20, ≤ 1,260일) Web Worker 는 쓰지 않는다.
// IIFE — 최상위 이름을 흘리지 않는다. 밖에서 쓰는 건 window.MirPortfolioRisk 뿐.
(function () {
  "use strict";

  const STRESS_MODE_KEY = "mir_stress_mode_v1";
  const RISK_PREFS_KEY = "mir_pf_risk_prefs_v1";
  const SCHEME_LABEL = { current: "현재 비중", equal: "동일 비중", riskParity: "리스크 패리티", minVariance: "최소분산" };
  const PROXY_LABEL = { "^KS11": "코스피", "^KQ11": "코스닥" };

  const core = () => window.MirPortfolioRiskCore;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s ?? "")) : String(s ?? ""));
  const label = (t) => { try { return stockLabel(t); } catch (_) { return t; } };
  // 비율(0.123) → "12.3%". signed 면 부호.
  const pct = (x, digits = 1, signed = false) => {
    if (!Number.isFinite(x)) return "—";
    const v = x * 100;
    return `${signed && v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
  };
  const num = (x, digits = 2) => (Number.isFinite(x) ? x.toFixed(digits) : "—");
  const tone = (x) => (Number.isFinite(x) ? (x > 0 ? "pos" : x < 0 ? "neg" : "muted") : "muted");
  const toast = (msg) => { if (typeof showAppToast === "function") showAppToast(msg); };

  let bound = false;
  let routeApplied = false;
  let allocToken = 0;
  let allocCacheKey = "";
  let lastAlloc = null;
  let crisisToken = 0;
  let crisisCacheKey = "";
  let crisisResult = null;
  let crisisSelected = "";

  function prefs() {
    const p = window.safeStorage ? window.safeStorage.getJSON(RISK_PREFS_KEY, {}) : {};
    return p && typeof p === "object" ? p : {};
  }
  function savePrefs(patch) {
    if (window.safeStorage) window.safeStorage.setJSON(RISK_PREFS_KEY, { ...prefs(), ...patch });
  }

  function snapshotStamp() {
    return String((typeof data !== "undefined" && data && (data.updatedAtKst || data.updated_at_kst)) || "");
  }

  // 상세 JSON(실측 일봉)만 쓴다. 합성 이력(closeSeries 랜덤워크)은 위험 계산에 넣지 않는다.
  async function loadRealSeries(ticker) {
    const stock = stockByTicker(ticker);
    let detail = null;
    try { detail = await loadStockDetail(ticker); } catch (_) { detail = null; }
    const merged = detail ? { ...stock, ...detail } : stock;
    if (!merged) return { ticker, stock, map: new Map(), real: false };
    const rows = getChartRows(merged);
    const real = !isSyntheticChart(merged);
    return { ticker, stock, map: real ? closeSeriesToDateMap(rows) : new Map(), real };
  }

  function openFoldOf(el) {
    const fold = el && el.closest ? el.closest("details") : null;
    if (fold && !fold.open) fold.open = true;
    return fold;
  }

  // ------------------------------------------------------------ 작은 SVG 선 차트
  // width 는 실제 표시 폭(px)을 넘긴다 — 고정 좌표계를 늘려 그리면 글자가 커지고 좌우가 비었다.
  function lineChart({ dates, lines, ref, height = 170, width = 520, yFmt = (v) => v.toFixed(1) }) {
    const W = Math.max(280, Math.round(width || 520));
    const H = height;
    const padL = 44; const padR = 10; const padT = 12; const padB = 24;
    const all = [];
    lines.forEach((l) => l.values.forEach((v) => { if (Number.isFinite(v)) all.push(v); }));
    if (ref != null) all.push(ref);
    if (!all.length || dates.length < 2) return "";
    let lo = Math.min(...all); let hi = Math.max(...all);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const span = hi - lo;
    lo -= span * 0.06; hi += span * 0.06;
    const x = (i) => padL + (i / (dates.length - 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const path = (vals) => {
      let d = ""; let pen = false;
      vals.forEach((v, i) => {
        if (!Number.isFinite(v)) { pen = false; return; }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      return d;
    };
    const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
    const mid = Math.floor((dates.length - 1) / 2);
    return `<svg class="pf-mini-chart" viewBox="0 0 ${W} ${H}" role="img">
      ${ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="chart-grid"></line><text x="${padL - 5}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end" class="chart-axis">${esc(yFmt(t))}</text>`).join("")}
      ${ref != null ? `<line x1="${padL}" x2="${W - padR}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}" class="rsi-guide"></line>` : ""}
      ${lines.map((l) => `<path d="${path(l.values)}" fill="none" stroke="${l.color}" stroke-width="${l.width || 1.8}" ${l.dash ? `stroke-dasharray="${l.dash}"` : ""} vector-effect="non-scaling-stroke"></path>`).join("")}
      <text x="${padL}" y="${H - 6}" class="chart-axis">${esc(String(dates[0]).slice(2))}</text>
      <text x="${x(mid).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="chart-axis">${esc(String(dates[mid]).slice(2))}</text>
      <text x="${W - padR}" y="${H - 6}" text-anchor="end" class="chart-axis">${esc(String(dates[dates.length - 1]).slice(2))}</text>
    </svg>`;
  }

  // =============================================================== 1) 위험 기여도 · RP · 최소분산
  function allocInputs() {
    const source = $("pfRiskSource")?.value || "holdings";
    const lookback = Number($("pfRiskLookback")?.value || 756);
    const capRaw = Number($("pfRiskCap")?.value);
    const cap = Number.isFinite(capRaw) && capRaw > 0 && capRaw < 100 ? capRaw / 100 : null;
    if (source === "backtest") {
      const tickers = typeof backtestTickersFromInput === "function" ? backtestTickersFromInput() : [];
      if (tickers.length < 2) return { source, lookback, cap, error: "포트폴리오 시뮬레이터에 종목을 2개 이상 추가하세요." };
      const wr = backtestWeightsForTickers(tickers);
      if (wr.error) return { source, lookback, cap, error: `시뮬레이터 비중 오류: ${wr.error}` };
      return { source, lookback, cap, items: tickers.map((t, i) => ({ ticker: t, weight: wr.weights[i] / 100 })) };
    }
    const rows = (typeof portfolioDetailRows === "function" ? portfolioDetailRows() : []).filter((r) => r.value > 0);
    if (rows.length < 2) return { source, lookback, cap, error: "보유 종목이 2개 이상이어야 계산할 수 있습니다." };
    const total = rows.reduce((s, r) => s + r.value, 0);
    return { source, lookback, cap, items: rows.map((r) => ({ ticker: r.ticker, weight: r.value / total })) };
  }

  function allocKey(inp) {
    return JSON.stringify({ m: marketCfg().id, s: snapshotStamp(), src: inp.source, lb: inp.lookback, cap: inp.cap, it: (inp.items || []).map((i) => [i.ticker, Math.round(i.weight * 1e5)]) });
  }

  function setAllocStatus(text) {
    const el = $("pfRiskStatus");
    if (el) el.textContent = text || "";
  }

  async function runAlloc(force = false) {
    const body = $("pfRiskBody");
    if (!body || !core()) return;
    const inp = allocInputs();
    if (inp.error) {
      body.innerHTML = "";
      setAllocStatus(inp.error);
      lastAlloc = null;
      allocCacheKey = "";
      return;
    }
    const key = allocKey(inp);
    if (!force && key === allocCacheKey && lastAlloc) return;
    const token = ++allocToken;
    setAllocStatus("가격 이력을 불러오는 중입니다.");
    const loaded = await Promise.all(inp.items.map((it) => loadRealSeries(it.ticker)));
    if (token !== allocToken) return;
    const usable = [];
    const excluded = [];
    loaded.forEach((s, i) => {
      if (s.real && s.map.size >= 80) usable.push({ ...inp.items[i], map: s.map });
      else excluded.push(inp.items[i]);
    });
    if (usable.length < 2) {
      body.innerHTML = "";
      setAllocStatus("실측 가격 이력(상세 일봉)이 있는 종목이 2개 이상 필요합니다.");
      return;
    }
    const res = core().analyzeAllocation(usable.map((u) => u.map), usable.map((u) => u.weight), { lookback: inp.lookback, cap: inp.cap });
    if (res.error) {
      body.innerHTML = "";
      setAllocStatus(`공통 거래일이 ${res.days}일뿐이라 추정할 수 없습니다(최소 61일). 이력이 짧은 종목을 빼 보세요.`);
      return;
    }
    lastAlloc = { inp, usable, excluded, res };
    allocCacheKey = key;
    setAllocStatus("");
    renderAlloc();
  }

  function renderAlloc() {
    const body = $("pfRiskBody");
    if (!body || !lastAlloc) return;
    const { inp, usable, excluded, res } = lastAlloc;
    const excludedWeight = excluded.reduce((s, e) => s + e.weight, 0);
    const rows = usable.map((u, i) => ({
      ticker: u.ticker,
      vol: res.vols[i],
      cur: res.current.weights[i],
      rc: res.current.pct[i],
      rp: res.riskParity.weights[i],
      mv: res.minVariance.weights[i],
    }));
    const capNote = inp.cap
      ? (res.minVariance.effectiveCap > inp.cap + 1e-9 ? `종목 상한 ${pct(inp.cap, 0)} 은 종목 수보다 작아 ${pct(res.minVariance.effectiveCap, 1)} 로 올려 적용` : `종목 상한 ${pct(inp.cap, 0)}`)
      : "종목 상한 없음";
    const oos = res.oos;
    const target = inp.source === "backtest" ? "시뮬레이터 직접 비중" : "리밸런싱 목표";
    body.innerHTML = `
      <div class="portfolio-tool-summary pf-risk-summary">
        <div><span>현재 비중 · 연 변동성</span><strong>${pct(res.current.vol)}</strong></div>
        <div><span>리스크 패리티 · 연 변동성</span><strong>${pct(res.riskParity.vol)}</strong></div>
        <div><span>최소분산 · 연 변동성</span><strong>${pct(res.minVariance.vol)}</strong></div>
      </div>
      <div class="portfolio-tool-table">
        <table>
          <thead><tr><th>종목</th><th>연 변동성</th><th>현재 비중</th><th>위험 기여도</th><th>리스크 패리티</th><th>최소분산</th></tr></thead>
          <tbody>${rows.map((r) => {
            const heavy = r.rc - r.cur > 0.05;
            return `<tr>
              <td><strong>${esc(label(r.ticker))}</strong></td>
              <td>${pct(r.vol)}</td>
              <td>${pct(r.cur)}</td>
              <td><span class="pf-rc-bar" style="--w:${Math.max(0, Math.min(100, r.rc * 100)).toFixed(1)}%"></span><strong class="${heavy ? "warn" : ""}">${pct(r.rc)}</strong></td>
              <td>${pct(r.rp)}</td>
              <td>${pct(r.mv)}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
      ${excluded.length ? `<p class="muted pf-risk-note">실측 일봉 이력이 부족해 계산에서 뺀 종목: ${excluded.map((e) => esc(label(e.ticker))).join(", ")} (현재 비중 합 ${pct(excludedWeight)}). 위 비중은 나머지 종목 안에서의 비율입니다.</p>` : ""}
      <div class="pf-risk-actions">
        <button type="button" class="ghost compact-btn" data-pf-risk-apply="riskParity">리스크 패리티 → ${target}</button>
        <button type="button" class="ghost compact-btn" data-pf-risk-apply="minVariance">최소분산 → ${target}</button>
      </div>
      ${oos ? `
      <h4 class="pf-risk-sub">표본 외 비교 — 앞 구간으로 비중을 정하고 뒤 구간에서 실제로 어땠나</h4>
      <p class="muted pf-risk-note">추정 ${esc(oos.inSample.start)} ~ ${esc(oos.inSample.end)} (${oos.inSample.days}거래일) → 검증 ${esc(oos.outSample.start)} ~ ${esc(oos.outSample.end)} (${oos.outSample.days}거래일). 검증 구간은 매일 같은 비중을 유지한다고 가정했습니다.</p>
      <div class="portfolio-tool-table">
        <table>
          <thead><tr><th>방식</th><th>앞 구간 추정 변동성</th><th>뒤 구간 실현 변동성</th><th>뒤 구간 최대낙폭</th><th>뒤 구간 수익률</th></tr></thead>
          <tbody>${oos.rows.map((r) => `<tr>
            <td><strong>${SCHEME_LABEL[r.key]}</strong></td>
            <td>${pct(r.inSampleVol)}</td>
            <td>${pct(r.vol)}</td>
            <td class="neg">${pct(r.mdd)}</td>
            <td class="${tone(r.ret)}">${pct(r.ret, 1, true)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      <p class="muted pf-risk-note">분할 한 번의 결과라 표본은 1개입니다 — 어느 방식이 낫다는 통계적 결론이 아닙니다. 수익률은 참고로만 보세요(위험 기반 방식은 수익을 겨냥하지 않습니다).</p>` : `<p class="muted pf-risk-note">표본 외 비교는 추정 기간이 약 100거래일 이상일 때 나옵니다.</p>`}
      <details class="pf-risk-method">
        <summary>계산 방법 · 한계</summary>
        <ul>
          <li>${esc(res.dates[0])} ~ ${esc(res.dates[res.dates.length - 1])}, 모든 종목에 가격이 있는 ${res.days + 1}거래일의 일별 수익률(종가, 배당 미포함). 공분산은 표본 오차를 줄이는 축소 추정(Ledoit-Wolf)을 씁니다.</li>
          <li>위험 기여도 = 그 종목이 포트폴리오 변동성에서 차지하는 몫(합계 100%). 비중보다 5%p 넘게 크면 강조했습니다.</li>
          <li>리스크 패리티는 위험 기여가 모두 같아지는 비중, 최소분산은 변동성이 가장 작은 비중입니다(공매도 없음, ${esc(capNote)})${res.riskParity.converged ? "" : " — 이번 리스크 패리티는 근사값입니다"}.</li>
          <li>기대수익을 넣는 최적화는 과거 수익률에 과적합되기 쉬워 제공하지 않습니다.</li>
          <li>과거 변동성·상관은 앞으로 바뀝니다. 매매 권유가 아닌 정보이며, 거래비용·세금은 반영하지 않습니다.</li>
        </ul>
      </details>`;
    body.querySelectorAll("[data-pf-risk-apply]").forEach((btn) => btn.addEventListener("click", () => applyScheme(btn.dataset.pfRiskApply)));
  }

  function applyScheme(key) {
    if (!lastAlloc) return;
    const { inp, usable, excluded, res } = lastAlloc;
    const w = res[key]?.weights;
    if (!w) return;
    if (inp.source === "backtest") {
      // 시뮬레이터: 티커 순서대로 직접 비중. 계산에서 빠진 종목은 0.
      const tickers = backtestTickersFromInput();
      const byT = new Map(usable.map((u, i) => [u.ticker, w[i]]));
      const parts = tickers.map((t) => ((byT.get(t) || 0) * 100).toFixed(1));
      const mode = $("backtestWeightMode");
      const input = $("backtestWeights");
      if (!mode || !input) return;
      mode.value = "custom";
      input.value = parts.join(",");
      if (typeof syncBacktestCustomUi === "function") syncBacktestCustomUi();
      openFoldOf($("backtestPanel"));
      $("backtestPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof runPortfolioBacktest === "function") runPortfolioBacktest();
      toast(`${SCHEME_LABEL[key]} 비중을 시뮬레이터에 넣었습니다.`);
      return;
    }
    // 보유: 계산에서 빠진 종목은 현재 비중을 그대로 두고, 나머지를 그 안에서 배분한다.
    const excludedPct = excluded.reduce((s, e) => s + e.weight, 0) * 100;
    excluded.forEach((e) => { rebalanceTargets[e.ticker] = e.weight * 100; });
    usable.forEach((u, i) => { rebalanceTargets[u.ticker] = w[i] * (100 - excludedPct); });
    savePortfolioExtension(REBALANCE_TARGET_KEY, rebalanceTargets);
    renderRebalanceCalculator();
    const card = $("rebalanceCard");
    openFoldOf(card);
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast(`${SCHEME_LABEL[key]} 비중을 리밸런싱 목표로 넣었습니다.`);
  }

  // =============================================================== 2) 티어시트
  function heatColor(r) {
    if (!Number.isFinite(r)) return "";
    const a = Math.min(1, Math.abs(r) / 0.1); // ±10% 에서 최대
    const pctMix = Math.round(12 + a * 48);
    return `background:color-mix(in srgb, var(${r >= 0 ? "--pos" : "--neg"}) ${pctMix}%, transparent)`;
  }

  function renderTearsheet(payload) {
    const box = $("backtestTearsheet");
    if (!box || !core()) return;
    const ts = core().tearsheet(payload.portfolioSeries || [], payload.benchmarkSeries || []);
    if (!ts) { box.innerHTML = ""; return; }
    const b = ts.benchmark;
    const bt = esc(payload.benchmarkName || payload.benchmarkTicker || "벤치마크");
    const metric = (name, value, cl = "", note = "") => `<article><span>${name}</span><strong class="${cl}">${value}</strong>${note ? `<em>${note}</em>` : ""}</article>`;
    // 월별 히트맵
    const years = [...new Set(ts.monthly.map((m) => m.year))];
    const yearly = new Map(ts.yearly.map((y) => [y.year, y]));
    const bYearly = new Map((b?.yearly || []).map((y) => [y.year, y]));
    const heat = `<div class="pf-heatmap-wrap"><table class="pf-heatmap">
      <thead><tr><th>연도</th>${Array.from({ length: 12 }, (_, i) => `<th>${i + 1}월</th>`).join("")}<th>연간</th></tr></thead>
      <tbody>${years.map((y) => `<tr><th>${y}</th>${Array.from({ length: 12 }, (_, i) => {
        const m = ts.monthly.find((x) => x.year === y && x.month === i + 1);
        if (!m) return `<td class="muted">·</td>`;
        return `<td style="${heatColor(m.ret)}" title="${esc(m.start)} ~ ${esc(m.end)}${m.partial ? " (부분 월)" : ""}">${(m.ret * 100).toFixed(1)}${m.partial ? "*" : ""}</td>`;
      }).join("")}<td class="pf-heat-year ${tone(yearly.get(y)?.ret)}">${pct(yearly.get(y)?.ret, 1, true)}${yearly.get(y)?.partial ? "*" : ""}</td></tr>`).join("")}</tbody>
    </table></div>`;
    const yearTable = `<div class="portfolio-tool-table"><table>
      <thead><tr><th>연도</th><th>포트폴리오</th>${b ? `<th>${bt}</th><th>차이</th>` : ""}<th>구간</th></tr></thead>
      <tbody>${ts.yearly.map((y) => {
        const by = bYearly.get(y.year);
        return `<tr><td>${y.year}${y.partial ? " (부분)" : ""}</td><td class="${tone(y.ret)}">${pct(y.ret, 1, true)}</td>${b ? `<td class="${tone(by?.ret)}">${pct(by?.ret, 1, true)}</td><td class="${tone(y.ret - (by?.ret ?? NaN))}">${by ? `${((y.ret - by.ret) * 100 > 0 ? "+" : "")}${((y.ret - by.ret) * 100).toFixed(1)}%p` : "—"}</td>` : ""}<td>${esc(y.start.slice(5))} ~ ${esc(y.end.slice(5))}</td></tr>`;
      }).join("")}</tbody></table></div>`;
    const ddTable = ts.drawdowns.length ? `<div class="portfolio-tool-table"><table>
      <thead><tr><th>순위</th><th>시작(고점)</th><th>저점</th><th>회복일</th><th>깊이</th><th>기간</th><th>저점까지</th></tr></thead>
      <tbody>${ts.drawdowns.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.peak)}</td><td>${esc(d.valley)}</td><td>${d.recovered ? esc(d.recovery) : `<span class="muted">미회복</span>`}</td><td class="neg">${pct(d.depth)}</td><td>${d.days}거래일${d.recovered ? "" : "+"}</td><td>${d.toValleyDays}거래일</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">낙폭 구간이 없습니다.</p>`;
    const roll = ts.rolling;
    const boxW = box.clientWidth || box.parentElement?.clientWidth || 800; // 첫 렌더엔 :empty 로 숨겨져 폭이 0
    const rollW = boxW > 640 ? (boxW - 10) / 2 : boxW;
    const rollHtml = roll.length >= 2 ? `
      <div class="pf-roll-grid">
        <figure><figcaption>롤링 12개월 샤프</figcaption>${lineChart({ dates: roll.map((r) => r.d), lines: [{ values: roll.map((r) => r.sharpe), color: "#2563eb" }], ref: 0, width: rollW, yFmt: (v) => v.toFixed(1) })}</figure>
        ${b ? `<figure><figcaption>롤링 12개월 β (${bt} 대비)</figcaption>${lineChart({ dates: roll.map((r) => r.d), lines: [{ values: roll.map((r) => r.beta), color: "#d97706" }], ref: 1, width: rollW, yFmt: (v) => v.toFixed(2) })}</figure>` : ""}
      </div>` : `<p class="muted">기간이 1년(252거래일) 이하라 롤링 12개월 지표는 계산하지 않았습니다.</p>`;
    box.innerHTML = `
      <div class="pf-tearsheet-head">
        <h3>성과 지표 (티어시트)</h3>
        <p class="muted">${esc(ts.start)} ~ ${esc(ts.end)} · ${ts.days}거래일 · 일별 종가(배당 미포함) · 무위험 수익률 0 · 연 252거래일 기준</p>
      </div>
      <div class="risk-grid pf-ts-grid">
        ${metric("연환산 수익률(CAGR)", pct(ts.annualReturn, 1, true), tone(ts.annualReturn))}
        ${metric("연 변동성", pct(ts.annualVol))}
        ${metric("샤프", num(ts.sharpe))}
        ${metric("소르티노", num(ts.sortino))}
        ${metric("칼마", num(ts.calmar))}
        ${metric("최대 낙폭", pct(ts.maxDrawdown), "neg")}
        ${b ? metric(`β (${bt})`, num(b.beta)) : ""}
        ${b ? metric("상방 포착률", Number.isFinite(b.upCapture) ? `${(b.upCapture * 100).toFixed(0)}%` : "—", "", `상승일 ${b.upDays}`) : ""}
        ${b ? metric("하방 포착률", Number.isFinite(b.downCapture) ? `${(b.downCapture * 100).toFixed(0)}%` : "—", "", `하락일 ${b.downDays}`) : ""}
        ${b ? metric("연환산 초과수익", `${b.excessAnnual * 100 > 0 ? "+" : ""}${(b.excessAnnual * 100).toFixed(1)}%p`, tone(b.excessAnnual), `${bt} ${pct(b.annualReturn, 1, true)}`) : ""}
        ${b ? metric("누적 초과수익", `${b.excessTotal * 100 > 0 ? "+" : ""}${(b.excessTotal * 100).toFixed(1)}%p`, tone(b.excessTotal)) : ""}
      </div>
      <h4 class="pf-risk-sub">월별 수익률 (%)</h4>
      ${heat}
      <p class="muted pf-risk-note">* 기간 시작·끝이라 한 달(한 해) 전체가 아닌 부분 구간입니다.</p>
      <h4 class="pf-risk-sub">연도별 수익</h4>
      ${yearTable}
      <h4 class="pf-risk-sub">낙폭 구간 상위 5</h4>
      ${ddTable}
      <h4 class="pf-risk-sub">롤링 지표</h4>
      ${rollHtml}
      <details class="pf-risk-method">
        <summary>계산 방법</summary>
        <ul>
          <li>일별 수익률 r(${ts.days}개) 기준. 연환산 수익률 = 누적^(252/n) − 1, 연 변동성 = 표준편차(r) × √252.</li>
          <li>샤프 = 평균(r) / 표준편차(r) × √252, 소르티노는 분모를 하락일 변동만으로, 칼마 = 연환산 수익률 / |최대 낙폭|.</li>
          <li>상방(하방) 포착률 = 벤치마크가 오른(내린) 날만 본 연환산 수익률 비율. 하방은 낮을수록 방어적입니다.</li>
          <li>β·롤링 지표는 최근 252거래일 창을 5거래일마다 다시 계산합니다. 월 수익은 월말 종가 기준입니다.</li>
          <li>과거 구간 결과이며 예측이 아닙니다. 지금 상장된 종목만 쓰므로 생존 편향이 있습니다.</li>
        </ul>
      </details>`;
  }

  // =============================================================== 3) 과거 위기 재생
  function stressMode() {
    return (window.safeStorage && window.safeStorage.get(STRESS_MODE_KEY)) === "crisis" ? "crisis" : "preset";
  }

  function applyStressMode(mode) {
    const preset = $("stressPresetPane");
    const crisis = $("stressCrisisPane");
    const select = $("stressScenario");
    if (!preset || !crisis) return;
    preset.hidden = mode === "crisis";
    crisis.hidden = mode !== "crisis";
    if (select) select.hidden = mode === "crisis";
    document.querySelectorAll("[data-stress-mode]").forEach((b) => {
      const on = b.dataset.stressMode === mode;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (mode === "crisis") runCrisis();
  }

  function marketId() { return marketCfg().id === "kr" ? "kr" : "us"; }

  function proxyFor(stock, m, hist) {
    const mk = hist.markets[m];
    if (m === "kr") {
      const sym = String(stock?.market || "").toLowerCase() === "kosdaq" ? mk.proxies.kosdaq : mk.proxies.kospi;
      return sym || mk.proxies.default;
    }
    const kind = typeof stressSectorKind === "function" ? stressSectorKind(stock?.sector) : "other";
    return mk.proxies[kind] || mk.proxies.default;
  }

  function recentMap(hist, m, sym) {
    const rec = hist.markets[m].recent;
    const closes = rec?.closes?.[sym];
    const map = new Map();
    if (!closes) return map;
    rec.dates.forEach((d, i) => { if (Number.isFinite(closes[i]) && closes[i] > 0) map.set(d, closes[i]); });
    return map;
  }

  async function runCrisis(force = false) {
    const pane = $("stressCrisisBody");
    if (!pane || !core()) return;
    const rows = (typeof portfolioDetailRows === "function" ? portfolioDetailRows() : []).filter((r) => r.value > 0);
    if (!rows.length) {
      pane.innerHTML = `<p class="muted">보유 종목을 추가하면 실제 과거 하락 구간에 현재 포트폴리오를 통과시켜 볼 수 있습니다.</p>`;
      crisisResult = null;
      crisisCacheKey = "";
      return;
    }
    const key = JSON.stringify({ m: marketId(), s: snapshotStamp(), h: rows.map((r) => [r.ticker, Math.round(r.value)]) });
    if (!force && key === crisisCacheKey && crisisResult) { renderCrisis(); return; }
    const token = ++crisisToken;
    pane.innerHTML = `<p class="muted">위기 구간 데이터와 가격 이력을 불러오는 중입니다.</p>`;
    const ok = typeof ensureFeatureData === "function" ? await ensureFeatureData("crisisHistory") : !!window.CRISIS_HISTORY;
    const hist = window.CRISIS_HISTORY;
    if (token !== crisisToken) return;
    const m = marketId();
    if (!ok || !hist || !hist.markets || !hist.markets[m]) {
      pane.innerHTML = `<p class="muted">과거 위기 구간 데이터를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>`;
      return;
    }
    const loaded = await Promise.all(rows.map((r) => loadRealSeries(r.ticker)));
    if (token !== crisisToken) return;
    const mk = hist.markets[m];
    const total = rows.reduce((s, r) => s + r.value, 0);
    const scale = hist.scale || 1000;
    const betaCache = new Map();
    const holdings = rows.map((r, i) => ({ ticker: r.ticker, stock: r.stock, weight: r.value / total, map: loaded[i].map, real: loaded[i].real }));
    const windows = hist.windows.map((w) => {
      const cal = mk.calendars[w.id];
      const benchPath = mk.series[mk.benchmark]?.[w.id];
      if (!cal || cal.length < 2 || !benchPath) return { w, error: true };
      const items = holdings.map((h) => {
        // 1) 상세 일봉(약 5년)  2) 위기 데이터셋의 종목 시계열  3) 대리 지수 × β
        let path = h.real ? core().pathFromMap(h.map, cal, scale) : null;
        if (path) return { ...h, method: "real", source: "상세 일봉", path };
        const stored = mk.series[h.ticker]?.[w.id];
        if (stored && stored.length === cal.length) return { ...h, method: "real", source: "위기 데이터", path: stored };
        let proxy = proxyFor(h.stock, m, hist);
        if (!mk.series[proxy]?.[w.id]) proxy = mk.proxies.default;
        const idx = mk.series[proxy]?.[w.id];
        if (!idx) return { ...h, method: "none" };
        const bKey = `${h.ticker}|${proxy}`;
        if (!betaCache.has(bKey)) {
          const est = h.real ? core().betaFromMaps(h.map, recentMap(hist, m, proxy)) : null;
          betaCache.set(bKey, est);
        }
        const est = betaCache.get(bKey);
        const rawBeta = est ? est.beta : 1;
        const beta = Math.max(0, Math.min(3, rawBeta));
        return { ...h, method: "proxy", proxy, beta, betaAssumed: !est, betaClamped: est && beta !== rawBeta, betaN: est ? est.n : 0, path: core().proxyPath(idx, beta, scale) };
      });
      const usable = items.filter((it) => it.path);
      const port = core().combinePaths(usable.map((it) => it.path), usable.map((it) => it.weight), scale);
      const stats = core().pathStats(port, cal);
      const bench = core().pathStats(benchPath, cal);
      const proxyWeight = items.filter((it) => it.method === "proxy").reduce((s, it) => s + it.weight, 0);
      const missingWeight = items.filter((it) => !it.path).reduce((s, it) => s + it.weight, 0);
      items.forEach((it) => { it.ret = it.path ? it.path[it.path.length - 1] / it.path[0] - 1 : NaN; });
      return { w, cal, port, benchPath, stats, bench, items, proxyWeight, missingWeight };
    });
    crisisResult = { m, hist, windows };
    crisisCacheKey = key;
    if (!crisisSelected || !windows.some((x) => x.w.id === crisisSelected && !x.error)) {
      const firstOk = windows.find((x) => !x.error);
      crisisSelected = firstOk ? firstOk.w.id : "";
    }
    renderCrisis();
  }

  function renderCrisis() {
    const pane = $("stressCrisisBody");
    if (!pane || !crisisResult) return;
    const { m, hist, windows } = crisisResult;
    const mk = hist.markets[m];
    const benchLabel = m === "kr" ? "코스피" : "SPY";
    const sel = windows.find((x) => x.w.id === crisisSelected) || windows.find((x) => !x.error);
    const summary = `<div class="portfolio-tool-table"><table class="pf-crisis-table">
      <thead><tr><th>구간</th><th>포트폴리오 수익률</th><th>구간 최대낙폭</th><th>${benchLabel}</th><th>대리 비중</th></tr></thead>
      <tbody>${windows.map((x) => x.error ? `<tr><td>${esc(x.w.label)}</td><td colspan="4" class="muted">구간 데이터 없음</td></tr>` : `
        <tr class="${x === sel ? "is-selected" : ""}">
          <td><button type="button" class="pf-crisis-pick" data-crisis-window="${esc(x.w.id)}">${esc(x.w.label)}</button><small>${esc(x.w.start)} ~ ${esc(x.w.end)}</small></td>
          <td class="${tone(x.stats.ret)}">${pct(x.stats.ret, 1, true)}</td>
          <td class="neg">${pct(x.stats.mdd)}</td>
          <td class="${tone(x.bench.ret)}">${pct(x.bench.ret, 1, true)}<small>낙폭 ${pct(x.bench.mdd)}</small></td>
          <td>${x.proxyWeight > 0.0005 ? `<strong class="${x.proxyWeight >= 0.5 ? "warn" : ""}">${pct(x.proxyWeight, 0)}</strong>` : "0%"}${x.missingWeight > 0.0005 ? `<small>계산 불가 ${pct(x.missingWeight, 0)}</small>` : ""}</td>
        </tr>`).join("")}</tbody></table></div>`;
    let detail = "";
    if (sel && !sel.error) {
      const chart = lineChart({
        dates: sel.cal,
        lines: [
          { values: sel.benchPath.map((v) => v / 10), color: "#94a3b8", dash: "6 4" },
          { values: sel.port.map((v) => v / 10), color: "#2563eb", width: 2.2 },
        ],
        ref: 100,
        width: pane.clientWidth || pane.parentElement?.clientWidth || 800,
        height: (pane.clientWidth || pane.parentElement?.clientWidth || 800) < 520 ? 180 : 220,
        yFmt: (v) => v.toFixed(0),
      });
      detail = `
        <h4 class="pf-risk-sub">${esc(sel.w.label)} <small class="muted">${esc(sel.w.desc || "")}</small></h4>
        <p class="muted pf-risk-note">구간 최저점 ${esc(sel.stats.troughDate || "—")} (${pct(sel.stats.troughRet, 1, true)}) · 실측 ${pct(1 - sel.proxyWeight - sel.missingWeight, 0)} · 대리 ${pct(sel.proxyWeight, 0)}${sel.missingWeight > 0.0005 ? ` · 계산 불가 ${pct(sel.missingWeight, 0)}(나머지 종목으로 다시 배분)` : ""}</p>
        <div class="pf-crisis-chart"><span class="pf-legend-dot" style="--c:#2563eb"></span>포트폴리오 <span class="pf-legend-dot is-dash" style="--c:#94a3b8"></span>${benchLabel} (시작 = 100)${chart}</div>
        <div class="portfolio-tool-table"><table>
          <thead><tr><th>종목</th><th>현재 비중</th><th>계산 방식</th><th>구간 수익률</th><th>기여도</th></tr></thead>
          <tbody>${sel.items.slice().sort((a, b) => b.weight - a.weight).map((it) => {
            const method = it.method === "real"
              ? `<span class="pf-tag is-real">실측</span><small>${esc(it.source)}</small>`
              : it.method === "proxy"
                ? `<span class="pf-tag is-proxy">대리</span><small>${esc(PROXY_LABEL[it.proxy] || it.proxy)} × β ${it.beta.toFixed(2)}${it.betaAssumed ? " (β 1 가정)" : it.betaClamped ? " (0~3 제한)" : ""}</small>`
                : `<span class="muted">계산 불가</span>`;
            return `<tr><td><strong>${esc(label(it.ticker))}</strong></td><td>${pct(it.weight)}</td><td>${method}</td><td class="${tone(it.ret)}">${pct(it.ret, 1, true)}</td><td class="${tone(it.ret)}">${Number.isFinite(it.ret) ? `${(it.ret * it.weight * 100 > 0 ? "+" : "")}${(it.ret * it.weight * 100).toFixed(2)}%p` : "—"}</td></tr>`;
          }).join("")}</tbody></table></div>`;
    }
    pane.innerHTML = `${summary}${detail}
      <details class="pf-risk-method">
        <summary>계산 방법 · 한계</summary>
        <ul>
          <li>현재 평가액 비중으로 구간 첫 거래일에 사서 끝까지 보유했다고 가정한 경로입니다(리밸런싱 없음, 배당 미포함). 구간 달력은 ${m === "kr" ? "코스피" : "SPY"} 거래일.</li>
          <li>실측: 종목의 실제 일봉 — 상세 이력(최근 약 5년) 또는 과거 구간 데이터(시가총액 상위 ${m === "kr" ? "KR" : "US"} ${mk.universe || "—"}종목, 2008·2018·2020 구간).</li>
          <li>대리: 당시 상장 전이거나 이력이 없는 종목은 ${m === "kr" ? "코스피·코스닥 지수" : "섹터 SPDR ETF(XLRE·XLC 는 상장 전 구간이면 SPY)"}의 일별 수익률 × β 로 계산했습니다. β 는 최근 3년 일별 수익률 회귀(상세 이력이 없으면 1 가정, 0~3 으로 제한). 위기 때 실제 β 는 평소와 달라지는 경우가 많아 대리 비중이 클수록 결과를 거칠게 보세요.</li>
          <li>지금 보유한 종목 기준이라 당시 사라진 종목은 없습니다(생존 편향). 과거 재현이지 예측이 아닙니다.</li>
          <li>출처: ${esc(hist.source || "")} · 데이터 기준 ${esc(hist.updatedAtKst || "")}.</li>
        </ul>
      </details>`;
    pane.querySelectorAll("[data-crisis-window]").forEach((b) => b.addEventListener("click", () => {
      crisisSelected = b.dataset.crisisWindow;
      renderCrisis();
    }));
  }

  // =============================================================== 연결
  function onPortfolioRender() {
    if ($("pfRiskFold")?.open) runAlloc(false);
    if (!$("stressCrisisPane")?.hidden) runCrisis(false);
  }

  function setup() {
    if (!$("pfRiskCard") || !core()) return;
    if (!bound) {
      bound = true;
      const p = prefs();
      if (p.source && $("pfRiskSource")) $("pfRiskSource").value = p.source;
      if (p.lookback && $("pfRiskLookback")) $("pfRiskLookback").value = String(p.lookback);
      if (p.cap && $("pfRiskCap")) $("pfRiskCap").value = String(p.cap);
      $("pfRiskFold")?.addEventListener("toggle", () => { if ($("pfRiskFold").open) runAlloc(false); });
      $("pfRiskRun")?.addEventListener("click", () => runAlloc(true));
      ["pfRiskSource", "pfRiskLookback", "pfRiskCap"].forEach((id) => $(id)?.addEventListener("change", () => {
        savePrefs({ source: $("pfRiskSource")?.value, lookback: Number($("pfRiskLookback")?.value), cap: $("pfRiskCap")?.value || "" });
        runAlloc(false);
      }));
      document.querySelectorAll("[data-stress-mode]").forEach((b) => b.addEventListener("click", () => {
        const mode = b.dataset.stressMode === "crisis" ? "crisis" : "preset";
        if (window.safeStorage) window.safeStorage.set(STRESS_MODE_KEY, mode);
        applyStressMode(mode);
      }));
    }
    applyStressMode(stressMode());
    if (!routeApplied) {
      routeApplied = true;
      let params = null;
      try { params = new URLSearchParams(window.location.search); } catch (_) { params = null; }
      const want = params && params.get("pfrisk");
      if (want) {
        // boot 가 ?tab=tools 로 탭을 연 다음에 펼친다.
        setTimeout(() => {
          if (want === "crisis") {
            openFoldOf($("stressTestCard"));
            if (window.safeStorage) window.safeStorage.set(STRESS_MODE_KEY, "crisis");
            applyStressMode("crisis");
            $("stressTestCard")?.scrollIntoView({ block: "start" });
          } else {
            const fold = $("pfRiskFold");
            if (fold) fold.open = true;
            fold?.scrollIntoView({ block: "start" });
            runAlloc(false);
          }
        }, 0);
      }
    }
  }

  // 시장 전환: 반대 시장 결과를 버린다.
  function onMarketChange() {
    allocToken += 1;
    crisisToken += 1;
    lastAlloc = null;
    allocCacheKey = "";
    crisisResult = null;
    crisisCacheKey = "";
    crisisSelected = "";
    const body = $("pfRiskBody");
    if (body) body.innerHTML = "";
    setAllocStatus("");
    const ts = $("backtestTearsheet");
    if (ts) ts.innerHTML = "";
  }

  window.MirPortfolioRisk = { setup, onMarketChange, onPortfolioRender, renderTearsheet, runAlloc, runCrisis };
})();
