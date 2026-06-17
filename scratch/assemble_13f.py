#!/usr/bin/env python3
"""Assemble institutional_13f from cached infotable XML files."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(__file__).resolve().parent / "xml_cache"
OUT_JSON = ROOT / "data" / "institutional_13f.json"
OUT_JS = ROOT / "data" / "institutional_13f.js"

FILINGS = [
    {
        "id": "berkshire", "name": "버크셔 해서웨이", "manager": "워렌 버핏", "cik": "1067983",
        "filedDate": "2026-05-15", "reportDate": "2026-03-31",
        "accession": "0001193125-26-226661", "xml": "berkshire.xml",
    },
    {
        "id": "bridgewater", "name": "브릿지워터", "manager": "레이 달리오", "cik": "1350694",
        "filedDate": "2026-05-15", "reportDate": "2026-03-31",
        "accession": "0001350694-26-000002", "xml": "bridgewater.xml",
    },
    {
        "id": "citadel", "name": "시타델", "manager": "켄 그리핀", "cik": "1423053",
        "filedDate": "2026-05-15", "reportDate": "2026-03-31",
        "accession": "0001104659-26-062477", "xml": "citadel.xml",
    },
    {
        "id": "renaissance", "name": "르네상스", "manager": "짐 사이먼스", "cik": "1037389",
        "filedDate": "2026-05-14", "reportDate": "2026-03-31",
        "accession": "0001037389-26-000033", "xml": "renaissance.xml",
    },
    {
        "id": "pershing", "name": "퍼싱 스퀘어", "manager": "빌 애크먼", "cik": "1336528",
        "filedDate": "2026-05-15", "reportDate": "2026-03-31",
        "accession": "0001172661-26-002336", "xml": "pershing.xml",
    },
    {
        "id": "tiger", "name": "타이거 글로벌", "manager": "체이스 콜먼", "cik": "1167483",
        "filedDate": "2026-05-15", "reportDate": "2026-03-31",
        "accession": "0000919574-26-003362", "xml": "tiger.xml",
    },
    {
        "id": "baupost", "name": "바포스트", "manager": "세스 클라만", "cik": "1061768",
        "filedDate": "2026-05-14", "reportDate": "2026-03-31",
        "accession": "0001061768-26-000007", "xml": "baupost.xml",
    },
    {
        "id": "appaloosa", "name": "아팔루사", "manager": "데이비드 테퍼", "cik": "1656456",
        "filedDate": "2026-05-15", "reportDate": "2026-03-31",
        "accession": "0001656456-26-000002", "xml": "appaloosa.xml",
    },
    {
        "id": "duquesne", "name": "듀케인 패밀리", "manager": "스탠 드러크en밀러", "cik": "1536411",
        "filedDate": "2026-05-15", "reportDate": "2026-03-31",
        "accession": "0001536411-26-000004", "xml": "duquesne.xml",
    },
    {
        "id": "scion", "name": "사이언 에셋", "manager": "마이클 버리", "cik": "1649339",
        "filedDate": "2025-11-03", "reportDate": "2025-09-30",
        "accession": "0001649339-25-000007", "xml": "scion.xml",
    },
]


def parse_infotable_xml(text: str) -> list[dict]:
    rows = []
    chunks = re.split(r"<infoTable>", text, flags=re.I)
    for chunk in chunks[1:]:
        issuer = re.search(r"<nameOfIssuer>([^<]+)</nameOfIssuer>", chunk, re.I)
        cusip = re.search(r"<cusip>([^<]+)</cusip>", chunk, re.I)
        title = re.search(r"<titleOfClass>([^<]+)</titleOfClass>", chunk, re.I)
        value = re.search(r"<value>([^<]+)</value>", chunk, re.I)
        shares = re.search(r"<sshPrnamt>([^<]+)</sshPrnamt>", chunk, re.I)
        if not issuer or not value:
            continue
        rows.append({
            "issuer": issuer.group(1).strip(),
            "cusip": (cusip.group(1).strip() if cusip else ""),
            "titleOfClass": (title.group(1).strip() if title else ""),
            "valueK": int(float(value.group(1).replace(",", ""))),
            "shares": int(float((shares.group(1) if shares else "0").replace(",", ""))),
        })
    return rows


def aggregate_holdings(rows: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for row in rows:
        key = f"{row['issuer']}|{row.get('titleOfClass', '')}"
        if key not in by_key:
            by_key[key] = {**row}
        else:
            by_key[key]["valueK"] += row["valueK"]
            by_key[key]["shares"] += row["shares"]
    holdings = sorted(by_key.values(), key=lambda r: r["valueK"], reverse=True)
    total = sum(h["valueK"] for h in holdings) or 1
    for h in holdings:
        h["weightPct"] = round((h["valueK"] / total) * 100, 2)
        h["valueM"] = round(h["valueK"] / 1000, 1)
    return holdings


def main() -> None:
    payload = {
        "updatedAtKst": datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST"),
        "source": "SEC EDGAR 13F-HR (public filings)",
        "note": "분기마다 제출되는 공시 기준 보유 내역입니다. 실시간 매매가 아닙니다.",
        "institutions": [],
    }
    ok = 0
    for inst in FILINGS:
        xml_path = CACHE / inst["xml"]
        try:
            if not xml_path.exists():
                raise FileNotFoundError(f"missing {xml_path.name}")
            text = xml_path.read_text(encoding="utf-8", errors="replace")
            if "Undeclared Automated Tool" in text or "<infoTable>" not in text.lower():
                raise RuntimeError("invalid or blocked XML content")
            holdings = aggregate_holdings(parse_infotable_xml(text))[:25]
            payload["institutions"].append({
                "id": inst["id"],
                "name": inst["name"],
                "manager": inst["manager"],
                "cik": inst["cik"],
                "status": "ok",
                "filedDate": inst["filedDate"],
                "reportDate": inst["reportDate"],
                "accession": inst["accession"],
                "holdings": holdings,
            })
            ok += 1
            top = holdings[0]["issuer"] if holdings else "-"
            print(f"[ok] {inst['name']} ({len(holdings)} holdings, top={top})")
        except Exception as exc:
            payload["institutions"].append({
                "id": inst["id"], "name": inst["name"], "manager": inst["manager"],
                "cik": inst["cik"], "status": "error", "error": str(exc), "holdings": [],
            })
            print(f"[err] {inst['name']}: {exc}")

    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JS.write_text(
        "window.INSTITUTIONAL_13F = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_JSON} ({ok}/{len(FILINGS)} ok)")


if __name__ == "__main__":
    main()