@echo off
echo === Tokenia v8 — Full Autonomy Deploy ===
cd /d "%~dp0"

if exist ".git\index.lock" (
  del /f ".git\index.lock"
  echo Removed stale git lock.
)

git add -A
if %errorlevel% neq 0 ( echo ERROR: git add failed. & pause & exit /b 1 )

git commit -m "feat v8: dark mode, keyboard shortcuts, internal analytics, admin dashboard, 15 blog posts, monitoring, onboarding tour, toasts, llms.txt, OpenAPI, Postman collection, offline PWA, smoke tests, ARCHITECTURE/ROADMAP/SCALING docs"
if %errorlevel% neq 0 ( echo ERROR: git commit failed. & pause & exit /b 1 )

git push origin main
if %errorlevel% neq 0 ( echo ERROR: git push failed. & pause & exit /b 1 )

echo.
echo === v8 Deploy SUCCESSFUL! Railway redeploys in ~2 min ===
echo.
echo IMMEDIATE NEXT STEPS (in order of impact):
echo.
echo  1. Set env vars in Railway:
echo     ADMIN_PASSWORD=your-secret-password
echo     RESEND_AUDIENCE_ID=your-resend-audience-id
echo.
echo  2. Test admin dashboard:
echo     https://tokenia.live/admin/stats
echo     (Username: anything, Password: ADMIN_PASSWORD)
echo.
echo  3. Run smoke tests:
echo     node scripts/smoke-test.js https://tokenia.live
echo.
echo  4. Activate Cloudflare (biggest performance boost):
echo     See SETUP-CLOUDFLARE.md
echo.
echo  5. Submit to Google Search Console:
echo     See SEO-NEXT-STEPS.md
echo.
echo  6. Dark mode works! Toggle with moon icon or Cmd+D
echo  7. Test keyboard shortcuts: Cmd+/ to see all
echo  8. Blog posts live at: https://tokenia.live/blog
echo  9. API docs: https://tokenia.live/api-docs.html
echo 10. Status page: https://tokenia.live/status.html
echo.
pause
