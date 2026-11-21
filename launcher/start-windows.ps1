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

  if (Test-Path "$PSScriptRoot\..\scripts\buat-shortcut-desktop.ps1") {
    & "$PSScriptRoot\..\scripts\buat-shortcut-desktop.ps1" | Out-Null
  }

  # Fast start using production if built, otherwise dev
  $cmd = "start"
  if (-not (Test-Path 'apps/web/.next')) {
    $cmd = "dev"
  }

  # Start server and launch browser
  Start-Process 'http://localhost:3005'

  Write-Host 'Game berjalan di http://localhost:3005.' -ForegroundColor Green
  Write-Host 'Untuk menghentikan game, jalankan HENTIKAN-WINDOWS.bat.' -ForegroundColor Gray
  npm run $cmd
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  pause
  exit 1
}
