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


# ---- P0-c: 리치몬드·캔자스시티 xlsx, World Bank Pink Sheet ----
def test_excel_serial_to_key():
    assert IF.excel_serial_to_key("46235") == "2026-08"
    assert IF.excel_serial_to_key("46235", monthly=False) == "2026-08-01"
    assert IF.excel_serial_to_key("abc") is None and IF.excel_serial_to_key("5") is None


def test_richmond_composite_parses_serial_dates_and_skips_na():
    rows = [["date", "nsa_mfg_ship_c", "sa_mfg_composite"], ["34274", "4", "#N/A"], ["46235", "9", "-1"], ["46205", "1", "7"]]
    assert IF.parse_richmond_mfg(rows) == [("2026-07", 7.0), ("2026-08", -1.0)]
    assert IF.parse_richmond_mfg([["date", "x"]]) == []


def test_kcfed_horizontal_layout_uses_first_composite_block():
    rows = [["Table2"], ["Historical Manufacturing Survey Indexes"], ["", "37103", "37134", "46199", "46229", "46260", "46291"],
            ["Versus a Month Ago"], ["Composite Index", "-16", "0", "11", "9", "10", ""], ["Versus a Year Ago"], ["Composite Index", "5", "5", "5", "5", "5", "5"]]
    out = IF.parse_kcfed_mfg(rows)
    assert out[0] == ("2001-07", -16.0) and out[-1] == ("2026-08", 10.0) and len(out) == 5


def test_wb_pink_sheet_finds_column_by_prefix():
    rows = [["World Bank Commodity Price Data"], [""], [""], ["Updated"],
            ["", "Crude oil, average", "Urea ", "Potassium chloride **"], ["", "($/bbl)", "($/mt)", "($/mt)"],
            ["2026M07", "80", "385", "390"], ["2026M08", "84.4", "390", "386.9"]]
    assert IF.parse_wb_pink(rows, "Urea") == [("2026-07", 385.0), ("2026-08", 390.0)]
    assert IF.parse_wb_pink(rows, "Potassium chloride")[-1] == ("2026-08", 386.9)
    assert IF.parse_wb_pink(rows, "없음") == []


# ---- 2026-10-22: 해운 운임·오피넷·마카오·SPDR·npm·Docker·StatCounter 파서 ----
KCCI_HTML = """<table><tr><th>Group</th><th>Code</th><th>Route</th><th>Weight</th>
<th>Current Index <br/> 2026-10-19</th><th>Previous Index <br/> 2026-10-12</th><th>Weekly Change</th></tr>
<tr><td>Index</td><td>KCCI</td><td>Comprehensive Index</td><td>100%</td><td>4,646</td><td>4,654</td><td>-8(-0.17%)</td></tr>
<tr><td>Mainlane</td><td>KUWI</td><td>USWC</td><td>15%</td><td>8,229</td><td>8,258</td><td>-29</td></tr>
<tr><td>KUEI</td><td>USEC</td><td>10%</td><td>11,590</td><td>11,609</td><td>-19</td></tr></table>"""


def test_kcci_reads_current_and_previous_week():
    assert IF.parse_kobc_kcci(KCCI_HTML) == [("2026-10-12", 4654.0), ("2026-10-19", 4646.0)]
    assert IF.parse_kobc_kcci(KCCI_HTML, "KUEI") == [("2026-10-12", 11609.0), ("2026-10-19", 11590.0)]  # 그룹 칸 없는 행
    assert IF.parse_kobc_kcci("<p>점검</p>") == []


def test_kdci_column_by_header():
    html = ("<table><tr><th>Date</th><th>KDCI</th><th>CAPE</th></tr><tr><td>2026-10-21</td><td>26,570</td><td>36,689</td></tr>"
            "<tr><td>2026-10-20</td><td>26,172</td><td>35,175</td></tr></table>")
    assert IF.parse_kobc_kdci(html) == [("2026-10-20", 26172.0), ("2026-10-21", 26570.0)]
    assert IF.parse_kobc_kdci(html, "CAPE")[-1] == ("2026-10-21", 36689.0)
    assert IF.parse_kobc_kdci(html, "HANDY") == []


OPINET_HTML = """<table><tr><th>기간</th><th>Dubai</th><th>Brent</th><th>WTI</th></tr>
<tr><td>26년10월20일</td><td>927.53</td><td>911.53</td><td>852.88</td></tr><tr><td>26년10월21일</td><td>927.02</td><td>908.97</td><td>811.49</td></tr>
<tr><td>26년10월20일</td><td>110.70</td><td>108.79</td><td>101.79</td></tr><tr><td>26년10월21일</td><td>110.98</td><td>108.82</td><td>0</td></tr></table>"""


def test_opinet_takes_usd_block_and_crack():
    rows = IF.parse_opinet_usd(OPINET_HTML)
    assert rows[0] == ("2026-10-20", [110.70, 108.79, 101.79]) and rows[1][1][:2] == [110.98, 108.82]
    one_block = OPINET_HTML.split("<tr><td>26년10월20일</td><td>110.70")[0] + "</table>"
    assert IF.parse_opinet_usd(one_block) == []  # 원화·달러 구분이 안 되면 쓰지 않는다
    products = [("2026-10-20", {"diesel001": 178.33}), ("2026-10-21", {"diesel001": 179.79}), ("2026-10-22", {"diesel001": 181.0})]
    assert IF.crack_spreads(products, [("2026-10-20", 110.70), ("2026-10-21", 110.98)], "diesel001") == [("2026-10-20", 67.63), ("2026-10-21", 68.81)]


def test_macau_ggr_skips_unpublished_months():
    xml = ("<DATA><RECORD><DATA css='formheading'>Jan</DATA><DATA>22,633</DATA><DATA>18,254</DATA></RECORD>"
           "<RECORD><DATA css='formheading'>Feb</DATA><DATA>-</DATA><DATA>19,744</DATA></RECORD>"
           "<RECORD><DATA css='formheading'>Total</DATA><DATA>22,633</DATA></RECORD></DATA>")
    assert IF.parse_macau_ggr(xml, 2026) == [("2026-01", 22633.0)]


def test_spdr_flows_from_share_changes():
    rows = [["Ticker Symbol:", "XLK"], ["Date", "NAV", "Shares Outstanding"],
            ["20-Oct-2026", "185.0", "6.6E8"], ["19-Oct-2026", "186.0", "6.5E8"], ["16-Oct-2026", "183.0", "6.5E8"]]
    assert IF.parse_spdr_flows(rows) == [("2026-10-19", 0.0), ("2026-10-20", 1.85)]


def test_npm_zero_days_are_missing_and_weeks_need_seven_days():
    assert IF.parse_npm_range({"downloads": [{"day": "2026-10-05", "downloads": 0}, {"day": "2026-10-06", "downloads": 5}]}) == [("2026-10-06", 5.0)]
    daily = [(f"2026-10-{d:02d}", 1.0) for d in range(5, 13)]  # 10-05(월)~10-11(일) 7일 + 10-12 하루
    assert IF.weekly_sums(daily) == [("2026-10-05", 7)]
    gappy = [("2026-10-05", 10.0), ("2026-10-07", 20.0), ("2026-10-08", 30.0), ("2026-10-09", 20.0)]  # 4일 관측 → 평균 20 × 7
    assert IF.weekly_sums(gappy) == [("2026-10-05", 140)]
    assert IF.weekly_sums(gappy[:3]) == []


def test_docker_daily_increments_average_gaps_and_drop_decreases():
    cum = [("2026-10-20", 100.0), ("2026-10-21", 130.0), ("2026-10-23", 170.0), ("2026-10-24", 160.0)]
    assert IF.daily_increments(cum) == [("2026-10-21", 30.0), ("2026-10-23", 20.0)]


def test_statcounter_csv_column():
    text = '"Date","Google","bing"\n2026-08,91.02,4.1\n2026-09,89.94,4.4\n'
    assert IF.parse_statcounter_csv(text, "bing") == [("2026-08", 4.1), ("2026-09", 4.4)]
    assert IF.parse_statcounter_csv(text, "Naver") == []


def test_parse_gscpi_rows():
    rows = [["GSCPI", ""], ["31-Jan-1998", -0.5432], ["30-Sep-2026", "1.2841"], ["", None], ["note", 3]]
    assert IF.parse_gscpi_rows(rows) == [("1998-01", -0.543), ("2026-09", 1.284)]


def test_parse_fao_csv():
    text = ("FAO Food Price Index\n2014-2016 = 100\n\nDate,Food Price Index,Meat,Dairy,Cereals,Oils,Sugar\n"
            "1990-01,64.2,52.8,62.0,61.2,44.6,98.6\n2026-09,136.0,128.1,150.2,110.4,170.9,99.0\n,,,\n")
    assert IF.parse_fao_csv(text) == [("1990-01", 64.2), ("2026-09", 136.0)]
    assert IF.parse_fao_csv(text, "Oils")[-1] == ("2026-09", 170.9)
    assert IF.parse_fao_csv("no header") == []


def test_statcounter_device_url():
    dev, hidden = IF.STATCOUNTER_DEVICES["mobile"]
    url = IF.STATCOUNTER.format(device=dev, device_hidden=hidden, stat="vendor", region="ww", stat_name="Mobile Vendor",
                                region_name="Worldwide", start="201901", end="202609", start_d="2019-01", end_d="2026-09")
    assert "device=Mobile&device_hidden=mobile&statType_hidden=vendor" in url
    assert "{" not in url


def test_parse_tsa_and_rolling_mean():
    html = ('<table><tr><td class="x">10/20/2026</td><td class="x">2,154,162</td></tr>'
            '<tr><td>10/19/2026</td><td>2,724,075</td></tr><tr><td>1/2/2026</td><td>0</td></tr></table>')
    assert IF.parse_tsa_html(html) == [("2026-10-19", 2724075.0), ("2026-10-20", 2154162.0)]
    daily = [(f"2026-10-{d:02d}", float(d)) for d in range(1, 10) if d != 5]
    # 10-05 가 빠져 1~7·2~8 창은 건너뛰고 6~9 만으로는 7일이 안 된다 → 빈 결과
    assert IF.rolling_mean(daily, 7) == []
    full = [(f"2026-10-{d:02d}", float(d)) for d in range(1, 9)]
    assert IF.rolling_mean(full, 7) == [("2026-10-07", 4), ("2026-10-08", 5)]


def test_parse_pypistats_overall():
    payload = {"data": [{"category": "with_mirrors", "date": "2026-10-01", "downloads": 9},
                        {"category": "without_mirrors", "date": "2026-10-02", "downloads": 5},
                        {"category": "without_mirrors", "date": "2026-10-01", "downloads": 4},
                        {"category": "without_mirrors", "date": "2026-10-03", "downloads": 0}]}
    assert IF.parse_pypistats_overall(payload) == [("2026-10-01", 4.0), ("2026-10-02", 5.0)]
