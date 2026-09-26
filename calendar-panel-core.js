// 통합 캘린더 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirCalendarCore, node 테스트(scripts/tests/test_calendar_panel_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 하는 일
// - 날짜 계산(YYYY-MM-DD 문자열만 다룬다 — 시간대 섞임을 피하려고 Date 는 UTC 자정으로만 쓴다)
// - 주/월 미니 달력 격자(일요일 시작)
// - 데이터셋별 정규화: 휴장·만기·FOMC(MARKET_CALENDAR), 국내 IR(KR_IR_SCHEDULE), 미국 실적·배당락
//   (US_STOCK_CALENDAR + 실적 스냅샷), 국내 배당(KR_DIVIDENDS), 공모주(IPO_CALENDAR), 경제지표(워커 ?calendar=1)
// - 칩·관심종목 필터, 날짜별 묶음
// 이벤트 모양: { id, date, time, kind, market, title, name, ticker, info, link, sub }
(function (root) {
  "use strict";

  const KINDS = [
    { id: "all", label: "전체" },
    { id: "earnings", label: "실적" },
    { id: "dividend", label: "배당" },
    { id: "ipo", label: "공모주" },
    { id: "econ", label: "경제지표" },
    { id: "holiday", label: "휴장" },
    { id: "expiry", label: "만기" },
  ];
  const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.id, k.label]));
  // 종목에 붙는 일정(관심종목만 보기가 거르는 대상). 휴장·만기·경제지표는 시장 전체 일정이라 그대로 둔다.
  const STOCK_KINDS = new Set(["earnings", "dividend", "ipo"]);
  const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

  function pad(n) { return String(n).padStart(2, "0"); }

  function toIso(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

  /** '2026-09-24' · '2026.09.24' · '2026/09/24' · '20260924' → '2026-09-24' (아니면 null) */
  function normIso(value) {
    if (!value) return null;
    const s = String(value).trim();
    let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return toIso(y, mo, d);
  }

  function utc(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }
  function fromUtc(ms) {
    const dt = new Date(ms);
    return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  function addDays(iso, n) { return fromUtc(utc(iso) + n * 86400000); }
  function weekday(iso) { return new Date(utc(iso)).getUTCDay(); }
  function dayDiff(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }

  /** 한국 시간 오늘(브라우저 시간대와 무관). */
  function kstToday(now) {
    const ms = (now instanceof Date ? now.getTime() : Date.now()) + 9 * 3600000;
    return fromUtc(ms);
  }

  function addMonths(iso, n) {
    const [y, m] = iso.split("-").map(Number);
    const idx = y * 12 + (m - 1) + n;
    return toIso(Math.floor(idx / 12), (idx % 12) + 1, 1);
  }

  /** 주 보기: 일요일 시작 7일. */
  function weekRange(iso) {
    const start = addDays(iso, -weekday(iso));
    return { start, end: addDays(start, 6) };
  }

  /** 월 보기 격자: 일요일 시작 주 배열(각 7칸 {iso, inMonth}). */
  function monthGrid(iso) {
    const first = `${iso.slice(0, 7)}-01`;
    const nextFirst = addMonths(first, 1);
    const last = addDays(nextFirst, -1);
    let cur = addDays(first, -weekday(first));
    const end = addDays(last, 6 - weekday(last));
    const weeks = [];
    while (cur <= end) {
      const row = [];
      for (let i = 0; i < 7; i += 1) {
        row.push({ iso: cur, inMonth: cur.slice(0, 7) === first.slice(0, 7) });
        cur = addDays(cur, 1);
      }
      weeks.push(row);
    }
    return weeks;
  }

  function rangeFor(view, anchor) {
    if (view === "month") {
      const first = `${anchor.slice(0, 7)}-01`;
      return { start: first, end: addDays(addMonths(first, 1), -1) };
    }
    // 주 보기는 기준일부터 7일(오늘을 기준으로 열면 지난 요일이 목록을 차지하지 않는다).
    return { start: anchor, end: addDays(anchor, 6) };
  }

  function dayLabel(iso) {
    const [, m, d] = iso.split("-").map(Number);
    return `${m}월 ${d}일 (${WEEKDAY_KO[weekday(iso)]})`;
  }

  function fmtNum(v, digits) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("en-US", { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
  }

  // ---------------------------------------------------------------------------
  // 정규화
  // ---------------------------------------------------------------------------
  const MARKET_LABEL = { kr: "한국", us: "미국" };

  function fromMarketCalendar(payload) {
    const out = [];
    ((payload && payload.events) || []).forEach((e) => {
      const date = normIso(e.date);
      if (!date) return;
      if (e.kind === "holiday" || e.kind === "early_close") {
        out.push({
          id: `mc-${e.kind}-${e.market}-${date}`, date, kind: "holiday", market: e.market,
          title: e.kind === "holiday" ? `${MARKET_LABEL[e.market] || ""} 휴장` : `${MARKET_LABEL[e.market] || ""} 단축 거래`,
          name: e.name || "", info: e.detail || "",
        });
      } else if (e.kind === "expiry") {
        out.push({ id: `mc-exp-${e.market}-${date}`, date, kind: "expiry", market: e.market,
          title: e.title || "파생상품 만기", info: e.detail || "", sub: e.quarterly ? "동시 만기" : "" });
      } else if (e.kind === "fomc") {
        out.push({ id: `mc-fomc-${date}`, date, time: e.time || "", kind: "econ", market: "us",
          title: e.title || "FOMC 기준금리 결정", info: e.detail || "", link: e.url || "", important: true });
      }
    });
    return out;
  }

  function fromKrIr(payload) {
    return ((payload && payload.rows) || [])
      .filter((r) => r && r.earnings && normIso(r.date))
      .map((r) => ({
        id: `kr-ir-${r.rcept}`, date: normIso(r.date), time: r.time || "", kind: "earnings", market: "kr",
        title: "실적 발표(IR)", ticker: String(r.code || ""), name: r.company || "",
        info: r.purpose || "", link: r.link || "",
      }));
  }

  /** 미국 실적 예정일(두 소스 중 floor 이후 가장 이른 날) + 배당락일. names: 티커 → 회사명. */
  function fromUsCalendar(usCal, earnSnap, names, floorIso) {
    const out = [];
    const stocks = (usCal && usCal.stocks) || {};
    const earn = {};
    const offer = (t, d, src) => {
      const iso = normIso(d);
      if (!t || !iso || (floorIso && iso < floorIso)) return;
      if (!earn[t] || iso < earn[t].date) earn[t] = { date: iso, src };
    };
    ((earnSnap && earnSnap.earnings) || []).forEach((r) => offer(String(r.ticker || ""), r.nextDate, "yf"));
    Object.keys(stocks).forEach((t) => offer(t, (stocks[t] || {}).nextEarnings, "qs"));
    Object.keys(earn).forEach((t) => {
      out.push({ id: `us-earn-${t}-${earn[t].date}`, date: earn[t].date, kind: "earnings", market: "us",
        title: "실적 발표 예정", ticker: t, name: (names && names[t]) || "", info: "예정일(회사 확정 전에는 추정일일 수 있음)" });
    });
    Object.keys(stocks).forEach((t) => {
      const r = stocks[t] || {};
      const iso = normIso(r.exDate);
      if (!iso) return;
      const rate = Number(r.divRate);
      const info = Number.isFinite(rate) && rate > 0 ? `연간 주당 배당금 $${fmtNum(rate, 2)}` : "";
      out.push({ id: `us-exdiv-${t}-${iso}`, date: iso, kind: "dividend", market: "us", title: "배당락일",
        ticker: t, name: (names && names[t]) || "", info });
    });
    return out;
  }

  /** 국내 배당: 정정 공시가 원 공시와 함께 오므로 (종목·배당종류·기준일)마다 가장 늦은 공시만. */
  function fromKrDividends(payload) {
    const latest = {};
    ((payload && payload.rows) || []).forEach((r) => {
      if (!r) return;
      const key = `${r.ticker}|${r.divKind}|${r.recordDate}`;
      const cur = latest[key];
      if (!cur || `${r.date || ""}|${r.link || ""}` > `${cur.date || ""}|${cur.link || ""}`) latest[key] = r;
    });
    const out = [];
    Object.values(latest).forEach((r) => {
      const dps = Number(r.dps);
      const parts = [];
      if (Number.isFinite(dps) && dps > 0) parts.push(`주당 배당금 ${fmtNum(dps)}원`);
      if (Number.isFinite(Number(r.yieldPct))) parts.push(`시가배당률 ${r.yieldPct}%`);
      const kind = r.divKind || "배당";
      [["recordDate", "배당기준일"], ["payDate", "배당 지급일"]].forEach(([key, label]) => {
        const iso = normIso(r[key]);
        if (!iso) return;
        out.push({ id: `kr-div-${key}-${r.ticker}-${r.divKind}-${r.recordDate}`, date: iso, kind: "dividend", market: "kr",
          title: label, sub: kind, ticker: String(r.ticker || ""), name: r.company || "", info: parts.join(" · "), link: r.link || "" });
      });
    });
    return out;
  }

  function fromIpo(payload, market) {
    const out = [];
    ((payload && payload.ipos) || []).forEach((r) => {
      const iso = normIso(r.fileDate);
      if (!iso || !r) return;
      if (market === "us") {
        if (r.stage !== "priced") return;   // S-1 제출은 일정이 아니다 — 가격 확정(424B4)만
        const price = Number(r.offerPrice);
        out.push({ id: `us-ipo-${r.accession || r.company}`, date: iso, kind: "ipo", market: "us", title: "공모가 확정",
          ticker: r.ticker || "", name: r.company || "", info: Number.isFinite(price) && price > 0 ? `공모가 $${fmtNum(price, 2)}` : "",
          link: r.link || "" });
        return;
      }
      const bidding = String(r.accession || "").startsWith("kr-ipo-bidding-");
      const band = Array.isArray(r.offerPriceBand) && r.offerPriceBand.length === 2 ? r.offerPriceBand : null;
      const parts = [];
      if (Number(r.offerPrice) > 0) parts.push(`확정공모가 ${fmtNum(r.offerPrice)}원`);
      else if (band) parts.push(`희망공모가 ${fmtNum(band[0])}~${fmtNum(band[1])}원`);
      if (r.form) parts.push(`주관 ${r.form}`);
      out.push({ id: `kr-ipo-${r.accession || r.company}`, date: iso, kind: "ipo", market: "kr",
        title: bidding ? "공모 청약 시작" : (r.stage === "priced" ? "신규 상장" : "신규 상장 예정"),
        ticker: r.ticker || "", name: r.company || "", info: parts.join(" · "), link: r.link || "" });
    });
    return out;
  }

  /** 워커 경제지표(investing.com, 한국 시간). 중요도 2 이상 한국·미국만. FOMC 금리 결정은 MARKET_CALENDAR 쪽과 겹쳐 뺀다. */
  function fromEcon(rows) {
    const out = [];
    (rows || []).forEach((r, i) => {
      if (!r) return;
      const imp = Number(r.importance) || 0;
      const country = String(r.country || "");
      if (imp < 2 || (country !== "한국" && country !== "미국")) return;
      const name = String(r.event || "").trim();
      if (!name) return;
      if (country === "미국" && /금리/.test(name) && /결정/.test(name)) return;
      const iso = normIso(r.datetime) || normIso(r.day);
      if (!iso) return;
      const parts = [];
      [["actual", "실제"], ["forecast", "예상"], ["previous", "이전"]].forEach(([k, lab]) => {
        const v = String(r[k] || "").trim();
        if (v) parts.push(`${lab} ${v}`);
      });
      const time = /^\d{1,2}:\d{2}/.test(String(r.time || "")) ? String(r.time).slice(0, 5) : "";
      out.push({ id: `econ-${iso}-${i}`, date: iso, time, kind: "econ", market: country === "한국" ? "kr" : "us",
        title: name, info: parts.join(" · "), important: imp >= 3 });
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // 필터·묶음
  // ---------------------------------------------------------------------------
  function passesWatch(e, watchSet) {
    if (!STOCK_KINDS.has(e.kind)) return true;
    return !!(e.ticker && watchSet && watchSet.has(String(e.ticker).toUpperCase()));
  }

  function filterEvents(events, opts) {
    const o = opts || {};
    return (events || []).filter((e) => {
      if (o.start && e.date < o.start) return false;
      if (o.end && e.date > o.end) return false;
      if (o.kind && o.kind !== "all" && e.kind !== o.kind) return false;
      if (o.watchOnly && !passesWatch(e, o.watchSet)) return false;
      return true;
    });
  }

  function countByKind(events) {
    const c = { all: 0 };
    KINDS.forEach((k) => { c[k.id] = 0; });
    (events || []).forEach((e) => { c.all += 1; c[e.kind] = (c[e.kind] || 0) + 1; });
    return c;
  }

  const KIND_ORDER = { holiday: 0, expiry: 1, econ: 2, earnings: 3, dividend: 4, ipo: 5 };
  function sortEvents(events) {
    return (events || []).slice().sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1)
      : (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || String(a.time || "99").localeCompare(String(b.time || "99"))
        || String(a.name || a.title).localeCompare(String(b.name || b.title))));
  }

  function groupByDate(events) {
    const map = new Map();
    sortEvents(events).forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    return [...map.entries()].map(([date, rows]) => ({ date, rows }));
  }

  /** 날짜 → 그날 있는 종류 집합(달력 점 표시용). */
  function kindsByDate(events) {
    const out = {};
    (events || []).forEach((e) => { (out[e.date] = out[e.date] || new Set()).add(e.kind); });
    return out;
  }

  /** 같은 id 는 한 번만(여러 데이터셋이 같은 일정을 줄 때). */
  function dedupe(events) {
    const seen = new Set();
    return (events || []).filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  }

  const api = {
    KINDS, KIND_LABEL, STOCK_KINDS, WEEKDAY_KO,
    normIso, addDays, addMonths, weekday, dayDiff, kstToday, weekRange, monthGrid, rangeFor, dayLabel,
    fromMarketCalendar, fromKrIr, fromUsCalendar, fromKrDividends, fromIpo, fromEcon,
    filterEvents, countByKind, sortEvents, groupByDate, kindsByDate, dedupe, passesWatch,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirCalendarCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
