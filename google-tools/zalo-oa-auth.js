// Zalo OA — Auth helper: read access_token + refresh khi expired (-220)
//
// Module dung chung — KHONG chay truc tiep. Import:
//   const auth = require('./zalo-oa-auth');
//   const token = auth.getAccessToken();
//   const fresh = await auth.refreshAccessToken();  // tra ve token moi hoac null
//
// Flow auto-refresh trong caller:
//   1. Goi API voi token hien tai
//   2. Neu error === -220 (token expired) → goi refreshAccessToken() → retry 1 lan
//
// Token storage: /root/.openclaw/zalo-oa-token.json (cung file voi zalo-oa-send.js).
// Refresh API: https://oauth.zaloapp.com/v4/oa/access_token (grant_type=refresh_token).

const fs = require('fs');

const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';

function readTokenFile() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function getAccessToken() {
  const data = readTokenFile();
  if (data && data.access_token) return data.access_token;
  return process.env.ZALO_OA_ACCESS_TOKEN || null;
}

function getRefreshToken() {
  const data = readTokenFile();
  if (data && data.refresh_token) return data.refresh_token;
  return process.env.ZALO_OA_REFRESH_TOKEN || null;
}

async function refreshAccessToken() {
  const APP_ID = process.env.ZALO_OA_APP_ID;
  const SECRET = process.env.ZALO_OA_SECRET;
  const REFRESH_TOKEN = getRefreshToken();

  if (!APP_ID || !SECRET || !REFRESH_TOKEN) {
    return { success: false, error: 'Missing ZALO_OA_APP_ID, ZALO_OA_SECRET, or refresh_token' };
  }

  const body = new URLSearchParams({
    refresh_token: REFRESH_TOKEN,
    app_id: APP_ID,
    grant_type: 'refresh_token'
  });

  let data;
  try {
    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'secret_key': SECRET,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    data = await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }

  if (!data.access_token) {
    return { success: false, error: data };
  }

  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      refreshed_at: new Date().toISOString(),
      expires_in: data.expires_in
    }, null, 2));
  } catch (e) {
    return { success: false, error: `Wrote refresh but failed to persist: ${e.message}`, access_token: data.access_token };
  }

  return { success: true, access_token: data.access_token, expires_in: data.expires_in };
}

// Zalo tra -220 khi access_token expired/removed.
function isTokenExpiredError(resp) {
  if (!resp) return false;
  const code = resp.error;
  return code === -220 || code === '-220';
}

module.exports = {
  TOKEN_FILE,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  isTokenExpiredError
};
