// 업데이트 소식 순수 함수(changelog-core.js) + 손으로 쓰는 data/changelog.{json,js} 검사. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_changelog_core.mjs   (CI 의 "Changelog core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const core = require("../../changelog-core.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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

const E = (id, date, extra = {}) => ({ id, date, title: `t-${id}`, desc: "첫 문장. 둘째 문장.", link: "?tab=today", targets: [], market: "all", ...extra });

// ---------- isSafeLink ----------
test("상대 링크만 허용", () => {
  assert.equal(core.isSafeLink("?tab=today"), true);
  assert.equal(core.isSafeLink("analysis.html?t=NVDA"), true);
  assert.equal(core.isSafeLink("./index.html?tab=bulk"), true);
  assert.equal(core.isSafeLink("javascript:alert(1)"), false);
  assert.equal(core.isSafeLink("JavaScript:alert(1)"), false);
  assert.equal(core.isSafeLink("https://evil.example/"), false);
  assert.equal(core.isSafeLink("//evil.example/"), false);
  assert.equal(core.isSafeLink("data:text/html,x"), false);
  assert.equal(core.isSafeLink(""), false);
  assert.equal(core.isSafeLink(null), false);
});

// ---------- normalize ----------
test("필수값 틀린 항목은 버리고 링크·화면 id 정리", () => {
  assert.equal(core.normalizeEntry({ id: "x", date: "2026-10-01", title: "a" }), null); // id 너무 짧음
  assert.equal(core.normalizeEntry({ id: "abc-1", date: "2026/10/01", title: "a" }), null);
  assert.equal(core.normalizeEntry({ id: "abc-1", date: "2026-10-01", title: " " }), null);
  const e = core.normalizeEntry({ id: "abc-1", date: "2026-10-01", title: "a", link: "javascript:x", targets: ["ok-id", "bad id", "ok-id"], market: "jp" });
  assert.equal(e.link, "");
  assert.deepEqual(e.targets, ["ok-id"]);
  assert.equal(e.market, "all");
  assert.deepEqual(e.focus, []);
});

test("최신순 정렬 · 같은 날은 파일 순서 · id 중복은 앞의 것", () => {
  const list = core.normalizeEntries({ entries: [
    E("old-1", "2026-09-26"), E("new-1", "2026-10-01"), E("new-2", "2026-10-01"), E("mid-1", "2026-09-27"),
    { ...E("new-1", "2026-09-01"), title: "dup" },
  ] });
  assert.deepEqual(list.map((e) => e.id), ["new-1", "new-2", "mid-1", "old-1"]);
  assert.equal(list[0].title, "t-new-1");
  assert.deepEqual(core.normalizeEntries(null), []);
  assert.deepEqual(core.normalizeEntries([E("arr-1", "2026-10-01")]).map((e) => e.id), ["arr-1"]);
});

// ---------- unread ----------
const LIST = core.normalizeEntries([E("e-4", "2026-10-01"), E("e-3", "2026-09-28"), E("e-2", "2026-09-27"), E("e-1", "2026-08-01")]);
test("본 위치보다 새 항목만 안 읽음", () => {
  assert.deepEqual(core.unreadEntries(LIST, { id: "e-3", date: "2026-09-28" }).map((e) => e.id), ["e-4"]);
  assert.deepEqual(core.unreadEntries(LIST, { id: "e-4", date: "2026-10-01" }), []);
});
test("목록에서 빠진 id 면 날짜로", () => {
  assert.deepEqual(core.unreadEntries(LIST, { id: "gone-1", date: "2026-09-27" }).map((e) => e.id), ["e-4", "e-3"]);
  assert.deepEqual(core.unreadEntries(LIST, { id: "gone-1" }), []);
});
test("처음 온 사람은 최근 N일 안 항목만", () => {
  assert.deepEqual(core.unreadEntries(LIST, null, { today: "2026-10-01", newWindowDays: 14 }).map((e) => e.id), ["e-4", "e-3", "e-2"]);
  assert.deepEqual(core.unreadEntries(LIST, null, { today: "2026-12-31", newWindowDays: 14 }), []);
});
test("seenMarker = 맨 위 항목", () => {
  assert.deepEqual(core.seenMarker(LIST), { id: "e-4", date: "2026-10-01" });
  assert.equal(core.seenMarker([]), null);
});

// ---------- inline card ----------
const CARDS = core.normalizeEntries([
  E("kr-new", "2026-10-01", { targets: ["scr-a"], market: "kr" }),
  E("all-new", "2026-09-30", { targets: ["scr-a", "scr-b"] }),
  E("us-old", "2026-09-29", { targets: ["scr-b"], market: "us" }),
  E("all-c", "2026-09-28", { targets: ["scr-c"] }),
  E("ancient", "2026-06-01", { targets: ["scr-d"] }),
  E("future", "2026-12-01", { targets: ["scr-d"] }),
]);
const base = { today: "2026-10-01", maxAgeDays: 45, maxImpressions: 3 };
test("화면마다 최신 1장, 같은 항목은 한 화면에만", () => {
  const picks = core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-a", "scr-b"], market: "us" });
  assert.deepEqual(picks.map((p) => [p.target, p.entry.id]), [["scr-a", "all-new"], ["scr-b", "us-old"]]);
  const kr = core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-a", "scr-b"], market: "kr" });
  assert.deepEqual(kr.map((p) => [p.target, p.entry.id]), [["scr-a", "kr-new"], ["scr-b", "all-new"]]);
});
test("닫은 항목은 다음 후보로", () => {
  const picks = core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-a"], market: "kr", dismissed: ["kr-new"] });
  assert.deepEqual(picks.map((p) => p.entry.id), ["all-new"]);
  assert.deepEqual(core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-c"], dismissed: ["all-c"] }), []);
});
test("노출 상한 — 단 지금 떠 있는 카드는 유지", () => {
  assert.deepEqual(core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-c"], impressions: { "all-c": 3 } }), []);
  assert.equal(core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-c"], impressions: { "all-c": 2 } }).length, 1);
  assert.equal(core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-c"], impressions: { "all-c": 3 }, showing: ["all-c"] }).length, 1);
});
test("오래된 항목·미래 날짜는 카드로 안 띄움", () => {
  assert.deepEqual(core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-d"] }), []);
  assert.equal(core.pickInlineCards(CARDS, { ...base, today: "2026-06-10", visibleTargets: ["scr-d"] })[0].entry.id, "ancient");
});
test("보이는 화면이 없으면 빈 배열, 중복 target 은 한 번", () => {
  assert.deepEqual(core.pickInlineCards(CARDS, { ...base, visibleTargets: [] }), []);
  assert.equal(core.pickInlineCards(CARDS, { ...base, visibleTargets: ["scr-c", "scr-c"] }).length, 1);
});
test("allTargets · prune", () => {
  assert.deepEqual(core.allTargets(CARDS).sort(), ["scr-a", "scr-b", "scr-c", "scr-d"]);
  assert.deepEqual(core.pruneDismissed(["all-c", "gone", "all-c", 3], CARDS), ["all-c"]);
  assert.deepEqual(core.pruneImpressions({ "all-c": 2.7, gone: 1, "us-old": -1, "kr-new": "x" }, CARDS), { "all-c": 2 });
});
test("표기", () => {
  assert.equal(core.fmtDate("2026-09-27"), "2026.09.27");
  assert.equal(core.fmtDate("bad"), "");
  assert.equal(core.marketLabel("kr"), "국내");
  assert.equal(core.marketLabel("us"), "미국");
  assert.equal(core.marketLabel("zz"), "공통");
});

// ---------- 손으로 쓰는 데이터 파일 ----------
const jsonText = readFileSync(path.join(ROOT, "data", "changelog.json"), "utf8");
const jsText = readFileSync(path.join(ROOT, "data", "changelog.js"), "utf8");
const payload = JSON.parse(jsonText);

test("data/changelog.js 와 .json 이 같은 내용", () => {
  const m = jsText.match(/^window\.MIR_CHANGELOG = ([\s\S]*);\s*$/);
  assert.ok(m, "window.MIR_CHANGELOG = {...}; 형태여야 함");
  assert.deepEqual(JSON.parse(m[1]), payload);
});

test("데이터 항목이 전부 유효(버려지는 항목 없음)", () => {
  const raw = payload.entries;
  assert.ok(Array.isArray(raw) && raw.length >= 5);
  const list = core.normalizeEntries(payload);
  assert.equal(list.length, raw.length, "normalize 에서 빠진 항목이 있음(id·날짜·제목·중복 확인)");
  raw.forEach((e) => {
    assert.ok(["us", "kr", "all"].includes(e.market), `${e.id} market`);
    assert.ok(core.isSafeLink(e.link), `${e.id} link 는 상대 URL`);
    assert.ok(e.desc && e.desc.length <= 220, `${e.id} desc 길이`);
    assert.ok(e.title.length <= 40, `${e.id} title 길이`);
    assert.ok(Array.isArray(e.targets), `${e.id} targets 배열`);
    // 파일은 최신순으로 손으로 유지한다(맨 위가 최신).
  });
  for (let i = 1; i < raw.length; i += 1) assert.ok(raw[i - 1].date >= raw[i].date, `최신순 아님: ${raw[i].id}`);
  assert.equal(payload.updatedAt, raw[0].date, "updatedAt 은 맨 위 항목 날짜");
  // 국내/미국 전용 링크는 그 시장으로 연다(다른 시장 모드에서 눌러도 맞는 화면).
  raw.forEach((e) => {
    if (e.market === "kr") assert.match(e.link, /[?&]market=kr\b/, `${e.id} 국내 링크엔 market=kr`);
    if (e.market === "us") assert.match(e.link, /[?&]market=us\b/, `${e.id} 미국 링크엔 market=us`);
  });
});

test("targets·focus 가 가리키는 요소 id 가 페이지에 있다", () => {
  const html = readFileSync(path.join(ROOT, "index.html"), "utf8") + readFileSync(path.join(ROOT, "analysis.html"), "utf8");
  const analysisJs = readFileSync(path.join(ROOT, "analysis.js"), "utf8");
  payload.entries.forEach((e) => {
    [...(e.targets || []), ...(e.focus || [])].forEach((id) => {
      if (id.startsWith(".")) {
        // '.클래스' focus 는 렌더러가 그리는 요소 — 그 클래스를 쓰는 소스가 있어야 한다.
        const cls = id.slice(1);
        const re = new RegExp('class="(?:[^"]*\\s)?' + cls + '(?:\\s[^"]*)?"');
        assert.ok(re.test(html + analysisJs), `${e.id}: class ${cls} 를 못 찾음`);
        return;
      }
      assert.ok(html.includes(`id="${id}"`), `${e.id}: id="${id}" 를 index.html/analysis.html 에서 못 찾음`);
    });
    (e.targets || []).forEach((id) => assert.ok(!id.startsWith("."), `${e.id}: targets 는 요소 id 만`));
  });
});

if (failures.length) {
  console.error(`changelog-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`changelog-core: ${passed} 통과`);
