// AI 모드 문장별 출처 각주·후속 질문 칩 순수 함수(ai-cite-core.js). 네트워크·DOM 없음.
// 실행: node scripts/tests/test_ai_cite_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const c = require("../../ai-cite-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const CTX = [
  "다음은 사이트 스냅샷/프록시 기준 종목 데이터입니다(실시간 투자 조언 아님, 참고용):",
  "[NVDA NVIDIA] 섹터:TECHNOLOGY · 가격:$180 · PER:45.0배 · 다음실적:2026-11-19 · RSI(14):55.0 (보통)",
  "  └ 스마트머니·촉매·모멘텀: 내부자(Form4) 매수 0·매도 3 · 주요공시(8-K) 2건",
].join("\n");

test("numberContext — 데이터 줄에만 S 번호, 인용 규칙이 맨 앞", () => {
  const r = c.numberContext(CTX);
  const lines = r.text.split("\n");
  assert.equal(lines[0], c.CITE_RULE);
  assert.equal(lines[1].startsWith("다음은"), true);
  assert.equal(lines[2].startsWith("[S1] [NVDA NVIDIA]"), true);
  assert.equal(lines[3].startsWith("  └ [S2] 스마트머니"), true);
  assert.deepEqual(r.sources.map((s) => s.id), ["S1", "S2"]);
  assert.equal(r.sources[0].label, "NVDA 시세·지표");
  assert.equal(r.sources[1].label, "스마트머니·촉매·모멘텀");
  assert.equal(r.sources[0].detail.startsWith("섹터:TECHNOLOGY"), true);
  assert.equal(r.sources[1].detail.startsWith("내부자(Form4)"), true);
});

test("numberContext — 빈 컨텍스트는 그대로, 잘리는 줄은 출처에서 뺀다", () => {
  assert.deepEqual(c.numberContext(""), { text: "", sources: [] });
  const long = `${CTX}\n  └ ${"가".repeat(5000)}`;
  const r = c.numberContext(long);
  assert.deepEqual(r.sources.map((s) => s.id), ["S1", "S2"]);
});

test("newsSources — 새 워커 items, 옛 워커 sources(제목), http 아닌 링크 제거", () => {
  const a = c.newsSources({ items: [{ id: "N1", title: "A", link: "https://x/a", date: "2026-10-20", publisher: "P" }, { id: "N2", title: "B", link: "javascript:1" }] });
  assert.equal(a.length, 2);
  assert.equal(a[0].detail, "P · 2026-10-20");
  assert.equal(a[1].link, "");
  const b = c.newsSources({ sources: ["제목1", "제목2"] });
  assert.deepEqual(b.map((s) => s.id), ["N1", "N2"]);
  assert.deepEqual(c.newsSources(null), []);
});

test("applyCitations — 아는 ID 만 번호, 모르는 ID 는 삭제, 같은 출처 같은 번호", () => {
  const src = c.numberContext(CTX).sources.concat(c.newsSources({ sources: ["뉴스1"] }));
  const r = c.applyCitations("PER은 45배입니다 [S1]. 매도가 많았습니다[S2, S9]. 실적 기사[N1][N3]. 다시 [S1].", src);
  assert.equal(r.text, "PER은 45배입니다1. 매도가 많았습니다2. 실적 기사3. 다시1.");
  assert.deepEqual(r.notes.map((n) => [n.n, n.id]), [[1, "S1"], [2, "S2"], [3, "N1"]]);
  assert.equal(r.dropped, 2);
});

test("applyCitations — 출처가 없으면 표기만 지우고 문장은 남긴다", () => {
  const r = c.applyCitations("근거 없는 문장 [S1]. 그냥 문장.", []);
  assert.equal(r.text, "근거 없는 문장. 그냥 문장.");
  assert.equal(r.notes.length, 0);
});

test("applyCitations — 마크다운 링크·일반 대괄호는 건드리지 않는다", () => {
  const r = c.applyCitations("[기사](https://x.test) 와 [참고] 그리고 [S1·N1]", c.numberContext(CTX).sources);
  assert.equal(r.text, "[기사](https://x.test) 와 [참고] 그리고1");
});

test("stripCitations · citationHtml · notesHtml", () => {
  assert.equal(c.stripCitations("가 [S1]. 나 [N2, S3]."), "가. 나.");
  assert.equal(c.citationHtml("a2", "p1"), 'a<sup class="ai-cite"><a href="#p1-2" data-cite="2" aria-label="출처 2">2</a></sup>');
  const html = c.notesHtml([{ n: 1, kind: "news", label: "<b>x</b>", link: "https://x/\"y", detail: "" }], "p1");
  assert.equal(html.includes("&lt;b&gt;"), true);
  assert.equal(html.includes('href="https://x/&quot;y"'), true);
  assert.equal(html.includes('id="p1-1"'), true);
  assert.equal(c.notesHtml([], "p"), "");
});

test("followupQuestions — 컨텍스트에 있는 데이터만, 물은 주제 제외, 최대 3개", () => {
  const f = c.followupQuestions({ name: "엔비디아", context: CTX, userText: "엔비디아 공시 알려줘", hasNews: true });
  assert.equal(f.length, 3);
  assert.deepEqual(f.map((x) => x.key), ["earnings", "smart", "valuation"]);
  assert.equal(f[0].question.startsWith("엔비디아"), true);
  const kr = c.followupQuestions({ name: "삼성전자", context: "  └ 수급 순매수(2026-10-22 기준): 외국인 5일 +1만주", userText: "", hasNews: false });
  assert.deepEqual(kr.map((x) => x.key), ["flow"]);
  assert.deepEqual(c.followupQuestions({ name: "", context: CTX }), []);
});

test("labelAnalystRatings — 증권사 평가는 '원문 평가 · ' 표시 + 첫 문장에서 내림, 사이트 데이터·멱등", () => {
  const t = "Needham은 매수 의견을 유지하고 목표가 300달러를 제시했습니다 [N1]. 주가는 2.1% 올랐습니다 [S1].\n**관찰 포인트**\n- 모건스탠리가 목표주가를 250달러로 상향했습니다\n- 애널리스트 평균 목표가가 현재가보다 15% 높음";
  const out = c.labelAnalystRatings(t);
  const [first, , b1, b2] = out.split("\n");
  assert.equal(first.startsWith("주가는 2.1% 올랐습니다 [S1]."), true, first);
  assert.equal(first.endsWith("원문 평가 · Needham은 매수 의견을 유지하고 목표가 300달러를 제시했습니다 [N1]."), true, first);
  assert.equal(b1, "- 원문 평가 · 모건스탠리가 목표주가를 250달러로 상향했습니다");
  assert.equal(b2, "- 애널리스트 평균 목표가가 현재가보다 15% 높음", "사이트 자체 데이터는 그대로");
  assert.equal(c.labelAnalystRatings(out), out, "두 번 적용해도 같다");
  assert.equal(c.labelAnalystRatings("원문 평가 · Needham: 목표가 300달러 유지."), "원문 평가 · Needham: 목표가 300달러 유지.");
  assert.equal(c.labelAnalystRatings(""), "");
});

console.log(`${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach((f) => console.error(f)); process.exit(1); }
