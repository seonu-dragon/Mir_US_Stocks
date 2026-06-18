import sys
import unittest
from pathlib import Path


AUTOMATION_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AUTOMATION_DIR))

from daily_news_pipeline import SCORING_RUBRIC, render_markdown, validate_analysis  # noqa: E402


class DailyNewsPipelineTest(unittest.TestCase):
    def _topic(self, number):
        return {
            "title": f"주제 {number}",
            "scores": {
                key: maximum - number for key, (maximum, _) in SCORING_RUBRIC.items()
            },
            "summary": "핵심 요약",
            "why_important": "중요한 이유",
            "market_impact": "시장 영향",
            "key_facts": ["사실 1"],
            "source_article_ids": [number],
            "grok_research_requests": ["추가 조사"],
            "risks_or_uncertainties": [],
        }

    def test_validate_analysis_requires_and_ranks_five_topics(self):
        result = validate_analysis({"topics": [self._topic(i) for i in range(1, 6)]}, 50)
        self.assertEqual(len(result["topics"]), 5)
        self.assertEqual(result["topics"][0]["rank"], 1)
        self.assertGreater(result["topics"][0]["total_score"], result["topics"][-1]["total_score"])

    def test_validate_analysis_rejects_invalid_source_id(self):
        topics = [self._topic(i) for i in range(1, 6)]
        topics[0]["source_article_ids"] = [99]
        with self.assertRaises(ValueError):
            validate_analysis({"topics": topics}, 50)

    def test_render_markdown_contains_scores_and_sources(self):
        analysis = validate_analysis({"topics": [self._topic(i) for i in range(1, 6)]}, 50)
        collection = {
            "as_of": "2026-06-18T05:00:00+09:00",
            "article_count": 50,
            "articles": [
                {
                    "title": f"기사 {i}",
                    "publisher": "테스트경제",
                    "original_url": f"https://example.com/{i}",
                }
                for i in range(1, 51)
            ],
        }
        output = render_markdown(analysis, collection)
        self.assertIn("선정 기준", output)
        self.assertIn("Grok 추가 조사 요청", output)
        self.assertIn("https://example.com/1", output)


if __name__ == "__main__":
    unittest.main()
