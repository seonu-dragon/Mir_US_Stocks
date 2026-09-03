// =============================================================================
// worker/yahoo-proxy.js 자체 검증 — 네트워크 없이 도는 순수 Node 테스트
//
//   "C:/Users/user/AppData/Local/ms-playwright-go/1.57.0/node.exe" worker/test_worker.mjs
//   (또는 아무 Node 18+ 로: node worker/test_worker.mjs)
//
// 다루는 것:
//   · LLM 게이트 — Origin 없는 요청 거부, 허용 Origin, 모든 localhost 포트
//   · 캐시 히트가 게이트를 우회하지 못함(summary / move_analysis)
//   · ?model= 은 관리자 키가 있을 때만
//   · 커뮤니티: DO 경로와 KV 폴백이 같은 결과, DO 경로는 동시 글쓰기를 잃지 않음
//   · 이전 하드닝 회귀(IP 리밋·X-Admin-Key·private no-store·fetchT 일원화)
//
// env 는 전부 인메모리 모의다: KV 는 Map, AI 는 고정 문자열, DO 는 CommunityStore
// 인스턴스를 직접 감싼 스텁. 업스트림(야후·네이버·Gemini)을 부르는 경로는
// 테스트하지 않는다 — 이 파일은 게이트와 저장소 계층만 본다.
// =============================================================================

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CommunityStore,
  cachedTickerSummary,
  communityHandlerFor,
  handleFetch,
  llmOriginAllowed,
  resolveModelOverride,
} from "./yahoo-proxy.js";

const WORKER_SRC = fileURLToPath(new URL("./yahoo-proxy.js", import.meta.url));

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL  ${name}\n        ${(err && err.message) || err}`);
  }
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg || "expected truthy");
}

function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "mismatch"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function deepEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || "mismatch"}:\n  actual   ${a}\n  expected ${b}`);
}

// ── 모의 바인딩 ──────────────────────────────────────────────────────────────

// 지연을 넣을 수 있는 인메모리 KV. 지연이 있어야 두 요청이 실제로 겹친다.
function memKv(delayMs = 0) {
  const map = new Map();
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    map,
    async get(key, type) {
      await wait();
      const raw = map.get(key);
      if (raw == null) return null;
      return type === "json" ? JSON.parse(raw) : raw;
    },
    async put(key, value) {
      await wait();
      map.set(key, String(value));
    },
    async delete(key) {
      await wait();
      map.delete(key);
    },
  };
}

// DO storage 모의(구조화 복제 대신 참조 저장 — 값은 우리 코드가 새로 만든 객체다).
function memStorage(delayMs = 0) {
  const map = new Map();
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    map,
    async get(key) { await wait(); return map.get(key); },
    async put(key, value) { await wait(); map.set(key, value); },
    async delete(key) { await wait(); map.delete(key); },
  };
}

function stubAi(reply = "테스트 응답입니다.") {
  return { async run() { return { response: reply }; } };
}

function kvEnv(extra = {}, delayMs = 0) {
  return {
    AI: stubAi(),
    MOVE_CACHE: memKv(delayMs),
    COMMUNITY_KV: memKv(delayMs),
    ...extra,
  };
}

// COMMUNITY_DO 바인딩 모의: 이름과 무관하게 인스턴스 하나로 보낸다(실제 동작과 동일 —
// idFromName(COMMUNITY_DO_NAME) 하나만 쓰기 때문).
function doEnv(extra = {}, delayMs = 0) {
  const base = kvEnv(extra, delayMs);
  const instance = new CommunityStore({ storage: memStorage(delayMs) }, base);
  return {
    ...base,
    COMMUNITY_DO: {
      idFromName: (name) => ({ name }),
      get: () => ({ fetch: (request) => instance.fetch(request) }),
    },
    _instance: instance,
  };
}

function req(url, { method = "GET", origin, body, headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  if (body !== undefined) h["Content-Type"] = "application/json";
  return new Request(url, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ALLOWED = "https://seonu-dragon.github.io";

// ── 1. LLM Origin 게이트 ─────────────────────────────────────────────────────

console.log("\n[1] LLM Origin 게이트");

await test("Origin 이 없으면 거부한다", () => {
  ok(!llmOriginAllowed(new Request("https://w/")), "no Origin must be refused");
});

await test("배포 Origin 은 허용", () => {
  ok(llmOriginAllowed(req("https://w/", { origin: ALLOWED })));
});

await test("localhost / 127.0.0.1 은 포트에 관계없이 허용 (8080·8099·8101·8103·8106·랜덤)", () => {
  for (const port of ["8080", "8090", "8099", "8101", "8103", "8106", "8888", "51234"]) {
    ok(llmOriginAllowed(req("https://w/", { origin: `http://localhost:${port}` })), `localhost:${port}`);
    ok(llmOriginAllowed(req("https://w/", { origin: `http://127.0.0.1:${port}` })), `127.0.0.1:${port}`);
  }
  ok(llmOriginAllowed(req("https://w/", { origin: "http://localhost" })), "포트 없는 localhost");
});

await test("null Origin(file://·샌드박스 iframe)은 거부", () => {
  ok(!llmOriginAllowed(req("https://w/", { origin: "null" })));
});

await test("남의 사이트·유사 호스트는 거부", () => {
  for (const bad of [
    "https://evil.example",
    "http://localhost.evil.example",
    "http://127.0.0.1.evil.example",
    "https://seonu-dragon.github.io.evil.example",
    "http://localhost:8099/",
    "https://localhost:8099",
  ]) {
    ok(!llmOriginAllowed(req("https://w/", { origin: bad })), `허용되면 안 됨: ${bad}`);
  }
});

// ── 2. /chat 엔드투엔드 ──────────────────────────────────────────────────────

console.log("\n[2] POST /chat");

const chatBody = { messages: [{ role: "user", content: "안녕" }] };

await test("Origin 없는 /chat 은 403 forbidden_origin (LLM 실행 안 함)", async () => {
  const env = kvEnv();
  let aiCalls = 0;
  env.AI = { async run() { aiCalls += 1; return { response: "x" }; } };
  const res = await handleFetch(req("https://w/chat", { method: "POST", body: chatBody }), env);
  eq(res.status, 403, "status");
  const data = await res.json();
  eq(data.error, "forbidden_origin", "error");
  eq(aiCalls, 0, "AI 는 호출되면 안 된다");
});

await test("허용 Origin 의 /chat 은 정상 응답", async () => {
  const res = await handleFetch(
    req("https://w/chat", { method: "POST", origin: ALLOWED, body: chatBody }),
    kvEnv(),
  );
  eq(res.status, 200, "status");
  const data = await res.json();
  eq(data.reply, "테스트 응답입니다.", "reply");
});

await test("localhost:8101 (스모크 테스트 포트)의 /chat 도 정상 응답", async () => {
  const res = await handleFetch(
    req("https://w/chat", { method: "POST", origin: "http://127.0.0.1:8101", body: chatBody }),
    kvEnv(),
  );
  eq(res.status, 200, "status");
  eq((await res.json()).reply, "테스트 응답입니다.", "reply");
});

await test("Origin: null 의 /chat 은 403", async () => {
  const res = await handleFetch(
    req("https://w/chat", { method: "POST", origin: "null", body: chatBody }),
    kvEnv(),
  );
  eq(res.status, 403, "status");
});

// ── 3. 캐시 히트가 게이트를 우회하지 못한다 ───────────────────────────────────

console.log("\n[3] 캐시 히트 ≠ 게이트 우회");

function moveCacheKey(ticker, date, change = 5, modelOverride = "") {
  const hash = createHash("sha256").update(`${change}|${modelOverride}`).digest("hex").slice(0, 12);
  return `move:v4:${ticker}:${date}:${hash}`;
}

async function moveEnvWithCache() {
  const env = kvEnv();
  await env.MOVE_CACHE.put(
    moveCacheKey("NVDA", "2026-09-01"),
    JSON.stringify({ ticker: "NVDA", date: "2026-09-01", analysis: "캐시된 분석 본문" }),
  );
  return env;
}

const MOVE_URL = "https://w/?ticker=NVDA&move_analysis=1&date=2026-09-01&change=5";

await test("move_analysis: 캐시가 있어도 Origin 없으면 403 (본문 유출 없음)", async () => {
  const res = await handleFetch(req(MOVE_URL), await moveEnvWithCache());
  eq(res.status, 403, "status");
  const text = await res.text();
  ok(!text.includes("캐시된 분석 본문"), "캐시 내용이 새어 나감");
  eq(JSON.parse(text).error, "forbidden_origin", "error");
});

await test("move_analysis: 허용 Origin 이면 캐시 히트를 그대로 준다", async () => {
  const res = await handleFetch(req(MOVE_URL, { origin: ALLOWED }), await moveEnvWithCache());
  eq(res.status, 200, "status");
  const data = await res.json();
  eq(data.analysis, "캐시된 분석 본문", "analysis");
  eq(data.cached, true, "cached");
});

await test("summary: 캐시가 있어도 Origin 없으면 요약을 주지 않는다", async () => {
  const env = kvEnv();
  const day = new Date().toISOString().slice(0, 10);
  await env.MOVE_CACHE.put(`summary:v1:NVDA:${day}`, JSON.stringify({ text: "캐시된 요약", model: "m" }));
  const news = [{ title: "n" }];
  const out = await cachedTickerSummary(req("https://w/?ticker=NVDA"), env, "NVDA", news, false, "");
  eq(out.text, "", "text");
  eq(out.error, "forbidden_origin", "error");
});

await test("summary: 허용 Origin 이면 캐시된 요약을 준다", async () => {
  const env = kvEnv();
  const day = new Date().toISOString().slice(0, 10);
  await env.MOVE_CACHE.put(`summary:v1:NVDA:${day}`, JSON.stringify({ text: "캐시된 요약", model: "m" }));
  const news = [{ title: "n" }];
  const out = await cachedTickerSummary(
    req("https://w/?ticker=NVDA", { origin: "http://localhost:8106" }),
    env, "NVDA", news, false, "",
  );
  eq(out.text, "캐시된 요약", "text");
  eq(out.cached, true, "cached");
});

// ── 4. ?model= 은 관리자 전용 ────────────────────────────────────────────────

console.log("\n[4] ?model= 관리자 게이트");

const ADMIN_KEY = "s3cret-admin-key";

await test("관리자 키 없이 넘긴 ?model= 은 무시된다", async () => {
  const url = new URL("https://w/?ticker=NVDA&model=@cf/expensive/model");
  const out = await resolveModelOverride({ COMMUNITY_ADMIN_KEY: ADMIN_KEY }, req(url.href), url);
  eq(out, "", "override");
});

await test("틀린 관리자 키의 ?model= 도 무시된다", async () => {
  const url = new URL("https://w/?ticker=NVDA&model=@cf/expensive/model");
  const request = req(url.href, { headers: { "X-Admin-Key": "wrong" } });
  eq(await resolveModelOverride({ COMMUNITY_ADMIN_KEY: ADMIN_KEY }, request, url), "", "override");
});

await test("X-Admin-Key 가 맞으면 ?model= 을 존중한다", async () => {
  const url = new URL("https://w/?ticker=NVDA&model=@cf/expensive/model");
  const request = req(url.href, { headers: { "X-Admin-Key": ADMIN_KEY } });
  eq(await resolveModelOverride({ COMMUNITY_ADMIN_KEY: ADMIN_KEY }, request, url), "@cf/expensive/model", "override");
});

await test("COMMUNITY_ADMIN_KEY 가 설정 안 됐으면 어떤 키로도 통과 못 한다", async () => {
  const url = new URL("https://w/?ticker=NVDA&model=@cf/expensive/model");
  const request = req(url.href, { headers: { "X-Admin-Key": "anything" } });
  eq(await resolveModelOverride({}, request, url), "", "override");
});

// ── 5. 커뮤니티: DO 경로 == KV 경로 ──────────────────────────────────────────

console.log("\n[5] 커뮤니티 DO / KV 동등성");

async function createPost(env, { clientId, content, author = "테스터", ticker = "NVDA" }) {
  return handleFetch(
    req("https://w/community", { method: "POST", body: { clientId, content, author, ticker } }),
    env,
  );
}

async function listPosts(env, clientId) {
  const res = await handleFetch(req(`https://w/community?clientId=${clientId}`), env);
  return { status: res.status, data: await res.json() };
}

// id·시각처럼 실행마다 달라지는 값을 지운다.
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "id" || k === "createdAt") continue;
      out[k] = normalize(v);
    }
    return out;
  }
  return value;
}

async function communityScenario(env) {
  const created = await createPost(env, { clientId: "client-aaa", content: "첫 글입니다" });
  eq(created.status, 201, "create status");
  const postId = (await created.json()).post.id;

  const commented = await handleFetch(
    req("https://w/community/comment", {
      method: "POST",
      body: { postId, clientId: "client-bbb", author: "댓글러", content: "좋은 글이네요" },
    }),
    env,
  );
  eq(commented.status, 201, "comment status");

  const liked = await handleFetch(
    req("https://w/community/like", { method: "POST", body: { postId, clientId: "client-bbb" } }),
    env,
  );
  eq(liked.status, 200, "like status");

  const listed = await listPosts(env, "client-aaa");
  eq(listed.status, 200, "list status");
  return normalize(listed.data);
}

let kvScenario = null;
let doScenario = null;

await test("KV 폴백 경로: 글·댓글·좋아요·목록이 동작한다", async () => {
  kvScenario = await communityScenario(kvEnv());
  eq(kvScenario.posts.length, 1, "posts");
  eq(kvScenario.posts[0].likeCount, 1, "likeCount");
  eq(kvScenario.posts[0].comments.length, 1, "comments");
  eq(kvScenario.posts[0].mine, true, "mine");
});

await test("DO 경로: 같은 시나리오가 같은 결과를 낸다", async () => {
  doScenario = await communityScenario(doEnv());
  deepEq(doScenario, kvScenario, "DO 결과가 KV 결과와 다르다");
});

await test("DO 경로는 기존 COMMUNITY_KV 게시글을 한 번 읽어 이관한다", async () => {
  const env = doEnv();
  await env.COMMUNITY_KV.put(
    "community:v1:posts",
    JSON.stringify({
      version: 3,
      stamp: "seed",
      items: [{ id: "old-1", author: "옛사용자", clientId: "client-old", ticker: "", content: "이관 전 글", createdAt: new Date().toISOString() }],
    }),
  );
  const listed = await listPosts(env, "client-old");
  eq(listed.data.posts.length, 1, "seed 된 글이 보이지 않는다");
  eq(listed.data.posts[0].content, "이관 전 글", "content");
});

await test("COMMUNITY_KV·COMMUNITY_DO 둘 다 없으면 503 no_community_kv (기존 동작)", async () => {
  const res = await handleFetch(req("https://w/community"), { AI: stubAi() });
  eq(res.status, 503, "status");
  eq((await res.json()).error, "no_community_kv", "error");
});

await test("커뮤니티 라우팅 표: 지원 안 하는 메서드는 커뮤니티로 안 간다", () => {
  ok(communityHandlerFor("GET", "/community"), "GET /community");
  ok(communityHandlerFor("POST", "/community/vote"), "POST /community/vote");
  ok(!communityHandlerFor("PUT", "/community"), "PUT /community 는 표에 없어야 한다");
  ok(!communityHandlerFor("GET", "/community/like"), "GET /community/like 는 표에 없어야 한다");
  ok(!communityHandlerFor("GET", "/sync/prefs"), "/sync/prefs 는 커뮤니티 표가 아니다");
});

// ── 6. 동시 글쓰기 ───────────────────────────────────────────────────────────

console.log("\n[6] 동시 글쓰기");

await test("DO 경로: 동시에 들어온 글 두 개가 모두 남는다", async () => {
  const env = doEnv({}, 1); // 1ms 지연으로 두 요청을 실제로 겹치게 한다
  const [a, b] = await Promise.all([
    createPost(env, { clientId: "concurrent-a", content: "동시 글 A" }),
    createPost(env, { clientId: "concurrent-b", content: "동시 글 B" }),
  ]);
  eq(a.status, 201, "A status");
  eq(b.status, 201, "B status");
  const listed = await listPosts(env, "concurrent-a");
  eq(listed.data.posts.length, 2, "동시 글 중 하나가 사라졌다");
  const contents = listed.data.posts.map((p) => p.content).sort();
  deepEq(contents, ["동시 글 A", "동시 글 B"], "내용");
});

await test("참고: KV 폴백 경로의 동시 글쓰기 결과(재시도 완화책, 보장 아님)", async () => {
  const env = kvEnv({}, 1);
  await Promise.all([
    createPost(env, { clientId: "concurrent-a", content: "동시 글 A" }),
    createPost(env, { clientId: "concurrent-b", content: "동시 글 B" }),
  ]);
  const listed = await listPosts(env, "concurrent-a");
  console.log(`        (KV 경로에 남은 글: ${listed.data.posts.length}/2 — 보장되지 않는 값이라 단언하지 않는다)`);
  ok(listed.data.posts.length >= 1, "KV 경로에서 글이 전부 사라지면 안 된다");
});

// ── 7. 이전 하드닝 회귀 ──────────────────────────────────────────────────────

console.log("\n[7] 이전 하드닝 회귀");

await test("IP 리밋: /community/clear 는 분당 2회를 넘기면 429", async () => {
  const env = kvEnv();
  const call = () => handleFetch(
    req("https://w/community/clear", { method: "POST", body: { clientId: "client-aaa" } }),
    env,
  );
  eq((await call()).status, 200, "1회차");
  eq((await call()).status, 200, "2회차");
  eq((await call()).status, 429, "3회차는 막혀야 한다");
});

await test("IP 리밋은 DO 경로에서도 그대로 걸린다", async () => {
  const env = doEnv();
  const call = () => handleFetch(
    req("https://w/community/clear", { method: "POST", body: { clientId: "client-aaa" } }),
    env,
  );
  await call();
  await call();
  eq((await call()).status, 429, "3회차는 막혀야 한다");
});

await test("X-Admin-Key: /community/reports 는 키 없이 403, 키가 맞으면 200", async () => {
  const env = kvEnv({ COMMUNITY_ADMIN_KEY: ADMIN_KEY });
  const anon = await handleFetch(req("https://w/community/reports"), env);
  eq(anon.status, 403, "키 없음");
  const admin = await handleFetch(
    req("https://w/community/reports", { headers: { "X-Admin-Key": ADMIN_KEY } }),
    env,
  );
  eq(admin.status, 200, "관리자");
});

await test("/sync/prefs 는 private, no-store 로 응답한다", async () => {
  const env = kvEnv();
  const put = await handleFetch(
    req("https://w/sync/prefs", {
      method: "PUT",
      body: { clientId: "client-aaa", prefs: { watchlist: ["NVDA"], portfolio: [], alertSettings: {} } },
    }),
    env,
  );
  eq(put.status, 200, "PUT status");
  eq(put.headers.get("Cache-Control"), "private, no-store", "PUT Cache-Control");
  const get = await handleFetch(req("https://w/sync/prefs?clientId=client-aaa"), env);
  eq(get.headers.get("Cache-Control"), "private, no-store", "GET Cache-Control");
  deepEq((await get.json()).prefs.watchlist, ["NVDA"], "watchlist");
});

await test("업스트림 호출은 전부 fetchT(타임아웃)를 지난다", () => {
  const src = readFileSync(WORKER_SRC, "utf8");
  const bare = src.split("\n").filter((line) => /(?:^|[^.\w])fetch\(/.test(line) && !/fetchT\(/.test(line));
  // 허용: fetchT 내부의 실제 fetch 1회, default export 의 async fetch(request, env),
  // DO 의 async fetch(request) / stub.fetch(request) 디스패치.
  const unexpected = bare.filter((line) =>
    !/signal: ctrl\.signal/.test(line)
    && !/async fetch\(/.test(line)
    && !/stub\.fetch\(/.test(line)
    && !/instance\.fetch\(/.test(line));
  deepEq(unexpected, [], "타임아웃 없는 fetch 가 남아 있다");
});

await test("LLM 게이트가 데이터 프록시(fx·indices·calendar)까지 막지는 않는다", () => {
  const src = readFileSync(WORKER_SRC, "utf8");
  const gated = src.split("\n")
    .filter((l) => l.includes("llmOriginAllowed(request)") && !l.includes("function llmOriginAllowed"));
  // /chat, move_analysis, cachedTickerSummary 세 곳에서만 게이트한다.
  eq(gated.length, 3, "게이트 호출 지점 수");
  for (const marker of ['url.searchParams.get("fx")', 'url.searchParams.get("indices")', 'url.searchParams.get("calendar")']) {
    ok(src.includes(marker), `${marker} 경로가 사라졌다`);
  }
});

// ── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`\n${f.name}\n${(f.err && f.err.stack) || f.err}`);
  process.exit(1);
}
