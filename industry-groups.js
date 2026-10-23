// industry-groups.js — 시장 탭 › 섹터 흐름 › '업종 순위' (미국·국내)
// =====================================================
// 데이터: window.MARKET_BREADTH.groups(data/market_breadth.js · data/korea/market_breadth.js, lazy·시장별 —
// scripts/build_market_breadth.py 가 종목별 실측 일봉 종가로 업종 수익률을 집계). 계산은 industry-groups-core.js.
// 섹터 흐름의 '업종 순위' 하위 탭을 열 때 불린다(app.js sectorSubTabs). 파일이 없거나 업종이 없으면 안내만.

const _igState = { period: "1w", weight: "cap", sector: "" };

function renderIndustryGroups() {
  const host = byId("industryGroupsWrap");
  if (!host) return;
  const core = window.MirIndustryGroupsCore;
  const meta = byId("industryGroupsMeta");
  const empty = (msg) => { host.innerHTML = `<p class="muted">${escapeHtml(msg)}</p>`; if (meta) meta.textContent = ""; };
  if (!core || featureOff("marketBreadth")) return empty("업종 데이터가 없습니다.");
  const p = window.MARKET_BREADTH;
  const market = isKrMarket() ? "kr" : "us";
  if (!p || p.market !== market) {
    if (p && p.market !== market) return empty("업종 데이터가 없습니다.");
    host.innerHTML = `<p class="muted">불러오는 중…</p>`;
    ensureFeatureData("marketBreadth").then((ok) => {
      if (ok) renderIndustryGroups();
      else empty("업종 데이터가 없습니다.");
    });
    return;
  }
  if (!Array.isArray(p.groups) || !p.groups.length) return empty("업종 데이터가 없습니다.");
  igSyncControls(core, p);
  const rows = core.rankGroups(p, _igState.period, _igState.weight, _igState.sector);
  const sectorName = (s) => (typeof sectorShortName === "function" ? sectorShortName(s) : s);
  const sd = (iso) => (window.MirBreadthHistoryCore ? window.MirBreadthHistoryCore.shortDate(iso, p.groupsAsOf) : iso);
  if (meta) meta.textContent = p.groupsAsOf ? `${sd(p.groupsAsOf)} 기준${p.groupsPrevAsOf ? ` · 변화는 ${sd(p.groupsPrevAsOf)} 순위 대비` : ""}` : "";
  const cls = (v) => (Number.isFinite(v) && v !== 0 ? (v > 0 ? "pos" : "neg") : "");
  const kr = isKrMarket();
  const who = (m) => {
    if (!m) return "–";
    const label = kr ? m.name : m.ticker;
    return `<span class="ticker-link" data-ticker="${escapeHtml(m.ticker)}" role="button" tabindex="0" title="${escapeHtml(m.name || m.ticker)}">${escapeHtml(label)}</span> <span class="${cls(m.ret)}">${escapeHtml(core.fmtPct(m.ret))}</span>`;
  };
  const head = core.PERIODS.map((x) => `<th class="${x.key === _igState.period ? "is-sel" : ""}">${escapeHtml(x.label)}</th>`).join("");
  host.innerHTML = `<div class="ig-table-wrap"><table class="ig-table">
    <thead><tr><th>순위</th><th>변화</th><th class="ig-name">업종</th><th>종목</th>${head}<th>50일선 위</th><th>200일선 위</th><th>상승 1위</th><th>하락 1위</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td>${r.rank ?? "–"}</td>
      <td class="${cls(r.delta)}">${escapeHtml(core.fmtDelta(r.delta))}</td>
      <th scope="row" class="ig-name"><span>${escapeHtml(r.name)}</span>${_igState.sector ? "" : `<small>${escapeHtml(sectorName(r.sector))}</small>`}</th>
      <td>${r.n}</td>
      ${core.PERIODS.map((x) => `<td class="${cls(r.rets[x.key])}${x.key === _igState.period ? " is-sel" : ""}">${escapeHtml(core.fmtPct(r.rets[x.key]))}</td>`).join("")}
      <td>${r.above50 === null ? "–" : `${r.above50.toFixed(0)}%`}</td>
      <td>${r.above200 === null ? "–" : `${r.above200.toFixed(0)}%`}</td>
      <td class="ig-mover">${who(r.best)}</td>
      <td class="ig-mover">${who(r.worst)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function igSyncControls(core, p) {
  const period = byId("igPeriod");
  const weight = byId("igWeight");
  const sector = byId("igSector");
  if (period && !period.dataset.bound) {
    period.innerHTML = core.PERIODS.map((x) => `<option value="${x.key}">${escapeHtml(x.label)}</option>`).join("");
    period.value = _igState.period;
    period.dataset.bound = "1";
    period.addEventListener("change", () => { _igState.period = period.value; renderIndustryGroups(); });
  }
  if (weight && !weight.dataset.bound) {
    weight.innerHTML = core.WEIGHTS.map((x) => `<option value="${x.key}">${escapeHtml(x.label)}</option>`).join("");
    weight.value = _igState.weight;
    weight.dataset.bound = "1";
    weight.addEventListener("change", () => { _igState.weight = weight.value; renderIndustryGroups(); });
  }
  if (sector) {
    const list = core.sectorsOf(p);
    const key = `${p.market}:${list.join("|")}`;
    if (sector.dataset.key !== key) {
      const name = (s) => (typeof sectorShortName === "function" ? sectorShortName(s) : s);
      sector.innerHTML = `<option value="">전체 섹터</option>${list.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(name(s))}</option>`).join("")}`;
      if (!list.includes(_igState.sector)) _igState.sector = "";
      sector.value = _igState.sector;
      sector.dataset.key = key;
    }
    if (!sector.dataset.bound) {
      sector.dataset.bound = "1";
      sector.addEventListener("change", () => { _igState.sector = sector.value; renderIndustryGroups(); });
    }
  }
  const host = byId("industryGroupsWrap");
  if (host && !host.dataset.bound) {
    host.dataset.bound = "1";
    const open = (event) => {
      const link = event.target.closest(".ticker-link[data-ticker]");
      if (!link) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectTicker(link.dataset.ticker, { openSearch: true });
    };
    host.addEventListener("click", open);
    host.addEventListener("keydown", open);
  }
}
