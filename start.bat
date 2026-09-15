<# :
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression (Get-Content '%~f0' -Raw)"
exit /b %ERRORLEVEL%
#>
param (
    [switch]$SkipDeps = $false
)

$ErrorActionPreference = "Stop"

# Paths
$Root = (Get-Item -Path ".\").FullName
$RuntimeDir = Join-Path $Root ".runtime"
$LogDir = Join-Path $Root "logs"

# Ensure directories exist
if (-not (Test-Path $RuntimeDir)) { New-Item -ItemType Directory -Path $RuntimeDir | Out-Null }
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "             SECURE DMS LOCAL SERVER" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# [1/4] Checking dependencies
Write-Host "`n[1/5] Checking dependencies..." -ForegroundColor Yellow
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw "Java is not installed or not in PATH." }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed or not in PATH." }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python is not installed or not in PATH." }

# [2/4] Starting Redis
Write-Host "[2/5] Starting Redis..." -ForegroundColor Yellow
$RedisExe = Join-Path $Root "backend\redis\redis-server.exe"
if (Test-Path $RedisExe) {
    $RedisLog = Join-Path $LogDir "redis.log"
    $RedisProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"redis-server.exe > `"$RedisLog`" 2>&1`"" -WorkingDirectory (Join-Path $Root "backend\redis") -WindowStyle Hidden -PassThru
    $RedisProc.Id | Out-File (Join-Path $RuntimeDir "redis.pid") -Encoding ASCII
} else {
    Write-Host "Local redis-server.exe not found in backend\redis. Assuming Redis is already running globally." -ForegroundColor DarkGray
}

# [3/4] Starting Spring Boot
Write-Host "[3/5] Starting Spring Boot..." -ForegroundColor Yellow
$SpringLog = Join-Path $LogDir "spring.log"
$SpringProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `".\mvnw.cmd spring-boot:run > `"$SpringLog`" 2>&1`"" -WorkingDirectory (Join-Path $Root "backend\spring") -WindowStyle Hidden -PassThru
$SpringProc.Id | Out-File (Join-Path $RuntimeDir "spring.pid") -Encoding ASCII

# [4/4] Starting Python Worker
Write-Host "[4/5] Starting Python Worker..." -ForegroundColor Yellow
$WorkerLog = Join-Path $LogDir "worker.log"
$WorkerDir = Join-Path $Root "backend\python-worker"
if (-not (Test-Path (Join-Path $WorkerDir "venv"))) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor DarkGray
    Start-Process -FilePath "python" -ArgumentList "-m venv venv" -WorkingDirectory $WorkerDir -Wait -NoNewWindow
}
if (-not $SkipDeps) {
    Write-Host "Installing worker dependencies..." -ForegroundColor DarkGray
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"venv\Scripts\activate.bat && pip install -r requirements.txt > `"$WorkerLog`" 2>&1`"" -WorkingDirectory $WorkerDir -Wait -WindowStyle Hidden
}

$WorkerProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"venv\Scripts\activate.bat && celery -A celery_app worker --loglevel=info -P solo > `"$WorkerLog`" 2>&1`"" -WorkingDirectory $WorkerDir -WindowStyle Hidden -PassThru
$WorkerProc.Id | Out-File (Join-Path $RuntimeDir "worker.pid") -Encoding ASCII

# Wait for Spring Boot
Write-Host "`nWaiting for backend..." -ForegroundColor Cyan
$BackendUp = $false
$RetryCount = 0
while (-not $BackendUp -and $RetryCount -lt 60) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get -ErrorAction Stop -UseBasicParsing
        if ($response.status -eq "UP") {
            $BackendUp = $true
        }
    } catch {
        Start-Sleep -Seconds 2
        $RetryCount++
    }
}

if (-not $BackendUp) {
    Write-Host "BACKEND: OFFLINE" -ForegroundColor Red
    Write-Host "SYSTEM: NOT READY" -ForegroundColor Red
    Write-Host "[ERROR] Spring Boot failed to start within 120 seconds. Check logs\spring.log." -ForegroundColor Red
    exit 1
}
Write-Host "Backend: ONLINE" -ForegroundColor Green

# [5/5] Starting Frontend
Write-Host "`n[5/5] Starting Frontend..." -ForegroundColor Yellow
$FrontendLog = Join-Path $LogDir "frontend.log"
$FrontendDir = Join-Path $Root "frontend"
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor DarkGray
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm install" -WorkingDirectory $FrontendDir -Wait -NoNewWindow
}

$FrontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"npm run dev > `"$FrontendLog`" 2>&1`"" -WorkingDirectory $FrontendDir -WindowStyle Hidden -PassThru
$FrontendProc.Id | Out-File (Join-Path $RuntimeDir "frontend.pid") -Encoding ASCII

Write-Host "`nWaiting for frontend..." -ForegroundColor Cyan
$FrontendUp = $false
$RetryCount = 0
while (-not $FrontendUp -and $RetryCount -lt 30) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method Get -ErrorAction Stop -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $FrontendUp = $true
        }
    } catch {
        Start-Sleep -Seconds 1
        $RetryCount++
    }
}

if (-not $FrontendUp) {
    Write-Host "FRONTEND: OFFLINE" -ForegroundColor Red
    Write-Host "SYSTEM: NOT READY" -ForegroundColor Red
    Write-Host "[ERROR] Vite failed to start within 30 seconds. Check logs\frontend.log." -ForegroundColor Red
    exit 1
}
Write-Host "Frontend: ONLINE" -ForegroundColor Green

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "             SECURE DMS IS READY" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Frontend:"
Write-Host "http://localhost:5173" -ForegroundColor White
Write-Host "`nBackend:"
Write-Host "http://localhost:8080" -ForegroundColor White
Write-Host "`nHealth:"
Write-Host "http://localhost:8080/health" -ForegroundColor White
Write-Host "`nLogs:"
Write-Host "logs\spring.log" -ForegroundColor DarkGray
Write-Host "logs\worker.log" -ForegroundColor DarkGray
Write-Host "logs\frontend.log" -ForegroundColor DarkGray
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "`nOpening browser..." -ForegroundColor Cyan

Start-Process "http://localhost:5173"
