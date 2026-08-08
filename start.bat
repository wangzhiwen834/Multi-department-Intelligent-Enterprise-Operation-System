@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Enterprise Ops System - Quick Start
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found! Please install Node.js first.
  goto :end
)
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node not found! Please install Node.js first.
  goto :end
)

echo [1/4] Install root dependencies (concurrently)...
call npm install
if errorlevel 1 echo [WARN] npm install failed, trying to continue...

echo.
echo [2/4] Database migration + seed (boss/boss123, mgr/mgr123)...
call npm run setup
if errorlevel 1 echo [WARN] setup may have failed, trying to continue...

echo.
echo [3/4] Check Python media publisher service...
set SKIP_MEDIA=0

where python >nul 2>nul
if errorlevel 1 (
  echo [WARN] python not found! Media publish feature disabled.
  set SKIP_MEDIA=1
  goto :python_done
)

if exist media-publisher\venv\Scripts\python.exe goto :venv_exists

echo   Creating Python venv (first run is slow, please wait)...
cd media-publisher
python -m venv venv
if errorlevel 1 (
  echo [ERROR] Failed to create venv, skipping media service
  set SKIP_MEDIA=1
  cd ..
  goto :python_done
)
echo   Installing Python dependencies...
call venv\Scripts\pip install -r requirements.txt
echo   Installing Playwright Chromium...
call venv\Scripts\playwright install chromium
cd ..
goto :python_done

:venv_exists
echo   Python venv already exists

:python_done

echo.
echo [4/4] Starting services...

if "%SKIP_MEDIA%"=="1" goto :start_without_media

echo   Starting server(:3000) + web(:5173) + media(:5409)
start "" /min cmd /c "timeout /t 12 /nobreak >nul && start http://localhost:5173"
call npx concurrently -n server,web,media -c cyan,magenta,yellow "cd server && npm run dev" "cd web && npm run dev" "cd media-publisher && venv\Scripts\python app.py"
goto :end

:start_without_media
echo   Starting server(:3000) + web(:5173)  (media skipped)
start "" /min cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:5173"
call npx concurrently -n server,web -c cyan,magenta "cd server && npm run dev" "cd web && npm run dev"

:end
echo.
echo ============================================
echo  Process exited. Press any key to close.
echo ============================================
pause >nul
endlocal
