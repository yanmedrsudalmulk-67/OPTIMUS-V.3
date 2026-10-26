$ErrorActionPreference = 'SilentlyContinue'
$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$targetBat = [string](Join-Path $projectDir 'MULAI-WINDOWS.bat')

$wsh = New-Object -ComObject WScript.Shell

# Identify desktop directories (both standard and OneDrive redirected)
$desktops = @(
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop')
) | Select-Object -Unique

$createdCount = 0

foreach ($desktop in $desktops) {
    if (Test-Path $desktop) {
        $shortcutPath = Join-Path $desktop 'Medical Tug of War.lnk'
        $shortcut = $wsh.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = [string]$targetBat
        $shortcut.WorkingDirectory = [string]$projectDir
        $shortcut.Description = 'Medical Tug of War - Game Tarik Tambang Edukasi Medis'
        # Windows shell icon (gamepad / flag / heart)
        if (Test-Path "$env:SystemRoot\System32\imageres.dll") {
            $shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll, 99"
        }
        $shortcut.Save()
        Write-Host "Shortcut berhasil dibuat di: $shortcutPath"
        $createdCount++
    }
}

if ($createdCount -gt 0) {
    Write-Host "Berhasil membuat $createdCount shortcut di Desktop!"
} else {
    Write-Host "Tidak menemukan folder Desktop."
}
