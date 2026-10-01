// worker/mir-cron.js 자체 검증(네트워크 없음 — fetch 목). node worker/test_cron.mjs
import {
  parseCron, cronMatches, latestSlot, dueChecks, normalizeSchedule, runCron, handleFetch,
  loadSchedule, resetScheduleCache, upcomingSlots, RETRY_OFFSETS_MIN,
} from "./mir-cron.js";
import { scanWorkflow, buildSchedule } from "../scripts/sync_cron_worker.mjs";
import { findMissed } from "../scripts/cron_watchdog.mjs";
import * as lib from "./mir-cron.js";

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${err && err.stack ? err.stack : err}`);
  }
}
function eq(a, b, msg = "") {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg} 기대 ${sb}, 실제 ${sa}`);
}
const T = (iso) => Date.parse(iso);

// GitHub API 목: runs 조회는 runsSince(workflow) 가 돌려주는 생성 시각 목록으로, dispatch 는 기록.
function ghMock({ runs = {}, dispatchStatus = 204, runsStatus = 200, remote = null } = {}) {
  const calls = { dispatched: [], runs: [], remote: 0 };
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === "raw.githubusercontent.com") {
      calls.remote += 1;
      if (!remote) return new Response("nope", { status: 404 });
      return new Response(JSON.stringify(remote), { status: 200 });
    }
    const m = /\/actions\/workflows\/([^/]+)\/(runs|dispatches)$/.exec(u.pathname);
    if (m && m[2] === "dispatches") {
      calls.dispatched.push({ workflow: decodeURIComponent(m[1]), body: JSON.parse(init.body), auth: init.headers.Authorization });
      return new Response(null, { status: dispatchStatus });
    }
    if (m && m[2] === "runs") {
      const wf = decodeURIComponent(m[1]);
      const since = Date.parse(u.searchParams.get("created").replace(/^>=/, ""));
      calls.runs.push({ workflow: wf, since });
      if (runsStatus !== 200) return new Response("err", { status: runsStatus });
      const n = (runs[wf] || []).filter((iso) => Date.parse(iso) >= since).length;
      return new Response(JSON.stringify({ total_count: n, workflow_runs: [] }), { status: 200 });
    }
    if (u.pathname.endsWith("/actions/workflows")) return new Response("{}", { status: 200 });
    return new Response("unexpected", { status: 500 });
  };
  return { fetchImpl, calls };
}
const ENV = { GITHUB_TOKEN: "tok" };

console.log("cron 해석");
await test("단순 매일 15:42 KST(06:42 UTC)", () => {
  const p = parseCron("42 6 * * *");
  eq(cronMatches(p, new Date(T("2026-10-01T06:42:00Z"))), true);
  eq(cronMatches(p, new Date(T("2026-10-01T06:43:00Z"))), false);
});
await test("요일 범위 1-5 · 0-4 (UTC 기준)", () => {
  const p = parseCron("0 13 * * 1-5");
  eq(cronMatches(p, new Date(T("2026-10-02T13:00:00Z"))), true, "금");
  eq(cronMatches(p, new Date(T("2026-10-03T13:00:00Z"))), false, "토");
  const q = parseCron("30 22 * * 0-4");
  eq(cronMatches(q, new Date(T("2026-10-04T22:30:00Z"))), true, "일");
  eq(cronMatches(q, new Date(T("2026-10-02T22:30:00Z"))), false, "금");
});
await test("목록·월 제한(13F 분기 20·28일)", () => {
  const p = parseCron("20 6 20,28 3,6,9,12 *");
  eq(cronMatches(p, new Date(T("2026-09-28T06:20:00Z"))), true);
  eq(cronMatches(p, new Date(T("2026-10-28T06:20:00Z"))), false);
});
await test("시 목록(macro-odds 21,5,13)", () => {
  const p = parseCron("37 21,5,13 * * *");
  eq([5, 13, 21, 6].map((h) => cronMatches(p, new Date(Date.UTC(2026, 9, 1, h, 37)))), [true, true, true, false]);
});
await test("간격·요일 7=일요일·일/요일 둘 다 지정은 OR", () => {
  eq(cronMatches(parseCron("*/15 * * * *"), new Date(T("2026-10-01T10:45:00Z"))), true);
  eq(cronMatches(parseCron("0 0 * * 7"), new Date(T("2026-10-04T00:00:00Z"))), true);
  const p = parseCron("0 0 1 * 1");
  eq(cronMatches(p, new Date(T("2026-10-01T00:00:00Z"))), true, "1일(목)");
  eq(cronMatches(p, new Date(T("2026-10-05T00:00:00Z"))), true, "월요일");
  eq(cronMatches(p, new Date(T("2026-10-06T00:00:00Z"))), false);
});
await test("잘못된 cron 은 던진다", () => {
  for (const bad of ["", "* * * *", "61 * * * *", "a * * * *", "5-1 * * * *"]) {
    let threw = false;
    try { parseCron(bad); } catch { threw = true; }
    eq(threw, true, bad);
  }
});
await test("latestSlot — 범위 안 최근 슬롯 / 없으면 null", () => {
  const p = parseCron("42 6 * * *");
  eq(latestSlot(p, T("2026-10-01T07:10:30Z"), 60), T("2026-10-01T06:42:00Z"));
  eq(latestSlot(p, T("2026-10-01T08:00:00Z"), 60), null);
});

console.log("이번 분에 확인할 슬롯");
const SCHED = [{ workflow: "korea-close-briefing.yml", cron: "42 6 * * *", input: false }];
await test("재시도 오프셋에서만 확인(0·1·3·7·15·30·60분)", () => {
  const hits = [];
  for (let m = 0; m <= 70; m += 1) {
    const d = dueChecks(SCHED, T("2026-10-01T06:42:00Z") + m * 60000);
    if (d.length) hits.push(d[0].offset);
  }
  eq(hits, RETRY_OFFSETS_MIN);
});
await test("초 단위 scheduledTime 도 분으로 내림", () => {
  eq(dueChecks(SCHED, T("2026-10-01T06:42:59Z")).length, 1);
});

console.log("크론 실행(runCron)");
await test("토큰 없으면 not_configured, GitHub 호출 없음", async () => {
  resetScheduleCache();
  const { fetchImpl, calls } = ghMock();
  const s = await runCron({}, T("2026-10-01T06:42:00Z"), fetchImpl);
  eq(s.error, "not_configured");
  eq(calls.runs.length + calls.dispatched.length, 0);
});
await test("슬롯 시각 → run 없으면 dispatch(main, 입력 없음, Bearer 토큰)", async () => {
  resetScheduleCache();
  const { fetchImpl, calls } = ghMock();
  const s = await runCron(ENV, T("2026-10-01T06:42:00Z"), fetchImpl);
  eq(s.dispatched, ["korea-close-briefing.yml [42 6 * * *] +0m"]);
  eq(calls.dispatched[0].body, { ref: "main" });
  eq(calls.dispatched[0].auth, "Bearer tok");
});
await test("슬롯 이후 run 이 이미 있으면 건너뛴다(사람이 먼저 돌렸거나 1분 전 dispatch)", async () => {
  resetScheduleCache();
  const { fetchImpl, calls } = ghMock({ runs: { "korea-close-briefing.yml": ["2026-10-01T06:42:05Z"] } });
  const s = await runCron(ENV, T("2026-10-01T06:43:00Z"), fetchImpl);
  eq(s.skipped.length, 1);
  eq(calls.dispatched.length, 0);
});
await test("어제 run 은 오늘 슬롯을 채우지 않는다", async () => {
  resetScheduleCache();
  const { fetchImpl, calls } = ghMock({ runs: { "korea-close-briefing.yml": ["2026-09-30T13:00:00Z"] } });
  await runCron(ENV, T("2026-10-01T06:42:00Z"), fetchImpl);
  eq(calls.dispatched.length, 1);
});
await test("cron 입력 선언 워크플로우엔 inputs.cron 을 넘긴다", async () => {
  resetScheduleCache();
  const remote = { schedule: [{ workflow: "company-info.yml", cron: "17 1 * * 3", input: true }] };
  const { fetchImpl, calls } = ghMock({ remote });
  await runCron(ENV, T("2026-09-30T01:17:00Z"), fetchImpl);
  eq(calls.dispatched[0].body, { ref: "main", inputs: { cron: "17 1 * * 3" } });
});
await test("dispatch 실패·조회 실패는 failed 로 모으고 다음 예약은 계속", async () => {
  resetScheduleCache();
  const remote = { schedule: [
    { workflow: "a.yml", cron: "0 7 * * *" },
    { workflow: "b.yml", cron: "0 7 * * *" },
  ] };
  const { fetchImpl } = ghMock({ remote, dispatchStatus: 422 });
  const s = await runCron(ENV, T("2026-10-01T07:00:00Z"), fetchImpl);
  eq(s.failed.length, 2);
  eq(/HTTP 422/.test(s.failed[0]), true);
  resetScheduleCache();
  const r2 = ghMock({ remote, runsStatus: 401 });
  const s2 = await runCron(ENV, T("2026-10-01T07:00:00Z"), r2.fetchImpl);
  eq(s2.failed.length, 2);
  eq(r2.calls.dispatched.length, 0, "조회 실패 시 dispatch 하지 않는다(중복 위험)");
});

console.log("예약표 불러오기");
await test("원격 JSON 우선, 10분 캐시", async () => {
  resetScheduleCache();
  const remote = { schedule: [{ workflow: "x.yml", cron: "1 2 * * *" }] };
  const { fetchImpl, calls } = ghMock({ remote });
  const a = await loadSchedule(ENV, 0, fetchImpl);
  eq([a.source, a.list.length], ["remote", 1]);
  await loadSchedule(ENV, 5 * 60000, fetchImpl);
  eq(calls.remote, 1);
  await loadSchedule(ENV, 11 * 60000, fetchImpl);
  eq(calls.remote, 2);
});
await test("원격 실패·이상한 값이면 EMBED 사본", async () => {
  resetScheduleCache();
  const a = await loadSchedule(ENV, 0, ghMock().fetchImpl);
  eq(a.source, "embedded");
  eq(a.list.length > 20, true);
  resetScheduleCache();
  const b = await loadSchedule(ENV, 0, ghMock({ remote: { schedule: [{ workflow: "../evil", cron: "* * * * *" }] } }).fetchImpl);
  eq(b.source, "embedded");
});
await test("normalizeSchedule — 잘못된 행만 버린다", () => {
  eq(normalizeSchedule({ schedule: [
    { workflow: "ok.yml", cron: "0 1 * * *", input: 1 },
    { workflow: "bad name.yml", cron: "0 1 * * *" },
    { workflow: "bad.yml", cron: "99 1 * * *" },
  ] }), [{ workflow: "ok.yml", cron: "0 1 * * *", input: true }]);
});

console.log("health");
await test("/health — 설정 여부·다음 슬롯, 토큰 확인은 분당 1회", async () => {
  resetScheduleCache();
  const { fetchImpl } = ghMock();
  const res = await handleFetch(new Request("https://w.dev/health?token=1"), ENV, fetchImpl);
  const body = await res.json();
  eq([body.configured, body.scheduleSource, body.tokenOk, body.next.length], [true, "embedded", true, 5]);
  const again = await (await handleFetch(new Request("https://w.dev/health?token=1"), ENV, fetchImpl)).json();
  eq(again.tokenOk, undefined);
  eq((await handleFetch(new Request("https://w.dev/x"), ENV, fetchImpl)).status, 404);
});
await test("upcomingSlots 는 시간순", () => {
  const s = upcomingSlots([
    { workflow: "b.yml", cron: "0 7 * * *" },
    { workflow: "a.yml", cron: "42 6 * * *" },
  ], T("2026-10-01T06:00:00Z"), 3);
  eq(s.map((x) => x.workflow), ["a.yml", "b.yml", "a.yml"]);
});

console.log("예약표 생성(sync_cron_worker)");
await test("on: 블록의 mir-cron 주석·cron 입력만 읽는다(잡 이름 schedule 무시)", () => {
  const wf = [
    "name: X", "on:", "  # mir-cron: \"0 21 * * *\"  # 06:00 KST", "  workflow_dispatch:", "    inputs:",
    "      cron:", "        type: string", "", "jobs:", "  schedule:", "    runs-on: ubuntu-latest", "",
  ].join("\r\n");
  eq(scanWorkflow(wf), { crons: ["0 21 * * *"], hasSchedule: false, hasDispatch: true, cronInput: true });
});
await test("schedule: 이 남은 워크플로우·dispatch 없는 예약은 문제로 올린다", () => {
  const { problems } = buildSchedule([
    ["a.yml", "on:\n  schedule:\n    - cron: \"0 1 * * *\"\n  workflow_dispatch:\njobs: {}\n"],
    ["pages-queue-watchdog.yml", "on:\n  schedule:\n    - cron: \"17 * * * *\"\njobs: {}\n"],
    ["b.yml", "on:\n  # mir-cron: \"0 1 * * *\"\n  push:\njobs: {}\n"],
  ], parseCron);
  eq(problems.length, 2);
});

console.log("감시자(cron_watchdog)");
await test("슬롯 후 90분 지나도 run 이 없으면 놓친 것, 있으면 아님, 90분 전이면 아직 워커 몫", async () => {
  const sched = [
    { workflow: "korea-close-briefing.yml", cron: "42 6 * * *" },
    { workflow: "insider-trades.yml", cron: "17 4 * * *" },
    { workflow: "white-house-schedule.yml", cron: "0 7 * * *" },
  ];
  // white-house 07:00 슬롯은 80분 전이라 감시자는 어제 07:00 슬롯을 본다 — 오늘 워커가 돌린 run 이 그 뒤에 있으니 정상.
  const { fetchImpl } = ghMock({ runs: {
    "insider-trades.yml": ["2026-10-01T04:17:10Z"],
    "white-house-schedule.yml": ["2026-10-01T07:00:20Z"],
  } });
  const missed = await findMissed(sched, T("2026-10-01T08:20:00Z"), ENV, lib, fetchImpl);
  eq(missed.map((m) => m.workflow), ["korea-close-briefing.yml"]);
  // 어제 슬롯 뒤로 run 이 하나도 없으면(워커가 하루 넘게 죽음) 그것도 잡는다.
  const none = await findMissed([sched[2]], T("2026-10-01T08:20:00Z"), ENV, lib, ghMock().fetchImpl);
  eq(none.map((m) => new Date(m.slot).toISOString()), ["2026-09-30T07:00:00.000Z"]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
