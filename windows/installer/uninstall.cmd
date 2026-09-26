@echo off
rem Double-click entry point for the uninstaller.
setlocal
echo.
echo   PingZhu - uninstalling
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
echo.
pause
endlocal
