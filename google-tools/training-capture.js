#!/usr/bin/env node
// Training Capture — Le Na CEO Agent (Issue #65)
// Luu kien thuc tu cap nhat khi Sep Khanh dang TRAINING/HUONG DAN truc tiep.
// Khac voi memory-update.js: co category bat buoc, examples, cross-reference
// related topics, va sinh recap de VIP confirm.
//
// Output goi vao: /root/.openclaw/lena-learned/training/<category>.md
// Index cross-reference: /root/.openclaw/lena-learned/training-index.md
//
// Usage:
//   node training-capture.js <category> <lesson> [examples] [related_topics] [section]
//     category       : technical | business | process | customer-insight (hoac slug khac)
//     lesson         : noi dung kien thuc Sep day (markdown)
//     examples       : case study / vi du ap dung (optional)
//     related_topics : cac topic lien quan, comma-separated (vd: "hvac-standards,brand-guide")
//     section        : heading phu (optional, default = "Training <ngay gio>")

const fs = require('fs');
const path = require('path');

const LEARNED_DIR = '/root/.openclaw/lena-learned';
const TRAINING_DIR = path.join(LEARNED_DIR, 'training');
const INDEX_FILE = path.join(LEARNED_DIR, 'training-index.md');

const KNOWN_CATEGORIES = ['technical', 'business', 'process', 'customer-insight'];

function slug(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const category = slug(process.argv[2] || '');
const lesson = (process.argv[3] || '').trim();
const examples = (process.argv[4] || '').trim();
const relatedRaw = (process.argv[5] || '').trim();
const section = (process.argv[6] || '').trim();

if (!category || !lesson) {
  console.error(JSON.stringify({
    error: 'Usage: node training-capture.js <category> <lesson> [examples] [related_topics] [section]',
    valid_categories: KNOWN_CATEGORIES
  }));
  process.exit(1);
}

try { fs.mkdirSync(TRAINING_DIR, { recursive: true }); } catch (e) {}

const related = relatedRaw
  ? relatedRaw.split(',').map(s => slug(s)).filter(Boolean)
  : [];

const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
const heading = section || `Training ${now}`;
const file = path.join(TRAINING_DIR, `${category}.md`);
const isNew = !fs.existsSync(file);

let block = '';
if (isNew) {
  block += `# training/${category} — Le Na training log\n\n`;
  block += `> Kien thuc Sep Khanh day truc tiep, category=${category}. Doc qua \`memory_search\`.\n\n`;
  if (!KNOWN_CATEGORIES.includes(category)) {
    block += `> Note: category "${category}" khong nam trong nhom chuan (${KNOWN_CATEGORIES.join(', ')}).\n\n`;
  }
}
block += `## ${heading}\n\n`;
block += `**Lesson**: ${lesson}\n\n`;
if (examples) block += `**Examples / Ap dung**:\n${examples}\n\n`;
if (related.length) {
  block += `**Cross-reference**: ${related.map(r => `[[${r}]]`).join(', ')}\n\n`;
}

try {
  fs.appendFileSync(file, block);
} catch (e) {
  console.error(JSON.stringify({ error: `Write training file failed: ${e.message}`, file }));
  process.exit(1);
}

// Append index entry de cross-reference va search nhanh
let indexBlock = '';
if (!fs.existsSync(INDEX_FILE)) {
  indexBlock += `# training-index — Le Na training catalog\n\n`;
  indexBlock += `> Chi muc cac buoi training tu Sep Khanh. Moi entry: thoi gian, category, lesson summary, cross-ref.\n\n`;
}
const lessonSummary = lesson.length > 140 ? lesson.substring(0, 140) + '…' : lesson;
indexBlock += `- **${now}** [${category}] ${lessonSummary}`;
if (related.length) indexBlock += ` → ${related.map(r => `\`${r}\``).join(', ')}`;
indexBlock += `\n`;

try { fs.appendFileSync(INDEX_FILE, indexBlock); }
catch (e) { /* index khong critical, bo qua */ }

const stats = fs.statSync(file);

// Recap de VIP confirm — Le Na se gui lai cho Sep xac nhan dung hieu chua
const recapLines = [
  `Em da nhan training [${category}]:`,
  `- Lesson: ${lessonSummary}`
];
if (examples) recapLines.push(`- Co ${examples.split('\n').filter(l => l.trim()).length} vi du / case`);
if (related.length) recapLines.push(`- Lien ket: ${related.join(', ')}`);
recapLines.push(`Sep confirm dung y chua a?`);

console.log(JSON.stringify({
  success: true,
  action: isNew ? 'create' : 'append',
  category,
  file,
  section: heading,
  related,
  category_is_standard: KNOWN_CATEGORIES.includes(category),
  bytes_added: Buffer.byteLength(block, 'utf-8'),
  total_bytes: stats.size,
  recap: recapLines.join('\n'),
  hint: `Le Na lan sau dung memory_search keyword="<tu khoa>" de tra cuu lai training nay. File training/${category}.md.`
}, null, 2));
