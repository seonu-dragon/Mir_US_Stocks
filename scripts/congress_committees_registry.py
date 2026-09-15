"""Known US Congress member → standing committee mapping (curated subset).

Sources: congress.gov committee rosters (118th-119th Congress). Used for
committee <-> sector cross-analysis; a politician not in this list is matched
by chamber-wide activity only.

**손으로 관리하는 부분 목록이고, 주기적으로 갱신해야 한다.** 2026-09-15 감사에서
이미 의원이 아닌 사람(팻 로버츠 2021년 퇴임, 톰 카퍼 2025년 퇴임)이 그대로 남아
현직처럼 위원회·정당이 붙고 있었다. 퇴임이 확인된 항목에는 ``servedUntil`` 을
찍고, ``lookup_politician`` 이 그 날짜가 지난 항목을 돌려주지 않는다.

정당(party)은 이 파일이 아니라 ``congress_party_lookup``(unitedstates/
congress-legislators 원본을 매 실행 내려받음)이 1차 소스다. 위원회 배정은
그 데이터셋에 없어 이 목록을 유지한다 — 새 회기가 열리면 congress.gov 로
확인해 갱신할 것.
"""

from datetime import date

COMMITTEE_SECTOR_MAP = {
    "Armed Services": ["Industrials", "Technology", "Energy"],
    "Financial Services": ["Financials", "Real Estate", "Technology"],
    "Energy and Commerce": ["Energy", "Health Care", "Technology", "Communication Services"],
    "Ways and Means": ["Financials", "Health Care", "Consumer Staples"],
    "Judiciary": ["Communication Services", "Technology"],
    "Foreign Affairs": ["Energy", "Industrials", "Technology"],
    "Foreign Relations": ["Energy", "Industrials", "Technology"],
    "Banking": ["Financials", "Real Estate"],
    "Commerce": ["Technology", "Consumer Discretionary", "Communication Services"],
    "Homeland Security": ["Industrials", "Technology"],
    "Intelligence": ["Technology", "Communication Services", "Industrials"],
    "Appropriations": ["Industrials", "Health Care", "Defense"],
    "Budget": ["Financials", "Industrials"],
    "Science, Space, and Technology": ["Technology", "Industrials"],
    "Transportation and Infrastructure": ["Industrials", "Energy", "Materials"],
    "Agriculture": ["Consumer Staples", "Materials", "Energy"],
    "Veterans' Affairs": ["Health Care", "Industrials"],
}

POLITICIAN_COMMITTEES = {
    "Nancy Pelosi": {"chamber": "House", "party": "D", "committees": ["Financial Services"]},
    "Josh Gottheimer": {"chamber": "House", "party": "D", "committees": ["Financial Services"]},
    "Ro Khanna": {"chamber": "House", "party": "D", "committees": ["Armed Services"]},
    "Michael McCaul": {"chamber": "House", "party": "R", "committees": ["Foreign Affairs", "Homeland Security"]},
    "Pat Fallon": {"chamber": "House", "party": "R", "committees": ["Armed Services"]},
    "Dan Crenshaw": {"chamber": "House", "party": "R", "committees": ["Energy and Commerce", "Intelligence"]},
    "Marjorie Taylor Greene": {"chamber": "House", "party": "R", "committees": ["Homeland Security"]},
    "Thomas H. Tuberville": {"chamber": "Senate", "party": "R", "committees": ["Armed Services", "Agriculture"]},
    "Tommy Tuberville": {"chamber": "Senate", "party": "R", "committees": ["Armed Services", "Agriculture"]},
    "Ron L Wyden": {"chamber": "Senate", "party": "D", "committees": ["Finance", "Energy and Commerce"]},
    "Ron Wyden": {"chamber": "Senate", "party": "D", "committees": ["Finance"]},
    "Richard Blumenthal": {"chamber": "Senate", "party": "D", "committees": ["Judiciary", "Commerce"]},
    # servedUntil 이 지난 항목은 lookup_politician 이 돌려주지 않는다(퇴임 의원).
    "Thomas R Carper": {"chamber": "Senate", "party": "D", "committees": ["Finance", "Environment"],
                        "servedUntil": "2025-01-03"},
    "Tom Carper": {"chamber": "Senate", "party": "D", "committees": ["Finance"],
                   "servedUntil": "2025-01-03"},
    "Pat Roberts": {"chamber": "Senate", "party": "R", "committees": ["Finance", "Agriculture"],
                    "servedUntil": "2021-01-03"},
    "Markwayne Mullin": {"chamber": "Senate", "party": "R", "committees": ["Armed Services", "Environment"]},
    "John Boozman": {"chamber": "Senate", "party": "R", "committees": ["Agriculture", "Appropriations"]},
    "Sheldon Whitehouse": {"chamber": "Senate", "party": "D", "committees": ["Judiciary", "Budget"]},
    "Ted Cruz": {"chamber": "Senate", "party": "R", "committees": ["Commerce", "Judiciary"]},
    "Tom Cotton": {"chamber": "Senate", "party": "R", "committees": ["Armed Services", "Intelligence"]},
    "Elizabeth Warren": {"chamber": "Senate", "party": "D", "committees": ["Banking", "Armed Services"]},
    "Bernie Sanders": {"chamber": "Senate", "party": "I", "committees": ["Budget", "Veterans' Affairs"]},
    "Chuck Schumer": {"chamber": "Senate", "party": "D", "committees": ["Finance"]},
    "Mitch McConnell": {"chamber": "Senate", "party": "R", "committees": ["Appropriations"]},
}


def _is_current(meta: dict, today: date | None = None) -> bool:
    """servedUntil 이 지난 항목은 더 이상 쓰지 않는다."""
    until = (meta or {}).get("servedUntil")
    if not until:
        return True
    try:
        return (today or date.today()) <= date.fromisoformat(until)
    except ValueError:
        return True


def lookup_politician(name: str, today: date | None = None):
    name = (name or "").strip()
    if not name:
        return None
    meta = POLITICIAN_COMMITTEES.get(name)
    if meta is not None:
        return meta if _is_current(meta, today) else None
    for key, meta in POLITICIAN_COMMITTEES.items():
        if key.lower() in name.lower() or name.lower() in key.lower():
            return meta if _is_current(meta, today) else None
    return None