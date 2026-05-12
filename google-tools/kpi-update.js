#!/usr/bin/env node
require('./_env');
// KPI Tracker Auto-Update — aggregate data from multiple sheets
// Runs weekly (sau weekly-report-scan T7) hoac khi VIP yeu cau
// Usage: node kpi-update.js
//
// Doc tu: Report Tracker, Weekly Performance, NPP Orders, KHKD Baseline, Task Tracker
// Ghi vao: KPI Tracker (append 1 dong moi tuan)

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
if (!SHEET_ID) { console.log(JSON.stringify({ error: 'GOOGLE_SHEET_ID not set' })); process.exit(1); }

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

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

async function readSheet(token, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.values || [];
}

async function appendSheet(token, range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  return await res.json();
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - start) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

async function main() {
  const token = await getAccessToken();
  const now = new Date();
  const weekNum = getWeekNumber(now);
  const monthStr = `${now.getMonth() + 1}/${now.getFullYear()}`;
  const dateStr = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // 1. Read Weekly Performance (last row = this week)
  const weeklyPerf = await readSheet(token, "'Weekly Performance'!A:E");
  const lastWeek = weeklyPerf.length > 1 ? weeklyPerf[weeklyPerf.length - 1] : [];
  const bpNop = lastWeek[2] || '0';
  const bpChuaNop = lastWeek[3] || '0';
  const diemNhan = lastWeek[4] || '';

  // 2. Read NPP Orders (count this month)
  const nppOrders = await readSheet(token, "'NPP Orders'!A:H");
  let nppCount = 0;
  let nppValue = 0;
  const currentMonth = now.getMonth() + 1;
  for (let i = 1; i < nppOrders.length; i++) {
    const row = nppOrders[i];
    if (!row[0]) continue;
    const orderDate = new Date(row[0]);
    if (orderDate.getMonth() + 1 === currentMonth && orderDate.getFullYear() === now.getFullYear()) {
      nppCount++;
    }
  }

  // 3. Read Task Tracker (overdue count)
  const tasks = await readSheet(token, "'Task Tracker'!A:H");
  let overdueCount = 0;
  let totalTasks = 0;
  let doneTasks = 0;
  for (let i = 1; i < tasks.length; i++) {
    const row = tasks[i];
    if (!row[1]) continue;
    totalTasks++;
    const status = (row[4] || '').toLowerCase();
    if (status.includes('done') || status.includes('xong') || status.includes('hoàn')) {
      doneTasks++;
    } else {
      const deadline = new Date(row[3]);
      if (deadline < now && !isNaN(deadline.getTime())) overdueCount++;
    }
  }
  const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // 4. Read Report Tracker (count this month reports)
  const reports = await readSheet(token, "'Report Tracker'!A:F");
  let reportsThisMonth = 0;
  for (let i = 1; i < reports.length; i++) {
    const row = reports[i];
    if (!row[0]) continue;
    const weekLabel = row[0].toString();
    if (weekLabel.includes(`Tuan ${weekNum}`) || weekLabel.includes(`Tuan ${weekNum - 1}`)) {
      reportsThisMonth++;
    }
  }

  // 5. Read KHKD Baseline (targets)
  const baseline = await readSheet(token, "'KHKD 2026 Baseline'!A1:Z5");
  let dtTarget = 'N/A';
  if (baseline.length > 1) {
    for (const row of baseline) {
      for (const cell of row) {
        if (cell && cell.toString().match(/^\d[\d,.]*(ty|tỷ)/i)) {
          dtTarget = cell;
          break;
        }
      }
      if (dtTarget !== 'N/A') break;
    }
  }

  // Build KPI row
  // Columns: A:Thang | B:Tuan | C:Ngay cap nhat | D:BP nop BC | E:BP chua nop |
  //          F:NPP don hang thang | G:Task hoan thanh % | H:Task qua han |
  //          I:Diem nhan tuan | J:Ghi chu
  const kpiRow = [
    monthStr,
    `Tuan ${weekNum}`,
    dateStr,
    bpNop,
    bpChuaNop,
    String(nppCount),
    `${taskCompletionRate}%`,
    String(overdueCount),
    diemNhan,
    `Auto-update by Le Na. ${reportsThisMonth} BC received.`
  ];

  // Append to KPI Tracker
  const result = await appendSheet(token, "'KPI Tracker'!A:J", [kpiRow]);

  if (result.updates) {
    console.log(JSON.stringify({
      success: true,
      week: `Tuan ${weekNum}`,
      month: monthStr,
      kpi: {
        bp_nop: bpNop,
        bp_chua_nop: bpChuaNop,
        npp_orders: nppCount,
        task_completion: `${taskCompletionRate}%`,
        task_overdue: overdueCount,
        reports_received: reportsThisMonth
      },
      sheet: result.updates.updatedRange
    }));
  } else {
    console.log(JSON.stringify({ success: false, error: result }));
  }
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
