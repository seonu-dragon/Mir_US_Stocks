"""DART 공시검색(list.json)을 기간으로 훑는 공용 스캐너 — 이력 백필 전용.

매일 갱신은 kr_disclosures.json(최근 7일, build_kr_disclosures.py)을 쓰고, 이 스캐너는 새 빌더가
처음 1년치 이력을 채울 때(`--backfill-days`)만 쓴다. corp_code 없이 조회하면 DART 가 기간을
3개월로 제한하므로 90일 창으로 쪼개고, 페이지(100건)를 total_page 까지 돈다.

반환 행은 kr_disclosures.json 의 행과 같은 모양({ticker, company, title, fileDate, link})이라
빌더가 두 소스를 같은 코드로 처리한다. 상장사(유가 Y·코스닥 K)만 남긴다.
"""

from __future__ import annotations

from datetime import date, timedelta

from build_kr_disclosures import dart_get


def _windows(bgn: date, end: date, days: int = 89):
    cur = bgn
    while cur <= end:
        stop = min(end, cur + timedelta(days=days))
        yield cur, stop
        cur = stop + timedelta(days=1)


def to_row(item: dict) -> dict | None:
    code = str(item.get("stock_code") or "").strip()
    if len(code) != 6 or item.get("corp_cls") not in ("Y", "K"):
        return None
    dt = str(item.get("rcept_dt") or "")
    return {
        "ticker": code,
        "company": str(item.get("corp_name") or "").strip(),
        "title": " ".join(str(item.get("report_nm") or "").split()),
        "fileDate": f"{dt[0:4]}-{dt[4:6]}-{dt[6:8]}" if len(dt) == 8 else "",
        "link": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={item.get('rcept_no')}",
    }


def scan(api_key: str, bgn: date, end: date, detail_types: tuple[str, ...], keep=None, log=print) -> list[dict]:
    """[bgn, end] 의 detail_types(예: I001 수시공시, I002 공정공시, B001 주요사항, A003 분기보고서) 공시.

    keep(title) 이 주어지면 제목이 맞는 행만 남긴다(메모리·후처리 절약). 중간 페이지가 실패하면
    그 창은 건너뛰고 로그를 남긴다 — 부분 결과라도 쓸모 있고, 다음 백필에서 다시 채울 수 있다.
    """
    out: list[dict] = []
    for ty in detail_types:
        for w0, w1 in _windows(bgn, end):
            page, total = 1, 1
            while page <= total:
                try:
                    data = dart_get("list.json", {
                        "bgn_de": w0.strftime("%Y%m%d"), "end_de": w1.strftime("%Y%m%d"),
                        "pblntf_detail_ty": ty, "page_count": 100, "page_no": page,
                    }, api_key)
                except Exception as exc:
                    log(f"[스캔] {ty} {w0}~{w1} p{page} 실패: {exc}")
                    break
                status = str(data.get("status") or "")
                if status == "013":  # 조회 결과 없음
                    break
                if status != "000":
                    log(f"[스캔] {ty} {w0}~{w1} status={status} {data.get('message')}")
                    break
                total = int(data.get("total_page") or 1)
                for item in data.get("list") or []:
                    row = to_row(item)
                    if row and (keep is None or keep(row["title"])):
                        out.append(row)
                page += 1
            log(f"[스캔] {ty} {w0}~{w1}: {total}페이지 · 누적 {len(out)}건")
    return out
