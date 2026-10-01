// 한눈 요약 · 오늘·임박 이벤트 순수 함수(stock-summary-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_stock_summary_core.mjs   (CI 의 "Stock summary core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../stock-summary-core.js");

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

const KR_FIN = {
  schema: 1, market: "kr", basis: "CFS", currency: "KRW", lastFiled: "2026-08-14",
  annual: [
    { fy: 2020, rev: 236.8e12, op: 35.99e12, net: 26.09e12 },
    { fy: 2021, rev: 279.6e12, op: 51.63e12, net: 39.24e12 },
    { fy: 2022, rev: 302.2e12, op: 43.38e12, net: 54.73e12 },
    { fy: 2023, rev: 258.9e12, op: 6.57e12, net: 14.47e12 },
    { fy: 2024, rev: 300.9e12, op: 32.73e12, net: 33.62e12 },
    { fy: 2025, rev: 333605938000000, op: 43601051000000, net: 44260956000000 },
  ],
};
const US_FIN = {
  schema: 1, market: "us", currency: "USD", annualForm: "10-K", lastFiled: "2026-08-26",
  annual: [
    { fy: 2025, end: "2025-01-26", rev: 130497e6, op: 81453e6, net: 72880e6 },
    { fy: 2026, end: "2026-01-25", rev: 215938e6, op: 130387e6, net: 120067e6 },
  ],
};

// ── 조사·금액 ──
test("조사: 받침 유무(한글·영문·숫자)", () => {
  assert.equal(core.topic("삼성전자"), "삼성전자는");
  assert.equal(core.topic("에코프로비엠"), "에코프로비엠은");
  assert.equal(core.topic("엔비디아"), "엔비디아는");
  assert.equal(core.topic("NVDA"), "NVDA는");
  assert.equal(core.topic("AMZN"), "AMZN은");
  assert.equal(core.topic("005930"), "005930은");
  assert.equal(core.topic("Apple Inc."), "Apple Inc.는");
});

test("금액: 문장용·표용 단위", () => {
  assert.equal(core.moneyLong(333605938000000, "KRW"), "333조 6,059억원");
  assert.equal(core.moneyLong(1575572000000000, "KRW"), "1,575조 5,720억원");
  assert.equal(core.moneyLong(66850000000, "KRW"), "669억원");
  assert.equal(core.moneyLong(215938e6, "USD"), "$215.94B");
  assert.equal(core.moneyLong(5.503958e12, "USD"), "$5.50T");
  assert.equal(core.moneyShort(333.6e12, "KRW"), "334조");
  assert.equal(core.moneyShort(43.6e12, "KRW"), "43.6조");
  assert.equal(core.moneyShort(66850000000, "KRW"), "669억");
  assert.equal(core.moneyShort(-1.2e12, "KRW"), "-1.2조");
  assert.equal(core.moneyShort(215938e6, "USD"), "$216B");
  assert.equal(core.moneyShort(81453e6, "USD"), "$81.5B");
  assert.equal(core.moneyShort(512e6, "USD"), "$512M");
  assert.equal(core.moneyShort(9e9, "TWD"), "9.0B TWD");
  assert.equal(core.moneyLong(null, "KRW"), "");
});

test("전년 대비: 증감·흑자/적자 전환·매출은 전환 표기 없음", () => {
  assert.equal(core.yoyText(110, 100, true), "전년 대비 +10.0%");
  assert.equal(core.yoyText(90, 100, true), "전년 대비 −10.0%");
  assert.equal(core.yoyText(250, 100, true), "전년 대비 +150%");
  assert.equal(core.yoyText(10, -5, true), "흑자 전환");
  assert.equal(core.yoyText(-10, 5, true), "적자 전환");
  assert.equal(core.yoyText(-10, -5, true), "적자 지속");
  assert.equal(core.yoyText(-10, 5, false), "");
  assert.equal(core.yoyText(10, null, true), "");
});

// ── 한눈 요약 ──
test("KR 요약: 소개·실적 문장·컨센서스·표 5개년·캡션", () => {
  const s = core.buildSummary({
    kr: true, name: "삼성전자", code: "005930", marketLabel: "코스피", sectorText: "반도체",
    marketCap: 1575.572e12, capAsOf: "2026-09-30", fin: KR_FIN,
    consensus: { kind: "kr", target: 468348, count: 27, asOf: "2026-09-29", source: "FnGuide" },
    events: [], catLabel: {},
  });
  assert.equal(s.show, true);
  assert.equal(s.sentences[0], "삼성전자(005930)는 코스피 상장 반도체 기업으로, 시가총액은 1,575조 5,720억원입니다.");
  assert.equal(s.sentences[1], "2025년 연간 매출은 333조 6,059억원(전년 대비 +10.9%), 영업이익은 43조 6,011억원(전년 대비 +33.2%)입니다.");
  assert.equal(s.sentences[2], "증권사 27곳 추정 기준 목표주가 컨센서스는 468,348원입니다.");
  assert.deepEqual(s.table.cols, ["2021", "2022", "2023", "2024", "2025"]);
  assert.deepEqual(s.table.rows.map((r) => r.label), ["매출", "영업이익", "순이익"]);
  assert.equal(s.table.rows[0].cells[4].text, "334조");
  assert.ok(s.notes.some((n) => n === "시가총액 2026.09.30 종가 기준"));
  assert.ok(s.notes.some((n) => /DART 연결재무제표 2025년 · 반영 공시 2026\.08\.14/.test(n)));
  assert.ok(s.notes.some((n) => /목표주가 FnGuide 2026\.09\.29 기준/.test(n)));
  // 판단 문구 없음
  assert.ok(!/호재|긍정|부정|상승여력|매수|저평가/.test(s.sentences.join(" ")));
});

test("US 요약: FY 결산일·평균 목표가 범위·사업부문 한 줄", () => {
  const s = core.buildSummary({
    kr: false, name: "엔비디아", code: "NVDA", marketLabel: "나스닥", sectorText: "기술 섹터",
    marketCap: 5.503958e12, capAsOf: "2026-09-30", fin: US_FIN,
    consensus: { kind: "us", avg: 260.5, lo: 180, hi: 352, n: 58, asOf: "2026-09-29", source: "Nasdaq" },
    segments: { rows: [{ label: "Compute & Networking", share: 0.89 }, { label: "Graphics", share: 0.11 }], fy: 2026, form: "10-K" },
    events: [], catLabel: {},
  });
  assert.equal(s.sentences[0], "엔비디아(NVDA)는 나스닥 상장 기술 섹터 기업으로, 시가총액은 $5.50T입니다.");
  assert.equal(s.sentences[1], "FY2026(2026.01.25 결산) 매출은 $215.94B(전년 대비 +65.5%), 영업이익은 $130.39B(전년 대비 +60.1%)입니다.");
  assert.equal(s.sentences[2], "애널리스트 58명의 평균 목표주가는 $260.50, 범위는 $180.00~$352.00입니다.");
  assert.equal(s.segment.text, "주요 사업부문 Compute & Networking 89% · Graphics 11%");
  assert.deepEqual(s.table.cols, ["FY2025", "FY2026"]);
  const five = core.buildSummary({ kr: false, name: "A", code: "A", fin: { ...US_FIN, annual: [2022, 2023, 2024, 2025, 2026].map((fy) => ({ fy, rev: 1e9 * fy })) } });
  assert.equal(five.table.wide, true);
});

test("빠진 절은 문장에서 통째로 뺀다(자리표시 없음)", () => {
  const noCapNoMarket = core.buildSummary({
    kr: true, name: "테스트", code: "123450", sectorText: "", marketCap: null,
    fin: { market: "kr", currency: "KRW", annual: [{ fy: 2025, rev: 1e11, op: -2e9 }] }, events: [],
  });
  // 소개 문장 없음(업종·시장·시총 모두 없음), 직전 연도가 없어 증감 없음, 영업손실 표기
  assert.equal(noCapNoMarket.sentences.length, 1);
  assert.equal(noCapNoMarket.sentences[0], "2025년 연간 매출은 1,000억원, 영업손실은 20억원입니다.");
  assert.equal(noCapNoMarket.table, null); // 1개 연도만 → 표 없음
  assert.equal(noCapNoMarket.show, true);
  const all = noCapNoMarket.sentences.join(" ");
  assert.ok(!/—|undefined|null|NaN|\?/.test(all));

  const marketOnly = core.buildSummary({ kr: true, name: "가나다", code: "000001", marketLabel: "코스닥", marketCap: 5e11, events: [{ date: "2026-09-30", cat: "filing", title: "DART 공시", detail: "x" }] });
  assert.equal(marketOnly.sentences[0], "가나다(000001)는 코스닥 상장사로, 시가총액은 5,000억원입니다.");

  const capOnly = core.buildSummary({ kr: false, name: "", code: "ABCD", marketCap: 1.5e9, events: [{ date: "2026-09-30", cat: "filing", title: "8-K 공시" }] });
  assert.equal(capOnly.sentences[0], "ABCD의 시가총액은 $1.50B입니다.");
});

test("숨김: ETF · 시총만 있음 · 아무것도 없음", () => {
  assert.equal(core.buildSummary({ kr: false, isEtf: true, name: "SPY", fin: US_FIN }).show, false);
  assert.equal(core.buildSummary({ kr: false, name: "XYZ", code: "XYZ", marketCap: 1e9, events: [] }).show, false);
  assert.equal(core.buildSummary({}).show, false);
});

test("최근 공시: 가격·과거 기록·목표가 제외, 최대 5건, 날짜 MM.DD", () => {
  const ev = [
    { date: "2026-09-30", cat: "move", src: "moment", title: "큰 등락 +5%" },
    { date: "2026-09-29", cat: "filing", src: "dart", title: "DART 공시", detail: "주요사항보고서(자기주식취득결정)" },
    { date: "2026-09-28", cat: "target", src: "krReports", title: "증권사 목표가" },
    { date: "2026-09-27", cat: "own", src: "krInsiders", title: "임원·주요주주 소유 변동", detail: "홍길동 · +1,000주" },
    { date: "2021-01-01", cat: "earn", src: "history", title: "과거 실적" },
    { date: "2026-09-20", cat: "earn", src: "earnings", title: "실적 공시" },
    { date: "2026-09-19", cat: "corp", src: "dividends", title: "배당락" },
    { date: "2026-09-18", cat: "filing", src: "dart", title: "DART 공시" },
    { date: "2026-09-17", cat: "filing", src: "dart", title: "여섯번째" },
  ];
  const s = core.buildSummary({ kr: true, name: "가", code: "1", fin: KR_FIN, events: ev, today: "2026-10-01", catLabel: { filing: "공시", own: "지분·내부자", earn: "실적", corp: "배당·분할" } });
  assert.equal(s.events.length, 5);
  assert.deepEqual(s.events.map((e) => e.dateText), ["09.29", "09.27", "09.20", "09.19", "09.18"]);
  // 지난해 이전 항목은 연도까지
  const old = core.buildSummary({ kr: false, name: "A", code: "A", fin: US_FIN, today: "2026-10-01", events: [{ date: "2025-10-18", cat: "earn", title: "실적 발표" }] });
  assert.equal(old.events[0].dateText, "2025.10.18");
  assert.equal(old.table.wide, false); // 2개 연도뿐이면 숨길 필요 없음
  assert.equal(s.table.wide, false);
  assert.equal(s.events[0].badge, "공시");
});

// ── 오늘·임박 이벤트 ──
test("US: 실적 D-0..D-7 · 배당락 · 범위 밖 제외 · 가까운 순 최대 2개", () => {
  const today = "2026-10-01";
  assert.deepEqual(core.buildEventStrip({ today, kr: false, usCalendar: { nextEarnings: "2026-10-09", exDate: "2026-09-10" } }), []);
  const r = core.buildEventStrip({ today, kr: false, usCalendar: { nextEarnings: "2026-10-01", exDate: "2026-10-06", divRate: 1.08 } });
  assert.equal(r.length, 2);
  assert.equal(r[0].kind, "earnings");
  assert.equal(r[0].when, "오늘");
  assert.equal(r[1].kind, "dividend");
  assert.equal(r[1].when, "D-5");
  assert.equal(r[1].detail, "연 배당 $1.08 기준");
  const r7 = core.buildEventStrip({ today, kr: false, usCalendar: { nextEarnings: "2026-10-08" } });
  assert.equal(r7[0].when, "D-7");
});

test("KR: IR 실적만·배당 기준일 중복 제거·보호예수·새 공시(오늘·어제) 묶음", () => {
  const today = "2026-10-01";
  const r = core.buildEventStrip({
    today, kr: true, max: 5,
    krIr: [{ date: "2026-10-03", earnings: false, purpose: "NDR" }, { date: "2026-10-07", earnings: true, purpose: "2026년 3분기 경영실적 발표" }],
    krDividends: [
      { divKind: "분기배당", recordDate: "2026-10-02", dps: 361 },
      { divKind: "분기배당", recordDate: "2026-10-02", dps: 361 },
    ],
    lockups: [{ date: "2026-10-04", pct: 23.2, shares: 4347203 }, { date: "2026-12-04", pct: 5 }],
    recent: [
      { date: "2026-09-30", cat: "filing", src: "dart", title: "DART 공시", detail: "주요사항보고서(자기주식취득결정)" },
      { date: "2026-09-30", cat: "own", src: "krInsiders", title: "임원·주요주주 소유 변동", detail: "a" },
      { date: "2026-09-30", cat: "move", src: "moment", title: "큰 등락" },
      { date: "2026-09-25", cat: "filing", src: "dart", title: "오래된 공시" },
    ],
  });
  // 같은 거리(D-1 · 어제)면 일정이 공시보다 먼저
  assert.deepEqual(r.map((e) => e.kind), ["dividend", "filing", "lockup", "earnings"]);
  assert.equal(r[1].label, "새 공시 2건");
  assert.equal(r[1].when, "어제");
  assert.equal(r[1].detail, "DART 공시 · 주요사항보고서(자기주식취득결정)");
  assert.equal(r[0].detail, "분기배당 · 주당 361원");
  assert.equal(r[2].detail, "공모 후 주식수의 23.2%");
  assert.equal(r[3].label, "실적 IR 예정");
  // 기본 max=2
  assert.equal(core.buildEventStrip({ today, kr: true, krDividends: [{ recordDate: "2026-10-02" }], lockups: [{ date: "2026-10-03" }, { date: "2026-10-05" }] }).length, 2);
});

test("이벤트 줄: 오늘이 없거나 아무것도 없으면 빈 목록, 같은 날이면 실적이 공시보다 먼저", () => {
  assert.deepEqual(core.buildEventStrip({}), []);
  assert.deepEqual(core.buildEventStrip({ today: "2026-10-01", kr: false }), []);
  const r = core.buildEventStrip({
    today: "2026-10-01", kr: false, usCalendar: { nextEarnings: "2026-10-01" },
    recent: [{ date: "2026-10-01", cat: "filing", src: "8k", title: "8-K 공시", detail: "Item 7.01" }],
  });
  assert.deepEqual(r.map((e) => e.kind), ["earnings", "filing"]);
  assert.equal(r[1].when, "오늘");
  // US 모드에는 KR 일정이 섞이지 않는다
  assert.deepEqual(core.buildEventStrip({ today: "2026-10-01", kr: false, krDividends: [{ recordDate: "2026-10-02" }] }), []);
});

if (failures.length) {
  console.error(`stock summary core: ${failures.length} failed, ${passed} passed`);
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`stock summary core: ${passed} passed`);
