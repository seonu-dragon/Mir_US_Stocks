// 증권사 잔고 CSV 가져오기 — 순수 로직(DOM 없음). 화면은 lookthrough.js 의 가져오기 미리보기.
// 브라우저에서는 window.MirBrokerCsvCore, node 테스트(scripts/tests/test_broker_csv_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다.
//
// 처리 순서: 바이트 → 인코딩 판별(UTF-8, 아니면 EUC-KR/CP949) → CSV 파싱(따옴표 안 쉼표 "1,234")
//   → 머리글 행 찾기(위에 제목·계좌 줄이 있어도) → 형식 판별 → 행 추출(천 단위 쉼표·단위 글자 제거,
//   합계 행 제외) → 종목 매칭(코드 우선, 없으면 이름 — 애매하면 후보만 주고 사용자가 고른다).
//
// 형식:
//   - mir      : 이 사이트의 'CSV보내기' 파일(티커,종목명,수량,평단,…)
//   - kiwoom   : 키움증권 계좌평가잔고 — 항목명은 키움 OpenAPI+ opw00018 출력 항목(종목번호·종목명·
//                보유수량·매입가·현재가·평가손익·수익률(%)) 기준. 종목번호는 'A005930' 처럼 앞에 A 가 붙는다.
//   - generic  : 그 밖의 증권사(미래에셋·삼성·NH·토스 등) — 공개 자료로 열 이름을 확인하지 못해
//                같은 뜻의 흔한 열 이름(종목코드·잔고수량·평균단가·매입금액…)으로 인식한다.
//   - legacy   : 머리글 없는 3열(티커,수량,평단)
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- 인코딩
  // UTF-8 로 엄격 디코딩이 되면 UTF-8, 깨지면 EUC-KR(브라우저·Node 의 'euc-kr' 은 CP949 상위집합).
  function decodeCsvBytes(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let start = 0;
    if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) start = 3;
    const body = u8.subarray(start);
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
      return { text, encoding: start ? "UTF-8 (BOM)" : "UTF-8" };
    } catch (_) {
      // fallthrough
    }
    try {
      return { text: new TextDecoder("euc-kr").decode(body), encoding: "EUC-KR (CP949)" };
    } catch (_) {
      return { text: new TextDecoder("utf-8").decode(body), encoding: "UTF-8 (깨짐 가능)" };
    }
  }

  // ---------------------------------------------------------------- CSV 파싱
  function detectDelimiter(text) {
    const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
    const score = (d) => lines.reduce((s, l) => s + (l.split(d).length - 1), 0);
    const cands = [["\t", score("\t")], [",", score(",")], [";", score(";")]];
    cands.sort((a, b) => b[1] - a[1]);
    return cands[0][1] > 0 ? cands[0][0] : ",";
  }

  // RFC 4180 식: 따옴표로 감싼 칸 안의 구분자·줄바꿈·"" 이스케이프 처리.
  function parseCsvText(text, delim) {
    const src = String(text || "").replace(/^﻿/, "");
    const d = delim || detectDelimiter(src);
    const rows = [];
    let row = [], cell = "", inQ = false;
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (inQ) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i += 1; } else inQ = false;
        } else cell += ch;
        continue;
      }
      if (ch === '"' && cell.trim() === "") { cell = ""; inQ = true; continue; }
      if (ch === d) { row.push(cell); cell = ""; continue; }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && src[i + 1] === "\n") i += 1;
        row.push(cell); rows.push(row); row = []; cell = "";
        continue;
      }
      cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    // 엑셀이 '="005930"' 처럼 수식으로 감싼 코드도 푼다.
    return rows
      .map((r) => r.map((c) => String(c).trim().replace(/^="(.*)"$/, "$1").trim()))
      .filter((r) => r.some((c) => c !== ""));
  }

  // ---------------------------------------------------------------- 숫자
  // "1,234" · "₩71,000" · "$123.45" · "10주" · "(1,000)" · "1,234.5원" → 숫자. 못 읽으면 NaN.
  function parseNumber(v) {
    let s = String(v == null ? "" : v).normalize("NFKC").trim();
    if (!s || s === "-") return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[,\s₩$원주株%]|USD|KRW/gi, "");
    if (s.startsWith("+")) s = s.slice(1);
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    const n = parseFloat(s);
    return neg ? -n : n;
  }

  // ---------------------------------------------------------------- 머리글
  function normHeader(h) {
    return String(h || "").normalize("NFKC").toLowerCase()
      .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
      .replace(/[\s_\-·.:/]/g, "");
  }

  // 같은 뜻의 열 이름(정규화 후 완전 일치). 앞에 있을수록 우선.
  const HEADER_SYNONYMS = {
    code: ["종목코드", "종목번호", "단축코드", "티커", "ticker", "symbol", "심볼", "상품코드", "코드", "isin"],
    name: ["종목명", "종목", "상품명", "종목명칭", "회사명", "자산명", "name", "security", "description"],
    qty: ["보유수량", "잔고수량", "수량", "보유주식수", "주식수", "보유량", "결제잔고", "잔고", "qty", "quantity", "shares"],
    avg: ["평균단가", "매입단가", "평균매입가", "매입가", "매입평균가", "평균매수가", "매수평균가", "매수단가", "평단가", "평단", "취득단가", "avgcost", "averagecost", "averageprice", "avgprice", "costpershare"],
    cost: ["매입금액", "매입원금", "매수금액", "취득금액", "투자원금", "costbasis", "totalcost"],
    currency: ["통화", "거래통화", "currency"],
  };

  function mapColumns(header) {
    const norm = header.map(normHeader);
    const cols = {};
    Object.entries(HEADER_SYNONYMS).forEach(([field, syns]) => {
      for (const syn of syns) {
        const i = norm.findIndex((h, idx) => h === syn && !Object.values(cols).includes(idx));
        if (i >= 0) { cols[field] = i; break; }
      }
    });
    return cols;
  }

  const FORMATS = {
    mir: { id: "mir", label: "Mir 내보내기" },
    kiwoom: { id: "kiwoom", label: "키움증권 계좌평가잔고" },
    generic: { id: "generic", label: "일반 형식 (열 이름으로 인식)" },
    legacy: { id: "legacy", label: "머리글 없는 3열 (티커, 수량, 평단)" },
  };

  // 머리글 행을 찾고 형식을 정한다. 증권사 파일은 위에 '계좌번호'·'조회일' 같은 줄이 붙곤 해서
  // 처음 20행 안에서 수량 열 + (종목명|코드) 열이 같이 인식되는 첫 행을 머리글로 본다.
  function detectFormat(rows) {
    const list = rows || [];
    for (let i = 0; i < Math.min(20, list.length); i += 1) {
      const header = list[i];
      const cols = mapColumns(header);
      if (cols.qty == null || (cols.name == null && cols.code == null)) continue;
      if (cols.avg == null && cols.cost == null) continue;
      const norm = header.map(normHeader);
      let format = FORMATS.generic;
      if (norm[0] === "티커" && norm.includes("수량") && norm.includes("평단")) format = FORMATS.mir;
      else if (norm.includes("종목명") && norm.includes("보유수량") && norm.includes("매입가")) format = FORMATS.kiwoom;
      return { format, headerIndex: i, cols, header };
    }
    // 머리글이 없고 첫 행이 (문자, 숫자, 숫자) 면 옛 3열 형식.
    const first = list[0] || [];
    if (first.length >= 3 && Number.isFinite(parseNumber(first[1])) && Number.isFinite(parseNumber(first[2]))) {
      return { format: FORMATS.legacy, headerIndex: -1, cols: { code: 0, qty: 1, avg: 2 }, header: null };
    }
    return { format: null, headerIndex: -1, cols: {}, header: null,
      error: "머리글에서 종목(종목명 또는 종목코드)·수량·평균단가(또는 매입금액) 열을 찾지 못했습니다." };
  }

  const SUMMARY_RE = /^(합계|총계|소계|총합계|계|total|subtotal|sum)$|합\s*계|총\s*계/i;

  // 행 → {line, rawName, rawCode, qty, avg, currency, skip}. skip 은 사유 문자열(가져오지 않음).
  function extractRows(rows, det) {
    if (!det || !det.format) return [];
    const c = det.cols;
    const out = [];
    for (let i = det.headerIndex + 1; i < rows.length; i += 1) {
      const r = rows[i];
      const get = (k) => (c[k] != null ? String(r[c[k]] == null ? "" : r[c[k]]).trim() : "");
      const rawName = get("name");
      const rawCode = get("code");
      if (!rawName && !rawCode) continue;
      const label = rawName || rawCode;
      const rec = { line: i + 1, rawName, rawCode, qty: NaN, avg: NaN, currency: get("currency").toUpperCase(), skip: "" };
      if (SUMMARY_RE.test(label.replace(/\s/g, "")) || SUMMARY_RE.test(label)) continue;
      rec.qty = parseNumber(get("qty"));
      rec.avg = parseNumber(get("avg"));
      if (!Number.isFinite(rec.avg) || rec.avg <= 0) {
        const cost = parseNumber(get("cost"));
        if (Number.isFinite(cost) && cost > 0 && Number.isFinite(rec.qty) && rec.qty > 0) rec.avg = cost / rec.qty;
      }
      if (!Number.isFinite(rec.qty) || rec.qty <= 0) rec.skip = "수량 없음";
      else if (!Number.isFinite(rec.avg) || rec.avg <= 0) rec.skip = "평균단가 없음";
      out.push(rec);
    }
    return out;
  }

  // ---------------------------------------------------------------- 종목 매칭
  const NAME_NOISE_RE = /\(주\)|㈜|주식회사|\b(incorporated|inc|corporation|corp|company|co|ltd|limited|plc|holdings?|group|the|class [a-c]|cl [a-c]|ordinary shares?|common stock|ads|adr)\b/g;

  function normCompany(s) {
    return String(s || "").normalize("NFKC").toLowerCase()
      .replace(NAME_NOISE_RE, " ")
      .replace(/[\s.,·'"&\-_/()[\]]/g, "");
  }

  // "A005930" · "005930.KS" · "KR7005930003" → "005930". 미국 티커는 대문자.
  function normCode(raw, market) {
    let s = String(raw || "").normalize("NFKC").trim().toUpperCase();
    if (!s) return "";
    s = s.replace(/\.(KS|KQ|KRX)$/, "");
    const isin = /^KR7([0-9A-Z]{6})\d{3}$/.exec(s);
    if (isin) return isin[1];
    if (/^A[0-9][0-9A-Z]{5}$/.test(s)) return s.slice(1);
    if (market === "kr" && /^\d{1,6}$/.test(s)) return s.padStart(6, "0");
    return s.replace(/\//g, ".");
  }

  // 이름 안에 코드가 들어 있는 경우: "삼성전자(005930)" · "Apple (AAPL)"
  function codeInName(name) {
    const m = /[([]\s*(A?[0-9][0-9A-Z]{5}|[A-Z]{1,5}(?:\.[A-Z])?)\s*[)\]]/.exec(String(name || ""));
    return m ? m[1] : "";
  }

  // universe: [{ticker, company}] — 현재 시장 스냅샷.
  function buildUniverseIndex(universe) {
    const byTicker = new Map();
    const byName = new Map();
    const list = [];
    (universe || []).forEach((u) => {
      if (!u || !u.ticker) return;
      const t = String(u.ticker).toUpperCase();
      byTicker.set(t, u);
      const key = normCompany(u.company);
      if (key) {
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(u);
        list.push({ key, u });
      }
    });
    return { byTicker, byName, list };
  }

  // → { status: "exact"|"ambiguous"|"none", ticker, via: "code"|"name", candidates:[{ticker, company, score}] }
  function matchInstrument(rec, index, market) {
    const tryCode = (raw) => {
      const code = normCode(raw, market);
      if (!code) return null;
      const alts = [code, code.replace(/\./g, "-"), code.replace(/-/g, ".")];
      for (const a of alts) { const u = index.byTicker.get(a); if (u) return u; }
      return null;
    };
    const byCode = tryCode(rec.rawCode) || tryCode(codeInName(rec.rawName));
    if (byCode) return { status: "exact", ticker: byCode.ticker, via: "code", candidates: [{ ticker: byCode.ticker, company: byCode.company, score: 1 }] };
    const name = rec.rawName || (market === "kr" ? "" : rec.rawCode);
    const key = normCompany(String(name).replace(/[([][^)\]]*[)\]]/g, ""));
    if (!key) return { status: "none", ticker: null, via: null, candidates: [] };
    const same = index.byName.get(key) || [];
    if (same.length === 1) return { status: "exact", ticker: same[0].ticker, via: "name", candidates: [{ ticker: same[0].ticker, company: same[0].company, score: 1 }] };
    const scored = [];
    if (same.length > 1) same.forEach((u) => scored.push({ ticker: u.ticker, company: u.company, score: 1 }));
    else if (key.length >= 2) {
      index.list.forEach(({ key: k, u }) => {
        if (k === key) return;
        if (k.includes(key) || key.includes(k)) {
          const shorter = Math.min(k.length, key.length), longer = Math.max(k.length, key.length);
          if (shorter < 2) return;
          scored.push({ ticker: u.ticker, company: u.company, score: shorter / longer });
        }
      });
    }
    scored.sort((a, b) => b.score - a.score || String(a.company).length - String(b.company).length);
    const candidates = scored.slice(0, 5);
    return { status: candidates.length ? "ambiguous" : "none", ticker: null, via: "name", candidates };
  }

  // ---------------------------------------------------------------- 전체
  // bytesOrText: Uint8Array/ArrayBuffer 또는 문자열. market: "us"|"kr".
  // → { encoding, format, error, rows:[{...extract, match, market hint}] }
  function buildImportPreview(bytesOrText, universe, market) {
    const dec = typeof bytesOrText === "string" ? { text: bytesOrText, encoding: "텍스트" } : decodeCsvBytes(bytesOrText);
    const rows = parseCsvText(dec.text);
    if (!rows.length) return { encoding: dec.encoding, format: null, error: "빈 파일입니다.", rows: [] };
    const det = detectFormat(rows);
    if (!det.format) return { encoding: dec.encoding, format: null, error: det.error, rows: [] };
    const index = buildUniverseIndex(universe);
    const recs = extractRows(rows, det).map((rec) => {
      const match = matchInstrument(rec, index, market);
      let skip = rec.skip;
      // 다른 시장 종목(국내 증권사 파일의 해외주식 등)은 현재 시장 스냅샷에 없다.
      const foreignHint = (market === "kr" && (rec.currency === "USD" || /^[A-Z]{1,5}(\.[A-Z])?$/.test(normCode(rec.rawCode, market))))
        || (market === "us" && (rec.currency === "KRW" || /^\d{6}$/.test(normCode(rec.rawCode, market))));
      // 코드로 못 찾은 다른 시장 표시(통화·코드 모양) 행은 이름이 비슷한 후보가 있어도 제외한다
      // (국내 모드에서 '애플' → 'PLUS 애플채권혼합' 같은 엉뚱한 후보를 고르게 하지 않는다).
      if (!skip && match.status !== "exact" && foreignHint) skip = "다른 시장 종목 — 시장을 바꿔 다시 가져오세요";
      if (!skip && match.status === "none") skip = "종목을 찾지 못함";
      // 국내 증권사 파일의 해외주식이 원화 환산 단가로 적혀 있으면 달러 평단으로 쓸 수 없다.
      if (!skip && market === "us" && rec.currency === "KRW") skip = "원화 표시 단가 — 달러 평단 파일로 가져오세요";
      return { ...rec, skip, match, selected: !skip && match.status === "exact" ? match.ticker : "" };
    });
    return { encoding: dec.encoding, format: det.format, headerLine: det.headerIndex + 1, error: recs.length ? "" : "가져올 행이 없습니다.", rows: recs };
  }

  // 미리보기에서 사용자가 확정한 행 → 포트폴리오 반영. 같은 티커가 여러 번(계좌 여러 개)이면
  // 수량 합산·평단 가중평균. existing: [{ticker, qty, avgCost}] → { next, added, updated, skipped }.
  function applyImport(existing, rows, { replace = false, limit = 60 } = {}) {
    const merged = new Map();
    (rows || []).forEach((r) => {
      if (!r || !r.selected || r.skip) return;
      const t = r.selected;
      const cur = merged.get(t);
      if (cur) {
        const q = cur.qty + r.qty;
        cur.avgCost = (cur.qty * cur.avgCost + r.qty * r.avg) / q;
        cur.qty = q;
      } else merged.set(t, { ticker: t, qty: r.qty, avgCost: r.avg });
    });
    const next = replace ? [] : (existing || []).map((p) => ({ ...p }));
    let added = 0, updated = 0, skipped = 0;
    merged.forEach((p) => {
      const i = next.findIndex((x) => x.ticker === p.ticker);
      if (i >= 0) { next[i] = { ...next[i], qty: p.qty, avgCost: p.avgCost }; updated += 1; }
      else if (next.length < limit) { next.push(p); added += 1; }
      else skipped += 1;
    });
    return { next, added, updated, skipped };
  }

  const api = {
    decodeCsvBytes, detectDelimiter, parseCsvText, parseNumber, normHeader, mapColumns, detectFormat,
    extractRows, normCompany, normCode, codeInName, buildUniverseIndex, matchInstrument, buildImportPreview,
    applyImport, FORMATS, HEADER_SYNONYMS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MirBrokerCsvCore = api;
})(typeof window !== "undefined" ? window : globalThis);
