// move-reasons.js — 종목 분석 왼쪽 요약의 '주가 움직임 이유' 버튼(2026-10-22)
// =====================================================
// 누르면 워커 ?move_reasons=<심볼> 을 부른다(소셜 먼저 → 뉴스 대조, worker/yahoo-proxy.js handleMoveReasons).
// 뉴스와 맞는 이유는 강조('뉴스 확인'), 소셜에만 있는 이유는 '소셜에서는 이런 의견도 있어요'로 흐리게 보여 준다.
// 워커는 머지해도 배포되지 않는다 — 옛 워커는 이 경로를 404 not_found 로 답하므로 worker-extras.js 의 wxMarkOff 로
// 6시간 끄고 버튼을 숨긴다. 결과는 종목별로 이번 방문 동안 30분 기억한다(워커 KV 캐시도 30분).
// 전역 이름은 mr 접두사(classic script 전역 공유).

const MR_ROUTE = "move_reasons";
const MR_TTL_MS = 30 * 60000;
const _mr = new Map();   // ticker → { status: loading|ok|error|off, at, data }

function mrAvailable() {
  if (typeof LIVE_DATA_PROXY !== "string" || !LIVE_DATA_PROXY || !window.MirMoveReasonsCore) return false;
  return typeof wxRouteOn === "function" ? wxRouteOn(MR_ROUTE) : true;
}

// stockSummaryHtml 이 가격 줄들 아래에 넣는다.
function moveReasonsHtml(item) {
  if (!item || !item.ticker || item.__liveStub || !mrAvailable()) return "";
  return `<div class="mr-wrap" id="moveReasons" data-mr="${escapeHtml(String(item.ticker))}">
      <button type="button" class="mr-btn" data-mr-go>주가 움직임 이유</button>
      <div class="mr-body" id="moveReasonsBody">${mrBodyHtml(item)}</div>
    </div>`;
}

function mrBodyHtml(item) {
  const st = _mr.get(item.ticker);
  if (!st) return "";
  if (st.status === "loading") return '<p class="muted mr-status">소셜과 뉴스를 확인하는 중…</p>';
  if (st.status === "off") return '<p class="muted mr-status">아직 사용할 수 없습니다.</p>';
  if (st.status === "error" || !st.data) return '<p class="muted mr-status">이유를 가져오지 못했습니다. 잠시 후 다시 눌러 주세요.</p>';
  return mrResultHtml(st.data);
}

function mrResultHtml(r) {
  const core = window.MirMoveReasonsCore;
  const status = [];
  if (r.socialFailed) status.push("일부 소셜 데이터를 받지 못했습니다");
  const head = `<p class="muted mr-status">${escapeHtml([r.date ? `${r.date} 기준` : "", `소셜 ${r.socialCount}건`, `뉴스 ${r.newsCount}건`, ...status].filter(Boolean).join(" · "))}</p>`;
  if (!core.hasAny(r)) return `${head}<p class="mr-none">뚜렷한 이유를 찾지 못했어요.</p>`;
  const newsLinks = (list) => `<ul class="mr-news">${list.map((n) => `<li><a href="${escapeHtml(safeHttpHref(n.link))}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a>${n.publisher ? ` <span class="muted">${escapeHtml(n.publisher)}</span>` : ""}</li>`).join("")}</ul>`;
  const socialLinks = (list) => list.length ? `<ul class="mr-social">${list.map((s) => `<li>${s.url ? `<a href="${escapeHtml(safeHttpHref(s.url))}" target="_blank" rel="noopener">${escapeHtml(s.text)}</a>` : escapeHtml(s.text)}${s.source ? ` <span class="muted">${escapeHtml(s.source)}</span>` : ""}</li>`).join("")}</ul>` : "";
  const confirmed = r.confirmed.map((c) => `<li class="mr-item is-confirmed">
      <div class="mr-claim"><span class="mr-badge is-confirmed">뉴스 확인</span><strong>${escapeHtml(c.claim)}</strong></div>
      <div class="mr-meta muted">소셜 언급 ${c.socialCount}건</div>
      ${newsLinks(c.news)}
    </li>`).join("");
  const newsOnly = r.newsOnly.map((c) => `<li class="mr-item is-news">
      <div class="mr-claim"><span class="mr-badge is-news">뉴스</span><strong>${escapeHtml(c.claim)}</strong></div>
      ${newsLinks(c.news)}
    </li>`).join("");
  const social = r.socialOnly.map((c) => `<li class="mr-item is-social">
      <div class="mr-claim"><span class="mr-badge is-social">미확인</span><span>${escapeHtml(c.claim)}</span></div>
      <div class="mr-meta muted">소셜 언급 ${c.socialCount}건</div>
      ${socialLinks(c.samples)}
    </li>`).join("");
  return `${head}
    ${confirmed || newsOnly ? `<h4 class="mr-sub">뉴스로 확인된 이유</h4><ul class="mr-list">${confirmed}${newsOnly}</ul>` : ""}
    ${social ? `<h4 class="mr-sub is-social">소셜에서는 이런 의견도 있어요</h4><ul class="mr-list">${social}</ul>` : ""}`;
}

function mrUpdate(ticker) {
  const el = byId("moveReasons");
  if (!el || el.dataset.mr !== String(ticker)) return;
  const body = byId("moveReasonsBody");
  const item = { ticker };
  if (body) body.innerHTML = mrBodyHtml(item);
  const btn = el.querySelector("[data-mr-go]");
  const st = _mr.get(ticker);
  if (btn) {
    btn.disabled = !!st && st.status === "loading";
    if (st && st.status === "off") btn.hidden = true;
  }
}

function mrFetch(item) {
  const ticker = item.ticker;
  const cur = _mr.get(ticker);
  if (cur && (cur.status === "loading" || (cur.status === "ok" && Date.now() - cur.at < MR_TTL_MS))) { mrUpdate(ticker); return; }
  _mr.set(ticker, { status: "loading", at: Date.now() });
  mrUpdate(ticker);
  const sym = typeof liveProxyTicker === "function" ? liveProxyTicker(item) : ticker;
  fetch(`${LIVE_DATA_PROXY.replace(/\/$/, "")}/?${MR_ROUTE}=${encodeURIComponent(sym)}`, { cache: "no-store" })
    .then(async (r) => {
      let body = null;
      try { body = await r.json(); } catch (_) { body = null; }
      if (r.status === 404 && body && body.error === "not_found") {
        if (typeof wxMarkOff === "function") wxMarkOff(MR_ROUTE);
        _mr.set(ticker, { status: "off", at: Date.now() });
        return;
      }
      const data = r.ok ? window.MirMoveReasonsCore.normalize(body) : null;
      _mr.set(ticker, data ? { status: "ok", at: Date.now(), data } : { status: "error", at: Date.now() });
    })
    .catch(() => _mr.set(ticker, { status: "error", at: Date.now() }))
    .finally(() => mrUpdate(ticker));
}

// 버튼은 종목 요약을 다시 그릴 때마다 새로 생기므로 문서에서 한 번만 받는다.
document.addEventListener("click", (e) => {
  const btn = e.target && e.target.closest && e.target.closest("[data-mr-go]");
  if (!btn) return;
  const wrap = btn.closest("#moveReasons");
  const ticker = wrap && wrap.dataset.mr;
  if (!ticker) return;
  const item = (typeof stockByTicker === "function" && stockByTicker(ticker)) || { ticker };
  mrFetch(item);
});
