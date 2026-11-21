$ErrorActionPreference = 'SilentlyContinue'

$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$batTarget = Join-Path $projectDir 'MULAI-GAME.bat'
$icoTarget = Join-Path $projectDir 'game.ico'

$activeDesktop = [Environment]::GetFolderPath('Desktop')

$allDesktopDirs = @(
    'C:\Users\Public\Desktop',
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop')
) | Select-Object -Unique

# 1. Bersihkan semua shortcut lama & ganda dari seluruh folder Desktop
foreach ($dir in $allDesktopDirs) {
    if (Test-Path $dir) {
        $oldFiles = Get-ChildItem -Path $dir -Filter '*.lnk' | Where-Object { 
            $_.Name -like '*Tug*' -or 
            $_.Name -like '*Tambang*' -or 
            $_.Name -like '*TARIK*'
        }
        foreach ($f in $oldFiles) {
            Remove-Item -Path $f.FullName -Force -ErrorAction SilentlyContinue
        }

        $oldBats = Get-ChildItem -Path $dir -Filter '*.bat' | Where-Object {
            $_.Name -like '*TARIK*' -or $_.Name -like '*Tambang*' -or $_.Name -like '*Tug*'
        }
        foreach ($b in $oldBats) {
            Remove-Item -Path $b.FullName -Force -ErrorAction SilentlyContinue
        }
    }
}

# 2. Buat HANYA 1 SHORTCUT pada Desktop aktif pengguna
$shortcutPath = Join-Path $activeDesktop 'Game Tarik Tambang Medis.lnk'
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = $batTarget
$sc.WorkingDirectory = $projectDir
$sc.Description = "Mulai Game Tarik Tambang Medis (RSUD Al-Mulk)"
$sc.WindowStyle = 7

if (Test-Path $icoTarget) {
    $sc.IconLocation = "$icoTarget,0"
} else {
    $sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,24"
}
$sc.Save()

# 3. Refresh icon desktop
try {
    Add-Type -TypeDefinition @'
    using System;
    using System.Runtime.InteropServices;
    public class ShellIconHelperUpdate {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
    }
'@ -ErrorAction SilentlyContinue
    [ShellIconHelperUpdate]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host "Shortcut tunggal berhasil diperbarui di: $shortcutPath"
