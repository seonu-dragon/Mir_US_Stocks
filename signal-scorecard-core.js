// 신호 라이브 성적표 — 순수 계산 모듈(DOM·파일·네트워크 없음).
// 브라우저에서는 window.MirSignalCore, node(빌더 scripts/build_signal_ledger.mjs ·
// 테스트 scripts/tests/test_signal_scorecard_core.mjs)에서는 module.exports 로 같은 코드를 쓴다.
// IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 흐름
//  1) extractSignals(market, inputs): 그날 화면에 뜬 신호를 화면과 같은 규칙으로 다시 뽑는다
//     (signals.js 시그널 그리드 · app.js 스캐너 · movers.js · kr-alerts.js · 공시 트래커).
//  2) selectNewRows: 같은 사건(공시 번호 등)·같은 상태 신호의 반복 등장(쿨다운)을 걸러
//     원장(append-only)에 새로 적을 줄만 남긴다.
//  3) outcomeFor: 발행 뒤 첫 거래일 시가에 들어가 N거래일째 종가까지의 수익률과 같은 기간
//     벤치마크 수익률·초과수익. 발행 시점 가격(p)은 기록·대조용이고 수익률 계산에는
//     쓰지 않는다(발행 시점엔 이미 장이 끝나 그 가격에 살 수 없었고, 액면분할 조정도 어긋난다).
//  4) summarize: 신호·기간별 평균·중앙값·승률 + 발행일 묶음 부트스트랩 95% 구간.
(function (root) {
  "use strict";

  const HORIZONS = [5, 20, 60];
  const MIN_SAMPLE = 30;            // 이보다 적으면 '판단 보류'
  const EVENT_MAX_AGE_DAYS = 7;     // 공시·지정 같은 사건 신호는 사건일이 기록일 7일 이내일 때만 '오늘 뜬 신호'
  const STALE_DAYS = 10;            // 가격 이력 마지막 봉이 이보다 오래되면 '가격 끊김'
  const DAY_MS = 86400000;

  // 신호 카탈로그. cooldownDays: 같은 종목이 계속 떠 있는 '상태' 신호는 이 기간 안의 재등장을
  // 새 표본으로 세지 않는다. keyed: 공시 번호·거래일처럼 사건 식별자가 있는 신호(한 번만 센다).
  const KINDS = [
    // ---- 미국 ----
    { m: "us", k: "insider_cluster", label: "내부자 클러스터 매수", group: "공시", cooldownDays: 60,
      desc: "2인 이상 임원이 공개시장에서 매수한 종목(시그널 탭 카드 상위 8)." },
    { m: "us", k: "high52", label: "52주 신고가 근접", group: "가격", cooldownDays: 28,
      desc: "52주 고점 0.5% 이내·시총 20억 달러 이상 상위 8(시그널 탭 카드)." },
    { m: "us", k: "material_8k", label: "주요 공시 8-K", group: "공시", keyed: true,
      desc: "주요 항목이 든 8-K(시그널 탭 카드 상위 8). 공시 번호 기준 1회." },
    { m: "us", k: "activist_13d", label: "액티비스트 13D", group: "공시", keyed: true,
      desc: "경영 참여 목적 13D(시그널 탭 카드 상위 8). 공시 번호 기준 1회." },
    { m: "us", k: "factor_low_vol", label: "팩터 순위: 20일 저변동성", group: "팩터", cooldownDays: 28,
      desc: "S&P 500 중 최근 20거래일 변동성이 낮은 상위 24(스캐너 순위 기준)." },
    { m: "us", k: "factor_high52", label: "팩터 순위: 52주 고점 근접", group: "팩터", cooldownDays: 28,
      desc: "S&P 500 중 52주 고점과 가장 가까운 상위 24(스캐너 순위 기준)." },
    { m: "us", k: "momentum_top", label: "모멘텀 점수 상위", group: "팩터", cooldownDays: 28, control: true,
      desc: "S&P 500 모멘텀 점수(1개월 기준) 상위 24. 과거 5년 검증에서 예측력이 없던 점수라 대조군으로 함께 센다." },
    { m: "us", k: "movers_up", label: "오늘의 특징주 · 상승", group: "특징주", keyed: true,
      desc: "장 마감 기준 크게 오른 종목(오늘의 특징주 상승 탭)." },
    { m: "us", k: "movers_down", label: "오늘의 특징주 · 하락", group: "특징주", keyed: true,
      desc: "장 마감 기준 크게 내린 종목(오늘의 특징주 하락 탭)." },
    // ---- 국내 ----
    { m: "kr", k: "high52", label: "52주 신고가 근접", group: "가격", cooldownDays: 28,
      desc: "52주 고점 0.5% 이내·시총 1조원 이상 상위 8(시그널 탭 카드)." },
    { m: "kr", k: "factor_low_vol", label: "팩터 순위: 20일 저변동성", group: "팩터", cooldownDays: 28,
      desc: "코스피(ETF 제외) 중 최근 20거래일 변동성이 낮은 상위 24(스캐너 순위 기준)." },
    { m: "kr", k: "factor_high52", label: "팩터 순위: 52주 고점 근접", group: "팩터", cooldownDays: 28,
      desc: "코스피(ETF 제외) 중 52주 고점과 가장 가까운 상위 24(스캐너 순위 기준)." },
    { m: "kr", k: "momentum_top", label: "모멘텀 점수 상위", group: "팩터", cooldownDays: 28, control: true,
      desc: "코스피 모멘텀 점수(1개월 기준) 상위 24. 과거 검증에서 예측력이 없던 점수라 대조군으로 함께 센다." },
    { m: "kr", k: "movers_up", label: "오늘의 특징주 · 상승", group: "특징주", keyed: true,
      desc: "장 마감 기준 크게 오른 종목(오늘의 특징주 상승 탭)." },
    { m: "kr", k: "movers_down", label: "오늘의 특징주 · 하락", group: "특징주", keyed: true,
      desc: "장 마감 기준 크게 내린 종목(오늘의 특징주 하락 탭)." },
    { m: "kr", k: "alert_warning", label: "투자경고·위험 지정", group: "시장경보", keyed: true,
      desc: "KRX KIND 투자경고·투자위험 지정(예정 포함). 지정 건 기준 1회." },
    { m: "kr", k: "alert_caution", label: "투자주의·경고 예고", group: "시장경보", keyed: true,
      desc: "KRX KIND 투자주의 종목·투자경고 지정예고. 공지 건 기준 1회." },
    { m: "kr", k: "limit_up", label: "상한가", group: "시장경보", keyed: true,
      desc: "기준 거래일 상한가 종목(시장경보 보드)." },
    { m: "kr", k: "limit_down", label: "하한가", group: "시장경보", keyed: true,
      desc: "기준 거래일 하한가 종목(시장경보 보드)." },
    { m: "kr", k: "value_surge", label: "거래대금 급증", group: "시장경보", keyed: true,
      desc: "거래대금 근사치가 20일 평균의 3배 이상·30억원 이상(시장경보 보드)." },
    { m: "kr", k: "buyback", label: "자사주 취득·소각 공시", group: "공시", keyed: true,
      desc: "DART 자기주식 취득·신탁 체결·소각 결정. 공시 번호 기준 1회." },
    { m: "kr", k: "contract", label: "단일판매·공급계약 공시", group: "공시", keyed: true,
      desc: "DART 단일판매·공급계약 체결(금액 파싱된 건). 공시 번호 기준 1회." },
  ];
  const KIND_INDEX = new Map(KINDS.map((x) => [`${x.m}:${x.k}`, x]));
  function kindMeta(m, k) { return KIND_INDEX.get(`${m}:${k}`) || null; }

  // ------------------------------------------------------------ 날짜
  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;
  function isoToMs(iso) {
    const m = ISO_RE.exec(String(iso || ""));
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  }
  function msToIso(ms) {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function addDays(iso, n) { return msToIso(isoToMs(iso) + n * DAY_MS); }
  function daysBetween(a, b) { return Math.round((isoToMs(b) - isoToMs(a)) / DAY_MS); }
  function isoDay(v) { const m = ISO_RE.exec(String(v || "")); return m ? `${m[1]}-${m[2]}-${m[3]}` : ""; }

  // 어떤 시각(UTC ms)의 특정 시간대 현지 날짜·분. Intl 이 있으면 쓰고(서머타임 반영), 없으면 고정 오프셋.
  function localParts(ms, tz, fallbackOffsetMin) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
      const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
      const hour = Number(parts.hour) % 24;
      return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + Number(parts.minute) };
    } catch (_) {
      const d = new Date(ms + fallbackOffsetMin * 60000);
      return { date: msToIso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
    }
  }
  function kstDate(ms) { return localParts(ms, "Asia/Seoul", 540).date; }

  // 기록 시각에 이미 끝난 마지막 거래 세션의 현지 날짜(이 날짜 '이후' 첫 봉이 진입일).
  // 미국: 뉴욕 16:00 이후면 그날, 아니면 전날. 국내: 서울 15:30 이후면 그날, 아니면 전날.
  // 휴장일은 따로 알 필요가 없다 — 진입은 '이 날짜보다 뒤의 첫 실제 봉'이라 저절로 건너뛴다.
  function entryAfterFor(market, recordedAtMs) {
    const lp = market === "kr" ? localParts(recordedAtMs, "Asia/Seoul", 540) : localParts(recordedAtMs, "America/New_York", -240);
    const close = market === "kr" ? 15 * 60 + 30 : 16 * 60;
    return lp.minutes >= close ? lp.date : addDays(lp.date, -1);
  }

  // ------------------------------------------------------------ 화면 규칙 복제
  // app.js 의 isStockEtf(US) / market_config.js 의 isKrEtfLike(KR) 와 같아야 한다.
  function isUsEtf(s) { return !!s && (s.sector === "EXCHANGE TRADED FUNDS" || s.sector === "ETF"); }
  function isKrEtfLike(s) {
    const text = `${(s && s.company) || ""} ${(s && s.industry) || ""} ${(s && s.sector) || ""}`.toUpperCase();
    return !!s && (s.market === "etf" || s.sector === "ETF" || text.includes(" ETF") || text.includes(" ETN")
      || /^(KODEX|TIGER|ACE|RISE|KBSTAR|SOL|ARIRANG|HANARO)\b/.test(text));
  }
  // app.js isSyntheticHistory: historySource 가 정확히 "yahoo" 가 아니면 합성 이력 취급(화면과 같게).
  function isSynthetic(s) { return !s || s.historySource !== "yahoo"; }

  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---- app.js scanQuickProb 와 1:1 (바꾸면 같이 바꿀 것) ----
  function periodChangeFromSeries(series, periods) {
    const vals = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite);
    if (vals.length < 2) return null;
    const idx = Math.min(Math.max(1, periods), vals.length - 1);
    const last = vals[vals.length - 1];
    const ref = vals[vals.length - 1 - idx];
    if (!Number.isFinite(ref) || ref === 0) return null;
    return ((last - ref) / Math.abs(ref)) * 100;
  }
  function enrichScanMomentum(item) {
    if (!item || typeof item !== "object") return item;
    const series = item.closeSeries;
    if (!Array.isArray(series) || series.length < 20) return item;
    const patch = {};
    if (!Number.isFinite(item.threeMonthChangePct)) {
      const pct = periodChangeFromSeries(series, 39);
      if (Number.isFinite(pct)) patch.threeMonthChangePct = Math.round(pct * 10) / 10;
    }
    if (!Number.isFinite(item.monthChangePct)) {
      const pct = periodChangeFromSeries(series, 21);
      if (Number.isFinite(pct)) patch.monthChangePct = Math.round(pct * 10) / 10;
    }
    return Object.keys(patch).length ? { ...item, ...patch } : item;
  }
  function scanRsiBias(rsi) {
    if (!Number.isFinite(rsi)) return 0;
    if (rsi >= 70) return 0.25;
    if (rsi >= 55) return 0.7;
    if (rsi >= 50) return 0.35;
    if (rsi >= 40) return -0.3;
    if (rsi >= 30) return -0.55;
    return 0.15;
  }
  function scanSeriesBias(series) {
    const v = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite);
    if (v.length < 20) return 0;
    const last = v[v.length - 1];
    const smaShort = mean(v.slice(-5));
    const smaLong = mean(v.slice(-20));
    let b = 0;
    b += smaShort > smaLong ? 0.5 : -0.5;
    b += last > smaShort ? 0.25 : -0.25;
    const ref = v[v.length - 10] || last || 1;
    const slope = (last - ref) / Math.abs(ref || 1);
    b += clamp(slope * 5, -0.5, 0.5);
    return clamp(b, -1, 1);
  }
  function rsiValue(item) {
    if (!item || isSynthetic(item)) return null;
    const v = Number(item.rsi14);
    return Number.isFinite(v) ? v : null;
  }
  function scanQuickProb(item, horizon) {
    item = enrichScanMomentum(item);
    const shortW = horizon <= 5 ? 1.4 : horizon >= 60 ? 0.5 : 0.9;
    const longW = horizon >= 60 ? 1.5 : horizon <= 5 ? 0.7 : 1.1;
    const signals = [];
    const push = (bias, weight) => { if (Number.isFinite(bias)) signals.push([bias, weight]); };
    if (Number.isFinite(item.threeMonthChangePct)) push(Math.tanh(item.threeMonthChangePct / 15), 1.4 * longW);
    if (Number.isFinite(item.monthChangePct)) push(Math.tanh(item.monthChangePct / 8), 0.9);
    if (Number.isFinite(item.weekChangePct)) push(Math.tanh(item.weekChangePct / 4), 0.6 * shortW);
    const rsi = rsiValue(item);
    push(scanRsiBias(rsi == null ? NaN : rsi), 1.0 * shortW);
    const trendSign = Math.sign(Number(item.monthChangePct) || Number(item.weekChangePct) || 0);
    if (Number.isFinite(item.volumeRatio) && trendSign !== 0) {
      push(trendSign * clamp((item.volumeRatio - 1) / 1.5, -0.5, 1), 0.5);
    }
    const dist = Number(item.newHighDistancePct);
    if (Number.isFinite(dist)) push(clamp((10 - dist) / 10, -0.3, 1), 0.5);
    push(scanSeriesBias(item.closeSeries), 0.8);
    const totW = signals.reduce((s, [, w]) => s + w, 0) || 1;
    const z = signals.reduce((s, [b, w]) => s + b * w, 0) / totW;
    return { up: clamp(50 + 38 * z, 12, 88), z };
  }
  // app.js scanStdev20 과 같다.
  function stdev20(series) {
    const s = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite).slice(-21);
    if (s.length < 21) return null;
    const rets = [];
    for (let i = 1; i < s.length; i++) if (s[i - 1]) rets.push(s[i] / s[i - 1] - 1);
    const m = mean(rets);
    return Math.sqrt(mean(rets.map((r) => (r - m) ** 2))) * 100;
  }

  // factor_validation.json 에서 팩터가 이 시장 각 기간에 검증 통과였는지({5,20,60}→bool).
  function validationFlags(fv, market, factor) {
    const out = {};
    const hz = fv && fv.markets && fv.markets[market] && fv.markets[market].horizons;
    if (!hz) return null;
    for (const h of HORIZONS) {
      const f = hz[String(h)] && hz[String(h)].factors && hz[String(h)].factors[factor];
      out[h] = !!(f && f.validated);
    }
    return out;
  }

  // 스캐너 기본 범위(US S&P 500 · KR 코스피 ETF 제외) — market_config.js defaultBucket.
  function scannerUniverse(market, stocks) {
    return stocks.filter((s) => {
      if (!s || isSynthetic(s)) return false;
      if (!Array.isArray(s.closeSeries) || s.closeSeries.length < 20) return false;
      if (market === "kr") return s.market === "kospi" && !isKrEtfLike(s);
      const groups = Array.isArray(s.groups) ? s.groups : [s.bucket].filter(Boolean);
      return groups.includes("idx_sp500") || s.bucket === "idx_sp500";
    });
  }

  function topBy(list, scoreFn, n) {
    return list.map((s) => ({ s, v: scoreFn(s) }))
      .filter((x) => x.v != null && Number.isFinite(x.v))
      .sort((a, b) => b.v - a.v)
      .slice(0, n);
  }

  // disclosure-trackers.js buybackCategory 의 '매입/소각' 쪽.
  function isBuybackBuyTitle(title) {
    const t = String(title || "");
    if (!t.includes("자기주식")) return false;
    if (t.includes("소각")) return true;
    if (t.includes("취득신탁계약해지")) return false;
    if (t.includes("취득신탁계약체결")) return true;
    return t.includes("자기주식취득");
  }

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const round = (v, d) => { if (v == null || !Number.isFinite(v)) return null; const m = 10 ** d; return Math.round(v * m) / m; };

  // 그날 화면에 뜬 신호 후보. inputs: { snapshot, insider, events, activist, movers, factorValidation,
  // krAlerts, krDisclosures, krContracts, recordDate(KST 기록일), baseDate(시장 기준 거래일, 선택) }.
  // 반환 [{k, t, p, bd, key?, ev?, x?}] — ev 는 사건일(나이 필터용, 원장에는 x.ev 로 남는다).
  function extractSignals(market, inputs) {
    const inp = inputs || {};
    const snap = inp.snapshot && Array.isArray(inp.snapshot.stocks) ? inp.snapshot : { stocks: [] };
    const stocks = snap.stocks;
    const bySym = new Map(stocks.map((s) => [String(s.ticker), s]));
    const marketBase = isoDay(inp.baseDate) || (market === "us" ? isoDay(snap.priceDate) : "");
    const priceOf = (t) => {
      const s = bySym.get(String(t));
      if (!s) return { p: null, bd: marketBase || null };
      return { p: num(s.price), bd: isoDay(s.priceDate) || marketBase || null };
    };
    const out = [];
    const add = (k, t, extra) => {
      if (!t || t === "—") return;
      const pb = priceOf(t);
      out.push({ k, t: String(t), p: pb.p, bd: pb.bd, ...extra });
    };
    const kr = market === "kr";

    // --- 시그널 그리드(signals.js renderSignals) ---
    if (!kr && inp.insider && Array.isArray(inp.insider.trades)) {
      const byT = {};
      for (const r of inp.insider.trades) {
        if (r.kind !== "buy" || !r.ticker) continue;
        const g = byT[r.ticker] || (byT[r.ticker] = { t: r.ticker, owners: new Set(), v: 0, last: "" });
        g.owners.add(r.owner || "?"); g.v += Number(r.value) || 0;
        if ((r.fileDate || "") > g.last) g.last = r.fileDate || "";
      }
      Object.values(byT).filter((g) => g.owners.size >= 2)
        .sort((a, b) => b.owners.size - a.owners.size || b.v - a.v).slice(0, 8)
        .forEach((g) => add("insider_cluster", g.t, { x: { owners: g.owners.size, usd: Math.round(g.v), ev: g.last } }));
    }
    const minCap = kr ? 1 : 2;
    stocks.filter((s) => !(kr ? isKrEtfLike(s) : isUsEtf(s)) && !isSynthetic(s) && Number(s.newHighDistancePct) <= 0.5 && (s.marketCapB || 0) >= minCap)
      .sort((a, b) => b.marketCapB - a.marketCapB).slice(0, 8)
      .forEach((s) => add("high52", s.ticker, { x: { dist: num(s.newHighDistancePct) } }));
    if (!kr && inp.events && Array.isArray(inp.events.events)) {
      inp.events.events.filter((e) => e.hot).slice(0, 8).forEach((e) => {
        if (!e.accession) return;
        add("material_8k", e.ticker, { key: e.accession, ev: e.fileDate, x: { items: (e.items || []).map((i) => i.code).slice(0, 4) } });
      });
    }
    if (!kr && inp.activist && Array.isArray(inp.activist.filings)) {
      inp.activist.filings.filter((a) => a.kind === "activist").slice(0, 8).forEach((a) => {
        if (!a.accession) return;
        add("activist_13d", a.ticker, { key: a.accession, ev: a.fileDate, x: { form: a.form || "" } });
      });
    }

    // --- 스캐너(app.js renderScanner) 기본 범위 상위 24 ---
    const uni = scannerUniverse(market, stocks);
    const fv = inp.factorValidation || null;
    if (uni.length) {
      const lowFlags = validationFlags(fv, market, "low_vol");
      if (lowFlags) {
        topBy(uni, (s) => { const sd = stdev20(s.closeSeries); return sd == null ? null : -sd; }, 24)
          .forEach(({ s, v }, i) => add("factor_low_vol", s.ticker, { x: { rank: i + 1, sd20: round(-v, 2), val: lowFlags } }));
      }
      // 2026-09-04 이전 스냅샷의 newHighDistancePct 는 5년 고점 기준이었다(app.js 와 같은 가용성 판정).
      const hiFlags = validationFlags(fv, market, "high52_prox");
      if (hiFlags && stocks.some((s) => s && Object.prototype.hasOwnProperty.call(s, "newHighDistance5yPct"))) {
        topBy(uni, (s) => { const v = num(s.newHighDistancePct); return v == null ? null : -v; }, 24)
          .forEach(({ s, v }, i) => add("factor_high52", s.ticker, { x: { rank: i + 1, dist: round(-v, 2), val: hiFlags } }));
      }
      topBy(uni, (s) => scanQuickProb(s, 20).up, 24)
        .forEach(({ s, v }, i) => add("momentum_top", s.ticker, { x: { rank: i + 1, score: round(v, 1) } }));
    }

    // --- 오늘의 특징주(movers.js) ---
    const mv = inp.movers;
    if (mv && (!mv.market || mv.market === market)) {
      const td = isoDay(mv.tradeDate);
      for (const side of ["up", "down"]) {
        (Array.isArray(mv[side]) ? mv[side] : []).forEach((r) => {
          if (!r || !r.ticker || !td) return;
          out.push({ k: side === "up" ? "movers_up" : "movers_down", t: String(r.ticker), p: num(r.close), bd: td,
            key: `${td}|${r.ticker}`, ev: td, x: { chg: round(num(r.changePct), 2) } });
        });
      }
    }

    // --- 국내 시장경보 보드(kr-alerts.js) ---
    const al = kr && inp.krAlerts && inp.krAlerts.sections ? inp.krAlerts : null;
    if (al) {
      const base = isoDay(al.baseDate) || marketBase || null;
      const rowsOf = (key) => { const sec = al.sections[key]; return sec && Array.isArray(sec.rows) ? sec.rows : []; };
      const okSec = (key) => { const sec = al.sections[key]; return sec && sec.status === "ok"; };
      for (const key of ["risk", "warning"]) {
        rowsOf(key).forEach((r) => {
          const when = isoDay(r.designatedDate) || isoDay(r.noticeDate);
          if (!r.ticker || !when) return;
          add("alert_warning", r.ticker, { key: `${key}|${r.ticker}|${when}`, ev: isoDay(r.noticeDate) || when, x: { lv: key } });
        });
      }
      rowsOf("caution").forEach((r) => {
        const when = isoDay(r.noticeDate) || isoDay(r.designatedDate);
        if (!r.ticker || !when) return;
        add("alert_caution", r.ticker, { key: `caution|${r.ticker}|${when}|${r.type || ""}`, ev: when, x: { type: r.type || "" } });
      });
      const secMap = { limitUp: "limit_up", limitDown: "limit_down", valueSurge: "value_surge" };
      for (const [sk, kk] of Object.entries(secMap)) {
        if (!okSec(sk)) continue;
        const asOf = isoDay(al.sections[sk].asOf) || base;
        rowsOf(sk).forEach((r) => {
          if (!r.ticker || !asOf) return;
          out.push({ k: kk, t: String(r.ticker), p: num(r.price), bd: asOf, key: `${asOf}|${r.ticker}`, ev: asOf, x: { chg: round(num(r.changePct), 2) } });
        });
      }
    }
    // --- 국내 공시(자사주·공급계약 트래커) ---
    if (kr && inp.krDisclosures && Array.isArray(inp.krDisclosures.disclosures)) {
      inp.krDisclosures.disclosures.forEach((d) => {
        if (!d || !d.ticker || !isBuybackBuyTitle(d.title)) return;
        const key = d.link || `${d.ticker}|${d.fileDate}|${d.title}`;
        add("buyback", d.ticker, { key, ev: isoDay(d.fileDate) });
      });
    }
    if (kr && inp.krContracts && Array.isArray(inp.krContracts.rows)) {
      inp.krContracts.rows.forEach((r) => {
        if (!r || !r.ticker) return;
        const key = r.link || `${r.ticker}|${r.date}|${r.amount}`;
        add("contract", r.ticker, { key, ev: isoDay(r.date), x: { ratio: round(num(r.salesRatio), 1) } });
      });
    }
    return out;
  }

  // 원장에 새로 적을 줄. existing: 이 시장의 기존 원장 줄 전부. ctx: { market, d, at, ea, src }.
  function selectNewRows(cands, existing, ctx) {
    const seenKeys = new Set();
    const lastSeen = new Map();
    for (const r of existing || []) {
      if (!r || r.m !== ctx.market) continue;
      if (r.key) seenKeys.add(`${r.k}|${r.key}`);
      const kt = `${r.k}|${r.t}`;
      if (!lastSeen.has(kt) || r.d > lastSeen.get(kt)) lastSeen.set(kt, r.d);
    }
    const rows = [];
    const skipped = { unknownKind: 0, seen: 0, cooldown: 0, old: 0 };
    for (const c of cands || []) {
      const meta = kindMeta(ctx.market, c.k);
      if (!meta) { skipped.unknownKind++; continue; }
      const kt = `${c.k}|${c.t}`;
      if (meta.keyed) {
        if (!c.key) { skipped.unknownKind++; continue; }
        if (c.ev && daysBetween(c.ev, ctx.d) > EVENT_MAX_AGE_DAYS) { skipped.old++; continue; }
        const kk = `${c.k}|${c.key}`;
        if (seenKeys.has(kk)) { skipped.seen++; continue; }
        seenKeys.add(kk);
      } else {
        const last = lastSeen.get(kt);
        if (last && daysBetween(last, ctx.d) < (meta.cooldownDays || 0)) { skipped.cooldown++; continue; }
      }
      lastSeen.set(kt, ctx.d);
      const row = { d: ctx.d, m: ctx.market, k: c.k, t: c.t, p: c.p == null ? null : c.p, bd: c.bd || null, ea: ctx.ea, at: ctx.at, src: ctx.src };
      if (c.key) row.key = c.key;
      const x = { ...(c.x || {}) };
      if (c.ev && !x.ev) x.ev = c.ev;
      if (Object.keys(x).length) row.x = x;
      rows.push(row);
    }
    return { rows, skipped };
  }

  // ------------------------------------------------------------ 결과 계산
  // 가격 이력: details chartSeries [[o,h,l,c,v,date], ...] → { dates, o, c }.
  function seriesFromChart(rows) {
    const dates = [], o = [], c = [];
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!Array.isArray(r)) continue;
      const close = Number(r[3]);
      const d = isoDay(r[5]);
      if (!d || !Number.isFinite(close) || close <= 0) continue;
      if (dates.length && d <= dates[dates.length - 1]) continue;  // 정렬·중복 방어
      dates.push(d); o.push(Number(r[0])); c.push(close);
    }
    return dates.length ? { dates, o, c } : null;
  }
  function firstIndexAfter(dates, after) {
    let lo = 0, hi = dates.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (dates[mid] <= after) lo = mid + 1; else hi = mid; }
    return lo < dates.length ? lo : -1;
  }
  function lastIndexAtOrBefore(dates, d) {
    let lo = 0, hi = dates.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (dates[mid] <= d) lo = mid + 1; else hi = mid; }
    return lo - 1;
  }
  const entryPx = (s, i) => (Number.isFinite(s.o[i]) && s.o[i] > 0 ? s.o[i] : s.c[i]);

  // 한 원장 줄의 기간별 결과. status: done | pending(아직 기간이 안 참) | stale(가격 끊김) | noprice.
  function outcomeFor(row, series, bench, today, horizons) {
    const hs = horizons || HORIZONS;
    const res = {};
    if (!series) { hs.forEach((h) => { res[h] = { status: "noprice" }; }); return res; }
    const after = [row.bd || "", row.ea || ""].sort().pop();
    const e = firstIndexAfter(series.dates, after);
    const lastDate = series.dates[series.dates.length - 1];
    const alive = daysBetween(lastDate, today) <= STALE_DAYS;
    for (const h of hs) {
      const x = e < 0 ? -1 : e + h - 1;
      if (e < 0 || x >= series.dates.length) { res[h] = { status: alive ? "pending" : "stale" }; continue; }
      const ret = series.c[x] / entryPx(series, e) - 1;
      let bret = null;
      if (bench) {
        const bi = lastIndexAtOrBefore(bench.dates, series.dates[e]);
        const bj = lastIndexAtOrBefore(bench.dates, series.dates[x]);
        if (bi >= 0 && bj >= bi && bench.dates[bi] === series.dates[e]) bret = bench.c[bj] / entryPx(bench, bi) - 1;
        else if (bi >= 0 && bj >= bi) bret = bench.c[bj] / bench.c[bi] - 1;  // 벤치 휴장 불일치: 직전 종가 기준
      }
      res[h] = { status: "done", ret, bret, excess: bret == null ? null : ret - bret, entryDate: series.dates[e], exitDate: series.dates[x] };
    }
    return res;
  }

  // ------------------------------------------------------------ 통계
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function median(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  // 발행일 묶음 부트스트랩: 같은 날 뜬 신호들은 같은 시장 움직임을 공유하므로 날짜 단위로 뽑는다.
  function clusterBootstrapMean(items, { B = 2000, seed = 20260926 } = {}) {
    const byD = new Map();
    for (const it of items) {
      if (!byD.has(it.d)) byD.set(it.d, []);
      byD.get(it.d).push(it.v);
    }
    const clusters = [...byD.keys()].sort().map((d) => byD.get(d));
    if (clusters.length < 2) return { lo: null, hi: null, clusters: clusters.length };
    const rnd = mulberry32(seed);
    const means = [];
    for (let b = 0; b < B; b++) {
      let sum = 0, n = 0;
      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[Math.floor(rnd() * clusters.length)];
        for (const v of c) { sum += v; n++; }
      }
      if (n) means.push(sum / n);
    }
    means.sort((a, b) => a - b);
    return { lo: quantile(means, 0.025), hi: quantile(means, 0.975), clusters: clusters.length };
  }

  // 판정: 표본 부족 → hold, 95% 구간이 0 위 → positive, 0 아래 → negative, 걸치면 unclear.
  function verdictFor(n, lo, hi, minSample) {
    if (n < (minSample || MIN_SAMPLE)) return "hold";
    if (lo == null || hi == null) return "unclear";
    if (lo > 0) return "positive";
    if (hi < 0) return "negative";
    return "unclear";
  }
  const VERDICT_LABEL = { hold: "판단 보류", positive: "벤치마크 상회", negative: "벤치마크 하회", unclear: "차이 불분명" };

  // entries: [{ d, out: outcomeFor 결과 }] → 기간별 요약.
  function summarize(entries, horizons, opts) {
    const hs = horizons || HORIZONS;
    const o = opts || {};
    const res = {};
    for (const h of hs) {
      const done = [], counts = { pending: 0, stale: 0, noprice: 0 };
      for (const e of entries) {
        const r = e.out && e.out[h];
        if (!r) continue;
        if (r.status === "done") done.push({ d: e.d, ret: r.ret, excess: r.excess });
        else if (counts[r.status] != null) counts[r.status]++;
      }
      const rets = done.map((x) => x.ret);
      const exs = done.filter((x) => x.excess != null);
      const exVals = exs.map((x) => x.excess);
      const ci = clusterBootstrapMean(exs.map((x) => ({ d: x.d, v: x.excess })), { B: o.B || 2000, seed: o.seed || 20260926 });
      const n = done.length;
      res[h] = {
        n, pending: counts.pending, stale: counts.stale, noprice: counts.noprice,
        dates: ci.clusters,
        meanRet: n ? round(mean(rets) * 100, 2) : null,
        medianRet: n ? round(median(rets) * 100, 2) : null,
        upRate: n ? round(rets.filter((v) => v > 0).length / n, 3) : null,
        nExcess: exVals.length,
        meanExcess: exVals.length ? round(mean(exVals) * 100, 2) : null,
        medianExcess: exVals.length ? round(median(exVals) * 100, 2) : null,
        winRate: exVals.length ? round(exVals.filter((v) => v > 0).length / exVals.length, 3) : null,
        ciLo: ci.lo == null ? null : round(ci.lo * 100, 2),
        ciHi: ci.hi == null ? null : round(ci.hi * 100, 2),
        verdict: verdictFor(exVals.length, ci.lo, ci.hi, o.minSample),
      };
    }
    return res;
  }

  const api = {
    HORIZONS, MIN_SAMPLE, EVENT_MAX_AGE_DAYS, STALE_DAYS, KINDS, VERDICT_LABEL,
    kindMeta, isoDay, addDays, daysBetween, kstDate, entryAfterFor,
    isKrEtfLike, scanQuickProb, stdev20, isBuybackBuyTitle,
    extractSignals, selectNewRows,
    seriesFromChart, firstIndexAfter, outcomeFor,
    mulberry32, median, clusterBootstrapMean, verdictFor, summarize,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirSignalCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
