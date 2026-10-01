// web-push.js — 관심·보유 종목 브라우저 푸시 알림(구독·설정 UI)
// =====================================================
// 화면: 내 투자 › 보유·관심 › '관심종목 조건 감지' 패널 아래 '푸시 알림'(#pushAlertBox).
// 사이트를 닫아도 알림이 오게 한다 — 이 파일은 권한 요청·PushManager.subscribe·구독 관리만 하고,
// 조건 평가와 발송은 별도 Cloudflare 워커(worker/mir-push.js)가 30분 크론으로 한다.
// 설정 정리·목록 모양은 push-alerts-core.js(window.MirPushCore)를 워커와 같이 쓴다.
//
// 준비 상태: 아래 MIR_PUSH_DEFAULTS 의 endpoint(워커 주소)·vapidPublicKey(공개키)가 비어 있으면
// 패널은 "준비 중"으로 비활성이다. 채우는 절차는 DEPLOY.md "Web Push 알림 워커".
// (로컬 확인용으로 window.MIR_PUSH_CONFIG = { endpoint, vapidPublicKey } 를 먼저 심으면 그것을 쓴다.)
//
// 워커에 보내는 것(개인정보 최소화): 푸시 구독(endpoint·키), 알림 설정, 시장별 관심·보유 티커,
// 가격 도달 조건, 국내 종목 이름·야후 심볼. 보유 수량은 '오늘 내 주식은' 요약을 켰을 때만(비중 계산).
// 클라우드 동기화 clientId 는 '동기화 목록 자동 사용'을 켰을 때만 보낸다.
// 클래식 스크립트(전역 공유). 최상위 이름은 mirPush 접두로 충돌을 피한다.

const MIR_PUSH_DEFAULTS = {
  endpoint: "https://mir-push.planbesides.workers.dev",  // 2026-10-01 배포(/push/health → configured: true)
  // scripts/gen_vapid_keys.mjs 가 출력한 VAPID_PUBLIC_KEY(공개키만). 워커 시크릿과 같아야 한다 — 바꾸면 기존 구독 전부 무효.
  vapidPublicKey: "BG4RJZBeX8GXcPoLZHSWctAstcMq3SNuh7FCgrJZhNRaR2Mzl67cQsKwGFUwClWgFknvzrvyTdKg_OIIt_p3yH0",
};
const MIR_PUSH_PREFS_KEY = "mir.push.prefs.v1";   // { prefs, manual: [{t, price, dir}] }
const MIR_PUSH_STATE_KEY = "mir.push.state.v1";   // { endpoint, hash, syncedAt }
const MIR_PUSH_NAMES_KEY = "mir.push.names.v1";   // 국내 종목 { code: [이름, 야후심볼] } — 다른 시장 모드에서도 쓰려고
const MIR_PUSH_RESYNC_MS = 7 * 24 * 3600 * 1000;  // 목록이 그대로여도 7일마다 한 번 갱신(워커 구독 만료 120일 연장)

let mirPushBusy = false;
let mirPushSyncTimer = 0;
let mirPushStatusMsg = "";

function mirPushConfig() {
  const o = (typeof window !== "undefined" && window.MIR_PUSH_CONFIG) || {};
  const endpoint = String(o.endpoint != null ? o.endpoint : MIR_PUSH_DEFAULTS.endpoint).replace(/\/+$/, "");
  const vapidPublicKey = String(o.vapidPublicKey != null ? o.vapidPublicKey : MIR_PUSH_DEFAULTS.vapidPublicKey).trim();
  return { endpoint, vapidPublicKey, ready: Boolean(endpoint && vapidPublicKey) };
}

function mirPushEnv() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const ua = String(nav.userAgent || "");
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1);
  let standalone = false;
  try { standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true; } catch (_) { /* ignore */ }
  const supported = Boolean(window.isSecureContext && "serviceWorker" in nav && "PushManager" in window && "Notification" in window);
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  return { ios, standalone, supported, permission };
}

function mirPushStore() {
  const raw = window.safeStorage ? window.safeStorage.getJSON(MIR_PUSH_PREFS_KEY, {}) : {};
  const core = window.MirPushCore;
  return {
    prefs: core.normalizePrefs(raw && raw.prefs),
    manual: Array.isArray(raw && raw.manual) ? raw.manual.slice(0, 20) : [],
  };
}

function mirPushSaveStore(store) {
  if (window.safeStorage) window.safeStorage.setJSON(MIR_PUSH_PREFS_KEY, { prefs: store.prefs, manual: store.manual });
}

function mirPushState() {
  const s = window.safeStorage ? window.safeStorage.getJSON(MIR_PUSH_STATE_KEY, null) : null;
  return s && typeof s === "object" && s.endpoint ? s : null;
}

function mirPushSetState(s) {
  if (!window.safeStorage) return;
  if (s) window.safeStorage.setJSON(MIR_PUSH_STATE_KEY, s);
  else window.safeStorage.remove(MIR_PUSH_STATE_KEY);
}

function mirPushB64ToBytes(b64) {
  const s = String(b64).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function mirPushBytesToB64(buf) {
  const u8 = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i += 1) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ----- 목록 모으기(브라우저 저장소 → 워커 모양) -----
function mirPushRememberKrNames() {
  if (typeof isKrMarket !== "function" || !isKrMarket() || typeof stockByTicker !== "function") return;
  const cache = (window.safeStorage && window.safeStorage.getJSON(MIR_PUSH_NAMES_KEY, {})) || {};
  let changed = false;
  const tickers = [
    ...(typeof storedWatchlist === "function" ? storedWatchlist("kr") : []),
    ...(typeof storedPortfolio === "function" ? storedPortfolio("kr").map((p) => p.ticker) : []),
  ];
  tickers.forEach((t) => {
    const row = stockByTicker(t);
    if (!row) return;
    const entry = [String(row.company || "").slice(0, 24), String(row.yahooSymbol || "")];
    const prev = cache[row.ticker];
    if (!prev || prev[0] !== entry[0] || prev[1] !== entry[1]) { cache[row.ticker] = entry; changed = true; }
  });
  if (changed && window.safeStorage) {
    const keys = Object.keys(cache);
    if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete cache[k]);
    window.safeStorage.setJSON(MIR_PUSH_NAMES_KEY, cache);
  }
}

function mirPushIsSeed(list, seed) {
  if (!Array.isArray(seed) || !seed.length || list.length !== seed.length) return false;
  const set = new Set(seed);
  return list.every((t) => set.has(t));
}

/** 가설(진행 중)·매매일지(종료 제외)의 목표가·손절가. */
function mirPushAutoLevels() {
  const out = [];
  const items = window.MirThesis && Array.isArray(window.MirThesis.items) ? window.MirThesis.items : [];
  items.forEach((th) => {
    if (!th || th.status === "closed") return;
    if (Number(th.target) > 0) out.push({ t: th.ticker, price: Number(th.target), dir: "above", src: "thesis" });
    if (Number(th.stop) > 0) out.push({ t: th.ticker, price: Number(th.stop), dir: "below", src: "thesis" });
  });
  const journal = typeof investmentJournal !== "undefined" && Array.isArray(investmentJournal) ? investmentJournal : [];
  journal.forEach((row) => {
    if (!row || row.status === "closed" || row.status === "exit") return;
    if (Number(row.target) > 0) out.push({ t: row.ticker, price: Number(row.target), dir: "above", src: "journal" });
    if (Number(row.stop) > 0) out.push({ t: row.ticker, price: Number(row.stop), dir: "below", src: "journal" });
  });
  return out;
}

function mirPushLists(store) {
  const core = window.MirPushCore;
  mirPushRememberKrNames();
  const seeds = {
    us: typeof DEFAULT_WATCHLIST_US !== "undefined" ? DEFAULT_WATCHLIST_US : [],
    kr: typeof DEFAULT_WATCHLIST_KR !== "undefined" ? DEFAULT_WATCHLIST_KR : [],
  };
  const raw = { us: { watch: [], hold: [] }, kr: { watch: [], hold: [] }, levels: [], names: {}, ys: {} };
  ["us", "kr"].forEach((m) => {
    const w = typeof storedWatchlist === "function" ? storedWatchlist(m) : [];
    // 손대지 않은 기본 관심 목록은 '내 종목'이 아니다(오늘 내 주식은 카드와 같은 규칙).
    raw[m].watch = mirPushIsSeed(w, seeds[m]) ? [] : w;
    const h = typeof storedPortfolio === "function" ? storedPortfolio(m) : [];
    raw[m].hold = h.filter((p) => p && p.ticker && Number(p.qty) > 0)
      .map((p) => ({ t: p.ticker, q: store.prefs.kinds.digest ? Number(p.qty) : 0 }));
  });
  raw.levels = [...store.manual.map((l) => ({ ...l, src: "manual" })), ...mirPushAutoLevels()];
  const cache = (window.safeStorage && window.safeStorage.getJSON(MIR_PUSH_NAMES_KEY, {})) || {};
  const krTickers = new Set([...raw.kr.watch, ...raw.kr.hold.map((h) => h.t), ...raw.levels.map((l) => l.t)]);
  krTickers.forEach((t) => {
    const c = cache[t];
    if (!c) return;
    if (c[0]) raw.names[t] = c[0];
    if (c[1]) raw.ys[t] = c[1];
  });
  return core.normalizeLists(raw);
}

// ----- 워커 호출 -----
async function mirPushApi(path, body) {
  const cfg = mirPushConfig();
  const res = await fetch(`${cfg.endpoint}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* 빈 응답 */ }
  return { ok: res.ok, status: res.status, data };
}

function mirPushSyncClientId(store) {
  return store.prefs.useSync && typeof getCommunityClientId === "function" ? getCommunityClientId() : undefined;
}

async function mirPushRegistration() {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("sw_timeout")), 8000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

async function mirPushCurrentSubscription() {
  if (!mirPushEnv().supported) return null;
  try {
    const reg = await mirPushRegistration();
    return await reg.pushManager.getSubscription();
  } catch (_) {
    return null;
  }
}

async function mirPushSubscribe() {
  const cfg = mirPushConfig();
  const env = mirPushEnv();
  if (!cfg.ready || !env.supported || mirPushBusy) return;
  mirPushBusy = true;
  mirPushStatusMsg = "알림 권한을 요청하는 중…";
  renderPushAlerts();
  try {
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      mirPushStatusMsg = permission === "denied"
        ? "알림 권한이 차단됐습니다. 브라우저 주소창의 사이트 설정에서 알림을 허용한 뒤 다시 눌러 주세요."
        : "알림 권한을 허용하지 않아 구독하지 않았습니다.";
      return;
    }
    const reg = await mirPushRegistration();
    let sub = await reg.pushManager.getSubscription();
    // 공개키가 바뀌었으면(키 교체) 옛 구독은 새 키로 못 받는다 — 풀고 다시 구독한다.
    const key = sub && sub.options && sub.options.applicationServerKey;
    if (sub && key && mirPushBytesToB64(key) !== cfg.vapidPublicKey) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: mirPushB64ToBytes(cfg.vapidPublicKey) });
    }
    const store = mirPushStore();
    const lists = mirPushLists(store);
    const res = await mirPushApi("/push/subscribe", {
      subscription: sub.toJSON(), prefs: store.prefs, lists, syncClientId: mirPushSyncClientId(store),
    });
    if (!res.ok) {
      mirPushStatusMsg = res.status === 503 ? "알림 서버가 아직 준비되지 않았습니다." : `구독 저장 실패(${res.status}). 잠시 뒤 다시 시도해 주세요.`;
      return;
    }
    mirPushSetState({ endpoint: sub.endpoint, hash: window.MirPushCore.shortHash(JSON.stringify([store.prefs, lists])), syncedAt: Date.now() });
    mirPushStatusMsg = "이 기기에서 알림을 받습니다. '테스트 알림'으로 도착을 확인해 보세요.";
  } catch (err) {
    mirPushStatusMsg = err && err.message === "sw_timeout"
      ? "서비스 워커가 준비되지 않았습니다. 페이지를 새로 고친 뒤 다시 시도해 주세요."
      : "구독하지 못했습니다. 브라우저가 푸시를 막았거나 네트워크 오류입니다.";
  } finally {
    mirPushBusy = false;
    renderPushAlerts();
  }
}

async function mirPushUnsubscribe() {
  if (mirPushBusy) return;
  mirPushBusy = true;
  try {
    const st = mirPushState();
    const sub = await mirPushCurrentSubscription();
    const endpoint = (sub && sub.endpoint) || (st && st.endpoint);
    if (endpoint && mirPushConfig().ready) await mirPushApi("/push/unsubscribe", { endpoint }).catch(() => {});
    if (sub) await sub.unsubscribe().catch(() => {});
    mirPushSetState(null);
    mirPushStatusMsg = "알림을 껐습니다. 서버에 저장된 구독과 목록도 지웠습니다.";
  } finally {
    mirPushBusy = false;
    renderPushAlerts();
  }
}

async function mirPushTest() {
  const st = mirPushState();
  if (!st || mirPushBusy) return;
  mirPushBusy = true;
  mirPushStatusMsg = "테스트 알림을 보내는 중…";
  renderPushAlerts();
  try {
    const res = await mirPushApi("/push/test", { endpoint: st.endpoint });
    if (res.ok) mirPushStatusMsg = "테스트 알림을 보냈습니다. 몇 초 안에 도착하지 않으면 기기 알림 설정을 확인하세요.";
    else if (res.status === 429) mirPushStatusMsg = "테스트 알림은 1분에 한 번만 보낼 수 있습니다.";
    else if (res.status === 410 || res.status === 404) {
      mirPushSetState(null);
      mirPushStatusMsg = "이 기기의 구독이 만료됐습니다. 다시 '알림 받기'를 눌러 주세요.";
    } else mirPushStatusMsg = `테스트 알림 실패(${res.status}).`;
  } catch (_) {
    mirPushStatusMsg = "알림 서버에 연결하지 못했습니다.";
  } finally {
    mirPushBusy = false;
    renderPushAlerts();
  }
}

/** 설정·목록이 바뀌었으면(또는 7일 지났으면) 워커에 보낸다. 구독 endpoint 가 바뀌었으면 다시 등록. */
async function mirPushSyncNow(force) {
  const cfg = mirPushConfig();
  const st = mirPushState();
  if (!cfg.ready || !st || !window.MirPushCore) return;
  const sub = await mirPushCurrentSubscription();
  const store = mirPushStore();
  const lists = mirPushLists(store);
  const hash = window.MirPushCore.shortHash(JSON.stringify([store.prefs, lists]));
  try {
    if (!sub) {
      // 브라우저에서 권한을 거두었거나 구독이 사라졌다 — 서버 쪽도 지운다.
      await mirPushApi("/push/unsubscribe", { endpoint: st.endpoint }).catch(() => {});
      mirPushSetState(null);
      renderPushAlerts();
      return;
    }
    if (sub.endpoint !== st.endpoint) {
      const res = await mirPushApi("/push/subscribe", { subscription: sub.toJSON(), prefs: store.prefs, lists, syncClientId: mirPushSyncClientId(store) });
      if (res.ok) {
        await mirPushApi("/push/unsubscribe", { endpoint: st.endpoint }).catch(() => {});
        mirPushSetState({ endpoint: sub.endpoint, hash, syncedAt: Date.now() });
      }
      return;
    }
    if (!force && st.hash === hash && Date.now() - (Number(st.syncedAt) || 0) < MIR_PUSH_RESYNC_MS) return;
    const res = await mirPushApi("/push/prefs", { endpoint: st.endpoint, prefs: store.prefs, lists, syncClientId: mirPushSyncClientId(store) });
    if (res.ok) mirPushSetState({ ...st, hash, syncedAt: Date.now() });
    else if (res.status === 404) { mirPushSetState(null); renderPushAlerts(); }
  } catch (_) { /* 네트워크 — 다음 변경 때 다시 */ }
}

function mirPushScheduleListSync(force) {
  clearTimeout(mirPushSyncTimer);
  mirPushSyncTimer = setTimeout(() => { mirPushSyncNow(force); }, 2000);
}

// ----- 렌더 -----
function mirPushEsc(s) {
  return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function mirPushNotice(env, cfg) {
  if (!cfg.ready) return { kind: "wait", text: "준비 중 — 알림 서버를 연결하는 중입니다. 연결되면 이 자리에서 켤 수 있습니다." };
  if (env.ios && !env.standalone) {
    return { kind: "ios", text: "iPhone·iPad 는 Safari 공유 버튼 → '홈 화면에 추가'로 설치한 뒤, 홈 화면 아이콘으로 열어야 알림을 받을 수 있습니다(iOS 16.4 이상)." };
  }
  if (!env.supported) return { kind: "unsupported", text: "이 브라우저는 웹 푸시 알림을 지원하지 않습니다. 최신 Chrome·Edge·Firefox·Safari 에서 열어 주세요." };
  if (env.permission === "denied") return { kind: "denied", text: "이 사이트의 알림 권한이 차단돼 있습니다. 주소창 왼쪽 사이트 설정에서 알림을 '허용'으로 바꾼 뒤 다시 시도해 주세요." };
  return null;
}

function renderPushAlerts() {
  const box = typeof byId === "function" ? byId("pushAlertBox") : document.getElementById("pushAlertBox");
  if (!box || !window.MirPushCore) return;
  const cfg = mirPushConfig();
  const env = mirPushEnv();
  const notice = mirPushNotice(env, cfg);
  const st = mirPushState();
  const on = Boolean(st) && !notice;
  const store = mirPushStore();
  const p = store.prefs;
  const disabled = Boolean(notice) || mirPushBusy;
  const dis = disabled ? " disabled" : "";
  const autoCount = mirPushAutoLevels().length;
  const chk = (id, v) => `<input id="${id}" type="checkbox"${v ? " checked" : ""}${dis}>`;
  const manualRows = store.manual.map((l, i) => `
      <li><span>${mirPushEsc(typeof stockLabel === "function" ? stockLabel(l.t) : l.t)}</span>
        <span>${l.dir === "above" ? "▲ 이상" : "▼ 이하"} ${mirPushEsc(window.MirPushCore.fmtPrice(l.price, window.MirPushCore.marketOf(l.t)))}</span>
        <button type="button" class="ghost compact-btn" data-push-remove="${i}" aria-label="가격 알림 삭제"${dis}>✕</button></li>`).join("");
  box.innerHTML = `
    <div class="push-alert-head">
      <div>
        <h4>푸시 알림 <span class="push-alert-badge ${on ? "is-on" : notice ? "is-wait" : ""}">${on ? "켜짐" : notice && notice.kind === "wait" ? "준비 중" : "꺼짐"}</span></h4>
        <p class="muted">사이트를 닫아도 조건에 맞으면 이 기기로 알립니다. 30분마다 확인 · 시세는 야후 지연 시세 · 사실 알림(추천 아님).</p>
      </div>
      <div class="push-alert-actions">
        ${notice && notice.kind === "wait" ? "" : on
          ? `<button type="button" class="ghost compact-btn" id="pushTestBtn"${dis}>테스트 알림</button>
             <button type="button" class="ghost compact-btn" id="pushOffBtn"${mirPushBusy ? " disabled" : ""}>알림 끄기</button>`
          : `<button type="button" class="primary compact-btn" id="pushOnBtn"${dis}>이 기기에서 알림 받기</button>`}
      </div>
    </div>
    ${notice ? `<p class="push-alert-notice push-alert-notice-${notice.kind}" role="note">${mirPushEsc(notice.text)}</p>` : ""}
    <div class="watch-alert-controls push-alert-controls"${notice && notice.kind === "wait" ? " hidden" : ""}>
      <label>${chk("pushUseMove", p.kinds.move)}<span>관심·보유 등락 ±</span><input id="pushMovePct" type="number" min="1" max="30" step="0.5" value="${p.movePct}" aria-label="등락률 기준 퍼센트"${dis}><em>%</em></label>
      <label class="watch-alert-toggle-only">${chk("pushUseLevel", p.kinds.level)}<span>가격 도달(아래 직접 입력 + 가설·매매일지 목표가·손절가 ${autoCount}개)</span></label>
      <label class="watch-alert-toggle-only">${chk("pushUseEarnings", p.kinds.earnings)}<span>실적 발표 하루 전(D-1)</span></label>
      <label class="watch-alert-toggle-only">${chk("pushUseDisclosure", p.kinds.disclosure)}<span>새 공시(미국 8-K · 국내 DART 주요 공시)</span></label>
      <div class="push-alert-digest"><label class="watch-alert-toggle-only">${chk("pushUseDigest", p.kinds.digest)}<span>하루 한 번 '오늘 내 주식은' 요약</span></label>
        <span class="push-alert-markets"><label>${chk("pushDigestUs", p.digestMarkets.includes("us"))}<span>미국 07:30</span></label><label>${chk("pushDigestKr", p.digestMarkets.includes("kr"))}<span>국내 20:00</span></label></span></div>
      <label class="watch-alert-toggle-only">${chk("pushUseSync", p.useSync)}<span>클라우드 동기화 목록 자동 사용(다른 기기에서 바꾼 관심·보유도 반영)</span></label>
      <label class="push-alert-max"><span aria-hidden="true"></span><span>하루 최대 알림(요약 포함)</span><input id="pushMaxPerDay" type="number" min="1" max="12" step="1" value="${p.maxPerDay}" aria-label="하루 최대 알림 수"${dis}><em>건</em></label>
    </div>
    <form class="push-level-form" id="pushLevelForm"${notice && notice.kind === "wait" ? " hidden" : ""}>
      <input id="pushLevelTicker" type="text" placeholder="종목 (예: NVDA, 삼성전자)" autocomplete="off" aria-label="가격 알림 종목"${dis}>
      <input id="pushLevelPrice" type="number" min="0" step="any" placeholder="가격" aria-label="알림 가격"${dis}>
      <select id="pushLevelDir" aria-label="방향"${dis}><option value="auto">자동(현재가 기준)</option><option value="above">이상 ▲</option><option value="below">이하 ▼</option></select>
      <button type="submit" class="ghost compact-btn"${dis}>가격 알림 추가</button>
    </form>
    ${manualRows ? `<ul class="push-level-list">${manualRows}</ul>` : ""}
    <p class="push-alert-status muted" id="pushAlertStatus" aria-live="polite">${mirPushEsc(mirPushStatusMsg)}</p>`;
}

function mirPushReadPrefsFromUi(prev) {
  const v = (id) => document.getElementById(id);
  const markets = [];
  if (v("pushDigestUs") && v("pushDigestUs").checked) markets.push("us");
  if (v("pushDigestKr") && v("pushDigestKr").checked) markets.push("kr");
  return window.MirPushCore.normalizePrefs({
    kinds: {
      move: Boolean(v("pushUseMove") && v("pushUseMove").checked),
      level: Boolean(v("pushUseLevel") && v("pushUseLevel").checked),
      earnings: Boolean(v("pushUseEarnings") && v("pushUseEarnings").checked),
      disclosure: Boolean(v("pushUseDisclosure") && v("pushUseDisclosure").checked),
      digest: Boolean(v("pushUseDigest") && v("pushUseDigest").checked),
    },
    movePct: v("pushMovePct") ? v("pushMovePct").value : prev.movePct,
    maxPerDay: v("pushMaxPerDay") ? v("pushMaxPerDay").value : prev.maxPerDay,
    digestMarkets: markets,
    useSync: Boolean(v("pushUseSync") && v("pushUseSync").checked),
  });
}

function mirPushAddLevel() {
  const store = mirPushStore();
  const raw = String(document.getElementById("pushLevelTicker")?.value || "").trim();
  const price = Number(document.getElementById("pushLevelPrice")?.value);
  let dir = document.getElementById("pushLevelDir")?.value || "auto";
  const ticker = typeof resolveTickerQuery === "function" ? resolveTickerQuery(raw) : window.MirPushCore.cleanTicker(raw);
  if (!ticker || !(price > 0)) {
    mirPushStatusMsg = "종목과 가격을 확인해 주세요(현재 시장 모드에서 찾을 수 있는 종목).";
    renderPushAlerts();
    return;
  }
  if (dir === "auto") {
    const row = typeof stockByTicker === "function" ? stockByTicker(ticker) : null;
    const now = row && Number(row.price);
    dir = now > 0 && price < now ? "below" : "above";
  }
  if (store.manual.length >= 20) {
    mirPushStatusMsg = "직접 입력한 가격 알림은 20개까지입니다.";
    renderPushAlerts();
    return;
  }
  store.manual.push({ t: ticker, price, dir });
  mirPushSaveStore(store);
  mirPushStatusMsg = "";
  renderPushAlerts();
  mirPushScheduleListSync();
}

function setupPushAlerts() {
  const box = document.getElementById("pushAlertBox");
  if (!box || box.dataset.bound) return;
  box.dataset.bound = "1";
  box.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("#pushOnBtn")) mirPushSubscribe();
    else if (t.closest("#pushOffBtn")) mirPushUnsubscribe();
    else if (t.closest("#pushTestBtn")) mirPushTest();
    else {
      const rm = t.closest("[data-push-remove]");
      if (rm) {
        const store = mirPushStore();
        store.manual.splice(Number(rm.getAttribute("data-push-remove")), 1);
        mirPushSaveStore(store);
        renderPushAlerts();
        mirPushScheduleListSync();
      }
    }
  });
  box.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof Element) || t.closest("#pushLevelForm")) return;
    const store = mirPushStore();
    store.prefs = mirPushReadPrefsFromUi(store.prefs);
    mirPushSaveStore(store);
    renderPushAlerts();
    mirPushScheduleListSync();
  });
  box.addEventListener("submit", (e) => {
    if (!(e.target instanceof Element) || e.target.id !== "pushLevelForm") return;
    e.preventDefault();
    mirPushAddLevel();
  });
  renderPushAlerts();
  // 구독 중이면 한 번 맞춰 둔다(endpoint 교체·권한 회수·7일 경과). 부팅 데이터가 들어온 뒤에.
  if (mirPushState()) setTimeout(() => mirPushSyncNow(false), 6000);
}

window.MirPush = {
  render: renderPushAlerts,
  scheduleListSync: mirPushScheduleListSync,
  config: mirPushConfig,
  env: mirPushEnv,
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupPushAlerts);
else setupPushAlerts();
