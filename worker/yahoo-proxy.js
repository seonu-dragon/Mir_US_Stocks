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
      const [news, chart] = await Promise.all([fetchNews(symbol), fetchChart(symbol)]);
      const modelOverride = url.searchParams.get("model");
      const { text: analysis, error: analysisError, model: analysisModel } =
        await summarizeMoveAnalysisKorean(env, ticker, eventDate, eventChange, news, chart, modelOverride);
      return cors(json({ ticker, date: eventDate, changePct: eventChange, news, chartContext: chartMoveContext(chart, eventDate), analysis, analysisError, analysisModel }));
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

async function summarizeMoveAnalysisKorean(env, ticker, eventDate, eventChange, news, chart, modelOverride) {
  if (!env || !env.AI) return { text: "", error: "no_ai_binding" };
  const context = chartMoveContext(chart, eventDate);
  const datedNews = (news || [])
    .map((n) => ({ ...n, distance: n.publishedAt ? Math.abs((new Date(`${n.publishedAt}T00:00:00`) - new Date(`${eventDate}T00:00:00`)) / 86400000) : 999 }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  const headlines = datedNews.length
    ? datedNews.map((n, i) => `${i + 1}. ${n.publishedAt || "날짜 없음"} · ${n.title}${n.publisher ? ` (${n.publisher})` : ""}`).join("\n")
    : "관련 뉴스 헤드라인 없음";
  const chartText = context
    ? `가격: 시가 ${context.open}, 고가 ${context.high}, 저가 ${context.low}, 종가 ${context.close}, 전일 종가 ${context.prevClose ?? "없음"}, 당일 등락률 ${context.changePct ?? eventChange}%, 거래량 ${context.volume}, 20일 평균 대비 거래량 ${context.volumeRatio20d ?? "계산 불가"}배`
    : `차트에서 해당 날짜(${eventDate})를 찾지 못했습니다. 전달 등락률: ${eventChange}%`;
  const prompt =
    `미국 주식 ${ticker}의 ${eventDate} 가격 이벤트 원인을 한국어로 분석하세요.\n\n` +
    `[가격/거래량]\n${chartText}\n\n` +
    `[뉴스 헤드라인]\n${headlines}\n\n` +
    `규칙:\n` +
    `- 위 가격/거래량과 뉴스 헤드라인만 근거로 쓰세요. 모르는 사실을 만들지 마세요.\n` +
    `- 직접 원인으로 볼 수 있는 내용과 가능성 수준의 해석을 구분하세요.\n` +
    `- 뉴스가 해당 날짜와 멀거나 부족하면 "직접 연결되는 뉴스가 부족하다"고 명확히 말하세요.\n` +
    `- 3~5문장의 자연스러운 한국어 단락 하나로 작성하세요.\n` +
    `- 매수/매도 조언은 하지 마세요.`;
  const models = modelOverride ? [modelOverride] : SUMMARY_MODELS;
  let lastError = "no_model";
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "You are a careful market news analyst. Answer in Korean only, cite uncertainty clearly, and never invent facts beyond the supplied headlines and price/volume context." },
          { role: "user", content: prompt },
        ],
        max_tokens: 520,
        temperature: 0.25,
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
      .slice(0, 4)
      .map((row) => ({
        quarter: (row.quarter && row.quarter.fmt) || row.period || "",
        epsActual: row.epsActual && row.epsActual.raw != null ? row.epsActual.raw : null,
        epsEstimate: row.epsEstimate && row.epsEstimate.raw != null ? row.epsEstimate.raw : null,
        surprisePct: row.surprisePercent && row.surprisePercent.raw != null ? row.surprisePercent.raw : null,
      }));
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

// Economic calendar for Korea (id 11) + US (id 5), this week, KST (timeZone 88).
async function fetchCalendar() {
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
      body: "country%5B%5D=5&country%5B%5D=11&timeZone=88&timeFilter=timeRemain&currentTab=thisWeek&limit_from=0",
    });
    if (!r.ok) return [];
    const payload = await r.json();
    return parseCalendar(payload && payload.data ? String(payload.data) : "");
  } catch (e) {
    return [];
  }
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
    const r = await fetch("https://production.fear-and-greed.cnn.io/data/index", {
      headers: { ...UA, Referer: "https://www.cnn.com/", Origin: "https://www.cnn.com" },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const fg = data && data.fear_and_greed;
    if (!fg || fg.score == null) return null;
    return { score: Math.round(Number(fg.score)), rating: String(fg.rating || "") };
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
      const prevClose = meta.chartPreviousClose || meta.previousClose || (closes.length ? closes[0] : null);
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Cache at the edge for 15 min to ease Yahoo rate limits.
      "Cache-Control": "public, max-age=900",
    },
  });
}

function cors(resp) {
  const r = new Response(resp.body, resp);
  r.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  r.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return r;
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
