// 가격 차트 지표 목록·검색·파라미터·멀티 차트 레이아웃 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirChartInd, node 테스트(scripts/tests/test_chart_ind_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 지표 id 는 예전 체크박스 id·chartState 키(showSma20 등) 그대로다 — 저장된 프리셋이 이 키로
// 켜고 끄므로 바꾸지 말 것. 파라미터는 chartState.indParams = { <id>: { p, m, ... }, extra: [...] }
// 에 기본값과 다른 것만 담는다(프리셋 JSON 이 짧고, 기본값을 바꾸면 안 건드린 지표도 따라간다).
(function (root) {
  "use strict";

  // 분류: 이동평균 · 채널(밴드·변동성) · 모멘텀 · 거래량 · 추세 · 패턴(가격 레벨·도형) · 상대강도
  const CATEGORIES = [
    ["ma", "이동평균"],
    ["channel", "채널"],
    ["momentum", "모멘텀"],
    ["volume", "거래량"],
    ["trend", "추세"],
    ["pattern", "패턴"],
    ["rs", "상대강도"],
  ];

  const P = (k, def, min, max, step, label) => ({ k, def, min, max, step: step || 1, label: label || "" });
  const per = (def, max) => P("p", def, 2, max || 250, 1, "기간");
  const sigma = (def) => P("m", def, 0.5, 5, 0.1, "배수");

  // short: 칩·차트 범례에 쓰는 이름(파라미터 표기 앞부분). ko/en/alias 는 검색어.
  // fmt: 라벨의 괄호 안 순서(params 의 k). 비어 있으면 괄호 없이 short 만.
  const CATALOG = [
    { id: "showSma5", short: "SMA", ko: "단순 이동평균", en: "simple moving average", alias: ["이평", "이동평균선", "ma"], cat: "ma", params: [per(5)], overlay: "#3b82f6" },
    { id: "showSma10", short: "SMA", ko: "단순 이동평균", en: "simple moving average", alias: ["이평", "이동평균선", "ma"], cat: "ma", params: [per(10)], overlay: "#0d9488" },
    { id: "showSma20", short: "SMA", ko: "단순 이동평균", en: "simple moving average", alias: ["이평", "이동평균선", "ma"], cat: "ma", params: [per(20)], overlay: "#8b5cf6" },
    { id: "showSma60", short: "SMA", ko: "단순 이동평균", en: "simple moving average", alias: ["이평", "이동평균선", "ma"], cat: "ma", params: [per(60)], overlay: "#d97706" },
    { id: "showSma120", short: "SMA", ko: "단순 이동평균", en: "simple moving average", alias: ["이평", "이동평균선", "ma"], cat: "ma", params: [per(120)], overlay: "#a16207" },
    { id: "showEma20", short: "EMA", ko: "지수 이동평균", en: "exponential moving average", alias: ["이평", "지수이평"], cat: "ma", params: [per(20)], overlay: "#db2777" },
    { id: "showEma60", short: "EMA", ko: "지수 이동평균", en: "exponential moving average", alias: ["이평", "지수이평"], cat: "ma", params: [per(60)], overlay: "#0284c7" },
    { id: "showVwap", short: "VWAP", ko: "거래량 가중 평균가", en: "volume weighted average price", alias: ["브이왑"], cat: "ma", params: [], overlay: "#ea580c" },
    { id: "showAnchoredVwap", short: "AVWAP", ko: "앵커 VWAP", en: "anchored vwap", alias: ["앵커드"], cat: "ma", params: [] },
    { id: "showBoll", short: "BB", ko: "볼린저 밴드", en: "bollinger bands", alias: ["볼밴", "볼린저"], cat: "channel", params: [per(20, 100), sigma(2)], overlay: "#22d3ee" },
    { id: "showKeltner", short: "Keltner", ko: "켈트너 채널", en: "keltner channel", alias: [], cat: "channel", params: [per(20, 100), sigma(2)], overlay: "#fb7185" },
    { id: "showDonchian", short: "Donchian", ko: "돈치안 채널", en: "donchian channel", alias: ["돈키언"], cat: "channel", params: [per(20, 100)], overlay: "#818cf8" },
    { id: "showAtr", short: "ATR", ko: "평균 실제 범위", en: "average true range", alias: ["변동성"], cat: "channel", params: [per(14, 100)] },
    { id: "showIchimoku", short: "Ichimoku", ko: "일목균형표", en: "ichimoku cloud", alias: ["일목", "구름대"], cat: "trend", params: [] },
    { id: "showSupertrend", short: "Supertrend", ko: "슈퍼트렌드", en: "supertrend", alias: [], cat: "trend", params: [per(10, 100), sigma(3)], overlay: "#22c55e" },
    { id: "showChandelier", short: "Chandelier", ko: "샹들리에 청산", en: "chandelier exit", alias: ["샹들리에"], cat: "trend", params: [] },
    { id: "showTrendlines", short: "추세선", ko: "자동 추세선", en: "auto trendlines", alias: ["trend"], cat: "trend", params: [] },
    { id: "showAdx", short: "ADX", ko: "평균 방향 지수", en: "average directional index dmi", alias: ["방향성", "di"], cat: "trend", params: [per(14, 100)] },
    { id: "showRsi", short: "RSI", ko: "상대강도지수", en: "relative strength index", alias: ["알에스아이"], cat: "momentum", params: [per(14, 100)] },
    { id: "showMacd", short: "MACD", ko: "이동평균 수렴확산", en: "moving average convergence divergence", alias: ["맥디"], cat: "momentum",
      params: [P("f", 12, 2, 100, 1, "단기"), P("s", 26, 3, 200, 1, "장기"), P("g", 9, 2, 50, 1, "시그널")] },
    { id: "showStoch", short: "Stoch", ko: "스토캐스틱", en: "stochastic oscillator", alias: ["스토캐"], cat: "momentum",
      params: [P("k", 14, 2, 100, 1, "%K"), P("d", 3, 1, 20, 1, "%D")] },
    { id: "showRoc", short: "ROC", ko: "변화율", en: "rate of change", alias: [], cat: "momentum", params: [per(12, 100)] },
    { id: "showMomentum", short: "Momentum", ko: "모멘텀", en: "momentum", alias: [], cat: "momentum", params: [per(10, 100)] },
    { id: "showWilliams", short: "Williams %R", ko: "윌리엄스 %R", en: "williams percent r", alias: ["윌리엄스"], cat: "momentum", params: [per(14, 100)] },
    { id: "showCci", short: "CCI", ko: "상품 채널 지수", en: "commodity channel index", alias: [], cat: "momentum", params: [per(20, 100)] },
    { id: "showTtmSqueeze", short: "TTM Squeeze", ko: "TTM 스퀴즈", en: "ttm squeeze", alias: ["스퀴즈"], cat: "momentum", params: [] },
    { id: "showVolume", short: "Volume", ko: "거래량", en: "volume", alias: ["볼륨"], cat: "volume", params: [] },
    { id: "showVolMa20", short: "Vol MA", ko: "거래량 이동평균", en: "volume moving average", alias: ["거래량 이평"], cat: "volume", params: [per(20, 120)] },
    { id: "showVolumeRatio", short: "Volume Ratio", ko: "거래량 비율", en: "volume ratio", alias: [], cat: "volume", params: [] },
    { id: "showObv", short: "OBV", ko: "누적 거래량", en: "on balance volume", alias: [], cat: "volume", params: [] },
    { id: "showAd", short: "A/D", ko: "누적 분산", en: "accumulation distribution", alias: [], cat: "volume", params: [] },
    { id: "showCmf", short: "CMF", ko: "차이킨 자금 흐름", en: "chaikin money flow", alias: ["차이킨"], cat: "volume", params: [per(20, 100)] },
    { id: "showMfi", short: "MFI", ko: "자금 흐름 지수", en: "money flow index", alias: [], cat: "volume", params: [per(14, 100)] },
    { id: "showVolumeProfile", short: "VP", ko: "매물대", en: "volume profile poc hvn", alias: ["볼륨 프로파일"], cat: "volume", params: [] },
    { id: "showSupportResistance", short: "지지/저항", ko: "지지 저항", en: "support resistance", alias: [], cat: "pattern", params: [] },
    { id: "showTechLevels", short: "기술 레벨선", ko: "피벗 피보나치 기술 레벨", en: "pivot fibonacci levels", alias: ["피보", "피벗"], cat: "pattern", params: [] },
    { id: "showPatterns", short: "차트 패턴", ko: "차트 패턴", en: "chart patterns", alias: ["헤드앤숄더", "쌍바닥"], cat: "pattern", params: [] },
    { id: "showMarketStructure", short: "시장구조", ko: "시장구조 고점 저점", en: "market structure hh hl", alias: [], cat: "pattern", params: [] },
    { id: "showGapZones", short: "갭 존", ko: "갭", en: "gap zones", alias: [], cat: "pattern", params: [] },
    { id: "showRsSpy", short: "RS", ko: "상대강도", en: "relative strength", alias: [], cat: "rs", params: [], bench: 0 },
    { id: "showRsQqq", short: "RS", ko: "상대강도", en: "relative strength", alias: [], cat: "rs", params: [], bench: 1 },
    { id: "showRsSector", short: "RS 섹터", ko: "섹터 ETF 대비 상대강도", en: "relative strength sector etf", alias: [], cat: "rs", params: [] },
    { id: "showMansfield", short: "Mansfield RS", ko: "맨스필드 상대강도", en: "mansfield relative strength", alias: [], cat: "rs", params: [] },
  ];
  const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

  // 추가 이평선(같은 지표 여러 개): 고정 슬롯(SMA 5칸·EMA 2칸) 밖에 더 얹는 선. 등락색·기존 이평 색과 겹치지 않게.
  const EXTRA_MAX = 6;
  const EXTRA_COLORS = ["#f97316", "#14b8a6", "#e11d48", "#6366f1", "#84cc16", "#0ea5e9"];
  const EXTRA_TYPES = { sma: "SMA", ema: "EMA" };

  // ----- 파라미터 -----
  function clampParam(spec, raw) {
    let v = Number(raw);
    if (!Number.isFinite(v)) return spec.def;
    v = Math.min(spec.max, Math.max(spec.min, v));
    if (spec.step >= 1) return Math.round(v);
    const dec = String(spec.step).split(".")[1]?.length || 1;
    return Number((Math.round(v / spec.step) * spec.step).toFixed(dec));
  }

  function defaults(id) {
    const e = BY_ID.get(id);
    const out = {};
    if (e) e.params.forEach((s) => { out[s.k] = s.def; });
    return out;
  }

  // 한 지표의 실제 파라미터(기본값 + 저장값, 범위로 자름). MACD 는 단기 < 장기 를 지킨다.
  function get(indParams, id) {
    const e = BY_ID.get(id);
    if (!e) return {};
    const saved = (indParams && typeof indParams === "object" && indParams[id]) || {};
    const out = {};
    e.params.forEach((s) => { out[s.k] = saved[s.k] == null ? s.def : clampParam(s, saved[s.k]); });
    if (id === "showMacd" && out.f >= out.s) out.s = Math.min(200, out.f + 1);
    return out;
  }

  function sanitizeExtra(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    for (const x of list) {
      if (!x || !EXTRA_TYPES[x.t]) continue;
      const p = clampParam(per(20), x.p);
      const key = `${x.t}${p}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ t: x.t, p });
      if (out.length >= EXTRA_MAX) break;
    }
    return out;
  }

  // 저장·프리셋용 정규화: 아는 id 만, 범위로 자르고, 기본값과 같은 키는 뺀다.
  function normalize(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [id, val] of Object.entries(raw)) {
      const e = BY_ID.get(id);
      if (!e || !e.params.length || !val || typeof val !== "object") continue;
      const full = get({ [id]: val }, id);
      const diff = {};
      e.params.forEach((s) => { if (full[s.k] !== s.def) diff[s.k] = full[s.k]; });
      if (Object.keys(diff).length) out[id] = diff;
    }
    const extra = sanitizeExtra(raw.extra);
    if (extra.length) out.extra = extra;
    return out;
  }

  function setParam(indParams, id, key, value) {
    const next = { ...(indParams || {}) };
    next[id] = { ...(next[id] || {}), [key]: value };
    return normalize(next);
  }

  function resetParams(indParams, id) {
    const next = { ...(indParams || {}) };
    delete next[id];
    return normalize(next);
  }

  function serialize(indParams) { return JSON.stringify(normalize(indParams)); }
  function deserialize(text) {
    try { return normalize(JSON.parse(text)); } catch (e) { return {}; }
  }

  // 표시 라벨: "SMA(50)", "BB(20,2)", "MACD(12,26,9)", 파라미터 없는 지표는 short 그대로.
  // opts.bench = [이름1, 이름2] 이면 RS 벤치마크 이름을 붙인다(미국 SPY/QQQ, 국내 코스피200/코스닥150).
  function fmtNum(v) { return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))); }
  function label(indParams, id, opts) {
    const e = BY_ID.get(id);
    if (!e) return String(id || "");
    if (e.bench != null) {
      const b = opts && Array.isArray(opts.bench) ? opts.bench[e.bench] : null;
      return b ? `RS/${b}` : e.short;
    }
    if (!e.params.length) return e.short;
    const p = get(indParams, id);
    return `${e.short}(${e.params.map((s) => fmtNum(p[s.k])).join(",")})`;
  }

  function extraLabel(x) { return `${EXTRA_TYPES[x.t] || "SMA"}(${x.p})`; }

  // ----- 검색(한글·초성·영문) -----
  const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function choOf(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : null;
  }
  function isCho(ch) { return /^[ㄱ-ㅎ]$/.test(ch); }
  function norm(s) { return String(s || "").toLowerCase().replace(/[\s\-_/().,%+]/g, ""); }

  // 질의 q 가 대상 t 의 어딘가와 맞는지. 질의의 자음(ㄱ-ㅎ)은 그 자리 음절의 초성과, 나머지는 글자 그대로 비교한다
  // ("ㅂㄹㅈ" → 볼린저, "볼ㄹ" → 볼린저, "rsi" → RSI). 맞으면 시작 위치(0 = 접두), 아니면 -1.
  function matchAt(t, q) {
    const T = Array.from(t);
    const Q = Array.from(q);
    if (!Q.length) return 0;
    for (let i = 0; i + Q.length <= T.length; i += 1) {
      let ok = true;
      for (let j = 0; j < Q.length; j += 1) {
        const tc = T[i + j];
        const qc = Q[j];
        if (tc === qc) continue;
        if (isCho(qc) && choOf(tc) === qc) continue;
        ok = false;
        break;
      }
      if (ok) return i;
    }
    return -1;
  }

  function haystack(e) {
    return [e.short, e.ko, e.en, ...(e.alias || []), e.id.replace(/^show/, "")].map(norm).filter(Boolean);
  }

  // 점수: 0 = 안 맞음. 이름 접두 > 별칭 접두 > 포함. 빈 질의는 모두 1.
  function matchScore(e, query) {
    const q = norm(query);
    if (!q) return 1;
    let best = 0;
    haystack(e).forEach((h, k) => {
      const at = matchAt(h, q);
      if (at < 0) return;
      const s = (at === 0 ? 100 : 50) + (h === q ? 20 : 0) - Math.min(k, 9);
      if (s > best) best = s;
    });
    return best;
  }

  // 목록 필터: cat = "all" | "fav" | 분류 키. 점수 높은 순, 같은 점수는 목록 순서.
  function filter(query, cat, favs) {
    const favSet = new Set(Array.isArray(favs) ? favs : []);
    return CATALOG
      .map((e, i) => ({ e, i, s: matchScore(e, query) }))
      .filter((x) => x.s > 0)
      .filter((x) => !cat || cat === "all" || (cat === "fav" ? favSet.has(x.e.id) : x.e.cat === cat))
      .sort((a, b) => (norm(query) ? b.s - a.s : 0) || a.i - b.i)
      .map((x) => x.e.id);
  }

  function sanitizeFavs(list) {
    if (!Array.isArray(list)) return [];
    return Array.from(new Set(list.filter((id) => BY_ID.has(id))));
  }
  function toggleFav(list, id) {
    const cur = sanitizeFavs(list);
    if (!BY_ID.has(id)) return cur;
    return cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id);
  }

  // ----- 멀티 차트 레이아웃 -----
  // n = 1 | 2 | 4. cells = 메인 외 칸(최대 3) { ticker: ""(=메인 종목 따라감) | 티커, tf: D|W|M|m1..m60 }.
  const LAYOUT_NS = [1, 2, 4];
  const CELL_TFS = ["D", "W", "M", "m1", "m3", "m5", "m10", "m15", "m30", "m60"];
  const DEFAULT_CELLS = [{ ticker: "", tf: "W" }, { ticker: "", tf: "M" }, { ticker: "@bench", tf: "D" }];
  function sanitizeLayout(raw) {
    const n = raw && LAYOUT_NS.includes(Number(raw.n)) ? Number(raw.n) : 1;
    const src = raw && Array.isArray(raw.cells) ? raw.cells : [];
    const cells = DEFAULT_CELLS.map((d, i) => {
      const c = src[i] || {};
      const ticker = typeof c.ticker === "string" ? c.ticker.trim().slice(0, 24) : d.ticker;
      const tf = CELL_TFS.includes(c.tf) ? c.tf : d.tf;
      return { ticker, tf };
    });
    return { n, cells };
  }
  // 칸 클릭으로 메인과 바꾸기: 칸이 메인 종목을 따라가면(ticker "") 봉만 맞바꾼다.
  function swapWithMain(layout, idx, main) {
    const L = sanitizeLayout(layout);
    const c = L.cells[idx];
    if (!c || !main) return { layout: L, main };
    const nextMain = { ticker: c.ticker && c.ticker !== "@bench" ? c.ticker : (c.ticker === "@bench" ? main.bench || main.ticker : main.ticker), tf: c.tf };
    const sameTicker = nextMain.ticker === main.ticker;
    L.cells[idx] = { ticker: sameTicker ? "" : main.ticker, tf: main.tf };
    // 다른 칸 중 메인 종목을 따라가던 칸은 계속 (새) 메인을 따라간다 — 그대로 둔다.
    return { layout: L, main: nextMain };
  }
  // 다른 칸의 크로스헤어 시각 d 가 이 칸의 몇 번째 봉에 붙는지. dates 는 오름차순("YYYY-MM-DD" 또는
  // "YYYY-MM-DD HH:MM…"). 주·월봉의 d 는 그 기간 마지막 거래일이라 'd 이상인 첫 봉'이 그 날을 담은 봉이다.
  // 둘 다 시각이 있으면(분봉↔분봉) 시각까지, 아니면 날짜(앞 10자)로 비교한다. 범위 밖이면 -1.
  function barIndexForDate(dates, d) {
    if (!Array.isArray(dates) || !dates.length || !d) return -1;
    const key = String(d);
    const timed = key.length > 10 && String(dates[0]).length > 10;
    const cut = (s) => (timed ? String(s) : String(s).slice(0, 10));
    const k = cut(key);
    let lo = 0;
    let hi = dates.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cut(dates[mid]) >= k) { ans = mid; hi = mid - 1; } else lo = mid + 1;
    }
    if (ans < 0) return -1;
    // 분봉 칸에 날짜만 온 경우: 그날 첫 봉. 날짜가 칸 시작 전이면(첫 봉 날짜보다 한 기간 이상 앞) 없음.
    if (ans === 0 && cut(dates[0]) > k) {
      const first = String(dates[0]).slice(0, 10);
      const span = dates.length > 1 ? Date.parse(String(dates[1]).slice(0, 10)) - Date.parse(first) : 0;
      if (Date.parse(first) - Date.parse(k.slice(0, 10)) > Math.max(span, 0)) return -1;
    }
    return ans;
  }

  // ----- 패널 높이 -----
  const PANEL_H_MIN = 36;
  const PANEL_H_MAX = 240;
  function sanitizePanelHeights(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [k, v] of Object.entries(raw)) {
      if (!/^[a-z]{2,12}$/.test(k)) continue;
      const n = Math.round(Number(v));
      if (Number.isFinite(n)) out[k] = Math.min(PANEL_H_MAX, Math.max(PANEL_H_MIN, n));
    }
    return out;
  }

  const API = {
    CATEGORIES, CATALOG, EXTRA_MAX, EXTRA_COLORS, EXTRA_TYPES, PANEL_H_MIN, PANEL_H_MAX, CELL_TFS,
    entry: (id) => BY_ID.get(id) || null,
    ids: () => CATALOG.map((e) => e.id),
    defaults, get, normalize, setParam, resetParams, serialize, deserialize, sanitizeExtra,
    label, extraLabel,
    matchAt, matchScore, filter, sanitizeFavs, toggleFav,
    sanitizeLayout, swapWithMain, barIndexForDate,
    sanitizePanelHeights,
  };
  root.MirChartInd = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
