@echo off
:: Crucix Background Launcher — runs silently, no window
:: This script checks if Crucix is already running, starts it if not

tasklist /FI "WINDOWTITLE eq Crucix*" 2>NUL | find /I "node.exe" >NUL
if %ERRORLEVEL%==0 (
    echo Crucix already running.
    exit /b 0
)

cd /d "C:\Users\MARK KEKUA\Documents\Crucix"
start "" /MIN wscript.exe "start-crucix.vbs"
echo Crucix started in background.
