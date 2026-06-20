// =============================================================================
// Mir US Stocks — Yahoo Finance live proxy (Cloudflare Worker)
//
// GitHub Pages is static, so it cannot run Python when a visitor opens a page.
// This tiny Worker runs on Cloudflare's free tier and fetches Yahoo Finance news
// (and the real price chart) on demand, returning JSON with CORS headers so the
// static site can call it from the browser when the stock-analysis page opens.
//
// Endpoint:  GET https://<your-worker>.workers.dev/?ticker=NVDA
// Response:  { "ticker": "NVDA", "news": [...], "chart": [[o,h,l,c,v], ...], "summary": "..." }
//
// Deploy (one time, free):
//   1) https://dash.cloudflare.com  ->  Workers & Pages  ->  Create  ->  Worker
//   2) Replace the template code with this file, click Deploy.
//   3) Add the Workers AI binding so Korean summaries work (free allocation):
//      Worker -> Settings -> Bindings -> Add -> Workers AI -> Variable name: AI -> Deploy.
//   4) Copy the deployed URL (e.g. https://mir-yahoo.<name>.workers.dev).
//   5) Put that URL into app.js -> LIVE_DATA_PROXY.
// (Optional) restrict ALLOW_ORIGIN below to your site for a little extra safety.
// =============================================================================

const ALLOW_ORIGIN = "*"; // e.g. "https://seonu-dragon.github.io"
const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
// Workers AI text models tried in order for the Korean summary (first that works wins).
// Larger / newer models follow Korean instructions far better than the small ones.
const SUMMARY_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
];
// Chatbot models. On the Workers Paid plan we use the large 70B model for far
// better Korean answers (24B as fallback). On the free plan switch these back to
// "@cf/meta/llama-3.1-8b-instruct" to stay within the daily neuron budget.
const CHAT_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);

    // Site help chatbot (POST /chat): explains how to use the site + finance terms.
    if (request.method === "POST" && url.pathname === "/chat") {
      return cors(await handleChat(request, env));
    }

    // Shared community board (KV binding COMMUNITY_KV required).
    if (url.pathname === "/community") {
      if (request.method === "GET") return cors(await handleCommunityList(url, env));
      if (request.method === "POST") return cors(await handleCommunityCreate(request, env));
      if (request.method === "DELETE") return cors(await handleCommunityDelete(request, env));
    }
    if (url.pathname === "/community/comment") {
      if (request.method === "POST") return cors(await handleCommunityCommentCreate(request, env));
      if (request.method === "DELETE") return cors(await handleCommunityCommentDelete(request, env));
    }
    if (request.method === "POST" && url.pathname === "/community/like") {
      return cors(await handleCommunityLike(request, env));
    }
    if (request.method === "POST" && url.pathname === "/community/report") {
      return cors(await handleCommunityReport(request, env));
    }
    if (request.method === "GET" && url.pathname === "/community/reports") {
      return cors(await handleCommunityReportsList(url, env));
    }
    if (request.method === "POST" && url.pathname === "/community/vote") {
      return cors(await handleCommunityVote(request, env));
    }
    if (request.method === "GET" && url.pathname === "/community/votes") {
      return cors(await handleCommunityVotesList(url, env));
    }
    if (request.method === "POST" && url.pathname === "/community/clear") {
      return cors(await handleCommunityClear(request, env));
    }

    // Live FX rates (incl. USD/KRW) for the 마켓 데이터 tab + top header.
    if (url.searchParams.get("fx")) {
      return cors(json({ fx: await fetchFx() }));
    }
    // CNN Fear & Greed index for the top header gauge.
    if (url.searchParams.get("fng")) {
      return cors(json({ fng: await fetchFng() }));
    }
    // Intraday index mini-charts (Finviz-style strip).
    if (url.searchParams.get("indices")) {
      return cors(json({ indices: await fetchIndices() }));
    }
    // Economic calendar (Korea + US) via investing.com XHR endpoint.
    if (url.searchParams.get("calendar")) {
      return cors(json({ calendar: await fetchCalendar() }));
    }
    // Batch earnings dates for market-wide calendar tab.
    if (url.searchParams.get("earnings_calendar")) {
      const raw = (url.searchParams.get("tickers") || "")
        .toUpperCase()
        .split(",")
        .map((t) => t.trim().replace(/[^A-Z0-9.\-]/g, ""))
        .filter(Boolean)
        .slice(0, 60);
      const earnings = await fetchEarningsCalendar(raw);
      return cors(json({ earnings }));
    }

    const ticker = (url.searchParams.get("ticker") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9.\-]/g, "");
    if (!ticker) return cors(json({ error: "missing ticker" }, 400));

    const symbol = ticker.replace(/\./g, "-"); // Yahoo uses BRK-B style
    // Price-event analysis is intentionally opt-in: the static site calls this
    // only after the visitor clicks "원인 분석" on a recent price event.
    if (url.searchParams.get("move_analysis")) {
      const eventDate = String(url.searchParams.get("date") || "").slice(0, 10);
      const eventChange = Number(url.searchParams.get("change") || 0);
      const company = String(url.searchParams.get("company") || ticker).replace(/[<>]/g, "").slice(0, 120);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return cors(json({ error: "invalid date" }, 400));
      const cacheKey = `move:v3:${ticker}:${eventDate}`;
      if (env && env.MOVE_CACHE) {
        const cached = await env.MOVE_CACHE.get(cacheKey, "json");
        if (cached && cached.analysis) return cors(json({ ...cached, cached: true }, 200, 2592000));
      }
      const [newsResult, chart, spyChart, qqqChart] = await Promise.all([
        fetchHistoricalNews(env, ticker, company, eventDate),
        fetchChart(symbol),
        fetchChart("SPY"),
        fetchChart("QQQ"),
      ]);
      const marketContext = {
        SPY: chartMoveContext(spyChart, eventDate),
        QQQ: chartMoveContext(qqqChart, eventDate),
      };
      const modelOverride = url.searchParams.get("model");
      const confidence = evidenceConfidence(newsResult.news, eventDate);
      const { text: analysis, error: analysisError, model: analysisModel } =
        await summarizeMoveAnalysisKorean(env, ticker, company, eventDate, eventChange, newsResult.news, chart, marketContext, confidence, modelOverride);
      const payload = {
        ticker,
        company,
        date: eventDate,
        changePct: eventChange,
        chartContext: chartMoveContext(chart, eventDate),
        marketContext,
        analysis,
        analysisError,
        analysisModel,
        confidence,
        sources: newsResult.news.slice(0, 6),
        newsProviders: newsResult.providers,
        searchWindowDays: newsResult.windowDays,
      };
      if (analysis && env && env.MOVE_CACHE) {
        await env.MOVE_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 2592000 });
      }
      return cors(json(payload, 200, analysis ? 2592000 : 900));
    }

    const [news, chart, earnings] = await Promise.all([fetchNews(symbol), fetchChart(symbol), fetchEarnings(symbol)]);
    // Optional ?model=... overrides the model list (for quick A/B testing).
    const modelOverride = url.searchParams.get("model");
    const { text: summary, error: summaryError, model: summaryModel } =
      await summarizeKorean(env, ticker, news, modelOverride);
    return cors(json({ ticker, news, chart, earnings, summary, summaryError, summaryModel }));
  },
};

function chartMoveContext(chart, eventDate) {
  if (!Array.isArray(chart) || !eventDate) return null;
  const idx = chart.findIndex((row) => row && row[5] === eventDate);
  if (idx < 0) return null;
  const row = chart[idx];
  const prev = chart[Math.max(0, idx - 1)];
  const prevClose = Number(prev && prev[3]);
  const close = Number(row[3]);
  const volume = Number(row[4] || 0);
  const start = Math.max(0, idx - 20);
  const sample = chart.slice(start, idx).map((r) => Number(r && r[4])).filter((v) => Number.isFinite(v) && v > 0);
  const avgVolume = sample.length ? sample.reduce((sum, value) => sum + value, 0) / sample.length : null;
  return {
    date: eventDate,
    open: row[0],
    high: row[1],
    low: row[2],
    close: row[3],
    prevClose: Number.isFinite(prevClose) ? prevClose : null,
    changePct: Number.isFinite(close) && Number.isFinite(prevClose) && prevClose ? round((close / prevClose - 1) * 100) : null,
    volume,
    volumeRatio20d: avgVolume ? round(volume / avgVolume) : null,
  };
}

function shiftIsoDate(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateDistanceDays(a, b) {
  const da = new Date(`${a}T12:00:00Z`);
  const db = new Date(`${b}T12:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 999;
  return Math.abs((da - db) / 86400000);
}

function normalizeGdeltDate(value) {
  const raw = String(value || "");
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : raw.slice(0, 10);
}

function newsIdentity(news) {
  return String(news.title || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();
}

function rankHistoricalNews(news, ticker, company, eventDate) {
  const trusted = /reuters|apnews|bloomberg|cnbc|wsj|ft\.com|marketwatch|barrons|investors\.com|sec\.gov/i;
  const terms = [ticker, ...String(company || "").split(/\s+/)].filter((term) => term.length >= 3);
  const seen = new Set();
  return (news || [])
    .filter((item) => item && item.title && item.link && /^https?:\/\//i.test(item.link))
    .map((item) => {
      const key = newsIdentity(item);
      const distance = dateDistanceDays(item.publishedAt, eventDate);
      const haystack = `${item.title} ${item.summary || ""}`.toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term.toLowerCase())).length;
      const score = 100 - distance * 12 + matches * 9 + (trusted.test(`${item.publisher} ${item.link}`) ? 12 : 0) + (item.summary ? 4 : 0);
      return { ...item, distanceDays: distance, score };
    })
    .filter((item) => item.distanceDays <= 8 && item.score > 20)
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = newsIdentity(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map(({ score, distanceDays, ...item }) => ({ ...item, distanceDays }));
}

async function fetchFinnhubNews(env, ticker, from, to) {
  const token = env && env.FINNHUB_API_KEY;
  if (!token) return [];
  try {
    const endpoint = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${encodeURIComponent(token)}`;
    const response = await fetch(endpoint, { headers: UA });
    if (!response.ok) return [];
    const rows = await response.json();
    return (Array.isArray(rows) ? rows : []).map((item) => ({
      title: item.headline || "",
      summary: item.summary || "",
      publisher: item.source || "Finnhub",
      link: item.url || "",
      publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString().slice(0, 10) : "",
      provider: "Finnhub",
    }));
  } catch (error) {
    return [];
  }
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function rssTag(block, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  return decodeXmlText(match ? match[1] : "");
}

function parseGoogleNewsRss(xml) {
  const items = String(xml || "").match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 50).map((block) => ({
    title: rssTag(block, "title"),
    summary: "",
    publisher: rssTag(block, "source") || "Google News",
    link: rssTag(block, "link") || rssTag(block, "guid"),
    publishedAt: (() => {
      const date = new Date(rssTag(block, "pubDate"));
      return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    })(),
    provider: "Google News",
  })).filter((item) => item.title && item.link);
}

async function fetchGoogleNewsRss(ticker, company, from, to) {
  try {
    const companyTerm = String(company || "").trim();
    const identity = companyTerm && companyTerm.toUpperCase() !== ticker
      ? `(\"${companyTerm}\" OR \"${ticker}\")`
      : `\"${ticker}\"`;
    const after = shiftIsoDate(from, -1);
    const before = shiftIsoDate(to, 1);
    const query = `${identity} stock after:${after} before:${before}`;
    const endpoint = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(endpoint, { headers: { ...UA, Accept: "application/rss+xml, application/xml, text/xml" } });
    if (!response.ok) return [];
    return parseGoogleNewsRss(await response.text());
  } catch (error) {
    return [];
  }
}
async function fetchGdeltNews(ticker, company, from, to) {
  try {
    const companyTerm = String(company || "").trim();
    const query = companyTerm && companyTerm.toUpperCase() !== ticker
      ? `\"${companyTerm}\" OR \"${ticker}\"`
      : `\"${ticker}\"`;
    const startdatetime = `${from.replace(/-/g, "")}000000`;
    const enddatetime = `${to.replace(/-/g, "")}235959`;
    const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=75&format=json&sort=HybridRel&startdatetime=${startdatetime}&enddatetime=${enddatetime}`;
    const response = await fetch(endpoint, { headers: UA });
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.articles || []).map((item) => ({
      title: item.title || "",
      summary: "",
      publisher: item.domain || item.sourcecountry || "GDELT",
      link: item.url || "",
      publishedAt: normalizeGdeltDate(item.seendate),
      provider: "GDELT",
    }));
  } catch (error) {
    return [];
  }
}

async function historicalNewsWindow(env, ticker, company, eventDate, days) {
  const from = shiftIsoDate(eventDate, -days);
  const to = shiftIsoDate(eventDate, days);
  const [finnhub, googleNews] = await Promise.all([
    fetchFinnhubNews(env, ticker, from, to),
    fetchGoogleNewsRss(ticker, company, from, to),
  ]);
  let ranked = rankHistoricalNews([...finnhub, ...googleNews], ticker, company, eventDate);
  if (ranked.length < 3) {
    const gdelt = await fetchGdeltNews(ticker, company, from, to);
    ranked = rankHistoricalNews([...ranked, ...gdelt], ticker, company, eventDate);
  }
  return ranked;
}

async function fetchHistoricalNews(env, ticker, company, eventDate) {
  let windowDays = 2;
  let news = await historicalNewsWindow(env, ticker, company, eventDate, windowDays);
  if (news.length < 3) {
    windowDays = 7;
    news = await historicalNewsWindow(env, ticker, company, eventDate, windowDays);
  }
  const yahoo = await fetchNews(ticker);
  news = rankHistoricalNews([...news, ...yahoo.map((item) => ({ ...item, provider: "Yahoo" }))], ticker, company, eventDate);
  const providers = [...new Set(news.map((item) => item.provider).filter(Boolean))];
  return { news, providers, windowDays };
}

function evidenceConfidence(news, eventDate) {
  const close = (news || []).filter((item) => dateDistanceDays(item.publishedAt, eventDate) <= 2);
  if (close.length >= 3) return "높음";
  if (close.length >= 1 || (news || []).length >= 3) return "보통";
  return "낮음";
}

async function summarizeMoveAnalysisKorean(env, ticker, company, eventDate, eventChange, news, chart, marketContext, confidence, modelOverride) {
  if (!env || !env.AI) return { text: "", error: "no_ai_binding" };
  const context = chartMoveContext(chart, eventDate);
  const headlines = (news || []).length
    ? news.slice(0, 10).map((item, index) => {
      const summary = item.summary ? ` | 요약: ${item.summary.slice(0, 500)}` : "";
      return `${index + 1}. ${item.publishedAt || "날짜 없음"} | ${item.publisher || item.provider || "출처 없음"} | ${item.title}${summary}`;
    }).join("\n")
    : "해당 날짜 전후로 검색된 관련 뉴스 없음";
  const chartText = context
    ? `종목: 시가 ${context.open}, 고가 ${context.high}, 저가 ${context.low}, 종가 ${context.close}, 전일 종가 ${context.prevClose ?? "없음"}, 등락률 ${context.changePct ?? eventChange}%, 20일 평균 대비 거래량 ${context.volumeRatio20d ?? "계산 불가"}배`
    : `종목 차트에서 ${eventDate}를 찾지 못했습니다. 전달 등락률은 ${eventChange}%입니다.`;
  const marketText = ["SPY", "QQQ"].map((symbol) => {
    const row = marketContext && marketContext[symbol];
    return row ? `${symbol} ${row.changePct}%` : `${symbol} 데이터 없음`;
  }).join(", ");
  const prompt =
    `미국 주식 ${ticker}(${company})의 ${eventDate} 가격 이벤트 원인을 분석하세요.\n\n` +
    `[가격/거래량]\n${chartText}\n시장 비교: ${marketText}\n\n` +
    `[날짜 기준 검색 뉴스]\n${headlines}\n\n` +
    `검색 근거 신뢰도: ${confidence}\n\n` +
    `작성 규칙:\n` +
    `- 가장 가능성이 높은 촉매를 첫 문장에 제시하고, 근거가 된 매체명과 날짜를 문장 안에 포함하세요.\n` +
    `- 종목 고유 뉴스와 SPY·QQQ 등 시장 전체 움직임을 구분하세요.\n` +
    `- 직접 확인된 사실과 가능성 수준의 해석을 분리하고, 제공되지 않은 사실은 만들지 마세요.\n` +
    `- 관련 뉴스가 없을 때만 원인 불명확이라고 말하세요. 관련 헤드라인이 있으면 핵심 재료부터 설명하세요.\n` +
    `- 4~6문장의 자연스러운 한국어 단락 하나로 작성하고 매수·매도 조언은 하지 마세요.`;
  const models = modelOverride ? [modelOverride] : SUMMARY_MODELS;
  let lastError = "no_model";
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "You are a careful US stock event analyst. Identify the strongest dated catalyst from supplied evidence, compare it with the broad market, answer only in Korean, and never invent facts." },
          { role: "user", content: prompt },
        ],
        max_tokens: 700,
        temperature: 0.2,
      });
      const text = String((result && result.response) || "").trim();
      if (text) return { text, error: "", model };
      lastError = `empty_response:${model}`;
    } catch (error) {
      lastError = `${model}: ${(error && error.message) || error}`;
    }
  }
  return { text: "", error: lastError };
}
async function summarizeKorean(env, ticker, news, modelOverride) {
  if (!env || !env.AI) return { text: "", error: "no_ai_binding" };
  if (!news || !news.length) return { text: "", error: "no_news" };
  const models = modelOverride ? [modelOverride] : SUMMARY_MODELS;
  const headlines = news
    .slice(0, 8)
    .map((n, i) => `${i + 1}. ${n.title}${n.publisher ? ` (${n.publisher})` : ""}`)
    .join("\n");
  const prompt =
    `미국 주식 ${ticker}의 최신 뉴스 헤드라인:\n\n${headlines}\n\n` +
    `위 헤드라인들을 종합해서 핵심 흐름을 한국어 3~4문장의 자연스러운 단락 하나로 요약하세요.\n` +
    `규칙:\n` +
    `- 헤드라인을 하나씩 번역하거나 번호로 나열하지 마세요. 반드시 하나의 단락으로 종합하세요.\n` +
    `- 회사명, 제품명, 매체명 등 고유명사는 영어 원문 그대로 두세요(억지로 음역하지 마세요).\n` +
    `- 투자 조언은 하지 말고 사실 위주로 쓰세요.\n` +
    `- 한국어 단락만 출력하고 다른 말은 덧붙이지 마세요.`;
  let lastError = "no_model";
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "You are a financial news summarizer. Synthesize the headlines into ONE natural Korean paragraph (3-4 sentences). Never translate or list headlines one by one. Keep proper nouns in English." },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.3,
      });
      const text = String((result && result.response) || "").trim();
      if (text) return { text, error: "", model };
      lastError = `empty_response:${model}`;
    } catch (e) {
      lastError = `${model}: ${(e && e.message) || e}`;
    }
  }
  return { text: "", error: lastError };
}

async function fetchNews(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}` +
        `&newsCount=8&quotesCount=0&enableFuzzyQuery=false`,
      { headers: UA }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.news || [])
      .slice(0, 8)
      .map((n) => ({
        title: n.title || "",
        publisher: n.publisher || "",
        link: n.link || "",
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toISOString().slice(0, 10)
          : "",
      }))
      .filter((n) => n.title && n.link);
  } catch (e) {
    return [];
  }
}

async function fetchEarnings(symbol) {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,earningsHistory,defaultKeyStatistics`,
      { headers: UA }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const result = (data && data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result[0]) || {};
    const cal = (result.calendarEvents && result.calendarEvents.earnings) || {};
    const dates = (cal.earningsDate || [])
      .map((ts) => {
        const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      })
      .filter(Boolean);
    const epsEstimate = cal.epsEstimate && cal.epsEstimate.raw != null
      ? cal.epsEstimate.raw
      : (cal.epsEstimate != null ? cal.epsEstimate : null);
    const history = ((result.earningsHistory && result.earningsHistory.history) || [])
      .slice(0, 8)
      .map((row) => {
        const quarter = (row.quarter && row.quarter.fmt) || row.period || "";
        let date = "";
        if (row.quarter && row.quarter.raw != null) {
          const d = new Date(row.quarter.raw * 1000);
          date = Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
        } else if (/^\d{4}-\d{2}-\d{2}/.test(quarter)) {
          date = quarter.slice(0, 10);
        }
        return {
          date,
          quarter,
          epsActual: row.epsActual && row.epsActual.raw != null ? row.epsActual.raw : null,
          epsEstimate: row.epsEstimate && row.epsEstimate.raw != null ? row.epsEstimate.raw : null,
          surprisePct: row.surprisePercent && row.surprisePercent.raw != null ? row.surprisePercent.raw : null,
        };
      });
    return {
      nextDate: dates[0] || null,
      dates,
      epsEstimate,
      history,
    };
  } catch (e) {
    return null;
  }
}

async function fetchEarningsCalendar(tickers) {
  const out = [];
  const batchSize = 8;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const chunk = await Promise.all(batch.map(async (ticker) => {
      const symbol = ticker.replace(/\./g, "-");
      const data = await fetchEarnings(symbol);
      if (!data || !data.nextDate) return null;
      return { ticker, nextDate: data.nextDate, epsEstimate: data.epsEstimate };
    }));
    chunk.filter(Boolean).forEach((row) => out.push(row));
  }
  out.sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)));
  return out;
}

async function fetchChart(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?range=5y&interval=1d`,
      { headers: UA }
    );
    if (!r.ok) return [];
    const data = await r.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) return [];
    const ts = result.timestamp || [];
    const q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    const out = [];
    for (let i = 0; i < ts.length; i += 1) {
      const c = q.close ? q.close[i] : null;
      if (c == null) continue;
      out.push([
        round(q.open && q.open[i] != null ? q.open[i] : c),
        round(q.high && q.high[i] != null ? q.high[i] : c),
        round(q.low && q.low[i] != null ? q.low[i] : c),
        round(c),
        Math.round((q.volume && q.volume[i]) || 0),
        new Date(ts[i] * 1000).toISOString().slice(0, 10), // YYYY-MM-DD for the x-axis
      ]);
    }
    return out;
  } catch (e) {
    return [];
  }
}

const round = (v) => Math.round(Number(v) * 100) / 100;

// Economic calendar for Korea (id 11) + US (id 5), KST (timeZone 88).
// 이번 주 + 다음 주를 함께 가져와 합쳐서 다음 주 일정까지 표시.
async function fetchCalendarTab(tab) {
  try {
    const r = await fetch("https://kr.investing.com/economic-calendar/Service/getCalendarFilteredData", {
      method: "POST",
      headers: {
        ...UA,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://kr.investing.com/economic-calendar/",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
      body: `country%5B%5D=5&country%5B%5D=11&timeZone=88&timeFilter=timeRemain&currentTab=${tab}&limit_from=0`,
    });
    if (!r.ok) return [];
    const payload = await r.json();
    return parseCalendar(payload && payload.data ? String(payload.data) : "");
  } catch (e) {
    return [];
  }
}

async function fetchCalendar() {
  const [thisWeek, nextWeek] = await Promise.all([
    fetchCalendarTab("thisWeek"),
    fetchCalendarTab("nextWeek"),
  ]);
  const seen = new Set();
  return [...thisWeek, ...nextWeek].filter((ev) => {
    const key = `${ev.datetime || ev.day || ""}|${ev.event || ""}|${ev.country || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseCalendar(htmlStr) {
  const events = [];
  let day = "";
  const stripTags = (s) => (s == null ? "" : s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(htmlStr)) !== null) {
    const row = m[0];
    const dayM = /class="theDay"[^>]*>([^<]+)</.exec(row);
    if (dayM) { day = dayM[1].trim(); continue; }
    if (!/js-event-item/.test(row)) continue;
    const datetime = (/data-event-datetime="([^"]+)"/.exec(row) || [])[1] || "";
    const time = ((/class="first left time[^"]*"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1] || "").replace(/<[^>]+>/g, "").trim();
    const isKR = /South_Korea/.test(row);
    const isUS = /United_States/.test(row);
    const country = isKR ? "한국" : (isUS ? "미국" : "");
    const currency = isKR ? "KRW" : (isUS ? "USD" : "");
    const importance = (row.match(/grayFullBullishIcon/g) || []).length;
    const eventRaw = (/class="left event"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1] || "";
    const event = stripTags(eventRaw).replace(/\s+/g, " ").trim();
    const actual = stripTags((/id="eventActual_\d+"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1]);
    const forecast = stripTags((/id="eventForecast_\d+"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1]);
    const previous = stripTags((/id="eventPrevious_\d+"[^>]*>([\s\S]*?)<\/td>/.exec(row) || [])[1]);
    if (!event) continue;
    events.push({ day, time, datetime, country, currency, importance, event, actual, forecast, previous });
  }
  return events;
}

// Live FX pairs (Yahoo symbols). KRW=X is USD/KRW, etc.
const FX_LIST = [
  ["KRW=X", "원/달러 (USD/KRW)"],
  ["EURUSD=X", "유로/달러 (EUR/USD)"],
  ["JPY=X", "엔/달러 (USD/JPY)"],
  ["CNY=X", "위안/달러 (USD/CNY)"],
  ["GBPUSD=X", "파운드/달러 (GBP/USD)"],
  ["EURKRW=X", "원/유로 (EUR/KRW)"],
  ["JPYKRW=X", "원/엔 (JPY/KRW)"],
  ["DX-Y.NYB", "달러 인덱스 (DXY)"],
  ["GC=F", "금 (Gold, $/oz)"],
  ["^TNX", "미국채 10년 (%)"],
  ["^TYX", "미국채 30년 (%)"],
];

// CNN Fear & Greed index (server-side fetch avoids browser CORS).
async function fetchFng() {
  try {
    const r = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        ...UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://edition.cnn.com/markets/fear-and-greed",
        Origin: "https://edition.cnn.com",
      },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const fg = data && data.fear_and_greed;
    if (!fg || fg.score == null) return null;
    return {
      score: Math.round(Number(fg.score)),
      rawScore: Number(fg.score),
      rating: String(fg.rating || ""),
      timestamp: fg.timestamp || null,
      previousClose: fg.previous_close == null ? null : Number(fg.previous_close),
      source: "CNN",
    };
  } catch (e) {
    return null;
  }
}

// Intraday (1d / 5m) mini-series for major indices.
const INDEX_LIST = [
  ["^DJI", "Dow Jones"],
  ["^IXIC", "Nasdaq"],
  ["^GSPC", "S&P 500"],
  ["^RUT", "Russell 2000"],
  ["^KS11", "KOSPI"],
  ["^KQ11", "KOSDAQ"],
  ["BTC-USD", "Bitcoin"],
  ["ETH-USD", "Ethereum"],
];

// Yahoo's chartPreviousClose for the Korean indices (^KS11/^KQ11) is frequently
// stale by a session (and even varies by requested range), which roughly doubles
// the reported % change. For these symbols we derive the true prior-session close
// from the daily candle series instead.
const KR_INDICES = new Set(["^KS11", "^KQ11"]);

async function fetchPrevDailyClose(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=7d&interval=1d`,
      { headers: UA }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const res = data && data.chart && data.chart.result && data.chart.result[0];
    if (!res) return null;
    const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    const closes = (q.close || []).filter((v) => v != null);
    if (closes.length < 2) return null;
    // The last daily candle is the current (live) session; the one before it is
    // the true previous-session close.
    return closes[closes.length - 2];
  } catch (e) {
    return null;
  }
}

async function fetchIndices() {
  const out = [];
  await Promise.all(INDEX_LIST.map(async ([symbol, name]) => {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
        { headers: UA }
      );
      if (!r.ok) return;
      const data = await r.json();
      const res = data && data.chart && data.chart.result && data.chart.result[0];
      if (!res) return;
      const meta = res.meta || {};
      const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
      const closes = (q.close || []).filter((v) => v != null);
      const price = closes.length ? closes[closes.length - 1] : meta.regularMarketPrice;
      let prevClose = meta.chartPreviousClose || meta.previousClose || (closes.length ? closes[0] : null);
      if (KR_INDICES.has(symbol)) {
        const krPrev = await fetchPrevDailyClose(symbol);
        if (krPrev) prevClose = krPrev;
      }
      const changePct = (price != null && prevClose) ? (price / prevClose - 1) * 100 : 0;
      out.push({
        symbol,
        name,
        price: round(price),
        changePct: Math.round(changePct * 100) / 100,
        series: closes.map(round),
      });
    } catch (e) {
      /* skip */
    }
  }));
  const order = INDEX_LIST.map((i) => i[0]);
  out.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
  return out;
}

async function fetchFx() {
  const out = [];
  await Promise.all(FX_LIST.map(async ([symbol, name]) => {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
        { headers: UA }
      );
      if (!r.ok) return;
      const data = await r.json();
      const result = data && data.chart && data.chart.result && data.chart.result[0];
      if (!result) return;
      const q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
      const closes = (q.close || []).filter((v) => v != null);
      if (closes.length < 2) return;
      const price = closes[closes.length - 1];
      const prev = closes[closes.length - 2];
      const monthBase = closes[0];
      out.push({
        symbol,
        name,
        price: Math.round(price * 10000) / 10000,
        changePct: Math.round((price / prev - 1) * 10000) / 100,
        monthChangePct: Math.round((price / monthBase - 1) * 10000) / 100,
      });
    } catch (e) {
      /* skip this pair */
    }
  }));
  const order = FX_LIST.map((f) => f[0]);
  out.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
  return out;
}

function json(obj, status = 200, cacheSeconds = 900) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}`,
    },
  });
}

function cors(resp) {
  const r = new Response(resp.body, resp);
  r.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  r.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return r;
}

// =============================================================================
// Shared community board (Cloudflare KV: COMMUNITY_KV)
// =============================================================================

const COMMUNITY_KV_KEY = "community:v1:posts";
const COMMUNITY_MAX_POSTS = 400;
const COMMUNITY_MAX_CONTENT = 12000;
const COMMUNITY_MAX_COMMENT_CONTENT = 4000;
const COMMUNITY_MAX_COMMENTS_PER_POST = 80;
const COMMUNITY_MAX_AUTHOR = 24;
// 스팸 방지
const COMMUNITY_POST_COOLDOWN_MS = 12000;
const COMMUNITY_COMMENT_COOLDOWN_MS = 6000;
const COMMUNITY_DUP_WINDOW_MS = 600000;
const COMMUNITY_MAX_LINKS = 2;
const COMMUNITY_BANNED_PATTERNS = [/viagra|카지노|토토사이트|먹튀|불법대출/i];

// 투표(별도 KV) — 하루 1표, 35일 보관
const COMMUNITY_VOTES_KV_KEY = "community:v1:votes";
const COMMUNITY_VOTE_CHOICES = ["buy", "sell"];
const COMMUNITY_MAX_VOTES = 8000;
const COMMUNITY_VOTE_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;

function communityLinkCount(text) {
  return (String(text || "").match(/https?:\/\/|www\./gi) || []).length;
}

function communitySpamReason(content) {
  if (COMMUNITY_BANNED_PATTERNS.some((re) => re.test(content))) return "banned_word";
  if (communityLinkCount(content) > COMMUNITY_MAX_LINKS) return "too_many_links";
  return null;
}

function communityAdminOk(env, key) {
  const adminKey = env && env.COMMUNITY_ADMIN_KEY;
  return Boolean(adminKey) && String(key || "") === String(adminKey);
}

function communityDayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

async function loadCommunityVotesKv(env) {
  const raw = await env.COMMUNITY_KV.get(COMMUNITY_VOTES_KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCommunityVotesKv(env, votes) {
  const cutoff = Date.now() - COMMUNITY_VOTE_RETENTION_MS;
  const pruned = votes.filter((v) => Date.parse(v.at) >= cutoff).slice(-COMMUNITY_MAX_VOTES);
  await env.COMMUNITY_KV.put(COMMUNITY_VOTES_KV_KEY, JSON.stringify(pruned));
  return pruned;
}

function communityKvMissing() {
  return json({
    posts: [],
    error: "no_community_kv",
    message: "Worker에 COMMUNITY_KV 바인딩이 필요합니다.",
  }, 503, 30);
}

async function loadCommunityPostsKv(env) {
  const raw = await env.COMMUNITY_KV.get(COMMUNITY_KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCommunityPostsKv(env, posts) {
  await env.COMMUNITY_KV.put(COMMUNITY_KV_KEY, JSON.stringify(posts.slice(0, COMMUNITY_MAX_POSTS)));
}

function sanitizeCommunityTicker(raw) {
  const t = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  return t.slice(0, 12);
}

function sanitizeCommunityAuthor(raw) {
  return String(raw || "").trim().replace(/[<>]/g, "").slice(0, COMMUNITY_MAX_AUTHOR) || "익명";
}

function sanitizeCommunityContent(raw) {
  return String(raw || "").trim().replace(/\r\n/g, "\n").slice(0, COMMUNITY_MAX_CONTENT);
}

function sanitizeCommunityCommentContent(raw) {
  return String(raw || "").trim().replace(/\r\n/g, "\n").slice(0, COMMUNITY_MAX_COMMENT_CONTENT);
}

function normalizeCommunityComments(raw) {
  return Array.isArray(raw) ? raw : [];
}

function sanitizeCommunityClientId(raw) {
  return String(raw || "").trim().replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64);
}

function newCommunityPostId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function handleCommunityList(url, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const posts = await loadCommunityPostsKv(env);
  const ticker = sanitizeCommunityTicker(url.searchParams.get("ticker"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 80));
  // 신고는 더 이상 전체 공개 목록을 숨기지 않는다(신고자 본인만 클라이언트에서 가림).
  // 응답에는 신고 내역을 노출하지 않는다(관리자 전용 엔드포인트로 분리).
  const filtered = ticker ? posts.filter((p) => p.ticker === ticker) : posts;
  const publicPosts = filtered.slice(0, limit).map((p) => {
    const { reports, ...rest } = p;
    return rest;
  });
  return json({ posts: publicPosts, total: filtered.length }, 200, 8);
}

async function handleCommunityCreate(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const content = sanitizeCommunityContent(body && body.content);
  if (content.length < 2) return json({ error: "content_too_short" }, 400, 30);
  const author = sanitizeCommunityAuthor(body && body.author);
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  const spam = communitySpamReason(content);
  if (spam) return json({ error: spam, message: "스팸으로 의심되는 내용이 포함되어 등록할 수 없습니다." }, 400, 0);
  const ticker = sanitizeCommunityTicker(body && body.ticker);
  const posts = await loadCommunityPostsKv(env);
  const now = Date.now();
  const lastByClient = posts.find((p) => p.clientId === clientId);
  if (lastByClient) {
    const dt = now - Date.parse(lastByClient.createdAt);
    if (dt >= 0 && dt < COMMUNITY_POST_COOLDOWN_MS) {
      return json({ error: "too_fast", message: "잠시 후 다시 시도해 주세요." }, 429, 0);
    }
  }
  const isDuplicate = posts.some((p) =>
    p.clientId === clientId && p.content === content && (now - Date.parse(p.createdAt)) < COMMUNITY_DUP_WINDOW_MS);
  if (isDuplicate) return json({ error: "duplicate", message: "같은 내용을 방금 등록했습니다." }, 409, 0);
  const post = {
    id: newCommunityPostId(),
    author,
    clientId,
    ticker: ticker || "",
    content,
    createdAt: new Date().toISOString(),
  };
  posts.unshift(post);
  await saveCommunityPostsKv(env, posts);
  return json({ ok: true, post }, 201, 0);
}

async function handleCommunityDelete(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const id = String(body && body.id || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  const isAdmin = communityAdminOk(env, body && body.adminKey);
  if (!id || (!clientId && !isAdmin)) return json({ error: "missing_fields" }, 400, 30);
  const posts = await loadCommunityPostsKv(env);
  const target = posts.find((p) => p.id === id);
  if (!target) return json({ error: "not_found" }, 404, 30);
  if (!isAdmin && target.clientId !== clientId) return json({ error: "forbidden" }, 403, 30);
  const next = posts.filter((p) => p.id !== id);
  await saveCommunityPostsKv(env, next);
  return json({ ok: true, deleted: id }, 200, 0);
}

async function handleCommunityCommentCreate(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const postId = String(body && body.postId || "").trim();
  const content = sanitizeCommunityCommentContent(body && body.content);
  if (!postId) return json({ error: "missing_post_id" }, 400, 30);
  if (content.length < 2) return json({ error: "content_too_short" }, 400, 30);
  const author = sanitizeCommunityAuthor(body && body.author);
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  const spam = communitySpamReason(content);
  if (spam) return json({ error: spam, message: "스팸으로 의심되는 내용이 포함되어 등록할 수 없습니다." }, 400, 0);
  const posts = await loadCommunityPostsKv(env);
  const post = posts.find((p) => p.id === postId);
  if (!post) return json({ error: "not_found" }, 404, 30);
  const now = Date.now();
  let lastCommentAt = 0;
  for (const p of posts) {
    for (const c of (Array.isArray(p.comments) ? p.comments : [])) {
      if (c.clientId === clientId) {
        const t = Date.parse(c.createdAt);
        if (Number.isFinite(t) && t > lastCommentAt) lastCommentAt = t;
      }
    }
  }
  if (lastCommentAt && (now - lastCommentAt) < COMMUNITY_COMMENT_COOLDOWN_MS) {
    return json({ error: "too_fast", message: "잠시 후 다시 시도해 주세요." }, 429, 0);
  }
  const comments = normalizeCommunityComments(post.comments);
  const comment = {
    id: newCommunityPostId(),
    author,
    clientId,
    content,
    createdAt: new Date().toISOString(),
  };
  comments.push(comment);
  post.comments = comments.slice(-COMMUNITY_MAX_COMMENTS_PER_POST);
  await saveCommunityPostsKv(env, posts);
  return json({ ok: true, postId, comment }, 201, 0);
}

async function handleCommunityLike(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const postId = String(body && body.postId || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!postId) return json({ error: "missing_post_id" }, 400, 30);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  const posts = await loadCommunityPostsKv(env);
  const post = posts.find((p) => p.id === postId);
  if (!post) return json({ error: "not_found" }, 404, 30);
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const idx = likes.indexOf(clientId);
  let liked;
  if (idx >= 0) {
    likes.splice(idx, 1);
    liked = false;
  } else {
    likes.push(clientId);
    liked = true;
  }
  post.likes = likes;
  await saveCommunityPostsKv(env, posts);
  return json({ ok: true, postId, likeCount: likes.length, liked }, 200, 0);
}

async function handleCommunityReport(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const postId = String(body && body.postId || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!postId) return json({ error: "missing_post_id" }, 400, 30);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  const reason = String(body && body.reason || "").trim().slice(0, 200);
  const posts = await loadCommunityPostsKv(env);
  const post = posts.find((p) => p.id === postId);
  if (!post) return json({ error: "not_found" }, 404, 30);
  const reports = Array.isArray(post.reports) ? post.reports : [];
  if (!reports.some((r) => (r && r.clientId) === clientId)) {
    reports.push({ clientId, reason, at: new Date().toISOString() });
  }
  post.reports = reports;
  await saveCommunityPostsKv(env, posts);
  return json({ ok: true, postId, reportCount: reports.length }, 200, 0);
}

// 관리자 전용: 신고된 글 목록 + 신고 내역(adminKey 필요)
async function handleCommunityReportsList(url, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  if (!communityAdminOk(env, url.searchParams.get("adminKey"))) {
    return json({ error: "forbidden" }, 403, 0);
  }
  const posts = await loadCommunityPostsKv(env);
  const reported = posts
    .filter((p) => Array.isArray(p.reports) && p.reports.length)
    .map((p) => ({
      id: p.id,
      author: p.author,
      ticker: p.ticker || "",
      content: p.content,
      createdAt: p.createdAt,
      reportCount: p.reports.length,
      reports: p.reports,
    }))
    .sort((a, b) => b.reportCount - a.reportCount);
  return json({ posts: reported, total: reported.length }, 200, 0);
}

// 투표: 하루 1표(같은 날 재투표 시 교체). 게시글이 아니라 종목 대상.
async function handleCommunityVote(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  const ticker = sanitizeCommunityTicker(body && body.ticker);
  const choice = String(body && body.choice || "").trim().toLowerCase();
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  if (!ticker) return json({ error: "missing_ticker" }, 400, 30);
  if (!COMMUNITY_VOTE_CHOICES.includes(choice)) return json({ error: "bad_choice" }, 400, 30);
  const votes = await loadCommunityVotesKv(env);
  const today = communityDayKey(Date.now());
  const existingIdx = votes.findIndex((v) => v.clientId === clientId && communityDayKey(Date.parse(v.at)) === today);
  if (existingIdx >= 0) {
    // 하루 1표 — 같은 날 표는 새 선택으로 교체
    votes.splice(existingIdx, 1);
  }
  const vote = { clientId, ticker, choice, at: new Date().toISOString() };
  votes.push(vote);
  await saveCommunityVotesKv(env, votes);
  return json({ ok: true, vote }, 200, 0);
}

// 투표 순위: ?period=day|week|month, ?clientId= (내 오늘 투표 표시용)
async function handleCommunityVotesList(url, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  const period = String(url.searchParams.get("period") || "day").toLowerCase();
  const clientId = sanitizeCommunityClientId(url.searchParams.get("clientId"));
  const days = period === "month" ? 30 : period === "week" ? 7 : 1;
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const votes = await loadCommunityVotesKv(env);
  // 유효한 선택(매수/매도)만 집계 — 옛 '관망' 등 무효 표는 총계에서도 제외해 숫자 불일치 방지
  const inRange = votes.filter((v) => Date.parse(v.at) >= cutoff && COMMUNITY_VOTE_CHOICES.includes(v.choice));
  const byTicker = new Map();
  for (const v of inRange) {
    if (!byTicker.has(v.ticker)) byTicker.set(v.ticker, { ticker: v.ticker, total: 0, buy: 0, sell: 0 });
    const row = byTicker.get(v.ticker);
    row.total += 1;
    if (row[v.choice] != null) row[v.choice] += 1;
  }
  const rows = [...byTicker.values()];
  const buyRanking = rows.filter((r) => r.buy > 0).sort((a, b) => b.buy - a.buy || b.total - a.total).slice(0, 20);
  const sellRanking = rows.filter((r) => r.sell > 0).sort((a, b) => b.sell - a.sell || b.total - a.total).slice(0, 20);
  const today = communityDayKey(Date.now());
  const myToday = clientId
    ? (votes.find((v) => v.clientId === clientId && communityDayKey(Date.parse(v.at)) === today) || null)
    : null;
  return json({ period, buyRanking, sellRanking, totalVotes: inRange.length, myToday }, 200, 8);
}

async function handleCommunityCommentDelete(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const postId = String(body && body.postId || "").trim();
  const commentId = String(body && body.commentId || "").trim();
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!postId || !commentId || !clientId) return json({ error: "missing_fields" }, 400, 30);
  const posts = await loadCommunityPostsKv(env);
  const post = posts.find((p) => p.id === postId);
  if (!post) return json({ error: "not_found" }, 404, 30);
  const comments = normalizeCommunityComments(post.comments);
  const target = comments.find((c) => c.id === commentId);
  if (!target) return json({ error: "comment_not_found" }, 404, 30);
  if (target.clientId !== clientId) return json({ error: "forbidden" }, 403, 30);
  post.comments = comments.filter((c) => c.id !== commentId);
  await saveCommunityPostsKv(env, posts);
  return json({ ok: true, postId, deleted: commentId }, 200, 0);
}

async function handleCommunityClear(request, env) {
  if (!env || !env.COMMUNITY_KV) return communityKvMissing();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400, 30);
  }
  const clientId = sanitizeCommunityClientId(body && body.clientId);
  if (!clientId) return json({ error: "missing_client_id" }, 400, 30);
  const posts = await loadCommunityPostsKv(env);
  const next = posts
    .filter((p) => p.clientId !== clientId)
    .map((p) => ({
      ...p,
      comments: normalizeCommunityComments(p.comments).filter((c) => c.clientId !== clientId),
    }));
  const removedPosts = posts.length - next.length;
  const removedComments = posts.reduce((sum, post) => {
    const comments = normalizeCommunityComments(post.comments);
    return sum + comments.filter((c) => c.clientId === clientId).length;
  }, 0);
  await saveCommunityPostsKv(env, next);
  return json({ ok: true, removed: removedPosts, removedComments }, 200, 0);
}

// =============================================================================
// Site help chatbot
// =============================================================================

// Knowledge base: how to use the site + finance-term glossary. Kept in the system
// prompt so the model answers from grounded facts even when its own Korean is weak.
const CHAT_SYSTEM_PROMPT = `당신은 "미르의 미국 주식" 웹사이트의 친절한 도우미 '미르'입니다.
주특기: (1) 사이트 사용법 안내, (2) 주식·재무 기본 용어 쉬운 설명.
하지만 그 외 일반적인 대화(인사, 잡담, 가벼운 질문, 응원, 일상 이야기 등)도 자연스럽고 친근하게 잘 받아 줍니다. 사용자가 편하게 말 걸 수 있는 친구 같은 챗봇이 되세요.
말투: 한국어로 따뜻하고 친근하게. 보통 2~5문장. 이모지는 가끔만 가볍게. 필요하면 짧은 예시.
중요한 규칙:
- 특정 종목의 매수/매도/목표가/투자 추천은 절대 하지 않습니다. "이 사이트는 참고용이며 투자 판단은 본인 책임"이라고 안내하세요.
- 실시간 시세나 "오늘 무엇이 올랐나" 같은 건 직접 알 수 없으니, 해당 탭(예: 급등/거래량, 상위 종목)에서 확인하라고 안내하세요.
- 모르면 모른다고 솔직히 말하세요. 지어내지 마세요.
- 일반 대화는 자유롭게 응해도 좋지만, 대화가 자연스럽게 이어질 때 가볍게 주식·사이트 기능으로 연결해 주면 좋습니다(억지로는 금지).
- 의료·법률·정치적으로 민감하거나 전문적인 사안은 단정하지 말고, 일반적인 정보 수준에서만 답하거나 전문가 상담을 권하세요.
- 욕설·혐오·불법·유해한 요청에는 정중히 응하지 않습니다.

[사이트 구성]
- 상단: SNS 아이콘(인스타·X·스레드·네이버 블로그), 데이터 기준 시각. 데이터는 매일 한국시간 오전 6시에 1회 갱신되는 스냅샷입니다(실시간 아님).
- 왼쪽 "오늘의 카드뉴스": 그날 만든 카드뉴스 본문 이미지. 클릭하면 크게 볼 수 있습니다.
- 상단 요약: Fear & Greed(공포·탐욕) 지수, 섹터 TOP5, 환율 등.
- 탭 설명:
  · 시장 지도(히트맵): 종목을 타일로. 색은 등락률·RS 점수 등 선택 지표, 타일 크기는 시가총액·거래량 배율 등 선택. 섹터별로 묶여 한눈에 강약을 봅니다.
  · 섹터 흐름: 섹터 ETF 차트 비교와 ETF 상대강도(RS) 순위.
  · 상위 종목: PER·Forward P/E·P/S·P/B·RS 점수 등 지표 기준 상위 종목.
  · 급등/거래량: 당일 급등, 거래량 급증, RS 신고가+거래량 종목.
  · 종목 분석: 티커 검색 → 차트(이동평균·볼린저·RSI·MACD·스토캐스틱)와 재무, 실시간 뉴스.
  · 내 리스트: 관심 티커를 입력해 한 번에 비교.
  · 마켓 데이터: 주요 지수·국가·채권·원자재·환율.
  · 경제 캘린더: 이번 주 한국·미국 주요 경제지표 일정.
  · AI 브리핑: 국내 장마감·미국 장전 시황과 소셜 트렌딩 종목.

[용어 사전 — 쉽게 설명할 때 참고]
- 시가총액: 주가 × 총 발행주식수. 회사의 크기.
- PER(P/E, 주가수익비율): 주가 ÷ 주당순이익(EPS). 이익 대비 주가가 비싼지 보는 지표. 낮을수록 싸 보이나 업종마다 다름.
- Forward P/E(선행 PER): 과거가 아닌 '예상 이익' 기준 PER.
- PBR(P/B, 주가순자산비율): 주가 ÷ 주당순자산. 1보다 낮으면 장부가보다 싸게 거래.
- PSR(P/S, 주가매출비율): 시가총액 ÷ 매출. 적자 성장주 평가에 유용.
- EPS(주당순이익): 순이익 ÷ 주식수. 한 주가 버는 이익.
- ROE(자기자본이익률): 순이익 ÷ 자기자본. 주주 돈으로 얼마나 효율적으로 버는지(높을수록 좋음).
- ROA(총자산이익률): 순이익 ÷ 총자산. 자산 대비 수익성.
- 배당수익률: 연 배당금 ÷ 주가.
- RS 점수(상대강도): 시장(혹은 벤치마크) 대비 주가가 얼마나 강한지 점수화(높을수록 강세). 이 사이트는 대략 3·6·12개월 수익률을 가중한 모멘텀 지표입니다.
- EPS 추정 점수: 향후 이익 추정 개선 정도를 점수화.
- RSI(상대강도지수, 14): 0~100. 보통 70 이상 과매수, 30 이하 과매도로 봅니다.
- 스토캐스틱(StochK): 최근 가격 위치를 0~100으로. 과매수/과매도 판단.
- MACD: 단기·장기 이동평균 차이로 추세·모멘텀을 보는 지표.
- 볼린저 밴드: 이동평균 ± 표준편차 밴드. 변동성과 과열/침체 가늠.
- 이동평균(SMA/EMA): 일정 기간 평균 가격선. EMA는 최근에 가중.
- 거래량 배율: 평소 평균 대비 오늘 거래량이 몇 배인지.
- YTD: 연초 대비 수익률.
- 신고가(52주): 최근 1년 최고가. 신고가 경신은 강세 신호로 봄.
- 섹터 ETF: 특정 업종(기술 XLK, 반도체 SOXX 등) 묶음에 투자하는 상품.
- Fear & Greed 지수: 시장 심리를 0(극단적 공포)~100(극단적 탐욕)으로 나타낸 지표.
- 베타: 시장 대비 변동성(1보다 크면 더 출렁임).
- 호가: 사고팔려고 내놓은 가격(매수호가·매도호가). 둘의 차이를 스프레드라 함.
- 시가/종가/고가/저가: 그날의 시작가·마감가·최고가·최저가.
- 거래대금: 거래량 × 가격. 실제로 오간 금액.
- 유통주식수: 시장에서 실제로 거래 가능한 주식 수.
- 공매도: 주식을 빌려 먼저 팔고 나중에 되사서 갚는 하락 베팅.
- 액면분할: 주식을 쪼개 주당 가격을 낮추고 주식 수를 늘림(시가총액은 그대로).
- 배당락: 배당 받을 권리가 사라지는 날. 그만큼 주가가 조정됨.
- 배당성향: 순이익 중 배당으로 나눠주는 비율.
- 우선주/보통주: 우선주는 배당이 우선이나 보통 의결권이 없음.
- ETF: 여러 종목을 묶어 한 번에 사고파는 상장 펀드.
- 지수(인덱스): S&P500(대형 500), 나스닥(기술주 중심), 다우(우량 30) 같은 시장 묶음 지표.
- VIX(변동성지수): S&P500의 기대 변동성. '공포지수'라고도 부름.
- 골든크로스/데드크로스: 단기 이동평균선이 장기선을 위로/아래로 뚫는 신호.
- 지지선/저항선: 가격이 잘 안 내려가는/잘 못 올라가는 가격대.
- 어닝(실적발표): 분기마다 회사가 실적을 공개하는 것.
- 컨센서스: 여러 애널리스트 예상치의 평균.
- 어닝 서프라이즈: 실적이 예상보다 크게 좋거나 나쁘게 나온 것.
- 가이던스: 회사가 스스로 내놓는 향후 실적 전망.
- 10-K / 10-Q: 미국 기업의 연간 / 분기 공식 보고서.
- 대형주/중형주/소형주: 시가총액 규모로 나눈 분류.
- 성장주/가치주: 빠른 성장 기대 vs 저평가·안정 배당 성격.
- 경기민감주/경기방어주: 경기 따라 크게 출렁 vs 경기와 덜 무관(필수소비·헬스케어 등).
- 리츠(REITs): 부동산에 투자해 임대수익 등을 배당으로 주는 상품.
- 채권수익률(금리): 보통 금리가 오르면 성장주에 부담이 됨.
- 연준(Fed)/FOMC: 미국 중앙은행 / 기준금리를 정하는 회의.
- CPI(소비자물가지수): 물가 상승률. 금리와 시장에 큰 영향.
- 달러인덱스(DXY): 주요 통화 대비 달러가 얼마나 센지.
- 시간외 거래(프리마켓/애프터마켓): 정규장 시작 전·마감 후의 거래.
- 분산투자: 여러 자산에 나눠 담아 위험을 줄이는 것.

[자주 묻는 질문(FAQ) — 이렇게 안내하세요]
- "가격이 실시간인가요?" → 아니요. 매일 한국시간 오전 6시에 1회 갱신되는 스냅샷 기준입니다. 실시간 시세는 증권사 앱에서 확인하세요.
- "특정 종목을 찾고 싶어요" → '종목 분석' 탭에서 티커(예: AAPL, NVDA)로 검색하면 차트·재무·뉴스를 볼 수 있어요.
- "여러 종목을 한 번에 비교하려면?" → '내 리스트' 탭에 관심 티커들을 입력하면 한눈에 비교됩니다.
- "오늘 많이 오른/거래량 터진 종목은?" → '급등/거래량' 탭에서 확인하세요(스냅샷 기준).
- "히트맵 색이나 타일 크기 기준을 바꾸려면?" → '시장 지도' 탭에서 지표를 고르세요(색=등락률·RS 등, 크기=시가총액·거래량 등).
- "카드뉴스가 뭔가요?" → 그날의 시황을 이미지로 요약한 콘텐츠예요. 클릭하면 크게 볼 수 있습니다.
- "이번 주 경제 일정이 궁금해요" → '경제 캘린더' 탭에서 한국·미국 주요 지표 일정을 보세요.
- "이 종목 사도 돼요? / 목표가 알려줘" → 죄송하지만 특정 종목의 매수·매도·목표가는 안내하지 않아요. 참고용 지표만 제공하며 투자 판단은 본인 책임입니다.`;

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad_json" }, 400);
  }

  const raw = Array.isArray(body && body.messages) ? body.messages : [];
  const history = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return json({ reply: "", error: "no_user_message" }, 400);
  }
  if (!env || !env.AI) {
    return json({ reply: "지금은 도우미를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.", error: "no_ai_binding" });
  }

  const stockContext = typeof body.stockContext === "string" ? body.stockContext.trim().slice(0, 4000) : "";
  const systemContent = stockContext
    ? `${CHAT_SYSTEM_PROMPT}\n\n[현재 사용자가 보고 있는 종목 컨텍스트]\n${stockContext}\n\n위 종목 데이터가 제공되면 이를 우선 참고해 설명하되, 매수/매도/목표가 추천은 하지 마세요.`
    : CHAT_SYSTEM_PROMPT;
  const messages = [{ role: "system", content: systemContent }, ...history];
  let lastError = "no_model";
  for (const model of CHAT_MODELS) {
    try {
      const result = await env.AI.run(model, { messages, max_tokens: 768, temperature: 0.3 });
      const text = String((result && result.response) || "").trim();
      if (text) return json({ reply: text, model });
      lastError = `empty_response:${model}`;
    } catch (e) {
      lastError = `${model}: ${(e && e.message) || e}`;
    }
  }
  return json({ reply: "답변 생성에 실패했어요. 잠시 후 다시 시도해 주세요.", error: lastError });
}
