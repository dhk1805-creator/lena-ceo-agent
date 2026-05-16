#!/usr/bin/env node
// File Read — Le Na CEO Agent
// Doc file Excel (.xlsx/.xls) hoac PDF tu local path
// Usage: node file-read.js <filePath> [maxChars] [sheetName]
//
// Examples:
//   node file-read.js /tmp/attachments/report.xlsx
//   node file-read.js /tmp/attachments/report.pdf 5000
//   node file-read.js /tmp/attachments/data.xlsx 8000 "Sheet1"

const filePath = process.argv[2];
const maxChars = parseInt(process.argv[3] || '8000');
const sheetName = process.argv[4] || '';

if (!filePath) {
  console.log(JSON.stringify({ error: 'Usage: node file-read.js <filePath> [maxChars] [sheetName]' }));
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

if (!fs.existsSync(filePath)) {
  console.log(JSON.stringify({ error: `File khong ton tai: ${filePath}` }));
  process.exit(1);
}

const ext = path.extname(filePath).toLowerCase();

async function readExcel() {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheets = workbook.SheetNames;

  const targetSheet = sheetName || sheets[0];
  if (!sheets.includes(targetSheet)) {
    console.log(JSON.stringify({
      error: `Sheet "${targetSheet}" khong ton tai`,
      available_sheets: sheets
    }));
    return;
  }

  const result = { success: true, type: 'excel', file: path.basename(filePath), sheets };

  // Read target sheet
  const ws = workbook.Sheets[targetSheet];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Format as readable text
  let content = `=== Sheet: ${targetSheet} ===\n`;
  const rows = data.slice(0, 200); // max 200 rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.some(c => c !== '')) {
      content += row.map(c => String(c).trim()).join(' | ') + '\n';
    }
  }

  if (data.length > 200) {
    content += `\n... [con ${data.length - 200} dong nua]\n`;
  }

  const fullLen = content.length;
  if (content.length > maxChars) {
    content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLen} -> ${maxChars} ky tu]`;
  }

  result.sheetName = targetSheet;
  result.totalRows = data.length;
  result.charCount = fullLen;
  result.content = content;

  // If multiple sheets, show summary
  if (sheets.length > 1) {
    result.otherSheets = sheets.filter(s => s !== targetSheet);
    result.note = `Con ${sheets.length - 1} sheet khac. Truyen sheetName de doc sheet cu the.`;
  }

  console.log(JSON.stringify(result, null, 2));
}

async function readPDF() {
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  let content = data.text || '';
  const fullLen = content.length;

  if (content.length > maxChars) {
    content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLen} -> ${maxChars} ky tu]`;
  }

  console.log(JSON.stringify({
    success: true,
    type: 'pdf',
    file: path.basename(filePath),
    pages: data.numpages,
    charCount: fullLen,
    content
  }, null, 2));
}

async function readText() {
  let content = fs.readFileSync(filePath, 'utf8');
  const fullLen = content.length;

  if (content.length > maxChars) {
    content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLen} -> ${maxChars} ky tu]`;
  }

  console.log(JSON.stringify({
    success: true,
    type: 'text',
    file: path.basename(filePath),
    charCount: fullLen,
    content
  }, null, 2));
}


async function readDocx() {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  let content = result.value || '';
  const fullLen = content.length;

  if (content.length > maxChars) {
    content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLen} -> ${maxChars} ky tu]`;
  }

  console.log(JSON.stringify({
    success: true,
    type: 'docx',
    file: path.basename(filePath),
    charCount: fullLen,
    content
  }, null, 2));
}

async function readDoc() {
  const { execFileSync } = require('child_process');
  try {
    let content = execFileSync('antiword', [filePath], { encoding: 'utf-8', timeout: 30000 });
    const fullLen = content.length;

    if (content.length > maxChars) {
      content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLen} -> ${maxChars} ky tu]`;
    }

    console.log(JSON.stringify({
      success: true,
      type: 'doc',
      file: path.basename(filePath),
      charCount: fullLen,
      content
    }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ error: 'Khong doc duoc .doc: ' + e.message, file: path.basename(filePath) }));
  }
}

async function readPptx() {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  let content = '';
  const slideEntries = entries
    .filter(e => /ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const na = parseInt(a.entryName.match(/slide(\d+)/)[1]);
      const nb = parseInt(b.entryName.match(/slide(\d+)/)[1]);
      return na - nb;
    });

  for (const entry of slideEntries) {
    const xml = entry.getData().toString('utf8');
    const texts = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const slideText = texts.map(t => t.replace(/<\/?a:t>/g, '')).join(' ');
    if (slideText.trim()) {
      const slideNum = entry.entryName.match(/slide(\d+)/)[1];
      content += `=== Slide ${slideNum} ===\n${slideText}\n\n`;
    }
  }

  const fullLen = content.length;
  if (content.length > maxChars) {
    content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLen} -> ${maxChars} ky tu]`;
  }

  console.log(JSON.stringify({
    success: true,
    type: 'pptx',
    file: path.basename(filePath),
    slides: slideEntries.length,
    charCount: fullLen,
    content
  }, null, 2));
}

async function readPpt() {
  const { execFileSync } = require('child_process');
  try {
    let content = execFileSync('catppt', [filePath], { encoding: 'utf-8', timeout: 30000 });
    const fullLen = content.length;

    if (content.length > maxChars) {
      content = content.substring(0, maxChars) + `\n... [cat ngan: ${fullLen} -> ${maxChars} ky tu]`;
    }

    console.log(JSON.stringify({
      success: true,
      type: 'ppt',
      file: path.basename(filePath),
      charCount: fullLen,
      content
    }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ error: 'Khong doc duoc .ppt: ' + e.message, file: path.basename(filePath) }));
  }
}
async function main() {
  if (['.xlsx', '.xls', '.xlsm'].includes(ext)) {
    await readExcel();
  } else if (ext === '.docx') {
    await readDocx();
  } else if (ext === '.doc') {
    await readDoc();
  } else if (ext === '.pptx') {
    await readPptx();
  } else if (ext === '.ppt') {
    await readPpt();
  } else if (ext === '.pdf') {
    await readPDF();
  } else if (['.csv', '.txt', '.md', '.json', '.html', '.xml'].includes(ext)) {
    await readText();
  } else {
    console.log(JSON.stringify({
      error: `Dinh dang "${ext}" chua ho tro. Ho tro: doc, docx, ppt, pptx, xlsx, xls, pdf, csv, txt, md, json`,
      file: path.basename(filePath)
    }));
  }
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
