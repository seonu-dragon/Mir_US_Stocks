#!/usr/bin/env python3
"""섹터 흐름 스크롤 영역 검증 (Playwright)."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def ensure_playwright():
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
        return
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "-q"])
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        return


def main() -> int:
    ensure_playwright()
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto(f"file:///{ROOT.as_posix()}/index.html", wait_until="networkidle", timeout=120000)
        page.click('button[data-tab="sector"]')
        page.wait_for_timeout(800)

        panel = page.locator(".sector-scroll-panel")
        header = page.locator(".sector-scroll-panel .panel-header-sticky")
        flow = page.locator("#sectorList")

        panel_overflow = panel.evaluate("el => getComputedStyle(el).overflowY")
        flow_overflow = flow.evaluate("el => getComputedStyle(el).overflowY")
        header_in_panel_scroll = panel.evaluate(
            """el => {
              const header = el.querySelector('.panel-header-sticky');
              const list = el.querySelector('.sector-flow-list');
              if (!header || !list) return null;
              return list.scrollTop === 0 && header.getBoundingClientRect().top >= el.getBoundingClientRect().top;
            }"""
        )
        metrics = flow.evaluate(
            """el => ({
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              canScroll: el.scrollHeight > el.clientHeight + 2,
            })"""
        )

        header_top_before = header.evaluate(
            "el => el.getBoundingClientRect().top"
        )
        flow.evaluate("el => { el.scrollTop = 240; }")
        page.wait_for_timeout(100)
        after = flow.evaluate("el => el.scrollTop")
        header_top_after = header.evaluate(
            "el => el.getBoundingClientRect().top"
        )
        panel_scroll = panel.evaluate("el => el.scrollTop")

        print("panel overflow:", panel_overflow)
        print("flow overflow:", flow_overflow)
        print("header fixed at top:", header_in_panel_scroll)
        print("flow metrics:", metrics)
        print("flow scrollTop after programmatic scroll:", after)
        print("panel scrollTop:", panel_scroll)
        print("header top before/after list scroll:", header_top_before, header_top_after)

        ok = (
            panel_overflow in {"hidden", "clip"}
            and flow_overflow == "auto"
            and metrics["canScroll"]
            and after >= 200
            and panel_scroll == 0
            and abs(header_top_after - header_top_before) < 2
        )
        browser.close()
        print("PASS" if ok else "FAIL")
        return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())