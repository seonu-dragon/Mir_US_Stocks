// 찾기 › 상위 종목 표 — 열 목록·열 설정(보이는 열·순서) 순수 로직(DOM 없음).
// 브라우저에서는 window.MirFindTableCore, node 테스트(scripts/tests/test_find_table_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 열은 실제로 데이터가 있는 필드만 둔다(2026-09-26 스냅샷 기준).
//   · US 스냅샷에는 거래량·거래대금 필드가 없다 → US 에서는 거래량 배율만.
//   · 외국인 비율(foreignPct)은 국내 MAP_FUNDAMENTALS 에만 있다.
//   · PER·PBR·ROE·배당수익률은 MAP_FUNDAMENTALS(부팅 몇 초 뒤 도착) — 값이 없으면 화면은 "—".
//   · 주당배당금·배당성향: 국내는 MAP_FUNDAMENTALS(dps·payoutRatio), 미국은 US_STOCK_CALENDAR
//     (시총 상위 ~200종목의 divRate·payout)에만 있다. 연속 배당 연수는 두 시장 모두 소스가 없어 열을 두지 않는다.
//
// 아래쪽 '목록' 로직(배당 랭킹·신규상장·관리/경보)도 여기 둔다 — 전부 입력 객체만 보고 계산한다.
(function (root) {
  "use strict";

  // metric: 헤더를 누르면 정렬 기준(#topMetric 옵션 값)으로 쓴다. 없으면 정렬 불가 열.
  const COLUMNS = [
    { key: "price", label: "현재가", markets: ["us", "kr"], num: true },
    { key: "changePct", label: "등락률", markets: ["us", "kr"], num: true, metric: "changePct" },
    { key: "weekChangePct", label: "1주", markets: ["us", "kr"], num: true, metric: "weekChangePct" },
    { key: "monthChangePct", label: "1개월", markets: ["us", "kr"], num: true, metric: "monthChangePct" },
    { key: "ytdChangePct", label: "연초 대비", markets: ["us", "kr"], num: true, metric: "ytdChangePct" },
    { key: "volume", label: "거래량", markets: ["kr"], num: true, metric: "volume" },
    { key: "amount", label: "거래대금", markets: ["kr"], num: true, metric: "amount" },
    { key: "volumeRatio", label: "거래량 배율", markets: ["us", "kr"], num: true, metric: "volumeRatio" },
    { key: "marketCap", label: "시가총액", markets: ["us", "kr"], num: true, metric: "marketCapB" },
    { key: "pe", label: "PER", markets: ["us", "kr"], num: true, metric: "pe" },
    { key: "pb", label: "PBR", markets: ["us", "kr"], num: true, metric: "pb" },
    { key: "roe", label: "ROE", markets: ["us", "kr"], num: true },
    { key: "divYield", label: "배당수익률", markets: ["us", "kr"], num: true },
    { key: "dps", label: "주당배당금", markets: ["us", "kr"], num: true },
    { key: "payoutRatio", label: "배당성향", markets: ["us", "kr"], num: true },
    { key: "foreignPct", label: "외국인 비율", markets: ["kr"], num: true },
    { key: "rsi14", label: "RSI", markets: ["us", "kr"], num: true, metric: "rsi14" },
    { key: "epsTtm", label: "EPS", markets: ["us", "kr"], num: true, metric: "epsTtm" },
    { key: "newHigh", label: "52주 고점 대비", markets: ["us", "kr"], num: true, metric: "newHighDistancePct" },
    { key: "sector", label: "섹터", markets: ["us", "kr"], num: false },
  ];

  const DEFAULTS = {
    us: ["price", "changePct", "monthChangePct", "volumeRatio", "marketCap", "pe", "rsi14"],
    kr: ["price", "changePct", "volume", "amount", "marketCap", "pe", "foreignPct"],
  };

  function mkt(market) {
    return market === "kr" ? "kr" : "us";
  }

  function availableColumns(market) {
    const m = mkt(market);
    return COLUMNS.filter((c) => c.markets.includes(m));
  }

  function columnByKey(key) {
    return COLUMNS.find((c) => c.key === key) || null;
  }

  function defaultColumns(market) {
    return DEFAULTS[mkt(market)].slice();
  }

  // 저장된 목록을 현재 시장에서 쓸 수 있는 열만, 순서 유지·중복 제거로 정리한다. 비면 기본값.
  function sanitizeColumns(saved, market) {
    if (!Array.isArray(saved)) return defaultColumns(market);
    const ok = new Set(availableColumns(market).map((c) => c.key));
    const out = [];
    saved.forEach((k) => {
      if (typeof k === "string" && ok.has(k) && !out.includes(k)) out.push(k);
    });
    return out.length ? out : defaultColumns(market);
  }

  function parseSaved(text) {
    if (typeof text !== "string" || !text) return null;
    try {
      const v = JSON.parse(text);
      return Array.isArray(v) ? v : null;
    } catch (_) {
      return null;
    }
  }

  // 켜면 맨 끝에 붙이고, 끄면 뺀다(마지막 한 열은 끌 수 없다).
  function toggleColumn(list, key, on, market) {
    const cur = sanitizeColumns(list, market);
    const ok = availableColumns(market).some((c) => c.key === key);
    if (!ok) return cur;
    if (on) return cur.includes(key) ? cur : cur.concat([key]);
    if (cur.length <= 1) return cur;
    return cur.filter((k) => k !== key);
  }

  // delta: -1(앞으로) / +1(뒤로). 범위를 넘으면 그대로.
  function moveColumn(list, key, delta) {
    const cur = list.slice();
    const i = cur.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= cur.length) return cur;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    return cur;
  }

  // ===== 목록: 배당 랭킹 · 신규상장 · 관리/경보 =====
  function fin(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function isEtfItem(item) {
    if (!item) return false;
    const sec = String(item.sector || "").toUpperCase();
    return sec === "ETF" || sec === "EXCHANGE TRADED FUNDS" || Boolean(item.etfCategory) || item.nav != null;
  }

  // 한 종목의 배당 정보. fund = MAP_FUNDAMENTALS 행, cal = US_STOCK_CALENDAR.stocks[티커](미국만).
  //   · 주당배당금: fund.dps → cal.divRate.
  //   · 배당수익률: fund.divSrc(빌더가 붙인 기준)가 있으면 fund.divYield. 없으면 같은 줄의 주당배당금 ÷ 현재가를 먼저(표의 두 값이 서로 맞게), 없으면 cal.divYield,
  //     그다음 fund.divYield. 미국 fund.divYield 는 Finnhub 값이 섞여 현재가 기준보다 높게 나오는
  //     종목이 있었다(MO 9.45% vs 4.44/68.82=6.45%). 0 이하는 배당 없음(null).
  //   · 배당성향: fund.payoutRatio → cal.payout. 이익이 0 이하(적자)면 의미가 없어 null, deficit=true.
  function dividendInfo(item, fund, cal) {
    const f = fund || {};
    const c = cal || {};
    const dpsRaw = fin(f.dps) != null ? fin(f.dps) : fin(c.divRate);
    const dps = dpsRaw != null && dpsRaw > 0 ? dpsRaw : null;
    const price = fin(item && item.price);
    // 미국: 빌더가 기준을 정해 둔 값(divSrc: ttm=최근 12개월 지급 합÷현재가, yahoo, finnhub)이 있으면
    // 그 값을 그대로 쓴다 — 히트맵·수식 스크리너와 같은 숫자가 되게.
    const srcY = f.divSrc ? fin(f.divYield) : null;
    const fromDps = dps != null && price != null && price > 0 ? Math.round((dps / price) * 10000) / 100 : null;
    const y = srcY != null ? srcY : fromDps != null ? fromDps : fin(c.divYield) != null ? fin(c.divYield) : fin(f.divYield);
    const divYield = y != null && y > 0 ? y : null;
    const divSrc = srcY != null ? String(f.divSrc) : null;
    const eps = fin(f.eps) != null ? fin(f.eps) : fin(item && item.epsTtm);
    const deficit = eps != null && eps <= 0;
    const payRaw = fin(f.payoutRatio) != null ? fin(f.payoutRatio) : fin(c.payout);
    const payoutRatio = deficit || payRaw == null || payRaw < 0 ? null : payRaw;
    return { divYield, dps, payoutRatio, deficit, divSrc };
  }

  // 배당 랭킹: 배당수익률 내림차순. sanity(MirFundSanity)가 있으면 '이상치 가능'(수익률 30% 초과)은
  // 경계 안 값 뒤로 보내고 표시한다. ETF 는 제외(분배금 구조가 달라 같은 줄에 두지 않는다).
  function dividendRanking(items, opts) {
    const o = opts || {};
    const fundFor = o.fundFor || (() => null);
    const calFor = o.calFor || (() => null);
    const sanity = o.sanity || null;
    const rows = [];
    (items || []).forEach((item) => {
      if (!item || isEtfItem(item)) return;
      const info = dividendInfo(item, fundFor(item), calFor(item));
      if (info.divYield == null) return;
      const outlier = sanity ? sanity.isOutlier("divYield", info.divYield) : info.divYield > 30;
      rows.push(Object.assign({ item, outlier }, info));
    });
    rows.sort((a, b) => {
      if (sanity) {
        const d = sanity.sortCompare("divYield", a.divYield, b.divYield, -1);
        if (d) return d;
      } else if (a.outlier !== b.outlier) {
        return a.outlier ? 1 : -1;
      } else if (b.divYield !== a.divYield) {
        return b.divYield - a.divYield;
      }
      return (fin(b.item.marketCapB) || 0) - (fin(a.item.marketCapB) || 0);
    });
    return o.limit ? rows.slice(0, o.limit) : rows;
  }

  // "2026.09.23" / "2026-09-23" → "2026-09-23"
  function isoDate(s) {
    const m = String(s || "").match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (!m) return null;
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  function daysBetween(aIso, bIso) {
    const a = Date.parse(`${aIso}T00:00:00Z`);
    const b = Date.parse(`${bIso}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  function normName(s) {
    return String(s || "")
      .replace(/\(주\)|㈜|주식회사/g, "")
      .replace(/[\s.,·()\-]/g, "")
      .toLowerCase();
  }

  function secCik(link) {
    const m = String(link || "").match(/\/data\/(\d+)\//);
    return m ? m[1] : null;
  }

  // 신규상장. ipo = IPO_CALENDAR(시장별 파일), stocks = 스냅샷 종목, today = "YYYY-MM-DD".
  //   · 국내(38커뮤니케이션): stage "priced" = 신규 상장 완료, fileDate = 상장일, offerPrice = 확정 공모가(원).
  //     종목코드가 비어 있는 행이 많아 회사명으로 스냅샷과 맞춘다.
  //   · 미국(SEC): 424B4(가격확정) 중, 같은 회사(CIK)의 S-1/F-1 등록 신청이 수집 기간 안에 있는 것만.
  //     424B4 는 기존 상장사의 추가 공모에도 쓰여 등록 신청 기록이 없는 건은 신규상장이라 단정할 수 없다.
  //     offerPriceKind "unit"(SPAC 유닛가)은 주가와 단위가 달라 공모가 대비를 계산하지 않는다.
  function recentListings(market, ipo, stocks, today, opts) {
    const o = opts || {};
    const maxDays = o.days || 90;
    const list = (ipo && Array.isArray(ipo.ipos)) ? ipo.ipos : [];
    const byTicker = new Map();
    const byName = new Map();
    (stocks || []).forEach((s) => {
      if (!s || !s.ticker) return;
      byTicker.set(String(s.ticker).toUpperCase(), s);
      const n = normName(s.company);
      if (n && !byName.has(n)) byName.set(n, s);
    });
    const kr = market === "kr";
    const registered = new Set();
    if (!kr) {
      list.forEach((r) => {
        if (r && r.stage !== "priced" && /^(S-1|F-1)/.test(String(r.form || ""))) {
          const cik = secCik(r.link);
          if (cik) registered.add(cik);
        }
      });
    }
    const seen = new Set();
    const out = [];
    list.forEach((r) => {
      if (!r || r.stage !== "priced") return;
      const date = isoDate(r.fileDate);
      if (!date) return;
      const age = today ? daysBetween(date, today) : 0;
      if (age == null || age < 0 || age > maxDays) return;
      if (!kr) {
        if (String(r.form || "") !== "424B4") return;
        const cik = secCik(r.link);
        if (!cik || !registered.has(cik)) return;
      }
      const tk = r.ticker ? String(r.ticker).toUpperCase() : "";
      const item = (tk && byTicker.get(tk)) || (kr ? byName.get(normName(r.company)) : null) || null;
      const key = item ? `t:${item.ticker}` : (tk ? `t:${tk}` : `n:${normName(r.company)}`);
      if (seen.has(key)) return;
      seen.add(key);
      const offer = fin(r.offerPrice);
      const offerUnit = r.offerPriceKind === "unit";
      const price = item ? fin(item.price) : null;
      let retPct = offer && offer > 0 && price != null && !offerUnit ? (price / offer - 1) * 100 : null;
      // 현재가가 공모가의 10배 초과·10분의 1 미만이면 액면분할·병합이나 기존 상장사 공모일 가능성이 커
      // 공모가 대비를 계산하지 않는다(값을 지우고 표시만 남긴다).
      const retSuspect = retPct != null && (price / offer > 10 || price / offer < 0.1);
      if (retSuspect) retPct = null;
      out.push({
        company: r.company || (item && item.company) || "",
        ticker: item ? item.ticker : (tk || null),
        date, days: age, offerPrice: offer, offerUnit, price, retPct, retSuspect, item,
        link: r.link || null, broker: kr ? (r.form || "") : "",
      });
    });
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }

  // 관리종목·거래정지·시장경보(KR_MARKET_ALERTS.sections). 한 종목이 여러 구분에 걸리면 행을 나눠 둔다.
  const ALERT_KINDS = [
    { key: "admin", label: "관리종목", group: "admin" },
    { key: "halt", label: "거래정지", group: "halt" },
    { key: "risk", label: "투자위험", group: "warn" },
    { key: "warning", label: "투자경고", group: "warn" },
    { key: "caution", label: "투자주의", group: "caution" },
  ];

  function alertRows(alerts, stocks, filter) {
    const sec = (alerts && alerts.sections) || {};
    const byTicker = new Map();
    (stocks || []).forEach((s) => { if (s && s.ticker) byTicker.set(String(s.ticker), s); });
    const out = [];
    ALERT_KINDS.forEach((k) => {
      if (filter && filter !== "all" && filter !== k.group) return;
      const s = sec[k.key];
      if (!s || !Array.isArray(s.rows)) return;
      s.rows.forEach((r) => {
        if (!r || !r.ticker) return;
        out.push({
          kind: k.key, kindLabel: k.label, group: k.group,
          ticker: String(r.ticker), company: r.company || "", market: r.market || "",
          detail: r.reason || r.type || "",
          date: isoDate(r.designatedDate) || isoDate(r.noticeDate) || null,
          asOf: s.asOf || null, item: byTicker.get(String(r.ticker)) || null,
        });
      });
    });
    return out;
  }

  function alertCounts(alerts) {
    const sec = (alerts && alerts.sections) || {};
    const c = { all: 0, admin: 0, halt: 0, warn: 0, caution: 0 };
    ALERT_KINDS.forEach((k) => {
      const n = sec[k.key] && Array.isArray(sec[k.key].rows) ? sec[k.key].rows.length : 0;
      c[k.group] += n;
      c.all += n;
    });
    return c;
  }

  const api = {
    COLUMNS, availableColumns, columnByKey, defaultColumns, sanitizeColumns, parseSaved, toggleColumn, moveColumn,
    isEtfItem, dividendInfo, dividendRanking, isoDate, daysBetween, normName, recentListings, ALERT_KINDS, alertRows, alertCounts,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirFindTableCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
