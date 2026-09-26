#!/usr/bin/env python3
"""KR 종목별 수급 — 서술적 표시용.

무엇을 만드나:
  data/korea/investor_flow.{json,js}   종목별 외국인·기관·개인 순매수 + 외국인 보유율

## 신호가 아니다

validate_kr_flow.py 로 재봤다. 매일 종목을 수급으로 줄 세워 상위 10% 와 하위 10% 의
다음날 수익률 차이를 낸 뒤, 그 일별 스프레드 59개로 t 검정했다(같은 날 안에서
비교하므로 시장 전체 움직임은 자동 상쇄된다):

    외국인 순매수   일평균 +0.170%p   t=+1.39   무작위와 구분 안 됨
    기관 순매수     일평균 -0.099%p   t=-0.99   무작위와 구분 안 됨

한국 투자자가 가장 많이 보는 지표지만 다음날 수익률과는 무관하다. 그래서 '무슨 일이
있었나'(사실)로만 표시하고 '무슨 일이 일어날까'(예측)로 팔지 않는다.

## 컨센서스 목표주가는 뺐다

한때 같이 실으려 했는데, 네이버가 주는 목표가가 네이버 자신의 현재가와 맞지 않았다:

    삼성전자      현재가   255,000  목표가   513,958   (2.0배)
    콘텐트리중앙   현재가     1,493  목표가    11,875   (8.0배)

배율이 종목마다 달라 단위 착오도 아니다. 550종목 중 목표가가 현재가보다 낮은 건 1%
뿐이고 괴리율 중앙값이 +71.7% 였다(실제 국내 시장은 +20~30%대). 설명도 보정도 못 하는
수치를 '상승여력' 으로 내보내면 지어낸 것과 다르지 않다. 그래서 싣지 않는다.

같은 이유로 목표주가 이력도 쌓지 않는다 — 지금 모순된 값은 나중에도 검정에 못 쓴다.

## 데이터

  /trend?pageSize=20   외국인·기관·개인 순매수(수량) + 외국인 보유율 + 거래량

수급은 최대 60거래일까지 되지만(70+ 는 400, page 파라미터는 무시됨) 화면엔 5일·20일
합계면 충분하다. 60일을 다 실으면 2,601종목에 1MB 가 넘어 부팅 프리로드에 못 얹는다.

순매수는 '수량' 이라 종목 간 비교가 안 된다(삼성전자 100만주 ≠ 소형주 100만주).
거래량 대비 비율(frnPct)을 함께 낸다.

## 일별 행(daily) — 종목별 샤드, 크기 예산 하루 300KB

같은 응답의 20거래일 일별 행(날짜·종가·개인·외국인·기관 수량·외국인 보유율)을
data/korea/investor_flow_daily/sNN.json(16개)에 남긴다. 새 호출은 없다.

20일 창이 매일 한 칸씩 밀려 샤드는 거래일마다 전부 바뀐다 — 그 크기가 곧 하루 커밋
증가량이다(이 레포는 data 이력이 2.7GB 까지 불어 이력을 재작성한 적이 있다). 그래서:
  - 대상: 상세 파일이 있는 비ETF 종목 중 시가총액 상위 DAILY_MAX(480). 전 종목(2,588)은
    하루 약 2.2MB, 480종목이면 약 290KB 다(2026-09-26 실측). 대상 밖 종목은 화면이 5일·20일 누적만 보여 주고 한 줄로 안내한다
    (stocks[t].dy 가 대상 표시).
  - 형식: 샤드마다 날짜 목록을 한 번만 두고, 종목은 평평한 정수 배열
    [n, 기준전일종가, 종가(첫 값+차분)×n, 개인×n, 외국인×n, 기관×n, 보유율×100(첫 값+차분)×n,
    전일대비 보정×n(공식 전일대비 − 다음 행 종가와의 차 — 전부 0 이면 생략)].
    날짜가 샤드 공통 목록과 다른 종목(거래정지 등)만 own 에 자기 날짜를 둔다.
  - 내용이 같으면 파일을 다시 쓰지 않는다(주말·연휴 재실행에 커밋이 생기지 않게).
    그래서 샤드에는 실행 시각을 넣지 않는다.

외국인·기관 순매수 금액 상위(수량 × 종가, 추정)는 샤드 대상과 무관하게 전 종목 일별 행으로
여기서 계산해 investor_flow.json 의 top 에 싣는다(build_kr_market_funds.py 가 옮겨 싣는다).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
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

KST = ZoneInfo("Asia/Seoul")
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "korea" / "investor_flow.json"
OUT_JS = ROOT / "data" / "korea" / "investor_flow.js"
DAILY_DIR = ROOT / "data" / "korea" / "investor_flow_daily"
DAILY_SHARDS = 16
DAILY_MAX = 480              # 일별 표 대상 종목 수(시총 상위, 상세 파일 보유) — 하루 300KB 예산에 맞춘 값
DETAILS_DIR = ROOT / "data" / "korea" / "details"
TOP_N = 10
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://m.stock.naver.com/",
}
FLOW_DAYS = 20
MIN_INTERVAL = 0.12          # 실측 20/초도 통과하지만 남의 서버다 — 8/초로 낮춘다
_last = [0.0]


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def throttle():
    gap = MIN_INTERVAL - (time.monotonic() - _last[0])
    if gap > 0:
        time.sleep(gap)
    _last[0] = time.monotonic()


def fetch(url: str, tries: int = 3):
    for attempt in range(tries):
        throttle()
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None              # 상장폐지·펀드 — 재시도 의미 없다
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
        except Exception:
            if attempt == tries - 1:
                return None
            time.sleep(0.5 * (attempt + 1))
    return None


def qnum(v):
    """'-826,076' / '+5,211,886' / '46.59%' → float."""
    if v is None:
        return None
    s = str(v).replace(",", "").replace("%", "").replace("+", "").strip()
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def shard_of(code: str, n: int = DAILY_SHARDS) -> int:
    """티커 → 샤드 번호. kr-flow-core.js 의 shardOf 와 1:1 같아야 한다(valuation band 와 같은 해시)."""
    h = 0
    for ch in str(code):
        h = (h * 31 + ord(ch)) % 1000003
    return h % n


def signed_change(r: dict):
    """전일대비 — 문자열에 부호가 있으면 그대로, 없으면 등락 코드(1·2 상승 / 4·5 하락 / 3 보합)로."""
    v = qnum(r.get("compareToPreviousClosePrice"))
    if v is None:
        return None
    raw = str(r.get("compareToPreviousClosePrice") or "").strip()
    if raw.startswith("-") or raw.startswith("+"):
        return v if raw.startswith("+") else -abs(v)
    code = str((r.get("compareToPreviousPrice") or {}).get("code") or "")
    if code in ("4", "5"):
        return -abs(v)
    if code == "3":
        return 0.0
    return abs(v)


def daily_row(r: dict) -> list | None:
    """/trend 한 행 → [YYYYMMDD, 종가, 전일대비, 개인, 외국인, 기관, 외국인 보유율]. 날짜 없으면 None."""
    d = r.get("bizdate")
    if not d:
        return None
    def whole(v):
        return None if v is None else int(round(v))
    return [
        str(d),
        whole(qnum(r.get("closePrice"))),
        whole(signed_change(r)),
        whole(qnum(r.get("individualPureBuyQuant"))),
        whole(qnum(r.get("foreignerPureBuyQuant"))),
        whole(qnum(r.get("organPureBuyQuant"))),
        qnum(r.get("foreignerHoldRatio")),
    ]


def deltas(vals: list) -> list:
    """[a, b, c] → [a, b-a, c-b]. 결측은 None 으로 두고 다음 값은 직전 '유효' 값 기준으로 뺀다."""
    out, prev = [], None
    for v in vals:
        if v is None:
            out.append(None)
            continue
        out.append(v if prev is None else v - prev)
        prev = v
    return out


def encode_stock(rows: list) -> list:
    """일별 행(최신순) → 평평한 정수 배열. kr-flow-core.js decodeStock 과 짝."""
    n = len(rows)
    oldest = rows[-1] if rows else None
    p0 = (oldest[1] - oldest[2]) if oldest and oldest[1] is not None and oldest[2] is not None else None
    holds = [None if r[6] is None else int(round(r[6] * 100)) for r in rows]
    # 공식 전일대비는 '다음 행 종가와의 차' 와 가끔 다르다(기준가 조정 등 — 삼성전자 09-23: 전일대비
    # +10,000 인데 09-22 종가 차는 +9,000). 그 어긋남만 따로 둔다(대부분 0 이라 거의 공짜).
    adj = []
    for i, r in enumerate(rows):
        base = rows[i + 1][1] if i + 1 < n else p0
        if r[2] is None or r[1] is None or base is None:
            adj.append(None)
        else:
            adj.append(r[2] - (r[1] - base))
    out = [n, p0, *deltas([r[1] for r in rows]), *[r[3] for r in rows], *[r[4] for r in rows],
           *[r[5] for r in rows], *deltas(holds)]
    if any(a for a in adj):          # 보정이 전부 0/결측이면 열 자체를 생략(디코더가 0 으로 본다)
        out.extend(adj)
    return out


def daily_targets(stocks: list[dict], details_dir: Path = DETAILS_DIR, limit: int = DAILY_MAX) -> set[str]:
    """일별 표 대상: 상세 파일이 있는 비ETF 종목 중 시가총액 상위 limit."""
    have = {p.stem for p in details_dir.glob("*.json")} if details_dir.exists() else None
    ranked = sorted((s for s in stocks if s.get("sector") != "ETF"),
                    key=lambda s: s.get("marketCapB") or 0, reverse=True)
    out = []
    for s in ranked:
        t = str(s["ticker"]).zfill(6)
        if have is not None and t not in have:
            continue
        out.append(t)
        if len(out) >= limit:
            break
    return set(out)


def build_daily_shards(daily: dict[str, list], n_shards: int = DAILY_SHARDS) -> list[dict]:
    """샤드 페이로드 목록. 샤드마다 가장 긴 날짜 목록을 공통으로 둔다."""
    buckets: list[dict] = [{} for _ in range(n_shards)]
    for t, rows in daily.items():
        if rows:
            buckets[shard_of(t, n_shards)][t] = rows
    shards = []
    for book in buckets:
        dates: list[str] = []
        for t in sorted(book):
            if len(book[t]) > len(dates):
                dates = [r[0] for r in book[t]]
        payload = {"v": 1, "asOf": dates[0] if dates else None, "dates": dates, "t": {}, "own": {}}
        for t in sorted(book):
            rows = book[t]
            payload["t"][t] = encode_stock(rows)
            if [r[0] for r in rows] != dates[: len(rows)]:
                payload["own"][t] = [r[0] for r in rows]
        if not payload["own"]:
            del payload["own"]
        shards.append(payload)
    return shards


def write_daily_shards(daily: dict[str, list], directory: Path | None = None) -> tuple[list[str], int]:
    """샤드를 쓰되 내용이 같은 파일은 건드리지 않는다. 반환: (바뀐 파일의 레포 기준 경로, 바뀐 바이트 합)."""
    directory = directory or DAILY_DIR
    changed, changed_bytes = [], 0
    for i, payload in enumerate(build_daily_shards(daily)):
        f = directory / f"s{i:02d}.json"
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        try:
            if f.read_text(encoding="utf-8") == text:
                continue
        except OSError:
            pass
        atomic_write_text(f, text)
        changed.append(f.relative_to(ROOT).as_posix() if f.is_relative_to(ROOT) else str(f))
        changed_bytes += len(text.encode("utf-8"))
    return changed, changed_bytes


def compute_top(daily: dict[str, list], names: dict[str, str], n: int = TOP_N) -> dict | None:
    """외국인·기관 순매수/순매도 금액 상위 n(1일·5일). 금액 = Σ 수량 × 그날 종가(추정, 억 원)."""
    dates = sorted({r[0] for rows in daily.values() for r in rows[:5] if r and r[0]}, reverse=True)
    if not dates:
        return None
    latest5 = dates[:5]

    def iso(d):
        return f"{d[:4]}-{d[4:6]}-{d[6:8]}"

    out = {"asOf": iso(latest5[0]), "from5": iso(latest5[-1])}
    for key, wanted in (("d1", set(latest5[:1])), ("d5", set(latest5))):
        acc = {"frn": [], "org": []}
        for t, rows in daily.items():
            sums = {"frn": 0.0, "org": 0.0}
            hit = 0
            last_close, last_chg = None, None
            for r in rows:
                if len(r) < 6 or r[0] not in wanted or r[1] is None:
                    continue
                close = float(r[1])
                if last_close is None:           # 행은 최신순 — 첫 행이 가장 최근
                    last_close, last_chg = close, r[2]
                for col, idx in (("frn", 4), ("org", 5)):
                    if r[idx] is not None:
                        sums[col] += float(r[idx]) * close
                hit += 1
            if not hit:
                continue
            pct = None
            if last_chg is not None and last_close and last_close - float(last_chg) > 0:
                pct = round(float(last_chg) / (last_close - float(last_chg)) * 100, 2)
            for col in ("frn", "org"):
                acc[col].append({"t": t, "n": names.get(t, t), "a": round(sums[col] / 1e8, 1), "c": pct})
        sect = {}
        for col in ("frn", "org"):
            nz = [x for x in acc[col] if x["a"] != 0]
            sect[f"{col}Buy"] = sorted([x for x in nz if x["a"] > 0], key=lambda x: -x["a"])[:n]
            sect[f"{col}Sell"] = sorted([x for x in nz if x["a"] < 0], key=lambda x: x["a"])[:n]
        out[key] = sect
    return out


def summarize(rows: list[dict]) -> dict:
    """최근 5일·20일 순매수 합계와 거래량 대비 비율."""
    def total(key, n):
        vals = [r[key] for r in rows[:n] if r.get(key) is not None]
        return sum(vals) if vals else None

    out = {}
    for key, short in (("frn", "f"), ("org", "o"), ("ind", "i")):
        v5, v20 = total(key, 5), total(key, 20)
        if v5 is not None:
            out[f"{short}5"] = round(v5)
        if v20 is not None:
            out[f"{short}20"] = round(v20)
    vol20 = sum(r["vol"] for r in rows[:20] if r.get("vol"))
    # 수량은 종목 간 비교가 안 된다 — 거래량 대비 비율을 함께 낸다.
    if vol20 and out.get("f20") is not None:
        out["fPct"] = round(out["f20"] / vol20 * 100, 2)
    if vol20 and out.get("o20") is not None:
        out["oPct"] = round(out["o20"] / vol20 * 100, 2)
    for r in rows:
        if r.get("frnHold") is not None:
            out["hold"] = r["frnHold"]
            break
    if rows and rows[0].get("d"):
        out["asOf"] = rows[0]["d"]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="KR 수급")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    snap = json.loads(KR_SNAPSHOT.read_text(encoding="utf-8"))
    stocks = [s for s in snap.get("stocks") or [] if s.get("sector") != "ETF"]
    stocks.sort(key=lambda s: s.get("marketCapB") or 0, reverse=True)
    if args.limit:
        stocks = stocks[: args.limit]

    print(f"[수급] {len(stocks)}종목 · 초당 {1/MIN_INTERVAL:.0f}회 → "
          f"약 {len(stocks)*MIN_INTERVAL/60:.0f}분")

    out: dict[str, dict] = {}
    daily: dict[str, list] = {}
    t0 = time.time()
    for i, s in enumerate(stocks, 1):
        t = str(s["ticker"]).zfill(6)
        if i % 500 == 0:
            print(f"  {i}/{len(stocks)} … ({(time.time()-t0)/60:.0f}분)")
        # 수급 이력은 /trend 에만 있다. /integration 의 dealTrendInfos 는 5일치뿐이다.
        trend = fetch(f"https://m.stock.naver.com/api/stock/{t}/trend?pageSize={FLOW_DAYS}&page=1")
        rows = []
        drows = []
        for r in trend or []:
            dr = daily_row(r)
            if dr:
                drows.append(dr)
            rows.append({
                "d": r.get("bizdate"),
                "frn": qnum(r.get("foreignerPureBuyQuant")),
                "org": qnum(r.get("organPureBuyQuant")),
                "ind": qnum(r.get("individualPureBuyQuant")),
                "frnHold": qnum(r.get("foreignerHoldRatio")),
                "vol": qnum(r.get("accumulatedTradingVolume")),
            })
        rec = summarize(rows) if rows else {}

        if rec:
            out[t] = rec
        if drows:
            daily[t] = drows

    if not out:
        print("[수급] 수집 0건 — 기존 파일을 덮어쓰지 않는다.")
        return 1

    stamp = now_kst()
    targets = daily_targets(stocks)
    target_daily = {t: rows for t, rows in daily.items() if t in targets}
    daily_paths, daily_bytes = write_daily_shards(target_daily) if target_daily else ([], 0)
    for t in target_daily:
        if t in out:
            out[t]["dy"] = 1
    top = compute_top(daily, {str(s["ticker"]).zfill(6): s.get("company") or "" for s in stocks})
    print(f"[수급] 일별 샤드 대상 {len(target_daily)}종목 · 바뀐 샤드 {len(daily_paths)}개 · "
          f"{daily_bytes / 1024:.0f}KB")
    payload = {
        "updatedAtKst": stamp,
        "source": "네이버 금융 (수급 20거래일)",
        "note": "수급은 다음날 수익률과 무관하다(외국인 t=+1.39 · 기관 t=-0.99). "
                "사실 표시용이지 신호가 아니다.",
        "count": len(out),
        # 일별 행 샤드 수(0 이면 화면이 '일별 보기' 를 만들지 않는다 — 없는 파일을 요청하지 않게).
        "dailyShards": DAILY_SHARDS if target_daily else 0,
        "dailyAsOf": max((rows[0][0] for rows in target_daily.values() if rows), default=None),
        "dailyCount": len(target_daily),
        # 외국인·기관 순매수 금액 상위(전 종목, 수량 × 종가 추정). build_kr_market_funds.py 가 옮겨 싣는다.
        "top": top,
        "stocks": out,
    }
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, text)
    atomic_write_text(OUT_JS, "window.KR_INVESTOR_FLOW = " + text + ";")
    print(f"[수급] {len(out)}종목 · {(time.time()-t0)/60:.1f}분 · {len(text)/1024:.0f}KB")

    if args.push:
        import sec_client as sec
        with repository_publish_lock(ROOT):
            if not sec.git_publish(
                ["data/korea/investor_flow.json", "data/korea/investor_flow.js", *daily_paths],
                "KR investor flow",
            ):
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
