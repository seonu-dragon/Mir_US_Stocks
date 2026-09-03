"""55개 `scripts/build_*.py` 에 공통으로 적용되는 계약 테스트.

여기서 검사하는 것은 CLAUDE.md '데이터 파이프라인' 절의 규약이다:

1. import 만으로 깨지지 않는다(네트워크·키 없이도).
2. cp949 콘솔 가드(`sys.stdout.reconfigure`)를 선언한다 — 없으면 한글 print 하나에
   Windows 러너에서 빌더가 통째로 죽는다.
3. 원자적으로 쓴다(`briefing_store.atomic_write_text` 또는 그것을 감싼
   `sec_client.write_data`). 중간에 죽어도 반쪽 JSON 을 남기지 않는다.
4. `.json` / `.js` 를 쌍으로 쓰고 `.js` 는 `window.<GLOBAL> = ` 전역이다.
5. 0건으로 기존 파일을 덮지 않는다 — 공유 경로(`write_data`)가 중앙에서 막고,
   아직 직접 쓰는 빌더는 아래 고정 목록으로 동결한다(더 늘리지 말 것).

실행: py -m pytest -q scripts/tests/test_builder_contracts.py
"""
from __future__ import annotations

import ast
import re

import pytest

from conftest import BUILDER_NAMES, SCRIPTS, builder_source, import_builder

# ---------------------------------------------------------------------------
# 2026-09-03 기준 '직접 쓰기' 빌더 동결 목록.
# 이들은 sec_client.write_data 대신 atomic_write_text 를 직접 부르므로 0건 방어를
# 공유받지 못한다. 원자성은 지키지만, 소스가 죽은 날 빈 파일을 발행할 여지가 남는다.
# **목록을 늘리지 말 것** — 새 빌더는 write_data 로 쓴다. 하나씩 옮길 때마다 여기서 뺀다.
LEGACY_DIRECT_WRITERS = frozenset({
    "build_13f_snapshot",
    "build_breakout_retest",
    "build_cftc_cot",
    "build_congress_trades",
    "build_federal_contracts",
    "build_finra_short_volume",
    "build_insider_trades",
    "build_kiwoom_exports",
    "build_kr_consensus",
    "build_kr_corp_disclosures",
    "build_kr_corp_groups",
    "build_kr_disclosure_stats",
    "build_kr_earnings_reactions",
    "build_kr_ecos_macro",
    "build_kr_financials_history",
    "build_kr_gov_contracts",
    "build_kr_investor_flow",
    "build_kr_krx_metrics",
    "build_kr_nps_holdings",
    "build_kr_trade_exports",
    "build_leveraged_etf_catalog",
    "build_macro_indicators",
    "build_map_fundamentals",
    "build_market_history",
    "build_options_stats",
    "build_pattern_stats",
    "build_sec_ftd",
    "build_sentiment_gauges",
    "build_sitemap",
    "build_sr_stats",
    "build_today_content",  # market_snapshot 을 mkstemp+os.replace 로 직접 다시 쓴다
    "build_treasury_auctions",
    "build_us_analyst_consensus",
    "build_us_dividends_calendar",
    "build_us_financials_history",
    "build_us_finnhub_metrics",
    "build_wiki_attention",
    "build_wsb_sentiment",
    "build_yield_curve",
})

# .js 전역을 만들지 않는 빌더(파이썬 빌더만 읽는 상태 파일·xml·이미지 덱 등).
NO_JS_GLOBAL = frozenset({
    "build_breakout_retest",       # data/breakout_retest_stats.json (프론트가 json 직접 fetch)
    "build_kiwoom_exports",        # 로컬 CLI 산출물(노션 업로드용)
    "build_kr_audit_opinion",      # 주간 상태 파일
    "build_kr_corp_disclosures",   # 파일명이 동적(회사별)
    "build_kr_financials_history",
    "build_kr_krx_metrics",        # fundamentals 로 흡수돼 스냅샷에 부착된다
    "build_map_fundamentals",
    "build_pattern_stats",
    "build_sitemap",               # sitemap.xml
    "build_sr_stats",
    "build_today_content",         # market_snapshot 을 다시 쓴다(자체 원자 writer)
    "build_us_financials_history",
    "build_us_finnhub_metrics",
})


def _write_calls(name: str):
    """(함수명, 인자 요약) 목록. atomic_write_text / write_data 호출만."""
    tree = ast.parse(builder_source(name))
    found = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        fname = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        if fname in {"atomic_write_text", "write_data"}:
            found.append((fname, node))
    return found


@pytest.mark.parametrize("name", BUILDER_NAMES)
def test_imports_cleanly(name):
    """import 만으로 네트워크·API 키·파일을 요구하면 안 된다."""
    module = import_builder(name)
    assert module.__file__


@pytest.mark.parametrize("name", BUILDER_NAMES)
def test_declares_cp949_stdout_guard(name):
    """Windows 콘솔(cp949)에서 한글 print 로 죽지 않도록 재설정을 선언한다."""
    source = builder_source(name)
    assert "reconfigure(" in source, f"{name}: sys.stdout.reconfigure 가드 없음"
    assert re.search(r'sys\.platform\s*==\s*"win32"', source), (
        f"{name}: win32 분기 없이 reconfigure 를 부른다"
    )


@pytest.mark.parametrize("name", BUILDER_NAMES)
def test_writes_atomically(name):
    """부분 파일을 남기지 않는 경로로만 쓴다."""
    calls = _write_calls(name)
    source = builder_source(name)
    own_atomic = "mkstemp(" in source and "os.replace(" in source
    assert calls or own_atomic, (
        f"{name}: atomic_write_text / write_data 도, mkstemp+os.replace 도 없다"
    )
    assert ".write_text(" not in source, f"{name}: 원자적이지 않은 write_text 직접 호출"


@pytest.mark.parametrize("name", sorted(set(BUILDER_NAMES) - NO_JS_GLOBAL))
def test_publishes_json_js_pair(name):
    """`.json` 과 `.js` 를 같은 이름으로 쌍으로 쓴다(한쪽만 쓰면 브라우저나 증분빌드가 깨진다)."""
    module = import_builder(name)
    out_json = getattr(module, "OUT_JSON", None)
    out_js = getattr(module, "OUT_JS", None)
    if out_json is None and out_js is None:
        pytest.skip(f"{name}: OUT_JSON/OUT_JS 상수를 쓰지 않는 빌더")
    assert out_json is not None and out_js is not None, f"{name}: json/js 중 한쪽만 선언"
    assert out_json.suffix == ".json" and out_js.suffix == ".js"
    assert out_json.with_suffix("") == out_js.with_suffix(""), (
        f"{name}: {out_json.name} 와 {out_js.name} 의 이름이 다르다"
    )


@pytest.mark.parametrize("name", sorted(set(BUILDER_NAMES) - NO_JS_GLOBAL))
def test_js_payload_is_window_global(name):
    """`.js` 는 `window.<GLOBAL> = ...;` 형태여야 한다(app.js FEATURE_DATA 계약)."""
    source = builder_source(name)
    via_write_data = any(
        fname == "write_data" for fname, _ in _write_calls(name)
    )
    if via_write_data:
        # write_data 는 js_var 를 문자열 상수로 받는다 — 대문자 전역명인지 확인.
        for fname, node in _write_calls(name):
            if fname != "write_data" or len(node.args) < 3:
                continue
            var = node.args[2]
            assert isinstance(var, ast.Constant) and isinstance(var.value, str), (
                f"{name}: write_data 의 js_var 가 문자열 상수가 아니다"
            )
            assert re.fullmatch(r"[A-Z][A-Z0-9_]*", var.value), (
                f"{name}: 전역명 {var.value!r} 이 대문자 규약을 어긴다"
            )
        return
    assert re.search(r'window\.[A-Z][A-Z0-9_]*\s*=', source), (
        f"{name}: .js 에 window.<GLOBAL> = 접두가 없다"
    )


@pytest.mark.parametrize("name", BUILDER_NAMES)
def test_empty_source_does_not_overwrite(name):
    """0건 방어. 공유 경로(write_data)로 쓰거나, 동결 목록에 있어야 한다.

    write_data 는 `assert_not_emptying` 으로 '기존 파일에 내용이 있는데 이번엔 0건'
    일 때 SystemExit(1) 을 던진다. 직접 쓰는 빌더는 그 방어를 못 받으므로
    LEGACY_DIRECT_WRITERS 에 동결해 두고 새로 늘어나는 것만 막는다.
    """
    uses_write_data = any(fname == "write_data" for fname, _ in _write_calls(name))
    if uses_write_data:
        return
    assert name in LEGACY_DIRECT_WRITERS, (
        f"{name}: 새 빌더는 sec_client.write_data 로 써야 한다(0건 방어 공유). "
        "직접 atomic_write_text 를 쓰려면 그 이유와 함께 LEGACY_DIRECT_WRITERS 에 넣을 것"
    )


def test_legacy_direct_writer_list_is_current():
    """동결 목록이 실제와 어긋나면(옮겼는데 목록에 남아 있으면) 알려준다."""
    direct = {
        name for name in BUILDER_NAMES
        if not any(fname == "write_data" for fname, _ in _write_calls(name))
    }
    stale = sorted(LEGACY_DIRECT_WRITERS - direct)
    assert not stale, f"write_data 로 옮긴 빌더가 목록에 남아 있다: {stale}"


def test_every_builder_file_is_covered():
    """빌더가 새로 생기면 이 계약 테스트가 자동으로 그것도 검사한다."""
    on_disk = sorted(p.stem for p in SCRIPTS.glob("build_*.py"))
    assert on_disk == BUILDER_NAMES
    assert len(on_disk) >= 55
