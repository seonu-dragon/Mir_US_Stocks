$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PythonCommand = Get-Command py -ErrorAction SilentlyContinue
if ($PythonCommand) {
  $Python = $PythonCommand.Source
  $PythonArgs = "-3"
} else {
  $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($PythonCommand) {
    $Python = $PythonCommand.Source
  } else {
    $BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    if (!(Test-Path -LiteralPath $BundledPython)) {
      throw "Python 실행 파일을 찾을 수 없습니다. Python을 설치하거나 이 스크립트의 `$Python 값을 직접 지정하세요."
    }
    $Python = $BundledPython
  }
  $PythonArgs = ""
}
$Script = Join-Path $Root "scripts\update_data.py"
$TaskName = "MijoomoDailySnapshot"
$TaskRun = if ($PythonArgs) {
  "`"$Python`" $PythonArgs `"$Script`""
} else {
  "`"$Python`" `"$Script`""
}

schtasks /Create `
  /TN $TaskName `
  /SC DAILY `
  /ST 06:00 `
  /TR $TaskRun `
  /F | Out-Host

Write-Host "Registered $TaskName to update the market snapshot daily at 06:00 Korea local time."
