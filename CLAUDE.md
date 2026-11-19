# 廣東道平安福音堂 — 詩歌檢索與雙螢幕投影系統

Google Apps Script（GAS）網頁應用，資料來源為《詩歌資料庫》Google 試算表（`15pOhnHrf0DB-C2OgHuVFD4XfanXsNrJuUHniyuBDFPI`）。功能、環境資料與操作指引詳見 `README.md`。

## 必須遵守的開發與部署規範

@.agents/rules/dev-workflow.md

## 重點提醒

- **部署**：開發測試版用 `.\deploy-staging.bat "更新說明"`；正式版 `.\deploy-prod.bat --yes "更新說明"` **只可在使用者明確確認測試通過並授權後執行**。
- **修改 `Code.js` 或 `Index.html` 時**，必須同步更新 `Code.js` 頂部的 `DEV_VERSION_NOTE`（版本號、日期時間與修改摘要）。
- **只有改程式碼才需要部署**；新增詩歌、修改歌詞或 PPT 連結只改試算表／Drive，重新整理網頁即可生效。
- **`.claspignore` 只推送** `appsscript.json`、`Code.js`、`driveSync.js`、`Index.html`；切勿排除 `driveSync.js`（否則會刪除遠端 GAS 的同名檔案）。若正式版同工曾修改 `driveSync.js`，部署正式版前先 `clasp pull` 比對。
- **`.bat` 腳本**需維持 Windows 可執行（UTF-8、`chcp 65001`）。
- 使用者以廣東話／繁體中文溝通，請以繁體中文回覆。
