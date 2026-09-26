// 회사 로고 — 순수 로직(DOM 없음). 브라우저에서는 window.MirLogoCore, node 테스트
// (scripts/tests/test_company_logo_core.mjs)에서는 module.exports 로 같은 코드를 쓴다.
//
// 데이터: window.COMPANY_LOGOS (scripts/build_company_logos.py, data/logos/index.js)
//   { markets: { us: { tickers: "AAPL MSFT …" }, kr: { tickers: "005930 …" } } }
// 로고 파일: data/logos/<market>/<ticker>.webp (64px, 흰 판 위에 그린 불투명 정사각형)
// 인덱스에 없는 종목은 요청하지 않는다(404 를 만들지 않는다) — 화면은 이름 첫 글자 모노그램.
(function (root) {
  "use strict";

  // 모노그램 배경 팔레트 수(styles.css 의 --logo-mono-0..5 와 짝). 등락색(빨강·초록·파랑)과
  // 겹치지 않는 중립 톤만 쓴다.
  const MONO_COLORS = 6;
  const KR_CODE_RE = /^(\d{6})(\.(KS|KQ))?$/i;

  // 인덱스 문자열 → 시장별 Set. 같은 payload 는 한 번만 파싱한다.
  let cachedPayload = null;
  let cachedSets = null;
  function tickerSets(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload === cachedPayload && cachedSets) return cachedSets;
    const sets = {};
    const markets = payload.markets || {};
    Object.keys(markets).forEach((m) => {
      const raw = markets[m] && markets[m].tickers;
      const list = typeof raw === "string" ? raw.split(/\s+/) : (Array.isArray(raw) ? raw : []);
      sets[m] = new Set(list.filter(Boolean));
    });
    cachedPayload = payload;
    cachedSets = sets;
    return sets;
  }

  function marketOf(ticker, market) {
    if (market === "kr" || market === "us") return market;
    return KR_CODE_RE.test(String(ticker || "").trim()) ? "kr" : "us";
  }

  function normTicker(ticker, market) {
    const t = String(ticker || "").trim();
    if (market === "kr") {
      const m = KR_CODE_RE.exec(t);
      return m ? m[1] : t;
    }
    return t.toUpperCase();
  }

  // 로고 파일 경로(없으면 null). 국내 우선주(005935)는 자기 로고가 없으면 보통주(005930) 로고를 쓴다.
  function logoPath(payload, ticker, market) {
    const mkt = marketOf(ticker, market);
    const sets = tickerSets(payload);
    const set = sets && sets[mkt];
    if (!set || !set.size) return null;
    const t = normTicker(ticker, mkt);
    if (!t || !/^[A-Za-z0-9.\-]{1,15}$/.test(t)) return null;
    if (set.has(t)) return `data/logos/${mkt}/${t}.webp`;
    if (mkt === "kr" && /^\d{6}$/.test(t) && t[5] !== "0") {
      const base = `${t.slice(0, 5)}0`;
      if (set.has(base)) return `data/logos/kr/${base}.webp`;
    }
    return null;
  }

  // 회사명 앞의 법인 표기를 걷어 낸다: "(주)", "㈜", "주식회사".
  function cleanName(name) {
    return String(name || "")
      .replace(/^\s*(\(주\)|㈜|주식회사)\s*/, "")
      .replace(/\s*(\(주\)|㈜)\s*$/, "")
      .trim();
  }

  // 모노그램 글자: 이름의 첫 글자(한글·영문·숫자), 영문은 대문자. 이름이 없으면 티커 첫 글자.
  function monogramChar(name, ticker) {
    const pick = (s) => {
      const m = /[0-9A-Za-zㄱ-ㆎ가-힣]/.exec(s);
      return m ? m[0].toUpperCase() : "";
    };
    return pick(cleanName(name)) || pick(String(ticker || "")) || "·";
  }

  // FNV-1a 32bit → 팔레트 번호. 같은 종목은 늘 같은 색.
  function monoIndex(key) {
    const s = String(key || "");
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h % MONO_COLORS;
  }

  const api = { MONO_COLORS, tickerSets, marketOf, normTicker, logoPath, cleanName, monogramChar, monoIndex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirLogoCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
