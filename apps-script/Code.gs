/**
 * Christmas List 2026 – connects the web page to the "Full list" tab.
 * Paste this into Extensions → Apps Script in the Christmas List 2026 sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 */
const SHEET_NAME = 'Full list';
const PEOPLE = ['Tim', 'Sue', 'Lucy', 'James', 'Albie'];
const COL = { person: 1, gift: 2, details: 3, link: 4, bought: 5 };

function doGet() {
  return json_(listItems_());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const sh = sheet_();
    switch (req.action) {
      case 'bought':
        checkRow_(sh, req.row, req.gift);
        sh.getRange(req.row, COL.bought).setValue(req.bought ? 'Yes' : '');
        break;
      case 'edit':
        checkRow_(sh, req.row, req.original);
        sh.getRange(req.row, COL.gift, 1, 3).setValues([[
          clean_(req.gift, 140), clean_(req.details, 500), cleanLink_(req.link)
        ]]);
        break;
      case 'remove':
        checkRow_(sh, req.row, req.gift);
        sh.getRange(req.row, COL.gift, 1, 4).clearContent();
        break;
      case 'restore':
        addItem_(sh, req);
        break;
      case 'add':
        addItem_(sh, req);
        break;
      default:
        throw new Error('Unknown action');
    }
    SpreadsheetApp.flush();
    return json_(listItems_());
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function sheet_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Could not find the "' + SHEET_NAME + '" tab');
  return sh;
}

function listItems_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  const items = [];
  if (last >= 2) {
    const values = sh.getRange(2, 1, last - 1, 5).getDisplayValues();
    values.forEach(function (v, i) {
      const gift = String(v[1]).trim();
      if (!gift) return;
      items.push({
        row: i + 2,
        person: String(v[0]).trim(),
        gift: gift,
        details: String(v[2]).trim(),
        link: String(v[3]).trim(),
        bought: String(v[4]).trim().toLowerCase() === 'yes'
      });
    });
  }
  return { items: items, people: PEOPLE, updated: new Date().toISOString() };
}

function checkRow_(sh, row, gift) {
  row = Number(row);
  if (!row || row < 2 || row > sh.getLastRow()) throw new Error('changed');
  const current = String(sh.getRange(row, COL.gift).getDisplayValue()).trim();
  if (current !== String(gift || '').trim()) throw new Error('changed');
}

function addItem_(sh, req) {
  const person = PEOPLE.indexOf(req.person) >= 0 ? req.person : null;
  if (!person) throw new Error('Unknown person');
  const gift = clean_(req.gift, 140);
  if (!gift) throw new Error('Gift name is missing');
  const rowValues = [person, gift, clean_(req.details, 500), cleanLink_(req.link), req.bought ? 'Yes' : ''];

  const last = Math.max(sh.getLastRow(), 1);
  const data = last >= 2 ? sh.getRange(2, 1, last - 1, 2).getDisplayValues() : [];
  let lastOfPerson = -1;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() !== person) continue;
    lastOfPerson = i + 2;
    if (!String(data[i][1]).trim()) {
      sh.getRange(i + 2, 1, 1, 5).setValues([rowValues]);
      return;
    }
  }
  if (lastOfPerson > 0) {
    sh.insertRowAfter(lastOfPerson);
    sh.getRange(lastOfPerson + 1, 1, 1, 5).setValues([rowValues]);
  } else {
    sh.appendRow(rowValues);
  }
}

// Stops typed text from being read as a formula.
function clean_(s, max) {
  s = String(s == null ? '' : s).trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function cleanLink_(s) {
  s = String(s == null ? '' : s).trim().slice(0, 800);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
