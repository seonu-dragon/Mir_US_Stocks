"""상원 eFD(efdsearch.senate.gov) 주식거래 보고서(PTR) 수집 — build_congress_trades 의 상원 원천.

2026-10-02: 상원 원천이 비어 있었다. Quiver 는 유료 인증이 필요해 401, senate-stock-watcher 미러는
2021 년 이후 멈췄다. 상원 공식 eFD 를 직접 읽는다.
  1) /search/home/ 에서 이용 동의(prohibition_agreement) → 세션 쿠키
  2) /search/report/data/ (DataTables JSON) 로 기간 내 PTR 목록
  3) 전자 제출 PTR(/search/view/ptr/<id>/)의 거래 표를 읽는다. 종이 제출(/paper/)은 스캔 이미지라 건너뛴다.
한 번 읽은 보고서는 캐시(data/senate_ptr_cache.json)에 두고 다시 받지 않는다 — 제출된 PTR 은 바뀌지 않고,
수정 제출은 새 보고서 id 로 온다. 한국 IP 는 Akamai 가 403 을 준다(Actions 는 미국 IP).
"""
from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime
from pathlib import Path

BASE = "https://efdsearch.senate.gov"
UA = "Mir-US-Stocks/1.0 (contact@seonu-dragon.xyz)"
REPORT_TYPE_PTR = 11
PAGE = 100
SLEEP = 0.4  # 보고서 페이지 사이 간격(초)

_LINK_RE = re.compile(r'href="(/search/view/(ptr|paper)/([0-9a-fA-F-]+)/)"[^>]*>([^<]*)<')
_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
_CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
_TAG_RE = re.compile(r"<[^>]+>")


def _text(cell: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub(" ", cell))).strip()


def parse_ptr_html(page: str) -> list[dict]:
    """전자 PTR 페이지의 거래 표 → 행 목록. 열: # · 거래일 · 소유자 · 티커 · 자산명 · 자산종류 · 유형 · 금액 · 비고."""
    start = page.find("<tbody")
    if start < 0:
        return []
    body = page[start:page.find("</tbody>", start)]
    out = []
    for row in _ROW_RE.findall(body):
        cells = [_text(c) for c in _CELL_RE.findall(row)]
        if len(cells) < 8:
            continue
        out.append({
            "transaction_date": cells[1],
            "owner": cells[2],
            "ticker": "" if cells[3] in {"--", ""} else cells[3],
            "asset_description": cells[4],
            "asset_type": cells[5],
            "type": cells[6],
            "amount": cells[7],
        })
    return out


def parse_search_rows(data: list) -> list[dict]:
    """DataTables 행 [이름, 성, 의원(전체 표기), 링크 html, 제출일] → 보고서 목록."""
    out = []
    for row in data or []:
        if not isinstance(row, list) or len(row) < 5:
            continue
        m = _LINK_RE.search(str(row[3]))
        if not m:
            continue
        first, last = _text(str(row[0])), _text(str(row[1]))
        out.append({
            "id": m.group(3).lower(),
            "kind": m.group(2),
            "path": m.group(1),
            "senator": re.sub(r"\s+", " ", f"{first} {last}").strip(),
            "filed": _text(str(row[4])),
        })
    return out


def _session():
    import requests

    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    r = s.get(f"{BASE}/search/home/", timeout=30)
    r.raise_for_status()
    m = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r.text)
    if not m:
        raise RuntimeError("eFD 동의 폼을 찾지 못했다")
    r = s.post(f"{BASE}/search/home/", data={"prohibition_agreement": "1", "csrfmiddlewaretoken": m.group(1)},
               headers={"Referer": f"{BASE}/search/home/"}, timeout=30)
    r.raise_for_status()
    return s


def _search(s, since: datetime) -> list[dict]:
    csrf = s.cookies.get("csrftoken") or ""
    reports, start = [], 0
    while True:
        r = s.post(f"{BASE}/search/report/data/", data={
            "start": str(start), "length": str(PAGE), "report_types": f"[{REPORT_TYPE_PTR}]",
            "filer_types": "[]", "submitted_start_date": since.strftime("%m/%d/%Y 00:00:00"),
            "submitted_end_date": "", "candidate_state": "", "senator_state": "", "office_id": "",
            "first_name": "", "last_name": "", "csrfmiddlewaretoken": csrf,
        }, headers={"Referer": f"{BASE}/search/", "X-CSRFToken": csrf}, timeout=60)
        r.raise_for_status()
        payload = r.json()
        rows = parse_search_rows(payload.get("data"))
        reports += rows
        start += PAGE
        if not payload.get("data") or start >= int(payload.get("recordsTotal") or 0):
            return reports


def fetch_senate_rows(since: datetime, cache_path: Path) -> list[dict]:
    """since 이후 제출된 전자 PTR 의 거래 행(senate-stock-watcher 형식 키)을 돌려준다. 캐시를 갱신한다."""
    try:
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception:
        cache = {}
    s = _session()
    reports = _search(s, since)
    fetched = failed = 0
    for rep in reports:
        if rep["kind"] != "ptr" or rep["id"] in cache:
            continue
        try:
            r = s.get(BASE + rep["path"], headers={"Referer": f"{BASE}/search/"}, timeout=60)
            r.raise_for_status()
            cache[rep["id"]] = {"senator": rep["senator"], "filed": rep["filed"], "rows": parse_ptr_html(r.text)}
            fetched += 1
        except Exception:
            failed += 1
        time.sleep(SLEEP)
    live = {rep["id"] for rep in reports}
    # 기간 밖으로 밀려난 보고서는 캐시에서 뺀다(파일이 무한히 커지지 않게).
    cache = {k: v for k, v in cache.items() if k in live}
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    paper = sum(1 for rep in reports if rep["kind"] == "paper")
    print(f"[fetch] senate eFD: 보고서 {len(reports)}건(종이 {paper}건 제외) · 새로 읽음 {fetched} · 실패 {failed}")
    out = []
    for rid, rep in cache.items():
        for row in rep.get("rows") or []:
            out.append({**row, "senator": rep["senator"], "disclosure_date": rep["filed"],
                        "ptr_link": f"{BASE}/search/view/ptr/{rid}/"})
    return out
