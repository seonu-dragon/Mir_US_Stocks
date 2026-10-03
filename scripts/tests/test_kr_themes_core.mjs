// 국내 테마 순수 계산(kr-themes-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_kr_themes_core.mjs   (CI 의 "KR themes core tests" 스텝)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../kr-themes-core.js");

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

const stocks = {
  A: { changePct: 2, weekChangePct: 10, monthChangePct: -5, marketCapB: 300 },
  B: { changePct: -1, weekChangePct: 4, monthChangePct: 5, marketCapB: 100 },
  C: { changePct: 0, weekChangePct: null, monthChangePct: 1, marketCapB: 0 },
};

test("perf: 동일가중·시총가중·상승/하락 수", () => {
  const p = core.perf([{ t: "A" }, { t: "B" }, { t: "C" }, { t: "ZZ" }], stocks, "d");
  assert.equal(p.covered, 3);                         // 스냅샷에 없는 ZZ 는 빠진다
  assert.ok(Math.abs(p.eq - 1 / 3) < 1e-9);
  assert.ok(Math.abs(p.cap - (2 * 300 - 1 * 100) / 400) < 1e-9);   // 시총 0 인 C 는 가중에서 빠진다
  assert.equal(p.up, 1);
  assert.equal(p.down, 1);
});

test("perf: 기간 키 · 결측 · 빈 목록", () => {
  const w = core.perf([{ t: "A" }, { t: "C" }], stocks, "w");
  assert.equal(w.covered, 1);
  assert.equal(w.eq, 10);
  const empty = core.perf([], stocks, "m");
  assert.equal(empty.eq, null);
  assert.equal(empty.cap, null);
  assert.equal(empty.covered, 0);
});

test("activeMembers: 저PBR 조건(pbMax) — PBR 모르면 제외", () => {
  const th = { filter: { pbMax: 1 }, members: [{ t: "A", pb: 0.4 }, { t: "B", pb: 1.2 }, { t: "C" }, { t: "D", pb: 1 }] };
  assert.deepEqual(core.activeMembers(th).map((m) => m.t), ["A"]);
  assert.equal(core.activeMembers({ members: [{ t: "A" }] }).length, 1);
  assert.deepEqual(core.activeMembers(null), []);
});

test("themeStats + rankThemes: 최소 종목 수·결측은 뒤로·가중 선택", () => {
  const themes = [
    { id: "x", name: "X", members: [{ t: "A" }, { t: "B" }] },          // d eq 0.5 · cap 1.25
    { id: "y", name: "Y", members: [{ t: "B" }, { t: "C" }] },          // d eq -0.5
    { id: "z", name: "Z", members: [{ t: "A" }] },                      // 1종목 → minN 2 에서 제외
    { id: "q", name: "Q", members: [{ t: "Q1" }, { t: "Q2" }] },        // 등락 없음
  ];
  const stats = core.themeStats(themes, stocks);
  assert.deepEqual(core.rankThemes(stats, "d", "eq", 2).map((s) => s.id), ["x", "y", "q"]);
  assert.deepEqual(core.rankThemes(stats, "d", "eq", 0).map((s) => s.id), ["z", "x", "y", "q"]);
  const cap = core.rankThemes(stats, "d", "cap", 2);
  assert.equal(cap[0].id, "x");
  assert.equal(core.statValue(stats[0], "d", "cap"), 1.25);
  assert.equal(core.statValue(stats[3], "d", "eq"), null);
});

test("themesForTicker: 편입 테마만 · PBR 조건 밖 제외", () => {
  const themes = [
    { id: "mem", name: "메모리", group: "반도체", members: [{ t: "A", kw: "DRAM", by: "rule" }] },
    { id: "fin", name: "저PBR 금융", filter: { pbMax: 1 }, members: [{ t: "A", kw: "금융지주", by: "rule", pb: 1.4 }] },
    { id: "hbm", name: "HBM", members: [{ t: "B", kw: "HBM", by: "llm" }] },
  ];
  const got = core.themesForTicker(themes, "A");
  assert.deepEqual(got.map((x) => x.id), ["mem"]);
  assert.equal(got[0].kw, "DRAM");
  assert.equal(core.themesForTicker(themes, "B")[0].by, "llm");
  assert.deepEqual(core.themesForTicker(themes, "ZZ"), []);
});

test("evidenceParts: 키워드 강조 조각 · 잘림 표시", () => {
  assert.deepEqual(core.evidenceParts("당사는 HBM 을 공급합니다.", "HBM", 0), ["당사는 ", "HBM", " 을 공급합니다."]);
  assert.deepEqual(core.evidenceParts("당사는 HBM 을 공급", "HBM", 3), ["…당사는 ", "HBM", " 을 공급…"]);
  assert.deepEqual(core.evidenceParts("키워드 없음", "HBM", 2), ["키워드 없음…", "", ""]);
  assert.deepEqual(core.evidenceParts(null, "", 0), ["", "", ""]);
});

test("dartUrl: 14자리 접수번호만", () => {
  assert.equal(core.dartUrl("20260310002820"), "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260310002820");
  assert.equal(core.dartUrl("2026"), "");
  assert.equal(core.dartUrl("javascript:alert(1)"), "");
});

test("fmtPct · tone · groups", () => {
  assert.equal(core.fmtPct(1.234), "+1.2%");
  assert.equal(core.fmtPct(-0.04), "0.0%");
  assert.equal(core.fmtPct(-2.35, 2), "-2.35%");
  assert.equal(core.fmtPct(null), "—");
  assert.equal(core.tone(0.1), "pos");
  assert.equal(core.tone(-0.1), "neg");
  assert.equal(core.tone(0), "");
  assert.deepEqual(core.groups([{ group: "반도체" }, { group: "금융" }, { group: "반도체" }, {}]), ["반도체", "금융"]);
});

test("suspect/perf: 가격제한폭 밖 종목은 집계에서 빠지고 중앙값은 이상치에 안 끌린다", () => {
  const S = {
    A: { changePct: 1, weekChangePct: 2, marketCapB: 10, closeSeries: [100, 100, 101] },
    B: { changePct: 2, weekChangePct: 3, marketCapB: 10, closeSeries: [100, 100, 102] },
    C: { changePct: 3, weekChangePct: 4, marketCapB: 10, closeSeries: [100, 100, 103] },
    X: { changePct: 751.2, weekChangePct: 751.2, marketCapB: 1, closeSeries: [907, 907, 7720] },      // 미수정 가격
    Y: { changePct: 895.2, weekChangePct: -0.5, marketCapB: 1, closeSeries: [10350, 10350, 10300] },  // 필드 오류
    Z: { changePct: 1, weekChangePct: 60, marketCapB: 1, closeSeries: [100, 150, 151, 152, 152, 152] }, // 주중 점프
  };
  const mem = ["A", "B", "C", "X", "Y", "Z"].map((t) => ({ t }));
  const d = core.perf(mem, S, "d");
  assert.deepEqual(d.excluded.slice().sort(), ["X", "Y"]);
  assert.equal(d.covered, 4);
  assert.equal(d.med, 1.5);
  const w = core.perf(mem, S, "w");
  assert.deepEqual(w.excluded.slice().sort(), ["X", "Y", "Z"]);
  assert.equal(w.med, 3);
  assert.equal(core.perf(mem, S, "d", { limit: null }).excluded.length, 0);   // 가격제한폭 없는 시장
  assert.equal(core.suspect(S.A, "q"), false);
  assert.equal(core.suspect(S.Z, "d"), false);   // 며칠 전 점프는 오늘 등락엔 영향 없다
});

test("median · weightKey · statValue(med)", () => {
  assert.equal(core.median([]), null);
  assert.equal(core.median([3, 1, 2]), 2);
  assert.equal(core.weightKey("cap"), "cap");
  assert.equal(core.weightKey("eq"), "eq");
  assert.equal(core.weightKey(undefined), "med");
  const st = core.themeStats([{ id: "x", members: [{ t: "A" }, { t: "B" }] }], stocks);
  assert.equal(core.statValue(st[0], "d", "med"), 0.5);
  assert.ok("q" in st[0]);
});

if (failures.length) {
  console.error(`kr-themes-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error("  ✕ " + f));
  process.exit(1);
}
console.log(`kr-themes-core: ${passed}개 테스트 통과`);
