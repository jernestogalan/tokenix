@echo off
cd /d "%~dp0"
if exist ".git\index.lock" del /f ".git\index.lock"
git add server.js
git commit -m "fix: migrate newsletter to Resend global contacts API (no audience_id)"
if %errorlevel% neq 0 (echo COMMIT FAILED && pause && exit /b 1)
echo Commit hash:
git rev-parse HEAD
echo.
git push origin main
if %errorlevel% equ 0 (echo SUCCESS) else (echo PUSH FAILED)
pause
