// SEC 공시 요약 표시 — 순수 계산 모듈(DOM 없음). 8-K 3줄 요약 + Form 144 매도 예정 신고.
// 브라우저에서는 window.MirSecFilings, node 테스트(scripts/tests/test_sec_filings_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 자료: MATERIAL_EVENTS.events[].summary(규칙 요약) · .aiSummary(AI 요약, 숫자 원문 대조 통과분)
//       FORM144_FILINGS.filings[](예정 매도 + Form 4 짝짓기 결과 match)
// 쓰는 곳: disclosure-trackers.js(공시 › 8-K 피드 · 내부자 › Form 144), timeline-core.js(통합 타임라인).
// 새 외부 호출·LLM 없음. 빌더가 붙인 필드를 줄로 엮기만 한다.
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function str(v) {
    return typeof v === "string" ? v.trim() : "";
  }
  function isDate(d) {
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d);
  }
  function usdShort(v) {
    const n = num(v);
    if (n === null) return "";
    const a = Math.abs(n);
    if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }
  function sharesText(v) {
    const n = num(v);
    if (n === null) return "";
    return `${Math.round(n).toLocaleString("ko-KR")}주`;
  }

  // ── 8-K 3줄 요약 ──────────────────────────────────────────────────────────
  // → { src: "ai" | "rule" | "", label, lines: [..], item }
  //   AI 요약이 있으면 그것(검증 통과 줄만), 없으면 규칙 요약, 둘 다 없으면 lines 가 빈 배열
  //   (화면은 Item 제목 칩 + 원문 링크만 보여 준다).
  //   규칙 요약 줄: ① 무엇이(what) ② 누가(who) ③ 얼마·언제(amount · 사건일 date)
  function eightkLines(ev) {
    const e = ev || {};
    const ai = e.aiSummary;
    if (ai && Array.isArray(ai.lines)) {
      const lines = ai.lines.map(str).filter(Boolean).slice(0, 3);
      if (lines.length >= 2) return { src: "ai", label: "AI 요약", lines, item: "" };
    }
    const s = e.summary;
    if (s && typeof s === "object") {
      const third = [str(s.amount), isDate(s.date) ? `사건일 ${s.date.slice(0, 10)}` : ""].filter(Boolean).join(" · ");
      const lines = [str(s.what), str(s.who), third].filter(Boolean);
      if (lines.length) return { src: "rule", label: "규칙 요약", lines, item: str(s.item) };
    }
    return { src: "", label: "", lines: [], item: "" };
  }

  // 요약 출처 안내 한 줄(피드 머리말·타임라인 수집 범위용).
  const SUMMARY_NOTE = "규칙 요약은 8-K 본문에서 정해진 문형으로 날짜·금액·상대방·임원 이름을 뽑은 것(숫자·이름은 원문 표기 그대로), "
    + "AI 요약은 시총 상위 일부만 만들고 원문에 없는 숫자가 든 줄은 버린 것입니다. 틀릴 수 있으니 원문을 확인하세요.";

  // ── Form 144 ─────────────────────────────────────────────────────────────
  // 발행주식 대비 예정 매도 비율(%). 둘 중 하나라도 없으면 null.
  function form144Pct(row) {
    const s = num(row && row.shares);
    const o = num(row && row.sharesOutstanding);
    if (s === null || o === null || o <= 0) return null;
    return (s / o) * 100;
  }

  // Form 4 짝짓기 상태 → { key, label, detail }
  //   sold    : 신고 후 실제 매도 확인됨(Form 4 매도 N주, 첫 매도일)
  //   pending : 아직 확인 안 됨(Form 4 는 매도 후 2영업일 안에 나온다 · 이름 표기가 달라 못 찾을 수도)
  //   unknown : 판단 불가(내부자 데이터 범위 밖·없음)
  function form144Status(row) {
    const m = (row && row.match) || {};
    if (m.status === "sold") {
      const planned = num(row.shares);
      const sold = num(m.soldShares);
      const pct = planned && sold !== null ? ` (예정의 ${Math.round((sold / planned) * 100)}%)` : "";
      return {
        key: "sold",
        label: "실제 매도 확인됨",
        detail: [sold !== null ? `Form 4 매도 ${sharesText(sold)}${pct}` : "", isDate(m.firstSaleDate) ? `첫 매도 ${m.firstSaleDate}` : ""].filter(Boolean).join(" · "),
      };
    }
    if (m.status === "pending") {
      return { key: "pending", label: "아직", detail: "같은 이름의 Form 4 매도를 아직 찾지 못함(매도 후 2영업일 안에 제출 · 명의가 다르면 못 찾음)" };
    }
    return { key: "unknown", label: "판단 불가", detail: "내부자 거래(Form 4) 수집 범위 밖" };
  }

  // 한 줄 요약(타임라인 detail 등): "Name(관계) · 예정 12,000주(0.01%) · 시가 $1.24M · 예정일 2026-09-25 · 브로커"
  function form144Line(row) {
    const r = row || {};
    const pct = form144Pct(r);
    const who = str(r.person) ? `${str(r.person)}${str(r.relation) ? `(${str(r.relation)})` : ""}` : "";
    const parts = [
      who,
      num(r.shares) !== null ? `예정 ${sharesText(r.shares)}${pct !== null ? `(발행주식의 ${pct < 0.01 ? "<0.01" : pct.toFixed(2)}%)` : ""}` : "",
      num(r.marketValue) !== null ? `시가 ${usdShort(r.marketValue)}` : "",
      isDate(r.approxSaleDate) ? `예정일 ${r.approxSaleDate}` : "",
      str(r.broker),
    ];
    return parts.filter(Boolean).join(" · ");
  }

  // 목록 필터(상태·검색어). q 는 티커·회사·신고인·브로커 부분 일치.
  function filterForm144(rows, status, q) {
    const list = Array.isArray(rows) ? rows : [];
    const needle = String(q || "").trim().toLowerCase();
    return list.filter((r) => {
      if (!r) return false;
      if (status && status !== "all" && form144Status(r).key !== status) return false;
      if (!needle) return true;
      return [r.ticker, r.issuer, r.person, r.broker].some((x) => String(x || "").toLowerCase().includes(needle));
    });
  }

  function countForm144(rows) {
    const out = { all: 0, sold: 0, pending: 0, unknown: 0 };
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r) continue;
      out.all += 1;
      out[form144Status(r).key] += 1;
    }
    return out;
  }

  const api = {
    eightkLines,
    SUMMARY_NOTE,
    form144Pct,
    form144Status,
    form144Line,
    filterForm144,
    countForm144,
    usdShort,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirSecFilings = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
