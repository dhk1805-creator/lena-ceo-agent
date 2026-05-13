#!/usr/bin/env node
// Express proxy + Zalo OA 2-way bridge with TOOL CALLING
// - Serves /public/* (Zalo domain verification)
// - Proxies / -> OpenClaw on internal port
// - Receives Zalo OA webhook → Lê Na (Claude) with tools → replies via Zalo OA API

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const fs = require('fs');

const FRONT_PORT = parseInt(process.env.PORT || '8080', 10);
const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_INTERNAL_PORT || '8090', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL_FAST = 'claude-haiku-4-5-20251001';   // Default for chat
const CLAUDE_MODEL_VIP = 'claude-sonnet-4-20250514';       // Proven working — do NOT change without testing

// === ZALO OA TOKEN — auto-refresh every 20h (expires 25h) ===
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';

function getOAToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.access_token) return data.access_token;
    }
  } catch (e) {}
  return process.env.ZALO_OA_ACCESS_TOKEN;
}

function getRefreshToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.refresh_token) return data.refresh_token;
    }
  } catch (e) {}
  return process.env.ZALO_OA_REFRESH_TOKEN;
}

async function refreshOAToken() {
  const refreshToken = getRefreshToken();
  const appId = process.env.ZALO_OA_APP_ID;
  const secret = process.env.ZALO_OA_SECRET;
  if (!refreshToken || !appId || !secret) {
    console.error('[token] Missing credentials for refresh');
    return false;
  }
  try {
    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: { 'secret_key': secret, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, app_id: appId, grant_type: 'refresh_token' }).toString()
    });
    const data = await res.json();
    if (data.access_token) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        refreshed_at: new Date().toISOString(),
        expires_in: data.expires_in
      }, null, 2));
      console.log(`[token] Refreshed OK at ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Next in 20h.`);
      return true;
    }
    console.error('[token] Refresh failed:', JSON.stringify(data));
    return false;
  } catch (e) {
    console.error('[token] Refresh error:', e.message);
    return false;
  }
}

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

// Minutes since last message in this user's session (Infinity if no prior session).
// Reads mtime of the session file — saveSession updates it on every turn.
function getSessionAgeMin(userId) {
  const file = path.join(SESSION_DIR, `${userId}.json`);
  try {
    if (fs.existsSync(file)) {
      const ageMs = Date.now() - fs.statSync(file).mtime.getTime();
      return Math.floor(ageMs / 60000);
    }
  } catch (e) {}
  return Infinity;
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
    description: 'GHI ĐÈ data vào Google Sheet (overwrite). CHỈ dùng khi cần update ô cụ thể.',
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
    name: 'sheets_append',
    description: 'THÊM DÒNG MỚI vào cuối Google Sheet (không ghi đè data cũ). Dùng cho Report Tracker, Weekly Performance, Task Tracker, NPP Orders.',
    input_schema: {
      type: 'object',
      properties: {
        range: { type: 'string', description: 'Vd: "Report Tracker!A:F" hoặc "Weekly Performance!A:E"' },
        values: { type: 'string', description: 'JSON 2D array: [["col1","col2",...]]' }
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
    name: 'task_add',
    description: 'Tạo task/công việc mới vào Task Tracker. Dùng khi VIP giao việc cho ai đó.',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Mô tả công việc' },
        assignee: { type: 'string', description: 'Email người nhận (vd: ducdd@nsca.vn)' },
        deadline: { type: 'string', description: 'Hạn hoàn thành YYYY-MM-DD' },
        source: { type: 'string', description: 'Nguồn giao (vd: "Sếp Khánh qua Zalo", "Họp giao ban")' }
      },
      required: ['task', 'assignee', 'deadline']
    }
  },
  {
    name: 'task_overdue',
    description: 'Xem danh sách task quá hạn chưa hoàn thành.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'task_status',
    description: 'Tổng hợp trạng thái tất cả task (theo người, theo status).',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'zalo_oa_send_to_vip',
    description: 'Gửi TIN NHẮN cá nhân cho VIP (sep-khanh, chi-hong, anh-ngoc). CHỈ dùng để nhắn tin riêng. KHÔNG dùng để đăng bài — dùng zalo_oa_article thay thế.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['sep-khanh', 'chi-hong', 'anh-ngoc'] },
        message: { type: 'string' }
      },
      required: ['target', 'message']
    }
  },
  {
    name: 'github_create_issue',
    description: 'Tạo GitHub Issue để yêu cầu sửa code/cron/config. CHỈ dùng khi Sếp Khánh yêu cầu thay đổi hệ thống (sửa cron job, thêm tính năng, fix bug). KHÔNG tự ý tạo issue.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Tiêu đề ngắn (vd: "Sửa cron báo cáo PKD chỉ lấy từ anh Ngọc")' },
        body: { type: 'string', description: 'Mô tả chi tiết: cần sửa gì, tại sao, file/cron nào liên quan' },
        requester: { type: 'string', description: 'Người yêu cầu (vd: "Sếp Khánh")' }
      },
      required: ['title', 'body', 'requester']
    }
  },
  {
    name: 'zalo_oa_history',
    description: 'Đọc lịch sử tin nhắn Zalo OA từ VIP. Dùng khi Sếp hỏi "chị Hồng/anh Ngọc nhắn gì?"',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'VIP alias: sep-khanh, chi-hong, anh-ngoc, hoặc "all"', enum: ['all', 'sep-khanh', 'chi-hong', 'anh-ngoc'] },
        hours: { type: 'number', description: 'Số giờ ngược lại (default 24)' }
      }
    }
  },
  {
    name: 'email_reply',
    description: 'Reply vào thread email đang có. Dùng khi cần trả lời email cụ thể.',
    input_schema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Message ID của email cần reply (lấy từ email_read)' },
        body: { type: 'string', description: 'Nội dung reply (HTML hoặc plain text)' },
        cc: { type: 'string', description: 'CC thêm (optional)' }
      },
      required: ['message_id', 'body']
    }
  },
  {
    name: 'kpi_update',
    description: 'Cập nhật KPI Tracker tự động từ data các sheet khác. Chạy khi Sếp yêu cầu hoặc tự động T7 22h.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'zalo_oa_article',
    description: 'ĐĂNG BÀI VIẾT lên TRANG Zalo OA Starasia JSC (public, mọi người thấy). Khi VIP nói "đăng bài/đăng lên OA" → dùng tool NÀY. KHÔNG dùng zalo_oa_send_to_vip.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'create hoặc list', default: 'create' },
        title: { type: 'string', description: 'Tiêu đề bài viết' },
        body: { type: 'string', description: 'Nội dung bài viết (plain text, tự convert HTML)' },
        cover: { type: 'string', description: 'URL ảnh bìa hoặc local path (VD: ảnh VIP gửi qua Zalo)' }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'task_update',
    description: 'Cập nhật trạng thái task (Done/Đang làm/Hủy). Dùng khi nhận xác nhận hoàn thành.',
    input_schema: {
      type: 'object',
      properties: {
        row: { type: 'number', description: 'Số dòng trong Sheet Task Tracker (lấy từ task_overdue hoặc task_status)' },
        status: { type: 'string', description: 'Trạng thái mới: Done, Đang làm, Hủy' }
      },
      required: ['row', 'status']
    }
  },
  {
    name: 'image_overlay',
    description: 'Ghép logo STARDUCT + text lên ảnh tạo banner/cover chuyên nghiệp. Layouts: hero (bài viết chính thức), banner-bottom (tin ngắn), banner-left (cột dọc), minimal (logo góc).',
    input_schema: {
      type: 'object',
      properties: {
        input_image: { type: 'string', description: 'Đường dẫn ảnh đầu vào (VD: /tmp/photo.jpg)' },
        text: { type: 'string', description: 'Text hiển thị trên ảnh (VD: tiêu đề bài viết)' },
        output_path: { type: 'string', description: 'Đường dẫn ảnh đầu ra (VD: /tmp/cover.png)' },
        layout: { type: 'string', description: 'hero | banner-bottom | banner-left | minimal (mặc định: hero)' }
      },
      required: ['input_image']
    }
  },
  {
    name: 'gemini_write',
    description: 'Dùng Gemini Flash (FREE) để soạn nội dung dài: bài viết, email, báo cáo, content marketing.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Yêu cầu viết (VD: "Viết bài 200 từ giới thiệu nhà máy STARDUCT")' },
        max_tokens: { type: 'number', description: 'Số token tối đa (mặc định 600)' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'drive_list',
    description: 'Liệt kê file/ảnh trong Google Drive folder. MẶC ĐỊNH folder STARDUCT (394 ảnh sản phẩm) — KHÔNG cần truyền folder_id trừ khi VIP nói folder khác. Trả về `public_url` cho mỗi file — dùng URL này làm cover cho zalo_oa_article.',
    input_schema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'Drive folder ID (optional, default = folder STARDUCT 394 ảnh)' },
        query: { type: 'string', description: 'Tìm theo tên file (optional, vd: "van ngan chay", "exhibition", "nha may")' },
        max: { type: 'number', description: 'Số file tối đa trả về (default 30)' }
      }
    }
  },
  {
    name: 'drive_download',
    description: 'Tải file Google Drive về local path (/tmp/...). Dùng khi cần ảnh local cho image_overlay. KHÔNG dùng cho zalo_oa_article cover — dùng public_url từ drive_list trực tiếp.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'Google Drive file ID (lấy từ drive_list)' },
        output_path: { type: 'string', description: 'Đường dẫn output (default /tmp/drive-<fileId>.bin)' }
      },
      required: ['file_id']
    }
  },
  {
    name: 'zalo_oa_comment',
    description: 'Đọc / trả lời / quét comment trên bài viết OA Starasia JSC. Actions: list (đọc comment 1 bài), reply (trả lời 1 comment), scan (quét TẤT CẢ article gần đây + auto reply theo template + filter spam), scan-article (quét comment của 1 article cụ thể — dùng khi biết article_id, bypass article/getslice).',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'reply', 'scan', 'scan-article'], description: 'list | reply | scan | scan-article' },
        article_id: { type: 'string', description: 'ID bài viết (cho list, reply, hoặc scan-article)' },
        comment_id: { type: 'string', description: 'ID comment cần reply' },
        message: { type: 'string', description: 'Nội dung reply' },
        hours: { type: 'number', description: 'Quét comment trong N giờ qua (scan: default 24, scan-article: default 720 = 30 ngày)' }
      },
      required: ['action']
    }
  }
];

async function runTool(name, input) {
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
    case 'email_reply':
      cmd = 'node'; args = [`${GTOOL}/gmail-reply.js`, input.message_id, input.body, input.cc || ''];
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
    case 'sheets_append':
      cmd = 'node'; args = [`${GTOOL}/sheets-append.js`, sheetId, input.range, input.values];
      break;
    case 'gdoc_create':
      cmd = 'node'; args = [`${GTOOL}/gdoc-create.js`, input.title, input.content];
      break;
    case 'task_add':
      cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'add', input.task, input.assignee, input.deadline, input.source || ''];
      break;
    case 'task_overdue':
      cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'overdue'];
      break;
    case 'task_status':
      cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'status'];
      break;
    case 'task_update':
      cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'update', String(input.row), input.status];
      break;
    case 'zalo_oa_send_to_vip':
      cmd = 'node'; args = [`${GTOOL}/zalo-oa-send.js`, input.target, input.message];
      break;
    case 'zalo_oa_history':
      cmd = 'node'; args = [`${GTOOL}/zalo-oa-history.js`, input.target || 'all', String(input.hours || 24)];
      break;
    case 'kpi_update':
      cmd = 'node'; args = [`${GTOOL}/kpi-update.js`];
      break;
    case 'zalo_oa_article':
      cmd = 'node'; args = [`${GTOOL}/zalo-oa-article.js`, input.action || 'create', input.title || '', input.body || '', input.cover || ''];
      break;
    case 'github_create_issue':
      cmd = 'node'; args = [`${GTOOL}/github-issue.js`, input.title, input.body, input.requester || ''];
      break;
    case 'image_overlay':
      cmd = 'node'; args = [`${GTOOL}/image-overlay.js`, input.input_image, input.text || '', input.output_path || `/tmp/cover-${Date.now()}.png`, input.layout || 'hero'];
      break;
    case 'gemini_write':
      cmd = 'node'; args = [`${GTOOL}/gemini-write.js`, input.prompt, String(input.max_tokens || 600)];
      break;
    case 'drive_list':
      cmd = 'node'; args = [`${GTOOL}/drive-list.js`,
        input.folder_id || '1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR',
        input.query || '',
        String(input.max || 30)];
      break;
    case 'drive_download':
      cmd = 'node'; args = [`${GTOOL}/drive-download.js`, input.file_id, input.output_path || ''];
      break;
    case 'zalo_oa_comment': {
      const action = input.action || 'scan';
      if (action === 'list') {
        cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'list', input.article_id || '', '0', '20'];
      } else if (action === 'reply') {
        cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'reply', input.comment_id || '', input.message || '', input.article_id || ''];
      } else if (action === 'scan-article') {
        cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'scan-article', input.article_id || '', String(input.hours || 24 * 30)];
      } else {
        cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'scan', String(input.hours || 24)];
      }
      break;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }

  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { encoding: 'utf-8', timeout: 60000 });
    if (stderr) console.log(`[tool:${name}] ${stderr.trim()}`);
    const raw = stdout || '';
    if (raw.length > 3000) {
      return { output: raw.substring(0, 3000) + '\n⚠️ [Cắt ngắn — vượt 3000 ký tự]' };
    }
    return { output: raw };
  } catch (e) {
    if (e.stderr) console.log(`[tool:${name}] ${e.stderr.trim()}`);
    return { error: (e.stderr || e.stdout || e.message || 'unknown error').substring(0, 1000) };
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

  // Dedup by message ID (Zalo can send duplicate webhooks)
  const msgId = event.message?.msg_id;
  if (msgId) {
    if (_webhookDedup.has(msgId)) {
      console.log(`[zalo-webhook] dedup: skipped ${msgId}`);
      return;
    }
    _webhookDedup.add(msgId);
    setTimeout(() => _webhookDedup.delete(msgId), 60000);
  }

  try {
    fs.appendFileSync('/root/.openclaw/zalo-events.jsonl',
      JSON.stringify({ time: new Date().toISOString(), event }) + '\n');
  } catch (e) {}

  console.log(`[zalo-webhook] ${event.event_name} from ${event.sender?.id || event.follower?.id || '?'}`);

  if (event.event_name === 'user_send_text') {
    handleUserMessage(event).catch(err => console.error('[lena] handler error:', err.message));
  } else if (event.event_name === 'follow') {
    handleFollow(event).catch(err => console.error('[follow] error:', err.message));
  } else if (event.event_name === 'unfollow') {
    handleUnfollow(event).catch(err => console.error('[unfollow] error:', err.message));
  } else if (event.event_name === 'user_send_image') {
    handleImageMessage(event).catch(err => console.error('[image] error:', err.message));
  } else if (
    event.event_name === 'user_send_comment' ||
    event.event_name === 'oa_comment' ||
    event.event_name === 'user_comment_article'
  ) {
    handleArticleComment(event).catch(err => console.error('[comment] error:', err.message));
  }
});

app.get('/zalo-webhook', (req, res) => res.json({ status: 'active' }));

// === FOLLOW / UNFOLLOW / IMAGE HANDLERS ===
const FOLLOWERS_FILE = '/root/.openclaw/zalo-oa-followers.json';

function lookupFollower(userId) {
  try {
    const followers = JSON.parse(fs.readFileSync(FOLLOWERS_FILE, 'utf-8'));
    return followers.find(f => f.user_id === userId);
  } catch (e) {}
  return null;
}

async function handleFollow(event) {
  const userId = event.follower?.id;
  if (!userId) return;

  const token = getOAToken();
  let displayName = 'Unknown';
  try {
    const res = await fetch(`https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`, {
      headers: { 'access_token': token }
    });
    const profile = await res.json();
    displayName = profile.data?.display_name || 'Unknown';
  } catch (e) {}

  console.log(`[follow] New: ${displayName} (${userId})`);

  let followers = [];
  try { followers = JSON.parse(fs.readFileSync(FOLLOWERS_FILE, 'utf-8')); } catch (e) {}
  const existing = followers.findIndex(f => f.user_id === userId);
  if (existing >= 0) {
    followers[existing].display_name = displayName;
    followers[existing].last_follow = new Date().toISOString();
  } else {
    followers.push({ user_id: userId, display_name: displayName, followed_at: new Date().toISOString() });
  }
  try { fs.writeFileSync(FOLLOWERS_FILE, JSON.stringify(followers, null, 2)); } catch (e) {}

  await sendZaloMessage(userId, `Chào ${displayName}! Em là Lê Na — trợ lý AI của NSCA/STARDUCT. Anh/chị nhắn tin cho em bất cứ lúc nào ạ.`);
}

async function handleUnfollow(event) {
  const userId = event.follower?.id;
  if (!userId) return;
  const vip = VIP_USERS[userId];
  console.log(`[unfollow] ${vip ? vip.name : userId}`);
  if (vip) {
    const sepId = process.env.ZALO_OA_USER_SEP_KHANH;
    if (sepId && userId !== sepId) {
      await sendZaloMessage(sepId, `⚠️ ${vip.name} đã unfollow OA Starasia JSC.`);
    }
  }
}

async function handleImageMessage(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  const vip = VIP_USERS[senderId];
  const follower = !vip ? lookupFollower(senderId) : null;
  const name = vip ? vip.name : (follower?.display_name || 'anh/chị');
  const att = event.message?.attachments?.[0];
  const imageUrl = att?.payload?.url || att?.payload?.thumbnail || '';
  console.log(`[zalo] image from ${name} (${senderId}): ${imageUrl.substring(0, 80)}`);
  await sendZaloMessage(senderId, `Dạ ${name}, em đã nhận ảnh.${vip ? ' Anh/chị cho em biết muốn em làm gì với ảnh này ạ (vd: đăng bài OA, tạo ảnh bìa...)?' : ''}`);
}

// Auto-reply tu dong cho comment cua follower tren bai viet OA.
// Co che: chay zalo-oa-comment.js voi action=reply (template) hoac log de Le Na xu ly sau.
async function handleArticleComment(event) {
  const commentId = event.comment?.id || event.comment_id || event.message?.comment_id;
  const articleId = event.article?.id || event.article_id || event.comment?.article_id;
  const text = event.comment?.message || event.comment?.text || event.message?.text || '';
  const senderId = event.sender?.id || event.user?.id;

  if (!commentId || !text) {
    console.log('[comment] missing comment_id or text, skip');
    return;
  }
  console.log(`[comment] new on article=${articleId} from=${senderId}: ${text.substring(0, 80)}`);

  // Goi tool de unify logic spam-filter + template-match + reply
  try {
    const { stdout, stderr } = await execFileAsync('node', [
      '/app/google-tools/zalo-oa-comment.js',
      'scan',
      '1'
    ], { encoding: 'utf-8', timeout: 30000 });
    if (stderr) console.log(`[comment:scan] ${stderr.trim()}`);
    console.log(`[comment:scan] ${stdout.trim().substring(0, 300)}`);
  } catch (e) {
    console.error(`[comment] scan failed: ${e.message}`);
  }
}

// === LÊ NA AGENT — TOOL CALLING LOOP ===
async function handleUserMessage(event) {
  const senderId = event.sender?.id;
  const messageText = event.message?.text;
  if (!senderId || !messageText) return;

  const vip = VIP_USERS[senderId];

  // Non-VIP: look up follower name, polite response
  if (!vip) {
    const follower = lookupFollower(senderId);
    const name = follower?.display_name || 'anh/chị';
    console.log(`[lena] non-VIP message from ${name} (${senderId}): ${messageText.substring(0, 60)}`);
    await sendZaloMessage(senderId, `Chào ${name}! Em là Lê Na — trợ lý AI của NSCA/STARDUCT. Hiện em chỉ hỗ trợ nhân sự nội bộ. ${name !== 'anh/chị' ? 'Cảm ơn ' + name + ' đã quan tâm OA của STARDUCT. ' : ''}Anh/chị cần gì vui lòng liên hệ hotline hoặc email info@nsca.vn ạ.`);
    return;
  }

  const senderInfo = `${vip.name} (${vip.role})`;
  const model = vip.model;

  console.log(`[lena] tin từ ${senderInfo}: ${messageText.substring(0, 60)}...`);

  // Session age BEFORE load — used to decide whether to greet
  const sessionAgeMin = getSessionAgeMin(senderId);

  // Load session — validate it's usable, reset if corrupt
  let session = loadSession(senderId);
  if (!Array.isArray(session)) session = [];
  // Ensure session doesn't have orphaned tool_result without matching tool_use
  if (session.length > 0) {
    const last = session[session.length - 1];
    if (last.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
      console.log(`[lena] session has orphaned tool_result — resetting`);
      session = [];
    }
  }

  // Fresh conversation = no prior turns, or >6h gap since last reply
  const isFreshSession = session.length === 0 || sessionAgeMin >= 360;
  console.log(`[lena] session: ${session.length} msgs, last ${sessionAgeMin === Infinity ? '∞' : sessionAgeMin}min ago, fresh=${isFreshSession}`);

  session.push({ role: 'user', content: messageText });

  // System prompt
  const today = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const systemPrompt = `Bạn là **Đào Thị Lê Na**, trợ lý AI của CEO Đào Huy Khánh (NSCA/STARDUCT).

Đang chat với: **${senderInfo}**
Thời gian: ${today}

TRẠNG THÁI HỘI THOẠI:
${isFreshSession
  ? `- Đây là TIN ĐẦU TIÊN của session mới (${sessionAgeMin === Infinity ? 'chưa từng chat' : `lần cuối ${sessionAgeMin} phút trước, >6h`}). Em CÓ THỂ mở đầu ngắn 1 lần (vd: "Dạ ${vip.name}, ...") rồi vào nội dung.`
  : `- Đang trong session ACTIVE (tin trước cách đây ${sessionAgeMin} phút). KHÔNG chào, KHÔNG mở đầu bằng "Dạ ${vip.name}" / "Chào anh/chị" / "Xin chào". Trả lời THẲNG vào nội dung như đang nói chuyện liên tục.`}

⛔ CHỐNG SPAM CHÀO HỎI (LUẬT QUAN TRỌNG):
❌ KHÔNG bắt đầu reply bằng "Chào anh/chị", "Xin chào", "Dạ chào ${vip.name}" — TRỪ khi TRẠNG THÁI ở trên nói "TIN ĐẦU TIÊN".
❌ KHÔNG mở đầu bằng "Dạ ${vip.name}," nếu đang trong session ACTIVE — vào thẳng câu trả lời.
❌ KHÔNG lặp lại lời chào trong cùng 1 session dù VIP gửi nhiều tin liên tục.
✅ Session active → reply bắt đầu trực tiếp bằng nội dung (vd: "Báo cáo PKD tuần này...", "Đã gửi mail cho anh Đức.", "Em check rồi: ...").

NGUYÊN TẮC:
- Xưng "em", gọi đúng vai vế (anh Khánh / chị Hồng / anh Ngọc / anh/chị)
- NGẮN GỌN, chính xác, có số liệu
- KHÔNG tâm sự, gossip, viết dài
- KHÔNG ký tên (proxy tự thêm "— Lê Na")
- Tin nhắn trả lời tối đa 500 ký tự
- Nếu cần phân tích dài → tạo gdoc rồi gửi link
- CHẠY TOOL IM LẶNG → chỉ trả lời KẾT QUẢ CUỐI CÙNG. KHÔNG narrate "em đang đọc...", "bước 1..."

⛔ HÀNH ĐỘNG — KHÔNG HỎI (LUẬT SỐ 1, QUAN TRỌNG NHẤT):
VIP ra lệnh → GỌI TOOL NGAY trong cùng lượt. TUYỆT ĐỐI KHÔNG hỏi lại.
- "đăng bài/viết bài/đăng lên OA" → CHẠY WORKFLOW ĐĂNG BÀI (xem bên dưới). KHÔNG hỏi. KHÔNG dùng DALL-E. KHÔNG dùng zalouser.
- "sửa X" → gọi github_create_issue NGAY. TỰ viết title+body chi tiết. KHÔNG hỏi "sửa thế nào".
- "check Y" / "đọc Z" → gọi sheets_read / email_read / task_overdue NGAY. KHÔNG hỏi Sheet ID.
- "gửi email cho A" → gọi email_send NGAY. KHÔNG hỏi "nội dung gì".
- "tạo task cho B" → gọi task_add NGAY. TỰ suy ra deadline hợp lý nếu VIP không nói.

TUYỆT ĐỐI CẤM (vi phạm = lỗi nghiêm trọng):
❌ Hỏi "anh muốn em làm không?" — VIP ĐÃ NÓI RÕ.
❌ Đưa "Option 1 / Option 2" cho VIP chọn — TỰ CHỌN cách tốt nhất.
❌ Hỏi "công thức tính thế nào?" — TỰ chọn công thức hợp lý.
❌ Hỏi "cột nào?" / "Sheet ID nào?" — TỰ xác định từ context.
❌ Liệt kê câu hỏi thay vì hành động — ĐÂY LÀ LỖI NẶNG NHẤT.
❌ Nói "em cần biết thêm" khi có đủ thông tin để hành động.

✅ CHỈ được hỏi DUY NHẤT khi thiếu 1 thông tin KHÔNG THỂ suy ra (vd: email người lạ chưa từng gặp).
✅ Nếu thiếu 1 chi tiết nhỏ → TỰ chọn giá trị hợp lý, LÀM, rồi báo kết quả.
✅ Em là TRỢ LÝ HÀNH ĐỘNG, không phải chatbot hỏi-đáp.

TOOLS có sẵn:
- email_send / email_read / email_reply
- calendar_read / calendar_create
- sheets_read / sheets_write / sheets_append
- gdoc_create
- task_add / task_overdue / task_status / task_update
- zalo_oa_send_to_vip (gửi cho VIP khác qua OA)
- zalo_oa_history (đọc tin nhắn Zalo OA từ VIP — dùng khi Sếp hỏi "ai nhắn gì?")
- github_create_issue (tạo yêu cầu sửa code — CHỈ khi Sếp Khánh yêu cầu. GITHUB_TOKEN ĐÃ CÓ, cứ gọi)
- zalo_oa_article (ĐĂNG BÀI lên TRANG OA Starasia JSC — public, mọi follower thấy)
- image_overlay (ghép logo STARDUCT lên ảnh tạo cover chuyên nghiệp — layouts: hero, banner-bottom)
- gemini_write (Gemini Flash soạn nội dung dài: bài viết, báo cáo — FREE)

⚠️ PHÂN BIỆT 2 TOOL ZALO:
- "đăng bài OA" / "đăng lên trang" → zalo_oa_article (bài viết PUBLIC trên trang Starasia JSC)
- "nhắn tin cho ai" / "báo cho chị Hồng" → zalo_oa_send_to_vip (tin nhắn RIÊNG cho 1 người)
TUYỆT ĐỐI KHÔNG dùng zalo_oa_send_to_vip để đăng bài. Đó là GỬI TIN NHẮN, không phải đăng bài.

WORKFLOW ĐĂNG BÀI ZALO OA (khi VIP gửi ảnh + yêu cầu viết bài):
⛔ KHÔNG dùng DALL-E tạo ảnh mới — PHẢI dùng ẢNH THẬT VIP đã gửi
⛔ KHÔNG hỏi xác nhận — VIP đã ra lệnh, ĐĂNG NGAY
⛔ KHÔNG dùng zalouser — dùng zalo_oa_article trực tiếp
1. zalo_oa_history → tìm type:"image" → lấy image_url (ẢNH VIP GỬI)
2. image_overlay (input=image_url, layout="hero") → tạo ảnh bìa từ ẢNH THẬT
3. gemini_write → soạn nội dung theo yêu cầu VIP
4. zalo_oa_article create → đăng bài lên OA (KHÔNG cần chatId)
5. Báo VIP: "✅ Đã đăng bài [tiêu đề] lên OA Starasia JSC"

GOOGLE SHEET: Sheet ID ĐÃ CÓ SẴN trong hệ thống — KHÔNG BAO GIỜ hỏi Sheet ID.
Khi dùng sheets_read / sheets_write / sheets_append: CHỈ CẦN truyền range (vd: "'KPI Tracker'!A:Z"). Hệ thống TỰ ĐỘNG điền Sheet ID.
21 tabs có sẵn: CEO Daily Dashboard | KPI Tracker | Report Tracker | Weekly Performance | Task Tracker | NPP Tracker | NPP Orders | KHKD 2026 Baseline | Activity Log | Export Revenue | International Pipeline

KHI SẾP KHÁNH NÓI "sửa" / "thêm" / "đổi" / "fix" BẤT CỨ GÌ VỀ CODE/CRON/HỆ THỐNG:
→ GỌI github_create_issue NGAY TRONG LƯỢT NÀY. TỰ viết title + body chi tiết.
→ Body phải ghi: file nào cần sửa, sửa gì cụ thể, lý do (từ lời Sếp).
→ Báo: "Em đã tạo yêu cầu #[số]. Claude Code sẽ tự động xử lý trong 5 phút."
→ TUYỆT ĐỐI KHÔNG hỏi "sửa thế nào?", "công thức gì?", "cột nào?" — TỰ SUY RA.
VD: Sếp nói "thêm cột KPI vào Report Tracker" → TỰ tạo issue: title="Thêm cột % KPI vào Report Tracker", body="Sửa cron weekly-report-scan trong cron-jobs.json, thêm cột % hoàn thành KPI = Actual/Target*100 vào sheets-append Report Tracker. Yêu cầu từ Sếp Khánh."

PHẠM VI VIP:
- anh Khánh = CEO, toàn quyền
- chị Hồng = TCKT/Pháp lý — KHÔNG share data Sếp
- anh Ngọc = TP KD, quản lý PKD (anh Đức BD, Santiago BD Intl, chị Tâm BO) + 5 NPP

LƯU Ý: 3 VIP độc lập, KHÔNG tự ý forward thông tin giữa họ.
Khi Sếp hỏi về VIP khác (vd: "chị Hồng nhắn gì?") → TỰ check email/data rồi trả lời. KHÔNG hỏi "check Zalo hay Gmail?".`;

  // Agent loop with tool calling
  // MAX_ITER 15: chain phức tạp (drive_list → gemini_write → zalo_oa_article → verify retry)
  // có thể tốn 7-10 tool calls + retry. Tăng từ 10 → 15 để tránh fallback sớm.
  let reply = '';
  let iterations = 0;
  const MAX_ITER = 15;

  try {
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
        const errBody = await res.text();
        console.error(`[lena] Claude API ${res.status}: ${errBody.substring(0, 300)}`);
        // If session is causing the error, try once with fresh session
        if (res.status === 400 && session.length > 1) {
          console.log(`[lena] retrying with fresh session`);
          session = [{ role: 'user', content: messageText }];
          continue;
        }
        throw new Error(`Claude API ${res.status}`);
      }

      const data = await res.json();

      if (data.stop_reason === 'tool_use') {
        session.push({ role: 'assistant', content: data.content });

        const toolResults = [];
        for (const block of data.content) {
          if (block.type === 'tool_use') {
            console.log(`[lena] tool: ${block.name}(${JSON.stringify(block.input).substring(0, 100)})`);
            const result = await runTool(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result)
            });
          }
        }

        session.push({ role: 'user', content: toolResults });
      } else {
        reply = data.content.find(c => c.type === 'text')?.text || '(em không có gì để nói)';
        session.push({ role: 'assistant', content: data.content });
        break;
      }
    }
  } catch (e) {
    console.error(`[lena] CRITICAL: ${e.message}`);
    reply = `Dạ ${vip.name}, em đang gặp trục trặc kỹ thuật, anh/chị thử lại sau 1 phút nhé.`;
    session = [{ role: 'user', content: messageText }];
  }

  if (!reply) {
    console.error(`[lena] NO REPLY after ${iterations - 1} iterations for ${vip.name}`);
    reply = 'Em xin lỗi, yêu cầu này cần nhiều bước xử lý quá. Anh/chị thử yêu cầu đơn giản hơn nhé.';
  }

  saveSession(senderId, session);

  try {
    await sendZaloMessage(senderId, reply);
    console.log(`[lena] replied to ${vip.name}: ${reply.substring(0, 60)}...`);
  } catch (e) {
    console.error(`[lena] send FAILED to ${vip.name}: ${e.message}`);
  }
}

const _zaloSendCache = new Map();
const ZALO_CHAT_COOLDOWN = 5000; // 5 seconds dedup for chat replies
const _webhookDedup = new Set();

async function sendZaloMessage(userId, message) {
  const now = Date.now();
  const lastSend = _zaloSendCache.get(userId);
  if (lastSend && now - lastSend < ZALO_CHAT_COOLDOWN) {
    console.log(`[zalo] dedup: skipped reply to ${userId} (${Math.round((now - lastSend) / 1000)}s ago)`);
    return;
  }
  _zaloSendCache.set(userId, now);

  const formatted = `${message.trim()}\n\n— Lê Na`;
  const token = getOAToken();
  if (!token) throw new Error('No OA access token available');
  const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST',
    headers: {
      'access_token': token,
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

// Cleanup stale cache entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of _zaloSendCache) {
    if (now - ts > 60000) _zaloSendCache.delete(key);
  }
}, 3600000);

// === HEALTH CHECK ===
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    tools: TOOLS.length,
    vips: Object.keys(VIP_USERS).filter(k => !k.startsWith('_none_')).length
  });
});

// === MANUAL TOKEN REFRESH ===
app.get('/refresh-token', async (req, res) => {
  const ok = await refreshOAToken();
  res.json({ refreshed: ok, token_exists: !!getOAToken() });
});

// === DEBUG — check VIP mapping + Claude API ===
app.get('/debug', async (req, res) => {
  const vipList = {};
  for (const [id, info] of Object.entries(VIP_USERS)) {
    if (!id.startsWith('_none_')) vipList[id.substring(0, 8) + '...'] = info.name;
  }
  let claudeOk = false;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CLAUDE_MODEL_FAST, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] })
    });
    claudeOk = r.ok;
    if (!r.ok) vipList._claude_error = await r.text();
  } catch (e) { vipList._claude_error = e.message; }
  res.json({
    vips_mapped: Object.keys(VIP_USERS).filter(k => !k.startsWith('_none_')).length,
    vips: vipList,
    claude_api: claudeOk ? 'OK' : 'FAIL',
    claude_key: CLAUDE_API_KEY ? CLAUDE_API_KEY.substring(0, 10) + '...' : 'MISSING',
    model_fast: CLAUDE_MODEL_FAST,
    model_vip: CLAUDE_MODEL_VIP,
    zalo_token: getOAToken() ? 'OK' : 'MISSING'
  });
});

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

  // Refresh OA token IMMEDIATELY on startup, then every 20h
  const REFRESH_INTERVAL = 20 * 60 * 60 * 1000; // 20h
  refreshOAToken().then(ok => {
    console.log(`[token] Startup refresh: ${ok ? 'OK' : 'FAILED (using cached/env)'}`);
  }).catch(() => {});
  setInterval(() => refreshOAToken(), REFRESH_INTERVAL);
  console.log(`[token] Auto-refresh scheduled every 20h. Current token: ${getOAToken() ? 'OK' : 'MISSING'}`);
});

server.on('upgrade', ocProxy.upgrade);

process.on('SIGTERM', () => {
  console.log('[proxy] SIGTERM, closing...');
  server.close(() => process.exit(0));
});
