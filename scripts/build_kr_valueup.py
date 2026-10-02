#!/usr/bin/env python3
"""국내 밸류업·주주환원 모아보기 — 최근 1년 공시를 한 표로.

종류(kind):
  plan       기업가치 제고 계획(밸류업) 공시 · 예고 · 이행현황, 공정공시 '주주환원 정책' 안내.
             원문에서 계획서 명칭·주요 내용 첫머리·배당성향·배당금 증가율·고배당기업 여부를 읽는다.
  buyback    자기주식 취득결정 · 취득 신탁계약 체결결정 — 금액·주식수(DART DS005 주요정보 API).
  cancel     주식소각결정 — 소각 주식수 ÷ 발행주식총수(%), 소각예정금액(원문).
  dividendUp 현금배당결정 중 **같은 종류(결산·분기·중간) 1년 전 배당보다 주당배당금이 늘어난 것**.
             배당결정 공시에는 전년도 값이 없어(2026-10-02 원문 확인) 우리가 쌓은 배당 이력과 비교한다.
             1년 전 공시가 이력에 없으면 증액 여부를 판단하지 않는다(지어내지 않는다).

소스: 매일은 kr_disclosures.json(최근 7일, build_kr_disclosures.py). 처음 한 번 `--backfill-days N` 으로
DART 공시검색을 기간 스캔해 이력을 채운다(kr_dart_scan.py). 정정·첨부추가 공시('[…]' 로 시작)는
원 공시와 중복이라 뺀다. 이미 읽은 공시(link 기준)는 직전 파일 값을 재사용한다.

산출물: data/korea/valueup.{json,js} (window.KR_VALUEUP) — 최근 365일 행.
상태:   data/korea/valueup_state.json — 배당 이력(종목별 [공시일, 종류, 주당배당금], 최근 800일). 배포 제외.

Requires DART_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta
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
from sec_client import write_data  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
DISCLOSURES = ROOT / "data" / "kr_disclosures.json"
OUT_JSON = ROOT / "data" / "korea" / "valueup.json"
OUT_JS = ROOT / "data" / "korea" / "valueup.js"
STATE = ROOT / "data" / "korea" / "valueup_state.json"
KEEP_DAYS = 365
DIV_HISTORY_DAYS = 800
# 같은 종류의 '1년 전' 배당으로 볼 공시일 간격(일). 결산배당은 이사회 날짜가 해마다 몇 주씩 움직인다.
YOY_MIN_DAYS, YOY_MAX_DAYS = 300, 430


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def classify(title: str) -> tuple[str, str] | None:
    """제목 → (kind, 라벨). 해당 없으면 None.

    DART 목록은 원 공시에 첨부가 붙으면 그 원 공시의 제목 앞에 '[첨부추가]'·'[첨부정정]'을 붙여 보여 준다
    (2026-10-02 실측: LG전자 10-13 잠정실적이 '[첨부추가]…' 로만 남았다) — 원 공시로 받는다.
    '[기재정정]' 은 따로 접수된 정정 공시라 원 공시와 중복이므로 뺀다.
    """
    t = re.sub(r"^\[첨부(추가|정정)\]", "", re.sub(r"\s+", "", title or ""))
    if not t or t.startswith("["):
        return None
    if "기업가치제고계획" in t:
        if "예고" in t:
            return "plan", "밸류업 예고"
        if "이행" in t:
            return "plan", "밸류업 이행현황"
        return "plan", "밸류업 계획"
    if "수시공시의무관련사항" in t and ("주주환원" in t or "주주가치" in t):
        return "plan", "주주환원 정책"
    if "자기주식취득신탁계약체결결정" in t:
        return "buyback", "신탁 취득"
    if "자기주식취득결정" in t:
        return "buyback", "자사주 취득"
    if "주식소각결정" in t:
        return "cancel", "소각"
    if "현금ㆍ현물배당결정" in t:
        return "dividend", "배당"
    return None


def rcpt_of(row: dict) -> str | None:
    m = re.search(r"rcpNo=(\d+)", row.get("link") or "")
    return m.group(1) if m else None


def _cell_after(rows: list[list[str]], label_re: str, idx: int = 1) -> str | None:
    for r in rows:
        if r and re.search(label_re, re.sub(r"\s+", "", r[0])) and len(r) > idx:
            return r[idx]
    return None


def _num(s) -> float | None:
    s = re.sub(r"[,\s]", "", str(s or ""))
    try:
        return float(s) if s not in ("", "-") else None
    except ValueError:
        return None


def parse_plan(rows: list[list[str]]) -> dict:
    out: dict = {}
    name = _cell_after(rows, r"^1\.계획서명칭")
    if name and name != "-":
        out["planName"] = name[:80]
    body = _cell_after(rows, r"^2\.주요내용")
    if body and body != "-":
        out["excerpt"] = re.sub(r"\s+", " ", body)[:160]
    payout = _num(_cell_after(rows, r"직전사업연도.*배당성향"))
    if payout is not None:
        out["payoutPct"] = payout
    growth = _num(_cell_after(rows, r"이익배당금액증가율"))
    if growth is not None:
        out["divGrowthPct"] = growth
    high = _cell_after(rows, r"고배당기업여부")
    if high in ("해당", "미해당"):
        out["highDividend"] = high == "해당"
    return out


def parse_cancel(rows: list[list[str]]) -> dict:
    out: dict = {}
    for r in rows:
        head = re.sub(r"\s+", "", r[0]) if r else ""
        if head.startswith("1.소각할주식의종류와수") and len(r) >= 3:
            out["shares"] = _num(r[2])
        elif head.startswith("2.발행주식총수") and len(r) >= 3:
            out["totalShares"] = _num(r[2])
        elif head.startswith("4.소각예정금액") and len(r) >= 2:
            out["amount"] = _num(r[1])
        elif head.startswith("6.소각할주식의취득방법") and len(r) >= 2 and r[1] != "-":
            out["method"] = r[1][:30]
    if out.get("shares") and out.get("totalShares"):
        out["sharesPct"] = round(out["shares"] / out["totalShares"] * 100, 2)
    return {k: v for k, v in out.items() if v is not None}


def parse_buyback(rows: list[list[str]]) -> dict:
    """DS005 가 비어 있는 공시(신탁계약 체결 등, 2026-10-02 실측 절반)는 원문에서 금액을 읽는다."""
    out: dict = {}
    for r in rows:
        head = re.sub(r"\s+", "", r[0]) if r else ""
        vals = [_num(c) for c in r[1:]]
        first = next((v for v in vals if v is not None), None)
        if head.startswith("1.계약금액") and first:
            out["amount"] = first
        elif head.startswith("2.취득예정금액") and first:
            out["amount"] = first
        elif head.startswith("1.취득예정주식") and first:
            out["shares"] = first
        elif ("취득목적" in head or "계약목적" in head) and len(r) >= 2 and r[1] not in ("", "-"):
            out["purpose"] = r[1][:60]
    return out


def dividend_yoy(history: list, file_date: str, kind: str, dps: float) -> dict | None:
    """같은 종류의 1년 전(300~430일 전) 배당과 비교. 여러 건이면 1년(365일)에 가장 가까운 것."""
    try:
        d0 = date.fromisoformat(file_date)
    except ValueError:
        return None
    best = None
    for h_date, h_kind, h_dps in history:
        if h_kind != kind or not h_dps:
            continue
        try:
            gap = (d0 - date.fromisoformat(h_date)).days
        except ValueError:
            continue
        if YOY_MIN_DAYS <= gap <= YOY_MAX_DAYS and (best is None or abs(gap - 365) < abs(best[0] - 365)):
            best = (gap, h_date, h_dps)
    if not best:
        return None
    return {"prevDps": best[2], "prevDate": best[1], "dpsYoyPct": round((dps / best[2] - 1) * 100, 1)}


def _load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def buyback_amounts(rows: list[dict], api_key: str) -> dict[str, dict]:
    """자사주 취득 공시의 금액·주식수(DS005). (종목, API) 마다 1회 — 공시 기간 전체를 한 번에 조회."""
    from build_kr_disclosures import dart_get, load_corp_map
    from build_kr_event_details import api_for, summarize

    groups: dict[tuple[str, str], list[str]] = {}
    for r in rows:
        api = api_for(r.get("title"))
        if api in ("tsstkAqDecsn", "tsstkAqTrctrCcDecsn"):
            groups.setdefault((r["ticker"], api), []).append(r["date"])
    if not groups:
        return {}
    corp_map = load_corp_map(api_key) or {}
    out: dict[str, dict] = {}
    for (ticker, api), dates in groups.items():
        corp = corp_map.get(ticker)
        if not corp:
            continue
        bgn = (date.fromisoformat(min(dates)) - timedelta(days=3)).strftime("%Y%m%d")
        end = (date.fromisoformat(max(dates)) + timedelta(days=3)).strftime("%Y%m%d")
        try:
            data = dart_get(f"{api}.json", {"corp_code": corp, "bgn_de": bgn, "end_de": end}, api_key)
        except Exception:
            continue
        if str(data.get("status")) != "000":
            continue
        for item in data.get("list") or []:
            rc = str(item.get("rcept_no") or "")
            s = summarize(api, item)
            if rc and s:
                out[rc] = {k: s[k] for k in ("amount", "shares", "purpose", "method") if k in s}
    return out


def build(source_rows: list[dict], prev_rows: list[dict], state: dict, api_key: str) -> tuple[list, dict, dict]:
    from build_kr_corp_disclosures import clean, fetch_doc, parse_dividend
    from kr_prelim_parse import table_rows

    today = datetime.now(KST).date()
    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    div_cutoff = (today - timedelta(days=DIV_HISTORY_DAYS)).isoformat()
    cached = {r.get("link"): r for r in prev_rows if isinstance(r, dict) and r.get("link")}
    div_hist: dict[str, list] = {t: [h for h in hs if h[0] >= div_cutoff]
                                 for t, hs in (state.get("dividends") or {}).items()}
    # 이미 읽은 배당 공시(접수번호 → 공시일). 증액이 아니면 행이 없으니 여기로 재조회를 막는다.
    div_seen: dict[str, str] = {k: v for k, v in (state.get("dividendSeen") or {}).items() if v >= div_cutoff}
    stats = {"source": 0, "reused": 0, "parsed": 0, "fetchFailed": 0, "dividends": 0, "dividendUp": 0}

    # 소스 행을 공시 단위로 중복 제거(백필·일일 소스가 겹친다).
    uniq: dict[str, dict] = {}
    for r in source_rows:
        cls = classify(r.get("title"))
        if not cls or not r.get("link") or not r.get("ticker"):
            continue
        uniq.setdefault(r["link"], {**r, "kind": cls[0], "label": cls[1]})
    items = sorted(uniq.values(), key=lambda x: x.get("fileDate") or "")
    stats["source"] = len(items)

    # 1년보다 오래된 배당 공시는 비교 기준(1년 전 배당)으로만 쓴다 — 최근 1년에 배당 공시가 있는 종목만 읽는다.
    recent_div_tickers = {str(r["ticker"]).zfill(6) for r in items
                          if r["kind"] == "dividend" and (r.get("fileDate") or "") >= cutoff}

    need_buyback = [
        {"ticker": str(r["ticker"]).zfill(6), "title": r["title"], "date": r["fileDate"]}
        for r in items if r["kind"] == "buyback" and r["link"] not in cached and r.get("fileDate", "") >= cutoff
    ]
    bb = buyback_amounts(need_buyback, api_key) if (need_buyback and api_key) else {}

    out: list[dict] = []
    for r in items:
        link, kind, fdate = r["link"], r["kind"], r.get("fileDate") or ""
        ticker = str(r["ticker"]).zfill(6)
        base = {"kind": kind, "label": r["label"], "ticker": ticker, "company": r.get("company") or ticker,
                "date": fdate, "title": r["title"], "link": link}
        if kind == "dividend":
            # 배당은 이력에 쌓고, 1년 전보다 늘어난 것만 행으로 낸다. 오래된 공시도 이력용으로는 읽는다.
            if fdate < div_cutoff or (fdate < cutoff and ticker not in recent_div_tickers):
                continue
            old = cached.get(link)
            if old and old.get("dps"):
                rec = {k: old[k] for k in ("divKind", "dps", "yieldPct", "recordDate") if k in old}
            elif (rcpt_of(r) or link) in div_seen:
                continue  # 이미 읽었는데 증액이 아니어서 행으로 안 낸 공시 — 이력에 이미 있다
            else:
                doc = fetch_doc(rcpt_of(r), api_key) if api_key else None
                if not doc:
                    stats["fetchFailed"] += 1
                    continue
                d = parse_dividend(clean(doc))
                if not d.get("dps") or d.get("cashStock") not in (None, "현금배당"):
                    div_seen[rcpt_of(r) or link] = fdate
                    continue
                rec = {"divKind": d.get("divKind") or "", "dps": d["dps"],
                       "yieldPct": d.get("yieldPct"), "recordDate": d.get("recordDate")}
                stats["parsed"] += 1
            stats["dividends"] += 1
            hist = div_hist.setdefault(ticker, [])
            yoy = dividend_yoy(hist, fdate, rec["divKind"], rec["dps"])
            if [fdate, rec["divKind"], rec["dps"]] not in hist:
                hist.append([fdate, rec["divKind"], rec["dps"]])
            div_seen[rcpt_of(r) or link] = fdate
            if yoy and yoy["dpsYoyPct"] > 0 and fdate >= cutoff:
                out.append({**base, "kind": "dividendUp", "label": "배당 증액",
                            **{k: v for k, v in rec.items() if v is not None}, **yoy})
                stats["dividendUp"] += 1
            continue
        if fdate < cutoff:
            continue
        old = cached.get(link)
        if old:
            out.append(old)
            stats["reused"] += 1
            continue
        extra: dict = {}
        if kind == "buyback":
            extra = dict(bb.get(rcpt_of(r) or "", {}))
            if not extra.get("amount") and api_key:
                doc = fetch_doc(rcpt_of(r), api_key)
                if doc:
                    extra.update({k: v for k, v in parse_buyback(table_rows(doc)).items() if k not in extra})
                    stats["parsed"] += 1
                else:
                    stats["fetchFailed"] += 1
        elif kind in ("plan", "cancel") and api_key:
            doc = fetch_doc(rcpt_of(r), api_key)
            if not doc:
                stats["fetchFailed"] += 1
            else:
                rows = table_rows(doc)
                extra = parse_plan(rows) if kind == "plan" else parse_cancel(rows)
                stats["parsed"] += 1
        if kind == "plan" and r["label"] == "주주환원 정책":
            m = re.search(r"\((주주[^)]*)\)\s*$", r["title"])
            if m:
                extra.setdefault("planName", m.group(1))
        out.append({**base, **extra})

    out.sort(key=lambda x: x.get("date") or "", reverse=True)
    new_state = {
        "updatedAtKst": now_kst(),
        "coverageStart": state.get("coverageStart") or "",
        "dividends": {t: sorted(hs) for t, hs in div_hist.items() if hs},
        "dividendSeen": dict(sorted(div_seen.items())),
    }
    return out, new_state, stats


def merge_rows(new_rows: list[dict], prev_rows: list[dict]) -> list[dict]:
    """일일 실행은 7일치만 새로 본다 — 직전 파일의 최근 365일 행을 이어 붙인다(link 기준 중복 제거)."""
    cutoff = (datetime.now(KST).date() - timedelta(days=KEEP_DAYS)).isoformat()
    seen = {r["link"] for r in new_rows}
    rows = list(new_rows) + [r for r in prev_rows if r.get("link") not in seen and (r.get("date") or "") >= cutoff]
    rows.sort(key=lambda x: x.get("date") or "", reverse=True)
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description="국내 밸류업·주주환원 모아보기")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--backfill-days", type=int, default=0,
                    help="DART 공시검색으로 최근 N일을 스캔해 이력을 채운다(처음 한 번, 수시공시 1년 ≈ 목록 요청 1,000회)")
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    import sec_client as sec

    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        print("[밸류업] DART_API_KEY 없음 — 기존 파일 유지.")
        return 1
    prev = _load(OUT_JSON, {})
    prev_rows = prev.get("rows") or []
    state = _load(STATE, {})

    source = list((_load(DISCLOSURES, {}).get("disclosures")) or [])
    if args.backfill_days:
        from kr_dart_scan import scan
        end = datetime.now(KST).date()
        bgn = end - timedelta(days=args.backfill_days)
        scanned = scan(api_key, bgn, end, ("I001", "I002", "B001"), keep=lambda t: classify(t) is not None)
        print(f"[밸류업] 백필 스캔 {bgn}~{end}: 대상 공시 {len(scanned)}건")
        source = scanned + source
        if not state.get("coverageStart") or state["coverageStart"] > bgn.isoformat():
            state["coverageStart"] = bgn.isoformat()

    rows, new_state, stats = build(source, prev_rows, state, api_key)
    rows = merge_rows(rows, prev_rows)
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["kind"]] = counts.get(r["kind"], 0) + 1
    print(f"[밸류업] 소스 {stats['source']} · 재사용 {stats['reused']} · 원문 {stats['parsed']} · "
          f"원문 실패 {stats['fetchFailed']} · 배당 {stats['dividends']}(증액 {stats['dividendUp']}) → 행 {len(rows)} {counts}")
    payload = {
        "updatedAtKst": now_kst(),
        "coverageStart": new_state.get("coverageStart") or "",
        "count": len(rows),
        "counts": counts,
        "rows": rows,
    }
    with repository_publish_lock(ROOT):
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        write_data(OUT_JSON, OUT_JS, "KR_VALUEUP", payload, indent=None)
        atomic_write_text(STATE, json.dumps(new_state, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"Wrote {OUT_JSON} — {len(rows)} rows")
        if args.push and not sec.git_publish(
            ["data/korea/valueup.json", "data/korea/valueup.js", "data/korea/valueup_state.json"],
            "KR value-up tracker",
        ):
            print("[밸류업] git 게시 실패 — 발행되지 않았다")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
