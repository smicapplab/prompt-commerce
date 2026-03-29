@echo off
TITLE Prompt Commerce - Seller Dev

SET DIR=%~dp0..\

echo.
echo   Prompt Commerce - Seller Dev
echo   -----------------------------
echo   Single port: Express + Vite middleware on :3000
echo.

IF NOT EXIST "%DIR%.env" (
    echo [warn] .env not found - copying from .env.example
    copy "%DIR%.env.example" "%DIR%.env"
)

IF NOT EXIST "%DIR%node_modules" (
    echo Installing dependencies...
    cd /d "%DIR%" && call npm install
)

echo Running DB migrations...
cd /d "%DIR%" && call npm run db:migrate

echo.
echo Starting seller server (port 3000)...
npm run dev:server

echo.
echo   Admin UI   -^> http://localhost:3000/admin
echo   MCP / SSE  -^> http://localhost:3000/sse/:store-slug
echo.
