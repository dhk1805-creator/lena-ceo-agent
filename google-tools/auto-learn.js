#!/usr/bin/env node
require('./_env');
// Auto-Learn — Le Na CEO Agent (Issue #31)
// Quet session Zalo OA cua VIP, dung Gemini Flash extract:
//   - Contact moi (ten, role, email/sdt, context)
//   - Technical facts/standards
//   - Customer feedback/preferences
//   - Business insights tu VIP
// Roi auto-write vao lena-learned overlay (khong ghi de baked-in memory).
//
// Usage:
//   node auto-learn.js [userId|"all"] [hours]
//     userId : Zalo OA user_id cua VIP. "all" = quet tat ca VIP. Default "all".
//     hours  : Chi quet session co activity trong N gio qua. Default 24.
//
// Output: JSON {success, scanned, learned, contacts_added, insights_added, files_updated}

const fs = require('fs');
const path = require('path');

const SESSION_DIR = '/root/.openclaw/zalo-oa-sessions';
const LEARNED_DIR = '/root/.openclaw/lena-learned';
const LOG_FILE = '/root/.openclaw/auto-learn.log';

const target = (process.argv[2] || 'all').trim();
const hoursWindow = parseInt(process.argv[3] || '24', 10);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.log(JSON.stringify({ error: 'Thieu GEMINI_API_KEY' }));
  process.exit(1);
}

// VIP alias map (must match proxy.js VIP_USERS)
const VIP_ALIAS = {
  [process.env.ZALO_OA_USER_SEP_KHANH || '_none_sep']:  { alias: 'sep-khanh', name: 'anh Khanh',  role: 'CEO' },
  [process.env.ZALO_OA_USER_CHI_HONG  || '_none_hong']: { alias: 'chi-hong',  name: 'chi Hong',   role: 'GD Phap ly + TCKT' },
  [process.env.ZALO_OA_USER_ANH_NGOC  || '_none_ngoc']: { alias: 'anh-ngoc',  name: 'anh Ngoc',   role: 'TP Kinh Doanh' },
};

function appendLog(line) {
  try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`); } catch (e) {}
}

function listSessionFiles() {
  try {
    return fs.readdirSync(SESSION_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ userId: f.replace(/\.json$/, ''), path: path.join(SESSION_DIR, f) }));
  } catch (e) {
    return [];
  }
}

// Convert Anthropic-style session messages -> plain text transcript Gemini co the doc
function sessionToTranscript(session, vipName) {
  if (!Array.isArray(session) || session.length === 0) return '';
  const lines = [];
  for (const msg of session) {
    const role = msg.role === 'user' ? vipName : 'Le Na';
    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Bo qua tool_use / tool_result blocks — chi lay text noi chuyen
      for (const block of msg.content) {
        if (typeof block === 'string') text += block;
        else if (block?.type === 'text' && block.text) text += block.text + ' ';
      }
    }
    text = text.trim();
    if (text) lines.push(`${role}: ${text}`);
  }
  return lines.join('\n');
}

async function extractWithGemini(transcript, vipName, vipRole) {
  const systemPrompt = `Ban la mot bo extract kien thuc cho tro ly AI cua CEO NSCA/STARDUCT. Doc transcript hoi thoai giua ${vipName} (${vipRole}) va Le Na, roi extract THONG TIN MOI dang nho de tham khao tuong lai.

QUY TAC EXTRACT:
1. CHI extract neu thong tin RO RANG, KHONG SUY DOAN, KHONG BIA.
2. Bo qua loi chao hoi, small talk, tool output.
3. CHI 4 loai:
   a) contacts: Nguoi MOI duoc nhac den (khong phai VIP, khong phai CBCNV co san)
   b) technical_facts: Tieu chuan ky thuat, spec san pham, cong thuc HVAC moi
   c) customer_feedback: Phan hoi/yeu cau cua khach hang, NPP
   d) business_insights: Quyet dinh chien luoc, du lieu kinh doanh quan trong tu VIP

OUTPUT BAT BUOC LA JSON HOP LE, KHONG MARKDOWN, KHONG \`\`\`. Format:
{
  "contacts": [
    {"name": "Ten day du", "role": "Chuc vu/vai tro", "company": "Cong ty (neu co)", "email": "...", "phone": "...", "context": "Hoan canh gap/nhac den (1 cau)"}
  ],
  "technical_facts": [
    {"topic": "Linh vuc (vd: VAV, fire damper)", "fact": "Noi dung fact (1-2 cau co data/ma chuan cu the)"}
  ],
  "customer_feedback": [
    {"customer": "Ten khach/NPP", "feedback": "Noi dung phan hoi (1-2 cau)"}
  ],
  "business_insights": [
    {"topic": "Chu de", "insight": "Insight/quyet dinh (1-2 cau co so lieu hoac context cu the)"}
  ]
}

NEU TRANSCRIPT KHONG CO GI DANG NHO -> tra ve {"contacts":[],"technical_facts":[],"customer_feedback":[],"business_insights":[]}.

LUU Y:
- KHONG extract VIP (anh Khanh, chi Hong, anh Ngoc) hoac CBCNV NSCA co san vao contacts.
- KHONG extract task/lich/email subjects — do la transient.
- Field "email" va "phone" chi dien khi RO RANG xuat hien trong transcript.`;

  const userPrompt = `TRANSCRIPT (${vipName} <-> Le Na):\n\n${transcript}\n\n--- HET ---\n\nExtract JSON theo format tren.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { error: `Gemini ${res.status}: ${err.substring(0, 200)}` };
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return { error: 'Gemini empty response' };

    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) {
      // Strip markdown fences if Gemini added them despite responseMimeType
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      try { parsed = JSON.parse(cleaned); }
      catch (e2) { return { error: `JSON parse: ${e2.message}`, raw: text.substring(0, 300) }; }
    }
    return { data: parsed };
  } catch (e) {
    return { error: e.message };
  }
}

function appendBlock(file, header, body) {
  try { fs.mkdirSync(LEARNED_DIR, { recursive: true }); } catch (e) {}
  const exists = fs.existsSync(file);
  let block = '';
  if (!exists) {
    const topic = path.basename(file, '.md');
    block += `# ${topic} — Le Na auto-learn overlay\n\n`;
    block += `> Auto extract tu Zalo OA conversations qua \`auto-learn.js\`. Doc qua \`memory_search\`.\n\n`;
  }
  block += `## ${header}\n\n${body}\n\n`;
  fs.appendFileSync(file, block);
  return block.length;
}

function fmtContact(c) {
  const parts = [];
  if (c.name) parts.push(`**${c.name}**`);
  if (c.role) parts.push(c.role);
  if (c.company) parts.push(c.company);
  let line = `- ${parts.join(' — ')}`;
  const meta = [];
  if (c.email) meta.push(`email: ${c.email}`);
  if (c.phone) meta.push(`sdt: ${c.phone}`);
  if (meta.length) line += ` (${meta.join(', ')})`;
  if (c.context) line += `\n  - Context: ${c.context}`;
  return line;
}

function fmtTechnical(t) {
  return `- **${t.topic || 'unknown'}**: ${t.fact || ''}`;
}

function fmtFeedback(f) {
  return `- **${f.customer || 'unknown'}**: ${f.feedback || ''}`;
}

function fmtInsight(i) {
  return `- **${i.topic || 'unknown'}**: ${i.insight || ''}`;
}

async function processSession(userId, sessionPath) {
  const vip = VIP_ALIAS[userId];
  if (!vip) return { userId, skipped: 'not-vip' };

  const stat = fs.statSync(sessionPath);
  const ageMs = Date.now() - stat.mtime.getTime();
  const ageHr = ageMs / 3600000;
  if (ageHr > hoursWindow) {
    return { userId, alias: vip.alias, skipped: `stale (${ageHr.toFixed(1)}h > ${hoursWindow}h)` };
  }

  let session;
  try { session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8')); }
  catch (e) { return { userId, alias: vip.alias, skipped: `read error: ${e.message}` }; }

  const transcript = sessionToTranscript(session, vip.name);
  if (!transcript || transcript.length < 100) {
    return { userId, alias: vip.alias, skipped: 'transcript too short' };
  }

  // Tranh extract lai cung 1 session — luu marker theo session mtime
  const markerFile = path.join(LEARNED_DIR, `.auto-learn-${vip.alias}.marker`);
  try {
    if (fs.existsSync(markerFile)) {
      const lastMtime = parseInt(fs.readFileSync(markerFile, 'utf-8'), 10);
      if (lastMtime >= stat.mtime.getTime()) {
        return { userId, alias: vip.alias, skipped: 'already processed' };
      }
    }
  } catch (e) {}

  appendLog(`extracting ${vip.alias} (${transcript.length} chars, ${ageHr.toFixed(1)}h old)`);
  const result = await extractWithGemini(transcript, vip.name, vip.role);
  if (result.error) {
    appendLog(`ERROR ${vip.alias}: ${result.error}`);
    return { userId, alias: vip.alias, error: result.error };
  }

  const extracted = result.data || {};
  const contacts = Array.isArray(extracted.contacts) ? extracted.contacts : [];
  const techs    = Array.isArray(extracted.technical_facts) ? extracted.technical_facts : [];
  const fbs      = Array.isArray(extracted.customer_feedback) ? extracted.customer_feedback : [];
  const insights = Array.isArray(extracted.business_insights) ? extracted.business_insights : [];

  const ts = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  const header = `Auto-learn ${ts} (tu ${vip.name})`;
  const filesUpdated = [];

  if (contacts.length) {
    appendBlock(path.join(LEARNED_DIR, 'contacts.md'), header, contacts.map(fmtContact).join('\n'));
    filesUpdated.push('contacts.md');
  }
  if (techs.length) {
    appendBlock(path.join(LEARNED_DIR, 'technical-facts.md'), header, techs.map(fmtTechnical).join('\n'));
    filesUpdated.push('technical-facts.md');
  }
  if (fbs.length) {
    appendBlock(path.join(LEARNED_DIR, 'customer-feedback.md'), header, fbs.map(fmtFeedback).join('\n'));
    filesUpdated.push('customer-feedback.md');
  }
  if (insights.length) {
    appendBlock(path.join(LEARNED_DIR, 'business-insights.md'), header, insights.map(fmtInsight).join('\n'));
    filesUpdated.push('business-insights.md');
  }

  try { fs.writeFileSync(markerFile, String(stat.mtime.getTime())); } catch (e) {}

  return {
    userId, alias: vip.alias,
    contacts: contacts.length,
    technical_facts: techs.length,
    customer_feedback: fbs.length,
    business_insights: insights.length,
    files_updated: filesUpdated
  };
}

async function main() {
  const all = listSessionFiles();
  let candidates;
  if (target === 'all') {
    candidates = all.filter(s => VIP_ALIAS[s.userId]);
  } else {
    // Cho phep truyen userId hoac alias
    const aliasToId = Object.fromEntries(Object.entries(VIP_ALIAS).map(([id, v]) => [v.alias, id]));
    const userId = aliasToId[target] || target;
    candidates = all.filter(s => s.userId === userId);
  }

  if (candidates.length === 0) {
    console.log(JSON.stringify({ success: true, scanned: 0, note: 'No matching session files', target }));
    return;
  }

  const results = [];
  for (const c of candidates) {
    const r = await processSession(c.userId, c.path);
    results.push(r);
  }

  const totals = results.reduce((acc, r) => {
    if (r.contacts) acc.contacts += r.contacts;
    if (r.technical_facts) acc.technical_facts += r.technical_facts;
    if (r.customer_feedback) acc.customer_feedback += r.customer_feedback;
    if (r.business_insights) acc.business_insights += r.business_insights;
    return acc;
  }, { contacts: 0, technical_facts: 0, customer_feedback: 0, business_insights: 0 });

  console.log(JSON.stringify({
    success: true,
    scanned: candidates.length,
    target,
    hours_window: hoursWindow,
    totals,
    per_session: results,
    hint: 'Le Na lan sau dung memory_search keyword=... file=contacts/technical-facts/customer-feedback/business-insights de tra cuu.'
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
