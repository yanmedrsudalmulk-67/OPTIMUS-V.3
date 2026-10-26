@echo off
cd /d "%~dp0"
docker compose --env-file launcher/local.env -f compose.local.yml stop
pause
