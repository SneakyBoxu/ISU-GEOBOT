@echo off
title GeoBot - Stopping Services...
echo ========================================================
echo   ISU GeoBot - Stopping Services (Ports 5001, 4000, 5173)
echo ========================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5001" ^| findstr "LISTENING"') do (
    echo Stopping ML Service on PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo Stopping Backend Server on PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Stopping Frontend Web Server on PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo All GeoBot services stopped cleanly.
timeout /t 2 >nul
