// 사용자 정의 수식 스크리너 — 순수 계산 모듈(DOM·네트워크 없음, 시장 무관).
// 브라우저에서는 window.MirFormulaCore, node 테스트(scripts/tests/test_formula_core.mjs)에서는
// module.exports 로 같은 코드를 쓴다. IIFE 라 최상위 이름을 전역에 흘리지 않는다.
//
// eval / new Function 을 쓰지 않는다. 작은 토크나이저 + 재귀 하강 파서 + 타입 검사 + 트리 평가기.
//
// 문법(우선순위 낮은 것부터)
//   or      := and  (("or" | "||") and)*
//   and     := not  (("and" | "&&") not)*
//   not     := ("not" | "!") not | cmp
//   cmp     := add  (("<" | "<=" | ">" | ">=" | "==" | "=" | "!=" | "<>") add)?    — 연쇄 비교 금지
//   add     := mul  (("+" | "-") mul)*
//   mul     := unary (("*" | "/") unary)*
//   unary   := ("-" | "+") unary | primary
//   primary := 숫자 | 필드 | 함수 "(" 인수 ")" | "(" or ")"
//
// 결측값 규칙(데이터 정직성 — 없는 값을 0 으로 채우지 않는다)
//   - 필드 값이 없거나 유한수가 아니면(Infinity 포함) 결측(null).
//   - 산술에 결측이 섞이면 결과도 결측. 0 으로 나누면 결측.
//   - 비교에 결측이 섞이면 '알 수 없음'(null). and/or/not 은 3값 논리(SQL 과 같은 규칙).
//   - 필터는 결과가 정확히 true 인 종목만 통과한다 → 결측이면 조건 불충족.
//
// 함수
//   abs(x) · min(a, b, …) · max(a, b, …) · avg(a, b, …)   행 단위, 인수 중 하나라도 결측이면 결측
//   sectorMedian(x) · sectorPct(x)                        같은 섹터 안 중앙값 · 백분위(0~100, 클수록 큼)
//   industryMedian(x) · industryPct(x)                    같은 업종(산업군) 안 중앙값 · 백분위
//   median(x) · pct(x) · rank(x)                          전체 유니버스 중앙값 · 백분위 · 순위(1 = 가장 큼)
//   그룹 집계는 그 그룹에서 값이 있는 종목이 minGroup(기본 5)개 미만이면 결측이다.
(function (root) {
  "use strict";

  const MAX_SOURCE = 600;
  const MAX_DEPTH = 40;
  const MAX_TOKENS = 240;
  const DEFAULT_MIN_GROUP = 5;

  // kind: row = 행 단위, group = 그룹(섹터/업종) 집계, universe = 전체 집계
  const FUNCTIONS = {
    abs: { kind: "row", min: 1, max: 1, label: "절댓값" },
    min: { kind: "row", min: 2, max: 8, label: "최솟값" },
    max: { kind: "row", min: 2, max: 8, label: "최댓값" },
    avg: { kind: "row", min: 2, max: 8, label: "평균" },
    sectorMedian: { kind: "group", group: "sector", stat: "median", min: 1, max: 1, label: "섹터 중앙값" },
    sectorPct: { kind: "group", group: "sector", stat: "pct", min: 1, max: 1, label: "섹터 내 백분위(0~100)" },
    industryMedian: { kind: "group", group: "industry", stat: "median", min: 1, max: 1, label: "업종 중앙값" },
    industryPct: { kind: "group", group: "industry", stat: "pct", min: 1, max: 1, label: "업종 내 백분위(0~100)" },
    median: { kind: "universe", stat: "median", min: 1, max: 1, label: "전체 중앙값" },
    pct: { kind: "universe", stat: "pct", min: 1, max: 1, label: "전체 백분위(0~100)" },
    rank: { kind: "universe", stat: "rank", min: 1, max: 1, label: "전체 순위(1 = 가장 큼)" },
  };
  const FUNCTION_BY_LOWER = Object.fromEntries(Object.keys(FUNCTIONS).map((k) => [k.toLowerCase(), k]));

  class FormulaError extends Error {
    constructor(message, pos) {
      super(message);
      this.name = "FormulaError";
      this.pos = Number.isFinite(pos) ? pos : null;
    }
  }

  function at(pos) {
    return Number.isFinite(pos) ? ` (${pos + 1}번째 글자)` : "";
  }

  // ---------- 토크나이저 ----------
  function tokenize(src) {
    const s = String(src == null ? "" : src);
    if (s.length > MAX_SOURCE) throw new FormulaError(`수식이 너무 깁니다(최대 ${MAX_SOURCE}자).`, MAX_SOURCE);
    const out = [];
    let i = 0;
    const push = (t, v, pos) => {
      out.push({ t, v, pos });
      if (out.length > MAX_TOKENS) throw new FormulaError(`수식이 너무 복잡합니다(토큰 ${MAX_TOKENS}개 초과).`, pos);
    };
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const start = i;
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] || ""))) {
        const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
        i += m[0].length;
        if (/[A-Za-z_가-힣]/.test(s[i] || "")) throw new FormulaError(`숫자 바로 뒤에 글자가 붙었습니다 — 띄어 쓰거나 연산자를 넣으세요${at(i)}`, i);
        push("num", Number(m[0]), start);
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
        i += m[0].length;
        const low = m[0].toLowerCase();
        if (low === "and" || low === "or" || low === "not") push("op", low, start);
        else push("id", m[0], start);
        continue;
      }
      const two = s.slice(i, i + 2);
      if (["<=", ">=", "==", "!=", "<>", "&&", "||"].includes(two)) {
        const map = { "<>": "!=", "&&": "and", "||": "or" };
        push("op", map[two] || two, start);
        i += 2;
        continue;
      }
      if ("+-*/(),<>=!≤≥≠".includes(c)) {
        const map = { "=": "==", "!": "not", "≤": "<=", "≥": ">=", "≠": "!=" };
        push("op", map[c] || c, start);
        i++;
        continue;
      }
      if (/[가-힣]/.test(c)) throw new FormulaError(`한글은 필드 이름으로 쓸 수 없습니다 — 자동완성 목록의 영문 이름을 쓰세요(예: roe, pe)${at(i)}`, i);
      if (c === "%") throw new FormulaError(`'%' 는 쓰지 않습니다 — ROE 15% 는 roe > 15 처럼 숫자만 적으세요${at(i)}`, i);
      throw new FormulaError(`알 수 없는 문자 '${c}'${at(i)}`, i);
    }
    out.push({ t: "eof", v: null, pos: s.length });
    return out;
  }

  // ---------- 편집 거리(비슷한 필드 제안) ----------
  function editDistance(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return dp[a.length][b.length];
  }

  function suggest(name, candidates, limit = 3) {
    const low = name.toLowerCase();
    return candidates
      .map((c) => {
        const cl = c.toLowerCase();
        const d = editDistance(low, cl);
        const bonus = cl.startsWith(low) || low.startsWith(cl) ? -1 : 0;
        return { c, score: d + bonus };
      })
      .filter((x) => x.score <= Math.max(2, Math.floor(low.length / 3)))
      .sort((a, b) => a.score - b.score || a.c.localeCompare(b.c))
      .slice(0, limit)
      .map((x) => x.c);
  }

  // ---------- 파서 ----------
  // fields: 사용할 수 있는 필드 이름 배열(정식 이름). aliases: { 별칭: 정식 이름 }(대소문자 무시).
  function parse(src, options = {}) {
    const tokens = tokenize(src);
    if (tokens.length === 1) throw new FormulaError("수식을 입력하세요.", 0);
    const fieldList = Array.isArray(options.fields) ? options.fields : [];
    const fieldByLower = {};
    fieldList.forEach((f) => { fieldByLower[String(f).toLowerCase()] = f; });
    Object.entries(options.aliases || {}).forEach(([alias, canon]) => {
      if (fieldByLower[String(canon).toLowerCase()]) fieldByLower[String(alias).toLowerCase()] = fieldByLower[String(canon).toLowerCase()];
    });
    const unavailable = options.unavailable || {}; // { 정식이름소문자: "이 시장엔 없음" 사유 }
    let p = 0;
    let depth = 0;
    const peek = () => tokens[p];
    const isOp = (v) => tokens[p].t === "op" && tokens[p].v === v;
    const next = () => tokens[p++];
    const enter = (pos) => {
      depth++;
      if (depth > MAX_DEPTH) throw new FormulaError(`괄호·연산이 너무 깊게 중첩됐습니다(최대 ${MAX_DEPTH}단계).`, pos);
    };
    const leave = () => { depth--; };

    const describe = (tok) => {
      if (tok.t === "eof") return "수식 끝";
      if (tok.t === "num") return `숫자 ${tok.v}`;
      return `'${tok.v}'`;
    };

    function parseOr() {
      enter(peek().pos);
      let a = parseAnd();
      while (isOp("or")) { const tok = next(); a = { k: "logic", op: "or", a, b: parseAnd(), pos: tok.pos }; }
      leave();
      return a;
    }
    function parseAnd() {
      let a = parseNot();
      while (isOp("and")) { const tok = next(); a = { k: "logic", op: "and", a, b: parseNot(), pos: tok.pos }; }
      return a;
    }
    function parseNot() {
      if (isOp("not")) {
        const tok = next();
        enter(tok.pos);
        const a = parseNot();
        leave();
        return { k: "not", a, pos: tok.pos };
      }
      return parseCmp();
    }
    const CMP = ["<", "<=", ">", ">=", "==", "!="];
    function parseCmp() {
      const a = parseAdd();
      if (tokens[p].t === "op" && CMP.includes(tokens[p].v)) {
        const tok = next();
        const b = parseAdd();
        if (tokens[p].t === "op" && CMP.includes(tokens[p].v)) {
          throw new FormulaError(`비교는 한 번에 하나만 됩니다 — 'a < x < b' 대신 'x > a and x < b' 처럼 쓰세요${at(tokens[p].pos)}`, tokens[p].pos);
        }
        return { k: "cmp", op: tok.v, a, b, pos: tok.pos };
      }
      return a;
    }
    function parseAdd() {
      let a = parseMul();
      while (isOp("+") || isOp("-")) { const tok = next(); a = { k: "bin", op: tok.v, a, b: parseMul(), pos: tok.pos }; }
      return a;
    }
    function parseMul() {
      let a = parseUnary();
      while (isOp("*") || isOp("/")) { const tok = next(); a = { k: "bin", op: tok.v, a, b: parseUnary(), pos: tok.pos }; }
      return a;
    }
    function parseUnary() {
      if (isOp("-") || isOp("+")) {
        const tok = next();
        enter(tok.pos);
        const a = parseUnary();
        leave();
        return tok.v === "-" ? { k: "neg", a, pos: tok.pos } : a;
      }
      return parsePrimary();
    }
    function parsePrimary() {
      const tok = peek();
      if (tok.t === "num") { next(); return { k: "num", v: tok.v, pos: tok.pos }; }
      if (tok.t === "op" && tok.v === "(") {
        next();
        const e = parseOr();
        if (!isOp(")")) throw new FormulaError(`닫는 괄호 ')' 가 필요합니다 — ${describe(peek())} 앞${at(peek().pos)}`, peek().pos);
        next();
        return e;
      }
      if (tok.t === "id") {
        next();
        const low = tok.v.toLowerCase();
        if (isOp("(")) {
          const fname = FUNCTION_BY_LOWER[low];
          if (!fname) {
            const s = suggest(tok.v, Object.keys(FUNCTIONS));
            throw new FormulaError(`알 수 없는 함수 '${tok.v}'${s.length ? ` — 혹시 ${s.join(", ")}?` : ""}${at(tok.pos)}`, tok.pos);
          }
          next();
          const args = [];
          if (!isOp(")")) {
            args.push(parseOr());
            while (isOp(",")) { next(); args.push(parseOr()); }
          }
          if (!isOp(")")) throw new FormulaError(`함수 ${fname}( 의 닫는 괄호 ')' 가 필요합니다${at(peek().pos)}`, peek().pos);
          next();
          const spec = FUNCTIONS[fname];
          if (args.length < spec.min || args.length > spec.max) {
            const want = spec.min === spec.max ? `${spec.min}개` : `${spec.min}~${spec.max}개`;
            throw new FormulaError(`${fname}() 는 인수가 ${want}여야 합니다(지금 ${args.length}개)${at(tok.pos)}`, tok.pos);
          }
          return { k: "call", name: fname, args, pos: tok.pos };
        }
        if (FUNCTION_BY_LOWER[low] && !fieldByLower[low]) {
          throw new FormulaError(`'${FUNCTION_BY_LOWER[low]}' 는 함수입니다 — ${FUNCTION_BY_LOWER[low]}(roe) 처럼 괄호와 함께 쓰세요${at(tok.pos)}`, tok.pos);
        }
        const canon = fieldByLower[low];
        if (!canon) {
          if (unavailable[low]) throw new FormulaError(`'${tok.v}' 는 ${unavailable[low]}${at(tok.pos)}`, tok.pos);
          const s = suggest(tok.v, fieldList);
          throw new FormulaError(`알 수 없는 필드 '${tok.v}'${s.length ? ` — 혹시 ${s.join(", ")}?` : " — 자동완성 목록에서 고르세요"}${at(tok.pos)}`, tok.pos);
        }
        return { k: "field", name: canon, pos: tok.pos };
      }
      if (tok.t === "eof") throw new FormulaError(`수식이 끝났는데 값이 더 필요합니다${at(tok.pos)}`, tok.pos);
      throw new FormulaError(`여기에 ${describe(tok)} 가 올 수 없습니다${at(tok.pos)}`, tok.pos);
    }

    const ast = parseOr();
    if (peek().t !== "eof") {
      const tok = peek();
      const hint = tok.t === "id" || tok.t === "num" ? " — 조건 사이에 and / or 를 넣으세요" : "";
      throw new FormulaError(`${describe(tok)} 를 해석할 수 없습니다${hint}${at(tok.pos)}`, tok.pos);
    }
    return ast;
  }

  // ---------- 타입 검사 ----------
  // num = 숫자 값, bool = 참/거짓 조건. 섞으면 컴파일 단계에서 막는다.
  function typeOf(node) {
    switch (node.k) {
      case "num": case "field": return "num";
      case "neg": expectType(node.a, "num", "'-' 뒤에는 숫자 값"); return "num";
      case "bin":
        expectType(node.a, "num", `'${node.op}' 의 왼쪽은 숫자 값`);
        expectType(node.b, "num", `'${node.op}' 의 오른쪽은 숫자 값`);
        return "num";
      case "cmp":
        expectType(node.a, "num", `비교 '${node.op}' 의 왼쪽은 숫자 값`);
        expectType(node.b, "num", `비교 '${node.op}' 의 오른쪽은 숫자 값`);
        return "bool";
      case "logic":
        expectType(node.a, "bool", `'${node.op}' 의 왼쪽은 조건(비교식)`);
        expectType(node.b, "bool", `'${node.op}' 의 오른쪽은 조건(비교식)`);
        return "bool";
      case "not": expectType(node.a, "bool", "'not' 뒤에는 조건(비교식)"); return "bool";
      case "call":
        node.args.forEach((a, i) => expectType(a, "num", `${node.name}() 의 ${i + 1}번째 인수는 숫자 값`));
        return "num";
      default: throw new FormulaError("해석할 수 없는 수식입니다.", node.pos);
    }
  }
  function expectType(node, want, what) {
    const got = typeOf(node);
    if (got !== want) {
      const gotLabel = got === "bool" ? "조건(참/거짓)" : "숫자 값";
      throw new FormulaError(`${what}이어야 하는데 ${gotLabel}입니다${at(node.pos)}`, node.pos);
    }
  }

  function collect(node, out) {
    if (!node) return out;
    if (node.k === "field") out.fields.add(node.name);
    if (node.k === "call") out.functions.add(node.name);
    ["a", "b"].forEach((key) => { if (node[key]) collect(node[key], out); });
    (node.args || []).forEach((a) => collect(a, out));
    return out;
  }

  // compile: { ok, ast, type, fields[], functions[], error, errorPos }
  // expect: "bool"(필터) | "num"(사용자 정의 열) | undefined(아무거나)
  function compile(src, options = {}) {
    try {
      const ast = parse(src, options);
      const type = typeOf(ast);
      if (options.expect === "bool" && type !== "bool") {
        throw new FormulaError("필터 수식은 조건이어야 합니다 — 예: roe > 15 (값만 적으면 표의 열로 추가하세요).", 0);
      }
      if (options.expect === "num" && type !== "num") {
        throw new FormulaError("열 수식은 숫자 값이어야 합니다 — 예: roe / pe (비교식은 필터에 쓰세요).", 0);
      }
      const used = collect(ast, { fields: new Set(), functions: new Set() });
      return { ok: true, ast, type, fields: [...used.fields], functions: [...used.functions], error: "", errorPos: null, source: String(src) };
    } catch (err) {
      if (err instanceof FormulaError) return { ok: false, ast: null, type: null, fields: [], functions: [], error: err.message, errorPos: err.pos, source: String(src) };
      throw err;
    }
  }

  // ---------- 통계 헬퍼 ----------
  function finite(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function medianSorted(sorted) {
    const n = sorted.length;
    if (!n) return null;
    return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }

  // 이분 탐색: sorted 에서 v 보다 작은 개수 / v 이하 개수.
  function lowerBound(sorted, v) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function upperBound(sorted, v) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
    return lo;
  }

  // 백분위(0~100, 클수록 큰 값). 동점은 가운데 순위. 표본 2개 미만이면 null.
  function percentileOf(sorted, v) {
    const n = sorted.length;
    if (n < 2 || v == null) return null;
    const less = lowerBound(sorted, v);
    const equal = upperBound(sorted, v) - less;
    if (!equal) return null;
    return ((less + (equal - 1) / 2) / (n - 1)) * 100;
  }

  // 내림차순 순위(1 = 가장 큼). 동점은 같은 순위.
  function descRankOf(sorted, v) {
    if (v == null || !sorted.length) return null;
    return sorted.length - upperBound(sorted, v) + 1;
  }

  // ---------- 평가 ----------
  // rows: 평가 대상 전체(집계의 모집단이기도 하다).
  // ctx.get(row, fieldName) → 값(없으면 null/undefined)
  // ctx.group(row, "sector"|"industry") → 그룹 이름(없으면 null → 그 행의 그룹 집계는 결측)
  // ctx.minGroup: 그룹 집계의 최소 표본(기본 5)
  // 반환: 행 순서대로 값 배열(bool 수식: true/false/null, num 수식: number/null)
  function evaluate(compiled, rows, ctx = {}) {
    if (!compiled || !compiled.ok) throw new Error("컴파일되지 않은 수식입니다.");
    const list = Array.isArray(rows) ? rows : [];
    const get = typeof ctx.get === "function" ? ctx.get : (row, name) => (row ? row[name] : null);
    const groupOf = typeof ctx.group === "function" ? ctx.group : (row, g) => (row ? row[g] : null);
    const minGroup = Number.isFinite(ctx.minGroup) ? ctx.minGroup : DEFAULT_MIN_GROUP;
    const aggCache = new Map();
    const fieldCache = new Map();

    function fieldValue(name, i) {
      let col = fieldCache.get(name);
      if (!col) { col = new Array(list.length); fieldCache.set(name, col); }
      if (col[i] === undefined) col[i] = finite(get(list[i], name));
      return col[i];
    }

    function aggregate(node) {
      if (aggCache.has(node)) return aggCache.get(node);
      const spec = FUNCTIONS[node.name];
      const vals = list.map((_, j) => finite(ev(node.args[0], j)));
      const out = new Array(list.length).fill(null);
      if (spec.kind === "universe") {
        const sorted = vals.filter((v) => v != null).sort((a, b) => a - b);
        const med = medianSorted(sorted);
        for (let j = 0; j < list.length; j++) {
          if (spec.stat === "median") out[j] = sorted.length ? med : null;
          else if (spec.stat === "pct") out[j] = percentileOf(sorted, vals[j]);
          else out[j] = descRankOf(sorted, vals[j]);
        }
      } else {
        const groups = new Map();
        const keys = list.map((row) => {
          const g = groupOf(row, spec.group);
          return g == null || g === "" ? null : String(g);
        });
        keys.forEach((k, j) => {
          if (k == null || vals[j] == null) return;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(vals[j]);
        });
        const stats = new Map();
        groups.forEach((arr, k) => {
          const sorted = arr.sort((a, b) => a - b);
          stats.set(k, { sorted, median: medianSorted(sorted) });
        });
        for (let j = 0; j < list.length; j++) {
          const st = keys[j] == null ? null : stats.get(keys[j]);
          if (!st || st.sorted.length < minGroup) continue;
          out[j] = spec.stat === "median" ? st.median : percentileOf(st.sorted, vals[j]);
        }
      }
      aggCache.set(node, out);
      return out;
    }

    function ev(node, i) {
      switch (node.k) {
        case "num": return node.v;
        case "field": return fieldValue(node.name, i);
        case "neg": { const a = ev(node.a, i); return a == null ? null : -a; }
        case "bin": {
          const a = ev(node.a, i);
          const b = ev(node.b, i);
          if (a == null || b == null) return null;
          let r;
          if (node.op === "+") r = a + b;
          else if (node.op === "-") r = a - b;
          else if (node.op === "*") r = a * b;
          else { if (b === 0) return null; r = a / b; }
          return Number.isFinite(r) ? r : null;
        }
        case "cmp": {
          const a = ev(node.a, i);
          const b = ev(node.b, i);
          if (a == null || b == null) return null;
          switch (node.op) {
            case "<": return a < b;
            case "<=": return a <= b;
            case ">": return a > b;
            case ">=": return a >= b;
            case "==": return a === b;
            default: return a !== b;
          }
        }
        case "logic": {
          const a = ev(node.a, i);
          if (node.op === "and") {
            if (a === false) return false;
            const b = ev(node.b, i);
            if (b === false) return false;
            return a === true && b === true ? true : null;
          }
          if (a === true) return true;
          const b = ev(node.b, i);
          if (b === true) return true;
          return a === false && b === false ? false : null;
        }
        case "not": { const a = ev(node.a, i); return a == null ? null : !a; }
        case "call": {
          const spec = FUNCTIONS[node.name];
          if (spec.kind !== "row") return aggregate(node)[i];
          const args = node.args.map((a) => ev(a, i));
          if (args.some((v) => v == null)) return null;
          if (node.name === "abs") return Math.abs(args[0]);
          if (node.name === "min") return Math.min(...args);
          if (node.name === "max") return Math.max(...args);
          return args.reduce((s, v) => s + v, 0) / args.length;
        }
        default: return null;
      }
    }

    return list.map((_, i) => ev(compiled.ast, i));
  }

  // 필터: 결과가 정확히 true 인 행만. 반환 = 통과한 행의 인덱스 배열.
  function filterIndices(compiled, rows, ctx) {
    const vals = evaluate(compiled, rows, ctx);
    const out = [];
    vals.forEach((v, i) => { if (v === true) out.push(i); });
    return out;
  }

  // ---------- 공유 URL 인코딩 ----------
  // 상태 { f: 필터 수식, c: [{n: 이름, e: 수식}], s: 정렬 키, d: 1|-1 } 를 URL 안전 base64 로.
  function utf8ToB64Url(str) {
    let b64;
    if (typeof Buffer !== "undefined" && typeof btoa === "undefined") b64 = Buffer.from(str, "utf8").toString("base64");
    else b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64UrlToUtf8(s) {
    const b64 = String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4);
    if (typeof Buffer !== "undefined" && typeof atob === "undefined") return Buffer.from(b64, "base64").toString("utf8");
    return decodeURIComponent(escape(atob(b64)));
  }
  function encodeState(state) {
    const st = state || {};
    const obj = { v: 1, f: String(st.f || "") };
    if (Array.isArray(st.c) && st.c.length) obj.c = st.c.slice(0, 4).map((c) => ({ n: String(c.n || "").slice(0, 20), e: String(c.e || "") }));
    if (st.s) { obj.s = String(st.s); obj.d = st.d === 1 ? 1 : -1; }
    return utf8ToB64Url(JSON.stringify(obj));
  }
  function decodeState(token) {
    try {
      if (!token || String(token).length > 4000) return null;
      const obj = JSON.parse(b64UrlToUtf8(token));
      if (!obj || typeof obj !== "object" || typeof obj.f !== "string") return null;
      const c = Array.isArray(obj.c) ? obj.c.filter((x) => x && typeof x.e === "string").slice(0, 4).map((x) => ({ n: String(x.n || "").slice(0, 20), e: x.e.slice(0, MAX_SOURCE) })) : [];
      return { f: obj.f.slice(0, MAX_SOURCE), c, s: typeof obj.s === "string" ? obj.s : "", d: obj.d === 1 ? 1 : -1 };
    } catch (_) {
      return null;
    }
  }

  // 자동완성: 커서 앞 단어의 접두어로 후보를 고른다. candidates = [{ name, label }]
  function completionPrefix(text, cursor) {
    const s = String(text || "").slice(0, Number.isFinite(cursor) ? cursor : String(text || "").length);
    const m = /[A-Za-z_][A-Za-z0-9_]*$/.exec(s);
    return m ? { prefix: m[0], start: m.index } : { prefix: "", start: s.length };
  }

  const api = {
    FUNCTIONS, FormulaError, DEFAULT_MIN_GROUP, MAX_SOURCE,
    tokenize, parse, compile, evaluate, filterIndices,
    percentileOf, descRankOf, medianSorted, editDistance, suggest,
    encodeState, decodeState, completionPrefix,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirFormulaCore = api;
})(typeof window !== "undefined" ? window : null);
