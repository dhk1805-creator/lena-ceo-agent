#!/usr/bin/env node
// Zalo OA — Refresh Access Token (expire 25h, refresh trước khi hết hạn)
// Usage: node zalo-oa-refresh-token.js
//
// Yêu cầu env vars:
//   ZALO_OA_APP_ID, ZALO_OA_SECRET, ZALO_OA_REFRESH_TOKEN
//
// Output:
//   { access_token, refresh_token, expires_in } — token mới
//   → Update Railway env vars: ZALO_OA_ACCESS_TOKEN + ZALO_OA_REFRESH_TOKEN

const APP_ID = process.env.ZALO_OA_APP_ID;
const SECRET = process.env.ZALO_OA_SECRET;
const REFRESH_TOKEN = process.env.ZALO_OA_REFRESH_TOKEN;

if (!APP_ID || !SECRET || !REFRESH_TOKEN) {
  console.error(JSON.stringify({ success: false, error: 'Missing env vars: ZALO_OA_APP_ID, ZALO_OA_SECRET, ZALO_OA_REFRESH_TOKEN' }));
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
    console.log(JSON.stringify({
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    }, null, 2));
    // NOTE: Auto-update Railway env vars via CLI requires manual step
    // Or: store on volume + script reads from file (not env var)
  } else {
    console.error(JSON.stringify({ success: false, error: data }, null, 2));
    process.exit(1);
  }
}

refreshToken().catch(e => {
  console.error(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
