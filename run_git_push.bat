@echo off
cd /d "C:\Users\jerne\OneDrive\Documents\Claude\Projects\Tokens\tokenix"
echo === CHECKING SYNTAX ===
node --check server.js
if %errorlevel% neq 0 (
    echo SYNTAX ERROR - aborting
    pause
    exit /b 1
)
echo === GIT STATUS ===
git status
echo.
echo === GIT ADD ===
git add -A
echo.
echo === GIT COMMIT ===
git commit -m "fix: resolve server.js syntax error (remove stray closing brace at line 699)"
echo.
echo === GIT PUSH ===
git push origin main
echo.
echo === DONE ===
pause
