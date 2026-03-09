/**
 * 老人院交更系統 - Google Apps Script
 * 部署為「網頁應用程式」時必須用試算表 ID 開啟，不能用 getActiveSpreadsheet()
 */

// 試算表 ID（從網址 docs.google.com/spreadsheets/d/這裡/edit 取得）
var SPREADSHEET_ID = '1fitlEsEr9YuwMx2fog1o2qYDE4k19NrIHWlfCS27wbE';
var SHEET_NAME = '交更'; // 工作表名稱，沒有則用第一個

function getSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) return null;
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  return sheet;
}

/**
 * 在試算表最上方（第 7 列）插入一列「今日交更」空白列，可由按鈕或選單呼叫
 */
function addHandover() {
  var sheet = getSheet();
  if (!sheet) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 2) return;
  var insertRow = 7;
  sheet.insertRowBefore(insertRow);
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd/M/yyyy');
  sheet.getRange(insertRow, 1).setValue(today);
  for (var col = 2; col <= lastCol; col++) {
    sheet.getRange(insertRow, col).setValue('');
  }
}

function doGet(e) {
  var result = { residents: {}, handovers: { rows: [] } };
  try {
    var sheet = getSheet();
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        error: '找不到試算表，請檢查 SPREADSHEET_ID 與 SHEET_NAME',
        residents: {},
        handovers: { rows: [] }
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    if (lastCol < 2 || lastRow < 6) {
      return output(result);
    }
    var headerRange = sheet.getRange(1, 1, 5, lastCol);
    var headerValues = headerRange.getValues();
    for (var c = 1; c < headerValues[0].length; c++) {
      var key = 'resident_' + c;
      result.residents[key] = {
        room: (headerValues[0][c] != null ? headerValues[0][c] : '').toString().trim(),
        name: (headerValues[1][c] != null ? headerValues[1][c] : '').toString().trim(),
        floor: (headerValues[2][c] != null ? headerValues[2][c] : '').toString().trim(),
        socialWorker: (headerValues[3][c] != null ? headerValues[3][c] : '').toString().trim(),
        status: (headerValues[4][c] != null ? headerValues[4][c] : '').toString().trim()
      };
    }
    var dataRows = sheet.getRange(6, 1, lastRow, lastCol).getValues();
    var rows = [];
    for (var r = 0; r < dataRows.length; r++) {
      var dateVal = dataRows[r][0];
      var dateStr = dateVal instanceof Date ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'd/M/yyyy') : (dateVal != null ? dateVal.toString().trim() : '');
      if (!dateStr) continue;
      var records = {};
      for (var col = 1; col < dataRows[r].length; col++) {
        var residentKey = 'resident_' + col;
        if (result.residents[residentKey]) {
          var cellVal = dataRows[r][col];
          records[residentKey] = (cellVal != null ? cellVal.toString() : '').trim();
        }
      }
      rows.push({ date: dateStr, records: records });
    }
    rows.reverse();
    result.handovers.rows = rows;
    return output(result);
  } catch (err) {
    return output({ error: err.toString(), residents: {}, handovers: { rows: [] } });
  }
}

function doPost(e) {
  var result = { success: false, message: '' };
  try {
    var body = e && e.postData ? e.postData.contents : null;
    if (!body) {
      result.message = '缺少 POST body';
      return output(result);
    }
    var data = JSON.parse(body);
    var dateStr = (data.date != null ? data.date : '').toString().trim();
    var records = data.records || {};
    if (!dateStr) {
      result.message = '缺少 date';
      return output(result);
    }
    var sheet = getSheet();
    if (!sheet) {
      result.message = '找不到試算表，請檢查 SPREADSHEET_ID';
      return output(result);
    }
    var lastCol = sheet.getLastColumn();
    if (lastCol < 2) {
      result.message = '請先在 Sheet 設定好院友欄位（B,C,D...）';
      return output(result);
    }
    var insertRow = 7;
    sheet.insertRowBefore(insertRow);
    sheet.getRange(insertRow, 1).setValue(dateStr);
    for (var col = 2; col <= lastCol; col++) {
      var residentKey = 'resident_' + (col - 1);
      var val = records[residentKey];
      sheet.getRange(insertRow, col).setValue((val != null ? val : '').toString());
    }
    result.success = true;
    result.message = '已儲存';
    return output(result);
  } catch (err) {
    result.message = err.toString();
    return output(result);
  }
}

function output(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
