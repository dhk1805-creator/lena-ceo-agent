#!/bin/bash
# ============================================================
# DAO THI LE NA - OpenClaw Railway Startup
# ============================================================

echo "=== Le Na CEO Agent - Starting on Railway ==="
export TZ=Asia/Ho_Chi_Minh

# Railway provides PORT env
PORT="${PORT:-18789}"

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
    "port": ${PORT},
    "bind": "0.0.0.0",
    "auth": {
      "mode": "password",
      "password": "${GATEWAY_PASSWORD:-LeNa2026!}"
    },
    "controlUi": {
      "allowedOrigins": ["https://lena-ceo-agent-production.up.railway.app"]
    },
    "trustedProxies": ["0.0.0.0/0"],
    "pairingRequired": false
  },
  "channels": {
    "zalouser": {
      "enabled": true
    }
  }
}
OCEOF

echo "Config generated with port ${PORT}"
echo "Claude API: $(echo ${CLAUDE_API_KEY} | head -c 15)..."

# Import cron jobs after gateway starts (background)
(sleep 30 && openclaw cron import /app/cron-jobs.json 2>/dev/null && echo "Cron jobs imported") &

# Start gateway
echo "=== Starting OpenClaw Gateway on port ${PORT} ==="
exec openclaw gateway --verbose
