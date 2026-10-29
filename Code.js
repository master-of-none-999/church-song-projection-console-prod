function doGet(e) {
  // 預設強制為 false，只有當網址明確傳入 ?pass=admin 或 ?mode=admin 時才開啟同工權限
  let isAdmin = false;
  if (e && e.parameter && (e.parameter.pass === 'admin' || e.parameter.mode === 'admin')) {
    isAdmin = true;
  }

  let initialSetlist = '';
  if (e && e.parameter && e.parameter.setlist) {
    initialSetlist = String(e.parameter.setlist).replace(/[^0-9a-zA-Z,_-]/g, '');
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.isAdmin = isAdmin;
  template.initialSetlist = initialSetlist;

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

/**
 * 自動解析簡報頁數、各頁歌詞摘要與原 PPT 節數跳頁目標
 * 僅使用專案已授權之 DriveApp 讀取檔案結構，不新增額外 OAuth Scope
 */
function getPresentationSlideInfo(pptUrl, fallbackLyrics) {
  let docId = '';
  if (pptUrl) {
    const m = String(pptUrl).match(/\/(?:presentation|file)\/d\/([a-zA-Z0-9-_]+)/) ||
              String(pptUrl).match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (m && m[1]) docId = m[1];
  }

  let totalPages = 0;
  let verseTargets = [];
  let slideSnippets = [];

  if (docId) {
    try {
      const file = DriveApp.getFileById(docId);
      const bytes = file.getBlob().getBytes();
      const len = bytes.length;

      const u8 = (idx) => bytes[idx] & 0xFF;
      const u16 = (idx) => (bytes[idx] & 0xFF) | ((bytes[idx + 1] & 0xFF) << 8);
      const u32 = (idx) => (
        (bytes[idx] & 0xFF) |
        ((bytes[idx + 1] & 0xFF) << 8) |
        ((bytes[idx + 2] & 0xFF) << 16) |
        ((bytes[idx + 3] & 0xFF) << 24)
      ) >>> 0;

      const decodeUtf16LE = (start, byteLen) => {
        let s = '';
        const end = Math.min(len, start + byteLen);
        for (let k = start; k + 1 < end; k += 2) {
          const ch = u16(k);
          if (ch !== 0) s += String.fromCharCode(ch);
        }
        return s;
      };

      const decodeAscii = (start, byteLen) => {
        let s = '';
        const end = Math.min(len, start + byteLen);
        for (let k = start; k < end; k++) {
          const ch = u8(k);
          if (ch >= 32 && ch <= 126) s += String.fromCharCode(ch);
        }
        return s;
      };

      // 1. 若為 .pptx (ZIP 格式 PK\x03\x04)
      if (len > 4 && u8(0) === 0x50 && u8(1) === 0x4B) {
        const asciiAll = decodeAscii(0, len);
        const matches = asciiAll.match(/ppt\/slides\/slide(\d+)\.xml/g) || [];
        let maxSlide = 0;
        matches.forEach(item => {
          const numMatch = item.match(/slide(\d+)\.xml/);
          if (numMatch) {
            const n = parseInt(numMatch[1], 10);
            if (n > maxSlide) maxSlide = n;
          }
        });
        if (maxSlide > 0) totalPages = maxSlide;
      }
      // 2. 若為原生 Google Slides 匯出之 PDF (%PDF)
      else if (len > 4 && u8(0) === 0x25 && u8(1) === 0x50 && u8(2) === 0x44 && u8(3) === 0x46) {
        const asciiAll = decodeAscii(0, len);
        const pageMatches = asciiAll.match(/\/Type\s*\/Page\b/g);
        if (pageMatches && pageMatches.length > 0) {
          totalPages = pageMatches.length;
        }
      }
      // 3. 傳統 .ppt 二進位格式 (MS-PPT OLE2)
      else if (len > 64) {
        let slwtCount = 0;
        for (let i = 0; i <= len - 8; i++) {
          // SlideListWithTextContainer (instance 0: 一般投影片清單)
          if (u8(i) === 0x0F && u8(i + 1) === 0x00 && u8(i + 2) === 0xF0 && u8(i + 3) === 0x0F) {
            const rLen = u32(i + 4);
            if (rLen > 0 && i + 8 + rLen <= len) {
              let cnt = 0;
              for (let j = i + 8; j <= i + 8 + rLen - 8; j++) {
                // SlidePersistAtom (recType = 0x03F3, len = 20)
                if (u8(j) === 0x00 && u8(j + 1) === 0x00 && u8(j + 2) === 0xF3 && u8(j + 3) === 0x03 && u32(j + 4) === 20) {
                  cnt++;
                }
              }
              if (cnt > 0) slwtCount = cnt;
            }
          }
          // ExHyperlinkContainer (recType = 0x0FD7): 解析原 PPT 右下角跳頁目標 (如 "投影片 1", "投影片 3")
          else if (u16(i + 2) === 0x0FD7) {
            const rLen = u32(i + 4);
            if (rLen > 0 && rLen < 2000 && i + 8 + rLen <= len) {
              for (let j = i + 8; j <= i + 8 + rLen - 8; j++) {
                const rt = u16(j + 2);
                const rl = u32(j + 4);
                if (rt === 0x0FBA && rl > 0 && rl < 500 && j + 8 + rl <= i + 8 + rLen) {
                  const str = decodeUtf16LE(j + 8, rl).trim();
                  const tm = str.match(/(?:投影片|Slide|slide)\s*(\d+)/i);
                  if (tm) {
                    const targetNum = parseInt(tm[1], 10);
                    if (targetNum > 0 && !verseTargets.includes(targetNum)) {
                      verseTargets.push(targetNum);
                    }
                  }
                  j += 7 + rl;
                }
              }
            }
          }
          // SlideContainer (recType = 0x03EE): 擷取每頁第一行歌詞摘要
          else if (u8(i) === 0x0F && u8(i + 1) === 0x00 && u8(i + 2) === 0xEE && u8(i + 3) === 0x03) {
            const rLen = u32(i + 4);
            if (rLen > 0 && i + 8 + rLen <= len) {
              let firstText = '';
              for (let j = i + 8; j <= i + 8 + rLen - 8; j++) {
                const rt = u16(j + 2);
                const rl = u32(j + 4);
                if (rt === 0x0FA0 && rl > 0 && rl < 2000 && j + 8 + rl <= i + 8 + rLen) {
                  const t = decodeUtf16LE(j + 8, rl).replace(/[\r\n]+/g, ' ').trim();
                  if (t.length > 2 && !firstText) {
                    firstText = t;
                  }
                  j += 7 + rl;
                }
              }
              slideSnippets.push(firstText);
            }
          }
        }

        if (slwtCount > 0) {
          totalPages = slwtCount;
          if (slideSnippets.length > slwtCount) {
            slideSnippets = slideSnippets.slice(-slwtCount);
          }
        } else if (slideSnippets.length > 0) {
          totalPages = slideSnippets.length;
        }
      }
    } catch (err) {
      Logger.log("解析 PPT 頁數失敗 (" + docId + "): " + err.toString());
    }
  }

  // 4. 若無法由二進位檔取得頁數，根據歌詞段落智慧推算頁數保底
  if (totalPages <= 0) {
    totalPages = estimatePagesFromLyrics(fallbackLyrics);
  }

  verseTargets = verseTargets.filter(n => n >= 1 && n <= totalPages);
  const hasMultiPageVerses = verseTargets.length > 0 && (
    verseTargets.length !== totalPages ||
    verseTargets.some((t, idx) => t !== idx + 1)
  );

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    const vIdx = verseTargets.indexOf(p);
    pages.push({
      page: p,
      pageNum: p,
      pageId: 'p' + p,
      verseLabel: (hasMultiPageVerses && vIdx !== -1) ? ('第' + (vIdx + 1) + '節') : '',
      snippet: slideSnippets[p - 1] || ''
    });
  }

  return {
    docId: docId,
    totalPages: totalPages,
    hasMultiPageVerses: hasMultiPageVerses,
    verseTargets: verseTargets,
    pages: pages
  };
}

function estimatePagesFromLyrics(lyrics) {
  if (!lyrics) return 4;
  const text = String(lyrics).trim();
  if (!text) return 4;
  const numberedMatches = text.match(/(?:^|\n|\s)\d+\.\s*/g);
  if (numberedMatches && numberedMatches.length >= 2) {
    return Math.min(12, numberedMatches.length);
  }
  const blocks = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (blocks.length >= 2) {
    return Math.min(12, blocks.length);
  }
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 0) {
    return Math.max(1, Math.min(12, Math.ceil(lines.length / 4)));
  }
  return 4;
}