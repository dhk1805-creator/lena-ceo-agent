// Preload env vars from /app/.env.json into process.env
// Fallback khi OpenClaw exec khong inherit Railway env vars
// Usage: require('./_env'); (dong dau file, truoc process.env access)
const fs = require('fs');
const ENV_FILE = '/app/.env.json';
try {
  if (fs.existsSync(ENV_FILE)) {
    const vars = JSON.parse(fs.readFileSync(ENV_FILE, 'utf-8'));
    for (const [k, v] of Object.entries(vars)) {
      if (!process.env[k] && v) process.env[k] = v;
    }
  }
} catch (e) {}
