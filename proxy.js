#!/usr/bin/env node
// Lê Na CEO Agent — Express server + Zalo OA webhook + Cron scheduler
// - Serves /public/* (Zalo domain verification)
// - Zalo OA webhook → Claude tool calling → reply
// - Built-in cron scheduler (node-cron) replaces OpenClaw

const express = require('express');
const cron = require('node-cron');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const fs = require('fs');

const FRONT_PORT = parseInt(process.env.PORT || '8080', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL_FAST = 'claude-haiku-4-5-20251001';   // Default for chat
const CLAUDE_MODEL_VIP = 'claude-sonnet-4-20250514';       // Proven working — do NOT change without testing

// === ZALO OA TOKEN — auto-refresh every 20h (expires 25h) ===
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';
const LENA_REPORTS_FOLDER = '11G7dpJX552jZFt37ou_m5ocz2sRZ2p5p'; // Google Drive: Lena_Reports root folder

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

// Zalo user ID của VIP chỉ là ĐỊNH DANH (không phải secret) → hardcode làm fallback
// để VIP luôn được nhận diện kể cả khi env var ZALO_OA_USER_* không tới được tiến trình.
// Thứ tự ưu tiên: process.env (Railway) → giá trị hardcode bên dưới.
const VIP_IDS = {
  SEP_KHANH: process.env.ZALO_OA_USER_SEP_KHANH || '6869834949444296385',
  CHI_HONG:  process.env.ZALO_OA_USER_CHI_HONG  || '9076345556107321186',
  ANH_NGOC:  process.env.ZALO_OA_USER_ANH_NGOC  || '219363256978038684',
};

const VIP_USERS = {
  [VIP_IDS.SEP_KHANH]: { name: 'anh Khánh', alias: 'sep-khanh', role: 'CEO', model: CLAUDE_MODEL_VIP },
  [VIP_IDS.CHI_HONG]:  { name: 'chị Hồng', alias: 'chi-hong', role: 'GĐ Pháp lý + TCKT', model: CLAUDE_MODEL_VIP },
  [VIP_IDS.ANH_NGOC]:  { name: 'anh Ngọc', alias: 'anh-ngoc', role: 'TP Kinh Doanh', model: CLAUDE_MODEL_VIP },
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

// Non-VIP greeting throttle — only send canned "Em là Lê Na..." once per 6h.
// File mtime tracks last greet; subsequent messages within window → silent.
const NONVIP_GREET_DIR = '/root/.openclaw/zalo-oa-nonvip-greet';
try { fs.mkdirSync(NONVIP_GREET_DIR, { recursive: true }); } catch (e) {}

function getNonVipGreetAgeMin(userId) {
  const file = path.join(NONVIP_GREET_DIR, `${userId}.touch`);
  try {
    if (fs.existsSync(file)) {
      const ageMs = Date.now() - fs.statSync(file).mtime.getTime();
      return Math.floor(ageMs / 60000);
    }
  } catch (e) {}
  return Infinity;
}

function markNonVipGreeted(userId) {
  const file = path.join(NONVIP_GREET_DIR, `${userId}.touch`);
  try { fs.writeFileSync(file, ''); } catch (e) {}
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
    name: 'hvac_lookup',
    description: 'Tra cứu tài liệu HVAC (tiêu chuẩn, thuật ngữ, kiến thức kỹ thuật) từ knowledge base do Sếp Khánh cung cấp. Dùng khi VIP hỏi về HVAC, điều hòa, thông gió, chiller, EER/COP, lưu lượng gió, áp suất, v.v.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Từ khóa tra cứu, vd: "EER", "chiller", "Btu/h". Để trống = đọc 50 dòng đầu.' },
        range: { type: 'string', description: 'Range A1, vd: "A:Z" hoặc "Tieu Chuan!A:F". Default "A:Z" (tab đầu tiên).' }
      }
    }
  },
  {
    name: 'memory_search',
    description: 'Tra cứu kiến thức trong long-term memory (cả baked-in /app/workspace/memory + learned overlay /root/.openclaw/lena-learned). BẮT BUỘC gọi TRƯỚC khi viết content kỹ thuật (bài OA, post FB, email khách) — đặc biệt khi nhắc tới tiêu chuẩn (UL, EN, AHRI, AMCA, ASHRAE, ISO, QCVN). File "hvac-standards" chứa spec sản phẩm; "hvac-knowledge" chứa công thức + thuật ngữ.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Từ khóa tra cứu (vd: "fire damper", "VAV", "ASHRAE 62.1", "EI 180")' },
        file: { type: 'string', description: 'Tên file giới hạn (optional, vd: "hvac-standards", "hvac-knowledge", "brand-guide"). Để trống = quét tất cả.' }
      },
      required: ['keyword']
    }
  },
  {
    name: 'memory_update',
    description: 'Lưu kiến thức mới Lê Na học được vào persistent volume (ghi vào /root/.openclaw/lena-learned/<topic>.md — overlay không ghi đè memory baked-in). Dùng khi: VIP dạy thêm 1 fact mới, Lê Na phát hiện info cần nhớ cho lần sau (vd: tiêu chuẩn mới, đối thủ mới, brand fact). KHÔNG dùng để log task/báo cáo — dùng sheets_append.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Tên topic (kebab-case, vd: "hvac-standards", "competitor-intel", "customer-feedback"). Cùng topic = append vào cùng file.' },
        content: { type: 'string', description: 'Nội dung markdown muốn lưu (vd: "EN 16798-3:2017 — ventilation in non-residential buildings, thay thế EN 13779")' },
        section: { type: 'string', description: 'Heading phụ để gom (optional, vd: "Cập nhật từ Sếp Khánh 13/5/2026"). Để trống = auto timestamp.' }
      },
      required: ['topic', 'content']
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
    name: 'web_search',
    description: 'Tìm kiếm web qua Google/DuckDuckGo. Dùng để research thị trường HVAC, đối thủ, xu hướng, tra cứu tiêu chuẩn kỹ thuật mới, tin tức ngành.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Từ khóa tìm kiếm (vd: "VAV box ASHRAE 2025", "đối thủ HVAC Việt Nam")' },
        max_results: { type: 'number', description: 'Số kết quả tối đa (default 10, tối đa 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'web_read',
    description: 'Đọc nội dung 1 trang web (HTML → plain text). Dùng khi VIP gửi link cần em tóm tắt, hoặc khi cần đọc chi tiết 1 URL từ web_search. CŨNG đọc được link YouTube (youtube.com, youtu.be): tự động lấy phụ đề/transcript của video về dạng text — dùng khi VIP gửi link YouTube và muốn em tóm tắt hoặc viết bài dựa trên nội dung video. KHÔNG đọc được PDF binary.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL đầy đủ (http:// hoặc https://)' }
      },
      required: ['url']
    }
  },
  {
    name: 'auto_learn',
    description: 'Quet session Zalo OA cua VIP trong N gio qua, dung Gemini Flash extract contacts moi / technical facts / customer feedback / business insights, roi auto-save vao lena-learned overlay. Dung khi: VIP yeu cau "rut kinh nghiem session", hoac sau hoi thoai dai co nhieu thong tin moi. Mac dinh chay tu dong qua cron 23h moi ngay — chi can goi manual khi VIP yeu cau ngay.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'VIP alias (sep-khanh, chi-hong, anh-ngoc) hoac "all". Default "all".' },
        hours: { type: 'number', description: 'Quet session active trong N gio qua (default 24)' }
      }
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
  },
  {
    name: 'list_cron_jobs',
    description: 'Liệt kê tất cả cron jobs của Lê Na. Trả về danh sách đầy đủ với ID, tên, lịch chạy, và mô tả ngắn.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'gmail_attachment',
    description: 'Download tep dinh kem tu email. Can messageId (lay tu gmail_read). Tra ve danh sach files da tai ve local (/tmp/attachments/).',
    input_schema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Gmail message ID (lay tu ket qua gmail_read)' },
        output_dir: { type: 'string', description: 'Thu muc luu file (default: /tmp/attachments)' }
      },
      required: ['message_id']
    }
  },
  {
    name: 'onedrive_download',
    description: 'Download file tu link OneDrive/SharePoint shared (nhan vien gui qua email/Teams). Khong can dang nhap — dung redeem token trong URL. Tra ve file path local de dung voi report_archive upload.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Link OneDrive (onedrive.live.com hoac 1drv.ms)' },
        output_dir: { type: 'string', description: 'Thu muc luu file (default: /tmp/attachments)' },
        filename: { type: 'string', description: 'Ten file tuy chon (neu muon dat ten khac)' }
      },
      required: ['url']
    }
  },
  {
    name: 'drive_manage',
    description: 'Quan ly Google Drive: tao folder, di chuyen/copy file, tao duong dan folder lon (ensure-path). copy-file giu nguyen file goc (dung cho BC nhan vien share link). Dung de to chuc bao cao theo cau truc: "Le Na Reports/2026/W20/", "Le Na Reports/2026/M05/".',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'create-folder | move-file | copy-file | ensure-path' },
        parent_id: { type: 'string', description: 'Folder cha (cho create-folder, ensure-path). Mac dinh: Le Na Reports root folder' },
        name: { type: 'string', description: 'Ten folder moi (cho create-folder)' },
        file_id: { type: 'string', description: 'ID file can di chuyen (cho move-file)' },
        target_folder_id: { type: 'string', description: 'Folder dich (cho move-file)' },
        path: { type: 'string', description: 'Duong dan folder can tao (cho ensure-path, vd: "2026/W20" hoac "2026/M05")' }
      },
      required: ['action']
    }
  },
  {
    name: 'gdoc_read',
    description: 'Doc noi dung Google Doc hoac Sheet bat ky bang ID. Dung khi nhan vien share link Doc/Sheet trong email bao cao. Tra ve noi dung text.',
    input_schema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc/Sheet ID (lay tu URL: docs.google.com/document/d/DOC_ID/...)' },
        max_chars: { type: 'number', description: 'Gioi han ky tu tra ve (default 8000)' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'file_read',
    description: 'Doc file Word (.doc/.docx), PowerPoint (.ppt/.pptx), Excel (.xlsx/.xls), PDF, CSV, TXT tu local path. Dung sau khi gmail_attachment download file ve /tmp/attachments/. Tra ve noi dung text de phan tich.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Duong dan file local (vd: /tmp/attachments/report.xlsx)' },
        max_chars: { type: 'number', description: 'Gioi han ky tu (default 8000)' },
        sheet_name: { type: 'string', description: 'Ten sheet cu the (chi cho Excel, default: sheet dau tien)' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'onedrive_download',
    description: 'Tai file tu link OneDrive / SharePoint ve /tmp/onedrive/. Dung khi nhan vien gui bao cao qua link OneDrive (1drv.ms, onedrive.live.com, *.sharepoint.com). Chi hoat dong voi share "Anyone with the link can view" — neu loi 401/403 thi bao nhan vien dat lai quyen public. Sau khi tai xong, chain voi file_read de doc noi dung (.xlsx/.docx/.pdf/.pptx).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Link OneDrive/SharePoint day du (1drv.ms/..., onedrive.live.com/..., hoac *.sharepoint.com/...)' },
        output_path: { type: 'string', description: 'Duong dan output (optional, default /tmp/onedrive/<ten-file>)' }
      },
      required: ['url']
    }
  },
  {
    name: 'gemini_analyze',
    description: 'Phan tich hinh anh (JPG/PNG/GIF/WEBP) va PDF bang Gemini AI multimodal. Doc hoa don, bang gia, screenshot, bieu do, anh chup san pham. Tra ve phan tich tieng Viet.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Duong dan file hinh anh hoac PDF (vd: /tmp/attachments/hoadon.jpg)' },
        prompt: { type: 'string', description: 'Cau hoi/yeu cau cu the (vd: "Doc so lieu tren hoa don", "Mo ta san pham trong anh")' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'report_archive',
    description: 'Luu tru bao cao vao Lena_Reports (Google Drive) theo cau truc thoi gian phang: 2026-W20/, 2026-M05/, 2026-Q2/, 2026-Year/. TU DONG tao folder neu chua co. 4 action: archive (copy Google Doc/Sheet vao folder), upload (upload file local), init (tao folder), list (xem file trong folder).',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'archive | upload | init | list' },
        file_id: { type: 'string', description: 'Google Drive file ID (cho archive — copy file vao folder)' },
        file_path: { type: 'string', description: 'Duong dan file local (cho upload — upload file vao folder)' },
        period: { type: 'string', description: 'Ky bao cao: W20, M05, Q2, Year (default: tuan hien tai)' },
        label: { type: 'string', description: 'Ten file moi khi luu (vd: "R&D - BC tuan 20")' }
      },
      required: ['action']
    }
  }
];

// Follower chỉ được dùng các tool CHỈ-ĐỌC, an toàn (không gửi mail / tạo task / ghi sheet /
// đăng bài / tạo issue). Tái dùng định nghĩa từ TOOLS — không nhân bản.
const FOLLOWER_TOOL_NAMES = ['web_search', 'web_read', 'memory_search'];
const FOLLOWER_TOOLS = TOOLS.filter(t => FOLLOWER_TOOL_NAMES.includes(t.name));

// Nhân viên nội bộ được dùng tool CHỈ-ĐỌC: tra cứu công việc, lịch, kỹ thuật.
// KHÔNG có quyền ghi (gửi mail / tạo task / ghi sheet / đăng bài / tạo issue).
const STAFF_TOOL_NAMES = ['web_search', 'web_read', 'memory_search', 'hvac_lookup',
  'task_status', 'task_overdue', 'calendar_read', 'sheets_read'];
const STAFF_TOOLS = TOOLS.filter(t => STAFF_TOOL_NAMES.includes(t.name));

// ============================================================
// === STAFF / CBCNV — đăng ký + nhận diện qua Zalo ID
// === Danh bạ nguồn: memory/directory.md (nhân viên nội bộ @nsca.vn).
// === Zalo ID ghi nhận tức thì vào file trên volume; có thể đồng bộ vào
// === directory.md sau (thêm cột "Zalo ID") để làm trí nhớ lâu dài.
// ============================================================
const DIRECTORY_FILE = '/app/workspace/memory/directory.md';
const STAFF_ZALO_FILE = '/root/.openclaw/staff-zalo-ids.json';

// Parse danh bạ nội bộ từ directory.md. Chỉ lấy nhân viên @nsca.vn
// (bỏ qua NPP/đối tác @partner.nsca.vn). Nếu bảng có cột thứ 7 = Zalo ID
// thì đọc luôn (directory.md trở thành nguồn lưu trữ lâu dài).
function parseStaffFromDirectory() {
  const staff = [];
  const seen = new Set();
  try {
    if (!fs.existsSync(DIRECTORY_FILE)) {
      console.error(`[staff] directory not found: ${DIRECTORY_FILE}`);
      return staff;
    }
    const lines = fs.readFileSync(DIRECTORY_FILE, 'utf-8').split('\n');
    let section = '';
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('#')) { section = line.replace(/^#+\s*/, '').trim(); continue; }
      if (!line.startsWith('|') || !line.includes('@nsca.vn')) continue;
      const cells = line.split('|').map(c => c.trim());
      // cells: ['', ID, Họ tên, Chức vụ, BP, Email, SĐT, (Zalo ID), '']
      const id    = cells[1] || '';
      const name  = cells[2] || '';
      const pos   = cells[3] || '';
      const bp    = cells[4] || '';
      const email = (cells[5] || '').replace(/[<>\s]/g, '').toLowerCase();
      const phone = cells[6] || '';
      const zaloFromDir = (cells[7] || '').replace(/[<>\s]/g, '');
      if (!email.endsWith('@nsca.vn')) continue;   // chỉ nhân viên nội bộ
      if (seen.has(email)) continue;
      seen.add(email);
      staff.push({ id, name, pos, dept: bp || section, email, phone,
        zaloId: /^\d{6,}$/.test(zaloFromDir) ? zaloFromDir : null });
    }
  } catch (e) {
    console.error(`[staff] parse error: ${e.message}`);
  }
  console.log(`[staff] parsed ${staff.length} internal staff from directory.md`);
  return staff;
}

let NSCA_STAFF = parseStaffFromDirectory();
let STAFF_BY_EMAIL = {};
let STAFF_BY_ZALO_DIR = {};   // Zalo ID lấy sẵn từ directory.md (nếu đã đồng bộ)
function rebuildStaffIndex() {
  STAFF_BY_EMAIL = {};
  STAFF_BY_ZALO_DIR = {};
  NSCA_STAFF.forEach(s => {
    STAFF_BY_EMAIL[s.email] = s;
    if (s.zaloId) STAFF_BY_ZALO_DIR[s.zaloId] = s;
  });
}
rebuildStaffIndex();
// Tự nạp lại directory.md mỗi 10 phút (phòng khi danh bạ được cập nhật)
setInterval(() => { NSCA_STAFF = parseStaffFromDirectory(); rebuildStaffIndex(); }, 10 * 60 * 1000);

// Bản đồ Zalo ID → email, ghi nhận tức thì khi nhân viên đăng ký.
function loadStaffZaloMap() {
  try {
    if (fs.existsSync(STAFF_ZALO_FILE)) return JSON.parse(fs.readFileSync(STAFF_ZALO_FILE, 'utf-8'));
  } catch (e) {}
  return {};
}
function saveStaffZaloMap(map) {
  try { fs.writeFileSync(STAFF_ZALO_FILE, JSON.stringify(map, null, 2)); } catch (e) {}
}
function registerStaffZaloId(zaloId, email) {
  const map = loadStaffZaloMap();
  map[String(zaloId)] = String(email).toLowerCase();
  saveStaffZaloMap(map);
  console.log(`[staff-reg] ${zaloId} → ${email}`);
}
// Tìm nhân viên theo Zalo ID: ưu tiên file volume, fallback sang directory.md.
function lookupStaffByZaloId(zaloId) {
  const id = String(zaloId);
  const email = loadStaffZaloMap()[id];
  if (email && STAFF_BY_EMAIL[email.toLowerCase()]) return STAFF_BY_EMAIL[email.toLowerCase()];
  return STAFF_BY_ZALO_DIR[id] || null;
}

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
    case 'hvac_lookup':
      cmd = 'node'; args = [`${GTOOL}/hvac-lookup.js`, input.keyword || '', input.range || 'A:Z'];
      break;
    case 'memory_search':
      cmd = 'node'; args = [`${GTOOL}/memory-search.js`, input.keyword || '', input.file || ''];
      break;
    case 'memory_update':
      cmd = 'node'; args = [`${GTOOL}/memory-update.js`, input.topic || '', input.content || '', input.section || ''];
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
    case 'web_search':
      cmd = 'node'; args = [`${GTOOL}/web-search.js`, input.query || '', String(input.max_results || 10)];
      break;
    case 'web_read':
      cmd = 'node'; args = [`${GTOOL}/web-read.js`, input.url || ''];
      break;
    case 'auto_learn':
      cmd = 'node'; args = [`${GTOOL}/auto-learn.js`, input.target || 'all', String(input.hours || 24)];
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
    case 'list_cron_jobs': {
      try {
        const cronPath = require('path').join(__dirname, 'cron-jobs.json');
        const jobs = JSON.parse(fs.readFileSync(cronPath, 'utf8'));
        const lines = jobs.map((j, i) => `${i+1}. [${j.id}] ${j.name} - cron: ${j.schedule.expr}`);
        return { result: `Le Na co ${jobs.length} cron jobs:\n${lines.join('\n')}` };
      } catch (e) { return { error: 'Khong doc duoc cron-jobs.json: ' + e.message }; }
    }
    case 'gmail_attachment':
      cmd = 'node'; args = [`${GTOOL}/gmail-attachment.js`, input.message_id, input.output_dir || '/tmp/attachments'];
      break;
    case 'onedrive_download':
      cmd = 'node'; args = [`${GTOOL}/onedrive-download.js`, input.url, input.output_dir || '/tmp/attachments', input.filename || ''];
      break;
    case 'drive_manage': {
      const dmAction = input.action || 'create-folder';
      if (dmAction === 'create-folder') {
        cmd = 'node'; args = [`${GTOOL}/drive-manage.js`, 'create-folder', input.parent_id || LENA_REPORTS_FOLDER, input.name || ''];
      } else if (dmAction === 'move-file') {
        cmd = 'node'; args = [`${GTOOL}/drive-manage.js`, 'move-file', input.file_id || '', input.target_folder_id || ''];
      } else if (dmAction === 'copy-file') {
        cmd = 'node'; args = [`${GTOOL}/drive-manage.js`, 'copy-file', input.file_id || '', input.target_folder_id || ''];
      } else if (dmAction === 'ensure-path') {
        cmd = 'node'; args = [`${GTOOL}/drive-manage.js`, 'ensure-path', input.parent_id || LENA_REPORTS_FOLDER, input.path || ''];
      } else {
        return { error: `drive_manage: unknown action "${dmAction}". Use: create-folder, move-file, copy-file, ensure-path` };
      }
      break;
    }
    case 'gdoc_read':
      cmd = 'node'; args = [`${GTOOL}/gdoc-read.js`, input.doc_id, String(input.max_chars || 8000)];
      break;
    case 'file_read':
      cmd = 'node'; args = [`${GTOOL}/file-read.js`, input.file_path, String(input.max_chars || 8000), input.sheet_name || ''];
      break;
    case 'onedrive_download':
      cmd = 'node'; args = [`${GTOOL}/onedrive-download.js`, input.url || '', input.output_path || ''];
      break;
    case 'gemini_analyze':
      cmd = 'node'; args = [`${GTOOL}/gemini-analyze.js`, input.file_path, input.prompt || ''];
      break;
    case 'report_archive': {
      const raAction = input.action || 'init';
      if (raAction === 'archive') {
        cmd = 'node'; args = [`${GTOOL}/report-archive.js`, 'archive', input.file_id || '', input.period || '', input.label || ''];
      } else if (raAction === 'upload') {
        cmd = 'node'; args = [`${GTOOL}/report-archive.js`, 'upload', input.file_path || '', input.period || '', input.label || ''];
      } else if (raAction === 'init') {
        cmd = 'node'; args = [`${GTOOL}/report-archive.js`, 'init', input.period || ''];
      } else if (raAction === 'list') {
        cmd = 'node'; args = [`${GTOOL}/report-archive.js`, 'list', input.period || ''];
      } else {
        return { error: `report_archive: unknown action "${raAction}". Use: archive, upload, init, list` };
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
    // Giới hạn output theo từng tool. web_read trả về cả 1 trang web thật (web-read.js
    // đã tự cap nội dung ở 8000 ký tự rồi) và memory_search có thể gom content từ
    // nhiều section trong 1 file dài (vd starduct-products-key.md ~10KB) — cả 2 cần
    // ngưỡng rộng để fact quan trọng (Intertek cert, link catalogue) không bị cắt
    // trước khi tới Lê Na. web_search vừa đủ cho danh sách kết quả.
    const OUTPUT_CAP = (name === 'web_read' || name === 'memory_search') ? 15000
                     : (name === 'web_search') ? 6000
                     : 3000;
    if (raw.length > OUTPUT_CAP) {
      return { output: raw.substring(0, OUTPUT_CAP) + `\n⚠️ [Cắt ngắn — vượt ${OUTPUT_CAP} ký tự]` };
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

  if (event.event_name === 'user_send_text' || event.event_name === 'user_send_link') {
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
}

async function handleUnfollow(event) {
  const userId = event.follower?.id;
  if (!userId) return;
  const vip = VIP_USERS[userId];
  console.log(`[unfollow] ${vip ? vip.name : userId}`);
  if (vip) {
    const sepId = VIP_IDS.SEP_KHANH;
    if (sepId && userId !== sepId) {
      await sendZaloMessage(sepId, `⚠️ ${vip.name} đã unfollow OA Starasia JSC.`);
    }
  }
}

// Lê Na ĐỌC được ảnh: tải ảnh → dùng vision mô tả thành text → đưa text đó qua
// handleUserMessage để có đầy đủ ngữ cảnh hội thoại + định tuyến VIP/nhân viên/follower.
async function handleImageMessage(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  const vip = VIP_USERS[senderId];
  const staff = !vip ? lookupStaffByZaloId(senderId) : null;
  const name = vip ? vip.name : (staff?.name || lookupFollower(senderId)?.display_name || 'anh/chị');

  const atts = event.message?.attachments || [];
  const imageUrls = atts.map(a => a?.payload?.url || a?.payload?.thumbnail).filter(Boolean);
  const caption = (event.message?.text || '').trim();
  console.log(`[image] from ${name} (${senderId}): ${imageUrls.length} ảnh`);

  // Bước 1: tải ảnh về (base64) để không phụ thuộc URL Zalo có hết hạn hay không.
  const imageBlocks = [];
  for (const url of imageUrls.slice(0, 5)) {
    try {
      const r = await fetch(url);
      if (!r.ok) { console.error(`[image] tải ảnh lỗi ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 4500000) { console.error('[image] ảnh quá lớn, bỏ qua'); continue; }
      let mt = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mt)) mt = 'image/jpeg';
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: mt, data: buf.toString('base64') } });
    } catch (e) {
      console.error(`[image] tải ảnh lỗi: ${e.message}`);
    }
  }

  // Bước 2: dùng vision đọc nội dung ảnh thành text.
  let visionText = '';
  if (imageBlocks.length > 0) {
    try {
      const content = [...imageBlocks, { type: 'text', text: 'Mô tả CHI TIẾT, chính xác nội dung (các) ảnh này bằng tiếng Việt: mọi chữ, số, mã sản phẩm, thông số kỹ thuật, bảng biểu, giao diện phần mềm. Ghi lại nguyên văn text và số nhìn thấy được. Chỉ mô tả, không bình luận.' }];
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: CLAUDE_MODEL_FAST, max_tokens: 1200, messages: [{ role: 'user', content }] })
      });
      if (res.ok) {
        const data = await res.json();
        visionText = data.content?.find(c => c.type === 'text')?.text || '';
      } else {
        console.error(`[image] vision API ${res.status}: ${(await res.text()).substring(0, 200)}`);
      }
    } catch (e) {
      console.error(`[image] vision error: ${e.message}`);
    }
  }

  // Bước 3: ghép nội dung ảnh thành 1 tin text rồi đưa qua handleUserMessage —
  // để Lê Na vừa "thấy" ảnh, vừa có ngữ cảnh hội thoại cho các tin nhắn tiếp theo.
  let combined;
  if (visionText) {
    combined = `(Người dùng vừa gửi ${imageBlocks.length} ảnh.${caption ? ` Lời nhắn kèm: "${caption}".` : ''} Nội dung ảnh hệ thống đọc được: ${visionText})`;
  } else {
    combined = `(Người dùng vừa gửi ảnh nhưng hệ thống chưa đọc được nội dung.${caption ? ` Lời nhắn kèm: "${caption}".` : ''} Hãy nói rõ em chưa đọc được ảnh, và nhờ anh/chị mô tả hoặc gõ lại thông tin chính giúp em.)`;
  }

  await handleUserMessage({
    event_name: 'user_send_text',
    sender: { id: senderId },
    message: { text: combined }
  }).catch(e => console.error('[image] handler error:', e.message));
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

// === FORCE FINAL ANSWER — khi vòng lặp agent hết lượt mà chưa ra câu trả lời:
// gọi Claude thêm 1 lần cuối, KHÓA tool (tool_choice none), ép Lê Na trả lời
// bằng những gì đã thu thập được. Tránh trả về câu từ chối cứng khiến người
// dùng phải hỏi lại (tốn thời gian, context, token).
async function forceFinalAnswer(model, systemPrompt, tools, session, maxTokens) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt + '\n\nLƯU Ý CUỐI: đã hết lượt gọi công cụ. Trả lời NGAY bằng thông tin đã tra được, dù chưa đầy đủ. Nói rõ phần nào chắc chắn, phần nào cần kiểm tra thêm. TUYỆT ĐỐI KHÔNG từ chối hay bảo người dùng hỏi đơn giản hơn.',
        tools,
        tool_choice: { type: 'none' },
        messages: session
      })
    });
    if (!res.ok) {
      console.error(`[force-answer] API ${res.status}`);
      return '';
    }
    const data = await res.json();
    return data.content.find(c => c.type === 'text')?.text || '';
  } catch (e) {
    console.error(`[force-answer] ${e.message}`);
    return '';
  }
}

// === LÊ NA AGENT — TOOL CALLING LOOP ===
async function handleUserMessage(event) {
  const senderId = event.sender?.id;
  let messageText = event.message?.text || '';

  // user_send_link: ensure URL từ attachments có trong messageText (Zalo có thể không bỏ URL vào text)
  if (event.event_name === 'user_send_link') {
    const linkUrls = (event.message?.attachments || [])
      .filter(a => a?.type === 'link' && a?.payload?.url)
      .map(a => a.payload.url);
    const missing = linkUrls.filter(u => !messageText.includes(u));
    if (missing.length > 0) {
      messageText = messageText ? `${messageText}\n${missing.join('\n')}` : missing.join('\n');
    }
    console.log(`[lena] user_send_link from ${senderId}: ${linkUrls.length} url(s)`);
  }

  if (!senderId || !messageText) return;

  const vip = VIP_USERS[senderId];

  // Không phải VIP → phân tầng: nhân viên đã đăng ký → đăng ký nhân viên → follower.
  // VIP path bên dưới giữ NGUYÊN như bản 8c371bf.
  if (!vip) {
    // 1. Đã đăng ký là nhân viên nội bộ?
    const staff = lookupStaffByZaloId(senderId);
    if (staff) {
      await handleStaffMessage(senderId, messageText, staff)
        .catch(err => console.error('[staff] handler error:', err.message));
      return;
    }
    // 2. Tin nhắn có email @nsca.vn → luồng đăng ký nhân viên.
    if (/[\w.\-]+@nsca\.vn/i.test(messageText)) {
      await handleStaffRegistration(senderId, messageText)
        .catch(err => console.error('[staff-reg] handler error:', err.message));
      return;
    }
    // 3. Người ngoài → follower (phạm vi công khai, giới hạn).
    await handleFollowerMessage(senderId, messageText)
      .catch(err => console.error('[follower] handler error:', err.message));
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
- NGÔN NGỮ: VIP nhắn bằng ngôn ngữ nào thì trả lời bằng đúng ngôn ngữ đó (mặc định Tiếng Việt).
- HÀNH VĂN: không dùng dấu gạch ngang dài (—) trong câu trả lời. Không dùng dấu "-" để nối vế câu thay cho dấu phẩy hoặc dấu chấm. Không dùng dấu ** (markdown in đậm) bao quanh chữ hay link, vì Zalo hiển thị nguyên ký tự ** nên trông rối. Khi liệt kê nhiều chủ đề thì đánh số "1-", "2-", "3-", "4-" cho từng chủ đề. Viết câu đầy đủ, đúng ngữ pháp văn viết.
THÁI ĐỘ: KHÔNG từ chối câu hỏi. Tuyệt đối không trả lời kiểu "yêu cầu này nhiều bước quá" hay bảo người hỏi đơn giản hơn. Mới có thông tin một phần thì trả lời phần đó và nói rõ phần nào cần kiểm tra thêm. KHÔNG hỏi vòng vo "anh/chị muốn em tìm gì" khi đã đủ dữ kiện để trả lời. Gọi công cụ gọn, đủ thông tin thì trả lời ngay, không tra lan man. Khi bị chỉ ra lỗi: nhận lỗi đúng MỘT câu ngắn rồi LÀM LẠI cho đúng ngay trong chính câu trả lời đó. KHÔNG viết lời xin lỗi dài dòng, KHÔNG liệt kê "bài học kinh nghiệm", KHÔNG hứa "em sẽ nhớ" hay "lần sau em sẽ", vì lời hứa suông vô giá trị, chỉ việc làm đúng ngay mới có giá trị. DẪN NGUỒN: khi trả lời dựa trên web_read / web_search / memory_search / hvac_lookup, LUÔN trích link hoặc tên file nguồn ở cuối câu trả lời (vd: "Nguồn: starduct.vn/mieng-gio-khuech-tan-vuong123-c-92" hoặc "Nguồn: memory/hvac-standards.md"). KHÔNG bịa nguồn, chỉ ghi nguồn THẬT đã đọc/tra. Không tra ra nguồn thì nói thẳng "câu trả lời dựa trên kiến thức chung, không có nguồn cụ thể".
- Xưng "em", gọi đúng vai vế (anh Khánh / chị Hồng / anh Ngọc / anh/chị)
- NGẮN GỌN, chính xác, có số liệu
- KHÔNG tâm sự, gossip, viết dài
- KHÔNG ký tên (proxy tự thêm chữ ký "Lê Na")
- Tin nhắn trả lời tối đa 500 ký tự
- Nếu cần phân tích dài → tạo gdoc rồi gửi link
- CHẠY TOOL IM LẶNG → chỉ trả lời KẾT QUẢ CUỐI CÙNG. KHÔNG narrate "em đang đọc...", "bước 1..."

⚠️ LINK WEBSITE - QUY TẮC BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG bịa/đoán link website
- TRƯỚC khi gửi link trong email/tin nhắn → PHẢI web_search "site:starduct.vn [keyword]"
- PHẢI web_read verify link hoạt động (không 404)
- CHỈ gửi link đã test thực tế
- Khi cần catalogue → web_search "site:starduct.vn [tên SP] catalogue download"
- Vi phạm = lỗi nghiêm trọng, ảnh hưởng uy tín công ty

⛔ HÀNH ĐỘNG — KHÔNG HỎI (LUẬT SỐ 1, QUAN TRỌNG NHẤT):
VIP ra lệnh → GỌI TOOL NGAY trong cùng lượt. TUYỆT ĐỐI KHÔNG hỏi lại.
- "đăng bài/viết bài/đăng lên OA" → CHẠY WORKFLOW ĐĂNG BÀI (xem bên dưới). KHÔNG hỏi. KHÔNG dùng DALL-E. KHÔNG dùng zalouser.
- "tạo issue X" / "ghi issue X" / "Claude Code sửa X" (Sếp NÓI RÕ là muốn issue) → gọi github_create_issue NGAY. TỰ viết title+body chi tiết. KHI Sếp chỉ nói "sửa..." chung chung hoặc yêu cầu HÀNH ĐỘNG mà em thiếu tool (gỡ bài, xóa file...) thì KHÔNG tự tạo issue, chỉ báo Sếp bằng lời.
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

⛔ TƯ DUY THEO LUỒNG HỘI THOẠI (LUẬT QUAN TRỌNG):
- Câu hỏi gốc của VIP vẫn là mục tiêu ĐANG CHỜ cho tới khi giải quyết xong. VIP nói thêm (vd chỉ chỗ tìm) thì đừng quên họ đang hỏi gì.
- TUYỆT ĐỐI KHÔNG hỏi lại điều VIP đã nói. VIP đã cho biết cần gì và đã chỉ nguồn thì ĐI TÌM NGAY, không hỏi "anh cần gì cụ thể".
- Tự nối thông tin qua các lượt: VIP hỏi 1 sản phẩm, bạn thấy nguồn có mục liên quan (vd hỏi van ngăn cháy mà nguồn có module Fire Damper) thì TỰ đi sâu vào mục đó, đừng chỉ liệt kê rồi hỏi.
- Nếu thực sự bị chặn (không đọc được nguồn, dữ liệu không có) thì nói RÕ đã thử gì và vướng ở đâu, KHÔNG thay bằng câu hỏi mơ hồ.

TOOLS có sẵn:
- email_send / email_read / email_reply
- calendar_read / calendar_create
- sheets_read / sheets_write / sheets_append
- hvac_lookup (tra cứu tiêu chuẩn / thuật ngữ / kiến thức HVAC từ Google Sheet — dùng khi VIP hỏi về điều hòa, chiller, EER/COP, lưu lượng gió, áp suất, v.v.)
- memory_search (tra cứu long-term memory: hvac-standards, hvac-knowledge, brand-guide, contacts... — BẮT BUỘC gọi TRƯỚC khi viết content kỹ thuật có tiêu chuẩn)
- memory_update (lưu kiến thức mới vào lena-learned overlay — dùng khi VIP dạy fact mới hoặc cần nhớ cho lần sau)
- auto_learn (quét session VIP, Gemini extract contacts/technical/feedback/insights → auto save vào lena-learned. Chạy cron 23h hàng ngày. Chỉ gọi manual khi VIP yêu cầu "rút kinh nghiệm session" hoặc "ghi nhớ hội thoại này")
- gdoc_create
- task_add / task_overdue / task_status / task_update
- zalo_oa_send_to_vip (gửi cho VIP khác qua OA)
- zalo_oa_history (đọc tin nhắn Zalo OA từ VIP — dùng khi Sếp hỏi "ai nhắn gì?")
- github_create_issue (tạo yêu cầu sửa code trên repo lena-ceo-agent — CHỈ KHI Sếp ra LỆNH MINH BẠCH "tạo issue", "github issue", "Claude Code sửa". TUYỆT ĐỐI KHÔNG tự tạo issue khi em thiếu tool runtime hoặc khi Sếp than phiền hành vi — báo Sếp BIẾT bằng lời. Repo của Sếp, không phải bãi rác.)
- zalo_oa_article (ĐĂNG BÀI lên TRANG OA Starasia JSC — public, mọi follower thấy)
- image_overlay (ghép logo STARDUCT lên ảnh tạo cover chuyên nghiệp — layouts: hero, banner-bottom)
- gemini_write (Gemini Flash soạn nội dung dài: bài viết, báo cáo — FREE)
- gmail_attachment (download tệp đính kèm từ email — Excel/PDF/Doc/PPT. Dùng messageId + attachmentId)
- onedrive_download (download file từ link OneDrive/SharePoint nhân viên gửi qua email. Tự xử lý redeem token, không cần đăng nhập)
- file_read (đọc file local: doc/docx/ppt/pptx/xlsx/xls/pdf/csv/txt/md/json/html/xml)
- onedrive_download (tải file từ link OneDrive/SharePoint về /tmp/onedrive/ — chỉ với share "Anyone with link can view". Sau khi tải, chain với file_read)
- gdoc_read (đọc nội dung Google Doc/Sheet bằng ID hoặc link — export text/csv)
- gemini_analyze (phân tích hình ảnh JPG/PNG/WEBP/GIF và PDF bằng Gemini AI multimodal)
- drive_manage (quản lý Google Drive: create-folder, move-file, copy-file, ensure-path)
- report_archive (LƯU TRỮ báo cáo vào Lena_Reports — TỰ ĐỘNG tạo folder tuần/tháng/quí/năm. actions: archive|upload|init|list. BẮT BUỘC gọi sau khi download attachment hoặc tạo báo cáo)
- list_cron_jobs (liệt kê tất cả cron jobs đang chạy — schedule, mô tả, trạng thái)

📋 WORKFLOW LƯU TRỮ BÁO CÁO (BẮT BUỘC khi nhận file từ email/Drive/OneDrive):
1. Kiểm tra email có attachment → gmail_attachment | Có link OneDrive → onedrive_download | Có link Google Doc → gdoc_read
2. file_read hoặc gemini_analyze → đọc/phân tích nội dung
3. report_archive (action:"upload") → lưu vào Lena_Reports/2026-Wxx/
4. Báo VIP: "✅ Đã lưu [tên file] vào Lena_Reports/[folder]"
⚠️ KHÔNG BAO GIỜ chỉ scan email mà không lưu file. Đã scan = PHẢI archive.
⚠️ Link OneDrive (onedrive.live.com, 1drv.ms, sharepoint.com) → LUÔN dùng onedrive_download, KHÔNG dùng gmail_attachment.

⚠️ PHÂN BIỆT 2 TOOL ZALO:
- "đăng bài OA" / "đăng lên trang" → zalo_oa_article (bài viết PUBLIC trên trang Starasia JSC)
- "nhắn tin cho ai" / "báo cho chị Hồng" → zalo_oa_send_to_vip (tin nhắn RIÊNG cho 1 người)
TUYỆT ĐỐI KHÔNG dùng zalo_oa_send_to_vip để đăng bài. Đó là GỬI TIN NHẮN, không phải đăng bài.

WORKFLOW ĐĂNG BÀI ZALO OA (khi VIP gửi ảnh + yêu cầu viết bài):
⛔ KHÔNG dùng DALL-E tạo ảnh mới — PHẢI dùng ẢNH THẬT VIP đã gửi
⛔ KHÔNG hỏi xác nhận — VIP đã ra lệnh, ĐĂNG NGAY
⛔ KHÔNG dùng zalouser — dùng zalo_oa_article trực tiếp
0. NẾU bài có nhắc tiêu chuẩn (UL/EN/AHRI/AMCA/ASHRAE/ISO/QCVN) hoặc sản phẩm STARDUCT (van ngăn cháy, VAV, VCD, louver, cửa gió) → memory_search keyword="<tên SP>" file="hvac-standards" TRƯỚC khi viết. Trích đúng mã chuẩn, KHÔNG bịa.
1. zalo_oa_history → tìm type:"image" → lấy image_url (ẢNH VIP GỬI)
2. image_overlay (input=image_url, layout="hero") → tạo ảnh bìa từ ẢNH THẬT
3. gemini_write → soạn nội dung theo yêu cầu VIP (đã có spec đúng từ bước 0). CẤU TRÚC BẮT BUỘC truyền vào prompt gemini_write (không truyền là Lê Na vi phạm):
   - Tiêu đề bài riêng 1 dòng (không bọc dấu **).
   - Mở đầu 2-3 câu, sau đó 1 dòng trống.
   - Các phần chính đánh số "1- ", "2- ", "3- ", "4- "..., MỖI phần là 1 đoạn riêng, cách nhau 1 dòng trống. Mỗi phần có 1 câu dẫn (tên phần) rồi 2-3 câu giải thích, KHÔNG nhồi nhiều ý vào 1 paragraph dài.
   - Đoạn kết 1-2 câu kèm CTA "Liên hệ info@nsca.vn | Website starduct.vn".
   - TUYỆT ĐỐI không dùng dấu ** (markdown đậm), không gạch nối "-" lẻ ở đầu dòng dạng "- xxx" (Zalo hiển thị xấu), không viết paragraph dài 5-6 câu liền không xuống dòng. Bài đăng phải nhìn rõ ràng, từng phần tách bạch.
4. zalo_oa_article create → đăng bài lên OA (KHÔNG cần chatId)
5. Báo VIP: "✅ Đã đăng bài [tiêu đề] lên OA Starasia JSC"

⛔ NGOẠI LỆ KHÔNG ĐƯỢC ĐĂNG: nếu Sếp yêu cầu viết bài DỰA TRÊN một nguồn cụ thể (video YouTube, link, file, tài liệu) mà em KHÔNG đọc hoặc truy cập được nguồn đó, TUYỆT ĐỐI KHÔNG tự bịa nội dung từ kiến thức chung rồi đăng. Phải DỪNG LẠI, nói rõ em không đọc được nguồn nào và vì sao, hỏi Sếp muốn xử lý sao (gửi lại nội dung, đổi nguồn, hay vẫn viết theo kiến thức chung). Đăng bài public là hành động không thu hồi được, thà hỏi còn hơn đăng sai nguồn. Quy tắc "đăng ngay không hỏi" chỉ áp dụng khi em ĐÃ có đủ đúng nguồn Sếp yêu cầu.

TRAINING MODE — khi Sếp chủ động dạy em kiến thức mới qua Zalo. Nhận diện khi tin nhắn của Sếp BẮT ĐẦU bằng một trong các pattern dưới (và KHÔNG kết thúc bằng "?", vì câu kết thúc bằng "?" là câu hỏi, không phải dạy):
- "Dạy Lena: ..." / "Lena nhớ rằng: ..." / "Ghi nhớ: ..." → kiến thức mới (mặc định nhóm business-rule / product / preference / contact tuỳ nội dung).
- "Quy tắc mới: ..." / "Từ nay: ..." → quy tắc kinh doanh mới có hiệu lực từ giờ trở đi.
- "Cập nhật: ..." / "Sửa lại: ..." → OVERRIDE kiến thức cũ, BẮT BUỘC bước (1) check conflict trước khi ghi đè.

Khi vào TRAINING MODE — flow 4 bước:
1- memory_search keyword="<từ khoá chính của kiến thức mới>" để check trước đây đã có gì. Nếu CÓ và mâu thuẫn với cái Sếp vừa dạy → KHÔNG tự ghi đè, hỏi Sếp: "Trước đây em đã ghi [X]. Anh muốn cập nhật thành [Y] đúng không ạ?" và CHỜ confirm trước khi save.
2- Nếu không mâu thuẫn (hoặc Sếp đã confirm override) → memory_update topic="<chủ đề ngắn, slug kiểu npp-chiet-khau / vav-submittal-bat-buoc / ceo-pref-bao-cao-ngan>" content="<diễn giải lại bằng lời của em, 1-2 câu, KHÔNG copy nguyên câu Sếp, KHÔNG bỏ chi tiết quan trọng>".
3- RECAP cho Sếp xem ngay: "Em đã ghi: [recap 1 câu bằng lời em]. Em hiểu đúng chưa ạ?". Mục đích để Sếp duyệt xem em hiểu đúng ý không.
4- Nếu Sếp confirm ("đúng", "ừ", "OK") → xong. Nếu Sếp sửa ("không, ý anh là...") → memory_update lại với nội dung Sếp chỉnh.

NGUYÊN TẮC TRAINING:
- memory_update xong là kiến thức ĐÃ THẬT SỰ LƯU vào lena-learned (file persistent trên volume Railway). Lần sau bất kỳ phiên nào memory_search keyword đó sẽ tự ra. KHÔNG nói "em sẽ nhớ" / "em sẽ áp dụng" — đó là hứa suông, save đã xong rồi, chỉ cần recap + chờ confirm là đủ.
- Kiến thức Sếp dạy quá mơ hồ hoặc thiếu chi tiết quan trọng → hỏi Sếp cụ thể hơn TRƯỚC khi save, không tự suy đoán bổ sung.
- Cố gắng đặt topic ngắn gọn dạng slug (gạch nối, không dấu) để memory_search dễ tìm lần sau.

LONG-TERM MEMORY (memory_search + memory_update + auto_learn):
✅ TRƯỚC khi viết content kỹ thuật (bài OA/FB, email khách, slide) có tiêu chuẩn → memory_search file="hvac-standards" để verify mã chuẩn.
✅ Khi VIP nói "ghi nhớ X" / "lần sau Y" / "đừng quên Z" → memory_update topic="<chủ đề>" content="<X>". KHÔNG hỏi lại.
✅ Khi VIP GIỚI THIỆU người mới (tên + chức vụ/công ty) → memory_update topic="contacts" content="<Tên — chức vụ — context gặp>". KHÔNG cần VIP yêu cầu.
✅ Khi VIP chia sẻ fact kỹ thuật mới (tiêu chuẩn, công thức, spec) → memory_update topic="technical-facts" content="<fact>". KHÔNG hỏi lại.
✅ Khi VIP truyền customer feedback / NPP phản hồi → memory_update topic="customer-feedback" content="<khách: phản hồi>".
✅ Khi VIP đưa quyết định/insight kinh doanh quan trọng → memory_update topic="business-insights" content="<insight>".
✅ Khi phát hiện fact mới đáng nhớ (đối thủ ra SP, khách phản hồi, tiêu chuẩn cập nhật) → memory_update để lần sau Lê Na tự biết.
✅ TRƯỚC khi reply VIP về 1 người/khách/topic đã gặp → memory_search keyword="<tên>" để check đã biết gì về họ trước đó.
⚙️ Cron 23h hàng ngày TỰ ĐỘNG chạy auto_learn quét toàn bộ session 24h — Lê Na KHÔNG cần lo backup. Chỉ gọi auto_learn manual khi VIP yêu cầu "rút kinh nghiệm session này".
❌ KHÔNG bịa tiêu chuẩn. ASHRAE 55/62.1/62.2 là chuẩn MÔI TRƯỜNG, KHÔNG phải spec sản phẩm — đừng gán vào van/VAV.
❌ KHÔNG BAO GIỜ bịa thông tin về dự án / sản phẩm NỘI BỘ NSCA-STARDUCT (ClimaNexus, Tool Hub, SVAV-S, Hub 100, Lê Na AI, KHKD, các project R&D nội bộ, v.v.) nếu chưa memory_search và xác minh có trong trí nhớ. memory_search KHÔNG ra → trả lời "Em chưa có thông tin về [X] trong trí nhớ, Sếp cho em chi tiết để em ghi nhớ và trả lời chính xác." TUYỆT ĐỐI KHÔNG tự suy đoán đặc điểm kỹ thuật, mục tiêu, benchmark, số liệu, hay phân loại bảo mật của dự án nội bộ. ĐÂY LÀ LỖI NẶNG vì nội dung bịa rồi gửi đi / đăng public không thu hồi được.
✅ QUY TRÌNH BẮT BUỘC cho TẤT CẢ sản phẩm STARDUCT (van ngăn cháy, VAV, VCD, louver, cửa gió, miệng gió, damper, diffuser, grille, ống gió, ERV fan, ống mềm, máng cáp, tunnel damper, ... — KHÔNG ngoại lệ). Tuyệt đối KHÔNG trả lời "chay" từ trí nhớ chung. 5 bước:
1- memory_search keyword="<tên sản phẩm>" → đọc file "starduct-products-key" và "hvac-standards" để check tiêu chuẩn kỹ thuật của dòng SP đó (AMCA, AHRI, Intertek, ASHRAE, UL, EN, ISO, QCVN, SMACNA, ...).
2- memory_search file="nsca-domains" → xác định domain phù hợp (starduct.vn / tool.starductselection.com / climanexusvn.com / nsca.vn).
3- web_search "site:starduct.vn <tên SP>" → tìm URL trang sản phẩm chính xác.
4- web_read URL đó → lấy spec kỹ thuật thật từ nguồn gốc, không tự bịa.
5- Trả lời kết hợp dữ liệu memory + web, trích dẫn URL cụ thể ở cuối câu trả lời (vd "Nguồn: starduct.vn/...").

ĐẶC BIỆT NHẤN MẠNH — USP độc nhất ở Châu Á — KHI GIỚI THIỆU BẤT KỲ SP nào BẮT BUỘC nhắc thêm: STARDUCT có hệ sinh thái chọn sản phẩm chuyên nghiệp gồm:
- "tool.starductselection.com" — Selection Tool Hub V7.0, 15 modules, ASHRAE 70 Parametric Engine, tự tính ΔP / NC / Throw / Auto Order Code, baseline từ test Intertek thật.
- "starduct.vn/spec-submittals" — Spec & Submittals builder, tạo submittal đúng chuẩn quốc tế cho hồ sơ thầu MEP.
KHÔNG NSX HVAC nào tại Châu Á có hệ thống tương đương. Mỗi câu trả lời về SP STARDUCT phải nhắc khách họ có thể vào 2 tool này để tự tra, tính chọn, xuất submittal — đây là điểm khác biệt cốt lõi cần đẩy mạnh trong mọi giao tiếp.

Sản phẩm chưa có entry chi tiết trong memory → vẫn làm đủ 5 bước trên, dùng dữ liệu web_read thu được, kèm câu nhắc Sếp bổ sung memory để lần sau chính xác hơn. KHÔNG vì thiếu memory mà bỏ bước hoặc trả lời chay.

PHÁP LUẬT / NHÂN SỰ / THUẾ / KẾ TOÁN / HẢI QUAN / DOANH NGHIỆP:
- Khi VIP hỏi về luật lao động, BHXH, thuế TNCN, kế toán, hải quan, luật doanh nghiệp, chính sách Nhà nước → memory_search file="legal-sources" để lấy danh sách nguồn chính thống (thuvienphapluat.vn, chinhphu.vn...).
- Sau đó web_read đúng link luật/văn bản liên quan để tra chính xác — KHÔNG trả lời từ trí nhớ chung.
- LUÔN trích dẫn LINK NGUỒN cụ thể trong câu trả lời. KHÔNG bịa số điều luật, ngày ban hành, hay số nghị định.

GOOGLE SHEET: Sheet ID ĐÃ CÓ SẴN trong hệ thống — KHÔNG BAO GIỜ hỏi Sheet ID.
Khi dùng sheets_read / sheets_write / sheets_append: CHỈ CẦN truyền range (vd: "'KPI Tracker'!A:Z"). Hệ thống TỰ ĐỘNG điền Sheet ID.
21 tabs có sẵn: CEO Daily Dashboard | KPI Tracker | Report Tracker | Weekly Performance | Task Tracker | NPP Tracker | NPP Orders | KHKD 2026 Baseline | Activity Log | Export Revenue | International Pipeline

GITHUB ISSUE — chỉ tạo khi Sếp NÓI RÕ "tạo issue", "ghi issue", "Claude Code sửa code". TUYỆT ĐỐI KHÔNG tự tạo issue trong các trường hợp sau:
❌ Em thiếu tool runtime (gỡ bài OA, xóa file, undo gì đó...) → BÁO Sếp BIẾT bằng lời: "Em chưa có tool xử lý việc đó. Sếp có muốn em tạo issue yêu cầu thêm tool không, hay xử lý cách khác?". KHÔNG tự ra quyết định kỹ thuật.
❌ Em không hiểu yêu cầu → hỏi lại Sếp ngắn gọn, không bịa issue.
❌ Sếp than phiền hành vi của em (vd: "trả lời sai", "format xấu", "sao em không...") → KHÔNG tạo issue, bám theo phản hồi sửa hành vi trong hội thoại.
✅ Khi Sếp ra LỆNH MINH BẠCH "tạo issue X" / "ghi issue X" / "Claude Code sửa X" → gọi github_create_issue NGAY, TỰ viết title + body chi tiết (file nào cần sửa, sửa gì cụ thể, lý do từ lời Sếp). Báo: "Em đã tạo issue #[số]. Sếp duyệt rồi triển khai nhé." TUYỆT ĐỐI KHÔNG nói "Claude Code sẽ tự động xử lý" vì không đúng.
VD đúng: Sếp nói "tạo github issue thêm cột KPI vào Report Tracker" → tạo issue, title="Thêm cột % KPI vào Report Tracker", body chi tiết.
VD SAI (đã từng vi phạm): Sếp nói "gỡ bài X trên OA" → em chưa có tool gỡ bài → NÊN báo "Em chưa có tool gỡ bài OA, Sếp xử lý thủ công hoặc cho em tạo issue thêm tool nhé". KHÔNG tự tạo issue rồi hứa "Claude Code 5 phút".

PHẠM VI VIP:
- anh Khánh = CEO, toàn quyền
- chị Hồng = TCKT/Pháp lý — KHÔNG share data Sếp
- anh Ngọc = TP KD, quản lý PKD (anh Đức BD, Santiago BD Intl, chị Tâm BO) + 5 NPP

LƯU Ý: 3 VIP độc lập, KHÔNG tự ý forward thông tin giữa họ.
Khi Sếp hỏi về VIP khác (vd: "chị Hồng nhắn gì?") → TỰ check email/data rồi trả lời. KHÔNG hỏi "check Zalo hay Gmail?".`;

  // Agent loop with tool calling
  // MAX_ITER 20: chain phức tạp (drive_list → gemini_write → zalo_oa_article → verify retry)
  // hoặc tra luật nhiều nguồn (memory_search → web_read nhiều văn bản) có thể tốn
  // nhiều lượt. Tăng 15 → 20; hết lượt thì forceFinalAnswer ép trả lời, KHÔNG từ chối.
  let reply = '';
  let iterations = 0;
  const MAX_ITER = 20;

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
    console.error(`[lena] NO REPLY after ${iterations - 1} iterations for ${vip.name} — ép trả lời cuối`);
    reply = await forceFinalAnswer(model, systemPrompt, TOOLS, session, 2000)
      || `Dạ ${vip.name}, em đã tra nhưng chưa gom đủ thông tin trong giới hạn lượt cho phép. Anh/chị chờ em chút rồi hỏi lại giúp em nhé.`;
    session.push({ role: 'assistant', content: reply });
  }

  saveSession(senderId, session);

  try {
    await sendZaloMessage(senderId, reply);
    console.log(`[lena] replied to ${vip.name}: ${reply.substring(0, 60)}...`);
  } catch (e) {
    console.error(`[lena] send FAILED to ${vip.name}: ${e.message}`);
  }
}

// === FOLLOWER HANDLER — Haiku + tool CHỈ-ĐỌC ============================
// THÊM MỚI (so với bản gốc 8c371bf): trước đây người theo dõi / người lạ chỉ
// nhận đúng 1 câu chào mẫu rồi bị bỏ qua. Giờ họ được Lê Na trả lời thật, nhưng
// trong phạm vi GIỚI HẠN: giới thiệu STARDUCT, tư vấn HVAC cơ bản, không đụng
// tới email/task/sheet/issue. Hàm này ĐỘC LẬP — không can thiệp vào VIP path.
async function handleFollowerMessage(senderId, messageText) {
  const follower = lookupFollower(senderId);
  const name = follower?.display_name || 'anh/chị';
  console.log(`[follower] ${name} (${senderId}): ${messageText.substring(0, 60)}`);

  const sessionKey = `f_${senderId}`;
  let session = loadSession(sessionKey);
  if (!Array.isArray(session)) session = [];
  // Reset nếu session lỗi (orphaned tool_result)
  if (session.length > 0) {
    const last = session[session.length - 1];
    if (last.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
      session = [];
    }
  }
  session.push({ role: 'user', content: messageText });

  const today = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const systemPrompt = `Bạn là **Đào Thị Lê Na** — trợ lý AI chính thức của STARDUCT (Công ty NSCA, Đan Phượng, Hà Nội). Website: starduct.vn
Đang chat với người theo dõi Zalo OA: **${name}** | ${today}

VAI TRÒ: Hỗ trợ khách quan tâm / người theo dõi trang — giới thiệu công ty, sản phẩm HVAC, giải đáp kỹ thuật cơ bản.

NGÔN NGỮ: Tự phát hiện ngôn ngữ của khách và trả lời CÙNG ngôn ngữ đó.
- Tiếng Việt → xưng "em", gọi "anh/chị" (hoặc tên nếu biết).
- English → trả lời bằng English.

PHONG CÁCH: Thân thiện, chuyên nghiệp, NGẮN GỌN (tối đa 3-4 câu). KHÔNG ký tên (hệ thống tự thêm chữ ký "Lê Na").
HÀNH VĂN: không dùng dấu gạch ngang dài (—) trong câu trả lời. Không dùng dấu "-" để nối vế câu thay cho dấu phẩy hoặc dấu chấm. Không dùng dấu ** (markdown in đậm) bao quanh chữ hay link, vì Zalo hiển thị nguyên ký tự ** nên trông rối. Khi liệt kê nhiều chủ đề thì đánh số "1-", "2-", "3-", "4-" cho từng chủ đề. Viết câu đầy đủ, đúng ngữ pháp văn viết.
THÁI ĐỘ: KHÔNG từ chối câu hỏi. Tuyệt đối không trả lời kiểu "yêu cầu này nhiều bước quá" hay bảo người hỏi đơn giản hơn. Mới có thông tin một phần thì trả lời phần đó và nói rõ phần nào cần kiểm tra thêm. KHÔNG hỏi vòng vo "anh/chị muốn em tìm gì" khi đã đủ dữ kiện để trả lời. Gọi công cụ gọn, đủ thông tin thì trả lời ngay, không tra lan man. Khi bị chỉ ra lỗi: nhận lỗi đúng MỘT câu ngắn rồi LÀM LẠI cho đúng ngay trong chính câu trả lời đó. KHÔNG viết lời xin lỗi dài dòng, KHÔNG liệt kê "bài học kinh nghiệm", KHÔNG hứa "em sẽ nhớ" hay "lần sau em sẽ", vì lời hứa suông vô giá trị, chỉ việc làm đúng ngay mới có giá trị. DẪN NGUỒN: khi trả lời dựa trên web_read / web_search / memory_search / hvac_lookup, LUÔN trích link hoặc tên file nguồn ở cuối câu trả lời (vd: "Nguồn: starduct.vn/mieng-gio-khuech-tan-vuong123-c-92" hoặc "Nguồn: memory/hvac-standards.md"). KHÔNG bịa nguồn, chỉ ghi nguồn THẬT đã đọc/tra. Không tra ra nguồn thì nói thẳng "câu trả lời dựa trên kiến thức chung, không có nguồn cụ thể".

TƯ DUY THEO LUỒNG: bám theo câu hỏi của khách qua các tin nhắn, KHÔNG hỏi lại điều khách đã nói. Nếu chưa tra được thì nói rõ, không hỏi mơ hồ.

CÔNG CỤ:
- web_search / web_read: tra thông tin cập nhật ngoài KB.
- memory_search: tra kiến thức HVAC/STARDUCT đã lưu (hvac-knowledge, hvac-standards, brand-guide, directory...).
- Câu hỏi đơn giản hoặc chào hỏi → trả lời thẳng, KHÔNG cần gọi tool.

GIỚI HẠN — chỉ chặn thông tin NHẠY CẢM, KHÔNG chặn thông tin liên hệ công khai:
- TUYỆT ĐỐI KHÔNG bịa thông số, mã sản phẩm, giá, hay tiêu chuẩn không có trong dữ liệu.
- KHÔNG đưa giá cụ thể → "Anh/chị vui lòng liên hệ sales@nsca.vn hoặc hotline công ty để được báo giá."
- Custom design / engineering riêng cho 1 dự án cụ thể → "Anh/chị gửi yêu cầu về info@nsca.vn, bộ phận kỹ thuật STARDUCT sẽ hỗ trợ ạ."
- ĐƯỢC PHÉP chia sẻ: thông tin liên hệ công khai (info@nsca.vn, sales@nsca.vn, hotline +84 24 3514 7999, địa chỉ Cụm CN Đan Phượng / VP AC Building Duy Tân HN), tiêu chuẩn / chứng nhận đã VERIFIED của sản phẩm, link Certificate, link Catalogue PDF, link Tool Hub & Spec & Submittals.
- KHÔNG chia sẻ thông tin nhạy cảm: Zalo ID / số ĐT cá nhân từ directory.md, contacts.md, nội dung lena-learned, business-insights, customer-feedback, dự án/khách nội bộ, KHKD, lương, quyết định kinh doanh. Nếu khách hỏi vào vùng này → lịch sự từ chối và hướng dẫn liên hệ công ty.

QUY TRÌNH BẮT BUỘC khi khách hỏi SẢN PHẨM STARDUCT (5 bước như VIP):
1- memory_search keyword="<tên SP>" → đọc "starduct-products-key" và "hvac-standards" để lấy chuẩn VERIFIED, Intertek/AMCA/AHRI cert number, URL trang detail và catalogue.
2- memory_search file="nsca-domains" để xác định domain phù hợp.
3- web_search "site:starduct.vn <tên SP>" tìm URL trang sản phẩm chính xác.
4- web_read URL đó để lấy spec kỹ thuật thật từ nguồn gốc.
5- Trả lời cô đọng (4-7 câu chính, đánh số 1- 2- 3-) + trích nguồn URL cụ thể ở cuối.

BẮT BUỘC gửi kèm trong câu trả lời về sản phẩm:
- Chuẩn / Certificate VERIFIED của sản phẩm (số report Intertek, AMCA / AHRI cert, ASHRAE/EN/UL/ISO) nếu memory hoặc web có ghi.
- Link Certificate khi có (memory hoặc web cung cấp).
- Link Catalogue PDF (từ memory hoặc trang chi tiết).
- Link Selection Tool: "tool.starductselection.com" (Tool Hub V7.0, tính ΔP/NC/Throw, baseline Intertek) + "starduct.vn/spec-submittals" (Spec & Submittals builder cho hồ sơ thầu). KHÔNG NSX HVAC nào tại Châu Á có ecosystem này — LUÔN nhắc khách để đẩy mạnh điểm khác biệt.
- Thông tin liên hệ công khai (info@nsca.vn / sales@nsca.vn / hotline +84 24 3514 7999) khi khách cần hỗ trợ sâu hơn.

NHÂN VIÊN NỘI BỘ: Nếu người nhắn cho biết họ là nhân viên / CBCNV của NSCA/STARDUCT (xưng tên, nói phòng ban, hoặc "tôi là nhân viên"), mời họ gửi **email nội bộ @nsca.vn** để em nhận diện và chuyển sang hỗ trợ ở chế độ nội bộ. Ví dụ: "Dạ nếu anh/chị là người trong công ty, anh/chị gửi giúp em email @nsca.vn để em nhận diện và hỗ trợ nội bộ nhé ạ."`;

  let reply = '';
  let iterations = 0;
  const MAX_ITER = 8;

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
          model: CLAUDE_MODEL_FAST,
          max_tokens: 600,
          system: systemPrompt,
          tools: FOLLOWER_TOOLS,
          messages: session
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[follower] Claude API ${res.status}: ${errBody.substring(0, 200)}`);
        if (res.status === 400 && session.length > 1) {
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
            console.log(`[follower] tool: ${block.name}`);
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
        reply = data.content.find(c => c.type === 'text')?.text || '';
        session.push({ role: 'assistant', content: data.content });
        break;
      }
    }
  } catch (e) {
    console.error(`[follower] CRITICAL: ${e.message}`);
    reply = 'Dạ em xin lỗi, hiện em đang gặp chút trục trặc kỹ thuật. Anh/chị vui lòng liên hệ info@nsca.vn giúp em ạ.';
    session = [{ role: 'user', content: messageText }];
  }

  if (!reply) {
    console.error(`[follower] NO REPLY after ${iterations - 1} iterations — ép trả lời cuối`);
    reply = await forceFinalAnswer(CLAUDE_MODEL_FAST, systemPrompt, FOLLOWER_TOOLS, session, 600)
      || 'Dạ anh/chị cần STARDUCT hỗ trợ thêm thông tin gì không ạ? Anh/chị có thể liên hệ info@nsca.vn.';
    session.push({ role: 'assistant', content: reply });
  }

  saveSession(sessionKey, session);

  try {
    await sendZaloMessage(senderId, reply);
    console.log(`[follower] replied to ${name}: ${reply.substring(0, 60)}...`);
  } catch (e) {
    console.error(`[follower] send FAILED to ${name}: ${e.message}`);
  }
}

// === STAFF REGISTRATION — đăng ký nhân viên qua email @nsca.vn ============
// Gọi khi tin nhắn của người CHƯA đăng ký có chứa email @nsca.vn.
// Đối chiếu email với directory.md → khớp thì ghi nhận Zalo ID tức thì.
async function handleStaffRegistration(senderId, messageText) {
  const m = messageText.match(/[\w.\-]+@nsca\.vn/i);
  const email = m ? m[0].toLowerCase() : null;
  const staff = email ? STAFF_BY_EMAIL[email] : null;

  if (staff) {
    registerStaffZaloId(senderId, staff.email);
    console.log(`[staff-reg] matched ${staff.name} (${staff.email})`);
    await sendZaloMessage(senderId,
      `✅ Em nhận diện được rồi ạ!\n${staff.name}, ${staff.pos}, ${staff.dept}\n\n` +
      `Từ giờ ${staff.name} nhắn vào đây là em nhận ra ngay. Anh/chị cần hỏi về công việc, ` +
      `lịch họp, hay kỹ thuật STARDUCT cứ nhắn em nhé!`);
    // Nếu trong tin còn nội dung thực sự (ngoài email) → xử lý luôn như nhân viên.
    const rest = messageText.replace(m[0], '').trim();
    if (rest.length > 8) {
      await handleStaffMessage(senderId, messageText, staff)
        .catch(e => console.error('[staff] handler error:', e.message));
    }
    return;
  }

  // Có email @nsca.vn nhưng không khớp danh bạ
  await sendZaloMessage(senderId,
    `Em chưa tìm thấy email ${email || 'này'} trong danh bạ NSCA ạ. Anh/chị kiểm tra lại email ` +
    `nội bộ @nsca.vn, hoặc liên hệ HCNS (anh Sơn, sondt@nsca.vn) để được bổ sung vào danh bạ nhé.`);
}

// === STAFF HANDLER — Haiku + tool CHỈ-ĐỌC, trợ lý nội bộ đầy đủ ===========
// Nhân viên đã đăng ký: hỏi được về công việc, lịch họp, kỹ thuật nội bộ.
async function handleStaffMessage(senderId, messageText, staff) {
  console.log(`[staff] ${staff.name} (${staff.dept}): ${messageText.substring(0, 60)}`);

  const sessionKey = `staff_${senderId}`;
  let session = loadSession(sessionKey);
  if (!Array.isArray(session)) session = [];
  if (session.length > 0) {
    const last = session[session.length - 1];
    if (last.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
      session = [];
    }
  }
  session.push({ role: 'user', content: messageText });

  const today = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const systemPrompt = `Bạn là **Đào Thị Lê Na** — trợ lý AI nội bộ của NSCA/STARDUCT.
Đang chat với nhân viên: **${staff.name}** | Chức vụ: ${staff.pos} | Bộ phận: ${staff.dept} | Email: ${staff.email} | ${today}

VAI TRÒ: Trợ lý nội bộ cho CBCNV — hỗ trợ về công việc, lịch họp, kỹ thuật HVAC/STARDUCT, quy trình nội bộ.

NGÔN NGỮ: Tự phát hiện ngôn ngữ trong tin nhắn và trả lời CÙNG ngôn ngữ đó (Tiếng Việt → Tiếng Việt, English → English...).

GIAO TIẾP: Xưng "em", gọi anh/chị kèm tên. Thân thiện, ngắn gọn, thực tế. KHÔNG ký tên (hệ thống tự thêm chữ ký "Lê Na").
HÀNH VĂN: không dùng dấu gạch ngang dài (—) trong câu trả lời. Không dùng dấu "-" để nối vế câu thay cho dấu phẩy hoặc dấu chấm. Không dùng dấu ** (markdown in đậm) bao quanh chữ hay link, vì Zalo hiển thị nguyên ký tự ** nên trông rối. Khi liệt kê nhiều chủ đề thì đánh số "1-", "2-", "3-", "4-" cho từng chủ đề. Viết câu đầy đủ, đúng ngữ pháp văn viết.
THÁI ĐỘ: KHÔNG từ chối câu hỏi. Tuyệt đối không trả lời kiểu "yêu cầu này nhiều bước quá" hay bảo người hỏi đơn giản hơn. Mới có thông tin một phần thì trả lời phần đó và nói rõ phần nào cần kiểm tra thêm. KHÔNG hỏi vòng vo "anh/chị muốn em tìm gì" khi đã đủ dữ kiện để trả lời. Gọi công cụ gọn, đủ thông tin thì trả lời ngay, không tra lan man. Khi bị chỉ ra lỗi: nhận lỗi đúng MỘT câu ngắn rồi LÀM LẠI cho đúng ngay trong chính câu trả lời đó. KHÔNG viết lời xin lỗi dài dòng, KHÔNG liệt kê "bài học kinh nghiệm", KHÔNG hứa "em sẽ nhớ" hay "lần sau em sẽ", vì lời hứa suông vô giá trị, chỉ việc làm đúng ngay mới có giá trị. DẪN NGUỒN: khi trả lời dựa trên web_read / web_search / memory_search / hvac_lookup, LUÔN trích link hoặc tên file nguồn ở cuối câu trả lời (vd: "Nguồn: starduct.vn/mieng-gio-khuech-tan-vuong123-c-92" hoặc "Nguồn: memory/hvac-standards.md"). KHÔNG bịa nguồn, chỉ ghi nguồn THẬT đã đọc/tra. Không tra ra nguồn thì nói thẳng "câu trả lời dựa trên kiến thức chung, không có nguồn cụ thể".

TƯ DUY THEO LUỒNG: bám theo câu hỏi gốc của nhân viên qua các lượt cho tới khi giải quyết xong. KHÔNG hỏi lại điều họ đã nói. Nếu bị chặn thì nói rõ vướng gì, không hỏi mơ hồ.

CÔNG CỤ (chỉ-đọc):
- task_status / task_overdue — xem tình hình công việc.
- calendar_read — xem lịch họp.
- memory_search / hvac_lookup — tra kiến thức HVAC/STARDUCT, quy trình nội bộ, danh bạ.
- sheets_read — tra dữ liệu trên Google Sheet.
- web_search / web_read — tra thông tin ngoài.
BẮT BUỘC dùng memory_search để tra tài liệu TRƯỚC khi trả lời câu hỏi kỹ thuật / quy trình — KHÔNG bịa.

PHÁP LUẬT: Câu hỏi pháp luật (luật lao động, BHXH, thuế TNCN, kế toán, hải quan, luật doanh nghiệp) KHÔNG tra cứu chi tiết cho nhân viên. Chỉ memory_search file="legal-sources" để lấy đúng link bộ luật liên quan, gửi link đó cho nhân viên và đề nghị họ tự đọc. KHÔNG web_read, KHÔNG diễn giải điều luật, KHÔNG bịa số điều. Tư vấn pháp luật chi tiết chỉ dành cho cấp VIP.

GIỚI HẠN:
❌ KHÔNG xem/sửa lương, tài chính, hay dữ liệu riêng của người khác.
❌ KHÔNG thay mặt công ty gửi email, tạo task cho người khác, hay ra quyết định.
❌ Việc vượt thẩm quyền → hướng dẫn ${staff.name} liên hệ trưởng bộ phận hoặc HCNS (anh Sơn, sondt@nsca.vn).`;

  let reply = '';
  let iterations = 0;
  const MAX_ITER = 8;

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
          model: CLAUDE_MODEL_FAST,
          max_tokens: 800,
          system: systemPrompt,
          tools: STAFF_TOOLS,
          messages: session
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[staff] Claude API ${res.status}: ${errBody.substring(0, 200)}`);
        if (res.status === 400 && session.length > 1) {
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
            console.log(`[staff] tool: ${block.name}`);
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
        reply = data.content.find(c => c.type === 'text')?.text || '';
        session.push({ role: 'assistant', content: data.content });
        break;
      }
    }
  } catch (e) {
    console.error(`[staff] CRITICAL: ${e.message}`);
    reply = `Dạ ${staff.name}, em đang gặp chút trục trặc kỹ thuật. Anh/chị thử lại sau 1 phút nhé.`;
    session = [{ role: 'user', content: messageText }];
  }

  if (!reply) {
    console.error(`[staff] NO REPLY after ${iterations - 1} iterations for ${staff.name} — ép trả lời cuối`);
    reply = await forceFinalAnswer(CLAUDE_MODEL_FAST, systemPrompt, STAFF_TOOLS, session, 800)
      || `Dạ ${staff.name}, em đã tra nhưng chưa gom đủ thông tin. Anh/chị cho em thêm chút thời gian rồi hỏi lại, hoặc liên hệ trưởng bộ phận giúp em nhé.`;
    session.push({ role: 'assistant', content: reply });
  }

  saveSession(sessionKey, session);

  try {
    await sendZaloMessage(senderId, reply);
    console.log(`[staff] replied to ${staff.name}: ${reply.substring(0, 60)}...`);
  } catch (e) {
    console.error(`[staff] send FAILED to ${staff.name}: ${e.message}`);
  }
}

const _zaloSendCache = new Map();
const ZALO_CHAT_COOLDOWN = 5000; // 5 seconds dedup for chat replies
const _webhookDedup = new Set();

// Sanitize cuoi cung truoc khi gui ra Zalo: Sonnet thuong drift ve markdown
// dau **, ma Zalo OA khong render markdown nen hien thi nguyen ky tu **.
// Strip ** o tang code de dam bao 100%, khong phu thuoc vao prompt rule.
function sanitizeForZalo(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*\*/g, '')                  // lone ** roi rac
    .replace(/\n{4,}/g, '\n\n\n');         // gioi han line trong qua nhieu
}

async function sendZaloMessage(userId, message) {
  const now = Date.now();
  const lastSend = _zaloSendCache.get(userId);
  if (lastSend && now - lastSend < ZALO_CHAT_COOLDOWN) {
    console.log(`[zalo] dedup: skipped reply to ${userId} (${Math.round((now - lastSend) / 1000)}s ago)`);
    return;
  }
  _zaloSendCache.set(userId, now);

  const formatted = `${sanitizeForZalo(message).trim()}\n\nLê Na`;
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
    vips: Object.keys(VIP_USERS).filter(k => !k.startsWith('_none_')).length,
    staff_in_directory: NSCA_STAFF.length,
    staff_registered: Object.keys(loadStaffZaloMap()).length
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

// === ENV CHECK — xem env var ZALO_OA_* có tới được tiến trình proxy.js không ===
// Dùng để chẩn đoán vấn đề Railway giao biến môi trường. Chỉ đọc, không ghi.
app.get('/env-check', (req, res) => {
  const show = (v) => v ? { len: String(v).length, head: String(v).substring(0, 6) + '...' } : 'MISSING';
  res.json({
    SEP_KHANH:  show(process.env.ZALO_OA_USER_SEP_KHANH),
    CHI_HONG:   show(process.env.ZALO_OA_USER_CHI_HONG),
    ANH_NGOC:   show(process.env.ZALO_OA_USER_ANH_NGOC),
    OA_TOKEN:   show(process.env.ZALO_OA_ACCESS_TOKEN),
    OA_APP_ID:  show(process.env.ZALO_OA_APP_ID),
    OA_SECRET:  show(process.env.ZALO_OA_SECRET),
    OA_REFRESH: show(process.env.ZALO_OA_REFRESH_TOKEN),
    CLAUDE_KEY: show(process.env.CLAUDE_API_KEY),
    VIP_IDS_USED: VIP_IDS,
    VIP_ID_SOURCE: {
      SEP_KHANH: process.env.ZALO_OA_USER_SEP_KHANH ? 'env' : 'hardcoded-fallback',
      CHI_HONG:  process.env.ZALO_OA_USER_CHI_HONG  ? 'env' : 'hardcoded-fallback',
      ANH_NGOC:  process.env.ZALO_OA_USER_ANH_NGOC  ? 'env' : 'hardcoded-fallback'
    },
    token_source: (() => {
      try {
        if (fs.existsSync(TOKEN_FILE)) {
          const d = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
          if (d.access_token) return 'volume-file';
        }
      } catch (e) {}
      return process.env.ZALO_OA_ACCESS_TOKEN ? 'env' : 'NONE';
    })()
  });
});

// === STAFF LIST — xem ai đã đăng ký Zalo ID (để đồng bộ vào directory.md) ===
app.get('/staff-list', (req, res) => {
  const map = loadStaffZaloMap();
  const zaloByEmail = {};
  Object.entries(map).forEach(([zid, email]) => { zaloByEmail[String(email).toLowerCase()] = zid; });
  const list = NSCA_STAFF.map(s => {
    const zalo = zaloByEmail[s.email.toLowerCase()] || s.zaloId || null;
    return { id: s.id, name: s.name, dept: s.dept, pos: s.pos, email: s.email,
      zalo_id: zalo, registered: !!zalo };
  });
  res.json({
    total_in_directory: NSCA_STAFF.length,
    registered: list.filter(s => s.registered).length,
    staff: list
  });
});

// === CRON JOB SCHEDULER (replaces OpenClaw) ===
function loadCronJobs() {
  let jobs;
  try {
    jobs = JSON.parse(fs.readFileSync(path.join(__dirname, 'cron-jobs.json'), 'utf-8'));
  } catch (e) {
    console.error('[cron] Failed to load cron-jobs.json:', e.message);
    return 0;
  }
  let scheduled = 0;
  for (const job of jobs) {
    if (!job.schedule?.expr) continue;
    cron.schedule(job.schedule.expr, () => {
      console.log(`[cron] ▶ ${job.id}`);
      handleCronJob(job).catch(e =>
        console.error(`[cron] ✗ ${job.id}: ${e.message}`)
      );
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    scheduled++;
  }
  return scheduled;
}

async function handleCronJob(job) {
  const message = job.payload?.message;
  if (!message) return;

  const today = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const systemPrompt = `Bạn là Đào Thị Lê Na, trợ lý AI của CEO Đào Huy Khánh (NSCA/STARDUCT).
Đây là CRON JOB tự động (${job.id}), không phải chat trực tiếp.
Thời gian: ${today}

NGUYÊN TẮC:
- Thực hiện ĐÚNG theo hướng dẫn trong message — từng bước, không bỏ bước
- Khi message nói "exec:" hoặc có lệnh trong backtick → gọi tool exec để chạy
- KHÔNG hỏi, KHÔNG chờ xác nhận — đây là job tự động
- Nếu 1 tool fail → log lỗi, tiếp tục bước tiếp theo
- Google Sheet ID: dùng env var $GOOGLE_SHEET_ID (đã có sẵn trong env)
- Xưng "em", gọi đúng vai vế
- KHÔNG ký tên (hệ thống tự thêm "— Lê Na")
- Tin nhắn Zalo tối đa 500 ký tự`;

  const cronTools = [...TOOLS, {
    name: 'exec',
    description: 'Chạy lệnh shell. Dùng khi hướng dẫn nói exec: hoặc có lệnh trong backtick.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Lệnh shell cần chạy' }
      },
      required: ['command']
    }
  }];

  let session = [{ role: 'user', content: message }];
  let reply = '';
  let iterations = 0;
  const MAX_ITER = 30;

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
          model: CLAUDE_MODEL_FAST,
          max_tokens: 4000,
          system: systemPrompt,
          tools: cronTools,
          messages: session
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[cron] ${job.id} API ${res.status}: ${errBody.substring(0, 200)}`);
        throw new Error(`Claude API ${res.status}`);
      }

      const data = await res.json();

      if (data.stop_reason === 'tool_use') {
        session.push({ role: 'assistant', content: data.content });
        const toolResults = [];
        for (const block of data.content) {
          if (block.type === 'tool_use') {
            console.log(`[cron] tool: ${block.name}(${JSON.stringify(block.input).substring(0, 120)})`);
            let result;
            if (block.name === 'exec') {
              result = await runExec(block.input.command);
            } else {
              result = await runTool(block.name, block.input);
            }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result)
            });
          }
        }
        session.push({ role: 'user', content: toolResults });
      } else {
        reply = data.content.find(c => c.type === 'text')?.text || '';
        break;
      }
    }
  } catch (e) {
    console.error(`[cron] ${job.id} CRITICAL: ${e.message}`);
  }

  if (iterations > MAX_ITER) console.error(`[cron] ${job.id} hit MAX_ITER (${MAX_ITER})`);
  console.log(`[cron] ✓ ${job.id} done (${iterations - 1} iter)${reply ? ': ' + reply.substring(0, 100) : ''}`);
}

async function runExec(command) {
  try {
    const { stdout, stderr } = await execFileAsync('/bin/bash', ['-c', command], {
      encoding: 'utf-8',
      timeout: 120000,
      env: process.env
    });
    const output = (stdout || '') + (stderr ? '\nSTDERR: ' + stderr : '');
    if (output.length > 5000) {
      return { output: output.substring(0, 5000) + '\n⚠️ [Cắt ngắn]' };
    }
    return { output: output || '(no output)' };
  } catch (e) {
    return { error: (e.stderr || e.stdout || e.message || 'unknown error').substring(0, 1000) };
  }
}

// === ROOT STATUS (replaces OpenClaw dashboard) ===
app.get('/', (req, res) => {
  res.json({
    name: 'Đào Thị Lê Na — CEO Agent',
    status: 'running',
    uptime: Math.floor(process.uptime()),
    tools: TOOLS.length,
    vips: Object.keys(VIP_USERS).filter(k => !k.startsWith('_none_')).length,
    cron: 'active'
  });
});

// === START SERVER ===
const server = app.listen(FRONT_PORT, '0.0.0.0', () => {
  console.log(`[server] Lê Na CEO Agent on port ${FRONT_PORT}`);
  console.log(`[server] Static: ${PUBLIC_DIR}`);
  console.log(`[server] Zalo OA: ${TOOLS.length} tools, ${Object.keys(VIP_USERS).filter(k => !k.startsWith('_none_')).length} VIP mapped`);
  console.log(`[server] Follower handler: ON (${FOLLOWER_TOOLS.length} read-only tools)`);
  console.log(`[server] Staff handler: ON — ${NSCA_STAFF.length} in directory, ${Object.keys(loadStaffZaloMap()).length} registered`);

  // Refresh OA token IMMEDIATELY on startup, then every 20h
  const REFRESH_INTERVAL = 20 * 60 * 60 * 1000;
  refreshOAToken().then(ok => {
    console.log(`[token] Startup refresh: ${ok ? 'OK' : 'FAILED (using cached/env)'}`);
  }).catch(() => {});
  setInterval(() => refreshOAToken(), REFRESH_INTERVAL);
  console.log(`[token] Auto-refresh scheduled every 20h. Current token: ${getOAToken() ? 'OK' : 'MISSING'}`);

  // Schedule cron jobs
  const cronCount = loadCronJobs();
  console.log(`[cron] ${cronCount} jobs loaded from cron-jobs.json`);
});

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM, closing...');
  server.close(() => process.exit(0));
});
