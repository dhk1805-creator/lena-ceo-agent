#!/usr/bin/env node
// Task Tracker — Le Na CEO Agent
// Quan ly task/cong viec duoc giao qua Google Sheet "Task Tracker"
//
// Usage:
//   node task-tracker.js add "<task>" "<assignee_email>" "<deadline_YYYY-MM-DD>" "[source]"
//   node task-tracker.js overdue           — List task qua han
//   node task-tracker.js status            — Tong hop trang thai tat ca task
//   node task-tracker.js update "<task_row>" "<new_status>"
//
// Sheet "Task Tracker" columns:
//   A: Created | B: Task | C: Assignee | D: Deadline | E: Status | F: Source | G: Follow-up | H: Notes

const cmd = process.argv[2];
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!cmd) {
  console.error('Usage: node task-tracker.js <add|overdue|status|update> [args...]');
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

async function sheetsGet(token, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function sheetsAppend(token, range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  return res.json();
}

async function sheetsUpdate(token, range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values })
  });
  return res.json();
}

async function addTask() {
  const task = process.argv[3];
  const assignee = process.argv[4];
  const deadline = process.argv[5];
  const source = process.argv[6] || '';
  if (!task || !assignee || !deadline) {
    console.error('Usage: node task-tracker.js add "<task>" "<assignee>" "<deadline>" "[source]"');
    process.exit(1);
  }
  const token = await getAccessToken();
  const today = new Date().toISOString().split('T')[0];
  const followUp = deadline;
  const row = [[today, task, assignee, deadline, 'Moi', source, followUp, '']];
  const result = await sheetsAppend(token, 'Task Tracker!A:H', row);
  console.log(JSON.stringify({
    success: true, action: 'add',
    task, assignee, deadline,
    sheetResult: result.updates ? { updatedRows: result.updates.updatedRows } : result
  }));
}

async function listOverdue() {
  const token = await getAccessToken();
  const data = await sheetsGet(token, 'Task Tracker!A:H');
  if (!data.values || data.values.length <= 1) {
    console.log(JSON.stringify({ success: true, overdue: [], message: 'Khong co task nao.' }));
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const rows = data.values.slice(1);
  const overdue = [];

  rows.forEach((row, i) => {
    const deadline = row[3] || '';
    const status = (row[4] || '').toLowerCase();
    if (deadline && deadline < today && !['done', 'xong', 'huy', 'cancelled'].includes(status)) {
      overdue.push({
        row: i + 2,
        task: row[1], assignee: row[2], deadline: row[3],
        status: row[4], source: row[5],
        daysOverdue: Math.floor((new Date(today) - new Date(deadline)) / 86400000)
      });
    }
  });

  console.log(JSON.stringify({
    success: true,
    totalTasks: rows.length,
    overdueCount: overdue.length,
    overdue: overdue.sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, null, 2));
}

async function statusSummary() {
  const token = await getAccessToken();
  const data = await sheetsGet(token, 'Task Tracker!A:H');
  if (!data.values || data.values.length <= 1) {
    console.log(JSON.stringify({ success: true, summary: 'Khong co task.', total: 0 }));
    return;
  }

  const rows = data.values.slice(1);
  const today = new Date().toISOString().split('T')[0];
  const byStatus = {};
  const byAssignee = {};
  let overdueCount = 0;

  for (const row of rows) {
    const status = row[4] || 'Unknown';
    const assignee = row[2] || 'Unknown';
    const deadline = row[3] || '';
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (!byAssignee[assignee]) byAssignee[assignee] = { total: 0, done: 0, overdue: 0 };
    byAssignee[assignee].total++;
    if (['Done', 'Xong', 'done', 'xong'].includes(status)) byAssignee[assignee].done++;
    if (deadline && deadline < today && !['done', 'xong', 'huy', 'cancelled'].includes(status.toLowerCase())) {
      overdueCount++;
      byAssignee[assignee].overdue++;
    }
  }

  console.log(JSON.stringify({
    success: true,
    total: rows.length, overdueCount,
    byStatus, byAssignee
  }, null, 2));
}

async function updateTask() {
  const rowNum = parseInt(process.argv[3]);
  const newStatus = process.argv[4];
  if (!rowNum || !newStatus) {
    console.error('Usage: node task-tracker.js update <row_number> "<new_status>"');
    process.exit(1);
  }
  const token = await getAccessToken();
  const result = await sheetsUpdate(token, `Task Tracker!E${rowNum}`, [[newStatus]]);
  console.log(JSON.stringify({ success: true, action: 'update', row: rowNum, newStatus, result }));
}

async function main() {
  switch (cmd) {
    case 'add': await addTask(); break;
    case 'overdue': await listOverdue(); break;
    case 'status': await statusSummary(); break;
    case 'update': await updateTask(); break;
    default:
      console.error(`Unknown command: ${cmd}. Use: add, overdue, status, update`);
      process.exit(1);
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
