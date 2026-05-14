#!/usr/bin/env node
require('./_env');
// Zalo OA Article — Tạo và đăng bài viết lên Official Account "Starasia JSC"
//
// Usage:
//   node zalo-oa-article.js create "<title>" "<body>" "<cover_url>"
//   node zalo-oa-article.js list
//
// cover_url: BẮT BUỘC, phải là URL public (https://...). Local file path KHÔNG hỗ trợ.
//   Lý do: /v2.0/oa/upload/image (endpoint upload duy nhất còn sống của Zalo OA)
//   chỉ trả về attachment_id, không trả URL — mà article/create lại yêu cầu photo_url.
//   Để dùng ảnh local, upload trước lên CDN public (Imgur/ImgBB/Cloudinary).
//
// body: plain text — tự động wrap thành HTML paragraphs
//
// Schema cover đã xác minh runtime [2026-05-12]:
//   cover: { cover_type: 'photo', photo_url: <URL>, status: 'show' }
//
// VD: Anh Khánh gửi ảnh qua Zalo → URL ảnh có trong event log
//     → Gemini soạn nội dung → zalo-oa-article.js create <title> <body> <url_anh>

const fs = require('fs');

const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';

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

// [2026-05-12 — đã xác minh runtime sau 30+ test]
// Schema cover chuẩn cho `/v2.0/article/create`:
//   cover: { cover_type: 'photo', photo_url: <URL>, status: 'show' }
// - cover_type là enum string ("photo" hợp lệ; "image", "normal", "1", 0, 3 đều invalid)
// - photo_url phải là URL công khai để Zalo CDN fetch về
// - status: 'show' BẮT BUỘC (thiếu → fail "create media fail")
// - attachment_id từ /oa/upload/image KHÔNG dùng được — đó là token để gửi message,
//   không phải URL ảnh. Article cần URL thật.

function textToArticleBody(text) {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map(p => ({
    type: 'text',
    content: '<p>' + p.trim().replace(/\n/g, '<br>') + '</p>'
  }));
}

async function createArticle(title, bodyText, coverSource) {
  // [2026-05-12] SCHEMA CHUẨN đã xác minh runtime cho /v2.0/article/create:
  //   cover: { cover_type: 'photo', photo_url: <URL>, status: 'show' }
  // Field `status: 'show'` BẮT BUỘC — thiếu sẽ fail "create media fail".
  // photo_url phải là URL công khai (Zalo fetch về). attachment_id từ /oa/upload/image
  // KHÔNG work với article. Local file path KHÔNG dùng được trực tiếp — cần upload
  // lên public CDN/host khác trước rồi pass URL.

  if (!coverSource) {
    return {
      success: false,
      step: 'cover',
      error: 'Cover bắt buộc cho article/create. Truyền URL ảnh public.'
    };
  }

  if (!coverSource.startsWith('http')) {
    return {
      success: false,
      step: 'cover',
      error: 'Cover phải là URL public (http/https). Local file chưa hỗ trợ vì /oa/upload/image trả attachment_id, không trả URL — cần upload lên CDN public khác (Imgur/ImgBB/v.v.) rồi pass URL.',
      detail: { received_cover: coverSource }
    };
  }

  const description = bodyText.substring(0, 150).replace(/\n/g, ' ').trim();

  const article = {
    type: 'normal',
    title: title,
    author: 'STARDUCT — Lê Na AI',
    description: description,
    body: textToArticleBody(bodyText),
    status: 'show',
    cover: {
      cover_type: 'photo',
      photo_url: coverSource,
      status: 'show'
    }
  };

  console.error(`[article] creating with cover URL: ${coverSource}`);
  const createData = await postArticle(article);

  if (createData.error !== 0) {
    return {
      success: false,
      step: 'create',
      error: createData.message,
      detail: createData
    };
  }

  const articleToken = createData.data?.token;
  if (!articleToken) {
    return { success: false, step: 'create', error: 'No article token', detail: createData };
  }

  // [2026-05-12] Verify thường fail lần đầu với -214 "Media is being processed".
  // Zalo cần vài giây để download ảnh từ photo_url về CDN của họ.
  // Retry với backoff: 2s → 4s → 6s → 8s → 12s (tổng ~32s tối đa).
  const verifyDelays = [2000, 4000, 6000, 8000, 12000];
  let verifyData = null;

  for (let i = 0; i < verifyDelays.length; i++) {
    if (i > 0) {
      console.error(`[article] verify wait ${verifyDelays[i - 1]}ms (Zalo đang xử lý media)...`);
      await new Promise(r => setTimeout(r, verifyDelays[i - 1]));
    }
    const verifyRes = await fetch('https://openapi.zalo.me/v2.0/article/verify', {
      method: 'POST',
      headers: { 'access_token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: articleToken })
    });
    verifyData = await verifyRes.json();
    console.error(`[article] verify attempt ${i + 1}: ${JSON.stringify(verifyData)}`);
    if (verifyData.error === 0) break;
    // -214 = đang process, retry. Lỗi khác (rate limit, invalid token) → bỏ retry, fail luôn.
    if (verifyData.error !== -214) break;
  }

  if (verifyData.error !== 0) {
    return { success: false, step: 'verify', error: verifyData.message, article_token: articleToken, detail: verifyData };
  }

  return {
    success: true,
    article_id: verifyData.data?.id || verifyData.data?.article_id,
    title: title,
    cover_url: coverSource,
    description: description,
    status: 'published'
  };
}

async function postArticle(article) {
  const res = await fetch('https://openapi.zalo.me/v2.0/article/create', {
    method: 'POST',
    headers: { 'access_token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(article)
  });
  const data = await res.json();
  console.error(`[article] create response: ${JSON.stringify(data)}`);
  return data;
}

// [2026-05-14 — Issue #34] Zalo OA API đổi format. Symptom cũ: error=0,
// total=9, data=[] → response field đổi tên. Docs mới ở path "noi-dung-dang-
// bai-viet" và SDK community dùng `/media/getslice` với `count` thay vì
// `limit`. Thêm variant mới + nhận thêm field name `medias` / `items` /
// `data` array. Đồng bộ với listArticles trong zalo-oa-comment.js.
// [2026-05-13 — Issue #17] Lý do giữ nhiều variant: /v2.0/article/getslice
// với `type: 'normal'` trả -201 "type accept only 2 value normal and video"
// dù `normal` là 1 trong 2 giá trị docs cũ liệt kê → API rule đã đổi.
function extractArticles(data) {
  const d = data?.data;
  if (!d) return [];
  if (Array.isArray(d.articles)) return d.articles;
  if (Array.isArray(d.medias)) return d.medias;
  if (Array.isArray(d.list)) return d.list;
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d)) return d;
  return [];
}

async function listArticles() {
  const variants = [
    { name: 'media_data', url: `https://openapi.zalo.me/v2.0/media/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, count: 10 }))}` },
    { name: 'media_data_limit', url: `https://openapi.zalo.me/v2.0/media/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10 }))}` },
    { name: 'media_flat', url: `https://openapi.zalo.me/v2.0/media/getslice?offset=0&count=10` },
    { name: 'v2_data_no_type', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10 }))}` },
    { name: 'v2_data_count', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, count: 10 }))}` },
    { name: 'v2_data_normal', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10, type: 'normal' }))}` },
    { name: 'v2_data_video', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10, type: 'video' }))}` },
    { name: 'v2_flat_normal', url: `https://openapi.zalo.me/v2.0/article/getslice?offset=0&limit=10&type=normal` },
    { name: 'v3_data_normal', url: `https://openapi.zalo.me/v3.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10, type: 'normal' }))}` },
  ];

  const attempts = [];
  for (const v of variants) {
    try {
      const res = await fetch(v.url, { headers: { 'access_token': ACCESS_TOKEN } });
      const data = await res.json();
      const articles = extractArticles(data);
      const total = data.data?.total ?? articles.length;
      attempts.push({ variant: v.name, http: res.status, error: data.error, message: data.message || null, total, returned: articles.length });
      // Chấp nhận variant khi error=0 VÀ có data thật (total>0 thì articles>0).
      // Trước đây error=0 + articles=[] bị return success nhưng rỗng → giấu lỗi.
      if (data.error === 0 && (articles.length > 0 || total === 0)) {
        return {
          success: true,
          variant: v.name,
          total,
          articles: articles.map(a => ({
            id: a.id || a.article_id || a.media_id,
            title: a.title,
            status: a.status,
            created: a.created_date ? new Date(a.created_date * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-'
          })),
          attempts
        };
      }
    } catch (e) {
      attempts.push({ variant: v.name, error: -1, message: e.message });
    }
  }
  return { success: false, attempts };
}

async function main() {
  const cmd = process.argv[2];

  if (!cmd || cmd === 'help') {
    console.log(JSON.stringify({
      usage: {
        create: 'node zalo-oa-article.js create "<title>" "<body>" "[cover_image_path_or_url]"',
        list: 'node zalo-oa-article.js list'
      },
      notes: 'body = plain text, auto-converted to HTML. cover = local path or URL.'
    }));
    process.exit(0);
  }

  if (cmd === 'list') {
    const result = await listArticles();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'create') {
    const title = process.argv[3];
    const body = process.argv[4];
    const cover = process.argv[5] || null;

    if (!title || !body) {
      console.log(JSON.stringify({ error: 'Missing title or body', usage: 'create "<title>" "<body>" "[cover]"' }));
      process.exit(1);
    }

    const result = await createArticle(title, body, cover);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exit(1);
    return;
  }

  console.log(JSON.stringify({ error: `Unknown command: ${cmd}. Use: create, list` }));
  process.exit(1);
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
