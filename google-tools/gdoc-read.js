#!/usr/bin/env node
require('./_env');
// Google Doc Read — Le Na CEO Agent
// Doc noi dung Google Doc bat ky bang ID (export as plain text)
// Usage: node gdoc-read.js <docId> [maxChars]
// Returns: { success, docId, title, content, charCount }
//
// Examples:
//   node gdoc-read.js 1abc2def3ghi
//   node gdoc-read.js 1abc2def3ghi 5000

const docId = process.argv[2];
const maxChars = parseInt(process.argv[3] || '8000');

if (!docId) {
  console.error('Usage: node gdoc-read.js <docId> [maxChars]');
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

  // Get doc metadata (title)
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}?fields=name,mimeType,webViewLink`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = await metaRes.json();

  if (meta.error) {
    console.log(JSON.stringify({ success: false, error: meta.error }));
    return;
  }

  // Export as plain text
  const exportRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!exportRes.ok) {
    // Maybe it's a Sheet — try reading as CSV
    if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const csvRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/csv`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (csvRes.ok) {
        let content = await csvRes.text();
        const full = content.length;
        if (content.length > maxChars) {
          content = content.substring(0, maxChars) + `\n... [cat ngan: ${full} -> ${maxChars} ky tu]`;
        }
        console.log(JSON.stringify({
          success: true,
          docId,
          title: meta.name,
          type: 'spreadsheet',
          url: meta.webViewLink,
          charCount: full,
          content
        }, null, 2));
        return;
      }
    }
    console.log(JSON.stringify({ success: false, error: await exportRes.text() }));
    return;
  }

  let content = await exportRes.text();
  const fullLength = content.length;

  if (content.length > maxChars) {
    content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLength} -> ${maxChars} ky tu]`;
  }

  console.log(JSON.stringify({
    success: true,
    docId,
    title: meta.name,
    type: 'document',
    url: meta.webViewLink,
    charCount: fullLength,
    content
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
