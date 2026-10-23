// 거래 원장 2단계(ledger-perf-core.js) 단위 테스트 — TWR·XIRR·배당 제안·분할 제안. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_ledger_perf_core.mjs   (CI 의 "Ledger perf core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const P = require("../../ledger-perf-core.js");
const L = require("../../ledger-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const near = (a, b, msg, eps = 1e-6) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

let n = 0;
function tx(type, date, qty, price, extra = {}) {
  n += 1;
  return L.normalizeTx({ id: `t${n}`, type, ticker: extra.ticker || "AAA", date, qty, price, ...extra }, "us");
}
const bars = (pairs) => pairs.map(([date, close]) => ({ date, close }));
const one = (txs, b, opts) => P.performance([{ ticker: "AAA", txs, bars: b }], opts);
function daily(fromUtc, toUtc, priceOf) {
  const out = [];
  for (let d = fromUtc; d <= toUtc; d += 86400000) {
    const iso = new Date(d).toISOString().slice(0, 10);
    out.push([iso, priceOf(iso)]);
  }
  return bars(out);
}

test("TWR: 체결가로 구간을 나누면 중간 추가 매수와 무관하게 가격 수익률과 같다", () => {
  // 100 → 110 → 121 → 133.1 (매일 +10%). 1일 10주@100, 3일 10주@121(그날 종가), 4일 전량 매도@133.1
  const b = bars([["2026-01-05", 100], ["2026-01-06", 110], ["2026-01-07", 121], ["2026-01-08", 133.1]]);
  const r = one([tx("buy", "2026-01-05", 10, 100), tx("buy", "2026-01-07", 10, 121), tx("sell", "2026-01-08", 20, 133.1)], b);
  near(r.twr.ALL, 33.1, "ALL", 1e-9);
  assert.equal(r.endDate, "2026-01-08");
});

test("TWR: 장중 체결가 ≠ 전날 종가여도 체결 시점에서 구간 분할(전날 110 → 체결 121 → 종가 121)", () => {
  const b = bars([["2026-01-05", 100], ["2026-01-06", 110], ["2026-01-07", 121]]);
  const r = one([tx("buy", "2026-01-05", 10, 100), tx("buy", "2026-01-07", 10, 121)], b);
  near(r.twr.ALL, 21, "ALL", 1e-9);
});

test("TWR: 매수 수수료는 수익률에서 빠진다", () => {
  const b = bars([["2026-01-05", 100], ["2026-01-06", 100]]);
  const r = one([tx("buy", "2026-01-05", 10, 100, { fee: 10 })], b);
  near(r.twr.ALL, (1000 / 1010 - 1) * 100, "fee", 1e-9);
});

test("TWR: 받은 배당(세후)은 수익(유출)으로 들어간다", () => {
  const b = bars([["2026-01-05", 100], ["2026-01-06", 100]]);
  const r = one([tx("buy", "2026-01-05", 10, 100), tx("dividend", "2026-01-06", 0, 60, { tax: 10 })], b);
  near(r.twr.ALL, 5, "div net 50 / 1000", 1e-9);
});

test("TWR: 기간 — 기간 시작 종가 기준, 첫 거래가 기간 시작보다 늦으면 '짧음'", () => {
  const b = daily(Date.UTC(2025, 11, 1), Date.UTC(2026, 0, 30), (iso) => (iso < "2025-12-31" ? 100 : 120));
  const r = one([tx("buy", "2025-12-01", 1, 100)], b);
  near(r.twr["1M"], 0, "1M: 12-31 이후 변동 없음", 1e-9);
  near(r.twr.YTD, 0, "YTD: 12-31 종가 120 → 120", 1e-9);
  near(r.twr.ALL, 20, "ALL", 1e-9);
  assert.equal(r.twr["1Y"], null);
  assert.equal(r.why["1Y"], "short");
});

test("TWR: 봉이 비면(10일 넘는 공백) 그 구간이 걸린 기간은 null", () => {
  const b = bars([["2026-01-05", 100], ["2026-01-06", 100], ["2026-01-30", 110], ["2026-01-31", 110]]);
  const r = one([tx("buy", "2026-01-05", 1, 100)], b);
  assert.equal(r.twr.ALL, null);
  assert.equal(r.why.ALL, "nodata");
});

test("TWR: 첫 거래가 봉 시작 전이면 전체는 null, 기간 시작이 봉 안이면 계산", () => {
  const b = daily(Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 15), () => 100);
  const r = one([tx("buy", "2025-06-01", 1, 90)], b);
  assert.equal(r.twr.ALL, null);
  near(r.twr["1M"], 0, "1M");
  assert.equal(r.twr["3M"], null, "3M 시작(11월)이 봉 전");
});

test("TWR: 날짜 모르는 시작 잔고 → 전체·XIRR 은 null, 기간은 계산", () => {
  const b = daily(Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 15), (iso) => (iso >= "2026-02-01" ? 110 : 100));
  const open = L.openingFromHolding({ ticker: "AAA", qty: 5, avgCost: 80 }, "us");
  const r = one([open], b);
  assert.equal(r.twr.ALL, null);
  assert.equal(r.why.ALL, "undated");
  assert.equal(r.xirr, null);
  near(r.twr["1M"], 10, "1M: 01-16 100 → 110");
});

test("TWR: 수정 종가 + 분할 기록 → 분할 전후 평가액이 이어진다(0%)", () => {
  // 실제 종가 100 → 분할(4:1) 뒤 25. 상세 일봉은 소급 수정 → 전부 25.
  const adj = bars([["2026-01-05", 25], ["2026-01-06", 25], ["2026-01-07", 25], ["2026-01-08", 25]]);
  const splits = [["2026-01-07", 4, 1]];
  const txs = [tx("buy", "2026-01-05", 10, 100), tx("split", "2026-01-07", 0, 0, { ratio: 4 })];
  const raw = P.rawCloses(adj, P.effectiveSplits(splits, txs));
  assert.equal(raw[0].close, 100);
  assert.equal(raw[2].close, 25);
  const r = one(txs, raw);
  near(r.twr.ALL, 0, "split ALL");
  near(r.value, 1000, "평가액 = 40주 × 25");
});

test("TWR: 포트폴리오 — 두 종목 합산, 한 종목 일봉이 없으면 null", () => {
  const ba = bars([["2026-01-05", 100], ["2026-01-06", 110]]);
  const bb = bars([["2026-01-05", 50], ["2026-01-06", 50]]);
  const ta = [tx("buy", "2026-01-05", 10, 100)];
  const tb = [tx("buy", "2026-01-05", 20, 50, { ticker: "BBB" })];
  const r = P.performance([{ ticker: "AAA", txs: ta, bars: ba }, { ticker: "BBB", txs: tb, bars: bb }]);
  near(r.twr.ALL, 5, "(1100+1000)/2000");
  const r2 = P.performance([{ ticker: "AAA", txs: ta, bars: ba }, { ticker: "BBB", txs: tb, bars: [] }]);
  assert.equal(r2.twr.ALL, null);
});

test("TWR: 마지막 봉 뒤 거래는 기간 밖(종가 기준일까지만)", () => {
  const b = bars([["2026-01-05", 100], ["2026-01-06", 110]]);
  const r = one([tx("buy", "2026-01-05", 10, 100), tx("buy", "2026-01-09", 10, 120)], b);
  near(r.twr.ALL, 10, "ALL");
  assert.equal(r.endDate, "2026-01-06");
});

test("XIRR: 1년(365일) 뒤 +10% → 10%", () => {
  const b = daily(Date.UTC(2025, 0, 1), Date.UTC(2026, 0, 1), (iso) => (iso === "2026-01-01" ? 110 : 100));
  const r = one([tx("buy", "2025-01-01", 10, 100)], b);
  near(r.xirr, 10, "xirr", 1e-6);
  near(r.twr.ALL, 10, "twr");
});

test("XIRR: 중간 매수·배당 포함 — 해에서 NPV ≈ 0", () => {
  const b = bars([["2025-01-02", 100], ["2025-07-01", 105], ["2026-01-02", 120]]);
  const txs = [tx("buy", "2025-01-02", 10, 100), tx("buy", "2025-07-01", 10, 105), tx("dividend", "2025-10-01", 0, 20)];
  const r = one(txs, b);
  const flows = [[-1000, "2025-01-02"], [-1050, "2025-07-01"], [20, "2025-10-01"], [2400, "2026-01-02"]];
  const t0 = Date.UTC(2025, 0, 2);
  const npv = flows.reduce((s, [a, d]) => s + a / Math.pow(1 + r.xirr / 100, (Date.parse(`${d}T00:00:00Z`) - t0) / 86400000 / 365), 0);
  assert.ok(Math.abs(npv) < 1e-4, `npv ${npv}`);
  assert.ok(r.xirr > 10 && r.xirr < 25, `xirr ${r.xirr}`);
});

test("XIRR: 30일 미만이면 null(연환산 과장 방지)", () => {
  const b = bars([["2026-01-05", 100], ["2026-01-20", 110]]);
  const r = one([tx("buy", "2026-01-05", 1, 100)], b);
  assert.equal(r.xirr, null);
  assert.equal(r.xirrWhy, "short");
});

test("배당 제안: 배당락 전날 보유 수량 × 주당, 기록·무시·미래·보유 전은 제외", () => {
  const txs = [
    tx("buy", "2026-01-05", 10, 100),
    tx("sell", "2026-04-01", 4, 110),
    tx("dividend", "2026-08-20", 0, 1.5, { exDate: "2026-08-10" }),
  ];
  const dividends = [["2025-11-07", 0.24], ["2026-02-06", 0.25], ["2026-05-08", 0.26], ["2026-08-10", 0.25], ["2026-11-07", 0.27]];
  const s = P.dividendSuggestions({ ticker: "AAA", txs, dividends, splits: [], today: "2026-10-23" });
  assert.deepEqual(s.map((x) => x.exDate), ["2026-02-06", "2026-05-08"]);
  near(s[0].amount, 2.5, "10주 × 0.25");
  near(s[1].amount, 1.56, "6주 × 0.26");
  assert.ok(s.every((x) => x.estimated));
  const s2 = P.dividendSuggestions({ ticker: "AAA", txs, dividends, splits: [], today: "2026-10-23", dismissed: new Set(["AAA|div|2026-02-06"]) });
  assert.deepEqual(s2.map((x) => x.exDate), ["2026-05-08"]);
});

test("배당 제안: exDate 없는 기록도 배당락 ~ +60일 안이면 기록된 것 · 배당락 당일 매수는 제외", () => {
  const txs = [tx("buy", "2026-02-06", 10, 100), tx("dividend", "2026-06-01", 0, 2.6)];
  const s = P.dividendSuggestions({ ticker: "AAA", txs, dividends: [["2026-02-06", 0.25], ["2026-05-08", 0.26]], today: "2026-10-23" });
  assert.deepEqual(s, []);
});

test("배당 제안: 상세 배당은 분할 소급 → 분할 전 배당락은 그때 주식 수 기준 주당으로 되돌린다", () => {
  const txs = [tx("buy", "2026-01-05", 10, 100), tx("split", "2026-03-02", 0, 0, { ratio: 4 })];
  const s = P.dividendSuggestions({ ticker: "AAA", txs, dividends: [["2026-02-06", 0.25], ["2026-05-08", 0.25]], splits: [["2026-03-02", 4, 1]], today: "2026-10-23" });
  near(s[0].dps, 1, "분할 전 주당 0.25×4");
  near(s[0].amount, 10, "10주 × 1");
  near(s[1].amount, 10, "40주 × 0.25");
});

test("배당 제안: 기록하지 않은 분할 뒤 배당락은 제안하지 않는다(원장 수량이 분할 전)", () => {
  const txs = [tx("buy", "2024-01-05", 2, 500)];
  const dividends = [["2024-03-05", 0.04], ["2024-09-05", 0.01]];
  const s = P.dividendSuggestions({ ticker: "AAA", txs, dividends, splits: [["2024-06-10", 10, 1]], today: "2026-10-23" });
  assert.deepEqual(s.map((x) => x.exDate), ["2024-03-05"]);
  near(s[0].amount, 2 * 0.4, "분할 전 주당 0.04×10");
  const s2 = P.dividendSuggestions({ ticker: "AAA", txs: [...txs, tx("split", "2024-06-10", 0, 0, { ratio: 10 })], dividends, splits: [["2024-06-10", 10, 1]], today: "2026-10-23" });
  assert.deepEqual(s2.map((x) => x.exDate), ["2024-03-05", "2024-09-05"]);
  near(s2[1].amount, 20 * 0.01, "분할 뒤 20주");
});

test("분할 제안: 첫 거래 뒤·보유 중·미기록만, 병합(1:10)도", () => {
  const txs = [tx("buy", "2024-01-05", 10, 100)];
  const splits = [["2021-07-20", 4, 1], ["2024-06-10", 10, 1], ["2025-05-22", 1, 10]];
  const s = P.splitSuggestions({ ticker: "AAA", txs, splits, today: "2026-10-23" });
  assert.deepEqual(s.map((x) => [x.date, x.ratio]), [["2024-06-10", 10], ["2025-05-22", 0.1]]);
  const s2 = P.splitSuggestions({ ticker: "AAA", txs: [...txs, tx("split", "2024-06-11", 0, 0, { ratio: 10 })], splits, today: "2026-10-23" });
  assert.deepEqual(s2.map((x) => x.date), ["2025-05-22"]);
  const s3 = P.splitSuggestions({ ticker: "AAA", txs: [tx("buy", "2024-01-05", 10, 100), tx("sell", "2024-03-01", 10, 100)], splits, today: "2026-10-23" });
  assert.deepEqual(s3, [], "분할 전 전량 매도");
});

test("배당 합계: 연도·종목별 세전·원천징수·세후", () => {
  const txs = [
    tx("dividend", "2026-02-14", 0, 10, { tax: 1.5 }),
    tx("dividend", "2026-05-14", 0, 12, { tax: 1.8, ticker: "BBB" }),
    tx("dividend", "2025-11-14", 0, 9, { tax: 1.35 }),
  ];
  const t = P.dividendTotals(txs, "2026");
  near(t.gross, 22); near(t.tax, 3.3); near(t.net, 18.7);
  assert.equal(t.count, 2);
  near(t.byTicker.AAA.gross, 10);
});

test("normalizeTx: 배당 exDate 보존, 다른 구분엔 없음", () => {
  assert.equal(L.normalizeTx({ type: "dividend", ticker: "a", date: "2026-02-14", price: 1, exDate: "2026-02-06" }, "us").exDate, "2026-02-06");
  assert.equal(L.normalizeTx({ type: "buy", ticker: "a", date: "2026-02-14", qty: 1, price: 1, exDate: "2026-02-06" }, "us").exDate, undefined);
});

test("chartSeries 정규화: [o,h,l,c,v,date] → 날짜순·중복 제거", () => {
  const b = P.normBars([[1, 2, 0.5, 1.5, 10, "2026-01-06"], [1, 2, 0.5, 1.2, 10, "2026-01-05"], [1, 2, 0.5, 1.2, 10, "2026-01-05"], [1, 2, 0.5, null, 10, "2026-01-07"]]);
  assert.deepEqual(b, [{ date: "2026-01-05", close: 1.2 }, { date: "2026-01-06", close: 1.5 }]);
  assert.deepEqual(P.normSplits([["2024-06-10", 10, 1], ["2025-05-22", 1, 10]]).map((s) => s.ratio), [10, 0.1]);
});

if (failures.length) {
  console.error(`ledger perf core: ${failures.length} failed, ${passed} passed`);
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`ledger perf core: ${passed} passed`);
