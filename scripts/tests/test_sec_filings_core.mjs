// 8-K 3줄 요약·Form 144 표시(sec-filings-core.js) + 타임라인 연결(timeline-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_sec_filings_core.mjs   (CI 의 "SEC filings … core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const S = require("../../sec-filings-core.js");
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

// 실제 8-K(DT 2026-09-24, Item 1.01) 규칙 요약 결과 모양 그대로.
const RULE = { item: "1.01", what: "중요 계약 체결 — Credit Agreement", who: "상대방 Bank of America, N.A.", amount: "$500,000,000", date: "2026-09-24", src: "rule" };

// ---- 8-K 3줄 ----
test("규칙 요약: 무엇·누가·얼마+사건일 세 줄, 출처 라벨", () => {
  const r = S.eightkLines({ summary: RULE });
  assert.equal(r.src, "rule");
  assert.equal(r.label, "규칙 요약");
  assert.deepEqual(r.lines, ["중요 계약 체결 — Credit Agreement", "상대방 Bank of America, N.A.", "$500,000,000 · 사건일 2026-09-24"]);
});

test("빈 칸은 줄을 만들지 않는다", () => {
  const r = S.eightkLines({ summary: { item: "7.01", what: "투자자 프레젠테이션 자료 공개(Reg FD)", who: "", amount: "", date: "" } });
  assert.deepEqual(r.lines, ["투자자 프레젠테이션 자료 공개(Reg FD)"]);
});

test("AI 요약이 2줄 이상 살아 있으면 AI 가 우선", () => {
  const r = S.eightkLines({ summary: RULE, aiSummary: { lines: ["신용계약 체결", "", "한도 $500,000,000"], src: "ai" } });
  assert.equal(r.src, "ai");
  assert.equal(r.label, "AI 요약");
  assert.deepEqual(r.lines, ["신용계약 체결", "한도 $500,000,000"]);
});

test("AI 요약이 검증에서 1줄만 남았으면 규칙 요약으로", () => {
  const r = S.eightkLines({ summary: RULE, aiSummary: { lines: ["신용계약 체결", "", ""] } });
  assert.equal(r.src, "rule");
});

test("요약이 없으면 빈 줄(화면은 Item 제목 + 원문 링크만)", () => {
  const r = S.eightkLines({ items: [{ code: "8.01", label: "기타 주요 이벤트" }] });
  assert.equal(r.src, "");
  assert.deepEqual(r.lines, []);
  assert.deepEqual(S.eightkLines(null).lines, []);
});

// ---- Form 144 ----
// 실제 신고(MAR 2026-09-25, Marriott David S) 값.
const F144 = {
  ticker: "MAR", issuer: "MARRIOTT INTERNATIONAL INC /MD/", person: "Marriott David S", relation: "이사회 의장",
  shares: 3500, marketValue: 1236900, sharesOutstanding: 282383000, approxSaleDate: "2026-09-25",
  broker: "Raymond James & Associates, Inc.", fileDate: "2026-09-25", accession: "0001974078-26-000367",
  link: "https://www.sec.gov/Archives/edgar/data/1359809/000197407826000367/xsl144X01/primary_doc.xml",
};

test("발행주식 대비 %", () => {
  assert.ok(Math.abs(S.form144Pct(F144) - 0.0012394) < 1e-6);
  assert.equal(S.form144Pct({ shares: 10 }), null);
  assert.equal(S.form144Pct({ shares: 10, sharesOutstanding: 0 }), null);
});

test("한 줄 요약: 신고인(관계)·예정 주식수(%)·시가·예정일·브로커", () => {
  const line = S.form144Line(F144);
  assert.equal(line, "Marriott David S(이사회 의장) · 예정 3,500주(발행주식의 <0.01%) · 시가 $1.24M · 예정일 2026-09-25 · Raymond James & Associates, Inc.");
});

test("짝짓기 상태: sold / pending / unknown 문구", () => {
  const sold = S.form144Status({ ...F144, match: { status: "sold", soldShares: 3500, firstSaleDate: "2026-09-25" } });
  assert.equal(sold.key, "sold");
  assert.equal(sold.label, "실제 매도 확인됨");
  assert.equal(sold.detail, "Form 4 매도 3,500주 (예정의 100%) · 첫 매도 2026-09-25");
  const pend = S.form144Status({ ...F144, match: { status: "pending" } });
  assert.equal(pend.key, "pending");
  assert.equal(pend.label, "아직");
  assert.match(pend.detail, /2영업일/);
  assert.equal(S.form144Status({ ...F144 }).key, "unknown");
});

test("필터·개수", () => {
  const rows = [
    { ...F144, match: { status: "sold", soldShares: 1 } },
    { ...F144, ticker: "AKAM", issuer: "AKAMAI", person: "Leighton F Thomson", match: { status: "pending" } },
    { ...F144, ticker: "X", match: { status: "unknown" } },
  ];
  assert.deepEqual(S.countForm144(rows), { all: 3, sold: 1, pending: 1, unknown: 1 });
  assert.equal(S.filterForm144(rows, "pending", "").length, 1);
  assert.equal(S.filterForm144(rows, "all", "leighton").length, 1);
  assert.equal(S.filterForm144(rows, "all", "raymond").length, 3);
});

// ---- 타임라인 연결 ----
test("타임라인: 8-K 항목에 요약 줄·출처, Form 144 항목(지분·내부자)", () => {
  const items = T.collectTimeline({
    ticker: "MAR",
    usFilings: [{ ticker: "MAR", fileDate: "2026-09-24", hot: true, items: [{ code: "1.01", label: "중요계약 체결" }, { code: "9.01", label: "재무제표·첨부" }], link: "https://www.sec.gov/x.htm", summary: RULE }],
    form144: [{ ...F144, match: { status: "sold", soldShares: 3500, firstSaleDate: "2026-09-25" } }, { ...F144, ticker: "OTHER" }],
  });
  const k8 = items.find((x) => x.src === "8k");
  assert.ok(k8);
  assert.equal(k8.linesSrc, "rule");
  assert.equal(k8.linesLabel, "규칙 요약");
  assert.equal(k8.lines.length, 3);
  const f = items.filter((x) => x.src === "form144");
  assert.equal(f.length, 1); // 다른 종목은 빠진다
  assert.equal(f[0].cat, "own");
  assert.equal(f[0].title, "Form 144 매도 예정 신고 · 실제 매도 확인됨");
  assert.match(f[0].detail, /예정 3,500주/);
  assert.match(f[0].detail, /첫 매도 2026-09-25/);
});

test("타임라인: 요약 없는 8-K 는 lines 필드가 없다", () => {
  const items = T.collectTimeline({ ticker: "A", usFilings: [{ ticker: "A", fileDate: "2026-09-24", items: [{ code: "8.01", label: "기타 주요 이벤트" }] }] });
  assert.equal(items.length, 1);
  assert.equal(items[0].lines, undefined);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log(`sec-filings-core: ${passed} passed`);
