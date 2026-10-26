$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
  $root = (Get-Location).Path
  $runtime = Join-Path $root '.runtime'
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node -or ((& node --version) -notmatch '^v24\.') -or ((& node -p process.arch) -ne 'x64')) {
    $portable = Get-ChildItem $runtime -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $portable) {
      Write-Host 'Menyiapkan Node.js 24 portabel. Internet diperlukan; tidak perlu Docker.'
      New-Item -ItemType Directory -Force $runtime | Out-Null
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $arch = 'x64' # libSQL ships a Windows x64 binary; ARM Windows uses x64 emulation.
      $base = 'https://nodejs.org/dist/latest-v24.x/'
      $checksums = (Invoke-WebRequest -UseBasicParsing ($base + 'SHASUMS256.txt')).Content
      $line = ($checksums -split "`n" | Where-Object { $_ -match "node-v24\..*-win-$arch\.zip$" } | Select-Object -First 1).Trim()
      if (-not $line) { throw 'Daftar unduhan Node.js tidak ditemukan.' }
      $parts = $line -split '\s+'
      $archive = Join-Path $runtime $parts[1]
      Invoke-WebRequest -UseBasicParsing ($base + $parts[1]) -OutFile $archive
      if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLower() -ne $parts[0].ToLower()) { throw 'Verifikasi unduhan Node.js gagal. Coba jalankan lagi.' }
      Expand-Archive -LiteralPath $archive -DestinationPath $runtime -Force
      Remove-Item -LiteralPath $archive
      $portable = Get-ChildItem $runtime -Filter node.exe -Recurse | Select-Object -First 1
    }
    $env:Path = $portable.DirectoryName + ';' + $env:Path
  }
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut((Join-Path $desktop 'Medical Tug of War.lnk'))
  $shortcut.TargetPath = Join-Path $root 'MULAI-WINDOWS.bat'
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = 'Medical Tug of War - SQLite - port 3005'
  $shortcut.Save()
  Write-Host 'Shortcut Desktop dibuat. Tunggu setup selesai; browser akan terbuka otomatis.'
  & node launcher/start-local.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Game gagal dijalankan. Baca pesan kesalahan di atas.' }
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
