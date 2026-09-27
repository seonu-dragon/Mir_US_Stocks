// worker/mir-push.js 의 EMBED 블록을 루트의 순수 모듈 원본으로 채운다.
//
//   node scripts/sync_push_worker.mjs          # 채워 쓰기
//   node scripts/sync_push_worker.mjs --check  # 어긋나면 exit 1 (CI)
//
// 왜: 워커는 Cloudflare 대시보드에 파일 하나를 붙여넣는 수동 배포라 import 로 다른 파일을 끌어올 수
// 없다. 대신 사이트와 같은 my-digest-core.js · push-alerts-core.js 를 원문 그대로 박아 넣고, 원본이
// 바뀌면 이 스크립트로 다시 채운다. 두 모듈은 UMD(IIFE) 라 워커에서는 globalThis.MirDigestCore /
// globalThis.MirPushCore 로 잡힌다.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = path.join(ROOT, "worker", "mir-push.js");
const EMBEDS = ["my-digest-core.js", "push-alerts-core.js"];

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

export function buildWorkerSource(workerText, readModule) {
  let out = normalize(workerText);
  for (const name of EMBEDS) {
    const begin = `// ===== BEGIN EMBED: ${name} =====`;
    const end = `// ===== END EMBED: ${name} =====`;
    const i = out.indexOf(begin);
    const j = out.indexOf(end);
    if (i < 0 || j < i) throw new Error(`EMBED 표지를 찾을 수 없음: ${name}`);
    const body = normalize(readModule(name)).replace(/\s+$/, "");
    out = `${out.slice(0, i + begin.length)}\n${body}\n${out.slice(j)}`;
  }
  return out;
}

const check = process.argv.includes("--check");
const current = readFileSync(WORKER, "utf8");
const next = buildWorkerSource(current, (name) => readFileSync(path.join(ROOT, name), "utf8"));
if (check) {
  if (normalize(current) !== next) {
    console.error("worker/mir-push.js 의 EMBED 블록이 원본과 다릅니다 — node scripts/sync_push_worker.mjs 를 실행하세요.");
    process.exit(1);
  }
  console.log("worker/mir-push.js EMBED 블록 최신");
} else {
  writeFileSync(WORKER, next);
  console.log("worker/mir-push.js EMBED 블록 갱신");
}
