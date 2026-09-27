#!/usr/bin/env python3
"""국내 신규 상장주 의무보유(보호예수) 해제 일정 + 공모주 수요예측·청약 결과.

신규 상장 뒤 1·3·6개월·1년·2~3년에 최대주주·벤처금융·우리사주·상장주선인 물량의 매각 제한이
풀린다. 이 물량과 날짜는 증권신고서·투자설명서의 '공모 후 유통가능 물량(보호예수)' 표에 있고,
38커뮤니케이션(38.co.kr) 공모주 상세 페이지가 그 표를 그대로 옮겨 싣는다. 이 빌더는

1) `fund/index.htm?o=r1`(수요예측 결과 목록, 페이지당 약 20건)에서 기업명·예측일·확정공모가·
   기관 경쟁률·의무보유 확약 비율·상세 번호(no)를 읽고,
2) 상세 페이지(`fund/?o=v&no=`)에서 종목코드·시장·신규상장일·청약 경쟁률·확약 기간별 신청 수량과
   보호예수 표를 읽어,
3) 블록마다 해제일 = 상장일 + 매각제한 기간(달력 기준 추정)을 계산한다.

38.co.kr 은 기존 IPO 캘린더(build_kr_ipo_calendar.py)가 이미 쓰는 소스이고 robots.txt 가 전부
허용이다. 상세 페이지는 상장 뒤에는 바뀌지 않으므로 번호(no)별로 산출물에 캐시해 다시 받지 않는다
(상장 전·직후 3일까지만 다시 받는다 — 청약 경쟁률·상장일이 그때 채워진다). 요청 사이 1초.

정직성·한계(화면에도 적는다):
- 해제일은 '상장일 + 기간'으로 계산한 **추정일**이다. 우리사주는 예탁일 기준이라 하루 이틀 다를 수
  있고, 실제 반환일이 주말·휴일이면 다음 영업일에 풀린다.
- 주식수·비율은 **상장일 기준**(표의 공모 후 합계 대비)이다. 이후 무상증자·액면분할이 있으면 다르다.
- 기관 수요예측 **확약 배정 물량**(15일·1·3·6개월)은 증권발행실적보고서에만 있어 여기에 없다 —
  수요예측 '신청' 수량 기준 확약 비율만 참고로 싣는다.
- 38 상세 페이지에 보호예수 표가 생긴 건 2025년부터라 그 전에 상장한 종목의 2~3년 해제는 빠진다.
- 스팩(SPAC)은 합병 전까지 매각이 묶여 기간 표기가 달라 제외한다.

실행: py scripts/build_kr_lockups.py [--pages 16] [--max-fetch 120] [--push]
출력: data/korea/lockups.json + .js (window.KR_LOCKUPS)
"""
from __future__ import annotations

import argparse
import calendar
import json
import re
import ssl
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
OUT_JSON = ROOT / "data" / "korea" / "lockups.json"
OUT_JS = ROOT / "data" / "korea" / "lockups.js"
KST = timezone(timedelta(hours=9))

LIST_URL = "https://www.38.co.kr/html/fund/index.htm?o=r1&page={page}"
DETAIL_URL = "https://www.38.co.kr/html/fund/?o=v&no={no}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}
# 38.co.kr 은 1024비트 DHE 만 제공해 OpenSSL 3 기본(SECLEVEL=2)이 거부한다 — build_kr_ipo_calendar.py 와 같은
# 이유로 이 호스트 전용 컨텍스트만 보안 레벨 1(인증서·호스트명 검증은 그대로).
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.set_ciphers("DEFAULT:@SECLEVEL=1")

LOOKBACK_DAYS = 3 * 366 + 45   # 수요예측일 기준 이만큼 과거까지(3년 보호예수 + 여유)
KEEP_PAST_RELEASE_DAYS = 30    # 지난 해제도 한 달은 남긴다(캘린더 '지난주' 보기·종목 카드)
REFRESH_AFTER_LISTING_DAYS = 3  # 상장 뒤 며칠까지 상세를 다시 받는다
SLEEP_S = 1.0
# 블록 합이 표의 '합계 매각제한물량' 과 이 비율 안에서 같아야 해제 일정에 싣는다(원문 오타 몇 백 주 허용).
SUM_TOLERANCE = 0.005
NOTE = ("해제일은 상장일 + 매각제한 기간으로 계산한 추정일입니다(우리사주는 예탁일 기준, 휴일이면 다음 영업일). "
        "주식수·비율은 상장일 기준 공모 후 주식수 대비입니다. 기관 수요예측 확약 배정 물량은 포함되지 않습니다.")

# 보호예수 표의 '유형' — 화면 칩·집계 키. 순서는 표시 순서.
TYPES = ("최대주주 등", "벤처금융", "기관·전문투자자", "임직원", "우리사주", "상장주선인", "기타 주주")


def now_kst() -> datetime:
    return datetime.now(KST)


# ---------------------------------------------------------------------------
# 파싱 도우미
# ---------------------------------------------------------------------------
def _txt(cell) -> str:
    return re.sub(r"\s+", " ", cell.get_text(" ", strip=True)).strip()


def parse_int(text) -> int | None:
    t = str(text or "").strip()
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", t):
        t = t.replace(".", "")  # '1.533.250' — 쉼표 대신 마침표로 쓴 원문 오타
    t = t.replace(",", "")
    return int(t) if re.fullmatch(r"\d+", t) else None


def parse_pct(text) -> float | None:
    m = re.fullmatch(r"(-?\d+(?:\.\d+)?)\s*%", str(text or "").strip())
    return float(m.group(1)) if m else None


def parse_ratio(text) -> float | None:
    """'1109.37:1' · '1,375.34 :1 (비례 2751:1)' → 1109.37. 없거나 '-' 면 None."""
    m = re.search(r"([\d,]+(?:\.\d+)?)\s*:\s*1", str(text or ""))
    if not m:
        return None
    try:
        v = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    return v if v > 0 else None


def parse_date(text) -> str | None:
    m = re.search(r"(20\d{2})[./-](\d{1,2})[./-](\d{1,2})", str(text or ""))
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def is_value_cell(text: str) -> bool:
    """보호예수 표의 숫자 칸(주식수·지분율·'-')."""
    t = text.strip()
    # '0.00_' 처럼 % 자리에 오타가 난 지분율 칸도 숫자 칸으로 센다(주식수 칸만 parse_int 로 읽는다).
    return t in ("-", "") or parse_int(t) is not None or parse_pct(t) is not None or bool(re.fullmatch(r"[\d.,]+\s*[%_]", t))


def parse_period(text: str) -> dict | None:
    """매각제한 기간 문자열 → {months, days, basis, label}. 모르면 None.

    '~3년' · '상장 후 6개월' · '상장후 1개월' · '예탁일로부터 1년' · '1년 6개월' · '~15일'.
    """
    t = re.sub(r"\s+", "", str(text or ""))
    if not t or t in ("-", "~"):
        return None
    if re.search(r"합병|해산|청산|미정", t):
        return None
    y = re.search(r"(\d+(?:\.\d+)?)년", t)
    mo = re.search(r"(\d+)개월", t)
    d = re.search(r"(\d+)일(?!로)", t)
    months = (round(float(y.group(1)) * 12) if y else 0) + (int(mo.group(1)) if mo else 0)
    days = int(d.group(1)) if (d and not y and not mo) else 0
    if months <= 0 and days <= 0:
        return None
    if months > 60 or days > 400:
        return None
    basis = "deposit" if "예탁" in t else "listing"
    return {"months": months, "days": days, "basis": basis, "label": period_label(months, days)}


def period_label(months: int, days: int) -> str:
    if not months:
        return f"{days}일"
    y, m = divmod(months, 12)
    return " ".join(x for x in ((f"{y}년" if y else ""), (f"{m}개월" if m else "")) if x)


def add_period(iso: str, months: int, days: int) -> str:
    """상장일 + 기간(달력 기준). 1월 31일 + 1개월 → 2월 말일."""
    base = date.fromisoformat(iso)
    if months:
        idx = base.year * 12 + (base.month - 1) + months
        y, m = divmod(idx, 12)
        m += 1
        base = date(y, m, min(base.day, calendar.monthrange(y, m)[1]))
    return (base + timedelta(days=days)).isoformat()


_GROUP_RE = re.compile(r"^(최대주주|5%\s*이상|1%\s*이상|1%\s*미만|소액|공모주|기타주주|주요주주|특별이해관계자|벤처금융|의무인수)")
_SPECIAL_HOLDERS = ("우리사주조합", "상장주선인")
_SHARE_KIND_RE = re.compile(r"^(보통주|우선주|종류주식?|상환전환우선주|전환우선주|증권예탁증권)$")
_RELATION_RE = re.compile(
    r"본인|최대주|특수관계|특별이해|등기임원|미등기임원|임원|직원|벤처금융|VC|신기술|창업투자|일반법인|전문|기관|타인|"
    r"계열|관계회사|자회사|법인|개인|투자조합|사모|펀드|자산운용|증권|은행|보험|공모주주|상장주선인|우리사주")


def classify(group: str, holder: str, relation: str) -> str:
    g, h, r = group or "", holder or "", relation or ""
    if "우리사주" in h or "우리사주" in g or "우리사주" in r:
        return "우리사주"
    if re.search(r"상장주선인|의무인수", h + " " + g + " " + r):
        return "상장주선인"
    if g.startswith("최대주주") or re.search(r"최대주|본인|특수관계", r):
        return "최대주주 등"
    if re.search(r"벤처금융|VC|신기술|창업투자|창투", r) or re.search(r"투자조합|벤처|펀드|신기술|PEF|사모", h, re.I):
        return "벤처금융"
    if re.search(r"임원|직원", r):
        return "임직원"
    if re.search(r"전문|기관|자산운용|증권|은행|보험", r):
        return "기관·전문투자자"
    return "기타 주주"


def find_lockup_table(soup):
    """'매각제한' 과 '유통가능' 이 함께 있는 가장 작은 표(바깥 레이아웃 표 제외)."""
    cands = []
    for t in soup.find_all("table"):
        text = t.get_text(" ", strip=True)
        if "매각제한" in text and ("유통가능" in text or "매각제한기간" in text.replace(" ", "")) and "주주" in text and "합계" in text:
            cands.append((len(text), t))
    return min(cands, key=lambda x: x[0])[1] if cands else None


def _float_first(header_text: str) -> bool:
    """머리글에서 '유통가능물량' 이 '매각제한물량' 보다 먼저 나오면 두 칸이 뒤바뀐 양식이다."""
    h = re.sub(r"\s+", "", header_text)
    i_lock = h.find("매각제한물량")
    i_float = h.find("유통가능물량")
    return i_lock >= 0 and 0 <= i_float < i_lock


def parse_lockup_table(table) -> dict:
    """보호예수 표 → {blocks:[{type, shares, pctListing, period}], totalShares, tableLockTotal, skipped, …}.

    38 페이지는 증권사마다 양식이 조금씩 다르고 rowspan 이 들쭉날쭉하다(이름이 줄바꿈되면 셀 하나짜리
    행이 끼어든다). 한 주주의 물량이 기간별로 나뉘면 다음 행에 '매각제한 수량·지분율(·기간)' 만 온다.
    그래서 칸 위치가 아니라 **행 끝의 기간 칸과 그 앞의 연속된 숫자 칸 개수**로 읽는다:
      숫자 8개 = 공모 전(주식수·지분율)·공모 후·매각제한·유통가능 → 매각제한 = 5·6번째
      숫자 4개 = 매각제한·유통가능 → 앞의 두 칸
      숫자 2개 = 매각제한만(유통가능은 위 행 rowspan) → 두 칸
    - 기간 칸이 rowspan 이면 아래 행은 기간 칸이 없다 — 그 기간을 이어받는다.
    - 머리글에서 유통가능이 매각제한보다 먼저 나오면(일부 주관사 양식) 두 칸을 바꿔 읽는다.
    - '소계' 행과 그 이어짐 행은 뺀다(소계에 기간이 적힌 양식이 있다). 합계 행의 공모 후 주식수가 분모.
    """
    blocks: list[dict] = []
    skipped = 0
    group = ""
    last_holder, last_relation = "", ""
    in_subtotal = False
    carry: list = [None, 0]  # [기간 텍스트, 남은 행 수]
    total_post = None
    table_lock_total = None
    header_text = ""
    in_header = True
    swapped = False
    started = False
    for tr in table.find_all("tr"):
        els = tr.find_all(["td", "th"], recursive=False)  # 안쪽 표의 칸까지 끌어오지 않게
        cells = [_txt(c) for c in els]
        if not cells:
            continue
        # 38 페이지 HTML 이 깨져 보호예수 표가 매출·재무 표와 한 <table> 로 묶이는 경우가 있다 —
        # '매각제한' 머리글부터 합계 행까지만 읽는다.
        if not started:
            if any("매각제한" in c and len(c) <= 40 for c in cells):  # 페이지 전체를 담은 바깥 셀 제외
                started = True
                header_text = " ".join(cells)
            continue
        if in_header:
            if not any(parse_int(c) for c in cells):
                header_text += " " + " ".join(cells)
                continue
            in_header = False
            swapped = _float_first(header_text)
        joined = re.sub(r"\s+", "", "".join(c for c in cells if not is_value_cell(c)))
        if "합계" in joined or "총계" in joined:
            # 끝의 두 쌍이 매각제한·유통가능(양식에 따라 순서 반대) — 공모 후 합계 = 둘의 합.
            # 마지막 칸은 기간 열('-')이라 뺀다. 유통가능이 '-' 면 0.
            body_t = cells[:-1] if cells[-1].strip() in ("-", "") else cells
            vals = [c for c in body_t if is_value_cell(c) and c != ""]
            if len(vals) >= 6:
                a_sh, b_sh = parse_int(vals[-4]), parse_int(vals[-2])
                lock_t, float_t = (b_sh, a_sh) if swapped else (a_sh, b_sh)
                if lock_t is not None:
                    table_lock_total = lock_t
                    total_post = lock_t + (float_t or 0)
            break
        # 숫자 칸이 하나도 없는 행(이름 줄바꿈 조각)도 위 행 rowspan 이 덮는 행 수에 들어간다.
        if not any(parse_int(c) is not None or parse_pct(c) is not None for c in cells):
            if carry[1] > 0:
                carry[1] -= 1
            joined_l = "".join(cells)
            if "소계" in joined_l:
                in_subtotal = True
            continue
        # 기간 칸: 행 끝이 기간이면 그걸, 아니면 위 행 rowspan 을 이어받는다.
        last = cells[-1]
        if is_value_cell(last) and last not in ("-",) and carry[0] and carry[1] > 0:
            period_text = carry[0]
            carry[1] -= 1
            body = cells
        else:
            period_text = last
            body = cells[:-1]
            rs = int(els[-1].get("rowspan") or 1) if str(els[-1].get("rowspan") or "1").isdigit() else 1
            carry = [last, rs - 1] if rs > 1 and not is_value_cell(last) else [None, 0]
        n = 0
        for c in reversed(body):
            if is_value_cell(c):
                n += 1
            else:
                break
        labels = [c for c in body[: len(body) - n] if c and not _SHARE_KIND_RE.match(c)]
        vals = body[len(body) - n:]
        while vals and vals[0] == "":
            vals = vals[1:]  # 앞쪽 빈 라벨 칸(빈 칸도 숫자 칸으로 센다 — 유통가능 '-' 대신 빈 칸인 양식이 있다)
        if len(vals) > 8:
            vals = vals[-8:]
        n = len(vals)
        if any("소계" in x for x in labels):
            in_subtotal = True
            continue
        # 우리사주조합·상장주선인은 주주명 칸에도 오므로 구분(group)으로 잡지 않는다(다음 행까지 번진다).
        if labels and labels[0] not in _SPECIAL_HOLDERS and _GROUP_RE.match(labels[0].replace(" ", "")):
            group = labels[0].replace(" ", "")
            labels_rest = labels[1:]
        else:
            labels_rest = labels
        labels_rest = [x for x in labels_rest if x != "주주"]  # '1% 이상 / 주주' 처럼 구분이 두 줄로 쪼개진 조각
        if n not in (2, 4, 6) and n < 8:
            continue  # 이름 줄바꿈 조각·머리 행
        if n >= 6:
            # 8칸: 공모 전·공모 후·매각제한·유통가능 / 6칸: 공모 전(또는 후)·매각제한·유통가능
            in_subtotal = False
            lock_sh, lock_pct = (vals[-2], vals[-1]) if swapped else (vals[-4], vals[-3])
        elif swapped and n == 4:
            lock_sh, lock_pct = vals[2], vals[3]
        elif n == 4 and parse_int(vals[0]) is None and parse_int(vals[2]) is not None:
            lock_sh, lock_pct = vals[2], vals[3]  # 앞 두 칸이 빈 지분율('0.00%')로 채워진 이어짐 행
        else:
            lock_sh, lock_pct = vals[0], vals[1]
        if in_subtotal:
            continue  # 소계의 기간별 이어짐 행
        if labels_rest and n >= 6:
            holder = labels_rest[0]
            relation = next((x for x in labels_rest[1:] if _RELATION_RE.search(x)), "")
            if not relation and len(labels_rest) > 1:
                relation = labels_rest[1]
            last_holder, last_relation = holder, relation
        else:
            # 숫자 2·4칸 행은 위 주주의 물량이 기간별로 나뉜 이어짐(라벨은 이름 줄바꿈 조각)
            holder, relation = last_holder, last_relation
        shares = parse_int(lock_sh)
        if not shares:
            continue  # 유통가능(매각제한 없음) 행
        period = parse_period(period_text)
        if not period:
            if period_text.strip() not in ("", "-"):
                skipped += 1
            continue
        # 블록 = [유형, 주식수, 개월, 일, 기준('L' 상장일 · 'D' 예탁일)] — 산출물 크기를 줄이려 배열로.
        blocks.append([classify(group, holder, relation), shares, period["months"], period["days"],
                       "D" if period["basis"] == "deposit" else "L"])
    lock_sum = sum(b[1] for b in blocks)
    # 표의 '합계 매각제한물량' 과 블록 합이 같으면 행을 빠짐없이 읽은 것이다(화면에 검증 여부로 쓴다).
    return {"blocks": blocks, "totalShares": total_post, "tableLockTotal": table_lock_total, "skipped": skipped,
            "lockSum": lock_sum,
            "sumMatches": bool(table_lock_total) and abs(lock_sum - table_lock_total) <= table_lock_total * SUM_TOLERANCE}


def _field_after(text: str, label: str, width: int = 60) -> str:
    i = text.find(label)
    return text[i + len(label): i + len(label) + width] if i >= 0 else ""


def parse_detail(html: str) -> dict:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    out: dict = {}
    m = re.search(r"종목코드\s*([0-9A-Z]{6})\b", text)
    out["code"] = m.group(1) if m else ""
    m = re.search(r"시장구분\s*(코스닥|유가증권|코스피|코넥스|KOSDAQ|KOSPI)", text)
    out["market"] = {"유가증권": "코스피", "KOSPI": "코스피", "KOSDAQ": "코스닥"}.get(m.group(1), m.group(1)) if m else ""
    if not out["market"] and re.search(r"종목명\s*\S*\(유가\)", text):
        out["market"] = "코스피"
    out["listingDate"] = parse_date(_field_after(text, "신규상장일", 20))
    out["subscriptionCompetition"] = parse_ratio(_field_after(text, "청약경쟁률", 40))
    out["instCompetition"] = parse_ratio(_field_after(text, "기관경쟁률", 30))
    out["commitPct"] = parse_pct((re.search(r"의무보유확약\s*([\d.]+\s*%)", text) or [None, ""])[1])
    out["offerPrice"] = parse_int((re.search(r"확정공모가\s*([\d,]+)\s*원", text) or [None, ""])[1])
    # 수요예측 확약 기간별 '신청' 수량(배정 아님)
    brk = {}
    for key, pat in (("15d", r"15일\s*확약"), ("1m", r"1개월\s*확약"), ("3m", r"3개월\s*확약"), ("6m", r"6개월\s*확약")):
        mm = re.search(pat + r"\s*([\d,]+)", text)
        if mm:
            brk[key] = parse_int(mm.group(1))
    out["commitBreakdown"] = {k: v for k, v in brk.items() if v}
    table = find_lockup_table(soup)
    out["hasTable"] = table is not None
    if table is not None:
        out.update(parse_lockup_table(table))
    return out


def parse_list_page(html: str) -> list[dict]:
    """수요예측 결과 목록 → [{no, company, demandDate, offerPrice, instCompetition, commitPct, underwriter}]."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for table in soup.find_all("table"):
        trs = table.find_all("tr")
        if not trs:
            continue
        hdr = [_txt(c) for c in trs[0].find_all(["th", "td"])]
        if not hdr or hdr[0] != "기업명" or not any("경쟁률" in h for h in hdr):
            continue
        for tr in trs[1:]:
            tds = tr.find_all("td")
            if len(tds) < 8:
                continue
            a = tr.find("a", href=True)
            m = re.search(r"no=(\d+)", a["href"]) if a else None
            if not m:
                continue
            cells = [_txt(c) for c in tds]
            rows.append({
                "no": m.group(1),
                "company": cells[0],
                "demandDate": parse_date(cells[1]),
                "offerPrice": parse_int(cells[3]),
                "instCompetition": parse_ratio(cells[5]),
                "commitPct": parse_pct(cells[6]),
                "underwriter": cells[7],
            })
        break
    return rows


def is_spac(name: str) -> bool:
    return bool(re.search(r"스팩|SPAC|기업인수목적", name or "", re.I))


def clean_name(name: str) -> str:
    return re.sub(r"\(구\.[^)]*\)|\(유가\)|\(코스닥\)", "", name or "").replace("(주)", "").strip()


# ---------------------------------------------------------------------------
# 조립
# ---------------------------------------------------------------------------
def build_releases(ipos: list[dict], today: date) -> list[dict]:
    """IPO 별 블록 → (종목, 해제일) 묶음. 과거 KEEP_PAST_RELEASE_DAYS 일 전까지만."""
    floor = (today - timedelta(days=KEEP_PAST_RELEASE_DAYS)).isoformat()
    out: dict[tuple, dict] = {}
    for ipo in ipos:
        listing = ipo.get("listingDate")
        # 블록 합이 표의 합계 매각제한물량과 맞는(행을 빠짐없이 읽은) IPO 만 싣는다.
        if not listing or not ipo.get("blocks") or not ipo.get("sumMatches"):
            continue
        total = ipo.get("totalShares") or 0
        for typ, shares, months, days, basis in ipo["blocks"]:
            rel = add_period(listing, months, days)
            if rel < floor:
                continue
            key = (ipo.get("code") or ipo["company"], rel)
            row = out.get(key)
            if row is None:
                row = out[key] = {
                    "code": ipo.get("code") or "", "company": ipo["company"], "market": ipo.get("market") or "",
                    "date": rel, "listingDate": listing, "shares": 0, "pct": None,
                    "periods": [], "types": {}, "totalShares": total or None,
                    "link": DETAIL_URL.format(no=ipo["no"]),
                }
            row["shares"] += shares
            row["types"][typ] = row["types"].get(typ, 0) + shares
            label = period_label(months, days)
            if label not in row["periods"]:
                row["periods"].append(label)
            if basis == "D":
                row["depositBasis"] = True  # 우리사주(예탁일 기준) 물량이 섞여 있다
    rows = list(out.values())
    for r in rows:
        if r["totalShares"]:
            r["pct"] = round(r["shares"] / r["totalShares"] * 100, 2)
        r["types"] = {t: r["types"][t] for t in TYPES if t in r["types"]}
    rows.sort(key=lambda r: (r["date"], -(r["pct"] or 0), r["company"]))
    return rows


BROWSER_IPO_KEYS = ("no", "company", "code", "market", "listingDate", "demandDate", "offerPrice", "underwriter", "spac",
                    "instCompetition", "commitPct", "commitBreakdown", "subscriptionCompetition", "totalShares")


def browser_payload(payload: dict) -> dict:
    """화면용: IPO 는 요약 필드 + 검증 여부·상장일 기준 매각제한 비율만."""
    ipos = []
    for r in payload.get("ipos") or []:
        row = {k: r[k] for k in BROWSER_IPO_KEYS if r.get(k) not in (None, "", {})}
        row["verified"] = bool(r.get("sumMatches"))
        if r.get("hasTable") is False and not r.get("spac"):
            row["noTable"] = True
        if r.get("sumMatches") and r.get("totalShares") and r.get("tableLockTotal"):
            row["lockedPct"] = round(r["tableLockTotal"] / r["totalShares"] * 100, 2)
        ipos.append(row)
    out = {k: v for k, v in payload.items() if k != "ipos"}
    out["ipos"] = ipos
    return out


def needs_refresh(cached: dict | None, today: date) -> bool:
    if not cached:
        return True
    ld = cached.get("listingDate")
    if not ld:
        return True
    return date.fromisoformat(ld) >= today - timedelta(days=REFRESH_AFTER_LISTING_DAYS)


def fetch_html(url: str) -> str | None:
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=25, context=_SSL_CTX) as r:
                raw = r.read()
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return raw.decode("cp949", errors="ignore")
        except Exception as exc:  # 일시 장애는 재시도
            print(f"  [warn] {url}: {exc}")
            time.sleep(2.0 * (attempt + 1))
    return None


def _cached_fetcher(folder: Path, fetch):
    folder.mkdir(parents=True, exist_ok=True)

    def get(url: str) -> str | None:
        m = re.search(r"no=(\d+)", url)
        if not m or "o=v" not in url:
            return fetch(url)  # 목록은 매번 새로
        path = folder / f"v{m.group(1)}.html"
        if path.exists():
            return path.read_text(encoding="utf-8")
        html = fetch(url)
        if html:
            from briefing_store import atomic_write_text
            atomic_write_text(path, html)  # 캐시도 부분 파일을 남기지 않게(빌더 계약)
        return html
    return get


def collect(list_rows: list[dict], prev_ipos: dict[str, dict], get_detail, today: date, max_fetch: int) -> tuple[list[dict], dict]:
    stats = {"listed": 0, "spac": 0, "fetched": 0, "cached": 0, "deferred": 0, "noTable": 0, "failed": 0}
    ipos: list[dict] = []
    fetched = 0
    seen = set()
    for lr in list_rows:
        no = lr["no"]
        if no in seen:
            continue
        seen.add(no)
        if is_spac(lr["company"]):
            # 스팩은 보호예수 표 대신 '합병 후' 기간이라 상세를 받지 않는다 — 목록의 경쟁률만 IPO 캘린더용으로 남긴다.
            stats["spac"] += 1
            ipos.append({"no": no, "company": clean_name(lr["company"]), "demandDate": lr.get("demandDate"),
                         "underwriter": lr.get("underwriter") or "", "spac": True,
                         **{k: lr[k] for k in ("offerPrice", "instCompetition", "commitPct") if lr.get(k) is not None}})
            continue
        stats["listed"] += 1
        cached = prev_ipos.get(no)
        detail = None
        if needs_refresh(cached, today):
            if fetched >= max_fetch:
                stats["deferred"] += 1
                if not cached:
                    continue
            else:
                fetched += 1
                html = get_detail(no)
                if html:
                    stats["fetched"] += 1
                    detail = parse_detail(html)
                else:
                    stats["failed"] += 1
                    if not cached:
                        continue
        else:
            stats["cached"] += 1
        base = dict(cached or {})
        base.update({
            "no": no, "company": clean_name(lr["company"]), "demandDate": lr.get("demandDate"),
            "underwriter": lr.get("underwriter") or base.get("underwriter") or "",
        })
        # 목록 값은 매번 최신으로(확정공모가·경쟁률은 수요예측 뒤 채워진다)
        for k in ("offerPrice", "instCompetition", "commitPct"):
            if lr.get(k) is not None:
                base[k] = lr[k]
        if detail is not None:
            for k in ("code", "market", "listingDate", "subscriptionCompetition", "commitBreakdown",
                      "hasTable", "blocks", "totalShares", "tableLockTotal", "skipped", "lockSum", "sumMatches"):
                if k in detail:
                    base[k] = detail[k]
            for k in ("offerPrice", "instCompetition", "commitPct"):
                if base.get(k) is None and detail.get(k) is not None:
                    base[k] = detail[k]
        if not base.get("hasTable"):
            stats["noTable"] += 1
        ipos.append(base)
    return ipos, stats


def load_prev() -> dict:
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> int:
    ap = argparse.ArgumentParser(description="국내 의무보유(보호예수) 해제 일정 수집")
    ap.add_argument("--pages", type=int, default=18, help="수요예측 결과 목록 최대 페이지(페이지당 약 20건)")
    ap.add_argument("--max-fetch", type=int, default=120, help="실행당 상세 페이지 최대 요청 수(나머지는 다음 실행)")
    ap.add_argument("--html-cache", default="", help="(개발용) 받은 HTML 을 이 폴더에 저장·재사용")
    ap.add_argument("--reparse", action="store_true", help="(개발용) 캐시된 결과를 무시하고 상세를 다시 파싱")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    global fetch_html
    if args.html_cache:
        fetch_html = _cached_fetcher(Path(args.html_cache), fetch_html)

    today = now_kst().date()
    cutoff = (today - timedelta(days=LOOKBACK_DAYS)).isoformat()
    list_rows: list[dict] = []
    for page in range(1, args.pages + 1):
        html = fetch_html(LIST_URL.format(page=page))
        if html is None:
            if page == 1:
                print("[error] 38.co.kr 목록 조회 실패 — 기존 파일 유지", file=sys.stderr)
                return 1
            break
        rows = parse_list_page(html)
        if not rows:
            if page == 1:
                print("[error] 목록 표를 찾지 못함(페이지 구조 변경?) — 기존 파일 유지", file=sys.stderr)
                return 1
            break
        list_rows.extend(rows)
        oldest = min((r["demandDate"] for r in rows if r.get("demandDate")), default=None)
        if oldest and oldest < cutoff:
            break
        time.sleep(SLEEP_S)
    list_rows = [r for r in list_rows if (r.get("demandDate") or "9999") >= cutoff]

    prev = load_prev()
    prev_ipos = {str(r["no"]): r for r in (prev.get("ipos") or []) if isinstance(r, dict) and r.get("no")}
    if args.reparse:
        prev_ipos = {}

    def get_detail(no):
        if not (args.html_cache and (Path(args.html_cache) / f"v{no}.html").exists()):
            time.sleep(SLEEP_S)  # 캐시에 없을 때만(=실제 요청) 간격을 둔다
        return fetch_html(DETAIL_URL.format(no=no))

    ipos, stats = collect(list_rows, prev_ipos, get_detail, today, args.max_fetch)
    # 이번 목록 창에서 빠졌지만 캐시에 있는(아직 해제가 남은) IPO 는 유지
    kept = {r["no"] for r in ipos}  # 스팩 포함
    for no, r in prev_ipos.items():
        if no not in kept and (r.get("demandDate") or "") >= cutoff:
            ipos.append(r)
    ipos.sort(key=lambda r: (r.get("listingDate") or r.get("demandDate") or ""), reverse=True)
    releases = build_releases(ipos, today)
    upcoming = [r for r in releases if r["date"] >= today.isoformat()]
    stats["blocks"] = sum(len(r.get("blocks") or []) for r in ipos)
    stats["periodSkipped"] = sum(int(r.get("skipped") or 0) for r in ipos)
    stats["verified"] = sum(1 for r in ipos if r.get("sumMatches"))
    stats["sumMismatch"] = sum(1 for r in ipos if r.get("hasTable") and not r.get("sumMatches"))
    payload = {
        "updatedAtKst": now_kst().strftime("%Y-%m-%d %H:%M KST"),
        "source": "38커뮤니케이션(38.co.kr) 공모주 상세 — 증권신고서·투자설명서 '공모 후 유통가능 물량(보호예수)' 표",
        "note": NOTE,
        "types": list(TYPES),
        "count": len(releases),
        "upcoming": len(upcoming),
        "ipoCount": len(ipos),
        "stats": stats,
        "releases": releases,
        "ipos": ipos,
    }
    print(f"IPO {len(ipos)}건(상세 {stats['fetched']} · 캐시 {stats['cached']} · 보류 {stats['deferred']} · 표 없음 {stats['noTable']} · 스팩 제외 {stats['spac']}) "
          f"→ 해제 일정 {len(releases)}건, 다가오는 {len(upcoming)}건")
    from sec_client import write_data
    from briefing_store import atomic_write_text
    write_data(OUT_JSON, OUT_JS, "KR_LOCKUPS", payload, indent=None, min_ratio=0.5)
    # 브라우저용 .js 는 블록(원 표 행)을 뺀 요약만 — .json 은 다음 실행의 캐시라 전부 남긴다.
    slim = json.dumps(browser_payload(payload), ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JS, f"window.KR_LOCKUPS = {slim};\n")
    print(f"→ {OUT_JSON.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)}")
    if args.push:
        from sec_client import git_publish
        rel = [str(p.relative_to(ROOT)).replace("\\", "/") for p in (OUT_JSON, OUT_JS)]
        if not git_publish(rel, "KR lockup releases"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
