#!/usr/bin/env node
// Import cron jobs via OpenClaw CLI — XOA HET CRON CU TRUOC, roi import cai moi
const { spawnSync } = require('child_process');
const fs = require('fs');
const CRON_FILE = process.argv[2] || '/app/cron-jobs.json';
const TZ = 'Asia/Ho_Chi_Minh';

function run(args, timeout = 30000) {
  return spawnSync('openclaw', args, { encoding: 'utf8', timeout });
}

function extractJobIds(output) {
  const ids = new Set();

  // Try JSON parse first
  try {
    const data = JSON.parse(output);
    const arr = Array.isArray(data) ? data : (data.jobs || data.crons || data.data || []);
    for (const j of arr) {
      if (j.id) ids.add(j.id);
    }
    if (ids.size > 0) {
      console.log(`[parse] JSON: found ${ids.size} jobs`);
      return [...ids];
    }
  } catch (e) {}

  // Text parsing — multiple patterns
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^[-─═┌┐└┘│┤├┬┴┼]+$/.test(trimmed)) continue;

    // Skip header lines
    const lower = trimmed.toLowerCase();
    if (/^(id|name|no|total|running|status|schedule|cron|next)\b/.test(lower)) continue;

    // Pattern: UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuid = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (uuid) { ids.add(uuid[1]); continue; }

    // Pattern: slug ID at start of line (e.g. "weekly-email-scan ...")
    const slug = trimmed.match(/^([a-z0-9][a-z0-9\-_]{2,80})\s/i);
    if (slug) { ids.add(slug[1]); continue; }

    // Pattern: "id: xxx" or "- id: xxx"
    const kv = trimmed.match(/^-?\s*id:\s*(.+)/i);
    if (kv) ids.add(kv[1].trim());
  }

  if (ids.size > 0) console.log(`[parse] Text: found ${ids.size} jobs`);
  return [...ids];
}

function main() {
  // STEP 1: List existing cron jobs — try JSON first, fall back to text
  console.log('=== Listing existing cron jobs ===');
  let listOutput = '';

  const listJson = run(['cron', 'list', '--json']);
  if (listJson.status === 0 && (listJson.stdout || '').trim()) {
    listOutput = listJson.stdout;
    console.log('[list] JSON output OK');
  } else {
    const listText = run(['cron', 'list']);
    listOutput = listText.stdout || '';
    console.log('[list] Text output');
  }
  console.log(listOutput.substring(0, 2000));

  // STEP 2: Delete ALL existing cron jobs
  const jobIds = extractJobIds(listOutput);

  if (jobIds.length > 0) {
    console.log(`\n=== Deleting ${jobIds.length} old cron jobs ===`);
    for (const id of jobIds) {
      const del = run(['cron', 'rm', id]);
      console.log(del.status === 0 ? `[DEL OK] ${id}` : `[DEL SKIP] ${id}: ${(del.stderr || '').substring(0, 100)}`);
    }

    // Verify deletion — if any remain, retry with different ID format
    const recheck = run(['cron', 'list']);
    const remaining = extractJobIds(recheck.stdout || '');
    if (remaining.length > 0) {
      console.log(`\n=== ${remaining.length} crons still remain, retrying delete ===`);
      for (const id of remaining) {
        run(['cron', 'rm', id]);
        console.log(`[DEL RETRY] ${id}`);
      }
    }
  } else {
    console.log('\n=== No old cron jobs detected ===');
    console.log('Raw output for debug:', JSON.stringify(listOutput.substring(0, 500)));
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

  console.log(`\nImport done: ${ok} OK, ${fail} failed (expected: ${jobs.length})`);

  // STEP 4: Final verification
  const list2 = run(['cron', 'list']);
  const finalCount = extractJobIds(list2.stdout || '').length;
  console.log(`\n=== Final: ${finalCount} cron jobs active (expected: ${jobs.length}) ===`);
  if (finalCount > jobs.length) {
    console.error(`WARNING: ${finalCount - jobs.length} extra crons detected! Deletion may have failed.`);
  }
  console.log(list2.stdout || list2.stderr || '(empty)');
}

main();
