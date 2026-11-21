$ErrorActionPreference = 'SilentlyContinue'

if ([string]::IsNullOrEmpty($PSScriptRoot)) {
    $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectDir

$logFile = Join-Path $PSScriptRoot 'launch.log'
function Log-Msg {
    param([string]$Text)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $logFile -Value "[$ts] $Text" -ErrorAction SilentlyContinue
}

Log-Msg "=== Launch requested ==="

# Function to test whether port 3005 is ready
function Test-PortOpen {
    param([int]$Port = 3005, [int]$TimeoutMs = 250)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ready = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($ready -and $tcp.Connected) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

function Open-GameApp {
    $browsers = @(
        "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles (x86)\Google\Chrome\Application\chrome.exe"
    )
    foreach ($exe in $browsers) {
        if (Test-Path $exe) {
            Log-Msg "Opening in dedicated app mode via: $exe"
            Start-Process -FilePath $exe -ArgumentList "--app=http://localhost:3005"
            return
        }
    }
    Log-Msg "Opening in default browser."
    Start-Process 'http://localhost:3005'
}

# 1. Quick check: Is port 3005 already running?
if (Test-PortOpen -Port 3005 -TimeoutMs 200) {
    Log-Msg "Port 3005 is already active. Opening app window immediately."
    Open-GameApp
    exit 0
}

# 2. Check Node.js is present
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Log-Msg "Node.js not found."
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Node.js belum terpasang di komputer ini.`nSilakan pasang Node.js dari https://nodejs.org/",
        "Medical Tug of War",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    exit 1
}

# 3. Fast auto-sync with GitHub (checks if new commits exist from AI Studio)
try {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
        if ($branch) {
            $fetchJob = Start-Job -ScriptBlock {
                param($dir, $br)
                Set-Location $dir
                git fetch origin $br 2>$null
            } -ArgumentList $projectDir, $branch

            $completed = Wait-Job $fetchJob -Timeout 3
            if ($completed) {
                Receive-Job $fetchJob | Out-Null
                $localHash = (git rev-parse HEAD 2>$null)
                $remoteHash = (git rev-parse "origin/$branch" 2>$null)
                if ($remoteHash -and $localHash -and ($localHash -ne $remoteHash)) {
                    Log-Msg "GitHub update found from AI Studio ($localHash -> $remoteHash). Auto-pulling..."
                    git pull --rebase origin $branch 2>$null
                    Log-Msg "Rebuilding web application..."
                    Start-Process -FilePath "npm.cmd" -ArgumentList "run build" -WorkingDirectory $projectDir -WindowStyle Hidden -Wait
                }
            } else {
                Stop-Job $fetchJob | Out-Null
                Log-Msg "Git fetch timed out or offline, skipping auto-sync."
            }
            Remove-Job $fetchJob -Force -ErrorAction SilentlyContinue
        }
    }
} catch {
    Log-Msg "Auto-sync check error: $_"
}

# 4. Database initialization if first time
if (-not (Test-Path 'packages/database/prisma/medical.db')) {
    Log-Msg "Database not found. Initializing..."
    Start-Process -FilePath "npm.cmd" -ArgumentList "run db:setup" -WorkingDirectory $projectDir -WindowStyle Hidden -Wait
    Start-Process -FilePath "npm.cmd" -ArgumentList "run admin:create" -WorkingDirectory $projectDir -WindowStyle Hidden -Wait
}

# 5. Choose fast production start if .next exists, otherwise fallback to dev
$scriptCmd = "start"
if (-not (Test-Path 'apps/web/.next')) {
    $scriptCmd = "dev"
}

Log-Msg "Starting server with 'npm run $scriptCmd'..."
# 6. Start background server silently in hidden window
Start-Process -FilePath "npm.cmd" -ArgumentList "run $scriptCmd" -WorkingDirectory $projectDir -WindowStyle Hidden

# 6. Wait for both port 3005 and port 4001 to respond (max 20 seconds, poll every 200ms)
Log-Msg "Waiting for port 3005 and port 4001 to respond..."
$isReady = $false
for ($i = 0; $i -lt 100; $i++) {
    [System.Threading.Thread]::Sleep(200)
    $webReady = Test-PortOpen -Port 3005 -TimeoutMs 200
    $apiReady = Test-PortOpen -Port 4001 -TimeoutMs 200
    if ($webReady -and $apiReady) {
        $isReady = $true
        Log-Msg "Both ports 3005 and 4001 responded after $(($i + 1) * 200) ms."
        break
    }
}

# 7. Open dedicated game app window
Log-Msg "Opening game app window (Ready=$isReady)"
Open-GameApp
Log-Msg "=== Launch completed successfully ==="
exit 0
