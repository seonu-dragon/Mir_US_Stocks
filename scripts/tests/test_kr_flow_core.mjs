// 국내 증시자금·투자자 동향 순수 계산(kr-flow-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_kr_flow_core.mjs   (CI 의 "KR flow core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../kr-flow-core.js");

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

test("shardOf: 파이썬 shard_of 와 같은 값", () => {
  // scripts/tests/test_kr_market_funds.py::test_flow_shard_of_matches_js_vectors 와 같은 벡터.
  assert.equal(core.shardOf("005930", 32), 29);
  assert.equal(core.shardOf("000660", 32), 28);
  for (const c of ["0001A0", "373220", "900140"]) {
    const s = core.shardOf(c, 32);
    assert.ok(s >= 0 && s < 32);
  }
});

test("fmtSignedMan: 1만 이상은 만 단위, 그 아래는 그대로", () => {
  assert.equal(core.fmtSignedMan(-2324529), "-232만");
  assert.equal(core.fmtSignedMan(2055241), "+206만");
  assert.equal(core.fmtSignedMan(313027), "+31만");
  assert.equal(core.fmtSignedMan(12345), "+1.2만");
  assert.equal(core.fmtSignedMan(-99999), "-10만");
  assert.equal(core.fmtSignedMan(3189), "+3,189");
  assert.equal(core.fmtSignedMan(0), "0");
  assert.equal(core.fmtSignedMan(null), "—");
});

test("fmtSigned: 부호·쉼표·0·결측", () => {
  assert.equal(core.fmtSigned(3189), "+3,189");
  assert.equal(core.fmtSigned(-14649), "-14,649");
  assert.equal(core.fmtSigned(0.4), "0");
  assert.equal(core.fmtSigned(1009825.55), "+1,009,826");
  assert.equal(core.fmtSigned(null), "—");
  assert.equal(core.fmtSigned(NaN), "—");
});

test("fmtPlain: 큰 값은 정수, 작은 소수는 자릿수 유지", () => {
  assert.equal(core.fmtPlain(1009825.55), "1,009,826");
  assert.equal(core.fmtPlain(36.35), "36.4");
  assert.equal(core.fmtPlain(8.5), "8.50");
  assert.equal(core.fmtPlain(8537), "8,537");
  assert.equal(core.fmtPlain(undefined), "—");
});

test("tone", () => {
  assert.equal(core.tone(1), "pos");
  assert.equal(core.tone(-1), "neg");
  assert.equal(core.tone(0), "");
  assert.equal(core.tone(null), "");
});

test("lastN·cumulative·sumKey", () => {
  const rows = [{ d: "a", frn: 1 }, { d: "b", frn: -3 }, { d: "c", frn: 5 }, { d: "d" }];
  assert.deepEqual(core.lastN(rows, 2).map((r) => r.d), ["c", "d"]);
  assert.equal(core.lastN(rows, 0).length, 4);
  assert.deepEqual(core.cumulative([1, -3, 5, null]), [1, -2, 3, 3]);
  assert.equal(core.sumKey(rows, "frn"), 3);
  assert.equal(core.sumKey([{ d: "x" }], "frn"), null);
});

test("delta: 결측 행은 건너뛰고 직전 유효 값과 비교", () => {
  const rows = [{ d: "2026-09-18", dep: 10 }, { d: "2026-09-21", dep: 12 }, { d: "2026-09-22" }];
  const r = core.delta(rows, "dep");
  assert.equal(r.last, 12);
  assert.equal(r.prev, 10);
  assert.equal(r.diff, 2);
  assert.equal(r.date, "2026-09-21");
  assert.equal(core.delta([], "dep"), null);
  assert.equal(core.delta([{ d: "x", dep: 1 }], "dep").diff, null);
});

test("barGeometry: 0 선 기준 위/아래 막대", () => {
  const g = core.barGeometry([10, -10, null], 300, 100, 0);
  assert.equal(g.zeroY, 50);
  assert.equal(g.bars.length, 3);
  assert.equal(g.bars[0].y, 0);
  assert.equal(g.bars[0].h, 50);
  assert.equal(g.bars[1].y, 50);
  assert.equal(g.bars[1].h, 50);
  assert.equal(g.bars[2].h, 0);
  // 전부 양수면 0 선은 바닥
  assert.equal(core.barGeometry([1, 2], 10, 100, 0).zeroY, 100);
});

test("linePath: 점 개수·결측 건너뜀", () => {
  const d = core.linePath([1, 2, null, 4], 400, 100, 0);
  assert.equal((d.match(/[ML]/g) || []).length, 3);
  assert.ok(d.startsWith("M50.0,100.0"));
  assert.equal(core.linePath([], 10, 10), "");
});

// build_kr_investor_flow.py encode_stock 의 기대값(test_kr_market_funds.py::test_encode_stock_flat_int_deltas)과 같은 벡터.
const ENC = [3, 261000, 286500, -9000, -2500, -7630126, -2707452, -10152588,
  4513767, 659851, 4080410, 1346883, 259459, 4186614, 4663, -8, 1, 1000, 1000, 0];
const DATES = ["20260923", "20260922", "20260921"];

test("undelta: 결측 건너뛰고 복원(파이썬 deltas 의 역)", () => {
  assert.deepEqual(core.undelta([5, null, 2, -1]), [5, null, 7, 6]);
});

test("decodeStock: 평평한 배열 → 행, 전일대비는 보정 반영·등락률 분모는 공식 기준가", () => {
  const rows = core.decodeStock(ENC, DATES);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.close), [286500, 277500, 275000]);
  // 공식 전일대비(보정 반영): 09-23 +10,000(종가 차 +9,000 + 보정 1,000)
  assert.deepEqual(rows.map((r) => r.chg), [10000, 3500, 14000]);
  assert.ok(Math.abs(rows[0].pct - (10000 / 276500) * 100) < 1e-9);
  assert.ok(Math.abs(rows[2].pct - (14000 / 261000) * 100) < 1e-9);
  assert.equal(rows[0].d, "2026-09-23");
  assert.equal(rows[1].frn, 659851);
  assert.equal(rows[2].org, 4186614);
  assert.deepEqual(rows.map((r) => r.hold), [46.63, 46.55, 46.56]);
  assert.deepEqual(core.decodeStock([3, 1, 2], DATES), []);
  // 보정 열이 없는 배열(구형)도 종가 차로 읽는다
  assert.deepEqual(core.decodeStock(ENC.slice(0, 17), DATES).map((r) => r.chg), [9000, 2500, 14000]);
  assert.deepEqual(core.decodeStock(null, DATES), []);
});

test("dailyRows: 공통 날짜 / own 날짜 / 없음", () => {
  const shard = { dates: DATES, t: { "005930": ENC, "000660": [1, 100, 110, 0, 5, -5, 1000] }, own: { "000660": ["20260921"] } };
  assert.equal(core.dailyRows(shard, "005930")[1].d, "2026-09-22");
  const r = core.dailyRows(shard, "000660");
  assert.equal(r.length, 1);
  assert.equal(r[0].d, "2026-09-21");
  assert.equal(r[0].chg, 10);
  assert.equal(r[0].hold, 10);
  assert.deepEqual(core.dailyRows(shard, "000000"), []);
  assert.deepEqual(core.dailyRows(null, "005930"), []);
});

test("streakRows: 시장·최소 연속일 필터와 개수 제한", () => {
  const list = [
    { t: "a", m: "kospi", d: 12 }, { t: "b", m: "kosdaq", d: 9 }, { t: "c", m: "kospi", d: 4 },
    { t: "d", m: "kosdaq", d: 2 }, null, { t: "e", m: "kospi" },
  ];
  assert.deepEqual(core.streakRows(list, "all", 3).map((x) => x.t), ["a", "b", "c"]);
  assert.deepEqual(core.streakRows(list, "kosdaq", 2).map((x) => x.t), ["b", "d"]);
  assert.deepEqual(core.streakRows(list, "KOSPI", 5, 1).map((x) => x.t), ["a"]);
  assert.deepEqual(core.streakRows(null, "all", 2), []);
});

test("streakLabel: 창을 다 채우면 'N일+'", () => {
  assert.equal(core.streakLabel({ d: 7 }, 20), "7일");
  assert.equal(core.streakLabel({ d: 20, x: 1 }, 20), "20일+");
  assert.equal(core.streakLabel(null, 20), "—");
});

test("foreignRetention: chartSeries 꼬리에 날짜로 맞추고 null·범위 밖은 건너뛴다", () => {
  const cs = [];
  for (let i = 1; i <= 10; i += 1) cs.push([1, 1, 1, 1, 1, `2026-10-${String(i).padStart(2, "0")}`]);
  const fr = core.foreignRetention([46.1, null, 46.3, 146, 46.5, 46.6], cs, 4);
  assert.equal(fr.pts.length, 4);
  assert.deepEqual(fr.first, { d: "2026-10-05", v: 46.1 });
  assert.deepEqual(fr.last, { d: "2026-10-10", v: 46.6 });
  assert.equal(fr.vals[1], null);
  assert.equal(fr.vals[3], null);
  assert.equal(fr.change, 0.5);
  assert.equal(fr.min, 46.1);
  assert.equal(fr.max, 46.6);
});

test("foreignRetention: 점이 적거나 배열이 없으면 null(패널 숨김)", () => {
  const cs = [[1, 1, 1, 1, 1, "2026-10-01"], [1, 1, 1, 1, 1, "2026-10-02"]];
  assert.equal(core.foreignRetention([1, 2], cs), null);
  assert.equal(core.foreignRetention(undefined, cs), null);
  assert.equal(core.foreignRetention([1, 2, 3], cs), null); // 봉보다 길면 정렬 불가
  assert.equal(core.foreignRetention([1, 2], cs, 2).pts.length, 2);
});

test("etfOwners: 비중 내림차순 · 해외(m=us)·비중 없음·자기 자신 제외 · n 제한", () => {
  const etfs = {
    "069500": { name: "KODEX 200", top: [{ t: "005930", w: 33.8 }, { t: "000660", w: 24.3 }] },
    "102110": { name: "TIGER 200", top: [{ t: "005930", w: 34.1 }] },
    "360750": { name: "TIGER 미국S&P500", top: [{ t: "005930", w: 9, m: "us" }] },
    "111111": { name: "무비중", top: [{ t: "005930", w: null }] },
    "005930": { name: "자기", top: [{ t: "005930", w: 100 }] },
    "222222": { name: "빈", top: [] },
  };
  assert.deepEqual(core.etfOwners(etfs, "005930"), [
    { etf: "102110", name: "TIGER 200", w: 34.1 },
    { etf: "069500", name: "KODEX 200", w: 33.8 },
  ]);
  assert.equal(core.etfOwners(etfs, "005930", 1).length, 1);
  assert.deepEqual(core.etfOwners(etfs, "999999"), []);
  assert.deepEqual(core.etfOwners(null, "005930"), []);
});

test("ownershipRows: 이 종목만 · 최신순 · 같은 날은 5%룰 먼저 · kind 표시", () => {
  const payload = {
    majorHolders: [{ ticker: "005930", fileDate: "2026-10-20", filer: "A" }, { ticker: "000660", fileDate: "2026-10-22", filer: "X" }],
    insiders: [{ ticker: "005930", fileDate: "2026-10-22", filer: "B" }, { ticker: "005930", fileDate: "2026-10-20", filer: "C" }],
  };
  const rows = core.ownershipRows(payload, "005930");
  assert.deepEqual(rows.map((r) => `${r.kind}:${r.filer}`), ["insider:B", "major:A", "insider:C"]);
  assert.equal(core.ownershipRows(payload, "005930", 2).length, 2);
  assert.deepEqual(core.ownershipRows(payload, "035420"), []);
  assert.deepEqual(core.ownershipRows(null, "005930"), []);
});

test("groupRows: 창·투자자 기준 순매수/순매도 정렬과 개수 제한", () => {
  const list = [
    { id: "a", n: "A", c: 3, f: [10, -5, 100], o: [0, 1, 2], i: [1, 1, 1] },
    { id: "b", n: "B", c: 1, f: [-20, 30, -50], o: [5, -1, 0], i: [1, 1, 1] },
    { id: "c", n: "C", c: 2, f: [5, 0, 70], o: [null, 2, 1], i: [1, 1, 1] },
    { id: "d", n: "D", c: 2 },
  ];
  assert.deepEqual(core.groupRows(list, 0, "f", "Buy").map((x) => x.id), ["a", "c"]);
  assert.deepEqual(core.groupRows(list, 0, "f", "Sell").map((x) => x.id), ["b"]);
  assert.deepEqual(core.groupRows(list, 2, "f", "Buy", 1).map((x) => x.id), ["a"]);
  assert.deepEqual(core.groupRows(list, 1, "f", "Buy").map((x) => x.id), ["b"]);   // 0 은 어느 쪽에도 없다
  assert.deepEqual(core.groupRows(list, 0, "o", "Buy").map((x) => x.id), ["b"]);   // 결측(null) 제외
  assert.deepEqual(core.groupRows(null, 0, "f", "Buy"), []);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`kr-flow-core: ${passed} passed`);
