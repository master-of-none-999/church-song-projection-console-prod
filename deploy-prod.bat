@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo [Production] 廣東道平安福音堂 - 原版正式環境 一鍵部署工具
echo 目標 Script ID : 1qQ1cKb1oxJBr2ZAINjH6Zq1fNEa8_yICcHfruh5qDsj77vVnzo-3Z5uI
echo 目標 Deploy ID : AKfycbzLpxvB0i03jwmzpfpcvI26EtUo3OkFVA0WSMK9ars3Z-DKKbaUVlzm2VkEciJL-5cg
echo ============================================================
echo.

if /i not "%~1"=="--yes" (
    set /p CONFIRM="請確認已在【開發測試副本】測試無誤，確定要推送至【原版正式環境】嗎？(Y/N): "
    if /i not "%CONFIRM%"=="Y" (
        echo 已取消部署。
        pause
        exit /b 0
    )
)

set "DEPLOY_DESC=%~2"
if "%~1" neq "--yes" set "DEPLOY_DESC=%~1"
if "%DEPLOY_DESC%"=="" (
    set /p DEPLOY_DESC="請輸入本次正式版更新說明 (直接按 Enter 則使用預設說明): "
)
if "%DEPLOY_DESC%"=="" (
    set "DEPLOY_DESC=Production release (%date% %time:~0,5%)"
)

echo.
echo [1/4] 正在同步更新 update code 交接備份檔...
if exist "update code" (
    copy /y "Code.js" "update code\gscode.txt" >nul
    copy /y "Index.html" "update code\church-ppt-console.txt" >nul
)

echo [2/4] 正在推送程式碼至【原版正式環境 GAS】...
call npx @google/clasp -P "%~dp0.clasp.prod.json" push -f
if errorlevel 1 (
    echo [錯誤] clasp push 失敗！請檢查網路或原版專案共用權限。
    pause
    exit /b 1
)

echo.
echo [3/4] 正在更新【原版正式環境】部署版本...
call npx @google/clasp -P "%~dp0.clasp.prod.json" deploy -i AKfycbzLpxvB0i03jwmzpfpcvI26EtUo3OkFVA0WSMK9ars3Z-DKKbaUVlzm2VkEciJL-5cg -d "%DEPLOY_DESC%"
if errorlevel 1 (
    echo [錯誤] clasp deploy 失敗！
    pause
    exit /b 1
)

echo.
echo [4/4] 正在同步提交並推送至雙 GitHub 儲存庫 (origin 與 prod)...
git add .
git diff --cached --quiet || git commit -m "release(prod): %DEPLOY_DESC%"
git push origin main
git push prod main

echo.
echo ============================================================
echo [完成] 原版正式環境已部署完成！
echo 正式網址：
echo https://script.google.com/macros/s/AKfycbzLpxvB0i03jwmzpfpcvI26EtUo3OkFVA0WSMK9ars3Z-DKKbaUVlzm2VkEciJL-5cg/exec?pass=admin
echo ============================================================
if "%~1"=="" pause
