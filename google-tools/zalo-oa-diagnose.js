#!/usr/bin/env node
require('./_env');
// Zalo OA — diagnostic script để verify permissions/scope và probe article endpoints
// Mục tiêu: kết luận chính xác root cause của -209 "API is not support"
//
// Usage: railway run -- node google-tools/zalo-oa-diagnose.js
// Output: JSON report đầy đủ, không thay đổi gì trên Zalo

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
  console.log(JSON.stringify({ error: 'No OA access token' }));
  process.exit(1);
}

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'access_token': ACCESS_TOKEN } });
    const data = await res.json();
    return { http: res.status, ...data };
  } catch (e) {
    return { http: 'EXC', error: -1, message: e.message };
  }
}

async function post(url, body, contentType = 'application/json') {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'access_token': ACCESS_TOKEN, 'Content-Type': contentType },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    const data = await res.json();
    return { http: res.status, ...data };
  } catch (e) {
    return { http: 'EXC', error: -1, message: e.message };
  }
}

async function probeForm(url) {
  // Probe upload endpoint by sending an empty multipart form — answer tells us
  // whether the endpoint exists (will complain about missing file) or not (-209).
  try {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from('test')], { type: 'image/jpeg' }), 'test.jpg');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'access_token': ACCESS_TOKEN },
      body: fd
    });
    const data = await res.json();
    return { http: res.status, ...data };
  } catch (e) {
    return { http: 'EXC', error: -1, message: e.message };
  }
}

(async () => {
  const report = { tested_at: new Date().toISOString(), token_prefix: ACCESS_TOKEN.substring(0, 10), checks: {} };

  // 1. Get OA info (verify token + look for scope/permission fields)
  report.checks.oa_getoa_v2 = await get('https://openapi.zalo.me/v2.0/oa/getoa');
  report.checks.oa_getoa_v3 = await get('https://openapi.zalo.me/v3.0/oa/getoa');
  report.checks.oa_profile_v3 = await get('https://openapi.zalo.me/v3.0/oa/profile');

  // 2. Article endpoints — confirm error map
  report.checks.article_v2_getslice = await get(
    'https://openapi.zalo.me/v2.0/article/getslice?data=' +
    encodeURIComponent(JSON.stringify({ offset: 0, limit: 5, type: 'normal' }))
  );
  report.checks.article_v2_create_no_cover = await post(
    'https://openapi.zalo.me/v2.0/article/create',
    { type: 'normal', title: 'diag', description: 'diag', body: [{ type: 'text', content: '<p>x</p>' }], status: 'draft' }
  );

  // 3. Probe upload endpoints — current path
  report.checks.article_v2_upload_image = await probeForm('https://openapi.zalo.me/v2.0/article/upload_image');
  report.checks.article_v2_upload_video_or_cover = await probeForm('https://openapi.zalo.me/v2.0/article/upload_video_or_cover');

  // 4. Probe possible new paths — v3.0 / alternative names
  report.checks.article_v3_upload_image = await probeForm('https://openapi.zalo.me/v3.0/article/upload_image');
  report.checks.article_v3_upload_cover = await probeForm('https://openapi.zalo.me/v3.0/article/upload_cover');
  report.checks.oa_v2_upload_image = await probeForm('https://openapi.zalo.me/v2.0/oa/upload/image');
  report.checks.oa_v3_upload_image = await probeForm('https://openapi.zalo.me/v3.0/oa/upload/image');

  // 5. Article media endpoints (alternative names found in older docs)
  report.checks.article_v2_media_upload = await probeForm('https://openapi.zalo.me/v2.0/article/media/upload');
  report.checks.article_v3_create = await post(
    'https://openapi.zalo.me/v3.0/article/create',
    { type: 'normal', title: 'diag', description: 'diag', body: [{ type: 'text', content: '<p>x</p>' }], status: 'draft' }
  );

  // 6. COMMENT endpoint probes — diagnose -209 17/05/2026
  // Goal: tim endpoint comment con live de fix zalo-oa-comment.js
  // Probe READ ONLY voi article_id dummy '0' — chap nhan error param-level (-201) la live
  const cArticleId = '0';
  const cParams = JSON.stringify({ article_id: cArticleId, offset: 0, limit: 5 });
  const cEncoded = encodeURIComponent(cParams);

  report.checks.comment_v2_getcomment = await get(
    'https://openapi.zalo.me/v2.0/article/getcomment?data=' + cEncoded
  );
  report.checks.comment_v2_get_comment_underscore = await get(
    'https://openapi.zalo.me/v2.0/article/get_comment?data=' + cEncoded
  );
  report.checks.comment_v2_comment_list = await get(
    'https://openapi.zalo.me/v2.0/article/comment/list?data=' + cEncoded
  );
  report.checks.comment_v3_getcomment = await get(
    'https://openapi.zalo.me/v3.0/article/getcomment?data=' + cEncoded
  );
  report.checks.comment_v3_comment_list = await get(
    'https://openapi.zalo.me/v3.0/article/comment/list?data=' + cEncoded
  );
  report.checks.comment_v2_oa_comment_list = await get(
    'https://openapi.zalo.me/v2.0/oa/comment/list?data=' + cEncoded
  );
  report.checks.comment_v3_oa_comment_list = await get(
    'https://openapi.zalo.me/v3.0/oa/comment/list?data=' + cEncoded
  );

  // Verdict heuristics
  report.verdict = {
    permission_article_likely_granted:
      report.checks.article_v2_create_no_cover.error === -201 ||
      report.checks.article_v2_getslice.error === -201 ||
      (report.checks.article_v2_create_no_cover.error !== -202 &&
       report.checks.article_v2_create_no_cover.error !== -211),
    upload_endpoint_v2_deprecated:
      report.checks.article_v2_upload_image.error === -209,
    working_upload_candidates: Object.entries(report.checks)
      .filter(([k, v]) => k.includes('upload') && v.error !== -209 && v.error !== undefined)
      .map(([k, v]) => ({ endpoint: k, error: v.error, message: v.message })),

    // Comment endpoints — endpoint VAN LIVE neu error !== -209 (vd -201 param invalid = endpoint ton tai)
    comment_v2_deprecated:
      report.checks.comment_v2_getcomment.error === -209,
    comment_alive_candidates: Object.entries(report.checks)
      .filter(([k, v]) => k.startsWith('comment_') && v.error !== -209 && v.error !== undefined)
      .map(([k, v]) => ({ endpoint: k, http: v.http, error: v.error, message: v.message }))
  };

  console.log(JSON.stringify(report, null, 2));
})();
