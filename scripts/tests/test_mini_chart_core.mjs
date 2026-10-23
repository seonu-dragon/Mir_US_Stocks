// 찾기 결과 미니 차트 갤러리 순수 함수(mini-chart-core.js). 네트워크·DOM 없음.
// 실행: node scripts/tests/test_mini_chart_core.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const c = require("../../mini-chart-core.js");

let passed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}
const bar = (i, cl) => [cl - 1, cl + 2, cl - 2, cl, 1000, `2026-01-${String(i).padStart(2, "0")}`];

await test("sliceBars — 배열/객체 행, 기간 봉 수, 종가 없는 봉 제외", () => {
  const rows = Array.from({ length: 300 }, (_, i) => bar(i, 100 + i));
  assert.equal(c.sliceBars(rows, "3M").length, 63);
  assert.equal(c.sliceBars(rows, "1Y").length, 252);
  assert.equal(c.sliceBars(rows, "3M").at(-1).c, 399);
  const mixed = [{ d: "a", o: 1, h: 2, l: 0.5, c: 1.5 }, [1, 1, 1, null, 0, "b"], [1, 1, 1, 0, 0, "c"], null, [1, 2, 1, 2, 0, "d"]];
  assert.deepEqual(c.sliceBars(mixed, "3M").map((b) => b.d), ["a", "d"]);
  assert.deepEqual(c.sliceBars(null, "3M"), []);
});

await test("changePct — 첫 봉 대비 마지막 봉", () => {
  assert.equal(c.changePct([{ c: 100 }, { c: 110 }]).toFixed(6), "10.000000");
  assert.equal(c.changePct([{ c: 100 }]), null);
});

await test("svg — 캔들(시고저 있을 때)·선(1Y 또는 시고저 없음)·봉 2개 미만은 빈 문자열", () => {
  const bars = c.sliceBars([bar(1, 10), [10, 11, 8, 9, 0, "d"], bar(3, 12)], "3M");
  const candle = c.svg(bars, { kind: "candle" });
  assert.equal((candle.match(/<rect /g) || []).length, 3);
  assert.equal(candle.includes('class="mc-down"'), true);
  const line = c.svg(bars, { kind: "line" });
  assert.equal(line.includes('class="mc-line is-up"'), true);
  const noOhlc = c.svg([{ o: null, h: null, l: null, c: 5 }, { o: null, h: null, l: null, c: 4 }], { kind: "candle" });
  assert.equal(noOhlc.includes("mc-line is-down"), true);
  assert.equal(c.svg(bars.slice(0, 1)), "");
});

await test("createQueue — 동시 실행 상한, 같은 키 한 번, clear 는 대기분만 버린다", async () => {
  const q = c.createQueue(2);
  let running = 0, peak = 0, calls = 0;
  const job = () => new Promise((r) => { calls += 1; running += 1; peak = Math.max(peak, running); setTimeout(() => { running -= 1; r(calls); }, 5); });
  const ps = ["a", "b", "c", "d", "a"].map((k) => q.run(k, job));
  await Promise.all(ps);
  assert.equal(peak, 2);
  assert.equal(calls, 4);
  const q2 = c.createQueue(1);
  const first = q2.run("x", job);
  const dropped = assert.rejects(q2.run("y", job), /cleared/);
  q2.clear();
  await first;
  await dropped;
  const again = await q2.run("y", () => Promise.resolve("ok"));
  assert.equal(again, "ok");
});

console.log(`${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach((f) => console.error(f)); process.exit(1); }
