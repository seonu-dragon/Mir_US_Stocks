"""워크플로우 이름 참조가 실제 이름과 어긋나지 않았는지 검사한다.

이 검사가 필요한 이유:
deploy-pages.yml 은 데이터 워크플로우의 완료를 `workflow_run` 으로 받아 배포한다.
그런데 `workflow_run` 은 **문자열 이름으로** 워크플로우를 지목한다. 워크플로우
파일에서 `name:` 을 바꾸면 그 참조가 조용히 끊기고, 데이터는 레포에 계속 쌓이는데
사이트에는 영영 반영되지 않는다. 실패가 아니라 '아무 일도 안 일어남'이라 알아채기
어렵다. 실제로 2026-07-17 에 "KR DART disclosures" → "KR DART disclosures + ownership"
로 바뀌면서 이 참조가 끊겼다.

같은 이유로 app.js 의 TRUST_RECOVERY(데이터 신뢰도 센터가 "이 워크플로우를 돌리세요"
라고 안내하는 곳)도 실제 이름을 가리켜야 한다. 안내가 틀리면 사용자가 존재하지 않는
워크플로우를 찾게 된다.

사용법:
    py scripts/check_deploy_triggers.py       # 어긋나면 exit 1
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

if sys.platform == "win32":
    # cp949 콘솔에서 성공 메시지의 U+2014 가 UnicodeEncodeError 로 죽어
    # 검사 통과가 exit 1 로 둔갑한다.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW_DIR = ROOT / ".github" / "workflows"
DEPLOY = WORKFLOW_DIR / "deploy-pages.yml"
APP_JS = ROOT / "app.js"

# 배포 트리거가 필요 없는(=데이터를 커밋하지 않는) 워크플로우.
# "Pages queue watchdog" 는 좀비 queued 배포 run 을 취소만 한다(커밋 없음, 2026-09-02).
NOT_DATA_WORKFLOWS = {"Deploy Pages", "Pages queue watchdog"}


def workflow_names() -> dict[str, str]:
    """실제 워크플로우 name: → 파일명."""
    names: dict[str, str] = {}
    for path in sorted(WORKFLOW_DIR.glob("*.yml")):
        m = re.search(r"^name:\s*(.+?)\s*$", path.read_text(encoding="utf-8"), re.M)
        if m:
            names[m.group(1).strip().strip('"').strip("'")] = path.name
    return names


def deploy_trigger_names() -> list[str]:
    """deploy-pages.yml 의 workflow_run.workflows 목록."""
    text = DEPLOY.read_text(encoding="utf-8")
    block = re.search(r"workflows:\s*\n((?:\s+-\s+.+\n)+)", text)
    if not block:
        return []
    return [
        line.strip().lstrip("-").strip().strip('"').strip("'")
        for line in block.group(1).splitlines()
        if line.strip()
    ]


def trust_recovery_names() -> list[str]:
    """app.js TRUST_RECOVERY 안의 workflow: "..." 값."""
    text = APP_JS.read_text(encoding="utf-8")
    block = re.search(r"const TRUST_RECOVERY = \{(.+?)\n\};", text, re.S)
    if not block:
        return []
    return re.findall(r'workflow:\s*"([^"]+)"', block.group(1))


def main() -> int:
    actual = workflow_names()
    data_workflows = {n for n in actual if n not in NOT_DATA_WORKFLOWS}
    problems: list[str] = []

    listed = deploy_trigger_names()
    if not listed:
        problems.append("deploy-pages.yml 에서 workflow_run.workflows 목록을 찾지 못했다.")

    for name in listed:
        if name not in actual:
            problems.append(
                f'deploy-pages.yml 이 "{name}" 을 트리거로 걸었지만 그런 이름의 '
                f"워크플로우가 없다 — 이 데이터는 배포되지 않는다."
            )

    for name in sorted(data_workflows - set(listed)):
        problems.append(
            f'"{name}" ({actual[name]}) 이 deploy-pages.yml 의 트리거 목록에 없다 — '
            f"이 워크플로우가 커밋한 데이터는 사이트에 반영되지 않는다."
        )

    for name in trust_recovery_names():
        if name not in actual:
            problems.append(
                f'app.js TRUST_RECOVERY 가 "{name}" 을 안내하지만 그런 워크플로우가 없다.'
            )

    if problems:
        print("워크플로우 이름 참조가 어긋났습니다:\n", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        print(
            f"\n실제 워크플로우 이름 {len(actual)}개:", file=sys.stderr)
        for name, fname in sorted(actual.items()):
            print(f"    {name}  ({fname})", file=sys.stderr)
        return 1

    print(f"OK — 데이터 워크플로우 {len(data_workflows)}개가 모두 배포 트리거에 연결됨.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
