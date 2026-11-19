# 廣東道平安福音堂 — 詩歌檢索與雙螢幕投影系統

Google Apps Script（GAS）網頁應用，資料來源為《詩歌資料庫》Google 試算表（`15pOhnHrf0DB-C2OgHuVFD4XfanXsNrJuUHniyuBDFPI`）。功能、環境資料與操作指引詳見 `README.md`。

## 必須遵守的開發與部署規範

@.agents/rules/dev-workflow.md

## 重點提醒

- **部署**：開發測試版用 `.\deploy-staging.bat "更新說明"`；正式版 `.\deploy-prod.bat --yes "更新說明"` **只可在使用者明確確認測試通過並授權後執行**。
- **修改 `Code.js` 或 `Index.html` 時**，必須同步更新 `Code.js` 頂部的 `DEV_VERSION_NOTE`（版本號、日期時間與修改摘要）。
- **只有改程式碼才需要部署**；新增詩歌、修改歌詞或 PPT 連結只改試算表／Drive，重新整理網頁即可生效。
- **`.claspignore` 只推送** `appsscript.json`、`Code.js`、`driveSync.js`、`Index.html`；切勿排除 `driveSync.js`（否則會刪除遠端 GAS 的同名檔案）。
- **部署正式版前**：先把正式版 `clasp pull` 到暫存資料夾（將 `.clasp.prod.json` 複製為該資料夾的 `.clasp.json`，避免覆蓋本機檔案），比對 `Code.js`、`Index.html`、`driveSync.js`、`appsscript.json` **全部檔案**是否有 GitHub 未記錄的改動；有的話先停下問使用者（2026/11/19 曾發現樂手模式只存在於正式版）。
- **Drive 同步觸發器**：`syncDriveFilesToSheet` 每小時觸發器只設於正式版 GAS；開發版與正式版共用同一份試算表，開發版不可設觸發器。
- **`.bat` 腳本**需維持 Windows 可執行（UTF-8、`chcp 65001`）。
- 使用者以廣東話／繁體中文溝通，請以繁體中文回覆。
