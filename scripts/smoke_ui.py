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
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright 가 없다: py -m pip install playwright && py -m playwright install chromium",
          file=sys.stderr)
    raise SystemExit(2)

TABS = ["map", "search", "bulk", "sector", "signals", "institutional",
        "health", "calendar", "community"]

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
    """'load' 는 스냅샷 JS·이미지까지 기다리느라 안 끝날 수 있다. 앱 부팅 함수로 판단한다."""
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_function("() => typeof window.showAppToast === 'function'", timeout=60000)
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
        st = page.evaluate("""() => ({
          y: window.pageYOffset,
          top: document.getElementById('tabsScrollWrap').getBoundingClientRect().top,
          max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
          active: document.querySelector('.tab.is-active')?.dataset.tab,
        })""")
        # 탭 바가 상단에 오거나(정상), 페이지가 짧아 더 못 내려가면(캘린더 등) 통과.
        at_end = abs(st["y"] - st["max"]) <= 4
        ok = st["y"] > 100 and (-20 < st["top"] < 60 or at_end)
        check(f"?tab={tab} 딥링크가 본문으로 이동", ok,
              f"y={st['y']:.0f}/max={st['max']:.0f} 탭바top={st['top']:.0f} active={st['active']}")
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

    before = page.evaluate("() => performance.getEntriesByType('resource')"
                           ".filter(r => /data\\/.*\\.js/.test(r.name)).length")
    page.wait_for_timeout(3000)
    after = page.evaluate("() => performance.getEntriesByType('resource')"
                          ".filter(r => /data\\/.*\\.js/.test(r.name)).length")
    check("데이터 재요청이 폭주하지 않음", before == after, f"{before} → {after}")

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


def test_mobile(browser, base: str) -> None:
    page = browser.new_page(viewport={"width": 390, "height": 844})
    watch(page)
    boot(page, base)
    box = page.evaluate("""() => {
      const e = document.querySelector('.cardnews-carousel');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }""")
    check("모바일 카드뉴스 렌더", box is not None)
    if box:
        # 원본이 4:5 세로 이미지라 그대로 펼치면 첫 화면을 통째로 먹는다.
        check("카드뉴스가 첫 화면의 1/3 이하", box["h"] <= 844 / 3,
              f"{box['w']:.0f}x{box['h']:.0f}, viewport h=844")
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
                       test_worker_no_client_id_leak, test_mobile):
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
