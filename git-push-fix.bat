@echo off
echo ========================================
echo  Tokenia — Git Push Fix
echo ========================================
echo.

cd /d "C:\Users\jerne\OneDrive\Documents\Claude\Projects\Tokens\tokenix"

echo [1/5] Eliminando index.lock si existe...
if exist ".git\index.lock" (
    del /f ".git\index.lock"
    echo      index.lock eliminado OK
) else (
    echo      No habia index.lock
)

echo.
echo [2/5] Git status...
git status --short
echo.

echo [3/5] Git add de archivos modificados...
git add public/auth/signup.html server.js public/pricing.html public/pricing/pro.html public/pricing/team.html public/privacy.html public/js/i18n-client.js src/i18n/en.json src/i18n/es.json src/i18n/de.json src/i18n/zh.json src/lib/email.js
echo      git add OK

echo.
echo [4/5] Git commit...
git commit -m "fix: change all emails to info@tokenia.live, add debug logging for auth errors"

echo.
echo [5/5] Git push...
git push origin main

echo.
echo ========================================
echo  Ultimos 3 commits:
git log --oneline -3
echo ========================================
echo.
echo Listo! Presiona cualquier tecla para cerrar.
pause
