// 주가 움직임 이유(워커 ?move_reasons=) 응답 정리 — 순수 계산(DOM 없음).
// 브라우저 window.MirMoveReasonsCore, node 테스트 scripts/tests/test_move_reasons_core.mjs.
// 응답: { ticker, company, date, changePct, socialSources, socialErrors, socialCount, newsCount,
//         confirmed: [{claim, news:[{title,link,publisher,date}], socialCount, samples:[{text,url,source}]}],
//         socialOnly: [{claim, socialCount, samples}], newsOnly: [{claim, news}], error }
// 모양이 다르면 null — 화면은 그 결과를 그리지 않는다(값을 지어내지 않는다).
(function (root) {
  "use strict";

  function str(v, max = 200) {
    return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
  }
  function httpUrl(v) {
    const s = str(v, 600);
    return /^https?:\/\//i.test(s) ? s : "";
  }
  function count(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  function newsList(arr) {
    return (Array.isArray(arr) ? arr : []).map((n) => ({
      title: str(n && n.title, 200), link: httpUrl(n && n.link), publisher: str(n && n.publisher, 60), date: str(n && n.date, 30),
    })).filter((n) => n.title);
  }
  function samples(arr) {
    return (Array.isArray(arr) ? arr : []).map((s) => ({ text: str(s && s.text, 200), url: httpUrl(s && s.url), source: str(s && s.source, 40) }))
      .filter((s) => s.text);
  }

  function normalize(body) {
    if (!body || typeof body !== "object" || !Array.isArray(body.confirmed) || !Array.isArray(body.socialOnly)) return null;
    const claim = (c) => str(c && c.claim, 160);
    return {
      date: str(body.date, 12),
      changePct: Number.isFinite(Number(body.changePct)) && body.changePct !== null ? Number(body.changePct) : null,
      socialSources: (Array.isArray(body.socialSources) ? body.socialSources : []).map((s) => str(s, 30)).filter(Boolean),
      socialFailed: (Array.isArray(body.socialErrors) ? body.socialErrors : []).length > 0,
      socialCount: count(body.socialCount),
      newsCount: count(body.newsCount),
      confirmed: body.confirmed.map((c) => ({ claim: claim(c), news: newsList(c.news), socialCount: count(c.socialCount), samples: samples(c.samples) }))
        .filter((c) => c.claim && c.news.length),
      socialOnly: body.socialOnly.map((c) => ({ claim: claim(c), socialCount: count(c.socialCount), samples: samples(c.samples) }))
        .filter((c) => c.claim),
      newsOnly: (Array.isArray(body.newsOnly) ? body.newsOnly : []).map((c) => ({ claim: claim(c), news: newsList(c.news) }))
        .filter((c) => c.claim && c.news.length),
      failed: !!body.error && body.error !== "no_sources",
      empty: body.error === "no_sources",
    };
  }

  function hasAny(r) {
    return !!r && (r.confirmed.length + r.socialOnly.length + r.newsOnly.length) > 0;
  }

  const api = { normalize, hasAny };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirMoveReasonsCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
