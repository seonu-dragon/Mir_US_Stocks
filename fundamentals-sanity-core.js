// 펀더멘털 이상치 규칙 — 순수 계산 모듈(DOM·네트워크 없음). 근거·사례는 scripts/fundamentals_sanity.py 문서 참고.
// 브라우저에서는 window.MirFundSanity, node 테스트(scripts/tests/test_fundamentals_sanity_core.mjs)에서는
// module.exports. 빌더(build_map_fundamentals.py)가 같은 규칙을 이미 적용하지만, 배포된 옛 data/
// 파일에도 곧바로 효과가 나도록 map_fundamentals 를 불러온 직후(app.js loadMapFundamentalsScript) 한 번 더 적용한다.
//
// 1) 정의상 의미 없는 값 → 결측: 무한대·NaN, 배수 ≤ 0(적자 PER 등), 부채비율·배당성향 등 음수,
//    자본잠식(PBR < 0 또는 부채비율 < 0) 종목의 ROE, |ROA| > 1000%(소스·단위 불일치), 나스닥 EPS 표식 -999.
// 2) 극단값이지만 실제일 수 있는 값 → 남긴다. PLAUSIBLE 경계 밖이면 '이상치 가능'으로 표시하고,
//    정렬은 경계 안 값 뒤로(sortCompare), 평균·백분위는 경계로 눌러서(winsor) 쓴다.
(function (root) {
  "use strict";

  const POSITIVE_ONLY = ["pe", "forwardPE", "peg", "ps", "pb", "pfcf", "evEbitda", "evEbit"];
  const NON_NEGATIVE = ["debtRatio", "payoutRatio", "divYield", "currentRatio"];
  const HARD_ABS_LIMIT = { roa: 1000 };
  const SENTINELS = { eps: [-999] };
  // scripts/fundamentals_sanity.py 의 PLAUSIBLE 과 같아야 한다(test_fundamentals_sanity.py 가 아래 JSON 을 읽어 비교).
  // PLAUSIBLE-BEGIN
  const PLAUSIBLE = {
    "pe": [null, 1000],
    "forwardPE": [null, 1000],
    "peg": [null, 50],
    "ps": [null, 200],
    "pb": [null, 100],
    "pfcf": [null, 1000],
    "evEbitda": [null, 1000],
    "evEbit": [null, 1000],
    "divYield": [null, 30],
    "payoutRatio": [null, 500],
    "roe": [-300, 300],
    "roa": [-100, 100],
    "netMargin": [-300, 300],
    "revenueGrowth": [-100, 1000],
    "operatingGrowth": [-1000, 1000],
    "netGrowth": [-1000, 1000],
    "debtRatio": [null, 2000],
    "currentRatio": [null, 5000],
    "epsGrowthEst": [-200, 1000]
  };
  // PLAUSIBLE-END

  function finite(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // map_fundamentals 한 행을 제자리에서 정리. ctx = { equityB, salesB }(빌더만 앎, 브라우저는 보통 없음).
  // 반환: 지운 키 목록.
  function sanitizeRow(row, ctx) {
    const dropped = [];
    if (!row || typeof row !== "object") return dropped;
    const c = ctx || {};
    const drop = (k) => { if (Object.prototype.hasOwnProperty.call(row, k)) { delete row[k]; dropped.push(k); } };
    Object.keys(row).forEach((k) => {
      const v = row[k];
      if (typeof v === "number" && !Number.isFinite(v)) drop(k);
    });
    const pb = finite(row.pb);
    const debtRatio = finite(row.debtRatio);
    const equity = finite(c.equityB);
    const negEquity = (equity !== null && equity <= 0) || (pb !== null && pb < 0) || (debtRatio !== null && debtRatio < 0);
    const sales = finite(c.salesB);
    POSITIVE_ONLY.forEach((k) => { const v = finite(row[k]); if (v !== null && v <= 0) drop(k); });
    NON_NEGATIVE.forEach((k) => { const v = finite(row[k]); if (v !== null && v < 0) drop(k); });
    Object.keys(SENTINELS).forEach((k) => { const v = finite(row[k]); if (v !== null && SENTINELS[k].includes(v)) drop(k); });
    Object.keys(HARD_ABS_LIMIT).forEach((k) => { const v = finite(row[k]); if (v !== null && Math.abs(v) > HARD_ABS_LIMIT[k]) drop(k); });
    if (negEquity) drop("roe");
    if (sales !== null && sales <= 0) drop("netMargin");
    return dropped;
  }

  // { ticker: row } 전체를 제자리에서 정리. 반환: { rows, dropped: { key: count } }. 두 번 불러도 결과는 같다.
  function sanitizeTable(table) {
    const out = { rows: 0, dropped: {} };
    if (!table || typeof table !== "object") return out;
    Object.keys(table).forEach((t) => {
      out.rows += 1;
      sanitizeRow(table[t]).forEach((k) => { out.dropped[k] = (out.dropped[k] || 0) + 1; });
    });
    return out;
  }

  function bounds(key) { return PLAUSIBLE[key] || null; }

  function isOutlier(key, v) {
    const b = PLAUSIBLE[key];
    const x = finite(v);
    if (!b || x === null) return false;
    return (b[0] !== null && x < b[0]) || (b[1] !== null && x > b[1]);
  }

  function winsor(key, v) {
    const x = finite(v);
    const b = PLAUSIBLE[key];
    if (x === null || !b) return x;
    if (b[0] !== null && x < b[0]) return b[0];
    if (b[1] !== null && x > b[1]) return b[1];
    return x;
  }

  // 정렬 비교: 값 있음(경계 안) → 이상치 가능 → 결측 순. 같은 부류 안에서는 dir(1 오름·-1 내림).
  function sortCompare(key, a, b, dir) {
    const d = dir === 1 ? 1 : -1;
    const x = finite(a), y = finite(b);
    const cls = (v) => (v === null ? 2 : (isOutlier(key, v) ? 1 : 0));
    const cx = cls(x), cy = cls(y);
    if (cx !== cy) return cx - cy;
    if (x === null) return 0;
    return (x - y) * d;
  }

  function describe(key) {
    const b = PLAUSIBLE[key];
    if (!b) return "";
    const parts = [];
    if (b[0] !== null) parts.push(`${b[0]} 미만`);
    if (b[1] !== null) parts.push(`${b[1]} 초과`);
    return `이상치 가능: ${parts.join(" 또는 ")}. 분모(자본·매출·이익)가 0 에 가깝거나 단위가 섞였을 가능성이 커 정렬에서는 뒤로 보냅니다. 값은 원자료 그대로입니다.`;
  }

  const api = { PLAUSIBLE, POSITIVE_ONLY, NON_NEGATIVE, HARD_ABS_LIMIT, SENTINELS, finite, sanitizeRow, sanitizeTable, bounds, isOutlier, winsor, sortCompare, describe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MirFundSanity = api;
})(typeof window !== "undefined" ? window : globalThis);
