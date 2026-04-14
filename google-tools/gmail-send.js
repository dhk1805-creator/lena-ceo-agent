#!/usr/bin/env node
// Gmail Send — Le Na CEO Agent
// Usage: node gmail-send.js <to> <subject> <body> [cc]
// cc: optional, comma-separated CC addresses
// Example: node gmail-send.js "anh@nsca.vn" "Subject" "Body" "dhk@nsca.vn,nsca@nsca.vn"

const to = process.argv[2];
const subject = process.argv[3];
const body = process.argv[4];
const cc = process.argv[5] || '';  // optional CC

if (!to || !subject || !body) {
  console.error('Usage: node gmail-send.js <to> <subject> <body> [cc]');
  process.exit(1);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Uu tien token cua lena@nsca.vn (sender rieng), fallback ve token dhk (CEO)
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

// Chu ky duoc Le Na tu them trong noi dung email (tu AGENTS.md)
// gmail-send.js CHI gui noi dung, KHONG them chu ky

// MIME encode subject (RFC 2047) — fix loi font tieng Viet trong Subject
function mimeEncodeSubject(str) {
  const encoded = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

// MIME encode ten nguoi gui (RFC 2047)
function mimeEncodeName(str) {
  const encoded = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

async function main() {
  const token = await getAccessToken();

  // Step 1: Remove newlines INSIDE HTML tags (e.g. <img src="..."\n  width="80">)
  // This prevents <br> from being injected inside tags and breaking them
  let processed = body.replace(/<[^>]*>/gs, (tag) => tag.replace(/[\r\n]+/g, ' '));
  // Step 2: Replace remaining newlines with <br> (these are in text content)
  const htmlBody = processed.replace(/\n/g, '<br>');

  const headers = [
    `To: ${to}`,
  ];
  if (cc) headers.push(`Cc: ${cc}`);
  headers.push(
    `From: ${mimeEncodeName('Đào Thị Lê Na - NSCA')} <${SENDER_EMAIL}>`,
    `Subject: ${mimeEncodeSubject(subject)}`,
    'MIME-Version: 1.0',
  );

  const email = [
    ...headers,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(`<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#333;">${htmlBody}</body></html>`, 'utf-8').toString('base64')
  ].join('\r\n');

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
    console.log(JSON.stringify({ success: true, messageId: result.id, to, cc: cc || undefined, subject }));
  } else {
    console.log(JSON.stringify({ success: false, error: result }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
