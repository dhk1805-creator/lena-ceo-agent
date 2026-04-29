#!/usr/bin/env node
// Google Calendar Create Event — Le Na CEO Agent
// Usage: node calendar-create.js <summary> <start_datetime> <end_datetime> [description] [location]
//
// Datetime format: ISO 8601 — "2026-04-15T09:00:00+07:00"
// Hoac chi ngay (all-day event): "2026-04-15"
//
// Examples:
//   node calendar-create.js "Hop voi anh Duan" "2026-04-15T14:00:00+07:00" "2026-04-15T15:00:00+07:00" "Ban ve TCKT Q1"
//   node calendar-create.js "Hop NPP NTK" "2026-04-16T09:00:00+07:00" "2026-04-16T10:30:00+07:00" "Review doanh thu" "Van phong NTK HN"

const summary = process.argv[2];
const startTime = process.argv[3];
const endTime = process.argv[4];
const description = process.argv[5] || '';
const location = process.argv[6] || '';

if (!summary || !startTime || !endTime) {
  console.error('Usage: node calendar-create.js <summary> <start> <end> [description] [location]');
  console.error('  start/end: ISO 8601 (e.g. "2026-04-15T14:00:00+07:00" or "2026-04-15")');
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
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function main() {
  const token = await getAccessToken();

  // Detect all-day vs timed event
  const isAllDay = startTime.length <= 10; // "2026-04-15" = 10 chars

  const event = {
    summary,
    description: description + '\n\n[Tao boi Le Na - AI Executive Assistant]',
    location,
    start: isAllDay ? { date: startTime } : { dateTime: startTime, timeZone: 'Asia/Ho_Chi_Minh' },
    end: isAllDay ? { date: endTime } : { dateTime: endTime, timeZone: 'Asia/Ho_Chi_Minh' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },   // Email 60 phut truoc
        { method: 'popup', minutes: 60 },   // Popup 60 phut truoc
        { method: 'popup', minutes: 10 }    // Popup 10 phut truoc (chot)
      ]
    }
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  const result = await res.json();

  if (result.id) {
    console.log(JSON.stringify({
      success: true,
      eventId: result.id,
      summary: result.summary,
      start: result.start?.dateTime || result.start?.date,
      end: result.end?.dateTime || result.end?.date,
      htmlLink: result.htmlLink,
      status: result.status
    }, null, 2));
  } else {
    console.log(JSON.stringify({ success: false, error: result.error || result }, null, 2));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
