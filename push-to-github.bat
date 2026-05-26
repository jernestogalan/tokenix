@echo off
echo ============================================
echo  Tokenix — Subiendo codigo a GitHub
echo ============================================
cd /d "%~dp0"
echo.
echo [1/6] Inicializando git...
git init
echo.
echo [2/6] Configurando rama main...
git branch -M main 2>nul || git checkout -b main 2>nul
echo.
echo [3/6] Agregando todos los archivos...
git add .
echo.
echo [4/6] Creando primer commit...
git commit -m "feat: initial production release - Tokenix v1.0.0"
echo.
echo [5/6] Conectando con GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/jernestogalan/tokenia.git
echo.
echo [6/6] Subiendo codigo...
git push -u origin main
echo.
echo ============================================
echo  Listo! Revisa https://github.com/jernestogalan/tokenia
echo ============================================
pause
