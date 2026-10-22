"""옵션 포지션(build_options_flow.py) 테스트 — 감마·GEX 집계·이상 거래·장 전 OI 0 방어(네트워크 없음)."""
import math
from datetime import datetime, timezone

import build_options_flow as F


def _c(k, kind, oi=100, vol=10, iv=0.3, mid=1.0):
    return {"k": k, "oi": oi, "vol": vol, "iv": iv, "mid": mid, "kind": kind}


def test_bs_gamma_peaks_at_the_money_and_guards():
    atm = F.bs_gamma(100, 100, 0.3, 30 / 365)
    assert atm > F.bs_gamma(100, 130, 0.3, 30 / 365) > 0
    assert F.bs_gamma(100, 100, 0, 0.1) == 0 and F.bs_gamma(0, 100, 0.3, 0.1) == 0
    # 알려진 값: S=K=100, σ=0.2, T=1, r=0.04 → d1=0.3, Γ=φ(0.3)/(100·0.2)
    assert math.isclose(F.bs_gamma(100, 100, 0.2, 1.0), math.exp(-0.045) / math.sqrt(2 * math.pi) / 20, rel_tol=1e-9)


def test_gex_profile_signs_walls_flip_and_band():
    contracts = [_c(90, "P", oi=5000), _c(95, "P", oi=2000), _c(100, "C", oi=1000), _c(105, "C", oi=8000), _c(200, "C", oi=10)]
    p = F.gex_profile(100.0, [(30 / 365, contracts)])
    by = {k: (c, pu) for k, c, pu in p["strikes"]}
    assert by[90][1] < 0 and by[90][0] == 0 and by[105][0] > 0
    assert p["callWall"] == 105 and p["putWall"] == 90
    assert p["flip"] in (100, 105)              # 누적 순GEX 가 음수 → 양수로 바뀌는 곳
    assert 200 not in by                         # ±15% 밖은 파일에서 뺀다
    assert F.gex_profile(100.0, [(0.1, [_c(100, "C", oi=0)])]) is None


def test_oi_published_rejects_premarket_chains():
    pre = [_c(100, "C", oi=0, vol=500), _c(105, "C", oi=0, vol=300), _c(95, "P", oi=10, vol=50)]
    post = [_c(100, "C", oi=900, vol=500), _c(105, "C", oi=0, vol=300), _c(95, "P", oi=10, vol=50)]
    assert F.oi_published(pre) is False and F.oi_published(post) is True
    assert F.oi_published([_c(100, "C", vol=0)]) is False


def test_fix_iv_replaces_outliers_with_expiry_median():
    cs = [_c(1, "C", iv=0.2), _c(2, "C", iv=0.4), _c(3, "C", iv=0.0001), _c(4, "P", iv=None)]
    assert F.fix_iv(cs) and [c["iv"] for c in cs] == [0.2, 0.4, 0.30000000000000004, 0.30000000000000004]
    assert F.fix_iv([_c(1, "C", iv=9.0)]) is False


def test_unusual_needs_oi_ratio_volume_and_premium():
    cs = [_c(100, "C", oi=1000, vol=5000, mid=2.0),     # 5배, $1,000,000 → 잡힘
          _c(105, "C", oi=4000, vol=5000, mid=2.0),     # 1.25배 → 아님
          _c(110, "P", oi=0, vol=9000, mid=5.0),        # OI 0 → 아님
          _c(115, "P", oi=100, vol=900, mid=50.0),      # 거래량 < 1,000 → 아님
          _c(120, "C", oi=100, vol=2000, mid=0.5)]      # $100,000 → 아님
    out = F.unusual("NVDA", "2026-10-30", cs)
    assert out == [["NVDA", "2026-10-30", "C", 100, 5000, 1000, 5.0, 30.0, 1000000]]


class _FakeYahoo:
    crumb = "x"

    def __init__(self, chains):
        self.chains = chains

    def options(self, t):
        return self.chains.get(t)

    def _get(self, url):
        raise RuntimeError("no network")


def test_build_with_single_expiry_and_premarket_skip(monkeypatch):
    now = datetime(2026, 10, 22, 21, 0, tzinfo=timezone.utc)
    exp = int(now.timestamp()) + 8 * 86400
    leg = lambda kind, oi: [{"strike": k, "openInterest": oi, "volume": 3000, "impliedVolatility": 0.3, "bid": 1.0, "ask": 1.2}
                            for k in (95.0, 100.0, 105.0)]
    good = {"quote": {"regularMarketPrice": 100.0}, "expirationDates": [exp],
            "options": [{"expirationDate": exp, "calls": leg("C", 1000), "puts": leg("P", 800)}]}
    pre = {"quote": {"regularMarketPrice": 50.0}, "expirationDates": [exp],
           "options": [{"expirationDate": exp, "calls": leg("C", 0), "puts": leg("P", 0)}]}
    monkeypatch.setattr(F, "universe", lambda top: ["AAA", "BBB"])
    p = F.build(1, client=_FakeYahoo({"AAA": good, "BBB": pre}), sleep_s=0, now=now)
    assert set(p["tickers"]) == {"AAA"} and p["count"] == 1
    a = p["tickers"]["AAA"]
    assert a["expiries"] == 1 and a["spot"] == 100.0 and len(a["strikes"]) == 3
    assert p["uoa"] and p["uoa"][0][0] == "AAA"
    monkeypatch.setattr(F, "universe", lambda top: ["BBB"])
    assert F.build(1, client=_FakeYahoo({"BBB": pre}), sleep_s=0, now=now) is None


def test_max_pain_minimizes_holder_payout():
    # 콜 OI 는 110 에, 풋 OI 는 90 에 몰림 → 100 에서 지급액 0
    cs = [_c(90, "P", oi=1000), _c(100, "C", oi=10), _c(100, "P", oi=10), _c(110, "C", oi=1000)]
    assert F.max_pain(cs) == 100
    # 지급액(S): S=90 → 콜 0 + 풋(100-90)*500=5000 / S=100 → 콜(100-90)*300=3000 / S=110 → 콜 20*300=6000
    cs2 = [_c(90, "C", oi=300), _c(100, "P", oi=500), _c(110, "C", oi=10)]
    assert F.max_pain(cs2) == 100
    assert F.max_pain([_c(90, "C", oi=0), _c(100, "P", oi=0), _c(110, "C", oi=0)]) is None   # OI 없으면 만들지 않는다
    assert F.max_pain([_c(90, "C"), _c(100, "P")]) is None                                     # 행사가 3개 미만


def test_build_emits_max_pain_for_nearest_expiry_only_for_covered(monkeypatch):
    now = datetime(2026, 10, 22, 21, 0, tzinfo=timezone.utc)
    exp = int(now.timestamp()) + 8 * 86400
    calls = [{"strike": k, "openInterest": oi, "volume": 3000, "impliedVolatility": 0.3, "bid": 1.0, "ask": 1.2}
             for k, oi in ((95.0, 10), (100.0, 10), (105.0, 5000))]
    puts = [{"strike": k, "openInterest": oi, "volume": 3000, "impliedVolatility": 0.3, "bid": 1.0, "ask": 1.2}
            for k, oi in ((95.0, 5000), (100.0, 10), (105.0, 10))]
    chain = {"quote": {"regularMarketPrice": 100.0}, "expirationDates": [exp],
             "options": [{"expirationDate": exp, "calls": calls, "puts": puts}]}
    monkeypatch.setattr(F, "universe", lambda top: ["AAA", "ZZZ"])
    p = F.build(1, client=_FakeYahoo({"AAA": chain}), sleep_s=0, now=now)
    a = p["tickers"]["AAA"]
    assert a["maxPain"] == 100.0 and a["maxPainExpiry"] == "2026-10-30"
    assert "ZZZ" not in p["tickers"]
