#!/usr/bin/env node
// Google Drive Download — Le Na CEO Agent
// Tai file tu Google Drive ve local
//
// Usage: node drive-download.js "<fileId>" "[outputPath]"
//
// Examples:
//   node drive-download.js "1aBcDeFg" "/tmp/photo.jpg"
//   node drive-download.js "1aBcDeFg"  → saves to /tmp/drive-downloads/<filename>

const fs = require('fs');
const path = require('path');

const fileId = process.argv[2];
const outputPath = process.argv[3] || '';

if (!fileId) {
  console.log('Usage: node drive-download.js "<fileId>" "[outputPath]"');
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

  // Get file metadata first
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = await metaRes.json();

  if (meta.error) {
    console.log(JSON.stringify({ error: meta.error }));
    return;
  }

  // Determine output path
  const finalPath = outputPath || `/tmp/drive-downloads/${meta.name}`;
  const dir = path.dirname(finalPath);
  fs.mkdirSync(dir, { recursive: true });

  // Download file
  const dlRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!dlRes.ok) {
    console.log(JSON.stringify({ error: `Download failed: ${dlRes.status}` }));
    return;
  }

  const buffer = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(finalPath, buffer);

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);

  console.log(JSON.stringify({
    success: true,
    fileId,
    name: meta.name,
    mimeType: meta.mimeType,
    size: `${sizeMB} MB`,
    path: finalPath,
    note: `File da tai ve ${finalPath}. Dung --media de gui qua Zalo hoac dinh kem email.`
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
