$wsh = New-Object -ComObject WScript.Shell

$desktops = @(
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
    'C:\Users\Public\Desktop'
) | Select-Object -Unique

$projectDir = 'c:\KUMPULAN APLIKASI\GAME TARIK TAMBANG\Medical-Tug-Local'
$batTarget = Join-Path $projectDir 'MULAI-GAME.bat'
$iconPath = "$env:SystemRoot\System32\imageres.dll,99"

# Remove any test files
foreach ($d in $desktops) {
    if (Test-Path $d) {
        Remove-Item (Join-Path $d 'Tarik Tambang RSUD.lnk') -Force -ErrorAction SilentlyContinue
    }
}

$shortcuts = @(
    'Game Tarik Tambang Medis.lnk',
    'Medical Tug of War - Game.lnk'
)

foreach ($d in $desktops) {
    if (Test-Path $d) {
        foreach ($name in $shortcuts) {
            $p = Join-Path $d $name
            try {
                $sc = $wsh.CreateShortcut($p)
                $sc.TargetPath = $batTarget
                $sc.WorkingDirectory = $projectDir
                $sc.Description = "Mulai Game Tarik Tambang Medis (Medical Tug of War)"
                $sc.WindowStyle = 7
                if (Test-Path "$env:SystemRoot\System32\imageres.dll") {
                    $sc.IconLocation = $iconPath
                }
                $sc.Save()
                Write-Host "Created $p"
            } catch {
                Write-Host "Failed $p : $_"
            }
        }
    }
}

Start-Sleep -Seconds 2
$activeDesktop = [Environment]::GetFolderPath('Desktop')
Write-Host "Current shortcuts on active Desktop ($activeDesktop):"
Get-ChildItem -Path $activeDesktop | Where-Object { $_.Name -like "*Tug*" -or $_.Name -like "*Tambang*" } | Format-Table Name, Length, LastWriteTime -AutoSize
