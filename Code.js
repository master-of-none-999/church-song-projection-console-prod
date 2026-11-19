// 開發測試版識別開關（於開發測試副本為 true；部署至原版正式環境時由 deploy-prod.bat 自動切換為 false）
const IS_DEV_ENV = true;
const DEV_VERSION_NOTE = 'v2.2.2 (2026/11/19 — 簡報白名單快取縮短至 2 分鐘，新增詩歌找不到時即時重讀試算表，頁數偵測立即生效)';

function doGet(e) {
  // 預設強制為 false，只有當網址明確傳入 ?pass=admin 或 ?mode=admin 時才開啟同工權限
  let isAdmin = false;
  if (e && e.parameter && (e.parameter.pass === 'admin' || e.parameter.mode === 'admin')) {
    isAdmin = true;
  }

  // 支援頂層獨立網頁 (GitHub Pages) 透過 JSON API 讀取詩歌與簡報頁數資料
  if (e && e.parameter && e.parameter.action === 'getSongs') {
    const songs = getSongsData(isAdmin);
    return ContentService.createTextOutput(JSON.stringify({
      isAdmin: isAdmin,
      isDevEnv: IS_DEV_ENV,
      devVersionNote: DEV_VERSION_NOTE,
      songs: songs
    })).setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'getSlideInfo') {
    const pptUrl = String(e.parameter.pptUrl || '');
    const lyrics = String(e.parameter.lyrics || '');
    const info = getPresentationSlideInfo(pptUrl, lyrics);
    return ContentService.createTextOutput(JSON.stringify(info))
      .setMimeType(ContentService.MimeType.JSON);
  }

  let initialSetlist = '';
  if (e && e.parameter && e.parameter.setlist) {
    initialSetlist = String(e.parameter.setlist).replace(/[^0-9a-zA-Z,_-]/g, '');
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.isAdmin = isAdmin;
  template.initialSetlist = initialSetlist;
  template.isDevEnv = IS_DEV_ENV;
  template.devVersionNote = DEV_VERSION_NOTE;

  const baseTitle = isAdmin ? '教會詩歌檢索系統 (同工控制台)' : '教會詩歌檢索 (會眾歌詞版)';
  return template.evaluate()
    .setTitle(IS_DEV_ENV ? ('[開發版] ' + baseTitle) : baseTitle)
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
function extractDriveId_(url) {
  if (!url) return '';
  const m = String(url).match(/\/(?:presentation|file)\/d\/([a-zA-Z0-9-_]+)/) ||
            String(url).match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return (m && m[1]) ? m[1] : '';
}

/**
 * 白名單：僅允許讀取《詩歌資料庫》試算表內登記過的簡報檔案 ID，
 * 防止匿名呼叫者以部署者權限讀取 Drive 中任意檔案內容。
 * （結果快取 2 分鐘；若在快取名單中找不到，isAllowedPptId_ 會即時重新讀取試算表，新增詩歌可立即生效）
 */
const ALLOWED_IDS_CACHE_KEY_ = 'allowedPptIds_v1';
const ALLOWED_IDS_CACHE_SECONDS_ = 120;
const ALLOWED_IDS_REFRESH_LOCK_KEY_ = 'allowedPptIds_refreshLock_v1';
const ALLOWED_IDS_REFRESH_MIN_SECONDS_ = 15;

function getAllowedPptIds_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = ALLOWED_IDS_CACHE_KEY_;
  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) return new Set(cached.split(','));
  }

  const ids = new Set();
  const sheet = SpreadsheetApp.openById('15pOhnHrf0DB-C2OgHuVFD4XfanXsNrJuUHniyuBDFPI')
    .getSheetByName('詩歌資料庫');
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let r = 1; r < data.length; r++) {
      // F 欄（index 5）；誤切欄位時 PPT 連結位於 G 欄（index 6）
      for (let c = 5; c <= 6 && c < data[r].length; c++) {
        const id = extractDriveId_(data[r][c]);
        if (id) ids.add(id);
      }
    }
  }
  const joined = Array.from(ids).join(',');
  if (joined.length < 90000) cache.put(CACHE_KEY, joined, ALLOWED_IDS_CACHE_SECONDS_);
  return ids;
}

/**
 * 檢查簡報 ID 是否登記於試算表。快取名單找不到時（例如同工剛新增詩歌），即時重新讀取一次試算表。
 * 為避免匿名呼叫者以不存在的 ID 反覆觸發讀取試算表，強制重讀最多每 15 秒一次。
 */
function isAllowedPptId_(docId) {
  if (!docId) return false;
  if (getAllowedPptIds_(false).has(docId)) return true;

  const cache = CacheService.getScriptCache();
  if (cache.get(ALLOWED_IDS_REFRESH_LOCK_KEY_)) return false;
  cache.put(ALLOWED_IDS_REFRESH_LOCK_KEY_, '1', ALLOWED_IDS_REFRESH_MIN_SECONDS_);
  return getAllowedPptIds_(true).has(docId);
}

function getPresentationSlideInfo(pptUrl, fallbackLyrics) {
  let docId = extractDriveId_(pptUrl);
  if (docId) {
    try {
      if (!isAllowedPptId_(docId)) docId = '';
    } catch (err) {
      Logger.log('白名單讀取失敗: ' + err.toString());
      docId = '';
    }
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