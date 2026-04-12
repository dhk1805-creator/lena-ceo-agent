#!/usr/bin/env node
// Share Google Sheets with department heads for data input
// Run once: railway run node google-tools/share-sheets.js

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SHEET_ID) {
  console.error('Set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_SHEET_ID');
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

// Department heads who need EDIT access to input data
const EDITORS = [
  { email: 'ndao@nsca.vn',     name: 'Anh Ngoc - PKD',          role: 'writer' },  // KPI Tracker, NPP Tracker
  { email: 'duannt@nsca.vn',   name: 'Anh Duan - TCKT',         role: 'writer' },  // KPI Tracker (financials)
  { email: 'ductm@nsca.vn',    name: 'Anh Duc - BD Noi dia',    role: 'writer' },  // NPP Tracker
  { email: 'santiago@nsca.vn', name: 'Santiago - BD Intl',       role: 'writer' },  // Export Revenue, Intl Pipeline
  { email: 'ngocnv@nsca.vn',   name: 'Anh Ngoc - GD NM',        role: 'writer' },  // KPI Tracker (production)
  { email: 'tunghm@nsca.vn',   name: 'Anh Tung - SX Thep',      role: 'writer' },  // KPI Tracker (production)
];

// Department heads who need VIEW access to see dashboards
const VIEWERS = [
  { email: 'namph@nsca.vn',    name: 'Anh Nam - R&D',           role: 'reader' },
  { email: 'sondv@nsca.vn',    name: 'Anh Son - HCNS',          role: 'reader' },
  { email: 'tamntt@nsca.vn',   name: 'Chi Tam - Back Office',   role: 'reader' },
  { email: 'phongdv@nsca.vn',  name: 'Anh Phong - Co Dien',     role: 'reader' },
  { email: 'tuannl@nsca.vn',   name: 'Anh Tuan - QAQC',         role: 'reader' },
  { email: 'hant@nsca.vn',     name: 'Chi Ha - Kho',            role: 'reader' },
  { email: 'ducvt@nsca.vn',    name: 'Anh Duc - Giao Hang',     role: 'reader' },
  { email: 'anhdtk@nsca.vn',   name: 'Chi Kim Anh - Cung Ung',  role: 'reader' },
];

async function main() {
  const token = await getAccessToken();
  const allUsers = [...EDITORS, ...VIEWERS];

  console.log(`Sharing spreadsheet ${SHEET_ID} with ${allUsers.length} users...\n`);

  for (const user of allUsers) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${SHEET_ID}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'user',
            role: user.role,
            emailAddress: user.email
          })
        }
      );
      const result = await res.json();
      const status = result.id ? 'OK' : 'FAIL';
      const roleLabel = user.role === 'writer' ? 'EDIT' : 'VIEW';
      console.log(`[${status}] ${roleLabel} — ${user.name} (${user.email})`);
      if (!result.id) console.log(`  Error: ${JSON.stringify(result.error || result)}`);
    } catch (e) {
      console.log(`[FAIL] ${user.name}: ${e.message}`);
    }
  }

  console.log('\n========================================');
  console.log('HOAN TAT! Quyen truy cap da cap nhat');
  console.log('========================================');
  console.log('\nEDIT access (nhap so lieu):');
  EDITORS.forEach(u => console.log(`  ${u.name} — ${u.email}`));
  console.log('\nVIEW access (xem bao cao):');
  VIEWERS.forEach(u => console.log(`  ${u.name} — ${u.email}`));
  console.log('\nCEO (dhk@nsca.vn) — Owner (full access)');
  console.log('========================================');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
