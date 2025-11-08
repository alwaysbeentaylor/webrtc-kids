# Fly.io Deployment Helper Script (PowerShell)
# Run this from the server directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fly.io Deployment Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if fly CLI is installed
try {
    $null = Get-Command fly -ErrorAction Stop
    Write-Host "[OK] Fly CLI found" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Fly CLI is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install it with:" -ForegroundColor Yellow
    Write-Host "  iwr https://fly.io/install.ps1 -useb | iex" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or download from: https://fly.io/docs/getting-started/installing-flyctl/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if user is logged in
try {
    $null = fly auth whoami 2>&1 | Out-Null
    Write-Host "[OK] Logged in to Fly.io" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Not logged in to Fly.io" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please run: fly auth login" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if fly.toml exists
if (-not (Test-Path "fly.toml")) {
    Write-Host "[INFO] fly.toml not found. Initializing app..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This will prompt you for:" -ForegroundColor Yellow
    Write-Host "  - App name (use: webrtc-signaling-stg)" -ForegroundColor Yellow
    Write-Host "  - Region (use: ams)" -ForegroundColor Yellow
    Write-Host "  - Postgres: No" -ForegroundColor Yellow
    Write-Host "  - Redis: No" -ForegroundColor Yellow
    Write-Host "  - Deploy now: No" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue"
    fly launch --no-deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to initialize app" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

function Show-Menu {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Deployment Options" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Check app status"
    Write-Host "2. View logs (real-time)"
    Write-Host "3. Deploy app"
    Write-Host "4. Set secrets (Firebase, CLIENT_ORIGIN)"
    Write-Host "5. View secrets"
    Write-Host "6. Test health endpoint"
    Write-Host "7. Exit"
    Write-Host ""
}

function Get-AppUrl {
    try {
        $status = fly status --json | ConvertFrom-Json
        if ($status.Hostname) {
            return $status.Hostname
        }
        # Fallback: try to get from fly.toml
        $toml = Get-Content fly.toml -Raw
        if ($toml -match 'app\s*=\s*"([^"]+)"') {
            return "$($matches[1]).fly.dev"
        }
    } catch {
        Write-Host "[WARN] Could not determine app URL" -ForegroundColor Yellow
    }
    return $null
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Choose option (1-7)"
    
    switch ($choice) {
        "1" {
            Write-Host ""
            fly status
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "2" {
            Write-Host ""
            Write-Host "Press Ctrl+C to stop viewing logs" -ForegroundColor Yellow
            Write-Host ""
            fly logs
            Read-Host "Press Enter to continue"
        }
        "3" {
            Write-Host ""
            Write-Host "Deploying to Fly.io..." -ForegroundColor Cyan
            Write-Host ""
            fly deploy
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "[SUCCESS] Deployment complete!" -ForegroundColor Green
                Write-Host ""
                $appUrl = Get-AppUrl
                if ($appUrl) {
                    Write-Host "Test the health endpoint:" -ForegroundColor Yellow
                    Write-Host "  curl https://$appUrl/health" -ForegroundColor Cyan
                }
                fly status
            } else {
                Write-Host ""
                Write-Host "[ERROR] Deployment failed. Check logs with option 2." -ForegroundColor Red
            }
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "4" {
            Write-Host ""
            Write-Host "Setting secrets..." -ForegroundColor Cyan
            Write-Host ""
            Write-Host "IMPORTANT: Replace the values with your actual credentials!" -ForegroundColor Yellow
            Write-Host ""
            
            $firebase = Read-Host "Firebase Service Account JSON (or path to JSON file)"
            $clientOrigin = Read-Host "Client Origin (Vercel URL, e.g., https://webrtc-kids-waa3.vercel.app)"
            
            if ([string]::IsNullOrWhiteSpace($firebase)) {
                Write-Host "[ERROR] Firebase JSON is required" -ForegroundColor Red
                Read-Host "Press Enter to continue"
                continue
            }
            
            if ([string]::IsNullOrWhiteSpace($clientOrigin)) {
                Write-Host "[ERROR] Client Origin is required" -ForegroundColor Red
                Read-Host "Press Enter to continue"
                continue
            }
            
            # Check if firebase is a file path
            if (Test-Path $firebase) {
                Write-Host "Reading Firebase JSON from file..." -ForegroundColor Yellow
                $firebaseJson = Get-Content $firebase -Raw
                fly secrets set FIREBASE_SERVICE_ACCOUNT="$firebaseJson"
            } else {
                fly secrets set FIREBASE_SERVICE_ACCOUNT="$firebase"
            }
            
            if ($LASTEXITCODE -eq 0) {
                fly secrets set CLIENT_ORIGIN="$clientOrigin"
            }
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "[SUCCESS] Secrets set!" -ForegroundColor Green
            } else {
                Write-Host ""
                Write-Host "[ERROR] Failed to set secrets" -ForegroundColor Red
            }
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "5" {
            Write-Host ""
            fly secrets list
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "6" {
            Write-Host ""
            Write-Host "Testing health endpoint..." -ForegroundColor Cyan
            Write-Host ""
            $appUrl = Get-AppUrl
            if ($appUrl) {
                Write-Host "Testing: https://$appUrl/health" -ForegroundColor Yellow
                try {
                    $response = Invoke-WebRequest -Uri "https://$appUrl/health" -UseBasicParsing
                    Write-Host "[SUCCESS] Health check passed!" -ForegroundColor Green
                    Write-Host "Response: $($response.Content)" -ForegroundColor Green
                } catch {
                    Write-Host "[ERROR] Health check failed: $_" -ForegroundColor Red
                }
            } else {
                Write-Host "[ERROR] Could not determine app URL" -ForegroundColor Red
                Write-Host "Run 'fly status' to see your app URL" -ForegroundColor Yellow
            }
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "7" {
            Write-Host ""
            Write-Host "Goodbye!" -ForegroundColor Cyan
            exit 0
        }
        default {
            Write-Host ""
            Write-Host "[ERROR] Invalid choice. Please select 1-7." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}

