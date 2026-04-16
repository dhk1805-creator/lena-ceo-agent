#!/usr/bin/env node
// Gemini Analyze — Le Na CEO Agent
// Phan tich file PDF, hinh anh, tai lieu bang Gemini 2.0 Flash
// Context window 1M tokens — doc duoc file rat dai
//
// Usage:
//   node gemini-analyze.js "<file_path>" "[cau hoi/yeu cau]"
//
// Supported: PDF, PNG, JPG, JPEG, GIF, WEBP, TXT, CSV, DOCX
//
// Examples:
//   node gemini-analyze.js "/tmp/attachments/baocao.pdf"
//   node gemini-analyze.js "/tmp/attachments/baocao.pdf" "Tom tat noi dung chinh"
//   node gemini-analyze.js "/tmp/attachments/hoadon.jpg" "Doc so lieu tren hoa don"
//   node gemini-analyze.js "/tmp/attachments/banggia.png" "Liet ke gia tung san pham"

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
const userPrompt = process.argv[3] || 'Phan tich va tom tat noi dung file nay. Neu co so lieu, bang bieu thi trich xuat day du.';

if (!filePath) {
  console.log('Usage: node gemini-analyze.js "<file_path>" "[prompt]"');
  process.exit(1);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.log('Loi: Thieu GEMINI_API_KEY');
  process.exit(1);
}

// Map file extensions to MIME types
const MIME_MAP = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

async function analyze() {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`Loi: File khong ton tai: ${filePath}`);
      process.exit(1);
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext];

    if (!mimeType) {
      console.log(`Loi: Dinh dang khong ho tro: ${ext}. Ho tro: ${Object.keys(MIME_MAP).join(', ')}`);
      process.exit(1);
    }

    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString('base64');
    const fileSizeMB = (fileData.length / 1024 / 1024).toFixed(1);

    const systemPrompt = `Ban la tro ly AI cua cong ty NSCA/STARDUCT (nganh HVAC).
Nhiem vu: Phan tich tai lieu/hinh anh va tra loi bang tieng Viet.
Yeu cau:
- Tom tat NGAN GON, di thang vao noi dung chinh
- Neu co so lieu, bang bieu → trich xuat day du, trinh bay bang markdown
- Neu la hoa don/don hang → doc: ten san pham, so luong, don gia, tong tien, nguoi gui, ngay
- Neu la bao cao → tom tat: ket qua chinh, van de, de xuat
- Neu la hinh anh (anh chup, screenshot) → mo ta noi dung chinh xac
- Toi da 500 tu`;

    const requestBody = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          },
          {
            text: userPrompt
          }
        ]
      }],
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.3
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(`Loi Gemini API: ${res.status} — ${err}`);
      process.exit(1);
    }

    const data = await res.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const result = data.candidates[0].content.parts[0].text;
      console.log(`=== PHAN TICH FILE: ${path.basename(filePath)} (${fileSizeMB} MB) ===`);
      console.log(result);
    } else {
      console.log(JSON.stringify({ error: 'Khong co ket qua', response: data }, null, 2));
    }
  } catch (e) {
    console.log(`Loi: ${e.message}`);
    process.exit(1);
  }
}

analyze();
