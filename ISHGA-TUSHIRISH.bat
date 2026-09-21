@echo off
chcp 65001 >nul
title Test tizimi
cd /d "%~dp0"

echo.
echo   ========================================
echo    TEST TIZIMI
echo   ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js ornatilmagan.
  echo.
  echo   1^) https://nodejs.org saytiga kiring
  echo   2^) Katta yashil "LTS" tugmasini bosing
  echo   3^) Yuklangan faylni ochib ornating
  echo   4^) Keyin shu faylni qayta oching
  echo.
  pause
  exit /b 1
)

set NEED=0
if not exist node_modules set NEED=1
if exist node_modules (
  node -e "require('better-sqlite3');require('express')" >nul 2>nul
  if errorlevel 1 (
    echo   [!] Kutubxonalar bu kompyuterga mos emas - qayta ornatiladi.
    rmdir /s /q node_modules
    set NEED=1
  )
)

if "%NEED%"=="1" (
  echo   Kutubxonalar ornatilmoqda ^(1-2 daqiqa, internet kerak^)...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   [X] Ornatib bolmadi. Internetga ulanganingizni tekshiring.
    pause
    exit /b 1
  )
)

if not exist .env copy .env.example .env >nul 2>nul

start "" http://localhost:3000
call npm start
pause
