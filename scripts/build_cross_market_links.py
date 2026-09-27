"""국내↔미국 연관 종목 — 사람이 정한 관계 + 과거 수익률 상관으로 검증 (US·KR 공용 한 파일).

    py scripts/build_cross_market_links.py --push   # daily-market-snapshot · daily-korea-market-snapshot 말미
    py scripts/build_cross_market_links.py          # 로컬 확인(파일만 쓴다)

입력은 **이미 커밋된 파일뿐**이다(새 외부 호출 없음):
  - 두 시장 스냅샷(data/market_snapshot.json · data/korea/market_snapshot.json) — 이름·최근 등락·시총
  - 종목 상세(data/details/<T>.json · data/korea/details/<코드>.json)의 chartSeries
    [시가, 고가, 저가, 종가, 거래량, 날짜] 일봉(약 5년)

계산
1. 사람이 정한 관계(CURATED): 국내 종목 ↔ 미국 종목/ETF, 관계 유형(고객사·공급사·경쟁사·
   같은 업종·연관 산업)과 짧은 근거. 관계는 사람이 적은 것이고, 숫자는 아래 2가 계산한다.
2. 최근 1년 일간 로그수익률로
   - lagCorr : 미국 D일 → 국내 D+1일(국내 직전 거래일 종가 이후 열린 미국 세션을 모두 더함.
     국내가 연휴로 쉬면 그 사이 미국 세션이 합쳐진다). 국내 장이 미국 장보다 먼저 닫히므로
     '간밤 미국 → 오늘 국내' 방향이다.
   - sameCorr: 같은 날짜의 국내 D일 ↔ 미국 D일(국내 장이 먼저 닫힌다 → '오늘 국내 → 오늘 밤 미국').
   - *Ex     : 같은 구간의 미국 시장(SPY)을 통제한 편상관. 두 시장 대형주는 '간밤 미국장 전체'
     하나로 다 같이 움직여서 원 상관만 보면 아무 쌍이나 0.2~0.4 가 나온다. 이 관계가 그 공통분을
     넘어서는지 보는 건 편상관이다. 국내 지수(KODEX 200)로 빼지 않는 이유: 삼성전자·SK하이닉스가
     지수의 큰 몫이라 지수를 빼면 그 종목 자체가 지워진다. 국내 달력은 KODEX 200 일봉 날짜.
   - strength: 편상관 기준 strong(≥0.25) · moderate(≥ max(0.10, 2/√n)) · weak(그 미만) ·
     insufficient(표본 < MIN_N). weak 는 화면에 "관계 약함"으로 나간다 — 사람이 정한 관계라도
     데이터가 받쳐 주지 않으면 그렇게 적는다.
3. 자동 후보(source=auto): 국내 시총 상위 AUTO_KR_TOP × 미국 시총 상위 AUTO_US_TOP(+섹터 ETF)의
   SPY 통제 lagCorr 행렬에서 AUTO_MIN_CORR 이상인 쌍(국내 종목당 최대 AUTO_PER_KR, 전체 AUTO_MAX).
   후보가 약 5만 쌍이라 노이즈만으로도 최댓값이 0.2 근처까지 나온다(√(2ln M)/√n) — 문턱을
   그보다 높게 잡았고, 화면에는 '데이터로 찾은 후보 · 사람이 확인한 관계 아님'으로 구분해 표시한다.

과거 상관은 서술 통계다. 오늘·내일 주가를 예측하지 않는다.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

if sys.platform == "win32":
    # cp949 콘솔에서 한글 print 가 UnicodeEncodeError 로 죽어 빌드 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402
from briefing_store import repository_publish_lock  # noqa: E402

KST = ZoneInfo("Asia/Seoul")

OUT_JSON = ROOT / "data" / "cross_market_links.json"
OUT_JS = ROOT / "data" / "cross_market_links.js"
JS_GLOBAL = "CROSS_MARKET_LINKS"

US_SNAPSHOT = ROOT / "data" / "market_snapshot.json"
KR_SNAPSHOT = ROOT / "data" / "korea" / "market_snapshot.json"
US_DETAILS = ROOT / "data" / "details"
KR_DETAILS = ROOT / "data" / "korea" / "details"

US_BENCH = "SPY"
KR_BENCH = "069500"  # KODEX 200
WINDOW_DAYS = 365
MIN_UNIVERSE = 1000  # 스냅샷 종목 수가 이보다 적으면 붕괴로 보고 발행하지 않는다
MIN_N = 120
STRONG = 0.25
MODERATE_FLOOR = 0.10

AUTO_KR_TOP = 150
AUTO_US_TOP = 400
AUTO_MIN_CORR = 0.30
AUTO_PER_KR = 2
AUTO_MAX = 40
# 자동 후보에 넣는 미국 섹터·테마 ETF(시총 순위에 안 잡힌다).
AUTO_US_ETFS = ("SOXX", "SMH", "XLE", "XLF", "XLV", "XLI", "XLK", "XLB", "ITA", "URA", "LIT", "TAN", "XBI", "IBB", "JETS", "KRE")

TYPE_LABELS = {
    "customer": "고객사",
    "supplier": "공급사",
    "competitor": "경쟁사",
    "peer": "같은 업종",
    "theme": "연관 산업",
}

# (국내 코드, 미국 티커, 관계 유형, 근거). 유형은 '국내 종목 입장에서 미국 쪽이 무엇인가'.
# 근거는 공개 사업 관계·업종 사실만 적는다 — 주가 방향 서술 금지.
CURATED: tuple[tuple[str, str, str, str], ...] = (
    # 메모리
    ("005930", "NVDA", "customer", "HBM·메모리 공급처(AI 가속기)"),
    ("005930", "MU", "competitor", "D램·낸드 메모리 경쟁"),
    ("005930", "AMD", "customer", "HBM 공급처(AI 가속기)"),
    ("005930", "SOXX", "peer", "미국 반도체 지수 ETF"),
    ("000660", "NVDA", "customer", "HBM 주요 공급처"),
    ("000660", "MU", "competitor", "D램·HBM 경쟁"),
    ("000660", "AMD", "customer", "HBM 공급처(AI 가속기)"),
    ("000660", "SOXX", "peer", "미국 반도체 지수 ETF"),
    # 반도체 장비
    ("042700", "NVDA", "theme", "HBM 적층 장비(TC 본더) — 엔비디아향 HBM 공급망(간접)"),
    ("042700", "MU", "customer", "HBM TC 본더 공급처"),
    ("042700", "AMAT", "peer", "반도체 장비"),
    ("240810", "AMAT", "peer", "반도체 전공정 장비"),
    ("240810", "LRCX", "peer", "반도체 식각·증착 장비"),
    # 자동차
    ("005380", "TSLA", "competitor", "전기차 경쟁"),
    ("005380", "GM", "competitor", "미국 완성차 경쟁"),
    ("005380", "F", "competitor", "미국 완성차 경쟁"),
    ("000270", "TSLA", "competitor", "전기차 경쟁"),
    ("000270", "GM", "competitor", "미국 완성차 경쟁"),
    # 2차전지
    ("373220", "TSLA", "customer", "원통형 배터리 공급처"),
    ("373220", "GM", "customer", "합작 배터리 공장(얼티엄셀즈) 파트너"),
    ("373220", "ALB", "supplier", "리튬 원료"),
    ("006400", "RIVN", "customer", "배터리 공급처"),
    ("006400", "ALB", "supplier", "리튬 원료"),
    ("003670", "GM", "customer", "양극재 합작 파트너"),
    ("003670", "ALB", "peer", "2차전지 소재(리튬)"),
    ("247540", "ALB", "peer", "2차전지 소재(리튬)"),
    ("247540", "LIT", "peer", "리튬·배터리 ETF"),
    # 조선·해운
    ("009540", "LNG", "theme", "LNG 수출 → LNG 운반선 수요(직접 거래 아님)"),
    ("010140", "LNG", "theme", "LNG 수출 → LNG 운반선 수요(직접 거래 아님)"),
    ("042660", "LNG", "theme", "LNG 수출 → LNG 운반선 수요(직접 거래 아님)"),
    ("329180", "FRO", "theme", "유조선 선사 — 선박 발주 수요"),
    ("011200", "ZIM", "peer", "컨테이너 해운"),
    # 방산·항공우주
    ("012450", "LMT", "peer", "방산"),
    ("012450", "RTX", "peer", "방산·항공 엔진"),
    ("079550", "RTX", "peer", "유도무기·방공"),
    ("079550", "LMT", "peer", "방산"),
    ("064350", "GD", "peer", "지상 장비(전차)"),
    ("047810", "LMT", "peer", "항공기 제조(훈련기 공동개발 이력)"),
    ("047810", "BA", "peer", "항공기 제조"),
    # 원전·전력기기
    ("034020", "SMR", "customer", "소형모듈원전(SMR) 주기기 공급처"),
    ("034020", "CEG", "theme", "원전 운영 — 원전 수요"),
    ("034020", "CCJ", "theme", "우라늄 — 원전 연료"),
    ("034020", "BWXT", "peer", "원전 기자재"),
    ("052690", "SMR", "theme", "소형모듈원전 설계"),
    ("052690", "CEG", "theme", "원전 운영 — 원전 수요"),
    ("267260", "ETN", "peer", "전력기기(변압기·배전)"),
    ("267260", "GEV", "peer", "전력기기·송배전"),
    ("010120", "ETN", "peer", "전력기기(배전)"),
    ("010120", "VRT", "theme", "데이터센터 전력 인프라"),
    ("298040", "GEV", "peer", "전력기기·송배전"),
    # 바이오
    ("207940", "LLY", "theme", "글로벌 대형 제약 — 바이오의약품 위탁생산(CDMO) 수요"),
    ("207940", "NVO", "theme", "글로벌 대형 제약 — 바이오의약품 위탁생산(CDMO) 수요"),
    ("068270", "AMGN", "competitor", "바이오시밀러·오리지널 의약품 경쟁"),
    ("068270", "XBI", "peer", "미국 바이오 ETF"),
    # 부품·디스플레이
    ("009150", "AAPL", "customer", "적층세라믹콘덴서(MLCC)·카메라모듈 공급처"),
    ("011070", "AAPL", "customer", "카메라모듈 주요 공급처"),
    ("034220", "AAPL", "customer", "OLED·LCD 패널 공급처"),
    # 인터넷·게임
    ("035420", "GOOGL", "competitor", "검색·광고 경쟁"),
    ("035720", "META", "peer", "메신저·소셜 광고"),
    ("259960", "TTWO", "peer", "게임"),
    # 소재·에너지
    ("005490", "NUE", "peer", "철강"),
    ("005490", "ALB", "peer", "리튬 사업"),
    ("096770", "XOM", "peer", "정유"),
    ("096770", "VLO", "peer", "정유"),
    ("010950", "VLO", "peer", "정유"),
    ("009830", "FSLR", "competitor", "태양광 모듈"),
    ("009830", "ENPH", "theme", "태양광 — 같은 수요처(주거용)"),
    # 운송·금융
    ("003490", "DAL", "peer", "항공사"),
    ("003490", "UAL", "peer", "항공사"),
    ("003490", "BA", "supplier", "항공기 제조사"),
    ("105560", "JPM", "peer", "은행"),
    ("055550", "JPM", "peer", "은행"),
)


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


# ---------------------------------------------------------------------------
# 순수 계산 (테스트 대상)
# ---------------------------------------------------------------------------

def closes_from_chart(chart) -> list[tuple[str, float]]:
    """chartSeries([o,h,l,c,v,date] 행) → 날짜 오름차순 (날짜, 종가). 무효 행·중복 날짜는 버린다."""
    out: dict[str, float] = {}
    for row in chart or []:
        if not isinstance(row, (list, tuple)) or len(row) < 6:
            continue
        d, c = row[5], row[3]
        if not isinstance(d, str) or len(d) < 10:
            continue
        try:
            c = float(c)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(c) or c <= 0:
            continue
        out[d[:10]] = c
    return sorted(out.items())


def log_returns(closes: list[tuple[str, float]]) -> dict[str, float]:
    """(날짜, 종가) → {날짜: 직전 거래일 대비 로그수익률}. 첫날은 없다."""
    out: dict[str, float] = {}
    for (d0, c0), (d1, c1) in zip(closes, closes[1:]):
        out[d1] = math.log(c1 / c0)
    return out


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3 or n != len(ys):
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 1e-18 or syy <= 1e-18:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / math.sqrt(sxx * syy)


def partial_corr(xs: list[float], ys: list[float], zs: list[float]) -> float | None:
    """z(미국 시장 SPY)를 통제한 x·y 편상관. 두 대형주가 '미국장 전체' 하나로 같이 움직인 몫을 뺀다."""
    rxy, rxz, ryz = pearson(xs, ys), pearson(xs, zs), pearson(ys, zs)
    if rxy is None or rxz is None or ryz is None:
        return None
    den = (1 - rxz * rxz) * (1 - ryz * ryz)
    if den <= 1e-12:
        return None
    return (rxy - rxz * ryz) / math.sqrt(den)


def lag_spans(kr_days: list[str], us_cal: list[str]) -> list[tuple[str, tuple[str, ...]]]:
    """미국 D일 → 국내 다음 거래일 정렬 구간.

    국내 거래일 k 의 수익률(직전 국내 거래일 p 종가 → k 종가)에는 날짜가 p 이상 k 미만인 미국
    세션을 짝짓는다. 미국 D일 세션은 한국 시각 D+1일 새벽에 끝나므로 날짜가 p 인 미국 세션은
    국내 p 종가 뒤에 열리고 k 개장 전에 닫힌다. 국내가 연휴로 쉬면 그 사이 미국 세션이 모두 한
    구간에 들어가고(수익률은 합), 미국이 쉬어서 구간이 비면 그 날은 짝을 만들지 않는다.
    us_cal 은 미국 거래일 달력(SPY 일봉 날짜).
    """
    us_cal = sorted(us_cal)
    out = []
    j = 0
    for p, k in zip(kr_days, kr_days[1:]):
        while j < len(us_cal) and us_cal[j] < p:
            j += 1
        m = j
        ds = []
        while m < len(us_cal) and us_cal[m] < k:
            ds.append(us_cal[m])
            m += 1
        if ds:
            out.append((k, tuple(ds)))
    return out


def same_spans(kr_days: list[str], us_cal: list[str]) -> list[tuple[str, tuple[str, ...]]]:
    """같은 날짜의 국내 D일 ↔ 미국 D일(국내 장이 먼저 닫힌다 → '오늘 국내 → 오늘 밤 미국')."""
    cal = set(us_cal)
    return [(d, (d,)) for d in kr_days if d in cal]


def span_sum(ret: dict[str, float], ds: tuple[str, ...]) -> float | None:
    """구간의 로그수익률 합. 한 세션이라도 빠지면 None(그 날은 짝을 만들지 않는다)."""
    s = 0.0
    for d in ds:
        v = ret.get(d)
        if v is None:
            return None
        s += v
    return s


def aligned(kr_ret, us_ret, bench_ret, spans):
    """구간 목록 → (미국, 국내, SPY) 세 줄. 셋 다 있는 날만."""
    xs, ys, zs = [], [], []
    for k, ds in spans:
        y = kr_ret.get(k)
        x = span_sum(us_ret, ds)
        z = span_sum(bench_ret, ds)
        if x is None or y is None or z is None:
            continue
        xs.append(x)
        ys.append(y)
        zs.append(z)
    return xs, ys, zs


def classify(corr_ex: float | None, n: int) -> str:
    if corr_ex is None or n < MIN_N:
        return "insufficient"
    if corr_ex >= STRONG:
        return "strong"
    if corr_ex >= max(MODERATE_FLOOR, 2.0 / math.sqrt(n)):
        return "moderate"
    return "weak"


def window_days_for(kr_closes, end: str, window_days: int = WINDOW_DAYS) -> list[str]:
    """창 안의 국내 거래일 + 그 직전 거래일 1개(첫 수익률의 기준)."""
    start = (date.fromisoformat(end) - timedelta(days=window_days)).isoformat()
    days = [d for d, _ in kr_closes if start <= d <= end]
    prev = [d for d, _ in kr_closes if d < start]
    return ([prev[-1]] if prev else []) + days


def pair_stats(kr_closes, us_closes, us_bench_closes, *, kr_cal: list[str]) -> dict:
    """한 쌍의 상관 통계. 입력 일봉은 closes_from_chart 결과, kr_cal 은 window_days_for 결과(국내 달력)."""
    rnd = lambda v: None if v is None else round(v, 3)  # noqa: E731
    kr_r = log_returns(kr_closes)
    us_r = log_returns(us_closes)
    b_r = log_returns(us_bench_closes)
    us_cal = [d for d, _ in us_bench_closes]
    lx, ly, lz = aligned(kr_r, us_r, b_r, lag_spans(kr_cal, us_cal))
    sx, sy, sz = aligned(kr_r, us_r, b_r, same_spans(kr_cal[1:], us_cal))
    lag_ex = partial_corr(lx, ly, lz)
    same_ex = partial_corr(sx, sy, sz)
    return {
        "n": len(lx),
        "lagCorr": rnd(pearson(lx, ly)),
        "lagCorrEx": rnd(lag_ex),
        "sameCorr": rnd(pearson(sx, sy)),
        "sameCorrEx": rnd(same_ex),
        "strength": classify(lag_ex, len(lx)),
        "sameStrength": classify(same_ex, len(sx)),
    }


# ---------------------------------------------------------------------------
# 입출력
# ---------------------------------------------------------------------------

def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def load_closes(market: str, ticker: str, cache: dict) -> list[tuple[str, float]]:
    key = (market, ticker)
    if key in cache:
        return cache[key]
    base = KR_DETAILS if market == "kr" else US_DETAILS
    d = load_json(base / f"{ticker}.json")
    closes = closes_from_chart((d or {}).get("chartSeries"))
    cache[key] = closes
    return closes


def ticker_meta(row: dict | None, market: str) -> dict:
    if not row:
        return {}
    chg = row.get("changePct")
    out = {
        "name": row.get("company") or row.get("ticker"),
        "chg": round(float(chg), 2) if isinstance(chg, (int, float)) and math.isfinite(chg) else None,
        "date": row.get("priceDate"),
    }
    if market == "us" and str(row.get("sector") or "").upper() == "EXCHANGE TRADED FUNDS":
        out["etf"] = True
    return out


def auto_candidates(kr_rows, us_rows, cache, us_bench, kr_cal, taken: set) -> list[dict]:
    """SPY 통제 lagCorr 행렬에서 문턱 이상 쌍. numpy 가 없으면 건너뛴다(사람이 정한 관계만 발행)."""
    try:
        import numpy as np
    except ImportError:  # pragma: no cover - Actions 에는 yfinance 가 numpy 를 끌어온다
        print("[연관 종목] numpy 없음 — 자동 후보 생략")
        return []
    b_r = log_returns(us_bench)
    spans = [(k, ds) for k, ds in lag_spans(kr_cal, [d for d, _ in us_bench]) if span_sum(b_r, ds) is not None]
    if len(spans) < MIN_N:
        return []
    z = np.array([span_sum(b_r, ds) for _, ds in spans])

    def resid(vec):
        """z 로 회귀한 잔차(결측은 nan 유지)."""
        v = np.array([np.nan if x is None else x for x in vec], dtype=float)
        ok = ~np.isnan(v)
        if ok.sum() < MIN_N:
            return None
        zz = z[ok]
        vv = v[ok]
        var = zz.var()
        beta = float(((vv - vv.mean()) * (zz - zz.mean())).mean() / var) if var > 0 else 0.0
        out = np.full_like(v, np.nan)
        out[ok] = vv - vv.mean() - beta * (zz - zz.mean())
        return out

    kr_ok, kr_mat = [], []
    for row in kr_rows:
        r = log_returns(load_closes("kr", row["ticker"], cache))
        v = resid([r.get(k) for k, _ in spans])
        if v is not None:
            kr_ok.append(row["ticker"])
            kr_mat.append(v)
    us_ok, us_mat = [], []
    for row in us_rows:
        r = log_returns(load_closes("us", row["ticker"], cache))
        v = resid([span_sum(r, ds) for _, ds in spans])
        if v is not None:
            us_ok.append(row["ticker"])
            us_mat.append(v)
    if not kr_ok or not us_ok:
        return []
    K = np.array(kr_mat)
    U = np.array(us_mat)
    out = []
    for i, kt in enumerate(kr_ok):
        best = []
        for j, ut in enumerate(us_ok):
            if (kt, ut) in taken:
                continue
            mask = ~np.isnan(K[i]) & ~np.isnan(U[j])
            n = int(mask.sum())
            if n < MIN_N:
                continue
            x, y = U[j][mask], K[i][mask]
            sx, sy = x.std(), y.std()
            if sx <= 0 or sy <= 0:
                continue
            r = float(((x - x.mean()) * (y - y.mean())).mean() / (sx * sy))
            if r >= AUTO_MIN_CORR:
                best.append((r, ut, n))
        best.sort(reverse=True)
        for r, ut, n in best[:AUTO_PER_KR]:
            out.append({"kr": kt, "us": ut, "scanCorrEx": round(r, 3), "scanN": n})
    out.sort(key=lambda r: -r["scanCorrEx"])
    return out[:AUTO_MAX]


def build() -> tuple[dict | None, int]:
    us_snap = load_json(US_SNAPSHOT) or {}
    kr_snap = load_json(KR_SNAPSHOT) or {}
    us_rows = {s.get("ticker"): s for s in us_snap.get("stocks") or [] if s.get("ticker")}
    kr_rows = {s.get("ticker"): s for s in kr_snap.get("stocks") or [] if s.get("ticker")}
    if len(us_rows) < MIN_UNIVERSE or len(kr_rows) < MIN_UNIVERSE:
        print(f"[연관 종목] 스냅샷이 비정상(US {len(us_rows)} · KR {len(kr_rows)}) — 발행하지 않음")
        return None, 1
    cache: dict = {}
    kr_bench = load_closes("kr", KR_BENCH, cache)
    us_bench = load_closes("us", US_BENCH, cache)
    if len(kr_bench) < MIN_N or len(us_bench) < MIN_N:
        print("[연관 종목] 지수(KODEX 200 · SPY) 일봉이 없다 — 발행하지 않음")
        return None, 1
    end = kr_bench[-1][0]
    kr_cal = window_days_for(kr_bench, end)  # 국내 거래일 달력 = KODEX 200 일봉 날짜

    links: list[dict] = []
    skipped: list[str] = []
    for kr, us, typ, why in CURATED:
        if kr not in kr_rows or us not in us_rows:
            skipped.append(f"{kr}-{us}(스냅샷에 없음)")
            continue
        st = pair_stats(load_closes("kr", kr, cache), load_closes("us", us, cache), us_bench, kr_cal=kr_cal)
        links.append({"kr": kr, "us": us, "type": typ, "why": why, "source": "curated", **st})
    curated_ok = sum(1 for l in links if l["strength"] != "insufficient")
    if curated_ok < len(CURATED) * 0.5:
        print(f"[연관 종목] 계산 가능한 관계가 {curated_ok}/{len(CURATED)} — 종목 상세 일봉이 비정상. 발행하지 않음")
        return None, 1

    taken = {(l["kr"], l["us"]) for l in links}
    kr_top = sorted((r for r in kr_rows.values() if r.get("sector") != "ETF" and r["ticker"] != KR_BENCH),
                    key=lambda r: -(r.get("marketCapT") or r.get("marketCapB") or 0))[:AUTO_KR_TOP]
    us_top = sorted((r for r in us_rows.values() if str(r.get("sector") or "").upper() not in ("EXCHANGE TRADED FUNDS", "MISC")),
                    key=lambda r: -(r.get("marketCapB") or 0))[:AUTO_US_TOP]
    us_top += [us_rows[t] for t in AUTO_US_ETFS if t in us_rows]
    autos = auto_candidates(kr_top, us_top, cache, us_bench, kr_cal, taken)
    for a in autos:
        st = pair_stats(load_closes("kr", a["kr"], cache), load_closes("us", a["us"], cache), us_bench, kr_cal=kr_cal)
        kr_ind = kr_rows[a["kr"]].get("industry") or ""
        us_ind = us_rows[a["us"]].get("industry") or ""
        links.append({"kr": a["kr"], "us": a["us"], "type": "auto", "why": f"{kr_ind} ↔ {us_ind}".strip(" ↔"),
                      "source": "auto", **st})

    tickers = {"us": {}, "kr": {}}
    for l in links:
        tickers["kr"].setdefault(l["kr"], ticker_meta(kr_rows.get(l["kr"]), "kr"))
        tickers["us"].setdefault(l["us"], ticker_meta(us_rows.get(l["us"]), "us"))
    strengths: dict[str, int] = {}
    for l in links:
        if l["source"] == "curated":
            strengths[l["strength"]] = strengths.get(l["strength"], 0) + 1
    payload = {
        "updatedAtKst": now_kst(),
        "count": len(links),
        "curatedCount": sum(1 for l in links if l["source"] == "curated"),
        "autoCount": sum(1 for l in links if l["source"] == "auto"),
        "window": {"from": (date.fromisoformat(end) - timedelta(days=WINDOW_DAYS)).isoformat(), "to": end, "days": WINDOW_DAYS},
        "usAsOf": us_snap.get("priceDate"),
        "krAsOf": max((r.get("priceDate") or "" for r in kr_rows.values()), default="") or None,
        "thresholds": {"strong": STRONG, "moderateFloor": MODERATE_FLOOR, "minN": MIN_N, "autoMin": AUTO_MIN_CORR},
        "benchmarks": {"us": US_BENCH, "kr": KR_BENCH},
        "typeLabels": TYPE_LABELS,
        "method": ("일간 로그수익률, 최근 1년. 미국 D일→국내 다음 거래일(lagCorr), 같은 날짜 국내→미국(sameCorr). "
                   "강도는 같은 구간 미국 시장(SPY)을 통제한 편상관으로 판정."),
        "note": "관계는 사람이 정한 것(자동 후보 제외)이고 상관은 과거 서술 통계다. 예측·매매 신호가 아니다.",
        "strengths": strengths,
        "tickers": tickers,
        "links": links,
    }
    print(f"[연관 종목] 사람이 정한 관계 {payload['curatedCount']}쌍 ({strengths}) · 자동 후보 {payload['autoCount']}쌍"
          f" · 기간 {payload['window']['from']}~{end}")
    if skipped:
        print(f"  건너뜀 {len(skipped)}: {', '.join(skipped[:10])}")
    return payload, 0


def main() -> int:
    ap = argparse.ArgumentParser(description="국내↔미국 연관 종목(관계 + 수익률 상관)")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    payload, code = build()
    if payload is None:
        return code
    with repository_publish_lock(ROOT):
        sec.write_data(OUT_JSON, OUT_JS, "CROSS_MARKET_LINKS", payload, indent=1, min_ratio=0.5)
        print(f"[연관 종목] 저장: {OUT_JSON.relative_to(ROOT).as_posix()}")
        if args.push:
            rel = [p.relative_to(ROOT).as_posix() for p in (OUT_JSON, OUT_JS)]
            if not sec.git_publish(rel, "cross-market links"):
                return 1
    return code


if __name__ == "__main__":
    raise SystemExit(main())
