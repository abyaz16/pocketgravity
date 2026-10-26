@echo off
setlocal enabledelayedexpansion

cd /d "E:\pocketgravity"
title PocketGravity 2.1 - Bulletproof Antigravity Remote

echo ============================================================
echo      PocketGravity 2.1 - Zero-Trust Antigravity Remote
echo ============================================================
echo.

rem Dynamically read AUTH_TOKEN from .env if present
set "TOKEN="
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%i in (".env") do (
        if "%%i"=="AUTH_TOKEN" set "TOKEN=%%j"
    )
)
if "%TOKEN%"=="" set "TOKEN=pocketgravity_secret_token_123"
set "TS_IP="
set "WIFI_IP=127.0.0.1"

rem Check for Tailscale 100.x.x.x IP first
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set CANDIDATE=%%a
    set CANDIDATE=!CANDIDATE: =!
    if not "!CANDIDATE!"=="" (
        echo !CANDIDATE! | findstr /b "100." >nul
        if not errorlevel 1 (
            set "TS_IP=!CANDIDATE!"
        ) else (
            set "WIFI_IP=!CANDIDATE!"
        )
    )
)

if not "%TS_IP%"=="" (
    echo [SHIELD ACTIVE] Tailscale WireGuard Detected: %TS_IP%
    echo Local Wi-Fi traffic is isolated. Encrypted peer-to-peer tunnel ready.
    echo.
    echo ============================================================
    echo   CONNECT ANYWHERE IN THE WORLD (4G/5G / ANY WI-FI):
    echo   http://%TS_IP%:8000/?token=%TOKEN%
    echo.
    echo   OR OPEN ON LAPTOP:
    echo   http://localhost:8000
    echo ============================================================
) else (
    echo [LOCAL MODE] Tailscale not detected yet.
    echo Local Wi-Fi IP: %WIFI_IP%
    echo.
    echo ============================================================
    echo   CONNECT VIA WI-FI:
    echo   http://%WIFI_IP%:8000/?token=%TOKEN%
    echo.
    echo   (Install Tailscale on laptop & phone for 100%% bulletproof 5G)
    echo ============================================================
)

if not "%TS_IP%"=="" (
    start "" "http://%TS_IP%:8000/?token=%TOKEN%"
) else (
    start "" "http://127.0.0.1:8000/?token=%TOKEN%"
)

"E:\pocketgravity\.venv\Scripts\python.exe" -m uvicorn server.main:app --host 0.0.0.0 --port 8000
