#!/usr/bin/env node
// Gmail Attachment Download — Le Na CEO Agent
// Usage: node gmail-attachment.js <messageId> [outputDir]
// Downloads ALL attachments from a Gmail message
// Returns: JSON with list of downloaded files
//
// Examples:
//   node gmail-attachment.js 18f3a2b4c5d6e7f8
//   node gmail-attachment.js 18f3a2b4c5d6e7f8 /tmp/attachments

const messageId = process.argv[2];
const outputDir = process.argv[3] || '/tmp/attachments';

if (!messageId) {
  console.error('Usage: node gmail-attachment.js <messageId> [outputDir]');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

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

async function gmailAPI(path, token) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

function findAttachments(payload, parts = []) {
  if (payload.filename && payload.filename.length > 0 && payload.body) {
    parts.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: payload.body.size || 0,
      attachmentId: payload.body.attachmentId,
      partId: payload.partId
    });
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      findAttachments(part, parts);
    }
  }
  return parts;
}

async function main() {
  const token = await getAccessToken();

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Get message details
  const message = await gmailAPI(`messages/${messageId}?format=full`, token);
  if (message.error) {
    console.log(JSON.stringify({ success: false, error: message.error }));
    return;
  }

  // Find all attachments (recursive search through nested parts)
  const attachments = findAttachments(message.payload || {});

  if (attachments.length === 0) {
    console.log(JSON.stringify({
      success: true,
      messageId,
      count: 0,
      files: [],
      note: 'Email khong co tep dinh kem'
    }));
    return;
  }

  const downloaded = [];

  for (const att of attachments) {
    try {
      // Download attachment data
      const attData = await gmailAPI(
        `messages/${messageId}/attachments/${att.attachmentId}`,
        token
      );

      if (attData.data) {
        // Decode base64url to buffer
        const buffer = Buffer.from(
          attData.data.replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        );

        // Save to file
        const filePath = path.join(outputDir, att.filename);
        fs.writeFileSync(filePath, buffer);

        downloaded.push({
          filename: att.filename,
          mimeType: att.mimeType,
          size: buffer.length,
          sizeHuman: buffer.length > 1024 * 1024
            ? (buffer.length / 1024 / 1024).toFixed(1) + ' MB'
            : (buffer.length / 1024).toFixed(1) + ' KB',
          path: filePath
        });
      }
    } catch (e) {
      downloaded.push({
        filename: att.filename,
        error: e.message
      });
    }
  }

  // Get email subject for context
  const headers = message.payload?.headers || [];
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
  const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';

  console.log(JSON.stringify({
    success: true,
    messageId,
    from,
    subject,
    count: downloaded.length,
    files: downloaded
  }, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
