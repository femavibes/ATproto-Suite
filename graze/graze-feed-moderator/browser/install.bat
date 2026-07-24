@echo off
setlocal enabledelayedexpansion

echo 🛡️ ModMaster Browser Extension Installer
echo =========================================

set "INSTALL_DIR=%USERPROFILE%\Downloads\modmaster-browser"
set "TEMP_ZIP=%TEMP%\modmaster-browser.zip"

echo Downloading latest release...
powershell -Command "& {$response = Invoke-RestMethod -Uri 'https://api.github.com/repos/femavibes/modmaster-browser/releases/latest'; $tag = $response.tag_name; Write-Host 'Latest version:' $tag; Invoke-WebRequest -Uri \"https://github.com/femavibes/modmaster-browser/archive/refs/tags/$tag.zip\" -OutFile '%TEMP_ZIP%'; $tag}" > temp_tag.txt

set /p LATEST_TAG=<temp_tag.txt
del temp_tag.txt

if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
mkdir "%INSTALL_DIR%"

echo Extracting...
powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP%' -Force"

set "EXTRACTED_DIR=%TEMP%\modmaster-browser-%LATEST_TAG:v=%"
xcopy "%EXTRACTED_DIR%\*" "%INSTALL_DIR%\" /E /H /Y
rmdir /s /q "%EXTRACTED_DIR%"
del "%TEMP_ZIP%"

echo ✅ Extension installed to: %INSTALL_DIR%
echo.
echo 📋 Next steps:
echo 1. Open Chrome and go to chrome://extensions/
echo 2. Enable 'Developer mode' (top right)
echo 3. Click 'Load unpacked' and select: %INSTALL_DIR%
echo 4. Configure your API key in the extension popup
echo.
echo 🔄 To update later, just run this script again!

pause