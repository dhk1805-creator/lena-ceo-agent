#!/usr/bin/env node
// Memory Update — Le Na CEO Agent
// Ghi kien thuc tu cap nhat vao volume ben vung (/root/.openclaw/lena-learned/<topic>.md).
// KHONG ghi de file memory baked-in (/app/workspace/memory) — chi append vao learned overlay.
// Usage: node memory-update.js <topic> <content> [section]
//   topic:   ten file (kebab-case, vd: "hvac-standards", "competitor-intel")
//   content: noi dung muon them (markdown)
//   section: heading phu de gom (default = ngay hien tai)

const fs = require('fs');
const path = require('path');

const LEARNED_DIR = '/root/.openclaw/lena-learned';

const topic = (process.argv[2] || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
const content = (process.argv[3] || '').trim();
const section = (process.argv[4] || '').trim();

if (!topic || !content) {
  console.error(JSON.stringify({ error: 'Usage: node memory-update.js <topic> <content> [section]' }));
  process.exit(1);
}

try { fs.mkdirSync(LEARNED_DIR, { recursive: true }); } catch (e) {}

const file = path.join(LEARNED_DIR, `${topic}.md`);
const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
const heading = section || `Cap nhat ${now}`;

const isNew = !fs.existsSync(file);
let block = '';
if (isNew) {
  block += `# ${topic} — Le Na learned overlay\n\n`;
  block += `> Overlay tren memory baked-in. Le Na tu cap nhat qua \`memory_update\`. Doc qua \`memory_search\`.\n\n`;
}
block += `## ${heading}\n\n${content}\n\n`;

try {
  fs.appendFileSync(file, block);
} catch (e) {
  console.error(JSON.stringify({ error: `Write failed: ${e.message}`, file }));
  process.exit(1);
}

const stats = fs.statSync(file);
console.log(JSON.stringify({
  success: true,
  action: isNew ? 'create' : 'append',
  topic,
  file,
  section: heading,
  bytes_added: Buffer.byteLength(block, 'utf-8'),
  total_bytes: stats.size,
  hint: 'Le Na lan sau dung memory_search keyword=... [file=' + topic + '] de tra cuu lai.'
}, null, 2));
