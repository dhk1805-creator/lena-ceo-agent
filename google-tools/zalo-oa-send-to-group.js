#!/usr/bin/env node
require('./_env');
// Zalo OA Send to Group — gửi tin nhắn cho 1 nhóm BP (PKD, QLSX, TCKT, RD, HCNS, NPP)
// Usage: node zalo-oa-send-to-group.js <BP_NAME> "<message>" [--dry-run]
//
// Logic:
//   1. Parse directory.md → tìm tất cả staff thuộc BP đó
//   2. Lookup Zalo ID từ /root/.openclaw/zalo-oa-staff.json (reverse map)
//   3. Gửi 1-1 cho từng người đã pair Zalo
//
// Examples:
//   node zalo-oa-send-to-group.js PKD "PKD họp 16h chiều nay tại VP HN"
//   node zalo-oa-send-to-group.js QLSX "Họp giao ban 8h sáng mai"

const fs = require('fs');
const STAFF_ZALO_FILE = '/root/.openclaw/zalo-oa-staff.json';
const DIRECTORY_FILE = '/app/workspace/memory/directory.md';
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';
const RATE_LIMIT_MS = 200;

const bp = process.argv[2];
const message = process.argv[3];
const dryRun = process.argv.includes('--dry-run');

if (!bp || !message) {
  console.log(JSON.stringify({ error: 'Usage: node zalo-oa-send-to-group.js <BP_NAME> "<message>" [--dry-run]' }));
  process.exit(1);
}

function getOAToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.access_token) return data.access_token;
    }
  } catch (e) {}
  return process.env.ZALO_OA_ACCESS_TOKEN;
}

function loadStaffByBP(bpName) {
  const bpUpper = bpName.toUpperCase().trim();
  let dir = '';
  try { dir = fs.readFileSync(DIRECTORY_FILE, 'utf-8'); } catch (e) { return []; }
  let staffMap = {};
  try { staffMap = JSON.parse(fs.readFileSync(STAFF_ZALO_FILE, 'utf-8')); } catch (e) {}

  // Reverse map: email → zaloId
  const emailToZalo = {};
  for (const [zid, em] of Object.entries(staffMap)) {
    emailToZalo[em.toLowerCase()] = zid;
  }

  const lines = dir.split('\n');
  const matched = [];

  for (const line of lines) {
    const cols = line.split('|').map(s => s.trim());
    if (cols.length < 7) continue;
    const id = cols[1];
    const name = cols[2];
    const lineBP = cols[4];
    const emailRaw = cols[5] || '';
    const email = emailRaw.replace(/<|>/g, '').toLowerCase().trim();

    if (!email || !email.includes('@')) continue;

    // Match BP: prefix in ID (vd "PKD01" matches "PKD") or BP column contains
    const idPrefix = id.toUpperCase().replace(/\d+$/, '');
    if (idPrefix === bpUpper || lineBP.toUpperCase().includes(bpUpper)) {
      const zaloId = emailToZalo[email] || null;
      matched.push({ id, name, email, bp: lineBP, zalo_id: zaloId, paired: !!zaloId });
    }
  }

  return matched;
}

async function main() {
  const staff = loadStaffByBP(bp);
  const paired = staff.filter(s => s.paired);
  const unpaired = staff.filter(s => !s.paired);

  if (staff.length === 0) {
    console.log(JSON.stringify({ error: 'Không tìm thấy nhân viên BP "' + bp + '" trong directory.md' }));
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({
      success: true,
      dry_run: true,
      bp,
      total_in_directory: staff.length,
      paired_zalo: paired.length,
      unpaired: unpaired.map(s => ({ name: s.name, email: s.email })),
      will_send_to: paired.map(s => s.name),
      message_preview: message.substring(0, 100)
    }));
    return;
  }

  if (paired.length === 0) {
    console.log(JSON.stringify({
      error: 'Không ai trong BP ' + bp + ' đã pair Zalo OA',
      hint: 'Yêu cầu nhân viên gửi "Tôi là <email>@nsca.vn" vào OA Starasia JSC để đăng ký.',
      unpaired: unpaired.map(s => s.name)
    }));
    return;
  }

  const token = getOAToken();
  if (!token) {
    console.log(JSON.stringify({ error: 'No OA access token' }));
    return;
  }

  const results = { bp, total: paired.length, sent: 0, failed: 0, recipients: [], unpaired: unpaired.map(s => s.name) };

  for (const s of paired) {
    try {
      const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST',
        headers: { 'access_token': token, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          recipient: { user_id: s.zalo_id },
          message: { text: message + '\n\nLê Na' }
        })
      });
      const data = await res.json();
      if (data.error === 0) {
        results.sent++;
        results.recipients.push({ name: s.name, email: s.email, status: 'sent' });
      } else {
        results.failed++;
        results.recipients.push({ name: s.name, email: s.email, status: 'failed', error: data.message });
      }
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (e) {
      results.failed++;
      results.recipients.push({ name: s.name, status: 'failed', error: e.message });
    }
  }

  console.log(JSON.stringify(results));
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
