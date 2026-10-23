// 증권사 의견·목표가 변경 사후 성적표 — 순수 계산 모듈(DOM 없음). 점수·순위를 만들지 않고 빌더가 낸 사실 통계를 표 행으로 편다.
// 브라우저 window.MirBrokerScoreCore · node 테스트(scripts/tests/test_broker_scorecard_core.mjs) module.exports.
// 데이터: window.BROKER_SCORECARD(scripts/build_broker_scorecard.py — US data/broker_scorecard.js · KR data/korea/broker_scorecard.js)
//   firms: [{ f: 증권사, k: { 종류: [전체 건수, h20, h60] } }], hN = [표본 n, 평균%, 중앙값%, 플러스 비율%] 또는 [n](표본 부족)
(function (root) {
  "use strict";

  const KIND_LABEL = { up: "의견 상향", down: "의견 하향", ptUp: "목표가 상향", ptDown: "목표가 하향" };
  const SORT_KEYS = ["firm", "n", "avg0", "pos0", "avg1", "pos1"];

  function cell(arr) {
    if (!Array.isArray(arr) || !Number.isFinite(Number(arr[0]))) return { n: 0, ok: false };
    const n = Number(arr[0]);
    if (arr.length < 4) return { n, ok: false };
    return { n, ok: true, avg: Number(arr[1]), med: Number(arr[2]), pos: Number(arr[3]) };
  }

  function kinds(payload) {
    const ks = payload && Array.isArray(payload.kinds) ? payload.kinds : [];
    return ks.filter((k) => KIND_LABEL[k]);
  }

  // 종류 하나의 행: [{ firm, total, h: [cell, cell] }] — 그 종류 이벤트가 있는 증권사만.
  function rows(payload, kind) {
    const firms = payload && Array.isArray(payload.firms) ? payload.firms : [];
    const out = [];
    firms.forEach((f) => {
      const v = f && f.k && f.k[kind];
      if (!Array.isArray(v) || !(Number(v[0]) > 0)) return;
      out.push({ firm: String(f.f || ""), total: Number(v[0]), h: [cell(v[1]), cell(v[2])] });
    });
    return out;
  }

  function counts(payload) {
    const out = {};
    kinds(payload).forEach((k) => { out[k] = rows(payload, k).length; });
    return out;
  }

  // 표본 부족 칸은 방향과 관계없이 맨 뒤. 이름은 가나다·알파벳순.
  function sortRows(list, key, dir) {
    const k = SORT_KEYS.includes(key) ? key : "n";
    const d = dir === 1 ? 1 : -1;
    const val = (r) => {
      if (k === "firm") return r.firm;
      if (k === "n") return r.total;
      const c = r.h[k.endsWith("1") ? 1 : 0];
      if (!c.ok) return null;
      return k.startsWith("avg") ? c.avg : c.pos;
    };
    return list.slice().sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null && vb === null) return a.firm.localeCompare(b.firm);
      if (va === null) return 1;
      if (vb === null) return -1;
      if (k === "firm") return d * String(va).localeCompare(String(vb));
      return d * (va - vb) || a.firm.localeCompare(b.firm);
    });
  }

  function fmtSigned(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%p`;
  }

  function shortText(c) {
    return `표본 부족 (${c.n})`;
  }

  const api = { KIND_LABEL, SORT_KEYS, cell, kinds, rows, counts, sortRows, fmtSigned, shortText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirBrokerScoreCore = api;
})(typeof window !== "undefined" ? window : null);
