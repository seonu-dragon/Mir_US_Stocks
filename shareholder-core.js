// 주주환원(배당·자사주) — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirShareholderCore, node 테스트(scripts/tests/test_shareholder_core.mjs)는 module.exports.
//
// 입력은 이미 받는 자료뿐(새 수집 없음):
//   배당 기록  종목 상세 dividends [[배당락일, 주당 금액], …] — 야후 배당 이벤트(분할·무상증자 조정, 일봉과 같은
//              약 5년 범위). 기록 범위의 시작 = 상세 chartSeries 첫 날짜(그 전 해는 일부만 있어 막대에서 뺀다).
//   EPS        재무 확장 파일(financials_common.py) 의 지배주주 순이익 ÷ 주식수. 공시 EPS 는 분할 전후 기준이
//              행마다 섞여 있어(NVDA·AAPL) 쓰지 않고, mcap-core.js normalizeShares 로 '현재 기준'으로 환산한
//              주식수로 다시 만든다(US PER 밴드와 같은 방식). 순이익 ≤ 0 이면 배당성향은 '적자'.
//   현재 수익률 MAP_FUNDAMENTALS divYield(%) — 미국은 상세 배당 최근 1년 합 ÷ 현재가(divSrc ttm) 등, 국내는
//              네이버·KRX. 없으면 최근 1년 배당 합 ÷ 현재가로 계산.
//   자사주     국내 DART 자기주식 공시(KR_DISCLOSURES 최근 창 + KR_EVENT_DETAILS 금액·주식수), 이벤트 스터디
//              종목 샤드의 약 5년 공시 기록(건수만, 금액 없음). 미국 8-K 자사주 발표(MATERIAL_EVENTS — 금액이
//              확인된 것만 금액), 그리고 재무 파일의 희석 주식수 변화(분할 환산).
// 배당성향(연도별)은 미국만 회계연도 창(직전 결산일 다음 날 ~ 결산일)의 배당락 합 ÷ 그 회계연도 EPS 로 맞춘다.
// 국내는 2024년 이후 결산배당 기준일을 이듬해 2~3월로 옮긴 회사가 많아 배당락일로 연도를 가르면 결산배당이
// 다음 해에 잡힌다 — 그래서 국내는 연도별 배당성향을 만들지 않고 소스의 현재 배당성향만 쓴다.
(function (root) {
  "use strict";

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  function dayNum(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    if (!m) return null;
    return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
  }

  function dayToIso(d) {
    return new Date(d * 86400000).toISOString().slice(0, 10);
  }

  // [[date, amount], …] 또는 [{date, amount}] → [{day, date, amt}] 오름차순(0 이하·이상치 제외).
  function cleanDividends(raw) {
    const out = [];
    (raw || []).forEach((e) => {
      let d, a;
      if (Array.isArray(e)) { d = e[0]; a = Number(e[1]); }
      else if (e && typeof e === "object") { d = e.date || e.d; a = Number(e.amount != null ? e.amount : e.value); }
      const day = dayNum(d);
      if (day !== null && Number.isFinite(a) && a > 0) out.push({ day, date: String(d).slice(0, 10), amt: a });
    });
    return out.sort((x, y) => x.day - y.day);
  }

  // 연간 횟수 판정: 최근 2년 배당 간격의 중앙값.
  function frequency(divs, todayDay) {
    const recent = divs.filter((d) => d.day > todayDay - 730);
    if (!recent.length) return { key: "none", label: "최근 2년 배당 없음", perYear: 0 };
    if (recent.length < 2) return { key: "irregular", label: "비정기", perYear: null };
    const gaps = [];
    for (let i = 1; i < recent.length; i += 1) gaps.push(recent[i].day - recent[i - 1].day);
    gaps.sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    if (med <= 45) return { key: "monthly", label: "월배당", perYear: 12 };
    if (med <= 120) return { key: "quarterly", label: "분기배당", perYear: 4 };
    if (med <= 240) return { key: "semi", label: "반기배당", perYear: 2 };
    if (med <= 420) return { key: "annual", label: "연 1회", perYear: 1 };
    return { key: "irregular", label: "비정기", perYear: null };
  }

  // 최근 1년(오늘 − 365일 초과 ~ 오늘) 배당락 합.
  function trailingSum(divs, todayDay) {
    let s = 0, n = 0;
    divs.forEach((d) => { if (d.day > todayDay - 365 && d.day <= todayDay) { s += d.amt; n += 1; } });
    return { sum: n ? s : 0, count: n };
  }

  // 달력 연도별 주당배당금. 기록 시작 해(1월 1일보다 늦게 시작)는 일부만 있어 뺀다. 올해는 partial.
  function calendarYears(divs, coverageStartDay, todayDay) {
    const byYear = {};
    divs.forEach((d) => {
      const y = Number(dayToIso(d.day).slice(0, 4));
      const slot = byYear[y] || (byYear[y] = { sum: 0, count: 0 });
      slot.sum += d.amt; slot.count += 1;
    });
    const thisYear = Number(dayToIso(todayDay).slice(0, 4));
    const startYear = coverageStartDay != null ? Number(dayToIso(coverageStartDay).slice(0, 4)) : null;
    const firstFull = coverageStartDay == null ? null
      : (dayToIso(coverageStartDay).slice(5) <= "01-10" ? startYear : startYear + 1);
    const out = [];
    const lo = firstFull != null ? firstFull : Math.min(thisYear, ...Object.keys(byYear).map(Number));
    for (let y = lo; y <= thisYear; y += 1) {
      const s = byYear[y];
      out.push({ label: String(y), year: y, dps: s ? s.sum : 0, count: s ? s.count : 0, partial: y === thisYear });
    }
    return out;
  }

  // 회계연도 창별 주당배당금(미국). annualRows = [{fy, end}], 창 = (직전 결산일, 결산일].
  // 창 시작이 기록 시작보다 앞이면 일부만 있으니 뺀다. 첫 행은 직전 결산일이 없어 end − 365일.
  function fiscalYears(divs, annualRows, coverageStartDay, todayDay) {
    const rows = (annualRows || []).filter((r) => r && dayNum(r.end) !== null).slice().sort((a, b) => dayNum(a.end) - dayNum(b.end));
    const out = [];
    rows.forEach((r, i) => {
      const end = dayNum(r.end);
      const start = i > 0 ? dayNum(rows[i - 1].end) : end - 365;
      if (coverageStartDay != null && start < coverageStartDay - 3) return;
      let s = 0, n = 0;
      divs.forEach((d) => { if (d.day > start && d.day <= end) { s += d.amt; n += 1; } });
      out.push({ label: `FY${r.fy}`, fy: r.fy, end: r.end, dps: s, count: n, partial: false });
    });
    // 마지막 결산일 뒤 ~ 오늘: 진행 중인 회계연도(옅은 막대, 배당성향 없음).
    const last = rows[rows.length - 1];
    if (last && todayDay != null && out.length) {
      const lastEnd = dayNum(last.end);
      let s = 0, n = 0;
      divs.forEach((d) => { if (d.day > lastEnd && d.day <= todayDay) { s += d.amt; n += 1; } });
      if (n) out.push({ label: `FY${Number(last.fy) + 1}`, fy: Number(last.fy) + 1, end: null, dps: s, count: n, partial: true });
    }
    return out;
  }

  // 현재 기준(분할 환산) EPS. norm = mcap-core normalizeShares 의 norm(관측치에 n). 희석 평균 우선, 없으면 기말 주식수.
  function epsAdjusted(row, norm, kind) {
    const net = num(row && row.net);
    const end = dayNum(row && row.end);
    if (net === null || end === null) return null;
    const at = (norm || []).filter((o) => o.day === end);
    const dil = at.find((o) => o.kind === "dil");
    const out = at.find((o) => o.kind === "out");
    const sh = (dil || out || {}).n;
    if (!(sh > 0)) return null;
    return { eps: net / sh, basis: dil ? "dil" : "out", kind: kind || "annual" };
  }

  // 배당성향 = 주당배당금 ÷ EPS. EPS ≤ 0 → { deficit: true }.
  function payout(dps, eps) {
    if (!Number.isFinite(dps) || eps === null || eps === undefined || !Number.isFinite(eps)) return null;
    if (eps <= 0) return { ratio: null, deficit: true };
    return { ratio: dps / eps, deficit: false };
  }

  // 주식수 변화: 정규화된 연간 관측치(같은 종류로 비교 — 희석 평균이 있으면 그것, 없으면 기말 발행).
  function shareChange(norm, annualEnds) {
    const ends = new Set((annualEnds || []).map(dayNum).filter((d) => d !== null));
    const pick = (kind) => (norm || []).filter((o) => o.kind === kind && ends.has(o.day)).sort((a, b) => a.day - b.day);
    let series = pick("dil");
    let basis = "dil";
    if (series.length < 2) { series = pick("out"); basis = "out"; }
    if (series.length < 2) return null;
    const last = series[series.length - 1];
    const back = (years) => {
      const target = last.day - 365 * years;
      let best = null;
      series.forEach((o) => { if (Math.abs(o.day - target) <= 60 && (!best || Math.abs(o.day - target) < Math.abs(best.day - target))) best = o; });
      return best;
    };
    const y1 = back(1), y3 = back(3);
    return {
      basis,
      lastEnd: dayToIso(last.day),
      last: last.n,
      y1Pct: y1 ? last.n / y1.n - 1 : null,
      y3Pct: y3 ? last.n / y3.n - 1 : null,
      y3From: y3 ? dayToIso(y3.day) : null,
    };
  }

  // 국내 자기주식 공시 분류(disclosure-trackers.js buybackCategory 와 같은 규칙).
  function krBuybackCategory(title) {
    const t = String(title || "");
    if (!t.includes("자기주식")) return null;
    if (t.includes("소각")) return { key: "cancel", label: "소각", dir: "buy" };
    if (t.includes("취득신탁계약해지")) return { key: "trustEnd", label: "신탁해지", dir: "sell" };
    if (t.includes("취득신탁계약체결")) return { key: "trust", label: "신탁취득", dir: "buy" };
    if (t.includes("자기주식취득")) return { key: "acquire", label: "취득", dir: "buy" };
    if (t.includes("자기주식처분")) return { key: "dispose", label: "처분", dir: "sell" };
    return null;
  }

  // 최근 공시 창의 자기주식 공시(한 종목). disclosures = KR_DISCLOSURES.disclosures, details = KR_EVENT_DETAILS.details.
  function krRecentBuybacks(code, disclosures, details) {
    const rcpt = (link) => { const m = /rcpNo=(\d+)/.exec(link || ""); return m ? m[1] : ""; };
    const rows = [];
    (disclosures || []).forEach((d) => {
      if (!d || String(d.ticker) !== String(code)) return;
      const cat = krBuybackCategory(d.title);
      if (!cat) return;
      const det = (details || {})[rcpt(d.link)] || {};
      rows.push({
        date: d.fileDate || d.date || "", key: cat.key, label: cat.label, dir: cat.dir,
        amount: num(Number(det.amount)) || null, shares: num(Number(det.shares)) || null,
        title: d.title || "", link: d.link || "",
      });
    });
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const totals = {};
    rows.forEach((r) => {
      const t = totals[r.key] || (totals[r.key] = { label: r.label, count: 0, amount: 0, amountKnown: 0, shares: 0 });
      t.count += 1;
      if (r.amount) { t.amount += r.amount; t.amountKnown += 1; }
      if (r.shares) t.shares += r.shares;
    });
    return { rows, totals };
  }

  // 이벤트 스터디 종목 샤드 rows([유형, d0(2000-01-01 기준 일수), …]) → 자사주 관련 공시 연도별 건수.
  const HISTORY_KINDS = {
    kr_buyback: "취득", kr_buyback_trust: "신탁취득", kr_cancel: "소각", kr_treasury_sale: "처분",
    us_buyback: "자사주 발표",
  };
  function buybackHistory(rows, dayBase) {
    const base = dayNum(dayBase || "2000-01-01");
    const byYear = {};
    const kinds = {};
    let first = null, last = null;
    (rows || []).forEach((r) => {
      if (!Array.isArray(r) || !HISTORY_KINDS[r[0]]) return;
      const day = base + Number(r[1]);
      if (!Number.isFinite(day)) return;
      const y = dayToIso(day).slice(0, 4);
      const slot = byYear[y] || (byYear[y] = {});
      slot[r[0]] = (slot[r[0]] || 0) + 1;
      kinds[r[0]] = (kinds[r[0]] || 0) + 1;
      first = first === null ? day : Math.min(first, day);
      last = last === null ? day : Math.max(last, day);
    });
    const total = Object.values(kinds).reduce((a, b) => a + b, 0);
    if (!total) return null;
    return {
      total, kinds, labels: HISTORY_KINDS,
      years: Object.keys(byYear).sort().map((y) => ({ year: y, counts: byYear[y] })),
      first: dayToIso(first), last: dayToIso(last),
    };
  }

  // 국내 교차 확인: 배당 기록(야후)이 없는 지난 해 중 DART '현금·현물배당결정' 공시(이벤트 기록 kr_dividend)가 있는 해.
  // 기록 누락일 수 있다는 각주용 — 값을 채우지는 않는다.
  function missingDividendYears(years, rows, dayBase) {
    const base = dayNum(dayBase || "2000-01-01");
    const disclosed = new Set();
    (rows || []).forEach((r) => {
      if (Array.isArray(r) && r[0] === "kr_dividend" && Number.isFinite(Number(r[1]))) disclosed.add(dayToIso(base + Number(r[1])).slice(0, 4));
    });
    return (years || []).filter((y) => !y.partial && !y.count && disclosed.has(String(y.year != null ? y.year : y.label))).map((y) => y.label);
  }

  // 미국 8-K 자사주 발표(한 종목). events = MATERIAL_EVENTS.events.
  function usBuybackAnnouncements(ticker, events) {
    const T = String(ticker || "").toUpperCase();
    const rows = (events || []).filter((e) => e && String(e.ticker || "").toUpperCase() === T && (e.kind === "buyback" || e.buybackMention))
      .map((e) => ({
        date: e.fileDate || e.date || "",
        amount: Number(e.amountUsd) > 0 ? Number(e.amountUsd) : null,
        confirmed: e.kind === "buyback",
        link: e.link || "",
      }));
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return rows;
  }

  // 전체 요약. opts: { market, dividends, chartStart, today, annualRows, ttm, norm, price, fund, mapFund, kr*, us* }
  function summarize(opts) {
    const o = opts || {};
    const market = o.market === "kr" ? "kr" : "us";
    const todayDay = dayNum(o.today) != null ? dayNum(o.today) : Math.floor(Date.now() / 86400000);
    const divs = cleanDividends(o.dividends);
    const coverageStart = dayNum(o.chartStart) != null ? dayNum(o.chartStart) : (divs.length ? divs[0].day : null);
    const trail = trailingSum(divs, todayDay);
    const freq = frequency(divs, todayDay);
    const price = num(o.price);
    const mf = o.mapFund || {};
    // 현재 배당수익률: 소스 값 우선(%) → 최근 1년 합 ÷ 현재가.
    let yieldPct = null, yieldSrc = null;
    if (num(mf.divYield) !== null && mf.divYield >= 0) {
      yieldPct = mf.divYield;
      yieldSrc = market === "kr" ? "네이버·KRX" : (mf.divSrc === "ttm" ? "최근 1년 배당 ÷ 현재가" : mf.divSrc === "yahoo" ? "야후" : mf.divSrc === "finnhub" ? "Finnhub" : "지표 파일");
    } else if (trail.count && price) {
      yieldPct = trail.sum / price * 100;
      yieldSrc = "최근 1년 배당 ÷ 현재가";
    }
    // 연도별 막대: 미국은 회계연도 창(재무 파일이 있을 때), 국내·재무 없음은 달력 연도.
    const annualRows = (o.annualRows || []).filter((r) => r && r.end);
    const useFiscal = market === "us" && annualRows.length > 0 && divs.length > 0;
    let years = useFiscal ? fiscalYears(divs, annualRows, coverageStart, todayDay) : calendarYears(divs, coverageStart, todayDay);
    if (useFiscal && !years.length) years = calendarYears(divs, coverageStart, todayDay);
    const fiscal = useFiscal && years.length && /^FY/.test(years[0].label);
    if (fiscal) {
      years.forEach((y) => {
        if (y.partial) { y.eps = null; y.payout = null; y.deficit = false; return; }
        const row = annualRows.find((r) => r.fy === y.fy);
        const e = row ? epsAdjusted(row, o.norm, "annual") : null;
        y.eps = e ? e.eps : null;
        const p = e ? payout(y.dps, e.eps) : null;
        y.payout = p ? p.ratio : null;
        y.deficit = !!(p && p.deficit);
      });
    }
    // 최근 1년 배당성향: 미국은 최근 1년 배당 합 ÷ TTM EPS(순이익 4분기 합 ÷ 최근 희석 주식수, 분할 환산),
    // 국내는 소스(네이버) 배당성향(%, 직전 결산 기준).
    let ttmPayout = null;
    if (market === "us" && o.ttm && o.ttm.basis === "4Q" && num(o.ttm.net) !== null && trail.count) {
      const latest = (o.norm || []).filter((x) => x.kind === "dil").sort((a, b) => b.day - a.day)[0]
        || (o.norm || []).filter((x) => x.kind === "out").sort((a, b) => b.day - a.day)[0];
      if (latest && latest.n > 0) {
        const p = payout(trail.sum, o.ttm.net / latest.n);
        if (p) ttmPayout = Object.assign({ basis: "ttm", eps: o.ttm.net / latest.n }, p);
      }
    } else if (market === "kr" && num(mf.payoutRatio) !== null
      // 소스가 결측을 0 으로 싣는 경우(배당을 했는데 배당성향 0%)는 값이 없는 것으로 본다(000500 실측).
      && !(mf.payoutRatio === 0 && (trail.count > 0 || (num(mf.dps) || 0) > 0))) {
      const epsSrc = num(mf.eps);
      ttmPayout = epsSrc !== null && epsSrc <= 0 ? { ratio: null, deficit: true, basis: "source" }
        : { ratio: mf.payoutRatio / 100, deficit: false, basis: "source" };
    }
    const hasDividends = divs.length > 0 || (yieldPct !== null && yieldPct > 0);
    return {
      market,
      dividends: divs,
      lastDividend: divs.length ? divs[divs.length - 1] : null,
      coverageStart: coverageStart != null ? dayToIso(coverageStart) : null,
      trailing: trail,
      frequency: freq,
      yieldPct, yieldSrc,
      sourceDps: num(mf.dps),
      years,
      fiscal: !!fiscal,
      ttmPayout,
      hasDividends,
    };
  }

  const api = {
    cleanDividends,
    frequency,
    trailingSum,
    calendarYears,
    fiscalYears,
    epsAdjusted,
    payout,
    shareChange,
    krBuybackCategory,
    krRecentBuybacks,
    buybackHistory,
    usBuybackAnnouncements,
    missingDividendYears,
    summarize,
    dayNum,
    HISTORY_KINDS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirShareholderCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
