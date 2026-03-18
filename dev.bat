@echo off
TITLE Prompt Commerce - Seller Launcher

SET DIR=%~dp0
SET ADMIN_DIR=%DIR%admin

echo.
echo   Prompt Commerce - Seller Launcher
echo   ----------------------------------
echo.

IF NOT EXIST "%DIR%.env" (
    echo [warn] .env not found - copying from .env.example
    copy "%DIR%.env.example" "%DIR%.env"
)

IF NOT EXIST "%DIR%node_modules" (
    echo Installing MCP server dependencies...
    cd /d "%DIR%" && call npm install
)
IF NOT EXIST "%ADMIN_DIR%\node_modules" (
    echo Installing admin dependencies...
    cd /d "%ADMIN_DIR%" && call npm install
)

echo Starting MCP Server (port 3001)...
start "MCP Server" cmd /k "cd /d "%DIR%" && npm run dev"

echo Starting Admin Panel (port 3000)...
start "Admin Panel" cmd /k "cd /d "%ADMIN_DIR%" && npm run dev"

echo.
echo   MCP Server  - http://localhost:3001
echo   Admin Panel - http://localhost:3000
echo.
echo   Close the separate windows to stop the services.
echo.
