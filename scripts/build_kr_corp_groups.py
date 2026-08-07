#!/usr/bin/env python3
"""KR 그룹사 매핑 — 공정거래위원회 공시대상기업집단(대기업집단) 소속회사.

공정위는 매년 5/1 자산 5조 원 이상 기업집단(공시대상)·10조 원 이상(상호출자제한)을
지정하고, 기업집단포털 오픈API 로 집단·소속회사 전체 명단을 공개한다. "이 종목이
어느 그룹 소속인가"는 지배구조·동반 급등락·내부거래 이슈를 읽는 기본 축이라
종목 화면의 그룹사 맥락으로 쓴다.

  https://www.data.go.kr/data/15091886/openapi.do  지정된 대규모기업집단 조회
  https://www.data.go.kr/data/15091891/openapi.do  지정된 대규모기업집단 소속회사 조회
  - 인증키: 공공데이터포털 DATA_GO_KR_KEY (URL-디코딩된 원본, env 로만 주입).
    두 서비스 모두 활용신청 승인 완료(2026-08). publicYmList 는 미신청이라
    지정년월은 당해 5월 → 전년 5월 폴백으로 스스로 찾는다.
  - presentnYear=YYYYMM (지정년월, 5월). 응답 XML. 소속회사는 집단코드 없이
    전체 페이지네이션 가능(2026년 102개 집단, 소속회사 3,539개).
  - **연 1회(5/1) 갱신** 데이터라 asOf 로 지정 기준일을 명시하고
    check_data_freshness.py 의 나이 기반 감시에는 넣지 않는다.

매칭: 공정위 소속회사명은 법인 등기명(예: "(주)비지에프리테일", "에스케이(주)")이고
스냅샷 상장사명은 KRX 축약명(예: "BGF리테일", "SK")이다. 정규화 후 **완전 일치만**
인정하되, 라틴 문자를 한글 표기로 결정적으로 변환한 보조 키(BGF리테일→비지에프리테일)를
스냅샷 쪽에 함께 등록해 등기명과 만나게 한다(부분 일치·유사도 매칭은 쓰지 않는다 —
데이터 정직성). 미매칭 소속회사는 대부분 비상장 계열사로 정상이다.

산출물: data/korea/corp_groups.json + .js(window.KR_CORP_GROUPS).
상장 계열사 매칭이 80건 미만이면 기존 파일 유지 + exit 1(대기업집단 상장사는
~300개 — 그 밑이면 소스/매칭 이상).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

from briefing_store import atomic_write_text, repository_publish_lock  # 중단 시 잘린 JSON 방지

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "corp_groups.json"
OUT_JS = ROOT / "data" / "korea" / "corp_groups.js"

BASE = "https://apis.data.go.kr/1130000"
GROUPS_API = f"{BASE}/appnGroupSttusList/appnGroupSttusListApi"
AFFI_API = f"{BASE}/appnGroupAffiList/appnGroupAffiListApi"
UA = {"User-Agent": "Mozilla/5.0 (Mir US Stocks research; dydtjsdn@gmail.com)"}
PAGE_ROWS = 500
MAX_PAGES = 60          # 3,539건/500행 = 8페이지 — 이 이상이면 페이지네이션 이상
MIN_MATCHED = 80        # 대기업집단 상장 계열사는 ~300개 — 이 밑이면 소스/매칭 이상

_PAREN = re.compile(r"\([^)]*\)|（[^）]*）")

# 라틴 문자 → 한글 음역(등기명 표기). 다문자 우선 없음 — 문자 단위라 결정적이다.
_LAT2HAN = {
    "A": "에이", "B": "비", "C": "씨", "D": "디", "E": "이", "F": "에프",
    "G": "지", "H": "에이치", "I": "아이", "J": "제이", "K": "케이", "L": "엘",
    "M": "엠", "N": "엔", "O": "오", "P": "피", "Q": "큐", "R": "알",
    "S": "에스", "T": "티", "U": "유", "V": "브이", "W": "더블유",
    "X": "엑스", "Y": "와이", "Z": "제트", "&": "앤",
}
# 문자 단위 음역이 안 통하는 단어형 사명(NAVER≠엔에이브이이알). 확실한 것만.
_WORD_ALIASES = {"NAVER": "네이버", "POSCO": "포스코"}

# KRX 축약명 → 공정위 등기명. 음역으로도 못 잇는 축약(보험사 '해상보험' 생략 등)만
# 수기 등록한다. 키는 스냅샷 company 원문과 **완전 일치**, 값은 2026-05 공정위
# 소속회사 명단에서 실물 확인한 등기명이다(추정 금지 — 데이터 정직성).
_KRX_ALIASES = {
    "현대차": "현대자동차",
    "삼성생명": "삼성생명보험",
    "삼성화재": "삼성화재해상보험",
    "한화생명": "한화생명보험",
    "미래에셋생명": "미래에셋생명보험",
    "현대해상": "현대해상화재보험",
    "흥국화재": "흥국화재해상보험",
    "롯데칠성": "롯데칠성음료",
    "코오롱인더": "코오롱인더스트리",
    "에코프로머티": "에코프로머티리얼즈",
    "리가켐바이오": "리가켐바이오사이언스",
    "한국항공우주": "한국항공우주산업",
    "에스엠": "에스엠엔터테인먼트",       # SM엔터(041510) — 카카오 계열
    "HL D&I": "에이치엘디앤아이한라",
    "LIG디펜스앤에어로스페이스": "엘아이지넥스원",  # 2026 사명변경, 공정위는 옛 등기명
    "S-Oil": "에스오일",                  # 등기명 '에쓰-오일' — norm 의 에쓰→에스와 만난다
    "큐캐피탈": "큐캐피탈파트너스",
    "이리츠코크렙": "이리츠코크렙기업구조조정부동산투자회사",
}


def kst_now():
    return datetime.now(timezone(timedelta(hours=9)))


def norm_name(s: str) -> str:
    """법인명 정규화: 괄호내용·(주)·주식회사·㈜·공백·구분기호 제거, 에쓰→에스, 대문자."""
    s = _PAREN.sub("", s or "")
    for token in ("주식회사", "㈜", "(주)"):
        s = s.replace(token, "")
    s = re.sub(r"[\s\-·.,ㆍ]+", "", s)
    s = s.replace("에쓰", "에스")  # 에쓰-오일 등 옛 표기 통일
    return s.upper()


def lat2han(s: str) -> str:
    """라틴 문자를 한글 음역으로 치환(KRX 축약명 → 등기명 표기 근사). 결정적 변환."""
    up = s.upper()
    for word, han in _WORD_ALIASES.items():
        up = up.replace(word, han)
    return "".join(_LAT2HAN.get(ch, ch) for ch in up)


def api_get(url: str, params: dict) -> ET.Element:
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if not key:
        raise RuntimeError("DATA_GO_KR_KEY 환경변수 없음 (URL-디코딩된 원본 키)")
    qs = "serviceKey=" + urllib.parse.quote(key, safe="")
    for k, v in params.items():
        qs += f"&{k}={urllib.parse.quote(str(v))}"
    req = urllib.request.Request(f"{url}?{qs}", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    root = ET.fromstring(raw)
    # 게이트웨이 오류(미등록 키 등)는 OpenAPI_ServiceResponse 로 온다
    if root.tag == "OpenAPI_ServiceResponse":
        msg = root.findtext(".//returnAuthMsg") or root.findtext(".//errMsg") or "?"
        raise RuntimeError(f"공공데이터포털 게이트웨이 오류: {msg}")
    code = root.findtext("resultCode")
    if code != "00":
        raise RuntimeError(f"API 오류 resultCode={code} msg={root.findtext('resultMsg')}")
    return root


def fetch_all(url: str, item_tag: str, present_ym: str) -> list[ET.Element]:
    items: list[ET.Element] = []
    total = None
    for page in range(1, MAX_PAGES + 1):
        root = api_get(url, {"pageNo": page, "numOfRows": PAGE_ROWS, "presentnYear": present_ym})
        if total is None:
            total = int(root.findtext("totalCount") or 0)
        batch = root.findall(item_tag)
        items.extend(batch)
        if not batch or len(items) >= total:
            break
    if total is not None and len(items) < total:
        raise RuntimeError(f"페이지네이션 미완: {len(items)}/{total} ({item_tag})")
    return items


def pick_present_ym() -> tuple[str, list[ET.Element]]:
    """지정년월(당해 5월 → 전년 5월) 자동 선택. 집단 목록을 함께 돌려준다."""
    year = kst_now().year
    last_err: Exception | None = None
    for y in (year, year - 1):
        ym = f"{y}05"
        try:
            groups = fetch_all(GROUPS_API, "appnGroupSttus", ym)
        except RuntimeError as e:
            last_err = e
            continue
        if groups:
            return ym, groups
    raise RuntimeError(f"사용 가능한 지정년월 없음 (최근 2개년 5월 시도): {last_err}")


def load_listed() -> dict[str, tuple[str, str]]:
    """정규화 키 → (ticker, company). 원명 키 + 라틴→한글 음역 키를 함께 등록.
    서로 다른 종목이 같은 키를 내면 그 키는 제외(모호성 배제 — 데이터 정직성)."""
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    by_norm: dict[str, tuple[str, str]] = {}
    ambiguous: set[str] = set()
    for s in snap.get("stocks", []):
        name, ticker = s.get("company"), s.get("ticker")
        if not name or not ticker:
            continue
        keys = {norm_name(name), norm_name(lat2han(name))}
        if name in _KRX_ALIASES:
            keys.add(norm_name(_KRX_ALIASES[name]))
        for key in keys:
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
    present_ym, group_items = pick_present_ym()
    as_of = f"{present_ym[:4]}-{present_ym[4:]}-01"
    print(f"지정년월 {present_ym} (기준일 {as_of}), 기업집단 {len(group_items)}개")

    chiefs: dict[str, str] = {}
    for g in group_items:
        name = (g.findtext("unityGrupNm") or "").strip()
        chief = (g.findtext("smerNm") or "").strip()
        if name:
            chiefs.setdefault(name, chief)

    affi_items = fetch_all(AFFI_API, "appnGroupAffi", present_ym)
    print(f"소속회사 {len(affi_items)}개")

    listed = load_listed()
    print(f"상장사 매칭 테이블 {len(listed)}키")

    groups: dict[str, dict] = {}
    by_ticker: dict[str, str] = {}
    matched = 0
    for a in affi_items:
        grp = (a.findtext("unityGrupNm") or "").strip()
        comp = (a.findtext("entrprsNm") or "").strip()
        if not grp or not comp:
            continue
        entry = groups.setdefault(grp, {
            "name": grp,
            "chief": chiefs.get(grp) or None,
            "companyCount": 0,
            "listedCount": 0,
            "listed": [],
        })
        entry["companyCount"] += 1
        hit = listed.get(norm_name(comp))
        if not hit:
            continue
        ticker, snap_name = hit
        if ticker in by_ticker:  # 같은 상장사가 두 번 잡히면 첫 매칭 유지
            continue
        by_ticker[ticker] = grp
        entry["listed"].append({"ticker": ticker, "company": snap_name})
        entry["listedCount"] += 1
        matched += 1

    total = len(affi_items)
    print(f"상장 계열사 매칭 {matched}/{total}건 ({matched / total * 100:.1f}%) — 미매칭은 비상장 계열사(정상)")
    top = sorted(groups.values(), key=lambda g: (-g["listedCount"], g["name"]))
    for g in top[:5]:
        print(f"  {g['name']}: 상장 {g['listedCount']} / 전체 {g['companyCount']}")
    if matched < MIN_MATCHED:
        return None

    for g in top:
        g["listed"].sort(key=lambda x: x["ticker"])

    return {
        "updatedAtKst": kst_now().strftime("%Y-%m-%d %H:%M KST"),
        "asOf": as_of,  # 공정위 지정 기준일(매년 5/1) — 연 1회 갱신 데이터
        "source": "공정거래위원회 기업집단포털 오픈API(공시대상기업집단 지정·소속회사)",
        "groupCount": len(top),
        "listedTotal": matched,
        "groups": top,
        "byTicker": by_ticker,
    }


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="KR 공정위 기업집단 소속 상장사 매핑")
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    print("=== KR 기업집단(공정위) 그룹사 매핑 수집 ===")
    try:
        payload = build()
    except Exception as e:  # noqa: BLE001
        print(f"[corp-groups] 수집 실패({type(e).__name__}: {e}) — 기존 파일 유지")
        return 1
    if not payload:
        print(f"[corp-groups] 상장 계열사 매칭 {MIN_MATCHED}건 미만 — 기존 파일 유지")
        return 1
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.KR_CORP_GROUPS = {compact};\n")
    print(f"집단 {payload['groupCount']}개, 상장 계열사 {payload['listedTotal']}종목 (기준일 {payload['asOf']}) → {OUT_JSON.name}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/corp_groups.json", "data/korea/corp_groups.js"],
                "KR corp groups (FTC)",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
