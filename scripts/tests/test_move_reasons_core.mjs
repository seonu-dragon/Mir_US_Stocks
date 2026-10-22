// 주가 움직임 이유 응답 정리(move-reasons-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_move_reasons_core.mjs   (CI 의 "Move reasons core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../move-reasons-core.js");

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

const BODY = {
  date: "2026-10-22", changePct: 3.21, socialSources: ["Stocktwits"], socialErrors: ["reddit:403"], socialCount: 40, newsCount: 9,
  confirmed: [
    { claim: "대형 클라우드 수주", news: [{ title: "NVDA wins order", link: "https://r.com/a", publisher: "Reuters" }, { title: "x", link: "javascript:alert(1)" }], socialCount: 7, samples: [] },
    { claim: "뉴스 없는 확인", news: [], socialCount: 2 },
  ],
  socialOnly: [{ claim: "숏커버링 소문", socialCount: 3, samples: [{ text: "shorts covering", url: "https://stocktwits.com/x", source: "Stocktwits" }] }, { claim: "" }],
  newsOnly: [{ claim: "업종 동반 강세", news: [{ title: "Chips rally", link: "https://b.com" }] }],
  error: "",
};

test("normalize: 뉴스 없는 확인·빈 주장은 빼고 링크는 http(s)만", () => {
  const r = core.normalize(BODY);
  assert.equal(r.confirmed.length, 1);
  assert.equal(r.confirmed[0].news[1].link, "");
  assert.equal(r.socialOnly.length, 1);
  assert.equal(r.newsOnly.length, 1);
  assert.equal(r.socialFailed, true);
  assert.equal(r.changePct, 3.21);
  assert.equal(core.hasAny(r), true);
});

test("모양이 다르면 null, 소스 없음·실패 구분", () => {
  assert.equal(core.normalize({ ticker: "NVDA", news: [] }), null);
  assert.equal(core.normalize(null), null);
  const empty = core.normalize({ confirmed: [], socialOnly: [], newsOnly: [], error: "no_sources", changePct: null });
  assert.equal(empty.empty, true);
  assert.equal(empty.failed, false);
  assert.equal(empty.changePct, null);
  assert.equal(core.hasAny(empty), false);
  assert.equal(core.normalize({ confirmed: [], socialOnly: [], error: "unparsable:x" }).failed, true);
});

if (failures.length) {
  console.error(`move-reasons-core: ${failures.length}개 실패\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`move-reasons-core: ${passed}개 통과`);
