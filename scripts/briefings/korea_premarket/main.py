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

from scrapers import fetch_indices, fetch_investor_trends, fetch_market_news
from config import GEMINI_API_KEY, validate_config
from publish import publish_briefing_to_site
from telegram_bot import notify_briefing_status

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def generate_korea_premarket_analysis(raw_data_text):
    """Gemini API를 호출하여 국내 증시 개장 전 심층 분석 리포트를 작성합니다."""
    if not GEMINI_API_KEY:
        print("  [경고] GEMINI_API_KEY가 설정되어 있지 않아 AI 분석을 생략합니다.")
        return ""

    prompt = f"""너는 대한민국 여의도 증권가에서 가장 신뢰받는 최고의 시황 애널리스트이자 자산운용사 펀드매니저다.
지금은 국내 증시가 개장하기 전(오전)이다. 제공된 데이터(전 거래일 코스피/코스닥 종가 및 등락률, 개인/외국인/기관 순매수액, 최근 증권/금융 주요 RSS 뉴스 제목)와 간밤 글로벌 시장 흐름에 대한 너의 지식을 종합하여, 오늘 장에 대비하는 전문적이고 명쾌한 '개장 전 심층 분석' 리포트를 작성해라.

[원천 데이터 (전 거래일 마감 기준)]
{raw_data_text}

[작성 지침 (절대 엄수)]
1. 전 거래일 마감 수급과 간밤 미국 증시/환율/금리 흐름을 연계하여, 오늘 국내 증시의 예상 시나리오를 날카롭게 제시해라.
2. 최종 출력 서식은 반드시 **텔레그램 호환 HTML 태그**로 작성해라. (Markdown 기호 *, **, # 등 사용 금지. <b>, <i>, <code>, <pre>, <blockquote>, <a> 등만 허용)
3. 레이아웃 규격 (반드시 다음 대제목 구조를 그대로 지켜서 한글로 작성해라. 지구본 이모지 🌐는 절대 쓰지 마라. 구조화된 개행과 계층 표시를 위해 ├─, └─ 특수문자를 적절히 활용해라):

🌙 <b>간밤 글로벌 시장 & 매크로 점검</b>
├─ <b>미국 증시:</b> (간밤 미국 3대 지수 흐름과 주요 빅테크/섹터 동향이 국내에 미칠 영향 2~3줄)
└─ <b>환율·금리·원자재:</b> (원/달러 환율, 미국채 금리, 유가/금 등 매크로 변수가 오늘 장에 줄 영향)

📊 <b>전 거래일 국내 증시 복기</b>
├─ <b>지수·수급:</b> (전일 코스피/코스닥 마감과 외국인·기관 수급이 시사하는 방향성)
└─ <b>주도 업종:</b> (전일 강했던/약했던 업종·테마와 오늘 이어질 가능성)

🎯 <b>오늘의 개장 전 전략 가이드</b>
├─ <b>예상 시나리오:</b> (오늘 코스피/코스닥의 강세/약세/혼조 시나리오와 근거)
└─ <b>관심 포인트:</b> (개인 투자자가 개장 전 체크할 관심 업종/테마 및 대응 전략 2~3줄)

⚠️ <b>오늘 장중 유의 사항</b>
└─ <b>리스크 점검:</b> (오늘 예정된 국내외 경제지표 발표, 이벤트, 변동성 요인 등 유의점 2~3줄)
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
        payload = {"contents": [{"parts": [{"text": prompt}]}]}

        print(f"[AI 분석] {model} ({version}) 모델로 국내 개장 전 심층 분석 생성 시도 중...")
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

    print("  [경고] 모든 Gemini 모델 호출에 실패하여 AI 개장 전 분석을 생략합니다.")
    return ""


def update_etf_charts(data):
    """지정된 15개 ETF의 차트 데이터를 Yahoo Finance에서 수집하여 data['sector_charts']에 업데이트합니다."""
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
            time.sleep(0.1)
    print(f"  > ETF 차트 데이터 수집 완료 (성공: {success_count}개 시리즈)")


def update_market_snapshot(korea_premarket_html):
    """Safely merge and publish the Korean premarket briefing."""

    def mutate(data):
        update_etf_charts(data)

    return publish_briefing_to_site("korea_premarket", korea_premarket_html, "KOR Premarket", mutate)

def main():
    parser = argparse.ArgumentParser(description="국내 증시 개장 전 심층 분석 브리핑 (웹사이트 저장 전용)")
    parser.add_argument("--test", action="store_true", help="웹사이트 저장 없이 콘솔에만 출력합니다.")
    args = parser.parse_args()

    print("=== 국내 증시 개장 전 심층 분석 데이터 수집 시작 ===")

    try:
        validate_config(require_gemini=True, require_telegram=True)
    except ValueError as e:
        print(f"  [경고] {e}")

    today = datetime.now().strftime("%Y년 %m월 %d일 %H시 %M분")

    # 1. 데이터 수집 (전 거래일 마감 기준)
    print("  > 국내 지수 정보 수집 중...")
    indices = fetch_indices()

    print("  > 개인/외인/기관 수급 정보 수집 중...")
    trends = fetch_investor_trends()

    print("  > 증권 주요 경제 뉴스 수집 중...")
    news_items = fetch_market_news()

    # --- Part 1: 로우 데이터 ---
    report_lines_part1 = [
        f"<b>📊 [국내 증시 개장 전 데이터 리포트] - {today}</b>",
        "━━━━━━━━━━━━━━━━━━━━━\n",
        "<b>📈 전 거래일 주요 지수 종가</b>"
    ]

    kospi = indices.get("KOSPI")
    if kospi:
        sign = "+" if kospi["change"] > 0 else ""
        report_lines_part1.append(f"  - <b>코스피 (KOSPI):</b> {kospi['close']:.2f} ({sign}{kospi['change']:.2f}, {sign}{kospi['change_pct']:.2f}%)")
    else:
        report_lines_part1.append("  - <b>코스피 (KOSPI):</b> 데이터 수집 실패")

    kosdaq = indices.get("KOSDAQ")
    if kosdaq:
        sign = "+" if kosdaq["change"] > 0 else ""
        report_lines_part1.append(f"  - <b>코스닥 (KOSDAQ):</b> {kosdaq['close']:.2f} ({sign}{kosdaq['change']:.2f}, {sign}{kosdaq['change_pct']:.2f}%)")
    else:
        report_lines_part1.append("  - <b>코스닥 (KOSDAQ):</b> 데이터 수집 실패")
    report_lines_part1.append("")

    report_lines_part1.append("<b>👥 전 거래일 투자 주체별 순매수 동향 (단위: 억원)</b>")
    kospi_trend = trends.get("KOSPI")
    if kospi_trend:
        report_lines_part1.append("  - <b>코스피:</b> " + ", ".join([f"{k}: {v}" for k, v in kospi_trend.items()]))
    else:
        report_lines_part1.append("  - <b>코스피:</b> 데이터 수집 실패")
    kosdaq_trend = trends.get("KOSDAQ")
    if kosdaq_trend:
        report_lines_part1.append("  - <b>코스닥:</b> " + ", ".join([f"{k}: {v}" for k, v in kosdaq_trend.items()]))
    else:
        report_lines_part1.append("  - <b>코스닥:</b> 데이터 수집 실패")
    report_lines_part1.append("")

    report_lines_part1.append("<b>📰 최근 주요 경제/증권 이슈 뉴스</b>")
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

    # --- AI 분석용 원천 텍스트 ---
    raw_data_lines = ["=== 전 거래일 국내 증시 마감 지수 ==="]
    if kospi:
        raw_data_lines.append(f"코스피: {kospi['close']:.2f} (변동량: {kospi['change']:+.2f}, 등락률: {kospi['change_pct']:+.2f}%)")
    if kosdaq:
        raw_data_lines.append(f"코스닥: {kosdaq['close']:.2f} (변동량: {kosdaq['change']:+.2f}, 등락률: {kosdaq['change_pct']:+.2f}%)")
    raw_data_lines.append("\n=== 전 거래일 투자자별 순매수 현황 (단위: 억원) ===")
    if kospi_trend:
        raw_data_lines.append(f"코스피 순매수 - 개인: {kospi_trend.get('개인')}, 외국인: {kospi_trend.get('외국인')}, 기관: {kospi_trend.get('기관')}")
    if kosdaq_trend:
        raw_data_lines.append(f"코스닥 순매수 - 개인: {kosdaq_trend.get('개인')}, 외국인: {kosdaq_trend.get('외국인')}, 기관: {kosdaq_trend.get('기관')}")
    raw_data_lines.append("\n=== 최근 금융/증권 뉴스 ===")
    for item in news_items:
        raw_data_lines.append(f"[{item['source']}] {item['title']}")
    raw_data_text = "\n".join(raw_data_lines)

    # 2. AI 분석
    ai_analysis_text = generate_korea_premarket_analysis(raw_data_text)

    report_lines_part2 = [f"💡 <b>[국내 증시 개장 전 심층 분석 브리핑]</b>\n"]
    if ai_analysis_text:
        report_lines_part2.append(ai_analysis_text)
    else:
        report_lines_part2.append("AI 요약 분석을 생성할 수 없습니다.")
    report_lines_part2.append("\n━━━━━━━━━━━━━━━━━━━━━")
    report_lines_part2.append("<i>* 전 거래일 수급·뉴스와 간밤 글로벌 흐름을 기반으로 AI가 분석한 개장 전 리포트로 투자 권유를 뜻하지 않습니다.</i>")
    full_report_part2 = "\n".join(report_lines_part2)

    combined_briefing = f"{full_report_part1}\n\n{full_report_part2}"

    if args.test:
        import re

        def clean_tags(text):
            plain = (text.replace("<b>", "").replace("</b>", "")
                     .replace("<i>", "").replace("</i>", "")
                     .replace("<code>", "").replace("</code>", "")
                     .replace("━━━━━━━━━━━━━━━━━━━━━", "====================="))
            plain = re.sub(r"<a href='(.*?)'>(.*?)</a>", r"\2 (\1)", plain)
            plain = re.sub(r'<a href="(.*?)">(.*?)</a>', r"\2 (\1)", plain)
            return plain

        print("\n=== [테스트 모드] 국내 증시 개장 전 데이터 리포트 (Part 1/2) ===")
        print(clean_tags(full_report_part1))
        print("\n=== [테스트 모드] 국내 증시 개장 전 심층 분석 브리핑 (Part 2/2) ===")
        print(clean_tags(full_report_part2))
        print("\n[완료] 테스트 출력 완료 (웹사이트 저장·텔레그램 발송 없음)")
        return

    # 웹사이트 AI 브리핑 탭에만 저장 (텔레그램 발송 없음)
    published = update_market_snapshot(combined_briefing)
    if not published:
        raise RuntimeError("국내 개장 전 브리핑의 GitHub 게시 및 원격 검증에 실패했습니다.")
    print("[완료] 국내 개장 전 심층 분석이 GitHub와 웹사이트 데이터에 반영·검증되었습니다. (텔레그램 발송 없음)")


def _run_with_telegram_status():
    label = "국내 장전 시황 브리핑"
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
