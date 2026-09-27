// 국내 의무보유(보호예수) 해제 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirLockupCore, node 테스트(scripts/tests/test_lockup_core.mjs)에서는 module.exports.
// 데이터: window.KR_LOCKUPS(scripts/build_kr_lockups.py) — releases[{code, company, date, listingDate, shares,
// pct, periods, types, totalShares, link}] + ipos[{code, listingDate, offerPrice, instCompetition, commitPct,
// subscriptionCompetition, verified, noTable, lockedPct, …}]. 해제일은 상장일 + 기간으로 계산한 추정일이다.
(function (root) {
  "use strict";

  function pad(n) { return String(n).padStart(2, "0"); }

  function isoAddDays(iso, n) {
    const [y, m, d] = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }

  function dayDiff(a, b) {
    const ms = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((ms(b) - ms(a)) / 86400000);
  }

  function fmtNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("en-US") : "";
  }

  /** 주식수 → '1,234만 주' · '2.5억 주' · '8,500주'. */
  function fmtShares(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억 주`;
    if (v >= 1e4) return `${fmtNum(Math.round(v / 1e4))}만 주`;
    return `${fmtNum(v)}주`;
  }

  /** 원 → '1,234억 원' · '56억 원' · '3,400만 원'. */
  function fmtWon(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n >= 1e8) return `${fmtNum(Math.round(n / 1e8))}억 원`;
    return `${fmtNum(Math.round(n / 1e4))}만 원`;
  }

  /** 유형별 주식수 → '벤처금융 100만 주 · 최대주주 등 50만 주'(많은 순). */
  function typeLine(types) {
    return Object.entries(types || {})
      .filter(([, v]) => Number(v) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([k, v]) => `${k} ${fmtShares(v)}`)
      .join(" · ");
  }

  function releases(payload) {
    return ((payload && payload.releases) || []).filter((r) => r && r.date);
  }

  /** 한 종목의 해제 일정 + IPO 요약. code 가 없으면 null. */
  function forTicker(payload, code, today) {
    const c = String(code || "");
    if (!c) return null;
    const ipo = ((payload && payload.ipos) || []).find((r) => r && String(r.code || "") === c) || null;
    const rows = releases(payload).filter((r) => String(r.code || "") === c)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!ipo && !rows.length) return null;
    const upcoming = rows.filter((r) => r.date >= today);
    const recent = rows.filter((r) => r.date < today);
    return { ipo, upcoming, recent, next: upcoming[0] || null };
  }

  /** 오늘부터 days 일 안의 해제(비율 큰 순 → 날짜 순). minPct 미만은 뺀다. */
  function upcomingWithin(payload, today, days, minPct) {
    const end = isoAddDays(today, days);
    const floor = Number(minPct) || 0;
    return releases(payload)
      .filter((r) => r.date >= today && r.date <= end && (Number(r.pct) || 0) >= floor)
      .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0) || (a.date < b.date ? -1 : 1));
  }

  /** 현재가 환산 금액(원). 가격이 없으면 null — 매도 예정 금액이 아니라 규모 감을 주는 숫자. */
  function valueAtPrice(shares, price) {
    const s = Number(shares);
    const p = Number(price);
    return Number.isFinite(s) && Number.isFinite(p) && s > 0 && p > 0 ? s * p : null;
  }

  /** 'D-3' · '오늘' · '3일 전'. */
  function relLabel(today, iso) {
    const d = dayDiff(today, iso);
    if (d === 0) return "오늘";
    if (d > 0) return `D-${d}`;
    return `${-d}일 전`;
  }

  /** IPO 수요예측·청약 결과 항목 배열(없는 값은 뺀다). */
  function ipoStats(ipo) {
    if (!ipo) return [];
    const out = [];
    const num = (v) => Number(v);
    if (num(ipo.offerPrice) > 0) out.push({ k: "공모가", v: `${fmtNum(ipo.offerPrice)}원` });
    if (num(ipo.instCompetition) > 0) out.push({ k: "기관 경쟁률", v: `${fmtNum(Math.round(ipo.instCompetition))}:1` });
    if (num(ipo.commitPct) > 0) out.push({ k: "의무보유 확약", v: `${num(ipo.commitPct).toFixed(1)}%`, note: "수요예측 신청 수량 기준" });
    if (num(ipo.subscriptionCompetition) > 0) out.push({ k: "청약 경쟁률", v: `${fmtNum(Math.round(ipo.subscriptionCompetition))}:1` });
    if (num(ipo.lockedPct) > 0) out.push({ k: "상장일 매각제한", v: `${num(ipo.lockedPct).toFixed(1)}%`, note: "상장일 기준 주식수 대비" });
    return out;
  }

  const api = { isoAddDays, dayDiff, fmtShares, fmtWon, typeLine, forTicker, upcomingWithin, valueAtPrice, relLabel, ipoStats };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirLockupCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
