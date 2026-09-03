#!/usr/bin/env python3
"""한국 지분공시 상세 — 대량보유(5%룰) · 임원·주요주주 소유.

공시 목록(list.json)은 "대량보유상황보고서" 라는 제목만 줄 뿐 누가 몇 %를 얼마나
늘렸는지가 없다. 그 숫자는 majorstock.json / elestock.json 에 있는데 두 API 모두
corp_code 가 필수라 전 종목 벌크 조회가 불가능하다.

그래서 2단으로 간다:
  1) list.json 벌크 조회로 '최근 N일 안에 지분공시를 낸 회사' 만 추린다(≈370곳).
  2) 그 회사들에만 상세 API 를 호출한다(≈470회 — DART 일일 한도 2만의 2%).
전 종목에 무차별 호출하면 5,300회가 되고 대부분이 빈 응답이다.

주의: 두 상세 API 는 날짜 파라미터가 없어 전체 이력을 돌려준다(삼성전자 elestock 은
2,600건+). 반드시 rcept_dt 로 창을 잘라야 한다. 또 rcept_dt 형식이 list.json(YYYYMMDD)
과 달리 이미 하이픈이 들어간 YYYY-MM-DD 다.

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글·U+2014 출력이 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from sec_client import write_data  # noqa: E402
from build_kr_disclosures import (  # noqa: E402
    dart_get,
    fetch_disclosures,
    load_corp_map,
)

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "kr_ownership.json"
OUT_JS = ROOT / "data" / "kr_ownership.js"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

MAJOR_LABEL = "대량보유상황보고"
ELE_LABEL = "임원·주요주주 소유보고"


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def dart_link(rcept_no: str) -> str:
    r = str(rcept_no or "").strip()
    return f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={r}" if r else "https://dart.fss.or.kr/"


def norm_date(value) -> str:
    """majorstock/elestock 은 'YYYY-MM-DD', list.json 은 'YYYYMMDD' 를 준다."""
    s = str(value or "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return s


def to_num(value):
    """'1,198,938,025' / '-347,788' / '-' / '' → float 또는 None."""
    s = str(value or "").strip().replace(",", "")
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_outputs(payload: dict) -> None:
    # .json 은 빌더 상태(compact 유지), .js 는 브라우저 전역 — sec_client.write_data 로 통일.
    write_data(OUT_JSON, OUT_JS, "KR_OWNERSHIP", payload, indent=None)


def fetch_detail(api: str, corp_code: str, api_key: str, errors: dict) -> list[dict]:
    try:
        data = dart_get(f"{api}.json", {"corp_code": corp_code}, api_key)
    except Exception as exc:
        key = f"{api}:request:{type(exc).__name__}"
        errors[key] = errors.get(key, 0) + 1
        return []
    status = str(data.get("status") or "")
    if status == "013":
        return []                      # 조회된 데이터 없음
    if status != "000":
        key = f'{api}:{status}:{data.get("message") or ""}'.strip(":")
        errors[key] = errors.get(key, 0) + 1
        return []
    return data.get("list") or []


def build(api_key: str, days: int):
    snapshot = load_json(KR_SNAPSHOT, {"stocks": []})
    tracked = {
        str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        for s in snapshot.get("stocks") or []
        if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")
    }
    tracked.discard("000000")
    if not tracked:
        raise SystemExit("[지분] KR 스냅샷에서 추적 종목을 못 읽었다.")

    # 1단계: 최근 지분공시를 낸 회사만 추린다.
    disclosures, list_errors = fetch_disclosures(api_key, tracked, days=days)
    if list_errors:
        print(f"[지분] 목록 조회 오류: {list_errors}")
    targets: dict[str, set[str]] = {"major": set(), "ele": set()}
    for d in disclosures:
        if d["typeLabel"] == MAJOR_LABEL:
            targets["major"].add(d["ticker"])
        elif d["typeLabel"] == ELE_LABEL:
            targets["ele"].add(d["ticker"])
    print(f"[지분] 상세 호출 대상 — 대량보유 {len(targets['major'])}종목 / "
          f"임원소유 {len(targets['ele'])}종목")

    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise SystemExit("[지분] corpCode.xml 수집 실패 — 중단한다.")

    cutoff = (datetime.now(KST).date() - timedelta(days=days)).strftime("%Y-%m-%d")
    errors: dict[str, int] = {}
    company_of = {d["ticker"]: d["company"] for d in disclosures}

    # 2단계: 대량보유 상세.
    major_rows = []
    for ticker in sorted(targets["major"]):
        corp = corp_map.get(ticker)
        if not corp:
            errors["major:corp_code-missing"] = errors.get("major:corp_code-missing", 0) + 1
            continue
        for row in fetch_detail("majorstock", corp, api_key, errors):
            file_date = norm_date(row.get("rcept_dt"))
            if file_date < cutoff:
                continue               # 이 API 는 전체 이력을 주므로 직접 자른다
            major_rows.append({
                "ticker": ticker,
                "company": str(row.get("corp_name") or company_of.get(ticker) or "").strip(),
                "filer": str(row.get("repror") or "").strip(),
                "reportType": str(row.get("report_tp") or "").strip(),
                "ratio": to_num(row.get("stkrt")),
                "ratioChange": to_num(row.get("stkrt_irds")),
                "shares": to_num(row.get("stkqy")),
                "sharesChange": to_num(row.get("stkqy_irds")),
                "reason": " ".join(str(row.get("report_resn") or "").split())[:200],
                "fileDate": file_date,
                "link": dart_link(row.get("rcept_no")),
            })

    # 2단계: 임원·주요주주 소유 상세.
    ele_rows = []
    for ticker in sorted(targets["ele"]):
        corp = corp_map.get(ticker)
        if not corp:
            errors["ele:corp_code-missing"] = errors.get("ele:corp_code-missing", 0) + 1
            continue
        for row in fetch_detail("elestock", corp, api_key, errors):
            file_date = norm_date(row.get("rcept_dt"))
            if file_date < cutoff:
                continue
            ele_rows.append({
                "ticker": ticker,
                "company": str(row.get("corp_name") or company_of.get(ticker) or "").strip(),
                "filer": str(row.get("repror") or "").strip(),
                "position": str(row.get("isu_exctv_ofcps") or "").strip(),
                "registered": str(row.get("isu_exctv_rgist_at") or "").strip(),
                "holderType": str(row.get("isu_main_shrholdr") or "").strip(),
                "shares": to_num(row.get("sp_stock_lmp_cnt")),
                "sharesChange": to_num(row.get("sp_stock_lmp_irds_cnt")),
                "fileDate": file_date,
                "link": dart_link(row.get("rcept_no")),
            })

    major_rows.sort(key=lambda x: (x["fileDate"], abs(x["ratioChange"] or 0)), reverse=True)
    ele_rows.sort(key=lambda x: (x["fileDate"], abs(x["sharesChange"] or 0)), reverse=True)
    return major_rows, ele_rows, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="KR 지분공시(대량보유·임원소유) 상세 수집")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        payload = {
            "updatedAtKst": now_kst(),
            "windowDays": args.days,
            "source": "DART Open API",
            "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
            "majorHolders": [],
            "insiders": [],
        }
        write_outputs(payload)
        print("DART_API_KEY missing; wrote empty kr_ownership payload.")
        return 0

    major_rows, ele_rows, errors = build(api_key, args.days)
    if errors:
        print(f"[지분] 오류 응답 {sum(errors.values())}건: {errors}")
    if not major_rows and not ele_rows and errors:
        # 빈 결과를 그대로 쓰면 기존 데이터를 지우고 성공한 척 넘어간다.
        print("[지분] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    payload = {
        "updatedAtKst": now_kst(),
        "windowDays": args.days,
        "source": "DART Open API",
        "note": "최근 지분공시를 낸 코스피·코스닥 종목의 대량보유(5%룰)·임원 소유 상세.",
        "majorCount": len(major_rows),
        "insiderCount": len(ele_rows),
        "majorHolders": major_rows,
        "insiders": ele_rows,
    }
    write_outputs(payload)
    print(f"[지분] 대량보유 {len(major_rows)}건 / 임원소유 {len(ele_rows)}건 기록.")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/kr_ownership.json", "data/kr_ownership.js"],
                "KR ownership disclosures",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
