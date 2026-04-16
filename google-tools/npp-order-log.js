#!/usr/bin/env node
// NPP Order Log — Le Na CEO Agent
// Tu dong quet email don hang tu 5 NPP va ghi vao Google Sheets
//
// Usage:
//   node npp-order-log.js [hours=24]
//
// Chuc nang:
//   1. Quet email tu 5 NPP (NTK, GALAXY, VNMEP, IMP, MEPCO)
//   2. Dung Gemini Flash phan tich noi dung email → trich xuat don hang
//   3. Ghi vao sheet "NPP Orders" trong Google Sheets
//
// Cot trong sheet NPP Orders:
//   A: Ngay | B: NPP | C: Nguoi gui | D: San pham | E: So luong | F: Ghi chu | G: Email ID | H: Trang thai

const hours = parseInt(process.argv[2] || '24');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!GEMINI_API_KEY) {
  console.log('Loi: Thieu GEMINI_API_KEY');
  process.exit(1);
}

if (!SHEET_ID) {
  console.log('Loi: Thieu GOOGLE_SHEET_ID');
  process.exit(1);
}

// 5 NPP email domains/addresses
const NPP_CONFIG = [
  { name: 'NTK', keywords: ['ntk', 'NTK'], rank: 'A' },
  { name: 'GALAXY', keywords: ['galaxy', 'GALAXY'], rank: 'B' },
  { name: 'VNMEP', keywords: ['vnmep', 'VNMEP'], rank: 'B' },
  { name: 'IMP', keywords: ['imp', 'IMP'], rank: 'C' },
  { name: 'MEPCO', keywords: ['mepco', 'MEPCO'], rank: 'C' },
];

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get Google token');
  return data.access_token;
}

async function searchEmails(token, query, maxResults = 20) {
  const after = Math.floor((Date.now() - hours * 3600000) / 1000);
  const fullQuery = `${query} after:${after}`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(fullQuery)}&maxResults=${maxResults}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.messages || [];
}

async function getMessage(token, messageId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

function getHeader(headers, name) {
  return (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function getBody(payload) {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
      }
    }
    for (const part of payload.parts) {
      const result = getBody(part);
      if (result) return result;
    }
  }
  return '';
}

function identifyNPP(from, subject, body) {
  const text = `${from} ${subject} ${body}`.toUpperCase();
  for (const npp of NPP_CONFIG) {
    for (const kw of npp.keywords) {
      if (text.includes(kw.toUpperCase())) return npp;
    }
  }
  return null;
}

async function analyzeWithGemini(emailContent, from, subject) {
  const prompt = `Phan tich email don hang/dat hang sau va trich xuat thong tin:

TU: ${from}
CHU DE: ${subject}
NOI DUNG:
${emailContent.substring(0, 3000)}

Tra ve JSON (KHONG markdown, chi JSON thuan):
{
  "is_order": true/false,
  "products": [
    {"name": "ten san pham", "quantity": "so luong", "unit": "don vi (cai/bo/m/kg)"}
  ],
  "notes": "ghi chu ngan gon (deadline, yeu cau dac biet)",
  "sender_name": "ten nguoi gui"
}

Neu email KHONG PHAI don hang/dat hang/bao gia → tra ve {"is_order": false}
Don hang bao gom: dat hang, order, PO, bao gia, yeu cau gia, request quotation, mua hang`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
      })
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) { /* parse error */ }
  return null;
}

async function appendToSheet(token, rows) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/NPP%20Orders!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rows })
  });
  return res.json();
}

async function main() {
  const token = await getAccessToken();

  // Search for emails from NPP-related senders
  const query = 'subject:(don hang OR dat hang OR order OR PO OR bao gia OR quotation) OR from:(ntk OR galaxy OR vnmep OR imp OR mepco)';
  const messages = await searchEmails(token, query, 30);

  if (messages.length === 0) {
    console.log(JSON.stringify({
      success: true,
      ordersFound: 0,
      message: `Khong co email don hang tu NPP trong ${hours} gio qua`
    }));
    return;
  }

  const orders = [];
  const today = new Date().toLocaleDateString('vi-VN');

  for (const msg of messages) {
    const message = await getMessage(token, msg.id);
    const headers = message.payload?.headers || [];
    const from = getHeader(headers, 'From');
    const subject = getHeader(headers, 'Subject');
    const body = getBody(message.payload || {});

    const npp = identifyNPP(from, subject, body);
    if (!npp) continue;

    // Use Gemini to analyze email content
    const analysis = await analyzeWithGemini(body, from, subject);
    if (!analysis || !analysis.is_order) continue;

    // Create rows for each product
    for (const product of (analysis.products || [])) {
      orders.push([
        today,                              // A: Ngay
        npp.name,                           // B: NPP
        analysis.sender_name || from,       // C: Nguoi gui
        product.name || '',                 // D: San pham
        `${product.quantity || ''} ${product.unit || ''}`.trim(), // E: So luong
        analysis.notes || '',               // F: Ghi chu
        msg.id,                             // G: Email ID
        'Moi'                               // H: Trang thai
      ]);
    }
  }

  if (orders.length > 0) {
    const result = await appendToSheet(token, orders);
    console.log(JSON.stringify({
      success: true,
      ordersFound: orders.length,
      nppBreakdown: orders.reduce((acc, row) => {
        acc[row[1]] = (acc[row[1]] || 0) + 1;
        return acc;
      }, {}),
      sheetResult: result.updates ? {
        updatedRange: result.updates.updatedRange,
        updatedRows: result.updates.updatedRows
      } : result,
      orders: orders.map(o => ({
        ngay: o[0], npp: o[1], nguoiGui: o[2],
        sanPham: o[3], soLuong: o[4], ghiChu: o[5]
      }))
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      success: true,
      ordersFound: 0,
      emailsScanned: messages.length,
      message: `Da quet ${messages.length} email, khong tim thay don hang tu NPP`
    }));
  }
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
