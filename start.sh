#!/bin/bash
# ============================================================
# DAO THI LE NA - OpenClaw Railway Startup
# ============================================================

echo "=== Le Na CEO Agent - Starting on Railway ==="
export TZ=Asia/Ho_Chi_Minh

# Railway provides PORT env
export OPENCLAW_GATEWAY_PORT="${PORT:-8080}"
export OPENCLAW_GATEWAY_TOKEN="${GATEWAY_PASSWORD:-LeNa2026!}"

# === PERSISTENT VOLUME SYNC ===
# Volume mounts at /root/.openclaw — copy workspace files if missing or updated
echo "Syncing workspace files to persistent volume..."
mkdir -p /root/.openclaw/workspace/skills /root/.openclaw/workspace/memory
mkdir -p /root/.openclaw/agents/main/sessions
mkdir -p /root/.openclaw/credentials/zalouser

# Always update AGENTS.md, MEMORY.md, skills (from Docker image)
cp -f /app/workspace/AGENTS.md /root/.openclaw/workspace/AGENTS.md 2>/dev/null
cp -f /app/workspace/MEMORY.md /root/.openclaw/workspace/MEMORY.md 2>/dev/null
cp -rf /app/workspace/skills/* /root/.openclaw/workspace/skills/ 2>/dev/null
cp -rf /app/workspace/memory/* /root/.openclaw/workspace/memory/ 2>/dev/null

# Only copy Zalo credentials if not already exists (preserve login session)
if [ ! -f /root/.openclaw/credentials/zalouser/credentials.json ]; then
  cp -f /app/zalo-session/credentials.json /root/.openclaw/credentials/zalouser/credentials.json 2>/dev/null
  cp -f /app/zalo-session/zalouser-pairing.json /root/.openclaw/credentials/zalouser-pairing.json 2>/dev/null
  echo "Zalo credentials copied (first deploy)"
else
  echo "Zalo credentials already exist (preserved from volume)"
fi

# ALWAYS clear sessions after AGENTS.md update (so Le Na reads new config)
echo "Clearing old sessions to pick up AGENTS.md changes..."
rm -f /root/.openclaw/agents/main/sessions/*.jsonl /root/.openclaw/agents/main/sessions/sessions.json 2>/dev/null
echo "Sessions cleared"

echo "Workspace sync complete"

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
          { "id": "claude-opus-4-20250514", "name": "Claude Opus 4", "contextWindow": 200000, "maxTokens": 16384 },
          { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "contextWindow": 200000, "maxTokens": 8192 }
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
      "model": "anthropic/claude-opus-4-20250514"
    }
  },
  "gateway": {
    "mode": "local",
    "port": ${OPENCLAW_GATEWAY_PORT},
    "bind": "lan",
    "controlUi": {
      "allowedOrigins": ["https://lena-ceo-agent-production.up.railway.app"],
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

# Start gateway
echo "=== Starting OpenClaw Gateway on port ${OPENCLAW_GATEWAY_PORT} ==="
exec openclaw gateway --verbose
