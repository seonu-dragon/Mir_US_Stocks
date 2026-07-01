(function () {
  const PERIOD_BARS = { "1Y": 252, "6M": 126, "3M": 63, "1M": 21 };

  function params() {
    const q = new URLSearchParams(window.location.search);
    return {
      ticker: (q.get("ticker") || "").trim().toUpperCase(),
      market: (q.get("market") || "us").trim().toLowerCase(),
      period: (q.get("period") || "1Y").trim().toUpperCase(),
    };
  }

  function detailPath(ticker, market) {
    return market === "kr"
      ? `data/korea/details/${encodeURIComponent(ticker)}.json`
      : `data/details/${encodeURIComponent(ticker)}.json`;
  }

  function sma(values, period) {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((s, v) => s + v, 0) / period;
  }

  function smaSeries(values, period) {
    const out = new Array(values.length).fill(null);
    for (let i = period - 1; i < values.length; i += 1) {
      const slice = values.slice(i - period + 1, i + 1);
      out[i] = slice.reduce((s, v) => s + v, 0) / period;
    }
    return out;
  }

  function rsiSeries(closes, period = 14) {
    const out = new Array(closes.length).fill(null);
    if (closes.length < period + 1) return out;
    for (let i = period; i < closes.length; i += 1) {
      let gain = 0;
      let loss = 0;
      for (let j = i - period + 1; j <= i; j += 1) {
        const diff = closes[j] - closes[j - 1];
        gain += Math.max(diff, 0);
        loss += Math.max(-diff, 0);
      }
      const avgGain = gain / period;
      const avgLoss = loss / period;
      if (avgLoss === 0) out[i] = 100;
      else out[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
  }

  function findSupportResistance(rows) {
    const n = rows.length;
    const win = 5;
    const start = Math.max(win, n - 120);
    const price = rows[n - 1].c;
    const sup = [];
    const res = [];
    for (let i = start; i < n - win; i += 1) {
      let isHigh = true;
      let isLow = true;
      for (let j = i - win; j <= i + win; j += 1) {
        if (j === i) continue;
        if (rows[j].h >= rows[i].h) isHigh = false;
        if (rows[j].l <= rows[i].l) isLow = false;
      }
      if (isHigh) res.push(rows[i].h);
      if (isLow) sup.push(rows[i].l);
    }
    const support = sup.concat(res).filter((v) => v < price).sort((a, b) => b - a)[0] || null;
    const resistance = res.concat(sup).filter((v) => v > price).sort((a, b) => a - b)[0] || null;
    return { support, resistance, price };
  }

  function formatPrice(value, market) {
    if (value == null) return "—";
    if (market === "kr") return `${Math.round(value).toLocaleString()}원`;
    return `$${value.toFixed(2)}`;
  }

  function pathFromSeries(series, xFor, yFor, color, width, dash) {
    let d = "";
    series.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) return;
      const cmd = d ? "L" : "M";
      d += `${cmd} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)} `;
    });
    if (!d) return "";
    return `<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="${width}" stroke-dasharray="${dash || ""}"></path>`;
  }

  function renderChart(rows, meta) {
    const svg = document.getElementById("captureChart");
    const width = 868;
    const padL = 56;
    const padR = 12;
    const padT = 12;
    const priceH = 220;
    const volH = 48;
    const rsiH = 48;
    const gap = 10;
    const height = padT + priceH + gap + volH + gap + rsiH + 20;
    const plotW = width - padL - padR;

    if (!rows.length) {
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" fill="#94a3b8" text-anchor="middle">차트 데이터 없음</text>`;
      return;
    }

    const closes = rows.map((r) => r.c);
    const lows = rows.map((r) => r.l);
    const highs = rows.map((r) => r.h);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const range = max - min || 1;
    const xFor = (i) => padL + (i / Math.max(1, rows.length - 1)) * plotW;
    const yFor = (v) => padT + ((max - v) / range) * priceH;
    const candleW = Math.max(2, Math.min(9, (plotW / rows.length) * 0.55));

    const sr = findSupportResistance(rows);
    const sma20 = smaSeries(closes, 20);
    const sma60 = smaSeries(closes, 60);
    const rsi = rsiSeries(closes);
    const volumes = rows.map((r) => r.v || 0);
    const maxVol = Math.max(1, ...volumes);

    const candles = rows.map((row, i) => {
      const x = xFor(i);
      const up = row.c >= row.o;
      const color = up ? "#22c55e" : "#ef4444";
      const yOpen = yFor(row.o);
      const yClose = yFor(row.c);
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(1.2, Math.abs(yClose - yOpen));
      return `<g>
        <line x1="${x.toFixed(1)}" y1="${yFor(row.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${yFor(row.l).toFixed(1)}" stroke="${color}" stroke-width="1"></line>
        <rect x="${(x - candleW / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${color}"></rect>
      </g>`;
    }).join("");

    const grid = [0, 0.5, 1].map((ratio) => {
      const y = padT + priceH * ratio;
      const value = max - range * ratio;
      return `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#1f2937" stroke-width="1"></line>
        <text x="${width - 6}" y="${y + 4}" fill="#64748b" font-size="10" text-anchor="end">${formatPrice(value, meta.market)}</text>`;
    }).join("");

    let srSvg = "";
    if (sr.support != null) {
      const y = yFor(sr.support);
      srSvg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" stroke="#16a34a" stroke-width="1.2" stroke-dasharray="6 4"></line>`;
    }
    if (sr.resistance != null) {
      const y = yFor(sr.resistance);
      srSvg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="6 4"></line>`;
    }

    const overlays = [
      pathFromSeries(sma20, xFor, yFor, "#a855f7", 1.6, ""),
      pathFromSeries(sma60, xFor, yFor, "#d98a2b", 1.6, ""),
    ].join("");

    const volTop = padT + priceH + gap;
    const volBars = volumes.map((v, i) => {
      const x = xFor(i);
      const h = (v / maxVol) * (volH - 4);
      const up = rows[i].c >= rows[i].o;
      const color = up ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)";
      return `<rect x="${(x - candleW / 2).toFixed(1)}" y="${(volTop + volH - h).toFixed(1)}" width="${candleW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}"></rect>`;
    }).join("");

    const rsiTop = volTop + volH + gap;
    const rsiY = (v) => rsiTop + ((100 - v) / 100) * (rsiH - 4);
    const rsiPath = pathFromSeries(rsi, xFor, rsiY, "#38bdf8", 1.4, "");
    const rsiBands = `
      <line x1="${padL}" y1="${rsiY(70).toFixed(1)}" x2="${padL + plotW}" y2="${rsiY(70).toFixed(1)}" stroke="#334155" stroke-dasharray="4 3"></line>
      <line x1="${padL}" y1="${rsiY(30).toFixed(1)}" x2="${padL + plotW}" y2="${rsiY(30).toFixed(1)}" stroke="#334155" stroke-dasharray="4 3"></line>
      <text x="${padL}" y="${(rsiTop - 2).toFixed(1)}" fill="#64748b" font-size="10">RSI</text>`;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" fill="#0b1220" rx="8"></rect>
      ${grid}
      ${srSvg}
      ${overlays}
      ${candles}
      <rect x="${padL}" y="${volTop}" width="${plotW}" height="${volH}" fill="#0f172a" opacity="0.35"></rect>
      ${volBars}
      <text x="${padL}" y="${(volTop - 2).toFixed(1)}" fill="#64748b" font-size="10">거래량</text>
      <rect x="${padL}" y="${rsiTop}" width="${plotW}" height="${rsiH}" fill="#0f172a" opacity="0.35"></rect>
      ${rsiBands}
      ${rsiPath}
    `;

    const last = rows[rows.length - 1];
    document.getElementById("captureTitle").textContent = `${meta.ticker} · ${meta.name}`;
    document.getElementById("captureMeta").textContent =
      `종가 ${formatPrice(last.c, meta.market)} · ${last.d || ""}`;
    document.getElementById("capturePeriod").textContent = `${meta.period} · 일봉`;
    document.getElementById("captureStatus").textContent = "캡처 준비 완료";
    document.getElementById("chart-capture-area").dataset.ready = "1";
  }

  async function boot() {
    const cfg = params();
    if (!cfg.ticker) {
      document.getElementById("captureStatus").textContent = "ticker 파라미터가 필요합니다.";
      return;
    }
    try {
      const res = await fetch(detailPath(cfg.ticker, cfg.market), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail = await res.json();
      const bars = PERIOD_BARS[cfg.period] || 252;
      const rows = (detail.chartSeries || [])
        .map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }))
        .filter((r) => r.c > 0)
        .slice(-bars);
      renderChart(rows, {
        ticker: cfg.ticker,
        name: detail.company || detail.name || cfg.ticker,
        market: cfg.market,
        period: cfg.period,
      });
    } catch (err) {
      document.getElementById("captureStatus").textContent = `로드 실패: ${err.message}`;
      document.getElementById("chart-capture-area").dataset.ready = "error";
    }
  }

  boot();
})();