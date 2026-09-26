// market-indicators.js — 시장 탭 '시장지표' 잎(#tab-marketindex)
// =====================================================================
// 데이터: data/market_indicators.js(window.MARKET_INDICATORS, build_market_indicators.py).
// feature-data.js 의 lazy 데이터셋이라 탭을 처음 열 때 받고, 도착하면 refreshFeatureViews 가 다시 그린다.
// 진입: index.html?tab=marketindex (또는 ?tab=market&sub=marketindex).
// 표기 규칙은 market-indicators-core.js(쉼표, ▲1.23(+0.45%), 상승 빨강·하락 파랑).
// 사이트 규칙: 장식 이모지 없음, 매매 신호 표현 없음, 출처·기준일 표시.
(function () {
  "use strict";

  const C = () => window.MirMarketIndicatorsCore;
  let pending = null;

  // 환율 계산기 상태 — 데이터 도착·재렌더 뒤에도 입력값을 유지한다.
  const FX_NAMES = { KRW: "원", USD: "달러", EUR: "유로", JPY: "엔", CNY: "위안" };
  const FX_ORDER = ["KRW", "USD", "EUR", "JPY", "CNY"];
  const fxState = { amount: "1000000", from: "KRW" };
  let fxRatesCache = null;

  function fxFormat(v, code) {
    const c = C();
    return v === null ? c.DASH : c.fmtNum(v, c.fxDecimals(code));
  }

  function fxResultHtml() {
    const c = C();
    const rates = fxRatesCache || {};
    const amount = c.parseAmount(fxState.amount);
    const targets = FX_ORDER.filter((k) => k !== fxState.from && rates[k]);
    if (amount === null) return '<p class="fx-calc-empty muted">금액을 숫자로 입력해 주세요.</p>';
    return `<ul class="fx-calc-out">${targets.map((k) => {
      const v = c.fxConvert(amount, fxState.from, k, rates);
      return `<li><span class="fx-calc-cur">${esc(FX_NAMES[k])} <small>${k}</small></span><span class="fx-calc-val">${esc(fxFormat(v, k))}</span></li>`;
    }).join("")}</ul>`;
  }

  function fxCalcHtml(fxItems) {
    const c = C();
    fxRatesCache = c.fxRates(fxItems);
    const codes = FX_ORDER.filter((k) => fxRatesCache[k]);
    if (codes.length < 2) return "";
    if (!fxRatesCache[fxState.from]) fxState.from = "KRW";
    const dates = [...new Set(codes.map((k) => fxRatesCache[k].asOf).filter(Boolean))].sort();
    const dateText = dates.length ? dates.map((d) => c.fmtDate(d, true)).join(" · ") : "";
    const rateLine = codes.filter((k) => k !== "KRW").map((k) => `${FX_NAMES[k]} ${c.fmtNum(fxRatesCache[k].rate * (k === "JPY" ? 100 : 1), 2)}${k === "JPY" ? "(100엔)" : ""}`).join(" · ");
    return `
      <div class="fx-calc" id="fxCalc">
        <div class="fx-calc-in">
          <label class="fx-calc-field"><input type="text" inputmode="decimal" autocomplete="off" id="fxCalcAmount" value="${esc(fxState.amount)}" aria-label="바꿀 금액"></label>
          <label class="fx-calc-field fx-calc-sel"><select id="fxCalcFrom" aria-label="입력 통화">${codes.map((k) => `<option value="${k}"${k === fxState.from ? " selected" : ""}>${FX_NAMES[k]} (${k})</option>`).join("")}</select></label>
        </div>
        <div id="fxCalcResult">${fxResultHtml()}</div>
        <p class="fx-calc-note">시장 환율(Yahoo Finance) 기준 원화 크로스 계산 · 기준일 ${esc(dateText)} · 1단위당 원: ${esc(rateLine)}. 은행 고시 매매기준율·현찰·송금 환율이 아니며 수수료가 반영되지 않습니다.</p>
      </div>`;
  }

  function bindFxCalc(host) {
    if (host.dataset.fxBound) return;
    host.dataset.fxBound = "1";
    host.addEventListener("input", (e) => {
      if (e.target.id !== "fxCalcAmount") return;
      fxState.amount = e.target.value;
      const out = document.getElementById("fxCalcResult");
      if (out) out.innerHTML = fxResultHtml();
    });
    host.addEventListener("change", (e) => {
      if (e.target.id !== "fxCalcFrom") return;
      fxState.from = e.target.value;
      const out = document.getElementById("fxCalcResult");
      if (out) out.innerHTML = fxResultHtml();
    });
  }

  const GROUP_TITLES = {
    energy: "에너지",
    metals: "금속",
    agri: "농축산물",
  };
  const INDEX_GROUPS = [["korea", "국내"], ["global", "해외 지수"], ["futures", "미국 지수 선물"]];

  function esc(s) {
    return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function dirCls(change) {
    const d = C().direction(change);
    return d === "up" ? "mi-up" : d === "down" ? "mi-down" : "mi-flat";
  }

  function valueText(it) {
    const c = C();
    if (it.kind === "rate") return c.fmtRate(it.value);
    return c.fmtNum(it.value, c.decimalsFor(it));
  }

  function changeDecimals(it) {
    const c = C();
    if (it.kind === "rate") return 2;
    if (it.kind === "bond") return 3;
    return c.decimalsFor(it);
  }

  function staleTag(it) {
    return it.stale ? ' <span class="mi-tag" title="이번 수집에 실패해 직전 값을 표시합니다">직전값</span>' : "";
  }

  function freqTag(it) {
    return it.freq === "월간" ? ' <span class="mi-tag">월평균</span>' : "";
  }

  function spark(it, w, h) {
    const d = C().sparkPath(it.spark, w, h, 2);
    if (!d) return `<span class="mi-spark-empty" style="height:${h}px"></span>`;
    return `<svg class="mi-spark ${dirCls(it.change)}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function cardHtml(it) {
    const c = C();
    const sub = it.kind === "future" && it.contract ? `${c.fmtContract(it.contract)} 만기` : it.kind === "bond" ? "금리 %" : it.unit && it.unit !== "pt" ? it.unit : "";
    return `
      <article class="mi-card" aria-label="${esc(it.name)}">
        <div class="mi-card-head"><span class="mi-card-name">${esc(it.name)}</span><span class="mi-card-date">${esc(c.fmtDate(it.asOf))}</span></div>
        <div class="mi-card-val">${esc(valueText(it))}</div>
        <div class="mi-card-chg ${dirCls(it.change)}">${esc(c.fmtChange(it.change, it.kind === "bond" ? null : it.changePct, changeDecimals(it)))}</div>
        ${spark(it, 120, 30)}
        <div class="mi-card-sub">${esc(sub)}${staleTag(it)}${freqTag(it)}</div>
      </article>`;
  }

  function panel(title, body, note) {
    return `<section class="mi-panel"><div class="mi-panel-head"><h3>${esc(title)}</h3>${note ? `<span class="muted">${esc(note)}</span>` : ""}</div>${body}</section>`;
  }

  function priceTable(rows, { contract = false, unit = false } = {}) {
    const c = C();
    const head = `<tr><th scope="col">종목</th>${contract ? '<th scope="col" class="mi-c">만기월</th>' : ""}<th scope="col" class="mi-n">현재가</th><th scope="col" class="mi-n">전일대비</th><th scope="col" class="mi-n">등락률</th>${unit ? '<th scope="col" class="mi-opt">단위</th>' : ""}<th scope="col" class="mi-n mi-opt">기준일</th></tr>`;
    const body = rows.map((it) => {
      const cls = dirCls(it.change);
      return `<tr>
        <th scope="row">${esc(it.name)}${staleTag(it)}${unit ? `<span class="mi-unit-inline">${esc(it.unit)}</span>` : ""}</th>
        ${contract ? `<td class="mi-c">${esc(c.fmtContract(it.contract))}</td>` : ""}
        <td class="mi-n">${esc(valueText(it))}</td>
        <td class="mi-n ${cls}">${esc(c.fmtChangeAbs(it.change, changeDecimals(it)))}</td>
        <td class="mi-n ${cls}">${esc(c.fmtPct(it.changePct))}</td>
        ${unit ? `<td class="mi-opt mi-u">${esc(it.unit)}</td>` : ""}
        <td class="mi-n mi-opt mi-d">${esc(c.fmtDate(it.asOf))}</td>
      </tr>`;
    }).join("");
    return `<div class="mi-table-wrap"><table class="mi-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function bondTable(rows) {
    const c = C();
    const body = rows.map((it) => `<tr>
        <th scope="row">${esc(it.country || it.name)}${staleTag(it)}${freqTag(it)}</th>
        <td class="mi-n">${esc(c.fmtNum(it.value, 3))}</td>
        <td class="mi-n ${dirCls(it.change)}">${esc(c.fmtChangeAbs(it.change, 3))}</td>
        <td class="mi-n mi-d">${esc(c.fmtDate(it.asOf))}</td>
        <td class="mi-opt mi-src">${esc(it.source || "")}</td>
      </tr>`).join("");
    return `<div class="mi-table-wrap"><table class="mi-table"><thead><tr><th scope="col">국가</th><th scope="col" class="mi-n">금리(%)</th><th scope="col" class="mi-n">전일대비(%p)</th><th scope="col" class="mi-n">기준일</th><th scope="col" class="mi-opt">출처</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function rateTable(rows) {
    const c = C();
    const body = rows.map((it) => `<tr>
        <th scope="row">${esc(it.country || it.name)}${staleTag(it)}<span class="mi-unit-inline">${esc(it.bank || "")}</span></th>
        <td class="mi-opt">${esc(it.bank || "")}</td>
        <td class="mi-n">${esc(c.fmtRate(it.value))}</td>
        <td class="mi-n ${dirCls(it.change)}">${it.change === null || it.change === undefined ? C().DASH : esc(c.fmtChangeAbs(it.change, 2))}</td>
        <td class="mi-n mi-d">${esc(it.changedOn ? c.fmtDate(it.changedOn, true) : c.DASH)}</td>
      </tr>`).join("");
    return `<div class="mi-table-wrap"><table class="mi-table"><thead><tr><th scope="col">국가</th><th scope="col" class="mi-opt">중앙은행</th><th scope="col" class="mi-n">금리(%)</th><th scope="col" class="mi-n">전회대비</th><th scope="col" class="mi-n">변경일</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function render() {
    const host = document.getElementById("tab-marketindex");
    if (!host) return;
    const data = window.MARKET_INDICATORS;
    if (!data || !Array.isArray(data.items) || !window.MirMarketIndicatorsCore) {
      if (!host.querySelector(".mi-loading")) host.innerHTML = '<div class="mi-loading"><p class="muted">시장지표를 불러오는 중…</p></div>';
      if (!pending && typeof ensureFeatureData === "function") {
        pending = ensureFeatureData("marketIndicators").then((ok) => {
          pending = null;
          if (ok) render();
          else host.innerHTML = '<div class="mi-loading"><p class="muted">시장지표를 불러오지 못했습니다. 잠시 뒤 다시 확인해 주세요.</p></div>';
        });
      }
      return;
    }
    const c = C();
    const byId = {};
    data.items.forEach((it) => { if (it && it.id) byId[it.id] = it; });
    const groups = c.groupBy(data.items);
    const cards = (data.cards || []).map((id) => byId[id]).filter(Boolean);

    const indexRows = INDEX_GROUPS.flatMap(([g]) => groups[g] || []);
    const parts = [];
    parts.push(`<div class="section-title"><h2>시장지표</h2><p>원자재 선물·해외 지수·환율·주요국 국채 금리와 기준금리.</p></div>`);
    if (cards.length) parts.push(`<div class="mi-cards">${cards.map(cardHtml).join("")}</div>`);

    const left = [];
    const right = [];
    // 두 열에 높이를 맞춰 배치: 왼쪽 지수·에너지·금속, 오른쪽 환율·국채·기준금리·농축산물.
    if (indexRows.length) left.push(panel("지수", priceTable(indexRows), "선물은 연속 근월물"));
    ["energy", "metals"].forEach((g) => { if ((groups[g] || []).length) left.push(panel(GROUP_TITLES[g], priceTable(groups[g], { contract: true, unit: true }))); });
    if ((groups.fx || []).length) {
      right.push(panel("환율", priceTable(groups.fx), "엔은 100엔 기준"));
      const calc = fxCalcHtml(groups.fx);
      if (calc) right.push(panel("환율 계산기", calc));
    }
    if ((groups.bonds || []).length) right.push(panel("국채 10년", bondTable(groups.bonds)));
    if ((groups.policy || []).length) right.push(panel("기준금리", rateTable(groups.policy), "미국은 목표범위 중간값 · 중국은 LPR 1년"));
    if ((groups.agri || []).length) right.push(panel(GROUP_TITLES.agri, priceTable(groups.agri, { contract: true, unit: true })));
    parts.push(`<div class="mi-grid"><div class="mi-col">${left.join("")}</div><div class="mi-col">${right.join("")}</div></div>`);

    parts.push(`<p class="mi-foot">출처: Yahoo Finance(선물·지수·환율, 지연 시세) · FRED · 한국은행 ECOS · 일본 재무성 · 독일연방은행 · 영란은행 · BIS. 기준일은 각 시장 현지 날짜. 업데이트 ${esc(data.updatedAtKst || "")}. 정보 제공용이며 투자 권유가 아닙니다.</p>`);
    // 재렌더(데이터 도착 등) 때 입력칸에 포커스가 있었으면 되돌린다.
    const hadFocus = document.activeElement && document.activeElement.id === "fxCalcAmount";
    host.innerHTML = parts.join("");
    bindFxCalc(host);
    if (hadFocus) document.getElementById("fxCalcAmount")?.focus();
  }

  window.renderMarketIndicators = render;
})();
