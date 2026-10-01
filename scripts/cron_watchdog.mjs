// 정시 실행 감시자 — Cloudflare 워커 mir-cron 이 놓친 예약 슬롯을 대신 dispatch 한다.
//
//   GITHUB_TOKEN=... GITHUB_REPO=owner/repo node scripts/cron_watchdog.mjs [--dry-run]
//
// .github/workflows/cron-watchdog.yml 이 GitHub schedule(매시)로 부른다. 그 schedule 자체가 몇 시간
// 늦을 수 있지만 상관없다 — 이건 보험이다. 워커는 슬롯 후 60분까지 재시도하므로, 슬롯 후 GRACE_MIN(90분)이
// 지나도 run 이 없으면 워커가 죽었거나(토큰 만료·배포 안 됨·크론 해제) GitHub API 가 계속 실패한 것이다.
// 각 예약의 "GRACE_MIN 이전의 가장 최근 슬롯"(최대 LOOKBACK_H 시간 전까지)을 보고, 그 뒤로 run 이
// 하나도 없으면 dispatch 하고 목록을 MISSED_OUT 파일로 남긴다(워크플로우가 텔레그램으로 알린다).
// 판정·dispatch 는 워커와 같은 함수(worker/mir-cron.js)를 쓴다.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const GRACE_MIN = 90;
export const LOOKBACK_H = 26;

export async function findMissed(schedule, nowMs, env, lib, fetchImpl = fetch) {
  const missed = [];
  for (const entry of schedule) {
    const slot = lib.latestSlot(lib.parseCron(entry.cron), nowMs - GRACE_MIN * 60000, LOOKBACK_H * 60);
    if (slot === null) continue;
    if (await lib.hasRunSince(env, entry.workflow, slot, fetchImpl)) continue;
    missed.push({ ...entry, slot });
  }
  return missed;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = { GITHUB_TOKEN: process.env.GITHUB_TOKEN, GITHUB_REPO: process.env.GITHUB_REPO };
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) throw new Error("GITHUB_TOKEN·GITHUB_REPO 환경변수가 필요하다");
  const lib = await import(pathToFileURL(path.join(ROOT, "worker", "mir-cron.js")).href);
  const raw = JSON.parse(readFileSync(path.join(ROOT, ".github", "mir-cron.json"), "utf8"));
  const schedule = lib.normalizeSchedule(raw) || [];
  const missed = await findMissed(schedule, Date.now(), env, lib);
  const lines = [];
  let failed = 0;
  for (const entry of missed) {
    const at = new Date(entry.slot).toISOString().slice(0, 16).replace("T", " ");
    try {
      if (!dryRun) await lib.dispatchWorkflow(env, entry);
      lines.push(`${entry.workflow} (${at} UTC 슬롯) → ${dryRun ? "dry-run" : "대신 실행"}`);
    } catch (err) {
      failed += 1;
      lines.push(`${entry.workflow} (${at} UTC 슬롯) → dispatch 실패: ${err.message}`);
    }
  }
  console.log(`예약 ${schedule.length}개 확인 — 놓친 슬롯 ${missed.length}개`);
  for (const l of lines) console.log(`  ${l}`);
  if (process.env.MISSED_OUT) writeFileSync(process.env.MISSED_OUT, lines.join("\n"));
  if (failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
