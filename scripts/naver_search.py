"""네이버 뉴스 검색 — NAVER API Hub(새) 우선, 개발자센터 Open API(옛) 폴백.

2026-07-31 부터 개발자센터(openapi.naver.com)의 검색 API 신규 신청이 막히고 네이버 클라우드
NAVER API Hub 로 옮겨졌다(옛 서비스는 2027-06-30 종료). 두 방식은 주소·헤더·키 모양이 다르다:

  API Hub   https://naverapihub.apigw.ntruss.com/search/v1/news
            X-NCP-APIGW-API-KEY-ID (10자) / X-NCP-APIGW-API-KEY (40자)   ← NAVER_APIHUB_KEY_ID / NAVER_APIHUB_KEY
  옛 방식    https://openapi.naver.com/v1/search/news.json
            X-Naver-Client-Id (20자) / X-Naver-Client-Secret (10자)      ← NAVER_CLIENT_ID / NAVER_CLIENT_SECRET

둘 다 없으면 None 을 돌려준다(호출부가 구글 뉴스 등으로 폴백). 401·403 은 NaverAuthError — 키가 틀렸거나
검색 권한이 없는 것이라 같은 실행에서 다시 부르지 않게 호출부가 끈다. 하루 한도 25,000회.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

HUB_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news"
LEGACY_URL = "https://openapi.naver.com/v1/search/news.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; MirNaverSearch/1.0)", "Accept": "application/json"}


class NaverAuthError(RuntimeError):
    pass


def _clean(v: str | None) -> str:
    return (v or "").strip().rstrip(",").strip().strip('"').strip("'")


def credentials() -> tuple[str, str, dict] | None:
    """(방식, URL, 인증 헤더). API Hub 키가 있으면 그쪽."""
    hid, hkey = _clean(os.getenv("NAVER_APIHUB_KEY_ID")), _clean(os.getenv("NAVER_APIHUB_KEY"))
    if hid and hkey:
        return "hub", HUB_URL, {"X-NCP-APIGW-API-KEY-ID": hid, "X-NCP-APIGW-API-KEY": hkey}
    cid, sec = _clean(os.getenv("NAVER_CLIENT_ID")), _clean(os.getenv("NAVER_CLIENT_SECRET"))
    if cid and sec:
        return "legacy", LEGACY_URL, {"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": sec}
    return None


def search_news(query: str, *, display: int = 30, sort: str = "date", start: int = 1, timeout: int = 15,
                opener=None) -> list[dict] | None:
    """뉴스 검색 결과 items(title·originallink·link·description·pubDate). 키가 없으면 None."""
    cred = credentials()
    if not cred:
        return None
    kind, url, auth = cred
    params = {"query": query, "display": max(1, min(int(display), 100)), "start": max(1, int(start)), "sort": sort}
    if kind == "hub":
        params["format"] = "json"
    req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(params)}", headers={**UA, **auth})
    try:
        with (opener or urllib.request.urlopen)(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8")).get("items") or []
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            detail = ""
            try:
                detail = exc.read().decode("utf-8", "replace")[:160]
            except Exception:
                pass
            raise NaverAuthError(f"네이버 검색 {kind} HTTP {exc.code} {detail}") from exc
        raise


def is_naver_news_link(link: str) -> bool:
    return "n.news.naver.com" in (link or "") or "news.naver.com/main/read" in (link or "")
