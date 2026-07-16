#!/usr/bin/env python3
"""Cloudflare 뒤에 있는 엔드포인트용 HTTP 헬퍼.

python-requests 는 TLS 지문(JA3)으로 봇 판정을 받는다. 같은 GitHub Actions 러너
(IP 52.159.228.216)에서 같은 URL·같은 시각에 확인한 결과:

    curl                        -> 200, 정상 JSON
    requests (브라우저 UA)       -> 403, "Just a moment..." (Cloudflare 차단 페이지)
    requests (헤더 없음)         -> 403, 동일

헤더를 브라우저처럼 맞춰도 소용없다 — 헤더가 아니라 TLS 핸드셰이크에서 갈린다.
가정용 IP 에서는 requests 도 통과하기 때문에 로컬에서는 재현되지 않는다(데이터센터
IP + requests 지문의 '조합' 에서만 막힌다). 그래서 이 증상은 "Actions 에서만, 조용히"
나타났다 — Stocktwits 트렌드가 2026-06 말부터 계속 0건이던 원인이 이것이다.

reddit·yahoo 는 Cloudflare 뒤가 아니라서 requests 로도 잘 들어온다. 그 둘은 그대로 둔다.
"""

from __future__ import annotations

import json
import shutil
import subprocess


def fetch_json_via_curl(url: str, headers: dict | None = None, timeout: int = 15):
    """(status, parsed_json|None, raw_snippet) 을 돌려준다.

    status 0 은 요청 자체가 실패한 경우(타임아웃·curl 없음 등)다. 호출부가 상태를
    로그로 남길 수 있게 예외를 던지지 않고 튜플로 돌려준다.
    """
    curl = shutil.which("curl")
    if not curl:
        return _requests_fallback(url, headers, timeout)

    cmd = [curl, "-s", "--max-time", str(timeout), "-w", "\n%{http_code}"]
    for key, value in (headers or {}).items():
        cmd += ["-H", f"{key}: {value}"]
    cmd.append(url)

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",      # 윈도우 기본 로캘(cp949)이면 UTF-8 JSON 이 깨진다
            errors="replace",
            timeout=timeout + 5,
        )
    except subprocess.TimeoutExpired:
        return 0, None, "curl timeout"
    except Exception as exc:                      # noqa: BLE001
        return 0, None, f"{type(exc).__name__}: {exc}"

    out = proc.stdout or ""
    body, _, status_line = out.rpartition("\n")   # -w 로 마지막 줄에 상태코드를 붙였다
    try:
        status = int(status_line.strip())
    except ValueError:
        return 0, None, (proc.stderr or out)[:200]

    if status != 200:
        return status, None, body[:300]
    try:
        return status, json.loads(body), body[:300]
    except json.JSONDecodeError:
        return status, None, body[:300]


def _requests_fallback(url: str, headers: dict | None, timeout: int):
    """curl 이 없는 환경용. Cloudflare 뒤라면 403 이 나겠지만, 그 사실이 로그에 남는다."""
    try:
        import requests
    except ImportError:
        return 0, None, "curl 도 requests 도 없음"
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
    except Exception as exc:                      # noqa: BLE001
        return 0, None, f"{type(exc).__name__}: {exc}"
    if resp.status_code != 200:
        return resp.status_code, None, resp.text[:300]
    try:
        return resp.status_code, resp.json(), resp.text[:300]
    except ValueError:
        return resp.status_code, None, resp.text[:300]
