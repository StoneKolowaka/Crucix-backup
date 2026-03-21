# Crucix Setup Verification Script
# 1) Register scheduled task
# 2) Kill old Crucix processes
# 3) Start fresh Crucix
# 4) Verify everything

$ErrorActionPreference = "Continue"

Write-Output "=== CRUCIX SETUP ==="

# Step 1: Register scheduled task
try {
    $action = New-ScheduledTaskAction -Execute "wscript.exe" `
        -Argument """C:\Users\MARK KEKUA\Documents\Crucix\start-crucix.vbs""" `
        -WorkingDirectory "C:\Users\MARK KEKUA\Documents\Crucix"
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName "Crucix Intelligence Engine" `
        -Action $action -Trigger $trigger -Settings $settings `
        -Description "Auto-start Crucix OSINT on port 3117" -Force | Out-Null
    Write-Output "[OK] Scheduled task registered"
} catch {
    Write-Output "[FAIL] Task registration: $_"
}

# Step 2: Kill any existing node Crucix processes
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | 
    Where-Object { $_.CommandLine -like "*Crucix*server.mjs*" }
if ($procs) {
    $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    Write-Output "[OK] Killed old Crucix processes"
} else {
    Write-Output "[OK] No old Crucix running"
}

# Step 3: Start Crucix via VBS (silent background)
Start-Process -FilePath "wscript.exe" `
    -ArgumentList """C:\Users\MARK KEKUA\Documents\Crucix\start-crucix.vbs""" `
    -WorkingDirectory "C:\Users\MARK KEKUA\Documents\Crucix"
Write-Output "[OK] Crucix starting..."

# Step 4: Wait and verify
Start-Sleep -Seconds 6
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3117/api/health" -UseBasicParsing -TimeoutSec 10
    Write-Output "[OK] Crucix RUNNING on port 3117 ($($r.StatusCode))"
    Write-Output "Health: $($r.Content.Substring(0, [Math]::Min(200, $r.Content.Length)))"
} catch {
    Write-Output "[WAIT] Crucix still starting up, checking again in 10s..."
    Start-Sleep -Seconds 10
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3117/api/health" -UseBasicParsing -TimeoutSec 10
        Write-Output "[OK] Crucix RUNNING on port 3117"
        Write-Output "Health: $($r.Content.Substring(0, [Math]::Min(200, $r.Content.Length)))"
    } catch {
        Write-Output "[FAIL] Crucix not responding: $($_.Exception.Message)"
    }
}

# Step 5: Verify task exists
$task = Get-ScheduledTask -TaskName "Crucix Intelligence Engine" -ErrorAction SilentlyContinue
if ($task) {
    Write-Output "[OK] Startup task: $($task.State)"
} else {
    Write-Output "[FAIL] Startup task not found"
}

Write-Output "=== DONE ==="
