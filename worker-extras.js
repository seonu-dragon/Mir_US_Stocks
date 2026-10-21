// worker-extras.js — 워커 데이터 라우트를 쓰는 화면(2026-10-21).
//   · 종목 자동완성·⌘K: 로컬(스냅샷·한글 별칭) 결과가 적을 때만 ?symsearch= 원격 결과를 아래에 붙인다
//   · 종목 상세: ?insights= 의 '비슷한 종목' 칩 + 지지/저항, ?options= 의 옵션 요약(US)
// 검증·정리는 worker-extras-core.js(window.MirWorkerExtras). 여기는 받기·캐시·그리기.
//
// 워커는 머지해도 배포되지 않는다(수동 배포). 옛 워커는 이 라우트들을 404 not_found 로 답하므로, 그걸 보면
// 이번 방문 동안 그 라우트를 끄고 화면은 아무 표시 없이 숨긴다(빈 칸·오류 문구를 띄우지 않는다).
// 전역 이름은 wx 접두사(classic script 전역 공유).

const WX_LOCAL_ENOUGH = 3;        // 로컬 후보가 이만큼 있으면 원격 검색을 하지 않는다
const WX_SEARCH_DEBOUNCE_MS = 300;
const WX_TTL_MS = { symsearch: 30 * 60000, insights: 30 * 60000, options: 10 * 60000 };
// 200 이어도 모양이 다르면 이 라우트를 모르는 워커다.
const WX_SHAPE = {
  symsearch: (b) => !!b && Array.isArray(b.results),
  insights: (b) => !!b && Array.isArray(b.similar),
  options: (b) => !!b && Array.isArray(b.expiries),
};
const _wxOff = new Set();
const _wxCache = new Map();       // "route|value" → { at, body, job }
const _wxTimers = new Map();      // 디바운스 키 → timer

function wxCore() { return window.MirWorkerExtras || null; }
function wxBase() {
  return typeof LIVE_DATA_PROXY === "string" && LIVE_DATA_PROXY ? LIVE_DATA_PROXY.replace(/\/$/, "") : "";
}
function wxMarket() { return typeof isKrMarket === "function" && isKrMarket() ? "kr" : "us"; }
// 옛 워커 판정은 이 브라우저에 6시간 기억한다(페이지를 열 때마다 같은 404 를 콘솔에 남기지 않게). 워커를 다시
// 배포하면 늦어도 6시간 뒤에는 다시 확인한다. 저장소가 막혀 있으면 이번 방문 동안만(_wxOff).
const WX_OFF_TTL_MS = 6 * 3600000;
function wxOffKey(route) { return `mir.wx.off.${route}`; }
function wxMarkOff(route) {
  _wxOff.add(route);
  try { localStorage.setItem(wxOffKey(route), String(Date.now())); } catch (_) { /* 저장소 없음 */ }
}
function wxRouteOn(route) {
  if (!wxBase() || !wxCore() || _wxOff.has(route)) return false;
  try {
    const at = Number(localStorage.getItem(wxOffKey(route)));
    if (at && Date.now() - at < WX_OFF_TTL_MS) { _wxOff.add(route); return false; }
  } catch (_) { /* 저장소 없음 */ }
  return true;
}

// 응답 본문(정상) 또는 null. 404 not_found·모양 불일치면 라우트를 끈다. 실패는 캐시하지 않는다.
function wxGet(route, value) {
  if (!wxRouteOn(route)) return Promise.resolve(null);
  const key = `${route}|${value}`;
  const hit = _wxCache.get(key);
  if (hit && hit.job) return hit.job;
  if (hit && Date.now() - hit.at < WX_TTL_MS[route]) return Promise.resolve(hit.body);
  const job = fetch(`${wxBase()}/?${route}=${encodeURIComponent(value)}`, { cache: "no-store" })
    .then(async (r) => {
      let body = null;
      try { body = await r.json(); } catch (_) { body = null; }
      if (wxCore().isUnknownRoute(r.status, body)) { wxMarkOff(route); return null; }
      if (!r.ok) return null;
      if (!WX_SHAPE[route](body)) { wxMarkOff(route); return null; }
      return body;
    })
    .catch(() => null)
    .then((body) => {
      if (body) _wxCache.set(key, { at: Date.now(), body, job: null });
      else _wxCache.delete(key);
      return body;
    });
  _wxCache.set(key, { at: Date.now(), body: null, job });
  return job;
}

function wxCachedBody(route, value) {
  const hit = _wxCache.get(`${route}|${value}`);
  return hit && !hit.job && Date.now() - hit.at < WX_TTL_MS[route] ? hit.body : null;
}

// ── 원격 종목 검색 ───────────────────────────────────────────────────────────
function wxSearchKey(q) { return String(q || "").trim().toLowerCase(); }

// 받아 둔 원격 결과(현재 시장·로컬에 없는 것만). 아직 없으면 [].
function wxRemoteSearchCached(q, exclude) {
  const key = wxSearchKey(q);
  if (key.length < 2 || !wxRouteOn("symsearch")) return [];
  const body = wxCachedBody("symsearch", key);
  if (!body) return [];
  const ex = new Set([...(exclude || [])].map((t) => String(t).toUpperCase()));
  return (wxCore().parseSymSearch(body, wxMarket(), ex, 5) || [])
    // 이미 스냅샷에 있는 종목은 로컬 검색이 맡는다(같은 종목이 두 번 보이지 않게).
    .filter((h) => !(typeof stockByTicker === "function" && stockByTicker(h.ticker)));
}

// 로컬 후보가 적을 때만, 디바운스 뒤 원격을 받고 새 결과가 있으면 onReady() 를 부른다.
function wxMaybeRemoteSearch(slot, q, localCount, onReady) {
  const key = wxSearchKey(q);
  clearTimeout(_wxTimers.get(slot));
  if (key.length < 2 || localCount >= WX_LOCAL_ENOUGH || /[\s?]/.test(key) || !wxRouteOn("symsearch")) return;
  if (wxCachedBody("symsearch", key)) return;
  _wxTimers.set(slot, setTimeout(() => {
    wxGet("symsearch", key).then((body) => {
      if (body && Array.isArray(body.results) && body.results.length && typeof onReady === "function") onReady();
    });
  }, WX_SEARCH_DEBOUNCE_MS));
}

// 원격 후보를 고르면 기존 라이브 스텁 경로로 연다 — 이름·코스닥 여부만 스텁에 미리 실어 둔다.
function wxRegisterRemoteHit(hit) {
  if (!hit || !hit.ticker || typeof createLiveSearchStub !== "function") return;
  if (typeof stockByTicker === "function" && stockByTicker(hit.ticker)) return;
  if (typeof liveStubFor === "function" && liveStubFor(hit.ticker)) return;
  const stub = createLiveSearchStub(hit.ticker);
  if (!stub) return;
  if (hit.name) stub.company = hit.name;
  if (hit.kosdaq) stub.market = "kosdaq";
  liveStubs.set(stub.ticker, stub);
}

// 원격 후보의 화면 표기. 국내는 종목코드를 보이지 않는다(fmt.js 표기 규칙) — 이름만.
function wxHitLabel(hit) {
  return wxMarket() === "kr" ? (hit.name || "") : hit.ticker;
}

// ── 종목 상세: 비슷한 종목 · 지지/저항 ────────────────────────────────────────
function wxAsOf(iso) {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t) || typeof formatKstDateTime !== "function") return "";
  return formatKstDateTime(new Date(t)).slice(5);
}

function wxHide(host) {
  if (!host) return;
  host.hidden = true;
  host.innerHTML = "";
  delete host.dataset.wxKey;
}

function wxChipHtml(t) {
  const row = typeof stockByTicker === "function" ? stockByTicker(t) : null;
  const label = typeof stockLabel === "function" ? stockLabel(row || t) : t;
  const pct = row ? Number(row.changePct) : NaN;
  const chg = Number.isFinite(pct) && typeof fmtDailyPct === "function" ? ` <span class="${cls(pct)}">${escapeHtml(fmtDailyPct(pct))}</span>` : "";
  return `<button type="button" class="kt-chip wx-chip" data-wx-ticker="${escapeHtml(t)}">${escapeHtml(label)}${chg}</button>`;
}

function wxRenderInsights(item) {
  const host = byId("stockInsights");
  if (!host) return;
  const ticker = item && item.ticker ? String(item.ticker) : "";
  if (!ticker || !wxRouteOn("insights")) return wxHide(host);
  const market = wxMarket();
  const sym = typeof liveProxyTicker === "function" ? liveProxyTicker(item) : ticker;
  if (host.dataset.wxKey !== `${market}|${ticker}`) { host.hidden = true; host.innerHTML = ""; }
  wxGet("insights", sym).then((body) => {
    if (typeof selectedTicker !== "undefined" && String(selectedTicker) !== ticker) return;
    const p = body ? wxCore().parseInsights(body, market, ticker) : null;
    // 국내는 스냅샷에 있는 종목만 칩으로 — 코드만 있는 칩은 표기 규칙상 낼 수 없다.
    const similar = p ? p.similar.filter((t) => market !== "kr" || (typeof stockByTicker === "function" && stockByTicker(t))) : [];
    if (!p || (!similar.length && p.support == null && p.resistance == null)) return wxHide(host);
    const cfg = marketCfg();
    const lv = [];
    if (p.support != null) lv.push(`<div><dt>지지</dt><dd>${escapeHtml(cfg.formatPrice(p.support))}</dd></div>`);
    if (p.resistance != null) lv.push(`<div><dt>저항</dt><dd>${escapeHtml(cfg.formatPrice(p.resistance))}</dd></div>`);
    const asOf = wxAsOf(p.updatedAt);
    host.dataset.wxKey = `${market}|${ticker}`;
    host.hidden = false;
    host.innerHTML = `
      ${similar.length ? `<h3 class="kt-chips-title">비슷한 종목</h3><div class="kt-chips wx-chips">${similar.map(wxChipHtml).join("")}</div>` : ""}
      ${lv.length ? `<dl class="wx-levels">${lv.join("")}</dl>` : ""}
      ${asOf ? `<p class="sd-asof wx-asof">갱신 ${escapeHtml(asOf)}</p>` : ""}`;
    if (!host.dataset.wxBound) {
      host.dataset.wxBound = "1";
      host.addEventListener("click", (ev) => {
        const chip = ev.target.closest("[data-wx-ticker]");
        if (chip && typeof selectTicker === "function") selectTicker(chip.dataset.wxTicker);
      });
    }
  });
}

// ── 종목 상세: 옵션 요약(US) ──────────────────────────────────────────────────
// 발행 스냅샷(data/options_stats.js, 시총 상위 ~76종목 · 가장 가까운 만기)에 있는 종목은 스냅샷 값을 쓰고
// 워커를 부르지 않는다. 스냅샷에 없는 종목만 ?options= 로 라이브 체인을 받는다.
function wxOptionsHtml(o) {
  const cfg = marketCfg();
  const f2 = (v) => Number(v).toFixed(2);
  const n0 = (v) => Math.round(Number(v)).toLocaleString();
  const rows = o.expiries.map((e) => {
    const cells = [];
    const cell = (k, v) => cells.push(`<div><dt>${k}</dt><dd>${v}</dd></div>`);
    if (e.putCallVolume != null) cell("풋/콜 거래량", f2(e.putCallVolume));
    if (e.putCallOI != null) cell("풋/콜 미결제", f2(e.putCallOI));
    if (e.maxPain != null) cell("맥스페인", escapeHtml(cfg.formatPrice(e.maxPain)));
    if (e.atmIV != null) cell("ATM IV", `${Number(e.atmIV).toFixed(1)}%`);
    if (e.expectedMovePct != null) cell("예상 변동폭", `±${Number(e.expectedMovePct).toFixed(1)}%${e.straddle != null ? ` <span class="muted">(±${escapeHtml(cfg.formatPrice(e.straddle))})</span>` : ""}`);
    const oi = e.topOI.length ? `<ol class="wx-oi">${e.topOI.map((r) => `<li><b>${escapeHtml(cfg.formatPrice(r.strike))}</b><span>콜 ${n0(r.callOI)}</span><span>풋 ${n0(r.putOI)}</span></li>`).join("")}</ol>` : "";
    const dte = e.daysToExpiry != null ? ` <span class="muted">D-${e.daysToExpiry}</span>` : "";
    return `<div class="wx-opt-exp">
        <h4>만기 ${escapeHtml(e.expiry)}${dte}</h4>
        ${cells.length ? `<dl class="wx-grid">${cells.join("")}</dl>` : ""}
        ${oi ? `<p class="wx-sub">미결제약정 상위 행사가</p>${oi}` : ""}
      </div>`;
  }).join("");
  const asOf = o.updatedAtKst || wxAsOf(o.updatedAt);
  return `<div class="qi-head"><h3>옵션 요약</h3>${asOf ? `<span>갱신 ${escapeHtml(asOf)}</span>` : ""}</div>${rows}`;
}

function wxRenderOptions(item) {
  const host = byId("stockOptionsCard");
  if (!host) return;
  const ticker = item && item.ticker ? String(item.ticker).toUpperCase() : "";
  if (!ticker || wxMarket() === "kr" || !wxCore()) return wxHide(host);
  // 스냅샷이 아직 안 왔으면 먼저 받는다(그 사이 같은 종목을 워커로 중복 조회하지 않게).
  if (!window.OPTIONS_STATS && typeof ensureFeatureData === "function" && !wxRenderOptions._asked) {
    wxRenderOptions._asked = true;
    wxHide(host);
    ensureFeatureData("optionsStats").finally(() => {
      if (typeof selectedTicker !== "undefined" && String(selectedTicker).toUpperCase() === ticker) wxRenderOptions(item);
    });
    return;
  }
  const show = (o, key) => {
    if (typeof selectedTicker !== "undefined" && String(selectedTicker).toUpperCase() !== ticker) return;
    if (!o) return wxHide(host);
    if (host.dataset.wxKey === key && !host.hidden) return;
    host.dataset.wxKey = key;
    host.hidden = false;
    host.innerHTML = wxOptionsHtml(o);
  };
  const os = window.OPTIONS_STATS;
  const row = os && os.stocks ? os.stocks[ticker] : null;
  if (row) return show(wxCore().optionsFromSnapshot(row, os.updatedAtKst), `snap|${ticker}|${os.updatedAtKst || ""}`);
  if (!wxRouteOn("options")) return wxHide(host);
  if (host.dataset.wxKey && !host.dataset.wxKey.endsWith(`|${ticker}`)) wxHide(host);
  const sym = typeof liveProxyTicker === "function" ? liveProxyTicker(item) : ticker;
  wxGet("options", sym).then((body) => show(body ? wxCore().parseOptions(body) : null, `live|${ticker}`));
}

// app.js 종목 렌더 파이프라인(renderPriceTargets 다음)이 부른다.
function renderWorkerExtras(item) {
  wxRenderInsights(item);
  wxRenderOptions(item);
}
