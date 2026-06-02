@echo off
cd /d "%~dp0"
echo ================================================================
echo  Tokenia — Commit + Push Fase A + B1
echo ================================================================

REM Remove stale git lock if present
if exist ".git\index.lock" del /f ".git\index.lock"

REM Stage all changes
git add -A

REM Commit
git commit -m "feat: fase A (honest security copy + headers) + B1 (SEO/embed/launch-kit)" -m "- Helmet hardened: HSTS 1yr+preload, Permissions-Policy, HTTP->HTTPS redirect" -m "- Privacy/security copy corrected: removed false browser-side claims" -m "- False social proof removed (invented counts, fake ratings, unsupported badges)" -m "- Hardcoded Resend API key removed from server.js and bat files" -m "- privacy.html rewritten with accurate data flow description" -m "- security.html updated to match real architecture" -m "- sitemap.xml: clean URLs, all pages, updated dates" -m "- robots.txt: added /admin/ and /dashboard to Disallow" -m "- Clean URL routes for all pages (no .html extension)" -m "- i18n: removed trusted-by claims and Pro plan pricing from chatbot" -m "- launch-kit: Product Hunt, Show HN, Reddit, dev.to, social posts (drafts)"

if %errorlevel% neq 0 (
    echo.
    echo COMMIT FAILED. See error above.
    pause
    exit /b 1
)

REM Show commit hash
echo.
echo Commit hash:
git rev-parse HEAD

REM Push
echo.
echo Pushing to GitHub...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ================================================================
    echo  SUCCESS! Railway will redeploy in ~2 minutes.
    echo  Test: https://tokenia.live/api/health
    echo ================================================================
) else (
    echo.
    echo PUSH FAILED. Check your GitHub credentials.
    echo Run manually: git push origin main
)
pause
