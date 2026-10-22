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
//   · Gemini 모델 체인: env.GEMINI_MODEL → 2.5-flash → 2.5-flash-lite, 404/400 만 다음 모델로
//   · 2026-09-15 감사 수정분: 지수 등락률 산수·부분 실패 lastgood·깨진 답 판정 4경로·
//     모르는 경로 404 no-store·crumb 음성 캐시
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
  distinctReporterCount,
  geminiModelChain,
  geminiModelUnavailable,
  handleFetch,
  llmOriginAllowed,
  looksDegenerateReply,
  resetYahooSessionState,
  resolveIndexChangePct,
  parseNaverIndexBasic,
  naverMinuteToSeries,
  resetPublishedEarningsMemo,
  resolveModelOverride,
  withLastGood,
  parseQuoteState,
  parseQuoteStateFromChart,
  parseIntradayChart,
  INTRADAY_RANGE,
  crc32Shard,
  fetchNaverLiveQuote,
  parseNaverBasicQuote,
  normalizeTradingViewSearch,
  normalizeYahooSearch,
  mergeSymbolSearch,
  sanitizeSymbolQuery,
  normalizeInsights,
  optionMaxPain,
  summarizeOptionExpiry,
  normalizeOptionsChain,
  crumbHeaders,
  routeSymbol,
  parseStocktwitsStream,
  parseNaverDiscussion,
  parseRedditListing,
  validateMoveReasons,
  isMoveOnlyClaim,
  isSpeculativeClaim,
  newsMentions,
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
      origin: ALLOWED,
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
  // /chat, move_analysis, cachedTickerSummary, /sync/prefs PUT, event_news(뉴스 수집 비용),
  // move_reasons(주가 움직임 이유, 2026-10-22) 여섯 곳에서만 게이트한다.
  eq(gated.length, 6, "게이트 호출 지점 수");
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

console.log("\n[9] Gemini 모델 체인 (env.GEMINI_MODEL → 2.5-flash → 2.5-flash-lite)");

await test("geminiModelChain: 기본 순서, env 우선, 중복 제거", () => {
  deepEq(geminiModelChain({}), ["gemini-2.5-flash", "gemini-2.5-flash-lite"], "기본");
  deepEq(geminiModelChain({ GEMINI_MODEL: "gemini-3.6-flash" }), ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"], "env 우선");
  deepEq(geminiModelChain({ GEMINI_MODEL: " gemini-2.5-flash-lite " }), ["gemini-2.5-flash-lite", "gemini-2.5-flash"], "중복 제거 + trim");
  deepEq(geminiModelChain({ GEMINI_MODEL: "" }), ["gemini-2.5-flash", "gemini-2.5-flash-lite"], "빈 문자열은 무시");
});

await test("geminiModelUnavailable: 404 는 항상, 400 은 모델 문구가 있을 때만, 그 외는 아님", () => {
  eq(geminiModelUnavailable(404, ""), true, "404");
  eq(geminiModelUnavailable(400, '{"error":{"message":"models/gemini-2.5-flash-lite is not found for API version v1beta","status":"NOT_FOUND"}}'), true, "400 model not found");
  eq(geminiModelUnavailable(400, '{"error":{"message":"API key not valid"}}'), false, "400 키 오류");
  eq(geminiModelUnavailable(429, "quota"), false, "429");
  eq(geminiModelUnavailable(500, "model"), false, "500");
});

const geminiUrlModel = (url) => (/models\/([^:]+):/.exec(url) || [])[1];
const geminiChatEnv = () => kvEnv({ GEMINI_API_KEY: "test-key" });

await test("/chat: 첫 모델이 404 면 다음 모델을 한 번 더 시도하고 답한 모델명을 돌려준다", async () => {
  await withMockFetch((url) => {
    if (geminiUrlModel(url) === "gemini-2.5-flash") return jsonResp({ error: { message: "not found" } }, 404);
    return jsonResp({ candidates: [{ content: { parts: [{ text: "제미나이 답변" }] } }] });
  }, async (calls) => {
    const res = await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: chatBody }), geminiChatEnv());
    const data = await res.json();
    eq(data.reply, "제미나이 답변", "reply");
    eq(data.model, "gemini-2.5-flash-lite", "답한 모델");
    deepEq(calls.map((c) => geminiUrlModel(c.url)), ["gemini-2.5-flash", "gemini-2.5-flash-lite"], "시도 순서");
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
    if (geminiUrlModel(url) === "gemini-2.5-flash") return jsonResp({ error: { message: "not found" } }, 404);
    return new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }, async (calls) => {
    const res = await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: { ...chatBody, stream: true } }), geminiChatEnv());
    ok(/text\/event-stream/.test(res.headers.get("Content-Type") || ""), "SSE");
    const text = await res.text();
    ok(text.includes('"delta":"안녕"'), `델타: ${text}`);
    ok(text.includes('"model":"gemini-2.5-flash-lite"'), "답한 모델 메타");
    deepEq(calls.map((c) => geminiUrlModel(c.url)), ["gemini-2.5-flash", "gemini-2.5-flash-lite"], "시도 순서");
  });
});

await test("GEMINI_DEFAULT_MODEL 하드코딩이 소스에서 사라졌다", () => {
  const src = readFileSync(WORKER_SRC, "utf8");
  ok(!src.includes("GEMINI_DEFAULT_MODEL"), "GEMINI_DEFAULT_MODEL 잔존");
  ok(src.includes('"gemini-2.5-flash", "gemini-2.5-flash-lite"'), "기본 체인");
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

// ── 10. 2026-09-15 감사 수정 ─────────────────────────────────────────────────

console.log("\n[10] 2026-09-15 감사 수정");

await test("resolveIndexChangePct: prevClose 가 있으면 언제나 meta 기준, 시리즈는 폴백일 뿐", () => {
  // 정상: KOSPI 실측(직전 종가 6909.91 → 6684.37 = -3.26%)
  const normal = resolveIndexChangePct(6684.37, 6909.91, [6850, 6800, 6684.37]);
  eq(normal.source, "meta", "meta 기준");
  eq(Math.round(normal.changePct * 100) / 100, -3.26, "참값");
  // 갭 하락일: 시리즈(-0.23%)와 3%p 넘게 벌어져도 값은 meta 그대로여야 한다.
  // 예전의 3%p 오버라이드는 바로 이 경우에 멀쩡한 -3.26 을 -0.23 으로 망가뜨렸다.
  const gap = resolveIndexChangePct(6684.37, 6909.91, [6700, 6690, 6684.37]);
  eq(gap.source, "meta", "갭 하락일에도 meta");
  eq(Math.round(gap.changePct * 100) / 100, -3.26, "값을 바꾸지 않는다");
  ok(Math.abs(gap.changePct - gap.seriesChangePct) > 3, "시리즈와는 3%p 넘게 어긋난 상황");
  // prevClose 결측·0·비유한 → 시리즈 폴백
  eq(resolveIndexChangePct(102, null, [100, 102]).source, "series", "prevClose 결측");
  eq(resolveIndexChangePct(102, 0, [100, 102]).source, "series", "prevClose 0");
  eq(Math.round(resolveIndexChangePct(102, null, [100, 102]).changePct * 100) / 100, 2, "시리즈 등락률");
  // 둘 다 없으면 0
  const none = resolveIndexChangePct(null, null, []);
  eq(none.changePct, 0, "데이터 없음"); eq(none.source, "none");
});

await test("naverMinuteToSeries: 네이버 1분봉 → 09:00 기준 5분 칸 종가(빈 칸은 직전 값, 다른 날짜 제외)", () => {
  const row = (hhmm, v) => ({ localDateTime: `20261002${hhmm}00`, currentPrice: v });
  const rows = [
    row("0904", 101), row("0900", 100), row("0901", 100.5),   // 순서 섞여 와도 칸의 마지막(09:04) 값
    row("0912", 103),                                          // 09:05~09:09 칸 비어 있음 → 101 로 채움
    { localDateTime: "20261001153000", currentPrice: 999 },    // 어제 봉은 버린다
    row("0859", 50),                                           // 개장 전 봉도 버린다
  ];
  eq(JSON.stringify(naverMinuteToSeries(rows, "20261002")), "[101,101,103]", "칸 정렬·빈 칸 채움");
  eq(naverMinuteToSeries([row("0900", 100)], "20261002"), null, "1칸뿐이면 null(야후 폴백)");
  eq(naverMinuteToSeries([], "20261002"), null, "오늘 봉 없음");
  // 장 마감: 15:30 봉은 79번째(09:00 + 5×78) — 화면은 마지막 값을 종가로 15:30 에 놓는다.
  const day = []; for (let m = 0; m <= 390; m += 1) { const h = 9 + Math.floor(m / 60); day.push(row(`${String(h).padStart(2, "0")}${String(m % 60).padStart(2, "0")}`, 100 + m)); }
  const s = naverMinuteToSeries(day, "20261002");
  eq(s.length, 79, "09:00~15:30 → 79칸"); eq(s[78], 490, "마지막 = 15:30 값");
});

await test("3%p 비교로 값을 뒤집던 오버라이드가 사라졌다", () => {
  const src = readFileSync(WORKER_SRC, "utf8");
  ok(!src.includes("INDEX_SERIES_SANITY_PP"), "옛 안전장치 상수 잔존");
  // 남은 3%p 비교는 값 변경이 아니라 로그 전용이어야 한다.
  const divergenceLines = src.split("\n").filter((l) => l.includes("INDEX_SERIES_DIVERGENCE_PP") && !l.includes("const INDEX_SERIES_DIVERGENCE_PP"));
  eq(divergenceLines.length, 1, "어긋남 판정은 한 곳(로그)에서만");
  ok(/console\.error/.test(src.split("\n")[src.split("\n").findIndex((l) => l.includes("INDEX_SERIES_DIVERGENCE_PP") && !l.includes("const ")) + 1] || ""), "판정 뒤는 로그");
});

await test("KR 지수 prevClose 오버라이드(fetchPrevDailyClose)가 소스에서 사라졌다", () => {
  const src = readFileSync(WORKER_SRC, "utf8");
  ok(!src.includes("fetchPrevDailyClose"), "fetchPrevDailyClose 잔존");
  ok(!src.includes("KR_INDICES"), "KR_INDICES 잔존");
  ok(!src.includes("range=7d&interval=1d"), "지수용 별도 일봉 호출 잔존");
});

await test("indices: 심볼당 1회만 부르고 같은 응답의 meta 로 등락률을 낸다(라이브 -4.97 재발 방지)", async () => {
  const env = kvEnv();
  await withMockFetch((url) => {
    if (url.includes("%5EKS11")) {
      // 갭 하락 세션: 직전 종가 6909.91 → 시가 6700 → 종가 6684.37. 시리즈만 보면 -0.23% 다.
      return jsonResp({ chart: { result: [{ meta: { regularMarketPrice: 6684.37, chartPreviousClose: 6909.91 }, indicators: { quote: [{ close: [6700, 6690, 6684.37] }] } }] } });
    }
    return yahooChart([100, 101, 102]);
  }, async (calls) => {
    const data = await (await handleFetch(req("https://w/?indices=1"), env)).json();
    eq(calls.filter((c) => c.url.includes("finance.yahoo.com")).length, 8, "INDEX_LIST 8종 × 1회 (별도 일봉 호출 없음)");
    eq(calls.filter((c) => c.url.includes("m.stock.naver.com")).length, 2, "KR 지수 2종만 네이버 1회씩");
    // 이 목은 네이버 응답을 주지 않으므로(차트 JSON) 야후 meta 폴백 경로를 본다.
    const kospi = data.indices.find((i) => i.symbol === "^KS11");
    eq(kospi.changePct, -3.26, "meta 기준 참값 — 시리즈와 벌어져도 뒤집지 않는다");
    eq(kospi.changePctSource, "meta", "어느 쪽을 썼는지 응답에 표기");
  });
});

await test("indices: KR 지수는 네이버 m.stock 값이 기준이다 — 야후 prevClose 가 밀린 날에도 국내 스냅샷과 같다", async () => {
  const env = kvEnv();
  await withMockFetch((url) => {
    if (url.includes("m.stock.naver.com/api/index/KOSDAQ/basic")) {
      return jsonResp({ closePrice: "815.98", fluctuationsRatio: "0.44", compareToPreviousPrice: { code: "2", name: "RISING" } });
    }
    if (url.includes("m.stock.naver.com/api/index/KOSPI/basic")) {
      return jsonResp({ closePrice: "6,627.26", fluctuationsRatio: "-0.85", compareToPreviousPrice: { code: "5", name: "FALLING" } });
    }
    if (url.includes("%5EKQ11")) {
      // 2026-09-16 라이브 재현: 야후 chartPreviousClose 806.79(하루 밀림) → +1.14%. 참값 +0.44.
      return jsonResp({ chart: { result: [{ meta: { regularMarketPrice: 815.98, chartPreviousClose: 806.79 }, indicators: { quote: [{ close: [806.97, 815.98] }] } }] } });
    }
    return yahooChart([100, 101, 102]);
  }, async () => {
    const data = await (await handleFetch(req("https://w/?indices=1"), env)).json();
    const kosdaq = data.indices.find((i) => i.symbol === "^KQ11");
    eq(kosdaq.changePct, 0.44, "네이버 등락률");
    eq(kosdaq.price, 815.98, "네이버 가격");
    eq(kosdaq.changePctSource, "naver", "출처 표기");
    deepEq(kosdaq.series, [806.97, 815.98], "스파크라인은 야후 시리즈 그대로");
    const kospi = data.indices.find((i) => i.symbol === "^KS11");
    eq(kospi.price, 6627.26, "천 단위 쉼표 파싱");
    eq(kospi.changePct, -0.85, "하락 부호");
    eq(data.indices.find((i) => i.symbol === "^DJI").changePctSource, "meta", "미국 지수는 그대로 야후");
  });
});

await test("indices: 야후가 죽어도 KR 지수는 네이버 값으로 나온다(시리즈 빈 배열)", async () => {
  const env = kvEnv();
  await withMockFetch((url) => {
    if (url.includes("m.stock.naver.com")) return jsonResp({ closePrice: "812.41", fluctuationsRatio: "0.70", compareToPreviousPrice: { name: "RISING" } });
    throw new TypeError("yahoo down");
  }, async () => {
    const data = await (await handleFetch(req("https://w/?indices=1"), env)).json();
    const rows = data.indices.filter((i) => i.changePctSource === "naver");
    eq(rows.length, 2, "KR 2종");
    deepEq(rows[0].series, [], "시리즈 없음");
  });
});

await test("parseNaverIndexBasic: 부호 없는 하락·빈 값·0 가격을 걸러낸다", () => {
  eq(parseNaverIndexBasic({ closePrice: "800", fluctuationsRatio: "1.2", compareToPreviousPrice: { name: "FALLING" } }).changePct, -1.2, "방향 코드로 부호 보정");
  eq(parseNaverIndexBasic({ closePrice: "", fluctuationsRatio: "1.2" }), null, "가격 없음");
  eq(parseNaverIndexBasic({ closePrice: "0", fluctuationsRatio: "0" }), null, "0 가격");
  eq(parseNaverIndexBasic(null), null, "null");
  eq(parseNaverIndexBasic({ closePrice: "800", fluctuationsRatio: "0.00", compareToPreviousPrice: { name: "EVEN" } }).changePct, 0, "보합");
});

await test("indices: prevClose 가 없으면 시리즈 폴백이고 changePctSource 가 series 로 표시된다", async () => {
  const env = kvEnv();
  await withMockFetch(() => jsonResp({ chart: { result: [{ meta: { regularMarketPrice: 102 }, indicators: { quote: [{ close: [100, 101, 102] }] } }] } }), async () => {
    const data = await (await handleFetch(req("https://w/?indices=1"), env)).json();
    const first = data.indices[0];
    eq(first.changePct, 2, "시리즈 첫 봉 기준");
    eq(first.changePctSource, "series", "폴백 표기");
  });
});

await test("withLastGood: 기대 심볼의 60% 미만만 돌아오면 실패로 보고 lastgood 을 덮지 않는다", async () => {
  const env = kvEnv();
  const full = [1, 2, 3, 4, 5, 6, 7, 8];
  const fresh = await withLastGood(env, "p", async () => full, [], { expectedCount: 8 });
  deepEq(fresh.value, full, "전량 성공은 저장");
  const partial = await withLastGood(env, "p", async () => [1, 2, 3], [], { expectedCount: 8 });
  eq(partial.stale, true, "부분 실패는 직전값으로");
  deepEq(partial.value, full, "직전값 그대로");
  deepEq(JSON.parse(env.MOVE_CACHE.map.get("lastgood:p")).value, full, "KV 가 조각으로 덮이지 않았다");
  const okish = await withLastGood(env, "p", async () => [1, 2, 3, 4, 5], [], { expectedCount: 8 });
  eq(okish.stale, false, "5/8 은 임계 이상이라 정상");
  deepEq(JSON.parse(env.MOVE_CACHE.map.get("lastgood:p")).value, [1, 2, 3, 4, 5], "정상값은 저장");
  const none = await withLastGood(kvEnv(), "q", async () => [1], [], { expectedCount: 8 });
  eq(none.partial, true, "직전값이 없으면 partial 표시");
  deepEq(none.value, [1], "모은 조각은 준다");
});

const degenerateText = "of the the ".repeat(15).trim();

await test("looksDegenerateReply: 같은 3-gram 반복·한글 없는 한국어 답을 깨진 것으로 본다", () => {
  eq(looksDegenerateReply(degenerateText, true), true, "반복");
  eq(looksDegenerateReply("삼성전자는 반도체 업황과 환율에 함께 영향을 받는 종목입니다. 최근 뉴스는 공급 계약과 관련이 있습니다.", true), false, "정상 한국어");
  eq(looksDegenerateReply("짧음", true), false, "40자 미만은 판정하지 않음");
});

await test("깨진 답 판정이 4개 응답 경로 전부에 걸려 있다", () => {
  const src = readFileSync(WORKER_SRC, "utf8");
  const sites = src.split("\n").filter((l) => l.includes("looksDegenerateReply(") && !l.includes("function looksDegenerateReply"));
  // Gemini 비스트리밍 / 스트리밍 flush(제미나이·Workers AI 공용) / WAI 스트림 객체 폴백 / WAI 비스트리밍
  eq(sites.length, 4, `판정 호출 지점 수: ${sites.join(" | ")}`);
});

await test("/chat: Gemini 첫 모델이 깨진 답을 주면 다음 모델로 넘어간다", async () => {
  await withMockFetch((url) => {
    if (geminiUrlModel(url) === "gemini-2.5-flash") return jsonResp({ candidates: [{ content: { parts: [{ text: degenerateText }] } }] });
    return jsonResp({ candidates: [{ content: { parts: [{ text: "정상적인 한국어 답변입니다." }] } }] });
  }, async () => {
    const data = await (await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: chatBody }), geminiChatEnv())).json();
    eq(data.reply, "정상적인 한국어 답변입니다.", "깨진 답은 버린다");
    eq(data.model, "gemini-2.5-flash-lite", "다음 모델");
  });
});

await test("/chat stream: 깨진 답이 흘러가면 done 메타에 degenerate 를 표시한다", async () => {
  const sse = (text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
  await withMockFetch(() => new Response(sse(degenerateText), { status: 200, headers: { "Content-Type": "text/event-stream" } }), async () => {
    const res = await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: { ...chatBody, stream: true } }), geminiChatEnv());
    const text = await res.text();
    ok(text.includes('"degenerate":true'), `done 메타: ${text.slice(-200)}`);
  });
  await withMockFetch(() => new Response(sse("정상적인 한국어 답변입니다. 오늘 시장은 반도체 업종이 강세였습니다."), { status: 200, headers: { "Content-Type": "text/event-stream" } }), async () => {
    const res = await handleFetch(req("https://w/chat", { method: "POST", origin: ALLOWED, body: { ...chatBody, stream: true } }), geminiChatEnv());
    ok(!(await res.text()).includes("degenerate"), "정상 답에는 플래그 없음");
  });
});

await test("모르는 경로는 404 + no-store (400 을 15분 캐시하던 문제)", async () => {
  const res = await handleFetch(req("https://w/nope"), kvEnv());
  eq(res.status, 404, "status");
  eq(res.headers.get("Cache-Control"), "no-store", "Cache-Control");
  eq((await res.json()).error, "not_found", "error");
});

await test("?ticker= 응답에는 Vary: Origin 이 붙는다(요약이 Origin 에 따라 갈리므로)", async () => {
  resetYahooSessionState();
  await withMockFetch(() => new Response("", { status: 403 }), async () => {
    const res = await handleFetch(req("https://w/?ticker=AAPL"), kvEnv());
    eq(res.headers.get("Vary"), "Origin", "Vary");
  });
  resetYahooSessionState();
});

await test("ticker 는 16자로 잘려 업스트림 URL 로 나간다", async () => {
  resetYahooSessionState();
  await withMockFetch(() => new Response("", { status: 403 }), async (calls) => {
    await handleFetch(req(`https://w/?ticker=${"A".repeat(40)}`), kvEnv());
    const chartCall = calls.find((c) => c.url.includes("/v8/finance/chart/"));
    ok(chartCall && /\/chart\/A{16}\?/.test(chartCall.url), `차트 호출 URL: ${chartCall && chartCall.url}`);
  });
  resetYahooSessionState();
});

await test("?earnings_probe=1 은 관리자 키 뒤에 있다(무인증이면 야후를 부르지 않는다)", async () => {
  const env = kvEnv({ COMMUNITY_ADMIN_KEY: "sekret" });
  let fetched = 0;
  await withMockFetch(() => { fetched += 1; return new Response("", { status: 200 }); }, async () => {
    const denied = await handleFetch(req("https://w/?earnings_probe=1"), env);
    eq(denied.status, 403, "무인증 403");
    eq(fetched, 0, "업스트림 미호출");
  });
});

// 호출 게이트 테스트: 여기서 보는 건 "crumb 이 죽었을 때 야후를 더 두드리지 않는다" 뿐이다.
// earnings 가 null 인 건 폴백 소스까지 전부 403 인 목이라서다 — 데이터가 있어야 하는
// 상황의 가용성은 아래 '실적 가용성' 테스트들이 따로 본다(2026-09-16 재감사).
await test("crumb 부트스트랩 실패는 음성 캐시된다 — 야후 실적 호출을 추가로 하지 않는다", async () => {
  resetYahooSessionState();
  resetPublishedEarningsMemo();
  await withMockFetch(() => new Response("", { status: 403 }), async (calls) => {
    const data = await (await handleFetch(req("https://w/?ticker=AAPL"), kvEnv())).json();
    eq(data.earnings, null, "모든 소스가 죽은 목에서는 earnings null");
    eq(data.earningsStatus.state, "unavailable", "null 이어도 상태는 명시");
    ok(calls.some((c) => /fc\.yahoo\.com|guce\.yahoo\.com/.test(c.url)), "첫 요청은 부트스트랩을 시도한다");
    calls.length = 0;
    await handleFetch(req("https://w/?ticker=MSFT"), kvEnv());
    ok(!calls.some((c) => /fc\.yahoo\.com|guce\.yahoo\.com|getcrumb/.test(c.url)), `5분간 재부트스트랩 금지: ${calls.map((c) => c.url).join(" ")}`);
    ok(!calls.some((c) => c.url.includes("quoteSummary") || c.url.includes("visualization")), "crumb 없으면 실적 호출도 안 한다");
  });
  resetYahooSessionState();
});

await test("실적 가용성: 야후 crumb 이 죽어도 발행된 실적 캘린더·details 로 nextDate 와 history 를 준다", async () => {
  resetYahooSessionState();
  resetPublishedEarningsMemo();
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await withMockFetch((url) => {
    if (url.endsWith("/data/earnings_calendar.json")) {
      return jsonResp({ earnings: [{ ticker: "NVDA", nextDate: future, epsEstimate: 2.4727 }, { ticker: "OLD", nextDate: "2020-01-01" }] });
    }
    if (url.endsWith("/data/details/NVDA.json")) {
      return jsonResp({ earningsHistory: [
        { date: "2025-02-26", epsActual: 0.89, epsEstimate: 0.85, surprisePct: 5.25 },
        { date: "2025-05-28", epsActual: 0.96, epsEstimate: 0.93, surprisePct: 3.1 },
      ] });
    }
    return new Response("", { status: 403 });
  }, async () => {
    const data = await (await handleFetch(req("https://w/?ticker=NVDA"), kvEnv())).json();
    eq(data.earnings.nextDate, future, "캘린더 nextDate");
    eq(data.earnings.epsEstimate, 2.4727, "EPS 예상");
    eq(data.earnings.history[0].date, "2025-05-28", "history 최신순");
    eq(data.earningsStatus.state, "fallback", "폴백 상태");
    eq(data.earningsStatus.source, "mir-published", "출처");
  });
  resetYahooSessionState();
  resetPublishedEarningsMemo();
});

await test("실적 가용성: 지난 날짜만 있고 이력도 없으면 earnings null + '데이터 없음' 상태", async () => {
  resetYahooSessionState();
  resetPublishedEarningsMemo();
  await withMockFetch((url) => {
    if (url.endsWith("/data/earnings_calendar.json")) return jsonResp({ earnings: [{ ticker: "OLD", nextDate: "2020-01-01" }] });
    return new Response("", { status: 404 });
  }, async () => {
    const data = await (await handleFetch(req("https://w/?ticker=OLD"), kvEnv())).json();
    eq(data.earnings, null, "지난 실적일을 다음 실적일로 내보내지 않는다");
    eq(data.earningsStatus.state, "unavailable", "상태");
    eq(data.earningsStatus.note, "실적 데이터 없음", "명시 문구");
  });
  resetYahooSessionState();
  resetPublishedEarningsMemo();
});

await test("실적 가용성: 국내 종목은 폴백 소스가 없어 발행 파일을 부르지 않고 상태만 명시", async () => {
  resetYahooSessionState();
  resetPublishedEarningsMemo();
  await withMockFetch(() => new Response("", { status: 403 }), async (calls) => {
    const data = await (await handleFetch(req("https://w/?ticker=005930.KS"), kvEnv())).json();
    eq(data.earnings, null, "null");
    eq(data.earningsStatus.reason, "kr_no_earnings_source", "사유");
    ok(!calls.some((c) => c.url.includes("github.io")), "Pages 호출 없음");
  });
  resetYahooSessionState();
});

await test("/sync/prefs PUT: Origin 게이트 + 180일 TTL + 바이트 기준 크기 제한", async () => {
  const env = kvEnv();
  const body = { clientId: "client-ttl", prefs: { watchlist: ["NVDA"], portfolio: [], alertSettings: {} } };
  const noOrigin = await handleFetch(req("https://w/sync/prefs", { method: "PUT", body }), env);
  eq(noOrigin.status, 403, "Origin 없으면 403");
  eq((await noOrigin.json()).error, "forbidden_origin", "error");

  let ttl = null;
  const basePut = env.COMMUNITY_KV.put.bind(env.COMMUNITY_KV);
  env.COMMUNITY_KV.put = async (key, value, options) => { ttl = options && options.expirationTtl; return basePut(key, value); };
  const okRes = await handleFetch(req("https://w/sync/prefs", { method: "PUT", origin: ALLOWED, body }), env);
  eq(okRes.status, 200, "허용 Origin 은 200");
  eq(ttl, 180 * 24 * 60 * 60, "expirationTtl 180일");

  // 한글 12,000자 = 36,000바이트. UTF-16 길이로 재던 시절엔 32KB 제한을 통과했다.
  const big = { clientId: "client-big", prefs: { watchlist: ["가".repeat(12000)], portfolio: [], alertSettings: {} } };
  const tooLarge = await handleFetch(req("https://w/sync/prefs", { method: "PUT", origin: ALLOWED, body: big }), env);
  eq(tooLarge.status, 413, "바이트 기준으로 거부");
});

await test("/sync/prefs PUT: 시장별 관심종목·투자 가설을 보존하고, 없으면 필드를 만들지 않는다", async () => {
  const env = kvEnv();
  const theses = { items: [{ id: "th-1", ticker: "AAPL", market: "us", createdAt: "2026-09-26T09:00:00+09:00" }], deleted: ["th-0"] };
  const body = { clientId: "client-thesis", prefs: { watchlist: ["NVDA"], watchlistUs: ["NVDA"], watchlistKr: ["005930"], portfolio: [], alertSettings: {}, theses } };
  const put = await handleFetch(req("https://w/sync/prefs", { method: "PUT", origin: ALLOWED, body }), env);
  eq(put.status, 200, "PUT 200");
  const got = await (await handleFetch(req("https://w/sync/prefs?clientId=client-thesis"), env)).json();
  eq(got.prefs.theses.items[0].id, "th-1", "가설 보존");
  eq(got.prefs.theses.deleted[0], "th-0", "삭제 표식 보존");
  eq(got.prefs.watchlistKr[0], "005930", "KR 관심종목 보존");
  const plain = { clientId: "client-plain", prefs: { watchlist: ["NVDA"], portfolio: [], alertSettings: {}, theses: [1, 2] } };
  await handleFetch(req("https://w/sync/prefs", { method: "PUT", origin: ALLOWED, body: plain }), env);
  const got2 = await (await handleFetch(req("https://w/sync/prefs?clientId=client-plain"), env)).json();
  eq(got2.prefs.theses, undefined, "배열 등 잘못된 형식은 버린다");
  eq(got2.prefs.watchlistUs, undefined, "보내지 않은 필드는 만들지 않는다");
});

await test("/sync/prefs PUT: 관심 사용자 리스트·종목 메모를 정리해 보존하고, 없거나 형식이 틀리면 만들지 않는다", async () => {
  const env = kvEnv();
  const groups = [{ id: "g1", name: "AI", tickers: ["nvda", "MSFT"] }, { id: "g1", name: "중복", tickers: [] }, { name: "id 없음", tickers: [] }];
  const notes = { nvda: { t: "가".repeat(250), u: 5 }, MSFT: { t: "", u: 6 }, BAD: { t: "x" }, "005930": "문자열" };
  const body = { clientId: "client-wl", prefs: { watchlist: [], portfolio: [], alertSettings: {}, watchGroupsUs: groups, watchNotesUs: notes, watchGroupsKr: [], watchNotesKr: {} } };
  eq((await handleFetch(req("https://w/sync/prefs", { method: "PUT", origin: ALLOWED, body }), env)).status, 200, "PUT 200");
  const got = await (await handleFetch(req("https://w/sync/prefs?clientId=client-wl"), env)).json();
  eq(JSON.stringify(got.prefs.watchGroupsUs), JSON.stringify([{ id: "g1", name: "AI", tickers: ["NVDA", "MSFT"] }]), "리스트 정리·보존");
  eq(Object.keys(got.prefs.watchNotesUs).sort().join(","), "MSFT,NVDA", "깨진 메모 버림, 삭제 표식 유지");
  eq(got.prefs.watchNotesUs.NVDA.t.length, 200, "메모 200자");
  eq(JSON.stringify(got.prefs.watchGroupsKr), "[]", "빈 리스트 배열은 '모두 지움'으로 보존");
  const plain = { clientId: "client-wl2", prefs: { watchlist: [], portfolio: [], alertSettings: {}, watchGroupsUs: "x", watchNotesUs: [1] } };
  await handleFetch(req("https://w/sync/prefs", { method: "PUT", origin: ALLOWED, body: plain }), env);
  const got2 = await (await handleFetch(req("https://w/sync/prefs?clientId=client-wl2"), env)).json();
  eq(got2.prefs.watchGroupsUs, undefined, "배열 아닌 리스트는 버린다");
  eq(got2.prefs.watchNotesUs, undefined, "객체 아닌 메모는 버린다");
  eq(got2.prefs.watchGroupsKr, undefined, "보내지 않은 필드는 만들지 않는다");
});

await test("신고 자동 숨김은 건수가 아니라 서로 다른 신고자(해시 IP) 수를 센다", () => {
  eq(distinctReporterCount({ reports: [{ clientId: "a", ipHash: "h1" }, { clientId: "b", ipHash: "h1" }, { clientId: "c", ipHash: "h1" }] }), 1, "같은 IP 3건 = 1명");
  eq(distinctReporterCount({ reports: [{ clientId: "a", ipHash: "h1" }, { clientId: "b", ipHash: "h2" }, { clientId: "c", ipHash: "h3" }] }), 3, "서로 다른 IP 3명");
  eq(distinctReporterCount({ reports: [{ clientId: "a" }, { clientId: "a" }] }), 1, "ipHash 없으면 clientId 로");
  eq(distinctReporterCount(null), 0, "빈 값");
});

// ── 분봉 · 큰 등락일 뉴스(2026-10-01) ─────────────────────────────────────────

console.log("\n[분봉·이벤트 뉴스]");

await test("분봉: 거래소 현지 시각으로 바꾸고 종가 없는 봉은 뺀다", () => {
  // 2026-09-30 09:30 / 09:35 / 09:40 ET(= 13:30Z …). 가운데 봉은 종가 없음.
  const t0 = Date.UTC(2026, 8, 30, 13, 30) / 1000;
  const { bars, tz } = parseIntradayChart({
    meta: { exchangeTimezoneName: "America/New_York" },
    timestamp: [t0, t0 + 300, t0 + 600],
    indicators: { quote: [{ open: [10, 11, 12], high: [10.5, 11.5, 12.5], low: [9.5, 10.5, 11.5], close: [10.2, null, 12.1], volume: [100, 200, null] }] },
  });
  eq(tz, "America/New_York", "tz");
  eq(bars.length, 2, "종가 없는 봉 제외");
  eq(bars[0][5], "2026-09-30T09:30", "현지 시각");
  eq(bars[1][5], "2026-09-30T09:40", "현지 시각");
  eq(bars[1][4], 0, "거래량 없으면 0");
  // 서울(국내) 09:00 KST = 00:00Z
  const k = parseIntradayChart({ meta: { exchangeTimezoneName: "Asia/Seoul" }, timestamp: [Date.UTC(2026, 8, 30, 0, 0) / 1000], indicators: { quote: [{ close: [70000] }] } });
  eq(k.bars[0][5], "2026-09-30T09:00", "KST");
  eq(k.bars[0][0], 70000, "시가 없으면 종가로");
});

await test("분봉 경로: 허용 간격만 야후로 보내고(기간 매핑) 모르는 간격은 5분", async () => {
  const t0 = Date.UTC(2026, 8, 30, 13, 30) / 1000;
  const body = { chart: { result: [{ meta: { exchangeTimezoneName: "America/New_York" }, timestamp: [t0], indicators: { quote: [{ open: [1], high: [1], low: [1], close: [1], volume: [5] }] } }] } };
  await withMockFetch(() => jsonResp(body), async (calls) => {
    const r = await handleFetch(req("https://w/?intraday=1&ticker=NVDA&interval=1m"), {});
    const got = await r.json();
    eq(r.status, 200, "status");
    eq(got.bars.length, 1, "bars");
    ok(calls[0].url.includes("range=5d&interval=1m"), `1분은 5일: ${calls[0].url}`);
    ok(r.headers.get("Access-Control-Allow-Origin"), "CORS");
    await handleFetch(req("https://w/?intraday=1&ticker=NVDA&interval=7m"), {});
    ok(calls[1].url.includes(`range=${INTRADAY_RANGE["5m"]}&interval=5m`), `모르는 간격 → 5분: ${calls[1].url}`);
  });
});

await test("큰 등락일 뉴스: Origin 없으면 거부, 캐시 히트는 업스트림을 부르지 않는다", async () => {
  const env = { MOVE_CACHE: memKv() };
  const r0 = await handleFetch(req("https://w/?event_news=1&ticker=NVDA&date=2026-09-30"), env);
  eq(r0.status, 403, "Origin 없음");
  const bad = await handleFetch(req("https://w/?event_news=1&ticker=NVDA&date=20260930", { origin: ALLOWED }), env);
  eq(bad.status, 400, "날짜 형식");
  await env.MOVE_CACHE.put("evnews:v2:NVDA:2026-09-30", JSON.stringify({ ticker: "NVDA", date: "2026-09-30", news: [{ title: "t", link: "https://a" }] }));
  await withMockFetch(() => { throw new Error("업스트림 호출됨"); }, async (calls) => {
    const r = await handleFetch(req("https://w/?event_news=1&ticker=NVDA&date=2026-09-30", { origin: ALLOWED }), env);
    const got = await r.json();
    eq(got.cached, true, "cached");
    eq(got.news.length, 1, "news");
    eq(calls.length, 0, "업스트림 0회");
  });
});

await test("큰 등락일 뉴스: ±2일 한 번만, 소스 동시 호출, 막힌 소스는 diag 로 남고 나머지로 답한다", async () => {
  const env = { MOVE_CACHE: memKv() };
  const rss = `<rss><channel><item><title>Acme jumps on deal - Reuters</title><link>https://n.example/a</link><source>Reuters</source><pubDate>Thu, 04 Nov 2021 07:00:00 GMT</pubDate></item>`
    + `<item><title>Acme old story</title><link>https://n.example/b</link><source>X</source><pubDate>Mon, 25 Oct 2021 07:00:00 GMT</pubDate></item></channel></rss>`;
  await withMockFetch((url) => {
    if (url.includes("finance/chart")) return jsonResp({ chart: { result: [{ meta: { longName: "Acme Corp" } }] } });
    if (url.includes("news.google.com")) return new Response(rss, { status: 200 });
    if (url.includes("gdeltproject")) return new Response("Please limit requests", { status: 200 });
    throw new Error("unexpected " + url);
  }, async (calls) => {
    const r = await handleFetch(req("https://w/?event_news=1&ticker=ACME&date=2021-11-04", { origin: ALLOWED }), env);
    const got = await r.json();
    eq(got.news.length, 1, "±2일 밖 기사는 뺀다");
    eq(got.news[0].publishedAt, "2021-11-04", "date");
    ok(/^ok 2 /.test(got.diag.google), `google diag ${got.diag.google}`);
    eq(got.diag.gdelt, got.diag.gdelt.startsWith("not_json") ? got.diag.gdelt : "x", "gdelt 안내문은 not_json");
    eq(got.diag.finnhub.split(" ")[0], "no_key", "finnhub 키 없음");
    eq(calls.filter((c) => c.url.includes("news.google.com")).length, 1, "구글은 한 번만(±7일 재검색 없음)");
    ok(!calls.some((c) => c.url.includes("v1/finance/search")), "최신 야후 뉴스는 부르지 않는다");
  });
});

await test("미리 모은 뉴스 샤드: crc32 % 64 가 빌더(zlib)·화면(shardOf)과 같다", () => {
  eq(crc32Shard("NVDA"), 23, "NVDA");
  eq(crc32Shard("005930"), 24, "005930");
});

const momentShard = (code, date, rows) => jsonResp({ v: 1, t: { [code]: { [date]: rows } } });

await test("큰 등락일 뉴스: 미리 모은 날짜면 샤드만 읽고 구글·GDELT 는 부르지 않는다", async () => {
  const env = { MOVE_CACHE: memKv() };
  await withMockFetch((url) => {
    if (url.includes("/data/moment_news/us_23.json")) return momentShard("NVDA", "2021-11-04", [["Nvidia hits record", "Bloomberg", "g:ABC", "2021-11-04"]]);
    throw new Error("unexpected " + url);
  }, async (calls) => {
    const r = await handleFetch(req("https://w/?event_news=1&ticker=NVDA&date=2021-11-04", { origin: ALLOWED }), env);
    const got = await r.json();
    eq(got.news.length, 1, "news");
    eq(got.news[0].link, "https://news.google.com/rss/articles/ABC?oc=5", "g: 링크 되돌림");
    eq(calls.length, 1, "샤드 한 번만");
  });
});

await test("원인 분석: 미리 모은 기사를 근거로 쓰고 구글·GDELT 를 부르지 않는다", async () => {
  const env = { MOVE_CACHE: memKv() };
  const chart = { chart: { result: [{ meta: { longName: "NVIDIA Corporation" }, timestamp: [], indicators: { quote: [{ open: [], high: [], low: [], close: [], volume: [] }] } }] } };
  await withMockFetch((url) => {
    if (url.includes("/data/moment_news/us_23.json")) return momentShard("NVDA", "2021-11-04", [["Nvidia stock jumps on metaverse push", "Reuters", "g:XYZ", "2021-11-04"]]);
    if (url.includes("finance/chart")) return jsonResp(chart);
    if (url.includes("v1/finance/search")) return jsonResp({ news: [] });
    if (url.includes("news.google.com") || url.includes("gdeltproject")) throw new Error("blocked source called");
    return jsonResp({});
  }, async (calls) => {
    const r = await handleFetch(req("https://w/?move_analysis=1&ticker=NVDA&date=2021-11-04&change=12", { origin: ALLOWED }), env);
    const got = await r.json();
    ok(got.sources.some((x) => x.title === "Nvidia stock jumps on metaverse push"), "미리 모은 기사가 근거에 있다");
    ok(!calls.some((c) => c.url.includes("news.google.com") || c.url.includes("gdeltproject")), "구글·GDELT 미호출");
    eq(got.searchWindowDays, 2, "±2일");
  });
});

await test("국내 분봉: 네이버 시세(KRX) 현재가와 '전일 대비'로 푼 전일 종가를 quote 로 싣는다", async () => {
  const t0 = Date.UTC(2026, 9, 2, 1, 33) / 1000;
  const yahoo = { chart: { result: [{ meta: { exchangeTimezoneName: "Asia/Seoul" }, timestamp: [t0], indicators: { quote: [{ open: [274250], high: [274250], low: [274250], close: [274250], volume: [0] }] } }] } };
  await withMockFetch((url) => {
    if (url.includes("finance/chart")) return jsonResp(yahoo);
    if (url.includes("/basic")) return jsonResp({ closePrice: "275,500", compareToPreviousClosePrice: "-500", compareToPreviousPrice: { code: "5" }, localTradedAt: "2026-10-02T11:12:00+09:00", marketStatus: "OPEN" });
    throw new Error("unexpected " + url);
  }, async (calls) => {
    const r = await handleFetch(req("https://w/?intraday=1&ticker=005930.KS&interval=1m"), {});
    const got = await r.json();
    eq(got.quote.price, 275500, "price");
    eq(got.quote.prevClose, 276000, "하락 500 → 전일 276,000(KRX)");
    eq(got.quote.source, "naver", "source");
    ok(!calls.some((c) => c.url.includes("/day?")), "네이버 일봉(통합 종가)은 부르지 않는다");
  });
  eq(parseNaverBasicQuote({ closePrice: "10,000", compareToPreviousClosePrice: "300", compareToPreviousPrice: { code: "2" } }).prevClose, 9700, "상승");
  eq(parseNaverBasicQuote({ closePrice: "10,000", compareToPreviousClosePrice: "0", compareToPreviousPrice: { code: "3" } }).prevClose, 10000, "보합");
  await withMockFetch(() => { throw new Error("down"); }, async () => {
    eq(await fetchNaverLiveQuote("005930.KS"), null, "실패하면 null");
  });
});

// ── Cloudflare 플랫폼: Turnstile · Rate Limiting 바인딩 · 엣지 캐시(2026-10-21) ──

console.log("\n[CF] Turnstile · Rate Limiting 바인딩 · 엣지 캐시");

const TS_SECRET = "test-turnstile-secret";
function turnstileMock(success) {
  return (url, init) => {
    if (url.includes("challenges.cloudflare.com/turnstile/v0/siteverify")) {
      const form = new URLSearchParams(String(init.body || ""));
      return jsonResp({ success: success && form.get("secret") === TS_SECRET && form.get("response") === "tok-ok" });
    }
    throw new Error("unexpected " + url);
  };
}

await test("Turnstile: TURNSTILE_SECRET 이 없으면 검증 없이 예전처럼 글·댓글·투표가 된다(siteverify 미호출)", async () => {
  const env = kvEnv();
  await withMockFetch(() => { throw new Error("network must not be called"); }, async (calls) => {
    const created = await createPost(env, { clientId: "ts-off", content: "키 없는 글" });
    eq(created.status, 201, "글");
    const postId = (await created.json()).post.id;
    const c = await handleFetch(req("https://w/community/comment", { method: "POST", body: { postId, clientId: "ts-off2", author: "a", content: "댓글입니다" } }), env);
    eq(c.status, 201, "댓글");
    const v = await handleFetch(req("https://w/community/vote", { method: "POST", body: { ticker: "NVDA", choice: "buy", clientId: "ts-off" } }), env);
    eq(v.status, 200, "투표");
    eq(calls.length, 0, "siteverify 호출 0건");
  });
});

await test("Turnstile: 시크릿이 있으면 토큰 없는 글쓰기는 403 turnstile_required", async () => {
  const env = kvEnv({ TURNSTILE_SECRET: TS_SECRET });
  await withMockFetch(turnstileMock(true), async (calls) => {
    const r = await createPost(env, { clientId: "ts-on", content: "토큰 없는 글" });
    eq(r.status, 403, "status");
    eq((await r.json()).error, "turnstile_required", "error");
    eq(calls.length, 0, "토큰이 없으면 siteverify 도 부르지 않는다");
    eq(r.headers.get("Access-Control-Allow-Origin"), "*", "CORS 헤더");
  });
});

await test("Turnstile: 유효한 토큰이면 글·댓글·투표가 통과하고, 틀린 토큰은 403 turnstile_failed", async () => {
  const env = kvEnv({ TURNSTILE_SECRET: TS_SECRET });
  await withMockFetch(turnstileMock(true), async (calls) => {
    const created = await handleFetch(req("https://w/community", { method: "POST", headers: { "CF-Connecting-IP": "1.2.3.4" }, body: { clientId: "ts-on", content: "토큰 있는 글", author: "a", turnstileToken: "tok-ok" } }), env);
    eq(created.status, 201, "글");
    eq(new URLSearchParams(calls[0].init.body).get("remoteip"), "1.2.3.4", "remoteip 전달");
    const postId = (await created.json()).post.id;
    const c = await handleFetch(req("https://w/community/comment", { method: "POST", body: { postId, clientId: "ts-on2", author: "a", content: "댓글입니다", turnstileToken: "tok-ok" } }), env);
    eq(c.status, 201, "댓글");
    const v = await handleFetch(req("https://w/community/vote", { method: "POST", body: { ticker: "NVDA", choice: "sell", clientId: "ts-on", turnstileToken: "tok-ok" } }), env);
    eq(v.status, 200, "투표");
    const bad = await handleFetch(req("https://w/community", { method: "POST", body: { clientId: "ts-bad", content: "틀린 토큰 글", author: "a", turnstileToken: "tok-forged" } }), env);
    eq(bad.status, 403, "틀린 토큰");
    eq((await bad.json()).error, "turnstile_failed", "error");
  });
});

await test("Turnstile: siteverify 가 죽으면 통과시키지 않는다(503 turnstile_unavailable)", async () => {
  const env = kvEnv({ TURNSTILE_SECRET: TS_SECRET });
  await withMockFetch(failResp, async () => {
    const r = await handleFetch(req("https://w/community", { method: "POST", body: { clientId: "ts-down", content: "검증 서버 다운", author: "a", turnstileToken: "tok-ok" } }), env);
    eq(r.status, 503, "status");
    eq((await r.json()).error, "turnstile_unavailable", "error");
  });
});

await test("Turnstile: 읽기·공감·삭제는 시크릿이 있어도 토큰을 요구하지 않는다", async () => {
  const env = kvEnv({ TURNSTILE_SECRET: TS_SECRET });
  await withMockFetch(() => { throw new Error("network must not be called"); }, async (calls) => {
    eq((await listPosts(env, "ts-r")).status, 200, "목록");
    const like = await handleFetch(req("https://w/community/like", { method: "POST", body: { postId: "nope", clientId: "ts-r" } }), env);
    ok(like.status !== 403, "공감은 Turnstile 대상 아님");
    eq(calls.length, 0, "siteverify 미호출");
  });
});

await test("Turnstile: DO 경로에서도 엣지에서 검증하고, 통과한 본문이 DO 핸들러에 그대로 닿는다", async () => {
  const env = doEnv({ TURNSTILE_SECRET: TS_SECRET });
  await withMockFetch(turnstileMock(true), async () => {
    const denied = await createPost(env, { clientId: "ts-do", content: "DO 토큰 없음" });
    eq(denied.status, 403, "토큰 없음");
    const r = await handleFetch(req("https://w/community", { method: "POST", body: { clientId: "ts-do", content: "DO 토큰 있음", author: "a", turnstileToken: "tok-ok" } }), env);
    eq(r.status, 201, "토큰 있음");
    eq((await r.json()).post.content, "DO 토큰 있음", "본문 유지");
  });
});

function rlBinding(limit) {
  const counts = new Map();
  const keys = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      return { success: n <= limit };
    },
  };
}

await test("Rate Limiting 바인딩: RL_CLEAR 가 있으면 그 한도로 막고 KV 리밋 카운터를 쓰지 않는다", async () => {
  const binding = rlBinding(1);
  const env = kvEnv({ RL_CLEAR: binding });
  const call = () => handleFetch(req("https://w/community/clear", { method: "POST", headers: { "CF-Connecting-IP": "9.9.9.9" }, body: { clientId: "rl-a" } }), env);
  eq((await call()).status, 200, "1회차");
  eq((await call()).status, 429, "바인딩 한도 1 → 2회차 차단");
  eq(binding.keys[0], "clear:9.9.9.9", "키 = 버킷:IP");
  ok(![...env.MOVE_CACHE.map.keys()].some((k) => k.startsWith("rl:clear:")), "KV rl:clear:* 를 쓰지 않는다");
});

await test("Rate Limiting 바인딩: 없거나 호출이 실패하면 기존 KV 고정창으로 폴백한다", async () => {
  const broken = { async limit() { throw new Error("binding down"); } };
  for (const extra of [{}, { RL_CLEAR: broken }, { RL_CLEAR: { notALimiter: true } }]) {
    const env = kvEnv(extra);
    const call = () => handleFetch(req("https://w/community/clear", { method: "POST", body: { clientId: "rl-b" } }), env);
    eq((await call()).status, 200, "1회차");
    eq((await call()).status, 200, "2회차");
    eq((await call()).status, 429, "KV 한도 2 → 3회차 차단");
    ok([...env.MOVE_CACHE.map.keys()].some((k) => k.startsWith("rl:clear:")), "KV 카운터 사용");
  }
});

await test("Rate Limiting: 코드의 ipRateLimited 버킷·한도가 RATE_LIMIT_BUCKETS(문서 권장값)와 일치한다", async () => {
  const { RATE_LIMIT_BUCKETS } = await import("./yahoo-proxy.js");
  const src = readFileSync(WORKER_SRC, "utf8");
  const found = {};
  for (const m of src.matchAll(/ipRateLimited\(request, env, "([a-z_]+)", (\d+), (\d+)\)/g)) {
    eq(m[3], "60", `${m[1]} 창은 60초(바인딩 period 와 같아야 함)`);
    found[m[1]] = Number(m[2]);
  }
  deepEq(Object.keys(found).sort(), Object.keys(RATE_LIMIT_BUCKETS).sort(), "버킷 목록");
  for (const [b, n] of Object.entries(found)) eq(RATE_LIMIT_BUCKETS[b], n, `${b} 한도`);
});

function memCache() {
  const map = new Map();
  return {
    map,
    async match(r) { const hit = map.get(r.url); return hit ? hit.clone() : undefined; },
    async put(r, resp) { map.set(r.url, resp.clone()); },
  };
}
async function withMockCaches(fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, "caches");
  const prev = globalThis.caches;
  const cache = memCache();
  globalThis.caches = { default: cache };
  try { return await fn(cache); } finally {
    if (had) globalThis.caches = prev; else delete globalThis.caches;
  }
}

await test("엣지 캐시: ?fng= 신선한 응답은 저장돼 두 번째 요청이 업스트림을 부르지 않는다(HIT)", async () => {
  await withMockCaches(async (cache) => {
    await withMockFetch(() => jsonResp(cnnBody), async (calls) => {
      const env = { MOVE_CACHE: memKv() };
      const a = await handleFetch(req("https://w/?fng=1"), env);
      eq(a.headers.get("X-Mir-Edge-Cache"), "MISS", "첫 요청");
      const n = calls.length;
      ok(n > 0, "첫 요청은 업스트림 호출");
      const b = await handleFetch(req("https://w/?fng=1"), env);
      eq(b.headers.get("X-Mir-Edge-Cache"), "HIT", "두 번째 요청");
      eq(calls.length, n, "HIT 는 업스트림 미호출");
      deepEq(await b.json(), await a.json(), "같은 본문");
      eq(b.headers.get("Access-Control-Allow-Origin"), "*", "HIT 에도 CORS");
      ok(/max-age=300/.test(cache.map.get("https://mir-edge.cache/fng").headers.get("Cache-Control")), "저장본 TTL 300초");
    });
  });
});

await test("엣지 캐시: 업스트림 실패(stale/빈 값) 응답은 저장하지 않는다", async () => {
  await withMockCaches(async (cache) => {
    await withMockFetch(failResp, async () => {
      const env = { MOVE_CACHE: memKv() };
      const r = await handleFetch(req("https://w/?fx=1"), env);
      eq(r.status, 200, "status");
      eq(cache.map.size, 0, "실패 응답은 캐시에 없다");
    });
  });
});

await test("엣지 캐시: ?earnings_calendar= 는 티커 순서와 무관하게 같은 키, 빈 결과는 저장 안 함", async () => {
  await withMockCaches(async (cache) => {
    resetYahooSessionState();
    await withMockFetch(failResp, async () => {
      await handleFetch(req("https://w/?earnings_calendar=1&tickers=MSFT,AAPL"), {});
      eq(cache.map.size, 0, "빈 결과 미저장");
    });
    resetYahooSessionState();
  });
});

await test("엣지 캐시: caches 가 없는 런타임에서는 그냥 통과한다(기존 동작)", async () => {
  ok(typeof globalThis.caches === "undefined", "Node 에는 caches 가 없다");
  await withMockFetch(() => jsonResp(cnnBody), async () => {
    const r = await handleFetch(req("https://w/?fng=1"), { MOVE_CACHE: memKv() });
    eq(r.status, 200, "status");
    ok((await r.json()).fng, "fng 본문");
  });
});

// ── 데이터 라우트(2026-10-21): ?symsearch= · ?insights= · ?options= ─────────────────

await test("symsearch 파서: 트레이딩뷰는 주식·ETF 만, KRX 6자리=KR, 미국 거래소=US, 나머지는 심볼:거래소", () => {
  const tv = { symbols: [
    { symbol: "<em>PLTR</em>", description: "Palantir Technologies Inc. Class A", type: "stock", exchange: "NASDAQ", typespecs: ["common"] },
    { symbol: "BRK.B", description: "Berkshire Hathaway Inc. Class B", type: "stock", exchange: "NYSE", typespecs: ["common"] },
    { symbol: "005930", description: "Samsung Electronics Co., Ltd.", type: "stock", exchange: "KRX", typespecs: ["common"] },
    { symbol: "069500", description: "KODEX 200", type: "fund", exchange: "KRX", typespecs: ["etf"] },
    { symbol: "8P9", description: "Palantir Futures", type: "futures", exchange: "ICEEUR" },
    { symbol: "52M539", description: "Warrant", type: "warrant", exchange: "KRX" },
    { symbol: "PTX", description: "Palantir", type: "stock", exchange: "XETR", typespecs: ["common"] },
    { symbol: "IONQ", description: "IonQ", type: "stock", exchange: "BOATS", typespecs: ["common"] },
  ] };
  const rows = normalizeTradingViewSearch(tv);
  deepEq(rows.map((r) => [r.ticker, r.market, r.type]), [
    ["PLTR", "US", "stock"], ["BRK.B", "US", "stock"], ["005930", "KR", "stock"], ["069500", "KR", "etf"],
    ["PTX:XETR", "OTHER", "stock"], ["IONQ:BOATS", "OTHER", "stock"],
  ], "선물·워런트 제외, 하이라이트 태그 제거");
});

await test("symsearch 파서: 야후는 EQUITY/ETF 만, BRK-B→BRK.B, .KS/.KQ→코드+코스피/코스닥, 해외 상장·암호화폐 제외", () => {
  const yh = { quotes: [
    { symbol: "BRK-B", longname: "Berkshire Hathaway Inc.", quoteType: "EQUITY", exchange: "NYQ", exchDisp: "NYSE" },
    { symbol: "247540.KQ", shortname: "ECOPROBM", longname: "EcoPro BM Co., Ltd.", quoteType: "EQUITY", exchange: "KOE" },
    { symbol: "005930.KS", longname: "Samsung Electronics Co., Ltd.", quoteType: "EQUITY", exchange: "KSC" },
    { symbol: "PLTR.TO", longname: "Palantir CDR", quoteType: "ETF", exchange: "TOR", exchDisp: "Toronto" },
    { symbol: "SPLTR=F", shortname: "Palantir Fut", quoteType: "FUTURE", exchange: "CME" },
    { symbol: "005930-USD", shortname: "x", quoteType: "CRYPTOCURRENCY", exchange: "CCC" },
    { symbol: "IONQ-WT", longname: "IonQ WT", quoteType: "EQUITY", exchange: "NYQ" },
    { symbol: "ABCD", longname: "Foreign same-shape", quoteType: "EQUITY", exchange: "LSE" },
  ] };
  const rows = normalizeYahooSearch(yh);
  deepEq(rows.map((r) => [r.ticker, r.market, r.exchange]), [
    ["BRK.B", "US", "NYSE"], ["247540", "KR", "KOSDAQ"], ["005930", "KR", "KOSPI"], ["PLTR.TO", "OTHER", "Toronto"], ["IONQ-WT", "OTHER", "NYQ"],
  ], "미국형 심볼이라도 비미국 거래소(ABCD@LSE)는 제외");
  eq(normalizeYahooSearch(null).length, 0, "빈 응답");
});

await test("symsearch 병합: 야후 먼저, 같은 (시장, 티커)는 한 번, 최대 개수", () => {
  const merged = mergeSymbolSearch(
    [{ ticker: "005930", market: "KR", name: "Samsung", exchange: "KOSPI", type: "stock" }],
    [{ ticker: "005930", market: "KR", name: "Samsung TV", exchange: "KRX", type: "stock" }, { ticker: "005935", market: "KR", name: "Pfd", exchange: "KRX", type: "stock" }],
    2,
  );
  deepEq(merged.map((r) => `${r.ticker}:${r.exchange}`), ["005930:KOSPI", "005935:KRX"], "야후 쪽 거래소가 남는다");
  eq(sanitizeSymbolQuery("  <script>  nv\"da  "), "script nv da", "태그·따옴표 제거");
  eq(sanitizeSymbolQuery("x".repeat(80)).length, 40, "40자 상한");
});

await test("?symsearch= 라우트: 한글 질의는 야후를 부르지 않는다, 둘 다 죽으면 502, 한쪽만 죽으면 partial", async () => {
  await withMockFetch((url, init) => {
    if (url.includes("tradingview")) {
      ok(init.headers.Origin === "https://www.tradingview.com", "트레이딩뷰는 Origin 헤더가 필요하다");
      return jsonResp({ symbols: [{ symbol: "005930", description: "Samsung", type: "stock", exchange: "KRX" }] });
    }
    throw new Error("unexpected " + url);
  }, async (calls) => {
    const r = await handleFetch(req(`https://w/?symsearch=${encodeURIComponent("삼성전자")}`), {});
    const got = await r.json();
    eq(r.status, 200, "200");
    eq(got.results[0].ticker, "005930", "KR 결과");
    eq(got.partial, false, "야후를 건너뛴 건 실패가 아니다");
    ok(!calls.some((c) => c.url.includes("finance.yahoo.com")), "야후 미호출");
    eq(r.headers.get("Access-Control-Allow-Origin"), "*", "CORS");
  });
  await withMockFetch(failResp, async () => {
    const r = await handleFetch(req("https://w/?symsearch=nvda"), {});
    eq(r.status, 502, "둘 다 실패 → 502");
    ok((await r.json()).error, "{error}");
  });
  await withMockFetch((url) => (url.includes("yahoo") ? jsonResp({ quotes: [{ symbol: "NVDA", longname: "NVIDIA", quoteType: "EQUITY", exchange: "NMS", exchDisp: "NASDAQ" }] }) : failResp()), async () => {
    const r = await handleFetch(req("https://w/?symsearch=nvda"), {});
    const got = await r.json();
    eq(got.partial, true, "트레이딩뷰 실패 → partial");
    eq(got.results[0].ticker, "NVDA", "야후 결과는 나온다");
    eq(r.headers.get("Cache-Control"), "public, max-age=300", "부분 결과는 짧게 캐시");
  });
  const bad = await handleFetch(req("https://w/?symsearch="), {});
  eq(bad.status, 400, "빈 질의 400");
});

const INSIGHTS_FIXTURE = { finance: { result: { symbol: "NVDA", instrumentInfo: {
  technicalEvents: {
    shortTermOutlook: { direction: "Bearish", score: 4, stateDescription: "x" },
    intermediateTermOutlook: { direction: "Bearish", score: 3 },
    longTermOutlook: { direction: "Bullish", score: 1 },
  },
  keyTechnicals: { support: 182.7, resistance: 224.48, stopLoss: 200.56 },
  valuation: { description: "Undervalued", discount: "51%", relativeValue: "Discount" },
}, reports: [{ big: "x".repeat(1000) }] }, error: null } };
const REC_FIXTURE = { finance: { result: [{ symbol: "NVDA", recommendedSymbols: [{ symbol: "AMD", score: 0.12 }, { symbol: "BRK-B", score: 0.1 }, { symbol: "000660.KS", score: 0.05 }, { symbol: "SMSN.IL", score: 0.01 }] }], error: null } };

await test("insights 파서: 전망·지지/저항·밸류에이션·비슷한 종목만 남긴다(원문 보고서는 버린다)", () => {
  const n = normalizeInsights(INSIGHTS_FIXTURE, REC_FIXTURE, "NVDA");
  deepEq(n.outlook, { short: { direction: "bearish", score: 4 }, mid: { direction: "bearish", score: 3 }, long: { direction: "bullish", score: 1 } }, "outlook");
  deepEq(n.levels, { support: 182.7, resistance: 224.48, stopLoss: 200.56 }, "levels");
  deepEq(n.valuation, { verdict: "under", discount: "51%" }, "valuation");
  deepEq(n.similar.map((s) => `${s.market}:${s.ticker}`), ["US:AMD", "US:BRK.B", "KR:000660", "OTHER:SMSN.IL"], "similar 시장 판정");
  ok(!JSON.stringify(n).includes("xxxx"), "reports 원문 제외");
  // 국내: 야후 insights 에 기술 지표가 없다 → 전부 null, 비슷한 종목만.
  const kr = normalizeInsights({ finance: { result: { symbol: "005930.KS", sigDevs: [] } } }, { finance: { result: [{ recommendedSymbols: [{ symbol: "000660.KS", score: 0.19 }] }] } }, "005930.KS");
  eq(kr.outlook, null, "KR outlook null");
  eq(kr.levels, null, "KR levels null");
  eq(kr.valuation, null, "KR valuation null");
  eq(kr.similar[0].ticker, "000660", "KR similar");
  const junk = normalizeInsights({ finance: { result: { instrumentInfo: { keyTechnicals: { support: "abc" }, valuation: { description: "<b>hi</b>" }, technicalEvents: { shortTermOutlook: { direction: "Up" } } } } } }, null, "X");
  eq(junk.levels, null, "숫자 아닌 지지선 무시");
  eq(junk.valuation, null, "모르는 판정 무시");
  eq(junk.outlook, null, "모르는 방향 무시");
  deepEq(junk.similar, [], "추천 실패 → 빈 배열");
});

await test("?insights= 라우트: 둘 다 실패면 502, 한쪽만 되면 partial 200", async () => {
  await withMockFetch((url) => {
    if (url.includes("ws/insights")) { ok(url.includes("symbol=BRK-B"), "BRK.B → BRK-B"); return jsonResp(INSIGHTS_FIXTURE); }
    if (url.includes("recommendationsbysymbol/BRK-B")) return jsonResp(REC_FIXTURE);
    throw new Error("unexpected " + url);
  }, async () => {
    const r = await handleFetch(req("https://w/?insights=BRK.B"), {});
    const got = await r.json();
    eq(r.status, 200, "200");
    eq(got.partial, false, "full");
    eq(got.levels.support, 182.7, "support");
  });
  await withMockFetch((url) => (url.includes("recommendations") ? jsonResp(REC_FIXTURE) : jsonResp({}, 500)), async () => {
    const got = await (await handleFetch(req("https://w/?insights=NVDA"), {})).json();
    eq(got.partial, true, "insights 실패 → partial");
    eq(got.levels, null, "levels null");
    eq(got.similar.length, 4, "similar 는 있다");
  });
  await withMockFetch(failResp, async () => {
    eq((await handleFetch(req("https://w/?insights=NVDA"), {})).status, 502, "502");
  });
  eq((await handleFetch(req("https://w/?insights=%20"), {})).status, 400, "빈 심볼 400");
});

// 옵션 체인 최소형: 행사가 90·100·110, 현재가 101.
function optRow(strike, { oi = 0, vol = 0, bid = 0, ask = 0, last = null, iv = 0.00001 } = {}) {
  return { strike, openInterest: oi, volume: vol, bid, ask, lastPrice: last, impliedVolatility: iv };
}
const EXP1 = 1792540800; // 2026-10-21
const EXP2 = 1792713600; // 2026-10-23
function optChain(expTs, { live = true } = {}) {
  const q = live ? { bid: 1.9, ask: 2.1, iv: 0.42 } : { bid: 0, ask: 0, iv: 0.0156 };
  return { optionChain: { result: [{
    underlyingSymbol: "TEST", expirationDates: [EXP1, EXP2], strikes: [90, 100, 110],
    quote: { regularMarketPrice: 101, currency: "USD" },
    options: [{ expirationDate: expTs, calls: [
      optRow(90, { oi: live ? 100 : 0, vol: 10, last: 11 }),
      optRow(100, { oi: live ? 500 : 0, vol: 300, bid: q.bid, ask: q.ask, last: 2.5, iv: q.iv }),
      optRow(110, { oi: live ? 900 : 0, vol: 50, last: 0.2 }),
    ], puts: [
      optRow(90, { oi: live ? 800 : 0, vol: 40, last: 0.1 }),
      optRow(100, { oi: live ? 400 : 0, vol: 200, bid: q.bid, ask: q.ask, last: 1.5, iv: q.iv }),
      optRow(110, { oi: live ? 50 : 0, vol: 5, last: 9 }),
    ] }],
  }] } };
}

await test("옵션 파서: P/C·맥스페인·ATM IV·예상 변동폭·행사가별 OI 상위", () => {
  const nowMs = Date.UTC(2026, 9, 20, 12);
  const s = summarizeOptionExpiry(optChain(EXP1).optionChain.result[0].options[0], 101, nowMs);
  eq(s.expiry, "2026-10-21", "만기");
  eq(s.daysToExpiry, 1, "D-1");
  eq(s.callOI, 1500, "콜 OI");
  eq(s.putOI, 1250, "풋 OI");
  eq(s.putCallOI, 0.83, "풋/콜 OI");
  eq(s.putCallVolume, 0.68, "풋/콜 거래량 245/360");
  // 지급액: S=90 → 풋 10*400+20*50=5000 / S=100 → 콜 10*100 + 풋 10*50 = 1500 / S=110 → 콜 20*100+10*500 = 7000
  eq(s.maxPain, 100, "맥스페인");
  eq(optionMaxPain([{ strike: 1, oi: 1 }], [{ strike: 2, oi: 1 }]), null, "행사가 3개 미만 → null");
  eq(s.atmStrike, 100, "ATM");
  eq(s.atmIV, 42, "ATM IV %");
  eq(s.straddle, 4, "스트래들 = 콜 mid 2 + 풋 mid 2");
  eq(s.expectedMovePct, 4, "4/101 = 3.96% → 4.0");
  deepEq(s.topOI.map((r) => r.strike), [110, 90, 100], "OI 합 상위(950·900·900, 같은 합은 입력 순)");
});

await test("옵션 파서: 장외(호가 0·OI 0)에는 OI 기반 값과 IV 를 내지 않는다 — 0 으로 만든 맥스페인 금지", () => {
  const s = summarizeOptionExpiry(optChain(EXP1, { live: false }).optionChain.result[0].options[0], 101, Date.UTC(2026, 9, 20));
  eq(s.callOI, null, "callOI null");
  eq(s.putCallOI, null, "P/C OI null");
  eq(s.maxPain, null, "맥스페인 null");
  deepEq(s.topOI, [], "OI 상위 없음");
  eq(s.atmIV, null, "자리표시 IV(0.0156) 무시");
  eq(s.putCallVolume, 0.68, "거래량(직전 세션)은 그대로");
  eq(s.straddle, 4, "스트래들은 직전 체결가(2.5+1.5)");
});

await test("옵션 체인 정규화: 두 만기, 만기 없음 → null", () => {
  const n = normalizeOptionsChain(optChain(EXP1), optChain(EXP2), "TEST", Date.UTC(2026, 9, 20));
  deepEq(n.expiries.map((e) => e.expiry), ["2026-10-21", "2026-10-23"], "가장 가까운 만기 + 다음 만기");
  eq(n.price, 101, "현재가");
  eq(n.expirationCount, 2, "만기 수");
  eq(normalizeOptionsChain(optChain(EXP1), optChain(EXP1), "TEST").expiries.length, 1, "같은 만기 중복 제거");
  eq(normalizeOptionsChain({ optionChain: { result: [{ expirationDates: [], options: [] }] } }, null, "005930.KS"), null, "국내(만기 없음) → null");
});

await test("?options= 라우트: crumb 은 Accept */* 로 받는다(json 이면 406), 세션 없으면 503, 만기 없으면 404", async () => {
  resetYahooSessionState();
  await withMockFetch((url, init) => {
    if (url.startsWith("https://fc.yahoo.com")) return new Response("", { status: 404, headers: { "Set-Cookie": "A3=abc; Path=/" } });
    if (url.includes("getcrumb")) {
      const accept = String((init.headers || {}).Accept || "");
      if (accept.includes("application/json")) return new Response('{"finance":{"error":{"code":"Not Acceptable"}}}', { status: 406 });
      return new Response("CRUMB123", { status: 200 });
    }
    if (url.includes("/v7/finance/options/TEST")) {
      ok(url.includes("crumb=CRUMB123"), "crumb 부착");
      return jsonResp(url.includes(`date=${EXP2}`) ? optChain(EXP2) : optChain(EXP1));
    }
    if (url.includes("/v7/finance/options/005930.KS")) return jsonResp({ optionChain: { result: [{ expirationDates: [], options: [] }] } });
    throw new Error("unexpected " + url);
  }, async () => {
    const r = await handleFetch(req("https://w/?options=TEST"), {});
    eq(r.status, 200, "200");
    const got = await r.json();
    eq(got.expiries.length, 2, "두 만기");
    eq(got.expiries[0].maxPain, 100, "맥스페인");
    const kr = await handleFetch(req("https://w/?options=005930.KS"), {});
    eq(kr.status, 404, "만기 없음 404");
    eq((await kr.json()).error, "no_options", "no_options");
  });
  resetYahooSessionState();
  await withMockFetch(() => new Response("", { status: 403 }), async () => {
    const r = await handleFetch(req("https://w/?options=TEST"), {});
    eq(r.status, 503, "세션 없음 503");
    eq((await r.json()).error, "no_session", "no_session");
  });
  resetYahooSessionState();
  eq(crumbHeaders("A3=1").Accept, "*/*", "crumbHeaders");
  eq(routeSymbol("brk.b"), "BRK-B", "routeSymbol 미국");
  eq(routeSymbol("005930.ks"), "005930.KS", "routeSymbol 국내");
});

await test("옛 워커 호환 감지 전제: 모르는 경로는 여전히 404 not_found + no-store", async () => {
  const r = await handleFetch(req("https://w/?unknownroute=1"), {});
  eq(r.status, 404, "404");
  eq((await r.json()).error, "not_found", "not_found");
});

// ── 주가 움직임 이유(?move_reasons=) ─────────────────────────────────────────

console.log("\n[move_reasons] 소셜 파싱·주장 검증");

await test("Stocktwits·네이버·레딧 파싱 — 오래된 글·짧은 글·캐시태그 도배는 뺀다", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const st = parseStocktwitsStream({ messages: [
    { id: 1, body: "NVDA up on reports of a new hyperscaler order", created_at: "2026-10-22T10:00:00Z", likes: { total: 5 }, user: { username: "a" } },
    { id: 2, body: "$A $B $C $D $E to the moon", created_at: "2026-10-22T10:00:00Z", user: { username: "b" } },
    { id: 3, body: "an old post about something that happened", created_at: "2026-10-18T10:00:00Z", user: { username: "c" } },
    { id: 4, body: "short", created_at: "2026-10-22T10:00:00Z" },
  ] }, now);
  eq(st.length, 1, "Stocktwits 1건");
  eq(st[0].url, "https://stocktwits.com/a/message/1", "Stocktwits 링크");
  const nv = parseNaverDiscussion({ result: { posts: [
    { id: "9", title: "수주 공시 나왔네요", contentSwReplacedButImg: "대형 계약", writtenAt: "2026-10-22T16:00:00", recommendCount: 3 },
    { id: "10", title: "ㅋㅋ", contentSwReplacedButImg: "" },
  ] } }, "005930");
  eq(nv.length, 1, "네이버 1건");
  eq(nv[0].url, "https://m.stock.naver.com/domestic/stock/005930/discussion/9", "네이버 링크");
  const rd = parseRedditListing({ data: { children: [{ data: { title: "Why is NVDA up?", selftext: "earnings beat", created_utc: now / 1000 - 3600, score: 12, permalink: "/r/stocks/x", subreddit: "stocks" } }] } }, now);
  eq(rd.length, 1, "레딧 1건");
  eq(rd[0].source, "Reddit r/stocks", "레딧 출처");
});

await test("주장 검증 — 인용 번호·숫자 확인, 뉴스 확인/소셜 의견/뉴스만 분류", () => {
  const posts = [{ text: "hyperscaler order 5 billion rumor", source: "Stocktwits", url: "u1" }, { text: "big order news", source: "Stocktwits", url: "u2" }];
  const news = [{ title: "NVDA wins $5 billion order from cloud giant", link: "n1", publisher: "Reuters" }, { title: "Chip stocks rally", link: "n2" }];
  const out = validateMoveReasons({ claims: [
    { claim: "클라우드 업체로부터 50억 달러 규모 수주 소식", social: ["S1", "S2"], news: ["N1"] },   // 50 은 원문에 없음 → 버림
    { claim: "클라우드 업체로부터 5 billion 수주 소식", social: ["S1", "s2"], news: ["N1", "N9"] },   // N9 없음 → 무시
    { claim: "공매도 세력이 숏커버링 중이라는 소문", social: ["S2"], news: [] },
    { claim: "반도체 업종 전반이 동반 강세", social: [], news: ["N2"] },
    { claim: "근거 없는 주장입니다", social: ["S7"], news: [] },                                      // S7 없음 → 인용 없음
    "junk",
  ] }, posts, news);
  eq(out.confirmed.length, 1, "뉴스 확인 1");
  eq(out.confirmed[0].news.length, 1, "실제 기사만");
  eq(out.confirmed[0].socialCount, 2, "소셜 글 수");
  eq(out.socialOnly.length, 1, "소셜 의견 1");
  eq(out.newsOnly.length, 1, "뉴스만 1");
  eq(validateMoveReasons(null, posts, news).confirmed.length, 0, "깨진 출력");
});

await test("움직임 자체·시장 잡담은 이유가 아니다(2026-10-22 라이브 첫 결과)", () => {
  const names = ["NVDA", "NVIDIA", "삼성전자", "005930"];
  for (const c of ["NVDA 주가 상승", "삼성전자 주가가 내렸다", "코스피 바닥을 찍었다", "NVIDIA stock rally"]) ok(isMoveOnlyClaim(c, names), `거름: ${c}`);
  for (const c of ["삼성전자 노조, 반도체 성과급 재조정 추진", "NVIDIA와 노키아의 파트너십 확대", "3분기 실적 발표"]) ok(!isMoveOnlyClaim(c, names), `남김: ${c}`);
  const out = validateMoveReasons({ claims: [{ claim: "NVDA 주가 상승", social: ["S1"], news: ["N1"] }] },
    [{ text: "up today" }], [{ title: "NVDA shares rise" }], names);
  eq(out.confirmed.length, 0, "움직임만 말하는 주장은 확인 목록에 없다");
});

await test("예측은 이유가 아니고, 뉴스만 있는 이유는 그 종목 기사여야 한다", () => {
  for (const c of ["테슬라의 주가가 오를 수 있다", "실적이 좋지 않아 떨어질 수 있다", "영업이익률이 80%를 넘을 수 있다", "내년 성장 전망", "Shares could rise"]) ok(isSpeculativeClaim(c), `예측: ${c}`);
  for (const c of ["엘론 머스크가 로봇 시연에 성공했다", "대형 펀드가 숏을 정리한다는 소문", "노조 성과급 재조정 추진"]) ok(!isSpeculativeClaim(c), `사실: ${c}`);
  ok(newsMentions([{ title: "삼성전자 노조, 성과급 재조정" }], ["삼성전자", "005930"]), "종목 기사");
  ok(!newsMentions([{ title: "가계부채가 경제에 제약" }], ["삼성전자", "005930"]), "거시 기사");
  const out = validateMoveReasons({ claims: [
    { claim: "가계부채가 경제에 제약 요인이다", social: [], news: ["N1"] },
    { claim: "노조가 성과급 재조정을 추진했다", social: [], news: ["N2"] },
  ] }, [], [{ title: "가계부채, 경제 제약 요인" }, { title: "삼성전자 노조, 성과급 재조정 추진" }], ["삼성전자"]);
  eq(out.newsOnly.length, 1, "종목 기사만 남는다");
});

await test("move_reasons — Origin 게이트, 옛 워커 감지용 경로", async () => {
  const r = await handleFetch(req("https://w/?move_reasons=NVDA"), {});
  eq(r.status, 403, "Origin 없으면 403");
});

// ── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${failures.length ? "FAILED" : "OK"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`\n${f.name}\n${(f.err && f.err.stack) || f.err}`);
  process.exit(1);
}
