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
//   · stale-if-error: fx·fng·indices·calendar 가 업스트림 실패 시 KV 직전값을 stale 로 서빙, 7일 캡
//   · Gemini 모델 체인: env.GEMINI_MODEL → 2.0-flash → 1.5-flash, 404/400 만 다음 모델로
//
// env 는 전부 인메모리 모의다: KV 는 Map, AI 는 고정 문자열, DO 는 CommunityStore
// 인스턴스를 직접 감싼 스텁. [8]·[9] 만 globalThis.fetch 를 잠깐 바꿔 업스트림
// (야후·CNN·investing.com·Gemini)의 성공/실패를 흉내 낸다 — 실제 네트워크는 없다.
// =============================================================================

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CommunityStore,
  cachedTickerSummary,
  communityHandlerFor,
  geminiModelChain,
  geminiModelUnavailable,
  handleFetch,
  llmOriginAllowed,
  resolveModelOverride,
  withLastGood,
  parseQuoteState,
  parseQuoteStateFromChart,
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

// ── 8. stale-if-error (withLastGood) — fx·fng·indices·calendar ───────────────
//
// globalThis.fetch 를 잠깐 바꿔 업스트림 성공 → 실패를 흉내 낸다. fetchT 는 호출
// 시점의 전역 fetch 를 쓰므로 모듈을 다시 읽을 필요가 없다.

console.log("\n[8] stale-if-error (직전 정상값 서빙)");

const realFetch = globalThis.fetch;
function withMockFetch(handler, fn) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init, calls.length);
  };
  return Promise.resolve()
    .then(() => fn(calls))
    .finally(() => { globalThis.fetch = realFetch; });
}
const jsonResp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const failResp = () => { throw new TypeError("upstream down"); };

// 야후 v8 chart 응답 최소형 — fetchFx / fetchIndices 가 읽는 필드만.
function yahooChart(closes, extraMeta = {}) {
  return jsonResp({ chart: { result: [{ meta: { regularMarketPrice: closes[closes.length - 1], chartPreviousClose: closes[0], ...extraMeta }, indicators: { quote: [{ close: closes }] } }] } });
}
const cnnBody = { fear_and_greed: { score: 44.77, rating: "fear", timestamp: "2026-09-04T08:21:31+00:00", previous_close: 35.2 } };
// investing.com getCalendarFilteredData 의 data(HTML) 최소형 — parseCalendar 가 읽는 마커만.
const calendarHtml = (event) => `<tr><td class="theDay">2026년 9월 7일 월요일</td></tr>`
  + `<tr class="js-event-item" data-event-datetime="2026/09/07 08:00:00"><td class="first left time">08:00</td>`
  + `<td class="flagCur"><span class="ceFlags South_Korea"></span></td><td class="left event">${event}</td></tr>`;

await test("fx: 업스트림 성공 응답은 예전 모양 그대로(stale 키 없음)이고 KV 에 lastgood:fx 를 남긴다", async () => {
  const env = kvEnv();
  await withMockFetch(() => yahooChart([1300, 1310, 1320]), async () => {
    const res = await handleFetch(req("https://w/?fx=1"), env);
    eq(res.status, 200, "status");
    const data = await res.json();
    ok(Array.isArray(data.fx) && data.fx.length > 0, "fx 배열");
    ok(!("stale" in data) && !("warning" in data), "신선한 응답엔 stale/warning 이 없어야");
    eq(res.headers.get("Warning"), null, "Warning 헤더 없음");
  });
  const saved = JSON.parse(env.MOVE_CACHE.map.get("lastgood:fx"));
  ok(typeof saved.storedAt === "string" && Array.isArray(saved.value) && saved.value.length > 0, "KV lastgood:fx { storedAt, value }");
});

await test("fx: 성공 뒤 업스트림이 죽으면 직전값을 stale:true + storedAt + warning 으로 준다", async () => {
  const env = kvEnv();
  let fresh;
  await withMockFetch(() => yahooChart([1300, 1310, 1320]), async () => {
    fresh = await (await handleFetch(req("https://w/?fx=1"), env)).json();
  });
  await withMockFetch(failResp, async () => {
    const res = await handleFetch(req("https://w/?fx=1"), env);
    eq(res.status, 200, "status");
    const data = await res.json();
    deepEq(data.fx, fresh.fx, "직전 정상값 그대로");
    eq(data.stale, true, "stale 마커");
    ok(typeof data.storedAt === "string" && !Number.isNaN(Date.parse(data.storedAt)), "storedAt ISO");
    ok(typeof data.warning === "string" && data.warning.includes("last good"), "warning 문구");
    ok(/Response is Stale/.test(res.headers.get("Warning") || ""), "Warning 헤더");
    ok(/max-age=120/.test(res.headers.get("Cache-Control") || ""), "낡은 응답은 짧게 캐시");
    eq(res.headers.get("Access-Control-Allow-Origin"), "*", "CORS 유지");
  });
});

await test("fx: 직전값이 없으면 실패 시 기존처럼 빈 배열(stale 없음)", async () => {
  await withMockFetch(failResp, async () => {
    const data = await (await handleFetch(req("https://w/?fx=1"), kvEnv())).json();
    deepEq(data, { fx: [] }, "기존 빈 응답");
  });
});

await test("fx: KV 바인딩이 없으면 계층이 통과되어 기존 동작 그대로", async () => {
  const env = { AI: stubAi() };
  await withMockFetch(() => yahooChart([1, 2, 3]), async () => {
    ok((await (await handleFetch(req("https://w/?fx=1"), env)).json()).fx.length > 0, "성공");
  });
  await withMockFetch(failResp, async () => {
    deepEq(await (await handleFetch(req("https://w/?fx=1"), env)).json(), { fx: [] }, "실패 → 빈 배열");
  });
});

await test("fng: 브라우저 UA 로 CNN 을 부르고(418 회피) 실패 시 직전 지수를 stale 로 준다", async () => {
  const env = kvEnv();
  await withMockFetch((url, init) => {
    ok(url.includes("dataviz.cnn.io"), "CNN 호출");
    const ua = init.headers["User-Agent"];
    ok(/AppleWebKit|Chrome\//.test(ua), `짧은 UA 는 418 을 받는다: ${ua}`);
    ok(/edition\.cnn\.com/.test(init.headers.Referer), "Referer 유지");
    return jsonResp(cnnBody);
  }, async () => {
    const data = await (await handleFetch(req("https://w/?fng=1"), env)).json();
    eq(data.fng.score, 45, "score");
    eq(data.fng.source, "CNN", "source");
    ok(!("stale" in data), "신선");
  });
  await withMockFetch(() => new Response("I'm a teapot", { status: 418 }), async () => {
    const data = await (await handleFetch(req("https://w/?fng=1"), env)).json();
    eq(data.stale, true, "stale");
    eq(data.fng.score, 45, "직전 지수");
    eq(data.fng.rating, "fear", "rating");
  });
});

await test("fng: 직전값이 7일 캡을 넘으면 버리고 기존처럼 {fng:null}", async () => {
  const env = kvEnv();
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  await env.MOVE_CACHE.put("lastgood:fng", JSON.stringify({ storedAt: eightDaysAgo, value: { score: 70, rating: "greed", source: "CNN" } }));
  await withMockFetch(failResp, async () => {
    const data = await (await handleFetch(req("https://w/?fng=1"), env)).json();
    deepEq(data, { fng: null }, "캡 초과 → 빈 응답");
  });
});

await test("fng: 7일 이내(6일)면 여전히 stale 로 서빙된다", async () => {
  const env = kvEnv();
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();
  await env.MOVE_CACHE.put("lastgood:fng", JSON.stringify({ storedAt: sixDaysAgo, value: { score: 70, rating: "greed", source: "CNN" } }));
  await withMockFetch(failResp, async () => {
    const data = await (await handleFetch(req("https://w/?fng=1"), env)).json();
    eq(data.stale, true, "stale");
    eq(data.storedAt, sixDaysAgo, "storedAt 은 저장 시각");
    eq(data.fng.score, 70, "score");
  });
});

await test("withLastGood: 빈 배열·null·예외는 전부 '실패'로 보고, 저장된 값이 깨져 있으면 빈 값", async () => {
  const env = kvEnv();
  const now = Date.parse("2026-09-04T00:00:00Z");
  const first = await withLastGood(env, "t", async () => [1, 2], [], { now });
  deepEq(first, { value: [1, 2], stale: false, storedAt: null }, "성공");
  const empty = await withLastGood(env, "t", async () => [], [], { now: now + 1000 });
  eq(empty.stale, true, "빈 배열 → 직전값");
  deepEq(empty.value, [1, 2], "직전값");
  eq(empty.storedAt, "2026-09-04T00:00:00.000Z", "storedAt");
  const thrown = await withLastGood(env, "t", async () => { throw new Error("x"); }, [], { now: now + 2000 });
  eq(thrown.stale, true, "예외 → 직전값");
  const nul = await withLastGood(env, "t", async () => null, null, { now: now + 3000 });
  eq(nul.stale, true, "null → 직전값");
  // 캡 경계: 7일 + 1ms 는 버린다
  const capped = await withLastGood(env, "t", async () => [], [], { now: now + 7 * 24 * 3600 * 1000 + 1 });
  deepEq(capped, { value: [], stale: false, storedAt: null }, "캡 초과");
  // 깨진 저장값
  await env.MOVE_CACHE.put("lastgood:broken", "not json");
  deepEq(await withLastGood(env, "broken", async () => null, null), { value: null, stale: false, storedAt: null }, "파싱 실패 → 빈 값");
});

await test("indices: 성공 후 실패하면 직전 지수 시리즈를 stale 로 준다", async () => {
  const env = kvEnv();
  await withMockFetch(() => yahooChart([100, 101, 102]), async () => {
    const data = await (await handleFetch(req("https://w/?indices=1"), env)).json();
    ok(data.indices.length > 0 && Array.isArray(data.indices[0].series), "indices 시리즈");
    ok(!("stale" in data), "신선");
  });
  await withMockFetch(failResp, async () => {
    const data = await (await handleFetch(req("https://w/?indices=1"), env)).json();
    eq(data.stale, true, "stale");
    ok(data.indices.length > 0, "직전 시리즈");
  });
});

await test("calendar: 탭별로 보관하고, 한 탭만 죽어도 그 탭만 낡은 값으로 채우며 stale 을 표시한다", async () => {
  const env = kvEnv();
  const tabOf = (init) => (/currentTab=(\w+)/.exec(String(init.body)) || [])[1];
  await withMockFetch((url, init) => jsonResp({ data: calendarHtml(tabOf(init) === "thisWeek" ? "이번주 지표" : "다음주 지표") }), async () => {
    const data = await (await handleFetch(req("https://w/?calendar=1"), env)).json();
    deepEq(data.calendar.map((e) => e.event), ["이번주 지표", "다음주 지표"], "두 탭 합침");
    ok(!("stale" in data), "신선");
  });
  ok(env.MOVE_CACHE.map.has("lastgood:calendar:thisWeek") && env.MOVE_CACHE.map.has("lastgood:calendar:nextWeek"), "탭별 KV 키");
  // nextWeek 만 실패
  await withMockFetch((url, init) => (tabOf(init) === "nextWeek" ? new Response("blocked", { status: 403 }) : jsonResp({ data: calendarHtml("이번주 지표") })), async () => {
    const data = await (await handleFetch(req("https://w/?calendar=1"), env)).json();
    deepEq(data.calendar.map((e) => e.event), ["이번주 지표", "다음주 지표"], "죽은 탭은 직전값으로");
    eq(data.stale, true, "부분 stale 도 표시");
    ok(typeof data.storedAt === "string", "storedAt");
  });
  // 둘 다 실패
  await withMockFetch(failResp, async () => {
    const data = await (await handleFetch(req("https://w/?calendar=1"), env)).json();
    eq(data.calendar.length, 2, "전부 직전값");
    eq(data.stale, true, "stale");
  });
  // 직전값이 전혀 없으면 기존처럼 빈 배열
  await withMockFetch(failResp, async () => {
    deepEq(await (await handleFetch(req("https://w/?calendar=1"), kvEnv())).json(), { calendar: [] }, "기존 빈 응답");
  });
});

// ── 9. Gemini 모델 체인 ──────────────────────────────────────────────────────

console.log("\n[9] Gemini 모델 체인 (env.GEMINI_MODEL → 2.0-flash → 1.5-flash)");

await test("geminiModelChain: 기본 순서, env 우선, 중복 제거", () => {
  deepEq(geminiModelChain({}), ["gemini-2.0-flash", "gemini-1.5-flash"], "기본");
  deepEq(geminiModelChain({ GEMINI_MODEL: "gemini-2.5-flash" }), ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"], "env 우선");
  deepEq(geminiModelChain({ GEMINI_MODEL: " gemini-1.5-flash " }), ["gemini-1.5-flash", "gemini-2.0-flash"], "중복 제거 + trim");
  deepEq(geminiModelChain({ GEMINI_MODEL: "" }), ["gemini-2.0-flash", "gemini-1.5-flash"], "빈 문자열은 무시");
});

await test("geminiModelUnavailable: 404 는 항상, 400 은 모델 문구가 있을 때만, 그 외는 아님", () => {
  eq(geminiModelUnavailable(404, ""), true, "404");
  eq(geminiModelUnavailable(400, '{"error":{"message":"models/gemini-1.5-flash is not found for API version v1beta","status":"NOT_FOUND"}}'), true, "400 model not found");
  eq(geminiModelUnavailable(400, '{"error":{"message":"API key not valid"}}'), false, "400 키 오류");
  eq(geminiModelUnavailable(429, "quota"), false, "429");
  eq(geminiModelUnavailable(500, "model"), false, "500");
});

const geminiUrlModel = (url) => (/models\/([^:]+):/.exec(url) || [])[1];
const geminiChatEnv = () => kvEnv({ GEMINI_API_KEY: "test-key" });

await test("/chat: 첫 모델이 404 면 다음 모델을 한 번 더 시도하고 답한 모델명을 돌려준다", async () => {
  await withMockFetch((url) => {
    if (geminiUrlModel(url) === "gemini-2.0-flash") return jsonResp({ error: { message: "not found" } }, 404);
    return jsonResp({ candidates: [{ content: { parts: [{ text: "제미나이 답변" }] } }] });
  }, async (calls) => {
    const res = await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: chatBody }), geminiChatEnv());
    const data = await res.json();
    eq(data.reply, "제미나이 답변", "reply");
    eq(data.model, "gemini-1.5-flash", "답한 모델");
    deepEq(calls.map((c) => geminiUrlModel(c.url)), ["gemini-2.0-flash", "gemini-1.5-flash"], "시도 순서");
    ok(calls.every((c) => c.init.headers["x-goog-api-key"] === "test-key" && !c.url.includes("key=")), "키는 헤더로만");
  });
});

await test("/chat: env.GEMINI_MODEL 이 있으면 그 모델부터 시도한다", async () => {
  await withMockFetch(() => jsonResp({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), async (calls) => {
    const data = await (await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: chatBody }), kvEnv({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-2.5-flash" }))).json();
    eq(data.model, "gemini-2.5-flash", "env 모델");
    eq(calls.length, 1, "한 번에 성공");
  });
});

await test("/chat: 체인이 전부 404 면 Workers AI 로 폴백한다(모델당 1회만)", async () => {
  await withMockFetch(() => jsonResp({ error: { message: "not found" } }, 404), async (calls) => {
    const data = await (await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: chatBody }), geminiChatEnv())).json();
    eq(data.reply, "테스트 응답입니다.", "Workers AI 답");
    ok(String(data.model).startsWith("@cf/"), `Workers AI 모델: ${data.model}`);
    eq(calls.length, 2, "Gemini 는 모델당 한 번씩만");
  });
});

await test("/chat: 429(쿼터)·키 오류처럼 모델 문제가 아니면 다음 모델로 넘어가지 않고 바로 Workers AI", async () => {
  await withMockFetch(() => jsonResp({ error: { message: "Resource has been exhausted" } }, 429), async (calls) => {
    const data = await (await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: chatBody }), geminiChatEnv())).json();
    eq(data.reply, "테스트 응답입니다.", "Workers AI 답");
    eq(calls.length, 1, "Gemini 1회");
  });
});

await test("/chat stream: 스트리밍 경로도 같은 체인을 타고 SSE 로 델타를 흘린다", async () => {
  const sse = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "안녕" }] } }] })}\n\n`;
  await withMockFetch((url) => {
    ok(url.includes("streamGenerateContent"), "스트리밍 엔드포인트");
    if (geminiUrlModel(url) === "gemini-2.0-flash") return jsonResp({ error: { message: "not found" } }, 404);
    return new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }, async (calls) => {
    const res = await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: { ...chatBody, stream: true } }), geminiChatEnv());
    ok(/text\/event-stream/.test(res.headers.get("Content-Type") || ""), "SSE");
    const text = await res.text();
    ok(text.includes('"delta":"안녕"'), `델타: ${text}`);
    ok(text.includes('"model":"gemini-1.5-flash"'), "답한 모델 메타");
    deepEq(calls.map((c) => geminiUrlModel(c.url)), ["gemini-2.0-flash", "gemini-1.5-flash"], "시도 순서");
  });
});

await test("GEMINI_DEFAULT_MODEL 하드코딩이 소스에서 사라졌다", () => {
  const src = readFileSync(WORKER_SRC, "utf8");
  ok(!src.includes("GEMINI_DEFAULT_MODEL"), "GEMINI_DEFAULT_MODEL 잔존");
  ok(src.includes('"gemini-2.0-flash", "gemini-1.5-flash"'), "기본 체인");
});

// ── quote(프리/애프터마켓) 파서 ─────────────────────────────────────────
await test("parseQuoteState: PRE 는 pre 세션 시세, POST/CLOSED 는 post, REGULAR 는 세션 없음", () => {
  const mk = (r) => ({ quoteResponse: { result: [r] } });
  const pre = parseQuoteState(mk({ marketState: "PRE", regularMarketPrice: 100, regularMarketChangePercent: 1.234, preMarketPrice: 101.567, preMarketChangePercent: 1.567, preMarketTime: 1757100000 }));
  eq(pre.session, "pre", "pre 세션"); eq(pre.price, 101.57, "반올림"); eq(pre.changePct, 1.57); eq(pre.regular, 100); ok(/^2025|^2026/.test(pre.time), "ISO 시각");
  const post = parseQuoteState(mk({ marketState: "POSTPOST", regularMarketPrice: 100, postMarketPrice: 98.5, postMarketChangePercent: -1.5 }));
  eq(post.session, "post"); eq(post.price, 98.5); eq(post.changePct, -1.5);
  const closed = parseQuoteState(mk({ marketState: "CLOSED", regularMarketPrice: 100, postMarketPrice: 99, postMarketChangePercent: -1 }));
  eq(closed.session, "post", "CLOSED 도 애프터 시세가 있으면 post");
  const regular = parseQuoteState(mk({ marketState: "REGULAR", regularMarketPrice: 100, regularMarketChangePercent: 0.5 }));
  eq(regular.session, undefined, "정규장은 세션 없음"); eq(regular.marketState, "REGULAR"); eq(regular.regularChangePct, 0.5);
  eq(parseQuoteState(null), null); eq(parseQuoteState({ quoteResponse: { result: [] } }), null);
});

await test("parseQuoteStateFromChart: 마지막 봉이 post 구간이면 post 세션 시세, 18시간 지나면 세션 없음, 정규장 안이면 REGULAR", () => {
  // 2026-09-04(금) AAPL 실측 구조: 정규장 13:30~20:00Z, post 20:00~24:00Z, 마지막 봉 23:59:58Z 종가 320.01, 정규장 종가 319.97
  const periods = { pre: { start: 1788508800, end: 1788528600 }, regular: { start: 1788528600, end: 1788552000 }, post: { start: 1788552000, end: 1788566400 } };
  const mk = (ts, closes, regular) => ({ chart: { result: [{ meta: { regularMarketPrice: regular, regularMarketChangePercent: -2.51, currentTradingPeriod: periods }, timestamp: ts, indicators: { quote: [{ close: closes }] } }] } });
  const post = parseQuoteStateFromChart(mk([1788551700, 1788552300, 1788566398], [319.9, 320.5, 320.01], 319.97), 1788566398 * 1000 + 3600 * 1000);
  eq(post.session, "post"); eq(post.marketState, "POST"); eq(post.price, 320.01); eq(post.changePct, 0.01); ok(post.time.startsWith("2026-09-04T23:59"), post.time);
  const stale = parseQuoteStateFromChart(mk([1788551700, 1788566398], [319.9, 320.01], 319.97), 1788566398 * 1000 + 25 * 3600 * 1000);
  eq(stale.session, undefined, "일요일 아침엔 금요일 애프터 시세를 안 보여 준다"); eq(stale.marketState, "POST");
  const pre = parseQuoteStateFromChart(mk([1788508800, 1788510000], [330.0, 331.5], 328.21), 1788510000 * 1000 + 60000);
  eq(pre.session, "pre"); eq(pre.changePct, 1.0, "전일 종가 대비"); eq(pre.price, 331.5);
  const regular = parseQuoteStateFromChart(mk([1788528600, 1788540000], [329, 325], 325), 1788540000 * 1000 + 60000);
  eq(regular.session, undefined); eq(regular.marketState, "REGULAR");
  eq(parseQuoteStateFromChart({ chart: { result: [] } }), null);
});

// ── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`\n${f.name}\n${(f.err && f.err.stack) || f.err}`);
  process.exit(1);
}
