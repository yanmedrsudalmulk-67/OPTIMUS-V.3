$ErrorActionPreference = 'SilentlyContinue'

if ([string]::IsNullOrEmpty($PSScriptRoot)) {
    $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectDir

$logFile = Join-Path $PSScriptRoot 'sync.log'
function Log-Sync {
    param([string]$Text)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $logFile -Value "[$ts] $Text" -ErrorAction SilentlyContinue
}

Log-Sync "=== Background Auto-Sync Watcher Aktif ==="

while ($true) {
    try {
        if (Get-Command git -ErrorAction SilentlyContinue) {
            $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
            if (-not [string]::IsNullOrEmpty($branch)) {
                git fetch origin $branch 2>$null
                $localHash = (git rev-parse HEAD 2>$null)
                $remoteHash = (git rev-parse "origin/$branch" 2>$null)

                if ($remoteHash -and $localHash -and ($localHash -ne $remoteHash)) {
                    Log-Sync "Pembaruan terdeteksi di GitHub ($localHash -> $remoteHash). Mengunduh..."
                    git pull --rebase origin $branch 2>$null

                    Log-Sync "Menjalankan npm run build untuk menerapkan kode terbaru..."
                    Start-Process -FilePath "npm.cmd" -ArgumentList "run build" -WorkingDirectory $projectDir -WindowStyle Hidden -Wait
                    Log-Sync "Pembaruan dari GitHub berhasil diterapkan secara otomatis!"
                }
            }
        }
    } catch {
        Log-Sync "Sync warning: $_"
    }

    # Periksa setiap 30 detik
    [System.Threading.Thread]::Sleep(30000)
}
