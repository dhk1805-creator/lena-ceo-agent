#!/usr/bin/env node
// Google Docs Create — Le Na CEO Agent
// Usage: node gdoc-create.js <title> <content>
// Creates a Google Doc with title and markdown-like content
// Returns: { success, docId, docUrl }

const title = process.argv[2];
const content = process.argv[3];

if (!title || !content) {
  console.error('Usage: node gdoc-create.js <title> <content>');
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

async function main() {
  const token = await getAccessToken();

  // Step 1: Create empty Google Doc
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });
  const doc = await createRes.json();

  if (!doc.documentId) {
    console.log(JSON.stringify({ success: false, error: doc }));
    process.exit(1);
  }

  // Step 2: Insert content into the doc
  // Google Docs API requires 'requests' to insert text
  const requests = [];

  // Insert all content as plain text at index 1 (after the implicit newline)
  requests.push({
    insertText: {
      location: { index: 1 },
      text: content
    }
  });

  // Apply heading styles to lines starting with === or ---
  // We do this as a simple text insert; CEO can format in Google Docs UI

  const updateRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    }
  );

  const updateResult = await updateRes.json();

  if (updateResult.replies) {
    // Step 3: Move doc to shared folder (optional — BGD folder)
    // CEO can access via link
    const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`;

    console.log(JSON.stringify({
      success: true,
      docId: doc.documentId,
      docUrl,
      title
    }));
  } else {
    console.log(JSON.stringify({
      success: false,
      docId: doc.documentId,
      error: updateResult
    }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
