#!/usr/bin/env node
require('./_env');
// Web Read — Le Na CEO Agent
// Doc noi dung 1 URL web (HTML -> plain text). Khong xu ly PDF binary.
// Usage: node web-read.js "<url>"
// Output: JSON { url, title, content, content_length, truncated }

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

async function main() {
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
