#!/usr/bin/env python3
"""한국 분기 실적 추이 — DART 주요계정(fnlttMultiAcnt) 기반.

KR 종목 상세에는 earningsHistory 가 통째로 비어 있었다(미국은 야후에서 채운다).
DART 는 애널리스트 추정치를 주지 않으므로 미국처럼 'EPS 서프라이즈' 는 만들 수 없지만,
매출·영업이익·순이익의 분기 추이와 '발표일' 은 줄 수 있다. 발표일만 있어도 app.js 의
earningsReactionRows 가 실적 전후 주가 반응을 계산한다.

효율: fnlttMultiAcnt 는 corp_code 를 콤마로 최대 100개까지 받는다(200개면 status 021).
2,600종목 × 8분기를 종목별로 돌면 20,800회지만, 100개씩 묶으면 26 × 8 = 208회로 끝난다.

검증해서 알아낸 함정 두 가지:
  1) fs_div 를 지정하지 않으면 연결(CFS)과 별도(OFS) 가 같이 와서 '매출액' 이 두 번
     나온다(삼성전자 133.9조 vs 109.3조). 반드시 갈라서 CFS 우선으로 골라야 한다.
  2) 분기보고서의 thstrm_dt 라벨은 '2025.01.01 ~ 2025.06.30' 처럼 누적 기간으로 찍히지만
     thstrm_amount 는 '그 분기만' 의 값이다(삼성전자 반기 74.6조 — 누적이면 150조대여야
     한다). 대형주 5곳에서 Q1+Q2+Q3 가 연간의 0.66~0.75 이고 Q4 잔차가 양수임을 확인했다.
     그래도 회사에 따라 누적으로 낼 수 있어 아래 is_cumulative 가드를 둔다.

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
OUT_JSON = ROOT / "data" / "korea" / "earnings.json"
OUT_JS = ROOT / "data" / "korea" / "earnings.js"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"

BATCH = 100                      # fnlttMultiAcnt 상한(200 이면 status 021)
REPORTS = {                      # reprt_code → (분기라벨, 분기번호)
    "11013": ("1분기", 1),
    "11012": ("2분기", 2),        # '반기보고서' 지만 값은 2분기치
    "11014": ("3분기", 3),
    "11011": ("연간", 4),         # 사업보고서 — 값은 연간 누계라 별도 취급
}
REVENUE_NAMES = ("매출액", "수익(매출액)", "영업수익")
OPERATING_NAMES = ("영업이익", "영업이익(손실)")
NET_NAMES = ("당기순이익(손실)", "당기순이익")


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def to_num(value):
    s = str(value or "").strip().replace(",", "")
    if not s or s == "-":
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return int(float(s))
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
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    atomic_write_text(OUT_JS, "window.KR_EARNINGS = " + text + ";")


def pick(rows: list[dict], names) -> int | None:
    """계정명이 회사마다 조금씩 다르다. 앞에 오는 이름부터 먼저 찾는다."""
    for name in names:
        for r in rows:
            if r.get("account_nm") == name:
                v = to_num(r.get("thstrm_amount"))
                if v is not None:
                    return v
    return None


def announce_date(rcept_no: str) -> str:
    """접수번호 앞 8자리가 접수일(YYYYMMDD). 이 API 는 rcept_dt 를 안 준다."""
    s = str(rcept_no or "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) >= 8 and s[:8].isdigit() else ""


def fetch_batch(corp_codes: list[str], year: str, reprt: str, api_key: str, errors: dict) -> list[dict]:
    try:
        data = dart_get(
            "fnlttMultiAcnt.json",
            {"corp_code": ",".join(corp_codes), "bsns_year": year, "reprt_code": reprt},
            api_key,
        )
    except Exception as exc:
        key = f"request:{type(exc).__name__}"
        errors[key] = errors.get(key, 0) + 1
        return []
    status = str(data.get("status") or "")
    if status == "013":
        return []                       # 해당 분기 데이터 없음
    if status != "000":
        key = f'{status}:{data.get("message") or ""}'.strip(":")
        errors[key] = errors.get(key, 0) + 1
        return []
    return data.get("list") or []


def build(api_key: str, years: list[str], limit: int | None):
    snapshot = load_json(KR_SNAPSHOT, {"stocks": []})
    stocks = [
        s for s in snapshot.get("stocks") or []
        if s.get("sector") not in ("ETF", "etf", "EXCHANGE TRADED FUNDS")
    ]

    def cap(s):
        v = s.get("marketCapB")
        return v if isinstance(v, (int, float)) else 0

    stocks.sort(key=cap, reverse=True)          # 시총 큰 곳부터 — 중간에 끊겨도 중요한 게 남는다
    corp_map = load_corp_map(api_key)
    if not corp_map:
        raise SystemExit("[실적] corpCode.xml 수집 실패 — 중단한다.")

    pairs = []                                   # (ticker, corp_code)
    for s in stocks:
        t = str(s.get("ticker") or "").replace(".KS", "").replace(".KQ", "").zfill(6)
        corp = corp_map.get(t)
        if corp:
            pairs.append((t, corp))
    if limit:
        pairs = pairs[:limit]
    by_corp = {c: t for t, c in pairs}
    print(f"[실적] 대상 {len(pairs)}종목 · {len(years)}개년 × {len(REPORTS)}보고서 "
          f"= 약 {-(-len(pairs) // BATCH) * len(years) * len(REPORTS)}회 호출")

    errors: dict[str, int] = {}
    # ticker -> {(year, reprt): row}
    acc: dict[str, dict] = {}

    for year in years:
        for reprt, (qlabel, qnum) in REPORTS.items():
            for i in range(0, len(pairs), BATCH):
                chunk = [c for _, c in pairs[i:i + BATCH]]
                rows = fetch_batch(chunk, year, reprt, api_key, errors)
                # 종목·재무제표구분별로 손익계산서만 모은다.
                grouped: dict[tuple[str, str], list[dict]] = {}
                for r in rows:
                    if r.get("sj_div") != "IS":
                        continue
                    corp = r.get("corp_code")
                    grouped.setdefault((corp, r.get("fs_div") or ""), []).append(r)
                for (corp, fs_div), items in grouped.items():
                    ticker = by_corp.get(corp)
                    if not ticker:
                        continue
                    revenue = pick(items, REVENUE_NAMES)
                    if revenue is None:
                        continue
                    entry = {
                        "quarter": f"{year}Q{qnum}" if qnum != 4 else f"{year}FY",
                        "label": f"{year} {qlabel}",
                        "date": announce_date(items[0].get("rcept_no")),
                        "period": str(items[0].get("thstrm_dt") or "").strip(),
                        "revenue": revenue,
                        "operatingProfit": pick(items, OPERATING_NAMES),
                        "netIncome": pick(items, NET_NAMES),
                        "fsDiv": fs_div,
                        "annual": qnum == 4,
                    }
                    slot = acc.setdefault(ticker, {})
                    prev = slot.get((year, reprt))
                    # 연결(CFS) 우선. 별도(OFS)는 연결이 없는 회사만.
                    if prev is None or (prev.get("fsDiv") != "CFS" and fs_div == "CFS"):
                        slot[(year, reprt)] = entry

    out: dict[str, list[dict]] = {}
    cumulative_suspect = 0
    for ticker, slot in acc.items():
        rows = [v for _, v in sorted(slot.items())]
        # 누적값 가드: 분기 3개 합이 연간의 95% 를 넘으면 '분기값' 가정이 깨진 것이다.
        for year in years:
            qs = [slot.get((year, rc)) for rc in ("11013", "11012", "11014")]
            fy = slot.get((year, "11011"))
            if fy and all(q and q.get("revenue") for q in qs) and fy.get("revenue"):
                s = sum(q["revenue"] for q in qs)
                if s > fy["revenue"] * 0.95:
                    cumulative_suspect += 1
                    for q in qs:
                        q["cumulativeSuspect"] = True
        rows = [r for r in rows if r.get("date")]
        rows.sort(key=lambda r: r["date"])
        if rows:
            out[ticker] = rows

    if cumulative_suspect:
        print(f"[실적] 누적값 의심 {cumulative_suspect}종목-연도 — cumulativeSuspect 로 표시했다.")
    return out, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="KR 분기 실적 추이 수집 (DART 주요계정)")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--years", default="", help="쉼표 구분. 기본은 최근 2개년.")
    parser.add_argument("--limit", type=int, default=None, help="시총 상위 N종목만(테스트용)")
    args = parser.parse_args()

    this_year = datetime.now(KST).year
    years = [y.strip() for y in args.years.split(",") if y.strip()] or [str(this_year - 1), str(this_year)]

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        write_outputs({
            "updatedAtKst": now_kst(),
            "source": "DART Open API",
            "note": "DART_API_KEY 미설정 — GitHub Secrets에 등록 후 workflow를 실행하세요.",
            "years": years,
            "earnings": {},
        })
        print("DART_API_KEY missing; wrote empty kr earnings payload.")
        return 0

    earnings, errors = build(api_key, years, args.limit)
    if errors:
        print(f"[실적] 오류 응답 {sum(errors.values())}건: {errors}")
    if not earnings and errors:
        print("[실적] 수집 0건 + 오류 발생 — 기존 파일을 덮어쓰지 않고 실패 처리한다.")
        return 1

    payload = {
        "updatedAtKst": now_kst(),
        "source": "DART Open API · 주요계정",
        "note": "분기 매출·영업이익·순이익. 연결(CFS) 우선, 없으면 별도(OFS). "
                "애널리스트 추정치가 없어 서프라이즈는 제공하지 않는다.",
        "years": years,
        "companyCount": len(earnings),
        "earnings": earnings,
    }
    write_outputs(payload)
    print(f"[실적] {len(earnings)}종목 기록.")

    if args.push:
        import sec_client as sec

        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/earnings.json", "data/korea/earnings.js"],
                "KR quarterly earnings",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
