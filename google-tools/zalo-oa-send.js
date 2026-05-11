#!/usr/bin/env node
// Zalo OA — gửi tin nhắn qua Official Account "Starasia JSC"
// Usage:
//   node zalo-oa-send.js <user_id> "<message>"
//   node zalo-oa-send.js list-followers           # liệt kê user_id đã follow OA
//
// Yêu cầu env vars:
//   ZALO_OA_ACCESS_TOKEN
//
// Ghi chú:
//   - Người nhận PHẢI follow OA "Starasia JSC" trước
//   - Trong vòng 7 ngày từ lần tương tác cuối (Zalo policy)
//   - user_id là Zalo user ID (KHÁC số điện thoại)

const ACCESS_TOKEN = process.env.ZALO_OA_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error(JSON.stringify({ success: false, error: 'ZALO_OA_ACCESS_TOKEN env var not set' }));
  process.exit(1);
}

async function listFollowers() {
  // GET /v3.0/oa/getfollowers
  const url = 'https://openapi.zalo.me/v3.0/oa/user/getlist?data=' + encodeURIComponent(JSON.stringify({ offset: 0, count: 50 }));
  const res = await fetch(url, {
    headers: { 'access_token': ACCESS_TOKEN }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function sendMessage(userId, message) {
  // POST /v3.0/oa/message/transaction (or /cs for free-form)
  // Free-form chat only works within 24h of user's last interaction
  // For broadcast / outside-window → need ZNS template (more complex)

  const url = 'https://openapi.zalo.me/v3.0/oa/message/cs';
  const body = {
    recipient: { user_id: userId },
    message: { text: message }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'access_token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (data.error === 0 || data.message === 'Success') {
    console.log(JSON.stringify({ success: true, message_id: data.data?.message_id, recipient: userId }));
  } else {
    console.log(JSON.stringify({ success: false, error_code: data.error, error_message: data.message, recipient: userId }));
  }
}

async function main() {
  const cmd = process.argv[2];

  if (!cmd) {
    console.error('Usage:');
    console.error('  node zalo-oa-send.js <user_id> "<message>"');
    console.error('  node zalo-oa-send.js list-followers');
    process.exit(1);
  }

  if (cmd === 'list-followers') {
    await listFollowers();
    return;
  }

  const message = process.argv[3];
  if (!message) {
    console.error('Missing message argument');
    process.exit(1);
  }

  await sendMessage(cmd, message);
}

main().catch(e => {
  console.error(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
