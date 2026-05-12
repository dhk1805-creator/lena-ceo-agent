#!/usr/bin/env node
// Import cron jobs via OpenClaw CLI — XOA HET CRON CU TRUOC, roi import cai moi
const { spawnSync } = require('child_process');
const fs = require('fs');
const CRON_FILE = process.argv[2] || '/app/cron-jobs.json';
const TZ = 'Asia/Ho_Chi_Minh';

function run(args, timeout = 30000) {
  const r = spawnSync('openclaw', args, { encoding: 'utf8', timeout });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\].*?\x07/g, '');
}

function extractJobIds(rawOutput) {
  const output = stripAnsi(rawOutput);
  const ids = new Set();

  // Try JSON parse
  try {
    const data = JSON.parse(output);
    const arr = Array.isArray(data) ? data : (data.jobs || data.crons || data.data || data.items || []);
    for (const j of arr) {
      if (j.id) ids.add(String(j.id));
    }
    if (ids.size > 0) return [...ids];
  } catch (e) {}

  // Text parsing
  for (const line of output.split('\n')) {
    const t = line.trim();
    if (!t || t.length < 5) continue;
    if (/^[-─═┌┐└┘│┤├┬┴┼*=]+$/.test(t)) continue;
    if (/^\s*(id|name|schedule|next|status|cron)\b/i.test(t)) continue;

    // Full UUID
    const uuid = t.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
    if (uuid) { ids.add(uuid[1]); continue; }

    // Hex ID (8+ hex chars, standalone word)
    const hex = t.match(/\b([0-9a-f]{8,})\b/i);
    if (hex && !/^(0+|f+)$/i.test(hex[1])) { ids.add(hex[1]); continue; }

    // Slug at start of line
    const slug = t.match(/^([a-z0-9][a-z0-9_-]{2,80})\s/i);
    if (slug && !/^(no|total|running|active|name|id|schedule|cron)/i.test(slug[1])) {
      ids.add(slug[1]);
    }
  }

  return [...ids];
}

function deleteAllCrons() {
  // Method 1: Try bulk-delete commands
  for (const cmd of [['cron', 'clear'], ['cron', 'rm', '--all'], ['cron', 'purge']]) {
    const r = run(cmd);
    if (r.status === 0) {
      console.log(`[delete] Bulk delete OK: openclaw ${cmd.join(' ')}`);
      return true;
    }
  }

  // Method 2: List + parse + delete one-by-one
  let allOutput = '';

  // Try --json first
  const rJson = run(['cron', 'list', '--json']);
  if (rJson.status === 0 && rJson.stdout.trim()) {
    allOutput = rJson.stdout;
    console.log('[list] JSON mode OK');
  }

  // Also get text output (may have different/more info)
  const rText = run(['cron', 'list']);
  if (rText.stdout.trim()) {
    if (!allOutput) console.log('[list] Text mode');
    allOutput += '\n' + rText.stdout;
  }

  console.log('[list] Raw output:');
  console.log(stripAnsi(allOutput).substring(0, 3000));

  const ids = extractJobIds(allOutput);
  console.log(`[parse] Found ${ids.length} cron IDs to delete: ${ids.join(', ')}`);

  let deleted = 0;
  for (const id of ids) {
    const d = run(['cron', 'rm', id]);
    if (d.status === 0) {
      console.log(`  [DEL OK] ${id}`);
      deleted++;
    } else {
      console.log(`  [DEL FAIL] ${id}: ${d.stderr.substring(0, 80)}`);
    }
  }

  // Verify: re-list and check if empty
  const recheck = run(['cron', 'list']);
  const recheckClean = stripAnsi(recheck.stdout);
  if (/no cron/i.test(recheckClean) || recheckClean.trim().length < 20) {
    console.log(`[verify] All crons deleted (${deleted} removed)`);
    return true;
  }

  // Still have crons? Try one more round
  const remaining = extractJobIds(recheck.stdout);
  if (remaining.length > 0) {
    console.log(`[retry] ${remaining.length} crons still remain, retrying...`);
    for (const id of remaining) {
      run(['cron', 'rm', id]);
      console.log(`  [DEL RETRY] ${id}`);
    }
  }

  return deleted > 0;
}

function main() {
  console.log('=== Le Na Cron Import ===');
  console.log(`File: ${CRON_FILE}`);

  // STEP 1: Delete ALL existing cron jobs
  console.log('\n--- STEP 1: Delete old crons ---');
  deleteAllCrons();

  // STEP 2: Import new cron jobs
  console.log('\n--- STEP 2: Import new crons ---');
  const jobs = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
  console.log(`Loading ${jobs.length} jobs from JSON`);

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
      console.log(`  [ADD OK] ${job.id}`);
      ok++;
    } else {
      console.error(`  [ADD FAIL] ${job.id}: ${result.stderr.substring(0, 200)}`);
      fail++;
    }
  }

  console.log(`\nResult: ${ok} OK, ${fail} failed (expected: ${jobs.length})`);

  // STEP 3: Verify
  console.log('\n--- STEP 3: Verify ---');
  const final = run(['cron', 'list']);
  const finalIds = extractJobIds(final.stdout);
  const delta = finalIds.length - jobs.length;
  if (delta > 0) {
    console.error(`WARNING: ${delta} extra crons! Deletion incomplete.`);
  } else if (delta < 0) {
    console.error(`WARNING: ${Math.abs(delta)} crons missing! Some adds failed.`);
  } else {
    console.log(`OK: ${finalIds.length} crons active = ${jobs.length} expected`);
  }
  console.log(stripAnsi(final.stdout).substring(0, 2000));
}

main();
