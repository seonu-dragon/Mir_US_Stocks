#!/usr/bin/env python3
"""한국 지배구조·수급 프로필 — 소액주주 · 자기주식 · 최대주주.

미국 쪽에는 13F·의회·내부자 패널이 있는데 한국은 대칭이 없었다. DART 사업보고서
주요정보로 한국 고유의 각도를 만든다:

  소액주주  유통물량(free float) proxy — 삼성전자 소액주주가 주식의 66.04%
  자기주식  밸류업 시그널 (미국 buyback 과 대칭)
  최대주주  오너·특수관계인 합산 지분율 19.84%

셋 다 corp_code 가 필수라 벌크가 안 된다(종목당 3회 ≈ 7,800회). 다중회사 버전이
있는 재무지표(fnlttCmpnyIndx)와 달리 여기는 방법이 없어서, 값이 사업보고서에만
바뀌는 점을 이용해 주간으로 돌린다.

응답 구조 함정(실측으로 확인):
  - 자기주식은 '주식종류 × 취득방법' 으로 18행쯤 오고, 합계는 acqs_mth1 == '총계' 행이다.
  - 최대주주는 특수관계인별로 오고, 합계는 nm 이 정확히 '계' 인 행이다.
    '계' 를 부분문자열로 찾으면 '삼성생명보험(특별계정)' 이 걸린다 — 반드시 완전일치.
  - 비율이 '66.04%' 처럼 % 가 붙어서 온다.

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
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
from build_kr_disclosures import dart_get, load_corp_map  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "korea" / "ownership_profile.json"
OUT_JS = ROOT / "data" / "korea" / "ownership_profile.js"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

# 보통주를 부르는 이름이 회사마다 다르다. 상위 40종목 전수조사 결과:
#   보통주(367) · 의결권 있는 주식(79) · 보통주식(34)
# 우선주·종류주식·2우선주·배당우선전환주식 등은 제외 대상이다.
# '보통주' 부분일치로 잡으면 안 된다 — 현대차는 '의결권 있는 주식' 이라 아예 안 걸린다.
COMMON_KINDS = {"보통주", "보통주식", "의결권 있는 주식"}
# 최대주주 본인을 가리키는 relate 값도 갈린다(최대주주 본인 / 본인). 나머지는
# 특수관계인·친인척·계열회사 임원 등이라 본인이 아니다.
SELF_RELATIONS = {"최대주주 본인", "본인"}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def to_num(value):
    """'3,909,148,867' / '66.04%' / '-' / '' → float|None."""
    s = str(value or "").strip().replace(",", "").rstrip("%")
    if not s or s == "-":
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    return None if v != v else v


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_outputs(payload: dict) -> None:
    # .json 은 빌더 상태(compact 유지), .js 는 브라우저 전역 — sec_client.write_data 로 통일.
    write_data(OUT_JSON, OUT_JS, "KR_OWNERSHIP_PROFILE", payload, indent=None)


def _rows(api: str, corp: str, year: str, api_key: str, errors: dict) -> list[dict]:
    try:
        data = dart_get(f"{api}.json",
                        {"corp_code": corp, "bsns_year": year, "reprt_code": "11011"},
                        api_key)
    except Exception as exc:
        k = f"{api}:request:{type(exc).__name__}"
        errors[k] = errors.get(k, 0) + 1
        return []
    status = str(data.get("status") or "")
    if status == "013":
        return []
    if status != "000":
        k = f'{api}:{status}'.strip(":")
        errors[k] = errors.get(k, 0) + 1
        return []
    return data.get("list") or []


def minority_holders(rows: list[dict]) -> dict:
    """소액주주 현황. 유통물량 proxy 로 hold_stock_rate 를 쓴다."""
    for r in rows:
        rate = to_num(r.get("hold_stock_rate"))
        if rate is None:
            continue
        out = {"freeFloatPct": rate}
        holders = to_num(r.get("shrholdr_co"))
        if holders is not None:
            out["minorityHolders"] = int(holders)
        return out
    return {}


def treasury_stock(rows: list[dict]) -> dict:
    """자기주식. 합계는 acqs_mth1 == '총계' 행이고, 보통주만 본다."""
    for r in rows:
        if str(r.get("acqs_mth1") or "").strip() != "총계":
            continue
        if str(r.get("stock_knd") or "").strip() not in COMMON_KINDS:
            continue
        held = to_num(r.get("trmend_qy"))
        if held is None:
            continue
        out = {"treasuryShares": int(held)}
        acq = to_num(r.get("change_qy_acqs"))
        dsp = to_num(r.get("change_qy_dsps"))
        if acq is not None:
            out["treasuryAcquired"] = int(acq)
        if dsp is not None:
            out["treasuryDisposed"] = int(dsp)
        return out
    return {}


def major_holder(rows: list[dict]) -> dict:
    """최대주주. 합계는 nm 이 정확히 '계' 인 행 — 부분일치로 찾으면 '(특별계정)' 이 걸린다."""
    out = {}
    for r in rows:
        if str(r.get("nm") or "").strip() != "계":
            continue
        if str(r.get("stock_knd") or "").strip() not in COMMON_KINDS:
            continue
        rate = to_num(r.get("trmend_posesn_stock_qota_rt"))
        if rate is not None:
            out["ownerStakePct"] = rate
        break

    # 최대주주 '본인' 이름 — 지배구조를 한눈에 보여준다. relate 어휘가 회사마다 갈려
    # (최대주주 본인 / 본인 / 표기 없음) 매칭만으론 3분의 1밖에 못 잡는다. 보고서가
    # 본인을 맨 앞에 싣는 관행을 폴백으로 쓴다 — 삼성전자(삼성생명보험)·현대차(현대모비스)
    # 둘 다 첫 행이 최대주주였다.
    def _name(r):
        return str(r.get("nm") or "").replace("\n", " ").strip()

    named = [r for r in rows if _name(r) and _name(r) != "계"]
    top = next((r for r in named if str(r.get("relate") or "").strip() in SELF_RELATIONS), None)
    if top is None:
        top = next((r for r in named
                    if str(r.get("stock_knd") or "").strip() in COMMON_KINDS), None)
    if top is not None:
        out["topHolder"] = _name(top)
    return out


def build(api_key: str, year: str, limit: int | None):
    snapshot = load_json(KR_SNAPSHOT, {"stocks": []})
    stocks = [s for s in snapshot.get("stocks") or []
              if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")]
    stocks.sort(key=lambda s: s.get("marketCapB") if isinstance(s.get("marketCapB"), (int, float)) else 0,
                reverse=True)

    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise SystemExit("[프로필] corpCode.xml 수집 실패 — 중단한다.")

    pairs = []
    for s in stocks:
        t = str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        corp = corp_map.get(t)
        if corp:
            pairs.append((t, corp))
    if limit:
        pairs = pairs[:limit]
    print(f"[프로필] 대상 {len(pairs)}종목 × 3 API = 약 {len(pairs) * 3}회 호출")

    out: dict[str, dict] = {}
    errors: dict[str, int] = {}
    for i, (ticker, corp) in enumerate(pairs, 1):
        if i % 300 == 0:
            print(f"[프로필] {i}/{len(pairs)} …")
        row = {}
        row.update(minority_holders(_rows("mrhlSttus", corp, year, api_key, errors)))
        row.update(treasury_stock(_rows("tesstkAcqsDspsSttus", corp, year, api_key, errors)))
        row.update(major_holder(_rows("hyslrSttus", corp, year, api_key, errors)))
        if row:
            out[ticker] = row
    return out, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="KR 지배구조·수급 프로필 (소액주주·자기주식·최대주주)")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--year", default="", help="사업연도. 기본은 작년.")
    parser.add_argument("--limit", type=int, default=None, help="시총 상위 N종목만(테스트용)")
    args = parser.parse_args()

    year = args.year.strip() or str(datetime.now(KST).year - 1)
    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        write_outputs({"updatedAtKst": now_kst(), "source": "DART Open API · 사업보고서 주요정보",
                       "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
                       "year": year, "profiles": {}})
        print("DART_API_KEY missing; wrote empty kr ownership profile payload.")
        return 0

    profiles, errors = build(api_key, year, args.limit)
    if errors:
        print(f"[프로필] 오류 응답 {sum(errors.values())}건: {dict(list(errors.items())[:5])}")
    if not profiles and errors:
        print("[프로필] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    counts: dict[str, int] = {}
    for row in profiles.values():
        for k in row:
            counts[k] = counts.get(k, 0) + 1

    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART Open API · 사업보고서 주요정보",
        "note": "소액주주 유통물량·자기주식·최대주주 지분율. 최신 사업보고서 기준.",
        "year": year,
        "companyCount": len(profiles),
        "coverage": counts,
        "profiles": profiles,
    }
    write_outputs(payload)
    print(f"[프로필] {len(profiles)}종목 기록.")
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"    {k:18s} {v}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/ownership_profile.json", "data/korea/ownership_profile.js"],
                "KR ownership profile",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
