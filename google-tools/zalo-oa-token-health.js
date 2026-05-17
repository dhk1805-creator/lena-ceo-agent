#!/usr/bin/env node
require('./_env');
// Zalo OA Token Health Check — verify token still valid bằng cách gọi /v2.0/oa/getoa
// Usage:
//   node zalo-oa-token-health.js [--alert-email <recipient>]
//
// Behavior:
//   1. Get current access_token (file > env)
//   2. Call /v2.0/oa/getoa → expect error=0
//   3. Nếu fail → gửi email alert tới Sếp (default dhk@nsca.vn)
//   4. Track fail count → escalate nếu fail >= 2 lần liên tiếp
//   5. Return JSON status để cron có thể parse

const fs = require('fs');
const { execFileSync } = require('child_process');

const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';
const FAIL_COUNT_FILE = '/root/.openclaw/zalo-token-fail-count.json';
const HEALTH_LOG = '/root/.openclaw/zalo-token-health.jsonl';

const alertEmailIdx = process.argv.indexOf('--alert-email');
const ALERT_EMAIL = alertEmailIdx > -1 ? process.argv[alertEmailIdx + 1] : 'dhk@nsca.vn';

function getOAToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.access_token) return { token: data.access_token, source: 'file', meta: data };
    }
  } catch (e) {}
  const env = process.env.ZALO_OA_ACCESS_TOKEN;
  if (env) return { token: env, source: 'env' };
  return null;
}

function loadFailCount() {
  try { return JSON.parse(fs.readFileSync(FAIL_COUNT_FILE, 'utf-8')); } catch (e) { return { count: 0, last_fail_at: null }; }
}

function saveFailCount(state) {
  try { fs.writeFileSync(FAIL_COUNT_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

function logHealth(record) {
  try { fs.appendFileSync(HEALTH_LOG, JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n'); } catch (e) {}
}

async function sendAlertEmail(subject, body) {
  try {
    execFileSync('node', [
      __dirname + '/gmail-send.js',
      ALERT_EMAIL,
      subject,
      body,
      ''  // no CC
    ], { encoding: 'utf-8', timeout: 30000 });
    return true;
  } catch (e) {
    console.error('[health] Alert email fail:', e.message);
    return false;
  }
}

async function main() {
  const t = getOAToken();
  if (!t) {
    const msg = '⚠️ ZALO OA TOKEN MISSING — không có access_token trong file hoặc env vars.';
    console.log(JSON.stringify({ ok: false, reason: 'no_token', alert_sent: false }));
    await sendAlertEmail('[Lê Na ALERT] Zalo OA token MISSING', msg + '\n\nVui lòng paste lại token tại Railway Variables.\n\nLê Na — Health Check');
    logHealth({ status: 'no_token' });
    return;
  }

  let healthOk = false;
  let httpStatus = null;
  let zaloError = null;
  let zaloMessage = null;
  let oaName = null;
  let numFollower = null;

  try {
    const res = await fetch('https://openapi.zalo.me/v2.0/oa/getoa', {
      headers: { 'access_token': t.token }
    });
    httpStatus = res.status;
    const data = await res.json();
    zaloError = data.error;
    zaloMessage = data.message;
    if (data.error === 0 && data.data) {
      healthOk = true;
      oaName = data.data.name;
      numFollower = data.data.num_follower;
    }
  } catch (e) {
    zaloMessage = e.message;
  }

  const failState = loadFailCount();

  if (healthOk) {
    // RESET fail counter
    if (failState.count > 0) {
      saveFailCount({ count: 0, last_fail_at: null, recovered_at: new Date().toISOString() });
      // Send "recovered" email if previously failing
      await sendAlertEmail(
        '[Lê Na OK] Zalo OA token đã phục hồi',
        `Token đã hoạt động trở lại sau ${failState.count} lần check fail.\n\nOA: ${oaName}\nFollowers: ${numFollower}\nToken source: ${t.source}\nThời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\nLê Na — Health Check`
      );
    }
    logHealth({ status: 'ok', oa_name: oaName, num_follower: numFollower, token_source: t.source });
    console.log(JSON.stringify({
      ok: true,
      oa_name: oaName,
      num_follower: numFollower,
      token_source: t.source,
      token_prefix: t.token.substring(0, 10),
      fail_count_reset: failState.count > 0
    }));
    return;
  }

  // FAIL path
  const newCount = (failState.count || 0) + 1;
  saveFailCount({
    count: newCount,
    last_fail_at: new Date().toISOString(),
    last_error_code: zaloError,
    last_error_message: zaloMessage
  });

  logHealth({
    status: 'fail',
    http: httpStatus,
    error: zaloError,
    message: zaloMessage,
    fail_count: newCount
  });

  // Alert email — 1st fail: light warning, 2nd+ fail: urgent
  const urgentLevel = newCount >= 2 ? '🚨 URGENT' : '⚠️ WARNING';
  const subject = `[Lê Na ${urgentLevel}] Zalo OA token check FAIL (lần ${newCount})`;
  const body = `Daily health check phát hiện token Zalo OA có vấn đề:

Endpoint: GET /v2.0/oa/getoa
HTTP status: ${httpStatus}
Zalo error code: ${zaloError}
Error message: ${zaloMessage}

Token source: ${t.source}
Token prefix: ${t.token.substring(0, 10)}...

Fail count liên tiếp: ${newCount}
${newCount >= 2 ? '\n🚨 CẦN HÀNH ĐỘNG NGAY: Đây là lần fail liên tiếp thứ ' + newCount + '. Lê Na không gửi tin ra ngoài được.\nSếp paste lại token mới từ developers.zalo.me/tools/explorer → Railway Variables.\n' : ''}
Cron tiếp theo chạy 12h trưa mai. Nếu vẫn fail → email tiếp.

Lê Na — Daily Health Check
Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;

  const alertSent = await sendAlertEmail(subject, body);

  console.log(JSON.stringify({
    ok: false,
    http: httpStatus,
    zalo_error: zaloError,
    zalo_message: zaloMessage,
    fail_count: newCount,
    alert_sent: alertSent,
    urgent: newCount >= 2
  }));
}

main().catch(e => {
  console.log(JSON.stringify({ ok: false, exception: e.message }));
  process.exit(1);
});
