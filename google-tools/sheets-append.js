#!/usr/bin/env node
// Google Sheets APPEND — Le Na CEO Agent
// THEM DONG MOI vao cuoi sheet (KHONG ghi de data cu)
//
// Usage: node sheets-append.js <spreadsheetId> <range> <jsonData>
// Example: node sheets-append.js 1abc...xyz "'Report Tracker'!A:F" '[["Tuan 19","R&D","12/05","BC tuan","tom tat","msgId"]]'
//
// Khac voi sheets-write.js (PUT = ghi de), sheets-append.js LUON them dong moi

const spreadsheetId = process.argv[2];
const range = process.argv[3];
const jsonData = process.argv[4];

if (!spreadsheetId || !range || !jsonData) {
  console.error('Usage: node sheets-append.js <spreadsheetId> <range> <jsonData>');
  process.exit(1);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

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
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

async function main() {
  const token = await getAccessToken();
  const values = JSON.parse(jsonData);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  const result = await res.json();

  if (result.updates) {
    console.log(JSON.stringify({
      success: true,
      updatedRange: result.updates.updatedRange,
      updatedRows: result.updates.updatedRows,
      updatedCells: result.updates.updatedCells
    }));
  } else {
    console.log(JSON.stringify({ success: false, error: result }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
