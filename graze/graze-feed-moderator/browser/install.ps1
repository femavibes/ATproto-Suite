# ModMaster Browser Extension Installer/Updater for Windows
# Usage: Run in PowerShell as Administrator or save as install.ps1 and run

param(
    [string]$InstallPath = "$env:USERPROFILE\Downloads\modmaster-browser"
)

Write-Host "🛡️ ModMaster Browser Extension Installer" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Get latest release
Write-Host "Fetching latest release..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/femavibes/modmaster-browser/releases/latest"
    $latestTag = $response.tag_name
    Write-Host "Latest version: $latestTag" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get latest release" -ForegroundColor Red
    exit 1
}

# Download URL
$downloadUrl = "https://github.com/femavibes/modmaster-browser/archive/refs/tags/$latestTag.zip"
$zipPath = "$env:TEMP\modmaster-browser.zip"

# Download
Write-Host "Downloading extension..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
} catch {
    Write-Host "❌ Failed to download extension" -ForegroundColor Red
    exit 1
}

# Clean up old installation
if (Test-Path $InstallPath) {
    Remove-Item -Path $InstallPath -Recurse -Force
}
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

# Extract
Write-Host "Extracting..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force
    $extractedFolder = "$env:TEMP\modmaster-browser-$($latestTag.TrimStart('v'))"
    Move-Item -Path "$extractedFolder\*" -Destination $InstallPath -Force
    Remove-Item -Path $extractedFolder -Recurse -Force
} catch {
    Write-Host "❌ Failed to extract extension" -ForegroundColor Red
    exit 1
}

# Clean up
Remove-Item -Path $zipPath -Force

Write-Host "✅ Extension downloaded to: $InstallPath" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Chrome and go to chrome://extensions/" -ForegroundColor White
Write-Host "2. Enable 'Developer mode' (top right toggle)" -ForegroundColor White
Write-Host "3. Click 'Load unpacked' and select: $InstallPath" -ForegroundColor White
Write-Host "4. Configure your API key in the extension popup" -ForegroundColor White
Write-Host ""
Write-Host "🔄 To update later, just run this script again!" -ForegroundColor Yellow

# Optional: Open Chrome extensions page
$openChrome = Read-Host "Open Chrome extensions page now? (y/n)"
if ($openChrome -eq 'y' -or $openChrome -eq 'Y') {
    Start-Process "chrome://extensions/"
}