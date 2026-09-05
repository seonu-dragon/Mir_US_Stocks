// signals.js — 시그널 탭 & 매크로 위젯
// ===================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없다.
// 담는 것: 상단 매크로 상태(marketHeader·CNN 공포탐욕 fetch), 게이지 프리미티브,
// 금리곡선, 국채경매, COT, 위키 관심도, ECOS, 수출입, 시장 히스토리(HISTORY_SERIES),
// 매크로 지표판, renderSignals / renderAggregateInsights.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

const CNN_FNG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
// 홈 상단(공포탐욕·환율·지수 스트립) 상태. 렌더는 항상 applyMarketHeader() 한 곳에서 이 상태로
// 그린다 — 예전엔 fx/fng/indices 응답이 각자 renderSummary/renderIndexStrip 를 불러 늦게 온
// 응답이 먼저 그린 것을 덮거나(스트립 2/8), 카드가 "불러오는 중…" 에 멈췄다.
const marketHeader = { fng: null, fngStatus: "loading", fx: [], fxStatus: "loading", indices: [], indicesSource: null };

function applyMarketHeader() {
  renderSummary();
  renderIndexStrip(marketHeader.indices);
}

// 지수 스트립 병합. 워커(US 8종)가 기준이고 스냅샷(KR 코스피·코스닥)은 심볼이 겹치지 않는
// 것만 더한다. 스냅샷은 워커가 이미 채운 비어있지 않은 목록을 절대 덮어쓰지 않는다.
function setHeaderIndices(list, source) {
  const rows = (Array.isArray(list) ? list : []).filter((ix) => ix && ix.name);
  const merge = (primary, extra) => {
    const have = new Set(primary.map((ix) => ix.symbol));
    return primary.concat(extra.filter((ix) => !have.has(ix.symbol)));
  };
  if (source === "worker") {
    if (rows.length) {
      const snapshotRows = marketHeader.indicesSource === "snapshot" ? marketHeader.indices : [];
      marketHeader.indices = merge(rows, snapshotRows);
      marketHeader.indicesSource = "worker";
    }
  } else if (marketHeader.indicesSource === "worker" && marketHeader.indices.length) {
    marketHeader.indices = merge(marketHeader.indices, rows);
  } else if (rows.length) {
    marketHeader.indices = rows;
    marketHeader.indicesSource = "snapshot";
  }
  renderIndexStrip(marketHeader.indices);
}

// CNN 이 막혔을 때({"fng":null}) 스냅샷 게이지(data/sentiment_gauges.js 의 cnn)로 대체한다.
function snapshotFngFallback() {
  const g = window.SENTIMENT_GAUGES;
  const cnn = g && g.cnn;
  const score = Number(cnn && cnn.value);
  if (!Number.isFinite(score)) return null;
  const m = String(g.updatedAtKst || "").match(/(\d{2}):(\d{2})/);
  return {
    score: Math.round(score),
    rawScore: score,
    rating: String(cnn.label || ""),
    timestamp: null,
    previousClose: Number.isFinite(Number(cnn.prevClose)) ? Number(cnn.prevClose) : null,
    source: "snapshot",
    asOf: m ? `${m[1]}:${m[2]}` : "",
  };
}

const SECTOR_KO = {
  "TECHNOLOGY": "정보기술", "HEALTHCARE": "헬스케어", "FINANCIAL": "금융",
  "CONSUMER CYCLICAL": "임의소비재", "CONSUMER DEFENSIVE": "필수소비재",
  "INDUSTRIALS": "산업재", "ENERGY": "에너지", "UTILITIES": "유틸리티",
  "REAL ESTATE": "부동산", "BASIC MATERIALS": "소재", "COMMUNICATION SERVICES": "커뮤니케이션"
};

function computeSectorRanks() {
  const agg = {};
  const kr = isKrMarket();
  data.stocks.forEach((s) => {
    if (isStockEtf(s) || !s.sector) return;
    if (!kr && !SECTOR_KO[s.sector]) return;
    const a = (agg[s.sector] = agg[s.sector] || { sum: 0, n: 0 });
    a.sum += Number(s.changePct) || 0;
    a.n += 1;
  });
  const minCount = kr ? 3 : 5;
  const arr = Object.entries(agg)
    .filter(([, v]) => v.n >= minCount)
    .map(([sec, v]) => ({ ko: kr ? sec : SECTOR_KO[sec], avg: v.sum / v.n }));
  arr.sort((a, b) => b.avg - a.avg);
  return { strong: arr.slice(0, 5), weak: arr.slice(-5).reverse() };
}

function fngScore() {
  if (marketHeader.fng && Number.isFinite(marketHeader.fng.score)) return marketHeader.fng.score;
  return null;
}

function fngLabel(score) {
  if (score < 25) return "극단적 공포";
  if (score < 45) return "공포";
  if (score <= 55) return "중립";
  if (score <= 75) return "욕심";
  return "극단적 욕심";
}

function fngColor(score) {
  if (score < 25) return "#dc2626";
  if (score < 45) return "#f97316";
  if (score <= 55) return "#eab308";
  if (score <= 75) return "#84cc16";
  return "#16a34a";
}

function gaugePolar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

function gaugeArc(cx, cy, r, startDeg, endDeg, color, w) {
  const [x1, y1] = gaugePolar(cx, cy, r, startDeg);
  const [x2, y2] = gaugePolar(cx, cy, r, endDeg);
  // startDeg > endDeg (going clockwise over the top), so sweep-flag = 1.
  return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${w}"></path>`;
}

function normalizeCnnFng(payload) {
  const fg = payload && (payload.fear_and_greed || payload.fng);
  const rawScore = Number(fg && fg.score);
  if (!Number.isFinite(rawScore)) return null;
  return {
    score: Math.round(rawScore),
    rawScore,
    rating: String(fg.rating || ""),
    timestamp: fg.timestamp || null,
    previousClose: Number.isFinite(Number(fg.previous_close)) ? Number(fg.previous_close) : null,
    source: "CNN",
  };
}

async function fetchCnnFng(base) {
  // CNN's endpoint (CNN_FNG_URL) sends no CORS headers, so a direct browser fetch always
  // fails with an uncatchable console error. Go straight through the Worker proxy, which
  // fetches CNN server-side and returns CORS-allowed JSON.
  try {
    const response = await fetch(`${base}/?fng=1`, { cache: "no-store" });
    if (response.ok) {
      const fng = normalizeCnnFng(await response.json());
      if (fng) return fng;
    }
  } catch (_) { /* Worker unreachable → gauge shows the loading state. */ }
  return null;
}

function fetchMarketHeader() {
  if (!LIVE_DATA_PROXY) { applyMarketHeader(); return; }
  const base = LIVE_DATA_PROXY.replace(/\/$/, "");
  const marketId = marketCfg().id; // 응답이 도착했을 때 시장이 바뀌어 있으면 버린다
  const fngReq = fetchCnnFng(base).then((fng) => {
    if (marketCfg().id !== marketId) return;
    if (fng) {
      marketHeader.fng = fng;
      marketHeader.fngStatus = "loaded";
      applyMarketHeader();
      return;
    }
    const applyFallback = () => {
      const fb = snapshotFngFallback();
      marketHeader.fng = fb;
      marketHeader.fngStatus = fb ? "snapshot" : "error";
      applyMarketHeader();
    };
    if (window.SENTIMENT_GAUGES) { applyFallback(); return; }
    marketHeader.fngStatus = "error";
    applyMarketHeader();
    ensureFeatureData("sentimentGauges").then((ok) => { if (ok && !marketHeader.fng) applyFallback(); });
  });
  const fxReq = fetch(`${base}/?fx=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (p && Array.isArray(p.fx) && p.fx.length) {
      marketHeader.fx = p.fx;
      marketHeader.fxStatus = "loaded";
      renderPortfolio();
    } else if (!marketHeader.fx.length) {
      marketHeader.fxStatus = "error";
    }
    applyMarketHeader();
  }).catch(() => { if (!marketHeader.fx.length) marketHeader.fxStatus = "error"; applyMarketHeader(); });
  // KR mode renders KOSPI/KOSDAQ from the snapshot (renderSnapshotIndices); worker indices are US-only.
  const idxReq = isKrMarket()
    ? Promise.resolve()
    : fetch(`${base}/?indices=1`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((p) => {
        if (marketCfg().id !== marketId) return;
        if (p && Array.isArray(p.indices)) setHeaderIndices(p.indices, "worker");
      }).catch(() => {});
  Promise.allSettled([fngReq, fxReq, idxReq]).then(() => updateDataLoadedAt());
}

// ===== #9 오늘의 시그널 통합 대시보드 =====
function signalCard(title, items, note) {
  const body = items.length
    ? items.map((x) => `<li><button type="button" class="ins-ticker" data-ticker="${escapeHtml(x.ticker)}">${escapeHtml(stockLabel(x.ticker))}</button><span>${escapeHtml(x.note || "")}</span></li>`).join("")
    : `<li class="muted">해당 신호 없음</li>`;
  return `<div class="signal-card"><h3>${title}</h3>${note ? `<p class="sig-note">${escapeHtml(note)}</p>` : ""}<ul>${body}</ul></div>`;
}
// ===== 미국 국채 수익률 곡선 (FRED) =====
// 매크로 컨텍스트: 곡선 모양과 장단기 스프레드. 역전(음수)은 역사적으로 경기침체를
// 앞서 나타난 적이 많지만 시점은 들쭉날쭉 — 신호가 아니라 현재 상태 요약이다.
function yieldCurveSvg(curve) {
  const W = 320, H = 96, padL = 28, padR = 10, padT = 10, padB = 20;
  const pts = curve.filter((c) => Number.isFinite(Number(c.y)));
  if (pts.length < 3) return "";
  const ys = pts.map((c) => c.y);
  const ymin = Math.floor(Math.min(...ys) * 2) / 2 - 0.25;
  const ymax = Math.ceil(Math.max(...ys) * 2) / 2 + 0.25;
  const span = Math.max(0.5, ymax - ymin);
  const x = (i) => padL + (W - padL - padR) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - ymin) / span);
  const line = pts.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.y).toFixed(1)}`).join(" ");
  const dots = pts.map((c, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(c.y).toFixed(1)}" r="2.4" fill="#5b8def"/>`).join("");
  const labels = pts.map((c, i) => (i % 2 === 0 || i === pts.length - 1)
    ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="8" fill="var(--muted)" text-anchor="middle">${c.m}</text>` : "").join("");
  const gy = [ymin, (ymin + ymax) / 2, ymax];
  const grid = gy.map((v) => `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-opacity="0.5"/><text x="2" y="${(y(v) + 3).toFixed(1)}" font-size="8" fill="var(--muted)">${v.toFixed(1)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet">${grid}<path d="${line}" fill="none" stroke="#5b8def" stroke-width="1.6"/>${dots}${labels}</svg>`;
}

function renderYieldCurve() {
  const host = byId("yieldCurve");
  if (!host) return;
  const yc = window.YIELD_CURVE;
  if (!yc || !Array.isArray(yc.curve) || yc.curve.length < 3) { host.innerHTML = ""; return; }
  const sp = yc.spreads || {};
  const spTile = (label, v, sub) => {
    if (!Number.isFinite(Number(v))) return "";
    const inv = v < 0;
    const col = inv ? "var(--red)" : "var(--green)";
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px;min-width:120px">
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:5px">${label}</div>
      <div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:${col}">${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%p</div>
      <div style="font-size:10.5px;color:${inv ? "var(--red)" : "var(--muted)"}">${inv ? "역전(단기>장기)" : sub}</div>
    </article>`;
  };
  const spark = Array.isArray(yc.spreadHistory) && yc.spreadHistory.length > 5
    ? seasonalitySvgLine(yc.spreadHistory.map((h) => h.v)) : "";
  const last10 = (yc.curve.find((c) => c.m === "10Y") || {}).y;
  host.innerHTML = `
    <div class="section-title"><h2>미국 국채 수익률 곡선</h2>
      <p>FRED 기준 ${escapeHtml(yc.asOf || "")} · 지수·종목만으로 안 보이는 '돈의 값(금리)'과 장단기 스프레드입니다. 예측이 아니라 현재 상태 요약입니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:240px">${yieldCurveSvg(yc.curve)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${Number.isFinite(Number(last10)) ? `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px;min-width:120px"><div style="font-size:11.5px;color:var(--muted);margin-bottom:5px">10년물</div><div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">${Number(last10).toFixed(2)}%</div><div style="font-size:var(--fs-cap);color:var(--muted)">기준 만기</div></article>` : ""}
          ${spTile("10Y − 2Y", sp.t10y2y, "정상(우상향)")}
          ${spTile("10Y − 3M", sp.t10y3m, "정상(우상향)")}
        </div>
      </div>
      ${spark ? `<div style="margin-top:12px"><div style="font-size:var(--fs-cap);color:var(--muted);margin-bottom:4px">10Y − 2Y 스프레드 · 최근 1년</div>${spark}</div>` : ""}
      <p style="font-size:var(--fs-cap);color:var(--muted);margin:12px 0 0;line-height:1.65">장단기 금리 역전(스프레드 음수)은 과거 경기침체를 앞서 나타난 적이 많지만 시점 차이가 커 매매 신호로 쓰기 어렵습니다. 출처: ${escapeHtml(yc.source || "FRED")}.</p>
    </div>`;
}

// 스프레드 추이용 라인 스파크라인(0 기준선 + 음영). seasonalitySvg 가 막대라 별도.
function seasonalitySvgLine(vals) {
  const nums = vals.map(Number).filter(Number.isFinite);
  if (nums.length < 2) return "";
  const W = 320, H = 40, pad = 3;
  const mn = Math.min(...nums, 0), mx = Math.max(...nums, 0);
  const span = Math.max(0.01, mx - mn);
  const x = (i) => pad + (W - pad * 2) * i / (nums.length - 1);
  const y = (v) => pad + (H - pad * 2) * (1 - (v - mn) / span);
  const line = nums.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0).toFixed(1);
  const lastCol = nums[nums.length - 1] < 0 ? "#e5484d" : "#30a46c";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none"><line x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}" stroke="var(--muted)" stroke-opacity="0.3" stroke-dasharray="2 2"/><path d="${line}" fill="none" stroke="${lastCol}" stroke-width="1.4"/></svg>`;
}

// ===== 미 국채 경매 수요 (TREASURY_AUCTIONS, FiscalData) =====
// 금리곡선이 '가격'이라면 경매는 '수요의 체력'. bid-to-cover 를 같은 만기의
// 직전 6회 평균과 비교해 이번 경매가 평소보다 강했는지/약했는지 보여준다.
function renderTreasuryAuctions() {
  const host = byId("treasuryAuctions");
  if (!host) return;
  const ta = window.TREASURY_AUCTIONS;
  if (!ta || !Array.isArray(ta.recent) || !ta.recent.length) { host.innerHTML = ""; return; }
  const rows = ta.recent.map((r) => {
    const delta = Number.isFinite(r.btc) && Number.isFinite(r.btcAvg6) ? r.btc - r.btcAvg6 : null;
    const dCol = delta == null ? "var(--muted)" : delta >= 0 ? "var(--green)" : "var(--red)";
    const dTxt = delta == null ? "—" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(2)}`;
    return `<tr>
      <td class="ins-date">${escapeHtml(r.date || "")}</td>
      <td><strong>${escapeHtml(r.term || "")}</strong> <span style="color:var(--muted);font-size:var(--fs-cap)">${escapeHtml(r.type || "")}</span></td>
      <td class="ins-num"><strong>${Number.isFinite(r.btc) ? r.btc.toFixed(2) : "—"}</strong></td>
      <td class="ins-num" style="color:${dCol}">${dTxt}</td>
      <td class="ins-num">${Number.isFinite(r.highYield) ? `${r.highYield.toFixed(3)}%` : "—"}</td>
      <td class="ins-num">${Number.isFinite(r.offeringB) ? `$${r.offeringB}B` : "—"}</td>
      <td class="ins-num">${Number.isFinite(r.indirectPct) ? `${r.indirectPct.toFixed(0)}%` : "—"}</td>
    </tr>`;
  }).join("");
  const coming = Array.isArray(ta.upcoming) && ta.upcoming.length
    ? `<p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0">다가오는 경매: ${ta.upcoming.map((u) => `${escapeHtml(u.date || "")} ${escapeHtml(u.term || "")}${Number.isFinite(u.offeringB) ? ` $${u.offeringB}B` : ""}`).join(" · ")}</p>` : "";
  host.innerHTML = `
    <div class="section-title"><h2>미 국채 경매 수요</h2>
      <p>응찰배수(bid-to-cover)가 같은 만기 직전 6회 평균 대비 얼마나 강했는지입니다. 입찰 부진은 장기금리 급등의 단골 트리거라 위 수익률 곡선과 함께 봅니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="overflow-x:auto"><table class="insider-table" style="min-width:0"><thead><tr><th>경매일</th><th>만기</th><th class="ins-num">응찰배수</th><th class="ins-num">vs 직전6회</th><th class="ins-num">낙찰금리</th><th class="ins-num">규모</th><th class="ins-num">간접낙찰</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${coming}
      <p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">간접낙찰 비중은 해외 중앙은행·실수요 계열 수요의 프록시입니다. 출처: ${escapeHtml(ta.source || "US Treasury FiscalData")} · 기준 ${escapeHtml(ta.asOf || "")}.</p>
    </div>`;
}

// ===== CFTC COT 투기 포지셔닝 (COT_POSITIONING) =====
// 헤지펀드(Leveraged Funds)·운용사(Managed Money)의 순포지션이 3년 범위에서
// 어디쯤인지(백분위)를 본다. 극단 쏠림의 '위치' 요약이지 방향 신호가 아니다.
function renderCotPositioning() {
  const host = byId("cotPositioning");
  if (!host) return;
  const cot = window.COT_POSITIONING;
  if (!cot || !Array.isArray(cot.markets) || !cot.markets.length) { host.innerHTML = ""; return; }
  const fmtNet = (v) => {
    if (!Number.isFinite(v)) return "—";
    const a = Math.abs(v);
    const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}K` : String(a);
    return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}`;
  };
  const cards = cot.markets.map((m) => {
    const col = m.specNet > 0 ? "var(--green)" : m.specNet < 0 ? "var(--red)" : "var(--muted)";
    const chg = Number.isFinite(m.specChg1w) ? `${m.specChg1w > 0 ? "+" : m.specChg1w < 0 ? "−" : ""}${Math.abs(m.specChg1w).toLocaleString()}` : "—";
    const pct = Number.isFinite(m.pct3y) ? Math.max(0, Math.min(100, m.pct3y)) : null;
    const spark = Array.isArray(m.history) && m.history.length > 5
      ? seasonalitySvgLine(m.history.map((h) => h.v)) : "";
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div style="font-size:12.5px;font-weight:600">${escapeHtml(m.label)}</div>
        <div style="font-size:var(--fs-cap);color:var(--muted)">${escapeHtml(m.group || "")}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;color:${col}">${fmtNet(m.specNet)}</div>
        <div style="font-size:var(--fs-cap);color:var(--muted)">1주 ${chg}</div>
      </div>
      ${pct == null ? "" : `<div>
        <div style="display:flex;justify-content:space-between;font-size:var(--fs-cap);color:var(--muted);margin-bottom:3px"><span>3년 범위 내 위치</span><span style="font-variant-numeric:tabular-nums">${pct}%</span></div>
        <div style="height:4px;background:var(--line);border-radius:2px;position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${col};opacity:0.55;border-radius:2px"></div><div style="position:absolute;left:calc(${pct}% - 2px);top:-2px;width:4px;height:8px;background:${col};border-radius:1px"></div></div>
      </div>`}
      ${spark ? `<div style="margin-top:2px">${spark}</div>` : ""}
    </article>`;
  }).join("");
  host.innerHTML = `
    <div class="section-title"><h2>선물 투기 포지셔닝 (CFTC COT)</h2>
      <p>헤지펀드·운용사의 순포지션(계약수)과 그 값이 최근 3년 범위에서 어디쯤인지입니다. 0%·100% 근처는 쏠림이 붐빈다는 뜻이지 방향 신호가 아닙니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px">${cards}</div>
      <p style="font-size:var(--fs-cap);color:var(--muted);margin:12px 0 0;line-height:1.65">지수·금리·통화는 Leveraged Funds(헤지펀드), 원자재는 Managed Money 기준. 매주 금요일 발표(화요일 기준)라 최대 열흘 늦을 수 있습니다. 출처: ${escapeHtml(cot.source || "CFTC")} · 기준 ${escapeHtml(cot.asOf || "")}.</p>
    </div>`;
}

// ===== 리테일 관심도 — 위키 조회수 (WIKI_ATTENTION) =====
// 최근 7일 평균 조회수가 직전 30일 평균의 몇 배인지. 검색량·멘션과 달리
// '실제로 찾아본 사람 수'라 리테일 관심의 프록시로 쓴다. 시장별 목록.
function renderWikiAttention() {
  const host = byId("wikiAttention");
  if (!host) return;
  const wa = window.WIKI_ATTENTION;
  const list = wa && (isKrMarket() ? wa.kr : wa.us);
  if (!Array.isArray(list) || list.length < 5) { host.innerHTML = ""; return; }
  const rows = list.slice(0, 10).map((r, i) => {
    const hot = r.ratio >= 1.5;
    const col = hot ? "var(--green)" : r.ratio < 0.7 ? "var(--red)" : "var(--muted)";
    const spark = Array.isArray(r.series) && r.series.length > 5 ? seasonalitySvgLine(r.series) : "";
    return `<tr>
      <td class="ins-date">${i + 1}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(r.t)}">${escapeHtml(r.company || r.t)}</button><div class="ins-sub">${escapeHtml(r.t)}</div></td>
      <td class="ins-num"><strong style="color:${col}">x${Number(r.ratio).toFixed(2)}</strong>${hot ? `<div style="font-size:9.5px;color:var(--green)">급증</div>` : ""}</td>
      <td class="ins-num">${Number(r.avg7).toLocaleString()}</td>
      <td class="ins-num">${Number(r.avg30).toLocaleString()}</td>
      <td style="min-width:110px">${spark}</td>
    </tr>`;
  }).join("");
  host.innerHTML = `
    <div class="section-title"><h2>리테일 관심도 (위키 조회수)</h2>
      <p>${isKrMarket() ? "한국어" : "영어"} 위키피디아 회사 문서의 최근 7일 평균 조회수를 직전 30일 평균과 비교했습니다. 관심이 몰리는 곳의 프록시일 뿐 방향 신호가 아닙니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="overflow-x:auto"><table class="insider-table" style="min-width:0"><thead><tr><th>#</th><th>종목</th><th class="ins-num">배율</th><th class="ins-num">7일 평균</th><th class="ins-num">직전 30일</th><th>30일 추이</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p style="font-size:var(--fs-cap);color:var(--muted);margin:10px 0 0;line-height:1.65">봇 트래픽 제외(user). 사명→문서 매핑이 검증된 종목만 싣습니다. 출처: ${escapeHtml(wa.source || "Wikimedia")} · ${escapeHtml(wa.updatedAtKst || "")}.</p>
    </div>`;
  host.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}

// ===== 한국 매크로 — 한국은행 ECOS (KR_ECOS_MACRO) =====
// 미국 FRED 패널의 한국판. KR 모드에서만 시장 심리지수 바로 아래에 뜬다.
// tone: "up"=오르면 나쁨(물가·환율·신용스프레드), "down"=오르면 좋음(뉴스심리).
function renderEcosMacro() {
  const host = byId("ecosMacro");
  if (!host) return;
  const m = window.KR_ECOS_MACRO;
  if (!isKrMarket() || !m || !Array.isArray(m.indicators) || !m.indicators.length) { host.innerHTML = ""; return; }
  const tiles = m.indicators.map((it) => {
    const ch = Number(it.change);
    let col = "var(--muted)";
    if (Number.isFinite(ch) && ch !== 0 && it.tone !== "neutral") {
      const positive = it.tone === "down" ? ch > 0 : ch < 0;
      col = positive ? "var(--green)" : "var(--red)";
    }
    const arrow = Number.isFinite(ch) && ch !== 0 ? (ch > 0 ? "▲" : "▼") : "";
    const spark = Array.isArray(it.series) && it.series.length > 5 ? seasonalitySvgLine(it.series) : "";
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px">
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;line-height:1.3">${escapeHtml(it.label)}</div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <strong style="font-size:19px;font-variant-numeric:tabular-nums">${Number(it.value).toLocaleString()}${escapeHtml(it.unit || "")}</strong>
        <span style="font-size:var(--fs-cap);color:${col};font-variant-numeric:tabular-nums">${arrow} ${Number.isFinite(ch) ? Math.abs(ch).toLocaleString() : ""}</span>
      </div>
      <div style="font-size:var(--fs-cap);color:var(--muted);margin-top:2px">${escapeHtml(it.changeLabel || "")}</div>
      ${spark ? `<div style="margin-top:6px">${spark}</div>` : ""}
    </article>`;
  }).join("");
  host.innerHTML = `
    <div class="section-title"><h2>한국 매크로 (한국은행 ECOS)</h2>
      <p>기준금리·국고채 커브·신용스프레드·환율·물가·뉴스심리를 한 줄로 요약했습니다. 예측이 아니라 현재 상태의 요약입니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px">${tiles}</div>
      <p style="font-size:var(--fs-cap);color:var(--muted);margin:12px 0 0;line-height:1.65">뉴스심리지수는 한국은행 실험적 통계(100=중립)입니다. 출처: ${escapeHtml(m.source || "한국은행 ECOS")} · 기준 ${escapeHtml(m.asOf || "")}.</p>
    </div>`;
}

// ===== 수출 모멘텀 — 관세청 (KR_TRADE_EXPORTS) =====
// 반도체·자동차·배터리 등 주력 품목의 월간 수출액과 YoY. 수출주 실적의 선행
// 컨텍스트로, KR 모드에서만 ECOS 매크로 아래에 뜬다.
function renderTradeExports() {
  const host = byId("tradeExports");
  if (!host) return;
  const t = window.KR_TRADE_EXPORTS;
  if (!isKrMarket() || !t || !Array.isArray(t.items) || !t.items.length) { host.innerHTML = ""; return; }
  const tiles = t.items.map((it) => {
    const yoy = Number(it.yoyPct);
    const col = Number.isFinite(yoy) ? (yoy > 0 ? "var(--green)" : yoy < 0 ? "var(--red)" : "var(--muted)") : "var(--muted)";
    const spark = Array.isArray(it.series) && it.series.length > 5 ? seasonalitySvgLine(it.series) : "";
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px">
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;line-height:1.3">${escapeHtml(it.label)}</div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <strong style="font-size:19px;font-variant-numeric:tabular-nums">$${Number(it.latestB).toLocaleString()}억</strong>
        <span style="font-size:11.5px;font-weight:600;color:${col};font-variant-numeric:tabular-nums">${Number.isFinite(yoy) ? `${yoy > 0 ? "+" : ""}${yoy}%` : "—"}</span>
      </div>
      <div style="font-size:var(--fs-cap);color:var(--muted);margin-top:2px">${escapeHtml((it.latestYm || "").replace(/^(\d{4})(\d{2})$/, "$1-$2"))} 월 수출 · 전년동월비</div>
      ${spark ? `<div style="margin-top:6px">${spark}</div>` : ""}
    </article>`;
  }).join("");
  host.innerHTML = `
    <div class="section-title"><h2>수출 모멘텀 (관세청)</h2>
      <p>주력 품목의 월간 수출액과 전년동월비입니다. 반도체·자동차 같은 수출주에게 실적 발표보다 앞서는 컨텍스트이며, 매월 15일경 전월 확정치가 반영됩니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">${tiles}</div>
      <p style="font-size:var(--fs-cap);color:var(--muted);margin:12px 0 0;line-height:1.65">금액은 미달러 기준(억달러), 24개월 추이. 출처: ${escapeHtml(t.source || "관세청")} · 기준월 ${escapeHtml(t.asOf || "")}.</p>
    </div>`;
}

// ===== 매크로 히스토리 스파크라인 (MARKET_HISTORY) =====
// 일일 1레코드씩 적립되는 자체 시계열(data/history/market_history.js). 5일 미만이면
// 선이 의미가 없어 "적립 중 (n일차)" 안내로 대신한다. 축 없는 1.5px currentColor 라인.
// 시리즈별 메타(라벨·단위·소수자리·천단위콤마 여부). 타일/상세 팝업이 공유해
// 포매팅을 한 곳에서 관리한다. cpiYoY·unemployment 는 이미 레코드에 있으나
// 미노출이던 것을 추가(각각 %).
const HISTORY_SERIES = {
  usdKrw:       { label: "원/달러 환율", unit: "원", digits: 1, group: true },
  t10y2y:       { label: "장단기 금리차 (10Y−2Y)", unit: "%p", digits: 2 },
  hySpread:     { label: "하이일드 스프레드", unit: "%p", digits: 2 },
  cpiYoY:       { label: "CPI 물가 (YoY)", unit: "%", digits: 1 },
  unemployment: { label: "실업률", unit: "%", digits: 1 },
};

function fmtHist(key, v) {
  const s = HISTORY_SERIES[key];
  if (!s || !Number.isFinite(v)) return String(v);
  const n = s.group ? v.toLocaleString(undefined, { maximumFractionDigits: s.digits }) : v.toFixed(s.digits);
  return `${n}${s.unit}`;
}

// 첫 기록 대비 변화량. 부호(+/−)를 붙이고 단위는 값과 동일하게 맞춘다.
function fmtHistDelta(key, d) {
  const s = HISTORY_SERIES[key];
  if (!s || !Number.isFinite(d)) return "—";
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  const a = Math.abs(d);
  const n = s.group ? a.toLocaleString(undefined, { maximumFractionDigits: s.digits }) : a.toFixed(s.digits);
  return `${sign}${n}${s.unit}`;
}

function historySeries(key) {
  const recs = (window.MARKET_HISTORY || {}).records;
  if (!Array.isArray(recs)) return [];
  return recs.map((r) => Number(r && r[key])).filter(Number.isFinite);
}

// 값과 날짜를 함께 뽑는다(상세 팝업의 min/max/최신 라벨용). 유한값만.
function historyRecords(key) {
  const recs = (window.MARKET_HISTORY || {}).records;
  if (!Array.isArray(recs)) return [];
  const out = [];
  for (const r of recs) {
    const v = Number(r && r[key]);
    if (Number.isFinite(v)) out.push({ date: String((r && r.date) || ""), value: v });
  }
  return out;
}

function historySparkSvg(vals, w = 130, h = 34) {
  if (!Array.isArray(vals) || vals.length < 2) return "";
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || Math.abs(max) * 0.01 || 1;
  const pad = 3;
  const x = (i) => pad + (w - pad * 2) * i / (vals.length - 1);
  const y = (v) => pad + (h - pad * 2) * (1 - (v - min) / span);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lx = x(vals.length - 1).toFixed(1), ly = y(vals[vals.length - 1]).toFixed(1);
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="display:block;max-width:100%">`
    + `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<circle cx="${lx}" cy="${ly}" r="2" fill="currentColor"/></svg>`;
}

// 상세용 큰 스파크라인 — 선 + 최소/최대/최신 지점 강조. 축 없는 얇은 라인 기조 유지.
function historyDetailSvg(recs, w = 400, h = 96) {
  if (!Array.isArray(recs) || recs.length < 2) return "";
  const vals = recs.map((r) => r.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || Math.abs(max) * 0.01 || 1;
  const pad = 8;
  const x = (i) => pad + (w - pad * 2) * i / (vals.length - 1);
  const y = (v) => pad + (h - pad * 2) * (1 - (v - min) / span);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const iMin = vals.indexOf(min), iMax = vals.indexOf(max), iLast = vals.length - 1;
  const dot = (i, r, fill, op) => `<circle cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="${r}" fill="${fill}"${op ? ` fill-opacity="${op}"` : ""}/>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true" style="display:block;max-width:100%">`
    + `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-opacity="0.5" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`
    + dot(iMax, 2.4, "#30a46c") + dot(iMin, 2.4, "#e5484d") + dot(iLast, 3, "currentColor")
    + `</svg>`;
}

// 히스토리 타일: 현재값 + (5일치부터) 스파크라인. 그 전엔 적립 안내만.
// 2레코드 이상이면 클릭/키보드로 상세 팝업을 연다(data-hist-key 로 위임 배선).
function historyTile(key) {
  const s = HISTORY_SERIES[key];
  if (!s) return "";
  const vals = historySeries(key);
  if (!vals.length) return "";
  const last = vals[vals.length - 1];
  const body = vals.length >= 5
    ? historySparkSvg(vals)
    : `<div style="font-size:var(--fs-cap);color:var(--muted)">히스토리 적립 중 (${vals.length}일차)</div>`;
  const clickable = vals.length >= 2;
  const attrs = clickable
    ? ` role="button" tabindex="0" data-hist-key="${escapeHtml(key)}" aria-label="${escapeHtml(s.label)} 추이 자세히 보기" style="background:var(--panel-soft);border-radius:12px;padding:12px 14px;color:var(--text);cursor:pointer"`
    : ` style="background:var(--panel-soft);border-radius:12px;padding:12px 14px;color:var(--text)"`;
  return `<article${attrs}>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:11.5px;color:var(--muted)">${escapeHtml(s.label)}</span>
      ${clickable ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted);opacity:.7;margin-left:auto;flex-shrink:0" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>` : ""}
    </div>
    <div style="font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;margin-bottom:6px">${fmtHist(key, last)}</div>
    ${body}</article>`;
}

// 히스토리 타일 클릭 → 상세 팝업. 앱 공용 <dialog>(.app-dialog) 스타일을 재사용해
// 테마·backdrop·포커스트랩·Esc 를 그대로 얻는다(appDialog 는 textContent 전용이라
// SVG 를 못 담아 전용 함수로 분리). 큰 스파크라인 + 최소/최대/최신/변화 통계.
function openHistoryDetail(key) {
  const s = HISTORY_SERIES[key];
  if (!s) return;
  const recs = historyRecords(key);
  if (!recs.length) return;
  const vals = recs.map((r) => r.value);
  const enough = vals.length >= 2;
  const min = Math.min(...vals), max = Math.max(...vals);
  const iMin = vals.indexOf(min), iMax = vals.indexOf(max);
  const first = recs[0], latest = recs[recs.length - 1];
  const change = latest.value - first.value;
  const changeCol = change > 0 ? "var(--green,#30a46c)" : change < 0 ? "var(--red,#e5484d)" : "var(--muted)";
  const dateTxt = (d) => escapeHtml(String(d || "").slice(5)) || "—";

  const chart = enough
    ? `<div style="color:var(--text);margin:6px 0 4px">${historyDetailSvg(recs)}</div>
       <div style="display:flex;justify-content:space-between;font-size:var(--fs-cap);color:var(--muted);margin-bottom:12px">
         <span>${dateTxt(first.date)}</span><span>${dateTxt(latest.date)}</span></div>`
    : "";
  const note = vals.length < 5
    ? `<div style="font-size:var(--fs-cap);color:var(--muted);margin-bottom:12px">히스토리 적립 중 (${vals.length}일차) — 5일치부터 추이가 뚜렷해집니다.</div>`
    : "";

  const statRow = (lbl, val, sub, col) => `<div style="display:flex;flex-direction:column;gap:2px;min-width:0">
      <span style="font-size:var(--fs-cap);color:var(--muted)">${escapeHtml(lbl)}</span>
      <span style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:${col || "var(--text)"}">${val}</span>
      ${sub ? `<span style="font-size:var(--fs-cap);color:var(--muted)">${sub}</span>` : ""}
    </div>`;
  const stats = enough
    ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
        ${statRow("최신", fmtHist(key, latest.value), dateTxt(latest.date))}
        ${statRow("첫 기록 대비", fmtHistDelta(key, change), `${fmtHist(key, first.value)} → ${fmtHist(key, latest.value)}`, changeCol)}
        ${statRow("최고", fmtHist(key, max), dateTxt(recs[iMax] && recs[iMax].date), "var(--green,#30a46c)")}
        ${statRow("최저", fmtHist(key, min), dateTxt(recs[iMin] && recs[iMin].date), "var(--red,#e5484d)")}
      </div>`
    : `<div>${statRow("현재값", fmtHist(key, latest.value), dateTxt(latest.date))}</div>`;

  const dlg = document.createElement("dialog");
  dlg.className = "app-dialog";
  dlg.style.width = "min(440px, calc(100vw - 32px))";
  dlg.setAttribute("aria-label", `${s.label} 추이`);
  dlg.innerHTML = `
    <h2 class="app-dialog-title">${escapeHtml(s.label)}</h2>
    <div style="font-size:var(--fs-cap);color:var(--muted);margin-bottom:10px">최근 ${vals.length}일 자체 적립 히스토리</div>
    ${chart}${note}${stats}
    <div class="app-dialog-actions"><button type="button" class="app-dialog-btn is-primary" data-hist-close>닫기</button></div>`;
  document.body.appendChild(dlg);

  const close = () => {
    dlg.addEventListener("close", () => dlg.remove(), { once: true });
    if (dlg.open) dlg.close(); else dlg.remove();
  };
  dlg.querySelector("[data-hist-close]").addEventListener("click", close);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });     // Esc
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });     // backdrop
  dlg.showModal();
  const btn = dlg.querySelector("[data-hist-close]");
  if (btn) btn.focus();
}

// 시장 심리 종합지수 (Fear & Greed) — 이미 수집하는 지표를 0~100 으로 종합. CNN 스타일의
// 구성요소별 정규화 평균. 예측이 아니라 '지금 시장이 공포인가 탐욕인가'의 상태 요약.
function fearGreedComponents() {
  const stocks = (data && Array.isArray(data.stocks) ? data.stocks : []).filter((s) => !isStockEtf(s));
  const comps = [];
  const clamp = (v) => Math.max(0, Math.min(100, v));
  if (stocks.length >= 20) {
    const up = stocks.filter((s) => Number(s.changePct) > 0).length;
    const down = stocks.filter((s) => Number(s.changePct) < 0).length;
    if (up + down > 0) comps.push({ key: "시장 폭", score: clamp(up / (up + down) * 100), detail: "상승/하락 종목" });
    let posM = 0, totM = 0;
    for (const s of stocks) { const v = Number(s.monthChangePct); if (Number.isFinite(v)) { totM++; if (v > 0) posM++; } }
    if (totM > 0) comps.push({ key: "모멘텀", score: clamp(posM / totM * 100), detail: "1개월 상승 비율" });
    const highs = stocks.filter((s) => Number(s.newHighDistancePct) <= 2).length;
    const lows = stocks.filter((s) => { const d = (typeof low52DistPct === "function") ? low52DistPct(s) : NaN; return Number.isFinite(d) && d <= 5; }).length;
    if (highs + lows > 0) comps.push({ key: "주가 강도", score: clamp(highs / (highs + lows) * 100), detail: "신고가 vs 신저가" });
  }
  // 옵션 풋콜·신용스프레드·VIX 는 US 전용 데이터(OPTIONS_STATS·MACRO_INDICATORS
  // 는 미국 시장만 수집). KR 모드에서 이걸 섞으면 미국이 탐욕일 때 국내 주식이
  // 공포여도 종합이 탐욕으로 끌려간다(2026-07-24 사용자 지적). KR 은 시장 자체
  // 지표(시장 폭·모멘텀·주가 강도)만으로 심리를 구성한다.
  if (!isKrMarket()) {
    const os = window.OPTIONS_STATS;
    const pc = os && os.market && Number(os.market.putCallOI);
    if (Number.isFinite(pc)) comps.push({ key: "옵션 (풋/콜)", score: clamp((1.25 - pc) / (1.25 - 0.65) * 100), detail: `풋콜 ${pc.toFixed(2)}` });
    const macro = window.MACRO_INDICATORS;
    if (macro && Array.isArray(macro.indicators)) {
      const hy = macro.indicators.find((i) => i.id === "BAMLH0A0HYM2");
      if (hy && Number.isFinite(Number(hy.value))) comps.push({ key: "정크본드 수요", score: clamp((6 - Number(hy.value)) / (6 - 2.5) * 100), detail: `HY 스프레드 ${hy.value}%p` });
      const vix = macro.indicators.find((i) => i.id === "VIXCLS");
      if (vix && Number.isFinite(Number(vix.value))) comps.push({ key: "변동성 (VIX)", score: clamp((30 - Number(vix.value)) / (30 - 12) * 100), detail: `VIX ${vix.value}` });
    }
  }
  return comps;
}

function fearGreedLabel(v) {
  return v < 25 ? { t: "극단적 공포", c: "#e5484d" } : v < 45 ? { t: "공포", c: "#e5894d" }
    : v <= 55 ? { t: "중립", c: "#c2a63a" } : v <= 75 ? { t: "탐욕", c: "#57a83a" } : { t: "극단적 탐욕", c: "#30a46c" };
}

// 게이지 아래 히스토리: 매일 적립되는 기록치 기반 추이(fearGreed). 데이터가 아예
// 없으면(파일 미배포) 아무것도 그리지 않는다 — 없는 데이터는 기능을 끈다.
function fgHistBlock() {
  const vals = historySeries("fearGreed");
  if (!vals.length) return "";
  if (vals.length < 5) {
    return `<div style="margin-top:10px;font-size:var(--fs-cap);color:var(--muted)">지수 히스토리 적립 중 (${vals.length}일차) — 5일치부터 추이를 그립니다.</div>`;
  }
  return `<div style="display:flex;align-items:center;gap:10px;margin-top:12px;color:var(--muted)">
    <span style="font-size:var(--fs-cap);flex-shrink:0">최근 ${vals.length}일</span>${historySparkSvg(vals, 180, 36)}</div>`;
}

// 자체 심리지수 아래 붙는 외부 게이지 비교(SENTIMENT_GAUGES). 데이터 없으면 "".
// CNN 은 비공식 수집이라 언제든 빠질 수 있고, 그때는 크립토만 남는다.
function externalGaugesHtml() {
  const g = window.SENTIMENT_GAUGES;
  if (!g || (!g.cnn && !g.crypto)) return "";
  const tile = (name, v, label) => {
    if (!Number.isFinite(Number(v))) return "";
    const lab = fearGreedLabel(Number(v));
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:10px 14px;min-width:150px">
      <div style="font-size:var(--fs-cap);color:var(--muted);margin-bottom:4px">${name}</div>
      <div style="display:flex;align-items:baseline;gap:8px"><strong style="font-size:20px;font-variant-numeric:tabular-nums;color:${lab.c}">${Math.round(v)}</strong><span style="font-size:var(--fs-cap);color:${lab.c}">${escapeHtml(label || lab.t)}</span></div>
    </article>`;
  };
  const tiles = [
    g.cnn ? tile("CNN Fear & Greed (미국 주식)", g.cnn.value, "") : "",
    g.crypto ? tile("크립토 공포탐욕", g.crypto.value, "") : "",
  ].filter(Boolean).join("");
  if (!tiles) return "";
  return `<div style="margin-top:14px">
    <div style="font-size:var(--fs-cap);color:var(--muted);margin-bottom:6px">외부 게이지 비교 · ${escapeHtml(g.updatedAtKst || "")}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${tiles}</div>
  </div>`;
}

function renderFearGreed() {
  const host = byId("fearGreed");
  if (!host) return;
  const comps = fearGreedComponents();
  if (comps.length < 2) { host.innerHTML = ""; return; }
  const value = Math.round(comps.reduce((a, c) => a + c.score, 0) / comps.length);
  const lab = fearGreedLabel(value);
  // 그라디언트 바 + 마커
  const bar = `<div style="position:relative;height:14px;border-radius:8px;background:linear-gradient(90deg,#e5484d,#e5894d,#c2a63a,#57a83a,#30a46c)">
      <div style="position:absolute;left:${value}%;top:-4px;transform:translateX(-50%);width:4px;height:22px;background:var(--text);border-radius:2px;box-shadow:0 0 0 2px var(--panel)"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:var(--fs-cap);color:var(--muted);margin-top:4px"><span>공포 0</span><span>중립 50</span><span>탐욕 100</span></div>`;
  const subs = comps.map((c) => {
    const cl = fearGreedLabel(c.score);
    return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
      <span style="width:88px;font-size:11.5px;color:var(--muted)">${escapeHtml(c.key)}</span>
      <div style="flex:1;height:6px;border-radius:3px;background:var(--panel-soft);overflow:hidden"><div style="width:${c.score}%;height:100%;background:${cl.c}"></div></div>
      <span style="width:82px;text-align:right;font-size:var(--fs-cap);color:var(--muted)">${escapeHtml(c.detail)}</span>
    </div>`;
  }).join("");
  host.innerHTML = `
    <div class="section-title"><h2>시장 심리 종합지수</h2>
      <p>${isKrMarket() ? "국내 시장 지표(시장 폭·모멘텀·주가 강도)를" : "이미 수집하는 지표(시장 폭·모멘텀·주가 강도·옵션 풋콜·신용스프레드)를"} 0~100으로 종합했습니다. 예측이 아니라 현재 공포/탐욕 상태의 요약입니다.</p></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:8px">
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px">
        <strong style="font-size:34px;font-variant-numeric:tabular-nums;color:${lab.c}">${value}</strong>
        <strong style="font-size:16px;color:${lab.c}">${lab.t}</strong>
        <span style="font-size:var(--fs-cap);color:var(--muted);margin-left:auto">${comps.length}개 요소 평균</span>
      </div>
      ${bar}
      ${fgHistBlock()}
      <div style="margin-top:14px">${subs}</div>
      ${externalGaugesHtml()}
      <p style="font-size:var(--fs-cap);color:var(--muted);margin:12px 0 0;line-height:1.65">각 요소를 0(공포)~100(탐욕)으로 정규화해 단순 평균했습니다. 극단값에서 되돌림이 잦다는 해석이 있으나 시점 신호로 쓰긴 어렵습니다.</p>
    </div>`;
}

// FRED 매크로 지표 — 인플레·고용·금리·신용스프레드·소비심리. 현재값 + 전월/전주 대비.
// tone 으로 '오르는 게 나쁜' 지표(인플레·실업·스프레드)는 상승을 red 로 칠한다.
function renderMacroIndicators() {
  const host = byId("macroIndicators");
  if (!host) return;
  const m = window.MACRO_INDICATORS;
  if (!m || !Array.isArray(m.indicators) || !m.indicators.length) { host.innerHTML = ""; return; }
  const tile = (it) => {
    const ch = Number(it.change);
    let col = "var(--muted)";
    if (Number.isFinite(ch) && ch !== 0 && it.tone !== "neutral") {
      const goodUp = it.tone === "down"; // "down" tone = 높을수록 좋음
      const positive = goodUp ? ch > 0 : ch < 0;
      col = positive ? "var(--green)" : "var(--red)";
    }
    const arrow = Number.isFinite(ch) && ch !== 0 ? (ch > 0 ? "▲" : "▼") : "";
    return `<article style="background:var(--panel-soft);border-radius:12px;padding:12px 14px">
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;line-height:1.3">${escapeHtml(it.label)}</div>
      <div style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">${escapeHtml(it.value ?? "")}${escapeHtml(it.unit || "")}</div>
      <div style="font-size:var(--fs-cap);color:${col};font-variant-numeric:tabular-nums;margin-top:3px">${arrow} ${Number.isFinite(ch) ? (ch > 0 ? "+" : "") + ch + (it.unit || "") : "—"} <span style="color:var(--muted)">· ${escapeHtml(String(it.date || "").slice(0, 7))}</span></div>
    </article>`;
  };
  // 자체 적립 히스토리(MARKET_HISTORY)가 있으면 환율·금리차·신용스프레드·CPI·실업률
  // 추이를 붙인다. 타일 클릭 시 상세 팝업(min/max/변화)을 연다.
  const histTiles = ["usdKrw", "t10y2y", "hySpread", "cpiYoY", "unemployment"]
    .map(historyTile).filter(Boolean).join("");
  const histBlock = histTiles
    ? `<div class="section-title" style="margin-top:6px"><h2>매크로 추이</h2>
        <p>일일 스냅샷을 적립한 자체 히스토리입니다 (하루 1회 기록). 5일치부터 추이 선을 그립니다.</p></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:8px">${histTiles}</div>`
    : "";
  host.innerHTML = `
    <div class="section-title"><h2>매크로 지표</h2>
      <p>FRED 기준 핵심 거시지표입니다. 화살표 색은 방향의 좋고 나쁨(인플레·실업·신용스프레드는 상승이 부정적). 예측이 아니라 현재값·직전 대비입니다.</p></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:8px">${m.indicators.map(tile).join("")}</div>
    ${histBlock}`;
  // 히스토리 타일 클릭/키보드 → 상세 팝업(위임 대신 직접 배선; 타일 수가 적다).
  host.querySelectorAll("[data-hist-key]").forEach((el) => {
    const key = el.getAttribute("data-hist-key");
    el.addEventListener("click", () => openHistoryDetail(key));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openHistoryDetail(key); }
    });
  });
}

// 시그널 탭은 피처 데이터셋이 도착할 때마다(refreshFeatureViews) 다시 그려졌다 — 탭이 숨어
// 있어도. 보일 때만 그리고, 숨어 있으면 dirty 로 표시해 다음 진입 때 한 번 그린다.
let signalsDirty = true;
const SIGNALS_FEATURE_KEYS = [
  "yieldCurve", "macro", "cotPositioning", "treasuryAuctions", "wikiAttention", "sentimentGauges",
  "ecosMacro", "tradeExports", "optionsStats", "marketHistory",
  // Smart-money signals read the heavy 13F/congress/insider datasets; they're excluded from
  // the boot prefetch and load on first visit.
  "insider", "congress", "inst13f",
];
function renderSignalsIfVisible() {
  if (currentTab === "signals") {
    renderSignals();
    signalsDirty = false;
    tabRendered.signals = true;
  } else {
    signalsDirty = true;
  }
}

function renderSignals() {
  renderFearGreed();
  renderMacroIndicators();
  renderYieldCurve();
  renderEcosMacro();
  renderTradeExports();
  renderTreasuryAuctions();
  renderCotPositioning();
  renderWikiAttention();
  const el = byId("signalsGrid");
  if (!el) return;
  const cards = [];
  const cfg = marketCfg();
  const minCapForHighs = isKrMarket() ? 1 : 2;
  if (!isKrMarket()) {
    // 내부자 클러스터 매수
    const ins = (window.INSIDER_TRADES || {}).trades || [];
    const byT = {};
    for (const r of ins) {
      if (r.kind !== "buy" || !r.ticker) continue;
      const g = byT[r.ticker] || (byT[r.ticker] = { t: r.ticker, owners: new Set(), v: 0 });
      g.owners.add(r.owner || "?"); g.v += Number(r.value) || 0;
    }
    const clusters = Object.values(byT).filter((g) => g.owners.size >= 2).sort((a, b) => b.owners.size - a.owners.size || b.v - a.v).slice(0, 8);
    cards.push(signalCard("내부자 클러스터 매수", clusters.map((g) => ({ ticker: g.t, note: `${g.owners.size}명 · ${insiderFmtUsd(g.v)}` })), "2인+ 임원 공개시장 매수"));
  }
  // 52주 신고가 근접 — 합성 이력은 52주 고점 자체가 랜덤워크가 만든 값이라 제외한다.
  const highs = data.stocks.filter((s) => !isStockEtf(s) && !isSyntheticHistory(s) && Number(s.newHighDistancePct) <= 0.5 && (s.marketCapB || 0) >= minCapForHighs)
    .sort((a, b) => b.marketCapB - a.marketCapB).slice(0, 8);
  cards.push(signalCard("52주 신고가 근접", highs.map((s) => ({ ticker: s.ticker, note: `${priceOrDash(s.price)} · ${fmtDailyPct(s.changePct)}` })), "고점 0.5% 이내"));
  if (cfg.features?.materialEvents !== false) {
    const ev = ((window.MATERIAL_EVENTS || {}).events || []).filter((e) => e.hot).slice(0, 8);
    cards.push(signalCard("주요 공시 8-K", ev.map((e) => ({ ticker: e.ticker, note: (e.items || []).map((i) => i.label).slice(0, 2).join(", ") }))));
  }
  if (!isKrMarket()) {
    const act = ((window.ACTIVIST_STAKES || {}).filings || []).filter((a) => a.kind === "activist").slice(0, 8);
    cards.push(signalCard("액티비스트 13D", act.map((a) => ({ ticker: a.ticker, note: a.filer || "" }))));
  }
  if (cfg.features?.ipo !== false) {
    const ipo = ((window.IPO_CALENDAR || {}).ipos || []).filter((i) => i.stage === "priced").slice(0, 8);
    cards.push(signalCard("신규 상장(가격확정)", ipo.map((i) => ({ ticker: i.ticker || "—", note: i.company || "" }))));
  }
  el.innerHTML = cards.join("");
  el.querySelectorAll(".ins-ticker").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.ticker && b.dataset.ticker !== "—") selectTicker(b.dataset.ticker, { openSearch: true });
  }));
  renderAggregateInsights();
  renderSignalsSummary();
  syncSignalFolds();
}

// ===== 집계 인사이트 (의회·내부자 종합) =====
function aggBars(items, fmtVal, color) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return items.map((i) => {
    const lbl = i.ticker
      ? `<button type="button" class="agg-label ins-ticker" data-ticker="${escapeHtml(i.ticker)}">${escapeHtml(i.label)}</button>`
      : `<span class="agg-label">${escapeHtml(i.label)}</span>`;
    return `<div class="agg-row">${lbl}<div class="agg-bar-wrap"><div class="agg-bar" style="width:${(i.value / max * 100).toFixed(1)}%;background:${color}"></div></div><span class="agg-val">${fmtVal(i.value)}</span></div>`;
  }).join("");
}
function renderAggregateInsights() {
  const el = byId("aggInsights");
  if (!el) return;
  if (isKrMarket()) { el.innerHTML = ""; return; }
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const usd = (v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
  const cards = [];
  // 의회 30일 순매수 TOP5
  const cg = (window.CONGRESS_TRADES || {}).byTicker || {};
  const netByT = [];
  for (const [t, info] of Object.entries(cg)) {
    let net = 0;
    for (const tr of (info.trades || [])) {
      if ((tr.transactionDate || "") < cutoff) continue;
      const amt = Number(tr.amountMid) || 0;
      net += (tr.side === "buy" || tr.type === "Purchase") ? amt : -amt;
    }
    if (net > 0) netByT.push({ ticker: t, label: t, value: net });
  }
  netByT.sort((a, b) => b.value - a.value);
  cards.push(`<div class="agg-card"><h3>의원 순매수 TOP5</h3>${netByT.length ? aggBars(netByT.slice(0, 5), usd, "#3b82f6") : '<p class="muted">최근 30일 순매수 데이터 없음</p>'}</div>`);
  // 내부자 매수 거래대금 섹터 랭킹 (30일)
  const ins = (window.INSIDER_TRADES || {}).trades || [];
  const bySec = {};
  for (const r of ins) {
    if (r.kind !== "buy" || (r.fileDate || "") < cutoff) continue;
    const st = stockByTicker(r.ticker);
    if (!st || !st.sector) continue;
    bySec[st.sector] = (bySec[st.sector] || 0) + (Number(r.value) || 0);
  }
  const secRows = Object.entries(bySec).map(([s, v]) => ({ label: s, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);
  cards.push(`<div class="agg-card"><h3>‍내부자 매수대금 섹터 랭킹</h3>${secRows.length ? aggBars(secRows, usd, "#16a34a") : '<p class="muted">최근 30일 내부자 매수 데이터 없음</p>'}</div>`);
  el.innerHTML = cards.join("");
  el.querySelectorAll(".ins-ticker[data-ticker]").forEach((b) => b.addEventListener("click", () => selectTicker(b.dataset.ticker, { openSearch: true })));
}
