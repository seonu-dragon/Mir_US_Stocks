// 종목 분석 뷰의 시세정보(52주 게이지 · 전일/시가/고가/저가/거래량/거래대금)와 투자정보(시총·PER·EPS·PBR·BPS·
// 배당·PSR·동일업종 비교·ETF NAV/괴리율) 블록. 계산은 quote-info-core.js(MirQuoteCore), 여기는 표시만.
// 시세정보는 #range52Bar 에(render52wRange 가 위임), 투자정보는 핵심 지표 카드(renderFundamentals) 맨 위에 들어간다.

function qiCore() { return window.MirQuoteCore || null; }

function qiNum(v) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function qiIsKr() { return typeof isKrMarket === "function" && isKrMarket(); }

// 해외 종목 가격·금액 옆 원화 병기. 환율(USD/KRW)이 아직 없으면 빈 문자열.
function qiUsdKrwRate() {
  return typeof currentUsdKrw === "function" ? currentUsdKrw() : null;
}

function quoteKrwApproxHtml(usd) {
  const core = qiCore();
  if (!core || qiIsKr()) return "";
  const rate = qiUsdKrwRate();
  const v = qiNum(usd);
  if (!rate || v === null || v <= 0) return "";
  const text = core.fmtKrwApprox(v * rate);
  return text ? `<small class="qi-krw" title="원/달러 ${rate.toLocaleString("en-US", { maximumFractionDigits: 2 })} 적용">${escapeHtml(text)}</small>` : "";
}

// 거래대금·시가총액 같은 큰 금액. KR = 원(억/조), US = 달러(B/M).
function qiMoneyLarge(amount) {
  const core = qiCore();
  const v = qiNum(amount);
  if (!core || v === null) return "—";
  return qiIsKr() ? `${core.fmtKrwLarge(v)}원` : core.fmtUsdLarge(v);
}

function qiMarketCapAbs(item) {
  if (!item) return null;
  if (qiIsKr()) {
    const t = qiNum(item.marketCapT) ?? qiNum(item.marketCapB);
    return t !== null && t > 0 ? t * 1e12 : null;
  }
  const b = qiNum(item.marketCapB) ?? qiNum(item.fundamentals && item.fundamentals.marketCapB);
  return b !== null && b > 0 ? b * 1e9 : null;
}

function qiRow(label, valueHtml, opts = {}) {
  const title = opts.title ? ` title="${escapeHtml(opts.title)}"` : "";
  return `<div class="qi-row"><dt${title}>${escapeHtml(label)}</dt><dd class="${opts.cls || ""}">${valueHtml}</dd></div>`;
}

function qiPrice(v) {
  return qiNum(v) === null ? "—" : escapeHtml(priceOrDash(v));
}

// ── 시세정보 ──────────────────────────────────────────────────────────────
function renderQuoteInfo(item) {
  const el = byId("range52Bar");
  const core = qiCore();
  if (!el || !item || !core) return false;
  const series = Array.isArray(item.chartSeries) ? item.chartSeries : [];
  const price = qiNum(item.price);
  // 사이트의 기존 52주 값과 같은 기준: KR 종가, US 장중 고저.
  const w = core.week52Range(series, { price, priceDate: item.priceDate, basis: qiIsKr() ? "close" : "intraday" });
  const bar = core.sessionBar(series, item.priceDate);
  const mf = (typeof mapFundamentalsFor === "function" && mapFundamentalsFor(item.ticker)) || {};
  const f = item.fundamentals || {};
  // 상세 파일(일봉)이 없으면 날짜 없이 기존 52주 고저만.
  const low = w ? w.low : (qiNum(f.week52Low) ?? qiNum(mf.low52));
  const high = w ? w.high : (qiNum(f.week52High) ?? qiNum(mf.high52));
  const pos = w ? w.pos : (low !== null && high !== null && high > low && price !== null ? Math.max(0, Math.min(100, (price - low) / (high - low) * 100)) : null);
  const volume = qiNum(item.volume) ?? (bar && !bar.barMissing ? bar.volume : null);
  const amount = qiNum(item.amount);
  const prevClose = (bar && bar.prevClose) ?? qiNum(f.prevClose);
  const asOf = core.fmtDate(item.priceDate || (bar && bar.date) || "");

  if (low === null && high === null && prevClose === null && volume === null) { el.innerHTML = ""; return true; }

  const gauge = (low !== null && high !== null && high > low) ? `
    <div class="qi-gauge" title="최근 252거래일 ${w && w.basis === "close" ? "종가" : "장중 고가·저가"} 기준">
      <div class="qi-gauge-top"><span>52주 최저</span><span>52주 최고</span></div>
      <div class="qi-bar" role="img" aria-label="52주 범위 안 현재가 위치 ${pos === null ? "" : Math.round(pos) + "%"}">
        ${pos === null ? "" : `<div class="qi-marker" style="left:${pos.toFixed(1)}%"></div>`}
      </div>
      <div class="qi-gauge-ends">
        <div><strong>${qiPrice(low)}</strong>${w && w.lowDate ? `<em>${escapeHtml(core.fmtDate(w.lowDate))}</em>` : ""}</div>
        <div class="qi-end-r"><strong>${qiPrice(high)}</strong>${w && w.highDate ? `<em>${escapeHtml(core.fmtDate(w.highDate))}</em>` : ""}</div>
      </div>
    </div>` : "";

  const kr = qiIsKr();
  const rows = [
    qiRow("전일", qiPrice(prevClose)),
    qiRow("시가", qiPrice(bar && bar.open)),
    qiRow("고가", qiPrice(bar && bar.high), { cls: bar && prevClose !== null && bar.high !== null ? (bar.high > prevClose ? "pos" : bar.high < prevClose ? "neg" : "") : "" }),
    qiRow("저가", qiPrice(bar && bar.low), { cls: bar && prevClose !== null && bar.low !== null ? (bar.low > prevClose ? "pos" : bar.low < prevClose ? "neg" : "") : "" }),
    qiRow("거래량", volume === null ? "—" : escapeHtml(core.fmtShares(volume))),
    kr
      ? qiRow("거래대금", amount === null ? "—" : escapeHtml(qiMoneyLarge(amount)))
      : qiRow("거래대금", amount === null ? "—" : `≈ ${escapeHtml(qiMoneyLarge(amount))}`, { title: "종가 × 거래량 근사" }),
  ];

  const splits = Array.isArray(item.splits) ? core.splitEvents(item.splits) : null;
  const splitHtml = splits === null ? "" : `
    <p class="qi-splits"><span>액면분할(최근 10년)</span>${splits.length
      ? splits.map((s) => `<b>${escapeHtml(core.fmtDate(s.date))} ${escapeHtml(s.ratio)}${s.kind === "병합" ? " 병합" : ""}</b>`).join("")
      : "<b class=\"muted\">없음</b>"}</p>`;

  el.innerHTML = `
    <div class="qi-head"><h3>시세정보</h3>${asOf ? `<span>${escapeHtml(asOf)} 기준</span>` : ""}</div>
    ${gauge}
    <dl class="qi-grid">${rows.join("")}</dl>
    ${splitHtml}
    ${bar && bar.barMissing ? `<p class="qi-note">기준일 일봉이 아직 없어 시가·고가·저가를 비워 둡니다.</p>` : ""}`;
  return true;
}

// ── 투자정보 ──────────────────────────────────────────────────────────────
let qiPeerMemo = null;
function qiPeerRows() {
  const stocks = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  const mfCount = Object.keys(window.MAP_FUNDAMENTALS || {}).length;
  const key = `${qiIsKr() ? "kr" : "us"}|${data && data.updatedAtKst}|${stocks.length}|${mfCount}`;
  if (qiPeerMemo && qiPeerMemo.key === key) return qiPeerMemo.rows;
  const rows = stocks.map((s) => {
    const mf = (typeof mapFundamentalsFor === "function" && mapFundamentalsFor(s.ticker)) || {};
    return {
      ticker: s.ticker, sector: s.sector, industry: s.industry, changePct: s.changePct,
      pe: mf.pe, etf: typeof isStockEtf === "function" ? isStockEtf(s) : false,
    };
  });
  qiPeerMemo = { key, rows };
  return rows;
}

function qiFinancialsFile(item) {
  if (typeof financialsCached !== "function" || !item || !item.ticker) return null;
  const cached = financialsCached(item.ticker);
  if (cached === undefined && typeof loadFinancials === "function") {
    const ticker = item.ticker;
    loadFinancials(ticker).then((file) => {
      if (!file || typeof selectedTicker === "undefined" || selectedTicker !== ticker) return;
      if (typeof renderFundamentals === "function" && typeof selectedBaseRow === "function") {
        const base = selectedBaseRow();
        if (base) renderFundamentals(applyLive(withDetail(base)));
      }
    });
  }
  return cached || null;
}

// { values, label, notes, financial } | null — 재무 확장 파일이 있는 종목만.
function qiTtmRatios(item) {
  const core = qiCore();
  const file = qiFinancialsFile(item);
  if (!core || !file) return null;
  return core.ttmRatios(file, { marketCap: qiMarketCapAbs(item), priceCurrency: qiIsKr() ? "KRW" : "USD" });
}

function qiMultiple(v) { const n = qiNum(v); return n === null ? "—" : `${n.toFixed(2)}배`; }
function qiPct(v, digits = 2) { const n = qiNum(v); return n === null ? "—" : `${n.toFixed(digits)}%`; }
function qiPerShare(v) {
  const n = qiNum(v);
  if (n === null) return "—";
  return qiIsKr() ? `${Math.round(n).toLocaleString("ko-KR")}원` : `$${n.toFixed(2)}`;
}

// 핵심 지표 카드 맨 위에 넣는 투자정보 블록 HTML. f = normalizedFundamentalsForItem(item).
function investInfoHtml(item, f, ttm) {
  const core = qiCore();
  if (!core || !item) return "";
  const kr = qiIsKr();
  const etf = typeof isStockEtf === "function" && isStockEtf(item);
  const mf = (typeof mapFundamentalsFor === "function" && mapFundamentalsFor(item.ticker)) || {};
  const tv = (ttm && ttm.values) || {};
  const price = qiNum(item.price);
  const capAbs = qiMarketCapAbs(item);
  const capHtml = capAbs === null ? "—" : `${escapeHtml(qiMoneyLarge(capAbs))}${kr ? "" : quoteKrwApproxHtml(capAbs)}`;

  // 배당: 소스 값(DPS·수익률)이 우선, 없으면 최근 1년 배당 기록 합으로(표시에 '최근 1년' 명시).
  const trailing = core.trailingDividend(item.dividends, item.priceDate);
  // 주당배당금과 수익률은 같은 출처끼리 짝을 맞춘다(한쪽만 옛 값이면 서로 안 맞는다).
  let dps = qiNum(f.dps), dpsNote = "", divYield = null;
  if (dps !== null) {
    divYield = qiNum(f.divYield) ?? qiNum(mf.divYield) ?? (price ? dps / price * 100 : null);
  } else if (trailing) {
    dps = trailing.amount;
    divYield = price ? dps / price * 100 : null;
    dpsNote = "최근 1년 배당 합 · 현재가 기준 수익률";
  } else {
    divYield = qiNum(f.divYield) ?? qiNum(mf.divYield);
  }

  const rows = [qiRow("시가총액", capHtml)];
  if (etf) {
    const nav = qiNum(item.nav);
    const prem = qiNum(item.navPremiumPct) ?? core.navPremiumPct(price, nav);
    rows.push(
      qiRow("NAV", nav === null ? "—" : escapeHtml(priceOrDash(nav)), { title: "순자산가치(1주당)" }),
      qiRow("괴리율", prem === null ? "—" : `${prem > 0 ? "+" : ""}${prem.toFixed(2)}%`, { cls: prem === null ? "" : prem > 0 ? "pos" : prem < 0 ? "neg" : "", title: "시장가격 / NAV − 1" }),
      qiRow("배당수익률", qiPct(divYield), { title: dpsNote || "" }),
      qiRow("주당배당금", dps === null ? "—" : escapeHtml(qiPerShare(dps)), { title: dpsNote || "" }),
    );
  } else {
    // PER·EPS 는 같은 기준끼리(최근 4분기 / 연간). 기준은 normalizedFundamentalsForItem 이 정한다.
    const fromF = qiNum(f.pe) !== null;
    const per = qiNum(f.pe) ?? tv.per;
    const eps = fromF ? (qiNum(f.epsShown) ?? qiNum(f.epsTtm)) : (qiNum(f.epsShown) ?? qiNum(f.epsTtm) ?? tv.eps);
    const perLabel = fromF ? (f.peLabel || "PER") : (tv.per != null ? "PER(최근 4분기)" : (f.peLabel || "PER"));
    const epsLabel = fromF ? (f.epsLabel || "EPS") : (tv.eps != null && qiNum(f.epsShown) === null ? "EPS(최근 4분기)" : (f.epsLabel || "EPS"));
    const bps = qiNum(f.bpsShown) ?? qiNum(f.bps) ?? tv.bps ?? (price && qiNum(f.pb) > 0 ? price / Number(f.pb) : null);
    const psr = tv.psr ?? qiNum(f.ps) ?? qiNum(mf.ps);
    if (kr) rows.push(qiRow("외국인소진율", qiPct(qiNum(f.foreignExhaustion) ?? qiNum(mf.foreignExhaustion))));
    rows.push(
      qiRow(perLabel, qiMultiple(per), { title: f.peNote || "" }),
      qiRow(epsLabel, escapeHtml(qiPerShare(eps))),
      qiRow("추정PER", qiMultiple(f.forwardPE), { title: "증권사 추정 EPS 기준(추정치)" }),
      qiRow("추정EPS", escapeHtml(qiPerShare(f.epsNextY)), { title: "증권사 추정치" }),
      qiRow("PBR", qiMultiple(qiNum(f.pb) ?? tv.pbr)),
      qiRow("BPS", escapeHtml(qiPerShare(bps))),
      qiRow("배당수익률", qiPct(divYield), { title: dpsNote || "" }),
      qiRow("주당배당금", dps === null ? "—" : escapeHtml(qiPerShare(dps)), { title: dpsNote || "" }),
      qiRow("PSR", qiMultiple(psr), { title: tv.psr != null ? `시가총액 / 매출(${ttm.label})` : "" }),
      qiRow("PCFR", qiMultiple(tv.pcfr), { title: tv.pcfr != null ? `시가총액 / 영업현금흐름(${ttm.label})` : "재무 확장 데이터가 있는 종목만" }),
    );
  }
  if (rows.length % 2) rows.push(`<div class="qi-row qi-row-empty"></div>`);

  // 동일업종(ETF 제외) 중앙값 — 스냅샷·map_fundamentals 에서 계산.
  let peerHtml = "";
  if (!etf) {
    const peer = core.peerMedians(qiPeerRows(), { sector: item.sector, industry: item.industry });
    if (peer) {
      const chg = peer.changeMedian;
      peerHtml = `
        <div class="qi-peer">
          <div class="qi-peer-title">동일업종 <span>${escapeHtml(peer.label)} · ${peer.count.toLocaleString("en-US")}종목 중앙값</span></div>
          <dl class="qi-grid qi-grid-peer">
            ${qiRow("PER", peer.peMedian === null ? "—" : qiMultiple(peer.peMedian), { title: `PER 이 있는 ${peer.peCount}종목(적자·이상치 제외)` })}
            ${qiRow("등락률", chg === null ? "—" : escapeHtml(fmtDailyPct(chg)), { cls: chg === null ? "" : chg > 0 ? "pos" : chg < 0 ? "neg" : "" })}
          </dl>
        </div>`;
    }
  }
  return `
    <section class="qi-invest">
      <div class="qi-head"><h3>투자정보</h3></div>
      <dl class="qi-grid">${rows.join("")}</dl>
      ${peerHtml}
    </section>`;
}

// 재무비율 TTM 그룹(핵심 지표의 '수익성' 자리). 재무 확장 파일이 없으면 null → 기존 수익성 그룹을 쓴다.
function ttmRatioGroup(ttm) {
  if (!ttm || !ttm.values) return null;
  const v = ttm.values;
  const out = (k) => (ttm.outliers || []).includes(k);
  const mark = (k, text) => (out(k) && text !== "—" ? `${text}*` : text);
  const metrics = [
    ["영업이익률", mark("opMargin", qiPct(v.opMargin))],
    ["순이익률", mark("netMargin", qiPct(v.netMargin))],
    ["ROE", mark("roe", qiPct(v.roe))],
    ["ROA", mark("roa", qiPct(v.roa))],
    ["부채비율", mark("debtRatio", qiPct(v.debtRatio))],
    ["주당매출액(SPS)", qiPerShare(v.sps)],
    ["주당현금흐름(CFPS)", qiPerShare(v.cfps)],
  ].filter(([, text]) => text !== "—");
  if (!metrics.length) return null;
  return { title: `재무비율 · ${ttm.label}`, metrics, note: [...(ttm.notes || []), (ttm.outliers || []).length ? "* 이상치 가능(분모가 작음)" : ""].filter(Boolean).join(" ") };
}

// 환율이 늦게 오면(워커 ?fx=) 원화 병기만 다시 그린다.
function refreshQuoteInfoFx() {
  if (qiIsKr() || typeof selectedBaseRow !== "function" || typeof currentTab === "undefined" || currentTab !== "search") return;
  const base = selectedBaseRow();
  if (!base) return;
  const item = applyLive(withDetail(base));
  const facts = byId("searchFacts");
  if (facts && typeof stockFacts === "function") facts.innerHTML = stockFacts(item, "선택 종목");
  if (typeof renderFundamentals === "function") renderFundamentals(item);
}
