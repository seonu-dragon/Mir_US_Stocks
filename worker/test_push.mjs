// =============================================================================
// worker/mir-push.js 자체 검증 — 네트워크 없이 도는 순수 Node 테스트(Node 18+)
//
//   node worker/test_push.mjs
//
// 다루는 것:
//   · RFC 8291 부록 A 테스트 벡터 — 고정 salt·송신 키로 암호화한 바디가 RFC 의 바이트와 같은지
//   · 그 바디를 수신자 개인키로 복호화해 평문이 돌아오는지(임의 키·salt 경로)
//   · VAPID JWT(RFC 8292): 헤더·클레임 모양, 공개키로 ES256 서명 검증
//   · 라우트: Origin 게이트, 구독 검증(알려진 푸시 서비스만), 저장·갱신·해지, 테스트 발송 1분 쿨다운, 410 정리
//   · 크론: 장중 ±N% 알림 → 푸시 1건(여러 조건은 한 알림), 같은 거래일 중복 없음, 하루 상한,
//     410 이면 구독 삭제, 요약(07:30 KST)은 my-digest-core 로 만든 본문, 동기화 목록 자동 사용
// env 는 인메모리 모의(KV = Map). fetch 는 주입한 가짜(야후 spark·Pages 데이터·푸시 서비스).
// =============================================================================
import { webcrypto } from "node:crypto";
import {
  b64urlDecode,
  b64urlEncode,
  createVapidJwt,
  encryptPayload,
  handleFetch,
  hkdf,
  importVapidPrivateKey,
  resetSoftRateLimit,
  runCron,
  subscriptionId,
  validSubscription,
} from "./mir-push.js";

const subtle = (globalThis.crypto || webcrypto).subtle;
let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL  ${name}\n        ${(err && err.stack) || err}`);
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "값이 다름"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || "거짓"); }

// ---------------------------------------------------------------------------
// RFC 8291 부록 A
// ---------------------------------------------------------------------------
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  ecdhSecret: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

function jwkFor(pubB64, dB64) {
  const pub = b64urlDecode(pubB64);
  const jwk = { kty: "EC", crv: "P-256", x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), ext: true };
  if (dB64) jwk.d = dB64;
  return jwk;
}

/** 수신자(브라우저) 쪽 복호화 — 테스트 전용 참조 구현. */
async function decryptBody(body, uaPublicB64, uaPrivateB64, authB64) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16, false);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const uaPriv = await subtle.importKey("jwk", jwkFor(uaPublicB64, uaPrivateB64), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const asKey = await subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, uaPriv, 256));
  const enc = new TextEncoder();
  const uaPublic = b64urlDecode(uaPublicB64);
  const keyInfo = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(b64urlDecode(authB64), secret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end -= 1;
  if (plain[end] !== 2) throw new Error("패딩 구분자 0x02 없음");
  return { rs, text: new TextDecoder().decode(plain.slice(0, end)), secret, ikm, cek, nonce };
}

await test("RFC 8291 부록 A: 고정 salt·송신 키로 만든 바디가 RFC 와 바이트 단위로 같다", async () => {
  const body = await encryptPayload(RFC.plaintext, RFC.uaPublic, RFC.auth, { salt: RFC.salt, asPrivate: RFC.asPrivate, asPublic: RFC.asPublic });
  eq(b64urlEncode(body), RFC.body, "암호문 바디");
  eq(body.length, 144, "길이(헤더 86 + 암호문 58)");
});

await test("RFC 8291 부록 A: 중간값(ECDH·IKM·CEK·NONCE)이 RFC 와 같다(수신자 쪽 복호화로 검산)", async () => {
  const r = await decryptBody(b64urlDecode(RFC.body), RFC.uaPublic, RFC.uaPrivate, RFC.auth);
  eq(r.text, RFC.plaintext, "평문");
  eq(r.rs, 4096, "레코드 크기");
  eq(b64urlEncode(r.secret), RFC.ecdhSecret, "ecdh_secret");
  eq(b64urlEncode(r.ikm), RFC.ikm, "IKM");
  eq(b64urlEncode(r.cek), RFC.cek, "CEK");
  eq(b64urlEncode(r.nonce), RFC.nonce, "NONCE");
});

await test("실사용 경로(매번 새 임시 키·salt)도 수신자가 복호화할 수 있고, 두 번 암호화하면 결과가 다르다", async () => {
  const msg = JSON.stringify({ title: "한글 제목", body: "NVDA +6.2%\n둘째 줄" });
  const a = await encryptPayload(msg, RFC.uaPublic, RFC.auth);
  const b = await encryptPayload(msg, RFC.uaPublic, RFC.auth);
  ok(b64urlEncode(a) !== b64urlEncode(b), "무작위성");
  eq((await decryptBody(a, RFC.uaPublic, RFC.uaPrivate, RFC.auth)).text, msg);
});

await test("잘못된 구독 키는 거부한다", async () => {
  let threw = 0;
  for (const [p, a] of [["AAAA", RFC.auth], [RFC.uaPublic, "AAAA"]]) {
    try { await encryptPayload("x", p, a); } catch { threw += 1; }
  }
  eq(threw, 2);
});

// ---------------------------------------------------------------------------
// VAPID
// ---------------------------------------------------------------------------
async function newVapid() {
  const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  const jwk = await subtle.exportKey("jwk", pair.privateKey);
  return { pub: b64urlEncode(raw), priv: jwk.d, verifyKey: pair.publicKey };
}

await test("VAPID JWT: ES256 헤더·aud/exp/sub 클레임·공개키로 서명 검증", async () => {
  const v = await newVapid();
  const key = await importVapidPrivateKey(v.pub, v.priv);
  const now = 1790000000;
  const jwt = await createVapidJwt("https://fcm.googleapis.com", "mailto:me@example.com", key, now);
  const [h, c, s] = jwt.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
  eq(header.alg, "ES256");
  eq(header.typ, "JWT");
  eq(claims.aud, "https://fcm.googleapis.com");
  eq(claims.sub, "mailto:me@example.com");
  eq(claims.exp, now + 12 * 3600, "exp 12시간(RFC 8292 상한 24시간 이내)");
  const sig = b64urlDecode(s);
  eq(sig.length, 64, "JWS ES256 서명은 r||s 64바이트");
  const valid = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, v.verifyKey, sig, new TextEncoder().encode(`${h}.${c}`));
  ok(valid, "서명 검증 실패");
});

// ---------------------------------------------------------------------------
// 모의 env · 가짜 fetch
// ---------------------------------------------------------------------------
function memKv(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    map: m,
    async get(k, type) { const v = m.has(k) ? m.get(k) : null; return type === "json" && v ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  };
}

async function uaSubscription(host = "fcm.googleapis.com", tag = "a") {
  return { endpoint: `https://${host}/fcm/send/${tag}-token`, keys: { p256dh: RFC.uaPublic, auth: RFC.auth } };
}

async function makeEnv(extra = {}) {
  const v = await newVapid();
  return { PUSH_KV: memKv(), VAPID_PUBLIC_KEY: v.pub, VAPID_PRIVATE_KEY: v.priv, VAPID_SUBJECT: "mailto:t@example.com", ...extra };
}

function req(path, body, origin = "https://seonu-dragon.github.io", method = "POST") {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  return new Request(`https://mir-push.example.workers.dev${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

function sparkPayload(rows) {
  return {
    spark: {
      result: rows.map(([symbol, price, prev, timeSec, off = -14400]) => ({
        symbol,
        response: [{ meta: { symbol, regularMarketPrice: price, chartPreviousClose: prev, regularMarketTime: timeSec, gmtoffset: off, shortName: symbol } }],
      })),
    },
  };
}

/** 가짜 인터넷: 야후 spark, Pages data, 푸시 서비스(상태 코드 지정). 보낸 푸시는 sent 에 쌓인다. */
function fakeFetch({ spark = {}, data = {}, pushStatus = () => 201 } = {}) {
  const sent = [];
  const calls = [];
  const impl = async (url, init = {}) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("/v7/finance/spark")) {
      const syms = decodeURIComponent(u.split("symbols=")[1].split("&")[0]).split(",");
      return new Response(JSON.stringify(sparkPayload(syms.filter((s) => spark[s]).map((s) => [s, ...spark[s]]))), { status: 200 });
    }
    if (u.startsWith("https://seonu-dragon.github.io/")) {
      const key = u.split("/data/")[1];
      return data[key] ? new Response(JSON.stringify(data[key]), { status: 200 }) : new Response("nf", { status: 404 });
    }
    if (init.method === "POST") {
      sent.push({ url: u, headers: init.headers, body: init.body });
      return new Response("", { status: pushStatus(u) });
    }
    return new Response("nf", { status: 404 });
  };
  return { impl, sent, calls };
}

async function openPush(sentItem) {
  return JSON.parse((await decryptBody(sentItem.body, RFC.uaPublic, RFC.uaPrivate, RFC.auth)).text);
}

// ---------------------------------------------------------------------------
// 라우트
// ---------------------------------------------------------------------------
await test("구독 검증: 알려진 푸시 서비스 https 만, 키 길이 확인", async () => {
  ok(validSubscription(await uaSubscription()));
  ok(validSubscription(await uaSubscription("web.push.apple.com")));
  ok(validSubscription(await uaSubscription("updates.push.services.mozilla.com")));
  ok(!validSubscription(await uaSubscription("evil.example.com")), "임의 호스트");
  ok(!validSubscription({ endpoint: "http://fcm.googleapis.com/x", keys: { p256dh: RFC.uaPublic, auth: RFC.auth } }), "http");
  ok(!validSubscription({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: RFC.uaPublic, auth: "AAAA" } }), "auth 길이");
});

await test("라우트: Origin 없는/남의 사이트 요청 403, 키 미설정 503, 모르는 경로 404", async () => {
  resetSoftRateLimit();
  const env = await makeEnv();
  const sub = await uaSubscription();
  eq((await handleFetch(req("/push/subscribe", { subscription: sub }, ""), env)).status, 403);
  eq((await handleFetch(req("/push/subscribe", { subscription: sub }, "https://evil.example"), env)).status, 403);
  eq((await handleFetch(req("/push/subscribe", { subscription: sub }), { PUSH_KV: memKv() })).status, 503);
  eq((await handleFetch(req("/nope", null, "https://seonu-dragon.github.io", "GET"), env)).status, 404);
  const health = await (await handleFetch(req("/push/health", null, "", "GET"), env)).json();
  eq(health.configured, true);
  eq(health.vapidPublicKey, env.VAPID_PUBLIC_KEY);
  const pre = await handleFetch(new Request("https://x/push/subscribe", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:8123" } }), env);
  eq(pre.status, 204);
  eq(pre.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:8123");
});

await test("구독 저장 → prefs 갱신 → 해지. 동기화 clientId 는 useSync 일 때만 보관", async () => {
  resetSoftRateLimit();
  const env = await makeEnv();
  const sub = await uaSubscription();
  const id = await subscriptionId(sub.endpoint);
  const r1 = await handleFetch(req("/push/subscribe", {
    subscription: sub,
    prefs: { movePct: 99, maxPerDay: 50, kinds: { digest: true } },
    lists: { us: { watch: ["nvda", "005930"], hold: [{ t: "AAPL", q: 3 }] }, kr: { watch: ["005930"] }, names: { "005930": "삼성전자" } },
    syncClientId: "c-abc123xyz",
  }), env);
  eq(r1.status, 200);
  const rec = JSON.parse(env.PUSH_KV.map.get(`sub:${id}`));
  eq(rec.prefs.movePct, 30, "±N% 상한 30");
  eq(rec.prefs.maxPerDay, 12, "하루 상한의 상한 12");
  eq(rec.syncClientId, "", "useSync 꺼져 있으면 clientId 안 남김");
  eq(rec.lists.us.watch.join(","), "NVDA", "국내 코드는 us 목록에서 빠진다");
  eq(rec.lists.kr.watch.join(","), "005930");
  const r2 = await handleFetch(req("/push/prefs", { endpoint: sub.endpoint, prefs: { useSync: true }, syncClientId: "c-abc123xyz" }), env);
  eq(r2.status, 200);
  eq(JSON.parse(env.PUSH_KV.map.get(`sub:${id}`)).syncClientId, "c-abc123xyz");
  eq((await handleFetch(req("/push/prefs", { endpoint: "https://fcm.googleapis.com/fcm/send/other" }), env)).status, 404);
  eq((await handleFetch(req("/push/unsubscribe", { endpoint: sub.endpoint }), env)).status, 200);
  ok(!env.PUSH_KV.map.has(`sub:${id}`), "해지 후 삭제");
});

await test("테스트 발송: 암호화 바디·VAPID 헤더, 1분 쿨다운, 410 이면 구독 삭제", async () => {
  resetSoftRateLimit();
  const env = await makeEnv();
  const sub = await uaSubscription();
  await handleFetch(req("/push/subscribe", { subscription: sub }), env);
  const f = fakeFetch();
  const now = 1790000000000;
  const r = await handleFetch(req("/push/test", { endpoint: sub.endpoint }), env, { fetchImpl: f.impl, nowMs: now });
  eq(r.status, 200);
  eq(f.sent.length, 1);
  const h = f.sent[0].headers;
  eq(h["Content-Encoding"], "aes128gcm");
  ok(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(h.Authorization), "Authorization vapid");
  eq((await openPush(f.sent[0])).title, "Mir 알림 테스트");
  eq((await handleFetch(req("/push/test", { endpoint: sub.endpoint }), env, { fetchImpl: f.impl, nowMs: now + 10000 })).status, 429);
  const gone = fakeFetch({ pushStatus: () => 410 });
  eq((await handleFetch(req("/push/test", { endpoint: sub.endpoint }), env, { fetchImpl: gone.impl, nowMs: now + 120000 })).status, 410);
  eq(env.PUSH_KV.map.size, 0, "410 구독 정리");
});

// ---------------------------------------------------------------------------
// 크론
// ---------------------------------------------------------------------------
// 2026-09-28(월) 14:00 UTC = ET 10:00(서머타임) 장중 · KST 23:00
const US_OPEN = Date.UTC(2026, 8, 28, 14, 0);
const US_TIME = Math.floor(US_OPEN / 1000) - 600;

async function seed(env, subOverrides = {}, tag = "a") {
  const sub = await uaSubscription("fcm.googleapis.com", tag);
  resetSoftRateLimit();
  await handleFetch(req("/push/subscribe", {
    subscription: sub,
    prefs: { movePct: 5, maxPerDay: 6, ...subOverrides.prefs },
    lists: { us: { watch: ["NVDA", "KO"], hold: [{ t: "AAPL", q: 10 }] }, levels: [{ t: "AAPL", price: 250, dir: "above", src: "thesis" }], ...subOverrides.lists },
    syncClientId: subOverrides.syncClientId,
  }), env, { nowMs: US_OPEN - 86400000 });
  return sub;
}

await test("크론(미 장중): ±5% 두 종목 + 목표가 → 푸시 1건 여러 줄, 같은 거래일 재실행은 조용", async () => {
  const env = await makeEnv();
  await seed(env);
  const f = fakeFetch({ spark: { NVDA: [110, 100, US_TIME], KO: [60, 63.5, US_TIME], AAPL: [251, 249, US_TIME] } });
  const s = await runCron(env, US_OPEN, { fetchImpl: f.impl });
  ok(s.jobs.includes("priceUs"), `jobs=${s.jobs}`);
  eq(s.sent, 1);
  const msg = await openPush(f.sent[0]);
  ok(/3건/.test(msg.title), msg.title);
  ok(msg.body.includes("NVDA +10.0%"), msg.body);
  ok(msg.body.includes("KO -5.5%"), msg.body);
  ok(msg.body.includes("목표가 $250.00 도달"), msg.body);
  ok(msg.body.includes("추천 아님"), "사실 알림 문구");
  eq(msg.url, "./index.html?tab=bulk&market=us");
  const f2 = fakeFetch({ spark: { NVDA: [111, 100, US_TIME], KO: [60, 63.5, US_TIME], AAPL: [252, 249, US_TIME] } });
  eq((await runCron(env, US_OPEN + 1800000, { fetchImpl: f2.impl })).sent, 0, "중복 방지");
  ok(f.calls.some((u) => u.includes("symbols=NVDA,KO,AAPL") || u.includes("symbols=")), "spark 배치");
});

await test("크론: 하루 상한에 걸리면 보내지 않고 기록만(다음 날 몰려오지 않음), 오래된 시세는 무시", async () => {
  const env = await makeEnv();
  await seed(env, { prefs: { maxPerDay: 1 } });
  const f = fakeFetch({ spark: { NVDA: [110, 100, US_TIME], KO: [63, 63.5, US_TIME], AAPL: [200, 199, US_TIME] } });
  eq((await runCron(env, US_OPEN, { fetchImpl: f.impl })).sent, 1);
  const f2 = fakeFetch({ spark: { NVDA: [110, 100, US_TIME], KO: [59, 63.5, US_TIME], AAPL: [200, 199, US_TIME] } });
  const s2 = await runCron(env, US_OPEN + 1800000, { fetchImpl: f2.impl });
  eq(s2.sent, 0);
  eq(s2.suppressed, 1);
  const stale = fakeFetch({ spark: { NVDA: [150, 100, US_TIME - 3 * 86400] } });
  const env2 = await makeEnv();
  await seed(env2);
  eq((await runCron(env2, US_OPEN, { fetchImpl: stale.impl })).sent, 0, "사흘 묵은 시세");
});

await test("크론: 푸시 서비스가 410 이면 구독 삭제, 5xx 는 기록 안 하고 다음에 다시", async () => {
  const env = await makeEnv();
  await seed(env);
  const f = fakeFetch({ spark: { NVDA: [110, 100, US_TIME] }, pushStatus: () => 503 });
  const s = await runCron(env, US_OPEN, { fetchImpl: f.impl });
  eq(s.failed, 1);
  const f2 = fakeFetch({ spark: { NVDA: [110, 100, US_TIME] }, pushStatus: () => 410 });
  const s2 = await runCron(env, US_OPEN + 1800000, { fetchImpl: f2.impl });
  eq(s2.gone, 1, "503 뒤 재시도 → 410");
  eq([...env.PUSH_KV.map.keys()].filter((k) => k.startsWith("sub:")).length, 0);
});

await test("크론: 실행당 발송 예산을 넘으면 멈추고 커서가 다음 구독부터 잇는다", async () => {
  const env = await makeEnv({ PUSH_MAX_PER_RUN: "1" });
  await seed(env, {}, "a");
  await seed(env, {}, "b");
  const spark = { NVDA: [110, 100, US_TIME] };
  const s1 = await runCron(env, US_OPEN, { fetchImpl: fakeFetch({ spark }).impl });
  eq(s1.sent, 1);
  const s2 = await runCron(env, US_OPEN + 1800000, { fetchImpl: fakeFetch({ spark }).impl });
  eq(s2.sent, 1, "두 번째 구독이 다음 실행에서 받는다");
  const s3 = await runCron(env, US_OPEN + 3600000, { fetchImpl: fakeFetch({ spark }).impl });
  eq(s3.sent, 0, "둘 다 받았으면 끝");
});

await test("크론(07:30 KST): 요약은 my-digest-core 본문 + 실적 D-1, 동기화 목록 자동 사용", async () => {
  // 2026-09-29(화) 07:30 KST = 09-28 22:30 UTC
  const now = Date.UTC(2026, 8, 28, 22, 30);
  const closeSec = Math.floor(Date.UTC(2026, 8, 28, 20, 0) / 1000);
  const syncKv = memKv({
    "sync:prefs:c-sync12345": JSON.stringify({
      watchlistUs: ["MSFT"], watchlistKr: [], portfolio: [{ ticker: "NVDA", qty: 5 }],
      theses: { items: [{ ticker: "MSFT", status: "open", target: 999 }] },
    }),
  });
  const env = await makeEnv({ SYNC_KV: syncKv });
  await seed(env, { prefs: { kinds: { digest: true }, digestMarkets: ["us"], useSync: true }, syncClientId: "c-sync12345" });
  const f = fakeFetch({
    spark: { NVDA: [110, 100, closeSec], MSFT: [400, 404, closeSec], SPY: [500, 498, closeSec] },
    data: {
      "us_calendar.json": { stocks: { MSFT: { nextEarnings: "2026-09-30" } } },
      "material_events.json": { events: [{ ticker: "NVDA", fileDate: "2026-09-28", items: [{ code: "8.01", label: "기타 중요 사건" }], link: "https://sec.gov/x" }] },
      "earnings_releases.json": { releases: [] },
      "movers_reasons.json": { market: "us", tradeDate: "2026-09-25", up: [], down: [] },
    },
  });
  const s = await runCron(env, now, { fetchImpl: f.impl });
  ok(s.jobs.includes("digestUs") && s.jobs.includes("earningsD1"), `jobs=${s.jobs}`);
  eq(s.sent, 2, "요약 1 + 알림 1");
  const msgs = await Promise.all(f.sent.map(openPush));
  const digest = msgs.find((m) => m.tag === "mir-digest-us");
  ok(digest, "요약 알림");
  if (process.env.SHOW_PUSH) console.log(JSON.stringify(msgs, null, 1));
  ok(/오늘 내 주식은 · 미국 9\/28 마감/.test(digest.title), digest.title);
  ok(digest.body.includes("보유 1종목 오늘 +10.00%"), digest.body);
  ok(digest.body.includes("NVDA +10.0%"), digest.body);
  ok(digest.body.includes("기타 중요 사건"), "8-K 사유");
  const alert = msgs.find((m) => m !== digest);
  ok(alert.body.includes("MSFT 내일(9/30) 실적 발표 예정"), alert.body);
  ok(!f.calls.some((u) => u.includes("AAPL")), "동기화 목록이 기기 목록(AAPL·KO)을 대신한다");
});

await test("크론: 할 일 없는 칸(주말 새벽)은 아무것도 부르지 않는다", async () => {
  const env = await makeEnv();
  await seed(env);
  const f = fakeFetch();
  const s = await runCron(env, Date.UTC(2026, 8, 26, 18, 0), { fetchImpl: f.impl }); // 토 03:00 KST
  eq(s.jobs.length, 0);
  eq(f.calls.length, 0);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
