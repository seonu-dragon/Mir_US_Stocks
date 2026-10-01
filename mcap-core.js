// 재무 차트 시가총액 겹쳐 보기 — 순수 계산 모듈(DOM 없음).
// 브라우저 window.MirMcapCore, node 테스트(scripts/tests/test_mcap_core.mjs)는 module.exports.
//
// 시가총액(기말) = 기말(그 날 또는 직전 거래일) 종가 × 기말 주식수.
//   - 종가는 종목 상세 chartSeries(US 야후 · KR 네이버/야후, 분할·무상증자 조정 종가, 배당 미반영 · 약 5년).
//   - 주식수는 재무 확장 파일(scripts/financials_common.py) 의 기말 발행주식수(sharesOut, KR 은 자기주식 제외
//     유통주식수) — 그 기말 값이 없으면 같은 기말의 희석 가중평균(sharesDilAvg).
//
// 액면분할: 종가는 분할 조정돼 있는데 공시 주식수는 공시 당시 기준이고, 한 행 안에서도 필드마다 기준이 다를 수
// 있다(NVDA FY2023: 기말 발행 2.47B 는 분할 전, 희석 평균 25.1B 는 재표시). 그래서 scripts/build_us_valuation_band.py
// 의 normalize_shares 와 같은 규칙으로 주식수를 '현재 기준'으로 환산한다:
//   최근 → 과거로 관측치를 이어 가며 직전(더 최근) 환산값 대비 비율이 표준 분할 비율(1.5·2·3·4·5·10… 또는 역수)
//   에 12% 안으로 맞고 같은 구간 자본총계가 그만큼 변하지 않았을 때만 분할로 보고 배율을 곱한다(유상증자·합병은
//   자본도 같이 늘어난다). 맨 앞 기준(anchor)은 지금 주식수(스냅샷 시가총액 ÷ 현재가, KR 은 상장주식수)라
//   마지막 공시 뒤 분할(000500 2026-06 무상증자 1.8배)도 잡는다. anchor 와 최근 공시가 분할 비율로도 맞지 않으면
//   (복수 종류주·ADR 등) 시가총액을 만들지 않고 '수정주가'만 그린다(mode "price").
// 종가 이력에 하루 2.5배 넘는 급변이 있으면 분할이 소급 조정되지 않은 이력일 수 있어 아무것도 그리지 않는다.
// 결측(그 기말 종가가 없거나 주식수 관측치가 버려진 기간)은 건너뛴다 — 추정해서 채우지 않는다.
(function (root) {
  "use strict";

  const SINGLE = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100];
  const SPLIT_RATIOS = Array.from(new Set(SINGLE.concat(SINGLE.map((k) => 1 / k)))).sort((a, b) => a - b);
  const SPLIT_TOL = 0.12;
  const ANCHOR_TOL = 0.30;
  const CLOSE_MAX_GAP_DAYS = 7;   // 기말이 휴장일이면 직전 거래일 종가(최대 7일 전까지)

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  function dayNum(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    if (!m) return null;
    return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
  }

  function nearestSplitRatio(r) {
    if (!(r > 0) || !Number.isFinite(r)) return null;
    let best = null, bestErr = SPLIT_TOL;
    SPLIT_RATIOS.forEach((k) => {
      const err = Math.abs(r / k - 1);
      if (err <= bestErr) { best = k; bestErr = err; }
    });
    return best;
  }

  // 기말 날짜. US 는 행의 end, KR(DART) 은 end 가 없어 12월 결산을 가정한다(분기 = 3·6·9·12월 말).
  function periodEnd(row, kind) {
    if (!row) return null;
    if (row.end) return String(row.end).slice(0, 10);
    const fy = Number(row.fy);
    if (!Number.isFinite(fy)) return null;
    if (kind === "quarterly") {
      const fq = Number(row.fq);
      if (!(fq >= 1 && fq <= 4)) return null;
      const mm = fq * 3;
      const dd = mm === 6 || mm === 9 ? 30 : 31;
      return `${fy}-${String(mm).padStart(2, "0")}-${dd}`;
    }
    return `${fy}-12-31`;
  }

  function endIsAssumed(file) {
    return !!file && [].concat(file.annual || [], file.quarterly || []).some((r) => r && !r.end);
  }

  // 주식수 관측치 [{end, day, v, kind: "out"|"dil"}] — 연간·분기 모두.
  function shareObservations(file) {
    const obs = [];
    [["annual", file && file.annual], ["quarterly", file && file.quarterly]].forEach(([kind, rows]) => {
      (rows || []).forEach((r) => {
        const end = periodEnd(r, kind);
        const day = dayNum(end);
        if (day === null) return;
        [["out", "sharesOut"], ["dil", "sharesDilAvg"]].forEach(([k, key]) => {
          const v = num(r[key]);
          if (v && v > 0) obs.push({ end, day, v, kind: k });
        });
      });
    });
    // 같은 기말·같은 종류·같은 값은 하나로(연간 행과 4분기 행이 같은 기말 주식수를 실을 때).
    const seen = new Set();
    return obs.filter((o) => {
      const key = `${o.day}|${o.kind}|${o.v}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function equityPoints(file) {
    const out = [];
    [["annual", file && file.annual], ["quarterly", file && file.quarterly]].forEach(([kind, rows]) => {
      (rows || []).forEach((r) => {
        const day = dayNum(periodEnd(r, kind));
        const eq = num(r.equity);
        if (day !== null && eq !== null) out.push({ day, v: eq });
      });
    });
    return out;
  }

  function equityNear(pts, day) {
    let best = null, bestD = 21;
    pts.forEach((p) => {
      const d = Math.abs(p.day - day);
      if (d < bestD) { best = p.v; bestD = d; }
    });
    return best;
  }

  // 상세 파일 splits([[날짜, 분자, 분모], …] — 야후 events.splits, 키가 있으면 수집 범위 안 전부) → [{day, f}].
  // 키가 없으면 null(모름). 4:1 분할이면 f = 4(주식수 배율), 1:10 병합이면 0.1.
  function knownSplits(raw) {
    if (!Array.isArray(raw)) return null;
    const out = [];
    raw.forEach((e) => {
      if (!Array.isArray(e)) return;
      const day = dayNum(e[0]);
      const a = Number(e[1]), b = Number(e[2]);
      if (day !== null && a > 0 && b > 0 && a !== b) out.push({ day, f: a / b, date: String(e[0]).slice(0, 10) });
    });
    return out.sort((x, y) => x.day - y.day);
  }

  // 알려진 분할 목록이 있을 때: 관측치(기말 day) 뒤의 분할 중 '공시 시점 이후' 것만 남은 배율이 된다 —
  // 공시가 늦게 나와 일부 분할이 이미 재표시됐을 수 있으니 뒤쪽 분할의 접미 곱(1, 마지막, 마지막×그 앞 …)이 후보.
  function suffixFactors(splits, day) {
    const after = splits.filter((s) => s.day > day);
    const out = [1];
    let k = 1;
    for (let i = after.length - 1; i >= 0; i -= 1) { k *= after[i].f; out.push(k); }
    return out;
  }

  function closestFactor(cands, v, ref) {
    let best = null, bestErr = Infinity;
    cands.forEach((c) => {
      const err = Math.abs(Math.log(ref / (v * c)));
      if (err < bestErr) { best = c; bestErr = err; }
    });
    return { c: best, ratio: ref / (v * best) };
  }

  // 분할 목록을 아는 경우의 환산. 표준 비율로 추측하지 않는다(국내 무상증자는 1.8배처럼 비율이 제각각이라
  // 표준 비율 추측은 실제 유상증자를 분할로 오판한다 — 000500 2025년 유상증자 실측).
  function normalizeWithKnown(order, anchor, splits) {
    const latest = order.find((o) => o.kind === "out") || order[0];
    let refV;
    if (anchor && anchor > 0) {
      const { c, ratio } = closestFactor(suffixFactors(splits, latest.day), latest.v, anchor);
      if (Math.abs(ratio - 1) > ANCHOR_TOL) return { norm: [], splits: [], fail: "anchor" };
      refV = latest.v * c;
    } else {
      refV = latest.v * suffixFactors(splits, latest.day).slice(-1)[0];
    }
    const norm = [];
    for (const o of order) {
      const { c, ratio } = closestFactor(suffixFactors(splits, o.day), o.v, refV);
      if (!(ratio >= 0.5 && ratio <= 2.0)) continue;   // 알려진 분할로도 정상 변동으로도 설명 안 됨 → 버림
      const n = o.v * c;
      norm.push(Object.assign({}, o, { n }));
      refV = n;
    }
    return { norm, splits: splits.map((s) => [s.date, Math.round(s.f * 10000) / 10000]), fail: null };
  }

  // build_us_valuation_band.normalize_shares 의 JS 판. 반환 { norm:[{...o, n}], splits:[[end, K]], fail }.
  // known(분할 목록, knownSplits 결과)이 배열이면 그 목록만으로 환산한다(normalizeWithKnown).
  function normalizeShares(obs, eqPts, anchor, known) {
    if (!obs || !obs.length) return { norm: [], splits: [], fail: "noShares" };
    if (Array.isArray(known)) {
      const ord = obs.slice().sort((a, b) => (b.day - a.day) || ((b.kind === "out") - (a.kind === "out")));
      return normalizeWithKnown(ord, anchor, known);
    }
    const order = obs.slice().sort((a, b) => (b.day - a.day) || ((b.kind === "out") - (a.kind === "out")));
    const latest = order.find((o) => o.kind === "out") || order[0];
    let K = 1;
    if (anchor && anchor > 0) {
      const r = anchor / latest.v;
      if (Math.abs(r - 1) > ANCHOR_TOL) {
        const k = nearestSplitRatio(r);
        if (!k || k === 1) return { norm: [], splits: [], fail: "anchor" };
        K = k;   // 마지막 공시 뒤 분할
      }
    }
    const splits = K !== 1 ? [[latest.end, K]] : [];
    let refV = latest.v * K, refDay = latest.day;
    const norm = [];
    for (const o of order) {
      const r = refV / (o.v * K);
      if (!(r >= 0.75 && r <= 1.33)) {
        let j = nearestSplitRatio(r);
        if (j !== null) {
          const eqRef = equityNear(eqPts || [], refDay), eqObs = equityNear(eqPts || [], o.day);
          if (eqRef && eqObs && eqRef > 0 && eqObs > 0 && Math.abs(Math.log(eqRef / eqObs)) > 0.5 * Math.abs(Math.log(j))) {
            j = null;   // 자본도 같이 움직임 → 분할이 아니라 실제 발행·소각
          }
        }
        if (j === null) {
          if (!(r >= 0.5 && r <= 2.0)) continue;   // 분할로도 정상 변동으로도 설명 안 되는 관측치는 버린다
        } else {
          K *= j;
          if (o.kind === "out") splits.push([o.end, Math.round(K * 10000) / 10000]);
        }
      }
      const n = o.v * K;
      norm.push(Object.assign({}, o, { n }));
      refV = n; refDay = o.day;
    }
    return { norm, splits, fail: null };
  }

  // 일봉 [[o,h,l,c,v,date], …] 또는 [{c, date|d}] → [{day, date, c}] 오름차순.
  function closes(chartSeries) {
    const out = [];
    (chartSeries || []).forEach((b) => {
      let c, d;
      if (Array.isArray(b)) { c = Number(b[3]); d = b[5]; }
      else if (b && typeof b === "object") { c = Number(b.c != null ? b.c : b.close); d = b.date || b.d; }
      const day = dayNum(d);
      if (day !== null && Number.isFinite(c) && c > 0) out.push({ day, date: String(d).slice(0, 10), c });
    });
    out.sort((a, b) => a.day - b.day);
    return out;
  }

  // 하루 새 2.5배 넘게 뛰거나 0.4배 밑으로 빠진 봉 — 분할이 소급 조정되지 않은 이력일 수 있다.
  function priceJump(cl) {
    for (let i = 1; i < cl.length; i += 1) {
      const r = cl[i].c / cl[i - 1].c;
      if (r > 2.5 || r < 0.4) return cl[i].date;
    }
    return null;
  }

  function closeOnOrBefore(cl, day, maxGap) {
    let lo = 0, hi = cl.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cl[mid].day <= day) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (ans < 0) return null;
    if (day - cl[ans].day > (maxGap == null ? CLOSE_MAX_GAP_DAYS : maxGap)) return null;
    return cl[ans];
  }

  function periodKey(row) {
    return `${row.fy}|${row.fq || ""}`;
  }

  // 현재 기준 주식수. US: 스냅샷 시가총액(10억 달러) ÷ 현재가, KR: 상장주식수(없으면 시총(조) ÷ 현재가).
  function anchorShares(item, market) {
    if (!item) return null;
    const price = num(Number(item.price));
    if (market === "kr") {
      const ls = num(Number(item.listedShares));
      if (ls && ls > 0) return ls;
      const capT = num(Number(item.marketCapT != null ? item.marketCapT : item.marketCapB));
      return capT && price ? capT * 1e12 / price : null;
    }
    const capB = num(Number(item.marketCapB));
    if (capB && price) return capB * 1e9 / price;
    const f = item.fundamentals || {};
    const sb = num(Number(f.sharesB));
    return sb ? sb * 1e9 : null;
  }

  // 메인: 기간별 기말 시가총액(또는 수정주가). 반환
  //   { mode: "mcap"|"price"|null, reason, byKey: { "fy|fq": {end, closeDate, close, shares, sharesKind, mcap} },
  //     splits, firstPriceDate, endAssumed }
  // mode "price" 는 주식수 기준을 맞출 수 없을 때 — byKey 에 close 만 있다. null 이면 그릴 것이 없다.
  function overlaySeries(opts) {
    const o = opts || {};
    const file = o.file;
    const kind = o.kind === "quarterly" ? "quarterly" : "annual";
    const cl = closes(o.chartSeries);
    const out = { mode: null, reason: null, byKey: {}, splits: [], firstPriceDate: cl.length ? cl[0].date : null, endAssumed: endIsAssumed(file) };
    if (!file || !cl.length) { out.reason = "noPrice"; return out; }
    if (o.currencyMismatch) { out.reason = "currency"; return out; }
    const jump = priceJump(cl);
    if (jump) { out.reason = "priceJump"; out.jumpDate = jump; return out; }
    const rows = file[kind] || [];
    const firstDay = cl[0].day;
    const obs = shareObservations(file).filter((x) => x.day >= firstDay - 450);
    const ns = o.noShares ? { norm: [], splits: [], fail: "adr" } : normalizeShares(obs, equityPoints(file), num(o.anchor), knownSplits(o.splits));
    out.splitsKnown = Array.isArray(o.splits);
    out.splits = ns.splits;
    const byDay = {};
    ns.norm.forEach((x) => {
      const slot = byDay[x.day] || (byDay[x.day] = {});
      if (!slot[x.kind]) slot[x.kind] = x.n;
    });
    let priced = 0, capped = 0;
    rows.forEach((r) => {
      const end = periodEnd(r, kind);
      const day = dayNum(end);
      if (day === null || day < firstDay) return;
      const bar = closeOnOrBefore(cl, day);
      if (!bar) return;
      priced += 1;
      const slot = byDay[day] || {};
      const shares = slot.out || slot.dil || null;
      const pt = { end, closeDate: bar.date, close: bar.c, shares: null, sharesKind: null, mcap: null };
      if (!ns.fail && shares) {
        pt.shares = shares;
        pt.sharesKind = slot.out ? "out" : "dil";
        pt.mcap = bar.c * shares;
        capped += 1;
      }
      out.byKey[periodKey(r)] = pt;
    });
    if (!priced) { out.reason = "noOverlap"; return out; }
    if (ns.fail) { out.mode = "price"; out.reason = ns.fail; return out; }
    if (!capped) { out.mode = "price"; out.reason = "noShares"; return out; }
    // 종가가 있는 기간의 절반 넘게 주식수가 비면(국내 분기 — 주식수는 연말만 공시) 듬성한 선 대신 수정주가.
    if (capped * 2 < priced) { out.mode = "price"; out.reason = "sparseShares"; return out; }
    out.mode = "mcap";
    return out;
  }

  // 주주환원 카드(shareholder.js)가 쓰는 '현재 기준' 주식수 — overlaySeries 와 같은 관측치 범위·규칙.
  function normalizedFor(opts) {
    const o = opts || {};
    const cl = closes(o.chartSeries);
    const firstDay = cl.length ? cl[0].day : null;
    const obs = shareObservations(o.file).filter((x) => firstDay === null || x.day >= firstDay - 450);
    return normalizeShares(obs, equityPoints(o.file), num(o.anchor), knownSplits(o.splits));
  }

  const REASON_TEXT = {
    noPrice: "종가 이력이 아직 없습니다",
    noOverlap: "재무 기간과 겹치는 종가 이력(약 5년)이 없습니다",
    currency: "재무 보고 통화가 주가 통화와 달라 겹쳐 그리지 않습니다",
    priceJump: "종가 이력에 분할이 조정되지 않은 듯한 급변이 있어 겹쳐 그리지 않습니다",
    anchor: "공시 주식수와 지금 주식수의 기준이 맞지 않아(복수 종류주·ADR 등) 시가총액 대신 수정주가를 그렸습니다",
    adr: "ADR·해외발행인은 공시 주식수가 상장 주식 기준과 달라 시가총액 대신 수정주가를 그렸습니다",
    noShares: "기간별 주식수 공시가 없어 시가총액 대신 수정주가를 그렸습니다",
    sparseShares: "기간마다 주식수 공시가 있지 않아(국내 분기는 연말 주식수만) 시가총액 대신 수정주가를 그렸습니다",
  };

  const api = {
    SPLIT_RATIOS,
    nearestSplitRatio,
    periodEnd,
    shareObservations,
    equityPoints,
    normalizeShares,
    knownSplits,
    suffixFactors,
    closes,
    priceJump,
    closeOnOrBefore,
    periodKey,
    anchorShares,
    overlaySeries,
    normalizedFor,
    REASON_TEXT,
    dayNum,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirMcapCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
