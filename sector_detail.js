const data = window.MARKET_SNAPSHOT || { health: { etfRelative: { rows: [] } }, stocks: [] };
const params = new URLSearchParams(window.location.search);

const byId = (id) => document.getElementById(id);
const fmtPct = (value) => `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(1)}%`;
const cls = (value) => value > 0 ? "pos" : value < 0 ? "neg" : "muted";

function periodLabel(key) {
  return {
    monthChangePct: "1개월",
    threeMonthChangePct: "3개월",
    ytdChangePct: "YTD",
    changePct: "당일",
  }[key] || key;
}

function rows() {
  return data.health?.etfRelative?.rows || [];
}

function currentCategory() {
  const category = byId("detailCategory").value;
  return rows().find((item) => item.category === category) || rows()[0];
}

function stockAnalysisUrl(ticker) {
  return `index.html?tab=search&ticker=${encodeURIComponent(ticker)}`;
}

function setupDetail() {
  byId("updatedAt").textContent = data.updatedAtKst || "N/A";
  const benchmarks = data.health?.etfRelative?.benchmarks?.length
    ? data.health.etfRelative.benchmarks
    : ["SPY", "QQQ", "TQQQ", "DIA", "IWM"];
  byId("detailBenchmark").innerHTML = benchmarks.map((ticker) => `<option value="${ticker}">${ticker} 대비</option>`).join("");
  byId("detailCategory").innerHTML = rows()
    .map((item) => `<option value="${item.category}">${item.group} · ${item.category}</option>`)
    .join("");

  const category = params.get("category");
  const period = params.get("period");
  const benchmark = params.get("benchmark");
  if (category && rows().some((item) => item.category === category)) byId("detailCategory").value = category;
  if (period) byId("detailPeriod").value = period;
  if (benchmark && benchmarks.includes(benchmark)) byId("detailBenchmark").value = benchmark;

  ["detailBenchmark", "detailPeriod", "detailCategory"].forEach((id) => {
    byId(id).addEventListener("change", renderDetail);
  });
  renderDetail();
}

function renderDetail() {
  const item = currentCategory();
  if (!item) return;
  const period = byId("detailPeriod").value;
  const benchmark = byId("detailBenchmark").value;
  const benchmarkRelative = item.relative?.[benchmark]?.[period] ?? 0;
  const leaders = (item.stockLeaders || [])
    .map((leader) => ({
      ...leader,
      activeReturn: leader[period] ?? 0,
      activeRelative: leader.relativeToEtf?.[period] ?? 0,
    }))
    .filter((leader) => leader.activeRelative > 0)
    .sort((a, b) => b.activeRelative - a.activeRelative);

  document.title = `${item.category} 내부 상대강도 | 미르의 미국 주식`;
  byId("detailTitle").textContent = item.category;
  byId("categoryTitle").textContent = `${item.category} · ${item.representative}`;
  byId("categoryDescription").textContent =
    `${item.name} 기준으로 관련 주식 중 ${periodLabel(period)} 수익률이 더 강한 종목을 순위화했습니다.`;
  byId("openRepresentative").href = stockAnalysisUrl(item.representative);
  byId("leaderTitle").textContent = `${item.category} 내부 상대강도`;
  byId("leaderMeta").textContent = `${item.representative}보다 강한 종목 ${leaders.length}개 · ${periodLabel(period)} 기준`;
  byId("returnHead").textContent = `${periodLabel(period)} 수익률`;
  byId("relativeHead").textContent = `${item.representative} 대비`;
  byId("methodNote").textContent = data.health?.etfRelative?.method || "";

  byId("detailSummary").innerHTML = `
    <article class="mini-card">
      <h3>${item.representative}</h3>
      <p class="muted">${item.name}</p>
      <p class="${cls(item[period])}"><strong>${fmtPct(item[period])}</strong> ${periodLabel(period)} 수익률</p>
    </article>
    <article class="mini-card">
      <h3>${benchmark} 대비</h3>
      <p class="${cls(benchmarkRelative)}"><strong>${fmtPct(benchmarkRelative)}</strong></p>
      <p class="muted">대표 ETF 상대강도</p>
    </article>
    <article class="mini-card">
      <h3>내부 강세 종목</h3>
      <p><strong>${leaders.length}개</strong></p>
      <p class="muted">${item.representative}보다 강한 종목 수</p>
    </article>
  `;

  if (!leaders.length) {
    byId("leaderRows").innerHTML = `
      <tr>
        <td colspan="9" class="muted">선택한 기간에는 대표 ETF보다 강한 관련 종목이 없습니다.</td>
      </tr>
    `;
    return;
  }

  byId("leaderRows").innerHTML = leaders.map((leader, index) => `
    <tr onclick="window.location.href='${stockAnalysisUrl(leader.ticker)}'">
      <td>${index + 1}</td>
      <td><strong>${leader.ticker}</strong><br><span>${leader.name}</span></td>
      <td>${leader.sector}</td>
      <td>${leader.industry}</td>
      <td class="${cls(leader.activeReturn)}">${fmtPct(leader.activeReturn)}</td>
      <td class="${cls(leader.activeRelative)}">${fmtPct(leader.activeRelative)}</td>
      <td>${leader.rsScore}</td>
      <td>${leader.epsRevScore}</td>
      <td>${Number(leader.volumeRatio || 0).toFixed(1)}x</td>
    </tr>
  `).join("");
}

setupDetail();
