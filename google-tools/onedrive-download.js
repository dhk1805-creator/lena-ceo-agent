#!/usr/bin/env node
// OneDrive Download — Le Na CEO Agent
// Tai file tu link OneDrive / SharePoint (chia se public "anyone with link")
// ve local /tmp/onedrive/. Sau do chain voi file_read de doc noi dung.
//
// Ho tro:
//   - 1drv.ms shortlink         -> follow redirect
//   - onedrive.live.com (Personal) -> shares API api.onedrive.com (KHONG can OAuth)
//   - *.sharepoint.com (Business)  -> append ?download=1 va follow redirect
//
// Han che: neu link KHONG bat "anyone with link can view" thi se loi 401/403.
// Truong hop do bao nhan vien dat lai quyen public, hoac dung Microsoft Graph
// OAuth (chua trien khai — can dang ky Azure App va luu refresh token).
//
// Usage: node onedrive-download.js "<url>" "[outputPath]"

const fs = require('fs');
const path = require('path');

const url = process.argv[2];
const outputPathArg = process.argv[3] || '';

if (!url) {
  console.log(JSON.stringify({ error: 'Usage: node onedrive-download.js "<url>" "[outputPath]"' }));
  process.exit(1);
}

const OUTPUT_DIR = '/tmp/onedrive';

function encodeShareId(shareUrl) {
  const b64 = Buffer.from(shareUrl).toString('base64')
    .replace(/=+$/, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  return 'u!' + b64;
}

async function resolveRedirect(targetUrl) {
  // Manual redirect loop — Microsoft hay redirect 302 nhieu lan
  let current = targetUrl;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(current, { method: 'HEAD', redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).toString();
      continue;
    }
    break;
  }
  return current;
}

function detectHost(u) {
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (host === '1drv.ms') return 'shortlink';
    if (host.endsWith('onedrive.live.com')) return 'personal';
    if (host.endsWith('sharepoint.com')) return 'business';
    return 'unknown';
  } catch (_) {
    return 'invalid';
  }
}

function pickFilename(res, fallbackUrl) {
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
  if (m && m[1]) {
    try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
  }
  try {
    const p = new URL(fallbackUrl).pathname;
    const base = path.basename(p);
    if (base && base !== '/' && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
  } catch (_) {}
  return `onedrive-${Date.now()}.bin`;
}

async function downloadToFile(directUrl, originalUrl) {
  const res = await fetch(directUrl, { redirect: 'follow' });
  if (!res.ok) {
    return {
      error: `Tai file that bai: HTTP ${res.status}. ` +
             (res.status === 401 || res.status === 403
                ? 'Link OneDrive yeu cau dang nhap. Bao nhan vien dat lai quyen "Anyone with the link can view".'
                : 'Kiem tra link co dung khong.'),
      status: res.status
    };
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filename = pickFilename(res, originalUrl);
  const finalPath = outputPathArg || path.join(OUTPUT_DIR, filename);
  const dir = path.dirname(finalPath);
  fs.mkdirSync(dir, { recursive: true });

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(finalPath, buffer);

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  return {
    success: true,
    path: finalPath,
    filename: path.basename(finalPath),
    mimeType: res.headers.get('content-type') || '',
    size: `${sizeMB} MB`,
    bytes: buffer.length,
    note: `File da tai ve ${finalPath}. Dung file_read voi file_path="${finalPath}" de doc noi dung.`
  };
}

async function main() {
  let resolved = url;
  let host = detectHost(resolved);

  if (host === 'invalid') {
    console.log(JSON.stringify({ error: 'URL khong hop le.' }));
    return;
  }

  // Resolve 1drv.ms shortlink truoc
  if (host === 'shortlink') {
    try {
      resolved = await resolveRedirect(url);
      host = detectHost(resolved);
    } catch (e) {
      console.log(JSON.stringify({ error: 'Khong resolve duoc 1drv.ms: ' + e.message }));
      return;
    }
  }

  let directUrl;
  if (host === 'personal') {
    // shares API cho OneDrive Personal — khong can OAuth voi public share
    const shareId = encodeShareId(resolved);
    directUrl = `https://api.onedrive.com/v1.0/shares/${shareId}/root/content`;
  } else if (host === 'business') {
    // SharePoint / OneDrive Business: append ?download=1 va follow redirect
    const u = new URL(resolved);
    u.searchParams.set('download', '1');
    directUrl = u.toString();
  } else {
    console.log(JSON.stringify({
      error: `Host khong ho tro: ${host}. Chi nhan link onedrive.live.com, 1drv.ms, hoac *.sharepoint.com.`,
      resolved
    }));
    return;
  }

  try {
    const result = await downloadToFile(directUrl, resolved);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ error: 'Loi tai file: ' + e.message }));
  }
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
