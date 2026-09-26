// 가격 차트 이벤트 마커(실적·배당락·액면분할·주요 공시) — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirChartEvents, node 테스트(scripts/tests/test_chart_events_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 흐름: collectEvents(원자료) → mapEventsToBars(봉 날짜) → clusterMarkers(화면 x) → hitCluster(포인터)
// - 이벤트 날짜가 휴장일이면 그 다음 첫 거래일 봉에 붙인다(주봉·월봉은 봉 날짜가 구간 마지막 날이라
//   같은 규칙으로 해당 주·월 봉에 붙는다).
// - 첫 봉보다 이르거나 마지막 봉보다 늦은 이벤트는 버린다(보이는 구간 밖).
(function (root) {
  "use strict";

  const KINDS = ["E", "D", "S", "F"];
  const KIND_LABEL = { E: "실적 발표", D: "배당락", S: "액면분할", F: "주요 공시" };
  const KIND_SYMBOL = { E: "E", D: "D", S: "S", F: "공" };

  // 국내 공시 중 차트에 올릴 '주요' 유형(kr_disclosures typeLabel). 지분 변동 보고·정기 서류·
  // 증권 발행 서류처럼 날마다 쌓이는 것은 뺀다 — 마커가 공시 목록이 되지 않게.
  const KR_MAJOR_TYPES = new Set([
    "공급계약", "증자·사채", "최대주주 변동", "주요사항보고", "소송·판결", "거래정지",
    "주요경영사항", "타법인 지분취득", "풍문·보도 해명", "주식소각", "자기주식", "자기주식 신탁",
    "주식병합", "배당", "조회공시 요구", "제재·벌금", "감사보고서",
  ]);

  function isDate(d) {
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d);
  }
  function day(d) {
    return String(d).slice(0, 10);
  }
  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function trimNum(x) {
    return Number.isInteger(x) ? String(x) : String(Number(x.toFixed(4)));
  }

  // 원화 큰 금액 → "79.1조" / "6,685억". 1억 미만은 원 단위.
  function krwShort(v) {
    const n = num(v);
    if (n === null) return "";
    const a = Math.abs(n);
    if (a >= 1e12) return `${(n / 1e12).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
    if (a >= 1e8) return `${Math.round(n / 1e8).toLocaleString("ko-KR")}억`;
    return `${Math.round(n).toLocaleString("ko-KR")}원`;
  }

  function signedPct(p, dec) {
    const n = num(p);
    if (n === null) return "";
    return `${n > 0 ? "+" : ""}${n.toFixed(dec == null ? 1 : dec)}%`;
  }

  // 원자료 → [{date, kind, title, detail, link}] (날짜 오름차순, 같은 날·같은 내용 중복 제거)
  // src = { kr, ticker, earnings, dividends, splits, usFilings, krFilings }
  //   earnings  : detail.earningsHistory (US {date, epsActual, epsEstimate, surprisePct} · KR {date, label, revenue, operatingProfit})
  //   dividends : [[date, amount], ...]
  //   splits    : [[date, 분자, 분모], ...]
  //   usFilings : MATERIAL_EVENTS.events(8-K) — hot 인 것만
  //   krFilings : KR_DISCLOSURES.disclosures — KR_MAJOR_TYPES 만
  function collectEvents(src) {
    const s = src || {};
    const kr = Boolean(s.kr);
    const ticker = String(s.ticker || "").toUpperCase();
    const out = [];
    for (const e of Array.isArray(s.earnings) ? s.earnings : []) {
      if (!e || !isDate(e.date)) continue;
      let detail = "";
      if (kr) {
        const parts = [];
        const rev = krwShort(e.revenue);
        const op = krwShort(e.operatingProfit);
        if (rev) parts.push(`매출 ${rev}`);
        if (op) parts.push(`영업이익 ${op}`);
        detail = parts.join(" · ");
        out.push({ date: day(e.date), kind: "E", title: e.label ? `실적 공시 · ${e.label}` : "실적 공시", detail, link: "" });
        continue;
      }
      const act = num(e.epsActual);
      const est = num(e.epsEstimate);
      if (act !== null) {
        detail = `EPS ${act.toFixed(2)}`;
        if (est !== null) detail += ` (예상 ${est.toFixed(2)}${num(e.surprisePct) !== null ? `, 차이 ${signedPct(e.surprisePct)}` : ""})`;
      }
      out.push({ date: day(e.date), kind: "E", title: "실적 발표", detail, link: "" });
    }
    for (const d of Array.isArray(s.dividends) ? s.dividends : []) {
      const dt = d && d[0];
      const amt = num(d && d[1]);
      if (!isDate(dt) || amt === null || amt <= 0) continue;
      const detail = kr
        ? `주당 ${amt.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`
        : `주당 $${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
      out.push({ date: day(dt), kind: "D", title: "배당락", detail, link: "" });
    }
    for (const sp of Array.isArray(s.splits) ? s.splits : []) {
      const dt = sp && sp[0];
      const a = num(sp && sp[1]);
      const b = num(sp && sp[2]);
      if (!isDate(dt) || !(a > 0) || !(b > 0) || a === b) continue;
      out.push({ date: day(dt), kind: "S", title: a > b ? "액면분할" : "주식병합", detail: `${trimNum(a)}:${trimNum(b)}`, link: "" });
    }
    for (const f of Array.isArray(s.usFilings) ? s.usFilings : []) {
      if (!f || !f.hot || !isDate(f.fileDate)) continue;
      if (ticker && String(f.ticker || "").toUpperCase() !== ticker) continue;
      const labels = (Array.isArray(f.items) ? f.items : [])
        .filter((it) => it && it.code !== "9.01") // 9.01(첨부 서류)은 내용이 아니다
        .map((it) => it.label).filter(Boolean);
      out.push({ date: day(f.fileDate), kind: "F", title: "8-K 공시", detail: labels.join(" · "), link: f.link || "" });
    }
    for (const f of Array.isArray(s.krFilings) ? s.krFilings : []) {
      if (!f || !isDate(f.fileDate) || !KR_MAJOR_TYPES.has(f.typeLabel)) continue;
      if (ticker && String(f.ticker || "").toUpperCase() !== ticker) continue;
      out.push({ date: day(f.fileDate), kind: "F", title: f.typeLabel, detail: f.title || "", link: f.link || "" });
    }
    const seen = new Set();
    const uniq = [];
    for (const e of out) {
      const key = `${e.date}|${e.kind}|${e.title}|${e.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(e);
    }
    const order = { E: 0, D: 1, S: 2, F: 3 };
    return uniq.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : order[x.kind] - order[y.kind]));
  }

  // 봉 날짜 배열(오름차순 'YYYY-MM-DD') 에서 date 이상인 첫 봉 인덱스. 없으면 -1.
  function barIndexForDate(barDates, date) {
    const n = barDates ? barDates.length : 0;
    if (!n || !isDate(date)) return -1;
    const d = day(date);
    if (d > day(barDates[n - 1])) return -1;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (day(barDates[mid]) >= d) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  // 이벤트 → 보이는 봉 인덱스. allDates = 전체 봉 날짜, start/count = 보이는 구간(allDates 기준).
  // 전체 첫 봉보다 이른 이벤트는 그 앞 구간을 모르므로 버린다. 켜진 종류(enabled)만.
  function mapEventsToBars(events, allDates, start, count, enabled) {
    const out = [];
    const n = allDates ? allDates.length : 0;
    if (!n) return out;
    const first = day(allDates[0]);
    const s0 = Math.max(0, start | 0);
    const s1 = s0 + Math.max(0, count | 0);
    for (const e of Array.isArray(events) ? events : []) {
      if (!e || (enabled && enabled[e.kind] === false)) continue;
      if (day(e.date) < first) continue;
      const i = barIndexForDate(allDates, e.date);
      if (i < s0 || i >= s1) continue;
      out.push({ ...e, idx: i - s0 });
    }
    return out;
  }

  // 화면 x 가 minGap 보다 가까운 마커를 한 묶음으로. 묶음의 x 는 첫·마지막 마커의 가운데.
  // xFor(idx) 는 차트의 봉 x 함수(가로 줌·이동과 같은 좌표). 결과는 x 오름차순.
  function clusterMarkers(mapped, xFor, minGap) {
    const gap = Number.isFinite(minGap) && minGap > 0 ? minGap : 14;
    const pts = (Array.isArray(mapped) ? mapped : [])
      .map((e) => ({ e, x: xFor(e.idx) }))
      .filter((p) => Number.isFinite(p.x))
      .sort((a, b) => a.x - b.x);
    const clusters = [];
    let cur = null;
    for (const p of pts) {
      if (cur && p.x - cur.x0 < gap) {
        cur.items.push(p.e);
        cur.x1 = p.x;
      } else {
        cur = { x0: p.x, x1: p.x, items: [p.e] };
        clusters.push(cur);
      }
    }
    return clusters.map((c) => {
      const kinds = KINDS.filter((k) => c.items.some((e) => e.kind === k));
      const count = c.items.length;
      return {
        x: (c.x0 + c.x1) / 2,
        items: c.items,
        kinds,
        count,
        kind: kinds.length === 1 ? kinds[0] : "mixed",
        label: count === 1 ? KIND_SYMBOL[c.items[0].kind] : String(count),
      };
    });
  }

  // 포인터(viewBox 좌표)가 닿은 묶음. 마커 줄(yCenter ± rY) 안에서 가장 가까운 x (반경 rX 이내).
  function hitCluster(clusters, px, py, yCenter, rX, rY) {
    if (!Array.isArray(clusters) || !clusters.length) return null;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    if (Math.abs(py - yCenter) > (rY || 10)) return null;
    let best = null;
    let bestD = Infinity;
    for (const c of clusters) {
      const d = Math.abs(c.x - px);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best && bestD <= (rX || 9) ? best : null;
  }

  // 공시 수집 기간(마커 안내 문구용). 목록의 fileDate 최소·최대.
  function filingWindow(list) {
    let lo = "";
    let hi = "";
    for (const f of Array.isArray(list) ? list : []) {
      const d = f && f.fileDate;
      if (!isDate(d)) continue;
      const x = day(d);
      if (!lo || x < lo) lo = x;
      if (!hi || x > hi) hi = x;
    }
    return lo ? { from: lo, to: hi } : null;
  }

  function normalizeEnabled(raw) {
    const out = {};
    for (const k of KINDS) out[k] = !(raw && raw[k] === false);
    return out;
  }

  const api = {
    KINDS,
    KIND_LABEL,
    KIND_SYMBOL,
    KR_MAJOR_TYPES,
    krwShort,
    collectEvents,
    barIndexForDate,
    mapEventsToBars,
    clusterMarkers,
    hitCluster,
    filingWindow,
    normalizeEnabled,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirChartEvents = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
