#!/usr/bin/env node
// Update KHKD 2026 Baseline with ACTUAL monthly targets from PKD
// Source: "Target tháng 2026 final.xlsx" — sheet "Điều chỉnh hợp lý tiến độ Target"
// Run once: railway run node google-tools/update-baseline.js

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SHEET_ID) {
  console.error('Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_SHEET_ID');
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token failed: ' + JSON.stringify(data));
  return data.access_token;
}

// Actual monthly targets from "Target tháng 2026 final.xlsx" (VND → tỷ VND)
// Columns: Ngành hàng, KH Năm, T1, T2, T3, KH Q1, T4, T5, T6, KH Q2, T7, T8, T9, KH Q3, T10, T11, T12, KH Q4
const BASELINE_DATA = [
  // Headers
  ['Nganh hang', 'KH Nam (ty)', 'T1', 'T2', 'T3', 'KH Q1', 'T4', 'T5', 'T6', 'KH Q2', 'T7', 'T8', 'T9', 'KH Q3', 'T10', 'T11', 'T12', 'KH Q4'],
  // Data rows (converted from VND to tỷ VND, rounded to 2 decimal)
  ['Cua gio noi dia',   '48.08', '2.87', '2.87', '2.87', '8.61',  '3.93', '3.93', '3.93', '11.78', '5.02', '5.02', '5.02', '15.06', '4.54', '4.04', '4.04', '12.62'],
  ['Van EI noi dia',    '90.96', '3.87', '3.87', '8.37', '16.11', '8.26', '8.76', '8.93', '25.95', '8.78', '8.78', '8.78', '26.33', '8.02', '7.02', '7.52', '22.56'],
  ['Van co khi noi dia','30.03', '1.76', '1.76', '2.76', '6.27',  '2.47', '2.47', '2.56', '7.50',  '2.58', '3.08', '2.58', '8.25',  '2.67', '2.67', '2.67', '8.01'],
  ['VAV/CAV',           '17.28', '0.50', '0.50', '0.50', '1.51',  '1.43', '1.43', '1.43', '4.29',  '1.69', '1.69', '1.69', '5.08',  '2.14', '2.14', '2.14', '6.41'],
  ['Tam nan sot trung', '18.40', '0.90', '1.00', '1.65', '3.55',  '1.65', '1.65', '1.65', '4.95',  '1.65', '1.65', '1.65', '4.95',  '1.65', '1.65', '1.65', '4.95'],
  ['Cua gio xuat khau', '27.70', '1.20', '2.00', '2.00', '5.20',  '2.50', '2.50', '2.50', '7.50',  '2.50', '2.50', '2.50', '7.50',  '2.50', '2.50', '2.50', '7.50'],
  ['Van EI xuat khau',  '10.45', '0.00', '0.50', '0.50', '1.00',  '1.05', '1.05', '1.05', '3.15',  '1.25', '1.25', '1.25', '3.75',  '0.85', '0.85', '0.85', '2.55'],
  ['Van co khi XK',     '4.70',  '0.25', '0.25', '0.42', '0.92',  '0.42', '0.42', '0.42', '1.26',  '0.42', '0.42', '0.42', '1.26',  '0.42', '0.42', '0.42', '1.26'],
  ['Thang mang cap',    '0',     '0',    '0',    '0',    '0',     '0',    '0',    '0',    '0',     '0',    '0',    '0',    '0',     '0',    '0',    '0',    '0'],
  ['Hang hoa khac',     '4.16',  '0.19', '0.19', '0.19', '0.57',  '0.35', '0.35', '0.35', '1.06',  '0.42', '0.42', '0.42', '1.26',  '0.42', '0.42', '0.42', '1.26'],
  // Totals
  ['TONG',              '251.75','11.54','12.94','19.26','43.75', '22.06','22.56','22.82','67.45', '24.31','24.81','24.31','73.44', '23.20','21.70','22.20','67.11']
];

async function main() {
  const token = await getAccessToken();

  // Clear old data and write new data
  const range = "'9. KHKD 2026 Baseline'!A1:R13";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values: BASELINE_DATA })
  });

  const result = await res.json();

  if (result.updatedCells) {
    console.log('========================================');
    console.log('THANH CONG! KHKD 2026 Baseline da cap nhat');
    console.log(`Updated: ${result.updatedRows} rows, ${result.updatedCells} cells`);
    console.log('');
    console.log('Thay doi chinh:');
    console.log('- Truoc: Chia deu moi thang = nam/12');
    console.log('- Sau: Phan bo theo tien do thuc te tu PKD');
    console.log('- Them cot KH Quy (Q1-Q4)');
    console.log('- Van EI ND T3 = 8.37 ty (khong phai 7.58 ty)');
    console.log('- Cua gio ND T7-T9 = 5.02 ty (cao nhat nam)');
    console.log('========================================');
  } else {
    console.log('THAT BAI:', JSON.stringify(result));
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
