@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $Shortcut = $WshShell.CreateShortcut(\"$desktop\WiFi-LAN Combiner.lnk\"); $Shortcut.TargetPath = '%~dp0Start-Combiner.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.IconLocation = 'shell32.dll,14'; $Shortcut.Description = 'WiFi-LAN Combiner - Internet Bonding & TUN Mode'; $Shortcut.Save()"
echo ========================================================
echo   Shortcut created on Desktop: WiFi-LAN Combiner.lnk
echo ========================================================
timeout /t 2 >nul
