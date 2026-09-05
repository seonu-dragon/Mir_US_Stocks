// fmt.js — 포맷/숫자/날짜/문자열 헬퍼
// =====================================
// app.js 에서 기계적으로 분리한 클래식 스크립트(모듈 아님). index.html 이 app.js 보다
// 먼저 싣고, 같은 전역 스코프를 공유한다. 로드 시점 실행문이 없으므로(선언만) 여기서
// app.js 의 값(marketCfg·isKrMarket·data 등)을 참조해도 호출은 항상 app.js 로드 뒤다.
// 이름 충돌은 scripts/check_global_name_collisions.py 가 감시한다.

// ===== 실측 RSI(14) · EPS(TTM) 표시 헬퍼 =====
// RS/EPS 합성 점수를 전면 제거하고, 빌더가 light 스냅샷에 심는 실측값만 노출한다.
//  - rsi14: 실측 Wilder RSI(14). 합성 히스토리(가짜 가격) 종목은 null → 정렬/필터 제외 + "—".
//  - epsTtm: 실측 TTM EPS(음수 가능). 펀더멘털이 없으면 null → "—".
function rsiValue(item) {
  // 합성 히스토리(가짜 가격) 종목은 실측 RSI 가 없다. light 스냅샷은 null 이지만
  // 상세 JSON 병합(withDetail)이 옛 rsi14 를 덮어쓸 수 있어 소스로 한 번 더 차단한다.
  if (!item || isSyntheticHistory(item)) return null;
  const v = Number(item.rsi14);
  return Number.isFinite(v) ? v : null;
}
function epsTtmValue(item) {
  const v = Number(item && item.epsTtm);
  return Number.isFinite(v) ? v : null;
}
function fmtRsi(item) {
  const v = rsiValue(item);
  return v == null ? "—" : String(Math.round(v));
}
// 시장별 통화로 EPS 포맷. KR 은 원(정수), US 는 달러(소수 2자리). 음수도 자연 처리.
function fmtEpsValue(v) {
  if (!Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  return isKrMarket() ? `₩${Math.round(n).toLocaleString("ko-KR")}` : `$${n.toFixed(2)}`;
}
function fmtEps(item) {
  return fmtEpsValue(epsTtmValue(item));
}

const KR_PRICE_LIMIT_PCT = 30;

function krDisplayChangePct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (!isKrMarket()) return n;
  return Math.max(-KR_PRICE_LIMIT_PCT, Math.min(KR_PRICE_LIMIT_PCT, n));
}

// 범용 %포맷 — 클램프 없음. 1주·1개월·YTD 같은 기간 수익률은 KR 에서도 ±30% 를
// 정상적으로 넘을 수 있으므로 여기로 온다. (예전엔 모든 %가 krDisplayChangePct 를
// 거쳐 기간 수익률까지 "(상하한)" 으로 잘려 나갔다.)
// 부호 붙은 %(0 은 부호 없음). fmtPct(▲▼ 마커)·fmtDailyPct(KR 상하한 클램프)·actionPct(마커
// 없음)가 전부 여기로 온다 — 예전엔 같은 식이 8곳에 흩어져 있었다.
const fmtSignedPct = (value, digits = 1, suffix = "%") => {
  const n = Number(value) || 0;
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}${suffix}`;
};
const pctMarker = (n) => (n > 0 ? "▲ " : n < 0 ? "▼ " : "");
const fmtPct = (value) => {
  const n = Number(value) || 0;
  return `${pctMarker(n)}${fmtSignedPct(n)}`;
};

// 당일 등락률 전용 — KR 은 가격제한폭(±30%) 을 넘을 수 없으므로, 넘는 값은 데이터
// 오류(전일종가 어긋남 등)로 보고 상하한으로 클램프하고 "(상하한)" 을 표시한다.
const fmtDailyPct = (value) => {
  const raw = Number(value) || 0;
  const n = isKrMarket() ? krDisplayChangePct(raw) : raw;
  const atLimit = isKrMarket() && Math.abs(raw) > KR_PRICE_LIMIT_PCT + 0.05;
  const suffix = atLimit ? " (상하한)" : "";
  return `${pctMarker(n)}${fmtSignedPct(n)}${suffix}`;
};
const cls = (value) => value > 0 ? "pos" : value < 0 ? "neg" : "muted";
const byId = (id) => document.getElementById(id);

function formatKstDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} KST`;
}

// 액션보드 컴팩트 등락률: 화살표 없이 부호+숫자만(색으로 방향 표시) → 좁은 카드에서도 안 잘림
function actionPct(value) {
  return fmtSignedPct(value);
}

// 종목 표기 규칙(2026-09-04): 미국은 티커(AAPL)로 회사를 알 수 있지만 국내 코드(005930)는
// 그렇지 않다. 그래서 화면에 보이는 종목 이름은 이 두 함수로만 만든다.
//   stockLabel    = 주 표기  — US: 티커 / KR: 회사명(삼성전자)
//   stockSubLabel = 보조 표기 — US: 회사명 / KR: 6자리 코드
// 인자는 종목 객체({ticker, company})든 티커 문자열이든 된다. 이름을 모르는 코드는 코드 그대로.
// data-ticker 속성·URL·저장 키·검색 입력값은 여전히 티커/코드를 쓴다(이 함수는 표시 전용).
function _stockRef(tickerOrItem, item) {
  const obj = tickerOrItem && typeof tickerOrItem === "object" ? tickerOrItem : item;
  const ticker = String((obj && obj.ticker) || (typeof tickerOrItem === "string" ? tickerOrItem : "") || "");
  let name = obj && (obj.company || obj.name);
  if (!name && ticker && typeof stockByTicker === "function") {
    const found = stockByTicker(ticker);
    name = found && (found.company || found.name);
  }
  return { ticker, name: name ? String(name) : "" };
}
function stockLabel(tickerOrItem, item) {
  const ref = _stockRef(tickerOrItem, item);
  if (typeof isKrMarket === "function" && isKrMarket() && /^\d{1,6}(\.(KS|KQ))?$/i.test(ref.ticker)) return ref.name || ref.ticker;
  return ref.ticker;
}
function stockSubLabel(tickerOrItem, item) {
  const ref = _stockRef(tickerOrItem, item);
  if (typeof isKrMarket === "function" && isKrMarket() && /^\d{1,6}(\.(KS|KQ))?$/i.test(ref.ticker)) {
    return ref.name ? ref.ticker.replace(/\.(KS|KQ)$/i, "").padStart(6, "0") : "";
  }
  return ref.name;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

// 외부 소스 텍스트(브리핑 파이프라인·소셜·LLM 답변)의 이모지/픽토그램 제거. 사이트는 장식
// 이모지를 쓰지 않는다(기능 심볼 ★☆✓▲▼ 등은 유지). 국기(지역 지시자)·피부색 수정자·
// 변이 선택자·ZWJ·키캡까지 걷어낸다.
const EMOJI_KEEP = new Set(["★", "☆", "✓", "✔", "▲", "▼", "▶", "◀", "©", "®", "™", "↑", "↓", "→", "←", "↔", "•"]);
const EMOJI_RE = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}]|[\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;
function stripEmoji(text) {
  return String(text ?? "").replace(EMOJI_RE, (ch) => (EMOJI_KEEP.has(ch) ? ch : ""));
}
// 브리핑 HTML: 이모지를 떼고 "📊 [제목] - 날짜" 굵은 첫 줄을 제목/날짜로 바꾼다.
function sanitizeBriefingHtml(html) {
  let out = stripEmoji(html);
  out = out.replace(/<b>\s*\[([^\]<]+)\]\s*-?\s*([^<]*?)\s*<\/b>/, (m, title, date) =>
    `<strong class="briefing-title">${title.trim()}</strong>${date.trim() ? ` <span class="muted">${date.trim()}</span>` : ""}`);
  // 이모지가 빠진 자리의 앞 공백 정리("<b> 제목" → "<b>제목")
  out = out.replace(/(<(?:b|strong|h[1-6])(?:\s[^>]*)?>)\s+/g, "$1");
  return out;
}

// ===== LLM 답변 품질 검증 =====
// 2026-09-04 새벽, 워커 LLM 이 ". of the the of the the …" 만 800자 반복한 답변을 한 번
// 냈고 클라이언트가 그대로 12시간 캐시해 '분석 리포트' 카드가 하루 종일 깨져 보였다.
// 한국어 리포트인데 한글이 거의 없거나, 같은 토큰 뭉치가 지나치게 반복되면 실패로 본다.
function isDegenerateLlmText(text, expectKorean = true) {
  const s = String(text || "").trim();
  if (s.length < 40) return false; // 짧은 답은 판단 보류
  const letters = (s.match(/[A-Za-z\uAC00-\uD7A3]/g) || []).length;
  const hangul = (s.match(/[\uAC00-\uD7A3]/g) || []).length;
  // 한국어 답이 기대되는 자리(리포트·대시보드 코멘트)에서 한글이 15% 미만이면 실패.
  if (expectKorean && letters >= 80 && hangul / letters < 0.15) return true;
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 30) {
    const tri = new Map();
    for (let i = 0; i + 2 < words.length; i += 1) {
      const k = words[i] + " " + words[i + 1] + " " + words[i + 2];
      tri.set(k, (tri.get(k) || 0) + 1);
    }
    let top = 0; tri.forEach((v) => { if (v > top) top = v; });
    if (top / (words.length - 2) > 0.2) return true; // 3-gram 하나가 20% 넘게 반복
  }
  return false;
}

function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}
