<#
  publish_today.ps1 — 오늘의 콘텐츠를 빌드해 GitHub로 발행합니다.

  순서: 카드뉴스 7장 + SNS 원고가 모두 완성된 뒤, 아침 루틴의 *마지막 단계*로 실행하세요.
    1) build_today_content.py --merge  : 오늘 폴더 스캔 → 띠 데이터 + 커버 썸네일 생성·주입
    2) git add data/ → commit → push   : 변경이 있을 때만 커밋·푸시 (GitHub Pages 반영)

  사용:
    powershell -ExecutionPolicy Bypass -File scripts/publish_today.ps1
    powershell -ExecutionPolicy Bypass -File scripts/publish_today.ps1 -Date 2026-06-16
#>
param(
  [string]$Date = ""
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot   # scripts/ 의 상위 = Mir_US_Stocks
Set-Location $repo

# Python 실행기 탐색
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $py) { Write-Error "[publish] python 을 찾을 수 없습니다."; exit 1 }

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
$today = if ($Date) { $Date } else { (Get-Date).ToString("yyyy-MM-dd") }
git commit -m "오늘의 콘텐츠 업데이트: $today"
if ($LASTEXITCODE -ne 0) { Write-Error "[publish] git commit 실패"; exit 1 }

git push
if ($LASTEXITCODE -ne 0) { Write-Error "[publish] git push 실패"; exit 1 }

Write-Host "[publish] 발행 완료: $today"
