#!/usr/bin/env node
// Google Doc Export — Le Na CEO Agent
// Usage: node gdoc-export.js <docId> [format] [outputPath]
// format: pdf (default), docx
// outputPath: where to save (default: /tmp/<docId>.<format>)
//
// Examples:
//   node gdoc-export.js 1abc2def3ghi
//   node gdoc-export.js 1abc2def3ghi pdf /tmp/report.pdf
//   node gdoc-export.js 1abc2def3ghi docx /tmp/report.docx

const fs = require('fs');
const path = require('path');

const docId = process.argv[2];
const format = (process.argv[3] || 'pdf').toLowerCase();
const outputPath = process.argv[4] || `/tmp/${docId}.${format}`;

if (!docId) {
  console.error('Usage: node gdoc-export.js <docId> [pdf|docx] [outputPath]');
  process.exit(1);
}

const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

if (!MIME_TYPES[format]) {
  console.error(`Unsupported format: ${format}. Use: pdf, docx`);
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

  // Export Google Doc as PDF or DOCX via Drive API
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=${encodeURIComponent(MIME_TYPES[format])}`;

  const res = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const err = await res.text();
    console.log(JSON.stringify({ success: false, error: err }));
    process.exit(1);
  }

  // Save to file
  const buffer = Buffer.from(await res.arrayBuffer());
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  const sizeKB = (buffer.length / 1024).toFixed(1);

  console.log(JSON.stringify({
    success: true,
    docId,
    format,
    path: outputPath,
    size: `${sizeKB} KB`
  }));
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
