#!/usr/bin/env node
// Gmail Send — Le Na CEO Agent
// Usage: node gmail-send.js <to> <subject> <body>

const to = process.argv[2];
const subject = process.argv[3];
const body = process.argv[4];

if (!to || !subject || !body) {
  console.error('Usage: node gmail-send.js <to> <subject> <body>');
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

const SIGNATURE_HTML = `
<br><hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <tr>
    <td style="padding-right:15px;vertical-align:top;">
      <img src="https://raw.githubusercontent.com/dhk1805-creator/lena-ceo-agent/main/lena-avatar.jpg"
           width="80" height="80" style="border-radius:50%;" alt="Le Na">
    </td>
    <td style="vertical-align:top;">
      <strong style="font-size:14px;color:#1a5276;">Đào Thị Lê Na</strong><br>
      Trợ lý CEO Đào Huy Khánh<br>
      <strong>Công ty CP Ngôi Sao Châu Á (NSCA) / STARDUCT</strong><br>
      Email: dhk@nsca.vn | Tel: 0903 232 222<br>
      <em style="font-size:11px;color:#888;">AI Executive Assistant — Powered by NSCA</em>
    </td>
  </tr>
</table>`;

async function main() {
  const token = await getAccessToken();

  const htmlBody = body.replace(/\n/g, '<br>') + SIGNATURE_HTML;

  const email = [
    `To: ${to}`,
    `From: "Đào Thị Lê Na - NSCA" <dhk@nsca.vn>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    `<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#333;">${htmlBody}</body></html>`
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
    console.log(JSON.stringify({ success: true, messageId: result.id, to, subject }));
  } else {
    console.log(JSON.stringify({ success: false, error: result }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
