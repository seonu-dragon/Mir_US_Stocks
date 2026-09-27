// Web Push 알림 — 순수 계산 모듈(DOM·네트워크·전역 상태 없음).
// 브라우저에서는 window.MirPushCore(web-push.js 가 설정 정리·미리보기에 씀), 워커(worker/mir-push.js)에는
// scripts/sync_push_worker.mjs 가 이 파일을 통째로 박아 넣어 같은 코드를 쓴다. node 테스트
// (scripts/tests/test_push_alerts_core.mjs)는 module.exports 로 읽는다. IIFE 라 최상위 이름을 흘리지 않는다.
//
// 담는 것
//   1) 설정·목록 정리: normalizePrefs / normalizeLists / listsFromSyncPrefs / mergeLists
//   2) 언제 무엇을 하나(크론 계획): planJobs(nowMs) — KST·미 동부 시각으로 시세·공시·요약 슬롯 판정
//   3) 조건 평가: parseSpark(야후 spark 응답) → evaluatePrice / evaluateEvents
//   4) 발송 상한·중복 방지 상태: dayState / capRemaining / recordFired / pruneState
//   5) 알림 문구: composeAlertNotification / digestNotification(my-digest-core 의 digestToText 재사용)
//
// 원칙: 조건은 '사실'만 적는다(추천·전망 문구 없음). 값이 없으면 알리지 않는다(추정 안 함).
(function (root) {
  "use strict";

  // ------------------------------------------------------------------ 상수
  const LIMITS = {
    watch: 80,         // 시장별 관심종목(클라우드 동기화 상한과 같다)
    hold: 60,          // 시장별 보유종목
    levels: 40,        // 가격 도달 알림(직접 입력 + 가설·매매일지 목표가/손절가)
    names: 160,
    nameLen: 24,
    maxPerDayCap: 12,  // 하루 발송 상한의 상한(사용자는 1~12 사이에서 고른다)
    bodyLen: 600,
    lines: 6,
  };
  const DEFAULT_PREFS = {
    kinds: { move: true, level: true, earnings: true, disclosure: true, digest: false },
    movePct: 5,                 // ±N% — 전일 종가 대비 등락률 절댓값
    maxPerDay: 6,               // 하루 발송 상한(요약 포함)
    digestMarkets: ["us", "kr"],
    useSync: false,             // 클라우드 동기화 목록(/sync/prefs)을 크론 때마다 다시 읽는다
  };
  const KIND_KEYS = Object.keys(DEFAULT_PREFS.kinds);

  // ------------------------------------------------------------------ 보조
  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function clamp(v, lo, hi, dflt) {
    const n = num(v);
    if (n == null) return dflt;
    return Math.min(hi, Math.max(lo, n));
  }
  function upper(t) { return String(t || "").trim().toUpperCase(); }
  function clip(s, n) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  }
  /** 국내 종목코드(6자리 숫자)면 kr. 그 외는 us. */
  function marketOf(ticker) {
    return /^\d{6}$/.test(String(ticker || "").replace(/\.(KS|KQ)$/i, "")) ? "kr" : "us";
  }
  /** 티커 정리: 미국은 대문자·영숫자.-, 국내는 6자리. 이상하면 "". */
  function cleanTicker(t) {
    const s = upper(t).replace(/\.(KS|KQ)$/i, "");
    if (/^\d{1,6}$/.test(s)) return s.padStart(6, "0");
    return /^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(s) ? s : "";
  }
  function fmtPct(v, digits = 1) {
    const n = num(v);
    if (n == null) return "—";
    const r = Number(n.toFixed(digits));
    return `${r > 0 ? "+" : ""}${r.toFixed(digits)}%`;
  }
  function fmtPrice(v, market) {
    const n = num(v);
    if (n == null) return "—";
    if (market === "kr") return `${Math.round(n).toLocaleString("en-US")}원`;
    return `$${n >= 100 ? n.toFixed(2) : n.toPrecision(4).replace(/\.?0+$/, "")}`;
  }
  function isoOf(ms, offsetMin) {
    const d = new Date(ms + offsetMin * 60000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function addDays(iso, n) {
    const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) + n * 86400000);
    return d.toISOString().slice(0, 10);
  }
  /** 짧은 문자열 해시(중복 방지 키용, 암호 용도 아님). */
  function shortHash(s) {
    let h = 2166136261;
    const str = String(s || "");
    for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  // ------------------------------------------------------------------ 1) 설정·목록
  function normalizePrefs(p) {
    const src = p && typeof p === "object" ? p : {};
    const kindsIn = src.kinds && typeof src.kinds === "object" ? src.kinds : {};
    const kinds = {};
    KIND_KEYS.forEach((k) => { kinds[k] = kindsIn[k] === undefined ? DEFAULT_PREFS.kinds[k] : Boolean(kindsIn[k]); });
    const dm = Array.isArray(src.digestMarkets) ? src.digestMarkets.filter((m) => m === "us" || m === "kr") : DEFAULT_PREFS.digestMarkets;
    return {
      kinds,
      movePct: Math.round(clamp(src.movePct, 1, 30, DEFAULT_PREFS.movePct) * 10) / 10,
      maxPerDay: Math.round(clamp(src.maxPerDay, 1, LIMITS.maxPerDayCap, DEFAULT_PREFS.maxPerDay)),
      digestMarkets: [...new Set(dm)],
      useSync: Boolean(src.useSync),
    };
  }

  function emptyLists() {
    return { us: { watch: [], hold: [] }, kr: { watch: [], hold: [] }, levels: [], names: {}, ys: {} };
  }

  /**
   * 목록 정리. 입력 모양: { us: { watch: [t], hold: [{t, q}] }, kr: {...}, levels: [{t, price, dir, src}], names: {t: 이름}, ys: {code: "005930.KQ"} }
   * 개인정보 최소화: 보유 수량(q)은 요약에서 비중 계산에만 쓴다 — 없으면 0(관심과 같게 취급).
   */
  function normalizeLists(lists) {
    const src = lists && typeof lists === "object" ? lists : {};
    const out = emptyLists();
    ["us", "kr"].forEach((m) => {
      const s = src[m] && typeof src[m] === "object" ? src[m] : {};
      const seenH = new Set();
      (Array.isArray(s.hold) ? s.hold : []).forEach((h) => {
        const t = cleanTicker(h && (h.t || h.ticker));
        if (!t || marketOf(t) !== m || seenH.has(t) || out[m].hold.length >= LIMITS.hold) return;
        seenH.add(t);
        const q = num(h.q != null ? h.q : h.qty);
        out[m].hold.push({ t, q: q && q > 0 ? Math.round(q * 10000) / 10000 : 0 });
      });
      const seenW = new Set();
      (Array.isArray(s.watch) ? s.watch : []).forEach((w) => {
        const t = cleanTicker(typeof w === "string" ? w : w && (w.t || w.ticker));
        if (!t || marketOf(t) !== m || seenW.has(t) || out[m].watch.length >= LIMITS.watch) return;
        seenW.add(t);
        out[m].watch.push(t);
      });
    });
    const seenL = new Set();
    (Array.isArray(src.levels) ? src.levels : []).forEach((l) => {
      const t = cleanTicker(l && (l.t || l.ticker));
      const price = num(l && l.price);
      const dir = l && (l.dir === "below" ? "below" : l.dir === "above" ? "above" : "");
      if (!t || !price || price <= 0 || !dir || out.levels.length >= LIMITS.levels) return;
      const key = `${t}|${dir}|${price}`;
      if (seenL.has(key)) return;
      seenL.add(key);
      const srcTag = ["manual", "thesis", "journal"].includes(l.src) ? l.src : "manual";
      out.levels.push({ t, m: marketOf(t), price, dir, src: srcTag });
    });
    const names = src.names && typeof src.names === "object" ? src.names : {};
    Object.keys(names).slice(0, LIMITS.names).forEach((k) => {
      const t = cleanTicker(k);
      const n = clip(names[k], LIMITS.nameLen);
      if (t && n) out.names[t] = n;
    });
    const ys = src.ys && typeof src.ys === "object" ? src.ys : {};
    Object.keys(ys).slice(0, LIMITS.names).forEach((k) => {
      const t = cleanTicker(k);
      const v = String(ys[k] || "").toUpperCase();
      if (t && marketOf(t) === "kr" && /^\d{6}\.(KS|KQ)$/.test(v)) out.ys[t] = v;
    });
    return out;
  }

  /**
   * 클라우드 동기화 값(워커 /sync/prefs 가 저장한 모양) → 목록.
   * watchlistUs/Kr(없으면 구형 watchlist 를 6자리 여부로 나눔), portfolio(두 시장 평면 목록, qty),
   * theses.items 의 진행 중 가설 목표가(위로)·손절가(아래로).
   */
  function listsFromSyncPrefs(prefs) {
    const p = prefs && typeof prefs === "object" ? prefs : {};
    const raw = { us: { watch: [], hold: [] }, kr: { watch: [], hold: [] }, levels: [] };
    const legacy = Array.isArray(p.watchlist) ? p.watchlist : [];
    raw.us.watch = Array.isArray(p.watchlistUs) ? p.watchlistUs : legacy.filter((t) => marketOf(t) === "us");
    raw.kr.watch = Array.isArray(p.watchlistKr) ? p.watchlistKr : legacy.filter((t) => marketOf(t) === "kr");
    (Array.isArray(p.portfolio) ? p.portfolio : []).forEach((row) => {
      const t = cleanTicker(row && row.ticker);
      if (!t) return;
      raw[marketOf(t)].hold.push({ t, q: row.qty });
    });
    const items = p.theses && Array.isArray(p.theses.items) ? p.theses.items : [];
    items.forEach((th) => {
      if (!th || th.status === "closed") return;
      if (num(th.target)) raw.levels.push({ t: th.ticker, price: num(th.target), dir: "above", src: "thesis" });
      if (num(th.stop)) raw.levels.push({ t: th.ticker, price: num(th.stop), dir: "below", src: "thesis" });
    });
    return normalizeLists(raw);
  }

  /** 동기화 목록이 있으면 관심·보유는 그쪽(다른 기기 변경 반영), 가격 도달은 합집합, 이름·심볼은 기기 쪽 우선. */
  function mergeLists(base, sync) {
    const b = normalizeLists(base);
    if (!sync) return b;
    const s = normalizeLists(sync);
    const hasSync = ["us", "kr"].some((m) => s[m].watch.length || s[m].hold.length);
    const out = hasSync ? { us: s.us, kr: s.kr } : { us: b.us, kr: b.kr };
    return normalizeLists({ ...out, levels: [...b.levels, ...s.levels], names: { ...s.names, ...b.names }, ys: { ...s.ys, ...b.ys } });
  }

  function marketTickers(lists, market) {
    const l = lists && lists[market];
    if (!l) return [];
    return [...new Set([...(l.hold || []).map((h) => h.t), ...(l.watch || [])])];
  }

  /** 야후 심볼 후보. 미국 BRK.B → BRK-B. 국내는 기기가 알려준 접미사, 없으면 .KS 먼저(.KQ 는 재시도). */
  function yahooSymbol(ticker, lists, alt) {
    const t = cleanTicker(ticker);
    if (!t) return "";
    if (marketOf(t) === "us") return alt ? "" : t.replace(/\./g, "-");
    const known = lists && lists.ys && lists.ys[t];
    if (known) return alt ? "" : known;
    return alt ? `${t}.KQ` : `${t}.KS`;
  }

  // ------------------------------------------------------------------ 2) 크론 계획
  const ET_FMT = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" });
    } catch (_) { return null; }
  })();
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function etParts(ms) {
    if (!ET_FMT) {
      // Intl 시간대가 없으면 EST(-5h)로 근사한다(서머타임 1시간 오차 가능).
      const d = new Date(ms - 5 * 3600000);
      return { date: d.toISOString().slice(0, 10), dow: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
    }
    const parts = {};
    ET_FMT.formatToParts(new Date(ms)).forEach((p) => { parts[p.type] = p.value; });
    return { date: `${parts.year}-${parts.month}-${parts.day}`, dow: WD[parts.weekday], minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  }
  function kstParts(ms) {
    const d = new Date(ms + 9 * 3600000);
    return { date: d.toISOString().slice(0, 10), dow: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }

  /**
   * 30분 크론 한 번에 할 일. 슬롯은 KST 기준 30분 칸(:00~:29 / :30~:59)으로 판정한다.
   *   priceUs  미 정규장(ET 평일 09:30~16:29) — 16:00 칸이 종가를 한 번 더 본다
   *   priceKr  국내 정규장(KST 평일 09:00~15:59)
   *   digestUs KST 화~토 07:30 칸 — 미 장 마감 요약 + 실적 D-1(두 시장)
   *   eventsUs KST 월~토 15:00 칸 — 8-K(13:23 KST 수집, 크론 지연 감안)
   *   digestKr·eventsKr KST 월~금 20:00 칸 — 국내 마감 요약 + DART 주요 공시
   * 휴장일은 모른다 — 시세가 그날 것이 아니면(거래일 키) 알리지 않는 것으로 막는다.
   */
  function planJobs(nowMs) {
    const k = kstParts(nowMs);
    const e = etParts(nowMs);
    const slot = Math.floor(k.minutes / 30) * 30;
    const kWeekday = k.dow >= 1 && k.dow <= 5;
    const eWeekday = e.dow >= 1 && e.dow <= 5;
    const jobs = {
      priceUs: eWeekday && e.minutes >= 570 && e.minutes < 990,
      priceKr: kWeekday && k.minutes >= 540 && k.minutes < 960,
      digestUs: slot === 450 && k.dow >= 2 && k.dow <= 6,
      earningsD1: slot === 450,
      eventsUs: slot === 900 && k.dow >= 1 && k.dow <= 6,
      digestKr: slot === 1200 && kWeekday,
      eventsKr: slot === 1200 && kWeekday,
    };
    return { kstDate: k.date, kstSlot: slot, etDate: e.date, jobs };
  }

  // ------------------------------------------------------------------ 3) 조건 평가
  /**
   * 야후 v7 spark(range=1d) 응답 → { SYMBOL: { price, prevClose, changePct, time(ms), tradeDate } }.
   * tradeDate 는 거래소 현지 날짜(gmtoffset). 등락률은 chartPreviousClose 기준(없으면 야후 값).
   */
  function parseSpark(payload) {
    const out = {};
    const list = payload && payload.spark && Array.isArray(payload.spark.result) ? payload.spark.result : [];
    list.forEach((r) => {
      const meta = r && Array.isArray(r.response) && r.response[0] && r.response[0].meta;
      if (!meta) return;
      const price = num(meta.regularMarketPrice);
      const t = num(meta.regularMarketTime);
      if (price == null || price <= 0 || t == null) return;
      const prev = num(meta.chartPreviousClose != null ? meta.chartPreviousClose : meta.previousClose);
      const chg = prev && prev > 0 ? (price / prev - 1) * 100 : num(meta.regularMarketChangePercent);
      const off = num(meta.gmtoffset) || 0;
      out[upper(r.symbol || meta.symbol)] = {
        price, prevClose: prev, changePct: chg == null ? null : Math.round(chg * 100) / 100,
        time: t * 1000, tradeDate: isoOf(t * 1000, off / 60),
        name: clip(meta.shortName || meta.longName || "", LIMITS.nameLen),
      };
    });
    return out;
  }

  function displayName(t, lists) {
    return (lists && lists.names && lists.names[t]) || t;
  }

  /**
   * 가격 조건. quotes 는 티커(국내는 6자리 코드) → parseSpark 한 행.
   * 반환: [{ key, kind: "move"|"level", ticker, market, text, sort }]
   * - move: |등락률| ≥ movePct, (종목·방향·거래일)당 한 번
   * - level: 위로(현재가 ≥ 가격)/아래로(≤), (종목·방향·가격)당 한 번 — 가격을 바꾸면 새 조건
   * maxAgeMs 보다 오래된 시세(휴장·수집 실패)는 쓰지 않는다.
   */
  function evaluatePrice({ prefs, lists, quotes, fired, market, nowMs, maxAgeMs = 20 * 3600000 }) {
    const p = normalizePrefs(prefs);
    const out = [];
    const f = fired || {};
    const fresh = (q) => q && q.price > 0 && (!nowMs || nowMs - q.time <= maxAgeMs);
    if (p.kinds.move) {
      marketTickers(lists, market).forEach((t) => {
        const q = quotes && quotes[t];
        if (!fresh(q) || q.changePct == null || Math.abs(q.changePct) < p.movePct) return;
        const dir = q.changePct > 0 ? "up" : "down";
        const key = `mv:${t}:${q.tradeDate}:${dir}`;
        if (f[key]) return;
        out.push({ key, kind: "move", ticker: t, market, sort: Math.abs(q.changePct),
          text: `${displayName(t, lists)} ${fmtPct(q.changePct)} (전일 종가 대비 ±${p.movePct}% 조건)` });
      });
    }
    if (p.kinds.level) {
      (lists && lists.levels ? lists.levels : []).filter((l) => l.m === market).forEach((l) => {
        const q = quotes && quotes[l.t];
        if (!fresh(q)) return;
        const hit = l.dir === "above" ? q.price >= l.price : q.price <= l.price;
        if (!hit) return;
        const key = `lv:${l.t}:${l.dir}:${l.price}`;
        if (f[key]) return;
        const what = l.src === "thesis" || l.src === "journal"
          ? (l.dir === "above" ? "목표가" : "손절가")
          : (l.dir === "above" ? "설정가 이상" : "설정가 이하");
        out.push({ key, kind: "level", ticker: l.t, market, sort: 100,
          text: `${displayName(l.t, lists)} ${what} ${fmtPrice(l.price, market)} 도달 — 현재 ${fmtPrice(q.price, market)}` });
      });
    }
    return out.sort((a, b) => b.sort - a.sort);
  }

  /**
   * 실적 D-1 · 새 공시. past/upcoming 은 my-digest-core 의 pastEvents/upcomingEvents 결과(정규화된 사건).
   * - earnings: upcoming 중 kind=earnings, D-1
   * - disclosure: past 중 [max(since, today-3), today] 안. 국내는 주요 유형(우선순위 70 이상)만.
   */
  function evaluateEvents({ prefs, lists, market, past, upcoming, fired, today, since, doEarnings = true, doDisclosures = true }) {
    const p = normalizePrefs(prefs);
    const f = fired || {};
    const mine = new Set(marketTickers(lists, market));
    const out = [];
    if (p.kinds.earnings && doEarnings) {
      (upcoming || []).forEach((e) => {
        if (!e || e.kind !== "earnings" || e.dday !== 1 || !mine.has(e.ticker)) return;
        const key = `er:${e.ticker}:${e.date}`;
        if (f[key]) return;
        out.push({ key, kind: "earnings", ticker: e.ticker, market, sort: 50,
          text: `${displayName(e.ticker, lists)} 내일(${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8, 10))}) ${e.label}` });
      });
    }
    if (p.kinds.disclosure && doDisclosures) {
      const floor = [since, today ? addDays(today, -3) : null].filter(Boolean).sort().pop() || "";
      (past || []).forEach((e) => {
        if (!e || !mine.has(e.ticker) || !e.date || e.date < floor || (today && e.date > today)) return;
        if (market === "kr" && (e.priority || 0) < 70) return;
        const key = `ds:${e.ticker}:${e.date}:${shortHash(e.label)}`;
        if (f[key]) return;
        out.push({ key, kind: "disclosure", ticker: e.ticker, market, sort: e.priority || 0, link: e.link || "",
          text: `${displayName(e.ticker, lists)} ${e.source === "DART" ? "공시 · " : ""}${clip(e.label, 60)}` });
      });
    }
    return out.sort((a, b) => b.sort - a.sort);
  }

  // ------------------------------------------------------------------ 4) 발송 상한·중복 방지
  /** 구독별 상태 { day, sent, fired: {key: 날짜} } — 날짜가 바뀌면 sent 를 0 으로. */
  function dayState(state, kstDate) {
    const s = state && typeof state === "object" ? state : {};
    const fired = s.fired && typeof s.fired === "object" ? { ...s.fired } : {};
    return { day: kstDate, sent: s.day === kstDate ? Number(s.sent) || 0 : 0, fired, lastTestAt: Number(s.lastTestAt) || 0 };
  }
  function capRemaining(state, prefs) {
    return Math.max(0, normalizePrefs(prefs).maxPerDay - (Number(state && state.sent) || 0));
  }
  function recordFired(state, keys, kstDate) {
    const s = { ...state, fired: { ...(state.fired || {}) } };
    (keys || []).forEach((k) => { s.fired[k] = kstDate; });
    return s;
  }
  /** 오래된 키 정리: 등락·공시·실적은 10일, 가격 도달은 조건이 목록에 남아 있는 동안 유지. */
  function pruneState(state, lists, kstDate) {
    const keep = new Set((lists && lists.levels ? lists.levels : []).map((l) => `lv:${l.t}:${l.dir}:${l.price}`));
    const floor = addDays(kstDate, -10);
    const fired = {};
    Object.keys((state && state.fired) || {}).forEach((k) => {
      const d = state.fired[k];
      if (k.startsWith("lv:")) { if (keep.has(k)) fired[k] = d; return; }
      if (d >= floor) fired[k] = d;
    });
    return { ...state, fired };
  }

  // ------------------------------------------------------------------ 5) 알림 문구
  function siteUrl(market, extra) {
    return `./index.html?tab=bulk&market=${market === "kr" ? "kr" : "us"}${extra || ""}`;
  }
  const MARKET_KO = { us: "미국", kr: "국내" };

  /** 한 번의 크론에서 한 구독에 쌓인 알림 → 알림 1건(줄 여러 개). */
  function composeAlertNotification(alerts, market, opts) {
    const list = (alerts || []).slice();
    if (!list.length) return null;
    const delayed = opts && opts.delayedQuote;
    const lines = list.slice(0, LIMITS.lines).map((a) => a.text);
    if (list.length > LIMITS.lines) lines.push(`외 ${list.length - LIMITS.lines}건`);
    if (list.some((a) => a.kind === "move" || a.kind === "level") && delayed !== false) lines.push("시세는 야후 지연 시세 · 사실 알림(추천 아님)");
    const title = list.length === 1
      ? `${MARKET_KO[market] || ""} 내 종목 알림`.trim()
      : `${MARKET_KO[market] || ""} 내 종목 알림 ${list.length}건`.trim();
    return {
      title,
      body: clipBody(lines.join("\n"), LIMITS.bodyLen),
      url: siteUrl(market),
      tag: `mir-alert-${market}-${(opts && opts.stamp) || ""}`,
      kinds: [...new Set(list.map((a) => a.kind))],
    };
  }

  /** 줄바꿈을 살리며 자른다(clip 은 공백을 하나로 접으므로 본문엔 쓰지 않는다). */
  function clipBody(text, n) {
    const t = String(text || "").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  }

  /**
   * 일간 요약 → 알림. my-digest-core 의 digestToText 를 그대로 쓰고, 첫 줄(제목)과 빈 줄만 걷어 낸다.
   * digestCore 는 window.MirDigestCore / 워커에 박힌 같은 모듈.
   */
  function digestNotification(digest, digestCore, opts) {
    if (!digest || !digest.items || !digest.items.length || !digestCore) return null;
    const text = digestCore.digestToText(digest, { maxItems: (opts && opts.maxItems) || 3 });
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    lines.shift(); // "오늘 내 주식은 (… 장 마감 기준)" — 제목으로 옮긴다
    const basis = digest.basisDate ? ` ${Number(digest.basisDate.slice(5, 7))}/${Number(digest.basisDate.slice(8, 10))}` : "";
    return {
      title: `오늘 내 주식은 · ${MARKET_KO[digest.market] || ""}${basis} 마감`,
      body: clipBody(lines.join("\n"), LIMITS.bodyLen),
      url: siteUrl(digest.market),
      tag: `mir-digest-${digest.market}`,
      kinds: ["digest"],
    };
  }

  const api = {
    LIMITS, DEFAULT_PREFS,
    normalizePrefs, normalizeLists, emptyLists, listsFromSyncPrefs, mergeLists, marketTickers, marketOf, cleanTicker, yahooSymbol,
    planJobs, etParts, kstParts,
    parseSpark, evaluatePrice, evaluateEvents,
    dayState, capRemaining, recordFired, pruneState,
    composeAlertNotification, digestNotification, siteUrl,
    fmtPct, fmtPrice, addDays, shortHash,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirPushCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
