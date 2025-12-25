@echo off
setlocal enabledelayedexpansion

:: Get the directory where the script is located
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════╗
echo ║  🥧 Raspberry Pi Server Manager 🥧   ║
echo ╔════════════════════════════════════════╗
echo.

:menu
echo.
echo What would you like to do?
echo.
echo   1) Pull updates and start server
echo   2) Just start server (no update)
echo   3) Only pull updates (don't start)
echo   4) Exit
echo.
set /p choice="Enter your choice [1-4]: "

if "%choice%"=="1" goto pull_and_start
if "%choice%"=="2" goto just_start
if "%choice%"=="3" goto just_pull
if "%choice%"=="4" goto exit
echo.
echo Invalid option. Please choose 1-4.
goto menu

:pull_and_start
echo.
call :pull_updates
call :start_server
goto end

:just_start
echo.
echo Skipping updates...
call :start_server
goto end

:just_pull
echo.
call :pull_updates
echo Done! Exiting...
goto end

:exit
echo.
echo Goodbye! 👋
goto end

:pull_updates
echo 📥 Pulling latest changes from repository...
git pull
if errorlevel 1 (
    echo ✗ Failed to pull changes
    echo   Please check your git configuration or internet connection
    exit /b 1
) else (
    echo ✓ Successfully pulled latest changes!
    echo.
    echo 📦 Installing dependencies...
    call npm install --production
    if errorlevel 1 (
        echo ✗ Failed to install dependencies
        echo   Please check your internet connection or package.json
        exit /b 1
    ) else (
        echo ✓ All dependencies installed successfully!
    )
    echo.
)
exit /b 0

:start_server
echo 🚀 Starting server...
echo ═══════════════════════════════════════
echo.
node server.js
exit /b 0

:end
endlocal
