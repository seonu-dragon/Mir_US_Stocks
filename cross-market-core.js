// cross-market-core.js — 국내↔미국 연관 종목의 순수 계산(DOM 없음).
// 데이터: window.CROSS_MARKET_LINKS (scripts/build_cross_market_links.py → data/cross_market_links.js)
//   links[] = { kr, us, type, why, source: "curated"|"auto", n, lagCorr, lagCorrEx, sameCorr, sameCorrEx,
//               strength, sameStrength },  tickers = { us: {T: {name, chg, date, etf}}, kr: {...} }
// 화면은 cross-market.js(종목 상세 카드 + 오늘 탭 요약 카드).
// node 테스트: scripts/tests/test_cross_market_core.mjs
(function (root) {
  "use strict";

  const STRENGTH_LABEL = {
    strong: "관계 뚜렷",
    moderate: "관계 보통",
    weak: "관계 약함",
    insufficient: "표본 부족",
  };
  const STRENGTH_RANK = { strong: 3, moderate: 2, weak: 1, insufficient: 0 };
  const DEFAULT_TYPE_LABELS = {
    customer: "고객사", supplier: "공급사", competitor: "경쟁사", peer: "같은 업종", theme: "연관 산업", auto: "데이터 후보",
  };

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function validPayload(p) {
    return !!(p && Array.isArray(p.links) && p.tickers && p.tickers.us && p.tickers.kr);
  }

  function typeLabel(p, type) {
    if (type === "auto") return DEFAULT_TYPE_LABELS.auto;
    const labels = (p && p.typeLabels) || {};
    return labels[type] || DEFAULT_TYPE_LABELS[type] || type || "";
  }

  // 한 관계를 '보는 쪽 시장' 기준 행으로 편다. view = 지금 보고 있는 시장("kr"|"us").
  // 상관은 방향이 둘이다 — lag(미국 D일 → 국내 다음 거래일), same(같은 날 국내 → 그날 밤 미국).
  function toRow(p, link, view) {
    const otherMarket = view === "kr" ? "us" : "kr";
    const other = view === "kr" ? link.us : link.kr;
    const meta = (p.tickers[otherMarket] || {})[other] || {};
    return {
      ticker: other,
      market: otherMarket,
      name: meta.name || other,
      chg: num(meta.chg),
      date: meta.date || null,
      etf: !!meta.etf,
      type: link.type,
      typeLabel: typeLabel(p, link.type),
      why: link.why || "",
      source: link.source === "auto" ? "auto" : "curated",
      n: num(link.n) || 0,
      lagCorr: num(link.lagCorr),
      lagCorrEx: num(link.lagCorrEx),
      sameCorr: num(link.sameCorr),
      sameCorrEx: num(link.sameCorrEx),
      strength: link.strength || "insufficient",
      sameStrength: link.sameStrength || "insufficient",
    };
  }

  // 정렬: 사람이 정한 관계 먼저 → 강도 → 편상관 크기.
  function compareRows(a, b, key = "strength", corrKey = "lagCorrEx") {
    if (a.source !== b.source) return a.source === "curated" ? -1 : 1;
    const s = (STRENGTH_RANK[b[key]] || 0) - (STRENGTH_RANK[a[key]] || 0);
    if (s) return s;
    return (num(b[corrKey]) ?? -9) - (num(a[corrKey]) ?? -9);
  }

  // 종목 상세 카드: 이 종목과 연결된 상대 시장 종목. { curated: [...], auto: [...] }
  function linksFor(p, view, ticker, { autoLimit = 3 } = {}) {
    if (!validPayload(p) || !ticker) return { curated: [], auto: [] };
    const t = String(ticker).toUpperCase();
    const key = view === "kr" ? "kr" : "us";
    const rows = p.links
      .filter((l) => String(l[key] || "").toUpperCase() === t)
      .map((l) => toRow(p, l, key));
    rows.sort((a, b) => compareRows(a, b));
    return {
      curated: rows.filter((r) => r.source === "curated"),
      // 자동 후보는 데이터가 뚜렷하게 받쳐 줄 때만(문턱은 빌더가 이미 걸렀지만 표본 부족은 뺀다).
      auto: rows.filter((r) => r.source === "auto" && r.strength !== "insufficient").slice(0, autoLimit),
    };
  }

  // 오늘 탭 요약 카드.
  //   from = "us": 간밤 미국장에서 크게 움직인 미국 종목 → 연결된 국내 종목(lag 방향, KR 모드용)
  //   from = "kr": 오늘 국내장에서 크게 움직인 국내 종목 → 연결된 미국 종목(same 방향, US 모드용)
  // 표본 부족 관계는 빼고, 자동 후보는 '뚜렷'한 것만 넣는다. 사실(등락·관계·과거 상관)만 돌려준다.
  function moveBoard(p, from, { minAbs = 2, limit = 6, perTicker = 4 } = {}) {
    if (!validPayload(p)) return { rows: [], asOf: null, minAbs };
    const fromKey = from === "kr" ? "kr" : "us";
    const strengthKey = fromKey === "us" ? "strength" : "sameStrength";
    const corrKey = fromKey === "us" ? "lagCorrEx" : "sameCorrEx";
    const byMover = new Map();
    p.links.forEach((l) => {
      const mover = l[fromKey];
      if (!mover) return;
      const row = toRow(p, l, fromKey); // 움직인 종목 쪽에서 본 상대(연결 종목)
      if (row[strengthKey] === "insufficient") return;
      if (row.source === "auto" && row[strengthKey] !== "strong") return;
      if (!byMover.has(mover)) byMover.set(mover, []);
      byMover.get(mover).push(row);
    });
    const movers = [];
    byMover.forEach((links, t) => {
      const meta = (p.tickers[fromKey] || {})[t] || {};
      const chg = num(meta.chg);
      if (chg == null || Math.abs(chg) < minAbs) return;
      links.sort((a, b) => compareRows(a, b, strengthKey, corrKey));
      movers.push({
        ticker: t, market: fromKey, name: meta.name || t, chg, date: meta.date || null, etf: !!meta.etf,
        links: links.slice(0, perTicker).map((r) => ({ ...r, corrEx: r[corrKey], strengthNow: r[strengthKey] })),
        more: Math.max(0, links.length - perTicker),
      });
    });
    movers.sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg) || String(a.ticker).localeCompare(String(b.ticker)));
    const asOf = fromKey === "us" ? (p.usAsOf || null) : (p.krAsOf || null);
    return { rows: movers.slice(0, limit), total: movers.length, asOf, minAbs };
  }

  function corrText(v) {
    const n = num(v);
    return n == null ? "—" : (n < 0 ? "−" : "") + Math.abs(n).toFixed(2);
  }

  function strengthLabel(s) {
    return STRENGTH_LABEL[s] || STRENGTH_LABEL.insufficient;
  }

  // "2026-09-25" → "9/25(금)". 형식이 아니면 그대로.
  function shortDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return iso || "";
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const wd = "일월화수목금토"[d.getUTCDay()];
    return `${+m[2]}/${+m[3]}(${wd})`;
  }

  const api = { linksFor, moveBoard, corrText, strengthLabel, shortDate, typeLabel, STRENGTH_LABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirCrossMarketCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
