// 종목 상세 '일별 시세' 표 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirDailyTable, node 테스트(scripts/tests/test_daily_table_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
// 입력은 차트와 같은 일봉 행 [{o,h,l,c,v,d}] (오름차순). 전일대비는 바로 앞 봉 종가 기준.
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // 최근 거래일부터 limit 개. change/pct 는 앞 봉이 없으면(가장 오래된 행) null.
  // opts.priceDate: 스냅샷 가격 기준일. 그 행은 official=true, opts.prevClose 가 있으면 전일대비를
  //   그 값 기준으로 낸다(머리글 등락과 같은 기준 — 야후 전일 봉 종가가 KRX 와 다를 수 있다).
  // opts.provisional(d) → "장중" | "잠정" | "" : 확정 종가가 아닌 봉의 표식.
  function buildDailyRows(rows, limit, opts) {
    const o = opts || {};
    const pd = /^\d{4}-\d{2}-\d{2}$/.test(String(o.priceDate || "")) ? String(o.priceDate) : "";
    const pdPrev = num(o.prevClose);
    const src = (Array.isArray(rows) ? rows : []).filter((r) => r && num(r.c) !== null && num(r.c) > 0);
    const n = src.length;
    const want = Math.max(0, Math.min(n, Number.isFinite(limit) ? Math.floor(limit) : n));
    const out = [];
    for (let i = n - 1; i >= n - want; i -= 1) {
      const r = src[i];
      const c = num(r.c);
      const d = r.d ? String(r.d).slice(0, 10) : "";
      const official = !!pd && d === pd;
      const prev = official && pdPrev !== null && pdPrev > 0 ? pdPrev : (i > 0 ? num(src[i - 1].c) : null);
      const change = prev !== null && prev > 0 ? c - prev : null;
      const pct = change !== null ? (change / prev) * 100 : null;
      const v = num(r.v);
      const provisional = typeof o.provisional === "function" && d ? (o.provisional(d) || "") : "";
      out.push({
        d,
        c,
        o: num(r.o),
        h: num(r.h),
        l: num(r.l),
        v: v !== null && v > 0 ? v : null,
        change,
        pct,
        official,
        provisional,
      });
    }
    return out;
  }

  // ── 가격 기준일 맞추기 ─────────────────────────────────────────────────────
  // 2026-10-01 실측(005930): 머리글은 스냅샷(네이버, KRX 정규장) 09-30 종가 269,500 인데, 같은 화면의
  // 일별 시세 표는 야후 일봉이라 09-30 종가가 268,500 이었고, 맨 위 10-01 장중 봉이 확정 종가처럼
  // 보였으며, '09.30 기준' 시세정보 카드는 10-01 장중 봉의 시가·고가·저가를 보여 줬다.
  // 아래 함수들은 '같은 날짜엔 같은 값, 확정 전 봉엔 표식' 을 만든다.

  function rowDate(r) {
    if (Array.isArray(r)) return r[5] ? String(r[5]).slice(0, 10) : "";
    if (r && typeof r === "object") return String(r.d ?? r.date ?? "").slice(0, 10);
    return "";
  }

  // 시장 현지 시각 { date: "YYYY-MM-DD", minutes: 0~1439 }. KR = KST(UTC+9, 서머타임 없음),
  // US = 뉴욕(Intl 로 서머타임 반영).
  function marketClock(market, nowMs) {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    if (market === "us") {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(new Date(now));
        const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
        return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
      } catch (_) { /* Intl 시간대 미지원 → 아래 UTC-4 근사 */ }
      const et = new Date(now - 4 * 3600 * 1000);
      return { date: et.toISOString().slice(0, 10), minutes: et.getUTCHours() * 60 + et.getUTCMinutes() };
    }
    const kst = new Date(now + 9 * 3600 * 1000);
    return { date: kst.toISOString().slice(0, 10), minutes: kst.getUTCHours() * 60 + kst.getUTCMinutes() };
  }

  // 정규장(분). KR 09:00~15:30, US 09:30~16:00.
  const SESSION = { kr: { open: 540, close: 930 }, us: { open: 570, close: 960 } };
  // KR 확정 종가로 볼 시각: 15:30 종가 단일가 + 여유 10분(예전 app.js alignKrLiveLastBar 와 같은 15:40).
  const KR_CLOSE_CONFIRMED = 940;

  // 일봉 한 행이 확정 종가가 아니면 표식. opts = { market: "kr"|"us", priceDate, nowMs }.
  //  - 오늘(현지) 봉이고 정규장 중 → "장중"
  //  - 스냅샷 기준일보다 새 봉(장 끝났어도 아직 확정 종가가 반영 전) → "잠정"
  function provisionalLabel(d, opts) {
    const o = opts || {};
    const day = String(d || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
    const market = o.market === "us" ? "us" : "kr";
    const clk = marketClock(market, o.nowMs);
    const s = SESSION[market];
    if (day === clk.date && clk.minutes >= s.open && clk.minutes < s.close) return "장중";
    const pd = String(o.priceDate || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(pd) && day > pd) return "잠정";
    return "";
  }

  // KR: 스냅샷 기준일 장이 확정(15:40 이후)됐는지.
  function krSessionClosed(day, nowMs) {
    const clk = marketClock("kr", nowMs);
    return clk.date > day || (clk.date === day && clk.minutes >= KR_CLOSE_CONFIRMED);
  }

  // 일봉 시리즈([시,고,저,종,거래량,날짜] 또는 {o,h,l,c,v,d}) 에서 snap.date 봉의 종가를 스냅샷(네이버, KRX)
  // 값으로 바꾼다. 고가·저가는 그 종가를 포함하도록 넓힌다. 그 날짜 봉이 없으면 만들지 않는다(시가를 모른다).
  // 마지막 봉만 보던 예전 방식은 기준일 뒤에 장중 봉이 붙으면 놓쳤다.
  // 거래량은 바꾸지 않는다(2026-10-01): 일봉 거래량은 전 구간 '네이버 일별 시세 = KRX+NXT 합산' 으로 통일했다.
  // 스냅샷 목록 거래량(KRX)으로 기준일 한 봉만 덮으면 같은 표 안에서 정의가 섞인다(005930 09-30 일봉
  // 16,477,580 vs 스냅샷 15,700,594). 일봉이 네이버면 종가도 이미 같아 보통 아무것도 바꾸지 않는다.
  // 바뀐 게 없으면 같은 배열을 돌려준다(호출부 메모·표 키가 흔들리지 않게).
  function alignSessionBar(series, snap, nowMs) {
    if (!Array.isArray(series) || !series.length || !snap) return series;
    const close = num(snap.close);
    const day = String(snap.date || "").slice(0, 10);
    if (close === null || close <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return series;
    if (!krSessionClosed(day, nowMs)) return series;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      const r = series[i];
      const d = rowDate(r);
      if (!d || d < day) return series;
      if (d !== day) continue;
      let bar;
      if (Array.isArray(r)) {
        if (num(r[3]) === close) return series;
        bar = r.slice();
        bar[3] = close;
        if (num(bar[1]) !== null) bar[1] = Math.max(num(bar[1]), close);
        if (num(bar[2]) !== null && num(bar[2]) > 0) bar[2] = Math.min(num(bar[2]), close);
      } else if (r && typeof r === "object") {
        if (num(r.c) === close) return series;
        bar = { ...r, c: close };
        if (num(r.h) !== null) bar.h = Math.max(num(r.h), close);
        if (num(r.l) !== null && num(r.l) > 0) bar.l = Math.min(num(r.l), close);
      } else {
        return series;
      }
      const out = series.slice();
      out[i] = bar;
      return out;
    }
    return series;
  }

  // 국내: 상세 파일 일봉(네이버, 수정주가)과 실시간 프록시 일봉(워커 = 야후 .KS/.KQ)을 합친다.
  // 상세 파일이 덮는 날짜는 전부 상세 파일 값이고, 실시간 봉은 상세 파일 마지막 날짜보다 **새 날짜만** 잇는다
  // (오늘 장중 봉 등). 예전엔 실시간 일봉이 오면 시계열을 통째로 바꿔 과거 종가가 다시 야후 값이 됐다
  // (005930 09-29 야후 272,500 vs 네이버 275,000). 상세 파일이 없거나 날짜가 없으면 실시간을 그대로 쓴다.
  // 덧붙일 게 없으면 base 를 그대로 돌려준다(메모·표 키 안정). 원본 배열은 바꾸지 않는다.
  function mergeLiveBars(base, live) {
    const b = Array.isArray(base) ? base : [];
    const l = Array.isArray(live) ? live : [];
    if (!b.length) return l;
    if (!l.length) return b;
    let last = "";
    for (let i = b.length - 1; i >= 0 && !last; i -= 1) last = rowDate(b[i]);
    if (!last) return l;
    const tail = l.filter((r) => {
      const d = rowDate(r);
      return !!d && d > last;
    });
    return tail.length ? b.concat(tail) : b;
  }

  // 국내 호가 단위(전일가 구간). ETF·ETN 은 2,000원 미만 1원, 그 외 5원.
  function krTick(price, etf) {
    const p = num(price);
    if (p === null) return 1;
    if (p < 2000) return 1;
    if (etf) return 5;
    return p < 5000 ? 5 : p < 20000 ? 10 : p < 50000 ? 50 : p < 200000 ? 100 : p < 500000 ? 500 : 1000;
  }

  // 기준일 행의 전일 종가 — 머리글(stockChangeHtml)과 같은 규칙. 앞 봉 종가로 낸 등락률이 스냅샷
  // 등락률(소수 1자리)과 반올림 오차(0.051%p) 안이면 앞 봉 종가, 아니면 가격 / (1 + 등락률) 을 거꾸로
  // 풀고 KR 은 호가 단위로 맞춘다. 등락률을 모르면 null(표는 앞 봉 기준 그대로).
  function snapshotPrevClose(price, changePct, prevBarClose, opts) {
    const o = opts || {};
    const p = num(price);
    const pct = num(changePct);
    if (p === null || p <= 0 || pct === null || pct <= -100) return null;
    const prev = num(prevBarClose);
    if (prev !== null && prev > 0 && Math.abs((p / prev - 1) * 100 - pct) <= 0.051) return prev;
    const raw = p / (1 + pct / 100);
    if (!o.kr) return raw;
    const tick = krTick(raw, o.etf);
    return Math.round(raw / tick) * tick;
  }

  // 가격 표기. KR = 원 단위 정수(콤마), US = $ 소수 2자리($1 미만은 4자리).
  function fmtPrice(v, kr) {
    const n = num(v);
    if (n === null) return "—";
    if (kr) return Math.round(n).toLocaleString("ko-KR");
    const a = Math.abs(n);
    const dec = a > 0 && a < 1 ? 4 : 2;
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }

  // 전일대비 → { text: "▲1,000(+3.62%)", dir: "up"|"down"|"flat"|"" }.
  // 부호는 화살표로만 표시하고 금액에는 붙이지 않는다(네이버 일별 시세 표기와 같다).
  function fmtChange(change, pct, kr) {
    const c = num(change);
    const p = num(pct);
    if (c === null || p === null) return { text: "—", dir: "" };
    const eps = kr ? 0.5 : 0.00005;
    if (Math.abs(c) < eps) return { text: `0(0.00%)`, dir: "flat" };
    const up = c > 0;
    const a = Math.abs(c);
    const amt = kr
      ? Math.round(a).toLocaleString("ko-KR")
      : a.toLocaleString("en-US", { minimumFractionDigits: a < 0.01 ? 4 : 2, maximumFractionDigits: a < 0.01 ? 4 : 2 });
    return { text: `${up ? "▲" : "▼"}${amt}(${up ? "+" : "−"}${Math.abs(p).toFixed(2)}%)`, dir: up ? "up" : "down" };
  }

  function fmtVolume(v) {
    const n = num(v);
    if (n === null || n <= 0) return "—";
    return Math.round(n).toLocaleString("ko-KR");
  }

  // "2026-09-25" → "2026.09.25"
  function fmtDate(d) {
    const s = String(d || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replace(/-/g, ".") : (s || "—");
  }

  // 좁은 화면용 "26.09.25"
  function fmtDateShort(d) {
    const s = String(d || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(2).replace(/-/g, ".") : (s || "—");
  }

  const api = { buildDailyRows, marketClock, provisionalLabel, krSessionClosed, alignSessionBar, mergeLiveBars, krTick, snapshotPrevClose, fmtPrice, fmtChange, fmtVolume, fmtDate, fmtDateShort };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirDailyTable = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
