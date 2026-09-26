@echo off
rem Double-click entry point for the installer. Kept ASCII-only: a .cmd file is
rem read in the console code page, while the PowerShell script it calls is UTF-8
rem with a BOM and can therefore carry Chinese messages safely.
setlocal
echo.
echo   PingZhu - Bopomofo input method for Windows
echo   Installing for the current user (no administrator rights needed)...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
endlocal
