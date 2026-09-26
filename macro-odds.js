// macro-odds.js — 예측시장 확률(Kalshi · Polymarket) + 침체 신호 모음
// =====================================================
// 시장 탭 › 시그널의 접이식 위젯 '예측시장 · 침체 신호'. 데이터는 window.MACRO_ODDS
// (scripts/build_macro_odds.py, FEATURE_DATA.macroOdds). 두 시장 모두 로드한다 — 미국 매크로지만
// 금리·침체 기대는 국내 위험자산에도 공통 배경이라서다(화면에 '미국 매크로' 로 명시).
//
// 정직성 규약:
// - 예측시장 가격은 참여자 베팅으로 형성된 값이다. 예측의 정답·매매 신호로 쓰지 않는다(문구 고정).
// - 침체 신호는 각 지표를 나란히 둘 뿐 합성 점수를 만들지 않는다. "N개 중 M개 임계 초과" 만 센다.
//   공인 임계가 없는 지표(GZ 침체확률)는 값만 보이고 개수에서 뺀다(빌더가 breached=null 로 준다).
// 클래식 스크립트(전역 공유)라 최상위 이름은 mo 접두어로 충돌을 피한다.

const MO_TOPIC_TITLE = {
  fomc: "다음 FOMC 금리 결정",
  cpi: "미국 CPI 상승률 (다음 발표)",
  recession: "미국 경기침체 (올해)",
  bok: "한국은행 기준금리 결정",
};
const MO_VENUE_NOTE = {
  Kalshi: "미국 CFTC 규제 거래소",
  Polymarket: "블록체인 기반 예측시장",
};

function moPct(p, digits) {
  const v = Number(p);
  if (!Number.isFinite(v)) return "—";
  const pct = v * 100;
  const d = digits != null ? digits : (pct > 0 && pct < 1 ? 1 : 0);
  return `${pct.toFixed(d)}%`;
}

// 한국식 큰 수 표기(만·억). 계약 수·달러 모두 같은 규칙.
function moBig(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e8) return `${(v / 1e8).toFixed(a >= 1e9 ? 0 : 1)}억`;
  if (a >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만`;
  return Math.round(v).toLocaleString();
}

function moDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  // KST 날짜로 표시
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return k.toISOString().slice(0, 10);
}

// 0~1 확률 스파크라인(고정 스케일 — 결과끼리 높이를 비교할 수 있게).
function moSpark(hist, w = 72, h = 18, fixed = true) {
  const pts = (hist || []).map((x) => Number(x.p != null ? x.p : x.v)).filter(Number.isFinite);
  if (pts.length < 2) return "";
  let mn = 0, mx = 1;
  if (!fixed) {
    mn = Math.min(...pts); mx = Math.max(...pts);
    if (mx - mn < 1e-9) { mn -= 0.5; mx += 0.5; }
  }
  const x = (i) => 1 + (w - 2) * i / (pts.length - 1);
  const y = (v) => 1 + (h - 2) * (1 - (v - mn) / (mx - mn));
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const first = pts[0], last = pts[pts.length - 1];
  const col = last > first ? "#5b8def" : last < first ? "var(--muted)" : "var(--muted)";
  return `<svg class="mo-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.3"/></svg>`;
}

function moChange(hist) {
  const pts = (hist || []).map((x) => Number(x.p)).filter(Number.isFinite);
  if (pts.length < 2) return "";
  const diff = (pts[pts.length - 1] - pts[0]) * 100;
  if (Math.abs(diff) < 0.5) return `<span class="mo-chg">30일 ±0</span>`;
  return `<span class="mo-chg">30일 ${diff > 0 ? "▲" : "▼"}${Math.abs(diff).toFixed(0)}%p</span>`;
}

function moOutcomeRows(g) {
  const maxP = Math.max(0.0001, ...g.outcomes.map((o) => Number(o.prob) || 0));
  return g.outcomes.map((o) => {
    const p = Number(o.prob) || 0;
    const lead = p === maxP && g.topic !== "cpi";
    return `<div class="mo-row${lead ? " is-lead" : ""}">
      <span class="mo-lbl">${escapeHtml(o.label || o.raw || "")}</span>
      <span class="mo-bar"><i style="width:${Math.max(1, Math.min(100, p * 100)).toFixed(1)}%"></i></span>
      <span class="mo-val">${moPct(p)}</span>
      <span class="mo-trend" title="최근 30일 가격 추이">${moSpark(o.history)}</span>
    </div>`;
  }).join("");
}

function moVenueBlock(g) {
  const liqTxt = g.liquidityKind === "openInterest"
    ? `미결제약정 ${moBig(g.liquidity)}계약`
    : `호가 유동성 $${moBig(g.liquidity)}`;
  const volTxt = g.venue === "Kalshi" ? `거래량 ${moBig(g.volume)}계약` : `거래량 $${moBig(g.volume)}`;
  const when = g.eventDate ? `결정일 ${escapeHtml(g.eventDate)}` : `마감 ${escapeHtml(moDate(g.closeTime))}`;
  let body;
  if (g.topic === "recession") {
    const o = g.outcomes[0] || {};
    body = `<div class="mo-single"><strong>${moPct(o.prob)}</strong>${moChange(o.history)}${moSpark(o.history, 120, 26, false)}</div>`;
  } else {
    body = `<div class="mo-rows">${moOutcomeRows(g)}</div>`;
  }
  const rules = g.rules
    ? `<details class="mo-rules"><summary>판정 기준(원문)</summary><p lang="en">${escapeHtml(g.rules)}</p></details>` : "";
  const cpiNote = g.topic === "cpi"
    ? `<p class="mo-note">${g.venue === "Kalshi" ? "각 줄은 '그 값을 넘을' 확률(누적)입니다." : "각 줄은 발표치가 '정확히 그 값'일 확률(구간)입니다."} 결판이 난 3% 미만·97% 초과 구간은 뺐습니다.</p>` : "";
  return `<div class="mo-venue">
    <div class="mo-venue-head">
      <a href="${escapeHtml(g.url || "#")}" target="_blank" rel="noopener noreferrer" class="mo-venue-name" title="${escapeHtml(MO_VENUE_NOTE[g.venue] || "")}">${escapeHtml(g.venue)}</a>
      <span class="mo-venue-title" lang="en">${escapeHtml(g.eventTitle || "")}</span>
    </div>
    ${body}
    ${cpiNote}
    <p class="mo-meta">${when} · ${volTxt} · ${liqTxt}${g.settlement ? ` · 판정 출처 ${escapeHtml(g.settlement)}` : ""} · ${escapeHtml(g.priceBasis || "")}</p>
    ${rules}
  </div>`;
}

function moTopicCard(topic, groups) {
  if (!groups.length) return "";
  return `<article class="mo-card">
    <h3>${escapeHtml(MO_TOPIC_TITLE[topic] || topic)}</h3>
    ${groups.map(moVenueBlock).join("")}
  </article>`;
}

function moFmtSignal(r) {
  const v = Number(r.value);
  if (!Number.isFinite(v)) return "—";
  const digits = Math.abs(v) >= 10 ? 1 : 2;
  const unit = r.unit === "%" ? "%" : r.unit === "%p" ? "%p" : "";
  return `${v > 0 && r.compare === "lt" ? "+" : ""}${v.toFixed(digits)}${unit}`;
}

function moRecessionCard(rec, marketGroups) {
  if (!rec || !Array.isArray(rec.indicators) || !rec.indicators.length) return "";
  const rows = rec.indicators.map((r) => {
    let state;
    if (r.breached === true) state = `<span class="mo-state is-over">임계 초과</span>`;
    else if (r.breached === false) state = `<span class="mo-state">임계 미만</span>`;
    else state = `<span class="mo-state is-na">판정 없음</span>`;
    const src = r.sourceUrl
      ? `<a href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.source || "출처")}</a>`
      : escapeHtml(r.source || "");
    return `<div class="mo-sig" role="row">
      <div class="mo-sig-name" role="cell"><strong>${escapeHtml(r.name)}</strong><div class="mo-sub" title="${escapeHtml(r.basis || "")}">${src}</div></div>
      <div class="mo-sig-val" role="cell"><strong>${moFmtSignal(r)}</strong></div>
      <div class="mo-sig-thr mo-sub" role="cell"><span class="mo-mlabel">임계 </span>${escapeHtml(r.thresholdText || "")}</div>
      <div class="mo-sig-state" role="cell">${state}</div>
      <div class="mo-sig-date mo-sub" role="cell"><span class="mo-mlabel">기준 </span>${escapeHtml(String(r.date || ""))}${r.carriedSince ? " (직전 값 유지)" : ""}</div>
      <div class="mo-trend mo-sig-trend" role="cell">${moSpark(r.history, 72, 18, false)}</div>
    </div>`;
  }).join("");
  const mkt = (marketGroups || []).map((g) => {
    const o = g.outcomes[0] || {};
    return `<div class="mo-mkt"><span>${escapeHtml(g.venue)}</span><strong>${moPct(o.prob)}</strong>${moSpark(o.history, 64, 16, false)}</div>`;
  }).join("");
  const basisList = rec.indicators.map((r) => `<li><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.basis || "")}</li>`).join("");
  return `<article class="mo-card mo-card-wide">
    <h3>침체 신호 모음 <span class="mo-count">${rec.evaluated}개 중 <b>${rec.breached}</b>개 임계 초과</span></h3>
    <p class="mo-note">공식 지표를 한 표에 모았습니다. 점수로 합치지 않고, 각 지표를 발표 기관·원 논문의 임계값과 비교만 합니다. 월간 지표는 발표 시차가 있어 기준 시점이 서로 다릅니다.</p>
    ${mkt ? `<div class="mo-mkts"><span class="mo-sub">예측시장의 올해 침체 확률</span>${mkt}</div>` : ""}
    <div class="mo-sigs" role="table" aria-label="침체 신호 지표">
      <div class="mo-sig mo-sig-head" role="row"><div role="columnheader">지표</div><div role="columnheader" class="mo-sig-val">현재값</div><div role="columnheader">임계</div><div role="columnheader">상태</div><div role="columnheader">기준 시점</div><div role="columnheader">추이</div></div>
      ${rows}
    </div>
    <details class="mo-rules"><summary>임계값 근거</summary><ul>${basisList}</ul></details>
    <p class="mo-meta">기준 ${escapeHtml(rec.industryUpdatedAtKst || "")}</p>
  </article>`;
}

function renderMacroOdds() {
  const host = byId("macroOdds");
  if (!host) return;
  const d = window.MACRO_ODDS;
  if (!d || !Array.isArray(d.groups) || !d.groups.length) { host.innerHTML = ""; return; }
  const by = {};
  d.groups.forEach((g) => { (by[g.topic] = by[g.topic] || []).push(g); });
  const cards = [
    moTopicCard("fomc", by.fomc || []),
    moTopicCard("cpi", by.cpi || []),
    moRecessionCard(d.recession, by.recession || []),
    // 침체 신호 카드가 없을 때만 예측시장 침체 확률을 따로 카드로 낸다.
    d.recession && d.recession.indicators && d.recession.indicators.length ? "" : moTopicCard("recession", by.recession || []),
    moTopicCard("bok", by.bok || []),
  ].filter(Boolean).join("");
  const excluded = Array.isArray(d.excluded) && d.excluded.length
    ? `<p class="mo-note">유동성이 작아 뺀 시장: ${d.excluded.map((x) => `${escapeHtml(MO_TOPIC_TITLE[x.topic] || x.topic)} · ${escapeHtml(x.venue)} (${escapeHtml(x.reason || "")})`).join(" / ")}</p>` : "";
  const down = Object.entries(d.sources || {}).filter(([, v]) => v && v.ok === false).map(([k]) => (k === "polymarket" ? "Polymarket" : "Kalshi"));
  const downNote = down.length ? `<p class="mo-note">이번 갱신에서 ${escapeHtml(down.join(", "))} 수집에 실패해 해당 거래소 값이 빠졌습니다.</p>` : "";
  host.innerHTML = `
    <div class="section-title"><h2>예측시장 확률 · 침체 신호 <span class="mo-tag">미국 매크로</span></h2>
      <p>Kalshi·Polymarket 에서 거래되는 금리·물가·침체 시장의 가격(=참여자들이 매긴 확률)과 공식 침체 지표를 나란히 봅니다. 기준 ${escapeHtml(d.updatedAtKst || "")}.</p></div>
    <div class="mo-grid">${cards}</div>
    ${excluded}${downNote}
    <p class="mo-disclaimer">${escapeHtml(d.disclaimer || "예측시장 가격은 참여자들의 베팅으로 형성된 값이며 예측의 정답이 아닙니다.")} 출처: ${escapeHtml(String(d.source || "").replace(/\s*\(산업 지표 재사용\)/, ""))}.</p>`;
}
