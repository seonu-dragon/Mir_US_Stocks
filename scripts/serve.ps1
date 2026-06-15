$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PythonCommand = Get-Command py -ErrorAction SilentlyContinue
if ($PythonCommand) {
  Set-Location $Root
  & $PythonCommand.Source -3 -m http.server 8080
  exit
}

$PythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($PythonCommand) {
  Set-Location $Root
  & $PythonCommand.Source -m http.server 8080
  exit
}

$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (!(Test-Path -LiteralPath $BundledPython)) {
  throw "Python 실행 파일을 찾을 수 없습니다. Python을 설치하거나 README의 실행 명령을 수정하세요."
}

Set-Location $Root
& $BundledPython -m http.server 8080
