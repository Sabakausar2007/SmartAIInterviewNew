@echo off
title Smart AI Interview Assistance - Server
color 0A

echo ==========================================================
echo   Starting Smart AI Interview Assistance...
echo ==========================================================
echo.

if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found.
    echo Please run setup.bat first to set up the project.
    echo.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

if not exist ".env" (
    echo ERROR: .env file not found.
    echo Please run setup.bat first to create your configuration.
    echo.
    pause
    exit /b 1
)

echo Launching the FastAPI server...
echo The app will open automatically in your browser.
echo.
echo Press CTRL+C in this window to stop the server.
echo ==========================================================
echo.

set APP_HOST=127.0.0.1
set APP_PORT=8000
for /f "tokens=1,2 delims==" %%A in ('findstr /b "APP_HOST APP_PORT" .env') do (
    if "%%A"=="APP_HOST" set APP_HOST=%%B
    if "%%A"=="APP_PORT" set APP_PORT=%%B
)

start "" /b cmd /c "timeout /t 3 >nul && start http://%APP_HOST%:%APP_PORT%"

python -m uvicorn main:app --app-dir backend --host %APP_HOST% --port %APP_PORT%

pause
