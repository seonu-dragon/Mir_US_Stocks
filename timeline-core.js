// 종목 통합 타임라인 + 차트 '키 모먼트' — 순수 계산 모듈(DOM 없음).
// 브라우저에서는 window.MirTimeline, node 테스트(scripts/tests/test_timeline_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// 흐름: collectTimeline(이미 받은 전역들) → 항목 목록(최신순)
//       keyMoments(일봉) → 큰 등락일 → attachReasons(같은 날 ±1거래일 항목을 '사유 후보'로)
// - 새 외부 호출·LLM 없음. 레포에 이미 커밋된 데이터(공시·실적·배당·지분·특징주·목표가·
//   이벤트 스터디 종목 샤드)만 합친다.
// - 사유는 '같은 시기에 기록된 사건'일 뿐 원인으로 확인된 것이 아니다. 없으면 없다고 쓴다.
(function (root) {
  "use strict";

  const CATS = ["earn", "filing", "own", "corp", "news", "move", "target"];
  const CAT_LABEL = { earn: "실적", filing: "공시", own: "지분·내부자", corp: "배당·분할", news: "뉴스", move: "가격", target: "목표가" };
  const CAT_ORDER = { earn: 0, filing: 1, own: 2, corp: 3, target: 4, news: 5, move: 6 };

  // 국내 DART 공시 중 타임라인에 올리지 않는 서류(발행 절차 서류·명부 공고 등 — 같은 사건의
  // 부속 서류라 목록만 길게 만든다). 원문은 공시 탭 DART 피드에 그대로 있다.
  const KR_NOISE_TYPES = new Set([
    "투자설명서", "일괄신고 추가서류", "증권발행실적", "증권발행결과", "주주명부·기준일",
    "지속가능경영보고서",
  ]);
  const KR_OWN_TYPES = new Set(["임원·주요주주 소유보고", "대량보유상황보고", "최대주주 변동", "임원·주요주주 거래계획"]);
  const KR_CORP_TYPES = new Set(["배당", "주식병합", "주식소각"]);

  // 이벤트 스터디 유형 → 타임라인 분류.
  const HISTORY_CAT = {
    us_earn: "earn", kr_earn: "earn",
    us_13d: "own", us_insider_cluster: "own", kr_major_change: "own",
    kr_dividend: "corp", kr_bonus: "corp", kr_cancel: "corp",
  };

  function isDate(d) {
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d);
  }
  // 8-K 3줄 요약·Form 144 줄 만들기(sec-filings-core.js). 브라우저는 전역, node 테스트는 require.
  function secCore() {
    if (root && root.MirSecFilings) return root.MirSecFilings;
    try { return typeof require === "function" ? require("./sec-filings-core.js") : null; } catch (e) { return null; }
  }
  function day(d) {
    return String(d).slice(0, 10);
  }
  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function up(t) {
    return String(t || "").toUpperCase();
  }
  function signedPct(p, dec) {
    const n = num(p);
    if (n === null) return "";
    const d = dec == null ? 1 : dec;
    const s = Math.abs(n).toFixed(d);
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${s}%`;
  }
  // 원화 큰 금액 → "79.1조" / "6,685억". 1억 미만은 원 단위.
  function krwShort(v) {
    const n = num(v);
    if (n === null) return "";
    const a = Math.abs(n);
    if (a >= 1e12) return `${(n / 1e12).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
    if (a >= 1e8) return `${Math.round(n / 1e8).toLocaleString("ko-KR")}억`;
    return `${Math.round(n).toLocaleString("ko-KR")}원`;
  }
  function usdShort(v) {
    const n = num(v);
    if (n === null) return "";
    const a = Math.abs(n);
    if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `$${Math.round(n / 1e3).toLocaleString("en-US")}K`;
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }
  function shares(v) {
    const n = num(v);
    if (n === null) return "";
    return `${Math.round(n).toLocaleString("ko-KR")}주`;
  }
  // DART 링크의 접수번호(rcpNo). 같은 공시를 여러 데이터셋이 들고 있을 때 하나로 합치는 키.
  function rcpNo(link) {
    const m = /rcpNo=(\d{8,})/.exec(String(link || ""));
    return m ? m[1] : "";
  }
  const DAY_MS = 86400000;
  const DAY_BASE_MS = Date.UTC(2000, 0, 1);
  function dayIso(n) {
    if (n == null || !Number.isFinite(Number(n))) return "";
    return new Date(DAY_BASE_MS + Number(n) * DAY_MS).toISOString().slice(0, 10);
  }
  function dayDiff(a, b) {
    const pa = Date.parse(`${day(a)}T00:00:00Z`);
    const pb = Date.parse(`${day(b)}T00:00:00Z`);
    if (!Number.isFinite(pa) || !Number.isFinite(pb)) return Infinity;
    return Math.round((pa - pb) / DAY_MS);
  }

  // 일봉에서 날짜 d 의 그날 종가 등락률(%)과 다음 거래일 등락률. rows = [{d, c}] 오름차순.
  // 휴장일이면 그 다음 첫 거래일을 '발표 당일'로 본다.
  function reactionFromRows(rows, date) {
    const n = rows ? rows.length : 0;
    if (n < 2 || !isDate(date)) return null;
    const d = day(date);
    let i = -1;
    for (let k = 0; k < n; k += 1) {
      if (rows[k] && isDate(rows[k].d) && day(rows[k].d) >= d) { i = k; break; }
    }
    if (i < 1) return null;
    const pct = (a, b) => (num(a) && num(b) ? (a / b - 1) * 100 : null);
    const d0 = pct(rows[i].c, rows[i - 1].c);
    const d1 = i + 1 < n ? pct(rows[i + 1].c, rows[i].c) : null;
    return { date: day(rows[i].d), dayPct: d0, nextPct: d1 };
  }

  // ── 모으기 ─────────────────────────────────────────────────────────────────
  // src = {
  //   kr, ticker, rows(일봉 [{d,c}] — 실적 반응 계산용),
  //   earnings, dividends, splits,            // 상세 파일(earningsHistory · dividends · splits)
  //   earnReactions, earnReleases, earnMoves, // KR_EARNINGS_REACTIONS.rows · EARNINGS_RELEASES.releases · EARNINGS_MOVE_COMPARE.stocks[t]
  //   usFilings, usDilution, insiders, activist,       // MATERIAL_EVENTS.events · US_DILUTION.rows · INSIDER_TRADES.trades · ACTIVIST_STAKES.filings
  //   form144,                                         // FORM144_FILINGS.filings(매도 예정 신고 + Form 4 짝짓기)
  //   krFilings, krEventDetails, krDividends, krContracts, krMajor, krInsiders, // DART 계열
  //   movers,        // MOVERS_REASONS (tradeDate + up/down)
  //   krReports,     // KR_CONSENSUS.stocks[t].reports
  //   news,          // 종목 상세의 최근 기사 [{title, link, publisher, publishedAt}] (US 야후 · KR 네이버)
  //   momentNews,    // 큰 등락일 미리 모은 뉴스 { 날짜: [[제목, 출처, 링크, 기사날짜], …] } (build_moment_news.py)
  //   momentNewsLink,// 저장된 링크 → 실제 URL(구글 뉴스 "g:<ID>" 되돌리기). 없으면 그대로.
  //   history,       // { rows: 이벤트 스터디 종목 샤드 [[k, d0, car1, ...]], labels: {k: 라벨}, scale }
  //   moments,       // keyMoments() 결과 — '가격' 항목으로 넣는다
  // }
  // → [{ id, date, cat, title, detail, link, goto, pct, src, lines?, linesSrc?, linesLabel? }] 최신순
  //   lines: 8-K 3줄 요약(규칙/AI) — 있으면 화면이 detail 아래에 줄로 보여 주고 출처 라벨을 단다.
  function collectTimeline(src) {
    const s = src || {};
    const kr = Boolean(s.kr);
    const ticker = up(s.ticker);
    const mine = (t) => !ticker || up(t) === ticker;
    const out = [];
    const push = (it) => { if (it && isDate(it.date)) out.push({ link: "", detail: "", goto: null, pct: null, ...it, date: day(it.date) }); };
    const rows = Array.isArray(s.rows) ? s.rows : [];

    // 실적 ------------------------------------------------------------------
    const moveByDate = new Map();
    const em = s.earnMoves && s.earnMoves.past && Array.isArray(s.earnMoves.past.events) ? s.earnMoves.past.events : [];
    for (const e of em) {
      if (e && isDate(e.filedEt)) moveByDate.set(day(e.filedEt), e);
    }
    const krReact = new Map();
    for (const r of Array.isArray(s.earnReactions) ? s.earnReactions : []) {
      if (r && mine(r.ticker) && isDate(r.date) && !krReact.has(day(r.date))) krReact.set(day(r.date), r);
    }
    const releases = new Map();
    for (const r of Array.isArray(s.earnReleases) ? s.earnReleases : []) {
      if (r && mine(r.ticker) && isDate(r.fileDate)) releases.set(day(r.fileDate), r);
    }
    const earnDates = new Set();
    for (const e of Array.isArray(s.earnings) ? s.earnings : []) {
      if (!e || !isDate(e.date)) continue;
      const d = day(e.date);
      earnDates.add(d);
      const parts = [];
      if (kr) {
        const rev = krwShort(e.revenue);
        const op = krwShort(e.operatingProfit);
        if (rev) parts.push(`매출 ${rev}`);
        if (op) parts.push(`영업이익 ${op}`);
      } else {
        const act = num(e.epsActual);
        const est = num(e.epsEstimate);
        if (act !== null) parts.push(`EPS ${act.toFixed(2)}${est !== null ? ` (예상 ${est.toFixed(2)}${num(e.surprisePct) !== null ? `, 차이 ${signedPct(e.surprisePct)}` : ""})` : ""}`);
      }
      // 과거 반응: 제출 시각을 아는 US 목록(EARNINGS_MOVE_COMPARE) > KR 잠정실적 반응 > 일봉 계산.
      const mv = moveByDate.get(d);
      const kre = krReact.get(d);
      const rx = reactionFromRows(rows, d);
      let pct = null;
      if (mv && num(mv.movePct) !== null) {
        pct = num(mv.movePct);
        parts.push(`반응 ${signedPct(pct)}(${mv.session === "amc" ? "장 마감 후 발표 → 다음 날" : mv.session === "bmo" ? "장 전 발표 → 당일" : "첫 정규장"} ${String(mv.reactionDate || "").slice(5).replace("-", "/")})`);
      } else if (kre && num(kre.dayPct) !== null) {
        pct = num(kre.dayPct);
        parts.push(`발표일 ${signedPct(kre.dayPct)}${num(kre.nextPct) !== null ? ` · 다음 날 ${signedPct(kre.nextPct)}` : ""}`);
      } else if (rx && rx.dayPct !== null) {
        pct = rx.dayPct;
        parts.push(`발표일 종가 ${signedPct(rx.dayPct)}${rx.nextPct !== null ? ` · 다음 날 ${signedPct(rx.nextPct)}` : ""}`);
      }
      const rel = releases.get(d);
      if (rel && rel.oneLine) parts.push(String(rel.oneLine));
      push({
        date: d, cat: "earn", src: "earnings",
        title: kr ? (e.label ? `실적 공시 · ${e.label}` : "실적 공시") : "실적 발표",
        detail: parts.join(" · "), pct,
        link: (kre && kre.link) || (rel && (rel.exhibitUrl || rel.filingUrl)) || "",
        goto: { view: "fin", card: "stockEarningsCard" },
      });
    }
    // 상세 earningsHistory 에 없는 KR 잠정실적(반응 목록에만 있는 최근 발표)
    for (const [d, r] of krReact) {
      if (earnDates.has(d)) continue;
      earnDates.add(d);
      push({
        date: d, cat: "earn", src: "krEarnReact", title: "잠정실적 공시",
        detail: `발표일 ${signedPct(r.dayPct)}${num(r.nextPct) !== null ? ` · 다음 날 ${signedPct(r.nextPct)}` : ""}`,
        pct: num(r.dayPct), link: r.link || "", goto: { view: "fin", card: "stockEarningsCard" },
      });
    }

    // 배당·분할 --------------------------------------------------------------
    for (const d of Array.isArray(s.dividends) ? s.dividends : []) {
      const dt = d && d[0];
      const amt = num(d && d[1]);
      if (!isDate(dt) || amt === null || amt <= 0) continue;
      push({
        date: dt, cat: "corp", src: "dividends", title: "배당락",
        detail: kr ? `주당 ${amt.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원` : `주당 $${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
      });
    }
    for (const sp of Array.isArray(s.splits) ? s.splits : []) {
      const dt = sp && sp[0];
      const a = num(sp && sp[1]);
      const b = num(sp && sp[2]);
      if (!isDate(dt) || !(a > 0) || !(b > 0) || a === b) continue;
      push({ date: dt, cat: "corp", src: "splits", title: a > b ? "액면분할" : "주식병합", detail: `${a}:${b}` });
    }

    // US 공시 ----------------------------------------------------------------
    for (const f of Array.isArray(s.usFilings) ? s.usFilings : []) {
      if (!f || !isDate(f.fileDate) || !mine(f.ticker)) continue;
      const items = (Array.isArray(f.items) ? f.items : []).filter((it) => it && it.code !== "9.01");
      if (f.kind === "buyback") {
        push({ date: f.fileDate, cat: "filing", src: "8k", title: "자사주 매입 발표(8-K)", detail: num(f.amountUsd) ? `규모 ${usdShort(f.amountUsd)}` : "", link: f.link || "" });
        continue;
      }
      if (!items.length) continue;
      const isEarn = items.some((it) => it.code === "2.02");
      // 실적 발표 8-K 는 같은 날 실적 항목이 있으면 그 항목에 원문 링크만 보탠다.
      if (isEarn && earnDates.has(day(f.fileDate))) {
        const e = out.find((x) => x.cat === "earn" && x.date === day(f.fileDate));
        if (e && !e.link) e.link = f.link || "";
        if (items.length === 1) continue;
      }
      const sc = secCore();
      const sum = sc ? sc.eightkLines(f) : { lines: [] };
      push({
        date: f.fileDate, cat: isEarn && items.length === 1 ? "earn" : "filing", src: "8k",
        title: `8-K${f.hot ? " 주요 공시" : " 공시"}`, detail: items.map((it) => it.label).filter(Boolean).join(" · "), link: f.link || "",
        ...(sum.lines.length ? { lines: sum.lines, linesSrc: sum.src, linesLabel: sum.label } : {}),
      });
    }
    for (const r of Array.isArray(s.usDilution) ? s.usDilution : []) {
      if (!r || !isDate(r.fileDate) || !mine(r.ticker)) continue;
      push({
        date: r.fileDate, cat: "filing", src: "dilution", title: `증자 서류 ${r.formType || ""}`.trim(),
        detail: [r.formLabel, num(r.amountUsd) ? `규모 ${usdShort(r.amountUsd)}` : ""].filter(Boolean).join(" · "), link: r.url || "",
      });
    }
    // Form 4 내부자: 매수(P)·매도(S)만, 같은 날·같은 방향을 한 줄로 묶는다(스톡옵션 행사·증여는 뺀다).
    const insByKey = new Map();
    for (const t of Array.isArray(s.insiders) ? s.insiders : []) {
      if (!t || !isDate(t.fileDate) || !mine(t.ticker)) continue;
      if (t.code !== "P" && t.code !== "S") continue;
      const key = `${day(t.fileDate)}|${t.code}`;
      if (!insByKey.has(key)) insByKey.set(key, { date: day(t.fileDate), code: t.code, n: 0, value: 0, owners: [], link: t.link || "" });
      const g = insByKey.get(key);
      g.n += 1;
      g.value += num(t.value) || 0;
      if (t.owner && !g.owners.includes(t.owner)) g.owners.push(t.owner);
    }
    for (const g of insByKey.values()) {
      const who = g.owners.slice(0, 2).join(", ") + (g.owners.length > 2 ? ` 외 ${g.owners.length - 2}명` : "");
      push({
        date: g.date, cat: "own", src: "insider", title: `내부자 ${g.code === "P" ? "매수" : "매도"}(Form 4)${g.n > 1 ? ` ${g.n}건` : ""}`,
        detail: [who, g.value ? `합계 ${usdShort(g.value)}` : ""].filter(Boolean).join(" · "), link: g.link,
        goto: { view: "flow", card: "stockSmartMoney" },
      });
    }
    // Form 144 매도 예정 신고 — 신고 1건 = 항목 1개. 같은 사람의 Form 4 매도를 찾았는지 함께 적는다.
    for (const r of Array.isArray(s.form144) ? s.form144 : []) {
      if (!r || !isDate(r.fileDate) || !mine(r.ticker)) continue;
      const sc = secCore();
      if (!sc) break;
      const st = sc.form144Status(r);
      push({
        date: r.fileDate, cat: "own", src: "form144", title: `Form 144 매도 예정 신고 · ${st.label}`,
        detail: [sc.form144Line(r), st.key === "sold" ? st.detail : ""].filter(Boolean).join(" · "), link: r.link || "",
        goto: { view: "flow", card: "stockSmartMoney" },
      });
    }
    for (const f of Array.isArray(s.activist) ? s.activist : []) {
      if (!f || !isDate(f.fileDate) || !mine(f.ticker)) continue;
      push({
        date: f.fileDate, cat: "own", src: "activist", title: `${f.form || "13D/G"} 대량보유`,
        detail: [f.filer, f.kindLabel].filter(Boolean).join(" · "), link: f.link || "",
      });
    }

    // KR 공시 ----------------------------------------------------------------
    const krByRcp = new Map(); // rcpNo → 항목(뒤에 오는 상세 데이터셋이 내용을 보탠다)
    const krPush = (it) => {
      const key = rcpNo(it.link);
      if (key && krByRcp.has(key)) {
        const prev = krByRcp.get(key);
        // 더 구체적인 상세(배당·수주·지분 파싱본)가 오면 제목·내용을 바꾼다.
        if (it.rich) Object.assign(prev, { title: it.title, detail: it.detail, cat: it.cat, goto: it.goto || prev.goto });
        return;
      }
      push(it);
      if (key) krByRcp.set(key, out[out.length - 1]);
    };
    const details = s.krEventDetails && typeof s.krEventDetails === "object" ? s.krEventDetails : {};
    for (const f of Array.isArray(s.krFilings) ? s.krFilings : []) {
      if (!f || !isDate(f.fileDate) || !mine(f.ticker)) continue;
      const type = f.typeLabel || "공시";
      if (KR_NOISE_TYPES.has(type)) continue;
      const cat = KR_OWN_TYPES.has(type) ? "own" : KR_CORP_TYPES.has(type) ? "corp" : "filing";
      const det = details[rcpNo(f.link)];
      const extra = [];
      if (det) {
        if (num(det.dilutionPct) !== null) extra.push(`희석 ${Number(det.dilutionPct).toFixed(1)}%`);
        if (num(det.convPrice) !== null) extra.push(`전환가 ${Math.round(det.convPrice).toLocaleString("ko-KR")}원`);
        if (num(det.amount) !== null) extra.push(`금액 ${krwShort(det.amount)}`);
        if (det.method) extra.push(det.method);
      }
      krPush({
        date: f.fileDate, cat, src: "dart", title: type === "공시" ? "DART 공시" : type,
        detail: [f.title, extra.join(" · ")].filter(Boolean).join(" — "), link: f.link || "",
        goto: cat === "own" ? { view: "flow", card: "stockFlowPanel" } : null,
      });
    }
    for (const r of Array.isArray(s.krDividends) ? s.krDividends : []) {
      if (!r || !isDate(r.date) || !mine(r.ticker)) continue;
      const parts = [r.divKind, num(r.dps) ? `주당 ${Number(r.dps).toLocaleString("ko-KR")}원` : "", num(r.yieldPct) ? `시가배당률 ${r.yieldPct}%` : "", isDate(r.recordDate) ? `기준일 ${r.recordDate}` : ""];
      krPush({ date: r.date, cat: "corp", src: "krDividends", rich: true, title: "배당 결정", detail: parts.filter(Boolean).join(" · "), link: r.link || "" });
    }
    for (const r of Array.isArray(s.krContracts) ? s.krContracts : []) {
      if (!r || !isDate(r.date) || !mine(r.ticker)) continue;
      const parts = [num(r.amount) ? `계약 ${krwShort(r.amount)}` : "", num(r.salesRatio) ? `매출 대비 ${Number(r.salesRatio).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%` : "", r.counterparty || ""];
      krPush({ date: r.date, cat: "filing", src: "krContracts", rich: true, title: "공급계약 체결", detail: parts.filter(Boolean).join(" · "), link: r.link || "" });
    }
    for (const r of Array.isArray(s.krMajor) ? s.krMajor : []) {
      if (!r || !isDate(r.fileDate) || !mine(r.ticker)) continue;
      const ch = num(r.ratioChange);
      const parts = [r.filer, num(r.ratio) !== null ? `지분 ${Number(r.ratio).toFixed(2)}%${ch ? ` (${ch > 0 ? "+" : "−"}${Math.abs(ch).toFixed(2)}%p)` : ""}` : "", r.reportType];
      krPush({ date: r.fileDate, cat: "own", src: "krMajor", rich: true, title: "5% 대량보유 보고", detail: parts.filter(Boolean).join(" · "), link: r.link || "", goto: { view: "flow", card: "stockFlowPanel" } });
    }
    for (const r of Array.isArray(s.krInsiders) ? s.krInsiders : []) {
      if (!r || !isDate(r.fileDate) || !mine(r.ticker)) continue;
      const ch = num(r.sharesChange);
      const parts = [r.filer, r.position && r.position !== "-" ? r.position : "", ch ? `${ch > 0 ? "+" : "−"}${shares(Math.abs(ch))}` : "", num(r.shares) !== null ? `보유 ${shares(r.shares)}` : ""];
      krPush({ date: r.fileDate, cat: "own", src: "krInsiders", rich: true, title: "임원·주요주주 소유 변동", detail: parts.filter(Boolean).join(" · "), link: r.link || "", goto: { view: "flow", card: "stockFlowPanel" } });
    }

    // 특징주 사유 --------------------------------------------------------------
    const mv = s.movers;
    if (mv && isDate(mv.tradeDate)) {
      for (const side of ["up", "down"]) {
        for (const r of Array.isArray(mv[side]) ? mv[side] : []) {
          if (!r || !mine(r.ticker)) continue;
          const st = r.reasonStatus || "failed";
          const ok = (st === "ok" || st === "sector") && r.reason;
          const ev = Array.isArray(r.evidence) ? r.evidence.find((x) => x && x.link) : null;
          push({
            date: mv.tradeDate, cat: "move", src: "movers", title: `특징주 ${signedPct(r.changePct, 2)}`,
            detail: ok ? `${r.reason} (자동 요약 — 틀릴 수 있음)` : (st === "none" ? "뚜렷한 재료 확인 안 됨" : "뚜렷한 사유 확인 안 됨"),
            pct: num(r.changePct), link: ev ? ev.link : "",
          });
        }
      }
    }

    // 목표가(국내 증권사 리포트) — 같은 증권사의 직전 리포트가 목록에 있으면 변화도.
    const reps = (Array.isArray(s.krReports) ? s.krReports : []).filter((r) => r && isDate(r.date)).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const lastBy = new Map();
    for (const r of reps) {
      const tgt = num(r.target);
      const prev = lastBy.get(r.broker);
      let chg = "";
      if (prev && tgt && num(prev.target) && prev.target !== tgt) chg = ` (직전 ${Math.round(prev.target).toLocaleString("ko-KR")}원에서 ${tgt > prev.target ? "상향" : "하향"})`;
      push({
        date: r.date, cat: "target", src: "krReports", title: `${r.broker || "증권사"} ${tgt ? "목표가" : "리포트"}`,
        detail: tgt ? `${Math.round(tgt).toLocaleString("ko-KR")}원${chg}${r.opinion ? ` · ${r.opinion}` : ""}` : `목표가 제시 없음${r.opinion ? ` · ${r.opinion}` : ""}`,
      });
      if (r.broker) lastBy.set(r.broker, r);
    }

    // 뉴스(종목 상세에 실린 최근 기사, 종목당 최대 8건) — 제목·출처만. 같은 제목은 한 번.
    const newsSeen = new Set();
    for (const n of Array.isArray(s.news) ? s.news : []) {
      const title = n && String(n.title || "").trim();
      const link = n && /^https?:\/\//i.test(String(n.link || "")) ? String(n.link) : "";
      if (!title || !n || !isDate(n.publishedAt)) continue;
      const key = title.toLowerCase().replace(/\s+/g, " ");
      if (newsSeen.has(key)) continue;
      newsSeen.add(key);
      push({ date: n.publishedAt, cat: "news", src: "news", title: title.slice(0, 160), detail: String(n.publisher || "").slice(0, 60), link });
    }
    const mnLink = typeof s.momentNewsLink === "function" ? s.momentNewsLink : (x) => x;
    const mn = s.momentNews && typeof s.momentNews === "object" ? s.momentNews : {};
    for (const d of Object.keys(mn)) {
      for (const r of Array.isArray(mn[d]) ? mn[d] : []) {
        if (!Array.isArray(r)) continue;
        const title = String(r[0] || "").trim();
        const when = isDate(r[3]) ? r[3] : d;
        if (!title || !isDate(when)) continue;
        const key = title.toLowerCase().replace(/\s+/g, " ");
        if (newsSeen.has(key)) continue;
        newsSeen.add(key);
        const link = String(mnLink(r[2]) || "");
        push({ date: when, cat: "news", src: "momentNews", title: title.slice(0, 160), detail: String(r[1] || "").slice(0, 60), link: /^https?:\/\//i.test(link) ? link : "" });
      }
    }

    // 과거 이벤트 기록(이벤트 스터디 종목 샤드, 약 5년) — 지금 창의 공시와 겹치면 뺀다.
    const h = s.history;
    if (h && Array.isArray(h.rows)) {
      const sc = num(h.scale) || 1000;
      const labels = h.labels || {};
      const live = out.slice();
      for (const r of h.rows) {
        if (!Array.isArray(r)) continue;
        const k = String(r[0] || "");
        const d = dayIso(r[1]);
        if (!isDate(d)) continue;
        const cat = HISTORY_CAT[k] || "filing";
        if (live.some((x) => x.cat === cat && Math.abs(dayDiff(x.date, d)) <= 3)) continue;
        const car1 = num(r[2]);
        push({
          date: d, cat, src: "history", title: labels[k] || k,
          detail: car1 !== null ? `시장 대비 0~+1일 ${signedPct(car1 / sc * 100)} (반응일 기준)` : "반응일 기준",
          pct: car1 !== null ? car1 / sc * 100 : null, goto: { study: k },
        });
      }
    }

    // 큰 등락(키 모먼트) -------------------------------------------------------
    for (const m of Array.isArray(s.moments) ? s.moments : []) {
      if (!m || !isDate(m.date)) continue;
      push({
        date: m.date, cat: "move", src: "moment", title: `큰 등락 ${signedPct(m.pct, 1)}`,
        detail: `평소 하루 변동(직전 ${m.lookback || 60}거래일 표준편차 ${Number(m.sigma).toFixed(1)}%)의 ${Number(m.ratio).toFixed(1)}배`,
        pct: m.pct, goto: { chart: m.date },
      });
    }

    // 같은 날·같은 내용 중복 제거, 최신순(같은 날은 분류 순)
    const seen = new Set();
    const uniq = [];
    for (const e of out) {
      const key = `${e.date}|${e.cat}|${e.title}|${e.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(e);
    }
    uniq.sort((x, y) => (x.date > y.date ? -1 : x.date < y.date ? 1 : CAT_ORDER[x.cat] - CAT_ORDER[y.cat]));
    uniq.forEach((e, i) => { e.id = i; });
    return uniq;
  }

  // ── 키 모먼트 ──────────────────────────────────────────────────────────────
  // 큰 등락일: 그날 종가 등락률의 절댓값이 직전 lookback 거래일 등락률 표준편차의 k 배 이상이고
  // minAbsPct(%) 이상. 표본이 minHist 미만인 앞부분은 판정하지 않는다.
  // rows = [{d, c}] 오름차순 일봉 → [{ date, idx, pct, sigma, ratio, lookback }] (날짜 오름차순)
  const MOMENT_DEFAULTS = { lookback: 60, minHist: 20, k: 2.5, minAbsPct: 3 };
  function keyMoments(rows, opts) {
    const o = { ...MOMENT_DEFAULTS, ...(opts || {}) };
    const n = Array.isArray(rows) ? rows.length : 0;
    const out = [];
    if (n < o.minHist + 2) return out;
    const ret = new Array(n).fill(null);
    for (let i = 1; i < n; i += 1) {
      const a = num(rows[i] && rows[i].c);
      const b = num(rows[i - 1] && rows[i - 1].c);
      if (a && b && a > 0 && b > 0) ret[i] = (a / b - 1) * 100;
    }
    for (let i = 1; i < n; i += 1) {
      const r = ret[i];
      if (r === null || !isDate(rows[i].d)) continue;
      const hist = [];
      for (let j = Math.max(1, i - o.lookback); j < i; j += 1) if (ret[j] !== null) hist.push(ret[j]);
      if (hist.length < o.minHist) continue;
      const mean = hist.reduce((x, y) => x + y, 0) / hist.length;
      const sd = Math.sqrt(hist.reduce((x, y) => x + (y - mean) * (y - mean), 0) / (hist.length - 1));
      if (!(sd > 0)) continue;
      const ratio = Math.abs(r) / sd;
      if (ratio >= o.k && Math.abs(r) >= o.minAbsPct) {
        out.push({ date: day(rows[i].d), idx: i, pct: r, sigma: sd, ratio, lookback: o.lookback });
      }
    }
    return out;
  }

  // 날짜 오름차순 봉 날짜에서 date 이상인 첫 봉 인덱스. 없으면 -1(휴장일 사건은 다음 거래일 봉).
  function barIndexForDate(barDates, date) {
    const n = barDates ? barDates.length : 0;
    if (!n || !isDate(date)) return -1;
    const d = day(date);
    if (d > day(barDates[n - 1])) return -1;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (day(barDates[mid]) >= d) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  // 키 모먼트마다 같은 봉 ±window 거래일 안의 타임라인 항목을 사유 후보로 붙인다.
  // 가격 항목 중 키 모먼트 자신은 빼고, 특징주 사유는 남긴다. barDates = 전체 일봉 날짜(오름차순).
  function attachReasons(moments, items, barDates, windowBars) {
    const w = Number.isFinite(windowBars) ? windowBars : 1;
    const first = barDates && barDates.length ? day(barDates[0]) : "";
    const mapped = [];
    for (const it of Array.isArray(items) ? items : []) {
      if (!it || it.src === "moment" || !isDate(it.date) || (first && it.date < first)) continue;
      const i = barIndexForDate(barDates, it.date);
      if (i >= 0) mapped.push({ i, it });
    }
    return (Array.isArray(moments) ? moments : []).map((m) => {
      const idx = Number.isInteger(m.idx) ? m.idx : barIndexForDate(barDates, m.date);
      const reasons = mapped
        .filter((x) => Math.abs(x.i - idx) <= w)
        .map((x) => ({ ...x.it, offset: x.i - idx }))
        .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || CAT_ORDER[a.cat] - CAT_ORDER[b.cat]);
      return { ...m, reasons };
    });
  }

  // 보이는 구간에서 표시할 키 모먼트만(비율 큰 순 maxCount 개 → 날짜순). start/count 는 전체 봉 기준.
  function visibleMoments(moments, start, count, maxCount) {
    const s0 = Math.max(0, start | 0);
    const s1 = s0 + Math.max(0, count | 0);
    const inView = (Array.isArray(moments) ? moments : []).filter((m) => m.idx >= s0 && m.idx < s1);
    const cap = Number.isFinite(maxCount) && maxCount > 0 ? maxCount : inView.length;
    return inView.slice().sort((a, b) => b.ratio - a.ratio).slice(0, cap).sort((a, b) => a.idx - b.idx);
  }

  function filterItems(items, cat) {
    const list = Array.isArray(items) ? items : [];
    if (!cat || cat === "all") return list;
    return list.filter((e) => e.cat === cat);
  }

  function countByCat(items) {
    const out = { all: 0 };
    for (const c of CATS) out[c] = 0;
    for (const e of Array.isArray(items) ? items : []) {
      out.all += 1;
      if (e && out[e.cat] !== undefined) out[e.cat] += 1;
    }
    return out;
  }

  // 목록의 날짜 범위(수집 범위 안내용). key = 날짜 필드 이름.
  function dateWindow(list, key) {
    let lo = "";
    let hi = "";
    for (const f of Array.isArray(list) ? list : []) {
      const d = f && f[key || "fileDate"];
      if (!isDate(d)) continue;
      const x = day(d);
      if (!lo || x < lo) lo = x;
      if (!hi || x > hi) hi = x;
    }
    return lo ? { from: lo, to: hi } : null;
  }

  const api = {
    CATS,
    CAT_LABEL,
    MOMENT_DEFAULTS,
    collectTimeline,
    reactionFromRows,
    keyMoments,
    attachReasons,
    visibleMoments,
    barIndexForDate,
    filterItems,
    countByCat,
    dateWindow,
    rcpNo,
    dayIso,
    // 시장 전체 '오늘 피드'(market-feed-core.js)가 같은 잡음 서류 목록을 쓴다.
    KR_NOISE_TYPES,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirTimeline = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
