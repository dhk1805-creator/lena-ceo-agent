#!/usr/bin/env node
// Gmail Read — Le Na CEO Agent
// Usage: node gmail-read.js [hours=24] [maxResults=20]

const hours = parseInt(process.argv[2] || '24');
const maxResults = parseInt(process.argv[3] || '20');

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

async function main() {
  const token = await getAccessToken();

  // Get recent messages
  const afterDate = Math.floor((Date.now() - hours * 3600 * 1000) / 1000);
  const query = `after:${afterDate} in:inbox`;
  const list = await gmailAPI(`messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, token);

  if (!list.messages || list.messages.length === 0) {
    console.log(JSON.stringify({ count: 0, messages: [], summary: `Khong co email moi trong ${hours}h qua.` }));
    return;
  }

  const messages = [];
  for (const msg of list.messages) {
    const detail = await gmailAPI(`messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, token);

    const headers = detail.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    messages.push({
      id: msg.id,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      snippet: detail.snippet || '',
      labels: detail.labelIds || []
    });
  }

  console.log(JSON.stringify({
    count: messages.length,
    period: `${hours}h`,
    messages
  }, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
