// PER 기준(최근 4분기 / 연간 / KRX 사업연도) 판정 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirPerBasisCore, node 테스트(scripts/tests/test_per_basis_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다.
//
// 왜 필요한가: 국내 스냅샷은 예전에 네이버 '연간' EPS(직전 사업연도 확정)를 epsTtm 이름으로
// 담았고, 화면은 현재가 ÷ 그 값으로 PER 을 다시 계산했다(삼성전자 43배 vs 네이버 최근 4분기
// 12.85배, 2026-09-26). 이제 빌더가 peBasis("ttm"|"annual"|"annual-krx")를 적는다.
// peBasis 가 없는 예전 국내 자료는 연간으로 본다(그때 epsTtm 은 실제로 연간 EPS 였다).
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // "2026.06." · "202606" → "2026.06"
  function asOfText(asOf) {
    const m = /^(\d{4})[.\-/]?(\d{1,2})/.exec(String(asOf || ""));
    return m ? `${m[1]}.${m[2].padStart(2, "0")}` : "";
  }

  // f: fundamentals(원본). opts: { kr: bool, price: number, fallbackEps?: number }
  // 반환: { basis, eps, pe, label, epsLabel, note }
  //   basis  "ttm" | "annual" | "annual-krx" | null
  //   eps    PER 계산에 쓴 주당순이익(없으면 null)
  //   pe     현재가 ÷ eps (적자·자료 없음이면 null). 가격이 없으면 원본 pe.
  function perBasis(f, opts) {
    const src = f || {};
    const kr = !!(opts && opts.kr);
    const price = num(opts && opts.price);
    const declared = typeof src.peBasis === "string" ? src.peBasis : null;
    let basis = null;
    let eps = null;
    let year = num(src.epsAnnualYear) ?? num(src.peYear);

    if (!kr) {
      // 미국: 스냅샷 빌더가 최근 4개 분기 EPS 합(또는 야후 trailingEps)을 epsTtm 으로 준다.
      eps = num(src.epsTtm) ?? num(src.trailingEps) ?? num(src.trailingEPS) ?? num(src.eps);
      basis = eps !== null ? "ttm" : (num(src.pe) !== null ? "ttm" : null);
    } else if (declared === "ttm") {
      eps = num(src.epsTtm) ?? num(src.eps);
      basis = "ttm";
    } else if (declared === "annual-krx") {
      basis = "annual-krx";
      eps = num(src.epsAnnual);
    } else {
      // "annual" 이거나 기준 표식이 없는 예전 자료 — epsTtm 에 들어 있던 값도 연간 EPS 다.
      eps = num(src.epsAnnual) ?? num(src.eps) ?? num(src.epsTtm);
      basis = eps !== null || num(src.pe) !== null ? "annual" : null;
    }

    // EPS 가 아예 없으면 순이익 ÷ 주식수(호출부가 계산해 넘김). 국내 incomeB 는 연간 확정 순이익.
    const fallbackEps = num(opts && opts.fallbackEps);
    if (eps === null && fallbackEps !== null && fallbackEps > 0) {
      eps = fallbackEps;
      if (!basis || basis === "annual-krx") basis = kr ? "annual" : "ttm";
    }

    let pe = null;
    if (eps !== null && eps > 0 && price !== null && price > 0) pe = price / eps;
    else if (eps !== null && eps <= 0) pe = null; // 적자 — PER 정의 안 됨
    else {
      const raw = num(src.pe);
      pe = raw !== null && raw > 0 ? raw : null;
    }

    let label = "PER";
    let epsLabel = "EPS";
    let note = "";
    if (basis === "ttm") {
      label = "PER(최근 4분기)";
      epsLabel = "EPS(최근 4분기)";
      const at = asOfText(src.epsTtmAsOf);
      note = at ? `현재가 ÷ 최근 4개 분기 EPS 합(${at} 분기까지)` : "현재가 ÷ 최근 4개 분기 EPS 합";
    } else if (basis === "annual") {
      label = year ? `PER(${year} 연간)` : "PER(연간)";
      epsLabel = year ? `EPS(${year} 연간)` : "EPS(연간)";
      note = `현재가 ÷ ${year ? `${year}년` : "직전 사업연도"} 확정 EPS — 최근 분기 실적은 반영되지 않음`;
    } else if (basis === "annual-krx") {
      label = "PER(사업연도 기준)";
      epsLabel = "EPS(사업연도 기준)";
      note = "KRX 공식값: 현재가 ÷ 직전 사업연도 EPS";
    }
    return { basis, eps, pe, label, epsLabel, note };
  }

  const api = { perBasis, asOfText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirPerBasisCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
