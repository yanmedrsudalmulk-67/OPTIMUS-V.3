$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
  if (-not (Test-Path 'package.json')) { throw 'Salin UPDATE-GAME.bat dan folder launcher dari paket updater ke folder game yang berisi package.json dan medical.db.' }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node -or ((& node --version) -notmatch '^v24\.')) {
    $portable = Get-ChildItem '.runtime' -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $portable) { throw 'Jalankan MULAI-WINDOWS.bat sekali untuk menyiapkan Node.js, lalu tutup game sebelum update.' }
    $env:Path = $portable.DirectoryName + ';' + $env:Path
  }
  Write-Host 'Tutup game dahulu. Source akan diperbarui; salinan source dan data disimpan di .data/update-backups.'
  Write-Host 'Edit kode lokal akan diganti versi GitHub; salinan edit tersebut tetap tersedia pada backup.'
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
