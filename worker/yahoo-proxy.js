// @ts-nocheck
// =============================================================================
// Mir US Stocks — Yahoo Finance live proxy (Cloudflare Worker)
//
// 참고: Cloudflare 대시보드 에디터가 표시하는 빨간 줄은 대부분 TypeScript 타입
// 경고일 뿐 실제 오류가 아닙니다. 위 @ts-nocheck 로 그 경고를 끕니다. 코드 자체는
// Node 및 Workers 런타임에서 정상 동작합니다(문법 검증 통과).
//
// GitHub Pages is static, so it cannot run Python when a visitor opens a page.
// This tiny Worker runs on Cloudflare's free tier and fetches Yahoo Finance news
// (and the real price chart) on demand, returning JSON with CORS headers so the
// static site can call it from the browser when the stock-analysis page opens.
//
// Endpoint:  GET https://<your-worker>.workers.dev/?ticker=NVDA
// Response:  { "ticker": "NVDA", "news": [...], "chart": [[o,h,l,c,v], ...], "summary": "..." }
//
// Deploy (one time, free):
//   1) https://dash.cloudflare.com  ->  Workers & Pages  ->  Create  ->  Worker
//   2) Replace the template code with this file, click Deploy.
//   3) Add the Workers AI binding so Korean summaries work (free allocation):
//      Worker -> Settings -> Bindings -> Add -> Workers AI -> Variable name: AI -> Deploy.
//   4) Copy the deployed URL (e.g. https://mir-yahoo.<name>.workers.dev).
//   5) Put that URL into app.js -> LIVE_DATA_PROXY.
// (Optional) restrict ALLOW_ORIGIN below to your site for a little extra safety.
//
// 이 파일은 머지해도 자동 반영되지 않는다 — 대시보드에 붙여넣는 수동 배포다
// (DEPLOY.md "Cloudflare Worker 바인딩"). 바인딩: AI, MOVE_CACHE(KV), COMMUNITY_KV(KV),
// (선택) COMMUNITY_DO(Durable Object, class CommunityStore — 유료 플랜 + wrangler 필요.
// 없으면 커뮤니티는 KV 경로로 그대로 동작한다),
// Secrets: FINNHUB_API_KEY, GEMINI_API_KEY, (선택) REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET(주가 움직임 이유의 레딧), NAVER_APIHUB_KEY_ID/KEY(또는 옛 NAVER_CLIENT_ID/SECRET), COMMUNITY_ADMIN_KEY,
// (선택) GEMINI_MODEL, IP_HASH_SALT.
// (선택, 2026-10-21) TURNSTILE_SECRET — 있으면 커뮤니티 글·댓글·투표 쓰기에 Turnstile 검증 필수,
// 없으면 검증 생략. Rate Limiting 바인딩 RL_<BUCKET>(RL_POST·RL_VOTE 등) — 있으면 그 버킷은
// KV 카운터 대신 바인딩으로 센다. 둘 다 없어도 기존 동작 그대로(mir_design/OWNER_TODO.md).
// =============================================================================

const ALLOW_ORIGIN = "*"; // e.g. "https://seonu-dragon.github.io"
const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
// CNN dataviz 는 짧은 "Mozilla/5.0" UA 를 봇으로 보고 418(I'm a teapot)을 준다
// (2026-09-04 확인: 짧은 UA → 418, 브라우저 UA + Referer/Origin → 200).
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// LLM 을 태우는 경로 — /chat, move_analysis, 그리고 ?ticker= 응답의 한국어
// 요약(summary) 단계 — 는 뉴런·Gemini 쿼터를 소모하므로 아무 사이트에서나 못
// 부르게 Origin 을 제한하고 IP 리밋을 건다. ?ticker= 의 뉴스·차트·실적 자체와
// 나머지 데이터 프록시(fx·fng·indices·calendar 등)는 계속 개방(*)이다.
//
// Origin 이 없는 요청은 **거부**한다. 예전엔 "로컬 캡처 스크립트와 스모크
// 테스트가 이 경로를 쓴다" 는 이유로 통과시켰는데 사실이 아니었다 —
// chart_capture.js 는 로컬 detailPath(...) 만 읽고 워커를 부르지 않고,
// smoke_ui.py 는 http://127.0.0.1:<port> 로 서빙된 페이지를 브라우저로 몰아서
// Origin 이 반드시 붙는다. 그 결과 Origin 없는 curl 한 줄이면 캐시에 없는
// 티커마다 LLM 이 새로 돌았다(2026-09-03 라이브 확인).
//
// 로컬 개발·스모크는 포트가 매번 달라지므로(8099/8101/8103/8106…) 고정 목록
// 대신 정규식으로 localhost / 127.0.0.1 의 모든 포트를 받는다.
// Origin: null (file:// 로 연 페이지, 샌드박스 iframe)은 받지 않는다 —
// 레포에서 file:// 로 워커를 부르는 경로를 찾지 못했고(scratch 테스트는
// index.html 만 연다), null 은 누구나 위조할 수 있는 값이다.
const LLM_ALLOWED_ORIGINS = new Set([
  "https://seonu-dragon.github.io",
]);
const LLM_LOCAL_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

export function llmOriginAllowed(request) {
  const origin = (request && request.headers && request.headers.get("Origin")) || "";
  if (!origin) return false;
  if (LLM_ALLOWED_ORIGINS.has(origin)) return true;
  return LLM_LOCAL_ORIGIN_RE.test(origin);
}

// IP 리밋. 두 단계다(2026-10-21):
//   1) 버킷별 Cloudflare Rate Limiting 바인딩 `RL_<BUCKET>`(예: RL_POST, RL_VOTE)이 있으면
//      그것만 쓴다. 한도·기간은 바인딩 설정이 정한다(아래 RATE_LIMIT_BUCKETS 가 권장값 =
//      지금 코드의 KV 한도). KV 쓰기를 한 번도 하지 않는다 — 무료 플랜 KV 쓰기 1,000/일을
//      리밋 카운터가 태우던 것을 덜어 준다.
//   2) 바인딩이 없거나 호출이 실패하면 지금까지의 KV 고정창 카운터(동작 불변).
// KV 는 엣지 간 최종 일관성이라 정확하진 않지만, 쿼터를 태우는 봇 루프를 끊는 데는 충분하다.
// 하나의 공용 바인딩을 모든 버킷에 쓰지 않는 이유: 바인딩 하나는 한도가 하나라
// 글쓰기(분당 3)와 공감(분당 30)을 같은 한도로 묶게 된다.
export const RATE_LIMIT_BUCKETS = {
  chat: 10, summary: 10, move: 6, evnews: 20, reasons: 6, formula: 6,
  post: 3, comment: 6, like: 30, report: 5, vote: 5, clear: 2, sync_put: 10,
};

export function rateLimitBinding(env, bucket) {
  const name = `RL_${String(bucket || "").toUpperCase()}`;
  const b = env && env[name];
  return b && typeof b.limit === "function" ? b : null;
}

async function ipRateLimited(request, env, bucket, limit, windowSec) {
  const ip = (request && request.headers && request.headers.get("CF-Connecting-IP")) || "unknown";
  const binding = rateLimitBinding(env, bucket);
  if (binding) {
    try {
      const res = await binding.limit({ key: `${bucket}:${ip}` });
      return !(res && res.success);
    } catch (err) {
      console.error(`rate limit binding RL_${String(bucket).toUpperCase()} failed — KV 폴백:`, err && err.message);
    }
  }
  try {
    const kv = env && (env.MOVE_CACHE || env.COMMUNITY_KV);
    if (!kv) return false;
    const slot = Math.floor(Date.now() / (windowSec * 1000));
    const key = `rl:${bucket}:${ip}:${slot}`;
    const n = Number(await kv.get(key)) || 0;
    if (n >= limit) return true;
    await kv.put(key, String(n + 1), { expirationTtl: Math.max(60, windowSec * 2) });
    return false;
  } catch {
    return false;
  }
}

// 모든 업스트림 fetch 의 공통 타임아웃. 헤더가 올 때까지만 재는 "헤더 타임아웃"
// 이다 — 응답이 도착하면 타이머를 풀어 스트리밍 바디(Gemini SSE 등)는 끊지 않는다.
// 야후·구글 뉴스·investing.com 중 하나가 멈추면 Promise.all 전체가 워커의
// CPU/wall 한도까지 매달려 있던 것을 막는다.
const FETCH_TIMEOUT_MS = 8000;
async function fetchT(url, init = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// stale-if-error — 스크래핑·야후 프록시의 "직전 정상값" 캐시
//
// investing.com XHR·CNN Fear&Greed·야후 차트는 봇 차단·헤더 정책 변경 한 번에
// 통째로 비어 버리는 단일 장애점이다(WEBSITE_INSPECTION_REPORT §4-①). 업스트림이
// 성공할 때마다 KV(MOVE_CACHE, 없으면 COMMUNITY_KV)에 `lastgood:<name>` 으로
// { storedAt, value } 를 적어 두고, 실패(예외·non-2xx·빈 결과)하면 그 값을
// `stale: true, storedAt` 마커와 함께 돌려준다. 7일보다 오래된 값은 버리고
// 지금까지처럼 빈 결과를 준다(너무 낡은 공포지수·환율은 없느니만 못하다).
// KV 바인딩이 없으면 이 계층은 조용히 통과한다(동작 불변).
// =============================================================================
const LASTGOOD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LASTGOOD_KV_TTL_SEC = 8 * 24 * 60 * 60; // 캡보다 하루 길게 — 만료 판정은 storedAt 으로
const LASTGOOD_STALE_CACHE_SEC = 120;         // 낡은 응답은 짧게만 캐시해 곧 재시도되게

function lastGoodKv(env) {
  return (env && (env.MOVE_CACHE || env.COMMUNITY_KV)) || null;
}

function lastGoodEmpty(value) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

// 부분 실패 판정(감사 P2-1). fx 11종·indices 8종처럼 심볼을 병렬로 긁는 fetcher 는
// 한두 개만 살아 돌아와도 "성공"이라 직전 정상값을 그 조각으로 덮어썼다. 기대 개수의
// 60% 미만이면 실패로 보고 저장하지 않는다(직전값은 그대로 두고 stale 로 서빙).
export const LASTGOOD_MIN_COVERAGE = 0.6;

export function lastGoodInsufficient(value, expectedCount, minCoverage = LASTGOOD_MIN_COVERAGE) {
  if (!expectedCount || !Array.isArray(value)) return false;
  return value.length < Math.ceil(expectedCount * minCoverage);
}

// fetcher() 가 충분한 값을 주면 KV 에 저장하고 { value, stale:false } 를, 비었거나
// 던졌거나 **부분 실패**면 KV 의 직전값(캡 이내)을 { value, stale:true, storedAt } 로
// 돌려준다. 직전값도 없으면 빈 값(부분 실패 땐 모은 만큼 + partial:true)을 준다.
export async function withLastGood(env, name, fetcher, emptyValue, { maxAgeMs = LASTGOOD_MAX_AGE_MS, now = Date.now(), expectedCount = 0 } = {}) {
  const kv = lastGoodKv(env);
  const key = `lastgood:${name}`;
  let fresh = emptyValue;
  try {
    fresh = await fetcher();
  } catch (e) {
    fresh = emptyValue;
  }
  const empty = lastGoodEmpty(fresh);
  const partial = !empty && lastGoodInsufficient(fresh, expectedCount);
  if (!empty && !partial) {
    if (kv) {
      try {
        await kv.put(key, JSON.stringify({ storedAt: new Date(now).toISOString(), value: fresh }), { expirationTtl: LASTGOOD_KV_TTL_SEC });
      } catch (e) { /* 저장 실패는 응답에 영향 없음 */ }
    }
    return { value: fresh, stale: false, storedAt: null };
  }
  // 여기부터는 실패 경로 — 어떤 경우에도 lastgood 을 덮어쓰지 않는다.
  const fallback = partial ? { value: fresh, stale: false, storedAt: null, partial: true } : { value: emptyValue, stale: false, storedAt: null };
  if (!kv) return fallback;
  try {
    const saved = await kv.get(key, "json");
    const storedAt = saved && saved.storedAt ? Date.parse(saved.storedAt) : NaN;
    if (!saved || lastGoodEmpty(saved.value) || !Number.isFinite(storedAt)) return fallback;
    if (now - storedAt > maxAgeMs) return fallback;
    return { value: saved.value, stale: true, storedAt: saved.storedAt, ...(partial ? { partial: true } : {}) };
  } catch (e) {
    return fallback;
  }
}

// { <field>: value } 응답. stale 이면 stale/storedAt/warning 필드와 Warning 헤더를
// 덧붙이고 캐시를 짧게 잡는다. 신선하면 응답 모양은 예전과 완전히 같다.
function staleAwareJson(field, result) {
  if (!result.stale) {
    // 부분 실패인데 직전 정상값도 없는 경우: 모은 조각은 주되 partial 로 표시하고
    // 짧게만 캐시한다(다음 요청이 곧 다시 시도하도록).
    if (result.partial) return json({ [field]: result.value, partial: true }, 200, LASTGOOD_STALE_CACHE_SEC);
    return json({ [field]: result.value });
  }
  const resp = json({
    [field]: result.value,
    stale: true,
    storedAt: result.storedAt,
    ...(result.partial ? { partial: true } : {}),
    warning: `upstream unavailable; serving last good ${field} from ${result.storedAt}`,
  }, 200, LASTGOOD_STALE_CACHE_SEC);
  resp.headers.set("Warning", '110 - "Response is Stale"');
  return resp;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 비밀값 비교는 해시 후 고정 길이로 XOR — 길이·앞글자 일치로 시간이 갈리지 않는다.
async function timingSafeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i += 1) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

// 신고·투표 중복 판정용. 원본 IP 는 KV 에 남기지 않고 솔트 해시 16자만 저장한다.
async function hashedIp(request, env) {
  const salt = (env && env.IP_HASH_SALT) || "mir-community-v1";
  return (await sha256Hex(`${salt}:${clientIp(request)}`)).slice(0, 16);
}

// 관리자 키는 X-Admin-Key 헤더가 정식이다. 쿼리/바디의 adminKey 는 GET URL 이
// 브라우저 히스토리·로그·Referer 에 남는 노출면이라 한 릴리스만 폴백으로 받는다.
async function communityAdminOk(env, request, fallbackKey) {
  const adminKey = env && env.COMMUNITY_ADMIN_KEY;
  if (!adminKey) return false;
  const supplied = (request && request.headers && request.headers.get("X-Admin-Key")) || fallbackKey || "";
  if (!supplied) return false;
  return timingSafeEqual(String(supplied), String(adminKey));
}

// ?model= 은 A/B 용인데 아무나 넘길 수 있으면 임의 모델(대형·유료)로 뉴런을
// 태우는 경로가 된다. 관리자 키(X-Admin-Key, 구형 ?adminKey= 폴백)가 있을 때만
// 존중하고, 그 외에는 빈 문자열 = 기본 모델이다.
export async function resolveModelOverride(env, request, url) {
  const raw = String(url.searchParams.get("model") || "").slice(0, 120);
  if (!raw) return "";
  const isAdmin = await communityAdminOk(env, request, url.searchParams.get("adminKey"));
  return isAdmin ? raw : "";
}

// earnings_calendar 배치는 티커마다 야후 quoteSummary 를 부른다(20개 = 20회).
const EARNINGS_CALENDAR_MAX_TICKERS = 20;
// Workers AI text models tried in order for the Korean summary (first that works wins).
// Larger / newer models follow Korean instructions far better than the small ones.
const SUMMARY_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
];
// Chatbot models. On the Workers Paid plan we use the large 70B model for far
// better Korean answers (24B as fallback). On the free plan switch these back to
// "@cf/meta/llama-3.1-8b-instruct" to stay within the daily neuron budget.
const CHAT_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
];
// /chat 이 GEMINI_API_KEY 가 있을 때 쓰는 모델 체인. env.GEMINI_MODEL 이 있으면
// 그것을 맨 앞에 두고, 이어서 아래 기본 순서를 붙인다. 한 모델이 404/400
// "model not found" 를 주면 다음 모델을 **한 번씩만** 시도한다. 스트리밍·비스트리밍
// 두 경로가 같은 체인을 봐야 하므로 한 곳에만 둔다.
//
// 2026-09-15 감사(P1-2): 옛 기본값 gemini-2.0-flash(2026-06-01 셧다운)·
// gemini-1.5-flash(2025-09 종료)가 둘 다 죽어, GEMINI_MODEL 미설정이면 /chat 마다
// 404 를 두 번 받고서야 Workers AI 로 넘어갔다. 살아 있는 모델로 교체.
// 이 목록이 또 낡으면 코드 재배포 없이 env.GEMINI_MODEL 로 먼저 덮을 수 있다.
const GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

export function geminiModelChain(env) {
  const chain = [];
  const override = env && typeof env.GEMINI_MODEL === "string" ? env.GEMINI_MODEL.trim() : "";
  if (override) chain.push(override);
  for (const m of GEMINI_FALLBACK_MODELS) if (!chain.includes(m)) chain.push(m);
  return chain;
}

// 404 는 models/<name> 경로가 없다는 뜻이라 그대로 "모델 없음". 400 은 인자 오류
// 전반이라 본문에 모델 관련 문구가 있을 때만 다음 모델로 넘어간다.
export function geminiModelUnavailable(status, bodyText) {
  if (status === 404) return true;
  if (status === 400) return /model|not found|not supported|NOT_FOUND/i.test(String(bodyText || ""));
  return false;
}
// Gemini 는 응답 생성 후 헤더를 보내는 경우가 있어 기본 8초보다 길게 잡는다.
const GEMINI_TIMEOUT_MS = 25000;

// 런타임이 보는 진입점은 default export 하나다. 아래 named export 들
// (handleFetch·llmOriginAllowed·CommunityStore 등)은 worker/test_worker.mjs 가
// 네트워크 없이 부르기 위한 것이고, Workers 모듈 포맷에서 무시된다.
// (CommunityStore 만은 예외 — DO 클래스는 반드시 named export 여야 한다.)
export default {
  async fetch(request, env) {
    // 최상위 try/catch: 내부 예외가 CORS 헤더 없는 500 으로 나가면 브라우저에선
    // 원인 불명의 CORS 오류로만 보인다. 항상 CORS 붙은 JSON 오류로 응답한다.
    try {
      return await handleFetch(request, env);
    } catch (err) {
      // 내부 메시지(업스트림 URL·키 이름 등)는 로그로만. 클라이언트엔 코드만 준다.
      console.error("worker internal error:", err);
      return cors(json({ error: "internal" }, 500, 0));
    }
  },
};

// =============================================================================
// Cloudflare Turnstile — 커뮤니티 글·댓글·투표 쓰기의 봇 방지(2026-10-21)
//
// env.TURNSTILE_SECRET 이 **없으면 검증을 건너뛴다**(지금까지와 완전히 동일). 있으면
// 아래 세 경로는 본문의 turnstileToken 을 siteverify 로 확인해야만 핸들러로 간다.
// 토큰은 헤더가 아니라 JSON 본문 필드다 — 헤더로 보내면 CORS Allow-Headers 를 늘려야
// 하고, 옛 워커가 떠 있는 동안 프런트가 먼저 키를 넣으면 preflight 에서 쓰기가 전부
// 막힌다. 본문 필드는 옛 워커가 그냥 무시한다.
// 검증은 엣지에서 DO 디스패치 **앞**에 한다(DO 안에서 직렬 큐를 외부 호출로 붙잡지 않게).
// siteverify 자체가 실패(네트워크·타임아웃)하면 통과시키지 않는다 — 시크릿을 넣었다는 건
// 검증을 필수로 하겠다는 뜻이다.
// =============================================================================
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ROUTES = new Set(["POST /community", "POST /community/comment", "POST /community/vote"]);
const TURNSTILE_TIMEOUT_MS = 5000;

export function turnstileRequired(env, method, pathname) {
  const secret = env && typeof env.TURNSTILE_SECRET === "string" ? env.TURNSTILE_SECRET.trim() : "";
  return Boolean(secret) && TURNSTILE_ROUTES.has(`${method} ${pathname}`);
}

// null = 통과(검증 불필요 포함), Response = 거부.
export async function turnstileGate(request, url, env) {
  if (!turnstileRequired(env, request.method, url.pathname)) return null;
  let token = "";
  try {
    const body = await request.clone().json();
    token = body && typeof body.turnstileToken === "string" ? body.turnstileToken.trim().slice(0, 2048) : "";
  } catch { token = ""; }
  if (!token) {
    return noStoreJson({ error: "turnstile_required", message: "보안 확인이 필요합니다. 다시 시도해 주세요." }, 403);
  }
  const form = new URLSearchParams();
  form.set("secret", env.TURNSTILE_SECRET.trim());
  form.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.set("remoteip", ip);
  let result = null;
  try {
    const r = await fetchT(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    }, TURNSTILE_TIMEOUT_MS);
    result = r && r.ok ? await r.json() : null;
  } catch (err) {
    console.error("turnstile siteverify failed:", err && err.message);
    result = null;
  }
  if (!result) {
    return noStoreJson({ error: "turnstile_unavailable", message: "보안 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
  }
  if (!result.success) {
    return noStoreJson({ error: "turnstile_failed", message: "보안 확인에 실패했습니다. 다시 시도해 주세요." }, 403);
  }
  return null;
}

// =============================================================================
// 엣지 캐시(caches.default) — 모든 방문자가 같은 값을 받는 공개 데이터 라우트용(2026-10-21)
//
// ?fx= ?fng= ?indices= ?calendar= ?earnings_calendar= 는 프런트가 cache:"no-store" 로 부르고
// workers.dev 응답은 Cloudflare 가 자동으로 캐시하지 않아서, 방문자마다 업스트림(야후·CNN·
// investing.com)을 새로 쳤다. 같은 콜로의 반복 요청을 짧은 TTL 로 흡수한다.
//   · 신선하고 비어 있지 않은 200 만 저장한다 — stale·partial·빈 결과는 저장하지 않아
//     다음 요청이 곧바로 다시 시도한다(lastgood 계층과 같은 원칙).
//   · TTL 은 화면 갱신 주기보다 짧게 잡는다(지수는 장중 1분 폴링 → 30초).
//   · caches 가 없는 런타임(Node 테스트 등)에서는 그냥 통과한다.
//   · Origin 에 따라 본문이 달라지는 ?ticker= / move_analysis / event_news 에는 쓰지 않는다.
// =============================================================================
export const EDGE_CACHE_TTL = { fx: 60, fng: 300, indices: 30, calendar: 600, earnings_calendar: 1800 };

function edgeCache() {
  try {
    return typeof caches !== "undefined" && caches && caches.default ? caches.default : null;
  } catch { return null; }
}

// produce() → { resp, cacheable }. 캐시 히트에는 X-Mir-Edge-Cache: HIT 가 붙는다.
export async function edgeCached(keyPath, ttlSec, produce) {
  const cache = edgeCache();
  const key = new Request(`https://mir-edge.cache/${keyPath}`);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const r = new Response(hit.body, hit);
        r.headers.set("X-Mir-Edge-Cache", "HIT");
        return r;
      }
    } catch (err) { /* 캐시 조회 실패는 무시하고 원본으로 */ }
  }
  const { resp, cacheable } = await produce();
  if (cache && cacheable && resp && resp.status === 200) {
    try {
      const stored = new Response(resp.clone().body, resp);
      stored.headers.set("Cache-Control", `public, max-age=${ttlSec}`);
      await cache.put(key, stored);
    } catch (err) { /* 저장 실패는 응답에 영향 없음 */ }
  }
  resp.headers.set("X-Mir-Edge-Cache", "MISS");
  return resp;
}

function lastGoodCacheable(result) {
  return Boolean(result) && !result.stale && !result.partial && !lastGoodEmpty(result.value);
}

export async function handleFetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);

    // Site help chatbot (POST /chat): explains how to use the site + finance terms.
    if (request.method === "POST" && url.pathname === "/chat") {
      if (!llmOriginAllowed(request)) return cors(json({ error: "forbidden_origin" }, 403, 0));
      if (await ipRateLimited(request, env, "chat", 10, 60)) {
        return cors(json({ error: "rate_limited", message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, 429, 0));
      }
      return cors(await handleChat(request, env));
    }

    // 수식 스크리너 '문장 → 수식' 변환(POST /formula, 2026-10-23). Workers AI 만 쓴다(Gemini 무료 한도 보호).
    // 답은 수식 문자열 하나이고, 프런트가 자기 파서·필드 목록으로 다시 검증해 통과한 것만 보여 준다.
    // 옛 워커는 이 경로를 모르는 경로(404 not_found)로 답해 프런트가 버튼을 숨긴다.
    if (request.method === "POST" && url.pathname === "/formula") {
      if (!llmOriginAllowed(request)) return cors(json({ error: "forbidden_origin" }, 403, 0));
      if (await ipRateLimited(request, env, "formula", 6, 60)) {
        return cors(json({ error: "rate_limited", message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, 429, 0));
      }
      return cors(await handleFormula(request, env));
    }

    // Shared community board.
    // COMMUNITY_DO(Durable Object)가 있으면 전 요청을 그 객체로 몰아 직렬화하고,
    // 없으면 지금까지처럼 COMMUNITY_KV 를 직접 읽고 쓴다(아래 dispatchCommunity).
    const communityHandler = communityHandlerFor(request.method, url.pathname);
    if (communityHandler) {
      // TURNSTILE_SECRET 이 없으면 turnstileGate 는 즉시 null(검증 생략, 기존 동작).
      const denied = await turnstileGate(request, url, env);
      if (denied) return cors(denied);
      return cors(await dispatchCommunity(request, url, env, communityHandler));
    }

    if (url.pathname === "/sync/prefs") {
      if (request.method === "GET") return cors(await handleSyncPrefsGet(url, env));
      if (request.method === "PUT") return cors(await handleSyncPrefsPut(request, env));
    }


    // Live FX rates (incl. USD/KRW) for the 마켓 데이터 tab + top header.
    // 네 경로 모두 stale-if-error(withLastGood): 업스트림이 죽으면 KV 의 직전
    // 정상값을 stale:true 마커와 함께 준다. 신선할 땐 응답 모양이 예전과 같다.
    // 다섯 경로 모두 엣지 캐시(edgeCached)를 거친다 — 신선한 결과만 짧게 저장.
    if (url.searchParams.get("fx")) {
      return cors(await edgeCached("fx", EDGE_CACHE_TTL.fx, async () => {
        const r = await withLastGood(env, "fx", fetchFx, [], { expectedCount: FX_LIST.length });
        return { resp: staleAwareJson("fx", r), cacheable: lastGoodCacheable(r) };
      }));
    }
    // CNN Fear & Greed index for the top header gauge.
    if (url.searchParams.get("fng")) {
      return cors(await edgeCached("fng", EDGE_CACHE_TTL.fng, async () => {
        const r = await withLastGood(env, "fng", fetchFng, null);
        return { resp: staleAwareJson("fng", r), cacheable: lastGoodCacheable(r) };
      }));
    }
    // Intraday index mini-charts (Finviz-style strip).
    if (url.searchParams.get("indices")) {
      return cors(await edgeCached("indices", EDGE_CACHE_TTL.indices, async () => {
        const r = await withLastGood(env, "indices", fetchIndices, [], { expectedCount: INDEX_LIST.length });
        return { resp: staleAwareJson("indices", r), cacheable: lastGoodCacheable(r) };
      }));
    }
    // Economic calendar (Korea + US) via investing.com XHR endpoint.
    if (url.searchParams.get("calendar")) {
      return cors(await edgeCached("calendar", EDGE_CACHE_TTL.calendar, async () => {
        const r = await fetchCalendar(env);
        return { resp: staleAwareJson("calendar", r), cacheable: lastGoodCacheable(r) };
      }));
    }
    // 전 세계 종목 검색(트레이딩뷰 + 야후 병합) · 야후 insights(기술 전망·지지/저항·비슷한 종목) ·
    // 옵션 체인 요약. LLM 없음 — 개방 + 엣지 캐시. 옛 워커는 이 셋을 404 로 답한다(프론트 기능 감지).
    if (url.searchParams.has("symsearch")) {
      return cors(await handleSymbolSearch(url.searchParams.get("symsearch")));
    }
    if (url.searchParams.has("insights")) {
      const sym = routeSymbol(url.searchParams.get("insights"));
      if (!sym) return cors(json({ error: "invalid symbol" }, 400, 0));
      return cors(await handleInsights(sym));
    }
    if (url.searchParams.has("options")) {
      const sym = routeSymbol(url.searchParams.get("options"));
      if (!sym) return cors(json({ error: "invalid symbol" }, 400, 0));
      return cors(await handleOptions(sym));
    }
    if (url.searchParams.get("earnings_probe")) {
      // 야후 세션을 실제로 태우는 진단 라우트라 관리자 키 뒤에 둔다(감사 P3).
      if (!(await communityAdminOk(env, request, url.searchParams.get("adminKey")))) {
        return cors(json({ error: "forbidden" }, 403, 0));
      }
      const session = await bootstrapYahooSessionBasic();
      let quoteStatus = null;
      if (session?.crumb) {
        const probe = await yahooAuthedFetch(
          "https://query1.finance.yahoo.com/v10/finance/quoteSummary/NVDA?modules=calendarEvents",
        );
        quoteStatus = probe ? probe.status : null;
      }
      return cors(json({
        cookieLen: session?.cookie?.length || 0,
        hasCrumb: Boolean(session?.crumb),
        quoteStatus,
      }));
    }
    // Batch earnings dates for market-wide calendar tab.
    if (url.searchParams.get("earnings_calendar")) {
      const raw = (url.searchParams.get("tickers") || "")
        .split(",")
        .map((t) => t.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
        .filter(Boolean)
        .slice(0, EARNINGS_CALENDAR_MAX_TICKERS);
      // 캐시 키는 정렬·중복 제거한 티커 목록(같은 관심 목록이면 순서와 무관하게 같은 키).
      const keyTickers = [...new Set(raw)].sort().join(",");
      return cors(await edgeCached(`earnings_calendar/${encodeURIComponent(keyTickers)}`, EDGE_CACHE_TTL.earnings_calendar, async () => {
        const earnings = await fetchEarningsCalendar(raw);
        return { resp: json({ earnings }), cacheable: Array.isArray(earnings) && earnings.length > 0 };
      }));
    }

    // 주가 움직임 이유(소셜 먼저 → 뉴스 대조). ?ticker= 가 아니라 이 값에 종목을 싣는다 — 옛 워커는 이 경로를
    // 모르는 경로(404 not_found)로 답해 프런트가 버튼을 숨긴다(worker-extras 와 같은 감지).
    if (url.searchParams.get("move_reasons")) {
      return handleMoveReasons(request, env, url, url.searchParams.get("move_reasons"));
    }

    // 가장 긴 실제 심볼이 005930.KS(9자)라 16자면 넉넉하다. 무제한이면 긴 문자열이
    // 캐시 키·프롬프트·업스트림 URL 로 그대로 흘러간다(감사 P3).
    const ticker = (url.searchParams.get("ticker") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9.\-]/g, "")
      .slice(0, 16);
    // 여기가 라우팅의 끝이다. 모르는 경로를 400 + max-age=900 으로 주면 오타 한 번이
    // 15분간 엣지에 박힌다 → 404 + no-store (감사 P3).
    if (!ticker) return cors(noStoreJson({ error: "not_found", message: "unknown route" }, 404));

    // Korean tickers must keep the dot for Yahoo (005930.KS); US class shares use
    // dashes (BRK.B -> BRK-B).
    const symbol = isKoreanTicker(ticker) ? ticker : ticker.replace(/\./g, "-");
    const kr = isKoreanTicker(ticker);
    // 종목 차트 분봉(?intraday=1&interval=5m). LLM·KV 를 쓰지 않는 단순 시세라 Origin 게이트·
    // KV 리밋(요청마다 KV 쓰기)을 두지 않고, 엣지 캐시 60초로 같은 종목 반복 요청을 흡수한다.
    if (url.searchParams.get("intraday")) {
      return cors(await handleIntraday(request, symbol, url.searchParams.get("interval")));
    }

    // 차트 '큰 등락일' 툴팁의 그날 전후 뉴스(?event_news=1&date=YYYY-MM-DD). LLM 없음 —
    // move_analysis 와 같은 뉴스 수집(Finnhub·Google News·GDELT / 국내 Google News·네이버)만.
    // 지난 날짜의 결과는 바뀌지 않으므로 KV 에 오래 둔다(캐시 히트는 리밋을 태우지 않는다).
    if (url.searchParams.get("event_news")) {
      const eventDate = String(url.searchParams.get("date") || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return cors(json({ error: "invalid date" }, 400));
      if (!llmOriginAllowed(request)) return cors(json({ error: "forbidden_origin" }, 403, 0));
      const cacheKey = `evnews:v2:${ticker}:${eventDate}`;
      if (env && env.MOVE_CACHE) {
        const cached = await env.MOVE_CACHE.get(cacheKey, "json");
        if (cached && Array.isArray(cached.news)) return cors(varyOrigin(json({ ...cached, cached: true }, 200, 3600)));
      }
      if (await ipRateLimited(request, env, "evnews", 20, 60)) {
        return cors(json({ error: "rate_limited", message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, 429, 0));
      }
      const payload = await eventNewsPayload(env, ticker, symbol, kr, eventDate);
      if (env && env.MOVE_CACHE) {
        // 최근 1주 안의 날짜는 기사가 더 붙을 수 있어 6시간, 그보다 오래된 날짜는 30일.
        // 0건은 소스가 잠깐 막힌 것일 수 있어 1시간만 둔다.
        const ageDays = dateDistanceDays(eventDate, new Date().toISOString().slice(0, 10));
        const ttl = !payload.news.length ? 3600 : (ageDays > 7 ? 2592000 : 21600);
        await env.MOVE_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });
      }
      return cors(varyOrigin(json(payload, 200, 3600)));
    }

    const modelOverride = await resolveModelOverride(env, request, url);

    // Price-event analysis is intentionally opt-in: the static site calls this
    // only after the visitor clicks "원인 분석" on a recent price event.
    if (url.searchParams.get("move_analysis")) {
      const eventDate = String(url.searchParams.get("date") || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return cors(json({ error: "invalid date" }, 400));
      // 등락률은 호출자가 주는 값이라 프롬프트에 그대로 들어간다. 범위를 자르고
      // 소수 2자리로 고정해 키 공간을 제한한 뒤, 캐시 키에 해시로 넣는다 —
      // 예전엔 ticker:date 만으로 키를 잡아서, 아무 값이나 넣은 첫 호출이 30일간
      // 모든 방문자에게 그 결과를 보여 줬다(캐시 오염).
      const rawChange = Number(url.searchParams.get("change") || 0);
      const eventChange = Number.isFinite(rawChange)
        ? Math.round(Math.max(-100, Math.min(1000, rawChange)) * 100) / 100
        : 0;
      const promptHash = (await sha256Hex(`${eventChange}|${modelOverride}`)).slice(0, 12);
      const cacheKey = `move:v4:${ticker}:${eventDate}:${promptHash}`;
      // 게이트는 캐시 읽기보다 **앞**이다. 예전엔 캐시 히트를 무제한 공개했는데,
      // 허용되지 않은 호출자에게 결과를 주는 경로 자체를 남길 이유가 없다
      // (LLM 비용은 어차피 캐시 미스에서만 난다).
      const originOk = llmOriginAllowed(request);
      if (!originOk) return cors(json({ error: "forbidden_origin" }, 403, 0));
      if (env && env.MOVE_CACHE) {
        const cached = await env.MOVE_CACHE.get(cacheKey, "json");
        if (cached && cached.analysis) return cors(varyOrigin(json({ ...cached, cached: true }, 200, 2592000)));
      }
      if (await ipRateLimited(request, env, "move", 6, 60)) {
        return cors(json({ error: "rate_limited", message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, 429, 0));
      }
      // Benchmarks: Korean stocks compare against KOSPI/KOSDAQ, US against S&P/Nasdaq.
      const benchmarks = kr
        ? [["^KS11", "KOSPI"], ["^KQ11", "KOSDAQ"]]
        : [["SPY", "S&P 500"], ["QQQ", "Nasdaq 100"]];
      // 회사명은 호출자 입력이 아니라 서버가 정한다(야후/네이버 종목명). 예전엔
      // ?company= 가 검색어와 프롬프트에 그대로 들어가 "NVDA(아무 문구)" 로 캐시됐다.
      const [company, chart, ...benchCharts] = await Promise.all([
        resolveCompanyName(ticker, symbol, kr),
        fetchChart(symbol),
        ...benchmarks.map(([sym]) => fetchChart(sym)),
      ]);
      const companyLabel = company || ticker;
      const newsResult = await moveAnalysisNews(env, ticker, symbol, companyLabel, eventDate, kr);
      const benchLabels = Object.fromEntries(benchmarks);
      const marketContext = {};
      benchmarks.forEach(([sym], i) => { marketContext[sym] = chartMoveContext(benchCharts[i], eventDate); });
      const confidence = evidenceConfidence(newsResult.news, eventDate);
      const { text: analysis, error: analysisError, model: analysisModel } =
        await summarizeMoveAnalysisKorean(env, ticker, companyLabel, eventDate, eventChange, newsResult.news, chart, marketContext, confidence, modelOverride || null, { isKr: kr, benchLabels });
      const payload = {
        ticker,
        company: companyLabel,
        date: eventDate,
        changePct: eventChange,
        chartContext: chartMoveContext(chart, eventDate),
        marketContext,
        analysis,
        analysisError,
        analysisModel,
        confidence,
        sources: newsResult.news.slice(0, 6),
        newsProviders: newsResult.providers,
        searchWindowDays: newsResult.windowDays,
      };
      // 허용 Origin 이 만든 결과만 30일 캐시에 넣는다(위 게이트를 통과했으니 항상
      // 참이지만, 게이트가 옮겨져도 저장 조건은 남도록 명시).
      if (analysis && originOk && env && env.MOVE_CACHE) {
        await env.MOVE_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 2592000 });
      }
      return cors(varyOrigin(json(payload, 200, analysis ? 2592000 : 900)));
    }

    // Korean stocks get Korean-language headlines from Naver; US stays on Yahoo.
    // quote(2026-09-06): 미국 종목의 장 상태·프리/애프터마켓 시세. 실패해도 null 로 두고 나머지는 그대로.
    const [news, chart, earnings, quote] = await Promise.all([
      kr ? fetchNaverNews(ticker) : fetchNews(env, symbol),
      fetchChart(symbol),
      resolveTickerEarnings(ticker, symbol, kr),
      kr ? Promise.resolve(null) : fetchQuoteState(symbol),
    ]);
    const { text: summary, error: summaryError, model: summaryModel, cached: summaryCached } =
      await cachedTickerSummary(request, env, ticker, news, kr, modelOverride);
    // summary 는 Origin 게이트 뒤라 같은 URL 이라도 호출자에 따라 내용이 다르다.
    return cors(varyOrigin(json({
      ticker, news, chart, earnings: earnings.earnings, earningsStatus: earnings.status, quote, summary, summaryError, summaryModel,
      summaryCached: Boolean(summaryCached), newsSource: kr ? "naver" : "yahoo",
    })));
}

// ?ticker= 의 한국어 요약. 예전엔 요청마다 70B 모델을 돌렸고 Origin·IP 제한도
// 캐시도 없었다 — 아무 스크립트나 루프를 돌리면 뉴런 예산이 그대로 새는 경로였다.
// 종목·날짜(UTC) 키로 KV 에 1시간 캐시한다. 게이트는 캐시 읽기 앞에 있어
// 캐시 히트도 허용 Origin 에서만 나간다. 게이트에 걸리면 뉴스·차트는 그대로 주고
// summary 만 비운다.
export async function cachedTickerSummary(request, env, ticker, news, isKr, modelOverride) {
  // 게이트가 캐시 읽기보다 앞이다 — 캐시 히트라도 허용되지 않은 Origin 에는
  // 요약을 주지 않는다(뉴스·차트는 그대로 나간다).
  if (!llmOriginAllowed(request)) return { text: "", error: "forbidden_origin" };
  if (!news || !news.length) return { text: "", error: "no_news" };
  const kv = env && (env.MOVE_CACHE || env.COMMUNITY_KV);
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `summary:v1:${ticker}:${day}`;
  // 모델 오버라이드(관리자 A/B)는 기본 캐시를 읽지도 쓰지도 않는다.
  if (kv && !modelOverride) {
    try {
      const cached = await kv.get(cacheKey, "json");
      if (cached && cached.text) return { text: cached.text, error: "", model: cached.model || "", cached: true };
    } catch (_) { /* KV 장애는 캐시 미스로 취급 */ }
  }
  if (await ipRateLimited(request, env, "summary", 10, 60)) return { text: "", error: "rate_limited" };
  const result = await summarizeKorean(env, ticker, news, modelOverride || null, isKr);
  if (result.text && kv && !modelOverride) {
    try {
      await kv.put(cacheKey, JSON.stringify({ text: result.text, model: result.model || "" }), { expirationTtl: 3600 });
    } catch (_) { /* 캐시 실패는 응답에 영향 없음 */ }
  }
  return result;
}

// move_analysis 프롬프트·뉴스 검색어에 들어갈 회사명. KR 은 네이버 종목 기본정보,
// US 는 야후 차트 meta(longName/shortName). 못 찾으면 "" — 호출자는 티커로 대체한다.
async function resolveCompanyName(ticker, symbol, isKr) {
  try {
    if (isKr) {
      const code = String(ticker || "").replace(/\.(KS|KQ)$/i, "").replace(/[^0-9A-Za-z]/g, "");
      if (!code) return "";
      const r = await fetchT(
        `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/basic`,
        { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: "https://m.stock.naver.com/" } },
      );
      if (!r.ok) return "";
      const data = await r.json();
      return String((data && data.stockName) || "").replace(/[<>]/g, "").trim().slice(0, 120);
    }
    const r = await fetchT(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      { headers: UA },
    );
    if (!r.ok) return "";
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta || {};
    return String(meta.longName || meta.shortName || "").replace(/[<>]/g, "").trim().slice(0, 120);
  } catch (_) {
    return "";
  }
}

function chartMoveContext(chart, eventDate) {
  if (!Array.isArray(chart) || !eventDate) return null;
  const idx = chart.findIndex((row) => row && row[5] === eventDate);
  if (idx < 0) return null;
  const row = chart[idx];
  const prev = chart[Math.max(0, idx - 1)];
  const prevClose = Number(prev && prev[3]);
  const close = Number(row[3]);
  const volume = Number(row[4] || 0);
  const start = Math.max(0, idx - 20);
  const sample = chart.slice(start, idx).map((r) => Number(r && r[4])).filter((v) => Number.isFinite(v) && v > 0);
  const avgVolume = sample.length ? sample.reduce((sum, value) => sum + value, 0) / sample.length : null;
  return {
    date: eventDate,
    open: row[0],
    high: row[1],
    low: row[2],
    close: row[3],
    prevClose: Number.isFinite(prevClose) ? prevClose : null,
    changePct: Number.isFinite(close) && Number.isFinite(prevClose) && prevClose ? round((close / prevClose - 1) * 100) : null,
    volume,
    volumeRatio20d: avgVolume ? round(volume / avgVolume) : null,
  };
}

function shiftIsoDate(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateDistanceDays(a, b) {
  const da = new Date(`${a}T12:00:00Z`);
  const db = new Date(`${b}T12:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 999;
  return Math.abs((da.getTime() - db.getTime()) / 86400000);
}

function normalizeGdeltDate(value) {
  const raw = String(value || "");
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : raw.slice(0, 10);
}

function newsIdentity(news) {
  return String(news.title || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();
}

function rankHistoricalNews(news, ticker, company, eventDate) {
  const trusted = /reuters|apnews|bloomberg|cnbc|wsj|ft\.com|marketwatch|barrons|investors\.com|sec\.gov/i;
  const terms = [ticker, ...String(company || "").split(/\s+/)].filter((term) => term.length >= 3);
  const seen = new Set();
  return (news || [])
    .filter((item) => item && item.title && item.link && /^https?:\/\//i.test(item.link))
    .map((item) => {
      const key = newsIdentity(item);
      const distance = dateDistanceDays(item.publishedAt, eventDate);
      const haystack = `${item.title} ${item.summary || ""}`.toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term.toLowerCase())).length;
      const score = 100 - distance * 12 + matches * 9 + (trusted.test(`${item.publisher} ${item.link}`) ? 12 : 0) + (item.summary ? 4 : 0);
      return { ...item, distanceDays: distance, score };
    })
    .filter((item) => item.distanceDays <= 8 && item.score > 20)
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = newsIdentity(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map(({ score, distanceDays, ...item }) => ({ ...item, distanceDays }));
}

async function fetchFinnhubNews(env, ticker, from, to) {
  const token = env && env.FINNHUB_API_KEY;
  if (!token) return [];
  try {
    const endpoint = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}`;
    const response = await fetchT(endpoint, { headers: { ...UA, "X-Finnhub-Token": token } });
    if (!response.ok) return [];
    const rows = await response.json();
    return (Array.isArray(rows) ? rows : []).map((item) => ({
      title: item.headline || "",
      summary: item.summary || "",
      publisher: item.source || "Finnhub",
      link: item.url || "",
      publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString().slice(0, 10) : "",
      provider: "Finnhub",
    }));
  } catch (error) {
    return [];
  }
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function rssTag(block, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  return decodeXmlText(match ? match[1] : "");
}

function parseGoogleNewsRss(xml) {
  const items = String(xml || "").match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 50).map((block) => ({
    title: rssTag(block, "title"),
    summary: "",
    publisher: rssTag(block, "source") || "Google News",
    link: rssTag(block, "link") || rssTag(block, "guid"),
    publishedAt: (() => {
      const date = new Date(rssTag(block, "pubDate"));
      return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    })(),
    provider: "Google News",
  })).filter((item) => item.title && item.link);
}

function evidenceConfidence(news, eventDate) {
  const close = (news || []).filter((item) => dateDistanceDays(item.publishedAt, eventDate) <= 2);
  if (close.length >= 3) return "높음";
  if (close.length >= 1 || (news || []).length >= 3) return "보통";
  return "낮음";
}

async function summarizeMoveAnalysisKorean(env, ticker, company, eventDate, eventChange, news, chart, marketContext, confidence, modelOverride, options = {}) {
  if (!env || !env.AI) return { text: "", error: "no_ai_binding" };
  const isKr = Boolean(options.isKr);
  const benchLabels = options.benchLabels || {};
  const marketLabel = isKr ? "국내(한국)" : "미국";
  const context = chartMoveContext(chart, eventDate);
  const headlines = (news || []).length
    ? news.slice(0, 10).map((item, index) => {
      const summary = item.summary ? ` | 요약: ${item.summary.slice(0, 500)}` : "";
      return `${index + 1}. ${item.publishedAt || "날짜 없음"} | ${item.publisher || item.provider || "출처 없음"} | ${item.title}${summary}`;
    }).join("\n")
    : "해당 날짜 전후로 검색된 관련 뉴스 없음";
  const chartText = context
    ? `종목: 시가 ${context.open}, 고가 ${context.high}, 저가 ${context.low}, 종가 ${context.close}, 전일 종가 ${context.prevClose ?? "없음"}, 등락률 ${context.changePct ?? eventChange}%, 20일 평균 대비 거래량 ${context.volumeRatio20d ?? "계산 불가"}배`
    : `종목 차트에서 ${eventDate}를 찾지 못했습니다. 전달 등락률은 ${eventChange}%입니다.`;
  const benchSymbols = Object.keys(marketContext || {});
  const marketText = benchSymbols.map((symbol) => {
    const row = marketContext && marketContext[symbol];
    const label = benchLabels[symbol] || symbol;
    return row ? `${label} ${row.changePct}%` : `${label} 데이터 없음`;
  }).join(", ");
  const benchNames = benchSymbols.map((s) => benchLabels[s] || s).join("·") || "지수";
  const prompt =
    `${marketLabel} 주식 ${ticker}(${company})의 ${eventDate} 가격 이벤트 원인을 분석하세요.\n\n` +
    `[가격/거래량]\n${chartText}\n시장 비교: ${marketText}\n\n` +
    `[날짜 기준 검색 뉴스]\n${headlines}\n\n` +
    `검색 근거 신뢰도: ${confidence}\n\n` +
    `작성 규칙:\n` +
    `- 가장 가능성이 높은 촉매를 첫 문장에 제시하고, 근거가 된 매체명과 날짜를 문장 안에 포함하세요.\n` +
    `- 종목 고유 뉴스와 ${benchNames} 등 시장 전체 움직임을 구분하세요.\n` +
    `- 직접 확인된 사실과 가능성 수준의 해석을 분리하고, 제공되지 않은 사실은 만들지 마세요.\n` +
    `- 관련 뉴스가 없을 때만 원인 불명확이라고 말하세요. 관련 헤드라인이 있으면 핵심 재료부터 설명하세요.\n` +
    `- 4~6문장의 자연스러운 한국어 단락 하나로 작성하고 매수·매도 조언은 하지 마세요.`;
  const models = modelOverride ? [modelOverride] : SUMMARY_MODELS;
  let lastError = "no_model";
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: `You are a careful ${isKr ? "Korean" : "US"} stock event analyst. Identify the strongest dated catalyst from supplied evidence, compare it with the broad market, answer only in Korean, and never invent facts.` },
          { role: "user", content: prompt },
        ],
        max_tokens: 700,
        temperature: 0.2,
      });
      const text = String((result && result.response) || "").trim();
      if (text) return { text, error: "", model };
      lastError = `empty_response:${model}`;
    } catch (error) {
      lastError = `${model}: ${(error && error.message) || error}`;
    }
  }
  return { text: "", error: lastError };
}
async function summarizeKorean(env, ticker, news, modelOverride, isKr = false) {
  if (!env || !env.AI) return { text: "", error: "no_ai_binding" };
  if (!news || !news.length) return { text: "", error: "no_news" };
  const models = modelOverride ? [modelOverride] : SUMMARY_MODELS;
  const headlines = news
    .slice(0, 8)
    .map((n, i) => `${i + 1}. ${n.title}${n.publisher ? ` (${n.publisher})` : ""}`)
    .join("\n");
  const marketLabel = isKr ? "국내(한국)" : "미국";
  const properNounRule = isKr
    ? "- 회사명·제품명 등 고유명사는 뉴스에 나온 한국어 표기를 그대로 사용하세요.\n- 숫자 종목코드(예: 005930, 005930.KS)는 문장에 쓰지 말고 회사명으로 부르세요.\n"
    : "- 회사명, 제품명, 매체명 등 고유명사는 영어 원문 그대로 두세요(억지로 음역하지 마세요).\n";
  const prompt =
    // 국내는 숫자 코드를 주어로 주면 요약문에 '005930.KS의 …' 가 그대로 나온다(2026-09-16).
    `${marketLabel} 주식 ${isKr ? "(헤드라인 속 회사)" : ticker}의 최신 뉴스 헤드라인:\n\n${headlines}\n\n` +
    `위 헤드라인들을 종합해서 핵심 흐름을 한국어 3~4문장의 자연스러운 단락 하나로 요약하세요.\n` +
    `규칙:\n` +
    `- 헤드라인을 하나씩 번역하거나 번호로 나열하지 마세요. 반드시 하나의 단락으로 종합하세요.\n` +
    properNounRule +
    `- 투자 조언은 하지 말고 사실 위주로 쓰세요.\n` +
    `- 한국어 단락만 출력하고 다른 말은 덧붙이지 마세요.`;
  let lastError = "no_model";
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "You are a financial news summarizer. Synthesize the headlines into ONE natural Korean paragraph (3-4 sentences). Never translate or list headlines one by one. Keep proper nouns in English." },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.3,
      });
      const text = String((result && result.response) || "").trim();
      if (text) return { text, error: "", model };
      lastError = `empty_response:${model}`;
    } catch (e) {
      lastError = `${model}: ${(e && e.message) || e}`;
    }
  }
  return { text: "", error: lastError };
}

function isKoreanTicker(ticker) {
  return /\.(KS|KQ)$/i.test(String(ticker || ""));
}

// Yahoo quoteSummary now requires session cookies + crumb (otherwise 401 → earnings null).
let yahooSession = { cookie: "", crumb: "", at: 0, strategy: "basic" };
const YAHOO_SESSION_TTL_MS = 20 * 60 * 1000;
// 부트스트랩 실패 음성 캐시(감사 P1-1). 2026-09-15 라이브에서 crumb 발급이 전면
// 실패했는데(cookieLen 0) 실패를 기억하지 않아, ?ticker= 한 번에 fc.yahoo.com →
// finance.yahoo.com → getcrumb → guce consent 3종 → getcrumb 를 종목마다 새로 태웠다
// (무료 플랜 서브리퀘스트 상한 50 에 30회 이상, 응답 3.5초). 실패하면 5분간 재시도를
// 멈추고, 그 사이 crumb 이 필요한 경로는 즉시 포기한다.
const YAHOO_SESSION_FAIL_TTL_MS = 5 * 60 * 1000;
let yahooSessionFailedUntil = 0;
// 같은 isolate 안에서 여러 요청이 동시에 부트스트랩하지 않도록 한 번만 돌린다.
let yahooSessionInflight = null;

// crumb 이 없고 음성 캐시가 살아 있는 상태 — 추가 fetch 없이 포기해야 하는 구간.
export function yahooSessionBlocked(now = Date.now()) {
  return !yahooSession.crumb && now < yahooSessionFailedUntil;
}

// 테스트용 초기화(모듈 전역이라 케이스 사이에 남으면 서로 간섭한다).
export function resetYahooSessionState() {
  yahooSession = { cookie: "", crumb: "", at: 0, strategy: "basic" };
  yahooSessionFailedUntil = 0;
  yahooSessionInflight = null;
}

function cookiesFromResponse(response) {
  const parts = [];
  const push = (line) => {
    const head = String(line || "").split(";")[0].trim();
    if (!head || !head.includes("=")) return;
    const name = head.slice(0, head.indexOf("="));
    if (!parts.some((item) => item.startsWith(`${name}=`))) parts.push(head);
  };
  if (typeof response.headers.getSetCookie === "function") {
    response.headers.getSetCookie().forEach(push);
  }
  const legacy = response.headers.get("Set-Cookie");
  if (legacy) push(legacy);
  return parts;
}

function mergeCookieHeader(existing, response) {
  const jar = new Map();
  String(existing || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    });
  cookiesFromResponse(response).forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > 0) jar.set(part.slice(0, idx), part.slice(idx + 1));
  });
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function normalizeEarningsDateValue(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if (typeof value.fmt === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.fmt)) return value.fmt.slice(0, 10);
    if (typeof value.raw === "number") return normalizeEarningsDateValue(value.raw);
  }
  return null;
}

// getcrumb 은 text/plain 을 준다 — UA 의 Accept: application/json 을 그대로 보내면 406 Not Acceptable 이다
// (2026-10-21 실측: 같은 쿠키로 Accept json → 406, */* → 200). 2026-09-15 부터의 'crumb 발급 실패'의 한 원인.
export function crumbHeaders(cookie) {
  return { "User-Agent": UA["User-Agent"], Accept: "*/*", Cookie: cookie };
}

async function bootstrapYahooSessionBasic() {
  // fc.yahoo.com returns 404 but still sets the A3 session cookie Yahoo requires.
  let cookie = "";
  for (const url of ["https://fc.yahoo.com", "https://finance.yahoo.com/"]) {
    try {
      const response = await fetchT(url, { headers: UA, redirect: "follow" });
      cookie = mergeCookieHeader(cookie, response);
      if (cookie) break;
    } catch (_) { /* try next bootstrap URL */ }
  }
  if (!cookie) return null;
  const crumbResponse = await fetchT("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: crumbHeaders(cookie),
    redirect: "follow",
  });
  const crumb = String(await crumbResponse.text() || "").trim();
  if (!crumbResponse.ok || !crumb || crumb.includes("<html>")) return null;
  return { cookie, crumb, strategy: "basic", at: Date.now() };
}

async function bootstrapYahooSessionCsrf() {
  let cookie = "";
  try {
    const consent = await fetchT("https://guce.yahoo.com/consent", { headers: UA, redirect: "follow" });
    cookie = mergeCookieHeader(cookie, consent);
    const body = await consent.text();
    const csrfMatch = body.match(/name="csrfToken"\s+value="([^"]+)"/);
    const sessionMatch = body.match(/name="sessionId"\s+value="([^"]+)"/);
    if (csrfMatch && sessionMatch) {
      const form = new URLSearchParams({
        agree: "agree",
        consentUUID: "default",
        sessionId: sessionMatch[1],
        csrfToken: csrfMatch[1],
        originalDoneUrl: "https://finance.yahoo.com/",
        namespace: "yahoo",
      });
      const post = await fetchT(`https://consent.yahoo.com/v2/collectConsent?sessionId=${encodeURIComponent(sessionMatch[1])}`, {
        method: "POST",
        headers: { ...UA, Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        redirect: "follow",
      });
      cookie = mergeCookieHeader(cookie, post);
      const copy = await fetchT(`https://guce.yahoo.com/copyConsent?sessionId=${encodeURIComponent(sessionMatch[1])}`, {
        headers: { ...UA, Cookie: cookie },
        redirect: "follow",
      });
      cookie = mergeCookieHeader(cookie, copy);
    }
    const finance = await fetchT("https://finance.yahoo.com/", { headers: { ...UA, Cookie: cookie }, redirect: "follow" });
    cookie = mergeCookieHeader(cookie, finance);
  } catch (_) {
    return null;
  }
  if (!cookie) return null;
  const crumbResponse = await fetchT("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: crumbHeaders(cookie),
    redirect: "follow",
  });
  const crumb = String(await crumbResponse.text() || "").trim();
  if (!crumbResponse.ok || !crumb || crumb.includes("<html>")) return null;
  return { cookie, crumb, strategy: "csrf", at: Date.now() };
}

async function ensureYahooSession(force = false) {
  if (!force && yahooSession.crumb && Date.now() - yahooSession.at < YAHOO_SESSION_TTL_MS) {
    return yahooSession;
  }
  // 직전 부트스트랩이 실패했으면 TTL 동안은 그대로 포기한다(재시도 폭주 방지).
  if (yahooSessionBlocked()) return yahooSession;
  // 이미 누가 부트스트랩 중이면 그 결과를 같이 기다린다(중복 서브리퀘스트 제거).
  if (yahooSessionInflight) return yahooSessionInflight;
  yahooSessionInflight = (async () => {
    try {
      const next = (await bootstrapYahooSessionBasic()) || (await bootstrapYahooSessionCsrf());
      if (next) {
        yahooSession = next;
        yahooSessionFailedUntil = 0;
      } else {
        yahooSession = { cookie: "", crumb: "", at: 0, strategy: "basic" };
        yahooSessionFailedUntil = Date.now() + YAHOO_SESSION_FAIL_TTL_MS;
      }
      return yahooSession;
    } catch (e) {
      yahooSession = { cookie: "", crumb: "", at: 0, strategy: "basic" };
      yahooSessionFailedUntil = Date.now() + YAHOO_SESSION_FAIL_TTL_MS;
      return yahooSession;
    } finally {
      yahooSessionInflight = null;
    }
  })();
  return yahooSessionInflight;
}

function yahooAuthedInit(session, method, body) {
  const init = {
    method,
    headers: { ...UA, Cookie: session.cookie },
  };
  if (body != null) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return init;
}

async function yahooAuthedFetch(url, { forceAuth = false, method = "GET", body = null } = {}) {
  let session = await ensureYahooSession(forceAuth);
  if (!session.crumb) return null;
  const joiner = url.includes("?") ? "&" : "?";
  const authedUrl = `${url}${joiner}crumb=${encodeURIComponent(session.crumb)}`;
  let response = await fetchT(authedUrl, yahooAuthedInit(session, method, body));
  if (response.status === 401 || response.status === 403) {
    session = await ensureYahooSession(true);
    if (!session.crumb) return response;
    response = await fetchT(
      `${url}${joiner}crumb=${encodeURIComponent(session.crumb)}`,
      yahooAuthedInit(session, method, body),
    );
  }
  return response;
}

// Korean-language headlines from Naver's mobile stock news API. One representative
// article per news cluster keeps the list diverse. Mirrors fetch_naver_news() in
// scripts/update_korea_data.py so live and build-time news stay consistent.
async function fetchNaverNews(ticker) {
  const code = String(ticker || "").replace(/\.(KS|KQ)$/i, "").replace(/[^0-9A-Za-z]/g, "");
  if (!code) return [];
  try {
    const r = await fetchT(
      `https://m.stock.naver.com/api/news/stock/${encodeURIComponent(code)}?pageSize=8&page=1`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: "https://m.stock.naver.com/" } }
    );
    if (!r.ok) return [];
    const clusters = await r.json();
    const out = [];
    const seen = new Set();
    for (const cluster of Array.isArray(clusters) ? clusters : []) {
      for (const item of (cluster.items || [])) {
        const title = decodeXmlText(String(item.titleFull || item.title || ""));
        const link = String(item.mobileNewsUrl || "").trim();
        if (!title || !link || seen.has(title)) continue;
        seen.add(title);
        const dt = String(item.datetime || "");
        const publishedAt = dt.length >= 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : "";
        out.push({ title, publisher: decodeXmlText(String(item.officeName || "")), link, publishedAt });
        break; // one representative article per cluster
      }
      if (out.length >= 8) break;
    }
    return out;
  } catch (e) {
    return [];
  }
}

// 야후 search 는 종목 뉴스가 아니라 '일반 시장 뉴스' 를 준다. NVDA 를 물으면
// Abbott·IBM·Buffett 기사가 나와서 8건 중 1건만 관련 있었다.
//
// Finnhub company-news 로 바꾸는 것만으론 안 고쳐진다 — 실측해 보니 그쪽도 최근
// 2일치 신디케이트 피드를 최신순으로 249건 쏟아내서, 앞 8건만 자르면 NVDA 와
// AAPL 이 똑같은 Buffett 기사를 받는다. 관련 기사는 그 안에 섞여 있다(NVDA 53건).
// 그래서 정렬이 아니라 '필터' 가 핵심이다.
//
// related 필드는 못 쓴다. 249건 전부 related=NVDA 로 와서 신호가 없다.
// 헤드라인+요약에서 티커를 직접 찾는다. 실측 수확: NVDA 14 · AAPL 33 · JPM 47 ·
// KO 31 · ETN 14 · CEG 13 — 필요한 8건보다 넉넉하고, 회사명 없이도 된다
// (일반 뉴스 경로는 company 파라미터를 안 받는다).
const FINNHUB_NEWS_WANTED = 8;

function tickerMentionRegex(plain) {
  const esc = plain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // KO·GE 같은 2글자 티커는 소문자까지 허용하면 평범한 단어에 걸린다 — 대문자로만 본다.
  return new RegExp(`\\b${esc}\\b`, plain.length <= 2 ? "" : "i");
}

async function fetchNewsFromFinnhub(env, symbol) {
  const token = env && env.FINNHUB_API_KEY;
  if (!token) return [];
  const plain = String(symbol || "").replace(/\.(KS|KQ)$/i, "").replace(/-/g, ".");
  if (!plain) return [];
  const to = new Date();
  const from = new Date(to.getTime() - 14 * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  try {
    const r = await fetchT(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(plain)}` +
        `&from=${iso(from)}&to=${iso(to)}`,
      { headers: { ...UA, "X-Finnhub-Token": token } }
    );
    if (!r.ok) return [];
    const rows = await r.json();
    if (!Array.isArray(rows)) return [];
    const mapped = rows
      .map((n) => ({
        title: n.headline || "",
        publisher: n.source || "",
        link: n.url || "",
        summary: n.summary || "",
        publishedAt: n.datetime
          ? new Date(n.datetime * 1000).toISOString().slice(0, 10)
          : "",
      }))
      .filter((n) => n.title && n.link);
    const re = tickerMentionRegex(plain);
    const hits = mapped.filter((n) => re.test(`${n.title} ${n.summary}`));
    // 티커를 한 번도 안 쓰고 회사명만 쓴 기사가 많은 종목이면 수확이 적을 수 있다.
    // 그럴 땐 거른 것보다 원본 순서가 낫다고 보고 필터를 포기한다(3건 미만일 때만).
    return (hits.length >= 3 ? hits : mapped).slice(0, FINNHUB_NEWS_WANTED);
  } catch (e) {
    return [];
  }
}

async function fetchNewsFromYahoo(symbol) {
  try {
    const r = await fetchT(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}` +
        `&newsCount=8&quotesCount=0&enableFuzzyQuery=false`,
      { headers: UA }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.news || [])
      .slice(0, 8)
      .map((n) => ({
        title: n.title || "",
        publisher: n.publisher || "",
        link: n.link || "",
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toISOString().slice(0, 10)
          : "",
      }))
      .filter((n) => n.title && n.link);
  } catch (e) {
    return [];
  }
}

async function fetchNews(env, symbol) {
  const finnhub = await fetchNewsFromFinnhub(env, symbol);
  if (finnhub.length) return finnhub;
  return fetchNewsFromYahoo(symbol);
}

// 서브리퀘스트 예산. Workers 무료 플랜은 요청당 50 서브리퀘스트가 상한이고,
// earnings 배치는 티커마다 quoteSummary 2회 + visualization 1회까지 쓴다.
// 예산을 다 쓰면 남은 티커는 호출하지 않고 건너뛴다(감사 P2-6).
const EARNINGS_CALENDAR_SUBREQUEST_BUDGET = 30;

function subrequestBudget(left) {
  return { left };
}

function budgetTake(budget, n = 1) {
  if (!budget) return true;
  if (budget.left < n) return false;
  budget.left -= n;
  return true;
}

async function fetchEarningsFromVisualization(symbol, budget = null) {
  if (!budgetTake(budget)) return null;
  const plain = String(symbol || "").replace(/\.(KS|KQ)$/i, "");
  const r = await yahooAuthedFetch(
    "https://query1.finance.yahoo.com/v1/finance/visualization?lang=en-US&region=US",
    {
      method: "POST",
      body: {
        size: 16,
        query: { operator: "eq", operands: ["ticker", plain] },
        sortField: "startdatetime",
        sortType: "DESC",
        entityIdType: "earnings",
        includeFields: ["startdatetime", "epsestimate", "epsactual", "epssurprisepct", "eventtype"],
      },
    },
  );
  if (!r || !r.ok) return null;
  const data = await r.json();
  const rows = data?.finance?.result?.[0]?.documents?.[0]?.rows || [];
  const today = new Date().toISOString().slice(0, 10);
  let nextDate = null;
  let epsEstimate = null;
  const history = [];
  rows.forEach((row) => {
    const iso = normalizeEarningsDateValue(row[0]);
    if (!iso) return;
    const est = row[2] != null && Number.isFinite(Number(row[2])) ? Number(row[2]) : null;
    const actual = row[3] != null && Number.isFinite(Number(row[3])) ? Number(row[3]) : null;
    const eventType = String(row[5] || "");
    if (actual != null) {
      history.push({
        date: iso,
        epsActual: actual,
        epsEstimate: est,
        surprisePct: row[4] != null && Number.isFinite(Number(row[4])) ? Number(row[4]) : null,
      });
    }
    if (!nextDate && iso >= today && actual == null && (eventType === "2" || eventType === "1" || eventType === "11")) {
      nextDate = iso;
      epsEstimate = est;
    }
  });
  if (!nextDate) return null;
  return { nextDate, dates: [nextDate], epsEstimate, history: history.slice(0, 8) };
}

async function fetchEarnings(symbol, budget = null) {
  // crumb 이 없으면 quoteSummary 도 visualization 도 401 이다 — 부를수록 서브리퀘스트만
  // 태우므로 즉시 null 로 끝낸다(감사 P1-1). 부트스트랩 자체도 음성 캐시가 막는다.
  const session = await ensureYahooSession();
  if (!session.crumb) return null;
  try {
    const summaryUrl =
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
      `?modules=calendarEvents,earningsHistory,defaultKeyStatistics`;
    if (!budgetTake(budget)) return null;
    let r = await yahooAuthedFetch(summaryUrl);
    if (!r || !r.ok) {
      if (!budgetTake(budget)) return null;
      r = await yahooAuthedFetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,earningsHistory,defaultKeyStatistics`,
      );
    }
    if (!r || !r.ok) return await fetchEarningsFromVisualization(symbol, budget);
    const data = await r.json();
    const result = (data && data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result[0]) || {};
    const cal = (result.calendarEvents && result.calendarEvents.earnings) || {};
    const dates = (cal.earningsDate || [])
      .map((ts) => normalizeEarningsDateValue(ts))
      .filter(Boolean);
    const epsEstimate = cal.epsEstimate && cal.epsEstimate.raw != null
      ? cal.epsEstimate.raw
      : (cal.epsEstimate != null ? cal.epsEstimate : null);
    const history = ((result.earningsHistory && result.earningsHistory.history) || [])
      .slice(0, 8)
      .map((row) => {
        const quarter = (row.quarter && row.quarter.fmt) || row.period || "";
        let date = "";
        if (row.quarter && row.quarter.raw != null) {
          const d = new Date(row.quarter.raw * 1000);
          date = Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
        } else if (/^\d{4}-\d{2}-\d{2}/.test(quarter)) {
          date = quarter.slice(0, 10);
        }
        return {
          date,
          quarter,
          epsActual: row.epsActual && row.epsActual.raw != null ? row.epsActual.raw : null,
          epsEstimate: row.epsEstimate && row.epsEstimate.raw != null ? row.epsEstimate.raw : null,
          surprisePct: row.surprisePercent && row.surprisePercent.raw != null ? row.surprisePercent.raw : null,
        };
      });
    const payload = {
      nextDate: dates[0] || null,
      dates,
      epsEstimate,
      history,
    };
    if (!payload.nextDate) return await fetchEarningsFromVisualization(symbol, budget);
    return payload;
  } catch (e) {
    return await fetchEarningsFromVisualization(symbol, budget);
  }
}

// ── ?ticker= 실적: 야후 → 발행된 실적 캘린더 폴백 ──────────────────────────────
// 2026-09-15 부터 야후 crumb 발급이 막혀 라이브 ?ticker=NVDA 의 earnings 가 계속
// null 이었다(2026-09-16 재감사). 음성 캐시는 호출 낭비만 줄였을 뿐 데이터를 되살리지
// 못했다. 야후가 실패하면 GitHub Actions 가 yfinance 로 만들어 Pages 에 올리는
// data/earnings_calendar.json(다음 실적일·EPS 예상)과 data/details/<T>.json 의
// earningsHistory(지난 서프라이즈)로 채운다. 그래도 없으면 earnings 는 null 로 두되
// earningsStatus 로 '데이터 없음' 을 명시한다 — null 하나로는 "실패" 와 "원래 없음" 을
// 구분할 수 없었다. (earnings 를 빈 객체로 바꾸지 않는 이유: 프론트가 truthy 면
// 라이브 값으로 캐시해 정적 캘린더 폴백을 가린다.)
export const MIR_PAGES_DATA_BASE = "https://seonu-dragon.github.io/Mir_US_Stocks/data";
// 종목 상세(details)를 R2 로 옮겼을 때의 공개 URL(프론트 details-source.js 의 detailsBase 와 같은 값,
// 끝 슬래시 없이). 비어 있으면 지금처럼 Pages 만 읽는다. 채우면 R2 를 먼저 보고 실패 시 Pages.
// Pages 스테이징에서 details 를 빼기 전에(DEPLOY.md 'R2 종목 상세' 3단계) 채워서 워커를 다시
// 붙여넣어야 실적 이력 폴백이 끊기지 않는다.
export const MIR_DETAILS_BASE = "";
const PUBLISHED_EARNINGS_TTL_MS = 30 * 60 * 1000;
let publishedEarningsMemo = { at: 0, rows: null };

export function resetPublishedEarningsMemo() {
  publishedEarningsMemo = { at: 0, rows: null };
}

async function loadPublishedEarningsCalendar() {
  if (publishedEarningsMemo.rows && Date.now() - publishedEarningsMemo.at < PUBLISHED_EARNINGS_TTL_MS) {
    return publishedEarningsMemo.rows;
  }
  try {
    const r = await fetchT(`${MIR_PAGES_DATA_BASE}/earnings_calendar.json`, { headers: { Accept: "application/json" } });
    if (!r.ok) return publishedEarningsMemo.rows;
    const data = await r.json();
    const rows = Array.isArray(data?.earnings) ? data.earnings : [];
    publishedEarningsMemo = { at: Date.now(), rows };
    return rows;
  } catch (e) {
    return publishedEarningsMemo.rows;
  }
}

async function loadPublishedEarningsHistory(ticker) {
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) return [];
  try {
    const rel = `details/${encodeURIComponent(ticker)}.json`;
    const urls = MIR_DETAILS_BASE
      ? [`${MIR_DETAILS_BASE.replace(/\/+$/, "")}/data/${rel}`, `${MIR_PAGES_DATA_BASE}/${rel}`]
      : [`${MIR_PAGES_DATA_BASE}/${rel}`];
    let r = null;
    for (const url of urls) {
      r = await fetchT(url, { headers: { Accept: "application/json" } }).catch(() => null);
      if (r && r.ok) break;
    }
    if (!r || !r.ok) return [];
    const data = await r.json();
    const rows = Array.isArray(data?.earningsHistory) ? data.earningsHistory : [];
    // 최신이 앞(야후 경로와 같은 순서), 8개까지.
    return rows
      .filter((row) => row && row.date)
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8)
      .map((row) => ({
        date: row.date,
        epsActual: Number.isFinite(Number(row.epsActual)) ? Number(row.epsActual) : null,
        epsEstimate: Number.isFinite(Number(row.epsEstimate)) ? Number(row.epsEstimate) : null,
        surprisePct: Number.isFinite(Number(row.surprisePct)) ? Number(row.surprisePct) : null,
      }));
  } catch (e) {
    return [];
  }
}

export async function resolveTickerEarnings(ticker, symbol, kr) {
  const live = await fetchEarnings(symbol).catch(() => null);
  if (live && live.nextDate) {
    return { earnings: live, status: { state: "ok", source: "yahoo" } };
  }
  // 국내는 실적 예정일 소스가 없다(market_config.js features.earningsCalendar=false).
  if (kr) {
    return { earnings: null, status: { state: "unavailable", source: null, reason: "kr_no_earnings_source" } };
  }
  const key = String(ticker || "").toUpperCase();
  const [rows, history] = await Promise.all([
    loadPublishedEarningsCalendar(),
    loadPublishedEarningsHistory(key),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const row = (rows || []).find((r) => String(r?.ticker || "").toUpperCase() === key);
  const nextDate = row && typeof row.nextDate === "string" && row.nextDate >= today ? row.nextDate : null;
  if (nextDate || history.length) {
    return {
      earnings: {
        nextDate,
        dates: nextDate ? [nextDate] : [],
        epsEstimate: nextDate && row.epsEstimate != null && Number.isFinite(Number(row.epsEstimate)) ? Number(row.epsEstimate) : null,
        history,
      },
      status: {
        state: nextDate ? "fallback" : "partial",
        source: "mir-published",
        reason: live ? "yahoo_no_next_date" : "yahoo_unavailable",
        ...(nextDate ? {} : { note: "다음 실적일 데이터 없음" }),
      },
    };
  }
  return {
    earnings: null,
    status: { state: "unavailable", source: null, reason: live ? "yahoo_no_next_date" : "yahoo_unavailable", note: "실적 데이터 없음" },
  };
}

async function fetchEarningsCalendar(tickers) {
  const out = [];
  // crumb 세션이 죽어 있으면 배치 전체가 401 이다 — 티커당 세 번씩 두드리지 않고 끝낸다.
  const session = await ensureYahooSession();
  if (!session.crumb) return out;
  const budget = subrequestBudget(EARNINGS_CALENDAR_SUBREQUEST_BUDGET);
  const batchSize = 8;
  for (let i = 0; i < tickers.length; i += batchSize) {
    if (budget.left <= 0) break;
    const batch = tickers.slice(i, i + batchSize);
    const chunk = await Promise.all(batch.map(async (ticker) => {
      // Korean tickers keep the dot for Yahoo (005930.KS); US class shares use dashes.
      const symbol = isKoreanTicker(ticker) ? ticker : ticker.replace(/\./g, "-");
      const data = await fetchEarnings(symbol, budget);
      if (!data || !data.nextDate) return null;
      return { ticker, nextDate: data.nextDate, epsEstimate: data.epsEstimate };
    }));
    chunk.filter(Boolean).forEach((row) => out.push(row));
  }
  out.sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)));
  return out;
}

// 장 상태 + 프리/애프터마켓(미국). v7/finance/quote 는 세션 쿠키·crumb 이 있어야 200 이라
// yahooAuthedFetch 를 쓴다. 정규장(REGULAR)이나 데이터가 없으면 세션 시세 없이 상태만 준다.
export function parseQuoteState(data) {
  const q = data && data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result[0];
  if (!q) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
  const state = String(q.marketState || "").toUpperCase();
  const out = { marketState: state || null, regular: num(q.regularMarketPrice), regularChangePct: num(q.regularMarketChangePercent) };
  if (/^PRE/.test(state) && q.preMarketPrice != null) {
    out.session = "pre";
    out.price = num(q.preMarketPrice);
    out.changePct = num(q.preMarketChangePercent);
    out.time = q.preMarketTime ? new Date(q.preMarketTime * 1000).toISOString() : null;
  } else if (/^(POST|CLOSED)/.test(state) && q.postMarketPrice != null) {
    out.session = "post";
    out.price = num(q.postMarketPrice);
    out.changePct = num(q.postMarketChangePercent);
    out.time = q.postMarketTime ? new Date(q.postMarketTime * 1000).toISOString() : null;
  }
  return out;
}

// crumb 없이도 되는 폴백: v8 chart(range=1d, includePrePost) 의 마지막 봉이 정규장 밖(pre/post
// 구간)에 찍혀 있으면 그 종가가 세션 시세다. 정규장 종가(regularMarketPrice) 대비 등락을 계산한다.
// 라이브에서 v7 quote 가 401(세션/crumb 실패)이라 quote 가 null 로 나오던 문제의 실제 해법(2026-09-06).
export function parseQuoteStateFromChart(data, nowMs = Date.now(), maxAgeMs = 18 * 3600 * 1000) {
  const res = data && data.chart && data.chart.result && data.chart.result[0];
  if (!res || !res.meta) return null;
  const meta = res.meta;
  const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
  const out = { marketState: null, regular: num(meta.regularMarketPrice), regularChangePct: num(meta.regularMarketChangePercent) };
  const ts = res.timestamp || [];
  const closes = ((res.indicators && res.indicators.quote && res.indicators.quote[0]) || {}).close || [];
  let lastIdx = -1;
  for (let i = ts.length - 1; i >= 0; i -= 1) { if (closes[i] != null) { lastIdx = i; break; } }
  if (lastIdx < 0) return out;
  const lastTs = ts[lastIdx];
  const lastClose = closes[lastIdx];
  const periods = meta.currentTradingPeriod || {};
  const within = (p) => p && Number.isFinite(p.start) && Number.isFinite(p.end) && lastTs >= p.start && lastTs < p.end;
  const regularEnd = periods.regular && periods.regular.end;
  const regularStart = periods.regular && periods.regular.start;
  let session = null;
  if (within(periods.post) || (regularEnd && lastTs >= regularEnd)) session = "post";
  else if (within(periods.pre) || (regularStart && lastTs < regularStart)) session = "pre";
  if (session === "post") out.marketState = "POST";
  else if (session === "pre") out.marketState = "PRE";
  else out.marketState = "REGULAR";
  const ageOk = nowMs - lastTs * 1000 <= maxAgeMs;
  if (!session || !ageOk) return out;
  // 프리마켓은 전일 종가(= 이 시점의 regularMarketPrice) 대비, 애프터는 당일 정규장 종가 대비
  const ref = Number(meta.regularMarketPrice);
  const price = Number(lastClose);
  if (!Number.isFinite(price) || !Number.isFinite(ref) || ref <= 0) return out;
  out.session = session;
  out.price = num(price);
  out.changePct = num((price / ref - 1) * 100);
  out.time = new Date(lastTs * 1000).toISOString();
  return out;
}

async function fetchQuoteStateFromChart(symbol) {
  try {
    const r = await fetchT(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=true`,
      { headers: UA }
    );
    if (!r.ok) return null;
    return parseQuoteStateFromChart(await r.json());
  } catch (e) {
    return null;
  }
}

async function fetchQuoteState(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}` +
      `&fields=marketState,regularMarketPrice,regularMarketChangePercent,preMarketPrice,preMarketChangePercent,preMarketTime,postMarketPrice,postMarketChangePercent,postMarketTime`;
    const r = await yahooAuthedFetch(url);
    if (r && r.ok) {
      const parsed = parseQuoteState(await r.json());
      if (parsed) return parsed;
    }
  } catch (e) {
    /* v7 은 세션/crumb 이 자주 막힌다 — 아래 chart 폴백으로 */
  }
  return fetchQuoteStateFromChart(symbol);
}

// ----- 분봉(종목 차트) -----
// 야후 분봉은 간격마다 거슬러 받을 수 있는 기간이 다르다(1분 ≤ 7일, 2~30분 ≤ 60일, 60분 ≤ 730일).
// 3분·10분은 화면이 1분·5분을 묶어 만든다(야후에 없는 간격).
export const INTRADAY_RANGE = { "1m": "5d", "5m": "1mo", "15m": "1mo", "30m": "1mo", "60m": "6mo" };

// 야후 chart result → [[o, h, l, c, v, "YYYY-MM-DDTHH:MM"(거래소 현지 시각)]]. 종가 없는 봉은 뺀다.
export function parseIntradayChart(result) {
  const ts = (result && result.timestamp) || [];
  const q = (result && result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  const tz = (result && result.meta && result.meta.exchangeTimezoneName) || "America/New_York";
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  } catch (e) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }
  const local = (sec) => {
    const p = {};
    for (const part of fmt.formatToParts(new Date(sec * 1000))) p[part.type] = part.value;
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  const out = [];
  for (let i = 0; i < ts.length; i += 1) {
    const c = q.close ? q.close[i] : null;
    if (c == null || !Number.isFinite(Number(c))) continue;
    const pick = (arr) => (arr && arr[i] != null && Number.isFinite(Number(arr[i])) ? arr[i] : c);
    out.push([round(pick(q.open)), round(pick(q.high)), round(pick(q.low)), round(c), Math.round((q.volume && q.volume[i]) || 0), local(ts[i])]);
  }
  return { bars: out, tz };
}

async function handleIntraday(request, symbol, rawInterval) {
  const interval = INTRADAY_RANGE[rawInterval] ? rawInterval : "5m";
  const range = INTRADAY_RANGE[interval];
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheReq = new Request(`https://mir-intraday.cache/${encodeURIComponent(symbol)}/${interval}`);
  if (cache) {
    const hit = await cache.match(cacheReq);
    if (hit) return hit;
  }
  let payload;
  try {
    const r = await fetchT(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
      { headers: UA },
    );
    if (!r.ok) return json({ error: "upstream", status: r.status, bars: [] }, 502, 0);
    const data = await r.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) return json({ error: "no_data", bars: [] }, 404, 60);
    const { bars, tz } = parseIntradayChart(result);
    payload = { symbol, interval, range, tz, bars, updatedAt: new Date().toISOString() };
    // 국내는 야후 분봉이 약 20분 늦고 종가 동시호가(15:20~15:30)가 빠진다 — 종목 분석 '현재' 줄용으로
    // 네이버 실시간 현재가와 네이버 일봉의 전 거래일 종가를 같이 싣는다(live-quote-core.js).
    if (isKoreanTicker(symbol)) payload.quote = await fetchNaverLiveQuote(symbol);
  } catch (e) {
    return json({ error: "upstream", bars: [] }, 502, 0);
  }
  const resp = json(payload, 200, 60);
  if (cache) await cache.put(cacheReq, resp.clone());
  return resp;
}

// 네이버 실시간 시세(KRX). 전일 종가는 시세의 '전일 대비'에서 거꾸로 푼다 — 네이버 일봉 API(chart/day ·
// fchart · siseJson)는 2026-09-14 부터 장 마감 뒤 NXT 거래까지 합친 통합 종가라 KRX 종가와 다르다
// (삼성전자 10/01: KRX 276,000 = 다음·야후 · 네이버 일봉 274,500). basic 의 closePrice·compareToPreviousClosePrice
// 는 KRX 기준이고 NXT 가격은 overMarketPriceInfo 로 따로 온다. 실패하면 null(화면은 분봉으로 계산한다).
const NAVER_RISE_CODES = new Set(["1", "2"]);   // 상한·상승
const NAVER_FALL_CODES = new Set(["4", "5"]);   // 하한·하락
export function parseNaverBasicQuote(basic) {
  const num = (v) => Number(String(v == null ? "" : v).replace(/,/g, ""));
  const price = num(basic && basic.closePrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const diff = Math.abs(num(basic.compareToPreviousClosePrice));
  const code = String((basic.compareToPreviousPrice && basic.compareToPreviousPrice.code) || "");
  const sign = NAVER_RISE_CODES.has(code) ? 1 : NAVER_FALL_CODES.has(code) ? -1 : 0;
  const prevClose = Number.isFinite(diff) ? price - sign * diff : null;
  const localTime = String(basic.localTradedAt || "");
  return {
    price, prevClose, localTime,
    time: localTime ? new Date(localTime).toISOString() : new Date().toISOString(),
    marketState: String(basic.marketStatus || "").toUpperCase(),
    source: "naver",
  };
}

export async function fetchNaverLiveQuote(symbol) {
  const code = String(symbol || "").replace(/\.(KS|KQ)$/i, "").replace(/[^0-9A-Za-z]/g, "");
  if (!code) return null;
  try {
    const r = await fetchT(`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/basic`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: "https://m.stock.naver.com/" } }, 4000);
    if (!r.ok) return null;
    return parseNaverBasicQuote(await r.json());
  } catch (e) {
    return null;
  }
}

// ----- 큰 등락일 전후 뉴스(차트 툴팁) -----
// 그날 ±2일 기사 최대 5건. 제목·출처·날짜·링크만 준다(요약·해석 없음).
// move_analysis 의 수집(±2일 → 부족하면 ±7일, 소스 순차, 각 8초)을 그대로 쓰면 Cloudflare 에서 구글 뉴스·
// GDELT 가 시간 초과로 끝나 첫 응답이 30초 걸리고 0건이었다(2026-10-01 라이브). 여기서는 ±2일 한 번만,
// 소스를 동시에 5초 제한으로 부르고, 소스별 결과(diag)를 응답에 실어 어느 소스가 막히는지 보이게 한다.
const EVENT_NEWS_TIMEOUT_MS = 5000;

async function eventNewsSource(name, run) {
  const t0 = Date.now();
  try {
    const out = await run();
    if (out && out.status) return { name, items: [], diag: `${out.status} ${Date.now() - t0}ms` };
    const items = Array.isArray(out) ? out : [];
    return { name, items, diag: `ok ${items.length} ${Date.now() - t0}ms` };
  } catch (e) {
    return { name, items: [], diag: `${e && e.name === "AbortError" ? "timeout" : "error"} ${Date.now() - t0}ms` };
  }
}

async function eventNewsGoogle(ticker, company, from, to, isKr) {
  const after = shiftIsoDate(from, -1);
  const before = shiftIsoDate(to, 1);
  const term = String(company || "").trim();
  const query = isKr
    ? `"${term || ticker}" after:${after} before:${before}`
    : `${term && term.toUpperCase() !== ticker ? `("${term}" OR "${ticker}")` : `"${ticker}"`} stock after:${after} before:${before}`;
  const loc = isKr ? "hl=ko&gl=KR&ceid=KR:ko" : "hl=en-US&gl=US&ceid=US:en";
  const r = await fetchT(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`,
    { headers: { ...UA, Accept: "application/rss+xml, application/xml, text/xml" } }, EVENT_NEWS_TIMEOUT_MS);
  if (!r.ok) return { status: `http ${r.status}` };
  return parseGoogleNewsRss(await r.text());
}

async function eventNewsGdelt(ticker, company, from, to) {
  const term = String(company || "").trim();
  const query = term && term.toUpperCase() !== ticker ? `"${term}" OR "${ticker}"` : `"${ticker}"`;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=50&format=json&sort=HybridRel&startdatetime=${from.replace(/-/g, "")}000000&enddatetime=${to.replace(/-/g, "")}235959`;
  const r = await fetchT(url, { headers: UA }, EVENT_NEWS_TIMEOUT_MS);
  if (!r.ok) return { status: `http ${r.status}` };
  const text = await r.text();
  let payload;
  try { payload = JSON.parse(text); } catch (e) { return { status: "not_json" }; } // 과다 호출이면 안내문(텍스트)을 준다
  return (payload.articles || []).map((item) => ({
    title: item.title || "", summary: "", publisher: item.domain || "GDELT", link: item.url || "",
    publishedAt: normalizeGdeltDate(item.seendate), provider: "GDELT",
  }));
}

// ----- 미리 모은 큰 등락일 뉴스(GitHub Actions build_moment_news.py → Pages data/moment_news) -----
// 미국 시총 상위 500·국내 상위 200 의 최근 3년 큰 등락일마다 구글 뉴스 ±2일 상위 3건. 러너에선 구글 뉴스가
// 잘 되므로 거기서 모으고, 워커는 Pages 의 종목 샤드만 읽는다(구글·GDELT 가 Cloudflare 에서 시간 초과라).
// 샤드 = crc32(코드) % 64 — 빌더 zlib.crc32 · 화면 MirEventStudyCore.shardOf 와 같은 값.
export const MOMENT_NEWS_SHARDS = 64;
export function crc32Shard(code, shards = MOMENT_NEWS_SHARDS) {
  let c = ~0 >>> 0;
  const bytes = new TextEncoder().encode(String(code));
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ((c ^ ~0) >>> 0) % shards;
}

function momentNewsCode(ticker, isKr) {
  return isKr ? String(ticker).replace(/\.(KS|KQ)$/i, "") : String(ticker).toUpperCase();
}

// { checked: 그 날짜를 미리 검색했는가(0건 포함), news: [{title, publisher, link, publishedAt, provider}] }
async function fetchMomentNews(ticker, isKr, eventDate) {
  const code = momentNewsCode(ticker, isKr);
  const m = isKr ? "kr" : "us";
  const url = `${MIR_PAGES_DATA_BASE}/moment_news/${m}_${String(crc32Shard(code)).padStart(2, "0")}.json`;
  try {
    const r = await fetchT(url, { headers: { Accept: "application/json" }, cf: { cacheTtl: 1800 } }, 4000);
    if (!r.ok) return { checked: false, news: [] };
    const data = await r.json();
    const byDate = data && data.t && data.t[code];
    if (!byDate || !Object.prototype.hasOwnProperty.call(byDate, eventDate)) return { checked: false, news: [] };
    const rows = Array.isArray(byDate[eventDate]) ? byDate[eventDate] : [];
    const news = rows.filter(Array.isArray).map((row) => {
      const link = String(row[2] || "");
      return {
        title: String(row[0] || ""), summary: "", publisher: String(row[1] || ""),
        link: link.startsWith("g:") ? `https://news.google.com/rss/articles/${link.slice(2)}?oc=5` : link,
        publishedAt: String(row[3] || eventDate), provider: "Google News(미리 수집)",
      };
    }).filter((item) => item.title && /^https?:\/\//i.test(item.link));
    return { checked: true, news };
  } catch (e) {
    return { checked: false, news: [] };
  }
}

async function eventNewsPayload(env, ticker, symbol, isKr, eventDate) {
  const pre = await fetchMomentNews(ticker, isKr, eventDate);
  if (pre.checked) {
    const news = pre.news.slice(0, 5).map(({ title, publisher, publishedAt, link }) => ({ title, publisher, publishedAt, link }));
    return { ticker, date: eventDate, company: "", news, providers: news.length ? ["Google News(미리 수집)"] : [], diag: { moment_news: `ok ${news.length}` } };
  }
  const company = await resolveCompanyName(ticker, symbol, isKr);
  const from = shiftIsoDate(eventDate, -2);
  const to = shiftIsoDate(eventDate, 2);
  const code = isKr ? ticker.replace(/\.(KS|KQ)$/i, "") : symbol;
  const sources = await Promise.all([
    eventNewsSource("google", () => eventNewsGoogle(code, company, from, to, isKr)),
    eventNewsSource("gdelt", () => eventNewsGdelt(code, company, from, to)),
    isKr ? null : eventNewsSource("finnhub", () => (env && env.FINNHUB_API_KEY ? fetchFinnhubNews(env, symbol, from, to) : { status: "no_key" })),
  ].filter(Boolean));
  const ranked = rankHistoricalNews(sources.flatMap((s) => s.items), code, company, eventDate);
  const news = ranked
    .filter((item) => dateDistanceDays(item.publishedAt, eventDate) <= 2)
    .slice(0, 5)
    .map((item) => ({
      title: String(item.title || "").slice(0, 200),
      publisher: String(item.publisher || item.provider || "").slice(0, 60),
      publishedAt: item.publishedAt || "",
      link: item.link,
    }));
  const diag = Object.fromEntries(sources.map((s) => [s.name, s.diag]));
  return { ticker, date: eventDate, company, news, providers: [...new Set(ranked.map((i) => i.provider).filter(Boolean))], diag };
}

// move_analysis 용 뉴스. 예전(fetchHistoricalNews*)은 ±2일 → 부족하면 ±7일, 소스를 차례로 8초씩 불러
// Cloudflare 에서 구글·GDELT 가 시간 초과로 끝나면 30초 넘게 걸리고 비었다(2026-10-01). 순서:
// 1) 미리 모은 기사(있으면 구글·GDELT 생략) 2) 없으면 구글·GDELT 를 ±3일 동시 5초.
// 어느 쪽이든 Finnhub(미국, 키 있을 때)·최근 뉴스(미국 야후 / 국내 네이버)를 더해 관련도로 고른다.
// ── 주가 움직임 이유(?move_reasons=TICKER, 2026-10-22) ─────────────────────────────────────────────
// 종목 분석의 '주가 움직임 이유' 버튼. 소셜(미국 Stocktwits·레딧 / 국내 네이버 종목토론)을 먼저 보고 거기서 '왜 움직였나'
// 주장을 뽑은 뒤, 같은 기간 뉴스(move_analysis 와 같은 수집)와 대조한다. 뉴스와 맞는 주장은 '뉴스 확인',
// 소셜에만 있는 주장은 '소셜 의견(미확인)'으로 나눈다. X(트위터)는 무료 API 가 없어 쓰지 않는다.
// LLM 은 주장·인용 번호만 낸다 — 인용 번호가 실제 글·기사인지, 숫자가 인용 원문에 있는지는 서버가 다시 본다
// (validateMoveReasons). 레딧은 REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET(무료 앱, client_credentials)이 있을 때만.
const MOVE_REASONS_TTL = 1800;
const REASON_SOCIAL_MAX = 60;
const REASON_NEWS_MAX = 12;
function clipText(s, n) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
}

// Stocktwits 종목 스트림 → [{text, url, at, likes, source}] — 최근 48시간, 캐시태그만 늘어놓은 글은 뺀다.
export function parseStocktwitsStream(body, nowMs = Date.now()) {
  const out = [];
  for (const m of (body && body.messages) || []) {
    const text = clipText(m && m.body, 280);
    const at = Date.parse(m && m.created_at);
    if (!text || text.length < 20 || !Number.isFinite(at) || nowMs - at > 48 * 3600000) continue;
    if ((text.match(/\$[A-Z]{1,6}/g) || []).length > 4) continue;
    const user = m.user && m.user.username;
    out.push({ text, at: new Date(at).toISOString(), likes: Number((m.likes && m.likes.total) || 0),
      url: user ? `https://stocktwits.com/${encodeURIComponent(user)}/message/${m.id}` : "", source: "Stocktwits" });
  }
  return out;
}

// 네이버 종목토론(m.stock 프런트 API) → [{text, url, at, likes, source}] — 제목 + 본문 앞부분, 10자 미만 잡담은 뺀다.
export function parseNaverDiscussion(body, code) {
  const out = [];
  for (const p of (body && body.result && body.result.posts) || []) {
    const text = clipText(`${p.title || ""} ${p.contentSwReplacedButImg || p.contentSwReplaced || ""}`, 200);
    if (text.replace(/\s/g, "").length < 10) continue;
    out.push({ text, at: p.writtenAt ? `${p.writtenAt}+09:00` : "", likes: Number(p.recommendCount || 0),
      url: p.id ? `https://m.stock.naver.com/domestic/stock/${code}/discussion/${p.id}` : "", source: "네이버 종목토론" });
  }
  return out;
}

// 레딧 검색 결과(listing) → [{text, url, at, likes, source}] — 최근 48시간.
export function parseRedditListing(body, nowMs = Date.now()) {
  const out = [];
  for (const c of (body && body.data && body.data.children) || []) {
    const d = c && c.data;
    if (!d) continue;
    const at = Number(d.created_utc) * 1000;
    const text = clipText(`${d.title || ""} ${d.selftext || ""}`, 280);
    if (!text || !Number.isFinite(at) || nowMs - at > 48 * 3600000) continue;
    out.push({ text, at: new Date(at).toISOString(), likes: Number(d.score || 0),
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : "", source: `Reddit r/${d.subreddit || ""}` });
  }
  return out;
}

async function redditToken(env) {
  if (!env || !env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) return "";
  const kv = env.MOVE_CACHE || env.COMMUNITY_KV;
  try {
    const cached = kv && await kv.get("reddit:token");
    if (cached) return cached;
  } catch (_) { /* 캐시 미스로 */ }
  const r = await fetchT("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "MirUSStocks/1.0 (by mir)" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) return "";
  const j = await r.json().catch(() => null);
  const token = j && j.access_token;
  if (token && kv) {
    try { await kv.put("reddit:token", token, { expirationTtl: Math.max(300, Number(j.expires_in || 3600) - 300) }); } catch (_) { /* 무시 */ }
  }
  return token || "";
}

async function fetchSocialPosts(env, ticker, symbol, company, isKr) {
  const errors = [];
  const sources = [];
  let posts = [];
  if (isKr) {
    const code = ticker.slice(0, 6);
    try {
      const r = await fetchT(`https://m.stock.naver.com/front-api/discussion/list?discussionType=domesticStock&itemCode=${code}&pageSize=50`, { headers: { "User-Agent": BROWSER_UA } });
      if (r.ok) { posts = parseNaverDiscussion(await r.json(), code); sources.push("네이버 종목토론"); } else errors.push(`naver:${r.status}`);
    } catch (e) { errors.push("naver:fetch"); }
  } else {
    const tasks = [(async () => {
      const r = await fetchT(`https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`, { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } });
      if (!r.ok) { errors.push(`stocktwits:${r.status}`); return []; }
      sources.push("Stocktwits");
      return parseStocktwitsStream(await r.json());
    })(), (async () => {
      const token = await redditToken(env);
      if (!token) return [];
      const q = encodeURIComponent(`${symbol} OR "${company}"`);
      const r = await fetchT(`https://oauth.reddit.com/r/wallstreetbets+stocks+investing+StockMarket/search?q=${q}&restrict_sr=1&sort=new&t=day&limit=40`,
        { headers: { Authorization: `Bearer ${token}`, "User-Agent": "MirUSStocks/1.0 (by mir)" } });
      if (!r.ok) { errors.push(`reddit:${r.status}`); return []; }
      sources.push("Reddit");
      return parseRedditListing(await r.json());
    })()];
    posts = (await Promise.all(tasks.map((t) => t.catch(() => [])))).flat();
  }
  // 공감 많은 글 우선, 최신 순 — 상한까지
  posts.sort((a, b) => (b.likes - a.likes) || String(b.at).localeCompare(String(a.at)));
  return { posts: posts.slice(0, REASON_SOCIAL_MAX), sources, errors };
}

function reasonNumbers(text) {
  return new Set((String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")));
}

// LLM 출력 → {confirmed, socialOnly, newsOnly}. 인용 번호가 없는 글·기사면 그 인용을 버리고, 주장 문장의 숫자가
// 인용 원문(글·기사 제목)에 없으면 그 주장을 버린다. 소셜 근거가 없는 '뉴스 확인'은 newsOnly 로 보낸다.
// 이유가 아니라 움직임 자체("NVDA 주가 상승", "삼성전자 주가가 내렸다")나 시장 잡담("코스피 바닥을 찍었다")인 주장.
// 낱말마다 끝 조사를 떼고 회사명·티커·움직임 낱말을 빼면 남는 게 없을 때. 2026-10-22 라이브 첫 결과에서 이런 주장이
// '뉴스 확인'으로 올라오고 NVDA 는 '상승'(확인)과 '하락'(소셜)이 같이 나왔다.
const MOVE_ONLY_WORDS = new Set(("주가 주식 가격 종목 시세 상승 하락 상승세 하락세 올랐다 올라 오름 오른다 내렸다 내려 내림 내린다 급등 급락 " +
  "반등 폭락 폭등 강세 약세 보합 마감 기록 했다 하다 한다 중 계속 지속 크게 소폭 대폭 큰 다시 오늘 장중 " +
  "코스피 코스닥 나스닥 지수 시장 증시 바닥 고점 저점 찍었다 찍음 전망 예상 up down rally drop rise fall stock price shares").split(" "));
export function isMoveOnlyClaim(claim, names = []) {
  const skip = new Set(names.filter(Boolean).map((n) => String(n).toLowerCase()));
  const tokens = String(claim || "").toLowerCase().replace(/[.,!?·"'“”()\[\]]/g, " ").split(/\s+/).filter(Boolean);
  return tokens.every((tok) => {
    const base = tok.replace(/(으로|에서|이다|이|가|은|는|을|를|의|로|에|도|와|과)$/, "");
    return MOVE_ONLY_WORDS.has(tok) || MOVE_ONLY_WORDS.has(base) || skip.has(tok) || skip.has(base);
  });
}

// 예측·전망("~수 있다", "~할 것", "전망", "가능성")은 이미 일어난 움직임의 이유가 아니다(2026-10-22 재배포 후 TSLA
// '주가가 오를 수 있다'가 뉴스 확인으로 나왔다). 소문은 '~라는 소문'처럼 사실 주장 꼴이라 여기 걸리지 않는다.
const SPECULATIVE_RE = /(수\s?(있다|있음|있어|있을|도)|할\s?것|될\s?것|것이다|것으로\s?(보|예상|전망)|전망|예상된다|예상돼|가능성|\bmay\b|\bcould\b|\bmight\b|\bwill\b)/i;
// 이유가 없다는 말("무슨 이유인지 모르지만", "no reason")은 이유가 아니다(2026-10-22 TSLA 소셜 의견에 나왔다).
const NON_REASON_RE = /(모르(겠|지만|는)|이유\s?(없|를\s?모)|왜\s?(오르|내리|빠지)는지|\bno reason\b|\bunknown\b|\bidk\b)/i;
export function isNonReasonClaim(claim) {
  return NON_REASON_RE.test(String(claim || ""));
}
// 주가와 상관없는 회사 소식(사내 행사·기부·시상·채용 등)은 '뉴스만 있는 이유'로 내지 않는다(삼성전자 '감사 페스티벌 상품권').
const TRIVIAL_NEWS_RE = /(페스티벌|축제|행사|봉사|기부|후원|캠페인|시상|수상|어워드|상품권|채용|공모전|사회공헌|기념식)/;
export function isTrivialCorporateNews(claim) {
  return TRIVIAL_NEWS_RE.test(String(claim || ""));
}

export function isSpeculativeClaim(claim) {
  return SPECULATIVE_RE.test(String(claim || ""));
}

// 뉴스만 있는 이유(소셜 근거 없음)는 인용 기사 제목에 이 종목 이름·티커가 있을 때만 — 같은 날 다른 회사·거시 기사가
// '이유'로 붙던 것(SK하이닉스 화면에 '가계부채가 경제에 제약 요인' 등).
export function newsMentions(newsItems, names = []) {
  const keys = names.filter((n) => n && String(n).length >= 2).map((n) => String(n).toLowerCase());
  if (!keys.length) return true;   // 이름을 모르면 거를 수 없다
  return newsItems.some((n) => keys.some((k) => String(n.title || "").toLowerCase().includes(k)));
}

// 한국어 답에 한자·가나가 섞이면(2026-10-22 TSLA '머지어谈論', '削減') 모델이 언어를 놓친 것 — 버린다.
const FOREIGN_SCRIPT_RE = /[぀-ヿ㐀-䶿一-鿿]/;
export function hasForeignScript(claim) {
  return FOREIGN_SCRIPT_RE.test(String(claim || ""));
}

// 근거 대조 — 주장의 핵심 낱말이 인용한 소셜 글·기사에 실제로 있어야 한다(삼성전자 '유럽 부채 위기',
// '글로벌 사이버 보안 사건'처럼 글에 없는 거시 이유를 지어내던 것). 주가·이유·하락 같은 틀 낱말과 종목명은 빼고 본다.
const CLAIM_STOP = new Set(["주가", "이유", "때문", "때문이다", "때문입니다", "하락", "상승", "하락한", "상승한", "떨어진", "올랐다", "내렸다",
  "떨어졌다", "움직였다", "주식", "종목", "시장", "영향", "관련", "소식", "투자자", "투자자들", "최근", "오늘", "크게", "있다", "있었다", "했다",
  "the", "and", "for", "with", "stock", "shares", "because", "due", "after"]);
const JOSA_RE = /(으로|에서|에게|까지|부터|이다|입니다|이라|라는|의|가|이|은|는|을|를|와|과|로|에|도|만)$/;
export function claimTokens(claim, names = []) {
  const skip = new Set(names.filter(Boolean).map((n) => String(n).toLowerCase()));
  return [...new Set((String(claim || "").toLowerCase().match(/[가-힣]{2,}|[a-z][a-z0-9]{2,}/g) || [])
    .map((w) => (/^[가-힣]+$/.test(w) && w.length > 2 ? w.replace(JOSA_RE, "") : w))
    .filter((w) => w.length >= 2 && !CLAIM_STOP.has(w) && !skip.has(w) && ![...skip].some((n) => n.length >= 2 && w.startsWith(n))))];
}
// 미국 종목은 근거(Stocktwits·영문 기사)가 영어라 한국어 주장의 한글 낱말은 대조할 수 없다 — 근거가 주로 한글일 때만
// 한글 낱말을 보고, 아니면 영문·숫자 낱말만 본다(그것도 없으면 대조 불가로 통과).
export function claimGrounded(claim, texts, names = []) {
  const tokens = claimTokens(claim, names);
  const hay = texts.map((x) => String(x || "").toLowerCase()).join("\n");
  const hangul = (hay.match(/[가-힣]/g) || []).length;
  const latin = (hay.match(/[a-z]/g) || []).length;
  const koreanSources = hangul >= latin;
  const checkable = tokens.filter((w) => (koreanSources ? true : /^[a-z0-9]+$/.test(w)));
  if (!checkable.length) return !koreanSources;
  return checkable.some((w) => hay.includes(w));
}

// 방향 대조 — 오늘 +5.67%인 삼성전자에 '나스닥 하락', '반도체 폭락'(어제 −4% 날 종목토론 글)이, −1.33%인 NVDA 에
// '주가가 상승했다'가 이유로 붙던 것(2026-10-22). 오늘 움직임과 반대 방향 낱말만 있는 주장은 버린다.
// 방향 낱말이 없거나 양쪽이 다 있으면(예: '하락 베팅이 청산돼 상승') 남긴다. 움직임이 작으면(|등락| < 1%) 보지 않는다.
const UP_RE = /(상승|올랐|오르|오른|급등|반등|강세|뛰었|뛴|치솟|랠리|\bsurge|\bsoar|\bjump|\brall(y|ied)|\bgain|\brise|\brose|\bup\b)/i;
const DOWN_RE = /(하락|내렸|내린|떨어|급락|폭락|약세|빠졌|빠진|밀렸|추락|\bplunge|\bdrop|\bfell\b|\bfall|\bslump|\bsink|\bdown\b)/i;
export function claimDirection(claim) {
  const s = String(claim || "");
  const up = UP_RE.test(s);
  const down = DOWN_RE.test(s);
  return up === down ? 0 : up ? 1 : -1;
}
export function contradictsMove(claim, changePct) {
  const c = Number(changePct);
  if (changePct == null || !Number.isFinite(c) || Math.abs(c) < 1) return false;
  const d = claimDirection(claim);
  return d !== 0 && d !== Math.sign(c);
}

export function validateMoveReasons(raw, posts, news, names = [], changePct = null) {
  const items = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.claims) ? raw.claims : []);
  const pick = (ids, list, prefix) => [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x).trim().toUpperCase()))]
    .map((id) => { const m = new RegExp(`^${prefix}(\\d+)$`).exec(id); return m ? list[Number(m[1]) - 1] : null; })
    .filter(Boolean);
  const out = { confirmed: [], socialOnly: [], newsOnly: [] };
  const seen = new Set();
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const claim = clipText(it.claim, 140);
    if (claim.length < 6 || seen.has(claim) || isMoveOnlyClaim(claim, names) || isSpeculativeClaim(claim) || isNonReasonClaim(claim) || hasForeignScript(claim) || contradictsMove(claim, changePct)) continue;
    const social = pick(it.social, posts, "S");
    const cited = pick(it.news, news, "N");
    if (!social.length && !cited.length) continue;
    if (!claimGrounded(claim, [...social.map((p) => p.text), ...cited.map((n) => `${n.title} ${n.summary || ""}`)], names)) continue;
    const pool = new Set([...social.map((p) => p.text), ...cited.map((n) => `${n.title} ${n.summary || ""}`)].flatMap((t) => [...reasonNumbers(t)]));
    if ([...reasonNumbers(claim)].some((n) => !pool.has(n))) continue;
    seen.add(claim);
    const newsRefs = cited.slice(0, 3).map((n) => ({ title: clipText(n.title, 160), link: n.link || n.url || "", publisher: n.publisher || n.provider || "", date: n.publishedAt || "" }));
    const samples = social.slice(0, 2).map((p) => ({ text: clipText(p.text, 160), url: p.url, source: p.source }));
    if (cited.length && social.length) out.confirmed.push({ claim, news: newsRefs, socialCount: social.length, samples });
    else if (cited.length) { if (newsMentions(cited, names) && !isTrivialCorporateNews(claim)) out.newsOnly.push({ claim, news: newsRefs }); }
    else out.socialOnly.push({ claim, socialCount: social.length, samples });
  }
  out.confirmed.sort((a, b) => b.socialCount - a.socialCount);
  out.socialOnly.sort((a, b) => b.socialCount - a.socialCount);
  out.confirmed = out.confirmed.slice(0, 4);
  out.socialOnly = out.socialOnly.slice(0, 4);
  out.newsOnly = out.newsOnly.slice(0, 3);
  return out;
}

function parseJsonLoose(text) {
  const t = String(text || "");
  for (const cand of [t, (t.match(/\{[\s\S]*\}/) || [""])[0], (t.match(/\[[\s\S]*\]/) || [""])[0]]) {
    try { return JSON.parse(cand); } catch (_) { /* 다음 후보 */ }
  }
  return null;
}

async function extractMoveReasons(env, ticker, company, isKr, changeText, posts, news, modelOverride) {
  if (!env || !env.AI) return { raw: null, error: "no_ai_binding" };
  const social = posts.map((p, i) => `S${i + 1}. [${p.source}·공감 ${p.likes}] ${p.text}`).join("\n") || "(소셜 글 없음)";
  const heads = news.map((n, i) => `N${i + 1}. ${n.publishedAt || ""} | ${n.publisher || n.provider || ""} | ${n.title}`).join("\n") || "(뉴스 없음)";
  const prompt =
    `${isKr ? "국내" : "미국"} 종목 ${isKr ? company : `${ticker}(${company})`}의 최근 주가 움직임(${changeText})에 대해,\n` +
    `[소셜 글]에서 '왜 올랐다/내렸다'는 주장을 먼저 뽑고, 각 주장이 [뉴스]의 어떤 기사와 같은 사실인지 대조하세요.\n\n` +
    `[소셜 글]\n${social}\n\n[뉴스]\n${heads}\n\n` +
    `규칙:\n- 주가 움직임의 이유(사건·실적·공시·루머·수급 등)를 말하는 주장만. 단순 감정·욕설·매매 자랑은 버리세요.\n` +
    `- '주가가 올랐다/내렸다', '지수가 바닥이다' 같은 움직임 자체·시장 전망은 이유가 아닙니다. 버리세요.\n` +
    `- 오늘 움직임과 반대 방향의 이유(오른 날의 '하락' 이유, 내린 날의 '상승' 이유)는 지난 날 글이니 버리세요.\n` +
    `- '~할 수 있다', '~할 것', '전망' 같은 예측은 이유가 아닙니다. 이미 일어난 일만.\n` +
    `- 이 종목과 직접 관련 없는 거시·다른 회사 기사는 이유로 쓰지 마세요.\n` +
    `- 반드시 한국어(한글)로만 쓰고, 글·기사에 없는 내용을 덧붙이지 마세요.\n` +
    `- 사내 행사·기부·시상·채용처럼 주가와 상관없는 회사 소식, '이유를 모르겠다'는 글은 버리세요.\n` +
    `- 같은 내용의 글은 한 주장으로 합치고 social 에 그 글 번호를 모두 넣으세요.\n` +
    `- news 에는 그 주장과 같은 사실을 보도한 기사 번호만. 비슷한 주제일 뿐이면 넣지 마세요.\n` +
    `- 소셜에 없지만 뉴스에 분명한 이유가 있으면 social 을 빈 배열로 두고 추가하세요.\n` +
    `- claim 은 한국어 한 문장(70자 이내). 글·기사에 없는 숫자나 사실을 만들지 마세요.\n` +
    `- JSON 만 출력: {"claims":[{"claim":"...","social":["S1"],"news":["N2"]}]}`;
  const models = modelOverride ? [modelOverride] : SUMMARY_MODELS;
  let lastError = "no_model";
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "You extract stock-move claims from social posts and fact-check them against supplied news headlines. Output only JSON. Never invent facts, numbers or ids." },
          { role: "user", content: prompt },
        ],
        max_tokens: 900,
        temperature: 0.1,
      });
      const raw = parseJsonLoose((result && result.response) || "");
      if (raw) return { raw, error: "", model };
      lastError = `unparsable:${model}`;
    } catch (e) {
      lastError = `${model}: ${(e && e.message) || e}`;
    }
  }
  return { raw: null, error: lastError };
}

async function handleMoveReasons(request, env, url, rawTicker) {
  let ticker = String(rawTicker || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 16);
  if (!ticker) return cors(noStoreJson({ error: "invalid ticker" }, 400));
  if (!llmOriginAllowed(request)) return cors(json({ error: "forbidden_origin" }, 403, 0));
  if (/^\d{6}$/.test(ticker)) ticker += ".KS";   // 접미사 없는 국내 코드(이름·차트·뉴스가 다 비던 것)
  const kr = isKoreanTicker(ticker);
  const symbol = kr ? ticker : ticker.replace(/\./g, "-");
  const modelOverride = await resolveModelOverride(env, request, url);
  const bucket = Math.floor(Date.now() / (MOVE_REASONS_TTL * 1000));
  const cacheKey = `reasons:v6:${ticker}:${bucket}`;
  const kv = env && (env.MOVE_CACHE || env.COMMUNITY_KV);
  if (kv && !modelOverride) {
    try {
      const cached = await kv.get(cacheKey, "json");
      if (cached && Array.isArray(cached.confirmed)) return cors(varyOrigin(json({ ...cached, cached: true }, 200, 0)));
    } catch (_) { /* 캐시 미스 */ }
  }
  if (await ipRateLimited(request, env, "reasons", 6, 60)) {
    return cors(json({ error: "rate_limited", message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, 429, 0));
  }
  const tz = kr ? "Asia/Seoul" : "America/New_York";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const company = (await resolveCompanyName(ticker, symbol, kr)) || ticker;
  const [social, newsResult, chart] = await Promise.all([
    fetchSocialPosts(env, ticker, symbol, company, kr),
    moveAnalysisNews(env, ticker, symbol, company, today, kr).catch(() => ({ news: [], providers: [] })),
    fetchChart(symbol).catch(() => []),
  ]);
  const last = chart.length ? chart[chart.length - 1] : null;
  const prev = chart.length > 1 ? chart[chart.length - 2] : null;
  const changePct = last && prev && prev[3] ? Math.round(((last[3] / prev[3]) - 1) * 10000) / 100 : null;
  const changeText = changePct == null ? "등락률 미상" : `최근 거래일 ${changePct > 0 ? "+" : ""}${changePct}%`;
  const news = (newsResult.news || []).slice(0, REASON_NEWS_MAX);
  const base = { ticker, company, date: today, changePct, socialSources: social.sources, socialErrors: social.errors,
    socialCount: social.posts.length, newsCount: news.length, newsProviders: newsResult.providers || [] };
  if (!social.posts.length && !news.length) {
    return cors(varyOrigin(json({ ...base, confirmed: [], socialOnly: [], newsOnly: [], error: "no_sources" }, 200, 0)));
  }
  const { raw, error, model } = await extractMoveReasons(env, ticker, company, kr, changeText, social.posts, news, modelOverride);
  const checked = validateMoveReasons(raw, social.posts, news, [ticker, symbol, ticker.replace(/\.(KS|KQ)$/, ""), company, String(company || "").split(/[\s,(]/)[0]], changePct);
  const payload = { ...base, ...checked, model: model || "", error: raw ? "" : error };
  if (raw && kv && !modelOverride) {
    try { await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: MOVE_REASONS_TTL }); } catch (_) { /* 무시 */ }
  }
  return cors(varyOrigin(json(payload, 200, 0)));
}

async function moveAnalysisNews(env, ticker, symbol, company, eventDate, isKr) {
  const pre = await fetchMomentNews(ticker, isKr, eventDate);
  const code = momentNewsCode(ticker, isKr);
  const from = shiftIsoDate(eventDate, pre.news.length ? -2 : -3);
  const to = shiftIsoDate(eventDate, pre.news.length ? 2 : 3);
  const tasks = [
    isKr ? fetchNaverNews(ticker).then((rows) => rows.map((item) => ({ ...item, provider: "Naver" }))) : fetchNewsFromYahoo(symbol).then((rows) => rows.map((item) => ({ ...item, provider: "Yahoo" }))),
  ];
  if (!isKr && env && env.FINNHUB_API_KEY) tasks.push(fetchFinnhubNews(env, symbol, from, to));
  if (!pre.news.length) {
    tasks.push(eventNewsSource("google", () => eventNewsGoogle(isKr ? code : symbol, company, from, to, isKr)).then((s) => s.items));
    tasks.push(eventNewsSource("gdelt", () => eventNewsGdelt(isKr ? code : symbol, company, from, to)).then((s) => s.items));
  }
  const settled = await Promise.all(tasks.map((t) => t.catch(() => [])));
  const news = rankHistoricalNews([...pre.news, ...settled.flat()], isKr ? code : symbol, company, eventDate);
  const providers = [...new Set(news.map((item) => item.provider).filter(Boolean))];
  return { news, providers, windowDays: pre.news.length ? 2 : 3 };
}

async function fetchChart(symbol) {
  try {
    const r = await fetchT(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?range=5y&interval=1d`,
      { headers: UA }
    );
    if (!r.ok) return [];
    const data = await r.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) return [];
    const ts = result.timestamp || [];
    const q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    const out = [];
    for (let i = 0; i < ts.length; i += 1) {
      const c = q.close ? q.close[i] : null;
      if (c == null) continue;
      out.push([
        round(q.open && q.open[i] != null ? q.open[i] : c),
        round(q.high && q.high[i] != null ? q.high[i] : c),
        round(q.low && q.low[i] != null ? q.low[i] : c),
        round(c),
        Math.round((q.volume && q.volume[i]) || 0),
        new Date(ts[i] * 1000).toISOString().slice(0, 10), // YYYY-MM-DD for the x-axis
      ]);
    }
    return out;
  } catch (e) {
    return [];
  }
}

const round = (v) => Math.round(Number(v) * 100) / 100;

// Economic calendar for Korea (id 11) + US (id 5), KST (timeZone 88).
// 이번 주 + 다음 주를 함께 가져와 합쳐서 다음 주 일정까지 표시.
async function fetchCalendarTab(tab) {
  try {
    const r = await fetchT("https://kr.investing.com/economic-calendar/Service/getCalendarFilteredData", {
      method: "POST",
      headers: {
        ...UA,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://kr.investing.com/economic-calendar/",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
      body: `country%5B%5D=5&country%5B%5D=11&timeZone=88&timeFilter=timeRemain&currentTab=${tab}&limit_from=0`,
    });
    if (!r.ok) return [];
    const payload = await r.json();
    return parseCalendar(payload && payload.data ? String(payload.data) : "");
  } catch (e) {
    return [];
  }
}

// 탭(thisWeek/nextWeek) 단위로 직전 정상값을 따로 보관한다 — 한 탭만 죽어도
// 그 탭만 낡은 값으로 채우고, 하나라도 낡았으면 합친 응답에 stale 을 표시한다
// (storedAt 은 낡은 탭 중 가장 오래된 것).
async function fetchCalendar(env) {
  const [thisWeek, nextWeek] = await Promise.all([
    withLastGood(env, "calendar:thisWeek", () => fetchCalendarTab("thisWeek"), []),
    withLastGood(env, "calendar:nextWeek", () => fetchCalendarTab("nextWeek"), []),
  ]);
  const seen = new Set();
  const merged = [...thisWeek.value, ...nextWeek.value].filter((ev) => {
    const key = `${ev.datetime || ev.day || ""}|${ev.event || ""}|${ev.country || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const staleParts = [thisWeek, nextWeek].filter((p) => p.stale);
  if (!staleParts.length) return { value: merged, stale: false, storedAt: null };
  const storedAt = staleParts.map((p) => p.storedAt).sort()[0];
  return { value: merged, stale: true, storedAt };
}

function parseCalendar(htmlStr) {
  const events = [];
  let day = "";
  const stripTags = (s) => (s == null ? "" : s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(htmlStr)) !== null) {
    const row = m[0];
    const dayM = /class="theDay"[^>]*>([^<]+)</.exec(row);
    if (dayM) { day = dayM[1].trim(); continue; }
    if (!/js-event-item/.test(row)) continue;
    const datetime = (/data-event-datetime="([^"]+)"/.exec(row) || [])[1] || "";
    const time = ((/class="first left time[^"]*"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1] || "").replace(/<[^>]+>/g, "").trim();
    const isKR = /South_Korea/.test(row);
    const isUS = /United_States/.test(row);
    const country = isKR ? "한국" : (isUS ? "미국" : "");
    const currency = isKR ? "KRW" : (isUS ? "USD" : "");
    const importance = (row.match(/grayFullBullishIcon/g) || []).length;
    const eventRaw = (/class="left event"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1] || "";
    const event = stripTags(eventRaw).replace(/\s+/g, " ").trim();
    const actual = stripTags((/id="eventActual_\d+"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1]);
    const forecast = stripTags((/id="eventForecast_\d+"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1]);
    const previous = stripTags((/id="eventPrevious_\d+"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1]);
    if (!event) continue;
    events.push({ day, time, datetime, country, currency, importance, event, actual, forecast, previous });
  }
  return events;
}

// Live FX pairs (Yahoo symbols). KRW=X is USD/KRW, etc.
const FX_LIST = [
  ["KRW=X", "원/달러 (USD/KRW)"],
  ["EURUSD=X", "유로/달러 (EUR/USD)"],
  ["JPY=X", "엔/달러 (USD/JPY)"],
  ["CNY=X", "위안/달러 (USD/CNY)"],
  ["GBPUSD=X", "파운드/달러 (GBP/USD)"],
  ["EURKRW=X", "원/유로 (EUR/KRW)"],
  ["JPYKRW=X", "원/엔 (JPY/KRW)"],
  ["DX-Y.NYB", "달러 인덱스 (DXY)"],
  ["GC=F", "금 (Gold, $/oz)"],
  ["^TNX", "미국채 10년 (%)"],
  ["^TYX", "미국채 30년 (%)"],
];

// CNN Fear & Greed index (server-side fetch avoids browser CORS).
async function fetchFng() {
  try {
    const r = await fetchT("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://edition.cnn.com/markets/fear-and-greed",
        Origin: "https://edition.cnn.com",
      },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const fg = data && data.fear_and_greed;
    if (!fg || fg.score == null) return null;
    return {
      score: Math.round(Number(fg.score)),
      rawScore: Number(fg.score),
      rating: String(fg.rating || ""),
      timestamp: fg.timestamp || null,
      previousClose: fg.previous_close == null ? null : Number(fg.previous_close),
      source: "CNN",
    };
  } catch (e) {
    return null;
  }
}

// Intraday (1d / 5m) mini-series for major indices.
const INDEX_LIST = [
  ["^DJI", "Dow Jones"],
  ["^IXIC", "Nasdaq"],
  ["^GSPC", "S&P 500"],
  ["^RUT", "Russell 2000"],
  ["^KS11", "KOSPI"],
  ["^KQ11", "KOSDAQ"],
  ["BTC-USD", "Bitcoin"],
  ["ETH-USD", "Ethereum"],
];

// 직전 세션 종가는 **같은 1d/5m 응답의 meta.chartPreviousClose** 를 쓴다.
// 예전엔 ^KS11/^KQ11 만 7d/1d 응답을 한 번 더 받아 `closes[len-2]` 로 덮어썼다.
// 그 배열은 위치 기준이라 "마지막 봉 = 현재 세션" 가정이 깨지면(장 시작 전·휴장·
// 결측 봉) 한 세션 밀린 값을 집는다. 2026-09-15 라이브에서 KOSPI −4.97%(참값
// −3.26), KOSDAQ −3.60%(참값 −1.69)로 발행됐고, 같은 응답의 chartPreviousClose
// (6909.91 / 820.64)는 정확했다 → 오버라이드 제거(감사 P0-1).
//
// 규약: **prevClose 가 유한하고 0보다 크면 언제나 그 값으로 계산한다.** 당일 시리즈
// (첫 봉 → 마지막 봉)는 meta 가 없을 때만 쓰는 폴백이다.
//
// 한때 "meta 와 시리즈가 3%p 넘게 어긋나면 시리즈를 쓴다"는 안전장치를 뒀다가
// 뺐다. 시리즈는 갭(전일 종가 → 시가)을 구조적으로 못 본다 — 3% 갭 하락으로
// 시작해 장중 보합인 날이면 meta −3.3%(참값) vs 시리즈 −0.2% 로 벌어지는데,
// 그때 시리즈를 고르면 멀쩡한 값을 틀린 값으로 바꾼다. 어긋남은 값을 바꾸는
// 근거가 아니라 관측 대상이므로, 응답에는 어느 쪽을 썼는지(changePctSource)만
// 싣고 크게 벌어지면 로그만 남긴다.
const INDEX_SERIES_DIVERGENCE_PP = 3;

export function resolveIndexChangePct(price, prevClose, closes) {
  const series = (Array.isArray(closes) ? closes : [])
    .filter((v) => v != null)
    .map(Number)
    .filter(Number.isFinite);
  const seriesChangePct = series.length >= 2 && series[0] > 0
    ? (series[series.length - 1] / series[0] - 1) * 100
    : null;
  const p = Number(price);
  const prev = Number(prevClose);
  if (Number.isFinite(p) && Number.isFinite(prev) && prev > 0) {
    return { changePct: (p / prev - 1) * 100, source: "meta", seriesChangePct };
  }
  if (seriesChangePct == null) return { changePct: 0, source: "none", seriesChangePct };
  return { changePct: seriesChangePct, source: "series", seriesChangePct };
}

// ^KS11/^KQ11 의 가격·등락률 기준 소스는 **네이버 m.stock 지수 API** 다(2026-09-16 재감사).
// 국내 모드 스냅샷(update_korea_data.py fetch_kr_index_quotes)이 같은 API 를 쓰므로
// 미국 모드 지수 띠와 국내 모드 지수 카드가 같은 숫자를 낸다. 야후 ^KQ11 의
// chartPreviousClose 는 하루 밀린 값을 주는 날이 반복됐다 — 09-15 812.41 에 −1.00%
// (참값 +0.70, prev 820.64), 09-16 815.98 에 +1.14%(참값 +0.44, prev 806.79).
// 야후는 스파크라인 시리즈만 쓰고, 네이버가 실패할 때만 가격·등락률 폴백이다.
export const KR_INDEX_NAVER_CODES = { "^KS11": "KOSPI", "^KQ11": "KOSDAQ" };

export function parseNaverIndexBasic(payload) {
  if (!payload || typeof payload !== "object") return null;
  const num = (v) => {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return String(v ?? "").trim() !== "" && Number.isFinite(n) ? n : null;
  };
  const price = num(payload.closePrice);
  let changePct = num(payload.fluctuationsRatio);
  if (price == null || price <= 0 || changePct == null) return null;
  // 하락일에 부호 없이 오는 응답에 대비해 방향 코드로 부호를 맞춘다.
  const dir = String(payload.compareToPreviousPrice?.name || "").toUpperCase();
  if ((dir === "FALLING" || dir === "LOWER_LIMIT") && changePct > 0) changePct = -changePct;
  if ((dir === "RISING" || dir === "UPPER_LIMIT") && changePct < 0) changePct = -changePct;
  return { price, changePct };
}

async function fetchNaverIndexQuote(code) {
  try {
    const r = await fetchT(`https://m.stock.naver.com/api/index/${encodeURIComponent(code)}/basic`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: "https://m.stock.naver.com/" },
    });
    if (!r.ok) return null;
    return parseNaverIndexBasic(await r.json());
  } catch (e) {
    return null;
  }
}

// ^KS11/^KQ11 의 **장중 시리즈**도 네이버 1분봉으로 만든다(2026-10-02). 야후 국내 지수 5분봉은
// 지연돼 들어와 장 초반엔 0개였다(10-02 09:17 실측: 야후 오늘 봉 0개, 네이버 1분봉 09:00부터 실시간)
// → 오늘 탭 코스피·코스닥 차트가 라이브로 안 나왔다. 화면(home-chart-core placeSeries)의 규약
// "i 번째 값 = 09:00 + 5i 분" 에 맞춰 같은 5분 칸의 마지막 값으로 묶고, 빈 칸은 직전 값으로 채워
// 시각이 밀리지 않게 한다. 오늘 1분봉이 없으면(장 전·휴장일) 야후 시리즈로 폴백한다.
export const KR_INDEX_OPEN_MIN = 9 * 60;

export function naverMinuteToSeries(rows, ymd) {
  if (!Array.isArray(rows) || !ymd) return null;
  const byBar = new Map();
  const sorted = rows
    .filter((r) => r && typeof r.localDateTime === "string" && r.localDateTime.startsWith(ymd))
    .sort((a, b) => (a.localDateTime < b.localDateTime ? -1 : a.localDateTime > b.localDateTime ? 1 : 0));
  for (const r of sorted) {
    const hh = Number(r.localDateTime.slice(8, 10));
    const mm = Number(r.localDateTime.slice(10, 12));
    const v = Number(r.currentPrice);
    const m = hh * 60 + mm - KR_INDEX_OPEN_MIN;
    if (!Number.isFinite(m) || m < 0 || !Number.isFinite(v) || v <= 0) continue;
    byBar.set(Math.floor(m / 5), v);
  }
  if (!byBar.size) return null;
  const last = Math.max(...byBar.keys());
  const first = byBar.get(Math.min(...byBar.keys()));
  const out = [];
  let prev = first;
  for (let i = 0; i <= last; i += 1) {
    if (byBar.has(i)) prev = byBar.get(i);
    out.push(prev);
  }
  return out.length >= 2 ? out : null;
}

function kstYmd(now = Date.now()) {
  const d = new Date(now + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function fetchNaverIndexMinuteSeries(code) {
  try {
    const ymd = kstYmd();
    const r = await fetchT(
      `https://api.stock.naver.com/chart/domestic/index/${encodeURIComponent(code)}/minute?startDateTime=${ymd}0900&endDateTime=${ymd}1600`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: "https://m.stock.naver.com/" } },
    );
    if (!r.ok) return null;
    return naverMinuteToSeries(await r.json(), ymd);
  } catch (e) {
    return null;
  }
}

async function fetchIndices() {
  const out = [];
  await Promise.all(INDEX_LIST.map(async ([symbol, name]) => {
    try {
      const naverCode = KR_INDEX_NAVER_CODES[symbol];
      const naverPromise = naverCode ? fetchNaverIndexQuote(naverCode) : Promise.resolve(null);
      const naverSeriesPromise = naverCode ? fetchNaverIndexMinuteSeries(naverCode) : Promise.resolve(null);
      let res = null;
      try {
        const r = await fetchT(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
          { headers: UA }
        );
        const data = r.ok ? await r.json() : null;
        res = (data && data.chart && data.chart.result && data.chart.result[0]) || null;
      } catch (e) {
        res = null;
      }
      if (!res) {
        // 야후가 죽어도 KR 지수는 네이버 값만으로 카드를 채운다(시리즈는 비움).
        const naver = await naverPromise;
        const naverSeries = await naverSeriesPromise;
        if (naver) out.push({ symbol, name, price: round(naver.price), changePct: Math.round(naver.changePct * 100) / 100, changePctSource: "naver", changePctPolicy: "naver-primary", series: (naverSeries || []).map(round), ...(naverSeries ? { seriesSource: "naver-1m" } : {}) });
        return;
      }
      const meta = res.meta || {};
      const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
      const closes = (q.close || []).filter((v) => v != null);
      const price = closes.length ? closes[closes.length - 1] : meta.regularMarketPrice;
      // 시리즈 첫 봉 폴백은 resolveIndexChangePct 안에 있다 — 여기서 섞으면
      // changePctSource 가 meta 라고 거짓말을 한다.
      const prevClose = meta.chartPreviousClose || meta.previousClose || null;
      const { changePct, source, seriesChangePct } = resolveIndexChangePct(price, prevClose, closes);
      // 값은 바꾸지 않는다 — 어긋남은 로그로만 남겨 prevClose 가 또 밀리면 찾을 수 있게.
      if (source === "meta" && seriesChangePct != null && Math.abs(changePct - seriesChangePct) > INDEX_SERIES_DIVERGENCE_PP) {
        console.error(`index changePct divergence: ${symbol} meta=${changePct.toFixed(2)} series=${seriesChangePct.toFixed(2)} prevClose=${prevClose}`);
      }
      const naver = await naverPromise;
      const naverSeries = await naverSeriesPromise;
      if (naverCode && !naver) {
        console.error(`KR index naver quote failed: ${symbol} — yahoo ${source} 폴백`);
      }
      out.push({
        symbol,
        name,
        price: round(naver ? naver.price : price),
        changePct: Math.round((naver ? naver.changePct : changePct) * 100) / 100,
        changePctSource: naver ? "naver" : source,
        // 배포 게이트(check_kr_index_parity.py)가 '네이버 기준 워커' 인지 구분하는 표식.
        ...(naverCode ? { changePctPolicy: "naver-primary" } : {}),
        series: (naverSeries || closes).map(round),
        ...(naverSeries ? { seriesSource: "naver-1m" } : {}),
      });
    } catch (e) {
      /* skip */
    }
  }));
  const order = INDEX_LIST.map((i) => i[0]);
  out.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
  return out;
}

async function fetchFx() {
  const out = [];
  await Promise.all(FX_LIST.map(async ([symbol, name]) => {
    try {
      const r = await fetchT(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
        { headers: UA }
      );
      if (!r.ok) return;
      const data = await r.json();
      const result = data && data.chart && data.chart.result && data.chart.result[0];
      if (!result) return;
      const q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
      const closes = (q.close || []).filter((v) => v != null);
      if (closes.length < 2) return;
      const price = closes[closes.length - 1];
      const prev = closes[closes.length - 2];
      const monthBase = closes[0];
      out.push({
        symbol,
        name,
        price: Math.round(price * 10000) / 10000,
        changePct: Math.round((price / prev - 1) * 10000) / 100,
        monthChangePct: Math.round((price / monthBase - 1) * 10000) / 100,
      });
    } catch (e) {
      /* skip this pair */
    }
  }));
  const order = FX_LIST.map((f) => f[0]);
  out.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
  return out;
}

// =============================================================================
// 데이터 라우트(2026-10-21) — ?symsearch= · ?insights= · ?options=
//
// LLM 없음 → Origin 게이트·KV 리밋 없이 개방(다른 데이터 프록시와 같다). 대신 엣지 Cache API 로
// 같은 질의를 흡수한다. 응답은 화면이 쓰는 필드만 정규화해서 준다(업스트림 원문을 그대로 넘기지 않는다 —
// 야후 insights 원문은 종목당 350KB 다). 옛 워커는 이 경로들을 모르는 경로(404 not_found)로 답하므로,
// 프론트(worker-extras.js)는 404·모양 불일치면 기능을 조용히 숨긴다.
//   파서는 전부 순수 함수로 export — worker/test_worker.mjs 가 네트워크 없이 검증한다.
// =============================================================================
const SYMSEARCH_CACHE_SEC = 6 * 3600;
const INSIGHTS_CACHE_SEC = 6 * 3600;
const OPTIONS_CACHE_SEC = 10 * 60;
const SYMSEARCH_MAX = 12;
const OPTIONS_MIN_OI = 200;

// 미국 거래소(야후 exchange 코드 · 트레이딩뷰 exchange 이름). OTC 도 미국 종목으로 본다.
const US_YAHOO_EXCHANGES = new Set(["NMS", "NGM", "NCM", "NAS", "NYQ", "NYS", "ASE", "PCX", "BTS", "CBO", "PNK", "OQB", "OQX", "OEM", "OGM"]);
const US_TV_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX", "NYSE ARCA", "ARCA", "CBOE", "OTC"]);
const KR_YAHOO_EXCHANGES = { KSC: "KOSPI", KOE: "KOSDAQ" };

function stripTags(value) {
  return String(value == null ? "" : value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function cacheGet(key) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  return cache ? cache.match(new Request(key)) : Promise.resolve(null);
}
async function cachePut(key, resp) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) await cache.put(new Request(key), resp.clone());
}

export function sanitizeSymbolQuery(raw) {
  return String(raw == null ? "" : raw).replace(/[\u0000-\u001f<>"'`\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

// 사이트 티커 표기: 미국 BRK.B(점), 국내 6자리 코드. 야후 심볼 BRK-B · 005930.KS 에서 바꾼다.
function siteTickerFromYahoo(symbol) {
  const s = String(symbol || "").toUpperCase();
  const kr = s.match(/^(\d{6})\.(KS|KQ)$/);
  if (kr) return { ticker: kr[1], market: "KR", exchange: kr[2] === "KQ" ? "KOSDAQ" : "KOSPI" };
  if (/^[A-Z]{1,5}(-[A-Z])?$/.test(s)) return { ticker: s.replace("-", "."), market: "US", exchange: "" };
  return { ticker: s, market: "OTHER", exchange: "" };
}

// 야후 v1/finance/search quotes → [{ ticker, market, name, exchange, type, symbol(야후) }]
export function normalizeYahooSearch(json) {
  const out = [];
  for (const q of (json && Array.isArray(json.quotes)) ? json.quotes : []) {
    const type = String(q.quoteType || "").toUpperCase();
    if (type !== "EQUITY" && type !== "ETF") continue;
    const sym = String(q.symbol || "").toUpperCase();
    if (!sym) continue;
    const site = siteTickerFromYahoo(sym);
    const exch = String(q.exchange || "").toUpperCase();
    if (site.market === "US" && !US_YAHOO_EXCHANGES.has(exch)) continue; // 미국형 심볼이라도 다른 거래소면 제외
    if (site.market === "KR" && !KR_YAHOO_EXCHANGES[exch]) continue;
    const name = stripTags(q.longname || q.shortname || "");
    out.push({
      ticker: site.market === "OTHER" ? sym : site.ticker,
      market: site.market,
      name: name || site.ticker,
      exchange: site.market === "KR" ? KR_YAHOO_EXCHANGES[exch] : stripTags(q.exchDisp || exch),
      type: type === "ETF" ? "etf" : "stock",
      symbol: sym,
    });
  }
  return out;
}

// 트레이딩뷰 symbol_search v3 → 같은 모양. 주식(stock)·ETF(fund+etf)만. 국내는 KRX 6자리(코스피·코스닥 구분 없음).
export function normalizeTradingViewSearch(json) {
  const out = [];
  const rows = Array.isArray(json) ? json : (json && Array.isArray(json.symbols) ? json.symbols : []);
  for (const r of rows) {
    const type = String(r.type || "").toLowerCase();
    const specs = Array.isArray(r.typespecs) ? r.typespecs.map((x) => String(x).toLowerCase()) : [];
    const isEtf = type === "fund" && specs.includes("etf");
    if (type !== "stock" && !isEtf) continue;
    const sym = stripTags(r.symbol).toUpperCase();
    const exch = stripTags(r.exchange).toUpperCase();
    if (!sym) continue;
    let market = "OTHER";
    let ticker = sym;
    if (exch === "KRX" && /^\d{6}$/.test(sym)) market = "KR";
    else if (US_TV_EXCHANGES.has(exch) && /^[A-Z]{1,5}(\.[A-Z])?$/.test(sym)) market = "US";
    else ticker = `${sym}:${exch}`;
    out.push({ ticker, market, name: stripTags(r.description) || sym, exchange: exch, type: isEtf ? "etf" : "stock", symbol: sym });
  }
  return out;
}

// 두 소스를 합친다. 야후가 먼저(관련도 점수 순), 트레이딩뷰는 야후에 없는 것만 뒤에. (시장, 티커)로 중복 제거.
// 국내는 야후가 코스피/코스닥을 구분해 주므로 같은 코드면 야후 쪽 exchange 를 쓴다.
export function mergeSymbolSearch(yahooRows, tvRows, max = SYMSEARCH_MAX) {
  const seen = new Set();
  const out = [];
  for (const row of [...(yahooRows || []), ...(tvRows || [])]) {
    const key = `${row.market}:${row.ticker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ticker: row.ticker, market: row.market, name: row.name, exchange: row.exchange, type: row.type });
    if (out.length >= max) break;
  }
  return out;
}

async function handleSymbolSearch(rawQuery) {
  const q = sanitizeSymbolQuery(rawQuery);
  if (q.length < 1) return json({ error: "invalid query" }, 400, 0);
  const key = `https://mir-symsearch.cache/v1/${encodeURIComponent(q.toLowerCase())}`;
  const hit = await cacheGet(key);
  if (hit) return hit;
  const enc = encodeURIComponent(q);
  const asciiOnly = /^[ -~]+$/.test(q);
  const [tv, yh] = await Promise.allSettled([
    fetchT(`https://symbol-search.tradingview.com/symbol_search/v3/?text=${enc}&search_type=undefined&domain=production`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json", Origin: "https://www.tradingview.com", Referer: "https://www.tradingview.com/" },
    }, 5000).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`tv ${r.status}`)))),
    // 야후 검색은 한글 등 비 ASCII 질의에 400 을 준다(2026-10-21 실측) — 부르지 않고 트레이딩뷰만 쓴다.
    asciiOnly
      ? fetchT(`https://query2.finance.yahoo.com/v1/finance/search?q=${enc}&quotesCount=8&newsCount=0`, { headers: UA }, 5000)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`yahoo ${r.status}`))))
      : Promise.resolve({ quotes: [] }),
  ]);
  if (tv.status !== "fulfilled" && yh.status !== "fulfilled") return json({ error: "upstream", results: [] }, 502, 0);
  const results = mergeSymbolSearch(
    yh.status === "fulfilled" ? normalizeYahooSearch(yh.value) : [],
    tv.status === "fulfilled" ? normalizeTradingViewSearch(tv.value) : [],
  );
  const resp = json({ q, results, partial: tv.status !== "fulfilled" || yh.status !== "fulfilled", updatedAt: new Date().toISOString() },
    200, tv.status === "fulfilled" && yh.status === "fulfilled" ? SYMSEARCH_CACHE_SEC : 300);
  await cachePut(key, resp);
  return resp;
}

// ── insights ────────────────────────────────────────────────────────────────
function finiteOrNull(v) {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
}
function outlookOf(o) {
  if (!o || typeof o !== "object") return null;
  const dir = String(o.direction || "");
  if (!/^(Bullish|Bearish|Neutral)$/.test(dir)) return null;
  return { direction: dir.toLowerCase(), score: finiteOrNull(o.score) };
}

// 야후 ws/insights/v2 + v6 recommendationsbysymbol → 화면용 요약. 없는 칸은 null(국내 종목은 기술 지표가 없다).
export function normalizeInsights(insJson, recJson, symbol) {
  const res = (insJson && insJson.finance && insJson.finance.result) || {};
  const info = res.instrumentInfo || {};
  const te = info.technicalEvents || {};
  const outlook = {
    short: outlookOf(te.shortTermOutlook),
    mid: outlookOf(te.intermediateTermOutlook),
    long: outlookOf(te.longTermOutlook),
  };
  const kt = info.keyTechnicals || {};
  const levels = { support: finiteOrNull(kt.support), resistance: finiteOrNull(kt.resistance), stopLoss: finiteOrNull(kt.stopLoss) };
  const val = info.valuation || {};
  const valDesc = String(val.description || "");
  const valuation = /^(Undervalued|Overvalued|Near Fair Value)$/i.test(valDesc)
    ? { verdict: valDesc.toLowerCase().includes("under") ? "under" : valDesc.toLowerCase().includes("over") ? "over" : "fair",
      discount: /^-?\d+(\.\d+)?%$/.test(String(val.discount || "")) ? String(val.discount) : null }
    : null;
  const recRow = ((recJson && recJson.finance && recJson.finance.result) || [])[0] || {};
  const similar = [];
  for (const r of Array.isArray(recRow.recommendedSymbols) ? recRow.recommendedSymbols : []) {
    const site = siteTickerFromYahoo(r && r.symbol);
    if (!site.ticker) continue;
    similar.push({ ticker: site.ticker, market: site.market, score: finiteOrNull(r.score) });
    if (similar.length >= 8) break;
  }
  return {
    symbol: String(symbol || res.symbol || ""),
    outlook: (outlook.short || outlook.mid || outlook.long) ? outlook : null,
    levels: (levels.support != null || levels.resistance != null) ? levels : null,
    valuation,
    similar,
    updatedAt: new Date().toISOString(),
  };
}

async function handleInsights(symbol) {
  const key = `https://mir-insights.cache/v1/${encodeURIComponent(symbol)}`;
  const hit = await cacheGet(key);
  if (hit) return hit;
  const enc = encodeURIComponent(symbol);
  const [ins, rec] = await Promise.allSettled([
    fetchT(`https://query2.finance.yahoo.com/ws/insights/v2/finance/insights?symbol=${enc}`, { headers: UA })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`insights ${r.status}`)))),
    fetchT(`https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${enc}`, { headers: UA })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`rec ${r.status}`)))),
  ]);
  if (ins.status !== "fulfilled" && rec.status !== "fulfilled") return json({ error: "upstream" }, 502, 0);
  const payload = normalizeInsights(ins.status === "fulfilled" ? ins.value : null, rec.status === "fulfilled" ? rec.value : null, symbol);
  const full = ins.status === "fulfilled" && rec.status === "fulfilled";
  const resp = json({ ...payload, partial: !full }, 200, full ? INSIGHTS_CACHE_SEC : 300);
  await cachePut(key, resp);
  return resp;
}

// ── options ─────────────────────────────────────────────────────────────────
function optionLeg(rows) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const strike = finiteOrNull(r && r.strike);
    if (strike == null) continue;
    const bid = finiteOrNull(r.bid);
    const ask = finiteOrNull(r.ask);
    const last = finiteOrNull(r.lastPrice);
    const price = bid != null && ask != null && ask > 0 ? (bid + ask) / 2 : last;
    // 야후는 장외 시간에 bid/ask 를 0 으로 비우고 IV 를 0.00001·0.0156 같은 자리표시 값으로 채운다
    // (2026-10-21 01:00 ET 실측) — 호가가 살아 있는 계약의 IV 만 쓴다.
    const iv = finiteOrNull(r.impliedVolatility);
    const quoted = bid != null && ask != null && bid > 0 && ask > 0;
    out.push({ strike, oi: finiteOrNull(r.openInterest) || 0, vol: finiteOrNull(r.volume) || 0, price, iv: quoted && iv != null && iv > 0.01 ? iv : null });
  }
  return out;
}

// scripts/build_options_stats.py max_pain 과 같은 정의: 만기 정산가 S 후보(모든 행사가) 중
// 매수자 지급액 Σcall max(0,S-K)·OI + Σput max(0,K-S)·OI 가 최소인 S.
export function optionMaxPain(calls, puts) {
  const strikes = [...new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)])].sort((a, b) => a - b);
  if (strikes.length < 3) return null;
  let best = null;
  let bestVal = Infinity;
  for (const s of strikes) {
    let v = 0;
    for (const c of calls) if (s > c.strike) v += (s - c.strike) * c.oi;
    for (const p of puts) if (p.strike > s) v += (p.strike - s) * p.oi;
    if (v < bestVal) { bestVal = v; best = s; }
  }
  return best;
}

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

// 야후 v7 options 의 한 만기(options[0]) → 요약. spot 은 기초자산 현재가.
export function summarizeOptionExpiry(expiry, spot, nowMs = Date.now()) {
  if (!expiry) return null;
  const calls = optionLeg(expiry.calls);
  const puts = optionLeg(expiry.puts);
  if (!calls.length && !puts.length) return null;
  const sum = (leg, k) => leg.reduce((a, o) => a + o[k], 0);
  const callOI = sum(calls, "oi");
  const putOI = sum(puts, "oi");
  const callVol = sum(calls, "vol");
  const putVol = sum(puts, "vol");
  // 야후는 장외 시간에 미결제약정을 0 으로 비운다(같은 실측). 합계가 얕으면(빌더와 같은 200 계약 미만)
  // OI 기반 값(풋/콜 OI·맥스페인·행사가별 OI)은 내지 않는다 — 0 으로 계산한 맥스페인은 지어낸 값이다.
  const oiOk = callOI + putOI >= OPTIONS_MIN_OI;
  const expTs = finiteOrNull(expiry.expirationDate);
  const expDate = expTs != null ? new Date(expTs * 1000).toISOString().slice(0, 10) : null;
  // ATM: 콜·풋이 모두 있는 행사가 중 현재가에 가장 가까운 것.
  let atm = null;
  if (spot > 0) {
    const putBy = new Map(puts.map((p) => [p.strike, p]));
    for (const c of calls) {
      const p = putBy.get(c.strike);
      if (!p) continue;
      if (!atm || Math.abs(c.strike - spot) < Math.abs(atm.c.strike - spot)) atm = { c, p };
    }
  }
  let straddle = null;
  let atmIV = null;
  if (atm) {
    if (atm.c.price > 0 && atm.p.price > 0) straddle = atm.c.price + atm.p.price;
    const ivs = [atm.c.iv, atm.p.iv].filter((x) => x != null);
    if (ivs.length) atmIV = (ivs.reduce((a, b) => a + b, 0) / ivs.length) * 100;
  }
  const byStrike = new Map();
  for (const c of calls) byStrike.set(c.strike, { strike: c.strike, callOI: c.oi, putOI: 0 });
  for (const p of puts) {
    const row = byStrike.get(p.strike) || { strike: p.strike, callOI: 0, putOI: 0 };
    row.putOI = p.oi;
    byStrike.set(p.strike, row);
  }
  const topOI = !oiOk ? [] : [...byStrike.values()]
    .filter((r) => r.callOI + r.putOI > 0)
    .sort((a, b) => (b.callOI + b.putOI) - (a.callOI + a.putOI))
    .slice(0, 5)
    .map((r) => ({ strike: r.strike, callOI: Math.round(r.callOI), putOI: Math.round(r.putOI) }));
  return {
    expiry: expDate,
    daysToExpiry: expTs != null ? Math.max(0, Math.ceil((expTs * 1000 - nowMs) / 86400000)) : null,
    callVolume: Math.round(callVol),
    putVolume: Math.round(putVol),
    putCallVolume: callVol > 0 ? r2(putVol / callVol) : null,
    callOI: oiOk ? Math.round(callOI) : null,
    putOI: oiOk ? Math.round(putOI) : null,
    putCallOI: oiOk && callOI > 0 ? r2(putOI / callOI) : null,
    maxPain: oiOk ? optionMaxPain(calls, puts) : null,
    atmStrike: atm ? atm.c.strike : null,
    atmIV: atmIV != null ? Math.round(atmIV * 10) / 10 : null,
    straddle: r2(straddle),
    expectedMovePct: straddle != null && spot > 0 ? Math.round((straddle / spot) * 1000) / 10 : null,
    topOI,
  };
}

// v7 options 응답(첫 만기) + 다음 만기 응답 → 화면 payload. 만기가 없으면 null.
export function normalizeOptionsChain(firstJson, secondJson, symbol, nowMs = Date.now()) {
  const first = ((firstJson && firstJson.optionChain && firstJson.optionChain.result) || [])[0];
  if (!first || !Array.isArray(first.expirationDates) || !first.expirationDates.length) return null;
  const quote = first.quote || {};
  const spot = finiteOrNull(quote.regularMarketPrice);
  const expiries = [];
  const a = summarizeOptionExpiry((first.options || [])[0], spot, nowMs);
  if (a) expiries.push(a);
  const second = ((secondJson && secondJson.optionChain && secondJson.optionChain.result) || [])[0];
  const b = second ? summarizeOptionExpiry((second.options || [])[0], spot, nowMs) : null;
  if (b && (!a || b.expiry !== a.expiry)) expiries.push(b);
  if (!expiries.length) return null;
  return {
    symbol: String(symbol || first.underlyingSymbol || ""),
    price: spot,
    currency: quote.currency || null,
    expiries,
    expirationCount: first.expirationDates.length,
    updatedAt: new Date(nowMs).toISOString(),
  };
}

async function handleOptions(symbol) {
  const key = `https://mir-options.cache/v1/${encodeURIComponent(symbol)}`;
  const hit = await cacheGet(key);
  if (hit) return hit;
  const base = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;
  const r1 = await yahooAuthedFetch(base);
  // crumb 세션이 없다(부트스트랩 실패·음성 캐시 중) — 짧게만 실패를 알린다.
  if (!r1) return json({ error: "no_session" }, 503, 0);
  if (!r1.ok) return json({ error: "upstream", status: r1.status }, 502, 0);
  const firstJson = await r1.json();
  const first = ((firstJson && firstJson.optionChain && firstJson.optionChain.result) || [])[0];
  const dates = (first && Array.isArray(first.expirationDates)) ? first.expirationDates : [];
  if (!dates.length) {
    const none = json({ error: "no_options", symbol }, 404, 3600);
    await cachePut(key, none);
    return none;
  }
  let secondJson = null;
  if (dates.length > 1) {
    try {
      const r2resp = await yahooAuthedFetch(`${base}?date=${encodeURIComponent(dates[1])}`);
      if (r2resp && r2resp.ok) secondJson = await r2resp.json();
    } catch (_) { /* 다음 만기 없이 첫 만기만 */ }
  }
  const payload = normalizeOptionsChain(firstJson, secondJson, symbol);
  if (!payload) return json({ error: "no_data", symbol }, 404, 600);
  const resp = json(payload, 200, OPTIONS_CACHE_SEC);
  await cachePut(key, resp);
  return resp;
}

// ?insights= / ?options= 의 심볼 정리 — ?ticker= 와 같은 규칙(국내 .KS/.KQ 유지, 미국 BRK.B → BRK-B).
export function routeSymbol(raw) {
  const t = String(raw || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 16);
  if (!t) return "";
  return isKoreanTicker(t) ? t : t.replace(/\./g, "-");
}

function json(obj, status = 200, cacheSeconds = 900) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}`,
    },
  });
}

// 캐시하면 안 되는 응답(모르는 경로·거부 등). max-age=0 만으로는 공유 캐시가
// 저장 자체는 할 수 있어 no-store 로 못 박는다.
function noStoreJson(obj, status = 404) {
  const r = json(obj, status, 0);
  r.headers.set("Cache-Control", "no-store");
  return r;
}

// 같은 URL 이라도 Origin 에 따라 본문이 달라지는 응답(LLM 요약 포함 여부)에 붙인다.
// 없으면 Origin 없는 호출이 만든 "요약 빈" 응답이 15분 동안 브라우저 요청에도
// 그대로 나가고, 반대로 요약이 든 응답이 남에게 공유될 수 있다(감사 P1-3).
function varyOrigin(resp) {
  resp.headers.set("Vary", "Origin");
  return resp;
}

function cors(resp) {
  const r = new Response(resp.body, resp);
  r.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  r.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  return r;
}

// =============================================================================
// 커뮤니티 라우팅 — KV 직접 경로 / Durable Object 경로
// =============================================================================
//
// 게시글은 KV 키 하나에 배열로 들어 있어서, 두 요청이 겹치면 늦게 쓴 쪽이 먼저
// 쓴 쪽을 통째로 덮는다(글이 조용히 사라진다). KV 에는 CAS 가 없어 아래
// mutateVersionedList 의 version/stamp + 3회 재시도는 어디까지나 완화책이고,
// 진짜 해결은 단일 writer 로 직렬화하는 Durable Object 다.
//
// 다만 DO 는 (1) Workers **유료 플랜**이 필요하고 (2) wrangler.toml 의 migrations
// 로만 만들 수 있는데, 이 워커는 대시보드 붙여넣기로 배포한다. 그래서 바인딩
// 유무로 갈리는 **능력 검사**로 넣는다:
//   env.COMMUNITY_DO 있음 → 모든 /community* 요청을 DO 인스턴스 한 개로 몰아
//                            직렬 실행(데이터는 DO storage).
//   env.COMMUNITY_DO 없음 → 지금까지의 KV + version 재시도 경로 그대로(동작 불변).
// 두 경로는 같은 핸들러 코드를 쓴다 — DO 안에서는 COMMUNITY_KV 자리에 DO storage
// 를 감싼 shim 을 끼워 넣을 뿐이다.
const COMMUNITY_DO_NAME = "community:v1";

// 메서드+경로 → 핸들러. 엣지와 DO 안에서 같은 표를 본다(라우팅이 갈라지지 않게).
// 표에 없으면 null → 커뮤니티 경로가 아니므로 나머지 라우팅으로 넘어간다.
export function communityHandlerFor(method, pathname) {
  switch (`${method} ${pathname}`) {
    case "GET /community": return (request, url, env) => handleCommunityList(url, env, request);
    case "POST /community": return (request, url, env) => handleCommunityCreate(request, env);
    case "DELETE /community": return (request, url, env) => handleCommunityDelete(request, env);
    case "POST /community/comment": return (request, url, env) => handleCommunityCommentCreate(request, env);
    case "DELETE /community/comment": return (request, url, env) => handleCommunityCommentDelete(request, env);
    case "POST /community/like": return (request, url, env) => handleCommunityLike(request, env);
    case "POST /community/report": return (request, url, env) => handleCommunityReport(request, env);
    case "GET /community/reports": return (request, url, env) => handleCommunityReportsList(url, env, request);
    case "POST /community/vote": return (request, url, env) => handleCommunityVote(request, env);
    case "GET /community/votes": return (request, url, env) => handleCommunityVotesList(url, env);
    case "POST /community/clear": return (request, url, env) => handleCommunityClear(request, env);
    default: return null;
  }
}

// 읽기까지 DO 로 보내는 이유: 쓰기만 DO 로 보내면 데이터는 DO storage 에 쌓이는데
// 목록은 KV 를 읽어 게시판이 멈춘 것처럼 보인다. 한 곳에서만 읽고 쓴다.
async function dispatchCommunity(request, url, env, handler) {
  if (env && env.COMMUNITY_DO) {
    try {
      const stub = env.COMMUNITY_DO.get(env.COMMUNITY_DO.idFromName(COMMUNITY_DO_NAME));
      return await stub.fetch(request);
    } catch (err) {
      // KV 로 조용히 되돌리지 않는다 — 두 저장소가 갈라지면 글이 반쪽씩 남는다.
      console.error("community DO dispatch failed:", err);
      return json({
        posts: [],
        error: "community_do_unavailable",
        message: "커뮤니티 저장소에 접근하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      }, 503, 0);
    }
  }
  return handler(request, url, env);
}

// DO storage 를 KV 인터페이스(get/put/delete)로 감싼다. 핸들러 코드가 KV 인지
// DO 인지 몰라도 되게 하는 어댑터다.
//  - 값은 { v, e } 봉투로 저장한다(e = 만료 epoch ms, 0 이면 무기한).
//    KV 의 expirationTtl 을 흉내내야 IP 리밋 카운터가 영원히 남지 않는다.
//  - seedKv 가 있으면 키를 처음 읽을 때 기존 KV 값을 한 번 복사해 온다
//    (DO 를 켜는 순간 기존 게시글이 사라지지 않게 하는 이관 경로).
function durableKvShim(storage, seedKv) {
  const seeded = new Set();
  const decode = (raw, type) => {
    if (raw == null) return null;
    return type === "json" ? JSON.parse(raw) : raw;
  };
  return {
    async get(key, type) {
      const entry = await storage.get(key);
      if (entry && typeof entry === "object") {
        if (entry.e && Date.now() > entry.e) {
          await storage.delete(key);
          return null;
        }
        return decode(entry.v, type);
      }
      if (!seedKv || seeded.has(key)) return null;
      seeded.add(key);
      try {
        const fromKv = await seedKv.get(key);
        if (fromKv == null) return null;
        await storage.put(key, { v: String(fromKv), e: 0 });
        return decode(String(fromKv), type);
      } catch (err) {
        console.error("community DO seed from KV failed:", err);
        return null;
      }
    },
    async put(key, value, options) {
      const ttl = options && Number(options.expirationTtl);
      await storage.put(key, { v: String(value), e: ttl ? Date.now() + ttl * 1000 : 0 });
    },
    async delete(key) {
      await storage.delete(key);
    },
  };
}

// 커뮤니티 문서를 소유하는 단일 writer.
// wrangler.toml (DEPLOY.md 참고):
//   [[durable_objects.bindings]] name = "COMMUNITY_DO" class_name = "CommunityStore"
//   [[migrations]] tag = "v1" new_classes = ["CommunityStore"]
export class CommunityStore {
  constructor(state, env) {
    this.state = state;
    this.env = {
      ...(env || {}),
      // 핸들러가 보는 COMMUNITY_KV 를 DO storage 로 바꾼다. 기존 KV 는 seed 용으로만.
      COMMUNITY_KV: durableKvShim(state.storage, env && env.COMMUNITY_KV),
      // 재귀 디스패치 방지(DO 안에서 다시 DO 로 보내지 않는다).
      COMMUNITY_DO: null,
      // 아래 mutateVersionedList 에 "이미 직렬화돼 있다"고 알린다 —
      // KV 용 write-then-verify 재시도를 건너뛰고 한 번만 읽고 쓴다.
      COMMUNITY_SERIALIZED: true,
    };
    this.chain = Promise.resolve();
  }

  // DO 는 스레드가 하나지만 await 지점마다 다른 요청이 끼어들 수 있다
  // (Cloudflare 의 input gate 는 storage 대기 구간만 막는다). 읽기-수정-쓰기가
  // 통째로 겹치지 않도록 요청을 명시적 큐로 한 번에 하나씩만 돌린다.
  serialize(task) {
    const run = this.chain.then(task, task);
    this.chain = run.then(() => {}, () => {});
    return run;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const handler = communityHandlerFor(request.method, url.pathname);
    if (!handler) return json({ error: "not_found" }, 404, 0);
    return this.serialize(() => handler(request, url, this.env));
  }
}

// =============================================================================
// Shared community board (Cloudflare KV: COMMUNITY_KV)
// =============================================================================

const COMMUNITY_KV_KEY = "community:v1:posts";
const COMMUNITY_MAX_POSTS = 400;
const COMMUNITY_MAX_CONTENT = 12000;
const COMMUNITY_MAX_COMMENT_CONTENT = 4000;
const COMMUNITY_MAX_COMMENTS_PER_POST = 80;
const COMMUNITY_MAX_AUTHOR = 24;
// 스팸 방지
const COMMUNITY_POST_COOLDOWN_MS = 12000;
const COMMUNITY_COMMENT_COOLDOWN_MS = 6000;
const COMMUNITY_DUP_WINDOW_MS = 600000;
const COMMUNITY_MAX_LINKS = 2;
const COMMUNITY_BANNED_PATTERNS = [/viagra|카지노|토토사이트|먹튀|불법대출/i];
// 신고가 이 건수 이상 쌓인 글·댓글은 공개 목록에서 자동 숨김(작성자 본인·관리자 제외).
// 세는 단위는 신고 **건수가 아니라 서로 다른 신고자 수**다 — 기준은 해시 IP,
// 없으면 clientId. clientId 는 브라우저가 만드는 값이라 세 번 갈아 끼우면 아무 글이나
// 내릴 수 있었고, 앞단의 ipRateLimited(KV 고정창)는 엣지 간 최종 일관성이라 원자적
// 방어가 못 된다(감사 P2-3).
const COMMUNITY_REPORT_HIDE_THRESHOLD = 3;

export function distinctReporterCount(row) {
  const reports = Array.isArray(row && row.reports) ? row.reports : [];
  const seen = new Set();
  for (const r of reports) {
    if (!r) continue;
    if (r.ipHash) seen.add(`ip:${r.ipHash}`);
    else if (r.clientId) seen.add(`cid:${r.clientId}`);
  }
  return seen.size;
}

// 투표(별도 KV) — 하루 1표, 35일 보관
const COMMUNITY_VOTES_KV_KEY = "community:v1:votes";
const COMMUNITY_VOTE_CHOICES = ["buy", "sell"];
const COMMUNITY_MAX_VOTES = 8000;
const COMMUNITY_VOTE_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;

// /sync/prefs PUT 바디 상한(바이트). 워치리스트 80 + 포트폴리오 60 + 알림 설정이면 수 KB 다.
const SYNC_PREFS_MAX_BODY_BYTES = 32 * 1024;
// 설정 키 보관 기간 — 갱신할 때마다 연장된다(180일 무활동이면 만료).
const SYNC_PREFS_TTL_SEC = 180 * 24 * 60 * 60;

function communityLinkCount(text) {
  return (String(text || "").match(/https?:\/\/|www\./gi) || []).length;
}

function communitySpamReason(content) {
  if (COMMUNITY_BANNED_PATTERNS.some((re) => re.test(content))) return "banned_word";
  if (communityLinkCount(content) > COMMUNITY_MAX_LINKS) return "too_many_links";
  return null;
}

function communityDayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function communityKvMissing() {
  return json({
    posts: [],
    error: "no_community_kv",
    message: "Worker에 COMMUNITY_KV 바인딩이 필요합니다.",
  }, 503, 30);
}

// ── KV 단일 키 읽기-수정-쓰기 ────────────────────────────────────────────────
// 게시글 전체가 키 하나에 배열로 들어 있어, 두 요청이 겹치면 늦게 쓴 쪽이 먼저
// 쓴 쪽을 통째로 덮는다(글이 조용히 사라짐). KV 에는 CAS 가 없다 — 완전한 해결은
// 위의 Durable Object(COMMUNITY_DO) 경로이고, 아래는 그 바인딩이 없을 때의
// 최소 완화다(같은 코드가 DO storage 위에서도 그대로 돈다): 값에 version/stamp 를 붙여 쓰고, 쓴 직후 다시 읽어 내 stamp 가
// 남아 있는지 확인한다. 같은 엣지에서는 read-after-write 가 보이므로, 그 사이
// 다른 쓰기가 끼어들었으면 stamp 가 달라지고 최신 상태 위에 변경을 다시 적용한다
// (최대 3회). mutate 는 재실행돼도 안전해야 한다(id 는 밖에서 만들어 넘길 것).
//
// 저장 형식: { version, stamp, items } — 구형 값(배열 그대로)도 읽는다.
function parseVersionedList(raw) {
  if (!raw) return { items: [], version: 0, stamp: "" };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, version: 0, stamp: "" };
    if (parsed && Array.isArray(parsed.items)) {
      return { items: parsed.items, version: Number(parsed.version) || 0, stamp: String(parsed.stamp || "") };
    }
  } catch { /* 깨진 값은 빈 목록으로 */ }
  return { items: [], version: 0, stamp: "" };
}

async function loadVersionedList(env, key) {
  return parseVersionedList(await env.COMMUNITY_KV.get(key));
}

// mutate(items) → { items: next, response } 이면 next 를 쓰고 response 를 돌려준다.
//                 { response } 만 주면 쓰지 않고 그대로 응답한다(404·403·쿨다운 등).
// 반환값은 항상 Response 다.
function newVersionStamp() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function mutateVersionedList(env, key, mutate, maxItems) {
  const finish = (outcome) => (outcome && outcome.response ? outcome.response : json({ error: "internal" }, 500, 0));
  const capped = (items) => (maxItems ? items.slice(0, maxItems) : items);

  // Durable Object 안에서는 이 함수 자체가 이미 한 번에 하나씩만 돈다
  // (CommunityStore.serialize). 쓰고 다시 읽어 확인할 이유가 없다 — 한 번의
  // 읽기-수정-쓰기로 끝낸다. 재시도 루프를 여기서도 돌리면 storage 왕복만 3배다.
  if (env && env.COMMUNITY_SERIALIZED) {
    const state = await loadVersionedList(env, key);
    const outcome = await mutate(state.items, 1);
    if (!outcome || !Array.isArray(outcome.items)) return finish(outcome);
    await env.COMMUNITY_KV.put(key, JSON.stringify({
      version: state.version + 1,
      stamp: newVersionStamp(),
      items: capped(outcome.items),
    }));
    return finish(outcome);
  }

  let outcome = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const state = await loadVersionedList(env, key);
    outcome = await mutate(state.items, attempt);
    if (!outcome || !Array.isArray(outcome.items)) return finish(outcome);
    const stamp = newVersionStamp();
    await env.COMMUNITY_KV.put(key, JSON.stringify({ version: state.version + 1, stamp, items: capped(outcome.items) }));
    const check = await loadVersionedList(env, key);
    if (check.stamp === stamp) return finish(outcome);
    console.warn(`kv write conflict on ${key} (attempt ${attempt}) — retrying`);
  }
  // 3회 모두 겹쳤다. 마지막 쓰기는 KV 에 들어갔지만 곧바로 덮였을 수 있다 —
  // 요청 자체는 성공으로 답한다(클라이언트가 재시도하면 중복이 더 나쁘다).
  return finish(outcome);
}

async function loadCommunityPostsKv(env) {
  return (await loadVersionedList(env, COMMUNITY_KV_KEY)).items;
}

function mutateCommunityPosts(env, mutate) {
  return mutateVersionedList(env, COMMUNITY_KV_KEY, mutate, COMMUNITY_MAX_POSTS);
}

async function loadCommunityVotesKv(env) {
  return (await loadVersionedList(env, COMMUNITY_VOTES_KV_KEY)).items;
}

function pruneCommunityVotes(votes) {
  const cutoff = Date.now() - COMMUNITY_VOTE_RETENTION_MS;
  return votes.filter((v) => Date.parse(v.at) >= cutoff).slice(-COMMUNITY_MAX_VOTES);
}

function mutateCommunityVotes(env, mutate) {
  // 투표는 오래된 것부터 잘라야 하므로(뒤가 최신) maxItems 대신 prune 을 mutate 안에서 건다.
  return mutateVersionedList(env, COMMUNITY_VOTES_KV_KEY, mutate, 0);
}

function sanitizeCommunityTicker(raw) {
  const t = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  return t.slice(0, 12);
}

function sanitizeCommunityAuthor(raw) {
  return String(raw || "").trim().replace(/[<>]/g, "").slice(0, COMMUNITY_MAX_AUTHOR) || "익명";
}

function sanitizeCommunityContent(raw) {
  return String(raw || "").trim().replace(/\r\n/g, "\n").slice(0, COMMUNITY_MAX_CONTENT);
}

function sanitizeCommunityCommentContent(raw) {
  return String(raw || "").trim().replace(/\r\n/g, "\n").slice(0, COMMUNITY_MAX_COMMENT_CONTENT);
}

function normalizeCommunityComments(raw) {
  return Array.isArray(raw) ? raw : [];
}

function sanitizeCommunityClientId(raw) {
  return String(raw || "").trim().replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64);
}

function newCommunityPostId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function rateLimitedResponse() {
  return json({ error: "too_fast", message: "잠시 후 다시 시도해 주세요." }, 429, 0);
}

async function readJsonBody(request) {
  try {
    return { body: await request.json() };
  } catch {
    return { response: json({ error: "bad_json" }, 400, 30) };
  }
}

async function handleCommunityList(url, env, request) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const posts = await loadCommunityPostsKv(env);
  const ticker = sanitizeCommunityTicker(url.searchParams.get("ticker"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 80));
  const filtered = ticker ? posts.filter((p) => p.ticker === ticker) : posts;

  // clientId 는 삭제 권한의 근거다(아래 handleCommunityDelete 의
  // target.clientId !== clientId). 그래서 목록 응답에 그대로 실으면, 누구나 남의
  // clientId 를 읽어 그 사람 글·댓글을 지울 수 있다(/community/clear 는 통째로).
  // likes 배열도 좋아요를 누른 사람들의 clientId 목록이라 같은 유출 경로였다.
  // → 원본 id 는 서버에만 두고, 요청자 기준으로 계산한 불리언만 내보낸다.
  const viewer = sanitizeCommunityClientId(url.searchParams.get("clientId"));
  const isViewer = (id) => Boolean(viewer) && id === viewer;
  const isAdmin = await communityAdminOk(env, request, url.searchParams.get("adminKey"));

  // 신고 누적 자동 숨김: 신고 3건 이상이면 공개 목록에서 제외한다.
  // 단, 작성자 본인과 관리자에게는 보이고(본인 글에는 hiddenByReports 마커를 실어
  // 클라이언트가 "신고 누적으로 숨김 처리됨" 상태를 안내), 신고 내역(reports 배열,
  // clientId 포함)은 계속 서버에만 남긴다.
  const reportCountOf = distinctReporterCount;
  const isHidden = (row) => reportCountOf(row) >= COMMUNITY_REPORT_HIDE_THRESHOLD;
  const visible = filtered.filter((p) => !isHidden(p) || isAdmin || isViewer(p.clientId));
  const publicPosts = visible.slice(0, limit).map((p) => {
    const { reports, clientId, likes, comments, ...rest } = p;
    const likeList = Array.isArray(likes) ? likes : [];
    const out = {
      ...rest,
      mine: isViewer(clientId),
      likeCount: likeList.length,
      liked: likeList.some(isViewer),
      comments: normalizeCommunityComments(comments)
        .filter((c) => !isHidden(c) || isAdmin || isViewer(c.clientId))
        .map((c) => {
          const { clientId: commentClientId, reports: commentReports, ...commentRest } = c;
          const commentOut = { ...commentRest, mine: isViewer(commentClientId) };
          if (isHidden(c) && (isViewer(commentClientId) || isAdmin)) {
            commentOut.hiddenByReports = reportCountOf(c);
          }
          return commentOut;
        }),
    };
    if (isHidden(p) && (isViewer(clientId) || isAdmin)) out.hiddenByReports = reportCountOf(p);
    return out;
  });
  const resp = json({ posts: publicPosts, total: visible.length }, 200, 8);
  // 요청자별로 mine/liked 가 달라지므로 공유 캐시에 담기면 안 된다. URL 에
  // clientId 가 들어가 키 자체는 갈리지만, 의도를 헤더로도 못박아 둔다.
  if (viewer) resp.headers.set("Cache-Control", "private, max-age=8");
  return resp;
}

async function handleCommunityCreate(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const content = sanitizeCommunityContent(body && body.content);
  if (content.length < 2) return json({ error: "content_too_short" }, 400, 30);
  const author = sanitizeCommunityAuthor(body && body.author);
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  const spam = communitySpamReason(content);
  if (spam) return json({ error: spam, message: "스팸으로 의심되는 내용이 포함되어 등록할 수 없습니다." }, 400, 0);
  // clientId 쿨다운은 매 요청 새 id 를 지어내면 우회된다(400포스트 캡이라 기존
  // 글 밀어내기 가능). IP 기준 보조 리밋을 함께 건다.
  if (await ipRateLimited(request, env, "post", 3, 60)) return rateLimitedResponse();
  const ticker = sanitizeCommunityTicker(body && body.ticker);
  const post = {
    id: newCommunityPostId(),
    author,
    clientId,
    ticker: ticker || "",
    content,
    createdAt: new Date().toISOString(),
  };
  return mutateCommunityPosts(env, (posts) => {
    // 재시도에서 이미 들어간 글이면 다시 넣지 않는다.
    if (posts.some((p) => p.id === post.id)) return { response: json({ ok: true, post }, 201, 0) };
    const now = Date.now();
    const lastByClient = posts.find((p) => p.clientId === clientId);
    if (lastByClient) {
      const dt = now - Date.parse(lastByClient.createdAt);
      if (dt >= 0 && dt < COMMUNITY_POST_COOLDOWN_MS) return { response: rateLimitedResponse() };
    }
    const isDuplicate = posts.some((p) =>
      p.clientId === clientId && p.content === content && (now - Date.parse(p.createdAt)) < COMMUNITY_DUP_WINDOW_MS);
    if (isDuplicate) return { response: json({ error: "duplicate", message: "같은 내용을 방금 등록했습니다." }, 409, 0) };
    return { items: [post, ...posts], response: json({ ok: true, post }, 201, 0) };
  });
}

async function handleCommunityDelete(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const id = String(body && body.id || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  const isAdmin = await communityAdminOk(env, request, body && body.adminKey);
  if (!id || (!clientId && !isAdmin)) return json({ error: "missing_fields" }, 400, 30);
  return mutateCommunityPosts(env, (posts) => {
    const target = posts.find((p) => p.id === id);
    if (!target) return { response: json({ error: "not_found" }, 404, 30) };
    if (!isAdmin && target.clientId !== clientId) return { response: json({ error: "forbidden" }, 403, 30) };
    return { items: posts.filter((p) => p.id !== id), response: json({ ok: true, deleted: id }, 200, 0) };
  });
}

async function handleCommunityCommentCreate(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const postId = String(body && body.postId || "").trim();
  const content = sanitizeCommunityCommentContent(body && body.content);
  if (!postId) return json({ error: "missing_post_id" }, 400, 30);
  if (content.length < 2) return json({ error: "content_too_short" }, 400, 30);
  // 글쓰기와 같은 이유의 IP 보조 리밋(clientId 는 위조 가능).
  if (await ipRateLimited(request, env, "comment", 6, 60)) return rateLimitedResponse();
  const author = sanitizeCommunityAuthor(body && body.author);
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  const spam = communitySpamReason(content);
  if (spam) return json({ error: spam, message: "스팸으로 의심되는 내용이 포함되어 등록할 수 없습니다." }, 400, 0);
  const comment = {
    id: newCommunityPostId(),
    author,
    clientId,
    content,
    createdAt: new Date().toISOString(),
  };
  return mutateCommunityPosts(env, (posts) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { response: json({ error: "not_found" }, 404, 30) };
    const existing = normalizeCommunityComments(post.comments);
    if (existing.some((c) => c.id === comment.id)) {
      return { response: json({ ok: true, postId, comment }, 201, 0) };
    }
    const now = Date.now();
    let lastCommentAt = 0;
    for (const p of posts) {
      for (const c of (Array.isArray(p.comments) ? p.comments : [])) {
        if (c.clientId === clientId) {
          const t = Date.parse(c.createdAt);
          if (Number.isFinite(t) && t > lastCommentAt) lastCommentAt = t;
        }
      }
    }
    if (lastCommentAt && (now - lastCommentAt) < COMMUNITY_COMMENT_COOLDOWN_MS) {
      return { response: rateLimitedResponse() };
    }
    post.comments = [...existing, comment].slice(-COMMUNITY_MAX_COMMENTS_PER_POST);
    return { items: posts, response: json({ ok: true, postId, comment }, 201, 0) };
  });
}

async function handleCommunityLike(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const postId = String(body && body.postId || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!postId) return json({ error: "missing_post_id" }, 400, 30);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  // 좋아요 토글 루프는 KV 쓰기(=유료 한도)와 posts 키 경합만 늘린다.
  if (await ipRateLimited(request, env, "like", 30, 60)) return rateLimitedResponse();
  return mutateCommunityPosts(env, (posts) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { response: json({ error: "not_found" }, 404, 30) };
    const likes = Array.isArray(post.likes) ? post.likes : [];
    const idx = likes.indexOf(clientId);
    let liked;
    if (idx >= 0) {
      likes.splice(idx, 1);
      liked = false;
    } else {
      likes.push(clientId);
      liked = true;
    }
    post.likes = likes;
    return { items: posts, response: json({ ok: true, postId, likeCount: likes.length, liked }, 200, 0) };
  });
}

async function handleCommunityReport(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const postId = String(body && body.postId || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!postId) return json({ error: "missing_post_id" }, 400, 30);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  // 신고 3건이면 자동 숨김이라, clientId 만 바꿔 가며 세 번 부르면 아무 글이나
  // 내릴 수 있었다. IP 리밋 + 해시 IP 중복 판정으로 막는다.
  if (await ipRateLimited(request, env, "report", 5, 60)) return rateLimitedResponse();
  const ipHash = await hashedIp(request, env);
  const reason = String(body && body.reason || "").trim().slice(0, 200);
  return mutateCommunityPosts(env, (posts) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { response: json({ error: "not_found" }, 404, 30) };
    const reports = Array.isArray(post.reports) ? post.reports : [];
    const already = reports.some((r) => r && (r.clientId === clientId || (r.ipHash && r.ipHash === ipHash)));
    // reportCount 는 자동 숨김 판정과 같은 단위(서로 다른 신고자 수)로 돌려준다.
    if (already) return { response: json({ ok: true, postId, reportCount: distinctReporterCount(post) }, 200, 0) };
    reports.push({ clientId, ipHash, reason, at: new Date().toISOString() });
    post.reports = reports;
    return { items: posts, response: json({ ok: true, postId, reportCount: distinctReporterCount(post) }, 200, 0) };
  });
}

// 관리자 전용: 신고된 글 목록 + 신고 내역(X-Admin-Key 헤더, 구형 adminKey 쿼리 폴백)
async function handleCommunityReportsList(url, env, request) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  if (!(await communityAdminOk(env, request, url.searchParams.get("adminKey")))) {
    return json({ error: "forbidden" }, 403, 0);
  }
  const posts = await loadCommunityPostsKv(env);
  const reported = posts
    .filter((p) => Array.isArray(p.reports) && p.reports.length)
    .map((p) => ({
      id: p.id,
      author: p.author,
      ticker: p.ticker || "",
      content: p.content,
      createdAt: p.createdAt,
      reportCount: distinctReporterCount(p),
      reportEntries: p.reports.length,
      hidden: distinctReporterCount(p) >= COMMUNITY_REPORT_HIDE_THRESHOLD,
      reports: p.reports,
    }))
    .sort((a, b) => b.reportCount - a.reportCount);
  return json({ posts: reported, total: reported.length }, 200, 0);
}

// 투표: 하루 1표(같은 날 재투표 시 교체). 게시글이 아니라 종목 대상.
// clientId 는 위조 가능하므로 해시 IP 기준으로도 하루 1표다.
async function handleCommunityVote(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  const ticker = sanitizeCommunityTicker(body && body.ticker);
  const choice = String(body && body.choice || "").trim().toLowerCase();
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  if (!ticker) return json({ error: "missing_ticker" }, 400, 30);
  if (!COMMUNITY_VOTE_CHOICES.includes(choice)) return json({ error: "bad_choice" }, 400, 30);
  if (await ipRateLimited(request, env, "vote", 5, 60)) return rateLimitedResponse();
  const ipHash = await hashedIp(request, env);
  const vote = { clientId, ipHash, ticker, choice, at: new Date().toISOString() };
  return mutateCommunityVotes(env, (votes) => {
    const today = communityDayKey(Date.now());
    const sameDay = (v) => communityDayKey(Date.parse(v.at)) === today;
    // 하루 1표 — 같은 날 표(같은 clientId 또는 같은 IP)는 새 선택으로 교체
    const kept = votes.filter((v) => !(sameDay(v) && (v.clientId === clientId || (v.ipHash && v.ipHash === ipHash))));
    kept.push(vote);
    const { ipHash: _omit, ...publicVote } = vote;
    return { items: pruneCommunityVotes(kept), response: json({ ok: true, vote: publicVote }, 200, 0) };
  });
}

// 투표 순위: ?period=day|week|month, ?clientId= (내 오늘 투표 표시용)
async function handleCommunityVotesList(url, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const period = String(url.searchParams.get("period") || "day").toLowerCase();
  const clientId = sanitizeCommunityClientId(url.searchParams.get("clientId"));
  const days = period === "month" ? 30 : period === "week" ? 7 : 1;
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const votes = await loadCommunityVotesKv(env);
  // 유효한 선택(매수/매도)만 집계 — 옛 '관망' 등 무효 표는 총계에서도 제외해 숫자 불일치 방지
  const inRange = votes.filter((v) => Date.parse(v.at) >= cutoff && COMMUNITY_VOTE_CHOICES.includes(v.choice));
  const byTicker = new Map();
  for (const v of inRange) {
    if (!byTicker.has(v.ticker)) byTicker.set(v.ticker, { ticker: v.ticker, total: 0, buy: 0, sell: 0 });
    const row = byTicker.get(v.ticker);
    row.total += 1;
    if (row[v.choice] != null) row[v.choice] += 1;
  }
  const rows = [...byTicker.values()];
  const buyRanking = rows.filter((r) => r.buy > 0).sort((a, b) => b.buy - a.buy || b.total - a.total).slice(0, 20);
  const sellRanking = rows.filter((r) => r.sell > 0).sort((a, b) => b.sell - a.sell || b.total - a.total).slice(0, 20);
  const today = communityDayKey(Date.now());
  const mine = clientId
    ? (votes.find((v) => v.clientId === clientId && communityDayKey(Date.parse(v.at)) === today) || null)
    : null;
  const myToday = mine ? { clientId: mine.clientId, ticker: mine.ticker, choice: mine.choice, at: mine.at } : null;
  return json({ period, buyRanking, sellRanking, totalVotes: inRange.length, myToday }, 200, 8);
}

async function handleCommunityCommentDelete(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const postId = String(body && body.postId || "").trim();
  const commentId = String(body && body.commentId || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!postId || !commentId || !clientId) return json({ error: "missing_fields" }, 400, 30);
  return mutateCommunityPosts(env, (posts) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { response: json({ error: "not_found" }, 404, 30) };
    const comments = normalizeCommunityComments(post.comments);
    const target = comments.find((c) => c.id === commentId);
    if (!target) return { response: json({ error: "comment_not_found" }, 404, 30) };
    if (target.clientId !== clientId) return { response: json({ error: "forbidden" }, 403, 30) };
    post.comments = comments.filter((c) => c.id !== commentId);
    return { items: posts, response: json({ ok: true, postId, deleted: commentId }, 200, 0) };
  });
}

// =============================================================================
// Cloud sync (watchlist / portfolio / alerts)
// =============================================================================

function syncKvKey(clientId) {
  return `sync:prefs:${clientId}`;
}

// 개인 설정은 clientId 가 곧 자격증명이다. 공유 캐시(CDN·프록시)에 남으면 안 된다.
function privateJson(obj, status = 200) {
  const r = json(obj, status, 0);
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}

async function handleSyncPrefsGet(url, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const clientId = sanitizeCommunityClientId(url.searchParams.get("clientId"));
  if (!clientId) return privateJson({ error: "missing_client_id" }, 400);
  const raw = await env.COMMUNITY_KV.get(syncKvKey(clientId));
  if (!raw) return privateJson({ prefs: null });
  try {
    return privateJson({ prefs: JSON.parse(raw) });
  } catch {
    return privateJson({ prefs: null });
  }
}

async function handleSyncPrefsPut(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  // 쓰기 경로는 허용 Origin(사이트·로컬 서버)에서만. 예전엔 curl 한 줄로 아무
  // clientId 의 설정을 덮어쓰고 KV 키를 무한히 만들 수 있었다(감사 P1-4).
  if (!llmOriginAllowed(request)) return privateJson({ error: "forbidden_origin" }, 403);
  if (await ipRateLimited(request, env, "sync_put", 10, 60)) return rateLimitedResponse();
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > SYNC_PREFS_MAX_BODY_BYTES) return privateJson({ error: "payload_too_large" }, 413);
  let text;
  try { text = await request.text(); } catch { return privateJson({ error: "bad_json" }, 400); }
  // 상한은 바이트 기준이다. text.length 는 UTF-16 코드유닛이라 한글 본문이면
  // 실제 크기의 1/3 로 재는 셈이었다(32KB 제한을 ~96KB 가 통과).
  if (new TextEncoder().encode(text).length > SYNC_PREFS_MAX_BODY_BYTES) return privateJson({ error: "payload_too_large" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return privateJson({ error: "bad_json" }, 400); }
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  const prefs = body && body.prefs;
  if (!clientId || !prefs || typeof prefs !== "object") return privateJson({ error: "missing_fields" }, 400);
  const payload = {
    watchlist: Array.isArray(prefs.watchlist) ? prefs.watchlist.slice(0, 80) : [],
    portfolio: Array.isArray(prefs.portfolio) ? prefs.portfolio.slice(0, 60) : [],
    alertSettings: prefs.alertSettings && typeof prefs.alertSettings === "object" ? prefs.alertSettings : {},
    updatedAt: Number(prefs.updatedAt) || Date.now(),
  };
  // 시장별 관심종목(클라이언트가 보내는데 예전엔 여기서 버려져 pull 이 구형 필드로만 복원했다)과
  // 투자 가설(thesis.js, 클라이언트가 16KB 안으로 줄여 보낸다). 전체 바디는 위 32KB 상한이 막는다.
  if (Array.isArray(prefs.watchlistUs)) payload.watchlistUs = prefs.watchlistUs.slice(0, 80);
  if (Array.isArray(prefs.watchlistKr)) payload.watchlistKr = prefs.watchlistKr.slice(0, 80);
  if (prefs.theses && typeof prefs.theses === "object" && !Array.isArray(prefs.theses)) {
    payload.theses = {
      items: Array.isArray(prefs.theses.items) ? prefs.theses.items.slice(0, 100) : [],
      deleted: Array.isArray(prefs.theses.deleted) ? prefs.theses.deleted.slice(-300) : [],
    };
  }
  // 관심 사용자 리스트·종목 메모(2026-10-21, watchlist-core.js). 보낸 시장 필드만 저장한다.
  for (const m of ["Us", "Kr"]) {
    const groups = sanitizeSyncWatchGroups(prefs[`watchGroups${m}`]);
    if (groups) payload[`watchGroups${m}`] = groups;
    const notes = sanitizeSyncWatchNotes(prefs[`watchNotes${m}`]);
    if (notes) payload[`watchNotes${m}`] = notes;
  }
  // TTL 이 없으면 한 번 만들어진 clientId 키가 영구히 남는다(익명 clientId 는
  // 브라우저 저장소를 지우면 새로 생긴다) → 180일 무갱신이면 만료.
  await env.COMMUNITY_KV.put(syncKvKey(clientId), JSON.stringify(payload), { expirationTtl: SYNC_PREFS_TTL_SEC });
  return privateJson({ ok: true, updatedAt: payload.updatedAt });
}

// 사용자 리스트: 최대 12개 · 리스트당 80종목 · 이름 20자. 배열이 아니면 null(필드를 만들지 않음).
function sanitizeSyncWatchGroups(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  const seen = new Set();
  for (const g of raw) {
    if (out.length >= 12) break;
    if (!g || typeof g !== "object") continue;
    const id = String(g.id || "").slice(0, 24);
    const name = String(g.name || "").trim().slice(0, 20);
    if (!id || !name || seen.has(id) || !Array.isArray(g.tickers)) continue;
    seen.add(id);
    const tickers = g.tickers.map((t) => String(t || "").trim().toUpperCase().slice(0, 24)).filter(Boolean).slice(0, 80);
    out.push({ id, name, tickers });
  }
  return out;
}

// 종목 메모: { TICKER: { t: 글 200자, u: 고친 시각 } } 최대 300개(빈 글은 삭제 표식). 객체가 아니면 null.
function sanitizeSyncWatchNotes(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  let n = 0;
  for (const k of Object.keys(raw)) {
    if (n >= 300) break;
    const key = String(k || "").trim().toUpperCase();
    const v = raw[k];
    const u = Number(v && v.u);
    if (!key || key.length > 24 || !v || typeof v !== "object" || !Number.isFinite(u) || u <= 0) continue;
    out[key] = { t: String(v.t == null ? "" : v.t).slice(0, 200), u };
    n += 1;
  }
  return out;
}

async function handleCommunityClear(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const { body, response: bad } = await readJsonBody(request);
  if (bad) return bad;
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  if (await ipRateLimited(request, env, "clear", 2, 60)) return rateLimitedResponse();
  return mutateCommunityPosts(env, (posts) => {
    const next = posts
      .filter((p) => p.clientId !== clientId)
      .map((p) => ({
        ...p,
        comments: normalizeCommunityComments(p.comments).filter((c) => c.clientId !== clientId),
      }));
    const removedPosts = posts.length - next.length;
    const removedComments = posts.reduce((sum, post) => {
      const comments = normalizeCommunityComments(post.comments);
      return sum + comments.filter((c) => c.clientId === clientId).length;
    }, 0);
    if (!removedPosts && !removedComments) {
      return { response: json({ ok: true, removed: 0, removedComments: 0 }, 200, 0) };
    }
    return { items: next, response: json({ ok: true, removed: removedPosts, removedComments }, 200, 0) };
  });
}

// =============================================================================
// Site help chatbot
// =============================================================================

// Knowledge base: how to use the site + finance-term glossary. Kept in the system
// prompt so the model answers from grounded facts even when its own Korean is weak.
const CHAT_SYSTEM_PROMPT = `당신은 "미르의 미국 주식" 웹사이트의 친절한 도우미 '미르'입니다.
주특기: (1) 사이트 사용법 안내, (2) 주식·재무 기본 용어 쉬운 설명.
하지만 그 외 일반적인 대화(인사, 잡담, 가벼운 질문, 응원, 일상 이야기 등)도 자연스럽고 친근하게 잘 받아 줍니다. 사용자가 편하게 말 걸 수 있는 친구 같은 챗봇이 되세요.
말투: 한국어로 따뜻하고 친근하게. 보통 2~5문장. 이모지는 가끔만 가볍게. 필요하면 짧은 예시.
중요한 규칙:
- 특정 종목의 매수/매도/목표가/투자 추천은 절대 하지 않습니다. "이 사이트는 참고용이며 투자 판단은 본인 책임"이라고 안내하세요.
- 실시간 시세나 "오늘 무엇이 올랐나" 같은 건 직접 알 수 없으니, 해당 탭(예: 급등/거래량, 상위 종목)에서 확인하라고 안내하세요.
- 모르면 모른다고 솔직히 말하세요. 지어내지 마세요.
- 일반 대화는 자유롭게 응해도 좋지만, 대화가 자연스럽게 이어질 때 가볍게 주식·사이트 기능으로 연결해 주면 좋습니다(억지로는 금지).
- 의료·법률·정치적으로 민감하거나 전문적인 사안은 단정하지 말고, 일반적인 정보 수준에서만 답하거나 전문가 상담을 권하세요.
- 욕설·혐오·불법·유해한 요청에는 정중히 응하지 않습니다.

[사이트 구성]
- 상단: SNS 아이콘(인스타·X·스레드·네이버 블로그), 데이터 기준 시각. 데이터는 매일 한국시간 오전 6시에 1회 갱신되는 스냅샷입니다(실시간 아님).
- 왼쪽 "오늘의 카드뉴스": 그날 만든 카드뉴스 본문 이미지. 클릭하면 크게 볼 수 있습니다.
- 상단 요약: Fear & Greed(공포·탐욕) 지수, 섹터 TOP5, 환율 등.
- 탭 설명:
  · 시장 지도(히트맵): 종목을 타일로. 색은 등락률·RS 점수 등 선택 지표, 타일 크기는 시가총액·거래량 배율 등 선택. 섹터별로 묶여 한눈에 강약을 봅니다.
  · 섹터 흐름: 섹터 ETF 차트 비교와 ETF 상대강도(RS) 순위.
  · 상위 종목: PER·Forward P/E·P/S·P/B·RS 점수 등 지표 기준 상위 종목.
  · 급등/거래량: 당일 급등, 거래량 급증, RS 신고가+거래량 종목.
  · 종목 분석: 티커 검색 → 차트(이동평균·볼린저·RSI·MACD·스토캐스틱)와 재무, 실시간 뉴스.
  · 내 리스트: 관심 티커를 입력해 한 번에 비교.
  · 마켓 데이터: 주요 지수·국가·채권·원자재·환율.
  · 경제 캘린더: 이번 주 한국·미국 주요 경제지표 일정.
  · AI 브리핑: 국내 장마감·미국 장전 시황과 소셜 트렌딩 종목.

[용어 사전 — 쉽게 설명할 때 참고]
- 시가총액: 주가 × 총 발행주식수. 회사의 크기.
- PER(P/E, 주가수익비율): 주가 ÷ 주당순이익(EPS). 이익 대비 주가가 비싼지 보는 지표. 낮을수록 싸 보이나 업종마다 다름.
- Forward P/E(선행 PER): 과거가 아닌 '예상 이익' 기준 PER.
- PBR(P/B, 주가순자산비율): 주가 ÷ 주당순자산. 1보다 낮으면 장부가보다 싸게 거래.
- PSR(P/S, 주가매출비율): 시가총액 ÷ 매출. 적자 성장주 평가에 유용.
- EPS(주당순이익): 순이익 ÷ 주식수. 한 주가 버는 이익.
- ROE(자기자본이익률): 순이익 ÷ 자기자본. 주주 돈으로 얼마나 효율적으로 버는지(높을수록 좋음).
- ROA(총자산이익률): 순이익 ÷ 총자산. 자산 대비 수익성.
- 배당수익률: 연 배당금 ÷ 주가.
- RS 점수(상대강도): 시장(혹은 벤치마크) 대비 주가가 얼마나 강한지 점수화(높을수록 강세). 이 사이트는 대략 3·6·12개월 수익률을 가중한 모멘텀 지표입니다.
- EPS 추정 점수: 향후 이익 추정 개선 정도를 점수화.
- RSI(상대강도지수, 14): 0~100. 보통 70 이상 과매수, 30 이하 과매도로 봅니다.
- 스토캐스틱(StochK): 최근 가격 위치를 0~100으로. 과매수/과매도 판단.
- MACD: 단기·장기 이동평균 차이로 추세·모멘텀을 보는 지표.
- 볼린저 밴드: 이동평균 ± 표준편차 밴드. 변동성과 과열/침체 가늠.
- 이동평균(SMA/EMA): 일정 기간 평균 가격선. EMA는 최근에 가중.
- 거래량 배율: 평소 평균 대비 오늘 거래량이 몇 배인지.
- YTD: 연초 대비 수익률.
- 신고가(52주): 최근 1년 최고가. 신고가 경신은 강세 신호로 봄.
- 섹터 ETF: 특정 업종(기술 XLK, 반도체 SOXX 등) 묶음에 투자하는 상품.
- Fear & Greed 지수: 시장 심리를 0(극단적 공포)~100(극단적 탐욕)으로 나타낸 지표.
- 베타: 시장 대비 변동성(1보다 크면 더 출렁임).
- 호가: 사고팔려고 내놓은 가격(매수호가·매도호가). 둘의 차이를 스프레드라 함.
- 시가/종가/고가/저가: 그날의 시작가·마감가·최고가·최저가.
- 거래대금: 거래량 × 가격. 실제로 오간 금액.
- 유통주식수: 시장에서 실제로 거래 가능한 주식 수.
- 공매도: 주식을 빌려 먼저 팔고 나중에 되사서 갚는 하락 베팅.
- 액면분할: 주식을 쪼개 주당 가격을 낮추고 주식 수를 늘림(시가총액은 그대로).
- 배당락: 배당 받을 권리가 사라지는 날. 그만큼 주가가 조정됨.
- 배당성향: 순이익 중 배당으로 나눠주는 비율.
- 우선주/보통주: 우선주는 배당이 우선이나 보통 의결권이 없음.
- ETF: 여러 종목을 묶어 한 번에 사고파는 상장 펀드.
- 지수(인덱스): S&P500(대형 500), 나스닥(기술주 중심), 다우(우량 30) 같은 시장 묶음 지표.
- VIX(변동성지수): S&P500의 기대 변동성. '공포지수'라고도 부름.
- 골든크로스/데드크로스: 단기 이동평균선이 장기선을 위로/아래로 뚫는 신호.
- 지지선/저항선: 가격이 잘 안 내려가는/잘 못 올라가는 가격대.
- 어닝(실적발표): 분기마다 회사가 실적을 공개하는 것.
- 컨센서스: 여러 애널리스트 예상치의 평균.
- 어닝 서프라이즈: 실적이 예상보다 크게 좋거나 나쁘게 나온 것.
- 가이던스: 회사가 스스로 내놓는 향후 실적 전망.
- 10-K / 10-Q: 미국 기업의 연간 / 분기 공식 보고서.
- 대형주/중형주/소형주: 시가총액 규모로 나눈 분류.
- 성장주/가치주: 빠른 성장 기대 vs 저평가·안정 배당 성격.
- 경기민감주/경기방어주: 경기 따라 크게 출렁 vs 경기와 덜 무관(필수소비·헬스케어 등).
- 리츠(REITs): 부동산에 투자해 임대수익 등을 배당으로 주는 상품.
- 채권수익률(금리): 보통 금리가 오르면 성장주에 부담이 됨.
- 연준(Fed)/FOMC: 미국 중앙은행 / 기준금리를 정하는 회의.
- CPI(소비자물가지수): 물가 상승률. 금리와 시장에 큰 영향.
- 달러인덱스(DXY): 주요 통화 대비 달러가 얼마나 센지.
- 시간외 거래(프리마켓/애프터마켓): 정규장 시작 전·마감 후의 거래.
- 분산투자: 여러 자산에 나눠 담아 위험을 줄이는 것.

[자주 묻는 질문(FAQ) — 이렇게 안내하세요]
- "가격이 실시간인가요?" → 아니요. 매일 한국시간 오전 6시에 1회 갱신되는 스냅샷 기준입니다. 실시간 시세는 증권사 앱에서 확인하세요.
- "특정 종목을 찾고 싶어요" → '종목 분석' 탭에서 티커(예: AAPL, NVDA)로 검색하면 차트·재무·뉴스를 볼 수 있어요.
- "여러 종목을 한 번에 비교하려면?" → '내 리스트' 탭에 관심 티커들을 입력하면 한눈에 비교됩니다.
- "오늘 많이 오른/거래량 터진 종목은?" → '급등/거래량' 탭에서 확인하세요(스냅샷 기준).
- "히트맵 색이나 타일 크기 기준을 바꾸려면?" → '시장 지도' 탭에서 지표를 고르세요(색=등락률·RS 등, 크기=시가총액·거래량 등).
- "카드뉴스가 뭔가요?" → 그날의 시황을 이미지로 요약한 콘텐츠예요. 클릭하면 크게 볼 수 있습니다.
- "이번 주 경제 일정이 궁금해요" → '경제 캘린더' 탭에서 한국·미국 주요 지표 일정을 보세요.
- "이 종목 사도 돼요? / 목표가 알려줘" → 죄송하지만 특정 종목의 매수·매도·목표가는 안내하지 않아요. 참고용 지표만 제공하며 투자 판단은 본인 책임입니다.`;

// 시장별 시스템 프롬프트. 위 본문은 미국 모드 기준으로 쓰였다 — 국내 화면(미르의 한국 주식)에서
// 같은 프롬프트가 나가면 모델이 "미국 주식 사이트"라 자기소개하고 13F·Form 4 를 국내 종목에 찾는다.
// 사이트 이름·검색 예시만 바꾸고, 시장 맥락 한 단락을 붙인다(규칙·용어 사전은 공통).
const CHAT_MARKET_NOTE = {
  us: `

[현재 시장 모드: 미국]
- 사용자는 미국 주식(NYSE·나스닥) 화면을 보고 있습니다. 가격은 달러, 공시는 SEC(10-K·10-Q·8-K) 기준입니다.`,
  kr: `

[현재 시장 모드: 국내]
- 사용자는 한국 주식(코스피·코스닥) 화면을 보고 있습니다. 가격은 원화, 공시는 DART(전자공시) 기준이고, 종목은 6자리 코드(예: 005930)로 찾습니다.
- 수급은 외국인·기관·개인 순매수로 봅니다. 미국 전용 데이터(13F 기관 보유·내부자 Form 4·의회 매매)는 국내 종목에 없으니 있는 것처럼 말하지 마세요.`,
};
const CHAT_SYSTEM_PROMPTS = {
  us: CHAT_SYSTEM_PROMPT + CHAT_MARKET_NOTE.us,
  kr: CHAT_SYSTEM_PROMPT
    .replace("\"미르의 미국 주식\" 웹사이트", "\"미르의 한국 주식\" 웹사이트")
    .replace("티커(예: AAPL, NVDA)로 검색", "종목명이나 6자리 코드(예: 삼성전자, 005930)로 검색")
    + CHAT_MARKET_NOTE.kr,
};

export function chatSystemPrompt(market) {
  return CHAT_SYSTEM_PROMPTS[market === "us" ? "us" : "kr"];
}

// /chat 의 시장 판정. 프런트(ai-mode.js·chat)는 market("us"|"kr")을 보낸다 — 그게 있으면 그대로.
// 없으면(구 클라이언트) 종목 힌트·컨텍스트 티커 모양으로 추정한다: 6자리 숫자·.KS/.KQ = 국내,
// 그 밖의 영문 티커 = 미국. 그래도 모르면 예전 기본값 kr(뉴스 RAG 가 국내 우선이던 동작 유지).
const KR_CHAT_TICKER_RE = /^(\d{6})(\.K[SQ])?$/i;
export function resolveChatMarket(body) {
  const m = body && typeof body.market === "string" ? body.market.trim().toLowerCase() : "";
  if (m === "us" || m === "kr") return m;
  const hints = body && body.searchHints && typeof body.searchHints === "object" ? body.searchHints : {};
  const tickers = (Array.isArray(hints.tickers) ? hints.tickers : []).map((t) => String(t || "").trim()).filter(Boolean);
  const ctx = body && typeof body.stockContext === "string" ? body.stockContext : "";
  parseStockContextEntities(ctx).forEach((row) => tickers.push(row.ticker));
  if (tickers.some((t) => KR_CHAT_TICKER_RE.test(t))) return "kr";
  if (tickers.some((t) => /^[A-Z][A-Z0-9.\-]{0,9}$/i.test(t))) return "us";
  return "kr";
}

// -----------------------------------------------------------------------------
// Chat RAG — retrieve recent news (Naver Open API → stock feed → Google RSS)
// -----------------------------------------------------------------------------

const CHAT_NEWS_INTENT_RE = /뉴스|기사|보도|왜\s*(올|하|떨|급|상|폭|조|강|쳤|내려|올라)|이슈|이유|배경|실적|어닝|공시|리포트|전망|하락|상승|급등|급락|수주|계약|인수|합병|소식|최근|오늘|무슨\s*일|어떤\s*일|어떻게\s*됐|분석해|요약해|알려줘.*(뉴스|이슈|이유)/i;

function stripNewsHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function chatNeedsNewsRag(userText, stockContext) {
  const text = String(userText || "").trim();
  if (!text) return false;
  if (CHAT_NEWS_INTENT_RE.test(text)) return true;
  if (stockContext && /[?？]/.test(text)) return true;
  return false;
}

function parseStockContextEntities(stockContext) {
  const out = [];
  const re = /\[(\S+)\s+([^\]]+)\]/g;
  let match;
  while ((match = re.exec(String(stockContext || "")))) {
    out.push({ ticker: match[1], company: match[2].trim() });
  }
  return out;
}

function collectChatEntities(userText, stockContext, searchHints, market) {
  const byTicker = new Map();
  const add = (ticker, company) => {
    const t = String(ticker || "").trim();
    if (!t) return;
    const c = String(company || "").trim();
    const prev = byTicker.get(t) || { ticker: t, company: "" };
    byTicker.set(t, { ticker: t, company: c || prev.company });
  };

  const hints = searchHints && typeof searchHints === "object" ? searchHints : {};
  const tickers = Array.isArray(hints.tickers) ? hints.tickers : [];
  const companies = Array.isArray(hints.companies) ? hints.companies : [];
  tickers.forEach((ticker, index) => add(ticker, companies[index] || ""));

  parseStockContextEntities(stockContext).forEach((row) => add(row.ticker, row.company));

  const text = String(userText || "");
  for (const code of text.match(/\b\d{6}\b/g) || []) add(code, "");
  for (const sym of text.match(/\b[A-Z][A-Z0-9.\-]{0,5}\b/g) || []) add(sym, "");

  const entities = [...byTicker.values()];
  if (!entities.length && market === "kr") {
    const macro = text.replace(/[?？!！.]/g, "").trim().slice(0, 48);
    if (macro.length >= 4) entities.push({ ticker: "", company: macro });
  }
  return entities.slice(0, 4);
}

function buildChatNewsQueries(userText, entities, market) {
  const isKr = market !== "us";
  const text = String(userText || "");
  const topic = (() => {
    if (/실적|어닝|EPS/i.test(text)) return "실적";
    if (/공시/.test(text)) return "공시";
    if (/수주|계약/.test(text)) return "수주";
    if (/인수|합병|M&A/i.test(text)) return "인수합병";
    if (/왜|이유|배경|올랐|하락|급등|급락/.test(text)) return "주가";
    return "뉴스";
  })();
  const queries = [];
  for (const ent of entities) {
    const name = String(ent.company || ent.ticker || "").trim();
    if (!name) continue;
    if (isKr) queries.push(ent.company ? `${ent.company} ${topic}` : `${ent.ticker} ${topic}`);
    else queries.push(ent.company && ent.company.toUpperCase() !== ent.ticker
      ? `${ent.company} stock ${topic}`
      : `${ent.ticker} stock news`);
  }
  if (!queries.length && isKr) {
    const macro = text.replace(/[?？!！.]/g, "").trim().slice(0, 48);
    if (macro.length >= 4) queries.push(macro);
  }
  return [...new Set(queries.filter(Boolean))].slice(0, 3);
}

async function fetchNaverNewsOpenApi(query, env, display = 10) {
  // 2026-07-31 부터 검색 API 신규 신청은 네이버 클라우드 NAVER API Hub 로만 된다(옛 개발자센터 2027-06-30 종료).
  // NAVER_APIHUB_KEY_ID / NAVER_APIHUB_KEY 가 있으면 그쪽, 없으면 옛 NAVER_CLIENT_ID / SECRET.
  const hubId = env && env.NAVER_APIHUB_KEY_ID;
  const hubKey = env && env.NAVER_APIHUB_KEY;
  const clientId = env && env.NAVER_CLIENT_ID;
  const clientSecret = env && env.NAVER_CLIENT_SECRET;
  const useHub = Boolean(hubId && hubKey);
  if ((!useHub && (!clientId || !clientSecret)) || !query) return null;
  try {
    const qs = `query=${encodeURIComponent(query)}&display=${Math.min(Math.max(display, 1), 20)}&start=1&sort=date`;
    const url = useHub
      ? `https://naverapihub.apigw.ntruss.com/search/v1/news?${qs}&format=json`
      : `https://openapi.naver.com/v1/search/news.json?${qs}`;
    const auth = useHub
      ? { "X-NCP-APIGW-API-KEY-ID": hubId, "X-NCP-APIGW-API-KEY": hubKey }
      : { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret };
    const response = await fetchT(url, {
      headers: {
        ...auth,
        "User-Agent": "MirChatRAG/1.0",
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload.items || []).map((item) => ({
      title: stripNewsHtml(item.title),
      summary: stripNewsHtml(item.description),
      publisher: "",
      // 네이버 뉴스 기사 페이지가 있으면 그쪽(국내 이용자는 네이버 화면이 익숙하다), 없으면 언론사 원문.
      link: (/n\.news\.naver\.com\//.test(item.link || "") ? item.link : (item.originallink || item.link)) || "",
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : "",
      provider: "Naver Search API",
    })).filter((item) => item.title);
  } catch (e) {
    return null;
  }
}

async function fetchGoogleNewsRecent(query, isKr = true) {
  if (!query) return [];
  try {
    const rssQuery = `${query} when:7d`;
    const endpoint = `https://news.google.com/rss/search?q=${encodeURIComponent(rssQuery)}&hl=${isKr ? "ko" : "en-US"}&gl=${isKr ? "KR" : "US"}&ceid=${isKr ? "KR:ko" : "US:en"}`;
    const response = await fetchT(endpoint, { headers: { ...UA, Accept: "application/rss+xml, application/xml, text/xml" } });
    if (!response.ok) return [];
    return parseGoogleNewsRss(await response.text()).map((item) => ({
      ...item,
      summary: item.summary || "",
      provider: "Google News",
    }));
  } catch (e) {
    return [];
  }
}

function scoreChatNewsItem(item, query, userText) {
  const blob = `${item.title} ${item.summary}`.toLowerCase();
  const terms = new Set(
    `${query} ${userText}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= 2)
  );
  let score = 0;
  terms.forEach((term) => {
    if (blob.includes(term)) score += 1;
  });
  if (item.publishedAt) {
    const ageDays = (Date.now() - new Date(item.publishedAt).getTime()) / 86400000;
    if (Number.isFinite(ageDays) && ageDays <= 3) score += 2;
    else if (Number.isFinite(ageDays) && ageDays <= 7) score += 1;
  }
  return score;
}

function dedupeChatNews(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = stripNewsHtml(item.title).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function retrieveChatNewsRag(userText, entities, env, market) {
  const isKr = market !== "us";
  const queries = buildChatNewsQueries(userText, entities, market);
  const pool = [];

  for (const query of queries) {
    let batch = null;
    if (isKr) batch = await fetchNaverNewsOpenApi(query, env, 10);
    if (!batch || !batch.length) batch = await fetchGoogleNewsRecent(query, isKr);
    batch.forEach((item) => {
      pool.push({ ...item, _score: scoreChatNewsItem(item, query, userText) });
    });
  }

  for (const ent of entities.slice(0, 2)) {
    if (!ent.ticker) continue;
    let batch = [];
    if (isKoreanTicker(ent.ticker)) batch = await fetchNaverNews(ent.ticker);
    else batch = await fetchNews(env, ent.ticker.replace(/\./g, "-"));
    batch.forEach((item) => {
      pool.push({
        ...item,
        summary: item.summary || "",
        provider: item.provider || (isKoreanTicker(ent.ticker) ? "Naver Stock" : "Yahoo"),
        _score: scoreChatNewsItem(item, ent.company || ent.ticker, userText) + 1,
      });
    });
  }

  return dedupeChatNews(pool)
    .sort((a, b) => (b._score || 0) - (a._score || 0))
    .slice(0, 6)
    .map(({ _score, ...item }) => item);
}

// 뉴스 근거 블록. 기사마다 [N1]·[N2] 출처 ID 를 붙여 문장별 출처를 달게 한다. 클라이언트
// (ai-cite-core.js)는 done 메타 rag.items 에 있는 ID 만 각주로 살리고 그 밖의 표기는 지운다.
export function formatChatNewsRagBlock(news) {
  if (!Array.isArray(news) || !news.length) return "";
  const lines = news.slice(0, 6).map((item, index) => {
    const date = item.publishedAt ? ` · ${item.publishedAt}` : "";
    const publisher = item.publisher ? ` · ${item.publisher}` : (item.provider ? ` · ${item.provider}` : "");
    const summary = item.summary ? `\n   요약: ${item.summary.slice(0, 220)}` : "";
    return `[N${index + 1}] ${item.title}${date}${publisher}${summary}`;
  });
  return `\n\n[검색된 최근 뉴스 근거 — 아래 내용만 사실로 사용하고, 없는 내용은 지어내지 마세요]\n${lines.join("\n")}\n\n뉴스 답변 규칙:\n- 위 기사에 나온 사실만 바탕으로 설명하세요.\n- 기사 내용을 근거로 쓴 문장 끝에는 그 기사 ID 를 [N1]처럼 붙이세요. 목록에 없는 ID 는 쓰지 마세요.\n- 근거가 부족하면 "확인된 뉴스가 충분하지 않다"고 솔직히 말하세요.\n- 매수/매도/목표가 추천은 하지 마세요.`;
}

// done 메타의 rag. sources(제목 배열)는 옛 클라이언트 호환으로 두고, items 에 ID·링크·날짜를 싣는다.
export function chatRagMeta(newsSources) {
  if (!Array.isArray(newsSources) || !newsSources.length) return null;
  const top = newsSources.slice(0, 6);
  return {
    newsCount: newsSources.length,
    sources: top.map((n) => n.title),
    items: top.map((n, i) => ({
      id: `N${i + 1}`,
      title: String(n.title || "").slice(0, 200),
      link: /^https?:\/\//i.test(String(n.link || "")) ? String(n.link) : "",
      date: String(n.publishedAt || "").slice(0, 10),
      publisher: String(n.publisher || n.provider || "").slice(0, 60),
    })),
  };
}

// ── /chat 스트리밍(SSE) 지원 ──────────────────────────────────────────────
// 업스트림(Gemini alt=sse 또는 Workers AI stream:true)의 SSE 를 라인 단위로 파싱해
// `data: {"delta":"..."}` 형태의 우리 포맷으로 재송출한다. 마지막에 done 메타 +
// [DONE] 센티널을 보낸다. 클라이언트는 Content-Type 으로 신/구 워커를 감지한다.
function chatSseResponse(upstream, pickDelta, meta, { expectKorean = true } = {}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buf = "";
  // 스트리밍은 델타를 이미 내보낸 뒤라 답을 바꿀 수 없다. 대신 누적 본문을 같은
  // 판정기에 걸어 done 메타에 degenerate 플래그를 실어 보낸다(감사 P2-5).
  let acc = "";
  const transform = new TransformStream({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, "").trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const delta = pickDelta(JSON.parse(payload));
          if (delta) {
            if (acc.length < 8000) acc += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        } catch (e) { /* 파싱 불가 청크는 건너뜀 */ }
      }
    },
    flush(controller) {
      const degenerate = looksDegenerateReply(acc, expectKorean);
      if (degenerate) console.error("chat stream: degenerate reply", (meta && meta.model) || "");
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, ...(meta || {}), ...(degenerate ? { degenerate: true } : {}) })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    },
  });
  return new Response(upstream.pipeThrough(transform), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

function pickGeminiDelta(data) {
  const parts = data && data.candidates && data.candidates[0]
    && data.candidates[0].content && data.candidates[0].content.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
}

function pickWorkersAiDelta(data) {
  return data && typeof data.response === "string" ? data.response : "";
}

function geminiRequestPayload(systemContent, history) {
  return {
    contents: history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    systemInstruction: { parts: [{ text: systemContent }] },
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  };
}

async function geminiStreamChat(env, systemContent, history, ragMeta, expectKorean = true) {
  const payload = geminiRequestPayload(systemContent, history);
  for (const geminiModel of geminiModelChain(env)) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse`;
    try {
      const res = await fetchT(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify(payload),
      }, GEMINI_TIMEOUT_MS);
      if (!res.ok || !res.body) {
        const errText = res.ok ? "" : await res.text().catch(() => "");
        if (geminiModelUnavailable(res.status, errText)) {
          console.error("Gemini stream: model unavailable, trying next:", geminiModel, res.status);
          continue; // 다음 모델을 한 번 더
        }
        console.error("Gemini stream error:", res.status);
        return null; // 비스트리밍 경로로 폴백
      }
      return chatSseResponse(res.body, pickGeminiDelta, { model: geminiModel, ...(ragMeta || {}) }, { expectKorean });
    } catch (e) {
      console.error("Gemini stream call failed:", e);
      return null;
    }
  }
  return null; // 체인의 모델이 전부 없음 → 비스트리밍 Gemini(같은 판정) → Workers AI
}

// 한국어 답변인데 한글이 거의 없거나 같은 3-gram 이 20% 넘게 반복되면 깨진 출력으로 본다.
// expectKorean: 사용자 질문에 한글이 있을 때만 한글 비율을 본다(영어 질문에는 영어 답이 정상).
export function looksDegenerateReply(text, expectKorean = true) {
  const s = String(text || "").trim();
  if (s.length < 40) return false;
  const letters = (s.match(/[A-Za-z\uAC00-\uD7A3]/g) || []).length;
  const hangul = (s.match(/[\uAC00-\uD7A3]/g) || []).length;
  if (expectKorean && letters >= 80 && hangul / letters < 0.15) return true;
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 30) {
    const tri = new Map();
    for (let i = 0; i + 2 < words.length; i += 1) {
      const k = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      tri.set(k, (tri.get(k) || 0) + 1);
    }
    let top = 0; tri.forEach((v) => { if (v > top) top = v; });
    if (top / (words.length - 2) > 0.2) return true;
  }
  return false;
}

// ── 문장 → 수식(수식 스크리너) ─────────────────────────────────────────────
const FORMULA_MAX_TEXT = 300;
const FORMULA_MAX_FIELDS = 200;
const FORMULA_FIELD_RE = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const FORMULA_CHARS_RE = /^[A-Za-z0-9_ .,()<>=!&|+\-*/]+$/;
const FORMULA_FUNCS = "abs(x) · min(a,b,…) · max(a,b,…) · avg(a,b,…) · sectorMedian(x) · sectorPct(x) · industryMedian(x) · industryPct(x) · median(x) · pct(x) · rank(x)(1 = 가장 큼)";

// 모델 답 → 수식 한 줄. 코드 울타리·'수식:' 머리말·따옴표를 걷고, 허용 문자 밖이거나 NONE 이면 빈 문자열.
export function cleanFormulaReply(text) {
  let s = String(text || "").replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
  s = s.split(/\r?\n/).map((l) => l.trim()).find((l) => l) || "";
  s = s.replace(/;\s*$/, "").replace(/^(formula|수식|answer|output)\s*[:：]\s*/i, "").replace(/^[`"'“”]+|[`"'“”]+$/g, "").trim();
  s = s.replace(/\s+/g, " ").replace(/;$/, "").trim();
  if (!s || /^none$/i.test(s) || s.length > 600 || !FORMULA_CHARS_RE.test(s)) return "";
  if (/<\s*\/|\/\s*>|<[a-z]+>/i.test(s)) return ""; // 태그 모양(<x>·</x>)은 수식이 아니다
  return s;
}

export function formulaPrompt(text, fields, market) {
  const list = fields.map(([k, label]) => `${k}: ${label}`).join("\n");
  return `${market === "kr" ? "국내" : "미국"} 주식 스크리너의 수식 문법으로 아래 문장을 바꿔라.\n\n`
    + "[문법] 비교 < <= > >= == != · 논리 and or not · 산술 + - * / · 괄호 · 숫자(퍼센트 값은 % 없이 숫자만, 예: 15).\n"
    + `[함수] ${FORMULA_FUNCS}\n`
    + `[필드 — 이 목록의 이름만 쓸 수 있다]\n${list}\n\n`
    + "규칙: 수식 한 줄만 출력(설명·코드 울타리 금지). 목록에 없는 필드·함수를 만들지 마라. "
    + `문장을 이 필드로 표현할 수 없으면 NONE 만 출력.\n\n[문장]\n${text}`;
}

async function handleFormula(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400, 0); }
  const text = typeof (body && body.text) === "string" ? body.text.trim() : "";
  if (!text || text.length > FORMULA_MAX_TEXT) return json({ error: "bad_text" }, 400, 0);
  const fields = (Array.isArray(body.fields) ? body.fields : [])
    .filter((f) => Array.isArray(f) && FORMULA_FIELD_RE.test(String(f[0] || "")))
    .slice(0, FORMULA_MAX_FIELDS)
    .map(([k, label]) => [String(k), String(label || "").replace(/[\r\n]+/g, " ").slice(0, 40)]);
  if (!fields.length) return json({ error: "no_fields" }, 400, 0);
  if (!env || !env.AI) return json({ formula: "", error: "no_ai_binding" }, 503, 0);
  const market = body.market === "kr" ? "kr" : "us";
  const messages = [
    { role: "system", content: "You translate stock-screening sentences (Korean or English) into one formula line in the given grammar, using only the listed field names. Output only the formula, or NONE." },
    { role: "user", content: formulaPrompt(text, fields, market) },
  ];
  let lastError = "no_model";
  for (const model of CHAT_MODELS) {
    try {
      const result = await env.AI.run(model, { messages, max_tokens: 160, temperature: 0 });
      const formula = cleanFormulaReply(result && result.response);
      if (formula) return json({ formula, model }, 200, 0);
      lastError = `no_formula:${model}`;
    } catch (e) {
      lastError = `${model}: ${(e && e.message) || e}`;
    }
  }
  return json({ formula: "", error: lastError }, 200, 0);
}

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad_json" }, 400);
  }

  const raw = Array.isArray(body && body.messages) ? body.messages : [];
  const history = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return json({ reply: "", error: "no_user_message" }, 400);
  }
  if (!env || !env.AI) {
    return json({ reply: "지금은 도우미를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.", error: "no_ai_binding" });
  }

  const wantStream = body.stream === true; // 구 클라이언트는 이 플래그가 없어 JSON 경로 유지
  const userText = history[history.length - 1].content;
  const stockContext = typeof body.stockContext === "string" ? body.stockContext.trim().slice(0, 4000) : "";
  const snapshotContext = typeof body.snapshotContext === "string" ? body.snapshotContext.trim().slice(0, 2500) : "";
  const market = resolveChatMarket(body);
  const searchHints = body.searchHints && typeof body.searchHints === "object" ? body.searchHints : {};

  let newsRagBlock = "";
  let newsSources = [];
  if (chatNeedsNewsRag(userText, stockContext)) {
    const entities = collectChatEntities(userText, stockContext, searchHints, market);
    newsSources = await retrieveChatNewsRag(userText, entities, env, market);
    newsRagBlock = formatChatNewsRagBlock(newsSources);
  }

  let systemContent = chatSystemPrompt(market);
  if (snapshotContext) {
    systemContent += `\n\n[오늘의 시장 스냅샷 요약 — 사실로만 사용]\n${snapshotContext}\n\n위 스냅샷은 매일 1회 갱신된 참고 데이터입니다. 실시간 시세가 아님을 안내하세요.`;
  }
  if (stockContext) {
    systemContent += `\n\n[현재 사용자가 보고 있는 종목 컨텍스트]\n${stockContext}\n\n위 종목 데이터가 제공되면 이를 우선 참고해 설명하되, 매수/매도/목표가 추천은 하지 마세요.`;
  }
  if (newsRagBlock) systemContent += newsRagBlock;

  const ragMeta = newsSources.length ? { rag: chatRagMeta(newsSources) } : {};

  // 만약 환경 변수에 GEMINI_API_KEY가 존재하면 Google Gemini API를 호출하여 성능을 대폭 향상합니다.
  const expectKorean = /[가-힣]/.test(userText);
  if (env && env.GEMINI_API_KEY) {
    if (wantStream) {
      const streamResp = await geminiStreamChat(env, systemContent, history, ragMeta, expectKorean);
      if (streamResp) return streamResp;
      // 스트리밍 실패 시 아래 비스트리밍 Gemini → Workers AI 순으로 폴백
    }
    try {
      const payload = geminiRequestPayload(systemContent, history);
      for (const geminiModel of geminiModelChain(env)) {
        // 키는 URL 쿼리가 아니라 헤더로 — 쿼리는 로그에 남는 노출면이다.
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
        const res = await fetchT(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify(payload)
        }, GEMINI_TIMEOUT_MS);

        if (res.ok) {
          const data = await res.json();
          const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
          if (text && looksDegenerateReply(text, expectKorean)) {
            // 깨진 반복 답은 그대로 캐시·표시되면 안 된다 — 다음 모델로 (감사 P2-5).
            console.error("Gemini reply looked degenerate, trying next model:", geminiModel);
            continue;
          }
          if (text) {
            return json({
              reply: text,
              model: geminiModel,
              rag: chatRagMeta(newsSources),
            });
          }
          break; // 빈 답 — 모델 문제가 아니므로 Workers AI 로
        }
        const errText = await res.text();
        console.error("Gemini API Error Response:", res.status, errText.slice(0, 300));
        if (!geminiModelUnavailable(res.status, errText)) break; // 쿼터·키 오류 등은 다음 모델로 안 넘어감
      }
    } catch (e) {
      console.error("Gemini API Call Failed:", e);
      // Gemini API 호출에 실패한 경우 기존 Cloudflare AI로 폴백합니다.
    }
  }

  const messages = [{ role: "system", content: systemContent }, ...history];
  let lastError = "no_model";

  // Workers AI 스트리밍 (stream:true 는 SSE 바이트의 ReadableStream 을 돌려준다)
  if (wantStream) {
    for (const model of CHAT_MODELS) {
      try {
        const stream = await env.AI.run(model, { messages, max_tokens: 768, temperature: 0.3, stream: true });
        if (stream && typeof stream.pipeThrough === "function") {
          return chatSseResponse(stream, pickWorkersAiDelta, { model, ...ragMeta }, { expectKorean });
        }
        // 런타임이 스트림 대신 객체를 준 경우: 즉시 완성 응답으로 처리
        const text = String((stream && stream.response) || "").trim();
        if (text && looksDegenerateReply(text, expectKorean)) {
          lastError = `degenerate_response:${model}`;
          continue;
        }
        if (text) return json({ reply: text, model, rag: ragMeta.rag || null });
      } catch (e) {
        lastError = `${model}: ${(e && e.message) || e}`;
      }
    }
    // 스트리밍이 전부 실패하면 아래 비스트리밍 경로로 마지막 시도
  }

  for (const model of CHAT_MODELS) {
    try {
      const result = await env.AI.run(model, { messages, max_tokens: 768, temperature: 0.3 });
      const text = String((result && result.response) || "").trim();
      if (text && looksDegenerateReply(text, expectKorean)) {
        // 2026-09-04: 한 모델이 ". of the the of the the …" 만 반복한 답을 냈다. 다음 모델로.
        lastError = `degenerate_response:${model}`;
        continue;
      }
      if (text) {
        return json({
          reply: text,
          model,
          rag: chatRagMeta(newsSources),
        });
      }
      lastError = `empty_response:${model}`;
    } catch (e) {
      lastError = `${model}: ${(e && e.message) || e}`;
    }
  }
  return json({ reply: "답변 생성에 실패했어요. 잠시 후 다시 시도해 주세요.", error: lastError });
}
