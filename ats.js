// ats.js — 종목 분석 › 수급·보유 탭의 '다크풀(ATS) 거래 비중' 카드 (미국 전용)
// =====================================================
// 데이터: data/finra_ats.js(window.FINRA_ATS, lazy — scripts/build_finra_ats.py, FINRA 주간 ATS 체결 합계 ÷ 그 주 통합 거래량).
// 계산은 ats-core.js(MirAtsCore). 수급·보유 탭이 열려 있을 때만 받는다 — inst-holders.js 와 같은 자리에서 불린다
// (selectTicker·refreshFeatureViews·탭 전환 sdEnsureFlowData). 값이 없는 종목(ATS 체결 없음·거래량 결측)은 카드를 숨긴다.

function atsFlowTabOpen() {
  return typeof sdActiveView !== "function" || sdActiveView() === "flow";
}

function renderAtsCard(item) {
  const host = byId("atsCard");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; };
  const core = window.MirAtsCore;
  const ticker = item && item.ticker;
  if (!ticker || !core || isKrMarket() || featureOff("finraAts")) return hide();
  if (!atsFlowTabOpen()) return;
  const p = window.FINRA_ATS;
  if (!p) {
    ensureFeatureData("finraAts").then((ok) => { if (ok && selectedTicker === ticker) renderAtsCard(item); });
    return;
  }
  const s = core.summarize(p, ticker);
  if (!s) return hide();
  host.hidden = false;
  host.innerHTML = atsCardHtml(s, core);
}

function atsCardHtml(s, core) {
  const h = 56;
  const hs = core.bars(s.series, h);
  const n = s.series.length;
  const bw = 100 / n;
  const bars = s.series.map((pt, i) => {
    const bh = hs[i];
    const label = `${core.weekLabel(pt.week)} ${pt.pct === null ? "자료 없음" : `${pt.pct.toFixed(1)}%`}`;
    if (bh === null) return `<rect class="ats-bar is-empty" x="${(i * bw + bw * 0.18).toFixed(2)}" y="${h - 2}" width="${(bw * 0.64).toFixed(2)}" height="2"><title>${escapeHtml(label)}</title></rect>`;
    return `<rect class="ats-bar${i === n - 1 ? " is-last" : ""}" x="${(i * bw + bw * 0.18).toFixed(2)}" y="${h - bh}" width="${(bw * 0.64).toFixed(2)}" height="${bh}"><title>${escapeHtml(label)}</title></rect>`;
  }).join("");
  // 비중이 높고 낮음은 좋고 나쁨이 아니다 — 등락색을 쓰지 않는다.
  const diff = `${s.diffPct > 0 ? "+" : ""}${s.diffPct.toFixed(1)}%p`;
  const first = s.series[0];
  const last = s.series[n - 1];
  return `<div class="fundamental-head"><h3>다크풀(ATS) 거래 비중</h3><span>${escapeHtml(core.weekLabel(s.lastWeek))} 주 기준 · 공개 ${s.tier === "T2" ? "약 5주" : "약 3주"} 지연</span></div>
    <div class="ih-stats ats-stats">
      ${ihStatSafe("최근 주 비중", `${s.lastPct.toFixed(1)}%`, "그 주 전체 거래량 중 ATS 체결")}
      ${ihStatSafe(`${s.weeksWithData}주 평균`, `${s.avgPct.toFixed(1)}%`, `최근 주는 평균 대비 ${diff}`)}
      ${s.ats !== null ? ihStatSafe("최근 주 ATS 체결", core.fmtShares(s.ats), "모든 ATS 합계") : ""}
    </div>
    <figure class="ats-chart">
      <svg viewBox="0 0 100 ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`주별 ATS 비중 ${n}주`)}">${bars}</svg>
      <div class="ih-spark-x"><span>${escapeHtml(core.weekLabel(first.week))}</span><span>${escapeHtml(core.weekLabel(last.week))}</span></div>
    </figure>`;
}

// inst-holders.js 의 ihStat 을 쓰되, 그 파일이 없을 때도 그려지게.
function ihStatSafe(label, value, sub, tone) {
  if (typeof ihStat === "function") return ihStat(label, value, sub, tone);
  return `<div class="ih-stat"><span class="ih-stat-l">${escapeHtml(label)}</span><strong class="ih-stat-v">${escapeHtml(value)}</strong>${sub ? `<span class="ih-stat-s${tone ? ` ${tone}` : ""}">${escapeHtml(sub)}</span>` : ""}</div>`;
}
