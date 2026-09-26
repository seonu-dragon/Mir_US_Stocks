// 오늘 탭 큰 지수 차트(home-dash.js)의 하루(장중) 시간축 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirHomeChartCore, node 테스트(scripts/tests/test_home_chart_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 워커 ?indices=1 의 series 는 야후 1d/5m 종가 배열이라 시각이 붙어 있지 않다. 실측(2026-09-26):
// - 봉은 정규장 시작부터 5분 간격으로 빈틈없이 이어진다(^GSPC 09:30~15:55, ^KS11 09:00~14:55).
// - 장이 끝난 뒤에는 마지막에 공식 종가 한 점이 더 붙는다(^GSPC 79개, ^KS11 73개).
//   ^KS11 은 14:55 봉 다음이 곧바로 15:30 종가라 15:00~15:30 구간이 비어 있다.
// 그래서 i 번째 값 = 개장 + 5i 분, 끝난 세션의 마지막 값 = 마감 시각으로 놓는다.
// 비어 있는 구간(마지막 봉 → 종가)은 bridged 로 표시해 화면에서 점선으로 잇는다.
(function (root) {
  "use strict";

  const BAR_MIN = 5;
  const MARKETS = {
    kr: { id: "kr", tz: "Asia/Seoul", open: 9 * 60, close: 15 * 60 + 30, label: "KST" },
    us: { id: "us", tz: "America/New_York", open: 9 * 60 + 30, close: 16 * 60, label: "ET" },
    // 코인은 야후 range=1d 가 UTC 자정부터라 00:00 UTC(= 09:00 KST) 시작 24시간.
    crypto: { id: "crypto", tz: "UTC", open: 0, close: 24 * 60, label: "UTC", h24: true },
  };

  function symbolMarket(symbol) {
    const s = String(symbol || "").toUpperCase();
    if (s === "^KS11" || s === "^KQ11" || s === "^KS200") return "kr";
    if (/-USD$/.test(s)) return "crypto";
    if (/^\^(GSPC|IXIC|DJI|RUT|NDX|VIX|SOX)$/.test(s)) return "us";
    return null;
  }

  const _fmtCache = {};
  function zoneFormatter(tz) {
    if (!_fmtCache[tz]) {
      _fmtCache[tz] = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
      });
    }
    return _fmtCache[tz];
  }

  // 그 시간대의 벽시계: { date:"YYYY-MM-DD", min(자정부터 분), weekday(0=일), offsetMin(UTC 대비) }
  function zoneParts(ms, tz) {
    const parts = {};
    zoneFormatter(tz).formatToParts(new Date(ms)).forEach((p) => { parts[p.type] = p.value; });
    const hour = Number(parts.hour) % 24;
    const minute = Number(parts.minute);
    const second = Number(parts.second);
    const y = Number(parts.year), mo = Number(parts.month), d = Number(parts.day);
    const wallUtc = Date.UTC(y, mo - 1, d, hour, minute, second);
    const offsetMin = Math.round((wallUtc - Math.floor(ms / 1000) * 1000) / 60000);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    return { date: `${parts.year}-${parts.month}-${parts.day}`, min: hour * 60 + minute, weekday, offsetMin };
  }

  // "13:00 ET 폐장" 같은 detail 에서 분 단위 시각.
  function parseHm(text) {
    const m = String(text || "").match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  // 지금 그 시장이 어떤 상태인지. events 는 MARKET_CALENDAR.events(휴장·단축 거래).
  // state: open(정규장) · pre(개장 전) · post(장 마감) · weekend · holiday
  function sessionState(marketId, nowMs, events) {
    const mk = MARKETS[marketId];
    if (!mk) return null;
    const z = zoneParts(nowMs, mk.tz);
    const base = { market: marketId, date: z.date, nowMin: z.min, open: mk.open, close: mk.close, holidayName: "" };
    if (mk.h24) return { ...base, state: "open" };
    const todays = (Array.isArray(events) ? events : []).filter((e) => e && e.market === marketId && e.date === z.date);
    if (z.weekday === 0 || z.weekday === 6) return { ...base, state: "weekend" };
    const hol = todays.find((e) => e.kind === "holiday");
    if (hol) return { ...base, state: "holiday", holidayName: String(hol.name || "") };
    const early = todays.find((e) => e.kind === "early_close");
    const close = early && parseHm(early.detail) != null ? parseHm(early.detail) : mk.close;
    const state = z.min < mk.open ? "pre" : z.min >= close ? "post" : "open";
    return { ...base, close, state };
  }

  // 값 배열 → [{t(분), v, bridged}] 와 판정.
  // kind: live(오늘 장중) · post(오늘 장 마감) · pre/weekend/holiday/prev(직전 거래일 세션)
  function placeSeries(values, session) {
    const vals = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
    const n = vals.length;
    if (!session || n < 2) return { kind: session ? session.state : "none", points: [], lastMin: null };
    const mk = MARKETS[session.market];
    const open = mk.open;
    if (mk.h24) {
      const points = vals.map((v, i) => ({ t: open + i * BAR_MIN, v, bridged: false }));
      return { kind: "live", points, lastMin: points[n - 1].t };
    }
    if (session.state === "open") {
      const expected = Math.floor((session.nowMin - open) / BAR_MIN) + 1;
      // 지금까지 나올 수 있는 봉 수보다 많으면 오늘 것이 아니다(야후가 아직 전날 세션을 주는 경우,
      // 달력에 없는 휴장일 등) — 직전 거래일로 취급한다.
      if (n <= expected + 2) {
        const points = vals.map((v, i) => ({ t: Math.min(open + i * BAR_MIN, session.close), v, bridged: false }));
        return { kind: "live", points, lastMin: points[n - 1].t };
      }
    }
    // 끝난 세션: 마지막 값은 종가(마감 시각), 그 앞은 5분 봉.
    const close = session.state === "post" ? session.close : mk.close;
    const points = vals.slice(0, n - 1).map((v, i) => ({ t: Math.min(open + i * BAR_MIN, close), v, bridged: false }));
    const prevT = points[points.length - 1].t;
    points.push({ t: close, v: vals[n - 1], bridged: close - prevT > BAR_MIN * 2 });
    const kind = session.state === "open" ? "prev" : session.state;
    return { kind, points, lastMin: close };
  }

  // 시간 눈금(분). step 분 간격의 정시, 개장·마감 사이.
  function timeTicks(open, close, step) {
    const out = [];
    const first = Math.ceil(open / step) * step;
    for (let t = first; t <= close; t += step) out.push(t);
    return out;
  }

  function fmtMin(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }

  // 가격 눈금: 1·2·2.5·5 × 10^k 간격으로 count 개 안팎.
  function niceStep(range, count) {
    const raw = range / Math.max(1, count);
    if (!(raw > 0)) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * pow;
  }

  function valueTicks(lo, hi, count) {
    const step = niceStep(hi - lo, count || 4);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
    return { step, ticks: out };
  }

  const api = { BAR_MIN, MARKETS, symbolMarket, zoneParts, parseHm, sessionState, placeSeries, timeTicks, fmtMin, niceStep, valueTicks };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirHomeChartCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
