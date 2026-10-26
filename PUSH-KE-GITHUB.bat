@echo off
setlocal
cd /d "%~dp0"
title Kirim Perubahan Lokal ke GitHub (yanmedrsudalmulk-67 / OPTIMUS-V.3)

echo ======================================================================
echo   KIRIM PERUBAHAN KE GITHUB
echo   Repositori: https://github.com/yanmedrsudalmulk-67/OPTIMUS-V.3
echo   Branch: codex/game-local-launcher
echo ======================================================================
echo.

set /p COMMIT_MSG="Masukkan pesan perubahan (atau tekan Enter untuk default): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG="Update fitur game dari komputer lokal"

git add -A
git commit -m "%COMMIT_MSG%"
git push origin codex/game-local-launcher

echo.
echo ======================================================================
echo   Selesai! Perubahan telah terkirim ke GitHub.
echo ======================================================================
echo.
pause
