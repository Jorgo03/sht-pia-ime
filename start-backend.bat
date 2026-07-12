@echo off
setlocal
title Shtepia.ime Server

rem ------------------------------------------------------------------
rem  Shtepia.ime one-click launcher
rem
rem  The backend of this project - database, auth, storage and edge
rem  functions - is HOSTED ON SUPABASE and is not a local process.
rem  This script starts the local web app server (Vite, npm run dev)
rem  that connects to it, after checking that the hosted backend is
rem  actually reachable.
rem ------------------------------------------------------------------

rem Always run from the folder this script lives in, wherever it was
rem clicked from. Quotes keep paths with spaces intact.
cd /d "%~dp0"

set "PORT=5173"
set "SUPABASE_URL=https://xzzzhlwmzotibrxdqmcm.supabase.co"

echo ==============================================================
echo   Shtepia.ime launcher
echo ==============================================================
echo.

rem ---- 1. Node.js installed? --------------------------------------
node --version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo         Install it from https://nodejs.org and run this again.
    echo.
    pause
    exit /b 1
)
for /f %%v in ('node --version') do echo [OK] Node.js %%v found.

rem ---- 2. Environment file ----------------------------------------
rem Vite loads .env / .env.local automatically; the app needs
rem VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from there.
if exist ".env" goto :env_ok
if exist ".env.local" goto :env_ok
echo [ERROR] No .env or .env.local file found in "%~dp0".
echo         The app cannot reach Supabase without it.
echo.
pause
exit /b 1
:env_ok
echo [OK] Environment file found - Vite loads it automatically.

rem ---- 3. Dependencies (install only when missing) ----------------
if exist "node_modules\" goto :deps_ok
echo [..] node_modules not found - running npm install, this can take a minute...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed - read the output above.
    echo.
    pause
    exit /b 1
)
:deps_ok
echo [OK] Dependencies present.

rem ---- 4. Is port %PORT% already taken? ----------------------------
set "PID_IN_USE="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "LISTENING" ^| findstr /c:":%PORT% "') do set "PID_IN_USE=%%p"
if not defined PID_IN_USE goto :port_ok
echo [ERROR] Port %PORT% is already in use by process ID %PID_IN_USE%:
echo.
tasklist /fi "PID eq %PID_IN_USE%"
echo.
echo         Close that process - it may be an already-running copy of
echo         this launcher - and try again.
echo.
pause
exit /b 1
:port_ok
echo [OK] Port %PORT% is free.

rem ---- 5. Is the hosted Supabase backend awake? --------------------
rem The free-tier project auto-pauses after inactivity; warn early
rem instead of letting the app open with no data. The health endpoint
rem needs the public anon key - read it from the env file (it is the
rem same key the browser bundle ships with, not a secret).
set "SB_ANON_KEY="
if exist ".env.local" for /f "usebackq tokens=1,* delims==" %%a in (".env.local") do if "%%a"=="VITE_SUPABASE_ANON_KEY" set "SB_ANON_KEY=%%b"
if not defined SB_ANON_KEY if exist ".env" for /f "usebackq tokens=1,* delims==" %%a in (".env") do if "%%a"=="EXPO_PUBLIC_SUPABASE_ANON_KEY" set "SB_ANON_KEY=%%b"
set "SB_STATUS=unreachable"
where curl >nul 2>nul
if errorlevel 1 goto :health_done
if not defined SB_ANON_KEY goto :health_done
for /f %%s in ('curl -s -o nul -w "%%{http_code}" --max-time 8 -H "apikey: %SB_ANON_KEY%" "%SUPABASE_URL%/auth/v1/health" 2^>nul') do set "SB_STATUS=%%s"
:health_done
if "%SB_STATUS%"=="200" echo [OK] Supabase backend is up.
if not "%SB_STATUS%"=="200" echo [WARNING] Supabase backend check returned: %SB_STATUS% - expected 200.
if not "%SB_STATUS%"=="200" echo           If the app shows no data, the free-tier project may be
if not "%SB_STATUS%"=="200" echo           paused - restore it at https://supabase.com/dashboard

rem ---- 6. Start ----------------------------------------------------
echo.
echo ==============================================================
echo   Local app:   http://localhost:%PORT%
echo   Backend API: %SUPABASE_URL%  - hosted, nothing to start
echo   Stop with Ctrl+C in this window.
echo ==============================================================
echo.
call npm run dev

echo.
echo Server exited - if it crashed, the error is above.
pause
