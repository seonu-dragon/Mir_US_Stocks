$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Port = 8090

function Test-PortFree([int]$p) {
  return -not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

if (Test-PortFree 8080) { $Port = 8080 }
elseif (Test-PortFree 8090) { $Port = 8090 }
else { $Port = 8888 }

$Url = "http://localhost:$Port/"
Write-Host "Mir_US_Stocks → $Url" -ForegroundColor Cyan
Start-Process $Url

function Start-SiteServer([string]$exe, [string[]]$args) {
  Set-Location $Root
  & $exe @args
}

$PythonCommand = Get-Command py -ErrorAction SilentlyContinue
if ($PythonCommand) {
  Start-SiteServer $PythonCommand.Source @("-3", "-m", "http.server", "$Port", "--bind", "0.0.0.0")
  exit
}

$PythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($PythonCommand) {
  Start-SiteServer $PythonCommand.Source @("-m", "http.server", "$Port", "--bind", "0.0.0.0")
  exit
}

$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (!(Test-Path -LiteralPath $BundledPython)) {
  throw "Python 실행 파일을 찾을 수 없습니다. Python을 설치하거나 README의 실행 명령을 수정하세요."
}

Start-SiteServer $BundledPython @("-m", "http.server", "$Port", "--bind", "0.0.0.0")
