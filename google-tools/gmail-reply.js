#!/usr/bin/env node
require('./_env');
// Gmail Reply — Le Na CEO Agent
// Reply to an existing email thread
//
// Usage: node gmail-reply.js "<message_id>" "<body_html>" "[cc]"

const messageId = process.argv[2];
const body = process.argv[3];
const cc = process.argv[4] || '';

if (!messageId || !body) {
  console.log('Usage: node gmail-reply.js "<message_id>" "<body_html>" "[cc]"');
  process.exit(1);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

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

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

async function main() {
  const token = await getAccessToken();

  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Message-ID&metadataHeaders=Reply-To`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const msg = await msgRes.json();

  if (msg.error) {
    console.log(JSON.stringify({ error: `Cannot get message: ${msg.error.message}` }));
    process.exit(1);
  }

  const threadId = msg.threadId;
  const headers = msg.payload?.headers || [];
  const originalSubject = getHeader(headers, 'Subject');
  const originalFrom = getHeader(headers, 'From');
  const originalMsgId = getHeader(headers, 'Message-ID');
  const replyTo = getHeader(headers, 'Reply-To');

  const replyAddr = replyTo || originalFrom;
  const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;

  const emailLines = [
    `To: ${replyAddr}`,
    cc ? `Cc: ${cc}` : '',
    `Subject: ${subject}`,
    `In-Reply-To: ${originalMsgId}`,
    `References: ${originalMsgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    body
  ].filter(Boolean).join('\r\n');

  const raw = Buffer.from(emailLines).toString('base64url');

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw, threadId })
  });

  const result = await sendRes.json();

  if (result.error) {
    console.log(JSON.stringify({ error: result.error.message }));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    action: 'reply',
    messageId: result.id,
    threadId: result.threadId,
    to: replyAddr,
    subject
  }));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
