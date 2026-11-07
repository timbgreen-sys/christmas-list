/**
 * Mini Greens, Aged Greens and Elliott Aunties Xmas lists.
 * Connects the web pages to this Google Sheet. Each family list has its own tab;
 * the Aged Greens and Elliott Aunties tabs are created automatically the first time they're used.
 *
 * Paste this into Extensions → Apps Script in the Christmas List 2026 sheet, save,
 * then Deploy → Manage deployments → pencil icon → Version: New version → Deploy.
 */
const LISTS = {
  mini:    { sheet: 'Full list',       people: ['Tim', 'Sue', 'Lucy', 'James', 'Albie'] },
  aged:    { sheet: 'Aged Greens',     people: ['Nanny Liz', 'Grandpa Brian'] },
  elliott: { sheet: 'Elliott Aunties', people: ['Auntie Ruth', 'Auntie Pat'] }
};
const COL = { person: 1, gift: 2, details: 3, link: 4, bought: 5 };
const BLANK_ROWS_EACH = 15;

function doGet(e) {
  try {
    const key = listKey_(e && e.parameter && e.parameter.list);
    return json_(listItems_(key));
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const key = listKey_(req.list);
    const cfg = LISTS[key];
    const sh = sheet_(key, true);
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
      case 'add':
        addItem_(sh, cfg, req);
        break;
      default:
        throw new Error('Unknown action');
    }
    SpreadsheetApp.flush();
    return json_(listItems_(key, true));
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function listKey_(k) {
  return LISTS[k] ? k : 'mini';
}

// Finds a list's tab, creating and laying it out the first time.
function sheet_(key, alreadyLocked) {
  const cfg = LISTS[key];
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(cfg.sheet);
  if (sh) return sh;
  const lock = alreadyLocked ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(15000);
  try {
    sh = ss.getSheetByName(cfg.sheet);
    if (sh) return sh;
    sh = ss.insertSheet(cfg.sheet);
    sh.getRange(1, 1, 1, 5).setValues([['Person', 'Gift', 'Details (size, colour, price)', 'Link', 'Bought?']])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1b2a23');
    const rows = [];
    cfg.people.forEach(function (p) { for (let i = 0; i < BLANK_ROWS_EACH; i++) rows.push([p, '', '', '', '']); });
    sh.getRange(2, 1, rows.length, 5).setValues(rows);
    sh.getRange(2, 1, rows.length, 1).setFontWeight('bold');
    sh.getRange(1, 1, rows.length + 1, 5).setFontFamily('Arial');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 120); sh.setColumnWidth(2, 320); sh.setColumnWidth(3, 240); sh.setColumnWidth(4, 280); sh.setColumnWidth(5, 80);
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Yes'], true).setAllowInvalid(false).build();
    sh.getRange(2, COL.bought, rows.length + 200, 1).setDataValidation(rule);
    return sh;
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (ignore) {} }
  }
}

function listItems_(key, alreadyLocked) {
  const sh = sheet_(key, alreadyLocked);
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
  return { list: key, items: items, people: LISTS[key].people, updated: new Date().toISOString() };
}

function checkRow_(sh, row, gift) {
  row = Number(row);
  if (!row || row < 2 || row > sh.getLastRow()) throw new Error('changed');
  const current = String(sh.getRange(row, COL.gift).getDisplayValue()).trim();
  if (current !== String(gift || '').trim()) throw new Error('changed');
}

function addItem_(sh, cfg, req) {
  const person = cfg.people.indexOf(req.person) >= 0 ? req.person : null;
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
