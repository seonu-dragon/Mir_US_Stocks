@echo off
cd /d "%~dp0\.."
echo [%date% %time%] Starting daily US market snapshot update... >> scripts\update_log.txt
py -3 -u scripts\update_data.py --push >> scripts\update_log.txt 2>&1
if errorlevel 1 (
  py -u scripts\update_data.py --push >> scripts\update_log.txt 2>&1
)
set EXIT_CODE=%errorlevel%
echo [%date% %time%] Daily US market snapshot finished. Exit code: %EXIT_CODE% >> scripts\update_log.txt
echo ------------------------------------------ >> scripts\update_log.txt
exit /b %EXIT_CODE%