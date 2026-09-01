@echo off
title GeoBot - Starting All Services...
echo ========================================================
echo   ISU GeoBot - Starting Full Stack (ML + Backend + Web)
echo ========================================================

echo [1/3] Starting Python ML Microservice (port 5001)...
start "GeoBot - ML Service (5001)" cmd /k "cd /d %~dp0machine-learning && python ai_api_service.py"

echo [2/3] Starting Express Backend Server (port 4000)...
start "GeoBot - Backend Server (4000)" cmd /k "cd /d %~dp0backend && npm run dev"

echo [3/3] Starting Vite Web Frontend (port 5173)...
start "GeoBot - Frontend (5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All services launched!
echo Web UI will open at: http://localhost:5173
echo.
timeout /t 3 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
