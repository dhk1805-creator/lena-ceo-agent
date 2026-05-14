#!/bin/bash
# ============================================================
# DAO THI LE NA - OpenClaw Railway Startup
# ============================================================

echo "=== Le Na CEO Agent - Starting on Railway ==="
export TZ=Asia/Ho_Chi_Minh

# Railway provides PORT env (Express proxy listens here on PUBLIC port)
# OpenClaw runs on INTERNAL port (8090), proxy forwards all traffic
export FRONT_PORT="${PORT:-8080}"
export OPENCLAW_INTERNAL_PORT="8090"
export OPENCLAW_GATEWAY_PORT="$OPENCLAW_INTERNAL_PORT"
export OPENCLAW_GATEWAY_TOKEN="${GATEWAY_PASSWORD:-LeNa2026!}"

# === PERSISTENT VOLUME SYNC ===
echo "Syncing workspace files to persistent volume..."
mkdir -p /root/.openclaw/workspace/skills /root/.openclaw/workspace/memory
mkdir -p /root/.openclaw/agents/main/sessions
mkdir -p /root/.openclaw/credentials/zalouser

# Remove old date injection (prevents duplicates on restart)
sed -i -e '/^## NGAY GIO HIEN TAI:/d' -e '/^Moi thong tin ve ngay.*thang.*thu/d' -e '/^TUYET DOI KHONG tu doan ngay/d' /app/workspace/AGENTS.md

# Inject current date/time into AGENTS.md before copying
CURRENT_DATE=$(date '+%Y-%m-%d %H:%M %Z (%A)')
sed -i "1i\\
## NGAY GIO HIEN TAI: ${CURRENT_DATE}\\
Moi thong tin ve ngay/thang/nam/thu — LUON dung lenh: date '+%Y-%m-%d %H:%M %Z (%A)'\\
TUYET DOI KHONG tu doan ngay thang. Neu can biet ngay, PHAI chay lenh date.\\
" /app/workspace/AGENTS.md

# Always update AGENTS.md, MEMORY.md, skills (from Docker image)
cp -f /app/workspace/AGENTS.md /root/.openclaw/workspace/AGENTS.md 2>/dev/null
cp -f /app/workspace/MEMORY.md /root/.openclaw/workspace/MEMORY.md 2>/dev/null
cp -rf /app/workspace/skills/* /root/.openclaw/workspace/skills/ 2>/dev/null
cp -rf /app/workspace/memory/* /root/.openclaw/workspace/memory/ 2>/dev/null

# === ZALO CREDENTIALS (Volume + env var fallback) ===
mkdir -p /root/.openclaw/credentials/zalouser
if [ -f /root/.openclaw/credentials/zalouser/credentials.json ]; then
  echo "Zalo credentials found on volume. Channel ready."
elif [ -n "$ZALO_CREDS_B64" ]; then
  echo "No credentials on volume. Restoring from ZALO_CREDS_B64 env var..."
  echo "$ZALO_CREDS_B64" | base64 -d > /root/.openclaw/credentials/zalouser/credentials.json
  echo "Zalo credentials restored from env var ($(wc -c < /root/.openclaw/credentials/zalouser/credentials.json) bytes)"
else
  echo "WARNING: No Zalo credentials anywhere. Channel will be unconfigured."
fi

# Only clear sessions if AGENTS.md hash changed
AGENTS_HASH_FILE="/root/.openclaw/.agents-md-hash"
NEW_HASH=$(sha256sum /app/workspace/AGENTS.md 2>/dev/null | cut -d' ' -f1)
OLD_HASH=$(cat "$AGENTS_HASH_FILE" 2>/dev/null || echo "none")
if [ "$NEW_HASH" != "$OLD_HASH" ]; then
  echo "AGENTS.md changed. Clearing sessions..."
  rm -f /root/.openclaw/agents/main/sessions/*.jsonl /root/.openclaw/agents/main/sessions/sessions.json 2>/dev/null
  echo "$NEW_HASH" > "$AGENTS_HASH_FILE"
  echo "Sessions cleared"
else
  echo "AGENTS.md unchanged. Keeping sessions warm."
fi

echo "Workspace sync complete"

# === WRITE ENV VARS TO /app/.env.json USING BASH (not node) ===
# bash cat heredoc reads env vars from shell directly — 100% reliable
echo "Writing env vars to /app/.env.json..."
cat > /app/.env.json << ENVEOF
{
  "GITHUB_TOKEN": "${GITHUB_TOKEN}",
  "GITHUB_REPO": "${GITHUB_REPO}",
  "GOOGLE_SHEET_ID": "${GOOGLE_SHEET_ID}",
  "GOOGLE_CLIENT_ID": "${GOOGLE_CLIENT_ID}",
  "GOOGLE_CLIENT_SECRET": "${GOOGLE_CLIENT_SECRET}",
  "GOOGLE_REFRESH_TOKEN": "${GOOGLE_REFRESH_TOKEN}",
  "GOOGLE_REFRESH_TOKEN_LENA": "${GOOGLE_REFRESH_TOKEN_LENA}",
  "CLAUDE_API_KEY": "${CLAUDE_API_KEY}",
  "GEMINI_API_KEY": "${GEMINI_API_KEY}",
  "OPENAI_API_KEY": "${OPENAI_API_KEY}",
  "ZALO_OA_ACCESS_TOKEN": "${ZALO_OA_ACCESS_TOKEN}",
  "ZALO_OA_APP_ID": "${ZALO_OA_APP_ID}",
  "ZALO_OA_SECRET": "${ZALO_OA_SECRET}",
  "ZALO_OA_REFRESH_TOKEN": "${ZALO_OA_REFRESH_TOKEN}",
  "ZALO_OA_USER_SEP_KHANH": "${ZALO_OA_USER_SEP_KHANH}",
  "ZALO_OA_USER_CHI_HONG": "${ZALO_OA_USER_CHI_HONG}",
  "ZALO_OA_USER_ANH_NGOC": "${ZALO_OA_USER_ANH_NGOC}",
  "FACEBOOK_PAGE_TOKEN": "${FACEBOOK_PAGE_TOKEN}",
  "FACEBOOK_PAGE_ID": "${FACEBOOK_PAGE_ID}"
}
ENVEOF
echo "Wrote .env.json with bash heredoc (shell env vars guaranteed)"

# Verify key vars made it in
echo "Verify SEP_KHANH in .env.json: $(node -e "try{const e=JSON.parse(require('fs').readFileSync('/app/.env.json'));console.log(e.ZALO_OA_USER_SEP_KHANH||'MISSING')}catch(x){console.log('ERROR:'+x.message)}")"

# === CLEAN CORRUPTED PLUGIN CACHE ===
echo "Removing plugin runtime deps cache..."
rm -rf /root/.openclaw/plugin-runtime-deps 2>/dev/null
echo "Plugin cache cleared"

# Generate openclaw.json from environment variables
cat > /root/.openclaw/openclaw.json <<OCEOF
{
  "models": {
    "providers": {
      "anthropic": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "${CLAUDE_API_KEY}",
        "api": "anthropic-messages",
        "models": [
          { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "contextWindow": 200000, "maxTokens": 8192 },
          { "id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "contextWindow": 200000, "maxTokens": 8192 }
        ]
      },
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "${OPENAI_API_KEY}",
        "models": [
          { "id": "gpt-4o", "name": "GPT-4o", "contextWindow": 128000, "maxTokens": 4096 }
        ]
      },
      "google": {
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
        "apiKey": "${GEMINI_API_KEY}",
        "api": "google-generative-ai",
        "models": [
          { "id": "gemini-2.0-flash", "name": "Gemini Flash", "contextWindow": 1048576, "maxTokens": 8192 }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-haiku-4-5-20251001"
    }
  },
  "gateway": {
    "mode": "local",
    "port": ${OPENCLAW_GATEWAY_PORT},
    "bind": "lan",
    "controlUi": {
      "allowedOrigins": ["https://${RAILWAY_PUBLIC_DOMAIN}", "https://lena-ceo-agent-production.up.railway.app", "https://lena-ceo-agent-production-4537.up.railway.app"],
      "dangerouslyDisableDeviceAuth": true
    }
  },
  "channels": {
    "zalouser": {
      "enabled": true,
      "dmPolicy": "open"
    }
  }
}
OCEOF

echo "Config generated with port ${OPENCLAW_GATEWAY_PORT}"
echo "Claude API: $(echo ${CLAUDE_API_KEY} | head -c 15)..."
echo "Gateway Token set: yes"

# Import cron jobs after gateway starts (background)
(sleep 30 && node /app/google-tools/import-cron.js /app/cron-jobs.json 2>&1 && echo "Cron jobs imported") &

# Start OpenClaw gateway on INTERNAL port (background)
echo "=== Starting OpenClaw Gateway on internal port ${OPENCLAW_INTERNAL_PORT} ==="
openclaw gateway --verbose &
OPENCLAW_PID=$!

# Wait briefly for OpenClaw to bind port
sleep 3

# Start Express proxy on PUBLIC port
echo "=== Starting Express proxy on public port ${FRONT_PORT} (forwards to OpenClaw ${OPENCLAW_INTERNAL_PORT}) ==="
exec node /app/proxy.js
