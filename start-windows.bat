@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install it from https://nodejs.org ^(choose the LTS version^), then double-click this file again.
  pause
  exit /b 1
)

if not exist "server\.env" (
  echo First-time setup...
  for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT_SECRET=%%s
  > "server\.env" (
    echo DATABASE_URL="file:./dev.db"
    echo JWT_SECRET="!JWT_SECRET!"
    echo PORT=4000
  )
)

pushd server
if not exist "node_modules" (
  echo Installing backend, this only happens once...
  call npm install || goto :error
)
call npx prisma migrate deploy || goto :error
popd

pushd client
if not exist "node_modules" (
  echo Installing frontend, this only happens once...
  call npm install || goto :error
)
if not exist "dist" (
  echo Building the app, this only happens once...
  call npm run build || goto :error
)
popd

pushd desktop
if not exist "node_modules" (
  echo Installing the app shell, this only happens once ^(downloads ~150MB, needs internet^)...
  call npm install || goto :error
)
popd

echo Starting your POS...
cd desktop
call npm start
cd ..
exit /b 0

:error
echo.
echo Something went wrong during setup. Scroll up to see the error above.
pause
exit /b 1
