// us-fund.js — 미국 펀더멘털 카드 3종(종목 분석 뷰). 계산은 us-fund-core.js(window.MirUsFundCore).
// =====================================================
// - 부채 만기(#debtLadderSection, 재무 탭 · 재무 위험 점검 아래) — 재무 확장 파일의 debtMaturity(10-K 만기표)
// - 경영진 보수와 성과(#payVsPerfSection, 재무 탭 · 주주환원 아래) — payVsPerf(DEF 14A ecd 공시값)
// - ROIC − WACC(#roicWaccSection, 가치 탭 · DCF 아래) — 재무 파일 + 미 국채 10년(YIELD_CURVE) + 상세 일봉(종목·SPY)
// 새 수집은 빌더(build_financials_us.py)에서만. 자료가 없으면 카드를 숨기고, 구성요소가 없으면 "—".
// 클래식 스크립트(전역 공유) — 이름은 uf* / render* 로 충돌을 피한다.

const UF_ERP_KEY = "mir.roicWacc.erp";
const ufState = { ladder: null, pvp: null, wacc: null };   // 카드별 { key, file, sig }
const ufBetaTried = new Set();   // 일봉(종목·SPY) 로드를 이미 기다린 종목 — 없으면 '불러오는 중' 대신 "—"

function ufOn(item) {
  return !!(item && item.ticker && !item.__liveStub && window.MirUsFundCore && typeof loadFinancials === "function"
    && !(typeof isKrMarket === "function" && isKrMarket())
    && !(typeof isStockEtf === "function" && isStockEtf(item)));
}

function ufHide(host, slot) {
  if (!host) return;
  host.hidden = true;
  host.innerHTML = "";
  ufState[slot] = null;
}

// 재무 파일: 있으면 파일, 없음 확정이면 null, 아직이면 undefined(로드 뒤 다시 부른다).
function ufFile(item, again) {
  const file = financialsCached(item.ticker);
  if (file !== undefined) return file;
  const ticker = item.ticker;
  loadFinancials(ticker).then(() => {
    if (typeof selectedTicker !== "undefined" && mfTickerKey(selectedTicker) !== mfTickerKey(ticker)) return;
    again(item);
  });
  return undefined;
}

function ufMoney(v) {
  return typeof mfMoney === "function" ? mfMoney(v, "USD") : String(v);
}
function ufPct(v, d = 1) {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`;
}
function ufPp(v) {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%p`;
}

// ── 1) 부채 만기 ──
function ufLadderHtml(lad) {
  const max = Math.max(...lad.buckets.map((b) => b.value)) || 1;
  const rows = lad.buckets.map((b) => `<li class="uf-bar-row">
      <span class="uf-bar-label">${escapeHtml(b.label)}</span>
      <span class="uf-bar-track"><span class="uf-bar${b.key === "y1" ? " is-near" : ""}" style="width:${((b.value / max) * 100).toFixed(1)}%"></span></span>
      <span class="uf-bar-val">${escapeHtml(ufMoney(b.value))} <span class="muted">${(b.share * 100).toFixed(0)}%</span></span>
    </li>`).join("");
  const miss = lad.missing.length ? ` · 미공시 ${escapeHtml(lad.missing.join("·"))}` : "";
  return `
    <div class="mf-head">
      <div>
        <h3>부채 만기</h3>
        <p class="mf-meta">FY${escapeHtml(String(lad.fy || ""))} 10-K · ${escapeHtml(lad.end || "")} 기준 장기차입금 원금 상환 예정${miss}</p>
      </div>
      <div class="rc-score uf-score" aria-label="1년 이내 상환 비중">
        <strong>1년 이내 ${lad.y1Share !== null ? ufPct(lad.y1Share, 0) : "—"}</strong>
        <span>${lad.financial ? "" : lad.cashToY1 !== null ? `현금 ${escapeHtml(ufMoney(lad.cash))} · 1년 이내의 ${lad.cashToY1.toFixed(1)}배` : lad.y1 === 0 ? "1년 이내 상환 없음" : "현금 대비 —"}</span>
      </div>
    </div>
    <ul class="uf-bars">${rows}</ul>
    <p class="mf-foot">합계 ${escapeHtml(ufMoney(lad.total))} · 회사가 공시한 만기표 그대로(SEC XBRL)</p>`;
}

function renderDebtLadder(item) {
  const host = byId("debtLadderSection");
  if (!host) return;
  if (!ufOn(item)) { ufHide(host, "ladder"); return; }
  const file = ufFile(item, renderDebtLadder);
  if (file === undefined) return;
  const lad = file ? MirUsFundCore.debtLadder(file) : null;
  if (!lad) { ufHide(host, "ladder"); return; }
  const key = mfTickerKey(item.ticker);
  if (ufState.ladder && ufState.ladder.file === file && !host.hidden && host.firstElementChild) return;
  ufState.ladder = { key, file };
  host.hidden = false;
  host.innerHTML = ufLadderHtml(lad);
}

// ── 2) 경영진 보수와 성과(Pay vs Performance) ──
function ufSecLink(file, accn) {
  const cik = file && file.id && file.id.cik;
  if (!cik || !/^\d{10}-\d{2}-\d{6}$/.test(String(accn || ""))) return "";
  return ` <a href="https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${String(accn).replace(/-/g, "")}/" target="_blank" rel="noopener noreferrer">원문</a>`;
}

function ufPvpHtml(p, file) {
  const cols = [
    ["peoTotal", "CEO 보수총액", "보수총괄표(SCT) 총액"],
    ["peoCap", "CEO 실지급", "실지급보상(Compensation Actually Paid) — 주식보상의 연중 가치 변동 반영, 음수 가능"],
    ["neoTotal", "기타 임원 평균", "CEO 외 지정 임원 평균 보수총액"],
    ["neoCap", "기타 임원 실지급", "CEO 외 지정 임원 평균 실지급보상"],
    ["tsr", "TSR", "첫해 초 $100 투자 시 누적 가치(회사)"],
    ["peerTsr", "동종 TSR", "첫해 초 $100 투자 시 누적 가치(회사가 고른 동종 그룹)"],
  ].filter(([k]) => p.rows.some((r) => r[k] !== null));
  const money = new Set(["peoTotal", "peoCap", "neoTotal", "neoCap"]);
  const cell = (r, k) => {
    const v = r[k];
    if (v === null) return '<td class="num"><span class="muted">—</span></td>';
    if (!money.has(k)) return `<td class="num">$${escapeHtml(v.toFixed(0))}</td>`;
    const w = p.maxComp ? Math.min(100, (Math.abs(v) / p.maxComp) * 100) : 0;
    return `<td class="num"><span class="uf-cell-val${v < 0 ? " is-neg" : ""}">${escapeHtml(ufMoney(v))}</span><span class="uf-mini${v < 0 ? " is-neg" : ""}" style="width:${w.toFixed(0)}%"></span></td>`;
  };
  const head = cols.map(([, label, title]) => `<th class="num" title="${escapeHtml(title)}">${escapeHtml(label)}</th>`).join("");
  const body = p.rows.map((r) => `<tr><th scope="row">${escapeHtml(r.year)}</th>${cols.map(([k]) => cell(r, k)).join("")}</tr>`).join("");
  return `
    <div class="mf-head">
      <div>
        <h3>경영진 보수와 성과</h3>
        <p class="mf-meta">위임장(DEF 14A) Pay vs Performance 공시${p.filed ? ` · ${escapeHtml(p.filed)} 제출` : ""}${ufSecLink(file, p.accn)}</p>
      </div>
    </div>
    <div class="table-wrap"><table class="insider-table rc-table uf-pvp-table"><thead><tr><th>회계연도</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="mf-foot">공시값 그대로${p.hasPeo ? "" : " · CEO 개인별 값은 회사가 차원으로만 공시해 빠짐"}</p>`;
}

function renderPayVsPerf(item) {
  const host = byId("payVsPerfSection");
  if (!host) return;
  if (!ufOn(item)) { ufHide(host, "pvp"); return; }
  const file = ufFile(item, renderPayVsPerf);
  if (file === undefined) return;
  const p = file ? MirUsFundCore.payVsPerf(file) : null;
  if (!p) { ufHide(host, "pvp"); return; }
  if (ufState.pvp && ufState.pvp.file === file && !host.hidden && host.firstElementChild) return;
  ufState.pvp = { key: mfTickerKey(item.ticker), file };
  host.hidden = false;
  host.innerHTML = ufPvpHtml(p, file);
}

// ── 3) ROIC − WACC ──
function ufRiskFree() {
  const y = window.YIELD_CURVE;
  const p = y && (y.curve || []).find((c) => c.m === "10Y");
  return p && Number.isFinite(Number(p.y)) ? { pct: Number(p.y), asOf: y.asOf || "" } : null;
}
function ufErpDefault() {
  const e = window.MirDcfCore && MirDcfCore.ERP && MirDcfCore.ERP.us;
  return e && Number.isFinite(e.value) ? { value: e.value, label: `Damodaran 내재 ERP(${e.asOf})` } : { value: MirUsFundCore.DEFAULT_ERP, label: "고정 가정" };
}
function ufErp() {
  const raw = window.safeStorage ? window.safeStorage.get(UF_ERP_KEY, "") : "";
  const saved = raw === "" || raw === null ? NaN : Number(raw);
  return Number.isFinite(saved) && saved >= 0 && saved <= 0.2 ? saved : ufErpDefault().value;
}
function ufMarketCap(item) {
  const b = Number(item && item.marketCapB);
  return Number.isFinite(b) && b > 0 ? b * 1e9 : null;
}
function ufBars(ticker) {
  if (typeof detailCache === "undefined" || typeof safeTicker !== "function") return null;
  const d = detailCache[safeTicker(ticker)];
  return d && Array.isArray(d.chartSeries) && d.chartSeries.length ? d.chartSeries : null;
}

function ufWaccBody(w, ctx) {
  const rf = ctx.rf;
  const b = ctx.betaInfo;
  const row = (label, value, note) => `<tr><th scope="row">${escapeHtml(label)}</th><td class="num">${value}</td><td class="muted">${note || ""}</td></tr>`;
  const kdNote = w.noDebt ? "무차입" : "이자비용 ÷ 평균 총차입금";
  const rows = [
    row("무위험금리", rf ? `${rf.pct.toFixed(2)}%` : "—", rf ? `미 국채 10년 ${escapeHtml(rf.asOf)}` : ""),
    row("베타", w.beta !== null ? w.beta.toFixed(2) : "—", b ? `SPY 대비 주간 ${b.n}주 · R² ${b.r2.toFixed(2)} · ${escapeHtml(b.from)}~${escapeHtml(b.to)}` : ctx.betaPending ? "일봉 불러오는 중" : "주간 수익률 78주 미만"),
    row("주식위험프리미엄", ufPct(w.erp, 2), Math.abs(w.erp - ctx.erpDefault) < 1e-9 ? escapeHtml(ctx.erpLabel)
      : `직접 입력 · 기본 ${ufPct(ctx.erpDefault, 2)}(${escapeHtml(ctx.erpLabel)})`),
    row("자기자본비용", ufPct(w.ke, 2), "무위험금리 + 베타 × ERP"),
    row("세전 타인자본비용", w.noDebt ? "—" : ufPct(w.kd, 2), kdNote),
    row("실효세율", ufPct(w.tax, 1), "법인세 ÷ 세전이익"),
    row("자기자본 비중", ufPct(w.wE, 0), w.E !== null ? `시가총액 ${escapeHtml(ufMoney(w.E))}` : ""),
    row("타인자본 비중", ufPct(w.wD, 0), w.D !== null ? `총차입금 ${escapeHtml(ufMoney(w.D))}` : ""),
  ].join("");
  return `
    <div class="uf-wacc-top">
      <div><span>ROIC</span><strong>${ufPct(w.roic, 1)}</strong></div>
      <div><span>WACC</span><strong>${ufPct(w.wacc, 1)}</strong></div>
      <div><span>ROIC − WACC</span><strong>${ufPp(w.spread)}</strong></div>
    </div>
    <div class="table-wrap"><table class="insider-table rc-table uf-wacc-table"><tbody>${rows}</tbody></table></div>`;
}

function ufWaccHtml(w, ctx) {
  const erpPct = (w.erp * 100).toFixed(2);
  return `
    <div class="mf-head">
      <div>
        <h3>ROIC − WACC</h3>
        <p class="mf-meta">FY${escapeHtml(String(w.fy || ""))} 연간 · ROIC = 영업이익 × (1 − 실효세율) ÷ (총차입금 + 자본 − 현금)</p>
      </div>
      <label class="uf-erp">ERP <input type="number" inputmode="decimal" step="0.1" min="0" max="20" value="${escapeHtml(erpPct)}" aria-label="주식위험프리미엄(%)" data-uf-erp>%</label>
    </div>
    <div data-uf-wacc-body>${ufWaccBody(w, ctx)}</div>
    <p class="mf-foot">WACC = E/(D+E)·자기자본비용 + D/(D+E)·타인자본비용·(1 − 실효세율). 가정(ERP·베타 기간)에 따라 달라집니다.</p>`;
}

function ufWaccCompute(ctx) {
  return MirUsFundCore.roicWacc({ file: ctx.file, marketCap: ctx.mcap, beta: ctx.betaInfo ? ctx.betaInfo.beta : null, rfPct: ctx.rf ? ctx.rf.pct : null, erp: ctx.erp });
}

function ufBindErp(host) {
  if (host.dataset.ufBound) return;
  host.dataset.ufBound = "1";
  host.addEventListener("input", (ev) => {
    const el = ev.target;
    if (!el || !el.matches || !el.matches("[data-uf-erp]")) return;
    const ctx = ufState.wacc && ufState.wacc.ctx;
    if (!ctx) return;
    const v = Number(el.value) / 100;
    if (!Number.isFinite(v) || v < 0 || v > 0.2) return;
    ctx.erp = v;
    if (window.safeStorage) window.safeStorage.set(UF_ERP_KEY, String(v));
    const w = ufWaccCompute(ctx);
    const body = host.querySelector("[data-uf-wacc-body]");
    if (w && body) body.innerHTML = ufWaccBody(w, ctx);
  });
}

function renderRoicWacc(item) {
  const host = byId("roicWaccSection");
  if (!host) return;
  if (!ufOn(item)) { ufHide(host, "wacc"); return; }
  const file = ufFile(item, renderRoicWacc);
  if (file === undefined) return;
  if (!file) { ufHide(host, "wacc"); return; }
  const ticker = item.ticker;
  const key = mfTickerKey(ticker);
  const rf = ufRiskFree();
  const sb = ufBars(ticker), mb = ufBars("SPY");
  const betaPending = (!sb || !mb) && !ufBetaTried.has(key);
  const betaInfo = !betaPending ? MirUsFundCore.weeklyBeta(sb, mb) : null;
  const erpDef = ufErpDefault();
  const ctx = { file, mcap: ufMarketCap(item), rf, betaInfo, betaPending, erp: ufErp(), erpLabel: erpDef.label, erpDefault: erpDef.value };
  const w = ufWaccCompute(ctx);
  if (!w || w.roic === null) { ufHide(host, "wacc"); return; }   // 금융업·해외발행인·ROIC 계산 불가 → 숨김
  const sig = `${key}|${ctx.mcap || ""}|${rf ? rf.pct : ""}|${betaInfo ? betaInfo.beta.toFixed(4) : betaPending ? "p" : "x"}`;
  if (ufState.wacc && ufState.wacc.file === file && ufState.wacc.sig === sig && !host.hidden && host.firstElementChild) return;
  ufState.wacc = { key, file, sig, ctx };
  ufBindErp(host);
  host.hidden = false;
  host.innerHTML = ufWaccHtml(w, ctx);
  // 금리·일봉(종목·SPY)이 늦게 오면 받은 뒤 한 번 더(피처 데이터 경합).
  const waits = [];
  if (!rf && typeof ensureFeatureData === "function") waits.push(ensureFeatureData("yieldCurve"));
  if (betaPending && typeof loadStockDetail === "function") waits.push(loadStockDetail(ticker), loadStockDetail("SPY"));
  if (waits.length) {
    Promise.all(waits).then(() => {
      ufBetaTried.add(key);
      if (typeof selectedTicker !== "undefined" && mfTickerKey(selectedTicker) !== key) return;
      if (ufState.wacc && ufState.wacc.sig === sig) renderRoicWacc(item);
    });
  }
}

function renderUsFundCards(item) {
  renderDebtLadder(item);
  renderPayVsPerf(item);
  renderRoicWacc(item);
}
