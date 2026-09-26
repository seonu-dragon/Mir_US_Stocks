"""국내 대표 PER 기준(최근 4분기 우선 → 연간) 계약.

2026-09-26: 네이버 연간 EPS(직전 사업연도)를 epsTtm 으로 담아 화면이 삼성전자 PER 을 43배로
보였다(네이버 표시 12.85배 = 현재가 ÷ 최근 4분기 EPS 22,292). 네트워크 없이 파서·기준 판정만 본다.
"""
from __future__ import annotations

import update_korea_data as K

# m.stock.naver.com/api/stock/005930/integration 의 totalInfos 일부(2026-09-26 실측 모양).
SAMSUNG_INTEGRATION = {
    "totalInfos": [
        {"code": "lastClosePrice", "key": "전일", "value": "276,500"},
        {"code": "per", "key": "PER", "value": "12.85배", "valueDesc": "2026.06."},
        {"code": "eps", "key": "EPS", "value": "22,292원", "valueDesc": "2026.06."},
        {"code": "cnsPer", "key": "추정PER", "value": "5.98배"},
        {"code": "cnsEps", "key": "추정EPS", "value": "47,922원"},
        {"code": "pbr", "key": "PBR", "value": "3.33배", "valueDesc": "2026.06."},
        {"code": "bps", "key": "BPS", "value": "86,052원", "valueDesc": "2026.06."},
    ]
}


def test_parse_integration_reads_ttm_values():
    out = K.parse_naver_integration(SAMSUNG_INTEGRATION)
    assert out["epsTtm"] == 22292.0
    assert out["epsTtmAsOf"] == "2026.06"
    assert out["peTtm"] == 12.85
    assert out["pbLatest"] == 3.33 and out["bpsLatest"] == 86052.0
    assert out["cnsPe"] == 5.98 and out["cnsEps"] == 47922.0


def test_parse_integration_loss_and_missing():
    payload = {"totalInfos": [
        {"code": "per", "value": "N/A", "valueDesc": "2026.06."},
        {"code": "eps", "value": "-1,234원", "valueDesc": "2026.06."},
        {"code": "cnsPer", "value": "-"},
    ]}
    out = K.parse_naver_integration(payload)
    assert out["epsTtm"] == -1234.0
    assert "peTtm" not in out and "cnsPe" not in out
    assert K.parse_naver_integration({}) == {}


def test_apply_basis_prefers_ttm():
    f = {"forwardPE": 5.96, "epsNextY": 47922.0}
    integ = K.parse_naver_integration(SAMSUNG_INTEGRATION)
    K.apply_kr_valuation_basis(f, annual_eps=6564.0, annual_bps=63997.0, annual_year=2025,
                               integ=integ, price=286500)
    assert f["peBasis"] == "ttm" and f["pe"] == 12.85
    assert f["epsTtm"] == f["eps"] == 22292.0
    assert f["epsAnnual"] == 6564.0 and f["epsAnnualYear"] == 2025
    assert f["pb"] == 3.33 and f["pbBasis"] == "quarter"
    assert f["forwardPE"] == 5.98  # 네이버 화면 추정 PER 우선


def test_apply_basis_falls_back_to_annual_at_current_price():
    f = {}
    K.apply_kr_valuation_basis(f, annual_eps=6564.0, annual_bps=63997.0, annual_year=2025,
                               integ={}, price=286500)
    assert f["peBasis"] == "annual" and f["peYear"] == 2025
    assert f["pe"] == round(286500 / 6564.0, 2)  # 연간 표의 '연말 주가' PER(18.27)이 아니다
    assert "epsTtm" not in f  # 연간 EPS 를 TTM 이라 부르지 않는다
    assert f["pbBasis"] == "annual"


def test_apply_basis_ttm_loss_has_no_pe():
    f = {}
    K.apply_kr_valuation_basis(f, annual_eps=800.0, annual_bps=None, annual_year=2025,
                               integ={"epsTtm": -1200.0}, price=10000)
    assert f["peBasis"] == "ttm" and "pe" not in f


def test_krx_attach_does_not_mask_ttm_loss():
    stock = {"ticker": "000001", "fundamentals": {"peBasis": "ttm", "epsTtm": -5.0}}
    payload = {"stocks": [stock]}
    metrics = {"000001": {"per": 12.0, "pbr": 1.1}}
    import json, tempfile, pathlib
    orig = K.ROOT
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        (root / "data" / "korea").mkdir(parents=True)
        (root / "data" / "korea" / "krx_metrics.json").write_text(
            json.dumps({"metrics": metrics}), encoding="utf-8")
        K.ROOT = root
        try:
            K.attach_krx_metrics(payload)
        finally:
            K.ROOT = orig
    fund = stock["fundamentals"]
    assert "pe" not in fund
    assert fund.get("pb") == 1.1 and fund.get("pbBasis") == "annual-krx"
