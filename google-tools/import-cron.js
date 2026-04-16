#!/usr/bin/env node
// Import cron jobs via OpenClaw CLI (openclaw cron add)
const { spawnSync } = require('child_process');
const fs = require('fs');
const CRON_FILE = process.argv[2] || '/app/cron-jobs.json';
const TZ = 'Asia/Ho_Chi_Minh';

function main() {
  const jobs = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
  console.log(`Found ${jobs.length} cron jobs to import via CLI`);

  // First, list existing jobs to avoid duplicates
  const existing = spawnSync('openclaw', ['cron', 'list'], { encoding: 'utf8', timeout: 15000 });
  console.log('Existing cron jobs:', existing.stdout || '(none)');

  let ok = 0, fail = 0;
  for (const job of jobs) {
    try {
      const args = [
        'cron', 'add',
        '--name', job.name || job.id,
        '--cron', job.schedule.expr,
        '--message', job.payload.message,
        '--tz', TZ
      ];

      const result = spawnSync('openclaw', args, {
        encoding: 'utf8',
        timeout: 30000
      });

      if (result.status === 0) {
        console.log(`[OK] ${job.id}`);
        ok++;
      } else {
        console.error(`[FAIL] ${job.id}: ${(result.stderr || result.stdout || '').substring(0, 200)}`);
        fail++;
      }
    } catch (e) {
      console.error(`[ERROR] ${job.id}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nImport done: ${ok} OK, ${fail} failed`);

  // List all cron jobs after import
  const list = spawnSync('openclaw', ['cron', 'list'], { encoding: 'utf8', timeout: 15000 });
  console.log(`\nCron jobs after import:\n${list.stdout || list.stderr || '(empty)'}`);
}

main();
