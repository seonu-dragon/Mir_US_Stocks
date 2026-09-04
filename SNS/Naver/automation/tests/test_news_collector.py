import json
import sys
import unittest
from pathlib import Path


AUTOMATION_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AUTOMATION_DIR))

from news_collector import (  # noqa: E402
    _NaverSectionParser,
    clean_text,
    extract_article_text,
    normalize_url,
    parse_pub_date,
)


class NewsCollectorHelpersTest(unittest.TestCase):
    def test_clean_text_removes_search_markup(self):
        self.assertEqual(clean_text("국내 <b>증시</b> &amp; 환율"), "국내 증시 & 환율")

    def test_normalize_url_removes_tracking_parameters(self):
        value = "https://Example.com/a?article=1&utm_source=test#section"
        self.assertEqual(normalize_url(value), "https://example.com/a?article=1")

    def test_parse_pub_date_converts_to_kst(self):
        value = parse_pub_date("Wed, 17 Jun 2026 23:00:00 +0000")
        self.assertIsNotNone(value)
        self.assertEqual(value.strftime("%Y-%m-%d %H:%M"), "2026-06-18 08:00")

    def test_extract_article_body_from_json_ld(self):
        body = "한국 경제의 주요 변화와 투자 영향을 설명하는 기사 본문입니다. " * 8
        html = (
            '<html><script type="application/ld+json">'
            + json.dumps({"@type": "NewsArticle", "articleBody": body}, ensure_ascii=False)
            + "</script></html>"
        )
        extracted, source = extract_article_text(html)
        self.assertEqual(source, "publisher_json_ld")
        self.assertIn("투자 영향", extracted)

    def test_extract_article_body_falls_back_to_paragraphs(self):
        html = "<article>" + "".join(
            f"<p>문단 {index} 국내 금융시장에 영향을 주는 충분히 긴 기사 내용이 포함되어 있습니다.</p>"
            for index in range(8)
        ) + "</article>"
        extracted, source = extract_article_text(html)
        self.assertEqual(source, "publisher_paragraphs")
        self.assertIn("문단 7", extracted)

    def test_extract_naver_article_container(self):
        body = "네이버 기사 본문 영역에 포함된 국내 시장 분석 내용입니다. " * 10
        extracted, source = extract_article_text(f'<div id="dic_area">{body}<br>끝</div>')
        self.assertEqual(source, "publisher_article_container")
        self.assertIn("국내 시장 분석", extracted)

    def test_parse_naver_section_card(self):
        html = """
        <a href="https://n.news.naver.com/mnews/article/001/123" class="sa_text_title x">
          <strong class="sa_text_strong">주요 경제 기사</strong>
        </a>
        <div class="sa_text_lede">시장에 영향을 주는 기사 요약입니다.</div>
        <div class="sa_text_press">테스트경제</div>
        """
        parser = _NaverSectionParser()
        parser.feed(html)
        parser.close()
        self.assertEqual(len(parser.items), 1)
        self.assertEqual(parser.items[0]["publisher"], "테스트경제")


if __name__ == "__main__":
    unittest.main()
