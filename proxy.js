#!/usr/bin/env node
// Express proxy + Zalo OA 2-way bridge
// - Serves /public/* (Zalo domain verification)
// - Proxies / -> OpenClaw on internal port
// - Receives Zalo OA webhook → calls Claude → replies via Zalo OA API

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

const FRONT_PORT = parseInt(process.env.PORT || '8080', 10);
const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_INTERNAL_PORT || '8090', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

// === ZALO OA CONFIG ===
const ZALO_OA_ACCESS_TOKEN = process.env.ZALO_OA_ACCESS_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';  // Haiku - nhanh, rẻ cho 2-way chat

// VIP user_id mapping (from env vars)
const VIP_USERS = {
  [process.env.ZALO_OA_USER_SEP_KHANH || '']: { name: 'anh Khánh', role: 'CEO', greeting: 'Sếp' },
  [process.env.ZALO_OA_USER_CHI_HONG || '']: { name: 'chị Hồng', role: 'GĐ Pháp lý + TCKT', greeting: 'chị Hồng' },
  [process.env.ZALO_OA_USER_ANH_NGOC || '']: { name: 'anh Ngọc', role: 'TP Kinh Doanh', greeting: 'anh Ngọc' },
};

const app = express();
app.set('trust proxy', true);

// === STATIC FILES ===
app.use((req, res, next) => {
  const filePath = path.join(PUBLIC_DIR, req.path);
  if (req.method === 'GET' && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  next();
});

// === ZALO WEBHOOK HANDLER ===
const zaloWebhookHandler = express.json({ limit: '5mb' });

app.post('/zalo-webhook', zaloWebhookHandler, (req, res) => {
  const event = req.body;

  // Always respond 200 immediately (Zalo requires <5s response)
  res.json({ status: 'ok' });

  // Log event
  try {
    fs.appendFileSync('/root/.openclaw/zalo-events.jsonl',
      JSON.stringify({ time: new Date().toISOString(), event }) + '\n');
  } catch (e) { /* ignore */ }

  console.log(`[zalo-webhook] event: ${event.event_name || 'unknown'} from ${event.sender?.id || 'unknown'}`);

  // Handle text messages from users
  if (event.event_name === 'user_send_text') {
    handleUserMessage(event).catch(err => console.error('[zalo-webhook] error:', err.message));
  }
});

app.get('/zalo-webhook', (req, res) => {
  res.json({ status: 'active', oa: 'Starasia JSC' });
});

// === 2-WAY MESSAGE HANDLER ===
async function handleUserMessage(event) {
  const senderId = event.sender?.id;
  const messageText = event.message?.text;

  if (!senderId || !messageText) return;

  // Identify VIP
  const vip = VIP_USERS[senderId];
  const senderInfo = vip
    ? `${vip.name} (${vip.role})`
    : `user_id ${senderId} (chưa identify)`;

  console.log(`[lena] tin nhắn từ ${senderInfo}: ${messageText.substring(0, 60)}...`);

  // Build system prompt
  const systemPrompt = `Bạn là Đào Thị Lê Na, trợ lý AI của CEO Đào Huy Khánh (NSCA/STARDUCT).

Đối tác đang chat: ${senderInfo}

Quy tắc trả lời:
- Xưng "em", gọi đúng vai vế: ${vip ? vip.greeting : 'anh/chị'}
- NGẮN GỌN, chính xác, có số liệu khi cần
- KHÔNG tâm sự, gossip, viết dài
- KHÔNG ký tên (proxy tự thêm "— Lê Na" ở cuối)
- Nếu được hỏi việc cần data/tool (email, lịch, BC, ...) → trả lời "Em xử lý + báo lại Sếp/anh/chị qua Dashboard" hoặc gợi ý cách
- Nếu không biết → nói thật, KHÔNG bịa
- Tối đa 500 ký tự`;

  // Call Claude
  let reply;
  try {
    reply = await callClaude(systemPrompt, messageText);
  } catch (e) {
    console.error('[lena] Claude error:', e.message);
    reply = `Xin lỗi ${vip?.greeting || 'anh/chị'}, em gặp lỗi kỹ thuật. ${vip?.greeting || 'Anh/chị'} thử lại sau ít phút nhé!`;
  }

  // Send reply via Zalo OA
  try {
    await sendZaloMessage(senderId, reply);
    console.log(`[lena] replied to ${senderInfo}: ${reply.substring(0, 60)}...`);
  } catch (e) {
    console.error('[lena] send error:', e.message);
  }
}

async function callClaude(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!res.ok) {
    throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '(empty response)';
}

async function sendZaloMessage(userId, message) {
  // Auto-add Lê Na signature
  const formatted = `${message.trim()}\n\n— Lê Na`;

  const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST',
    headers: {
      'access_token': ZALO_OA_ACCESS_TOKEN,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text: formatted }
    })
  });

  const data = await res.json();
  if (data.error !== 0) {
    throw new Error(`Zalo API: ${data.message} (code ${data.error})`);
  }
  return data.data;
}

// === PROXY TO OPENCLAW ===
const ocProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${OPENCLAW_PORT}`,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('[proxy] error:', err.message);
    if (res && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Upstream OpenClaw not ready: ' + err.message);
    }
  },
});

app.use('/', ocProxy);

// === START SERVER ===
const server = app.listen(FRONT_PORT, '0.0.0.0', () => {
  console.log(`[proxy] Listening on 0.0.0.0:${FRONT_PORT}, forwarding to OpenClaw at 127.0.0.1:${OPENCLAW_PORT}`);
  console.log(`[proxy] Static files: ${PUBLIC_DIR}`);
  console.log(`[proxy] Zalo OA webhook: /zalo-webhook (2-way bridge with Claude ${CLAUDE_MODEL})`);
  console.log(`[proxy] VIP mappings:`);
  Object.entries(VIP_USERS).forEach(([id, info]) => {
    if (id) console.log(`[proxy]   ${id} -> ${info.name} (${info.role})`);
  });
});

server.on('upgrade', ocProxy.upgrade);

process.on('SIGTERM', () => {
  console.log('[proxy] SIGTERM received, closing...');
  server.close(() => process.exit(0));
});
