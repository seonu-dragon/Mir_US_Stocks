// @ts-nocheck
// =============================================================================
// Mir US Stocks — 정시 실행 워커(Cloudflare Worker, 별도 워커 "mir-cron")
//
// GitHub Actions 의 `schedule:` 은 예약 시각을 지키지 않는다. 2026-09 실측으로 15:42 KST
// 예약(korea-close-briefing)이 매일 21:24~23:25 KST 에야 출발했고, 다른 예약도 전부 늦었다.
// 반면 workflow_dispatch(= "Run workflow" 버튼)는 요청 즉시 출발한다. 그래서 2026-10-01 부터
// 예약 시각은 이 워커가 지키고, 워크플로우는 `schedule:` 대신 `# mir-cron: "<UTC cron>"` 주석만 둔다.
//
// 동작: Cron Trigger "* * * * *" 로 매분 깨어나, 예약표에서 방금 시각이 된 워크플로우를
// GitHub API 로 dispatch 한다. 같은 예약 슬롯을 두 번 돌리지 않도록 dispatch 전에 "슬롯 시각
// 이후 만들어진 run 이 있는지"를 먼저 본다(KV 없이 멱등). 실패하면 슬롯 후 1·3·7·15·30·60분에
// 다시 확인해 재시도한다. 그래도 놓친 슬롯은 GitHub 쪽 cron-watchdog.yml 이 대신 돌리고 텔레그램으로 알린다.
//
// 예약표: 레포의 .github/mir-cron.json(scripts/sync_cron_worker.mjs 가 워크플로우의 `# mir-cron:` 주석에서
// 생성)을 raw.githubusercontent.com 에서 10분마다 다시 읽는다 — 예약을 바꿔도 워커 재배포가 필요 없다.
// 읽기에 실패하면 아래 EMBED 블록(같은 스크립트가 채운 사본)을 쓴다.
//
// 배포: 머지해도 반영되지 않는다 — Cloudflare 대시보드에 이 파일(origin/main 본)을 붙여넣는 수동 배포.
// 절차는 DEPLOY.md "정시 실행 워커".
//   시크릿: GITHUB_TOKEN — fine-grained PAT, 저장소 Mir_US_Stocks 만, 권한 Actions: Read and write
//   변수(선택): GITHUB_REPO(기본 seonu-dragon/Mir_US_Stocks), GITHUB_REF(기본 main)
//   Cron Trigger: "* * * * *"
//   확인: GET /health (예약 수·다음 슬롯), GET /health?token=1 (토큰으로 레포를 읽을 수 있는지)
// =============================================================================

const DEFAULT_REPO = "seonu-dragon/Mir_US_Stocks";
const DEFAULT_REF = "main";
const SCHEDULE_TTL_MS = 10 * 60 * 1000;
// 슬롯 시각 + N분에 확인한다. 0분에 dispatch 하고, run 이 안 보이면(디스패치 실패·GitHub 장애) 다시 한다.
export const RETRY_OFFSETS_MIN = [0, 1, 3, 7, 15, 30, 60];
// 실행당 확인 상한(무료 플랜 서브리퀘스트 50, 확인 1 + 디스패치 1 = 2회씩).
const MAX_CHECKS_PER_RUN = 20;
// Cloudflare·GitHub 시계 차이로 run 생성 시각이 슬롯보다 몇 초 앞서 찍혀도 놓치지 않게.
const CLOCK_SKEW_MS = 30 * 1000;

// ===== BEGIN EMBED: .github/mir-cron.json =====
const EMBEDDED_SCHEDULE = [
  {"workflow":"13f-quarterly-refresh.yml","cron":"5 6 5 * *","input":true},
  {"workflow":"13f-quarterly-refresh.yml","cron":"10 6 15 2,5,8,11 *","input":true},
  {"workflow":"13f-quarterly-refresh.yml","cron":"20 6 20,28 3,6,9,12 *","input":true},
  {"workflow":"activist-stakes.yml","cron":"28 4 * * *","input":false},
  {"workflow":"company-info.yml","cron":"17 1 * * 3","input":true},
  {"workflow":"company-info.yml","cron":"17 1 * * 6","input":true},
  {"workflow":"congress-trades.yml","cron":"38 4 * * *","input":false},
  {"workflow":"crisis-history.yml","cron":"23 2 1 * *","input":false},
  {"workflow":"daily-earnings-calendar.yml","cron":"30 21 * * *","input":false},
  {"workflow":"daily-korea-market-snapshot.yml","cron":"0 13 * * 1-5","input":true},
  {"workflow":"daily-korea-news.yml","cron":"43 19 * * *","input":false},
  {"workflow":"daily-market-snapshot.yml","cron":"5 21 * * *","input":false},
  {"workflow":"event-study.yml","cron":"23 5 * * 6","input":false},
  {"workflow":"industry-indicators.yml","cron":"10 21 * * *","input":false},
  {"workflow":"insider-trades.yml","cron":"17 4 * * *","input":false},
  {"workflow":"ipo-calendar.yml","cron":"33 4 * * *","input":false},
  {"workflow":"korea-close-briefing.yml","cron":"42 6 * * *","input":false},
  {"workflow":"korea-premarket-briefing.yml","cron":"6 21 * * *","input":false},
  {"workflow":"kr-disclosures.yml","cron":"30 6 * * 1-5","input":false},
  {"workflow":"kr-valuation-band.yml","cron":"17 1 * * 6","input":false},
  {"workflow":"macro-odds.yml","cron":"37 21,5,13 * * *","input":false},
  {"workflow":"market-calendar.yml","cron":"40 21 * * *","input":true},
  {"workflow":"market-calendar.yml","cron":"10 21 2 * *","input":true},
  {"workflow":"market-indicators.yml","cron":"30 22 * * 0-4","input":false},
  {"workflow":"market-indicators.yml","cron":"10 7 * * 1-5","input":false},
  {"workflow":"material-events.yml","cron":"23 4 * * *","input":false},
  {"workflow":"moment-news.yml","cron":"40 3 * * *","input":false},
  {"workflow":"screener-backtest-panel.yml","cron":"40 20 * * 6","input":false},
  {"workflow":"short-interest.yml","cron":"47 5 * * 2,5","input":false},
  {"workflow":"us-close-briefing.yml","cron":"34 21 * * *","input":false},
  {"workflow":"us-premarket-briefing.yml","cron":"7 12 * * *","input":false},
  {"workflow":"weekly-earnings-history.yml","cron":"2 18 * * 6","input":false},
  {"workflow":"weekly-edge-stats.yml","cron":"20 19 * * 6","input":false},
  {"workflow":"white-house-schedule.yml","cron":"0 21 * * *","input":false},
  {"workflow":"white-house-schedule.yml","cron":"0 7 * * *","input":false},
  {"workflow":"white-house-schedule.yml","cron":"0 12 * * *","input":false}
];
// ===== END EMBED: .github/mir-cron.json =====

// ---------------------------------------------------------------------------
// cron 해석(UTC, 5필드: 분 시 일 월 요일). GitHub Actions 와 같은 문법만 받는다:
// *, 숫자, 목록(a,b), 범위(a-b), 간격(*/n, a-b/n). 요일 0·7 = 일요일.
// 일·요일이 둘 다 지정되면 표준 cron 처럼 "둘 중 하나"가 맞으면 된다.
// ---------------------------------------------------------------------------
const FIELDS = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7 },
];

function parseField(text, { min, max }) {
  const out = new Set();
  for (const part of text.split(",")) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) throw new Error(`cron 필드 해석 실패: ${text}`);
    let lo = min;
    let hi = max;
    if (m[1] !== "*") {
      const [a, b] = m[1].split("-").map(Number);
      lo = a;
      hi = b === undefined ? (m[2] ? max : a) : b;
    }
    const step = m[2] ? Number(m[2]) : 1;
    if (lo < min || hi > max || lo > hi || step < 1) throw new Error(`cron 범위 오류: ${text}`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export function parseCron(expr) {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron 은 5필드여야 한다: ${expr}`);
  const [minute, hour, dom, month, dow] = parts.map((p, i) => parseField(p, FIELDS[i]));
  if (dow.has(7)) dow.add(0);
  return { minute, hour, dom, month, dow, domAny: parts[2] === "*", dowAny: parts[4] === "*" };
}

export function cronMatches(parsed, date) {
  if (!parsed.minute.has(date.getUTCMinutes()) || !parsed.hour.has(date.getUTCHours())) return false;
  if (!parsed.month.has(date.getUTCMonth() + 1)) return false;
  const domOk = parsed.dom.has(date.getUTCDate());
  const dowOk = parsed.dow.has(date.getUTCDay());
  if (parsed.domAny && parsed.dowAny) return true;
  if (parsed.domAny) return dowOk;
  if (parsed.dowAny) return domOk;
  return domOk || dowOk;
}

/** nowMs 이하에서 가장 최근 슬롯(분 단위 ms). lookbackMin 안에 없으면 null. */
export function latestSlot(parsed, nowMs, lookbackMin) {
  const start = Math.floor(nowMs / 60000) * 60000;
  for (let i = 0; i <= lookbackMin; i += 1) {
    const t = start - i * 60000;
    if (cronMatches(parsed, new Date(t))) return t;
  }
  return null;
}

/** 이번 분에 확인할 (예약, 슬롯) 목록 — 슬롯 후 RETRY_OFFSETS_MIN 분째에만 확인한다. */
export function dueChecks(schedule, nowMs) {
  const nowMin = Math.floor(nowMs / 60000) * 60000;
  const maxOffset = RETRY_OFFSETS_MIN[RETRY_OFFSETS_MIN.length - 1];
  const due = [];
  for (const entry of schedule) {
    let parsed;
    try {
      parsed = parseCron(entry.cron);
    } catch {
      continue;
    }
    const slot = latestSlot(parsed, nowMin, maxOffset);
    if (slot === null) continue;
    const offset = Math.round((nowMin - slot) / 60000);
    if (RETRY_OFFSETS_MIN.includes(offset)) due.push({ ...entry, slot, offset });
  }
  return due;
}

/** 원격 예약표 검증 — 이상한 행은 버리고, 하나도 안 남으면 null(→ EMBED 사본). */
export function normalizeSchedule(raw) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.schedule) ? raw.schedule : null;
  if (!list) return null;
  const out = [];
  for (const row of list) {
    if (!row || !/^[A-Za-z0-9._-]+\.ya?ml$/.test(row.workflow || "")) continue;
    try {
      parseCron(row.cron);
    } catch {
      continue;
    }
    out.push({ workflow: row.workflow, cron: String(row.cron).trim(), input: Boolean(row.input) });
  }
  return out.length ? out : null;
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------
function repoOf(env) {
  return (env && env.GITHUB_REPO) || DEFAULT_REPO;
}

function ghHeaders(env) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mir-cron-worker",
  };
}

/** 슬롯 시각 이후 이 워크플로우의 run 이 하나라도 만들어졌는지(이벤트 무관 — 사람이 먼저 돌렸어도 건너뛴다). */
export async function hasRunSince(env, workflow, slotMs, fetchImpl = fetch) {
  const since = new Date(slotMs - CLOCK_SKEW_MS).toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `https://api.github.com/repos/${repoOf(env)}/actions/workflows/${encodeURIComponent(workflow)}/runs`
    + `?per_page=1&created=${encodeURIComponent(`>=${since}`)}`;
  const res = await fetchImpl(url, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`runs ${workflow} HTTP ${res.status}`);
  const body = await res.json();
  return Number(body && body.total_count) > 0;
}

export async function dispatchWorkflow(env, entry, fetchImpl = fetch) {
  const url = `https://api.github.com/repos/${repoOf(env)}/actions/workflows/${encodeURIComponent(entry.workflow)}/dispatches`;
  const payload = { ref: (env && env.GITHUB_REF) || DEFAULT_REF };
  // `cron` 입력을 선언한 워크플로우(예약 슬롯마다 다른 잡을 돌리는 것)에만 넘긴다 — 선언 안 한 입력을
  // 보내면 GitHub 이 422 로 거절한다.
  if (entry.input) payload.inputs = { cron: entry.cron };
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status !== 204 && !res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {}
    throw new Error(`dispatch ${entry.workflow} HTTP ${res.status} ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// 예약표 불러오기(원격 → 격리 메모리 10분 캐시 → EMBED)
// ---------------------------------------------------------------------------
let scheduleMemo = { at: 0, list: null, source: "embedded" };

export function resetScheduleCache() {
  scheduleMemo = { at: 0, list: null, source: "embedded" };
}

export async function loadSchedule(env, nowMs, fetchImpl = fetch) {
  if (scheduleMemo.list && nowMs - scheduleMemo.at < SCHEDULE_TTL_MS) return scheduleMemo;
  try {
    const url = `https://raw.githubusercontent.com/${repoOf(env)}/${(env && env.GITHUB_REF) || DEFAULT_REF}/.github/mir-cron.json`;
    const res = await fetchImpl(url, { headers: { "User-Agent": "mir-cron-worker" } });
    if (res.ok) {
      const list = normalizeSchedule(await res.json());
      if (list) {
        scheduleMemo = { at: nowMs, list, source: "remote" };
        return scheduleMemo;
      }
    }
  } catch {}
  scheduleMemo = { at: nowMs, list: EMBEDDED_SCHEDULE, source: "embedded" };
  return scheduleMemo;
}

// ---------------------------------------------------------------------------
// 크론 본체
// ---------------------------------------------------------------------------
export async function runCron(env, nowMs, fetchImpl = fetch) {
  const summary = { dispatched: [], skipped: [], failed: [] };
  if (!env || !env.GITHUB_TOKEN) return { ...summary, error: "not_configured" };
  const { list } = await loadSchedule(env, nowMs, fetchImpl);
  const due = dueChecks(list, nowMs).slice(0, MAX_CHECKS_PER_RUN);
  for (const entry of due) {
    const tag = `${entry.workflow} [${entry.cron}] +${entry.offset}m`;
    try {
      if (await hasRunSince(env, entry.workflow, entry.slot, fetchImpl)) {
        summary.skipped.push(tag);
        continue;
      }
      await dispatchWorkflow(env, entry, fetchImpl);
      summary.dispatched.push(tag);
    } catch (err) {
      summary.failed.push(`${tag}: ${err && err.message ? err.message : err}`);
    }
  }
  return summary;
}

/** 다음 N개 슬롯(health 표시용). 최대 8일 앞까지 분 단위로 훑는다. */
export function upcomingSlots(schedule, nowMs, limit = 5) {
  const parsed = schedule.map((e) => {
    try {
      return { e, p: parseCron(e.cron) };
    } catch {
      return null;
    }
  }).filter(Boolean);
  const out = [];
  const start = Math.floor(nowMs / 60000) * 60000 + 60000;
  for (let t = start; out.length < limit && t < start + 8 * 86400000; t += 60000) {
    const d = new Date(t);
    for (const { e, p } of parsed) {
      if (cronMatches(p, d)) out.push({ at: d.toISOString(), workflow: e.workflow, cron: e.cron });
    }
  }
  return out.slice(0, limit);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

let tokenProbeAt = 0;

export async function handleFetch(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== "/health" && url.pathname !== "/") return json({ error: "not_found" }, 404);
  const nowMs = Date.now();
  const { list, source } = await loadSchedule(env, nowMs, fetchImpl);
  const body = {
    ok: true,
    configured: Boolean(env && env.GITHUB_TOKEN),
    repo: repoOf(env),
    scheduleSource: source,
    jobs: list.length,
    next: upcomingSlots(list, nowMs, 5),
  };
  // 토큰 확인은 분당 1회만(누구나 부를 수 있는 주소라 토큰 한도를 태우지 않게).
  if (url.searchParams.get("token") === "1" && body.configured && nowMs - tokenProbeAt > 60000) {
    tokenProbeAt = nowMs;
    try {
      const res = await fetchImpl(`https://api.github.com/repos/${repoOf(env)}/actions/workflows?per_page=1`, { headers: ghHeaders(env) });
      body.tokenOk = res.ok;
      if (!res.ok) body.tokenStatus = res.status;
    } catch (err) {
      body.tokenOk = false;
      body.tokenError = String(err && err.message ? err.message : err);
    }
  }
  return json(body);
}

export default {
  async fetch(request, env) {
    try {
      return await handleFetch(request, env);
    } catch (err) {
      console.error("mir-cron internal error:", err);
      return json({ error: "internal" }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env, event.scheduledTime || Date.now()).then((s) => {
      if (s.error || s.dispatched.length || s.failed.length) console.log("mir-cron", JSON.stringify(s));
      if (s.failed.length) console.error("mir-cron failed:", s.failed.join(" | "));
    }).catch((err) => console.error("mir-cron error:", err)));
  },
};
