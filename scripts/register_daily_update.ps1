# UTF-8 Encoding for PowerShell Output
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = $PSScriptRoot
if (!$ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$Root = Split-Path -Parent $ScriptDir
$BatPath = (Resolve-Path -LiteralPath (Join-Path $ScriptDir "run_daily_update.bat")).Path
$TaskName = "MijoomoDailySnapshot"

Write-Host "Registering Scheduled Task: $TaskName"
Write-Host "Action: $BatPath"
Write-Host "Working Directory: $Root"
Write-Host "Schedule: Daily at 05:00 KST (before briefing tasks at 06:00/06:10)"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Unregistered existing task."
}

$Trigger = New-ScheduledTaskTrigger -Daily -At 5:00AM
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/d /c `"`"$BatPath`"`"" `
    -WorkingDirectory $Root
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger $Trigger `
    -Action $Action `
    -Settings $Settings `
    -Description "Daily full market snapshot at 05:00 KST (runs before briefing tasks; auto git push)"

Write-Host "Successfully registered '$TaskName' to run daily at 05:00 KST."