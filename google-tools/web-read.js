#!/usr/bin/env node
require('./_env');
// Web Read — Le Na CEO Agent
// Doc noi dung 1 URL web (HTML -> plain text). Khong xu ly PDF binary.
// Link YouTube: dung yt-dlp lay phu de/transcript thay vi doc HTML (YouTube la SPA,
// noi dung video khong nam trong HTML tinh).
// Usage: node web-read.js "<url>"
// Output: JSON { url, title, content, content_length, truncated }

const fs = require('fs');
const { execFile } = require('child_process');

const url = (process.argv[2] || '').trim();

if (!url) {
  console.log(JSON.stringify({ error: 'Thieu URL. Usage: web-read.js "<url>"' }));
  process.exit(1);
}

if (!/^https?:\/\//i.test(url)) {
  console.log(JSON.stringify({ error: 'URL phai bat dau bang http:// hoac https://', url }));
  process.exit(1);
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_BYTES = 2 * 1024 * 1024;   // 2 MB cap for fetched body
const MAX_TEXT = 8000;                // ~8K char cap for returned text
const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function htmlToText(html) {
  // Drop script/style/noscript/template blocks
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Prefer <article> / <main> if present (article extraction lite)
  const article = s.match(/<article[\s\S]*?<\/article>/i)?.[0]
                || s.match(/<main[\s\S]*?<\/main>/i)?.[0];
  if (article && article.length > 500) s = article;

  // Convert block-level tags to newlines so paragraphs survive
  s = s.replace(/<\/?(p|div|section|li|h[1-6]|br|tr|article|main|header|footer)[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

async function fetchWithTimeout(u, opts = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(u, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function readBodyCapped(res) {
  const reader = res.body?.getReader?.();
  if (!reader) return await res.text();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      try { reader.cancel(); } catch (e) {}
      chunks.push(value.subarray(0, value.length - (total - MAX_BYTES)));
      break;
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
  return buf.toString('utf-8');
}

// === YOUTUBE — lay transcript/phu de bang yt-dlp ===========================
// YouTube la SPA, web_read HTML chi lay duoc cai vo trang. Voi link YouTube ta
// dung yt-dlp tai phu de (.vtt) roi chuyen thanh van ban thuan. Neu khong lay
// duoc phu de thi tra ve loi RO RANG — de Le Na bao lai cho VIP, KHONG tu bia.
function extractYouTubeId(u) {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:[^#]*&)*v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = u.match(p);
    if (m) return m[1];
  }
  return null;
}

// Chuyen 1 file .vtt thanh van ban thuan: bo header, timestamp, the <c>, va bo
// cac dong lap (phu de tu dong cua YouTube lap dong khi caption "cuon").
function vttToText(vtt) {
  const out = [];
  const seen = new Set();
  for (let line of String(vtt).split('\n')) {
    line = line.replace(/<[^>]+>/g, '').trim();
    if (!line) continue;
    if (/^WEBVTT/.test(line) || /^Kind:/.test(line) || /^Language:/.test(line)) continue;
    if (line.includes('-->')) continue;
    if (/^\d+$/.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return decodeEntities(out.join(' ')).replace(/\s+/g, ' ').trim();
}

function runYtDlp(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(
      YTDLP_BIN, args,
      { encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, HOME: '/tmp' } },
      (err, stdout, stderr) => {
        // yt-dlp tra exit code != 0 khi 1 ngon ngu phu de loi (vd 429) nhung cac
        // phu de khac van tai duoc — KHONG coi day la that bai, kiem tra file VTT.
        resolve({ err, stdout: stdout || '', stderr: stderr || '' });
      }
    );
  });
}

async function readYouTube(videoId, originalUrl) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const dir = `/tmp/yt_${videoId}_${process.pid}_${Date.now()}`;
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}

  // --print bat che do --simulate, nen phai them --no-simulate de phu de VAN duoc ghi.
  const args = [
    '--skip-download', '--no-simulate',
    '--write-subs', '--write-auto-subs',
    '--sub-langs', 'vi.*,en.*', '--sub-format', 'vtt',
    '--no-warnings', '--retries', '3', '--socket-timeout', '20',
    '--print', '%(title)s', '--print', '%(duration)s',
    '-o', `${dir}/v`, watchUrl
  ];

  const res = await runYtDlp(args, 45000);

  const printLines = res.stdout.split('\n').map(s => s.trim()).filter(Boolean);
  const title = printLines[0] || '';
  const durationSec = parseInt(printLines[1], 10) || 0;

  let vttFiles = [];
  try {
    vttFiles = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.vtt'));
  } catch (e) {}

  if (vttFiles.length === 0) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    const ytdlpMissing = res.err && /ENOENT/.test(String(res.err.code || res.err.message || ''));
    console.log(JSON.stringify({
      url: originalUrl,
      title,
      content_type: 'youtube/transcript',
      error: ytdlpMissing
        ? 'Server chua cai yt-dlp nen chua doc duoc video YouTube. Bao VIP biet, KHONG tu bia noi dung video.'
        : 'Khong lay duoc phu de/transcript cua video nay (video co the khong co phu de, hoac YouTube tam chan). Bao VIP biet, KHONG tu bia noi dung video.',
      content: '',
      content_length: 0
    }, null, 2));
    return;
  }

  // Uu tien: vi (khong -orig) > en (khong -orig) > vi-orig > con lai
  function rank(f) {
    const n = f.toLowerCase();
    if (/\.vi\.vtt$/.test(n)) return 0;
    if (/\.en\.vtt$/.test(n)) return 1;
    if (/\.vi-orig\.vtt$/.test(n)) return 2;
    if (/-orig\.vtt$/.test(n)) return 4;
    return 3;
  }
  vttFiles.sort((a, b) => rank(a) - rank(b));

  let transcript = '';
  try {
    transcript = vttToText(fs.readFileSync(`${dir}/${vttFiles[0]}`, 'utf-8'));
  } catch (e) {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}

  if (!transcript) {
    console.log(JSON.stringify({
      url: originalUrl,
      title,
      content_type: 'youtube/transcript',
      error: 'Tai duoc phu de nhung noi dung rong. Bao VIP biet, KHONG tu bia noi dung video.',
      content: '',
      content_length: 0
    }, null, 2));
    return;
  }

  const durTxt = durationSec
    ? `${Math.floor(durationSec / 60)} phut ${durationSec % 60} giay`
    : 'khong ro';
  let content = `[VIDEO YOUTUBE — noi dung duoc lay tu phu de/transcript, khong phai loi nguoi noi nguyen van 100%]\n`
    + `Tieu de: ${title || '(khong ro)'}\n`
    + `Thoi luong: ${durTxt}\n\n`
    + `--- NOI DUNG (transcript) ---\n${transcript}`;

  const truncated = content.length > MAX_TEXT;
  if (truncated) content = content.substring(0, MAX_TEXT) + '\n\n[... noi dung bi cat — qua ' + MAX_TEXT + ' ky tu]';

  console.log(JSON.stringify({
    url: originalUrl,
    title: (title || 'YouTube video').substring(0, 300),
    content_type: 'youtube/transcript',
    content_length: content.length,
    truncated,
    content
  }, null, 2));
}

async function main() {
  // YouTube: dung yt-dlp lay transcript thay vi doc HTML (YouTube la SPA)
  const ytId = extractYouTubeId(url);
  if (ytId) {
    await readYouTube(ytId, url);
    return;
  }

  let res;
  try {
    res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.7',
        'Accept-Language': 'vi,en;q=0.8'
      },
      redirect: 'follow'
    });
  } catch (e) {
    console.log(JSON.stringify({ error: `Fetch failed: ${e.message}`, url }));
    process.exit(1);
  }

  if (!res.ok) {
    console.log(JSON.stringify({ error: `HTTP ${res.status} ${res.statusText}`, url }));
    process.exit(1);
  }

  const ctype = (res.headers.get('content-type') || '').toLowerCase();

  if (ctype.includes('application/pdf')) {
    console.log(JSON.stringify({
      url,
      content_type: ctype,
      error: 'PDF khong duoc ho tro extract text. Hay tai file ve va xu ly thu cong, hoac tim ban HTML.',
      content: '',
      content_length: 0
    }));
    return;
  }

  if (!ctype.includes('text/') && !ctype.includes('application/xhtml') && !ctype.includes('application/json') && !ctype.includes('application/xml') && ctype) {
    console.log(JSON.stringify({
      url,
      content_type: ctype,
      error: `Khong phai noi dung van ban (${ctype}). Khong the doc.`,
      content: ''
    }));
    return;
  }

  const raw = await readBodyCapped(res);

  let title = '';
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim());

  let text;
  if (ctype.includes('html') || /<html|<body|<head/i.test(raw)) {
    text = htmlToText(raw);
  } else {
    text = raw.replace(/\r\n/g, '\n').trim();
  }

  const truncated = text.length > MAX_TEXT;
  if (truncated) text = text.substring(0, MAX_TEXT) + '\n\n[... noi dung bi cat — qua ' + MAX_TEXT + ' ky tu]';

  console.log(JSON.stringify({
    url: res.url || url,
    title: title.substring(0, 300),
    content_type: ctype,
    content_length: text.length,
    truncated,
    content: text
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message, url }));
  process.exit(1);
});
