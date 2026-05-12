#!/usr/bin/env node
// Fix sheets: 1) Create Task Tracker tab  2) Reset Report Tracker headers
// Run once: node fix-sheets.js

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SHEET_ID) {
  console.error('Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_SHEET_ID');
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function getSpreadsheetInfo(token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function batchUpdate(token, requests) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    }
  );
  return res.json();
}

async function writeRange(token, range, values) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, values })
    }
  );
  return res.json();
}

async function clearRange(token, range) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    }
  );
  return res.json();
}

async function main() {
  const token = await getAccessToken();

  // Step 1: Get current tabs
  const info = await getSpreadsheetInfo(token);
  const tabs = info.sheets.map(s => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId
  }));
  console.log('Current tabs:', tabs.map(t => t.title).join(', '));

  // Find Report Tracker tab (could be "Report Tracker" or "6. Report Tracker")
  const rtTab = tabs.find(t => t.title.includes('Report Tracker'));
  const taskTab = tabs.find(t => t.title.includes('Task Tracker'));

  // === FIX 1: Create Task Tracker tab ===
  if (taskTab) {
    console.log(`Task Tracker tab already exists: "${taskTab.title}"`);
  } else {
    console.log('Creating Task Tracker tab...');
    const addResult = await batchUpdate(token, [{
      addSheet: {
        properties: {
          title: 'Task Tracker',
          tabColor: { red: 0.9, green: 0.3, blue: 0.3 },
          gridProperties: { frozenRowCount: 1 }
        }
      }
    }]);

    if (addResult.error) {
      console.error('Failed to create Task Tracker:', JSON.stringify(addResult.error));
    } else {
      const newSheetId = addResult.replies[0].addSheet.properties.sheetId;
      console.log('Task Tracker tab created (sheetId:', newSheetId, ')');

      // Write headers
      const taskHeaders = ['Created', 'Task', 'Assignee', 'Deadline', 'Status', 'Source', 'Follow-up', 'Notes'];
      await writeRange(token, "'Task Tracker'!A1:H1", [taskHeaders]);

      // Format header row
      await batchUpdate(token, [{
        repeatCell: {
          range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.9, green: 0.3, blue: 0.3 },
              textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
      }]);
      console.log('Task Tracker headers written & formatted');
    }
  }

  // === FIX 2: Reset Report Tracker headers ===
  if (!rtTab) {
    console.error('Report Tracker tab not found!');
    process.exit(1);
  }

  console.log(`\nFixing Report Tracker: "${rtTab.title}" (sheetId: ${rtTab.sheetId})`);
  const tabName = rtTab.title;

  // Read current data to preserve valid entries
  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("'" + tabName + "'!A1:F50")}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const readData = await readRes.json();
  const rows = readData.values || [];
  console.log(`Current rows: ${rows.length}`);

  // Filter valid report entries (format: Tuan XX, BP name, date, subject, summary, msgId)
  const validEntries = rows.filter(r => {
    if (!r[0] || !r[1]) return false;
    const col0 = (r[0] || '').toString().toLowerCase();
    return col0.startsWith('tuan') && r.length >= 4;
  });
  console.log(`Valid report entries found: ${validEntries.length}`);

  // Clear entire tab
  await clearRange(token, "'" + tabName + "'!A:Z");
  console.log('Cleared Report Tracker');

  // Write correct headers
  const rtHeaders = ['Tuan', 'BP', 'Ngay nop', 'Email subject', 'Tom tat Gemini', 'Email msg ID'];
  const allData = [rtHeaders, ...validEntries];
  await writeRange(token, "'" + tabName + "'!A1:F" + allData.length, allData);
  console.log(`Written: 1 header row + ${validEntries.length} data rows`);

  // Format header row
  await batchUpdate(token, [{
    repeatCell: {
      range: { sheetId: rtTab.sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.2, green: 0.6, blue: 0.3 },
          textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
          horizontalAlignment: 'CENTER'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
    }
  }]);

  console.log('\n========================================');
  console.log('DONE! Fixes applied:');
  console.log('1. Task Tracker tab: ' + (taskTab ? 'already existed' : 'CREATED'));
  console.log('2. Report Tracker: headers reset, ' + validEntries.length + ' valid entries preserved');
  console.log('========================================');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
