@echo off
title Reset & Flush Network Routing
cd /d "%~dp0"

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Cleaning up Virtual Adapters and Resetting Routes
echo ========================================================
echo.

:: Kill lingering sing-box or tun instances
taskkill /f /im sing-box.exe >nul 2>&1

:: Remove wintun adapter if left over
powershell -NoProfile -Command "Get-NetAdapter | Where-Object { $_.InterfaceDescription -match 'Wintun|sing-box|combiner' } | ForEach-Object { & pnputil /remove-device $_.DeviceID } >$null 2>&1"

:: Reset Windows System Proxy
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f >nul 2>&1

:: Flush DNS
ipconfig /flushdns >nul 2>&1

echo.
echo [SUCCESS] Network cleaned up! All VPNs and adapters are now unlocked and normal.
echo.
timeout /t 3 >nul

