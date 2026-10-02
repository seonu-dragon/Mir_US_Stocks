// target-changes.js — 목표주가 상향·하향 목록(종목 › 찾기 '목표가 변경') + 국내 종목별 증권사 목표가 이력.
// ====================================================================================
// 클래식 스크립트(모듈 아님). 전역 이름은 tc 접두사.
//   · KR: window.KR_TARGET_CHANGES(build_kr_target_changes.py, lazy) — 같은 증권사 직전 리포트 대비 변경.
//         종목별 이력은 data/korea/target_history/NN.json 해시 샤드(company-info.js ciShardUrl 규칙).
//   · US: window.US_PRICE_TARGETS_INDEX.changes(build_us_price_targets.py) — 평균 목표가 ±3% 넘는 변경.
//         종목별 이력(th)은 company-info.js 목표주가 범위 카드가 그린다.
// 국내 이력은 컨센서스 카드의 접힘(<details data-kr-th>)을 처음 펼 때만 받는다.

function tcKr() { return typeof isKrMarket === "function" && isKrMarket(); }

function tcMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return tcKr() ? `${Math.round(n).toLocaleString("ko-KR")}원` : `$${n.toFixed(2)}`;
}

function tcStockByTicker(t) {
  const stocks = (typeof data === "object" && data && Array.isArray(data.stocks)) ? data.stocks : [];
  if (!tcStockByTicker._map || tcStockByTicker._src !== stocks) {
    tcStockByTicker._map = new Map(stocks.map((s) => [String(s.ticker), s]));
    tcStockByTicker._src = stocks;
  }
  return tcStockByTicker._map.get(String(t)) || null;
}

// 종목 › 찾기 › 목록 '목표가 변경'. dir: "all" | "up" | "down".
let tcDir = "all";

function tcRenderList(wrap) {
  const kr = tcKr();
  const key = kr ? "krTargetChanges" : "usPriceTargets";
  const src = kr ? window.KR_TARGET_CHANGES : window.US_PRICE_TARGETS_INDEX;
  if (!src) {
    if (typeof ftSetMeta === "function") ftSetMeta("목표가 변경");
    wrap.innerHTML = `<p class="ft-empty muted">목표주가 데이터를 불러오는 중입니다.</p>`;
    if (typeof ensureFeatureData === "function") {
      ensureFeatureData(key).then((ok) => { if (ok && typeof ftList !== "undefined" && ftList === "targets") tcRenderList(wrap); });
    }
    return;
  }
  const all = (Array.isArray(src.changes) ? src.changes : []).map((c) => (kr
    ? { t: c.code, name: c.name, d: c.date, prev: c.prev, now: c.target, pct: c.pct, who: c.broker, prevDate: c.prevDate, op: c.opinion }
    : { t: c.t, name: c.t, d: c.d, prev: c.prev, now: c.avg, pct: c.pct, who: Number(c.n) ? `애널리스트 ${c.n}명 평균` : "평균" }));
  const counts = { all: all.length, up: all.filter((r) => r.pct > 0).length, down: all.filter((r) => r.pct < 0).length };
  const rows = tcDir === "all" ? all : all.filter((r) => (tcDir === "up" ? r.pct > 0 : r.pct < 0));
  if (typeof ftSetMeta === "function") ftSetMeta(`목표가 변경 · 최근 ${kr ? src.windowDays || 30 : 30}일 · ${rows.length}건`);
  const chips = `<div class="ft-chips ft-subchips" role="group" aria-label="방향">${[["all", "전체"], ["up", "상향"], ["down", "하향"]].map(([k, label]) => `<button type="button" class="ft-chip${tcDir === k ? " is-active" : ""}" data-tc-dir="${k}" aria-pressed="${tcDir === k ? "true" : "false"}">${label} ${counts[k]}</button>`).join("")}</div>`;
  const warn = kr && src.complete === false ? `<p class="ft-list-note">리포트 이력을 채우는 중이라 일부 변경이 빠져 있을 수 있습니다.</p>` : "";
  if (!rows.length) {
    wrap.innerHTML = chips + `<p class="ft-empty muted">해당하는 목표가 변경이 없습니다.</p>` + warn;
    return;
  }
  const head = `<th scope="col" class="ft-name">종목</th><th scope="col" class="num">날짜</th><th scope="col">${kr ? "증권사" : "기준"}</th><th scope="col" class="num">이전 목표가</th><th scope="col" class="num">새 목표가</th><th scope="col" class="num">변화</th><th scope="col" class="num">현재가</th>`;
  const body = rows.map((r) => {
    const item = tcStockByTicker(r.t);
    const nameCell = typeof ftNameCell === "function"
      ? ftNameCell(null, item, r.name, item ? null : "시세 미수집")
      : `<td>${escapeHtml(r.name || r.t)}</td>`;
    return `<tr${item ? ` data-ticker="${escapeHtml(item.ticker)}" tabindex="0"` : ' class="is-static"'}>
      ${nameCell}
      <td class="num">${escapeHtml(String(r.d || "").replace(/-/g, "."))}</td>
      <td class="ft-text">${escapeHtml(r.who || "—")}${r.op ? ` <span class="muted">${escapeHtml(r.op)}</span>` : ""}</td>
      <td class="num"${r.prevDate ? ` title="${escapeHtml(r.prevDate)} 리포트"` : ""}>${tcMoney(r.prev)}</td>
      <td class="num">${tcMoney(r.now)}</td>
      <td class="num"><span class="${cls(r.pct)}">${fmtPct(r.pct)}</span></td>
      <td class="num">${item && typeof ftPriceText === "function" ? ftPriceText(item) : "—"}</td>
    </tr>`;
  }).join("");
  wrap.innerHTML = chips + (typeof ftTableHtml === "function" ? ftTableHtml(head, body, "ft-list-table") : `<table>${head}${body}</table>`)
    + `<p class="ft-list-note">업데이트 ${escapeHtml(src.updatedAtKst || "")}</p>` + warn;
  wrap.querySelectorAll("[data-tc-dir]").forEach((b) => b.addEventListener("click", () => {
    tcDir = b.dataset.tcDir || "all";
    tcRenderList(wrap);
  }));
}

// ── 국내 종목별 증권사 목표가 이력(컨센서스 카드 접힘) ─────────────────────
function tcKrHistoryDetailsHtml(code) {
  if (!code) return "";
  return `<details class="ci-hist" data-kr-th="${escapeHtml(String(code))}"><summary>증권사별 목표가 이력</summary><div class="tc-th-body muted">불러오는 중…</div></details>`;
}

function tcKrHistoryRowsHtml(rows) {
  const items = rows.slice(0, 20).map(([d, broker, target, prev]) => {
    const pct = prev ? (target / prev - 1) * 100 : null;
    const chg = pct == null ? `<span class="muted">첫 리포트</span>`
      : Math.abs(pct) < 0.05 ? `<span class="muted">유지</span>` : `<span class="${cls(pct)}">${fmtPct(pct)}</span>`;
    return `<tr><td style="white-space:nowrap">${escapeHtml(String(d).slice(2).replace(/-/g, "."))}</td><td>${escapeHtml(broker)}</td><td class="num">${tcMoney(target)}</td><td class="num">${chg}</td></tr>`;
  }).join("");
  return `<table class="ci-hist-table"><thead><tr><th>날짜</th><th>증권사</th><th class="num">목표가</th><th class="num">직전 대비</th></tr></thead><tbody>${items}</tbody></table>`;
}

function tcLoadKrHistory(details) {
  if (details.dataset.loaded) return;
  details.dataset.loaded = "1";
  const code = details.dataset.krTh;
  const body = details.querySelector(".tc-th-body");
  const ready = window.KR_TARGET_CHANGES ? Promise.resolve(true)
    : (typeof ensureFeatureData === "function" ? ensureFeatureData("krTargetChanges") : Promise.resolve(false));
  ready.then((ok) => {
    const ix = window.KR_TARGET_CHANGES;
    if (!ok || !ix || typeof ciShardUrl !== "function") return null;
    return ciFetch(ciShardUrl("data/korea/target_history", "", code, ix));
  }).then((pl) => {
    const rows = pl && pl.t ? pl.t[code] : null;
    if (!body) return;
    body.classList.remove("muted");
    body.innerHTML = Array.isArray(rows) && rows.length ? tcKrHistoryRowsHtml(rows) : `<p class="muted">최근 1년 리포트 목표가가 없습니다.</p>`;
  }).catch(() => { if (body) body.textContent = "불러오지 못했습니다."; delete details.dataset.loaded; });
}

// toggle 은 버블링하지 않는다 — 캡처 단계에서 받는다(카드는 문자열로 다시 그려지므로 위임).
document.addEventListener("toggle", (ev) => {
  const el = ev.target;
  if (el && el.matches && el.matches("details[data-kr-th]") && el.open) tcLoadKrHistory(el);
}, true);
