import sys
import time
import argparse
import requests
from datetime import datetime
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
from pathlib import Path

_PKG_DIR = Path(__file__).resolve().parent
_COMMON_DIR = _PKG_DIR.parent / "common"
for _path in (_COMMON_DIR, _PKG_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from scrapers import (
    fetch_reddit_trending,
    fetch_premarket_gainers,
    fetch_us_news,
    fetch_stocktwits_trending,
    fetch_yahoo_trending,
)
from config import GEMINI_API_KEY, validate_config
from publish import publish_briefing_to_site
from schedules import refresh_white_house_schedule_safe
from telegram_bot import send_telegram_message, notify_briefing_status

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

def generate_us_premarket_analysis(raw_data_text):
    """Gemini API를 호출하여 미국 프리마켓, 다각도 SNS/커뮤니티 데이터를 분석해 장전 브리핑 보고서를 작성합니다."""
    if not GEMINI_API_KEY:
        print("  [경고] GEMINI_API_KEY가 설정되어 있지 않아 AI 분석을 생략합니다.")
        return ""
        
    prompt = f"""너는 미국 월스트리트의 글로벌 매크로 헤지펀드 매니저이자 최고 투자 전략가(Chief Investment Strategist)다.
제공된 미국 장전 프리마켓 데이터(상승률/거래량 상위 종목), 레딧(r/wallstreetbets), 스탁트윗(Stocktwits), 야후파이낸스 실시간 트렌드(Yahoo Trending)의 소셜 미디어 언급량 정보, 그리고 미국 주요 경제 언론사(Yahoo Finance, CNBC, WSJ)의 실시간 뉴스들을 바탕으로 전문적이고 날카로운 미국 주식 장전 브리핑을 작성해라.

[원천 데이터]
{raw_data_text}

[작성 지침 (절대 엄수)]
1. 당일 미국 프리마켓의 주요 변동과 거시 이슈(금리, 지정학, 실적 등 미국 현지 뉴스)를 연계해 시장의 거대한 흐름을 짚어내라.
2. 레딧(ApeWisdom), 스탁트윗(Stocktwits), 야후 파이낸스 트렌드에서 공통적으로 급상승하거나 교차 포착된 핵심 종목들(예: 협업 찌라시, 파트너십 루머, 숏스퀴즈 움직임, 급격한 관심 증가 종목)을 날카롭게 감지해라. 그들이 주목받고 있는 구체적인 이유(어떤 소식이나 찌라시가 돌고 있는지)와 실현 가능성을 구체적으로 진단해라.
3. 최종 출력 서식은 반드시 **텔레그램 호환 HTML 태그**로 작성해라. (Markdown 기호 *, **, # 등 사용 금지. <b>, <i>, <code>, <pre>, <blockquote>, <a> 등만 허용)
4. 레이아웃 규격 (반드시 다음 대제목 구조를 그대로 지켜서 한글로 작성해라. 지구본 이모지 🌐는 절대 쓰지 마라. 구조화된 개행과 계층 표시를 위해 ├─, └─ 특수문자를 적절히 활용해라):

📰 <b>미국 장전 주요 경제/거시 뉴스 분석</b>
├─ <b>매크로 분석:</b> (글로벌 거시 경제 상황, 인플레이션, 미 경제지 뉴스 요약 및 미국 증시 전체에 미칠 영향 해설 2~3줄)
└─ <b>개장 전 전망:</b> (오늘 밤 증시의 시초가 형성 및 출발 분위기 예측)

📈 <b>프리마켓(Premarket) 상승/거래량 상위 특징주</b>
├─ <b>주요 종목:</b> (프리마켓 데이터 중 상승률이나 거래량이 이례적으로 폭발한 2~3개 종목 분석)
└─ <b>상승 배경:</b> (M&A, 실적 서프라이즈, 대형 공급 계약 등 상승의 직접적인 재료 해설 2~3줄)

💬 <b>SNS/커뮤니티 인기 급상승 종목 & 찌라시 분석</b>
├─ <b>소셜 미디어 동향:</b> (Reddit, Stocktwits, Yahoo Trending 등 여러 채널에서 공통 언급되거나 언급량이 갑자기 폭증한 핵심 밈 주식 및 중소형 기술주 요약)
└─ <b>루머 & 바이럴 요인:</b> (각 커뮤니티에서 돌고 있는 협업 찌라시, 숏스퀴즈 타겟팅, 루머의 구체적인 내용과 실현 가능성 진단 2~3줄)

🎯 <b>오늘 밤 미국 본장 관전 포인트 및 대응 가이드</b>
├─ <b>본장 주목 섹터:</b> (개장 직후 수급이 유입될 것으로 보이는 유망 섹터나 테마 제시)
└─ <b>리스크 및 대응:</b> (프리마켓 급등주 추격 매수의 위험성 경고 및 오늘 밤 본장에 참여하는 개인 투자자들을 위한 실전 리스크 관리 팁 2~3줄)
"""

    models_config = [
        {"model": "gemini-3.5-flash", "version": "v1beta"},
        {"model": "gemini-3.1-flash-lite", "version": "v1beta"},
        {"model": "gemini-2.5-flash", "version": "v1beta"},
        {"model": "gemini-flash-latest", "version": "v1beta"}
    ]
    
    for cfg in models_config:
        model = cfg["model"]
        version = cfg["version"]
        url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ]
        }
        
        print(f"[AI 분석] {model} ({version}) 모델로 미국 장전 브리핑 분석 생성 시도 중...")
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            if response.status_code == 200:
                res_json = response.json()
                generated_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                return generated_text.strip()
            else:
                print(f"  [경고] {model} API 호출 실패 ({response.status_code}): {response.text[:100]}")
        except Exception as e:
            print(f"  [경고] {model} API 호출 중 예외 발생: {e}")
        
        time.sleep(2)
        
    print("  [경고] 모든 Gemini 모델 호출에 실패하여 AI 미국 장전 브리핑 요약을 생략합니다.")
    return ""

def update_etf_charts(data):
    """지정된 15개 ETF의 차트 데이터를 Yahoo Finance에서 수집하여 data['sector_charts']에 업데이트합니다."""
    import time
    
    etfs = ["SPY", "QQQ", "XLK", "SOXX", "XLF", "XLE", "XLV", "XLU", "XLI", "XLY", "XLP", "XLC", "JETS", "XBI", "KRE"]
    timeframes = [
        {"name": "1D", "range": "1d", "interval": "5m"},
        {"name": "1W", "range": "5d", "interval": "30m"},
        {"name": "1M", "range": "1mo", "interval": "1h"},
        {"name": "3M", "range": "3mo", "interval": "1d"}
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    if "sector_charts" not in data:
        data["sector_charts"] = {}
        
    print(f"  > ETF 차트 데이터 수집 시작 ({len(etfs)}개 ETF, 4개 기간)...")
    success_count = 0
    for ticker in etfs:
        if ticker not in data["sector_charts"]:
            data["sector_charts"][ticker] = {}
            
        for tf in timeframes:
            tf_name = tf["name"]
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={tf['range']}&interval={tf['interval']}"
            try:
                resp = requests.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    payload = resp.json()
                    res = payload["chart"]["result"][0]
                    timestamps = res.get("timestamp", [])
                    closes = res["indicators"]["quote"][0].get("close", [])
                    
                    points = []
                    for t, c in zip(timestamps, closes):
                        if c is not None:
                            points.append({"t": t, "c": round(float(c), 2)})
                    
                    if points:
                        data["sector_charts"][ticker][tf_name] = points
                        success_count += 1
                else:
                    print(f"    [경고] {ticker} {tf_name} 차트 수집 실패 (HTTP {resp.status_code})")
            except Exception as e:
                print(f"    [경고] {ticker} {tf_name} 차트 수집 중 오류: {e}")
            time.sleep(0.1) # 속도 제한 방지
            
    print(f"  > ETF 차트 데이터 수집 완료 (성공: {success_count}개 시리즈)")

def update_market_snapshot(us_premarket_html, reddit_data, stocktwits_data, yahoo_data):
    """Safely merge and publish the US premarket briefing and related sections."""

    def mutate(data):
        sentiment = data.setdefault("social_sentiment", {})
        sentiment["reddit"] = [
            {
                "ticker": item.get("ticker", ""),
                "name": item.get("name", ""),
                "mentions": item.get("mentions", 0),
                "change24h": ((item.get("mentions", 0) - item.get("mentions_prev", 0)) / item.get("mentions_prev", 1) * 100)
                if item.get("mentions_prev") else 0,
            }
            for item in reddit_data
        ]
        sentiment["stocktwits"] = [
            {"ticker": item.get("symbol", ""), "name": item.get("name", ""), "watchlist_count": item.get("watchlist_count", 0)}
            for item in stocktwits_data
        ]
        sentiment["yahoo"] = [
            {
                "ticker": item.get("symbol", ""),
                "name": item.get("name", ""),
                "price": item.get("price", ""),
                "changePct": item.get("change_pct", 0.0),
            }
            for item in yahoo_data
        ]
        update_etf_charts(data)

    return publish_briefing_to_site("us_premarket", us_premarket_html, "US Premarket", mutate)

def main():
    parser = argparse.ArgumentParser(description="미국 주식 프리마켓 장전 브리핑 텔레그램 발송")
    parser.add_argument("--test", action="store_true", help="텔레그램 발송 없이 콘솔에만 출력합니다.")
    args = parser.parse_args()
    
    print("=== 미국 프리마켓 및 SNS 데이터 수집 시작 ===")
    
    try:
        validate_config(require_gemini=True, require_telegram=True)
    except ValueError as e:
        print(f"  [경고] {e}")
        
    today = datetime.now(KST).strftime("%Y년 %m월 %d일 %H시 %M분")
    
    # 1. 데이터 수집
    print("  > 미국 주요 경제 뉴스 수집 중...")
    news_items = fetch_us_news()
    
    print("  > 프리마켓 상승 및 거래량 특징주 수집 중...")
    premarket_stocks = fetch_premarket_gainers()
    
    print("  > Reddit 실시간 인기 언급 종목 수집 중...")
    reddit_trends = fetch_reddit_trending()
    
    print("  > Stocktwits 인기 급상승 심볼 수집 중...")
    stocktwits_trends = fetch_stocktwits_trending()
    
    print("  > Yahoo Finance 실시간 Trending Tickers 수집 중...")
    yahoo_trends = fetch_yahoo_trending()
    
    # --- Part 1: 로우 데이터 브리핑 메시지 조립 ---
    report_lines_part1 = [
        f"<b>📊 [미국 증시 개장 전 데이터 리포트] - {today}</b>",
        "━━━━━━━━━━━━━━━━━━━━━\n",
        "<b>📈 프리마켓(Premarket) 상승 특징주</b>"
    ]
    
    if premarket_stocks:
        for idx, item in enumerate(premarket_stocks[:5], 1):
            symbol = item["symbol"]
            name = item["name"]
            price = item["price"]
            change_pct = item["change_pct"]

            if item["link"]:
                report_lines_part1.append(f"  {idx}. <a href='{item['link']}'>{symbol}</a> ({name}) ${price} | {change_pct}")
            else:
                report_lines_part1.append(f"  {idx}. {symbol} ({name}) ${price} | {change_pct}")
    else:
        report_lines_part1.append("  데이터 없음")
    report_lines_part1.append("")
    
    report_lines_part1.append("<b>💬 Reddit (r/wallstreetbets) 인기 Tickers</b>")
    if reddit_trends:
        for item in reddit_trends[:5]:
            report_lines_part1.append(f"  - <b>{item['ticker']}</b> ({item['name']}): 언급 {item['mentions']}회 ({item['change_str']} 24h)")
    else:
        report_lines_part1.append("  데이터 없음")
    report_lines_part1.append("")
    
    report_lines_part1.append("<b>🐦 Stocktwits 인기 급상승 Tickers</b>")
    if stocktwits_trends:
        for item in stocktwits_trends[:5]:
            report_lines_part1.append(f"  - <b>{item['symbol']}</b> ({item['name']}): Watchlist {item['watchlist_count']}회")
    else:
        report_lines_part1.append("  데이터 없음")
    report_lines_part1.append("")
    
    report_lines_part1.append("<b>🔥 Yahoo Finance 실시간 Trending Tickers</b>")
    if yahoo_trends:
        trending_list = []
        for item in yahoo_trends[:5]:
            trending_list.append(f"<b>{item['symbol']}</b>")
        report_lines_part1.append(f"  - {', '.join(trending_list)}")
    else:
        report_lines_part1.append("  데이터 없음")
    report_lines_part1.append("")
    
    report_lines_part1.append("<b>📰 미국 현지 경제/증권 주요 뉴스</b>")
    if news_items:
        for idx, item in enumerate(news_items[:10], 1):
            title = item["title"].replace("<", "&lt;").replace(">", "&gt;")
            source = f"[{item['source']}] "
            if item["link"]:
                report_lines_part1.append(f"  {idx}. <a href='{item['link']}'>{title}</a> {source}")
            else:
                report_lines_part1.append(f"  {idx}. {title} {source}")
    else:
        report_lines_part1.append("  데이터 없음")
        
    report_lines_part1.append("\n━━━━━━━━━━━━━━━━━━━━━")
    full_report_part1 = "\n".join(report_lines_part1)
    
    # --- AI 분석용 원천 텍스트 컴파일 ---
    raw_data_lines = []
    
    raw_data_lines.append("=== 프리마켓 상승 특징주 (프리마켓 변동률 기준) ===")
    for item in premarket_stocks:
        raw_data_lines.append(f"Ticker: {item['symbol']} ({item['name']}) - 프리마켓 가격 ${item['price']}, 프리마켓 변동률 {item['change_pct']}")
        
    raw_data_lines.append("\n=== Reddit 소셜 미디어 인기 종목 (ApeWisdom) ===")
    for item in reddit_trends:
        raw_data_lines.append(f"순위 {item['rank']}. {item['ticker']} ({item['name']}) - 실시간 언급량: {item['mentions']}회, 24시간 변동: {item['change_str']}회")
        
    raw_data_lines.append("\n=== Stocktwits 실시간 인기 급상승 Tickers ===")
    for item in stocktwits_trends:
        raw_data_lines.append(f"순위 {item['rank']}. Ticker: {item['symbol']} ({item['name']}) - Watchlist 등록 횟수: {item['watchlist_count']}회")
        
    raw_data_lines.append("\n=== Yahoo Finance 실시간 Trending Tickers ===")
    for item in yahoo_trends:
        raw_data_lines.append(f"순위 {item['rank']}. Ticker: {item['symbol']} ({item['name']}) - 현재가/참고사항: {item['price']}")
        
    raw_data_lines.append("\n=== 주요 거시 및 글로벌 뉴스 (US Media) ===")
    for item in news_items:
        raw_data_lines.append(f"[{item['source']}] {item['title']}")
        
    raw_data_text = "\n".join(raw_data_lines)
    
    # 2. AI 분석 진행
    ai_analysis_text = generate_us_premarket_analysis(raw_data_text)
    
    # --- Part 2: AI 시황 해설 메시지 조립 ---
    report_lines_part2 = [
        f"💡 <b>[미국 증시 개장 전 심층 브리핑]</b>\n"
    ]
    if ai_analysis_text:
        report_lines_part2.append(ai_analysis_text)
    else:
        report_lines_part2.append("AI 요약 분석을 생성할 수 없습니다.")
    report_lines_part2.append("\n━━━━━━━━━━━━━━━━━━━━━")
    report_lines_part2.append("<i>* 본 자료는 미국 프리마켓 및 다각도 소셜 커뮤니티 트렌드를 취합해 AI가 실시간 분석한 보고서로 투자 권유가 아닙니다.</i>")
    
    full_report_part2 = "\n".join(report_lines_part2)
    
    # Update local web dashboard snapshot
    combined_briefing = f"{full_report_part1}\n\n{full_report_part2}"
    published = update_market_snapshot(combined_briefing, reddit_trends, stocktwits_trends, yahoo_trends)
    if not published:
        raise RuntimeError("미국 개장 전 브리핑의 GitHub 게시 및 원격 검증에 실패했습니다.")

    refresh_white_house_schedule_safe()

    # 완료 알림은 원격 브랜치 검증 후에만 출력합니다.
    print("[완료] 미국 개장 전 브리핑이 GitHub와 웹사이트 데이터에 반영·검증되었습니다. (텔레그램 발송 생략)")
    return
    
    # 3. 출력 및 발송
    if args.test:
        import re
        def clean_tags(text):
            plain = (
                text.replace("<b>", "")
                .replace("</b>", "")
                .replace("<i>", "")
                .replace("</i>", "")
                .replace("<code>", "")
                .replace("</code>", "")
                .replace("━━━━━━━━━━━━━━━━━━━━━", "=====================")
            )
            plain = re.sub(r'<a href=\'(.*?)\'>(.*?)</a>', r'\2 (\1)', plain)
            plain = re.sub(r'<a href="(.*?)">(.*?)</a>', r'\2 (\1)', plain)
            return plain
            
        print("\n=== [테스트 모드] 미국 증시 개장 전 데이터 리포트 (Part 1/2) ===")
        print(clean_tags(full_report_part1))
        print("\n=== [테스트 모드] 미국 증시 개장 전 심층 브리핑 (Part 2/2) ===")
        print(clean_tags(full_report_part2))
    else:
        print("\n[발송] 텔레그램으로 미국 증시 개장 전 데이터 Part 1 전송 중...")
        success1 = send_telegram_message(full_report_part1)
        if success1:
            print("[성공] 미국 증시 개장 전 데이터 Part 1 발송 성공")
        else:
            print("[실패] 미국 증시 개장 전 데이터 Part 1 발송 실패")
            
        time.sleep(2.0)  # Telegram API 속도 제한 우회용 딜레이
        
        print("\n[발송] 텔레그램으로 미국 증시 개장 전 심층 브리핑 Part 2 전송 중...")
        success2 = send_telegram_message(full_report_part2)
        if success2:
            print("[성공] 미국 증시 개장 전 심층 브리핑 Part 2 발송 성공")
        else:
            print("[실패] 미국 증시 개장 전 심층 브리핑 Part 2 발송 실패")
            
        if success1 and success2:
            print("[완료] 모든 미국 장전 브리핑 리포트가 성공적으로 발송되었습니다.")
        else:
            print("[실패] 일부 리포트 전송에 실패하였습니다.")
            sys.exit(1)

def _run_with_telegram_status():
    label = "미국 장전 시황 브리핑"
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
