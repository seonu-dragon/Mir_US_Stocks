from pathlib import Path
import sys

if sys.platform == "win32":
    # cp949 콘솔에서 한글 출력이 UnicodeEncodeError 로 죽어 실행 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def repo_root() -> Path:
    """Mir_US_Stocks repository root (scripts/briefings/common/repo.py -> parents[3])."""
    return Path(__file__).resolve().parents[3]


def scripts_dir() -> Path:
    return repo_root() / "scripts"