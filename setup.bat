@echo off
setlocal enabledelayedexpansion
title Smart AI Interview Assistance - One-Time Setup
color 0B

echo ==========================================================
echo   Smart AI Interview Assistance - One-Time Setup
echo ==========================================================
echo.
echo This will:
echo   1. Check Python installation
echo   2. Create a virtual environment
echo   3. Install all required packages
echo   4. Create your .env configuration file
echo   5. Start the application (database + 120+ MCQs +
echo      6 coding problems are created automatically)
echo.
echo ==========================================================
echo.
pause

echo.
echo [1/5] Checking Python installation...
set PYTHON_CMD=
python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
) else (
    py --version >nul 2>&1
    if not errorlevel 1 set PYTHON_CMD=py
)
if "%PYTHON_CMD%"=="" (
    echo.
    echo ERROR: Python was not found on your system.
    echo Please install Python 3.10 or newer from https://www.python.org/downloads/
    echo IMPORTANT: During installation, check "Add Python to PATH".
    echo.
    pause
    exit /b 1
)
%PYTHON_CMD% --version
echo Python found successfully (using "%PYTHON_CMD%").

echo.
echo [2/5] Creating required folders...
if not exist "uploads\resumes" mkdir "uploads\resumes"
if not exist "frontend\assets\images" mkdir "frontend\assets\images"
echo Folders ready.

echo.
echo [3/5] Setting up Python virtual environment...
if not exist "venv" (
    %PYTHON_CMD% -m venv venv
    if errorlevel 1 (
        echo ERROR: Could not create the virtual environment.
        pause
        exit /b 1
    )
) else (
    echo Virtual environment already exists, skipping creation.
)

call venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul 2>&1
echo Installing required packages from requirements.txt...
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERROR: Failed to install one or more Python packages.
    echo Check your internet connection and try running setup.bat again.
    echo.
    pause
    exit /b 1
)
echo All packages installed successfully.

echo.
echo [4/5] Checking environment configuration...
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo A new .env file was created from .env.example.
    echo.
    echo NOTE: AI_API_KEY can stay empty - the app runs fully in
    echo demo/fallback mode without it. SQLite is used automatically,
    echo so no database setup is required.
) else (
    echo .env file already exists, skipping.
)

echo.
echo ==========================================================
echo   SETUP COMPLETE!
echo ==========================================================
echo.
echo You can now start the app anytime by double-clicking run.bat
echo.

echo [5/5] Starting Smart AI Interview Assistance now...
echo.
call run.bat

endlocal
