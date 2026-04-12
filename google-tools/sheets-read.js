#!/usr/bin/env node
// Google Sheets Read — Le Na CEO Agent
// Usage: node sheets-read.js <spreadsheetId> <range>
// Example: node sheets-read.js 1abc...xyz "KPI Tracker!A1:Z100"

const spreadsheetId = process.argv[2];
const range = process.argv[3];

if (!spreadsheetId || !range) {
  console.error('Usage: node sheets-read.js <spreadsheetId> <range>');
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
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

async function main() {
  const token = await getAccessToken();

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  if (data.values) {
    console.log(JSON.stringify({
      range: data.range,
      rows: data.values.length,
      data: data.values
    }, null, 2));
  } else {
    console.log(JSON.stringify({ error: data.error || 'No data found', range }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
