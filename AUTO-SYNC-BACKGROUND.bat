@echo off
title Auto-Sync Background Medical Tug of War
cd /d "%~dp0"

echo ========================================================
echo   MENGAKTIFKAN AUTO-SYNC BACKGROUND DARI GITHUB
echo ========================================================
echo.
echo Script ini akan berjalan diam-diam di background.
echo Setiap kali Anda push fitur baru dari AI Studio ke GitHub,
echo komputer ini akan otomatis mengunduh perubahannya (tiap 30 detik).
echo.

start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\auto-sync-github.ps1"

echo [OK] Auto-Sync background berhasil diaktifkan!
echo Jendela ini dapat ditutup.
echo.
timeout /t 3 >nul
exit 0
