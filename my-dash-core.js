// 내 대시보드(위젯 고르기·순서) — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirDashCore, node 테스트 scripts/tests/test_my_dash_core.mjs.
// 레이아웃 = 위젯 id 배열(위에서 아래 순서). 시장마다 따로(같은 위젯도 미국·국내 데이터가 다르다).
(function (root) {
  "use strict";

  // id → { label, markets } — 국내에 없는 데이터(이상 옵션 거래)는 미국에서만 고를 수 있다.
  const WIDGETS = {
    regime: { label: "오늘 시장 한 줄", markets: ["us", "kr"] },
    watch: { label: "관심 종목 시세", markets: ["us", "kr"] },
    sectors: { label: "섹터 강약", markets: ["us", "kr"] },
    breadth: { label: "시장 폭", markets: ["us", "kr"] },
    issues: { label: "오늘의 이슈", markets: ["us", "kr"] },
    movers: { label: "오늘의 특징주", markets: ["us", "kr"] },
    uoa: { label: "이상 옵션 거래", markets: ["us"] },
    upcoming: { label: "내 종목 다가오는 실적", markets: ["us", "kr"] },
    industry: { label: "내 종목 관련 산업 지표", markets: ["us", "kr"] },
    filings: { label: "내 종목 최근 공시", markets: ["us", "kr"] },
    insider: { label: "내 종목 내부자 매매", markets: ["us"] },
    targets: { label: "내 종목 목표가·의견 변경", markets: ["us", "kr"] },
    calendar: { label: "다가오는 시장 일정", markets: ["us", "kr"] },
  };
  const DEFAULT = ["regime", "watch", "issues", "movers"];

  function available(market) {
    return Object.keys(WIDGETS).filter((id) => WIDGETS[id].markets.includes(market));
  }

  /** 저장값 → 유효한 레이아웃(모르는 id·다른 시장 전용·중복 제거). 비었거나 깨졌으면 기본값. */
  function sanitize(raw, market) {
    const ok = new Set(available(market));
    const list = Array.isArray(raw) ? raw : null;
    if (!list) return DEFAULT.filter((id) => ok.has(id));
    return [...new Set(list.map(String))].filter((id) => ok.has(id));
  }

  function add(layout, id, market) {
    return available(market).includes(id) && !layout.includes(id) ? [...layout, id] : layout.slice();
  }

  function remove(layout, id) {
    return layout.filter((x) => x !== id);
  }

  /** delta -1 위로 · +1 아래로. 끝을 넘으면 그대로. */
  function move(layout, id, delta) {
    const i = layout.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= layout.length) return layout.slice();
    const out = layout.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  }

  /** 아직 추가하지 않은 위젯 [{id, label}]. */
  function addable(layout, market) {
    return available(market).filter((id) => !layout.includes(id)).map((id) => ({ id, label: WIDGETS[id].label }));
  }

  /** 실적 일정 행 [{ticker, nextDate}] → today(YYYY-MM-DD)부터 days 일 안, 날짜순. 지난 날짜·형식 오류는 뺀다. */
  function upcomingEarnings(rows, today, days = 30) {
    const t0 = Date.parse(`${today}T00:00:00Z`);
    if (!Number.isFinite(t0)) return [];
    const out = [];
    for (const r of rows || []) {
      const t = Date.parse(`${String(r && r.nextDate || "").slice(0, 10)}T00:00:00Z`);
      if (!Number.isFinite(t)) continue;
      const d = Math.round((t - t0) / 86400000);
      if (d >= 0 && d <= days) out.push({ ...r, daysAhead: d });
    }
    return out.sort((a, b) => a.daysAhead - b.daysAhead || String(a.ticker).localeCompare(String(b.ticker)));
  }

  /** '다음 실적' 행 중 nextDate 가 today(YYYY-MM-DD)보다 이른 행을 뺀다(지난 분기 날짜가 남은 경우). 형식 오류도 뺀다.
   *  today 가 형식 오류면 그대로 돌려준다. 추정치로 바꿔 채우지 않는다. */
  function dropPastEarnings(rows, today) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || ""))) return (rows || []).slice();
    return (rows || []).filter((r) => {
      const d = String((r && r.nextDate) || "").slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today;
    });
  }

  /** 종목별 관련 지표 id 목록 {T: [id…]} → 겹침 많은 순 [{id, tickers}] (내 종목 여럿이 같이 따르는 지표가 위). */
  function relatedIndicators(byTicker, tickers, limit = 8) {
    const hit = new Map();
    for (const t of tickers || []) {
      for (const id of (byTicker && byTicker[t]) || []) {
        if (!hit.has(id)) hit.set(id, []);
        if (!hit.get(id).includes(t)) hit.get(id).push(t);
      }
    }
    return [...hit.entries()].map(([id, ts]) => ({ id, tickers: ts }))
      .sort((a, b) => b.tickers.length - a.tickers.length || a.id.localeCompare(b.id)).slice(0, limit);
  }

  /** 행 [{ticker, fileDate}] → 내 종목이고 today 로부터 days 일 안(미래 날짜 포함 안 함), 최신순. */
  function recentMine(rows, tickers, today, days = 14) {
    const mine = new Set((tickers || []).map(String));
    const t0 = Date.parse(`${today}T00:00:00Z`);
    if (!Number.isFinite(t0) || !mine.size) return [];
    return (rows || []).filter((r) => {
      if (!r || !mine.has(String(r.ticker))) return false;
      const t = Date.parse(`${String(r.fileDate || "").slice(0, 10)}T00:00:00Z`);
      const d = (t0 - t) / 86400000;
      return Number.isFinite(t) && d >= 0 && d <= days;
    }).sort((a, b) => String(b.fileDate).localeCompare(String(a.fileDate)));
  }

  /** 내부자 거래 중 장내 매수(P)·매도(S)만 — 부여·옵션행사·세금정산은 판단 신호가 아니다. */
  function openMarketTrades(rows) {
    return (rows || []).filter((r) => r && (r.code === "P" || r.code === "S"));
  }

  /** 한 공시에 여러 줄로 나뉜 거래(같은 날 여러 체결가)를 사람·날짜·매수/매도별 한 줄로 — 금액·주식 수 합계, 줄 수(n). */
  function groupTrades(rows) {
    const by = new Map();
    for (const r of rows || []) {
      const k = [r.ticker, r.owner || r.relation, r.fileDate, r.code].join("|");
      const g = by.get(k);
      if (g) { g.value += Number(r.value) || 0; g.shares += Number(r.shares) || 0; g.n += 1; }
      else by.set(k, { ...r, value: Number(r.value) || 0, shares: Number(r.shares) || 0, n: 1 });
    }
    return [...by.values()];
  }

  /** 미국 의견 변경(cols/rows 표) · 국내 목표가 변경(changes 목록) → [{ticker, fileDate, firm, pt, ptPrev, dir, note}].
   *  dir: 1 목표가↑·상향, -1 목표가↓·하향, 0 유지. */
  function targetChanges(payload, market) {
    if (!payload) return [];
    if (market === "kr") {
      return (payload.changes || []).map((c) => ({ ticker: String(c.code), fileDate: c.date, firm: c.broker, pt: c.target, ptPrev: c.prev,
        dir: c.target > c.prev ? 1 : c.target < c.prev ? -1 : 0, note: c.opinion || "" }));
    }
    const cols = payload.cols || [];
    const at = (r, k) => r[cols.indexOf(k)];
    return (payload.rows || []).map((r) => {
      const act = at(r, "act");
      const pt = at(r, "pt");
      const prev = at(r, "ptPrev");
      const dir = act === "up" ? 1 : act === "down" ? -1 : pt != null && prev != null ? Math.sign(pt - prev) : 0;
      const rating = at(r, "from") && at(r, "to") && at(r, "from") !== at(r, "to") ? `${at(r, "from")} → ${at(r, "to")}` : (at(r, "to") || "");
      return { ticker: String(at(r, "t")), fileDate: at(r, "d"), firm: at(r, "firm"), pt, ptPrev: prev, dir, note: rating };
    });
  }

  /** 휴장·만기·FOMC(MARKET_CALENDAR) + 경제지표 발표(INDUSTRY_CALENDAR, 미국 지표 위주) → today 부터 days 일 안, 날짜·시각순.
   *  시장 일정은 지금 시장 것만(국내 화면에 미국 옵션 만기를 섞지 않는다). FOMC 는 두 시장 모두에 보인다. */
  function upcomingSchedule(marketCal, industryCal, market, today, days = 14) {
    const t0 = Date.parse(`${today}T00:00:00Z`);
    if (!Number.isFinite(t0)) return [];
    const within = (d) => {
      const t = Date.parse(`${String(d || "").slice(0, 10)}T00:00:00Z`);
      const n = Math.round((t - t0) / 86400000);
      return Number.isFinite(t) && n >= 0 && n <= days ? n : null;
    };
    const out = [];
    for (const e of (marketCal && marketCal.events) || []) {
      if (e.market !== market && e.kind !== "fomc") continue;
      const n = within(e.date);
      if (n != null) out.push({ date: e.date, time: e.time || "", title: e.title, kind: e.kind, daysAhead: n });
    }
    // 같은 날·시각 지표 발표(연준 주간 H.4.1·H.8 자료 5건 등)는 한 줄로 — 줄을 다 차지해 FOMC 가 밀려나던 것.
    const rel = new Map();
    for (const e of (industryCal && industryCal.events) || []) {
      const n = within(e.date);
      if (n == null) continue;
      const k = `${e.date}|${e.time_kst || ""}`;
      if (rel.has(k)) rel.get(k).more += 1;
      else rel.set(k, { date: e.date, time: e.time_kst || "", title: e.name_kr, kind: "release", daysAhead: n, more: 0 });
    }
    for (const r of rel.values()) out.push({ ...r, title: r.more ? `${r.title} 외 ${r.more}건` : r.title });
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
  }

  const api = { upcomingSchedule, targetChanges, WIDGETS, DEFAULT, available, sanitize, add, remove, move, addable, upcomingEarnings, dropPastEarnings, relatedIndicators,
    recentMine, openMarketTrades, groupTrades };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirDashCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
