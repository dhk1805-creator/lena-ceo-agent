#!/usr/bin/env node
require('./_env');
// Zalo OA — đọc lịch sử tin nhắn VIP từ session files
// Usage:
//   node zalo-oa-history.js                    → tất cả VIP, 24h gần nhất
//   node zalo-oa-history.js chi-hong           → chỉ chị Hồng
//   node zalo-oa-history.js sep-khanh 48       → Sếp Khánh, 48h gần nhất
//   node zalo-oa-history.js all 24             → tất cả, 24h

const fs = require('fs');
const path = require('path');

const SESSION_DIR = '/root/.openclaw/zalo-oa-sessions';
const EVENTS_FILE = '/root/.openclaw/zalo-events.jsonl';

const VIP_MAP = {
  'sep-khanh': process.env.ZALO_OA_USER_SEP_KHANH,
  'chi-hong': process.env.ZALO_OA_USER_CHI_HONG || '2389450107733864097',
  'anh-ngoc': process.env.ZALO_OA_USER_ANH_NGOC,
};

const VIP_NAMES = {
  [process.env.ZALO_OA_USER_SEP_KHANH]: 'Sếp Khánh',
  '2389450107733864097': 'Chị Hồng',
  [process.env.ZALO_OA_USER_CHI_HONG || '2389450107733864097']: 'Chị Hồng',
  [process.env.ZALO_OA_USER_ANH_NGOC]: 'Anh Ngọc',
};

const target = process.argv[2] || 'all';
const hoursBack = parseInt(process.argv[3] || '24', 10);
const cutoff = Date.now() - hoursBack * 3600 * 1000;

function readSessionFile(userId) {
  const file = path.join(SESSION_DIR, `${userId}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function readEvents(filterUserId) {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const lines = fs.readFileSync(EVENTS_FILE, 'utf-8').trim().split('\n');
  const events = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const eventTime = new Date(entry.time).getTime();
      if (eventTime < cutoff) continue;
      const senderId = entry.event?.sender?.id;
      if (filterUserId && senderId !== filterUserId) continue;
      const eventName = entry.event?.event_name;
      if (eventName === 'user_send_text') {
        events.push({
          time: entry.time,
          from: VIP_NAMES[senderId] || senderId,
          type: 'text',
          text: entry.event.message?.text || '',
        });
      } else if (eventName === 'user_send_image') {
        const att = entry.event?.message?.attachments?.[0];
        events.push({
          time: entry.time,
          from: VIP_NAMES[senderId] || senderId,
          type: 'image',
          text: '[Ảnh]',
          image_url: att?.payload?.url || att?.payload?.thumbnail || '',
        });
      }
    } catch (e) {}
  }
  return events;
}

const result = { query: target, hours: hoursBack, messages: [] };

if (target === 'all') {
  for (const [alias, userId] of Object.entries(VIP_MAP)) {
    if (!userId) continue;
    const events = readEvents(userId);
    if (events.length > 0) {
      result.messages.push({ vip: alias, name: VIP_NAMES[userId] || alias, count: events.length, recent: events.slice(-5) });
    }
  }
} else {
  const userId = VIP_MAP[target] || target;
  const events = readEvents(userId);
  result.messages.push({ vip: target, name: VIP_NAMES[userId] || target, count: events.length, recent: events.slice(-10) });
}

if (result.messages.length === 0) {
  result.summary = `Không có tin nhắn Zalo OA nào trong ${hoursBack}h qua`;
} else {
  const total = result.messages.reduce((s, m) => s + m.count, 0);
  result.summary = `${total} tin nhắn Zalo OA trong ${hoursBack}h qua`;
}

console.log(JSON.stringify(result, null, 2));
