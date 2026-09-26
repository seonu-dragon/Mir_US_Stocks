// 과적합 검사 공통 모듈 — 순수 계산(DOM·네트워크 없음). 스크리너 백테스트가 처음 쓰고, 다른 백테스트도
// 같은 배지·같은 기준을 쓰도록 분리했다. 브라우저 window.MirOverfitCore, node 테스트
// (scripts/tests/test_overfit_core.mjs) module.exports. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 들어 있는 것
//   - 기초 통계: mean · std(표본) · skewness · kurtosis(정규=3, '초과' 아님) · Sharpe(기간 단위, 무위험 0)
//   - 정규분포 CDF·역CDF(Acklam)
//   - Probabilistic Sharpe Ratio(PSR) · 기대 최대 Sharpe · Deflated Sharpe Ratio(DSR)
//       Bailey & López de Prado (2014) "The Deflated Sharpe Ratio: Correcting for Selection Bias,
//       Backtest Overfitting and Non-Normality", J. Portfolio Management 40(5).
//       PSR(SR*) = Φ( (SR̂ − SR*)·√(T−1) / √(1 − γ3·SR̂ + (γ4 − 1)/4 · SR̂²) )
//       SR0 = √V · ( (1 − γ)·Φ⁻¹(1 − 1/N) + γ·Φ⁻¹(1 − 1/(N·e)) ),  γ = 오일러-마스케로니 상수
//       DSR = PSR(SR0)
//   - 순환 블록 부트스트랩(시드 고정) 신뢰구간
//   - 앞 70% / 뒤 30% 분리
//   - 배지 판정(통과 / 불충분 / 과적합 의심) — 기준 문장(CRITERIA)을 화면·신뢰도 센터가 그대로 쓴다.
(function (root) {
  "use strict";

  const EULER_GAMMA = 0.5772156649015329;

  // 배지 기준(공개용). verdict() 가 실제로 쓰는 숫자와 같은 상수에서 만든다.
  const THRESHOLDS = {
    minMonths: 36,        // 전체 유효 개월
    minOutMonths: 12,     // 뒤 30% 구간 개월
    minAvgHoldings: 5,    // 투자 중인 달의 평균 보유 종목 수
    dsrPass: 0.95,        // 통과: DSR ≥ 0.95
    dsrOverfit: 0.5,      // 과적합 의심: 시도 여러 번인데 DSR < 0.5 (보정 전 PSR 은 ≥ 0.9)
    psrLooksGood: 0.9,
    splitFrac: 0.7,
  };
  const CRITERIA = [
    `판정 대상은 전략 − 비교 기준의 월 초과수익입니다(스크리너 백테스트의 비교 기준 = 같은 시점에 살 수 있고 수식 필드 값이 있는 종목 전체를 같은 비중으로 산 경우).`,
    `불충분: 유효 기간 ${THRESHOLDS.minMonths}개월 미만, 뒤 30% 구간 ${THRESHOLDS.minOutMonths}개월 미만, 평균 보유 ${THRESHOLDS.minAvgHoldings}종목 미만이거나, 아래 '통과' 조건을 다 채우지 못한 경우.`,
    `통과: Deflated Sharpe Ratio(시도 횟수 보정) ≥ ${THRESHOLDS.dsrPass} AND 블록 부트스트랩 95% 신뢰구간 하한 > 0 AND 뒤 30% 구간 초과수익 > 0.`,
    `과적합 의심: 앞 70% 구간 초과수익은 플러스인데 뒤 30% 구간은 0 이하, 또는 조건을 여러 번 바꿔 돌린 뒤 보정 전 PSR 은 ${THRESHOLDS.psrLooksGood} 이상인데 DSR 이 ${THRESHOLDS.dsrOverfit} 미만.`,
    `시도 횟수는 이 브라우저 탭에서 서로 다른 수식·설정으로 백테스트를 돌린 횟수입니다. 많이 바꿔 볼수록 우연히 좋아 보이는 조건을 고를 확률이 커지므로 DSR 기준선이 올라갑니다.`,
    `'통과' 도 미래 수익을 뜻하지 않습니다. 생존편향(상장폐지 종목 제외)이 남아 있어 모든 결과가 실제보다 좋게 나옵니다.`,
  ];

  // ---------- 기초 통계 ----------
  function clean(xs) {
    return (Array.isArray(xs) ? xs : []).map(Number).filter(Number.isFinite);
  }
  function mean(xs) {
    const a = clean(xs);
    return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  }
  function std(xs) { // 표본 표준편차(n−1)
    const a = clean(xs);
    if (a.length < 2) return null;
    const m = a.reduce((s, x) => s + x, 0) / a.length;
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  }
  function moments(xs) {
    const a = clean(xs);
    const n = a.length;
    if (n < 3) return { n, mean: n ? a.reduce((s, x) => s + x, 0) / n : null, skew: 0, kurt: 3 };
    const m = a.reduce((s, x) => s + x, 0) / n;
    let m2 = 0, m3 = 0, m4 = 0;
    for (const x of a) { const d = x - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
    m2 /= n; m3 /= n; m4 /= n;
    if (!(m2 > 0)) return { n, mean: m, skew: 0, kurt: 3 };
    return { n, mean: m, skew: m3 / m2 ** 1.5, kurt: m4 / (m2 * m2) };
  }
  function sharpe(xs) { // 기간 단위(연환산 아님)
    const s = std(xs);
    const m = mean(xs);
    return s && s > 0 && m != null ? m / s : null;
  }

  // ---------- 정규분포 ----------
  function erf(x) { // Numerical Recipes erfc(Chebyshev 근사, 상대오차 < 1.2e-7) 로 erf 를 만든다
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? 1 - r : r - 1;
  }
  function normCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  // Acklam 역정규 CDF(상대오차 ~1.15e-9) + 뉴턴 한 번 보정.
  function normInv(p) {
    if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let q, r, x;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pl) {
      q = p - 0.5; r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    const e = normCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    return x - u / (1 + (x * u) / 2);
  }

  // ---------- PSR · DSR ----------
  // sr, srStar: 기간 단위 Sharpe. n: 관측 수. skew: γ3, kurt: γ4(정규 = 3).
  function probabilisticSharpe(sr, srStar, n, skew = 0, kurt = 3) {
    if (!Number.isFinite(sr) || !Number.isFinite(srStar) || !(n > 1)) return null;
    const denom = 1 - skew * sr + ((kurt - 1) / 4) * sr * sr;
    if (!(denom > 0)) return null;
    return normCdf(((sr - srStar) * Math.sqrt(n - 1)) / Math.sqrt(denom));
  }
  // N 번 독립 시도의 Sharpe 최댓값 기대치(귀무가설: 진짜 Sharpe 0). variance = 시도 간 Sharpe 분산.
  function expectedMaxSharpe(nTrials, variance) {
    const N = Math.max(1, Math.floor(nTrials));
    if (N <= 1 || !(variance > 0)) return 0;
    return Math.sqrt(variance) * ((1 - EULER_GAMMA) * normInv(1 - 1 / N) + EULER_GAMMA * normInv(1 - 1 / (N * Math.E)));
  }
  // returns: 기간 수익률(여기선 월 초과수익). trials: 시도 횟수(≥1). trialSharpes: 지금까지 시도들의 Sharpe(기간 단위).
  // 시도 간 분산은 관측값이 불안정(시도 2~3번)하므로 귀무 분산 1/(T−1) 보다 작게 잡지 않는다 — 보수적.
  function deflatedSharpe(returns, { trials = 1, trialSharpes = [] } = {}) {
    const mo = moments(returns);
    const sr = sharpe(returns);
    const n = mo.n;
    if (sr == null || n < 3) return { dsr: null, psr: null, sr0: null, sr, n, trials, variance: null, skew: mo.skew, kurt: mo.kurt };
    const nullVar = 1 / (n - 1);
    const emp = clean(trialSharpes);
    const empVar = emp.length >= 2 ? std(emp) ** 2 : 0;
    const variance = Math.max(nullVar, empVar);
    const N = Math.max(1, Math.floor(trials));
    const sr0 = expectedMaxSharpe(N, variance);
    return {
      dsr: probabilisticSharpe(sr, sr0, n, mo.skew, mo.kurt),
      psr: probabilisticSharpe(sr, 0, n, mo.skew, mo.kurt),
      sr0, sr, n, trials: N, variance, skew: mo.skew, kurt: mo.kurt,
    };
  }

  // ---------- 부트스트랩 ----------
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
  function quantileSorted(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  // 순환 블록 부트스트랩: 길이 blockLen 블록을 무작위 시작점에서 이어 붙여 원래 길이만큼 만든다
  // (월 수익의 자기상관·변동성 군집을 블록 안에 보존). stat = 표본 → 숫자. 기본은 평균.
  function blockBootstrap(xs, { blockLen = 0, B = 2000, seed = 20260926, stat = null, level = 0.95 } = {}) {
    const a = clean(xs);
    const n = a.length;
    if (n < 6) return { lo: null, hi: null, point: null, blockLen: null, B: 0 };
    const L = blockLen > 0 ? Math.min(n, Math.floor(blockLen)) : Math.max(3, Math.round(Math.cbrt(n)));
    const f = typeof stat === "function" ? stat : (s) => s.reduce((t, x) => t + x, 0) / s.length;
    const rnd = mulberry32(seed);
    const out = new Array(B);
    const sample = new Array(n);
    for (let b = 0; b < B; b++) {
      let k = 0;
      while (k < n) {
        const start = Math.floor(rnd() * n);
        for (let j = 0; j < L && k < n; j++) sample[k++] = a[(start + j) % n];
      }
      out[b] = f(sample);
    }
    const sorted = out.filter(Number.isFinite).sort((x, y) => x - y);
    const tail = (1 - level) / 2;
    return { lo: quantileSorted(sorted, tail), hi: quantileSorted(sorted, 1 - tail), point: f(a), blockLen: L, B };
  }

  // ---------- 분리 ----------
  function splitSample(xs, frac = THRESHOLDS.splitFrac) {
    const a = Array.isArray(xs) ? xs.slice() : [];
    const cut = Math.max(0, Math.min(a.length, Math.round(a.length * frac)));
    return { cut, first: a.slice(0, cut), second: a.slice(cut) };
  }

  // ---------- 배지 ----------
  // excess: 월 초과수익 배열(전략 − 동일가중). avgHoldings: 투자한 달 평균 보유 수.
  // 반환 { key: "pass"|"insufficient"|"overfit", label, reasons[], dsr, bootstrap, split }
  function verdict(excess, { trials = 1, trialSharpes = [], avgHoldings = null, periodsPerYear = 12, seed = 20260926 } = {}) {
    const x = clean(excess);
    const T = THRESHOLDS;
    const sp = splitSample(x, T.splitFrac);
    const inMean = mean(sp.first);
    const outMean = mean(sp.second);
    const ds = deflatedSharpe(x, { trials, trialSharpes });
    const bs = blockBootstrap(x, { seed });
    const reasons = [];
    const insufficient = [];
    if (x.length < T.minMonths) insufficient.push(`유효 기간 ${x.length}개월 < ${T.minMonths}개월`);
    if (sp.second.length < T.minOutMonths) insufficient.push(`뒤 30% 구간 ${sp.second.length}개월 < ${T.minOutMonths}개월`);
    if (avgHoldings != null && avgHoldings < T.minAvgHoldings) insufficient.push(`평균 보유 ${avgHoldings.toFixed(1)}종목 < ${T.minAvgHoldings}종목`);
    const base = {
      dsr: ds, bootstrap: bs,
      split: { cut: sp.cut, inMonths: sp.first.length, outMonths: sp.second.length, inMean, outMean,
        inAnn: inMean == null ? null : inMean * periodsPerYear, outAnn: outMean == null ? null : outMean * periodsPerYear },
      months: x.length,
    };
    if (insufficient.length) {
      return { ...base, key: "insufficient", label: "불충분", reasons: insufficient };
    }
    const overfitSplit = inMean != null && outMean != null && inMean > 0 && outMean <= 0;
    const overfitDeflate = trials > 1 && ds.dsr != null && ds.psr != null && ds.psr >= T.psrLooksGood && ds.dsr < T.dsrOverfit;
    if (overfitSplit || overfitDeflate) {
      if (overfitSplit) reasons.push("앞 70% 구간 초과수익은 플러스인데 뒤 30% 구간은 0 이하");
      if (overfitDeflate) reasons.push(`보정 전 PSR ${ds.psr.toFixed(2)} → 시도 ${trials}회 보정 DSR ${ds.dsr.toFixed(2)}`);
      return { ...base, key: "overfit", label: "과적합 의심", reasons };
    }
    const passDsr = ds.dsr != null && ds.dsr >= T.dsrPass;
    const passCi = bs.lo != null && bs.lo > 0;
    const passOut = outMean != null && outMean > 0;
    if (passDsr && passCi && passOut) {
      return { ...base, key: "pass", label: "통과", reasons: ["DSR·부트스트랩 하한·뒤 30% 구간 모두 기준 충족"] };
    }
    if (!passDsr) reasons.push(`DSR ${ds.dsr == null ? "계산 불가" : ds.dsr.toFixed(2)} < ${T.dsrPass}`);
    if (!passCi) reasons.push(`부트스트랩 95% 하한 ${bs.lo == null ? "계산 불가" : (bs.lo * 100).toFixed(2) + "%p/월"} ≤ 0`);
    if (!passOut) reasons.push("뒤 30% 구간 초과수익 ≤ 0");
    return { ...base, key: "insufficient", label: "불충분", reasons };
  }

  const api = {
    EULER_GAMMA, THRESHOLDS, CRITERIA,
    mean, std, moments, sharpe, normCdf, normInv,
    probabilisticSharpe, expectedMaxSharpe, deflatedSharpe,
    mulberry32, blockBootstrap, splitSample, verdict,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirOverfitCore = api;
})(typeof window !== "undefined" ? window : null);
