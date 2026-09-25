// 적립식(주식 모으기) 시뮬레이터 — 화면(내 투자 › 도구).
// 계산은 dca-core.js(window.MirDcaCore, node 테스트 대상)가 하고, 이 파일은 입력·가격 이력
// 로드·렌더만 맡는다. 가격 이력은 포트폴리오 시뮬레이터와 같은 경로(loadStockDetail →
// 상세 JSON chartSeries, 없으면 워커 차트 프록시)를 쓴다.
// IIFE — 최상위 이름을 흘리지 않는다. 밖에서 쓰는 건 window.MirDca 뿐.
(function () {
  "use strict";

  const MAX_ASSETS = 5;
  const COLORS = { value: "#2563eb", invested: "#64748b", lump: "#d97706", bench: "#94a3b8" };
  const WEEKDAY_LABELS = ["", "월", "화", "수", "목", "금"];

  let assets = []; // [{ ticker, weight }]
  let running = false;
  let bound = false;
  let routeApplied = false;
  let lastResult = null;
  let divCheckToken = 0;

  const core = () => window.MirDcaCore;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s ?? "")) : String(s ?? ""));
  const cfg = () => marketCfg();
  const money = (v) => (Number.isFinite(v) ? cfg().formatMoneyWhole(v) : "—");
  const price = (v) => (Number.isFinite(v) && v > 0 ? cfg().formatPrice(v) : "—");
  const pct = (v) => (Number.isFinite(v) ? fmtPct(v) : "—");
  const isKr = () => cfg().id === "kr";

  function setStatus(text) {
    const el = $("dcaStatus");
    if (el) el.textContent = text || "";
  }

  function label(ticker) {
    try { return stockLabel(ticker); } catch (_) { return ticker; }
  }

  function snapshotEnd() {
    if (typeof backtestSnapshotEndDate === "function") return backtestSnapshotEndDate();
    return new Date().toISOString().slice(0, 10);
  }

  function defaultAmount() {
    return isKr() ? 500000 : 500;
  }

  // ----- 종목·비중 -----
  function renderAssets() {
    const box = $("dcaAssets");
    if (!box) return;
    if (!assets.length) {
      box.innerHTML = `<p class="muted dca-empty">종목을 추가하세요. 여러 종목이면 비중대로 나눠 삽니다(최대 ${MAX_ASSETS}개).</p>`;
    } else {
      box.innerHTML = assets.map((a, i) => `
        <div class="dca-asset-row" data-i="${i}">
          <span class="dca-asset-name" title="${esc(a.ticker)}">${esc(label(a.ticker))}</span>
          ${assets.length > 1 ? `<label class="dca-weight">비중<input type="number" min="0" max="100" step="1" value="${esc(a.weight)}" data-weight="${i}" aria-label="${esc(label(a.ticker))} 비중(%)"><em>%</em></label>` : ""}
          <button type="button" class="ghost compact-btn" data-remove="${i}" aria-label="${esc(label(a.ticker))} 빼기">✕</button>
        </div>`).join("");
    }
    box.querySelectorAll("[data-remove]").forEach((btn) => btn.addEventListener("click", () => {
      assets.splice(Number(btn.dataset.remove), 1);
      rebalanceEqual();
      renderAssets();
      refreshDividendAvailability();
    }));
    box.querySelectorAll("[data-weight]").forEach((input) => input.addEventListener("input", () => {
      const i = Number(input.dataset.weight);
      const v = Number(input.value);
      if (assets[i]) assets[i].weight = Number.isFinite(v) && v >= 0 ? v : 0;
    }));
  }

  function rebalanceEqual() {
    if (!assets.length) return;
    const each = Math.floor(100 / assets.length);
    assets.forEach((a, i) => { a.weight = i === assets.length - 1 ? 100 - each * (assets.length - 1) : each; });
  }

  function addTicker(raw) {
    const resolved = typeof raw === "string" ? (resolveTickerListInput(raw.trim())[0] || null) : raw;
    if (!resolved) { setStatus("유효한 종목을 입력하세요."); return false; }
    const ticker = String(resolved);
    if (assets.some((a) => a.ticker === ticker)) { setStatus(`${label(ticker)}는 이미 추가되어 있습니다.`); return false; }
    if (assets.length >= MAX_ASSETS) { setStatus(`최대 ${MAX_ASSETS}개까지 추가할 수 있습니다.`); return false; }
    assets.push({ ticker, weight: 0 });
    rebalanceEqual();
    renderAssets();
    setStatus("");
    refreshDividendAvailability();
    return true;
  }

  function setAssets(list) {
    assets = [];
    (list || []).forEach((item) => {
      const ticker = normalizeTickerKey(item.ticker);
      if (!ticker || assets.some((a) => a.ticker === ticker) || assets.length >= MAX_ASSETS) return;
      assets.push({ ticker, weight: Number(item.weight) > 0 ? Number(item.weight) : 0 });
    });
    if (assets.length && assets.every((a) => !(a.weight > 0))) rebalanceEqual();
    renderAssets();
    refreshDividendAvailability();
  }

  // ----- 입력 -----
  function syncFreqUi() {
    const freq = $("dcaFreq")?.value || "monthly";
    const md = $("dcaMonthDayWrap");
    const wd = $("dcaWeekdayWrap");
    if (md) md.hidden = freq !== "monthly";
    if (wd) wd.hidden = freq !== "weekly";
  }

  function populateBenchmarks() {
    const sel = $("dcaBenchmark");
    if (!sel) return;
    const opts = (cfg().backtestBenchmarks || []).filter(([t]) => stockByTicker(t));
    const prev = sel.value;
    sel.innerHTML = `<option value="">비교 안 함</option>` + opts.map(([t, name]) => {
      const nm = label(t);
      const text = name.includes(nm) ? name : `${nm} · ${name}`;
      return `<option value="${esc(t)}">${esc(text)}</option>`;
    }).join("");
    if (prev && opts.some(([t]) => t === prev)) sel.value = prev;
    else sel.value = opts[0] ? opts[0][0] : "";
  }

  function applyMarketDefaults(force) {
    const amount = $("dcaAmount");
    const cur = $("dcaCurrency");
    if (cur) cur.textContent = isKr() ? "(원)" : "(USD)";
    if (amount && (force || amount.dataset.market !== cfg().id)) {
      amount.value = String(defaultAmount());
      amount.step = isKr() ? "10000" : "10";
      amount.dataset.market = cfg().id;
    }
    const frac = $("dcaFractional");
    if (frac && (force || frac.dataset.market !== cfg().id)) {
      // 국내는 소수점 거래가 제한적이라 정수 주가 기본. 미국은 소수점 매수가 흔하다.
      frac.checked = !isKr();
      frac.dataset.market = cfg().id;
    }
  }

  function applyDefaultDates(force) {
    const s = $("dcaStart");
    const e = $("dcaEnd");
    if (!s || !e) return;
    const end = snapshotEnd();
    const min = core().addYears(end, -5);
    [s, e].forEach((el) => { el.min = min; el.max = end; });
    if (force || !e.value) e.value = end;
    if (force || !s.value) s.value = core().addYears(end, -3);
  }

  function readForm() {
    const freq = $("dcaFreq")?.value || "monthly";
    const mdRaw = $("dcaMonthDay")?.value || "1";
    return {
      freq,
      monthDay: mdRaw === "last" ? "last" : Number(mdRaw) || 1,
      weekday: Number($("dcaWeekday")?.value) || 1,
      amount: Number($("dcaAmount")?.value),
      start: $("dcaStart")?.value || "",
      end: $("dcaEnd")?.value || "",
      reinvest: !!$("dcaReinvest")?.checked,
      fractional: !!$("dcaFractional")?.checked,
      benchmark: $("dcaBenchmark")?.value || "",
    };
  }

  function freqLabel(f) {
    if (f.freq === "daily") return "매 거래일";
    if (f.freq === "weekly") return `매주 ${WEEKDAY_LABELS[f.weekday] || "월"}요일`;
    return f.monthDay === "last" ? "매월 마지막 거래일" : `매월 ${f.monthDay}일`;
  }

  // ----- 가격 이력 -----
  async function loadSeries(ticker) {
    const stock = stockByTicker(ticker);
    const detail = await loadStockDetail(ticker);
    const merged = detail ? { ...(stock || { ticker }), ...detail } : stock;
    if (!merged) return { ticker, ok: false, reason: "종목 정보를 찾지 못했습니다" };
    if (isSyntheticChart(merged)) return { ticker, ok: false, reason: "실제 일봉 이력이 없습니다" };
    const rows = getChartRows(merged).filter((r) => r.d && Number.isFinite(r.c) && r.c > 0);
    if (rows.length < 30) return { ticker, ok: false, reason: "일봉 이력이 너무 짧습니다" };
    const map = new Map(rows.map((r) => [r.d, r.c]));
    return {
      ticker,
      ok: true,
      dates: [...map.keys()].sort(),
      map,
      // 상세 파일의 dividends 는 야후 배당 이벤트([배당락일, 주당 금액], 분할 반영).
      // 키 자체가 없으면(워커 실시간 폴백·수집 누락) 배당 데이터가 없는 것 — 0 으로 보지 않는다.
      dividends: Array.isArray(merged.dividends) ? merged.dividends : null,
    };
  }

  // 배당 재투자 체크박스: 배당 데이터가 있는 종목이 하나라도 있어야 켤 수 있다.
  async function refreshDividendAvailability() {
    const box = $("dcaReinvest");
    const note = $("dcaDivNote");
    if (!box || !note) return;
    const token = ++divCheckToken;
    if (!assets.length) { box.disabled = false; note.textContent = ""; return; }
    const infos = await Promise.all(assets.map(async (a) => {
      const detail = await loadStockDetail(a.ticker);
      return { ticker: a.ticker, has: !!detail && Array.isArray(detail.dividends) };
    }));
    if (token !== divCheckToken) return;
    const missing = infos.filter((x) => !x.has);
    if (missing.length === infos.length) {
      box.checked = false;
      box.disabled = true;
      note.textContent = "배당 이력 데이터가 없어 재투자를 선택할 수 없습니다 — 가격 기준으로만 계산합니다.";
    } else {
      box.disabled = false;
      note.textContent = missing.length
        ? `배당 이력 없음: ${missing.map((x) => label(x.ticker)).join(", ")} (가격만 반영)`
        : "";
    }
  }

  // ----- 실행 -----
  async function run() {
    if (running) return;
    const C = core();
    if (!C) return;
    const f = readForm();
    const resultsBox = $("dcaResults");
    const fail = (msg) => { setStatus(msg); if (resultsBox) resultsBox.hidden = true; };
    if (!assets.length) return fail("종목을 하나 이상 추가하세요.");
    if (!(f.amount > 0)) return fail("회당 금액을 입력하세요.");
    if (!C.isIso(f.start) || !C.isIso(f.end)) return fail("시작일과 종료일을 선택하세요.");
    if (f.start >= f.end) return fail("시작일이 종료일보다 앞이어야 합니다.");
    const weights = assets.map((a) => (assets.length === 1 ? 100 : Number(a.weight) || 0));
    if (!(weights.reduce((s, w) => s + w, 0) > 0)) return fail("비중 합계가 0보다 커야 합니다.");
    running = true;
    setStatus("가격 이력을 불러오는 중…");
    if (resultsBox) resultsBox.hidden = true;
    try {
      const warnings = [];
      const loaded = await Promise.all(assets.map((a) => loadSeries(a.ticker)));
      loaded.filter((s) => !s.ok).forEach((s) => warnings.push(`${label(s.ticker)}: ${s.reason} — 제외했습니다.`));
      const valid = [];
      loaded.forEach((s, i) => { if (s.ok && weights[i] > 0) valid.push({ ...s, weight: weights[i] }); });
      if (!valid.length) return fail(warnings.join(" ") || "계산할 수 있는 종목이 없습니다.");
      const calendar = C.commonDates(valid.map((s) => s.dates));
      if (calendar.length < 2) return fail("종목들의 공통 거래일을 찾지 못했습니다.");
      let start = f.start;
      let end = f.end;
      if (start < calendar[0]) {
        warnings.push(`가격 이력이 ${calendar[0]}부터 있어 시작일을 그날로 맞췄습니다.`);
        start = calendar[0];
      }
      if (end > calendar[calendar.length - 1]) end = calendar[calendar.length - 1];
      const dates = calendar.filter((d) => d >= start && d <= end);
      if (dates.length < 2) return fail("선택한 기간에 거래일이 부족합니다.");
      const schedule = C.buildSchedule(dates, { freq: f.freq, monthDay: f.monthDay, weekday: f.weekday, start, end });
      if (!schedule.length) return fail("선택한 기간에 매수일이 없습니다. 기간이나 주기를 바꿔 보세요.");
      const mode = f.reinvest ? "reinvest" : "cash";
      const simAssets = valid.map((s) => ({ key: s.ticker, prices: C.alignCloses(s.map, dates), dividends: s.dividends, weight: s.weight }));
      const input = { dates, schedule, amount: f.amount, fractional: f.fractional, dividendMode: mode, assets: simAssets };
      const res = C.simulateDca(input);
      if (!res) return fail("시뮬레이션을 계산하지 못했습니다.");
      const lump = C.simulateLumpSum(input, res.invested, schedule[0].date);
      let bench = null;
      let benchNote = "";
      if (f.benchmark && !valid.some((s) => s.ticker === f.benchmark && valid.length === 1)) {
        const b = await loadSeries(f.benchmark);
        if (b.ok) {
          const bDates = b.dates.filter((d) => d >= start && d <= end);
          const bSchedule = C.buildSchedule(bDates, { freq: f.freq, monthDay: f.monthDay, weekday: f.weekday, start, end });
          if (bDates.length >= 2 && bSchedule.length) {
            bench = C.simulateDca({
              dates: bDates, schedule: bSchedule, amount: f.amount, fractional: f.fractional, dividendMode: mode,
              assets: [{ key: b.ticker, prices: C.alignCloses(b.map, bDates), dividends: b.dividends, weight: 1 }],
            });
            if (bench) bench.ticker = b.ticker;
          }
          if (!bench) benchNote = `${label(f.benchmark)}: 같은 기간 가격 이력이 부족해 비교를 생략했습니다.`;
        } else {
          benchNote = `${label(f.benchmark)}: ${b.reason} — 비교를 생략했습니다.`;
        }
      }
      if (benchNote) warnings.push(benchNote);
      const shifted = schedule.filter((s) => s.shifted).length;
      const merged = schedule.filter((s) => s.count > 1).length;
      valid.forEach((s) => {
        if (!s.dividends && f.reinvest) warnings.push(`${label(s.ticker)}: 배당 이력 데이터가 없어 가격만 반영했습니다.`);
      });
      if (!f.fractional) {
        const zero = res.assets.filter((a) => !(a.shares > 0));
        zero.forEach((a) => warnings.push(`${label(a.key)}: 회당 배정 금액이 주가보다 작아 한 주도 사지 못했습니다(돈은 현금으로 남아 있습니다). 금액을 늘리거나 소수점 매수를 켜 보세요.`));
      }
      lastResult = { f, start, end, res, lump, bench, schedule, shifted, merged, warnings, tickers: valid.map((s) => s.ticker) };
      render(lastResult);
      setStatus("");
    } catch (err) {
      console.warn("dca simulation failed", err);
      fail("시뮬레이션 중 오류가 발생했습니다.");
    } finally {
      running = false;
    }
  }

  // ----- 렌더 -----
  function metric(title, value, klass, sub) {
    return `<article class="backtest-metric"><span>${esc(title)}</span><strong class="${klass || ""}">${value}</strong>${sub ? `<em class="dca-metric-sub">${esc(sub)}</em>` : ""}</article>`;
  }

  function fmtShares(n, fractional) {
    if (!Number.isFinite(n)) return "—";
    if (!fractional) return `${Math.round(n).toLocaleString("ko-KR")}주`;
    return `${n.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}주`;
  }

  function render(state) {
    const { f, res, lump, bench, schedule, shifted, merged, warnings, tickers } = state;
    const box = $("dcaResults");
    if (!box) return;
    const days = core().daysBetween(res.startDate, res.endDate);
    const shortPeriod = days < 365;
    $("dcaSummary").innerHTML = [
      metric("총 투자금", money(res.invested), "is-money", `${res.contributions}회 × ${money(f.amount)}`),
      metric("평가액", money(res.finalValue), `is-money ${cls(res.profit)}`),
      metric("수익금", `${res.profit >= 0 ? "+" : ""}${money(res.profit)}`, `is-money ${cls(res.profit)}`),
      metric("총수익률", pct(res.totalReturnPct), cls(res.totalReturnPct), "평가액 ÷ 투자금"),
      metric("연환산 (XIRR)", pct(res.xirrPct), cls(res.xirrPct), "납입 시점별 금액가중"),
      metric("최대 낙폭", pct(res.mddPct), cls(res.mddPct), "적립금 유입을 뺀 시간가중"),
      metric("최저 평가수익률", pct(res.minReturnPct), cls(res.minReturnPct), "기간 중 평가액÷누적투자금 최저"),
    ].join("");

    // 적립식 · 거치식 · 지수 적립식 비교
    const rows = [
      { name: `적립식 · ${tickers.map(label).join(", ")}`, r: res, ann: res.xirrPct, annLabel: "XIRR" },
      lump ? { name: "거치식 · 같은 총액 첫 매수일 일괄", r: lump, ann: lump.cagrPct, annLabel: "CAGR" } : null,
      bench ? { name: `지수 적립식 · ${label(bench.ticker)}`, r: bench, ann: bench.xirrPct, annLabel: "XIRR" } : null,
    ].filter(Boolean);
    $("dcaCompare").innerHTML = `
      <table class="backtest-table dca-compare-table">
        <caption class="backtest-meta">같은 기간 비교 · ${esc(res.startDate)} → ${esc(res.endDate)}</caption>
        <thead><tr><th>방식</th><th>투자금</th><th>평가액</th><th>총수익률</th><th>연환산</th><th>최대 낙폭</th></tr></thead>
        <tbody>${rows.map((row) => `
          <tr>
            <td>${esc(row.name)}</td>
            <td>${money(row.r.invested)}</td>
            <td class="${cls(row.r.profit)}">${money(row.r.finalValue)}</td>
            <td class="${cls(row.r.totalReturnPct)}">${pct(row.r.totalReturnPct)}</td>
            <td class="${cls(row.ann)}">${pct(row.ann)} <span class="muted">${row.annLabel}</span></td>
            <td class="${cls(row.r.mddPct)}">${pct(row.r.mddPct)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      ${bench && Math.abs(bench.invested - res.invested) > 0.5 ? `<p class="muted dca-footnote">지수 쪽은 지수 ETF 의 거래일로 같은 일정을 적용해 납입 횟수가 다를 수 있습니다(${bench.contributions}회).</p>` : ""}`;

    $("dcaTable").innerHTML = `
      <thead><tr><th>종목</th><th>비중</th><th>보유 수량</th><th>평균 매수단가</th><th>종료일 종가</th><th>평가액</th><th>납입 대비</th><th>배당</th><th>남은 현금</th></tr></thead>
      <tbody>${res.assets.map((a) => {
        const valueAll = a.marketValue + a.cash + a.dividendCash;
        const ret = a.contributed > 0 ? (valueAll / a.contributed - 1) * 100 : null;
        const div = !a.hasDividendData ? `<span class="muted">데이터 없음</span>`
          : `${money(a.dividendsReceived)} <span class="muted">${f.reinvest ? "재투자" : "현금"}</span>`;
        return `<tr>
          <td><button type="button" class="ticker-link" data-ticker="${esc(a.key)}">${esc(label(a.key))}</button></td>
          <td>${(a.weight * 100).toFixed(0)}%</td>
          <td>${fmtShares(a.shares, f.fractional)}</td>
          <td>${price(a.avgCost)}</td>
          <td>${price(a.lastPrice)}</td>
          <td>${money(a.marketValue)}</td>
          <td class="${cls(ret)}">${pct(ret)}</td>
          <td>${div}</td>
          <td>${money(a.cash + a.dividendCash)}</td>
        </tr>`;
      }).join("")}</tbody>`;
    $("dcaTable").querySelectorAll(".ticker-link").forEach((btn) => btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true })));

    const notes = [];
    if (shifted) notes.push(`예정일이 휴장이던 ${shifted}회는 다음 거래일 종가로 샀습니다.`);
    if (merged) notes.push(`긴 휴장·데이터 공백으로 ${merged}개 거래일에 두 회분 이상을 한 번에 샀습니다.`);
    if (!f.fractional) notes.push("정수 주만 사고, 남는 돈은 현금으로 두었다가 다음 회차에 합쳐 삽니다(평가액에 포함).");
    if (shortPeriod) notes.push("기간이 1년 미만이라 연환산 수치가 크게 과장될 수 있습니다.");
    $("dcaWarn").innerHTML = [...warnings, ...notes].length
      ? `<p class="backtest-warn">${[...warnings, ...notes].map(esc).join(" ")}</p>` : "";
    $("dcaNotes").innerHTML = `
      <strong>계산 기준:</strong> ${esc(freqLabel(f))} ${esc(money(f.amount))}씩, 매수가는 매수일 종가(야후 일봉, 액면분할 반영).
      배당은 ${f.reinvest ? "배당락일 종가로 재투자" : "현금으로 받아 평가액에 포함(재투자 안 함)"} — 배당 이력이 없는 종목은 가격만 반영합니다.
      데이터 기준: ${esc(res.endDate)} 종가.
      연환산은 적립식이 XIRR(납입 시점별 금액가중), 거치식은 CAGR 입니다 — 적립식에 CAGR 을 쓰면 늦게 들어간 돈까지 전 기간 굴린 것으로 계산돼 틀립니다.
      최대 낙폭은 적립금 유입 효과를 뺀 시간가중 수익률 기준입니다.
      <br><strong>유의:</strong> 과거 수익이 미래 수익을 보장하지 않습니다. 세금·수수료·환전 비용은 반영하지 않았고, 현재 상장된 종목만 계산할 수 있어 생존 편향이 있습니다. 투자 권유가 아닌 참고 정보입니다.`;
    box.hidden = false; // 먼저 보여야 차트 폭(clientWidth)을 잰다
    drawChart(state);
  }

  function axisMoney(v) {
    if (!Number.isFinite(v)) return "";
    if (isKr()) {
      if (Math.abs(v) >= 1e7) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억`; // 축 폭 절약: 8,005만 → 0.8억
      if (Math.abs(v) >= 1e4) return `${Math.round(v / 1e4).toLocaleString("ko-KR")}만`;
      return `${Math.round(v)}`;
    }
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`;
    return `$${Math.round(v)}`;
  }

  function mapByDate(series, dates, key) {
    if (!series) return null;
    const m = new Map(series.series.map((p) => [p.d, p[key]]));
    let last = null;
    return dates.map((d) => {
      if (m.has(d)) last = m.get(d);
      return last;
    });
  }

  function drawChart(state) {
    const svg = $("dcaChart");
    if (!svg) return;
    const { res, lump, bench } = state;
    const pts = res.series;
    const dates = pts.map((p) => p.d);
    const value = pts.map((p) => p.value);
    const invested = pts.map((p) => p.invested);
    const lumpV = mapByDate(lump, dates, "value");
    const benchV = mapByDate(bench, dates, "value");
    // 폰 폭에서는 좌표계를 줄여 축 글자가 읽히게 한다(viewBox 가 화면 폭으로 늘어난다).
    const narrow = (svg.clientWidth || 800) < 520;
    const width = narrow ? 420 : 800;
    const height = narrow ? 260 : 280;
    const padL = narrow ? 50 : 58;
    const padR = 14;
    const padT = 14;
    const padB = 30;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const all = [...value, ...invested, ...(lumpV || []), ...(benchV || [])].filter((v) => Number.isFinite(v));
    const maxV = Math.max(...all) * 1.04 || 1;
    const minV = 0;
    const xFor = (i) => padL + (i / Math.max(1, pts.length - 1)) * plotW;
    const yFor = (v) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;
    // 누적 투자금은 계단(납입일에만 오른다)
    let stepD = "";
    invested.forEach((v, i) => {
      const x = xFor(i).toFixed(1);
      const y = yFor(v).toFixed(1);
      if (!i) stepD = `M ${x} ${y}`;
      else stepD += ` L ${x} ${yFor(invested[i - 1]).toFixed(1)} L ${x} ${y}`;
    });
    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + ((maxV - minV) * i) / ticks);
    const xIdx = [0, Math.floor((pts.length - 1) / 2), pts.length - 1].filter((v, i, arr) => arr.indexOf(v) === i);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" class="chart-bg"></rect>
      ${yTicks.map((v) => `<line x1="${padL}" y1="${yFor(v).toFixed(1)}" x2="${width - padR}" y2="${yFor(v).toFixed(1)}" class="chart-grid"></line>`).join("")}
      ${yTicks.map((v) => `<text x="${padL - 6}" y="${(yFor(v) + 4).toFixed(1)}" text-anchor="end" class="chart-axis">${esc(axisMoney(v))}</text>`).join("")}
      ${xIdx.map((i) => `<text x="${xFor(i).toFixed(1)}" y="${height - 8}" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}" class="chart-axis">${esc(dates[i])}</text>`).join("")}
      <path d="${stepD}" fill="none" stroke="${COLORS.invested}" stroke-width="1.6"></path>
      ${benchV ? pathFromSeries(benchV, xFor, yFor, COLORS.bench, 1.6, "6 4") : ""}
      ${lumpV ? pathFromSeries(lumpV, xFor, yFor, COLORS.lump, 1.4, "2 3") : ""}
      ${pathFromSeries(value, xFor, yFor, COLORS.value, 2.2, "")}
      <line id="dcaCross" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" class="chart-grid" visibility="hidden"></line>
      <rect id="dcaHit" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent"></rect>`;
    const legend = [
      [COLORS.value, "평가액(적립식)", ""],
      [COLORS.invested, "누적 투자금", ""],
      lumpV ? [COLORS.lump, "거치식 평가액", "2 3"] : null,
      benchV ? [COLORS.bench, `${label(bench.ticker)} 적립식`, "6 4"] : null,
    ].filter(Boolean);
    $("dcaLegend").innerHTML = legend.map(([c, t, dash]) => `<span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="${c}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ""}></line></svg>${esc(t)}</span>`).join("");
    const tip = $("dcaTip");
    const hit = svg.querySelector("#dcaHit");
    const cross = svg.querySelector("#dcaCross");
    if (!tip || !hit) return;
    const onMove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * width;
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((sx - padL) / plotW) * (pts.length - 1))));
      const x = xFor(i);
      cross.setAttribute("x1", x.toFixed(1));
      cross.setAttribute("x2", x.toFixed(1));
      cross.setAttribute("visibility", "visible");
      const r = invested[i] > 0 ? (value[i] / invested[i] - 1) * 100 : null;
      tip.innerHTML = `<b>${esc(dates[i])}</b><br>평가액 ${esc(money(value[i]))} <span class="${cls(r)}">${esc(pct(r))}</span><br>누적 투자금 ${esc(money(invested[i]))}`
        + (lumpV && Number.isFinite(lumpV[i]) ? `<br>거치식 ${esc(money(lumpV[i]))}` : "")
        + (benchV && Number.isFinite(benchV[i]) ? `<br>${esc(label(bench.ticker))} ${esc(money(benchV[i]))}` : "");
      tip.hidden = false;
      const left = (x / width) * rect.width;
      tip.style.left = `${Math.min(Math.max(0, left + 10), rect.width - tip.offsetWidth - 4)}px`;
    };
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerdown", onMove);
    hit.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
  }

  // ----- 공유 링크(?tab=tools&dca=...) -----
  function shareUrl() {
    const f = readForm();
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    const p = url.searchParams;
    p.set("market", cfg().id);
    p.set("tab", "tools");
    p.set("dca", assets.map((a) => (assets.length > 1 ? `${a.ticker}:${a.weight}` : a.ticker)).join(","));
    p.set("df", f.freq);
    if (f.freq === "monthly") p.set("dd", String(f.monthDay));
    if (f.freq === "weekly") p.set("dw", String(f.weekday));
    p.set("da", String(f.amount));
    p.set("ds", f.start);
    p.set("de", f.end);
    p.set("dr", f.reinvest ? "1" : "0");
    p.set("dx", f.fractional ? "1" : "0");
    p.set("db", f.benchmark || "none");
    return url.toString();
  }

  function applyRoute(params) {
    const raw = params.get("dca");
    if (raw == null) return false;
    const list = raw.split(",").map((tok) => {
      const [t, w] = tok.split(":");
      return { ticker: String(t || "").trim(), weight: Number(w) };
    }).filter((x) => x.ticker && stockByTicker(normalizeTickerKey(x.ticker)));
    setAssets(list);
    const set = (id, v) => { const el = $(id); if (el && v != null && v !== "") el.value = v; };
    const df = params.get("df");
    if (["daily", "weekly", "monthly"].includes(df)) set("dcaFreq", df);
    const dd = params.get("dd");
    if (dd === "last" || (Number(dd) >= 1 && Number(dd) <= 28)) set("dcaMonthDay", dd === "last" ? "last" : String(Number(dd)));
    const dw = Number(params.get("dw"));
    if (dw >= 1 && dw <= 5) set("dcaWeekday", String(dw));
    const da = Number(params.get("da"));
    if (da > 0) set("dcaAmount", String(da));
    const C = core();
    if (C.isIso(params.get("ds"))) set("dcaStart", params.get("ds"));
    if (C.isIso(params.get("de"))) set("dcaEnd", params.get("de"));
    if ((C.isIso(params.get("ds")) || C.isIso(params.get("de"))) && $("dcaPreset")) $("dcaPreset").value = "";
    if (params.get("dr") != null) $("dcaReinvest").checked = params.get("dr") !== "0";
    if (params.get("dx") != null) $("dcaFractional").checked = params.get("dx") === "1";
    const db = params.get("db");
    if (db === "none") { if ($("dcaBenchmark")) $("dcaBenchmark").value = ""; }
    else if (db && [...($("dcaBenchmark")?.options || [])].some((o) => o.value === db)) set("dcaBenchmark", db);
    syncFreqUi();
    return list.length > 0;
  }

  function openFold() {
    const fold = $("dcaFold");
    if (fold) fold.open = true;
    const panel = $("dcaPanel");
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function openForTicker(ticker) {
    const t = normalizeTickerKey(ticker || "");
    if (!t || !stockByTicker(t)) { if (typeof showAppToast === "function") showAppToast("먼저 종목을 선택하세요."); return; }
    setAssets([{ ticker: t, weight: 100 }]);
    if (typeof activateTab === "function") activateTab("bulk", { sub: "tools", push: true });
    openFold();
    run();
  }

  // ----- 바인딩 -----
  function setup() {
    if (!$("dcaPanel") || !core()) return;
    populateBenchmarks();
    applyMarketDefaults(false);
    applyDefaultDates(false);
    syncFreqUi();
    if (!bound) {
      bound = true;
      renderAssets();
      if (typeof setupTickerAutocomplete === "function") {
        setupTickerAutocomplete("dcaTickerInput", {
          submitOnEnter: true,
          onCommit: (ticker) => { if (addTicker(ticker)) $("dcaTickerInput").value = ""; },
        });
      }
      $("dcaTickerAdd")?.addEventListener("click", () => {
        const input = $("dcaTickerInput");
        if (input && addTicker(input.value)) input.value = "";
      });
      $("dcaFreq")?.addEventListener("change", syncFreqUi);
      $("dcaRun")?.addEventListener("click", run);
      $("dcaPreset")?.addEventListener("change", (ev) => {
        const years = Number(ev.target.value);
        if (!years) return;
        const end = $("dcaEnd")?.value || snapshotEnd();
        $("dcaStart").value = core().addYears(end, -years);
      });
      ["dcaStart", "dcaEnd"].forEach((id) => $(id)?.addEventListener("change", () => {
        const preset = $("dcaPreset");
        if (preset) preset.value = "";
      }));
      $("dcaShare")?.addEventListener("click", () => {
        if (!assets.length) { setStatus("종목을 먼저 추가하세요."); return; }
        const url = shareUrl();
        const done = () => (typeof showAppToast === "function" ? showAppToast("설정 링크를 복사했습니다.") : setStatus("설정 링크를 복사했습니다."));
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(() => setStatus(url));
        else setStatus(url);
      });
      $("dcaFromTicker")?.addEventListener("click", () => openForTicker(typeof selectedTicker !== "undefined" ? selectedTicker : ""));
    }
    if (!routeApplied) {
      routeApplied = true;
      let params = null;
      try { params = new URLSearchParams(window.location.search); } catch (_) { params = null; }
      if (params && params.get("dca") != null) {
        // boot 가 ?tab=tools 로 탭을 연 다음에 접고 펼친다.
        setTimeout(() => {
          if (applyRoute(params)) {
            openFold();
            run();
          }
        }, 0);
      }
    }
  }

  // 시장 전환: 반대 시장 티커를 비우고 통화·벤치마크·날짜 기본값을 다시 잡는다.
  function onMarketChange() {
    assets = [];
    lastResult = null;
    divCheckToken += 1;
    const box = $("dcaResults");
    if (box) box.hidden = true;
    setStatus("");
    const note = $("dcaDivNote");
    if (note) note.textContent = "";
    const reinvest = $("dcaReinvest");
    if (reinvest) { reinvest.disabled = false; reinvest.checked = true; }
    renderAssets();
    populateBenchmarks();
    applyMarketDefaults(false);
    applyDefaultDates(true);
  }

  window.MirDca = { setup, onMarketChange, openForTicker, run, get lastResult() { return lastResult; } };
})();
