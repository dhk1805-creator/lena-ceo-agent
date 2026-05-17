#!/usr/bin/env node
require('./_env');
// Zalo OA Broadcast — gửi tin nhắn tới TẤT CẢ followers OA Starasia JSC
// Permission: CHỈ Sếp Khánh được phép trigger (kiểm tra ở proxy.js handler).
// Usage: node zalo-oa-broadcast.js "<message>" [--dry-run]

const fs = require('fs');
const FOLLOWERS_FILE = '/root/.openclaw/zalo-oa-followers.json';
const BROADCAST_LOG = '/root/.openclaw/zalo-broadcast-log.jsonl';
const RATE_LIMIT_MS = 200;
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';

const message = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!message) {
  console.log(JSON.stringify({ error: 'Usage: node zalo-oa-broadcast.js "<message>" [--dry-run]' }));
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

async function main() {
  let followers = [];
  try { followers = JSON.parse(fs.readFileSync(FOLLOWERS_FILE, 'utf-8')); } catch (e) {}

  if (!Array.isArray(followers) || followers.length === 0) {
    console.log(JSON.stringify({ error: 'No followers found in ' + FOLLOWERS_FILE }));
    return;
  }

  const total = followers.length;

  if (dryRun) {
    console.log(JSON.stringify({
      success: true,
      dry_run: true,
      total_followers: total,
      sample: followers.slice(0, 3).map(f => f.display_name || f.user_id),
      message_preview: message.substring(0, 100),
      estimated_duration_sec: Math.ceil(total * RATE_LIMIT_MS / 1000)
    }));
    return;
  }

  let token = getOAToken();
  if (!token) {
    console.log(JSON.stringify({ error: 'No OA access token' }));
    return;
  }

  const results = { total, sent: 0, failed: 0, errors: [], started_at: new Date().toISOString() };
  const start = Date.now();

  for (const f of followers) {
    const userId = f.user_id || f.id;
    if (!userId) continue;

    try {
      const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST',
        headers: { 'access_token': token, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          recipient: { user_id: userId },
          message: { text: message + '\n\nLê Na' }
        })
      });
      const data = await res.json();
      if (data.error === 0) {
        results.sent++;
        try {
          fs.appendFileSync(BROADCAST_LOG, JSON.stringify({
            ts: new Date().toISOString(), user_id: userId, name: f.display_name || '?', status: 'sent'
          }) + '\n');
        } catch (e) {}
      } else {
        results.failed++;
        results.errors.push({ user_id: userId, name: f.display_name || '?', error: data.error, message: data.message });
      }
    } catch (e) {
      results.failed++;
      results.errors.push({ user_id: userId, error: e.message });
    }
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  results.duration_sec = Math.round((Date.now() - start) / 1000);
  if (results.errors.length > 10) {
    results.errors = results.errors.slice(0, 10).concat([{ note: '... and ' + (results.errors.length - 10) + ' more errors truncated' }]);
  }
  console.log(JSON.stringify(results));
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
