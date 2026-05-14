#!/usr/bin/env node
// ============================================================
// LÊ NA AI — Zalo OA Bridge · proxy.js
// 3 tầng user:
//   VIP     → claude-sonnet-4-5 + full tools
//   CBCNV   → claude-haiku-4-5-20251001 + task/lịch/HVAC
//   Follower → claude-haiku-4-5-20251001 + HVAC KB + web search
//
// Staff list: parse từ /app/memory/MEMORY.md (1 nguồn duy nhất)
// Zalo ID:   lưu /root/.openclaw/staff-zalo-ids.json
// ============================================================

const express  = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const fs   = require('fs');

const FRONT_PORT    = parseInt(process.env.PORT || '8080', 10);
const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_INTERNAL_PORT || '8090', 10);
const PUBLIC_DIR    = path.join(__dirname, 'public');
const GTOOL         = '/app/google-tools';
const MEMORY_FILE   = '/app/memory/MEMORY.md';
const SHEET_ID      = process.env.GOOGLE_SHEET_ID || '';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

const MODEL_VIP      = 'claude-sonnet-4-5';           // VIP
const MODEL_STAFF    = 'claude-haiku-4-5-20251001';   // CBCNV nội bộ
const MODEL_FOLLOWER = 'claude-haiku-4-5-20251001';   // Follower/khách

// ============================================================
// === PARSE STAFF FROM MEMORY.MD
// === Đọc tất cả bảng markdown có cột Email trong MEMORY.md
// === Mỗi hàng → { id, name, gender, pos, dept, email, phone }
// ============================================================
function parseStaffFromMemory() {
  const staff  = [];
  const emails = new Set();
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      console.error(`[memory] File not found: ${MEMORY_FILE}`);
      return staff;
    }
    const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
    const lines   = content.split('\n');

    // Only parse tables under these dept headings (skip NPP, OEM, Truong bo phan, etc.)
    const STAFF_DEPTS = ['ban giam doc','phong kinh doanh','pkd','r&d','hcns','hanh chinh nhan su','tckt','tai chinh','qlsx','nha may','quan ly san xuat'];
    const isStaffDept = (d) => STAFF_DEPTS.some(k => d.toLowerCase().includes(k));

    let dept = '', inT = false;
    let colCode=-1, colName=-1, colGender=-1, colPos=-1, colEmail=-1, colPhone=-1;

    for (const raw of lines) {
      const line = raw.trim();

      // Section heading
      if (line.startsWith('#')) {
        inT = false;
        colCode=colName=colGender=colPos=colEmail=colPhone=-1;
        dept = line.replace(/^#+\s*/, '').trim();
        continue;
      }

      // Table header — must have email column
      if (!inT && line.startsWith('|') && /email/i.test(line)) {
        if (!isStaffDept(dept)) continue; // skip non-staff tables
        const cols = line.split('|').map(c => c.trim().toLowerCase());
        colCode   = cols.findIndex(c => c === 'code' || c === 'id');
        colName   = cols.findIndex(c => c.includes('ho ten') || c === 'name' || c === 'ten');
        colGender = cols.findIndex(c => c.includes('gioi tinh') || c === 'gender');
        colPos    = cols.findIndex(c => c.includes('chuc vu') || c === 'position' || c === 'pos');
        colEmail  = cols.findIndex(c => c === 'email');
        colPhone  = cols.findIndex(c => c.includes('sdt') || c.includes('phone'));
        if (colEmail >= 0 && colName >= 0) inT = true;
        continue;
      }

      // Separator row
      if (inT && line.includes('---')) continue;

      // Data row
      if (inT && line.startsWith('|')) {
        const cells = line.split('|').map(c => c.trim());
        const cell  = (i) => (i >= 0 && i < cells.length) ? cells[i] : '';
        const email = cell(colEmail).toLowerCase().trim();
        if (!email.includes('@nsca.vn')) continue;
        if (emails.has(email)) continue;
        emails.add(email);

        const name   = cell(colName).trim();
        if (!name) continue;
        const gender = cell(colGender).trim();
        const pos    = cell(colPos).trim();
        const phone  = cell(colPhone).trim();
        const id     = cell(colCode).trim() || `AUTO_${staff.length + 1}`;

        // Nickname: Anh/Chị + last name
        const parts    = name.split(/\s+/);
        const lastName = parts[parts.length - 1];
        const isFemale = /^nữ$/i.test(gender) || (/^n/i.test(gender) && !/^nam$/i.test(gender));
        const nick     = `${isFemale ? 'Chị' : 'Anh'} ${lastName}`;

        staff.push({ id, name, nick, gender, pos, dept, email, phone });
        continue;
      }

      // End of table
      if (inT && line !== '' && !line.startsWith('|')) {
        inT = false;
        colCode=colName=colGender=colPos=colEmail=colPhone=-1;
      }
    }
  } catch (e) {
    console.error(`[memory] Parse error: ${e.message}`);
  }
  console.log(`[memory] Loaded ${staff.length} CBCNV from MEMORY.md`);
  if (staff.length > 0) {
    const depts = [...new Set(staff.map(s => s.dept))];
    console.log(`[memory] Depts: ${depts.join(', ')}`);
  }
  return staff;
}
// Load once at startup + build email→staff map
let NSCA_STAFF = parseStaffFromMemory();
const STAFF_BY_EMAIL = {};
NSCA_STAFF.forEach(s => { STAFF_BY_EMAIL[s.email] = s; });

// Reload every 10 min in case MEMORY.md is updated
setInterval(() => {
  NSCA_STAFF = parseStaffFromMemory();
  NSCA_STAFF.forEach(s => { STAFF_BY_EMAIL[s.email] = s; });
}, 10 * 60 * 1000);

// ============================================================
// === ZALO ID FILE  (/root/.openclaw/staff-zalo-ids.json)
// === { "zaloId": "email@nsca.vn" }
// ============================================================
const ZALO_ID_FILE = '/root/.openclaw/staff-zalo-ids.json';

function loadZaloIdMap() {
  try { if (fs.existsSync(ZALO_ID_FILE)) return JSON.parse(fs.readFileSync(ZALO_ID_FILE, 'utf-8')); } catch(e) {}
  return {};
}
function saveZaloIdMap(map) {
  try { fs.writeFileSync(ZALO_ID_FILE, JSON.stringify(map, null, 2)); } catch(e) {}
}
function lookupStaffByZaloId(zaloId) {
  const map = loadZaloIdMap();
  const email = map[zaloId];
  return email ? (STAFF_BY_EMAIL[email.toLowerCase()] || null) : null;
}
function registerStaffZaloId(zaloId, email) {
  const map = loadZaloIdMap();
  map[zaloId] = email.toLowerCase();
  saveZaloIdMap(map);
  console.log(`[staff-reg] ${zaloId} → ${email}`);
}
function lookupStaffByInput(input) {
  const q = input.toLowerCase().trim();
  // Match email first
  if (q.includes('@nsca.vn')) {
    const em = q.match(/[\w.]+@nsca\.vn/)?.[0];
    if (em && STAFF_BY_EMAIL[em]) return STAFF_BY_EMAIL[em];
  }
  // Match name / nick
  return NSCA_STAFF.find(s =>
    s.name.toLowerCase().includes(q) ||
    s.nick.toLowerCase().includes(q) ||
    s.email.split('@')[0] === q.split('@')[0]
  ) || null;
}

// ============================================================
// === VIP CONFIG
// ============================================================
const VIP_USERS = {
  [process.env.ZALO_OA_USER_SEP_KHANH || '_none_sep']: { name: 'anh Khánh', alias: 'sep-khanh', role: 'CEO' },
  [process.env.ZALO_OA_USER_CHI_HONG  || '_none_hong']: { name: 'chị Hồng',  alias: 'chi-hong',  role: 'GĐ Pháp lý + TCKT' },
  [process.env.ZALO_OA_USER_ANH_NGOC  || '_none_ngoc']: { name: 'anh Ngọc',  alias: 'anh-ngoc',  role: 'TP Kinh Doanh' },
};

// ============================================================
// === ZALO OA TOKEN
// ============================================================
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';
function getOAToken() {
  try { if (fs.existsSync(TOKEN_FILE)) { const d = JSON.parse(fs.readFileSync(TOKEN_FILE,'utf-8')); if (d.access_token) return d.access_token; } } catch(e) {}
  return process.env.ZALO_OA_ACCESS_TOKEN;
}
function getRefreshToken() {
  try { if (fs.existsSync(TOKEN_FILE)) { const d = JSON.parse(fs.readFileSync(TOKEN_FILE,'utf-8')); if (d.refresh_token) return d.refresh_token; } } catch(e) {}
  return process.env.ZALO_OA_REFRESH_TOKEN;
}
async function refreshOAToken() {
  const rt = getRefreshToken(), appId = process.env.ZALO_OA_APP_ID, secret = process.env.ZALO_OA_SECRET;
  if (!rt || !appId || !secret) { console.error('[token] Missing credentials'); return false; }
  try {
    const res  = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', { method:'POST', headers:{'secret_key':secret,'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({refresh_token:rt,app_id:appId,grant_type:'refresh_token'}).toString() });
    const data = await res.json();
    if (data.access_token) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({access_token:data.access_token,refresh_token:data.refresh_token,refreshed_at:new Date().toISOString(),expires_in:data.expires_in},null,2));
      console.log(`[token] Refreshed at ${new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`);
      return true;
    }
    console.error('[token] Failed:', JSON.stringify(data)); return false;
  } catch(e) { console.error('[token]', e.message); return false; }
}

// ============================================================
// === SESSION
// ============================================================
const SESSION_DIR = '/root/.openclaw/zalo-oa-sessions';
try { fs.mkdirSync(SESSION_DIR, {recursive:true}); } catch(e) {}
function loadSession(key) {
  try { const f=path.join(SESSION_DIR,`${key}.json`); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf-8')); } catch(e) {}
  return [];
}
function saveSession(key, msgs) {
  try { fs.writeFileSync(path.join(SESSION_DIR,`${key}.json`), JSON.stringify(msgs.slice(-20),null,2)); } catch(e) {}
}
function getSessionAgeMin(key) {
  try { const f=path.join(SESSION_DIR,`${key}.json`); if (fs.existsSync(f)) return Math.floor((Date.now()-fs.statSync(f).mtime.getTime())/60000); } catch(e) {}
  return Infinity;
}

// ============================================================
// === FOLLOWER PERSISTENT MEMORY (Google Sheet "Follower Memory")
// ============================================================
const FOLLOWER_SHEET = "'Follower Memory'";
async function loadFollowerProfile(userId) {
  try {
    const {stdout} = await execFileAsync('node',[`${GTOOL}/sheets-read.js`,SHEET_ID,`${FOLLOWER_SHEET}!A:H`],{encoding:'utf-8',timeout:15000});
    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      try { const r=JSON.parse(line); if (Array.isArray(r)&&r[0]===userId) return {userId:r[0],name:r[1]||null,firstSeen:r[2],lastSeen:r[3],language:r[4]||'vi',topics:r[5]||'',lastMessage:r[6]||''}; } catch(e) {}
    }
  } catch(e) { console.log(`[fmem:load] ${e.message}`); }
  return null;
}
async function saveFollowerProfile(userId, name, lang, topic, lastMsg) {
  const now = new Date().toISOString();
  try {
    const {stdout} = await execFileAsync('node',[`${GTOOL}/sheets-read.js`,SHEET_ID,`${FOLLOWER_SHEET}!A:A`],{encoding:'utf-8',timeout:15000});
    const lines = stdout.trim().split('\n').filter(Boolean);
    let row = -1;
    for (let i=0;i<lines.length;i++) { try { const c=JSON.parse(lines[i]); if ((Array.isArray(c)?c[0]:c)===userId){row=i+1;break;} } catch(e) {} }
    if (row>0) await execFileAsync('node',[`${GTOOL}/sheets-write.js`,SHEET_ID,`${FOLLOWER_SHEET}!D${row}:G${row}`,JSON.stringify([[now,lang,topic.substring(0,100),lastMsg.substring(0,100)]])],{encoding:'utf-8',timeout:15000});
    else        await execFileAsync('node',[`${GTOOL}/sheets-append.js`,SHEET_ID,`${FOLLOWER_SHEET}!A:H`,JSON.stringify([[userId,name,now,now,lang,topic.substring(0,100),lastMsg.substring(0,100),'']])],{encoding:'utf-8',timeout:15000});
  } catch(e) { console.log(`[fmem:save] ${e.message}`); }
}

// ============================================================
// === HVAC KNOWLEDGE BASE — embedded (KB-1.0 · 2026-05-13)
// ============================================================
// ============================================================
// === LENA KB — đọc từ /app/memory/LENA_KB.md
// === Cập nhật file trên GitHub → Railway redeploy → tự reload
// ============================================================
const KB_FILE = '/app/memory/LENA_KB.md';

function loadKB() {
  try {
    if (fs.existsSync(KB_FILE)) {
      const kb = fs.readFileSync(KB_FILE, 'utf-8');
      console.log(`[kb] Loaded ${kb.length} chars from ${KB_FILE}`);
      return kb;
    }
    console.error(`[kb] File not found: ${KB_FILE}`);
  } catch(e) { console.error(`[kb] Load error: ${e.message}`); }
  return '## KB not loaded — file missing';
}

let LENA_KB = loadKB();
// Reload mỗi 10 phút (sync với MEMORY.md reload)
setInterval(() => { LENA_KB = loadKB(); }, 10 * 60 * 1000);


// ============================================================
// === TOOLS
// ============================================================
const VIP_TOOLS = [
  {name:'email_send',description:'Gửi email.',input_schema:{type:'object',properties:{to:{type:'string'},subject:{type:'string'},body:{type:'string'},cc:{type:'string'}},required:['to','subject','body']}},
  {name:'email_read',description:'Đọc email.',input_schema:{type:'object',properties:{hours:{type:'number'},max:{type:'number'},query:{type:'string'}},required:['hours']}},
  {name:'email_reply',description:'Reply email.',input_schema:{type:'object',properties:{message_id:{type:'string'},body:{type:'string'},cc:{type:'string'}},required:['message_id','body']}},
  {name:'calendar_read',description:'Đọc lịch.',input_schema:{type:'object',properties:{days:{type:'number'}}}},
  {name:'calendar_create',description:'Tạo lịch.',input_schema:{type:'object',properties:{title:{type:'string'},start:{type:'string'},end:{type:'string'},description:{type:'string'},location:{type:'string'}},required:['title','start','end']}},
  {name:'sheets_read',description:'Đọc Sheet.',input_schema:{type:'object',properties:{range:{type:'string'}},required:['range']}},
  {name:'sheets_write',description:'Ghi đè Sheet.',input_schema:{type:'object',properties:{range:{type:'string'},values:{type:'string'}},required:['range','values']}},
  {name:'sheets_append',description:'Thêm dòng Sheet.',input_schema:{type:'object',properties:{range:{type:'string'},values:{type:'string'}},required:['range','values']}},
  {name:'hvac_lookup',description:'Tra HVAC KB từ Sheet gốc.',input_schema:{type:'object',properties:{keyword:{type:'string'},range:{type:'string'}}}},
  {name:'memory_search',description:'Tra long-term memory.',input_schema:{type:'object',properties:{keyword:{type:'string'},file:{type:'string'}},required:['keyword']}},
  {name:'memory_update',description:'Lưu kiến thức mới.',input_schema:{type:'object',properties:{topic:{type:'string'},content:{type:'string'},section:{type:'string'}},required:['topic','content']}},
  {name:'gdoc_create',description:'Tạo Google Doc.',input_schema:{type:'object',properties:{title:{type:'string'},content:{type:'string'}},required:['title','content']}},
  {name:'task_add',description:'Tạo task.',input_schema:{type:'object',properties:{task:{type:'string'},assignee:{type:'string'},deadline:{type:'string'},source:{type:'string'}},required:['task','assignee','deadline']}},
  {name:'task_overdue',description:'Task quá hạn.',input_schema:{type:'object',properties:{}}},
  {name:'task_status',description:'Tổng hợp task.',input_schema:{type:'object',properties:{}}},
  {name:'task_update',description:'Cập nhật task.',input_schema:{type:'object',properties:{row:{type:'number'},status:{type:'string'}},required:['row','status']}},
  {name:'zalo_oa_send_to_vip',description:'Nhắn VIP qua OA.',input_schema:{type:'object',properties:{target:{type:'string',enum:['sep-khanh','chi-hong','anh-ngoc']},message:{type:'string'}},required:['target','message']}},
  {name:'zalo_oa_history',description:'Lịch sử Zalo OA.',input_schema:{type:'object',properties:{target:{type:'string',enum:['all','sep-khanh','chi-hong','anh-ngoc']},hours:{type:'number'}}}},
  {name:'github_create_issue',description:'Tạo GitHub Issue.',input_schema:{type:'object',properties:{title:{type:'string'},body:{type:'string'},requester:{type:'string'}},required:['title','body','requester']}},
  {name:'kpi_update',description:'Cập nhật KPI.',input_schema:{type:'object',properties:{}}},
  {name:'zalo_oa_article',description:'Đăng bài OA.',input_schema:{type:'object',properties:{action:{type:'string',default:'create'},title:{type:'string'},body:{type:'string'},cover:{type:'string'}},required:['title','body']}},
  {name:'image_overlay',description:'Ghép logo ảnh.',input_schema:{type:'object',properties:{input_image:{type:'string'},text:{type:'string'},output_path:{type:'string'},layout:{type:'string'}},required:['input_image']}},
  {name:'gemini_write',description:'Gemini soạn nội dung.',input_schema:{type:'object',properties:{prompt:{type:'string'},max_tokens:{type:'number'}},required:['prompt']}},
  {name:'drive_list',description:'Liệt kê Drive.',input_schema:{type:'object',properties:{folder_id:{type:'string'},query:{type:'string'},max:{type:'number'}}}},
  {name:'drive_download',description:'Tải Drive.',input_schema:{type:'object',properties:{file_id:{type:'string'},output_path:{type:'string'}},required:['file_id']}},
  {name:'web_search',description:'Tìm web.',input_schema:{type:'object',properties:{query:{type:'string'},max_results:{type:'number'}},required:['query']}},
  {name:'web_read',description:'Đọc trang web.',input_schema:{type:'object',properties:{url:{type:'string'}},required:['url']}},
  {name:'auto_learn',description:'Extract insights session.',input_schema:{type:'object',properties:{target:{type:'string'},hours:{type:'number'}}}},
  {name:'zalo_oa_comment',description:'Comment OA.',input_schema:{type:'object',properties:{action:{type:'string',enum:['list','reply','scan','scan-article']},article_id:{type:'string'},comment_id:{type:'string'},message:{type:'string'},hours:{type:'number'}},required:['action']}},
];

const STAFF_TOOLS = [
  {name:'web_search',description:'Tìm kiếm kỹ thuật, tiêu chuẩn.',input_schema:{type:'object',properties:{query:{type:'string'},max_results:{type:'number'}},required:['query']}},
  {name:'web_read',description:'Đọc trang web.',input_schema:{type:'object',properties:{url:{type:'string'}},required:['url']}},
  {name:'memory_search',description:'Tra HVAC/STARDUCT knowledge.',input_schema:{type:'object',properties:{keyword:{type:'string'},file:{type:'string'}},required:['keyword']}},
  {name:'task_status',description:'Xem trạng thái task.',input_schema:{type:'object',properties:{}}},
  {name:'task_overdue',description:'Task quá hạn.',input_schema:{type:'object',properties:{}}},
  {name:'calendar_read',description:'Xem lịch họp.',input_schema:{type:'object',properties:{days:{type:'number'}}}},
  {name:'sheets_read',description:'Tra cứu thông tin sản phẩm/quy trình.',input_schema:{type:'object',properties:{range:{type:'string'}},required:['range']}},
];

const FOLLOWER_TOOLS = [
  {name:'web_search',description:'Search web for HVAC standards, news.',input_schema:{type:'object',properties:{query:{type:'string'},max_results:{type:'number'}},required:['query']}},
  {name:'web_read',description:'Read a web page.',input_schema:{type:'object',properties:{url:{type:'string'}},required:['url']}},
  {name:'memory_search',description:'Search Lê Na HVAC/STARDUCT memory.',input_schema:{type:'object',properties:{keyword:{type:'string'},file:{type:'string'}},required:['keyword']}},
];

// ============================================================
// === TOOL RUNNER
// ============================================================
async function runTool(name, input) {
  let cmd, args;
  switch(name) {
    case 'email_send':     cmd='node';args=[`${GTOOL}/gmail-send.js`,input.to,input.subject,input.body,input.cc||'',''];break;
    case 'email_read':     cmd='node';args=[`${GTOOL}/gmail-read.js`,String(input.hours),String(input.max||20),input.query||''];break;
    case 'email_reply':    cmd='node';args=[`${GTOOL}/gmail-reply.js`,input.message_id,input.body,input.cc||''];break;
    case 'calendar_read':  cmd='node';args=[`${GTOOL}/calendar-read.js`,String(input.days||7)];break;
    case 'calendar_create':cmd='node';args=[`${GTOOL}/calendar-create.js`,input.title,input.start,input.end,input.description||'',input.location||''];break;
    case 'sheets_read':    cmd='node';args=[`${GTOOL}/sheets-read.js`,SHEET_ID,input.range];break;
    case 'sheets_write':   cmd='node';args=[`${GTOOL}/sheets-write.js`,SHEET_ID,input.range,input.values];break;
    case 'sheets_append':  cmd='node';args=[`${GTOOL}/sheets-append.js`,SHEET_ID,input.range,input.values];break;
    case 'hvac_lookup':    cmd='node';args=[`${GTOOL}/hvac-lookup.js`,input.keyword||'',input.range||'A:Z'];break;
    case 'memory_search':  cmd='node';args=[`${GTOOL}/memory-search.js`,input.keyword||'',input.file||''];break;
    case 'memory_update':  cmd='node';args=[`${GTOOL}/memory-update.js`,input.topic||'',input.content||'',input.section||''];break;
    case 'gdoc_create':    cmd='node';args=[`${GTOOL}/gdoc-create.js`,input.title,input.content];break;
    case 'task_add':       cmd='node';args=[`${GTOOL}/task-tracker.js`,'add',input.task,input.assignee,input.deadline,input.source||''];break;
    case 'task_overdue':   cmd='node';args=[`${GTOOL}/task-tracker.js`,'overdue'];break;
    case 'task_status':    cmd='node';args=[`${GTOOL}/task-tracker.js`,'status'];break;
    case 'task_update':    cmd='node';args=[`${GTOOL}/task-tracker.js`,'update',String(input.row),input.status];break;
    case 'zalo_oa_send_to_vip':cmd='node';args=[`${GTOOL}/zalo-oa-send.js`,input.target,input.message];break;
    case 'zalo_oa_history':cmd='node';args=[`${GTOOL}/zalo-oa-history.js`,input.target||'all',String(input.hours||24)];break;
    case 'kpi_update':     cmd='node';args=[`${GTOOL}/kpi-update.js`];break;
    case 'zalo_oa_article':cmd='node';args=[`${GTOOL}/zalo-oa-article.js`,input.action||'create',input.title||'',input.body||'',input.cover||''];break;
    case 'github_create_issue':cmd='node';args=[`${GTOOL}/github-issue.js`,input.title,input.body,input.requester||''];break;
    case 'image_overlay':  cmd='node';args=[`${GTOOL}/image-overlay.js`,input.input_image,input.text||'',input.output_path||`/tmp/cover-${Date.now()}.png`,input.layout||'hero'];break;
    case 'gemini_write':   cmd='node';args=[`${GTOOL}/gemini-write.js`,input.prompt,String(input.max_tokens||600)];break;
    case 'drive_list':     cmd='node';args=[`${GTOOL}/drive-list.js`,input.folder_id||'1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR',input.query||'',String(input.max||30)];break;
    case 'drive_download': cmd='node';args=[`${GTOOL}/drive-download.js`,input.file_id,input.output_path||''];break;
    case 'web_search':     cmd='node';args=[`${GTOOL}/web-search.js`,input.query||'',String(input.max_results||10)];break;
    case 'web_read':       cmd='node';args=[`${GTOOL}/web-read.js`,input.url||''];break;
    case 'auto_learn':     cmd='node';args=[`${GTOOL}/auto-learn.js`,input.target||'all',String(input.hours||24)];break;
    case 'zalo_oa_comment':{
      const a=input.action||'scan';
      if(a==='list')         {cmd='node';args=[`${GTOOL}/zalo-oa-comment.js`,'list',input.article_id||'','0','20'];}
      else if(a==='reply')   {cmd='node';args=[`${GTOOL}/zalo-oa-comment.js`,'reply',input.comment_id||'',input.message||'',input.article_id||''];}
      else if(a==='scan-article'){cmd='node';args=[`${GTOOL}/zalo-oa-comment.js`,'scan-article',input.article_id||'',String(input.hours||720)];}
      else                   {cmd='node';args=[`${GTOOL}/zalo-oa-comment.js`,'scan',String(input.hours||24)];}
      break;
    }
    default: return {error:`Unknown tool: ${name}`};
  }
  try {
    const {stdout,stderr}=await execFileAsync(cmd,args,{encoding:'utf-8',timeout:60000});
    if(stderr) console.log(`[tool:${name}] ${stderr.trim()}`);
    const raw=stdout||'';
    return {output:raw.length>3000?raw.substring(0,3000)+'\n⚠️[Truncated]':raw};
  } catch(e) {
    if(e.stderr) console.log(`[tool:${name}] ${e.stderr.trim()}`);
    return {error:(e.stderr||e.stdout||e.message||'unknown').substring(0,1000)};
  }
}

// ============================================================
// === AGENT LOOP
// ============================================================
async function runAgentLoop(model, systemPrompt, tools, session, maxIter=8) {
  let reply='', iters=0;
  const maxTok = (tools===VIP_TOOLS)?2000:500;
  while(iters++<maxIter) {
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'x-api-key':CLAUDE_API_KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'},
      body:JSON.stringify({model,max_tokens:maxTok,system:systemPrompt,tools,messages:session})
    });
    if(!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).substring(0,200)}`);
    const data=await res.json();
    if(data.stop_reason==='tool_use') {
      session.push({role:'assistant',content:data.content});
      const results=[];
      for(const blk of data.content) {
        if(blk.type==='tool_use') {
          console.log(`[tool] ${blk.name}(${JSON.stringify(blk.input).substring(0,60)})`);
          results.push({type:'tool_result',tool_use_id:blk.id,content:JSON.stringify(await runTool(blk.name,blk.input))});
        }
      }
      session.push({role:'user',content:results});
    } else {
      reply=data.content?.find(c=>c.type==='text')?.text||'';
      session.push({role:'assistant',content:data.content});
      break;
    }
  }
  return reply;
}

// ============================================================
// === EXPRESS
// ============================================================
const app=express();
app.set('trust proxy',true);
app.use((req,res,next)=>{
  const fp=path.join(PUBLIC_DIR,req.path);
  if(req.method==='GET'&&fs.existsSync(fp)&&fs.statSync(fp).isFile()) return res.sendFile(fp);
  next();
});

// ============================================================
// === FOLLOWERS FILE
// ============================================================
const FOLLOWERS_FILE='/root/.openclaw/zalo-oa-followers.json';
function lookupFollower(userId) {
  try{return JSON.parse(fs.readFileSync(FOLLOWERS_FILE,'utf-8')).find(f=>f.user_id===userId);}catch(e){return null;}
}

// ============================================================
// === STAFF PENDING REGISTRATION
// ============================================================
const _staffPending=new Map(); // zaloId → {askedAt, attempts}

// ============================================================
// === WEBHOOK
// ============================================================
const _dedup=new Set();

app.post('/zalo-webhook',express.json({limit:'5mb'}),(req,res)=>{
  res.json({status:'ok'});
  const event=req.body;
  const msgId=event.message?.msg_id;
  if(msgId){if(_dedup.has(msgId)){console.log(`[dedup] ${msgId}`);return;}_dedup.add(msgId);setTimeout(()=>_dedup.delete(msgId),60000);}
  try{fs.appendFileSync('/root/.openclaw/zalo-events.jsonl',JSON.stringify({time:new Date().toISOString(),event})+'\n');}catch(e){}
  console.log(`[webhook] ${event.event_name} from ${event.sender?.id||event.follower?.id||'?'}`);
  if(event.event_name==='user_send_text'||event.event_name==='user_send_link')
    handleUserMessage(event).catch(e=>console.error('[handler]',e.message));
  else if(event.event_name==='follow')
    handleFollow(event).catch(e=>console.error('[follow]',e.message));
  else if(event.event_name==='unfollow')
    handleUnfollow(event).catch(e=>console.error('[unfollow]',e.message));
  else if(event.event_name==='user_send_image')
    handleImageMessage(event).catch(e=>console.error('[image]',e.message));
  else if(['user_send_comment','oa_comment','user_comment_article'].includes(event.event_name))
    handleArticleComment(event).catch(e=>console.error('[comment]',e.message));
});
app.get('/zalo-webhook',(req,res)=>res.json({status:'active'}));

// ============================================================
// === FOLLOW / UNFOLLOW / IMAGE / COMMENT
// ============================================================
async function handleFollow(event) {
  const userId=event.follower?.id; if(!userId) return;
  let displayName='Unknown';
  try{const r=await fetch(`https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({user_id:userId}))}`,{headers:{'access_token':getOAToken()}});displayName=(await r.json()).data?.display_name||'Unknown';}catch(e){}
  console.log(`[follow] ${displayName} (${userId})`);
  let followers=[];try{followers=JSON.parse(fs.readFileSync(FOLLOWERS_FILE,'utf-8'));}catch(e){}
  const idx=followers.findIndex(f=>f.user_id===userId);
  if(idx>=0){followers[idx].display_name=displayName;followers[idx].last_follow=new Date().toISOString();}
  else followers.push({user_id:userId,display_name:displayName,followed_at:new Date().toISOString()});
  try{fs.writeFileSync(FOLLOWERS_FILE,JSON.stringify(followers,null,2));}catch(e){}
}
async function handleUnfollow(event) {
  const userId=event.follower?.id; if(!userId) return;
  const vip=VIP_USERS[userId];
  if(vip){const sepId=process.env.ZALO_OA_USER_SEP_KHANH;if(sepId&&userId!==sepId)await sendZaloMessage(sepId,`⚠️ ${vip.name} đã unfollow OA.`).catch(()=>{});}
}
async function handleImageMessage(event) {
  const senderId=event.sender?.id; if(!senderId) return;
  const vip=VIP_USERS[senderId];
  const staff=!vip?lookupStaffByZaloId(senderId):null;
  const name=vip?vip.name:(staff?.nick||lookupFollower(senderId)?.display_name||'anh/chị');
  const att=event.message?.attachments?.[0];
  const imageUrl=att?.payload?.url||att?.payload?.thumbnail||'';
  console.log(`[image] from ${name}: ${imageUrl.substring(0,80)}`);
  await sendZaloMessage(senderId,`Dạ ${name}, em đã nhận ảnh.${vip?' Anh/chị muốn em làm gì với ảnh này ạ?':''}`);
}
async function handleArticleComment(event) {
  const commentId=event.comment?.id||event.comment_id||event.message?.comment_id;
  const text=event.comment?.message||event.comment?.text||event.message?.text||'';
  if(!commentId||!text) return;
  try{const{stdout}=await execFileAsync('node',[`${GTOOL}/zalo-oa-comment.js`,'scan','1'],{encoding:'utf-8',timeout:30000});console.log(`[comment:scan] ${stdout.trim().substring(0,200)}`);}catch(e){console.error('[comment]',e.message);}
}

// ============================================================
// === MAIN ROUTER
// ============================================================
async function handleUserMessage(event) {
  const senderId=event.sender?.id;
  let messageText=event.message?.text||'';
  if(event.event_name==='user_send_link'){
    const urls=(event.message?.attachments||[]).filter(a=>a?.type==='link'&&a?.payload?.url).map(a=>a.payload.url);
    const missing=urls.filter(u=>!messageText.includes(u));
    if(missing.length) messageText=messageText?`${messageText}\n${missing.join('\n')}`:missing.join('\n');
  }
  if(!senderId||!messageText) return;

  // 1. VIP?
  const vip=VIP_USERS[senderId];
  if(vip){ await handleVipMessage(senderId,messageText,vip); return; }

  // 2. CBCNV đã đăng ký Zalo ID?
  const staff=lookupStaffByZaloId(senderId);
  if(staff){ await handleStaffMessage(senderId,messageText,staff); return; }

  // 3. Đang trong flow đăng ký?
  if(_staffPending.has(senderId)){ await handleStaffRegistration(senderId,messageText); return; }

  // 4. Email nội bộ trong tin nhắn → có thể là CBCNV
  if(/@nsca\.vn/i.test(messageText)){ await handleStaffRegistration(senderId,messageText); return; }

  // 5. Follower thông thường
  await handleFollowerMessage(senderId,messageText);
}

// ============================================================
// === VIP HANDLER — Sonnet 4.5 + full tools
// ============================================================
async function handleVipMessage(senderId, messageText, vip) {
  console.log(`[VIP] ${vip.name}: ${messageText.substring(0,60)}...`);
  const ageMin=getSessionAgeMin(senderId);
  let session=loadSession(senderId);
  if(!Array.isArray(session)) session=[];
  // Reset orphaned tool_result
  if(session.length>0){const last=session[session.length-1];if(last.role==='user'&&Array.isArray(last.content)&&last.content[0]?.type==='tool_result')session=[];}
  const isFresh=session.length===0||ageMin>=360;
  session.push({role:'user',content:messageText});

  const today=new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
  const sys=`Bạn là **Đào Thị Lê Na**, trợ lý AI của CEO Đào Huy Khánh (NSCA/STARDUCT).
Đang chat với: **${vip.name} (${vip.role})** | ${today}
${isFresh?`Session MỚI — có thể mở đầu ngắn "Dạ ${vip.name}..." 1 lần.`:`Session ACTIVE (${ageMin}p) — KHÔNG chào, trả lời THẲNG.`}
NGUYÊN TẮC: Xưng "em" | Ngắn gọn có số liệu | KHÔNG ký tên | Max 500 ký tự
LUẬT 1: VIP ra lệnh → GỌI TOOL NGAY, KHÔNG hỏi lại, KHÔNG đưa options.
LINK: web_search verify TRƯỚC khi gửi. CODE: github_create_issue NGAY khi Sếp nói sửa/fix.
SHEET: ID đã có sẵn, chỉ cần range. 3 VIP ĐỘC LẬP, không chia sẻ chéo.`;

  let reply='';
  try{ reply=await runAgentLoop(MODEL_VIP,sys,VIP_TOOLS,session,15); }
  catch(e){ console.error(`[VIP] ${e.message}`); reply=`Dạ ${vip.name}, em gặp trục trặc kỹ thuật, thử lại sau 1 phút nhé.`; session=[{role:'user',content:messageText}]; }
  if(!reply) reply='Em xin lỗi, yêu cầu quá phức tạp. Anh/chị thử yêu cầu đơn giản hơn nhé.';
  saveSession(senderId,session);
  try{ await sendZaloMessage(senderId,reply); console.log(`[VIP] → ${vip.name}: ${reply.substring(0,60)}...`); }
  catch(e){ console.error(`[VIP] send FAILED: ${e.message}`); }
}

// ============================================================
// === STAFF HANDLER — Haiku + KB + task/lịch của chính họ
// ============================================================
async function handleStaffMessage(senderId, messageText, staff) {
  const nick=staff.nick||staff.name;
  console.log(`[STAFF] ${nick} (${staff.dept}): ${messageText.substring(0,80)}`);
  const key=`staff_${senderId}`;
  const ageMin=getSessionAgeMin(key);
  let session=loadSession(key);
  if(!Array.isArray(session)) session=[];
  session.push({role:'user',content:messageText});
  if(session.length>20) session.splice(0,session.length-20);
  const isFresh=session.length<=1||ageMin>=360;

  const today=new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
  const sys=`Bạn là Lê Na — trợ lý AI nội bộ NSCA/STARDUCT.
ĐANG CHAT VỚI: ${nick} (${staff.name}) | ${staff.pos} | ${staff.dept} | ${staff.email} | ${today}
${isFresh?`Session mới — chào ngắn "Dạ ${nick}! Em nghe ạ." rồi vào nội dung.`:`Session active (${ageMin}p) — KHÔNG chào lại, trả lời thẳng.`}
GIAO TIẾP: Xưng "em", gọi "${nick}" | Thân thiện nội bộ | Ngắn gọn thực tế
QUYỀN HẠN:
✅ Task được giao cho ${staff.email} | Lịch họp bộ phận ${staff.dept}
✅ Kỹ thuật HVAC/STARDUCT | Quy trình nội bộ
✅ Báo hoàn thành task → Lê Na ghi nhận, hỏi có muốn báo trưởng BP không
❌ KHÔNG xem task/email/KPI của người khác | KHÔNG xem lương/tài chính
${LENA_KB}`;

  let reply='';
  try{ reply=await runAgentLoop(MODEL_STAFF,sys,STAFF_TOOLS,session,5); }
  catch(e){ console.error(`[STAFF] ${e.message}`); reply=`Dạ ${nick}, em gặp sự cố kỹ thuật. Thử lại sau nhé.`; }
  if(!reply) reply=`Dạ ${nick}, em chưa xử lý được. Anh/chị liên hệ trực tiếp trưởng bộ phận nhé.`;
  saveSession(key,session);
  await sendZaloMessage(senderId,reply);
  console.log(`[STAFF] → ${nick}: ${reply.substring(0,80)}...`);
}

// ============================================================
// === STAFF REGISTRATION — hỏi tên, match, lưu Zalo ID
// ============================================================
async function handleStaffRegistration(senderId, messageText) {
  const pending=_staffPending.get(senderId);

  if(pending) {
    // User đang trả lời tên/email
    const matched=lookupStaffByInput(messageText);
    if(matched) {
      registerStaffZaloId(senderId,matched.email);
      _staffPending.delete(senderId);
      await sendZaloMessage(senderId,`✅ Xác nhận rồi ạ!\n${matched.nick} — ${matched.pos} — Bộ phận ${matched.dept}\n\nTừ giờ ${matched.nick} có thể hỏi em về task, lịch họp, kỹ thuật STARDUCT hoặc bất cứ gì cần hỗ trợ nhé!`);
      // Nếu tin nhắn gốc dài hơn tên → xử lý nội dung
      if(messageText.length>30) await handleStaffMessage(senderId,messageText,matched);
      return;
    }
    const attempts=(pending.attempts||0)+1;
    if(attempts>=3) {
      _staffPending.delete(senderId);
      await sendZaloMessage(senderId,'Em chưa tìm thấy trong danh sách NSCA. Anh/chị liên hệ bộ phận HCNS (Anh Sơn — sondt@nsca.vn) để được thêm vào hệ thống nhé.');
      return;
    }
    _staffPending.set(senderId,{askedAt:pending.askedAt,attempts});
    await sendZaloMessage(senderId,`Em chưa tìm thấy "${messageText.substring(0,30)}" trong danh sách. Anh/chị thử nhập tên đầy đủ hoặc email nội bộ (vd: namph@nsca.vn) ạ.`);
    return;
  }

  // Lần đầu — thử match email trong tin nhắn trước
  if(/@nsca\.vn/i.test(messageText)) {
    const em=messageText.match(/[\w.]+@nsca\.vn/i)?.[0];
    if(em) {
      const matched=lookupStaffByInput(em);
      if(matched) {
        registerStaffZaloId(senderId,matched.email);
        await sendZaloMessage(senderId,`✅ Xác nhận! ${matched.nick} — ${matched.pos} — ${matched.dept}.\nTừ giờ anh/chị có thể hỏi em về task, lịch họp và kỹ thuật STARDUCT ạ!`);
        return;
      }
    }
  }

  // Hỏi tên
  _staffPending.set(senderId,{askedAt:Date.now(),attempts:0});
  await sendZaloMessage(senderId,'Chào anh/chị! Em là Lê Na — trợ lý AI nội bộ của NSCA/STARDUCT.\n\nAnh/chị cho em biết tên hoặc email nội bộ để em nhận diện nhé?\n(Ví dụ: "Phạm Hoài Nam" hoặc "namph@nsca.vn")');
}

// ============================================================
// === FOLLOWER HANDLER — Haiku + KB + web search + memory
// ============================================================
async function handleFollowerMessage(senderId, messageText) {
  const follower=lookupFollower(senderId);
  const zaloName=follower?.display_name||null;
  const profile=await loadFollowerProfile(senderId).catch(()=>null);
  const knownName=profile?.name||zaloName||'anh/chị';
  const isFirst=!profile;
  const lastTopics=profile?.topics||'';
  const lastSeen=profile?.lastSeen?new Date(profile.lastSeen).toLocaleDateString('vi-VN'):null;

  console.log(`[FOLLOWER] ${knownName} (${senderId}): ${messageText.substring(0,80)}`);

  let session=loadSession(`f_${senderId}`);
  if(!Array.isArray(session)) session=[];
  session.push({role:'user',content:messageText});
  if(session.length>20) session.splice(0,session.length-20);

  const memCtx=isFirst
    ?'USER MEMORY: First contact. Introduce yourself briefly if appropriate.'
    :`USER MEMORY:\n- Name: ${knownName}\n- First contact: ${profile.firstSeen?new Date(profile.firstSeen).toLocaleDateString('vi-VN'):'unknown'}\n- Last seen: ${lastSeen||'unknown'}\n- Previous topics: ${lastTopics||'none'}\n- Address by name, reference past topics when relevant.`;

  const sys=`You are Lê Na — official AI assistant of STARDUCT (NSCA, Dan Phuong, Hanoi, Vietnam). Website: starduct.vn

${memCtx}

LANGUAGE RULE (CRITICAL): Detect language from user message. Reply in SAME language.
Vietnamese → Vietnamese (xưng "em", gọi "anh/chị" hoặc tên)
English → English

TOOLS: Use web_search for current/updated info not in KB. Use memory_search for past STARDUCT facts.
Simple HVAC calc or KB terminology → answer DIRECTLY, no tool needed.

STYLE: Friendly, professional, concise (max 3-4 sentences, show formula+calculation if asked).
Pricing/ordering → "Liên hệ sales@nsca.vn hoặc 0246.260.9999 ạ."
Complex technical → "Gửi yêu cầu info@nsca.vn, team R&D hỗ trợ trong 24h ạ."
NEVER invent specs, model codes, pricing, or standards not in KB.

${LENA_KB}`;

  let reply='';
  try{ reply=await runAgentLoop(MODEL_FOLLOWER,sys,FOLLOWER_TOOLS,session,5); }
  catch(e){ console.error(`[FOLLOWER] ${e.message}`); reply='Xin lỗi anh/chị, em đang gặp sự cố. Vui lòng liên hệ info@nsca.vn ạ.'; }
  if(!reply) reply='Xin lỗi anh/chị, em chưa xử lý được. Liên hệ info@nsca.vn ạ.';

  saveSession(`f_${senderId}`,session);

  const isVI=/[àáảãạăắặẳẵặâấậầẩẫđèéẻẽẹêếệềểễìíỉĩịòóỏõọôốộồổỗơớợờởỡùúủũụưứựừửữỳýỷỹỵ]/i.test(messageText);
  saveFollowerProfile(senderId,knownName,isVI?'vi':'en',messageText.substring(0,100),messageText).catch(()=>{});

  await sendZaloMessage(senderId,reply);
  console.log(`[FOLLOWER] → ${knownName}: ${reply.substring(0,80)}...`);
}

// ============================================================
// === SEND
// ============================================================
const _sendCache=new Map();
async function sendZaloMessage(userId, message) {
  const now=Date.now(), last=_sendCache.get(userId);
  if(last&&now-last<5000){console.log(`[send] dedup ${userId}`);return;}
  _sendCache.set(userId,now);
  const token=getOAToken(); if(!token) throw new Error('No OA token');
  const res=await fetch('https://openapi.zalo.me/v3.0/oa/message/cs',{
    method:'POST',
    headers:{'access_token':token,'Content-Type':'application/json; charset=UTF-8'},
    body:JSON.stringify({recipient:{user_id:userId},message:{text:`${message.trim()}\n\n— Lê Na`}})
  });
  const data=await res.json();
  if(data.error!==0) throw new Error(`Zalo ${data.error}: ${data.message}`);
  return data.data;
}
setInterval(()=>{const now=Date.now();for(const[k,v]of _sendCache)if(now-v>60000)_sendCache.delete(k);},3600000);

// ============================================================
// === HEALTH / DEBUG / STAFF LIST
// ============================================================
app.get('/health',(req,res)=>res.json({
  status:'ok', uptime:Math.floor(process.uptime()),
  models:{vip:MODEL_VIP, staff:MODEL_STAFF, follower:MODEL_FOLLOWER},
  vips:Object.keys(VIP_USERS).filter(k=>!k.startsWith('_none_')).length,
  staff_loaded:NSCA_STAFF.length,
  staff_registered:Object.keys(loadZaloIdMap()).length,
  kb_file:KB_FILE, kb_chars:LENA_KB.length, kb_loaded:LENA_KB.length>100,
  memory_source:MEMORY_FILE,
  follower_memory:'Google Sheet — Follower Memory tab'
}));

app.get('/staff-list',(req,res)=>{
  const map=loadZaloIdMap();
  const registered=new Set(Object.values(map));
  res.json({
    total:NSCA_STAFF.length,
    registered:NSCA_STAFF.filter(s=>registered.has(s.email)).length,
    pending_registration:_staffPending.size,
    staff:NSCA_STAFF.map(s=>({
      id:s.id, nick:s.nick, name:s.name, dept:s.dept,
      pos:s.pos, email:s.email,
      registered:registered.has(s.email)
    }))
  });
});

app.get('/refresh-token',async(req,res)=>res.json({refreshed:await refreshOAToken(),token:!!getOAToken()}));

app.get('/debug',async(req,res)=>{
  const vipList={};
  for(const[id,info]of Object.entries(VIP_USERS))if(!id.startsWith('_none_'))vipList[id.substring(0,8)+'...']=info.name;
  let claudeOk=false;
  try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':CLAUDE_API_KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model:MODEL_STAFF,max_tokens:10,messages:[{role:'user',content:'ping'}]})});claudeOk=r.ok;}catch(e){}
  res.json({vips:vipList,claude_api:claudeOk?'OK':'FAIL',models:{vip:MODEL_VIP,staff:MODEL_STAFF,follower:MODEL_FOLLOWER},staff_count:NSCA_STAFF.length,registered:Object.keys(loadZaloIdMap()).length,kb_chars:LENA_KB.length,kb_file:KB_FILE,memory_file:MEMORY_FILE,zalo_token:getOAToken()?'OK':'MISSING'});
});

// ============================================================
// === PROXY TO OPENCLAW
// ============================================================
const ocProxy=createProxyMiddleware({
  target:`http://127.0.0.1:${OPENCLAW_PORT}`,changeOrigin:true,ws:true,xfwd:true,logLevel:'warn',
  onError:(err,req,res)=>{console.error('[proxy]',err.message);if(res&&!res.headersSent){res.writeHead(502,{'Content-Type':'text/plain'});res.end('Upstream not ready: '+err.message);}}
});
app.use('/',ocProxy);

const server=app.listen(FRONT_PORT,'0.0.0.0',()=>{
  console.log(`[proxy] Port ${FRONT_PORT} → OpenClaw ${OPENCLAW_PORT}`);
  console.log(`[proxy] Models: VIP=${MODEL_VIP} | STAFF=${MODEL_STAFF} | Follower=${MODEL_FOLLOWER}`);
  console.log(`[proxy] Staff: ${NSCA_STAFF.length} loaded from ${MEMORY_FILE} | Registered: ${Object.keys(loadZaloIdMap()).length}`);
  console.log(`[proxy] KB: ${KB_FILE} (${LENA_KB.length} chars) | Follower memory: Google Sheet`);
  console.log(`[proxy] Endpoints: /health /staff-list /debug /refresh-token`);
  const RI=20*60*60*1000;
  refreshOAToken().then(ok=>console.log(`[token] Startup: ${ok?'OK':'FAILED'}`)).catch(()=>{});
  setInterval(()=>refreshOAToken(),RI);
  console.log(`[token] Auto-refresh every 20h | Current: ${getOAToken()?'OK':'MISSING'}`);
});
server.on('upgrade',ocProxy.upgrade);
process.on('SIGTERM',()=>{console.log('[proxy] SIGTERM');server.close(()=>process.exit(0));});
