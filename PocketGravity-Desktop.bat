@echo off
cd /d "%~dp0"
title PocketGravity Desktop
if exist "%~dp0\.venv\Scripts\python.exe" (
    "%~dp0\.venv\Scripts\python.exe" desktop_launcher.py
) else (
    python desktop_launcher.py
)
