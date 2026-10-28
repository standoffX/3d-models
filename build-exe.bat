@echo off
chcp 65001 >nul
title StandoffX Menu - EXE Builder
cd /d "%~dp0"

echo ==========================================
echo        STANDOFFX MENU - BUILD EXE
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js 24 LTS from https://nodejs.org/
  echo Then close and reopen this window and run this file again.
  pause
  exit /b 1
)

echo [1/2] Installing build dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed. Check your internet connection and try again.
  pause
  exit /b 1
)

echo.
echo [2/2] Building Windows installer...
call npm run dist
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. The full log is above.
  pause
  exit /b 1
)

echo.
echo [SUCCESS] Installer is in the release folder.
echo release\StandoffX Menu-Setup.exe
pause
