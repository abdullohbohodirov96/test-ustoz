@echo off
chcp 65001 >nul
title Test tizimi
cd /d "%~dp0"

echo.
echo   Test tizimi ishga tushirilmoqda...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js ornatilmagan.
  echo   https://nodejs.org saytidan "LTS" versiyasini yuklab ornating,
  echo   keyin shu faylni qayta oching.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo   Birinchi ishga tushirish - kutubxonalar ornatilmoqda ^(1-2 daqiqa^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( pause & exit /b 1 )
)

if not exist .env copy .env.example .env >nul 2>nul

start "" http://localhost:3000
call npm start
pause
