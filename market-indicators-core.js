// 시장지표 서브탭 — 순수 표기·계산 모듈(DOM 없음).
// 브라우저에서는 window.MirMarketIndicatorsCore, node 테스트(scripts/tests/test_market_indicators_core.mjs)
// 에서는 module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 숫자 표기 규칙(네이버 시장지표와 같은 관례)
// - 쉼표 항상, 등락은 `▲1.23(+0.45%)` — 절대값에는 부호가 없고 화살표가 방향, %에만 ±.
// - 보합은 `0.00(0.00%)`. 값이 없으면 "—".
(function (root) {
  "use strict";

  const DASH = "—";

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // 항목 종류·크기별 소수 자릿수. 금리는 3자리(일본 3.073), 기준금리는 2~3자리(3.875),
  // 환율·지수·10 이상 가격은 2자리, 10 미만 원자재(천연가스 3.225)는 3자리.
  function decimalsFor(item, value) {
    const kind = item && item.kind;
    const v = Math.abs(num(value !== undefined ? value : item && item.value) || 0);
    if (kind === "bond") return 3;
    if (kind === "rate") return 2;
    if (kind === "fx") return 2;
    if (kind === "index") return 2;
    return v >= 10 ? 2 : 3;
  }

  function fmtNum(v, decimals) {
    const n = num(v);
    if (n === null) return DASH;
    const d = Number.isInteger(decimals) ? decimals : 2;
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  // 기준금리: 3.00 / 3.875 처럼 최소 2자리, 필요하면 3자리까지.
  function fmtRate(v) {
    const n = num(v);
    if (n === null) return DASH;
    const three = Math.round(n * 1000) / 1000;
    const d = Math.abs(three * 100 - Math.round(three * 100)) > 1e-9 ? 3 : 2;
    return fmtNum(three, d);
  }

  function direction(change) {
    const n = num(change);
    if (n === null || n === 0) return "flat";
    return n > 0 ? "up" : "down";
  }

  function arrow(change) {
    const d = direction(change);
    return d === "up" ? "▲" : d === "down" ? "▼" : "";
  }

  // 전일대비 절대값: ▲2.20 / ▼0.145 / 0.00
  function fmtChangeAbs(change, decimals) {
    const n = num(change);
    if (n === null) return DASH;
    return `${arrow(n)}${fmtNum(Math.abs(n), decimals)}`;
  }

  // 등락률: +0.45% / -2.33% / 0.00%
  function fmtPct(pct) {
    const n = num(pct);
    if (n === null) return DASH;
    const r = Math.round(n * 100) / 100;
    const sign = r > 0 ? "+" : r < 0 ? "-" : "";
    return `${sign}${Math.abs(r).toFixed(2)}%`;
  }

  // 카드용 합친 표기: ▲1.23(+0.45%). 등락률이 없으면(금리) 절대값만.
  function fmtChange(change, pct, decimals) {
    if (num(change) === null) return DASH;
    const abs = fmtChangeAbs(change, decimals);
    return num(pct) === null ? abs : `${abs}(${fmtPct(pct)})`;
  }

  // "2026-11" → "2026.11"
  function fmtContract(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
    return m ? `${m[1]}.${m[2]}` : DASH;
  }

  // "2026-09-25" → "09.25" (short) · "2026. 09. 25." (long)
  function fmtDate(iso, long) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return DASH;
    return long ? `${m[1]}. ${m[2]}. ${m[3]}.` : `${m[2]}.${m[3]}`;
  }

  // 스파크라인 SVG path. points = [[date|null, value], ...] 또는 [value, ...]. 2점 미만이면 "".
  function sparkPath(points, w, h, pad) {
    const p = Number.isFinite(pad) ? pad : 2;
    const vals = (points || []).map((x) => num(Array.isArray(x) ? x[1] : x)).filter((v) => v !== null);
    if (vals.length < 2) return "";
    let mn = Infinity, mx = -Infinity;
    for (const v of vals) { if (v < mn) mn = v; if (v > mx) mx = v; }
    const span = mx - mn || 1;
    const step = (w - 2 * p) / (vals.length - 1);
    return vals.map((v, i) => {
      const x = p + step * i;
      const y = p + (h - 2 * p) * (1 - (v - mn) / span);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  // items → { groupId: [item...] } (입력 순서 유지)
  function groupBy(items) {
    const out = {};
    for (const it of items || []) {
      if (!it || !it.group) continue;
      (out[it.group] = out[it.group] || []).push(it);
    }
    return out;
  }

  // 기준일이 오늘(KST)보다 maxDays 넘게 오래됐는지 — 휴장 며칠은 정상이라 넉넉히.
  function isOld(asOf, todayIso, maxDays) {
    const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(asOf || ""));
    const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(todayIso || ""));
    if (!a || !t) return false;
    const ms = Date.UTC(+t[1], +t[2] - 1, +t[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3]);
    return ms / 86400000 > (Number.isFinite(maxDays) ? maxDays : 7);
  }

  // ===== 환율 계산기 =====
  // 시장지표 환율 항목(USDKRW·EURKRW·JPYKRW(100엔)·CNYKRW)을 '1단위당 원화'로 정리한다.
  // 반환: { KRW: { rate: 1 }, USD: { rate, asOf }, ... } — 값이 없거나 0 이하인 통화는 빠진다.
  const FX_CODES = { USDKRW: "USD", EURKRW: "EUR", JPYKRW: "JPY", CNYKRW: "CNY" };
  function fxRates(items) {
    const out = { KRW: { rate: 1, asOf: null } };
    for (const it of items || []) {
      const code = it && FX_CODES[it.id];
      if (!code) continue;
      const v = num(it.value);
      const per = num(it.per) || 1;
      if (v === null || v <= 0) continue;
      out[code] = { rate: v / per, asOf: it.asOf || null, stale: Boolean(it.stale) };
    }
    return out;
  }

  // amount(from 통화) → to 통화. 원화를 거치는 크로스 계산. 계산 불가면 null.
  function fxConvert(amount, from, to, rates) {
    const a = num(amount);
    const f = rates && rates[from];
    const t = rates && rates[to];
    if (a === null || !f || !t || !(f.rate > 0) || !(t.rate > 0)) return null;
    return (a * f.rate) / t.rate;
  }

  // 원·엔은 소수 없이, 나머지는 2자리.
  function fxDecimals(code) {
    return code === "KRW" || code === "JPY" ? 0 : 2;
  }

  // "1,234,567.8" / "1234567" → 1234567.8. 빈 칸·음수·숫자 아님은 null.
  function parseAmount(text) {
    const s = String(text == null ? "" : text).replace(/[,\s]/g, "");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const api = {
    DASH,
    FX_CODES,
    fxRates,
    fxConvert,
    fxDecimals,
    parseAmount,
    decimalsFor,
    fmtNum,
    fmtRate,
    direction,
    arrow,
    fmtChangeAbs,
    fmtPct,
    fmtChange,
    fmtContract,
    fmtDate,
    sparkPath,
    groupBy,
    isOld,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirMarketIndicatorsCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
