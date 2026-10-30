# 廣東道平安福音堂 - 詩歌快速檢索系統 (Church Song Search & Dual-Screen Projection Console)

基於 Google Apps Script (GAS) 與 Google Sheets 建立的教會詩歌快速檢索與雙螢幕投影控制系統。支援「🎬 影音 (PPT)」、「🎵 樂手 (歌譜 PDF)」與「📖 會眾歌詞」三種角色視角，並針對雙螢幕投影（Firefox / Chrome / Edge）實作全螢幕不跳出與一鍵黑屏待機機制。

---

## ✨ 核心功能

- **多維度即時檢索**：支援歌名、編號、歌詞內文、詩集分類（平安詩集、敬拜頌歌、松柏詩選、其他歌曲）與歌名字數篩選。
- **跨螢幕簡報投影容器 (`ChurchProjectorPopup_v3`)**：
  - 採用同源外殼容器（Projector Shell）搭配內部無縫 `iframe` 切換，解決瀏覽器換歌跳頁時自動退出全螢幕的問題。
  - **Firefox**：支援直接於副螢幕自動定位開啟。
  - **Chrome / Edge**：內建焦點保護與 `F11` 攔截機制，無論點擊左下角「`⛶ 全螢幕`」、按鍵盤 `F11` 或雙擊畫面，換歌皆可 100% 維持無邊框全螢幕。
- **🔢 主副螢幕雙向自動頁碼遙控導覽列 (方案 C)**：
  - 後端自動透過 `DriveApp` 解析原始 `.ppt` / `.pptx` 二進位結構，精準偵測每首簡報的**真實總頁數**、**各頁歌詞摘要**與**內建節數跳頁目標（如第 1、2、3 節對應頁碼）**。
  - 同時在**主螢幕控制台底部**與**副螢幕投影幕右下角**動態生成 `[◀] [1] [2] [3]... [►]` 遙控按鈕，完美取代並覆蓋舊版 PowerPoint 轉檔至網頁後失效的 `http://slide.xml` 頁碼連結，並透過 `iframe sandbox` 徹底阻擋誤觸彈出錯誤視窗。
- **📌 今日崇拜歌單釘選區與一鍵分享（WhatsApp 文字歌單／專屬連結）**：支援於聚會前預先釘選最多 10 首當日崇拜詩歌（自動記憶於瀏覽器 `localStorage` 並同步至網址列 `?setlist=...`），支援調整先後順序、一鍵複製適合貼到 WhatsApp／崇拜群組的「文字版歌單清單（含曲目順序、編號、歌名與歌單連結）」或單獨複製專屬歌單連結，並支援標示「投影中」狀態及直接點擊切換 PPT 或查看歌譜。
- **📺 投影黑屏待機（雙向切換）**：講道或報告時可一鍵將副螢幕切換為純黑待機畫面（保留背後簡報與頁碼），再按一下即可瞬間恢復畫面。
- **❓ 內建操作說明彈窗**：控制台右上角提供影音同工操作指引與注意事項。

---

## 📋 影音同工投影操作指引

### 🎬 一、聚會前準備（每堂聚會只需做 1 次）
1. **開啟投影視窗**：在主螢幕點擊第 1 首詩歌的 **「開啟 PPT 簡報 (副螢幕)」**（首次使用若被攔截，請於網址列右方選擇「永遠允許彈出式視窗」）。
2. **移至副螢幕並全螢幕**：
   - **Firefox（推薦）**：視窗會自動在副螢幕開啟，點左下角 **「`⛶ 全螢幕`」** 或按 **`F11`** 即可。
   - **Chrome / Edge**：將彈出視窗拖拉至副螢幕，點左下角 **「`⛶ 全螢幕`」**、按 **`F11`** 或**雙擊畫面中央**進入無邊框全螢幕。

### 🎵 二、聚會中切換詩歌、跳頁遙控與黑屏待機
1. **換下一首詩歌**：**聚會期間請勿按 `✕` 關閉副螢幕視窗！** 直接在主螢幕點擊下一首詩歌按鈕，副螢幕就會保持在全螢幕狀態下直接切換簡報。
2. **快速跳頁／翻頁遙控（自動偵測頁數）**：
   - 開啟詩歌後，**主螢幕底部**與**副螢幕右下角**皆會自動產生對應頁數的 `1`、`2`、`3`... 跳頁按鈕（取代原本簡報內失效的頁碼連結）。
   - 將滑鼠移至頁碼按鈕上方，可**預覽該頁歌詞摘要**；點擊任一處頁碼或 `◀ 上頁` / `下頁 ►` 即可直接跳頁且不跳出全螢幕。
   - 主螢幕底部的常駐遙控列可隨時點右側 **`✕ 關閉`** 手動收起；當副螢幕視窗關閉時亦會**自動收起**。
3. **暫停投影（講道／報告時）**：點擊主螢幕右上角 **「📺 投影黑屏待機」** 即可變全黑畫面；再按一下 **「👁️ 解除黑屏 (恢復畫面)」**（或點選下一首詩歌）即可瞬間恢復投影。

### ⚠️ 三、使用注意事項（系統限制）
- **請勿中途關閉投影視窗**：受瀏覽器安全限制，若按 `✕` 關閉了副螢幕視窗，下次再開啟時視窗會重回主螢幕。請善用「📺 投影黑屏待機」代替關閉視窗。
- **簡報翻頁方式**：除了點擊主螢幕底部或副螢幕右下角的頁碼導覽按鈕外，在副螢幕簡報點一下後，亦可用鍵盤方向鍵（`←` / `→` 或空白鍵）逐頁翻頁。

---

## 🛠️ 雙環境開發、測試與正式部署規範 (`clasp`)

> ⚠️ **部署原則（先測試、後正式）**：
> 每次修改功能時，`.clasp.json` 預設保持綁定**「1. 開發測試副本」**。必須先推送到開發副本並完成測試驗證、確認無誤後，才可切換至**「2. 原版正式環境」**推送更新（同時同步更新 `update code/` 內的交接備份檔）。

### 🧪 1. 開發測試副本（Staging / Dev — 預設綁定環境）
- **管理帳號**：`0711jlau@gmail.com`
- **GitHub Repo (`origin`)**：`https://github.com/master-of-none-999/church-song-projection-console`
- **Script ID**：`17NB2HOnZ0LoIm-nn38KzmakjmULLrwm86KmJsFCkmN9gUmPTuy6e3nOz`
- **Deployment ID**：`AKfycbzd2noWSnN27y31P30F7J2OUVNye1HSsM21qfI8i7uRR-0_9_KzJ3i827sB5RxcX0sl`
- **同工版測試網址**：`https://script.google.com/a/macros/johnnyworks.biz/s/AKfycbzd2noWSnN27y31P30F7J2OUVNye1HSsM21qfI8i7uRR-0_9_KzJ3i827sB5RxcX0sl/exec?pass=admin`
- **GAS 編輯器網址**：`https://script.google.com/home/projects/17NB2HOnZ0LoIm-nn38KzmakjmULLrwm86KmJsFCkmN9gUmPTuy6e3nOz/edit`

```bash
# 步驟 A：確認 .clasp.json 為開發測試副本 Script ID 後推送並更新測試部署，並推送至開發版 GitHub (origin)
npx @google/clasp push -f
npx @google/clasp deploy -i AKfycbzd2noWSnN27y31P30F7J2OUVNye1HSsM21qfI8i7uRR-0_9_KzJ3i827sB5RxcX0sl -d "測試更新說明"
git push origin main
```

---

### 🚀 2. 原版正式環境（Production — 測試確認後才推送）
- **原版帳號**：`worshiphymm@gmail.com`（需將 `0711jlau@gmail.com` 設為專案編輯者方可透過 `clasp` 直接推送）
- **GitHub Repo (`prod`)**：`https://github.com/master-of-none-999/church-song-projection-console-prod`
- **Script ID**：`1qQ1cKb1oxJBr2ZAINjH6Zq1fNEa8_yICcHfruh5qDsj77vVnzo-3Z5uI`
- **Deployment ID**：`AKfycbzLpxvB0i03jwmzpfpcvI26EtUo3OkFVA0WSMK9ars3Z-DKKbaUVlzm2VkEciJL-5cg`
- **同工版正式網址**：`https://script.google.com/macros/s/AKfycbzLpxvB0i03jwmzpfpcvI26EtUo3OkFVA0WSMK9ars3Z-DKKbaUVlzm2VkEciJL-5cg/exec?pass=admin`
- **GAS 編輯器網址**：`https://script.google.com/u/0/home/projects/1qQ1cKb1oxJBr2ZAINjH6Zq1fNEa8_yICcHfruh5qDsj77vVnzo-3Z5uI/edit`

```bash
# 步驟 B：當開發測試副本確認無誤、使用者明確授權更新原版時，使用 -P .clasp.prod.json 指定原版設定檔推送與部署，並同步推送至原版專屬 GitHub Repo (prod)：
# （注意：切勿在 .claspignore 排除 driveSync.js，否則 GAS API 會將遠端的 driveSync.gs 刪除；若原版同工有修改 driveSync.js，推送前請先 pull 同步）
npx @google/clasp -P .clasp.prod.json push -f
npx @google/clasp -P .clasp.prod.json deploy -i AKfycbzLpxvB0i03jwmzpfpcvI26EtUo3OkFVA0WSMK9ars3Z-DKKbaUVlzm2VkEciJL-5cg -d "正式版更新說明"
git push prod main
```

#### ⚠️ 跨帳號首次執行 `clasp deploy` 的授權注意事項（`REVIEW PERMISSIONS`）
- 由於 `appsscript.json` 設定為 `"executeAs": "USER_DEPLOYING"`（以部署者身分執行），當透過終端機的開發帳號（`0711jlau@gmail.com`）對原版專案（擁有者為 `worshiphymm@gmail.com`）執行 `clasp deploy` 時，GAS 會將該部署的執行身分切換為 `0711jlau@gmail.com`。
- **首次跨帳號部署後（或新增權限範圍時）**，在完成 OAuth 授權前，其他瀏覽器（如預設登入企業網域 `jlau0711@johnnyworks.biz` 的視窗）開啟標準 `/exec` 網址時，會被 Google 自動重導向至 `/a/macros/johnnyworks.biz/...` 並顯示「您需要存取權」。
- **解除方法（二選一，僅需做 1 次）**：
  1. **直接完成初次授權**：在登入 `0711jlau@gmail.com` 的瀏覽器開啟原版標準 `/exec` 網址，點擊藍色 **`REVIEW PERMISSIONS`** 按鈕 ➔ 選擇 `0711jlau@gmail.com` ➔ 點左下角 **`Advanced`（進階）** ➔ 點 **`Go to 廣平詩歌檢索控制台 (unsafe)`** ➔ 點 **`Allow`（允許）**。授權完成後，所有帳號與匿名使用者皆可立即正常開啟，且日後再執行 `clasp deploy` 不會再跳出。
  2. **或維持原擁有者身分部署**：在終端機僅執行 `npx @google/clasp -P .clasp.prod.json push -f` 推送程式碼，接著由 `worshiphymm@gmail.com` 登入原版 GAS 網頁編輯器，點選「**部署 ➔ 管理部署作業 ➔ ✏️ 編輯 ➔ 新版本 ➔ 部署**」。
