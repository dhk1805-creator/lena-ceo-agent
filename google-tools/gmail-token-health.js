#!/usr/bin/env node
require('./_env');
// Gmail / Google OAuth Token Health Check — Le Na CEO Agent (Issue #103)
// Phat hien som GOOGLE_REFRESH_TOKEN het han / bi revoke (loi invalid_grant)
// TRUOC khi cac cron Gmail (triage chi Hong 17h, weekly scan...) fail im lang.
//
// Usage:
//   node gmail-token-health.js
//
// Behavior:
//   1. Doi GOOGLE_REFRESH_TOKEN -> access_token tai oauth2.googleapis.com/token
//   2. Neu OK: goi Gmail API /profile de xac nhan token con scope hop le
//   3. Neu FAIL (invalid_grant / khong co access_token):
//      - Track fail count, escalate URGENT tu lan fail thu 2 lien tiep
//      - Bao Sep qua ZALO OA (kenh KHONG phu thuoc token Gmail dang chet)
//      - Thu them email canh bao qua gmail-send.js (account lena@ dung
//        GOOGLE_REFRESH_TOKEN_LENA rieng — co the van song)
//   4. Return JSON status de cron parse
//
// LUU Y QUAN TRONG (khong fix duoc bang code):
//   Refresh token bi revoke/expired CHI sua duoc bang cach Sep chay lai OAuth
//   flow va paste GOOGLE_REFRESH_TOKEN moi vao Railway Variables.
//   Nguyen nhan thuong gap: OAuth consent screen o che do "Testing" (refresh
//   token het han sau 7 ngay), bi revoke thu cong, 6 thang khong dung, hoac
//   doi mat khau Google.

const fs = require('fs');
const { execFileSync } = require('child_process');

const FAIL_COUNT_FILE = '/root/.openclaw/gmail-token-fail-count.json';
const HEALTH_LOG = '/root/.openclaw/gmail-token-health.jsonl';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const ZALO_TARGET = 'sep-khanh';
const ALERT_EMAIL = 'dhk@nsca.vn';

function loadFailCount() {
  try { return JSON.parse(fs.readFileSync(FAIL_COUNT_FILE, 'utf-8')); } catch (e) { return { count: 0, last_fail_at: null }; }
}

function saveFailCount(state) {
  try { fs.writeFileSync(FAIL_COUNT_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

function logHealth(record) {
  try { fs.appendFileSync(HEALTH_LOG, JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n'); } catch (e) {}
}

// Bao Sep qua Zalo OA — kenh KHONG phu thuoc token Gmail.
function sendZaloAlert(message) {
  try {
    execFileSync('node', [__dirname + '/zalo-oa-send.js', ZALO_TARGET, message], { encoding: 'utf-8', timeout: 30000 });
    return true;
  } catch (e) {
    console.error('[gmail-health] Zalo alert fail:', e.message);
    return false;
  }
}

// Thu gui email canh bao — chi hoat dong neu GOOGLE_REFRESH_TOKEN_LENA (account
// lena@) con song. Neu ca hai account dung chung 1 token chet -> se fail, bo qua.
function sendEmailAlert(subject, body) {
  try {
    execFileSync('node', [__dirname + '/gmail-send.js', ALERT_EMAIL, subject, body, ''], { encoding: 'utf-8', timeout: 30000 });
    return true;
  } catch (e) {
    console.error('[gmail-health] Email alert fail:', e.message);
    return false;
  }
}

async function checkToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return { ok: false, reason: 'missing_env', detail: 'Thieu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN' };
  }

  let tokenRes;
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });
  } catch (e) {
    return { ok: false, reason: 'network', detail: e.message };
  }

  const data = await tokenRes.json();
  if (!data.access_token) {
    // Vd: { error: "invalid_grant", error_description: "Token has been expired or revoked." }
    return {
      ok: false,
      reason: data.error || 'no_access_token',
      detail: data.error_description || JSON.stringify(data),
      http: tokenRes.status
    };
  }

  // Token doi duoc -> xac nhan con scope hop le bang 1 call nhe
  try {
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    const profile = await profileRes.json();
    if (profile.emailAddress) {
      return { ok: true, email: profile.emailAddress, messages_total: profile.messagesTotal };
    }
    return { ok: false, reason: 'scope_invalid', detail: JSON.stringify(profile), http: profileRes.status };
  } catch (e) {
    return { ok: false, reason: 'profile_network', detail: e.message };
  }
}

async function main() {
  const result = await checkToken();
  const failState = loadFailCount();

  if (result.ok) {
    if (failState.count > 0) {
      saveFailCount({ count: 0, last_fail_at: null, recovered_at: new Date().toISOString() });
      sendZaloAlert(`✅ Gmail token (${result.email}) da phuc hoi sau ${failState.count} lan check fail. Cac cron email chay lai binh thuong.`);
    }
    logHealth({ status: 'ok', email: result.email, messages_total: result.messages_total, fail_count_reset: failState.count > 0 });
    console.log(JSON.stringify({ ok: true, email: result.email, fail_count_reset: failState.count > 0 }));
    return;
  }

  // FAIL path
  const newCount = (failState.count || 0) + 1;
  saveFailCount({
    count: newCount,
    last_fail_at: new Date().toISOString(),
    last_reason: result.reason,
    last_detail: result.detail
  });
  logHealth({ status: 'fail', reason: result.reason, detail: result.detail, http: result.http, fail_count: newCount });

  const urgent = newCount >= 2;
  const level = urgent ? '🚨 URGENT' : '⚠️ WARNING';
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const zaloMsg = `${level} GMAIL TOKEN LOI (lan ${newCount})\n` +
    `Loi: ${result.reason} — ${result.detail}\n` +
    `Anh huong: cron quet email (triage chi Hong 17h, weekly scan...) khong chay duoc.\n` +
    (result.reason === 'invalid_grant'
      ? `\n👉 CAN HANH DONG: Token Gmail (GOOGLE_REFRESH_TOKEN) da bi revoke/het han. Sep chay lai OAuth flow va paste token moi vao Railway Variables. Khong tu sua bang code duoc.\n`
      : '') +
    `Thoi gian: ${now}\nLe Na — Gmail Token Health Check`;

  const zaloSent = sendZaloAlert(zaloMsg);

  const emailSubject = `[Le Na ${level}] Gmail token loi (lan ${newCount})`;
  const emailBody = `Daily health check phat hien token Gmail co van de:\n\n` +
    `Reason: ${result.reason}\n` +
    `Detail: ${result.detail}\n` +
    `HTTP: ${result.http || 'n/a'}\n` +
    `Fail count lien tiep: ${newCount}\n\n` +
    `Anh huong: gmail-read.js + email_read tool fail -> cac cron quet email khong chay (triage TCKT chi Hong 17h, weekly email scan...).\n\n` +
    (result.reason === 'invalid_grant'
      ? `CAN HANH DONG NGAY:\n` +
        `1. Vao Google OAuth Playground / script tao token de lay GOOGLE_REFRESH_TOKEN moi cho account dhk@nsca.vn.\n` +
        `2. Paste vao Railway Variables (service lena-ceo-agent) -> GOOGLE_REFRESH_TOKEN.\n` +
        `3. Redeploy. Health check sang hom sau se tu xac nhan phuc hoi.\n` +
        `Luu y: neu OAuth consent screen dang o che do "Testing", refresh token het han sau 7 ngay -> nen publish app de tranh lap lai.\n\n`
      : '') +
    `Email nay gui qua account lena@ (GOOGLE_REFRESH_TOKEN_LENA) — neu Sep nhan duoc tuc la token gui van song, chi token doc (dhk@) bi loi.\n\n` +
    `Le Na — Gmail Token Health Check\nThoi gian: ${now}`;

  const emailSent = sendEmailAlert(emailSubject, emailBody);

  console.log(JSON.stringify({
    ok: false,
    reason: result.reason,
    detail: result.detail,
    fail_count: newCount,
    urgent,
    zalo_sent: zaloSent,
    email_sent: emailSent
  }));
}

main().catch(e => {
  console.log(JSON.stringify({ ok: false, exception: e.message }));
  process.exit(1);
});
