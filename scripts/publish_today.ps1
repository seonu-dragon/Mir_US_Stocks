<#
  publish_today.ps1 — 오늘의 콘텐츠를 빌드해 GitHub로 발행합니다.

  순서: 카드뉴스 6장 + SNS 원고가 모두 완성된 뒤, 아침 루틴의 *마지막 단계*로 실행하세요.
    0) 다른 세션의 git 작업(index.lock / rebase)이 끝나기를 기다림
    1) build_today_content.py --merge  : 오늘 폴더 스캔 → 띠 데이터 + 커버 썸네일 생성·주입
    2) git add data/ → commit → push   : 변경이 있을 때만 커밋·푸시 (GitHub Pages 반영)
    3) verify_pages_deploy.py          : 좀비 큐 정리 → 배포 완료 대기 → 라이브 date 확인

  사용:
    powershell -ExecutionPolicy Bypass -File scripts/publish_today.ps1
    powershell -ExecutionPolicy Bypass -File scripts/publish_today.ps1 -Date 2026-06-16
    powershell -ExecutionPolicy Bypass -File scripts/publish_today.ps1 -Date 2026-06-16 -SkipVerify
#>
param(
  [string]$Date = "",
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot   # scripts/ 의 상위 = Mir_US_Stocks
Set-Location $repo

# Python 실행기 탐색
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $py) { Write-Error "[publish] python 을 찾을 수 없습니다."; exit 1 }

# 0) 다른 세션(예: 미국장 워크플로우의 publish_today)이 같은 저장소에서 커밋·rebase 중이면
#    끝날 때까지 기다린다. 2026-09-02 에 두 세션이 동시에 발행해 push 경합이 났다.
$gitDir = Join-Path $repo ".git"
$busyMarkers = @("index.lock", "rebase-merge", "rebase-apply", "MERGE_HEAD")
$waited = 0
while ($true) {
  $busy = $false
  foreach ($m in $busyMarkers) { if (Test-Path (Join-Path $gitDir $m)) { $busy = $true } }
  if (-not $busy) { break }
  if ($waited -eq 0) { Write-Host "[publish] 다른 git 작업이 진행 중 — 끝나기를 기다립니다..." }
  if ($waited -ge 180) { Write-Error "[publish] 3분 넘게 저장소가 잠겨 있습니다(index.lock/rebase). 다른 세션을 확인하세요."; exit 1 }
  Start-Sleep -Seconds 3
  $waited += 3
}

# 1) 매니페스트 생성 + 스냅샷 병합
$buildArgs = @("scripts/build_today_content.py", "--merge")
if ($Date) { $buildArgs += @("--date", $Date) }
& $py @buildArgs
if ($LASTEXITCODE -ne 0) { Write-Error "[publish] build_today_content.py 실패 — 푸시 중단"; exit 1 }

# 2) 변경분 스테이징 (콘텐츠는 모두 data/ 아래)
git add data/
if ($LASTEXITCODE -ne 0) { Write-Error "[publish] git add 실패"; exit 1 }

$status = git status --porcelain -- data/
if (-not $status) { Write-Host "[publish] 변경 없음 — 푸시 생략"; exit 0 }

# 3) 커밋 + 푸시
#    커밋 메시지는 UTF-8 파일로 넘긴다(-F). PowerShell 5.1 콘솔(cp949)에서 -m 으로 한글을
#    넘기면 "?ㅻ뒛??肄섑뀗痢?" 같은 mojibake 로 남는다(08-31~09-02 이력).
$today = if ($Date) { $Date } else { (Get-Date).ToString("yyyy-MM-dd") }
$msgFile = [System.IO.Path]::GetTempFileName()
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($msgFile, "오늘의 콘텐츠 업데이트: $today`n", $utf8NoBom)
try {
  git -c i18n.commitEncoding=utf-8 commit -F $msgFile
  if ($LASTEXITCODE -ne 0) { Write-Error "[publish] git commit 실패"; exit 1 }
} finally {
  Remove-Item $msgFile -ErrorAction SilentlyContinue
}

git push
if ($LASTEXITCODE -ne 0) {
  Write-Host "[publish] push 거부 — 원격 변경을 rebase 로 흡수한 뒤 재시도합니다."
  git pull --rebase --autostash origin main
  git push
  if ($LASTEXITCODE -ne 0) { Write-Error "[publish] git push 실패"; exit 1 }
}

Write-Host "[publish] 발행 완료: $today"

# 4) 배포 사후 검증 — 좀비 큐 정리 + 배포 완료 대기 + 라이브 today_content date 확인.
#    2026-08-08~09-02 사이 25일간 좀비 queued run 때문에 사이트가 멈춰 있었는데 아무도 몰랐다.
if (-not $SkipVerify) {
  & $py scripts/verify_pages_deploy.py --date $today --wait-minutes 8
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "[publish] 라이브 반영을 확인하지 못했습니다. 위 메시지를 보고 `gh run list --status queued` 로 좀비 큐를 점검하세요."
  }
}
