@echo off
echo === Tokenia — Push v8 to GitHub ===
cd /d "%~dp0"

echo Removing git lock if present...
if exist ".git\index.lock" del /f ".git\index.lock"

echo Pushing v8 commit to GitHub...
git push origin main
if %errorlevel% neq 0 (
  echo.
  echo Push failed. Trying with credentials prompt...
  git push https://github.com/jernestogalan/tokenix.git main
)

if %errorlevel% equ 0 (
  echo.
  echo SUCCESS! Railway will redeploy in ~2 minutes.
  echo.
  echo Test: https://tokenia.live/api/health
  echo Blog: https://tokenia.live/blog
  echo Admin: https://tokenia.live/admin/stats
) else (
  echo.
  echo PUSH FAILED. Try: git push origin main (in Git Bash)
)
pause
