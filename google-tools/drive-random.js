#!/usr/bin/env node
require('./_env');
// Drive Random — Le Na CEO Agent
// Lay N anh ngau nhien tu mot folder Google Drive (paginate qua full folder).
//
// Usage: node drive-random.js "<folderId>" "[count]"
//   count default = 1
//
// Output JSON:
//   { success, folderId, total, picked: [{ id, name, mimeType, public_url }] }
//
// public_url format `lh3.googleusercontent.com/d/<id>` — dung lam cover cho
// zalo_oa_article (Zalo CDN fetch). Folder phai share "Anyone with link".

const folderId = process.argv[2];
const count = Math.max(1, parseInt(process.argv[3] || '1'));

if (!folderId) {
  console.log('Usage: node drive-random.js "<folderId>" "[count]"');
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

async function listAllImages(token) {
  const safeFolderId = folderId.replace(/'/g, "\\'");
  const q = `'${safeFolderId}' in parents and trashed = false and mimeType contains 'image/'`;
  let files = [];
  let pageToken = '';
  while (true) {
    const params = new URLSearchParams({
      q,
      pageSize: '1000',
      fields: 'nextPageToken, files(id,name,mimeType,size)'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    files = files.concat(data.files || []);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return files;
}

async function main() {
  const token = await getAccessToken();
  const all = await listAllImages(token);

  if (all.length === 0) {
    console.log(JSON.stringify({ success: false, error: 'Folder rong hoac khong co anh', folderId }));
    process.exit(1);
  }

  // Fisher-Yates shuffle, take first N
  const shuffled = all.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, count).map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    public_url: `https://lh3.googleusercontent.com/d/${f.id}`
  }));

  console.log(JSON.stringify({
    success: true,
    folderId,
    total: all.length,
    pickedCount: picked.length,
    picked
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
