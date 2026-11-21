@echo off
cd /d "%~dp0"
powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\start-fast.ps1"
exit
