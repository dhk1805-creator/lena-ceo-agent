#!/usr/bin/env node
// Gmail Read — Le Na CEO Agent
// Usage: node gmail-read.js [hours=24] [maxResults=20] [query=optional]
// Examples:
//   node gmail-read.js 24 20              — Inbox 24h, max 20
//   node gmail-read.js 168 100            — 7 ngay, max 100
//   node gmail-read.js 24 10 "from:namph@nsca.vn"  — Tu 1 nguoi cu the
//   node gmail-read.js 168 50 "subject:bao cao"     — Tim theo chu de

const hours = parseInt(process.argv[2] || '24');
const maxResults = parseInt(process.argv[3] || '20');
const extraQuery = process.argv[4] || '';

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
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function gmailAPI(path, token) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

function decodeBase64(str) {
  try {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch { return ''; }
}

function extractBody(payload) {
  // Try to get text/plain or text/html from message parts
  if (payload.body && payload.body.data) {
    return decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBase64(part.body.data);
      }
    }
    // Fallback to text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const html = decodeBase64(part.body.data);
        // Strip HTML tags for readability
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
      }
    }
    // Recursion for multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const body = extractBody(part);
        if (body) return body;
      }
    }
  }
  return '';
}

async function main() {
  const token = await getAccessToken();

  // Build query — NO in:inbox filter so we catch all emails including archived
  const afterDate = Math.floor((Date.now() - hours * 3600 * 1000) / 1000);
  let query = `after:${afterDate}`;
  if (extraQuery) {
    query += ` ${extraQuery}`;
  }

  const list = await gmailAPI(`messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, token);

  if (!list.messages || list.messages.length === 0) {
    console.log(JSON.stringify({
      count: 0,
      messages: [],
      query,
      summary: `Khong co email moi trong ${hours}h qua.` + (extraQuery ? ` (filter: ${extraQuery})` : '')
    }));
    return;
  }

  const messages = [];
  for (const msg of list.messages) {
    // Get FULL format to read body content
    const detail = await gmailAPI(`messages/${msg.id}?format=full`, token);

    const headers = detail.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract body text (truncate to 1500 chars to avoid huge output)
    let body = extractBody(detail.payload || {});
    if (body.length > 1500) body = body.substring(0, 1500) + '... [truncated]';

    // Check for attachments
    const attachments = [];
    if (detail.payload?.parts) {
      for (const part of detail.payload.parts) {
        if (part.filename && part.filename.length > 0) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body?.size || 0
          });
        }
      }
    }

    messages.push({
      id: msg.id,
      threadId: detail.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      cc: getHeader('Cc'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      snippet: detail.snippet || '',
      body: body,
      labels: detail.labelIds || [],
      attachments: attachments.length > 0 ? attachments : undefined
    });
  }

  console.log(JSON.stringify({
    count: messages.length,
    total_estimated: list.resultSizeEstimate,
    period: `${hours}h`,
    query,
    account: 'dhk@nsca.vn',
    messages
  }, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
