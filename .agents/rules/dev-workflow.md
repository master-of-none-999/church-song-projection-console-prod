# 廣東道平安福音堂 — 詩歌檢索系統 專屬開發與部署規範

1. **先測試、後正式原則**：
   - 任何程式碼修改，預設僅推送並部署至「開發測試副本」（`.clasp.json`：`17NB2HOnZ0LoIm-nn38KzmakjmULLrwm86KmJsFCkmN9gUmPTuy6e3nOz`）與開發版 GitHub (`origin`)。
   - 嚴禁在未獲使用者明確確認測試通過前，擅自推送或部署至「原版正式環境」（`.clasp.prod.json`：`1qQ1cKb1oxJBr2ZAINjH6Zq1fNEa8_yICcHfruh5qDsj77vVnzo-3Z5uI`）。

2. **強制自動更新 `DEV_VERSION_NOTE`（日期 + 修改摘要）**：
   - 每次修改 `Code.js` 或 `Index.html` 並部署至開發測試副本時，**必須自動將 `Code.js` 第 3 行的 `DEV_VERSION_NOTE` 更新為當下最新日期時間與本次修改內容摘要**（例如：`const DEV_VERSION_NOTE = 'v1.9 (2026/10/30 11:50 — 某某功能修改摘要)';`）。
   - 確保使用者重新整理開發測試版網頁時，能直接從頂部橘色色帶與標題旁 `🧪 開發測試版` 徽章確認最新修改已生效。
