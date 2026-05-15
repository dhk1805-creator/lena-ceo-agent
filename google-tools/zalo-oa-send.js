#!/usr/bin/env node
require('./_env');
// Last updated: 2026-05-12 — tested via GitHub Actions pipeline
// Zalo OA — gửi tin nhắn qua Official Account "Starasia JSC"
// Usage:
//   node zalo-oa-send.js <target> "<message>"
//   node zalo-oa-send.js list-followers
//
// Target có thể là:
//   - VIP name: "sep-khanh", "chi-hong", "anh-ngoc"
//   - User ID raw: "6869834949444296385"
//
// Env vars:
//   ZALO_OA_ACCESS_TOKEN  (required)
//   ZALO_OA_USER_SEP_KHANH, ZALO_OA_USER_CHI_HONG, ZALO_OA_USER_ANH_NGOC (mapping VIP)
//
// Tin nhắn TỰ ĐỘNG được format:
//   [Lê Na] <message>
//   — Đào Thị Lê Na

const fs = require('fs');
const auth = require('./zalo-oa-auth');
const DEDUP_LOG = '/root/.openclaw/zalo-send-dedup.json';
const DEDUP_WINDOW = 60 * 1000; // 60 seconds per target

let ACCESS_TOKEN = auth.getAccessToken();

if (!ACCESS_TOKEN) {
  console.error(JSON.stringify({ success: false, error: 'No OA access token (file or env var)' }));
  process.exit(1);
}

// Issue #52: Token Zalo OA expire 25h → -216/-220. Auto-refresh va retry 1 lan.
async function withTokenRefresh(fn) {
  let resp = await fn();
  if (auth.isTokenExpiredError(resp)) {
    const refreshed = await auth.refreshAccessToken();
    if (refreshed.success && refreshed.access_token) {
      ACCESS_TOKEN = refreshed.access_token;
      resp = await fn();
      resp = { ...resp, _token_refreshed: true };
    } else {
      resp = { ...resp, _refresh_failed: refreshed.error };
    }
  }
  return resp;
}

// Map VIP alias → env var name
const VIP_MAP = {
  'sep-khanh': 'ZALO_OA_USER_SEP_KHANH',
  'sep': 'ZALO_OA_USER_SEP_KHANH',
  'khanh': 'ZALO_OA_USER_SEP_KHANH',
  'chi-hong': 'ZALO_OA_USER_CHI_HONG',
  'hong': 'ZALO_OA_USER_CHI_HONG',
  'anh-ngoc': 'ZALO_OA_USER_ANH_NGOC',
  'ngoc': 'ZALO_OA_USER_ANH_NGOC',
  'boc-beo': 'ZALO_OA_USER_ANH_NGOC',
};

function resolveTarget(target) {
  // If looks like raw user_id (long number)
  if (/^\d{15,}$/.test(target)) return target;

  // Map alias
  const envVar = VIP_MAP[target.toLowerCase()];
  if (envVar) {
    const userId = process.env[envVar];
    if (!userId) {
      throw new Error(`${envVar} env var not set — anh cần follow OA + nhắn 1 tin để lấy user_id`);
    }
    return userId;
  }

  throw new Error(`Không nhận diện được target "${target}". Dùng: sep-khanh, chi-hong, anh-ngoc, hoặc user_id raw`);
}

function formatMessage(message) {
  // Auto-format để rõ là Lê Na đang gửi qua OA Starasia JSC
  // Tránh repeat nếu tin đã có "[Lê Na]" hoặc "— Lê Na"
  let formatted = message.trim();

  if (!formatted.match(/^\[Lê Na\]|^Em Lê Na/i)) {
    formatted = `[Lê Na]\n${formatted}`;
  }

  if (!formatted.match(/— Lê Na$|- Lê Na$|Lê Na$/i)) {
    formatted = `${formatted}\n\n— Đào Thị Lê Na`;
  }

  return formatted;
}

async function listFollowers() {
  const url = 'https://openapi.zalo.me/v3.0/oa/user/getlist?data=' + encodeURIComponent(JSON.stringify({ offset: 0, count: 50 }));
  const data = await withTokenRefresh(async () => {
    const res = await fetch(url, { headers: { 'access_token': ACCESS_TOKEN } });
    return res.json();
  });

  if (data.error === 0 && data.data?.users) {
    // Get detail của từng user
    const users = await Promise.all(data.data.users.map(async u => {
      const detail = await withTokenRefresh(async () => {
        const detailRes = await fetch(`https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: u.user_id }))}`, {
          headers: { 'access_token': ACCESS_TOKEN }
        });
        return detailRes.json();
      });
      return {
        user_id: u.user_id,
        display_name: detail.data?.display_name || '(unknown)',
        last_interaction: detail.data?.user_last_interaction_date || '-'
      };
    }));
    console.log(JSON.stringify({ total: data.data.total, users }, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function checkDedup(userId) {
  let log = [];
  try {
    if (fs.existsSync(DEDUP_LOG)) log = JSON.parse(fs.readFileSync(DEDUP_LOG, 'utf-8'));
  } catch (e) { log = []; }
  const now = Date.now();
  log = log.filter(e => now - e.ts < 3600000);
  const recent = log.find(e => e.userId === userId && now - e.ts < DEDUP_WINDOW);
  if (recent) return { isDup: true, secsAgo: Math.round((now - recent.ts) / 1000) };
  return { isDup: false };
}

function recordSend(userId, target) {
  let log = [];
  try {
    if (fs.existsSync(DEDUP_LOG)) log = JSON.parse(fs.readFileSync(DEDUP_LOG, 'utf-8'));
  } catch (e) { log = []; }
  const now = Date.now();
  log = log.filter(e => now - e.ts < 3600000);
  log.push({ userId, target, ts: now });
  try { fs.writeFileSync(DEDUP_LOG, JSON.stringify(log)); } catch (e) {}
}

async function sendMessage(target, message) {
  let userId;
  try {
    userId = resolveTarget(target);
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
  }

  const dedup = checkDedup(userId);
  if (dedup.isDup) {
    console.log(JSON.stringify({
      success: true, skipped: true,
      reason: `DEDUP: Da gui cho ${target} ${dedup.secsAgo}s truoc. Bo qua de tranh spam. KHONG can gui lai.`,
      target, user_id: userId
    }));
    return;
  }

  const formattedMessage = formatMessage(message);

  const data = await withTokenRefresh(async () => {
    const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST',
      headers: {
        'access_token': ACCESS_TOKEN,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        recipient: { user_id: userId },
        message: { text: formattedMessage }
      })
    });
    return res.json();
  });

  if (data.error === 0) {
    recordSend(userId, target);
    console.log(JSON.stringify({
      success: true,
      message_id: data.data?.message_id,
      user_id: userId,
      target: target,
      preview: formattedMessage.substring(0, 100) + '...'
    }));
  } else {
    console.log(JSON.stringify({
      success: false,
      error_code: data.error,
      error_message: data.message,
      target: target,
      user_id: userId
    }));
    process.exit(1);
  }
}

async function main() {
  const cmd = process.argv[2];

  if (!cmd) {
    console.error('Usage:');
    console.error('  node zalo-oa-send.js <target> "<message>"');
    console.error('    target: sep-khanh | chi-hong | anh-ngoc | <user_id>');
    console.error('  node zalo-oa-send.js list-followers');
    process.exit(1);
  }

  if (cmd === 'list-followers') {
    await listFollowers();
    return;
  }

  const message = process.argv[3];
  if (!message) {
    console.error('Missing message argument');
    process.exit(1);
  }

  await sendMessage(cmd, message);
}

main().catch(e => {
  console.error(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
