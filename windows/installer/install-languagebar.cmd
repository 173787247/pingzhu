@echo off
rem Register the TSF text service so it appears in the language bar.
rem
rem This one needs administrator rights, and unlike the portable version that is
rem not something that can be worked around: a text service must be registered in
rem HKLM to be loadable into processes running as other users. The UAC prompt
rem below is the expected step, not a mistake.
setlocal
echo.
echo   PingZhu - language bar integration (TSF text service)
echo.
echo   This installs an input method into Windows itself, so that it appears
echo   in the language bar and can be selected with Win+Space.
echo.
echo   A UAC prompt will appear: registering a text service writes to HKLM.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath '%~dp0pingzhu-regtool.exe' -ArgumentList 'install' -Verb RunAs -Wait"

echo.
echo   Checking the result...
echo.
"%~dp0pingzhu-regtool.exe" status
echo.
echo   If it says 已加入, press Win+Space and pick 平注注音輸入法.
echo   If it does not, the UAC prompt was probably declined.
echo.
echo   IMPORTANT - apps that were already open keep the OLD version loaded.
echo   Windows cannot replace a loaded DLL, and COM reuses an in-process server
echo   it has already loaded without re-reading the registry. So:
echo.
echo     - close and reopen any app you want to type in
echo     - or sign out and back in, which is simplest and always works
echo.
pause
endlocal
