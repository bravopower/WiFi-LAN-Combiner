@echo off
setlocal EnableDelayedExpansion
title WiFi-LAN Combiner - Internet Bonding ^& TUN Mode

:: Fix working directory to script location
cd /d "%~dp0"

:: ─── Check if already running as Admin ──────────────────────
net session >nul 2>&1
if %errorLevel% equ 0 goto :RUN_AS_ADMIN

:: ─── Not Admin: offer to elevate ────────────────────────────
echo.
echo ========================================================
echo   WiFi-LAN Combiner - Requesting Administrator Privileges...
echo   (Required for System-Wide TUN Mode)
echo ========================================================
echo.

:: Create a temporary VBS script for elevation (most reliable method)
set "ELEVATE_VBS=%TEMP%\combiner_elevate.vbs"
echo Set UAC = CreateObject^("Shell.Application"^) > "%ELEVATE_VBS%"
echo UAC.ShellExecute "%~f0", "ELEVATED", "%~dp0", "runas", 1 >> "%ELEVATE_VBS%"
cscript //nologo "%ELEVATE_VBS%"
del /f /q "%ELEVATE_VBS%" >nul 2>&1
exit /b

:RUN_AS_ADMIN
:: ─── We are now running as Admin ─────────────────────────────
:: Make sure working directory is correct (UAC can change it)
cd /d "%~dp0"

echo.
echo ========================================================
echo   WiFi-LAN Combiner (LAN + Wi-Fi) ^& TUN App
echo   Running as Administrator - TUN Mode Available!
echo ========================================================
echo.

:: Optimize network interfaces for multi-homing / bonding (WeakHost)
powershell -NoProfile -Command "Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Ethernet$|Wi-Fi' -and $_.ConnectionState -eq 'Connected' } | ForEach-Object { Set-NetIPInterface -InterfaceIndex $_.InterfaceIndex -WeakHostSend Enabled -WeakHostReceive Enabled -ErrorAction SilentlyContinue }" >nul 2>&1

:: Kill any existing processes to avoid port conflicts
taskkill /f /im sing-box.exe >nul 2>&1

:: Check if port 1080 or 8888 are in use
netstat -ano | findstr ":1080 " | findstr "LISTENING" >nul 2>&1
if %errorLevel% equ 0 (
    echo [WARNING] Port 1080 is already in use. Attempting to free it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1080 " ^| findstr "LISTENING"') do (
        taskkill /pid %%a /f >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

netstat -ano | findstr ":8888 " | findstr "LISTENING" >nul 2>&1
if %errorLevel% equ 0 (
    echo [WARNING] Port 8888 is already in use. Attempting to free it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8888 " ^| findstr "LISTENING"') do (
        taskkill /pid %%a /f >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

echo Starting backend server...
echo.

:: Start node server in a minimized window
start "WiFi-LAN-Combiner-Server" /min cmd /c "cd /d "%~dp0" && node src\server.js"

:: Wait for the server to start
echo Waiting for server to start...
timeout /t 3 /nobreak >nul

:: Verify server is running
netstat -ano | findstr ":8888 " | findstr "LISTENING" >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Server failed to start! Running in foreground for diagnostics:
    echo.
    node src\server.js
    pause
    exit /b 1
)

echo [OK] Server is running on port 8888!
echo.

:: Launch Dashboard in browser
start http://127.0.0.1:8888

echo.
echo ========================================================
echo   WiFi-LAN Combiner is running!
echo   Dashboard: http://127.0.0.1:8888
echo.
echo   Press any key to STOP WiFi-LAN Combiner and exit...
echo ========================================================
echo.
pause >nul

:: ─── Cleanup on exit ─────────────────────────────────────────
echo.
echo Shutting down WiFi-LAN Combiner...

:: Kill the node server
tasklist /fi "WINDOWTITLE eq WiFi-LAN-Combiner-Server" /fo csv 2>nul | findstr /i "cmd" >nul
if %errorLevel% equ 0 (
    taskkill /fi "WINDOWTITLE eq WiFi-LAN-Combiner-Server" /f >nul 2>&1
)

:: Kill node processes on our ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1080 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /pid %%a /f >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8888 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /pid %%a /f >nul 2>&1
)

:: Kill sing-box if running
taskkill /f /im sing-box.exe >nul 2>&1

:: Reset Windows System Proxy
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f >nul 2>&1

echo WiFi-LAN Combiner stopped. Goodbye!
timeout /t 2 /nobreak >nul
exit /b 0
