@echo off
title Fix Multi-Network Bonding Settings
cd /d "%~dp0"

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator Privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Enabling Multi-Homing / Dual Gateway for Windows
echo ========================================================
echo.

powershell -NoProfile -Command "Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Ethernet|Wi-Fi' -and $_.ConnectionState -eq 'Connected' } | ForEach-Object { Write-Host 'Optimizing:' $_.InterfaceAlias; Set-NetIPInterface -InterfaceIndex $_.InterfaceIndex -WeakHostSend Enabled -WeakHostReceive Enabled; Set-NetIPInterface -InterfaceIndex $_.InterfaceIndex -InterfaceMetric 15 }"

echo.
echo [DONE] Network interfaces optimized for bonding!
echo Both LAN and Wi-Fi can now send and receive traffic simultaneously.
echo.
pause
