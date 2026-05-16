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

# Start server directly (no OpenClaw, no proxy)
echo "=== Starting Le Na server on port ${PORT:-8080} ==="
exec node /app/proxy.js
