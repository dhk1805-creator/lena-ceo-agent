#!/usr/bin/env node
// Facebook Page Post — Le Na CEO Agent
// Usage: node facebook-post.js <message> [imageUrl] [link]
//
// Examples:
//   node facebook-post.js "Hello from NSCA!"
//   node facebook-post.js "New product" "https://example.com/image.jpg"
//   node facebook-post.js "Check out" "" "https://starduct.vn"
//   node facebook-post.js "Product launch" "https://example.com/img.jpg" "https://starduct.vn"

const fs = require('fs');
const path = require('path');

const message = process.argv[2];
const imageUrl = process.argv[3] || '';
const link = process.argv[4] || '';

if (!message) {
  console.error('Usage: node facebook-post.js <message> [imageUrl] [link]');
  console.error('');
  console.error('Examples:');
  console.error('  node facebook-post.js "Hello from NSCA!"');
  console.error('  node facebook-post.js "New product" "https://example.com/image.jpg"');
  console.error('  node facebook-post.js "Check out" "" "https://starduct.vn"');
  process.exit(1);
}

const PAGE_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '132023350327193';

if (!PAGE_TOKEN) {
  console.error(JSON.stringify({ error: 'FACEBOOK_PAGE_TOKEN environment variable not set' }));
  process.exit(1);
}

async function postText(message, link) {
  const url = `https://graph.facebook.com/v25.0/${PAGE_ID}/feed`;
  const body = { message, access_token: PAGE_TOKEN };
  if (link) body.link = link;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return res.json();
}

async function postPhoto(message, imageUrl) {
  const url = `https://graph.facebook.com/v25.0/${PAGE_ID}/photos`;
  const body = {
    message,
    url: imageUrl,
    access_token: PAGE_TOKEN
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return res.json();
}

async function postLocalPhoto(message, imagePath) {
  // For local file upload, use multipart/form-data
  const FormData = require('form-data') || null;

  // Simple multipart upload without external dependency
  const boundary = '----FormBoundary' + Date.now().toString(36);
  const fileData = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath);

  // Determine MIME type
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.bmp': 'image/bmp'
  };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

  const parts = [];
  // message field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n${message}`);
  // access_token field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${PAGE_TOKEN}`);
  // file field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`);

  const header = Buffer.from(parts.join('\r\n') + '\r\n', 'utf-8');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const bodyBuffer = Buffer.concat([header, fileData, footer]);

  const url = `https://graph.facebook.com/v25.0/${PAGE_ID}/photos`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  return res.json();
}

async function main() {
  let result;

  if (imageUrl) {
    // Check if imageUrl is a local file path or a URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Remote image URL
      result = await postPhoto(message, imageUrl);
    } else if (fs.existsSync(imageUrl)) {
      // Local file
      result = await postLocalPhoto(message, imageUrl);
    } else {
      console.error(`Warning: image not found: ${imageUrl}, posting text only`);
      result = await postText(message, link);
    }
  } else {
    // Text post (with optional link)
    result = await postText(message, link);
  }

  if (result.id || result.post_id) {
    const postId = result.id || result.post_id;
    console.log(JSON.stringify({
      success: true,
      postId,
      postUrl: `https://www.facebook.com/${postId.replace('_', '/posts/')}`,
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      hasImage: !!imageUrl,
      hasLink: !!link
    }));
  } else {
    console.log(JSON.stringify({
      success: false,
      error: result.error || result
    }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
