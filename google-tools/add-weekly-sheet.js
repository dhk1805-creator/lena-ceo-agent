#!/usr/bin/env node
// Add "19. Weekly Performance" sheet to existing Le Na CEO Dashboard
// Run once: node add-weekly-sheet.js
// Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_SHEET_ID

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

async function main() {
  const token = await getAccessToken();

  // Step 1: Add new sheet tab
  const addSheetRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: '19. Weekly Performance',
              tabColor: { red: 0.2, green: 0.5, blue: 0.9 },
              gridProperties: { frozenRowCount: 1 }
            }
          }
        }]
      })
    }
  );

  const addResult = await addSheetRes.json();
  if (addResult.error) {
    console.error('Add sheet error:', JSON.stringify(addResult.error));
    process.exit(1);
  }

  console.log('Sheet "19. Weekly Performance" created');

  // Step 2: Write headers
  const headers = [
    'Tuan', 'Thang', 'Quy', 'Ngay bat dau', 'Ngay ket thuc',
    'Cua gio ND (ty)', 'Cua gio ND KH', 'Cua gio ND %',
    'Van EI ND (ty)', 'Van EI ND KH', 'Van EI ND %',
    'Van CK ND (ty)', 'Van CK ND KH', 'Van CK ND %',
    'VAV/CAV (ty)', 'VAV/CAV KH', 'VAV/CAV %',
    'Tam nan (ty)', 'Tam nan KH', 'Tam nan %',
    'Cua gio XK (ty)', 'Cua gio XK KH', 'Cua gio XK %',
    'Van EI XK (ty)', 'Van EI XK KH', 'Van EI XK %',
    'Van CK XK (ty)', 'Van CK XK KH', 'Van CK XK %',
    'Hang khac (ty)', 'Hang khac KH', 'Hang khac %',
    'TONG TT (ty)', 'TONG KH (ty)', 'TONG %',
    'NTK (ty)', 'NTK KH', 'NTK %',
    'GALAXY (ty)', 'GALAXY KH', 'GALAXY %',
    'VNMEP (ty)', 'VNMEP KH', 'VNMEP %',
    'IMP (ty)', 'IMP KH', 'IMP %',
    'MEPCO (ty)', 'MEPCO KH', 'MEPCO %',
    'BP nop BC', 'Ghi chu'
  ];

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("'19. Weekly Performance'!A1")}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: "'19. Weekly Performance'!A1", values: [headers] })
    }
  );

  const writeResult = await writeRes.json();

  // Step 3: Format header row
  const newSheetId = addResult.replies[0].addSheet.properties.sheetId;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          repeatCell: {
            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.5, blue: 0.9 },
                textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        }]
      })
    }
  );

  console.log('========================================');
  console.log('THANH CONG! Sheet "19. Weekly Performance" da tao');
  console.log(`Spreadsheet: ${SHEET_ID}`);
  console.log(`Headers: ${headers.length} cot`);
  console.log('========================================');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
