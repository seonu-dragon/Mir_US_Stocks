// mobile-cards.js — 폰(≤640px)에서 목록형 넓은 표를 '두 줄 카드'로 보이게 하는 표시 도우미.
// ====================================================================================
// 공시 피드(8-K·내부자·자사주·배당·수주·증자·공매도·DART 등)와 보유 종목 표는 열이 5~8개라 폰에서
// 날짜·종목만 보이고 정작 내용(이벤트·유형·금액·손익)은 화면 밖으로 밀려 있었다(2026-09-27 모바일 점검).
// 여기서는 표를 다시 그리지 않고, 각 칸에 머리글 이름(data-label)과 역할 클래스만 붙인다.
//   · mc-key  : 줄 머리(날짜·종목·순위·삭제 버튼) — 라벨 없이 첫 줄에
//   · mc-wide : 긴 글(이벤트·보고자·제목) — 한 줄을 통째로
//   · 나머지  : "라벨 값" 쌍으로 이어 붙임
// 카드 모양은 styles.css 의 '모바일 B' 블록(@media max-width:640px, table.mcard)이 맡는다 — 데스크톱은 표 그대로.
// 표를 그리는 렌더러는 innerHTML 로 통째 바꾸므로, 컨테이너를 지켜보다가 새 표에 다시 붙인다.
// 클래식 스크립트(전역 공유) — 이름은 mcard 접두사.

const MCARD_HOSTS = [
  "eventsTable", "insiderTable", "activistTable", "ipoTable",
  "buybackTable", "earnReactTable", "dividendTable", "contractTable", "dilutionTable", "shortTable",
  // pfTable 은 2026-10-03 부터 모바일에서도 표 그대로(평가액·비중 열만 숨김) — 카드로 바꾸면 행이 4배로 길어진다.
  "krOwnTable", "krDartTable", "bulkTable",
];
const MCARD_KEY_RE = /^(#|종목|티커|공시일|거래일|일자|날짜|발표일|신고일|상장일)$/;
const MCARD_WIDE_RE = /(이벤트|보고자|제목|내용|사유|회사명|보고서)/;

function mcardify(table) {
  if (!table || table.tagName !== "TABLE") return;
  const heads = [...table.querySelectorAll(":scope > thead > tr:last-child > th")].map((th) => th.textContent.replace(/\s+/g, " ").trim());
  if (heads.length < 3) return;
  table.classList.add("mcard");
  [...table.tBodies].forEach((tb) => {
    [...tb.rows].forEach((tr) => {
      // 안내 한 줄(colspan)짜리 행은 그대로
      if (tr.cells.length === 1) { tr.classList.add("mc-note"); return; }
      [...tr.cells].forEach((td, i) => {
        const label = heads[i] || "";
        td.classList.remove("mc-key", "mc-wide");
        if (!label || MCARD_KEY_RE.test(label)) { td.classList.add("mc-key"); td.removeAttribute("data-label"); return; }
        td.setAttribute("data-label", label);
        if (MCARD_WIDE_RE.test(label)) td.classList.add("mc-wide");
      });
    });
  });
}

function mcardScan(host) {
  // tbody 가 컨테이너인 경우(#bulkTable = 관심 리스트)는 그 표 하나만
  if (host.tagName === "TBODY" || host.tagName === "TABLE") { mcardify(host.closest("table")); return; }
  host.querySelectorAll("table").forEach(mcardify);
}

function setupMobileCards() {
  MCARD_HOSTS.forEach((id) => {
    const host = document.getElementById(id);
    if (!host) return;
    const target = host;
    mcardScan(target);
    if (typeof MutationObserver !== "function") return;
    let raf = 0;
    new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; mcardScan(target); });
    }).observe(target, { childList: true, subtree: true });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupMobileCards);
else setupMobileCards();
