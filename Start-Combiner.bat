@echo off
setlocal EnableDelayedExpansion
title WiFi-LAN Combiner - Internet Bonding

:: Fix working directory to script location
cd /d "%~dp0"

:: ─── Check if already running as Admin ──────────────────────
net session >nul 2>&1
if %errorLevel% equ 0 goto :RUN_AS_ADMIN

:: ─── Not Admin: elevate via VBScript ─────────────────────────
echo.
echo ========================================================
echo   WiFi-LAN Combiner - Requesting Administrator Privileges
echo   (Required for WeakHost routing and System Proxy)
echo ========================================================
echo.

set "ELEVATE_VBS=%TEMP%\combiner_elevate.vbs"
echo Set UAC = CreateObject("Shell.Application") > "%ELEVATE_VBS%"
echo UAC.ShellExecute "%~f0", "", "%~dp0", "runas", 1 >> "%ELEVATE_VBS%"
cscript //nologo "%ELEVATE_VBS%"
del /f /q "%ELEVATE_VBS%" >nul 2>&1
exit /b

:RUN_AS_ADMIN
:: ─── Running as Admin ─────────────────────────────────────────
cd /d "%~dp0"

echo.
echo ========================================================
echo   WiFi-LAN Combiner (LAN + Wi-Fi) Bonding
echo   Running as Administrator!
echo ========================================================
echo.

:: Enable WeakHostSend/Receive for Ethernet and Wi-Fi
:: This is CRITICAL for localAddress binding to work correctly
echo [1/4] Enabling WeakHost routing for physical adapters...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\enable-weakhost-admin.ps1" >nul 2>&1
echo       Done.

:: Kill any leftover processes
echo [2/4] Clearing previous instances...
taskkill /f /im sing-box.exe >nul 2>&1

:: Free ports if occupied
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":1080 " ^| findstr "LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8888 " ^| findstr "LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
)
echo       Done.

:: Start node server
echo [3/4] Starting backend server...
start "WiFi-LAN-Combiner-Server" /min cmd /c "cd /d "%~dp0" && node src\server.js"

:: Wait for server to boot
timeout /t 3 /nobreak >nul

:: Verify
netstat -ano | findstr ":8888 " | findstr "LISTENING" >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Server failed to start! Running in foreground for diagnostics:
    echo.
    node src\server.js
    pause
    exit /b 1
)
echo       Server started on port 8888.

:: Open dashboard
echo [4/4] Opening dashboard...
start http://127.0.0.1:8888

echo.
echo ========================================================
echo   WiFi-LAN Combiner is RUNNING!
echo   Dashboard: http://127.0.0.1:8888
echo   SOCKS5 Proxy: 127.0.0.1:1080
echo.
echo   Press any key to STOP WiFi-LAN Combiner...
echo ========================================================
echo.
pause >nul

:: ─── Cleanup on exit ─────────────────────────────────────────
echo.
echo Shutting down WiFi-LAN Combiner...

:: Kill the server window
taskkill /fi "WINDOWTITLE eq WiFi-LAN-Combiner-Server" /f >nul 2>&1

:: Kill any node on our ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":1080 " ^| findstr "LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8888 " ^| findstr "LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
)

:: Kill sing-box
taskkill /f /im sing-box.exe >nul 2>&1

:: Disable System Proxy (so VPNs work after closing)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f >nul 2>&1

echo WiFi-LAN Combiner stopped. Goodbye!
timeout /t 2 /nobreak >nul
exit /b 0
