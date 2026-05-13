#!/usr/bin/env node
require('./_env');
// Zalo OA Comment — list / reply / moderate comments tren bai viet OA Starasia JSC
//
// Usage:
//   node zalo-oa-comment.js list <article_id> [offset] [limit]
//   node zalo-oa-comment.js reply <comment_id> "<message>" [article_id]
//   node zalo-oa-comment.js scan [hours]      (list comment cua tat ca article gan day)
//
// Ghi chu (chua verify runtime — Issue #13 lan dau implement):
// - Endpoint Zalo OA cho comment: /v2.0/article/getcomment, /v2.0/article/replycomment
//   Co the bi -209 "API is not support" tuy theo OA scope. Test bang `list` truoc khi enable cron.
// - Token dung chung voi zalo-oa-send.js (/root/.openclaw/zalo-oa-token.json)

const fs = require('fs');
const path = require('path');

const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';
const COMMENT_LOG = '/root/.openclaw/zalo-oa-comments.jsonl';
const REPLIED_LOG = '/root/.openclaw/zalo-oa-comment-replied.json';

function getAccessToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.access_token) return data.access_token;
    }
  } catch (e) {}
  return process.env.ZALO_OA_ACCESS_TOKEN;
}

const ACCESS_TOKEN = getAccessToken();
if (!ACCESS_TOKEN) {
  console.log(JSON.stringify({ success: false, error: 'No OA access token (file or env)' }));
  process.exit(1);
}

// === MODERATION — filter spam, tu nhay cam ===
const BANNED_KEYWORDS = [
  'lừa đảo', 'scam', 'cờ bạc', 'cá độ', 'cá cược', 'casino',
  'sex', 'khiêu dâm', '18+',
  'vay nóng', 'tín dụng đen',
  'http://', 'https://t.me', 'bit.ly', 'tinyurl'
];

function isSpam(text) {
  if (!text || text.trim().length === 0) return { spam: true, reason: 'empty' };
  if (text.length > 1000) return { spam: true, reason: 'too_long' };
  const lower = text.toLowerCase();
  for (const kw of BANNED_KEYWORDS) {
    if (lower.includes(kw)) return { spam: true, reason: `banned_keyword:${kw}` };
  }
  // Spam pattern: lap ky tu / so dien thoai
  if (/(.)\1{6,}/.test(text)) return { spam: true, reason: 'repeat_char' };
  return { spam: false };
}

// === RESPONSE TEMPLATES — FAQ STARDUCT ===
const FAQ_TEMPLATES = [
  {
    match: /(giá|price|báo giá|cost)/i,
    reply: 'Dạ cảm ơn anh/chị đã quan tâm sản phẩm STARDUCT. Bộ phận Kinh doanh sẽ liên hệ báo giá chi tiết. Anh/chị để lại SĐT hoặc liên hệ hotline NSCA giúp em ạ.'
  },
  {
    match: /(địa chỉ|showroom|nhà máy|cửa hàng|where)/i,
    reply: 'Dạ nhà máy STARDUCT (NSCA) tại KCN — anh/chị inbox riêng OA hoặc liên hệ hotline để được hướng dẫn cụ thể ạ.'
  },
  {
    match: /(catalog|brochure|tài liệu|spec|thông số)/i,
    reply: 'Dạ STARDUCT có đầy đủ catalog & spec kỹ thuật. Anh/chị inbox riêng OA giúp em địa chỉ email, em gửi tài liệu ngay ạ.'
  },
  {
    match: /(liên hệ|hotline|contact|sđt|phone)/i,
    reply: 'Dạ anh/chị inbox riêng OA Starasia JSC hoặc email info@nsca.vn nhé, bộ phận Kinh doanh sẽ phản hồi sớm ạ.'
  }
];

function matchTemplate(text) {
  for (const tpl of FAQ_TEMPLATES) {
    if (tpl.match.test(text)) return tpl.reply;
  }
  return null;
}

// === API CALLS ===
async function getComments(articleId, offset = 0, limit = 20) {
  const params = JSON.stringify({ article_id: articleId, offset, limit });
  const url = `https://openapi.zalo.me/v2.0/article/getcomment?data=${encodeURIComponent(params)}`;
  try {
    const res = await fetch(url, { headers: { 'access_token': ACCESS_TOKEN } });
    const data = await res.json();
    return { http: res.status, ...data };
  } catch (e) {
    return { error: -1, message: e.message };
  }
}

async function replyComment(commentId, message, articleId) {
  const body = { comment_id: commentId, message };
  if (articleId) body.article_id = articleId;
  try {
    const res = await fetch('https://openapi.zalo.me/v2.0/article/replycomment', {
      method: 'POST',
      headers: { 'access_token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return { http: res.status, ...data };
  } catch (e) {
    return { error: -1, message: e.message };
  }
}

// === REPLIED DEDUP — khong reply 2 lan cung 1 comment ===
function loadReplied() {
  try {
    if (fs.existsSync(REPLIED_LOG)) return JSON.parse(fs.readFileSync(REPLIED_LOG, 'utf-8'));
  } catch (e) {}
  return {};
}

function markReplied(commentId, info) {
  const data = loadReplied();
  data[commentId] = { ts: Date.now(), ...info };
  // Cleanup: keep last 7 ngay
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  for (const k of Object.keys(data)) {
    if (data[k].ts < cutoff) delete data[k];
  }
  try { fs.writeFileSync(REPLIED_LOG, JSON.stringify(data, null, 2)); } catch (e) {}
}

function logEvent(record) {
  try {
    fs.appendFileSync(COMMENT_LOG, JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n');
  } catch (e) {}
}

// === COMMANDS ===
async function cmdList(articleId, offset, limit) {
  if (!articleId) {
    console.log(JSON.stringify({ success: false, error: 'Missing article_id' }));
    process.exit(1);
  }
  const data = await getComments(articleId, offset, limit);
  console.log(JSON.stringify(data, null, 2));
}

async function cmdReply(commentId, message, articleId) {
  if (!commentId || !message) {
    console.log(JSON.stringify({ success: false, error: 'Missing comment_id or message' }));
    process.exit(1);
  }
  const data = await replyComment(commentId, message, articleId);
  if (data.error === 0) {
    markReplied(commentId, { article_id: articleId, message: message.substring(0, 100) });
    logEvent({ kind: 'reply', comment_id: commentId, article_id: articleId, message });
  }
  console.log(JSON.stringify(data, null, 2));
  if (data.error !== 0) process.exit(1);
}

async function listArticles(limit = 10) {
  const params = JSON.stringify({ offset: 0, limit, type: 'normal' });
  const url = `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(params)}`;
  const res = await fetch(url, { headers: { 'access_token': ACCESS_TOKEN } });
  const data = await res.json();
  if (data.error === 0 && data.data?.articles) return data.data.articles;
  return [];
}

async function cmdScan(hours = 24) {
  const since = Date.now() - hours * 3600 * 1000;
  const articles = await listArticles(20);
  const replied = loadReplied();
  const report = { articles: 0, comments: 0, new_comments: 0, replied: 0, skipped_spam: 0, errors: [] };

  for (const art of articles) {
    if (art.created_date && art.created_date * 1000 < since - 14 * 24 * 3600 * 1000) continue;
    report.articles++;
    const list = await getComments(art.id, 0, 50);
    if (list.error !== 0) {
      report.errors.push({ article_id: art.id, error: list.message || list.error });
      continue;
    }
    const comments = list.data?.comments || list.data?.list || [];
    for (const c of comments) {
      report.comments++;
      const cId = c.id || c.comment_id;
      if (!cId || replied[cId]) continue;
      // Khong reply comment cua chinh OA
      if (c.from?.is_oa || c.is_oa) continue;
      // Filter theo thoi gian
      const cTime = (c.created_time || c.time || 0) * (c.created_time > 1e12 ? 1 : 1000);
      if (cTime && cTime < since) continue;
      report.new_comments++;

      const text = c.message || c.content || c.text || '';
      const mod = isSpam(text);
      if (mod.spam) {
        report.skipped_spam++;
        logEvent({ kind: 'spam', comment_id: cId, article_id: art.id, reason: mod.reason, text: text.substring(0, 200) });
        markReplied(cId, { article_id: art.id, skipped: mod.reason });
        continue;
      }

      const tplReply = matchTemplate(text);
      if (!tplReply) {
        // Khong match template — log de Le Na xu ly tay sau
        logEvent({ kind: 'no_template', comment_id: cId, article_id: art.id, text: text.substring(0, 200) });
        continue;
      }

      const reply = await replyComment(cId, tplReply, art.id);
      if (reply.error === 0) {
        markReplied(cId, { article_id: art.id, template: true });
        logEvent({ kind: 'reply_template', comment_id: cId, article_id: art.id, text: text.substring(0, 100), reply: tplReply.substring(0, 100) });
        report.replied++;
      } else {
        report.errors.push({ comment_id: cId, error: reply.message || reply.error });
      }
    }
  }

  console.log(JSON.stringify({ success: true, ...report }, null, 2));
}

function usage() {
  console.log(JSON.stringify({
    usage: {
      list: 'node zalo-oa-comment.js list <article_id> [offset] [limit]',
      reply: 'node zalo-oa-comment.js reply <comment_id> "<message>" [article_id]',
      scan: 'node zalo-oa-comment.js scan [hours]'
    }
  }));
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === 'help') return usage();

  if (cmd === 'list') {
    return cmdList(process.argv[3], parseInt(process.argv[4] || '0', 10), parseInt(process.argv[5] || '20', 10));
  }
  if (cmd === 'reply') {
    return cmdReply(process.argv[3], process.argv[4], process.argv[5] || '');
  }
  if (cmd === 'scan') {
    return cmdScan(parseInt(process.argv[3] || '24', 10));
  }

  console.log(JSON.stringify({ success: false, error: `Unknown cmd: ${cmd}` }));
  process.exit(1);
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
