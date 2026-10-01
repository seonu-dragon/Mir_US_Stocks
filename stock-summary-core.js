// stock-summary-core.js — 종목 상세 개요 탭 '한눈 요약' 카드 + 가격 아래 '오늘·임박 이벤트' 줄의 순수 계산(DOM 없음).
// 브라우저에서는 window.MirStockSummary, node 테스트(scripts/tests/test_stock_summary_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// - 새 외부 호출·LLM 없음. 이미 받은 데이터(스냅샷 행·재무 파일·사업부문 파일·컨센서스·타임라인 항목·
//   실적/배당/보호예수 일정)를 템플릿 문장과 작은 표로 옮길 뿐이다.
// - 값이 없는 절(clause)은 통째로 뺀다. '—'·'?' 같은 자리표시를 문장에 넣지 않는다(표 칸만 예외).
// - 판단·권유 문구(호재·긍정·상승여력 등)를 쓰지 않는다. 숫자마다 기준일·출처를 캡션으로 단다.
(function (root) {
  "use strict";

  // ── 숫자·날짜 ──────────────────────────────────────────────────────────────
  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function comma(n) {
    return Math.round(n).toLocaleString("en-US");
  }
  function isoDay(v) {
    const m = /^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/.exec(String(v || "").trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  function utc(iso) {
    return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  }
  // b − a (일). 둘 중 하나라도 날짜가 아니면 null.
  function dayDiff(a, b) {
    const x = isoDay(a);
    const y = isoDay(b);
    if (!x || !y) return null;
    return Math.round((utc(y) - utc(x)) / 86400000);
  }
  function dotDate(iso) {
    const d = isoDay(iso);
    return d ? d.replace(/-/g, ".") : "";
  }
  function mdDate(iso) {
    const d = isoDay(iso);
    return d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "";
  }
  function clip(s, n) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  }

  // ── 조사(은/는) ────────────────────────────────────────────────────────────
  // 마지막 글자의 받침으로 고른다. 한글이 아니면 영문 글자·숫자의 한국어 읽기로 판단한다
  // (L·M·N·R → 받침 있음, 0·1·3·6·7·8 → 받침 있음).
  const LATIN_BATCHIM = new Set(["L", "M", "N", "R"]);
  const DIGIT_BATCHIM = new Set(["0", "1", "3", "6", "7", "8"]);
  function hasBatchim(word) {
    const s = String(word || "").replace(/[\s.,)\]'"’”]+$/u, "");
    const ch = s.slice(-1);
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    if (/[0-9]/.test(ch)) return DIGIT_BATCHIM.has(ch);
    if (/[A-Za-z]/.test(ch)) return LATIN_BATCHIM.has(ch.toUpperCase());
    return false;
  }
  function topic(word) {
    return `${word}${hasBatchim(word) ? "은" : "는"}`;
  }

  // ── 금액 ──────────────────────────────────────────────────────────────────
  // 문장용(정밀): KR 333조 6,059억원 · US $215.94B (quote-info-core fmtKrwLarge/fmtUsdLarge 와 같은 모양)
  function moneyLong(v, currency) {
    const n = num(v);
    if (n === null) return "";
    const a = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (currency === "KRW") {
      if (a >= 1e12) {
        let jo = Math.floor(a / 1e12);
        let eok = Math.round((a - jo * 1e12) / 1e8);
        if (eok >= 10000) { jo += 1; eok -= 10000; }
        return `${sign}${comma(jo)}조${eok ? ` ${comma(eok)}억` : ""}원`;
      }
      if (a >= 1e8) return `${sign}${comma(a / 1e8)}억원`;
      if (a >= 1e4) return `${sign}${comma(a / 1e4)}만원`;
      return `${sign}${comma(a)}원`;
    }
    const pre = !currency || currency === "USD" ? "$" : "";
    const post = currency && currency !== "USD" ? ` ${currency}` : "";
    if (a >= 1e12) return `${sign}${pre}${(a / 1e12).toFixed(2)}T${post}`;
    if (a >= 1e9) return `${sign}${pre}${(a / 1e9).toFixed(2)}B${post}`;
    if (a >= 1e6) return `${sign}${pre}${(a / 1e6).toFixed(1)}M${post}`;
    return `${sign}${pre}${comma(a)}${post}`;
  }
  // 표용(짧게): financials.js mfMoney 와 같은 규칙 — 334조 · 43.6조 · 6,685억 / $216B · $130.4B · $512M
  function moneyShort(v, currency) {
    const n = num(v);
    if (n === null) return "";
    const a = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (currency === "KRW") {
      if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(a >= 1e14 ? 0 : 1)}조`;
      if (a >= 1e8) return `${sign}${comma(a / 1e8)}억`;
      return `${sign}${comma(a / 1e4)}만`;
    }
    const pre = !currency || currency === "USD" ? "$" : "";
    const post = currency && currency !== "USD" ? ` ${currency}` : "";
    if (a >= 1e12) return `${sign}${pre}${(a / 1e12).toFixed(2)}T${post}`;
    if (a >= 1e9) return `${sign}${pre}${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B${post}`;
    if (a >= 1e6) return `${sign}${pre}${(a / 1e6).toFixed(0)}M${post}`;
    return `${sign}${pre}${comma(a)}${post}`;
  }

  // 전년 대비 표기. 두 해 모두 양수면 ±%, 부호가 바뀌면 흑자/적자 전환, 둘 다 0 이하면 적자 지속.
  // 매출처럼 부호 전환이 뜻이 없는 값은 allowTurn=false → 두 해 모두 양수일 때만.
  function yoyText(cur, prev, allowTurn) {
    const c = num(cur);
    const p = num(prev);
    if (c === null || p === null) return "";
    if (c > 0 && p > 0) {
      const r = (c / p - 1) * 100;
      const s = Math.abs(r) >= 100 ? Math.round(Math.abs(r)).toLocaleString("en-US") : Math.abs(r).toFixed(1);
      return `전년 대비 ${r > 0 ? "+" : r < 0 ? "−" : ""}${s}%`;
    }
    if (!allowTurn) return "";
    if (c > 0 && p <= 0) return "흑자 전환";
    if (c <= 0 && p > 0) return "적자 전환";
    return "적자 지속";
  }

  // ── 재무 연간 행 ──────────────────────────────────────────────────────────
  // 회계연도 오름차순, 마지막 n 개. 매출·영업이익·순이익이 모두 없는 해는 뺀다.
  function annualRows(fin, n) {
    const list = (fin && Array.isArray(fin.annual) ? fin.annual : [])
      .filter((r) => r && num(r.fy) !== null && (num(r.rev) !== null || num(r.op) !== null || num(r.net) !== null))
      .slice()
      .sort((a, b) => a.fy - b.fy);
    return list.slice(-(n || 5));
  }

  function fyLabel(kr, fy) {
    return kr ? `${fy}년` : `FY${fy}`;
  }

  function finSourceText(fin) {
    if (!fin) return "";
    if (fin.market === "kr") return `DART ${fin.basis === "OFS" ? "별도" : "연결"}재무제표`;
    return `SEC ${fin.annualForm || "10-K"}`;
  }

  // ── 한눈 요약 ─────────────────────────────────────────────────────────────
  // input = {
  //   kr, name, code, marketLabel, sectorText, isEtf,
  //   marketCap(절대 금액, 주가 통화), capAsOf(YYYY-MM-DD),
  //   fin(재무 파일 schema 1),
  //   segments: { rows:[{label, share(0~1), other}], fy, end, form } | null  (segments-core axisView 결과에서 추린 것)
  //   consensus: { kind:"kr", target, count, asOf, source } | { kind:"us", avg, lo, hi, n, asOf, source } | null
  //   events: 타임라인 항목(timeline-core collectTimeline 결과, 최신순)
  //   catLabel: { cat: 라벨 }, today(KST YYYY-MM-DD — 최근 공시 날짜에 연도를 붙일지)
  // }
  function buildSummary(input) {
    const s = input || {};
    const kr = Boolean(s.kr);
    const cur = kr ? "KRW" : "USD";
    const out = { show: false, sentences: [], notes: [], segment: null, table: null, events: [], parts: 0 };
    if (s.isEtf) return out;

    // 1) 소개 + 시가총액
    const name = String(s.name || "").trim();
    const code = String(s.code || "").trim();
    const who = name ? (code && code !== name ? `${name}(${code})` : name) : code;
    const cap = num(s.marketCap) !== null && num(s.marketCap) > 0 ? moneyLong(s.marketCap, cur) : "";
    const what = [s.marketLabel ? `${s.marketLabel} 상장` : "", s.sectorText ? `${s.sectorText} 기업` : ""].filter(Boolean).join(" ");
    let introOk = false;
    if (who && (what || cap)) {
      const subj = topic(name || code);
      const subjFull = code && code !== name && name ? `${name}(${code})${hasBatchim(name) ? "은" : "는"}` : subj;
      let text;
      if (what && cap) text = `${subjFull} ${what}${s.sectorText ? "으로" : "로"}, 시가총액은 ${cap}입니다.`;
      else if (what) text = `${subjFull} ${what}입니다.`;
      else text = `${who}의 시가총액은 ${cap}입니다.`;
      // '상장으로' 는 어색하다 — 업종이 없으면 '상장사로'.
      text = text.replace(/ 상장로,/, " 상장사로,").replace(/ 상장입니다\./, " 상장사입니다.");
      out.sentences.push(text);
      introOk = true;
      if (cap && isoDay(s.capAsOf)) out.notes.push(`시가총액 ${dotDate(s.capAsOf)} 종가 기준`);
    }

    // 2) 최근 연간 실적
    const fin = s.fin && Array.isArray(s.fin.annual) ? s.fin : null;
    const fcur = (fin && fin.currency) || cur;
    const rows = annualRows(fin, 5);
    let finOk = false;
    if (rows.length) {
      const last = rows[rows.length - 1];
      const prev = rows.find((r) => r.fy === last.fy - 1) || null;
      const clauses = [];
      const rev = num(last.rev);
      if (rev !== null && rev > 0) {
        const y = prev ? yoyText(rev, prev.rev, false) : "";
        clauses.push(`매출은 ${moneyLong(rev, fcur)}${y ? `(${y})` : ""}`);
      }
      const op = num(last.op);
      if (op !== null) {
        const y = prev ? yoyText(op, prev.op, true) : "";
        const label = op < 0 ? "영업손실은" : "영업이익은";
        clauses.push(`${label} ${moneyLong(Math.abs(op), fcur)}${y ? `(${y})` : ""}`);
      }
      if (clauses.length) {
        const when = kr ? `${last.fy}년 연간` : `${fyLabel(false, last.fy)}${isoDay(last.end) ? `(${dotDate(last.end)} 결산)` : ""}`;
        out.sentences.push(`${when} ${clauses.join(", ")}입니다.`);
        finOk = true;
        const bits = [`실적 ${finSourceText(fin)} ${fyLabel(kr, last.fy)}`];
        if (isoDay(fin.lastFiled)) bits.push(`반영 공시 ${dotDate(fin.lastFiled)}`);
        out.notes.push(bits.join(" · "));
      }
    }

    // 3) 컨센서스(있을 때만)
    const c = s.consensus;
    if (c && c.kind === "kr" && num(c.target) > 0) {
      const cnt = num(c.count);
      out.sentences.push(`${cnt > 0 ? `증권사 ${comma(cnt)}곳 추정 기준 ` : ""}목표주가 컨센서스는 ${comma(c.target)}원입니다.`);
      out.notes.push(`목표주가 ${c.source || "컨센서스"}${isoDay(c.asOf) ? ` ${dotDate(c.asOf)} 기준` : ""}`);
    } else if (c && c.kind === "us" && num(c.avg) > 0) {
      const n = num(c.n);
      const lo = num(c.lo);
      const hi = num(c.hi);
      const range = lo > 0 && hi > 0 && hi >= lo ? `, 범위는 $${lo.toFixed(2)}~$${hi.toFixed(2)}` : "";
      out.sentences.push(`${n > 0 ? `애널리스트 ${comma(n)}명의 ` : ""}평균 목표주가는 $${num(c.avg).toFixed(2)}${range}입니다.`);
      out.notes.push(`목표주가 ${c.source || "애널리스트 추정"}${isoDay(c.asOf) ? ` ${dotDate(c.asOf)} 기준` : ""}`);
    }

    // 4) 사업부문 한 줄
    const seg = s.segments;
    if (seg && Array.isArray(seg.rows)) {
      const parts = seg.rows
        .filter((r) => r && r.label && num(r.share) !== null && r.share >= 0.005)
        .slice(0, 5)
        .map((r) => `${clip(r.label, 24)} ${Math.round(r.share * 100)}%`);
      if (parts.length >= 2) {
        out.segment = {
          text: `주요 사업부문 ${parts.join(" · ")}`,
          note: `${num(seg.fy) !== null ? `FY${seg.fy} ` : ""}매출 비중(부문 합 기준)`,
        };
      }
    }

    // 5) 5개년 표
    if (rows.length >= 2) {
      const keys = [["rev", "매출"], ["op", "영업이익"], ["net", "순이익"]];
      const trows = keys
        .map(([k, label]) => ({
          key: k,
          label,
          cells: rows.map((r) => {
            const v = num(r[k]);
            return { text: v === null ? "—" : moneyShort(v, fcur), neg: v !== null && v < 0 };
          }),
        }))
        .filter((r) => r.cells.some((x) => x.text !== "—"));
      if (trows.length) {
        out.table = {
          cols: rows.map((r) => (kr ? String(r.fy) : `FY${r.fy}`)),
          // US 표는 열 머리(FY2026)·달러 칸이 길어 좁은 화면에서 가장 오래된 해를 숨긴다(styles.css .ss-wide).
          wide: !kr && rows.length >= 5,
          rows: trows,
          note: `연간 · ${finSourceText(fin)}${kr ? "" : (fcur !== "USD" ? ` · 통화 ${fcur}` : "")} · 순이익은 지배주주 귀속`,
        };
      }
    }

    // 6) 최근 공시·이벤트(가격 움직임·과거 기록·목표가 제외)
    const label = s.catLabel || {};
    const thisYear = isoDay(s.today) ? isoDay(s.today).slice(0, 4) : "";
    const evs = (Array.isArray(s.events) ? s.events : [])
      .filter((e) => e && isoDay(e.date) && e.cat !== "move" && e.cat !== "target" && e.src !== "history")
      .slice(0, 5)
      .map((e) => ({
        date: isoDay(e.date),
        // 올해 것은 MM.DD, 지난해 이전은 연도까지(오늘을 모르면 연도까지).
        dateText: thisYear && isoDay(e.date).slice(0, 4) === thisYear ? dotDate(e.date).slice(5) : dotDate(e.date),
        cat: e.cat,
        badge: label[e.cat] || "",
        title: clip(e.title, 40),
        detail: clip(e.detail, 70),
      }));
    out.events = evs;

    out.parts = [introOk, finOk, Boolean(out.table), Boolean(out.segment), evs.length > 0].filter(Boolean).length;
    // 재무가 있거나, 소개 + 최근 공시가 함께 있을 때만 카드를 띄운다(시총 한 줄만으로는 띄우지 않는다).
    out.show = finOk || Boolean(out.table) || (introOk && evs.length > 0);
    return out;
  }

  // ── 오늘·임박 이벤트 ──────────────────────────────────────────────────────
  // input = {
  //   today(KST YYYY-MM-DD), kr, horizon(기본 7), max(기본 2),
  //   usCalendar: { nextEarnings, exDate, divRate } | null,          // US_STOCK_CALENDAR.stocks[T]
  //   krIr: [{ date, earnings, purpose }],                              // KR_IR_SCHEDULE.rows (이 종목)
  //   krDividends: [{ recordDate, dps, divKind }],                      // KR_DIVIDENDS.rows (이 종목)
  //   lockups: [{ date, pct, shares }],                                 // lockup-core forTicker().upcoming
  //   recent: 타임라인 항목(최신순) — 새 공시(오늘·어제) 판정용
  // }
  // → [{ kind, date, dday, when, label, detail }] 가까운 순 최대 max 개
  const KIND_ORDER = { earnings: 0, lockup: 1, dividend: 2, filing: 3 };
  function buildEventStrip(input) {
    const s = input || {};
    const today = isoDay(s.today);
    if (!today) return [];
    const horizon = Number.isFinite(s.horizon) ? s.horizon : 7;
    const max = Number.isFinite(s.max) ? s.max : 2;
    const out = [];
    const ahead = (kind, date, label, detail) => {
      const d = isoDay(date);
      const dd = d ? dayDiff(today, d) : null;
      if (dd === null || dd < 0 || dd > horizon) return;
      out.push({ kind, date: d, dday: dd, dist: dd, when: dd === 0 ? "오늘" : `D-${dd}`, label, detail: detail || "" });
    };

    const uc = s.usCalendar;
    if (!s.kr && uc) {
      ahead("earnings", uc.nextEarnings, "실적 발표 예정", "");
      const rate = num(uc.divRate);
      ahead("dividend", uc.exDate, "배당락일", rate && rate > 0 ? `연 배당 $${rate.toFixed(2)} 기준` : "");
    }
    if (s.kr) {
      for (const r of Array.isArray(s.krIr) ? s.krIr : []) {
        if (r && r.earnings) ahead("earnings", r.date, "실적 IR 예정", clip(r.purpose, 30));
      }
      const seen = new Set();
      for (const r of Array.isArray(s.krDividends) ? s.krDividends : []) {
        if (!r) continue;
        const key = `${r.divKind}|${r.recordDate}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const dps = num(r.dps);
        ahead("dividend", r.recordDate, "배당 기준일", [r.divKind, dps && dps > 0 ? `주당 ${comma(dps)}원` : ""].filter(Boolean).join(" · "));
      }
      for (const r of Array.isArray(s.lockups) ? s.lockups : []) {
        const pct = num(r && r.pct);
        ahead("lockup", r && r.date, "보호예수 해제(추정)", pct !== null ? `공모 후 주식수의 ${pct.toFixed(1)}%` : "");
      }
    }

    // 새 공시(오늘·어제 접수) — 한 줄로 묶고 건수를 붙인다.
    const fresh = (Array.isArray(s.recent) ? s.recent : []).filter((e) => {
      if (!e || e.cat === "move" || e.cat === "target" || e.src === "history" || e.src === "dividends" || e.src === "splits") return false;
      const dd = dayDiff(e.date, today);
      return dd !== null && dd >= 0 && dd <= 1;
    });
    if (fresh.length) {
      const top = fresh[0];
      const dd = dayDiff(top.date, today);
      const title = top.detail && /공시$/.test(top.title || "") ? `${top.title} · ${top.detail}` : top.title;
      out.push({
        kind: "filing", date: isoDay(top.date), dday: -dd, dist: dd,
        when: dd === 0 ? "오늘" : "어제",
        label: fresh.length > 1 ? `새 공시 ${fresh.length}건` : "새 공시",
        detail: clip(title, 48),
      });
    }

    // 같은 날·같은 종류 중복 제거 후 가까운 순(같으면 실적 > 보호예수 > 배당 > 공시).
    const uniq = new Map();
    for (const e of out) {
      const k = `${e.kind}|${e.date}|${e.label}`;
      if (!uniq.has(k)) uniq.set(k, e);
    }
    return [...uniq.values()]
      .sort((a, b) => a.dist - b.dist || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
      .slice(0, max)
      .map(({ dist, ...rest }) => rest);
  }

  const api = {
    hasBatchim,
    topic,
    moneyLong,
    moneyShort,
    yoyText,
    annualRows,
    dayDiff,
    mdDate,
    buildSummary,
    buildEventStrip,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MirStockSummary = api;
})(typeof window !== "undefined" ? window : globalThis);
