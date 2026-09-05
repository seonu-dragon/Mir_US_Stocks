#!/usr/bin/env node
// 배포용 번들 빌드(2026-09-06).
//
// 개발은 지금처럼 index.html 이 25개 classic script 를 순서대로 읽는다(빌드 없이 서브 가능).
// 배포(deploy-pages.yml)에서만 이 스크립트가 _site/ 안의 HTML 을 고쳐 페이지별 번들 하나로
// 바꾼다:
//   index.html         → dist/index.bundle.js
//   analysis.html      → dist/analysis.bundle.js
//   chart_capture.html → dist/chart_capture.bundle.js
//
// 왜 ESM(import/export) 전환이 아니라 '순서 그대로 이어붙이기'인가:
//   25개 파일이 전역 1,400여 개를 공유하는 classic script 라서, 같은 순서로 한 파일에 이어
//   붙이면 의미가 그대로다(선언 충돌은 CI 의 check_global_name_collisions.py 가 0 임을 보장).
//   esbuild 는 --bundle 없이 --minify 만 쓴다 — IIFE 로 감싸면 전역이 사라져 HTML 인라인
//   핸들러·데이터 스크립트가 참조하는 window.* 가 끊긴다. 최상위 이름은 압축하지 않는다.
//   ESM 으로 옮기는 건 파일 단위로 나중에 해도 이 파이프라인을 그대로 쓴다.
//
// 번들에서 빼는 태그: data/*.js(스냅샷·별칭 데이터, 배포와 무관하게 갱신), build_id.js
// (stamp_build_id.py 가 찍는 SW 캐시 세대), sw.js. 이 태그들은 원래 자리에 남고 번들 태그는
// 마지막으로 뺀 코드 태그 자리에 들어간다(데이터 태그는 로드 시점 의존이 없어 앞으로 와도 무방).
//
// 사용:
//   node scripts/build_bundle.mjs --check                       # 임시 폴더에 빌드만(CI)
//   node scripts/build_bundle.mjs --root _site --apply --minify # 배포 스테이징 사본 변환
// 옵션: --esbuild "<명령>" (기본 esbuild; 없으면 --minify 를 건너뛰고 경고)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const REPO = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const root = resolve(opt("--root", REPO));
const check = flag("--check");
const apply = flag("--apply") || check; // --check 는 임시 사본에 적용까지 해 보고 지운다
const minify = flag("--minify");
const esbuildCmd = opt("--esbuild", "esbuild");
const PAGES = ["index.html", "analysis.html", "chart_capture.html"];
const KEEP = (src) => src.startsWith("data/") || src === "build_id.js" || src === "sw.js" || src.includes("/");
const TAG_RE = /^([ \t]*)<script src="([^"?]+)(\?v=[0-9a-f]+)?"><\/script>[ \t]*\r?\n/gm;

const md5 = (s) => createHash("md5").update(s).digest("hex").slice(0, 10);

function buildPage(srcRoot, outRoot, page) {
  const htmlPath = join(srcRoot, page);
  if (!existsSync(htmlPath)) return null;
  const html = readFileSync(htmlPath, "utf8");
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const tags = [];
  let m;
  while ((m = TAG_RE.exec(html))) tags.push({ index: m.index, length: m[0].length, indent: m[1], src: m[2] });
  const code = tags.filter((t) => !KEEP(t.src));
  if (!code.length) return null;
  const parts = code.map((t) => {
    const p = join(srcRoot, t.src);
    if (!existsSync(p)) throw new Error(`${page}: ${t.src} 없음`);
    const body = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    return `/* ===== ${t.src} ===== */\n${body}\n;\n`;
  });
  const concat = parts.join("");
  const name = `${basename(page, ".html")}.bundle.js`;
  const distDir = join(outRoot, "dist");
  mkdirSync(distDir, { recursive: true });
  const outFile = join(distDir, name);
  writeFileSync(outFile, concat);
  let final = concat;
  if (minify) {
    try {
      execSync(`${esbuildCmd} "${outFile}" --minify --target=es2020 --legal-comments=none --sourcemap --outfile="${outFile}" --allow-overwrite --log-level=warning`, { stdio: "inherit" });
      final = readFileSync(outFile, "utf8");
    } catch (err) {
      console.warn(`[bundle] esbuild 실행 실패(${esbuildCmd}) — 압축 없이 이어붙인 번들을 그대로 둔다: ${err.message}`);
    }
  }
  // 문법 검증(번들 전체를 한 스크립트로 파싱) — 이 스크립트를 실행한 node 로.
  execSync(`"${process.execPath}" --check "${outFile}"`, { stdio: "inherit" });
  const hash = md5(final);
  const result = { page, name, files: code.map((t) => t.src), bytesIn: Buffer.byteLength(concat), bytesOut: Buffer.byteLength(final), hash };
  if (apply) {
    // 마지막 코드 태그 자리에 번들 태그, 나머지 코드 태그는 제거
    const last = code[code.length - 1];
    let out = "";
    let cursor = 0;
    for (const t of tags) {
      if (KEEP(t.src)) continue;
      out += html.slice(cursor, t.index);
      if (t === last) out += `${t.indent}<script src="dist/${name}?v=${hash}"></script>${eol}`;
      cursor = t.index + t.length;
    }
    out += html.slice(cursor);
    writeFileSync(join(outRoot, page), out);
  }
  return result;
}

const outRoot = check ? mkdtempSync(join(tmpdir(), "mir-bundle-")) : root;
if (check) {
  // 원본 HTML 을 임시 폴더에 복사해 --apply 결과까지 검증
  for (const p of PAGES) if (existsSync(join(root, p))) writeFileSync(join(outRoot, p), readFileSync(join(root, p)));
}
const results = [];
for (const page of PAGES) {
  const r = buildPage(root, outRoot, page);
  if (r) results.push(r);
}
for (const r of results) {
  console.log(`[bundle] ${r.page} → dist/${r.name}?v=${r.hash}  ${r.files.length}개 파일  ${(r.bytesIn / 1024).toFixed(0)}KB → ${(r.bytesOut / 1024).toFixed(0)}KB`);
}
if (check) {
  // 변환된 HTML 에 코드 태그가 남지 않았는지
  for (const r of results) {
    const html = readFileSync(join(outRoot, r.page), "utf8");
    const left = [...html.matchAll(TAG_RE)].map((m) => m[2]).filter((s) => !KEEP(s) && !s.startsWith("dist/"));
    if (left.length) { console.error(`[bundle] ${r.page}: 번들 뒤에도 코드 태그가 남음: ${left.join(", ")}`); process.exit(1); }
  }
  rmSync(outRoot, { recursive: true, force: true });
  console.log("[bundle] check ok");
}
