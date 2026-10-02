// live-quote.js — 종목 분석 왼쪽 요약의 '현재' 한 줄(2026-10-02).
// 계산은 live-quote-core.js(window.MirLiveQuote). 여기는 받기·캐시·그리기.
// 모든 종목을 실시간으로 받으면 사이트가 느려지므로, 종목 분석을 연 그 종목만 워커 분봉 경로
// (?intraday=1&interval=1m, 엣지 캐시 60초)에서 받는다. 열려 있는 동안 60초마다 다시 받고, 다른 종목으로
// 가거나 탭이 숨겨지면 멈춘다. 장 마감 기준 가격·등락률(스냅샷) 줄은 그대로 두고 그 아래에 더한다.
// 전역 이름은 lq 접두사(classic script 전역 공유).

const LQ_REFRESH_MS = 60000;
const _lq = {};      // 야후 심볼 → { status: loading|ok|error, at, payload }
let _lqTimer = 0;
let _lqTicker = "";

function lqSymbol(item) {
  return typeof liveProxyTicker === "function" ? liveProxyTicker(item) : String(item.ticker || "");
}

// 거래소 현지 지금 "YYYY-MM-DDTHH:MM" (분봉 시각과 같은 형식).
function lqNowLocal(tz) {
  try {
    const p = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  } catch (e) {
    return "";
  }
}

function lqFetch(item) {
  const sym = lqSymbol(item);
  const cur = _lq[sym];
  if (cur && (cur.status === "loading" || Date.now() - cur.at < LQ_REFRESH_MS - 2000)) return;
  _lq[sym] = { status: "loading", at: Date.now(), payload: cur && cur.payload };
  const url = `${LIVE_DATA_PROXY.replace(/\/$/, "")}/?intraday=1&ticker=${encodeURIComponent(sym)}&interval=1m`;
  fetch(url, { cache: "no-store" }).then((r) => r.json()).then((d) => {
    if (!d || !Array.isArray(d.bars)) throw new Error("no bars");
    _lq[sym] = { status: "ok", at: Date.now(), payload: d };
  }).catch(() => {
    _lq[sym] = { status: "error", at: Date.now(), payload: cur && cur.payload };
  }).finally(() => lqUpdateDom(item));
}

function lqResult(item) {
  const st = _lq[lqSymbol(item)];
  if (!st || !st.payload) return { st, r: null };
  const d = st.payload;
  const tz = d.tz || (typeof isKrMarket === "function" && isKrMarket() ? "Asia/Seoul" : "America/New_York");
  const r = window.MirLiveQuote.computeLiveQuote({
    bars: d.bars, quote: d.quote || null,
    snapPrice: item.price, snapDate: item.priceDate,
    nowLocal: lqNowLocal(tz), market: typeof isKrMarket === "function" && isKrMarket() ? "kr" : "us",
  });
  return { st, r };
}

function lqTimeText(r) {
  const t = String(r.time || "");
  // 분봉 시각은 현지 "YYYY-MM-DDTHH:MM", 워커 quote 는 ISO(UTC) — KST 로 보여 준다.
  if (/Z$|[+-]\d\d:?\d\d$/.test(t) && typeof formatKstDateTime === "function") return formatKstDateTime(new Date(t)).slice(11, 16);
  return t.slice(11, 16);
}

function lqBodyHtml(item) {
  const { st, r } = lqResult(item);
  if (!r) {
    if (st && st.status === "error") return '<span class="muted">현재가를 받지 못했습니다</span>';
    return '<span class="muted">현재가 확인 중…</span>';
  }
  if (r.state === "none") return '<span class="muted">현재가 데이터 없음</span>';
  const cfg = marketCfg();
  if (r.state === "nosession") {
    return `<span class="sd-live-label">현재</span><span class="muted">새 거래 없음 — 위 종가가 최신(정규장 전·휴장)</span>`;
  }
  const pct = Number(r.changePct);
  const chg = Number(r.change);
  const arrow = chg > 0 ? "▲" : chg < 0 ? "▼" : "";
  const abs = Number.isFinite(chg) ? `${arrow}${escapeHtml(cfg.formatPrice(Math.abs(chg)))} ` : "";
  // 위 장 마감 줄(stockChangeHtml)과 같은 모양: ▲500원 (+0.18%)
  const pctText = Number.isFinite(pct) ? `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%` : "";
  const pctHtml = Number.isFinite(pct) ? `<span class="${cls(pct)}">${abs}(${pctText})</span>` : "";
  const stateText = r.state === "live" ? "장중" : "오늘 장 마감(잠정)";
  const src = r.source === "naver" ? "네이버 실시간" : r.source === "yahoo" ? "야후 실시간" : (r.delayed ? `야후 · 약 ${r.delayed}분 지연` : "야후 · 1분 단위");
  return `<span class="sd-live-label">현재</span><b class="sd-live-price">${escapeHtml(cfg.formatPrice(r.price))}</b> ${pctHtml}`
    + `<span class="sd-asof">${escapeHtml([lqTimeText(r), stateText, src].filter(Boolean).join(" · "))}</span>`;
}

function lqUpdateDom(item) {
  const el = byId("sdLiveQuote");
  if (el && el.dataset.lq === String(item.ticker)) el.innerHTML = lqBodyHtml(item);
}

// 종목이 열려 있는 동안 60초마다 다시 받는다. 다른 종목을 열면 그 종목으로 바뀐다.
function lqSchedule(item) {
  if (_lqTicker === item.ticker && _lqTimer) return;
  if (_lqTimer) clearInterval(_lqTimer);
  _lqTicker = item.ticker;
  _lqTimer = setInterval(() => {
    const open = typeof selectedTicker !== "undefined" && selectedTicker === _lqTicker && byId("sdLiveQuote");
    if (!open) { clearInterval(_lqTimer); _lqTimer = 0; _lqTicker = ""; return; }
    if (document.hidden) return;
    lqFetch(item);
  }, LQ_REFRESH_MS);
}

// stockSummaryHtml 이 가격·등락(장 마감) 줄 바로 아래에 넣는다.
function liveQuoteLineHtml(item) {
  if (!LIVE_DATA_PROXY || !item || !item.ticker || !window.MirLiveQuote) return "";
  lqFetch(item);
  lqSchedule(item);
  return `<p class="sd-live" id="sdLiveQuote" data-lq="${escapeHtml(String(item.ticker))}" title="종목 분석을 연 동안 1분마다 갱신 · 등락은 전 거래일 종가 대비">${lqBodyHtml(item)}</p>`;
}
