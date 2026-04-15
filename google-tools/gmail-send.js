#!/usr/bin/env node
// Gmail Send — Le Na CEO Agent
// Usage: node gmail-send.js <to> <subject> <body> [cc] [attachmentPath]
// cc: optional, comma-separated CC addresses (use "" to skip)
// attachmentPath: optional, path to file to attach
//
// Examples:
//   node gmail-send.js "anh@nsca.vn" "Subject" "Body"
//   node gmail-send.js "anh@nsca.vn" "Subject" "Body" "dhk@nsca.vn"
//   node gmail-send.js "anh@nsca.vn" "Subject" "Body" "dhk@nsca.vn" "/tmp/report.pdf"
//   node gmail-send.js "anh@nsca.vn" "Subject" "Body" "" "/tmp/report.pdf"

const fs = require('fs');
const path = require('path');

const to = process.argv[2];
const subject = process.argv[3];
const body = process.argv[4];
const cc = process.argv[5] || '';
const attachmentPath = process.argv[6] || '';

if (!to || !subject || !body) {
  console.error('Usage: node gmail-send.js <to> <subject> <body> [cc] [attachmentPath]');
  process.exit(1);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN_LENA || process.env.GOOGLE_REFRESH_TOKEN;
const SENDER_EMAIL = process.env.GOOGLE_REFRESH_TOKEN_LENA ? 'lena@nsca.vn' : 'dhk@nsca.vn';

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

function mimeEncodeSubject(str) {
  const encoded = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

function mimeEncodeName(str) {
  const encoded = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

// Guess MIME type from file extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.zip': 'application/zip',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.md': 'text/markdown',
  };
  return types[ext] || 'application/octet-stream';
}

function buildSimpleEmail(headers, htmlBody) {
  const email = [
    ...headers,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(`<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#333;">${htmlBody}</body></html>`, 'utf-8').toString('base64')
  ].join('\r\n');
  return email;
}

function buildMultipartEmail(headers, htmlBody, filePath) {
  const boundary = '----=_Part_' + Date.now().toString(36);
  const fileName = path.basename(filePath);
  const mimeType = getMimeType(filePath);
  const fileData = fs.readFileSync(filePath);
  const fileBase64 = fileData.toString('base64');

  // MIME encode filename for Vietnamese/Unicode support
  const encodedFileName = `=?UTF-8?B?${Buffer.from(fileName, 'utf-8').toString('base64')}?=`;

  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(`<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#333;">${htmlBody}</body></html>`, 'utf-8').toString('base64'),
    '',
    `--${boundary}`,
    `Content-Type: ${mimeType}; name="${encodedFileName}"`,
    `Content-Disposition: attachment; filename="${encodedFileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    fileBase64,
    '',
    `--${boundary}--`
  ].join('\r\n');

  return parts;
}

async function main() {
  const token = await getAccessToken();

  // Process body: preserve HTML tags, convert newlines to <br>
  let processed = body.replace(/<[^>]*>/gs, (tag) => tag.replace(/[\r\n]+/g, ' '));
  const htmlBody = processed.replace(/\n/g, '<br>');

  // Build headers
  const headers = [`To: ${to}`];
  if (cc) headers.push(`Cc: ${cc}`);
  headers.push(
    `From: ${mimeEncodeName('Đào Thị Lê Na - NSCA')} <${SENDER_EMAIL}>`,
    `Subject: ${mimeEncodeSubject(subject)}`,
    'MIME-Version: 1.0',
  );

  // Build email — with or without attachment
  let email;
  let attachedFile = null;

  if (attachmentPath && fs.existsSync(attachmentPath)) {
    email = buildMultipartEmail(headers, htmlBody, attachmentPath);
    attachedFile = path.basename(attachmentPath);
  } else {
    email = buildSimpleEmail(headers, htmlBody);
    if (attachmentPath && !fs.existsSync(attachmentPath)) {
      console.error(`Warning: attachment file not found: ${attachmentPath}, sending without attachment`);
    }
  }

  const encoded = Buffer.from(email).toString('base64url');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encoded })
  });

  const result = await res.json();

  if (result.id) {
    console.log(JSON.stringify({
      success: true,
      messageId: result.id,
      to,
      cc: cc || undefined,
      subject,
      attachment: attachedFile || undefined
    }));
  } else {
    console.log(JSON.stringify({ success: false, error: result }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
