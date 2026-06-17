#!/usr/bin/env python3
"""Extract WebFetch XML responses from session transcript into xml_cache."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(__file__).resolve().parent / "xml_cache"
CACHE.mkdir(exist_ok=True)

TRANSCRIPT = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5CUsers%5Cuser%5COneDrive%5C%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4%5C%EC%9A%A9%EC%84%A0%EC%9A%B0%5CAI\019ed41e-9c3f-7942-9f8f-9ac0d2808e49\updates.jsonl"
)

URL_TO_FILE = {
    "1067983/000119312526226661/53405.xml": "berkshire.xml",
    "1350694/000135069426000002/infotable.xml": "bridgewater.xml",
    "1423053/000110465926062477/infotable.xml": "citadel.xml",
    "1037389/000103738926000033/renaissance13Fq12026_holding.xml": "renaissance.xml",
    "1336528/000117266126002336/infotable.xml": "pershing.xml",
    "1167483/000091957426003362/infotable.xml": "tiger.xml",
    "1061768/000106176826000007/BGLLCQ12026.xml": "baupost.xml",
    "1656456/000165645626000002/Form13FInfoTable.xml": "appaloosa.xml",
    "1536411/000153641126000004/form13f_20260331.xml": "duquesne.xml",
    "1649339/000164933925000007/infotable.xml": "scion.xml",
}

EXPECTED_SIZES = {
    "berkshire.xml": 45259,
    "bridgewater.xml": 597030,
    "citadel.xml": 7845034,
    "renaissance.xml": 1836709,
    "pershing.xml": 5520,
    "tiger.xml": 25399,
    "baupost.xml": 11876,
    "appaloosa.xml": 15770,
    "duquesne.xml": 27399,
    "scion.xml": 4438,
}


def extract_xml_from_text(text: str) -> str | None:
    if "# Content from" not in text:
        return None
    body = text.split("\n\n", 1)
    if len(body) < 2:
        return None
    xml = body[1]
    if "[... truncated" in xml:
        xml = xml.split("[... truncated")[0].rstrip()
    if "<infoTable>" not in xml.lower() and "infoTable" not in xml:
        return None
    return xml


def main() -> None:
    if not TRANSCRIPT.exists():
        raise SystemExit(f"transcript not found: {TRANSCRIPT}")

    best: dict[str, tuple[int, str]] = {}
    with TRANSCRIPT.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = (
                obj.get("params", {})
                .get("update", {})
                .get("content")
            )
            if not content:
                continue
            if isinstance(content, list):
                for item in content:
                    text = item.get("content", {}).get("text", "") if isinstance(item, dict) else ""
                    if not text or "# Content from" not in text:
                        continue
                    for key, fname in URL_TO_FILE.items():
                        if key in text:
                            xml = extract_xml_from_text(text)
                            if xml and len(xml) > best.get(fname, (0, ""))[0]:
                                best[fname] = (len(xml), xml)

    saved = 0
    for fname, (size, xml) in sorted(best.items()):
        dest = CACHE / fname
        dest.write_text(xml, encoding="utf-8")
        exp = EXPECTED_SIZES.get(fname, 0)
        ok = "ok" if size >= exp * 0.95 else "PARTIAL"
        print(f"[{ok}] {fname}: {size} bytes (expected ~{exp})")
        if size >= exp * 0.95:
            saved += 1

    missing = set(URL_TO_FILE.values()) - set(best)
    if missing:
        print("missing:", ", ".join(sorted(missing)))
    print(f"Saved {len(best)} files, {saved} complete")


if __name__ == "__main__":
    main()