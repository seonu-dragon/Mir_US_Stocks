// 종목 상세 경로(details-source.js) + MirMarket.fetchDetail 단위 테스트 — 네트워크 없이 node vm 에서.
//  (1) detailsBase 가 비면 예전 각 파일의 상대 경로와 같은 문자열을 한 번만 요청한다(동작 불변).
//  (2) detailsBase 가 있으면 R2 URL 을 먼저, 네트워크 오류·HTTP 오류면 Pages 상대 경로로 한 번 폴백.
//  (3) pagesFallback=false 면 폴백하지 않는다. (4) MirMarket.detailKey/detailPath/fetchDetail 정규화.
// 실행: node scripts/tests/test_details_source.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = readFileSync(path.join(ROOT, "details-source.js"), "utf8");
const MARKET = readFileSync(path.join(ROOT, "market_config.js"), "utf8");

let failed = 0;
let passed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++;
  console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
}

// fetch 모의: responder(url) → { status } | "throw"
function makeCtx(responder, opts = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const r = responder(url);
    if (r === "throw") throw new TypeError("Failed to fetch");
    return { ok: r.status >= 200 && r.status < 300, status: r.status, url };
  };
  const store = new Map();
  const ctx = {
    console, encodeURIComponent, String, RegExp, Set, Map, Promise, Array, Object, JSON,
    fetch,
    window: {},
    document: {
      documentElement: { setAttribute() {}, getAttribute() { return ""; } },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: null,
      title: "",
    },
    location: { search: opts.search || "" },
    URLSearchParams,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
  };
  ctx.window.fetch = fetch;
  ctx.window.location = ctx.location;
  ctx.window.safeStorage = { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v), remove: (k) => store.delete(k) };
  if (opts.mode) ctx.window.MIR_MARKET_MODE = opts.mode;
  if (opts.override !== undefined) ctx.window.MIR_DETAILS_BASE = opts.override;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  if (opts.config) Object.assign(ctx.window.MirDetails.config, opts.config);
  if (opts.withMarket) {
    vm.runInContext(MARKET, ctx);
    if (opts.mode) ctx.window.MIR_MARKET_MODE = opts.mode; // getInitialMode 가 덮어쓴 값을 시험 값으로
  }
  return { ctx, calls, MD: ctx.window.MirDetails, MM: ctx.window.MirMarket };
}

const ok200 = () => ({ status: 200 });

// (1) 기본값: 상대 경로 그대로, 1회 요청
{
  const { MD, calls, ctx } = makeCtx(ok200);
  eq(MD.config.detailsBase, "", "커밋된 detailsBase 는 빈 값(기능 꺼짐)");
  eq(MD.config.pagesFallback, true, "pagesFallback 기본 true");
  eq(MD.path("NVDA", "us"), "data/details/NVDA.json", "US 상대 경로");
  eq(MD.path("005930", "kr"), "data/korea/details/005930.json", "KR 상대 경로");
  eq(MD.path("BRK.B", "us"), "data/details/BRK.B.json", "점 티커는 그대로");
  eq(MD.path("A&B", "us"), "data/details/A%26B.json", "encodeURIComponent 적용(예전과 같음)");
  eq(MD.url("NVDA", "us"), "data/details/NVDA.json", "base 비면 url == 상대 경로");
  eq(ctx.window.mirDetailsUrl("_CON", "us"), "data/details/_CON.json", "전역 mirDetailsUrl");
  const res = await MD.fetch("NVDA", "us", { cache: "no-cache" });
  eq(res.ok, true, "응답 그대로");
  eq(calls.map((c) => c.url), ["data/details/NVDA.json"], "요청 1회·상대 경로");
  eq(calls[0].init, { cache: "no-cache" }, "init 전달");
}

// 시장 생략 시 현재 모드
{
  const { MD } = makeCtx(ok200, { mode: "kr" });
  eq(MD.path("000660"), "data/korea/details/000660.json", "시장 생략 → MIR_MARKET_MODE=kr");
}

// (2) base 설정: R2 먼저, 성공이면 끝
{
  const { MD, calls } = makeCtx(ok200, { config: { detailsBase: "https://pub-test.r2.dev/" } });
  eq(MD.url("NVDA", "us"), "https://pub-test.r2.dev/data/details/NVDA.json", "끝 슬래시 정리 + 같은 키 경로");
  await MD.fetch("NVDA", "us");
  eq(calls.map((c) => c.url), ["https://pub-test.r2.dev/data/details/NVDA.json"], "R2 성공이면 1회");
}
// R2 404 → Pages
{
  const { MD, calls } = makeCtx((u) => (u.startsWith("https://") ? { status: 404 } : { status: 200 }), { config: { detailsBase: "https://pub-test.r2.dev" } });
  const res = await MD.fetch("005930", "kr");
  eq(res.ok, true, "404 폴백 결과 ok");
  eq(calls.map((c) => c.url), ["https://pub-test.r2.dev/data/korea/details/005930.json", "data/korea/details/005930.json"], "R2 404 → Pages 1회");
}
// R2 네트워크 오류 → Pages, Pages 도 404 면 그 응답(호출부 기존 처리)
{
  const { MD, calls } = makeCtx((u) => (u.startsWith("https://") ? "throw" : { status: 404 }), { config: { detailsBase: "https://nope.invalid" } });
  const res = await MD.fetch("ZZZZ", "us");
  eq([res.ok, res.status], [false, 404], "Pages 404 는 그대로 돌려준다");
  eq(calls.length, 2, "R2 오류 + Pages 1회, 그 이상 재시도 없음");
}
// (3) pagesFallback=false
{
  const { MD, calls } = makeCtx(() => ({ status: 404 }), { config: { detailsBase: "https://pub-test.r2.dev", pagesFallback: false } });
  const res = await MD.fetch("NVDA", "us");
  eq([res.status, calls.length], [404, 1], "폴백 끔 → R2 응답 그대로");
}
// window.MIR_DETAILS_BASE 오버라이드(스모크용)
{
  const { MD } = makeCtx(ok200, { override: "https://override.example" });
  eq(MD.url("NVDA", "us"), "https://override.example/data/details/NVDA.json", "window.MIR_DETAILS_BASE 우선");
  const { MD: MD2 } = makeCtx(ok200, { override: "", config: { detailsBase: "https://pub-test.r2.dev" } });
  eq(MD2.url("NVDA", "us"), "data/details/NVDA.json", "빈 문자열 오버라이드 = 끔");
}

// (4) MirMarket 연동 — 예전 detailPath 와 같은 정규화·경로
{
  const { MM, calls } = makeCtx(ok200, { withMarket: true, mode: "kr" });
  eq(MM.detailPath("5930"), "data/korea/details/005930.json", "KR detailPath 6자리 패딩(예전과 같음)");
  eq(MM.detailKey("005930.KS"), "005930", "KR .KS 접미사 제거");
  eq(MM.detailUrl("5930"), "data/korea/details/005930.json", "detailUrl base 비면 상대 경로");
  await MM.fetchDetail("5930", { cache: "no-cache" });
  eq(calls.map((c) => c.url), ["data/korea/details/005930.json"], "fetchDetail 1회·예전 경로");
}
{
  const { MM, calls } = makeCtx((u) => (u.startsWith("https://") ? { status: 503 } : { status: 200 }), { withMarket: true, mode: "us", config: { detailsBase: "https://pub-test.r2.dev" } });
  eq(MM.detailPath("nvda"), "data/details/NVDA.json", "US detailPath 대문자");
  await MM.fetchDetail("nvda");
  eq(calls.map((c) => c.url), ["https://pub-test.r2.dev/data/details/NVDA.json", "data/details/NVDA.json"], "US R2 503 → Pages");
}

console.log(`details-source: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
