#!/usr/bin/env node
// Google Drive List — Le Na CEO Agent
// Liet ke file trong folder Google Drive
//
// Usage: node drive-list.js "<folderId>" "[query]" "[maxResults]"
//
// Examples:
//   node drive-list.js "1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR"
//   node drive-list.js "1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR" "exhibition"
//   node drive-list.js "1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR" "" 50

const folderId = process.argv[2];
const searchQuery = process.argv[3] || '';
const maxResults = parseInt(process.argv[4] || '30');

if (!folderId) {
  console.log('Usage: node drive-list.js "<folderId>" "[query]" "[maxResults]"');
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

  let q = `'${folderId}' in parents and trashed = false`;
  if (searchQuery) {
    q += ` and name contains '${searchQuery}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: maxResults,
    fields: 'files(id,name,mimeType,size,webViewLink,thumbnailLink,createdTime)',
    orderBy: 'name'
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  if (data.error) {
    console.log(JSON.stringify({ error: data.error }));
    return;
  }

  const files = (data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    type: f.mimeType,
    size: f.size ? (parseInt(f.size) / 1024 / 1024).toFixed(1) + ' MB' : 'N/A',
    url: f.webViewLink,
    thumbnail: f.thumbnailLink,
    created: f.createdTime
  }));

  console.log(JSON.stringify({
    success: true,
    folderId,
    totalFiles: files.length,
    query: searchQuery || '(all)',
    files
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
