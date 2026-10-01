// shareholder.js — 종목 분석 › 재무 탭 '주주환원' 카드(배당 · 자사주 · 주식수)
// =====================================================
// 계산은 shareholder-core.js(window.MirShareholderCore) + mcap-core.js(주식수 분할 환산). 새 수집 없음:
//   배당 기록 = 종목 상세 dividends(야후 배당락 이벤트, 분할 조정) · 현재 수익률 = MAP_FUNDAMENTALS
//   EPS·주식수 = 재무 확장 파일(financials.js loadFinancials 캐시) · 자사주 = KR_DISCLOSURES/KR_EVENT_DETAILS(국내 최근 창),
//   MATERIAL_EVENTS(미국 8-K), 이벤트 스터디 종목 샤드(약 5년 공시 건수 — timeline.js tlHistoryFor 캐시를 같이 쓴다).
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

function shrKpis(s, cur) {
  const tiles = [];
  tiles.push(["배당 주기", s.frequency.label, s.lastDividend ? `최근 배당락 ${s.lastDividend.date}` : ""]);
  tiles.push(["최근 1년 주당배당금", s.trailing.count ? shrPerShare(s.trailing.sum, cur) : "—", s.trailing.count ? `${s.trailing.count}회 · 배당락일 기준` : "최근 1년 기록 없음"]);
  tiles.push(["배당수익률(현재)", Number.isFinite(s.yieldPct) ? `${s.yieldPct.toFixed(2)}%` : "—", ""]);
  const p = s.ttmPayout;
  tiles.push(["배당성향", shrPayoutText(p), p ? (p.basis === "ttm" ? "최근 1년 배당 ÷ 최근 4분기 EPS" : "직전 결산") : ""]);
  return `<dl class="shr-kpis">${tiles.map(([k, v, sub]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>${sub ? `<dd class="shr-kpi-sub">${escapeHtml(sub)}</dd>` : ""}</div>`).join("")}</dl>`;
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

  const hasBuyback = !!(share || (recent && recent.rows.length) || hist || us8k.length);
  // 상세 파일이 아직 없으면(배당 기록을 모름) 기다린다 — 빈 카드를 먼저 띄우지 않는다.
  if (!Array.isArray(item.dividends) && !Array.isArray(item.chartSeries) && !hasBuyback) { shrHide(host); return; }
  if (!s.hasDividends && !hasBuyback) { shrHide(host); return; }

  const width = shrWidth(host);
  const sig = JSON.stringify([ticker, market, width, s.years, s.yieldPct, s.ttmPayout, share, recent && recent.rows.length, hist && hist.total, us8k.length, missing]);
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
  const discWindow = kr && window.KR_DISCLOSURES ? (() => {
    const ds = (window.KR_DISCLOSURES.disclosures || []).map((d) => d.fileDate).filter(Boolean).sort();
    return ds.length ? `${ds[0]}~${ds[ds.length - 1]} 공시분` : "";
  })() : "";
  const bbBody = shrBuybackBody({ kr, cur, share, recent, hist, us8k, discWindow });
  if (bbBody) {
    cards.push(mirChartCard({
      id: "shr.buyback",
      title: "자사주 · 주식수",
      chart: `<div class="shr-bb">${bbBody}</div>`,
      help: kr ? "국내 자사주 금액·주식수는 최근 공시 창(약 1주) 안의 공시만 있습니다. 공시 건수 표는 이벤트 기록(약 5년)에서 세었고 금액은 없습니다." : "미국은 재무 파일에 자사주 매입 현금(현금흐름표) 계정을 아직 싣지 않아, 희석 주식수 변화와 8-K 발표만 보여 줍니다.",
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
    ${s.hasDividends ? shrKpis(s, cur) : `<p class="mf-note">최근 ${s.coverageStart ? `${s.coverageStart} 이후` : ""} 배당 기록이 없습니다.</p>`}
    ${mirChartGrid(cards)}`;
}
