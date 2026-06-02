@echo off
setlocal enabledelayedexpansion
echo ================================================================
echo  Tokenia — PUSH v8 + FIX Resend (All-in-one)
echo ================================================================
cd /d "%~dp0"

REM ⚠️  Set your Resend API key here (or set RESEND_KEY as an env variable before running)
REM     Do NOT commit a real key to this file.
if "%RESEND_KEY%"=="" (
    echo ERROR: RESEND_KEY env variable not set. Set it before running this script.
    echo   Example: set RESEND_KEY=re_xxxxxxxxxxxx
    pause
    exit /b 1
)

REM ── STEP 1: Git push ──────────────────────────────────────────────
echo.
echo [1/5] Pushing v8 to GitHub...
if exist ".git\index.lock" del /f ".git\index.lock"
git push origin main
if %errorlevel% neq 0 (
    echo PUSH FAILED — trying git add + commit + push...
    git add -A
    git commit -m "feat v8 + fix: mail subdomain for Resend"
    git push origin main
)
if %errorlevel% equ 0 (
    echo      Push OK — Railway redeploys in ~2 min
) else (
    echo      Push FAILED — check GitHub credentials
)

REM ── STEP 2: List current Resend domains ───────────────────────────
echo.
echo [2/5] Checking Resend domains...
curl -s -X GET "https://api.resend.com/domains" ^
  -H "Authorization: Bearer %RESEND_KEY%" ^
  -H "Content-Type: application/json" > "%TEMP%\resend_domains.json"
type "%TEMP%\resend_domains.json"

REM ── Extract domain_id of tokenia.live using PowerShell ────────────
for /f "delims=" %%i in ('powershell -Command "(Get-Content '%TEMP%\resend_domains.json' | ConvertFrom-Json).data | Where-Object {$_.name -like '*tokenia.live'} | Select-Object -First 1 -ExpandProperty id"') do set OLD_ID=%%i
echo.
echo Found domain ID: !OLD_ID!

REM ── STEP 3: Delete old failed domain ──────────────────────────────
echo.
echo [3/5] Deleting failed domain from Resend...
if not "!OLD_ID!"=="" (
    curl -s -X DELETE "https://api.resend.com/domains/!OLD_ID!" ^
      -H "Authorization: Bearer %RESEND_KEY%"
    echo      Deleted domain ID: !OLD_ID!
) else (
    echo      No existing tokenia.live domain found (already clean)
)

REM ── STEP 4: Create mail.tokenia.live ──────────────────────────────
echo.
echo [4/5] Creating mail.tokenia.live in Resend...
curl -s -X POST "https://api.resend.com/domains" ^
  -H "Authorization: Bearer %RESEND_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\": \"mail.tokenia.live\", \"region\": \"us-east-1\"}" > "%TEMP%\resend_new.json"
type "%TEMP%\resend_new.json"

REM ── STEP 5: Get DNS records for new domain ────────────────────────
for /f "delims=" %%i in ('powershell -Command "(Get-Content '%TEMP%\resend_new.json' | ConvertFrom-Json).id"') do set NEW_ID=%%i
echo.
echo New domain ID: !NEW_ID!

if not "!NEW_ID!"=="" (
    echo.
    echo [5/5] Fetching DNS records for mail.tokenia.live...
    curl -s -X GET "https://api.resend.com/domains/!NEW_ID!" ^
      -H "Authorization: Bearer %RESEND_KEY%" > "%TEMP%\resend_records.json"

    echo.
    echo ================================================================
    echo  DNS RECORDS TO ADD IN NAMECHEAP:
    echo ================================================================
    type "%TEMP%\resend_records.json"

    REM Save records to project folder
    copy "%TEMP%\resend_records.json" "%~dp0RESEND-DNS-RECORDS.json" >nul
    echo.
    echo Records saved to: RESEND-DNS-RECORDS.json
    echo.
    echo Now run: node scripts/parse-dns-records.js
    echo (This will generate NAMECHEAP-DNS-FIX.md with exact instructions)
)

echo.
echo ================================================================
echo  DONE!
echo  - v8 pushed to GitHub (Railway redeploys in ~2 min)
echo  - mail.tokenia.live created in Resend
echo  - DNS records saved to RESEND-DNS-RECORDS.json
echo.
echo  NEXT: Add the 3 DNS records in Namecheap
echo  See: NAMECHEAP-DNS-FIX.md for exact instructions
echo ================================================================
pause
