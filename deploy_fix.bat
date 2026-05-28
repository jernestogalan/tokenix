@echo off
cd /d "C:\Users\jerne\OneDrive\Documents\Claude\Projects\Tokens\tokenix"
echo === Git status ===
git status
echo.
echo === Staging redesigned files ===
git add public/css/style.css
git add public/index.html
echo.
echo === Committing ===
git commit -m "design: premium rebrand for monetization readiness"
echo.
echo === Pushing to origin ===
git push
echo.
echo === Done — Railway will auto-deploy in ~1 min ===
pause
