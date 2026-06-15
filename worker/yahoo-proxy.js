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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    const ticker = (url.searchParams.get("ticker") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9.\-]/g, "");
    if (!ticker) return cors(json({ error: "missing ticker" }, 400));

    const symbol = ticker.replace(/\./g, "-"); // Yahoo uses BRK-B style
    const [news, chart] = await Promise.all([fetchNews(symbol), fetchChart(symbol)]);
    // Optional ?model=... overrides the model list (for quick A/B testing).
    const modelOverride = url.searchParams.get("model");
    const { text: summary, error: summaryError, model: summaryModel } =
      await summarizeKorean(env, ticker, news, modelOverride);
    return cors(json({ ticker, news, chart, summary, summaryError, summaryModel }));
  },
};

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
      ]);
    }
    return out;
  } catch (e) {
    return [];
  }
}

const round = (v) => Math.round(Number(v) * 100) / 100;

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
  r.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return r;
}
