#!/usr/bin/env node
// Google Calendar Read — Le Na CEO Agent
// Usage: node calendar-read.js [days=2]
// Returns events for today and next N days

const days = parseInt(process.argv[2] || '2');

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

  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 3600 * 1000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50'
  });

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  if (data.items) {
    const events = data.items.map(e => ({
      summary: e.summary || '(Khong co tieu de)',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      location: e.location || '',
      attendees: (e.attendees || []).map(a => a.email).join(', '),
      status: e.status
    }));

    console.log(JSON.stringify({
      count: events.length,
      period: `${days} ngay toi`,
      events
    }, null, 2));
  } else {
    console.log(JSON.stringify({ count: 0, events: [], note: data.error || 'Khong co su kien' }));
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
