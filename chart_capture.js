(function () {
  // app.js rangeBarCount 와 동일 (6M = 132 일봉)
  const PERIOD_BARS = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260 };

  const PATTERN_TYPES_ENABLED = {
    hns: true, double: true, triangle: true, wedge: true, box: true, flag: true, pennant: true,
    triple: true, broadening: true, diamond: true, rounding: true, complex_hns: true, breakout: true,
    cup: true, channel: true, reversal: true, trap: true, gap: true, volume: true, squeeze: true,
    harmonic: true, candle: true,
  };

  function params() {
    const q = new URLSearchParams(window.location.search);
    return {
      ticker: (q.get("ticker") || "").trim().toUpperCase(),
      market: (q.get("market") || "us").trim().toLowerCase(),
      period: (q.get("period") || "6M").trim().toUpperCase(),
    };
  }

  function detailPath(ticker, market) {
    return market === "kr"
      ? `data/korea/details/${encodeURIComponent(ticker)}.json`
      : `data/details/${encodeURIComponent(ticker)}.json`;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function patternCategory(p) {
    if (p === "hns" || p === "inv_hns" || p === "complex_hns") return p === "complex_hns" ? "complex_hns" : "hns";
    if (p === "double_top" || p === "double_bottom" || p === "two_b_bottom" || p === "two_b_top") return p.startsWith("two_b") ? "reversal" : "double";
    if (p === "ascending_triangle" || p === "descending_triangle" || p === "symmetrical_triangle") return "triangle";
    if (p === "falling_wedge" || p === "rising_wedge") return "wedge";
    if (p === "box_breakout" || p === "box_breakdown") return "box";
    if (p === "bull_flag" || p === "bear_flag") return "flag";
    if (p === "bull_pennant" || p === "bear_pennant") return "pennant";
    if (p === "triple_top" || p === "triple_bottom") return "triple";
    if (p === "broadening_triangle") return "broadening";
    if (p === "diamond_top" || p === "diamond_bottom") return "diamond";
    if (p === "rounding_bottom" || p === "cup_and_handle") return p === "cup_and_handle" ? "cup" : "rounding";
    if (p === "ascending_channel_breakout" || p === "descending_channel_breakout") return "channel";
    if (p === "reversal_123_up" || p === "reversal_123_down") return "reversal";
    if (p === "bull_trap" || p === "bear_trap") return "trap";
    if (/gap|island/.test(p)) return "gap";
    if (p === "volume_climax_up" || p === "volume_climax_down") return "volume";
    if (/nr4|inside_bar/.test(p)) return "squeeze";
    if (/harmonic/.test(p)) return "harmonic";
    if (/engulfing|hammer|shooting_star|doji|morning_star|evening_star|soldiers|crows|piercing|dark_cloud/.test(p)) return "candle";
    if (p === "resistance_breakout" || p === "support_breakdown") return "breakout";
    return null;
  }

  function computeAutoTrendlines(rows, win = 3) {
    const pivots = [];
    for (let i = win; i < rows.length - win; i += 1) {
      let isHigh = true;
      let isLow = true;
      for (let j = i - win; j <= i + win; j += 1) {
        if (j === i) continue;
        if (rows[j].h >= rows[i].h) isHigh = false;
        if (rows[j].l <= rows[i].l) isLow = false;
      }
      if (isHigh) pivots.push({ idx: i, price: rows[i].h, type: "H" });
      if (isLow) pivots.push({ idx: i, price: rows[i].l, type: "L" });
    }
    const lines = [];
    const highs = pivots.filter((p) => p.type === "H").slice(-3);
    const lows = pivots.filter((p) => p.type === "L").slice(-3);
    if (highs.length >= 2) {
      const a = highs[highs.length - 2];
      const b = highs[highs.length - 1];
      lines.push({ kind: "res", x1: a.idx, y1: a.price, x2: b.idx, y2: b.price, color: "#f87171" });
    }
    if (lows.length >= 2) {
      const a = lows[lows.length - 2];
      const b = lows[lows.length - 1];
      lines.push({ kind: "sup", x1: a.idx, y1: a.price, x2: b.idx, y2: b.price, color: "#4ade80" });
    }
    return lines;
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

  function chartAnalysisContextRows(allRows, periodBars) {
    const base = allRows.slice(-periodBars);
    const windowSize = base.length;
    const end = base.length;
    const ctxStart = Math.max(0, end - Math.max(252, windowSize + 80));
    return base.slice(ctxStart, end);
  }

  function renderSupportResistance(levels, rows, xFor, yFor, padL, plotW, min, max, market) {
    return levels
      .filter((lvl) => lvl.hi >= min && lvl.lo <= max)
      .map((lvl) => {
        const yMid = yFor(lvl.price);
        const yHi = yFor(lvl.hi);
        const yLo = yFor(lvl.lo);
        const color = lvl.type === "sup" ? "#16a34a" : "#dc2626";
        const bandH = Math.max(2, yLo - yHi);
        const dots = "●".repeat(lvl.tier) + "○".repeat(3 - lvl.tier);
        const label = `${lvl.type === "sup" ? "지지" : "저항"} ${formatPrice(lvl.price, market)} ${dots}`;
        return `<rect x="${padL}" y="${yHi.toFixed(1)}" width="${plotW}" height="${bandH.toFixed(1)}" fill="${color}" opacity="0.08"></rect>`
          + `<line x1="${padL}" y1="${yMid.toFixed(1)}" x2="${padL + plotW}" y2="${yMid.toFixed(1)}" stroke="${color}" stroke-width="1.1" stroke-dasharray="6 4" opacity="0.85"></line>`
          + `<text x="${padL + 5}" y="${(yMid - 3).toFixed(1)}" fill="${color}" font-size="10" font-weight="700">${escapeHtml(label)}</text>`;
      })
      .join("");
  }

  function renderTrendlines(rows, xFor, yFor, padL) {
    const extendTo = rows.length - 1;
    return computeAutoTrendlines(rows).map((ln) => {
      const dx = ln.x2 - ln.x1 || 1;
      const slope = (ln.y2 - ln.y1) / dx;
      const yEnd = ln.y2 + slope * (extendTo - ln.x2);
      const x1 = xFor(ln.x1);
      const x2 = xFor(extendTo);
      return `<line x1="${x1.toFixed(1)}" y1="${yFor(ln.y1).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${yFor(yEnd).toFixed(1)}" stroke="${ln.color}" stroke-width="1.5" stroke-dasharray="7 4" opacity="0.85"></line>`
        + `<text x="${x1.toFixed(1)}" y="${(yFor(ln.y1) - 4).toFixed(1)}" fill="${ln.color}" font-size="9.5" font-weight="700">${ln.kind === "sup" ? "지지 추세선" : "저항 추세선"}</text>`;
    }).join("");
  }

  function renderPatterns(dailyRows, visRows, xFor, yFor) {
    if (!window.MirProb || !window.MirProb.detectConfirmations) return "";
    const labels = window.MirProb.patternLabels || {};
    const firstD = visRows[0].d;
    const lastD = visRows[visRows.length - 1].d;
    const days = (d) => (d ? Date.parse(d) / 86400000 : NaN);
    const visIdxForDate = (d) => {
      if (!d || d < firstD || d > lastD) return -1;
      let best = -1;
      let bestDiff = Infinity;
      const td = days(d);
      for (let i = 0; i < visRows.length; i += 1) {
        const diff = Math.abs(days(visRows[i].d) - td);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      }
      return best;
    };
    const mapPt = (p) => {
      const dt = dailyRows[p.idx] && dailyRows[p.idx].d;
      const vi = visIdxForDate(dt);
      return vi < 0 ? null : { x: xFor(vi), y: yFor(p.price), label: p.label };
    };

    const pats = window.MirProb.detectConfirmations(dailyRows)
      .filter((p) => p.points || p.lines)
      .filter((p) => {
        const cat = patternCategory(p.pattern);
        return cat && PATTERN_TYPES_ENABLED[cat];
      })
      .filter((p) => {
        const cd = dailyRows[p.confirm_idx] && dailyRows[p.confirm_idx].d;
        return cd && cd >= firstD && cd <= lastD;
      })
      .sort((a, b) => b.confirm_idx - a.confirm_idx)
      .slice(0, 3);

    return pats.map((pat) => {
      const color = pat.dir > 0 ? "#0ea5e9" : "#a855f7";
      let svg = "";
      let anchor = null;
      if (pat.lines) {
        for (const ln of pat.lines) {
          const lp = ln.pts.map(mapPt).filter(Boolean);
          if (lp.length === 2) {
            svg += `<line x1="${lp[0].x.toFixed(1)}" y1="${lp[0].y.toFixed(1)}" x2="${lp[1].x.toFixed(1)}" y2="${lp[1].y.toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="0.9"></line>`;
            anchor = anchor || lp[0];
          }
        }
      }
      const pts = (pat.points || []).map(mapPt).filter(Boolean);
      if (pts.length >= 3) {
        const poly = pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        svg += `<path d="${poly}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"></path>`;
      }
      if (pat.necklinePts) {
        const nl = pat.necklinePts.map(mapPt).filter(Boolean);
        if (nl.length === 2) {
          svg += `<line x1="${nl[0].x.toFixed(1)}" y1="${nl[0].y.toFixed(1)}" x2="${nl[1].x.toFixed(1)}" y2="${nl[1].y.toFixed(1)}" stroke="${color}" stroke-width="1.1" stroke-dasharray="5 4" opacity="0.8"></line>`;
        }
      }
      for (const p of pts) {
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${color}"></circle>`;
        if (p.label) svg += `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" text-anchor="middle" fill="${color}" font-size="10" font-weight="700">${escapeHtml(p.label)}</text>`;
      }
      if (pts.length) anchor = anchor || pts[0];
      if (!anchor) return "";
      const name = labels[pat.pattern] || pat.pattern;
      svg += `<text x="${anchor.x.toFixed(1)}" y="${(anchor.y + 14).toFixed(1)}" fill="${color}" font-size="10.5" font-weight="800">${escapeHtml(name)}</text>`;
      return svg;
    }).join("");
  }

  function renderChart(allRows, meta) {
    const svg = document.getElementById("captureChart");
    const periodBars = PERIOD_BARS[meta.period] || 132;
    const rows = allRows.slice(-periodBars);
    const ctxRows = chartAnalysisContextRows(allRows, periodBars);

    const width = 928;
    const padL = 58;
    const padR = 12;
    const padT = 14;
    const priceH = 260;
    const volH = 52;
    const rsiH = 52;
    const gap = 10;
    const height = padT + priceH + gap + volH + gap + rsiH + 22;
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

    const sma20 = smaSeries(closes, 20);
    const sma60 = smaSeries(closes, 60);
    const rsi = rsiSeries(closes);
    const volumes = rows.map((r) => r.v || 0);
    const maxVol = Math.max(1, ...volumes);

    let srSvg = "";
    if (window.MirProb && window.MirProb.supportResistanceLevels) {
      const levels = window.MirProb.supportResistanceLevels(ctxRows);
      srSvg = renderSupportResistance(levels, rows, xFor, yFor, padL, plotW, min, max, meta.market);
    }

    const trendSvg = renderTrendlines(rows, xFor, yFor, padL);
    const patSvg = renderPatterns(allRows, rows, xFor, yFor);

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

    const overlays = [
      pathFromSeries(sma20, xFor, yFor, "#a855f7", 1.8, ""),
      pathFromSeries(sma60, xFor, yFor, "#d98a2b", 1.8, ""),
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
      <text x="${padL}" y="${(rsiTop - 2).toFixed(1)}" fill="#64748b" font-size="10">RSI(14)</text>`;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" fill="#0b1220" rx="8"></rect>
      ${grid}
      ${srSvg}
      ${trendSvg}
      ${patSvg}
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
    document.getElementById("capturePeriod").textContent = `${meta.period} · 일봉 · 상승확률 분석`;
    document.getElementById("captureStatus").textContent = "캡처 준비 완료";
    document.getElementById("chart-capture-area").dataset.ready = "1";
  }

  async function boot() {
    const cfg = params();
    if (!cfg.ticker) {
      document.getElementById("captureStatus").textContent = "ticker 파라미터가 필요합니다.";
      document.getElementById("chart-capture-area").dataset.ready = "error";
      return;
    }
    if (!window.MirProb) {
      document.getElementById("captureStatus").textContent = "analysis.js 로드 실패";
      document.getElementById("chart-capture-area").dataset.ready = "error";
      return;
    }
    try {
      const res = await fetch(detailPath(cfg.ticker, cfg.market), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail = await res.json();
      const allRows = (detail.chartSeries || [])
        .map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }))
        .filter((r) => r.c > 0);
      renderChart(allRows, {
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