#!/usr/bin/env node
require('./_env');
// HVAC Knowledge Lookup — Le Na CEO Agent
// Tra cuu tieu chuan / thuat ngu / kien thuc HVAC tu Google Sheet do Sep Khanh cung cap.
// Usage: node hvac-lookup.js [keyword] [range]
//   keyword: tu khoa loc (case-insensitive, khop bat ky cot nao). De trong = doc 50 dong dau.
//   range:   A1 range (default "A:Z" — doc tab dau tien)

const HVAC_SHEET_ID = '15GLw7PyJ9DTmfQfIzM9nhEsbJVpsywYDaPuj-WB7UP0';

const keyword = (process.argv[2] || '').trim();
const range = process.argv[3] || 'A:Z';

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
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${HVAC_SHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();

  if (!data.values) {
    console.log(JSON.stringify({ error: data.error || 'No data', range, sheet_id: HVAC_SHEET_ID }));
    return;
  }

  const rows = data.values;
  let matched = rows;

  if (keyword) {
    const kw = keyword.toLowerCase();
    matched = rows.filter(row => row.some(cell => String(cell || '').toLowerCase().includes(kw)));
  } else {
    matched = rows.slice(0, 50);
  }

  console.log(JSON.stringify({
    source: 'HVAC Knowledge Base',
    sheet_url: `https://docs.google.com/spreadsheets/d/${HVAC_SHEET_ID}/edit`,
    range: data.range,
    keyword: keyword || null,
    total_rows: rows.length,
    matched_rows: matched.length,
    data: matched
  }, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
