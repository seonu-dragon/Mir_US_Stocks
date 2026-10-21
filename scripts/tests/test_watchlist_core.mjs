// 관심 리스트 표 순수 함수(watchlist-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_watchlist_core.mjs   (CI 의 "Watchlist core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../watchlist-core.js");

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

const ROWS = [
  { t: "A", p: 3, s: "나" },
  { t: "B", p: null, s: "가" },
  { t: "C", p: 1, s: "다" },
  { t: "D", p: 3, s: "" },
  { t: "E", p: NaN, s: "가" },
];
const get = (r, k) => r[k];

test("숫자 정렬: 오름·내림 모두 값 없는 행은 맨 뒤, 같은 값은 원래 순서", () => {
  assert.deepEqual(core.sortRows(ROWS, { key: "p", dir: 1 }, get).map((r) => r.t), ["C", "A", "D", "B", "E"]);
  assert.deepEqual(core.sortRows(ROWS, { key: "p", dir: -1 }, get).map((r) => r.t), ["A", "D", "C", "B", "E"]);
});

test("문자 정렬은 한글 순, 빈 문자열은 맨 뒤", () => {
  assert.deepEqual(core.sortRows(ROWS, { key: "s", dir: 1 }, get).map((r) => r.t), ["B", "E", "A", "C", "D"]);
});

test("정렬 없음이면 원래 순서 사본", () => {
  const out = core.sortRows(ROWS, null, get);
  assert.deepEqual(out.map((r) => r.t), ["A", "B", "C", "D", "E"]);
  assert.notEqual(out, ROWS);
});

test("정렬 토글 순환: 기본 방향 → 반대 → 해제, 다른 열은 기본 방향부터", () => {
  let s = core.nextSort(null, "p", -1);
  assert.deepEqual(s, { key: "p", dir: -1 });
  s = core.nextSort(s, "p", -1);
  assert.deepEqual(s, { key: "p", dir: 1 });
  assert.equal(core.nextSort(s, "p", -1), null);
  assert.deepEqual(core.nextSort({ key: "p", dir: 1 }, "s", 1), { key: "s", dir: 1 });
});

test("moveItem: 앞뒤 이동, 범위 밖은 그대로", () => {
  assert.deepEqual(core.moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(core.moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(core.moveItem(["a", "b"], 0, 5), ["a", "b"]);
});

test("reorderSubset: 표에 안 보인 티커는 제자리, 보인 것만 그 자리들 안에서 재배치", () => {
  assert.deepEqual(core.reorderSubset(["A", "X", "B", "C", "Y"], ["C", "A", "B"]), ["C", "X", "A", "B", "Y"]);
  assert.deepEqual(core.reorderSubset(["A", "B"], ["B", "Z"]), ["A", "B"]); // 모르는 티커가 섞이면 손대지 않는다
});

test("메모: 200자·공백 정리, 빈 글은 삭제 표식, 없던 걸 비우면 아무것도 안 남김", () => {
  let n = core.setNote({}, "nvda", "  AI   수혜 \n 관찰 ", 100);
  assert.deepEqual(n, { NVDA: { t: "AI 수혜 관찰", u: 100 } });
  n = core.setNote(n, "NVDA", "", 200);
  assert.deepEqual(n, { NVDA: { t: "", u: 200 } });
  assert.deepEqual(core.liveNotes(n), {});
  assert.deepEqual(core.setNote({}, "AAPL", "   ", 1), {});
  assert.equal(core.setNote({}, "A", "가".repeat(300), 1).A.t.length, 200);
});

test("메모 병합: 종목마다 나중 수정이 이김(삭제 포함), 한쪽에만 있으면 유지", () => {
  const local = { A: { t: "로컬", u: 5 }, B: { t: "로컬B", u: 9 }, C: { t: "로컬C", u: 1 } };
  const remote = { A: { t: "원격", u: 7 }, B: { t: "", u: 3 }, D: { t: "원격D", u: 2 } };
  assert.deepEqual(core.liveNotes(core.mergeNotes(local, remote)), { A: "원격", B: "로컬B", C: "로컬C", D: "원격D" });
  assert.deepEqual(core.liveNotes(core.mergeNotes({ A: { t: "x", u: 1 } }, { A: { t: "", u: 2 } })), {});
});

test("메모 정리: 깨진 항목·시각 없는 항목 버림, 삭제 표식은 최근 100개만", () => {
  assert.deepEqual(core.normalizeNotes({ a: { t: "x", u: 1 }, b: "문자열", c: { t: "y" }, "": { t: "z", u: 1 } }), { A: { t: "x", u: 1 } });
  const many = {};
  for (let i = 1; i <= 130; i += 1) many[`T${i}`] = { t: "", u: i };
  const merged = core.mergeNotes(many, {});
  assert.equal(Object.keys(merged).length, 100);
  assert.ok(merged.T130 && !merged.T30);
});

test("fitNotes: 상한 안으로 최신순 선택, 시장 키 유지", () => {
  const us = { A: { t: "가".repeat(100), u: 3 }, B: { t: "나".repeat(100), u: 1 } };
  const kr = { "005930": { t: "다".repeat(100), u: 2 } };
  const all = core.fitNotes({ us, kr }, 100000);
  assert.equal(all.dropped, 0);
  assert.deepEqual(Object.keys(all.notes.us).sort(), ["A", "B"]);
  const part = core.fitNotes({ us, kr }, 650);
  assert.equal(part.dropped, 1);
  assert.deepEqual(Object.keys(part.notes.us), ["A"]);
  assert.deepEqual(Object.keys(part.notes.kr), ["005930"]);
  assert.ok(core.utf8Bytes(JSON.stringify(part.notes)) <= 650 + 20);
  assert.deepEqual(core.fitNotes({ us, kr }, 0).notes, { us: {}, kr: {} });
});

test("sanitizeGroups: 12개·80종목·이름 20자, 중복 id·깨진 항목 제거, 티커 대문자·중복 제거", () => {
  const raw = [
    { id: "g1", name: " AI ", tickers: ["nvda", "NVDA", "msft", ""] },
    { id: "g1", name: "중복", tickers: [] },
    { id: "", name: "x", tickers: [] },
    { id: "g2", name: "긴이름".repeat(10), tickers: Array.from({ length: 100 }, (_, i) => `T${i}`) },
    null,
    { id: "g3", name: "x", tickers: "AAPL" },
  ];
  const out = core.sanitizeGroups(raw);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { id: "g1", name: "AI", tickers: ["NVDA", "MSFT"] });
  assert.equal(out[1].name.length, 20);
  assert.equal(out[1].tickers.length, 80);
  assert.equal(core.sanitizeGroups(Array.from({ length: 20 }, (_, i) => ({ id: `g${i}`, name: "n", tickers: [] }))).length, 12);
  assert.deepEqual(core.sanitizeGroups("x"), []);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`watchlist core: ${passed} passed`);
