@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $Shortcut = $WshShell.CreateShortcut(\"$desktop\NetLimir.lnk\"); $Shortcut.TargetPath = '%~dp0Start-NetLimir.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.IconLocation = 'shell32.dll,14'; $Shortcut.Description = 'NetLimir - Internet Combiner & TUN Mode'; $Shortcut.Save()"
echo ========================================================
echo   Shortcut created on Desktop: NetLimir.lnk
echo ========================================================
timeout /t 2 >nul
