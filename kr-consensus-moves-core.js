// kr-consensus-moves-core.js — 국내 컨센서스 변화(KR_CONSENSUS.stocks[*].chg) 순수 계산. 브라우저·node 테스트 공용.
// chg 는 scripts/kr_consensus_history.py 가 만든다: tp1w·tp1m·tp3m(목표가 %), op1m·op3m(의견 점수 차),
// r1m·r3m·o1m·o3m(FY1 매출·영업이익 %), r2m·o2m(FY2 1개월 %), base{1w,1m,3m}(비교한 관측일), fy·fy2.
(function (root) {
  "use strict";

  const FIELD = {
    tp: { "1w": "tp1w", "1m": "tp1m", "3m": "tp3m" },
    op: { "1m": "o1m", "3m": "o3m" },
  };

  function num(v) {
    const n = Number(v);
    return v == null || !Number.isFinite(n) ? null : n;
  }

  /** 상향·하향 상위. field: "tp"(목표가) | "op"(FY1 영업이익 추정), period: "1w" | "1m" | "3m".
   *  minCount: 추정기관수 하한(없는 종목은 뺀다), 승계 종목(carriedSince)은 뺀다. 보합(0)은 breadth 에만 센다. */
  function moves(payload, opts = {}) {
    const field = opts.field === "op" ? "op" : "tp";
    const period = opts.period || "1m";
    const key = (FIELD[field] || {})[period];
    const minCount = opts.minCount == null ? 3 : opts.minCount;
    const limit = opts.limit || 10;
    const out = { up: [], down: [], breadth: { up: 0, down: 0, flat: 0, total: 0 }, key, base: null };
    const stocks = payload && payload.stocks;
    if (!key || !stocks) return out;
    const rows = [];
    for (const [ticker, rec] of Object.entries(stocks)) {
      if (!rec || rec.carriedSince || !rec.chg) continue;
      const cnt = num(rec.estimateCount);
      if (minCount > 0 && (cnt == null || cnt < minCount)) continue;
      const v = num(rec.chg[key]);
      if (v == null) continue;
      out.breadth.total += 1;
      if (v > 0) out.breadth.up += 1;
      else if (v < 0) out.breadth.down += 1;
      else out.breadth.flat += 1;
      if (!out.base && rec.chg.base && rec.chg.base[period]) out.base = rec.chg.base[period];
      rows.push({ ticker, chg: v, count: cnt, target: num(rec.targetPrice), fy: rec.chg.fy || rec.estimateFy || "",
        op: num(rec.operatingEstimate) });
    }
    out.up = rows.filter((r) => r.chg > 0).sort((a, b) => b.chg - a.chg || a.ticker.localeCompare(b.ticker)).slice(0, limit);
    out.down = rows.filter((r) => r.chg < 0).sort((a, b) => a.chg - b.chg || a.ticker.localeCompare(b.ticker)).slice(0, limit);
    return out;
  }

  /** 내 종목 중 1주 목표가 변화가 있는 것(0 제외) → [{ticker, tp1w, tp1m}] 변화 큰 순. */
  function mine(payload, tickers) {
    const stocks = payload && payload.stocks;
    if (!stocks) return [];
    const out = [];
    for (const t of tickers || []) {
      const rec = stocks[String(t)];
      if (!rec || rec.carriedSince || !rec.chg) continue;
      const w = num(rec.chg.tp1w);
      if (w == null || w === 0) continue;
      out.push({ ticker: String(t), tp1w: w, tp1m: num(rec.chg.tp1m), target: num(rec.targetPrice) });
    }
    return out.sort((a, b) => Math.abs(b.tp1w) - Math.abs(a.tp1w));
  }

  /** 카드용 한 줄 값: [{label, v, unit}] — 있는 기간만. */
  function cardRows(chg) {
    if (!chg) return [];
    const rows = [];
    const pair = (label, a, b, unit) => {
      const x = num(chg[a]);
      const y = num(chg[b]);
      if (x == null && y == null) return;
      rows.push({ label, m1: x, m3: y, unit });
    };
    pair("목표주가", "tp1m", "tp3m", "%");
    pair(`추정 매출${chg.fy ? ` (${chg.fy})` : ""}`, "r1m", "r3m", "%");
    pair(`추정 영업이익${chg.fy ? ` (${chg.fy})` : ""}`, "o1m", "o3m", "%");
    if (chg.fy2) {
      pair(`추정 매출 (${chg.fy2})`, "r2m", "_none", "%");
      pair(`추정 영업이익 (${chg.fy2})`, "o2m", "_none", "%");
    }
    pair("투자의견 점수", "op1m", "op3m", "점");
    return rows;
  }

  /** ▲3.2% / ▼1.0% / 0.0% / — */
  function arrow(v, unit = "%", digits) {
    const n = num(v);
    if (n == null) return "—";
    const d = digits == null ? (unit === "점" ? 2 : 1) : digits;
    const body = `${Math.abs(n).toFixed(d)}${unit === "%" ? "%" : "점"}`;
    if (n > 0) return `▲${body}`;
    if (n < 0) return `▼${body}`;
    return `${(0).toFixed(d)}${unit === "%" ? "%" : "점"}`;
  }

  const api = { moves, mine, cardRows, arrow };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirKrConsMovesCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
