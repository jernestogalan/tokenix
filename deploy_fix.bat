@echo off
cd /d "C:\Users\jerne\OneDrive\Documents\Claude\Projects\Tokens\tokenix"
echo === Git status ===
git status
echo.
echo === Staging all redesign files ===
git add public/css/style.css
git add public/index.html
git add public/pricing.html
git add public/privacy.html
git add public/js/i18n-client.js
git add src/i18n/en.json
git add src/i18n/es.json
git add src/i18n/zh.json
git add src/i18n/de.json
git add src/lib/i18n.js
git add server.js
echo.
echo === Committing ===
git commit -m "design: light theme + orange accent + i18n (EN/ES/ZH/DE) + FAQ chatbot"
echo.
echo === Pushing to origin ===
git push
echo.
echo === Done --- Railway will auto-deploy in ~1 min ===
pause
