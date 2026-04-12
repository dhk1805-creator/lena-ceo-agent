#!/usr/bin/env node
// Create Le Na CEO Dashboard — 18 Google Sheets
// Run once: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... node create-sheets.js

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN env vars');
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

const SHEETS_CONFIG = [
  {
    name: '1. CEO Daily Dashboard',
    headers: ['Ngay', 'Doanh thu ngay (ty)', 'Don hang moi', 'Email can xu ly', 'Hop hom nay', 'Van de noi bat', 'Action items', 'Trang thai'],
    color: { red: 0.2, green: 0.4, blue: 0.8 }
  },
  {
    name: '2. KPI Tracker',
    headers: ['Thang', 'DT Thuc te (ty)', 'DT KH (ty)', '% Dat', 'Don hang moi', 'Gia tri don moi (ty)', 'Cong no phai thu (ty)', 'DSO (ngay)', 'SL Nhom', 'SL Thep', 'Ty le loi %', 'Giao hang dung han %', 'Trang thai'],
    color: { red: 0.1, green: 0.6, blue: 0.3 }
  },
  {
    name: '3. Meeting Notes',
    headers: ['Ngay', 'Loai hop', 'Chu tri', 'Thanh phan', 'Noi dung chinh', 'Quyet dinh', 'Action items', 'Deadline', 'Phu trach', 'Trang thai'],
    color: { red: 0.5, green: 0.3, blue: 0.7 }
  },
  {
    name: '4. Market Research',
    headers: ['Ngay', 'Chu de', 'Nguon', 'Tom tat', 'Insight chinh', 'Anh huong NSCA', 'De xuat', 'Trang thai'],
    color: { red: 0.8, green: 0.5, blue: 0.2 }
  },
  {
    name: '5. Email Action Log',
    headers: ['Ngay', 'Tu', 'Den', 'Chu de', 'Phan loai', 'Tom tat', 'Action can lam', 'Deadline', 'Trang thai', 'Ghi chu'],
    color: { red: 0.9, green: 0.3, blue: 0.3 }
  },
  {
    name: '6. Report Tracker',
    headers: ['Tuan', 'Ngay bat dau', 'Ngay ket thuc', 'R&D', 'HCNS', 'PKD', 'BD Noi dia', 'BD Intl', 'Back Office', 'TCKT', 'GD NM', 'SX Thep', 'Co Dien', 'QAQC', 'Kho', 'Giao Hang', 'Cung Ung', 'Tong nop', 'Ghi chu'],
    color: { red: 0.3, green: 0.7, blue: 0.5 }
  },
  {
    name: '7. Attachment Analysis',
    headers: ['Ngay', 'Email', 'Ten file', 'Loai file', 'Kich thuoc', 'Tom tat noi dung', 'Phan loai', 'Action', 'Trang thai'],
    color: { red: 0.6, green: 0.4, blue: 0.4 }
  },
  {
    name: '8. Activity Log',
    headers: ['Timestamp', 'Agent', 'Hanh dong', 'Kenh', 'Doi tuong', 'Chi tiet', 'Ket qua', 'Ghi chu'],
    color: { red: 0.4, green: 0.4, blue: 0.6 }
  },
  {
    name: '9. KHKD 2026 Baseline',
    headers: ['Nganh hang', 'KH Nam (ty)', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
    color: { red: 0.2, green: 0.6, blue: 0.8 },
    data: [
      ['Cua gio noi dia', '48.08', '4.01', '4.01', '4.01', '4.01', '4.01', '4.01', '4.01', '4.01', '4.01', '4.01', '4.01', '4.01'],
      ['Van EI noi dia', '90.96', '7.58', '7.58', '7.58', '7.58', '7.58', '7.58', '7.58', '7.58', '7.58', '7.58', '7.58', '7.58'],
      ['Van co khi noi dia', '30.03', '2.50', '2.50', '2.50', '2.50', '2.50', '2.50', '2.50', '2.50', '2.50', '2.50', '2.50', '2.50'],
      ['VAV/CAV', '17.28', '1.44', '1.44', '1.44', '1.44', '1.44', '1.44', '1.44', '1.44', '1.44', '1.44', '1.44', '1.44'],
      ['Tam nan sot trung', '18.40', '1.53', '1.53', '1.53', '1.53', '1.53', '1.53', '1.53', '1.53', '1.53', '1.53', '1.53', '1.53'],
      ['Cua gio xuat khau', '27.70', '2.31', '2.31', '2.31', '2.31', '2.31', '2.31', '2.31', '2.31', '2.31', '2.31', '2.31', '2.31'],
      ['Van EI xuat khau', '10.45', '0.87', '0.87', '0.87', '0.87', '0.87', '0.87', '0.87', '0.87', '0.87', '0.87', '0.87', '0.87'],
      ['Van co khi xuat khau', '4.70', '0.39', '0.39', '0.39', '0.39', '0.39', '0.39', '0.39', '0.39', '0.39', '0.39', '0.39', '0.39'],
      ['Thang mang cap', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
      ['Hang hoa khac', '4.16', '0.35', '0.35', '0.35', '0.35', '0.35', '0.35', '0.35', '0.35', '0.35', '0.35', '0.35', '0.35'],
      ['TONG', '251.76', '20.98', '20.98', '20.98', '20.98', '20.98', '20.98', '20.98', '20.98', '20.98', '20.98', '20.98', '20.98']
    ]
  },
  {
    name: '10. NPP Tracker',
    headers: ['Thang', 'NTK DT (ty)', 'NTK KH', 'NTK %', 'GALAXY DT', 'GALAXY KH', 'GALAXY %', 'VNMEP DT', 'VNMEP KH', 'VNMEP %', 'IMP DT', 'IMP KH', 'IMP %', 'MEPCO DT', 'MEPCO KH', 'MEPCO %', 'Tong DT', 'Tong KH', 'Tong %'],
    color: { red: 0.7, green: 0.5, blue: 0.1 }
  },
  {
    name: '11. Variance Log',
    headers: ['Ngay', 'Thang', 'Nganh hang', 'KH (ty)', 'Thuc te (ty)', 'Variance (ty)', 'Variance %', 'Nguyen nhan', 'De xuat', 'Trang thai'],
    color: { red: 0.8, green: 0.2, blue: 0.2 }
  },
  {
    name: '12. ClimaNexus KPI',
    headers: ['Thang', 'Revenue ($K)', 'Users', 'MRR ($)', 'Burn rate ($K)', 'Runway (thang)', 'Dev velocity', 'Bugs', 'Uptime %', 'Ghi chu'],
    color: { red: 0.1, green: 0.8, blue: 0.8 }
  },
  {
    name: '13. ClimaNexus Milestones',
    headers: ['Milestone', 'Mo ta', 'Owner', 'Start date', 'ETA', 'Actual', 'Trang thai', 'Blockers', 'Ghi chu'],
    color: { red: 0.2, green: 0.7, blue: 0.7 }
  },
  {
    name: '14. ClimaNexus Pipeline',
    headers: ['VC/Investor', 'Contact', 'Stage', 'Amount ($K)', 'Win %', 'First meeting', 'Last contact', 'Next step', 'Deadline', 'Trang thai', 'Ghi chu'],
    color: { red: 0.3, green: 0.6, blue: 0.7 }
  },
  {
    name: '15. Export Revenue',
    headers: ['Thang', 'EAL ($K)', 'Quiet Cool ($K)', 'Indonesia ($K)', 'Malaysia ($K)', 'Cambodia ($K)', 'Philippines ($K)', 'Uruguay ($K)', 'Khac ($K)', 'Tong ($K)', 'Target ($K)', '% Dat'],
    color: { red: 0.6, green: 0.2, blue: 0.6 }
  },
  {
    name: '16. International Pipeline',
    headers: ['Lead', 'Thi truong', 'Khu vuc', 'San pham', 'Gia tri ($K)', 'Stage', 'Win %', 'Weighted ($K)', 'Contact', 'Next step', 'ETA', 'Owner', 'Ghi chu'],
    color: { red: 0.5, green: 0.2, blue: 0.7 }
  },
  {
    name: '17. Santiago KPI',
    headers: ['Tuan', 'Meetings', 'New leads', 'Proposals sent', 'Proposals value ($K)', 'Closed deals', 'Closed value ($K)', 'Pipeline ($K)', 'Conversion %', 'Ghi chu'],
    color: { red: 0.7, green: 0.3, blue: 0.5 }
  },
  {
    name: '18. Intl Market Log',
    headers: ['Ngay', 'Thi truong', 'Loai', 'Chi tiet', 'Nguon', 'Impact', 'Action', 'Owner', 'Deadline', 'Trang thai'],
    color: { red: 0.4, green: 0.3, blue: 0.8 }
  }
];

async function main() {
  const token = await getAccessToken();

  // Step 1: Create spreadsheet with all sheets
  const createBody = {
    properties: { title: 'Le Na CEO Dashboard — NSCA 2026' },
    sheets: SHEETS_CONFIG.map((s, i) => ({
      properties: {
        sheetId: i,
        title: s.name,
        tabColor: s.color,
        gridProperties: { frozenRowCount: 1 }
      }
    }))
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody)
  });

  const sheet = await createRes.json();
  if (!sheet.spreadsheetId) {
    console.error('Failed to create:', JSON.stringify(sheet));
    process.exit(1);
  }

  const spreadsheetId = sheet.spreadsheetId;
  console.log(`\nSpreadsheet created: ${spreadsheetId}`);
  console.log(`URL: ${sheet.spreadsheetUrl}\n`);

  // Step 2: Write headers + data
  const valueRanges = [];
  for (const s of SHEETS_CONFIG) {
    // Headers
    valueRanges.push({ range: `'${s.name}'!A1`, values: [s.headers] });
    // Data rows
    if (s.data) {
      valueRanges.push({ range: `'${s.name}'!A2`, values: s.data });
    }
  }

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: valueRanges })
    }
  );

  const batchResult = await batchRes.json();

  // Step 3: Format headers (bold, background color)
  const formatRequests = SHEETS_CONFIG.map((s, i) => ({
    repeatCell: {
      range: { sheetId: i, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.9, green: 0.9, blue: 0.95 },
          textFormat: { bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
    }
  }));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: formatRequests })
  });

  console.log('========================================');
  console.log('THANH CONG! Google Sheets da tao xong');
  console.log('========================================');
  console.log(`Spreadsheet ID: ${spreadsheetId}`);
  console.log(`URL: ${sheet.spreadsheetUrl}`);
  console.log(`Sheets: ${SHEETS_CONFIG.length}`);
  console.log('========================================');
  console.log(`\nChay lenh nay de luu vao Railway:`);
  console.log(`railway variables set GOOGLE_SHEET_ID="${spreadsheetId}"`);
  console.log('========================================\n');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
