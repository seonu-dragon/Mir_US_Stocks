"""US Congress member party lookup via unitedstates/congress-legislators."""

from __future__ import annotations

import json
import re
import urllib.request
from dataclasses import dataclass
from functools import lru_cache

CURRENT_URL = (
    "https://raw.githubusercontent.com/unitedstates/congress-legislators/"
    "gh-pages/legislators-current.json"
)
HISTORICAL_URL = (
    "https://raw.githubusercontent.com/unitedstates/congress-legislators/"
    "gh-pages/legislators-historical.json"
)

SUFFIX_RE = re.compile(r"\b(jr|sr|ii|iii|iv)\.?$", re.I)
HONORIFIC_TOKENS = {"mr", "mrs", "ms", "miss", "dr", "hon", "rep", "sen"}
PARTY_MAP = {
    "democrat": "D",
    "democratic": "D",
    "republican": "R",
    "independent": "I",
    "d": "D",
    "r": "R",
    "i": "I",
}


@dataclass(frozen=True)
class MemberRecord:
    first: str
    last: str
    nickname: str
    chamber: str
    party: str
    display_name: str


def normalize_party_code(raw: str | None) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    key = text.lower().rstrip(".")
    if key in PARTY_MAP:
        return PARTY_MAP[key]
    if key.startswith("democrat"):
        return "D"
    if key.startswith("republican"):
        return "R"
    if key.startswith("independent"):
        return "I"
    return text.upper() if len(text) == 1 else ""


def _normalize_token(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = SUFFIX_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def _collapse_duplicate_name_tokens(name: str) -> str:
    parts = [p for p in re.split(r"\s+", (name or "").strip()) if p and p != "."]
    if not parts:
        return ""
    cleaned = [p for p in parts if _normalize_token(p) not in HONORIFIC_TOKENS]
    parts = cleaned or parts
    deduped: list[str] = []
    for part in parts:
        if deduped and _normalize_token(deduped[-1]) == _normalize_token(part):
            continue
        deduped.append(part)
    return " ".join(deduped)


def _parse_person_name(name: str) -> tuple[str, str]:
    text = _collapse_duplicate_name_tokens(name)
    if not text:
        return "", ""
    text = SUFFIX_RE.sub("", text).strip(" ,")
    parts = [p for p in re.split(r"\s+", text) if p and p != "."]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return "", _normalize_token(parts[0])
    first = _normalize_token(parts[0])
    last = _normalize_token(parts[-1])
    return first, last


def _first_name_match(query_first: str, member: MemberRecord) -> bool:
    if not query_first:
        return True
    candidates = {_normalize_token(member.first), _normalize_token(member.nickname)}
    candidates = {c for c in candidates if c}
    for cand in candidates:
        if query_first == cand:
            return True
        if cand.startswith(query_first) or query_first.startswith(cand):
            return True
        if query_first and cand and query_first[0] == cand[0]:
            return True
    return False


def _chamber_from_term(term_type: str) -> str:
    return "Senate" if term_type == "sen" else "House"


def _fetch_legislators(url: str) -> list[dict]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; MirUSStocks/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data if isinstance(data, list) else []


def _member_records_from_legislator(row: dict) -> list[MemberRecord]:
    name = row.get("name") or {}
    first = str(name.get("first") or "").strip()
    middle = str(name.get("middle") or "").strip()
    last = str(name.get("last") or "").strip()
    nickname = str(name.get("nickname") or "").strip()
    official = str(name.get("official_full") or "").strip()
    display = official or " ".join(x for x in [first, middle, last] if x).strip()

    records: list[MemberRecord] = []
    for term in row.get("terms") or []:
        party = normalize_party_code(term.get("party"))
        if not party:
            continue
        chamber = _chamber_from_term(str(term.get("type") or ""))
        records.append(
            MemberRecord(
                first=first,
                last=_normalize_token(last),
                nickname=nickname,
                chamber=chamber,
                party=party,
                display_name=display,
            )
        )
    return records


class CongressPartyLookup:
    def __init__(self, members: list[MemberRecord] | None = None):
        self._by_chamber_last: dict[tuple[str, str], list[MemberRecord]] = {}
        self._by_display: dict[tuple[str, str], str] = {}
        if members is not None:
            self._load_members(members)

    @classmethod
    def from_remote(cls) -> "CongressPartyLookup":
        rows: list[dict] = []
        for url in (CURRENT_URL, HISTORICAL_URL):
            try:
                rows.extend(_fetch_legislators(url))
            except Exception as exc:
                print(f"[warn] legislator fetch failed ({url}): {exc}")
        members: list[MemberRecord] = []
        for row in rows:
            members.extend(_member_records_from_legislator(row))
        return cls(members)

    def _load_members(self, members: list[MemberRecord]) -> None:
        for member in members:
            key = (member.chamber, member.last)
            bucket = self._by_chamber_last.setdefault(key, [])
            if not any(
                m.first == member.first and m.nickname == member.nickname and m.party == member.party
                for m in bucket
            ):
                bucket.append(member)

            display_key = (_normalize_token(member.display_name), member.chamber)
            self._by_display.setdefault(display_key, member.party)

    def lookup(self, name: str, chamber: str) -> str:
        chamber = (chamber or "").strip() or "House"
        name = _collapse_duplicate_name_tokens(name)
        normalized_display = _normalize_token(name)
        direct = self._by_display.get((normalized_display, chamber))
        if direct:
            return direct

        first, last = _parse_person_name(name)
        if not last:
            return ""

        candidates = list(self._by_chamber_last.get((chamber, last), []))
        if not candidates:
            return ""

        if len(candidates) == 1:
            return candidates[0].party

        matched = [m for m in candidates if _first_name_match(first, m)]
        if len(matched) == 1:
            return matched[0].party
        if matched:
            return matched[-1].party
        return ""


@lru_cache(maxsize=1)
def get_party_lookup() -> CongressPartyLookup:
    return CongressPartyLookup.from_remote()


def lookup_party(name: str, chamber: str) -> str:
    return get_party_lookup().lookup(name, chamber)