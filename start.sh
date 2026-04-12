#!/bin/bash
# ============================================================
# DAO THI LE NA - OpenClaw Railway Startup
# ============================================================

echo "=== Le Na CEO Agent - Starting on Railway ==="
export TZ=Asia/Ho_Chi_Minh

# Railway provides PORT env
export OPENCLAW_GATEWAY_PORT="${PORT:-8080}"
export OPENCLAW_GATEWAY_TOKEN="${GATEWAY_PASSWORD:-LeNa2026!}"

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
          { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "contextWindow": 200000, "maxTokens": 8192 }
        ]
      },
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "${OPENAI_API_KEY:-sk-none}",
        "models": [
          { "id": "gpt-4o", "name": "GPT-4o", "contextWindow": 128000, "maxTokens": 4096 }
        ]
      },
      "google": {
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
        "apiKey": "${GEMINI_API_KEY:-none}",
        "api": "google-generative-ai",
        "models": [
          { "id": "gemini-2.0-flash", "name": "Gemini Flash", "contextWindow": 1048576, "maxTokens": 8192 }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-20250514"
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
