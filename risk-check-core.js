// risk-check-core.js — 재무 위험 점검(체크리스트) 순수 계산. DOM·네트워크 없음.
// 화면: risk-check.js(종목 분석 › 재무 탭 #riskCheckSection). 스크리너 집계: scripts/build_risk_check.mjs.
// node 테스트: scripts/tests/test_risk_check_core.mjs (교과서 예제 수치로 F·Z·M 검산).
//
// 입력은 재무 확장 종목 파일(scripts/financials_common.py 스키마 1)의 연간 행이다. 새 수집 없음.
// 과거 재무제표로 계산한 '점검' 이며 예측·매도 신호가 아니다.
//
// 항목 상태: "pass"(통과) | "fail"(경고) | "missing"(데이터 없음) | "na"(해당 없음 — 금융업 등).
// 통과 n/m 의 m 은 pass + fail 만 센다. 데이터 없음·해당 없음은 점수에 넣지 않는다(추정으로 채우지 않는다).
//
// 매출총이익(grossProfit)/매출원가(cogs)·판관비(sga)·유형자산(ppe)·이익잉여금(retainedEarnings)·장기차입금(ltDebt)은
// 2026-09-27 재무 보강으로 빌더(financials_common.py)에 추가됐다. 재수집 전 파일이나 그 계정을 공시하지 않는
// 회사는 행에 없고, 그때는 그 항목만 '데이터 없음'. 이자비용은 스키마 필드 interest 를 읽는다.
//
// 정의(화면 툴팁과 같은 문장 — 바꾸면 risk-check.js 도 같이)
// ■ Piotroski F-Score(2000) 9항목, t = 최근 회계연도, t−1·t−2 = 직전 연도들(연속 연도만)
//   1 ROA = 순이익 ÷ 기초 자산총계 > 0          2 영업현금흐름(OCF) ÷ 기초 자산총계 > 0
//   3 ΔROA > 0                                   4 OCF > 순이익(발생액)
//   5 Δ레버리지 < 0: 장기차입금 ÷ 평균 자산총계(장기차입금이 없으면 총차입금으로 — 화면에 표시)
//   6 Δ유동비율 > 0                              7 주식 수 비증가(희석 가중평균, 없으면 기말 발행주식수)
//   8 Δ매출총이익률 > 0                          9 Δ자산회전율(매출 ÷ 기초 자산총계) > 0
//   금융업은 6(유동비율)·2·4(영업현금흐름 — 예수금·대출 증감이 섞임)가 해당 없음.
//   체크리스트 판정: 판정된 항목이 7개 이상일 때만, 통과 ≤ 판정 수의 1/3 이면 경고(9개 기준 3점 이하).
// ■ Altman Z-Score — 금융업은 해당 없음
//   제조업(1968 원형): Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5,  부실 < 1.81 ≤ 회색 ≤ 2.99 < 안전
//   비제조업(Z''):     Z = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4',     부실 < 1.1 ≤ 회색 ≤ 2.6 < 안전
//   X1 = 운전자본(유동자산 − 유동부채) ÷ 자산, X2 = 이익잉여금 ÷ 자산, X3 = EBIT(영업이익) ÷ 자산,
//   X4 = 시가총액 ÷ 부채총계, X4' = 자본총계(장부) ÷ 부채총계, X5 = 매출 ÷ 자산
// ■ Beneish M-Score(1999, 8변수) — 금융업은 해당 없음. M > −1.78 이면 경고. 8개가 모두 있을 때만 M 을 낸다.
//   M = −4.84 + 0.920·DSRI + 0.528·GMI + 0.404·AQI + 0.892·SGI + 0.115·DEPI − 0.172·SGAI + 4.679·TATA − 0.327·LVGI
// ■ 주식 수 희석: 1년 증가율 > 5% 또는 3년 누적 > 10% 이면 경고
// ■ 이자보상배율 = 영업이익 ÷ 이자비용 < 1.5배면 경고(차입금 0 이면 통과)
// ■ 이익의 질: 영업현금흐름 < 순이익이면 경고
// ■ 부채비율(부채총계 ÷ 자본총계) 전년 대비 +50%p 이상 급증, 또는 자본총계 ≤ 0(자본잠식)이면 경고
// ■ 감사의견(국내만): 적정의견이 아니면 경고
(function (root) {
  "use strict";

  const F_WARN_FRACTION = 1 / 3;
  const F_MIN_EVALUATED = 7;
  const DILUTION_1Y = 0.05;
  const DILUTION_3Y = 0.10;
  const COVERAGE_MIN = 1.5;
  const LEVERAGE_JUMP_PP = 0.5;   // 부채비율 +50%p
  const M_THRESHOLD = -1.78;
  const FIN_OCF_REASON = "금융업은 영업현금흐름에 예수금·대출 증감이 섞여 해당 없음";
  const Z_ZONES = {
    manufacturing: { distress: 1.81, safe: 2.99 },
    nonManufacturing: { distress: 1.1, safe: 2.6 },
  };

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  function div(a, b) {
    const x = num(a), y = num(b);
    if (x === null || y === null || y === 0) return null;
    return x / y;
  }
  function has(row, k) { return !!row && num(row[k]) !== null; }

  function item(key, label, status, extra) {
    return Object.assign({ key, label, status, evidence: [], rule: "", reason: "" }, extra || {});
  }
  const ev = (label, value, unit) => ({ label, value: num(value), unit: unit || "num" });

  // 연간 행: t = 마지막 행, p1·p2·p3 = fy 가 정확히 1·2·3 적은 행(없으면 null — 건너뛴 연도를 잇지 않는다).
  function pickAnnual(file) {
    const annual = (file && Array.isArray(file.annual)) ? file.annual : [];
    if (!annual.length) return null;
    const t = annual[annual.length - 1];
    const byFy = new Map(annual.map((r) => [Number(r.fy), r]));
    const fy = Number(t.fy);
    return { t, p1: byFy.get(fy - 1) || null, p2: byFy.get(fy - 2) || null, p3: byFy.get(fy - 3) || null };
  }

  function isFinancial(file) {
    const f = (file && file.flags) || [];
    return f.includes("financial") || ["bank", "insurance", "financial"].includes(file && file.industryType);
  }

  // 주식 수 두 시점: 희석 가중평균(둘 다 있을 때) → 기말 발행주식수(둘 다 있을 때). financials-core shareChange 와 같은 규칙.
  function sharesPair(a, b) {
    if (has(a, "sharesDilAvg") && has(b, "sharesDilAvg")) return { now: a.sharesDilAvg, then: b.sharesDilAvg, basis: "diluted" };
    if (has(a, "sharesOut") && has(b, "sharesOut")) return { now: a.sharesOut, then: b.sharesOut, basis: "basic" };
    return null;
  }

  function grossMargin(row) {
    if (!row) return null;
    const rev = num(row.rev);
    if (rev === null || rev <= 0) return null;
    if (num(row.grossProfit) !== null) return row.grossProfit / rev;
    if (num(row.cogs) !== null) return (rev - row.cogs) / rev;
    return null;
  }

  // ── Piotroski F-Score ──────────────────────────────────────────────
  function piotroski(file) {
    const pk = pickAnnual(file);
    const items = [];
    const fin = isFinancial(file);
    if (!pk) return { pass: 0, of: 0, items, status: "missing" };
    const { t, p1, p2 } = pk;
    const push = (x) => items.push(x);
    const need = (key, label, rule, reason) => item(key, label, "missing", { rule, reason });
    const gt0 = (v) => (v > 0 ? "pass" : "fail");

    // 1 ROA
    {
      const rule = "순이익 ÷ 기초 자산총계 > 0";
      const roa = has(p1, "assets") && p1.assets > 0 ? div(t.net, p1.assets) : null;
      push(roa === null ? need("roa", "ROA 양수", rule, "순이익 또는 전년 말 자산총계 없음")
        : item("roa", "ROA 양수", gt0(roa), { rule, evidence: [ev(`ROA FY${t.fy}`, roa, "pct")] }));
    }
    // 2 CFO
    {
      const rule = "영업활동현금흐름 ÷ 기초 자산총계 > 0";
      const cfo = has(p1, "assets") && p1.assets > 0 ? div(t.ocf, p1.assets) : null;
      if (fin) push(item("cfo", "영업현금흐름 양수", "na", { rule, reason: FIN_OCF_REASON }));
      else push(cfo === null ? need("cfo", "영업현금흐름 양수", rule, "영업현금흐름 또는 전년 말 자산총계 없음")
        : item("cfo", "영업현금흐름 양수", gt0(cfo), { rule, evidence: [ev(`OCF/자산 FY${t.fy}`, cfo, "pct")] }));
    }
    // 3 ΔROA
    {
      const rule = "ROA(올해) − ROA(전년) > 0, ROA = 순이익 ÷ 기초 자산총계";
      const a = has(p1, "assets") && p1.assets > 0 ? div(t.net, p1.assets) : null;
      const b = p1 && has(p2, "assets") && p2.assets > 0 ? div(p1.net, p2.assets) : null;
      push(a === null || b === null ? need("droa", "ROA 개선", rule, "3개 연도 연속 자산·순이익 필요")
        : item("droa", "ROA 개선", gt0(a - b), { rule, evidence: [ev(`FY${p1.fy}`, b, "pct"), ev(`FY${t.fy}`, a, "pct")] }));
    }
    // 4 발생액
    {
      const rule = "영업활동현금흐름 > 순이익";
      if (fin) push(item("accrual", "현금흐름 > 순이익", "na", { rule, reason: FIN_OCF_REASON }));
      else push(!has(t, "ocf") || !has(t, "net") ? need("accrual", "현금흐름 > 순이익", rule, "영업현금흐름 또는 순이익 없음")
        : item("accrual", "현금흐름 > 순이익", t.ocf > t.net ? "pass" : "fail", { rule, evidence: [ev("OCF", t.ocf, "money"), ev("순이익", t.net, "money")] }));
    }
    // 5 Δ레버리지
    {
      const useLt = has(t, "ltDebt") && has(p1, "ltDebt");
      const k = useLt ? "ltDebt" : "debt";
      const basis = useLt ? "장기차입금" : "총차입금";
      const rule = `${basis} ÷ 평균 자산총계가 전년보다 낮음(둘 다 0 이면 통과)${useLt ? "" : " — 장기차입금이 따로 없어 총차입금으로 계산"}`;
      const avg = (a, b) => (has(a, "assets") && has(b, "assets") ? (a.assets + b.assets) / 2 : null);
      const la = has(t, k) && p1 ? div(t[k], avg(t, p1)) : null;
      const lb = has(p1, k) && p2 ? div(p1[k], avg(p1, p2)) : null;
      if (la === null || lb === null) push(need("dlever", "레버리지 감소", rule, "3개 연도 연속 차입금·자산 필요"));
      else push(item("dlever", "레버리지 감소", (la < lb || (la === 0 && lb === 0)) ? "pass" : "fail",
        { rule, basis, evidence: [ev(`FY${p1.fy}`, lb, "pct"), ev(`FY${t.fy}`, la, "pct")] }));
    }
    // 6 Δ유동비율
    {
      const rule = "유동자산 ÷ 유동부채가 전년보다 높음";
      if (fin) push(item("dcr", "유동비율 개선", "na", { rule, reason: "금융업은 유동·비유동 구분이 없어 해당 없음" }));
      else {
        const a = div(t.curAssets, t.curLiab), b = p1 ? div(p1.curAssets, p1.curLiab) : null;
        push(a === null || b === null ? need("dcr", "유동비율 개선", rule, "2개 연도 유동자산·유동부채 필요")
          : item("dcr", "유동비율 개선", a > b ? "pass" : "fail", { rule, evidence: [ev(`FY${p1.fy}`, b, "x"), ev(`FY${t.fy}`, a, "x")] }));
      }
    }
    // 7 신주 발행 없음
    {
      const rule = "주식 수가 전년보다 늘지 않음(희석 가중평균, 없으면 기말 발행주식수)";
      const sp = p1 ? sharesPair(t, p1) : null;
      push(!sp ? need("shares", "신주 발행 없음", rule, "2개 연도 주식 수 필요")
        : item("shares", "신주 발행 없음", sp.now <= sp.then ? "pass" : "fail",
          { rule, basis: sp.basis, evidence: [ev("전년 대비", sp.now / sp.then - 1, "spct")] }));
    }
    // 8 Δ매출총이익률
    {
      const rule = "매출총이익 ÷ 매출이 전년보다 높음";
      const a = grossMargin(t), b = grossMargin(p1);
      push(a === null || b === null ? need("dgm", "매출총이익률 개선", rule, "매출총이익(매출원가) 계정이 수집 데이터에 없음")
        : item("dgm", "매출총이익률 개선", a > b ? "pass" : "fail", { rule, evidence: [ev(`FY${p1.fy}`, b, "pct"), ev(`FY${t.fy}`, a, "pct")] }));
    }
    // 9 Δ자산회전율
    {
      const rule = "매출 ÷ 기초 자산총계가 전년보다 높음";
      const a = has(p1, "assets") && p1.assets > 0 ? div(t.rev, p1.assets) : null;
      const b = p1 && has(p2, "assets") && p2.assets > 0 ? div(p1.rev, p2.assets) : null;
      push(a === null || b === null ? need("dturn", "자산회전율 개선", rule, "3개 연도 연속 매출·자산 필요")
        : item("dturn", "자산회전율 개선", a > b ? "pass" : "fail", { rule, evidence: [ev(`FY${p1.fy}`, b, "x"), ev(`FY${t.fy}`, a, "x")] }));
    }
    const pass = items.filter((x) => x.status === "pass").length;
    const of = items.filter((x) => x.status === "pass" || x.status === "fail").length;
    return { pass, of, items, fy: t.fy };
  }

  // ── Altman Z ───────────────────────────────────────────────────────
  const MFG_RE_US = /manufactur|machinery|semiconductor|chemical|metal fabric|steel|aerospace|auto parts|auto manufacturing|motor vehicles|electrical products|electronic components|electrical components|telecommunications equipment|communications equipment|computer communications equipment|computer peripheral|consumer electronics|apparel|home furnishings|toys|package goods|cosmetics|beverages \(production|packaged foods|specialty foods|meat\/poultry|containers|packaging|building products|plastic|paper|forest products|textiles|tobacco|ordnance|fluid controls|ophthalmic|pharmaceutical|medicinal chemicals|biological products|instruments|apparatus|industrial specialties|oil refining|pollution control equipment|construction\/ag equipment|oil and gas field machinery|garments|medical electronics/i;
  const NOT_MFG_RE_US = /retail|stores|distribut|dealers|services/i;
  const MFG_RE_KR = /반도체|제약|자동차|화학|전자장비|의료기기|기계|의류|식품|디스플레이|전기제품|모바일 부품|화장품|통신장비|건축자재|철강|비철금속|로보틱스|방산|우주항공|전기장비|조선|에너지소재|포장재|IT 장비|전자제품|2차전지|음료|가구|제지|레저용품|전자부품|전력기기|담배|사무용기기|문구류|가정용품/;
  const MFG_SECTORS = new Set(["BASIC MATERIALS", "소재"]);

  // 업종으로 모형 선택. 산업명에 제조 키워드가 있으면(유통·서비스 제외) 제조업 원형, 아니면 비제조업 Z''.
  function altmanModelFor(info) {
    const ind = String((info && info.industry) || "");
    const sec = String((info && info.sector) || "").toUpperCase();
    let mfg;
    if (ind && ind !== "Other" && ind !== "기타") mfg = (MFG_RE_US.test(ind) && !NOT_MFG_RE_US.test(ind)) || MFG_RE_KR.test(ind);
    else mfg = MFG_SECTORS.has(sec) || MFG_SECTORS.has(String((info && info.sector) || ""));
    return { model: mfg ? "manufacturing" : "nonManufacturing", basis: ind || sec || "" };
  }

  function altmanZ(file, opts) {
    const o = opts || {};
    const model = o.model === "manufacturing" ? "manufacturing" : "nonManufacturing";
    const label = model === "manufacturing" ? "Altman Z (제조업)" : "Altman Z'' (비제조업)";
    const rule = model === "manufacturing"
      ? "Z = 1.2·운전자본/자산 + 1.4·이익잉여금/자산 + 3.3·EBIT/자산 + 0.6·시가총액/부채총계 + 1.0·매출/자산. 1.81 미만 부실 구간, 2.99 초과 안전 구간"
      : "Z'' = 6.56·운전자본/자산 + 3.26·이익잉여금/자산 + 6.72·EBIT/자산 + 1.05·자본총계/부채총계. 1.1 미만 부실 구간, 2.6 초과 안전 구간";
    if (isFinancial(file)) return item("altman", "Altman Z", "na", { model, rule, reason: "금융업은 Altman Z 적용 대상이 아님" });
    const pk = pickAnnual(file);
    const t = pk && pk.t;
    const missing = [];
    const need = (k, name) => { if (!has(t, k)) missing.push(name); };
    need("assets", "자산총계"); need("curAssets", "유동자산"); need("curLiab", "유동부채");
    need("retainedEarnings", "이익잉여금"); need("op", "영업이익"); need("liab", "부채총계");
    if (model === "manufacturing") { need("rev", "매출"); if (num(o.marketValue) === null) missing.push("시가총액(재무 통화)"); }
    else need("equity", "자본총계");
    if (missing.length || !(t.assets > 0) || !(t.liab > 0)) {
      const other = missing.filter((x) => x !== "이익잉여금");
      const reason = [
        missing.includes("이익잉여금") ? "이익잉여금 계정이 수집 데이터에 없음" : "",
        other.length ? `${other.join("·")} 없음` : "",
        !missing.length ? "자산총계·부채총계가 양수여야 함" : "",
      ].filter(Boolean).join(" · ");
      return item("altman", label, "missing", { model, rule, reason });
    }
    const x1 = (t.curAssets - t.curLiab) / t.assets;
    const x2 = t.retainedEarnings / t.assets;
    const x3 = t.op / t.assets;
    let z, x4, x5 = null;
    if (model === "manufacturing") {
      x4 = o.marketValue / t.liab;
      x5 = t.rev / t.assets;
      z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;
    } else {
      x4 = t.equity / t.liab;
      z = 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
    }
    const zones = Z_ZONES[model];
    const zone = z < zones.distress ? "distress" : z > zones.safe ? "safe" : "grey";
    const evidence = [ev("Z", z, "num"), ev("X1 운전자본/자산", x1, "num"), ev("X2 이익잉여금/자산", x2, "num"), ev("X3 EBIT/자산", x3, "num"),
      ev(model === "manufacturing" ? "X4 시가총액/부채" : "X4 자본/부채", x4, "num")];
    if (x5 !== null) evidence.push(ev("X5 매출/자산", x5, "num"));
    return item("altman", label, zone === "distress" ? "fail" : "pass", { model, rule, z, zone, evidence, fy: t.fy });
  }

  // ── Beneish M ──────────────────────────────────────────────────────
  const M_COEF = { DSRI: 0.920, GMI: 0.528, AQI: 0.404, SGI: 0.892, DEPI: 0.115, SGAI: -0.172, TATA: 4.679, LVGI: -0.327 };
  const M_DEFS = {
    DSRI: ["매출채권 회전 지수", "(매출채권/매출)ₜ ÷ (매출채권/매출)ₜ₋₁", ["매출채권"]],
    GMI: ["매출총이익률 지수", "매출총이익률ₜ₋₁ ÷ 매출총이익률ₜ", ["매출총이익(매출원가)"]],
    AQI: ["자산 질 지수", "[1 − (유동자산+유형자산)/자산]ₜ ÷ 같은 값ₜ₋₁", ["유형자산"]],
    SGI: ["매출 성장 지수", "매출ₜ ÷ 매출ₜ₋₁", ["매출"]],
    DEPI: ["감가상각률 지수", "[감가상각/(감가상각+유형자산)]ₜ₋₁ ÷ 같은 값ₜ", ["감가상각비", "유형자산"]],
    SGAI: ["판관비 지수", "(판관비/매출)ₜ ÷ (판관비/매출)ₜ₋₁", ["판매비와관리비"]],
    LVGI: ["레버리지 지수", "[(유동부채+장기차입금)/자산]ₜ ÷ 같은 값ₜ₋₁", ["장기차입금"]],
    TATA: ["총발생액/자산", "(순이익 − 영업현금흐름)ₜ ÷ 자산ₜ", ["순이익", "영업현금흐름"]],
  };

  function beneishVars(t, p) {
    const out = {};
    const ok = (...vals) => vals.every((v) => v !== null && v !== undefined && Number.isFinite(v));
    // DSRI
    { const a = div(t.receivables, t.rev), b = p ? div(p.receivables, p.rev) : null; out.DSRI = ok(a, b) && b !== 0 ? a / b : null; }
    // GMI
    { const a = grossMargin(t), b = grossMargin(p); out.GMI = ok(a, b) && a !== 0 ? b / a : null; }
    // AQI
    {
      const q = (r) => (has(r, "curAssets") && has(r, "ppe") && has(r, "assets") && r.assets > 0 ? 1 - (r.curAssets + r.ppe) / r.assets : null);
      const a = q(t), b = q(p); out.AQI = ok(a, b) && b !== 0 ? a / b : null;
    }
    // SGI
    out.SGI = p && has(t, "rev") && has(p, "rev") && p.rev > 0 ? t.rev / p.rev : null;
    // DEPI
    {
      const d = (r) => (has(r, "da") && has(r, "ppe") && r.da + r.ppe > 0 ? r.da / (r.da + r.ppe) : null);
      const a = d(t), b = d(p); out.DEPI = ok(a, b) && a !== 0 ? b / a : null;
    }
    // SGAI
    { const a = div(t.sga, t.rev), b = p ? div(p.sga, p.rev) : null; out.SGAI = ok(a, b) && b !== 0 ? a / b : null; }
    // LVGI
    {
      const l = (r) => (has(r, "curLiab") && has(r, "ltDebt") && has(r, "assets") && r.assets > 0 ? (r.curLiab + r.ltDebt) / r.assets : null);
      const a = l(t), b = l(p); out.LVGI = ok(a, b) && b !== 0 ? a / b : null;
    }
    // TATA
    out.TATA = has(t, "net") && has(t, "ocf") && has(t, "assets") && t.assets > 0 ? (t.net - t.ocf) / t.assets : null;
    return out;
  }

  function mScoreFromVars(v) {
    let m = -4.84;
    for (const k of Object.keys(M_COEF)) {
      if (v[k] === null || v[k] === undefined || !Number.isFinite(v[k])) return null;
      m += M_COEF[k] * v[k];
    }
    return m;
  }

  function beneishM(file) {
    const rule = `M = −4.84 + 0.920·DSRI + 0.528·GMI + 0.404·AQI + 0.892·SGI + 0.115·DEPI − 0.172·SGAI + 4.679·TATA − 0.327·LVGI. M > ${M_THRESHOLD} 이면 경고(이익 조작 가능성 모형 — 사실 판정이 아님)`;
    if (isFinancial(file)) return item("beneish", "Beneish M", "na", { rule, reason: "금융업은 Beneish M 적용 대상이 아님", vars: {} });
    const pk = pickAnnual(file);
    if (!pk || !pk.p1) return item("beneish", "Beneish M", "missing", { rule, reason: "2개 연도 연속 연간 재무 필요", vars: {} });
    const vars = beneishVars(pk.t, pk.p1);
    const m = mScoreFromVars(vars);
    const lackVars = Object.keys(M_DEFS).filter((k) => vars[k] === null);
    const lacking = [...new Set([].concat(...lackVars.map((k) => M_DEFS[k][2])))];
    const varsEv = Object.keys(M_DEFS).map((k) => ev(k, vars[k], "num"));
    if (m === null) {
      return item("beneish", "Beneish M", "missing", {
        rule, vars, evidence: varsEv,
        reason: `8개 변수 중 ${8 - lackVars.length}개만 계산 가능 — ${lacking.join("·")} 계정이 수집 데이터에 없음`,
      });
    }
    return item("beneish", "Beneish M", m > M_THRESHOLD ? "fail" : "pass", { rule, vars, m, evidence: [ev("M", m, "num")].concat(varsEv), fy: pk.t.fy });
  }

  // ── 기타 점검 ──────────────────────────────────────────────────────
  function dilutionCheck(file) {
    const rule = `주식 수 1년 증가율 > ${DILUTION_1Y * 100}% 또는 3년 누적 > ${DILUTION_3Y * 100}% 이면 경고(희석 가중평균, 없으면 기말 발행주식수)`;
    const pk = pickAnnual(file);
    const s1 = pk && pk.p1 ? sharesPair(pk.t, pk.p1) : null;
    const s3 = pk && pk.p3 ? sharesPair(pk.t, pk.p3) : null;
    if (!s1 && !s3) return item("dilution", "주식 수 희석", "missing", { rule, reason: "연도별 주식 수 없음" });
    const g1 = s1 ? s1.now / s1.then - 1 : null;
    const g3 = s3 ? s3.now / s3.then - 1 : null;
    const bad = (g1 !== null && g1 > DILUTION_1Y) || (g3 !== null && g3 > DILUTION_3Y);
    return item("dilution", "주식 수 희석", bad ? "fail" : "pass", {
      rule, basis: (s1 || s3).basis, g1, g3,
      evidence: [ev("1년", g1, "spct"), ev("3년", g3, "spct")],
    });
  }

  function interestCoverageCheck(file) {
    const rule = `영업이익 ÷ 이자비용 < ${COVERAGE_MIN}배면 경고(총차입금이 0 이면 통과)`;
    if (isFinancial(file)) return item("coverage", "이자보상배율", "na", { rule, reason: "금융업은 이자비용이 영업비용이라 해당 없음" });
    const pk = pickAnnual(file);
    const t = pk && pk.t;
    if (!t) return item("coverage", "이자보상배율", "missing", { rule, reason: "연간 재무 없음" });
    if (has(t, "debt") && t.debt === 0 && !(num(t.interest) > 0)) {
      return item("coverage", "이자보상배율", "pass", { rule, evidence: [ev("총차입금", 0, "money")], note: "무차입" });
    }
    if (!has(t, "op") || !(num(t.interest) > 0)) {
      return item("coverage", "이자보상배율", "missing", { rule, reason: has(t, "op") ? "이자비용 계정이 공시 데이터에 없음" : "영업이익 없음" });
    }
    const c = t.op / t.interest;
    return item("coverage", "이자보상배율", c < COVERAGE_MIN ? "fail" : "pass", { rule, value: c, evidence: [ev(`FY${t.fy}`, c, "x"), ev("영업이익", t.op, "money"), ev("이자비용", t.interest, "money")] });
  }

  function earningsQualityCheck(file) {
    const rule = "영업활동현금흐름 < 순이익이면 경고(이익이 현금으로 들어오지 않음)";
    if (isFinancial(file)) return item("quality", "이익의 질", "na", { rule, reason: FIN_OCF_REASON });
    const pk = pickAnnual(file);
    const t = pk && pk.t;
    if (!has(t, "ocf") || !has(t, "net")) return item("quality", "이익의 질", "missing", { rule, reason: "영업현금흐름 또는 순이익 없음" });
    return item("quality", "이익의 질", t.ocf < t.net ? "fail" : "pass", { rule, evidence: [ev("영업현금흐름", t.ocf, "money"), ev("순이익", t.net, "money")] });
  }

  function leverageJumpCheck(file) {
    const rule = `부채비율(부채총계 ÷ 자본총계)이 전년 대비 +${LEVERAGE_JUMP_PP * 100}%p 이상 늘거나 자본총계 ≤ 0(자본잠식)이면 경고`;
    if (isFinancial(file)) return item("leverage", "부채비율 급증", "na", { rule, reason: "금융업은 예금·보험부채가 영업 자금이라 해당 없음" });
    const pk = pickAnnual(file);
    const t = pk && pk.t, p = pk && pk.p1;
    if (!has(t, "liab") || !has(t, "equity")) return item("leverage", "부채비율 급증", "missing", { rule, reason: "부채총계·자본총계 없음" });
    if (t.equity <= 0) return item("leverage", "부채비율 급증", "fail", { rule, evidence: [ev("자본총계", t.equity, "money")], note: "자본잠식" });
    const a = t.liab / t.equity;
    const b = has(p, "liab") && has(p, "equity") && p.equity > 0 ? p.liab / p.equity : null;
    if (b === null) return item("leverage", "부채비율 급증", "missing", { rule, reason: "전년 부채비율 없음", evidence: [ev(`FY${t.fy}`, a, "pct")] });
    return item("leverage", "부채비율 급증", a - b >= LEVERAGE_JUMP_PP ? "fail" : "pass", { rule, evidence: [ev(`FY${p.fy}`, b, "pct"), ev(`FY${t.fy}`, a, "pct"), ev("변화", a - b, "pp")] });
  }

  function auditCheck(audit) {
    const rule = "최신 사업보고서 감사의견이 '적정의견' 이 아니면 경고(의견거절·한정·부적정은 상장폐지 사유)";
    if (!audit || !audit.opinion) return item("audit", "감사의견", "missing", { rule, reason: "감사의견 수집 목록에 없음" });
    const adverse = audit.adverse === true || !/적정/.test(audit.opinion) || /부적정/.test(audit.opinion);
    return item("audit", "감사의견", adverse ? "fail" : "pass", { rule, opinion: audit.opinion, auditor: audit.auditor || "", period: audit.year || "", emphasis: audit.emphasis || "" });
  }

  function fScoreCheck(f) {
    const rule = `Piotroski F-Score. 판정 항목 ${F_MIN_EVALUATED}개 이상일 때 통과 ≤ 판정 수의 1/3(9개 기준 3점 이하)이면 경고`;
    if (f.of < F_MIN_EVALUATED) return item("fscore", "Piotroski F-Score", "missing", { rule, pass: f.pass, of: f.of, reason: `판정 가능한 항목이 ${f.of}개(${F_MIN_EVALUATED}개 미만)` });
    return item("fscore", "Piotroski F-Score", f.pass <= f.of * F_WARN_FRACTION ? "fail" : "pass", { rule, pass: f.pass, of: f.of });
  }

  // 전체 점검. opts: { market: "us"|"kr", marketValue(재무 통화 절대액), model, sector, industry, audit(KR 감사의견 행) }
  function evaluate(file, opts) {
    const o = opts || {};
    const pk = pickAnnual(file);
    if (!pk) return null;
    const modelInfo = o.model ? { model: o.model, basis: "" } : altmanModelFor({ sector: o.sector, industry: o.industry });
    const f = piotroski(file);
    const checks = [
      fScoreCheck(f),
      altmanZ(file, { model: modelInfo.model, marketValue: o.marketValue }),
      beneishM(file),
      dilutionCheck(file),
      interestCoverageCheck(file),
      earningsQualityCheck(file),
      leverageJumpCheck(file),
    ];
    if (o.market === "kr") checks.push(auditCheck(o.audit));
    const count = (s) => checks.filter((c) => c.status === s).length;
    return {
      fy: pk.t.fy,
      prevFy: pk.p1 ? pk.p1.fy : null,
      financial: isFinancial(file),
      model: modelInfo,
      piotroski: f,
      checks,
      pass: count("pass"),
      fail: count("fail"),
      of: count("pass") + count("fail"),
      missing: count("missing"),
      na: count("na"),
    };
  }

  // 스크리너 집계용 한 줄(build_risk_check.mjs). null = 판정 불가.
  function compactRow(res) {
    if (!res) return null;
    const by = Object.fromEntries(res.checks.map((c) => [c.key, c]));
    const r3 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
    return {
      fy: res.fy,
      f: res.piotroski.of >= F_MIN_EVALUATED ? res.piotroski.pass : null,
      fOf: res.piotroski.of,
      z: by.altman && by.altman.z !== undefined ? r3(by.altman.z) : null,
      m: by.beneish && by.beneish.m !== undefined ? r3(by.beneish.m) : null,
      pass: res.pass,
      fail: res.fail,
      of: res.of,
    };
  }

  const api = {
    THRESHOLDS: { F_WARN_FRACTION, F_MIN_EVALUATED, DILUTION_1Y, DILUTION_3Y, COVERAGE_MIN, LEVERAGE_JUMP_PP, M_THRESHOLD, Z_ZONES },
    M_DEFS,
    num,
    pickAnnual,
    isFinancial,
    grossMargin,
    piotroski,
    altmanModelFor,
    altmanZ,
    beneishVars,
    mScoreFromVars,
    beneishM,
    dilutionCheck,
    interestCoverageCheck,
    earningsQualityCheck,
    leverageJumpCheck,
    auditCheck,
    evaluate,
    compactRow,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirRiskCheckCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
