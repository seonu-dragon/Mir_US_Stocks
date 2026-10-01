// 업데이트 소식(체인지로그) — 순수 계산 모듈(DOM·저장소 없음).
// 브라우저에서는 window.MirChangelogCore, node 테스트(scripts/tests/test_changelog_core.mjs)에서는 module.exports.
// 데이터: window.MIR_CHANGELOG(data/changelog.js, 손으로 쓰는 파일 — 빌더 없음)
//   { updatedAt, entries: [{ id, date:"YYYY-MM-DD", title, desc, link, targets:[화면 id…], market:"us"|"kr"|"all", pr? }] }
// 화면(changelog.js)은 이 모듈로 ① 안 읽은 소식 수(헤더 점) ② 지금 보이는 화면에 띄울 '새 기능' 카드를 고른다.
(function (root) {
  "use strict";

  const MARKETS = ["us", "kr", "all"];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ID_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;

  /** 상대 URL 만 허용: 스킴(javascript: 등)·프로토콜 상대(//)·역슬래시는 거부. */
  function isSafeLink(href) {
    const s = String(href == null ? "" : href).trim();
    if (!s) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return false;
    if (s.startsWith("//") || s.includes("\\")) return false;
    return /^(\?|\.\/|[A-Za-z0-9_-]+\.html)/.test(s);
  }

  /** 항목 하나를 정리한다. 필수 값이 틀리면 null(화면에 안 띄운다). */
  function normalizeEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const date = String(raw.date || "").trim();
    const title = String(raw.title || "").trim();
    if (!ID_RE.test(id) || !DATE_RE.test(date) || !title) return null;
    const market = MARKETS.includes(raw.market) ? raw.market : "all";
    const link = isSafeLink(raw.link) ? String(raw.link).trim() : "";
    const targets = Array.isArray(raw.targets)
      ? raw.targets.map((t) => String(t || "").trim()).filter((t) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(t))
      : [];
    // focus: '해보기'를 눌렀을 때 같은 화면에서 내려갈 요소 — 요소 id, 또는 '.클래스'(동적으로 그려지는 카드).
    const focus = Array.isArray(raw.focus)
      ? raw.focus.map((t) => String(t || "").trim()).filter((t) => /^\.?[A-Za-z][A-Za-z0-9_-]*$/.test(t))
      : [];
    return {
      id, date, title,
      desc: String(raw.desc || "").trim(),
      link, targets: [...new Set(targets)], focus: [...new Set(focus)], market,
      pr: Number.isInteger(raw.pr) ? raw.pr : null,
    };
  }

  /** 최신순(날짜 내림차순, 같은 날은 파일 순서) + id 중복 제거(앞의 것). */
  function normalizeEntries(payload) {
    const list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.entries) ? payload.entries : []);
    const seen = new Set();
    const out = [];
    list.forEach((raw, i) => {
      const e = normalizeEntry(raw);
      if (!e || seen.has(e.id)) return;
      seen.add(e.id);
      out.push({ e, i });
    });
    out.sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : (a.e.date < b.e.date ? 1 : -1)));
    return out.map((x) => x.e);
  }

  function dayNumber(iso) {
    if (!DATE_RE.test(String(iso || ""))) return NaN;
    const [y, m, d] = String(iso).split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  }

  /** today 기준 며칠 지났나(미래면 음수). */
  function ageDays(entryDate, today) {
    return dayNumber(today) - dayNumber(entryDate);
  }

  function matchesMarket(entry, market) {
    if (!entry) return false;
    if (!market || entry.market === "all") return true;
    return entry.market === market;
  }

  /**
   * 안 읽은 소식. seen = { id, date } (마지막으로 목록을 열었을 때의 최신 항목) 또는 null.
   * - seen.id 가 목록에 있으면 그보다 위(새) 항목들.
   * - 목록에서 빠진 id 면 seen.date 보다 늦은 날짜 항목들.
   * - 처음 온 사람(seen 없음)은 newWindowDays 안의 항목만 — 몇 달 지난 소식으로 점을 계속 켜지 않는다.
   */
  function unreadEntries(entries, seen, { today = "", newWindowDays = 14 } = {}) {
    const list = Array.isArray(entries) ? entries : [];
    if (seen && seen.id) {
      const idx = list.findIndex((e) => e.id === seen.id);
      if (idx >= 0) return list.slice(0, idx);
      if (seen.date && DATE_RE.test(seen.date)) return list.filter((e) => e.date > seen.date);
      return [];
    }
    if (!today) return list.slice();
    return list.filter((e) => {
      const age = ageDays(e.date, today);
      return Number.isFinite(age) && age <= newWindowDays;
    });
  }

  /** 목록을 연 뒤 저장할 '본 위치'. */
  function seenMarker(entries) {
    const top = Array.isArray(entries) && entries[0];
    return top ? { id: top.id, date: top.date } : null;
  }

  /**
   * 지금 보이는 화면들(visibleTargets)에 띄울 '새 기능' 카드 — 화면마다 최대 1장, 같은 항목은 한 화면에만.
   * 제외: 다른 시장 항목, 닫은 항목(dismissed), 노출 상한을 넘긴 항목(impressions[id] >= maxImpressions,
   * 단 지금 이미 떠 있는 항목(showing)은 이번 페이지에서 유지), maxAgeDays 보다 오래된 항목, 미래 날짜.
   * 반환: [{ target, entry }] — visibleTargets 순서.
   */
  function pickInlineCards(entries, {
    visibleTargets = [], market = "", dismissed = [], impressions = {}, showing = [],
    today = "", maxAgeDays = 45, maxImpressions = 3,
  } = {}) {
    const list = Array.isArray(entries) ? entries : [];
    const gone = new Set(Array.isArray(dismissed) ? dismissed : []);
    const live = new Set(Array.isArray(showing) ? showing : []);
    const used = new Set();
    const out = [];
    const eligible = (e) => {
      if (!matchesMarket(e, market) || gone.has(e.id)) return false;
      if (today) {
        const age = ageDays(e.date, today);
        if (!Number.isFinite(age) || age < 0 || age > maxAgeDays) return false;
      }
      const seenCount = Number((impressions && impressions[e.id]) || 0);
      if (seenCount >= maxImpressions && !live.has(e.id)) return false;
      return true;
    };
    (Array.isArray(visibleTargets) ? visibleTargets : []).forEach((target) => {
      if (!target || out.some((x) => x.target === target)) return;
      const entry = list.find((e) => !used.has(e.id) && e.targets.includes(target) && eligible(e));
      if (!entry) return;
      used.add(entry.id);
      out.push({ target, entry });
    });
    return out;
  }

  /** 모든 항목이 가리키는 화면 id 합집합(화면 쪽이 '보이나' 검사할 대상). */
  function allTargets(entries) {
    const s = new Set();
    (Array.isArray(entries) ? entries : []).forEach((e) => (e.targets || []).forEach((t) => s.add(t)));
    return [...s];
  }

  /** 저장값 정리: 닫은 id 목록(최근 cap 개), 노출 수 맵(현재 항목만). */
  function pruneDismissed(list, entries, cap = 200) {
    const ids = new Set((Array.isArray(entries) ? entries : []).map((e) => e.id));
    const arr = (Array.isArray(list) ? list : []).filter((id) => typeof id === "string" && ids.has(id));
    return [...new Set(arr)].slice(-cap);
  }
  function pruneImpressions(map, entries) {
    const ids = new Set((Array.isArray(entries) ? entries : []).map((e) => e.id));
    const out = {};
    if (map && typeof map === "object") {
      Object.keys(map).forEach((k) => {
        const n = Number(map[k]);
        if (ids.has(k) && Number.isFinite(n) && n > 0) out[k] = Math.min(99, Math.floor(n));
      });
    }
    return out;
  }

  const MARKET_LABEL = { us: "미국", kr: "국내", all: "공통" };
  function marketLabel(m) { return MARKET_LABEL[m] || MARKET_LABEL.all; }

  /** '2026-09-27' → '2026.09.27' (목록 표기). */
  function fmtDate(iso) {
    return DATE_RE.test(String(iso || "")) ? String(iso).replace(/-/g, ".") : "";
  }

  const api = {
    isSafeLink, normalizeEntry, normalizeEntries, ageDays, matchesMarket,
    unreadEntries, seenMarker, pickInlineCards, allTargets,
    pruneDismissed, pruneImpressions, marketLabel, fmtDate,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirChangelogCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
