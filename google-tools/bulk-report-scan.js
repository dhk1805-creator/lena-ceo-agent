#!/usr/bin/env node
require('./_env');
// Bulk Report Scan — quet hang loat bao cao tu 14 BP truong qua nhieu tuan ISO.
// Voi MOI email co attachment trong khoang tuan -> download tat ca file -> upload
// vao Lena_Reports/<year>-W<XX>/. Khong dung filter "subject:bao cao" — chi loc
// theo "has:attachment" de KHONG bo sot email nao co file dinh kem.
//
// Usage:
//   node bulk-report-scan.js                      — tuan hien tai
//   node bulk-report-scan.js 18                   — tuan 18
//   node bulk-report-scan.js 15 20                — tuan 15 -> 20
//   node bulk-report-scan.js 15 20 2026           — tuan 15 -> 20 nam 2026
//   node bulk-report-scan.js 18 18 2026 dryrun    — chi scan, KHONG upload
//
// Tra ve JSON: { weeks: [{week, folder, totals, departments[]}], grand_total }

const REPORTS_ROOT = '11G7dpJX552jZFt37ou_m5ocz2sRZ2p5p';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const DEPARTMENTS = [
  { code: 'R&D',        email: 'namph@nsca.vn'   },
  { code: 'HCNS',       email: 'sondt@nsca.vn'   },
  { code: 'PKD',        email: 'ndao@nsca.vn'    },
  { code: 'BD-NoiDia',  email: 'ducdd@nsca.vn'   },
  { code: 'BD-Intl',    email: 'santiago@nsca.vn'},
  { code: 'BackOffice', email: 'tamntt@nsca.vn'  },
  { code: 'TCKT',       email: 'duannt@nsca.vn'  },
  { code: 'GD-NhaMay',  email: 'ngocnv@nsca.vn'  },
  { code: 'SX-Thep',    email: 'tunghm@nsca.vn'  },
  { code: 'CoDien',     email: 'phongdv@nsca.vn' },
  { code: 'QAQC',       email: 'tuannl@nsca.vn'  },
  { code: 'Kho',        email: 'hant@nsca.vn'    },
  { code: 'GiaoHang',   email: 'ducvt@nsca.vn'   },
  { code: 'CungUng',    email: 'anhdtk@nsca.vn'  }
];

const MAX_EMAILS_PER_DEPT = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

function isoWeekRange(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const start = new Date(week1Monday);
  start.setUTCDate(start.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

async function gmailGET(p, token) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

async function listMessages(query, token, maxTotal) {
  const results = [];
  let pageToken = '';
  while (results.length < maxTotal) {
    const remain = Math.min(100, maxTotal - results.length);
    const qs = new URLSearchParams({ q: query, maxResults: String(remain) });
    if (pageToken) qs.set('pageToken', pageToken);
    const data = await gmailGET('messages?' + qs.toString(), token);
    if (data.error) throw new Error(`gmail list: ${JSON.stringify(data.error)}`);
    if (data.messages && data.messages.length) results.push(...data.messages);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return results.slice(0, maxTotal);
}

function findAttachments(payload, out) {
  if (!payload) return out;
  if (payload.filename && payload.filename.length > 0 && payload.body && payload.body.attachmentId) {
    out.push({
      filename: payload.filename,
      mimeType: payload.mimeType || 'application/octet-stream',
      size: payload.body.size || 0,
      attachmentId: payload.body.attachmentId
    });
  }
  if (payload.parts) for (const p of payload.parts) findAttachments(p, out);
  return out;
}

async function downloadAttachment(messageId, attachmentId, token) {
  const data = await gmailGET(`messages/${messageId}/attachments/${attachmentId}`, token);
  if (data.error || !data.data) return null;
  return Buffer.from(data.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function driveGET(p, token) {
  const url = p.startsWith('http') ? p : 'https://www.googleapis.com/drive/v3/' + p;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  return res.json();
}

async function ensureFolder(name, token) {
  const safe = name.replace(/'/g, "\\'");
  const q = `'${REPORTS_ROOT}' in parents and name = '${safe}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const s = await driveGET('files?' + new URLSearchParams({ q, fields: 'files(id,name)' }), token);
  if (s.files && s.files.length > 0) return { id: s.files[0].id, existed: true };
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [REPORTS_ROOT] })
  });
  const f = await res.json();
  if (!f.id) throw new Error('Cannot create folder: ' + JSON.stringify(f));
  return { id: f.id, existed: false };
}

async function uploadFile(buffer, fileName, folderId, mimeType, token) {
  const boundary = '---lena-bulk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + metadata + '\r\n--' + boundary + '\r\nContent-Type: ' + (mimeType || 'application/octet-stream') + '\r\n\r\n'),
    buffer,
    Buffer.from('\r\n--' + boundary + '--')
  ]);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body
  });
  return res.json();
}

function sanitizeFilename(name) {
  return (name || 'file').replace(/[\\/:*?"<>|\r\n]/g, '_').substring(0, 180);
}

async function scanOneWeek(year, week, token, dryRun, log) {
  const { start, end } = isoWeekRange(year, week);
  const weekStr = 'W' + String(week).padStart(2, '0');
  const folderName = `${year}-${weekStr}`;
  const afterTs = Math.floor(start.getTime() / 1000);
  const beforeTs = Math.floor(end.getTime() / 1000);

  let folder = { id: null, existed: false };
  if (!dryRun) {
    folder = await ensureFolder(folderName, token);
  }

  const result = {
    week: weekStr,
    year,
    folder: folderName,
    folderId: folder.id,
    folderCreated: !folder.existed,
    folderUrl: folder.id ? `https://drive.google.com/drive/folders/${folder.id}` : null,
    range: `${start.toISOString().substring(0, 10)} -> ${end.toISOString().substring(0, 10)}`,
    departments: [],
    totals: { emails: 0, attachments: 0, uploaded: 0, skipped: 0, errors: 0 }
  };

  for (const dept of DEPARTMENTS) {
    const query = `from:${dept.email} has:attachment after:${afterTs} before:${beforeTs}`;
    const deptResult = { code: dept.code, email: dept.email, emails: 0, attachments: 0, uploaded: 0, files: [] };
    try {
      const msgs = await listMessages(query, token, MAX_EMAILS_PER_DEPT);
      log(`[${weekStr}] ${dept.code} (${dept.email}): ${msgs.length} emails`);
      for (const m of msgs) {
        const detail = await gmailGET(`messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`, token);
        if (detail.error) {
          deptResult.files.push({ messageId: m.id, error: JSON.stringify(detail.error) });
          result.totals.errors++;
          continue;
        }
        // Need full payload to walk attachments (metadata doesn't include parts)
        const full = await gmailGET(`messages/${m.id}?format=full`, token);
        const headers = full.payload?.headers || [];
        const subject = (headers.find(h => h.name.toLowerCase() === 'subject')?.value || '').trim();
        const dateRaw = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
        const dateStr = dateRaw ? new Date(dateRaw).toISOString().substring(0, 10) : '';
        const atts = findAttachments(full.payload, []);
        deptResult.emails++;
        result.totals.emails++;
        for (const att of atts) {
          deptResult.attachments++;
          result.totals.attachments++;
          if (att.size > MAX_FILE_BYTES) {
            deptResult.files.push({ filename: att.filename, size: att.size, skipped: 'file > 25MB' });
            result.totals.skipped++;
            continue;
          }
          if (dryRun) {
            deptResult.files.push({ filename: att.filename, size: att.size, subject: subject.substring(0, 80), date: dateStr, dryrun: true });
            continue;
          }
          try {
            const buf = await downloadAttachment(m.id, att.attachmentId, token);
            if (!buf) {
              deptResult.files.push({ filename: att.filename, error: 'no data' });
              result.totals.errors++;
              continue;
            }
            const newName = sanitizeFilename(`${dept.code}_${dateStr}_${att.filename}`);
            const up = await uploadFile(buf, newName, folder.id, att.mimeType, token);
            if (up.id) {
              deptResult.uploaded++;
              result.totals.uploaded++;
              deptResult.files.push({ filename: newName, url: up.webViewLink, size: buf.length });
            } else {
              deptResult.files.push({ filename: newName, error: JSON.stringify(up).substring(0, 200) });
              result.totals.errors++;
            }
          } catch (e) {
            deptResult.files.push({ filename: att.filename, error: e.message });
            result.totals.errors++;
          }
        }
      }
    } catch (e) {
      deptResult.error = e.message;
      result.totals.errors++;
      log(`[${weekStr}] ${dept.code} ERROR: ${e.message}`);
    }
    result.departments.push(deptResult);
  }
  return result;
}

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  const dryRun = argv.includes('dryrun') || argv.includes('--dryrun');
  const nums = argv.filter(a => /^\d+$/.test(a)).map(Number);

  const today = new Date();
  const cur = isoWeekOf(today);
  const startWeek = nums[0] || cur.week;
  const endWeek = nums[1] || startWeek;
  const year = nums[2] || cur.year;

  if (startWeek < 1 || startWeek > 53 || endWeek < startWeek || endWeek > 53) {
    console.log(JSON.stringify({ success: false, error: `Invalid week range: ${startWeek}-${endWeek}` }));
    return;
  }

  const logs = [];
  const log = (s) => { logs.push(s); console.error(s); };

  const token = await getAccessToken();
  log(`Bulk scan: ${year} W${startWeek}-W${endWeek}, ${DEPARTMENTS.length} BP, dryRun=${dryRun}`);

  const weeks = [];
  for (let w = startWeek; w <= endWeek; w++) {
    const r = await scanOneWeek(year, w, token, dryRun, log);
    weeks.push(r);
  }

  const grand = weeks.reduce((acc, w) => {
    acc.emails += w.totals.emails;
    acc.attachments += w.totals.attachments;
    acc.uploaded += w.totals.uploaded;
    acc.skipped += w.totals.skipped;
    acc.errors += w.totals.errors;
    return acc;
  }, { emails: 0, attachments: 0, uploaded: 0, skipped: 0, errors: 0 });

  console.log(JSON.stringify({
    success: true,
    year,
    weekRange: `W${startWeek}-W${endWeek}`,
    dryRun,
    departmentsScanned: DEPARTMENTS.length,
    grand_total: grand,
    weeks
  }, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ success: false, error: e.message, stack: e.stack }));
  process.exit(1);
});
