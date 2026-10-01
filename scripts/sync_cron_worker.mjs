// 워크플로우의 `# mir-cron: "<UTC cron>"` 주석을 모아 정시 실행 예약표를 만든다.
//
//   node scripts/sync_cron_worker.mjs          # .github/mir-cron.json + worker/mir-cron.js EMBED 채워 쓰기
//   node scripts/sync_cron_worker.mjs --check  # 어긋나거나 규칙 위반이면 exit 1 (CI)
//
// 왜: GitHub `schedule:` 은 5~8시간 늦게 출발해서(2026-09 실측) 예약 시각은 Cloudflare 워커
// mir-cron 이 지킨다(worker/mir-cron.js, DEPLOY.md "정시 실행 워커"). 워커는 이 JSON 을 레포에서
// 10분마다 다시 읽으므로 예약을 바꿔도 재배포가 필요 없다 — 워커 안의 EMBED 사본은 그 읽기가 실패할 때만 쓴다.
//
// 규칙(--check 가 본다):
//   · `schedule:` 트리거는 GITHUB_SCHEDULE_ALLOWED 의 감시용 워크플로우에만 둔다. 다른 곳에 남으면
//     워커 dispatch + 늦게 도착한 schedule 로 같은 작업이 하루 두 번 돈다.
//   · `# mir-cron:` 이 있는 워크플로우는 workflow_dispatch 를 받아야 한다(워커가 그걸로 깨운다).
//   · cron 은 워커의 parseCron 으로 해석돼야 한다.
//   · workflow_dispatch 에 `cron` 입력을 선언한 워크플로우는 input=true — 워커가 슬롯 cron 을 넘긴다
//     (예약 슬롯마다 다른 잡을 돌리는 워크플로우용. 선언 안 한 입력을 보내면 GitHub 이 422 로 거절한다).
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WF_DIR = path.join(ROOT, ".github", "workflows");
const JSON_OUT = path.join(ROOT, ".github", "mir-cron.json");
const WORKER = path.join(ROOT, "worker", "mir-cron.js");
export const GITHUB_SCHEDULE_ALLOWED = new Set(["pages-queue-watchdog.yml", "cron-watchdog.yml"]);
const BEGIN = "// ===== BEGIN EMBED: .github/mir-cron.json =====";
const END = "// ===== END EMBED: .github/mir-cron.json =====";

function normalize(text) {
  return text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

/** 워크플로우 원문 하나에서 예약(cron 목록)·입력 선언·트리거 정보를 읽는다. */
export function scanWorkflow(text) {
  const t = normalize(text);
  // 최상위 `on:` 블록만 본다 — jobs 아래 잡 이름이 `schedule` 인 워크플로우도 있다(white-house-schedule.yml).
  const m = /^(?:on|"on"|'on'):[^\n]*\n((?:[ \t#][^\n]*\n|\n)*)/m.exec(t);
  const on = m ? m[1] : "";
  const crons = [...on.matchAll(/^\s*#\s*mir-cron:\s*["']([^"']+)["']/gm)].map((x) => x[1].trim());
  return {
    crons,
    hasSchedule: /^ {2}schedule:\s*(#.*)?$/m.test(on),
    hasDispatch: /^ {2}workflow_dispatch:/m.test(on),
    // workflow_dispatch.inputs 아래 `cron:` 키(6칸 들여쓰기). `- cron:`(schedule 문법)은 대시가 있어 걸리지 않는다.
    cronInput: /^ {2}workflow_dispatch:[\s\S]*?^ {4}inputs:[\s\S]*?^ {6}cron:\s*$/m.test(on),
  };
}

export function buildSchedule(files, parseCron) {
  const rows = [];
  const problems = [];
  for (const [name, text] of files) {
    const info = scanWorkflow(text);
    if (info.hasSchedule && !GITHUB_SCHEDULE_ALLOWED.has(name)) {
      problems.push(`${name}: \`schedule:\` 트리거가 남아 있다 — \`# mir-cron:\` 주석으로 옮길 것(중복 실행 방지).`);
    }
    if (info.crons.length && !info.hasDispatch) {
      problems.push(`${name}: \`# mir-cron:\` 이 있는데 workflow_dispatch 가 없다 — 워커가 깨울 수 없다.`);
    }
    for (const cron of info.crons) {
      try {
        parseCron(cron);
      } catch (err) {
        problems.push(`${name}: cron "${cron}" 해석 실패 — ${err.message}`);
        continue;
      }
      rows.push({ workflow: name, cron, input: info.cronInput });
    }
  }
  rows.sort((a, b) => (a.workflow < b.workflow ? -1 : a.workflow > b.workflow ? 1 : 0));
  return { rows, problems };
}

export function renderJson(rows) {
  return `${JSON.stringify({
    note: "scripts/sync_cron_worker.mjs 생성물 — 직접 고치지 말고 워크플로우의 `# mir-cron:` 주석을 고친 뒤 다시 생성. 시각은 UTC.",
    schedule: rows,
  }, null, 2)}\n`;
}

export function renderEmbed(workerText, rows) {
  const t = normalize(workerText);
  const i = t.indexOf(BEGIN);
  const j = t.indexOf(END);
  if (i < 0 || j < i) throw new Error("worker/mir-cron.js 에서 EMBED 표지를 찾을 수 없음");
  const body = `const EMBEDDED_SCHEDULE = [\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(",\n")}\n];`;
  return `${t.slice(0, i + BEGIN.length)}\n${body}\n${t.slice(j)}`;
}

async function main() {
  const check = process.argv.includes("--check");
  const { parseCron } = await import(pathToFileURL(WORKER).href);
  const files = readdirSync(WF_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => [f, readFileSync(path.join(WF_DIR, f), "utf8")]);
  const { rows, problems } = buildSchedule(files, parseCron);
  const json = renderJson(rows);
  const workerText = readFileSync(WORKER, "utf8");
  const worker = renderEmbed(workerText, rows);
  if (check) {
    if (!existsSync(JSON_OUT) || normalize(readFileSync(JSON_OUT, "utf8")) !== json) {
      problems.push(".github/mir-cron.json 이 워크플로우 주석과 다르다 — `node scripts/sync_cron_worker.mjs` 실행 후 커밋.");
    }
    if (normalize(workerText) !== worker) {
      problems.push("worker/mir-cron.js EMBED 블록이 낡았다 — `node scripts/sync_cron_worker.mjs` 실행 후 커밋.");
    }
    if (problems.length) {
      for (const p of problems) console.error(`✗ ${p}`);
      process.exit(1);
    }
    console.log(`mir-cron 예약표 최신 (${rows.length}개 슬롯)`);
    return;
  }
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  writeFileSync(JSON_OUT, json);
  writeFileSync(WORKER, worker);
  console.log(`예약 ${rows.length}개 → .github/mir-cron.json, worker/mir-cron.js EMBED`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
