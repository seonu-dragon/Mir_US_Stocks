#!/usr/bin/env python3
"""Korea DART disclosures for tracked KR universe tickers.

Requires DART_API_KEY (https://opendart.fss.or.kr/). Without a key, writes an empty
payload so the site can still load the feature shell.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "kr_disclosures.json"
OUT_JS = ROOT / "data" / "kr_disclosures.js"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

DART_BASE = "https://opendart.fss.or.kr/api"

# list.json 응답에는 공시유형 코드가 없다. 돌려주는 필드는 corp_code·corp_name·
# stock_code·corp_cls·report_nm·rcept_no·flr_nm·rcept_dt·rm 뿐이라, 유형은
# 보고서명(report_nm)에서 추려야 한다. 위에서부터 먼저 맞는 것을 쓴다.
TYPE_RULES = (
    # 정기공시
    ("분기보고서", "분기보고서"),
    ("반기보고서", "반기보고서"),
    ("사업보고서", "사업보고서"),
    ("감사보고서", "감사보고서"),
    ("지속가능경영", "지속가능경영보고서"),
    # 지분
    ("대량보유", "대량보유상황보고"),
    ("소유상황보고", "임원·주요주주 소유보고"),
    ("최대주주", "최대주주 변동"),
    # 발행·증권
    ("증권발행실적", "증권발행실적"),
    ("투자설명서", "투자설명서"),
    ("일괄신고", "일괄신고 추가서류"),
    ("증권신고", "증권신고"),
    ("유상증자", "증자·사채"),
    ("무상증자", "증자·사채"),
    ("전환사채", "증자·사채"),
    ("신주인수권", "증자·사채"),
    # 영업·주요사항
    ("주요사항보고", "주요사항보고"),
    ("단일판매", "공급계약"),
    ("공급계약", "공급계약"),
    ("배당", "배당"),
    ("자기주식", "자기주식"),
    ("주주총회", "주주총회"),
    ("계열금융회사", "계열사 금융거래"),
    ("공정거래", "공정위 공시"),
)


def type_label(report_nm: str) -> str:
    for needle, label in TYPE_RULES:
        if needle in report_nm:
            return label
    return "공시"


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_outputs(payload: dict) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(OUT_JSON, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    js = "window.KR_DISCLOSURES = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"
    atomic_write_text(OUT_JS, js)


def dart_get(path: str, params: dict, api_key: str) -> dict:
    q = {**params, "crtfc_key": api_key}
    url = f"{DART_BASE}/{path}?{urllib.parse.urlencode(q)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mir-US-Stocks/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_corp_map(api_key: str) -> dict[str, str]:
    import zipfile
    import io
    import xml.etree.ElementTree as ET

    url = f"{DART_BASE}/corpCode.xml?crtfc_key={api_key}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mir-US-Stocks/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            zip_data = resp.read()
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            with zf.open("CORPCODE.xml") as xml_file:
                tree = ET.parse(xml_file)
                root = tree.getroot()
        out = {}
        for list_node in root.findall("list"):
            stock = list_node.findtext("stock_code")
            corp = list_node.findtext("corp_code")
            if stock and corp:
                stock = stock.strip()
                corp = corp.strip()
                if stock:
                    out[stock.zfill(6)] = corp
        return out
    except Exception as e:
        print(f"Error loading corp map: {e}")
        return {}


def fetch_disclosures(api_key: str, corp_codes: list[str], days: int = 14):
    """(공시 목록, 오류통계) 를 돌려준다.

    오류를 통계로 올려보내는 이유: 이전 구현은 실패 응답을 조용히 continue 해서
    전건이 버려져도 '0건'으로만 보였고, 그 빈 결과가 그대로 게시됐다."""
    end = datetime.now(KST).date()
    begin = end - timedelta(days=days)
    bgn = begin.strftime("%Y%m%d")
    end_s = end.strftime("%Y%m%d")
    out = []
    errors: dict[str, int] = {}
    for corp_code in corp_codes[:120]:
        try:
            data = dart_get(
                "list.json",
                {
                    "corp_code": corp_code,
                    "bgn_de": bgn,
                    "end_de": end_s,
                    # pblntf_ty 는 STRING(1) 이라 "A,B,C,D,E,I" 처럼 여러 코드를
                    # 넘기면 status 100(부적절한 값)이 되어 전건이 버려진다.
                    # 선택 인자이므로 생략해 전체 유형을 받는다.
                    "page_count": "100",
                },
                api_key,
            )
        except Exception as exc:
            errors[f"request:{type(exc).__name__}"] = errors.get(f"request:{type(exc).__name__}", 0) + 1
            continue
        status = str(data.get("status") or "")
        if status == "013":
            continue        # 조회된 데이터 없음 — 그 종목에 공시가 없을 뿐이다
        if status != "000":
            key = f'{status}:{data.get("message") or ""}'.strip(":")
            errors[key] = errors.get(key, 0) + 1
            continue
        for row in data.get("list") or []:
            stock = str(row.get("stock_code") or "").strip().zfill(6)
            report = str(row.get("report_nm") or "").strip()
            rcept = str(row.get("rcept_no") or "").strip()
            rcept_dt = str(row.get("rcept_dt") or "").strip()
            if len(rcept_dt) == 8:
                rcept_dt = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:8]}"
            out.append({
                "ticker": stock,
                "company": str(row.get("corp_name") or "").strip(),
                "title": report,
                "typeLabel": type_label(report),
                "fileDate": rcept_dt,
                "link": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept}" if rcept else "https://dart.fss.or.kr/",
            })
    out.sort(key=lambda x: (x.get("fileDate") or "", x.get("ticker") or ""), reverse=True)
    return out[:500], errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--days", type=int, default=14)
    args = parser.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    snapshot = load_json(KR_SNAPSHOT, {"stocks": []})
    tickers = sorted({
        str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        for s in snapshot.get("stocks") or []
        if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")
    })

    if not api_key:
        payload = {
            "updatedAtKst": now_kst(),
            "lastFileDate": datetime.now(KST).strftime("%Y-%m-%d"),
            "count": 0,
            "source": "DART Open API",
            "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
            "disclosures": [],
        }
        write_outputs(payload)
        print("DART_API_KEY missing; wrote empty kr_disclosures payload.")
        return 0

    corp_map = load_corp_map(api_key)
    corp_codes = [corp_map[t] for t in tickers if t in corp_map]
    if not corp_codes:
        print("[DART] corp_code 매핑 0건 — corpCode.xml 수집 실패로 보고 중단한다.")
        return 1

    disclosures, errors = fetch_disclosures(api_key, corp_codes, days=args.days)
    if errors:
        print(f"[DART] 오류 응답 {sum(errors.values())}건: {errors}")
    if not disclosures and errors:
        # 빈 결과를 그대로 쓰면 기존 데이터를 지우고 성공한 척 넘어간다.
        # 07-01 이후 계속 0건이 게시된 원인이 정확히 이것이었다.
        print("[DART] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    last_date = disclosures[0]["fileDate"] if disclosures else datetime.now(KST).strftime("%Y-%m-%d")
    payload = {
        "updatedAtKst": now_kst(),
        "lastFileDate": last_date,
        "count": len(disclosures),
        "source": "DART Open API",
        "note": "추적 KR 종목 한정. 실적·지분·주요사항 공시.",
        "disclosures": disclosures,
    }
    write_outputs(payload)
    print(f"Wrote {len(disclosures)} KR disclosures.")

    if args.push:
        # 생 git push 는 다른 데이터 워크플로우가 먼저 푸시하면 non-fast-forward
        # 로 죽는다. 다른 빌더와 같이 fetch→rebase→push 재시도가 있는 공용
        # 헬퍼를 쓴다.
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/kr_disclosures.json", "data/kr_disclosures.js"],
                "KR DART disclosures",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())