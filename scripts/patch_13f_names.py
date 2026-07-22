#!/usr/bin/env python3
"""institutional_13f.json/js 한글명·매니저명 패치."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "institutional_13f.json"
OUT_JS = ROOT / "data" / "institutional_13f.js"

FIXES = {
    "duquesne": {"manager": "스탠 드러크밀러"},
    "highfields": {"manager": "리처드 버크코위츠"},
}

REPLACEMENTS = {
    "스탠 드러크en밀러": "스탠 드러크밀러",
    "리처드 Бер크owitz": "리처드 버크코위츠",
}


def patch_obj(obj):
    if isinstance(obj, dict):
        inst_id = obj.get("id")
        if inst_id in FIXES:
            obj.update(FIXES[inst_id])
        for key, value in obj.items():
            if isinstance(value, str):
                for bad, good in REPLACEMENTS.items():
                    if bad in value:
                        obj[key] = value.replace(bad, good)
            else:
                patch_obj(value)
    elif isinstance(obj, list):
        for item in obj:
            patch_obj(item)


def main() -> None:
    payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    patch_obj(payload)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JS.write_text(
        "window.INSTITUTIONAL_13F = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Patched {OUT_JSON}")


if __name__ == "__main__":
    main()