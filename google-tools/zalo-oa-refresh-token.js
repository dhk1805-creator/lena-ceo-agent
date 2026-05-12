#!/usr/bin/env node
require('./_env');
// Zalo OA — Refresh Access Token (expire 25h, refresh trước khi hết hạn)
// Usage: node zalo-oa-refresh-token.js
//
// Yêu cầu env vars:
//   ZALO_OA_APP_ID, ZALO_OA_SECRET, ZALO_OA_REFRESH_TOKEN
//
// Output:
//   { access_token, refresh_token, expires_in } — token mới
//   → Update Railway env vars: ZALO_OA_ACCESS_TOKEN + ZALO_OA_REFRESH_TOKEN

const fs = require('fs');
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';

const APP_ID = process.env.ZALO_OA_APP_ID;
const SECRET = process.env.ZALO_OA_SECRET;

function getRefreshToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.refresh_token) return data.refresh_token;
    }
  } catch (e) {}
  return process.env.ZALO_OA_REFRESH_TOKEN;
}

const REFRESH_TOKEN = getRefreshToken();

if (!APP_ID || !SECRET || !REFRESH_TOKEN) {
  console.error(JSON.stringify({ success: false, error: 'Missing: ZALO_OA_APP_ID, ZALO_OA_SECRET, or refresh token (file/env)' }));
  process.exit(1);
}

async function refreshToken() {
  const url = 'https://oauth.zaloapp.com/v4/oa/access_token';
  const body = new URLSearchParams({
    refresh_token: REFRESH_TOKEN,
    app_id: APP_ID,
    grant_type: 'refresh_token'
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'secret_key': SECRET,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = await res.json();

  if (data.access_token) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      refreshed_at: new Date().toISOString(),
      expires_in: data.expires_in
    }, null, 2));
    console.log(JSON.stringify({
      success: true,
      saved_to: TOKEN_FILE,
      expires_in: data.expires_in
    }, null, 2));
  } else {
    console.error(JSON.stringify({ success: false, error: data }, null, 2));
    process.exit(1);
  }
}

refreshToken().catch(e => {
  console.error(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
