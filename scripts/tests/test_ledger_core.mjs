// 거래 원장 순수 계산(ledger-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_ledger_core.mjs   (CI 의 "Ledger core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const L = require("../../ledger-core.js");

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
const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);

let n = 0;
function tx(type, date, qty, price, extra = {}, market = "us") {
  n += 1;
  return L.normalizeTx({ id: `t${n}`, type, ticker: extra.ticker || "AAPL", date, qty, price, ...extra }, market);
}

test("이동평균: 두 번 매수하면 수량 가중 평단", () => {
  const r = L.applyLedger([tx("buy", "2026-01-02", 10, 100), tx("buy", "2026-02-02", 30, 200)]);
  const p = r.positions.AAPL;
  assert.equal(p.qty, 40);
  near(p.avgCost, 175, "avg");
  assert.equal(r.errors.length, 0);
});

test("부분 매도는 평단을 바꾸지 않고 실현손익을 낸다", () => {
  const r = L.applyLedger([tx("buy", "2026-01-02", 10, 100), tx("buy", "2026-02-02", 10, 200), tx("sell", "2026-03-02", 5, 180)]);
  const p = r.positions.AAPL;
  assert.equal(p.qty, 15);
  near(p.avgCost, 150, "avg unchanged");
  assert.equal(r.sales.length, 1);
  near(r.sales[0].pnl, 5 * (180 - 150), "pnl");
  near(r.sales[0].pnlPct, 20, "pnl%");
  // 남은 수량을 더 팔아도 같은 평단 기준
  const r2 = L.applyLedger([tx("buy", "2026-01-02", 10, 100), tx("sell", "2026-02-01", 4, 120), tx("sell", "2026-03-01", 3, 90)]);
  near(r2.sales[0].pnl, 80, "first");
  near(r2.sales[1].pnl, -30, "second");
  assert.equal(r2.positions.AAPL.qty, 3);
});

test("전량 매도하면 평단이 초기화되고 다음 매수는 새 평단", () => {
  const r = L.applyLedger([tx("buy", "2026-01-02", 10, 100), tx("sell", "2026-02-02", 10, 150), tx("buy", "2026-03-02", 2, 300)]);
  const p = r.positions.AAPL;
  assert.equal(p.qty, 2);
  near(p.avgCost, 300, "fresh avg");
  near(r.sales[0].pnl, 500, "pnl");
  const r2 = L.applyLedger([tx("buy", "2026-01-02", 10, 100, { fee: 5 }), tx("sell", "2026-02-02", 10, 150)]);
  assert.equal(r2.positions.AAPL.qty, 0);
  assert.equal(r2.positions.AAPL.avgCost, 0);
  assert.equal(r2.positions.AAPL.feePool, 0);
});

test("분할: 4:1 이면 수량×4·평단÷4, 원가 총액 유지, 이후 매도 손익 일관", () => {
  const r = L.applyLedger([
    tx("buy", "2026-01-02", 10, 400),
    L.normalizeTx({ id: "sp1", type: "split", ticker: "AAPL", date: "2026-02-01", ratio: 4 }, "us"),
    tx("sell", "2026-03-01", 20, 120),
  ]);
  const p = r.positions.AAPL;
  assert.equal(p.qty, 20);
  near(p.avgCost, 100, "avg after split");
  near(r.sales[0].pnl, 20 * 20, "pnl after split");
  // 병합(1:10)
  const r2 = L.applyLedger([tx("buy", "2026-01-02", 100, 2), L.normalizeTx({ id: "sp2", type: "split", ticker: "AAPL", date: "2026-02-01", ratio: 0.1 }, "us")]);
  near(r2.positions.AAPL.qty, 10, "reverse qty");
  near(r2.positions.AAPL.avgCost, 20, "reverse avg");
});

test("수수료·세금: 평단은 체결가 평균, 실현손익은 매수 수수료 배분 + 매도 비용 차감", () => {
  const r = L.applyLedger([
    tx("buy", "2026-01-02", 10, 100, { fee: 10 }),
    tx("sell", "2026-02-02", 5, 120, { fee: 3, tax: 2 }),
  ]);
  const p = r.positions.AAPL;
  near(p.avgCost, 100, "avg excludes fee");
  near(p.feePool, 5, "half of buy fee remains");
  near(p.avgCostInclFees, 101, "avg incl fees (수수료 10 ÷ 10주)");
  // 600 - 500 - 5(매수 수수료 절반) - 5(매도 수수료+세금) = 90
  near(r.sales[0].pnl, 90, "net pnl");
  near(r.sales[0].pnlPct, 90 / 505 * 100, "pnl% on cost incl fee");
});

test("보유보다 많이 팔면 거부(오류로 남기고 적용하지 않음)", () => {
  const r = L.applyLedger([tx("buy", "2026-01-02", 10, 100), tx("sell", "2026-02-02", 11, 120)]);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /많이 팔 수 없습니다/);
  assert.equal(r.positions.AAPL.qty, 10);
  assert.equal(r.sales.length, 0);
  // 날짜 순서: 매수 전에 판 매도도 과매도
  const r2 = L.applyLedger([tx("buy", "2026-03-02", 10, 100), tx("sell", "2026-02-02", 1, 120)]);
  assert.equal(r2.errors.length, 1);
  // tryChange 는 과매도를 만드는 추가를 거부하고 원래 목록을 돌려준다
  const base = [tx("buy", "2026-01-02", 10, 100)];
  const bad = L.tryChange(base, { upsert: tx("sell", "2026-02-01", 20, 1) });
  assert.equal(bad.ok, false);
  assert.equal(bad.txs.length, 1);
  // 매수를 지워서 뒤의 매도가 과매도가 되는 삭제도 거부
  const withSell = [...base, tx("sell", "2026-02-01", 5, 110)];
  const del = L.tryChange(withSell, { remove: base[0].id });
  assert.equal(del.ok, false);
  const ok = L.tryChange(withSell, { remove: withSell[1].id });
  assert.equal(ok.ok, true);
  assert.equal(ok.txs.length, 1);
});

test("기존 보유 이전: 시작 잔고(날짜 모름)는 맨 앞에 적용되고 이후 거래와 이어진다", () => {
  const open = L.openingFromHolding({ ticker: "AAPL", qty: 10, avgCost: 150 }, "us");
  assert.equal(open.type, "open");
  assert.equal(open.date, "");
  assert.deepEqual(L.validateTx(open), []);
  const r = L.applyLedger([tx("sell", "2026-05-01", 4, 200), open, tx("buy", "2026-04-01", 10, 250)]);
  const p = r.positions.AAPL;
  near(p.avgCost, 200, "open+buy avg");
  assert.equal(p.qty, 16);
  near(r.sales[0].pnl, 0, "sold at avg");
  // 잘못된 보유는 옮기지 않는다
  assert.equal(L.openingFromHolding({ ticker: "AAPL", qty: 0, avgCost: 1 }, "us"), null);
});

test("보유 동기화: 원장 종목만 덮고, 원장 없는 종목은 그대로, 전량 매도는 빠진다", () => {
  const holdings = [
    { ticker: "AAPL", qty: 1, avgCost: 1 },
    { ticker: "MSFT", qty: 3, avgCost: 400 },
    { ticker: "TSLA", qty: 2, avgCost: 200 },
  ];
  const r = L.applyLedger([
    tx("buy", "2026-01-02", 10, 100),
    tx("buy", "2026-01-02", 5, 50, { ticker: "NVDA" }),
    tx("buy", "2026-01-02", 2, 200, { ticker: "TSLA" }),
    tx("sell", "2026-01-03", 2, 210, { ticker: "TSLA" }),
  ]);
  const { next, changed } = L.reconcileHoldings(holdings, r);
  assert.equal(changed, true);
  assert.deepEqual(next.find((h) => h.ticker === "AAPL"), { ticker: "AAPL", qty: 10, avgCost: 100 });
  assert.deepEqual(next.find((h) => h.ticker === "MSFT"), { ticker: "MSFT", qty: 3, avgCost: 400 });
  assert.equal(next.some((h) => h.ticker === "TSLA"), false);
  assert.deepEqual(next.find((h) => h.ticker === "NVDA"), { ticker: "NVDA", qty: 5, avgCost: 50 });
  // 원장이 비어 있으면 아무것도 바꾸지 않는다(기존 사용자 무변경)
  const none = L.reconcileHoldings(holdings, L.applyLedger([]));
  assert.equal(none.changed, false);
  assert.deepEqual(none.next, holdings);
});

test("실현손익 요약: 올해/전체, 단독 수수료 차감", () => {
  const r = L.applyLedger([
    tx("buy", "2025-01-02", 10, 100),
    tx("sell", "2025-06-02", 2, 150),
    tx("sell", "2026-03-02", 3, 90),
    tx("fee", "2026-04-01", 0, 7),
  ]);
  const s = L.realizedSummary(r, "2026");
  near(s.allTime.USD, 100 - 30 - 7, "all");
  near(s.thisYear.USD, -30 - 7, "this year");
  assert.equal(s.saleCount, 2);
  assert.equal(s.saleCountYear, 1);
  near(r.byYear["2025"].USD, 100, "2025");
});

test("환율: 모든 매수·매도에 환율이 있을 때만 원화 실현손익", () => {
  const r = L.applyLedger([
    tx("buy", "2026-01-02", 10, 100, { fx: 1300 }),
    tx("sell", "2026-02-02", 5, 100, { fx: 1400 }),
  ]);
  near(r.sales[0].pnl, 0, "usd flat");
  near(r.sales[0].pnlKrw, 5 * 100 * (1400 - 1300), "krw from fx");
  const r2 = L.applyLedger([tx("buy", "2026-01-02", 10, 100), tx("sell", "2026-02-02", 5, 100, { fx: 1400 })]);
  assert.equal(r2.sales[0].pnlKrw, null);
});

test("검증: 날짜·수량·가격·통화 기본값", () => {
  const t = L.normalizeTx({ type: "buy", ticker: "005930", date: "2026-02-30", qty: "10", price: "70000" }, "kr");
  assert.equal(t.currency, "KRW");
  assert.equal(t.qty, 10);
  assert.ok(L.validateTx(t).some((m) => /날짜/.test(m)));
  assert.ok(L.validateTx(L.normalizeTx({ type: "buy", ticker: "A", date: "2026-01-01", qty: 0, price: 1 })).length > 0);
  assert.ok(L.validateTx(L.normalizeTx({ type: "buy", ticker: "A", date: "2026-01-01", qty: 1, price: 1, fee: -1 })).length > 0);
  assert.deepEqual(L.validateTx(L.normalizeTx({ type: "buy", ticker: "A", date: "2026-01-01", qty: 1, price: 1 })), []);
});

test("백업 JSON 왕복과 시장 불일치 거부, 과매도 병합 거부", () => {
  const txs = [tx("buy", "2026-01-02", 10, 100), tx("sell", "2026-01-03", 5, 110)];
  const text = L.exportJson(txs, "us", "2026-10-23");
  const back = L.parseImport(text, "us");
  assert.equal(back.ok, true);
  assert.equal(back.txs.length, 2);
  assert.equal(L.parseImport(text, "kr").ok, false);
  assert.equal(L.parseImport("{not json", "us").ok, false);
  const merged = L.mergeImport([], back.txs);
  assert.equal(merged.ok, true);
  assert.equal(merged.added, 2);
  const again = L.mergeImport(merged.txs, back.txs);
  assert.equal(again.replaced, 2);
  assert.equal(again.txs.length, 2);
  const over = L.mergeImport([], [tx("sell", "2026-01-03", 5, 110)]);
  assert.equal(over.ok, false);
});

if (failures.length) {
  console.error(`Ledger core tests: ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.error(`  FAIL ${f}`));
  process.exit(1);
}
console.log(`Ledger core tests: ${passed} passed`);
