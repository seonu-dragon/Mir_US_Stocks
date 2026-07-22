# Kiwoom pipeline — Notion DB ID / GitHub Actions Secrets 일괄 등록
# 사용법:
#   1) Notion Integration 생성 후 NOTION_TOKEN을 .env에 추가
#   2) gh auth login
#   3) .\scripts\setup_kiwoom_secrets.ps1

param(
    [string]$Repo = "seonu-dragon/Mir_US_Stocks",
    [string]$SiteBaseUrl = "https://seonu-dragon.github.io/Mir_US_Stocks",
    [string]$NotionDatabaseId = "cc26d8ab4b524db19cda74797c01e430"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env"

function Read-DotEnvKeys {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        if ($key -and $val) { $map[$key] = $val }
    }
    return $map
}

function Ensure-EnvLine {
    param([string]$Path, [string]$Key, [string]$Value)
    $content = @()
    $found = $false
    if (Test-Path $Path) {
        $content = Get-Content $Path
        $content = $content | ForEach-Object {
            if ($_ -match "^\s*$([regex]::Escape($Key))\s*=") {
                $found = $true
                "$Key=`"$Value`""
            } else { $_ }
        }
    }
    if (-not $found) { $content += "$Key=`"$Value`"" }
    Set-Content -Path $Path -Value $content -Encoding UTF8
}

Write-Host "=== Kiwoom Pipeline Setup ===" -ForegroundColor Cyan
Write-Host "Notion DB: Kiwoom Supporters Daily Posts"
Write-Host "Database ID: $NotionDatabaseId"
Write-Host "Notion URL: https://www.notion.so/cc26d8ab4b524db19cda74797c01e430"
Write-Host ""

Ensure-EnvLine -Path $EnvFile -Key "NOTION_DATABASE_ID" -Value $NotionDatabaseId
Ensure-EnvLine -Path $EnvFile -Key "SITE_BASE_URL" -Value $SiteBaseUrl
Write-Host "[.env] NOTION_DATABASE_ID, SITE_BASE_URL 반영 완료" -ForegroundColor Green

$envMap = Read-DotEnvKeys -Path $EnvFile
$required = @(
    "GEMINI_API_KEY",
    "NOTION_TOKEN",
    "NOTION_DATABASE_ID",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID"
)
$optional = @("SITE_BASE_URL")

$missing = $required | Where-Object { -not $envMap.ContainsKey($_) -or -not $envMap[$_] }
if ($missing.Count) {
    Write-Host ""
    Write-Host "[주의] .env에 아래 값이 없습니다:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "NOTION_TOKEN 발급 방법:"
    Write-Host "  1. https://www.notion.so/my-integrations 에서 Internal Integration 생성"
    Write-Host "  2. 액세스 토큰 복사 후 .env에 NOTION_TOKEN=`"ntn_...`" 또는 `"secret_...`" 추가"
    Write-Host "  3. Notion DB 페이지 → ... → 연결 → 방금 만든 Integration 추가"
    Write-Host ""
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "[skip] gh CLI 없음 — GitHub Secrets는 수동 등록하세요." -ForegroundColor Yellow
    exit 0
}

$ghOk = $true
try {
    gh auth status *> $null
    if ($LASTEXITCODE -ne 0) { $ghOk = $false }
} catch {
    $ghOk = $false
}
if (-not $ghOk) {
    Write-Host "[skip] gh 미로그인 — 'gh auth login' 후 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "GitHub Secrets 등록 중 ($Repo)..." -ForegroundColor Cyan
$allKeys = $required + $optional
foreach ($key in $allKeys) {
    if (-not $envMap.ContainsKey($key) -or -not $envMap[$key]) {
        Write-Host "  [skip] $key (값 없음)"
        continue
    }
    $envMap[$key] | gh secret set $key --repo $Repo
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [ok] $key"
    } else {
        Write-Host "  [fail] $key" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "완료. Actions에서 'Kiwoom Content Pipeline' 워크플로를 workflow_dispatch로 테스트하세요." -ForegroundColor Green