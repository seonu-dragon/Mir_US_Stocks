// market_config.js 의 티커 → 시장 판정(MirMarket.tickerMarket)과 부팅 시장 우선순위(getInitialMode) 단위 테스트.
//  (1) 국내 6자리(신형 영숫자 코드·.KS/.KQ 포함) → kr, 영문 티커 → us, 회사명 등 → null.
//  (2) ?ticker= 가 저장된 시장·market= 보다 우선. 판정 못 하는 티커면 예전 규칙(market= → 전용 딥링크 → 저장값).
// 실행: node scripts/tests/test_market_ticker.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

function load({ search = "", saved = null } = {}) {
  const store = new Map();
  if (saved) store.set("mir_market_mode_v2", saved);
  const ctx = {
    console, String, RegExp, Number, Math, Array, Object, JSON, URLSearchParams,
    window: {},
    document: {
      documentElement: { setAttribute() {}, getAttribute() { return ""; } },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: null,
      title: "",
    },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
  };
  ctx.window.location = { search, href: `http://127.0.0.1/index.html${search}` };
  ctx.location = ctx.window.location;
  ctx.window.safeStorage = { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v), remove: (k) => store.delete(k) };
  vm.createContext(ctx);
  vm.runInContext(MARKET, ctx);
  return ctx.window;
}

const w = load();
const tm = w.MirMarket.tickerMarket;
eq(tm("005930"), "kr", "6자리 숫자");
eq(tm("005930.KS"), "kr", ".KS 접미");
eq(tm("035720.kq"), "kr", ".KQ 소문자");
eq(tm("0193T0"), "kr", "신형 영숫자 코드");
eq(tm(" 000660 "), "kr", "앞뒤 공백");
eq(tm("NVDA"), "us", "미국 티커");
eq(tm("nvda"), "us", "소문자 미국 티커");
eq(tm("BRK.B"), "us", "점 클래스주");
eq(tm("BRK-B"), "us", "대시 클래스주");
eq(tm("AAPL.KS"), null, "영문 + .KS 는 판단 안 함");
eq(tm("5930"), null, "6자리 아닌 숫자");
eq(tm("삼성전자"), null, "회사명");
eq(tm(""), null, "빈 값");
eq(tm(null), null, "null");
eq(tm("^GSPC"), null, "지수 기호");

eq(load({ search: "?ticker=005930", saved: "us" }).MIR_MARKET_MODE, "kr", "미국 저장 + 국내 티커 → kr");
eq(load({ search: "?ticker=NVDA", saved: "kr" }).MIR_MARKET_MODE, "us", "국내 저장 + 미국 티커 → us");
eq(load({ search: "?market=us&ticker=005930" }).MIR_MARKET_MODE, "kr", "market=us 라도 국내 티커면 kr");
eq(load({ search: "?ticker=%EC%82%BC%EC%84%B1", saved: "kr" }).MIR_MARKET_MODE, "kr", "판정 못 하는 티커 → 저장값");
eq(load({ search: "?market=kr" }).MIR_MARKET_MODE, "kr", "market= 만");
eq(load({ search: "?tab=krflow", saved: "us" }).MIR_MARKET_MODE, "kr", "국내 전용 딥링크");
eq(load({ search: "", saved: "kr" }).MIR_MARKET_MODE, "kr", "저장값");
eq(load({ search: "" }).MIR_MARKET_MODE, "us", "기본값");

console.log(`market ticker: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
