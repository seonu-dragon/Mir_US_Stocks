// "오늘 내 주식은" — 보유·관심 종목 요약의 순수 계산 모듈(DOM·전역 상태 없음).
// 브라우저에서는 window.MirDigestCore, node 테스트(scripts/tests/test_my_digest_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 입력: 종목 목록(보유·관심) + 이미 로드된 데이터(스냅샷 행·특징주 사유·정규화된 사건)
// 출력: 구조화된 요약 객체 — 화면(my-digest.js)과 나중에 붙일 Web Push 가 같은 객체를 쓴다.
// LLM 을 부르지 않는다. 문장은 모두 규칙·템플릿이고, 추천·전망 문구는 넣지 않는다(사실만).
//
// 경계(나중에 종목 통합 타임라인과 합칠 수 있게 셋으로 나눈다)
//   1) 사건 조회: pastEvents(sources, …) / upcomingEvents(sources, …)
//      — 데이터셋별 모양을 { ticker, date, kind, label, link, source, priority } 로 정규화만 한다.
//   2) 비교 기준: groupAverages(universe, …) / weekReturnOf(row)
//   3) 요약 조립: buildDailyDigest(input) / buildWeeklyDigest(input) / digestToText(digest)
(function (root) {
  "use strict";

  // ------------------------------------------------------------------ 날짜·숫자
  function normIso(value) {
    if (!value) return null;
    const m = String(value).trim().match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/);
    if (!m) return null;
    const mo = Number(m[2]); const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  function utc(iso) { return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))); }
  function addDays(iso, n) {
    const d = new Date(utc(iso) + n * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function dayDiff(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  /** 직전 평일(주말만 건너뜀 — 휴장일은 모른다). */
  function prevWeekday(iso) {
    let d = addDays(iso, -1);
    for (let i = 0; i < 3; i += 1) {
      const wd = new Date(utc(d)).getUTCDay();
      if (wd !== 0 && wd !== 6) return d;
      d = addDays(d, -1);
    }
    return d;
  }
  function md(iso) { return iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : ""; }
  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function fmtPct(v, digits = 1) {
    const n = num(v);
    if (n == null) return "—";
    const r = Number(n.toFixed(digits));
    return `${r > 0 ? "+" : ""}${r.toFixed(digits)}%`;
  }
  function fmtPp(v, digits = 2) {
    const n = num(v);
    if (n == null) return "—";
    const r = Number(n.toFixed(digits));
    return `${r > 0 ? "+" : ""}${r.toFixed(digits)}%p`;
  }
  function ddayText(dd) { return dd === 0 ? "D-DAY" : `D-${dd}`; }
  function clip(s, n) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  }
  function upper(t) { return String(t || "").trim().toUpperCase(); }

  // ------------------------------------------------------------------ 1) 사건 조회
  // 국내 공시 제목 중 주가 설명에 먼저 올릴 유형(나머지는 정기보고서 등 — 있으면 사실로만 적는다).
  const KR_PRIORITY = [
    [/잠정|영업실적|매출액또는손익|손익구조/, 90],
    [/거래정지|상장폐지|관리종목|불성실공시|투자경고|투자위험/, 88],
    [/유상증자|무상증자|전환사채|신주인수권|교환사채|감자/, 85],
    [/합병|분할|영업양수|영업양도|주식교환|공개매수/, 84],
    [/단일판매|공급계약|수주/, 80],
    [/자기주식|자사주/, 78],
    [/배당/, 75],
    [/최대주주|대량보유|임원ㆍ주요주주|주요주주/, 60],
    [/소송|횡령|배임/, 70],
  ];
  function krPriority(text) {
    for (const [re, p] of KR_PRIORITY) if (re.test(text)) return p;
    return 30;
  }

  /**
   * 지나간 사건(공시·실적 발표) — [fromIso, toIso] 안, tickerSet 에 든 종목만.
   * sources: { materialEvents, earningsReleases, krDisclosures } (브라우저 전역 그대로)
   * 반환: [{ ticker, date, kind: "earnings"|"disclosure", label, link, source, priority }]
   */
  function pastEvents(sources, tickerSet, fromIso, toIso) {
    const src = sources || {};
    const has = (t) => !tickerSet || tickerSet.has(t);
    const inRange = (d) => d && (!fromIso || d >= fromIso) && (!toIso || d <= toIso);
    const out = [];
    const releaseKeys = new Set();
    ((src.earningsReleases && src.earningsReleases.releases) || []).forEach((r) => {
      const t = upper(r && r.ticker); const d = normIso(r && r.fileDate);
      if (!t || !has(t) || !inRange(d)) return;
      releaseKeys.add(`${t}|${d}`);
      out.push({ ticker: t, date: d, kind: "earnings", source: "8-K 2.02",
        label: r.oneLine ? `실적 발표 — ${clip(r.oneLine, 70)}` : "실적 발표(8-K)", link: r.exhibitUrl || r.filingUrl || "", priority: 95 });
    });
    ((src.materialEvents && src.materialEvents.events) || []).forEach((e) => {
      const t = upper(e && e.ticker); const d = normIso(e && e.fileDate);
      if (!t || !has(t) || !inRange(d)) return;
      const items = (e.items || []).filter((it) => it && it.label && it.code !== "9.01");
      // 실적 보도자료 요약이 이미 있으면 같은 날 8-K 2.02 는 중복이다.
      const rest = releaseKeys.has(`${t}|${d}`) ? items.filter((it) => it.code !== "2.02") : items;
      if (!rest.length) return;
      out.push({ ticker: t, date: d, kind: rest.some((it) => it.code === "2.02") ? "earnings" : "disclosure", source: "8-K",
        label: `8-K ${rest.slice(0, 2).map((it) => it.label).join(" · ")}`, link: e.link || "", priority: e.hot ? 85 : 60 });
    });
    const seenKr = new Set();
    ((src.krDisclosures && src.krDisclosures.disclosures) || []).forEach((r) => {
      const t = String((r && r.ticker) || "").trim(); const d = normIso(r && r.fileDate);
      if (!t || !has(t) || !inRange(d)) return;
      const label = String(r.typeLabel || r.title || "공시").trim();
      const key = `${t}|${d}|${label}`;
      if (seenKr.has(key)) return;
      seenKr.add(key);
      const text = `${label} ${r.title || ""}`;
      const priority = krPriority(text);
      out.push({ ticker: t, date: d, kind: priority >= 90 ? "earnings" : "disclosure", source: "DART",
        label: clip(label, 40), link: r.link || "", priority });
    });
    return out.sort((a, b) => b.priority - a.priority || b.date.localeCompare(a.date) || a.label.localeCompare(b.label));
  }

  /**
   * 다가오는 일정 — todayIso 부터 horizonDays 안, tickerSet 에 든 종목만.
   * sources: { usCalendar, krIrSchedule, krDividends }
   * 반환: [{ ticker, date, dday, kind: "earnings"|"dividend", label }]
   */
  function upcomingEvents(sources, tickerSet, todayIso, horizonDays = 14) {
    const src = sources || {};
    const has = (t) => !tickerSet || tickerSet.has(t);
    const out = [];
    const push = (t, d, kind, label) => {
      if (!t || !has(t) || !d) return;
      const dd = dayDiff(todayIso, d);
      if (dd < 0 || dd > horizonDays) return;
      out.push({ ticker: t, date: d, dday: dd, kind, label });
    };
    const stocks = (src.usCalendar && src.usCalendar.stocks) || {};
    Object.keys(stocks).forEach((k) => {
      const t = upper(k); const r = stocks[k] || {};
      push(t, normIso(r.nextEarnings), "earnings", "실적 발표 예정");
      const rate = num(r.divRate);
      push(t, normIso(r.exDate), "dividend", rate && rate > 0 ? `배당락(연 $${rate})` : "배당락");
    });
    ((src.krIrSchedule && src.krIrSchedule.rows) || []).forEach((r) => {
      if (!r || !r.earnings) return;
      push(String(r.code || "").trim(), normIso(r.date), "earnings", "실적 발표(IR)");
    });
    // 국내 배당: 정정 공시가 원 공시와 함께 오므로 (종목·종류·기준일)마다 한 번만.
    const seen = new Set();
    ((src.krDividends && src.krDividends.rows) || []).forEach((r) => {
      if (!r) return;
      const t = String(r.ticker || "").trim();
      const key = `${t}|${r.divKind}|${r.recordDate}`;
      if (seen.has(key)) return;
      seen.add(key);
      const dps = num(r.dps);
      const amt = dps && dps > 0 ? ` 주당 ${Math.round(dps).toLocaleString("en-US")}원` : "";
      push(t, normIso(r.recordDate), "dividend", `배당기준일${amt}`);
      push(t, normIso(r.payDate), "dividend", "배당 지급일");
    });
    // 같은 종목·같은 날·같은 문구는 한 번만(실적 예정일이 두 소스에서 겹칠 때).
    const uniq = new Set();
    return out.filter((e) => { const k = `${e.ticker}|${e.date}|${e.label}`; return uniq.has(k) ? false : (uniq.add(k), true); })
      .sort((a, b) => a.dday - b.dday || a.ticker.localeCompare(b.ticker));
  }

  // ------------------------------------------------------------------ 2) 비교 기준
  function isEtfRow(row) {
    const s = String((row && row.sector) || "").toUpperCase();
    return s === "EXCHANGE TRADED FUNDS" || String((row && row.industry) || "") === "ETF" || (row && row.market) === "etf";
  }

  /**
   * 5거래일 수익률(%). 빌더의 weekChangePct = 현재가 / 6번째 전 종가 − 1 이지만, 가격 이력이 없는
   * 행(closeSeries 없음)은 빌더가 당일 등락으로 채운 값이라 쓰지 않는다(null).
   */
  function weekReturnOf(row) {
    if (!row) return null;
    const series = Array.isArray(row.closeSeries) ? row.closeSeries : [];
    if (series.length < 6) return null;
    return num(row.weekChangePct);
  }

  /**
   * 업종·섹터 평균 등락(시총가중, ETF 제외). field: "changePct" | "week".
   * 반환: { byIndustry: {name: {avg, n}}, bySector: {...} }
   */
  function groupAverages(universe, field = "changePct") {
    const acc = { byIndustry: {}, bySector: {} };
    (universe || []).forEach((row) => {
      if (!row || isEtfRow(row)) return;
      const v = field === "week" ? weekReturnOf(row) : num(row.changePct);
      const w = num(row.marketCapB);
      if (v == null || !w || w <= 0) return;
      [["byIndustry", row.industry], ["bySector", row.sector]].forEach(([k, name]) => {
        if (!name) return;
        const g = acc[k][name] || (acc[k][name] = { sw: 0, swv: 0, n: 0 });
        g.sw += w; g.swv += w * v; g.n += 1;
      });
    });
    const fin = (m) => Object.fromEntries(Object.entries(m).map(([k, g]) => [k, { avg: g.swv / g.sw, n: g.n }]));
    return { byIndustry: fin(acc.byIndustry), bySector: fin(acc.bySector) };
  }

  /** 종목의 비교 그룹: 업종(5종목 이상) → 섹터(5종목 이상) → 없음. preferSector 면 섹터부터. */
  function groupFor(row, averages, labelOf, preferSector) {
    if (!row || !averages || isEtfRow(row)) return null;
    const order = preferSector ? [["bySector", "sector"], ["byIndustry", "industry"]] : [["byIndustry", "industry"], ["bySector", "sector"]];
    for (const [k, f] of order) {
      const name = row[f];
      const g = name && averages[k][name];
      if (g && g.n >= 5) return { name: (labelOf ? labelOf(name, f) : name) || name, avg: g.avg, n: g.n, level: f };
    }
    return null;
  }

  /** "업종(반도체) 평균 +1.2%보다 2.3%p 높음 · 코스피 +0.9%" — 비교 사실만. */
  function relativeText(value, group, bench) {
    const parts = [];
    if (group) {
      const gap = value - group.avg;
      const rel = Math.abs(gap) < 1 ? "비슷" : `${Math.abs(gap).toFixed(1)}%p ${gap > 0 ? "높음" : "낮음"}`;
      parts.push(`${group.level === "sector" ? "섹터" : "업종"}(${group.name}) 평균 ${fmtPct(group.avg)}${rel === "비슷" ? "와 비슷" : `보다 ${rel}`}`);
    }
    if (bench && num(bench.changePct) != null) parts.push(`${bench.name} ${fmtPct(bench.changePct)}`);
    return parts.join(" · ");
  }

  // ------------------------------------------------------------------ 3) 요약 조립
  /** 기존 벤치마크 기여도(portfolio.js)와 같은 식: 기여 = 기간 수익률 × 현재 비중. */
  function contributionRows(rows, benchmarkReturn) {
    const valid = (rows || []).filter((r) => r && num(r.returnPct) != null);
    const total = valid.reduce((s, r) => s + (num(r.value) || 0), 0);
    return valid.map((r) => {
      const weightPct = total > 0 ? (num(r.value) || 0) / total * 100 : 100 / valid.length;
      const returnPct = num(r.returnPct);
      const contribution = returnPct * weightPct / 100;
      const out = { ...r, weightPct, returnPct, contribution };
      if (num(benchmarkReturn) != null) out.alphaContribution = (returnPct - num(benchmarkReturn)) * weightPct / 100;
      return out;
    });
  }

  function rowMap(universe) {
    const m = new Map();
    (universe || []).forEach((r) => { if (r && r.ticker) m.set(String(r.ticker).toUpperCase(), r); });
    return m;
  }

  /** 보유 먼저(티커 중복 제거), 관심은 보유에 없는 것만. role: "보유" | "관심". */
  function targetList(holdings, watchlist) {
    const seen = new Set();
    const out = [];
    (holdings || []).forEach((h) => {
      const t = upper(h && h.ticker);
      if (!t || seen.has(t)) return;
      seen.add(t);
      out.push({ ticker: t, role: "보유", qty: num(h.qty) || 0 });
    });
    (watchlist || []).forEach((w) => {
      const t = upper(w);
      if (!t || seen.has(t)) return;
      seen.add(t);
      out.push({ ticker: t, role: "관심", qty: 0 });
    });
    return out;
  }

  function moversRowFor(movers, ticker, basisDate) {
    if (!movers || !Array.isArray(movers.up) || !Array.isArray(movers.down)) return null;
    // 다른 거래일의 특징주 사유를 오늘 등락에 붙이지 않는다.
    if (basisDate && movers.tradeDate && normIso(movers.tradeDate) !== basisDate) return null;
    return [...movers.up, ...movers.down].find((r) => upper(r && r.ticker) === ticker) || null;
  }

  /** 이유 한 줄: 특징주 사유 → 기간 내 사건 → 업종·지수 대비(사실). */
  function reasonFor({ value, moversRow, events, group, bench, emptyText }) {
    if (moversRow) {
      const status = moversRow.reasonStatus || "failed";
      if ((status === "ok" || status === "sector") && (moversRow.reason || moversRow.sectorNote)) {
        const parts = [];
        if (moversRow.sectorNote && status !== "sector") parts.push(moversRow.sectorNote);
        parts.push(moversRow.reason || moversRow.sectorNote);
        const ev = (moversRow.evidence || [])[0];
        return { type: "movers", tag: "특징주 요약", text: parts.join(" · "), link: (ev && ev.link) || "" };
      }
    }
    if (events && events.length) {
      const top = events.slice(0, 2);
      return { type: "event", tag: top[0].kind === "earnings" ? "실적" : "공시",
        text: top.map((e) => `${md(e.date)} ${e.label}`).join(" · "), link: top[0].link || "" };
    }
    if (value == null) return { type: "none", tag: "", text: "등락 데이터 없음", link: "" };
    const rel = relativeText(value, group, bench);
    return { type: "relative", tag: "시장·업종 대비",
      text: `${emptyText}${rel ? ` — ${rel}` : ""}`, link: "" };
  }

  /**
   * 일간 요약.
   * input: {
   *   market: "us"|"kr", today: KST YYYY-MM-DD, basisDate: 스냅샷 기준 거래일,
   *   holdings: [{ticker, qty}], watchlist: [ticker], universe: 스냅샷 stocks 배열,
   *   movers: MOVERS_REASONS, past: pastEvents 결과, upcoming: upcomingEvents 결과,
   *   bench: { name, changePct, weekChangePct }, names: {ticker: 표시 이름}, labelOf(name, field),
   *   preferSector: US 처럼 업종명이 영어라 섹터로 비교할 때 true, averages: groupAverages(…, "changePct") (선택)
   * }
   */
  function buildDailyDigest(input) {
    const inp = input || {};
    const map = inp.rowMap || rowMap(inp.universe);
    const averages = inp.averages || groupAverages(inp.universe, "changePct");
    const targets = targetList(inp.holdings, inp.watchlist);
    const basisDate = normIso(inp.basisDate) || null;
    const names = inp.names || {};
    const missing = [];
    const rows = [];
    targets.forEach((tg) => {
      const row = map.get(tg.ticker);
      if (!row) { missing.push(tg.ticker); return; }
      rows.push({ ...tg, row, price: num(row.price) || 0, value: tg.qty * (num(row.price) || 0) });
    });
    // 보유 포트폴리오 오늘 기여(평가액 가중) — portfolio.js 의 '오늘 기여도' 와 같은 식.
    const held = contributionRows(rows.filter((r) => r.role === "보유" && r.value > 0)
      .map((r) => ({ ticker: r.ticker, value: r.value, returnPct: num(r.row.changePct) })));
    const heldBy = new Map(held.map((h) => [h.ticker, h]));
    let portfolio = null;
    if (held.length) {
      const total = held.reduce((s, h) => s + h.contribution, 0);
      const byAbs = held.slice().sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      portfolio = { count: held.length, dayReturnPct: total, topTicker: byAbs[0].ticker, topContribution: byAbs[0].contribution };
    }
    const from = basisDate ? prevWeekday(basisDate) : null;
    const pastBy = groupByTicker((inp.past || []).filter((e) => !basisDate || (e.date >= from && e.date <= basisDate)));
    const upBy = groupByTicker(inp.upcoming || []);
    const items = rows.map((r) => {
      const t = r.ticker;
      const value = num(r.row.changePct);
      const rowBasis = normIso(r.row.priceDate) || basisDate;
      const h = heldBy.get(t);
      const reason = reasonFor({
        value,
        moversRow: moversRowFor(inp.movers, t, rowBasis),
        events: pastBy.get(t) || [],
        group: groupFor(r.row, averages, inp.labelOf, inp.preferSector),
        bench: inp.bench,
        emptyText: "특별한 공시·특징주 사유 없음",
      });
      const upcoming = (upBy.get(t) || []).slice(0, 2);
      const name = names[t] || r.row.company || t;
      const moveText = `${name} ${fmtPct(value)}${h ? ` · 비중 ${h.weightPct.toFixed(0)}% · 포트 기여 ${fmtPp(h.contribution)}` : ""}`;
      const upText = upcoming.map((u) => `${u.label} ${ddayText(u.dday)}(${md(u.date)})`).join(" · ");
      return {
        ticker: t, name, role: r.role, changePct: value, priceDate: rowBasis,
        weightPct: h ? h.weightPct : null, contributionPct: h ? h.contribution : null,
        reason, upcoming,
        lines: [moveText, reason.text, upText ? `다가오는 일정: ${upText}` : ""].filter(Boolean),
      };
    });
    // 보유 먼저(비중 큰 순), 관심은 등락폭 큰 순.
    items.sort((a, b) => (a.role === b.role
      ? (a.role === "보유" ? (b.weightPct || 0) - (a.weightPct || 0) : Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0))
      : (a.role === "보유" ? -1 : 1)));
    return {
      kind: "daily", market: inp.market || "", today: normIso(inp.today) || "", basisDate,
      eventWindow: from ? { from, to: basisDate } : null,
      counts: { holdings: rows.filter((r) => r.role === "보유").length, watch: rows.filter((r) => r.role === "관심").length },
      portfolio, items, missing,
      bench: inp.bench || null,
      headline: dailyHeadline(portfolio, items, names),
    };
  }

  function dailyHeadline(portfolio, items, names) {
    if (portfolio) {
      const nm = names[portfolio.topTicker] || portfolio.topTicker;
      return `보유 ${portfolio.count}종목 오늘 ${fmtPct(portfolio.dayReturnPct, 2)}(평가액 가중) · 가장 큰 기여 ${nm} ${fmtPp(portfolio.topContribution)}`;
    }
    if (!items.length) return "";
    const up = items.filter((i) => (i.changePct || 0) > 0).length;
    const down = items.filter((i) => (i.changePct || 0) < 0).length;
    return `관심 ${items.length}종목 중 상승 ${up} · 하락 ${down}`;
  }

  function groupByTicker(list) {
    const m = new Map();
    (list || []).forEach((e) => {
      if (!e || !e.ticker) return;
      const t = upper(e.ticker);
      if (!m.has(t)) m.set(t, []);
      m.get(t).push(e);
    });
    return m;
  }

  /**
   * 주간 요약(지난 5거래일). 보유가 있으면 포트폴리오 기여 상·하위(기여 = 5거래일 수익률 × 현재 비중),
   * 없으면 관심종목 5거래일 등락 상·하위. 입력은 buildDailyDigest 와 같고 averages 는 "week" 기준.
   */
  function buildWeeklyDigest(input) {
    const inp = input || {};
    const map = inp.rowMap || rowMap(inp.universe);
    const averages = inp.weekAverages || groupAverages(inp.universe, "week");
    const basisDate = normIso(inp.basisDate) || null;
    const names = inp.names || {};
    const topN = inp.topN || 3;
    const targets = targetList(inp.holdings, inp.watchlist);
    const holdings = targets.filter((t) => t.role === "보유");
    const mode = holdings.length ? "contribution" : "return";
    const pool = (mode === "contribution" ? holdings : targets).map((tg) => {
      const row = map.get(tg.ticker);
      return row ? { ...tg, row, value: tg.qty * (num(row.price) || 0), returnPct: weekReturnOf(row) } : null;
    }).filter(Boolean);
    const noHistory = pool.filter((p) => p.returnPct == null).map((p) => p.ticker);
    let ranked;
    let portfolioReturnPct = null;
    if (mode === "contribution") {
      ranked = contributionRows(pool.filter((p) => p.value > 0), num(inp.bench && inp.bench.weekChangePct));
      portfolioReturnPct = ranked.length ? ranked.reduce((s, r) => s + r.contribution, 0) : null;
    } else {
      ranked = pool.filter((p) => p.returnPct != null).map((p) => ({ ...p, contribution: p.returnPct }));
    }
    ranked.sort((a, b) => b.contribution - a.contribution);
    const win = basisDate ? { from: addDays(basisDate, -6), to: basisDate } : null;
    const pastBy = groupByTicker((inp.past || []).filter((e) => !win || (e.date >= win.from && e.date <= win.to)));
    const weekBench = inp.bench && num(inp.bench.weekChangePct) != null ? { name: inp.bench.name, changePct: inp.bench.weekChangePct } : null;
    const decorate = (r) => {
      const name = names[r.ticker] || r.row.company || r.ticker;
      const reason = reasonFor({
        value: r.returnPct, moversRow: null, events: pastBy.get(r.ticker) || [],
        group: groupFor(r.row, averages, inp.labelOf, inp.preferSector), bench: weekBench, emptyText: "기간 중 확인된 공시 없음",
      });
      const head = mode === "contribution"
        ? `${name} 기여 ${fmtPp(r.contribution)}(5거래일 ${fmtPct(r.returnPct)} · 비중 ${r.weightPct.toFixed(0)}%)`
        : `${name} 5거래일 ${fmtPct(r.returnPct)}`;
      return { ticker: r.ticker, name, role: r.role, returnPct: r.returnPct, weightPct: mode === "contribution" ? r.weightPct : null,
        contributionPct: mode === "contribution" ? r.contribution : null, reason, lines: [head, reason.text] };
    };
    const top = ranked.filter((r) => r.contribution > 0).slice(0, topN).map(decorate);
    const bottom = ranked.filter((r) => r.contribution < 0).reverse().slice(0, topN).map(decorate);
    let headline = "";
    if (mode === "contribution" && portfolioReturnPct != null) {
      headline = `지난 5거래일 보유 ${ranked.length}종목 ${fmtPct(portfolioReturnPct, 2)}(현재 비중 기준 근사)`;
      if (weekBench) headline += ` · ${weekBench.name} ${fmtPct(weekBench.changePct)}`;
    } else if (ranked.length) {
      headline = `지난 5거래일 관심 ${ranked.length}종목 중 상승 ${ranked.filter((r) => r.contribution > 0).length} · 하락 ${ranked.filter((r) => r.contribution < 0).length}`;
    }
    return { kind: "weekly", market: inp.market || "", today: normIso(inp.today) || "", basisDate, window: win, mode,
      portfolioReturnPct, bench: weekBench, top, bottom, noHistory, headline };
  }

  /** 푸시·공유용 평문. 일간은 종목당 최대 3줄, 주간은 상·하위 각 줄. */
  function digestToText(digest, opts) {
    const d = digest || {};
    const maxItems = (opts && opts.maxItems) || 5;
    const out = [];
    if (d.kind === "daily") {
      out.push(`오늘 내 주식은 (${d.basisDate || ""} 장 마감 기준)`);
      if (d.headline) out.push(d.headline);
      (d.items || []).slice(0, maxItems).forEach((it) => { out.push(""); it.lines.forEach((l) => out.push(l)); });
    } else if (d.kind === "weekly") {
      out.push(`이번 주 내 주식은 (${d.window ? `${d.window.from}~${d.window.to}` : ""})`);
      if (d.headline) out.push(d.headline);
      [["상위", d.top], ["하위", d.bottom]].forEach(([label, list]) => {
        if (!list || !list.length) return;
        out.push("", `[${d.mode === "contribution" ? `기여 ${label}` : `등락 ${label}`}]`);
        list.forEach((it) => it.lines.forEach((l) => out.push(l)));
      });
    }
    return out.join("\n").trim();
  }

  const api = {
    // 사건 조회
    pastEvents, upcomingEvents, krPriority,
    // 비교 기준
    weekReturnOf, groupAverages, groupFor, relativeText, isEtfRow,
    // 요약 조립
    contributionRows, targetList, buildDailyDigest, buildWeeklyDigest, digestToText,
    // 날짜·표기 보조(테스트용)
    normIso, addDays, prevWeekday, dayDiff, fmtPct, fmtPp, md,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirDigestCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
