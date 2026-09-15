#!/usr/bin/env python3
"""Add missing properties to Kiwoom Notion data source."""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "automation"))
from utils import load_env_file, notion_token  # noqa: E402

DATA_SOURCE_ID = "b745027b-d0f4-4343-b4c2-56061534d30c"


def _sdk_client():
    saved = sys.modules.pop("notion_client", None)
    automation_dir = str((ROOT / "automation").resolve())
    sys.path[:] = [p for p in sys.path if Path(p).resolve() != Path(automation_dir).resolve()]
    try:
        sys.modules.pop("notion_client", None)
        sdk = importlib.import_module("notion_client")
        return sdk.Client(auth=notion_token())
    finally:
        if saved is not None:
            sys.modules["notion_client"] = saved


def main() -> int:
    load_env_file()
    client = _sdk_client()
    properties = {
        "Date": {"date": {}},
        "Batch": {
            "select": {
                "options": [
                    {"name": "국내 오전", "color": "blue"},
                    {"name": "해외 오후", "color": "orange"},
                ]
            }
        },
        "Market": {
            "select": {
                "options": [
                    {"name": "KR", "color": "green"},
                    {"name": "US", "color": "purple"},
                ]
            }
        },
        "Source": {
            "select": {
                "options": [
                    {"name": "scanner", "color": "gray"},
                    {"name": "community_mentions", "color": "yellow"},
                    {"name": "scanner_fallback", "color": "brown"},
                ]
            }
        },
        "Rank": {"number": {"format": "number"}},
        "Ticker": {"rich_text": {}},
        "Company": {"rich_text": {}},
        "Selected Type": {
            "select": {
                "options": [
                    {"name": "분석/정보형", "color": "blue"},
                    {"name": "관심 유도형", "color": "pink"},
                    {"name": "꿀팁 공유형", "color": "green"},
                ]
            }
        },
        "Probability Score": {"number": {"format": "number"}},
        "Mention Count": {"number": {"format": "number"}},
        "Body": {"rich_text": {}},
        "Chart Image": {"files": {}},
        "Notion Status": {
            "select": {
                "options": [
                    {"name": "초안", "color": "gray"},
                    {"name": "검수 완료", "color": "blue"},
                    {"name": "업로드 완료", "color": "green"},
                    {"name": "보류", "color": "yellow"},
                    {"name": "수정 필요", "color": "red"},
                ]
            }
        },
        "Compliance Pass": {"checkbox": {}},
        "Risk Level": {
            "select": {
                "options": [
                    {"name": "low", "color": "green"},
                    {"name": "medium", "color": "yellow"},
                    {"name": "high", "color": "red"},
                ]
            }
        },
        "Quality Score": {"number": {"format": "number"}},
        "Created At": {"date": {}},
        "Posted URL": {"url": {}},
        "Memo": {"rich_text": {}},
    }
    updated = client.data_sources.update(data_source_id=DATA_SOURCE_ID, properties=properties)
    names = list((updated.get("properties") or {}).keys())
    print(json.dumps({"property_count": len(names), "properties": names}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())