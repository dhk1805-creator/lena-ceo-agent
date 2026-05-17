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

# === ZALO OA TOKEN — sync env -> volume file (fix stale cache after env update) ===
# Khi Sếp update ZALO_OA_ACCESS_TOKEN trên Railway, file /root/.openclaw/zalo-oa-token.json
# trên volume vẫn giữ token CŨ. getRefreshToken() ưu tiên file → refresh fail vì
# refresh_token cũ đã expired. Logic dưới detect mismatch và force overwrite từ env.
if [ -n "$ZALO_OA_ACCESS_TOKEN" ] && [ -n "$ZALO_OA_REFRESH_TOKEN" ]; then
  mkdir -p /root/.openclaw
  if [ -f /root/.openclaw/zalo-oa-token.json ]; then
    FILE_REFRESH=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('/root/.openclaw/zalo-oa-token.json','utf-8')).refresh_token||'')}catch(e){console.log('')}" 2>/dev/null)
    if [ "$FILE_REFRESH" != "$ZALO_OA_REFRESH_TOKEN" ]; then
      echo "[token-sync] Env refresh_token khac file cache — overwriting file (force fresh token)."
      node -e "
        const fs = require('fs');
        fs.writeFileSync('/root/.openclaw/zalo-oa-token.json', JSON.stringify({
          access_token: process.env.ZALO_OA_ACCESS_TOKEN,
          refresh_token: process.env.ZALO_OA_REFRESH_TOKEN,
          fetched_at: new Date().toISOString(),
          source: 'startup_env_force_sync'
        }, null, 2));
        console.log('[token-sync] File cache synced from env. access_token prefix: ' + process.env.ZALO_OA_ACCESS_TOKEN.substring(0, 10));
      "
    else
      echo "[token-sync] Env refresh_token khop file cache, khong can overwrite."
    fi
  else
    echo "[token-sync] No file cache yet, will be created on first refresh."
  fi
fi

# Start server directly (no OpenClaw, no proxy)
echo "=== Starting Le Na server on port ${PORT:-8080} ==="
exec node /app/proxy.js
