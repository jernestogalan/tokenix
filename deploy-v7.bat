@echo off
echo === Tokenia v7 — Global Domination Deploy ===
cd /d "%~dp0"

REM Remove stale git lock if it exists
if exist ".git\index.lock" (
  del /f ".git\index.lock"
  echo Removed stale git lock.
)

REM Stage all changes
git add -A
if %errorlevel% neq 0 (
  echo ERROR: git add failed.
  pause & exit /b 1
)

REM Commit
git commit -m "feat v7: token visualizer, prompt optimizer, public API, PWA, OG image, compare models, share buttons, accessibility, 5 languages, setup docs"
if %errorlevel% neq 0 (
  echo ERROR: git commit failed.
  pause & exit /b 1
)

REM Push
git push origin main
if %errorlevel% neq 0 (
  echo ERROR: git push failed.
  pause & exit /b 1
)

echo.
echo === Deploy SUCCESSFUL! Railway redeploys in ~2 min ===
echo.
echo Next steps:
echo  1. Activate Cloudflare  → see SETUP-CLOUDFLARE.md
echo  2. Activate Plausible   → see SETUP-PLAUSIBLE.md
echo  3. Set up monitoring    → see SETUP-MONITORING.md
echo  4. Test: https://tokenia.live
echo  5. Test API: curl -X POST https://tokenia.live/api/v1/count -H "Content-Type: application/json" -d "{\"text\":\"Hello world\"}"
echo.
pause
