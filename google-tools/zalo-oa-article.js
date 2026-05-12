#!/usr/bin/env node
require('./_env');
// Zalo OA Article — Tạo và đăng bài viết lên Official Account "Starasia JSC"
//
// Usage:
//   node zalo-oa-article.js create "<title>" "<body>" "[cover_image]"
//   node zalo-oa-article.js list
//
// cover_image: local path (/tmp/xxx.jpg) hoặc URL (https://...)
// body: plain text — tự động wrap thành HTML paragraphs
//
// Flow: Upload ảnh bìa → Create article → Verify (publish) → Done
//
// VD: Anh Khánh gửi ảnh qua Zalo → Lê Na lấy URL ảnh từ event log
//     → Gemini soạn nội dung → zalo-oa-article.js create + publish

const fs = require('fs');
const path = require('path');

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

async function uploadCoverImage(imageSource) {
  let imageBuffer, filename = 'cover.jpg';

  if (imageSource.startsWith('http')) {
    const res = await fetch(imageSource);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${imageSource}`);
    imageBuffer = Buffer.from(await res.arrayBuffer());
    const urlPath = new URL(imageSource).pathname;
    filename = path.basename(urlPath) || 'cover.jpg';
  } else {
    if (!fs.existsSync(imageSource)) throw new Error(`File not found: ${imageSource}`);
    imageBuffer = fs.readFileSync(imageSource);
    filename = path.basename(imageSource);
  }

  // Convert PNG to JPEG (Zalo prefers JPEG, smaller size)
  let finalBuffer = imageBuffer;
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'png') {
    try {
      const sharp = require('sharp');
      finalBuffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
      filename = filename.replace(/\.png$/i, '.jpg');
    } catch (e) {
      // sharp not available, use original
    }
  }

  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  const finalExt = filename.split('.').pop().toLowerCase();

  const formData = new FormData();
  formData.append('file', new Blob([finalBuffer], { type: mime[finalExt] || 'image/jpeg' }), filename);

  // Article cover MUST use article-specific upload endpoint —
  // URLs from /oa/upload/image are NOT accepted by /article/create ("cover value is invalid").
  const endpoints = [
    'https://openapi.zalo.me/v2.0/article/upload_image',
    'https://openapi.zalo.me/v2.0/article/upload_video_or_cover'
  ];

  let data;
  for (const endpoint of endpoints) {
    const formCopy = new FormData();
    formCopy.append('file', new Blob([finalBuffer], { type: mime[finalExt] || 'image/jpeg' }), filename);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'access_token': ACCESS_TOKEN },
      body: formCopy
    });
    data = await res.json();
    console.error(`[upload] ${endpoint} -> ${JSON.stringify(data)}`);
    if (data.error === 0) break;
  }

  if (!data || data.error !== 0) {
    throw new Error(`Upload cover failed: ${data?.message || JSON.stringify(data)}`);
  }

  const d = data.data;
  const url = typeof d === 'string' ? d : (d?.url || d?.photo_url || d?.image_url || d?.cover_url);
  if (!url || typeof url !== 'string') throw new Error(`Upload OK nhưng không tìm thấy URL: ${JSON.stringify(data)}`);
  return url;
}

function textToArticleBody(text) {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map(p => ({
    type: 'text',
    content: '<p>' + p.trim().replace(/\n/g, '<br>') + '</p>'
  }));
}

async function createArticle(title, bodyText, coverSource) {
  let coverUrl = null;
  let coverWarning = null;

  if (coverSource) {
    try {
      coverUrl = await uploadCoverImage(coverSource);
      console.error(`[article] cover uploaded: ${coverUrl}`);
    } catch (e) {
      coverWarning = `Cover upload failed: ${e.message}. Posting without cover.`;
      console.error(`[article] ${coverWarning}`);
    }
  }

  const description = bodyText.substring(0, 150).replace(/\n/g, ' ').trim();

  const article = {
    type: 'normal',
    title: title,
    author: 'STARDUCT — Lê Na AI',
    description: description,
    body: textToArticleBody(bodyText),
    status: 'show'
  };

  if (coverUrl) {
    article.cover = { cover_type: 1, photo_url: coverUrl, status: 'show' };
  }

  console.error(`[article] creating with cover=${coverUrl ? 'yes' : 'no'}`);
  let createData = await postArticle(article);

  // Fallback: if cover caused error, retry without cover
  if (createData.error !== 0 && coverUrl) {
    console.error(`[article] create failed with cover (${createData.message}), retrying without cover...`);
    coverWarning = `Cover rejected by Zalo (${createData.message}). Posted without cover.`;
    delete article.cover;
    createData = await postArticle(article);
  }

  if (createData.error !== 0) {
    return { success: false, step: 'create', error: createData.message, detail: createData };
  }

  const articleToken = createData.data?.token;
  if (!articleToken) {
    return { success: false, step: 'create', error: 'No article token', detail: createData };
  }

  const verifyRes = await fetch('https://openapi.zalo.me/v2.0/article/verify', {
    method: 'POST',
    headers: { 'access_token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: articleToken })
  });

  const verifyData = await verifyRes.json();
  console.error(`[article] verify response: ${JSON.stringify(verifyData)}`);

  if (verifyData.error !== 0) {
    return { success: false, step: 'verify', error: verifyData.message, article_token: articleToken, detail: verifyData };
  }

  return {
    success: true,
    article_id: verifyData.data?.article_id,
    title: title,
    cover: coverUrl || 'none',
    description: description,
    status: 'published',
    warning: coverWarning || undefined
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

async function listArticles() {
  const params = JSON.stringify({ offset: 0, limit: 10, type: 'normal' });
  const res = await fetch('https://openapi.zalo.me/v2.0/article/getslice?data=' + encodeURIComponent(params), {
    headers: { 'access_token': ACCESS_TOKEN }
  });
  const data = await res.json();

  if (data.error === 0 && data.data?.articles) {
    return {
      success: true,
      total: data.data.total,
      articles: data.data.articles.map(a => ({
        id: a.id,
        title: a.title,
        status: a.status,
        created: a.created_date ? new Date(a.created_date * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-'
      }))
    };
  }
  return { success: false, detail: data };
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
