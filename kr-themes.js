// kr-themes.js — 국내 테마 분류(사업보고서 근거 문장) · 테마 등락 · 종목의 테마 칩
// ====================================================================================
// 클래식 스크립트(모듈 아님). 계산은 kr-themes-core.js(window.MirKrThemesCore)에 있다.
// 화면: 시장 탭 › '테마' 잎(#tab-krtheme, 국내 전용 — US 는 hiddenTabs·features.krThemes 로 숨김)
//      종목 분석 좌측 '이 종목의 테마' 칩(#stockThemes) — 칩을 누르면 근거 문장·출처가 펼쳐진다.
// 데이터: window.KR_THEMES(lazy, scripts/build_kr_themes.py), 근거 문장은 테마별 data/korea/themes/<id>.json 을
//        펼칠 때만 fetch 한다(전 종목이 채워지면 문장만 수 MB).
// 편입 기준은 DART 사업보고서 'II. 사업의 내용' 원문 문장 — 규칙(키워드+자기 지칭+활동어)으로 편입하거나,
// 애매한 문장만 Gemini 가 판정한 것('AI 판정' 표시). 테마 등락은 스냅샷 종가 기준이다. 매매 추천이 아니다.
// 이름은 kt* 로 전역 충돌을 피한다(scripts/check_global_name_collisions.py).

const KT_VIEW = { period: "d", weight: "eq", sel: null, group: "" };
const KT_PERIODS = [["d", "오늘"], ["w", "1주"], ["m", "1개월"]];
const KT_WEIGHTS = [["eq", "동일가중"], ["cap", "시총가중"]];
const KT_RANK_MIN = 2;     // 순위 카드는 편입 2종목 이상 테마만(한 종목이면 개별 종목 등락이다)
const _ktEvCache = {};

function ktCore() { return window.MirKrThemesCore || null; }
function ktOff() { return typeof featureOff === "function" ? featureOff("krThemes") : !isKrMarket(); }

function ktStockMap() {
  const map = {};
  const rows = (typeof data !== "undefined" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  rows.forEach((s) => { if (s && s.ticker) map[String(s.ticker)] = s; });
  return map;
}

// 테마 근거 파일(<id>.json) — 인덱스의 테마 v(내용 해시)를 ?v= 로 붙여 바뀐 파일만 새로 받는다.
function ktLoadEvidence(theme) {
  if (!theme) return Promise.resolve({});
  const url = `data/korea/themes/${encodeURIComponent(theme.id)}.json${theme.v ? `?v=${encodeURIComponent(theme.v)}` : ""}`;
  if (!_ktEvCache[url]) {
    _ktEvCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => (body && body.ev) || {})
      .catch(() => { delete _ktEvCache[url]; return null; });
  }
  return _ktEvCache[url];
}

function ktTheme(id) {
  const P = window.KR_THEMES;
  return P && Array.isArray(P.themes) ? P.themes.find((t) => t.id === id) || null : null;
}

// KR 스냅샷 시총은 조 원 단위(marketCapT = marketCapB).
function ktCap(s) {
  const v = Number(s && (s.marketCapT ?? s.marketCapB));
  if (!Number.isFinite(v) || v <= 0) return "—";
  return v >= 1 ? `${v >= 100 ? Math.round(v).toLocaleString("ko-KR") : v.toFixed(1)}조` : `${Math.round(v * 10000).toLocaleString("ko-KR")}억`;
}

function ktPct(v) {
  const C = ktCore();
  return `<span class="${C.tone(v)}">${C.fmtPct(v)}</span>`;
}

function ktSeg(key, options, current) {
  return `<div class="segmented kt-seg" role="group">${options.map(([v, label]) => `
    <button type="button" data-kt="${key}:${v}" class="${v === current ? "is-active" : ""}" aria-pressed="${v === current}">${label}</button>`).join("")}</div>`;
}

function ktEvidenceHtml(ev, kw, cut) {
  const [a, k, b] = ktCore().evidenceParts(ev, kw, cut);
  return `${escapeHtml(a)}${k ? `<mark>${escapeHtml(k)}</mark>` : ""}${escapeHtml(b)}`;
}

function ktSourceHtml(ticker) {
  const P = window.KR_THEMES || {};
  const rep = (P.reports || {})[ticker];
  if (!rep) return "";
  const url = ktCore().dartUrl(rep[0]);
  const label = `${rep[1] || "사업보고서"}${rep[2] ? ` · ${rep[2]} 접수` : ""}`;
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="접수번호 ${escapeHtml(rep[0])} — DART 원문">${escapeHtml(label)}</a>`
    : escapeHtml(label);
}

function ktByBadge(by) {
  return by === "llm"
    ? '<span class="kt-by kt-by-llm" title="규칙만으로는 애매해 Gemini(flash-lite)가 이 문장을 판정했습니다. 문장 자체는 원문 그대로입니다.">AI 판정</span>'
    : '<span class="kt-by" title="테마 키워드 + 자기 지칭(당사·회사 등) + 사업 활동어가 한 문장에 있어 규칙으로 편입했습니다.">규칙</span>';
}

// 사업보고서가 연결 자회사의 사업으로 적은 문장(지주회사·대기업)으로 편입된 경우.
function ktSubBadge(sub) {
  return sub
    ? '<span class="kt-by kt-by-sub" title="근거 문장이 모회사가 아니라 연결 자회사·계열회사의 사업을 설명합니다(사업보고서는 연결 기준으로 적습니다).">자회사 사업</span>'
    : "";
}

function ktWriteUrl(id) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "krtheme");
    if (id) url.searchParams.set("theme", id);
    else url.searchParams.delete("theme");
    history.replaceState(history.state, "", url.toString());
  } catch (_) { /* history 차단 환경 */ }
}

// ------------------------------------------------------------------ 시장 탭 '테마'
function renderKrThemes() {
  const host = byId("krThemeMarket");
  if (!host) return;
  if (ktOff() || !isKrMarket() || !ktCore()) {
    host.innerHTML = "";
    return;
  }
  const P = window.KR_THEMES;
  if (!P) {
    host.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>';
    ensureFeatureData("krThemes").then((ok) => {
      if (ok) renderKrThemes();
      else host.innerHTML = '<p class="muted">테마 데이터를 불러오지 못했습니다.</p>';
    });
    return;
  }
  if (!host.dataset.ktInit) {
    host.dataset.ktInit = "1";
    const q = new URLSearchParams(window.location.search).get("theme");
    if (q && ktTheme(q)) KT_VIEW.sel = q;
  }
  if (!host.dataset.ktBound) {
    host.dataset.ktBound = "1";
    host.addEventListener("click", ktOnClick);
  }
  const C = ktCore();
  const cov = P.coverage || {};
  if (!Number(P.count)) {
    host.innerHTML = `<section class="kt-card"><p class="muted">아직 편입된 종목이 없습니다. 사업보고서 원문을 시가총액 순으로 매주 읽어 채웁니다
      (원문 확인 ${Number(cov.processed || 0).toLocaleString("ko-KR")} / ${Number(cov.universe || 0).toLocaleString("ko-KR")}종목).</p></section>`;
    return;
  }
  const stats = C.themeStats(P.themes, ktStockMap());
  const withMembers = stats.filter((s) => s.n > 0);
  const empty = stats.length - withMembers.length;
  const groups = C.groups(P.themes);
  const inGroup = (s) => !KT_VIEW.group || s.group === KT_VIEW.group;
  const ranked = C.rankThemes(withMembers.filter(inGroup), KT_VIEW.period, KT_VIEW.weight, 0);
  const rankPool = C.rankThemes(withMembers, KT_VIEW.period, KT_VIEW.weight, KT_RANK_MIN)
    .filter((s) => C.statValue(s, KT_VIEW.period, KT_VIEW.weight) != null);
  const periodLabel = (KT_PERIODS.find(([k]) => k === KT_VIEW.period) || [])[1] || "";
  const weightLabel = (KT_WEIGHTS.find(([k]) => k === KT_VIEW.weight) || [])[1] || "";
  const rankItem = (s, i) => {
    const v = C.statValue(s, KT_VIEW.period, KT_VIEW.weight);
    return `<li><button type="button" class="kt-rank-item" data-kt-theme="${escapeHtml(s.id)}">
      <span class="kt-rank-no">${i + 1}</span><span class="kt-rank-name">${escapeHtml(s.name)}</span>
      <span class="kt-rank-n">${s.n}종목</span><b>${ktPct(v)}</b></button></li>`;
  };
  const top = rankPool.slice(0, 5);
  const bottom = rankPool.length > 5 ? rankPool.slice(-3).reverse() : [];
  const rows = ranked.map((s) => {
    const sel = s.id === KT_VIEW.sel;
    const d = s.d, w = s.w, m = s.m;
    const pick = (cell) => cell[KT_VIEW.weight === "cap" ? "cap" : "eq"];
    return `<tr class="kt-row${sel ? " is-selected" : ""}" data-kt-theme="${escapeHtml(s.id)}" aria-expanded="${sel}">
        <th scope="row"><span class="kt-name">${escapeHtml(s.name)}</span><small class="kt-group">${escapeHtml(s.group || "")}</small></th>
        <td>${s.n}${s.llm ? `<small class="kt-llm-n" title="그중 AI 판정 편입">·AI ${s.llm}</small>` : ""}</td>
        <td class="${KT_VIEW.period === "d" ? "is-key" : ""}">${ktPct(pick(d))}</td>
        <td class="${KT_VIEW.period === "w" ? "is-key" : ""}">${ktPct(pick(w))}</td>
        <td class="${KT_VIEW.period === "m" ? "is-key" : ""}">${ktPct(pick(m))}</td>
        <td class="kt-updown"><span class="pos">${d.up}</span>/<span class="neg">${d.down}</span></td>
      </tr>${sel ? `<tr class="kt-detail-row"><td colspan="6"><div id="ktDetail" class="kt-detail">${ktDetailHtml(s)}</div></td></tr>` : ""}`;
  }).join("");
  host.innerHTML = `
    <section class="kt-card" aria-label="테마 등락">
      <header class="kt-head">
        <h3>테마 등락</h3>
        ${ktSeg("period", KT_PERIODS, KT_VIEW.period)}
        ${ktSeg("weight", KT_WEIGHTS, KT_VIEW.weight)}
      </header>
      <p class="kt-sub">편입 종목 ${weightLabel} 평균 · 스냅샷 종가 기준(${escapeHtml(String(data?.updatedAtKst || "").slice(0, 16))}) · 편입 ${KT_RANK_MIN}종목 이상만 순위</p>
      <div class="kt-rank">
        <div class="kt-rank-col"><h4>${periodLabel} 급상승 테마</h4><ol>${top.map(rankItem).join("") || '<li class="muted">순위를 낼 테마가 아직 없습니다.</li>'}</ol></div>
        ${bottom.length ? `<div class="kt-rank-col"><h4>${periodLabel} 약세 테마</h4><ol>${bottom.map((s, i) => rankItem(s, rankPool.length - 1 - i)).join("")}</ol></div>` : ""}
      </div>
    </section>
    <section class="kt-card" aria-label="전체 테마">
      <header class="kt-head"><h3>전체 테마</h3><span class="kt-count">${withMembers.length}개 테마 · 편입 ${Number(P.count).toLocaleString("ko-KR")}건</span></header>
      <div class="kt-groups" role="group" aria-label="테마 분류">
        <button type="button" data-kt="group:" class="kt-chip-f ${!KT_VIEW.group ? "is-active" : ""}">전체</button>
        ${groups.map((g) => `<button type="button" data-kt="group:${escapeHtml(g)}" class="kt-chip-f ${KT_VIEW.group === g ? "is-active" : ""}">${escapeHtml(g)}</button>`).join("")}
      </div>
      <div class="kt-table-wrap">
        <table class="kt-table">
          <thead><tr><th scope="col">테마</th><th scope="col">종목</th><th scope="col">오늘</th><th scope="col">1주</th><th scope="col">1개월</th><th scope="col" class="kt-updown" title="오늘 상승/하락 종목 수">상승/하락</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="muted">이 분류에 편입 종목이 있는 테마가 없습니다.</td></tr>'}</tbody>
        </table>
      </div>
      ${empty ? `<p class="kt-note">편입 종목이 아직 없는 테마 ${empty}개는 표에서 뺐습니다.</p>` : ""}
    </section>
    <p class="ia-footnote kt-foot">편입 기준: DART 사업보고서 'II. 사업의 내용' 원문에 테마를 가리키는 문장이 있을 때만(문장은 원문 그대로, 출처 링크).
      규칙 편입 = 테마 키워드·자기 지칭(당사 등)·사업 활동어가 한 문장에 있음 / AI 판정 = 규칙으로 애매한 문장만 Gemini 가 판정.
      원문 확인 ${Number(cov.processed || 0).toLocaleString("ko-KR")} / ${Number(cov.universe || 0).toLocaleString("ko-KR")}종목(시가총액 순으로 매주 추가) · 갱신 ${escapeHtml(P.updatedAtKst || "")}.
      테마 등락은 지난 가격 움직임일 뿐 이후 방향을 알려 주지 않습니다. 투자 권유가 아닙니다.</p>`;
  if (KT_VIEW.sel) ktFillDetail(KT_VIEW.sel);
}

function ktDetailHtml(stat) {
  const th = ktTheme(stat.id);
  if (!th) return "";
  const C = ktCore();
  const map = ktStockMap();
  const members = C.activeMembers(th).slice().sort((a, b) => (Number(map[b.t]?.marketCapB) || 0) - (Number(map[a.t]?.marketCapB) || 0));
  const hidden = (th.members || []).length - members.length;
  const key = C.PERIOD_KEYS[KT_VIEW.period];
  const periodLabel = (KT_PERIODS.find(([k]) => k === KT_VIEW.period) || [])[1] || "";
  const P = window.KR_THEMES || {};
  const items = members.map((m) => {
    const s = map[m.t];
    const name = (s && s.company) || ((P.reports || {})[m.t] || [])[3] || m.t;
    const logo = typeof window.companyLogoHtml === "function" ? window.companyLogoHtml(m.t, "kr", name, 20) : "";
    return `<li class="kt-member" data-kt-member="${escapeHtml(m.t)}">
        <div class="kt-member-head">
          <button type="button" class="kt-member-name" data-kt-ticker="${escapeHtml(m.t)}">${logo}<span>${escapeHtml(name)}</span></button>
          <span class="kt-member-num">${s ? ktPct(s[key]) : '<span class="muted">—</span>'}<small>${escapeHtml(periodLabel)}</small></span>
          <span class="kt-member-cap">${escapeHtml(ktCap(s))}</span>
        </div>
        <p class="kt-ev" data-kt-ev="${escapeHtml(m.t)}"><span class="muted">근거 문장 불러오는 중…</span></p>
        <p class="kt-meta">${ktByBadge(m.by)}${ktSubBadge(m.sub)}<span>출처 ${ktSourceHtml(m.t)}</span>${Number(m.n) > 1 ? `<span title="같은 테마로 걸린 원문 문장 수 — 대표 문장 하나만 보여 줍니다">관련 문장 ${Number(m.n)}개</span>` : ""}${m.pb != null ? `<span>PBR ${Number(m.pb).toFixed(2)}배</span>` : ""}</p>
      </li>`;
  }).join("");
  const perfLine = `${escapeHtml(periodLabel)} 동일가중 ${ktPct(stat[KT_VIEW.period].eq)} · 시총가중 ${ktPct(stat[KT_VIEW.period].cap)}`;
  return `
    <div class="kt-detail-head">
      <div><h4>${escapeHtml(th.name)}</h4><p class="kt-desc">${escapeHtml(th.desc || "")}</p></div>
      <p class="kt-detail-perf">${perfLine}</p>
    </div>
    ${th.filter && th.filter.pbMax != null ? `<p class="kt-note">금융업 근거 문장이 있는 종목 중 KRX 공식 PBR ${th.filter.pbMax}배 미만(빌드일 ${escapeHtml(String(P.updatedAtKst || "").slice(0, 10))} 기준)만 셉니다${hidden > 0 ? ` — PBR 조건 밖 ${hidden}종목 제외` : ""}.</p>` : ""}
    <ol class="kt-members">${items || '<li class="muted">조건을 만족하는 종목이 없습니다.</li>'}</ol>`;
}

// 펼친 테마의 근거 문장을 채운다(테마 파일 하나 fetch).
function ktFillDetail(id) {
  const th = ktTheme(id);
  if (!th) return;
  ktLoadEvidence(th).then((ev) => {
    const box = byId("ktDetail");
    if (!box || KT_VIEW.sel !== id) return;
    box.querySelectorAll("[data-kt-ev]").forEach((p) => {
      const t = p.dataset.ktEv;
      const m = (th.members || []).find((x) => x.t === t);
      const pair = ev && ev[t];
      p.innerHTML = pair
        ? `“${ktEvidenceHtml(pair[0], m && m.kw, pair[1])}”`
        : '<span class="muted">근거 문장을 불러오지 못했습니다.</span>';
    });
  });
}

function ktOnClick(ev) {
  const btn = ev.target.closest("[data-kt]");
  if (btn) {
    const i = btn.dataset.kt.indexOf(":");
    const key = btn.dataset.kt.slice(0, i);
    const val = btn.dataset.kt.slice(i + 1);
    if (key === "period") KT_VIEW.period = val;
    else if (key === "weight") KT_VIEW.weight = val;
    else if (key === "group") KT_VIEW.group = val;
    renderKrThemes();
    return;
  }
  const tk = ev.target.closest("[data-kt-ticker]");
  if (tk) {
    if (typeof navigateToStockAnalysis === "function") navigateToStockAnalysis(tk.dataset.ktTicker);
    return;
  }
  if (ev.target.closest("a")) return;
  const row = ev.target.closest("[data-kt-theme]");
  if (row) {
    const id = row.dataset.ktTheme;
    const fromRank = row.classList.contains("kt-rank-item");
    KT_VIEW.sel = KT_VIEW.sel === id && !fromRank ? null : id;
    if (fromRank) KT_VIEW.group = "";
    ktWriteUrl(KT_VIEW.sel);
    renderKrThemes();
    if (KT_VIEW.sel) {
      const target = byId("krThemeMarket")?.querySelector(`tr.kt-row[data-kt-theme="${CSS.escape(KT_VIEW.sel)}"]`);
      if (target && fromRank) target.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }
}

// 다른 화면(종목 칩)에서 테마를 열 때.
function openKrTheme(id) {
  if (!ktTheme(id)) return;
  KT_VIEW.sel = id;
  KT_VIEW.group = "";
  if (typeof activateTab === "function") activateTab("krtheme");
  ktWriteUrl(id);
  renderKrThemes();
  const target = byId("krThemeMarket")?.querySelector(`tr.kt-row[data-kt-theme="${CSS.escape(id)}"]`);
  if (target) target.scrollIntoView({ block: "start" });
}

// ------------------------------------------------------------------ 종목 분석 '이 종목의 테마' 칩
function renderStockThemes(item) {
  const host = byId("stockThemes");
  if (!host) return;
  const ticker = item && item.ticker ? String(item.ticker) : "";
  if (!ticker || ktOff() || !isKrMarket() || !ktCore()) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  const P = window.KR_THEMES;
  if (!P) {
    ensureFeatureData("krThemes").then((ok) => {
      if (ok && typeof selectedTicker !== "undefined" && String(selectedTicker) === ticker) renderStockThemes(item);
    });
    host.hidden = true;
    return;
  }
  // refreshFeatureViews 가 다른 데이터가 도착할 때마다 다시 부른다 — 같은 종목·같은 데이터면 그대로 둬서
  // 펼쳐 둔 근거 문장이 닫히지 않게 한다.
  const renderKey = `${ticker}|${P.updatedAtKst || ""}`;
  if (host.dataset.ktKey === renderKey && host.innerHTML) return;
  host.dataset.ktKey = renderKey;
  const list = ktCore().themesForTicker(P.themes, ticker);
  const done = Array.isArray(P.done) && P.done.includes(ticker);
  if (!list.length && !done) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  const rep = (P.reports || {})[ticker];
  const repName = rep ? rep[1] : "사업보고서";
  host.hidden = false;
  host.dataset.ktTicker = ticker;
  host.innerHTML = `
    <h3 class="kt-chips-title">이 종목의 테마 <small>사업보고서 근거</small></h3>
    ${list.length ? `<div class="kt-chips">${list.map((x) => `<button type="button" class="kt-chip" data-kt-chip="${escapeHtml(x.id)}" aria-expanded="false"
        title="${escapeHtml(`근거 키워드 '${x.kw}' · ${repName}${x.by === "llm" ? " · AI 판정" : ""}${x.sub ? " · 자회사 사업" : ""} — 눌러서 근거 문장 보기`)}">${escapeHtml(x.name)}${x.by === "llm" ? '<span class="kt-chip-ai" aria-label="AI 판정">AI</span>' : ""}${x.sub ? '<span class="kt-chip-ai" aria-label="자회사 사업">자회사</span>' : ""}</button>`).join("")}</div>
      <div class="kt-chip-ev" hidden></div>`
    : '<p class="kt-note">사업보고서 \'사업의 내용\'에서 사전의 테마를 가리키는 근거 문장을 찾지 못했습니다.</p>'}`;
  if (!host.dataset.ktBound) {
    host.dataset.ktBound = "1";
    host.addEventListener("click", ktChipClick);
  }
}

function ktChipClick(ev) {
  const host = byId("stockThemes");
  if (!host) return;
  const open = ev.target.closest("[data-kt-open]");
  if (open) {
    openKrTheme(open.dataset.ktOpen);
    return;
  }
  const chip = ev.target.closest("[data-kt-chip]");
  if (!chip) return;
  const box = host.querySelector(".kt-chip-ev");
  if (!box) return;
  const id = chip.dataset.ktChip;
  const wasOpen = chip.getAttribute("aria-expanded") === "true";
  host.querySelectorAll("[data-kt-chip]").forEach((c) => { c.setAttribute("aria-expanded", "false"); c.classList.remove("is-active"); });
  if (wasOpen) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  chip.setAttribute("aria-expanded", "true");
  chip.classList.add("is-active");
  const ticker = host.dataset.ktTicker;
  const th = ktTheme(id);
  const m = th && (th.members || []).find((x) => x.t === ticker);
  box.hidden = false;
  box.innerHTML = '<p class="muted">근거 문장 불러오는 중…</p>';
  ktLoadEvidence(th).then((evMap) => {
    if (host.dataset.ktTicker !== ticker || chip.getAttribute("aria-expanded") !== "true") return;
    const pair = evMap && evMap[ticker];
    box.innerHTML = `
      <p class="kt-ev">${pair ? `“${ktEvidenceHtml(pair[0], m && m.kw, pair[1])}”` : '<span class="muted">근거 문장을 불러오지 못했습니다.</span>'}</p>
      <p class="kt-meta">${ktByBadge(m && m.by)}${ktSubBadge(m && m.sub)}<span>출처 ${ktSourceHtml(ticker)}</span></p>
      <button type="button" class="ghost compact-btn kt-open" data-kt-open="${escapeHtml(id)}">${escapeHtml(th ? th.name : "")} 테마 전체 보기 ›</button>`;
  });
}
