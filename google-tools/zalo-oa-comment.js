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
const auth = require('./zalo-oa-auth');

const COMMENT_LOG = '/root/.openclaw/zalo-oa-comments.jsonl';
const REPLIED_LOG = '/root/.openclaw/zalo-oa-comment-replied.json';

let ACCESS_TOKEN = auth.getAccessToken();
if (!ACCESS_TOKEN) {
  console.log(JSON.stringify({ success: false, error: 'No OA access token (file or env)' }));
  process.exit(1);
}

// Issue #47: Zalo OA token expire sau 25h. Khi gap -220 → goi refreshAccessToken()
// (dung ZALO_OA_REFRESH_TOKEN) va retry 1 lan. fn() phai dung ACCESS_TOKEN tu
// closure module → sau refresh, bien duoc reassign nen retry dung token moi.
async function withTokenRefresh(fn) {
  let resp = await fn();
  if (auth.isTokenExpiredError(resp)) {
    const refreshed = await auth.refreshAccessToken();
    if (refreshed.success && refreshed.access_token) {
      ACCESS_TOKEN = refreshed.access_token;
      resp = await fn();
      resp = { ...resp, _token_refreshed: true };
    } else {
      resp = { ...resp, _refresh_failed: refreshed.error };
    }
  }
  return resp;
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
  return withTokenRefresh(async () => {
    try {
      const res = await fetch(url, { headers: { 'access_token': ACCESS_TOKEN } });
      const data = await res.json();
      return { http: res.status, ...data };
    } catch (e) {
      return { error: -1, message: e.message };
    }
  });
}

async function replyComment(commentId, message, articleId) {
  const body = { comment_id: commentId, message };
  if (articleId) body.article_id = articleId;
  return withTokenRefresh(async () => {
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
  });
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

// [2026-05-13 — Issue #17] Zalo /v2.0/article/getslice with `type: 'normal'`
// trả về -201 "type accept only 2 value normal and video." dù `normal` ĐÚNG là
// 1 trong 2 giá trị hợp lệ theo docs. Bypass bằng cách thử nhiều biến thể URL/
// param và trả về FULL diagnostic — không nuốt lỗi như trước (return [] im lặng
// khiến scan luôn báo "0 articles" mà không biết tại sao).
//
// [2026-05-14 — Issue #33] Bug "total=9 nhưng articles=[]": Zalo trả về
// `data.total` nhưng mảng article ở key khác (medias/media_array/list/items).
// findArticleArray() thử nhiều tên field rồi fallback scan bất kỳ array nào.
// Đồng bộ với zalo-oa-article.js.
function findArticleArray(d) {
  if (!d || typeof d !== 'object') return { items: [], key: null };
  for (const k of ['articles', 'list', 'medias', 'media_array', 'media_list', 'items', 'data']) {
    if (Array.isArray(d[k])) return { items: d[k], key: k };
  }
  for (const [k, v] of Object.entries(d)) {
    if (Array.isArray(v)) return { items: v, key: k };
  }
  return { items: [], key: null };
}

async function listArticles(limit = 10) {
  const cap = Math.min(limit, 10); // Zalo docs: max limit = 10
  const variants = [
    { name: 'v2_data_normal', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: cap, type: 'normal' }))}` },
    { name: 'v2_data_no_type', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: cap }))}` },
    { name: 'v2_flat_normal', url: `https://openapi.zalo.me/v2.0/article/getslice?offset=0&limit=${cap}&type=normal` },
    { name: 'v2_data_video', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: cap, type: 'video' }))}` },
    { name: 'v3_data_normal', url: `https://openapi.zalo.me/v3.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: cap, type: 'normal' }))}` },
  ];

  const attempts = [];
  let bestEmpty = null;
  for (const v of variants) {
    try {
      const data = await withTokenRefresh(async () => {
        const res = await fetch(v.url, { headers: { 'access_token': ACCESS_TOKEN } });
        const json = await res.json();
        return { _http: res.status, ...json };
      });
      const res = { status: data._http };
      const found = findArticleArray(data.data);
      const articles = found.items;
      const total = data.data?.total ?? data.data?.total_count ?? null;
      attempts.push({
        variant: v.name,
        http: res.status,
        error: data.error,
        message: data.message || null,
        returned: articles.length,
        items_key: found.key,
        total,
        data_keys: data.data && typeof data.data === 'object' ? Object.keys(data.data) : null
      });
      if (data.error === 0 && articles.length > 0) {
        return { articles, variant: v.name, items_key: found.key, attempts };
      }
      if (data.error === 0 && !bestEmpty) {
        bestEmpty = { variant: v.name, total };
      }
    } catch (e) {
      attempts.push({ variant: v.name, error: -1, message: e.message });
    }
  }
  return { articles: [], variant: bestEmpty?.variant || null, total: bestEmpty?.total ?? null, attempts };
}

// Xu ly comment cua 1 article — extract de scan + scan-article dung chung.
// === CONTACT EXTRACTION — bat SDT VN + email tu comment ===
function extractContact(text) {
  // VN phone: +84 or 0 prefix, mobile prefix 3/5/7/8/9, total 10-11 digits
  const phoneRegex = /(?:\+?84|0)(?:3|5|7|8|9)\d{8}/g;
  const emailRegex = /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const phones = [...new Set((text.match(phoneRegex) || []))];
  const emails = [...new Set((text.match(emailRegex) || []))];
  return { phones, emails, has: phones.length > 0 || emails.length > 0 };
}

// === CLASSIFICATION — phan loai comment de route ===
function classifyComment(text, hasContact) {
  const lower = text.toLowerCase();
  const ORDER = ['báo giá', 'bao gia', 'mua hàng', 'mua hang', 'đặt hàng', 'dat hang', 'order', 'quote',
                 'cần mua', 'can mua', 'số lượng', 'so luong', 'có hàng', 'co hang', 'giá bao nhiêu', 'gia bao nhieu',
                 'bao nhiêu tiền', 'bao nhieu tien', 'muốn mua', 'muon mua', 'mua được', 'mua duoc',
                 'mua không', 'mua khong', 'bán không', 'ban khong', 'còn hàng', 'con hang', 'hỏi giá', 'hoi gia'];
  const COMPLAINT = ['không hài lòng', 'khong hai long', 'tệ', 'thất vọng', 'that vong', 'phàn nàn', 'phan nan',
                     'khiếu nại', 'khieu nai', 'rất tệ', 'rat te', 'bị lỗi', 'bi loi', 'hỏng', 'không được',
                     'khong duoc', 'lừa', 'lua', 'dở', 'lởm', 'lom'];
  const TECHNICAL = ['lưu lượng', 'luu luong', 'áp suất', 'ap suat', 'eer', 'cop', 'cfm', 'cmh', 'btu', 'kw',
                     'tấn lạnh', 'tan lanh', 'thông số', 'thong so', 'dimension', 'kích thước', 'kich thuoc',
                     'công suất', 'cong suat', 'm2', 'mét vuông', 'met vuong', 'diện tích', 'dien tich',
                     'tính được', 'tinh duoc', 'có phù hợp', 'co phu hop'];

  const hasOrder = ORDER.some(k => lower.includes(k));
  const hasComplaint = COMPLAINT.some(k => lower.includes(k));
  const hasTechnical = TECHNICAL.some(k => lower.includes(k));

  // Priority routing
  if (hasComplaint) return 'complaint';        // Phan nan: escalate
  if (hasOrder && hasContact) return 'order_with_contact';  // Don hang co contact: forward kinhdoanh
  if (hasOrder) return 'order_no_contact';     // Don hang chua contact: AI reply moi cung cap
  if (hasTechnical) return 'technical_complex'; // Hoi ky thuat phuc tap: escalate + AI tam
  return 'general';                            // Chung: AI reply hoac template
}

// === AI REPLY via Gemini Flash (MIEN PHI) ===
async function aiReply(commentText, articleContext) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;
  const prompt = `Ban la Le Na - tro ly AI Cong ty NSCA / STARDUCT (chuyen HVAC cua gio, ong gio, dieu hoa cong nghiep, thong gio).
Khach hang vua comment tren bai viet OA Starasia JSC: "${commentText}"
${articleContext ? 'Bai viet noi ve: ' + articleContext.substring(0, 200) : ''}

Tra loi NGAN GON (1-3 cau, TOI DA 200 ky tu):
- Xung "em", goi khach "anh/chi"
- Cam on quan tam khi phu hop
- Cung cap thong tin huu ich: link tool.starductselection.com (chon SP HVAC), starduct.vn (catalog), info@nsca.vn (email)
- Moi inbox rieng OA neu can tu van chi tiet
- KHONG bia thong tin san pham, KHONG hua gia ca
- KHONG dung markdown (** * # ", chi text thuan)`;

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 200 }
      })
    });
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) return null;
    return reply.replace(/[*#`_]/g, '').substring(0, 280);
  } catch (e) {
    console.error('[aiReply] error:', e.message);
    return null;
  }
}

// === FORWARD TO kinhdoanh@nsca.vn — khi co yeu cau dat hang + contact ===
const { execFileSync } = require('child_process');
async function forwardToSales(commentText, contact, articleId, commenterName) {
  try {
    const phones = contact.phones.join(', ') || '(chua de lai)';
    const emails = contact.emails.join(', ') || '(chua de lai)';
    const subject = '[OA Lead] Yeu cau bao gia/dat hang tu comment - ' + (commenterName || 'KH');
    const body = `Comment moi tren OA Starasia JSC co yeu cau cu the:

Nguoi comment: ${commenterName || '(chua biet ten)'}
SDT: ${phones}
Email: ${emails}
Article ID: ${articleId}

Noi dung comment:
"${commentText}"

Tin chuyen tu Le Na - OA Comment Auto-Pipeline.
Vui long lien he khach trong vong 24h.

Tran trong,
Dao Thi Le Na
Tro ly AI CEO Dao Huy Khanh
lena@nsca.vn`;

    execFileSync('node', [
      __dirname + '/gmail-send.js',
      'kinhdoanh@nsca.vn',
      subject,
      body,
      'ndao@nsca.vn'
    ], { encoding: 'utf-8', timeout: 30000 });
    return true;
  } catch (e) {
    console.error('[forwardToSales] error:', e.message);
    return false;
  }
}

// === ESCALATE — bao VIP qua Zalo OA cho phan nan / ky thuat phuc tap ===
async function escalateToVIP(target, summary, commentText, articleId) {
  try {
    const msg = `[OA Comment ${target === 'sep-khanh' ? 'CAN DUYET' : 'PHAN NAN/KY THUAT'}]
Bai: ${articleId}
Comment: "${commentText.substring(0, 300)}"
${summary}`;
    execFileSync('node', [
      __dirname + '/zalo-oa-send.js',
      target,
      msg
    ], { encoding: 'utf-8', timeout: 30000 });
    return true;
  } catch (e) {
    console.error('[escalateToVIP] error:', e.message);
    return false;
  }
}

async function processArticleComments(articleId, since, replied, report) {
  const list = await getComments(articleId, 0, 50);
  if (list.error !== 0) {
    report.errors.push({ article_id: articleId, error: list.message || list.error, raw: list });
    return;
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
      logEvent({ kind: 'spam', comment_id: cId, article_id: articleId, reason: mod.reason, text: text.substring(0, 200) });
      markReplied(cId, { article_id: articleId, skipped: mod.reason });
      continue;
    }

    // === NEW PIPELINE — extract contact + classify + route ===
    const contact = extractContact(text);
    const commenterName = c.from?.name || c.user?.name || c.author || '';
    const klass = classifyComment(text, contact.has);

    // BRANCH 1 — Phan nan: escalate Sep + anh Ngoc, KHONG auto-reply (cho VIP duyet)
    if (klass === 'complaint') {
      await escalateToVIP('anh-ngoc', 'PHAN NAN tu khach — can VIP review reply', text, articleId);
      await escalateToVIP('sep-khanh', 'PHAN NAN tren OA — anh Ngoc se xu ly', text, articleId);
      markReplied(cId, { article_id: articleId, escalated: 'complaint' });
      logEvent({ kind: 'escalate_complaint', comment_id: cId, article_id: articleId, text: text.substring(0, 200) });
      report.escalated = (report.escalated || 0) + 1;
      continue;
    }

    // BRANCH 2 — Don hang/bao gia CO contact: forward email kinhdoanh + reply xac nhan
    if (klass === 'order_with_contact') {
      const forwarded = await forwardToSales(text, contact, articleId, commenterName);
      const ackMsg = 'Da em ghi nhan SDT/email. Bo phan Kinh doanh anh Ngoc se lien he trong 24h. Cam on anh/chi quan tam STARDUCT.';
      const reply = await replyComment(cId, ackMsg, articleId);
      markReplied(cId, { article_id: articleId, forwarded, ack: reply.error === 0 });
      logEvent({ kind: 'forward_order', comment_id: cId, article_id: articleId, contact, forwarded, text: text.substring(0, 100) });
      report.forwarded = (report.forwarded || 0) + 1;
      if (reply.error === 0) report.replied++;
      continue;
    }

    // BRANCH 3 — Hoi ky thuat phuc tap: escalate anh Ngoc + AI reply tam thoi
    if (klass === 'technical_complex') {
      await escalateToVIP('anh-ngoc', 'CAU HOI KY THUAT phuc tap — can BPKD tu van chi tiet', text, articleId);
      const aiAnswer = await aiReply(text, '');
      const tempReply = aiAnswer || 'Da em ghi nhan cau hoi ky thuat. BPKD se phan hoi chi tiet. Anh/chi co the tham khao tool.starductselection.com de chon SP phu hop.';
      const reply = await replyComment(cId, tempReply, articleId);
      markReplied(cId, { article_id: articleId, escalated: 'technical', ai_reply: !!aiAnswer });
      logEvent({ kind: 'escalate_technical', comment_id: cId, article_id: articleId, text: text.substring(0, 150), reply: tempReply.substring(0, 100) });
      report.escalated = (report.escalated || 0) + 1;
      if (reply.error === 0) report.replied++;
      continue;
    }

    // BRANCH 4 — Template FAQ match: reply nhanh template (giu logic cu)
    const tplReply = matchTemplate(text);
    if (tplReply) {
      const reply = await replyComment(cId, tplReply, articleId);
      if (reply.error === 0) {
        markReplied(cId, { article_id: articleId, template: true });
        logEvent({ kind: 'reply_template', comment_id: cId, article_id: articleId, text: text.substring(0, 100), reply: tplReply.substring(0, 100) });
        report.replied++;
      } else {
        report.errors.push({ comment_id: cId, error: reply.message || reply.error });
      }
      continue;
    }

    // BRANCH 5 — Don hang CHUA contact: AI reply moi cung cap SDT/email
    if (klass === 'order_no_contact') {
      const askContact = 'Da cam on anh/chi quan tam. Anh/chi de lai SDT hoac email gium em, BPKD se lien he bao gia chi tiet (hoac inbox rieng OA cung duoc a).';
      const reply = await replyComment(cId, askContact, articleId);
      if (reply.error === 0) {
        markReplied(cId, { article_id: articleId, ask_contact: true });
        logEvent({ kind: 'ask_contact', comment_id: cId, article_id: articleId, text: text.substring(0, 100) });
        report.replied++;
      }
      continue;
    }

    // BRANCH 6 — General comment khong dac biet: AI reply contextual
    const aiAnswer = await aiReply(text, '');
    if (aiAnswer) {
      const reply = await replyComment(cId, aiAnswer, articleId);
      if (reply.error === 0) {
        markReplied(cId, { article_id: articleId, ai_reply: true });
        logEvent({ kind: 'reply_ai', comment_id: cId, article_id: articleId, text: text.substring(0, 100), reply: aiAnswer.substring(0, 100) });
        report.replied++;
        report.ai_replied = (report.ai_replied || 0) + 1;
      } else {
        report.errors.push({ comment_id: cId, error: reply.message || reply.error });
      }
    } else {
      // Khong co Gemini hoac AI fail — log de Le Na xu ly tay
      logEvent({ kind: 'no_template_no_ai', comment_id: cId, article_id: articleId, text: text.substring(0, 200) });
    }
  }
}

async function cmdScan(hours = 24) {
  const since = Date.now() - hours * 3600 * 1000;
  const listResult = await listArticles(20);
  const articles = listResult.articles || [];
  const replied = loadReplied();
  const report = {
    articles: 0,
    comments: 0,
    new_comments: 0,
    replied: 0,
    skipped_spam: 0,
    errors: [],
    list_articles: { variant: listResult.variant, attempts: listResult.attempts }
  };

  for (const art of articles) {
    if (art.created_date && art.created_date * 1000 < since - 14 * 24 * 3600 * 1000) continue;
    const artId = art.id || art.article_id || art.media_id || art.token;
    if (!artId) {
      report.errors.push({ error: 'article missing id field', keys: Object.keys(art || {}) });
      continue;
    }
    report.articles++;
    await processArticleComments(artId, since, replied, report);
  }

  console.log(JSON.stringify({ success: true, ...report }, null, 2));
}

// Scan comments cua 1 article cu the — bypass listArticles, dung khi CEO biet
// article_id (vd: tu webhook event hoac copy link bai viet). Cung dung de test
// API getcomment co quyen doc khong, doc lap voi article/getslice.
async function cmdScanArticle(articleId, hours = 24 * 30) {
  if (!articleId) {
    console.log(JSON.stringify({ success: false, error: 'Missing article_id' }));
    process.exit(1);
  }
  const since = Date.now() - hours * 3600 * 1000;
  const replied = loadReplied();
  const report = {
    article_id: articleId,
    articles: 1,
    comments: 0,
    new_comments: 0,
    replied: 0,
    skipped_spam: 0,
    errors: []
  };
  await processArticleComments(articleId, since, replied, report);
  console.log(JSON.stringify({ success: true, ...report }, null, 2));
}

function usage() {
  console.log(JSON.stringify({
    usage: {
      list: 'node zalo-oa-comment.js list <article_id> [offset] [limit]',
      reply: 'node zalo-oa-comment.js reply <comment_id> "<message>" [article_id]',
      scan: 'node zalo-oa-comment.js scan [hours]',
      'scan-article': 'node zalo-oa-comment.js scan-article <article_id> [hours]'
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
  if (cmd === 'scan-article') {
    return cmdScanArticle(process.argv[3], parseInt(process.argv[4] || String(24 * 30), 10));
  }

  console.log(JSON.stringify({ success: false, error: `Unknown cmd: ${cmd}` }));
  process.exit(1);
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
