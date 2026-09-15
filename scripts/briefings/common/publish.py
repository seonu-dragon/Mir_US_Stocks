import sys

from repo import repo_root, scripts_dir

if sys.platform == "win32":
    # cp949 콘솔에서 한글 출력이 UnicodeEncodeError 로 죽어 실행 실패로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def publish_briefing_to_site(key, html, commit_label, mutate=None):
    project_dir = repo_root()
    scripts_path = scripts_dir()
    if str(scripts_path) not in sys.path:
        sys.path.insert(0, str(scripts_path))
    from briefing_store import publish_briefing

    return publish_briefing(project_dir, key, html, commit_label, mutate)