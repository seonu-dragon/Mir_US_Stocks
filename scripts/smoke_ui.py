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
import re
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
        "health", "calendar", "community", "ai-briefing", "industry"]
# 옛 딥링크 → (상단 탭, 활성 잎/서브) 기대값
LEGACY_LINKS = {
    "?tab=signals": ("market", "signals"),
    "?tab=sector": ("market", "sector"),
    "?tab=industry": ("market", "industry"),
    "?tab=industry&i=tsmc_monthly_rev": ("market", "industry"),
    "?tab=breadth": ("market", "health"),
    "?tab=marketdata": ("market", "health"),
    "?tab=calendar": ("today", "calendar"),
    "?tab=briefing": ("today", "ai-briefing"),
    "?tab=today&sub=feed": ("today", "feed"),
    "?tab=institutional&sub=congress": ("search", "congress"),
    "?tab=search&sub=analysis&ticker=AAPL": ("search", "analysis"),
    "?tab=search&sub=analysis&ticker=AAPL&view=fin": ("search", "analysis"),
    "?ticker=AAPL&view=val": ("search", "analysis"),
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
          // UI 1단계(2026-09-26)부터 히어로 검색은 오늘 탭에만 있어 다른 탭은 탭 바가 헤더 바로
          // 아래(문서 y≈70)에 온다 — 이미 본문 위라 스크롤 거리가 짧아도 통과.
          const docTop = top + y;
          return (y > 100 || max < 100 || docTop < 160) && ((top > -20 && top < 90) || atEnd);
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


# 종목 상세 7탭(stock-view.js) 딥링크: &view= 가 해당 탭을 열고, 옛 공유 링크(&dcf=)는 밸류 탭으로,
# view 가 없으면 차트. 탭을 누르면 URL 에 &view= 가 남는다.
STOCK_VIEW_LINKS = {
    "?tab=search&sub=analysis&ticker=AAPL": "chart",
    "?tab=search&sub=analysis&ticker=AAPL&view=overview": "overview",
    "?tab=search&sub=analysis&ticker=AAPL&view=fin": "fin",
    "?tab=search&sub=analysis&ticker=AAPL&view=val": "val",
    "?tab=search&sub=analysis&ticker=AAPL&view=events": "events",
    "?tab=search&sub=analysis&ticker=AAPL&view=flow": "flow",
    "?tab=search&sub=analysis&ticker=AAPL&view=ai": "ai",
    "?ticker=AAPL&view=valuation": "val",
    "?tab=search&sub=analysis&ticker=AAPL&dcf=x": "val",
    "?market=kr&tab=search&sub=analysis&ticker=005930&view=flow": "flow",
}


def test_stock_views(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)
    # AI 진단 탭은 열 때 LLM 리포트를 부른다 — 스모크에서는 막는다(무료 한도 보호).
    page.route("**/chat", lambda r: r.abort())
    page.route("**/chat?*", lambda r: r.abort())
    for query, want in STOCK_VIEW_LINKS.items():
        boot(page, f"{base}{query}")
        # 탭 카드 중 늦게 오는 피처 데이터(KR 수급 등)가 채워질 때까지 잠깐 기다린다.
        try:
            page.wait_for_function("() => { const el = document.querySelector('#stockMain .sd-view.is-active');"
                                   " return !!el && el.getBoundingClientRect().height > 0; }", timeout=10000)
        except Exception:
            pass
        st = page.evaluate("""() => ({
          sub: typeof searchSubTab === 'string' ? searchSubTab : null,
          view: typeof sdActiveView === 'function' ? sdActiveView() : null,
          btn: document.querySelector('#stockViewTabs .sd-tab.is-active')?.dataset.view,
          panel: document.querySelector('#stockMain .sd-view.is-active')?.dataset.view,
          visible: (() => { const el = document.querySelector('#stockMain .sd-view.is-active');
                            return !!el && el.getBoundingClientRect().height > 0; })(),
        })""")
        ok = st["sub"] == "analysis" and st["view"] == want and st["btn"] == want and st["panel"] == want and st["visible"]
        check(f"종목 상세 딥링크 {query} → {want}", ok, str(st))
    # 탭 클릭 → URL 에 view 가 남고, 숨은 탭 카드도 폭이 살아 있다(차트·재무 SVG).
    boot(page, f"{base}?market=us&tab=search&sub=analysis&ticker=AAPL")
    page.click('#stockViewTabs [data-view="fin"]')
    page.wait_for_timeout(300)
    url = page.evaluate("location.search")
    check("탭 클릭 → URL &view=fin", "view=fin" in url and "ticker=AAPL" in url, url)
    widths = page.evaluate("""() => ({
      chart: document.getElementById('priceChart')?.getBoundingClientRect().width || 0,
      fin: document.getElementById('sdv-fin')?.getBoundingClientRect().width || 0,
    })""")
    check("숨은 차트 탭의 차트도 폭 유지", widths["chart"] > 300, str(widths))
    page.click('#stockViewTabs [data-view="chart"]')
    page.wait_for_timeout(300)
    check("차트로 돌아오면 URL 에서 view 제거", "view=" not in page.evaluate("location.search"))
    shoot(page, "stock-detail")
    page.close()


# UI 3단계: 시그널·도구의 목차(toc-layout.js). 옛 딥링크(&dca= · &pfrisk= · &thesis=)는 그 도구를,
# &tool= / &sig= 는 해당 항목을 연다. 찾기 기본 보기는 표(find-table.js), 오늘 탭은 지수 캐러셀.
TOC_LINKS = {
    "?tab=tools&dca=SPY:100": ("#sub-bulk-tools", "dca"),
    "?tab=tools&pfrisk=1": ("#sub-bulk-tools", "pfrisk"),
    "?tab=tools&thesis=AAPL": ("#sub-bulk-tools", "thesis"),
    "?tab=tools&tool=stress": ("#sub-bulk-tools", "stress"),
    "?tab=signals&sig=yieldcurve": ("#tab-signals", "yieldcurve"),
}


def test_stage3_layout(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)
    for query, (root, want) in TOC_LINKS.items():
        boot(page, f"{base}{query}")
        st = page.evaluate("""([root, want]) => {
          const f = document.querySelector(`${root} details[data-toc-key='${want}']`);
          return { active: document.querySelector(`${root} .toc-item.is-active`)?.dataset.tocKey,
                   visible: !!f && f.open && f.getBoundingClientRect().height > 0 };
        }""", [root, want])
        check(f"목차 딥링크 {query} → {want}", st["active"] == want and st["visible"], str(st))
    boot(page, f"{base}?tab=find")
    st = page.evaluate("""() => ({ rows: document.querySelectorAll('#topStocksTableWrap tbody tr').length,
      cardsHidden: document.getElementById('topStocks').hidden })""")
    check("찾기 > 상위 종목 기본 = 표", st["rows"] > 0 and st["cardsHidden"], str(st))
    boot(page, f"{base}?tab=today")
    st = page.evaluate("""() => ({ cards: document.querySelectorAll('#indexStrip .home-idx-card').length,
      chart: document.querySelector('#homeIndexChart svg')?.getBoundingClientRect().width || 0 })""")
    check("오늘 > 지수 캐러셀 + 큰 차트", st["cards"] >= 2 and st["chart"] > 300, str(st))
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
    check("모든 카드에 상태 설명 패널", page.locator(".data-trust-detail").count() == n)
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

    # 조치가 필요한 카드는 상세가 이미 열려 있다(needsAction → <details open>).
    # summary 를 무조건 누르면 그 경우 오히려 닫혀 위양성이 났다 — 닫혀 있을 때만 연다.
    detail = cards.first.locator("details.data-trust-detail")
    if detail.count() and not detail.evaluate("d => d.open"):
        cards.first.locator("summary").click()
        page.wait_for_timeout(250)
    txt = cards.first.inner_text()
    for label in ("쓰이는 화면", "상태", "참고"):
        check(f"상세에 '{label}' 표시", label in txt)
    # 운영용 정보(워크플로우·빌더 파일명·Actions 링크)는 사용자 화면에 내지 않는다(2026-09-26).
    check("상세에 워크플로우·빌더 이름이 없음",
          "워크플로우" not in txt and "scripts/" not in txt and page.locator(".data-trust-link").count() == 0)

    # 데이터 건강(data/health_report.js, 일일 감시) — 상태·점검 시각·범주 5칸. 운영용 이름(워크플로우·빌더)은 없어야 한다.
    try:
        page.wait_for_selector("#dataHealthPanel:not([hidden])", timeout=15000)
        health_ok = True
    except Exception:
        health_ok = False
    check("데이터 건강 섹션 렌더", health_ok)
    if health_ok:
        htxt = page.locator("#dataHealthPanel").inner_text()
        check("데이터 건강 범주 5칸", page.locator("#dataHealthPanel .data-health-counts > div").count() == 5)
        check("데이터 건강에 점검 시각", "점검 " in htxt)
        check("데이터 건강에 워크플로우·빌더 이름이 없음", "scripts/" not in htxt and ".py" not in htxt, htxt[:120])

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

    # 2026-10-02: KR 실적 일정은 DART 발표 이력 기반 '추정' 예정일로 켰다(build_kr_earnings_calendar.py).
    boot(page, f"{base}?tab=calendar")
    check("[KR] 실적 서브탭 표시(추정 예정일)", page.evaluate("""() => {
      const b = document.querySelector('#calendarSubTabs [data-sub="earnings"]');
      return !!b && !b.hidden && getComputedStyle(b).display !== 'none';
    }"""))
    check("[KR] 실적 일정 파일 404 없음",
          not any("earnings_calendar" in x for x in bad),
          "; ".join(x for x in bad if "earnings_calendar" in x))

    boot(page, f"{base}?tab=calendar&sub=earnings")
    page.select_option("#earnHorizon", "30")
    page.wait_for_timeout(500)
    body = page.locator("#earningsCalendarBody").inner_text()
    check("[KR] 딥링크로 들어오면 추정 배지와 함께 일정이 보임",
          "추정" in body and "불러오는 중" not in body,
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
    # 기본/고급 토글은 2026-09-04 에 없어졌고 setViewMode 도 2026-09-15 에 지웠다.
    # setupViewMode() 가 항상 '고급'(모든 탭 노출)으로 스탬프한다.
    page.evaluate("() => setupViewMode()")
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
    # 2026-10-22: 종목 URL 은 정적 요약 페이지(stock/<시장>/<티커>.html, 배포 때 생성). 배포가 못 만든 종목은
    # 분석 딥링크(?t=)로 되돌려진다 — 둘 중 하나로 종목이 실려 있으면 된다.
    stock_re = re.compile(r"/stock/(us|kr)/([^/]+)\.html$")
    n_stock = sum(1 for l in locs if (m := stock_re.search(l or "")) and m.group(2) != "index")
    check("sitemap 에 종목 페이지 수록", n_stock + sum("?t=" in (l or "") for l in locs) > 0,
          f"{len(locs)} URL · 정적 {n_stock}")
    check("sitemap 이중 이스케이프 없음", not any("&amp;" in (l or "") for l in locs))
    check("sitemap 중복 URL 없음", len(locs) == len(set(locs)))

    missing = []
    for loc in locs:
        m = stock_re.search(loc or "")
        if m and m.group(2) != "index":
            ticker, kr = m.group(2), m.group(1) == "kr"
        elif "?t=" in loc:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
            ticker = q.get("t", [""])[0]
            kr = q.get("market", [""])[0] == "kr"
        else:
            continue
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
    # 2026-09-15 정직화로 헤드라인이 '상승 N%' → '기술 점수 N/100' 으로 바뀌었다.
    # 둘 중 하나라도 있으면 결과가 그려진 것으로 본다.
    check("분석이 실제로 렌더", page.evaluate(
        "() => (document.body.innerText.includes('기술 점수')"
        " || document.body.innerText.includes('확률'))"
        " && !document.body.innerText.includes('찾을 수 없습니다')"))

    page.goto(analysis, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)
    base_canon = meta('link[rel="canonical"]', "href") or ""
    check("종목 미지정이면 기본 canonical", base_canon.endswith("/analysis.html"), base_canon)

    # 정적 요약 페이지는 배포 스테이징에서만 생긴다(gen_stock_pages.py) — 로컬 서버(레포 그대로)엔 없으니 건너뛴다.
    static = base.replace("index.html", "stock/us/NVDA.html")
    resp = page.goto(static, wait_until="domcontentloaded", timeout=60000)
    if resp is not None and resp.status == 404 and ("127.0.0.1" in base or "localhost" in base):
        print("SKIP  정적 종목 페이지 - 로컬 서버에는 없음(배포 때 생성)")
    else:
        canon = meta('link[rel="canonical"]', "href") or ""
        check("정적 종목 페이지 canonical 이 자기 자신", canon.endswith("/stock/us/NVDA.html"), canon)
        ld = page.evaluate("() => { const s = document.querySelector('script[type=\"application/ld+json\"]');"
                           " try { return JSON.parse(s.textContent)['@graph'].map((g) => g['@type']); } catch (e) { return null; } }")
        check("정적 종목 페이지 JSON-LD", ld and "WebPage" in ld and "BreadcrumbList" in ld, str(ld))
        check("정적 종목 페이지가 분석 딥링크를 건다",
              page.locator('a[href*="analysis.html?t=NVDA"]').count() > 0)
    page.close()


def test_mobile(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 390, "height": 844})
    watch(page)
    boot(page, base)
    # 헤더 캐러셀은 IA 재편으로 삭제 — 카드뉴스는 오늘 탭에 같은 크기로 한 줄이다.
    check("헤더 카드뉴스 캐러셀이 없음", page.locator(".cardnews-carousel").count() == 0)
    box = page.evaluate("""() => {
      const cards = [...document.querySelectorAll('#todayNews .ia-today-news-card')];
      if (!cards.length) return null;
      const rects = cards.map((c) => c.getBoundingClientRect());
      const widths = rects.map((r) => Math.round(r.width));
      const tops = rects.map((r) => Math.round(r.top));
      return {
        n: cards.length,
        hidden: document.getElementById('todayNews').hidden,
        equalWidth: Math.max(...widths) - Math.min(...widths) <= 1,
        oneRow: Math.max(...tops) - Math.min(...tops) <= 1,
      };
    }""")
    check("모바일 오늘의 뉴스 카드 렌더", box is not None and not box["hidden"])
    check("카드뉴스가 모두 같은 너비", box is not None and box["equalWidth"], f"{box['n']}장" if box else "없음")
    check("카드뉴스가 한 줄", box is not None and box["oneRow"])
    check("본문 가로 스크롤 없음",
          page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"))
    # 폰에서는 상단 4탭 줄 대신 하단 탭 바(mobile-nav.js, 2026-10-01)가 주 내비게이션이다 —
    # 보이는 쪽(하단 바 항목 + 서브탭)이 모두 44px 이상이어야 한다.
    tabs_h = page.evaluate("() => Math.min(...[...document.querySelectorAll('#mainTabs .tab, .ia-sub-tabs .sub-tab, #mnavBar .mnav-item')]"
                           ".filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height))")
    check("탭·서브탭 터치 타깃 44px 이상", tabs_h >= 44, f"min={tabs_h:.0f}px")
    bar = page.evaluate("""() => {
      const bar = document.getElementById('mnavBar');
      if (!bar || getComputedStyle(bar).display === 'none') return null;
      const r = bar.getBoundingClientRect();
      return {
        items: [...bar.querySelectorAll('.mnav-item')].map((b) => b.textContent.trim()),
        atBottom: Math.abs(r.bottom - innerHeight) <= 1,
        topTabsHidden: getComputedStyle(document.getElementById('tabsScrollWrap')).display === 'none',
        padOk: parseFloat(getComputedStyle(document.body).paddingBottom) >= r.height - 1,
      };
    }""")
    check("하단 탭 바 5개(오늘·시장·종목·내 투자·검색)",
          bar is not None and bar["items"] == ["오늘", "시장", "종목", "내 투자", "검색"], str(bar and bar["items"]))
    check("하단 탭 바가 화면 맨 아래 고정 · 본문 아래 여백으로 가리지 않음",
          bar is not None and bar["atBottom"] and bar["padOk"], str(bar))
    check("하단 바가 있으면 상단 탭 줄은 숨김", bar is not None and bar["topTabsHidden"])
    page.click("#mnavBar [data-mnav=market]")
    page.wait_for_timeout(800)
    check("하단 바 '시장'으로 시장 탭 열림", page.evaluate(
        "() => document.getElementById('tab-market').classList.contains('is-active')"
        " && document.querySelector('#mnavBar .is-active')?.dataset.mnav === 'market'"))
    shoot(page, "mobile-home")
    page.close()

    # 종목 › 분석: 요약이 화면 위로 지나가면 맨 위 미니 바, 본문 6탭은 그 바로 아래에 붙는다.
    page = browser.new_page(viewport={"width": 390, "height": 844})
    watch(page)
    page.goto(base + "?tab=search&ticker=NVDA", wait_until="load")
    page.wait_for_selector("#searchFacts .sd-name", timeout=20000)
    page.wait_for_timeout(1500)
    check("종목 검색 줄은 돋보기 버튼으로 접힘", page.evaluate(
        "() => getComputedStyle(document.querySelector('#sub-analysis > .toolbar')).display === 'none'"
        " && !!document.getElementById('mnavSearchToggle')?.offsetParent"))
    page.click("#mnavSearchToggle")
    page.wait_for_timeout(300)
    check("돋보기를 누르면 검색 줄이 열리고 입력칸에 포커스", page.evaluate(
        "() => getComputedStyle(document.querySelector('#sub-analysis > .toolbar')).display !== 'none'"
        " && document.activeElement?.id === 'tickerSearch'"))
    page.keyboard.press("Escape")
    page.mouse.wheel(0, 1600)
    page.wait_for_timeout(900)
    mini = page.evaluate("""() => {
      const m = document.getElementById('mnavMini');
      const tabs = document.getElementById('stockViewTabs').getBoundingClientRect();
      if (!m) return null;
      const r = m.getBoundingClientRect();
      return { shown: !m.hidden && r.height > 0, name: m.querySelector('.mnav-mini-name')?.textContent || '',
               price: m.querySelector('.mnav-mini-price')?.textContent || '',
               tabsUnder: Math.abs(tabs.top - r.bottom) <= 2 };
    }""")
    check("스크롤하면 종목 미니 바(이름·가격)", mini is not None and mini["shown"] and "NVIDIA" in mini["name"] and mini["price"] != "",
          str(mini))
    check("본문 6탭이 미니 바 바로 아래에 고정", mini is not None and mini["tabsUnder"], str(mini))
    check("종목 화면 가로 스크롤 없음",
          page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"))
    shoot(page, "mobile-stock-mini")
    page.close()


def test_market_switch_chart_analysis(browser, base: str) -> None:
    """차트 분석을 연 채로 헤더에서 시장을 바꾸면 이전 종목 결과가 남지 않는지(2026-10-23 외부 검토).

    예전엔 NVDA 차트 분석을 열고 한국으로 바꾸면 종목은 삼성전자인데 패널은 12초 뒤에도
    NVDA 의 '기술 점수 41'·RSI 문장을 보여 줬고, 버튼을 다시 누르면 재계산 대신 패널이 닫혔다.
    """
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)
    boot(page, f"{base}?tab=search&sub=analysis&market=us&ticker=NVDA")
    nvda_words = ("NVDA", "NVIDIA", "엔비디아")
    page.locator("#chartProbBtn").click()
    try:
        page.wait_for_function(
            "() => /기술 점수 \\d+/.test(document.querySelector('#chartProbPanel')?.textContent || '')",
            timeout=60000)
    except Exception:
        pass
    us_text = page.locator("#chartProbPanel").inner_text()
    check("[전환] NVDA 차트 분석 결과 표시", "기술 점수" in us_text and any(w in us_text for w in nvda_words),
          us_text.replace("\n", " ")[:80])

    page.locator('#marketModeSwitch [data-market-mode="kr"]').click()
    page.wait_for_function(
        "() => window.MirMarket && window.MirMarket.getMode() === 'kr' && selectedTicker === '005930'"
        " && typeof data !== 'undefined' && data && Array.isArray(data.stocks) && data.stocks.length > 100"
        " && data.stocks.some((s) => s.ticker === '005930')", timeout=90000)
    page.wait_for_timeout(2500)
    panel = page.evaluate("""() => { const p = document.querySelector('#chartProbPanel');
      return p ? { hidden: p.hidden, text: p.textContent || '' } : null; }""")
    left = [w for w in nvda_words if panel and w in panel["text"]]
    check("[전환] 한국 전환 뒤 패널이 닫히고 NVDA 문장이 없음",
          bool(panel) and (panel["hidden"] or not panel["text"].strip()) and not left,
          f"hidden={panel and panel['hidden']} 남은 단어={left}")
    check("[전환] 차트 분석 버튼 비활성 표시",
          not page.evaluate("() => document.querySelector('#chartProbBtn')?.classList.contains('is-active')"))

    page.locator("#chartProbBtn").click()
    try:
        page.wait_for_function(
            "() => /기술 점수 \\d+/.test(document.querySelector('#chartProbPanel')?.textContent || '')",
            timeout=60000)
    except Exception:
        pass
    kr_text = page.locator("#chartProbPanel").inner_text()
    check("[전환] 다시 누르면 삼성전자로 재계산",
          "기술 점수" in kr_text and "삼성전자" in kr_text and not any(w in kr_text for w in nvda_words),
          kr_text.replace("\n", " ")[:80])
    shoot(page, "market_switch_chart_analysis")
    page.close()


# 종목 상세의 새 카드들(2026-10 추가분) — 카드가 실제로 그려지는지, 데이터가 아직 없는 기능은 조용히 숨는지.
# (질의, 이름, 기다릴 조건 JS, 판정 JS → {ok, hidden?, detail}, 숨김 허용 여부)
# 숨김 허용 = 그 피처가 '데이터 없으면 숨김'으로 설계돼 있어 아직 채워지지 않은 상태도 정상인 경우. JS 오류는 항상 실패.
NEW_CARD_CHECKS = [
    ("?market=kr&tab=search&sub=analysis&ticker=069500&view=flow", "[KR] 069500 ETF 구성 카드",
     "() => { const el = document.getElementById('etfHoldingsCard'); return !!el && !el.hidden && el.textContent.trim().length > 20; }",
     "() => { const el = document.getElementById('etfHoldingsCard');"
     " return { ok: !!el && !el.hidden && /구성/.test(el.textContent), detail: el ? (el.hidden ? 'hidden' : el.textContent.trim().slice(0, 40)) : 'no el' }; }",
     False),
    ("?market=kr&tab=search&sub=analysis&ticker=115160&view=events", "[KR] 115160 CB 오버행 배지(헤더 경고 + 이벤트 탭 카드)",
     "() => !!document.querySelector('#searchFacts .cbo-notice') && !!document.querySelector('#krCbOverhangCard .cbo-badge')",
     "() => { const n = document.querySelector('#searchFacts .cbo-notice'); const b = document.querySelector('#krCbOverhangCard .cbo-badge');"
     " return { ok: !!n && !!b && /오버행/.test(n.textContent) && /오버행/.test(b.textContent),"
     " detail: `헤더=${n ? n.textContent.trim() : '없음'} 카드=${b ? b.textContent.trim() : '없음'}` }; }",
     False),
    ("?market=kr&tab=search&sub=analysis&ticker=000660&view=fin", "[KR] 000660 재무 안전 섹션(재무 탭)",
     "() => !!document.querySelector('#riskCheckSection .rc-safe-block')",
     "() => { const el = document.getElementById('riskCheckSection'); const n = el ? el.querySelectorAll('.rc-safe-block').length : 0;"
     " return { ok: !!el && !el.hidden && n > 0, detail: `블록 ${n}개` }; }",
     False),
    ("?market=kr&tab=search&sub=analysis&ticker=000660", "[KR] 000660 컨센서스 변화 표",
     "() => /컨센서스 변화/.test(document.getElementById('stockConsensus')?.textContent || '')",
     "() => { const el = document.getElementById('stockConsensus'); const t = el ? el.textContent : '';"
     " return { ok: !!el && !el.hidden && /컨센서스 변화/.test(t) && !!el.querySelector('table.krflow-table'), detail: el && el.hidden ? 'hidden' : t.trim().slice(0, 40) }; }",
     False),
    ("?market=kr&tab=search&sub=analysis&ticker=005930&view=flow", "[KR] 005930 지분 공시 카드(수급 탭)",
     "() => !!document.querySelector('#stockFlowPanel .kr-own-card')",
     "() => { const c = document.querySelector('#stockFlowPanel .kr-own-card');"
     " return { ok: !!c && /지분 공시/.test(c.textContent) && c.getBoundingClientRect().height > 0, detail: c ? c.textContent.trim().slice(0, 40) : 'no card' }; }",
     False),
    ("?market=us&tab=search&sub=analysis&ticker=AAPL&view=fin", "[US] AAPL 주주환원 현금 카드",
     "() => !!document.querySelector('#shareholderSection [data-cc-id=\"shr.cash\"]')",
     "() => { const host = document.getElementById('shareholderSection'); const c = host && host.querySelector('[data-cc-id=\"shr.cash\"]');"
     " return { ok: !!c && /주주환원 현금/.test(c.textContent), hidden: !c, detail: c ? c.textContent.trim().slice(0, 40) : (host && host.hidden ? '섹션 숨김' : '카드 없음') }; }",
     True),
    ("?market=us&tab=search&sub=analysis&ticker=NVDA&view=flow", "[US] NVDA 옵션 카드 맥스페인",
     "() => /맥스페인/.test(document.getElementById('optionsFlowCard')?.textContent || '')",
     "() => { const el = document.getElementById('optionsFlowCard'); const t = el ? el.textContent : '';"
     " return { ok: !!el && !el.hidden && /맥스페인/.test(t), hidden: !el || el.hidden, detail: el && el.hidden ? 'hidden' : t.replace(/\\s+/g, ' ').trim().slice(0, 60) }; }",
     False),
]


def _js_errors_since(n: int) -> list[str]:
    # 스크립트 404(아직 발행 전인 lazy 파일)는 '숨김'으로 설계된 상태라 JS 오류로 치지 않는다.
    return [e for e in errors[n:] if "Failed to load resource" not in e]


def test_new_stock_cards(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    watch(page)
    page.route("**/chat", lambda r: r.abort())
    page.route("**/chat?*", lambda r: r.abort())
    for query, name, wait_js, judge_js, may_hide in NEW_CARD_CHECKS:
        n0 = len(errors)
        boot(page, f"{base}{query}")
        try:
            page.wait_for_function(wait_js, timeout=20000)
        except Exception:
            pass
        st = page.evaluate(judge_js)
        st["detail"] = re.sub(r"\s+", " ", str(st.get("detail") or ""))
        errs = _js_errors_since(n0)
        if may_hide and not st["ok"] and st.get("hidden"):
            check(f"{name} — 데이터 전이라 숨김(정상), JS 오류 없음", not errs, "; ".join(errs)[:200] or st["detail"])
        else:
            check(name, st["ok"], st["detail"])
            check(f"{name} JS 오류 없음", not errs, "; ".join(errs)[:200])

    # 내 투자 › 대시보드 새 위젯(컨센서스 변화·RS 등급·위험 신호) — 배포 전 라이브엔 위젯이 없으니 있을 때만.
    n0 = len(errors)
    boot(page, f"{base}?market=kr")
    has = page.evaluate("() => !!(window.MirDashCore && window.MirDashCore.WIDGETS.risk)")
    if not has:
        print("SKIP  대시보드 새 위젯 - 이 배포에는 아직 없음")
    else:
        page.evaluate("() => localStorage.setItem('mir_dash_kr', JSON.stringify(['consensus', 'rs', 'risk']))")
        boot(page, f"{base}?market=kr&tab=bulk&sub=dash")
        # 관심 목록은 앱이 메모리 값으로 다시 저장하므로 저장소가 아니라 화면 안에서 바꾼다(저장하지 않음).
        page.evaluate("""() => { watchlist.splice(0, watchlist.length, '000660', '005930', '115160');
          activateTab('bulk', { sub: 'dash', push: false }); }""")
        try:
            page.wait_for_function(
                "() => ['consensus', 'rs', 'risk'].every((id) => { const b = document.querySelector(`#myDash [data-dash-id='${id}'] .dash-card-body`);"
                " return b && !/불러오는 중/.test(b.textContent); })", timeout=25000)
        except Exception:
            pass
        st = page.evaluate("""() => Object.fromEntries(['consensus', 'rs', 'risk'].map((id) => {
          const b = document.querySelector(`#myDash [data-dash-id='${id}'] .dash-card-body`);
          return [id, b ? b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70) : null];
        }))""")
        check("[KR] 대시보드 새 위젯 3개 렌더", all(st.values()), str(st))
        check("[KR] RS 등급 위젯에 등급 행", bool(st.get("rs")) and bool(re.search(r"\d", st["rs"] or "")), str(st.get("rs")))
        check("[KR] 위험 신호 위젯에 115160 CB 사실(출처 포함)",
              "미상환 사채" in (st.get("risk") or "") and "DART" in (st.get("risk") or ""), str(st.get("risk")))
        check("[KR] 대시보드 JS 오류 없음", not _js_errors_since(n0), "; ".join(_js_errors_since(n0))[:200])
        page.evaluate("() => localStorage.removeItem('mir_dash_kr')")
    shoot(page, "new_stock_cards")
    page.close()



def main() -> int:
    global shots_dir
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8099/index.html")
    ap.add_argument("--shots", default="", help="스크린샷을 저장할 디렉터리")
    ap.add_argument("--only", default="", help="쉼표로 구분한 테스트 함수 이름만 실행(예: test_stock_views)")
    args = ap.parse_args()

    if args.shots:
        shots_dir = Path(args.shots)
        shots_dir.mkdir(parents=True, exist_ok=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            tests = (test_deeplinks, test_stock_views, test_dialogs, test_trust_center,
                     test_worker_no_client_id_leak, test_kr_market, test_stage3_layout,
                     test_tab_a11y, test_ticker_deeplink_seo, test_market_switch_chart_analysis,
                     test_new_stock_cards,
                     test_mobile)
            if args.only:
                tests = tuple(fn for fn in tests if fn.__name__ in args.only.split(","))
            for fn in tests:
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
