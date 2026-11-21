$ErrorActionPreference = 'SilentlyContinue'

$projectDir = 'c:\KUMPULAN APLIKASI\GAME TARIK TAMBANG\Medical-Tug-Local'
$batTarget = Join-Path $projectDir 'MULAI-GAME.bat'
$icoTarget = Join-Path $projectDir 'game.ico'

$activeDesktop = [Environment]::GetFolderPath('Desktop')
Write-Host "Active user desktop detected: $activeDesktop"

# All possible desktop locations where duplicates might live
$allDesktopDirs = @(
    'C:\Users\Public\Desktop',
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop')
) | Select-Object -Unique

# 1. Remove all old and duplicate game shortcuts across all desktop locations
foreach ($dir in $allDesktopDirs) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Filter '*.lnk' | Where-Object { 
            $_.Name -like '*Tug*' -or 
            $_.Name -like '*Tambang*' -or 
            $_.Name -like '*TARIK*'
        }
        foreach ($f in $files) {
            try {
                Remove-Item -Path $f.FullName -Force -ErrorAction SilentlyContinue
                Write-Host "Removed old shortcut: $($f.FullName)"
            } catch {
                Write-Host "Failed to remove $($f.FullName): $_"
            }
        }

        # Also remove any old .bat files on desktop
        $batFiles = Get-ChildItem -Path $dir -Filter '*.bat' | Where-Object {
            $_.Name -like '*TARIK*' -or $_.Name -like '*Tambang*' -or $_.Name -like '*Tug*'
        }
        foreach ($b in $batFiles) {
            Remove-Item -Path $b.FullName -Force -ErrorAction SilentlyContinue
        }
    }
}

# 2. Create EXACTLY ONE shortcut only on the active desktop
$shortcutPath = Join-Path $activeDesktop 'Game Tarik Tambang Medis.lnk'
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = $batTarget
$sc.WorkingDirectory = $projectDir
$sc.Description = "Mulai Game Tarik Tambang Medis (RSUD Al-Mulk)"
$sc.WindowStyle = 7 # Minimized launch to prevent cmd popup flicker

if (Test-Path $icoTarget) {
    $sc.IconLocation = "$icoTarget,0"
} else {
    $sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,24"
}

$sc.Save()
Write-Host "Successfully created single shortcut: $shortcutPath"

# 3. Refresh Windows Shell Icon Cache so desktop updates immediately
try {
    Add-Type -TypeDefinition @'
    using System;
    using System.Runtime.InteropServices;
    public class ShellIconHelper {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
    }
'@ -ErrorAction SilentlyContinue
    [ShellIconHelper]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
    Write-Host "Desktop shell notification refreshed."
} catch {
    Write-Host "Shell refresh note: $_"
}

# Verify desktop state
Start-Sleep -Seconds 1
Write-Host "`n=== CURRENT DESKTOP SHORTCUTS ==="
Get-ChildItem -Path $allDesktopDirs -ErrorAction SilentlyContinue | Where-Object { 
    $_.Name -like '*Tug*' -or $_.Name -like '*Tambang*' -or $_.Name -like '*TARIK*'
} | Format-Table FullName, Length, LastWriteTime -AutoSize
