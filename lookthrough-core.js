// ETF 룩스루 — 순수 계산 모듈(DOM 없음). 화면은 lookthrough.js.
// 브라우저에서는 window.MirLookthroughCore, node 테스트(scripts/tests/test_lookthrough_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다.
//
// 보유 포지션(직접 주식 + ETF)을 ETF 구성 종목으로 펼쳐
//   - 실제 종목 노출: 직접 보유 비중 + Σ(ETF 비중 × 그 ETF 안의 종목 비중)
//   - ETF 간 중복: 두 ETF 에 같이 든 종목의 min(비중) 합(가중 중복도)
//   - 섹터 노출: 직접 주식 섹터 + ETF 의 섹터 분포(없으면 공개 상위 종목으로 근사)
// 을 계산한다.
//
// 한계(화면에도 적는다): ETF 구성은 **공개된 상위 N개**(미국 N-PORT 상위 25, 국내 KRX PDF 상위 25)만
// 갖고 있다. 그래서 종목 노출·중복도는 하한이고, 상위 밖 나머지는 '공개 상위 밖'으로 따로 센다.
(function (root) {
  "use strict";

  // 이름 정규화 — 같은 종목이 ETF 마다 표기가 조금씩 다를 때(티커가 없는 해외 구성 종목) 묶는 키.
  function normName(s) {
    return String(s || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\(주\)|㈜|주식회사/g, "")
      .replace(/[\s.,·'"&\-_/()]/g, "");
  }

  function holdingKey(h) {
    if (h && h.t) return `t:${String(h.t).toUpperCase()}`;
    return `n:${normName(h && h.n)}`;
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ETF 한 개의 구성(상위 목록)을 {key → {w, t, n, k}} 로. 같은 키가 두 번 나오면(종류주 등) 합친다.
  function holdingMap(etf) {
    const out = new Map();
    ((etf && etf.top) || []).forEach((h) => {
      const w = num(h && h.w);
      if (!(w > 0)) return;
      const key = holdingKey(h);
      if (key === "n:") return;
      const prev = out.get(key);
      if (prev) prev.w += w;
      else out.set(key, { w, t: h.t || null, n: h.n || "", k: h.k || "equity" });
    });
    return out;
  }

  // 두 ETF 의 가중 중복도 = Σ min(wA, wB). 둘 다 공개 상위 목록만 보므로 하한.
  function pairOverlap(etfA, etfB) {
    const a = holdingMap(etfA);
    const b = holdingMap(etfB);
    let overlap = 0;
    const common = [];
    a.forEach((ha, key) => {
      const hb = b.get(key);
      if (!hb) return;
      if (ha.k === "cash" || hb.k === "cash") return;
      const m = Math.min(ha.w, hb.w);
      overlap += m;
      common.push({ key, ticker: ha.t || hb.t, name: ha.n || hb.n, wA: ha.w, wB: hb.w, min: m });
    });
    common.sort((x, y) => y.min - x.min);
    return { overlapPct: overlap, commonCount: common.length, common };
  }

  // positions: [{ ticker, name, value, isEtf, sector }]
  // etfs: { [ticker]: { asOf, top:[{t,n,w,k}], sectors:[[s,w]]|null, sectorUnmapped, holdingsCount, name } }
  //       — 구성 자료가 없는 ETF 는 키가 없거나 null. missing[ticker] = 사유 문자열(선택).
  // sectorOf(ticker) → 섹터 문자열|null : ETF 에 섹터 분포가 없을 때 상위 종목으로 근사하는 데 쓴다.
  function computeLookthrough({ positions, etfs, missing, sectorOf, topN = 15 } = {}) {
    const pos = (positions || []).filter((p) => p && p.ticker && num(p.value) > 0);
    const total = pos.reduce((s, p) => s + num(p.value), 0);
    const empty = {
      total, hasEtf: false, coverage: { directPct: 0, etfCoveredPct: 0, etfRestPct: 0, etfMissingPct: 0 },
      exposures: [], exposureCount: 0, multiSourceCount: 0, overlaps: [], sectors: [], etfRows: [],
    };
    if (!(total > 0)) return empty;
    const etfMap = etfs || {};
    const why = missing || {};

    const expo = new Map();   // key → {key, ticker, name, direct, via, sources: Map(etf → pct)}
    const sectorAcc = new Map();
    const addSector = (s, pct) => { if (pct > 0) sectorAcc.set(s, (sectorAcc.get(s) || 0) + pct); };
    const touch = (key, ticker, name) => {
      let e = expo.get(key);
      if (!e) { e = { key, ticker: ticker || null, name: name || "", direct: 0, via: 0, sources: new Map() }; expo.set(key, e); }
      if (!e.ticker && ticker) e.ticker = ticker;
      if (!e.name && name) e.name = name;
      return e;
    };

    let directPct = 0, etfCoveredPct = 0, etfRestPct = 0, etfMissingPct = 0;
    const etfRows = [];
    const heldEtfs = [];

    pos.forEach((p) => {
      const wPort = num(p.value) / total * 100;
      if (!p.isEtf) {
        directPct += wPort;
        const e = touch(`t:${String(p.ticker).toUpperCase()}`, p.ticker, p.name);
        e.direct += wPort;
        e.sources.set("__direct", (e.sources.get("__direct") || 0) + wPort);
        addSector(p.sector || "__unmapped", wPort);
        return;
      }
      const etf = etfMap[p.ticker];
      const top = etf && Array.isArray(etf.top) ? etf.top : [];
      if (!etf || !top.length) {
        etfMissingPct += wPort;
        addSector("__nodata", wPort);
        etfRows.push({ ticker: p.ticker, name: p.name || (etf && etf.name) || "", weightPct: wPort, status: "missing",
          reason: why[p.ticker] || "구성 데이터 없음", asOf: (etf && etf.asOf) || null });
        return;
      }
      heldEtfs.push({ ticker: p.ticker, name: p.name || etf.name || "", etf, wPort });
      const hm = holdingMap(etf);
      let covered = 0;
      hm.forEach((h, key) => {
        covered += h.w;
        if (h.k === "cash") return;
        const pct = wPort * h.w / 100;
        const e = touch(key, h.t, h.n);
        e.via += pct;
        e.sources.set(p.ticker, (e.sources.get(p.ticker) || 0) + pct);
      });
      covered = Math.min(100, covered);
      etfCoveredPct += wPort * covered / 100;
      etfRestPct += wPort * (100 - covered) / 100;

      // 섹터: ETF 가 전체 보유 기준 분포를 주면 그대로, 아니면 공개 상위 종목으로 근사.
      if (Array.isArray(etf.sectors) && etf.sectors.length) {
        let sum = 0;
        etf.sectors.forEach(([s, w]) => { const x = num(w); sum += x; addSector(s, wPort * x / 100); });
        const unm = num(etf.sectorUnmapped);
        sum += unm;
        addSector("__unmapped", wPort * unm / 100);
        addSector("__nonequity", wPort * Math.max(0, 100 - sum) / 100);
      } else {
        let sum = 0;
        hm.forEach((h) => {
          sum += h.w;
          if (h.k === "cash") { addSector("__nonequity", wPort * h.w / 100); return; }
          const s = (h.t && typeof sectorOf === "function" && sectorOf(h.t)) || "__unmapped";
          addSector(s, wPort * h.w / 100);
        });
        addSector("__rest", wPort * Math.max(0, 100 - sum) / 100);
      }
      etfRows.push({ ticker: p.ticker, name: p.name || etf.name || "", weightPct: wPort, status: "ok",
        asOf: etf.asOf || null, basis: etf.weightBasis || null, coveredPct: covered, shownCount: hm.size, holdingsCount: num(etf.holdingsCount) || hm.size });
    });

    const all = Array.from(expo.values()).map((e) => {
      const sources = Array.from(e.sources.entries())
        .map(([etf, pct]) => ({ etf: etf === "__direct" ? null : etf, direct: etf === "__direct", pct }))
        .sort((a, b) => b.pct - a.pct);
      return { key: e.key, ticker: e.ticker, name: e.name, directPct: e.direct, viaPct: e.via, totalPct: e.direct + e.via, sources };
    }).filter((e) => e.totalPct > 0);
    all.sort((a, b) => b.totalPct - a.totalPct || String(a.key).localeCompare(String(b.key)));

    const overlaps = [];
    for (let i = 0; i < heldEtfs.length; i += 1) {
      for (let j = i + 1; j < heldEtfs.length; j += 1) {
        const A = heldEtfs[i], B = heldEtfs[j];
        const r = pairOverlap(A.etf, B.etf);
        overlaps.push({ a: A.ticker, b: B.ticker, aName: A.name, bName: B.name,
          overlapPct: r.overlapPct, commonCount: r.commonCount, common: r.common.slice(0, 5),
          asOfA: A.etf.asOf || null, asOfB: B.etf.asOf || null });
      }
    }
    overlaps.sort((x, y) => y.overlapPct - x.overlapPct);

    const sectors = Array.from(sectorAcc.entries()).map(([sector, pct]) => ({ sector, pct }))
      .filter((s) => s.pct >= 0.05)
      .sort((a, b) => {
        const sa = a.sector.startsWith("__") ? 1 : 0, sb = b.sector.startsWith("__") ? 1 : 0;
        return sa - sb || b.pct - a.pct;
      });

    etfRows.sort((a, b) => b.weightPct - a.weightPct);
    return {
      total,
      hasEtf: etfRows.length > 0,
      coverage: { directPct, etfCoveredPct, etfRestPct, etfMissingPct },
      exposures: all.slice(0, Math.max(1, topN)),
      exposureCount: all.length,
      multiSourceCount: all.filter((e) => e.sources.length >= 2).length,
      overlaps,
      sectors,
      etfRows,
    };
  }

  const api = { normName, holdingKey, holdingMap, pairOverlap, computeLookthrough };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MirLookthroughCore = api;
})(typeof window !== "undefined" ? window : globalThis);
