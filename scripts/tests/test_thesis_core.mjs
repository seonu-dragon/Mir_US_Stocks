// 투자 가설 추적 순수 계산(thesis-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_thesis_core.mjs   (CI 의 "Thesis tracker tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../thesis-core.js");

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

const NOW = "2026-09-26T09:00:00+09:00";
const snap = { asOf: "2026-09-25", values: { price: 100, pe: 25, operMargin: 20, revenueGrowth: 15, bogus: 1 }, benchTicker: "SPY", benchPrice: 500 };

function mk(conds, extra = {}) {
  return core.createThesis({ ticker: "aapl", market: "us", text: "  서비스 매출 성장  ", conditions: conds, target: 130, stop: 90, ...extra }, snap, NOW, "t1");
}

test("필드 목록은 시장별로 실제 있는 값만", () => {
  const us = core.metricsForMarket("us").map((m) => m.key);
  const kr = core.metricsForMarket("kr").map((m) => m.key);
  assert.ok(us.includes("guidanceLowered") && !kr.includes("guidanceLowered"));
  assert.ok(kr.includes("krMarketAlert") && !us.includes("krMarketAlert"));
  assert.ok(kr.includes("debtRatio") && !us.includes("debtRatio"));
  assert.ok(!kr.includes("insiderSellCluster") && !kr.includes("earningsWithin"));
});

test("createThesis: 스냅샷 동결·텍스트 정리·조건 검증", () => {
  const t = mk([
    { metric: "operMargin", op: "lt", value: "15" },
    { metric: "pe", op: "gt", value: 30 },
    { metric: "nope", op: "lt", value: 1 },
    { metric: "pe", op: "eq", value: 1 },
    { metric: "krMarketAlert" }, // KR 전용 → US 가설에서 제외
    { metric: "insiderSellCluster", value: 99 }, // 상한 10 으로 자름
  ]);
  assert.equal(t.ticker, "AAPL");
  assert.equal(t.text, "서비스 매출 성장");
  assert.equal(t.conditions.length, 3);
  assert.equal(t.conditions[0].value, 15);
  assert.equal(t.conditions[2].value, 10);
  assert.equal(t.entry.price, 100);
  assert.equal(t.entry.benchPrice, 500);
  assert.equal(t.entry.values.bogus, undefined);
  assert.deepEqual(t.history, []);
});

test("숫자 조건: 위반/근접/정상/확인 불가", () => {
  const lt = { id: "a", metric: "operMargin", op: "lt", value: 15 };
  assert.equal(core.evaluateCondition(lt, { values: { operMargin: 12 } }).state, "breach");
  assert.equal(core.evaluateCondition(lt, { values: { operMargin: 16 } }).state, "near"); // 2%p 이내
  assert.equal(core.evaluateCondition(lt, { values: { operMargin: 18 } }).state, "ok");
  assert.equal(core.evaluateCondition(lt, { values: {} }).state, "unknown");
  const gt = { id: "b", metric: "pe", op: "gt", value: 30 };
  assert.equal(core.evaluateCondition(gt, { values: { pe: 31 } }).state, "breach");
  assert.equal(core.evaluateCondition(gt, { values: { pe: 28 } }).state, "near"); // 10% 폭 = 3
  assert.equal(core.evaluateCondition(gt, { values: { pe: 26 } }).state, "ok");
  // 200일선 아래 = 괴리율 < 0
  const sma = { id: "c", metric: "sma200Gap", op: "lt", value: 0 };
  assert.equal(core.evaluateCondition(sma, { values: { sma200Gap: -0.5 } }).state, "breach");
  assert.equal(core.evaluateCondition(sma, { values: { sma200Gap: 1.5 } }).state, "near");
});

test("이벤트 조건: 관측·기록 유지·임박은 근접", () => {
  const g = { id: "g", metric: "guidanceLowered" };
  const hit = core.evaluateCondition(g, { events: { guidanceLowered: { value: true, text: "가이던스 하향 (2026-09-20 보도자료)" } } });
  assert.equal(hit.state, "breach");
  assert.equal(hit.observed, true);
  // 데이터 창에서 사라져도 기록(sticky)이 있으면 계속 위반
  const kept = core.evaluateCondition(g, { events: {} }, { at: "2026-09-21T10:00:00Z", text: "가이던스 하향" });
  assert.equal(kept.state, "breach");
  assert.match(kept.text, /기록 2026-09-21/);
  assert.equal(core.evaluateCondition(g, { events: { guidanceLowered: { value: false } } }).state, "ok");
  assert.equal(core.evaluateCondition(g, { events: {} }).state, "unknown");
  const e = { id: "e", metric: "earningsWithin", value: 7 };
  assert.equal(core.evaluateCondition(e, { events: { earningsWithin: { value: true, text: "D-3" } } }).state, "near");
});

test("목표가·손절가", () => {
  const t = mk([]);
  const at = (p) => core.evaluatePriceLevels(t, p);
  assert.equal(at(89)[0].state, "breach");
  assert.equal(at(92)[0].state, "near"); // 손절 3% 이내
  assert.equal(at(100)[0].state, "ok");
  assert.equal(at(131)[1].state, "near");
  assert.match(at(131)[1].text, /목표가 도달/);
  assert.equal(at(null)[0].state, "unknown");
});

test("evaluateThesis: 가장 나쁜 상태 + 새로 관측된 이벤트", () => {
  const t = mk([{ id: "m", metric: "operMargin", op: "lt", value: 15 }, { id: "g", metric: "guidanceLowered" }]);
  const r = core.evaluateThesis(t, { values: { price: 100, operMargin: 20 }, events: { guidanceLowered: { value: true, text: "하향" } } });
  assert.equal(r.state, "breach");
  assert.equal(r.counts.breach, 1);
  assert.deepEqual(r.newlyTriggered.map((x) => x.id), ["g"]);
  const t2 = core.recordTriggered(t, r.newlyTriggered, NOW);
  const r2 = core.evaluateThesis(t2, { values: { price: 100, operMargin: 20 }, events: {} });
  assert.equal(r2.state, "breach");
  assert.equal(r2.newlyTriggered.length, 0);
  const allUnknown = core.evaluateThesis(mk([{ metric: "pe", op: "gt", value: 30 }], { target: null, stop: null }), { values: {} });
  assert.equal(allUnknown.state, "unknown");
});

test("수정: 이력 보존·진입 스냅샷 불변·무변경이면 이력 없음", () => {
  const t = mk([{ id: "m", metric: "operMargin", op: "lt", value: 15 }]);
  assert.equal(core.reviseThesis(t, { text: "서비스 매출 성장" }, "2026-09-27T00:00:00Z"), t);
  const r1 = core.reviseThesis(t, { text: "바뀐 근거", conditions: [{ id: "m", metric: "operMargin", op: "lt", value: 10 }], note: "완화" }, "2026-09-27T00:00:00Z");
  assert.equal(r1.history.length, 1);
  assert.equal(r1.history[0].text, "서비스 매출 성장");
  assert.equal(r1.history[0].conditions[0].value, 15);
  assert.equal(r1.history[0].at, NOW);
  assert.equal(r1.createdAt, NOW);
  assert.equal(r1.entry.price, 100);
  assert.equal(r1.updatedAt, "2026-09-27T00:00:00Z");
  const r2 = core.reviseThesis(r1, { stop: 80 }, "2026-09-28T00:00:00Z");
  assert.equal(r2.history.length, 2);
  assert.equal(r2.history[0].text, "서비스 매출 성장"); // 원래 가설은 항상 history[0]
  assert.equal(r2.history[1].note, "완화");
});

test("성과는 스냅샷 가격·벤치마크 대비", () => {
  const t = mk([], { entryPrice: 95 });
  const closed = core.closeThesis(t, { asOf: "2026-12-26", price: 120, benchTicker: "SPY", benchPrice: 550 }, "target", "2026-12-26T09:00:00+09:00");
  const p = core.relativePerformance(closed);
  near(p.stockRet, 20, 1e-9);
  near(p.benchRet, 10, 1e-9);
  near(p.excess, 10, 1e-9);
  assert.equal(p.days, 92);
  // 벤치마크가 바뀌었으면 비교 불가
  const bad = core.closeThesis(t, { price: 120, benchTicker: "QQQ", benchPrice: 550 }, "other", NOW);
  assert.equal(core.relativePerformance(bad).excess, null);
  // 진행 중: current 로 계산
  const open = core.relativePerformance(t, { asOf: "2026-10-01", price: 90, benchTicker: "SPY", benchPrice: 450 });
  near(open.excess, 0, 1e-9);
});

test("성적표: 종료 가설만, 초과수익 > 0 이 적중", () => {
  const base = mk([]);
  const close = (id, price, bench) => core.closeThesis({ ...base, id }, { price, benchTicker: "SPY", benchPrice: bench }, "other", NOW);
  const list = [close("a", 120, 550), close("b", 105, 550), close("c", 90, 400), { ...base, id: "d" }, core.closeThesis({ ...base, id: "e", entry: { ...base.entry, benchPrice: null } }, { price: 110 }, "other", NOW)];
  const s = core.scoreboard(list);
  assert.equal(s.closed, 4);
  assert.equal(s.scored, 3);
  assert.equal(s.unscored, 1);
  assert.equal(s.hits, 2); // a +10%p, c +(-10 - -20)=+10%p, b -5%p
  near(s.hitRate, 66.6667, 1e-3);
  near(s.medianExcess, 10, 1e-9);
  assert.equal(core.scoreboard([]).hitRate, null);
});

test("실적 후 재점검", () => {
  const t = mk([]);
  assert.equal(core.needsEarningsRecheck(t, "2026-09-25"), false);
  assert.equal(core.needsEarningsRecheck(t, "2026-10-30"), true);
  assert.equal(core.needsEarningsRecheck({ ...t, reviewedAt: "2026-10-31T00:00:00Z" }, "2026-10-30"), false);
  assert.equal(core.needsEarningsRecheck({ ...t, status: "closed" }, "2026-10-30"), false);
  assert.equal(core.needsEarningsRecheck(t, null), false);
});

test("데이터 가공: 200일선·YoY·내부자 매도 클러스터", () => {
  const closes = Array.from({ length: 200 }, () => 100);
  closes[199] = 110; // 평균 100.05
  near(core.sma200Gap(closes), (110 / 100.05 - 1) * 100, 1e-9);
  assert.equal(core.sma200Gap(closes.slice(1)), null);
  const hist = [{ y: 2024, rev: 100, op: -5 }, { y: 2025, rev: 112, op: 10 }];
  near(core.yoyFromHistory(hist, "rev"), 12, 1e-9);
  assert.equal(core.yoyFromHistory(hist, "op"), null); // 직전 적자
  assert.equal(core.yoyFromHistory([{ y: 2022, rev: 1 }, { y: 2025, rev: 2 }], "rev"), null); // 연속 아님
  const trades = [
    { ticker: "X", kind: "sell", code: "S", owner: "A", fileDate: "2026-09-20", value: 10 },
    { ticker: "X", kind: "sell", code: "S", owner: "A", fileDate: "2026-09-21", value: 10 },
    { ticker: "X", kind: "sell", code: "S", owner: "B", fileDate: "2026-09-10", value: 10 },
    { ticker: "X", kind: "sell", code: "S", owner: "C", fileDate: "2026-08-01", value: 10 }, // 30일 밖
    { ticker: "X", kind: "buy", code: "P", owner: "D", fileDate: "2026-09-20" },
    { ticker: "X", kind: "sell", code: "F", owner: "E", fileDate: "2026-09-20" }, // 세금 원천징수
  ];
  const c = core.insiderSellCluster(trades, "x", "2026-09-26", 30, 3);
  assert.equal(c.owners, 2);
  assert.equal(c.count, 3);
  assert.equal(c.hit, false);
  assert.equal(core.insiderSellCluster(trades, "X", "2026-09-26", 30, 2).hit, true);
});

test("병합: 최신 updatedAt 우선·삭제 표식 합집합·잘못된 항목 제거", () => {
  const t = mk([]);
  const newer = { ...t, text: "새 버전", updatedAt: "2026-09-30T00:00:00Z" };
  const other = { ...mk([]), id: "t2", ticker: "MSFT" };
  const m = core.mergeStores({ items: [t, other], deleted: [] }, { items: [newer, { ticker: "" }, { ticker: "ZZ" }], deleted: ["t2"] });
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].text, "새 버전");
  assert.deepEqual(m.deleted, ["t2"]);
  // 배열(구형) 입력도 받는다
  assert.equal(core.normalizeStore([t]).items.length, 1);
});

test("클라우드 사본은 상한 안으로(로컬은 그대로)", () => {
  const long = "가".repeat(1500);
  const items = Array.from({ length: 30 }, (_, i) => {
    let t = { ...mk([{ metric: "pe", op: "gt", value: 30 }]), id: `x${i}`, text: long, createdAt: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00Z` };
    for (let k = 0; k < 5; k += 1) t = core.reviseThesis(t, { text: `${long}${k}` }, `2026-09-27T0${k}:00:00Z`);
    return i % 2 ? core.closeThesis(t, { price: 1 }, "other", NOW) : t;
  });
  const c = core.compactForCloud({ items, deleted: [] }, 16000);
  assert.ok(core.byteLength(JSON.stringify({ items: c.items, deleted: c.deleted })) <= 16000);
  assert.ok(c.truncated);
  assert.ok(c.items.every((t) => t.history.length <= 3));
  assert.equal(items[0].text.length, 1501); // 원본 불변(마지막 수정본)
  near(core.byteLength("가a"), 4, 0);
});

test("CSV: 따옴표·쉼표·줄바꿈 이스케이프", () => {
  const t = core.closeThesis(mk([{ metric: "pe", op: "gt", value: 30 }], { text: 'a,"b"\nc' }), { price: 110, benchTicker: "SPY", benchPrice: 550 }, "target", NOW);
  const csv = core.toCsv([t]);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('"a,""b""\nc"'));
  assert.ok(lines[1].includes("PER > 30.0배"));
  assert.ok(lines[1].endsWith(",10.00,10.00,0.00"));
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`thesis-core: ${passed} tests passed`);
