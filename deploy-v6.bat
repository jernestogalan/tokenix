@echo off
echo === Tokenia v6 — Free Forever Deploy ===
cd /d "%~dp0"

REM Remove stale git lock if it exists
if exist ".git\index.lock" (
  del /f ".git\index.lock"
  echo Removed stale git lock.
)

REM Stage all changes
git add -A
if %errorlevel% neq 0 (
  echo ERROR: git add failed. Check git status.
  pause
  exit /b 1
)

REM Commit
git commit -m "feat: free forever redesign — privacy-first, 5 languages, premium UX, new features"
if %errorlevel% neq 0 (
  echo ERROR: git commit failed.
  pause
  exit /b 1
)

REM Push
git push origin main
if %errorlevel% neq 0 (
  echo ERROR: git push failed.
  pause
  exit /b 1
)

echo.
echo === Deploy SUCCESSFUL! Railway will redeploy in ~1-2 minutes. ===
echo Visit: https://tokenia.live
pause
