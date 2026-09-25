#!/usr/bin/env python3
"""실적 전 과거 반응 vs 옵션 예상변동폭 (US).

다가오는 실적 발표(data/earnings_calendar.json, 시총 상위 120) 종목마다 두 숫자를
나란히 둔다. 판단(비싸다/싸다)은 하지 않는다 — 숫자 비교만 발행한다.

1) 과거 반응: 최근 최대 8번의 실적 발표에 대해 '발표 뒤 첫 정규장' 종가 등락률의
   절댓값 평균(표본 수 함께).
   - 발표 시각은 SEC 8-K Item 2.02(실적 발표) 제출 시각(acceptanceDateTime, UTC)을
     뉴욕 시간으로 바꿔 판정한다. 16:00 ET 이후 제출(장후) → 다음 거래일이 반응일,
     그 전(장전·장중) → 그날이 반응일. 주말 제출은 다음 거래일.
     예전 실적반응 트래커(프론트)는 발표일 종가만 봐서 장후 발표 종목은 반응이
     하루 밀려 잡혔다 — 여기서는 시각으로 가른다.
   - 가격은 data/details/<T>.json 의 chartSeries(실측 일봉)를 그대로 쓴다.
   - 같은 분기의 예비 실적(프리어나운스) 8-K 가 끼면 20일 안의 제출은 하나로 묶고
     마지막 것을 쓴다. 야후 earningsHistory 날짜가 있으면 그 날짜(±3일)와 맞는
     제출만 남긴다(이력 범위 밖은 그대로 둔다 — 야후 이력이 낡은 경우가 있다).

2) 옵션 예상변동폭: build_options_stats.py 와 같은 계산(ATM 스트래들/현재가)을
   '실적 반응일 이후 첫 만기' 체인에 적용한다. 옵션 심리 패널의 값은 최근월물 하나라
   실적일보다 먼저 끝나는 만기일 수 있다 — 그런 비교는 하지 않는다.
   - 다가오는 발표 시점(장전/장후)은 야후 earningsTimestamp(추정치 아님)로, 없으면
     과거 8-K 시각이 한쪽으로 일관될 때 그것으로 추정한다. 둘 다 없으면 장후 가정
     (반응일 = 발표일 다음 평일)으로 만기를 고른다 — 어느 쪽이든 반응일을 포함한다.
   - 만기가 반응일보다 며칠 뒤면 그 기간 전체의 예상폭이다(화면에 명시).
   - 야후 인증이 실패하면 options_stats.json 값을 쓰되, 만기가 반응일 이후일 때만,
     그리고 '첫 만기인지 확인 불가' 표시를 단다. 반응일 전에 끝나는 만기는 버린다.

산출물: data/earnings_move_compare.json + .js(window.EARNINGS_MOVE_COMPARE).
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import urllib.parse
from datetime import date, datetime, time as dtime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402

OUT_JSON = ROOT / "data" / "earnings_move_compare.json"
OUT_JS = ROOT / "data" / "earnings_move_compare.js"
CALENDAR = ROOT / "data" / "earnings_calendar.json"
OPTIONS_STATS = ROOT / "data" / "options_stats.json"
DETAILS_DIR = ROOT / "data" / "details"

MAX_EVENTS = 8
CLUSTER_DAYS = 20       # 이 안의 2.02 제출은 같은 분기 발표로 묶는다
HIST_MATCH_DAYS = 3     # 야후 earningsHistory 날짜와의 허용 오차
MAX_REACTION_GAP = 5    # 제출일 → 반응일이 이보다 멀면(일봉 공백) 그 표본은 버린다
MARKET_OPEN = dtime(9, 30)
MARKET_CLOSE = dtime(16, 0)


# ---------------------------------------------------------------------------
# 순수 함수(테스트 대상)
# ---------------------------------------------------------------------------

def session_of(accepted_et: datetime) -> str:
    """ET 시각 → 'bmo'(장전) / 'amc'(장후) / 'intraday'(장중)."""
    t = accepted_et.time()
    if t >= MARKET_CLOSE:
        return "amc"
    if t < MARKET_OPEN:
        return "bmo"
    return "intraday"


def parse_acceptance(value: str) -> datetime | None:
    """EDGAR acceptanceDateTime('2026-07-30T20:30:28.000Z', 실제 UTC) → ET datetime."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(sec.ET_TZ)


def reaction_index(dates: list[str], accepted_et: datetime) -> int:
    """일봉 날짜 목록(오름차순 'YYYY-MM-DD')에서 반응일 인덱스. 없으면 -1.

    장후(16:00 ET 이후) 제출이면 제출일 '다음' 거래일, 그 외엔 제출일 당일(휴장이면 다음)."""
    d = accepted_et.date().isoformat()
    after = session_of(accepted_et) == "amc"
    for i, row_date in enumerate(dates):
        if (row_date > d) if after else (row_date >= d):
            return i
    return -1


def cluster_filings(filings: list[dict], hist_dates: list[str]) -> list[dict]:
    """2.02 제출 목록(시각 오름차순)을 분기 발표 단위로 정리한다."""
    hist = sorted({str(x)[:10] for x in hist_dates if x})
    if hist:
        lo = date.fromisoformat(hist[0]) - timedelta(days=HIST_MATCH_DAYS)
        hi = date.fromisoformat(hist[-1]) + timedelta(days=HIST_MATCH_DAYS)
        hist_d = [date.fromisoformat(x) for x in hist]
        kept = []
        for f in filings:
            fd = f["acceptedEt"].date()
            if lo <= fd <= hi and not any(abs((fd - h).days) <= HIST_MATCH_DAYS for h in hist_d):
                continue  # 이력 범위 안인데 어떤 실적일과도 안 맞음 → 예비실적 등
            kept.append(f)
        filings = kept
    out: list[dict] = []
    for f in filings:
        if out and (f["acceptedEt"] - out[-1]["acceptedEt"]).days <= CLUSTER_DAYS:
            out[-1] = f  # 같은 분기 → 나중 제출(본 발표)로 교체
        else:
            out.append(f)
    return out


def backfill_from_history(filings: list[dict], hist_dates: list[str]) -> list[dict]:
    """SEC 제출 목록이 짧을 때(대형 금융사는 submissions 가 1년 치뿐) 그 이전의 야후
    earningsHistory 날짜를 보탠다. 시각은 모르므로, 확인된 8-K 시각이 전부 한쪽
    (장전 또는 장후)일 때만 그 패턴을 적용하고 inferred 로 표시한다. 섞여 있으면 안 보탠다."""
    if len(filings) >= MAX_EVENTS or not filings:
        return filings
    sessions = {session_of(f["acceptedEt"]) for f in filings}
    if len(sessions) != 1 or len(filings) < 2:
        return filings
    s = sessions.pop()
    if s not in ("bmo", "amc"):
        return filings
    first = filings[0]["acceptedEt"].date()
    hh, mm = (7, 0) if s == "bmo" else (16, 30)
    extra = []
    for h in sorted({str(x)[:10] for x in hist_dates if x}):
        try:
            d = date.fromisoformat(h)
        except ValueError:
            continue
        if (first - d).days <= CLUSTER_DAYS:
            continue
        extra.append({
            "acceptedEt": datetime(d.year, d.month, d.day, hh, mm, tzinfo=sec.ET_TZ),
            "accession": "",
            "inferred": True,
        })
    return (extra + filings)[-MAX_EVENTS:]


def past_reactions(filings: list[dict], series: list) -> list[dict]:
    """정리된 발표 목록 + chartSeries → 최근 MAX_EVENTS 개 반응."""
    rows = [r for r in (series or []) if isinstance(r, list) and len(r) >= 6 and r[5] and r[3]]
    dates = [str(r[5])[:10] for r in rows]
    events = []
    for f in filings:
        acc = f["acceptedEt"]
        i = reaction_index(dates, acc)
        if i <= 0:
            continue
        gap = (date.fromisoformat(dates[i]) - acc.date()).days
        if gap > MAX_REACTION_GAP:
            continue
        prev_c, c = float(rows[i - 1][3]), float(rows[i][3])
        if prev_c <= 0:
            continue
        ev = {
            "filedEt": acc.strftime("%Y-%m-%d") if f.get("inferred") else acc.strftime("%Y-%m-%d %H:%M"),
            "session": session_of(acc),
            "reactionDate": dates[i],
            "movePct": round((c / prev_c - 1) * 100, 2),
        }
        if f.get("inferred"):
            ev["inferred"] = True  # 날짜=야후 이력, 시점=8-K 패턴 추정
        events.append(ev)
    return events[-MAX_EVENTS:]


def summarize(events: list[dict]) -> dict | None:
    if not events:
        return None
    absm = [abs(e["movePct"]) for e in events]
    return {
        "n": len(events),
        "inferred": sum(1 for e in events if e.get("inferred")),
        "avgAbsPct": round(sum(absm) / len(absm), 2),
        "medianAbsPct": round(statistics.median(absm), 2),
        "maxAbsPct": round(max(absm), 2),
        "events": list(reversed(events)),  # 최신 먼저
    }


def next_weekday(d: date) -> date:
    d = d + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def upcoming_session(next_date: str, yahoo_quote: dict | None, past: list[dict]) -> tuple[str, str]:
    """(session, source). session: bmo/amc/unknown."""
    q = yahoo_quote or {}
    ts = q.get("earningsTimestamp") or q.get("earningsTimestampStart")
    if ts and not q.get("isEarningsDateEstimate"):
        et = datetime.fromtimestamp(int(ts), timezone.utc).astimezone(sec.ET_TZ)
        if et.date().isoformat() == next_date and not (et.hour == 0 and et.minute == 0):
            s = session_of(et)
            if s in ("bmo", "amc"):
                return s, "yahoo"
    recent = [e["session"] for e in past[-4:] if e.get("session") in ("bmo", "amc")]
    if len(recent) >= 2 and len(set(recent)) == 1 and len(recent) == len(past[-4:]):
        return recent[0], "history"
    return "unknown", ""


def expected_reaction_day(next_date: str, session: str) -> date:
    d = date.fromisoformat(next_date)
    if session == "bmo":
        return d if d.weekday() < 5 else next_weekday(d)
    # 장후 또는 미상 → 다음 평일(미상이면 두 경우 모두를 포함하는 보수적 선택)
    return next_weekday(d)


def pick_expiry(expirations: list[int], reaction_day: date) -> int | None:
    """반응일 당일 또는 이후의 첫 만기(야후 expirationDates = 만기일 UTC 자정)."""
    for ts in sorted(expirations or []):
        d = datetime.fromtimestamp(int(ts), timezone.utc).date()
        if d >= reaction_day:
            return int(ts)
    return None


def weekdays_between(a: date, b: date) -> int:
    """a 초과 b 이하 평일 수(반응일 뒤 만기까지 더 들어간 거래일 근사)."""
    n, d = 0, a
    while d < b:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return n


# ---------------------------------------------------------------------------
# 수집
# ---------------------------------------------------------------------------

def load_upcoming(horizon_days: int) -> list[dict]:
    if not CALENDAR.exists():
        return []
    payload = json.loads(CALENDAR.read_text(encoding="utf-8"))
    today = sec.et_today()
    end = today + timedelta(days=horizon_days)
    rows = []
    for r in payload.get("earnings") or []:
        nd = str(r.get("nextDate") or "")[:10]
        try:
            d = date.fromisoformat(nd)
        except ValueError:
            continue
        if today <= d <= end and r.get("ticker"):
            rows.append({"ticker": str(r["ticker"]).upper(), "nextDate": nd})
    return rows


def load_detail(ticker: str) -> dict:
    from earnings_history_store import safe_name
    path = DETAILS_DIR / f"{safe_name(ticker)}.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _filings_from_block(r: dict) -> list[dict]:
    out = []
    forms = r.get("form") or []
    for i, form in enumerate(forms):
        if form != "8-K":
            continue
        items = str((r.get("items") or [""] * len(forms))[i] or "")
        if "2.02" not in items.split(","):
            continue
        acc = parse_acceptance((r.get("acceptanceDateTime") or [""] * len(forms))[i])
        if not acc:
            continue
        out.append({"acceptedEt": acc, "accession": r["accessionNumber"][i]})
    return out


def sec_earnings_filings(cik: int, *, years: int = 3, max_extra_files: int = 3) -> list[dict]:
    """최근 `years` 년의 8-K Item 2.02 제출(시각 오름차순).

    submissions 의 recent 블록은 최근 1,000건뿐이라 JPM 처럼 채권 발행 서류가 많은
    회사는 1년 치밖에 안 들어 있다(실측: JPM 2.02 가 4건만 잡힘). 모자라면 과거 분할
    파일(filings.files)을 기간이 닿는 것만 최대 몇 개 더 읽는다."""
    data = sec.sec_get_json(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json")
    filings = data.get("filings") or {}
    out = _filings_from_block(filings.get("recent") or {})
    cutoff = (sec.et_today() - timedelta(days=365 * years)).isoformat()
    if len(out) < MAX_EVENTS + 2:
        extra = 0
        for f in filings.get("files") or []:
            if extra >= max_extra_files or str(f.get("filingTo") or "") < cutoff:
                continue
            try:
                block = sec.sec_get_json(f"https://data.sec.gov/submissions/{f['name']}")
            except Exception as exc:  # noqa: BLE001
                print(f"    [경고] 분할 파일 {f.get('name')} 실패: {exc}")
                continue
            extra += 1
            out.extend(_filings_from_block(block))
    seen, uniq = set(), []
    for f in sorted(out, key=lambda f: f["acceptedEt"]):
        if f["accession"] in seen or f["acceptedEt"].date().isoformat() < cutoff:
            continue
        seen.add(f["accession"])
        uniq.append(f)
    return uniq


class OptionsSource:
    """build_options_stats 의 Yahoo 세션·계산을 그대로 쓴다."""

    def __init__(self):
        from build_options_stats import Yahoo
        self.y = Yahoo()
        self.ok = self.y.auth()

    def chain(self, ticker: str, ts: int | None = None) -> dict | None:
        if not self.ok:
            return None
        if ts is None:
            return self.y.options(ticker)
        url = (f"https://query1.finance.yahoo.com/v7/finance/options/{urllib.parse.quote(ticker)}"
               f"?date={int(ts)}&crumb={urllib.parse.quote(self.y.crumb)}")
        try:
            data = json.loads(self.y._get(url))
        except Exception:
            return None
        res = (data.get("optionChain") or {}).get("result") or []
        return res[0] if res else None


def options_for(src: OptionsSource, ticker: str, reaction_day: date, fallback: dict | None):
    """(options dict | None, yahoo quote | None, note)."""
    from build_options_stats import expected_move_pct, parse_leg
    base = src.chain(ticker)
    time.sleep(0.25)
    if base:
        quote = base.get("quote") or {}
        ts = pick_expiry(base.get("expirationDates") or [], reaction_day)
        if ts is None:
            return None, quote, "반응일 이후 만기가 체인에 없음"
        opts = base.get("options") or []
        first = opts[0] if opts else {}
        chain = first if first.get("expirationDate") == ts else None
        if chain is None:
            res = src.chain(ticker, ts)
            time.sleep(0.25)
            chain = ((res or {}).get("options") or [{}])[0] if res else None
        price = quote.get("regularMarketPrice")
        if not chain or not price:
            return None, quote, "체인 조회 실패"
        em = expected_move_pct(parse_leg(chain.get("calls")), parse_leg(chain.get("puts")), float(price))
        if em is None:
            return None, quote, "등가격 호가 없음"
        exp_d = datetime.fromtimestamp(ts, timezone.utc).date()
        return {
            "expiry": exp_d.isoformat(),
            "expectedMovePct": em,
            "price": round(float(price), 2),
            "firstExpiryAfterReaction": True,
            "extraWeekdays": weekdays_between(reaction_day, exp_d),
            "source": "yahoo-chain",
        }, quote, ""
    if fallback and fallback.get("expectedMovePct") is not None and fallback.get("expiry"):
        exp_d = date.fromisoformat(fallback["expiry"])
        if exp_d >= reaction_day:
            return {
                "expiry": fallback["expiry"],
                "expectedMovePct": fallback["expectedMovePct"],
                "price": fallback.get("price"),
                "firstExpiryAfterReaction": None,  # 확인 불가
                "extraWeekdays": weekdays_between(reaction_day, exp_d),
                "source": "options_stats",
            }, None, ""
        return None, None, "옵션 심리 패널의 만기가 실적 반응일보다 먼저 끝남 — 비교 제외"
    return None, None, "옵션 데이터 없음"


def build(horizon_days: int, limit: int) -> dict | None:
    upcoming = load_upcoming(horizon_days)[:limit]
    print(f"  다가오는 실적 {len(upcoming)}종목 (향후 {horizon_days}일)")
    if not upcoming:
        return None
    _, ticker_to_cik = sec.company_ticker_maps()
    fallback_opts = {}
    if OPTIONS_STATS.exists():
        try:
            fallback_opts = json.loads(OPTIONS_STATS.read_text(encoding="utf-8")).get("stocks") or {}
        except Exception:
            fallback_opts = {}
    src = OptionsSource()
    if not src.ok:
        print("  [경고] 야후 옵션 인증 실패 — options_stats.json 값으로 대체(만기 확인 불가 표시)")

    stocks = {}
    sec_fail = 0
    for row in upcoming:
        t = row["ticker"]
        detail = load_detail(t)
        series = detail.get("chartSeries") or []
        hist_dates = [e.get("date") for e in (detail.get("earningsHistory") or [])]
        cik = ticker_to_cik.get(t) or ticker_to_cik.get(t.replace("-", "."))
        events: list[dict] = []
        if cik:
            try:
                filings = cluster_filings(sec_earnings_filings(cik), hist_dates)
                filings = backfill_from_history(filings, hist_dates)
                events = past_reactions(filings, series)
            except Exception as exc:  # noqa: BLE001
                sec_fail += 1
                print(f"    [경고] {t} SEC 조회 실패: {exc}")
        past = summarize(events)
        # 발표 시점은 먼저 과거 패턴으로 가정해 만기를 고르고, 야후 체인의 quote 로 확정한다.
        session, session_src = upcoming_session(row["nextDate"], None, events)
        reaction_day = expected_reaction_day(row["nextDate"], session)
        opt, quote, note = options_for(src, t, reaction_day, fallback_opts.get(t))
        if quote:
            s2, src2 = upcoming_session(row["nextDate"], quote, events)
            if (s2, src2) != (session, session_src):
                session, session_src = s2, src2
                rd2 = expected_reaction_day(row["nextDate"], session)
                if rd2 != reaction_day:
                    reaction_day = rd2
                    opt, _, note = options_for(src, t, reaction_day, fallback_opts.get(t))
        if not past and not opt:
            continue
        stocks[t] = {
            "nextDate": row["nextDate"],
            "session": session,
            "sessionSource": session_src,
            "reactionDate": reaction_day.isoformat(),
            "past": past,
            "options": opt,
            "optionsNote": note or None,
        }
        print(f"    {t} {row['nextDate']} {session:8s} 과거 {past['avgAbsPct'] if past else '—'}%"
              f"(n={past['n'] if past else 0}) · 옵션 {opt['expectedMovePct'] if opt else '—'}%"
              f"{' ' + opt['expiry'] if opt else ''}")
    if not stocks:
        return None
    if sec_fail > len(upcoming) * 0.5:
        print(f"  [중단] SEC 조회 실패 {sec_fail}/{len(upcoming)} — 과거 반응을 믿을 수 없다")
        return None
    return {
        "updatedAtKst": sec.kst_now_str(),
        "source": "SEC EDGAR 8-K Item 2.02 제출 시각 · 일봉 종가(data/details) · Yahoo 옵션 체인",
        "note": "과거 반응 = 발표 뒤 첫 정규장 종가 등락률의 절댓값 평균(최대 8회). "
                "예상변동폭 = 반응일 이후 첫 만기 ATM 스트래들/현재가. 매매 판단이 아닌 숫자 비교.",
        "horizonDays": horizon_days,
        "count": len(stocks),
        "stocks": stocks,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="실적 전 과거 반응 vs 옵션 예상변동폭")
    ap.add_argument("--horizon", type=int, default=21, help="향후 며칠 안의 실적 발표까지")
    ap.add_argument("--limit", type=int, default=80)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    print("=== 실적 전 과거 반응 vs 옵션 예상변동폭 ===")
    try:
        payload = build(args.horizon, args.limit)
    except Exception as exc:  # noqa: BLE001
        print(f"[중단] 수집 실패({type(exc).__name__}: {exc}) — 기존 파일 유지")
        return 1
    if not payload:
        print("[중단] 유효 데이터 없음 — 기존 파일 유지")
        return 1
    from briefing_store import repository_publish_lock
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "EARNINGS_MOVE_COMPARE", payload, indent=None)
        print(f"Wrote {OUT_JSON.name} — {payload['count']}종목")
        if args.push and not sec.git_publish(
                ["data/earnings_move_compare.json", "data/earnings_move_compare.js"],
                "earnings move compare"):
            print("[중단] push 실패 — 발행되지 않았다")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
