/*
 * scripts/prob_calibration_worker.js
 * ----------------------------------
 * scripts/build_prob_calibration.py 가 띄우는 노드 워커.
 *
 * 왜 노드인가: "기술 점수" 는 analysis.js 의 buildSignals + patternSignals +
 * consensusProbability 가 만든다. 파이썬으로 다시 포팅하면 구현이 둘로 갈라지고
 * (지표 수학이 셋으로 갈라져 있던 게 이번 작업의 발단이다), 사이트가 보여주는 점수와
 * 캘리브레이션 표가 서로 다른 것을 재게 된다. 그래서 사이트가 쓰는 파일 그대로를
 * (indicators.js + pattern_detectors_extended.js + analysis.js) 노드에 올려
 * window.MirProb.technicalScoreRows() 를 호출한다 — 구현은 하나뿐이다.
 *
 * 룩어헤드 방지: 봉 i 의 점수는 rows.slice(0, i + 1) 만 넘겨 계산한다. 실현 수익률은
 * i + horizon 종가로만 재고, i + horizon 이 이력 밖이면 그 표본을 버린다.
 *
 * 입출력: stdin 으로 JSON 작업지시(파일 목록·샘플링 규칙)를 받고, stdout 으로
 * JSON 결과(버킷별 집계 원자료)를 낸다. 진행 로그는 stderr.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ---- 브라우저 전역 최소 shim ----------------------------------------------
// analysis.js 는 classic script 라 window/document 전역을 전제한다. 여기서 쓰는 것은
// window.MirProb 하나뿐이므로 DOM 은 흉내만 낸다(init 은 DOMContentLoaded 로만 불리고
// 우리는 그 이벤트를 발생시키지 않으므로 UI 코드는 실행되지 않는다).
global.window = global;
global.document = {
  readyState: "complete",
  currentScript: null,
  addEventListener() {},
  querySelector() { return null; },
  getElementById() { return null; },
};

require(path.join(ROOT, "indicators.js"));
require(path.join(ROOT, "pattern_detectors_extended.js"));
const MirProb = require(path.join(ROOT, "analysis.js"));

// ---- 작업지시 읽기 ---------------------------------------------------------
function readStdin() {
  return fs.readFileSync(0, "utf-8");
}

const job = JSON.parse(readStdin());
const horizons = job.horizons;            // 예: [5, 20, 60]
const buckets = job.buckets;              // 경계 배열, 예: [12,20,30,...,88]
const minBars = job.minBars;              // 점수 계산에 필요한 최소 봉 수
const stride = job.stride;                // 몇 봉마다 평가할지
const files = job.files;                  // [{market, ticker, path}]

// 시장별 통계 테이블(사이트가 쓰는 것과 동일 파일).
const statsCache = new Map();
function loadStats(market) {
  if (statsCache.has(market)) return statsCache.get(market);
  const base = market === "kr" ? path.join(ROOT, "data", "korea") : path.join(ROOT, "data");
  const read = (name) => {
    try { return JSON.parse(fs.readFileSync(path.join(base, name), "utf-8")); } catch (e) { return null; }
  };
  const entry = { patterns: read("pattern_stats.json"), breakouts: read("breakout_retest_stats.json") };
  statsCache.set(market, entry);
  return entry;
}

function bucketIndex(score) {
  if (!Number.isFinite(score)) return -1;
  for (let i = 0; i < buckets.length - 1; i += 1) {
    if (score >= buckets[i] && score < buckets[i + 1]) return i;
  }
  // 상한(클램프로 정확히 88이 나오는 경우)은 마지막 버킷에 넣는다.
  if (score >= buckets[buckets.length - 1]) return buckets.length - 2;
  return -1;
}

// 시장 × 호라이즌 × 버킷 누적기
const acc = {};
function accFor(market, horizon) {
  acc[market] = acc[market] || {};
  if (!acc[market][horizon]) {
    acc[market][horizon] = {
      buckets: buckets.slice(0, -1).map(() => ({ n: 0, up: 0, sumRet: 0 })),
      all: { n: 0, up: 0, sumRet: 0 },
    };
  }
  return acc[market][horizon];
}

const meta = { stocks: 0, skipped: 0, evals: 0, firstDate: null, lastDate: null };

function noteDate(d) {
  if (!d) return;
  if (!meta.firstDate || d < meta.firstDate) meta.firstDate = d;
  if (!meta.lastDate || d > meta.lastDate) meta.lastDate = d;
}

const maxHorizon = Math.max(...horizons);
let done = 0;

for (const f of files) {
  let detail;
  try {
    detail = JSON.parse(fs.readFileSync(f.path, "utf-8"));
  } catch (e) {
    meta.skipped += 1;
    continue;
  }
  const series = detail.chartSeries || [];
  if (series.length < minBars + maxHorizon + 10) { meta.skipped += 1; continue; }

  const rows = series.map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }))
    .filter((r) => Number.isFinite(r.c) && r.c > 0);
  if (rows.length < minBars + maxHorizon + 10) { meta.skipped += 1; continue; }

  const st = loadStats(f.market);
  MirProb.setOfflineStats(st.patterns, st.breakouts);

  meta.stocks += 1;
  const lastEval = rows.length - 1 - maxHorizon;
  for (let i = minBars - 1; i <= lastEval; i += stride) {
    const hist = rows.slice(0, i + 1);        // 봉 i 까지만 — 룩어헤드 없음
    noteDate(rows[i].d);
    for (const h of horizons) {
      const fwdIdx = i + h;
      if (fwdIdx >= rows.length) continue;    // 미래가 없는 봉은 버린다
      let score;
      try {
        const res = MirProb.technicalScoreRows(hist, h, { ticker: detail.ticker, dividends: detail.dividends });
        if (!res) continue;
        score = res.up;
      } catch (e) {
        continue;
      }
      const bi = bucketIndex(score);
      if (bi < 0) continue;
      const ret = rows[fwdIdx].c / rows[i].c - 1;
      const a = accFor(f.market, h);
      const cell = a.buckets[bi];
      cell.n += 1;
      cell.sumRet += ret;
      if (ret > 0) cell.up += 1;
      a.all.n += 1;
      a.all.sumRet += ret;
      if (ret > 0) a.all.up += 1;
      meta.evals += 1;
    }
  }
  done += 1;
  if (done % 10 === 0) process.stderr.write(`  ${done}/${files.length} 종목 · 평가 ${meta.evals}건\n`);
}

process.stdout.write(JSON.stringify({ acc, meta, buckets, horizons, stride, minBars }));
