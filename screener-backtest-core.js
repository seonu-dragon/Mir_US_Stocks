// 수식 스크리너 과거 백테스트 — 순수 계산(DOM·네트워크 없음). 브라우저 window.MirScreenerBacktestCore,
// node 테스트(scripts/tests/test_screener_backtest_core.mjs) module.exports.
//
// 패널(scripts/build_screener_backtest_panel.mjs 산출물)
//   meta: { dates[K](신호일 = 월말), execDates[K](체결일 = 다음 거래일), tickers[n], sectors[n], industries[n],
//           benchmarkFwd[K], fields: { key: { coverage[K], maxCoverage, scale } }, version, periodsPerYear }
//   샤드: { field, version, scale, rows[n] (각 행 = 길이 K 정수 배열 | null) }
//   fwd 샤드: 기간 k 수익률 = 종가(e_{k+1}) / 종가(e_k) − 1. null = 체결일 e_k 에 봉이 없어 살 수 없음.
//
// 시점 규칙(룩어헤드 방지): 기간 k 의 편입 여부는 **k 시점 필드 값만**으로 정하고, 그 편입의 손익은 fwd_k 로만
// 계산한다. fwd 는 신호에 절대 쓰지 않는다. 필드 값 자체는 빌더가 d_k 종가까지의 봉 / 제출일 다음 날 이후의
// 재무만으로 만들었다.
//
// 포트폴리오: 통과 종목 동일가중, 매월 리밸런싱. 통과 종목이 minStocks 미만인 달은 전액 현금(수익 0).
// 거래비용: 매매한 비중 × 편도 비용률(매수·매도 각각). 첫 달 매수 비용 포함, 마지막 청산 비용은 넣지 않는다.
(function (root) {
  "use strict";

  const DEFAULTS = { costRate: 0.001, minStocks: 5, coverageFrac: 0.6 };

  function decodeShard(shard, nTickers, K) {
    if (!shard || !Array.isArray(shard.rows)) throw new Error("샤드 형식이 올바르지 않습니다.");
    if (shard.rows.length !== nTickers) throw new Error(`샤드 종목 수(${shard.rows.length})가 메타(${nTickers})와 다릅니다.`);
    const scale = Number(shard.scale) || 1;
    const out = new Float64Array(nTickers * K).fill(NaN);
    for (let t = 0; t < nTickers; t++) {
      const row = shard.rows[t];
      if (row == null) continue;
      if (!Array.isArray(row) || row.length !== K) throw new Error(`샤드 행 길이가 기간 수(${K})와 다릅니다.`);
      for (let k = 0; k < K; k++) {
        const v = row[k];
        if (v != null && Number.isFinite(v)) out[t * K + k] = v / scale;
      }
    }
    return out;
  }

  // 수식에 쓰인 필드 중 패널에 없는 것(= 과거 값이 없어 백테스트 불가).
  function missingFields(compiled, meta) {
    const have = (meta && meta.fields) || {};
    return (compiled && Array.isArray(compiled.fields) ? compiled.fields : []).filter((f) => !have[f]);
  }

  // 시작 시점: 쓰인 필드마다 그 시점 커버리지가 평소(중앙값)의 coverageFrac 이상이 되는 첫 k.
  // (52주 필드는 첫 해, 재무 필드는 제출일 이전 구간에 값이 적다 — 이 구간을 빼야 공정하다.)
  // 커버리지는 '그 시점 편입 가능 종목 대비 비율'로 본다(유니버스 자체가 시간에 따라 커지므로).
  // 편입 가능 종목 수가 최대치의 절반도 안 되는 초기 구간도 뺀다.
  function startIndex(meta, fields, coverageFrac = DEFAULTS.coverageFrac) {
    const K = meta.dates.length;
    const tr = Array.isArray(meta.tradeable) && meta.tradeable.length === K ? meta.tradeable : null;
    let start = 0;
    if (tr) {
      const maxTr = Math.max(...tr);
      while (start < K && !(tr[start] >= maxTr * 0.5 && tr[start] > 0)) start++;
    }
    for (const f of fields) {
      const fm = meta.fields[f];
      if (!fm) continue;
      const ratio = fm.coverage.map((c, k) => (tr ? (tr[k] > 0 ? c / tr[k] : 0) : c));
      // 기준 = 값이 있는 시점들의 커버리지 중앙값 × coverageFrac. 최댓값을 쓰면 끝 무렵 한 달의 튐에 끌려간다.
      const pos = ratio.filter((r) => r > 0).sort((a, b) => a - b);
      const med = pos.length ? pos[Math.floor((pos.length - 1) / 2)] : 0;
      const need = med * coverageFrac;
      let k = 0;
      while (k < K && !(ratio[k] >= need && ratio[k] > 0)) k++;
      start = Math.max(start, k);
    }
    return start;
  }

  // ---------- 성과 요약 ----------
  function summarize(returns, periodsPerYear = 12) {
    const r = returns.filter(Number.isFinite);
    const n = r.length;
    if (!n) return { months: 0, total: null, cagr: null, vol: null, sharpe: null, mdd: null };
    let g = 1, peak = 1, mdd = 0;
    for (const x of r) {
      g *= 1 + x;
      if (g > peak) peak = g;
      mdd = Math.min(mdd, g / peak - 1);
    }
    const m = r.reduce((s, x) => s + x, 0) / n;
    const sd = n > 1 ? Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : null;
    return {
      months: n,
      total: g - 1,
      cagr: g > 0 ? g ** (periodsPerYear / n) - 1 : -1,
      vol: sd == null ? null : sd * Math.sqrt(periodsPerYear),
      sharpe: sd ? (m / sd) * Math.sqrt(periodsPerYear) : null,
      mdd,
    };
  }
  function cumulative(returns) {
    let g = 1;
    return returns.map((x) => { if (Number.isFinite(x)) g *= 1 + x; return g; });
  }

  // 한 기간 리밸런싱: 이전 드리프트 비중 → 새 비중. 반환 { trade, cost, gross, net, drift }
  function rebalance(prevDrift, targetIdx, fwdAt, costRate) {
    const n = targetIdx.length;
    const w = n ? 1 / n : 0;
    const target = new Map();
    for (const i of targetIdx) target.set(i, w);
    let trade = 0;
    target.forEach((wt, i) => { trade += Math.abs(wt - (prevDrift.get(i) || 0)); });
    prevDrift.forEach((wt, i) => { if (!target.has(i)) trade += Math.abs(wt); });
    let gross = 0;
    target.forEach((wt, i) => { gross += wt * fwdAt(i); });
    const cost = trade * costRate;
    const net = (1 - cost) * (1 + gross) - 1;
    const drift = new Map();
    if (1 + gross > 0) target.forEach((wt, i) => { drift.set(i, (wt * (1 + fwdAt(i))) / (1 + gross)); });
    return { trade, cost, gross, net, drift };
  }

  // opts: { meta, columns: {field: Float64Array}, fwd: Float64Array, compiled, formulaCore,
  //         costRate, minStocks, start(선택), end(선택, 포함 안 함) }
  function run(opts) {
    const { meta, columns, fwd, compiled, formulaCore } = opts;
    if (!meta || !fwd || !compiled || !compiled.ok || !formulaCore) throw new Error("백테스트 입력이 부족합니다.");
    const K = meta.dates.length;
    const nT = meta.tickers.length;
    const costRate = Number.isFinite(opts.costRate) ? Math.max(0, opts.costRate) : DEFAULTS.costRate;
    const minStocks = Number.isFinite(opts.minStocks) ? Math.max(1, Math.floor(opts.minStocks)) : DEFAULTS.minStocks;
    const ppy = meta.periodsPerYear || 12;
    const start = Number.isFinite(opts.start) ? opts.start : startIndex(meta, compiled.fields);
    const end = Number.isFinite(opts.end) ? Math.min(K, opts.end) : K;
    const missing = missingFields(compiled, meta);
    if (missing.length) throw new Error(`과거 값이 없는 필드: ${missing.join(", ")}`);

    const usedFields = compiled.fields.slice();
    const periods = [];
    let drift = new Map();
    let ewDrift = new Map();
    for (let k = start; k < end; k++) {
      // k 시점 유니버스 = 체결일 e_k 에 살 수 있는 종목(fwd 가 있는 종목). 그룹·전체 집계의 모집단도 이것.
      const rows = [];
      for (let t = 0; t < nT; t++) if (Number.isFinite(fwd[t * K + k])) rows.push(t);
      const fwdAt = (t) => fwd[t * K + k];
      // 신호: k 시점 필드만. (fwd 는 여기서 읽지 않는다)
      const ctx = {
        get: (t, name) => { const col = columns[name]; if (!col) return null; const v = col[t * K + k]; return Number.isFinite(v) ? v : null; },
        group: (t, g) => (g === "sector" ? meta.sectors[t] : g === "industry" ? meta.industries[t] : null),
      };
      const vals = formulaCore.evaluate(compiled, rows, ctx);
      const pass = [];
      vals.forEach((v, j) => { if (v === true) pass.push(rows[j]); });
      const invested = pass.length >= minStocks;
      const st = rebalance(drift, invested ? pass : [], fwdAt, costRate);
      drift = st.drift;
      // 비교 기준(같은 유니버스 동일가중) = 이 시점에 수식에 쓰인 필드 값이 모두 있는 종목 전체.
      // 재무 필드는 현재 재무 파일이 있는 종목(= 지금 살아남은 큰 회사)에만 있어서, 전 종목과 비교하면
      // 필터가 아니라 '재무 데이터가 있다'는 사실만으로 초과수익이 생긴다. 같은 모집단과 비교해 그 편향을 뺀다.
      const eligible = usedFields.length ? rows.filter((t) => usedFields.every((f) => { const col = columns[f]; return col && Number.isFinite(col[t * K + k]); })) : rows;
      const ew = rebalance(ewDrift, eligible, fwdAt, costRate);
      ewDrift = ew.drift;
      const b = meta.benchmarkFwd ? meta.benchmarkFwd[k] : null;
      periods.push({
        k, date: meta.dates[k], execDate: meta.execDates ? meta.execDates[k] : null,
        universe: rows.length, eligible: eligible.length, passed: pass.length, held: invested ? pass.length : 0, cash: !invested,
        trade: st.trade, turnover: st.trade / 2, cost: st.cost, gross: st.gross, net: st.net,
        ewNet: ew.net, ewTurnover: ew.trade / 2, bench: Number.isFinite(b) ? b : null,
      });
    }
    const net = periods.map((p) => p.net);
    const ewNet = periods.map((p) => p.ewNet);
    const bench = periods.map((p) => (p.bench == null ? NaN : p.bench));
    const excess = periods.map((p) => p.net - p.ewNet);
    const investedP = periods.filter((p) => !p.cash);
    const avgHoldings = investedP.length ? investedP.reduce((s, p) => s + p.held, 0) / investedP.length : 0;
    const avgTurnover = periods.length ? periods.reduce((s, p) => s + p.turnover, 0) / periods.length : 0;
    return {
      start, end, months: periods.length, costRate, minStocks,
      startDate: periods.length ? periods[0].execDate || periods[0].date : null,
      endDate: periods.length ? (end < K && meta.execDates ? meta.execDates[end] : meta.periodEnd) || null : null,
      periods,
      series: { strategy: cumulative(net), ew: cumulative(ewNet), bench: cumulative(bench) },
      metrics: {
        strategy: { ...summarize(net, ppy), avgHoldings, cashMonths: periods.length - investedP.length,
          turnoverMonthly: avgTurnover, turnoverAnnual: avgTurnover * ppy, totalCost: periods.reduce((s, p) => s + p.cost, 0) },
        ew: { ...summarize(ewNet, ppy), avgHoldings: periods.length ? periods.reduce((s, p) => s + p.eligible, 0) / periods.length : 0,
          avgUniverse: periods.length ? periods.reduce((s, p) => s + p.universe, 0) / periods.length : 0 },
        bench: { ...summarize(bench, ppy), missingMonths: bench.filter((x) => !Number.isFinite(x)).length },
      },
      excess,
    };
  }

  // 결과 서술(매매 권유 없음 — 숫자 서술만).
  function describe(res, labels = {}) {
    const s = res.metrics.strategy, e = res.metrics.ew;
    const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
    return `${res.startDate || ""}~${res.endDate || ""} ${res.months}개월 동안 이 조건의 연환산 수익률은 ${pct(s.cagr)}, `
      + `같은 유니버스 동일가중은 ${pct(e.cagr)}였습니다(${labels.cost || "거래비용 반영"}, 배당 제외). `
      + `평균 ${s.avgHoldings.toFixed(1)}종목을 보유했고 현금으로 있던 달은 ${s.cashMonths}개월입니다.`;
  }

  // 시도 기록 키(같은 수식·같은 설정이면 같은 시도).
  function trialKey(market, source, costRate, minStocks) {
    return `${market}|${String(source || "").replace(/\s+/g, " ").trim().toLowerCase()}|${costRate}|${minStocks}`;
  }

  const api = { DEFAULTS, decodeShard, missingFields, startIndex, summarize, cumulative, rebalance, run, describe, trialKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirScreenerBacktestCore = api;
})(typeof window !== "undefined" ? window : null);
