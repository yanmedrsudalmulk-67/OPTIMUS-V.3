@echo off
cd /d "%~dp0"
echo Menghentikan server game Medical Tug of War...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3005\>"') do taskkill /F /T /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4001\>"') do taskkill /F /T /PID %%a >nul 2>&1
echo Game telah dihentikan.
ping 127.0.0.1 -n 2 >nul
exit
