// kr-panels.js — 국내(KR) 전용 패널
// =================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고 같은 전역 스코프를 공유한다. 선언만 있고 로드 시점 실행문이 없다.
// 담는 것: 감사의견 경고, 종목 수급/컨센서스/그룹/국민연금 카드,
// DART 공시 패널(krEventDetailLine·renderKrDisclosures·setupKrDartEvents),
// 지분 공시(krOwn* · renderKrOwnership · setupKrOwnershipEvents).
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

// 감사의견 경고. 한국에서 '의견거절'·'한정'·'부적정' 은 상장폐지 사유라 가격보다 먼저
// 봐야 할 정보다. 실측(2,521종목): 비적정 47종목 — 금양·STX·삼부토건 등 지금도 거래 중.
// 강조사항(계속기업 불확실성 등)은 270종목(11%)이라 경고보다 한 단계 낮게 보여준다.
function auditOpinionNotice(item) {
  const book = window.KR_AUDIT_OPINION?.opinions;
  if (!book || !isKrMarket()) return "";
  const a = book[item?.ticker];
  if (!a) return "";
  if (a.adverse) {
    return `
      <p class="audit-notice audit-adverse">
        <b>감사의견 ${escapeHtml(a.opinion)}</b>
        <span>${escapeHtml(a.year)} · ${escapeHtml(a.auditor)} · 상장폐지 사유에 해당합니다</span>
      </p>`;
  }
  if (a.emphasis) {
    return `
      <p class="audit-notice audit-emphasis">
        <b>감사보고서 강조사항</b>
        <span>${escapeHtml(a.emphasis.slice(0, 120))}</span>
      </p>`;
  }
  return "";
}

// 수급·컨센서스 카드(국내 전용). 한국 투자자가 가장 많이 보는 숫자인데 이 사이트엔
// 시장 합계(브리핑)만 있고 종목별로는 없었다.
//
// 신호가 아니라 사실이다. validate_kr_flow.py 로 60거래일을 횡단면 검정했다 — 매일
// 수급으로 종목을 줄 세워 상위 10% 와 하위 10% 의 다음날 수익률 차이를 낸 결과:
//     외국인 t=+1.39 · 기관 t=-0.99  → 둘 다 무작위와 구분 안 됨
// 그래서 '누가 샀나'(사실)만 말하고 '그래서 오른다'(예측)로 팔지 않는다.
//
// 컨센서스 목표주가는 뺐다(아래 return 문 위 주석 참고). 검증이 불가능한 데다,
// 네이버가 주는 목표가 자체가 네이버의 현재가와 모순됐다.
function krFlowCard(item) {
  const book = window.KR_INVESTOR_FLOW?.stocks;
  if (!book || !isKrMarket()) return "";
  const f = book[item?.ticker];
  if (!f) return "";

  const shares = (v) => {
    if (!Number.isFinite(v)) return "-";
    const s = v < 0 ? "-" : "+";
    const a = Math.abs(v);
    if (a >= 1e8) return `${s}${(a / 1e8).toFixed(1)}억주`;
    if (a >= 1e4) return `${s}${Math.round(a / 1e4).toLocaleString()}만주`;
    return `${s}${Math.round(a).toLocaleString()}주`;
  };
  // 전역 cls 와 이름이 겹치던 지역 함수 — tone 으로 바꿔 섀도잉을 없앤다.
  const tone = (v) => (Number.isFinite(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : "");
  // 순매수 '수량' 만 보면 종목 간 비교가 안 된다 — 삼성전자 100만주와 소형주 100만주는
  // 전혀 다른 얘기다. 20일 거래량 대비 몇 %인지를 같이 보여준다.
  const pct = (v) => (Number.isFinite(v) ? fmtSignedPct(v) : "-");
  const row = (label, v5, v20, ratio) => `
    <tr>
      <th>${label}</th>
      <td class="${tone(v5)}">${shares(v5)}</td>
      <td class="${tone(v20)}">${shares(v20)}</td>
      <td class="${tone(ratio)}">${pct(ratio)}</td>
    </tr>`;

  // 컨센서스 목표주가는 싣지 않는다. 네이버가 주는 목표가가 네이버 자신의 현재가와
  // 안 맞는다 — 삼성전자 255,000원에 목표가 513,958원(2.0배), 콘텐트리중앙 1,493원에
  // 11,875원(8.0배). 배율이 종목마다 달라 단위 착오도 아니다. 550종목 중 목표가가
  // 현재가보다 낮은 건 1% 뿐이고 괴리율 중앙값이 +71.7% 였다(실제 국내 시장은 +20~30%대).
  // 설명도 보정도 못 하는 수치를 '상승여력' 으로 보여주면 그건 지어낸 것과 같다.
  return `
    <div class="krflow-card">
      <div class="krflow-head">
        <b>수급</b>
        ${Number.isFinite(f.hold) ? `<span class="muted">외국인 보유율 ${f.hold}%</span>` : ""}
        ${f.asOf ? `<span class="muted">· ${escapeHtml(String(f.asOf).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"))} 기준</span>` : ""}
      </div>
      <table class="krflow-table">
        <thead><tr><th></th><th>5일</th><th>20일</th><th>거래량 대비</th></tr></thead>
        <tbody>
          ${row("외국인", f.f5, f.f20, f.fPct)}
          ${row("기관", f.o5, f.o20, f.oPct)}
          ${row("개인", f.i5, f.i20, null)}
        </tbody>
      </table>
      <p class="krflow-note">누가 샀는지를 보여줄 뿐, 다음날 주가와는 무관합니다
         — 외국인·기관 순매수 상위 10%와 하위 10%의 다음날 수익률은 무작위와 구분되지
         않았습니다(60거래일 검정).</p>
    </div>`;
}

// opinionScore(1~5) → 라벨. opinionScale: 1=매도·2=비중축소·3=중립·4=매수·5=적극매수.
function krOpinionLabel(score) {
  if (!Number.isFinite(score)) return "";
  if (score >= 4.5) return "적극매수";
  if (score >= 3.5) return "매수";
  if (score >= 2.5) return "중립";
  if (score >= 1.5) return "비중축소";
  return "매도";
}

// 애널리스트 컨센서스 카드(국내 전용). US 는 Finnhub(ANALYST_CONSENSUS, ai-mode
// aiAnalystPanel)로 추천분포·EPS 서프라이즈를 보여주고, 국내는 이 카드가 그 거울이다.
//
// 정직성 원칙: 국내 셀사이드 목표주가는 구조적으로 현재가보다 높다(이번 스냅샷 시장
// 중앙값 +67.6%). 그래서 '상승여력' 을 초록색 매수 신호로 칠하지 않고 중립 톤 참고
// 수치로만 두고, 추정기관수(estimateCount)와 최근 리포트일(lastReportDate)을 눈에 잘
// 띄게 올려 1개 기관의 낡은 목표가가 '강한 컨센서스' 로 오인되지 않게 한다.
// KR_CONSENSUS 는 466종목만 커버 — 없는 종목은 카드를 통째로 숨긴다(빈 껍데기 금지).
function krConsensusCard(item) {
  const book = window.KR_CONSENSUS?.stocks;
  if (!book || !isKrMarket()) return "";
  const c = book[item?.ticker];
  if (!c) return "";
  const cfg = marketCfg();

  const tp = Number(c.targetPrice);
  const up = Number(c.upsidePct);
  const cnt = Number(c.estimateCount);
  const score = Number(c.opinionScore);
  const opLabel = krOpinionLabel(score);
  const lastDate = c.lastReportDate ? String(c.lastReportDate) : "";

  // 리포트가 오래되면 목표가는 그때 주가 기준이라 낡았다 — priceAtWrite 로 확인 가능.
  const todayMs = Date.parse(formatKstDateTime().slice(0, 10));
  const lastMs = lastDate ? Date.parse(lastDate) : NaN;
  const staleDays = (Number.isFinite(lastMs) && Number.isFinite(todayMs) && todayMs >= lastMs)
    ? Math.round((todayMs - lastMs) / 86400000) : null;
  const isStale = staleDays != null && staleDays > 120;
  const thin = Number.isFinite(cnt) && cnt > 0 && cnt <= 2;

  const head = `<div class="krflow-head">
    <b>애널리스트 컨센서스</b>
    ${Number.isFinite(cnt) && cnt > 0 ? `<span class="muted">추정 ${cnt}개 기관</span>` : ""}
    ${lastDate ? `<span class="muted">· 최근 리포트 ${escapeHtml(lastDate)}${staleDays != null ? ` (${staleDays}일 전)` : ""}</span>` : ""}
  </div>`;

  // 목표가·상승여력·투자의견 요약. 상승여력은 중립 톤(muted) — 매수 신호 아님.
  const fmtEok = (v) => {  // 억원 단위 값(매출·영업이익). 1조↑는 조로.
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n) >= 10000) return `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조원`;
    return `${Math.round(n).toLocaleString("ko-KR")}억원`;
  };
  const rows = [];
  if (Number.isFinite(tp) && tp > 0) rows.push(["목표주가", cfg.formatMoney(tp)]);
  if (Number.isFinite(up)) rows.push(["상승여력<span class=\"muted\"> (참고)</span>", `<span class="muted">${fmtSignedPct(up)}</span>`]);
  if (opLabel) rows.push(["투자의견", `${escapeHtml(opLabel)}${Number.isFinite(score) ? `<span class="muted"> · ${score.toFixed(2)}/5</span>` : ""}`]);
  if (Number.isFinite(Number(c.epsEstimate))) rows.push([`추정 EPS${c.estimateFy ? `<span class="muted"> (${escapeHtml(String(c.estimateFy))})</span>` : ""}`, cfg.formatMoney(Number(c.epsEstimate))]);
  if (Number.isFinite(Number(c.revenueEstimate))) rows.push(["추정 매출", fmtEok(c.revenueEstimate)]);
  if (Number.isFinite(Number(c.operatingEstimate))) rows.push(["추정 영업이익", fmtEok(c.operatingEstimate)]);

  const rowsHtml = rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");

  // 최근 리포트 목록: 증권사 · 목표가 · 투자의견 · 작성일(작성 당시 주가).
  let reportsHtml = "";
  const reports = Array.isArray(c.reports) ? c.reports.slice(0, 5) : [];
  if (reports.length) {
    const items = reports.map((r) => {
      const rt = Number(r.target);
      const paw = Number(r.priceAtWrite);
      const parts = [];
      if (Number.isFinite(rt) && rt > 0) parts.push(cfg.formatMoney(rt));
      if (r.opinion) parts.push(escapeHtml(String(r.opinion)));
      return `<li style="display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;padding:3px 0;font-variant-numeric:tabular-nums">
        <span style="font-weight:500">${escapeHtml(String(r.broker || "—"))}</span>
        <span>${parts.join(" · ")}</span>
        <span class="muted" style="font-size:var(--fs-cap)">${escapeHtml(String(r.date || ""))}${Number.isFinite(paw) && paw > 0 ? ` · 작성 당시 ${cfg.formatMoney(paw)}` : ""}</span>
      </li>`;
    }).join("");
    reportsHtml = `<div class="muted" style="margin:8px 0 2px;font-size:var(--fs-cap)">최근 리포트</div>
      <ul style="list-style:none;margin:0;padding:0;font-size:var(--fs-label)">${items}</ul>`;
  }

  const caveats = [];
  caveats.push("국내 증권사 목표주가는 구조적으로 낙관 편향이 있습니다(시장 중앙값 +67.6%). 참고용이며 매매 신호가 아닙니다.");
  if (thin) caveats.push(`추정 기관이 ${cnt}곳뿐이라 사실상 개별 의견에 가깝습니다.`);
  if (isStale) caveats.push("최근 리포트가 오래되어 목표가가 작성 당시 주가 기준으로 낡았을 수 있습니다.");
  const caveatHtml = `<p class="krflow-note">${caveats.map(escapeHtml).join(" ")}</p>`;

  return `
    <div class="krflow-card">
      ${head}
      <table class="krflow-table">
        <tbody>${rowsHtml}</tbody>
      </table>
      ${reportsHtml}
      ${caveatHtml}
    </div>`;
}

// 기업집단(공정위 대기업집단 지정) 카드 — 같은 그룹의 다른 상장 계열사로 바로
// 이동하는 칩을 붙인다. 늦은 도착은 refreshFeatureViews facts 재렌더가 처리.
function krGroupCard(item) {
  if (!isKrMarket()) return "";
  const cg = window.KR_CORP_GROUPS;
  if (!cg || !cg.byTicker || !Array.isArray(cg.groups)) return "";
  const gname = cg.byTicker[item?.ticker];
  if (!gname) return "";
  const g = cg.groups.find((x) => x.name === gname);
  if (!g) return "";
  const siblings = (g.listed || []).filter((s) => s.ticker !== item.ticker).slice(0, 10);
  const chips = siblings.map((s) => `<button type="button" data-group-ticker="${escapeHtml(s.ticker)}" style="font-size:var(--fs-cap);padding:2px 8px;border:1px solid var(--line);border-radius:999px;background:var(--panel-soft);color:var(--text);cursor:pointer">${escapeHtml(s.company)}</button>`).join(" ");
  return `
    <div class="krflow-card" data-group-card>
      <div style="display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline"><strong>기업집단 · ${escapeHtml(g.name)}</strong><span class="muted" style="font-size:var(--fs-cap)">${g.chief ? `동일인 ${escapeHtml(g.chief)} · ` : ""}상장 계열사 ${Number(g.listedCount || (g.listed || []).length)}개 · 공정위 ${escapeHtml((cg.asOf || "").slice(0, 7))} 지정</span></div>
      ${chips ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${chips}</div>` : ""}
    </div>`;
}

// 국민연금 보유 카드 — 연 1회 공시(전년도 말 기준)라 '현재 보유'가 아니라
// '최근 공시 시점 보유'다. 캐비앗을 카드에 명시한다. 데이터가 늦게 도착하면
// refreshFeatureViews 의 facts 재렌더가 다시 그린다.
let _npsByTicker = null;
function krNpsCard(item) {
  if (!isKrMarket()) return "";
  const nps = window.KR_NPS_HOLDINGS;
  if (!nps || !Array.isArray(nps.holdings)) return "";
  if (!_npsByTicker) {
    _npsByTicker = {};
    nps.holdings.forEach((h) => { if (h && h.ticker) _npsByTicker[h.ticker] = h; });
  }
  const h = _npsByTicker[item?.ticker];
  if (!h) return "";
  const fmtVal = (b) => {
    const n = Number(b);
    if (!Number.isFinite(n)) return "—";
    return n >= 10000 ? `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조원` : `${Math.round(n).toLocaleString("ko-KR")}억원`;
  };
  const rows = [];
  if (Number.isFinite(Number(h.stakePct))) rows.push(["지분율", `${Number(h.stakePct).toFixed(2)}%`]);
  if (Number.isFinite(Number(h.valueB))) rows.push(["평가액", fmtVal(h.valueB)]);
  if (Number.isFinite(Number(h.weightPct))) rows.push(["연기금 국내주식 내 비중", `${Number(h.weightPct).toFixed(2)}%`]);
  if (!rows.length) return "";
  return `
    <div class="krflow-card">
      <div style="display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline"><strong>국민연금 보유</strong><span class="muted" style="font-size:var(--fs-cap)">기준 ${escapeHtml(nps.asOf || "")} · 연 1회 공시</span></div>
      <table class="krflow-table"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>
      <p class="krflow-note">연말 기준 연 1회 공시라 현재 보유와 다를 수 있습니다. 참고용 컨텍스트입니다.</p>
    </div>`;
}

// ===== KR DART disclosures =====
let krDartQuery = "";

// 공시 제목 밑에 붙는 숫자 한 줄. 이 패널의 오랜 한계가 '제목만 있고 숫자가 없다'
// 였다 — "유상증자결정" 이 실제로 몇 % 희석인지 알려면 DART 문서를 열어야 했다.
// data/kr_event_details.js 가 rcept_no 키로 그 숫자를 갖고 있다(build_kr_event_details.py).
function krEventDetailLine(row) {
  const map = window.KR_EVENT_DETAILS?.details;
  if (!map) return "";
  const m = String(row.link || "").match(/rcpNo=(\d+)/);
  const d = m && map[m[1]];
  if (!d) return "";

  const won = (v) => {
    if (!Number.isFinite(v)) return null;
    if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
    if (Math.abs(v) >= 1e8) return `${(v / 1e8).toLocaleString(undefined, { maximumFractionDigits: 1 })}억`;
    return `${Math.round(v).toLocaleString()}원`;
  };
  const parts = [];
  // 희석률이 이 공시들의 핵심 숫자다 — 맨 앞에, 강조해서 둔다.
  if (Number.isFinite(d.dilutionPct)) {
    const heavy = d.dilutionPct >= 10;
    parts.push(`<b class="${heavy ? "neg" : ""}">희석 ${d.dilutionPct.toFixed(2)}%</b>`);
  }
  if (Number.isFinite(d.amount)) parts.push(escapeHtml(won(d.amount)));
  if (Number.isFinite(d.convPrice)) parts.push(`전환가 ${d.convPrice.toLocaleString()}원`);
  if (Number.isFinite(d.couponPct)) parts.push(`표면 ${d.couponPct}%`);
  if (Number.isFinite(d.shares)) parts.push(`${d.shares.toLocaleString()}주`);
  if (d.method) parts.push(escapeHtml(d.method));
  if (d.purpose) parts.push(escapeHtml(d.purpose));
  if (!parts.length) return "";
  return `<div class="ins-sub">${parts.join(" · ")}</div>`;
}

// 공시 유형별 과거 반응. 5년 55만건을 재보니 41개 유형 중 무작위를 이긴 건 0개였다
// (build_kr_disclosure_stats.py 의 결론 참고).
//
// 그래서 이 줄의 목적은 신호를 파는 게 아니라 그 반대다 — "이 공시 뒤에 주가가 어떻게
// 되나" 라는 질문에 "무작위와 구분되지 않는다" 고 답한다. 판정을 먼저 쓰고 숫자를
// 뒤에 두는 이유가 그것이다. 숫자를 앞세우면 '+0.27%' 만 읽고 신호로 오해한다.
//
// 평균이 아니라 중앙값을 쓴다. 평균은 소형주 급등 몇 건에 끌려간다 — 증자·사채는
// D0 평균 +0.57% 인데 중앙값은 -0.06% 로 부호가 반대다. 중앙값이 '보통 어땠나' 에 가깝다.
function krDisclosureStatLine(row) {
  const book = window.KR_DISCLOSURE_STATS?.stats;
  const s = book && book[row.typeLabel];
  if (!s || !s.d1 || !Number.isFinite(s.d1.median)) return "";

  const sign = (v) => fmtSignedPct(v, 2);
  const rnd = s.d1.random;
  const verdict = s.edge
    ? `<b>무작위와 다름</b>`
    : `무작위와 구분 안 됨`;
  const bits = [
    `과거 ${s.sample.toLocaleString()}건`,
    `다음날 중앙값 ${sign(s.d1.median)}`,
  ];
  if (rnd && Number.isFinite(rnd.median)) bits.push(`무작위 ${sign(rnd.median)}`);
  // 증자·사채만 해당. 당일 반응은 통계적으로 실재하지만 공시 당일이라 행동할 수 없고,
  // 공시 전 5일에 이미 올라 있어 역인과로 보인다. 그 사실을 숨기지 않고 그대로 쓴다.
  const same = s.sameDayOnly ? ` · 당일 반응은 있으나 예측 아님` : "";
  return `<div class="ins-sub disc-stat">${bits.join(" · ")} · ${verdict}${same}</div>`;
}

// 방법론을 한 번만, 접어서 설명한다. 행마다 "무작위와 구분 안 됨" 만 반복되면
// 왜 그런지가 화면 어디에도 없다 — 근거를 볼 수 있어야 결론을 믿거나 반박할 수 있다.
// 숫자는 데이터에서 읽는다. 여기 하드코딩하면 통계를 다시 돌렸을 때 설명만 옛말이 된다.
function renderKrDisclosureMethod() {
  const box = byId("krDartMethodBody");
  const payload = window.KR_DISCLOSURE_STATS;
  if (!box) return;
  const wrap = byId("krDartMethod");
  if (!payload) { if (wrap) wrap.hidden = true; return; }
  if (wrap) wrap.hidden = false;
  const total = payload.typeCount || Object.keys(payload.stats || {}).length;
  const edges = payload.edgeCount || 0;
  box.innerHTML = `
    <p><b>${total}개 유형 중 무작위를 이긴 건 ${edges}개입니다.</b>
       공시 유형만으로 다음날 주가를 예측할 수 없다는 뜻입니다.</p>
    <p>같은 종목의 <b>무작위 날짜</b>를 대조군으로 두고 비교합니다. 시장 전체가 오른 날의
       상승을 호재로 읽지 않도록, 지수(KODEX 200 · 코스닥150) 대비 <b>초과수익</b>으로 잽니다.</p>
    <p>이벤트를 낱개로 세면 우위가 있는 것처럼 보입니다. 하지만 공시는 제출기한에 몰립니다
       — 지속가능경영보고서는 712건 중 115건이 2026-06-30 하루에 나왔습니다. 그 115종목의
       다음날 수익률은 독립된 115개 관측이 아니라 <b>그날 하루</b>입니다. 날짜로 묶어 다시
       재면 t값 +5.25가 -0.09로 사라집니다.</p>
    <p class="muted">${escapeHtml(payload.source || "")} · ${escapeHtml(payload.updatedAtKst || "")}</p>`;
}

function renderKrDisclosures() {
  const meta = byId("krDartMeta");
  const table = byId("krDartTable");
  if (!table) return;
  const payload = window.KR_DISCLOSURES;
  if (!payload) {
    table.innerHTML = `<p class="muted">DART 공시 데이터를 불러오는 중…</p>`;
    return;
  }
  if (meta) {
    // 빌더가 실제 커버 범위(종목수·기간)를 payload 에 싣는다. 예전엔 건수만 보여줘서
    // 120종목만 훑고 있다는 사실이 화면 어디에도 드러나지 않았다.
    const parts = [payload.updatedAtKst, `${payload.count || 0}건`];
    if (payload.companyCount) parts.push(`${payload.companyCount}종목`);
    if (payload.firstFileDate && payload.lastFileDate) {
      parts.push(`${payload.firstFileDate} ~ ${payload.lastFileDate}`);
    }
    parts.push(payload.source);
    meta.textContent = parts.filter(Boolean).join(" · ");
  }
  renderKrDisclosureMethod();
  let rows = payload.disclosures || [];
  const q = krDartQuery.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) =>
      [row.ticker, row.company, row.title, row.typeLabel].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  if (!rows.length) {
    table.innerHTML = `<p class="muted">${payload.note || "표시할 공시가 없습니다."}</p>`;
    return;
  }
  table.innerHTML = `
    <table class="insider-table table-wide">
      <thead><tr><th>일자</th><th>종목</th><th>회사</th><th>유형</th><th>제목</th></tr></thead>
      <tbody>
        ${rows.slice(0, 200).map((row) => `
          <tr>
            <td>${escapeHtml(row.fileDate || "")}</td>
            <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
            <td>${escapeHtml(row.company || "")}</td>
            <td>${escapeHtml(row.typeLabel || "")}</td>
            <td>
              ${row.link ? `<a href="${escapeHtml(row.link)}" target="_blank" rel="noopener">${escapeHtml(row.title || "")}</a>` : escapeHtml(row.title || "")}
              ${krEventDetailLine(row)}
              ${krDisclosureStatLine(row)}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  table.querySelectorAll(".ins-ticker").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function setupKrDartEvents() {
  const search = byId("krDartSearch");
  if (search) search.addEventListener("input", () => { krDartQuery = search.value; renderKrDisclosures(); });
}

// ===== KR 지분 변동 (대량보유 5%룰 / 임원·주요주주) =====
let krOwnQuery = "";
let krOwnKind = "major";

function krOwnNum(v, digits = 0) {
  return Number.isFinite(v) ? Number(v).toLocaleString(undefined, { maximumFractionDigits: digits }) : "-";
}

// 증감은 방향이 핵심이라 색과 부호를 같이 준다(색만으로 구분하지 않게 부호를 반드시 붙인다).
function krOwnDelta(v, suffix, digits = 0) {
  if (!Number.isFinite(v) || v === 0) return `<span class="muted">-</span>`;
  const sign = v > 0 ? "+" : "";
  return `<span class="${v > 0 ? "pos" : "neg"}">${sign}${krOwnNum(v, digits)}${suffix}</span>`;
}

// 지배구조·유통물량 — 최근 '이벤트'(대량보유/임원 공시)와 달리 종목별 '상태'다.
// 데이터가 티커 키 맵이라 회사명·시총은 스냅샷에서 붙인다.
function renderKrOwnProfile() {
  const meta = byId("krOwnMeta");
  const table = byId("krOwnTable");
  const payload = window.KR_OWNERSHIP_PROFILE;
  if (!payload) {
    table.innerHTML = `<p class="muted">지배구조 데이터를 불러오는 중…</p>`;
    return;
  }
  if (meta) {
    meta.textContent = [
      payload.updatedAtKst,
      `${payload.year || ""} 사업보고서 기준`,
      `${payload.companyCount || 0}종목`,
      payload.source,
    ].filter(Boolean).join(" · ");
  }

  const profiles = payload.profiles || {};
  const q = krOwnQuery.trim().toLowerCase();
  let rows = data.stocks
    .filter((s) => !isStockEtf(s) && profiles[s.ticker])
    .map((s) => ({ item: s, p: profiles[s.ticker] }));
  if (q) {
    rows = rows.filter(({ item, p }) =>
      [item.ticker, item.company, p.topHolder].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  // 유통물량이 적을수록 수급이 타이트하다 — 그게 이 표를 보는 이유라 오름차순으로 둔다.
  rows.sort((a, b) => (a.p.freeFloatPct ?? 999) - (b.p.freeFloatPct ?? 999));
  if (!rows.length) {
    table.innerHTML = `<p class="muted">${escapeHtml(payload.note || "표시할 데이터가 없습니다.")}</p>`;
    return;
  }

  const pct = (v) => (Number.isFinite(v) ? `${v.toFixed(2)}%` : "—");
  const num = (v) => (Number.isFinite(v) ? Number(v).toLocaleString() : "—");
  const body = rows.slice(0, 200).map(({ item, p }) => `
    <tr>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(item.ticker)}</button></td>
      <td>${escapeHtml(item.company || "")}</td>
      <td>${escapeHtml(p.topHolder || "—")}</td>
      <td>${pct(p.ownerStakePct)}</td>
      <td><b>${pct(p.freeFloatPct)}</b></td>
      <td>${num(p.treasuryShares)}</td>
      <td>${num(p.minorityHolders)}</td>
    </tr>`).join("");

  table.innerHTML = `
    <table class="insider-table table-wide">
      <thead><tr>
        <th>종목</th><th>회사</th><th>최대주주</th><th>지분율</th>
        <th>유통물량</th><th>자기주식</th><th>소액주주 수</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  table.querySelectorAll(".ins-ticker").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function renderKrOwnership() {
  const meta = byId("krOwnMeta");
  const table = byId("krOwnTable");
  if (!table) return;
  if (krOwnKind === "profile") {
    renderKrOwnProfile();
    return;
  }
  const payload = window.KR_OWNERSHIP;
  if (!payload) {
    table.innerHTML = `<p class="muted">지분공시 데이터를 불러오는 중…</p>`;
    return;
  }
  if (meta) {
    meta.textContent = [
      payload.updatedAtKst,
      `최근 ${payload.windowDays || 7}일`,
      `대량보유 ${payload.majorCount || 0}건`,
      `임원 ${payload.insiderCount || 0}건`,
      payload.source,
    ].filter(Boolean).join(" · ");
  }

  const isMajor = krOwnKind === "major";
  let rows = (isMajor ? payload.majorHolders : payload.insiders) || [];
  const q = krOwnQuery.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) =>
      [row.ticker, row.company, row.filer, row.position, row.reportType]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  if (!rows.length) {
    table.innerHTML = `<p class="muted">${escapeHtml(payload.note || "표시할 지분공시가 없습니다.")}</p>`;
    return;
  }

  const head = isMajor
    ? `<tr><th>일자</th><th>종목</th><th>회사</th><th>보고자</th><th>보유비율</th><th>증감</th><th>보유주식</th><th>구분</th></tr>`
    : `<tr><th>일자</th><th>종목</th><th>회사</th><th>보고자</th><th>직위</th><th>소유주식</th><th>증감</th><th>등기</th></tr>`;

  const body = rows.slice(0, 200).map((row) => {
    const common = `
      <td>${escapeHtml(row.fileDate || "")}</td>
      <td><button type="button" class="ins-ticker" data-ticker="${escapeHtml(row.ticker)}">${escapeHtml(row.ticker)}</button></td>
      <td>${escapeHtml(row.company || "")}</td>
      <td>${row.link ? `<a href="${escapeHtml(row.link)}" target="_blank" rel="noopener">${escapeHtml(row.filer || "-")}</a>` : escapeHtml(row.filer || "-")}</td>`;
    return isMajor
      ? `<tr>${common}
          <td><b>${krOwnNum(row.ratio, 2)}%</b></td>
          <td>${krOwnDelta(row.ratioChange, "%p", 2)}</td>
          <td>${krOwnNum(row.shares)}</td>
          <td>${escapeHtml(row.reportType || "")}</td>
        </tr>`
      : `<tr>${common}
          <td>${escapeHtml(row.position || "-")}</td>
          <td>${krOwnNum(row.shares)}</td>
          <td>${krOwnDelta(row.sharesChange, "주")}</td>
          <td>${escapeHtml(row.registered || "-")}</td>
        </tr>`;
  }).join("");

  table.innerHTML = `<table class="insider-table table-wide"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  table.querySelectorAll(".ins-ticker").forEach((btn) => {
    btn.addEventListener("click", () => selectTicker(btn.dataset.ticker, { openSearch: true }));
  });
}

function setupKrOwnershipEvents() {
  const search = byId("krOwnSearch");
  if (search) search.addEventListener("input", () => { krOwnQuery = search.value; renderKrOwnership(); });
  byId("krOwnKinds")?.querySelectorAll("[data-krown]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.krown;
      krOwnKind = ["insider", "profile"].includes(kind) ? kind : "major";
      byId("krOwnKinds").querySelectorAll("[data-krown]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      // 지배구조 탭은 다른 데이터셋을 쓴다 — 처음 열 때 받아온다.
      if (krOwnKind === "profile") {
        renderWithFeature("krOwnProfile", renderKrOwnership, "krOwnTable");
      } else {
        renderWithFeature("krOwnership", renderKrOwnership, "krOwnTable");
      }
    });
  });
}
