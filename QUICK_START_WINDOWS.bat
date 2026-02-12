@echo off
REM SYNAPSE FORGE - 6-HOUR EMERGENCY SETUP (WINDOWS)

echo 🚀 Synapse Forge - Emergency Demo Setup (Windows)
echo ================================================

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version, then run this script again.
    pause
    exit /b 1
)

echo ✓ Node.js version:
node --version

REM Navigate to project
cd /d %~dp0

REM Install dependencies
echo.
echo 📦 Installing dependencies (this takes 2-3 minutes)...
call npm install

REM Create .env if it doesn't exist
if not exist .env (
    echo.
    echo 🔑 Creating .env file...
    (
        echo ANTHROPIC_API_KEY=your_key_here
    ) > .env
    echo.
    echo ⚠️  IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY
    echo.
)

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Edit .env with your API key
echo 2. Run: npm run server    (Terminal 1^)
echo 3. Run: npm run demo      (Terminal 2^)
echo.
pause
