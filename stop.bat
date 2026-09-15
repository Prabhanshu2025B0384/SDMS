<# :
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression (Get-Content '%~f0' -Raw)"
exit /b %ERRORLEVEL%
#>
$ErrorActionPreference = "SilentlyContinue"

$Root = (Get-Item -Path ".\").FullName
$RuntimeDir = Join-Path $Root ".runtime"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        SECURE DMS SHUTDOWN" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

function Stop-ProcessTree {
    param([int]$parentId)
    # Get all processes whose ParentProcessId is $parentId
    $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $parentId }
    foreach ($child in $children) {
        Stop-ProcessTree -parentId $child.ProcessId
    }
    Stop-Process -Id $parentId -Force -ErrorAction SilentlyContinue
}

if (Test-Path $RuntimeDir) {
    foreach ($file in Get-ChildItem -Path $RuntimeDir -Filter "*.pid") {
        $pidStr = Get-Content $file.FullName
        if ([int]::TryParse($pidStr, [ref]$pidInt)) {
            $procName = $file.BaseName
            Write-Host "Stopping $procName (PID: $pidInt)..." -ForegroundColor Yellow
            Stop-ProcessTree -parentId $pidInt
        }
    }
    Remove-Item -Path $RuntimeDir -Recurse -Force
}

# Fallback cleanup for worker processes (Celery specifically spawns multiple python.exe)
# But we only want to kill processes spawned from our specific python-worker path
Write-Host "Performing final cleanup..." -ForegroundColor DarkGray
Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'celery.exe'" | Where-Object { $_.CommandLine -match "backend\\python-worker" } | Invoke-CimMethod -MethodName Terminate | Out-Null
Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine -match "SecureDmsApplication" } | Invoke-CimMethod -MethodName Terminate | Out-Null

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        SERVICES STOPPED" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
