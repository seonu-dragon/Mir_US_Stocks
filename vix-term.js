// vix-term.js — 시장 › 시그널 'VIX 기간구조' 위젯(#vixTerm).
// =====================================================
// 데이터 window.VIX_TERM_STRUCTURE(scripts/build_vix_term_structure.py, FEATURE_DATA.vixTerm — 두 시장 모두 로드:
// 미국 변동성 곡선은 국내 위험자산에도 공통 배경). 계산은 vix-term-core.js(MirVixTermCore).
// 그림: 가로축 = 만기까지 일수(제곱근 눈금), 현물 지수 곡선(VIX1D~VIX1Y) + VX 선물 월물 곡선(오늘·1주 전·1개월 전).
// 캡션 없이 라벨·단위·숫자·기준일만. 클래식 스크립트 — 최상위 이름은 vt 접두사.

function vtEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s); }

function vtChartSvg(core, p, width) {
  const spot = core.curvePoints(p, "spot");
  const fut = core.curvePoints(p, "futures");
  const week = core.curvePoints(p, "week");
  const month = core.curvePoints(p, "month");
  const all = [spot, fut, week, month];
  const dom = core.yDomain(all);
  if (!dom || (!spot.length && !fut.length)) return "";
  // 실제 픽셀 폭으로 그린다(viewBox = 폭) — 폰에서 축 글자가 줄어들지 않게.
  const W = Math.max(300, Math.min(1000, Math.round(width || 640))), H = W < 520 ? 220 : 240, padL = 34, padR = 12, padT = 12, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxDays = Math.max(365, ...all.flat().map((pt) => pt.x));
  const X = (d) => padL + core.xScale(d, maxDays, plotW);
  const Y = (v) => padT + (dom.max - v) / (dom.max - dom.min) * plotH;
  const grid = dom.ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="vt-grid"/>`
    + `<text x="${padL - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" class="vt-axis">${vtEsc(t)}</text>`).join("");
  const xt = (W < 520 ? [1, 30, 90, 180, 365] : [1, 9, 30, 90, 180, 365]).filter((d) => d <= maxDays).map((d) => `<line x1="${X(d).toFixed(1)}" x2="${X(d).toFixed(1)}" y1="${padT}" y2="${padT + plotH}" class="vt-grid vt-grid-x"/>`
    + `<text x="${X(d).toFixed(1)}" y="${H - 10}" text-anchor="middle" class="vt-axis">${vtEsc(core.tenorLabel(d))}</text>`).join("");
  const path = (pts) => pts.map((pt, i) => `${i ? "L" : "M"}${X(pt.x).toFixed(1)},${Y(pt.y).toFixed(1)}`).join("");
  const line = (pts, cls) => (pts.length > 1 ? `<path d="${path(pts)}" class="vt-line ${cls}"/>` : "");
  const dots = (pts, cls, name) => pts.map((pt) => `<circle cx="${X(pt.x).toFixed(1)}" cy="${Y(pt.y).toFixed(1)}" r="3.2" class="vt-dot ${cls}"><title>${vtEsc(`${name} ${pt.label} · ${core.tenorLabel(pt.x)} · ${core.fmtNum(pt.y)}`)}</title></circle>`).join("");
  return `<svg class="vt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="VIX 기간구조 곡선">${grid}${xt}
    ${line(month, "vt-month")}${line(week, "vt-week")}${line(fut, "vt-fut")}${line(spot, "vt-spot")}
    ${dots(fut, "vt-fut", "선물")}${dots(spot, "vt-spot", "현물")}</svg>`;
}

function vtRatioSpark(core, p) {
  const hist = core.historySeries(p).filter((h) => h.ratio != null);
  if (hist.length < 20) return "";
  const W = 640, H = 64, pad = 4;
  const vals = hist.map((h) => h.ratio);
  const lo = Math.min(...vals, 0.98), hi = Math.max(...vals, 1.02);
  const X = (i) => pad + (W - pad * 2) * i / (hist.length - 1);
  const Y = (v) => pad + (H - pad * 2) * (1 - (v - lo) / (hi - lo));
  const d = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const one = Y(1).toFixed(1);
  return `<div class="vt-spark"><div class="vt-spark-head"><span>VIX/VIX3M 비율 · ${vtEsc(hist[0].date)} ~ ${vtEsc(hist[hist.length - 1].date)}</span><span>1.00 기준선</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="vt-spark-svg" role="img" aria-label="VIX/VIX3M 비율 추이"><line x1="0" x2="${W}" y1="${one}" y2="${one}" class="vt-one"/><path d="${d}" class="vt-line vt-spot"/></svg></div>`;
}

function vtFuturesTable(core, p) {
  const fut = (p.futures || []);
  if (!fut.length) return "";
  const rows = fut.map((f) => {
    const chg = Number.isFinite(Number(f.prev)) ? Number(f.settle) - Number(f.prev) : null;
    const tone = chg == null || Math.abs(chg) < 1e-9 ? "" : chg > 0 ? "vt-up" : "vt-down";
    return `<tr><td>${vtEsc(f.label)}</td><td class="ins-date">${vtEsc(f.exp)}</td><td class="ins-num">${vtEsc(f.days)}일</td>
      <td class="ins-num"><strong>${core.fmtNum(f.settle)}</strong></td>
      <td class="ins-num ${tone}">${chg == null ? "—" : `${chg > 0 ? "▲" : chg < 0 ? "▼" : ""}${Math.abs(chg).toFixed(2)}`}</td>
      <td class="ins-num">${Number.isFinite(Number(f.oi)) && f.oi != null ? Number(f.oi).toLocaleString("en-US") : "—"}</td></tr>`;
  }).join("");
  return `<div class="table-wrap vt-table-wrap"><table class="insider-table vt-table"><thead><tr><th>월물</th><th>만기</th><th class="ins-num">남은 일수</th><th class="ins-num">정산가</th><th class="ins-num">전일 대비</th><th class="ins-num">미결제약정</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderVixTerm() {
  const host = typeof byId === "function" ? byId("vixTerm") : null;
  if (!host) return;
  const core = window.MirVixTermCore;
  const p = window.VIX_TERM_STRUCTURE;
  const cfg = typeof marketCfg === "function" ? marketCfg() : null;
  if (!core || (cfg && cfg.features && cfg.features.vixTerm === false)) { host.innerHTML = ""; return; }
  if (!p) {
    host.innerHTML = "";
    // lazy 데이터셋 — 받으면 시그널 탭을 다시 그려 접힘 숨김(syncSignalFolds)도 함께 맞춘다.
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData("vixTerm").then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
    }
    return;
  }
  const s = core.summary(p);
  if (!s || (s.ratio == null && !s.front)) { host.innerHTML = ""; return; }
  const stateText = s.state === "back" ? "백워데이션" : s.state === "contango" ? "콘탱고" : "—";
  const spreadState = s.spread == null ? "" : s.spread >= 0 ? "콘탱고" : "백워데이션";
  const vixRow = (p.spot || []).find((x) => x.id === "VIX");
  const vixChg = vixRow && Number.isFinite(Number(vixRow.prev)) ? Number(vixRow.v) - Number(vixRow.prev) : null;
  const tiles = [
    ["VIX/VIX3M", core.fmtNum(s.ratio), `${stateText}${s.stateDays ? ` ${s.stateDays}일째` : ""}${s.ratioPct != null ? ` · 1년 ${s.ratioPct}백분위` : ""}`],
    ["1·2개월물 차", core.fmtSignedPct(s.spread), `${spreadState}${s.front && s.second ? ` · ${s.front.label} → ${s.second.label}` : ""}`],
    ["VIX", core.fmtNum(s.vix), vixChg == null ? "" : `전일 대비 ${vixChg > 0 ? "▲" : vixChg < 0 ? "▼" : ""}${Math.abs(vixChg).toFixed(2)}`],
    ["1년 중 백워데이션", s.histDays ? `${s.backDays}일` : "—", s.histDays ? `${s.histDays}거래일 중` : ""],
  ];
  const spotRow = (p.spot || []).map((x) => `<span class="vt-chip"><b>${vtEsc(x.id)}</b> ${core.fmtNum(x.v)}</span>`).join("");
  host.innerHTML = `
    <div class="section-title"><h2>VIX 기간구조</h2></div>
    <div class="vt-card">
      <dl class="vt-kpis">${tiles.map(([k, v, sub]) => `<div><dt>${vtEsc(k)}</dt><dd class="vt-kpi-v">${vtEsc(v)}</dd>${sub ? `<dd class="vt-kpi-sub">${vtEsc(sub)}</dd>` : ""}</div>`).join("")}</dl>
      <div class="vt-legend"><span class="vt-key vt-spot">현물 지수</span><span class="vt-key vt-fut">VX 선물</span>${p.week ? `<span class="vt-key vt-week">1주 전 선물 (${vtEsc(p.week.date)})</span>` : ""}${p.month ? `<span class="vt-key vt-month">1개월 전 선물 (${vtEsc(p.month.date)})</span>` : ""}</div>
      ${vtChartSvg(core, p, (host.clientWidth || 680) - 40)}
      <div class="vt-chips">${spotRow}</div>
      ${vtRatioSpark(core, p)}
      ${vtFuturesTable(core, p)}
      <p class="vt-foot">기준 ${vtEsc(p.asOf || "")} · 업데이트 ${vtEsc(p.updatedAtKst || "")}</p>
    </div>`;
}
