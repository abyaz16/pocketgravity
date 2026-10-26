# PocketGravity Windows Start Menu & Desktop Shortcut Installer
$WshShell = New-Object -ComObject WScript.Shell
$baseDir = if ($PSScriptRoot) { $PSScriptRoot } else { "E:\pocketgravity" }
$exePath = Join-Path $baseDir "PocketGravity.exe"

$startMenuDir = [System.Environment]::GetFolderPath('Programs')
$startMenuPath = Join-Path $startMenuDir "PocketGravity.lnk"
$startMenuShortcut = $WshShell.CreateShortcut($startMenuPath)
$startMenuShortcut.TargetPath = $exePath
$startMenuShortcut.WorkingDirectory = $baseDir
$startMenuShortcut.IconLocation = "$exePath,0"
$startMenuShortcut.Description = "PocketGravity - Remote Workspace Manager & Antigravity Remote"
$startMenuShortcut.Save()
Write-Host "[OK] Registered Start Menu App: $startMenuPath"

$desktopDir = [System.Environment]::GetFolderPath('Desktop')
$desktopPath = Join-Path $desktopDir "PocketGravity.lnk"
$desktopShortcut = $WshShell.CreateShortcut($desktopPath)
$desktopShortcut.TargetPath = $exePath
$desktopShortcut.WorkingDirectory = $baseDir
$desktopShortcut.IconLocation = "$exePath,0"
$desktopShortcut.Description = "PocketGravity - Remote Workspace Manager & Antigravity Remote"
$desktopShortcut.Save()
Write-Host "[OK] Created Desktop Shortcut: $desktopPath"

# Register in Windows App Paths (Enables Win+R / Windows Search direct execution)
$appPathKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\pocketgravity.exe"
if (-not (Test-Path $appPathKey)) {
    New-Item -Path $appPathKey -Force | Out-Null
}
Set-ItemProperty -Path $appPathKey -Name "(Default)" -Value $exePath
Set-ItemProperty -Path $appPathKey -Name "Path" -Value $baseDir
Write-Host "[OK] Registered App Path: pocketgravity.exe"
