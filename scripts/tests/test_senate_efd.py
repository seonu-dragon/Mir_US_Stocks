"""상원 eFD PTR 파서 (2026-10-02) — 네트워크 없이 표/검색 행 형식만 검증한다."""
from __future__ import annotations

import build_congress_trades as B
import senate_efd as E

PTR_HTML = """
<table class="table table-striped"><thead><tr><th>#</th><th>Transaction Date</th><th>Owner</th>
<th>Ticker</th><th>Asset Name</th><th>Asset Type</th><th>Type</th><th>Amount</th><th>Comment</th></tr></thead>
<tbody>
<tr><td>1</td><td>09/12/2026</td><td>Spouse</td><td><a href="https://finance.yahoo.com/q?s=NVDA" target="_blank">NVDA</a></td>
<td>NVIDIA Corporation</td><td>Stock</td><td>Purchase</td><td>$1,001 - $15,000</td><td>--</td></tr>
<tr><td>2</td><td>09/15/2026</td><td>Self</td><td>--</td><td>US Treasury Bill</td><td>Other Securities</td>
<td>Sale (Full)</td><td>$15,001 - $50,000</td><td>--</td></tr>
</tbody></table>
"""


def test_parse_ptr_table():
    rows = E.parse_ptr_html(PTR_HTML)
    assert len(rows) == 2
    assert rows[0] == {"transaction_date": "09/12/2026", "owner": "Spouse", "ticker": "NVDA",
                       "asset_description": "NVIDIA Corporation", "asset_type": "Stock",
                       "type": "Purchase", "amount": "$1,001 - $15,000"}
    assert rows[1]["ticker"] == ""


def test_parse_search_rows_skips_unlinked_and_marks_paper():
    data = [
        ["Shelley M", "Capito", "Capito, Shelley Moore (Senator)",
         '<a href="/search/view/ptr/AB12CD34-0000-1111-2222-333344445555/" target="_blank">Periodic Transaction Report for 09/20/2026</a>',
         "09/22/2026"],
        ["John", "Doe", "Doe, John (Senator)",
         '<a href="/search/view/paper/99AA0000-0000-0000-0000-000000000000/" target="_blank">Periodic Transaction Report</a>',
         "09/01/2026"],
        ["x", "y", "z", "no link", "09/01/2026"],
    ]
    reps = E.parse_search_rows(data)
    assert [r["kind"] for r in reps] == ["ptr", "paper"]
    assert reps[0]["id"] == "ab12cd34-0000-1111-2222-333344445555"
    assert reps[0]["senator"] == "Shelley M Capito"
    assert reps[0]["filed"] == "09/22/2026"


def test_normalize_keeps_disclosure_date():
    row = {**E.parse_ptr_html(PTR_HTML)[0], "senator": "Shelley M Capito", "disclosure_date": "09/22/2026",
           "ptr_link": "https://efdsearch.senate.gov/search/view/ptr/x/"}
    t = B._normalize_senate(row)
    assert t["chamber"] == "Senate" and t["ticker"] == "NVDA" and t["side"] == "buy"
    assert t["transactionDate"] == "2026-09-12" and t["disclosureDate"] == "2026-09-22"
    assert t["amountMid"] == 8000
