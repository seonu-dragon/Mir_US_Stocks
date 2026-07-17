#!/usr/bin/env python3
"""한국 주요사항보고서 상세 — 공시 제목에 숫자를 붙인다.

DART 공시 패널의 한계는 '제목만 있고 숫자가 없다' 는 것이었다:

    주요사항보고서(유상증자결정)          <- 얼마나? 얼마나 희석되나?
    주요사항보고서(전환사채권발행결정)      <- 전환가는? 몇 % 희석?
    주요사항보고서(자기주식취득결정)        <- 몇 주? 얼마?

주요사항보고서 주요정보 API(DS005)가 그 숫자를 준다. 실측 예:

    벡트   유상증자    신주 3,673,610 / 기존 13,707,500 = 26.8% 희석, 운영자금 83.5억
    다보링크 전환사채    30억, 전환가 826원, 6.97% 희석, 표면이자 0%
    카스   자기주식취득  752,688주 7억, 장내 직접취득

효율: 이 API 들은 corp_code 가 필수지만 bgn_de/end_de 로 기간 조회가 된다. 전 종목에
호출할 필요 없이 kr_disclosures.json 에서 해당 제목의 공시를 낸 종목만 고르면
200회 안팎이면 끝난다(공시 유형별로 API 가 다르므로 제목 → API 매핑을 쓴다).

산출물은 rcept_no 를 키로 하는 별도 파일이다. kr_disclosures.json 을 건드리지 않아
매일 도는 공시 빌더와 서로 독립적이다.

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

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402
from build_kr_disclosures import dart_get, load_corp_map  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
OUT_JSON = ROOT / "data" / "kr_event_details.json"
OUT_JS = ROOT / "data" / "kr_event_details.js"
DISCLOSURES = ROOT / "data" / "kr_disclosures.json"

# 공시 제목(report_nm) 안의 키워드 → DS005 API. 위에서부터 먼저 맞는 것을 쓴다.
# 제목이 '[기재정정]주요사항보고서(유상증자결정)' 처럼 접두어를 달고 오므로 부분일치다.
TITLE_TO_API = (
    ("유상증자결정", "piicDecsn"),
    ("무상증자결정", "fricDecsn"),
    ("유무상증자결정", "pifricDecsn"),
    ("감자결정", "crDecsn"),
    ("전환사채권발행결정", "cvbdIsDecsn"),
    ("신주인수권부사채권발행결정", "bdwtIsDecsn"),
    ("교환사채권발행결정", "exbdIsDecsn"),
    ("자기주식취득결정", "tsstkAqDecsn"),
    ("자기주식처분결정", "tsstkDpDecsn"),
    ("자기주식취득신탁계약체결결정", "tsstkAqTrctrCcDecsn"),
    ("회사합병결정", "cmpMgDecsn"),
    ("회사분할결정", "cmpDvDecsn"),
)


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def to_num(value):
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
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    atomic_write_text(OUT_JS, "window.KR_EVENT_DETAILS = " + text + ";")


def api_for(title: str) -> str | None:
    t = str(title or "")
    for kw, api in TITLE_TO_API:
        if kw in t:
            return api
    return None


def _funding_purpose(row: dict) -> int | None:
    """자금조달 목적별 금액(fdpp_*) 합계 = 총 조달금액."""
    total = 0
    found = False
    for k in ("fdpp_fclt", "fdpp_bsninh", "fdpp_op", "fdpp_dtrp", "fdpp_ocsa", "fdpp_etc"):
        v = to_num(row.get(k))
        if v is not None:
            total += v
            found = True
    return int(total) if found else None


def summarize(api: str, row: dict) -> dict:
    """API 별로 '숫자' 만 추려낸다. 화면에 쓸 값만 담고 나머지는 버린다."""
    out: dict = {}

    if api in ("piicDecsn", "fricDecsn", "pifricDecsn"):
        new = to_num(row.get("nstk_ostk_cnt"))
        before = to_num(row.get("bfic_tisstk_ostk"))
        if new is not None:
            out["newShares"] = int(new)
        if before:
            out["sharesBefore"] = int(before)
            if new is not None:
                # 희석률 = 신주 / 기존 발행주식. 이게 이 공시의 핵심 숫자다.
                out["dilutionPct"] = round(new / before * 100, 2)
        amount = _funding_purpose(row)
        if amount:
            out["amount"] = amount
        if row.get("ic_mthn") and row["ic_mthn"] != "-":
            out["method"] = str(row["ic_mthn"]).strip()

    elif api in ("cvbdIsDecsn", "bdwtIsDecsn", "exbdIsDecsn"):
        amt = to_num(row.get("bd_fta"))
        if amt:
            out["amount"] = int(amt)
        cv = to_num(row.get("cv_prc"))
        if cv:
            out["convPrice"] = int(cv)
        dil = to_num(row.get("cvisstk_tisstk_vs"))
        if dil is not None:
            out["dilutionPct"] = round(dil, 2)
        cnt = to_num(row.get("cvisstk_cnt"))
        if cnt:
            out["newShares"] = int(cnt)
        coupon = to_num(row.get("bd_intr_ex"))
        ytm = to_num(row.get("bd_intr_sf"))
        if coupon is not None:
            out["couponPct"] = coupon
        if ytm is not None:
            out["ytmPct"] = ytm
        if row.get("bdis_mthn") and row["bdis_mthn"] != "-":
            out["method"] = str(row["bdis_mthn"]).strip()

    elif api in ("tsstkAqDecsn", "tsstkDpDecsn", "tsstkAqTrctrCcDecsn"):
        qty = to_num(row.get("aqpln_stk_ostk")) or to_num(row.get("dppln_stk_ostk"))
        amt = to_num(row.get("aqpln_prc_ostk")) or to_num(row.get("dppln_prc_ostk")) \
            or to_num(row.get("ctr_prc"))
        if qty:
            out["shares"] = int(qty)
        if amt:
            out["amount"] = int(amt)
        if row.get("aq_pp") and row["aq_pp"] != "-":
            out["purpose"] = str(row["aq_pp"]).strip()[:60]
        if row.get("aq_mth") and row["aq_mth"] != "-":
            out["method"] = str(row["aq_mth"]).strip()
        held = to_num(row.get("eaq_ostk_rt"))
        if held is not None:
            out["treasuryHeldPct"] = held

    return out


def build(api_key: str, days: int, limit: int | None):
    book = load_json(DISCLOSURES, {})
    rows = book.get("disclosures") or []
    if not rows:
        raise SystemExit("[이벤트] data/kr_disclosures.json 이 비어 있다 — 공시 빌더를 먼저 돌려야 한다.")

    # (ticker, api) 로 묶는다. 같은 회사의 같은 유형 공시가 여러 건이면 한 번만 호출한다.
    targets: dict[tuple[str, str], list[dict]] = {}
    for d in rows:
        api = api_for(d.get("title"))
        if not api:
            continue
        targets.setdefault((d["ticker"], api), []).append(d)
    if limit:
        targets = dict(list(targets.items())[:limit])
    print(f"[이벤트] 상세 대상 {len(targets)}건 (종목×유형) — 전 종목 호출 대신 이만큼만")

    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise SystemExit("[이벤트] corpCode.xml 수집 실패 — 중단한다.")

    end = datetime.now(KST).date()
    bgn = (end.replace(day=1) if days >= 28 else end).strftime("%Y%m%d")
    from datetime import timedelta
    bgn = (end - timedelta(days=days)).strftime("%Y%m%d")
    end_s = end.strftime("%Y%m%d")

    out: dict[str, dict] = {}
    errors: dict[str, int] = {}
    by_api: dict[str, int] = {}
    for (ticker, api), items in targets.items():
        corp = corp_map.get(ticker)
        if not corp:
            errors["corp_code-missing"] = errors.get("corp_code-missing", 0) + 1
            continue
        try:
            data = dart_get(f"{api}.json",
                            {"corp_code": corp, "bgn_de": bgn, "end_de": end_s},
                            api_key)
        except Exception as exc:
            k = f"{api}:request:{type(exc).__name__}"
            errors[k] = errors.get(k, 0) + 1
            continue
        status = str(data.get("status") or "")
        if status == "013":
            continue
        if status != "000":
            errors[f"{api}:{status}"] = errors.get(f"{api}:{status}", 0) + 1
            continue
        for r in data.get("list") or []:
            rcept = str(r.get("rcept_no") or "").strip()
            if not rcept:
                continue
            s = summarize(api, r)
            if not s:
                continue
            s["api"] = api
            out[rcept] = s
            by_api[api] = by_api.get(api, 0) + 1
    return out, errors, by_api


def main() -> int:
    parser = argparse.ArgumentParser(description="KR 주요사항보고서 상세 (공시에 숫자 붙이기)")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--days", type=int, default=14, help="조회 기간(공시 목록 창보다 넉넉히)")
    parser.add_argument("--limit", type=int, default=None, help="대상 N건만(테스트용)")
    args = parser.parse_args()

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        write_outputs({"updatedAtKst": now_kst(), "source": "DART Open API · 주요사항보고서",
                       "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
                       "details": {}})
        print("DART_API_KEY missing; wrote empty kr event details payload.")
        return 0

    details, errors, by_api = build(api_key, args.days, args.limit)
    if errors:
        print(f"[이벤트] 오류 {sum(errors.values())}건: {dict(list(errors.items())[:5])}")
    if not details and errors:
        print("[이벤트] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART Open API · 주요사항보고서 주요정보",
        "note": "공시 rcept_no 를 키로 하는 상세 숫자(증자 희석률·CB 전환가·자사주 금액 등).",
        "count": len(details),
        "details": details,
    }
    write_outputs(payload)
    print(f"[이벤트] {len(details)}건 기록.")
    for k, v in sorted(by_api.items(), key=lambda x: -x[1]):
        print(f"    {k:22s} {v}")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/kr_event_details.json", "data/kr_event_details.js"],
                "KR event details",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
