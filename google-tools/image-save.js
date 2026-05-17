#!/usr/bin/env node
require('./_env');
// Image Save — Download image from URL → upload to Google Drive "Anh_bia/" → return link
// Usage: node image-save.js <imageUrl> [filename] [tags]
// Tags: comma-separated keywords for memory search later

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const imageUrl = process.argv[2];
const customName = process.argv[3] || '';
const tags = process.argv[4] || '';

if (!imageUrl) {
  console.log(JSON.stringify({ error: 'Usage: node image-save.js <imageUrl> [filename] [tags]' }));
  process.exit(1);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const REPORTS_ROOT = '11G7dpJX552jZFt37ou_m5ocz2sRZ2p5p'; // Lena_Reports

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No access token');
  return data.access_token;
}

async function ensureCoverFolder(token) {
  const q = `'${REPORTS_ROOT}' in parents and name = 'Anh_bia' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Anh_bia', mimeType: 'application/vnd.google-apps.folder', parents: [REPORTS_ROOT] })
  });
  const folder = await createRes.json();
  return folder.id;
}

async function uploadToDrive(filePath, folderId, token) {
  const filename = path.basename(filePath);
  const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const fileContent = fs.readFileSync(filePath);

  // Multipart upload
  const boundary = '---lena-upload-' + Date.now();
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileContent,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  return res.json();
}

async function main() {
  const tmpDir = '/tmp/cover-images';
  fs.mkdirSync(tmpDir, { recursive: true });

  // Download image
  const ext = imageUrl.match(/\.(png|jpg|jpeg|webp)/i) ? imageUrl.match(/\.(png|jpg|jpeg|webp)/i)[0] : '.jpg';
  const filename = customName || `cover-${Date.now()}${ext}`;
  const filePath = path.join(tmpDir, filename);

  try {
    execSync(`curl -sS -L -o "${filePath}" -A "Mozilla/5.0" "${imageUrl}"`, { timeout: 30000 });
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: 'Download failed: ' + e.message }));
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) {
    console.log(JSON.stringify({ success: false, error: 'Downloaded file too small or missing' }));
    return;
  }

  // Upload to Drive
  const token = await getAccessToken();
  const folderId = await ensureCoverFolder(token);
  const file = await uploadToDrive(filePath, folderId, token);

  if (!file.id) {
    console.log(JSON.stringify({ success: false, error: 'Drive upload failed', detail: file }));
    return;
  }

  const size = fs.statSync(filePath).size;
  console.log(JSON.stringify({
    success: true,
    file: { id: file.id, name: file.name, link: file.webViewLink, size },
    folder: 'Lena_Reports/Anh_bia/',
    tags: tags || '(chua co tag)',
    note: 'Dung memory_update luu tags de memory_search tim lai sau'
  }));

  // Cleanup
  try { fs.unlinkSync(filePath); } catch {}
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
});
