#!/usr/bin/env python3
"""국내 배당 · 공급계약 — DART 공시 원문(document.xml) 파싱.

배당결정·공급계약은 '수시/공정공시'라 DART 구조화 API(DS005)에 없다. 대신 표준
공정공시 템플릿이라 원문(document.xml, ZIP→단일 XML)을 받아 태그를 벗기고 라벨로
값을 뽑는다. 양식은 KRX 표준이라 일관적이지만, 라벨이 바뀌면 깨질 수 있어 방어적으로
파싱하고 못 찾은 값은 None 으로 둔다(지어내지 않는다).

  배당(현금ㆍ현물배당결정): 1주당 배당금 · 시가배당률 · 배당금총액 · 배당기준일 · 지급예정일
  공급계약(단일판매ㆍ공급계약체결): 계약금액 총액 · 최근 매출액 · 매출액 대비(%) · 계약상대 · 기간

대상은 kr_disclosures.json 의 해당 공시만(전 종목 호출 아님). rcept_no 로 원문을 받는다.

산출물:
  data/korea/dividends.{json,js}  (window.KR_DIVIDENDS)
  data/korea/contracts.{json,js}  (window.KR_CONTRACTS)

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ROOT / ".env")
except Exception:
    pass

from briefing_store import repository_publish_lock  # noqa: E402
from build_kr_disclosures import dart_pace  # noqa: E402
from sec_client import (  # noqa: E402
    assert_not_regressing,
    merge_previous_rows,
    write_data,
)

KST = ZoneInfo("Asia/Seoul")
DISCLOSURES = ROOT / "data" / "kr_disclosures.json"
OUT = {
    "dividends": (ROOT / "data" / "korea" / "dividends.json",
                  ROOT / "data" / "korea" / "dividends.js", "KR_DIVIDENDS"),
    "contracts": (ROOT / "data" / "korea" / "contracts.json",
                  ROOT / "data" / "korea" / "contracts.js", "KR_CONTRACTS"),
}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def rcpt_of(row) -> str | None:
    m = re.search(r"rcpNo=(\d+)", row.get("link") or "")
    return m.group(1) if m else None


def fetch_doc(rcept: str, api_key: str) -> str | None:
    url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={api_key}&rcept_no={rcept}"
    for attempt in range(3):
        try:
            # 공유 페이싱(기본 0.15s). DART 일일 한도(20,000)를 이 빌더 혼자 태우지 않게.
            dart_pace()
            raw = urllib.request.urlopen(url, timeout=20).read()
            z = zipfile.ZipFile(io.BytesIO(raw))
            data = z.read(z.namelist()[0])
            for enc in ("utf-8", "euc-kr", "cp949"):
                try:
                    return data.decode(enc)
                except UnicodeDecodeError:
                    continue
            return data.decode("utf-8", "replace")
        except zipfile.BadZipFile:
            return None  # status XML (문서 없음 등) — 파싱 불가
        except Exception:
            time.sleep(0.6 * (attempt + 1))
    return None


def clean(doc: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", doc))


def _num(s):
    if s is None:
        return None
    s = str(s).replace(",", "").strip()
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


# 라벨과 값 사이에 올 수 있는 구분자. '-'(미기재 표시)는 **일부러 뺐다** —
# 그걸 건너뛰면 빈 필드가 다음 필드의 값을 집어온다.
_SEP = r"[\s:|·]*"


def _label_positions(txt: str, label: str):
    """label 이 나오는 모든 위치(첫 것만 보면 헤더 행에 걸린다)."""
    start = 0
    while True:
        i = txt.find(label, start)
        if i < 0:
            return
        yield i
        start = i + len(label)


def after(txt: str, label: str, pat: str, window: int = 40):
    """label **바로 뒤**(구분자만 사이)에 붙은 pat 의 첫 그룹만 값으로 인정한다.

    예전엔 라벨 뒤 90자를 `re.search` 로 훑어서, 값이 '-'(미기재)면 다음 필드의
    값을 집어왔다: 배당기준일이 '-' 면 지급예정일을, 계약 '종료일' 자리에서
    시작일을 값으로 썼다(2026-09-15 감사). after_num 과 같은 앵커링 규칙을 쓴다.
    라벨이 여러 번 나오면(헤더 행 등) 앵커가 맞는 첫 위치를 쓴다.
    """
    anchored = re.compile(_SEP + r"(?:" + pat + r")")
    for i in _label_positions(txt, label):
        tail = txt[i + len(label): i + len(label) + window]
        m = anchored.match(tail)
        if m:
            return m.group(1)
    return None


def after_num(txt: str, label: str, window: int = 25):
    """label 바로 뒤(공백만 사이)에 붙은 숫자만 값으로 인정한다. 필드가 '-'(미기재)면
    바로 뒤가 숫자가 아니라 None — 이렇게 앵커링해야 빈 필드가 먼 곳의 다른 숫자(예:
    계약금액)를 잘못 집어오지 않는다."""
    for i in _label_positions(txt, label):
        tail = txt[i + len(label): i + len(label) + window]
        m = re.match(r"\s*([\d.,]+)\b", tail)
        if m:
            value = _num(m.group(1))
            if value is not None:
                return value
    return None


DATE = r"(\d{4}-\d{2}-\d{2})"


def parse_dividend(txt: str) -> dict:
    return {
        "divKind": after(txt, "1. 배당구분", r"([가-힣]+배당)", 20),
        "cashStock": after(txt, "2. 배당종류", r"(현금배당|현물배당)", 20),
        "dps": after_num(txt, "1주당 배당금(원) 보통주식"),
        "yieldPct": after_num(txt, "시가배당률(%) 보통주식"),
        "total": after_num(txt, "배당금총액(원)"),
        "recordDate": after(txt, "배당기준일", DATE),
        "payDate": after(txt, "배당금지급 예정일자", DATE),
        "decidedDate": after(txt, "이사회결의일", DATE),
    }


def parse_contract(txt: str) -> dict:
    amount = after_num(txt, "계약금액 총액(원)")
    sales = after_num(txt, "최근 매출액(원)")
    ratio = after_num(txt, "매출액 대비(%)")
    # 매출대비가 비상식적(>1000%)이면 빈 필드 뒤 다른 숫자를 잘못 집은 것 — 버린다.
    if ratio is not None and ratio > 1000:
        ratio = None
    if ratio is None and amount and sales:
        ratio = round(amount / sales * 100, 2)
    party = after(txt, "계약상대방", r"\s*([^\-]{1,30}?)\s*-", 40)
    return {
        "amount": amount,
        "recentSales": sales,
        "salesRatio": ratio,
        "counterparty": (party or "").strip() or None,
        "region": after(txt, "공급지역", r"\s*([^\-\d]{1,20}?)\s*[\-\d]", 30),
        "startDate": after(txt, "계약기간 시작일", DATE),
        "endDate": after(txt, "종료일", DATE),
    }


def build(api_key: str, limit: int | None):
    rows = json.loads(DISCLOSURES.read_text(encoding="utf-8")).get("disclosures") or []
    div_src = [r for r in rows if "현금ㆍ현물배당결정" in (r.get("title") or "") and rcpt_of(r)]
    con_src = [r for r in rows if "단일판매ㆍ공급계약체결" in (r.get("title") or "") and rcpt_of(r)]
    if limit:
        div_src, con_src = div_src[:limit], con_src[:limit]
    print(f"[공시파싱] 배당 {len(div_src)}건 · 공급계약 {len(con_src)}건")

    # 파싱 손실을 셈한다. 예전엔 공급계약 108건 중 50건만 살아남아도(54% 소실)
    # 로그에 아무 흔적이 없었다 — 소스 108, 원문 실패 N, 규모 미기재 M 을 payload 에 싣는다.
    stats = {
        "dividends": {"source": len(div_src), "fetchFailed": 0, "noValue": 0},
        "contracts": {"source": len(con_src), "fetchFailed": 0, "noAmount": 0},
    }

    dividends, contracts = [], []
    for r in div_src:
        doc = fetch_doc(rcpt_of(r), api_key)
        if not doc:
            stats["dividends"]["fetchFailed"] += 1
            continue
        d = parse_dividend(clean(doc))
        # 기준일도 지급일도 없으면 파싱 실패로 보고 버린다(지어내지 않는다).
        if not (d.get("recordDate") or d.get("dps")):
            stats["dividends"]["noValue"] += 1
            continue
        d.update({"ticker": str(r.get("ticker") or "").zfill(6),
                  "company": r.get("company") or "", "date": r.get("fileDate") or "",
                  "link": r.get("link") or ""})
        dividends.append(d)
    for r in con_src:
        doc = fetch_doc(rcpt_of(r), api_key)
        if not doc:
            stats["contracts"]["fetchFailed"] += 1
            continue
        c = parse_contract(clean(doc))
        if c.get("amount") is None and c.get("salesRatio") is None:
            stats["contracts"]["noAmount"] += 1
            continue  # 조건부·미공개라 규모 정보가 전혀 없으면 버린다
        c.update({"ticker": str(r.get("ticker") or "").zfill(6),
                  "company": r.get("company") or "", "date": r.get("fileDate") or "",
                  "link": r.get("link") or ""})
        contracts.append(c)

    for kind, got in (("dividends", len(dividends)), ("contracts", len(contracts))):
        s = stats[kind]
        print(f"[공시파싱/{kind}] 소스 {s['source']} → 적재 {got} "
              f"(원문 실패 {s['fetchFailed']} · 값 없음 {s.get('noValue', s.get('noAmount'))})")

    dividends.sort(key=lambda x: x.get("recordDate") or x.get("date") or "", reverse=True)
    contracts.sort(key=lambda x: (x.get("salesRatio") or 0), reverse=True)
    return dividends, contracts, stats


def write(kind: str, rows: list, note: str, stats: dict | None = None):
    """write_data 경유 — 0건 방어(assert_not_emptying)와 .js 계약을 공유한다.

    직전 파일의 최근 180일 행을 합쳐 발행한다: DART 공시 조회 창이 7일이라
    매 실행 통째로 갈아엎으면 라이브 표가 한 주치로 쪼그라든다.
    """
    out_json, out_js, glob = OUT[kind]
    payload = {"updatedAtKst": now_kst(), "source": "DART 공시 원문(document.xml) 파싱",
               "note": note, "rows": rows}
    if stats:
        payload["parseStats"] = stats
    merge_previous_rows(payload, out_json, f"공시파싱/{kind}", keep_days=180)
    payload["count"] = len(payload["rows"])
    # 직전 대비 30% 넘게 줄면 소스 사고로 보고 덮지 않는다(prev-merge 뒤라 더 엄격해도 된다).
    assert_not_regressing(out_json, payload, label=f"{kind}.json")
    out_json.parent.mkdir(parents=True, exist_ok=True)
    write_data(out_json, out_js, glob, payload, indent=None)


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 배당·공급계약 공시 원문 파싱")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        # 키가 없다고 기존 산출물을 0건으로 덮어쓰면 사이트의 배당·수주 탭이
        # 통째로 빈다(2026-07-22 실제 사고 — 워크플로우 env 누락). 파일이 아예
        # 없을 때만 빈 스켈레톤을 만들고, 있으면 그대로 두고 비-0 종료한다.
        for kind in ("dividends", "contracts"):
            out_json = OUT[kind][0]
            if not out_json.exists():
                write(kind, [], "DART_API_KEY 미설정")
        print("DART_API_KEY missing; kept existing payloads.")
        return 1
    if not DISCLOSURES.exists():
        print("[공시파싱] kr_disclosures.json 없음 — 공시 빌더 먼저.")
        return 0

    dividends, contracts, stats = build(api_key, args.limit)
    print(f"[공시파싱] 파싱 성공 — 배당 {len(dividends)} · 공급계약 {len(contracts)}")
    with repository_publish_lock(ROOT):
        write("dividends", dividends,
              "현금ㆍ현물배당결정 공시 원문에서 1주당 배당금·시가배당률·배당기준일·지급예정일을 파싱. "
              "최근 180일 병합 유지.",
              stats["dividends"])
        write("contracts", contracts,
              "단일판매ㆍ공급계약 공시 원문에서 계약금액·최근 매출액 대비 비중을 파싱. 조건부·미공개는 제외. "
              "최근 180일 병합 유지.",
              stats["contracts"])
        print("Wrote dividends/contracts.")
        if args.push:
            import sec_client as sec
            if not sec.git_publish(
                ["data/korea/dividends.json", "data/korea/dividends.js",
                 "data/korea/contracts.json", "data/korea/contracts.js"],
                "KR dividends + contracts (parsed)",
            ):
                print("[공시파싱] git 게시 실패 — 발행되지 않았다")
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
