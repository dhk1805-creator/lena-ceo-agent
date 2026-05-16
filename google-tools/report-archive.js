#!/usr/bin/env node
require('./_env');
const fs = require('fs');
const path = require('path');

const action = process.argv[2] || 'init';
const arg1 = process.argv[3] || '';
const arg2 = process.argv[4] || '';
const arg3 = process.argv[5] || '';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const REPORTS_ROOT = '11G7dpJX552jZFt37ou_m5ocz2sRZ2p5p';

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

async function driveAPI(p, token, opts = {}) {
  const url = p.startsWith('http') ? p : 'https://www.googleapis.com/drive/v3/' + p;
  const res = await fetch(url, { method: opts.method || 'GET', headers: { Authorization: 'Bearer ' + token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  return res.json();
}

function getTimeInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  const d = new Date(Date.UTC(year, now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year, week: weekNum, month, quarter,
    weekStr: 'W' + String(weekNum).padStart(2, '0'),
    monthStr: 'M' + String(month).padStart(2, '0'),
    quarterStr: 'Q' + quarter, yearStr: 'Year' };
}

async function ensureFolder(name, token) {
  const q = "'" + REPORTS_ROOT + "' in parents and name = '" + name + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const s = await driveAPI('files?' + new URLSearchParams({ q, fields: 'files(id,name)' }), token);
  if (s.files && s.files.length > 0) return { id: s.files[0].id, existed: true };
  const f = await driveAPI('files', token, { method: 'POST', body: { name, mimeType: 'application/vnd.google-apps.folder', parents: [REPORTS_ROOT] } });
  return { id: f.id, existed: false };
}

function periodToFolder(period, t) {
  if (!period) return t.year + '-' + t.weekStr;
  const p = period.toUpperCase();
  if (p.startsWith('W') || p.startsWith('M') || p.startsWith('Q')) return t.year + '-' + p;
  if (p === 'YEAR') return t.year + '-Year';
  return t.year + '-' + p;
}

async function main() {
  const token = await getAccessToken();
  const time = getTimeInfo();

  if (action === 'archive') {
    if (!arg1) { console.log(JSON.stringify({ error: 'Can fileId' })); return; }
    const folderName = periodToFolder(arg2, time);
    const folder = await ensureFolder(folderName, token);
    const copyBody = { parents: [folder.id] };
    if (arg3) copyBody.name = arg3;
    const copy = await driveAPI('files/' + arg1 + '/copy', token, { method: 'POST', body: copyBody });
    if (!copy.id) { console.log(JSON.stringify({ success: false, error: copy })); return; }
    const info = await driveAPI('files/' + copy.id + '?fields=id,name,webViewLink,mimeType', token);
    console.log(JSON.stringify({ success: true, action: 'archive', folder: folderName, folderCreated: !folder.existed, file: { id: info.id, name: info.name, url: info.webViewLink }, folderUrl: 'https://drive.google.com/drive/folders/' + folder.id }, null, 2));

  } else if (action === 'init') {
    const folderName = periodToFolder(arg1, time);
    const folder = await ensureFolder(folderName, token);
    console.log(JSON.stringify({ success: true, action: 'init', folder: folderName, folderId: folder.id, existed: folder.existed, url: 'https://drive.google.com/drive/folders/' + folder.id, time }, null, 2));

  } else if (action === 'list') {
    const folderName = periodToFolder(arg1, time);
    const q = "'" + REPORTS_ROOT + "' in parents and name = '" + folderName + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    const s = await driveAPI('files?' + new URLSearchParams({ q, fields: 'files(id)' }), token);
    if (!s.files || !s.files.length) { console.log(JSON.stringify({ success: true, folder: folderName, files: [], note: 'Folder chua ton tai' })); return; }
    const fid = s.files[0].id;
    const lq = "'" + fid + "' in parents and trashed = false";
    const lr = await driveAPI('files?' + new URLSearchParams({ q: lq, fields: 'files(id,name,mimeType,createdTime,webViewLink)', orderBy: 'name', pageSize: '100' }), token);
    const files = (lr.files || []).map(f => ({ name: f.name, created: (f.createdTime || '').substring(0, 10), url: f.webViewLink }));
    console.log(JSON.stringify({ success: true, folder: folderName, url: 'https://drive.google.com/drive/folders/' + fid, count: files.length, files }, null, 2));

  } else if (action === 'upload') {
    // Upload local file to report folder
    if (!arg1) { console.log(JSON.stringify({ error: 'Can filePath' })); return; }
    if (!fs.existsSync(arg1)) { console.log(JSON.stringify({ error: 'File khong ton tai: ' + arg1 })); return; }
    const folderName = periodToFolder(arg2, time);
    const folder = await ensureFolder(folderName, token);
    const fileName = arg3 || path.basename(arg1);
    const fileData = fs.readFileSync(arg1);
    const boundary = '---lena-upload-' + Date.now();
    const metadata = JSON.stringify({ name: fileName, parents: [folder.id] });
    const body = Buffer.concat([
      Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + metadata + '\r\n--' + boundary + '\r\nContent-Type: application/octet-stream\r\n\r\n'),
      fileData,
      Buffer.from('\r\n--' + boundary + '--')
    ]);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
    const result = await res.json();
    if (result.id) {
      console.log(JSON.stringify({ success: true, action: 'upload', folder: folderName, file: { id: result.id, name: result.name, url: result.webViewLink }, folderUrl: 'https://drive.google.com/drive/folders/' + folder.id }, null, 2));
    } else {
      console.log(JSON.stringify({ success: false, error: result }));
    }

  } else {
    console.log(JSON.stringify({ error: 'Unknown: ' + action, actions: ['archive', 'init', 'list', 'upload'] }));
  }
}

main().catch(e => { console.log(JSON.stringify({ error: e.message })); process.exit(1); });
