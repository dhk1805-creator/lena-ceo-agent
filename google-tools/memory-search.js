#!/usr/bin/env node
// Memory Search — Le Na CEO Agent
// Tra cuu kien thuc trong cac file memory baked-in (/app/workspace/memory) + learned (/root/.openclaw/lena-learned).
// Usage: node memory-search.js <keyword> [file]
//   keyword: tu khoa loc (case-insensitive)
//   file:    chi tim trong 1 file cu the (vd: "hvac-standards"), de trong = quet TAT CA

const fs = require('fs');
const path = require('path');

const BAKED_DIR = '/app/workspace/memory';
const LEARNED_DIR = '/root/.openclaw/lena-learned';

const keyword = (process.argv[2] || '').trim();
const fileFilter = (process.argv[3] || '').trim().toLowerCase().replace(/\.md$/, '');

if (!keyword) {
  console.error(JSON.stringify({ error: 'Usage: node memory-search.js <keyword> [file]' }));
  process.exit(1);
}

function listMdFiles(dir, prefix = '') {
  try {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Quet 1 cap subdir (vd: lena-learned/training/<category>.md) de tra cuu training-capture.
        out.push(...listMdFiles(full, `${prefix}${entry.name}/`));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push({ name: `${prefix}${entry.name.replace(/\.md$/, '')}`, path: full });
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

function searchFile(file, kw) {
  let content;
  try { content = fs.readFileSync(file.path, 'utf-8'); }
  catch (e) { return null; }

  const lines = content.split('\n');
  const kwLower = kw.toLowerCase();
  const matches = [];
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) currentSection = line.replace(/^#+\s*/, '').trim();
    if (line.toLowerCase().includes(kwLower)) {
      const ctxStart = Math.max(0, i - 1);
      const ctxEnd = Math.min(lines.length, i + 2);
      matches.push({
        line: i + 1,
        section: currentSection,
        context: lines.slice(ctxStart, ctxEnd).join('\n')
      });
    }
  }
  return matches;
}

function main() {
  const baked = listMdFiles(BAKED_DIR).map(f => ({ ...f, source: 'baked' }));
  const learned = listMdFiles(LEARNED_DIR).map(f => ({ ...f, source: 'learned' }));
  const all = [...baked, ...learned];
  // File filter chap nhan: exact match ("training/technical"), basename match ("technical"
  // se match ca "technical-facts" va "training/technical"), hoac prefix match ("training/"
  // se quet tat ca file trong thu muc training/).
  const targets = fileFilter
    ? all.filter(f => {
        const n = f.name.toLowerCase();
        const base = n.split('/').pop();
        return n === fileFilter || base === fileFilter || n.startsWith(fileFilter);
      })
    : all;

  const results = [];
  let totalMatches = 0;

  for (const file of targets) {
    const matches = searchFile(file, keyword);
    if (matches && matches.length > 0) {
      totalMatches += matches.length;
      results.push({
        file: file.name,
        source: file.source,
        match_count: matches.length,
        matches: matches.slice(0, 8)
      });
    }
  }

  console.log(JSON.stringify({
    keyword,
    file_filter: fileFilter || null,
    files_scanned: targets.length,
    files_with_match: results.length,
    total_matches: totalMatches,
    results,
    hint: totalMatches === 0
      ? 'Khong tim thay. Thu keyword khac, hoac dung hvac_lookup cho tra cuu Google Sheet.'
      : (results.some(r => r.source === 'learned')
          ? 'Co ket qua tu lena-learned (kien thuc tu cap nhat). Coi trong lan ket qua baked.'
          : 'Tat ca ket qua tu memory baked-in.')
  }, null, 2));
}

main();
