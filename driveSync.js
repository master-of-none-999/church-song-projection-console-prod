const SPREADSHEET_ID = '15pOhnHrf0DB-C2OgHuVFD4XfanXsNrJuUHniyuBDFPI';
const SHEET_NAME = '詩歌資料庫';

const PPT_FOLDER_ID = '請在此貼上_PPT_資料夾ID'; 
const PDF_FOLDER_ID = '請在此貼上_PDF_資料夾ID'; 

function syncDriveFilesToSheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const pptMap = getFolderFilesMap(PPT_FOLDER_ID);
    const pdfMap = getFolderFilesMap(PDF_FOLDER_ID);

    for (let i = 1; i < data.length; i++) {
      let songNumber = String(data[i][1] || '').trim();
      let songTitle = String(data[i][2] || '').trim();

      if (!songNumber && !songTitle) continue;

      if (songNumber.toUpperCase().startsWith('A')) {
        songNumber = songNumber.substring(1);
      }

      let matchedPptUrl = findMatchedUrl(pptMap, songNumber, songTitle);
      let matchedPdfUrl = findMatchedUrl(pdfMap, songNumber, songTitle);

      if (matchedPptUrl) sheet.getRange(i + 1, 6).setValue(matchedPptUrl);
      if (matchedPdfUrl) sheet.getRange(i + 1, 7).setValue(matchedPdfUrl);
    }
    Logger.log("✅ Drive 連結同步成功！");
  } catch (err) {
    Logger.log("❌ 同步失敗: " + err.toString());
  }
}

function getFolderFilesMap(folderId) {
  const fileMap = new Map();
  if (!folderId || folderId.includes('請在此貼上')) return fileMap;

  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      fileMap.set(file.getName(), file.getUrl());
    }
  } catch (e) {
    Logger.log("讀取資料夾失敗: " + e.toString());
  }
  return fileMap;
}

function findMatchedUrl(fileMap, songNumber, songTitle) {
  if (songTitle && songTitle.length >= 2) {
    for (let [fileName, url] of fileMap.entries()) {
      if (fileName.includes(songTitle)) return url;
    }
  }
  if (songNumber && songNumber.length >= 3) {
    for (let [fileName, url] of fileMap.entries()) {
      if (fileName.includes(songNumber)) return url;
    }
  }
  return '';
}