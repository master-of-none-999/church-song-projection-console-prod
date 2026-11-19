/**
 * 自動將 Google Drive 內的 PPT／PDF 檔案連結填入《詩歌資料庫》試算表
 *
 * 執行方式：
 *   - previewDriveSync()       ：只預覽（不寫入任何資料），結果見「執行項目」紀錄
 *   - syncDriveFilesToSheet()  ：正式同步；可在正式版 GAS 設定「時間驅動」觸發器每小時執行
 *
 * 配對規則：
 *   1. 依副檔名分類：PPT 欄只收 .ppt/.pps/.pptx/.ppsx 與 Google 簡報；PDF 欄只收 .pdf
 *   2. 先以「檔名開頭的編號」配對（不分大小寫），例如 001p.pps、2007o是你.pptx、012p 感謝神.ppt
 *   3. 編號配不到才以歌名配對（完全相同 → 去掉開頭數字後相同 → 無編號開頭的檔名包含歌名）；同一級配中多個檔名則不填
 *   4. 同一檔名有多個檔案（例如 001p.pps 與 001p.pptx）時，選用最近修改的一個
 *   5. 只填入空白格；已有連結但與配對結果不同時，不覆蓋，改列於「待確認更新」分頁供同工人手處理
 */

const SPREADSHEET_ID = '15pOhnHrf0DB-C2OgHuVFD4XfanXsNrJuUHniyuBDFPI';
const SHEET_NAME = '詩歌資料庫';
const REVIEW_SHEET_NAME = '待確認更新';

const PPT_FOLDER_ID = '1wMKDy3vTBw0p_d62XYqXTzwNYrvJTMg6'; // 我的雲端硬碟 › 歌曲簡報
const PDF_FOLDER_ID = '1L5PhOfjf_3372NwojSCTr4lvhonc9SO2'; // 我的雲端硬碟 › 歌譜

const PPT_EXTENSIONS_ = ['ppt', 'pps', 'pptx', 'ppsx'];
const PDF_EXTENSIONS_ = ['pdf'];
const REVIEW_HEADERS_ = ['已處理／忽略', '編號', '歌名', '欄位', '跳到詩歌資料庫', '現有檔案', '現有檔案修改日期', '建議新檔案', '新檔案修改日期', '現有連結', '建議新連結', '偵測時間'];

function syncDriveFilesToSheet() {
  return runDriveSync_(false);
}

function previewDriveSync() {
  return runDriveSync_(true);
}

function runDriveSync_(dryRun) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('⚠️ 另一個同步正在執行中，本次略過。');
    return;
  }
  try {
    Logger.log((dryRun ? '【預覽模式：不會寫入任何資料】' : '【正式同步】') + ' 開始讀取試算表...');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log('❌ 找不到名為「' + SHEET_NAME + '」的工作表！');
      return;
    }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('⚠️ 試算表中沒有詩歌資料列。');
      return;
    }

    const rows = parseSongRows_(data);
    const pptFiles = listFolderFiles_(PPT_FOLDER_ID, PPT_EXTENSIONS_, true);
    const pdfFiles = listFolderFiles_(PDF_FOLDER_ID, PDF_EXTENSIONS_, false);
    Logger.log('📂 簡報檔案 ' + pptFiles.length + ' 個；歌譜檔案 ' + pdfFiles.length + ' 個。');

    const songNumbers = new Set(rows.map(r => r.numberKey).filter(Boolean));
    const result = planDriveSync_(rows, [
      { field: 'PPT', colKey: 'pptCol', files: pptFiles },
      { field: 'PDF', colKey: 'pdfCol', files: pdfFiles }
    ], songNumbers);

    result.notes.forEach(n => Logger.log('ℹ️ ' + n));
    describeCurrentFiles_(result.conflicts, pptFiles.concat(pdfFiles));

    if (!dryRun) {
      result.fills.forEach(f => sheet.getRange(f.rowIndex + 1, f.col + 1).setValue(f.url));
      writeReviewSheet_(ss, result.conflicts, sheet.getSheetId());
    }

    Logger.log('✅ ' + (dryRun ? '預覽' : '同步') + '完成：' +
      (dryRun ? '將填入 ' : '已填入 ') + result.fills.length + ' 個空白連結；' +
      '待確認更新 ' + result.conflicts.length + ' 項；' +
      '空白格找不到檔案 ' + result.unmatchedCount + ' 格（PPT ' + (result.unmatched.PPT || 0) + '、PDF ' + (result.unmatched.PDF || 0) + '，未列出）。');
    result.fills.forEach(f => Logger.log('  ➕ 第 ' + (f.rowIndex + 1) + ' 列 ' + f.number + ' ' + f.field + '：' + f.fileName));
    result.conflicts.forEach(c => Logger.log('  ❓ 第 ' + (c.rowIndex + 1) + ' 列 ' + c.number + ' ' + c.field + '：現有 ' + c.currentName + ' → 建議改為 ' + c.fileName));
  } catch (err) {
    Logger.log('❌ 同步失敗：' + err.toString());
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** 解析試算表每一列；與 Code.js getSongsData 一樣處理「誤切欄位」的列 */
function parseSongRows_(data) {
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let number = String(row[1] || '').trim();
    let title = String(row[2] || '').trim();
    let pptCol = 5;
    let pdfCol = 6;
    if (/^\d{1,2}$/.test(title) && number.length >= 3) {
      number = number + title;
      title = String(row[3] || '').trim();
      pptCol = 6;
      pdfCol = 7;
    }
    if (!number && !title) continue;
    if (number.toUpperCase().startsWith('A')) number = number.substring(1);
    rows.push({
      rowIndex: i,
      number: number,
      numberKey: number.toLowerCase(),
      title: title,
      pptCol: pptCol,
      pdfCol: pdfCol,
      pptCol_value: String(row[pptCol] || '').trim(),
      pdfCol_value: String(row[pdfCol] || '').trim()
    });
  }
  return rows;
}

/** 遞迴列出資料夾（含子資料夾）內符合副檔名的檔案 */
function listFolderFiles_(folderId, extensions, allowGoogleSlides) {
  const out = [];
  if (!folderId) return out;
  try {
    collectFiles_(DriveApp.getFolderById(folderId), extensions, allowGoogleSlides, out);
  } catch (e) {
    Logger.log('⚠️ 讀取資料夾失敗 (' + folderId + ')：' + e.toString());
  }
  return out;
}

function collectFiles_(folder, extensions, allowGoogleSlides, out) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.substring(dot + 1).toLowerCase() : '';
    const isSlides = allowGoogleSlides && file.getMimeType() === MimeType.GOOGLE_SLIDES;
    if (!isSlides && extensions.indexOf(ext) === -1) continue;
    out.push({
      file: file,
      id: file.getId(),
      name: name,
      stem: (isSlides || dot <= 0 ? name : name.substring(0, dot)).trim(),
      isPresentation: isSlides || PPT_EXTENSIONS_.indexOf(ext) !== -1,
      updated: null
    });
  }
  const sub = folder.getFolders();
  while (sub.hasNext()) collectFiles_(sub.next(), extensions, allowGoogleSlides, out);
}

/** 純計算：決定要填入哪些空白格、哪些需同工確認（不呼叫任何寫入 API） */
function planDriveSync_(rows, groups, songNumbers) {
  const fills = [];
  const conflicts = [];
  const notes = [];
  const unmatched = {};

  groups.forEach(group => {
    // 依檔名開頭的編號分組：「001p」「2007o是你」「012p 感謝神」都歸入對應編號
    const byNumber = new Map();
    const stemInfo = new Map(); // stemKey -> { files, token, cleaned, cleanedRest }
    group.files.forEach(f => {
      const key = f.stem.toLowerCase();
      if (!stemInfo.has(key)) {
        const token = leadingNumberToken_(key);
        stemInfo.set(key, {
          files: [], token: token,
          cleaned: cleanMatchText_(key),
          cleanedRest: cleanMatchText_(token ? key.substring(token.length) : key)
        });
      }
      const info = stemInfo.get(key);
      info.files.push(f);
      if (info.token) {
        if (!byNumber.has(info.token)) byNumber.set(info.token, []);
        byNumber.get(info.token).push(f);
      }
    });

    rows.forEach(row => {
      const col = row[group.colKey];
      const current = row[group.colKey + '_value'];
      const label = row.number || row.title;

      let candidates = row.numberKey ? (byNumber.get(row.numberKey) || []) : [];
      let matchedBy = '編號';

      if (candidates.length === 0) {
        const cleanedTitle = cleanMatchText_(row.title);
        if (cleanedTitle.length >= 2) {
          // 歌名配對分三級：檔名完全等於歌名 → 去掉開頭數字後等於歌名 → 檔名（無編號開頭）包含歌名；取第一個有結果的一級
          const tiers = [[], [], []];
          stemInfo.forEach((info, stemKey) => {
            if (info.token && songNumbers.has(info.token)) return; // 檔名屬於另一首歌的編號
            if (info.cleaned === cleanedTitle) tiers[0].push(stemKey);
            else if (info.cleanedRest === cleanedTitle) tiers[1].push(stemKey);
            else if (!info.token && info.cleaned.indexOf(cleanedTitle) !== -1) tiers[2].push(stemKey); // 有編號開頭的檔名不作「包含」配對
          });
          const stems = tiers.find(t => t.length > 0) || [];
          if (stems.length > 1) {
            if (!current) {
              notes.push(label + ' ' + group.field + '：歌名「' + row.title + '」同時配中 ' + stems.length + ' 個檔名（' + stems.slice(0, 5).join('、') + '），未填入。');
            }
            return;
          }
          if (stems.length === 1) {
            candidates = stemInfo.get(stems[0]).files;
            matchedBy = '歌名';
          }
        }
      }

      if (candidates.length === 0) {
        if (!current) unmatched[group.field] = (unmatched[group.field] || 0) + 1;
        return;
      }

      if (current) {
        // 歌名配對只用於填空白格：已有人手設定的連結比歌名推測可靠，不列入待確認
        if (matchedBy === '歌名') return;
        // 現有連結已指向其中一個配對檔案（例如同名重複檔案的另一份），視為正確
        const currentId = extractDriveId_(current);
        if (candidates.some(f => f.id === currentId)) return;
      }

      const chosen = pickLatest_(candidates);
      if (candidates.length > 1) {
        notes.push(label + ' ' + group.field + '：有 ' + candidates.length + ' 個檔案（' + candidates.map(f => f.name).join('、') + '），已選用最近修改的 ' + chosen.name + '。');
      }

      const url = buildFileUrl_(chosen);
      const entry = {
        rowIndex: row.rowIndex, col: col, number: label, title: row.title,
        field: group.field, current: current, url: url, fileId: chosen.id,
        fileName: chosen.name, file: chosen.file, updated: chosen.updated, matchedBy: matchedBy
      };

      if (!current) fills.push(entry);
      else conflicts.push(entry);
    });
  });

  const unmatchedCount = Object.keys(unmatched).reduce((s, k) => s + unmatched[k], 0);
  return { fills: fills, conflicts: conflicts, notes: notes, unmatched: unmatched, unmatchedCount: unmatchedCount };
}

function pickLatest_(files) {
  if (files.length === 1) return files[0];
  files.forEach(f => {
    if (!f.updated && f.file) f.updated = f.file.getLastUpdated();
  });
  return files.slice().sort((a, b) => (b.updated ? b.updated.getTime() : 0) - (a.updated ? a.updated.getTime() : 0))[0];
}

/** 簡報一律使用與現有試算表相同的 docs.google.com/presentation 格式，投影端可用簡報預覽與跳頁 */
function buildFileUrl_(f) {
  if (f.isPresentation) {
    return 'https://docs.google.com/presentation/d/' + f.id + '/edit?usp=drivesdk&rtpof=true&sd=true';
  }
  return f.file ? f.file.getUrl() : 'https://drive.google.com/file/d/' + f.id + '/view?usp=drivesdk';
}

/** 取得檔名開頭的編號，例如「2007o是你」→ 2007o、「012p 感謝神」→ 012p；編號後必須接非英數字元或結尾 */
function leadingNumberToken_(stemKey) {
  const m = String(stemKey).match(/^([0-9]+[a-z]*)(?=$|[^0-9a-z])/);
  return m ? m[1] : '';
}

function cleanMatchText_(str) {
  return String(str || '').toLowerCase().replace(/[,\s，。！!？?#\-]/g, '');
}

/**
 * 為待確認項目補上「現有連結」所指檔案的名稱與修改日期，方便同工對比，不用逐個打開連結。
 * 先查已列出的資料夾檔案，找不到才逐個向 Drive 讀取（只限待確認項目，數量少）。
 */
function describeCurrentFiles_(conflicts, knownFiles) {
  const byId = new Map();
  knownFiles.forEach(f => byId.set(f.id, f));
  conflicts.forEach(c => {
    if (!c.updated && c.file) c.updated = c.file.getLastUpdated();
    const id = extractDriveId_(c.current);
    c.currentName = '（不是 Drive 檔案連結）';
    c.currentUpdated = '';
    if (!id) return;
    try {
      const known = byId.get(id);
      const file = known ? known.file : DriveApp.getFileById(id);
      c.currentName = known ? known.name : file.getName();
      c.currentUpdated = file ? file.getLastUpdated() : '';
      if (!known) c.currentName += '（不在歌曲簡報／歌譜資料夾內）';
    } catch (e) {
      c.currentName = '（無法讀取：檔案可能已刪除或無權限）';
    }
  });
}

/**
 * 重建「待確認更新」分頁：每次同步按最新狀況重列（已解決的項目自動消失）。
 * 同工剔選「已處理／忽略」的項目會被記住，下次同步仍保留剔選，方便決定保留舊連結。
 */
function writeReviewSheet_(ss, conflicts, mainSheetId) {
  let review = ss.getSheetByName(REVIEW_SHEET_NAME);
  const ignored = new Set();
  if (review && review.getLastRow() > 1 && review.getLastColumn() > 0) {
    // 依標題名稱找欄位，即使日後欄位次序改變，已剔選的項目仍會被記住
    const all = review.getRange(1, 1, review.getLastRow(), review.getLastColumn()).getValues();
    const h = all[0].map(String);
    const iDone = h.indexOf('已處理／忽略'), iNum = h.indexOf('編號'), iField = h.indexOf('欄位'), iNew = h.indexOf('建議新連結');
    if (iDone >= 0 && iNum >= 0 && iField >= 0 && iNew >= 0) {
      all.slice(1).forEach(r => {
        if (r[iDone] === true) ignored.add(reviewKey_(r[iNum], r[iField], extractDriveId_(r[iNew])));
      });
    }
  }
  if (!review) {
    if (conflicts.length === 0) return;
    review = ss.insertSheet(REVIEW_SHEET_NAME);
  }

  const now = new Date();
  const rows = conflicts.map(c => {
    const done = ignored.has(reviewKey_(c.number, c.field, c.fileId));
    const rowNo = c.rowIndex + 1;
    return [
      done, c.number, c.title, c.field,
      '=HYPERLINK("#gid=' + mainSheetId + '&range=A' + rowNo + '","第 ' + rowNo + ' 列")',
      c.current ? hyperlinkFormula_(c.current, c.currentName) : c.currentName,
      c.currentUpdated || '',
      hyperlinkFormula_(c.url, c.fileName),
      c.updated || '',
      c.current, c.url, now
    ];
  });
  rows.sort((a, b) => (a[0] === b[0] ? 0 : (a[0] ? 1 : -1)));

  review.clear();
  if (review.getMaxRows() > 1) review.getRange(2, 1, review.getMaxRows() - 1, 1).removeCheckboxes();
  review.getRange(1, 1, 1, REVIEW_HEADERS_.length).setValues([REVIEW_HEADERS_]).setFontWeight('bold');
  review.setFrozenRows(1);
  if (rows.length > 0) {
    review.getRange(2, 1, rows.length, REVIEW_HEADERS_.length).setValues(rows);
    review.getRange(2, 1, rows.length, 1).insertCheckboxes();
    review.getRange(2, 7, rows.length, 1).setNumberFormat('yyyy/mm/dd hh:mm');
    review.getRange(2, 9, rows.length, 1).setNumberFormat('yyyy/mm/dd hh:mm');
    review.getRange(2, 12, rows.length, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  }
  review.getRange(rows.length + 3, 1).setValue(
    '說明：以上詩歌在《詩歌資料庫》已有連結，但 Drive 有一個檔名等於編號的檔案與現有連結不同。' +
    '撳「現有檔案」與「建議新檔案」可直接打開兩個檔案對比；撳「跳到詩歌資料庫」可去到對應列。' +
    '如要改用新檔案，請將「建議新連結」複製到該列；如要保留舊連結，請剔選「已處理／忽略」。改好連結後，下次同步此項會自動消失。');
}

function hyperlinkFormula_(url, text) {
  const q = s => String(s || '').replace(/"/g, '""');
  return '=HYPERLINK("' + q(url) + '","' + q(text) + '")';
}

function reviewKey_(number, field, fileId) {
  return String(number).toLowerCase() + '|' + field + '|' + fileId;
}
