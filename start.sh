#!/bin/bash
# ============================================================
# DAO THI LE NA - Railway Startup (no OpenClaw)
# ============================================================

echo "=== Le Na CEO Agent - Starting on Railway ==="
export TZ=Asia/Ho_Chi_Minh

# === PERSISTENT VOLUME ===
mkdir -p /root/.openclaw/workspace/skills /root/.openclaw/workspace/memory
mkdir -p /root/.openclaw/zalo-oa-sessions

# Copy workspace files to volume
cp -f /app/workspace/AGENTS.md /root/.openclaw/workspace/AGENTS.md 2>/dev/null
cp -rf /app/workspace/memory/* /root/.openclaw/workspace/memory/ 2>/dev/null
cp -rf /app/workspace/skills/* /root/.openclaw/workspace/skills/ 2>/dev/null

# === ZALO CREDENTIALS (Volume + env var fallback) ===
mkdir -p /root/.openclaw/credentials/zalouser
if [ -f /root/.openclaw/credentials/zalouser/credentials.json ]; then
  echo "Zalo credentials found on volume."
elif [ -n "$ZALO_CREDS_B64" ]; then
  echo "Restoring Zalo credentials from ZALO_CREDS_B64..."
  echo "$ZALO_CREDS_B64" | base64 -d > /root/.openclaw/credentials/zalouser/credentials.json
  echo "Zalo credentials restored ($(wc -c < /root/.openclaw/credentials/zalouser/credentials.json) bytes)"
else
  echo "WARNING: No Zalo credentials. Channel will be unconfigured."
fi

# === WRITE ENV VARS TO /app/.env.json (script fallback) ===
echo "Writing env vars to /app/.env.json..."
node -e "
const keys = [
  'GITHUB_TOKEN','GITHUB_REPO','GOOGLE_SHEET_ID',
  'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN','GOOGLE_REFRESH_TOKEN_LENA',
  'CLAUDE_API_KEY','GEMINI_API_KEY','OPENAI_API_KEY',
  'ZALO_OA_ACCESS_TOKEN','ZALO_OA_APP_ID','ZALO_OA_SECRET','ZALO_OA_REFRESH_TOKEN',
  'ZALO_OA_USER_SEP_KHANH','ZALO_OA_USER_CHI_HONG','ZALO_OA_USER_ANH_NGOC',
  'FACEBOOK_PAGE_TOKEN','FACEBOOK_PAGE_ID'
];
const env = {};
keys.forEach(k => { if (process.env[k]) env[k] = process.env[k]; });
require('fs').writeFileSync('/app/.env.json', JSON.stringify(env));
console.log('Wrote ' + Object.keys(env).length + ' env vars to /app/.env.json');
"

# === ZALO OA TOKEN — INIT ONLY (KHONG overwrite file neu da co) =================
# IMPORTANT LESSON 18/05/2026: Refresh_token Zalo la SINGLE-USE ROTATING. Moi lan
# refreshOAToken() goi, Zalo invalidate refresh_token cu va cap refresh_token MOI.
# File /root/.openclaw/zalo-oa-token.json luu refresh_token MOI NHAT.
# Env Railway (ZALO_OA_REFRESH_TOKEN) la refresh_token SEP DA PASTE — sau lan
# refresh dau tien thi env STALE (token cu da bi invalidate).
#
# Logic CU (PR #93, REMOVED): Moi container restart, neu env != file -> overwrite
# file bang env. -> BUG: overwrite refresh_token moi (file) bang token cu (env, da
# invalid) -> -14014 burn loop.
#
# Logic MOI: chi tao file tu env khi file CHUA TON TAI (lan dau deploy hoac sau
# khi admin xoa file thu cong qua endpoint /admin/force-token-reset).
if [ ! -f /root/.openclaw/zalo-oa-token.json ]; then
  if [ -n "$ZALO_OA_ACCESS_TOKEN" ] && [ -n "$ZALO_OA_REFRESH_TOKEN" ]; then
    mkdir -p /root/.openclaw
    echo "[token-sync] No file cache. Initializing from env (first run only)."
    node -e "
      const fs = require('fs');
      fs.writeFileSync('/root/.openclaw/zalo-oa-token.json', JSON.stringify({
        access_token: process.env.ZALO_OA_ACCESS_TOKEN,
        refresh_token: process.env.ZALO_OA_REFRESH_TOKEN,
        fetched_at: new Date().toISOString(),
        source: 'startup_env_init'
      }, null, 2));
      console.log('[token-sync] File initialized from env. access_token prefix: ' + process.env.ZALO_OA_ACCESS_TOKEN.substring(0, 10));
    "
  else
    echo "[token-sync] No file cache + no env vars. Token will be missing — first request will fail."
  fi
else
  echo "[token-sync] File cache exists. Trusting file (refresh_token rotates, env may be stale)."
  echo "[token-sync] To force reset: call POST /admin/force-token-reset?secret=\$ADMIN_SECRET"
fi


# Start server directly (no OpenClaw, no proxy)
echo "=== Starting Le Na server on port ${PORT:-8080} ==="
exec node /app/proxy.js
