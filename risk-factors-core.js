// risk-factors-core.js — 10-K 위험요인(Item 1A) 전년 대비 변화 카드의 순수 계산. DOM·네트워크 없음.
// 화면: risk-factors.js(종목 분석 › 이벤트·공시 탭 #riskFactorsSection). 데이터: scripts/build_risk_factor_changes.py
// (SEC EDGAR 10-K Item 1A · 20-F Item 3.D 원문 비교, LLM 없음). node 테스트: scripts/tests/test_risk_factors_core.mjs
//
// 정의(화면 각주·툴팁과 같은 문장 — 바꾸면 risk-factors.js 도 같이)
//   유사도 = 두 해 위험요인 구간의 단어 빈도 코사인(숫자·연도 제외, Cohen·Malloy·Nguyen "Lazy Prices" 의 Sim_Cosine).
//            1 이면 단어 구성이 같다. 화면은 ×100 한 %로 보여 준다.
//   변화 크기 백분위(pct) = 인덱스의 다른 종목 가운데 유사도가 이 종목보다 높은(= 덜 바뀐) 비율(동점 절반).
//            90 이면 '비교 가능한 종목의 90%보다 많이 바뀌었다'. 빌더가 매 실행 전 종목으로 다시 센다.
//   문단 대응: 가장 닮은 전년 문단과의 difflib 비율 ≥0.9 그대로 · 0.5~0.9 수정(0.75 미만은 '크게 바뀐') · <0.5 새 문단.
//            전년 문단 중 올해 어느 문단과도 0.5 미만이면 삭제 문단.
//   분량 = 비교에 쓴 단어 수(8단어 미만 문단 제외) 전년 대비.
// 변화의 크기는 사실 정보일 뿐 예측·매매 신호가 아니다(논문의 결과를 이 사이트가 검증한 것도 아니다).
(function (root) {
  "use strict";

  const PAPER_URL = "https://www.nber.org/papers/w25084";
  const PAPER_LABEL = "Cohen·Malloy·Nguyen, \"Lazy Prices\" (NBER w25084)";

  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  // 인덱스 한 행(cols 순서의 배열) → 이름 붙은 객체. 없으면 null.
  function indexRow(index, ticker) {
    if (!index || !index.tickers || !Array.isArray(index.cols)) return null;
    const key = String(ticker || "").toUpperCase();
    const row = index.tickers[key];
    if (!Array.isArray(row)) return null;
    const out = {};
    index.cols.forEach((k, i) => { out[k] = row[i] === undefined ? null : row[i]; });
    return out;
  }

  // 추출 실패 기록(index.failed[T]) + 사유 문장. 없으면 null.
  function failureOf(index, ticker) {
    if (!index || !index.failed) return null;
    const f = index.failed[String(ticker || "").toUpperCase()];
    if (!f) return null;
    const text = (index.failText && index.failText[f.reason]) || "위험요인 구간을 비교하지 못했습니다";
    return Object.assign({}, f, { text });
  }

  function wordsChange(cur, prev) {
    const a = num(cur), b = num(prev);
    if (a === null || b === null || b <= 0) return null;
    return a / b - 1;
  }

  // 유사도(0~1) → "99.67%" (소수 둘째 자리 — 대부분 0.99 대라 한 자리로는 구분이 안 된다).
  function simText(cos) {
    const c = num(cos);
    return c === null ? "—" : `${(c * 100).toFixed(2)}%`;
  }

  function pctText(pct) {
    const p = num(pct);
    return p === null ? "—" : String(Math.round(p));
  }

  // 백분위 한 줄 설명. n = 인덱스 종목 수.
  function pctSentence(pct, n) {
    const p = num(pct);
    if (p === null || !(n > 1)) return "비교할 종목이 부족해 백분위를 내지 않았습니다.";
    return `비교 가능한 ${Number(n).toLocaleString()}종목 중 ${Math.round(p)}%보다 많이 바뀌었습니다(변화 크기 백분위 ${Math.round(p)}).`;
  }

  // 카드 첫 줄 문장(템플릿, LLM 없음).
  function headline(file) {
    if (!file || !file.counts) return "";
    const c = file.counts;
    const parts = [];
    parts.push(c.added ? `새 문단 ${c.added}개` : "새 문단 없음");
    parts.push(c.removed ? `삭제 ${c.removed}개` : "삭제 없음");
    if (c.big) parts.push(`크게 바뀐 문단 ${c.big}개`);
    const wc = wordsChange(file.cur && file.cur.words, file.prev && file.prev.words);
    const vol = wc === null ? "" : ` · 분량 ${wc > 0 ? "+" : ""}${(wc * 100).toFixed(1)}%`;
    const form = (file.cur && file.cur.form) || "10-K";
    return `전년 ${form} 대비 ${parts.join(" · ")}${vol}`;
  }

  // 변화 정도 한 단어(표시용 배지). 인덱스 백분위 기준 — 절대 기준이 아니다.
  function changeBand(pct) {
    const p = num(pct);
    if (p === null) return null;
    if (p >= 80) return { key: "high", label: "변화 큰 편" };
    if (p <= 20) return { key: "low", label: "변화 적은 편" };
    return { key: "mid", label: "보통" };
  }

  function extractNote(extract) {
    const e = extract || {};
    if (e.cur === "heading" || e.prev === "heading") {
      return "원문에 Item 1A 표지가 없어 'Risk Factors' 제목으로 구간을 찾았습니다(통합 연차보고서 형식) — 구간 경계가 조금 어긋날 수 있습니다.";
    }
    return "";
  }

  // 목록 항목 정리: 제목처럼 보이는 문단(h=1)을 앞에(빌더가 이미 정렬), 표시 개수 제한.
  function listView(items, limit) {
    const arr = Array.isArray(items) ? items.filter((x) => x && x.t) : [];
    const n = limit > 0 ? limit : arr.length;
    return { shown: arr.slice(0, n), rest: arr.slice(n), total: arr.length };
  }

  const api = {
    PAPER_URL, PAPER_LABEL, indexRow, failureOf, wordsChange, simText, pctText, pctSentence,
    headline, changeBand, extractNote, listView,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MirRiskFactorsCore = api;
})(typeof window !== "undefined" ? window : globalThis);
