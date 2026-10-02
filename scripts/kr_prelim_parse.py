"""DART '영업(잠정)실적(공정공시)' 원문 → 숫자 + 한국어 요약 문장 (LLM 없음).

공정공시 표는 KRX 표준 양식이라 행 모양이 일정하다(2026-07~08 실측 표본):
  ['1. 연결실적내용', '단위 : 백만원, %']            ← 별도 기준이면 '1. 실적내용'
  ['매출액', '당해실적', 당기, 전기, 전기대비%, 전환, 전년동기, 전년동기대비%, 전환]
  ['누계실적', 누계, '-', '-', '-', 전년누계, 누계대비%, 전환]
금액은 단위(백만원·천원·원·억원)를 읽어 **억원**으로 바꿔 저장한다. 요약 문장은 템플릿으로만
만든다 — 2026-10-02 Workers AI(Llama 3.3 70B)에 같은 원문을 줬더니 백만원→억원 환산을 10배
틀렸다(SK가스 영업이익 -439억원 → '-43.9억원'). 숫자를 지어내지 않는 쪽이 이 파일의 목적이다.
"""

from __future__ import annotations

import html
import re
from datetime import date

# 표의 항목명 → 키. 금융사는 매출액 대신 '영업수익'을 쓴다.
ITEMS = (
    ("revenue", ("매출액", "영업수익", "수익(매출액)")),
    ("op", ("영업이익",)),
    ("pretax", ("법인세비용차감전계속사업이익",)),
    ("net", ("당기순이익",)),
    ("netParent", ("지배기업소유주지분순이익", "지배기업의소유주에게귀속되는당기순이익")),
)
LABEL = {"revenue": "매출", "op": "영업이익", "pretax": "세전이익", "net": "순이익", "netParent": "지배순이익"}
UNIT_TO_EOK = {"원": 1e-8, "천원": 1e-5, "백만원": 1e-2, "억원": 1.0}


def table_rows(doc: str) -> list[list[str]]:
    """표 → 셀 텍스트 행. 공정공시(xforms)는 TD, 주요사항보고서(dart XML)는 값이 TE/TU 에 있다."""
    body = re.sub(r"(?is)<style.*?</style>", "", doc or "")
    rows = []
    for tr in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", body):
        cells = [html.unescape(re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", c))).strip()
                 for _tag, c in re.findall(r"(?is)<(t[dhue])\b[^>]*>(.*?)</\1>", tr)]
        if cells:
            rows.append(cells)
    return rows


def _num(s) -> float | None:
    s = str(s or "").replace(",", "").replace(" ", "")
    if s in ("", "-"):
        return None
    if s.startswith("(") and s.endswith(")"):  # 회계식 음수 (1,234)
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return None


def _turn(s) -> str | None:
    s = str(s or "").replace(" ", "")
    return s if s in ("흑자전환", "적자전환", "적자지속", "적자확대", "적자축소") else None


def _item_key(name: str) -> str | None:
    n = re.sub(r"\s+", "", name or "")
    for key, names in ITEMS:
        if n in names:
            return key
    return None


def _period(rows) -> dict:
    """실적기간 표에서 당기(start,end)를 읽어 '2026년 2분기' 같은 이름을 만든다."""
    out = {}
    for r in rows[:60]:  # 정정공시는 '정정사항' 표 뒤에 실적기간 표가 온다
        if "cur" in out and "cum" in out:
            break
        if len(r) >= 4 and r[0] in ("당기실적", "당기누계실적") and re.fullmatch(r"\d{4}-\d{2}-\d{2}", r[1]) \
                and re.fullmatch(r"\d{4}-\d{2}-\d{2}", r[3]):
            out.setdefault("cur" if r[0] == "당기실적" else "cum", (r[1], r[3]))
    if "cur" not in out:
        return {}
    start, end = (date.fromisoformat(x) for x in out["cur"])
    months = (end.year - start.year) * 12 + end.month - start.month + 1
    if months == 1:
        label = f"{end.year}년 {end.month}월"  # 월별 매출 공시(카지노·조선 등)
    elif months <= 3:
        label = f"{end.year}년 {(end.month - 1) // 3 + 1}분기"
    elif months <= 6:
        label = f"{end.year}년 반기"
    else:
        label = f"{end.year}년 연간"
    res = {"periodStart": out["cur"][0], "periodEnd": out["cur"][1], "periodLabel": label, "periodMonths": months}
    if "cum" in out:
        res["cumStart"], res["cumEnd"] = out["cum"]
    return res


def _unit_scale(text: str) -> float | None:
    m = re.search(r"(?:단위\s*:?\s*|\()(백만원|천원|억원|원)", text)
    return UNIT_TO_EOK[m.group(1)] if m else None


NON_MONEY = re.compile(r"대수|판매량|수량|Gcal|톤|불|달러|USD|건수|\(천|\(만|\(대")


def _custom_metric(rows) -> dict | None:
    """표준 표가 비어 있고 회사가 자체 표(카지노 월매출 등)를 붙인 경우 — 첫 지표 한 줄만 읽는다.

    ['구분(단위:백만원,%)', '당기실적', …] 머리 뒤 ['카지노매출액', 당기, 전기, 전기대비%, 전환, 전년동기,
    전년동기대비%, 전환]. '- 테이블' 같은 하위 행은 건너뛴다. 누계 머리('당기누계 실적') 뒤 같은 이름 행은 누계.
    """
    out = None
    scale = None
    cum_mode = False
    for r in rows:
        head = r[0].replace(" ", "")
        if head.startswith("구분"):
            # 자체 표는 금액이 아닐 수 있다(판매대수·열판매량·수주 백만불). 머리에 금액 단위가 **명시된**
            # 표만 읽는다 — 본문 표의 단위(백만원)를 물려받으면 '판매 457억원' 같은 숫자가 된다.
            scale = _unit_scale(" ".join(r))
            cum_mode = any("누계" in c for c in r[1:])
            continue
        if scale is None or len(r) < 8 or r[0].startswith("-") or _num(r[1]) is None:
            continue
        if NON_MONEY.search(r[0]):
            continue
        eok = lambda v: None if v is None else round(v * scale, 2)  # noqa: E731
        name = re.sub(r"\s+", "", r[0])
        if not cum_mode and out is None:
            out = {"label": name, "cur": eok(_num(r[1])), "prev": eok(_num(r[2])),
                   "qoq": _num(r[3].rstrip("%")), "qoqTurn": _turn(r[4]),
                   "yoyBase": eok(_num(r[5])), "yoy": _num(r[6].rstrip("%")), "yoyTurn": _turn(r[7])}
        elif cum_mode and out and name == out["label"]:
            out.update({"cum": eok(_num(r[1])), "cumBase": eok(_num(r[5])), "cumYoy": _num(r[6].rstrip("%"))})
    return {k: v for k, v in out.items() if v is not None} if out else None


def parse_prelim(doc: str) -> dict | None:
    """원문 → {unit, consolidated, periodLabel, items:{key:{cur,prev,qoq,qoqTurn,yoyBase,yoy,yoyTurn,
    cum,cumBase,cumYoy,cumTurn}}} (금액 억원). 실적 표를 못 찾으면 None."""
    rows = table_rows(doc)
    start = None
    for i, r in enumerate(rows):
        if re.fullmatch(r"1\.\s*(연결)?실적내용", r[0]):
            start = i  # 정정공시는 앞에 '정정사항' 표가 있다 — 본문 표(라벨이 정확히 일치)만 잡는다
    if start is None:
        return None
    # 단위는 제목 줄 둘째 칸('단위 : 백만원, %') 또는 다음 줄 첫 칸('구분(단위 : 백만원, %)')에 있다.
    scale = _unit_scale(" ".join(" ".join(r) for r in rows[start:start + 3]))
    if scale is None:
        return None
    eok = lambda v: None if v is None else round(v * scale, 2)  # noqa: E731
    items: dict[str, dict] = {}
    cur_key = None
    end = len(rows)
    for j in range(start + 1, min(len(rows), start + 60)):
        r = rows[j]
        if re.match(r"^\d\.", r[0]):
            end = j
            break  # '2. 정보제공내역' — 표 끝
        if len(r) >= 9 and r[1] == "당해실적":
            cur_key = _item_key(r[0])
            if cur_key and cur_key not in items:
                items[cur_key] = {
                    "cur": eok(_num(r[2])), "prev": eok(_num(r[3])), "qoq": _num(r[4]), "qoqTurn": _turn(r[5]),
                    "yoyBase": eok(_num(r[6])), "yoy": _num(r[7]), "yoyTurn": _turn(r[8]),
                }
            else:
                cur_key = None
        elif len(r) >= 8 and r[0] == "누계실적" and cur_key in items:
            items[cur_key].update({"cum": eok(_num(r[1])), "cumBase": eok(_num(r[5])),
                                   "cumYoy": _num(r[6]), "cumTurn": _turn(r[7])})
            cur_key = None
    items = {k: {kk: vv for kk, vv in v.items() if vv is not None} for k, v in items.items()}
    items = {k: v for k, v in items.items() if "cur" in v}
    custom = None if items else _custom_metric(rows[start + 1:end])
    if not items and not custom:
        return None
    out = {"unit": "억원", "consolidated": rows[start][0].replace(" ", "").startswith("1.연결"), "items": items}
    if custom:
        out["custom"] = custom
    out.update(_period(rows))
    return out


def fmt_eok(v: float | None) -> str:
    """억원 → '2.31조원' / '-439억원' / '3.5억원'."""
    if v is None:
        return "—"
    a = abs(v)
    if a >= 10000:
        s = f"{a / 10000:,.2f}".rstrip("0").rstrip(".") + "조원"
    elif a >= 100:
        s = f"{a:,.0f}억원"
    else:
        s = f"{a:,.1f}".rstrip("0").rstrip(".") + "억원"
    return ("-" if v < 0 else "") + s


def _change(it: dict) -> str:
    """전년동기 비교 — 전환 문구가 있으면 그걸, 없으면 증감률. 전년동기 값이 없으면 전기 대비."""
    if it.get("yoyTurn"):
        return it["yoyTurn"]
    if it.get("yoy") is not None:
        return f"전년 대비 {'+' if it['yoy'] > 0 else ''}{it['yoy']:,.1f}%"
    if it.get("qoqTurn"):
        return f"전기 대비 {it['qoqTurn']}"
    if it.get("qoq") is not None:
        return f"전기 대비 {'+' if it['qoq'] > 0 else ''}{it['qoq']:,.1f}%"
    return ""


def summarize(parsed: dict) -> str:
    """'2026년 2분기 매출 2.31조원(전년 대비 +23.0%), 영업이익 -439억원(적자전환), 순이익 …' 한 문장."""
    items = parsed.get("items") or {}
    parts = []
    for key in ("revenue", "op", "netParent" if "netParent" in items else "net"):
        it = items.get(key)
        if not it:
            continue
        ch = _change(it)
        parts.append(f"{LABEL[key]} {fmt_eok(it['cur'])}" + (f"({ch})" if ch else ""))
    c = parsed.get("custom")
    if not parts and c:
        ch = _change(c)
        parts.append(f"{c['label']} {fmt_eok(c['cur'])}" + (f"({ch})" if ch else ""))
    if not parts:
        return ""
    head = parsed.get("periodLabel") or ""
    return (head + " " if head else "") + ", ".join(parts)


def consensus_progress(parsed: dict, est: dict | None) -> dict | None:
    """누계 실적을 같은 회계연도의 연간 컨센서스(억원)와 비교한 달성률(%).

    FnGuide 컨센서스는 연간 추정치만 있어(분기 추정 없음) 분기 서프라이즈는 계산하지 않는다.
    estimateFy('2026.12')의 연도가 누계 기간 끝 연도와 같고 12월 결산일 때만 낸다. 연결 기준 분기·반기·연간
    공시만 — 월별 매출 공시는 대개 별도 기준이라 연결 컨센서스와 섞으면 달성률이 왜곡된다(이마트 8월 39.8%).
    """
    if not est or not parsed or not parsed.get("consolidated") or (parsed.get("periodMonths") or 0) < 3:
        return None
    fy = str(est.get("estimateFy") or "")
    end = parsed.get("cumEnd") or parsed.get("periodEnd") or ""
    if not re.fullmatch(r"\d{4}\.12", fy) or fy[:4] != end[:4]:
        return None
    items = parsed.get("items") or {}
    out = {"estimateFy": fy}
    for key, ek in (("revenue", "revenueEstimate"), ("op", "operatingEstimate")):
        it = items.get(key) or {}
        cum = it.get("cum", it.get("cur") if end[5:7] == "03" else None)  # 1분기는 누계 = 당기
        e = est.get(ek)
        if isinstance(cum, (int, float)) and isinstance(e, (int, float)) and e > 0 and cum > 0:
            out[key + "ProgressPct"] = round(cum / e * 100, 1)
    return out if len(out) > 1 else None
