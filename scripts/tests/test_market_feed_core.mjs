// 시장 전체 '오늘 피드' 순수 계산(market-feed-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_market_feed_core.mjs   (CI 의 "Market feed core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const F = require("../../market-feed-core.js");

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

const US_SRC = {
  market: "us",
  today: "2026-09-30",
  names: { AAA: "Alpha Inc", BBB: "Beta Corp" },
  events: {
    updatedAtKst: "2026-09-30 19:32 KST", lastFileDate: "2026-09-30",
    events: [
      { ticker: "AAA", company: "ALPHA INC", fileDate: "2026-09-30", items: [{ code: "5.02", label: "임원 변동" }, { code: "9.01", label: "첨부" }], link: "https://sec.gov/a",
        summary: { item: "5.02", what: "CFO 사임", who: "Jane Doe", amount: "", date: "2026-09-29", src: "rule" } },
      // 2.02 단독 + 같은 날 보도자료 → 실적 한 줄로 합친다.
      { ticker: "BBB", fileDate: "2026-09-30", items: [{ code: "2.02", label: "실적 발표" }, { code: "9.01", label: "첨부" }], link: "https://sec.gov/b" },
      { ticker: "CCC", fileDate: "2026-09-29", kind: "buyback", amountUsd: 5e9, items: [], link: "https://sec.gov/c" },
      { ticker: "DDD", fileDate: "2026-09-29", items: [{ code: "9.01", label: "첨부" }] }, // 9.01 만 → 빠짐
    ],
  },
  releases: {
    updatedAtKst: "2026-09-30 19:32 KST",
    releases: [{ ticker: "BBB", company: "BETA CORP", fileDate: "2026-09-30", period: "Q3", oneLine: "매출이 전년보다 늘었다.", exhibitUrl: "https://sec.gov/bx" }],
  },
  usCalendar: { updatedAtKst: "x", stocks: { AAA: { nextEarnings: "2026-10-02" }, OLD: { nextEarnings: "2026-07-01" } } },
  earnSnap: { earnings: [{ ticker: "AAA", nextDate: "2026-07-28" }] },
  insider: {
    updatedAtKst: "2026-09-30 19:30 KST", lastFileDate: "2026-09-29",
    trades: [
      { ticker: "AAA", owner: "Kim", code: "S", value: 1000000, fileDate: "2026-09-29", link: "l1" },
      { ticker: "AAA", owner: "Lee", code: "S", value: 500000, fileDate: "2026-09-29", link: "l2" },
      { ticker: "AAA", owner: "Kim", code: "P", value: 20000, fileDate: "2026-09-29", link: "l3" },
      { ticker: "BBB", owner: "Park", code: "M", value: 0, fileDate: "2026-09-29" }, // 옵션 행사 → 빠짐
      { ticker: "BBB", owner: "Park", code: "G", value: 0, fileDate: "2026-09-29" }, // 증여 → 빠짐
    ],
  },
  form144: {
    updatedAtKst: "2026-09-30 19:30 KST", lastFileDate: "2026-09-29",
    filings: [{ ticker: "BBB", issuer: "BETA", person: "Park", relation: "이사", shares: 1000, sharesOutstanding: 1e6, marketValue: 50000, approxSaleDate: "2026-09-29", fileDate: "2026-09-29", link: "f1", match: { status: "pending" } }],
  },
  movers: {
    market: "us", tradeDate: "2026-09-30", updatedAtKst: "2026-10-01 10:31 KST",
    up: [
      { ticker: "AAA", changePct: 5.2, reason: "신제품 발표", reasonStatus: "ok", evidence: [{ link: "https://n/1" }] },
      { ticker: "EEE", changePct: 12.5, reasonStatus: "none" },
    ],
    down: [{ ticker: "FFF", changePct: -8.1, reasonStatus: "failed", sectorNote: "업종 동반 하락" }],
  },
  econ: [
    { country: "미국", importance: 3, event: "CPI", datetime: "2026-09-30 21:30", time: "21:30", actual: "3.1%", forecast: "3.0%" },
    { country: "한국", importance: 3, event: "수출", datetime: "2026-09-30 08:00", time: "08:00" },
    { country: "미국", importance: 1, event: "작은 지표", datetime: "2026-09-30 22:00", time: "22:00" },
    { country: "미국", importance: 2, event: "주간 지표", datetime: "2026-10-02 21:30", time: "21:30" },
  ],
};

const KR_SRC = {
  market: "kr",
  today: "2026-10-01",
  names: { "005930": "삼성전자" },
  dart: {
    updatedAtKst: "2026-09-30 21:54 KST", lastFileDate: "2026-09-30",
    disclosures: [
      { ticker: "005930", company: "삼성전자", title: "단일판매·공급계약체결", typeLabel: "공급계약", fileDate: "2026-09-30", link: "https://dart/?rcpNo=20260930000001" },
      { ticker: "005930", company: "삼성전자", title: "단일판매·공급계약체결", typeLabel: "공급계약", fileDate: "2026-09-30", link: "https://dart/?rcpNo=20260930000001" }, // 중복
      { ticker: "000001", company: "가나다", title: "투자설명서", typeLabel: "투자설명서", fileDate: "2026-09-30", link: "https://dart/?rcpNo=20260930000002" }, // 잡음
      { ticker: "000002", company: "라마바", title: "독립이사의선임", typeLabel: "공시", fileDate: "2026-09-29", link: "https://dart/?rcpNo=20260929000003" },
    ],
  },
  ir: {
    updatedAtKst: "2026-10-01 09:50 KST",
    rows: [{ code: "000660", company: "SK하이닉스", date: "2026-09-30", time: "9:00", purpose: "실적 설명", method: "컨퍼런스콜", earnings: true, link: "https://dart/ir" }],
  },
  lockups: { updatedAtKst: "2026-10-01 09:51 KST", releases: [{ code: "279570", company: "케이뱅크", date: "2026-10-06", shares: 1000000, pct: 2.5, periods: ["6개월"], types: { "최대주주 등": 1 } }] },
  movers: {
    market: "kr", tradeDate: "2026-09-30", updatedAtKst: "2026-09-30 22:54 KST",
    up: [{ ticker: "002710", company: "TCC스틸", changePct: 29.98, reason: "LNG 투자 발표", reasonStatus: "ok", sectorNote: "철강 업종 동반 상승" }],
    down: [],
  },
  econ: US_SRC.econ,
};

test("US: 8-K 는 9.01 을 빼고 Item 제목·3줄 요약을 붙인다", () => {
  const items = F.collect(US_SRC);
  const a = items.find((e) => e.type === "8k" && e.ticker === "AAA");
  assert.equal(a.text, "임원 변동");
  assert.equal(a.name, "Alpha Inc"); // 스냅샷 이름 우선
  assert.deepEqual(a.lines, ["CFO 사임", "Jane Doe", "사건일 2026-09-29"]);
  assert.equal(a.linesLabel, "규칙 요약");
  assert.ok(!items.some((e) => e.ticker === "DDD"), "9.01 만 있는 8-K 는 빠진다");
});

test("US: 2.02 단독 8-K 는 같은 날 보도자료가 있으면 실적 한 줄로 합친다", () => {
  const items = F.collect(US_SRC);
  assert.ok(!items.some((e) => e.type === "8k" && e.ticker === "BBB"));
  const rel = items.find((e) => e.type === "earn" && e.ticker === "BBB");
  assert.match(rel.text, /실적 보도자료 · Q3 — 매출이 전년보다 늘었다/);
  assert.equal(rel.link, "https://sec.gov/bx");
});

test("US: 자사주 매입 발표는 규모와 함께", () => {
  const c = F.collect(US_SRC).find((e) => e.ticker === "CCC");
  assert.equal(c.type, "8k");
  assert.equal(c.text, "자사주 매입 발표 · 규모 $5.0B");
});

test("US: Form 4 는 매수·매도만, 같은 날·종목·방향을 한 줄로", () => {
  const ins = F.collect(US_SRC).filter((e) => e.type === "insider");
  assert.equal(ins.length, 2);
  const sell = ins.find((e) => e.side === "S");
  assert.equal(sell.text, "Form 4 매도 2건 · Kim, Lee · 합계 $1.5M");
  const buy = ins.find((e) => e.side === "P");
  assert.equal(buy.text, "Form 4 매수 · Kim · 합계 $20K");
});

test("US: Form 144 는 예정 매도 한 줄 + Form 4 대조 상태", () => {
  const f = F.collect(US_SRC).find((e) => e.type === "form144");
  assert.match(f.text, /^매도 예정 신고 · Park\(이사\) · 예정 1,000주\(발행주식의 0\.10%\)/);
  assert.equal(f.sub, "Form 4 대조: 아직");
});

test("US: 실적 예정일은 오늘 −7일 이후만(지난 스냅샷 예정일 무시)", () => {
  const sch = F.collect(US_SRC).filter((e) => e.type === "earn" && e.scheduled);
  assert.deepEqual(sch.map((e) => [e.ticker, e.date]), [["AAA", "2026-10-02"]]);
});

test("특징주: 사유 없음·검증 실패는 중립 문구, 업종 메모는 덧붙임", () => {
  const mv = F.collect(US_SRC).filter((e) => e.type === "movers");
  assert.equal(mv.length, 3);
  assert.equal(mv.find((e) => e.ticker === "AAA").text, "+5.20% · 신제품 발표");
  assert.equal(mv.find((e) => e.ticker === "AAA").link, "https://n/1");
  assert.equal(mv.find((e) => e.ticker === "EEE").text, "+12.50% · 뚜렷한 재료 확인 안 됨");
  assert.equal(mv.find((e) => e.ticker === "FFF").text, "−8.10% · 뚜렷한 사유 확인 안 됨 · 업종 동반 하락");
  assert.equal(mv[0].time, "16:00");
  assert.equal(mv[0].timeNote, "장 마감");
});

test("특징주: 다른 시장 파일이 남아 있으면 쓰지 않는다", () => {
  const items = F.collect({ ...KR_SRC, movers: US_SRC.movers });
  assert.equal(items.filter((e) => e.type === "movers").length, 0);
});

const kr0 = () => F.collect(KR_SRC).find((e) => e.type === "econ").time; // 국내는 KST 그대로

test("KST → 미 동부 변환: 날짜가 넘어가면 동부 날짜로", () => {
  assert.deepEqual(F.kstToMarket("2026-10-29", "03:00", "us"), { date: "2026-10-28", time: "14:00" });
  assert.deepEqual(F.kstToMarket("2026-12-10", "22:30", "us"), { date: "2026-12-10", time: "08:30" }); // 표준시(−5)
  assert.deepEqual(F.kstToMarket("2026-10-29", "03:00", "kr"), { date: "2026-10-29", time: "03:00" });
  assert.deepEqual(F.kstToMarket("2026-10-29", "", "us"), { date: "2026-10-29", time: "" });
});

test("경제지표: 이 시장 나라·중요도 2 이상만", () => {
  const us = F.collect(US_SRC).filter((e) => e.type === "econ");
  assert.deepEqual(us.map((e) => e.text.split(" · ")[0]).sort(), ["CPI", "주간 지표"]);
  const cpi = us.find((e) => e.text.startsWith("CPI"));
  assert.equal(cpi.time, "08:30"); // KST 21:30 → 미 동부(서머타임) 08:30
  assert.equal(cpi.timeNote, "KST 21:30");
  assert.equal(kr0(), "08:00");
  const kr = F.collect(KR_SRC).filter((e) => e.type === "econ");
  assert.deepEqual(kr.map((e) => e.text), ["수출"]);
});

test("KR: DART 잡음 서류·같은 접수번호 중복을 뺀다", () => {
  const d = F.collect(KR_SRC).filter((e) => e.type === "dart");
  assert.equal(d.length, 2);
  assert.equal(d[0].text, "공급계약 · 단일판매·공급계약체결");
  assert.equal(d[1].text, "독립이사의선임"); // typeLabel '공시' 는 접두어를 붙이지 않는다
});

test("KR: IR 시각 정규화·보호예수는 추정일로 표기", () => {
  const items = F.collect(KR_SRC);
  const ir = items.find((e) => e.type === "ir");
  assert.equal(ir.time, "09:00");
  assert.match(ir.text, /^기업설명회\(실적\) · 실적 설명 · 컨퍼런스콜/);
  const lk = items.find((e) => e.type === "lockup");
  assert.match(lk.text, /^보호예수 해제\(추정일\)/);
  assert.equal(lk.date, "2026-10-06");
});

test("기준일: 오늘 자료가 있으면 오늘, 일정(예정·경제지표·보호예수)은 기준일을 끌지 않는다", () => {
  const items = F.collect(US_SRC);
  const p = F.pickDate(items, "2026-09-30");
  assert.equal(p.date, "2026-09-30");
  assert.equal(p.reason, "today");
  assert.ok(!p.dates.includes("2026-10-02"), "앞날짜 실적 예정·경제지표는 자료일 목록에 없다");
  assert.deepEqual(p.dates, ["2026-09-30", "2026-09-29"]);
});

test("기준일: 주말·휴장·수집 전·요청일·자료 없음", () => {
  const items = F.collect(US_SRC);
  assert.equal(F.pickDate(items, "2026-10-03").reason, "weekend"); // 토요일
  const hol = F.pickDate(items, "2026-10-01", "", [{ date: "2026-10-01", name: "임시 휴장" }]);
  assert.equal(hol.reason, "holiday");
  assert.equal(hol.date, "2026-09-30");
  assert.match(F.dateNote(hol, "us"), /휴장일\(임시 휴장\)/);
  const nyet = F.pickDate(items, "2026-10-01");
  assert.equal(nyet.reason, "notYet");
  assert.match(F.dateNote(nyet, "us"), /아직 수집 전이라 가장 최근 자료일 09\/30/);
  assert.equal(F.pickDate(items, "2026-09-30", "2026-09-29").date, "2026-09-29");
  assert.equal(F.pickDate(items, "2026-09-30", "2026-09-29").reason, "requested");
  assert.equal(F.pickDate(items, "2026-10-01", "2026-09-30").reason, "notYet"); // 최신 자료일을 고르면 자동 안내 그대로
  assert.equal(F.pickDate(items, "2026-09-30", "2026-08-01").date, "2026-09-30"); // 없는 날짜 요청 → 최신
  assert.equal(F.pickDate([], "2026-09-30").reason, "none");
  const kr = F.pickDate(F.collect(KR_SRC), "2026-10-01");
  assert.equal(kr.date, "2026-09-30");
});

test("하루 목록 정렬: 시각 있는 항목(늦은 시각 먼저) → 종류 순, 특징주는 등락폭 큰 순", () => {
  const day = F.forDate(F.collect(US_SRC), "2026-09-30");
  assert.deepEqual(day.filter((e) => e.time).map((e) => e.type), ["movers", "movers", "movers", "econ"]); // 16:00 장 마감 > 08:30
  const mv = day.filter((e) => e.type === "movers").map((e) => e.ticker);
  assert.deepEqual(mv, ["EEE", "FFF", "AAA"]);
  const untimed = day.filter((e) => !e.time).map((e) => e.type);
  assert.deepEqual(untimed, ["8k", "earn"]);
});

test("칩 개수 = 필터 결과 행 수, 0건 종류는 칩이 없다", () => {
  const day = F.forDate(F.collect(US_SRC), "2026-09-29");
  const counts = F.countByType(day);
  assert.equal(counts.all, day.length);
  for (const c of F.chips(counts, "us")) assert.equal(F.filterType(day, c.key).length, c.n, c.key);
  assert.deepEqual(F.chips(counts, "us").map((c) => c.key), ["8k", "insider", "form144"]);
  assert.equal(F.summaryLine(counts, "us"), "8-K 1 · 내부자 2 · Form 144 1");
  assert.equal(F.filterType(day, "all").length, day.length);
});

test("출처 기준: 불러오는 중·없음·최신 자료일이 기준일보다 앞·0건·있음", () => {
  const day = F.forDate(F.collect(US_SRC), "2026-09-30");
  const counts = F.countByType(day);
  const pay = { events: US_SRC.events, releases: US_SRC.releases, movers: US_SRC.movers, insider: US_SRC.insider, form144: null, econ: [] };
  const b = Object.fromEntries(F.sourceBasis("us", pay, counts, "2026-09-30", { form144: true }).map((x) => [x.key, x]));
  assert.equal(b["8k"].status, "ok");
  assert.equal(b["8k"].updatedAt, "2026-09-30 19:32 KST");
  assert.equal(b.insider.status, "behind");
  assert.equal(b.insider.latest, "2026-09-29");
  assert.equal(b.form144.status, "loading");
  assert.equal(b.econ.status, "missing");
});

test("이전·다음 자료일", () => {
  const dates = ["2026-09-30", "2026-09-29", "2026-09-28"];
  assert.equal(F.stepDate(dates, "2026-09-29", -1), "2026-09-28");
  assert.equal(F.stepDate(dates, "2026-09-29", 1), "2026-09-30");
  assert.equal(F.stepDate(dates, "2026-09-30", 1), "");
  assert.equal(F.stepDate(dates, "2026-09-28", -1), "");
});

test("시장 현지 날짜: 미 동부·한국", () => {
  const t = new Date("2026-10-01T02:00:00Z"); // 동부 9/30 22:00, 한국 10/1 11:00
  assert.equal(F.marketToday("us", t), "2026-09-30");
  assert.equal(F.marketToday("kr", t), "2026-10-01");
  assert.equal(F.dayLabel("2026-09-30"), "2026-09-30 (수)");
});

test("판정 문구를 만들지 않는다", () => {
  const banned = /호재|악재|매수 추천|매도 추천|추천|좋음|나쁨|강세 전환|약세 전환|사야|팔아/;
  for (const e of [...F.collect(US_SRC), ...F.collect(KR_SRC)]) {
    assert.ok(!banned.test(`${e.text} ${e.sub || ""}`), e.text);
  }
  for (const r of ["today", "weekend", "holiday", "notYet", "requested"]) {
    assert.ok(!banned.test(F.dateNote({ date: "2026-09-30", today: "2026-10-01", reason: r }, "kr")));
  }
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`market-feed-core: ${passed} passed`);
