// shareholder.js — 종목 분석 › 재무 탭 '주주환원' 카드(배당 · 자사주 · 주식수)
// =====================================================
// 계산은 shareholder-core.js(window.MirShareholderCore) + mcap-core.js(주식수 분할 환산). 새 수집 없음:
//   배당 기록 = 종목 상세 dividends(야후 배당락 이벤트, 분할 조정) · 현재 수익률 = MAP_FUNDAMENTALS
//   EPS·주식수 = 재무 확장 파일(financials.js loadFinancials 캐시) · 자사주 = KR_DISCLOSURES/KR_EVENT_DETAILS(국내 최근 창),
//   MATERIAL_EVENTS(미국 8-K), 이벤트 스터디 종목 샤드(약 5년 공시 건수 — timeline.js tlHistoryFor 캐시를 같이 쓴다).
//   미국 주주환원 현금 = 재무 파일 buyback·divPaid·sbc(SEC 현금흐름표 실제 지급액, TTM + 최근 5개 회계연도).
//   8-K 의 '승인 한도'(이사회 승인 금액)와는 다른 값이라 카드를 따로 둔다.
// 자료가 하나도 없으면(ETF·배당·자사주 기록 없음) 카드 전체를 숨긴다. 늦게 도착한 자료는 refreshFeatureViews 가
// renderShareholder 를 다시 부른다(같은 내용이면 다시 그리지 않음).
// 클래식 스크립트(전역 공유) — 이름은 shr* / renderShareholder.

let shrSig = "";

function shrIsKr() { return typeof isKrMarket === "function" && isKrMarket(); }

function shrPerShare(v, cur) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (cur === "KRW") return `${n >= 100 ? Math.round(n).toLocaleString("ko-KR") : n.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}원`;
  return `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
}

function shrPct(v, digits = 1) {
  return Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : "—";
}

function shrSignedPct(v) {
  if (!Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function shrMoney(v, cur) {
  if (typeof mfMoney === "function") return mfMoney(v, cur);
  return Number.isFinite(v) ? Math.round(v).toLocaleString() : "—";
}

function shrHide(host) {
  host.hidden = true;
  host.innerHTML = "";
  shrSig = "";
}

// 늦게 오는 전역(국내 공시·미국 8-K)을 부르고, 오면 피처 뷰 새로고침으로 다시 그린다.
function shrEnsure(key) {
  if (typeof ensureFeatureData !== "function") return;
  ensureFeatureData(key).then((ok) => { if (ok && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
}

function shrPayoutText(p) {
  if (!p) return "—";
  if (p.deficit) return "적자";
  return shrPct(p.ratio);
}

// 주당배당금 막대(+ 미국은 배당성향 선, 오른쪽 축). 색은 재무 카드 토큰(--mf-c1 · --mfo-line).
function shrDpsSvg(years, cur, width, withPayout) {
  const W = Math.max(280, Math.round(width || 420)), H = W < 520 ? 170 : 200;
  const padL = 52, padR = withPayout ? 46 : 8, top = 16, bottom = 26;
  const n = years.length;
  if (!n) return "";
  const max = Math.max(...years.map((y) => y.dps), 0) || 1;
  const plotH = H - top - bottom;
  const y = (v) => top + (max - v) / max * plotH;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(slot * 0.6, 40);
  let bars = "", labels = "", notes = "";
  years.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2;
    if (d.count > 0) {
      const y1 = y(d.dps);
      bars += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, top + plotH - y1).toFixed(1)}" rx="2" fill="var(--mf-c1)"${d.partial ? ' fill-opacity="0.45"' : ""}><title>${escapeHtml(d.label)} 주당배당금 ${escapeHtml(shrPerShare(d.dps, cur))} · ${d.count}회${d.partial ? " (진행 중 — 지금까지)" : ""}</title></rect>`;
    } else {
      notes += `<text x="${cx.toFixed(1)}" y="${(top + plotH - 4).toFixed(1)}" text-anchor="middle" class="mf-axis shr-none">기록 없음</text>`;
    }
    const every = Math.max(1, Math.ceil(n * 46 / (W - padL - padR)));
    if ((n - 1 - i) % every === 0) labels += `<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="mf-axis">${escapeHtml(d.label)}${d.partial ? "*" : ""}</text>`;
  });
  const grid = [max, max / 2].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="mf-grid"/><text x="${padL - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="mf-axis mf-tick">${escapeHtml(shrPerShare(v, cur))}</text>`).join("");
  const zero = `<line x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="mf-zero"/>`;
  let line = "";
  if (withPayout) {
    const pv = years.map((d) => d.payout).filter(Number.isFinite);
    if (pv.length) {
      const pmax = Math.max(...pv, 0.1);
      const py = (v) => top + (pmax - v) / pmax * plotH;
      let d = "", dots = "";
      years.forEach((yr, i) => {
        const cx = padL + slot * i + slot / 2;
        if (Number.isFinite(yr.payout)) {
          d += `${d ? "L" : "M"}${cx.toFixed(1)},${py(yr.payout).toFixed(1)}`;
          dots += `<circle cx="${cx.toFixed(1)}" cy="${py(yr.payout).toFixed(1)}" r="3" class="mf-dot"><title>${escapeHtml(yr.label)} 배당성향 ${escapeHtml(shrPct(yr.payout))}</title></circle>`;
        } else if (yr.deficit) {
          dots += `<text x="${cx.toFixed(1)}" y="${(top + 10).toFixed(1)}" text-anchor="middle" class="mf-axis shr-deficit">적자</text>`;
        }
      });
      const rt = [pmax, 0].map((v) => `<text x="${W - padR + 6}" y="${(py(v) + 4).toFixed(1)}" text-anchor="start" class="mf-axis mf-tick mf-tick-r">${escapeHtml(shrPct(v, 0))}</text>`).join("");
      line = `<g class="mf-line-g mfo-line"><path d="${d}" class="mf-line"/>${dots}${rt}</g>`;
    }
  }
  return `<svg class="mf-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="연도별 주당배당금 차트">${grid}${zero}${bars}${notes}${line}${labels}</svg>`;
}

function shrDpsTable(years, cur, withPayout) {
  const head = `<th>기간</th><th class="ins-num">주당배당금</th><th class="ins-num">횟수</th>${withPayout ? '<th class="ins-num">EPS(환산)</th><th class="ins-num">배당성향</th>' : ""}`;
  const body = years.slice().reverse().map((d) => `<tr><th scope="row">${escapeHtml(d.label)}${d.partial ? " *" : ""}</th>
    <td class="ins-num">${d.count ? escapeHtml(shrPerShare(d.dps, cur)) : "기록 없음"}</td><td class="ins-num">${d.count}</td>
    ${withPayout ? `<td class="ins-num">${Number.isFinite(d.eps) ? escapeHtml(shrPerShare(d.eps, cur)) : "—"}</td><td class="ins-num">${d.partial ? "—" : escapeHtml(shrPayoutText(d.deficit ? { deficit: true } : Number.isFinite(d.payout) ? { ratio: d.payout } : null))}</td>` : ""}</tr>`).join("");
  return `<div class="table-wrap mf-table-wrap cc-table-wrap"><table class="insider-table mf-table cc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// 배당락 후 회복(填息天數) — 최근 회차 표. 회복 못 한 회차는 '-' 와 지금까지 경과.
function shrRecoveryTable(rec, cur) {
  const body = rec.rows.map((r) => `<tr><th scope="row" title="${escapeHtml(r.date)}">${escapeHtml(r.date.slice(2))}</th>
    <td class="ins-num">${escapeHtml(shrPerShare(r.amt, cur))}</td>
    <td class="ins-num">${escapeHtml(shrPerShare(r.baseClose, cur))}</td>
    <td class="ins-num">${r.recovered
      ? `${escapeHtml(r.recDate.slice(2))}<span class="shr-rec-sub">${r.tradingDays}거래일 · ${r.calendarDays}일</span>`
      : `-<span class="shr-rec-sub">미회복 · ${r.tradingDays}거래일째</span>`}</td></tr>`).join("");
  return `<div class="table-wrap mf-table-wrap cc-table-wrap"><table class="insider-table mf-table cc-table shr-rec-table">
    <thead><tr><th>배당락일</th><th class="ins-num">주당배당</th><th class="ins-num" title="배당락일 직전 거래일 종가">기준가</th><th class="ins-num" title="종가가 기준가 이상이 된 첫날 · 걸린 기간">회복일</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function shrKpis(s, cur, growth, pref) {
  const tiles = [];
  tiles.push(["배당 주기", s.frequency.label, s.lastDividend ? `최근 배당락 ${s.lastDividend.date}` : ""]);
  tiles.push(["최근 1년 주당배당금", s.trailing.count ? shrPerShare(s.trailing.sum, cur) : "—", s.trailing.count ? `${s.trailing.count}회 · 배당락일 기준` : "최근 1년 기록 없음"]);
  tiles.push(["배당수익률(현재)", Number.isFinite(s.yieldPct) ? `${s.yieldPct.toFixed(2)}%` : "—", ""]);
  const p = s.ttmPayout;
  tiles.push(["배당성향", shrPayoutText(p), p ? (p.basis === "ttm" ? "최근 1년 배당 ÷ 최근 4분기 EPS" : "직전 결산") : ""]);
  // 배당 성장 이력(DIVIDEND_GROWTH — 미국 야후 1985~, 국내 DART 사업보고서 2013~). 연속이 기록 첫머리에 닿으면 'N년+'.
  const dg = window.MirDivGrowthCore;
  if (growth && dg) {
    tiles.push(["연속 배당 증가", dg.streakText(growth), dg.subText(growth)]);
    tiles.push(["연속 배당 지급", dg.paidText(growth), growth.cagr10 != null ? `10년 연평균 ${dg.cagrText(growth.cagr10)}` : ""]);
  }
  // 국내 우선주(보통주 화면에 함께) — 최근 사업연도 주당배당금 · 연속 지급 · 연속 증가.
  if (pref && dg) {
    tiles.push([`우선주 배당 · ${pref.name || pref.ticker}`, Number.isFinite(pref.last) ? shrPerShare(pref.last, cur) : "—",
      [pref.lastYear ? `${pref.lastYear}년` : "", `연속 지급 ${dg.paidText(pref)}`, `연속 증가 ${dg.streakText(pref)}`].filter(Boolean).join(" · ")]);
  }
  return `<dl class="shr-kpis${tiles.length > 4 ? " shr-kpis-6" : ""}">${tiles.map(([k, v, sub]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>${sub ? `<dd class="shr-kpi-sub">${escapeHtml(sub)}</dd>` : ""}</div>`).join("")}</dl>`;
}

function shrBuybackBody(o) {
  const { kr, cur, share, recent, hist, us8k, discWindow } = o;
  const parts = [];
  if (share) {
    const basis = share.basis === "dil" ? "희석 가중평균" : (kr ? "기말 유통주식수" : "기말 발행주식수");
    parts.push(`<div class="shr-row"><span class="shr-k">주식수 변화</span><span class="shr-v">1년 <b>${escapeHtml(shrSignedPct(share.y1Pct))}</b>${share.y3Pct !== null ? ` · 3년 <b>${escapeHtml(shrSignedPct(share.y3Pct))}</b>` : ""}</span>`
      + `<span class="shr-sub">${escapeHtml(basis)} · 분할 환산 · ${escapeHtml(share.lastEnd)} 결산 기준</span></div>`);
  }
  if (kr && recent && recent.rows.length) {
    const rows = recent.rows.slice(0, 6).map((r) => `<tr><td class="ins-date">${escapeHtml(r.date)}</td><td>${r.link ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener">${escapeHtml(r.label)}</a>` : escapeHtml(r.label)}</td>`
      + `<td class="ins-num">${r.amount ? escapeHtml(shrMoney(r.amount, "KRW")) : "—"}</td><td class="ins-num">${r.shares ? escapeHtml(Math.round(r.shares).toLocaleString("ko-KR")) + "주" : "—"}</td></tr>`).join("");
    parts.push(`<div class="shr-block"><p class="shr-k">최근 자기주식 공시 <span class="shr-sub">${escapeHtml(discWindow || "최근 공시 창")}</span></p>
      <div class="table-wrap mf-table-wrap"><table class="insider-table mf-table cc-table"><thead><tr><th>공시일</th><th>유형</th><th class="ins-num">금액</th><th class="ins-num">주식수</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
  }
  if (!kr && us8k && us8k.length) {
    const confirmed = us8k.filter((r) => r.confirmed && r.amount);
    const mention = us8k.length - confirmed.length;
    const rows = confirmed.slice(0, 5).map((r) => `<tr><td class="ins-date">${escapeHtml(r.date)}</td><td class="ins-num">${escapeHtml(shrMoney(r.amount, "USD"))}</td><td>${r.link ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener">8-K 원문</a>` : ""}</td></tr>`).join("");
    parts.push(`<div class="shr-block"><p class="shr-k">자사주 매입 발표 <span class="shr-sub">최근 수집분${mention ? ` · 금액 미확인 ${mention}건` : ""}</span></p>
      ${rows ? `<div class="table-wrap mf-table-wrap"><table class="insider-table mf-table cc-table"><thead><tr><th>공시일</th><th class="ins-num">승인 한도</th><th>원문</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted shr-sub">금액이 확인된 발표는 없습니다.</p>`}</div>`);
  }
  if (hist) {
    const kinds = Object.keys(hist.kinds);
    const head = kinds.map((k) => `<th class="ins-num">${escapeHtml(hist.labels[k] || k)}</th>`).join("");
    const body = hist.years.slice().reverse().map((y) => `<tr><th scope="row">${escapeHtml(y.year)}</th>${kinds.map((k) => `<td class="ins-num">${y.counts[k] || "—"}</td>`).join("")}</tr>`).join("");
    parts.push(`<div class="shr-block"><p class="shr-k">자사주 관련 공시 건수 <span class="shr-sub">${escapeHtml(hist.first.slice(0, 7))}~${escapeHtml(hist.last.slice(0, 7))} · 건수만(금액 없음)</span></p>
      <div class="table-wrap mf-table-wrap"><table class="insider-table mf-table cc-table"><thead><tr><th>연도</th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`);
  }
  return parts.join("");
}

// 미국 주주환원 현금(실제 지급액) — 회계연도 막대(자사주 + 배당 누적). 결측은 '—' 표기, 0 으로 그리지 않는다.
function shrCashSvg(years, width) {
  const W = Math.max(280, Math.round(width || 420)), H = W < 520 ? 170 : 200;
  const padL = 56, padR = 8, top = 16, bottom = 26;
  const n = years.length;
  if (!n) return "";
  const stack = (y) => (Number.isFinite(y.buyback) ? y.buyback : 0) + (Number.isFinite(y.div) ? y.div : 0);
  const max = Math.max(...years.map(stack), 0) || 1;
  const plotH = H - top - bottom;
  const yy = (v) => top + (max - v) / max * plotH;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(slot * 0.6, 40);
  let bars = "", labels = "";
  years.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2;
    const x = (cx - bw / 2).toFixed(1);
    const tip = `FY${d.fy} 자사주 ${shrMoney(d.buyback, "USD")} · 배당 ${shrMoney(d.div, "USD")}`;
    let base = 0;
    [["buyback", "var(--mf-c1)"], ["div", "var(--mf-c2)"]].forEach(([k, color]) => {
      const v = d[k];
      if (!Number.isFinite(v) || v <= 0) return;
      const y1 = yy(base + v), y0 = yy(base);
      bars += `<rect x="${x}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, y0 - y1).toFixed(1)}" fill="${color}"><title>${escapeHtml(tip)}</title></rect>`;
      base += v;
    });
    if (!Number.isFinite(d.buyback) && !Number.isFinite(d.div)) {
      bars += `<text x="${cx.toFixed(1)}" y="${(top + plotH - 4).toFixed(1)}" text-anchor="middle" class="mf-axis shr-none">—</text>`;
    }
    labels += `<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="mf-axis">FY${escapeHtml(String(d.fy).slice(-2))}</text>`;
  });
  const grid = [max, max / 2].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${yy(v).toFixed(1)}" y2="${yy(v).toFixed(1)}" class="mf-grid"/><text x="${padL - 6}" y="${(yy(v) + 4).toFixed(1)}" text-anchor="end" class="mf-axis mf-tick">${escapeHtml(shrMoney(v, "USD"))}</text>`).join("");
  const zero = `<line x1="${padL}" x2="${W - padR}" y1="${yy(0).toFixed(1)}" y2="${yy(0).toFixed(1)}" class="mf-zero"/>`;
  return `<svg class="mf-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="회계연도별 자사주 매입·배당 지급 차트">${grid}${zero}${bars}${labels}</svg>`;
}

function shrCashTable(cr) {
  const h = cr.has;
  const cols = [["buyback", "자사주 매입", h.buyback], ["div", "배당 지급", h.div], ["total", "합계", h.buyback && (h.div || cr.years.concat(cr.ttm || []).some((r) => r.total !== null))],
    ["sbc", "주식보상(SBC)", h.sbc], ["net", "순매입(SBC 차감)", h.sbc]].filter((c) => c[2]);
  const rows = (cr.ttm && cr.ttm.basis === "4Q" ? [Object.assign({ label: "최근 4분기" }, cr.ttm)] : [])
    .concat(cr.years.slice().reverse().map((y) => Object.assign({ label: `FY${y.fy}` }, y)));
  const head = `<th>기간</th>${cols.map((c) => `<th class="ins-num">${escapeHtml(c[1])}</th>`).join("")}`;
  const body = rows.map((r) => `<tr><th scope="row">${escapeHtml(r.label)}</th>${cols.map((c) => `<td class="ins-num">${escapeHtml(shrMoney(r[c[0]], "USD"))}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap mf-table-wrap cc-table-wrap"><table class="insider-table mf-table cc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function shrCashLead(cr, yields) {
  const t = cr.ttm;
  const basis = t && t.basis === "4Q" ? "최근 4분기" : "직전 회계연도";
  const tiles = [];
  if (t && cr.has.buyback) tiles.push([`자사주 매입(${basis})`, shrMoney(t.buyback, "USD"), Number.isFinite(yields.buyback) ? `시가총액 대비 ${yields.buyback.toFixed(2)}%` : ""]);
  if (t && cr.has.div) tiles.push([`배당 지급(${basis})`, shrMoney(t.div, "USD"), Number.isFinite(yields.div) ? `시가총액 대비 ${yields.div.toFixed(2)}%` : ""]);
  tiles.push(["주주수익률(자사주+배당)", Number.isFinite(yields.total) ? `${yields.total.toFixed(2)}%` : "—", ""]);
  if (cr.has.sbc && Number.isFinite(yields.net)) tiles.push(["순매입 수익률(SBC 차감)", `${yields.net.toFixed(2)}%`, ""]);
  return `<dl class="shr-kpis shr-kpis-cash">${tiles.map(([k, v, sub]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>${sub ? `<dd class="shr-kpi-sub">${escapeHtml(sub)}</dd>` : ""}</div>`).join("")}</dl>`;
}

function shrOpenDividendRank() {
  if (typeof activateTab === "function") activateTab("search", { sub: "top" });
  let tries = 0;
  const tick = () => {
    const b = document.querySelector('#findChipsPreset [data-ft-list="dividend"]');
    if (b) { if (!b.classList.contains("is-active")) b.click(); return; }
    if ((tries += 1) < 20) setTimeout(tick, 60);
  };
  setTimeout(tick, 30);
}

function shrBind(host) {
  if (host.dataset.shrBound) return;
  host.dataset.shrBound = "1";
  host.addEventListener("click", (e) => {
    if (e.target.closest("[data-shr-rank]")) shrOpenDividendRank();
  });
}

function shrWidth(host) {
  const w = host && host.clientWidth && typeof mirChartCardInnerWidth === "function" ? mirChartCardInnerWidth(host.clientWidth) : 0;
  return w > 0 ? w : 420;
}

function renderShareholder(item) {
  const host = typeof byId === "function" ? byId("shareholderSection") : null;
  if (!host) return;
  const cfg = typeof marketCfg === "function" ? marketCfg() : null;
  const feats = (cfg && cfg.features) || {};
  const sh = window.MirShareholderCore, mc = window.MirMcapCore;
  if (feats.shareholderReturn === false || !item || !item.ticker || !sh || !mc
      || (typeof isStockEtf === "function" && isStockEtf(item))) { shrHide(host); return; }
  const kr = shrIsKr();
  const market = kr ? "kr" : "us";
  const cur = kr ? "KRW" : "USD";
  const ticker = item.ticker;

  // 재무 파일(EPS·주식수) — 없으면 배당만. 아직 모르면 받아 두고 새로고침에 맡긴다.
  let fin = typeof financialsCached === "function" ? financialsCached(ticker) : null;
  if (fin === undefined) {
    fin = null;
    if (typeof loadFinancials === "function") loadFinancials(ticker).then((f) => { if (f && typeof scheduleFeatureViewRefresh === "function") scheduleFeatureViewRefresh(); });
  }
  if (fin && fin.currency && fin.currency !== cur) fin = null;   // 보고 통화가 다르면(해외발행인) EPS 비교 불가
  if (kr && feats.krDart !== false) {
    if (!window.KR_DISCLOSURES) shrEnsure("krDart");
    if (!window.KR_EVENT_DETAILS) shrEnsure("krEventDetails");
  }
  if (!kr && feats.materialEvents !== false && !window.MATERIAL_EVENTS) shrEnsure("events");
  const histRaw = typeof tlHistoryFor === "function" ? tlHistoryFor(ticker) : null;

  const chartStart = Array.isArray(item.chartSeries) && item.chartSeries.length
    ? (Array.isArray(item.chartSeries[0]) ? item.chartSeries[0][5] : item.chartSeries[0].date) : null;
  const anchor = mc.anchorShares(item, market);
  const flags = (fin && fin.flags) || [];
  const ns = fin && !flags.includes("foreignFiler") && !flags.includes("adrShareBasis")
    ? mc.normalizedFor({ file: fin, chartSeries: item.chartSeries, anchor, splits: item.splits }) : { norm: [], fail: "none" };
  const norm = ns.fail ? [] : ns.norm;
  const annualRows = fin ? (fin.annual || []).map((r) => Object.assign({}, r, { end: mc.periodEnd(r, "annual") })) : [];
  const mapFund = (typeof mapFundamentalsFor === "function" ? mapFundamentalsFor(ticker) : null) || {};
  const today = item.priceDate || (typeof data !== "undefined" && data && data.priceDate) || new Date().toISOString().slice(0, 10);
  const s = sh.summarize({
    market, dividends: item.dividends, chartStart, today,
    annualRows: kr ? [] : annualRows, ttm: fin && fin.ttm, norm,
    price: Number(item.price), mapFund,
  });
  const share = norm.length ? sh.shareChange(norm, annualRows.map((r) => r.end)) : null;
  const recent = kr ? sh.krRecentBuybacks(ticker, (window.KR_DISCLOSURES || {}).disclosures, (window.KR_EVENT_DETAILS || {}).details) : null;
  const dayBase = (window.EVENT_STUDY_INDEX && window.EVENT_STUDY_INDEX.dayBase) || "2000-01-01";
  const hist = histRaw && histRaw.rows ? sh.buybackHistory(histRaw.rows, dayBase) : null;
  const us8k = !kr ? sh.usBuybackAnnouncements(ticker, (window.MATERIAL_EVENTS || {}).events) : [];
  const missing = kr && histRaw && histRaw.rows ? sh.missingDividendYears(s.years, histRaw.rows, dayBase) : [];
  if (feats.dividendGrowth !== false && !window.DIVIDEND_GROWTH) shrEnsure("dividendGrowth");
  const growth = feats.dividendGrowth !== false && window.DIVIDEND_GROWTH && window.MirDivGrowthCore
    ? window.MirDivGrowthCore.record(window.DIVIDEND_GROWTH, ticker) : null;
  const pref = kr && feats.dividendGrowth !== false && window.DIVIDEND_GROWTH && window.MirDivGrowthCore
    ? window.MirDivGrowthCore.prefRecord(window.DIVIDEND_GROWTH, ticker) : null;

  // 미국 주주환원 현금(SEC 현금흐름표). 배당 태그가 없을 때 무배당 판정: 배당 기록(상세)상 최근 1년 0회이거나 소스 수익률 0.
  const noDividends = (Array.isArray(item.dividends) && s.trailing && s.trailing.count === 0) || mapFund.divYield === 0;
  const cash = !kr && fin && fin.currency === "USD" ? sh.cashReturns(fin, { noDividends }) : null;
  const capB = typeof itemCapForValuation === "function" ? itemCapForValuation(item) : Number(item.marketCapB);
  const cashYields = cash ? sh.cashReturnYields(cash.ttm, capB > 0 ? capB * 1e9 : null, { divYieldPct: mapFund.divYield }) : null;
  const hasBuyback = !!(share || (recent && recent.rows.length) || hist || us8k.length || cash);
  // 상세 파일이 아직 없으면(배당 기록을 모름) 기다린다 — 빈 카드를 먼저 띄우지 않는다.
  if (!Array.isArray(item.dividends) && !Array.isArray(item.chartSeries) && !hasBuyback) { shrHide(host); return; }
  if (!s.hasDividends && !hasBuyback) { shrHide(host); return; }

  // 배당락 후 회복 — 미국 야후 일봉 close·국내 네이버 수정주가는 분할만 조정(현금배당 미반영)이라 그대로 쓴다.
  // 국내 ETF 네이버 봉은 분배금 소급이라 계산하지 않는다(ETF 는 위에서 카드 자체를 숨기지만 원천 규칙으로 한 번 더).
  const rec = sh.dividendRecovery(item.chartSeries, item.dividends, {
    limit: 8, adjusted: kr && item.barsSource !== "yahoo" && (typeof isStockEtf === "function" && isStockEtf(item)),
  });
  const width = shrWidth(host);
  const sig = JSON.stringify([ticker, market, width, rec.lastDate, rec.rows.length, s.years, s.yieldPct, s.ttmPayout, share, recent && recent.rows.length, hist && hist.total, us8k.length, missing, growth, pref, cash, cashYields]);
  shrBind(host);
  if (sig === shrSig && !host.hidden && host.firstElementChild) return;
  shrSig = sig;

  const withPayout = s.fiscal && s.years.some((y) => Number.isFinite(y.payout) || y.deficit);
  const divYears = s.years.some((y) => y.count > 0) ? s.years : [];
  const cards = [];
  if (divYears.length) {
    const notes = [];
    if (divYears.some((y) => y.partial)) notes.push(s.fiscal ? "* 결산 전 회계연도 — 지금까지 배당락분" : "* 올해 — 지금까지 배당락분");
    if (kr) notes.push("국내는 배당락일 연도로 묶습니다 — 결산배당 기준일을 이듬해 2~3월로 옮긴 회사는 결산배당이 다음 해에 잡힙니다");
    notes.push("'기록 없음'은 그해 배당이 없었거나 기록이 빠진 해입니다");
    if (missing.length) notes.push(`DART 배당 결정 공시가 있는데 배당 기록이 없는 해: ${missing.join(", ")} — 기록 누락 가능`);
    cards.push(mirChartCard({
      id: "shr.dps",
      title: "주당배당금",
      sub: s.fiscal ? "회계연도" : "연도별(배당락일)",
      unitLeft: kr ? "(원)" : "(USD)",
      unitRight: withPayout ? "(배당성향 %)" : "",
      chart: `<div class="mf-chart-wrap">${shrDpsSvg(divYears, cur, width, withPayout)}</div><p class="mfo-cap">${escapeHtml(notes.join(". "))}.</p>`,
      table: shrDpsTable(divYears, cur, withPayout),
      legend: [{ label: "주당배당금", color: "var(--mf-c1)", shape: "bar" }].concat(withPayout ? [{ label: "배당성향(우)", color: "var(--mfo-line)", shape: "line" }] : []),
      source: s.coverageStart ? `${s.coverageStart}부터` : "",
      help: "주당배당금은 배당락일 기준으로 더한 값입니다(지급일 아님). 분할·무상증자 뒤 기준으로 조정돼 당시 공시 금액과 다를 수 있습니다.",
    }));
  }
  if (rec.rows.length) {
    cards.push(mirChartCard({
      id: "shr.recovery",
      title: "배당락 후 회복",
      sub: `최근 ${rec.rows.length}회 중 ${rec.recoveredCount}회 회복`,
      chart: shrRecoveryTable(rec, cur),
      source: `일봉 ${rec.lastDate} 기준`,
      help: "기준가 = 배당락일 직전 거래일 종가. 회복 = 배당락일부터 종가가 기준가 이상이 된 첫날(배당락 당일 회복 = 1거래일). 과거 기록이며 앞으로의 회복을 뜻하지 않습니다.",
    }));
  }
  const discWindow = kr && window.KR_DISCLOSURES ? (() => {
    const ds = (window.KR_DISCLOSURES.disclosures || []).map((d) => d.fileDate).filter(Boolean).sort();
    return ds.length ? `${ds[0]}~${ds[ds.length - 1]} 공시분` : "";
  })() : "";
  if (cash) {
    cards.push(mirChartCard({
      id: "shr.cash",
      title: "주주환원 현금",
      sub: "실제 지급액",
      lead: shrCashLead(cash, cashYields),
      unitLeft: "(USD)",
      chart: cash.years.length ? `<div class="mf-chart-wrap">${shrCashSvg(cash.years, width)}</div>` : "",
      table: shrCashTable(cash),
      legend: [{ label: "자사주 매입", color: "var(--mf-c1)", shape: "bar" }].concat(cash.has.div ? [{ label: "배당 지급", color: "var(--mf-c2)", shape: "bar" }] : []),
      source: fin.lastFiled ? `${fin.lastFiled} 공시까지` : "",
    }));
  }
  const bbBody = shrBuybackBody({ kr, cur, share, recent, hist, us8k, discWindow });
  if (bbBody) {
    cards.push(mirChartCard({
      id: "shr.buyback",
      title: "자사주 · 주식수",
      chart: `<div class="shr-bb">${bbBody}</div>`,
      help: kr ? "국내 자사주 금액·주식수는 최근 공시 창(약 1주) 안의 공시만 있습니다. 공시 건수 표는 이벤트 기록(약 5년)에서 세었고 금액은 없습니다." : "8-K 승인 한도는 이사회가 승인한 매입 가능 금액이고, 실제로 쓴 현금은 '주주환원 현금' 카드에 있습니다.",
    }));
  }
  if (!cards.length) { shrHide(host); return; }
  const metaBits = [];
  if (s.coverageStart) metaBits.push(`배당 기록 ${s.coverageStart}~`);
  if (fin && fin.lastFiled) metaBits.push(`재무 반영 공시 ${fin.lastFiled}`);
  metaBits.push(`기준 ${today}`);
  host.hidden = false;
  host.innerHTML = `
    <div class="mf-head">
      <div>
        <h3>주주환원</h3>
        <p class="mf-meta">${escapeHtml(metaBits.join(" · "))}</p>
      </div>
      <button type="button" class="shr-rank-link" data-shr-rank>배당 랭킹 보기 <span aria-hidden="true">›</span></button>
    </div>
    ${s.hasDividends ? shrKpis(s, cur, growth, pref) : `<p class="mf-note">최근 ${s.coverageStart ? `${s.coverageStart} 이후` : ""} 배당 기록이 없습니다.</p>`}
    ${mirChartGrid(cards)}`;
}
