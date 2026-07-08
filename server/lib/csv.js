/** Minimal CSV reader — parses the generated datasets into arrays of objects. */
const fs = require('fs');
const path = require('path');

function parseCSV(text) {
  const rows = [];
  let cur = [''], inQ = false, row = cur;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { row[row.length - 1] += '"'; i++; }
        else inQ = false;
      } else row[row.length - 1] += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') row.push('');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [''];
      rows.length && (cur = row);
    } else row[row.length - 1] += ch;
  }
  if (row.length > 1 || row[0] !== '') rows.push(row);
  const headers = rows.shift();
  return rows.map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      const v = r[i] ?? '';
      o[h] = v !== '' && !isNaN(v) && !/^0\d/.test(v) ? +v : v;
    });
    return o;
  });
}

function loadTable(dataDir, name) {
  const file = path.join(dataDir, `${name}.csv`);
  return parseCSV(fs.readFileSync(file, 'utf8'));
}

module.exports = { parseCSV, loadTable };
