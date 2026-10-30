@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo [Staging] 廣東道平安福音堂 - 開發測試副本 一鍵部署工具
echo 目標 Script ID : 17NB2HOnZ0LoIm-nn38KzmakjmULLrwm86KmJsFCkmN9gUmPTuy6e3nOz
echo 目標 Deploy ID : AKfycbzd2noWSnN27y31P30F7J2OUVNye1HSsM21qfI8i7uRR-0_9_KzJ3i827sB5RxcX0sl
echo ============================================================
echo.

set "DEPLOY_DESC=%~1"
if "%DEPLOY_DESC%"=="" (
    set /p DEPLOY_DESC="請輸入本次測試版更新說明 (直接按 Enter 則使用預設說明): "
)
if "%DEPLOY_DESC%"=="" (
    set "DEPLOY_DESC=Staging update (%date% %time:~0,5%)"
)

echo.
echo [1/4] 正在同步更新 update code 備份檔...
if exist "update code" (
    copy /y "Code.js" "update code\gscode.txt" >nul
    copy /y "Index.html" "update code\church-ppt-console.txt" >nul
)

echo [2/4] 正在推送程式碼至【開發測試副本 GAS】...
call npx @google/clasp -P "%~dp0.clasp.json" push -f
if errorlevel 1 (
    echo [錯誤] clasp push 失敗！請檢查網路或登入狀態。
    pause
    exit /b 1
)

echo.
echo [3/4] 正在更新【開發測試副本】部署版本...
call npx @google/clasp -P "%~dp0.clasp.json" deploy -i AKfycbzd2noWSnN27y31P30F7J2OUVNye1HSsM21qfI8i7uRR-0_9_KzJ3i827sB5RxcX0sl -d "%DEPLOY_DESC%"
if errorlevel 1 (
    echo [錯誤] clasp deploy 失敗！
    pause
    exit /b 1
)

echo.
echo [4/4] 正在同步提交並推送至開發版 GitHub (origin)...
git add .
git diff --cached --quiet || git commit -m "chore(staging): %DEPLOY_DESC%"
git push origin main

echo.
echo ============================================================
echo [完成] 開發測試副本已部署完成！
echo 測試網址：
echo https://script.google.com/a/macros/johnnyworks.biz/s/AKfycbzd2noWSnN27y31P30F7J2OUVNye1HSsM21qfI8i7uRR-0_9_KzJ3i827sB5RxcX0sl/exec?pass=admin
echo ============================================================
if "%~1"=="" pause
