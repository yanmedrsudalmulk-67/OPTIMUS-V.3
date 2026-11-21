$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
  if (-not (Test-Path 'package.json')) {
    throw 'Salin UPDATE-GAME.bat dan folder launcher ke folder game yang berisi package.json dan medical.db.'
  }

  Write-Host '======================================================================' -ForegroundColor Cyan
  Write-Host '  PEMBARUAN APLIKASI MEDICAL TUG OF WAR DARI GITHUB' -ForegroundColor Cyan
  Write-Host '  Repositori: https://github.com/yanmedrsudalmulk-67/OPTIMUS-V.3' -ForegroundColor Cyan
  Write-Host '  Branch: codex/game-local-launcher' -ForegroundColor Cyan
  Write-Host '======================================================================' -ForegroundColor Cyan
  Write-Host ''

  # Tutup proses server game jika sedang aktif agar query_engine DLL tidak terkunci
  Get-NetTCPConnection -LocalPort 3005, 4001 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }

  if ((Test-Path '.git') -and (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host '[1/3] Mengambil pembaruan terbaru dari GitHub...' -ForegroundColor Yellow
    git fetch origin codex/game-local-launcher
    if ($LASTEXITCODE -ne 0) {
      throw 'Gagal terhubung ke GitHub. Pastikan internet Anda aktif.'
    }

    Write-Host '[2/3] Menerapkan perubahan ke komputer lokal...' -ForegroundColor Yellow
    git pull origin codex/game-local-launcher
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Menyinkronkan perubahan lokal...' -ForegroundColor Gray
      git stash -u | Out-Null
      git pull origin codex/game-local-launcher
      git stash pop 2>&1 | Out-Null
    }

    Write-Host '[3/3] Memperbarui database dan dependensi lokal...' -ForegroundColor Yellow
    npm run db:generate | Out-Null
    npm run db:migrate | Out-Null

    if (Test-Path 'scripts\buat-shortcut-desktop.ps1') {
      & "$PSScriptRoot\..\scripts\buat-shortcut-desktop.ps1" | Out-Null
    }

    Write-Host ''
    Write-Host '======================================================================' -ForegroundColor Green
    Write-Host '  SUKSES! Aplikasi game berhasil diperbarui dari GitHub.' -ForegroundColor Green
    Write-Host '  Database (medical.db), akun admin, dan riwayat skor tetap aman.' -ForegroundColor Green
    Write-Host '======================================================================' -ForegroundColor Green
    exit 0
  }

  # Fallback for standalone zip packages without git:
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node -or ((& node --version) -notmatch '^v24\.')) {
    $portable = Get-ChildItem '.runtime' -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $portable) { throw 'Jalankan MULAI-WINDOWS.bat sekali untuk menyiapkan Node.js, lalu tutup game sebelum update.' }
    $env:Path = $portable.DirectoryName + ';' + $env:Path
  }
  Write-Host 'Tutup game dahulu. Source akan diperbarui; salinan source dan data disimpan di .data/update-backups.'
  & node launcher/update-game.mjs
  $result = $LASTEXITCODE
  if ($result -eq 3 -and -not $env:GITHUB_TOKEN -and -not $env:GH_TOKEN) {
    Write-Host 'Jika repository privat, masukkan GitHub token dengan izin baca Contents. Enter kosong membatalkan.'
    $secure = Read-Host 'Token (disembunyikan)' -AsSecureString
    if ($secure.Length -gt 0) {
      $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      try {
        $env:GITHUB_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        & node launcher/update-game.mjs
        $result = $LASTEXITCODE
      } finally {
        Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      }
    }
  }
  if ($result -ne 0) { throw 'Update belum berhasil. Baca pesan di atas. Jangan hapus database atau file akun.' }
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
