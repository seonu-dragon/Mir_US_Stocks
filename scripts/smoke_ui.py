"""브라우저 스모크 테스트 — 로컬 PASS 가 아니라 '실제로 렌더되는지'를 본다.

이 사이트의 사고는 대부분 로컬 단위 검증으로는 안 잡히는 종류였다(피처 데이터가
패널 렌더보다 늦게 도착, 배포는 됐는데 반영 안 됨, 탭을 열어야만 나는 오류).
그래서 검증도 실제 브라우저에서 탭을 열어보는 방식이어야 한다.

전제:
    py -m pip install playwright && py -m playwright install chromium

사용법:
    py -m http.server 8099 --bind 127.0.0.1     # 레포 루트에서
    py scripts/smoke_ui.py                      # 실패하면 exit 1
    py scripts/smoke_ui.py --base http://127.0.0.1:8099/index.html
    py scripts/smoke_ui.py --shots outputs/smoke   # 스크린샷도 남김
"""
from __future__ import annotations

import argparse
import json
import sys
import traceback
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright 가 없다: py -m pip install playwright && py -m playwright install chromium",
          file=sys.stderr)
    raise SystemExit(2)

# 2026-09 IA 재편: 상단 탭 4개(today/market/search/bulk) + 숨은 community. 옛 이름은
# 별칭으로 남아 있어야 한다(?tab=signals → 시장/시그널 등).
TABS = ["today", "market", "search", "bulk", "map", "sector", "signals", "institutional",
        "health", "calendar", "community", "ai-briefing"]
# 옛 딥링크 → (상단 탭, 활성 잎/서브) 기대값
LEGACY_LINKS = {
    "?tab=signals": ("market", "signals"),
    "?tab=sector": ("market", "sector"),
    "?tab=breadth": ("market", "health"),
    "?tab=marketdata": ("market", "health"),
    "?tab=calendar": ("today", "calendar"),
    "?tab=briefing": ("today", "ai-briefing"),
    "?tab=institutional&sub=congress": ("search", "congress"),
    "?tab=search&sub=analysis&ticker=AAPL": ("search", "analysis"),
    "?tab=community": ("community", "community"),
}

fails: list[str] = []
errors: list[str] = []
shots_dir: Path | None = None


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS  " if ok else "FAIL  ") + name + (f" -- {detail}" if detail else ""), flush=True)
    if not ok:
        fails.append(name)


def watch(page) -> None:
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console",
            lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" else None)


def boot(page, url: str) -> None:
    """'load' 는 스냅샷 JS·이미지까지 기다리느라 안 끝날 수 있어 쓰지 않는다.

    다만 app.js 가 평가됐다는 것(showAppToast 존재)만으로는 부족하다 — 시장
    스냅샷은 5.8MB 라 그 뒤로도 한참 더 내려온다. localhost 에서는 순식간이라
    안 드러나지만 --base 로 라이브를 때리면 아직 빈 화면인 상태로 단언하게 된다.
    스냅샷 전역과 실제 종목 수까지 확인해야 '준비됨'이다.
    """
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_function("() => typeof window.showAppToast === 'function'", timeout=60000)
    # 스냅샷은 http 에서 JSON 으로 fetch 되므로 window.MARKET_SNAPSHOT 은 안 채워진다
    # (그 전역은 file:// 폴백용). 앱 내부 `data` 는 classic script 의 최상위 let 이라
    # 그냥 이름으로 읽힌다. 부팅 직후에는 fallbackData(소수 종목)가 들어 있으므로,
    # 실제 스냅샷(수천 종목)으로 교체됐는지를 개수로 가른다.
    page.wait_for_function(
        "() => typeof data !== 'undefined' && data && Array.isArray(data.stocks)"
        " && data.stocks.length > 100", timeout=90000)
    page.wait_for_timeout(2600)


def shoot(target, name: str) -> None:
    if shots_dir:
        target.screenshot(path=str(shots_dir / f"{name}.png"))


def test_deeplinks(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)

    boot(page, base)
    check("홈 진입은 스크롤하지 않음", page.evaluate("window.pageYOffset") < 5)

    for tab in TABS:
        boot(page, f"{base}?tab={tab}")
        # 단발 샘플은 레이스다: idle 프리로드 피처가 boot 직후(~2.5초+네트워크)
        # 상단 레이아웃을 키우면 앱의 재정렬(interval 6s + ResizeObserver 20s)이
        # 잡기 전 순간을 찍어 위양성 FAIL 이 났다(라이브에서만 간헐 재현).
        # "일정 시간 안에 정렬 상태에 도달"을 검증하는 폴링으로 바꾼다.
        cond = """() => {
          const wrap = document.getElementById('tabsScrollWrap');
          if (!wrap) return false;
          const y = window.pageYOffset;
          const top = wrap.getBoundingClientRect().top;
          const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          const atEnd = Math.abs(y - max) <= 4;
          // 문서가 뷰포트보다 짧으면(내 투자 빈 상태 등) 스크롤할 곳이 없다 — 그건 통과.
          return (y > 100 || max < 100) && ((top > -20 && top < 60) || atEnd);
        }"""
        try:
            page.wait_for_function(cond, timeout=9000)
            ok = True
        except Exception:
            ok = False
        st = page.evaluate("""() => ({
          y: window.pageYOffset,
          top: document.getElementById('tabsScrollWrap').getBoundingClientRect().top,
          max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
          active: document.querySelector('.tab.is-active')?.dataset.tab,
        })""")
        check(f"?tab={tab} 딥링크가 본문으로 이동", ok,
              f"y={st['y']:.0f}/max={st['max']:.0f} 탭바top={st['top']:.0f} active={st['active']}")

    for query, (tab, leaf) in LEGACY_LINKS.items():
        boot(page, f"{base}{query}")
        page.wait_for_timeout(600)
        st = page.evaluate("""() => ({
          tab: document.querySelector('#mainTabs .tab.is-active')?.dataset.tab,
          cur: currentTab, sub: typeof searchSubTab === 'string' ? searchSubTab : null,
          panel: document.querySelector('main > .panel.is-active')?.id,
          ticker: typeof selectedTicker === 'string' ? selectedTicker : null,
        })""")
        ok = st["tab"] == tab and (st["cur"] == leaf or st["sub"] == leaf)
        if "ticker=AAPL" in query:
            ok = ok and st["ticker"] == "AAPL"
        check(f"옛 딥링크 {query} → {tab}/{leaf}", ok, str(st))
    page.close()


def test_dialogs(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 1100, "height": 800})
    watch(page)
    boot(page, base)

    # NOTE: evaluate 의 마지막 표현식이 Promise 면 playwright 가 그 resolve 를 기다린다.
    # 다이얼로그는 사용자가 닫아야 resolve 되므로 반드시 값을 반환하지 않게 감쌀 것.
    page.evaluate("() => { window.__r = null; showAppConfirm('삭제할까요?',"
                  "{title:'삭제 확인', okLabel:'삭제', danger:true}).then(v => window.__r = v); }")
    page.wait_for_selector("dialog.app-dialog", state="visible", timeout=5000)
    dlg = page.locator("dialog.app-dialog")
    check("confirm 다이얼로그가 모달로 열림",
          page.evaluate("() => document.querySelector('dialog.app-dialog').matches(':modal')"))
    check("확인 버튼에 포커스", page.evaluate("document.activeElement.textContent") == "삭제")
    shoot(dlg, "dialog-confirm")
    page.click("dialog.app-dialog .app-dialog-btn.is-primary")
    page.wait_for_timeout(400)
    check("확인 → true", page.evaluate("window.__r") is True)
    check("닫으면 DOM 에서 제거", page.locator("dialog.app-dialog").count() == 0)

    page.evaluate("() => { window.__r='x'; showAppConfirm('취소 테스트').then(v => window.__r=v); }")
    page.wait_for_selector("dialog.app-dialog", state="visible", timeout=5000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    check("Esc 는 취소(false)", page.evaluate("window.__r") is False)

    page.evaluate("() => { window.__r='x'; showAppPrompt('사유','').then(v => window.__r=v); }")
    page.wait_for_selector("dialog.app-dialog input.app-dialog-input", state="visible", timeout=5000)
    check("prompt 입력칸에 포커스",
          page.evaluate("document.activeElement.className") == "app-dialog-input")
    page.keyboard.type("스팸")
    shoot(page.locator("dialog.app-dialog"), "dialog-prompt")
    page.keyboard.press("Enter")
    page.wait_for_timeout(400)
    check("prompt Enter → 입력값", page.evaluate("window.__r") == "스팸")

    page.evaluate("() => { window.__r='x'; showAppPrompt('사유','').then(v => window.__r=v); }")
    page.wait_for_selector("dialog.app-dialog", state="visible", timeout=5000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    check("prompt 취소 → null (네이티브와 같은 계약)", page.evaluate("window.__r") is None)

    # 실제 호출부까지: 취소하면 삭제 요청이 나가면 안 된다.
    page.evaluate("""() => {
      window.__del = [];
      const orig = window.fetch;
      window.fetch = async (u, o) => {
        if (o && String(o.method).toUpperCase() === 'DELETE') {
          window.__del.push(String(u));
          return { ok: true, json: async () => ({}) };
        }
        return orig(u, o);
      };
    }""")
    page.evaluate("() => { deleteCommunityPost('smoke-1'); }")
    page.wait_for_selector("dialog.app-dialog", state="visible", timeout=5000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(600)
    check("삭제를 취소하면 요청이 나가지 않음", page.evaluate("window.__del.length") == 0)

    page.evaluate("() => { deleteCommunityPost('smoke-2'); }")
    page.wait_for_selector("dialog.app-dialog", state="visible", timeout=5000)
    page.click("dialog.app-dialog .app-dialog-btn.is-primary")
    page.wait_for_timeout(800)
    check("삭제를 확인하면 요청이 나감", page.evaluate("window.__del.length") == 1)
    page.close()


def test_trust_center(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)
    boot(page, f"{base}?tab=health")
    page.evaluate("() => openDataTrustCenter()")
    check("신뢰도 센터가 다이얼로그로 열림",
          page.evaluate("() => document.getElementById('dataTrustDialog').open === true"))

    # 지연 로딩 데이터셋이 도착하기 전에는 '데이터 없음'이 아니라 '불러오는 중'이어야 하고,
    # 도착하면 실제 상태로 바뀌어야 한다.
    page.wait_for_function(
        "() => document.querySelectorAll('.data-trust-card.trust-pending').length === 0",
        timeout=60000)
    page.wait_for_timeout(1500)

    cards = page.locator(".data-trust-card")
    n = cards.count()
    check("신뢰도 카드 렌더", n > 0, f"{n}장")
    check("모든 카드에 원인·조치 패널", page.locator(".data-trust-detail").count() == n)
    check("지연 로딩이 '데이터 없음'으로 오분류되지 않음",
          page.locator(".data-trust-card.trust-missing").count() <= 2,
          f"missing={page.locator('.data-trust-card.trust-missing').count()}")

    # 이 검사의 목적은 "같은 파일을 무한 재요청"(과거 404 루프류) 검출이다.
    # before == after 로 걸면 라이브에서 idle 프리로드 꼬리 1~3건이 3초 창에
    # 걸릴 때마다 위양성이 난다(app.js 분할 후 파싱 타이밍 이동으로 표면화).
    # 진짜 병리만 잡는다: 같은 URL 3회 이상 또는 창 안 신규 6건 이상.
    before = page.evaluate("() => performance.getEntriesByType('resource')"
                           ".filter(r => /data\\/.*\\.js/.test(r.name)).length")
    page.wait_for_timeout(3000)
    stats = page.evaluate("""() => {
      const names = performance.getEntriesByType('resource')
        .filter(r => /data\\/.*\\.js/.test(r.name)).map(r => r.name);
      const counts = {};
      for (const n of names) counts[n] = (counts[n] || 0) + 1;
      const maxDup = Math.max(0, ...Object.values(counts));
      return { total: names.length, maxDup };
    }""")
    delta = stats["total"] - before
    check("데이터 재요청이 폭주하지 않음", delta < 6 and stats["maxDup"] < 3,
          f"{before} → {stats['total']} (동일 URL 최다 {stats['maxDup']}회)")

    cards.first.locator("summary").click()
    page.wait_for_timeout(250)
    txt = cards.first.inner_text()
    for label in ("영향받는 화면", "원인", "조치"):
        check(f"상세에 '{label}' 표시", label in txt)
    href = page.locator(".data-trust-link").first.get_attribute("href") or ""
    check("실행 이력 링크가 이 레포 Actions 를 가리킴",
          href.startswith("https://github.com/seonu-dragon/Mir_US_Stocks/actions"), href)

    shoot(page.locator(".data-trust-center"), "trust-center")
    page.close()


def test_worker_no_client_id_leak(browser, _base: str) -> None:
    """워커가 남의 clientId 를 응답에 싣지 않는지.

    clientId 는 삭제 권한의 근거라(handleCommunityDelete 의 target.clientId 비교),
    목록 응답에 실리면 누구나 남의 글·댓글을 지울 수 있다. 워커는 대시보드 수동
    배포라 여기서 띄울 수 없으므로, 모듈을 브라우저에 import 해 가짜 KV 로
    fetch() 를 직접 호출하고 응답 본문을 검사한다.
    """
    worker_src = (Path(__file__).resolve().parent.parent / "worker" / "yahoo-proxy.js")
    if not worker_src.exists():
        check("worker 소스 존재", False, str(worker_src))
        return

    stored = [
        {"id": "p1", "author": "나", "content": "내 글", "createdAt": "2026-01-01T00:00:00Z",
         "clientId": "CID-ME", "likes": ["CID-ME", "CID-OTHER"],
         "reports": [{"by": "CID-X", "reason": "스팸"}],
         "comments": [{"id": "c1", "author": "나", "content": "댓글", "clientId": "CID-ME"},
                      {"id": "c2", "author": "남", "content": "댓글", "clientId": "CID-OTHER"}]},
        {"id": "p2", "author": "남", "content": "남의 글", "createdAt": "2026-01-01T00:00:00Z",
         "clientId": "CID-OTHER", "likes": ["CID-OTHER"], "comments": []},
    ]
    runner = """
    async (args) => {
      const [src, stored, query] = args;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const mod = await import(url);
      const env = { COMMUNITY_KV: { _v: JSON.stringify(stored),
        async get() { return this._v; }, async put(k, v) { this._v = v; } } };
      const req = new Request('https://w.example/community' + query, { method: 'GET' });
      const resp = await mod.default.fetch(req, env, { waitUntil() {} });
      return { status: resp.status, body: await resp.text() };
    }
    """
    page = browser.new_page()
    page.goto("about:blank")
    src = worker_src.read_text(encoding="utf-8")

    res = page.evaluate(runner, [src, stored, "?clientId=CID-ME"])
    check("worker 모듈이 로드되고 200 응답", res["status"] == 200, res["status"])
    body = res["body"]
    check("응답에 clientId 값이 전혀 없음", "CID-" not in body,
          "유출!" if "CID-" in body else "")
    check("신고 이력 미노출", "reports" not in body and "스팸" not in body)

    data = json.loads(body)
    p1 = next(p for p in data["posts"] if p["id"] == "p1")
    p2 = next(p for p in data["posts"] if p["id"] == "p2")
    check("요청자 글만 mine=true", p1["mine"] is True and p2["mine"] is False)
    check("likes 배열 대신 집계값", "likes" not in p1 and p1["likeCount"] == 2)
    check("댓글도 mine 으로만 노출",
          [c["mine"] for c in p1["comments"]] == [True, False]
          and all("clientId" not in c for c in p1["comments"]))

    anon = json.loads(page.evaluate(runner, [src, stored, ""])["body"])
    check("익명 요청은 전부 mine=false", all(p["mine"] is False for p in anon["posts"]))
    page.close()


def test_kr_market(browser, base: str) -> None:
    """KR 로 전환했을 때 데이터가 없는 기능이 닫혀 있고, KR 전용 소스가 감시되는지.

    KR 은 US 와 데이터 구성이 다른데 US 만 보고 넘어가기 쉽다. 실제로
      - 실적 예정일: KR 소스가 없는데 코드가 US 구조를 흉내내 매번 404 + 빈 화면
      - 신뢰도 센터: KR DART·지분이 목록에 없어, 그 데이터가 배포 안 되는 동안에도
        "정상"만 보여줬다
    둘 다 US 화면에서는 절대 드러나지 않는다.
    """
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)
    bad: list[str] = []
    page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)

    boot(page, base)
    page.evaluate("() => { window.MirMarket.setMode('kr'); }")
    page.wait_for_timeout(600)

    boot(page, f"{base}?tab=calendar")
    check("[KR] 데이터 없는 실적 서브탭은 숨김", page.evaluate("""() => {
      const b = document.querySelector('#calendarSubTabs [data-sub="earnings"]');
      return !!b && (b.hidden || getComputedStyle(b).display === 'none');
    }"""))
    check("[KR] 없는 파일을 요청하지 않음(404 없음)",
          not any("earnings_calendar" in x for x in bad),
          "; ".join(x for x in bad if "earnings_calendar" in x))

    boot(page, f"{base}?tab=calendar&sub=earnings")
    body = page.locator("#earningsCalendarBody").inner_text()
    check("[KR] 딥링크로 들어와도 이유를 밝힘",
          "제공하지 않습니다" in body and "불러오는 중" not in body,
          body.replace("\n", " ")[:80])

    boot(page, f"{base}?tab=health")
    page.evaluate("() => openDataTrustCenter()")
    try:
        page.wait_for_function(
            "() => document.querySelectorAll('.data-trust-card.trust-pending').length === 0",
            timeout=45000)
    except Exception:
        pass
    page.wait_for_timeout(1000)
    names = page.evaluate("""() => [...document.querySelectorAll('.data-trust-card')]
        .map(c => c.querySelector('strong')?.textContent)""")
    check("[KR] DART 공시·지분 공시가 감시 목록에 있음",
          "DART 공시" in names and "지분 공시" in names, str(names))
    # 2026-07-21 KRX 공매도 잔고 실연동. 예전엔 실데이터가 없어 '미노출'이 정답이었지만
    # 이제는 감시 목록에 있어야 하고, 패널도 잔고비중으로 실제 렌더돼야 한다.
    check("[KR] 공매도가 감시 목록에 있음(KRX 실연동)", "공매도" in names, str(names))
    check("[KR] 신뢰도 카드에 결손 없음",
          page.locator(".data-trust-card.trust-missing").count() == 0)

    boot(page, f"{base}?tab=search&sub=short")
    page.wait_for_function("() => !!document.querySelector('#shortTable table')", timeout=30000)
    hdr = page.locator("#shortTable thead").inner_text()
    check("[KR] 공매도 패널 헤더가 '잔고비중'", "잔고비중" in hdr, hdr.replace("\n", " "))
    n_rows = page.evaluate("() => document.querySelectorAll('#shortTable tbody tr').length")
    check("[KR] 공매도 실데이터 행 렌더", n_rows > 10, f"{n_rows}행")
    ratio_ok = page.evaluate(
        "() => /%$/.test((document.querySelector('#shortTable tbody tr td.ins-num strong')"
        "?.textContent || '').trim())")
    check("[KR] 1차 지표가 퍼센트(잔고비중)", ratio_ok)
    check("[KR] 공매도 기준일 표기", "기준일" in page.locator("#shortMeta").inner_text())
    page.close()


def test_tab_a11y(browser, base: str) -> None:
    """탭이 WAI-ARIA tablist 로 읽히고 키보드로 다닐 수 있는지.

    원래 role/aria-selected 가 하나도 없어서 스크린리더에는 버튼 더미로 읽혔다.
    """
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)
    boot(page, base)

    navs = page.evaluate("""() => ['mainTabs','todaySubTabs','marketSubTabs','bulkSubTabs',
      'findModeSeg','discSubTabs','sectorSubTabs','searchSubTabs',
      'institutionalSubTabs','calendarSubTabs','communitySubTabs'].map(id => {
        const n = document.getElementById(id);
        if (!n) return { id, missing: true };
        const btns = [...n.querySelectorAll('[role=tab]')];
        return { id, role: n.getAttribute('role'), tabs: btns.length,
          wired: btns.length > 0 && btns.every(b => {
            const p = document.getElementById(b.getAttribute('aria-controls') || '');
            return b.hasAttribute('aria-selected') && p
              && p.getAttribute('role') === 'tabpanel'
              && (p.getAttribute('aria-labelledby') || '').split(' ').includes(b.id);
          }),
          selected: btns.filter(b => b.getAttribute('aria-selected') === 'true').length,
          roving: btns.filter(b => b.tabIndex === 0).length };
      })""")
    for n in navs:
        if n.get("missing"):
            check(f"{n['id']} 존재", False)
            continue
        check(f"{n['id']} tablist/tab/tabpanel 연결",
              n["role"] == "tablist" and n["wired"], f"{n['tabs']}개 탭")
        check(f"{n['id']} 선택 1개 · roving tabindex 1개",
              n["selected"] == 1 and n["roving"] == 1,
              f"selected={n['selected']} roving={n['roving']}")

    # 화살표 이동. 리스너가 중복 등록되면 한 번에 두 칸씩 넘어간다(실제로 그랬다).
    page.evaluate("() => setViewMode('advanced')")
    page.wait_for_timeout(1200)
    order = page.evaluate("""() => [...document.querySelectorAll('#mainTabs [role=tab]')]
        .filter(b => !b.hidden && b.offsetParent !== null).map(b => b.dataset.tab)""")
    page.evaluate("() => document.querySelector('#mainTabs [role=tab]').focus()")
    seq = [page.evaluate("() => document.activeElement.dataset.tab")]
    for _ in range(3):
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(400)
        seq.append(page.evaluate("() => document.activeElement.dataset.tab"))
    steps = [order.index(seq[i + 1]) - order.index(seq[i]) for i in range(len(seq) - 1)]
    check("→ 는 정확히 한 칸씩 이동", steps == [1, 1, 1], f"{' → '.join(seq)} {steps}")
    check("이동한 탭의 패널이 열림", page.evaluate("""() => {
      const b = document.activeElement;
      const p = document.getElementById(b.getAttribute('aria-controls'));
      return !!p && p.classList.contains('is-active')
        && b.getAttribute('aria-selected') === 'true';
    }"""))
    page.keyboard.press("End")
    page.wait_for_timeout(400)
    check("End 로 마지막 탭",
          page.evaluate("() => document.activeElement.dataset.tab") == order[-1], order[-1])
    page.close()


def test_ticker_deeplink_seo(browser, base: str) -> None:
    """종목 딥링크가 색인 가능한 형태인지 + sitemap 이 그 URL 들과 맞는지.

    canonical 이 쿼리 없는 analysis.html 로 고정돼 있으면 ?t= URL 을 sitemap 에
    올려도 검색엔진은 전부 중복으로 보고 버린다. 둘은 같이 맞아야 의미가 있다.
    """
    root = Path(__file__).resolve().parent.parent
    sitemap = root / "sitemap.xml"
    if not sitemap.exists():
        check("sitemap.xml 존재", False)
        return

    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [u.findtext("s:loc", namespaces=ns)
            for u in ET.parse(sitemap).findall("s:url", ns)]
    check("sitemap 에 종목 딥링크 수록", sum("?t=" in (l or "") for l in locs) > 0,
          f"{len(locs)} URL")
    check("sitemap 이중 이스케이프 없음", not any("&amp;" in (l or "") for l in locs))
    check("sitemap 중복 URL 없음", len(locs) == len(set(locs)))

    missing = []
    for loc in locs:
        if "?t=" not in loc:
            continue
        q = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
        ticker = q.get("t", [""])[0]
        kr = q.get("market", [""])[0] == "kr"
        path = (root / "data" / "korea" / "details" / f"{ticker}.json") if kr \
            else (root / "data" / "details" / f"{ticker}.json")
        if not path.exists():
            missing.append(ticker)
    check("딥링크 종목에 상세 데이터 존재", not missing, f"누락 {missing[:5]}")

    analysis = base.replace("index.html", "analysis.html")
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)

    def meta(sel, attr="content"):
        return page.evaluate(
            "([s, a]) => { const e = document.head.querySelector(s);"
            " return e ? e.getAttribute(a) : null; }", [sel, attr])

    page.goto(f"{analysis}?t=NVDA", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_function("() => document.title.includes('NVDA')", timeout=60000)
    page.wait_for_timeout(1200)
    canon = meta('link[rel="canonical"]', "href") or ""
    check("종목 페이지 canonical 이 그 종목", canon.endswith("analysis.html?t=NVDA"), canon)
    check("제목·OG 도 종목별",
          "NVDA" in page.title() and "NVDA" in (meta('meta[property="og:title"]') or ""),
          page.title())
    check("분석이 실제로 렌더", page.evaluate(
        "() => document.body.innerText.includes('확률')"
        " && !document.body.innerText.includes('찾을 수 없습니다')"))

    page.goto(analysis, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)
    base_canon = meta('link[rel="canonical"]', "href") or ""
    check("종목 미지정이면 기본 canonical", base_canon.endswith("/analysis.html"), base_canon)
    page.close()


def test_mobile(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 390, "height": 844})
    watch(page)
    boot(page, base)
    # 헤더 캐러셀은 IA 재편으로 삭제 — 카드뉴스는 오늘 탭의 카드 1장(+더 보기)뿐이다.
    check("헤더 카드뉴스 캐러셀이 없음", page.locator(".cardnews-carousel").count() == 0)
    box = page.evaluate("""() => {
      const e = document.querySelector('#todayNews .ia-today-news-hero');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: r.width, h: r.height, hidden: document.getElementById('todayNews').hidden };
    }""")
    check("모바일 오늘의 뉴스 카드 렌더", box is not None and not box["hidden"])
    check("본문 가로 스크롤 없음",
          page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"))
    tabs_h = page.evaluate("() => Math.min(...[...document.querySelectorAll('#mainTabs .tab, .ia-sub-tabs .sub-tab')]"
                           ".filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height))")
    check("탭·서브탭 터치 타깃 44px 이상", tabs_h >= 44, f"min={tabs_h:.0f}px")
    shoot(page, "mobile-home")
    page.close()


def main() -> int:
    global shots_dir
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8099/index.html")
    ap.add_argument("--shots", default="", help="스크린샷을 저장할 디렉터리")
    args = ap.parse_args()

    if args.shots:
        shots_dir = Path(args.shots)
        shots_dir.mkdir(parents=True, exist_ok=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for fn in (test_deeplinks, test_dialogs, test_trust_center,
                       test_worker_no_client_id_leak, test_kr_market,
                       test_tab_a11y, test_ticker_deeplink_seo, test_mobile):
                print(f"\n--- {fn.__name__} ---", flush=True)
                fn(browser, args.base)
            browser.close()
    except Exception:
        print("EXCEPTION:\n" + traceback.format_exc(), file=sys.stderr)
        fails.append("예외 발생")

    print("\n--- JS 오류 ---")
    for e in dict.fromkeys(errors):
        print("  " + e)
    if not errors:
        print("  (없음)")

    print("\n" + ("FAILED: " + ", ".join(fails) if fails else "ALL PASS"))
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
