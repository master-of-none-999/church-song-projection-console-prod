const SPREADSHEET_ID = '15pOhnHrf0DB-C2OgHuVFD4XfanXsNrJuUHniyuBDFPI';
const SHEET_NAME = '詩歌資料庫';

const PPT_FOLDER_ID = '請在此貼上_PPT_資料夾ID'; 
const PDF_FOLDER_ID = '1L5PhOfjf_3372NwojSCTr4lvhonc9SO2'; 

function syncDriveFilesToSheet() {
  try {
    Logger.log("1. 開始連線 Google Sheet...");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      Logger.log("❌ 錯誤：找不到名為「" + SHEET_NAME + "」的工作表！請檢查試算表最下方分頁名稱是否完全一致。");
      return;
    }

    const data = sheet.getDataRange().getValues();
    Logger.log("2. 成功讀取試算表，共找到 " + data.length + " 列資料。");

    if (data.length <= 1) {
      Logger.log("⚠️ 試算表中沒有詩歌資料列可更新。");
      return;
    }

    Logger.log("3. 開始讀取 Google Drive 資料夾...");
    const pptMap = getFolderFilesMap(PPT_FOLDER_ID);
    const pdfMap = getFolderFilesMap(PDF_FOLDER_ID);

    Logger.log(`📂 PDF 資料夾中共找到 ${pdfMap.size} 個檔案`);

    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      let songNumber = String(data[i][1] || '').trim();
      let songTitle = String(data[i][2] || '').trim();

      if (!songNumber && !songTitle) continue;

      if (songNumber.toUpperCase().startsWith('A')) {
        songNumber = songNumber.substring(1);
      }

      let matchedPptUrl = findMatchedUrl(pptMap, songNumber, songTitle);
      let matchedPdfUrl = findMatchedUrl(pdfMap, songNumber, songTitle);

      // F 欄 (第 6 欄): PPT 連結 | G 欄 (第 7 欄): PDF 連結
      if (matchedPptUrl && matchedPptUrl !== data[i][5]) {
        sheet.getRange(i + 1, 6).setValue(matchedPptUrl);
        updatedCount++;
      }
      if (matchedPdfUrl && matchedPdfUrl !== data[i][6]) {
        sheet.getRange(i + 1, 7).setValue(matchedPdfUrl);
        updatedCount++;
      }
    }
    Logger.log(`✅ 同步完成！本次共填入/更新 ${updatedCount} 筆資料。`);
  } catch (err) {
    Logger.log("❌ 同步失敗，錯誤訊息: " + err.toString());
  }
}

// 讀取資料夾（支援搜尋子資料夾）
function getFolderFilesMap(folderId) {
  const fileMap = new Map();
  if (!folderId || folderId.includes('請在此貼上')) return fileMap;

  try {
    const folder = DriveApp.getFolderById(folderId);
    collectFilesFromFolder(folder, fileMap);
  } catch (e) {
    Logger.log("⚠️ 讀取資料夾失敗 (" + folderId + "): " + e.toString());
  }
  return fileMap;
}

function collectFilesFromFolder(folder, fileMap) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    fileMap.set(file.getName(), file.getUrl());
  }
  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    collectFilesFromFolder(subFolder, fileMap);
  }
}

// 移除標點符號與空格，進行比對
function cleanText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[,\s，。！!？?#\-]/g, '');
}

function findMatchedUrl(fileMap, songNumber, songTitle) {
  const cleanedTitle = cleanText(songTitle);
  const cleanedNumber = cleanText(songNumber);

  if (cleanedTitle.length >= 2) {
    for (let [fileName, url] of fileMap.entries()) {
      const cleanedFileName = cleanText(fileName);
      if (cleanedFileName.includes(cleanedTitle)) {
        return url;
      }
    }
  }

  if (cleanedNumber.length >= 2) {
    for (let [fileName, url] of fileMap.entries()) {
      const cleanedFileName = cleanText(fileName);
      if (cleanedFileName.includes(cleanedNumber)) {
        return url;
      }
    }
  }

  return '';
}
