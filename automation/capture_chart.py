"""Playwright chart capture for Kiwoom content pipeline."""

from __future__ import annotations

import contextlib
import os
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode

from utils import PROJECT_ROOT, chart_output_path, load_env_file


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@contextlib.contextmanager
def _local_site():
    """Serve PROJECT_ROOT over HTTP so chart_capture.js can fetch detail JSON."""
    port = _free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), SimpleHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _page_url(base: str, ticker: str, market: str, period: str = "6M") -> str:
    query = urlencode({"ticker": ticker, "market": market.lower(), "period": period})
    return f"{base.rstrip('/')}/chart_capture.html?{query}"


def capture_chart(
    ticker: str,
    market: str,
    period: str = "6M",
    output_dir: str | Path | None = None,
    date_str: str | None = None,
) -> Path | None:
    """Capture #chart-capture-area to PNG. Returns output path or None on failure."""
    load_env_file()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("playwright 패키지가 필요합니다. pip install playwright && playwright install chromium") from exc

    out = chart_output_path(market, ticker, date_str)
    if output_dir:
        out = Path(output_dir) / out.name
    out.parent.mkdir(parents=True, exist_ok=True)

    force_remote = os.getenv("CAPTURE_FORCE_REMOTE", "").strip().lower() in {"1", "true", "yes"}
    site_base = os.getenv("SITE_BASE_URL", "").strip().rstrip("/")
    print(f"[capture] {ticker} ({market}) -> {out.name}")

    def _capture_from(base_url: str) -> Path | None:
        os.chdir(PROJECT_ROOT)
        url = _page_url(base_url, ticker, market, period)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1000, "height": 820})
            page.goto(url, wait_until="domcontentloaded", timeout=60_000)
            page.wait_for_function(
                """() => {
                  const el = document.getElementById('chart-capture-area');
                  return el && (el.dataset.ready === '1' || el.dataset.ready === 'error');
                }""",
                timeout=60_000,
            )
            ready = page.locator("#chart-capture-area").get_attribute("data-ready")
            if ready == "error":
                status = page.locator("#captureStatus").inner_text()
                browser.close()
                print(f"[capture] failed: chart render error for {ticker} ({status})")
                return None
            page.locator("#chart-capture-area").screenshot(path=str(out), type="png")
            browser.close()
        return out if out.exists() else None

    # chart_capture.html은 로컬에만 있을 수 있으므로 기본은 로컬 HTTP 서버 사용
    if force_remote and site_base:
        try:
            return _capture_from(site_base)
        except Exception as exc:
            print(f"[capture] remote failed ({exc}); falling back to local server")

    with _local_site() as local_base:
        return _capture_from(local_base)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Capture chart PNG for a ticker.")
    parser.add_argument("--ticker", required=True)
    parser.add_argument("--market", choices=("kr", "us", "KR", "US"), default="us")
    parser.add_argument("--period", default="6M")
    args = parser.parse_args()
    result = capture_chart(args.ticker, args.market.upper(), period=args.period)
    print(result or "capture failed")