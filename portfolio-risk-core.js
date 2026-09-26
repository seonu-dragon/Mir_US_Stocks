// 포트폴리오 위험 분석 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirPortfolioRiskCore, node 테스트(scripts/tests/test_portfolio_risk_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 세 묶음
// 1) 위험 기여도 · 리스크 패리티 · 최소분산(롱온리, 종목 상한) + 표본 외 비교.
//    공분산은 일별 단순수익률의 Ledoit-Wolf 축소 추정(Ledoit & Wolf 2004, 목표 = 평균분산 × I,
//    scikit-learn LedoitWolf 와 같은 식). 최대 샤프·평균분산(기대수익 입력) 최적화는 일부러 없다 —
//    기대수익 추정 오차가 비중을 지배해 표본 내 과적합이 된다.
// 2) 성과 지표(티어시트): 월별·연도별 수익, 낙폭 구간, 롤링 샤프·β, 소르티노·칼마, 상·하방 포착률.
//    empyrical(quantopian) 공식을 옮겼다. 연환산 252거래일, 무위험 수익률 0.
// 3) 과거 위기 재생: 구간 경로 정규화·대리(지수 × β) 경로·포트폴리오 합성·구간 통계.
(function (root) {
  "use strict";

  const TRADING_DAYS = 252;
  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // ---------------------------------------------------------------- 기초
  function mean(a) {
    if (!a.length) return NaN;
    let s = 0;
    for (let i = 0; i < a.length; i += 1) s += a[i];
    return s / a.length;
  }

  // 표본 표준편차(ddof=1) — empyrical 의 annual_volatility 와 같다.
  function std(a) {
    if (a.length < 2) return NaN;
    const m = mean(a);
    let s = 0;
    for (let i = 0; i < a.length; i += 1) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }

  function simpleReturns(values) {
    const out = [];
    for (let i = 1; i < values.length; i += 1) {
      const a = values[i - 1];
      const b = values[i];
      out.push(a > 0 && Number.isFinite(b) ? b / a - 1 : 0);
    }
    return out;
  }

  // 날짜→종가 Map 여러 개를 공통 거래일로 맞춘다(모든 자산에 가격이 있는 날만).
  // 반환: { dates, closes: [자산][일] }
  function alignCommon(maps) {
    if (!maps.length) return { dates: [], closes: [] };
    let ref = maps[0];
    maps.forEach((m) => { if (m.size < ref.size) ref = m; });
    const dates = [...ref.keys()].filter((d) => maps.every((m) => {
      const v = m.get(d);
      return Number.isFinite(v) && v > 0;
    })).sort();
    return { dates, closes: maps.map((m) => dates.map((d) => m.get(d))) };
  }

  // 자산별 종가 → T×n 수익률 행렬(행 = 날짜).
  function returnsMatrix(closes) {
    const cols = closes.map(simpleReturns);
    const T = cols.length ? cols[0].length : 0;
    const R = [];
    for (let t = 0; t < T; t += 1) R.push(cols.map((c) => c[t]));
    return R;
  }

  function matVec(S, w) {
    return S.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
    return s;
  }

  // ---------------------------------------------------------------- 공분산
  // 표본 공분산(ddof=1).
  function sampleCov(R) {
    const T = R.length;
    const n = T ? R[0].length : 0;
    const mu = Array.from({ length: n }, (_, j) => mean(R.map((r) => r[j])));
    const S = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let t = 0; t < T; t += 1) {
      for (let i = 0; i < n; i += 1) {
        const di = R[t][i] - mu[i];
        for (let j = i; j < n; j += 1) S[i][j] += di * (R[t][j] - mu[j]);
      }
    }
    for (let i = 0; i < n; i += 1) {
      for (let j = i; j < n; j += 1) {
        S[i][j] /= Math.max(1, T - 1);
        S[j][i] = S[i][j];
      }
    }
    return S;
  }

  // Ledoit-Wolf 축소 공분산. scikit-learn sklearn.covariance.ledoit_wolf(assume_centered=False) 와
  // 같은 식: 표본(1/T) 공분산 S 를 목표 μI(μ = tr(S)/n) 쪽으로 δ 만큼 당긴다.
  //   Σ̂ = (1-δ)·S + δ·μ·I,  δ = min(β̄, d²)/d²  (d² = ‖S-μI‖²/n, β̄ = 표본 추정오차)
  // 반환 cov 는 일별 단위(연환산은 호출부가 ×252).
  function ledoitWolf(R) {
    const T = R.length;
    const n = T ? R[0].length : 0;
    if (T < 2 || n < 1) return null;
    const mu = Array.from({ length: n }, (_, j) => mean(R.map((r) => r[j])));
    const X = R.map((r) => r.map((v, j) => v - mu[j]));
    const S = Array.from({ length: n }, () => new Array(n).fill(0));
    const X2 = X.map((r) => r.map((v) => v * v));
    const B = Array.from({ length: n }, () => new Array(n).fill(0)); // Σ_t x_ti² x_tj²
    for (let t = 0; t < T; t += 1) {
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          S[i][j] += X[t][i] * X[t][j];
          B[i][j] += X2[t][i] * X2[t][j];
        }
      }
    }
    let trace = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) S[i][j] /= T;
      trace += S[i][i];
    }
    const m = trace / n;
    let betaSum = 0;
    let deltaSum = 0; // Σ (X'X)²/T² = Σ S_ij²
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        betaSum += B[i][j];
        deltaSum += S[i][j] * S[i][j];
      }
    }
    let beta = (1 / (n * T)) * (betaSum / T - deltaSum);
    let delta = (deltaSum - 2 * m * trace + n * m * m) / n;
    beta = Math.min(beta, delta);
    const shrinkage = beta === 0 || delta === 0 ? 0 : beta / delta;
    const cov = S.map((row, i) => row.map((v, j) => (1 - shrinkage) * v + (i === j ? shrinkage * m : 0)));
    return { cov, shrinkage, mu: m, sample: S, observations: T };
  }

  function annualize(S) {
    return S.map((row) => row.map((v) => v * TRADING_DAYS));
  }

  // ---------------------------------------------------------------- 위험 기여도
  function portfolioVol(w, S) {
    return Math.sqrt(Math.max(0, dot(w, matVec(S, w))));
  }

  // 위험 기여도 = 한계기여(∂σ/∂w_i = (Σw)_i/σ) × 비중. 합 = σ. pct 는 σ 대비 비율(합 1).
  function riskContributions(w, S) {
    const Sw = matVec(S, w);
    const vol = Math.sqrt(Math.max(0, dot(w, Sw)));
    if (!(vol > 0)) return { vol: 0, mrc: w.map(() => 0), rc: w.map(() => 0), pct: w.map(() => 0) };
    const mrc = Sw.map((v) => v / vol);
    const rc = mrc.map((v, i) => v * w[i]);
    return { vol, mrc, rc, pct: rc.map((v) => v / vol) };
  }

  // 리스크 패리티(각 종목 위험 기여 동일, 롱온리). 순환 좌표하강(Griveau-Billion, Richard & Roncalli 2013):
  // x_i 에 대해 Σ_ii x_i² + (Σ_{j≠i} Σ_ij x_j) x_i − b_i = 0 의 양근으로 갱신 → 합 1 로 정규화.
  function riskParity(S, opts = {}) {
    const n = S.length;
    if (!n) return null;
    const b = opts.budgets || new Array(n).fill(1 / n);
    const tol = opts.tol || 1e-12;
    const maxIter = opts.maxIter || 10000;
    let x = S.map((row, i) => 1 / Math.sqrt(Math.max(row[i], 1e-18)));
    const s0 = x.reduce((a, v) => a + v, 0);
    x = x.map((v) => v / s0);
    let iterations = 0;
    let converged = false;
    for (; iterations < maxIter; iterations += 1) {
      let change = 0;
      for (let i = 0; i < n; i += 1) {
        let c = 0;
        for (let j = 0; j < n; j += 1) if (j !== i) c += S[i][j] * x[j];
        const a = S[i][i];
        const next = (-c + Math.sqrt(c * c + 4 * a * b[i])) / (2 * a);
        change = Math.max(change, Math.abs(next - x[i]) / Math.max(1e-18, Math.abs(x[i])));
        x[i] = next;
      }
      if (change < tol) { converged = true; iterations += 1; break; }
    }
    const sum = x.reduce((a, v) => a + v, 0);
    return { weights: x.map((v) => v / sum), iterations, converged };
  }

  // {0 ≤ w_i ≤ cap, Σw = 1} 위로의 유클리드 사영(τ 이분법: w_i = clip(v_i − τ, 0, cap)).
  function projectCappedSimplex(v, cap) {
    const n = v.length;
    const u = Math.max(cap, 1 / n);
    const f = (tau) => v.reduce((s, x) => s + Math.min(u, Math.max(0, x - tau)), 0) - 1;
    let lo = Math.min(...v) - u - 1;
    let hi = Math.max(...v) + 1;
    for (let k = 0; k < 200; k += 1) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
      if (hi - lo < 1e-15) break;
    }
    const tau = (lo + hi) / 2;
    return v.map((x) => Math.min(u, Math.max(0, x - tau)));
  }

  function largestEigen(S) {
    let v = S.map(() => 1);
    let lambda = 0;
    for (let k = 0; k < 200; k += 1) {
      const w = matVec(S, v);
      const norm = Math.sqrt(dot(w, w));
      if (!(norm > 0)) return 0;
      v = w.map((x) => x / norm);
      lambda = norm;
    }
    return lambda;
  }

  // 최소분산(롱온리, 종목 상한 cap). 가속 사영경사(FISTA) — 목적 ½w'Σw, 제약 = 상한 붙은 단체.
  // cap < 1/n 이면 해가 없으므로 1/n 으로 올리고 effectiveCap 에 적는다.
  function minVariance(S, opts = {}) {
    const n = S.length;
    if (!n) return null;
    const cap = Math.min(1, Math.max(opts.cap == null ? 1 : Number(opts.cap), 1 / n));
    const maxIter = opts.maxIter || 20000;
    const tol = opts.tol || 1e-13;
    const L = largestEigen(S) || 1;
    const step = 1 / L;
    let w = projectCappedSimplex(new Array(n).fill(1 / n), cap);
    let y = w.slice();
    let t = 1;
    let iterations = 0;
    let converged = false;
    for (; iterations < maxIter; iterations += 1) {
      const g = matVec(S, y);
      const next = projectCappedSimplex(y.map((v, i) => v - step * g[i]), cap);
      const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
      y = next.map((v, i) => v + ((t - 1) / tNext) * (v - w[i]));
      const change = Math.sqrt(next.reduce((s, v, i) => s + (v - w[i]) * (v - w[i]), 0));
      w = next;
      t = tNext;
      if (change < tol) { converged = true; iterations += 1; break; }
    }
    return { weights: w, effectiveCap: cap, iterations, converged };
  }

  // 고정 비중(매일 그 비중으로 맞춘다고 가정)의 일별 포트폴리오 수익률.
  function fixedWeightReturns(R, w) {
    return R.map((r) => dot(r, w));
  }

  function annualVolatility(returns) {
    const s = std(returns);
    return Number.isFinite(s) ? s * Math.sqrt(TRADING_DAYS) : NaN;
  }

  function cumulativeReturns(returns) {
    const out = [];
    let v = 1;
    for (let i = 0; i < returns.length; i += 1) {
      v *= 1 + returns[i];
      out.push(v);
    }
    return out;
  }

  // 최대 낙폭(음수, 비율). 시작 가치 1 을 첫 고점으로 본다.
  function maxDrawdown(returns) {
    let peak = 1;
    let v = 1;
    let mdd = 0;
    for (let i = 0; i < returns.length; i += 1) {
      v *= 1 + returns[i];
      if (v > peak) peak = v;
      mdd = Math.min(mdd, v / peak - 1);
    }
    return mdd;
  }

  // 표본 외 비교: 앞쪽 split 비율 구간으로 공분산을 추정해 비중을 정하고, 뒤쪽 구간의 실현
  // 변동성·최대낙폭·수익률을 동일비중·현재비중과 나란히 본다. 한 번의 분할이라 표본은 1개다.
  function outOfSample(R, dates, currentWeights, opts = {}) {
    const T = R.length;
    const split = opts.split || 0.5;
    const cut = Math.floor(T * split);
    if (cut < 60 || T - cut < 40) return null;
    const inR = R.slice(0, cut);
    const outR = R.slice(cut);
    const lw = ledoitWolf(inR);
    if (!lw) return null;
    const S = annualize(lw.cov);
    const n = S.length;
    const schemes = [
      { key: "current", weights: currentWeights.slice() },
      { key: "equal", weights: new Array(n).fill(1 / n) },
      { key: "riskParity", weights: riskParity(S).weights },
      { key: "minVariance", weights: minVariance(S, { cap: opts.cap }).weights },
    ];
    const rows = schemes.map((s) => {
      const r = fixedWeightReturns(outR, s.weights);
      const cum = cumulativeReturns(r);
      return {
        key: s.key,
        weights: s.weights,
        vol: annualVolatility(r),
        mdd: maxDrawdown(r),
        ret: cum.length ? cum[cum.length - 1] - 1 : 0,
        inSampleVol: portfolioVol(s.weights, S),
      };
    });
    // R[t] 는 dates[t] → dates[t+1] 수익률.
    return {
      inSample: { start: dates[0], end: dates[cut], days: cut },
      outSample: { start: dates[cut], end: dates[T], days: T - cut },
      shrinkage: lw.shrinkage,
      rows,
    };
  }

  // 한 번에 계산: 공통일 정렬 → 수익률 → LW 공분산 → 현재·RP·최소분산 비중과 각 위험 기여도 + 표본 외.
  function analyzeAllocation(maps, currentWeights, opts = {}) {
    const aligned = alignCommon(maps);
    let { dates, closes } = aligned;
    if (opts.lookback && dates.length > opts.lookback + 1) {
      const from = dates.length - (opts.lookback + 1);
      dates = dates.slice(from);
      closes = closes.map((c) => c.slice(from));
    }
    if (dates.length < 61) return { error: "short", days: dates.length };
    const R = returnsMatrix(closes);
    const lw = ledoitWolf(R);
    const S = annualize(lw.cov);
    const n = S.length;
    const wSum = currentWeights.reduce((a, v) => a + v, 0) || 1;
    const cur = currentWeights.map((v) => v / wSum);
    const rp = riskParity(S);
    const mv = minVariance(S, { cap: opts.cap });
    const eq = new Array(n).fill(1 / n);
    return {
      dates,
      days: R.length,
      shrinkage: lw.shrinkage,
      cov: S,
      vols: S.map((row, i) => Math.sqrt(row[i])),
      current: { weights: cur, ...riskContributions(cur, S) },
      equal: { weights: eq, ...riskContributions(eq, S) },
      riskParity: { weights: rp.weights, converged: rp.converged, iterations: rp.iterations, ...riskContributions(rp.weights, S) },
      minVariance: { weights: mv.weights, effectiveCap: mv.effectiveCap, converged: mv.converged, ...riskContributions(mv.weights, S) },
      oos: outOfSample(R, dates, cur, { cap: opts.cap }),
    };
  }

  // ---------------------------------------------------------------- 티어시트
  // series: [{ d: "YYYY-MM-DD", v }] (지수화된 누적 가치). 반환 수익률은 i-1 → i.
  function seriesReturns(series) {
    return simpleReturns(series.map((p) => Number(p.v)));
  }

  // empyrical annual_return: (누적)^(252/기간수) − 1. 기간수 = 수익률 개수.
  function annualReturn(returns) {
    if (!returns.length) return NaN;
    const total = cumulativeReturns(returns).pop();
    if (!(total > 0)) return -1;
    return Math.pow(total, TRADING_DAYS / returns.length) - 1;
  }

  // empyrical sharpe_ratio(risk_free=0): mean/std(ddof=1) × √252.
  function sharpe(returns) {
    const s = std(returns);
    return s > 0 ? (mean(returns) / s) * Math.sqrt(TRADING_DAYS) : NaN;
  }

  // empyrical downside_risk(required_return=0): √mean(min(r,0)²) × √252.
  function downsideRisk(returns) {
    if (!returns.length) return NaN;
    let s = 0;
    for (let i = 0; i < returns.length; i += 1) {
      const d = Math.min(returns[i], 0);
      s += d * d;
    }
    return Math.sqrt(s / returns.length) * Math.sqrt(TRADING_DAYS);
  }

  // empyrical sortino_ratio: mean(r)×252 / downside_risk.
  function sortino(returns) {
    const dr = downsideRisk(returns);
    return dr > 0 ? (mean(returns) * TRADING_DAYS) / dr : NaN;
  }

  // empyrical calmar_ratio: annual_return / |max_drawdown|.
  function calmar(returns) {
    const mdd = maxDrawdown(returns);
    return mdd < 0 ? annualReturn(returns) / Math.abs(mdd) : NaN;
  }

  function betaOf(y, x) {
    const n = Math.min(y.length, x.length);
    if (n < 3) return NaN;
    const my = mean(y.slice(0, n));
    const mx = mean(x.slice(0, n));
    let cov = 0;
    let vx = 0;
    for (let i = 0; i < n; i += 1) {
      cov += (y[i] - my) * (x[i] - mx);
      vx += (x[i] - mx) * (x[i] - mx);
    }
    return vx > 0 ? cov / vx : NaN;
  }

  // empyrical up_capture / down_capture: 벤치마크가 오른(내린) 날만 모아 각각 annual_return 을 내고 나눈다.
  function captureRatios(p, b) {
    const n = Math.min(p.length, b.length);
    const up = { p: [], b: [] };
    const down = { p: [], b: [] };
    for (let i = 0; i < n; i += 1) {
      if (b[i] > 0) { up.p.push(p[i]); up.b.push(b[i]); }
      else if (b[i] < 0) { down.p.push(p[i]); down.b.push(b[i]); }
    }
    const ratio = (g) => {
      if (g.p.length < 5) return NaN;
      const bp = annualReturn(g.b);
      return bp !== 0 ? annualReturn(g.p) / bp : NaN;
    };
    return { up: ratio(up), down: ratio(down), upDays: up.p.length, downDays: down.p.length };
  }

  // 월별 수익: 그 달 마지막 값 / 직전 달 마지막 값 − 1. 첫 달은 시작값 대비(부분 월 표시).
  function periodReturns(series, keyLen) {
    if (!series.length) return [];
    const out = [];
    let prevEnd = Number(series[0].v);
    let cur = null;
    series.forEach((p) => {
      const k = String(p.d).slice(0, keyLen);
      if (!cur || cur.key !== k) {
        if (cur) { out.push(cur); prevEnd = cur.endValue; }
        cur = { key: k, startValue: prevEnd, endValue: Number(p.v), start: p.d, end: p.d };
      }
      cur.endValue = Number(p.v);
      cur.end = p.d;
    });
    if (cur) out.push(cur);
    return out.map((r) => ({ key: r.key, start: r.start, end: r.end, ret: r.startValue > 0 ? r.endValue / r.startValue - 1 : NaN }));
  }

  // 월별: [{ year, month(1~12), ret, partial }]. partial = 시작·끝 달이 달 전체가 아님.
  function monthlyReturns(series) {
    const rows = periodReturns(series, 7);
    const last = rows.length - 1;
    return rows.map((r, i) => ({
      year: Number(r.key.slice(0, 4)),
      month: Number(r.key.slice(5, 7)),
      ret: r.ret,
      start: r.start,
      end: r.end,
      partial: i === 0 || i === last,
    }));
  }

  function yearlyReturns(series) {
    const rows = periodReturns(series, 4);
    const last = rows.length - 1;
    return rows.map((r, i) => ({ year: Number(r.key), ret: r.ret, start: r.start, end: r.end, partial: i === 0 || i === last }));
  }

  // 낙폭 구간(pyfolio gen_drawdown_table 과 같은 정의): 고점일 → 저점일 → 회복일(고점 수준 재도달).
  // 깊이 순 상위 top 개. duration = 고점일부터 회복일(미회복이면 마지막 날)까지 거래일 수.
  function drawdownPeriods(series, top = 5) {
    const out = [];
    if (series.length < 2) return out;
    let peakIdx = 0;
    let peakVal = Number(series[0].v);
    let ep = null; // 진행 중 구간
    for (let i = 1; i < series.length; i += 1) {
      const v = Number(series[i].v);
      if (v >= peakVal) {
        if (ep) {
          ep.recoveryIdx = i;
          out.push(ep);
          ep = null;
        }
        peakIdx = i;
        peakVal = v;
        continue;
      }
      const dd = v / peakVal - 1;
      if (!ep) ep = { peakIdx, valleyIdx: i, depth: dd, recoveryIdx: null };
      if (dd < ep.depth) { ep.depth = dd; ep.valleyIdx = i; }
    }
    if (ep) out.push(ep);
    const last = series.length - 1;
    return out
      .sort((a, b) => a.depth - b.depth)
      .slice(0, top)
      .map((e) => ({
        peak: series[e.peakIdx].d,
        valley: series[e.valleyIdx].d,
        recovery: e.recoveryIdx == null ? null : series[e.recoveryIdx].d,
        depth: e.depth,
        days: (e.recoveryIdx == null ? last : e.recoveryIdx) - e.peakIdx,
        toValleyDays: e.valleyIdx - e.peakIdx,
        recovered: e.recoveryIdx != null,
      }));
  }

  // 롤링 샤프·β (창 = window 거래일, step 간격으로 표본). pr·br 은 같은 날짜 정렬 수익률.
  function rollingStats(dates, pr, br, window = TRADING_DAYS, step = 5) {
    const out = [];
    const n = pr.length;
    if (n < window) return out;
    for (let end = window; end <= n; end += step) {
      const ps = pr.slice(end - window, end);
      const row = { d: dates[end], sharpe: sharpe(ps) };
      if (br && br.length >= end) row.beta = betaOf(ps, br.slice(end - window, end));
      out.push(row);
    }
    if (out.length && out[out.length - 1].d !== dates[n]) {
      const ps = pr.slice(n - window, n);
      const row = { d: dates[n], sharpe: sharpe(ps) };
      if (br && br.length >= n) row.beta = betaOf(ps, br.slice(n - window, n));
      out.push(row);
    }
    return out;
  }

  // 시뮬레이터 결과 → 티어시트. benchmark 는 같은 날짜로 정렬된 시리즈(없으면 빈 배열).
  function tearsheet(portfolio, benchmark) {
    if (!Array.isArray(portfolio) || portfolio.length < 22) return null;
    const dates = portfolio.map((p) => p.d);
    const pr = seriesReturns(portfolio);
    const hasB = Array.isArray(benchmark) && benchmark.length === portfolio.length;
    const br = hasB ? seriesReturns(benchmark) : null;
    const res = {
      start: dates[0],
      end: dates[dates.length - 1],
      days: pr.length,
      annualReturn: annualReturn(pr),
      annualVol: annualVolatility(pr),
      sharpe: sharpe(pr),
      sortino: sortino(pr),
      calmar: calmar(pr),
      maxDrawdown: maxDrawdown(pr),
      monthly: monthlyReturns(portfolio),
      yearly: yearlyReturns(portfolio),
      drawdowns: drawdownPeriods(portfolio, 5),
      rolling: rollingStats(dates, pr, br, TRADING_DAYS, 5),
      rollingWindow: TRADING_DAYS,
    };
    if (hasB) {
      const bAnn = annualReturn(br);
      const cap = captureRatios(pr, br);
      res.benchmark = {
        annualReturn: bAnn,
        annualVol: annualVolatility(br),
        sharpe: sharpe(br),
        maxDrawdown: maxDrawdown(br),
        beta: betaOf(pr, br),
        upCapture: cap.up,
        downCapture: cap.down,
        upDays: cap.upDays,
        downDays: cap.downDays,
        excessAnnual: res.annualReturn - bAnn,
        excessTotal: cumulativeReturns(pr).pop() - cumulativeReturns(br).pop(),
        yearly: yearlyReturns(benchmark),
      };
    }
    return res;
  }

  // ---------------------------------------------------------------- 과거 위기 재생
  function isoShift(iso, days) {
    const m = ISO_RE.exec(iso);
    if (!m) return iso;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
    return d.toISOString().slice(0, 10);
  }

  // 날짜→종가 Map 을 구간 달력에 맞춘 정규화 경로(첫날 = scale)로. 결측일은 직전 종가.
  // 첫 달력일(또는 그 직전 7일 안)에 가격이 없으면 null(= 그 구간엔 실측 불가).
  function pathFromMap(map, calendar, scale = 1000) {
    if (!calendar || !calendar.length || !map || !map.size) return null;
    const first = calendar[0];
    const lead = isoShift(first, -7);
    let base = null;
    let baseDate = "";
    map.forEach((c, d) => {
      if (d >= lead && d <= first && Number.isFinite(c) && c > 0 && d >= baseDate) { base = c; baseDate = d; }
    });
    if (base == null) return null;
    let inside = 0;
    let last = base;
    const out = calendar.map((d) => {
      const c = map.get(d);
      if (Number.isFinite(c) && c > 0) { last = c; inside += 1; }
      return (last / base) * scale;
    });
    if (inside < Math.max(3, calendar.length * 0.5)) return null;
    return out;
  }

  // OLS β (y = α + β x). n·R² 도 함께.
  function olsBeta(y, x) {
    const n = Math.min(y.length, x.length);
    if (n < 30) return null;
    const my = mean(y.slice(0, n));
    const mx = mean(x.slice(0, n));
    let sxy = 0; let sxx = 0; let syy = 0;
    for (let i = 0; i < n; i += 1) {
      sxy += (y[i] - my) * (x[i] - mx);
      sxx += (x[i] - mx) * (x[i] - mx);
      syy += (y[i] - my) * (y[i] - my);
    }
    if (!(sxx > 0)) return null;
    const beta = sxy / sxx;
    return { beta, n, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 0 };
  }

  // 두 Map(날짜→종가)의 공통일 수익률로 β 추정.
  function betaFromMaps(stockMap, proxyMap, maxDays = 756) {
    const { dates, closes } = alignCommon([stockMap, proxyMap]);
    let a = closes[0] || [];
    let b = closes[1] || [];
    if (dates.length > maxDays + 1) { a = a.slice(-maxDays - 1); b = b.slice(-maxDays - 1); }
    return olsBeta(simpleReturns(a), simpleReturns(b));
  }

  // 대리 경로: 지수 경로의 일별 수익률 × β 를 복리로 쌓는다(첫날 = scale).
  function proxyPath(indexPath, beta, scale = 1000) {
    if (!indexPath || !indexPath.length) return null;
    const out = [scale];
    for (let i = 1; i < indexPath.length; i += 1) {
      const r = indexPath[i - 1] > 0 ? indexPath[i] / indexPath[i - 1] - 1 : 0;
      out.push(out[i - 1] * Math.max(0, 1 + beta * r));
    }
    return out;
  }

  // 종목 경로(첫날 = scale)를 현재 비중으로 매수 후 보유했을 때의 포트폴리오 경로(첫날 = scale).
  function combinePaths(paths, weights, scale = 1000) {
    const len = paths.length ? paths[0].length : 0;
    const sum = weights.reduce((a, v) => a + v, 0) || 1;
    const out = [];
    for (let t = 0; t < len; t += 1) {
      let v = 0;
      for (let i = 0; i < paths.length; i += 1) v += (weights[i] / sum) * (paths[i][t] / scale);
      out.push(v * scale);
    }
    return out;
  }

  // 구간 통계: 기간 수익률, 구간 내 최대낙폭(시작값을 첫 고점으로), 최저점 날짜·수익률.
  function pathStats(path, calendar) {
    if (!path || path.length < 2) return null;
    const p0 = path[0];
    let peak = p0; let mdd = 0; let minIdx = 0;
    for (let i = 0; i < path.length; i += 1) {
      if (path[i] > peak) peak = path[i];
      mdd = Math.min(mdd, path[i] / peak - 1);
      if (path[i] < path[minIdx]) minIdx = i;
    }
    return {
      ret: path[path.length - 1] / p0 - 1,
      mdd,
      troughDate: calendar ? calendar[minIdx] : null,
      troughRet: path[minIdx] / p0 - 1,
    };
  }

  const api = {
    TRADING_DAYS,
    mean,
    std,
    simpleReturns,
    alignCommon,
    returnsMatrix,
    sampleCov,
    ledoitWolf,
    annualize,
    portfolioVol,
    riskContributions,
    riskParity,
    projectCappedSimplex,
    minVariance,
    fixedWeightReturns,
    annualVolatility,
    cumulativeReturns,
    maxDrawdown,
    outOfSample,
    analyzeAllocation,
    seriesReturns,
    annualReturn,
    sharpe,
    downsideRisk,
    sortino,
    calmar,
    betaOf,
    captureRatios,
    monthlyReturns,
    yearlyReturns,
    drawdownPeriods,
    rollingStats,
    tearsheet,
    pathFromMap,
    olsBeta,
    betaFromMaps,
    proxyPath,
    combinePaths,
    pathStats,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirPortfolioRiskCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
