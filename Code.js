function doGet(e) {
  // 預設強制為 false，只有當網址明確傳入 ?pass=admin 時才開啟同工權限
  let isAdmin = false;
  if (e && e.parameter && e.parameter.pass === 'admin') {
    isAdmin = true;
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.isAdmin = isAdmin;

  return template.evaluate()
    .setTitle(isAdmin ? '教會詩歌檢索系統 (同工控制台)' : '教會詩歌檢索 (會眾歌詞版)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSongsData(isAdmin) {
  try {
    const ss = SpreadsheetApp.openById('15pOhnHrf0DB-C2OgHuVFD4XfanXsNrJuUHniyuBDFPI'); 
    const sheet = ss.getSheetByName('詩歌資料庫');
    
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; 
    
    data.shift(); // 移除第 1 列標題
    
    return data.map((row, index) => {
      let category = String(row[0] || '').trim();
      let number = String(row[1] || '').trim();
      let title = String(row[2] || '').trim();
      let charCountVal = row[3];
      let lyrics = String(row[4] || '').trim();
      let pptUrl = isAdmin ? String(row[5] || '').trim() : '';
      let pdfUrl = isAdmin ? String(row[6] || '').trim() : '';
      let pdfNote = isAdmin ? String(row[7] || '').trim() : '';

      // 自動補回誤切欄位
      if (/^\d{1,2}$/.test(title) && number.length >= 3) {
        number = number + title;
        title = String(row[3] || '').trim();
        charCountVal = row[4];
        lyrics = String(row[5] || '').trim();
        pptUrl = isAdmin ? String(row[6] || '').trim() : '';
        pdfUrl = isAdmin ? String(row[7] || '').trim() : '';
        pdfNote = isAdmin ? String(row[8] || '').trim() : '';
      }

      if (number.toUpperCase().startsWith('A')) {
        number = number.substring(1);
      }

      let computedCharCount = (charCountVal !== '' && !isNaN(charCountVal)) ? Number(charCountVal) : title.length;

      return {
        id: index + 1,
        category: category,
        number: number,
        title: title,
        charCount: computedCharCount,
        lyrics: lyrics,
        pptUrl: pptUrl,
        pdfUrl: pdfUrl,
        pdfNote: pdfNote
      };
    });
  } catch (err) {
    Logger.log("讀取失敗: " + err.toString());
    throw new Error("無法讀取 Google Sheet！");
  }
}