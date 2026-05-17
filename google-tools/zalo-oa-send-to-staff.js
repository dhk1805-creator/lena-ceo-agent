#!/usr/bin/env node
require('./_env');
// Zalo OA Send to Staff — gửi tin nhắn cho 1 nhân viên cụ thể trong directory.md
// Usage:
//   node zalo-oa-send-to-staff.js <email_or_zalo_id> "<message>"
//
// Lookup priority:
//   1. Email @nsca.vn → tìm Zalo ID trong /root/.openclaw/zalo-oa-staff.json (mapping reverse)
//   2. Raw Zalo ID (15+ digit) → dùng trực tiếp
//
// Nhân viên phải đã PAIR Zalo với OA Starasia JSC (đăng ký staff lần đầu qua "tôi là <email>@nsca.vn")
// thì mới gửi được.

const fs = require('fs');
const STAFF_ZALO_FILE = '/root/.openclaw/zalo-oa-staff.json';
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';

const target = process.argv[2];
const message = process.argv[3];

if (!target || !message) {
  console.log(JSON.stringify({ error: 'Usage: node zalo-oa-send-to-staff.js <email_or_zalo_id> "<message>"' }));
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

function resolveStaffZaloId(target) {
  // Already a raw Zalo ID (numeric, 15+ digits)
  if (/^\d{15,}$/.test(target)) return { zaloId: target, email: null };

  // Lookup by email
  let map = {};
  try { map = JSON.parse(fs.readFileSync(STAFF_ZALO_FILE, 'utf-8')); } catch (e) {}

  const targetLower = target.toLowerCase();
  // staffMap: { zalo_id: email }
  for (const [zaloId, email] of Object.entries(map)) {
    if (email.toLowerCase() === targetLower) return { zaloId, email };
  }
  return { zaloId: null, email: targetLower };
}

async function main() {
  const { zaloId, email } = resolveStaffZaloId(target);
  if (!zaloId) {
    console.log(JSON.stringify({
      error: 'Không tìm thấy Zalo ID đã pair cho "' + target + '"',
      hint: 'Nhân viên cần nhắn vào OA Starasia JSC lần đầu với "Tôi là <email>@nsca.vn" để đăng ký.'
    }));
    return;
  }

  const token = getOAToken();
  if (!token) {
    console.log(JSON.stringify({ error: 'No OA access token' }));
    return;
  }

  try {
    const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST',
      headers: { 'access_token': token, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        recipient: { user_id: zaloId },
        message: { text: message + '\n\nLê Na' }
      })
    });
    const data = await res.json();
    if (data.error === 0) {
      console.log(JSON.stringify({
        success: true,
        target,
        email: email,
        zalo_id: zaloId,
        message_preview: message.substring(0, 60)
      }));
    } else {
      console.log(JSON.stringify({
        success: false,
        error_code: data.error,
        error_message: data.message,
        target,
        zalo_id: zaloId
      }));
    }
  } catch (e) {
    console.log(JSON.stringify({ error: e.message }));
  }
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
