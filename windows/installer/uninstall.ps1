<#
  平注 PingZhu — 解除安裝

  移除程式、捷徑、自動啟動項目。
  學習紀錄（pingzhu-userdict.txt）會先備份到 %LOCALAPPDATA%\PingZhu-userdict-backup.txt，
  因為那是使用者累積下來的東西，不該在被移除時一起消失。
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$AppName    = '平注 PingZhu'
$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\PingZhu'
$StartMenu  = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$StartupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$Backup     = Join-Path $env:LOCALAPPDATA 'PingZhu-userdict-backup.txt'

Write-Host ""
Write-Host "平注 PingZhu — 解除安裝" -ForegroundColor White

# 先結束程式，否則執行檔被鎖住刪不掉。
$running = Get-Process -Name 'pingzhu-ime' -ErrorAction SilentlyContinue
if ($running) {
    $running | Stop-Process -Force
    Start-Sleep -Milliseconds 800
    Write-Host "  已結束執行中的程式"
}

# 備份學習紀錄。
$userDict = Join-Path $InstallDir 'pingzhu-userdict.txt'
if (Test-Path $userDict) {
    Copy-Item $userDict $Backup -Force
    Write-Host "  學習紀錄已備份到 $Backup" -ForegroundColor Yellow
}

foreach ($lnk in @(
        (Join-Path $StartMenu "$AppName.lnk"),
        (Join-Path $StartMenu "$AppName（解除安裝）.lnk"),
        (Join-Path $StartupDir "$AppName.lnk"))) {
    if (Test-Path $lnk) {
        Remove-Item $lnk -Force
        Write-Host "  已移除捷徑 $lnk"
    }
}

if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force
    Write-Host "  已移除 $InstallDir"
}

Write-Host ""
Write-Host "解除安裝完成。" -ForegroundColor Green
Write-Host "（本程式不安裝任何驅動、不寫入登錄檔的輸入法項目，所以移除後不留痕跡。）" -ForegroundColor DarkGray
Write-Host ""
