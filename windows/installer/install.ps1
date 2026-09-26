<#
  平注 PingZhu — 安裝程式

  每使用者安裝，不需要管理員權限。裝到：
      %LOCALAPPDATA%\Programs\PingZhu

  用法：
      powershell -ExecutionPolicy Bypass -File install.ps1
      powershell -ExecutionPolicy Bypass -File install.ps1 -NoStartup -NoLaunch
#>
[CmdletBinding()]
param(
    # 登入時自動啟動。輸入法不自動啟動就得每次手動開，所以預設開。
    [switch]$NoStartup,
    # 安裝完立刻執行。
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'

$AppName    = '平注 PingZhu'
$ExeName    = 'pingzhu-ime.exe'
$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\PingZhu'
$SourceDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartMenu  = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$StartupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$Shortcut   = Join-Path $StartMenu "$AppName.lnk"
$StartupLnk = Join-Path $StartupDir "$AppName.lnk"

function Write-Step($text) { Write-Host "  $text" }
function Write-Head($text) { Write-Host ""; Write-Host $text -ForegroundColor Cyan }

Write-Host ""
Write-Host "平注 PingZhu — 注音輸入法" -ForegroundColor White
Write-Host "可攜版：不需要管理員權限，不會寫入登錄檔的輸入法設定" -ForegroundColor DarkGray

# ---------------------------------------------------------------- 檢查來源
Write-Head '檢查安裝檔案'
foreach ($required in @($ExeName, 'pingzhu_core.dll', 'bopomofo-lm.tsv')) {
    $path = Join-Path $SourceDir $required
    if (-not (Test-Path $path)) {
        Write-Host "  缺少 $required" -ForegroundColor Red
        Write-Host "  請從壓縮檔完整解開後再執行安裝。" -ForegroundColor Red
        exit 1
    }
    Write-Step "ok  $required"
}

# ------------------------------------------------------------ 關閉執行中的
Write-Head '關閉執行中的舊版本'
$running = Get-Process -Name 'pingzhu-ime' -ErrorAction SilentlyContinue
if ($running) {
    # 檔案被鎖住會讓複製失敗，所以先結束；使用者資料在離開時才會寫出，
    # 這裡用 CloseMainWindow 沒有意義（它是托盤程式），直接 Stop-Process。
    $running | Stop-Process -Force
    Start-Sleep -Milliseconds 600
    Write-Step '已關閉執行中的實例'
} else {
    Write-Step '沒有執行中的實例'
}

# -------------------------------------------------------------------- 複製
Write-Head "安裝到 $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Flat layout: the executable, the core DLL and the language model all sit in one
# directory, which keeps the self-extracting installer simple and means the
# install directory can be moved anywhere afterwards.
foreach ($file in @($ExeName, 'pingzhu_core.dll', 'bopomofo-lm.tsv', 'ts-conversion.tsv',
                     'README.txt', 'uninstall.ps1')) {
    $p = Join-Path $SourceDir $file
    if (Test-Path $p) { Copy-Item $p $InstallDir -Force }
}
# The settings file is only placed when there is not one already: it holds the
# user's 繁/簡 choice, and reinstalling must not silently reset it.
$configSource = Join-Path $SourceDir 'pingzhu.ini'
if ((Test-Path $configSource) -and -not (Test-Path (Join-Path $InstallDir 'pingzhu.ini'))) {
    Copy-Item $configSource $InstallDir -Force
}
Write-Step '程式與語言模型已複製'

# 學習紀錄是使用者的資料，重新安裝時絕不覆蓋。
$userDict = Join-Path $InstallDir 'pingzhu-userdict.txt'
if (Test-Path $userDict) {
    Write-Step '保留既有的學習紀錄（pingzhu-userdict.txt）'
} else {
    Write-Step '學習紀錄會在第一個教過的字之後產生'
}

# ------------------------------------------------------------------ 捷徑
Write-Head '建立捷徑'
$shell = New-Object -ComObject WScript.Shell

$lnk = $shell.CreateShortcut($Shortcut)
$lnk.TargetPath = Join-Path $InstallDir $ExeName
$lnk.WorkingDirectory = $InstallDir
$lnk.Description = '平注 PingZhu 注音輸入法'
$lnk.Save()
Write-Step "開始功能表：$Shortcut"

$uninstallLnk = Join-Path $StartMenu "$AppName（解除安裝）.lnk"
$un = $shell.CreateShortcut($uninstallLnk)
$un.TargetPath = 'powershell.exe'
$un.Arguments = "-ExecutionPolicy Bypass -File `"$(Join-Path $InstallDir 'uninstall.ps1')`""
$un.Description = '移除平注 PingZhu'
$un.Save()
Write-Step "解除安裝：$uninstallLnk"

if (-not $NoStartup) {
    $sl = $shell.CreateShortcut($StartupLnk)
    $sl.TargetPath = Join-Path $InstallDir $ExeName
    $sl.WorkingDirectory = $InstallDir
    $sl.Description = '平注 PingZhu 注音輸入法（登入時啟動）'
    $sl.Save()
    Write-Step '已加入登入時自動啟動'
} else {
    Write-Step '未加入自動啟動（-NoStartup）'
}

# -------------------------------------------------------------------- 啟動
Write-Head '啟動'
if ($NoLaunch) {
    Write-Step '未啟動（-NoLaunch）'
} else {
    Start-Process -FilePath (Join-Path $InstallDir $ExeName) -WorkingDirectory $InstallDir
    Write-Step '已啟動，請看系統匣（右下角，可能要展開隱藏的圖示）'
}

Write-Host ""
Write-Host "安裝完成。" -ForegroundColor Green
Write-Host ""
Write-Host "  切換中文／英文：Ctrl+Alt+Z，或左鍵點系統匣圖示" -ForegroundColor White
Write-Host "  打字：su3cl3 → 你好" -ForegroundColor White
Write-Host "  選字：先按空白（或 ↓）開啟候選視窗，再按 1-9 或 0" -ForegroundColor White
Write-Host ""
Write-Host "  結束程式：系統匣圖示按右鍵 → 結束" -ForegroundColor DarkGray
Write-Host "  移除：開始功能表 → $AppName（解除安裝）" -ForegroundColor DarkGray
Write-Host ""
