#!/usr/bin/env python3
"""One-off fetch test for SEC 13F via EFTS + Archives."""
import json
import re
import time
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

SEC_HEADERS = {
    "User-Agent": "Mir US Stocks mir-us-stocks@users.noreply.github.com",
    "Accept": "application/json,text/xml,*/*",
}

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

KNOWN = {
    "1067983": {
        "accession": "0001193125-26-054580",
        "filedDate": "2026-02-17",
        "reportDate": "2025-12-31",
        "xml_name": "50240.xml",
    }
}


def fetch_text(url):
    req = urllib.request.Request(url, headers=SEC_HEADERS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_json(url):
    return json.loads(fetch_text(url))


def efts_search(cik):
    url = (
        "https://efts.sec.gov/LATEST/search-index"
        f"?q=&forms=13F-HR&ciks={cik}&dateRange=custom"
        "&startdt=2025-01-01&enddt=2026-06-30"
    )
    try:
        return fetch_json(url)
    except Exception as e:
        return {"error": str(e)}


def parse_infotable_xml(text):
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


def aggregate_holdings(rows):
    by_key = {}
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


def find_infotable_from_index(index):
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


def pick_efts_hit(data, cik):
    hits = data.get("hits", {}).get("hits", [])
    preferred_periods = {"2025-12-31", "2026-03-31"}
    candidates = []
    for hit in hits:
        src = hit.get("_source", {})
        if src.get("ciks") and str(cik) not in [str(x) for x in src.get("ciks", [])]:
            continue
        adsh = src.get("adsh", "")
        if not adsh:
            continue
        file_type = str(src.get("file_type", "")).upper()
        is_infotable = "INFORMATION TABLE" in file_type or file_type.endswith(".XML")
        candidates.append({
            "adsh": adsh,
            "file_date": src.get("file_date", ""),
            "period_ending": src.get("period_ending", ""),
            "file_type": src.get("file_type", ""),
            "is_infotable": is_infotable,
            "display_names": src.get("display_names", []),
        })
    if not candidates:
        return None
    # prefer infotable entries, then preferred period, then latest file_date
    candidates.sort(
        key=lambda c: (
            c["is_infotable"],
            c["period_ending"] in preferred_periods,
            c["period_ending"],
            c["file_date"],
        ),
        reverse=True,
    )
    return candidates[0]


def process_institution(inst):
    cik = inst["cik"]
    if cik in KNOWN:
        k = KNOWN[cik]
        acc_nodash = k["accession"].replace("-", "")
        xml_name = k["xml_name"]
        xml_text = fetch_text(
            f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{xml_name}"
        )
        holdings = aggregate_holdings(parse_infotable_xml(xml_text))[:25]
        return {
            **inst,
            "status": "ok",
            "filedDate": k["filedDate"],
            "reportDate": k["reportDate"],
            "accession": k["accession"],
            "holdings": holdings,
        }

    efts = efts_search(cik)
    if "error" in efts:
        raise RuntimeError(f"EFTS error: {efts['error']}")
    hit = pick_efts_hit(efts, cik)
    if not hit:
        raise RuntimeError("No 13F-HR hits in EFTS")
    accession = hit["adsh"]
    acc_nodash = accession.replace("-", "")
    index = fetch_json(
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/index.json"
    )
    xml_name = find_infotable_from_index(index)
    if not xml_name:
        raise RuntimeError("infotable xml missing")
    xml_text = fetch_text(
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{xml_name}"
    )
    holdings = aggregate_holdings(parse_infotable_xml(xml_text))[:25]
    return {
        **inst,
        "status": "ok",
        "filedDate": hit["file_date"],
        "reportDate": hit["period_ending"],
        "accession": accession,
        "holdings": holdings,
    }


def main():
    for inst in INSTITUTIONS:
        try:
            if inst["cik"] not in KNOWN:
                efts = efts_search(inst["cik"])
                total = efts.get("hits", {}).get("total", {})
                print(f"EFTS {inst['id']}: total={total}")
                hits = efts.get("hits", {}).get("hits", [])[:3]
                for h in hits:
                    s = h.get("_source", {})
                    print(f"  {s.get('file_date')} period={s.get('period_ending')} adsh={s.get('adsh')} type={s.get('file_type')}")
        except Exception as e:
            print(f"EFTS {inst['id']} error: {e}")
        time.sleep(0.3)


if __name__ == "__main__":
    main()