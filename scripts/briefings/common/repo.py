from pathlib import Path


def repo_root() -> Path:
    """Mir_US_Stocks repository root (scripts/briefings/common/repo.py -> parents[3])."""
    return Path(__file__).resolve().parents[3]


def scripts_dir() -> Path:
    return repo_root() / "scripts"