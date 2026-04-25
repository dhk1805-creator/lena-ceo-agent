#!/usr/bin/env node
// Import cron jobs via OpenClaw CLI — XOA HET CRON CU TRUOC, roi import cai moi
const { spawnSync } = require('child_process');
const fs = require('fs');
const CRON_FILE = process.argv[2] || '/app/cron-jobs.json';
const TZ = 'Asia/Ho_Chi_Minh';

function run(args, timeout = 30000) {
  return spawnSync('openclaw', args, { encoding: 'utf8', timeout });
}

function main() {
  // STEP 1: List all existing cron jobs
  console.log('=== Listing existing cron jobs ===');
  const list1 = run(['cron', 'list']);
  const listOutput = list1.stdout || '';
  console.log(listOutput);

  // STEP 2: Delete ALL existing cron jobs
  // Parse job IDs/names from list output (format varies, try common patterns)
  const lines = listOutput.split('\n');
  const jobIds = [];
  for (const line of lines) {
    // Match typical cron id/name patterns (alphanumeric-with-dashes)
    const m = line.match(/^([a-z0-9][a-z0-9\-_]{2,50})\s/i);
    if (m && !['id', 'name', 'no', 'total', 'running', 'status'].includes(m[1].toLowerCase())) {
      jobIds.push(m[1]);
    }
  }

  if (jobIds.length > 0) {
    console.log(`\n=== Deleting ${jobIds.length} old cron jobs ===`);
    for (const id of jobIds) {
      const del = run(['cron', 'rm', id]);
      if (del.status === 0) {
        console.log(`[DEL OK] ${id}`);
      } else {
        console.log(`[DEL SKIP] ${id}: ${(del.stderr || '').substring(0, 100)}`);
      }
    }
  } else {
    console.log('\n=== No old cron jobs to delete ===');
  }

  // STEP 3: Import new cron jobs
  console.log('\n=== Importing new cron jobs ===');
  const jobs = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
  console.log(`Found ${jobs.length} cron jobs in ${CRON_FILE}`);

  let ok = 0, fail = 0;
  for (const job of jobs) {
    const args = [
      'cron', 'add',
      '--name', job.name || job.id,
      '--cron', job.schedule.expr,
      '--message', job.payload.message,
      '--tz', TZ
    ];

    const result = run(args);

    if (result.status === 0) {
      console.log(`[ADD OK] ${job.id}`);
      ok++;
    } else {
      console.error(`[ADD FAIL] ${job.id}: ${(result.stderr || result.stdout || '').substring(0, 200)}`);
      fail++;
    }
  }

  console.log(`\nImport done: ${ok} OK, ${fail} failed`);

  // STEP 4: Final list
  const list2 = run(['cron', 'list']);
  console.log(`\n=== Cron jobs after import ===\n${list2.stdout || list2.stderr || '(empty)'}`);
}

main();
