# DAO THI LE NA - CEO AI Agent (OpenClaw Edition)
## AI Executive Assistant cho CEO Dao Huy Khanh - NSCA/STARDUCT

---

## 1. KIEN TRUC TONG THE

```
                     +---------------------------+
                     |   CEO Dao Huy Khanh       |
                     |   (Zalo / WebChat / Email) |
                     +------------+--------------+
                                  |
                     +------------v--------------+
                     |     OPENCLAW GATEWAY      |
                     |     (localhost:18789)      |
                     |   Agent: Dao Thi Le Na    |
                     +---+------+------+----+----+
                         |      |      |    |
              +----------+  +---+--+  ++-+  +--------+
              |             |      |   |  |           |
     +--------v---+  +-----v-+ +--v-+ | +v--------+  |
     | Claude     |  |GPT-4o | |Gem | | |Google   |  |
     | Sonnet 4   |  |Research| |ini | | |Sheets   |  |
     | (Email/    |  |Market  | |Cal | | |18 tabs  |  |
     | Reports/   |  |Analysis| |KPI | | |         |  |
     | Meeting)   |  +--------+ +----+ | +---------+  |
     +------------+                    |               |
                              +--------v-----+  +------v----+
                              | Gmail API    |  |Google     |
                              | dhk@nsca.vn  |  |Calendar   |
                              +--------------+  +-----------+
```

## 2. SO SANH N8N vs OPENCLAW

| | n8n (cu) | OpenClaw (moi) |
|---|---|---|
| Platform | Web UI, JSON workflows | CLI + Chat, YAML config |
| Messaging | Telegram only | **Zalo, WhatsApp, Telegram, 23+ kenh** |
| AI Model | HTTP Request node | **Tich hop truc tiep Claude/GPT/Gemini** |
| Cron | Per-workflow | **Tap trung, 11 cron jobs** |
| Config | 13 JSON files | **4 files (gateway.yaml, AGENTS.md, MEMORY.md, cron-jobs.json)** |
| Setup | Phuc tap (credentials, IDs) | **1 lenh install, scan QR Zalo** |
| Hosting | Docker/Cloud | **Chay local tren may CEO** |

## 3. CAI DAT (5 PHUT)

### Buoc 1: Cai Node.js
Tai va cai: https://nodejs.org (v22.16+ hoac v24)

### Buoc 2: Chay install script
```bash
# Windows:
install.bat

# Mac/Linux:
chmod +x install.sh && ./install.sh
```

### Buoc 3: Ket noi Zalo
```bash
openclaw channel pair zalo
```
Scan QR code hien tren man hinh bang Zalo tren dien thoai.

### Buoc 4: Import cron jobs
```bash
openclaw cron import cron-jobs.json
```

### Buoc 5: Test
```bash
openclaw agent --message "Chao Le Na, bao cao email hom nay"
```
Hoac gui tin nhan qua Zalo.

## 4. CAU TRUC THU MUC

```
openclaw/
  gateway.yaml          - Cau hinh gateway, channels, models, tools
  AGENTS.md             - Persona & commands cua Le Na
  MEMORY.md             - Bo nho lau dai (CEO profile, company data)
  cron-jobs.json        - 11 cron jobs (email scan, reports, reminders...)
  install.sh            - Script cai dat (Mac/Linux)
  install.bat           - Script cai dat (Windows)
  README-OPENCLAW.md    - File nay
```

## 5. 11 CRON JOBS (Lich trinh tu dong)

| # | Job | Lich | Chuc nang |
|---|-----|------|-----------|
| 1 | Smart Email Scan | 15p/lan 7AM-10PM T2-T7 | Quet, phan loai, TU DONG TRA LOI email dhk@nsca.vn |
| 2 | Calendar Briefing | 7:30 AM hang ngay | Gui lich hop qua Zalo |
| 3 | Monday Meeting Prep | Thu 2, 6AM | Tong hop 5 nguon, chuan bi hop giao ban |
| 4 | Weekly Biz Report | Thu 2, 8AM | Bao cao kinh doanh tuan |
| 5 | ClimaNexus Update | Thu 2, 9AM | KPI, milestone, pipeline cong ty con |
| 6 | International Market | Thu 4, 9AM | Santiago: export revenue, pipeline, MIP KPIs |
| 7 | Dept Report Reminder | Thu 6, 9AM | Nhac nho 14 phong ban nop bao cao |
| 8 | KPI Dashboard | Thu 6, 6PM | KPI tuan + phan tich |
| 9 | KHKD Variance | Thu 7, 8AM | So sanh KPI vs KHKD 2026 (10 nganh hang, 5 NPP) |
| 10 | Urgent Reminder | Thu 7, 4PM | Nhac KHAN CAP phong ban chua nop BC |
| 11 | CEO Escalation | Chu nhat, 8AM | Escalate danh sach phong ban chua nop |

## 6. LENH CHAT (qua Zalo)

| Lenh | Chuc nang |
|------|-----------|
| `/email` | Tom tat email hom nay |
| `/calendar` | Lich hop hom nay + ngay mai |
| `/report` | Bao cao kinh doanh |
| `/kpi` | KPI dashboard |
| `/research [chu de]` | Nghien cuu thi truong |
| `/khkd` | Variance KHKD 2026 |
| `/npp` | Tien do 5 NPP |
| `/climanexus` | Bao cao ClimaNexus |
| `/export` | Thi truong quoc te (Santiago) |
| `/draft [nd]` | Tao nhap email/bao cao |
| Chat tu do | Le Na tra loi theo ngu canh NSCA |

## 7. GOOGLE SHEETS (18 TABS)

Upload file `CEO-Agent-Google-Sheets-Template.xlsx` len Google Sheets.
Data da nhap san:
- Sheet 9: KHKD 2026 Baseline (10 nganh hang x 12 thang)
- Sheet 10: NPP Tracker (5 NPP x 12 thang + formulas)
- Sheet 12-13: ClimaNexus KPI + Milestones
- Sheet 17: Santiago KPIs (7 MIP KPIs)

## 8. API KEYS CAN THIET

| Service | Muc dich | Dang ky |
|---------|----------|---------|
| Claude API | Email, reports, analysis | https://console.anthropic.com |
| OpenAI API | Market research | https://platform.openai.com |
| Gemini API | Calendar, KPI | https://aistudio.google.com/apikey |
| Google OAuth2 | Gmail, Calendar, Sheets, Drive | Google Cloud Console |

## 9. BAO MAT

- OpenClaw chay **local** tren may anh - data khong ra ben ngoai
- Zalo pairing chi cho phep CEO (`dmPolicy: "pairing"`)
- API keys luu trong OpenClaw credentials (encrypted)
- Google OAuth2 scopes gioi han: gmail.modify, calendar.readonly, sheets, drive.readonly

---

*Dao Thi Le Na - AI Executive Assistant*
*CEO Dao Huy Khanh | NSCA/STARDUCT*
*OpenClaw Edition v3.0 - April 2026*
*11 cron jobs | 18 Google Sheets | Zalo + WebChat | Claude + GPT-4o + Gemini*
