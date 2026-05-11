#!/usr/bin/env node
// Express proxy + Zalo OA 2-way bridge with TOOL CALLING
// - Serves /public/* (Zalo domain verification)
// - Proxies / -> OpenClaw on internal port
// - Receives Zalo OA webhook → Lê Na (Claude) with tools → replies via Zalo OA API

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FRONT_PORT = parseInt(process.env.PORT || '8080', 10);
const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_INTERNAL_PORT || '8090', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const ZALO_OA_ACCESS_TOKEN = process.env.ZALO_OA_ACCESS_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL_FAST = 'claude-haiku-4-5-20251001';   // Default for chat
const CLAUDE_MODEL_VIP = 'claude-sonnet-4-20250514';      // For complex VIP requests

const VIP_USERS = {
  [process.env.ZALO_OA_USER_SEP_KHANH || '_none_sep']: { name: 'anh Khánh', alias: 'sep-khanh', role: 'CEO', model: CLAUDE_MODEL_VIP },
  [process.env.ZALO_OA_USER_CHI_HONG || '_none_hong']: { name: 'chị Hồng', alias: 'chi-hong', role: 'GĐ Pháp lý + TCKT', model: CLAUDE_MODEL_VIP },
  [process.env.ZALO_OA_USER_ANH_NGOC || '_none_ngoc']: { name: 'anh Ngọc', alias: 'anh-ngoc', role: 'TP Kinh Doanh', model: CLAUDE_MODEL_VIP },
};

// Session memory per VIP (last 10 messages)
const SESSION_DIR = '/root/.openclaw/zalo-oa-sessions';
try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch (e) {}

function loadSession(userId) {
  const file = path.join(SESSION_DIR, `${userId}.json`);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) {}
  }
  return [];
}

function saveSession(userId, messages) {
  const file = path.join(SESSION_DIR, `${userId}.json`);
  // Keep last 20 messages only
  const trimmed = messages.slice(-20);
  try { fs.writeFileSync(file, JSON.stringify(trimmed, null, 2)); } catch (e) {}
}

// === TOOLS — Lê Na có thể gọi qua OA ===
const TOOLS = [
  {
    name: 'email_send',
    description: 'Gửi email. Dùng để gửi mail cho nhân viên/đối tác/khách hàng.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Email người nhận (vd: ducdd@nsca.vn). Nhiều người: "a@x.vn,b@x.vn"' },
        subject: { type: 'string', description: 'Tiêu đề email' },
        body: { type: 'string', description: 'Nội dung HTML hoặc plain text' },
        cc: { type: 'string', description: 'CC (optional)' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'email_read',
    description: 'Đọc email gần đây với filter. Dùng để check inbox, tìm email cụ thể.',
    input_schema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Số giờ ngược lại (vd: 24, 168)' },
        max: { type: 'number', description: 'Số email tối đa (default 20)' },
        query: { type: 'string', description: 'Filter Gmail (vd: "from:ductm@nsca.vn", "subject:bao cao")' }
      },
      required: ['hours']
    }
  },
  {
    name: 'calendar_read',
    description: 'Đọc lịch hẹn sắp tới',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Số ngày phía trước (default 7)' }
      }
    }
  },
  {
    name: 'calendar_create',
    description: 'Tạo lịch hẹn mới (sau khi VIP đồng ý)',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO 8601: 2026-05-20T14:00:00+07:00' },
        end: { type: 'string', description: 'ISO 8601' },
        description: { type: 'string' },
        location: { type: 'string' }
      },
      required: ['title', 'start', 'end']
    }
  },
  {
    name: 'sheets_read',
    description: 'Đọc Google Sheet KPI/NPP/báo cáo',
    input_schema: {
      type: 'object',
      properties: {
        range: { type: 'string', description: 'Vd: "KPI Tracker!A1:Z50"' }
      },
      required: ['range']
    }
  },
  {
    name: 'sheets_write',
    description: 'Ghi data vào Google Sheet',
    input_schema: {
      type: 'object',
      properties: {
        range: { type: 'string' },
        values: { type: 'string', description: 'JSON 2D array: [["col1","col2"]]' }
      },
      required: ['range', 'values']
    }
  },
  {
    name: 'gdoc_create',
    description: 'Tạo Google Doc (cho báo cáo dài). Trả về link Doc.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'zalo_oa_send_to_vip',
    description: 'Gửi Zalo qua OA cho VIP khác (sep-khanh, chi-hong, anh-ngoc). Dùng khi anh Khánh yêu cầu báo cho người khác.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['sep-khanh', 'chi-hong', 'anh-ngoc'] },
        message: { type: 'string' }
      },
      required: ['target', 'message']
    }
  }
];

function runTool(name, input) {
  const GTOOL = '/app/google-tools';
  const sheetId = process.env.GOOGLE_SHEET_ID || '';

  let cmd, args;
  switch (name) {
    case 'email_send':
      cmd = 'node'; args = [`${GTOOL}/gmail-send.js`, input.to, input.subject, input.body, input.cc || '', ''];
      break;
    case 'email_read':
      cmd = 'node'; args = [`${GTOOL}/gmail-read.js`, String(input.hours), String(input.max || 20), input.query || ''];
      break;
    case 'calendar_read':
      cmd = 'node'; args = [`${GTOOL}/calendar-read.js`, String(input.days || 7)];
      break;
    case 'calendar_create':
      cmd = 'node'; args = [`${GTOOL}/calendar-create.js`, input.title, input.start, input.end, input.description || '', input.location || ''];
      break;
    case 'sheets_read':
      cmd = 'node'; args = [`${GTOOL}/sheets-read.js`, sheetId, input.range];
      break;
    case 'sheets_write':
      cmd = 'node'; args = [`${GTOOL}/sheets-write.js`, sheetId, input.range, input.values];
      break;
    case 'gdoc_create':
      cmd = 'node'; args = [`${GTOOL}/gdoc-create.js`, input.title, input.content];
      break;
    case 'zalo_oa_send_to_vip':
      cmd = 'node'; args = [`${GTOOL}/zalo-oa-send.js`, input.target, input.message];
      break;
    default:
      return { error: `Unknown tool: ${name}` };
  }

  try {
    const result = spawnSync(cmd, args, { encoding: 'utf-8', timeout: 60000 });
    if (result.status === 0) {
      return { output: (result.stdout || '').substring(0, 3000) };
    } else {
      return { error: (result.stderr || result.stdout || 'unknown error').substring(0, 1000) };
    }
  } catch (e) {
    return { error: e.message };
  }
}

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

// === ZALO WEBHOOK ===
app.post('/zalo-webhook', express.json({ limit: '5mb' }), (req, res) => {
  res.json({ status: 'ok' });

  const event = req.body;
  try {
    fs.appendFileSync('/root/.openclaw/zalo-events.jsonl',
      JSON.stringify({ time: new Date().toISOString(), event }) + '\n');
  } catch (e) {}

  console.log(`[zalo-webhook] ${event.event_name} from ${event.sender?.id}`);

  if (event.event_name === 'user_send_text') {
    handleUserMessage(event).catch(err => console.error('[lena] handler error:', err.message));
  }
});

app.get('/zalo-webhook', (req, res) => res.json({ status: 'active' }));

// === LÊ NA AGENT — TOOL CALLING LOOP ===
async function handleUserMessage(event) {
  const senderId = event.sender?.id;
  const messageText = event.message?.text;
  if (!senderId || !messageText) return;

  const vip = VIP_USERS[senderId];
  const senderInfo = vip ? `${vip.name} (${vip.role})` : `user ${senderId} (chưa identify)`;
  const model = vip ? vip.model : CLAUDE_MODEL_FAST;

  console.log(`[lena] tin từ ${senderInfo}: ${messageText.substring(0, 60)}...`);

  // Load session
  const session = loadSession(senderId);
  session.push({ role: 'user', content: messageText });

  // System prompt
  const today = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const systemPrompt = `Bạn là **Đào Thị Lê Na**, trợ lý AI của CEO Đào Huy Khánh (NSCA/STARDUCT).

Đang chat với: **${senderInfo}**
Thời gian: ${today}

NGUYÊN TẮC:
- Xưng "em", gọi đúng vai vế (anh Khánh / chị Hồng / anh Ngọc / anh/chị)
- NGẮN GỌN, chính xác, có số liệu
- KHÔNG tâm sự, gossip, viết dài
- Khi VIP yêu cầu hành động (gửi email, đặt lịch, đọc data...) → gọi TOOL phù hợp NGAY, đừng chỉ nói "em sẽ làm"
- KHÔNG ký tên (proxy tự thêm "— Lê Na")
- Tin nhắn trả lời tối đa 500 ký tự
- Nếu cần phân tích dài → tạo gdoc rồi gửi link

TOOLS có sẵn:
- email_send / email_read
- calendar_read / calendar_create
- sheets_read / sheets_write
- gdoc_create
- zalo_oa_send_to_vip (gửi cho VIP khác qua OA)

PHẠM VI VIP:
- anh Khánh = CEO, toàn quyền
- chị Hồng = TCKT/Pháp lý — KHÔNG share data Sếp
- anh Ngọc = TP KD, quản lý PKD (anh Đức BD, Santiago BD Intl, chị Tâm BO) + 5 NPP

LƯU Ý: 3 VIP độc lập, KHÔNG forward thông tin giữa họ trừ khi được yêu cầu rõ.`;

  // Agent loop with tool calling
  let reply = '';
  let iterations = 0;
  const MAX_ITER = 5;

  while (iterations++ < MAX_ITER) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: systemPrompt,
        tools: TOOLS,
        messages: session
      })
    });

    if (!res.ok) {
      throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    if (data.stop_reason === 'tool_use') {
      // Add assistant turn (including tool_use blocks)
      session.push({ role: 'assistant', content: data.content });

      // Execute each tool
      const toolResults = [];
      for (const block of data.content) {
        if (block.type === 'tool_use') {
          console.log(`[lena] tool: ${block.name}(${JSON.stringify(block.input).substring(0, 100)})`);
          const result = runTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          });
        }
      }

      session.push({ role: 'user', content: toolResults });
    } else {
      // Final reply
      reply = data.content.find(c => c.type === 'text')?.text || '(em không có gì để nói)';
      session.push({ role: 'assistant', content: data.content });
      break;
    }
  }

  if (!reply) reply = 'Em xin lỗi, em đang gặp khó khăn xử lý yêu cầu này. Anh/chị thử lại sau nhé.';

  // Save session
  saveSession(senderId, session);

  // Send via Zalo OA
  try {
    await sendZaloMessage(senderId, reply);
    console.log(`[lena] replied: ${reply.substring(0, 60)}...`);
  } catch (e) {
    console.error('[lena] send error:', e.message);
  }
}

async function sendZaloMessage(userId, message) {
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
  if (data.error !== 0) throw new Error(`Zalo: ${data.message} (${data.error})`);
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
      res.end('Upstream not ready: ' + err.message);
    }
  },
});

app.use('/', ocProxy);

const server = app.listen(FRONT_PORT, '0.0.0.0', () => {
  console.log(`[proxy] Public ${FRONT_PORT} -> OpenClaw ${OPENCLAW_PORT}`);
  console.log(`[proxy] Static: ${PUBLIC_DIR}`);
  console.log(`[proxy] Zalo OA 2-way bridge: ${TOOLS.length} tools, ${Object.keys(VIP_USERS).filter(k => !k.startsWith('_none_')).length} VIP mapped`);
});

server.on('upgrade', ocProxy.upgrade);

process.on('SIGTERM', () => {
  console.log('[proxy] SIGTERM, closing...');
  server.close(() => process.exit(0));
});
