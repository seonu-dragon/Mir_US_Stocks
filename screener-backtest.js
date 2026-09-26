// screener-backtest.js — 수식 스크리너 과거 백테스트 화면(종목 탭 › 찾기 › 수식, 결과 위 #fxBacktestSlot)
// =====================================================================
// formula-screener.js 가 수식이 컴파일되면 window.MirFormulaBacktest.render(slot, {compiled, source, market, columns})
// 를 부른다. 여기서는 버튼·설정·결과만 그리고, 계산은 screener-backtest-core.js(MirScreenerBacktestCore)와
// overfit-core.js(MirOverfitCore) — 둘 다 node 테스트가 있다.
//
// 데이터: 메타 data/screener_backtest_meta.js(US) · data/korea/screener_backtest_meta.js(KR)
//   (window.SCREENER_BACKTEST_META, FEATURE_DATA.screenerBacktest, marketSpecific·lazy)
//   + 필드 샤드 data/screener_backtest/<us|kr>/<field>.json — 수식에 쓰인 필드와 fwd 만 fetch.
// 빌더: scripts/build_screener_backtest_panel.mjs (Screener backtest panel 워크플로우, 주 1회).
//
// 원칙: 결과는 서술만(매매 권유 없음). 생존편향 배지는 항상. 시도 횟수를 세어 DSR 로 보정.
// IIFE — 전역에는 window.MirFormulaBacktest 하나만 내놓는다.
(function () {
  "use strict";

  const TRIAL_STORE = "mir.fxbt.trials.v1";
  const shardCache = new Map();   // `${market}|${version}|${field}` → Promise<Float64Array>
  const resultCache = new Map();  // trialKey → { res, meta }
  let trials = loadTrials();      // { us: { key: sharpe }, kr: {...} }
  let lastSlotKey = "";

  function loadTrials() {
    try {
      const raw = window.sessionStorage && window.sessionStorage.getItem(TRIAL_STORE);
      const obj = raw ? JSON.parse(raw) : null;
      if (obj && typeof obj === "object") return { us: obj.us || {}, kr: obj.kr || {} };
    } catch (_) { /* 비공개 창 등 — 메모리로만 센다 */ }
    return { us: {}, kr: {} };
  }
  function saveTrials() {
    try { window.sessionStorage && window.sessionStorage.setItem(TRIAL_STORE, JSON.stringify(trials)); } catch (_) { /* 무시 */ }
  }
  function trialStats(market) {
    const book = trials[market] || {};
    const keys = Object.keys(book);
    return { count: keys.length, sharpes: keys.map((k) => book[k]).filter(Number.isFinite) };
  }

  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const pct = (x, d = 1) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(d)}%`);
  const pctp = (x, d = 2) => (x == null || !Number.isFinite(x) ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%p`);
  const num = (x, d = 2) => (x == null || !Number.isFinite(x) ? "—" : x.toFixed(d));

  function metaFor(market) {
    const m = window.SCREENER_BACKTEST_META;
    return m && m.market === market ? m : null;
  }

  function loadShard(meta, field) {
    const key = `${meta.market}|${meta.version}|${field}`;
    if (shardCache.has(key)) return shardCache.get(key);
    const file = meta.files && meta.files[field];
    if (!file) return Promise.reject(new Error(`샤드 없음: ${field}`));
    const p = fetch(`${file.path}?v=${encodeURIComponent(file.hash)}`, { cache: "no-cache" })
      .then((r) => { if (!r.ok) throw new Error(`${field} ${r.status}`); return r.json(); })
      .then((shard) => {
        if (shard.version !== meta.version) throw new Error("패널이 갱신되는 중입니다 — 새로고침 후 다시 실행하세요.");
        return window.MirScreenerBacktestCore.decodeShard(shard, meta.tickers.length, meta.dates.length);
      });
    p.catch(() => shardCache.delete(key));
    shardCache.set(key, p);
    return p;
  }

  function readSettings(slot) {
    const costPct = Number(slot.querySelector(".fxbt-cost")?.value);
    const minStocks = Number(slot.querySelector(".fxbt-min")?.value);
    return {
      costRate: Number.isFinite(costPct) && costPct >= 0 && costPct <= 5 ? costPct / 100 : 0.001,
      minStocks: Number.isFinite(minStocks) && minStocks >= 1 && minStocks <= 100 ? Math.floor(minStocks) : 5,
    };
  }

  // ---------- 진입점 ----------
  function render(slot, opts) {
    if (!slot || !opts || !opts.compiled || !window.MirScreenerBacktestCore || !window.MirOverfitCore) return;
    const market = opts.market === "kr" ? "kr" : "us";
    const meta = metaFor(market);
    const prevSettings = slot.querySelector(".fxbt-cost") ? readSettings(slot) : { costRate: 0.001, minStocks: 5 };
    const slotKey = `${market}|${opts.source}`;
    const sameFormula = slotKey === lastSlotKey;
    lastSlotKey = slotKey;
    if (!meta) {
      slot.innerHTML = `<div class="fxbt"><p class="muted fxbt-note">과거 백테스트 패널을 불러오는 중…</p></div>`;
      if (typeof ensureFeatureData === "function") {
        ensureFeatureData("screenerBacktest").then((ok) => {
          if (lastSlotKey !== slotKey || !slot.isConnected) return;
          if (ok && metaFor(market)) render(slot, opts);
          else slot.innerHTML = `<div class="fxbt"><p class="muted fxbt-note">과거 백테스트 패널이 아직 없습니다(주간 빌더가 만들기 전). 현재 목록은 과거 검증되지 않은 결과입니다.</p></div>`;
        });
      }
      return;
    }
    const core = window.MirScreenerBacktestCore;
    const missing = core.missingFields(opts.compiled, meta);
    const settings = sameFormula ? prevSettings : { costRate: 0.001, minStocks: 5 };
    const ts = trialStats(market);
    const reasonOf = (f) => (meta.noHistory && meta.noHistory[f]) || "과거 시점 값을 만들지 않은 필드입니다";
    slot.innerHTML = `<section class="fxbt" aria-label="과거 백테스트">
      <div class="fxbt-head">
        <h4>과거 백테스트 <span class="muted">(월 리밸런싱 · ${esc(meta.dates[0])}~${esc(meta.periodEnd || "")})</span></h4>
        <span class="fxbt-badge is-survivor" title="${esc("현재 상장 종목만 들어 있어 상장폐지된 종목의 손실이 빠져 있습니다 — 모든 결과가 실제보다 좋게 나옵니다.")}">생존편향 있음 · 성과 과대</span>
      </div>
      <p class="muted fxbt-note">매월 마지막 거래일에 이 수식을 적용해 통과 종목을 같은 비중으로 샀다고 가정한 과거 결과입니다. 정보 제공용이며 매매 권유가 아닙니다. 과거 성과는 미래를 보장하지 않습니다.</p>
      ${missing.length ? `<div class="fxbt-missing" role="note"><b>이 필드는 과거 값이 없어 백테스트할 수 없습니다.</b><ul>${missing.map((f) => `<li><code>${esc(f)}</code> — ${esc(reasonOf(f))}</li>`).join("")}</ul><p class="muted">과거 값이 있는 필드: ${esc(Object.keys(meta.fields).join(", "))}</p></div>`
        : `<div class="fxbt-controls">
          <label>거래비용(편도 %)<input class="fxbt-cost" type="number" min="0" max="5" step="0.05" value="${esc(String(+(settings.costRate * 100).toFixed(3)))}" inputmode="decimal"></label>
          <label>최소 종목 수<input class="fxbt-min" type="number" min="1" max="100" step="1" value="${esc(String(settings.minStocks))}" inputmode="numeric"></label>
          <button type="button" class="fxbt-run">과거 백테스트 실행</button>
          <span class="muted fxbt-trials" title="이 탭에서 서로 다른 수식·설정으로 돌린 횟수 — Deflated Sharpe Ratio 보정에 쓴다">이 탭 시도 ${ts.count}회</span>
        </div>`}
      <div class="fxbt-result" aria-live="polite"></div>
    </section>`;
    if (missing.length) return;
    const btn = slot.querySelector(".fxbt-run");
    btn.addEventListener("click", () => runAndShow(slot, opts, meta));
    // 같은 수식·설정으로 이미 돌린 결과가 있으면 다시 보여 준다(시도 수는 늘리지 않는다).
    const key = core.trialKey(market, opts.source, settings.costRate, settings.minStocks);
    const cached = resultCache.get(key);
    if (cached && cached.meta.version === meta.version) showResult(slot, cached.res, meta, market);
  }

  async function runAndShow(slot, opts, meta) {
    const core = window.MirScreenerBacktestCore;
    const out = slot.querySelector(".fxbt-result");
    const btn = slot.querySelector(".fxbt-run");
    const market = meta.market;
    const settings = readSettings(slot);
    const compiled = opts.compiled;
    const key = core.trialKey(market, opts.source, settings.costRate, settings.minStocks);
    if (btn) btn.disabled = true;
    out.innerHTML = `<p class="muted">과거 패널 불러오는 중(필드 ${compiled.fields.length + 1}개)…</p>`;
    try {
      const fields = compiled.fields.slice();
      const [fwd, ...cols] = await Promise.all([loadShard(meta, "fwd"), ...fields.map((f) => loadShard(meta, f))]);
      const columns = {};
      fields.forEach((f, i) => { columns[f] = cols[i]; });
      const res = core.run({ meta, columns, fwd, compiled, formulaCore: window.MirFormulaCore, costRate: settings.costRate, minStocks: settings.minStocks });
      if (!res.months) throw new Error("수식에 쓰인 필드의 과거 값이 있는 기간이 없습니다.");
      // 시도 기록: 같은 수식·설정은 한 번만 센다. 기록하는 Sharpe 는 월 초과수익(전략 − 비교 기준)의 Sharpe.
      const book = trials[market] || (trials[market] = {});
      if (!(key in book)) {
        const sr = window.MirOverfitCore.sharpe(res.excess);
        book[key] = Number.isFinite(sr) ? sr : null;
        saveTrials();
      }
      resultCache.set(key, { res, meta });
      if (!slot.isConnected) return;
      const tEl = slot.querySelector(".fxbt-trials");
      if (tEl) tEl.textContent = `이 탭 시도 ${trialStats(market).count}회`;
      showResult(slot, res, meta, market);
    } catch (err) {
      out.innerHTML = `<p class="fxbt-error">백테스트를 실행하지 못했습니다: ${esc(err && err.message || err)}</p>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ---------- 결과 ----------
  function showResult(slot, res, meta, market) {
    const out = slot.querySelector(".fxbt-result");
    if (!out) return;
    const of = window.MirOverfitCore;
    const ts = trialStats(market);
    const s = res.metrics.strategy, e = res.metrics.ew, b = res.metrics.bench;
    // 판정은 볼 때마다 지금의 시도 횟수로 다시 계산한다 — 조건을 더 바꿔 볼수록 기준선이 올라간다.
    const v = of.verdict(res.excess, { trials: Math.max(1, ts.count), trialSharpes: ts.sharpes, avgHoldings: s.avgHoldings, periodsPerYear: meta.periodsPerYear || 12 });
    const badgeCls = v.key === "pass" ? "is-pass" : v.key === "overfit" ? "is-overfit" : "is-insufficient";
    const benchLabel = (meta.benchmark && meta.benchmark.label) || "벤치마크";
    const ds = v.dsr, bs = v.bootstrap, sp = v.split;
    const ppy = meta.periodsPerYear || 12;
    const costLabel = `거래비용 편도 ${(res.costRate * 100).toFixed(2)}% 반영`;
    const universeNote = `백테스트 유니버스 ${meta.tickers.length.toLocaleString()}종목(실측 일봉이 있고 ${meta.minTradingValueLabel || "거래대금 기준"}을 넘는 달만 편입) · 달마다 평균 ${Math.round(e.avgUniverse || 0).toLocaleString()}종목, 그중 수식 필드 값이 있는 종목 평균 ${Math.round(e.avgHoldings || 0).toLocaleString()}종목`;
    out.innerHTML = `
      <div class="fxbt-verdict">
        <span class="fxbt-badge ${badgeCls}">과적합 검사: ${esc(v.label)}</span>
        <span class="fxbt-badge is-survivor">생존편향: 상장폐지 종목 없음</span>
        <span class="muted fxbt-verdict-why">${esc(v.reasons.join(" · "))}</span>
      </div>
      <p class="fxbt-summary">${esc(window.MirScreenerBacktestCore.describe(res, { cost: costLabel }))} 과거 성과는 미래를 보장하지 않습니다.</p>
      ${chartSvg(res, benchLabel, out.clientWidth || (slot.clientWidth - 28))}
      <div class="table-wrap"><table class="compact-table fxbt-table">
        <thead><tr><th></th><th class="num">이 조건</th><th class="num">비교 기준<br><span class="muted">같은 유니버스 동일가중</span></th><th class="num">${esc(benchLabel)}</th></tr></thead>
        <tbody>
          <tr><th>연환산 수익률</th><td class="num">${pct(s.cagr)}</td><td class="num">${pct(e.cagr)}</td><td class="num">${pct(b.cagr)}</td></tr>
          <tr><th>누적 수익률</th><td class="num">${pct(s.total)}</td><td class="num">${pct(e.total)}</td><td class="num">${pct(b.total)}</td></tr>
          <tr><th>변동성(연)</th><td class="num">${pct(s.vol)}</td><td class="num">${pct(e.vol)}</td><td class="num">${pct(b.vol)}</td></tr>
          <tr><th>최대 낙폭(월말 기준)</th><td class="num">${pct(s.mdd)}</td><td class="num">${pct(e.mdd)}</td><td class="num">${pct(b.mdd)}</td></tr>
          <tr><th>샤프(무위험 0, 연)</th><td class="num">${num(s.sharpe)}</td><td class="num">${num(e.sharpe)}</td><td class="num">${num(b.sharpe)}</td></tr>
          <tr><th>평균 보유 종목</th><td class="num">${num(s.avgHoldings, 1)}</td><td class="num">${num(e.avgHoldings, 0)}</td><td class="num">1</td></tr>
          <tr><th>회전율(연, 편도)</th><td class="num">${pct(s.turnoverAnnual, 0)}</td><td class="num">—</td><td class="num">—</td></tr>
          <tr><th>현금 보유 개월</th><td class="num">${s.cashMonths} / ${res.months}</td><td class="num">—</td><td class="num">—</td></tr>
        </tbody>
      </table></div>
      <div class="fxbt-overfit">
        <h5>과적합 검사</h5>
        <div class="table-wrap"><table class="compact-table fxbt-table">
          <thead><tr><th>구간</th><th class="num">개월</th><th class="num">월 초과수익 평균</th><th class="num">연환산</th></tr></thead>
          <tbody>
            <tr><th>앞 70% (${esc(res.periods[0]?.execDate || "")}~)</th><td class="num">${sp.inMonths}</td><td class="num">${pctp(sp.inMean)}</td><td class="num">${pctp(sp.inAnn, 1)}</td></tr>
            <tr><th>뒤 30% (${esc(res.periods[sp.cut]?.execDate || "")}~)</th><td class="num">${sp.outMonths}</td><td class="num">${pctp(sp.outMean)}</td><td class="num">${pctp(sp.outAnn, 1)}</td></tr>
          </tbody>
        </table></div>
        <ul class="fxbt-stats">
          <li>블록 부트스트랩 95% 신뢰구간(월 초과수익 평균, 블록 ${bs.blockLen ?? "—"}개월 · ${bs.B}회): <b>${pctp(bs.lo)} ~ ${pctp(bs.hi)}</b></li>
          <li>Deflated Sharpe Ratio: <b>${num(ds.dsr)}</b> (보정 전 PSR ${num(ds.psr)} · 이 탭 시도 ${ds.trials}회 · 기준선 SR₀ ${num(ds.sr0, 3)}/월 · 초과수익 샤프 ${num(ds.sr, 3)}/월 · 표본 ${ds.n}개월)</li>
          <li>표본: ${res.months}개월(${esc(res.startDate || "")}~${esc(res.endDate || "")}). 필드 값이 충분히 쌓인 달부터 시작합니다(52주 필드는 약 1년 뒤부터).</li>
        </ul>
        <details class="fxbt-fold"><summary>배지 판정 기준</summary><ul>${of.CRITERIA.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></details>
      </div>
      <details class="fxbt-fold"><summary>계산 규칙과 한계</summary>
        <ul>${(meta.rules || []).map((r) => `<li>${esc(r)}</li>`).join("")}
          <li>${esc(universeNote)}. 현재 스크리너 모집단과 종목 구성이 달라 순위(rank)·백분위(pct) 함수 값도 현재 화면과 다릅니다.</li>
          <li>재무 필드는 현재 재무 파일이 있는 종목에만 있어(지금 살아남은 회사) 비교 기준을 같은 종목들로 맞췄습니다. 섹터·업종은 현재 분류를 과거에 그대로 씁니다.</li>
          <li>최대 낙폭은 월말 값으로만 재서 실제 장중·일간 낙폭보다 작게 나옵니다. 벤치마크는 배당을 뺀 가격 수익률이며 비용을 넣지 않았습니다.</li>
        </ul>
        <p class="muted">출처: ${esc(meta.source || "")} · 패널 갱신 ${esc(meta.updatedAtKst || "")}</p>
      </details>`;
  }

  // 누적 곡선 SVG(이 조건 · 비교 기준 · 벤치마크). 장식 없이 선 3개 + 기준선 1.
  // 폭은 그릴 자리의 실제 픽셀 폭으로 잡는다(viewBox 를 늘려 쓰면 글자가 가로로 늘어난다).
  function chartSvg(res, benchLabel, width) {
    const W = Math.max(280, Math.min(1400, Math.round(width || 640))), H = W < 480 ? 170 : 210, L = 40, R = 8, T = 10, B = 22;
    const series = [
      { key: "strategy", label: "이 조건", cls: "s1", vals: [1, ...res.series.strategy] },
      { key: "ew", label: "비교 기준(동일가중)", cls: "s2", vals: [1, ...res.series.ew] },
      { key: "bench", label: benchLabel, cls: "s3", vals: [1, ...res.series.bench] },
    ];
    const all = series.flatMap((s) => s.vals).filter(Number.isFinite);
    let lo = Math.min(...all, 1), hi = Math.max(...all, 1);
    if (hi - lo < 0.05) { hi += 0.025; lo -= 0.025; }
    const n = series[0].vals.length;
    const x = (i) => L + ((W - L - R) * i) / Math.max(1, n - 1);
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const ticks = [lo, 1, hi].filter((v, i, a) => a.indexOf(v) === i);
    const labels = [res.periods[0]?.execDate || "", res.endDate || ""];
    return `<figure class="fxbt-chart">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="누적 수익 비교(시작 = 1)">
        ${ticks.map((v) => `<line class="grid${v === 1 ? " base" : ""}" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"></line><text class="ax" x="${L - 4}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(2)}</text>`).join("")}
        ${series.map((s) => `<path class="ln ${s.cls}" d="${path(s.vals)}"></path>`).join("")}
        <text class="ax" x="${L}" y="${H - 6}">${esc(labels[0])}</text>
        <text class="ax" x="${W - R}" y="${H - 6}" text-anchor="end">${esc(labels[1])}</text>
      </svg>
      <figcaption>${series.map((s) => `<span class="lg ${s.cls}"><i></i>${esc(s.label)} ${pct(s.vals[s.vals.length - 1] - 1)}</span>`).join("")}<span class="muted">시작 = 1 · 월말 값</span></figcaption>
    </figure>`;
  }

  window.MirFormulaBacktest = { render };
})();
