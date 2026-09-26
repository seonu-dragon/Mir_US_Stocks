// 시장지도(트리맵) — 극소 타일 묶기 순수 로직(DOM 없음).
// 브라우저에서는 window.MirTreemapCore, node 테스트(scripts/tests/test_treemap_core.mjs)에서는 module.exports.
//
// 전체 보통주·S&P 500 뷰에서는 섹터마다 수백 개 종목이 가로 12px 미만(빈 버튼)·42px 미만(글자 없음)
// 타일이 된다. 그런 종목을 섹터(또는 확대한 섹터·산업)마다 '기타 N개' 타일 하나로 묶는다. 묶음의 면적은
// 구성 종목 가중치의 합이라 지도 비율은 그대로이고, 색은 구성 종목의 시가총액 가중 평균이다.
(function (root) {
  "use strict";

  function finite(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // items 를 areaFn(item) 기준으로 나눈다. minArea 미만이 2개 이상일 때만 묶는다(1개면 묶을 이유가 없다).
  // 전부 작으면(작은 섹터·모바일 폭) 가장 큰 1개는 타일로 남기고 나머지를 묶는다 — 섹터가 '기타' 한 칸만
  // 되지 않게. '동일 크기' 보기처럼 전부 같은 크기인 경우는 호출하는 쪽(treemap.js)이 묶기를 끈다.
  function partitionTiny(items, areaFn, minArea) {
    const list = items || [];
    const keep = [];
    const tiny = [];
    list.forEach((it) => {
      const a = finite(areaFn(it));
      if (a !== null && a < minArea) tiny.push(it);
      else keep.push(it);
    });
    if (!keep.length && tiny.length) {
      let bi = 0;
      tiny.forEach((it, i) => { if ((finite(areaFn(it)) || 0) > (finite(areaFn(tiny[bi])) || 0)) bi = i; });
      keep.push(tiny.splice(bi, 1)[0]);
    }
    if (tiny.length < 2) return { keep: list.slice(), tiny: [] };
    return { keep, tiny };
  }

  // 가중 평균. valueFn 이 null 을 주는 항목은 빠진다. 가중치가 전부 0/결측이면 단순 평균.
  // clipFn 이 있으면 평균 전에 값을 누른다(펀더멘털 이상치 윈저라이즈).
  function weightedAverage(items, valueFn, weightFn, clipFn) {
    let sw = 0, swv = 0, n = 0, sum = 0;
    (items || []).forEach((it) => {
      let v = finite(valueFn(it));
      if (v === null) return;
      if (clipFn) v = clipFn(v);
      const w = finite(weightFn(it));
      n += 1;
      sum += v;
      if (w !== null && w > 0) { sw += w; swv += w * v; }
    });
    if (!n) return null;
    return sw > 0 ? swv / sw : sum / n;
  }

  // 툴팁·팝오버에 보일 상위 구성 종목(가중치 큰 순).
  function topMembers(items, weightFn, limit) {
    return (items || []).slice().sort((a, b) => (finite(weightFn(b)) || 0) - (finite(weightFn(a)) || 0)).slice(0, limit || 5);
  }

  const api = { partitionTiny, weightedAverage, topMembers };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirTreemapCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
