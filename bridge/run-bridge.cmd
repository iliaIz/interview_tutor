@echo off
REM ==============================================================================
REM InterviewTutor IntelliJ Companion Bridge - Fast Launcher (Windows)
REM ==============================================================================
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Ошибка: Node.js не найден.
    echo Пожалуйста, установите Node.js 20+ с официального сайта: https://nodejs.org
    pause
    exit /b 1
)

node "%~dp0bridge.mjs"
pause
