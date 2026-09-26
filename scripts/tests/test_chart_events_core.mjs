// 가격 차트 이벤트 마커 순수 계산(chart-events-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_chart_events_core.mjs   (CI 의 "Chart event marker tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const E = require("../../chart-events-core.js");

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

// ---- 모으기 ----
test("US: 실적·배당·분할·8-K(hot 만, 9.01 제외) 를 날짜순으로", () => {
  const ev = E.collectEvents({
    kr: false,
    ticker: "NVDA",
    earnings: [{ date: "2024-05-22", epsActual: 6.12, epsEstimate: 5.59, surprisePct: 9.48 }],
    dividends: [["2024-06-11", 0.01], ["2024-03-05", 0.04], ["bad", 1], ["2024-01-01", 0]],
    splits: [["2024-06-10", 10, 1], ["2020-01-01", 1, 1]],
    usFilings: [
      { ticker: "NVDA", hot: true, fileDate: "2024-06-12", items: [{ code: "5.02", label: "임원·이사 변동" }, { code: "9.01", label: "재무제표·첨부" }], link: "https://sec.gov/x" },
      { ticker: "NVDA", hot: false, fileDate: "2024-06-13", items: [{ code: "7.01", label: "Reg FD" }] },
      { ticker: "AAPL", hot: true, fileDate: "2024-06-12", items: [{ code: "8.01", label: "기타" }] },
    ],
  });
  assert.deepEqual(ev.map((e) => `${e.date}${e.kind}`), ["2024-03-05D", "2024-05-22E", "2024-06-10S", "2024-06-11D", "2024-06-12F"]);
  const earn = ev.find((e) => e.kind === "E");
  assert.equal(earn.detail, "EPS 6.12 (예상 5.59, 차이 +9.5%)");
  assert.equal(ev.find((e) => e.kind === "S").detail, "10:1");
  assert.equal(ev.find((e) => e.kind === "S").title, "액면분할");
  const f = ev.find((e) => e.kind === "F");
  assert.equal(f.detail, "임원·이사 변동");
  assert.equal(f.link, "https://sec.gov/x");
  assert.equal(ev.find((e) => e.date === "2024-03-05").detail, "주당 $0.04");
});

test("병합은 '주식병합'", () => {
  const ev = E.collectEvents({ splits: [["2023-02-01", 1, 10]] });
  assert.equal(ev[0].title, "주식병합");
  assert.equal(ev[0].detail, "1:10");
});

test("KR: 실적 공시 금액은 조/억, 배당은 원, 공시는 주요 유형만", () => {
  const ev = E.collectEvents({
    kr: true,
    ticker: "005930",
    earnings: [{ date: "2025-05-15", label: "2025 1분기", revenue: 79140503000000, operatingProfit: 668527200000 }],
    dividends: [["2025-06-27", 361]],
    krFilings: [
      { ticker: "005930", typeLabel: "공급계약", title: "단일판매ㆍ공급계약체결", fileDate: "2025-06-02", link: "https://dart/x" },
      { ticker: "005930", typeLabel: "임원·주요주주 소유보고", title: "소유상황보고서", fileDate: "2025-06-03" },
      { ticker: "000660", typeLabel: "공급계약", title: "다른 종목", fileDate: "2025-06-02" },
    ],
  });
  assert.deepEqual(ev.map((e) => e.kind), ["E", "F", "D"]);
  assert.equal(ev[0].title, "실적 공시 · 2025 1분기");
  assert.equal(ev[0].detail, "매출 79.1조 · 영업이익 6,685억");
  assert.equal(ev[1].title, "공급계약");
  assert.equal(ev[2].detail, "주당 361원");
});

test("같은 날·같은 내용 중복 제거", () => {
  const ev = E.collectEvents({ dividends: [["2024-01-02", 0.2], ["2024-01-02", 0.2]] });
  assert.equal(ev.length, 1);
});

// ---- 봉 매핑 ----
const dates = ["2024-06-03", "2024-06-04", "2024-06-05", "2024-06-06", "2024-06-07", "2024-06-10", "2024-06-11"];

test("barIndexForDate: 같은 날·휴장일은 다음 거래일·범위 밖은 -1", () => {
  assert.equal(E.barIndexForDate(dates, "2024-06-05"), 2);
  assert.equal(E.barIndexForDate(dates, "2024-06-08"), 5, "토요일 → 월요일 봉");
  assert.equal(E.barIndexForDate(dates, "2024-06-12"), -1, "마지막 봉 이후");
  assert.equal(E.barIndexForDate(dates, "2024-06-01"), 0);
  assert.equal(E.barIndexForDate([], "2024-06-01"), -1);
});

test("mapEventsToBars: 보이는 구간 인덱스·첫 봉 이전 버림·꺼진 종류 제외", () => {
  const ev = [
    { date: "2024-05-31", kind: "E" }, // 전체 첫 봉보다 이르다 → 버림
    { date: "2024-06-04", kind: "D" }, // 구간 앞(보이는 구간 2~5) → 버림
    { date: "2024-06-06", kind: "E" },
    { date: "2024-06-08", kind: "S" }, // → 06-10 (idx 5 → 보이는 3)
    { date: "2024-06-11", kind: "F" }, // 보이는 구간 뒤 → 버림
  ];
  const out = E.mapEventsToBars(ev, dates, 2, 4, { E: true, D: true, S: true, F: true });
  assert.deepEqual(out.map((e) => [e.kind, e.idx]), [["E", 1], ["S", 3]]);
  const off = E.mapEventsToBars(ev, dates, 2, 4, { S: false });
  assert.deepEqual(off.map((e) => e.kind), ["E"]);
});

test("주봉(봉 날짜 = 주 마지막 날)에도 같은 규칙", () => {
  const weekly = ["2024-06-07", "2024-06-14", "2024-06-21"];
  assert.equal(E.barIndexForDate(weekly, "2024-06-10"), 1);
  assert.equal(E.barIndexForDate(weekly, "2024-06-14"), 1);
  assert.equal(E.barIndexForDate(weekly, "2024-06-15"), 2);
});

// ---- 묶기·좌표 ----
test("clusterMarkers: 가까운 마커는 묶고 개수 표시, 먼 마커는 따로", () => {
  const xFor = (i) => 100 + i * 5; // 봉 간격 5
  const mapped = [
    { kind: "E", idx: 0 }, { kind: "D", idx: 2 }, // x 100, 110 → 묶임(gap 16)
    { kind: "S", idx: 10 },                         // x 150
    { kind: "F", idx: 20 }, { kind: "F", idx: 21 }, // x 200, 205 → 같은 종류 묶음
  ];
  const cl = E.clusterMarkers(mapped, xFor, 16);
  assert.equal(cl.length, 3);
  assert.equal(cl[0].count, 2);
  assert.equal(cl[0].label, "2");
  assert.equal(cl[0].kind, "mixed");
  assert.equal(cl[0].x, 105);
  assert.equal(cl[1].label, "S");
  assert.equal(cl[1].x, 150);
  assert.equal(cl[2].kind, "F");
  assert.equal(cl[2].label, "2");
});

test("clusterMarkers: 가로 확대(봉 간격 증가)하면 묶음이 풀린다 — 좌표는 xFor 그대로", () => {
  const mapped = [{ kind: "E", idx: 0 }, { kind: "D", idx: 2 }];
  assert.equal(E.clusterMarkers(mapped, (i) => i * 5, 16).length, 1);
  const zoomed = E.clusterMarkers(mapped, (i) => i * 20, 16);
  assert.equal(zoomed.length, 2);
  assert.deepEqual(zoomed.map((c) => c.x), [0, 40]);
});

test("clusterMarkers: 체인처럼 이어져도 첫 마커에서 gap 을 넘으면 새 묶음", () => {
  const cl = E.clusterMarkers([0, 1, 2, 3, 4].map((idx) => ({ kind: "D", idx })), (i) => i * 10, 16);
  assert.deepEqual(cl.map((c) => c.count), [2, 2, 1]);
});

test("hitCluster: 마커 줄 안에서 가장 가까운 묶음, 밖이면 null", () => {
  const cl = E.clusterMarkers([{ kind: "E", idx: 0 }, { kind: "D", idx: 10 }], (i) => 100 + i * 10, 16);
  assert.equal(E.hitCluster(cl, 103, 340, 338, 9, 10).kind, "E");
  assert.equal(E.hitCluster(cl, 198, 338, 338, 9, 10).kind, "D");
  assert.equal(E.hitCluster(cl, 150, 338, 338, 9, 10), null, "사이는 빈 곳");
  assert.equal(E.hitCluster(cl, 100, 300, 338, 9, 10), null, "마커 줄 밖");
  assert.equal(E.hitCluster([], 100, 338, 338, 9, 10), null);
});

test("filingWindow·normalizeEnabled", () => {
  assert.deepEqual(E.filingWindow([{ fileDate: "2026-09-03" }, { fileDate: "2026-08-27" }, { fileDate: "x" }]), { from: "2026-08-27", to: "2026-09-03" });
  assert.equal(E.filingWindow([]), null);
  assert.deepEqual(E.normalizeEnabled({ D: false, X: false }), { E: true, D: false, S: true, F: true });
  assert.deepEqual(E.normalizeEnabled(null), { E: true, D: true, S: true, F: true });
});

if (failures.length) {
  console.error(`chart-events-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`chart-events-core: ${passed} 통과`);
