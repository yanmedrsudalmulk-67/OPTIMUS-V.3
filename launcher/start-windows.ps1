$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Pasang Docker Desktop dahulu, buka aplikasinya, lalu klik MULAI-WINDOWS.bat lagi.' }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Buka Docker Desktop dan tunggu sampai engine berjalan, lalu coba lagi.' }
  Write-Host 'Menyiapkan game. Pertama kali membutuhkan internet dan beberapa menit. Jangan tutup jendela ini.'
  docker run --rm --mount "type=bind,source=$((Get-Location).Path),target=/work" -w /work node:24-bookworm-slim node launcher/configure.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Konfigurasi gagal. Periksa koneksi internet dan akses folder Docker.' }
  docker compose --env-file launcher/local.env -f compose.local.yml up -d --build --wait --wait-timeout 300
  if ($LASTEXITCODE -ne 0) { throw 'Game belum siap. Periksa pesan di atas; port 3000 harus kosong. Jalankan lagi setelah masalah diperbaiki.' }
  Start-Process 'http://localhost:3000'
  Start-Process notepad.exe -ArgumentList 'AKUN-ADMIN.txt'
  Write-Host 'Game siap. Untuk berhenti klik HENTIKAN-WINDOWS.bat. Data tersimpan di Docker.'
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
