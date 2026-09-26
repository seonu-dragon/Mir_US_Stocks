// 신호 성적표 순수 계산(signal-scorecard-core.js) 단위 테스트. 네트워크·DOM·파일 없음.
// 실행: node scripts/tests/test_signal_scorecard_core.mjs   (CI 의 "Signal scorecard tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../signal-scorecard-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failures.push(`${name}: ${err && err.message}`);
  }
}
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);
const ms = (iso) => Date.parse(iso);

// 평일 달력 + 종가/시가 시리즈. o = c 의 0.5% 아래로 둬서 '시가 진입'이 확인되게 한다.
function makeSeries(start, n, f) {
  const rows = [];
  let d = start;
  while (rows.length < n) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const c = f(rows.length);
      rows.push([c * 0.995, c, c, c, 1000, d]);
    }
    d = core.addDays(d, 1);
  }
  return core.seriesFromChart(rows);
}

// ---------------------------------------------------------------- 진입 기준일(룩어헤드 차단)
test("entryAfter US: 장 마감 뒤 기록이면 그날", () => {
  // 2026-09-26 06:30 KST = 09-25 17:30 EDT
  assert.equal(core.entryAfterFor("us", ms("2026-09-26T06:30:00+09:00")), "2026-09-25");
});
test("entryAfter US: 장중·장전 기록이면 전날", () => {
  assert.equal(core.entryAfterFor("us", ms("2026-09-25T12:00:00+09:00")), "2026-09-24");   // 09-24 23:00 EDT
  assert.equal(core.entryAfterFor("us", ms("2026-09-25T23:00:00+09:00")), "2026-09-24");   // 09-25 10:00 EDT(장중)
});
test("entryAfter US: 겨울(EST)도 뉴욕 현지 시각으로", () => {
  // 2026-12-01 06:30 KST = 11-30 16:30 EST → 마감 뒤
  assert.equal(core.entryAfterFor("us", ms("2026-12-01T06:30:00+09:00")), "2026-11-30");
  // 2026-12-01 05:30 KST = 11-30 15:30 EST → 장중
  assert.equal(core.entryAfterFor("us", ms("2026-12-01T05:30:00+09:00")), "2026-11-29");
});
test("entryAfter KR: 15:30 기준", () => {
  assert.equal(core.entryAfterFor("kr", ms("2026-09-22T16:30:00+09:00")), "2026-09-22");
  assert.equal(core.entryAfterFor("kr", ms("2026-09-22T10:00:00+09:00")), "2026-09-21");
});

// ---------------------------------------------------------------- 결과 계산
const series = makeSeries("2026-08-03", 40, (i) => 100 + i);   // 매일 +1
const bench = makeSeries("2026-08-03", 40, () => 50);          // 평탄

test("outcome: 진입은 max(bd, ea) 다음 첫 봉의 시가, 청산은 h번째 봉 종가", () => {
  const row = { bd: "2026-08-04", ea: "2026-08-05" };            // 기준일보다 기록이 늦으면 기록 기준
  const out = core.outcomeFor(row, series, bench, "2026-09-30", [5]);
  assert.equal(out[5].status, "done");
  assert.equal(out[5].entryDate, "2026-08-06");
  // 08-06 = index 3 → c=103, 시가 102.485 / 5번째 봉(index 7) 종가 107
  near(out[5].ret, 107 / (103 * 0.995) - 1, 1e-12);
  assert.equal(out[5].exitDate, "2026-08-12");
});
test("outcome: 벤치마크 대비 초과수익", () => {
  const out = core.outcomeFor({ bd: "2026-08-04", ea: "2026-08-04" }, series, bench, "2026-09-30", [5]);
  near(out[5].bret, 50 / (50 * 0.995) - 1, 1e-12);
  near(out[5].excess, out[5].ret - out[5].bret, 1e-15);
});
test("outcome: 기간이 안 차면 pending, 이력이 끊겼으면 stale", () => {
  const row = { bd: "2026-09-20", ea: "2026-09-20" };
  const lastDate = series.dates[series.dates.length - 1];
  const alive = core.outcomeFor(row, series, bench, core.addDays(lastDate, 2), [20]);
  assert.equal(alive[20].status, "pending");
  const dead = core.outcomeFor(row, series, bench, core.addDays(lastDate, 30), [20]);
  assert.equal(dead[20].status, "stale");
});
test("outcome: 가격 이력 없으면 noprice", () => {
  const out = core.outcomeFor({ bd: "2026-08-04", ea: "2026-08-04" }, null, bench, "2026-09-30");
  core.HORIZONS.forEach((h) => assert.equal(out[h].status, "noprice"));
});
test("seriesFromChart: 날짜 역순·중복·0가격 방어", () => {
  const s = core.seriesFromChart([[1, 1, 1, 10, 0, "2026-01-02"], [1, 1, 1, 0, 0, "2026-01-03"], [1, 1, 1, 11, 0, "2026-01-02"], [1, 1, 1, 12, 0, "2026-01-05"]]);
  assert.deepEqual(s.dates, ["2026-01-02", "2026-01-05"]);
});

// ---------------------------------------------------------------- 신호 추출(화면 규칙)
const snap = {
  priceDate: "2026-09-25",
  stocks: [
    { ticker: "AAA", price: 10, priceDate: "2026-09-25", marketCapB: 50, newHighDistancePct: 0.2, historySource: "yahoo", sector: "TECHNOLOGY" },
    { ticker: "BBB", price: 20, marketCapB: 30, newHighDistancePct: 0.4, historySource: "synthetic", sector: "TECHNOLOGY" },
    { ticker: "SPY", price: 500, marketCapB: 600, newHighDistancePct: 0, historySource: "yahoo", sector: "EXCHANGE TRADED FUNDS" },
    { ticker: "CCC", price: 30, marketCapB: 1, newHighDistancePct: 0.1, historySource: "yahoo", sector: "TECHNOLOGY" },
  ],
};
test("extract US: 52주 신고가 근접은 ETF·합성 이력·소형(20억$ 미만) 제외", () => {
  const out = core.extractSignals("us", { snapshot: snap });
  const hi = out.filter((x) => x.k === "high52").map((x) => x.t);
  assert.deepEqual(hi, ["AAA"]);
  assert.equal(out.find((x) => x.k === "high52").bd, "2026-09-25");
});
test("extract US: 내부자 클러스터는 서로 다른 임원 2인 이상 매수만", () => {
  const insider = { trades: [
    { ticker: "AAA", kind: "buy", owner: "x", value: 100, fileDate: "2026-09-20" },
    { ticker: "AAA", kind: "buy", owner: "y", value: 50, fileDate: "2026-09-22" },
    { ticker: "DDD", kind: "buy", owner: "x", value: 900 },
    { ticker: "DDD", kind: "buy", owner: "x", value: 900 },
    { ticker: "EEE", kind: "sell", owner: "a" }, { ticker: "EEE", kind: "sell", owner: "b" },
  ] };
  const out = core.extractSignals("us", { snapshot: snap, insider }).filter((x) => x.k === "insider_cluster");
  assert.deepEqual(out.map((x) => x.t), ["AAA"]);
  assert.equal(out[0].x.owners, 2);
  assert.equal(out[0].x.ev, "2026-09-22");
});
test("extract US: 8-K 는 hot 만, 공시 번호가 key", () => {
  const events = { events: [{ ticker: "AAA", hot: true, accession: "A1", fileDate: "2026-09-25" }, { ticker: "BBB", hot: false, accession: "A2" }] };
  const out = core.extractSignals("us", { snapshot: snap, events }).filter((x) => x.k === "material_8k");
  assert.equal(out.length, 1);
  assert.equal(out[0].key, "A1");
  assert.equal(out[0].p, 10);
});
test("extract: 팩터 순위는 검증 파일이 있을 때만(2026-09-04 이전 화면엔 없었다)", () => {
  const mk = (t, i) => ({ ticker: t, price: 10, marketCapB: 10, groups: ["idx_sp500"], historySource: "yahoo", sector: "X",
    newHighDistancePct: i, newHighDistance5yPct: i, closeSeries: Array.from({ length: 40 }, (_, k) => 100 + Math.sin(k * (i + 1)) * (i + 1)) });
  const s2 = { stocks: [mk("L1", 0), mk("L2", 1), mk("L3", 2)] };
  let out = core.extractSignals("us", { snapshot: s2 });
  assert.equal(out.filter((x) => x.k === "factor_low_vol").length, 0);
  assert.equal(out.filter((x) => x.k === "momentum_top").length, 3);
  const fv = { markets: { us: { horizons: { 5: { factors: { high52_prox: { validated: true }, low_vol: { validated: false } } }, 20: { factors: {} }, 60: { factors: {} } } } } };
  out = core.extractSignals("us", { snapshot: s2, factorValidation: fv });
  const low = out.filter((x) => x.k === "factor_low_vol");
  assert.equal(low[0].t, "L1");                       // 진폭이 가장 작은 종목이 1위
  assert.deepEqual(low[0].x.val, { 5: false, 20: false, 60: false });
  const hi = out.filter((x) => x.k === "factor_high52");
  assert.equal(hi[0].t, "L1");
  assert.equal(hi[0].x.val[5], true);
});
test("extract KR: 자사주는 취득·신탁체결·소각만, 해지·처분 제외", () => {
  assert.equal(core.isBuybackBuyTitle("주요사항보고서(자기주식취득결정)"), true);
  assert.equal(core.isBuybackBuyTitle("자기주식취득신탁계약체결결정"), true);
  assert.equal(core.isBuybackBuyTitle("주식소각결정(자기주식)"), true);
  assert.equal(core.isBuybackBuyTitle("자기주식취득신탁계약해지결정"), false);
  assert.equal(core.isBuybackBuyTitle("자기주식처분결정"), false);
});
test("extract KR: 시장경보 섹션 → 신호 종류, 상한가는 status ok 일 때만", () => {
  const krAlerts = { baseDate: "2026-09-23", sections: {
    warning: { status: "ok", rows: [{ ticker: "111111", noticeDate: "2026-09-23", designatedDate: "2026-09-28" }] },
    caution: { status: "ok", rows: [{ ticker: "222222", noticeDate: "2026-09-23", type: "투자경고 지정예고" }] },
    limitUp: { status: "carried", asOf: "2026-09-22", rows: [{ ticker: "333333", price: 1000 }] },
    valueSurge: { status: "ok", asOf: "2026-09-23", rows: [{ ticker: "444444", price: 500, changePct: 5 }] },
  } };
  const out = core.extractSignals("kr", { snapshot: { stocks: [] }, krAlerts });
  assert.deepEqual(out.map((x) => x.k).sort(), ["alert_caution", "alert_warning", "value_surge"]);
  assert.equal(out.find((x) => x.k === "value_surge").bd, "2026-09-23");
});
test("extract: 특징주는 시장이 다르면 무시, 거래일|티커가 key", () => {
  const movers = { market: "us", tradeDate: "2026-09-25", up: [{ ticker: "AAA", close: 11, changePct: 12.3 }], down: [] };
  assert.equal(core.extractSignals("kr", { snapshot: { stocks: [] }, movers }).length, 0);
  const out = core.extractSignals("us", { snapshot: { stocks: [] }, movers });
  assert.equal(out[0].k, "movers_up");
  assert.equal(out[0].key, "2026-09-25|AAA");
  assert.equal(out[0].p, 11);
});

// ---------------------------------------------------------------- 원장 중복 처리
test("selectNewRows: 사건 신호는 key 로 한 번만, 오래된 사건은 제외", () => {
  const ctx = { market: "us", d: "2026-09-26", at: "x", ea: "2026-09-25", src: "live" };
  const existing = [{ m: "us", k: "material_8k", t: "AAA", d: "2026-09-25", key: "A1" }];
  const { rows, skipped } = core.selectNewRows([
    { k: "material_8k", t: "AAA", key: "A1", ev: "2026-09-25" },
    { k: "material_8k", t: "AAA", key: "A2", ev: "2026-09-25" },
    { k: "material_8k", t: "AAA", key: "A2", ev: "2026-09-25" },   // 같은 실행 안의 중복
    { k: "material_8k", t: "ZZZ", key: "A3", ev: "2026-09-01" },   // 25일 전 공시
  ], existing, ctx);
  assert.deepEqual(rows.map((r) => r.key), ["A2"]);
  assert.equal(skipped.seen, 2);
  assert.equal(skipped.old, 1);
  assert.equal(rows[0].ea, "2026-09-25");
  assert.equal(rows[0].x.ev, "2026-09-25");
});
test("selectNewRows: 상태 신호는 쿨다운 안의 재등장을 세지 않는다", () => {
  const ctx = { market: "us", d: "2026-09-26", at: "x", ea: "2026-09-25", src: "live" };
  const existing = [
    { m: "us", k: "high52", t: "AAA", d: "2026-09-10" },   // 16일 전 → 쿨다운(28일) 안
    { m: "us", k: "high52", t: "BBB", d: "2026-08-01" },   // 56일 전 → 다시 센다
    { m: "kr", k: "high52", t: "CCC", d: "2026-09-25" },   // 다른 시장은 무관
  ];
  const { rows } = core.selectNewRows([{ k: "high52", t: "AAA" }, { k: "high52", t: "BBB" }, { k: "high52", t: "CCC" }, { k: "nope", t: "X" }], existing, ctx);
  assert.deepEqual(rows.map((r) => r.t), ["BBB", "CCC"]);
});

// ---------------------------------------------------------------- 통계
test("summarize: 표본 30 미만은 판단 보류", () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({ d: `2026-08-${String(i + 1).padStart(2, "0")}`, out: { 5: { status: "done", ret: 0.05, excess: 0.03 } } }));
  const s = core.summarize(entries, [5]);
  assert.equal(s[5].n, 10);
  assert.equal(s[5].verdict, "hold");
  near(s[5].meanExcess, 3, 1e-9);
  assert.equal(s[5].winRate, 1);
});
test("summarize: 전부 양(+)이면 상회, 전부 음(−)이면 하회, 대기·가격없음은 따로 센다", () => {
  const mk = (sign) => Array.from({ length: 40 }, (_, i) => ({ d: `2026-08-${String((i % 20) + 1).padStart(2, "0")}`, out: { 20: { status: "done", ret: sign * (0.01 + i / 1000), excess: sign * (0.01 + i / 1000) } } }));
  const pos = core.summarize([...mk(1), { d: "2026-09-01", out: { 20: { status: "pending" } } }, { d: "2026-09-01", out: { 20: { status: "noprice" } } }], [20]);
  assert.equal(pos[20].verdict, "positive");
  assert.equal(pos[20].pending, 1);
  assert.equal(pos[20].noprice, 1);
  assert.equal(pos[20].n, 40);
  assert.ok(pos[20].ciLo > 0 && pos[20].ciHi > pos[20].ciLo);
  assert.equal(core.summarize(mk(-1), [20])[20].verdict, "negative");
});
test("clusterBootstrapMean: 같은 시드면 같은 구간, 발행일 1개면 구간 없음", () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ d: `d${i % 12}`, v: (i % 7) - 3 }));
  assert.deepEqual(core.clusterBootstrapMean(items, { seed: 1 }), core.clusterBootstrapMean(items, { seed: 1 }));
  const one = core.clusterBootstrapMean([{ d: "a", v: 1 }, { d: "a", v: 2 }]);
  assert.equal(one.lo, null);
});
test("verdictFor: 구간이 0 을 걸치면 차이 불분명", () => {
  assert.equal(core.verdictFor(50, -0.01, 0.02), "unclear");
  assert.equal(core.verdictFor(29, 0.01, 0.02), "hold");
});
test("카탈로그: 시장+종류가 유일하고 사건 신호가 아니면 쿨다운이 있다", () => {
  const seen = new Set();
  core.KINDS.forEach((k) => {
    const id = `${k.m}:${k.k}`;
    assert.ok(!seen.has(id), `중복 ${id}`);
    seen.add(id);
    assert.ok(k.keyed || k.cooldownDays > 0, `${id} 쿨다운 없음`);
  });
});

if (failures.length) {
  console.error(`signal scorecard core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`signal scorecard core: ${passed}개 통과`);
