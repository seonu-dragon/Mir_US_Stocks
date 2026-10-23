// compare-board.js — 종목 › 비교(?tab=search&sub=compare)
// =====================================================
// 수익률 겹쳐 보기(기간·벤치마크·크로스헤어) + 지표 표(최고/최저·정렬·CSV) + 재무 추이(연간/분기 작은 차트).
// 계산은 compare-core.js(window.MirCompareCore). 일봉은 loadStockDetail(app.js → MirMarket.fetchDetail →
// details-source.js), 재무는 loadFinancials(financials.js, FINANCIALS_INDEX 에 있는 종목만).
// 주소창: &cmp=AAPL,MSFT[&cmpp=3Y][&cmpb=QQQ] — 이 화면에 있을 때만 맞춘다(syncNavUrl 이 다른 화면 파라미터는 지운다).
// 클래식 스크립트지만 IIFE 로 감싸고 app.js 가 부르는 이름만 window 에 단다.
(function () {
  "use strict";

  const core = () => window.MirCompareCore;
  const MAX = 8;
  const DEFAULT_PERIOD = "1Y";
  const BENCH = { us: [["SPY", "SPY"], ["QQQ", "QQQ"]], kr: [["069500", "KODEX 200"], ["229200", "KODEX 코스닥150"]] };
  const PERIOD_LABEL = { "1M": "1개월", "3M": "3개월", "6M": "6개월", "1Y": "1년", "3Y": "3년", "5Y": "5년", YTD: "YTD" };
  const state = { period: DEFAULT_PERIOD, bench: "", sort: null, finKind: "annual", gen: 0, tickers: [] };
  let resizeTimer = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s));
  const num = (v) => core().num(v);
  const marketId = () => (typeof marketCfg === "function" ? marketCfg().id : "us");
  const color = (i) => `var(--cmp-${(i % MAX) + 1})`;
  const label = (t) => (typeof stockLabel === "function" ? stockLabel(t) : t);

  function fmtSigned(v, digits) {
    const n = num(v);
    if (n === null) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(digits == null ? 1 : digits)}%`;
  }
  function tone(v) {
    const n = num(v);
    return n === null || n === 0 ? "" : n > 0 ? "pos" : "neg";
  }
  function fmtPctPlain(v) {
    const n = num(v);
    return n === null ? "—" : `${n.toFixed(1)}%`;
  }
  function fmtX(v, digits) {
    const n = num(v);
    return n === null ? "—" : `${n.toFixed(digits == null ? 1 : digits)}배`;
  }

  // ===== 입력 =====
  function compareTickersFromInput() {
    const raw = ($("compareInput") && $("compareInput").value) || "";
    return (typeof resolveTickerListInput === "function" ? resolveTickerListInput(raw) : core().parseTickerParam(raw, 99)).slice(0, MAX);
  }

  function setInputTickers(list) {
    const input = $("compareInput");
    if (!input) return;
    input.value = list.map((t) => (typeof stockInputValue === "function" ? stockInputValue(t) : t)).join(", ");
  }

  function itemFor(t) {
    const base = (typeof stockByTicker === "function" && stockByTicker(t)) || { ticker: t };
    return typeof withDetail === "function" ? withDetail(base) : base;
  }

  function barsFor(t) {
    const it = itemFor(t);
    return it && Array.isArray(it.chartSeries) ? it.chartSeries : null;
  }

  // ===== 지표 표 =====
  const fund = (i, k) => num(i && i.fundamentals && i.fundamentals[k]);
  const METRICS = [
    { key: "price", label: "가격", get: (i) => num(i.price), fmt: (i) => priceOrDash(i.price), ext: false },
    { key: "d1", label: "당일", get: (i) => num(i.changePct), fmt: (i) => fmtSigned(i.changePct, 2), dir: true },
    { key: "w1", label: "1주", get: (i) => num(i.weekChangePct), dir: true },
    { key: "m1", label: "1개월", get: (i) => num(i.monthChangePct), dir: true },
    { key: "m3", label: "3개월", get: (i) => num(i.threeMonthChangePct), dir: true },
    { key: "m6", label: "6개월", get: (i) => core().trailingReturn(i.chartSeries, "6M"), dir: true },
    { key: "y1", label: "1년", get: (i) => core().trailingReturn(i.chartSeries, "1Y"), dir: true },
    { key: "ytd", label: "YTD", get: (i) => num(i.ytdChangePct), dir: true },
    { key: "mcap", label: "시총", get: (i) => num(i.marketCapB), fmt: (i) => fmtBillions(i.marketCapB) },
    { key: "pe", label: "PER", get: (i) => fund(i, "pe"), fmtv: (v) => fmtX(v, 1), positiveOnly: true },
    { key: "fpe", label: "선행 PER", get: (i) => fund(i, "forwardPE"), fmtv: (v) => fmtX(v, 1), positiveOnly: true },
    { key: "ps", label: "PSR", get: (i) => fund(i, "ps"), fmtv: (v) => fmtX(v, 2), positiveOnly: true },
    { key: "pb", label: "PBR", get: (i) => fund(i, "pb"), fmtv: (v) => fmtX(v, 2), positiveOnly: true },
    { key: "opm", label: "영업이익률", get: (i) => fund(i, "operMargin"), fmtv: fmtPctPlain },
    { key: "npm", label: "순이익률", get: (i) => fund(i, "profitMargin"), fmtv: fmtPctPlain },
    { key: "roe", label: "ROE", get: (i) => fund(i, "roe"), fmtv: fmtPctPlain },
    { key: "div", label: "배당수익률", get: (i) => fund(i, "divYield"), fmtv: (v) => (num(v) === null ? "—" : `${num(v).toFixed(2)}%`) },
    { key: "eps", label: "EPS(TTM)", get: (i) => (typeof epsTtmValue === "function" ? epsTtmValue(i) : null), fmt: (i) => fmtEps(i), ext: false },
    { key: "rsi", label: "RSI(14)", get: (i) => (typeof rsiValue === "function" ? rsiValue(i) : null), fmtv: (v) => (num(v) === null ? "—" : String(Math.round(v))) },
    { key: "vol", label: "거래량(평균 대비)", get: (i) => num(i.volumeRatio), fmtv: (v) => (num(v) === null ? "—" : `${num(v).toFixed(1)}x`) },
    { key: "high", label: "52주 신고가 대비", get: (i) => (num(i.newHighDistancePct) === null ? null : -num(i.newHighDistancePct)), fmtv: (v) => fmtSigned(v, 1), ext: false },
    { key: "sector", label: "섹터", text: (i) => (typeof sectorLabelKo === "function" ? sectorLabelKo(i.sector) : i.sector) || "—" },
    { key: "signal", label: "신호", html: (i) => (typeof signalFor === "function" ? signalFor(i) : "—"), csv: false },
  ];

  function cellText(m, item, v) {
    if (m.text) return m.text(item);
    if (m.fmt) return m.fmt(item);
    if (m.fmtv) return m.fmtv(v);
    return m.dir ? fmtSigned(v, 1) : (num(v) === null ? "—" : String(v));
  }

  function tableModel(tickers) {
    const items = tickers.map((t) => itemFor(t)).filter(Boolean);
    const rows = METRICS.map((m) => {
      const values = m.get ? items.map((it) => { try { return m.get(it); } catch (_) { return null; } }) : items.map(() => null);
      const hasAny = m.get ? values.some((v) => v !== null) : true;
      const ex = m.get && m.ext !== false ? core().extremes(values, { positiveOnly: m.positiveOnly, minCount: 3 }) : { hiAll: [], loAll: [] };
      return { m, values, hasAny, ex };
    }).filter((r) => r.hasAny);
    let order = items.map((_, i) => i);
    if (state.sort) {
      const row = rows.find((r) => r.m.key === state.sort.key);
      if (row) order = core().sortOrder(row.values, state.sort.dir);
      else state.sort = null;
    }
    return { items, rows, order };
  }

  function renderTable(tickers) {
    const table = $("compareBoard");
    if (!table) return;
    if (!tickers.length) {
      table.innerHTML = `<tbody><tr><td class="muted">비교할 종목을 입력하세요 (최대 ${MAX}개)</td></tr></tbody>`;
      return;
    }
    const { items, rows, order } = tableModel(tickers);
    const colorIdx = new Map(tickers.map((t, i) => [t, i]));
    let html = `<thead><tr><th scope="col">지표</th>${order.map((k) => {
      const i = items[k];
      const sub = typeof stockSubLabel === "function" ? stockSubLabel(i) : "";
      return `<th scope="col"><span class="cmp-dot" style="background:${color(colorIdx.get(i.ticker) || 0)}"></span><button type="button" class="ticker-link" data-ticker="${esc(i.ticker)}">${esc(label(i))}</button>${sub ? `<div class="muted cmp-sub">${esc(sub)}</div>` : ""}</th>`;
    }).join("")}</tr></thead><tbody>`;
    rows.forEach(({ m, values, ex }) => {
      const sorted = state.sort && state.sort.key === m.key ? state.sort.dir : "";
      const head = m.get
        ? `<button type="button" class="cmp-sort${sorted ? " is-sorted" : ""}" data-sort="${m.key}" aria-label="${esc(m.label)} 기준 정렬">${esc(m.label)}<span class="cmp-sort-ind" aria-hidden="true">${sorted === "desc" ? "▼" : sorted === "asc" ? "▲" : ""}</span></button>`
        : esc(m.label);
      html += `<tr><th scope="row" class="metric-label">${head}</th>${order.map((k) => {
        const it = items[k];
        const v = values[k];
        if (m.html) return `<td>${m.html(it)}</td>`;
        const classes = [];
        if (m.dir) { const t = tone(v); if (t) classes.push(t); }
        let mark = "";
        if (ex.hiAll.includes(k)) { classes.push("cmp-hi"); mark = `<span class="cmp-mark">최고</span>`; }
        else if (ex.loAll.includes(k)) { classes.push("cmp-lo"); mark = `<span class="cmp-mark">최저</span>`; }
        return `<td${classes.length ? ` class="${classes.join(" ")}"` : ""}>${esc(cellText(m, it, v))}${mark}</td>`;
      }).join("")}</tr>`;
    });
    html += "</tbody>";
    table.innerHTML = html;
    if (typeof delegateTickerClicks === "function") delegateTickerClicks(table, ".ticker-link");
  }

  function exportCsv() {
    const tickers = state.tickers;
    if (!tickers.length) { if (typeof showAppToast === "function") showAppToast("비교할 종목이 없습니다."); return; }
    const { items, rows, order } = tableModel(tickers);
    const header = ["지표", ...order.map((k) => label(items[k]))];
    const body = [["티커", ...order.map((k) => items[k].ticker)]];
    rows.forEach(({ m, values }) => {
      if (m.csv === false) return;
      body.push([m.label, ...order.map((k) => {
        const s = cellText(m, items[k], values[k]);
        return s === "—" || s === "-" ? "" : s;
      })]);
    });
    const day = new Date().toISOString().slice(0, 10);
    downloadCsv(`mir-compare-${marketId()}-${day}.csv`, core().csvRows(header, body));
  }

  // ===== 선 차트(수익률 · 재무 공용) =====
  // cfg: { labels, series:[{name, color, values, dash, width}], height, fmtAxis(v), fmtVal(v, s, i), xLabel(i), dots, zero, tipTitle(i) }
  function drawLines(svg, tip, cfg) {
    if (!svg) return;
    const n = cfg.labels.length;
    const W = Math.max(260, Math.round(svg.clientWidth || (svg.parentElement && svg.parentElement.clientWidth) || 640));
    const H = cfg.height || 280;
    const narrow = W < 420;
    let padL = cfg.padL || (narrow ? 44 : 52);
    const padR = 12;
    const padT = 10;
    const padB = 24;
    const plotH = H - padT - padB;
    const all = [];
    cfg.series.forEach((s) => s.values.forEach((v) => { if (num(v) !== null) all.push(v); }));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!n || !all.length) { svg.innerHTML = ""; if (tip) tip.hidden = true; return; }
    let mn = Math.min(...all);
    let mx = Math.max(...all);
    if (cfg.zero) { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
    const t = core().niceTicks(mn, mx, H < 200 ? 3 : 5);
    // 축 글자 폭만큼 왼쪽 여백(원화 EPS '150,000원' 같은 긴 눈금이 잘리지 않게)
    const longest = Math.max(...t.ticks.map((v) => String(cfg.fmtAxis(v)).length));
    padL = Math.max(padL, Math.ceil(longest * 7.2) + 10);
    const plotW = W - padL - padR;
    const xFor = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yFor = (v) => padT + plotH - ((v - t.lo) / (t.hi - t.lo || 1)) * plotH;
    const pathOf = (vals) => {
      let d = "";
      let pen = false;
      vals.forEach((v, i) => {
        if (num(v) === null) { pen = false; return; }
        d += `${pen ? "L" : "M"}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`;
        pen = true;
      });
      return d;
    };
    const xCount = Math.min(n, narrow ? 3 : 5);
    const xIdx = [...new Set(Array.from({ length: xCount }, (_, k) => Math.round((k / Math.max(1, xCount - 1)) * (n - 1))))];
    let html = `<rect x="0" y="0" width="${W}" height="${H}" class="chart-bg"></rect>`;
    t.ticks.forEach((v) => {
      const y = yFor(v).toFixed(1);
      html += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="chart-grid${v === 0 && cfg.zero ? " cmp-zero" : ""}"></line>`;
      html += `<text x="${padL - 6}" y="${(Number(y) + 4).toFixed(1)}" text-anchor="end" class="chart-axis">${esc(cfg.fmtAxis(v))}</text>`;
    });
    xIdx.forEach((i) => {
      const anchor = n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle";
      html += `<text x="${xFor(i).toFixed(1)}" y="${H - 7}" text-anchor="${anchor}" class="chart-axis">${esc(cfg.xLabel(i))}</text>`;
    });
    cfg.series.forEach((s) => {
      html += `<path d="${pathOf(s.values)}" fill="none" style="stroke:${s.color}" stroke-width="${s.width || 1.8}" stroke-linejoin="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}></path>`;
      if (cfg.dots) s.values.forEach((v, i) => { if (num(v) !== null) html += `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="2.4" style="fill:${s.color}"></circle>`; });
    });
    html += `<line class="cmp-cross" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" visibility="hidden"></line><g class="cmp-hover"></g>`;
    html += `<rect class="cmp-hit" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent"></rect>`;
    svg.innerHTML = html;
    if (!tip) return;
    const hit = svg.querySelector(".cmp-hit");
    const cross = svg.querySelector(".cmp-cross");
    const hover = svg.querySelector(".cmp-hover");
    const onMove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / (rect.width || 1)) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : ((sx - padL) / plotW) * (n - 1))));
      const x = xFor(i);
      cross.setAttribute("x1", x.toFixed(1));
      cross.setAttribute("x2", x.toFixed(1));
      cross.setAttribute("visibility", "visible");
      const rowsAt = cfg.series.map((s) => ({ s, v: s.values[i] })).filter((r) => num(r.v) !== null);
      hover.innerHTML = rowsAt.map((r) => `<circle cx="${x.toFixed(1)}" cy="${yFor(r.v).toFixed(1)}" r="3.6" style="fill:${r.s.color}" class="cmp-hover-dot"></circle>`).join("");
      rowsAt.sort((a, b) => b.v - a.v);
      tip.innerHTML = `<b>${esc(cfg.tipTitle ? cfg.tipTitle(i) : cfg.labels[i])}</b>${rowsAt.map((r) => `<div class="cmp-tip-row"><i style="background:${r.s.color}"></i><span>${esc(r.s.name)}</span>${cfg.fmtVal(r.v, r.s, i)}</div>`).join("") || `<div class="muted">—</div>`}`;
      tip.hidden = false;
      const left = (x / W) * rect.width;
      const tw = tip.offsetWidth || 160;
      tip.style.left = `${Math.max(0, Math.min(left > rect.width / 2 ? left - tw - 12 : left + 12, rect.width - tw - 2))}px`;
    };
    const onLeave = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); hover.innerHTML = ""; };
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerdown", onMove);
    hit.addEventListener("pointerleave", onLeave);
  }

  // ===== 수익률 겹쳐 보기 =====
  function benchList() {
    return BENCH[marketId()] || [];
  }

  function renderPeriodSeg() {
    const seg = $("comparePeriodSeg");
    if (seg) seg.querySelectorAll("[data-period]").forEach((b) => b.classList.toggle("is-active", b.dataset.period === state.period));
    const bseg = $("compareBenchSeg");
    if (!bseg) return;
    const opts = [["", "벤치 없음"], ...benchList()];
    if (state.bench && !opts.some(([t]) => t === state.bench)) state.bench = "";
    bseg.innerHTML = opts.map(([t, name]) => `<button type="button" data-bench="${esc(t)}" class="${t === state.bench ? "is-active" : ""}" aria-pressed="${t === state.bench}">${esc(name)}</button>`).join("");
  }

  function renderReturnChart() {
    const svg = $("compareReturnChart");
    const card = $("compareReturnCard");
    if (!svg || !card) return;
    const tickers = state.tickers;
    card.hidden = !tickers.length;
    if (!tickers.length) return;
    const bench = state.bench && !tickers.includes(state.bench) ? state.bench : "";
    const list = tickers.map((t) => ({ key: t, series: barsFor(t) }));
    if (bench) list.push({ key: bench, series: barsFor(bench) });
    const aligned = core().alignReturns(list, state.period);
    const asof = $("compareReturnAsof");
    const legend = $("compareReturnLegend");
    const tip = $("compareReturnTip");
    if (!aligned.dates.length) {
      svg.innerHTML = "";
      svg.setAttribute("viewBox", "0 0 640 60");
      if (legend) legend.innerHTML = "";
      if (asof) asof.textContent = "일봉 불러오는 중…";
      return;
    }
    const series = aligned.series.map((s, i) => {
      const isBench = bench && s.key === bench;
      return {
        key: s.key,
        name: label(s.key),
        color: isBench ? "var(--muted)" : color(i),
        dash: isBench ? "5 4" : "",
        width: isBench ? 1.5 : 1.9,
        values: s.values,
        src: s,
      };
    }).filter((s) => !s.src.empty);
    const dates = aligned.dates;
    drawLines(svg, tip, {
      labels: dates,
      series,
      height: (svg.clientWidth || 640) < 420 ? 240 : 300,
      zero: true,
      fmtAxis: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}%`,
      fmtVal: (v) => `<b class="${tone(v)}">${esc(fmtSigned(v, 2))}</b>`,
      xLabel: (i) => (state.period === "1M" || state.period === "3M" ? dates[i].slice(5) : dates[i].slice(0, 7)),
      tipTitle: (i) => dates[i],
    });
    if (legend) {
      const missing = aligned.series.filter((s) => s.empty).map((s) => label(s.key));
      legend.innerHTML = series.map((s) => `<span class="cmp-leg"><svg width="18" height="8" aria-hidden="true"><line x1="1" y1="4" x2="17" y2="4" style="stroke:${s.color}" stroke-width="2.2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}></line></svg>${esc(s.name)} <b class="${tone(s.src.last)}">${esc(fmtSigned(s.src.last, 1))}</b>${s.src.lateStart ? ` <span class="muted">(${esc(s.src.baseDate)}~)</span>` : ""}${s.src.lastDate !== aligned.ref ? ` <span class="muted">(~${esc(s.src.lastDate)})</span>` : ""}</span>`).join("")
        + missing.map((m) => `<span class="cmp-leg muted">${esc(m)} —</span>`).join("");
    }
    if (asof) asof.textContent = `${aligned.start} ~ ${aligned.ref} · 종가 기준`;
  }

  // ===== 재무 추이 =====
  function finFiles(tickers) {
    return tickers.map((t) => ({ key: t, file: typeof financialsCached === "function" ? financialsCached(t) || null : null }));
  }

  function fmtFin(type, v, currency) {
    if (num(v) === null) return "—";
    if (type === "pct") return `${num(v).toFixed(1)}%`;
    if (type === "eps") return typeof mfEps === "function" ? mfEps(v, currency) : String(v);
    return typeof mfMoney === "function" ? mfMoney(v, currency) : String(v);
  }

  function renderFinancials() {
    const card = $("compareFinCard");
    const grid = $("compareFinGrid");
    if (!card || !grid) return;
    const tickers = state.tickers;
    const files = finFiles(tickers);
    if (!tickers.length || !files.some((f) => f.file)) { card.hidden = true; grid.innerHTML = ""; return; }
    card.hidden = false;
    $("compareFinKind")?.querySelectorAll("[data-fin]").forEach((b) => b.classList.toggle("is-active", b.dataset.fin === state.finKind));
    const colorIdx = new Map(tickers.map((t, i) => [t, i]));
    const cards = core().FIN_METRICS.map((m) => ({ m, mx: core().finMatrix(files, state.finKind, m.key) })).filter((c) => c.mx.any);
    if (!cards.length) { grid.innerHTML = `<p class="muted">—</p>`; return; }
    grid.innerHTML = cards.map(({ m }) => `<div class="cmp-fin" data-metric="${m.key}"><div class="cmp-fin-head"><h4>${esc(m.label)}</h4><span class="muted cmp-fin-unit" data-unit></span></div><div class="cmp-chart-wrap"><svg class="cmp-fin-svg" role="img" aria-label="${esc(m.label)} 추이"></svg><div class="dca-tip cmp-tip" hidden></div></div></div>`).join("");
    cards.forEach(({ m, mx }) => {
      const box = grid.querySelector(`[data-metric="${m.key}"]`);
      const present = mx.series.filter((s) => s.values.some((v) => v !== null));
      const currencies = [...new Set(present.map((s) => s.currency).filter(Boolean))];
      const cur = currencies.length === 1 ? currencies[0] : null;
      const unit = box.querySelector("[data-unit]");
      if (unit) unit.textContent = m.type === "pct" ? "%" : cur || (currencies.length > 1 ? currencies.join("·") : "");
      const series = present.map((s) => ({ key: s.key, name: label(s.key), color: color(colorIdx.get(s.key) || 0), values: s.values, meta: s.meta, currency: s.currency }));
      drawLines(box.querySelector("svg"), box.querySelector(".cmp-tip"), {
        labels: mx.periods.map((p) => p.label),
        series,
        height: 170,
        padL: 44,
        dots: true,
        zero: m.type !== "money" || series.some((s) => s.values.some((v) => num(v) !== null && v < 0)),
        fmtAxis: (v) => (m.type === "pct" ? `${Math.round(v)}%` : fmtFin(m.type, v, cur)),
        fmtVal: (v, s, i) => `<b>${esc(fmtFin(m.type, v, s.currency))}</b>${s.meta && s.meta[i] && s.meta[i] !== mx.periods[i].label ? ` <span class="muted">${esc(s.meta[i])}</span>` : ""}`,
        xLabel: (i) => {
          const l = mx.periods[i].label;
          return state.finKind === "annual" ? l.replace("FY", "") : l.replace(/^20(\d\d) Q/, "$1.Q");
        },
        tipTitle: (i) => mx.periods[i].label,
      });
    });
  }

  // ===== 칩 · 주소창 =====
  function renderChips() {
    const box = $("compareChips");
    if (!box) return;
    box.innerHTML = state.tickers.map((t, i) => `<button type="button" class="compare-chip" data-remove="${esc(t)}" aria-label="${esc(label(t))} 빼기"><i class="compare-chip-dot" style="background:${color(i)}"></i>${esc(label(t))} <span aria-hidden="true">×</span></button>`).join("");
  }

  function onCompareScreen() {
    return typeof currentTab !== "undefined" && currentTab === "search" && typeof searchSubTab !== "undefined" && searchSubTab === "compare";
  }

  function syncUrl() {
    if (!onCompareScreen()) return;
    try {
      const url = new URL(window.location.href);
      const p = url.searchParams;
      p.set("tab", "search");
      p.set("sub", "compare");
      if (state.tickers.length) p.set("cmp", state.tickers.join(",")); else p.delete("cmp");
      if (state.period !== DEFAULT_PERIOD) p.set("cmpp", state.period); else p.delete("cmpp");
      if (state.bench) p.set("cmpb", state.bench); else p.delete("cmpb");
      const next = url.toString();
      if (next !== window.location.href) history.replaceState(history.state, "", next);
    } catch (_) { /* history 차단 환경 */ }
  }

  function shareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    const p = url.searchParams;
    p.set("market", marketId());
    p.set("tab", "search");
    p.set("sub", "compare");
    if (state.tickers.length) p.set("cmp", state.tickers.join(","));
    if (state.period !== DEFAULT_PERIOD) p.set("cmpp", state.period);
    if (state.bench) p.set("cmpb", state.bench);
    return url.toString();
  }

  // ===== 렌더 진입점 =====
  function renderData() {
    renderTable(state.tickers);
    renderReturnChart();
    renderFinancials();
    // 피어 산점도(peer-scatter.js) — MAP_FUNDAMENTALS 만 쓰므로 상세 로드를 기다리지 않는다.
    if (typeof window.renderComparePeerScatter === "function") window.renderComparePeerScatter(state.tickers);
  }

  function renderCompareBoard() {
    if (!core() || !$("compareBoard")) return;
    state.tickers = compareTickersFromInput(); // 정렬 기준은 종목이 바뀌어도 유지
    renderPeriodSeg();
    renderChips();
    renderData();
    setTimeout(syncUrl, 0); // 탭 이동 직후 syncNavUrl 이 주소를 새로 쓴 뒤에 붙인다
    const gen = ++state.gen;
    const want = state.tickers.slice();
    const loads = want.map((t) => (typeof loadStockDetail === "function" ? loadStockDetail(t) : Promise.resolve(null)));
    if (state.bench && !want.includes(state.bench) && typeof loadStockDetail === "function") loads.push(loadStockDetail(state.bench));
    const fins = want.map((t) => (typeof loadFinancials === "function" ? loadFinancials(t).catch(() => null) : Promise.resolve(null)));
    Promise.all(loads).then(() => {
      if (gen !== state.gen) return;
      renderTable(state.tickers);
      renderReturnChart();
    });
    Promise.all(fins).then(() => {
      if (gen !== state.gen) return;
      renderFinancials();
    });
  }

  function rerenderVisuals() {
    if (!onCompareScreen()) return;
    renderReturnChart();
    renderFinancials();
  }

  function applyRoute() {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch (_) { return false; }
    const p = params.get("cmpp");
    if (p && core().PERIODS.includes(p)) state.period = p;
    const b = params.get("cmpb");
    if (b && benchList().some(([t]) => t === b)) state.bench = b;
    const raw = params.get("cmp");
    if (raw == null) return false;
    const toks = core().parseTickerParam(raw, MAX);
    const resolved = toks.map((t) => (typeof resolveTickerQuery === "function" ? resolveTickerQuery(t) : t)).filter(Boolean);
    const list = [...new Set(resolved.map((t) => (typeof normalizeTickerKey === "function" ? normalizeTickerKey(t) : t)))].slice(0, MAX);
    if (!list.length) return false;
    setInputTickers(list);
    return true;
  }

  function setupCompareEvents() {
    const run = () => {
      const raw = ($("compareInput") && $("compareInput").value) || "";
      const n = raw.split(",").map((s) => s.trim()).filter(Boolean).length;
      if (n > MAX && typeof showAppToast === "function") showAppToast(`최대 ${MAX}개까지 비교합니다.`);
      renderCompareBoard();
    };
    $("compareRun")?.addEventListener("click", run);
    $("compareFromWatchlist")?.addEventListener("click", () => {
      setInputTickers((typeof watchlist !== "undefined" ? watchlist : []).slice(0, MAX));
      renderCompareBoard();
    });
    $("compareCsv")?.addEventListener("click", exportCsv);
    $("compareShare")?.addEventListener("click", () => {
      const url = shareUrl();
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error("no clipboard")))
        .then(() => showAppToast("비교 링크를 복사했습니다."))
        .catch(() => showAppToast("복사에 실패했습니다 — 주소창 URL을 사용하세요."));
    });
    $("comparePeriodSeg")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-period]");
      if (!btn || btn.dataset.period === state.period) return;
      state.period = btn.dataset.period;
      renderPeriodSeg();
      renderReturnChart();
      syncUrl();
    });
    $("compareBenchSeg")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-bench]");
      if (!btn) return;
      state.bench = btn.dataset.bench || "";
      renderPeriodSeg();
      renderReturnChart();
      syncUrl();
      if (state.bench && typeof loadStockDetail === "function") {
        const gen = state.gen;
        loadStockDetail(state.bench).then(() => { if (gen === state.gen) renderReturnChart(); });
      }
    });
    $("compareFinKind")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fin]");
      if (!btn || btn.dataset.fin === state.finKind) return;
      state.finKind = btn.dataset.fin;
      renderFinancials();
    });
    $("compareBoard")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sort]");
      if (!btn) return;
      const key = btn.dataset.sort;
      // 내림 → 오름 → 원래 순서
      if (!state.sort || state.sort.key !== key) state.sort = { key, dir: "desc" };
      else if (state.sort.dir === "desc") state.sort = { key, dir: "asc" };
      else state.sort = null;
      renderTable(state.tickers);
    });
    $("compareChips")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      setInputTickers(state.tickers.filter((t) => t !== btn.dataset.remove));
      renderCompareBoard();
    });
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rerenderVisuals, 160);
    });
    if (!applyRoute()) {
      const input = $("compareInput");
      if (input && !input.value) setInputTickers((typeof watchlist !== "undefined" ? watchlist : []).slice(0, 4));
    }
  }

  // 시장 전환(screener.js resetScreenerMarketState): 반대 시장 티커·벤치마크·정렬을 버리고 주소창의 cmp 도 지운다.
  function compareBoardMarketReset() {
    state.bench = "";
    state.sort = null;
    state.tickers = [];
    state.gen += 1;
    try {
      const url = new URL(window.location.href);
      ["cmp", "cmpb"].forEach((k) => url.searchParams.delete(k));
      history.replaceState(history.state, "", url.toString());
    } catch (_) { /* history 차단 환경 */ }
  }

  window.renderCompareBoard = renderCompareBoard;
  window.setupCompareEvents = setupCompareEvents;
  window.compareTickersFromInput = compareTickersFromInput;
  window.compareBoardMarketReset = compareBoardMarketReset;
})();
