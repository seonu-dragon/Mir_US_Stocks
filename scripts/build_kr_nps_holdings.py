#!/usr/bin/env python3
"""KR 국민연금 보유 — 국민연금공단 국내주식 종목별 투자정보(공공데이터포털 파일데이터).

국민연금은 국내주식 최대 큰손(운용액 150조+)이다. 연기금이 지분 몇 %를 들고 있는지는
'장기 자금이 실제로 앉아 있는 종목'의 직접 증거라, 수급(외국인·기관 일별 순매수)과
달리 스톡(잔고) 관점의 앵커가 된다.

  https://www.data.go.kr/data/3070507/fileData.do
  - 파일데이터(CSV, 로그인·인증키 불필요). 인코딩은 EUC-KR(cp949).
  - 컬럼: 번호, 종목명, 평가액(억 원), 자산군 내 비중(%), 지분율(%).
  - **연 1회 갱신**(연말 기준, 이듬해 하반기 공개 — 현재분 기준일 2024-12-31,
    다음 갱신 예정 2026-09-30). asOf 로 기준일을 명시한다. 값이 1년 내내 같은 게 정상이라
    check_data_freshness.py 는 '빌더가 주간으로 돌고 있나'(updatedAtKst 나이 15일 = 주간 2회 연속 실패)만 본다.
  - 다운로드 식별자(atchFileId)는 연차 갱신 때 바뀌므로 매 실행 시 다시 찾는다.
    2026-10 말 포털 개편으로 페이지 HTML 에서 atchFileId 가 빠졌다(그 뒤 10-25 에서 멈춤).
    이제 페이지의 다운로드 버튼 fn_fileDataDown('3070507', 'uddi:…', …) 에서 공개 식별자를
    읽어 /tcs/dss/selectFileDataDownload.do 에 POST 하면 atchFileId 를 돌려준다(로그인·쿠키
    불필요, 브라우저 다운로드 버튼과 같은 경로). 실행이 저비용이라 주간 워크플로우에 실어도 무해하다.

종목명을 KR 스냅샷 상장사명과 매칭한다. 정규화((주)·주식회사·㈜·공백·괄호 제거) 후
**완전 일치만** 인정 — 부분 일치로 엉뚱한 종목에 붙이지 않는다(데이터 정직성).
국민연금 파일은 정식 종목명이라 매칭률이 높아야 정상이다(80% 미만이면 정규화 재점검).
미매칭은 대부분 이후 상장폐지·합병 종목이다.

산출물: data/korea/nps_holdings.json + .js(window.KR_NPS_HOLDINGS). 매칭이
100건 미만이면 기존 파일 유지(정직성: 부실 데이터를 발행하지 않는다).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from briefing_store import atomic_write_text, repository_publish_lock  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "nps_holdings.json"
OUT_JS = ROOT / "data" / "korea" / "nps_holdings.js"

PAGE_URL = "https://www.data.go.kr/data/3070507/fileData.do"
DOWNLOAD_URL = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId={atch}&fileDetailSn={sn}"
RESOLVE_URL = "https://www.data.go.kr/tcs/dss/selectFileDataDownload.do"
_DOWN_BTN = re.compile(r"fn_fileDataDown\(\s*'(\d+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'(\d*)'")
UA = {"User-Agent": "Mozilla/5.0 (Mir US Stocks research; dydtjsdn@gmail.com)"}
MIN_MATCHED = 100   # 국민연금은 국내 1,000+ 종목 보유 — 이 밑이면 소스/매칭 이상

_PAREN = re.compile(r"\([^)]*\)|（[^）]*）")


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def norm_name(s: str) -> str:
    """종목명 정규화: 괄호내용·(주)·주식회사·㈜·공백 제거 후 대문자."""
    s = _PAREN.sub("", s or "")
    for token in ("주식회사", "㈜", "(주)"):
        s = s.replace(token, "")
    return re.sub(r"\s+", "", s).upper()


def fnum(v) -> float | None:
    if v in (None, "", "null"):
        return None
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


# 2026-10-17 러너에서 데이터셋 페이지가 60초 timed out 한 번으로 실패해 주간 갱신을 통째로 놓쳤다(같은 실행의
# 공정위 기업집단도 같은 구간 타임아웃). 해외 러너↔공공데이터포털 간헐 지연이라 build_kr_corp_groups 처럼 재시도한다.
RETRY_WAITS = (5, 15, 30)


def http_get(url: str, referer: str | None = None, *, waits=RETRY_WAITS, sleep=time.sleep,
             data: dict | None = None) -> bytes:
    """GET(또는 data 가 있으면 form POST). 일시 오류만 간격을 늘려 다시 받는다."""
    headers = dict(UA)
    if referer:
        headers["Referer"] = referer
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    last: Exception | None = None
    for attempt in range(len(waits) + 1):
        req = urllib.request.Request(url, data=body, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                raise  # 4xx 는 다시 쳐도 같다
            last = e
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = e
        if attempt < len(waits):
            print(f"  [재시도 {attempt + 1}/{len(waits)}] {type(last).__name__}: {last} — {waits[attempt]}초 후")
            sleep(waits[attempt])
    assert last is not None
    raise last


def _as_of_from(text: str) -> str | None:
    """제목 "국민연금공단_국내주식 투자정보_20251231" 에서 기준일 YYYY-MM-DD."""
    d_m = re.search(r"국내주식[^<\"]*?_(\d{8})", text or "")
    if not d_m:
        return None
    raw = d_m.group(1)
    return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"


def discover_file(page_html: str, resolve=None) -> tuple[str, str, str | None]:
    """데이터셋 페이지에서 (atchFileId, fileDetailSn, 기준일 YYYY-MM-DD)를 찾는다.

    옛 페이지는 atchFileId 를 HTML 에 그대로 실었다. 지금 페이지는 다운로드 버튼의 공개 식별자만
    있어서 resolve(publicDataPk, publicDataDetailPk, fileDetailSn) 로 서버에 물어본다."""
    as_of = _as_of_from(page_html)
    m = re.search(r"atchFileId=(FILE_\d+)", page_html)
    if m:
        sn_m = re.search(r"fileDetailSn=(\d+)", page_html)
        return m.group(1), (sn_m.group(1) if sn_m else "1"), as_of
    btn = _DOWN_BTN.search(page_html)
    if not btn:
        raise RuntimeError("데이터셋 페이지에서 atchFileId·다운로드 버튼을 둘 다 찾지 못함 — 페이지 구조 변경?")
    pk, detail_pk, atch_hint, sn_hint = btn.groups()
    if atch_hint.startswith("FILE_"):
        return atch_hint, sn_hint or "1", as_of
    info = (resolve or resolve_file)(pk, detail_pk, sn_hint or "1")
    atch = str(info.get("atchFileId") or "")
    if not info.get("status") or not atch.startswith("FILE_"):
        raise RuntimeError(f"다운로드 식별자 조회 실패: {str(info.get('error') or info)[:200]}")
    detail = info.get("dataSetFileDetailInfo") or {}
    return atch, str(info.get("fileDetailSn") or sn_hint or "1"), as_of or _as_of_from(detail.get("dataNm") or "")


def resolve_file(public_data_pk: str, detail_pk: str, sn: str) -> dict:
    """브라우저 다운로드 버튼과 같은 요청 — atchFileId 를 돌려받는다."""
    raw = http_get(RESOLVE_URL, referer=PAGE_URL, data={
        "publicDataDetailPk": detail_pk, "publicDataPk": public_data_pk,
        "atchFileId": "", "fileDetailSn": sn, "publicDataTyCode": "PR0051",
    })
    return json.loads(raw.decode("utf-8", errors="replace"))


def decode_csv(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise RuntimeError("CSV 디코딩 실패 (utf-8/cp949 모두 아님)")


def parse_rows(text: str) -> list[dict]:
    """CSV → [{name, valueB, weightPct, stakePct}] (헤더 검증 포함)."""
    import csv
    import io

    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header or "종목명" not in "".join(header):
        raise RuntimeError(f"예상 밖 CSV 헤더: {header!r}")
    idx = {re.sub(r"[\s()]", "", h): i for i, h in enumerate(header)}

    def col(row, *keys):
        for k in keys:
            for hk, i in idx.items():
                if k in hk and i < len(row):
                    return row[i]
        return None

    rows = []
    for row in reader:
        if not row or len(row) < 2:
            continue
        name = (col(row, "종목명") or "").strip()
        if not name:
            continue
        rows.append({
            "name": name,
            "valueB": fnum(col(row, "평가액")),
            "weightPct": fnum(col(row, "비중")),
            "stakePct": fnum(col(row, "지분율")),
        })
    return rows


def load_listed() -> dict[str, tuple[str, str]]:
    """정규화된 상장사명 → (ticker, company). 동명이 겹치면 매칭 제외(모호성 배제)."""
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    by_norm: dict[str, tuple[str, str]] = {}
    ambiguous: set[str] = set()
    for s in snap.get("stocks", []):
        name, ticker = s.get("company"), s.get("ticker")
        if not name or not ticker:
            continue
        key = norm_name(name)
        if not key:
            continue
        if key in by_norm and by_norm[key][0] != ticker:
            ambiguous.add(key)
            continue
        by_norm[key] = (ticker, name)
    for key in ambiguous:
        by_norm.pop(key, None)
    return by_norm


def build() -> dict | None:
    page_html = http_get(PAGE_URL).decode("utf-8", errors="replace")
    atch, sn, as_of = discover_file(page_html)
    print(f"파일 식별자 {atch}/{sn}, 기준일 {as_of or '?'}")

    raw = http_get(DOWNLOAD_URL.format(atch=atch, sn=sn), referer=PAGE_URL)
    rows = parse_rows(decode_csv(raw))
    if not rows:
        return None
    print(f"CSV {len(rows)}종목 파싱")

    listed = load_listed()
    print(f"상장사 매칭 테이블 {len(listed)}개")

    holdings, unmatched = [], []
    for r in rows:
        hit = listed.get(norm_name(r["name"]))
        if not hit:
            unmatched.append(r["name"])
            continue
        holdings.append({
            "ticker": hit[0],
            "company": hit[1],
            "stakePct": r["stakePct"],
            "valueB": r["valueB"],       # 억원
            "weightPct": r["weightPct"],  # 국내주식 포트폴리오 내 비중
        })

    rate = len(holdings) / len(rows) * 100
    print(f"매칭 {len(holdings)}/{len(rows)}종목 ({rate:.1f}%) — 미매칭은 대부분 상폐·합병")
    if unmatched:
        print(f"미매칭 예시: {unmatched[:10]}")
    if len(holdings) < MIN_MATCHED:
        return None
    if rate < 80:
        print(f"[경고] 매칭률 {rate:.1f}% < 80% — 정규화 재점검 필요")

    holdings.sort(key=lambda h: h["stakePct"] or 0.0, reverse=True)

    return {
        "updatedAtKst": kst_now_str(),
        "asOf": as_of,  # 데이터 기준일(연말) — 연 1회 갱신 데이터
        "source": "국민연금공단 국내주식 투자정보(공공데이터포털, 연 1회 연말 기준)",
        "count": len(holdings),
        "holdings": holdings,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="KR 국민연금 종목별 보유내역 수집")
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    print("=== KR 국민연금 보유내역 수집 (공공데이터포털) ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[nps] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print(f"[nps] 매칭 {MIN_MATCHED}건 미만 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_NPS_HOLDINGS = {compact};\n")
    print(f"보유 {payload['count']}종목 (기준일 {payload['asOf']}) → {OUT_JSON.name}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/nps_holdings.json", "data/korea/nps_holdings.js"],
                "KR NPS holdings",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
