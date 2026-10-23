// ai-cite-core.js — AI 모드 답변의 문장별 출처 각주 + 후속 질문 칩(순수 계산, DOM 없음).
// 브라우저 window.MirAiCite, node 테스트 scripts/tests/test_ai_cite_core.mjs.
//
// 출처는 새로 만들지 않는다. 클라이언트가 이미 보내는 종목 컨텍스트 줄에 [S1]·[S2] ID 를 붙이고
// (numberContext), 워커가 찾은 뉴스는 워커가 [N1]·[N2] 를 붙여 done 메타 rag.items 로 돌려준다.
// 모델이 문장 끝에 단 ID 중 실제로 보낸 출처에 있는 것만 각주로 살리고, 모르는 ID 는 지운다
// (움직임 이유 검증기와 같은 원칙 — 근거 없는 표기는 보여 주지 않는다). 출처 없는 문장은 그대로 둔다.
// 옛 워커(rag.items 없음)면 rag.sources(제목 배열) 순서를 N1.. 로 본다. 인용이 하나도 없으면 오늘과 같다.
(function (root) {
  "use strict";

  const OPEN = "";
  const CLOSE = "";
  // [S1] · [S1, N2] · [S1·N2] · [S1][N2](각각 한 묶음). 마크다운 링크 [제목](url) 은 ID 만 있는 괄호가 아니라 안 걸린다.
  const GROUP_RE = /[ \t]*\[\s*((?:[SN]\d{1,2})(?:\s*[,，·/]\s*[SN]\d{1,2})*)\s*\]/g;
  const CTX_MAX = 4000; // 워커 handleChat 이 stockContext 를 자르는 길이

  const CITE_RULE = "출처 표기: 아래 각 줄 앞 [S번호]는 출처 ID입니다. 이 데이터(또는 뉴스 [N번호])를 근거로 쓴 문장 끝에 [S1]처럼 해당 ID를 붙이고, 목록에 없는 ID는 만들지 마세요.";

  function str(v, max) {
    const s = typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim() : "";
    return max ? s.slice(0, max) : s;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // 컨텍스트 줄 → 각주 라벨. "[NVDA NVIDIA] 섹터:…" → "NVDA 시세·지표", "  └ 수급 순매수(…): …" → "수급 순매수(…)".
  function lineLabel(line) {
    const t = line.replace(/^\s*└\s*/, "");
    const head = /^\[([^\]]+)\]/.exec(t);
    if (head) return `${head[1].split(/\s+/)[0]} 시세·지표`;
    const colon = t.indexOf(":");
    return (colon > 0 && colon <= 40 ? t.slice(0, colon) : t.slice(0, 24)).trim();
  }

  // 각주 본문 — 라벨로 이미 보인 머리("[NVDA NVIDIA] " · "수급 순매수(…): ")는 뗀다.
  function lineDetail(text) {
    let t = String(text || "").replace(/^\[[^\]]+\]\s*/, "");
    const colon = t.indexOf(":");
    if (colon > 0 && colon <= 40 && !/^\[/.test(String(text || ""))) t = t.slice(colon + 1);
    return str(t, 400);
  }

  // buildStockChatContext 결과에 출처 ID 를 붙인다. 첫 줄(안내문)은 번호 없이 두고 그 위에 인용 규칙을 얹는다.
  // 워커가 maxLen 에서 자르므로 끝까지 들어가지 못한 줄은 출처 목록에서 뺀다(모델이 못 본 줄을 각주로 달지 않게).
  function numberContext(ctx, { maxLen = CTX_MAX } = {}) {
    const raw = String(ctx || "");
    if (!raw.trim()) return { text: raw, sources: [] };
    const lines = raw.split("\n");
    const out = [CITE_RULE];
    const sources = [];
    let n = 0;
    let len = CITE_RULE.length;
    lines.forEach((line, idx) => {
      const isData = idx > 0 && line.trim() && /^\s*(\[|└)/.test(line);
      if (!isData) { out.push(line); len += line.length + 1; return; }
      n += 1;
      const id = `S${n}`;
      const m = /^(\s*└\s*)?(.*)$/.exec(line);
      const tagged = `${m[1] || ""}[${id}] ${m[2]}`;
      out.push(tagged);
      len += tagged.length + 1;
      if (len <= maxLen) sources.push({ id, kind: "data", label: lineLabel(line), detail: lineDetail(m[2]) });
    });
    return { text: out.join("\n"), sources };
  }

  // done 메타 rag → 뉴스 출처. 새 워커는 items(id·title·link·date·publisher), 옛 워커는 sources(제목 배열).
  function newsSources(rag) {
    if (!rag || typeof rag !== "object") return [];
    if (Array.isArray(rag.items) && rag.items.length) {
      return rag.items.slice(0, 10).map((it, i) => {
        const id = /^N\d{1,2}$/.test(String(it && it.id)) ? String(it.id) : `N${i + 1}`;
        const link = str(it && it.link, 600);
        return {
          id, kind: "news", label: str(it && it.title, 200),
          detail: [str(it && it.publisher, 60), str(it && it.date, 10)].filter(Boolean).join(" · "),
          link: /^https?:\/\//i.test(link) ? link : "",
        };
      }).filter((s) => s.label);
    }
    if (Array.isArray(rag.sources)) {
      return rag.sources.slice(0, 10).map((t, i) => ({ id: `N${i + 1}`, kind: "news", label: str(t, 200), detail: "", link: "" }))
        .filter((s) => s.label);
    }
    return [];
  }

  // 답변 본문의 인용 표기를 검증한다. 아는 ID 는 등장 순서대로 1,2,3… 번호 토큰(OPEN n CLOSE)으로,
  // 모르는 ID 는 지운다. notes = 실제로 쓰인 출처(번호순). 같은 출처가 여러 번 나오면 같은 번호.
  function applyCitations(text, sources) {
    const byId = new Map();
    (Array.isArray(sources) ? sources : []).forEach((s) => { if (s && s.id && !byId.has(s.id)) byId.set(s.id, s); });
    const num = new Map();
    const notes = [];
    let dropped = 0;
    const out = String(text || "").replace(GROUP_RE, (_m, ids) => {
      const parts = ids.split(/\s*[,，·/]\s*/).filter(Boolean);
      const marks = [];
      parts.forEach((id) => {
        const src = byId.get(id);
        if (!src) { dropped += 1; return; }
        if (!num.has(id)) { num.set(id, notes.length + 1); notes.push({ n: notes.length + 1, ...src }); }
        const tok = `${OPEN}${num.get(id)}${CLOSE}`;
        if (!marks.includes(tok)) marks.push(tok);
      });
      return marks.join("");
    });
    return { text: out, notes, dropped };
  }

  // 스트리밍 중·대화 이력 저장용: 인용 표기를 전부 걷어낸 본문.
  function stripCitations(text) {
    return String(text || "").replace(GROUP_RE, "");
  }

  // 마크다운 HTML 안의 번호 토큰을 위첨자 링크로. prefix 는 답변마다 다른 각주 id 접두사.
  function citationHtml(html, prefix) {
    const p = esc(prefix || "cite");
    return String(html || "").replace(new RegExp(`${OPEN}(\\d{1,2})${CLOSE}`, "g"),
      (_m, n) => `<sup class="ai-cite"><a href="#${p}-${n}" data-cite="${n}" aria-label="출처 ${n}">${n}</a></sup>`);
  }

  function notesHtml(notes, prefix) {
    if (!Array.isArray(notes) || !notes.length) return "";
    const p = esc(prefix || "cite");
    const items = notes.map((s) => {
      const title = esc(s.label);
      const main = s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${title}</a>` : `<span>${title}</span>`;
      const kind = s.kind === "news" ? "뉴스" : "데이터";
      const detail = s.detail ? `<small class="muted" title="${esc(s.detail)}">${esc(s.detail.length > 90 ? `${s.detail.slice(0, 90)}…` : s.detail)}</small>` : "";
      return `<li id="${p}-${s.n}"><span class="ai-cite-kind">${kind}</span>${main}${detail}</li>`;
    }).join("");
    return `<ol class="ai-cite-notes" aria-label="출처">${items}</ol>`;
  }

  // 후속 질문 칩 — 추가 LLM 호출 없이 이 종목 컨텍스트에 실제로 있는 데이터로만 고른다.
  // 사용자가 방금 물은 주제(키워드 겹침)는 뺀다. 최대 3개.
  const FOLLOWUPS = [
    { key: "disclosure", test: /DART 공시|주요공시\(8-K\)/, ask: /공시/, l: "최근 공시 요약", q: (n) => `${n} 최근 공시 내용을 요약해줘` },
    { key: "earnings", test: /다음실적:/, ask: /실적|어닝/, l: "실적 일정", q: (n) => `${n} 다음 실적 발표 일정과 예상치를 정리해줘` },
    { key: "flow", test: /수급 순매수/, ask: /수급|외국인|기관/, l: "수급 변화", q: (n) => `${n} 최근 외국인·기관 수급 변화를 설명해줘` },
    { key: "smart", test: /내부자\(Form4\)|기관13F|의회매매/, ask: /내부자|13F|기관|의회/, l: "내부자·기관 동향", q: (n) => `${n} 내부자·기관 보유 동향을 정리해줘` },
    { key: "valuation", test: /(PER|P\/B|P\/S):/, ask: /PER|PBR|밸류|저평가|고평가/i, l: "밸류에이션 수준", q: (n) => `${n} 현재 PER·PBR 수준을 같은 업종과 비교해 설명해줘(추천 없이)` },
    { key: "technical", test: /RSI\(14\)/, ask: /RSI|MACD|이평|기술적|차트/i, l: "기술적 지표", q: (n) => `${n} RSI·MACD·이동평균 상태를 해석해줘` },
    { key: "news", test: null, ask: /뉴스|기사|소식/, l: "관련 뉴스", q: (n) => `${n} 최근 뉴스 핵심만 정리해줘` },
  ];

  function followupQuestions({ name, context, userText, hasNews } = {}) {
    const who = str(name, 40);
    if (!who) return [];
    const ctx = String(context || "");
    const asked = String(userText || "");
    const out = [];
    for (const f of FOLLOWUPS) {
      if (out.length >= 3) break;
      const available = f.test ? f.test.test(ctx) : Boolean(hasNews);
      if (!available || f.ask.test(asked)) continue;
      out.push({ key: f.key, label: f.l, question: f.q(who) });
    }
    return out;
  }

  const api = { numberContext, newsSources, applyCitations, stripCitations, citationHtml, notesHtml, followupQuestions, CITE_RULE, CTX_MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirAiCite = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
