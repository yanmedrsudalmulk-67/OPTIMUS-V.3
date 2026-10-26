$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js belum terpasang di komputer ini. Silakan unduh dan pasang dari https://nodejs.org/'
  }
  Write-Host 'Memulai Medical Tug of War di localhost:3005 (Database SQLite Lokal)...' -ForegroundColor Cyan

  if (-not (Test-Path 'packages/database/prisma/medical.db')) {
    Write-Host 'Menyiapkan database lokal pertama kali...' -ForegroundColor Yellow
    npm run db:setup
    npm run admin:create
  }

  Start-Process 'http://localhost:3005'
  if (Test-Path 'AKUN-ADMIN.txt') {
    Start-Process notepad.exe -ArgumentList 'AKUN-ADMIN.txt'
  }

  Write-Host 'Game berjalan di http://localhost:3005. Jangan tutup jendela ini selama bermain.' -ForegroundColor Green
  Write-Host 'Untuk menghentikan game, tekan Ctrl+C di jendela ini atau jalankan HENTIKAN-WINDOWS.bat.' -ForegroundColor Gray
  npm run dev
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  pause
  exit 1
}
