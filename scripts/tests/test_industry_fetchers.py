"""industry_fetchers — P0-b 무키 소스 파서 (오프라인). 실응답 조각을 그대로 고정한다(2026-09-18 실측)."""
from __future__ import annotations

import io
import zipfile

import industry_fetchers as IF


def test_parse_date_any_covers_every_source_format():
    assert IF.parse_date_any("2026-09-16") == "2026-09-16"
    assert IF.parse_date_any("09/17/2026") == "2026-09-17"
    assert IF.parse_date_any("7/1/2026") == "2026-07-01"
    assert IF.parse_date_any("2026-M08") == "2026-08"
    assert IF.parse_date_any("2026M08") == "2026-08"
    assert IF.parse_date_any("2026-Q1") == "2026-Q1"
    assert IF.parse_date_any("Jul-26p") == "2026-07"
    assert IF.parse_date_any("Jun-26r") == "2026-06"
    assert IF.parse_date_any("202608") == "2026-08"
    assert IF.parse_date_any("") is None and IF.parse_date_any("n/a") is None


def test_ofr_and_cboe_csv():
    ofr = "Date,OFR FSI,Credit,Equity valuation\n2026-09-14,-2.226,-1.136,-0.543\n2026-09-15,-2.1,-1.14,-0.5\n"
    assert IF.parse_csv_series(ofr, "Date", "OFR FSI") == [("2026-09-14", -2.226), ("2026-09-15", -2.1)]
    assert IF.parse_csv_series(ofr, "Date", "Credit")[-1] == ("2026-09-15", -1.14)
    vix = "﻿DATE,OPEN,HIGH,LOW,CLOSE\n09/16/2026,19.5,20.1,19.2,19.73\n09/17/2026,19.7,19.9,18.4,18.55\n"
    assert IF.parse_csv_series(vix, "DATE", "CLOSE")[-1] == ("2026-09-17", 18.55)
    skew = "DATE,SKEW\n09/17/2026,145.700000\n"
    assert IF.parse_csv_series(skew, "DATE", None) == [("2026-09-17", 145.7)]


def test_frb_monthly_csv_normalizes_to_month_key():
    ebp = "date,gz_spread,ebp,est_prob\n6/1/2026,0.9,-0.2,0.12\n7/1/2026,0.84,-0.319112793,0.108\n"
    assert IF.parse_csv_series(ebp, "date", "ebp", monthly=True) == [("2026-06", -0.2), ("2026-07", -0.319112793)]
    fci = "date,FCI-G Index (baseline),FFR\n2026-06-30,-0.8,0.1\n2026-07-31,-0.87733,0.05\n"
    assert IF.parse_csv_series(fci, "date", "FCI-G Index (baseline)", monthly=True)[-1] == ("2026-07", -0.87733)


def test_sdmx_csv_imf_and_bis():
    imf = ("DATAFLOW,COUNTRY,INDICATOR,DATA_TRANSFORMATION,FREQUENCY,TIME_PERIOD,OBS_VALUE,SCALE\n"
           "IMF.RES:PCPS(9.0.0),G001,PLITH,USD,M,2026-M07,156809.13,0\n"
           "IMF.RES:PCPS(9.0.0),G001,PLITH,USD,M,2026-M08,148620.0,0\n")
    assert IF.parse_csv_series(imf, "TIME_PERIOD", "OBS_VALUE") == [("2026-07", 156809.13), ("2026-08", 148620.0)]
    bis = ("DATAFLOW,FREQ,EER_TYPE,EER_BASKET,REF_AREA,TIME_PERIOD,OBS_VALUE,TIME_FORMAT\n"
           "BIS:WS_EER(1.0),M,R,B,KR,2026-06,83.04,\nBIS:WS_EER(1.0),M,R,B,KR,2026-07,85.45,\n")
    assert IF.parse_csv_series(bis, "TIME_PERIOD", "OBS_VALUE")[-1] == ("2026-07", 85.45)
    q = "DATAFLOW,FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE\nBIS:WS_CREDIT_GAP(1.0),Q,KR,2026-Q1,-15.13\n"
    assert IF.parse_csv_series(q, "TIME_PERIOD", "OBS_VALUE") == [("2026-Q1", -15.13)]


def test_boj_json_skips_nulls():
    payload = {"RESULTSET": [{"SERIES_CODE": "PRCG20_2300550006",
                              "VALUES": {"SURVEY_DATES": [202606, 202607, 202608, 202609], "VALUES": [279.5, 286.6, 293.4, None]}}]}
    assert IF.parse_boj(payload, "PRCG20_2300550006") == [("2026-06", 279.5), ("2026-07", 286.6), ("2026-08", 293.4)]
    assert IF.parse_boj(payload, "OTHER") == []


def test_tga_uses_open_today_bal_and_trillions():
    payload = {"data": [{"record_date": "2026-09-16", "open_today_bal": "991708"}, {"record_date": "2026-09-15", "open_today_bal": "991557"}]}
    out = IF.parse_tga(payload)
    assert out[0][0] == "2026-09-15" and abs(out[1][1] - 0.991708) < 1e-9


def test_defillama_deribit_altme_json():
    rows = [{"date": "1757980800", "totalCirculatingUSD": {"peggedUSD": 300e9}}, {"date": "1758067200", "totalCirculatingUSD": {"peggedUSD": 301e9}}]
    out = IF.parse_defillama_stablecoins(rows)
    assert out[-1] == ("2025-09-17", 301.0) and out[0][0] == "2025-09-16"  # epoch 1757980800 = 2025-09-16 UTC
    d = IF.parse_deribit_dvol({"result": {"data": [[1758067200000, 38.0, 39.0, 37.0, 38.48]]}})
    assert d == [("2025-09-17", 38.48)]
    f = IF.parse_altme_fng({"data": [{"value": "56", "timestamp": "1789689600"}, {"value": "50", "timestamp": "1789603200"}]})
    assert f[-1][1] == 56 and f[0][1] == 50


def test_cboe_putcall_picks_equity_ratio():
    payload = {"ratios": [{"name": "TOTAL PUT/CALL RATIO", "value": "0.98"}, {"name": "EQUITY PUT/CALL RATIO", "value": "0.69"}]}
    assert IF.parse_cboe_putcall(payload) == 0.69
    assert IF.parse_cboe_putcall({"ratios": []}) is None


def test_nrc_daily_average_power():
    text = ("ReportDt|Unit|Power\n9/17/2026 12:00:00 AM|Arkansas Nuclear 1|100\n9/17/2026 12:00:00 AM|Braidwood 1|80\n"
            "9/16/2026 12:00:00 AM|Arkansas Nuclear 1|0\n")
    assert IF.parse_nrc_power(text) == [("2026-09-16", 0.0), ("2026-09-17", 90.0)]


def _xlsx(rows):
    """최소 xlsx: 공유문자열 + sheet1. 셀은 문자열(s) 또는 숫자."""
    strings, cells_xml = [], []
    for ri, row in enumerate(rows, 1):
        cells = []
        for ci, v in enumerate(row):
            ref = f"{chr(65 + ci)}{ri}"
            if isinstance(v, str):
                strings.append(v)
                cells.append(f'<c r="{ref}" t="s"><v>{len(strings) - 1}</v></c>')
            elif v is None:
                continue
            else:
                cells.append(f'<c r="{ref}"><v>{v}</v></c>')
        cells_xml.append(f'<row r="{ri}">{"".join(cells)}</row>')
    ss = "<sst>" + "".join(f"<si><t>{s}</t></si>" for s in strings) + "</sst>"
    sheet = "<worksheet><sheetData>" + "".join(cells_xml) + "</sheetData></worksheet>"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/workbook.xml", "<workbook/>")
        z.writestr("xl/sharedStrings.xml", ss)
        z.writestr("xl/worksheets/sheet1.xml", sheet)
    return buf.getvalue()


def test_census_c30_xlsx_reader_finds_data_center_column():
    data = _xlsx([
        ["Value of Private Construction"], ["(Millions of dollars)"], [],
        ["Date", "Total", "New single family", "Data center", "Financial"],
        ["Jul-26p", 1614171, 859002, 75166, 2810],
        ["Jun-26r", 1622949, 870574, 70755, 2997],
        ["May-26", 1624146, 874705, 65688, 3148],
    ])
    rows = IF.xlsx_first_sheet_rows(data)
    out = IF.parse_census_c30(rows, "Data center")
    assert out == [("2026-05", 65.688), ("2026-06", 70.755), ("2026-07", 75.166)]
    assert IF.parse_census_c30(rows, "없는 열") == []
