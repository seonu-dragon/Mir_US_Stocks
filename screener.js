// 이 파일은 app.js 에서 기계적으로 분리된 코드다 (refactor/appjs-split-stage2).
// 스크리너 클러스터: 스크리너/저장 스크리너·델타/AI 자연어 스크리너/화면 설정(테마·밀도)/종목 비교 보드 (원본 app.js 13052-13701).
// index.html 에서 app.js 보다 먼저 로드되는 classic script. 최상위 function/let/const 는
// 전역 렉시컬 환경을 공유하므로 app.js 와 양방향 참조가 호출 시점에 해결된다.

// 이 파일의 모든 저장소 접근은 window.safeStorage(storage.js — index.html 첫 스크립트) 를 거친다.

// ===== 스크리너 =====
let savedScreeners = [];
let selectedSavedScreenerId = "";
let applyingSavedScreener = false;

// RSI 범위 입력의 DOM id. 원래 id(scrMinRs/scrMinEps)는 예전 'RS ≥ / EPS' 필터 시절
// 이름이라 오해를 부른다(실제 의미는 RSI 하한/상한). index.html 이 scrMinRsi/scrMaxRsi 로
// 바뀌면 그쪽을 우선 쓰고, 그때까지는 옛 id 로 폴백한다.
function scrRsiMinId() { return byId("scrMinRsi") ? "scrMinRsi" : "scrMinRs"; }
function scrRsiMaxId() { return byId("scrMaxRsi") ? "scrMaxRsi" : "scrMinEps"; }

// 저장 스크리너 config 의 옛 키(minRs/minEps → RSI 하한/상한)를 새 키로 옮긴다.
function migrateScreenerConfig(config) {
  if (!config || typeof config !== "object") return config;
  if (config.minRsi == null && config.minRs != null) config.minRsi = config.minRs;
  if (config.maxRsi == null && config.minEps != null) config.maxRsi = config.minEps;
  delete config.minRs;
  delete config.minEps;
  return config;
}

function screenerSnapshotKey() {
  return String(data.updatedAtKst || data.updated_at_kst || "unknown");
}

function currentScreenerConfig() {
  return {
    bucket: byId("scrBucket")?.value || marketCfg().defaultBucket || "idx_sp500",
    sector: byId("scrSector")?.value || "All",
    preset: byId("scrPreset")?.value || "custom",
    metric: byId("scrMetric")?.value || "rsi14",
    minRsi: numberInputValue(scrRsiMinId(), 0),
    maxRsi: numberInputValue(scrRsiMaxId(), 0),
    minVol: numberInputValue("scrMinVol", 0),
    minCap: numberInputValue("scrMinCap", 0),
    limit: Math.max(1, numberInputValue("scrLimit", 100))
  };
}

function applyScreenerConfig(config) {
  if (!config) return;
  migrateScreenerConfig(config);
  applyingSavedScreener = true;
  const values = {
    scrBucket: config.bucket,
    scrSector: config.sector,
    scrPreset: config.preset,
    scrMetric: config.metric,
    [scrRsiMinId()]: config.minRsi || "",
    [scrRsiMaxId()]: config.maxRsi || "",
    scrMinVol: config.minVol || "",
    scrMinCap: config.minCap || "",
    scrLimit: config.limit || 100
  };
  Object.entries(values).forEach(([id, value]) => { const el = byId(id); if (el) el.value = value; });
  applyingSavedScreener = false;
}

function loadSavedScreeners() {
  const rows = window.safeStorage.getJSON(SAVED_SCREENER_STORAGE_KEY, []);
  savedScreeners = Array.isArray(rows) ? rows.filter((row) => row && row.id && row.name && row.config) : [];
  savedScreeners.forEach((row) => migrateScreenerConfig(row.config));
}

function persistSavedScreeners() {
  window.safeStorage.setJSON(SAVED_SCREENER_STORAGE_KEY, savedScreeners);
}

function savedScreenerById(id = selectedSavedScreenerId) {
  return savedScreeners.find((row) => row.id === id) || null;
}

function renderSavedScreenerPicker() {
  const select = byId("savedScreenerSelect");
  const badge = byId("savedScreenerBadge");
  const del = byId("savedScreenerDelete");
  if (badge) badge.textContent = `저장 ${savedScreeners.length}개`;
  if (!select) return;
  select.innerHTML = `<option value="">저장된 조건 선택</option>` + savedScreeners.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
  select.value = selectedSavedScreenerId;
  if (del) del.disabled = !selectedSavedScreenerId;
}

function savedScreenerDeltaHtml(record) {
  const delta = record?.lastDelta || { added: [], removed: [] };
  const chips = (rows, tone, empty) => rows.length
    ? rows.map((ticker) => `<button type="button" class="screener-delta-chip ${tone}" data-ticker="${escapeHtml(ticker)}">${escapeHtml(ticker)}</button>`).join("")
    : `<span class="muted">${empty}</span>`;
  return `
    <div class="screener-delta-meta">
      <strong>${escapeHtml(record.name)}</strong>
      <span>기준 ${escapeHtml(record.lastSnapshotKey || "-")} · 결과 ${(record.lastTickers || []).length}개</span>
    </div>
    <div class="screener-delta-cols">
      <div><b>신규 편입 ${delta.added.length}</b><div>${chips(delta.added, "is-added", "신규 편입 없음")}</div></div>
      <div><b>이탈 ${delta.removed.length}</b><div>${chips(delta.removed, "is-removed", "이탈 없음")}</div></div>
    </div>`;
}

function renderSavedScreenerDelta(record) {
  const box = byId("savedScreenerDelta");
  if (!box) return;
  if (!record) {
    box.innerHTML = `<p class="muted">조건을 저장하면 다음 스냅샷부터 편입·이탈을 비교합니다.</p>`;
    return;
  }
  box.innerHTML = savedScreenerDeltaHtml(record);
  delegateTickerClicks(box, "[data-ticker]");
}

function compareSavedScreener(record, tickers) {
  if (!record) return;
  const snapshotKey = screenerSnapshotKey();
  const previous = Array.isArray(record.lastTickers) ? record.lastTickers : [];
  if (!record.lastSnapshotKey) {
    record.lastSnapshotKey = snapshotKey;
    record.lastTickers = tickers;
    record.lastDelta = { added: [], removed: [] };
  } else if (record.lastSnapshotKey !== snapshotKey) {
    const before = new Set(previous);
    const now = new Set(tickers);
    record.lastDelta = {
      added: tickers.filter((ticker) => !before.has(ticker)),
      removed: previous.filter((ticker) => !now.has(ticker))
    };
    record.lastSnapshotKey = snapshotKey;
    record.lastTickers = tickers;
  }
  record.lastCheckedAt = formatKstDateTime();
  persistSavedScreeners();
  renderSavedScreenerDelta(record);
}

function saveCurrentScreener() {
  const input = byId("savedScreenerName");
  const name = String(input?.value || "").trim();
  if (!name) { showAppToast("저장할 스크리너 이름을 입력하세요"); input?.focus(); return; }
  const rows = screenerRows();
  let record = savedScreenerById();
  if (!record) {
    record = { id: `scr_${Date.now().toString(36)}`, name, config: {}, createdAt: formatKstDateTime() };
    savedScreeners.push(record);
  }
  record.name = name;
  record.config = currentScreenerConfig();
  record.lastSnapshotKey = screenerSnapshotKey();
  record.lastTickers = rows.map(({ item }) => item.ticker);
  record.lastDelta = { added: [], removed: [] };
  record.lastCheckedAt = formatKstDateTime();
  selectedSavedScreenerId = record.id;
  persistSavedScreeners();
  renderSavedScreenerPicker();
  renderSavedScreenerDelta(record);
  showAppToast(`'${name}' 조건을 저장했습니다`);
}

function deleteSelectedScreener() {
  const record = savedScreenerById();
  if (!record) return;
  savedScreeners = savedScreeners.filter((row) => row.id !== record.id);
  selectedSavedScreenerId = "";
  persistSavedScreeners();
  renderSavedScreenerPicker();
  renderSavedScreenerDelta(null);
  const input = byId("savedScreenerName");
  if (input) input.value = "";
  showAppToast("저장 조건을 삭제했습니다");
}

function screenerRows() {
  const bucket = byId("scrBucket")?.value || marketCfg().defaultBucket || "idx_sp500";
  const sector = byId("scrSector")?.value || "All";
  const preset = byId("scrPreset")?.value || "custom";
  const metric = byId("scrMetric")?.value || "rsi14";
  const patternCat = byId("scrPattern")?.value || "any";
  const minRsi = numberInputValue(scrRsiMinId(), 0);
  const maxRsi = numberInputValue(scrRsiMaxId(), 0);
  const minVol = numberInputValue("scrMinVol", 0);
  const minCap = numberInputValue("scrMinCap", 0);
  const limit = Math.max(1, numberInputValue("scrLimit", 100));
  return data.stocks
    .filter((item) => !isStockEtf(item))
    .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), bucket))
    .filter((item) => sector === "All" || item.sector === sector)
    .filter((item) => { if (minRsi <= 0) return true; const r = rsiValue(item); return r != null && r >= minRsi; })
    .filter((item) => { if (maxRsi <= 0) return true; const r = rsiValue(item); return r != null && r <= maxRsi; })
    .filter((item) => (Number(item.volumeRatio) || 0) >= minVol)
    // 시총 하한은 시장별 단위로 비교: US=marketCapB($B), KR=marketCapT(조 원).
    // itemCapForValuation(app.js) 이 그 시장별 값을 돌려준다(US 결과는 기존과 동일).
    .filter((item) => itemCapForValuation(item) >= minCap)
    .filter((item) => topPresetMatches(item, preset))
    .filter((item) => {
      if (patternCat === "any") return true;
      const pats = patternScreenerCache.get(item.ticker);
      return pats && pats.some((p) => patternCategory(p) === patternCat);
    })
    .map((item) => ({ item, value: metricValue(item, metric) }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => metricSortDirection(metric) * (b.value - a.value))
    .slice(0, limit);
}

function renderScreener({ trackSaved = false } = {}) {
  const body = byId("screenerTable");
  const meta = byId("screenerMeta");
  if (!body) return;
  const rows = screenerRows();
  if (trackSaved && selectedSavedScreenerId) compareSavedScreener(savedScreenerById(), rows.map(({ item }) => item.ticker));
  if (meta) meta.textContent = `${rows.length}개 종목 · ${byId("scrBucket")?.selectedOptions?.[0]?.textContent || ""}`;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11" class="muted">조건에 맞는 종목이 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(({ item }) => `
    <tr>
      <td>${watchStarButton(item.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(item.ticker)}">${escapeHtml(stockLabel(item))}</button></td>
      <td>${escapeHtml(stockSubLabel(item))}</td>
      <td>${escapeHtml(item.sector)}</td>
      <td class="${cls(item.changePct)}">${fmtDailyPct(item.changePct)}</td>
      <td class="${cls(item.monthChangePct)}">${fmtPct(item.monthChangePct)}</td>
      <td>${fmtRsi(item)}</td>
      <td>${fmtEps(item)}</td>
      <td>${Number(item.volumeRatio || 0).toFixed(1)}x</td>
      <td>${fmtBillions(item.marketCapB)}</td>
      <td>${signalFor(item)}</td>
    </tr>
  `).join("");
  delegateTickerClicks(body, ".ticker-link");
}

// ===== AI 자연어 스크리너 (규칙 기반 파서 · 백엔드 불필요) =====
const NL_EXAMPLES = [
  "RSI 30 이하 반도체주",
  "RS 80 이상 신고가 근접 대형주",
  "PER 15 이하 ROE 15 이상",
  "1개월 20% 이상 거래량 2배 이상",
  "과매도 기술주",
];

const NL_SECTORS = [
  { kw: ["반도체", "semiconduct", "칩"], label: "반도체", test: (it) => /semiconduct|반도체/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["바이오", "biotech", "제약", "pharma"], label: "바이오/제약", test: (it) => /(biotech|pharma|drug|life science|바이오|제약)/i.test(`${it.industry || ""} ${it.sector || ""}`) || /헬스케어|HEALTHCARE/i.test(it.sector || "") },
  { kw: ["헬스케어", "healthcare", "의료"], label: "헬스케어", test: (it) => /헬스케어|HEALTHCARE|의료/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["기술주", "기술", "테크", "tech", "소프트웨어", "software"], label: "기술", test: (it) => /기술|TECHNOLOGY|소프트웨어|software/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["금융", "은행", "bank", "financ"], label: "금융", test: (it) => /금융|FINANCIAL|은행|bank/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["에너지", "energy", "석유", "oil"], label: "에너지", test: (it) => /에너지|ENERGY|석유|oil/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["소비재", "소비", "consumer", "리테일", "retail", "유통"], label: "소비재", test: (it) => /소비|CONSUMER|리테일|retail|유통/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["산업재", "industrial"], label: "산업재", test: (it) => /산업재|INDUSTRIAL/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["유틸", "utilit"], label: "유틸리티", test: (it) => /유틸|UTILIT/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["부동산", "reit", "real estate"], label: "부동산", test: (it) => /부동산|REAL ESTATE|reit/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["소재", "material", "mining", "금속", "철강"], label: "소재", test: (it) => /소재|MATERIAL|금속|철강|mining/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["커뮤니케이션", "communication", "미디어", "media"], label: "커뮤니케이션", test: (it) => /커뮤니케이션|COMMUNICATION|미디어|media/i.test(`${it.industry || ""} ${it.sector || ""}`) },
  { kw: ["2차전지", "배터리", "battery"], label: "2차전지", test: (it) => /2차전지|배터리|battery/i.test(`${it.industry || ""} ${it.sector || ""} ${it.company || ""}`) },
  { kw: ["자동차", "auto"], label: "자동차", test: (it) => /자동차|auto/i.test(`${it.industry || ""} ${it.sector || ""} ${it.company || ""}`) },
];

const NL_FLAGS = [
  { kw: ["과매도", "oversold"], label: "과매도 RSI≤30", test: (it) => { const r = rsiValue(it); return r != null && r <= 30; } },
  { kw: ["과매수", "overbought"], label: "과매수 RSI≥70", test: (it) => { const r = rsiValue(it); return r != null && r >= 70; } },
  { kw: ["신고가", "new high", "고점 근접"], label: "신고가 근접", test: (it) => Number(it.newHighDistancePct) <= 2 },
  { kw: ["신저가", "저점 근접", "52주 저가"], label: "신저가 근접", test: (it) => { const d = low52DistPct(it); return Number.isFinite(d) && d <= 10; } },
  { kw: ["급등"], label: "당일 급등 ≥5%", test: (it) => Number(it.changePct) >= 5 },
  { kw: ["급락"], label: "당일 급락 ≤-5%", test: (it) => Number(it.changePct) <= -5 },
  { kw: ["대형주", "large cap", "largecap"], label: "대형주", test: (it) => Number(it.marketCapB) >= 10 },
  { kw: ["소형주", "중소형", "스몰캡", "small cap"], label: "소형주", test: (it) => isKrMarket() ? Number(it.marketCapB) < 0.1 : Number(it.marketCapB) <= 2 },
  { kw: ["주도주", "강세주", "리더", "leader"], label: "주도주 (3개월 +15%↑)", test: (it) => Number(it.threeMonthChangePct) >= 15 },
  { kw: ["저평가", "value"], label: "저평가 PER≤15", test: (it, f) => Number(f.pe) > 0 && Number(f.pe) <= 15 },
];

const NL_METRICS = [
  { keys: ["rsi"], label: "RSI", unit: "", get: (it) => rsiValue(it) ?? NaN, dir: "max" },
  { keys: ["per", "pe", "p/e", "주가수익"], label: "PER", unit: "", get: (it, f) => Number(f.pe != null ? f.pe : f.forwardPE), dir: "max" },
  { keys: ["pbr", "pb", "p/b"], label: "PBR", unit: "", get: (it, f) => Number(f.pb), dir: "max" },
  { keys: ["psr", "ps", "p/s"], label: "PSR", unit: "", get: (it, f) => Number(f.ps), dir: "max" },
  { keys: ["roe", "자기자본"], label: "ROE", unit: "%", get: (it, f) => Number(f.roe), dir: "min" },
  { keys: ["시총", "시가총액", "market cap", "marketcap"], label: "시총", unit: "B", get: (it) => itemCapForValuation(it), dir: "min", cap: true },
  { keys: ["거래량", "volume", "vol"], label: "거래량", unit: "x", get: (it) => Number(it.volumeRatio), dir: "min" },
  { keys: ["eps", "주당순이익"], label: "EPS", unit: "", get: (it) => epsTtmValue(it), dir: "min" },
  { keys: ["당일", "오늘"], label: "당일등락", unit: "%", get: (it) => Number(it.changePct), dir: "min" },
  { keys: ["1개월", "한달", "월간"], label: "1개월", unit: "%", get: (it) => Number(it.monthChangePct), dir: "min" },
  { keys: ["1주", "주간"], label: "1주", unit: "%", get: (it) => Number(it.weekChangePct), dir: "min" },
];

function nlScaleCap(v, unit) {
  const u = String(unit || "").toLowerCase();
  if (isKrMarket()) {
    if (u === "조" || u === "t") return v;
    if (u === "억") return v * 0.0001;
    return v;
  }
  if (u === "조" || u === "t") return v * 1000;
  if (u === "억") return v * 0.1;
  return v;
}

function nlDirFromText(s) {
  if (/<=|≤|이하|미만|아래|이내|under|below/.test(s)) return "max";
  if (/>=|≥|이상|초과|위|넘|over|above/.test(s)) return "min";
  if (s.includes("<")) return "max";
  if (s.includes(">")) return "min";
  return null;
}

function nlExtractMetric(text, metric) {
  for (const key of metric.keys) {
    const k = key.toLowerCase();
    let startWin = -1;
    if (/^[\x00-\x7f]+$/.test(k)) {
      const re = new RegExp("(^|[^a-z0-9])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z])", "i");
      const m = re.exec(text);
      if (m) startWin = m.index + m[0].length;
    } else {
      const i = text.indexOf(k);
      if (i >= 0) startWin = i + k.length;
    }
    if (startWin < 0) continue;
    const win = text.slice(startWin, startWin + 18);
    const m2 = win.match(/^\s*(<=|>=|≤|≥|이하|미만|이상|초과|under|below|over|above)?\s*(-?\d+(?:\.\d+)?)\s*(%|배|조|억|b|t|x)?\s*(이하|미만|이상|초과|아래|위|넘는|이내|under|below|over|above)?/i);
    if (m2 && m2[2] != null) {
      let value = parseFloat(m2[2]);
      const unit = (m2[3] || "").toLowerCase();
      if (metric.cap) value = nlScaleCap(value, unit);
      const dir = nlDirFromText(((m2[1] || "") + " " + (m2[4] || "")).trim()) || metric.dir;
      return { value, dir };
    }
  }
  return null;
}

function parseNlQuery(rawText) {
  const text = String(rawText || "").toLowerCase().trim();
  if (!text) return { conditions: [], warnings: [], error: "검색할 문장을 입력하세요." };
  const conditions = [];
  const warnings = [];
  NL_SECTORS.forEach((s) => {
    if (s.kw.some((k) => text.includes(k.toLowerCase()))) conditions.push({ label: s.label, test: s.test });
  });
  const usedLabels = new Set();
  NL_METRICS.forEach((metric) => {
    if (usedLabels.has(metric.label)) return;
    const r = nlExtractMetric(text, metric);
    if (r && Number.isFinite(r.value)) {
      usedLabels.add(metric.label);
      const get = metric.get;
      const { value, dir } = r;
      conditions.push({
        label: `${metric.label} ${dir === "max" ? "≤" : "≥"} ${value}${metric.cap && isKrMarket() ? "조" : (metric.unit || "")}`,
        sortKey: get, sortDir: dir,
        test: (it, f) => { const v = get(it, f); return Number.isFinite(v) && (dir === "max" ? v <= value : v >= value); }
      });
    }
  });
  NL_FLAGS.forEach((fl) => {
    if (fl.kw.some((k) => text.includes(k.toLowerCase()))) conditions.push({ label: fl.label, test: fl.test });
  });
  if (text.includes("배당")) warnings.push("배당 데이터가 없어 배당 조건은 검색에 반영되지 않았습니다.");
  return { conditions, warnings, error: conditions.length ? "" : "이해할 수 있는 조건을 찾지 못했어요. 아래 예시를 참고해 주세요." };
}

function runNlScreener() {
  const input = byId("nlQuery");
  const chips = byId("nlChips");
  const meta = byId("nlMeta");
  const wrap = byId("nlResultsWrap");
  const body = byId("nlResults");
  if (!input || !body || !wrap) return;
  const parsed = parseNlQuery(input.value);
  if (chips) {
    chips.innerHTML = parsed.conditions.map((c) => `<span class="nl-chip">${escapeHtml(c.label)}</span>`).join("")
      + parsed.warnings.map((w) => `<span class="nl-chip nl-chip-warn">${escapeHtml(w)}</span>`).join("");
  }
  if (parsed.error) {
    if (meta) meta.textContent = parsed.error;
    wrap.hidden = true;
    body.innerHTML = "";
    return;
  }
  const universe = (data.stocks || []).filter((s) => s && !isStockEtf(s));
  let rows = universe.filter((it) => {
    const f = mapFundamentalsFor(it.ticker) || {};
    return parsed.conditions.every((c) => c.test(it, f));
  });
  const sorter = parsed.conditions.find((c) => c.sortKey);
  if (sorter) {
    rows.sort((a, b) => {
      const av = sorter.sortKey(a, mapFundamentalsFor(a.ticker) || {});
      const bv = sorter.sortKey(b, mapFundamentalsFor(b.ticker) || {});
      const an = Number.isFinite(av) ? av : (sorter.sortDir === "max" ? Infinity : -Infinity);
      const bn = Number.isFinite(bv) ? bv : (sorter.sortDir === "max" ? Infinity : -Infinity);
      return sorter.sortDir === "max" ? an - bn : bn - an;
    });
  } else {
    rows.sort((a, b) => (rsiValue(b) ?? -Infinity) - (rsiValue(a) ?? -Infinity));
  }
  const total = rows.length;
  rows = rows.slice(0, 100);
  if (meta) meta.textContent = total ? `${total.toLocaleString()}개 종목 일치 (상위 ${rows.length}개 표시)` : "조건에 맞는 종목이 없습니다.";
  wrap.hidden = !rows.length;
  body.innerHTML = rows.map((it) => {
    const f = mapFundamentalsFor(it.ticker) || {};
    const pe = Number(f.pe != null ? f.pe : f.forwardPE);
    return `<tr>
      <td>${watchStarButton(it.ticker)}</td>
      <td><button type="button" class="ticker-link" data-ticker="${escapeHtml(it.ticker)}">${escapeHtml(stockLabel(it))}</button></td>
      <td>${escapeHtml(stockSubLabel(it))}</td>
      <td>${escapeHtml(it.sector)}</td>
      <td class="${cls(it.changePct)}">${fmtDailyPct(it.changePct)}</td>
      <td class="${cls(it.monthChangePct)}">${fmtPct(it.monthChangePct)}</td>
      <td>${fmtEps(it)}</td>
      <td>${Number.isFinite(Number(it.rsi14)) ? Math.round(Number(it.rsi14)) : "—"}</td>
      <td>${Number.isFinite(pe) ? pe.toFixed(1) : "-"}</td>
      <td>${fmtBillions(it.marketCapB)}</td>
      <td>${signalFor(it)}</td>
    </tr>`;
  }).join("");
  delegateTickerClicks(body, ".ticker-link");
}

// ===== 화면 설정 (테마 · 밀도) 토글 =====
const UI_PREFS_KEY = "mir_ui_prefs_v1";
function getUiPrefs() {
  const p = window.safeStorage.getJSON(UI_PREFS_KEY, {});
  return p && typeof p === "object" ? p : {};
}
function setUiPref(key, val) {
  const p = getUiPrefs();
  p[key] = val;
  window.safeStorage.setJSON(UI_PREFS_KEY, p);
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = byId("themeToggle");
  if (btn) {
    const dark = theme === "dark";
    btn.textContent = dark ? "라이트" : "다크";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
  }
}
function setupUiPrefs() {
  const prefs = getUiPrefs();
  const theme = prefs.theme || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
  // 밀도(컴팩트/넓게) 토글은 2026-09-04 에 제거했다. 예전 저장값이 남아 있어도 적용하지 않는다.
  document.documentElement.removeAttribute("data-density");
  byId("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setUiPref("theme", next);
    applyTheme(next);
  });
  // 로고(미르의 미국 주식 / 한국 주식) 클릭 = 처음 화면: '오늘' 탭의 첫 서브탭으로 돌아가고 맨 위로.
  const brandHome = byId("brandHome");
  if (brandHome && !brandHome.dataset.bound) {
    brandHome.dataset.bound = "1";
    const goHome = () => {
      try {
        if (typeof activateTab === "function") activateTab("today");
      } catch (_) {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    brandHome.addEventListener("click", goHome);
    brandHome.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goHome(); }
    });
  }
}

function setupNlScreener() {
  const run = byId("nlRun");
  if (!run || run.dataset.bound) return;
  run.dataset.bound = "1";
  run.addEventListener("click", runNlScreener);
  byId("nlQuery")?.addEventListener("keydown", (e) => { if (e.key === "Enter") runNlScreener(); });
  byId("nlClear")?.addEventListener("click", () => {
    const q = byId("nlQuery"); if (q) q.value = "";
    if (byId("nlChips")) byId("nlChips").innerHTML = "";
    if (byId("nlResults")) byId("nlResults").innerHTML = "";
    if (byId("nlResultsWrap")) byId("nlResultsWrap").hidden = true;
    if (byId("nlMeta")) byId("nlMeta").textContent = "문장을 입력하고 검색을 눌러보세요.";
  });
  const ex = byId("nlExamples");
  if (ex) {
    ex.innerHTML = NL_EXAMPLES.map((q) => `<button type="button" class="nl-example" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("");
    ex.querySelectorAll(".nl-example").forEach((b) => b.addEventListener("click", () => {
      const q = byId("nlQuery"); if (q) q.value = b.dataset.q; runNlScreener();
    }));
  }
}

async function scanPatternsForScreener(candidates) {
  if (!window.MirProb) return;
  await window.MirProb.ensureStats();
  // 최대 80개 상세 JSON — 순차 await 는 수십 초가 걸린다. runDeepScan 과 같은
  // 방식으로 동시 6개 펌프를 돌려 병렬화한다.
  const queue = candidates.slice(0, 80).filter((item) => !patternScreenerCache.has(item.ticker));
  const CONCURRENCY = 6;
  let idx = 0, active = 0, done = 0;
  const scanOne = async (item) => {
    try {
      const res = await fetch((window.MirMarket && window.MirMarket.detailPath(item.ticker)) || `data/details/${encodeURIComponent(item.ticker)}.json`, { cache: "no-cache" });
      if (!res.ok) return;
      const detail = await res.json();
      const rows = (detail.chartSeries || []).map((r) => ({ o: r[0], h: r[1], l: r[2], c: r[3], v: r[4] || 0, d: r[5] }));
      const cur = window.MirProb.detectCurrentPatterns(rows);
      patternScreenerCache.set(item.ticker, cur.map((p) => p.pattern));
    } catch (e) { /* skip */ }
  };
  await new Promise((resolve) => {
    const pump = () => {
      if (done >= queue.length) return resolve();
      while (active < CONCURRENCY && idx < queue.length) {
        const item = queue[idx++];
        active++;
        scanOne(item).finally(() => {
          active--; done++;
          pump();
        });
      }
    };
    pump();
  });
}

function setupScreenerEvents() {
  loadSavedScreeners();
  renderSavedScreenerPicker();
  renderSavedScreenerDelta(null);
  const run = async (trackSaved = false) => {
    const patternCat = byId("scrPattern")?.value || "any";
    if (patternCat !== "any") {
      const meta = byId("screenerMeta");
      if (meta) meta.textContent = "패턴 스캔 중… (최대 80종목)";
      const pre = data.stocks
        .filter((item) => !isStockEtf(item))
        .filter((item) => bucketMatches(item, item.groups || [item.bucket].filter(Boolean), byId("scrBucket")?.value || marketCfg().defaultBucket || "idx_sp500"))
        .slice(0, 120);
      await scanPatternsForScreener(pre);
    }
    renderScreener({ trackSaved });
  };
  ["scrBucket", "scrSector", "scrMetric", "scrLimit", "scrPattern"].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener("change", () => {
      if (!applyingSavedScreener) { selectedSavedScreenerId = ""; renderSavedScreenerPicker(); renderSavedScreenerDelta(null); }
      run(false);
    });
  });
  const preset = byId("scrPreset");
  if (preset) preset.addEventListener("change", () => {
    const key = preset.value;
    const p = TOP_PRESETS[key];
    if (p) {
      byId("scrMetric").value = p.metric;
      byId(scrRsiMinId()).value = p.minRsi || "";
      byId(scrRsiMaxId()).value = p.maxRsi || "";
      byId("scrMinVol").value = p.minVolume || "";
      byId("scrMinCap").value = presetMinMarketCap(key) || "";
    }
    if (!applyingSavedScreener) { selectedSavedScreenerId = ""; renderSavedScreenerPicker(); renderSavedScreenerDelta(null); }
    run(false);
  });
  const btn = byId("scrRun");
  if (btn) btn.addEventListener("click", () => run(true));
  const reset = byId("scrReset");
  if (reset) reset.addEventListener("click", () => {
    byId("scrPreset").value = "custom";
    byId("scrBucket").value = marketCfg().defaultBucket || "idx_sp500";
    byId("scrSector").value = "All";
    byId("scrMetric").value = "rsi14";
    [scrRsiMinId(), scrRsiMaxId(), "scrMinVol", "scrMinCap"].forEach((id) => { const el = byId(id); if (el) el.value = ""; });
    selectedSavedScreenerId = "";
    renderSavedScreenerPicker();
    renderSavedScreenerDelta(null);
    run(false);
  });
  [scrRsiMinId(), scrRsiMaxId(), "scrMinVol", "scrMinCap"].forEach((id) => byId(id)?.addEventListener("change", () => {
    if (!applyingSavedScreener) { selectedSavedScreenerId = ""; renderSavedScreenerPicker(); renderSavedScreenerDelta(null); }
  }));
  byId("savedScreenerSelect")?.addEventListener("change", (event) => {
    selectedSavedScreenerId = event.target.value;
    const record = savedScreenerById();
    const input = byId("savedScreenerName");
    if (input) input.value = record?.name || "";
    if (record) { applyScreenerConfig(record.config); renderScreener({ trackSaved: true }); }
    else renderSavedScreenerDelta(null);
    renderSavedScreenerPicker();
  });
  byId("savedScreenerSave")?.addEventListener("click", saveCurrentScreener);
  byId("savedScreenerDelete")?.addEventListener("click", deleteSelectedScreener);
}

// ===== 종목 비교 =====
const COMPARE_METRICS = [
  ["가격", (i) => priceOrDash(i.price)],
  ["당일", (i) => fmtDailyPct(i.changePct), (i) => cls(i.changePct)],
  ["1주", (i) => fmtPct(i.weekChangePct), (i) => cls(i.weekChangePct)],
  ["1개월", (i) => fmtPct(i.monthChangePct), (i) => cls(i.monthChangePct)],
  ["3개월", (i) => fmtPct(i.threeMonthChangePct), (i) => cls(i.threeMonthChangePct)],
  ["RSI", (i) => fmtRsi(i)],
  ["EPS", (i) => fmtEps(i)],
  ["거래량", (i) => `${Number(i.volumeRatio || 0).toFixed(1)}x`],
  ["시총", (i) => fmtBillions(i.marketCapB)],
  ["신고가 거리", (i) => fmtPct(-i.newHighDistancePct)],
  ["PER", (i) => fmtMultiple(i.fundamentals?.pe)],
  ["Fwd PER", (i) => fmtMultiple(i.fundamentals?.forwardPE)],
  ["P/S", (i) => fmtMultiple(i.fundamentals?.ps)],
  ["P/B", (i) => fmtMultiple(i.fundamentals?.pb)],
  ["섹터", (i) => i.sector],
  ["신호", (i) => signalFor(i)],
];

function compareTickersFromInput() {
  const raw = byId("compareInput")?.value || "";
  return resolveTickerListInput(raw).slice(0, 6);
}

function renderCompareBoard() {
  const table = byId("compareBoard");
  if (!table) return;
  const tickers = compareTickersFromInput();
  if (!tickers.length) {
    table.innerHTML = `<tr><td class="muted">비교할 티커를 입력하세요. (최대 6개)</td></tr>`;
    return;
  }
  const items = tickers.map((t) => withDetail(stockByTicker(t))).filter(Boolean);
  let html = `<thead><tr><th>지표</th>${items.map((i) => `<th><button type="button" class="ticker-link" data-ticker="${escapeHtml(i.ticker)}">${escapeHtml(i.ticker)}</button><div class="muted" style="font-size:var(--fs-cap);font-weight:400">${escapeHtml(i.company || i.name || "")}</div></th>`).join("")}</tr></thead><tbody>`;
  COMPARE_METRICS.forEach(([label, fmt, toneFn]) => {
    html += `<tr><td class="metric-label">${label}</td>${items.map((item) => {
      const tone = toneFn ? toneFn(item) : "";
      return `<td${tone ? ` class="${tone}"` : ""}>${fmt(item)}</td>`;
    }).join("")}</tr>`;
  });
  html += "</tbody>";
  table.innerHTML = html;
  delegateTickerClicks(table, ".ticker-link");
  tickers.forEach((t) => {
    const key = safeTicker(t);
    if (detailCache[key]) return;
    loadStockDetail(t).then((detail) => {
      if (!detail) return;
      if (compareTickersFromInput().join() === tickers.join()) renderCompareBoard();
    });
  });
}

function setupCompareEvents() {
  const run = () => renderCompareBoard();
  byId("compareRun")?.addEventListener("click", run);
  byId("compareFromWatchlist")?.addEventListener("click", () => {
    const input = byId("compareInput");
    if (input) input.value = watchlist.slice(0, 6).join(", ");
    run();
  });
  const input = byId("compareInput");
  if (input && !input.value) input.value = watchlist.slice(0, 4).join(", ");
}
