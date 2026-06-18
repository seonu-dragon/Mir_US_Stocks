"""
US Market Close – Main Pipeline
=================================
Runs daily at 06:00 KST (= US market just closed).
1. Scrapes US major indices, sector ETFs, macro (VIX/10Y/WTI), US news, social trending.
2. Feeds raw data into Gemini for an AI close-of-market briefing.
3. Stores result in Mir_US_Stocks/data/market_snapshot.json → ai_briefing.us_close
4. Pushes to GitHub.
5. Sends the report to Telegram.
"""

import sys
import time
import argparse
import requests
from datetime import datetime
from pathlib import Path

_PKG_DIR = Path(__file__).resolve().parent
_COMMON_DIR = _PKG_DIR.parent / "common"
for _path in (_COMMON_DIR, _PKG_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from scrapers import (
    fetch_us_indices,
    fetch_macro_indicators,
    fetch_sector_etf_performance,
    fetch_us_news,
    fetch_reddit_trending,
    fetch_stocktwits_trending,
    fetch_yahoo_trending,
)
from config import GEMINI_API_KEY, validate_config
from publish import publish_briefing_to_site
from telegram_bot import send_telegram_message, notify_briefing_status

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


# ── Gemini AI Analysis ────────────────────────────────────────────────

def generate_us_close_analysis(raw_data_text):
    """Gemini API로 미국 장마감 시황 분석 보고서를 생성합니다."""
    if not GEMINI_API_KEY:
        print("  [경고] GEMINI_API_KEY가 설정되어 있지 않아 AI 분석을 생략합니다.")
        return ""

    prompt = f"""너는 미국 월스트리트의 최고 장마감 시황 애널리스트이자 글로벌 매크로 헤지펀드 전략가다.
제공된 당일 미국 증시 마감 데이터(S&P 500, 나스닥, 다우, 러셀 2000 지수 종가/등락률, 11대 SPDR 섹터 ETF 변동, VIX 공포지수, 미국 국채 10년물 수익률, WTI 국제유가, 미국 현지 주요 뉴스, 소셜 미디어 트렌딩 종목)를 종합적으로 분석하여 명쾌하고 전문적인 미국 장마감 시황 브리핑을 작성해라.

[원천 데이터]
{raw_data_text}

[작성 지침 (절대 엄수)]
1. 당일 4대 지수의 움직임과 섹터 ETF 강약, 거시 지표(VIX, 금리, 유가)의 변동을 유기적으로 연계하여 '오늘 미국 증시가 왜 이렇게 움직였는지'를 날카롭게 분석해라.
2. 소셜 미디어(Reddit, Stocktwits)에서 특이하게 급등한 종목이 있다면 그 배경도 함께 언급해라.
3. 최종 출력 서식은 반드시 **텔레그램 호환 HTML 태그**로 작성해라. (Markdown 기호 *, **, # 등 사용 금지. <b>, <i>, <code>, <pre>, <blockquote>, <a> 등만 허용)
4. 레이아웃 규격 (반드시 다음 대제목 구조를 그대로 지켜서 한글로 작성해라. 지구본 이모지 🌐는 절대 쓰지 마라. 구조화된 개행과 계층 표시를 위해 ├─, └─ 특수문자를 적절히 활용해라):

🇺🇸 <b>미국 증시 장마감 4대 지수 요약</b>
├─ <b>S&P 500 / 나스닥:</b> (두 지수의 등락 원인과 장중 흐름 분석 2~3줄)
└─ <b>다우 / 러셀:</b> (대형 가치주와 중소형주의 방향성 및 차별화 포인트 2~3줄)

📊 <b>섹터별 ETF 강약 분석</b>
├─ <b>강세 섹터:</b> (가장 강했던 2~3개 섹터 ETF와 상승 배경 해설)
└─ <b>약세 섹터:</b> (가장 약했던 2~3개 섹터 ETF와 하락 배경 해설)

📈 <b>거시 지표 및 리스크 요인</b>
├─ <b>변동성/금리:</b> (VIX 움직임 + 10년물 국채수익률 변동의 의미 분석)
└─ <b>원자재/유가:</b> (WTI 유가 변동 배경과 에너지 섹터·인플레 연계 분석)

💬 <b>소셜 미디어 특이 종목 & 뉴스 해설</b>
├─ <b>주요 이슈:</b> (오늘 미국 현지 뉴스 중 시장을 가장 크게 움직인 핵심 뉴스 요약)
└─ <b>소셜 동향:</b> (Reddit/Stocktwits에서 언급이 폭발한 종목과 그 배경 2~3줄)

🎯 <b>내일 장전 전략 및 아시아 증시 영향 전망</b>
├─ <b>내일 전망:</b> (내일 미국 프리마켓 및 본장에서 주목할 포인트)
└─ <b>아시아 영향:</b> (오늘 미국 장 결과가 내일 한국/아시아 증시에 미칠 영향 예측 2~3줄)
"""

    models_config = [
        {"model": "gemini-3.5-flash",      "version": "v1beta"},
        {"model": "gemini-3.1-flash-lite",  "version": "v1beta"},
        {"model": "gemini-2.5-flash",       "version": "v1beta"},
        {"model": "gemini-flash-latest",    "version": "v1beta"},
    ]

    for cfg in models_config:
        model   = cfg["model"]
        version = cfg["version"]
        url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        payload = {"contents": [{"parts": [{"text": prompt}]}]}

        print(f"[AI 분석] {model} ({version}) 모델로 미국 장마감 시황 분석 생성 시도 중...")
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            if response.status_code == 200:
                return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            else:
                print(f"  [경고] {model} API 호출 실패 ({response.status_code}): {response.text[:100]}")
        except Exception as e:
            print(f"  [경고] {model} API 호출 중 예외 발생: {e}")
        time.sleep(2)

    print("  [경고] 모든 Gemini 모델 호출에 실패하여 AI 분석을 생략합니다.")
    return ""


# ── Snapshot & Git ────────────────────────────────────────────────────

def update_market_snapshot(us_close_html, reddit_data, stocktwits_data, yahoo_data):
    """Safely merge and publish ai_briefing.us_close plus social sentiment."""

    def mutate(data):
        data.setdefault("social_sentiment", {})
        data["social_sentiment"]["reddit"] = [
            {
                "ticker": it.get("ticker", ""),
                "name": it.get("name", ""),
                "mentions": it.get("mentions", 0),
                "change24h": ((it["mentions"] - it["mentions_prev"]) / it["mentions_prev"] * 100)
                if it.get("mentions_prev") else 0,
            }
            for it in reddit_data
        ]
        data["social_sentiment"]["stocktwits"] = [
            {"ticker": it.get("symbol", ""), "name": it.get("name", ""), "watchlist_count": it.get("watchlist_count", 0)}
            for it in stocktwits_data
        ]
        data["social_sentiment"]["yahoo"] = [
            {"ticker": it.get("symbol", ""), "name": it.get("name", ""), "price": it.get("price", "")}
            for it in yahoo_data
        ]

    return publish_briefing_to_site("us_close", us_close_html, "US Close", mutate)

def main():
    parser = argparse.ArgumentParser(description="미국 장마감 시황 브리핑 생성 및 텔레그램 발송")
    parser.add_argument("--test", action="store_true", help="텔레그램 발송 없이 콘솔에만 출력합니다.")
    args = parser.parse_args()

    print("=== 미국 장마감 시황 데이터 수집 시작 ===")
    try:
        validate_config(require_gemini=True, require_telegram=True)
    except ValueError as e:
        print(f"  [경고] {e}")

    today = datetime.now().strftime("%Y년 %m월 %d일 %H시 %M분")

    # 1. 데이터 수집
    print("  > 미국 주요 지수 종가 수집 중...")
    indices = fetch_us_indices()

    print("  > 거시 지표 (VIX / 10Y / WTI) 수집 중...")
    macro = fetch_macro_indicators()

    print("  > 섹터 ETF 등락률 수집 중...")
    sectors = fetch_sector_etf_performance()

    print("  > 미국 현지 뉴스 수집 중...")
    news_items = fetch_us_news()

    print("  > Reddit 인기 종목 수집 중...")
    reddit = fetch_reddit_trending()

    print("  > Stocktwits 인기 종목 수집 중...")
    stocktwits = fetch_stocktwits_trending()

    print("  > Yahoo Trending Tickers 수집 중...")
    yahoo = fetch_yahoo_trending()

    # ── Part 1: Raw data report ──
    rp = [
        f"<b>📊 [미국 증시 장마감 데이터 리포트] - {today}</b>",
        "━━━━━━━━━━━━━━━━━━━━━\n",
        "<b>🇺🇸 미국 주요 지수 종가</b>",
    ]
    for label, vals in indices.items():
        if vals:
            s = "+" if vals["change"] > 0 else ""
            rp.append(f"  - <b>{label}:</b> {vals['close']:,.2f} ({s}{vals['change']:,.2f}, {s}{vals['change_pct']:.2f}%)")
        else:
            rp.append(f"  - <b>{label}:</b> 데이터 수집 실패")
    rp.append("")

    rp.append("<b>📈 거시 지표</b>")
    for label, vals in macro.items():
        if vals:
            s = "+" if vals["change"] > 0 else ""
            rp.append(f"  - <b>{label}:</b> {vals['close']:.2f} ({s}{vals['change']:.2f}, {s}{vals['change_pct']:.2f}%)")
        else:
            rp.append(f"  - <b>{label}:</b> 데이터 수집 실패")
    rp.append("")

    rp.append("<b>📊 SPDR 섹터 ETF 등락률</b>")
    for label, vals in sectors.items():
        if vals:
            s = "+" if vals["change_pct"] > 0 else ""
            rp.append(f"  - <b>{label}:</b> {s}{vals['change_pct']:.2f}%")
        else:
            rp.append(f"  - <b>{label}:</b> 수집 실패")
    rp.append("")

    rp.append("<b>💬 소셜 트렌드 (상위 5)</b>")
    if reddit:
        for it in reddit[:5]:
            rp.append(f"  - <b>{it['ticker']}</b> ({it['name']}): 언급 {it['mentions']}회 ({it['change_str']} 24h)")
    else:
        rp.append("  Reddit 데이터 없음")
    rp.append("")

    rp.append("<b>📰 미국 현지 주요 뉴스</b>")
    if news_items:
        for idx, it in enumerate(news_items[:10], 1):
            title = it["title"].replace("<", "&lt;").replace(">", "&gt;")
            src   = f"[{it['source']}] "
            if it["link"]:
                rp.append(f"  {idx}. <a href='{it['link']}'>{title}</a> {src}")
            else:
                rp.append(f"  {idx}. {title} {src}")
    else:
        rp.append("  데이터 없음")

    rp.append("\n━━━━━━━━━━━━━━━━━━━━━")
    full_part1 = "\n".join(rp)

    # ── Raw data text for AI ──
    raw = []
    raw.append("=== 미국 주요 지수 종가 ===")
    for label, vals in indices.items():
        if vals:
            raw.append(f"{label}: {vals['close']:,.2f} (변동: {vals['change']:+,.2f}, 등락률: {vals['change_pct']:+.2f}%)")

    raw.append("\n=== 거시 지표 (VIX / 국채 10Y / WTI) ===")
    for label, vals in macro.items():
        if vals:
            raw.append(f"{label}: {vals['close']:.2f} (변동: {vals['change']:+.2f}, 등락률: {vals['change_pct']:+.2f}%)")

    raw.append("\n=== SPDR 섹터 ETF 당일 등락률 ===")
    for label, vals in sectors.items():
        if vals:
            raw.append(f"{label}: {vals['change_pct']:+.2f}%")

    raw.append("\n=== Reddit 인기 종목 ===")
    for it in reddit:
        raw.append(f"순위 {it['rank']}. {it['ticker']} ({it['name']}) - 언급 {it['mentions']}회, 24h 변동: {it['change_str']}")

    raw.append("\n=== Stocktwits 인기 종목 ===")
    for it in stocktwits:
        raw.append(f"순위 {it['rank']}. {it['symbol']} ({it['name']}) - Watchlist {it['watchlist_count']}회")

    raw.append("\n=== 주요 미국 현지 뉴스 ===")
    for it in news_items:
        raw.append(f"[{it['source']}] {it['title']}")

    raw_text = "\n".join(raw)

    # 2. AI 분석
    ai_text = generate_us_close_analysis(raw_text)

    # ── Part 2: AI briefing ──
    rp2 = [f"💡 <b>[미국 증시 장마감 시황 심층 브리핑]</b>\n"]
    if ai_text:
        rp2.append(ai_text)
    else:
        rp2.append("AI 요약 분석을 생성할 수 없습니다.")
    rp2.append("\n━━━━━━━━━━━━━━━━━━━━━")
    rp2.append("<i>* 미국 장 마감 후 AI가 실시간 분석한 보고서로 투자 권유가 아닙니다.</i>")
    full_part2 = "\n".join(rp2)

    # 3. Snapshot + Git
    combined = f"{full_part1}\n\n{full_part2}"
    published = update_market_snapshot(combined, reddit, stocktwits, yahoo)
    if not published:
        raise RuntimeError("미국 장마감 브리핑의 GitHub 게시 및 원격 검증에 실패했습니다.")

    # 완료 알림은 원격 브랜치 검증 후에만 출력합니다.
    print("[완료] 미국 장마감 시황이 GitHub와 웹사이트 데이터에 반영·검증되었습니다. (텔레그램 발송 생략)")
    return

    # 4. 출력 / 발송
    if args.test:
        import re
        def clean(t):
            t = t.replace("<b>","").replace("</b>","").replace("<i>","").replace("</i>","")
            t = t.replace("<code>","").replace("</code>","")
            t = t.replace("━━━━━━━━━━━━━━━━━━━━━", "=====================")
            t = re.sub(r"<a href='(.*?)'>(.*?)</a>", r"\2 (\1)", t)
            t = re.sub(r'<a href="(.*?)">(.*?)</a>', r"\2 (\1)", t)
            return t
        print("\n=== [테스트 모드] 미국 증시 장마감 데이터 (Part 1/2) ===")
        print(clean(full_part1))
        print("\n=== [테스트 모드] 미국 증시 장마감 심층 브리핑 (Part 2/2) ===")
        print(clean(full_part2))
    else:
        print("\n[발송] 텔레그램으로 미국 장마감 데이터 Part 1 전송 중...")
        s1 = send_telegram_message(full_part1)
        print("[성공]" if s1 else "[실패]", "Part 1 발송", "성공" if s1 else "실패")

        time.sleep(2.0)

        print("\n[발송] 텔레그램으로 미국 장마감 심층 브리핑 Part 2 전송 중...")
        s2 = send_telegram_message(full_part2)
        print("[성공]" if s2 else "[실패]", "Part 2 발송", "성공" if s2 else "실패")

        if s1 and s2:
            print("[완료] 모든 미국 장마감 시황 리포트가 성공적으로 발송되었습니다.")
        else:
            print("[실패] 일부 리포트 전송에 실패하였습니다.")
            sys.exit(1)


def _run_with_telegram_status():
    label = "미국 장마감 시황 브리핑"
    test_mode = "--test" in sys.argv
    if not test_mode:
        notify_briefing_status(label, "start")
    try:
        main()
        if not test_mode:
            notify_briefing_status(label, "complete")
    except SystemExit as e:
        if e.code not in (None, 0) and not test_mode:
            notify_briefing_status(label, "failed")
        raise
    except Exception:
        if not test_mode:
            notify_briefing_status(label, "failed")
        raise


if __name__ == "__main__":
    _run_with_telegram_status()
