// company-info-core.js — 기업개요 · 목표주가 범위의 순수 계산(DOM 없음). 화면은 company-info.js.
// node 테스트: scripts/tests/test_company_info_core.mjs
(function (root) {
  "use strict";

  // 빌더(scripts/shard_store.py)의 zlib.crc32(ticker) % n 과 같은 값.
  function shardOf(ticker, n) {
    let c = ~0 >>> 0;
    const s = unescape(encodeURIComponent(String(ticker)));
    for (let i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i);
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return ((c ^ ~0) >>> 0) % (n || 16);
  }

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // 결산월: KR "12" · US fiscalYearEnd "0926"(월일) → "12월" · "9월".
  function fiscalMonthLabel(fye) {
    const s = String(fye || "").trim();
    if (!/^\d{1,4}$/.test(s)) return "";
    const m = s.length >= 3 ? Number(s.slice(0, 2)) : Number(s);
    return m >= 1 && m <= 12 ? `${m}월` : "";
  }

  function fmtCount(n) {
    const v = num(n);
    return v === null ? "" : Math.round(v).toLocaleString("en-US");
  }

  // 링크용 URL. 빌더가 스킴을 떼서 저장한다(DART hm_url 은 원래 스킴이 없다).
  function webHref(u) {
    const s = String(u || "").trim().replace(/^https?:\/\//i, "");
    if (!s || !/^[A-Za-z0-9가-힣][A-Za-z0-9가-힣.\-]*\.[A-Za-z가-힣]{2,}(\/\S*)?$/.test(s)) return "";
    return `http://${s}`;
  }

  function formerNamesLabel(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((x) => Array.isArray(x) && x[0]).map((x) => {
      const span = x[1] && x[2] ? (x[1] === x[2] ? x[1] : `${x[1]}–${x[2]}`) : (x[2] || x[1] || "");
      return span ? `${x[0]} (${span})` : String(x[0]);
    });
  }

  // 목표주가 범위 바의 위치(0~100%). 축 = [min(최저, 현재가), max(최고, 현재가)] 에 양쪽 4% 여백.
  function rangeGeometry(t, price) {
    const lo = num(t && t.lo), avg = num(t && t.avg), hi = num(t && t.hi);
    if (lo === null || avg === null || hi === null || !(lo > 0 && lo <= avg && avg <= hi)) return null;
    const p = num(price);
    const havePrice = p !== null && p > 0;
    let min = havePrice ? Math.min(lo, p) : lo;
    let max = havePrice ? Math.max(hi, p) : hi;
    if (max === min) { min *= 0.95; max *= 1.05; }
    const pad = (max - min) * 0.04;
    min -= pad; max += pad;
    const pos = (v) => Math.round(((v - min) / (max - min)) * 1000) / 10;
    return {
      lo: pos(lo), avg: pos(avg), hi: pos(hi),
      price: havePrice ? pos(p) : null,
      priceSide: !havePrice ? null : p < lo ? "below" : p > hi ? "above" : "inside",
    };
  }

  // 평균 목표가와 현재가의 차이 — 서술만(권유 문구 없음).
  function gapPct(avg, price) {
    const a = num(avg), p = num(price);
    if (a === null || p === null || p <= 0) return null;
    return (a / p - 1) * 100;
  }

  function gapSentence(avg, price) {
    const g = gapPct(avg, price);
    if (g === null) return "";
    if (Math.abs(g) < 0.5) return "평균 목표가는 현재가와 거의 같습니다.";
    return `평균 목표가는 현재가보다 ${Math.abs(g).toFixed(1)}% ${g > 0 ? "높습니다" : "낮습니다"}.`;
  }

  // 의견 분포 비율(합 100, 반올림 오차는 가장 큰 칸에서 흡수).
  function opinionShares(t) {
    const b = num(t && t.buy), h = num(t && t.hold), s = num(t && t.sell);
    if (b === null || h === null || s === null) return null;
    const n = b + h + s;
    if (!(n > 0)) return null;
    const raw = [b, h, s].map((v) => (v / n) * 100);
    const r = raw.map((v) => Math.round(v * 10) / 10);
    const diff = Math.round((100 - r.reduce((a, c) => a + c, 0)) * 10) / 10;
    if (diff) { const i = r.indexOf(Math.max(...r)); r[i] = Math.round((r[i] + diff) * 10) / 10; }
    return { buy: r[0], hold: r[1], sell: r[2], n };
  }

  // 원 → "1.57억" · "134억" · "1.2조" · "6,100만". 0·음수·없음 → "".
  function fmtKrw(won) {
    const v = num(won);
    if (v === null || v <= 0) return "";
    if (v >= 1e12) return `${(v / 1e12).toFixed(v >= 1e14 ? 0 : 1).replace(/\.0$/, "")}조`;
    if (v >= 1e8) {
      const e = v / 1e8;
      return `${e >= 100 ? Math.round(e).toLocaleString("en-US") : e.toFixed(e >= 10 ? 1 : 2).replace(/\.?0+$/, "")}억`;
    }
    if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString("en-US")}만`;
    return `${Math.round(v).toLocaleString("en-US")}`;
  }

  // 직원 수 추이 [[연도, 인원, 평균급여]] → [{ y, emp, sal, chg }] (chg = 전년 대비 %, 첫 해 null). 2개 미만이면 [].
  function empTrend(hist) {
    if (!Array.isArray(hist)) return [];
    const rows = hist.filter((h) => Array.isArray(h) && num(h[0]) !== null && num(h[1]) > 0)
      .map((h) => ({ y: num(h[0]), emp: num(h[1]), sal: num(h[2]) }))
      .sort((a, b) => a.y - b.y);
    if (rows.length < 2) return [];
    return rows.map((r, i) => ({ ...r, chg: i ? ((r.emp / rows[i - 1].emp) - 1) * 100 : null }));
  }

  const api = { shardOf, fmtKrw, empTrend, fiscalMonthLabel, fmtCount, webHref, formerNamesLabel, rangeGeometry, gapPct, gapSentence, opinionShares };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirCompanyInfoCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
