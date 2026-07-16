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
    # 실적 — 정기보고서보다 먼저 시장에 나오는 숫자라 따로 세운다.
    # "연결재무제표기준영업(잠정)실적(공정공시)" / "영업(잠정)실적(공정공시)" 둘 다 잡는다.
    ("(잠정)실적", "잠정실적"),
    ("결산실적공시예고", "실적공시 예고"),
    # 지분
    ("대량보유", "대량보유상황보고"),
    ("소유상황보고", "임원·주요주주 소유보고"),
    ("거래계획", "임원·주요주주 거래계획"),
    ("최대주주", "최대주주 변동"),
    ("타법인주식및출자증권", "타법인 지분취득"),
    # 발행·증권
    ("증권발행실적", "증권발행실적"),
    ("증권발행결과", "증권발행결과"),
    ("투자설명서", "투자설명서"),
    ("일괄신고", "일괄신고 추가서류"),
    ("증권신고", "증권신고"),
    ("유상증자", "증자·사채"),
    ("무상증자", "증자·사채"),
    ("전환사채", "증자·사채"),
    ("신주인수권", "증자·사채"),
    ("전환가액", "증자·사채"),
    # 영업·주요사항
    ("주요사항보고", "주요사항보고"),
    ("단일판매", "공급계약"),
    ("공급계약", "공급계약"),
    ("배당", "배당"),
    ("자기주식", "자기주식"),
    ("신탁계약", "자기주식 신탁"),
    ("주주총회", "주주총회"),
    ("의결권대리행사", "주주총회"),
    ("주주명부", "주주명부·기준일"),
    ("계열금융회사", "계열사 금융거래"),
    ("공정거래", "공정위 공시"),
    # 지배구조·기타 — 전부 "공시" 로 뭉뚱그려지던 것들
    ("기업설명회", "IR"),
    ("대표이사변경", "임원 변동"),
    ("사외이사", "임원 변동"),
    ("채무보증", "채무보증"),
    ("주권매매거래정지", "거래정지"),
    ("주식병합", "주식병합"),
    ("투자판단관련", "주요경영사항"),
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


MAX_PAGES_PER_CLS = 60          # 안전장치. 100건/페이지 × 60 = 법인구분당 6,000건
# 순수 안전망이다. 평소엔 걸리면 안 된다 — 걸리면 조회 기간이 조용히 잘리므로 로그로 알린다.
# (전 종목 커버로 바꾼 직후 캡 3000 이 14일치를 7일로 말없이 깎은 적이 있다.)
DISCLOSURE_CAP = 6000


def _fmt_date(rcept_dt: str) -> str:
    s = str(rcept_dt or "").strip()
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 else s


def fetch_disclosures(api_key: str, tracked: set[str], days: int = 14):
    """(공시 목록, 오류통계) 를 돌려준다.

    list.json 을 corp_code 없이 '날짜 범위'로 조회해 유가(Y)·코스닥(K) 전체 공시를
    페이지 단위로 받아온 뒤, 추적 중인 종목만 남긴다.

    예전엔 종목마다 한 번씩 호출하면서 `corp_codes[:120]` 으로 잘랐는데, corp_code 목록이
    종목코드 오름차순이라 커버 범위가 000020~002680 에서 끝났다. 그 결과 커버리지가
    중요도와 무관해졌고 — 삼성전자(005930) 를 포함해 시총 상위 15개 중 13개가 조회조차
    되지 않았다(2,666종목 중 2,546종목이 대상 밖). 벌크 조회는 호출 수가 오히려 줄면서
    전 종목을 덮는다.

    오류를 통계로 올려보내는 이유: 이전 구현은 실패 응답을 조용히 continue 해서
    전건이 버려져도 '0건'으로만 보였고, 그 빈 결과가 그대로 게시됐다."""
    end = datetime.now(KST).date()
    begin = end - timedelta(days=days)
    bgn = begin.strftime("%Y%m%d")
    end_s = end.strftime("%Y%m%d")

    out: list[dict] = []
    errors: dict[str, int] = {}
    seen: set[str] = set()

    for corp_cls in ("Y", "K"):          # 유가증권 / 코스닥
        page_no = 1
        while page_no <= MAX_PAGES_PER_CLS:
            try:
                data = dart_get(
                    "list.json",
                    {
                        "bgn_de": bgn,
                        "end_de": end_s,
                        "corp_cls": corp_cls,
                        # pblntf_ty 는 STRING(1) 이라 "A,B,C,D,E,I" 처럼 여러 코드를
                        # 넘기면 status 100(부적절한 값)이 되어 전건이 버려진다.
                        # 선택 인자이므로 생략해 전체 유형을 받는다.
                        "page_no": str(page_no),
                        "page_count": "100",       # 문서상 최대값
                    },
                    api_key,
                )
            except Exception as exc:
                errors[f"request:{type(exc).__name__}"] = errors.get(f"request:{type(exc).__name__}", 0) + 1
                break

            status = str(data.get("status") or "")
            if status == "013":
                break        # 조회된 데이터 없음
            if status != "000":
                key = f'{corp_cls}:{status}:{data.get("message") or ""}'.strip(":")
                errors[key] = errors.get(key, 0) + 1
                break

            for row in data.get("list") or []:
                stock = str(row.get("stock_code") or "").strip().zfill(6)
                if stock not in tracked:
                    continue                     # 추적 유니버스 밖(비상장·스팩 등)
                rcept = str(row.get("rcept_no") or "").strip()
                if rcept and rcept in seen:
                    continue                     # 같은 접수번호 중복 방지
                if rcept:
                    seen.add(rcept)
                report = str(row.get("report_nm") or "").strip()
                out.append({
                    "ticker": stock,
                    "company": str(row.get("corp_name") or "").strip(),
                    "title": report,
                    "typeLabel": type_label(report),
                    "fileDate": _fmt_date(row.get("rcept_dt")),
                    "link": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept}" if rcept else "https://dart.fss.or.kr/",
                })

            total_page = int(data.get("total_page") or 1)
            if page_no >= total_page:
                break
            page_no += 1
        else:
            errors[f"{corp_cls}:page-cap"] = MAX_PAGES_PER_CLS

    out.sort(key=lambda x: (x.get("fileDate") or "", x.get("ticker") or ""), reverse=True)
    if len(out) > DISCLOSURE_CAP:
        dropped_from = out[DISCLOSURE_CAP].get("fileDate")
        print(f"[DART] 캡 {DISCLOSURE_CAP} 초과({len(out)}건) — {dropped_from} 이전 공시가 잘린다. "
              f"--days 를 줄이거나 캡을 올릴 것.")
        out = out[:DISCLOSURE_CAP]
    return out, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--push", action="store_true")
    # 전 종목 커버로 바꾸면서 하루치 물량이 크게 늘었다(120종목 → 2,666종목). 14일이면
    # 6천건/1.4MB 라 7일로 잡는다 — '전 종목 7일' 이 '120종목 14일' 보다 훨씬 쓸모 있다.
    parser.add_argument("--days", type=int, default=7)
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

    # 벌크 조회는 응답의 stock_code 로 걸러내므로 corp_code 매핑(corpCode.xml)이 필요 없다.
    # load_corp_map 은 corp_code 가 필수인 상세 API(majorstock/elestock)용으로 남겨둔다.
    tracked = set(tickers)
    if not tracked:
        print("[DART] KR 스냅샷에서 추적 종목을 못 읽었다 — 중단한다.")
        return 1

    disclosures, errors = fetch_disclosures(api_key, tracked, days=args.days)
    if errors:
        print(f"[DART] 오류 응답 {sum(errors.values())}건: {errors}")
    print(f"[DART] 추적 {len(tracked)}종목 대상, 수집 {len(disclosures)}건 "
          f"({len({d['ticker'] for d in disclosures})}종목)")
    if not disclosures and errors:
        # 빈 결과를 그대로 쓰면 기존 데이터를 지우고 성공한 척 넘어간다.
        # 07-01 이후 계속 0건이 게시된 원인이 정확히 이것이었다.
        print("[DART] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    last_date = disclosures[0]["fileDate"] if disclosures else datetime.now(KST).strftime("%Y-%m-%d")
    dates = [d["fileDate"] for d in disclosures if d.get("fileDate")]
    payload = {
        "updatedAtKst": now_kst(),
        "lastFileDate": last_date,
        # 실제로 담긴 기간·종목수를 같이 싣는다. UI 가 "며칠치인지" 를 추측하지 않아도 되고,
        # 캡에 걸려 창이 줄면 그 사실이 데이터에 그대로 드러난다.
        "windowDays": args.days,
        "firstFileDate": min(dates) if dates else last_date,
        "count": len(disclosures),
        "companyCount": len({d["ticker"] for d in disclosures}),
        "source": "DART Open API",
        "note": "코스피·코스닥 추적 종목 전체. 실적·지분·주요사항 공시.",
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