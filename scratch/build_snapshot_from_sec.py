#!/usr/bin/env python3
"""Build institutional_13f snapshot via browse-edgar Atom + Archives."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "institutional_13f.json"
OUT_JS = ROOT / "data" / "institutional_13f.js"

SEC_HEADERS = {
    "User-Agent": "Mir US Stocks mir-us-stocks@users.noreply.github.com",
    "Accept": "application/json,application/atom+xml,text/xml,*/*",
    "Accept-Encoding": "identity",
    "Host": "www.sec.gov",
}

PREFERRED_PERIODS = {"2025-12-31", "2026-03-31"}

INSTITUTIONS = [
    {"id": "berkshire", "name": "버크셔 해서웨이", "manager": "워렌 버핏", "cik": "1067983"},
    {"id": "bridgewater", "name": "브릿지워터", "manager": "레이 달리오", "cik": "1350694"},
    {"id": "citadel", "name": "시타델", "manager": "켄 그리핀", "cik": "1423053"},
    {"id": "renaissance", "name": "르네상스", "manager": "짐 사이먼스", "cik": "1037389"},
    {"id": "pershing", "name": "퍼싱 스퀘어", "manager": "빌 애크먼", "cik": "1336528"},
    {"id": "tiger", "name": "타이거 글로벌", "manager": "체이스 콜먼", "cik": "1167483"},
    {"id": "baupost", "name": "바포스트", "manager": "세스 클라만", "cik": "1061768"},
    {"id": "appaloosa", "name": "아팔루사", "manager": "데이비드 테퍼", "cik": "1656456"},
    {"id": "duquesne", "name": "듀케인 패밀리", "manager": "스탠 드러크en밀러", "cik": "1536411"},
    {"id": "scion", "name": "사이언 에셋", "manager": "마이클 버리", "cik": "1649339"},
]


def fetch_text(url: str, headers: dict | None = None, retries: int = 3) -> str:
    hdrs = headers or SEC_HEADERS
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            last_err = exc
            if exc.code in {403, 429, 500, 502, 503} and attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except Exception as exc:
            last_err = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    raise RuntimeError(f"fetch failed: {last_err}")


def fetch_json(url: str) -> dict:
    return json.loads(fetch_text(url))


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


def parse_atom_filings(atom_xml: str) -> list[dict]:
    root = ET.fromstring(atom_xml)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    filings = []
    for entry in root.findall("a:entry", ns):
        form = entry.find("a:category", ns)
        if form is None or form.attrib.get("term") != "13F-HR":
            continue
        content = entry.find("a:content", ns)
        if content is None:
            continue
        acc_el = content.find("accession-number")
        filed_el = content.find("filing-date")
        if acc_el is None or filed_el is None or not acc_el.text or not filed_el.text:
            continue
        filings.append({
            "accession": acc_el.text.strip(),
            "filedDate": filed_el.text.strip(),
        })
    return filings


def browse_edgar_filings(cik: str) -> list[dict]:
    url = (
        "https://www.sec.gov/cgi-bin/browse-edgar"
        f"?action=getcompany&CIK={cik}&type=13F-HR&dateb=&owner=include&count=40&output=atom"
    )
    return parse_atom_filings(fetch_text(url))


def efts_search(cik: str) -> list[dict]:
    url = (
        "https://efts.sec.gov/LATEST/search-index"
        f"?q=&forms=13F-HR&ciks={cik}&dateRange=custom"
        "&startdt=2025-01-01&enddt=2026-12-31"
    )
    try:
        data = fetch_json(url)
    except Exception:
        return []
    hits = data.get("hits", {}).get("hits", [])
    out = []
    for hit in hits:
        src = hit.get("_source", {})
        adsh = src.get("adsh")
        if not adsh:
            continue
        out.append({
            "accession": adsh,
            "filedDate": src.get("file_date", ""),
            "reportDate": src.get("period_ending", ""),
        })
    return out


def infer_report_date(filed_date: str) -> str:
    if not filed_date or len(filed_date) < 7:
        return ""
    month = int(filed_date[5:7])
    year = int(filed_date[:4])
    if month <= 2:
        return f"{year - 1}-12-31"
    if month <= 5:
        return f"{year}-03-31"
    if month <= 8:
        return f"{year}-06-30"
    return f"{year}-09-30"


def report_date_from_primary(cik: str, acc_nodash: str) -> str:
    try:
        xml = fetch_text(
            f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/primary_doc.xml"
        )
    except Exception:
        return ""
    m = re.search(r"<reportCalendarOrQuarter>([^<]+)</reportCalendarOrQuarter>", xml, re.I)
    if not m:
        return ""
    raw = m.group(1).strip()
    if re.match(r"\d{2}-\d{2}-\d{4}", raw):
        parts = raw.split("-")
        return f"{parts[2]}-{parts[0]}-{parts[1]}"
    return raw


def find_infotable_from_index(index: dict) -> str | None:
    items = index.get("directory", {}).get("item", [])
    xml_files = [
        item.get("name", "")
        for item in items
        if str(item.get("name", "")).lower().endswith(".xml")
        and "primary_doc" not in str(item.get("name", "")).lower()
        and "index" not in str(item.get("name", "")).lower()
    ]
    if not xml_files:
        return None
    return sorted(xml_files, key=len, reverse=True)[0]


def pick_filing(cik: str) -> dict:
    filings = browse_edgar_filings(cik)
    if not filings:
        efts = efts_search(cik)
        if not efts:
            raise RuntimeError("No 13F-HR filing found (browse-edgar and EFTS empty)")
        chosen = efts[0]
        if not chosen.get("reportDate"):
            chosen["reportDate"] = infer_report_date(chosen.get("filedDate", ""))
        return chosen

    for candidate in filings:
        acc_nodash = candidate["accession"].replace("-", "")
        report = report_date_from_primary(cik, acc_nodash)
        if not report:
            report = infer_report_date(candidate["filedDate"])
        candidate["reportDate"] = report
        if report in PREFERRED_PERIODS:
            return candidate

    filings[0]["reportDate"] = report_date_from_primary(
        cik, filings[0]["accession"].replace("-", "")
    ) or infer_report_date(filings[0]["filedDate"])
    return filings[0]


def latest_13f_holdings(cik: str, top_n: int = 25) -> dict:
    filing = pick_filing(cik)
    accession = filing["accession"]
    acc_nodash = accession.replace("-", "")
    index = fetch_json(
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/index.json"
    )
    xml_name = find_infotable_from_index(index)
    if not xml_name:
        raise RuntimeError("infotable xml missing in filing index")
    xml_text = fetch_text(
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{xml_name}"
    )
    if "<infoTable>" not in xml_text and "infoTable" not in xml_text:
        raise RuntimeError("downloaded file does not look like 13F infotable XML")
    holdings = aggregate_holdings(parse_infotable_xml(xml_text))[:top_n]
    return {
        "filedDate": filing["filedDate"],
        "reportDate": filing.get("reportDate", ""),
        "accession": accession,
        "holdings": holdings,
    }


def main() -> None:
    payload = {
        "updatedAtKst": datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST"),
        "source": "SEC EDGAR 13F-HR (public filings)",
        "note": "분기마다 제출되는 공시 기준 보유 내역입니다. 실시간 매매가 아닙니다.",
        "institutions": [],
    }
    ok = 0
    for inst in INSTITUTIONS:
        try:
            filing = latest_13f_holdings(inst["cik"])
            payload["institutions"].append({**inst, **filing, "status": "ok"})
            ok += 1
            print(f"[ok] {inst['name']} report={filing['reportDate']} top={filing['holdings'][0]['issuer'] if filing['holdings'] else '-'}")
        except Exception as exc:
            payload["institutions"].append({**inst, "status": "error", "error": str(exc), "holdings": []})
            print(f"[err] {inst['name']}: {exc}")
        time.sleep(0.35)

    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JS.write_text(
        "window.INSTITUTIONAL_13F = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_JSON} ({ok}/{len(INSTITUTIONS)} ok)")


if __name__ == "__main__":
    main()