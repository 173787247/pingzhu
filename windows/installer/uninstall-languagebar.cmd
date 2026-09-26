@echo off
rem Remove the TSF text service from the language bar and unregister it.
rem Needs administrator rights for the same reason the install does.
setlocal
echo.
echo   PingZhu - removing the language bar input method
echo.
echo   A UAC prompt will appear.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath '%~dp0pingzhu-regtool.exe' -ArgumentList 'uninstall' -Verb RunAs -Wait"

echo.
"%~dp0pingzhu-regtool.exe" status
echo.
pause
endlocal
