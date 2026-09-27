// 재무 위험 점검 순수 계산(risk-check-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_risk_check_core.mjs   (CI 의 "Risk check core tests" 스텝)
// F·Z·M 은 교과서 정의대로 손으로 계산한 값과 대조한다(Piotroski 2000, Altman 1968/1995, Beneish 1999 표 평균값).
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../risk-check-core.js");

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
const near = (a, b, eps, msg) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= eps, `${msg || ""} expected ${b}, got ${a}`);
const byKey = (list, k) => list.find((x) => x.key === k);
const file = (annual, extra) => Object.assign({ schema: 1, market: "us", currency: "USD", industryType: "general", flags: [], annual }, extra || {});

// ── Piotroski: 9개 모두 통과하는 3개 연도 ──
// t−2 자산 1000 / t−1: 순이익 50, 자산 1100, 매출 1000 / t: 순이익 80, 자산 1150, 매출 1200
const good = [
  { fy: 2022, assets: 1000, net: 30, ocf: 40, rev: 900, debt: 300, curAssets: 400, curLiab: 300, sharesDilAvg: 100, grossProfit: 300 },
  { fy: 2023, assets: 1100, net: 50, ocf: 70, rev: 1000, debt: 300, curAssets: 420, curLiab: 300, sharesDilAvg: 100, grossProfit: 350 },
  { fy: 2024, assets: 1150, net: 80, ocf: 120, rev: 1200, debt: 250, curAssets: 480, curLiab: 300, sharesDilAvg: 99, grossProfit: 450 },
];

test("Piotroski: 교과서 정의 9항목 모두 통과 → 9/9", () => {
  const f = core.piotroski(file(good));
  assert.equal(f.of, 9);
  assert.equal(f.pass, 9, JSON.stringify(f.items.filter((x) => x.status !== "pass").map((x) => x.key)));
  // ROA = 80 / 1100 (기초 자산)
  near(byKey(f.items, "roa").evidence[0].value, 80 / 1100, 1e-12, "ROA");
  // ΔROA: 80/1100 vs 50/1000
  const droa = byKey(f.items, "droa").evidence;
  near(droa[0].value, 0.05, 1e-12); near(droa[1].value, 80 / 1100, 1e-12);
  // 레버리지: 250 / ((1150+1100)/2) vs 300 / ((1100+1000)/2)
  const lev = byKey(f.items, "dlever").evidence;
  near(lev[0].value, 300 / 1050, 1e-12); near(lev[1].value, 250 / 1125, 1e-12);
  assert.equal(byKey(f.items, "dlever").basis, "총차입금");
  // 자산회전율: 1200/1100 vs 1000/1000
  near(byKey(f.items, "dturn").evidence[1].value, 1200 / 1100, 1e-12);
});

test("Piotroski: 전 항목 악화 → 0/9", () => {
  const bad = [
    { fy: 2022, assets: 1000, net: 50, ocf: 60, rev: 1000, debt: 200, curAssets: 500, curLiab: 300, sharesDilAvg: 100, grossProfit: 400 },
    { fy: 2023, assets: 1000, net: 20, ocf: 30, rev: 1000, debt: 200, curAssets: 480, curLiab: 300, sharesDilAvg: 100, grossProfit: 380 },
    { fy: 2024, assets: 1100, net: -10, ocf: -20, rev: 900, debt: 400, curAssets: 400, curLiab: 320, sharesDilAvg: 110, grossProfit: 300 },
  ];
  const f = core.piotroski(file(bad));
  assert.equal(f.of, 9);
  assert.equal(f.pass, 0, JSON.stringify(f.items.filter((x) => x.status === "pass").map((x) => x.key)));
  const chk = core.evaluate(file(bad), { market: "us" }).checks;
  assert.equal(byKey(chk, "fscore").status, "fail");
});

test("Piotroski: 매출총이익 계정이 없으면 그 항목만 데이터 없음(점수 분모에서 빠짐)", () => {
  const rows = good.map(({ grossProfit, ...r }) => r);
  const f = core.piotroski(file(rows));
  assert.equal(byKey(f.items, "dgm").status, "missing");
  assert.equal(f.of, 8);
  assert.equal(f.pass, 8);
});

test("Piotroski: 매출원가(cogs)로도 매출총이익률 계산", () => {
  const rows = good.map(({ grossProfit, ...r }) => ({ ...r, cogs: r.rev - grossProfit }));
  const f = core.piotroski(file(rows));
  assert.equal(byKey(f.items, "dgm").status, "pass");
});

test("Piotroski: 연도가 끊기면(t−1 없음) 비교 항목은 데이터 없음, F 체크는 7개 미만이라 데이터 없음", () => {
  const rows = [good[0], good[2]];
  const res = core.evaluate(file(rows), { market: "us" });
  const f = res.piotroski;
  assert.equal(byKey(f.items, "droa").status, "missing");
  assert.equal(byKey(f.items, "accrual").status, "pass");
  assert.ok(f.of < 7);
  assert.equal(byKey(res.checks, "fscore").status, "missing");
});

test("Piotroski: 금융업은 유동비율·영업현금흐름 항목 해당 없음(6개만 판정 → F 체크는 데이터 없음)", () => {
  const fin = file(good, { flags: ["financial"], industryType: "bank" });
  const f = core.piotroski(fin);
  ["dcr", "cfo", "accrual"].forEach((k) => assert.equal(byKey(f.items, k).status, "na", k));
  assert.equal(f.of, 6);
  assert.equal(byKey(core.evaluate(fin, { market: "us" }).checks, "fscore").status, "missing");
});

// ── Altman Z ──
// 자산 1000, 운전자본 100, 이익잉여금 200, EBIT 100, 시가총액 500, 부채 500, 매출 1500, 자본 500
const zRow = { fy: 2024, assets: 1000, curAssets: 400, curLiab: 300, retainedEarnings: 200, op: 100, liab: 500, rev: 1500, equity: 500 };

test("Altman Z(제조업 원형): 1.2·0.1 + 1.4·0.2 + 3.3·0.1 + 0.6·1.0 + 1.0·1.5 = 2.83 → 회색 구간", () => {
  const z = core.altmanZ(file([zRow]), { model: "manufacturing", marketValue: 500 });
  near(z.z, 2.83, 1e-9);
  assert.equal(z.zone, "grey");
  assert.equal(z.status, "pass");
});

test("Altman Z''(비제조업): 6.56·0.1 + 3.26·0.2 + 6.72·0.1 + 1.05·1.0 = 3.03 → 안전 구간", () => {
  const z = core.altmanZ(file([zRow]), { model: "nonManufacturing" });
  near(z.z, 3.03, 1e-9);
  assert.equal(z.zone, "safe");
});

test("Altman Z: 부실 구간은 경고", () => {
  const r = { ...zRow, curAssets: 200, curLiab: 400, retainedEarnings: -300, op: -50 };
  // X1 −0.2, X2 −0.3, X3 −0.05, X4 0.1(시총 50), X5 1.5 → −0.24 −0.42 −0.165 +0.06 +1.5 = 0.735
  const z = core.altmanZ(file([r]), { model: "manufacturing", marketValue: 50 });
  near(z.z, 0.735, 1e-9);
  assert.equal(z.zone, "distress");
  assert.equal(z.status, "fail");
});

test("Altman Z: 이익잉여금이 없으면 데이터 없음, 금융업은 해당 없음", () => {
  const { retainedEarnings, ...r } = zRow;
  const z = core.altmanZ(file([r]), { model: "nonManufacturing" });
  assert.equal(z.status, "missing");
  assert.match(z.reason, /이익잉여금/);
  assert.equal(core.altmanZ(file([zRow], { flags: ["financial"] }), {}).status, "na");
  // 제조업인데 시가총액이 없으면 데이터 없음
  assert.equal(core.altmanZ(file([zRow]), { model: "manufacturing" }).status, "missing");
});

test("Altman 모형 선택: 제조 업종은 원형, 유통·서비스·금융은 Z''", () => {
  assert.equal(core.altmanModelFor({ industry: "Semiconductors" }).model, "manufacturing");
  assert.equal(core.altmanModelFor({ industry: "Industrial Machinery/Components" }).model, "manufacturing");
  assert.equal(core.altmanModelFor({ industry: "RETAIL: Building Materials" }).model, "nonManufacturing");
  assert.equal(core.altmanModelFor({ industry: "Computer Software: Prepackaged Software" }).model, "nonManufacturing");
  assert.equal(core.altmanModelFor({ industry: "반도체" }).model, "manufacturing");
  assert.equal(core.altmanModelFor({ industry: "IT 서비스" }).model, "nonManufacturing");
  assert.equal(core.altmanModelFor({ industry: "기타", sector: "소재" }).model, "manufacturing");
});

// ── Beneish M ──
test("Beneish M: 모든 지수 1·TATA 0 이면 −2.48(교과서 중립값)", () => {
  const v = { DSRI: 1, GMI: 1, AQI: 1, SGI: 1, DEPI: 1, SGAI: 1, TATA: 0, LVGI: 1 };
  near(core.mScoreFromVars(v), -2.48, 1e-9);
});

test("Beneish M: 논문 표의 조작 기업 평균(−1.196)은 경고, 비조작 평균(−2.246)은 통과", () => {
  const manip = { DSRI: 1.465, GMI: 1.193, AQI: 1.254, SGI: 1.607, DEPI: 1.077, SGAI: 1.041, TATA: 0.031, LVGI: 1.111 };
  const non = { DSRI: 1.031, GMI: 1.014, AQI: 1.039, SGI: 1.134, DEPI: 1.001, SGAI: 1.054, TATA: 0.018, LVGI: 1.037 };
  near(core.mScoreFromVars(manip), -1.195681, 1e-6);
  near(core.mScoreFromVars(non), -2.245854, 1e-6);
  assert.ok(core.mScoreFromVars(manip) > core.THRESHOLDS.M_THRESHOLD);
  assert.ok(core.mScoreFromVars(non) < core.THRESHOLDS.M_THRESHOLD);
});

test("Beneish 변수: 재무 행에서 8개 지수 계산", () => {
  const p = { fy: 2023, rev: 1000, receivables: 100, grossProfit: 400, curAssets: 300, ppe: 400, assets: 1000, da: 50, sga: 200, curLiab: 200, ltDebt: 100, net: 60, ocf: 60 };
  const t = { fy: 2024, rev: 1200, receivables: 144, grossProfit: 420, curAssets: 330, ppe: 420, assets: 1100, da: 50, sga: 264, curLiab: 250, ltDebt: 80, net: 90, ocf: 57 };
  const v = core.beneishVars(t, p);
  near(v.DSRI, (144 / 1200) / (100 / 1000), 1e-12, "DSRI");            // 1.2
  near(v.GMI, (400 / 1000) / (420 / 1200), 1e-12, "GMI");              // 0.4/0.35
  near(v.AQI, (1 - 750 / 1100) / (1 - 700 / 1000), 1e-12, "AQI");
  near(v.SGI, 1.2, 1e-12, "SGI");
  near(v.DEPI, (50 / 450) / (50 / 470), 1e-12, "DEPI");
  near(v.SGAI, (264 / 1200) / (200 / 1000), 1e-12, "SGAI");            // 1.1
  near(v.LVGI, (330 / 1100) / (300 / 1000), 1e-12, "LVGI");            // 1.0
  near(v.TATA, (90 - 57) / 1100, 1e-12, "TATA");
  const b = core.beneishM(file([p, t]));
  assert.ok(b.status === "pass" || b.status === "fail");
  near(b.m, core.mScoreFromVars(v), 1e-12);
});

test("Beneish M: 판관비·유형자산 등이 없으면 M 없음(데이터 없음), 계산 가능한 변수는 남김", () => {
  const p = { fy: 2023, rev: 1000, receivables: 100, assets: 1000, curAssets: 300, curLiab: 200, net: 60, ocf: 60 };
  const t = { fy: 2024, rev: 1200, receivables: 144, assets: 1100, curAssets: 330, curLiab: 250, net: 90, ocf: 57 };
  const b = core.beneishM(file([p, t]));
  assert.equal(b.status, "missing");
  near(b.vars.DSRI, 1.2, 1e-12);
  near(b.vars.SGI, 1.2, 1e-12);
  assert.equal(b.vars.GMI, null);
  assert.match(b.reason, /3개만/);
  assert.equal(core.beneishM(file([p, t], { flags: ["financial"] })).status, "na");
});

// ── 기타 점검 ──
test("희석: 1년 +6% 는 경고, 1년 +2%·3년 +8% 는 통과, 3년 +12% 는 경고", () => {
  const mk = (s0, s1, s2, s3) => file([
    { fy: 2021, sharesDilAvg: s0 }, { fy: 2022, sharesDilAvg: s1 }, { fy: 2023, sharesDilAvg: s2 }, { fy: 2024, sharesDilAvg: s3 },
  ]);
  assert.equal(core.dilutionCheck(mk(100, 100, 100, 106)).status, "fail");
  const ok = core.dilutionCheck(mk(100, 103, 105.88, 108));
  assert.equal(ok.status, "pass");
  near(ok.g3, 0.08, 1e-9);
  assert.equal(core.dilutionCheck(mk(100, 104, 108, 112)).status, "fail");
  // 희석 주식수가 없으면 기말 발행주식수(KR)
  const kr = core.dilutionCheck(file([{ fy: 2023, sharesOut: 1000 }, { fy: 2024, sharesOut: 990 }]));
  assert.equal(kr.status, "pass");
  assert.equal(kr.basis, "basic");
});

test("이자보상배율: 1.5배 미만 경고, 무차입 통과, 이자비용 결측은 데이터 없음, 금융업 해당 없음", () => {
  assert.equal(core.interestCoverageCheck(file([{ fy: 2024, op: 120, interest: 100, debt: 1000 }])).status, "fail");
  const ok = core.interestCoverageCheck(file([{ fy: 2024, op: 500, interest: 100, debt: 1000 }]));
  assert.equal(ok.status, "pass");
  near(ok.value, 5, 1e-12);
  assert.equal(core.interestCoverageCheck(file([{ fy: 2024, op: 500, debt: 0 }])).status, "pass");
  assert.equal(core.interestCoverageCheck(file([{ fy: 2024, op: 500, debt: 10 }])).status, "missing");
  assert.equal(core.interestCoverageCheck(file([{ fy: 2024, op: 500, interest: 1 }], { flags: ["financial"] })).status, "na");
});

test("이익의 질·부채비율 급증·자본잠식", () => {
  assert.equal(core.earningsQualityCheck(file([{ fy: 2024, ocf: 80, net: 100 }])).status, "fail");
  assert.equal(core.earningsQualityCheck(file([{ fy: 2024, ocf: 120, net: 100 }])).status, "pass");
  assert.equal(core.earningsQualityCheck(file([{ fy: 2024, net: 100 }])).status, "missing");
  const lev = (l0, e0, l1, e1) => core.leverageJumpCheck(file([{ fy: 2023, liab: l0, equity: e0 }, { fy: 2024, liab: l1, equity: e1 }]));
  assert.equal(lev(100, 100, 160, 100).status, "fail");   // 100% → 160% (+60%p)
  assert.equal(lev(100, 100, 140, 100).status, "pass");   // +40%p
  assert.equal(lev(100, 100, 140, -5).status, "fail");    // 자본잠식
  assert.equal(core.leverageJumpCheck(file([{ fy: 2024, liab: 1, equity: 1 }])).status, "missing");
});

test("감사의견: 적정 통과, 의견거절·한정·부적정 경고, 목록에 없으면 데이터 없음", () => {
  assert.equal(core.auditCheck({ opinion: "적정의견", adverse: false }).status, "pass");
  assert.equal(core.auditCheck({ opinion: "의견거절", adverse: true }).status, "fail");
  assert.equal(core.auditCheck({ opinion: "한정의견" }).status, "fail");
  assert.equal(core.auditCheck({ opinion: "부적정의견" }).status, "fail");
  assert.equal(core.auditCheck(null).status, "missing");
});

test("evaluate: 통과 n/m 은 데이터 없음·해당 없음을 분모에서 뺀다. 감사의견은 KR 만", () => {
  const rows = good.map((r) => ({ ...r, liab: 500, equity: 600, op: 100, interest: 10 }));
  const us = core.evaluate(file(rows), { market: "us", industry: "Semiconductors" });
  assert.equal(us.checks.some((c) => c.key === "audit"), false);
  assert.equal(us.of, us.pass + us.fail);
  assert.equal(us.checks.length, us.of + us.missing + us.na);
  // Altman(이익잉여금 없음)·Beneish(판관비 등 없음)는 데이터 없음
  assert.equal(byKey(us.checks, "altman").status, "missing");
  assert.equal(byKey(us.checks, "beneish").status, "missing");
  assert.equal(us.model.model, "manufacturing");
  const kr = core.evaluate(file(rows, { market: "kr", currency: "KRW" }), { market: "kr", audit: { opinion: "적정의견", adverse: false } });
  assert.equal(byKey(kr.checks, "audit").status, "pass");
  const row = core.compactRow(kr);
  assert.equal(row.f, 9);
  assert.equal(row.fOf, 9);
  assert.equal(row.z, null);
  assert.equal(row.of, kr.of);
  assert.equal(core.evaluate(file([]), {}), null);
});

if (failures.length) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log(`OK ${passed} tests`);
