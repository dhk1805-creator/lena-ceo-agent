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

async function createArticle(title, bodyText, coverSource, autoCleanup) {
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
  let createData = await postArticle(article);

  // [2026-05-16 — Issue #70] -223 = OA đạt quota tạo bài viết (gói Nâng cao
  // ~15 bài/tháng). Nếu bật --auto-cleanup → xóa bài cũ nhất rồi retry create
  // 1 lần. Dùng cho cron auto-post để duy trì rolling window bài mới nhất.
  let cleanupInfo = null;
  if (createData.error === -223 && autoCleanup) {
    console.error('[article] -223 quota hit → auto-cleanup: tìm bài cũ nhất để xóa');
    const oldest = await findOldestArticleId();
    if (oldest.id) {
      const delResult = await deleteArticle(oldest.id);
      cleanupInfo = { deleted_id: oldest.id, deleted_title: oldest.title || null, delete_ok: !!delResult.success };
      console.error(`[article] auto-cleanup deleted oldest: ${JSON.stringify(cleanupInfo)}`);
      if (delResult.success) {
        createData = await postArticle(article);
      }
    } else {
      cleanupInfo = { deleted_id: null, reason: oldest.reason || 'no oldest found' };
      console.error(`[article] auto-cleanup không tìm được bài để xóa: ${oldest.reason}`);
    }
  }

  if (createData.error !== 0) {
    const result = {
      success: false,
      step: 'create',
      error: createData.message,
      detail: createData
    };
    if (createData.error === -223) {
      result.quota_exceeded = true;
      result.suggestion = 'OA đạt quota tạo bài tháng (gói Nâng cao ~15 bài). Cần: (a) gọi list để lấy article_id của bài cũ nhất → gọi delete để giải phóng quota, hoặc (b) Sếp nâng gói OA trên Zalo OA admin. Có thể truyền auto_cleanup=true để Lê Na tự xóa bài cũ nhất và retry.';
    }
    if (cleanupInfo) result.auto_cleanup = cleanupInfo;
    return result;
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

// [2026-05-13 — Issue #17] /v2.0/article/getslice với `type: 'normal'` trả về
// -201 "type accept only 2 value normal and video." trên OA production. Thử
// nhiều biến thể URL/param thay vì fail im lặng. Đồng bộ với listArticles
// trong zalo-oa-comment.js.
//
// [2026-05-14 — Issue #33] Bug "total=9 nhưng articles=[]": Zalo trả về
// `data.total` nhưng mảng article ở key khác (medias/media_array/list/items)
// — code cũ chỉ check `articles` và `list` nên parse miss. findArticleArray()
// thử nhiều tên field rồi fallback scan bất kỳ array nào trong data.
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

// [2026-05-16 — Issue #70] Tìm article cũ nhất để auto-cleanup khi -223 quota
// hit. Probe các variant getslice giống listArticles nhưng giữ raw created_date
// để sort. Trả về { id, title, created_date } hoặc { id: null, reason }.
async function findOldestArticleId() {
  const variants = [
    `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 50, type: 'normal' }))}`,
    `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 50 }))}`,
    `https://openapi.zalo.me/v2.0/article/getslice?offset=0&limit=50&type=normal`,
  ];
  let lastError = null;
  for (const url of variants) {
    try {
      const res = await fetch(url, { headers: { 'access_token': ACCESS_TOKEN } });
      const data = await res.json();
      if (data.error !== 0) { lastError = data.message; continue; }
      const found = findArticleArray(data.data);
      if (found.items.length === 0) { lastError = 'empty list'; continue; }
      const withDate = found.items.filter(a => typeof a.created_date === 'number');
      const sorted = withDate.length > 0
        ? withDate.slice().sort((a, b) => a.created_date - b.created_date)
        : found.items;
      const oldest = sorted[0];
      const id = oldest.id || oldest.article_id || oldest.media_id || oldest.token;
      if (id) {
        return { id, title: oldest.title || null, created_date: oldest.created_date || null };
      }
    } catch (e) { lastError = e.message; }
  }
  return { id: null, reason: lastError || 'list_failed' };
}

async function deleteArticle(articleId) {
  if (!articleId) {
    return { success: false, error: 'Thiếu article_id. Truyền ID bài cần xóa (lấy từ list).' };
  }

  // Zalo OA: POST /v2.0/article/remove với body { id: <article_id> }
  const res = await fetch('https://openapi.zalo.me/v2.0/article/remove', {
    method: 'POST',
    headers: { 'access_token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: articleId })
  });
  const data = await res.json();
  console.error(`[article] remove response: ${JSON.stringify(data)}`);

  if (data.error !== 0) {
    return { success: false, step: 'remove', error: data.message, detail: data };
  }
  return { success: true, article_id: articleId, status: 'deleted' };
}

async function listArticles() {
  const variants = [
    { name: 'v2_data_normal', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10, type: 'normal' }))}` },
    { name: 'v2_data_no_type', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10 }))}` },
    { name: 'v2_flat_normal', url: `https://openapi.zalo.me/v2.0/article/getslice?offset=0&limit=10&type=normal` },
    { name: 'v2_data_video', url: `https://openapi.zalo.me/v2.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10, type: 'video' }))}` },
    { name: 'v3_data_normal', url: `https://openapi.zalo.me/v3.0/article/getslice?data=${encodeURIComponent(JSON.stringify({ offset: 0, limit: 10, type: 'normal' }))}` },
  ];

  const attempts = [];
  let firstSuccess = null;
  for (const v of variants) {
    try {
      const res = await fetch(v.url, { headers: { 'access_token': ACCESS_TOKEN } });
      const data = await res.json();
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
        return {
          success: true,
          variant: v.name,
          items_key: found.key,
          total: total ?? articles.length,
          articles: articles.map(a => ({
            id: a.id || a.article_id || a.media_id || a.token,
            title: a.title,
            status: a.status,
            created: a.created_date ? new Date(a.created_date * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-'
          })),
          attempts
        };
      }
      if (data.error === 0 && !firstSuccess) {
        firstSuccess = { variant: v.name, total };
      }
    } catch (e) {
      attempts.push({ variant: v.name, error: -1, message: e.message });
    }
  }
  if (firstSuccess) {
    return {
      success: false,
      variant: firstSuccess.variant,
      total: firstSuccess.total,
      articles: [],
      error: 'Zalo trả về error=0 nhưng không tìm thấy mảng article (check attempts[].data_keys để biết Zalo dùng tên field gì)',
      attempts
    };
  }
  return { success: false, attempts };
}

async function main() {
  const cmd = process.argv[2];

  if (!cmd || cmd === 'help') {
    console.log(JSON.stringify({
      usage: {
        create: 'node zalo-oa-article.js create "<title>" "<body>" "[cover_image_path_or_url]" [--auto-cleanup]',
        list: 'node zalo-oa-article.js list',
        delete: 'node zalo-oa-article.js delete "<article_id>"'
      },
      notes: 'body = plain text, auto-converted to HTML. cover = local path or URL. --auto-cleanup: nếu -223 quota, tự xóa bài cũ nhất và retry 1 lần.'
    }));
    process.exit(0);
  }

  if (cmd === 'list') {
    const result = await listArticles();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'delete' || cmd === 'remove') {
    const articleId = process.argv[3];
    const result = await deleteArticle(articleId);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exit(1);
    return;
  }

  if (cmd === 'create') {
    const autoCleanup = process.argv.includes('--auto-cleanup');
    // Loại flag khỏi positional để --auto-cleanup có thể đứng ở vị trí bất kỳ
    const positional = process.argv.slice(3).filter(a => !a.startsWith('--'));
    const title = positional[0];
    const body = positional[1];
    const cover = positional[2] || null;

    if (!title || !body) {
      console.log(JSON.stringify({ error: 'Missing title or body', usage: 'create "<title>" "<body>" "[cover]" [--auto-cleanup]' }));
      process.exit(1);
    }

    const result = await createArticle(title, body, cover, autoCleanup);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exit(1);
    return;
  }

  console.log(JSON.stringify({ error: `Unknown command: ${cmd}. Use: create, list, delete` }));
  process.exit(1);
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
