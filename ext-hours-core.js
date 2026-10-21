// 프리·애프터마켓 급등락 + 상대거래량 급증 보드(ext-hours.js) — 순수 계산 모듈(DOM·네트워크 없음).
// 브라우저에서는 window.MirExtHoursCore, node 테스트(scripts/tests/test_ext_hours_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 데이터: TradingView 스크리너 비공식 엔드포인트 POST https://scanner.tradingview.com/america/scan
// (리버스엔지니어링 오픈소스 shner-elmo/TradingView-Screener 참고). 실측(2026-10-21):
// - 응답 { totalCount, data:[{ s:"NASDAQ:NVDA", d:[columns 순서 값] }] }.
// - CORS 는 Origin 을 그대로 반사하지만 preflight 허용 헤더가 Referer,Accept 뿐이다 → Content-Type 을
//   직접 넣으면 preflight 가 실패한다. body 에 JSON 문자열만 넣어 text/plain(단순 요청)으로 보낸다.
// - 비로그인 값은 update_mode "delayed_streaming_900"(15분 지연).
// - premarket_time / postmarket_time / time 은 각 세션 시작 시각(epoch 초, 04:00 / 16:00 / 09:30 ET).
//   새 세션 체결이 아직 없는 종목은 전날 세션 값을 그대로 들고 있어서, 세션 시작 시각 이상만 거른다.
// - /korea/scan 은 premarket_* / postmarket_* 가 전부 null(KRX 장전·장후 시간외 데이터 없음) — KR 은 끈다.
(function (root) {
  "use strict";

  const ENDPOINT = "https://scanner.tradingview.com/america/scan";
  const POLL_MS = 2 * 60 * 1000;
  const TZ = "America/New_York";
  // 분(자정부터, ET)
  const PRE_OPEN = 4 * 60;
  const REG_OPEN = 9 * 60 + 30;
  const REG_CLOSE = 16 * 60;
  const POST_SPAN = 4 * 60; // 정규장 마감 뒤 4시간(단축 거래일 13:00 마감이면 17:00 까지)

  const COLUMNS = [
    "name", "description", "close", "change", "volume", "relative_volume_10d_calc", "average_volume_10d_calc",
    "premarket_close", "premarket_change", "premarket_volume", "premarket_time",
    "postmarket_close", "postmarket_change", "postmarket_volume", "postmarket_time",
    "time", "market_cap_basic", "sector", "update_mode",
  ];

  // 세션별로 읽을 열. closed(장외 시간·주말·휴장)는 마지막 애프터 세션을 보여 준다.
  const FIELDS = {
    pre: { price: "premarket_close", chg: "premarket_change", vol: "premarket_volume", time: "premarket_time" },
    regular: { price: "close", chg: "change", vol: "volume", time: "time" },
    post: { price: "postmarket_close", chg: "postmarket_change", vol: "postmarket_volume", time: "postmarket_time" },
  };
  FIELDS.closed = FIELDS.post;

  const SESSION_LABEL = { pre: "프리마켓", regular: "정규장", post: "애프터마켓", closed: "애프터마켓" };

  // 대상: 미국 3대 거래소 상장 보통주·DR, 1차 상장, 시총 20억 달러 이상(오늘의 특징주 대형주 하한과 같다),
  // 주가 2달러 이상. 거래량 하한은 세션별(프리·애프터는 체결이 얇다).
  const MIN_MCAP = 2e9;
  const MIN_PRICE = 2;
  const MIN_VOL = { pre: 20000, post: 20000, closed: 20000, regular: 500000 };
  const LIMIT = 20;
  // 프리·애프터의 '거래량 급증'은 서버가 비율로 정렬하지 못해 세션 거래량 상위 N 을 받아 비율로 다시 정렬한다.
  const SURGE_POOL = 100;

  const _fmt = {};
  function zoneParts(ms, tz) {
    const zone = tz || TZ;
    if (!_fmt[zone]) {
      _fmt[zone] = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
      });
    }
    const p = {};
    _fmt[zone].formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
    const hour = Number(p.hour) % 24;
    const y = Number(p.year), mo = Number(p.month), d = Number(p.day);
    const wallUtc = Date.UTC(y, mo - 1, d, hour, Number(p.minute), Number(p.second));
    const offsetMin = Math.round((wallUtc - Math.floor(ms / 1000) * 1000) / 60000);
    return {
      date: `${p.year}-${p.month}-${p.day}`, y, mo, d,
      min: hour * 60 + Number(p.minute), offsetMin,
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
    };
  }

  function parseHm(text) {
    const m = String(text || "").match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  // ET 벽시계(그날, 분) → epoch 초
  function etEpochSec(z, min) {
    return Math.round((Date.UTC(z.y, z.mo - 1, z.d, 0, min) - z.offsetMin * 60000) / 1000);
  }

  // 지금 미국 시장이 어느 세션인가. events = MARKET_CALENDAR.events(휴장·단축 거래).
  // → { session: pre|regular|post|closed, date, sinceSec(세션 시작 epoch 초, closed 는 null), polling }
  function sessionAt(nowMs, events) {
    const z = zoneParts(nowMs, TZ);
    const todays = (Array.isArray(events) ? events : []).filter((e) => e && e.market === "us" && e.date === z.date);
    const base = { date: z.date, nowMin: z.min, holidayName: "" };
    if (z.weekday === 0 || z.weekday === 6) return { ...base, session: "closed", reason: "weekend", sinceSec: null, polling: false };
    const hol = todays.find((e) => e.kind === "holiday");
    if (hol) return { ...base, session: "closed", reason: "holiday", holidayName: String(hol.name || ""), sinceSec: null, polling: false };
    const early = todays.find((e) => e.kind === "early_close");
    const close = early && parseHm(early.detail) != null ? parseHm(early.detail) : REG_CLOSE;
    const postEnd = close + POST_SPAN;
    let session = "closed";
    let start = null;
    if (z.min >= PRE_OPEN && z.min < REG_OPEN) { session = "pre"; start = PRE_OPEN; }
    else if (z.min >= REG_OPEN && z.min < close) { session = "regular"; start = REG_OPEN; }
    else if (z.min >= close && z.min < postEnd) { session = "post"; start = close; }
    return {
      ...base, session, close, postEnd,
      reason: session === "closed" ? (z.min < PRE_OPEN ? "overnight" : "after") : "",
      sinceSec: start == null ? null : etEpochSec(z, start),
      polling: session !== "closed",
    };
  }

  // 요청 바디. tab: up | down | surge
  function buildScanBody(session, tab, opts) {
    const o = opts || {};
    const s = FIELDS[session] ? session : "closed";
    const f = FIELDS[s];
    const limit = Math.max(1, Math.min(50, Number(o.limit) || LIMIT));
    const filter = [
      { left: "market_cap_basic", operation: "greater", right: o.minMcap != null ? o.minMcap : MIN_MCAP },
      { left: "exchange", operation: "in_range", right: ["NASDAQ", "NYSE", "AMEX"] },
      { left: "type", operation: "in_range", right: ["stock", "dr"] },
      { left: "is_primary", operation: "equal", right: true },
      { left: f.price, operation: "egreater", right: MIN_PRICE },
      { left: f.vol, operation: "egreater", right: MIN_VOL[s] },
    ];
    if (o.sinceSec != null && Number.isFinite(Number(o.sinceSec))) {
      filter.push({ left: f.time, operation: "egreater", right: Number(o.sinceSec) });
    }
    let sort;
    let range = [0, limit];
    if (tab === "surge") {
      if (s === "regular") {
        sort = { sortBy: "relative_volume_10d_calc", sortOrder: "desc" };
      } else {
        sort = { sortBy: f.vol, sortOrder: "desc" };
        range = [0, SURGE_POOL];
      }
    } else {
      const down = tab === "down";
      filter.push({ left: f.chg, operation: down ? "less" : "greater", right: 0 });
      sort = { sortBy: f.chg, sortOrder: down ? "asc" : "desc" };
    }
    return { columns: COLUMNS.slice(), filter, sort, range, options: { lang: "en" } };
  }

  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function delayMinOf(mode) {
    const m = String(mode || "").match(/delayed[a-z_]*?_(\d+)$/i);
    return m ? Math.round(Number(m[1]) / 60) : 0;
  }

  // 응답 → 화면 행. 숫자가 없는 행은 버린다(지어낸 값 금지). surge 는 비율로 다시 정렬한다.
  function parseScanResponse(json, session, tab, opts) {
    const o = opts || {};
    const s = FIELDS[session] ? session : "closed";
    const f = FIELDS[s];
    const limit = Number(o.limit) || LIMIT;
    if (!json || !Array.isArray(json.data)) return null;
    const idx = {};
    COLUMNS.forEach((c, i) => { idx[c] = i; });
    let delayMin = 0;
    const rows = [];
    json.data.forEach((item) => {
      if (!item || !Array.isArray(item.d)) return;
      const d = item.d;
      const get = (c) => d[idx[c]];
      const sym = String(item.s || "");
      const ticker = String(get("name") || sym.split(":").pop() || "").trim();
      const chg = num(get(f.chg));
      const price = num(get(f.price));
      const vol = num(get(f.vol));
      if (!ticker || chg == null || price == null) return;
      const avgVol = num(get("average_volume_10d_calc"));
      let rel = null;
      let relKind = "";
      if (s === "regular") {
        rel = num(get("relative_volume_10d_calc"));
        relKind = "rvol";
      } else if (vol != null && avgVol != null && avgVol > 0) {
        rel = vol / avgVol;
        relKind = "ofAvg";
      }
      delayMin = Math.max(delayMin, delayMinOf(get("update_mode")));
      rows.push({
        ticker,
        exchange: sym.includes(":") ? sym.split(":")[0] : "",
        name: String(get("description") || ""),
        price, chg, vol, rel, relKind,
        regularChg: s === "regular" ? null : num(get("change")),
        mcap: num(get("market_cap_basic")),
        sector: String(get("sector") || ""),
        sessionTime: num(get(f.time)),
      });
    });
    // closed: 시작 시각 필터 없이 받으므로 가장 최근 세션 값만 남긴다(거래정지 등으로 지난 세션 값을 든 종목 제외).
    let sessionTime = rows.reduce((m, r) => (r.sessionTime != null && r.sessionTime > m ? r.sessionTime : m), 0) || null;
    let out = sessionTime ? rows.filter((r) => r.sessionTime == null || r.sessionTime === sessionTime) : rows;
    if (tab === "surge") {
      out = out.filter((r) => r.rel != null && r.rel > 0).sort((a, b) => b.rel - a.rel);
    }
    out = out.slice(0, limit);
    return { total: num(json.totalCount) || 0, rows: out, delayMin, sessionTime };
  }

  function fmtVol(v) {
    const n = num(v);
    if (n == null) return "—";
    const a = Math.abs(n);
    if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
    if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
    return String(Math.round(n));
  }

  // 상대거래량 표기: 정규장은 '상대거래량 3.4배', 프리·애프터는 '10일 평균 하루 거래량의 35%'
  function fmtRel(row) {
    if (!row || row.rel == null) return "";
    if (row.relKind === "rvol") return `상대거래량 ${row.rel >= 10 ? row.rel.toFixed(0) : row.rel.toFixed(1)}배`;
    const pct = row.rel * 100;
    return `하루 평균의 ${pct >= 100 ? Math.round(pct).toLocaleString("en-US") : pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
  }

  // 세션 라벨: 지금 세션 / 장외면 '<M/D> 애프터마켓 마감'
  function sessionLabel(sess, sessionTimeSec) {
    if (!sess) return "";
    if (sess.session !== "closed") return SESSION_LABEL[sess.session];
    if (sessionTimeSec) {
      const z = zoneParts(sessionTimeSec * 1000, TZ);
      return `${z.mo}/${z.d} 애프터마켓 마감`;
    }
    return "애프터마켓 마감";
  }

  function kstClock(ms) {
    const z = zoneParts(ms, "Asia/Seoul");
    return `${String(Math.floor(z.min / 60)).padStart(2, "0")}:${String(z.min % 60).padStart(2, "0")}`;
  }

  const api = {
    ENDPOINT, POLL_MS, COLUMNS, FIELDS, SESSION_LABEL, LIMIT, SURGE_POOL, MIN_VOL,
    zoneParts, sessionAt, buildScanBody, parseScanResponse, delayMinOf, fmtVol, fmtRel, sessionLabel, kstClock,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirExtHoursCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
