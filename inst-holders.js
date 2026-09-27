// inst-holders.js — 종목 분석 › 수급·보유 탭의 '기관 보유 변화 (13F)' 카드 (미국 전용)
// =====================================================
// 데이터: data/institutional_holders/index.js(window.US_INST_HOLDERS_INDEX, lazy) + 종목 첫 글자 샤드 하나만 fetch
//   - data/institutional_holders/<A>.json = {n: {CIK: 제출 기관명}, t: {티커: 레코드}} (레코드 형식은 inst-holders-core.js 머리)
// 출처는 SEC Form 13F 데이터셋 — 분기말 기준 보고서가 45일 안에 제출되고 데이터셋은 그 뒤 공개된다(공개 지연을 항상 적는다).
// 샤드(수백 KB)는 수급·보유 탭이 열려 있을 때만 받는다. selectTicker(renderSearch)·refreshFeatureViews·
// 탭 전환(stock-view.js sdEnsureFlowData)이 부른다. 기관 이름이 이 사이트 13F 기관 포트폴리오(기관 100곳)에 있으면
// 그 기관 화면으로 이동하는 버튼이 된다(INSTITUTIONAL_13F 는 같은 탭이 열릴 때 받는다).

const _ihShardCache = {};  // url → Promise<json|null>
const IH = (typeof window !== "undefined" && window.MirInstHoldersCore) || null;

function ihFetch(key, meta) {
  const ver = (meta.shardVer && meta.shardVer[key]) || meta.updatedAtKst || "";
  const url = `data/institutional_holders/${encodeURIComponent(key)}.json?v=${encodeURIComponent(ver)}`;
  if (!_ihShardCache[url]) {
    _ihShardCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => { if (!j) delete _ihShardCache[url]; return j; });
  }
  return _ihShardCache[url];
}

// CIK → 이 사이트 13F 기관 포트폴리오의 기관 {id, name}. 13F 기관 데이터가 아직 없으면 빈 객체.
function ihInstitutionLinks() {
  const out = {};
  for (const inst of ((window.INSTITUTIONAL_13F || {}).institutions || [])) {
    if (!inst || !inst.cik || !(inst.quarters || []).length) continue;
    out[String(Number(inst.cik))] = { id: inst.id, name: inst.name };
  }
  return out;
}

function ihFlowTabOpen() {
  return typeof sdActiveView !== "function" || sdActiveView() === "flow";
}

function ihBind(host) {
  if (host.dataset.ihBound) return;
  host.dataset.ihBound = "1";
  host.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-ih-inst]");
    if (!b || !host.contains(b)) return;
    // 기관 포트폴리오 화면(공시 › 13F)에서 그 기관을 고른 상태로 연다.
    selectedInstitutionId = b.dataset.ihInst;
    selectedInstitutionQuarterIdx = 0;
    institutionalSearchQuery = "";
    const search = byId("institutionalSearch");
    if (search) search.value = "";
    activateTab("institutional", { sub: "13f" });
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

function renderInstHolders(item) {
  const host = byId("instHoldersCard");
  if (!host) return;
  const hide = () => { host.hidden = true; host.innerHTML = ""; delete host.dataset.ihTicker; };
  const ticker = item && item.ticker;
  if (!ticker || !IH || isKrMarket() || featureOff("instHolders")) return hide();
  if (host.dataset.ihTicker && host.dataset.ihTicker !== ticker) hide();
  // 수급·보유 탭이 닫혀 있으면 샤드를 받지 않는다 — 탭을 열 때 sdEnsureFlowData 가 다시 부른다.
  if (!ihFlowTabOpen()) return;
  const meta = window.US_INST_HOLDERS_INDEX;
  if (!meta) {
    ensureFeatureData("usInstHolders").then((ok) => { if (ok && selectedTicker === ticker) renderInstHolders(item); });
    return;
  }
  const key = IH.shardKey(ticker);
  if (!(meta.shards || []).includes(key)) return hide();
  ihBind(host);
  ihFetch(key, meta).then((sh) => {
    if (selectedTicker !== ticker) return;
    const rec = sh && sh.t && sh.t[ticker];
    const sum = IH.summarize(rec);
    if (!sum) return hide();
    host.hidden = false;
    host.dataset.ihTicker = ticker;
    host.innerHTML = ihCardHtml(ticker, rec, sum, sh.n || {}, meta);
  });
}

function ihStat(label, value, sub, tone) {
  return `<div class="ih-stat"><span class="ih-stat-l">${escapeHtml(label)}</span><strong class="ih-stat-v">${escapeHtml(value)}</strong>${sub ? `<span class="ih-stat-s${tone ? ` ${tone}` : ""}">${escapeHtml(sub)}</span>` : ""}</div>`;
}

function ihTone(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "";
  return v > 0 ? "is-pos" : "is-neg";
}

function ihSpark(series, field, label, fmt) {
  const w = 220, h = 44;
  const sp = IH.sparkline(series.map((p) => p[field]), w, h, 4);
  const firstIdx = series.findIndex((p) => p[field] !== null);
  const last = series[series.length - 1];
  if (!sp || firstIdx < 0 || !last || last[field] === null) return "";
  const first = series[firstIdx];
  const dots = sp.points.map((pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="${pt.i === series.length - 1 ? 2.8 : 1.6}"><title>${escapeHtml(IH.quarterLabel(series[pt.i].period))} ${escapeHtml(fmt(pt.v))}</title></circle>`).join("");
  return `<figure class="ih-spark">
    <figcaption><span>${escapeHtml(label)}</span><strong>${escapeHtml(fmt(last[field]))}</strong></figcaption>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`${label} 분기 추이`)}"><path d="${sp.path}"/>${dots}</svg>
    <div class="ih-spark-x"><span>${escapeHtml(IH.quarterLabel(first.period, true))}</span><span>${escapeHtml(IH.quarterLabel(last.period, true))}</span></div>
  </figure>`;
}

function ihCardHtml(ticker, rec, sum, names, meta) {
  const latest = IH.quarterLabel(meta.latest);
  const prev = IH.quarterLabel(meta.prev);
  const ch = sum.changes;
  const bars = IH.changeBars(ch);
  const stats = [
    ihStat("보고 기관", `${sum.holders.toLocaleString("en-US")}곳`,
      sum.holdersDelta !== null ? `직전 분기 대비 ${IH.fmtSignedInt(sum.holdersDelta)}곳` : "", ihTone(sum.holdersDelta)),
    ihStat("합계 보유 주식", IH.fmtShares(sum.shares),
      sum.sharesDeltaPct !== null ? `직전 분기 대비 ${IH.fmtSignedPct(sum.sharesDeltaPct)}` : "", ihTone(sum.sharesDeltaPct)),
    ihStat("발행주식 대비", sum.pctOut !== null ? `${sum.pctOut.toFixed(1)}%` : "—",
      sum.pctOut !== null && sum.pctOut > 100 ? "중복 보고로 100% 초과 가능" : "13F 보고분 합계"),
    ihStat("보유 가치", IH.fmtUsd(sum.value), "분기말 시가 기준 보고액"),
  ].join("");

  const barHtml = `<div class="ih-block"><h4>직전 분기 대비 기관 수 <span>${escapeHtml(prev)} → ${escapeHtml(latest)} · 두 분기 모두 보고한 ${ch.comparable.toLocaleString("en-US")}곳 기준</span></h4>
    <ul class="ih-bars">${bars.map((b) => `<li class="is-${b.dir}"><span class="ih-bl">${escapeHtml(b.label)}</span><span class="ih-bar" aria-hidden="true"><i style="width:${b.width}%"></i></span><span class="ih-bv">${b.n.toLocaleString("en-US")}곳</span></li>`).join("")}</ul>
    <p class="ih-note">유지 ${ch.same.toLocaleString("en-US")}곳${sum.split ? ` · 분기 중 주식 수 비율 ×${escapeHtml(String(Math.round(sum.split * 100) / 100))} 변동(액면분할 추정) — 직전 수량을 맞춰 비교` : ""}</p></div>`;

  const series = IH.trendSeries(rec, meta.quarters || []);
  const sparks = [ihSpark(series, "holders", "보고 기관 수", (v) => `${Number(v).toLocaleString("en-US")}곳`),
    ihSpark(series, "shares", "합계 보유 주식", IH.fmtShares)].filter(Boolean).join("");
  const trendHtml = sparks ? `<div class="ih-block"><h4>분기 추이 <span>최근 ${series.length}분기</span></h4><div class="ih-sparks">${sparks}</div></div>` : "";

  const opt = sum.options;
  const optHtml = opt ? `<p class="ih-opt">옵션 보유(주식과 별도 집계): 콜 ${opt.callHolders.toLocaleString("en-US")}곳 · 기초 ${escapeHtml(IH.fmtShares(opt.callShares))} / 풋 ${opt.putHolders.toLocaleString("en-US")}곳 · 기초 ${escapeHtml(IH.fmtShares(opt.putShares))}</p>` : "";

  const links = ihInstitutionLinks();
  const rows = IH.topRows(rec, names, links);
  const table = rows.length ? `<div class="ih-block"><h4>상위 보유 기관 <span>보유 주식 수 순 ${rows.length}곳</span></h4>
    <div class="table-wrap"><table class="ih-table">
      <thead><tr><th class="ih-rank">#</th><th>기관</th><th class="num">보유 주식</th><th class="num">직전 분기 대비</th><th class="num ih-col-val">가치</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const nameCell = r.link
          ? `<button type="button" class="ih-link" data-ih-inst="${escapeHtml(r.link.id)}" title="${escapeHtml(`${r.link.name} 13F 포트폴리오 보기`)}"><strong>${escapeHtml(r.name)}</strong></button><span class="ih-sub">${escapeHtml(r.link.name)} · 포트폴리오 보기</span>`
          : `<strong class="ih-plain">${escapeHtml(r.name)}</strong>`;
        const delta = r.status === "na" ? `<span class="ih-badge is-na" title="이 기관은 직전 분기 13F 를 내지 않아 비교할 수 없습니다">직전 없음</span>`
          : r.status === "new" ? `<span class="ih-badge is-pos">신규</span>`
          : r.status === "same" ? `<span class="ih-badge">유지</span>`
          : `<span class="ih-delta ${r.status === "inc" ? "is-pos" : "is-neg"}">${escapeHtml(IH.fmtSignedPct(r.deltaPct))}</span>`;
        return `<tr>
          <td class="ih-rank">${i + 1}</td>
          <td class="ih-name">${nameCell}</td>
          <td class="num">${escapeHtml(IH.fmtShares(r.shares))}${r.weightPct !== null ? `<span class="ih-sub ih-wsub">기관 합계의 ${r.weightPct.toFixed(1)}%</span>` : ""}</td>
          <td class="num">${delta}</td>
          <td class="num ih-col-val">${escapeHtml(IH.fmtUsd(r.value))}</td>
        </tr>`;
      }).join("")}</tbody></table></div></div>` : "";

  const prelim = meta.latestPreliminary ? " · 최신 분기는 늦게 낸 보고서가 빠진 잠정치" : "";
  return `<div class="fundamental-head"><h3>기관 보유 변화 (13F)</h3><span>보고 기준 ${escapeHtml(meta.latest || "—")} 분기말 · 공개 지연</span></div>
    <div class="ih-stats">${stats}</div>
    <div class="ih-grid"><div class="ih-main">${barHtml}${trendHtml}</div><div class="ih-side">${table}</div></div>
    ${optHtml}
    <p class="ih-foot">출처 SEC Form 13F 데이터셋 · 운용자산 1억 달러 이상 기관이 분기말 보유를 45일 안에 보고(공개는 그 뒤) — 지금 보유와 다를 수 있음${escapeHtml(prelim)} · 기관별로 같은 종목 여러 줄은 합산, 정정 보고는 최신본만 · 공매도·해외 상장분은 보고 대상이 아님 · 사실 표시이며 추천이 아닙니다</p>`;
}
