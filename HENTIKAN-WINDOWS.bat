@echo off
cd /d "%~dp0"
echo Menghentikan server game pada port 3005 dan 4001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3005\>"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4001\>"') do taskkill /F /PID %%a >nul 2>&1
echo Game telah dihentikan.
pause
