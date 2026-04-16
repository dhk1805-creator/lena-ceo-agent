#!/usr/bin/env node
// Import cron jobs via Gateway WebSocket API
const fs = require('fs');
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.GATEWAY_PASSWORD;
const PORT = process.env.OPENCLAW_GATEWAY_PORT || process.env.PORT || '8080';
const CRON_FILE = process.argv[2] || '/app/cron-jobs.json';
if (!TOKEN) { console.error('No gateway token found'); process.exit(1); }

async function main() {
  const jobs = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
  console.log(`Found ${jobs.length} cron jobs to import`);

  for (const job of jobs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/cron`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(job)
      });
      const text = await res.text();
      console.log(`[${res.status}] ${job.id}: ${text.substring(0, 100)}`);
    } catch (e) {
      console.error(`FAIL ${job.id}: ${e.message}`);
    }
  }

  // List all cron jobs
  try {
    const res = await fetch(`http://localhost:${PORT}/api/cron`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.text();
    console.log(`\nCron jobs after import:\n${data}`);
  } catch (e) {
    console.log('Could not list cron jobs:', e.message);
  }
}

main().catch(e => console.error(e));
