// 시장 전체 '오늘 피드' — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirMarketFeed, node 테스트(scripts/tests/test_market_feed_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 하는 일: 이미 발행된 데이터셋을 한 시장의 하루 피드로 합친다(새 수집·LLM 없음).
//   US: 8-K(MATERIAL_EVENTS, 3줄 요약은 sec-filings-core.js) · 실적 보도자료(EARNINGS_RELEASES) ·
//       실적 예정일(US_STOCK_CALENDAR + 실적 스냅샷, calendar-panel-core.js) · 특징주(MOVERS_REASONS) ·
//       내부자 Form 4 매수·매도(INSIDER_TRADES) · Form 144(FORM144_FILINGS) · 경제지표(워커 ?calendar=1)
//   KR: DART 공시(KR_DISCLOSURES, 잡음 서류는 timeline-core.js 와 같은 목록으로 뺀다) · 특징주 ·
//       IR 일정(KR_IR_SCHEDULE) · 보호예수 해제(KR_LOCKUPS, 추정일) · 경제지표
// 항목 모양: { id, type, date, time, timeNote, ticker, name, text, lines?, linesLabel?, pct?, link, sub? }
// 판정 문구(호재·악재·좋음·나쁨)를 만들지 않는다 — 원자료 문구와 수치만 옮긴다.
(function (root) {
  "use strict";

  // 칩·목록 순서. markets 에 있는 시장에서만 쓴다. actual=true 는 '이미 일어난 일'(제출·체결·등락) —
  // 기본 날짜(가장 최근 자료일)는 이 종류로만 정한다. 일정(경제지표·IR·보호예수·실적 예정)은
  // 앞날짜가 있어 기준일을 끌고 가면 안 된다.
  const TYPES = [
    { key: "dart", label: "공시", markets: ["kr"], actual: true },
    { key: "8k", label: "8-K", markets: ["us"], actual: true },
    { key: "earn", label: "실적", markets: ["us"], actual: true },
    { key: "movers", label: "특징주", markets: ["us", "kr"], actual: true },
    { key: "insider", label: "내부자", markets: ["us"], actual: true },
    { key: "form144", label: "Form 144", markets: ["us"], actual: true },
    { key: "ir", label: "IR", markets: ["kr"], actual: false },
    { key: "lockup", label: "보호예수", markets: ["kr"], actual: false },
    { key: "econ", label: "경제지표", markets: ["us", "kr"], actual: false },
  ];
  const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.key, t.label]));
  const TYPE_ORDER = Object.fromEntries(TYPES.map((t, i) => [t.key, i]));
  const ACTUAL = new Set(TYPES.filter((t) => t.actual).map((t) => t.key));
  const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
  // 장 마감 시각(특징주 줄의 시각 칸). 시장 현지 시각.
  const CLOSE_TIME = { us: "16:00", kr: "15:30" };

  function typesFor(market) {
    return TYPES.filter((t) => t.markets.includes(market));
  }

  function isDate(d) {
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d);
  }
  function day(d) {
    return String(d).slice(0, 10);
  }
  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function str(v) {
    return typeof v === "string" ? v.trim() : (v === null || v === undefined ? "" : String(v));
  }
  function up(t) {
    return str(t).toUpperCase();
  }
  function hhmm(t) {
    const m = /^(\d{1,2}):(\d{2})/.exec(str(t));
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  }
  function signedPct(p, dec) {
    const n = num(p);
    if (n === null) return "";
    const d = dec == null ? 2 : dec;
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}%`;
  }
  function usdShort(v) {
    const n = num(v);
    if (n === null) return "";
    const a = Math.abs(n);
    if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `$${Math.round(n / 1e3).toLocaleString("en-US")}K`;
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }
  function weekday(iso) {
    const [y, m, d] = day(iso).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  function dayLabel(iso) {
    return isDate(iso) ? `${day(iso)} (${WEEKDAY_KO[weekday(iso)]})` : "";
  }
  function shortDate(iso) {
    return isDate(iso) ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}` : "";
  }

  // 그 시장의 '오늘'(현지 날짜). US = 미 동부, KR = 한국. Intl 이 없으면 UTC 오프셋 근사(동부 −4h).
  function marketToday(market, now) {
    const t = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    const tz = market === "kr" ? "Asia/Seoul" : "America/New_York";
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(t);
      const get = (k) => (parts.find((p) => p.type === k) || {}).value;
      const iso = `${get("year")}-${get("month")}-${get("day")}`;
      if (isDate(iso)) return iso;
    } catch (e) { /* 아래 근사 */ }
    const off = market === "kr" ? 9 : -4;
    return new Date(t.getTime() + off * 3600000).toISOString().slice(0, 10);
  }

  // 한국 시각(KST) 날짜·시각 → 그 시장 현지 날짜·시각. 경제 캘린더는 KST 로 오는데, 미국 피드는
  // 미 동부 기준으로 하루를 자르고 정렬한다(예: KST 10/02 03:00 FOMC → 동부 10/01 14:00).
  function kstToMarket(date, time, market) {
    const t = hhmm(time);
    if (market === "kr" || !isDate(date) || !t) return { date: isDate(date) ? day(date) : "", time: t };
    const [y, m, d] = day(date).split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    const ms = Date.UTC(y, m - 1, d, hh - 9, mm);
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
      const get = (k) => (parts.find((p) => p.type === k) || {}).value;
      return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
    } catch (e) {
      const x = new Date(ms - 4 * 3600000).toISOString();
      return { date: x.slice(0, 10), time: x.slice(11, 16) };
    }
  }

  // 다른 순수 모듈(브라우저는 전역, node 는 require).
  function dep(globalName, file) {
    if (root && root[globalName]) return root[globalName];
    try { return typeof require === "function" ? require(file) : null; } catch (e) { return null; }
  }
  const secCore = () => dep("MirSecFilings", "./sec-filings-core.js");
  const calCore = () => dep("MirCalendarCore", "./calendar-panel-core.js");
  const tlCore = () => dep("MirTimeline", "./timeline-core.js");

  // ── 모으기 ─────────────────────────────────────────────────────────────────
  // src = {
  //   market: "us" | "kr",
  //   names: { 티커: 회사명 }  — 스냅샷에서. 없으면 원자료의 회사명.
  //   events, releases, usCalendar, earnSnap, insider, form144,   // US 전역 그대로(MATERIAL_EVENTS 등)
  //   dart, ir, lockups,                                          // KR 전역 그대로
  //   movers,   // MOVERS_REASONS(시장 확인 후)
  //   econ,     // calendarEventsCache(워커 경제 캘린더 행)
  //   today,    // 시장 현지 오늘(실적 예정일의 하한 계산용)
  // }
  function collect(src) {
    const s = src || {};
    const market = s.market === "kr" ? "kr" : "us";
    const names = s.names && typeof s.names === "object" ? s.names : {};
    const nameOf = (t, fallback) => names[t] || names[up(t)] || str(fallback);
    const out = [];
    let seq = 0;
    const push = (it) => {
      if (!it || !isDate(it.date)) return;
      out.push({ time: "", timeNote: "", ticker: "", name: "", text: "", link: "", ...it, date: day(it.date), id: `${it.type}-${seq++}` });
    };

    if (market === "us") {
      // 실적 보도자료(8-K 2.02 EX-99.1 요약) — 같은 날·같은 종목의 2.02 단독 8-K 는 여기로 합친다.
      const releaseKeys = new Set();
      for (const r of (s.releases && Array.isArray(s.releases.releases)) ? s.releases.releases : []) {
        if (!r || !isDate(r.fileDate) || !r.ticker) continue;
        const t = up(r.ticker);
        releaseKeys.add(`${t}|${day(r.fileDate)}`);
        push({
          type: "earn", date: r.fileDate, ticker: t, name: nameOf(t, r.company),
          text: [str(r.period) ? `실적 보도자료 · ${str(r.period)}` : "실적 보도자료", str(r.oneLine)].filter(Boolean).join(" — "),
          link: str(r.exhibitUrl) || str(r.filingUrl), sub: "자동 요약(원문에 없는 숫자는 버림)",
        });
      }
      // 8-K
      const sc = secCore();
      for (const f of (s.events && Array.isArray(s.events.events)) ? s.events.events : []) {
        if (!f || !isDate(f.fileDate) || !f.ticker) continue;
        const t = up(f.ticker);
        const items = (Array.isArray(f.items) ? f.items : []).filter((it) => it && it.code !== "9.01");
        if (f.kind === "buyback") {
          push({ type: "8k", date: f.fileDate, ticker: t, name: nameOf(t, f.company), text: `자사주 매입 발표${num(f.amountUsd) ? ` · 규모 ${usdShort(f.amountUsd)}` : ""}`, link: str(f.link) });
          continue;
        }
        if (!items.length) continue;
        const onlyEarn = items.every((it) => it.code === "2.02");
        if (onlyEarn && releaseKeys.has(`${t}|${day(f.fileDate)}`)) continue;
        const sum = sc ? sc.eightkLines(f) : { lines: [] };
        push({
          type: "8k", date: f.fileDate, ticker: t, name: nameOf(t, f.company),
          text: items.map((it) => str(it.label) || `Item ${str(it.code)}`).join(" · "),
          link: str(f.link),
          ...(sum.lines && sum.lines.length ? { lines: sum.lines.slice(0, 3), linesLabel: sum.label } : {}),
        });
      }
      // 실적 예정일(추정일일 수 있음)
      const cc = calCore();
      if (cc && (s.usCalendar || s.earnSnap)) {
        // 지난 예정일은 소스가 다음 분기로 넘기므로 의미가 없다 — 달력과 같이 오늘 −7일부터만.
        const floor = isDate(s.today) ? cc.addDays(day(s.today), -7) : null;
        for (const e of cc.fromUsCalendar(s.usCalendar, s.earnSnap, names, floor)) {
          if (e.kind !== "earnings") continue;
          push({ type: "earn", date: e.date, ticker: up(e.ticker), name: nameOf(e.ticker, e.name), text: "실적 발표 예정일", sub: "회사 확정 전에는 추정일일 수 있음", scheduled: true });
        }
      }
      // Form 4: 매수(P)·매도(S)만, 같은 날·같은 종목·같은 방향을 한 줄로.
      const groups = new Map();
      for (const tr of (s.insider && Array.isArray(s.insider.trades)) ? s.insider.trades : []) {
        if (!tr || !isDate(tr.fileDate) || !tr.ticker || (tr.code !== "P" && tr.code !== "S")) continue;
        const t = up(tr.ticker);
        const key = `${t}|${day(tr.fileDate)}|${tr.code}`;
        if (!groups.has(key)) groups.set(key, { t, date: day(tr.fileDate), code: tr.code, n: 0, value: 0, owners: [], link: str(tr.link), company: tr.issuer });
        const g = groups.get(key);
        g.n += 1;
        g.value += num(tr.value) || 0;
        const who = str(tr.owner);
        if (who && !g.owners.includes(who)) g.owners.push(who);
      }
      for (const g of groups.values()) {
        const who = g.owners.slice(0, 2).join(", ") + (g.owners.length > 2 ? ` 외 ${g.owners.length - 2}명` : "");
        push({
          type: "insider", date: g.date, ticker: g.t, name: nameOf(g.t, g.company),
          text: [`Form 4 ${g.code === "P" ? "매수" : "매도"}${g.n > 1 ? ` ${g.n}건` : ""}`, who, g.value ? `합계 ${usdShort(g.value)}` : ""].filter(Boolean).join(" · "),
          link: g.link, side: g.code,
        });
      }
      // Form 144 매도 예정 신고
      for (const r of (s.form144 && Array.isArray(s.form144.filings)) ? s.form144.filings : []) {
        if (!r || !isDate(r.fileDate) || !r.ticker) continue;
        const t = up(r.ticker);
        const st = sc ? sc.form144Status(r) : null;
        push({
          type: "form144", date: r.fileDate, ticker: t, name: nameOf(t, r.issuer),
          text: [`매도 예정 신고`, sc ? sc.form144Line(r) : str(r.person)].filter(Boolean).join(" · "),
          sub: st ? `Form 4 대조: ${st.label}` : "", link: str(r.link),
        });
      }
    } else {
      // DART — 같은 사건의 부속 서류(투자설명서·발행실적 등)는 timeline-core.js 와 같은 목록으로 뺀다.
      const tl = tlCore();
      const noise = tl && tl.KR_NOISE_TYPES ? tl.KR_NOISE_TYPES : new Set();
      const seen = new Set();
      for (const f of (s.dart && Array.isArray(s.dart.disclosures)) ? s.dart.disclosures : []) {
        if (!f || !isDate(f.fileDate)) continue;
        const type = str(f.typeLabel) || "공시";
        if (noise.has(type)) continue;
        const rcp = tl && tl.rcpNo ? tl.rcpNo(f.link) : "";
        if (rcp) { if (seen.has(rcp)) continue; seen.add(rcp); }
        const t = str(f.ticker);
        push({
          type: "dart", date: f.fileDate, ticker: t, name: nameOf(t, f.company),
          text: [type !== "공시" ? type : "", str(f.title)].filter(Boolean).join(" · "), link: str(f.link),
        });
      }
      // IR 일정(기업설명회 개최일)
      for (const r of (s.ir && Array.isArray(s.ir.rows)) ? s.ir.rows : []) {
        if (!r || !isDate(r.date)) continue;
        const t = str(r.code);
        push({
          type: "ir", date: r.date, time: hhmm(r.time), ticker: t, name: nameOf(t, r.company),
          text: [r.earnings ? "기업설명회(실적)" : "기업설명회", str(r.purpose), str(r.method)].filter(Boolean).join(" · "),
          link: str(r.link),
        });
      }
      // 보호예수 해제(상장일 + 기간으로 계산한 추정일)
      const cc = calCore();
      if (cc && s.lockups) {
        for (const e of cc.fromKrLockups(s.lockups)) {
          push({
            type: "lockup", date: e.date, ticker: str(e.ticker), name: nameOf(e.ticker, e.name),
            text: ["보호예수 해제(추정일)", str(e.sub), str(e.info)].filter(Boolean).join(" · "), link: str(e.link),
          });
        }
      }
    }

    // 특징주(장 마감 기준) — 사유가 없으면 없다고 쓴다.
    const mv = s.movers;
    if (mv && isDate(mv.tradeDate) && (!mv.market || mv.market === market)) {
      for (const side of ["up", "down"]) {
        for (const r of Array.isArray(mv[side]) ? mv[side] : []) {
          if (!r || !r.ticker) continue;
          const t = market === "us" ? up(r.ticker) : str(r.ticker);
          const st = r.reasonStatus || "failed";
          const ok = (st === "ok" || st === "sector") && str(r.reason);
          const reason = ok ? str(r.reason) : (st === "none" ? "뚜렷한 재료 확인 안 됨" : "뚜렷한 사유 확인 안 됨");
          const note = str(r.sectorNote) && st !== "sector" ? str(r.sectorNote) : "";
          const ev = Array.isArray(r.evidence) ? r.evidence.find((x) => x && x.link) : null;
          push({
            type: "movers", date: mv.tradeDate, time: CLOSE_TIME[market], timeNote: "장 마감",
            ticker: t, name: nameOf(t, r.company), pct: num(r.changePct),
            text: [signedPct(r.changePct), reason, note].filter(Boolean).join(" · "),
            sub: ok ? "자동 요약 — 틀릴 수 있음" : "", link: ev ? str(ev.link) : "",
          });
        }
      }
    }

    // 경제지표(이 시장 나라만, 중요도 보통 이상 — calendar-panel-core.js fromEcon 규칙)
    const cc = calCore();
    if (cc && Array.isArray(s.econ) && s.econ.length) {
      for (const e of cc.fromEcon(s.econ)) {
        if (e.market !== market) continue;
        const loc = kstToMarket(e.date, e.time, market);
        push({
          type: "econ", date: loc.date || e.date, time: loc.time, timeNote: e.time && market === "us" ? `KST ${hhmm(e.time)}` : "",
          text: [e.title, e.info].filter(Boolean).join(" · "), important: !!e.important,
        });
      }
    }
    return out;
  }

  // ── 날짜 ──────────────────────────────────────────────────────────────────
  // 자료가 있는 날짜(최신순). actualOnly 면 '이미 일어난 일' 종류만, today 이후는 뺀다.
  function availableDates(items, today, actualOnly) {
    const set = new Set();
    for (const e of Array.isArray(items) ? items : []) {
      if (!e || !isDate(e.date)) continue;
      if (actualOnly !== false && (!ACTUAL.has(e.type) || e.scheduled)) continue;
      if (today && e.date > today) continue;
      set.add(e.date);
    }
    return [...set].sort().reverse();
  }

  // 기준일 고르기: 요청한 날짜가 자료일 목록에 있으면 그것, 아니면 가장 최근 자료일.
  // → { date, today, isToday, reason }  reason: "today" | "weekend" | "holiday" | "notYet" | "requested" | "none"
  function pickDate(items, today, requested, holidays) {
    const dates = availableDates(items, today, true);
    const t = isDate(today) ? day(today) : "";
    // 사용자가 고른 날짜(가장 최근 자료일이 아닐 때만 '선택한 날짜'로 안내).
    if (requested && dates.includes(requested) && requested !== dates[0]) {
      return { date: requested, today: t, isToday: requested === t, reason: requested === t ? "today" : "requested", dates };
    }
    if (!dates.length) return { date: "", today: t, isToday: false, reason: "none", dates };
    const d = dates[0];
    if (d === t) return { date: d, today: t, isToday: true, reason: "today", dates };
    const wd = t ? weekday(t) : -1;
    const hol = (Array.isArray(holidays) ? holidays : []).find((h) => h && day(h.date) === t);
    let reason = "notYet";
    if (wd === 0 || wd === 6) reason = "weekend";
    else if (hol) reason = "holiday";
    return { date: d, today: t, isToday: false, reason, holidayName: hol ? str(hol.name) : "", dates };
  }

  // 기준일 안내 문장(판정 없이 사실만).
  function dateNote(pick, market) {
    if (!pick || !pick.date) return "";
    const where = market === "kr" ? "한국" : "미 동부";
    const today = pick.today ? `${shortDate(pick.today)}` : "";
    switch (pick.reason) {
      case "today": return `${where} 날짜 기준 오늘 자료입니다.`;
      case "weekend": return `오늘(${today})은 주말이라 가장 최근 자료일 ${shortDate(pick.date)} 을 보여 줍니다.`;
      case "holiday": return `오늘(${today})은 휴장일${pick.holidayName ? `(${pick.holidayName})` : ""}이라 가장 최근 자료일 ${shortDate(pick.date)} 을 보여 줍니다.`;
      case "notYet": return `오늘(${where} ${today}) 자료는 아직 수집 전이라 가장 최근 자료일 ${shortDate(pick.date)} 을 보여 줍니다.`;
      case "requested": return `선택한 날짜 ${shortDate(pick.date)} 의 자료입니다.`;
      default: return "";
    }
  }

  // 그 날짜의 항목, 정렬: 시각 있는 항목(늦은 시각 먼저) → 시각 없는 항목(종류 순) → 종목.
  function forDate(items, date) {
    const list = (Array.isArray(items) ? items : []).filter((e) => e && e.date === date);
    return list.sort((a, b) => {
      const ta = a.time || "";
      const tb = b.time || "";
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      if (ta !== tb) return ta > tb ? -1 : 1;
      const o = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
      if (o) return o;
      // 특징주는 등락폭 큰 순, 나머지는 이름 순.
      if (a.type === "movers") return Math.abs(num(b.pct) || 0) - Math.abs(num(a.pct) || 0);
      return String(a.name || a.ticker).localeCompare(String(b.name || b.ticker), "ko");
    });
  }

  function countByType(items) {
    const out = { all: 0 };
    for (const t of TYPES) out[t.key] = 0;
    for (const e of Array.isArray(items) ? items : []) {
      if (!e || out[e.type] === undefined) continue;
      out.all += 1;
      out[e.type] += 1;
    }
    return out;
  }

  function filterType(items, type) {
    const list = Array.isArray(items) ? items : [];
    if (!type || type === "all") return list;
    return list.filter((e) => e && e.type === type);
  }

  // 칩: 자료가 있는 종류만(0건은 칩을 만들지 않는다). → [{ key, label, n }]
  function chips(counts, market) {
    return typesFor(market).filter((t) => (counts[t.key] || 0) > 0).map((t) => ({ key: t.key, label: t.label, n: counts[t.key] }));
  }

  // 머리 줄 요약 "공시 12 · 특징주 20 · …"
  function summaryLine(counts, market) {
    return chips(counts, market).map((c) => `${c.label} ${c.n}`).join(" · ");
  }

  // 출처별 기준 시각·최신 자료일. payloads = { key: 전역 객체 | null }, loading = { key: true }.
  // → [{ key, label, source, updatedAt, latest, status }]
  //   status: "ok"(그 날짜 자료 있음) · "empty"(그 날짜 0건) · "behind"(최신 자료일이 기준일보다 앞) ·
  //           "loading" · "missing"(불러오지 못함/이 시장에 없음)
  function sourceBasis(market, payloads, counts, date, loading) {
    const p = payloads || {};
    const ld = loading || {};
    const defs = market === "kr"
      ? [
        { key: "dart", label: "공시", g: "dart", source: "DART", latest: (x) => x.lastFileDate },
        { key: "movers", label: "특징주", g: "movers", source: "장 마감 스냅샷 · 자동 요약", latest: (x) => x.tradeDate },
        { key: "ir", label: "IR", g: "ir", source: "DART 기업설명회 공시", latest: null },
        { key: "lockup", label: "보호예수", g: "lockups", source: "38커뮤니케이션 공모 상세(추정일)", latest: null },
        { key: "econ", label: "경제지표", g: "econ", source: "investing.com 경제 캘린더(이번 주·다음 주)", latest: null },
      ]
      : [
        { key: "8k", label: "8-K", g: "events", source: "SEC EDGAR", latest: (x) => x.lastFileDate },
        { key: "earn", label: "실적", g: "releases", source: "SEC 8-K 2.02 보도자료 · Yahoo 예정일", latest: null },
        { key: "movers", label: "특징주", g: "movers", source: "장 마감 스냅샷 · 자동 요약", latest: (x) => x.tradeDate },
        { key: "insider", label: "내부자", g: "insider", source: "SEC EDGAR Form 4", latest: (x) => x.lastFileDate },
        { key: "form144", label: "Form 144", g: "form144", source: "SEC EDGAR Form 144", latest: (x) => x.lastFileDate },
        { key: "econ", label: "경제지표", g: "econ", source: "investing.com 경제 캘린더(이번 주·다음 주)", latest: null },
      ];
    return defs.map((d) => {
      const x = p[d.g];
      const n = (counts && counts[d.key]) || 0;
      if (!x || (Array.isArray(x) && !x.length)) {
        return { key: d.key, label: d.label, source: d.source, updatedAt: "", latest: "", n, status: ld[d.g] ? "loading" : "missing" };
      }
      const latest = d.latest && !Array.isArray(x) && isDate(d.latest(x)) ? day(d.latest(x)) : "";
      const updatedAt = !Array.isArray(x) ? str(x.updatedAtKst) : "";
      let status = n > 0 ? "ok" : "empty";
      if (!n && latest && date && latest < date) status = "behind";
      return { key: d.key, label: d.label, source: d.source, updatedAt, latest, n, status };
    });
  }

  // 이전·다음 자료일(목록은 최신순).
  function stepDate(dates, date, dir) {
    const list = Array.isArray(dates) ? dates : [];
    const i = list.indexOf(date);
    if (i < 0) return "";
    const j = dir < 0 ? i + 1 : i - 1;
    return j >= 0 && j < list.length ? list[j] : "";
  }

  const api = {
    TYPES,
    TYPE_LABEL,
    CLOSE_TIME,
    typesFor,
    marketToday,
    kstToMarket,
    collect,
    availableDates,
    pickDate,
    dateNote,
    forDate,
    countByType,
    filterType,
    chips,
    summaryLine,
    sourceBasis,
    stepDate,
    dayLabel,
    shortDate,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirMarketFeed = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
