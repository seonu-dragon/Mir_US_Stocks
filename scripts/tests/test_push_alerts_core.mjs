// Web Push 알림 순수 로직(push-alerts-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_push_alerts_core.mjs   (CI 의 "Push alerts core tests" 스텝)
// 암호화·VAPID·라우트·크론은 worker/test_push.mjs 가 본다.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../push-alerts-core.js");
const digestCore = require("../../my-digest-core.js");

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failures.push(`${name}: ${err && err.message}`);
  }
}

test("설정 정리: 기본값·범위 자르기·모르는 시장 제거", () => {
  const d = core.normalizePrefs(null);
  assert.equal(d.movePct, 5);
  assert.equal(d.maxPerDay, 6);
  assert.equal(d.kinds.digest, false);
  assert.equal(d.useSync, false);
  const p = core.normalizePrefs({ movePct: 0.2, maxPerDay: 99, digestMarkets: ["us", "jp", "us"], kinds: { move: false } });
  assert.equal(p.movePct, 1);
  assert.equal(p.maxPerDay, 12);
  assert.deepEqual(p.digestMarkets, ["us"]);
  assert.equal(p.kinds.move, false);
  assert.equal(p.kinds.level, true, "빠진 종류는 기본값");
  assert.equal(core.normalizePrefs({ movePct: "abc" }).movePct, 5);
});

test("목록 정리: 시장 구분·중복·상한·가격 도달 방향·이름 길이·야후 접미사", () => {
  const l = core.normalizeLists({
    us: { watch: ["nvda", "NVDA", "005930", "<script>"], hold: [{ t: "aapl", q: "3" }, { ticker: "MSFT", qty: -1 }] },
    kr: { watch: ["5930", "AAPL"], hold: [{ t: "000660", q: 10 }] },
    levels: [{ t: "AAPL", price: 250, dir: "above" }, { t: "AAPL", price: 250, dir: "above" }, { t: "X", price: 0, dir: "above" }, { t: "Y", price: 1, dir: "sideways" }],
    names: { "005930": "삼성전자우선주매우긴이름테스트용문자열입니다아주길다" },
    ys: { "005930": "005930.KS", "000660": "evil" },
  });
  assert.deepEqual(l.us.watch, ["NVDA"]);
  assert.deepEqual(l.us.hold, [{ t: "AAPL", q: 3 }, { t: "MSFT", q: 0 }]);
  assert.deepEqual(l.kr.watch, ["005930"], "4자리 코드도 6자리로, 미국 티커는 빠짐");
  assert.equal(l.levels.length, 1);
  assert.equal(l.levels[0].m, "us");
  assert.ok(l.names["005930"].length <= 24);
  assert.deepEqual(l.ys, { "005930": "005930.KS" });
  const many = core.normalizeLists({ us: { watch: Array.from({ length: 200 }, (_, i) => `T${i}`) } });
  assert.equal(many.us.watch.length, 80);
});

test("클라우드 동기화 값 → 목록: 시장별 관심·보유 분리, 진행 중 가설 목표가·손절가", () => {
  const l = core.listsFromSyncPrefs({
    watchlistUs: ["NVDA"], watchlistKr: ["005930"],
    portfolio: [{ ticker: "AAPL", qty: 2 }, { ticker: "000660", qty: 5 }],
    theses: { items: [
      { ticker: "NVDA", status: "open", target: 200, stop: 90 },
      { ticker: "TSLA", status: "closed", target: 500 },
    ] },
  });
  assert.deepEqual(l.us.watch, ["NVDA"]);
  assert.deepEqual(l.kr.hold, [{ t: "000660", q: 5 }]);
  assert.equal(l.levels.length, 2);
  assert.deepEqual(l.levels.map((x) => `${x.t}:${x.dir}:${x.price}:${x.src}`), ["NVDA:above:200:thesis", "NVDA:below:90:thesis"]);
  // 구형 payload(시장별 필드 없음)
  const legacy = core.listsFromSyncPrefs({ watchlist: ["NVDA", "005930"] });
  assert.deepEqual(legacy.us.watch, ["NVDA"]);
  assert.deepEqual(legacy.kr.watch, ["005930"]);
});

test("목록 합치기: 동기화가 비어 있으면 기기 목록, 있으면 동기화 목록 + 가격 도달 합집합", () => {
  const base = { us: { watch: ["AAPL"] }, levels: [{ t: "AAPL", price: 1, dir: "below" }], names: { AAPL: "애플" } };
  assert.deepEqual(core.mergeLists(base, core.listsFromSyncPrefs({})).us.watch, ["AAPL"]);
  const m = core.mergeLists(base, core.listsFromSyncPrefs({ watchlistUs: ["MSFT"], theses: { items: [{ ticker: "MSFT", target: 500 }] } }));
  assert.deepEqual(m.us.watch, ["MSFT"]);
  assert.equal(m.levels.length, 2);
  assert.equal(m.names.AAPL, "애플");
});

test("크론 계획: 미 장중(서머타임·겨울), 국내 장중, 요약·공시 슬롯, 주말", () => {
  // 2026-09-28(월) 14:00 UTC = ET 10:00(EDT), KST 23:00
  let p = core.planJobs(Date.UTC(2026, 8, 28, 14, 0));
  assert.equal(p.jobs.priceUs, true);
  assert.equal(p.jobs.priceKr, false);
  // 2026-12-07(월) 14:00 UTC = ET 09:00(EST) → 개장 전
  p = core.planJobs(Date.UTC(2026, 11, 7, 14, 0));
  assert.equal(p.jobs.priceUs, false, "겨울엔 14:00 UTC 가 개장 전");
  p = core.planJobs(Date.UTC(2026, 11, 7, 14, 30));
  assert.equal(p.jobs.priceUs, true);
  // 16:00 ET 칸은 종가를 한 번 더 본다, 16:30 은 아님
  assert.equal(core.planJobs(Date.UTC(2026, 8, 28, 20, 0)).jobs.priceUs, true);
  assert.equal(core.planJobs(Date.UTC(2026, 8, 28, 20, 30)).jobs.priceUs, false);
  // 국내: 2026-09-28(월) 09:00 KST = 00:00 UTC
  assert.equal(core.planJobs(Date.UTC(2026, 8, 28, 0, 0)).jobs.priceKr, true);
  assert.equal(core.planJobs(Date.UTC(2026, 8, 28, 7, 0)).jobs.priceKr, false, "16:00 KST 부터는 장 마감");
  // 07:30 KST(화) = 월 22:30 UTC → 미국 요약 + 실적 D-1
  p = core.planJobs(Date.UTC(2026, 8, 28, 22, 30));
  assert.equal(p.kstDate, "2026-09-29");
  assert.equal(p.jobs.digestUs, true);
  assert.equal(p.jobs.earningsD1, true);
  // 07:30 KST 월요일(=일 22:30 UTC)엔 미국 요약 없음(주말 다음), D-1 은 있음
  p = core.planJobs(Date.UTC(2026, 8, 27, 22, 30));
  assert.equal(p.jobs.digestUs, false);
  assert.equal(p.jobs.earningsD1, true);
  // 20:00 KST(월) = 11:00 UTC → 국내 요약·공시 / 15:00 KST = 06:00 UTC → 미 공시
  assert.equal(core.planJobs(Date.UTC(2026, 8, 28, 11, 0)).jobs.digestKr, true);
  assert.equal(core.planJobs(Date.UTC(2026, 8, 28, 11, 45)).jobs.digestKr, false, "20:30 칸 아님");
  assert.equal(core.planJobs(Date.UTC(2026, 8, 28, 6, 10)).jobs.eventsUs, true, "크론 지연 10분도 같은 칸");
  const weekend = core.planJobs(Date.UTC(2026, 8, 26, 18, 0)).jobs;
  assert.ok(Object.values(weekend).every((v) => !v));
});

test("야후 spark 응답 파싱: 전일 종가 기준 등락률, 거래소 현지 거래일, 이상값 제외", () => {
  const q = core.parseSpark({ spark: { result: [
    { symbol: "005930.KS", response: [{ meta: { regularMarketPrice: 285500, chartPreviousClose: 276500, regularMarketTime: 1790145006, gmtoffset: 32400, shortName: "SamsungElec" } }] },
    { symbol: "AAPL", response: [{ meta: { regularMarketPrice: 341.46, regularMarketChangePercent: 1.53, regularMarketTime: 1790366401, gmtoffset: -14400 } }] },
    { symbol: "BAD", response: [{ meta: { regularMarketPrice: 0, regularMarketTime: 1 } }] },
    { symbol: "NONE", response: [] },
  ] } });
  assert.equal(q["005930.KS"].changePct, 3.25);
  assert.equal(q["005930.KS"].tradeDate, "2026-09-23");
  assert.equal(q.AAPL.changePct, 1.53, "전일 종가 없으면 야후 등락률");
  assert.equal(q.AAPL.tradeDate, "2026-09-25");
  assert.ok(!q.BAD && !q.NONE);
  assert.deepEqual(core.parseSpark(null), {});
});

test("야후 심볼: 미국 클래스주 BRK.B → BRK-B, 국내는 알려진 접미사 → .KS → .KQ", () => {
  assert.equal(core.yahooSymbol("BRK.B", null, false), "BRK-B");
  assert.equal(core.yahooSymbol("BRK.B", null, true), "", "미국은 재시도 없음");
  assert.equal(core.yahooSymbol("035720", null, false), "035720.KS");
  assert.equal(core.yahooSymbol("035720", null, true), "035720.KQ");
  assert.equal(core.yahooSymbol("247540", { ys: { 247540: "247540.KQ" } }, false), "247540.KQ");
  assert.equal(core.yahooSymbol("247540", { ys: { 247540: "247540.KQ" } }, true), "");
});

const NOW = Date.UTC(2026, 8, 28, 15, 0);
const T = NOW - 5 * 60000;
const quote = (price, prev, time = T) => ({ price, prevClose: prev, changePct: Math.round((price / prev - 1) * 10000) / 100, time, tradeDate: "2026-09-28" });

test("가격 조건: ±N% 양방향, 경계, 꺼 두면 없음, 오래된 시세 무시", () => {
  const lists = core.normalizeLists({ us: { watch: ["NVDA", "KO", "PEP", "OLD"] }, names: {} });
  const quotes = { NVDA: quote(105, 100), KO: quote(94.9, 100), PEP: quote(104.9, 100), OLD: quote(120, 100, NOW - 3 * 86400000) };
  const a = core.evaluatePrice({ prefs: { movePct: 5 }, lists, quotes, fired: {}, market: "us", nowMs: NOW });
  assert.deepEqual(a.map((x) => x.ticker).sort(), ["KO", "NVDA"]);
  assert.ok(a.find((x) => x.ticker === "KO").key.endsWith(":down"));
  assert.ok(a[0].text.includes("±5% 조건"));
  assert.equal(core.evaluatePrice({ prefs: { kinds: { move: false } }, lists, quotes, fired: {}, market: "us", nowMs: NOW }).length, 0);
  const fired = { [a[0].key]: "2026-09-28" };
  assert.equal(core.evaluatePrice({ prefs: {}, lists, quotes, fired, market: "us", nowMs: NOW }).length, 1, "보낸 키는 다시 안 보냄");
});

test("가격 도달: 위로/아래로, 가설 목표가·손절가 문구, 국내 원화 표기, 다른 시장 제외", () => {
  const lists = core.normalizeLists({
    levels: [
      { t: "AAPL", price: 250, dir: "above", src: "thesis" },
      { t: "AAPL", price: 200, dir: "below", src: "thesis" },
      { t: "MSFT", price: 400, dir: "below", src: "manual" },
      { t: "005930", price: 280000, dir: "above", src: "manual" },
    ],
    names: { "005930": "삼성전자" },
  });
  const us = core.evaluatePrice({ prefs: {}, lists, quotes: { AAPL: quote(251, 249), MSFT: quote(399, 398) }, fired: {}, market: "us", nowMs: NOW });
  assert.deepEqual(us.map((x) => x.text), [
    "AAPL 목표가 $250.00 도달 — 현재 $251.00",
    "MSFT 설정가 이하 $400.00 도달 — 현재 $399.00",
  ]);
  const kr = core.evaluatePrice({ prefs: {}, lists, quotes: { "005930": quote(285500, 276500) }, fired: {}, market: "kr", nowMs: NOW });
  assert.equal(kr.length, 1);
  assert.equal(kr[0].text, "삼성전자 설정가 이상 280,000원 도달 — 현재 285,500원");
});

test("일정·공시: 실적 D-1 만, 구독 이전·사흘 넘은 공시 제외, 국내는 주요 유형만", () => {
  const lists = core.normalizeLists({ us: { watch: ["NVDA", "MSFT"] }, kr: { watch: ["005930", "000660"] }, names: { "005930": "삼성전자", "000660": "SK하이닉스" } });
  const sources = {
    usCalendar: { stocks: { NVDA: { nextEarnings: "2026-09-29" }, MSFT: { nextEarnings: "2026-09-30" } } },
    materialEvents: { events: [
      { ticker: "NVDA", fileDate: "2026-09-27", items: [{ code: "1.01", label: "중요 계약 체결" }] },
      { ticker: "MSFT", fileDate: "2026-09-20", items: [{ code: "5.02", label: "임원 변동" }] },
    ] },
    krDisclosures: { disclosures: [
      { ticker: "005930", fileDate: "2026-09-28", typeLabel: "연결재무제표기준영업(잠정)실적(공정공시)" },
      { ticker: "000660", fileDate: "2026-09-28", typeLabel: "기업설명회(IR)개최" },
    ] },
  };
  const today = "2026-09-28";
  const past = digestCore.pastEvents(sources, null, core.addDays(today, -3), today);
  const upcoming = digestCore.upcomingEvents(sources, null, today, 2);
  const us = core.evaluateEvents({ prefs: {}, lists, market: "us", past, upcoming, fired: {}, today, since: "2026-09-26" });
  assert.deepEqual(us.map((x) => x.kind).sort(), ["disclosure", "earnings"]);
  assert.ok(us.find((x) => x.kind === "earnings").text.startsWith("NVDA 내일(9/29)"));
  assert.ok(us.find((x) => x.kind === "disclosure").text.includes("중요 계약 체결"));
  const late = core.evaluateEvents({ prefs: {}, lists, market: "us", past, upcoming, fired: {}, today, since: "2026-09-28" });
  assert.deepEqual(late.map((x) => x.kind), ["earnings"], "구독 전 공시는 안 보냄");
  const kr = core.evaluateEvents({ prefs: {}, lists, market: "kr", past, upcoming, fired: {}, today, since: "2026-09-01" });
  assert.equal(kr.length, 1, "IR 개최(우선순위 낮음)는 제외");
  assert.ok(kr[0].text.startsWith("삼성전자 공시 · "));
  assert.equal(core.evaluateEvents({ prefs: {}, lists, market: "us", past, upcoming, fired: {}, today, since: "2026-09-01", doDisclosures: false }).length, 1);
});

test("상한·상태: 날짜 바뀌면 0, 남은 수, 오래된 키 정리(가격 도달은 조건이 남아 있을 때만)", () => {
  let s = core.dayState({ day: "2026-09-27", sent: 5, fired: { "mv:A:2026-09-27:up": "2026-09-27" } }, "2026-09-28");
  assert.equal(s.sent, 0);
  assert.equal(core.capRemaining({ sent: 5 }, { maxPerDay: 6 }), 1);
  assert.equal(core.capRemaining({ sent: 9 }, { maxPerDay: 6 }), 0);
  s = core.recordFired(s, ["lv:AAPL:above:250", "lv:OLD:above:1", "mv:X:2026-09-01:up"], "2026-09-01");
  const lists = core.normalizeLists({ levels: [{ t: "AAPL", price: 250, dir: "above" }] });
  const pruned = core.pruneState(s, lists, "2026-09-28");
  assert.deepEqual(Object.keys(pruned.fired).sort(), ["lv:AAPL:above:250", "mv:A:2026-09-27:up"]);
});

test("알림 문구: 한 건/여러 건 제목, 6줄 + 외 N건, 본문 길이, 사실 알림 표기, 추천 문구 없음", () => {
  const alerts = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, kind: "move", text: `T${i} +${5 + i}.0% (전일 종가 대비 ±5% 조건)` }));
  const n = core.composeAlertNotification(alerts, "us", { stamp: "x" });
  assert.equal(n.title, "미국 내 종목 알림 8건");
  const lines = n.body.split("\n");
  assert.equal(lines.length, 8);
  assert.equal(lines[6], "외 2건");
  assert.ok(lines[7].includes("추천 아님"));
  assert.ok(n.body.length <= 600);
  assert.equal(n.url, "./index.html?tab=bulk&market=us");
  const one = core.composeAlertNotification([{ key: "e", kind: "earnings", text: "NVDA 내일 실적" }], "kr");
  assert.equal(one.title, "국내 내 종목 알림");
  assert.ok(!one.body.includes("추천 아님"), "시세 없는 알림엔 시세 문구를 안 붙인다");
  assert.equal(core.composeAlertNotification([], "us"), null);
  for (const bad of ["매수", "매도", "추천합니다", "전망"]) assert.ok(!n.body.includes(bad), `금칙어 ${bad}`);
});

test("요약 알림: my-digest-core digestToText 재사용 — 제목 줄을 알림 제목으로, 빈 줄 제거", () => {
  const digest = digestCore.buildDailyDigest({
    market: "kr", today: "2026-09-28", basisDate: "2026-09-28",
    holdings: [{ ticker: "005930", qty: 10 }], watchlist: ["000660"],
    universe: [
      { ticker: "005930", company: "삼성전자", price: 285500, changePct: 3.26, priceDate: "2026-09-28" },
      { ticker: "000660", company: "SK하이닉스", price: 200000, changePct: -1.2, priceDate: "2026-09-28" },
    ],
    names: { "005930": "삼성전자", "000660": "SK하이닉스" },
    bench: { name: "KODEX 200", changePct: 0.8 },
  });
  const n = core.digestNotification(digest, digestCore);
  assert.equal(n.title, "오늘 내 주식은 · 국내 9/28 마감");
  assert.equal(n.tag, "mir-digest-kr");
  assert.ok(n.body.startsWith("보유 1종목 오늘 +3.26%"), n.body);
  assert.ok(n.body.includes("SK하이닉스 -1.2%"));
  assert.ok(!n.body.includes("\n\n"));
  assert.equal(core.digestNotification({ items: [] }, digestCore), null);
});

if (failures.length) {
  console.error(`FAIL ${failures.length}건\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`push-alerts-core: ${passed}개 통과`);
