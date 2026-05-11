# 📋 HANDOFF: Lê Na CEO Agent — Session continuation

**Ngày**: 11/05/2026
**User**: CEO Đào Huy Khánh (dhk@nsca.vn)
**Project**: Lê Na AI Executive Assistant cho NSCA/STARDUCT

---

## 🎯 PROJECT OVERVIEW

**Đào Thị Lê Na** = AI Executive Assistant phục vụ 3 VIP:
- **Sếp Khánh** (CEO) — dhk@nsca.vn
- **Chị Hồng** (GĐ Pháp lý + TCKT) — nsca@nsca.vn
- **Anh Ngọc Bộc béo** (TP Kinh Doanh) — ndao@nsca.vn

---

## 📂 LOCAL FILE LOCATIONS

```
D:\Projects\lena-ceo-agent\           ← MAIN CODE (sau migrate 10/5)
C:\Users\WELCOME\.openclaw\           ← Local OpenClaw config (ít dùng)
```

**Old path (đã xóa):** `D:\NSCA R&D Dropbox\THEO DÕI KQSXKD\KHKD 2026\Products - Standards - Specificatios\CEO-AI-Agent-n8n\openclaw\`

---

## 🌐 INFRASTRUCTURE

| Service | Value |
|---|---|
| **Railway Project** | `exquisite-serenity` |
| **Railway Service** | `lena-ceo-agent` |
| **Dashboard URL** | https://lena-ceo-agent-production-4537.up.railway.app |
| **GitHub** | https://github.com/dhk1805-creator/lena-ceo-agent |
| **Volume** | `/root/.openclaw` (50GB persistent) |
| **OpenClaw version** | `2026.4.29` (PINNED) |
| **Default model** | Claude Haiku 4.5 (Dashboard) / Sonnet 4 cho VIP via OA |

---

## 🏗️ ARCHITECTURE

```
Railway Container (port 8080 public, 8090 internal)
├── Express Proxy (proxy.js) — port 8080
│   ├── Serve /public/* (Zalo domain verification)
│   ├── POST /zalo-webhook (2-way OA bridge with tool calling)
│   └── Forward / → OpenClaw on 8090
└── OpenClaw Gateway (port 8090)
    ├── Dashboard chat (Claude Haiku default)
    ├── 12 cron jobs
    └── Tools via /app/google-tools/
```

---

## 🔐 RAILWAY ENV VARS

```
CLAUDE_API_KEY                  Anthropic (production)
OPENAI_API_KEY
GEMINI_API_KEY                  Google (free tier)
GOOGLE_CLIENT_ID                OAuth NSCA
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN            For Gmail/Sheets/Calendar
GOOGLE_SHEET_ID                 1UjAigu6WtBqB4upLzvME2BxptKcSAmtW7a4nPbqFaCI
GATEWAY_PASSWORD                lena2026
TZ                              Asia/Ho_Chi_Minh
ZALO_CREDS_B64                  (auto-restore Zalo Personal session — currently broken)
ZALO_OA_APP_ID                  3271178555642588528
ZALO_OA_ID                      3574723519900979654 (Starasia JSC)
ZALO_OA_SECRET                  Eh2d892YyCm3T4IDUJK2
ZALO_OA_ACCESS_TOKEN            (production, expire 25h, cần auto-refresh)
ZALO_OA_REFRESH_TOKEN           (expire 3 tháng)
ZALO_OA_USER_SEP_KHANH          6869834949444296385 (Starduct Nsca display name)
ZALO_OA_USER_CHI_HONG           9076345556107321186 (Nguyễn Thị Thúy Hồng)
ZALO_OA_USER_ANH_NGOC           ❌ CHƯA CÓ (anh Ngọc chưa follow OA)
```

---

## 📊 CRON JOBS (12 jobs)

1. **7h sáng** — Daily Calendar Morning Briefing (3 VIP)
2. **9h sáng** — Daily NPP Scan (anh Ngọc)
3. **17h** — TCKT Email Triage (chị Hồng)
4. **17h** — Email Triage Anh Ngọc
5. **T7 21h** — Weekly Email Scan Sếp Khánh
6. **T7 21h** — Weekly Report Scan (lưu BC 11 BP vào Sheet)
7. **CN 21h** — Weekly Report Reminder
8. **T2 9h** — Weekly PKD Team Report (anh Ngọc)
9. **T2 9h30** — Weekly Business Report (Sếp + 11 BP)
10. **T3 8h** — Check biên bản họp T2
11. **Cuối tháng 21h** — Monthly Closing Report PKD (anh Ngọc)
12. **Cuối tháng 21h** — Monthly Closing Report Sếp + Chị Hồng

**BC tuần chỉ 11 BP** (BO/BD Nội địa/BD Intl báo cáo qua PKD → không nhắc 3 BP này).

---

## 🛠️ TOOLS (`/app/google-tools/`)

| Script | Purpose |
|---|---|
| `gmail-read.js` | Read emails với filter |
| `gmail-send.js` | Send email (with CC) |
| `gmail-attachment.js` | Download attachment |
| `sheets-read.js` / `sheets-write.js` | Google Sheets I/O |
| `calendar-read.js` / `calendar-create.js` | Google Calendar |
| `gdoc-create.js` / `gdoc-export.js` | Google Docs |
| `drive-list.js` / `drive-download.js` | Google Drive |
| `gemini-write.js` / `gemini-analyze.js` | Gemini Flash (FREE) |
| `gpt-respond.js` | GPT-4o Mini |
| `image-overlay.js` / `dalle-generate.js` | Image gen |
| `npp-order-log.js` | NPP order scanning |
| `facebook-post.js` | FB posting (pending App review) |
| **`zalo-oa-send.js`** | **NEW: Send via Zalo OA** (with VIP alias resolution) |
| **`zalo-oa-refresh-token.js`** | **NEW: Refresh OA access token** |
| `import-cron.js` | Import cron jobs via CLI |

---

## 🔑 ZALO OA SETUP (hoàn thành tối 11/5)

### ✅ Done:
- App "Lena AI Starasia" tạo (App ID `3271178555642588528`)
- Verify domain Railway URL (qua Express proxy `/public/*`)
- Liên kết OA "Starasia JSC" (verified, package "Nâng cao" đến 10/5/2027)
- OAuth flow → Production Access Token + Refresh Token
- 3 followers, identify: Sếp Khánh, Chị Hồng, anh Sơn (anh Ngọc chưa follow)
- Test gửi tin OK cho cả Sếp Khánh + Chị Hồng
- Mua gói ZBS (Nâng cao) → upgrade success

### 🚧 Vừa push commit `7c356eb`:
- **Zalo OA 2-way bridge** với 8 tools (proxy.js):
  - email_send, email_read
  - calendar_read, calendar_create
  - sheets_read, sheets_write
  - gdoc_create
  - zalo_oa_send_to_vip
- Per-VIP session memory (`/root/.openclaw/zalo-oa-sessions/`)
- Sonnet 4 cho VIP, Haiku 4.5 cho người lạ
- Multi-step tool calling loop (max 5 iterations)

### ⏳ Pending — Cần làm:
1. **Setup Webhook URL trên Zalo Developer Console:**
   - URL: `https://lena-ceo-agent-production-4537.up.railway.app/zalo-webhook`
   - Events: `user_send_text`, `follow`, `unfollow`, `user_send_image`
2. **Test 2-way từ Sếp Khánh nhắn OA Starasia JSC** (sau khi Railway deploy commit `7c356eb`)
3. **Anh Ngọc Bộc béo follow OA + nhắn 1 tin** → identify user_id → set `ZALO_OA_USER_ANH_NGOC` env var
4. **Cron auto-refresh token** (mỗi 20h, trước expire 25h)
5. **Migrate cron jobs** từ `openclaw message send --channel zalouser` sang `zalo-oa-send.js`

---

## 🐛 KNOWN ISSUES

### 1. Zalo Personal (zalouser channel) — BROKEN
- `api.js` file của plugin zalouser thường xuyên bị missing trong OpenClaw v2026.4.29
- start.sh có `rm -rf /root/.openclaw/plugin-runtime-deps` để force reinstall mỗi deploy nhưng vẫn fail
- **Workaround:** Đã chuyển sang Zalo OA (Starasia JSC) thay thế

### 2. Lê Na's identity confusion
- Lê Na đôi khi quên SDT `0989407322` là của chính mình, không phải Sếp
- Đã có rule trong AGENTS.md nhưng vẫn lặp lại

### 3. Lê Na thỉnh thoảng "vẽ việc"
- Tự đề xuất chạy doctor/fix/diagnose khi không cần
- Tự tạo QR Zalo dù không yêu cầu
- Đã thêm rule cấm trong AGENTS.md

### 4. AGENTS.md size: 11,310 chars (under 12k limit OK)

### 5. Anh Ngọc Bộc béo CHƯA follow OA Starasia JSC
- Chỉ thiếu user_id của anh Ngọc → cron PKD chưa gửi được qua OA

---

## 📝 RECENT KEY COMMITS

```
7c356eb (latest) — Zalo OA 2-way: Lê Na agent with tool calling
714493f — Zalo OA 2-way bridge: webhook → Claude → reply
5ea6c33 — zalo-oa-send.js: VIP alias + auto Lê Na signature
b8a6e16 — Add Zalo OA webhook receiver
9b7b981 — Add zalo-oa-send.js + zalo-oa-refresh-token.js
de855b8 — Express proxy for Zalo OA domain verification
0834afe — Post-migration cleanup
de6d64c — Setup Claude Code dev environment for Le Na
f80dccd — Auto-restore Zalo credentials from env var
```

---

## 💰 COST TRACKING (tuần Apr 27 → May 3)

- Total Lena AI NSCA API key: **$7.20/tuần** (~$30-35/tháng)
- Mostly Haiku 4.5 (95%), Sonnet 4 (5%)
- Cache hit rate: 78% (excellent)
- Zalo OA Nâng cao: 1 năm (10/5/2026 → 10/5/2027) — đã trả tiền 1 lần

---

## 🎯 NEXT TASKS FOR NEW SESSION

### Priority 1 (ngay):
1. Verify Railway deploy commit `7c356eb` xong
2. User setup Webhook URL trên Zalo Developer Console
3. Test 2-way: Sếp Khánh nhắn OA → Lê Na reply (Claude Sonnet + tools)
4. Test tool calling: `"Em xem email từ anh Đức"` → Lê Na gọi email_read
5. Identify anh Ngọc user_id sau khi anh ấy follow OA

### Priority 2 (tuần này):
1. Migrate cron jobs sang `zalo-oa-send.js` thay vì `zalouser channel`
2. Cron auto-refresh OA token (mỗi 20h)
3. Update AGENTS.md với rules mới về OA workflow

### Priority 3 (sau):
1. Tools nâng cao: NPP scan, weekly aggregation
2. Task Tracker sheet + cron follow-up
3. Setup webhook event types khác (follow, unfollow → log VIP)
4. Cải thiện email check (anh đã phàn nàn check không đầy đủ)

---

## 📚 KEY DOCUMENTATION FILES

```
D:\Projects\lena-ceo-agent\
├── AGENTS.md                       (11.3k chars, Lê Na main rules)
├── HANDOFF.md                      (THIS FILE)
├── memory/
│   ├── ai-delegation.md            (Claude/Gemini/GPT cost optimization)
│   ├── workflow-anh-ngoc-pkd.md    (Anh Ngọc's PKD management)
│   ├── lich-hen-procedure.md       (Calendar workflow)
│   ├── email-procedures.md
│   ├── brand-guide.md
│   ├── directory.md                (63 contacts NSCA)
│   └── zalo-pairing-procedure.md
├── proxy.js                        ⭐ Express proxy + OA 2-way bridge
├── start.sh                        (Container startup)
├── Dockerfile                      (Pin openclaw@2026.4.29)
└── cron-jobs.json                  (12 cron jobs)
```

---

## 💡 USER COMMUNICATION STYLE

- Tiếng Việt (technical terms English OK)
- Concise, action over explanation
- User là CEO, không thích đọc dài dòng
- User dễ frustrated khi Lê Na "vẽ việc" hoặc lặp lại
- Push code phải thận trọng — User đã cảnh báo nhiều lần

---

## ⚠️ COMMITMENTS TO USER

1. **KHÔNG push code bừa bãi** — user đã frustrated nhiều lần với việc deploy liên tục
2. **Pin version OpenClaw** — không dùng @latest
3. **Test trước khi push production**
4. **Trả lời ngắn gọn, đi thẳng vào vấn đề**

---

**End of handoff. Continue from here in new session.**
