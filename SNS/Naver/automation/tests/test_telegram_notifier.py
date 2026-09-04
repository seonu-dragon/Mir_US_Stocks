import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


AUTOMATION_DIR = Path(__file__).resolve().parents[1]
if str(AUTOMATION_DIR) not in sys.path:
    sys.path.insert(0, str(AUTOMATION_DIR))

import telegram_notifier


class TelegramNotifierTests(unittest.TestCase):
    @patch.dict(os.environ, {}, clear=True)
    @patch("telegram_notifier.urlopen")
    def test_missing_secrets_skips_request(self, mocked_urlopen):
        self.assertFalse(telegram_notifier.send_telegram_message("test"))
        mocked_urlopen.assert_not_called()

    @patch.dict(
        os.environ,
        {"TELEGRAM_BOT_TOKEN": "test-token", "TELEGRAM_CHAT_ID": "1234"},
        clear=True,
    )
    @patch("telegram_notifier.urlopen")
    def test_sends_status_message(self, mocked_urlopen):
        response = MagicMock(status=200)
        mocked_urlopen.return_value.__enter__.return_value = response

        self.assertTrue(telegram_notifier.notify_pipeline_status("start"))

        request = mocked_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["chat_id"], "1234")
        self.assertEqual(payload["text"], "국내 뉴스 데이터 수집 시작")


if __name__ == "__main__":
    unittest.main()
