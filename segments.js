// segments.js — 종목 분석 › 재무 탭 '사업부문·지역별 매출' 카드(#segmentsSection). US 전용.
// =====================================================
// 데이터: scripts/build_segments_us.py(SEC 10-K·20-F XBRL 의 부문·지역·제품 차원) 가 만드는 종목별 파일
//   data/segments/<TICKER>.json · 인덱스 window.SEGMENTS_INDEX(FEATURE_DATA 키 segmentsIndex, US 전용·lazy).
// 계산은 segments-core.js(window.MirSegmentsCore). 공시 수치를 옮긴 과거 정보이며 예측·추천이 아니다.
// 인덱스에 없는 종목·ETF·KR 모드는 카드를 숨긴다(없는 파일을 요청하지 않는다).
// 클래식 스크립트(전역 공유) — 이름은 sg* / *Segments* 로 충돌을 피한다. 금액 포맷은 financials.js 의 mfMoney.

const SG_CACHE = new Map();      // ticker → 파일 | null
const SG_PROMISES = new Map();
const SG_STATE_KEY = "mir.segments.axis";
let sgCurrent = null;            // { key, file, axis }

function sgIsUs() {
  return !(typeof isKrMarket === "function" && isKrMarket());
}

function sgKey(ticker) {
  return String(ticker || "").toUpperCase();
}

function sgIndexEntry(key) {
  const idx = window.SEGMENTS_INDEX;
  return idx && idx.tickers ? idx.tickers[key] || null : null;
}

// 동기 조회: 파일 · null(없음 확정) · undefined(아직 모름).
function segmentsCached(ticker) {
  return SG_CACHE.get(sgKey(ticker));
}

function loadSegments(ticker) {
  const key = sgKey(ticker);
  if (!key || !sgIsUs()) return Promise.resolve(null);
  if (SG_CACHE.has(key)) return Promise.resolve(SG_CACHE.get(key));
  if (SG_PROMISES.has(key)) return SG_PROMISES.get(key);
  const p = ensureFeatureData("segmentsIndex").then((ok) => {
    if (!ok || !sgIndexEntry(key)) return null;
    const safe = typeof safeTicker === "function" ? safeTicker(key) : key;
    return fetch(`data/segments/${encodeURIComponent(safe)}.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => (doc && doc.schema === 1 && doc.axes && Object.keys(doc.axes).length ? doc : null))
      .catch(() => null);
  }).then((doc) => {
    SG_CACHE.set(key, doc || null);
    SG_PROMISES.delete(key);
    return doc || null;
  });
  SG_PROMISES.set(key, p);
  return p;
}

function sgMoney(v, currency) {
  return typeof mfMoney === "function" ? mfMoney(v, currency) : String(v);
}

function sgPct(v, signed) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${signed && v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

// ── 누적 막대(회계연도별) ──
function sgChartSvg(view, currency, width) {
  const W = Math.max(280, Math.round(width || 720)), H = W < 520 ? 190 : 230, padL = 52, padR = 8, top = 12, bottom = 26;
  const bars = view.bars;
  const n = bars.length;
  if (!n) return "";
  const max = Math.max(...bars.map((b) => Object.values(b.v).reduce((a, x) => a + Math.max(0, x), 0)), 0) || 1;
  const plotH = H - top - bottom;
  const y = (v) => top + (max - v) / max * plotH;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(slot * 0.62, 56);
  let rects = "", labels = "";
  bars.forEach((b, i) => {
    const x = padL + slot * i + (slot - bw) / 2;
    let acc = 0;
    view.members.forEach((m, j) => {
      const v = b.v[m.id];
      if (!(v > 0)) return;           // 음수(조정)·결측은 쌓지 않는다
      const y1 = y(acc + v), y2 = y(acc);
      acc += v;
      const share = b.sum > 0 ? ` · ${(v / b.sum * 100).toFixed(1)}%` : "";
      rects += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, y2 - y1).toFixed(1)}" class="sg-c${(j % 8) + 1}"><title>FY${b.fy} ${escapeHtml(m.label)} ${escapeHtml(sgMoney(v, currency))}${share}</title></rect>`;
    });
    if (b.total && b.total > 0) {
      // 총매출 표식(부문 합과 다르면 막대 끝과 어긋나 보인다)
      const ty = y(b.total);
      rects += `<line x1="${(x - 4).toFixed(1)}" x2="${(x + bw + 4).toFixed(1)}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" class="sg-total"><title>FY${b.fy} 총매출 ${escapeHtml(sgMoney(b.total, currency))}</title></line>`;
    }
    labels += `<text x="${(padL + slot * i + slot / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="mf-axis">FY${String(b.fy).slice(-2)}</text>`;
  });
  const ticks = [max, max / 2].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="mf-grid"/><text x="${padL - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="mf-axis mf-tick">${escapeHtml(sgMoney(v, currency))}</text>`).join("");
  const zero = `<line x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="mf-zero"/>`;
  return `<svg class="mf-chart sg-chart" viewBox="0 0 ${W} ${H}" style="height:${H}px" role="img" aria-label="${escapeHtml(view.label)}별 매출 누적 막대">${ticks}${zero}${rects}${labels}</svg>`;
}

function sgLegend(view) {
  const items = view.members.map((m, j) => `<span><i class="mf-sw sg-c${(j % 8) + 1}"></i>${escapeHtml(m.label)}</span>`);
  if (view.bars.some((b) => b.total)) items.push(`<span><i class="mf-sw sg-sw-total"></i>총매출</span>`);
  return `<div class="mf-legend sg-legend">${items.join("")}</div>`;
}

function sgTable(view, currency) {
  const body = view.rows.map((r, j) => {
    const tone = (v) => (Number.isFinite(v) && v < 0 ? " ins-sell" : "");
    return `<tr><th scope="row"><i class="mf-sw sg-c${(j % 8) + 1}"></i>${escapeHtml(r.label)}</th>
      <td class="ins-num">${escapeHtml(sgMoney(r.value, currency))}</td>
      <td class="ins-num">${escapeHtml(sgPct(r.share))}</td>
      <td class="ins-num${tone(r.yoy)}">${escapeHtml(sgPct(r.yoy, true))}</td>
      <td class="ins-num${tone(r.cagr3)}">${escapeHtml(sgPct(r.cagr3, true))}</td></tr>`;
  }).join("");
  const t = view.totalRow;
  const foot = `<tr class="sg-sum"><th scope="row">${escapeHtml(view.label)} 합</th><td class="ins-num">${escapeHtml(sgMoney(t.value, currency))}</td><td class="ins-num">100%</td>
    <td class="ins-num">${escapeHtml(sgPct(t.yoy, true))}</td><td class="ins-num">${escapeHtml(sgPct(t.cagr3, true))}</td></tr>`;
  return `<div class="table-wrap mf-table-wrap"><table class="insider-table mf-table sg-table">
    <thead><tr><th>${escapeHtml(view.label)} (FY${view.latestFy})</th><th class="ins-num">매출</th><th class="ins-num">비중</th><th class="ins-num" title="최신 연도 ÷ 직전 연도 − 1">전년비</th><th class="ins-num" title="(최신 ÷ 3년 전)^(1/3) − 1">3년 연평균</th></tr></thead>
    <tbody>${body}${foot}</tbody></table></div>`;
}

function sgMeta(file) {
  const f = (file.filings || [])[0];
  const bits = [`출처 SEC ${escapeHtml((f && f.form) || "10-K")} XBRL(부문 공시)`];
  if (f && f.end) bits.push(`최근 결산 ${escapeHtml(f.end)}`);
  if (f && f.filed) bits.push(`제출 ${escapeHtml(f.filed)}`);
  if (file.currency && file.currency !== "USD") bits.push(`통화 ${escapeHtml(file.currency)}`);
  if (file.updatedAtKst) bits.push(`갱신 ${escapeHtml(String(file.updatedAtKst).slice(0, 10))}`);
  return bits.join(" · ");
}

function sgSectionHtml(file, axisKey, width) {
  const core = window.MirSegmentsCore;
  const axes = core.availableAxes(file);
  const axis = axes.includes(axisKey) ? axisKey : axes[0];
  const view = core.axisView(file, axis);
  if (!view) return "";
  const cur = file.currency || "USD";
  const note = core.checkNote(view);
  const badges = axes.filter((k) => core.axisView(file, k) && core.axisView(file, k).check === "mismatch")
    .map((k) => `<span class="mf-badge" title="${escapeHtml(core.checkNote(core.axisView(file, k)) || "")}">${escapeHtml(core.AXIS_LABEL[k])} 합 ≠ 총매출</span>`).join("");
  return `
    <div class="mf-head">
      <div>
        <h3>사업부문·지역별 매출</h3>
        <p class="mf-meta">${sgMeta(file)}</p>
      </div>
      <div class="mf-badges">${badges}</div>
    </div>
    <div class="mf-controls">
      <div class="mf-chips" role="group" aria-label="구분 기준">
        ${axes.map((k) => `<button type="button" class="mf-chip${k === axis ? " is-active" : ""}" data-sg-axis="${k}" aria-pressed="${k === axis}">${escapeHtml(core.AXIS_LABEL[k])}</button>`).join("")}
      </div>
    </div>
    ${sgLegend(view)}
    <div class="mf-chart-wrap">${sgChartSvg(view, cur, width)}</div>
    ${sgTable(view, cur)}
    ${note ? `<p class="mf-note sg-note">${escapeHtml(note)}</p>` : ""}
    <p class="mf-foot">회사가 10-K 부문·지역·제품 주석에 XBRL 로 태그한 매출을 옮긴 과거 정보이며 예측·추천이 아닙니다. 비중은 ${escapeHtml(view.label)} 합 기준, 전년비·3년 연평균은 두 해 모두 값이 있을 때만 계산합니다(—는 공시에서 확인되지 않은 값). 부문 구성이 바뀐 해는 멤버가 연도마다 다를 수 있습니다. 가로줄은 같은 공시의 총매출입니다.</p>`;
}

function sgHide(host) {
  host.hidden = true;
  host.innerHTML = "";
  sgCurrent = null;
}

function sgBind(host) {
  if (host.dataset.sgBound) return;
  host.dataset.sgBound = "1";
  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sg-axis]");
    if (!b || !sgCurrent) return;
    sgCurrent.axis = b.dataset.sgAxis;
    if (window.safeStorage) window.safeStorage.setJSON(SG_STATE_KEY, sgCurrent.axis);
    host.innerHTML = sgSectionHtml(sgCurrent.file, sgCurrent.axis, host.clientWidth ? host.clientWidth - 32 : 720);
  });
}

// 종목 분석 뷰(#segmentsSection). US 모드·인덱스에 있는 종목만.
function renderSegments(item) {
  const host = byId("segmentsSection");
  if (!host) return;
  if (!item || !item.ticker || item.__liveStub || !sgIsUs() || !window.MirSegmentsCore
      || (typeof isStockEtf === "function" && isStockEtf(item))) {
    sgHide(host);
    return;
  }
  const key = sgKey(item.ticker);
  const file = segmentsCached(key);
  if (file === null) { sgHide(host); return; }
  if (file === undefined) {
    loadSegments(key).then((f) => {
      if (typeof selectedTicker !== "undefined" && sgKey(selectedTicker) !== key) return;
      if (!f) { sgHide(host); return; }
      renderSegments(item);
    });
    return;
  }
  // 같은 종목이 이미 그려져 있으면 다시 그리지 않는다(refreshFeatureViews 가 부팅 중 여러 번 부른다)
  if (sgCurrent && sgCurrent.key === key && sgCurrent.file === file && !host.hidden && host.firstElementChild) return;
  const saved = window.safeStorage ? window.safeStorage.getJSON(SG_STATE_KEY, null) : null;
  sgCurrent = { key, file, axis: typeof saved === "string" ? saved : "segment" };
  sgBind(host);
  host.hidden = false;             // 폭을 재기 전에 보이게(숨긴 요소는 clientWidth 0 → 모바일에서 글자가 줄어든다)
  const html = sgSectionHtml(file, sgCurrent.axis, host.clientWidth ? host.clientWidth - 32 : 720);
  if (!html) { sgHide(host); return; }
  host.innerHTML = html;
}
