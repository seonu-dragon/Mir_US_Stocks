"""Known US Congress member → standing committee mapping (curated subset).

Sources: congress.gov committee rosters (118th–119th Congress). Used for
committee ↔ sector cross-analysis when a politician is not in this list, we
match by chamber-wide activity only.
"""

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
    "Thomas R Carper": {"chamber": "Senate", "party": "D", "committees": ["Finance", "Environment"]},
    "Tom Carper": {"chamber": "Senate", "party": "D", "committees": ["Finance"]},
    "Pat Roberts": {"chamber": "Senate", "party": "R", "committees": ["Finance", "Agriculture"]},
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


def lookup_politician(name: str):
    name = (name or "").strip()
    if not name:
        return None
    if name in POLITICIAN_COMMITTEES:
        return POLITICIAN_COMMITTEES[name]
    for key, meta in POLITICIAN_COMMITTEES.items():
        if key.lower() in name.lower() or name.lower() in key.lower():
            return meta
    return None