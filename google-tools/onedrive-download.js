#!/usr/bin/env node
require('./_env');
// OneDrive Shared Link Download — Le Na CEO Agent
// Usage: node onedrive-download.js <shareUrl> [outputDir] [filename]
// Downloads file from OneDrive shared link (with redeem token from Teams/email)
// Uses curl to handle FedAuth cookie chain properly

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const shareUrl = process.argv[2];
const outputDir = process.argv[3] || '/tmp/attachments';
const customName = process.argv[4] || '';

if (!shareUrl) {
  console.log(JSON.stringify({ error: 'Usage: node onedrive-download.js <shareUrl> [outputDir] [filename]' }));
  process.exit(1);
}

const TYPE_EXT = { ':x:': '.xlsx', ':w:': '.docx', ':p:': '.pptx', ':b:': '.pdf', ':v:': '.mp4', ':i:': '.png' };

function detectExt(url) {
  for (const [code, ext] of Object.entries(TYPE_EXT)) {
    if (url.includes(code)) return ext;
  }
  return '';
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  // Add download=1 to URL
  const dlUrl = shareUrl.includes('download=1') ? shareUrl
    : shareUrl + (shareUrl.includes('?') ? '&' : '?') + 'download=1';

  // Temp files
  const ts = Date.now();
  const cookieFile = path.join(outputDir, `.cookies-${ts}`);
  const headerFile = path.join(outputDir, `.headers-${ts}`);
  const ext = detectExt(shareUrl) || '.bin';
  const tempFile = path.join(outputDir, `onedrive-temp-${ts}${ext}`);

  try {
    // Use curl: -L follows redirects, -c/-b handles cookies, -D dumps headers
    const curlCmd = `curl -sS -L -c "${cookieFile}" -b "${cookieFile}" -D "${headerFile}" -o "${tempFile}" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0" "${dlUrl}"`;
    execSync(curlCmd, { timeout: 60000, stdio: 'pipe' });

    if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
      console.log(JSON.stringify({ success: false, error: 'Download returned empty file' }));
      return;
    }

    // Check if we got HTML instead of actual file
    const head = fs.readFileSync(tempFile, { encoding: 'utf8', flag: 'r' }).substring(0, 200);
    if (head.includes('<!DOCTYPE') || head.includes('<!-- Copyright')) {
      console.log(JSON.stringify({ success: false, error: 'Received HTML page — link may require login or has expired' }));
      return;
    }

    // Read response headers to find filename and content-type
    const headers = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, 'utf8') : '';
    let filename = customName;
    if (!filename) {
      // Try Content-Disposition
      const cdMatch = headers.match(/content-disposition:.*filename\*?=(?:UTF-8'')?["']?([^"'\r\n;]+)/i);
      if (cdMatch) filename = decodeURIComponent(cdMatch[1].trim());
    }
    if (!filename) {
      // Try to extract from redirect URL (final URL often has real filename)
      const locMatch = headers.match(/location:.*\/([^\/\?\r\n]+\.\w{2,5})(?:\?|$)/im);
      if (locMatch) filename = decodeURIComponent(locMatch[1].trim());
    }
    if (!filename) {
      filename = 'onedrive-' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + ext;
    }
    // Clean filename
    filename = filename.replace(/[<>:"|?*]/g, '_');
    if (!path.extname(filename) && ext !== '.bin') filename += ext;

    // Rename temp to final
    const filePath = path.join(outputDir, filename);
    fs.renameSync(tempFile, filePath);

    const size = fs.statSync(filePath).size;
    const sizeHuman = size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB';

    // Parse content-type from headers
    const ctMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
    const contentType = ctMatch ? ctMatch[1].trim() : '';

    console.log(JSON.stringify({
      success: true,
      file: { filename, path: filePath, size, sizeHuman, contentType },
      sourceUrl: shareUrl.substring(0, 80) + '...',
      note: 'Dung report_archive upload de luu vao Google Drive'
    }, null, 2));

  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(cookieFile); } catch {}
    try { fs.unlinkSync(headerFile); } catch {}
    try { fs.unlinkSync(tempFile); } catch {}
  }
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
