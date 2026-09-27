// @ts-nocheck
// =============================================================================
// Mir US Stocks — Web Push 알림 워커(Cloudflare Worker, 별도 워커 "mir-push")
//
// 사이트를 닫아도 관심·보유 종목 알림이 오게 한다. 브라우저가 PushManager.subscribe 로 받은
// 구독(endpoint + 키)을 KV 에 저장하고, 30분 Cron Trigger 가 조건을 평가해 발송한다.
//   · 가격: ±N% 등락, 가격 도달(직접 입력·투자 가설/매매일지 목표가·손절가) — 야후 spark 지연 시세
//   · 일정·공시: 실적 발표 D-1, 새 8-K / DART 주요 공시 — GitHub Pages 의 data/*.json
//   · 하루 한 번 "오늘 내 주식은" 요약 — 사이트와 같은 my-digest-core.js(아래에 박아 넣음)
//
// 왜 yahoo-proxy 와 따로인가: 그 워커는 뉴스·차트·커뮤니티·챗봇을 한 파일(3,200행)로 붙여넣기
// 배포한다. 푸시는 크론·암호화·KV 쓰기가 붙는 별도 관심사라, 여기서 난 오류·CPU 초과가 사이트의
// 시세·커뮤니티를 같이 죽이지 않게 워커를 나눴다. 붙여넣는 파일은 이것 하나다(외부 import 없음).
//
// 배포: 머지해도 반영되지 않는다 — Cloudflare 대시보드에 이 파일(origin/main 본)을 붙여넣는 수동
// 배포다. 절차·바인딩·시크릿·크론은 DEPLOY.md "Web Push 알림 워커" 절.
//   바인딩: PUSH_KV(KV, 필수), SYNC_KV(KV, 선택 — yahoo-proxy 의 COMMUNITY_KV 와 같은 네임스페이스)
//   시크릿: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY(scripts/gen_vapid_keys.mjs 로 생성), VAPID_SUBJECT(mailto: 또는 https:)
//   변수(선택): PUSH_MAX_PER_RUN(기본 10), PAGES_DATA_BASE
//   Cron Trigger: "*/30 * * * *"
//
// 암호화는 외부 라이브러리 없이 crypto.subtle 로 직접 한다:
//   RFC 8291(Message Encryption for Web Push, aes128gcm) + RFC 8188 + RFC 8292(VAPID, ES256 JWT).
//   RFC 8291 부록 A 의 테스트 벡터로 worker/test_push.mjs 가 바이트 단위로 검증한다.
//
// 아래 EMBED 블록 두 개는 scripts/sync_push_worker.mjs 가 루트의 my-digest-core.js ·
// push-alerts-core.js 를 그대로 복사해 넣은 것이다. 직접 고치지 말고 원본을 고친 뒤
// `node scripts/sync_push_worker.mjs` 를 돌릴 것(CI 가 --check 로 어긋남을 잡는다).
// =============================================================================

// ===== BEGIN EMBED: my-digest-core.js =====
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
// ===== END EMBED: my-digest-core.js =====

// ===== BEGIN EMBED: push-alerts-core.js =====
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
// ===== END EMBED: push-alerts-core.js =====

const DigestCore = globalThis.MirDigestCore;
const PushCore = globalThis.MirPushCore;

// -----------------------------------------------------------------------------
// 설정
// -----------------------------------------------------------------------------
export const PAGES_DATA_BASE_DEFAULT = "https://seonu-dragon.github.io/Mir_US_Stocks/data";
const ALLOWED_ORIGINS = new Set(["https://seonu-dragon.github.io"]);
const LOCAL_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;
// 알려진 푸시 서비스만 받는다(임의 URL 로 POST 하게 만드는 악용 방지).
const PUSH_HOST_RE = /^(?:fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com)$/i;
const MAX_BODY_BYTES = 16 * 1024;
const SUB_TTL_SEC = 120 * 24 * 3600;       // 120일 동안 사이트를 안 열면(=prefs 갱신 없음) 구독 만료
const PUSH_TTL_SEC = 12 * 3600;            // 푸시 서비스 보관 시간(기기가 꺼져 있을 때)
const RECORD_SIZE = 4096;
const MAX_PAYLOAD_BYTES = 3000;
const SPARK_BATCH = 20;                    // 야후 spark 한 번에 받을 심볼 수
const MAX_SPARK_CALLS = 8;                 // 무료 플랜 서브리퀘스트 50 을 푸시·데이터와 나눠 쓴다
const MAX_SUBS_PER_RUN = 200;
const DEFAULT_MAX_PUSH_PER_RUN = 10;       // 무료 플랜 CPU 10ms 를 감안한 기본값(유료면 변수로 올린다)
const TEST_COOLDOWN_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
const BENCH = { us: { symbol: "SPY", name: "S&P 500(SPY)" }, kr: { symbol: "069500.KS", name: "KODEX 200" } };

// -----------------------------------------------------------------------------
// base64url · 바이트 보조
// -----------------------------------------------------------------------------
const te = new TextEncoder();

export function b64urlEncode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i += 1) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
  const clean = String(str || "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*$/.test(clean)) throw new Error("bad base64url");
  const padded = clean + "===".slice((clean.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}

async function hmacSha256(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** HKDF-SHA256 (출력 32바이트 이하 — 한 블록이면 충분하다). */
export async function hkdf(salt, ikm, info, length) {
  const prk = await hmacSha256(salt, ikm);
  const okm = await hmacSha256(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

function ecJwk(publicRaw, privateB64) {
  if (publicRaw.length !== 65 || publicRaw[0] !== 4) throw new Error("bad P-256 public key");
  const jwk = { kty: "EC", crv: "P-256", x: b64urlEncode(publicRaw.slice(1, 33)), y: b64urlEncode(publicRaw.slice(33, 65)), ext: true };
  if (privateB64) jwk.d = privateB64;
  return jwk;
}

async function sha256Hex(text) {
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(text)));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// -----------------------------------------------------------------------------
// RFC 8291 — 메시지 암호화(aes128gcm, 레코드 1개)
// -----------------------------------------------------------------------------
/**
 * plaintext(Uint8Array 또는 문자열)를 구독자 키로 암호화해 요청 바디를 만든다.
 * opts.salt / opts.asPrivate(b64url d) + opts.asPublic(b64url 65바이트) 를 주면 결정적으로 돈다(테스트 벡터용).
 * 없으면 매번 새 임시 키쌍·salt 를 만든다(실사용).
 */
export async function encryptPayload(plaintext, p256dhB64, authB64, opts = {}) {
  const data = typeof plaintext === "string" ? te.encode(plaintext) : plaintext;
  const uaPublic = b64urlDecode(p256dhB64);
  const authSecret = b64urlDecode(authB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("bad p256dh");
  if (authSecret.length !== 16) throw new Error("bad auth");
  if (data.length + 17 > RECORD_SIZE) throw new Error("payload too large");

  let asPrivateKey;
  let asPublic;
  if (opts.asPrivate && opts.asPublic) {
    asPublic = b64urlDecode(opts.asPublic);
    asPrivateKey = await crypto.subtle.importKey("jwk", ecJwk(asPublic, opts.asPrivate), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPrivateKey = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const salt = opts.salt ? b64urlDecode(opts.salt) : crypto.getRandomValues(new Uint8Array(16));

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivateKey, 256));
  // key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfo = concat(te.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);

  // 마지막(유일한) 레코드: 평문 || 0x02(패딩 구분자)
  const padded = concat(data, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, padded));

  // 헤더: salt(16) || rs(uint32 BE) || idlen(1) || keyid(as_public 65)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// -----------------------------------------------------------------------------
// RFC 8292 — VAPID (ES256 JWT)
// -----------------------------------------------------------------------------
let vapidKeyMemo = { pub: "", key: null };

export async function importVapidPrivateKey(publicB64, privateB64) {
  const pub = b64urlDecode(publicB64);
  return crypto.subtle.importKey("jwk", ecJwk(pub, String(privateB64).trim()), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** aud = 푸시 서비스 origin, sub = mailto:/https: 연락처. WebCrypto ECDSA 서명은 이미 JWS 형식(r||s 64바이트)이다. */
export async function createVapidJwt(aud, subject, privateKey, nowSec = Math.floor(Date.now() / 1000), ttlSec = 12 * 3600) {
  const header = b64urlEncode(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(te.encode(JSON.stringify({ aud, exp: nowSec + ttlSec, sub: subject })));
  const input = `${header}.${claims}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, te.encode(input)));
  return `${input}.${b64urlEncode(sig)}`;
}

function vapidConfigured(env) {
  return Boolean(env && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

async function vapidKey(env) {
  if (vapidKeyMemo.key && vapidKeyMemo.pub === env.VAPID_PUBLIC_KEY) return vapidKeyMemo.key;
  const key = await importVapidPrivateKey(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidKeyMemo = { pub: env.VAPID_PUBLIC_KEY, key };
  return key;
}

/**
 * 푸시 1건 발송. 반환 { ok, gone, status }.
 * gone(404/410) 이면 구독이 만료·해지된 것 — 호출자가 KV 에서 지운다.
 * jwtCache: 같은 실행 안에서 푸시 서비스(origin)별 JWT 재사용.
 */
export async function sendPush(sub, message, env, { fetchImpl = fetch, jwtCache = new Map(), nowMs = Date.now() } = {}) {
  const endpoint = new URL(sub.endpoint);
  const aud = endpoint.origin;
  let jwt = jwtCache.get(aud);
  if (!jwt) {
    jwt = await createVapidJwt(aud, env.VAPID_SUBJECT || "mailto:admin@example.invalid", await vapidKey(env), Math.floor(nowMs / 1000));
    jwtCache.set(aud, jwt);
  }
  let text = JSON.stringify(message);
  if (te.encode(text).length > MAX_PAYLOAD_BYTES) {
    text = JSON.stringify({ ...message, body: String(message.body || "").slice(0, 300) });
  }
  const body = await encryptPayload(text, sub.keys.p256dh, sub.keys.auth);
  let res;
  try {
    res = await fetchWithTimeout(fetchImpl, sub.endpoint, {
      method: "POST",
      headers: {
        TTL: String(PUSH_TTL_SEC),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Urgency: "normal",
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      },
      body,
    });
  } catch (err) {
    return { ok: false, gone: false, status: 0 };
  }
  const status = res.status;
  return { ok: status >= 200 && status < 300, gone: status === 404 || status === 410, status };
}

async function fetchWithTimeout(fetchImpl, url, init = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// HTTP 라우트
// -----------------------------------------------------------------------------
export function originAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin) || LOCAL_ORIGIN_RE.test(origin);
}

function corsHeaders(request) {
  const origin = (request && request.headers.get("Origin")) || "";
  return {
    "Access-Control-Allow-Origin": originAllowed(origin) ? origin : "https://seonu-dragon.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(request, obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request) },
  });
}

// 격리(isolate)별 소프트 리밋 — KV 로 세면 요청마다 쓰기가 생긴다(무료 KV 쓰기 1,000/일).
const softHits = new Map();
export function softRateLimited(ip, bucket, limit, windowMs, now = Date.now()) {
  const key = `${bucket}:${ip || "?"}`;
  const row = softHits.get(key);
  if (!row || now - row.start > windowMs) { softHits.set(key, { start: now, n: 1 }); return false; }
  row.n += 1;
  if (softHits.size > 5000) softHits.clear();
  return row.n > limit;
}
export function resetSoftRateLimit() { softHits.clear(); }

export async function subscriptionId(endpoint) {
  return (await sha256Hex(String(endpoint))).slice(0, 32);
}

/** 구독 객체 검증: https + 알려진 푸시 서비스, p256dh 65바이트(0x04…), auth 16바이트. */
export function validSubscription(sub) {
  if (!sub || typeof sub !== "object" || typeof sub.endpoint !== "string" || sub.endpoint.length > 1024) return false;
  let u;
  try { u = new URL(sub.endpoint); } catch { return false; }
  if (u.protocol !== "https:" || !PUSH_HOST_RE.test(u.hostname)) return false;
  const keys = sub.keys || {};
  try {
    const p = b64urlDecode(keys.p256dh);
    const a = b64urlDecode(keys.auth);
    return p.length === 65 && p[0] === 4 && a.length === 16;
  } catch { return false; }
}

function sanitizeClientId(v) {
  const s = String(v || "").trim();
  return /^[A-Za-z0-9_-]{6,80}$/.test(s) ? s : "";
}

function kstDate(nowMs) {
  return new Date(nowMs + 9 * 3600000).toISOString().slice(0, 10);
}

async function readBody(request) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY_BYTES) return { error: "payload_too_large", status: 413 };
  let text;
  try { text = await request.text(); } catch { return { error: "bad_json", status: 400 }; }
  if (te.encode(text).length > MAX_BODY_BYTES) return { error: "payload_too_large", status: 413 };
  try { return { body: JSON.parse(text) }; } catch { return { error: "bad_json", status: 400 }; }
}

async function loadRecord(env, id) {
  const raw = await env.PUSH_KV.get(`sub:${id}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveRecord(env, rec) {
  await env.PUSH_KV.put(`sub:${rec.id}`, JSON.stringify(rec), { expirationTtl: SUB_TTL_SEC });
}

export async function handleFetch(request, env, deps = {}) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

  if (request.method === "GET" && url.pathname === "/push/health") {
    let lastRun = null;
    if (env && env.PUSH_KV) {
      try { lastRun = JSON.parse((await env.PUSH_KV.get("cron:meta")) || "null"); } catch { lastRun = null; }
    }
    return jsonResponse(request, {
      ok: true,
      configured: vapidConfigured(env) && Boolean(env && env.PUSH_KV),
      vapidPublicKey: (env && env.VAPID_PUBLIC_KEY) || "",
      sync: Boolean(env && env.SYNC_KV),
      lastRun: lastRun ? lastRun.last || null : null,
    });
  }

  const routes = ["/push/subscribe", "/push/unsubscribe", "/push/prefs", "/push/test"];
  if (!routes.includes(url.pathname)) return jsonResponse(request, { error: "not_found" }, 404);
  if (request.method !== "POST") return jsonResponse(request, { error: "method_not_allowed" }, 405);
  if (!originAllowed(request.headers.get("Origin") || "")) return jsonResponse(request, { error: "forbidden_origin" }, 403);
  if (!env || !env.PUSH_KV || !vapidConfigured(env)) return jsonResponse(request, { error: "not_configured" }, 503);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (softRateLimited(ip, "push", 30, 60 * 1000, deps.nowMs)) return jsonResponse(request, { error: "rate_limited" }, 429);

  const parsed = await readBody(request);
  if (parsed.error) return jsonResponse(request, { error: parsed.error }, parsed.status);
  const body = parsed.body || {};
  const nowMs = deps.nowMs || Date.now();

  if (url.pathname === "/push/subscribe") {
    const sub = body.subscription;
    if (!validSubscription(sub)) return jsonResponse(request, { error: "bad_subscription" }, 400);
    const id = await subscriptionId(sub.endpoint);
    const prev = await loadRecord(env, id);
    const prefs = PushCore.normalizePrefs(body.prefs);
    const rec = {
      v: 1,
      id,
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      prefs,
      lists: PushCore.normalizeLists(body.lists),
      // 동기화 목록 자동 사용은 사용자가 켰을 때만 clientId 를 보관한다(개인정보 최소화).
      syncClientId: prefs.useSync ? sanitizeClientId(body.syncClientId) : "",
      createdAt: (prev && prev.createdAt) || new Date(nowMs).toISOString(),
      since: (prev && prev.since) || kstDate(nowMs),
      updatedAt: new Date(nowMs).toISOString(),
      state: (prev && prev.state) || {},
    };
    await saveRecord(env, rec);
    return jsonResponse(request, { ok: true, id, since: rec.since });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return jsonResponse(request, { error: "missing_endpoint" }, 400);
  const id = await subscriptionId(endpoint);

  if (url.pathname === "/push/unsubscribe") {
    await env.PUSH_KV.delete(`sub:${id}`);
    return jsonResponse(request, { ok: true });
  }

  const rec = await loadRecord(env, id);
  if (!rec || rec.endpoint !== endpoint) return jsonResponse(request, { error: "not_subscribed" }, 404);

  if (url.pathname === "/push/prefs") {
    if (body.prefs) rec.prefs = PushCore.normalizePrefs(body.prefs);
    if (body.lists) rec.lists = PushCore.normalizeLists(body.lists);
    rec.syncClientId = rec.prefs.useSync ? sanitizeClientId(body.syncClientId || rec.syncClientId) : "";
    rec.updatedAt = new Date(nowMs).toISOString();
    await saveRecord(env, rec);
    return jsonResponse(request, { ok: true });
  }

  // /push/test — 1분에 한 번. 하루 상한에는 세지 않는다.
  const state = rec.state || {};
  if (nowMs - (Number(state.lastTestAt) || 0) < TEST_COOLDOWN_MS) return jsonResponse(request, { error: "rate_limited" }, 429);
  const result = await sendPush(rec, {
    title: "Mir 알림 테스트",
    body: "이 기기로 알림이 도착합니다. 조건에 맞는 일이 생기면 이런 식으로 알려 드립니다.",
    url: PushCore.siteUrl("us"),
    tag: "mir-test",
  }, env, { fetchImpl: deps.fetchImpl || fetch, nowMs });
  if (result.gone) {
    await env.PUSH_KV.delete(`sub:${id}`);
    return jsonResponse(request, { error: "subscription_gone" }, 410);
  }
  rec.state = { ...state, lastTestAt: nowMs };
  await saveRecord(env, rec);
  return jsonResponse(request, result.ok ? { ok: true } : { error: "push_failed", status: result.status }, result.ok ? 200 : 502);
}

// -----------------------------------------------------------------------------
// 크론 — 데이터 모으기
// -----------------------------------------------------------------------------
async function fetchJson(fetchImpl, url) {
  try {
    const r = await fetchWithTimeout(fetchImpl, url, { headers: UA });
    if (!r || !r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * 티커 목록 → { ticker: quote }. 야후 spark 를 20개씩(최대 MAX_SPARK_CALLS 번). 국내 코드는 .KS 로
 * 먼저 부르고, 비어 오면 .KQ 로 한 번 더 부른다(기기가 접미사를 알려 준 코드는 바로 그것으로).
 * 반환 calls = 쓴 서브리퀘스트 수.
 */
export async function fetchQuotes(fetchImpl, tickers, lists, maxCalls = MAX_SPARK_CALLS) {
  const quotes = {};
  let calls = 0;
  const run = async (pairs) => {
    for (let i = 0; i < pairs.length && calls < maxCalls; i += SPARK_BATCH) {
      const chunk = pairs.slice(i, i + SPARK_BATCH);
      calls += 1;
      const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${chunk.map(([, s]) => encodeURIComponent(s)).join(",")}&range=1d&interval=1d`;
      const parsed = PushCore.parseSpark(await fetchJson(fetchImpl, url));
      chunk.forEach(([t, s]) => { if (parsed[s.toUpperCase()]) quotes[t] = parsed[s.toUpperCase()]; });
    }
  };
  const first = tickers.map((t) => [t, PushCore.yahooSymbol(t, lists, false)]).filter(([, s]) => s);
  await run(first);
  const retry = tickers.filter((t) => !quotes[t]).map((t) => [t, PushCore.yahooSymbol(t, lists, true)]).filter(([, s]) => s);
  if (retry.length) await run(retry);
  return { quotes, calls };
}

function dataUrl(env, path) {
  return `${((env && env.PAGES_DATA_BASE) || PAGES_DATA_BASE_DEFAULT).replace(/\/$/, "")}/${path}`;
}

/** 이번 실행에 필요한 Pages 데이터만 받는다. 빠진 파일은 null(그 종류 알림만 건너뛴다). */
async function loadSources(env, fetchImpl, need) {
  const get = (p) => fetchJson(fetchImpl, dataUrl(env, p));
  const [materialEvents, earningsReleases, usCalendar, usMovers, krDisclosures, krIrSchedule, krDividends, krMovers] = await Promise.all([
    need.usPast ? get("material_events.json") : null,
    need.usPast ? get("earnings_releases.json") : null,
    need.usUpcoming ? get("us_calendar.json") : null,
    need.usMovers ? get("movers_reasons.json") : null,
    need.krPast ? get("kr_disclosures.json") : null,
    need.krUpcoming ? get("korea/ir_schedule.json") : null,
    need.krDividends ? get("korea/dividends.json") : null,
    need.krMovers ? get("korea/movers_reasons.json") : null,
  ]);
  return {
    us: { materialEvents, earningsReleases, usCalendar, movers: usMovers },
    kr: { krDisclosures, krIrSchedule, krDividends, movers: krMovers },
  };
}

/** 워커용 일간 요약 입력. 스냅샷(6MB) 대신 구독자 종목의 spark 시세로 행을 만든다 — 업종 비교는 빠진다(5종목 미만). */
export function buildWorkerDigest({ market, lists, quotes, sources, today, benchQuote }) {
  const tickers = PushCore.marketTickers(lists, market);
  const universe = tickers.filter((t) => quotes[t]).map((t) => ({
    ticker: t,
    company: (lists.names && lists.names[t]) || quotes[t].name || t,
    price: quotes[t].price,
    changePct: quotes[t].changePct,
    priceDate: quotes[t].tradeDate,
  }));
  if (!universe.length) return null;
  const basisDate = universe.reduce((m, r) => (r.priceDate > m ? r.priceDate : m), "");
  // 나흘 넘게 묵은 시세(연휴·수집 실패)로는 '오늘' 요약을 보내지 않는다.
  if (!basisDate || PushCore.addDays(basisDate, 4) < today) return null;
  const set = new Set(tickers);
  const src = sources[market] || {};
  const past = DigestCore.pastEvents(src, set, DigestCore.addDays(basisDate, -6), basisDate);
  const upcoming = DigestCore.upcomingEvents(src, set, today, 14);
  const names = {};
  tickers.forEach((t) => { names[t] = (lists.names && lists.names[t]) || (market === "us" ? t : (quotes[t] && quotes[t].name) || t); });
  const mv = src.movers && (!src.movers.market || src.movers.market === market) ? src.movers : null;
  const bench = benchQuote && benchQuote.changePct != null ? { name: BENCH[market].name, changePct: benchQuote.changePct } : null;
  return DigestCore.buildDailyDigest({
    market, today, basisDate,
    holdings: (lists[market].hold || []).map((h) => ({ ticker: h.t, qty: h.q })),
    watchlist: lists[market].watch || [],
    universe, movers: mv, past, upcoming, names, bench,
  });
}

async function listSubscriptionIds(env) {
  const ids = [];
  let cursor;
  for (let page = 0; page < 5; page += 1) {
    const res = await env.PUSH_KV.list({ prefix: "sub:", cursor, limit: 1000 });
    (res.keys || []).forEach((k) => ids.push(k.name.slice(4)));
    if (res.list_complete || !res.cursor) break;
    cursor = res.cursor;
  }
  return ids.sort();
}

async function resolveLists(env, rec) {
  const base = PushCore.normalizeLists(rec.lists);
  if (!rec.prefs || !rec.prefs.useSync || !rec.syncClientId || !env.SYNC_KV) return base;
  try {
    const raw = await env.SYNC_KV.get(`sync:prefs:${rec.syncClientId}`);
    if (!raw) return base;
    return PushCore.mergeLists(base, PushCore.listsFromSyncPrefs(JSON.parse(raw)));
  } catch {
    return base;
  }
}

// -----------------------------------------------------------------------------
// 크론 — 본체
// -----------------------------------------------------------------------------
/**
 * 30분마다. planJobs 가 이번 칸에 할 일을 정하고, 구독을 커서부터 돌며 알림을 모아 보낸다.
 * 구독당 한 실행에 알림은 시장별 1건(여러 조건은 한 알림의 여러 줄) + 요약 1건.
 * 하루 상한(maxPerDay)에 걸린 알림은 '보낸 것으로' 기록해 다음 날 늦게 몰려오지 않게 한다.
 * 실행당 발송 예산(PUSH_MAX_PER_RUN)이 떨어지면 거기서 멈추고 다음 실행이 그 구독부터 잇는다.
 */
export async function runCron(env, nowMs = Date.now(), deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const summary = { at: new Date(nowMs).toISOString(), jobs: [], subs: 0, processed: 0, sent: 0, suppressed: 0, gone: 0, failed: 0 };
  if (!env || !env.PUSH_KV || !vapidConfigured(env)) return { ...summary, error: "not_configured" };
  const plan = PushCore.planJobs(nowMs);
  const jobs = plan.jobs;
  summary.jobs = Object.keys(jobs).filter((k) => jobs[k]);
  if (!summary.jobs.length) return summary;

  let meta = {};
  try { meta = JSON.parse((await env.PUSH_KV.get("cron:meta")) || "{}") || {}; } catch { meta = {}; }
  const ids = await listSubscriptionIds(env);
  summary.subs = ids.length;
  const start = ids.length ? (Number(meta.cursor) || 0) % ids.length : 0;
  const order = [...ids.slice(start), ...ids.slice(0, start)].slice(0, MAX_SUBS_PER_RUN);

  const records = [];
  for (const id of order) {
    const rec = await loadRecord(env, id);
    if (!rec || !rec.endpoint || !rec.keys) continue;
    rec.prefs = PushCore.normalizePrefs(rec.prefs);
    rec._lists = await resolveLists(env, rec);
    records.push(rec);
  }

  const wantsDigest = (rec, m) => rec.prefs.kinds.digest && rec.prefs.digestMarkets.includes(m);
  const doDigest = { us: jobs.digestUs, kr: jobs.digestKr };
  const doPrice = { us: jobs.priceUs, kr: jobs.priceKr };

  // 시세: 가격 조건(장중) 또는 요약이 필요한 시장의 종목 합집합.
  const quotes = { us: {}, kr: {} };
  let sparkCalls = 0;
  for (const m of ["us", "kr"]) {
    const need = new Set();
    records.forEach((rec) => {
      const priceOn = doPrice[m] && (rec.prefs.kinds.move || rec.prefs.kinds.level);
      if (priceOn || (doDigest[m] && wantsDigest(rec, m))) {
        PushCore.marketTickers(rec._lists, m).forEach((t) => need.add(t));
        if (priceOn) rec._lists.levels.filter((l) => l.m === m).forEach((l) => need.add(l.t));
      }
    });
    if (!need.size) continue;
    if (doDigest[m]) need.add(m === "us" ? "SPY" : "069500");
    const merged = records.reduce((acc, r) => ({ ...acc, ...r._lists.ys }), {});
    const res = await fetchQuotes(fetchImpl, [...need], { ys: { ...merged, "069500": "069500.KS" } }, MAX_SPARK_CALLS - sparkCalls);
    sparkCalls += res.calls;
    quotes[m] = res.quotes;
  }

  const anyKind = (k) => records.some((r) => r.prefs.kinds[k]);
  const anyDigest = (m) => doDigest[m] && records.some((r) => wantsDigest(r, m));
  const needEarn = jobs.earningsD1 && anyKind("earnings");
  const sources = await loadSources(env, fetchImpl, {
    usPast: (jobs.eventsUs && anyKind("disclosure")) || anyDigest("us"),
    usUpcoming: needEarn || anyDigest("us"),
    usMovers: anyDigest("us"),
    krPast: (jobs.eventsKr && anyKind("disclosure")) || anyDigest("kr"),
    krUpcoming: needEarn || anyDigest("kr"),
    krDividends: anyDigest("kr"),
    krMovers: anyDigest("kr"),
  });

  const today = plan.kstDate;
  const budget = Math.max(1, Math.min(40, Number(env.PUSH_MAX_PER_RUN) || DEFAULT_MAX_PUSH_PER_RUN));
  const jwtCache = new Map();
  let cursorAdvance = order.length;
  // 사건은 시장마다 한 번만 정규화하고(전 종목), 구독별로는 evaluateEvents 가 자기 종목만 거른다 —
  // 구독자마다 공시 1,500행을 다시 훑으면 CPU 를 구독자 수만큼 곱해 쓴다.
  const eventMemo = {};
  const eventsFor = (m) => {
    if (!eventMemo[m]) {
      eventMemo[m] = {
        past: DigestCore.pastEvents(sources[m], null, PushCore.addDays(today, -3), today),
        upcoming: DigestCore.upcomingEvents(sources[m], null, today, 2),
      };
    }
    return eventMemo[m];
  };

  for (let idx = 0; idx < records.length; idx += 1) {
    const rec = records[idx];
    if (summary.sent >= budget) { cursorAdvance = order.indexOf(rec.id); break; }
    summary.processed += 1;
    const lists = rec._lists;
    let state = PushCore.dayState(rec.state, today);
    const messages = []; // { payload, keys }
    for (const m of ["us", "kr"]) {
      const tickers = PushCore.marketTickers(lists, m);
      if (doDigest[m] && wantsDigest(rec, m) && tickers.length) {
        const dkey = `dg:${m}:${today}`;
        if (!state.fired[dkey]) {
          const digest = buildWorkerDigest({ market: m, lists, quotes: quotes[m], sources, today, benchQuote: quotes[m][m === "us" ? "SPY" : "069500"] });
          const payload = PushCore.digestNotification(digest, DigestCore);
          if (payload) messages.push({ payload, keys: [dkey] });
        }
      }
      const alerts = [];
      if (doPrice[m]) {
        alerts.push(...PushCore.evaluatePrice({ prefs: rec.prefs, lists, quotes: quotes[m], fired: state.fired, market: m, nowMs }));
      }
      const doDisc = m === "us" ? jobs.eventsUs : jobs.eventsKr;
      if ((doDisc || jobs.earningsD1) && tickers.length && (rec.prefs.kinds.disclosure || rec.prefs.kinds.earnings)) {
        const ev = eventsFor(m);
        alerts.push(...PushCore.evaluateEvents({
          prefs: rec.prefs, lists, market: m, past: ev.past, upcoming: ev.upcoming, fired: state.fired,
          today, since: rec.since, doEarnings: jobs.earningsD1, doDisclosures: doDisc,
        }));
      }
      if (alerts.length) {
        const payload = PushCore.composeAlertNotification(alerts, m, { stamp: `${today}-${plan.kstSlot}` });
        if (payload) messages.push({ payload, keys: alerts.map((a) => a.key) });
      }
    }
    if (!messages.length) continue;

    let changed = false;
    let gone = false;
    for (const msg of messages) {
      if (PushCore.capRemaining(state, rec.prefs) <= 0) {
        // 하루 상한 — 보내지 않되 기록해 둔다(다음 날 지난 일이 몰려오지 않게).
        state = PushCore.recordFired(state, msg.keys, today);
        summary.suppressed += 1;
        changed = true;
        continue;
      }
      if (summary.sent >= budget) break;
      const res = await sendPush(rec, msg.payload, env, { fetchImpl, jwtCache, nowMs });
      if (res.gone) { gone = true; break; }
      if (res.ok) {
        state = PushCore.recordFired({ ...state, sent: state.sent + 1 }, msg.keys, today);
        summary.sent += 1;
        changed = true;
      } else {
        summary.failed += 1; // 일시 오류(429·5xx) — 기록하지 않아 다음 실행이 다시 본다
      }
    }
    if (gone) {
      await env.PUSH_KV.delete(`sub:${rec.id}`);
      summary.gone += 1;
      continue;
    }
    if (changed) {
      state = PushCore.pruneState(state, lists, today);
      const { _lists, ...clean } = rec;
      await saveRecord(env, { ...clean, state });
    }
  }

  const nextCursor = ids.length ? (start + Math.max(0, cursorAdvance)) % ids.length : 0;
  await env.PUSH_KV.put("cron:meta", JSON.stringify({ cursor: nextCursor, last: { ...summary, sparkCalls } }));
  return { ...summary, sparkCalls };
}

export default {
  async fetch(request, env) {
    try {
      return await handleFetch(request, env);
    } catch (err) {
      console.error("mir-push internal error:", err);
      return jsonResponse(request, { error: "internal" }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env, event.scheduledTime || Date.now()).then((s) => {
      if (s && (s.sent || s.gone || s.failed)) console.log("mir-push cron", JSON.stringify(s));
    }).catch((err) => console.error("mir-push cron error:", err)));
  },
};
