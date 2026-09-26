// company-info.js — 종목 분석 뷰의 "기업개요" 카드(#companyInfo)와 US "목표주가 범위" 카드(#priceTargetCard).
// 데이터: scripts/build_company_profile.py(KR DART · US SEC) · scripts/build_us_price_targets.py(Nasdaq, 점 티커는 Yahoo 보충 — 레코드 src)
//   인덱스 window.COMPANY_PROFILE_INDEX / US_PRICE_TARGETS_INDEX(FEATURE_DATA lazy) → 종목이 든 해시 샤드 하나만 fetch.
// 계산은 company-info-core.js(MirCompanyInfoCore). 클래식 스크립트(전역 공유) — 이름은 ci* 로 충돌을 피한다.

const _ciShardCache = {};

function ciCore() { return window.MirCompanyInfoCore || null; }
function ciIsKr() { return typeof isKrMarket === "function" && isKrMarket(); }

function ciFetch(url) {
  if (!_ciShardCache[url]) {
    _ciShardCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => { delete _ciShardCache[url]; return null; });
  }
  return _ciShardCache[url];
}

function ciHide(host) { if (host) { host.hidden = true; host.innerHTML = ""; } }

// 인덱스의 샤드 버전(내용 해시)을 ?v= 로 붙여 바뀐 샤드만 새로 받는다.
function ciShardUrl(base, prefix, key, meta) {
  const core = ciCore();
  const n = Number(meta && meta.shards) || 16;
  const i = String(core.shardOf(key, n)).padStart(2, "0");
  const v = (meta && meta.ver && meta.ver[i]) || "";
  return `${base}/${prefix}${i}.json${v ? `?v=${v}` : ""}`;
}

function ciLoadProfile(key, market, depth = 0) {
  const ix = window.COMPANY_PROFILE_INDEX;
  const meta = ix && ix.markets && ix.markets[market];
  if (!meta || !ciCore()) return Promise.resolve(null);
  return ciFetch(ciShardUrl("data/company_profile", `${market}_`, key, meta)).then((pl) => {
    const rec = pl && pl.t ? pl.t[key] : null;
    // 우선주는 보통주 레코드를 가리킨다({"alias": "005930"}).
    if (rec && rec.alias && depth === 0) return ciLoadProfile(rec.alias, market, 1);
    return rec && rec.name ? rec : null;
  });
}

function ciRow(label, valueHtml) {
  return valueHtml ? `<tr><th scope="row">${escapeHtml(label)}</th><td>${valueHtml}</td></tr>` : "";
}

function ciProfileRows(rec, item, kr) {
  const core = ciCore();
  const esc = (v) => (v ? escapeHtml(String(v)) : "");
  const href = core.webHref(rec.web);
  const web = href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${esc(rec.web)}</a>` : "";
  if (kr) {
    const emp = rec.emp ? `${core.fmtCount(rec.emp)}명${rec.empYear ? ` <small class="muted">${escapeHtml(String(rec.empYear))} 사업보고서</small>` : ""}` : "";
    const ind = [item && item.industry, rec.ksic ? `<small class="muted">표준산업분류 ${esc(rec.ksic)}</small>` : ""]
      .filter(Boolean).map((x, i) => (i === 0 ? esc(x) : x)).join(" ");
    return [
      ciRow("대표자", esc(rec.ceo)),
      ciRow("설립일", esc(rec.est)),
      ciRow("결산월", esc(core.fiscalMonthLabel(rec.fye))),
      ciRow("직원 수", emp),
      ciRow("업종", ind),
      ciRow("주소", esc(rec.addr)),
      ciRow("전화", esc(rec.phone)),
      ciRow("홈페이지", web),
      ciRow("영문명", esc(rec.nameEn)),
    ].join("");
  }
  const sic = rec.sicDesc ? `${esc(rec.sicDesc)}${rec.sic ? ` <small class="muted">SIC ${esc(rec.sic)}</small>` : ""}` : "";
  const former = core.formerNamesLabel(rec.former).map(escapeHtml).join("<br>");
  return [
    ciRow("정식 사명", esc(rec.name)),
    ciRow("거래소", esc((rec.exch || []).join(" · "))),
    ciRow("업종", sic),
    ciRow("결산월", esc(core.fiscalMonthLabel(rec.fye))),
    ciRow("설립지", esc(rec.inc)),
    ciRow("본사", esc(rec.addr)),
    ciRow("전화", esc(rec.phone)),
    ciRow("홈페이지", web),
    ciRow("이전 사명", former),
  ].join("");
}

function renderCompanyInfo(item) {
  const host = byId("companyInfo");
  if (!host) return;
  const ticker = item && item.ticker;
  if (!ticker || !ciCore() || item.__liveStub) return ciHide(host);
  const kr = ciIsKr();
  const market = kr ? "kr" : "us";
  if (!window.COMPANY_PROFILE_INDEX) {
    ciHide(host);
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("companyProfile").then((ok) => { if (ok && selectedTicker === ticker) renderCompanyInfo(item); });
    }
    return;
  }
  const key = kr ? String(ticker) : String(ticker).toUpperCase();
  ciLoadProfile(key, market).then((rec) => {
    if (selectedTicker !== ticker || ciIsKr() !== kr) return;
    if (!rec) return ciHide(host);
    const meta = window.COMPANY_PROFILE_INDEX.markets[market] || {};
    const src = kr ? "DART 기업개황·직원현황" : "SEC EDGAR";
    host.hidden = false;
    host.innerHTML = `<div class="qi-head"><h3>기업개요</h3></div>
      <table class="ci-table"><tbody>${ciProfileRows(rec, item, kr)}</tbody></table>
      <p class="ci-src">출처 ${escapeHtml(src)} · 기준 ${escapeHtml(rec.asOf || String(meta.updatedAtKst || "").slice(0, 10))}</p>`;
  });
}

// ── 목표주가 범위(US) ─────────────────────────────────────────────────────
function ciLoadTargets(key) {
  const ix = window.US_PRICE_TARGETS_INDEX;
  if (!ix || !ciCore()) return Promise.resolve(null);
  return ciFetch(ciShardUrl("data/us_price_targets", "", key, ix)).then((pl) => (pl && pl.t ? pl.t[key] || null : null));
}

// 범위 바 + 평균 목표가 서술. 종목 상세 카드와 AI 모드 컨센서스 패널이 같이 쓴다. 계산 불가면 "".
function ciRangeHtml(t, price) {
  const core = ciCore();
  if (!core || !t) return "";
  const money = (v) => escapeHtml(priceOrDash(v));
  const parts = [];
  const g = core.rangeGeometry(t, price);
  if (g) {
    const dot = g.price === null ? "" : `<span class="ci-range-price" style="left:${g.price}%" title="현재가 ${money(price)}"></span>`;
    parts.push(`<div class="ci-range" role="img" aria-label="목표주가 최저 ${money(t.lo)}, 평균 ${money(t.avg)}, 최고 ${money(t.hi)}, 현재가 ${money(price)}">
      <div class="ci-range-track">
        <span class="ci-range-band" style="left:${g.lo}%;width:${Math.max(0, g.hi - g.lo)}%"></span>
        <span class="ci-range-avg" style="left:${g.avg}%"></span>
        ${dot}
      </div>
      <div class="ci-range-ends">
        <div><span>최저</span><strong>${money(t.lo)}</strong></div>
        <div class="ci-mid"><span>평균</span><strong>${money(t.avg)}</strong></div>
        <div class="ci-end-r"><span>최고</span><strong>${money(t.hi)}</strong></div>
      </div>
    </div>`);
    const sentence = core.gapSentence(t.avg, price);
    if (sentence) {
      parts.push(`<p class="ci-gap"><i class="ci-dot" aria-hidden="true"></i>현재가 ${money(price)} · ${escapeHtml(sentence)}</p>`);
    }
  }
  return parts.join("");
}

function ciPriceTargetHtml(t, price) {
  const core = ciCore();
  const parts = [ciRangeHtml(t, price)];
  const sh = core.opinionShares(t);
  if (sh) {
    const seg = (cls, pct, label, n) => (pct > 0 ? `<span class="${cls}" style="width:${pct}%" title="${label} ${n}명"></span>` : "");
    parts.push(`<div class="ci-op">
      <div class="ci-op-bar">${seg("ci-op-buy", sh.buy, "매수", t.buy)}${seg("ci-op-hold", sh.hold, "보유", t.hold)}${seg("ci-op-sell", sh.sell, "매도", t.sell)}</div>
      <div class="ci-op-legend"><span><i class="ci-op-buy"></i>매수 ${t.buy}</span><span><i class="ci-op-hold"></i>보유 ${t.hold}</span><span><i class="ci-op-sell"></i>매도 ${t.sell}</span></div>
    </div>`);
  }
  const hist = Array.isArray(t.hist) ? t.hist.slice(-12).reverse() : [];
  if (hist.length > 1) {
    const rows = hist.map((r) => `<tr><td>${escapeHtml(String(r[0]))}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td></tr>`).join("");
    parts.push(`<details class="ci-hist"><summary>월별 의견 분포</summary>
      <table class="ci-hist-table"><thead><tr><th>월초</th><th class="num">매수</th><th class="num">보유</th><th class="num">매도</th></tr></thead><tbody>${rows}</tbody></table>
    </details>`);
  }
  return parts.join("");
}

function renderPriceTargets(item) {
  const host = byId("priceTargetCard");
  if (!host) return;
  const ticker = item && item.ticker;
  if (!ticker || ciIsKr() || !ciCore() || item.__liveStub) return ciHide(host);
  if (!window.US_PRICE_TARGETS_INDEX) {
    ciHide(host);
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("usPriceTargets").then((ok) => { if (ok && selectedTicker === ticker) renderPriceTargets(item); });
    }
    return;
  }
  const key = String(ticker).toUpperCase();
  ciLoadTargets(key).then((t) => {
    if (selectedTicker !== ticker || ciIsKr()) return;
    const body = t ? ciPriceTargetHtml(t, item.price) : "";
    if (!body) return ciHide(host);
    const n = Number(t.n) || 0;
    host.hidden = false;
    host.innerHTML = `<div class="qi-head"><h3>목표주가 범위</h3><span>${n ? `애널리스트 ${n}명 · ` : ""}기준 ${escapeHtml(t.asOf || "")}</span></div>
      ${body}
      <p class="ci-src">출처 ${t.src === "yahoo" ? "Yahoo Finance" : "Nasdaq"} · 애널리스트 추정치이며 예측이나 투자 권유가 아닙니다.</p>`;
  });
}

// AI 모드 컨센서스 패널용 자리. 패널 HTML 은 동기로 만들어지므로 자리(data-pt-slot)만 두고,
// 인덱스·샤드가 오면 같은 종목의 자리를 모두 채운다. 데이터가 없거나 KR 이면 "".
function priceTargetSlotHtml(item) {
  if (!item || !item.ticker || ciIsKr() || !ciCore() || item.__liveStub) return "";
  const key = String(item.ticker).toUpperCase();
  const price = Number(item.price);
  setTimeout(() => hydratePriceTargetSlots(key, price), 0);
  return `<div class="ci-slot" data-pt-slot="${escapeHtml(key)}" hidden></div>`;
}

function hydratePriceTargetSlots(key, price) {
  const ready = window.US_PRICE_TARGETS_INDEX
    ? Promise.resolve(true)
    : (typeof ensureFeatureData === "function" ? ensureFeatureData("usPriceTargets") : Promise.resolve(false));
  ready.then((ok) => (ok ? ciLoadTargets(key) : null)).then((t) => {
    const body = t ? ciRangeHtml(t, price) : "";
    if (!body) return;
    const n = Number(t.n) || 0;
    const head = `<div class="ci-slot-head"><span>목표주가 범위</span><em>Nasdaq${n ? ` · ${n}명` : ""}${t.asOf ? ` · 기준 ${escapeHtml(t.asOf)}` : ""}</em></div>`;
    document.querySelectorAll(`.ci-slot[data-pt-slot="${CSS.escape(key)}"]`).forEach((el) => {
      el.innerHTML = head + body;
      el.hidden = false;
    });
  }).catch(() => {});
}
