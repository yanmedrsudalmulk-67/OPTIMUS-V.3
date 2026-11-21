@echo off
setlocal
cd /d "%~dp0"
title Update Game Dari GitHub (yanmedrsudalmulk-67 / OPTIMUS-V.3)

for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set BRANCH=%%i
if "%BRANCH%"=="" set BRANCH=main

echo ======================================================================
echo   PEMBARUAN APLIKASI MEDICAL TUG OF WAR DARI GITHUB
echo   Repositori: https://github.com/yanmedrsudalmulk-67/OPTIMUS-V.3
echo   Branch: %BRANCH%
echo ======================================================================
echo.

echo Menghentikan sementara proses game jika sedang berjalan...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3005\>"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4001\>"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

echo [1/3] Mengambil pembaharuan terbaru dari GitHub...
git fetch origin %BRANCH%
if errorlevel 1 (
    echo [ERROR] Gagal terhubung ke GitHub. Pastikan internet Anda aktif.
    pause
    exit /b 1
)

echo.
echo [2/3] Menerapkan perubahan ke komputer lokal...
git pull origin %BRANCH%
if errorlevel 1 (
    echo [PERINGATAN] Ada file lokal yang bentrok. Mencoba menyinkronkan...
    git stash -u
    git pull origin %BRANCH%
    git stash pop >nul 2>&1
)

echo.
echo [3/3] Memperbarui dependensi, database, dan build aplikasi...
call npm run db:generate >nul 2>&1
call npm run db:migrate >nul 2>&1
call npm run build >nul 2>&1
powershell.exe -ExecutionPolicy Bypass -File scripts\buat-shortcut-desktop.ps1 >nul 2>&1

echo.
echo ======================================================================
echo   SUKSES! Aplikasi game berhasil diperbarui dari GitHub.
echo   Shortcut Desktop siap, data lokal (soal, skor, admin) tetap aman.
echo ======================================================================
echo.
pause
