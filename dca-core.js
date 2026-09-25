// 적립식(주식 모으기) 시뮬레이터 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirDcaCore, node 테스트(scripts/tests/test_dca_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 용어
// - 거래일 달력(dates): 오름차순 ISO 날짜("YYYY-MM-DD") 배열. 가격이 있는 날만.
// - 일정(schedule): 매수 회차. 예정일(scheduled)이 휴장이면 다음 거래일(date)에 산다.
// - 연환산: 적립식은 돈이 회차마다 들어가므로 CAGR 이 아니라 XIRR(금액가중)이다.
//   한 번에 산 거치식은 유입이 한 번이라 XIRR = CAGR 이다.
(function (root) {
  "use strict";

  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const DAY_MS = 86400000;

  function isIso(s) {
    return typeof s === "string" && ISO_RE.test(s);
  }

  function isoToMs(iso) {
    const m = ISO_RE.exec(iso);
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function msToIso(ms) {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function addDays(iso, n) {
    return msToIso(isoToMs(iso) + n * DAY_MS);
  }

  function addYears(iso, n) {
    const m = ISO_RE.exec(iso);
    if (!m) return iso;
    const y = Number(m[1]) + n;
    const mo = Number(m[2]);
    const d = Math.min(Number(m[3]), daysInMonth(y, mo));
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // 0=일 … 6=토
  function weekdayOf(iso) {
    return new Date(isoToMs(iso)).getUTCDay();
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function daysBetween(a, b) {
    return Math.round((isoToMs(b) - isoToMs(a)) / DAY_MS);
  }

  // 정렬된 dates 에서 iso 이상인 첫 인덱스(없으면 dates.length).
  function lowerBound(dates, iso) {
    let lo = 0;
    let hi = dates.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid] < iso) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // 여러 종목의 거래일 교집합(오름차순). 한 종목이라도 가격이 없는 날은 빠진다.
  function commonDates(dateLists) {
    const lists = (dateLists || []).filter((l) => Array.isArray(l) && l.length);
    if (!lists.length) return [];
    const sets = lists.map((l) => new Set(l));
    const shortest = lists.reduce((a, b) => (a.length <= b.length ? a : b));
    return [...new Set(shortest)].filter((d) => isIso(d) && sets.every((s) => s.has(d))).sort();
  }

  // 날짜→종가 맵을 dates 에 맞춰 배열로. 결측일은 직전 유효가로 채운다(첫 유효가 전은 null).
  function alignCloses(dateMap, dates) {
    let last = null;
    let filled = 0;
    const out = dates.map((d) => {
      const p = dateMap instanceof Map ? dateMap.get(d) : dateMap[d];
      if (Number.isFinite(p) && p > 0) last = p;
      else if (last != null) filled += 1;
      return last;
    });
    out.filledCount = filled;
    return out;
  }

  /**
   * 매수 일정.
   * opts.freq: "daily" | "weekly" | "monthly"
   * opts.weekday: 1(월)~5(금) — weekly
   * opts.monthDay: 1~28 또는 "last"(그 달 마지막 거래일) — monthly
   * opts.start / opts.end: ISO(포함)
   * 반환: [{ date, scheduled, shifted, count }] — date 는 실제 매수 거래일.
   * 휴장이면 다음 거래일로 미룬다. 두 예정일이 같은 거래일로 모이면(긴 휴장) 한 번에
   * count 회분을 산다 — 총 납입액이 일정과 어긋나지 않게.
   */
  function buildSchedule(dates, opts) {
    const o = opts || {};
    const all = Array.isArray(dates) ? dates : [];
    if (!all.length) return [];
    const start = isIso(o.start) ? o.start : all[0];
    const end = isIso(o.end) ? o.end : all[all.length - 1];
    if (start > end) return [];
    const inRange = all.filter((d) => d >= start && d <= end);
    if (!inRange.length) return [];
    const scheduledList = [];
    const freq = o.freq || "monthly";
    if (freq === "daily") {
      inRange.forEach((d) => scheduledList.push({ scheduled: d, exec: d }));
    } else if (freq === "weekly") {
      const wd = Math.min(5, Math.max(1, Number(o.weekday) || 1));
      let d = start;
      const shift = (wd - weekdayOf(d) + 7) % 7;
      d = addDays(d, shift);
      while (d <= end) {
        scheduledList.push({ scheduled: d, exec: null });
        d = addDays(d, 7);
      }
    } else {
      const sm = ISO_RE.exec(start);
      const em = ISO_RE.exec(end);
      let y = Number(sm[1]);
      let m = Number(sm[2]);
      const ey = Number(em[1]);
      const emo = Number(em[2]);
      while (y < ey || (y === ey && m <= emo)) {
        const ym = `${y}-${String(m).padStart(2, "0")}`;
        if (o.monthDay === "last") {
          // 그 달 안의 마지막 거래일(범위 안). 다음 달로 넘기지 않는다.
          const monthDates = inRange.filter((d) => d.slice(0, 7) === ym);
          if (monthDates.length) {
            // '마지막 거래일' 자체가 예정일이라 휴장 이월(shifted)로 세지 않는다.
            const lastTrading = monthDates[monthDates.length - 1];
            scheduledList.push({ scheduled: lastTrading, exec: lastTrading });
          }
        } else {
          const want = Math.min(28, Math.max(1, Number(o.monthDay) || 1));
          const day = Math.min(want, daysInMonth(y, m));
          const iso = `${ym}-${String(day).padStart(2, "0")}`;
          if (iso >= start && iso <= end) scheduledList.push({ scheduled: iso, exec: null });
        }
        m += 1;
        if (m > 12) { m = 1; y += 1; }
      }
    }
    const out = [];
    const byDate = new Map();
    scheduledList.forEach((item) => {
      let exec = item.exec;
      if (!exec) {
        const idx = lowerBound(all, item.scheduled);
        exec = idx < all.length ? all[idx] : null;
      }
      if (!exec || exec > end || exec < start) return;
      const prev = byDate.get(exec);
      if (prev) {
        prev.count += 1;
        return;
      }
      const row = { date: exec, scheduled: item.scheduled, shifted: exec !== item.scheduled, count: 1 };
      byDate.set(exec, row);
      out.push(row);
    });
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // XIRR: flows = [{ date, amount }], 납입은 음수, 최종 평가액은 양수.
  // 연 365일 기준. 해가 없으면(부호가 한쪽뿐) null.
  function xirr(flows) {
    const list = (flows || []).filter((f) => f && isIso(f.date) && Number.isFinite(f.amount) && f.amount !== 0);
    if (list.length < 2) return null;
    if (!list.some((f) => f.amount > 0) || !list.some((f) => f.amount < 0)) return null;
    const t0 = isoToMs(list.reduce((a, f) => (f.date < a ? f.date : a), list[0].date));
    const ts = list.map((f) => (isoToMs(f.date) - t0) / DAY_MS / 365);
    const npv = (r) => list.reduce((s, f, i) => s + f.amount / Math.pow(1 + r, ts[i]), 0);
    const dnpv = (r) => list.reduce((s, f, i) => s - (ts[i] * f.amount) / Math.pow(1 + r, ts[i] + 1), 0);
    // 1) 뉴턴
    let r = 0.1;
    for (let i = 0; i < 100; i += 1) {
      const v = npv(r);
      const dv = dnpv(r);
      if (!Number.isFinite(v) || !Number.isFinite(dv) || dv === 0) break;
      const next = r - v / dv;
      if (!Number.isFinite(next) || next <= -0.999999) break;
      if (Math.abs(next - r) < 1e-10) return next;
      r = next;
    }
    // 2) 이분법 폴백
    let lo = -0.999999;
    let hi = 10;
    let flo = npv(lo);
    let fhi = npv(hi);
    let guard = 0;
    while (Number.isFinite(fhi) && flo * fhi > 0 && hi < 1e6 && guard < 60) {
      hi *= 2;
      fhi = npv(hi);
      guard += 1;
    }
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 300; i += 1) {
      const mid = (lo + hi) / 2;
      const fm = npv(mid);
      if (Math.abs(fm) < 1e-9 || (hi - lo) / 2 < 1e-12) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  function cagr(startValue, endValue, startDate, endDate) {
    const days = daysBetween(startDate, endDate);
    if (!(startValue > 0) || !(endValue >= 0) || days <= 0) return null;
    return Math.pow(endValue / startValue, 365 / days) - 1;
  }

  // 최대 낙폭(%) — series 는 숫자 배열(0 이하 값은 건너뜀). 음수 또는 0.
  function maxDrawdown(values) {
    let peak = null;
    let mdd = 0;
    (values || []).forEach((v) => {
      if (!Number.isFinite(v) || v <= 0) return;
      if (peak == null || v > peak) peak = v;
      mdd = Math.min(mdd, v / peak - 1);
    });
    return mdd * 100;
  }

  // 배당 이벤트를 dates 인덱스별 주당 배당금으로. 배당락일이 휴장이면 다음 거래일에 받는다.
  // 첫 거래일 이전·마지막 거래일 이후 이벤트는 버린다(그때는 보유 주식이 없거나 기간 밖).
  function dividendsByIndex(dates, dividends) {
    const out = new Map();
    if (!Array.isArray(dividends)) return out;
    dividends.forEach((ev) => {
      const d = Array.isArray(ev) ? ev[0] : ev && ev.date;
      const amt = Number(Array.isArray(ev) ? ev[1] : ev && ev.amount);
      if (!isIso(d) || !Number.isFinite(amt) || amt <= 0) return;
      if (d <= dates[0] || d > dates[dates.length - 1]) return;
      const idx = lowerBound(dates, d);
      if (idx >= dates.length) return;
      out.set(idx, (out.get(idx) || 0) + amt);
    });
    return out;
  }

  const SHARE_EPS = 1e-9;

  /**
   * 적립식 시뮬레이션.
   * input.dates: 거래일 달력
   * input.assets: [{ key, prices(dates 와 같은 길이, 유효 양수), dividends([[iso, 주당금액]] | null), weight }]
   * input.schedule: buildSchedule 결과
   * input.amount: 회당 금액(비중대로 나눈다)
   * input.fractional: true 면 소수점 매수, false 면 정수 주만 사고 남는 돈은 다음 회차로 이월
   * input.dividendMode: "reinvest"(받은 날 종가로 재매수) | "cash"(현금 보유, 평가액 포함) | "none"(무시)
   *   종목별 dividends 가 null 이면 그 종목은 배당 데이터가 없는 것 — 가격만 반영된다.
   * 매수가는 매수일 종가. 수수료·세금·환전 비용은 없다.
   */
  function simulateDca(input) {
    const dates = input.dates || [];
    const schedule = input.schedule || [];
    const amount = Number(input.amount);
    const fractional = !!input.fractional;
    const mode = input.dividendMode || "none";
    const assetsIn = input.assets || [];
    const wSum = assetsIn.reduce((s, a) => s + (Number(a.weight) > 0 ? Number(a.weight) : 0), 0);
    if (!dates.length || !schedule.length || !(amount > 0) || !assetsIn.length || !(wSum > 0)) {
      return null;
    }
    const scheduleIdx = new Map();
    schedule.forEach((ev) => {
      const idx = lowerBound(dates, ev.date);
      if (idx < dates.length && dates[idx] === ev.date) scheduleIdx.set(idx, (scheduleIdx.get(idx) || 0) + (ev.count || 1));
    });
    const firstIdx = Math.min(...scheduleIdx.keys());
    const assets = assetsIn.map((a) => ({
      key: a.key,
      prices: a.prices,
      w: (Number(a.weight) > 0 ? Number(a.weight) : 0) / wSum,
      divs: mode === "none" ? new Map() : dividendsByIndex(dates, a.dividends),
      hasDividendData: Array.isArray(a.dividends),
      shares: 0,
      cash: 0, // 아직 주식으로 바꾸지 못한 돈(정수 매수 이월분)
      divCash: 0, // 현금 보유 모드에서 받은 배당
      spent: 0, // 주식 매수에 실제로 쓴 돈(재투자 배당 포함)
      contributed: 0, // 이 종목 몫으로 납입한 돈
      dividendsReceived: 0,
      buys: 0,
    }));
    let invested = 0;
    let prevValue = 0;
    let twr = 1;
    const flows = [];
    const series = [];
    let minReturn = null;
    for (let k = firstIdx; k < dates.length; k += 1) {
      const count = scheduleIdx.get(k) || 0;
      const contrib = count * amount;
      assets.forEach((a) => {
        const p = a.prices[k];
        if (!(p > 0)) return;
        let buyToday = false;
        const dps = a.divs.get(k);
        if (dps && a.shares > SHARE_EPS) {
          const div = a.shares * dps;
          a.dividendsReceived += div;
          if (mode === "reinvest") { a.cash += div; buyToday = true; }
          else if (mode === "cash") a.divCash += div;
        }
        if (contrib > 0 && a.w > 0) {
          const part = contrib * a.w;
          a.cash += part;
          a.contributed += part;
          buyToday = true;
        }
        if (buyToday && a.cash > 0) {
          let qty = fractional ? a.cash / p : Math.floor(a.cash / p + SHARE_EPS);
          if (qty > 0) {
            const cost = fractional ? a.cash : qty * p;
            a.shares += qty;
            a.spent += cost;
            a.cash = Math.max(0, a.cash - cost);
            if (a.cash < 1e-7) a.cash = 0;
            a.buys += 1;
          }
        }
      });
      if (contrib > 0) {
        invested += contrib;
        flows.push({ date: dates[k], amount: -contrib });
      }
      let value = 0;
      assets.forEach((a) => {
        const p = a.prices[k];
        value += (p > 0 ? a.shares * p : 0) + a.cash + a.divCash;
      });
      if (prevValue > 0) {
        const r = (value - contrib) / prevValue;
        if (Number.isFinite(r) && r > 0) twr *= r;
      }
      prevValue = value;
      if (invested > 0) {
        const ret = value / invested - 1;
        if (minReturn == null || ret < minReturn) minReturn = ret;
      }
      series.push({ d: dates[k], invested, value, twr: twr * 100 });
    }
    const last = series[series.length - 1];
    const endDate = last.d;
    const finalValue = last.value;
    const irr = xirr([...flows, { date: endDate, amount: finalValue }]);
    const leftoverCash = assets.reduce((s, a) => s + a.cash, 0);
    const dividendCash = assets.reduce((s, a) => s + a.divCash, 0);
    const dividendsReceived = assets.reduce((s, a) => s + a.dividendsReceived, 0);
    return {
      startDate: series[0].d,
      endDate,
      invested,
      finalValue,
      profit: finalValue - invested,
      totalReturnPct: invested > 0 ? (finalValue / invested - 1) * 100 : null,
      xirrPct: irr == null ? null : irr * 100,
      mddPct: maxDrawdown(series.map((p) => p.twr)),
      minReturnPct: minReturn == null ? null : minReturn * 100,
      contributions: flows.length,
      leftoverCash,
      dividendCash,
      dividendsReceived,
      series,
      assets: assets.map((a) => {
        const lastPrice = a.prices[dates.length - 1];
        return {
          key: a.key,
          weight: a.w,
          shares: a.shares,
          spent: a.spent,
          contributed: a.contributed,
          avgCost: a.shares > SHARE_EPS ? a.spent / a.shares : null,
          lastPrice,
          marketValue: a.shares * (lastPrice > 0 ? lastPrice : 0),
          cash: a.cash,
          dividendCash: a.divCash,
          dividendsReceived: a.dividendsReceived,
          hasDividendData: a.hasDividendData,
          buys: a.buys,
        };
      }),
    };
  }

  // 같은 총액을 첫 매수일에 한 번에 샀을 때(거치식). 규칙(소수점·배당)은 적립식과 같다.
  function simulateLumpSum(input, totalAmount, firstDate) {
    const res = simulateDca({ ...input, amount: totalAmount, schedule: [{ date: firstDate, scheduled: firstDate, shifted: false, count: 1 }] });
    if (!res) return null;
    const c = cagr(res.invested, res.finalValue, res.startDate, res.endDate);
    res.cagrPct = c == null ? null : c * 100;
    return res;
  }

  const api = {
    isIso,
    addDays,
    addYears,
    weekdayOf,
    daysInMonth,
    daysBetween,
    lowerBound,
    commonDates,
    alignCloses,
    buildSchedule,
    xirr,
    cagr,
    maxDrawdown,
    dividendsByIndex,
    simulateDca,
    simulateLumpSum,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirDcaCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
