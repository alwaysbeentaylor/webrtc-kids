@echo off
REM Fly.io Deployment Helper Script
REM Run this from the server directory

echo ========================================
echo Fly.io Deployment Helper
echo ========================================
echo.

REM Check if fly CLI is installed
where fly >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fly CLI is not installed!
    echo.
    echo Install it with:
    echo   PowerShell: iwr https://fly.io/install.ps1 -useb ^| iex
    echo.
    echo Or download from: https://fly.io/docs/getting-started/installing-flyctl/
    pause
    exit /b 1
)

echo [OK] Fly CLI found
echo.

REM Check if user is logged in
fly auth whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Not logged in to Fly.io
    echo.
    echo Please run: fly auth login
    pause
    exit /b 1
)

echo [OK] Logged in to Fly.io
echo.

REM Check if fly.toml exists
if not exist fly.toml (
    echo [INFO] fly.toml not found. Initializing app...
    echo.
    echo This will prompt you for:
    echo   - App name (use: webrtc-signaling-stg)
    echo   - Region (use: ams)
    echo   - Postgres: No
    echo   - Redis: No
    echo   - Deploy now: No
    echo.
    pause
    fly launch --no-deploy
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to initialize app
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo Deployment Options
echo ========================================
echo.
echo 1. Check app status
echo 2. View logs
echo 3. Deploy app
echo 4. Set secrets (Firebase, CLIENT_ORIGIN)
echo 5. View secrets
echo 6. Test health endpoint
echo 7. Exit
echo.
set /p choice="Choose option (1-7): "

if "%choice%"=="1" (
    echo.
    fly status
    pause
    goto :menu
)

if "%choice%"=="2" (
    echo.
    echo Press Ctrl+C to stop viewing logs
    echo.
    fly logs
    pause
    goto :menu
)

if "%choice%"=="3" (
    echo.
    echo Deploying to Fly.io...
    echo.
    fly deploy
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [SUCCESS] Deployment complete!
        echo.
        echo Test the health endpoint:
        fly status
    ) else (
        echo.
        echo [ERROR] Deployment failed. Check logs with option 2.
    )
    pause
    goto :menu
)

if "%choice%"=="4" (
    echo.
    echo Setting secrets...
    echo.
    echo IMPORTANT: Replace the values with your actual credentials!
    echo.
    set /p firebase="Firebase Service Account JSON (or path to JSON file): "
    set /p client_origin="Client Origin (Vercel URL): "
    
    if "%firebase%"=="" (
        echo [ERROR] Firebase JSON is required
        pause
        goto :menu
    )
    
    if "%client_origin%"=="" (
        echo [ERROR] Client Origin is required
        pause
        goto :menu
    )
    
    REM Check if firebase is a file path
    if exist "%firebase%" (
        echo Reading Firebase JSON from file...
        for /f "delims=" %%i in ('type "%firebase%"') do set firebase_json=%%i
        fly secrets set FIREBASE_SERVICE_ACCOUNT="%firebase_json%"
    ) else (
        fly secrets set FIREBASE_SERVICE_ACCOUNT="%firebase%"
    )
    
    fly secrets set CLIENT_ORIGIN="%client_origin%"
    
    echo.
    echo [SUCCESS] Secrets set!
    echo.
    pause
    goto :menu
)

if "%choice%"=="5" (
    echo.
    fly secrets list
    pause
    goto :menu
)

if "%choice%"=="6" (
    echo.
    echo Testing health endpoint...
    echo.
    for /f "tokens=*" %%i in ('fly status --json ^| findstr "Hostname"') do set hostname=%%i
    REM Extract hostname from JSON (simplified)
    echo Please run manually:
    echo   fly status
    echo   Then test: curl https://YOUR-APP-NAME.fly.dev/health
    echo.
    pause
    goto :menu
)

if "%choice%"=="7" (
    exit /b 0
)

:menu
goto :eof

