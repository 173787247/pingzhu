@echo off
rem ---------------------------------------------------------------------------
rem Build the portable Windows shell with MSVC.
rem
rem Run from a staging directory containing: src\, tests\, pingzhu_core.dll
rem (windows/build.sh sets that up from WSL).
rem
rem The Rust core is a DLL loaded with LoadLibrary at run time, so nothing here
rem links against it. Both halves are built with MSVC and therefore share one C
rem runtime; the DLL boundary is about graceful degradation, not CRT mixing.
rem
rem Note the goto-based flow rather than `if ( ... )` blocks: %VCVARS% contains
rem "(x86)", and a closing parenthesis inside an expanded block terminates it.
rem ---------------------------------------------------------------------------
setlocal

rem Work from this script's own directory; cmd.exe may be started anywhere and
rem refuses to run at all from a UNC working directory.
cd /d "%~dp0"

set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if exist "%VCVARS%" goto have_vcvars
echo [build] Visual Studio Build Tools not found at:
echo         %VCVARS%
echo         Edit VCVARS in this script, or install "Desktop development with C++".
exit /b 1
:have_vcvars

call "%VCVARS%" >nul
if errorlevel 1 exit /b 1

if not exist build mkdir build

rem /MD matches what Rust's MSVC target links against, so both halves use the
rem same runtime library.
rem /utf-8 is not optional: the sources carry Chinese comments and string
rem literals, and without it MSVC reads them as the system code page (936),
rem which silently corrupts literals and can even break out of a comment.
rem /DNOMINMAX because <windows.h> defines min/max as macros and every use of
rem std::max here would otherwise fail to compile.
set COMMON=/nologo /std:c++17 /EHsc /W4 /O2 /MD /utf-8 /DNOMINMAX /DWIN32_LEAN_AND_MEAN /DUNICODE /D_UNICODE /I src
set LIBS=user32.lib shell32.lib gdi32.lib

echo [build] pingzhu-ime.exe
cl %COMMON% src\main.cpp src\router.cpp src\engine_api.cpp src\candidate_window.cpp src\inject.cpp /Fe:pingzhu-ime.exe /Fo:build\ /link %LIBS% /SUBSYSTEM:WINDOWS
if errorlevel 1 exit /b 1

echo [build] pingzhu-router-test.exe
cl %COMMON% tests\test_router.cpp src\router.cpp /Fe:pingzhu-router-test.exe /Fo:build\ /link %LIBS% /SUBSYSTEM:CONSOLE
if errorlevel 1 exit /b 1

echo [build] pingzhu-engine-test.exe
cl %COMMON% tests\test_engine.cpp src\engine_api.cpp /Fe:pingzhu-engine-test.exe /Fo:build\ /link %LIBS% /SUBSYSTEM:CONSOLE
if errorlevel 1 exit /b 1

rem --------------------------------------------------------------- TSF shell
rem The text service is a second front end on the same engine. It shares
rem router.cpp, engine_api.cpp and candidate_window.cpp with the portable shell;
rem only the plumbing around them differs.
set TSFSRC=tsf\dllmain.cpp tsf\class_factory.cpp tsf\text_service.cpp tsf\register.cpp
rem No msctf.lib: newer Windows SDKs do not ship it, and it is not needed —
rem every TSF call here goes through a COM vtable, and the GUIDs come from
rem uuid.lib. Only CoCreateInstance (ole32) is a real import.
set TSFLIBS=ole32.lib oleaut32.lib uuid.lib user32.lib shell32.lib gdi32.lib advapi32.lib
if not exist build\tsf mkdir build\tsf

echo [build] pingzhu-tsf.dll
cl %COMMON% %TSFSRC% src\engine_api.cpp src\router.cpp src\candidate_window.cpp ^
   /Fo:build\tsf\ /LD /Fe:pingzhu-tsf.dll ^
   /link %TSFLIBS% /DEF:tsf\pingzhu-tsf.def /SUBSYSTEM:WINDOWS
if errorlevel 1 exit /b 1

echo [build] pingzhu-regtool.exe
cl %COMMON% tsf\regtool.cpp tsf\register.cpp ^
   /Fe:pingzhu-regtool.exe /Fo:build\tsf\ /link %TSFLIBS% /SUBSYSTEM:CONSOLE
if errorlevel 1 exit /b 1

echo [build] pingzhu-tsf-test.exe
cl %COMMON% -I tsf tsf\tests\test_com.cpp /Fe:pingzhu-tsf-test.exe /Fo:build\tsf\ /link %TSFLIBS% /SUBSYSTEM:CONSOLE
if errorlevel 1 exit /b 1

echo [build] ok
endlocal
