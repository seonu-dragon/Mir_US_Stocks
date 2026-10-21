// 관심 리스트 표 — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirWatchCore, node 테스트(scripts/tests/test_watchlist_core.mjs)에서는 module.exports.
// 담는 것: 열 정렬(값 없는 행은 방향과 무관하게 맨 뒤)·정렬 토글 순환, 끌어 옮기기 재배열(화면에 안 보이는
// 티커의 자리는 그대로), 종목 메모({t, u} — 수정 시각으로 기기 간 병합, 빈 글은 삭제 표식),
// 클라우드 동기화 바디 상한(워커 32KB) 안에 메모를 최신순으로 채우기, 받은 리스트 정리.
(function (root) {
  "use strict";

  const NOTE_MAX = 200;
  const NOTE_TOMBSTONES_MAX = 100;
  const GROUPS_MAX = 12;
  const GROUP_TICKERS_MAX = 80;

  function isBlank(v) {
    return v == null || v === "" || (typeof v === "number" && !Number.isFinite(v));
  }

  /** rows 를 sort={key, dir: 1|-1} 로 정렬한 새 배열. 값 없는 행은 맨 뒤, 같은 값은 원래 순서(안정). */
  function sortRows(rows, sort, getValue) {
    const list = Array.isArray(rows) ? rows.slice() : [];
    if (!sort || !sort.key || typeof getValue !== "function") return list;
    const dir = sort.dir < 0 ? -1 : 1;
    const keyed = list.map((row, i) => ({ row, i, v: getValue(row, sort.key) }));
    keyed.sort((a, b) => {
      const ab = isBlank(a.v);
      const bb = isBlank(b.v);
      if (ab || bb) return ab === bb ? a.i - b.i : (ab ? 1 : -1);
      let c;
      if (typeof a.v === "number" && typeof b.v === "number") c = a.v - b.v;
      else c = String(a.v).localeCompare(String(b.v), "ko");
      return c ? c * dir : a.i - b.i;
    });
    return keyed.map((k) => k.row);
  }

  /** 머리글 클릭: 다른 열 → 그 열의 기본 방향, 같은 열 → 반대 방향 → 정렬 해제(내 순서). */
  function nextSort(cur, key, defaultDir) {
    const first = defaultDir < 0 ? -1 : 1;
    if (!cur || cur.key !== key) return { key, dir: first };
    if (cur.dir === first) return { key, dir: -first };
    return null;
  }

  /** list 의 from 번째를 to 번째로 옮긴 새 배열(범위 밖이면 그대로). */
  function moveItem(list, from, to) {
    const out = Array.isArray(list) ? list.slice() : [];
    if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
    const [x] = out.splice(from, 1);
    out.splice(to, 0, x);
    return out;
  }

  /**
   * 전체 목록 full 에서 화면에 보인 티커들(orderedVisible, 새 순서)만 그 자리들 안에서 다시 놓는다.
   * 스냅샷에 없어 표에 안 나온 티커는 원래 자리에 남는다(저장 목록을 갉아먹지 않게).
   */
  function reorderSubset(full, orderedVisible) {
    const base = Array.isArray(full) ? full.slice() : [];
    const vis = Array.isArray(orderedVisible) ? orderedVisible : [];
    const set = new Set(vis);
    const slots = [];
    base.forEach((t, i) => { if (set.has(t)) slots.push(i); });
    if (slots.length !== vis.length) return base;
    slots.forEach((slot, k) => { base[slot] = vis[k]; });
    return base;
  }

  function cleanNoteText(text) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  }

  /** 저장된 메모 표를 {TICKER: {t, u}} 로 정리(구형·깨진 항목은 버린다). */
  function normalizeNotes(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    Object.keys(raw).forEach((k) => {
      const key = String(k || "").trim().toUpperCase();
      const v = raw[k];
      if (!key || key.length > 24 || !v || typeof v !== "object") return;
      const u = Number(v.u);
      if (!Number.isFinite(u) || u <= 0) return;
      out[key] = { t: cleanNoteText(v.t), u };
    });
    return out;
  }

  /** 메모 하나를 쓴(빈 글이면 삭제 표식) 새 표. */
  function setNote(notes, ticker, text, now) {
    const out = { ...normalizeNotes(notes) };
    const key = String(ticker || "").trim().toUpperCase();
    if (!key) return out;
    const t = cleanNoteText(text);
    if (!t && !out[key]) return out;
    out[key] = { t, u: Number(now) || Date.now() };
    return pruneTombstones(out);
  }

  function pruneTombstones(notes) {
    const dead = Object.keys(notes).filter((k) => !notes[k].t).sort((a, b) => notes[b].u - notes[a].u);
    dead.slice(NOTE_TOMBSTONES_MAX).forEach((k) => { delete notes[k]; });
    return notes;
  }

  /** 두 기기의 메모 표 병합 — 종목마다 더 나중에 고친 쪽(삭제 표식 포함)이 이긴다. 없는 쪽은 지우지 않는다. */
  function mergeNotes(local, remote) {
    const a = normalizeNotes(local);
    const b = normalizeNotes(remote);
    const out = { ...a };
    Object.keys(b).forEach((k) => {
      if (!out[k] || b[k].u > out[k].u) out[k] = b[k];
    });
    return pruneTombstones(out);
  }

  /** 보이는 메모만 {TICKER: 글}. */
  function liveNotes(notes) {
    const n = normalizeNotes(notes);
    const out = {};
    Object.keys(n).forEach((k) => { if (n[k].t) out[k] = n[k].t; });
    return out;
  }

  function utf8Bytes(s) {
    const str = String(s);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str).length;
    return unescape(encodeURIComponent(str)).length; // 구형 환경 폴백
  }

  /**
   * 시장별 메모 표들({us, kr})을 budget 바이트 안에 들도록 최신 수정순으로 골라 담는다.
   * 다 못 담으면 오래된 것부터 빠진다 — 병합이 '없는 항목은 지우지 않음'이라 로컬 원본은 그대로다.
   */
  function fitNotes(byMarket, budget) {
    const entries = [];
    Object.keys(byMarket || {}).forEach((m) => {
      const n = normalizeNotes(byMarket[m]);
      Object.keys(n).forEach((k) => entries.push({ m, k, v: n[k] }));
    });
    entries.sort((x, y) => y.v.u - x.v.u);
    const out = {};
    Object.keys(byMarket || {}).forEach((m) => { out[m] = {}; });
    let used = 0;
    let dropped = 0;
    entries.forEach(({ m, k, v }) => {
      const cost = utf8Bytes(JSON.stringify(k)) + utf8Bytes(JSON.stringify(v)) + 2;
      if (used + cost > budget) { dropped += 1; return; }
      used += cost;
      out[m][k] = v;
    });
    return { notes: out, dropped };
  }

  /** 받은(또는 저장된) 사용자 리스트 정리: 최대 12개, 리스트당 80종목, 이름 20자. */
  function sanitizeGroups(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    raw.forEach((g) => {
      if (!g || typeof g !== "object") return;
      const id = String(g.id || "").slice(0, 24);
      const name = String(g.name || "").trim().slice(0, 20);
      if (!id || !name || seen.has(id) || !Array.isArray(g.tickers)) return;
      seen.add(id);
      const tickers = [...new Set(g.tickers.map((t) => String(t || "").trim().toUpperCase()).filter((t) => t && t.length <= 24))]
        .slice(0, GROUP_TICKERS_MAX);
      out.push({ id, name, tickers });
    });
    return out.slice(0, GROUPS_MAX);
  }

  const api = {
    NOTE_MAX, GROUPS_MAX, GROUP_TICKERS_MAX,
    sortRows, nextSort, moveItem, reorderSubset,
    cleanNoteText, normalizeNotes, setNote, mergeNotes, liveNotes, utf8Bytes, fitNotes, sanitizeGroups,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirWatchCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
