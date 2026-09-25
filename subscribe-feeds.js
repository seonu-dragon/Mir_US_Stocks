// 구독 피드 다이얼로그 — 캘린더(.ics)·공시 RSS 를 구글 캘린더/webcal/RSS 리더에 등록하게 돕는다.
//
// 피드 파일은 레포에 없다. deploy-pages.yml 이 배포 때 scripts/gen_feeds.py 로 _site/data/feeds/
// 아래에 만든다(매니페스트 data/feeds/feeds.json). 로컬에서 보려면
//   py scripts/gen_feeds.py      → data/feeds/ 생성(.gitignore)
// 매니페스트가 없으면 다이얼로그는 '배포된 사이트에서 제공' 안내만 띄운다(가짜 목록을 만들지 않는다).
// 버튼: [data-feed-subscribe="calendar"|"disclosures"] — 오늘 › 캘린더, 종목 › 공시에 있다.
// 외부 발신(푸시·텔레그램 등)은 하지 않는다. 구독 앱이 이 정적 파일을 주기적으로 다시 받아 갈 뿐이다.
(function () {
  "use strict";
  const MANIFEST_URL = "data/feeds/feeds.json";
  let manifestPromise = null;
  let lastFocus = "calendar";

  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function marketMode() {
    try { return window.MirMarket?.getMode?.() === "kr" ? "kr" : "us"; } catch (_) { return "us"; }
  }

  function absUrl(path) {
    try { return new URL(path, window.location.href).href; } catch (_) { return path; }
  }
  const webcalUrl = (abs) => abs.replace(/^https?:/i, "webcal:");
  const googleCalUrl = (abs) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(abs))}`;

  function loadManifest(force) {
    if (!manifestPromise || force) {
      // /data/ 는 sw.js 가 network-first 로 다룬다. 여기서도 매번 새로 받는다.
      manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return manifestPromise;
  }

  function copyText(text, btn) {
    const done = () => {
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = "복사됨 ✓";
      btn.classList.add("is-done");
      setTimeout(() => { btn.textContent = prev; btn.classList.remove("is-done"); }, 1600);
    };
    const fallback = () => { window.prompt("URL 을 복사하세요", text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  const MARKET_LABEL = { us: "미국", kr: "국내", all: "한·미 공통" };

  function marketOrder(rows, mode) {
    const rank = (m) => (m === mode ? 0 : m === "all" ? 1 : 2);
    return rows.slice().sort((a, b) => rank(a.market) - rank(b.market));
  }

  function calendarCard(c) {
    const abs = absUrl(c.path);
    return `
      <article class="feed-sub-card" data-feed-id="${esc(c.id)}">
        <div class="feed-sub-card-head">
          <strong>${esc(c.title)}</strong>
          <span class="feed-sub-badge">${esc(MARKET_LABEL[c.market] || c.market)}</span>
        </div>
        <p>${esc(c.desc)} · 현재 ${Number(c.count || 0).toLocaleString()}건</p>
        <div class="feed-sub-actions">
          <a class="ghost compact-btn" href="${esc(googleCalUrl(abs))}" target="_blank" rel="noopener">구글 캘린더에 추가</a>
          <a class="ghost compact-btn" href="${esc(webcalUrl(abs))}">애플·아웃룩 (webcal)</a>
          <button type="button" class="ghost compact-btn" data-feed-copy="${esc(abs)}">URL 복사</button>
        </div>
        <code class="feed-sub-url">${esc(abs)}</code>
      </article>`;
  }

  function rssCard(r) {
    const abs = absUrl(r.path);
    return `
      <article class="feed-sub-card" data-feed-id="${esc(r.id)}">
        <div class="feed-sub-card-head">
          <strong>${esc(r.title)}</strong>
          <span class="feed-sub-badge">${esc(MARKET_LABEL[r.market] || r.market)}</span>
        </div>
        <p>${esc(r.desc)} · 현재 ${Number(r.count || 0).toLocaleString()}건</p>
        <div class="feed-sub-actions">
          <button type="button" class="ghost compact-btn" data-feed-copy="${esc(abs)}">RSS URL 복사</button>
          <a class="ghost compact-btn" href="${esc(abs)}" target="_blank" rel="noopener">피드 열기</a>
        </div>
        <code class="feed-sub-url">${esc(abs)}</code>
      </article>`;
  }

  function tickerLabel(t, market) {
    // 국내는 회사명만(코드는 보조로도 내지 않는다 — 국내 표기 규약).
    return market === "kr" ? (t.company || t.ticker) : `${t.ticker} · ${t.company || ""}`;
  }

  function tickerBlock(manifest, mode) {
    const list = (manifest.tickers && manifest.tickers[mode]) || [];
    if (!list.length) return "";
    const opts = list.map((t, i) => `<option value="${i}">${esc(tickerLabel(t, mode))}</option>`).join("");
    return `
      <section class="feed-sub-section">
        <h3>종목별 공시 RSS <small>${esc(MARKET_LABEL[mode])} 시가총액 상위 ${list.length}종목</small></h3>
        <p class="feed-sub-note">정적 사이트라 관심종목마다 피드를 만들 수는 없어, 시가총액 상위 종목만 제공합니다.
          ${mode === "kr" ? "DART 공시 전체(최근 7일 수집분 누적)" : "SEC 8-K 전체·13D/13G"}가 들어갑니다.</p>
        <div class="feed-sub-ticker">
          <label>종목 <select id="feedSubTickerSelect" data-market="${esc(mode)}">${opts}</select></label>
          <button type="button" class="ghost compact-btn" id="feedSubTickerCopy">RSS URL 복사</button>
          <a class="ghost compact-btn" id="feedSubTickerOpen" href="#" target="_blank" rel="noopener">피드 열기</a>
        </div>
        <code class="feed-sub-url" id="feedSubTickerUrl"></code>
      </section>`;
  }

  function bindTicker(manifest) {
    const sel = document.getElementById("feedSubTickerSelect");
    if (!sel) return;
    const list = manifest.tickers[sel.dataset.market] || [];
    const sync = () => {
      const t = list[Number(sel.value)] || list[0];
      if (!t) return;
      const abs = absUrl(t.path);
      document.getElementById("feedSubTickerUrl").textContent = `${abs}  (현재 ${t.count}건)`;
      document.getElementById("feedSubTickerOpen").href = abs;
      document.getElementById("feedSubTickerCopy").dataset.feedCopy = abs;
    };
    // 지금 보고 있는 종목(분석 화면 ?t= 또는 마지막 조회 종목)이 목록에 있으면 먼저 고른다.
    // eslint-disable-next-line no-undef
    const sel0 = typeof selectedTicker !== "undefined" ? selectedTicker : ""; // app.js 전역(let)
    const cur = String(sel0 || new URLSearchParams(window.location.search).get("ticker") || "").toUpperCase();
    const idx = list.findIndex((t) => String(t.ticker).toUpperCase() === cur);
    if (idx >= 0) sel.value = String(idx);
    sel.addEventListener("change", sync);
    sync();
  }

  function renderBody(manifest, focus) {
    const body = document.getElementById("feedSubBody");
    if (!body) return;
    if (!manifest || !Array.isArray(manifest.calendars)) {
      body.innerHTML = `
        <div class="feed-sub-empty">
          <strong>구독 피드를 불러오지 못했습니다.</strong>
          <p>피드는 배포된 사이트(GitHub Pages)에서 배포할 때마다 새로 만들어집니다. 잠시 뒤 다시 열어 보세요.
            로컬 서버에서는 <code>py scripts/gen_feeds.py</code> 로 먼저 생성해야 보입니다.</p>
        </div>`;
      return;
    }
    const mode = marketMode();
    const cals = marketOrder(manifest.calendars, mode).map(calendarCard).join("");
    const rss = marketOrder(manifest.rss || [], mode).map(rssCard).join("");
    const calSection = `
      <section class="feed-sub-section" id="feedSubCalendars">
        <h3>캘린더 구독 <small>.ics</small></h3>
        <p class="feed-sub-note">구독하면 캘린더 앱이 이 파일을 주기적으로 다시 받아 일정이 저절로 바뀝니다.
          구글 캘린더는 반영까지 최대 하루가 걸릴 수 있고, 휴대폰 앱에서는 '구글 캘린더에 추가'가 열리지 않으면
          PC 웹에서 추가하세요(다른 캘린더 추가 › URL로 추가). 과거 ${esc(manifest.windowDays?.past ?? 7)}일 ~ 미래
          ${esc(manifest.windowDays?.future ?? 90)}일 일정만 담습니다.</p>
        <div class="feed-sub-grid">${cals}</div>
      </section>`;
    const rssSection = `
      <section class="feed-sub-section" id="feedSubRss">
        <h3>공시 RSS 구독</h3>
        <p class="feed-sub-note">RSS URL 을 Feedly·Inoreader·NetNewsWire 같은 RSS 리더(또는 슬랙·디스코드의 RSS 봇)에 붙여 넣으면
          새 공시가 올라올 때 리더가 알려 줍니다. 수집 주기는 원본 워크플로우를 따라 하루 몇 번이며 실시간이 아닙니다.</p>
        <div class="feed-sub-grid">${rss}</div>
      </section>
      ${tickerBlock(manifest, mode)}`;
    body.innerHTML = `
      <p class="feed-sub-meta">기준 시각 ${esc(manifest.generatedAtKst || "확인 불가")} · 출처는 각 일정·공시 설명에 적혀 있습니다(Yahoo Finance·SEC EDGAR·DART·연준·investing.com·38커뮤니케이션).
        공시·일정 사실을 알리는 정보이며 투자 권유가 아닙니다.</p>
      ${focus === "disclosures" ? rssSection + calSection : calSection + rssSection}`;
    bindTicker(manifest);
  }

  function ensureDialog() {
    let dlg = document.getElementById("feedSubscribeDialog");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "feedSubscribeDialog";
    dlg.className = "ia-trust-dialog feed-sub-dialog";
    dlg.setAttribute("aria-labelledby", "feedSubTitle");
    dlg.innerHTML = `
      <section class="data-trust-center feed-sub-center">
        <div class="data-trust-head">
          <div>
            <h2 id="feedSubTitle">일정·공시 구독</h2>
            <p>캘린더 앱과 RSS 리더로 받아 보는 정적 피드입니다. 가입·알림 권한이 필요 없습니다.</p>
          </div>
          <div class="ia-dialog-actions"><button type="button" class="ghost compact-btn" id="feedSubClose" aria-label="닫기">✕ 닫기</button></div>
        </div>
        <div id="feedSubBody" aria-live="polite"><p class="muted">구독 피드 목록을 불러오는 중…</p></div>
      </section>`;
    document.body.appendChild(dlg);
    dlg.querySelector("#feedSubClose").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) { dlg.close(); return; }
      const copyBtn = e.target.closest("[data-feed-copy]");
      if (copyBtn) copyText(copyBtn.dataset.feedCopy, copyBtn);
    });
    return dlg;
  }

  function openFeedSubscribe(focus) {
    lastFocus = focus === "disclosures" ? "disclosures" : "calendar";
    const dlg = ensureDialog();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    }
    // 여는 버튼에 맞는 절(캘린더/공시)을 위로 올려 그린다. 스크롤 이동은 하지 않는다 — 머리글(닫기)이 가려진다.
    loadManifest(true).then((m) => renderBody(m, lastFocus));
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("[data-feed-subscribe]");
    if (!btn) return;
    e.preventDefault();
    openFeedSubscribe(btn.dataset.feedSubscribe);
  });

  window.MirFeeds = { open: openFeedSubscribe, loadManifest };
})();
