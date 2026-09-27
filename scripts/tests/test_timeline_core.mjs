// 종목 통합 타임라인·키 모먼트 순수 계산(timeline-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_timeline_core.mjs   (CI 의 "Timeline core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const T = require("../../timeline-core.js");

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

// 영업일만 이어지는 일봉(주말 건너뜀). closes 길이만큼.
function bars(start, closes) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (const c of closes) {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    out.push({ d: d.toISOString().slice(0, 10), c });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
// 잔잔한 흔들림(±0.5%) 위에 특정 인덱스만 크게 움직인 종가.
function wiggle(n, jumps) {
  const closes = [];
  let p = 100;
  for (let i = 0; i < n; i += 1) {
    if (i > 0) p *= 1 + (jumps[i] !== undefined ? jumps[i] : (i % 2 ? 0.005 : -0.004));
    closes.push(Number(p.toFixed(4)));
  }
  return closes;
}

// ---- 키 모먼트 ----
test("평소 변동 대비 큰 날만 잡고 앞부분(표본 부족)은 판정하지 않는다", () => {
  const rows = bars("2026-01-05", wiggle(80, { 10: 0.09, 50: 0.08, 60: -0.07, 70: 0.012 }));
  const m = T.keyMoments(rows);
  assert.deepEqual(m.map((x) => x.idx), [50, 60]); // 10 은 직전 표본 20개 미만, 70 은 1.2% 라 작음
  assert.ok(m[0].pct > 7.9 && m[0].pct < 8.1);
  assert.ok(m[1].pct < -6.9);
  assert.ok(m[0].ratio >= 2.5);
  assert.equal(m[0].date, rows[50].d);
});

test("변동성이 큰 종목은 같은 등락률이라도 키 모먼트가 아니다", () => {
  const closes = [];
  let p = 100;
  for (let i = 0; i < 80; i += 1) { if (i) p *= 1 + (i % 2 ? 0.06 : -0.055); closes.push(p); }
  closes[70] = closes[69] * 1.08; // 평소 ±6% 인 종목의 +8%
  for (let i = 71; i < 80; i += 1) closes[i] = closes[i - 1] * (i % 2 ? 1.06 : 0.945);
  const m = T.keyMoments(bars("2026-01-05", closes));
  assert.equal(m.filter((x) => x.idx === 70).length, 0);
});

test("최소 등락률(minAbsPct) 미만은 비율이 커도 제외, 결측 종가는 건너뛴다", () => {
  const closes = [];
  for (let i = 0; i < 60; i += 1) closes.push(100 + (i % 2 ? 0.01 : 0)); // 거의 안 움직임
  closes[40] = closes[39] * 1.02; // 비율은 크지만 2%
  closes[45] = null;
  const m = T.keyMoments(bars("2026-01-05", closes));
  assert.equal(m.length, 0);
});

test("짧은 시계열·빈 입력은 빈 배열", () => {
  assert.deepEqual(T.keyMoments([]), []);
  assert.deepEqual(T.keyMoments(null), []);
  assert.deepEqual(T.keyMoments(bars("2026-01-05", [1, 2, 3])), []);
});

// ---- 사유 붙이기 ----
test("±1거래일 안의 항목만 사유 후보로, 주말 사건은 다음 거래일 봉 기준", () => {
  const rows = bars("2026-03-02", wiggle(40, {})); // 03-02(월) 부터
  const dates = rows.map((r) => r.d);
  const idx = dates.indexOf("2026-03-10"); // 화
  const moments = [{ date: "2026-03-10", idx, pct: 9, sigma: 1, ratio: 9 }];
  const items = [
    { date: "2026-03-09", cat: "filing", title: "8-K", src: "8k" },       // 전날 → 포함
    { date: "2026-03-11", cat: "earn", title: "실적", src: "earnings" },  // 다음 날 → 포함
    { date: "2026-03-07", cat: "own", title: "토요일 공시", src: "x" },    // 토 → 03-09(월) 봉 → 포함
    { date: "2026-03-05", cat: "corp", title: "먼 날", src: "x" },        // 3거래일 전 → 제외
    { date: "2026-03-10", cat: "move", title: "큰 등락", src: "moment" }, // 자기 자신 → 제외
  ];
  const [r] = T.attachReasons(moments, items, dates, 1);
  assert.deepEqual(r.reasons.map((x) => x.title).sort(), ["8-K", "실적", "토요일 공시"].sort());
  assert.equal(r.reasons.find((x) => x.title === "실적").offset, 1);
});

test("사유가 없으면 빈 배열(화면은 '사유 데이터 없음')", () => {
  const rows = bars("2026-03-02", wiggle(30, {}));
  const [r] = T.attachReasons([{ date: rows[25].d, idx: 25, pct: -8, sigma: 1, ratio: 8 }], [], rows.map((x) => x.d));
  assert.deepEqual(r.reasons, []);
});

test("보이는 구간에서 비율 큰 순으로 자르고 날짜순으로 돌려준다", () => {
  const ms = [{ idx: 5, ratio: 3 }, { idx: 10, ratio: 9 }, { idx: 20, ratio: 4 }, { idx: 30, ratio: 8 }];
  assert.deepEqual(T.visibleMoments(ms, 8, 30, 2).map((m) => m.idx), [10, 30]);
  assert.deepEqual(T.visibleMoments(ms, 0, 100).map((m) => m.idx), [5, 10, 20, 30]);
});

// ---- 모으기(US) ----
test("US: 실적(반응 포함)·배당·8-K·자사주·증자·내부자·13D 를 최신순으로", () => {
  const rows = bars("2026-05-18", [100, 100, 110, 99, 100]); // 05-18..05-22
  const items = T.collectTimeline({
    kr: false,
    ticker: "nvda",
    rows,
    earnings: [{ date: "2026-05-20", epsActual: 1.2, epsEstimate: 1.0, surprisePct: 20 }],
    dividends: [["2026-05-01", 0.01], ["bad", 1]],
    usFilings: [
      { ticker: "NVDA", hot: true, fileDate: "2026-05-20", items: [{ code: "2.02", label: "실적 발표" }, { code: "9.01", label: "첨부" }], link: "https://sec/earn" },
      { ticker: "NVDA", hot: false, fileDate: "2026-05-21", items: [{ code: "9.01", label: "첨부" }] }, // 첨부만 → 제외
      { ticker: "NVDA", hot: true, fileDate: "2026-05-15", items: [{ code: "5.02", label: "임원·이사 변동" }], link: "https://sec/502" },
      { ticker: "NVDA", fileDate: "2026-05-12", kind: "buyback", amountUsd: 5e10, items: [], link: "https://sec/bb" },
      { ticker: "AMD", hot: true, fileDate: "2026-05-19", items: [{ code: "1.01", label: "중요계약" }] },
    ],
    usDilution: [{ ticker: "NVDA", formType: "S-3", formLabel: "일괄신고 등록(Shelf)", fileDate: "2026-05-11", url: "https://sec/s3" }],
    insiders: [
      { ticker: "NVDA", code: "S", owner: "Huang", value: 1e7, fileDate: "2026-05-14", link: "https://sec/f4" },
      { ticker: "NVDA", code: "S", owner: "Kress", value: 2e6, fileDate: "2026-05-14" },
      { ticker: "NVDA", code: "M", owner: "Huang", value: 0, fileDate: "2026-05-14" }, // 옵션 행사 → 제외
      { ticker: "NVDA", code: "P", owner: "Dir", value: 5e5, fileDate: "2026-05-13" },
    ],
    activist: [{ ticker: "NVDA", form: "13G", filer: "Vanguard", kindLabel: "단순투자(수동)", fileDate: "2026-05-10", link: "https://sec/13g" }],
  });
  const titles = items.map((e) => `${e.date} ${e.cat} ${e.title}`);
  assert.deepEqual(titles, [
    "2026-05-20 earn 실적 발표",
    "2026-05-15 filing 8-K 주요 공시",
    "2026-05-14 own 내부자 매도(Form 4) 2건",
    "2026-05-13 own 내부자 매수(Form 4)",
    "2026-05-12 filing 자사주 매입 발표(8-K)",
    "2026-05-11 filing 증자 서류 S-3",
    "2026-05-10 own 13G 대량보유",
    "2026-05-01 corp 배당락",
  ]);
  const earn = items[0];
  assert.match(earn.detail, /EPS 1\.20 \(예상 1\.00, 차이 \+20\.0%\)/);
  assert.match(earn.detail, /발표일 종가 \+10\.0% · 다음 날 −10\.0%/);
  assert.equal(earn.link, "https://sec/earn"); // 실적 8-K 는 실적 항목에 링크로 합쳐진다
  assert.deepEqual(earn.goto, { view: "fin", card: "stockEarningsCard" });
  assert.match(items[2].detail, /Huang, Kress · 합계 \$12\.0M/);
  assert.match(items[4].detail, /\$50\.0B/);
});

test("US: 제출 시각을 아는 과거 반응(EARNINGS_MOVE_COMPARE)이 일봉 계산보다 우선", () => {
  const items = T.collectTimeline({
    ticker: "MU",
    rows: bars("2026-06-22", [100, 100, 100, 115, 115]),
    earnings: [{ date: "2026-06-24", epsActual: 2, epsEstimate: 1.5 }],
    earnMoves: { past: { events: [{ filedEt: "2026-06-24 16:02", session: "amc", reactionDate: "2026-06-25", movePct: 15.74 }] } },
  });
  assert.equal(items.length, 1);
  assert.match(items[0].detail, /반응 \+15\.7%\(장 마감 후 발표 → 다음 날 06\/25\)/);
  assert.equal(items[0].pct, 15.74);
});

// ---- 모으기(KR) ----
test("KR: DART 공시는 rcpNo 로 상세(배당·수주·지분·희석)와 합치고 부속 서류는 뺀다", () => {
  const L = (n) => `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${n}`;
  const items = T.collectTimeline({
    kr: true,
    ticker: "005930",
    krFilings: [
      { ticker: "005930", typeLabel: "공급계약", title: "단일판매ㆍ공급계약체결", fileDate: "2026-09-22", link: L("20260922000001") },
      { ticker: "005930", typeLabel: "대량보유상황보고", title: "주식등의대량보유상황보고서", fileDate: "2026-09-21", link: L("20260921000002") },
      { ticker: "005930", typeLabel: "증자·사채", title: "전환사채권발행결정", fileDate: "2026-09-20", link: L("20260920000003") },
      { ticker: "005930", typeLabel: "투자설명서", title: "투자설명서", fileDate: "2026-09-20", link: L("20260920000004") },
      { ticker: "000660", typeLabel: "공급계약", title: "다른 종목", fileDate: "2026-09-22", link: L("20260922000009") },
    ],
    krEventDetails: { "20260920000003": { convPrice: 3873, dilutionPct: 34.09, amount: 15e9, method: "사모" } },
    krContracts: [{ ticker: "005930", amount: 2.8e10, salesRatio: 10.5, counterparty: "해외 고객", date: "2026-09-22", link: L("20260922000001") }],
    krMajor: [{ ticker: "005930", filer: "국민연금", ratio: 7.1, ratioChange: -0.5, reportType: "일반", fileDate: "2026-09-21", link: L("20260921000002") }],
    krDividends: [{ ticker: "005930", divKind: "분기배당", dps: 361, yieldPct: 0.5, recordDate: "2026-09-30", date: "2026-09-15", link: L("20260915000005") }],
    earnReactions: [{ ticker: "005930", date: "2026-07-07", dayPct: -1.2, nextPct: 2.3, link: L("20260707000006") }],
    krReports: [
      { date: "2026-09-23", broker: "유안타증권", target: 630000, opinion: "Buy" },
      { date: "2026-08-01", broker: "유안타증권", target: 500000, opinion: "Buy" },
    ],
  });
  const titles = items.map((e) => `${e.date} ${e.cat} ${e.title}`);
  assert.deepEqual(titles, [
    "2026-09-23 target 유안타증권 목표가",
    "2026-09-22 filing 공급계약 체결",
    "2026-09-21 own 5% 대량보유 보고",
    "2026-09-20 filing 증자·사채",
    "2026-09-15 corp 배당 결정",
    "2026-08-01 target 유안타증권 목표가",
    "2026-07-07 earn 잠정실적 공시",
  ]);
  assert.match(items[0].detail, /630,000원 \(직전 500,000원에서 상향\) · Buy/);
  assert.match(items[1].detail, /계약 280억 · 매출 대비 10\.5% · 해외 고객/);
  assert.match(items[2].detail, /국민연금 · 지분 7\.10% \(−0\.50%p\)/);
  assert.match(items[3].detail, /희석 34\.1% · 전환가 3,873원 · 금액 150억 · 사모/);
  assert.match(items[4].detail, /주당 361원 · 시가배당률 0\.5% · 기준일 2026-09-30/);
  assert.match(items[6].detail, /발표일 −1\.2% · 다음 날 \+2\.3%/);
});

test("특징주 사유·키 모먼트·과거 이벤트 기록(지금 창과 겹치면 제외)", () => {
  const items = T.collectTimeline({
    ticker: "PPLI",
    movers: { tradeDate: "2026-09-25", up: [{ ticker: "PPLI", changePct: 11.33, reason: "MGM과 합병 협상 소식", reasonStatus: "ok", evidence: [{ link: "https://news/x" }] }], down: [] },
    usFilings: [{ ticker: "PPLI", hot: true, fileDate: "2026-09-24", items: [{ code: "1.01", label: "중요계약 체결" }] }],
    history: {
      scale: 1000,
      labels: { us_8k_101: "주요 계약 체결 (8-K 1.01)", us_earn: "실적 발표 (8-K 2.02)" },
      // d0 는 2000-01-01 부터 일수: 9764 = 2026-09-25, 9500 = 2026-01-04
      rows: [["us_8k_101", 9764, 85, 72, null, null], ["us_earn", 9500, -54, null, null, null]],
    },
    moments: [{ date: "2026-09-25", pct: 11.33, sigma: 2.1, ratio: 5.4, lookback: 60 }],
  });
  const titles = items.map((e) => `${e.date} ${e.cat} ${e.title}`);
  assert.deepEqual(titles, [
    "2026-09-25 move 특징주 +11.33%",
    "2026-09-25 move 큰 등락 +11.3%",
    "2026-09-24 filing 8-K 주요 공시",
    "2026-01-04 earn 실적 발표 (8-K 2.02)",
  ]);
  assert.match(items[0].detail, /MGM과 합병 협상 소식 \(자동 요약/);
  assert.equal(items[0].link, "https://news/x");
  assert.match(items[1].detail, /표준편차 2\.1%\)의 5\.4배/);
  assert.deepEqual(items[1].goto, { chart: "2026-09-25" });
  assert.match(items[3].detail, /시장 대비 0~\+1일 −5\.4%/);
  assert.deepEqual(items[3].goto, { study: "us_earn" });
});

test("분류 필터·개수·날짜 범위", () => {
  const items = [{ cat: "earn" }, { cat: "filing" }, { cat: "filing" }, { cat: "move" }];
  assert.equal(T.filterItems(items, "filing").length, 2);
  assert.equal(T.filterItems(items, "all").length, 4);
  const c = T.countByCat(items);
  assert.equal(c.all, 4);
  assert.equal(c.filing, 2);
  assert.equal(c.own, 0);
  assert.deepEqual(T.dateWindow([{ fileDate: "2026-09-20" }, { fileDate: "2026-09-18" }, { fileDate: "x" }]), { from: "2026-09-18", to: "2026-09-20" });
  assert.equal(T.dateWindow([]), null);
});

test("일봉 반응: 휴장일 발표는 다음 거래일, 첫 봉은 계산하지 않는다", () => {
  const rows = bars("2026-05-18", [100, 105, 105]);
  assert.equal(T.reactionFromRows(rows, "2026-05-18"), null);
  const r = T.reactionFromRows(rows, "2026-05-16"); // 토 → 05-18 첫 봉 → 이전 봉 없음
  assert.equal(r, null);
  const r2 = T.reactionFromRows(rows, "2026-05-19");
  assert.equal(r2.date, "2026-05-19");
  assert.ok(Math.abs(r2.dayPct - 5) < 1e-9);
  assert.equal(r2.nextPct, 0);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log(`timeline core: ${passed} passed`);
