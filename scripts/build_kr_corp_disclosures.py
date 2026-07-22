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

from briefing_store import atomic_write_text, repository_publish_lock  # noqa: E402

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


def after(txt: str, label: str, pat: str, window: int = 90):
    """label 을 찾고 그 뒤 window 자 안에서 pat 의 첫 그룹을 돌려준다(날짜·텍스트용)."""
    i = txt.find(label)
    if i < 0:
        return None
    m = re.search(pat, txt[i + len(label): i + len(label) + window])
    return m.group(1) if m else None


def after_num(txt: str, label: str, window: int = 25):
    """label 바로 뒤(공백만 사이)에 붙은 숫자만 값으로 인정한다. 필드가 '-'(미기재)면
    바로 뒤가 숫자가 아니라 None — 이렇게 앵커링해야 빈 필드가 먼 곳의 다른 숫자(예:
    계약금액)를 잘못 집어오지 않는다."""
    i = txt.find(label)
    if i < 0:
        return None
    tail = txt[i + len(label): i + len(label) + window]
    m = re.match(r"\s*([\d.,]+)\b", tail)
    return _num(m.group(1)) if m else None


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

    dividends, contracts = [], []
    for r in div_src:
        doc = fetch_doc(rcpt_of(r), api_key)
        if not doc:
            continue
        d = parse_dividend(clean(doc))
        # 기준일도 지급일도 없으면 파싱 실패로 보고 버린다(지어내지 않는다).
        if not (d.get("recordDate") or d.get("dps")):
            continue
        d.update({"ticker": str(r.get("ticker") or "").zfill(6),
                  "company": r.get("company") or "", "date": r.get("fileDate") or "",
                  "link": r.get("link") or ""})
        dividends.append(d)
    for r in con_src:
        doc = fetch_doc(rcpt_of(r), api_key)
        if not doc:
            continue
        c = parse_contract(clean(doc))
        if c.get("amount") is None and c.get("salesRatio") is None:
            continue  # 조건부·미공개라 규모 정보가 전혀 없으면 버린다
        c.update({"ticker": str(r.get("ticker") or "").zfill(6),
                  "company": r.get("company") or "", "date": r.get("fileDate") or "",
                  "link": r.get("link") or ""})
        contracts.append(c)

    dividends.sort(key=lambda x: x.get("recordDate") or x.get("date") or "", reverse=True)
    contracts.sort(key=lambda x: (x.get("salesRatio") or 0), reverse=True)
    return dividends, contracts


def write(kind: str, rows: list, note: str):
    out_json, out_js, glob = OUT[kind]
    payload = {"updatedAtKst": now_kst(), "source": "DART 공시 원문(document.xml) 파싱",
               "note": note, "count": len(rows), "rows": rows}
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    out_json.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(out_json, text)
    atomic_write_text(out_js, f"window.{glob} = " + text + ";")


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
        for kind, note in (("dividends", "DART_API_KEY 미설정"), ("contracts", "DART_API_KEY 미설정")):
            write(kind, [], note)
        print("DART_API_KEY missing; wrote empty payloads.")
        return 0
    if not DISCLOSURES.exists():
        print("[공시파싱] kr_disclosures.json 없음 — 공시 빌더 먼저.")
        return 0

    dividends, contracts = build(api_key, args.limit)
    print(f"[공시파싱] 파싱 성공 — 배당 {len(dividends)} · 공급계약 {len(contracts)}")
    with repository_publish_lock(ROOT):
        write("dividends", dividends,
              "현금ㆍ현물배당결정 공시 원문에서 1주당 배당금·시가배당률·배당기준일·지급예정일을 파싱.")
        write("contracts", contracts,
              "단일판매ㆍ공급계약 공시 원문에서 계약금액·최근 매출액 대비 비중을 파싱. 조건부·미공개는 제외.")
        print("Wrote dividends/contracts.")
        if args.push:
            import sec_client as sec
            sec.git_publish(
                ["data/korea/dividends.json", "data/korea/dividends.js",
                 "data/korea/contracts.json", "data/korea/contracts.js"],
                "KR dividends + contracts (parsed)",
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
